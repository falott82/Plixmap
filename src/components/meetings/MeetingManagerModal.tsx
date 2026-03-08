import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Clock3,
  Coffee,
  Eye,
  HelpCircle,
  Mail,
  Minus,
  Monitor,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Snowflake,
  Tv,
  Users,
  Video,
  Wifi,
  Wrench,
  X
} from 'lucide-react';
import type { Client, Site, SiteScheduleDayKey } from '../../store/types';
import { useT } from '../../i18n/useT';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { currentLocalIsoDay } from '../../utils/localDate';
import ClientBusinessPartnersModal from '../layout/ClientBusinessPartnersModal';
import {
  createMeeting,
  fetchMeetingOverview,
  fetchPendingMeetings,
  reviewMeeting,
  type MeetingBooking,
  type MeetingExternalGuest,
  type MeetingParticipant,
  type MeetingRoomOverviewRow
} from '../../api/meetings';
import { listExternalUsers } from '../../api/customImport';
import { fetchUserDirectory, type UserDirectoryRow } from '../../api/usersDirectory';

interface Props {
  open: boolean;
  clients: Client[];
  initialClientId?: string;
  initialSiteId?: string;
  initialFloorPlanId?: string;
  initialRoomId?: string;
  initialDay?: string;
  onClose: () => void;
  onCreated?: () => void;
  onGoToRoom?: (roomId: string) => void;
}

type ExternalParticipant = {
  key: string;
  externalId: string;
  fullName: string;
  email: string;
  department?: string;
  phone?: string;
};

type SelectedParticipant = {
  key: string;
  kind: 'real_user' | 'manual';
  externalId?: string | null;
  fullName: string;
  email?: string | null;
  optional: boolean;
  remote: boolean;
  company?: string | null;
};

type NeedKey = 'projector' | 'tv' | 'videoConf' | 'coffee' | 'whiteboard' | 'guestWifi' | 'fridge';
type KioskMeetingLanguage = 'auto' | 'it' | 'en' | 'ru' | 'ar' | 'zh';

const NEED_CONFIG: Array<{
  key: NeedKey;
  icon: typeof Monitor;
  labels: { it: string; en: string };
  match: string[];
}> = [
  { key: 'projector', icon: Monitor, labels: { it: 'Proiettore', en: 'Projector' }, match: ['projector'] },
  { key: 'tv', icon: Tv, labels: { it: 'TV', en: 'TV' }, match: ['tv'] },
  {
    key: 'videoConf',
    icon: Video,
    labels: { it: 'Sistema di videoconferenza autonomo', en: 'Autonomous video conference' },
    match: ['video conference', 'autonomous video conference']
  },
  { key: 'coffee', icon: Coffee, labels: { it: 'Coffee service', en: 'Coffee service' }, match: ['coffee service'] },
  { key: 'whiteboard', icon: Clipboard, labels: { it: 'Lavagna', en: 'Whiteboard' }, match: ['whiteboard'] },
  { key: 'guestWifi', icon: Wifi, labels: { it: 'Guest Wifi', en: 'Guest Wifi' }, match: ['guest wifi'] },
  { key: 'fridge', icon: Snowflake, labels: { it: 'Frigo', en: 'Fridge' }, match: ['fridge'] }
];

const KIOSK_LANG_OPTIONS: Array<{ key: KioskMeetingLanguage; flag: string; labels: { it: string; en: string } }> = [
  { key: 'auto', flag: '🌐', labels: { it: 'Sistema', en: 'System' } },
  { key: 'it', flag: '🇮🇹', labels: { it: 'Italiano', en: 'Italian' } },
  { key: 'en', flag: '🇬🇧', labels: { it: 'Inglese', en: 'English' } },
  { key: 'ru', flag: '🇷🇺', labels: { it: 'Russo', en: 'Russian' } },
  { key: 'ar', flag: '🇸🇦', labels: { it: 'Arabo', en: 'Arabic' } },
  { key: 'zh', flag: '🇨🇳', labels: { it: 'Cinese', en: 'Chinese' } }
];

const todayIso = () => currentLocalIsoDay();

const defaultStartTime = () => {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes() < 30 ? 30 : 0;
  const hh = m === 30 ? h : h + 1;
  return `${String(Math.min(23, Math.max(8, hh))).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const addMinutesTime = (time: string, delta: number) => {
  const [h, m] = String(time || '09:00')
    .split(':')
    .map((v) => Number(v));
  const base = (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0) + delta;
  const min = Math.max(0, Math.min(23 * 60 + 59, base));
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const formatIsoLocalDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const timeToMinutes = (time: string) => {
  const [h, m] = String(time || '')
    .split(':')
    .map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
};

const normalizeTypedTime = (value: string) => {
  const raw = String(value || '').trim();
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const toLocalTsFromDayAndTime = (day: string, time: string) => {
  const d = String(day || '').trim();
  const t = normalizeTypedTime(time);
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!dayMatch || !t) return null;
  const [hh, mm] = t.split(':').map(Number);
  const y = Number(dayMatch[1]);
  const mo = Number(dayMatch[2]) - 1;
  const da = Number(dayMatch[3]);
  const dt = new Date(y, mo, da, hh, mm, 0, 0);
  const ts = dt.getTime();
  return Number.isFinite(ts) ? ts : null;
};

const siteScheduleDayKeyFromIso = (isoDay: string): SiteScheduleDayKey | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  if (!Number.isFinite(date.getTime())) return null;
  const dayIndex = date.getDay();
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayIndex] || null) as SiteScheduleDayKey | null;
};

const latestSiteScheduleEndTime = (site: Site | null | undefined, isoDay: string): string | null => {
  if (!site?.siteSchedule) return null;
  const holiday = (site.siteSchedule.holidays || []).find((entry) => String(entry?.date || '').trim() === String(isoDay || '').trim());
  if (holiday && holiday.closed !== false) return null;
  const dayKey = siteScheduleDayKeyFromIso(isoDay);
  if (!dayKey) return null;
  const row = site.siteSchedule.weekly?.[dayKey];
  if (!row || row.closed) return null;
  if (Array.isArray(row.slots) && row.slots.length) {
    const last = row.slots[row.slots.length - 1];
    const end = normalizeTypedTime(String(last?.end || '').trim());
    if (end) return end;
  }
  return normalizeTypedTime(String(row.close || '').trim());
};

const normalizeEq = (value: string) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase();

const roomPolygon = (room: any): Array<{ x: number; y: number }> => {
  if (Array.isArray(room?.points) && room.points.length >= 3) {
    return room.points
      .filter((p: any) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
      .map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const width = Number(room?.width || 0);
  const height = Number(room?.height || 0);
  if (width <= 0 || height <= 0) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

const polygonCenter = (points: Array<{ x: number; y: number }>) => {
  if (!Array.isArray(points) || points.length < 3) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, Number(point.x));
    minY = Math.min(minY, Number(point.y));
    maxX = Math.max(maxX, Number(point.x));
    maxY = Math.max(maxY, Number(point.y));
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};

const loadBrowserImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });

const buildMeetingRoomSnapshotPng = async (params: {
  plan: any;
  selectedRoomId: string;
}): Promise<string> => {
  const plan = params.plan;
  const targetRoomId = String(params.selectedRoomId || '');
  if (!plan || !targetRoomId || typeof document === 'undefined') return '';

  const rooms = (plan.rooms || [])
    .map((room: any) => {
      const points = roomPolygon(room);
      return {
        id: String(room?.id || ''),
        name: String(room?.name || ''),
        points,
        center: polygonCenter(points)
      };
    })
    .filter((room: any) => room.id && room.points.length >= 3);
  if (!rooms.length) return '';

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const room of rooms) {
    for (const point of room.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const pad = Math.max(24, Math.min(contentWidth, contentHeight) * 0.06);
  const planWidthRaw = Number((plan as any)?.width || 0);
  const planHeightRaw = Number((plan as any)?.height || 0);
  const hasPlanDims = planWidthRaw > 0 && planHeightRaw > 0;
  const srcX = hasPlanDims ? 0 : minX - pad;
  const srcY = hasPlanDims ? 0 : minY - pad;
  const srcW = hasPlanDims ? planWidthRaw : contentWidth + pad * 2;
  const srcH = hasPlanDims ? planHeightRaw : contentHeight + pad * 2;
  const targetMaxW = 1600;
  const scale = Math.max(0.25, Math.min(2.5, targetMaxW / Math.max(1, srcW)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(400, Math.round(srcW * scale));
  canvas.height = Math.max(260, Math.round(srcH * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const imageUrl = String((plan as any)?.imageUrl || '').trim();
  if (imageUrl) {
    try {
      const img = await loadBrowserImage(imageUrl);
      ctx.drawImage(img, 0, 0, img.naturalWidth || img.width, img.naturalHeight || img.height, 0, 0, canvas.width, canvas.height);
    } catch {
      // Fallback without background image.
    }
  }

  const tx = (x: number) => ((x - srcX) / srcW) * canvas.width;
  const ty = (y: number) => ((y - srcY) / srcH) * canvas.height;

  for (const room of rooms) {
    ctx.beginPath();
    room.points.forEach((p: any, idx: number) => {
      const x = tx(Number(p.x));
      const y = ty(Number(p.y));
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const selected = room.id === targetRoomId;
    ctx.fillStyle = selected ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.08)';
    ctx.strokeStyle = selected ? '#16a34a' : '#64748b';
    ctx.lineWidth = selected ? Math.max(2, Math.round(2 * scale)) : Math.max(1, Math.round(1.2 * scale));
    ctx.fill();
    ctx.stroke();
    if (selected && room.center && room.name) {
      ctx.fillStyle = '#166534';
      ctx.font = `600 ${Math.max(14, Math.round(18 * scale))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name, tx(room.center.x), ty(room.center.y));
    }
  }

  return canvas.toDataURL('image/png');
};

const resolveRoomServices = (equipment: string[]) => {
  const normalized = new Set((equipment || []).map((entry) => normalizeEq(entry)));
  return NEED_CONFIG.filter((need) => need.match.some((label) => normalized.has(normalizeEq(label))));
};

const requiredAsterisk = <span className="ml-0.5 text-rose-600">*</span>;

