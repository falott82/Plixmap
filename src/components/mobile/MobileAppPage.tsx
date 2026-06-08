import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchMe, MFARequiredError, updateMyProfile } from '../../api/auth';
import { fetchMobileAgenda, fetchMobileAgendaMonth, mobileCheckInMeeting, type MobileAgendaMeeting } from '../../api/mobile';
import {
  clearChat,
  deleteChatMessage,
  editChatMessage,
  fetchChatMessages,
  fetchMobileChatOverview,
  markChatRead,
  reactChatMessage,
  sendChatMessage,
  starChatMessage,
  type ChatMessage
} from '../../api/chat';
import { fetchMeetingNotes, type MeetingNote, type MeetingNoteParticipant, upsertMeetingNote } from '../../api/meetings';
import { useLang, useT } from '../../i18n/useT';
import { getMeetingTemporalState, getMeetingTimePhaseBadgeLabel } from '../../utils/meetingTime';

import {
  buildCalendarMonthCells, buildCheckInKeyForParticipantMatch, buildDmNameByUserId, buildMobileChatClientOptions, computeSyncBadge, canDeleteChatForAll, canEditChatMessage, compressImageAttachment, computeChatInitials, filterMeetingsForRoom, filterRecentMobileChatMessages, parseMobileChatOverview, resolveChatMessageAuthorName, resolveSelectedChatClientName, selectAgendaMeetings, sortFilterMobileChatClientOptions, MOBILE_AGENDA_CACHE_MAX_ENTRIES, MOBILE_AGENDA_CACHE_TTL_MS, MOBILE_AGENDA_MONTH_CACHE_TTL_MS, MOBILE_LOGIN_STORAGE_KEY, MOBILE_THEME_STORAGE_KEY, mobileAgendaMemoryCache, mobileAgendaMonthMemoryCache, MobileAgendaMonthPayload, MobileAgendaPayload, MobileChatOverviewPayload, MobileChatViewMode, MobileConfirmState, MobileTab, normalizeChatClientId, nowDay, parseRoomIdFromQrPayload, readAgendaPayloadFromSessionCache, readMobileChatOverviewFromSessionCache, readMobileChatThreadFromSessionCache, scheduleWhenIdle, writeAgendaPayloadToSessionCache, writeMobileChatOverviewToSessionCache, writeMobileChatThreadToSessionCache
} from './MobileAppPage.helpers';
import { MobileAppPageBody } from './MobileAppPageBody';
const MobileAppPage = () => {
  const location = useLocation();
  const lang = useLang();
  const tr = useT();
  const { user, login, logout, setAuth } = useAuthStore();
  const [tab, setTab] = useState<MobileTab>('agenda');
  const [day, setDay] = useState(nowDay());
  const [mobileTheme, setMobileTheme] = useState<'night' | 'day'>(() => {
    if (typeof window === 'undefined') return 'night';
    try {
      return window.localStorage.getItem(MOBILE_THEME_STORAGE_KEY) === 'day' ? 'day' : 'night';
    } catch {
      return 'night';
    }
  });
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState('');
  const [agendaMonthLoading, setAgendaMonthLoading] = useState(false);
  const [lastAgendaSyncAt, setLastAgendaSyncAt] = useState<number | null>(null);
  const [lastAgendaSyncMs, setLastAgendaSyncMs] = useState(0);
  const [agendaSyncDegraded, setAgendaSyncDegraded] = useState(false);
  const [agendaPayload, setAgendaPayload] = useState<Awaited<ReturnType<typeof fetchMobileAgenda>> | null>(null);
  const [agendaMonthPayload, setAgendaMonthPayload] = useState<MobileAgendaMonthPayload | null>(null);
  const [checkInMapByMeetingId, setCheckInMapByMeetingId] = useState<Record<string, Record<string, true>>>({});
  const [checkInTsByMeetingId, setCheckInTsByMeetingId] = useState<Record<string, Record<string, number>>>({});
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [rememberUsername, setRememberUsername] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [chatClientId, setChatClientId] = useState('');
  const [chatViewMode, setChatViewMode] = useState<MobileChatViewMode>('list');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatClientChannels, setChatClientChannels] = useState<Array<{ id: string; name: string; logoUrl: string; lastMessageAt?: number | null }>>([]);
  const [chatUnreadByClientId, setChatUnreadByClientId] = useState<Record<string, number>>({});
  const [chatLastMessageByClientId, setChatLastMessageByClientId] = useState<Record<string, ChatMessage | null>>({});
  const [chatClientLogoFailedById, setChatClientLogoFailedById] = useState<Record<string, true>>({});
  const [chatDmContacts, setChatDmContacts] = useState<Array<{ id: string; threadId: string; name: string; avatarUrl?: string; lastMessageAt?: number | null }>>(
    []
  );
  const [chatSearch, setChatSearch] = useState('');
  const [chatReplyToId, setChatReplyToId] = useState<string | null>(null);
  const [chatEditingId, setChatEditingId] = useState<string | null>(null);
  const [chatEditingText, setChatEditingText] = useState('');
  const [chatDeletePrompt, setChatDeletePrompt] = useState<null | { messageId: string; allowAll: boolean }>(null);
  const [chatReactionForId, setChatReactionForId] = useState<string | null>(null);
  const [chatPendingAttachments, setChatPendingAttachments] = useState<{ name: string; dataUrl: string; mime?: string }[]>([]);
  const [chatAttachmentsBusy, setChatAttachmentsBusy] = useState(false);
  const [chatActionBusyId, setChatActionBusyId] = useState<string | null>(null);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceRecordError, setVoiceRecordError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [meetingDetailOpen, setMeetingDetailOpen] = useState<MobileAgendaMeeting | null>(null);
  const [meetingCheckInPrompt, setMeetingCheckInPrompt] = useState<MobileAgendaMeeting | null>(null);
  const [meetingNotesOpen, setMeetingNotesOpen] = useState<MobileAgendaMeeting | null>(null);
  const [meetingSharedNotePreview, setMeetingSharedNotePreview] = useState<MeetingNote | null>(null);
  const [scannerError, setScannerError] = useState('');
  const [scannerManualValue, setScannerManualValue] = useState('');
  const [scannerSupported, setScannerSupported] = useState<boolean>(false);
  const [scannerDetecting, setScannerDetecting] = useState(false);
  const [scannerImageBusy, setScannerImageBusy] = useState(false);
  const [pendingQrAutoCheckInRoomId, setPendingQrAutoCheckInRoomId] = useState<string | null>(null);
  const [qrAutoCheckInBusy, setQrAutoCheckInBusy] = useState(false);
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0);
  const [meetingNotesLoading, setMeetingNotesLoading] = useState(false);
  const [meetingNotesSaving, setMeetingNotesSaving] = useState(false);
  const [meetingNotesError, setMeetingNotesError] = useState('');
  const [meetingNotesList, setMeetingNotesList] = useState<MeetingNote[]>([]);
  const [meetingNotesParticipants, setMeetingNotesParticipants] = useState<MeetingNoteParticipant[]>([]);
  const [meetingMyNoteId, setMeetingMyNoteId] = useState<string | null>(null);
  const [meetingMyNoteTitle, setMeetingMyNoteTitle] = useState('');
  const [meetingMyNoteText, setMeetingMyNoteText] = useState('');
  const [meetingMyNoteShared, setMeetingMyNoteShared] = useState(false);
  const [meetingNotesDirty, setMeetingNotesDirty] = useState(false);
  const [mobileConfirm, setMobileConfirm] = useState<MobileConfirmState | null>(null);
  const [meetingMyNoteInitial, setMeetingMyNoteInitial] = useState<{ id: string | null; title: string; text: string; shared: boolean }>({
    id: null,
    title: '',
    text: '',
    shared: false
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerRafRef = useRef<number | null>(null);
  const scannerSessionRef = useRef<number>(0);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatMessagesScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const voiceMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const agendaRequestSeqRef = useRef(0);
  const agendaMonthRequestSeqRef = useRef(0);
  const chatLoadSeqRef = useRef(0);
  const agendaLoadBusyRef = useRef(false);
  const agendaLoadLastKeyRef = useRef('');
  const agendaLoadLastAtRef = useRef(0);
  const chatLoadBusyRef = useRef(false);
  const chatLoadLastKeyRef = useRef('');
  const chatLoadLastAtRef = useRef(0);
  const chatOverviewLoadBusyRef = useRef(false);
  const chatUnreadByClientIdRef = useRef<Record<string, number>>({});
  const chatOverviewLastSyncAtRef = useRef(0);
  const mobileVisibilitySyncAtRef = useRef(0);
  const lastOpenedChatClientIdRef = useRef('');
  const isDayTheme = mobileTheme === 'day';
  const shellClass = isDayTheme
    ? 'bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900'
    : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100';
  const frameClass = isDayTheme
    ? 'border-slate-200 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.10)]'
    : 'border-white/10 bg-white/5 shadow-2xl';
  const loginCardClass = isDayTheme
    ? 'border-slate-200 bg-white/90 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.10)]'
    : 'border-white/10 bg-white/5 text-white shadow-2xl';
  const inputClass = isDayTheme
    ? 'border-slate-200 bg-white text-slate-900 focus:border-cyan-500/60'
    : 'border-white/10 bg-black/20 text-slate-100 focus:border-cyan-400/60';
  const mutedTextClass = isDayTheme ? 'text-slate-500' : 'text-slate-400';
  const subtlePanelClass = isDayTheme ? 'border-slate-200 bg-slate-50/90' : 'border-white/10 bg-black/20';
  const calendarCardClass = isDayTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-slate-950/40';
  const calendarNavButtonClass = isDayTheme
    ? 'border-slate-200 bg-white text-slate-700'
    : 'border-white/10 bg-white/5 text-slate-200';
  const calendarDayButtonBaseClass = isDayTheme
    ? 'border-slate-200 bg-white text-slate-700'
    : 'border-white/5 bg-white/[0.03] text-slate-300';
  const calendarInputClass = isDayTheme
    ? 'border-slate-200 bg-white text-slate-900'
    : 'border-white/10 bg-slate-950 text-slate-100';
  const calendarActionButtonClass = isDayTheme
    ? 'border-slate-200 bg-white text-slate-700'
    : 'border-white/10 bg-slate-900 text-slate-100';
  const noticeClass = isDayTheme
    ? 'rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
    : 'rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200';
  const emptyAgendaClass = isDayTheme
    ? 'rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600'
    : 'rounded-2xl border border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-300';
  const locale = lang === 'en' ? 'en-US' : 'it-IT';
  const calendarWeekdayLabels = lang === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const directMessageLabel = tr({ it: 'Messaggio diretto', en: 'Direct message' });
  const noMessagesLabel = tr({ it: 'Nessun messaggio', en: 'No messages' });
  const meetingLabel = tr({ it: 'Meeting', en: 'Meeting' });
  const checkedLabel = tr({ it: 'PRESENTE', en: 'CHECKED' });
  const remoteShortLabel = tr({ it: 'REMOTO', en: 'REMOTE' });
  const checkInOkLabel = tr({ it: 'CHECK-IN OK', en: 'CHECK-IN OK' });
  const checkInInactiveLabel = tr({ it: 'CHECK-IN N/D', en: 'CHECK-IN N/A' });
  const onSiteUpperLabel = tr({ it: 'IN SEDE', en: 'ON-SITE' });
  const optionalShortLabel = tr({ it: 'OPZ', en: 'OPT' });
  const checkInPrefixLabel = tr({ it: 'Check-in', en: 'Check-in' });

  const isPageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const displayMonth = useMemo(() => String(day || nowDay()).slice(0, 7), [day]);
  const calendarCells = useMemo(() => buildCalendarMonthCells(displayMonth), [displayMonth]);
  const getAgendaCacheKey = useCallback((targetDay: string) => `${String(user?.id || '').trim()}::${String(targetDay || '').trim()}`, [user?.id]);
  const getAgendaMonthCacheKey = useCallback((targetMonth: string) => `${String(user?.id || '').trim()}::${String(targetMonth || '').trim()}`, [user?.id]);
  const applyAgendaPayload = useCallback(
    (next: MobileAgendaPayload, meta?: { syncAt?: number; elapsedMs?: number; degraded?: boolean }) => {
      setAgendaPayload(next);
      setCheckInMapByMeetingId((next.checkInStatusByMeetingId || {}) as any);
      setCheckInTsByMeetingId((next.checkInTimestampsByMeetingId || {}) as any);
      if (meta?.syncAt !== undefined) setLastAgendaSyncAt(meta.syncAt);
      if (meta?.elapsedMs !== undefined) setLastAgendaSyncMs(meta.elapsedMs);
      if (meta?.degraded !== undefined) setAgendaSyncDegraded(meta.degraded);
      if (!chatClientId) {
        const firstClientId = String((next.meetings || [])[0]?.clientId || '').trim();
        if (firstClientId) setChatClientId(normalizeChatClientId(firstClientId));
      }
    },
    [chatClientId]
  );
  const applyAgendaMonthPayload = useCallback((next: MobileAgendaMonthPayload) => {
    setAgendaMonthPayload(next);
  }, []);
  const warmAgendaFromMemoryCache = useCallback(
    (targetDay: string) => {
      const key = getAgendaCacheKey(targetDay);
      if (!key || !String(user?.id || '').trim()) return false;
      const cached = mobileAgendaMemoryCache.get(key);
      if (cached) {
        if (Date.now() - Number(cached.at || 0) > MOBILE_AGENDA_CACHE_TTL_MS) {
          mobileAgendaMemoryCache.delete(key);
        } else {
          applyAgendaPayload(cached.payload, {
            syncAt: Number(cached.at || Date.now()),
            elapsedMs: 0,
            degraded: false
          });
          return true;
        }
      }
      const persisted = readAgendaPayloadFromSessionCache(key);
      if (!persisted) return false;
      applyAgendaPayload(persisted.payload, {
        syncAt: Number(persisted.at || Date.now()),
        elapsedMs: 0,
        degraded: false
      });
      mobileAgendaMemoryCache.set(key, persisted);
      return true;
    },
    [applyAgendaPayload, getAgendaCacheKey, user?.id]
  );
  const warmAgendaMonthFromMemoryCache = useCallback(
    (targetMonth: string) => {
      const key = getAgendaMonthCacheKey(targetMonth);
      if (!key || !String(user?.id || '').trim()) return false;
      const cached = mobileAgendaMonthMemoryCache.get(key);
      if (!cached) return false;
      if (Date.now() - Number(cached.at || 0) > MOBILE_AGENDA_MONTH_CACHE_TTL_MS) {
        mobileAgendaMonthMemoryCache.delete(key);
        return false;
      }
      applyAgendaMonthPayload(cached.payload);
      return true;
    },
    [applyAgendaMonthPayload, getAgendaMonthCacheKey, user?.id]
  );

  useEffect(() => {
    const qRoom = String(new URLSearchParams(location.search).get('roomId') || '').trim();
    if (qRoom) setSelectedRoomId(qRoom);
  }, [location.search]);

  useEffect(() => {
    setScannerSupported(typeof (window as any).BarcodeDetector !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(() => {
    const normalized = normalizeChatClientId(chatClientId);
    if (!normalized && chatClientId) {
      setChatClientId('');
      return;
    }
    if (normalized && normalized !== chatClientId) {
      setChatClientId(normalized);
    }
  }, [chatClientId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('plixmap:mobile:homeInstalled', '1');
    } catch {}
    try {
      const manifestHref = '/manifest-mobile.webmanifest';
      const head = document.head;
      if (!head) return;
      let link = head.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        head.appendChild(link);
      }
      if (link.getAttribute('href') !== manifestHref) link.setAttribute('href', manifestHref);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!viewportMeta) return;
    const prevContent = viewportMeta.getAttribute('content') || '';
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    return () => {
      viewportMeta.setAttribute('content', prevContent || 'width=device-width, initial-scale=1.0');
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = (body.style as any).overscrollBehavior;
    const prevBodyTouchAction = body.style.touchAction;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    (body.style as any).overscrollBehavior = 'none';
    body.style.touchAction = 'pan-y';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      (body.style as any).overscrollBehavior = prevBodyOverscroll;
      body.style.touchAction = prevBodyTouchAction;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(MOBILE_LOGIN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw || '{}');
      const nextUsername = String(parsed?.username || '');
      const nextRememberUsername = !!parsed?.rememberUsername;
      if (nextUsername) setLoginUsername(nextUsername);
      setRememberUsername(nextRememberUsername);
    } catch {
      // ignore
    }
  }, []);
  // NOTE: passwords are never persisted. Staying logged in across reloads relies on the
  // HttpOnly session cookie (fetchMe / /api/auth/me), not a stored credential.

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MOBILE_THEME_STORAGE_KEY, mobileTheme);
    } catch {
      // ignore
    }
  }, [mobileTheme]);

  useEffect(() => {
    if (!settingsMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (settingsMenuRef.current && target && settingsMenuRef.current.contains(target)) return;
      setSettingsMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [settingsMenuOpen]);

  useEffect(() => {
    if (tab !== 'chat') return;
    const el = chatMessagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tab, chatClientId, chatMessages.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (tab !== 'chat' || chatViewMode !== 'thread') {
      setMobileKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const syncViewport = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nextInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        setMobileKeyboardInset(nextInset > 6 ? nextInset : 0);
        const el = chatMessagesScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    };
    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, [tab, chatViewMode]);

  const reloadAgenda = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return;
    const agendaDay = day;
    const requestKey = `${agendaDay}|${opts?.silent ? 'silent' : 'full'}`;
    const nowTs = Date.now();
    if (agendaLoadBusyRef.current && agendaLoadLastKeyRef.current === requestKey && nowTs - agendaLoadLastAtRef.current < 12_000) return;
    agendaLoadBusyRef.current = true;
    agendaLoadLastKeyRef.current = requestKey;
    agendaLoadLastAtRef.current = nowTs;
    const reqSeq = ++agendaRequestSeqRef.current;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!opts?.silent) setAgendaLoading(true);
    if (!opts?.silent) setAgendaError('');
    try {
      const next = await fetchMobileAgenda(agendaDay);
      if (agendaRequestSeqRef.current !== reqSeq) return;
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsed = Math.max(0, Math.round(t1 - t0));
      const syncedAt = Date.now();
      const cacheKey = getAgendaCacheKey(agendaDay);
      if (cacheKey) {
        mobileAgendaMemoryCache.set(cacheKey, { at: syncedAt, payload: next });
        writeAgendaPayloadToSessionCache(cacheKey, next, syncedAt);
        if (mobileAgendaMemoryCache.size > MOBILE_AGENDA_CACHE_MAX_ENTRIES) {
          const keys = Array.from(mobileAgendaMemoryCache.keys());
          const overflow = mobileAgendaMemoryCache.size - MOBILE_AGENDA_CACHE_MAX_ENTRIES;
          for (let i = 0; i < overflow; i += 1) {
            if (keys[i]) mobileAgendaMemoryCache.delete(keys[i]!);
          }
        }
      }
      applyAgendaPayload(next, { syncAt: syncedAt, elapsedMs: elapsed, degraded: elapsed >= 1500 });
    } catch (e: any) {
      if (agendaRequestSeqRef.current !== reqSeq) return;
      setAgendaError(String(e?.message || 'Unable to load meetings'));
      setAgendaSyncDegraded(true);
      if (!opts?.silent) setAgendaPayload(null);
    } finally {
      if (agendaRequestSeqRef.current === reqSeq) agendaLoadBusyRef.current = false;
      if (agendaRequestSeqRef.current === reqSeq) setAgendaLoading(false);
    }
  }, [user, day, applyAgendaPayload, getAgendaCacheKey]);

  const reloadAgendaMonth = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return;
    const monthKey = displayMonth;
    const reqSeq = ++agendaMonthRequestSeqRef.current;
    if (!opts?.silent) setAgendaMonthLoading(true);
    try {
      const next = await fetchMobileAgendaMonth(monthKey);
      if (agendaMonthRequestSeqRef.current !== reqSeq) return;
      const cacheKey = getAgendaMonthCacheKey(monthKey);
      if (cacheKey) {
        mobileAgendaMonthMemoryCache.set(cacheKey, { at: Date.now(), payload: next });
      }
      applyAgendaMonthPayload(next);
    } catch {
      if (agendaMonthRequestSeqRef.current !== reqSeq) return;
      if (!opts?.silent) setAgendaMonthPayload(null);
    } finally {
      if (agendaMonthRequestSeqRef.current === reqSeq) setAgendaMonthLoading(false);
    }
  }, [user, displayMonth, getAgendaMonthCacheKey, applyAgendaMonthPayload]);

  const openMeetingDetail = (meeting: MobileAgendaMeeting) => {
    const p = (meeting as any).participantMatch || {};
    const key = buildCheckInKeyForParticipantMatch(meeting);
    const checked = !!((checkInMapByMeetingId[String(meeting.id)] || {})[key]);
    const { inProgress } = getMeetingTemporalState(meeting.startAt, meeting.endAt, Date.now());
    if (!p.remote && inProgress && !checked) {
      setMeetingCheckInPrompt(meeting);
      return;
    }
    setMeetingDetailOpen(meeting);
  };

  const handleMobileLogout = useCallback(async () => {
    setSettingsMenuOpen(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          MOBILE_LOGIN_STORAGE_KEY,
          JSON.stringify({
            username: rememberUsername ? String(loginUsername || '').trim().toLowerCase() : '',
            rememberUsername
          })
        );
      } catch {
        // ignore
      }
    }
    await logout();
    setTab('agenda');
    setChatViewMode('list');
    setChatClientId('');
    setChatMessages([]);
  }, [loginUsername, logout, rememberUsername]);

  const handleMobileLanguageChange = useCallback(
    async (lang: 'it' | 'en') => {
      if (!user || user.language === lang) {
        setSettingsMenuOpen(false);
        return;
      }
      try {
        setSettingsBusy(true);
        await updateMyProfile({ language: lang });
        const next = await fetchMe();
        setAuth(next);
        setNotice(lang === 'en' ? 'Language updated.' : 'Lingua aggiornata.');
        setSettingsMenuOpen(false);
      } catch {
        setNotice(lang === 'en' ? 'Language update failed.' : 'Aggiornamento lingua non riuscito.');
      } finally {
        setSettingsBusy(false);
      }
    },
    [setAuth, user]
  );

  useEffect(() => {
    if (!user) return;
    const warmed = warmAgendaFromMemoryCache(day);
    void reloadAgenda({ silent: warmed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, day, warmAgendaFromMemoryCache]);

  useEffect(() => {
    if (!user) return;
    const warmed = warmAgendaMonthFromMemoryCache(displayMonth);
    void reloadAgendaMonth({ silent: warmed });
  }, [user, displayMonth, warmAgendaMonthFromMemoryCache, reloadAgendaMonth]);

  const getChatOverviewCacheKey = useCallback(() => String(user?.id || '').trim(), [user?.id]);

  const applyChatOverviewPayload = useCallback((next: MobileChatOverviewPayload) => {
      const { channels, dmContacts, unreadMap, lastMessageMap, firstId } = parseMobileChatOverview(next, directMessageLabel);
      setChatClientChannels(channels);
      setChatDmContacts(dmContacts);
      setChatUnreadByClientId(unreadMap);
      setChatLastMessageByClientId((prev) => {
        const merged = { ...(prev || {}) } as Record<string, ChatMessage | null>;
        let changed = false;
        for (const [id, nextMessage] of Object.entries(lastMessageMap)) {
          const prevMessage = merged[id] || null;
          const sameId = String(prevMessage?.id || '') === String((nextMessage as any)?.id || '');
          const sameTs = Number(prevMessage?.createdAt || 0) === Number((nextMessage as any)?.createdAt || 0);
          if (sameId && sameTs) continue;
          merged[id] = nextMessage as ChatMessage | null;
          changed = true;
        }
        return changed ? merged : prev;
      });
      if (firstId) {
        setChatClientId((prev) => {
          const normalizedPrev = normalizeChatClientId(prev || '');
          return normalizedPrev || firstId;
        });
      }
    }, [directMessageLabel]);

  const warmChatOverviewFromCache = useCallback(() => {
    const cacheKey = getChatOverviewCacheKey();
    if (!cacheKey) return false;
    const cached = readMobileChatOverviewFromSessionCache(cacheKey);
    if (!cached) return false;
    applyChatOverviewPayload(cached.payload);
    chatOverviewLastSyncAtRef.current = Number(cached.at || Date.now());
    return true;
  }, [applyChatOverviewPayload, getChatOverviewCacheKey]);

  const hydrateChatThreadFromCache = useCallback((clientId: string) => {
    const normalizedId = normalizeChatClientId(clientId || '');
    const userId = String(user?.id || '').trim();
    if (!normalizedId || !userId) return false;
    const cached = readMobileChatThreadFromSessionCache(`${userId}::${normalizedId}`);
    if (!cached) return false;
    const recent = filterRecentMobileChatMessages(Array.isArray(cached.messages) ? cached.messages : []);
    if (!recent.length) return false;
    setChatMessages(recent);
    return true;
  }, [user?.id]);

  const meetings = useMemo(() => selectAgendaMeetings(agendaPayload), [agendaPayload]);
  const agendaMonthDaysWithMeetings = useMemo(() => {
    if (String(agendaMonthPayload?.month || '') !== displayMonth) return {} as Record<string, number>;
    return (agendaMonthPayload?.days || {}) as Record<string, number>;
  }, [agendaMonthPayload, displayMonth]);

  const meetingsForSelectedRoom = useMemo(() => filterMeetingsForRoom(meetings, selectedRoomId), [meetings, selectedRoomId]);

  const now = Date.now();
  const hasInProgressMeeting = useMemo(
    () => meetings.some((m) => Number(m.startAt) <= now && now < Number(m.endAt)),
    [meetings, now]
  );
  const syncBadge = useMemo(
    () =>
      computeSyncBadge(agendaLoading, lastAgendaSyncAt, agendaSyncDegraded, Date.now(), {
        syncing: tr({ it: 'Sincronizzazione…', en: 'Syncing…' }),
        slow: tr({ it: 'Connessione lenta', en: 'Slow connection' }),
        synced: tr({ it: 'Sincronizzato', en: 'Synced' })
      }),
    [agendaLoading, lastAgendaSyncAt, agendaSyncDegraded, tr]
  );

  useEffect(() => {
    if (!displayMonth || !day.startsWith(displayMonth)) return;
    setAgendaMonthPayload((prev) => {
      if (!prev || String(prev.month || '') !== displayMonth) return prev;
      const nextCount = meetings.length;
      const prevCount = Number(prev.days?.[day] || 0);
      if (prevCount === nextCount) return prev;
      const nextDays = { ...(prev.days || {}) } as Record<string, number>;
      if (nextCount > 0) nextDays[day] = nextCount;
      else delete nextDays[day];
      return { ...prev, days: nextDays };
    });
  }, [displayMonth, day, meetings.length]);

  const totalChatUnread = useMemo(
    () => Object.values(chatUnreadByClientId || {}).reduce((acc, n) => acc + Math.max(0, Number(n || 0)), 0),
    [chatUnreadByClientId]
  );
  const chatClientOptions = useMemo(
    () => buildMobileChatClientOptions(chatClientChannels, chatClientId, chatDmContacts, directMessageLabel),
    [chatClientChannels, chatClientId, chatDmContacts, directMessageLabel]
  );

  const filteredChatClientOptions = useMemo(
    () => sortFilterMobileChatClientOptions(chatClientOptions, chatSearch, chatLastMessageByClientId),
    [chatClientOptions, chatSearch, chatLastMessageByClientId]
  );

  const selectedChatClient = useMemo(() => {
    const normalizedId = normalizeChatClientId(chatClientId || '');
    if (!normalizedId) return null;
    return chatClientOptions.find((c) => normalizeChatClientId(c.id) === normalizedId) || null;
  }, [chatClientId, chatClientOptions]);

  const dmNameByUserId = useMemo(() => buildDmNameByUserId(chatDmContacts), [chatDmContacts]);

  const selectedChatClientName = useMemo(
    () =>
      resolveSelectedChatClientName(selectedChatClient?.name, chatClientId, dmNameByUserId, user?.id, {
        selectChat: tr({ it: 'Seleziona una chat', en: 'Select a chat' }),
        directMessage: tr({ it: 'Messaggio diretto', en: 'Direct message' })
      }),
    [selectedChatClient?.name, chatClientId, dmNameByUserId, tr, user?.id]
  );

  const selectedChatClientLogoUrl =
    selectedChatClient && !chatClientLogoFailedById[String(selectedChatClient.id || '')] ? String((selectedChatClient as any).logoUrl || '') : '';
  const selectedChatClientAvatarUrl =
    selectedChatClient && !chatClientLogoFailedById[String(selectedChatClient.id || '')] ? String((selectedChatClient as any).avatarUrl || '') : '';

  const selectedChatClientInitials = useMemo(() => computeChatInitials(selectedChatClientName), [selectedChatClientName]);

  const chatMessagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of chatMessages) map.set(String(m.id || ''), m);
    return map;
  }, [chatMessages]);

  const chatReplyTarget = useMemo(
    () => (chatReplyToId ? chatMessagesById.get(chatReplyToId) || null : null),
    [chatReplyToId, chatMessagesById]
  );

  const getChatMessageAuthorName = useCallback(
    (msg: ChatMessage) =>
      resolveChatMessageAuthorName(msg, user, dmNameByUserId, {
        me: tr({ it: 'Io', en: 'Me' }),
        user: tr({ it: 'Utente', en: 'User' })
      }),
    [dmNameByUserId, tr, user]
  );

  useEffect(() => {
    chatUnreadByClientIdRef.current = chatUnreadByClientId || {};
  }, [chatUnreadByClientId]);

  useEffect(() => {
    if (!user) return;
    const intervalMs = tab === 'checkin' ? 2_500 : hasInProgressMeeting ? 5_000 : tab === 'agenda' ? 8_000 : 15_000;
    const timer = window.setInterval(() => {
      if (!isPageVisible()) return;
      void reloadAgenda({ silent: true });
    }, intervalMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, day, tab, hasInProgressMeeting, reloadAgenda]);

  const reloadMobileChatOverview = useCallback(
    async (opts?: { preferCache?: boolean }) => {
      if (!user) return;
      if (opts?.preferCache && warmChatOverviewFromCache()) return;
      if (chatOverviewLoadBusyRef.current) return;
      chatOverviewLoadBusyRef.current = true;
      try {
        const payload = await fetchMobileChatOverview();
        const syncedAt = Date.now();
        applyChatOverviewPayload(payload);
        const cacheKey = getChatOverviewCacheKey();
        if (cacheKey) writeMobileChatOverviewToSessionCache(cacheKey, payload, syncedAt);
        chatOverviewLastSyncAtRef.current = syncedAt;
      } catch {
        // keep silent on mobile
      } finally {
        chatOverviewLoadBusyRef.current = false;
      }
    },
    [applyChatOverviewPayload, getChatOverviewCacheKey, user, warmChatOverviewFromCache]
  );

  const loadChat = useCallback(async (clientId: string, silent = false) => {
    const cid = normalizeChatClientId(clientId || '');
    if (!cid || !user) return;
    const requestKey = `${cid}|${silent ? 'silent' : 'full'}`;
    const nowTs = Date.now();
    if (chatLoadBusyRef.current && chatLoadLastKeyRef.current === requestKey && nowTs - chatLoadLastAtRef.current < 8_000) return;
    chatLoadBusyRef.current = true;
    chatLoadLastKeyRef.current = requestKey;
    chatLoadLastAtRef.current = nowTs;
    const reqSeq = ++chatLoadSeqRef.current;
    if (!silent) {
      setChatBusy(true);
      if (!hydrateChatThreadFromCache(cid)) setChatMessages([]);
    }
    setChatError('');
    try {
      const res = await fetchChatMessages(cid, { limit: silent ? 120 : 200 });
      if (chatLoadSeqRef.current !== reqSeq) return;
      const nextMessages = filterRecentMobileChatMessages(res.messages || []);
      setChatMessages(nextMessages);
      writeMobileChatThreadToSessionCache(`${String(user.id || '').trim()}::${cid}`, nextMessages, Date.now());
      const nextLast = nextMessages.length ? nextMessages[nextMessages.length - 1] || null : null;
      setChatLastMessageByClientId((prev) => {
        const prevLast = prev[cid] || null;
        const sameId = String(prevLast?.id || '') === String(nextLast?.id || '');
        const sameTs = Number(prevLast?.createdAt || 0) === Number(nextLast?.createdAt || 0);
        if (sameId && sameTs) return prev;
        return { ...prev, [cid]: nextLast };
      });
      const unreadCount = Number(chatUnreadByClientIdRef.current[cid] || 0);
      if (nextMessages.length && unreadCount > 0) {
        void markChatRead(cid).catch(() => {});
        setChatUnreadByClientId((prev) => {
          if (!prev[cid]) return prev;
          return { ...prev, [cid]: 0 };
        });
        scheduleWhenIdle(() => {
          void reloadMobileChatOverview();
        }, 500);
      }
    } catch (e: any) {
      if (chatLoadSeqRef.current !== reqSeq) return;
      setChatError(String(e?.message || 'Unable to load chat'));
    } finally {
      if (chatLoadSeqRef.current === reqSeq) chatLoadBusyRef.current = false;
      if (chatLoadSeqRef.current === reqSeq) setChatBusy(false);
    }
  }, [hydrateChatThreadFromCache, reloadMobileChatOverview, user]);

  useEffect(() => {
    if (!user) return;
    const warmed = warmChatOverviewFromCache();
    const cancelIdleBoot = scheduleWhenIdle(() => {
      void reloadMobileChatOverview({ preferCache: warmed });
    }, tab === 'chat' ? 250 : 900);
    const timer = window.setInterval(() => {
      if (!isPageVisible()) return;
      scheduleWhenIdle(() => {
        void reloadMobileChatOverview();
      }, tab === 'chat' ? 250 : 800);
    }, tab === 'chat' ? 18000 : 30000);
    return () => {
      cancelIdleBoot();
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab, reloadMobileChatOverview, warmChatOverviewFromCache]);

  useEffect(() => {
    if (!user || tab !== 'chat') return;
    void reloadMobileChatOverview({ preferCache: true });
    if (!chatClientId || chatViewMode !== 'thread') return;
    loadChat(chatClientId);
    const timer = window.setInterval(() => {
      if (!isPageVisible()) return;
      void loadChat(chatClientId, true);
      if (Date.now() - chatOverviewLastSyncAtRef.current > 18_000) void reloadMobileChatOverview();
    }, 7000);
    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, chatClientId, chatViewMode, tab, loadChat, reloadMobileChatOverview]);

  useEffect(() => {
    if (tab !== 'chat' || chatViewMode !== 'thread') return;
    const current = normalizeChatClientId(chatClientId || '');
    if (!current) return;
    if (lastOpenedChatClientIdRef.current && lastOpenedChatClientIdRef.current !== current) {
      setChatReplyToId(null);
      setChatEditingId(null);
      setChatEditingText('');
      setChatError('');
    }
    lastOpenedChatClientIdRef.current = current;
  }, [tab, chatViewMode, chatClientId]);

  useEffect(() => {
    const onVisible = () => {
      if (!isPageVisible() || !user) return;
      const nowTs = Date.now();
      if (nowTs - mobileVisibilitySyncAtRef.current < 1500) return;
      mobileVisibilitySyncAtRef.current = nowTs;
      void reloadAgenda({ silent: true });
      if (tab === 'chat' && chatClientId) void loadChat(chatClientId, true);
      if (nowTs - chatOverviewLastSyncAtRef.current > 10_000) {
        scheduleWhenIdle(() => {
          void reloadMobileChatOverview();
        }, 450);
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab, chatClientId, day, reloadAgenda, loadChat, reloadMobileChatOverview]);

  useEffect(() => {
    if (!chatClientOptions.length) {
      if (chatClientId) setChatClientId('');
      return;
    }
    const currentId = normalizeChatClientId(chatClientId || '');
    const currentExists = chatClientOptions.some((c) => normalizeChatClientId(c.id) === currentId);
    if (!currentExists) setChatClientId(chatClientOptions[0]!.id);
  }, [chatClientOptions, chatClientId]);

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      await login(loginUsername.trim().toLowerCase(), loginPassword, otpRequired ? loginOtp.trim() : undefined);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            MOBILE_LOGIN_STORAGE_KEY,
            JSON.stringify({
              username: rememberUsername ? String(loginUsername || '').trim().toLowerCase() : '',
              rememberUsername
            })
          );
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      if (err instanceof MFARequiredError || err?.name === 'MFARequiredError') {
        setOtpRequired(true);
      } else {
        setLoginError(String(err?.message || tr({ it: 'Accesso non riuscito', en: 'Login failed' })));
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const sendMessage = async () => {
    const text = String(chatInput || '').trim();
    if ((!text && !chatPendingAttachments.length) || !chatClientId) return;
    try {
      setChatBusy(true);
      await sendChatMessage(chatClientId, text, chatPendingAttachments.map((a) => ({ name: a.name, dataUrl: a.dataUrl })), {
        replyToId: chatReplyToId || undefined
      });
      setChatInput('');
      setChatReplyToId(null);
      setChatPendingAttachments([]);
      await loadChat(chatClientId, true);
    } catch (e: any) {
      setChatError(String(e?.message || tr({ it: 'Impossibile inviare il messaggio', en: 'Unable to send message' })));
    } finally {
      setChatBusy(false);
    }
  };

  const handleChatFiles = async (files: FileList | null) => {
    const list = Array.from(files || []).slice(0, 10);
    if (!list.length) return;
    try {
      setChatAttachmentsBusy(true);
      setNotice(tr({ it: 'Preparazione allegati in corso...', en: 'Preparing attachments...' }));
      const encoded: Array<{ name: string; dataUrl: string; mime?: string }> = [];
      for (const file of list) {
        const prepared = await compressImageAttachment(file);
        if (!String(prepared.dataUrl || '').startsWith('data:')) continue;
        encoded.push(prepared);
      }
      if (encoded.length) setChatPendingAttachments((prev) => [...prev, ...encoded].slice(0, 10));
    } catch {
      setChatError(tr({ it: 'Impossibile leggere allegato', en: 'Unable to read attachment' }));
    } finally {
      setChatAttachmentsBusy(false);
    }
  };

  const toggleStar = async (msg: ChatMessage) => {
    try {
      setChatActionBusyId(msg.id);
      await starChatMessage(msg.id, !Array.isArray(msg.starredBy) || !msg.starredBy.includes(String(user?.id || '')));
      await loadChat(chatClientId, true);
    } catch (e: any) {
      setChatError(String(e?.message || tr({ it: 'Impossibile aggiornare il preferito', en: 'Unable to update star' })));
    } finally {
      setChatActionBusyId(null);
    }
  };

  const addReaction = async (msgId: string, emoji: string) => {
    try {
      setChatActionBusyId(msgId);
      await reactChatMessage(msgId, emoji);
      setChatReactionForId(null);
      await loadChat(chatClientId, true);
    } catch (e: any) {
      setChatError(String(e?.message || tr({ it: 'Impossibile aggiungere la reazione', en: 'Unable to react' })));
    } finally {
      setChatActionBusyId(null);
    }
  };

  const startEditChatMessage = (msg: ChatMessage) => {
    if (msg.deleted) return;
    if (!user?.id || !canEditChatMessage(msg, String(user.id))) return;
    setChatEditingId(msg.id);
    setChatEditingText(msg.text || '');
    setChatReplyToId(null);
  };

  const saveEditedChatMessage = async () => {
    const id = String(chatEditingId || '').trim();
    const text = String(chatEditingText || '').trim();
    if (!id || !text) return;
    try {
      setChatBusy(true);
      await editChatMessage(id, text);
      setChatEditingId(null);
      setChatEditingText('');
      await loadChat(chatClientId, true);
    } catch (e: any) {
      setChatError(String(e?.message || tr({ it: 'Impossibile modificare il messaggio', en: 'Unable to edit message' })));
    } finally {
      setChatBusy(false);
    }
  };

  const removeChatMessage = async (msg: ChatMessage) => {
    const allowAll = !!user?.id && canDeleteChatForAll(msg, String(user.id));
    setChatDeletePrompt({ messageId: String(msg.id), allowAll });
  };

  const confirmChatDeleteMode = async (mode: 'me' | 'all') => {
    const pending = chatDeletePrompt;
    if (!pending?.messageId) return;
    try {
      setChatActionBusyId(pending.messageId);
      await deleteChatMessage(pending.messageId, mode);
      await loadChat(chatClientId, true);
    } catch (e: any) {
      setChatError(String(e?.message || tr({ it: 'Impossibile eliminare il messaggio', en: 'Unable to delete message' })));
    } finally {
      setChatActionBusyId(null);
      setChatDeletePrompt(null);
    }
  };

  const clearCurrentChat = async () => {
    if (!chatClientId) return;
    setMobileConfirm({
      title: tr({ it: 'Svuotare la chat selezionata?', en: 'Clear the selected chat?' }),
      description: tr({ it: 'I messaggi verranno rimossi solo per il tuo utente mobile.', en: 'Messages will be removed only for your mobile user.' }),
      confirmLabel: tr({ it: 'Svuota chat', en: 'Clear chat' }),
      cancelLabel: tr({ it: 'Annulla', en: 'Cancel' }),
      onConfirm: async () => {
        try {
          setChatBusy(true);
          await clearChat(chatClientId);
          await loadChat(chatClientId, true);
        } catch (e: any) {
          setChatError(String(e?.message || tr({ it: 'Impossibile svuotare la chat', en: 'Unable to clear chat' })));
        } finally {
          setChatBusy(false);
          setMobileConfirm(null);
        }
      }
    });
  };

  const stopVoiceRecording = async () => {
    try {
      const recorder = voiceMediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch {
      // ignore
    }
  };

  const startVoiceRecording = async () => {
    if (voiceRecording) return;
    setVoiceRecordError('');
    try {
      if (!window.isSecureContext && !/^localhost$/i.test(String(window.location.hostname || ''))) {
        setVoiceRecordError(tr({ it: 'Il microfono richiede una connessione HTTPS (o localhost).', en: 'Microphone access requires HTTPS (or localhost).' }));
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceRecordError(tr({ it: 'Questo browser non supporta l’accesso al microfono.', en: 'This browser does not support microphone access.' }));
        return;
      }
      try {
        const permissionsApi: any = (navigator as any).permissions;
        if (permissionsApi?.query) {
          await permissionsApi.query({ name: 'microphone' as PermissionName }).catch(() => null);
        }
      } catch {
        // ignore permissions api support issues
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      voiceStreamRef.current = stream;
      const mimeCandidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const mimeType = mimeCandidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      voiceChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const chunks = voiceChunksRef.current.slice();
        voiceChunksRef.current = [];
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        try {
          if (chunks.length) {
            const blob = new Blob(chunks, { type: finalMime });
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(String(fr.result || ''));
              fr.onerror = () => reject(new Error('read-failed'));
              fr.readAsDataURL(blob);
            });
            const ext = finalMime.includes('mp4') ? 'm4a' : finalMime.includes('ogg') ? 'ogg' : 'webm';
            const stamp = new Date();
            const name = `voice-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}-${String(
              stamp.getHours()
            ).padStart(2, '0')}${String(stamp.getMinutes()).padStart(2, '0')}${String(stamp.getSeconds()).padStart(2, '0')}.${ext}`;
            setChatPendingAttachments((prev) => [...prev, { name, dataUrl, mime: finalMime }]);
          }
        } catch {
          setVoiceRecordError(tr({ it: 'Impossibile elaborare il messaggio vocale', en: 'Unable to process the voice message' }));
        } finally {
          setVoiceRecording(false);
          try {
            voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
          } catch {}
          voiceStreamRef.current = null;
          voiceMediaRecorderRef.current = null;
        }
      };
      voiceMediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceRecording(true);
    } catch (err: any) {
      const name = String(err?.name || '');
      if (name === 'NotAllowedError' || name === 'SecurityError') setVoiceRecordError(tr({ it: 'Autorizza il microfono nel browser e riprova.', en: 'Allow microphone access in the browser and try again.' }));
      else if (name === 'NotFoundError') setVoiceRecordError(tr({ it: 'Nessun microfono disponibile sul dispositivo.', en: 'No microphone available on this device.' }));
      else setVoiceRecordError(tr({ it: 'Microfono non disponibile', en: 'Microphone unavailable' }));
      setVoiceRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      try {
        if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state !== 'inactive') voiceMediaRecorderRef.current.stop();
      } catch {}
      try {
        voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  const applyScannedRoomId = (roomId: string) => {
    const rid = String(roomId || '').trim();
    if (!rid) return;
    setSelectedRoomId(rid);
    setTab('checkin');
    setScannerOpen(false);
    setScannerError('');
    setPendingQrAutoCheckInRoomId(rid);
    setNotice(tr({ it: 'QR kiosk acquisito • verifico il check-in', en: 'Kiosk QR captured • verifying check-in' }));
  };

  const detectQrFromImageFile = async (file: File) => {
    if (!file) return;
    setScannerError('');
    setScannerImageBusy(true);
    try {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        setScannerError(tr({ it: 'Scansione da immagine non supportata su questo browser. Usa Incolla link oppure la fotocamera.', en: 'Image QR scanning is not supported in this browser. Use Paste link or the camera instead.' }));
        return;
      }
      const bitmap = await createImageBitmap(file);
      try {
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const results = await detector.detect(bitmap);
        const raw = String(results?.[0]?.rawValue || '').trim();
        const rid = parseRoomIdFromQrPayload(raw);
        if (!rid) {
          setScannerError(tr({ it: 'QR non riconosciuto nell’immagine selezionata', en: 'QR code not recognized in the selected image' }));
          return;
        }
        applyScannedRoomId(rid);
      } finally {
        try {
          (bitmap as any)?.close?.();
        } catch {
          // ignore
        }
      }
    } catch {
      setScannerError(tr({ it: 'Impossibile leggere l’immagine selezionata', en: 'Unable to read the selected image' }));
    } finally {
      setScannerImageBusy(false);
    }
  };

  const pasteScannerLinkFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        setScannerError(tr({ it: 'Clipboard non supportata. Incolla manualmente il link del kiosk.', en: 'Clipboard access is not supported. Paste the kiosk link manually.' }));
        return;
      }
      const text = await navigator.clipboard.readText();
      setScannerManualValue(text || '');
      const rid = parseRoomIdFromQrPayload(text || '');
      if (rid) applyScannedRoomId(rid);
    } catch {
      setScannerError(tr({ it: 'Impossibile leggere dagli appunti', en: 'Unable to read from the clipboard' }));
    }
  };

  useEffect(() => {
    if (!scannerOpen || !scannerSupported) return;
    let cancelled = false;
    const sessionId = Date.now();
    scannerSessionRef.current = sessionId;
    const start = async () => {
      try {
        setScannerDetecting(true);
        setScannerError('');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        scannerStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream as any;
          await videoRef.current.play().catch(() => {});
        }
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || scannerSessionRef.current !== sessionId) return;
          try {
            const video = videoRef.current;
            if (video && video.readyState >= 2) {
              const results = await detector.detect(video);
              const raw = String(results?.[0]?.rawValue || '').trim();
              if (raw) {
                const rid = parseRoomIdFromQrPayload(raw);
                if (rid) {
                  applyScannedRoomId(rid);
                  return;
                }
                setScannerError(tr({ it: 'QR non riconosciuto (nessun roomId)', en: 'QR code not recognized (missing roomId)' }));
              }
            }
          } catch {
            // ignore transient detector errors
          }
          scannerRafRef.current = window.setTimeout(tick, 260) as any;
        };
        tick();
      } catch {
        setScannerError(tr({ it: 'Impossibile aprire la fotocamera', en: 'Unable to open the camera' }));
      } finally {
        setScannerDetecting(false);
      }
    };
    start();
    return () => {
      cancelled = true;
      if (scannerRafRef.current) {
        window.clearTimeout(scannerRafRef.current as any);
        scannerRafRef.current = null;
      }
      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach((t) => t.stop());
        scannerStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen, scannerSupported]);

  useEffect(() => {
    if (!scannerOpen || scannerSupported) return;
    const t = window.setTimeout(() => {
      try {
        scannerFileInputRef.current?.click();
      } catch {
        // ignore
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [scannerOpen, scannerSupported]);

  const doMobileCheckIn = async (meeting: MobileAgendaMeeting, checked: boolean) => {
    try {
      const res = await mobileCheckInMeeting(String(meeting.id), checked);
      setCheckInMapByMeetingId((prev) => ({ ...prev, [String(meeting.id)]: res.checkInMap || {} }));
      setCheckInTsByMeetingId((prev) => ({ ...prev, [String(meeting.id)]: res.checkInTimestamps || {} }));
      setNotice(
        checked
          ? tr({ it: `Check-in OK • ${res.participantName}`, en: `Check-in OK • ${res.participantName}` })
          : tr({ it: `Check-in rimosso • ${res.participantName}`, en: `Check-in removed • ${res.participantName}` })
      );
      reloadAgenda({ silent: true });
    } catch (e: any) {
      setNotice(String(e?.message || tr({ it: 'Errore check-in', en: 'Check-in error' })));
    }
  };

  const loadMeetingNotes = useCallback(
    async (meetingId: string) => {
      const id = String(meetingId || '').trim();
      if (!id) return;
      setMeetingNotesLoading(true);
      setMeetingNotesError('');
      try {
        const payload = await fetchMeetingNotes(id);
        const list = Array.isArray(payload.notes) ? payload.notes : [];
        setMeetingNotesList(list);
        setMeetingNotesParticipants(Array.isArray(payload.participants) ? payload.participants : []);
        const mine = list.find((n) => String(n.authorUserId || '') === String(user?.id || '')) || null;
        const nextId = mine ? String(mine.id) : null;
        const nextTitle = String(mine?.title || '').trim();
        const nextText = String(mine?.contentText || '');
        const nextShared = !!mine?.shared;
        setMeetingMyNoteId(nextId);
        setMeetingMyNoteTitle(nextTitle);
        setMeetingMyNoteText(nextText);
        setMeetingMyNoteShared(nextShared);
        setMeetingMyNoteInitial({ id: nextId, title: nextTitle, text: nextText, shared: nextShared });
        setMeetingNotesDirty(false);
      } catch (e: any) {
        setMeetingNotesError(String(e?.message || tr({ it: 'Impossibile caricare le note', en: 'Unable to load notes' })));
        setMeetingNotesList([]);
        setMeetingNotesParticipants([]);
        setMeetingMyNoteId(null);
        setMeetingMyNoteTitle('');
        setMeetingMyNoteText('');
        setMeetingMyNoteShared(false);
        setMeetingMyNoteInitial({ id: null, title: '', text: '', shared: false });
        setMeetingNotesDirty(false);
      } finally {
        setMeetingNotesLoading(false);
      }
    },
    [user?.id]
  );

  const saveMeetingSimpleNote = useCallback(async () => {
    const meetingId = String(meetingNotesOpen?.id || meetingDetailOpen?.id || '').trim();
    if (!meetingId) return;
    setMeetingNotesSaving(true);
    setMeetingNotesError('');
    try {
      await upsertMeetingNote(meetingId, {
        ...(meetingMyNoteId ? { id: meetingMyNoteId } : {}),
        title: String(meetingMyNoteTitle || '').trim() || tr({ it: 'Nota mobile', en: 'Mobile note' }),
        contentText: String(meetingMyNoteText || ''),
        contentHtml: '',
        contentLexical: '',
        shared: !!meetingMyNoteShared
      });
      await loadMeetingNotes(meetingId);
      setNotice(tr({ it: 'Appunto salvato', en: 'Note saved' }));
    } catch (e: any) {
      setMeetingNotesError(String(e?.message || tr({ it: 'Impossibile salvare la nota', en: 'Unable to save note' })));
      setNotice(String(e?.message || tr({ it: 'Impossibile salvare la nota', en: 'Unable to save note' })));
    } finally {
      setMeetingNotesSaving(false);
    }
  }, [meetingNotesOpen?.id, meetingDetailOpen?.id, meetingMyNoteId, meetingMyNoteShared, meetingMyNoteText, meetingMyNoteTitle, loadMeetingNotes]);

  useEffect(() => {
    if (!meetingNotesOpen?.id) return;
    void loadMeetingNotes(String(meetingNotesOpen.id));
  }, [meetingNotesOpen?.id, loadMeetingNotes]);

  useEffect(() => {
    if (!meetingNotesOpen) {
      setMeetingNotesDirty(false);
      return;
    }
    setMeetingNotesDirty(
      String(meetingMyNoteTitle || '') !== String(meetingMyNoteInitial.title || '') ||
        String(meetingMyNoteText || '') !== String(meetingMyNoteInitial.text || '') ||
        !!meetingMyNoteShared !== !!meetingMyNoteInitial.shared
    );
  }, [meetingNotesOpen, meetingMyNoteTitle, meetingMyNoteText, meetingMyNoteShared, meetingMyNoteInitial]);

  const requestCloseMeetingNotes = useCallback(() => {
    if (!meetingNotesDirty) {
      setMeetingNotesOpen(null);
      setMeetingSharedNotePreview(null);
      return;
    }
    setMobileConfirm({
      title: tr({ it: 'Chiudere senza salvare?', en: 'Close without saving?' }),
      description: tr({ it: 'Ci sono modifiche non salvate nelle note del meeting.', en: 'There are unsaved changes in the meeting notes.' }),
      confirmLabel: tr({ it: 'Chiudi senza salvare', en: 'Close without saving' }),
      cancelLabel: tr({ it: 'Annulla', en: 'Cancel' }),
      onConfirm: () => {
        setMeetingNotesDirty(false);
        setMeetingNotesOpen(null);
        setMeetingSharedNotePreview(null);
        setMobileConfirm(null);
      }
    });
  }, [meetingNotesDirty]);

  useEffect(() => {
    if (!pendingQrAutoCheckInRoomId || qrAutoCheckInBusy || !user) return;
    const targetRoomId = String(pendingQrAutoCheckInRoomId || '').trim();
    if (!targetRoomId) return;
    const today = nowDay();
    if (day !== today) {
      setDay(today);
      return;
    }
    if (!agendaPayload) {
      void reloadAgenda({ silent: true });
      return;
    }
    const nowTs = Date.now();
    const candidates = (Array.isArray(agendaPayload.meetings) ? agendaPayload.meetings : []).filter((m) => {
      const roomMatch = String((m as any).roomId || '') === targetRoomId;
      const inProgress = Number((m as any).startAt || 0) <= nowTs && nowTs < Number((m as any).endAt || 0);
      const p = (m as any).participantMatch || null;
      return roomMatch && inProgress && !!p && !p.remote;
    });
    if (!candidates.length) {
      setPendingQrAutoCheckInRoomId(null);
      setNotice(tr({ it: 'Nessun meeting in corso per il tuo utente in questa sala', en: 'No meeting in progress for your user in this room' }));
      return;
    }
    const meeting = candidates[0]!;
    const key = buildCheckInKeyForParticipantMatch(meeting);
    const alreadyChecked = !!((checkInMapByMeetingId[String(meeting.id)] || {})[key]);
    if (alreadyChecked) {
      setPendingQrAutoCheckInRoomId(null);
      setNotice(tr({ it: 'Check-in già registrato per questa riunione', en: 'Check-in already recorded for this meeting' }));
      return;
    }
    setQrAutoCheckInBusy(true);
    void doMobileCheckIn(meeting, true)
      .finally(() => {
        setQrAutoCheckInBusy(false);
        setPendingQrAutoCheckInRoomId(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQrAutoCheckInRoomId, qrAutoCheckInBusy, user, day, agendaPayload, checkInMapByMeetingId, tr]);

  const tabBtn = (key: MobileTab, label: string, Icon: any) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        setTab(key);
        if (key === 'chat') {
          setChatViewMode('list');
          void reloadMobileChatOverview({ preferCache: true });
        }
      }}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
        tab === key ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-700'
      }`}
      title={label}
    >
      <span className="relative inline-flex">
        <Icon size={16} />
        {key === 'chat' && totalChatUnread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-rose-500" />
        ) : null}
      </span>
      {label}
    </button>
  );

  if (!user) {
    return (
      <div
        className={`min-h-screen p-4 ${shellClass}`}
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 16px)',
          paddingRight: 'calc(env(safe-area-inset-right, 0px) + 16px)'
        }}
      >
        <div className={`mx-auto max-w-md rounded-3xl border p-5 backdrop-blur ${loginCardClass}`}>
          <div className="flex items-center gap-3">
            <img
              src="/plixmap-logo.png"
              alt="Plixmap"
              className={`h-12 w-12 rounded-2xl border object-cover ${isDayTheme ? 'border-slate-200' : 'border-white/10'}`}
            />
            <div>
              <div className={`text-xs uppercase tracking-[0.18em] ${mutedTextClass}`}>Plixmap Mobile</div>
              <div className="text-xl font-semibold">{tr({ it: 'Accesso', en: 'Sign in' })}</div>
            </div>
          </div>
          <form className="mt-5 space-y-3" onSubmit={submitLogin}>
            <input
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${inputClass}`}
              placeholder={tr({ it: 'Utente', en: 'Username' })}
              autoComplete="username"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
            />
            <input
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${inputClass}`}
              placeholder={tr({ it: 'Password', en: 'Password' })}
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            {otpRequired ? (
              <input
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${inputClass}`}
                placeholder={tr({ it: 'Codice MFA', en: 'MFA code' })}
                inputMode="numeric"
                value={loginOtp}
              onChange={(e) => setLoginOtp(e.target.value)}
            />
          ) : null}
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isDayTheme ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-black/10 text-slate-300'}`}>
            <input type="checkbox" checked={rememberUsername} onChange={(e) => setRememberUsername(e.target.checked)} />
            {tr({ it: 'Ricorda utente', en: 'Remember username' })}
          </label>
          {loginError ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{loginError}</div> : null}
            <button
              type="submit"
              disabled={loginBusy || !loginUsername.trim() || !loginPassword.trim() || (otpRequired && !loginOtp.trim())}
              className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {loginBusy ? tr({ it: 'Accesso…', en: 'Signing in…' }) : tr({ it: 'Entra', en: 'Sign in' })}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const linkedMissing = !!agendaError && /not linked/i.test(agendaError);

  return <MobileAppPageBody {...{ addReaction, agendaError, agendaLoading, agendaMonthDaysWithMeetings, agendaMonthLoading, agendaPayload, applyScannedRoomId, calendarActionButtonClass, calendarCardClass, calendarCells, calendarDayButtonBaseClass, calendarInputClass, calendarNavButtonClass, calendarWeekdayLabels, chatActionBusyId, chatAttachmentsBusy, chatBusy, chatClientId, chatClientLogoFailedById, chatClientOptions, chatDeletePrompt, chatEditingId, chatEditingText, chatError, chatFileInputRef, chatInput, chatInputRef, chatLastMessageByClientId, chatMessages, chatMessagesById, chatMessagesScrollRef, chatPendingAttachments, chatReactionForId, chatReplyTarget, chatSearch, chatUnreadByClientId, chatViewMode, checkedLabel, checkInInactiveLabel, checkInMapByMeetingId, checkInOkLabel, checkInPrefixLabel, checkInTsByMeetingId, clearCurrentChat, confirmChatDeleteMode, day, detectQrFromImageFile, directMessageLabel, displayMonth, doMobileCheckIn, emptyAgendaClass, filteredChatClientOptions, frameClass, getChatMessageAuthorName, getMeetingTemporalState, getMeetingTimePhaseBadgeLabel, handleChatFiles, handleMobileLanguageChange, handleMobileLogout, hydrateChatThreadFromCache, isDayTheme, lastAgendaSyncAt, lastAgendaSyncMs, linkedMissing, locale, meetingCheckInPrompt, meetingDetailOpen, meetingLabel, meetingMyNoteShared, meetingMyNoteText, meetingMyNoteTitle, meetingNotesDirty, meetingNotesError, meetingNotesList, meetingNotesLoading, meetingNotesOpen, meetingNotesParticipants, meetingNotesSaving, meetings, meetingsForSelectedRoom, meetingSharedNotePreview, mobileConfirm, mobileKeyboardInset, mutedTextClass, noMessagesLabel, notice, noticeClass, now, onSiteUpperLabel, openMeetingDetail, optionalShortLabel, pasteScannerLinkFromClipboard, reloadAgenda, reloadAgendaMonth, remoteShortLabel, removeChatMessage, requestCloseMeetingNotes, saveEditedChatMessage, saveMeetingSimpleNote, scannerDetecting, scannerError, scannerFileInputRef, scannerImageBusy, scannerManualValue, scannerOpen, scannerSupported, selectedChatClient, selectedChatClientAvatarUrl, selectedChatClientInitials, selectedChatClientLogoUrl, selectedChatClientName, selectedRoomId, sendMessage, setChatClientId, setChatClientLogoFailedById, setChatDeletePrompt, setChatEditingId, setChatEditingText, setChatError, setChatInput, setChatMessages, setChatPendingAttachments, setChatReactionForId, setChatReplyToId, setChatSearch, setChatViewMode, setDay, setMeetingCheckInPrompt, setMeetingDetailOpen, setMeetingMyNoteShared, setMeetingMyNoteText, setMeetingMyNoteTitle, setMeetingNotesOpen, setMeetingSharedNotePreview, setMobileConfirm, setMobileTheme, setScannerError, setScannerManualValue, setScannerOpen, setSelectedRoomId, setSettingsMenuOpen, settingsBusy, settingsMenuOpen, settingsMenuRef, shellClass, startEditChatMessage, startVoiceRecording, stopVoiceRecording, subtlePanelClass, syncBadge, tab, tabBtn, toggleStar, tr, user, videoRef, voiceRecordError, voiceRecording }} />;
};

export default MobileAppPage;
