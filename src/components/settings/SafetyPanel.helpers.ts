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


// Build the single-plan map geometry (corridors/rooms/door anchors + viewBox)
// for the safety map preview. Pure given the preview row. Extracted from SafetyPanel.
export const computeSafetyMapData = (mapPreview: any) => {
  if (!mapPreview) return null;
  const plan = mapPreview.row.plan;
  const planWidth = Math.max(200, Number(plan?.width || 1200));
  const planHeight = Math.max(200, Number(plan?.height || 800));
  const corridors = ((plan?.corridors || []) as Corridor[])
    .map((corridor) => {
      const points = corridorPolygon(corridor);
      return { corridor, points, center: polygonCentroid(points) };
    })
    .filter((entry) => entry.points.length >= 3);
  const rooms = (plan?.rooms || []).map((room: any) => ({ room, points: roomPolygon(room), center: polygonCentroid(roomPolygon(room)) })).filter((entry: any) => entry.points.length >= 3);
  const doorAnchors = corridors.flatMap((entry) =>
    (entry.corridor.doors || [])
      .map((door) => ({ door, point: getDoorAnchor(entry.corridor, door), corridorId: entry.corridor.id }))
      .filter((item): item is { door: any; point: Point; corridorId: string } => !!item.point)
  );
  const points = [
    ...corridors.flatMap((entry) => entry.points),
    ...rooms.flatMap((entry: any) => entry.points),
    ...doorAnchors.map((entry) => entry.point),
    { x: 0, y: 0 },
    { x: planWidth, y: planHeight },
    ...(mapPreview.kind === 'device' ? [mapPreview.row.point] : [])
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = Number(plan?.width || 1200);
    maxY = Number(plan?.height || 800);
  }
  const pad = 24;
  return {
    corridors,
    rooms,
    doorAnchors,
    planWidth,
    planHeight,
    imageUrl: String(plan?.imageUrl || ''),
    viewBox: `${minX - pad} ${minY - pad} ${Math.max(100, maxX - minX + pad * 2)} ${Math.max(100, maxY - minY + pad * 2)}`
  };
};

