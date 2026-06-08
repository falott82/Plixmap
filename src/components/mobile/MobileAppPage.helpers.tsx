/* eslint-disable @typescript-eslint/no-explicit-any */
// Types, constants, pure helpers + MobileAudioClip extracted verbatim from MobileAppPage (<2k).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Pause, Play } from 'lucide-react';
import { fetchMobileAgenda, fetchMobileAgendaMonth, type MobileAgendaMeeting } from '../../api/mobile';
import { fetchMobileChatOverview, type ChatMessage } from '../../api/chat';


export type MobileTab = 'agenda' | 'chat' | 'checkin';
export type MobileChatViewMode = 'list' | 'thread';
export type MobileConfirmState = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export const MOBILE_LOGIN_STORAGE_KEY = 'plixmap:mobile:loginPrefs';
export const MOBILE_AGENDA_CACHE_TTL_MS = 45_000;
export const MOBILE_AGENDA_CACHE_MAX_ENTRIES = 12;
export const MOBILE_AGENDA_MONTH_CACHE_TTL_MS = 5 * 60_000;
export const MOBILE_CHAT_RETENTION_DAYS = 14;
export const MOBILE_CHAT_RETENTION_MS = MOBILE_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const MOBILE_AGENDA_SESSION_CACHE_TTL_MS = 5 * 60_000;
export const MOBILE_AGENDA_SESSION_CACHE_PREFIX = 'plixmap:mobile:agenda-cache:v1:';
export const MOBILE_CHAT_OVERVIEW_SESSION_CACHE_TTL_MS = 2 * 60_000;
export const MOBILE_CHAT_OVERVIEW_SESSION_CACHE_PREFIX = 'plixmap:mobile:chat-overview:v1:';
export const MOBILE_CHAT_THREAD_SESSION_CACHE_TTL_MS = 10 * 60_000;
export const MOBILE_CHAT_THREAD_SESSION_CACHE_PREFIX = 'plixmap:mobile:chat-thread:v1:';
export const MOBILE_THEME_STORAGE_KEY = 'plixmap:mobile:theme';
export type MobileAgendaPayload = Awaited<ReturnType<typeof fetchMobileAgenda>>;
export type MobileAgendaMonthPayload = Awaited<ReturnType<typeof fetchMobileAgendaMonth>>;
export type MobileChatOverviewPayload = Awaited<ReturnType<typeof fetchMobileChatOverview>>;
export const mobileAgendaMemoryCache = new Map<string, { at: number; payload: MobileAgendaPayload }>();
export const mobileAgendaMonthMemoryCache = new Map<string, { at: number; payload: MobileAgendaMonthPayload }>();

