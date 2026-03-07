import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Cog,
  Eraser,
  Globe,
  LogOut,
  MessageSquare,
  Mic,
  Moon,
  Pause,
  Play,
  Square,
  Paperclip,
  Pencil,
  QrCode,
  RefreshCcw,
  Reply,
  ScanLine,
  Send,
  NotebookPen,
  SmilePlus,
  Smartphone,
  Star,
  Sun,
  Trash2,
  X
} from 'lucide-react';
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
import ConfirmDialog from '../ui/ConfirmDialog';

type MobileTab = 'agenda' | 'chat' | 'checkin';
type MobileChatViewMode = 'list' | 'thread';
type MobileConfirmState = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

const MOBILE_LOGIN_STORAGE_KEY = 'plixmap:mobile:loginPrefs';
const MOBILE_AGENDA_CACHE_TTL_MS = 45_000;
const MOBILE_AGENDA_CACHE_MAX_ENTRIES = 12;
const MOBILE_AGENDA_MONTH_CACHE_TTL_MS = 5 * 60_000;
const MOBILE_CHAT_RETENTION_DAYS = 14;
const MOBILE_CHAT_RETENTION_MS = MOBILE_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MOBILE_AGENDA_SESSION_CACHE_TTL_MS = 5 * 60_000;
const MOBILE_AGENDA_SESSION_CACHE_PREFIX = 'plixmap:mobile:agenda-cache:v1:';
const MOBILE_CHAT_OVERVIEW_SESSION_CACHE_TTL_MS = 2 * 60_000;
const MOBILE_CHAT_OVERVIEW_SESSION_CACHE_PREFIX = 'plixmap:mobile:chat-overview:v1:';
const MOBILE_CHAT_THREAD_SESSION_CACHE_TTL_MS = 10 * 60_000;
const MOBILE_CHAT_THREAD_SESSION_CACHE_PREFIX = 'plixmap:mobile:chat-thread:v1:';
const MOBILE_THEME_STORAGE_KEY = 'plixmap:mobile:theme';
type MobileAgendaPayload = Awaited<ReturnType<typeof fetchMobileAgenda>>;
type MobileAgendaMonthPayload = Awaited<ReturnType<typeof fetchMobileAgendaMonth>>;
type MobileChatOverviewPayload = Awaited<ReturnType<typeof fetchMobileChatOverview>>;
const mobileAgendaMemoryCache = new Map<string, { at: number; payload: MobileAgendaPayload }>();
const mobileAgendaMonthMemoryCache = new Map<string, { at: number; payload: MobileAgendaMonthPayload }>();

const scheduleWhenIdle = (work: () => void, timeoutMs = 1200): (() => void) => {
  if (typeof window === 'undefined') {
    work();
    return () => {};
  }
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    work();
  };
  const hasIdle = typeof (window as any).requestIdleCallback === 'function';
  if (hasIdle) {
    const idleId = (window as any).requestIdleCallback(run, { timeout: timeoutMs });
    return () => {
      cancelled = true;
      try {
        (window as any).cancelIdleCallback(idleId);
      } catch {
        // ignore
      }
    };
  }
  const t = window.setTimeout(run, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(t);
  };
};

const toLocalDay = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const nowDay = () => toLocalDay(Date.now());
const formatTime = (ts: number, locale?: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
const formatDate = (ts: number, locale?: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(ts));
const formatMonthLabel = (monthKey: string, locale?: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
};
const shiftIsoDayByMonths = (value: string, delta: number) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return nowDay();
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const nextBase = new Date(year, monthIndex + delta, 1, 0, 0, 0, 0);
  const nextYear = nextBase.getFullYear();
  const nextMonthIndex = nextBase.getMonth();
  const lastDay = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
};
const buildCalendarMonthCells = (monthKey: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());
  if (!match) return [] as Array<string | null>;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};
const formatDateTime = (ts?: number | null, locale?: string) =>
  Number.isFinite(Number(ts || 0))
    ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(Number(ts)))
    : '—';
const formatAudioClock = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const safeDecodeUriPart = (value: string) => {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
};
const normalizeDmThreadId = (value: unknown) => {
  let raw = safeDecodeUriPart(String(value || '').trim());
  if (!raw) return '';
  if (/^dm%3a/i.test(raw)) raw = safeDecodeUriPart(raw);
  if (!raw.startsWith('dm:')) return raw;
  const parts = raw
    .slice(3)
    .split(':')
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (parts.length !== 2) return raw;
  const [a, b] = parts[0]! < parts[1]! ? [parts[0]!, parts[1]!] : [parts[1]!, parts[0]!];
  return `dm:${a}:${b}`;
};
const normalizeChatClientId = (value: unknown) => {
  const decoded = safeDecodeUriPart(String(value || '').trim());
  if (!decoded) return '';
  return normalizeDmThreadId(decoded);
};
const getDmOtherUserId = (threadId: unknown, myUserId: unknown) => {
  const normalized = normalizeDmThreadId(threadId);
  if (!normalized.startsWith('dm:')) return '';
  const parts = normalized
    .slice(3)
    .split(':')
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (parts.length !== 2) return '';
  const me = String(myUserId || '').trim();
  if (!me) return '';
  if (parts[0] === me) return parts[1] || '';
  if (parts[1] === me) return parts[0] || '';
  return '';
};
const isAudioAttachment = (mime: unknown, name: unknown) =>
  String(mime || '').startsWith('audio/') || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(String(name || ''));
const detectAudioMime = (mime: unknown, name: unknown) => {
  const fromMime = String(mime || '').trim();
  if (fromMime) return fromMime;
  const file = String(name || '').toLowerCase();
  if (file.endsWith('.mp3')) return 'audio/mpeg';
  if (file.endsWith('.wav')) return 'audio/wav';
  if (file.endsWith('.m4a')) return 'audio/mp4';
  if (file.endsWith('.aac')) return 'audio/aac';
  if (file.endsWith('.ogg')) return 'audio/ogg';
  if (file.endsWith('.webm')) return 'audio/webm';
  return '';
};
const getMobileChatCutoffTs = () => Date.now() - MOBILE_CHAT_RETENTION_MS;
const filterRecentMobileChatMessages = <T extends { createdAt?: number | null }>(messages: T[]) => {
  const cutoff = getMobileChatCutoffTs();
  return (messages || []).filter((m) => Number(m?.createdAt || 0) >= cutoff);
};
const canPlayAudioAttachment = (mime: unknown, name: unknown) => {
  if (typeof document === 'undefined') return true;
  const audio = document.createElement('audio');
  const resolvedMime = detectAudioMime(mime, name);
  if (resolvedMime) {
    const direct = audio.canPlayType(resolvedMime);
    if (direct === 'probably' || direct === 'maybe') return true;
  }
  const file = String(name || '').toLowerCase();
  if (file.endsWith('.mp3')) return !!audio.canPlayType('audio/mpeg');
  if (file.endsWith('.wav')) return !!audio.canPlayType('audio/wav');
  if (file.endsWith('.m4a')) return !!audio.canPlayType('audio/mp4');
  if (file.endsWith('.aac')) return !!audio.canPlayType('audio/aac');
  if (file.endsWith('.ogg')) return !!audio.canPlayType('audio/ogg');
  if (file.endsWith('.webm')) return !!audio.canPlayType('audio/webm');
  return false;
};