// Build the multi-plan map geometry + safety-card content for the multi-map
// export/preview. Pure given the preview, row index, client list, language and
// the translate fn. Extracted from SafetyPanel.
export const computeSafetyMultiMapData = (
  multiMapPreview: any,
  mapRowsByKey: Map<string, any>,
  clients: any[],
  lang: string,
  t: (msg: { it: string; en: string }) => string
) => {
  if (!multiMapPreview) return null;
  const items = multiMapPreview.keys
    .map((key: string) => mapRowsByKey.get(key))
    .filter((entry: any): entry is { kind: 'device'; row: SafetyRow } | { kind: 'door'; row: EmergencyDoorRow } => !!entry)
    .filter((entry: any) => entry.row.planId === multiMapPreview.planId);
  if (!items.length) return null;
  const plan = items[0].row.plan;
  const planWidth = Math.max(200, Number(plan?.width || 1200));
  const planHeight = Math.max(200, Number(plan?.height || 800));
  const corridors = ((plan?.corridors || []) as Corridor[])
    .map((corridor) => {
      const points = corridorPolygon(corridor);
      return { corridor, points, center: polygonCentroid(points) };
    })
    .filter((entry) => entry.points.length >= 3);
  const rooms = (plan?.rooms || []).map((room: any) => ({ room, points: roomPolygon(room), center: polygonCentroid(roomPolygon(room)) })).filter((entry: any) => entry.points.length >= 3);
  const doorAnchors = corridors.flatMap((entry) =>
    (entry.corridor.doors || [])
      .map((door) => ({ door, point: getDoorAnchor(entry.corridor, door), corridorId: entry.corridor.id }))
      .filter((item): item is { door: any; point: Point; corridorId: string } => !!item.point)
  );
  const selectedDevices = items
    .filter((entry: any): entry is { kind: 'device'; row: SafetyRow } => entry.kind === 'device')
    .map((entry: any) => entry.row);
  const selectedDoors = items
    .filter((entry: any): entry is { kind: 'door'; row: EmergencyDoorRow } => entry.kind === 'door')
    .map((entry: any) => entry.row);
  const cardLayoutRaw = (plan as any)?.safetyCardLayout;
  const safetyCardLayout = {
    x: Number.isFinite(Number(cardLayoutRaw?.x)) ? Number(cardLayoutRaw.x) : DEFAULT_SAFETY_CARD_LAYOUT.x,
    y: Number.isFinite(Number(cardLayoutRaw?.y)) ? Number(cardLayoutRaw.y) : DEFAULT_SAFETY_CARD_LAYOUT.y,
    w: Number.isFinite(Number(cardLayoutRaw?.w)) ? Math.max(220, Number(cardLayoutRaw.w)) : DEFAULT_SAFETY_CARD_LAYOUT.w,
    h: Number.isFinite(Number(cardLayoutRaw?.h)) ? Math.max(56, Number(cardLayoutRaw.h)) : DEFAULT_SAFETY_CARD_LAYOUT.h,
    fontSize: Number.isFinite(Number(cardLayoutRaw?.fontSize))
      ? Math.max(8, Math.min(22, Number(cardLayoutRaw.fontSize)))
      : DEFAULT_SAFETY_CARD_LAYOUT.fontSize,
    fontIndex: Number.isFinite(Number(cardLayoutRaw?.fontIndex))
      ? Math.max(0, Math.floor(Number(cardLayoutRaw.fontIndex)))
      : DEFAULT_SAFETY_CARD_LAYOUT.fontIndex,
    colorIndex: Number.isFinite(Number(cardLayoutRaw?.colorIndex))
      ? Math.max(0, Math.floor(Number(cardLayoutRaw.colorIndex)))
      : DEFAULT_SAFETY_CARD_LAYOUT.colorIndex,
    textBgIndex: Number.isFinite(Number(cardLayoutRaw?.textBgIndex))
      ? Math.max(0, Math.floor(Number(cardLayoutRaw.textBgIndex)))
      : DEFAULT_SAFETY_CARD_LAYOUT.textBgIndex
  };
  const points = [
    ...corridors.flatMap((entry) => entry.points),
    ...rooms.flatMap((entry: any) => entry.points),
    ...doorAnchors.map((entry) => entry.point),
    ...selectedDevices.map((entry: any) => entry.point),
    { x: safetyCardLayout.x, y: safetyCardLayout.y },
    { x: safetyCardLayout.x + safetyCardLayout.w, y: safetyCardLayout.y + safetyCardLayout.h },
    { x: 0, y: 0 },
    { x: planWidth, y: planHeight }
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  const firstRow = items[0]?.row as SafetyRow | EmergencyDoorRow | undefined;
  const clientRef = firstRow?.clientId ? (clients || []).find((entry: any) => String(entry?.id || '') === String(firstRow.clientId)) : undefined;
  const emergencyContacts = Array.isArray((clientRef as any)?.emergencyContacts) ? ((clientRef as any).emergencyContacts as any[]) : [];
  const scopedContacts = emergencyContacts
    .filter((entry) => {
      const scope = String(entry?.scope || '');
      const showOnPlanCard = entry?.showOnPlanCard !== false;
      if (!showOnPlanCard) return false;
      if (scope === 'global' || scope === 'client') return true;
      if (scope === 'site') return String(entry?.siteId || '') === String(firstRow?.siteId || '');
      if (scope === 'plan') return String(entry?.floorPlanId || '') === String(firstRow?.planId || '');
      return false;
    })
    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), lang, { sensitivity: 'base' }));
  const meetingPoints = ((plan?.objects || []) as any[])
    .filter((obj) => String(obj?.type || '') === 'safety_assembly_point')
    .map((obj) => ({
      name: String(obj?.name || obj?.type || '').trim(),
      gps: String(obj?.gpsCoords || '').trim(),
      coords: `${Math.round(Number(obj?.x || 0))}, ${Math.round(Number(obj?.y || 0))}`
    }));
  const pad = 24;
  return {
    plan,
    items,
    selectedDevices,
    selectedDoors,
    corridors,
    rooms,
    doorAnchors,
    planWidth,
    planHeight,
    imageUrl: String(plan?.imageUrl || ''),
    safetyCard: {
      title: t({ it: 'Scheda sicurezza', en: 'Safety card' }),
      numbersLabel: t({ it: 'Numeri utili', en: 'Emergency numbers' }),
      pointsLabel: t({ it: 'Punti di ritrovo', en: 'Meeting points' }),
      noNumbersText: t({ it: 'Nessun numero', en: 'No numbers' }),
      noPointsText: t({ it: 'Nessun punto', en: 'No points' }),
      numbersText: scopedContacts.map((entry) => `${entry?.name || '—'} ${entry?.phone || '—'}`).join(' | '),
      pointsText: meetingPoints.map((entry) => `${entry.name || '—'} ${entry.gps || entry.coords}`).join(' | '),
      layout: safetyCardLayout
    },
    viewBox: `${minX - pad} ${minY - pad} ${Math.max(100, maxX - minX + pad * 2)} ${Math.max(100, maxY - minY + pad * 2)}`
  };
};
