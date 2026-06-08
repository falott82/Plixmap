// Pure types, helpers, constants and the meeting-room snapshot PNG builder, extracted
// verbatim from MeetingManagerModal.tsx to keep that component under 2k lines.
import { Clipboard, Coffee, Monitor, Snowflake, Tv, Video, Wifi } from 'lucide-react';
import type { Site, SiteScheduleDayKey } from '../../store/types';
import { currentLocalIsoDay } from '../../utils/localDate';

export type ExternalParticipant = {
  key: string;
  externalId: string;
  fullName: string;
  email: string;
  department?: string;
  phone?: string;
};

export type SelectedParticipant = {
  key: string;
  kind: 'real_user' | 'manual';
  externalId?: string | null;
  fullName: string;
  email?: string | null;
  optional: boolean;
  remote: boolean;
  company?: string | null;
};

export type NeedKey = 'projector' | 'tv' | 'videoConf' | 'coffee' | 'whiteboard' | 'guestWifi' | 'fridge';
export type KioskMeetingLanguage = 'auto' | 'it' | 'en' | 'ru' | 'ar' | 'zh';

export const NEED_CONFIG: Array<{
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

export const KIOSK_LANG_OPTIONS: Array<{ key: KioskMeetingLanguage; flag: string; labels: { it: string; en: string } }> = [
  { key: 'auto', flag: '🌐', labels: { it: 'Sistema', en: 'System' } },
  { key: 'it', flag: '🇮🇹', labels: { it: 'Italiano', en: 'Italian' } },
  { key: 'en', flag: '🇬🇧', labels: { it: 'Inglese', en: 'English' } },
  { key: 'ru', flag: '🇷🇺', labels: { it: 'Russo', en: 'Russian' } },
  { key: 'ar', flag: '🇸🇦', labels: { it: 'Arabo', en: 'Arabic' } },
  { key: 'zh', flag: '🇨🇳', labels: { it: 'Cinese', en: 'Chinese' } }
];

export const todayIso = () => currentLocalIsoDay();

export const defaultStartTime = () => {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes() < 30 ? 30 : 0;
  const hh = m === 30 ? h : h + 1;
  return `${String(Math.min(23, Math.max(8, hh))).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const addMinutesTime = (time: string, delta: number) => {
  const [h, m] = String(time || '09:00')
    .split(':')
    .map((v) => Number(v));
  const base = (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0) + delta;
  const min = Math.max(0, Math.min(23 * 60 + 59, base));
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const formatIsoLocalDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const timeToMinutes = (time: string) => {
  const [h, m] = String(time || '')
    .split(':')
    .map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
};

export const normalizeTypedTime = (value: string) => {
  const raw = String(value || '').trim();
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const toLocalTsFromDayAndTime = (day: string, time: string) => {
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

export const siteScheduleDayKeyFromIso = (isoDay: string): SiteScheduleDayKey | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  if (!Number.isFinite(date.getTime())) return null;
  const dayIndex = date.getDay();
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayIndex] || null) as SiteScheduleDayKey | null;
};

export const latestSiteScheduleEndTime = (site: Site | null | undefined, isoDay: string): string | null => {
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

export const normalizeEq = (value: string) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase();

export const roomPolygon = (room: any): Array<{ x: number; y: number }> => {
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

export const polygonCenter = (points: Array<{ x: number; y: number }>) => {
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

export const loadBrowserImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });

export const buildMeetingRoomSnapshotPng = async (params: {
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

export const resolveRoomServices = (equipment: string[]) => {
  const normalized = new Set((equipment || []).map((entry) => normalizeEq(entry)));
  return NEED_CONFIG.filter((need) => need.match.some((label) => normalized.has(normalizeEq(label))));
};

export const requiredAsterisk = <span className="ml-0.5 text-rose-600">*</span>;

// Build the room-preview floor-plan geometry (rooms + viewBox + image frame)
// for the meeting manager preview. Pure given the preview target, site and
// client. Extracted from MeetingManagerModal.
export const computeMeetingRoomPreviewData = (roomPreview: any, selectedSite: any, selectedClient: any) => {
  if (!roomPreview || !selectedSite) return null;
  const plan = (selectedSite.floorPlans || []).find((entry: any) => String(entry.id) === String(roomPreview.floorPlanId));
  if (!plan) return null;
  const rooms = (plan.rooms || [])
    .map((room: any) => {
      const points = roomPolygon(room);
      return {
        id: String(room?.id || ''),
        name: String(room?.name || ''),
        meetingRoom: !!(room as any)?.meetingRoom,
        points,
        center: polygonCenter(points)
      };
    })
    .filter((room: any) => room.id && room.points.length >= 3);
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
};

// Map external participant id -> overlapping meetings for the selected slot
// (dedup + sorted). Pure. Extracted from MeetingManagerModal.
export const computeParticipantMeetingConflicts = (
  overviewRows: any[],
  selectedSlotStartTs: number | null,
  selectedSlotEndTs: number | null
): Map<string, Array<{ meetingId: string; subject: string; roomName: string; startAt: number; endAt: number; status: string }>> => {
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
};
