import { nanoid } from 'nanoid';
import type { Corridor, DoorVerificationEntry, Room, RoomConnectionDoor } from '../../store/types';

type Point = { x: number; y: number };

export type SharedRoomSide = {
  anchorRoomId: string;
  otherRoomId: string;
  edgeIndex: number;
  otherEdgeIndex: number;
  tMin: number;
  tMax: number;
  a: Point;
  b: Point;
};

export const isRackLinkId = (id?: string | null) => typeof id === 'string' && id.startsWith('racklink:');

export const normalizeDoorVerificationHistory = (history: any): DoorVerificationEntry[] => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const company = String(entry?.company || '').trim();
      const date = typeof entry?.date === 'string' ? String(entry.date).trim() : '';
      const notes = typeof entry?.notes === 'string' ? String(entry.notes).trim() : '';
      const createdAtRaw = Number(entry?.createdAt);
      return {
        id: String(entry?.id || nanoid()),
        company,
        date: date || undefined,
        notes: notes || undefined,
        createdAt: Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now()
      } as DoorVerificationEntry;
    })
    .filter((entry) => !!entry.company || !!entry.date)
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const parseGoogleMapsCoordinates = (rawValue: string): { lat: number; lng: number } | null => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  const decimal = '[-+]?\\d{1,3}(?:\\.\\d+)?';
  const pair = new RegExp(`(${decimal})\\s*,\\s*(${decimal})`);
  const direct = raw.match(pair);
  const fromPair = direct || raw.match(/[@?&]q=([-+]?\d{1,3}(?:\.\d+)?),\s*([-+]?\d{1,3}(?:\.\d+)?)/);
  if (!fromPair) return null;
  const lat = Number(fromPair[1]);
  const lng = Number(fromPair[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

export const googleMapsUrlFromCoords = (rawValue: string) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const parsed = parseGoogleMapsCoordinates(raw);
  if (!parsed) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(`${parsed.lat},${parsed.lng}`)}`;
};

export const getRoomPolygon = (room: any): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(room?.points) ? room.points : [];
    return pts.length >= 3 ? pts : [];
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const w = Number(room?.width || 0);
  const h = Number(room?.height || 0);
  if (!w || !h) return [];
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
};

export const projectPointToSegment = (a: Point, b: Point, p: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0000001) {
    return { t: 0, x: a.x, y: a.y, distSq: (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) };
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  const distSq = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
  return { t, x, y, distSq };
};

export const pointInPolygon = (point: Point, polygon: Point[]) => {
  if (!polygon.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + 0.000001) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const pointOnPolygonBoundary = (point: Point, polygon: Point[], tolerance = 1.25) => {
  if (!polygon.length) return false;
  const toleranceSq = tolerance * tolerance;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (projectPointToSegment(a, b, point).distSq <= toleranceSq) return true;
  }
  return false;
};

export const getCorridorPolygonForDoorLink = (corridor: any): Point[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(corridor?.points) ? corridor.points : [];
    if (pts.length >= 3) return pts;
  }
  const x = Number(corridor?.x || 0);
  const y = Number(corridor?.y || 0);
  const w = Number(corridor?.width || 0);
  const h = Number(corridor?.height || 0);
  if (!w || !h) return [];
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
};

export const getCorridorEdgePointForDoorLink = (corridor: any, edgeIndex: number, t: number) => {
  const points = getCorridorPolygonForDoorLink(corridor);
  if (points.length < 2) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  const ratio = Math.max(0, Math.min(1, Number(t) || 0));
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
};

export const inferCorridorDoorLinkedRoomIds = (corridor: Corridor, door: any, rooms: Room[]) => {
  const availableRooms = (rooms || []).filter(Boolean);
  if (!availableRooms.length) return [] as string[];
  const validRoomIdSet = new Set(availableRooms.map((room) => String(room.id || '')).filter(Boolean));
  const explicitRoomIds = Array.isArray((door as any)?.linkedRoomIds)
    ? Array.from(new Set((door as any).linkedRoomIds.map((id: any) => String(id || '').trim()).filter((id: string) => validRoomIdSet.has(id))))
    : [];
  if (explicitRoomIds.length) return explicitRoomIds;
  const corridorPoly = getCorridorPolygonForDoorLink(corridor);
  const anchor = getCorridorEdgePointForDoorLink(corridor, Number((door as any)?.edgeIndex), Number((door as any)?.t));
  if (!anchor || corridorPoly.length < 2) return [] as string[];
  const roomEntries = availableRooms
    .map((room) => ({ id: String(room.id || ''), poly: getRoomPolygon(room as any) }))
    .filter((entry) => entry.id && entry.poly.length >= 3);
  if (!roomEntries.length) return [] as string[];
  const probeMatches: string[] = [];
  const edgeIndex = Number((door as any)?.edgeIndex);
  if (Number.isFinite(edgeIndex)) {
    const idx = ((Math.floor(edgeIndex) % corridorPoly.length) + corridorPoly.length) % corridorPoly.length;
    const a = corridorPoly[idx];
    const b = corridorPoly[(idx + 1) % corridorPoly.length];
    const dx = (b?.x || 0) - (a?.x || 0);
    const dy = (b?.y || 0) - (a?.y || 0);
    const len = Math.hypot(dx, dy);
    if (len > 0.0001) {
      const nx = -dy / len;
      const ny = dx / len;
      const seen = new Set<string>();
      const probeDistances = [2, 4, 8, 12, 18, 26, 36, 48, 64];
      const pushProbeMatches = (probe: Point, tolerance: number) => {
        for (const entry of roomEntries) {
          if (!pointInPolygon(probe, entry.poly) && !pointOnPolygonBoundary(probe, entry.poly, tolerance)) continue;
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          probeMatches.push(entry.id);
        }
      };
      for (const dist of probeDistances) {
        const tolerance = dist <= 12 ? 2.6 : 3.4;
        pushProbeMatches({ x: anchor.x + nx * dist, y: anchor.y + ny * dist }, tolerance);
        pushProbeMatches({ x: anchor.x - nx * dist, y: anchor.y - ny * dist }, tolerance);
        if (probeMatches.length >= 2 && dist >= 18) break;
      }
    }
  }
  if (probeMatches.length) return probeMatches;
  const ranked = roomEntries
    .map((entry) => {
      let bestDistSq = Number.POSITIVE_INFINITY;
      for (let i = 0; i < entry.poly.length; i += 1) {
        const a = entry.poly[i];
        const b = entry.poly[(i + 1) % entry.poly.length];
        const proj = projectPointToSegment(a, b, anchor);
        if (proj.distSq < bestDistSq) bestDistSq = proj.distSq;
      }
      return { id: entry.id, dist: Math.sqrt(bestDistSq) };
    })
    .filter((entry) => Number.isFinite(entry.dist))
    .sort((a, b) => a.dist - b.dist);
  if (!ranked.length) return [] as string[];
  const best = ranked[0].dist;
  const maxAllowed = Math.max(42, best + 2.5);
  return ranked
    .filter((entry) => entry.dist <= maxAllowed)
    .slice(0, 4)
    .map((entry) => entry.id);
};

export const getSharedRoomSides = (roomA: Room, roomB: Room): SharedRoomSide[] => {
  const polyA = getRoomPolygon(roomA as any);
  const polyB = getRoomPolygon(roomB as any);
  if (polyA.length < 2 || polyB.length < 2) return [];
  const out: SharedRoomSide[] = [];
  const minOverlap = 8;
  const collinearTolerance = 1.8;
  const parallelTolerance = 0.03;
  const pushShared = (sourcePoly: Point[], sourceRoomId: string, targetPoly: Point[], targetRoomId: string) => {
    for (let i = 0; i < sourcePoly.length; i += 1) {
      const a = sourcePoly[i];
      const b = sourcePoly[(i + 1) % sourcePoly.length];
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const len = Math.hypot(ux, uy);
      if (len < 0.0001) continue;
      const uxn = ux / len;
      const uyn = uy / len;
      for (let j = 0; j < targetPoly.length; j += 1) {
        const c = targetPoly[j];
        const d = targetPoly[(j + 1) % targetPoly.length];
        const vx = d.x - c.x;
        const vy = d.y - c.y;
        const vLen = Math.hypot(vx, vy);
        if (vLen < 0.0001) continue;
        const cross = Math.abs(uxn * (vy / vLen) - uyn * (vx / vLen));
        if (cross > parallelTolerance) continue;
        const lineDistC = Math.abs((c.x - a.x) * uy - (c.y - a.y) * ux) / len;
        const lineDistD = Math.abs((d.x - a.x) * uy - (d.y - a.y) * ux) / len;
        if (Math.min(lineDistC, lineDistD) > collinearTolerance) continue;
        const projC = (c.x - a.x) * uxn + (c.y - a.y) * uyn;
        const projD = (d.x - a.x) * uxn + (d.y - a.y) * uyn;
        const from = Math.max(0, Math.min(projC, projD));
        const to = Math.min(len, Math.max(projC, projD));
        const overlap = to - from;
        if (overlap < minOverlap) continue;
        const tMin = Math.max(0, Math.min(1, from / len));
        const tMax = Math.max(0, Math.min(1, to / len));
        if (tMax - tMin < 0.0001) continue;
        out.push({
          anchorRoomId: sourceRoomId,
          otherRoomId: targetRoomId,
          edgeIndex: i,
          otherEdgeIndex: j,
          tMin,
          tMax,
          a: { x: a.x + ux * tMin, y: a.y + uy * tMin },
          b: { x: a.x + ux * tMax, y: a.y + uy * tMax }
        });
      }
    }
  };
  pushShared(polyA, String(roomA.id), polyB, String(roomB.id));
  pushShared(polyB, String(roomB.id), polyA, String(roomA.id));
  return out;
};

export const normalizeRoomConnectionDoorInput = (door: any): RoomConnectionDoor | null => {
  const roomAId = String(door?.roomAId || '').trim();
  const roomBId = String(door?.roomBId || '').trim();
  if (!roomAId || !roomBId || roomAId === roomBId) return null;
  const anchorRoomIdRaw = String(door?.anchorRoomId || '').trim();
  const anchorRoomId = anchorRoomIdRaw === roomAId || anchorRoomIdRaw === roomBId ? anchorRoomIdRaw : roomAId;
  const edgeIndex = Number(door?.edgeIndex);
  const t = Number(door?.t);
  if (!Number.isFinite(edgeIndex) || !Number.isFinite(t)) return null;
  return {
    ...door,
    id: String(door?.id || nanoid()),
    roomAId,
    roomBId,
    anchorRoomId,
    edgeIndex: Number(edgeIndex),
    t: Math.max(0, Math.min(1, Number(t))),
    catalogTypeId: typeof door?.catalogTypeId === 'string' ? String(door.catalogTypeId).trim() || undefined : undefined,
    mode: door?.mode === 'auto_sensor' || door?.mode === 'automated' ? door.mode : 'static',
    automationUrl: typeof door?.automationUrl === 'string' ? String(door.automationUrl).trim() || undefined : undefined,
    description: typeof door?.description === 'string' ? String(door.description).trim() || undefined : undefined,
    isEmergency: !!door?.isEmergency,
    isMainEntrance: !!door?.isMainEntrance,
    isExternal: !!door?.isExternal,
    isFireDoor: !!door?.isFireDoor,
    lastVerificationAt: typeof door?.lastVerificationAt === 'string' ? String(door.lastVerificationAt).trim() || undefined : undefined,
    verifierCompany: typeof door?.verifierCompany === 'string' ? String(door.verifierCompany).trim() || undefined : undefined,
    verificationHistory: normalizeDoorVerificationHistory(door?.verificationHistory)
  };
};
