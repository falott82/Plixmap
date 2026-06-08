/* eslint-disable @typescript-eslint/no-explicit-any */
import { Corridor, FloorPlan, Room } from '../../store/types';
import { polygonCentroid as polygonCentroidShared, pointInPolygon, distancePointToSegment } from './planViewUtils';

export type Point = { x: number; y: number };
export type Axis = 'x' | 'y';

export type EntryKind = 'object' | 'rack_item' | 'room' | 'corridor';

export interface SearchEntry {
  id: string;
  kind: EntryKind;
  label: string;
  subtitle: string;
  search: string;
  point: Point;
  roomId?: string;
}

export interface RouteResult {
  startDoor: Point;
  endDoor: Point;
  approachPoints: Point[];
  corridorPoints: Point[];
  exitPoints: Point[];
  distancePx: number;
  distanceMeters?: number;
  etaSeconds?: number;
  directDashedOnly?: boolean;
}

export type ConnectionTransitionType = 'stairs' | 'elevator';

export interface RoutePlanSegment {
  planId: string;
  planName: string;
  startPoint: Point;
  endPoint: Point;
  route: RouteResult;
  startConnectionId?: string;
  endConnectionId?: string;
  startTransitionType?: ConnectionTransitionType;
  endTransitionType?: ConnectionTransitionType;
}

export interface MultiFloorRouteResult {
  segments: RoutePlanSegment[];
  distancePx: number;
  distanceMeters?: number;
  transitionSeconds: number;
  etaSeconds?: number;
}


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

export const corridorPolygon = (corridor: Corridor): Point[] => {
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

export const roomPolygon = (room: Room): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (points.length >= 3) return points;
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const width = Number(room?.width || 0);
  const height = Number(room?.height || 0);
  if (!(width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

export const getCorridorDoorAnchor = (corridor: Corridor, door: any): Point | null => {
  const points = corridorPolygon(corridor);
  if (points.length < 2) return null;
  const edgeIndex = Number(door?.edgeIndex);
  const t = Math.max(0, Math.min(1, Number(door?.t) || 0));
  if (!Number.isFinite(edgeIndex)) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

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

export const getCorridorConnectionAnchor = (corridor: Corridor, connection: any): Point | null => {
  if (Number.isFinite(Number(connection?.x)) && Number.isFinite(Number(connection?.y))) {
    return { x: Number(connection.x), y: Number(connection.y) };
  }
  const points = corridorPolygon(corridor);
  if (points.length < 2) return null;
  const edgeIndex = Number(connection?.edgeIndex);
  const t = Math.max(0, Math.min(1, Number(connection?.t) || 0));
  if (!Number.isFinite(edgeIndex)) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

export const normalizeTransitionType = (value: any): ConnectionTransitionType => (String(value || '') === 'elevator' ? 'elevator' : 'stairs');

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

export class MinHeap {
  private data: Array<{ key: string; score: number }> = [];

  push(item: { key: string; score: number }) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): { key: string; score: number } | undefined {
    if (!this.data.length) return undefined;
    const top = this.data[0];
    const tail = this.data.pop();
    if (this.data.length && tail) {
      this.data[0] = tail;
      this.bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  private bubbleUp(index: number) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.data[parent].score <= this.data[i].score) break;
      const temp = this.data[parent];
      this.data[parent] = this.data[i];
      this.data[i] = temp;
      i = parent;
    }
  }

  private bubbleDown(index: number) {
    let i = index;
    while (true) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < this.data.length && this.data[left].score < this.data[smallest].score) smallest = left;
      if (right < this.data.length && this.data[right].score < this.data[smallest].score) smallest = right;
      if (smallest === i) break;
      const temp = this.data[smallest];
      this.data[smallest] = this.data[i];
      this.data[i] = temp;
      i = smallest;
    }
  }
}

export const keyOf = (gx: number, gy: number) => `${gx}:${gy}`;

export const parseKey = (key: string) => {
  const [gxRaw, gyRaw] = key.split(':');
  return { gx: Number(gxRaw), gy: Number(gyRaw) };
};

export const centerOfCell = (gx: number, gy: number, cellSize: number): Point => ({
  x: (gx + 0.5) * cellSize,
  y: (gy + 0.5) * cellSize
});

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

export const chooseCellSize = (plan: FloorPlan) => {
  const width = Number(plan.width || 0);
  const height = Number(plan.height || 0);
  const maxDim = Math.max(width, height);
  if (maxDim > 7000) return 28;
  if (maxDim > 5000) return 24;
  if (maxDim > 3000) return 20;
  return 16;
};

export const buildWalkableGrid = (corridors: Corridor[], cellSize: number) => {
  const walkable = new Set<string>();
  const clearanceByKey = new Map<string, number>();
  const polygonCache = corridors
    .map((corridor) => ({ corridor, polygon: corridorPolygon(corridor) }))
    .filter((entry) => entry.polygon.length >= 3);

  for (const entry of polygonCache) {
    const polygon = entry.polygon;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const gxMin = Math.floor(minX / cellSize);
    const gxMax = Math.ceil(maxX / cellSize);
    const gyMin = Math.floor(minY / cellSize);
    const gyMax = Math.ceil(maxY / cellSize);

    for (let gy = gyMin; gy <= gyMax; gy += 1) {
      for (let gx = gxMin; gx <= gxMax; gx += 1) {
        const center = centerOfCell(gx, gy, cellSize);
        if (!pointInPolygon(center, polygon)) continue;
        const key = keyOf(gx, gy);
        walkable.add(key);
        let clearance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < polygon.length; i += 1) {
          const a = polygon[i];
          const b = polygon[(i + 1) % polygon.length];
          clearance = Math.min(clearance, distancePointToSegment(center, a, b));
        }
        const prev = clearanceByKey.get(key) || 0;
        if (clearance > prev) clearanceByKey.set(key, clearance);
      }
    }
  }

  return { walkable, clearanceByKey };
};

export const findNearestWalkableKey = (point: Point, cellSize: number, walkable: Set<string>) => {
  const baseGx = Math.floor(point.x / cellSize);
  const baseGy = Math.floor(point.y / cellSize);
  let best: { key: string; distSq: number } | null = null;
  const maxRadius = 80;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    let foundAtRadius = false;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const gx = baseGx + dx;
        const gy = baseGy + dy;
        const key = keyOf(gx, gy);
        if (!walkable.has(key)) continue;
        const center = centerOfCell(gx, gy, cellSize);
        const distSq = (center.x - point.x) * (center.x - point.x) + (center.y - point.y) * (center.y - point.y);
        if (!best || distSq < best.distSq) {
          best = { key, distSq };
        }
        foundAtRadius = true;
      }
    }
    if (foundAtRadius && best) break;
  }
  return best?.key || null;
};

