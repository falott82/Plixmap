// Pure types, geometry helpers and safety-card constants extracted verbatim from
// SafetyPanel.tsx to keep that component under 2k lines.
import { Corridor, FloorPlan, Room, SecurityCheckEntry, SecurityDocumentEntry } from '../../store/types';
import { TEXT_FONT_OPTIONS } from '../../store/data';

export type Point = { x: number; y: number };

export type SafetySortKey =
  | 'clientName'
  | 'siteName'
  | 'planName'
  | 'typeLabel'
  | 'name'
  | 'description'
  | 'notes'
  | 'lastVerificationAt'
  | 'locationName';

export type DoorSortKey =
  | 'clientName'
  | 'siteName'
  | 'planName'
  | 'doorId'
  | 'description'
  | 'doorType'
  | 'lastVerificationAt'
  | 'verifierCompany'
  | 'corridorName'
  | 'nearestRoomName';

export type SafetyRow = {
  rowId: string;
  objectId: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  icon: string;
  typeLabel: string;
  name: string;
  description: string;
  notes: string;
  lastVerificationAt: string;
  verifierCompany: string;
  gpsCoords: string;
  locationName: string;
  point: Point;
  plan: FloorPlan;
  securityCheckHistory: SecurityCheckEntry[];
  securityDocuments: SecurityDocumentEntry[];
};

export type EmergencyDoorRow = {
  rowId: string;
  clientId: string;
  siteId: string;
  planId: string;
  clientName: string;
  siteName: string;
  planName: string;
  doorId: string;
  description: string;
  doorType: string;
  corridorName: string;
  nearestRoomName: string;
  lastVerificationAt: string;
  verifierCompany: string;
  openUrl: string;
  mode: string;
  isFireDoor: boolean;
  corridorId: string;
  plan: FloorPlan;
  verificationHistory: Array<{ id: string; date?: string; company: string; notes?: string; createdAt: number }>;
};

export const toRectPolygon = (x: number, y: number, width: number, height: number): Point[] => {
  if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

export const roomPolygon = (room: Room): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly' && Array.isArray(room?.points) && room.points.length >= 3) {
    return room.points.map((p) => ({ x: Number(p?.x || 0), y: Number(p?.y || 0) }));
  }
  return toRectPolygon(Number(room?.x || 0), Number(room?.y || 0), Number(room?.width || 0), Number(room?.height || 0));
};

export const corridorPolygon = (corridor: Corridor): Point[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly' && Array.isArray(corridor?.points) && corridor.points.length >= 3) {
    return corridor.points.map((p) => ({ x: Number(p?.x || 0), y: Number(p?.y || 0) }));
  }
  return toRectPolygon(
    Number(corridor?.x || 0),
    Number(corridor?.y || 0),
    Number(corridor?.width || 0),
    Number(corridor?.height || 0)
  );
};

export const polygonCentroid = (polygon: Point[]): Point | null => {
  if (!polygon.length) return null;
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) < 1e-6) {
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
};

export const pointInPolygon = (point: Point, polygon: Point[]) => {
  if (!polygon.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const getDoorAnchor = (corridor: Corridor, door: any): Point | null => {
  const points = corridorPolygon(corridor);
  if (points.length < 2) return null;
  const edgeIndex = Number(door?.edgeIndex);
  const t = Number(door?.t);
  if (!Number.isFinite(edgeIndex) || !Number.isFinite(t)) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  const clampedT = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * clampedT, y: a.y + (b.y - a.y) * clampedT };
};

export const polygonPath = (points: Point[]) => {
  if (!points.length) return '';
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;
};

export const compareText = (a: string, b: string, lang: string) => a.localeCompare(b, lang, { sensitivity: 'base' });
export const DEFAULT_SAFETY_CARD_LAYOUT = { x: 24, y: 24, w: 420, h: 84, fontSize: 10, fontIndex: 0, colorIndex: 0, textBgIndex: 0 } as const;
export const SAFETY_CARD_COLOR_VARIANTS = [
  { body: '#e0f2fe', header: '#bae6fd', border: '#0ea5e9', title: '#075985', text: '#0f172a' },
  { body: '#ecfeff', header: '#cffafe', border: '#06b6d4', title: '#0e7490', text: '#0f172a' },
  { body: '#dbeafe', header: '#bfdbfe', border: '#3b82f6', title: '#1d4ed8', text: '#0f172a' },
  { body: '#f0f9ff', header: '#e0f2fe', border: '#0284c7', title: '#0c4a6e', text: '#111827' }
] as const;
export const SAFETY_CARD_TEXT_BG_VARIANTS = ['transparent', '#ecfeff', '#dbeafe', '#e0f2fe'] as const;
export const SAFETY_CARD_FONT_VALUES = (TEXT_FONT_OPTIONS || []).map((entry) => String(entry.value || '').trim()).filter(Boolean);

export const parseDateForSort = (value: string) => {
  const ts = value ? Date.parse(value) : NaN;
  return Number.isFinite(ts) ? ts : 0;
};