const MeetingManagerModal = ({
  open,
  clients,
  initialClientId,
  initialSiteId,
  initialRoomId,
  initialDay,
  onClose,
  onCreated
}: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const user = useAuthStore((s) => s.user);
  const isAdmin = !!user?.isAdmin || !!user?.isSuperAdmin;
  const canCreateMeetings = isAdmin || user?.canCreateMeetings !== false;

  const firstClientId = clients[0]?.id || '';
  const [step, setStep] = useState<'browse' | 'details'>('browse');
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [day, setDay] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [multiDay, setMultiDay] = useState(false);
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [endTime, setEndTime] = useState(addMinutesTime(defaultStartTime(), 60));
  const [subject, setSubject] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [videoConferenceLink, setVideoConferenceLink] = useState('');
  const [meetingKioskLanguage, setMeetingKioskLanguage] = useState<KioskMeetingLanguage>('auto');
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [sendEmail, setSendEmail] = useState(false);
  const [technicalSetup, setTechnicalSetup] = useState(false);
  const [technicalEmail, setTechnicalEmail] = useState('');
  const [needs, setNeeds] = useState<Record<NeedKey, boolean>>({
    projector: false,
    tv: false,
    videoConf: false,
    coffee: false,
    whiteboard: false,
    guestWifi: false,
    fridge: false
  });
  const [participantFilter, setParticipantFilter] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<SelectedParticipant[]>([]);
  const [meetingAdminsDirectory, setMeetingAdminsDirectory] = useState<UserDirectoryRow[]>([]);
  const [meetingAdminIds, setMeetingAdminIds] = useState<string[]>([]);
  const [meetingAdminCandidateId, setMeetingAdminCandidateId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualCompanyIsOther, setManualCompanyIsOther] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualOptional, setManualOptional] = useState(false);
  const [manualRemote, setManualRemote] = useState(false);
  const [externalParticipants, setExternalParticipants] = useState<ExternalParticipant[]>([]);
  const [overviewRows, setOverviewRows] = useState<MeetingRoomOverviewRow[]>([]);
  const [pendingRows, setPendingRows] = useState<MeetingBooking[]>([]);
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [businessPartnersModalOpen, setBusinessPartnersModalOpen] = useState(false);
  const [earliestSuggestionsModalOpen, setEarliestSuggestionsModalOpen] = useState(false);
  const [earliestRoomSuggestions, setEarliestRoomSuggestions] = useState<
    Array<{ roomId: string; roomName: string; floorPlanName: string; startAt: number }>
  >([]);
  const [roomPreview, setRoomPreview] = useState<{ roomId: string; floorPlanId: string } | null>(null);
  const previewCloseGuardUntilRef = useRef(0);
  const participantsCloseGuardUntilRef = useRef(0);
  const participantsFilterInputRef = useRef<HTMLInputElement | null>(null);
  const earliestSuggestionsCloseGuardUntilRef = useRef(0);
  const approvalCloseGuardUntilRef = useRef(0);
  const todayMin = useMemo(() => todayIso(), []);
  const closeRoomPreview = () => {
    previewCloseGuardUntilRef.current = Date.now() + 350;
    setRoomPreview(null);
  };
  const closeParticipantsModal = () => {
    participantsCloseGuardUntilRef.current = Date.now() + 350;
    setParticipantsModalOpen(false);
  };
  const closeEarliestSuggestionsModal = () => {
    earliestSuggestionsCloseGuardUntilRef.current = Date.now() + 350;
    setEarliestSuggestionsModalOpen(false);
  };
  const closeApprovalModal = () => {
    approvalCloseGuardUntilRef.current = Date.now() + 350;
    setApprovalModalOpen(false);
  };
  const updateClient = useDataStore((s: any) => s.updateClient);

  const selectedClient = useMemo(() => clients.find((c) => String(c.id) === String(clientId)), [clientId, clients]);
  const canOpenBusinessPartnersDirectory = !!isAdmin || (user as any)?.canManageBusinessPartners === true;
  const selectedClientBusinessPartners = useMemo(
    () =>
      Array.isArray((selectedClient as any)?.businessPartners)
        ? [...((selectedClient as any).businessPartners as Array<{ name?: string }>)].map((bp) => String(bp?.name || '').trim()).filter(Boolean)
        : [],
    [selectedClient]
  );
  const selectedSite = useMemo(
    () => (selectedClient?.sites || []).find((entry) => String(entry.id) === String(siteId)) || null,
    [selectedClient?.sites, siteId]
  );
  const selectedRoom = useMemo(() => overviewRows.find((room) => room.roomId === selectedRoomId) || null, [overviewRows, selectedRoomId]);
  const selectedClientLabel = String(selectedClient?.shortName || selectedClient?.name || '').trim();
  const selectedSiteLabel = String(selectedSite?.name || '').trim();
  const selectedFloorPlanLabel = String(selectedRoom?.floorPlanName || '').trim();
  const dialogTitle = useMemo(() => {
    if (step === 'browse') return 'Meeting rooms';
    const parts = [
      t({ it: 'Meeting room', en: 'Meeting room' }),
      selectedClientLabel,
      selectedSiteLabel,
      selectedFloorPlanLabel
    ].filter(Boolean);
    return parts.join(' - ');
  }, [selectedClientLabel, selectedFloorPlanLabel, selectedSiteLabel, step, t]);
  const dialogTitleClass = dialogTitle.length > 72 ? 'text-lg' : dialogTitle.length > 54 ? 'text-xl' : 'text-2xl';
  const selectedCount = selectedParticipants.length;
  const remoteSelectedCount = selectedParticipants.filter((row) => row.remote).length;
  const onsiteSelectedCount = selectedCount - remoteSelectedCount;
  const internalParticipantCount = selectedParticipants.filter((row) => row.kind === 'real_user').length;
  const remoteInternalParticipantCount = selectedParticipants.filter((row) => row.kind === 'real_user' && row.remote).length;
  const onsiteInternalParticipantCount = internalParticipantCount - remoteInternalParticipantCount;
  const manualGuestCount = selectedParticipants.filter((row) => row.kind === 'manual').length;
  const remoteManualGuestCount = selectedParticipants.filter((row) => row.kind === 'manual' && row.remote).length;
  const onsiteManualGuestCount = manualGuestCount - remoteManualGuestCount;
  const onsiteExternalGuestsCount = 0;
  const onsiteHeadcount = onsiteSelectedCount + onsiteExternalGuestsCount;
  const optionalCount = selectedParticipants.filter((row) => row.optional).length;
  const roomCapacity = Math.max(1, Number(selectedRoom?.capacity || 1));
  const requestedSeats = Math.max(1, onsiteHeadcount);
  const participantsOverCapacity = onsiteHeadcount > roomCapacity;
  const selectedRoomSlotBlocked = !!selectedRoom?.slotConflicts?.length;
  const selectedSlotStartTs = useMemo(() => toLocalTsFromDayAndTime(day, startTime), [day, startTime]);
  const selectedSlotEndTs = useMemo(() => toLocalTsFromDayAndTime(day, endTime), [day, endTime]);
  const selectedSiteMaxEndTime = useMemo(() => latestSiteScheduleEndTime(selectedSite, day), [day, selectedSite]);
  const selectedMeetingDurationMin = useMemo(() => {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    if (s === null || e === null) return 0;
    return Math.max(0, e - s);
  }, [endTime, startTime]);
  const selectedRoomSortedBookings = useMemo(
    () => [...(selectedRoom?.bookings || [])].sort((a, b) => Number(a.startAt) - Number(b.startAt)),
    [selectedRoom?.bookings]
  );
  const setupNeighbors = useMemo(() => {
    if (!selectedRoom || selectedSlotStartTs === null || selectedSlotEndTs === null) {
      return {
        prev: null as MeetingBooking | null,
        next: null as MeetingBooking | null,
        freeBefore: 60,
        freeAfter: 60,
        maxBefore: 60,
        maxAfter: 60
      };
    }
    const prev = [...selectedRoomSortedBookings]
      .filter((b) => Number((b as any).effectiveEndAt ?? b.endAt ?? 0) <= selectedSlotStartTs)
      .sort((a, b) => Number((b as any).effectiveEndAt ?? b.endAt ?? 0) - Number((a as any).effectiveEndAt ?? a.endAt ?? 0))[0] || null;
    const next =
      selectedRoomSortedBookings
        .filter((b) => Number((b as any).effectiveStartAt ?? b.startAt ?? 0) >= selectedSlotEndTs)
        .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0))[0] || null;
    const prevBoundary = prev ? Number((prev as any).effectiveEndAt ?? prev.endAt ?? 0) : null;
    const nextBoundary = next ? Number((next as any).effectiveStartAt ?? next.startAt ?? 0) : null;
    const freeBefore = prevBoundary === null ? 60 : Math.max(0, Math.min(60, Math.floor((selectedSlotStartTs - prevBoundary) / 60000)));
    const freeAfter = nextBoundary === null ? 60 : Math.max(0, Math.min(60, Math.floor((nextBoundary - selectedSlotEndTs) / 60000)));
    const borrowableFromMeeting = Math.max(0, (selectedMeetingDurationMin || 0) - 1);
    const maxBefore = Math.max(0, Math.min(60, freeBefore + borrowableFromMeeting));
    const maxAfter = Math.max(0, Math.min(60, freeAfter + borrowableFromMeeting));
    return { prev, next, freeBefore, freeAfter, maxBefore, maxAfter };
  }, [selectedMeetingDurationMin, selectedRoom, selectedRoomSortedBookings, selectedSlotEndTs, selectedSlotStartTs]);
  const nextMeetingSameDay = useMemo(() => {
    if (!selectedRoom || selectedSlotEndTs === null) return null;
    return (
      selectedRoomSortedBookings
        .filter((b) => Number(b.startAt) > selectedSlotEndTs)
        .sort((a, b) => Number(a.startAt) - Number(b.startAt))[0] || null
    );
  }, [selectedRoom, selectedRoomSortedBookings, selectedSlotEndTs]);
  const timingBarSegments = useMemo(() => {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    const meetingMin = startMin !== null && endMin !== null ? Math.max(0, endMin - startMin) : 0;
    const preMin = Math.max(0, Number(bufferBefore) || 0);
    const postMin = Math.max(0, Number(bufferAfter) || 0);
    const total = Math.max(1, preMin + meetingMin + postMin);
    return {
      preMin,
      meetingMin,
      postMin,
      total,
      prePct: (preMin / total) * 100,
      meetingPct: (meetingMin / total) * 100,
      postPct: (postMin / total) * 100
    };
  }, [bufferAfter, bufferBefore, endTime, startTime]);

  useEffect(() => {
    if (!open || !selectedSiteMaxEndTime) return;
    const normalizedStart = normalizeTypedTime(startTime);
    const normalizedEnd = normalizeTypedTime(endTime);
    if (!normalizedStart || !normalizedEnd) return;
    const defaultEnd = addMinutesTime(normalizedStart, 60);
    if (normalizedEnd !== defaultEnd) return;
    const startMin = timeToMinutes(normalizedStart);
    const defaultEndMin = timeToMinutes(defaultEnd);
    const siteEndMin = timeToMinutes(selectedSiteMaxEndTime);
    if (startMin === null || defaultEndMin === null || siteEndMin === null) return;
    if (siteEndMin > startMin && defaultEndMin > siteEndMin) {
      setEndTime(selectedSiteMaxEndTime);
    }
  }, [endTime, open, selectedSiteMaxEndTime, startTime]);

  const previewData = useMemo(() => {
    if (!roomPreview || !selectedSite) return null;
    const plan = (selectedSite.floorPlans || []).find((entry) => String(entry.id) === String(roomPreview.floorPlanId));
    if (!plan) return null;
    const rooms = (plan.rooms || [])
      .map((room) => {
        const points = roomPolygon(room);
        return {
          id: String(room?.id || ''),
          name: String(room?.name || ''),
          meetingRoom: !!(room as any)?.meetingRoom,
          points,
          center: polygonCenter(points)
        };
      })
      .filter((room) => room.id && room.points.length >= 3);
    if (!rooms.length) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const room of rooms) {
      for (const point of room.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const pad = Math.max(20, Math.min(width, height) * 0.05);
    return {
      clientName: selectedClient?.shortName || selectedClient?.name || '',
      siteName: selectedSite.name || '',
      planName: plan.name || '',
      planImageUrl: String((plan as any)?.imageUrl || ''),
      planWidth: Number((plan as any)?.width || 0) > 0 ? Number((plan as any)?.width || 0) : width + pad * 2,
      planHeight: Number((plan as any)?.height || 0) > 0 ? Number((plan as any)?.height || 0) : height + pad * 2,
      planImageX: Number((plan as any)?.width || 0) > 0 ? 0 : minX - pad,
      planImageY: Number((plan as any)?.height || 0) > 0 ? 0 : minY - pad,
      roomId: roomPreview.roomId,
      rooms,
      viewBox: (() => {
        const imgW = Number((plan as any)?.width || 0);
        const imgH = Number((plan as any)?.height || 0);
        if (imgW > 0 && imgH > 0) return `0 0 ${imgW} ${imgH}`;
        return `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`;
      })()
    };
  }, [roomPreview, selectedClient?.name, selectedClient?.shortName, selectedSite]);

  useEffect(() => {
    if (!open) return;
    setStep('browse');
    const nextDay = String(initialDay || todayIso()).trim() || todayIso();
    setDay(nextDay);
    setEndDate(nextDay);
    const nextStart = defaultStartTime();
    setStartTime(nextStart);
    setEndTime(addMinutesTime(nextStart, 60));
    setBufferBefore(0);
    setBufferAfter(0);
    setParticipantsModalOpen(false);
    setRoomPreview(null);
    setBusinessPartnersModalOpen(false);
    setManualCompany('');
    setManualCompanyIsOther(false);
    setMeetingKioskLanguage('auto');
    const currentUserId = String((user as any)?.id || '').trim();
    setMeetingAdminIds(currentUserId ? [currentUserId] : []);
    setMeetingAdminCandidateId('');
    const nextClient = initialClientId && clients.some((c) => c.id === initialClientId) ? initialClientId : firstClientId;
    setClientId(nextClient);
  }, [clients, firstClientId, initialClientId, initialDay, open, user]);

  useEffect(() => {
    if (!open) return;
    const client = clients.find((c) => c.id === clientId);
    const nextSite = initialSiteId && client?.sites.some((s) => s.id === initialSiteId) ? initialSiteId : client?.sites?.[0]?.id || '';
    setSiteId(nextSite);
  }, [clientId, clients, initialSiteId, open]);

  useEffect(() => {
    if (!open || !clientId) return;
    listExternalUsers({ clientId, includeHidden: false, includeMissing: false, limit: 5000 })
      .then((payload) => {
        const rows = (payload?.rows || []).map((row) => {
          const fullName = `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim() || row.externalId;
          const department =
            String((row as any).dept1 || '').trim() ||
            String((row as any).dept2 || '').trim() ||
            String((row as any).dept3 || '').trim() ||
            '';
          const phone =
            String((row as any).ext1 || '').trim() ||
            String((row as any).mobile || '').trim() ||
            String((row as any).ext2 || '').trim() ||
            String((row as any).ext3 || '').trim() ||
            '';
          return {
            key: `${row.externalId}`,
            externalId: String(row.externalId || ''),
            fullName,
            email: String(row.email || '').trim(),
            department: department || undefined,
            phone: phone || undefined
          };
        });
        setExternalParticipants(rows);
      })
      .catch(() => setExternalParticipants([]));
  }, [clientId, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchUserDirectory()
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload?.users) ? payload.users : [];
        setMeetingAdminsDirectory(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setMeetingAdminsDirectory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const allowed = meetingAdminsDirectory.filter((row) => !meetingAdminIds.includes(String(row.id || '')));
    setMeetingAdminCandidateId((prev) => {
      if (prev && allowed.some((row) => String(row.id) === String(prev))) return prev;
      return allowed[0] ? String(allowed[0].id) : '';
    });
  }, [meetingAdminIds, meetingAdminsDirectory]);

  useEffect(() => {
    if (!open) return;
    if (day < todayMin) setDay(todayMin);
    if (endDate < todayMin) setEndDate(todayMin);
  }, [day, endDate, open, todayMin]);

  useEffect(() => {
    if (!participantsModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (businessPartnersModalOpen) return;
      e.preventDefault();
      e.stopPropagation();
      closeParticipantsModal();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [businessPartnersModalOpen, participantsModalOpen]);

  useEffect(() => {
    if (!participantsModalOpen || businessPartnersModalOpen) return;
    const focusTimer = window.setTimeout(() => {
      participantsFilterInputRef.current?.focus();
      participantsFilterInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [businessPartnersModalOpen, participantsModalOpen]);

  useEffect(() => {
    if (!open) return;
    if (endDate < day) setEndDate(day);
  }, [day, endDate, open]);

  useEffect(() => {
    if (!open) return;
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (startMin === null || endMin === null) return;
    if (startMin >= endMin) {
      setEndTime(addMinutesTime(startTime, 60));
    }
  }, [endTime, open, startTime]);

  const reloadOverview = () => {
    if (!open || !siteId) {
      setOverviewRows([]);
      return;
    }
    setLoadingOverview(true);
    fetchMeetingOverview({
      clientId,
      siteId,
      day,
      startTime,
      endTime,
      setupBufferBeforeMin: bufferBefore,
      setupBufferAfterMin: bufferAfter
    })
      .then((payload) => {
        const rows = payload.rooms || [];
        setOverviewRows(rows);
        if (initialRoomId && rows.some((room) => room.roomId === initialRoomId)) {
          setSelectedRoomId(initialRoomId);
          setStep('details');
          return;
        }
        if (!rows.some((room) => room.roomId === selectedRoomId)) {
          setSelectedRoomId(rows[0]?.roomId || '');
        }
      })
      .catch(() => setOverviewRows([]))
      .finally(() => setLoadingOverview(false));
  };

  const reloadPending = () => {
    if (!open || !isAdmin) {
      setPendingRows([]);
      return;
    }
    setLoadingPending(true);
    fetchPendingMeetings()
      .then((payload) => setPendingRows(payload.pending || []))
      .catch(() => setPendingRows([]))
      .finally(() => setLoadingPending(false));
  };

  useEffect(() => {
    reloadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, siteId, day, startTime, endTime, bufferBefore, bufferAfter]);

  useEffect(() => {
    reloadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAdmin]);

  const filteredParticipants = useMemo(() => {
    const q = participantFilter.trim().toLowerCase();
    if (!q) return externalParticipants;
    return externalParticipants.filter(
      (row) =>
        row.fullName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        String(row.department || '').toLowerCase().includes(q) ||
        String(row.phone || '').toLowerCase().includes(q)
    );
  }, [externalParticipants, participantFilter]);

  const selectedExternalIds = useMemo(() => {
    const out = new Set<string>();
    for (const row of selectedParticipants) {
      if (row.kind !== 'real_user' || !row.externalId) continue;
      out.add(String(row.externalId));
    }
    return out;
  }, [selectedParticipants]);

  const currentUserId = String((user as any)?.id || '').trim();
  const meetingAdminDirectoryById = useMemo(
    () => new Map(meetingAdminsDirectory.map((row) => [String(row.id), row])),
    [meetingAdminsDirectory]
  );
  const selectedMeetingAdmins = useMemo(
    () =>
      meetingAdminIds
        .map((id) => {
          const key = String(id);
          const known = meetingAdminDirectoryById.get(key);
          if (known) return known;
          if (key && key === currentUserId) {
            return {
              id: key,
              username: String((user as any)?.username || ''),
              firstName: String((user as any)?.firstName || ''),
              lastName: String((user as any)?.lastName || '')
            } as UserDirectoryRow;
          }
          return null;
        })
        .filter((row): row is UserDirectoryRow => !!row),
    [currentUserId, meetingAdminDirectoryById, meetingAdminIds, user]
  );
  const availableMeetingAdminCandidates = useMemo(
    () =>
      meetingAdminsDirectory.filter((row) => !meetingAdminIds.includes(String(row.id || ''))),
    [meetingAdminIds, meetingAdminsDirectory]
  );

  const selectedParticipantsByExternalId = useMemo(() => {
    const out = new Map<string, SelectedParticipant>();
    for (const row of selectedParticipants) {
      if (row.kind !== 'real_user' || !row.externalId) continue;
      out.set(String(row.externalId), row);
    }
    return out;
  }, [selectedParticipants]);

  const orderedFilteredParticipants = useMemo(() => {
    const selectedRows: ExternalParticipant[] = [];
    const availableRows: ExternalParticipant[] = [];
    for (const row of filteredParticipants) {
      if (selectedExternalIds.has(row.externalId)) selectedRows.push(row);
      else availableRows.push(row);
    }
    return { selectedRows, availableRows, allRows: [...selectedRows, ...availableRows] };
  }, [filteredParticipants, selectedExternalIds]);

  const participantMeetingConflictsByExternalId = useMemo(() => {
    const out = new Map<
      string,
      Array<{ meetingId: string; subject: string; roomName: string; startAt: number; endAt: number; status: string }>
    >();
    if (selectedSlotStartTs === null || selectedSlotEndTs === null || selectedSlotEndTs <= selectedSlotStartTs) return out;
    for (const room of overviewRows) {
      for (const booking of room.bookings || []) {
        if (booking.status === 'cancelled' || booking.status === 'rejected') continue;
        const bs = Number(booking.startAt || 0);
        const be = Number(booking.endAt || 0);
        if (!(bs < selectedSlotEndTs && be > selectedSlotStartTs)) continue;
        for (const participant of Array.isArray(booking.participants) ? booking.participants : []) {
          if (participant?.kind !== 'real_user' || !participant.externalId) continue;
          const key = String(participant.externalId);
          const current = out.get(key) || [];
          current.push({
            meetingId: String(booking.id || ''),
            subject: String(booking.subject || 'Meeting'),
            roomName: String(booking.roomName || room.roomName || '-'),
            startAt: bs,
            endAt: be,
            status: String(booking.status || '')
          });
          out.set(key, current);
        }
      }
    }
    for (const [key, rows] of out.entries()) {
      rows.sort((a, b) => a.startAt - b.startAt);
      const dedup = rows.filter((row, idx) => idx === 0 || !(row.meetingId && row.meetingId === rows[idx - 1].meetingId));
      out.set(key, dedup);
    }
    return out;
  }, [overviewRows, selectedSlotEndTs, selectedSlotStartTs]);

  const formatParticipantConflictLabel = (externalId: string) => {
    const conflicts = participantMeetingConflictsByExternalId.get(String(externalId || '')) || [];
    const first = conflicts[0];
    if (!first) return '';
    const range = `${new Date(first.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(first.endAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    const more = conflicts.length > 1 ? ` (+${conflicts.length - 1})` : '';
    return t({
      it: `Impegnato: ${first.subject} • ${first.roomName} • ${range}${more}`,
      en: `Busy: ${first.subject} • ${first.roomName} • ${range}${more}`
    });
  };

  const requiredNeeds = useMemo(() => NEED_CONFIG.filter((def) => needs[def.key]), [needs]);
  const roomsWithAvailability = useMemo(() => {
    return overviewRows.map((room) => {
      const normalized = new Set((room.equipment || []).map((entry) => normalizeEq(entry)));
      const missingNeeds = requiredNeeds.filter((need) => !need.match.some((label) => normalized.has(normalizeEq(label))));
      const slotBlocked = room.slotConflicts.length > 0;
      const selectable = !slotBlocked && missingNeeds.length === 0;
      return {
        room,
        missingNeeds,
        slotBlocked,
        selectable
      };
    });
  }, [overviewRows, requiredNeeds]);

  const selectableRoomsCount = roomsWithAvailability.filter((entry) => entry.selectable).length;

  useEffect(() => {
    setBufferBefore((prev) => Math.min(prev, setupNeighbors.maxBefore));
  }, [setupNeighbors.maxBefore]);
  useEffect(() => {
    setBufferAfter((prev) => Math.min(prev, setupNeighbors.maxAfter));
  }, [setupNeighbors.maxAfter]);

  const toggleNeed = (key: NeedKey) => {
    setNeeds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyBufferBefore = (nextRaw: number) => {
    const desired = Math.max(0, Math.min(setupNeighbors.maxBefore, Number(nextRaw) || 0));
    const overflow = Math.max(0, desired - Math.max(0, Number((setupNeighbors as any).freeBefore) || 0));
    if (overflow > 0 && selectedMeetingDurationMin > 1) {
      const borrow = Math.min(overflow, Math.max(0, selectedMeetingDurationMin - 1));
      if (borrow > 0) setStartTime((prev) => addMinutesTime(prev, borrow));
      setBufferBefore(desired);
      return;
    }
    setBufferBefore(desired);
  };

  const applyBufferAfter = (nextRaw: number) => {
    const desired = Math.max(0, Math.min(setupNeighbors.maxAfter, Number(nextRaw) || 0));
    const overflow = Math.max(0, desired - Math.max(0, Number((setupNeighbors as any).freeAfter) || 0));
    if (overflow > 0 && selectedMeetingDurationMin > 1) {
      const borrow = Math.min(overflow, Math.max(0, selectedMeetingDurationMin - 1));
      if (borrow > 0) setEndTime((prev) => addMinutesTime(prev, -borrow));
      setBufferAfter(desired);
      return;
    }
    setBufferAfter(desired);
  };

  const upsertExternalParticipant = (row: ExternalParticipant) => {
    setSelectedParticipants((prev) => {
      const idx = prev.findIndex((entry) => entry.kind === 'real_user' && String(entry.externalId || '') === row.externalId);
      if (idx >= 0) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      return [
        ...prev,
        {
          key: `real:${row.externalId}`,
          kind: 'real_user',
          externalId: row.externalId,
          fullName: row.fullName,
          email: row.email || null,
          optional: false,
          remote: false,
          company: null
        }
      ];
    });
  };

  const addEntireDepartment = (department: string) => {
    const dept = String(department || '').trim();
    if (!dept) return;
    const rows = filteredParticipants.filter((row) => String(row.department || '').trim().toLocaleLowerCase() === dept.toLocaleLowerCase());
    if (!rows.length) return;
    setSelectedParticipants((prev) => {
      const existing = new Set(
        prev.filter((p) => p.kind === 'real_user' && p.externalId).map((p) => String(p.externalId))
      );
      const toAdd = rows
        .filter((row) => !existing.has(row.externalId))
        .map((row) => ({
          key: `real:${row.externalId}`,
          kind: 'real_user' as const,
          externalId: row.externalId,
          fullName: row.fullName,
          email: row.email || null,
          optional: false,
          remote: false,
          company: null
        }));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
    push(
      t({ it: `Reparto aggiunto: ${dept}`, en: `Department added: ${dept}` }),
      'success'
    );
  };

  const toggleParticipantOptional = (key: string) => {
    setSelectedParticipants((prev) => prev.map((row) => (row.key === key ? { ...row, optional: !row.optional } : row)));
  };

  const toggleParticipantRemote = (key: string) => {
    setSelectedParticipants((prev) => prev.map((row) => (row.key === key ? { ...row, remote: !row.remote } : row)));
  };

  const removeParticipant = (key: string) => {
    setSelectedParticipants((prev) => prev.filter((row) => row.key !== key));
  };

  const addMeetingAdmin = (userId: string) => {
    const nextId = String(userId || '').trim();
    if (!nextId) return;
    setMeetingAdminIds((prev) => {
      if (prev.includes(nextId)) return prev;
      return [...prev, nextId];
    });
  };

  const removeMeetingAdmin = (userId: string) => {
    const targetId = String(userId || '').trim();
    if (!targetId) return;
    if (targetId === currentUserId) return;
    setMeetingAdminIds((prev) => prev.filter((id) => String(id) !== targetId));
  };

  const addManualParticipant = () => {
    const fullName = String(manualName || '').trim();
    const company = String(manualCompany || '').trim();
    const email = String(manualEmail || '').trim().toLowerCase();
    if (!fullName) return;
    const key = `manual:${fullName.toLocaleLowerCase()}:${email || '-'}:${Date.now()}`;
    setSelectedParticipants((prev) => [
      ...prev,
      { key, kind: 'manual', fullName, email: email || null, optional: !!manualOptional, remote: !!manualRemote, company: company || null }
    ]);
    setManualName('');
    setManualCompany('');
    setManualCompanyIsOther(false);
    setManualEmail('');
    setManualOptional(false);
    setManualRemote(false);
  };

  const openDetailsForRoom = (roomId: string) => {
    const candidate = roomsWithAvailability.find((entry) => entry.room.roomId === roomId);
    if (!candidate || !candidate.selectable) return;
    setSelectedRoomId(roomId);
    setStep('details');
  };

  const applySuggestedRoomStart = (roomId: string, startAtTs: number) => {
    const d = new Date(Number(startAtTs));
    if (!Number.isFinite(d.getTime())) return;
    const nextDayIso = formatIsoLocalDay(d);
    const nextStart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const keepDurationMin = Math.max(1, selectedMeetingDurationMin || 60);
    setDay(nextDayIso);
    if (!multiDay) setEndDate(nextDayIso);
    setStartTime(nextStart);
    setEndTime(addMinutesTime(nextStart, keepDurationMin));
    setSelectedRoomId(roomId);
    setStep('details');
    closeEarliestSuggestionsModal();
  };

  const setEarliestPossibleTime = async () => {
    const buildRoomSuggestionsForRows = (rows: typeof overviewRows, baseCandidateTs: number) => {
      const compatibleRows = rows.filter((room) => {
        const normalized = new Set((room.equipment || []).map((entry) => normalizeEq(entry)));
        return requiredNeeds.every((need) => need.match.some((label) => normalized.has(normalizeEq(label))));
      });
      return compatibleRows
        .map((room) => {
          let roomCandidate = baseCandidateTs;
          const sorted = [...(room.bookings || [])].sort(
            (a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0)
          );
          for (const b of sorted) {
            const bs = Number((b as any).effectiveStartAt ?? b.startAt ?? 0);
            const be = Number((b as any).effectiveEndAt ?? b.endAt ?? 0);
            if (roomCandidate < bs) break;
            if (roomCandidate >= bs && roomCandidate < be) roomCandidate = be;
          }
          return {
            roomId: String(room.roomId || ''),
            roomName: String(room.roomName || '-'),
            floorPlanName: String(room.floorPlanName || ''),
            startAt: Number(roomCandidate)
          };
        })
        .filter((row) => !!row.roomId)
        .sort((a, b) => a.startAt - b.startAt || a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' }));
    };

    const findSingleRoomEarliestForRows = (rows: typeof overviewRows, roomId: string, baseCandidateTs: number) => {
      let roomCandidate = baseCandidateTs;
      const sorted = [...rows]
        .filter((r) => r.roomId === roomId)
        .flatMap((r) => r.bookings || [])
        .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0));
      for (const b of sorted) {
        const bs = Number((b as any).effectiveStartAt ?? b.startAt ?? 0);
        const be = Number((b as any).effectiveEndAt ?? b.endAt ?? 0);
        if (roomCandidate < bs) break;
        if (roomCandidate >= bs && roomCandidate < be) roomCandidate = be;
      }
      return roomCandidate;
    };

    const now = new Date();
    const selectedDayTs = toLocalTsFromDayAndTime(day, '00:00');
    if (selectedDayTs === null) return;
    const selectedDate = new Date(selectedDayTs);
    let candidate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0).getTime();
    const today = new Date();
    if (
      selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getDate() === today.getDate()
    ) {
      candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), now.getHours(), now.getMinutes(), 0, 0).getTime();
    }

    const searchMaxDays = 14;
    for (let dayOffset = 0; dayOffset < searchMaxDays; dayOffset++) {
      const baseDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + dayOffset, 0, 0, 0, 0);
      const searchDay = formatIsoLocalDay(baseDate);
      const baseCandidateTs =
        dayOffset === 0 ? candidate : new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0).getTime();
      let rowsForDay = overviewRows;
      if (dayOffset > 0) {
        if (!clientId || !siteId) break;
        try {
          const payload = await fetchMeetingOverview({ clientId, siteId, day: searchDay });
          rowsForDay = Array.isArray(payload.rooms) ? payload.rooms : [];
        } catch {
          rowsForDay = [];
        }
      }

      const suggestions = buildRoomSuggestionsForRows(rowsForDay, baseCandidateTs);
      if (!suggestions.length) continue;
      if (step === 'browse') {
        const firstTs = suggestions[0]?.startAt;
        if (!Number.isFinite(firstTs)) continue;
        const sameTime = suggestions.filter((s) => s.startAt === firstTs);
        setEarliestRoomSuggestions(sameTime);
        setEarliestSuggestionsModalOpen(true);
        return;
      }
      if (!selectedRoomId) return;
      const preferredRoom = suggestions.find((row) => String(row.roomId) === String(selectedRoomId));
      const firstTs = Number(suggestions[0]?.startAt || 0);
      const preferredTs = Number(preferredRoom?.startAt || 0);
      const shouldRequireChoice =
        !preferredRoom ||
        !Number.isFinite(preferredTs) ||
        !Number.isFinite(firstTs) ||
        preferredTs > firstTs;
      if (shouldRequireChoice) {
        setEarliestRoomSuggestions(suggestions.slice(0, 8));
        setEarliestSuggestionsModalOpen(true);
        return;
      }
      const nextCandidate = findSingleRoomEarliestForRows(rowsForDay, selectedRoomId, baseCandidateTs);
      if (!Number.isFinite(nextCandidate)) continue;
      const d = new Date(nextCandidate);
      const nextDayIso = formatIsoLocalDay(d);
      const nextStart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      setDay(nextDayIso);
      if (!multiDay) setEndDate(nextDayIso);
      setStartTime(nextStart);
      setEndTime((prev) => {
        const normalizedPrev = normalizeTypedTime(prev) || addMinutesTime(nextStart, 60);
        const prevMin = timeToMinutes(normalizedPrev);
        const nextMin = timeToMinutes(nextStart);
        if (prevMin === null || nextMin === null || prevMin <= nextMin) return addMinutesTime(nextStart, 60);
        return normalizedPrev;
      });
      return;
    }

    if (step === 'browse') {
      push(
        t({
          it: 'Nessuna saletta compatibile con le dotazioni richieste nei prossimi giorni. Rimuovi qualche filtro e riprova.',
          en: 'No compatible room found in the next days. Remove some filters and try again.'
        }),
        'danger'
      );
    }
  };

  const applyDurationPreset = (minutes: number) => {
    const normalizedStart = normalizeTypedTime(startTime);
    if (!normalizedStart) return;
    setEndTime(addMinutesTime(normalizedStart, Math.max(1, minutes)));
  };

  const setMaxPossibleEndTime = () => {
    const startTs = toLocalTsFromDayAndTime(day, startTime);
    if (startTs === null) return;
    const siteLimitTs = selectedSiteMaxEndTime ? toLocalTsFromDayAndTime(day, selectedSiteMaxEndTime) : null;
    const sorted = [...overviewRows]
      .filter((r) => r.roomId === selectedRoomId)
      .flatMap((r) => r.bookings || [])
      .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0));
    const nextBlocked = sorted.find((b) => Number((b as any).effectiveStartAt ?? b.startAt ?? 0) > startTs);
    const siteEndCandidate = siteLimitTs !== null && siteLimitTs > startTs ? selectedSiteMaxEndTime : null;
    if (nextBlocked) {
      const next = new Date(Number((nextBlocked as any).effectiveStartAt ?? nextBlocked.startAt ?? 0));
      const nextDayIso = formatIsoLocalDay(next);
      if (nextDayIso === day) {
        const nextBlockedHm = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
        const nextBlockedMin = timeToMinutes(nextBlockedHm);
        const siteEndMin = siteEndCandidate ? timeToMinutes(siteEndCandidate) : null;
        if (siteEndCandidate && siteEndMin !== null && nextBlockedMin !== null) {
          setEndTime(siteEndMin <= nextBlockedMin ? siteEndCandidate : nextBlockedHm);
          return;
        }
        setEndTime(siteEndCandidate || nextBlockedHm);
        return;
      }
      setEndTime(siteEndCandidate || '23:59');
      return;
    }
    setEndTime(siteEndCandidate || '23:59');
  };

  const setEndTimeBeyondSiteHours = () => {
    setEndTime('23:59');
  };

  const submitMeeting = async () => {
    if (!clientId || !siteId || !selectedRoomId || !subject.trim()) {
      push(t({ it: 'Compila i campi obbligatori.', en: 'Fill required fields.' }), 'danger');
      return;
    }
    if (selectedRoomSlotBlocked) {
      push(t({ it: 'Slot non disponibile per questa sala.', en: 'Selected slot is not available for this room.' }), 'danger');
      return;
    }
    const participants: MeetingParticipant[] = selectedParticipants.map((row) => ({
      kind: row.kind,
      externalId: row.kind === 'real_user' ? row.externalId || null : null,
      fullName: row.fullName,
      email: row.email || null,
      optional: !!row.optional,
      remote: !!row.remote,
      company: row.company || null
    }));
    const manualGuestsFromParticipants: MeetingExternalGuest[] = selectedParticipants
      .filter((row) => row.kind === 'manual')
      .map((row) => ({
        name: row.fullName,
        email: row.email || null,
        sendEmail: !!sendEmail && !!row.email,
        remote: !!row.remote
      }));
    const externalGuestsDetails: MeetingExternalGuest[] = manualGuestsFromParticipants;
    let roomSnapshotPngDataUrl = '';
    try {
      const plan = (selectedSite?.floorPlans || []).find((entry) => String(entry.id) === String(selectedRoom?.floorPlanId || ''));
      if (plan && selectedRoomId) {
        roomSnapshotPngDataUrl = await buildMeetingRoomSnapshotPng({ plan, selectedRoomId });
      }
    } catch {
      roomSnapshotPngDataUrl = '';
    }
    setSubmitting(true);
    try {
      const result = await createMeeting({
        clientId,
        siteId,
        floorPlanId: selectedRoom?.floorPlanId || undefined,
        roomId: selectedRoomId,
        subject: subject.trim(),
        notes: meetingNotes.trim(),
        videoConferenceLink: videoConferenceLink.trim(),
        kioskLanguage: meetingKioskLanguage,
        requestedSeats,
        startDate: day,
        endDate: multiDay ? endDate : day,
        startTime,
        endTime,
        setupBufferBeforeMin: bufferBefore,
        setupBufferAfterMin: bufferAfter,
        participants,
        meetingAdminIds: meetingAdminIds.length ? meetingAdminIds : currentUserId ? [currentUserId] : undefined,
        externalGuests: externalGuestsDetails.length > 0,
        externalGuestsList: externalGuestsDetails.length > 0
          ? externalGuestsDetails
              .filter((row) => row.sendEmail && row.email)
              .map((row) => String(row.email || '').trim().toLowerCase())
          : [],
        externalGuestsDetails,
        sendEmail,
        technicalSetup,
        technicalEmail: technicalSetup ? technicalEmail.trim().toLowerCase() : '',
        roomSnapshotPngDataUrl
      });
      push(
        result.approvalRequired
          ? t({ it: '✓ Richiesta meeting inviata agli amministratori.', en: '✓ Meeting request sent to administrators.' })
          : t({ it: '✓ Meeting creato correttamente.', en: '✓ Meeting created successfully.' }),
        'success'
      );
      if (Array.isArray((result as any)?.warnings)) {
        for (const warning of (result as any).warnings) push(String(warning), 'info');
      }
      setSubject('');
      setMeetingNotes('');
      setVideoConferenceLink('');
      setMeetingKioskLanguage('auto');
      setSelectedParticipants([]);
      setParticipantFilter('');
      onCreated?.();
      onClose();
    } catch (error: any) {
      if (Array.isArray(error?.missingEmails) && error.missingEmails.length) {
        push(
          t({
            it: `Email mancanti per: ${error.missingEmails.join(', ')} · ${selectedClient?.shortName || selectedClient?.name || '-'} -> ${selectedSite?.name || '-'} -> ${selectedRoom?.floorPlanName || '-'}`,
            en: `Missing emails for: ${error.missingEmails.join(', ')} · ${selectedClient?.shortName || selectedClient?.name || '-'} -> ${selectedSite?.name || '-'} -> ${selectedRoom?.floorPlanName || '-'}`
          }),
          'danger'
        );
      } else if (Array.isArray(error?.conflictsByDay) && error.conflictsByDay.length) {
        push(t({ it: 'Slot non disponibile: ci sono sovrapposizioni.', en: 'Slot not available: overlaps detected.' }), 'danger');
      } else {
        push(t({ it: 'Errore creazione meeting.', en: 'Failed to create meeting.' }), 'danger');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const doReview = async (row: MeetingBooking, action: 'approve' | 'reject') => {
    const reason = String(rejectReasonById[row.id] || '').trim();
    if (action === 'reject' && !reason) {
      push(t({ it: 'Inserisci una motivazione per il rifiuto.', en: 'Provide a rejection reason.' }), 'danger');
      return;
    }
    try {
      await reviewMeeting(row.id, { action, reason: action === 'reject' ? reason : undefined });
      push(
        action === 'approve'
          ? t({ it: 'Meeting approvato.', en: 'Meeting approved.' })
          : t({ it: 'Meeting rifiutato.', en: 'Meeting rejected.' }),
        action === 'approve' ? 'success' : 'info'
      );
      reloadPending();
      reloadOverview();
    } catch {
      push(t({ it: 'Errore durante la revisione.', en: 'Failed to review meeting.' }), 'danger');
    }
  };

  const cannotSubmit =
    submitting ||
    !selectedRoom ||
    selectedRoomSlotBlocked ||
    !subject.trim();

  const cannotSubmitReason = useMemo(() => {
    if (submitting) return t({ it: 'Creazione meeting in corso.', en: 'Meeting creation in progress.' });
    if (!selectedRoom) return t({ it: 'Seleziona una meeting room.', en: 'Select a meeting room.' });
    if (!subject.trim()) return t({ it: 'Inserisci l’oggetto meeting.', en: 'Enter a meeting subject.' });
    if (!normalizeTypedTime(startTime) || !normalizeTypedTime(endTime)) return t({ it: 'Orario non valido (usa HH:MM).', en: 'Invalid time (use HH:MM).' });
    if (selectedRoomSlotBlocked) return t({ it: 'Slot bloccato da meeting presenti o in approvazione.', en: 'Slot blocked by existing or pending meetings.' });
    return null;
  }, [endTime, selectedRoom, selectedRoomSlotBlocked, startTime, subject, submitting, t]);

  const participantsOverlay = (
    <Transition show={participantsModalOpen && open} as={Fragment}>
      <div
        className="fixed inset-0 z-[92] pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={t({ it: 'Seleziona partecipanti', en: 'Select participants' })}
      >
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div
            className="pointer-events-auto fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (businessPartnersModalOpen) return;
              closeParticipantsModal();
            }}
          />
        </Transition.Child>
        <div
          className="pointer-events-auto fixed inset-0 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <div
                className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{t({ it: 'Seleziona partecipanti', en: 'Select participants' })}</h2>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Aggiungi utenti reali o partecipanti manuali. Premi OK per tornare alla configurazione meeting.',
                        en: 'Add real users or manual participants. Press OK to return to meeting configuration.'
                      })}
                    </div>
                  </div>
                  <button onClick={closeParticipantsModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Users size={15} />
                      {t({ it: 'Partecipanti', en: 'Participants' })}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${participantsOverCapacity ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {selectedCount}/{roomCapacity}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {t({ it: `${optionalCount} facoltativi • ${remoteSelectedCount} remoti`, en: `${optionalCount} optional • ${remoteSelectedCount} remote` })}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
                    <HelpCircle size={13} className="text-slate-400" />
                    <span>
                      {t({
                        it: 'Colonne: nome, email, reparto, interno/cellulare. Tasto destro sul reparto per aggiungere tutto il reparto visibile nel filtro.',
                        en: 'Columns: name, email, department, extension/mobile. Right-click a department to add the whole department currently visible in the filter.'
                      })}
                    </span>
                  </div>
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      ref={participantsFilterInputRef}
                      value={participantFilter}
                      onChange={(e) => setParticipantFilter(e.target.value)}
                      placeholder={t({ it: 'Filtra utenti reali...', en: 'Filter real users...' })}
                      className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
                    />
                  </div>
                  <div className="mt-2 max-h-[34vh] space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
                    {orderedFilteredParticipants.allRows.map((row, index) => {
                      const selected = selectedExternalIds.has(row.externalId);
                      const selectedRow = selectedParticipantsByExternalId.get(row.externalId);
                      const conflictLabel = formatParticipantConflictLabel(String(row.externalId || ''));
                      const startsAvailableSection =
                        orderedFilteredParticipants.selectedRows.length > 0 && index === orderedFilteredParticipants.selectedRows.length;
                      return (
                        <Fragment key={row.key}>
                          {startsAvailableSection ? (
                            <div className="my-1 border-t border-dashed border-slate-300 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {t({ it: 'Disponibili', en: 'Available' })}
                            </div>
                          ) : null}
                          {index === 0 && orderedFilteredParticipants.selectedRows.length > 0 ? (
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              {t({ it: 'Selezionati', en: 'Selected' })}
                            </div>
                          ) : null}
                          <div className="grid grid-cols-[auto,minmax(0,1.1fr),minmax(0,220px),minmax(0,180px),minmax(0,140px),auto] items-center gap-2 text-sm">
                            <button
                              type="button"
                              onClick={() => upsertExternalParticipant(row)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200'
                                  : 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              }`}
                              title={selected ? t({ it: 'Rimuovi', en: 'Remove' }) : t({ it: 'Aggiungi', en: 'Add' })}
                            >
                              {selected ? <Minus size={13} /> : <Plus size={13} />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-slate-700">{row.fullName}</span>
                                {conflictLabel ? (
                                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                    <AlertTriangle size={11} />
                                    {t({ it: 'Occupato', en: 'Busy' })}
                                  </span>
                                ) : null}
                              </div>
                              {conflictLabel ? <div className="mt-0.5 truncate text-[10px] text-amber-700">{conflictLabel}</div> : null}
                            </div>
                            <span className="truncate text-xs text-slate-500">{row.email || 'no email'}</span>
                            <button
                              type="button"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (row.department) addEntireDepartment(row.department);
                              }}
                              className={`truncate text-left text-xs ${row.department ? 'text-slate-600 hover:text-primary' : 'text-slate-400'}`}
                              title={
                                row.department
                                  ? t({ it: 'Tasto destro: aggiungi tutto il reparto', en: 'Right click: add whole department' })
                                  : undefined
                              }
                            >
                              {row.department || '—'}
                            </button>
                            <span className="truncate text-xs text-slate-500">{row.phone || '—'}</span>
                            {selected ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleParticipantOptional(String(selectedRow?.key || `real:${row.externalId}`))}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selectedRow?.optional ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                                >
                                  {t({ it: 'Facoltativo', en: 'Optional' })}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleParticipantRemote(String(selectedRow?.key || `real:${row.externalId}`))}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selectedRow?.remote ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}
                                >
                                  {t({ it: 'Remoto', en: 'Remote' })}
                                </button>
                              </div>
                            ) : <span />}
                          </div>
                        </Fragment>
                      );
                    })}
                    {!filteredParticipants.length ? <div className="text-xs text-slate-500">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div> : null}
                  </div>
                  <div className={`mt-3 grid grid-cols-1 gap-2 ${manualCompanyIsOther ? 'lg:grid-cols-[1fr,1fr,1fr,auto,auto,auto]' : 'lg:grid-cols-[1fr,1fr,1fr,auto,auto,auto]'}`}>
                    <input
                      type="text"
                      autoComplete="off"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={t({ it: 'Altri ospiti', en: 'Other guests' })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={
                          manualCompanyIsOther
                            ? '__OTHER__'
                            : selectedClientBusinessPartners.includes(String(manualCompany || '').trim())
                              ? String(manualCompany || '').trim()
                              : ''
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__OTHER__') {
                            setManualCompanyIsOther(true);
                            setManualCompany('');
                            return;
                          }
                          setManualCompanyIsOther(false);
                          setManualCompany(value);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">{t({ it: 'Azienda (opzionale)', en: 'Company (optional)' })}</option>
                        {selectedClientBusinessPartners.map((name) => (
                          <option key={`bp-opt-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value="__OTHER__">{t({ it: 'Altro', en: 'Other' })}</option>
                      </select>
                      {canOpenBusinessPartnersDirectory ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setBusinessPartnersModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Apri rubrica Business Partner', en: 'Open Business Partner directory' })}
                        >
                          <Building2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <input
                      type="text"
                      autoComplete="off"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={t({ it: 'Email (opzionale)', en: 'Email (optional)' })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={manualOptional} onChange={(e) => setManualOptional(e.target.checked)} />
                      {t({ it: 'Facoltativo', en: 'Optional' })}
                    </label>
                    <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={manualRemote} onChange={(e) => setManualRemote(e.target.checked)} />
                      {t({ it: 'Remoto', en: 'Remote' })}
                    </label>
                    <button
                      type="button"
                      onClick={addManualParticipant}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Aggiungi', en: 'Add' })}
                    </button>
                    {manualCompanyIsOther ? (
                      <input
                        type="text"
                        autoComplete="off"
                        value={manualCompany}
                        onChange={(e) => setManualCompany(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder={t({ it: 'Nome azienda (Altro)', en: 'Company name (Other)' })}
                        className="lg:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                            {selectedParticipants.length ? (
                              selectedParticipants.map((row) => (
                                <span
                                  key={row.key}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                            row.kind === 'manual'
                              ? 'border-violet-200 bg-violet-50 text-violet-800'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span className="max-w-[220px] truncate uppercase tracking-[0.02em]">{row.fullName}</span>
                          {row.kind === 'real_user' && row.externalId && formatParticipantConflictLabel(String(row.externalId || '')) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              <AlertTriangle size={11} />
                              {t({ it: 'Occupato', en: 'Busy' })}
                            </span>
                          ) : null}
                          {row.optional ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">OPT</span> : null}
                          {row.remote ? <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">REM</span> : null}
                          {row.company ? <span className="max-w-[120px] truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{row.company}</span> : null}
                          <button type="button" onClick={() => toggleParticipantOptional(row.key)} className="text-slate-500 hover:text-ink" title={t({ it: 'Facoltativo', en: 'Optional' })}>
                            O
                          </button>
                          <button type="button" onClick={() => toggleParticipantRemote(row.key)} className="text-slate-500 hover:text-indigo-700" title={t({ it: 'Remoto', en: 'Remote' })}>
                            R
                          </button>
                          <button type="button" onClick={() => removeParticipant(row.key)} className="text-slate-500 hover:text-rose-600" title={t({ it: 'Rimuovi', en: 'Remove' })}>
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">{t({ it: 'Nessun partecipante selezionato.', en: 'No participant selected.' })}</span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeParticipantsModal}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'OK', en: 'OK' })}
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </div>
      </div>
    </Transition>
  );

  const earliestSuggestionsOverlay = (
    <Transition show={earliestSuggestionsModalOpen && open} as={Fragment}>
      <div
        className="fixed inset-0 z-[93] pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={t({ it: 'Prime salette disponibili', en: 'First available rooms' })}
      >
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div
            className="pointer-events-auto fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              closeEarliestSuggestionsModal();
            }}
          />
        </Transition.Child>
        <div className="pointer-events-auto fixed inset-0 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{t({ it: 'Prima disponibilità', en: 'First availability' })}</h2>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Seleziona una saletta per aprire la configurazione meeting con il primo orario utile.',
                        en: 'Select a room to open meeting configuration with the first available time.'
                      })}
                    </div>
                  </div>
                  <button onClick={closeEarliestSuggestionsModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {earliestRoomSuggestions.map((row) => {
                    const d = new Date(Number(row.startAt));
                    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const isNowish = selectedSlotStartTs !== null && Math.abs(Number(row.startAt) - Number(selectedSlotStartTs)) < 60_000;
                    return (
                      <button
                        key={`earliest-${row.roomId}-${row.startAt}`}
                        type="button"
                        onClick={() => applySuggestedRoomStart(row.roomId, row.startAt)}
                        className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left hover:bg-emerald-100"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{row.roomName}</div>
                          <div className="truncate text-xs text-slate-600">{row.floorPlanName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-emerald-700">
                            {isNowish ? t({ it: 'Ora', en: 'Now' }) : hhmm}
                          </div>
                          <div className="text-[11px] text-slate-500">{t({ it: 'Apri configurazione', en: 'Open configuration' })}</div>
                        </div>
                      </button>
                    );
                  })}
                  {!earliestRoomSuggestions.length ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      {t({ it: 'Nessuna saletta suggerita disponibile.', en: 'No suggested room available.' })}
                    </div>
                  ) : null}
                </div>
              </div>
            </Transition.Child>
          </div>
        </div>
      </div>
    </Transition>
  );

  return (
    <>
      <Transition show={open} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[110]"
          onClose={() => {
            if (roomPreview) return;
            if (participantsModalOpen) return;
            if (businessPartnersModalOpen) return;
            if (earliestSuggestionsModalOpen) return;
            if (approvalModalOpen) return;
            if (Date.now() < previewCloseGuardUntilRef.current) return;
            if (Date.now() < participantsCloseGuardUntilRef.current) return;
            if (Date.now() < earliestSuggestionsCloseGuardUntilRef.current) return;
            if (Date.now() < approvalCloseGuardUntilRef.current) return;
            onClose();
          }}
        >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-[1260px] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                  <div>
                    <Dialog.Title className={`${dialogTitleClass} font-semibold text-ink`}>{dialogTitle}</Dialog.Title>
                    <div className="text-sm text-slate-500">
                      {step === 'browse'
                        ? t({
                            it: 'Seleziona data/ora e scegli la sala da una griglia grafica filtrata per disponibilità e dotazioni.',
                            en: 'Select date/time and choose the room from a visual grid filtered by availability and equipment.'
                          })
                        : t({
                            it: 'Configura meeting: partecipanti, setup e notifiche.',
                            en: 'Configure meeting: participants, setup, and notifications.'
                          })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <button
                        onClick={() => {
                          reloadPending();
                          setApprovalModalOpen(true);
                        }}
                        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                          pendingRows.length
                            ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
                            : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <ShieldCheck size={14} />
                        {t({ it: 'Approvazioni', en: 'Approvals' })} {pendingRows.length ? `(${pendingRows.length})` : ''}
                      </button>
                    ) : null}
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {!canCreateMeetings ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    {t({
                      it: 'Non hai il permesso di creazione autonoma: il meeting verrà inviato come richiesta agli amministratori.',
                      en: 'You cannot create meetings autonomously: this meeting will be sent for admin approval.'
                    })}
                  </div>
                ) : null}

                <div className={`mt-4 grid grid-cols-1 gap-3 ${step === 'browse' ? 'lg:grid-cols-2' : ''}`}>
                  {step === 'browse' ? (
                    <>
                      <label className="text-sm font-semibold text-slate-700">
                        {t({ it: 'Cliente', en: 'Client' })}{requiredAsterisk}
                        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.shortName || client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        {t({ it: 'Sede', en: 'Site' })}{requiredAsterisk}
                        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          {(selectedClient?.sites || []).map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                  <div className="grid grid-cols-3 gap-2 lg:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={14} /> {t({ it: 'Data', en: 'Date' })}{requiredAsterisk}
                      </span>
                      <input
                        type="date"
                        min={todayMin}
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={14} /> {t({ it: 'Inizio', en: 'Start' })}{requiredAsterisk}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="HH:MM"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        onBlur={(e) => {
                          const normalized = normalizeTypedTime(e.target.value);
                          if (normalized) setStartTime(normalized);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={14} /> {t({ it: 'Fine', en: 'End' })}{requiredAsterisk}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="HH:MM"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        onBlur={(e) => {
                          const normalized = normalizeTypedTime(e.target.value);
                          if (normalized) setEndTime(normalized);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={setEarliestPossibleTime}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Imposta il primo momento libero (ora o appena si libera la sala selezionata).', en: 'Set the earliest free time (now or when the selected room becomes free).' })}
                  >
                    {t({ it: 'Prima possibile', en: 'Earliest possible' })}
                  </button>
                  <button
                    type="button"
                    onClick={setMaxPossibleEndTime}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title={
                      selectedSiteMaxEndTime
                        ? t({
                            it: `Imposta la fine meeting sull'orario sede (${selectedSiteMaxEndTime}) o prima se la sala si blocca.`,
                            en: `Set meeting end to the site closing time (${selectedSiteMaxEndTime}) or earlier if the room becomes blocked.`
                          })
                        : t({
                            it: 'Imposta la fine meeting al limite disponibile attuale.',
                            en: 'Set meeting end to the current available limit.'
                          })
                    }
                  >
                    {selectedSiteMaxEndTime ? t({ it: 'Fine sede', en: 'Site closing' }) : t({ it: 'Più possibile', en: 'Latest possible' })}
                  </button>
                  <button
                    type="button"
                    onClick={setEndTimeBeyondSiteHours}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({
                      it: 'Estende manualmente la fine meeting fino alle 23:59, anche oltre l\'orario sede.',
                      en: 'Manually extends meeting end to 23:59, even beyond site hours.'
                    })}
                  >
                    {t({ it: 'Oltre sede', en: 'Beyond site' })}
                  </button>
                  {[
                    { label: '30m', minutes: 30 },
                    { label: '1h', minutes: 60 },
                    { label: '1,30h', minutes: 90 },
                    { label: '2h', minutes: 120 }
                  ].map((preset) => (
                    <button
                      key={`dur-${preset.label}`}
                      type="button"
                      onClick={() => applyDurationPreset(preset.minutes)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({
                        it: `Imposta fine meeting a +${preset.label} rispetto all'orario di inizio.`,
                        en: `Set meeting end to +${preset.label} from start time.`
                      })}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <label className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                    <input type="checkbox" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} />
                    {t({ it: 'Meeting multi-giorno', en: 'Multi-day meeting' })}
                  </label>
                  {multiDay ? (
                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                      <span>{t({ it: 'Fino al', en: 'Until' })}</span>
                      <input
                        type="date"
                        min={day || todayMin}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                      />
                    </label>
                  ) : null}
                  <span className="group relative inline-flex items-center">
                    <HelpCircle size={14} className="text-slate-400" />
                    <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-80 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {t({
                        it: 'Puoi scrivere gli orari manualmente in formato HH:MM (es. 18:08 - 18:29) oppure usare il time picker.',
                        en: 'You can type times manually using HH:MM (e.g. 18:08 - 18:29) or use the time picker.'
                      })}
                    </span>
                  </span>
                  {selectedSiteMaxEndTime ? (
                    <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                      {t({ it: `Massimo sede: ${selectedSiteMaxEndTime}`, en: `Site max: ${selectedSiteMaxEndTime}` })}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-700">{t({ it: 'Ho bisogno di', en: 'I need' })}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {NEED_CONFIG.map((need) => {
                      const active = needs[need.key];
                      const NeedIcon = need.icon;
                      return (
                        <button
                          key={need.key}
                          type="button"
                          onClick={() => toggleNeed(need.key)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                            active ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <NeedIcon size={13} /> {t(need.labels)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {step === 'browse' ? (
                  <div className="mt-3 rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Meeting rooms disponibili', en: 'Available meeting rooms' })}</div>
                      <span className="text-xs text-slate-500">
                        {loadingOverview
                          ? t({ it: 'Aggiornamento...', en: 'Updating...' })
                          : t({ it: `${selectableRoomsCount}/${overviewRows.length} disponibili`, en: `${selectableRoomsCount}/${overviewRows.length} available` })}
                      </span>
                    </div>
                    <div className="grid max-h-[56vh] grid-cols-1 gap-2 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                      {roomsWithAvailability.map(({ room, selectable, slotBlocked, missingNeeds }) => {
                        const serviceIcons = resolveRoomServices(room.equipment || []);
                        return (
                          <div
                            key={room.roomId}
                            className={`rounded-xl border px-3 py-3 transition ${
                              selectable
                                ? 'border-emerald-400 bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100'
                                : 'border-rose-300 bg-rose-50/80 opacity-90'
                            }`}
                          >
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div className="truncate text-sm font-semibold text-ink">{room.roomName}</div>
                                  <button
                                    type="button"
                                    onClick={() => setRoomPreview({ roomId: room.roomId, floorPlanId: room.floorPlanId })}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Mostra planimetria', en: 'Show floor plan' })}
                                  >
                                    <Eye size={12} />
                                  </button>
                                </div>
                                <div className="truncate text-[10px] leading-4 text-slate-700">{room.siteName || selectedSite?.name || ''}</div>
                                <div className="truncate text-[10px] leading-4 text-slate-600">{room.floorPlanName}</div>
                              </div>
                              <div className="text-xs font-semibold text-slate-700">{room.currentPeople}/{room.capacity}</div>
                            </div>
                          </div>
                          <div className="mt-1 text-[10px] leading-4 text-slate-700">
                            {Number.isFinite(Number(room.surfaceSqm)) && Number(room.surfaceSqm) > 0
                              ? `${t({ it: 'Superficie', en: 'Surface' })}: ${Number(room.surfaceSqm).toFixed(1)} mq`
                              : t({ it: 'Superficie non disponibile', en: 'Surface not available' })}
                          </div>
                          <div className={`mt-1.5 text-xs font-semibold ${slotBlocked || missingNeeds.length ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {slotBlocked
                              ? t({ it: 'Occupata nello slot selezionato', en: 'Busy in selected slot' })
                              : missingNeeds.length
                                ? t({ it: 'Mancano dotazioni richieste', en: 'Missing required equipment' })
                                : t({ it: 'Disponibile', en: 'Available' })}
                          </div>
                          <div className="mt-1.5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetailsForRoom(room.roomId)}
                              disabled={!selectable}
                              className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t({ it: 'Seleziona', en: 'Select' })}
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {serviceIcons.map((service) => {
                              const ServiceIcon = service.icon;
                              return (
                                <span
                                  key={`${room.roomId}-${service.key}`}
                                  className="group relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700"
                                >
                                  <ServiceIcon size={12} />
                                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                                    {t(service.labels)}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                      {!roomsWithAvailability.length ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          {t({ it: 'Nessuna meeting room disponibile in questa selezione.', en: 'No meeting rooms available in this scope.' })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setStep('browse')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <ArrowLeft size={13} /> {t({ it: 'Cambia sala', en: 'Change room' })}
                          </button>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-ink">
                                {selectedRoom?.roomName || '-'}{' '}
                                <span className="font-normal text-slate-600">
                                  - {t({ it: 'Posti disponibili', en: 'Available seats' })}: {selectedRoom?.availableSeats ?? 0} -{' '}
                                  {Number.isFinite(Number(selectedRoom?.surfaceSqm)) && Number(selectedRoom?.surfaceSqm) > 0
                                    ? `${t({ it: 'Superficie', en: 'Surface' })} ${Number(selectedRoom?.surfaceSqm).toFixed(1)} mq`
                                    : t({ it: 'Superficie n.d.', en: 'Surface n/a' })}
                                </span>
                              </div>
                            </div>
                            {selectedRoom ? (
                              <button
                                type="button"
                                onClick={() => setRoomPreview({ roomId: selectedRoom.roomId, floorPlanId: selectedRoom.floorPlanId })}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                title={t({ it: 'Mostra planimetria', en: 'Show floor plan' })}
                              >
                                <Eye size={13} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <label className="mt-2 block text-sm font-semibold text-slate-700">
                          {t({ it: 'Oggetto meeting', en: 'Meeting subject' })}{requiredAsterisk}
                          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        </label>
                        <label className="mt-3 block text-sm font-semibold text-slate-700">
                          {t({ it: 'Video conference LINK', en: 'Video conference LINK' })}
                          <input
                            type="url"
                            value={videoConferenceLink}
                            onChange={(e) => setVideoConferenceLink(e.target.value)}
                            placeholder={t({ it: 'Es. link Teams / Meet / Zoom', en: 'e.g. Teams / Meet / Zoom link' })}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="mt-3 block text-sm font-semibold text-slate-700">
                          {t({ it: 'Note', en: 'Notes' })}
                          <textarea
                            value={meetingNotes}
                            onChange={(e) => setMeetingNotes(e.target.value)}
                            rows={3}
                            placeholder={t({ it: 'Note aggiuntive per il meeting', en: 'Additional meeting notes' })}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        {participantsOverCapacity ? (
                          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            {t({
                              it: `Warning: persone in presenza (${onsiteSelectedCount + onsiteExternalGuestsCount}) superiori alla capienza sala (${roomCapacity}). Puoi comunque creare il meeting.`,
                              en: `Warning: on-site attendees (${onsiteSelectedCount + onsiteExternalGuestsCount}) exceed room capacity (${roomCapacity}). You can still create the meeting.`
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <Users size={15} />
                            {t({ it: 'Partecipanti', en: 'Participants' })}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${participantsOverCapacity ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {selectedCount}/{roomCapacity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {t({ it: `${optionalCount} facoltativi`, en: `${optionalCount} optional` })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setParticipantsModalOpen(true)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Users size={13} />
                              {t({ it: 'Gestisci partecipanti', en: 'Manage participants' })}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {t({
                            it: `${selectedCount} partecipanti interni (${optionalCount} facoltativi, ${remoteSelectedCount} remoti). Apri la modale per selezionare utenti reali e altri ospiti.`,
                            en: `${selectedCount} internal participants (${optionalCount} optional, ${remoteSelectedCount} remote). Open the modal to pick real users and other guests.`
                          })}
                        </div>
                        <div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                          {selectedParticipants.length ? (
                            selectedParticipants.map((row) => (
                              <span
                                key={row.key}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                                  row.kind === 'manual'
                                    ? 'border-violet-200 bg-violet-50 text-violet-800'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                                >
                                  <span className="max-w-[220px] truncate uppercase tracking-[0.02em]">{row.fullName}</span>
                                  {row.optional ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">OPT</span> : null}
                                  {row.remote ? <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">REM</span> : null}
                                  <button
                                    type="button"
                                    onClick={() => removeParticipant(row.key)}
                                    className={row.kind === 'manual' ? 'text-violet-600 hover:text-rose-600' : 'text-slate-500 hover:text-rose-600'}
                                    title={row.kind === 'manual' ? t({ it: 'Rimuovi ospite', en: 'Remove guest' }) : t({ it: 'Rimuovi partecipante', en: 'Remove participant' })}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">{t({ it: 'Nessun partecipante selezionato.', en: 'No participant selected.' })}</span>
                            )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <ShieldCheck size={15} />
                            {t({ it: 'Admin meeting', en: 'Meeting admins' })}
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                              {selectedMeetingAdmins.length}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {t({
                            it: 'Uno o più utenti possono amministrare il meeting (modifica, estensione, cancellazione, gestione partecipanti).',
                            en: 'One or more users can administer the meeting (edit, extend, cancel, participant management).'
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                          {selectedMeetingAdmins.length ? (
                            selectedMeetingAdmins.map((row) => {
                              const rowId = String(row.id || '');
                              const displayName =
                                `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim() || row.username;
                              const fixed = rowId === currentUserId;
                              return (
                                <span
                                  key={`meeting-admin-${rowId}`}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                                    fixed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'
                                  }`}
                                  title={
                                    fixed
                                      ? t({ it: 'Creatore meeting (sempre admin)', en: 'Meeting creator (always admin)' })
                                      : t({ it: 'Admin meeting', en: 'Meeting admin' })
                                  }
                                >
                                  <span className="max-w-[220px] truncate">{displayName}</span>
                                  {fixed ? (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      {t({ it: 'Creatore', en: 'Creator' })}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => removeMeetingAdmin(rowId)}
                                      className="text-slate-500 hover:text-rose-600"
                                      title={t({ it: 'Rimuovi admin meeting', en: 'Remove meeting admin' })}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-500">{t({ it: 'Nessun admin meeting selezionato.', en: 'No meeting admins selected.' })}</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={meetingAdminCandidateId}
                            onChange={(e) => setMeetingAdminCandidateId(e.target.value)}
                            className="min-w-[260px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            disabled={!availableMeetingAdminCandidates.length}
                          >
                            {availableMeetingAdminCandidates.length ? (
                              availableMeetingAdminCandidates.map((row) => {
                                const label =
                                  `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim() || row.username;
                                return (
                                  <option key={`meeting-admin-candidate-${row.id}`} value={row.id}>
                                    {label}
                                  </option>
                                );
                              })
                            ) : (
                              <option value="">{t({ it: 'Nessun altro utente disponibile', en: 'No additional user available' })}</option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => addMeetingAdmin(meetingAdminCandidateId)}
                            disabled={!meetingAdminCandidateId}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus size={13} />
                            {t({ it: 'Aggiungi admin', en: 'Add admin' })}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Setup e notifiche', en: 'Setup and notifications' })}</div>
                          <span className="group relative inline-flex items-center">
                            <HelpCircle size={14} className="text-slate-400" />
                            <span className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-80 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                              {t({
                                it: 'Setup pre/post riunione: tempo operativo per preparazione sala, pulizie e ripristino dotazioni prima/dopo il meeting.',
                                en: 'Pre/post meeting setup: operational time to prepare room, clean up and restore equipment before/after the meeting.'
                              })}
                            </span>
                          </span>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {t({ it: 'Timeline effettiva (pre / meeting / post)', en: 'Effective timeline (pre / meeting / post)' })}
                          </div>
                          <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
                            <div
                              className="bg-amber-300"
                              style={{ width: `${timingBarSegments.prePct}%`, minWidth: timingBarSegments.preMin > 0 ? 4 : 0 }}
                              title={t({ it: `Pre-riunione: ${timingBarSegments.preMin} min`, en: `Pre-meeting: ${timingBarSegments.preMin} min` })}
                            />
                            <div
                              className="bg-emerald-400"
                              style={{ width: `${timingBarSegments.meetingPct}%`, minWidth: timingBarSegments.meetingMin > 0 ? 6 : 0 }}
                              title={t({ it: `Riunione: ${timingBarSegments.meetingMin} min`, en: `Meeting: ${timingBarSegments.meetingMin} min` })}
                            />
                            <div
                              className="bg-sky-300"
                              style={{ width: `${timingBarSegments.postPct}%`, minWidth: timingBarSegments.postMin > 0 ? 4 : 0 }}
                              title={t({ it: `Post-riunione: ${timingBarSegments.postMin} min`, en: `Post-meeting: ${timingBarSegments.postMin} min` })}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                            <span>{t({ it: `Pre ${timingBarSegments.preMin}m`, en: `Pre ${timingBarSegments.preMin}m` })}</span>
                            <span>{t({ it: `Meeting ${timingBarSegments.meetingMin}m`, en: `Meeting ${timingBarSegments.meetingMin}m` })}</span>
                            <span>{t({ it: `Post ${timingBarSegments.postMin}m`, en: `Post ${timingBarSegments.postMin}m` })}</span>
                          </div>
                        </div>
                        <label className="text-xs font-semibold text-slate-600">
                          {t({ it: 'Setup pre-riunione (min)', en: 'Pre-meeting setup (min)' })}: {bufferBefore}
                          <input type="range" min={0} max={setupNeighbors.maxBefore} value={bufferBefore} onChange={(e) => applyBufferBefore(Number(e.target.value) || 0)} className="mt-2 w-full" />
                          <div className="mt-1 text-[11px] text-slate-500">
                            {setupNeighbors.prev
                              ? t({
                                  it: `Max ${setupNeighbors.maxBefore} min (considerando meeting precedente ${new Date(setupNeighbors.prev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.prev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                                  en: `Max ${setupNeighbors.maxBefore} min (considering previous meeting ${new Date(setupNeighbors.prev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.prev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                })
                              : t({ it: 'Nessun meeting precedente: max 60 min.', en: 'No previous meeting: max 60 min.' })}
                          </div>
                        </label>
                        <label className="mt-2 block text-xs font-semibold text-slate-600">
                          {t({ it: 'Setup post-riunione (min)', en: 'Post-meeting setup (min)' })}: {bufferAfter}
                          <input type="range" min={0} max={setupNeighbors.maxAfter} value={bufferAfter} onChange={(e) => applyBufferAfter(Number(e.target.value) || 0)} className="mt-2 w-full" />
                          <div className="mt-1 text-[11px] text-slate-500">
                            {setupNeighbors.next
                              ? t({
                                  it: `Max ${setupNeighbors.maxAfter} min (prima del meeting successivo ${new Date(setupNeighbors.next.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.next.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                                  en: `Max ${setupNeighbors.maxAfter} min (before next meeting ${new Date(setupNeighbors.next.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.next.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                })
                              : t({ it: 'Nessun meeting successivo: max 60 min.', en: 'No next meeting: max 60 min.' })}
                          </div>
                        </label>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            <span>{t({ it: 'Lingua kiosk meeting', en: 'Meeting kiosk language' })}</span>
                            <span className="group relative inline-flex items-center">
                              <HelpCircle size={13} className="text-slate-400" />
                              <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-80 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                                {t({
                                  it: 'Auto usa la lingua del kiosk (impostazione manuale o lingua del dispositivo). Se imposti una lingua qui, quando il meeting inizia il kiosk passa automaticamente a quella lingua finché la riunione è in corso.',
                                  en: 'Auto uses the kiosk default language (manual choice or device language). If you set a language here, the kiosk automatically switches to that language while the meeting is in progress.'
                                })}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {KIOSK_LANG_OPTIONS.map((opt) => {
                              const active = meetingKioskLanguage === opt.key;
                              return (
                                <button
                                  key={`meeting-kiosk-lang-${opt.key}`}
                                  type="button"
                                  onClick={() => setMeetingKioskLanguage(opt.key)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                                    active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                  title={`${opt.flag} ${t(opt.labels)}`}
                                >
                                  <span>{opt.flag}</span>
                                  <span>{opt.key === 'auto' ? t({ it: 'Auto', en: 'Auto' }) : opt.key.toUpperCase()}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> <Mail size={15} />
                            {t({ it: 'Invia mail ai partecipanti', en: 'Send email to participants' })}
                          </label>
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input type="checkbox" checked={technicalSetup} onChange={(e) => setTechnicalSetup(e.target.checked)} /> <Wrench size={15} />
                            {t({ it: 'Richiede setup tecnico', en: 'Technical setup required' })}
                          </label>
                          {technicalSetup ? (
                            <input
                              value={technicalEmail}
                              onChange={(e) => setTechnicalEmail(e.target.value)}
                              placeholder={t({ it: 'Email tecnico da notificare', en: 'Technician email to notify' })}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            />
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                          <span>{t({ it: 'Disponibilità', en: 'Availability' })}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${participantsOverCapacity ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {onsiteHeadcount}/{roomCapacity}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {t({
                            it: `${onsiteInternalParticipantCount} interni in sede (${optionalCount} facoltativi) · ${remoteInternalParticipantCount} interni remoti · ${onsiteManualGuestCount} altri ospiti in sede · ${remoteManualGuestCount} altri ospiti remoti. La disponibilità si aggiorna automaticamente.`,
                            en: `${onsiteInternalParticipantCount} on-site internal (${optionalCount} optional) · ${remoteInternalParticipantCount} remote internal · ${onsiteManualGuestCount} on-site guests · ${remoteManualGuestCount} remote guests. Availability updates automatically.`
                          })}
                        </div>
                        <div className={`mt-2 text-xs ${nextMeetingSameDay ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>
                          {nextMeetingSameDay
                            ? t({
                                it: `Prossima riunione oggi: ${nextMeetingSameDay.subject || 'Meeting'} • ${new Date(nextMeetingSameDay.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(nextMeetingSameDay.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                                en: `Next meeting today: ${nextMeetingSameDay.subject || 'Meeting'} • ${new Date(nextMeetingSameDay.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(nextMeetingSameDay.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              })
                            : t({ it: 'Nessun altro meeting previsto oggi per questa sala.', en: 'No more meetings today for this room.' })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                          <CheckCircle2 size={14} className={selectedRoomSlotBlocked ? 'text-rose-600' : 'text-emerald-600'} />
                          {selectedRoomSlotBlocked
                            ? t({ it: 'Slot bloccato da meeting presenti o in approvazione.', en: 'Slot blocked by existing or pending meetings.' })
                            : t({ it: 'Nessuna sovrapposizione nello slot selezionato.', en: 'No overlaps in selected slot.' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <div className="text-xs text-slate-500">
                    {step === 'browse'
                      ? t({ it: 'Clicca una meeting room disponibile per passare alla configurazione meeting.', en: 'Click an available meeting room to continue with meeting configuration.' })
                      : t({ it: 'I campi con asterisco rosso sono obbligatori.', en: 'Fields marked with red asterisk are required.' })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                    {step === 'details' ? (
                      <button
                        onClick={() => {
                          if (cannotSubmitReason) {
                            push(cannotSubmitReason, 'danger');
                            return;
                          }
                          void submitMeeting();
                        }}
                        aria-disabled={cannotSubmit}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                          cannotSubmit ? 'cursor-not-allowed bg-primary/60' : 'bg-primary hover:bg-primary/90'
                        }`}
                        title={cannotSubmitReason || undefined}
                      >
                        <Send size={14} className="mr-1 inline-block" />
                        {canCreateMeetings ? t({ it: 'Crea meeting', en: 'Create meeting' }) : t({ it: 'Invia richiesta', en: 'Send request' })}
                      </button>
                    ) : null}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
          {participantsOverlay}
          {earliestSuggestionsOverlay}
          <ClientBusinessPartnersModal
            open={businessPartnersModalOpen && !!selectedClient}
            client={selectedClient || undefined}
            onClose={() => setBusinessPartnersModalOpen(false)}
            onSave={(businessPartners) => {
              if (!selectedClient?.id) return;
              updateClient(selectedClient.id, { businessPartners } as any);
              setBusinessPartnersModalOpen(false);
            }}
          />
        </Dialog>
      </Transition>

      <Transition show={isAdmin && approvalModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[112]" onClose={closeApprovalModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Richieste approvazione', en: 'Approval requests' })}
                    </Dialog.Title>
                    <button onClick={closeApprovalModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-end">
                      <button
                        onClick={reloadPending}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {loadingPending ? t({ it: 'Caricamento...', en: 'Loading...' }) : t({ it: 'Aggiorna', en: 'Refresh' })}
                      </button>
                    </div>
                    {!pendingRows.length ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        {t({ it: 'Nessuna richiesta pendente.', en: 'No pending requests.' })}
                      </div>
                    ) : (
                      <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
                        {pendingRows.map((row) => (
                          <div key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <div className="font-semibold text-ink">{row.subject}</div>
                              <div className="text-xs text-slate-500">{new Date(row.startAt).toLocaleString()}</div>
                            </div>
                            <div className="text-xs text-slate-600">
                              {row.roomName} • {row.requestedByUsername} • {row.requestedSeats}/{row.roomCapacity}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                value={rejectReasonById[row.id] || ''}
                                onChange={(e) => setRejectReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                placeholder={t({ it: 'Motivazione rifiuto (obbligatoria)', en: 'Reject reason (required)' })}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              />
                              <button
                                onClick={() => doReview(row, 'approve')}
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                {t({ it: 'Approva', en: 'Approve' })}
                              </button>
                              <button
                                onClick={() => doReview(row, 'reject')}
                                className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                              >
                                {t({ it: 'Rifiuta', en: 'Reject' })}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!roomPreview} as={Fragment}>
        <Dialog as="div" className="relative z-[113]" onClose={closeRoomPreview}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Planimetria meeting room', en: 'Meeting room floor plan' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {previewData
                          ? `${previewData.clientName} > ${previewData.siteName} > ${previewData.planName}`
                          : t({ it: 'Dati non disponibili', en: 'Data not available' })}
                      </div>
                    </div>
                    <button onClick={closeRoomPreview} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3">
                    {previewData ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <svg viewBox={previewData.viewBox} className="h-[58vh] w-full rounded-lg bg-white">
                          {previewData.planImageUrl && previewData.planWidth > 0 && previewData.planHeight > 0 ? (
                            <image
                              href={previewData.planImageUrl}
                              xlinkHref={previewData.planImageUrl}
                              x={previewData.planImageX || 0}
                              y={previewData.planImageY || 0}
                              width={previewData.planWidth}
                              height={previewData.planHeight}
                              preserveAspectRatio="none"
                              opacity={0.9}
                            />
                          ) : null}
                          {previewData.rooms.map((room) => {
                            const points = room.points.map((p) => `${p.x},${p.y}`).join(' ');
                            const selected = room.id === previewData.roomId;
                            const roomFill = selected
                              ? 'rgba(34,197,94,0.35)'
                              : room.meetingRoom
                                ? 'rgba(14,165,233,0.14)'
                                : 'rgba(255,255,255,0)';
                            const roomStroke = selected ? '#16a34a' : room.meetingRoom ? '#0284c7' : '#94a3b8';
                            return (
                              <g key={room.id}>
                                <polygon
                                  points={points}
                                  fill={roomFill}
                                  stroke={roomStroke}
                                  strokeWidth={selected ? 2 : 1.1}
                                />
                                {room.meetingRoom && room.center ? (
                                  <text
                                    x={room.center.x}
                                    y={room.center.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={16}
                                    fontWeight={selected ? 700 : 600}
                                    fill={selected ? '#166534' : '#0f172a'}
                                  >
                                    {room.name || t({ it: 'Meeting room', en: 'Meeting room' })}
                                  </text>
                                ) : null}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        {t({ it: 'Impossibile mostrare la planimetria per questa sala.', en: 'Unable to render floor plan for this room.' })}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

    </>
  );
};

export default MeetingManagerModal;
