import jsPDF from 'jspdf';

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