export const scheduleWhenIdle = (work: () => void, timeoutMs = 1200): (() => void) => {
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

export const toLocalDay = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const nowDay = () => toLocalDay(Date.now());
export const formatTime = (ts: number, locale?: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
export const formatDate = (ts: number, locale?: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(ts));
export const formatMonthLabel = (monthKey: string, locale?: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
};
export const shiftIsoDayByMonths = (value: string, delta: number) => {
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
export const buildCalendarMonthCells = (monthKey: string) => {
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
export const formatDateTime = (ts?: number | null, locale?: string) =>
  Number.isFinite(Number(ts || 0))
    ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(Number(ts)))
    : '—';
export const formatAudioClock = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
export const safeDecodeUriPart = (value: string) => {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
};
export const normalizeDmThreadId = (value: unknown) => {
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
export const normalizeChatClientId = (value: unknown) => {
  const decoded = safeDecodeUriPart(String(value || '').trim());
  if (!decoded) return '';
  return normalizeDmThreadId(decoded);
};
export const getDmOtherUserId = (threadId: unknown, myUserId: unknown) => {
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
export const isAudioAttachment = (mime: unknown, name: unknown) =>
  String(mime || '').startsWith('audio/') || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(String(name || ''));
export const detectAudioMime = (mime: unknown, name: unknown) => {
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
export const getMobileChatCutoffTs = () => Date.now() - MOBILE_CHAT_RETENTION_MS;
export const filterRecentMobileChatMessages = <T extends { createdAt?: number | null }>(messages: T[]) => {
  const cutoff = getMobileChatCutoffTs();
  return (messages || []).filter((m) => Number(m?.createdAt || 0) >= cutoff);
};
export const canPlayAudioAttachment = (mime: unknown, name: unknown) => {
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

export const MobileAudioClip = ({ src, mime, name, className = '' }: { src: string; mime?: string; name?: string; className?: string }) => {
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

export const parseRoomIdFromQrPayload = (raw: string): string | null => {
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

export const resolveClientLogoUrl = (value: unknown): string => {
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

export const buildCheckInKeyForParticipantMatch = (meeting: MobileAgendaMeeting) => {
  const p = (meeting as any)?.participantMatch;
  if (!p) return '';
  const tag = p.optional ? 'OPT' : 'INT';
  const label = String(p.fullName || p.externalId || '-').trim().toLowerCase();
  const email = String(p.email || '').trim().toLowerCase();
  return `${tag}::${label}::${email}`;
};

export const normalizeChatText = (value: unknown) => String(value || '').trim().toLowerCase();
export const isOpaqueChatIdentity = (value: unknown) => {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^d[mn]:/i.test(v)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)) return true;
  return false;
};
export const readAgendaPayloadFromSessionCache = (cacheKey: string): { at: number; payload: MobileAgendaPayload } | null => {
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

export const writeAgendaPayloadToSessionCache = (cacheKey: string, payload: MobileAgendaPayload, at: number) => {
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

export const readMobileChatOverviewFromSessionCache = (cacheKey: string): { at: number; payload: MobileChatOverviewPayload } | null => {
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

export const writeMobileChatOverviewToSessionCache = (cacheKey: string, payload: MobileChatOverviewPayload, at: number) => {
  if (typeof window === 'undefined' || !cacheKey) return;
  try {
    const encoded = JSON.stringify({ at, payload });
    if (encoded.length > 350_000) return;
    window.sessionStorage.setItem(`${MOBILE_CHAT_OVERVIEW_SESSION_CACHE_PREFIX}${cacheKey}`, encoded);
  } catch {
    // ignore quota/sandbox errors
  }
};

export const readMobileChatThreadFromSessionCache = (cacheKey: string): { at: number; messages: ChatMessage[] } | null => {
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

export const writeMobileChatThreadToSessionCache = (cacheKey: string, messages: ChatMessage[], at: number) => {
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

export const chatSnippet = (msg: ChatMessage | null | undefined, tr: (m: { it: string; en: string }) => string) => {
  if (!msg) return '';
  if (msg.deleted) return tr({ it: '— messaggio eliminato —', en: '— message deleted —' });
  const text = String(msg.text || '').replace(/\s+/g, ' ').trim();
  if (text) return text;
  if (Array.isArray(msg.attachments) && msg.attachments.length) return tr({ it: '[Allegato]', en: '[Attachment]' });
  return '';
};

export const canEditChatMessage = (msg: ChatMessage, myUserId: string) => {
  if (!msg || msg.deleted) return false;
  if (String(msg.userId || '') !== String(myUserId || '')) return false;
  const ageMs = Date.now() - (Number(msg.createdAt) || 0);
  return ageMs <= 30 * 60 * 1000;
};

export const canDeleteChatForAll = (msg: ChatMessage, myUserId: string) => {
  if (!msg || msg.deleted) return false;
  if (String(msg.userId || '') !== String(myUserId || '')) return false;
  const ageMs = Date.now() - (Number(msg.createdAt) || 0);
  return ageMs <= 30 * 60 * 1000;
};


// Read a File as a data URL (Promise wrapper around FileReader). Pure utility.
export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

// Downscale/recompress image attachments to <=1280px JPEG; pass through
// GIF/SVG/non-image files unchanged. No component state.
export const compressImageAttachment = async (file: File) => {
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

export type MobileChatClientOption = {
  id: string;
  name: string;
  logoUrl: string;
  avatarUrl?: string;
  kind: 'client' | 'dm';
  lastMessageAt?: number | null;
};

// Build the unified chat client/DM option list (channels + DMs + the current
// selection fallback), de-duplicated by normalized id. Pure.
export const buildMobileChatClientOptions = (
  chatClientChannels: Array<{ id: string; name: string; logoUrl: string; lastMessageAt?: number | null }>,
  chatClientId: string,
  chatDmContacts: Array<{ id: string; threadId: string; name: string; avatarUrl?: string; lastMessageAt?: number | null }>,
  directMessageLabel: string
): MobileChatClientOption[] => {
  const rows: MobileChatClientOption[] = [];
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
};

// Filter the chat option list by search text and sort by most-recent message
// (within the retention cutoff), then by name. Pure.
export const sortFilterMobileChatClientOptions = (
  chatClientOptions: MobileChatClientOption[],
  chatSearch: string,
  chatLastMessageByClientId: Record<string, { createdAt?: number } | null>
): MobileChatClientOption[] => {
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
};
