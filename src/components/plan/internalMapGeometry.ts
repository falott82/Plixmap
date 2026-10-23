import type { Corridor, Room } from '../../store/types';
import type { Point, Axis, ConnectionTransitionType } from './internalMapTypes';
import { polygonCentroid as polygonCentroidShared, distancePointToSegment } from './planViewUtils';

export const SPEED_MPS = 1.4;

// Shares the area-weighted centroid math; preserves this modal's {0,0}-for-empty contract.
export const polygonCentroid = (polygon: Point[]) => polygonCentroidShared(polygon) ?? { x: 0, y: 0 };

export const pointOnPolygonBoundary = (point: Point, polygon: Point[], tolerance = 1.25) => {
  if (!polygon.length) return false;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (distancePointToSegment(point, a, b) <= tolerance) return true;
  }
  return false;
};

const shapePolygon = (corridor: Corridor | Room): Point[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const points = Array.isArray(corridor?.points) ? corridor.points : [];
    if (points.length >= 3) return points;
  }
  const x = Number(corridor?.x || 0);
  const y = Number(corridor?.y || 0);
  const width = Number(corridor?.width || 0);
  const height = Number(corridor?.height || 0);
  if (!(width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

export const corridorPolygon = shapePolygon;
export const roomPolygon = shapePolygon;

export const getCorridorDoorAnchor = (corridor: Corridor, door: { edgeIndex?: number; t?: number }): Point | null =>
  getPolygonEdgePoint(corridorPolygon(corridor), Number(door?.edgeIndex), Number(door?.t));

export const getPolygonEdgePoint = (points: Point[], edgeIndex: number, ratioValue: number): Point | null => {
  if (!Array.isArray(points) || points.length < 2) return null;
  if (!Number.isFinite(edgeIndex)) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  const t = Math.max(0, Math.min(1, Number(ratioValue) || 0));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

export const getCorridorConnectionAnchor = (corridor: Corridor, connection: { x?: number; y?: number; edgeIndex?: number; t?: number }): Point | null => {
  if (Number.isFinite(Number(connection?.x)) && Number.isFinite(Number(connection?.y))) {
    return { x: Number(connection.x), y: Number(connection.y) };
  }
  return getPolygonEdgePoint(corridorPolygon(corridor), Number(connection?.edgeIndex), Number(connection?.t));
};

export const normalizeTransitionType = (value: unknown): ConnectionTransitionType => (String(value || '') === 'elevator' ? 'elevator' : 'stairs');

export const transitionPenaltySeconds = (value?: ConnectionTransitionType) => (value === 'elevator' ? 30 : 15);

export const preferredDoorAxis = (corridorPoly: Point[], anchor: Point): Axis => {
  if (corridorPoly.length < 2) return 'y';
  let bestDist = Number.POSITIVE_INFINITY;
  let edgeOrientation: 'horizontal' | 'vertical' = 'horizontal';
  for (let i = 0; i < corridorPoly.length; i += 1) {
    const a = corridorPoly[i];
    const b = corridorPoly[(i + 1) % corridorPoly.length];
    const dist = distancePointToSegment(anchor, a, b);
    if (dist >= bestDist) continue;
    bestDist = dist;
    edgeOrientation = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'horizontal' : 'vertical';
  }
  return edgeOrientation === 'horizontal' ? 'y' : 'x';
};

export const pushPoint = (points: Point[], next: Point) => {
  const prev = points[points.length - 1];
  if (!prev) {
    points.push(next);
    return;
  }
  if (Math.hypot(prev.x - next.x, prev.y - next.y) < 0.6) return;
  points.push(next);
};

export const appendOrtho = (points: Point[], from: Point, to: Point, firstAxis: Axis = 'x') => {
  if (Math.abs(from.x - to.x) < 0.6 || Math.abs(from.y - to.y) < 0.6) {
    pushPoint(points, { x: to.x, y: to.y });
    return;
  }
  const bend = firstAxis === 'y' ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
  pushPoint(points, bend);
  pushPoint(points, { x: to.x, y: to.y });
};

export const oppositeAxis = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');

export const simplifyCollinear = (points: Point[]) => {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const vertical = Math.abs(a.x - b.x) < 0.6 && Math.abs(b.x - c.x) < 0.6;
    const horizontal = Math.abs(a.y - b.y) < 0.6 && Math.abs(b.y - c.y) < 0.6;
    if (vertical || horizontal) continue;
    out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
};

export const polylineLength = (points: Point[]) => {
  let length = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
};