const MobileAudioClip = ({ src, mime, name, className = '' }: { src: string; mime?: string; name?: string; className?: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [activated, setActivated] = useState(false);
  const playable = useMemo(() => canPlayAudioAttachment(mime, name), [mime, name]);
  const resolvedMime = useMemo(() => detectAudioMime(mime, name), [mime, name]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoaded = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onTime = () => setCurrent(Number.isFinite(el.currentTime) ? el.currentTime : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const onError = () => {
      setFailed(true);
      setPlaying(false);
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, [src, activated]);

  const togglePlay = useCallback(async () => {
    try {
      setFailed(false);
      if (!activated) {
        setActivated(true);
        window.setTimeout(async () => {
          const nextEl = audioRef.current;
          if (!nextEl) return;
          try {
            await nextEl.play();
          } catch {
            setFailed(true);
          }
        }, 0);
        return;
      }
      const el = audioRef.current;
      if (!el) return;
      if (!el.paused) {
        el.pause();
        return;
      }
      await el.play();
    } catch {
      setFailed(true);
    }
  }, [activated]);

  if (!playable || failed) {
    return (
      <a
        href={String(src || '#')}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-200 ${className}`}
      >
        <Paperclip size={11} />
        <span className="truncate">{String(name || 'Open audio')}</span>
      </a>
    );
  }

  const progress = duration > 0 ? Math.max(0, Math.min(100, (current / duration) * 100)) : 0;
  return (
    <div className={`inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1 ${className}`}>
      <button
        type="button"
        onClick={() => void togglePlay()}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-100"
        title={playing ? 'Pausa' : 'Riproduci'}
      >
        {playing ? <Pause size={11} /> : <Play size={11} />}
      </button>
      <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full bg-cyan-300/80" style={{ width: `${progress}%` }} />
      </div>
      <div className="shrink-0 tabular-nums text-[10px] text-slate-300">
        {formatAudioClock(current)} / {formatAudioClock(duration)}
      </div>
      {activated ? (
        <audio ref={audioRef} preload="metadata">
          <source src={String(src || '')} {...(resolvedMime ? { type: resolvedMime } : {})} />
        </audio>
      ) : null}
    </div>
  );
};

const parseRoomIdFromQrPayload = (raw: string): string | null => {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    const qRoom = String(url.searchParams.get('roomId') || '').trim();
    if (qRoom) return qRoom;
    const match = /\/meetingroom\/([^/?#]+)/i.exec(url.pathname);
    if (match?.[1]) return decodeURIComponent(match[1]);
    if (url.pathname === '/mobile') return null;
  } catch {
    const m = /roomId=([^&\s]+)/i.exec(value) || /\/meetingroom\/([^/?#\s]+)/i.exec(value);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return null;
};

const resolveClientLogoUrl = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  try {
    return new URL(normalized, window.location.origin).toString();
  } catch {
    return normalized;
  }
};

const buildCheckInKeyForParticipantMatch = (meeting: MobileAgendaMeeting) => {
  const p = (meeting as any)?.participantMatch;
  if (!p) return '';
  const tag = p.optional ? 'OPT' : 'INT';
  const label = String(p.fullName || p.externalId || '-').trim().toLowerCase();
  const email = String(p.email || '').trim().toLowerCase();
  return `${tag}::${label}::${email}`;
};

const normalizeChatText = (value: unknown) => String(value || '').trim().toLowerCase();
const isOpaqueChatIdentity = (value: unknown) => {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^d[mn]:/i.test(v)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)) return true;
  return false;
};
const readAgendaPayloadFromSessionCache = (cacheKey: string): { at: number; payload: MobileAgendaPayload } | null => {
  if (typeof window === 'undefined' || !cacheKey) return null;
  try {
    const raw = window.sessionStorage.getItem(`${MOBILE_AGENDA_SESSION_CACHE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw || '{}');
    const at = Number(parsed?.at || 0);
    if (!Number.isFinite(at) || at <= 0) return null;
    if (Date.now() - at > MOBILE_AGENDA_SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(`${MOBILE_AGENDA_SESSION_CACHE_PREFIX}${cacheKey}`);
      return null;
    }
    const payload = (parsed?.payload || null) as MobileAgendaPayload | null;
    if (!payload || !Array.isArray((payload as any).meetings)) return null;
    return { at, payload };
  } catch {
    return null;
  }
};

const writeAgendaPayloadToSessionCache = (cacheKey: string, payload: MobileAgendaPayload, at: number) => {
  if (typeof window === 'undefined' || !cacheKey) return;
  try {
    const encoded = JSON.stringify({ at, payload });
    // Keep cache bounded on mobile WebView.
    if (encoded.length > 450_000) return;
    window.sessionStorage.setItem(`${MOBILE_AGENDA_SESSION_CACHE_PREFIX}${cacheKey}`, encoded);
  } catch {
    // ignore quota/sandbox errors
  }
};

const readMobileChatOverviewFromSessionCache = (cacheKey: string): { at: number; payload: MobileChatOverviewPayload } | null => {
  if (typeof window === 'undefined' || !cacheKey) return null;
  try {
    const raw = window.sessionStorage.getItem(`${MOBILE_CHAT_OVERVIEW_SESSION_CACHE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw || '{}');
    const at = Number(parsed?.at || 0);
    if (!Number.isFinite(at) || at <= 0) return null;
    if (Date.now() - at > MOBILE_CHAT_OVERVIEW_SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(`${MOBILE_CHAT_OVERVIEW_SESSION_CACHE_PREFIX}${cacheKey}`);
      return null;
    }
    const payload = (parsed?.payload || null) as MobileChatOverviewPayload | null;
    if (!payload || !Array.isArray((payload as any).clients) || !Array.isArray((payload as any).dms)) return null;
    return { at, payload };
  } catch {
    return null;
  }
};

const writeMobileChatOverviewToSessionCache = (cacheKey: string, payload: MobileChatOverviewPayload, at: number) => {
  if (typeof window === 'undefined' || !cacheKey) return;
  try {
    const encoded = JSON.stringify({ at, payload });
    if (encoded.length > 350_000) return;
    window.sessionStorage.setItem(`${MOBILE_CHAT_OVERVIEW_SESSION_CACHE_PREFIX}${cacheKey}`, encoded);
  } catch {
    // ignore quota/sandbox errors
  }
};

const readMobileChatThreadFromSessionCache = (cacheKey: string): { at: number; messages: ChatMessage[] } | null => {
  if (typeof window === 'undefined' || !cacheKey) return null;
  try {
    const raw = window.sessionStorage.getItem(`${MOBILE_CHAT_THREAD_SESSION_CACHE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw || '{}');
    const at = Number(parsed?.at || 0);
    if (!Number.isFinite(at) || at <= 0) return null;
    if (Date.now() - at > MOBILE_CHAT_THREAD_SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(`${MOBILE_CHAT_THREAD_SESSION_CACHE_PREFIX}${cacheKey}`);
      return null;
    }
    const messages = Array.isArray(parsed?.messages) ? (parsed.messages as ChatMessage[]) : null;
    if (!messages) return null;
    return { at, messages };
  } catch {
    return null;
  }
};

const writeMobileChatThreadToSessionCache = (cacheKey: string, messages: ChatMessage[], at: number) => {
  if (typeof window === 'undefined' || !cacheKey) return;
  try {
    const trimmed = (messages || []).slice(-160);
    const encoded = JSON.stringify({ at, messages: trimmed });
    if (encoded.length > 450_000) return;
    window.sessionStorage.setItem(`${MOBILE_CHAT_THREAD_SESSION_CACHE_PREFIX}${cacheKey}`, encoded);
  } catch {
    // ignore quota/sandbox errors
  }
};

const chatSnippet = (msg: ChatMessage | null | undefined, tr: (m: { it: string; en: string }) => string) => {
  if (!msg) return '';
  if (msg.deleted) return tr({ it: '— messaggio eliminato —', en: '— message deleted —' });
  const text = String(msg.text || '').replace(/\s+/g, ' ').trim();
  if (text) return text;
  if (Array.isArray(msg.attachments) && msg.attachments.length) return tr({ it: '[Allegato]', en: '[Attachment]' });
  return '';
};

const canEditChatMessage = (msg: ChatMessage, myUserId: string) => {
  if (!msg || msg.deleted) return false;
  if (String(msg.userId || '') !== String(myUserId || '')) return false;
  const ageMs = Date.now() - (Number(msg.createdAt) || 0);
  return ageMs <= 30 * 60 * 1000;
};

const canDeleteChatForAll = (msg: ChatMessage, myUserId: string) => {
  if (!msg || msg.deleted) return false;
  if (String(msg.userId || '') !== String(myUserId || '')) return false;
  const ageMs = Date.now() - (Number(msg.createdAt) || 0);
  return ageMs <= 30 * 60 * 1000;
};

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
  const [rememberPassword, setRememberPassword] = useState(false);
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(false);
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
  const mobileAutoLoginAttemptedRef = useRef(false);
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
      const nextPassword = String(parsed?.password || '');
      const nextRememberUsername = !!parsed?.rememberUsername;
      const nextRememberPassword = !!parsed?.rememberPassword;
      const nextAutoLogin = !!parsed?.autoLogin;
      if (nextUsername) setLoginUsername(nextUsername);
      if (nextRememberPassword && nextPassword) setLoginPassword(nextPassword);
      setRememberUsername(nextRememberUsername);
      setRememberPassword(nextRememberPassword);
      setAutoLoginEnabled(nextAutoLogin && nextRememberPassword);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user || loginBusy || otpRequired) return;
    if (!autoLoginEnabled || !rememberPassword) return;
    if (mobileAutoLoginAttemptedRef.current) return;
    if (!String(loginUsername || '').trim() || !String(loginPassword || '').trim()) return;
    mobileAutoLoginAttemptedRef.current = true;
    void (async () => {
      try {
        setLoginBusy(true);
        await login(String(loginUsername || '').trim().toLowerCase(), loginPassword);
      } catch (err: any) {
        if (err instanceof MFARequiredError || err?.name === 'MFARequiredError') {
          setOtpRequired(true);
        } else {
          setLoginError(String(err?.message || 'Login failed'));
        }
      } finally {
        setLoginBusy(false);
      }
    })();
  }, [user, loginBusy, otpRequired, autoLoginEnabled, rememberPassword, loginUsername, loginPassword, login]);

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
    mobileAutoLoginAttemptedRef.current = true;
    setAutoLoginEnabled(false);
    setSettingsMenuOpen(false);
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(MOBILE_LOGIN_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw || '{}') : {};
        window.localStorage.setItem(
          MOBILE_LOGIN_STORAGE_KEY,
          JSON.stringify({
            username: String(parsed?.username || loginUsername || '').trim().toLowerCase(),
            password: rememberPassword ? String(parsed?.password || loginPassword || '') : '',
            rememberUsername,
            rememberPassword,
            autoLogin: false
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
  }, [loginPassword, loginUsername, logout, rememberPassword, rememberUsername]);

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
      const clientRows = Array.isArray(next?.clients) ? next.clients : [];
      const dmRows = Array.isArray(next?.dms) ? next.dms : [];
      setChatClientChannels(
        clientRows.map((row) => ({
          id: normalizeChatClientId(row.id || ''),
          name: String(row.name || '').trim() || String(row.id || ''),
          logoUrl: resolveClientLogoUrl(row.logoUrl || ''),
          lastMessageAt: Number(row.lastMessageAt || row.lastMessage?.createdAt || 0) || null
        }))
      );
      setChatDmContacts(
        dmRows
          .map((row) => ({
            id: String(row.id || '').trim(),
            threadId: normalizeChatClientId(row.threadId || ''),
            name: String(row.name || '').trim() || directMessageLabel,
            avatarUrl: resolveClientLogoUrl(row.avatarUrl || ''),
            lastMessageAt: Number(row.lastMessageAt || row.lastMessage?.createdAt || 0) || null
          }))
          .filter((row) => row.id && row.threadId)
      );
      const unreadMap: Record<string, number> = {};
      const lastMessageMap: Record<string, ChatMessage | null> = {};
      for (const row of clientRows) {
        const id = normalizeChatClientId(row.id || '');
        if (!id) continue;
        unreadMap[id] = Math.max(0, Number(row.unreadCount || 0));
        lastMessageMap[id] = row.lastMessage || null;
      }
      for (const row of dmRows) {
        const id = normalizeChatClientId(row.threadId || '');
        if (!id) continue;
        unreadMap[id] = Math.max(0, Number(row.unreadCount || 0));
        lastMessageMap[id] = row.lastMessage || null;
      }
      setChatUnreadByClientId(unreadMap);
      setChatLastMessageByClientId((prev) => {
        const merged = { ...(prev || {}) } as Record<string, ChatMessage | null>;
        let changed = false;
        for (const [id, nextMessage] of Object.entries(lastMessageMap)) {
          const prevMessage = merged[id] || null;
          const sameId = String(prevMessage?.id || '') === String(nextMessage?.id || '');
          const sameTs = Number(prevMessage?.createdAt || 0) === Number(nextMessage?.createdAt || 0);
          if (sameId && sameTs) continue;
          merged[id] = nextMessage;
          changed = true;
        }
        return changed ? merged : prev;
      });
      const firstId = normalizeChatClientId(String(clientRows[0]?.id || dmRows[0]?.threadId || ''));
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

  const meetings = useMemo(() => {
    const rows = Array.isArray(agendaPayload?.meetings) ? agendaPayload!.meetings : [];
    return rows.slice().sort((a, b) => Number(a.startAt) - Number(b.startAt));
  }, [agendaPayload]);
  const agendaMonthDaysWithMeetings = useMemo(() => {
    if (String(agendaMonthPayload?.month || '') !== displayMonth) return {} as Record<string, number>;
    return (agendaMonthPayload?.days || {}) as Record<string, number>;
  }, [agendaMonthPayload, displayMonth]);

  const meetingsForSelectedRoom = useMemo(() => {
    const roomId = String(selectedRoomId || '').trim();
    if (!roomId) return meetings;
    return meetings.filter((m) => String(m.roomId || '') === roomId);
  }, [meetings, selectedRoomId]);

  const now = Date.now();
  const hasInProgressMeeting = useMemo(
    () => meetings.some((m) => Number(m.startAt) <= now && now < Number(m.endAt)),
    [meetings, now]
  );
  const syncBadge = useMemo(() => {
    if (agendaLoading && !lastAgendaSyncAt) return { label: tr({ it: 'Sincronizzazione…', en: 'Syncing…' }), tone: 'loading' as const };
    if (!lastAgendaSyncAt) return { label: tr({ it: 'Connessione lenta', en: 'Slow connection' }), tone: 'slow' as const };
    const staleMs = Date.now() - lastAgendaSyncAt;
    if (agendaSyncDegraded || staleMs > 20_000) return { label: tr({ it: 'Connessione lenta', en: 'Slow connection' }), tone: 'slow' as const };
    return { label: tr({ it: 'Sincronizzato', en: 'Synced' }), tone: 'ok' as const };
  }, [agendaLoading, lastAgendaSyncAt, agendaSyncDegraded, tr]);

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
  const chatClientOptions = useMemo(() => {
    const rows: Array<{ id: string; name: string; logoUrl: string; avatarUrl?: string; kind: 'client' | 'dm'; lastMessageAt?: number | null }> = [];
    const seen = new Set<string>();
    for (const row of chatClientChannels || []) {
      const id = normalizeChatClientId(row.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        name: String(row.name || '').trim() || id,
        logoUrl: resolveClientLogoUrl(row.logoUrl || ''),
        kind: 'client',
        lastMessageAt: row.lastMessageAt || null
      });
    }
    for (const dm of chatDmContacts || []) {
      const threadId = normalizeChatClientId(dm.threadId || '');
      if (!threadId || seen.has(threadId)) continue;
      seen.add(threadId);
      rows.push({
        id: threadId,
        name: dm.name || directMessageLabel,
        logoUrl: '',
        avatarUrl: dm.avatarUrl || '',
        kind: 'dm',
        lastMessageAt: dm.lastMessageAt || null
      });
    }
    const normalizedCurrentId = normalizeChatClientId(chatClientId);
    if (normalizedCurrentId && !seen.has(normalizedCurrentId)) {
      if (normalizedCurrentId.startsWith('dm:')) {
        const fallbackDm = (chatDmContacts || []).find((row) => normalizeChatClientId(row.threadId || '') === normalizedCurrentId);
        rows.push({
          id: normalizedCurrentId,
          name: String(fallbackDm?.name || directMessageLabel),
          logoUrl: '',
          avatarUrl: fallbackDm?.avatarUrl || '',
          kind: 'dm',
          lastMessageAt: fallbackDm?.lastMessageAt || null
        });
      } else {
        rows.push({
          id: normalizedCurrentId,
          name: chatClientChannels.find((row) => normalizeChatClientId(row.id) === normalizedCurrentId)?.name || normalizedCurrentId,
          logoUrl: resolveClientLogoUrl(
            chatClientChannels.find((row) => normalizeChatClientId(row.id) === normalizedCurrentId)?.logoUrl || ''
          ),
          kind: 'client',
          lastMessageAt: null
        });
      }
    }
    return rows;
  }, [chatClientChannels, chatClientId, chatDmContacts, directMessageLabel]);

  const filteredChatClientOptions = useMemo(() => {
    const q = normalizeChatText(chatSearch);
    const filtered = !q ? chatClientOptions : chatClientOptions.filter((row) => normalizeChatText(row.name).includes(q));
    const cutoffTs = getMobileChatCutoffTs();
    const lastMessageTs = (row: any) => {
      const normalizedId = normalizeChatClientId(row?.id || '');
      const localLast = Number(chatLastMessageByClientId[normalizedId]?.createdAt || 0);
      const remoteLast = Number((row as any)?.lastMessageAt || 0);
      const ts = Math.max(localLast, remoteLast);
      return ts >= cutoffTs ? ts : 0;
    };
    return filtered.slice().sort((a, b) => {
      const aLast = lastMessageTs(a);
      const bLast = lastMessageTs(b);
      if (aLast !== bLast) return bLast - aLast;
      return a.name.localeCompare(b.name);
    });
  }, [chatClientOptions, chatSearch, chatLastMessageByClientId]);

  const selectedChatClient = useMemo(() => {
    const normalizedId = normalizeChatClientId(chatClientId || '');
    if (!normalizedId) return null;
    return chatClientOptions.find((c) => normalizeChatClientId(c.id) === normalizedId) || null;
  }, [chatClientId, chatClientOptions]);

  const dmNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of chatDmContacts || []) {
      const id = String(row.id || '').trim();
      const name = String(row.name || '').trim();
      if (id && name) map.set(id, name);
    }
    return map;
  }, [chatDmContacts]);

  const selectedChatClientName = useMemo(() => {
    const fromOption = String(selectedChatClient?.name || '').trim();
    if (fromOption) return fromOption;
    const cid = normalizeChatClientId(chatClientId || '');
    if (!cid) return tr({ it: 'Seleziona una chat', en: 'Select a chat' });
    if (cid.startsWith('dm:')) {
      const otherUserId = getDmOtherUserId(cid, user?.id);
      const knownDmName = otherUserId ? dmNameByUserId.get(otherUserId) : '';
      if (knownDmName) return knownDmName;
      return tr({ it: 'Messaggio diretto', en: 'Direct message' });
    }
    if (isOpaqueChatIdentity(cid)) return tr({ it: 'Messaggio diretto', en: 'Direct message' });
    return safeDecodeUriPart(cid);
  }, [selectedChatClient?.name, chatClientId, dmNameByUserId, tr, user?.id]);

  const selectedChatClientLogoUrl =
    selectedChatClient && !chatClientLogoFailedById[String(selectedChatClient.id || '')] ? String((selectedChatClient as any).logoUrl || '') : '';
  const selectedChatClientAvatarUrl =
    selectedChatClient && !chatClientLogoFailedById[String(selectedChatClient.id || '')] ? String((selectedChatClient as any).avatarUrl || '') : '';

  const selectedChatClientInitials = useMemo(() => {
    const parts = selectedChatClientName
      .split(/\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return 'CH';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }, [selectedChatClientName]);

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
    (msg: ChatMessage) => {
      const mine = String(msg.userId || '') === String(user?.id || '');
      if (mine) return `${String(user?.firstName || '').trim()} ${String(user?.lastName || '').trim()}`.trim() || String(user?.username || tr({ it: 'Io', en: 'Me' }));
      const dmKnown = dmNameByUserId.get(String(msg.userId || '').trim());
      if (dmKnown) return dmKnown;
      if (!isOpaqueChatIdentity(msg.username)) return String(msg.username || '').trim();
      return tr({ it: 'Utente', en: 'User' });
    },
    [dmNameByUserId, tr, user?.firstName, user?.id, user?.lastName, user?.username]
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
              password: rememberPassword ? loginPassword : '',
              rememberUsername,
              rememberPassword,
              autoLogin: rememberPassword && autoLoginEnabled
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

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });

  const compressImageAttachment = async (file: File) => {
    const mime = String(file.type || '').toLowerCase();
    const isImage = mime.startsWith('image/');
    const isGif = mime.includes('gif');
    const isSvg = mime.includes('svg');
    if (!isImage || isGif || isSvg) {
      const dataUrl = await readFileAsDataUrl(file);
      return { name: file.name, dataUrl, mime: file.type || undefined };
    }
    const source = await readFileAsDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error('image_decode'));
      next.src = source;
    });
    const maxW = 1280;
    const maxH = 1280;
    const scale = Math.min(1, maxW / Math.max(1, img.width), maxH / Math.max(1, img.height));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { name: file.name, dataUrl: source, mime: file.type || undefined };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const outputMime = 'image/jpeg';
    const dataUrl = canvas.toDataURL(outputMime, 0.8);
    const compactName = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
    return { name: compactName, dataUrl, mime: outputMime };
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
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isDayTheme ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-black/10 text-slate-300'}`}>
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => {
                const checked = e.target.checked;
                setRememberPassword(checked);
                if (!checked) setAutoLoginEnabled(false);
              }}
            />
            {tr({ it: 'Salva password su questo dispositivo', en: 'Save password on this device' })}
          </label>
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${rememberPassword ? 'border-white/10 bg-black/10 text-slate-300' : 'border-white/5 bg-black/5 text-slate-500'}`}>
            <input type="checkbox" checked={autoLoginEnabled} disabled={!rememberPassword} onChange={(e) => setAutoLoginEnabled(e.target.checked)} />
            {tr({ it: 'Accesso automatico (salva sessione locale)', en: 'Auto login (save local session)' })}
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

  return (
          <div
        className={`h-[100dvh] overflow-hidden ${shellClass}`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        }}
      >
      <div className="mx-auto h-full max-w-3xl p-3 sm:p-4">
        <div className={`flex h-full flex-col overflow-hidden rounded-3xl border p-4 backdrop-blur ${frameClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-[11px] uppercase tracking-[0.18em] ${mutedTextClass}`}>Plixmap Mobile</div>
              <div className="truncate text-xl font-semibold">
                {user.firstName} {user.lastName}
              </div>
            </div>
            <div className="relative" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setSettingsMenuOpen((prev) => !prev)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${isDayTheme ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-black/20 text-slate-200'}`}
                title={tr({ it: 'Impostazioni', en: 'Settings' })}
              >
                <Cog size={16} />
              </button>
              {settingsMenuOpen ? (
                <div className={`absolute right-0 top-12 z-20 w-64 rounded-2xl border p-3 shadow-2xl ${isDayTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-slate-950 text-slate-100'}`}>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${mutedTextClass}`}>{tr({ it: 'Impostazioni', en: 'Settings' })}</div>
                  <div className="mt-3">
                    <div className={`mb-1 flex items-center gap-2 text-xs font-semibold ${mutedTextClass}`}>
                      <Globe size={13} />
                      {tr({ it: 'Lingua', en: 'Language' })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['it', 'en'] as const).map((lang) => {
                        const active = (user.language || 'it') === lang;
                        return (
                          <button
                            key={`mobile-lang-${lang}`}
                            type="button"
                            onClick={() => void handleMobileLanguageChange(lang)}
                            disabled={settingsBusy}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                              active
                                ? isDayTheme
                                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                  : 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                                : isDayTheme
                                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                                  : 'border-white/10 bg-black/20 text-slate-200'
                            }`}
                          >
                            {lang === 'it' ? 'Italiano' : 'English'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className={`mb-1 text-xs font-semibold ${mutedTextClass}`}>{tr({ it: 'Tema', en: 'Theme' })}</div>
                    <button
                      type="button"
                      onClick={() => setMobileTheme((prev) => (prev === 'night' ? 'day' : 'night'))}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold ${isDayTheme ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-black/20 text-slate-200'}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {isDayTheme ? <Moon size={15} /> : <Sun size={15} />}
                        {isDayTheme ? tr({ it: 'Passa a notte', en: 'Switch to night' }) : tr({ it: 'Passa a giorno', en: 'Switch to day' })}
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMobileLogout()}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${isDayTheme ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-400/30 bg-rose-500/10 text-rose-200'}`}
                  >
                    <LogOut size={15} />
                    {tr({ it: 'Esci', en: 'Logout' })}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex gap-2">{[tabBtn('agenda', tr({ it: 'Agenda', en: 'Agenda' }), CalendarDays), tabBtn('chat', tr({ it: 'Chat', en: 'Chat' }), MessageSquare)]}</div>

          {tab !== 'chat' ? (
          <div className={`mt-4 rounded-2xl border p-3 ${subtlePanelClass}`}>
            <div className={`rounded-2xl border p-3 ${calendarCardClass}`}>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDay((prev) => shiftIsoDayByMonths(prev || nowDay(), -1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${calendarNavButtonClass}`}
                  title={tr({ it: 'Mese precedente', en: 'Previous month' })}
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="min-w-0 text-center">
                  <div className={`truncate text-sm font-semibold capitalize ${isDayTheme ? 'text-slate-900' : 'text-slate-100'}`}>{formatMonthLabel(displayMonth, locale)}</div>
                  <div className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${mutedTextClass}`}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    {tr({ it: 'Giorni con meeting', en: 'Days with meetings' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDay((prev) => shiftIsoDayByMonths(prev || nowDay(), 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${calendarNavButtonClass}`}
                  title={tr({ it: 'Mese successivo', en: 'Next month' })}
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className={`mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] ${mutedTextClass}`}>
                {calendarWeekdayLabels.map((label, idx) => (
                  <div key={`mobile-calendar-weekday-${idx}`}>{label}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (!cell) return <div key={`mobile-calendar-empty-${idx}`} className="h-10 rounded-xl border border-transparent" aria-hidden="true" />;
                  const meetingCount = Number(agendaMonthDaysWithMeetings[cell] || 0);
                  const hasMeeting = meetingCount > 0;
                  const selected = cell === day;
                  const today = cell === nowDay();
                  return (
                    <button
                      key={cell}
                      type="button"
                      onClick={() => setDay(cell)}
                      title={hasMeeting ? `${cell} • ${meetingCount} meeting` : cell}
                      className={`relative flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                        selected
                          ? isDayTheme
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-700 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
                            : 'border-cyan-300/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                          : hasMeeting
                            ? isDayTheme
                              ? 'border-cyan-200 bg-cyan-50/60 text-slate-700'
                              : 'border-cyan-400/20 bg-cyan-500/5 text-slate-100'
                            : calendarDayButtonBaseClass
                      } ${today && !selected ? (isDayTheme ? 'ring-1 ring-inset ring-slate-300' : 'ring-1 ring-inset ring-white/20') : ''}`}
                    >
                      <span>{Number(cell.slice(8, 10))}</span>
                      {hasMeeting ? <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${selected ? (isDayTheme ? 'bg-cyan-600' : 'bg-cyan-100') : 'bg-cyan-300'}`} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className={`text-xs font-semibold ${isDayTheme ? 'text-slate-600' : 'text-slate-300'}`}>{tr({ it: 'Data', en: 'Date' })}</label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value || nowDay())}
                className={`rounded-lg border px-3 py-2 text-sm ${calendarInputClass}`}
              />
              <button
                type="button"
                onClick={() => {
                  void reloadAgenda();
                  void reloadAgendaMonth();
                }}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold ${calendarActionButtonClass}`}
                title={tr({ it: 'Aggiorna', en: 'Refresh' })}
              >
                <RefreshCcw size={14} className={agendaLoading || agendaMonthLoading ? 'animate-spin' : ''} />
              </button>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  syncBadge.tone === 'ok'
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    : syncBadge.tone === 'loading'
                      ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                      : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                }`}
                title={
                  lastAgendaSyncAt
                    ? tr({ it: `Ultimo sync ${formatDateTime(lastAgendaSyncAt, locale)} • ${lastAgendaSyncMs}ms`, en: `Last sync ${formatDateTime(lastAgendaSyncAt, locale)} • ${lastAgendaSyncMs}ms` })
                    : tr({ it: 'Stato sincronizzazione', en: 'Sync status' })
                }
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    syncBadge.tone === 'ok'
                      ? 'bg-emerald-300'
                      : syncBadge.tone === 'loading'
                        ? 'bg-cyan-300 animate-pulse'
                        : 'bg-amber-300'
                  }`}
                />
                {syncBadge.label}
              </div>
              {tab === 'checkin' && selectedRoomId ? (
                <button
                  type="button"
                  onClick={() => setSelectedRoomId('')}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
                >
                  <QrCode size={13} />
                  {tr({ it: 'Sala', en: 'Room' })}: {selectedRoomId.slice(0, 8)}… ({tr({ it: 'rimuovi filtro', en: 'remove filter' })})
                </button>
              ) : null}
            </div>
          </div>
          ) : null}

          <div className={`mt-3 min-h-0 flex-1 overflow-x-hidden ${tab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto pr-1'}`}>
            {notice ? <div className={noticeClass}>{notice}</div> : null}
            {agendaLoading && !agendaPayload ? (
              <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                {tr({ it: 'Caricamento iniziale in corso. Potrebbero servire alcuni secondi per sincronizzare meeting e chat.', en: 'Initial loading in progress. It may take a few seconds to sync meetings and chat.' })}
              </div>
            ) : null}
            {agendaError && !linkedMissing ? <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{agendaError}</div> : null}
            {linkedMissing ? (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                {tr({ it: 'L’utente del portale non è collegato a un utente reale importato. Chiedi a un admin di aprire ', en: 'The portal user is not linked to a real imported user. Ask an admin to open ' })}
                <b>Edit user</b>
                {tr({ it: ' e collegarti alla rubrica utenti del cliente.', en: ' and link you to the client user directory.' })}
              </div>
            ) : null}

          {tab === 'agenda' ? (
            <div className="mt-4 space-y-3">
              {!meetings.length && !agendaLoading ? (
                <div className={emptyAgendaClass}>{tr({ it: 'Nessun meeting per la giornata selezionata.', en: 'No meetings for the selected day.' })}</div>
              ) : null}
              {meetings.map((meeting) => {
                const { phase, inProgress, isPast } = getMeetingTemporalState(meeting.startAt, meeting.endAt, now);
                return (
                  <button
                    type="button"
                    key={meeting.id}
                    onClick={() => openMeetingDetail(meeting)}
                    className={`w-full rounded-2xl border p-3 text-left ${inProgress ? 'border-emerald-400/30 bg-emerald-500/10' : isPast ? 'border-white/10 bg-white/5 opacity-80' : 'border-violet-400/20 bg-violet-500/5'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{meeting.subject || meetingLabel}</div>
                        <div className="mt-1 text-xs text-slate-300">
                          {meeting.clientName} • {meeting.siteName} • {meeting.floorPlanName}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {meeting.roomName} • {formatDate(meeting.startAt, locale)} • {formatTime(meeting.startAt, locale)} - {formatTime(meeting.endAt, locale)}
                        </div>
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-bold ${inProgress ? 'bg-emerald-500/20 text-emerald-200' : isPast ? 'bg-slate-700/70 text-slate-300' : 'bg-violet-500/20 text-violet-200'}`}>
                        {getMeetingTimePhaseBadgeLabel(phase, tr)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {tab === 'chat' ? (
            <div className="mt-2 flex h-full min-h-0 flex-col">
              {chatViewMode === 'list' ? (
                <div className="flex min-h-0 flex-1 flex-col space-y-2">
                  <div className="mb-2 text-xs font-semibold text-slate-400">{tr({ it: 'Chat', en: 'Chat' })}</div>
                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    placeholder={tr({ it: 'Cerca chat per cliente...', en: 'Search chats by client...' })}
                  />
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1">
                    {filteredChatClientOptions.map((c: any) => {
                      const normalizedId = normalizeChatClientId(c.id || '');
                      const unread = Number(chatUnreadByClientId[normalizedId] || 0);
                      const lastMsgRaw = chatLastMessageByClientId[normalizedId] || null;
                      const lastMsg = lastMsgRaw && Number(lastMsgRaw.createdAt || 0) >= getMobileChatCutoffTs() ? lastMsgRaw : null;
                      const logoUrl = !chatClientLogoFailedById[String(c.id)] ? String(c.logoUrl || c.avatarUrl || '') : '';
                      const parts = String(c.name || '')
                        .split(/\s+/)
                        .map((p) => p.trim())
                        .filter(Boolean);
                      const initials = !parts.length
                        ? 'CH'
                        : parts.length === 1
                          ? parts[0]!.slice(0, 2).toUpperCase()
                          : `${parts[0]![0] || ''}${parts[1]![0] || ''}`.toUpperCase();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const nextId = normalizeChatClientId(c.id);
                            setChatClientId(nextId);
                            if (!hydrateChatThreadFromCache(nextId)) setChatMessages([]);
                            setChatReplyToId(null);
                            setChatEditingId(null);
                            setChatEditingText('');
                            setChatError('');
                            setChatViewMode('thread');
                          }}
                          className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left text-slate-200"
                        >
                          <span className="flex min-w-0 items-start gap-2">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={c.name}
                                className={`mt-0.5 h-9 w-9 shrink-0 rounded-full border bg-white/5 object-cover ${
                                  unread > 0 ? 'border-emerald-300/60 ring-2 ring-emerald-400/30' : 'border-cyan-300/20'
                                }`}
                                onError={() =>
                                  setChatClientLogoFailedById((prev) => ({
                                    ...prev,
                                    [String(c.id)]: true
                                  }))
                                }
                              />
                            ) : (
                              <span
                                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                  unread > 0
                                    ? 'border-emerald-300/60 bg-emerald-500/10 text-emerald-100 ring-2 ring-emerald-400/30'
                                    : 'border-cyan-300/20 bg-cyan-500/10 text-cyan-100'
                                }`}
                              >
                                {initials}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-100">{c.name}</span>
                              {c.kind === 'dm' ? <span className="block text-[10px] text-slate-500">{directMessageLabel}</span> : null}
                              <span className="mt-0.5 block truncate text-xs text-slate-400">{chatSnippet(lastMsg, tr) || noMessagesLabel}</span>
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            {lastMsg ? <span className="text-[10px] text-slate-400">{formatTime(Number(lastMsg.createdAt || 0), locale)}</span> : null}
                            {unread > 0 ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!chatClientOptions.length ? <div className="text-sm text-slate-400">{tr({ it: 'Nessuna chat disponibile.', en: 'No chats available.' })}</div> : null}
                  {chatClientOptions.length > 0 && !filteredChatClientOptions.length ? <div className="text-xs text-slate-400">{tr({ it: 'Nessun risultato per la ricerca.', en: 'No results for this search.' })}</div> : null}
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setChatViewMode('list')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-200"
                        title={tr({ it: 'Indietro', en: 'Back' })}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {selectedChatClientLogoUrl || selectedChatClientAvatarUrl ? (
                        <img
                          src={selectedChatClientLogoUrl || selectedChatClientAvatarUrl}
                          alt={selectedChatClientName}
                          className="h-8 w-8 shrink-0 rounded-full border border-cyan-300/20 bg-white/5 object-cover"
                          onError={() =>
                            setChatClientLogoFailedById((prev) => ({
                              ...prev,
                              [String(selectedChatClient?.id || '')]: true
                            }))
                          }
                        />
                      ) : (
                        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-500/10 text-xs font-bold text-cyan-100">
                          {selectedChatClientInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-100">{selectedChatClientName}</div>
                        <div className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{chatBusy ? tr({ it: 'Sincronizzazione…', en: 'Syncing…' }) : tr({ it: 'Online', en: 'Online' })}</span>
                          <span className="text-slate-500">•</span>
                          <span>{chatMessages.length ? tr({ it: `${chatMessages.length} messaggi`, en: `${chatMessages.length} messages` }) : noMessagesLabel}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!chatClientId || chatBusy}
                        onClick={() => void clearCurrentChat()}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-50"
                        title={tr({ it: 'Svuota chat', en: 'Clear chat' })}
                      >
                        <Eraser size={12} />
                        {tr({ it: 'Svuota', en: 'Clear' })}
                      </button>
                    </div>
                  </div>

                  <div ref={chatMessagesScrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 pb-6">
                  {chatMessages.map((m) => {
                    const mine = String(m.userId || '') === String(user.id || '');
                    const replyTarget = m.replyToId ? chatMessagesById.get(String(m.replyToId)) : null;
                    const starred = Array.isArray(m.starredBy) && m.starredBy.includes(String(user.id || ''));
                    const reactionEntries = Object.entries((m.reactions && typeof m.reactions === 'object' ? m.reactions : {}) as Record<string, string[]>).filter(
                      ([, ids]) => Array.isArray(ids) && ids.length
                    );
                    return (
                      <div key={m.id} className={`rounded-xl border px-3 py-2 ${mine ? 'ml-8 border-cyan-400/20 bg-cyan-500/10' : 'mr-8 border-white/10 bg-white/5'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-xs font-semibold">{getChatMessageAuthorName(m)}</div>
                          <div className="flex items-center gap-2">
                            {starred ? <Star size={11} className="fill-amber-300 text-amber-300" /> : null}
                            <div className="text-[10px] text-slate-400">{formatDateTime(m.createdAt, locale)}</div>
                          </div>
                        </div>
                        {!m.deleted && replyTarget ? (
                          <div className="mt-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-300">
                            <div className="truncate font-semibold">{getChatMessageAuthorName(replyTarget)}</div>
                                  <div className="truncate text-slate-400">{String(replyTarget.text || '').trim() || ((replyTarget.attachments || []).length ? tr({ it: '[Allegato]', en: '[Attachment]' }) : tr({ it: '[Messaggio]', en: '[Message]' }))}</div>
                          </div>
                        ) : null}
                        {chatEditingId === m.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={chatEditingText}
                              onChange={(e) => setChatEditingText(e.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setChatEditingId(null);
                                  setChatEditingText('');
                                }}
                                className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold"
                              >
                                {tr({ it: 'Annulla', en: 'Cancel' })}
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveEditedChatMessage()}
                                disabled={!String(chatEditingText || '').trim() || chatBusy}
                                className="rounded-lg bg-cyan-500 px-2 py-1 text-xs font-semibold text-slate-950 disabled:opacity-50"
                              >
                                {tr({ it: 'Salva', en: 'Save' })}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 whitespace-pre-wrap text-sm">{m.deleted ? tr({ it: '— messaggio eliminato —', en: '— message deleted —' }) : m.text}</div>
                        )}
                        {Array.isArray(m.attachments) && m.attachments.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.attachments.map((att, idx) => (
                              <div key={`${m.id}-att-${idx}`} className="max-w-full">
                                {String(att?.mime || '').startsWith('image/') ? (
                                  <a href={String(att?.url || '#')} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/10 bg-black/20">
                                    <img src={String(att?.url || '')} alt="" className="max-h-44 w-auto max-w-[220px] object-cover" />
                                  </a>
                                ) : null}
                                {isAudioAttachment(att?.mime, att?.name) ? (
                                  <MobileAudioClip
                                    src={String(att?.url || '')}
                                    mime={String(att?.mime || '') || undefined}
                                    name={String(att?.name || '') || undefined}
                                    className="h-8 max-w-[220px]"
                                  />
                                ) : !String(att?.mime || '').startsWith('image/') ? (
                                  <a
                                    href={String(att?.url || '#')}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-200"
                                    title={String(att?.name || tr({ it: 'Allegato', en: 'Attachment' }))}
                                  >
                                    <Paperclip size={11} />
                                    <span className="truncate">{String(att?.name || tr({ it: 'Allegato', en: 'Attachment' }))}</span>
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {reactionEntries.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {reactionEntries.map(([emoji, ids]) => (
                              <button
                                key={`${m.id}-${emoji}`}
                                type="button"
                                onClick={() => void addReaction(m.id, emoji)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${ids.includes(String(user.id || '')) ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-white/10 bg-black/20 text-slate-200'}`}
                              >
                                {emoji} {ids.length}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {!m.deleted ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <button type="button" onClick={() => setChatReplyToId(m.id)} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200">
                              <Reply size={11} className="inline mr-1" />
                              {tr({ it: 'Rispondi', en: 'Reply' })}
                            </button>
                            <button
                              type="button"
                              disabled={chatActionBusyId === m.id}
                              onClick={() => void toggleStar(m)}
                              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-50"
                            >
                              <Star size={11} className={`inline mr-1 ${starred ? 'fill-amber-300 text-amber-300' : ''}`} />
                              {starred ? tr({ it: 'Rimuovi stella', en: 'Unstar' }) : tr({ it: 'Stella', en: 'Star' })}
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setChatReactionForId((prev) => (prev === m.id ? null : m.id))}
                                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200"
                              >
                                <SmilePlus size={11} className="inline mr-1" />
                                {tr({ it: 'Reagisci', en: 'React' })}
                              </button>
                              {chatReactionForId === m.id ? (
                                <div className="absolute left-0 top-8 z-10 flex gap-1 rounded-xl border border-white/10 bg-slate-950 p-1 shadow-xl">
                                  {['👍', '❤️', '😂', '👏', '✅', '🔥'].map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      disabled={chatActionBusyId === m.id}
                                      onClick={() => void addReaction(m.id, emoji)}
                                      className="rounded-lg px-1.5 py-1 text-base hover:bg-white/5 disabled:opacity-50"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            {mine && !m.deleted ? (
                              <>
                                {!!user?.id && canEditChatMessage(m, String(user.id)) ? (
                                  <button type="button" onClick={() => startEditChatMessage(m)} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200">
                                    <Pencil size={11} className="inline mr-1" />
                                    {tr({ it: 'Modifica', en: 'Edit' })}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={chatActionBusyId === m.id}
                                  onClick={() => void removeChatMessage(m)}
                                  className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200 disabled:opacity-50"
                                >
                                  <Trash2 size={11} className="inline mr-1" />
                                  {tr({ it: 'Elimina...', en: 'Delete...' })}
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!chatMessages.length && !chatBusy ? <div className="text-sm text-slate-400">{tr({ it: 'Nessun messaggio.', en: 'No messages.' })}</div> : null}
                  </div>

                  <div
                    className="sticky bottom-0 border-t border-white/10 bg-slate-950/95 px-3 pt-2 pb-2 backdrop-blur"
                    style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 8px + ${mobileKeyboardInset}px)` }}
                  >
                    {chatError ? <div className="mb-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{chatError}</div> : null}
                    {chatReplyTarget ? (
                      <div className="mb-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{tr({ it: 'Risposta a', en: 'Replying to' })} {getChatMessageAuthorName(chatReplyTarget)}</div>
                            <div className="truncate text-cyan-200/80">
                              {String(chatReplyTarget.text || '').trim() || ((chatReplyTarget.attachments || []).length ? tr({ it: '[Allegato]', en: '[Attachment]' }) : tr({ it: '[Messaggio]', en: '[Message]' }))}
                            </div>
                          </div>
                          <button type="button" onClick={() => setChatReplyToId(null)} className="rounded-md p-1 hover:bg-white/10">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {chatPendingAttachments.length ? (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {chatPendingAttachments.map((att, idx) => (
                          <div key={`pending-${idx}-${att.name}`} className="max-w-full">
                            {String(att?.mime || '').startsWith('image/') ? (
                              <img src={att.dataUrl} alt="" className="mb-1 max-h-24 max-w-[120px] rounded-lg border border-white/10 object-cover" />
                            ) : null}
                            {isAudioAttachment(att?.mime, att?.name) ? (
                              <MobileAudioClip src={att.dataUrl} mime={att.mime || undefined} name={att.name || undefined} className="mb-1 h-8 max-w-full" />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setChatPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-200"
                              title={tr({ it: 'Rimuovi allegato', en: 'Remove attachment' })}
                            >
                              <Paperclip size={11} />
                              <span className="truncate">{att.name}</span>
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {chatAttachmentsBusy ? (
                      <div className="mb-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                        {tr({ it: 'Preparazione allegati: attendi qualche secondo...', en: 'Preparing attachments: please wait a few seconds...' })}
                      </div>
                    ) : null}
                    {voiceRecordError ? <div className="mb-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{voiceRecordError}</div> : null}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => chatFileInputRef.current?.click()}
                        disabled={!chatClientId || chatBusy}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-200 disabled:opacity-50"
                        title={tr({ it: 'Allega file', en: 'Attach file' })}
                      >
                        <Paperclip size={14} />
                      </button>
                      <input
                        ref={chatFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void handleChatFiles(e.target.files);
                          e.currentTarget.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (voiceRecording) void stopVoiceRecording();
                          else void startVoiceRecording();
                        }}
                        disabled={!chatClientId || chatBusy}
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50 ${
                          voiceRecording ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-white/10 bg-black/20 text-slate-200'
                        }`}
                        title={voiceRecording ? tr({ it: 'Ferma registrazione', en: 'Stop recording' }) : tr({ it: 'Registra messaggio vocale', en: 'Record voice message' })}
                      >
                        {voiceRecording ? <Square size={14} /> : <Mic size={14} />}
                      </button>
                      <input
                        ref={chatInputRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={() => {
                          window.setTimeout(() => {
                            const el = chatMessagesScrollRef.current;
                            if (el) el.scrollTop = el.scrollHeight;
                          }, 80);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm"
                        placeholder={chatClientId ? tr({ it: 'Scrivi un messaggio...', en: 'Write a message...' }) : tr({ it: 'Seleziona un client', en: 'Select a client' })}
                        disabled={!chatClientId || chatBusy}
                      />
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={!chatClientId || (!chatInput.trim() && !chatPendingAttachments.length) || chatBusy}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      >
                        <Send size={14} />
                        {tr({ it: 'Invia', en: 'Send' })}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'checkin' ? (
            <div className="mt-4 space-y-3">
              {!meetingsForSelectedRoom.length && !agendaLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-300">
                  {selectedRoomId
                    ? tr({ it: 'Nessun meeting trovato per la sala QR selezionata.', en: 'No meeting found for the selected QR room.' })
                    : tr({ it: 'Nessun meeting disponibile per il check-in nella giornata selezionata.', en: 'No meeting available for check-in on the selected day.' })}
                </div>
              ) : null}
              {meetingsForSelectedRoom.map((meeting) => {
                const p = (meeting as any).participantMatch || {};
                const key = buildCheckInKeyForParticipantMatch(meeting);
                const checked = !!((checkInMapByMeetingId[String(meeting.id)] || {})[key]);
                const checkedAt = (checkInTsByMeetingId[String(meeting.id)] || {})[key];
                const { inProgress, isPast } = getMeetingTemporalState(meeting.startAt, meeting.endAt, now);
                const roomMatched = !selectedRoomId || String(meeting.roomId) === String(selectedRoomId);
                const remote = !!p.remote;
                const toneClass = inProgress
                  ? 'border-emerald-400/30 bg-emerald-500/10'
                  : isPast
                    ? 'border-white/10 bg-white/5'
                    : 'border-violet-400/20 bg-violet-500/5';
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={`ci-${meeting.id}`}
                    onClick={() => openMeetingDetail(meeting)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openMeetingDetail(meeting);
                      }
                    }}
                    className={`w-full rounded-2xl border p-3 text-left ${roomMatched ? toneClass : `${toneClass} opacity-60`}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{meeting.subject || meetingLabel}</div>
                        <div className="mt-1 text-xs text-slate-300">
                          {meeting.roomName} • {meeting.siteName} • {meeting.floorPlanName}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatTime(meeting.startAt, locale)} - {formatTime(meeting.endAt, locale)} • {remote ? tr({ it: 'Partecipante remoto', en: 'Remote participant' }) : tr({ it: 'In sede', en: 'On-site' })}
                        </div>
                        {checkedAt ? <div className="mt-1 text-[11px] text-emerald-300">{checkInPrefixLabel}: {formatDateTime(checkedAt, locale)}</div> : null}
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-bold ${checked ? 'bg-emerald-500/20 text-emerald-200' : remote ? 'bg-indigo-500/20 text-indigo-200' : inProgress ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-700/70 text-slate-300'}`}>
                        {checked
                          ? checkedLabel
                          : remote
                            ? remoteShortLabel
                            : inProgress
                              ? tr({ it: 'IN CORSO', en: 'IN PROGRESS' })
                              : tr({ it: 'NON ATTIVO', en: 'INACTIVE' })}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {!remote ? (
                        <button
                          type="button"
                          disabled={!inProgress}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void doMobileCheckIn(meeting, !checked);
                          }}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                            checked
                              ? 'border border-rose-400/30 bg-rose-500/10 text-rose-200'
                              : 'bg-emerald-500 px-3 py-2 text-slate-950'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <CheckCircle2 size={15} />
                          {checked ? tr({ it: 'Rimuovi check-in', en: 'Remove check-in' }) : 'Check-in'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {scannerOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 16px)',
            paddingRight: 'calc(env(safe-area-inset-right, 0px) + 16px)'
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-semibold">{tr({ it: 'Scansiona QR kiosk', en: 'Scan kiosk QR' })}</div>
              <button type="button" onClick={() => setScannerOpen(false)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" title={tr({ it: 'Chiudi scanner', en: 'Close scanner' })}>
                <X size={16} />
              </button>
            </div>
            {scannerSupported ? (
              <>
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="h-64 w-full object-cover" />
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {tr({ it: 'Punta la fotocamera verso il QR code mostrato nel kiosk della sala.', en: 'Point the camera at the QR code shown on the room kiosk.' })}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {tr({ it: 'Questo browser non supporta la scansione QR integrata. Usa ', en: 'This browser does not support built-in QR scanning. Use ' })}
                <b>{tr({ it: 'Apri foto / QR', en: 'Open photo / QR' })}</b>
                {tr({ it: ' per scattare o selezionare una foto del QR, oppure incolla il link del kiosk.', en: ' to take or select a QR photo, or paste the kiosk link.' })}
              </div>
            )}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr({ it: 'Fallback manuale', en: 'Manual fallback' })}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void pasteScannerLinkFromClipboard()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm active:scale-[0.99]"
                >
                  <QrCode size={14} />
                  {tr({ it: 'Incolla link dagli appunti', en: 'Paste link from clipboard' })}
                </button>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm active:scale-[0.99]">
                  <ScanLine size={14} />
                  {scannerImageBusy ? tr({ it: 'Analizzo immagine…', en: 'Analyzing image…' }) : tr({ it: 'Apri foto / QR', en: 'Open photo / QR' })}
                  <input
                    ref={scannerFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void detectQrFromImageFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <input
                value={scannerManualValue}
                onChange={(e) => setScannerManualValue(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder={tr({ it: 'Incolla URL kiosk o QR payload', en: 'Paste kiosk URL or QR payload' })}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rid = parseRoomIdFromQrPayload(scannerManualValue);
                    if (!rid) {
                      setScannerError(tr({ it: 'QR/link non valido', en: 'Invalid QR/link' }));
                      return;
                    }
                    applyScannedRoomId(rid);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
                >
                  <Smartphone size={14} />
                  {tr({ it: 'Usa link', en: 'Use link' })}
                </button>
                {scannerDetecting ? <span className="text-xs text-slate-400">{tr({ it: 'Camera attiva…', en: 'Camera active…' })}</span> : null}
              </div>
              <div className="text-[11px] leading-relaxed text-slate-500">
                {tr({ it: 'iPhone/Safari: se la scansione live non è disponibile, usa ', en: 'iPhone/Safari: if live scanning is unavailable, use ' })}
                <b>{tr({ it: 'Apri foto / QR', en: 'Open photo / QR' })}</b>
                {tr({ it: ' (puoi scattare direttamente) oppure incolla qui il link del kiosk.', en: ' (you can take a picture directly) or paste the kiosk link here.' })}
              </div>
              {scannerError ? <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{scannerError}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {meetingDetailOpen ? (
        <div
          className="fixed inset-0 z-[75] bg-slate-950/85"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMeetingDetailOpen(null);
          }}
        >
          <div
            className="h-full w-full overflow-y-auto bg-slate-900 p-4 shadow-2xl"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
              paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const meeting = meetingDetailOpen;
              const p = (meeting as any).participantMatch || {};
              const key = buildCheckInKeyForParticipantMatch(meeting);
              const checked = !!((checkInMapByMeetingId[String(meeting.id)] || {})[key]);
              const checkedAt = (checkInTsByMeetingId[String(meeting.id)] || {})[key];
              const remote = !!p.remote;
              const { phase, inProgress, isPast } = getMeetingTemporalState(meeting.startAt, meeting.endAt, now);
              const allParticipants = Array.isArray(meeting.participants) ? meeting.participants : [];
              const externalDetails = Array.isArray(meeting.externalGuestsDetails) ? meeting.externalGuestsDetails : [];
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
                        <span>{meeting.subject || meetingLabel}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            remote
                              ? 'bg-indigo-500/20 text-indigo-200'
                              : checked
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : inProgress
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'bg-slate-700/60 text-slate-200'
                          }`}
                        >
                          {remote ? remoteShortLabel : checked ? checkInOkLabel : inProgress ? checkInPrefixLabel : checkInInactiveLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {meeting.clientName} • {meeting.siteName} • {meeting.floorPlanName}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        {meeting.roomName} • {formatDate(meeting.startAt, locale)} • {formatTime(meeting.startAt, locale)} - {formatTime(meeting.endAt, locale)}
                      </div>
                    </div>
                    <button type="button" onClick={() => setMeetingDetailOpen(null)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" title={tr({ it: 'Chiudi dettaglio riunione', en: 'Close meeting details' })}>
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'Stato', en: 'Status' })}</div>
                      <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${inProgress ? 'bg-emerald-500/20 text-emerald-200' : isPast ? 'bg-slate-700/70 text-slate-300' : 'bg-violet-500/20 text-violet-200'}`}>
                        {getMeetingTimePhaseBadgeLabel(phase, tr)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'Posti', en: 'Seats' })}</div>
                      <div className="mt-1 font-semibold text-slate-100">
                        {meeting.requestedSeats}/{meeting.roomCapacity}
                      </div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'La mia presenza', en: 'My attendance' })}</div>
                      <div className="mt-1 font-semibold text-slate-100">{String(p.fullName || '—')}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.email || '—'} • {remote ? tr({ it: 'Remoto', en: 'Remote' }) : tr({ it: 'In sede', en: 'On-site' })} {p.optional ? `• ${tr({ it: 'Opzionale', en: 'Optional' })}` : ''}
                      </div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'Partecipanti', en: 'Participants' })}</div>
                      <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                        {allParticipants.map((mp, idx) => (
                          <div key={`mp-${idx}-${String(mp.externalId || mp.fullName || '')}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-slate-100">{String(mp.fullName || '—')}</div>
                              <div className="truncate text-[10px] text-slate-400">
                                {mp.kind === 'manual' ? (mp.company ? `${mp.company} • ` : '') + tr({ it: 'Ospite esterno', en: 'External guest' }) : tr({ it: 'Utente interno', en: 'Internal user' })}
                                {mp.email ? ` • ${mp.email}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] text-slate-300">
                              {mp.remote ? remoteShortLabel : onSiteUpperLabel}{mp.optional ? ` • ${optionalShortLabel}` : ''}
                            </div>
                          </div>
                        ))}
                        {externalDetails.length
                          ? externalDetails.map((g, idx) => (
                              <div key={`gd-${idx}-${String(g.name || '')}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                                <div className="min-w-0">
                                  <div className="truncate text-[12px] font-semibold text-slate-100">{String(g.name || '—')}</div>
                                  <div className="truncate text-[10px] text-slate-400">
                                    {(g as any).company ? `${String((g as any).company)} • ` : ''}{tr({ it: 'Ospite esterno', en: 'External guest' })}{g.email ? ` • ${g.email}` : ''}
                                  </div>
                                </div>
                                <div className="shrink-0 text-[10px] text-slate-300">{g.remote ? remoteShortLabel : onSiteUpperLabel}</div>
                              </div>
                            ))
                          : null}
                        {(!Array.isArray(meeting.participants) || !meeting.participants.length) ? <div className="text-[11px] text-slate-400">{tr({ it: 'Nessuna lista partecipanti', en: 'No participants list' })}</div> : null}
                      </div>
                    </div>
                    {meeting.videoConferenceLink ? (
                      <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-slate-400">{tr({ it: 'Link video', en: 'Video link' })}</div>
                        <a
                          href={meeting.videoConferenceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-[12px] font-semibold text-cyan-200 underline decoration-cyan-200/40"
                        >
                          {meeting.videoConferenceLink}
                        </a>
                      </div>
                    ) : null}
                    {checkedAt ? (
                      <div className="col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
                        {checkInPrefixLabel}: {formatDateTime(checkedAt, locale)}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMeetingNotesOpen(meeting)}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100"
                    >
                      <NotebookPen size={15} />
                      {tr({ it: 'Note', en: 'Notes' })}
                    </button>
                    {!remote && inProgress ? (
                      <button
                        type="button"
                        onClick={() => void doMobileCheckIn(meeting, !checked)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                          checked ? 'border border-rose-400/30 bg-rose-500/10 text-rose-100' : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        <CheckCircle2 size={15} />
                        {checked ? tr({ it: 'Rimuovi check-in', en: 'Remove check-in' }) : checkInPrefixLabel}
                      </button>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {meetingCheckInPrompt ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
            <div className="text-base font-semibold text-slate-100">{tr({ it: 'Vuoi fare check-in ora?', en: 'Do you want to check in now?' })}</div>
            <div className="mt-1 text-sm text-slate-300">
              {meetingCheckInPrompt.subject || meetingLabel} • {formatTime(meetingCheckInPrompt.startAt, locale)} - {formatTime(meetingCheckInPrompt.endAt, locale)}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = meetingCheckInPrompt;
                  setMeetingCheckInPrompt(null);
                  setMeetingDetailOpen(target);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
              >
                {tr({ it: 'Più tardi', en: 'Later' })}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = meetingCheckInPrompt;
                  setMeetingCheckInPrompt(null);
                  void doMobileCheckIn(target, true);
                  setMeetingDetailOpen(target);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                <CheckCircle2 size={14} />
                Check-in
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {meetingNotesOpen ? (
        <div
          className="fixed inset-0 z-[86] flex items-end justify-center bg-slate-950/80 p-3 sm:items-center"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            requestCloseMeetingNotes();
          }}
        >
          <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-slate-100">{tr({ it: 'Note meeting', en: 'Meeting notes' })}</div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {meetingNotesOpen.subject || meetingLabel} • {meetingNotesOpen.roomName} • {formatDate(meetingNotesOpen.startAt, locale)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  requestCloseMeetingNotes();
                }}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/5"
                title={tr({ it: 'Chiudi note', en: 'Close notes' })}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-slate-300">{tr({ it: 'Le mie note meeting', en: 'My meeting notes' })}</div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
                  {meetingMyNoteShared ? tr({ it: 'Condivisa', en: 'Shared' }) : tr({ it: 'Personale', en: 'Personal' })}
                </span>
              </div>
              <input
                value={meetingMyNoteTitle}
                onChange={(e) => setMeetingMyNoteTitle(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder={tr({ it: 'Titolo nota', en: 'Note title' })}
              />
              <textarea
                value={meetingMyNoteText}
                onChange={(e) => setMeetingMyNoteText(e.target.value)}
                rows={16}
                className="mt-2 min-h-0 w-full flex-1 resize-none rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder={tr({ it: 'Scrivi le tue note...', en: 'Write your notes...' })}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[12px] text-slate-300">
                  <input type="checkbox" checked={meetingMyNoteShared} onChange={(e) => setMeetingMyNoteShared(e.target.checked)} />
                  {tr({ it: 'Condividi con i partecipanti al meeting', en: 'Share with meeting participants' })}
                </label>
                <button
                  type="button"
                  onClick={() => void saveMeetingSimpleNote()}
                  disabled={meetingNotesSaving || !meetingNotesDirty}
                  className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                >
                  {meetingNotesSaving ? tr({ it: 'Salvataggio…', en: 'Saving…' }) : tr({ it: 'Salva nota', en: 'Save note' })}
                </button>
              </div>
              {meetingNotesError ? <div className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">{meetingNotesError}</div> : null}
              {meetingNotesLoading ? <div className="mt-2 text-[11px] text-slate-400">{tr({ it: 'Caricamento note…', en: 'Loading notes…' })}</div> : null}
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-slate-300">{tr({ it: 'Note condivise', en: 'Shared notes' })}</div>
                  <div className="text-[11px] text-slate-500">{tr({ it: `${meetingNotesParticipants.filter((p) => p.hasShared).length} partecipanti hanno condiviso`, en: `${meetingNotesParticipants.filter((p) => p.hasShared).length} participants shared` })}</div>
                </div>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                  {meetingNotesList.filter((n) => n.shared && String(n.authorUserId || '') !== String(user?.id || '')).length ? (
                    meetingNotesList
                      .filter((n) => n.shared && String(n.authorUserId || '') !== String(user?.id || ''))
                      .map((n) => (
                        <button
                          key={`shared-note-${n.id}`}
                          type="button"
                          onClick={() => setMeetingSharedNotePreview(n)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left hover:bg-white/10"
                        >
                          <div className="truncate text-[12px] font-semibold text-slate-100">
                            {String(n.authorDisplayName || n.authorUsername || '—')} - {String(n.title || tr({ it: 'Nota condivisa', en: 'Shared note' }))}
                          </div>
                          <div className="truncate text-[10px] text-slate-400">{formatDateTime(n.updatedAt, locale)}</div>
                        </button>
                      ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-2 py-2 text-[11px] text-slate-400">{tr({ it: 'Nessuna nota condivisa per questo meeting.', en: 'No shared notes for this meeting.' })}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {meetingSharedNotePreview ? (
        <div className="fixed inset-0 z-[87] flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setMeetingSharedNotePreview(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-slate-100">{meetingSharedNotePreview.title || tr({ it: 'Nota condivisa', en: 'Shared note' })}</div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {meetingSharedNotePreview.authorDisplayName || meetingSharedNotePreview.authorUsername || '—'} • {formatDateTime(meetingSharedNotePreview.updatedAt, locale)}
                </div>
              </div>
              <button type="button" onClick={() => setMeetingSharedNotePreview(null)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
              {String(meetingSharedNotePreview.contentText || '').trim() || '—'}
            </div>
          </div>
        </div>
      ) : null}
      {chatDeletePrompt ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setChatDeletePrompt(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold text-slate-100">{tr({ it: 'Elimina messaggio', en: 'Delete message' })}</div>
            <div className="mt-1 text-sm text-slate-300">
              {chatDeletePrompt.allowAll
                ? tr({ it: 'Scegli se vuoi eliminarlo solo per te o per tutti.', en: 'Choose if you want to delete it only for you or for everyone.' })
                : tr({ it: 'Elimina per tutti non è più disponibile dopo 30 minuti.', en: 'Delete for everyone is no longer available after 30 minutes.' })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setChatDeletePrompt(null)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                {tr({ it: 'Annulla', en: 'Cancel' })}
              </button>
              <button type="button" onClick={() => void confirmChatDeleteMode('me')} className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200">
                {tr({ it: 'Elimina per me', en: 'Delete for me' })}
              </button>
              {chatDeletePrompt.allowAll ? (
                <button type="button" onClick={() => void confirmChatDeleteMode('all')} className="rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200">
                  {tr({ it: 'Elimina per tutti', en: 'Delete for everyone' })}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={!!mobileConfirm}
        title={mobileConfirm?.title || tr({ it: 'Conferma', en: 'Confirm' })}
        description={mobileConfirm?.description}
        onCancel={() => setMobileConfirm(null)}
        onConfirm={() => {
          if (!mobileConfirm) return;
          void mobileConfirm.onConfirm();
        }}
        confirmLabel={mobileConfirm?.confirmLabel || tr({ it: 'Conferma', en: 'Confirm' })}
        cancelLabel={mobileConfirm?.cancelLabel || tr({ it: 'Annulla', en: 'Cancel' })}
        zIndexClass="z-[250]"
      />
    </div>
  );
};

export default MobileAppPage;
