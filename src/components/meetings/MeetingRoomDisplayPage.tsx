import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import pkg from '../../../package.json';
import { useParams } from 'react-router-dom';
import {
  CalendarDays,
  Clipboard,
  Clock3,
  Coffee,
  Cpu,
  LifeBuoy,
  Mail,
  Monitor,
  Moon,
  PhoneCall,
  RefreshCcw,
  Snowflake,
  Sparkles,
  Sun,
  Tv,
  Users,
  Video,
  Wifi,
  X
} from 'lucide-react';
import {
  fetchMeetingRoomSchedule,
  sendMeetingRoomHelpRequest,
  toggleMeetingRoomCheckIn,
  type MeetingBooking,
  type SiteSupportContacts
} from '../../api/meetings';

const formatClock = (ts: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(ts));

const formatTime = (ts: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ts));

const formatRemainingToEnd = (meeting: MeetingBooking | null, now: number) => {
  if (!meeting) return '';
  const end = Number(meeting.endAt);
  if (!Number.isFinite(end)) return '';
  const remainingMs = Math.max(0, end - now);
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h:${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
};

const formatDateLong = (ts: number) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(ts));

const minuteOfDay = (ts: number) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};

const progressOf = (meeting: MeetingBooking | null, now: number) => {
  if (!meeting) return 0;
  const start = Number(meeting.startAt);
  const end = Number(meeting.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
};

const equipmentDefs = [
  { match: ['projector'], label: 'Proiettore', Icon: Monitor },
  { match: ['tv'], label: 'TV', Icon: Tv },
  { match: ['video conference', 'autonomous video conference'], label: 'Videoconferenza', Icon: Video },
  { match: ['coffee service'], label: 'Coffee', Icon: Coffee },
  { match: ['whiteboard'], label: 'Lavagna', Icon: Clipboard },
  { match: ['guest wifi'], label: 'Guest Wifi', Icon: Wifi },
  { match: ['fridge'], label: 'Frigo', Icon: Snowflake }
] as const;

const normalize = (v: string) => String(v || '').trim().toLowerCase();
const normalizeCompanyKey = (v: string) => String(v || '').trim().toLowerCase();
const resolveLogoUrl = (raw: string) => {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  try {
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return new URL(normalizedPath, window.location.origin).toString();
  } catch {
    return value;
  }
};

const equipmentFromRoom = (equipment: string[]) => {
  const set = new Set((equipment || []).map(normalize));
  return equipmentDefs.filter((def) => def.match.some((m) => set.has(normalize(m))));
};

const PARTICIPANT_OVERLAY_AUTO_CLOSE_MS = 25_000;

const participantCheckInKey = (entry: { label: string; sub?: string | null; tag?: string | null; email?: string | null; checkKey?: string | null }) => {
  const explicit = String((entry as any)?.checkKey || '').trim();
  if (explicit) return explicit;
  const rawSub = String(entry.sub || '').trim();
  const isExternal = String(entry.tag || '') === 'EXT';
  const normalizedEmail = String((entry as any)?.email || (!isExternal ? rawSub.split('·')[0] || '' : ''))
    .trim()
    .toLowerCase();
  return `${String(entry.tag || 'INT')}::${String(entry.label || '').trim().toLowerCase()}::${normalizedEmail}`;
};
const buildCheckInKeyFromParticipant = (params: {
  kind?: 'real_user' | 'manual' | string | null;
  fullName?: string | null;
  externalId?: string | null;
  email?: string | null;
  optional?: boolean;
}) => {
  const kind = String(params.kind || 'real_user') === 'manual' ? 'manual' : 'real_user';
  const tag = kind === 'manual' ? 'EXT' : params.optional ? 'OPT' : 'INT';
  const label = String(params.fullName || params.externalId || '-').trim().toLowerCase();
  const email = String(params.email || '').trim().toLowerCase();
  return `${tag}::${label}::${email}`;
};
const buildCheckInKeyFromExternalGuest = (params: { name?: string | null; email?: string | null }) =>
  `EXT::${String(params.name || '-').trim().toLowerCase()}::${String(params.email || '').trim().toLowerCase()}`;
const guestIdentityKey = (entry: { label?: string | null; email?: string | null }) =>
  `${String(entry?.label || '').trim().toLowerCase()}::${String(entry?.email || '').trim().toLowerCase()}`;

const statusTone = (meeting: MeetingBooking, now: number) => {
  const start = Number(meeting.startAt);
  const end = Number(meeting.endAt);
  const inProgress = start <= now && now < end;
  const isPast = end <= now;
  if (meeting.status === 'pending') return 'border-amber-400/50 bg-amber-500/15 text-amber-100';
  if (meeting.status === 'rejected' || meeting.status === 'cancelled') return 'border-slate-600 bg-slate-800/70 text-slate-300';
  if (inProgress) return 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100';
  if (isPast) return 'border-slate-700 bg-slate-900/60 text-slate-400';
  return 'border-violet-400/40 bg-violet-500/15 text-violet-100';
};

type HelpOverlayState =
  | { mode: 'menu' }
  | { mode: 'sent'; serviceLabel: string }
  | { mode: 'phone'; serviceLabel: string; phone: string };

const MeetingRoomDisplayPage = () => {
  const { roomId } = useParams();
  const [theme, setTheme] = useState<'night' | 'day'>('night');
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<{
    room: any;
    inProgress: MeetingBooking | null;
    upcoming: MeetingBooking[];
    daySchedule: MeetingBooking[];
    kioskPublicUrl?: string;
  } | null>(null);
  const [participantMeeting, setParticipantMeeting] = useState<MeetingBooking | null>(null);
  const [participantOverlayUntil, setParticipantOverlayUntil] = useState<number | null>(null);
  const [checkInStatusByMeetingId, setCheckInStatusByMeetingId] = useState<Record<string, Record<string, true>>>({});
  const [checkInThanksMessage, setCheckInThanksMessage] = useState<string | null>(null);
  const [helpOverlay, setHelpOverlay] = useState<HelpOverlayState | null>(null);
  const kioskLang = useMemo<'it' | 'en'>(() => {
    try {
      const lang = String(window.navigator?.language || 'en').toLowerCase();
      return lang.startsWith('it') ? 'it' : 'en';
    } catch {
      return 'en';
    }
  }, []);
  const tk = useCallback((labels: { it: string; en: string }) => (kioskLang === 'it' ? labels.it : labels.en), [kioskLang]);
  const autoCloseRef = useRef<number | null>(null);
  const helpOverlayTimerRef = useRef<number | null>(null);

  const reload = (options?: { silent?: boolean }) => {
    const rid = String(roomId || '').trim();
    if (!rid) {
      setError('Missing room id');
      setLoading(false);
      return;
    }
    const silent = !!options?.silent;
    if (silent) setRefreshing(true);
    else setLoading(true);
    fetchMeetingRoomSchedule(rid)
      .then((next) => {
        setPayload({
          room: next.room,
          inProgress: next.inProgress,
          upcoming: next.upcoming || [],
          daySchedule: next.daySchedule || [],
          kioskPublicUrl: next.kioskPublicUrl
        });
        setError('');
        const allMeetings = [next.inProgress, ...(next.upcoming || []), ...(next.daySchedule || [])].filter(Boolean) as MeetingBooking[];
        setCheckInStatusByMeetingId((prev) => {
          const nextMap: Record<string, Record<string, true>> = {};
          for (const booking of allMeetings) {
            const id = String(booking.id || '').trim();
            if (!id) continue;
            const serverMap = (next as any)?.checkInStatusByMeetingId?.[id];
            if (serverMap && typeof serverMap === 'object') {
              const normalized: Record<string, true> = {};
              for (const [k, v] of Object.entries(serverMap as Record<string, any>)) {
                if (v) normalized[String(k)] = true;
              }
              nextMap[id] = normalized;
              continue;
            }
            nextMap[id] = prev[id] || {};
          }
          return nextMap;
        });
      })
      .catch(() => {
        if (!silent) setPayload(null);
        setError('Unable to load room schedule');
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    reload();
    const clockTick = window.setInterval(() => setNow(Date.now()), 1000);
    const refreshIntervalMs = participantMeeting ? 2_000 : payload?.inProgress ? 4_000 : 15_000;
    const refreshTick = window.setInterval(() => reload({ silent: true }), refreshIntervalMs);
    return () => {
      window.clearInterval(clockTick);
      window.clearInterval(refreshTick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, !!payload?.inProgress, !!participantMeeting]);

  useEffect(() => {
    const rid = String(roomId || '').trim();
    if (!rid) return;
    try {
      window.localStorage.setItem('plixmap:kiosk:lastRoomId', rid);
    } catch {
      // ignore storage errors on kiosk devices
    }
    try {
      const roomLabel = String((payload?.room as any)?.roomName || '').trim() || 'Kiosk';
      document.title = `Plixmap Kiosk • ${roomLabel}`;
      const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
        let el = document.head.querySelector(selector) as HTMLMetaElement | null;
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attr, key);
          document.head.appendChild(el);
        }
        el.setAttribute('content', value);
      };
      setMeta('meta[name="apple-mobile-web-app-capable"]', 'name', 'apple-mobile-web-app-capable', 'yes');
      setMeta('meta[name="mobile-web-app-capable"]', 'name', 'mobile-web-app-capable', 'yes');
      setMeta('meta[name="apple-mobile-web-app-status-bar-style"]', 'name', 'apple-mobile-web-app-status-bar-style', 'black-translucent');
      setMeta('meta[name="apple-mobile-web-app-title"]', 'name', 'apple-mobile-web-app-title', roomLabel);
      let appleIcon = document.head.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
      if (!appleIcon) {
        appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        document.head.appendChild(appleIcon);
      }
      appleIcon.href = '/plixmap-logo.png';
      let manifestLink = document.head.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = `/manifest-kiosk/${encodeURIComponent(rid)}.webmanifest`;
    } catch {
      // ignore DOM mutation errors
    }
  }, [payload?.room, roomId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setParticipantMeeting(null);
      if (e.key === 'Escape') setHelpOverlay(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!participantMeeting || !participantOverlayUntil) return;
    if (autoCloseRef.current) window.clearInterval(autoCloseRef.current);
    autoCloseRef.current = window.setInterval(() => {
      if (Date.now() >= Number(participantOverlayUntil)) {
        setParticipantMeeting(null);
        setParticipantOverlayUntil(null);
        if (autoCloseRef.current) {
          window.clearInterval(autoCloseRef.current);
          autoCloseRef.current = null;
        }
      }
    }, 250);
    return () => {
      if (autoCloseRef.current) {
        window.clearInterval(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    };
  }, [participantMeeting, participantOverlayUntil]);

  useEffect(() => {
    if (!participantMeeting) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = (body.style as any).overscrollBehavior;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    (body.style as any).overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      (body.style as any).overscrollBehavior = prevBodyOverscroll;
    };
  }, [participantMeeting]);

  useEffect(() => {
    if (!checkInThanksMessage) return;
    const timer = window.setTimeout(() => setCheckInThanksMessage(null), 1400);
    return () => window.clearTimeout(timer);
  }, [checkInThanksMessage]);

  useEffect(() => {
    if (!helpOverlay) return;
    if (helpOverlayTimerRef.current) window.clearTimeout(helpOverlayTimerRef.current);
    const timeoutMs = helpOverlay.mode === 'menu' ? 10_000 : helpOverlay.mode === 'phone' ? 20_000 : 1_400;
    helpOverlayTimerRef.current = window.setTimeout(() => {
      setHelpOverlay(null);
      helpOverlayTimerRef.current = null;
    }, timeoutMs);
    return () => {
      if (helpOverlayTimerRef.current) {
        window.clearTimeout(helpOverlayTimerRef.current);
        helpOverlayTimerRef.current = null;
      }
    };
  }, [helpOverlay]);

  const openParticipantsOverlay = (meeting: MeetingBooking) => {
    setParticipantMeeting(meeting);
    setParticipantOverlayUntil(Date.now() + PARTICIPANT_OVERLAY_AUTO_CLOSE_MS);
  };

  const markCheckIn = async (meeting: MeetingBooking, entry: { label: string; sub?: string | null; tag?: string | null }) => {
    const meetingStart = Number(meeting?.startAt || 0);
    const meetingEnd = Number(meeting?.endAt || 0);
    if (!(meetingStart <= Date.now() && Date.now() < meetingEnd)) return;
    const meetingId = String(meeting.id || '').trim();
    if (!meetingId) return;
    const key = participantCheckInKey(entry);
    const currentSnapshot = checkInStatusByMeetingId[meetingId] || {};
    const nextChecked = !currentSnapshot[key];
    const applyMap = (map: Record<string, true>) => {
      setCheckInStatusByMeetingId((prev) => ({ ...prev, [meetingId]: map }));
    };
    const optimistic = { ...currentSnapshot };
    if (nextChecked) optimistic[key] = true;
    else delete optimistic[key];
    applyMap(optimistic);
    try {
      if (roomId) {
        const result = await toggleMeetingRoomCheckIn(String(roomId), { meetingId, key, checked: nextChecked });
        applyMap(result.checkInMap || {});
      }
    } catch {
      applyMap(currentSnapshot);
      setCheckInThanksMessage(tk({ it: 'Errore sincronizzazione check-in', en: 'Check-in sync error' }));
      return;
    }
    void Promise.resolve().then(() => reload({ silent: true }));
    setCheckInThanksMessage(nextChecked ? tk({ it: 'Grazie, buona riunione', en: 'Thank you, enjoy the meeting' }) : tk({ it: 'Presenza rimossa', en: 'Check-in removed' }));
    setParticipantOverlayUntil(Date.now() + PARTICIPANT_OVERLAY_AUTO_CLOSE_MS);
  };

  const openSupportMail = async (serviceKey: 'it' | 'cleaning' | 'coffee', label: string, email?: string) => {
    const target = String(email || '').trim();
    if (!target || !roomId) return;
    try {
      await sendMeetingRoomHelpRequest(String(roomId), { service: serviceKey });
      setHelpOverlay({ mode: 'sent', serviceLabel: label });
    } catch {
      setHelpOverlay({ mode: 'sent', serviceLabel: label });
    }
  };

  const inProgress = payload?.inProgress || null;
  const daySchedule = payload?.daySchedule || [];
  const progress = progressOf(inProgress, now);
  const remainingToEndLabel = formatRemainingToEnd(inProgress, now);
  const clientLogoUrl = resolveLogoUrl(String((payload?.room as any)?.clientLogoUrl || '').trim() || '');
  const businessPartnerLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bp of (((payload?.room as any)?.businessPartners || []) as Array<{ name?: string; logoUrl?: string }>)) {
      const name = normalizeCompanyKey(String(bp?.name || ''));
      const logo = resolveLogoUrl(String(bp?.logoUrl || '').trim());
      if (!name || !logo) continue;
      map.set(name, logo);
    }
    return map;
  }, [payload?.room]);

  const participantsOverlayList = useMemo(() => {
    if (!participantMeeting) return [];
    const canCheckInNow = Number(participantMeeting.startAt || 0) <= now && now < Number(participantMeeting.endAt || 0);
    const participants = Array.isArray(participantMeeting.participants) ? participantMeeting.participants : [];
    const internal = participants
      .filter((p: any) => (p?.kind || 'real_user') !== 'manual')
      .map((p: any) => ({
        label: String(p.fullName || p.externalId || '-'),
        sub: p.email ? String(p.email) : null,
        tag: p.optional ? 'OPT' : null,
        email: p?.email ? String(p.email) : null,
        checkKey: buildCheckInKeyFromParticipant({
          kind: 'real_user',
          fullName: p?.fullName,
          externalId: p?.externalId,
          email: p?.email,
          optional: !!p?.optional
        }),
        logoUrl: clientLogoUrl || null,
        remote: !!p?.remote,
        checkinEligible: canCheckInNow && !p?.remote
      }));
    const manualFromParticipants = participants
      .filter((p: any) => p?.kind === 'manual')
      .map((p: any) => ({
        label: String(p?.fullName || p?.externalId || '-'),
        sub: [p?.email ? String(p.email) : null, p?.remote ? 'Remote' : 'On-site'].filter(Boolean).join(' · ') || null,
        email: p?.email ? String(p.email) : null,
        tag: 'EXT',
        checkKey: buildCheckInKeyFromParticipant({
          kind: 'manual',
          fullName: p?.fullName,
          externalId: p?.externalId,
          email: p?.email
        }),
        logoUrl: businessPartnerLogoMap.get(normalizeCompanyKey(String(p?.company || ''))) || null,
        remote: !!p?.remote,
        checkinEligible: canCheckInNow && !p?.remote
      }));
    const existingManualKeys = new Set(manualFromParticipants.map((g) => guestIdentityKey(g)));
    const externalDetailed = (participantMeeting.externalGuestsDetails || [])
      .filter((g: any) => !existingManualKeys.has(guestIdentityKey({ label: String(g?.name || '-'), email: g?.email ? String(g.email) : null })))
      .map((g: any) => ({
        label: String(g?.name || '-'),
        sub: [g?.email ? String(g.email) : null, g?.remote ? 'Remote' : 'On-site'].filter(Boolean).join(' · ') || null,
        email: g?.email ? String(g.email) : null,
        tag: 'EXT',
        checkKey: buildCheckInKeyFromExternalGuest({ name: g?.name, email: g?.email }),
        logoUrl: businessPartnerLogoMap.get(normalizeCompanyKey(String(g?.company || ''))) || null,
        remote: !!g?.remote,
        checkinEligible: canCheckInNow && !g?.remote
      }));
    return [...internal, ...manualFromParticipants, ...externalDetailed];
  }, [businessPartnerLogoMap, clientLogoUrl, now, participantMeeting]);

  const currentMeetingCheckInEntries = useMemo(() => {
    if (!inProgress) return [] as Array<{ label: string; sub?: string | null; tag?: string | null }>;
    const participants = Array.isArray(inProgress.participants) ? inProgress.participants : [];
    const internal = participants
      .filter((p: any) => (p?.kind || 'real_user') !== 'manual')
      .map((p: any) => ({
        label: String(p.fullName || p.externalId || '-'),
        sub: p.email ? String(p.email) : null,
        tag: p.optional ? 'OPT' : null,
        email: p?.email ? String(p.email) : null,
        checkKey: buildCheckInKeyFromParticipant({
          kind: 'real_user',
          fullName: p?.fullName,
          externalId: p?.externalId,
          email: p?.email,
          optional: !!p?.optional
        }),
        remote: !!p?.remote
      }))
      .filter((p) => !p.remote);
    const manualOnSiteFromParticipants = participants
      .filter((p: any) => p?.kind === 'manual' && !p?.remote)
      .map((p: any) => ({
        label: String(p?.fullName || p?.externalId || '-'),
        sub: p?.email ? String(p.email) : null,
        email: p?.email ? String(p.email) : null,
        tag: 'EXT',
        checkKey: buildCheckInKeyFromParticipant({
          kind: 'manual',
          fullName: p?.fullName,
          externalId: p?.externalId,
          email: p?.email
        })
      }));
    const existingManualKeys = new Set(manualOnSiteFromParticipants.map((g) => guestIdentityKey(g)));
    const externalOnSite = (inProgress.externalGuestsDetails || [])
      .filter((g: any) => !g?.remote)
      .filter((g: any) => !existingManualKeys.has(guestIdentityKey({ label: String(g?.name || '-'), email: g?.email ? String(g.email) : null })))
      .map((g: any) => ({
        label: String(g?.name || '-'),
        sub: g?.email ? String(g.email) : null,
        email: g?.email ? String(g.email) : null,
        tag: 'EXT',
        checkKey: buildCheckInKeyFromExternalGuest({ name: g?.name, email: g?.email })
      }));
    return [...internal, ...manualOnSiteFromParticipants, ...externalOnSite];
  }, [inProgress]);

  const currentMeetingCheckInStats = useMemo(() => {
    if (!inProgress) return { total: 0, checked: 0, percent: 0, remoteParticipants: 0 };
    const store = checkInStatusByMeetingId[String(inProgress.id || '')] || {};
    const total = currentMeetingCheckInEntries.length;
    const checked = currentMeetingCheckInEntries.filter((entry) => !!store[participantCheckInKey(entry)]).length;
    const participants = Array.isArray(inProgress.participants) ? inProgress.participants : [];
    const remoteFromParticipants = participants.filter((p: any) => !!p?.remote).length;
    const manualRemoteKeys = new Set(
      participants
        .filter((p: any) => p?.kind === 'manual' && !!p?.remote)
        .map((p: any) => guestIdentityKey({ label: String(p?.fullName || p?.externalId || '-'), email: p?.email ? String(p.email) : null }))
    );
    const remoteLegacyExternal =
      Array.isArray(inProgress.externalGuestsDetails)
        ? inProgress.externalGuestsDetails
            .filter((g: any) => !!g?.remote)
            .filter((g: any) => !manualRemoteKeys.has(guestIdentityKey({ label: String(g?.name || '-'), email: g?.email ? String(g.email) : null })))
            .length
        : 0;
    const remoteParticipants = remoteFromParticipants + remoteLegacyExternal;
    return {
      total,
      checked,
      percent: total > 0 ? Math.round((checked / total) * 100) : 0,
      remoteParticipants
    };
  }, [checkInStatusByMeetingId, currentMeetingCheckInEntries, inProgress]);

  const roomSupportContacts = (payload?.room?.siteSupportContacts || null) as SiteSupportContacts | null;

  const supportContactRows = useMemo(
    () =>
      [
        { key: 'it', label: 'IT Service', Icon: Cpu, value: roomSupportContacts?.it, subject: 'Need IT Service' },
        { key: 'cleaning', label: 'Cleaning service', Icon: Sparkles, value: roomSupportContacts?.cleaning, subject: 'Need Cleaning Service' },
        { key: 'coffee', label: 'Coffee service', Icon: Coffee, value: roomSupportContacts?.coffee, subject: 'Need Coffee Service' }
      ].filter((row) => row.value?.email || row.value?.phone),
    [roomSupportContacts]
  );

  const roomEquipment = equipmentFromRoom(payload?.room?.equipment || []);

  const timelineMeta = useMemo(() => {
    const schedule = daySchedule || [];
    const minFloor = 6 * 60;
    const maxCeil = 23 * 60;
    let minMinute = minFloor;
    let maxMinute = 21 * 60;
    for (const row of schedule) {
      const s = minuteOfDay(Number(row.startAt));
      const e = minuteOfDay(Number(row.endAt));
      minMinute = Math.min(minMinute, Math.floor(s / 60) * 60);
      maxMinute = Math.max(maxMinute, Math.ceil(e / 60) * 60);
    }
    const nowMinute = minuteOfDay(now);
    minMinute = Math.max(0, Math.min(minMinute, Math.floor(nowMinute / 60) * 60 - 60));
    maxMinute = Math.max(maxMinute, Math.ceil(nowMinute / 60) * 60 + 60);
    minMinute = Math.max(minFloor, minMinute);
    maxMinute = Math.min(maxCeil, Math.max(minMinute + 120, maxMinute));
    const hours: number[] = [];
    for (let m = minMinute; m <= maxMinute; m += 60) hours.push(m);
    return { minMinute, maxMinute, nowMinute, hours, total: Math.max(60, maxMinute - minMinute) };
  }, [daySchedule, now]);

  const isNight = theme === 'night';
  const shell = isNight ? 'min-h-screen bg-[#090b12] text-slate-100' : 'min-h-screen bg-slate-100 text-slate-900';
  const panel = isNight ? 'border-slate-800 bg-slate-950/85' : 'border-slate-200 bg-white';
  const card = isNight ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50';
  const soft = isNight ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className={shell}>
      <div className="fixed inset-0 pointer-events-none opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_38%),radial-gradient(circle_at_80%_15%,rgba(168,85,247,0.14),transparent_35%),radial-gradient(circle_at_60%_80%,rgba(16,185,129,0.12),transparent_40%)]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] p-3 sm:p-5">
        <div className={`rounded-3xl border p-3 shadow-card backdrop-blur sm:p-5 ${panel}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] ${soft}`}>
                <span>Plixmap kiosk mode</span>
                <span className={`rounded-full border px-2 py-0.5 normal-case tracking-normal ${isNight ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  v{String((pkg as any)?.version || '')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {clientLogoUrl ? <img src={clientLogoUrl} alt="" className="h-8 w-8 rounded-xl object-cover ring-1 ring-white/20" /> : null}
                <h1 className="truncate text-2xl font-semibold sm:text-3xl">{payload?.room?.roomName || String(roomId || '-')}</h1>
              </div>
              <div className={`mt-1 text-sm ${soft}`}>
                {(payload?.room?.clientName || '-') + ' • ' + (payload?.room?.siteName || '-') + ' • ' + (payload?.room?.floorPlanName || '-')}
              </div>
              <div className={`mt-1 inline-flex items-center gap-2 text-xs ${soft}`}>
                <CalendarDays size={13} />
                {formatDateLong(now)}
                <span className="mx-1">•</span>
                <Clock3 size={13} />
                {formatClock(now)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => reload({ silent: true })}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${isNight ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <RefreshCcw size={15} className={refreshing ? 'animate-spin' : ''} />
                {tk({ it: 'Aggiorna', en: 'Refresh' })}
              </button>
              {supportContactRows.length ? (
                <button
                  onClick={() => setHelpOverlay((prev) => (prev ? null : { mode: 'menu' }))}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                    isNight ? 'border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <LifeBuoy size={15} />
                  {tk({ it: 'Serve aiuto', en: 'Need Help' })}
                </button>
              ) : null}
              <button
                onClick={() => setTheme((prev) => (prev === 'night' ? 'day' : 'night'))}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${isNight ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                {isNight ? <Sun size={15} /> : <Moon size={15} />}
                {isNight ? tk({ it: 'Giorno', en: 'Day' }) : tk({ it: 'Notte', en: 'Night' })}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${soft}`}>
                    {inProgress ? tk({ it: 'Meeting in corso', en: 'Meeting in progress' }) : tk({ it: 'Sala libera', en: 'Room available' })}
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {inProgress ? inProgress.subject || 'Meeting' : tk({ it: 'Nessuna riunione in corso', en: 'No meeting in progress' })}
                  </div>
                  {roomEquipment.length ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {roomEquipment.map(({ label, Icon }) => (
                        <span
                          key={`head-eq-${label}`}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${isNight ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                          title={label}
                        >
                          <Icon size={11} />
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className={`mt-1 text-sm ${soft}`}>
                    {inProgress
                      ? `${formatTime(inProgress.startAt)} - ${formatTime(inProgress.endAt)} · ${inProgress.requestedSeats}/${inProgress.roomCapacity} ${tk({
                          it: 'posti richiesti',
                          en: 'requested seats'
                        })}`
                      : tk({ it: 'La sala è disponibile in questo momento.', en: 'The room is currently available.' })}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className={`mt-4 rounded-xl border border-dashed p-4 text-sm ${isNight ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>{tk({ it: 'Caricamento...', en: 'Loading...' })}</div>
              ) : null}
              {error ? (
                <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1.05fr_0.95fr]">
                <div className={`rounded-2xl border p-4 ${isNight ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white'}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${soft}`}>{tk({ it: 'Progress meeting', en: 'Meeting progress' })}</div>
                  <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-800/60">
                    <div
                      className={`h-full rounded-full transition-all ${inProgress ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400' : 'bg-slate-600'}`}
                      style={{ width: `${inProgress ? progress : 0}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className={soft}>{inProgress ? tk({ it: 'Avanzamento', en: 'Progress' }) : tk({ it: 'Stato', en: 'Status' })}</span>
                    <span className="font-semibold">{inProgress ? `${Math.round(progress)}%` : tk({ it: 'Libera', en: 'Free' })}</span>
                  </div>
                  {inProgress ? (
                    <div className={`mt-1 flex items-center justify-between text-xs ${soft}`}>
                      <span>{tk({ it: 'Tempo rimanente', en: 'Time left' })}</span>
                      <span className="font-semibold tabular-nums">{remainingToEndLabel || '0m'}</span>
                    </div>
                  ) : null}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className={`rounded-xl border px-3 py-2 ${card}`}>
                      <div className={`text-[11px] uppercase tracking-wide ${soft}`}>{tk({ it: 'Capienza sala', en: 'Room capacity' })}</div>
                      <div className="text-lg font-semibold">{payload?.room?.capacity ?? 0}</div>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${card}`}>
                      <div className={`text-[11px] uppercase tracking-wide ${soft}`}>{tk({ it: 'Persone in sala (mappa)', en: 'People in room (map)' })}</div>
                      <div className="text-lg font-semibold">{payload?.room?.currentPeople ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${isNight ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{tk({ it: 'Check-in', en: 'Check-in' })}</div>
                    <div className={`text-xs ${soft}`}>
                      {currentMeetingCheckInStats.checked}/{currentMeetingCheckInStats.total}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-[120px,minmax(0,1fr)] items-center gap-4">
                    <div className="relative mr-auto h-32 w-32">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(#22c55e ${currentMeetingCheckInStats.percent}%, ${isNight ? '#1e293b' : '#cbd5e1'} ${currentMeetingCheckInStats.percent}% 100%)`
                        }}
                      />
                      <div className={`absolute inset-[11px] rounded-full ${isNight ? 'bg-slate-950' : 'bg-white'}`} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-semibold tabular-nums">{currentMeetingCheckInStats.percent}%</div>
                        <div className={`text-[11px] ${soft}`}>{tk({ it: 'check-in', en: 'check-in' })}</div>
                      </div>
                    </div>
                    <div className="flex justify-end pr-1">
                      <div className={`ml-auto w-full max-w-[248px] rounded-xl border px-2.5 py-2.5 ${card}`}>
                        <div className={`text-[11px] uppercase tracking-wide ${soft}`}>{tk({ it: 'Stato check-in', en: 'Check-in status' })}</div>
                        <div className="mt-1 text-sm font-semibold">
                          {currentMeetingCheckInStats.checked}/{currentMeetingCheckInStats.total}
                        </div>
                        <div className={`mt-1 text-xs ${soft}`}>
                          {inProgress
                            ? tk({
                                it: `${currentMeetingCheckInStats.remoteParticipants} partecipanti remoti`,
                                en: `${currentMeetingCheckInStats.remoteParticipants} remote participants`
                              })
                            : tk({
                                it: 'Il check-in sarà disponibile durante il meeting in corso.',
                                en: 'Check-in is available only while a meeting is in progress.'
                              })}
                        </div>
                        {inProgress ? (
                          <button
                            onClick={() => openParticipantsOverlay(inProgress)}
                            className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                              isNight
                                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            <Users size={13} />
                            {tk({ it: 'Check-in', en: 'Check-in' })}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{tk({ it: 'Pianificazione di giornata', en: 'Today schedule' })}</div>
                <div className={`text-xs ${soft}`}>{(daySchedule || []).length} {tk({ it: 'meeting', en: 'meetings' })}</div>
              </div>
              <div className="mt-3 space-y-2">
                {(daySchedule || []).map((meeting) => {
                  const inProg = Number(meeting.startAt) <= now && now < Number(meeting.endAt);
                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => openParticipantsOverlay(meeting)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition hover:brightness-110 ${statusTone(meeting, now)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {clientLogoUrl ? <img src={clientLogoUrl} alt="" className="h-4 w-4 shrink-0 rounded object-cover" /> : null}
                          {(() => {
                            const logos: string[] = [];
                            const seen = new Set<string>();
                            const participants = Array.isArray((meeting as any)?.participants) ? ((meeting as any).participants as any[]) : [];
                            for (const p of participants) {
                              if ((p?.kind || 'real_user') !== 'manual') continue;
                              const logo = businessPartnerLogoMap.get(normalizeCompanyKey(String(p?.company || '')));
                              if (logo && !seen.has(logo)) {
                                seen.add(logo);
                                logos.push(logo);
                              }
                            }
                            const legacy = Array.isArray((meeting as any)?.externalGuestsDetails) ? ((meeting as any).externalGuestsDetails as any[]) : [];
                            for (const g of legacy) {
                              const logo = businessPartnerLogoMap.get(normalizeCompanyKey(String(g?.company || '')));
                              if (logo && !seen.has(logo)) {
                                seen.add(logo);
                                logos.push(logo);
                              }
                            }
                            return logos.slice(0, 3).map((logo, idx) => (
                              <img key={`${meeting.id}-bp-${idx}`} src={logo} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
                            ));
                          })()}
                          <div className="truncate text-sm font-semibold">{meeting.subject || 'Meeting'}</div>
                        </div>
                        {inProg ? <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">LIVE</span> : null}
                      </div>
                      <div className="mt-1 text-xs opacity-90">
                        {formatTime(meeting.startAt)} - {formatTime(meeting.endAt)} • {meeting.requestedSeats}/{meeting.roomCapacity}
                      </div>
                    </button>
                  );
                })}
                {!daySchedule.length ? (
                  <div className={`rounded-xl border border-dashed px-3 py-3 text-sm ${isNight ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                    {tk({ it: 'Nessun meeting oggi.', en: 'No meetings today.' })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`mt-4 rounded-2xl border p-4 ${card}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{tk({ it: 'Timeline sala (oggi)', en: 'Room timeline (today)' })}</div>
              <div className={`text-xs ${soft}`}>{tk({ it: 'La linea verticale indica l’orario attuale', en: 'The vertical line shows the current time' })}</div>
            </div>
            <div className="overflow-x-hidden">
              <div className={`relative min-w-0 rounded-2xl border p-3 ${isNight ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white'}`}>
                <div className="relative h-8">
                  {timelineMeta.hours.map((minute) => {
                    const left = ((minute - timelineMeta.minMinute) / timelineMeta.total) * 100;
                    return (
                      <div key={`hr-${minute}`} className="absolute inset-y-0" style={{ left: `${left}%` }}>
                        <div className={`h-full border-l ${isNight ? 'border-slate-800' : 'border-slate-200'}`} />
                        <div className={`absolute left-1 top-0 text-[11px] font-semibold ${soft}`}>
                          {`${String(Math.floor(minute / 60)).padStart(2, '0')}:00`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`relative mt-2 h-36 rounded-xl ${isNight ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                  {timelineMeta.hours.map((minute) => {
                    const left = ((minute - timelineMeta.minMinute) / timelineMeta.total) * 100;
                    return <div key={`grid-${minute}`} className={`absolute inset-y-0 border-l ${isNight ? 'border-slate-800/80' : 'border-slate-200'}`} style={{ left: `${left}%` }} />;
                  })}

                  {/* current time line */}
                  {timelineMeta.nowMinute >= timelineMeta.minMinute && timelineMeta.nowMinute <= timelineMeta.maxMinute ? (
                    <div
                      className="absolute inset-y-0 z-20"
                      style={{ left: `${((timelineMeta.nowMinute - timelineMeta.minMinute) / timelineMeta.total) * 100}%` }}
                    >
                      <div className="absolute -top-2 -translate-x-1/2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-900 shadow">
                        {tk({ it: 'ORA', en: 'NOW' })}
                      </div>
                      <div className="h-full border-l-2 border-emerald-400/80" />
                    </div>
                  ) : null}

                  {(daySchedule || []).map((meeting, idx) => {
                    const startMin = minuteOfDay(Number(meeting.startAt));
                    const endMin = minuteOfDay(Number(meeting.endAt));
                    const start = Math.max(timelineMeta.minMinute, Math.min(timelineMeta.maxMinute, startMin));
                    const end = Math.max(start + 1, Math.max(timelineMeta.minMinute, Math.min(timelineMeta.maxMinute, endMin)));
                    const left = ((start - timelineMeta.minMinute) / timelineMeta.total) * 100;
                    const width = Math.max(2, ((end - start) / timelineMeta.total) * 100);
                    const top = 10 + (idx % 3) * 38;
                    const inProg = Number(meeting.startAt) <= now && now < Number(meeting.endAt);
                    return (
                      <button
                        key={`tl-${meeting.id}`}
                        type="button"
                        onClick={() => openParticipantsOverlay(meeting)}
                        className={`absolute z-10 overflow-hidden rounded-xl border px-2 py-1 text-left shadow-sm transition hover:brightness-110 ${statusTone(meeting, now)}`}
                        style={{ left: `${left}%`, width: `${width}%`, top, height: 30 }}
                        title={`${meeting.subject} • ${formatTime(meeting.startAt)}-${formatTime(meeting.endAt)}`}
                      >
                        <div className="flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold">
                          {clientLogoUrl ? <img src={clientLogoUrl} alt="" className="h-3 w-3 shrink-0 rounded object-cover" /> : null}
                          {inProg ? <span className="shrink-0">●</span> : null}
                          <span className="truncate">{meeting.subject || 'Meeting'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {participantMeeting ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onWheel={(e) => e.stopPropagation()}>
          <div
            className={`w-full max-w-xl rounded-2xl border p-4 shadow-card ${isNight ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{participantMeeting.subject || 'Meeting'}</div>
                <div className={`text-xs ${soft}`}>
                  {formatTime(participantMeeting.startAt)} - {formatTime(participantMeeting.endAt)} • {participantMeeting.requestedSeats}/{participantMeeting.roomCapacity}
                </div>
              </div>
              <button
                onClick={() => {
                  setParticipantMeeting(null);
                  setParticipantOverlayUntil(null);
                }}
                className={`rounded-lg p-2 ${isNight ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <X size={16} />
              </button>
            </div>
            <div className={`mt-3 rounded-full ${isNight ? 'bg-slate-800' : 'bg-slate-200'} h-1.5 overflow-hidden`}>
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                style={{
                  width: `${participantOverlayUntil ? Math.max(0, Math.min(100, ((participantOverlayUntil - now) / PARTICIPANT_OVERLAY_AUTO_CLOSE_MS) * 100)) : 0}%`
                }}
              />
            </div>
            <div className={`mt-2 text-[11px] ${soft}`}>
              {tk({
                it: 'Check-in: tocca il tuo nome. La finestra si chiude automaticamente dopo 25 secondi (il timer si resetta a ogni check-in).',
                en: 'Check-in: tap your name. This window closes automatically after 25 seconds (timer resets after each check-in).'
              })}
            </div>
            <div className="mt-3 max-h-[40vh] space-y-2 overflow-auto overscroll-y-contain pr-1" style={{ WebkitOverflowScrolling: 'touch' as any }}>
              {participantsOverlayList.length ? (
                participantsOverlayList.map((p, idx) => {
                  const checkedMap = checkInStatusByMeetingId[String(participantMeeting.id || '')] || {};
                  const checked = !!checkedMap[participantCheckInKey(p)];
                  const disabled = !p.checkinEligible;
                  const isRemote = !!(p as any).remote;
                  const statusLabel = isRemote ? 'REMOTE' : disabled ? tk({ it: 'NON ATTIVO', en: 'NOT ACTIVE' }) : checked ? 'OK' : 'CHECK-IN';
                  return (
                    <button
                      key={`${p.label}:${idx}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        markCheckIn(participantMeeting, p);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        checked
                          ? isNight
                            ? 'border-emerald-500/50 bg-emerald-500/20'
                            : 'border-emerald-200 bg-emerald-50'
                          : disabled
                            ? `${card} opacity-70`
                            : `${card} hover:brightness-105`
                      } ${disabled ? 'cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {(p as any).logoUrl ? <img src={String((p as any).logoUrl)} alt="" className="h-5 w-5 shrink-0 rounded object-cover" /> : null}
                          <div className={`truncate text-sm font-semibold ${p.tag === 'EXT' ? 'uppercase tracking-[0.02em]' : ''}`}>{p.label}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {p.tag ? <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-[10px] font-bold">{p.tag}</span> : null}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isRemote
                                ? isNight
                                  ? 'bg-indigo-500/20 text-indigo-200'
                                  : 'bg-indigo-100 text-indigo-700'
                                : checked
                                ? isNight
                                  ? 'bg-emerald-500/20 text-emerald-200'
                                  : 'bg-emerald-100 text-emerald-700'
                                : isNight
                                  ? 'bg-slate-800 text-slate-300'
                                  : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                      {p.sub ? <div className={`mt-1 truncate text-xs ${soft}`}>{p.sub}</div> : null}
                    </button>
                  );
                })
              ) : (
                <div className={`rounded-xl border border-dashed px-3 py-3 text-sm ${isNight ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                  {tk({ it: 'Nessun partecipante registrato per il check-in.', en: 'No participants available for check-in.' })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {checkInThanksMessage ? (
        <div className="fixed inset-x-0 top-4 z-[75] flex justify-center px-4">
          <div className={`rounded-xl border px-4 py-2 text-sm font-semibold shadow-card ${isNight ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {checkInThanksMessage}
          </div>
        </div>
      ) : null}

      {helpOverlay && supportContactRows.length ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-2xl border p-4 shadow-card ${isNight ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{tk({ it: 'Serve aiuto', en: 'Need Help' })}</div>
                <div className={`mt-1 text-xs ${soft}`}>
                  {helpOverlay.mode === 'menu'
                    ? tk({ it: 'Seleziona il tipo di assistenza. Chiusura automatica in 10s.', en: 'Select support type. Auto-close in 10s.' })
                    : helpOverlay.mode === 'phone'
                      ? tk({ it: 'Numero assistenza. Chiusura automatica in 20s.', en: 'Support phone number. Auto-close in 20s.' })
                      : tk({ it: 'Richiesta inviata. Ritorno alla schermata principale...', en: 'Request sent. Returning to main screen...' })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHelpOverlay(null)}
                className={`rounded-lg p-2 ${isNight ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                title={tk({ it: 'Chiudi', en: 'Close' })}
              >
                <X size={16} />
              </button>
            </div>

            {helpOverlay.mode === 'menu' ? (
              <div className="mt-4 space-y-2">
                {supportContactRows.map((row) => (
                  <div key={row.key} className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border px-3 py-3 ${card}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <row.Icon size={15} />
                        <span className="truncate">{row.label}</span>
                      </div>
                      <div className={`mt-1 text-[11px] ${soft}`}>
                        {[row.value?.email || null, row.value?.phone || null].filter(Boolean).join(' • ') || tk({ it: 'Contatto non configurato', en: 'Contact not configured' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!row.value?.email}
                      onClick={() => openSupportMail(row.key as any, row.subject, row.value?.email)}
                      className={`inline-flex h-12 min-w-[110px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
                        row.value?.email
                          ? isNight
                            ? 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                          : 'cursor-not-allowed opacity-40 border-slate-200 bg-slate-100'
                      }`}
                    >
                      <Mail size={16} />
                      {tk({ it: 'Email', en: 'Email' })}
                    </button>
                    <button
                      type="button"
                      disabled={!row.value?.phone}
                      onClick={() => {
                        if (!row.value?.phone) return;
                        setHelpOverlay({ mode: 'phone', serviceLabel: row.label, phone: String(row.value.phone) });
                      }}
                      className={`inline-flex h-12 min-w-[110px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
                        row.value?.phone
                          ? isNight
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'cursor-not-allowed opacity-40 border-slate-200 bg-slate-100'
                      }`}
                    >
                      <PhoneCall size={16} />
                      {tk({ it: 'Telefono', en: 'Phone' })}
                    </button>
                  </div>
                ))}
              </div>
            ) : helpOverlay.mode === 'phone' ? (
              <div className="mt-5 flex flex-col items-center justify-center py-6">
                <div className={`text-sm ${soft}`}>{helpOverlay.serviceLabel}</div>
                <div className="mt-3 text-center font-mono text-3xl font-semibold tracking-wide sm:text-4xl">{helpOverlay.phone}</div>
                <a
                  href={`tel:${encodeURIComponent(helpOverlay.phone)}`}
                  className={`mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold ${isNight ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <PhoneCall size={16} />
                  {tk({ it: 'Chiama', en: 'Call' })}
                </a>
              </div>
            ) : (
              <div className="mt-5 flex min-h-[170px] items-center justify-center">
                <div className={`rounded-2xl border px-6 py-5 text-center ${isNight ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  <div className="text-lg font-semibold">{tk({ it: 'Richiesta inviata', en: 'Request sent' })}</div>
                  <div className="mt-1 text-xs opacity-80">{helpOverlay.serviceLabel}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MeetingRoomDisplayPage;
