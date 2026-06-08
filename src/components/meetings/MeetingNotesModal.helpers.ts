import jsPDF from 'jspdf';
import type { useT } from '../../i18n/useT';
import type { MeetingManagerAction } from '../../api/meetings';

// Build the task activity-log events across a follow-up timeline chain. Pure.
export const computeTimelineTaskEvents = (
  timelineChain: any[],
  t: ReturnType<typeof useT>,
  sanitizeManagerActionsForPersist: (actions: any[]) => MeetingManagerAction[]
) => {
  const events: Array<{ id: string; ts: number; taskLabel: string; meetingLabel: string; actionLabel: string; tone: string }> = [];
  let previousByKey = new Map<string, MeetingManagerAction>();
  for (const row of timelineChain) {
    const meeting = row.entry.meeting;
    const meetingTs = Number(meeting.startAt || 0) || Date.now();
    const meetingLabel = `${new Date(meetingTs).toLocaleDateString()} • ${meeting.roomName || '-'}`;
    const currentActions = sanitizeManagerActionsForPersist(Array.isArray(row.entry.managerFields.actions) ? row.entry.managerFields.actions : []);
    const currentByKey = new Map<string, MeetingManagerAction>();
    currentActions.forEach((actionRow, actionIndex) => {
      const keyBase = `${String(actionRow.action || '').trim().toLowerCase()}|${String(actionRow.assignedTo || '').trim().toLowerCase()}`;
      const key = keyBase || `${String(meeting.id || '')}::${actionIndex}`;
      currentByKey.set(key, actionRow);
      const prev = previousByKey.get(key);
      const taskLabel = String(actionRow.action || '').trim() || `${t({ it: 'Task', en: 'Task' })} ${actionIndex + 1}`;
      const actionTs = meetingTs + actionIndex;
      if (!prev) {
        events.push({ id: `${key}-created-${actionTs}`, ts: actionTs, taskLabel, meetingLabel, actionLabel: t({ it: 'Task creata', en: 'Task created' }), tone: 'border-sky-200 bg-sky-50 text-sky-800' });
        return;
      }
      const prevDueTs = parseIsoDay(String(prev.completionDate || ''));
      const nextDueTs = parseIsoDay(String(actionRow.completionDate || ''));
      if (String(prev.completionDate || '') !== String(actionRow.completionDate || '')) {
        const label =
          Number.isFinite(Number(prevDueTs)) && Number.isFinite(Number(nextDueTs))
            ? Number(nextDueTs) > Number(prevDueTs)
              ? t({ it: 'Scadenza prolungata', en: 'Deadline extended' })
              : t({ it: 'Scadenza anticipata', en: 'Deadline moved earlier' })
            : t({ it: 'Scadenza aggiornata', en: 'Deadline updated' });
        events.push({ id: `${key}-due-${actionTs}`, ts: actionTs + 100, taskLabel, meetingLabel, actionLabel: label, tone: 'border-violet-200 bg-violet-50 text-violet-800' });
      }
      const prevProgress = normalizeActionProgress(Number(prev.progressPct || 0));
      const nextProgress = normalizeActionProgress(Number(actionRow.progressPct || 0));
      if (prevProgress !== nextProgress) {
        events.push({ id: `${key}-progress-${actionTs}`, ts: actionTs + 200, taskLabel, meetingLabel, actionLabel: t({ it: `Avanzamento ${nextProgress}%`, en: `Progress ${nextProgress}%` }), tone: 'border-amber-200 bg-amber-50 text-amber-800' });
      }
      if (String(prev.status || 'open') !== String(actionRow.status || 'open')) {
        const statusLabel =
          String(actionRow.status || '') === 'done'
            ? t({ it: 'Task chiusa', en: 'Task closed' })
            : String(actionRow.status || '') === 'not_needed'
              ? t({ it: 'Task non necessaria', en: 'Task marked not needed' })
              : t({ it: 'Task riaperta', en: 'Task reopened' });
        events.push({ id: `${key}-status-${actionTs}`, ts: actionTs + 300, taskLabel, meetingLabel, actionLabel: statusLabel, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' });
      }
    });
    for (const [key, oldAction] of previousByKey.entries()) {
      if (currentByKey.has(key)) continue;
      events.push({ id: `${key}-removed-${meetingTs}`, ts: meetingTs - 1, taskLabel: String(oldAction.action || '').trim() || t({ it: 'Task', en: 'Task' }), meetingLabel, actionLabel: t({ it: 'Task eliminata', en: 'Task deleted' }), tone: 'border-rose-200 bg-rose-50 text-rose-800' });
    }
    previousByKey = currentByKey;
  }
  return events.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
};

// Derive task statistics/insights from the normalized manager actions. Pure.
export const computeActionInsights = (normalizedManagerActions: any[], t: ReturnType<typeof useT>) => {
  const rows = normalizedManagerActions.filter((row) => row.action || row.assignedTo || row.openingDate || row.completionDate || Number(row.progressPct || 0) > 0);
  const total = rows.length;
  const done = rows.filter((row) => row.status === 'done' || Number(row.progressPct || 0) >= 100).length;
  const notNeeded = rows.filter((row) => row.status === 'not_needed').length;
  const inProgress = Math.max(0, total - done - notNeeded);
  const todayIso = toIsoDay(Date.now());
  const overdue = rows.filter((row) => row.completionDate && row.completionDate < todayIso && row.status !== 'done' && row.status !== 'not_needed').length;
  const closedDurations = rows
    .filter((row) => row.status === 'done')
    .map((row) => {
      const fromTs = parseIsoDay(row.openingDate || row.completionDate);
      const toTs = parseIsoDay(row.completionDate || row.openingDate);
      if (!Number.isFinite(Number(fromTs)) || !Number.isFinite(Number(toTs))) return null;
      const delta = Math.max(0, Number(toTs) - Number(fromTs));
      return Math.max(1, Math.round(delta / DAY_MS) + 1);
    })
    .filter((value): value is number => Number.isFinite(Number(value)));
  const avgResolutionDays = closedDurations.length
    ? Number((closedDurations.reduce((sum, value) => sum + value, 0) / closedDurations.length).toFixed(1))
    : 0;
  const completionRate = total ? Math.round((done / total) * 100) : 0;
  const taskProgressBars = rows.map((row, index) => {
    const progressPct = normalizeActionProgress(Number(row.progressPct || 0));
    const tone = row.status === 'not_needed' ? 'bg-slate-400' : progressPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500';
    const openingLabel = formatIsoDayLabel(String(row.openingDate || ''));
    const completionLabel = formatIsoDayLabel(String(row.completionDate || ''));
    const completionTs = parseIsoDay(String(row.completionDate || ''));
    const daysLeft = Number.isFinite(Number(completionTs)) ? Math.ceil((Number(completionTs) - Date.now()) / DAY_MS) : null;
    const daysLeftLabel =
      daysLeft === null
        ? t({ it: 'n/d', en: 'n/a' })
        : daysLeft >= 0
          ? t({ it: `${daysLeft} giorni`, en: `${daysLeft} days left` })
          : t({ it: `${Math.abs(daysLeft)} giorni in ritardo`, en: `${Math.abs(daysLeft)} days overdue` });
    return { id: `task-progress-${index}`, row, index, progressPct, tone, openingLabel, completionLabel, daysLeftLabel };
  });
  return { rows, total, done, inProgress, notNeeded, overdue, avgResolutionDays, completionRate, taskProgressBars };
};

// Pure helpers extracted from MeetingNotesModal.tsx: HTML stripping, date/ISO-day
// formatting, check-in key building, action-progress normalization, and the PDF
// text-normalization / wrapping utilities. No React or component state.

export const stripHtml = (value: string) =>
  String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|li|ul|ol|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const TRANSLATE_LANGUAGE_OPTIONS: Array<{
  code: string;
  flag: string;
  label: string;
  native: string;
  aiLabel: string;
}> = [
  { code: 'en', flag: '🇬🇧', label: 'English', native: 'English', aiLabel: 'English' },
  { code: 'zh', flag: '🇨🇳', label: 'Chinese', native: '中文', aiLabel: 'Chinese (Mandarin)' },
  { code: 'hi', flag: '🇮🇳', label: 'Hindi', native: 'हिन्दी', aiLabel: 'Hindi' },
  { code: 'es', flag: '🇪🇸', label: 'Spanish', native: 'Español', aiLabel: 'Spanish' },
  { code: 'fr', flag: '🇫🇷', label: 'French', native: 'Français', aiLabel: 'French' },
  { code: 'ar', flag: '🇸🇦', label: 'Arabic', native: 'العربية', aiLabel: 'Arabic' },
  { code: 'pt', flag: '🇵🇹', label: 'Portuguese', native: 'Português', aiLabel: 'Portuguese' },
  { code: 'ru', flag: '🇷🇺', label: 'Russian', native: 'Русский', aiLabel: 'Russian' },
  { code: 'de', flag: '🇩🇪', label: 'German', native: 'Deutsch', aiLabel: 'German' },
  { code: 'ko', flag: '🇰🇷', label: 'Korean', native: '한국어', aiLabel: 'Korean' },
  { code: 'sv', flag: '🇸🇪', label: 'Swedish', native: 'Svenska', aiLabel: 'Swedish' },
  { code: 'it', flag: '🇮🇹', label: 'Italian', native: 'Italiano', aiLabel: 'Italian' }
];

export const formatStamp = (ts: number) => {
  if (!Number.isFinite(Number(ts || 0)) || Number(ts) <= 0) return '—';
  return new Date(Number(ts)).toLocaleString();
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export const parseIsoDay = (value: string) => {
  const normalized = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  const ts = parsed.getTime();
  return Number.isFinite(ts) ? ts : null;
};

export const toIsoDay = (ts: number) => {
  const date = new Date(Number(ts || 0));
  if (!Number.isFinite(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatIsoDayLabel = (value: string) => {
  const ts = parseIsoDay(value);
  if (!Number.isFinite(Number(ts))) return '—';
  return new Date(Number(ts)).toLocaleDateString();
};

export const getDayOffsetFromToday = (ts: number) => {
  const target = new Date(Number(ts || 0));
  if (!Number.isFinite(target.getTime())) return null;
  const now = new Date();
  const todayStartTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const targetStartTs = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime();
  return Math.round((targetStartTs - todayStartTs) / DAY_MS);
};

export const buildCheckInKeyForParticipant = (participant: any) => {
  const tag = participant?.optional ? 'OPT' : 'INT';
  const label = String(participant?.fullName || participant?.externalId || '-')
    .trim()
    .toLowerCase();
  const email = String(participant?.email || '')
    .trim()
    .toLowerCase();
  return `${tag}::${label}::${email}`;
};

export const normalizeActionProgress = (value: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const stepped = Math.round(numeric / 5) * 5;
  return Math.max(0, Math.min(100, stepped));
};

export const NEW_NOTE_ID = '__new__';
export const toCompanyKey = (value: string) => String(value || '').trim().toLowerCase();

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });

export const fetchImageAsDataUrl = async (url: string) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return null;
  try {
    const response = await fetch(normalizedUrl, { credentials: 'include' });
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
};

export const sanitizeFileName = (value: string, fallback: string) => {
  const base = String(value || '').trim() || String(fallback || '').trim() || 'Meeting-notes';
  const safe = base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const withExt = safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
  return withExt || 'Meeting-notes.pdf';
};

export const normalizePdfText = (value: string) =>
  (() => {
    const collapseSpacedLetters = (input: string) =>
      input.replace(/((?:\b[\p{L}\p{N}]\b(?:\s+|$)){3,})/gu, (match) => match.replace(/\s+/g, "").trim());
    let normalized = String(value || "")
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
      .replace(/[\u00a0\u1680\u180e\u2000-\u200d\u2028\u2029\u202f\u205f\u3000]/g, " ");
    normalized = collapseSpacedLetters(normalized);
    return normalized
      .replace(/\s+([,.;:!?)\]\}])/g, "$1")
      .replace(/([(\[\{])\s+/g, "$1")
      .replace(/\s*\/\s*/g, "/")
      .replace(/\s+/g, " ")
      .trim();
  })();

export const normalizePdfNoteText = (value: string) => {
  let normalized = normalizePdfText(stripHtml(value));
  for (let pass = 0; pass < 3; pass += 1) {
    normalized = normalized.replace(/((?:\b[\p{L}\p{N}]\b(?:\s+|$)){3,})/gu, (match) => match.replace(/\s+/g, '').trim());
  }
  return normalized || '—';
};

export const wrapPdfTextToWidth = (doc: jsPDF, text: string, maxWidth: number): string[] => {
  const normalized = normalizePdfText(text);
  if (!normalized) return [''];
  const paragraphs = normalized
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const lines: string[] = [];
  const appendToken = (token: string, current: string) => {
    const candidate = current ? `${current} ${token}` : token;
    if (doc.getTextWidth(candidate) <= maxWidth) return { current: candidate, flushed: [] as string[] };
    if (doc.getTextWidth(token) <= maxWidth) {
      return current ? { current: token, flushed: [current] } : { current: token, flushed: [] as string[] };
    }
    const flushed: string[] = [];
    if (current) flushed.push(current);
    let chunk = '';
    for (const ch of [...token]) {
      const probe = `${chunk}${ch}`;
      if (!chunk || doc.getTextWidth(probe) <= maxWidth) {
        chunk = probe;
      } else {
        flushed.push(chunk);
        chunk = ch;
      }
    }
    return { current: chunk, flushed };
  };
  paragraphs.forEach((paragraph, idx) => {
    const tokens = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const token of tokens) {
      const { current: nextCurrent, flushed } = appendToken(token, current);
      if (flushed.length) lines.push(...flushed);
      current = nextCurrent;
    }
    if (current) lines.push(current);
    if (idx < paragraphs.length - 1) lines.push('');
  });
  return lines.length ? lines : [''];
};
