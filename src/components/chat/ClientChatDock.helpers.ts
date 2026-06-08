/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChatMessage } from '../../api/chat';

// Pure constants + helpers extracted from ClientChatDock.tsx (no React deps).

export const MAX_NONVOICE_ATTACH_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 10 * 60;
export const MAX_VOICE_BYTES = 40 * 1024 * 1024; // keep in sync with server default limit
export const CHAT_HISTORY_FETCH_LIMIT = 180;
export const CHAT_REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🙏'] as const;
export const allowedExts = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'jfif',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
  'rar',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'mp4',
  'webm',
  'mov'
]);

export const parseMeetingRequestToken = (text: string): string | null => {
  const raw = String(text || '');
  const m = raw.match(/MEETING_REQUEST:([a-z0-9-]+)/i);
  return m?.[1] ? String(m[1]) : null;
};

export const extForMime = (mime: string) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/jpg') return 'jpg';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/webp') return 'webp';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'application/msword') return 'doc';
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (m === 'application/vnd.ms-excel') return 'xls';
  if (m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (m === 'application/vnd.ms-powerpoint') return 'ppt';
  if (m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (m === 'application/zip') return 'zip';
  if (m === 'application/x-zip-compressed') return 'zip';
  if (m === 'application/vnd.rar') return 'rar';
  if (m === 'application/x-rar-compressed') return 'rar';
  if (m === 'audio/mpeg' || m === 'audio/mp3') return 'mp3';
  if (m === 'audio/wav' || m === 'audio/x-wav' || m === 'audio/wave') return 'wav';
  if (m === 'audio/mp4' || m === 'audio/x-m4a') return 'm4a';
  if (m === 'audio/aac') return 'aac';
  if (m === 'audio/ogg') return 'ogg';
  if (m === 'audio/webm') return 'webm';
  if (m === 'video/mp4') return 'mp4';
  if (m === 'video/webm') return 'webm';
  if (m === 'video/quicktime') return 'mov';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
  return '';
};

export const safeFilename = (value: string) =>
  String(value || 'chat')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .slice(0, 40) || 'chat';

export const isDmThreadId = (id: string | null | undefined) => String(id || '').startsWith('dm:');
export const parseDmThreadId = (id: string) => {
  const s = String(id || '').trim();
  if (!s.startsWith('dm:')) return null;
  const parts = s.slice(3).split(':').map((p) => String(p || '').trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  return { a: parts[0], b: parts[1], pairKey: `${parts[0]}:${parts[1]}` };
};
export const dmThreadIdForUsers = (a: string, b: string) => {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x || !y) return '';
  const [u1, u2] = x < y ? [x, y] : [y, x];
  return `dm:${u1}:${u2}`;
};

export const snippet = (value: string, max = 90) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export const extOf = (name: string) => {
  const s = String(name || '').trim();
  const idx = s.lastIndexOf('.');
  if (idx === -1) return '';
  return s.slice(idx + 1).toLowerCase();
};

export const formatBytes = (bytes: number) => {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round((b / 1024) * 10) / 10} KB`;
  return `${Math.round((b / (1024 * 1024)) * 10) / 10} MB`;
};

export const isVoiceRecordingAttachment = (name: string, mime: string) => {
  const n = String(name || '').toLowerCase();
  const m = String(mime || '').toLowerCase();
  return n.startsWith('voice-') && m.startsWith('audio/');
};

export const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));

export const formatMmSs = (secs: number) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const mm = String(Math.floor(s / 60)).padStart(1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

export const capFirst = (value: string) => {
  const s = String(value || '').trim();
  if (!s) return '';
  return s[0].toUpperCase() + s.slice(1);
};

export const capWords = (value: string) => {
  const s = String(value || '').trim();
  if (!s) return '';
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => capFirst(w))
    .join(' ');
};

export const localDateKey = (ts: number) => {
  const d = new Date(Number(ts) || 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isAudioAttachment = (a: any) => {
  const mime = String(a?.mime || '').toLowerCase();
  const name = String(a?.name || '');
  const ext = extOf(name);
  if (mime.startsWith('audio/')) return true;
  if (!mime && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'].includes(ext)) return true;
  return false;
};

export const hasAudioMessage = (msg: ChatMessage) => {
  const atts = Array.isArray(msg.attachments) ? msg.attachments : [];
  return atts.some((a) => isAudioAttachment(a));
};

export const seededBars = (seed: string, count = 44) => {
  // Deterministic pseudo-random bars; avoids decoding audio (fast even for long voice notes).
  let x = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    x ^= seed.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const v = (x >>> 0) / 0xffffffff;
    // Bias toward mid bars, WhatsApp-like.
    out.push(0.2 + Math.pow(v, 0.65) * 0.8);
  }
  return out;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export const canEditMessage = (msg: ChatMessage, myUserId: string) => {
  if (msg.deleted) return false;
  if (String(msg.userId) !== String(myUserId)) return false;
  if (hasAudioMessage(msg)) return false;
  const age = Date.now() - (Number(msg.createdAt) || 0);
  return age <= 30 * 60 * 1000;
};

export const canDeleteForAll = (msg: ChatMessage, myUserId: string) => {
  if (msg.deleted) return false;
  if (String(msg.userId) !== String(myUserId)) return false;
  const age = Date.now() - (Number(msg.createdAt) || 0);
  return age <= 30 * 60 * 1000;
};
