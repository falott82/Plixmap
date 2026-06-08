// Pure types + geometry helpers extracted verbatim from ObjectTypesPanel.tsx (<2k).
import type { Corridor, DoorVerificationEntry, FloorPlan, Room } from '../../store/types';

export type Point = { x: number; y: number };
export type DoorRegistrySortKey =
  | 'clientName'
  | 'siteName'
  | 'planName'
  | 'doorId'
  | 'description'
  | 'doorType'
  | 'isEmergency'
  | 'lastVerificationAt'
  | 'verifierCompany'
  | 'corridorName'
  | 'nearestRoomName';

export type DoorRegistryRow = {
  rowId: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  corridorId: string;
  corridorName: string;
  doorId: string;
  description: string;
  doorType: string;
  isEmergency: boolean;
  lastVerificationAt: string;
  verifierCompany: string;
  nearestRoomName: string;
  openUrl: string;
  mode: string;
  verificationHistory: DoorVerificationEntry[];
  plan: FloorPlan;
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
    return room.points
      .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
  }
  return toRectPolygon(Number(room?.x || 0), Number(room?.y || 0), Number(room?.width || 0), Number(room?.height || 0));
};

export const corridorPolygon = (corridor: Corridor): Point[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly' && Array.isArray(corridor?.points) && corridor.points.length >= 3) {
    return corridor.points
      .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
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


// Build the door-registry map preview geometry (corridor/room shapes + door
// anchors + viewBox) for a single plan. Pure given the preview row. Extracted
// from ObjectTypesPanel.
export const computeDoorMapPreviewData = (doorMapPreviewRow: any) => {
  if (!doorMapPreviewRow) return null;
  const plan = doorMapPreviewRow.plan;
  const corridors = ((plan?.corridors || []) as Corridor[]).filter(Boolean);
  const rooms = (plan?.rooms || []).filter(Boolean);
  const corridorShapes = corridors.map((corridor) => ({ corridor, points: corridorPolygon(corridor) })).filter((entry) => entry.points.length >= 3);
  const roomShapes = rooms.map((room: any) => ({ room, points: roomPolygon(room), center: polygonCentroid(roomPolygon(room)) })).filter((entry: any) => entry.points.length >= 3);
  const doorAnchors = corridorShapes.flatMap((entry) =>
    (entry.corridor.doors || [])
      .map((door) => ({ door, point: getDoorAnchor(entry.corridor, door), corridorId: entry.corridor.id }))
      .filter((item): item is { door: any; point: Point; corridorId: string } => !!item.point)
  );
  const allPoints: Point[] = [
    ...corridorShapes.flatMap((entry) => entry.points),
    ...roomShapes.flatMap((entry: any) => entry.points),
    ...doorAnchors.map((entry) => entry.point)
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = Number(plan?.width || 1200) || 1200;
    maxY = Number(plan?.height || 800) || 800;
  }
  if (Number.isFinite(Number(plan?.width)) && Number.isFinite(Number(plan?.height)) && Number(plan?.width) > 0 && Number(plan?.height) > 0) {
    minX = Math.min(minX, 0);
    minY = Math.min(minY, 0);
    maxX = Math.max(maxX, Number(plan?.width));
    maxY = Math.max(maxY, Number(plan?.height));
  }
  const pad = 24;
  return {
    corridorShapes,
    roomShapes,
    doorAnchors,
    viewBox: `${minX - pad} ${minY - pad} ${Math.max(100, maxX - minX + pad * 2)} ${Math.max(100, maxY - minY + pad * 2)}`
  };
};