export type CorridorGuide = {
  componentId: number;
  orientation: 'horizontal' | 'vertical';
  center: number;
};

export const buildCorridorGuides = (walkable: Set<string>, clearanceByKey: Map<string, number>) => {
  const componentByKey = new Map<string, number>();
  const guideByComponent = new Map<number, CorridorGuide>();
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  let componentId = 0;
  for (const rootKey of walkable) {
    if (componentByKey.has(rootKey)) continue;
    const queue = [rootKey];
    componentByKey.set(rootKey, componentId);
    const cells: Array<{ gx: number; gy: number; clearance: number }> = [];
    let cursor = 0;
    while (cursor < queue.length) {
      const key = queue[cursor++];
      const { gx, gy } = parseKey(key);
      const clearance = clearanceByKey.get(key) || 0;
      cells.push({ gx, gy, clearance });
      for (const dir of directions) {
        const nextKey = keyOf(gx + dir.dx, gy + dir.dy);
        if (!walkable.has(nextKey) || componentByKey.has(nextKey)) continue;
        componentByKey.set(nextKey, componentId);
        queue.push(nextKey);
      }
    }

    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGy = Infinity;
    let maxGy = -Infinity;
    let weightSum = 0;
    let weightedX = 0;
    let weightedY = 0;
    for (const cell of cells) {
      minGx = Math.min(minGx, cell.gx);
      maxGx = Math.max(maxGx, cell.gx);
      minGy = Math.min(minGy, cell.gy);
      maxGy = Math.max(maxGy, cell.gy);
      const weight = Math.max(1, cell.clearance);
      weightSum += weight;
      weightedX += weight * cell.gx;
      weightedY += weight * cell.gy;
    }

    const width = maxGx - minGx + 1;
    const height = maxGy - minGy + 1;
    const orientation = width >= height ? 'horizontal' : 'vertical';
    const center = orientation === 'horizontal'
      ? (weightSum > 0 ? weightedY / weightSum : (minGy + maxGy) / 2)
      : (weightSum > 0 ? weightedX / weightSum : (minGx + maxGx) / 2);
    guideByComponent.set(componentId, { componentId, orientation, center });
    componentId += 1;
  }

  return { componentByKey, guideByComponent };
};

export const findCenterBiasedPath = (
  startKey: string,
  endKey: string,
  walkable: Set<string>,
  clearanceByKey: Map<string, number>,
  componentByKey: Map<string, number>,
  guideByComponent: Map<number, CorridorGuide>
) => {
  if (startKey === endKey) return [startKey];
  const startComponent = componentByKey.get(startKey);
  const endComponent = componentByKey.get(endKey);
  if (!Number.isFinite(startComponent) || startComponent !== endComponent) return [] as string[];
  const guide = guideByComponent.get(Number(startComponent));
  if (!guide) return [] as string[];

  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];
  const oppositeDir = [1, 0, 3, 2];
  const stateKey = (key: string, dirIndex: number) => `${key}|${dirIndex}`;
  const parseState = (state: string) => {
    const sep = state.lastIndexOf('|');
    return { key: state.slice(0, sep), dirIndex: Number(state.slice(sep + 1)) };
  };

  const goal = parseKey(endKey);
  const heuristic = (key: string) => {
    const current = parseKey(key);
    return Math.abs(current.gx - goal.gx) + Math.abs(current.gy - goal.gy);
  };

  const open = new MinHeap();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const closed = new Set<string>();
  const startState = stateKey(startKey, -1);
  gScore.set(startState, 0);
  open.push({ key: startState, score: heuristic(startKey) * 0.6 });

  while (open.size) {
    const current = open.pop();
    if (!current) break;
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    const currentState = parseState(current.key);
    const currentG = gScore.get(current.key) ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(currentG)) continue;
    if (currentState.key === endKey) {
      const routeStates = [current.key];
      let cursor = current.key;
      while (cameFrom.has(cursor)) {
        cursor = String(cameFrom.get(cursor));
        routeStates.push(cursor);
      }
      routeStates.reverse();
      const routeKeys: string[] = [];
      for (const state of routeStates) {
        const key = parseState(state).key;
        if (!routeKeys.length || routeKeys[routeKeys.length - 1] !== key) routeKeys.push(key);
      }
      return routeKeys;
    }

    const { gx, gy } = parseKey(currentState.key);
    for (let dirIndex = 0; dirIndex < directions.length; dirIndex += 1) {
      const dir = directions[dirIndex];
      const nextKey = keyOf(gx + dir.dx, gy + dir.dy);
      if (!walkable.has(nextKey)) continue;
      if (componentByKey.get(nextKey) !== startComponent) continue;
      const nextState = stateKey(nextKey, dirIndex);
      const next = parseKey(nextKey);
      const centerOffset = guide.orientation === 'horizontal'
        ? Math.abs(next.gy - guide.center)
        : Math.abs(next.gx - guide.center);
      const centerPenalty = centerOffset * 2.2;
      const clearance = Math.max(0.2, clearanceByKey.get(nextKey) || 0.2);
      const edgePenalty = 0.7 / clearance;
      const turnPenalty = currentState.dirIndex === -1 || currentState.dirIndex === dirIndex ? 0 : 1.2;
      const reversePenalty = currentState.dirIndex === -1 || oppositeDir[currentState.dirIndex] !== dirIndex ? 0 : 0.8;
      const tentative = currentG + 1 + centerPenalty + edgePenalty + turnPenalty + reversePenalty;
      if (tentative < (gScore.get(nextState) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(nextState, current.key);
        gScore.set(nextState, tentative);
        const score = tentative + heuristic(nextKey) * 0.55;
        open.push({ key: nextState, score });
      }
    }
  }

  return [] as string[];
};

export const computeRoute = (plan: FloorPlan, startPoint: Point, targetPoint: Point): { route?: RouteResult; error?: string } => {
  type GridCell = { gx: number; gy: number };
  type DoorCandidate = {
    id: string;
    anchor: Point;
    corridorPoly: Point[];
    connectorAxis: Axis;
    startDist: number;
    endDist: number;
    startPath?: Point[];
    endPathFromTarget?: Point[];
    roomIds?: string[];
  };

  const buildDirectRoomRoute = (): { route: RouteResult } | null => {
    const rooms = (plan.rooms || []).filter(Boolean);
    for (const room of rooms) {
      const poly = roomPolygon(room);
      if (poly.length < 3) continue;
      const startInRoom = pointInPolygon(startPoint, poly) || pointOnPolygonBoundary(startPoint, poly);
      if (!startInRoom) continue;
      const targetInRoom = pointInPolygon(targetPoint, poly) || pointOnPolygonBoundary(targetPoint, poly);
      if (!targetInRoom) continue;
      const directLine = [startPoint, targetPoint];
      const distancePx = polylineLength(directLine);
      const metersPerPixel = Number(plan.scale?.metersPerPixel);
      const distanceMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? distancePx * metersPerPixel : undefined;
      const etaSeconds = distanceMeters ? distanceMeters / SPEED_MPS : undefined;
      return {
        route: {
          startDoor: startPoint,
          endDoor: targetPoint,
          approachPoints: directLine,
          corridorPoints: [],
          exitPoints: [],
          distancePx,
          distanceMeters,
          etaSeconds,
          directDashedOnly: true
        }
      };
    }
    return null;
  };

  const directRoomRoute = buildDirectRoomRoute();
  if (directRoomRoute) return directRoomRoute;

  const roomEntries = ((plan.rooms || []) as Room[])
    .filter(Boolean)
    .map((room) => ({ room, poly: roomPolygon(room) }))
    .filter((entry) => entry.poly.length >= 3);
  const roomIdSet = new Set(roomEntries.map((entry) => String(entry.room.id)));
  const segmentInsidePolygon = (from: Point, to: Point, poly: Point[], samples = 14) => {
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const probe = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      if (!pointInPolygon(probe, poly) && !pointOnPolygonBoundary(probe, poly)) return false;
    }
    return true;
  };

  const corridors = ((plan.corridors || []) as Corridor[]).filter(Boolean);
  const corridorEntries = corridors
    .map((corridor) => ({ corridor, poly: corridorPolygon(corridor) }))
    .filter((entry) => entry.poly.length >= 3);
  const corridorPolys = corridorEntries.map((entry) => entry.poly);
  const isPointInOrOnCorridor = (point: Point) =>
    corridorPolys.some((poly) => pointInPolygon(point, poly) || pointOnPolygonBoundary(point, poly));
  const corridorContainingPoint = (point: Point) =>
    corridorEntries.find((entry) => pointInPolygon(point, entry.poly) || pointOnPolygonBoundary(point, entry.poly)) || null;
  const startInsideCorridor = isPointInOrOnCorridor(startPoint);
  const targetInsideCorridor = isPointInOrOnCorridor(targetPoint);
  const startCorridorEntry = startInsideCorridor ? corridorContainingPoint(startPoint) : null;
  const targetCorridorEntry = targetInsideCorridor ? corridorContainingPoint(targetPoint) : null;
  if (
    startCorridorEntry &&
    targetCorridorEntry &&
    String(startCorridorEntry.corridor.id) === String(targetCorridorEntry.corridor.id) &&
    segmentInsidePolygon(startPoint, targetPoint, startCorridorEntry.poly)
  ) {
    const corridorPoints = simplifyCollinear([startPoint, targetPoint]);
    const distancePx = polylineLength(corridorPoints);
    const metersPerPixel = Number(plan.scale?.metersPerPixel);
    const distanceMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? distancePx * metersPerPixel : undefined;
    const etaSeconds = distanceMeters ? distanceMeters / SPEED_MPS : undefined;
    return {
      route: {
        startDoor: startPoint,
        endDoor: targetPoint,
        approachPoints: [],
        corridorPoints,
        exitPoints: [],
        distancePx,
        distanceMeters,
        etaSeconds
      }
    };
  }
  const doors: DoorCandidate[] = [];
  const distanceToRoomBoundary = (poly: Point[], point: Point) => {
    if (poly.length < 2) return Number.POSITIVE_INFINITY;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dist = distancePointToSegment(point, a, b);
      if (dist < best) best = dist;
    }
    return best;
  };
  const getDoorLinkedRoomsAtPoint = (point: Point, tolerance = 2.4, fallbackDistance = 42) => {
    const direct = roomEntries
      .filter((entry) => pointInPolygon(point, entry.poly) || pointOnPolygonBoundary(point, entry.poly, tolerance))
      .map((entry) => String(entry.room.id));
    if (direct.length) return Array.from(new Set(direct));
    const ranked = roomEntries
      .map((entry) => ({ id: String(entry.room.id), dist: distanceToRoomBoundary(entry.poly, point) }))
      .filter((entry) => Number.isFinite(entry.dist))
      .sort((a, b) => a.dist - b.dist);
    if (!ranked.length) return [] as string[];
    const best = ranked[0].dist;
    const maxAllowed = Math.max(fallbackDistance, best + 2.5);
    return ranked.filter((entry) => entry.dist <= maxAllowed).slice(0, 4).map((entry) => entry.id);
  };
  const getDoorLinkedRoomsByEdgeProbe = (corridorPoly: Point[], door: any, anchor: Point) => {
    if (!Array.isArray(corridorPoly) || corridorPoly.length < 2) return [] as string[];
    const edgeIndex = Number(door?.edgeIndex);
    if (!Number.isFinite(edgeIndex)) return [] as string[];
    const idx = ((Math.floor(edgeIndex) % corridorPoly.length) + corridorPoly.length) % corridorPoly.length;
    const a = corridorPoly[idx];
    const b = corridorPoly[(idx + 1) % corridorPoly.length];
    if (!a || !b) return [] as string[];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.0001) return [] as string[];
    const nx = -dy / len;
    const ny = dx / len;
    const out: string[] = [];
    const seen = new Set<string>();
    const probeDistances = [2, 4, 8, 12, 18, 26, 36, 48, 64];
    const pushProbeMatches = (probe: Point, probeTolerance: number) => {
      for (const entry of roomEntries) {
        if (!pointInPolygon(probe, entry.poly) && !pointOnPolygonBoundary(probe, entry.poly, probeTolerance)) continue;
        const roomId = String(entry.room.id);
        if (seen.has(roomId)) continue;
        seen.add(roomId);
        out.push(roomId);
      }
    };
    for (const dist of probeDistances) {
      const probeTolerance = dist <= 12 ? 2.6 : 3.4;
      pushProbeMatches({ x: anchor.x + nx * dist, y: anchor.y + ny * dist }, probeTolerance);
      pushProbeMatches({ x: anchor.x - nx * dist, y: anchor.y - ny * dist }, probeTolerance);
      if (out.length >= 2 && dist >= 18) break;
    }
    return out;
  };
  for (const corridor of corridors) {
    const poly = corridorPolygon(corridor);
    if (poly.length < 3) continue;
    for (let doorIndex = 0; doorIndex < (corridor.doors || []).length; doorIndex += 1) {
      const door = (corridor.doors || [])[doorIndex];
      const anchor = getCorridorDoorAnchor(corridor, door);
      if (!anchor) continue;
      const explicitRoomIds: string[] = Array.isArray((door as any)?.linkedRoomIds)
        ? Array.from(
            new Set<string>(
              (door as any).linkedRoomIds
                .map((id: any) => String(id || '').trim())
                .filter((id: string) => !!id && roomIdSet.has(id))
            )
          )
        : [];
      const inferredByProbe = getDoorLinkedRoomsByEdgeProbe(poly, door, anchor);
      const roomIds = explicitRoomIds.length ? explicitRoomIds : inferredByProbe.length ? inferredByProbe : getDoorLinkedRoomsAtPoint(anchor);
      doors.push({
        id: `${String(corridor.id)}:${doorIndex}:${String((door as any)?.id || '')}:${String((door as any)?.edgeIndex ?? '')}:${String((door as any)?.t ?? '')}`,
        anchor,
        corridorPoly: poly,
        connectorAxis: preferredDoorAxis(poly, anchor),
        startDist: Math.hypot(startPoint.x - anchor.x, startPoint.y - anchor.y),
        endDist: Math.hypot(targetPoint.x - anchor.x, targetPoint.y - anchor.y),
        roomIds
      });
    }
  }

  type RoomConnectorNode = {
    nodeId: string;
    point: Point;
    roomIds: string[];
    kind: 'corridor_door' | 'room_door';
    corridorDoorId?: string;
  };
  const roomById = new Map<string, { room: Room; poly: Point[] }>(roomEntries.map((entry) => [String(entry.room.id), entry]));
  const projectPointToRoomBoundary = (point: Point, poly: Point[]) => {
    if (poly.length < 2) return null;
    let best: { point: Point; distance: number } | null = null;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      const ratio = lenSq > 0.0000001 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq)) : 0;
      const projected = { x: a.x + dx * ratio, y: a.y + dy * ratio };
      const dist = Math.hypot(point.x - projected.x, point.y - projected.y);
      if (!best || dist < best.distance) best = { point: projected, distance: dist };
    }
    return best;
  };
  const ROOM_CONNECTOR_SLACK = 96;
  const roomAccessPointForNode = (roomPoly: Point[], nodePoint: Point): Point | null => {
    const projected = projectPointToRoomBoundary(nodePoint, roomPoly);
    if (pointInPolygon(nodePoint, roomPoly)) return nodePoint;
    // If the point is numerically on the border keep it, otherwise snap to border
    // so slightly-outside anchors (common after edits) still connect to the room graph.
    if (projected && projected.distance <= 0.12) return nodePoint;
    if (!projected || projected.distance > ROOM_CONNECTOR_SLACK) return null;
    return projected.point;
  };
  const roomConnectionCost = (fromPoint: Point, toPoint: Point, roomPoly: Point[]) => {
    if (segmentInsidePolygon(fromPoint, toPoint, roomPoly)) {
      return { cost: Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y), fromAccess: fromPoint, toAccess: toPoint };
    }
    const fromAccess = roomAccessPointForNode(roomPoly, fromPoint);
    const toAccess = roomAccessPointForNode(roomPoly, toPoint);
    if (!fromAccess || !toAccess) return null;
    if (!segmentInsidePolygon(fromAccess, toAccess, roomPoly)) return null;
    const cost =
      Math.hypot(fromPoint.x - fromAccess.x, fromPoint.y - fromAccess.y) +
      Math.hypot(fromAccess.x - toAccess.x, fromAccess.y - toAccess.y) +
      Math.hypot(toPoint.x - toAccess.x, toPoint.y - toAccess.y);
    return { cost, fromAccess, toAccess };
  };
  const roomConnectorNodes: RoomConnectorNode[] = [];
  const connectorNodeById = new Map<string, RoomConnectorNode>();
  const corridorNodeIdByDoorId = new Map<string, string>();
  for (const door of doors) {
    const roomIds = Array.from(new Set((door.roomIds || []).map((id) => String(id)).filter((id) => roomById.has(id))));
    if (!roomIds.length) continue;
    const nodeId = `cd:${door.id}`;
    const node: RoomConnectorNode = { nodeId, point: door.anchor, roomIds, kind: 'corridor_door', corridorDoorId: door.id };
    roomConnectorNodes.push(node);
    connectorNodeById.set(nodeId, node);
    corridorNodeIdByDoorId.set(door.id, nodeId);
  }
  const roomConnectionDoors = Array.isArray((plan as any)?.roomDoors) ? ((plan as any).roomDoors as any[]) : [];
  for (const roomDoor of roomConnectionDoors) {
    const roomAId = String((roomDoor as any)?.roomAId || '').trim();
    const roomBId = String((roomDoor as any)?.roomBId || '').trim();
    if (!roomAId || !roomBId || roomAId === roomBId) continue;
    const anchorRoomIdRaw = String((roomDoor as any)?.anchorRoomId || '').trim();
    const anchorRoomId = anchorRoomIdRaw === roomAId || anchorRoomIdRaw === roomBId ? anchorRoomIdRaw : roomAId;
    const anchorRoom = roomById.get(anchorRoomId);
    if (!anchorRoom) continue;
    const edgePoint = getPolygonEdgePoint(anchorRoom.poly, Number((roomDoor as any)?.edgeIndex), Number((roomDoor as any)?.t));
    if (!edgePoint) continue;
    const roomIds = [roomAId, roomBId].filter((id) => roomById.has(id));
    if (roomIds.length < 2) continue;
    const nodeId = `rd:${String((roomDoor as any)?.id || '')}`;
    if (!String((roomDoor as any)?.id || '').trim() || connectorNodeById.has(nodeId)) continue;
    const node: RoomConnectorNode = { nodeId, point: edgePoint, roomIds, kind: 'room_door' };
    roomConnectorNodes.push(node);
    connectorNodeById.set(nodeId, node);
  }
  const roomAdj = new Map<string, Array<{ to: string; cost: number }>>();
  const addRoomAdj = (from: string, to: string, cost: number) => {
    if (!Number.isFinite(cost) || cost <= 0) return;
    const list = roomAdj.get(from) || [];
    const exists = list.some((entry) => entry.to === to);
    if (!exists) list.push({ to, cost });
    roomAdj.set(from, list);
  };
  const roomNodeIdsByRoomId = new Map<string, string[]>();
  for (const node of roomConnectorNodes) {
    for (const roomId of node.roomIds) {
      const list = roomNodeIdsByRoomId.get(roomId) || [];
      list.push(node.nodeId);
      roomNodeIdsByRoomId.set(roomId, list);
    }
  }
  for (const [roomId, nodeIds] of roomNodeIdsByRoomId.entries()) {
    const roomEntry = roomById.get(roomId);
    if (!roomEntry || nodeIds.length < 2) continue;
    for (let i = 0; i < nodeIds.length; i += 1) {
      for (let j = i + 1; j < nodeIds.length; j += 1) {
        const aNode = connectorNodeById.get(nodeIds[i]);
        const bNode = connectorNodeById.get(nodeIds[j]);
        if (!aNode || !bNode) continue;
        const link = roomConnectionCost(aNode.point, bNode.point, roomEntry.poly);
        if (!link) continue;
        const dist = link.cost;
        addRoomAdj(aNode.nodeId, bNode.nodeId, dist);
        addRoomAdj(bNode.nodeId, aNode.nodeId, dist);
      }
    }
  }
  const pointRoomIds = (point: Point, tolerance = 3) =>
    roomEntries
      .filter((entry) => pointInPolygon(point, entry.poly) || pointOnPolygonBoundary(point, entry.poly, tolerance))
      .map((entry) => String(entry.room.id));
  const buildRoomAccessToCorridorDoors = (point: Point) => {
    const startRoomIds = pointRoomIds(point);
    const out = new Map<string, { points: Point[]; distance: number }>();
    if (!startRoomIds.length || !roomConnectorNodes.length) return out;
    const startSet = new Set(startRoomIds);
    const START = '__room_start__';
    const startEdges: Array<{ to: string; cost: number }> = [];
    for (const node of roomConnectorNodes) {
      const shared = node.roomIds.filter((roomId) => startSet.has(roomId));
      if (!shared.length) continue;
      let bestCost = Number.POSITIVE_INFINITY;
      for (const roomId of shared) {
        const roomEntry = roomById.get(roomId);
        if (!roomEntry) continue;
        const link = roomConnectionCost(point, node.point, roomEntry.poly);
        if (!link) continue;
        if (link.cost < bestCost) bestCost = link.cost;
      }
      if (!Number.isFinite(bestCost)) continue;
      startEdges.push({ to: node.nodeId, cost: bestCost });
    }
    if (!startEdges.length) return out;
    const dist = new Map<string, number>([[START, 0]]);
    const prev = new Map<string, string>();
    const heap = new MinHeap();
    heap.push({ key: START, score: 0 });
    while (heap.size) {
      const current = heap.pop();
      if (!current) break;
      const currentDist = dist.get(current.key);
      if (currentDist === undefined) continue;
      if (current.score > currentDist + 0.0001) continue;
      const edges = current.key === START ? startEdges : roomAdj.get(current.key) || [];
      for (const edge of edges) {
        const candidate = currentDist + edge.cost;
        const prevBest = dist.get(edge.to);
        if (prevBest !== undefined && candidate >= prevBest - 0.0001) continue;
        dist.set(edge.to, candidate);
        prev.set(edge.to, current.key);
        heap.push({ key: edge.to, score: candidate });
      }
    }
    for (const door of doors) {
      const nodeId = corridorNodeIdByDoorId.get(door.id);
      if (!nodeId) continue;
      const score = dist.get(nodeId);
      if (score === undefined) continue;
      const chain: string[] = [];
      let cursor = nodeId;
      while (cursor !== START) {
        chain.push(cursor);
        const parent = prev.get(cursor);
        if (!parent) break;
        cursor = parent;
      }
      if (cursor !== START) continue;
      chain.reverse();
      const points: Point[] = [point];
      for (const nodeKey of chain) {
        const node = connectorNodeById.get(nodeKey);
        if (!node) continue;
        const last = points[points.length - 1];
        if (!last || Math.hypot(last.x - node.point.x, last.y - node.point.y) > 0.0001) points.push(node.point);
      }
      const simplified = simplifyCollinear(points);
      out.set(door.id, { points: simplified, distance: polylineLength(simplified) });
    }
    return out;
  };
  const buildRoomOnlyPath = (fromPoint: Point, toPoint: Point): Point[] | null => {
    const fromRooms = pointRoomIds(fromPoint);
    const toRooms = pointRoomIds(toPoint);
    if (!fromRooms.length || !toRooms.length) return null;
    for (const roomId of fromRooms) {
      if (!toRooms.includes(roomId)) continue;
      const entry = roomById.get(roomId);
      if (entry && segmentInsidePolygon(fromPoint, toPoint, entry.poly)) return simplifyCollinear([fromPoint, toPoint]);
    }
    if (!roomConnectorNodes.length) return null;
    const START = '__room_path_start__';
    const END = '__room_path_end__';
    const fromSet = new Set(fromRooms);
    const toSet = new Set(toRooms);
    const startEdges: Array<{ to: string; cost: number }> = [];
    const endEdgesByNode = new Map<string, number>();
    for (const node of roomConnectorNodes) {
      const sharedFrom = node.roomIds.filter((roomId) => fromSet.has(roomId));
      if (sharedFrom.length) {
        let bestFromCost = Number.POSITIVE_INFINITY;
        for (const roomId of sharedFrom) {
          const roomEntry = roomById.get(roomId);
          if (!roomEntry) continue;
          const link = roomConnectionCost(fromPoint, node.point, roomEntry.poly);
          if (!link) continue;
          if (link.cost < bestFromCost) bestFromCost = link.cost;
        }
        if (Number.isFinite(bestFromCost)) startEdges.push({ to: node.nodeId, cost: bestFromCost });
      }
      const sharedTo = node.roomIds.filter((roomId) => toSet.has(roomId));
      if (sharedTo.length) {
        let bestToCost = Number.POSITIVE_INFINITY;
        for (const roomId of sharedTo) {
          const roomEntry = roomById.get(roomId);
          if (!roomEntry) continue;
          const link = roomConnectionCost(toPoint, node.point, roomEntry.poly);
          if (!link) continue;
          if (link.cost < bestToCost) bestToCost = link.cost;
        }
        if (Number.isFinite(bestToCost)) endEdgesByNode.set(node.nodeId, bestToCost);
      }
    }
    if (!startEdges.length || !endEdgesByNode.size) return null;
    const dist = new Map<string, number>([[START, 0]]);
    const prev = new Map<string, string>();
    const heap = new MinHeap();
    heap.push({ key: START, score: 0 });
    while (heap.size) {
      const current = heap.pop();
      if (!current) break;
      const currentDist = dist.get(current.key);
      if (currentDist === undefined) continue;
      if (current.score > currentDist + 0.0001) continue;
      if (current.key === END) break;
      const edges: Array<{ to: string; cost: number }> = [];
      if (current.key === START) {
        edges.push(...startEdges);
      } else {
        edges.push(...(roomAdj.get(current.key) || []));
        const endCost = endEdgesByNode.get(current.key);
        if (endCost !== undefined) edges.push({ to: END, cost: endCost });
      }
      for (const edge of edges) {
        const candidate = currentDist + edge.cost;
        const prevBest = dist.get(edge.to);
        if (prevBest !== undefined && candidate >= prevBest - 0.0001) continue;
        dist.set(edge.to, candidate);
        prev.set(edge.to, current.key);
        heap.push({ key: edge.to, score: candidate });
      }
    }
    if (!dist.has(END)) return null;
    const chain: string[] = [];
    let cursor = END;
    while (cursor !== START) {
      const parent = prev.get(cursor);
      if (!parent) return null;
      if (cursor !== END) chain.push(cursor);
      cursor = parent;
    }
    chain.reverse();
    const points: Point[] = [fromPoint];
    for (const nodeKey of chain) {
      const node = connectorNodeById.get(nodeKey);
      if (!node) continue;
      const last = points[points.length - 1];
      if (!last || Math.hypot(last.x - node.point.x, last.y - node.point.y) > 0.0001) points.push(node.point);
    }
    points.push(toPoint);
    return simplifyCollinear(points);
  };
  const startRoomAccess = !startInsideCorridor ? buildRoomAccessToCorridorDoors(startPoint) : new Map<string, { points: Point[]; distance: number }>();
  const targetRoomAccess = !targetInsideCorridor
    ? buildRoomAccessToCorridorDoors(targetPoint)
    : new Map<string, { points: Point[]; distance: number }>();
  for (const door of doors) {
    if (!startInsideCorridor) {
      const access = startRoomAccess.get(door.id);
      if (access) {
        door.startPath = access.points;
        door.startDist = access.distance;
      } else {
        door.startDist = Number.POSITIVE_INFINITY;
      }
    }
    if (!targetInsideCorridor) {
      const access = targetRoomAccess.get(door.id);
      if (access) {
        door.endPathFromTarget = access.points;
        door.endDist = access.distance;
      } else {
        door.endDist = Number.POSITIVE_INFINITY;
      }
    }
  }

  const cellSize = chooseCellSize(plan);
  const { walkable, clearanceByKey } = buildWalkableGrid(corridors, cellSize);
  if (!walkable.size) return { error: 'no-walkable-corridors' };
  const { componentByKey, guideByComponent } = buildCorridorGuides(walkable, clearanceByKey);

  const keyByDoor = new Map<string, string | null>();
  const doorKey = (candidate: DoorCandidate) => {
    if (keyByDoor.has(candidate.id)) return keyByDoor.get(candidate.id) || null;
    const baseGx = Math.floor(candidate.anchor.x / cellSize);
    const baseGy = Math.floor(candidate.anchor.y / cellSize);
    let bestKey: string | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    const maxRadius = 18;
    for (let dy = -maxRadius; dy <= maxRadius; dy += 1) {
      for (let dx = -maxRadius; dx <= maxRadius; dx += 1) {
        const key = keyOf(baseGx + dx, baseGy + dy);
        if (!walkable.has(key)) continue;
        const { gx, gy } = parseKey(key);
        const center = centerOfCell(gx, gy, cellSize);
        if (!pointInPolygon(center, candidate.corridorPoly)) continue;
        const distSq = (center.x - candidate.anchor.x) * (center.x - candidate.anchor.x) + (center.y - candidate.anchor.y) * (center.y - candidate.anchor.y);
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestKey = key;
        }
      }
    }
    let key: string | null = bestKey;
    if (!key) key = findNearestWalkableKey(candidate.anchor, cellSize, walkable);
    keyByDoor.set(candidate.id, key);
    return key;
  };
  const pushGridCell = (out: GridCell[], cell: GridCell) => {
    const prev = out[out.length - 1];
    if (prev && prev.gx === cell.gx && prev.gy === cell.gy) return;
    out.push(cell);
  };
  const inComponent = (cell: GridCell, componentId: number) => componentByKey.get(keyOf(cell.gx, cell.gy)) === componentId;
  const appendAxisSegment = (out: GridCell[], from: GridCell, to: GridCell, componentId: number) => {
    if (from.gx !== to.gx && from.gy !== to.gy) return false;
    const stepX = Math.sign(to.gx - from.gx);
    const stepY = Math.sign(to.gy - from.gy);
    let gx = from.gx;
    let gy = from.gy;
    while (true) {
      const cell = { gx, gy };
      if (!inComponent(cell, componentId)) return false;
      pushGridCell(out, cell);
      if (gx === to.gx && gy === to.gy) break;
      gx += stepX;
      gy += stepY;
    }
    return true;
  };
  const findCenterCell = (guide: CorridorGuide, componentId: number, primary: number): GridCell | null => {
    const roundedCenter = Math.round(guide.center);
    const maxOffset = 80;
    for (let offset = 0; offset <= maxOffset; offset += 1) {
      const candidates = offset === 0 ? [roundedCenter] : [roundedCenter - offset, roundedCenter + offset];
      for (const secondary of candidates) {
        const cell = guide.orientation === 'horizontal'
          ? { gx: primary, gy: secondary }
          : { gx: secondary, gy: primary };
        if (inComponent(cell, componentId)) return cell;
      }
    }
    return null;
  };
  const buildStrictCenterPath = (startKey: string, endKey: string) => {
    const componentId = componentByKey.get(startKey);
    if (!Number.isFinite(componentId) || componentByKey.get(endKey) !== componentId) return null;
    const guide = guideByComponent.get(Number(componentId));
    if (!guide) return null;
    const start = parseKey(startKey);
    const end = parseKey(endKey);
    const path: GridCell[] = [];

    if (guide.orientation === 'horizontal') {
      const startCenter = findCenterCell(guide, Number(componentId), start.gx);
      const endCenter = findCenterCell(guide, Number(componentId), end.gx);
      if (!startCenter || !endCenter) return null;
      if (!appendAxisSegment(path, start, startCenter, Number(componentId))) return null;
      let cursor = startCenter;
      const stepX = Math.sign(endCenter.gx - startCenter.gx);
      if (stepX !== 0) {
        for (let gx = cursor.gx + stepX; ; gx += stepX) {
          const centerAtX = findCenterCell(guide, Number(componentId), gx);
          if (!centerAtX) return null;
          const alignY = { gx: cursor.gx, gy: centerAtX.gy };
          if (!appendAxisSegment(path, cursor, alignY, Number(componentId))) return null;
          cursor = alignY;
          if (!appendAxisSegment(path, cursor, centerAtX, Number(componentId))) return null;
          cursor = centerAtX;
          if (gx === endCenter.gx) break;
        }
      } else if (!appendAxisSegment(path, cursor, endCenter, Number(componentId))) {
        return null;
      } else {
        cursor = endCenter;
      }
      if (!appendAxisSegment(path, cursor, end, Number(componentId))) return null;
    } else {
      const startCenter = findCenterCell(guide, Number(componentId), start.gy);
      const endCenter = findCenterCell(guide, Number(componentId), end.gy);
      if (!startCenter || !endCenter) return null;
      if (!appendAxisSegment(path, start, startCenter, Number(componentId))) return null;
      let cursor = startCenter;
      const stepY = Math.sign(endCenter.gy - startCenter.gy);
      if (stepY !== 0) {
        for (let gy = cursor.gy + stepY; ; gy += stepY) {
          const centerAtY = findCenterCell(guide, Number(componentId), gy);
          if (!centerAtY) return null;
          const alignX = { gx: centerAtY.gx, gy: cursor.gy };
          if (!appendAxisSegment(path, cursor, alignX, Number(componentId))) return null;
          cursor = alignX;
          if (!appendAxisSegment(path, cursor, centerAtY, Number(componentId))) return null;
          cursor = centerAtY;
          if (gy === endCenter.gy) break;
        }
      } else if (!appendAxisSegment(path, cursor, endCenter, Number(componentId))) {
        return null;
      } else {
        cursor = endCenter;
      }
      if (!appendAxisSegment(path, cursor, end, Number(componentId))) return null;
    }

    return path.map((cell) => keyOf(cell.gx, cell.gy));
  };
  const corridorPath = (fromDoor: DoorCandidate, toDoor: DoorCandidate): Point[] | null => {
    const startKey = doorKey(fromDoor);
    if (!startKey) return null;
    const endKey = doorKey(toDoor);
    if (!endKey) return null;
    const strictPath = buildStrictCenterPath(startKey, endKey);
    const path = strictPath?.length
      ? strictPath
      : findCenterBiasedPath(startKey, endKey, walkable, clearanceByKey, componentByKey, guideByComponent);
    if (!path.length) return null;
    const centers = path.map((key) => {
      const { gx, gy } = parseKey(key);
      return centerOfCell(gx, gy, cellSize);
    });
    const centerRoute = simplifyCollinear(centers);
    const points: Point[] = [];
    pushPoint(points, fromDoor.anchor);
    if (centerRoute.length) {
      appendOrtho(points, points[points.length - 1], centerRoute[0], fromDoor.connectorAxis);
      for (let i = 1; i < centerRoute.length; i += 1) {
        pushPoint(points, centerRoute[i]);
      }
    }
    appendOrtho(points, points[points.length - 1], toDoor.anchor, oppositeAxis(toDoor.connectorAxis));
    return simplifyCollinear(points);
  };
  const buildCenterRouteFromKeys = (fromKey: string, toKey: string): Point[] | null => {
    const strictPath = buildStrictCenterPath(fromKey, toKey);
    const path = strictPath?.length
      ? strictPath
      : findCenterBiasedPath(fromKey, toKey, walkable, clearanceByKey, componentByKey, guideByComponent);
    if (!path.length) return null;
    const centers = path.map((key) => {
      const { gx, gy } = parseKey(key);
      return centerOfCell(gx, gy, cellSize);
    });
    return simplifyCollinear(centers);
  };
  const buildRouteFromWalkablePoints = (fromPoint: Point, toPoint: Point): { route?: RouteResult; error?: string } => {
    const fromKey = findNearestWalkableKey(fromPoint, cellSize, walkable);
    const toKey = findNearestWalkableKey(toPoint, cellSize, walkable);
    if (!fromKey) return { error: 'invalid-start' };
    if (!toKey) return { error: 'invalid-target' };
    const corridorPoints = buildCenterRouteFromKeys(fromKey, toKey);
    if (!corridorPoints?.length) return { error: 'path-not-found' };
    const centerStart = corridorPoints[0] || fromPoint;
    const centerEnd = corridorPoints[corridorPoints.length - 1] || toPoint;
    const approachPoints = [fromPoint, centerStart];
    const exitPoints = [centerEnd, toPoint];
    const distancePx = polylineLength(approachPoints) + polylineLength(corridorPoints) + polylineLength(exitPoints);
    const metersPerPixel = Number(plan.scale?.metersPerPixel);
    const distanceMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? distancePx * metersPerPixel : undefined;
    const etaSeconds = distanceMeters ? distanceMeters / SPEED_MPS : undefined;
    return {
      route: {
        startDoor: centerStart,
        endDoor: centerEnd,
        approachPoints,
        corridorPoints,
        exitPoints,
        distancePx,
        distanceMeters,
        etaSeconds
      }
    };
  };
  const buildMixedRouteOutsideToInside = (outsidePoint: Point, insidePoint: Point): { route?: RouteResult; error?: string } => {
    const insideKey = findNearestWalkableKey(insidePoint, cellSize, walkable);
    if (!insideKey) return { error: 'invalid-target' };
    const outsideRoomIds = pointRoomIds(outsidePoint);
    const outsideRequiresRoomPath = outsideRoomIds.length > 0;
    const outsideAccess = outsideRequiresRoomPath ? buildRoomAccessToCorridorDoors(outsidePoint) : new Map<string, { points: Point[]; distance: number }>();
    const sortedDoors = doors
      .slice()
      .sort(
        (a, b) =>
          (outsideAccess.get(a.id)?.distance ?? Math.hypot(outsidePoint.x - a.anchor.x, outsidePoint.y - a.anchor.y)) -
          (outsideAccess.get(b.id)?.distance ?? Math.hypot(outsidePoint.x - b.anchor.x, outsidePoint.y - b.anchor.y))
      );
    const limit = Math.min(24, sortedDoors.length);
    for (let i = 0; i < limit; i += 1) {
      const door = sortedDoors[i];
      const outsidePath = outsideAccess.get(door.id)?.points;
      if (outsideRequiresRoomPath && !outsidePath?.length) continue;
      const startKey = doorKey(door);
      if (!startKey) continue;
      const centerRoute = buildCenterRouteFromKeys(startKey, insideKey);
      if (!centerRoute?.length) continue;
      const corridorPoints: Point[] = [];
      pushPoint(corridorPoints, door.anchor);
      appendOrtho(corridorPoints, corridorPoints[corridorPoints.length - 1], centerRoute[0], door.connectorAxis);
      for (let j = 1; j < centerRoute.length; j += 1) pushPoint(corridorPoints, centerRoute[j]);
      const centerEnd = centerRoute[centerRoute.length - 1] || insidePoint;
      const safeCorridor = simplifyCollinear(corridorPoints);
      const approachPoints = outsidePath?.length ? outsidePath : [outsidePoint, door.anchor];
      const exitPoints = [centerEnd, insidePoint];
      const distancePx = polylineLength(approachPoints) + polylineLength(safeCorridor) + polylineLength(exitPoints);
      const metersPerPixel = Number(plan.scale?.metersPerPixel);
      const distanceMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? distancePx * metersPerPixel : undefined;
      const etaSeconds = distanceMeters ? distanceMeters / SPEED_MPS : undefined;
      return {
        route: {
          startDoor: door.anchor,
          endDoor: centerEnd,
          approachPoints,
          corridorPoints: safeCorridor,
          exitPoints,
          distancePx,
          distanceMeters,
          etaSeconds
        }
      };
    }
    return { error: 'path-not-found' };
  };
  const buildRoomOnlyRoute = (): { route: RouteResult } | null => {
    const points = buildRoomOnlyPath(startPoint, targetPoint);
    if (!points?.length) return null;
    const distancePx = polylineLength(points);
    const metersPerPixel = Number(plan.scale?.metersPerPixel);
    const distanceMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? distancePx * metersPerPixel : undefined;
    const etaSeconds = distanceMeters ? distanceMeters / SPEED_MPS : undefined;
    return {
      route: {
        startDoor: points[0],
        endDoor: points[points.length - 1],
        approachPoints: points,
        corridorPoints: [],
        exitPoints: [],
        distancePx,
        distanceMeters,
        etaSeconds,
        directDashedOnly: true
      }
    };
  };

  if (startInsideCorridor && targetInsideCorridor) {
    return buildRouteFromWalkablePoints(startPoint, targetPoint);
  }
  if (startInsideCorridor && !targetInsideCorridor) {
    const mixed = buildMixedRouteOutsideToInside(targetPoint, startPoint);
    if (mixed.route) return { route: reverseRoute(mixed.route) };
    return { error: mixed.error || 'path-not-found' };
  }
  if (!startInsideCorridor && targetInsideCorridor) {
    const mixed = buildMixedRouteOutsideToInside(startPoint, targetPoint);
    if (mixed.route) return mixed;
    return { error: mixed.error || 'path-not-found' };
  }

  const allowWalkableFallback = startInsideCorridor || targetInsideCorridor;
  if (!doors.length) {
    const roomOnly = buildRoomOnlyRoute();
    if (roomOnly) return roomOnly;
    if (!corridors.length) return { error: 'no-corridors' };
    if (allowWalkableFallback) {
      const fallback = buildRouteFromWalkablePoints(startPoint, targetPoint);
      if (fallback.route) return fallback;
    }
    return { error: 'no-doors' };
  }

  const startCandidates = doors.filter((door) => Number.isFinite(door.startDist)).slice().sort((a, b) => a.startDist - b.startDist);
  const endCandidates = doors.filter((door) => Number.isFinite(door.endDist)).slice().sort((a, b) => a.endDist - b.endDist);
  type DoorPair = {
    startDoor: DoorCandidate;
    endDoor: DoorCandidate;
    corridorPoints: Point[];
    score: number;
  };
  const allowSameDoor = Math.hypot(startPoint.x - targetPoint.x, startPoint.y - targetPoint.y) <= (cellSize * 1.5);
  const nearestStartDoor = startCandidates.find((door) => Boolean(doorKey(door))) || null;
  const nearestEndDoor = endCandidates.find((door) => Boolean(doorKey(door))) || null;

  let bestPair: DoorPair | null = null;
  if (nearestStartDoor && nearestEndDoor) {
    if (allowSameDoor || nearestStartDoor.id !== nearestEndDoor.id) {
      const nearestPoints = corridorPath(nearestStartDoor, nearestEndDoor);
      if (nearestPoints) {
        bestPair = {
          startDoor: nearestStartDoor,
          endDoor: nearestEndDoor,
          corridorPoints: nearestPoints,
          score: nearestStartDoor.startDist + polylineLength(nearestPoints) + nearestEndDoor.endDist
        };
      }
    }
  }

  // Fallback only when nearest-nearest is not feasible:
  // strict lexicographic nearest policy (start first, then destination).
  if (!bestPair) {
    const startLimit = Math.min(24, startCandidates.length);
    const endLimit = Math.min(24, endCandidates.length);
    let found = false;
    for (let i = 0; i < startLimit; i += 1) {
      const startDoor = startCandidates[i];
      for (let j = 0; j < endLimit; j += 1) {
        const endDoor = endCandidates[j];
        if (!allowSameDoor && startDoor.id === endDoor.id) continue;
        const points = corridorPath(startDoor, endDoor);
        if (!points) continue;
        bestPair = {
          startDoor,
          endDoor,
          corridorPoints: points,
          score: startDoor.startDist + polylineLength(points) + endDoor.endDist
        };
        found = true;
        break;
      }
      if (found) break;
    }
  }

  if (!bestPair) {
    const roomOnly = buildRoomOnlyRoute();
    if (roomOnly) return roomOnly;
    if (allowWalkableFallback) {
      const fallback = buildRouteFromWalkablePoints(startPoint, targetPoint);
      if (fallback.route) return fallback;
    }
    return { error: 'path-not-found' };
  }

  const approachPoints =
    startInsideCorridor
      ? [startPoint, bestPair.startDoor.anchor]
      : bestPair.startDoor.startPath?.length
        ? bestPair.startDoor.startPath
        : [startPoint, bestPair.startDoor.anchor];
  const exitPoints =
    targetInsideCorridor
      ? [bestPair.endDoor.anchor, targetPoint]
      : bestPair.endDoor.endPathFromTarget?.length
        ? [...bestPair.endDoor.endPathFromTarget].reverse()
        : [bestPair.endDoor.anchor, targetPoint];
  const distancePx = polylineLength(approachPoints) + polylineLength(bestPair.corridorPoints) + polylineLength(exitPoints);
  const metersPerPixel = Number(plan.scale?.metersPerPixel);
  const distanceMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? distancePx * metersPerPixel : undefined;
  const etaSeconds = distanceMeters ? distanceMeters / SPEED_MPS : undefined;

  return {
    route: {
      startDoor: bestPair.startDoor.anchor,
      endDoor: bestPair.endDoor.anchor,
      approachPoints,
      corridorPoints: bestPair.corridorPoints,
      exitPoints,
      distancePx,
      distanceMeters,
      etaSeconds
    }
  };
};

export const reverseRoute = (route: RouteResult): RouteResult => ({
  startDoor: { ...route.endDoor },
  endDoor: { ...route.startDoor },
  approachPoints: [...(route.exitPoints || [])].reverse(),
  corridorPoints: [...(route.corridorPoints || [])].reverse(),
  exitPoints: [...(route.approachPoints || [])].reverse(),
  distancePx: route.distancePx,
  distanceMeters: route.distanceMeters,
  etaSeconds: route.etaSeconds,
  directDashedOnly: route.directDashedOnly
});
