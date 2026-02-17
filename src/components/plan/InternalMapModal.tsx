import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, Crosshair, FileDown, Info, MapPin, Maximize2, Minimize2, Navigation, Route, Search, Server, Trash2, User, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Client, Corridor, FloorPlan, Room } from '../../store/types';
import { useLang, useT } from '../../i18n/useT';

type Point = { x: number; y: number };
type Axis = 'x' | 'y';

type EntryKind = 'object' | 'rack_item' | 'room' | 'corridor';

interface SearchEntry {
  id: string;
  kind: EntryKind;
  label: string;
  subtitle: string;
  search: string;
  point: Point;
  roomId?: string;
}

interface RouteResult {
  startDoor: Point;
  endDoor: Point;
  approachPoints: Point[];
  corridorPoints: Point[];
  exitPoints: Point[];
  distancePx: number;
  distanceMeters?: number;
  etaSeconds?: number;
}

type ConnectionTransitionType = 'stairs' | 'elevator';

interface RoutePlanSegment {
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

interface MultiFloorRouteResult {
  segments: RoutePlanSegment[];
  distancePx: number;
  distanceMeters?: number;
  transitionSeconds: number;
  etaSeconds?: number;
}

interface Props {
  open: boolean;
  clients: Client[];
  objectTypeLabels: Record<string, string>;
  initialLocation?: { clientId?: string; siteId?: string; planId?: string };
  onClose: () => void;
}

const SPEED_MPS = 1.4;

const pointInPolygon = (p: Point, polygon: Point[]) => {
  if (!polygon.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 0.000001) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

const polygonCentroid = (polygon: Point[]) => {
  if (!polygon.length) return { x: 0, y: 0 };
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
  if (Math.abs(area2) < 0.000001) {
    const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
};

const distancePointToSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (!lenSq) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return Math.hypot(p.x - x, p.y - y);
};

const pointOnPolygonBoundary = (point: Point, polygon: Point[], tolerance = 1.25) => {
  if (!polygon.length) return false;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (distancePointToSegment(point, a, b) <= tolerance) return true;
  }
  return false;
};

const corridorPolygon = (corridor: Corridor): Point[] => {
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

const roomPolygon = (room: Room): Point[] => {
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

const getCorridorDoorAnchor = (corridor: Corridor, door: any): Point | null => {
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

const getCorridorConnectionAnchor = (corridor: Corridor, connection: any): Point | null => {
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

const normalizeTransitionType = (value: any): ConnectionTransitionType => (String(value || '') === 'elevator' ? 'elevator' : 'stairs');

const transitionPenaltySeconds = (value?: ConnectionTransitionType) => (value === 'elevator' ? 30 : 15);

const preferredDoorAxis = (corridorPoly: Point[], anchor: Point): Axis => {
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

class MinHeap {
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

const keyOf = (gx: number, gy: number) => `${gx}:${gy}`;

const parseKey = (key: string) => {
  const [gxRaw, gyRaw] = key.split(':');
  return { gx: Number(gxRaw), gy: Number(gyRaw) };
};

const centerOfCell = (gx: number, gy: number, cellSize: number): Point => ({
  x: (gx + 0.5) * cellSize,
  y: (gy + 0.5) * cellSize
});

const pushPoint = (points: Point[], next: Point) => {
  const prev = points[points.length - 1];
  if (!prev) {
    points.push(next);
    return;
  }
  if (Math.hypot(prev.x - next.x, prev.y - next.y) < 0.6) return;
  points.push(next);
};

const appendOrtho = (points: Point[], from: Point, to: Point, firstAxis: Axis = 'x') => {
  if (Math.abs(from.x - to.x) < 0.6 || Math.abs(from.y - to.y) < 0.6) {
    pushPoint(points, { x: to.x, y: to.y });
    return;
  }
  const bend = firstAxis === 'y' ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
  pushPoint(points, bend);
  pushPoint(points, { x: to.x, y: to.y });
};

const oppositeAxis = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');

const simplifyCollinear = (points: Point[]) => {
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

const polylineLength = (points: Point[]) => {
  let length = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
};

const chooseCellSize = (plan: FloorPlan) => {
  const width = Number(plan.width || 0);
  const height = Number(plan.height || 0);
  const maxDim = Math.max(width, height);
  if (maxDim > 7000) return 28;
  if (maxDim > 5000) return 24;
  if (maxDim > 3000) return 20;
  return 16;
};

const buildWalkableGrid = (corridors: Corridor[], cellSize: number) => {
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

const findNearestWalkableKey = (point: Point, cellSize: number, walkable: Set<string>) => {
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

type CorridorGuide = {
  componentId: number;
  orientation: 'horizontal' | 'vertical';
  center: number;
};

const buildCorridorGuides = (walkable: Set<string>, clearanceByKey: Map<string, number>) => {
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

const findCenterBiasedPath = (
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

const computeRoute = (plan: FloorPlan, startPoint: Point, targetPoint: Point): { route?: RouteResult; error?: string } => {
  type GridCell = { gx: number; gy: number };
  type DoorCandidate = {
    id: string;
    anchor: Point;
    corridorPoly: Point[];
    connectorAxis: Axis;
    startDist: number;
    endDist: number;
  };

  const corridors = ((plan.corridors || []) as Corridor[]).filter(Boolean);
  if (!corridors.length) return { error: 'no-corridors' };
  const corridorPolys = corridors.map((corridor) => corridorPolygon(corridor)).filter((poly) => poly.length >= 3);
  const isPointInOrOnCorridor = (point: Point) =>
    corridorPolys.some((poly) => pointInPolygon(point, poly) || pointOnPolygonBoundary(point, poly));
  const startInsideCorridor = isPointInOrOnCorridor(startPoint);
  const targetInsideCorridor = isPointInOrOnCorridor(targetPoint);
  const doors: DoorCandidate[] = [];
  for (const corridor of corridors) {
    const poly = corridorPolygon(corridor);
    if (poly.length < 3) continue;
    for (let doorIndex = 0; doorIndex < (corridor.doors || []).length; doorIndex += 1) {
      const door = (corridor.doors || [])[doorIndex];
      const anchor = getCorridorDoorAnchor(corridor, door);
      if (!anchor) continue;
      doors.push({
        id: `${String(corridor.id)}:${doorIndex}:${String((door as any)?.id || '')}:${String((door as any)?.edgeIndex ?? '')}:${String((door as any)?.t ?? '')}`,
        anchor,
        corridorPoly: poly,
        connectorAxis: preferredDoorAxis(poly, anchor),
        startDist: Math.hypot(startPoint.x - anchor.x, startPoint.y - anchor.y),
        endDist: Math.hypot(targetPoint.x - anchor.x, targetPoint.y - anchor.y)
      });
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
    const sortedDoors = doors
      .slice()
      .sort(
        (a, b) =>
          Math.hypot(outsidePoint.x - a.anchor.x, outsidePoint.y - a.anchor.y) -
          Math.hypot(outsidePoint.x - b.anchor.x, outsidePoint.y - b.anchor.y)
      );
    const limit = Math.min(24, sortedDoors.length);
    for (let i = 0; i < limit; i += 1) {
      const door = sortedDoors[i];
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
      const approachPoints = [outsidePoint, door.anchor];
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
    if (allowWalkableFallback) {
      const fallback = buildRouteFromWalkablePoints(startPoint, targetPoint);
      if (fallback.route) return fallback;
    }
    return { error: 'no-doors' };
  }

  const startCandidates = doors.slice().sort((a, b) => a.startDist - b.startDist);
  const endCandidates = doors.slice().sort((a, b) => a.endDist - b.endDist);
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
    if (allowWalkableFallback) {
      const fallback = buildRouteFromWalkablePoints(startPoint, targetPoint);
      if (fallback.route) return fallback;
    }
    return { error: 'path-not-found' };
  }

  const approachPoints = [startPoint, bestPair.startDoor.anchor];
  const exitPoints = [bestPair.endDoor.anchor, targetPoint];
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

const reverseRoute = (route: RouteResult): RouteResult => ({
  startDoor: { ...route.endDoor },
  endDoor: { ...route.startDoor },
  approachPoints: [...(route.exitPoints || [])].reverse(),
  corridorPoints: [...(route.corridorPoints || [])].reverse(),
  exitPoints: [...(route.approachPoints || [])].reverse(),
  distancePx: route.distancePx,
  distanceMeters: route.distanceMeters,
  etaSeconds: route.etaSeconds
});

const computeMultiFloorRoute = (
  plans: FloorPlan[],
  startPlanId: string,
  destinationPlanId: string,
  startPoint: Point,
  destinationPoint: Point
): { result?: MultiFloorRouteResult; error?: string } => {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const startPlan = planById.get(startPlanId);
  const destinationPlan = planById.get(destinationPlanId);
  if (!startPlan || !destinationPlan) return { error: 'path-not-found' };

  if (startPlan.id === destinationPlan.id) {
    const direct = computeRoute(startPlan, startPoint, destinationPoint);
    if (!direct.route) return { error: direct.error || 'path-not-found' };
    return {
      result: {
        segments: [
          {
            planId: startPlan.id,
            planName: String(startPlan.name || ''),
            startPoint,
            endPoint: destinationPoint,
            route: direct.route
          }
        ],
        distancePx: direct.route.distancePx,
        distanceMeters: direct.route.distanceMeters,
        transitionSeconds: 0,
        etaSeconds: direct.route.etaSeconds
      }
    };
  }

  type ConnectionNode = {
    nodeId: string;
    planId: string;
    planName: string;
    connectionId: string;
    point: Point;
    targets: string[];
    transitionType: ConnectionTransitionType;
  };
  type GraphEdge =
    | {
        kind: 'walk';
        fromNode: string;
        toNode: string;
        planId: string;
        route: RouteResult;
        startPoint: Point;
        endPoint: Point;
        startConnectionId?: string;
        endConnectionId?: string;
        cost: number;
      }
    | {
        kind: 'transition';
        fromNode: string;
        toNode: string;
        fromConnectionId: string;
        toConnectionId: string;
        fromPlanId: string;
        toPlanId: string;
        transitionType: ConnectionTransitionType;
        seconds: number;
        cost: number;
      };

  const connectionNodes: ConnectionNode[] = [];
  const nodesByPlan = new Map<string, ConnectionNode[]>();
  for (const plan of plans) {
    const planNodes: ConnectionNode[] = [];
    for (const corridor of (plan.corridors || []) as Corridor[]) {
      for (const connection of corridor.connections || []) {
        const anchor = getCorridorConnectionAnchor(corridor, connection);
        if (!anchor) continue;
        const node: ConnectionNode = {
          nodeId: `cp:${plan.id}:${connection.id}`,
          planId: plan.id,
          planName: String(plan.name || ''),
          connectionId: String(connection.id),
          point: anchor,
          targets: Array.from(new Set((connection.planIds || []).map((id) => String(id)).filter(Boolean))),
          transitionType: normalizeTransitionType((connection as any).transitionType)
        };
        planNodes.push(node);
        connectionNodes.push(node);
      }
    }
    nodesByPlan.set(plan.id, planNodes);
  }

  const startPlanConnections = nodesByPlan.get(startPlan.id) || [];
  const destinationPlanConnections = nodesByPlan.get(destinationPlan.id) || [];
  if (!startPlanConnections.length || !destinationPlanConnections.length) {
    return { error: 'path-not-found' };
  }

  const meterSamples = plans
    .map((plan) => Number(plan.scale?.metersPerPixel))
    .filter((value) => Number.isFinite(value) && value > 0) as number[];
  const avgMetersPerPixel = meterSamples.length
    ? meterSamples.reduce((sum, value) => sum + value, 0) / meterSamples.length
    : 0.05;

  const transitionCost = (type: ConnectionTransitionType) => {
    const seconds = transitionPenaltySeconds(type);
    return Math.max(1, (seconds * SPEED_MPS) / Math.max(0.000001, avgMetersPerPixel));
  };

  const START_NODE = '__start__';
  const END_NODE = '__end__';
  const adjacency = new Map<string, GraphEdge[]>();
  const addEdge = (edge: GraphEdge) => {
    const list = adjacency.get(edge.fromNode) || [];
    list.push(edge);
    adjacency.set(edge.fromNode, list);
  };

  const routeCache = new Map<string, RouteResult | null>();
  const routeKey = (planId: string, a: Point, b: Point) =>
    `${planId}:${Number(a.x.toFixed(3))},${Number(a.y.toFixed(3))}->${Number(b.x.toFixed(3))},${Number(b.y.toFixed(3))}`;
  const getRoute = (plan: FloorPlan, from: Point, to: Point) => {
    const key = routeKey(plan.id, from, to);
    if (routeCache.has(key)) return routeCache.get(key);
    const result = computeRoute(plan, from, to).route || null;
    routeCache.set(key, result);
    if (result) {
      const reverseKey = routeKey(plan.id, to, from);
      routeCache.set(reverseKey, reverseRoute(result));
    }
    return result;
  };

  const addWalkBothWays = (
    plan: FloorPlan,
    fromNode: string,
    fromPoint: Point,
    toNode: string,
    toPoint: Point,
    startConnectionId?: string,
    endConnectionId?: string
  ) => {
    if (fromNode === toNode) return;
    const forward = getRoute(plan, fromPoint, toPoint);
    if (!forward) return;
    addEdge({
      kind: 'walk',
      fromNode,
      toNode,
      planId: plan.id,
      route: forward,
      startPoint: fromPoint,
      endPoint: toPoint,
      startConnectionId,
      endConnectionId,
      cost: Math.max(1, forward.distancePx)
    });
    addEdge({
      kind: 'walk',
      fromNode: toNode,
      toNode: fromNode,
      planId: plan.id,
      route: reverseRoute(forward),
      startPoint: toPoint,
      endPoint: fromPoint,
      startConnectionId: endConnectionId,
      endConnectionId: startConnectionId,
      cost: Math.max(1, forward.distancePx)
    });
  };

  for (const connection of startPlanConnections) {
    const route = computeRoute(startPlan, startPoint, connection.point).route;
    if (!route) continue;
    addEdge({
      kind: 'walk',
      fromNode: START_NODE,
      toNode: connection.nodeId,
      planId: startPlan.id,
      route,
      startPoint,
      endPoint: connection.point,
      endConnectionId: connection.connectionId,
      cost: Math.max(1, route.distancePx)
    });
  }

  for (const connection of destinationPlanConnections) {
    const route = computeRoute(destinationPlan, connection.point, destinationPoint).route;
    if (!route) continue;
    addEdge({
      kind: 'walk',
      fromNode: connection.nodeId,
      toNode: END_NODE,
      planId: destinationPlan.id,
      route,
      startPoint: connection.point,
      endPoint: destinationPoint,
      startConnectionId: connection.connectionId,
      cost: Math.max(1, route.distancePx)
    });
  }

  for (const [planId, nodes] of nodesByPlan.entries()) {
    const plan = planById.get(planId);
    if (!plan || nodes.length < 2) continue;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        addWalkBothWays(plan, a.nodeId, a.point, b.nodeId, b.point, a.connectionId, b.connectionId);
      }
    }
  }

  for (let i = 0; i < connectionNodes.length; i += 1) {
    for (let j = i + 1; j < connectionNodes.length; j += 1) {
      const a = connectionNodes[i];
      const b = connectionNodes[j];
      if (a.planId === b.planId) continue;
      const linked = a.targets.includes(b.planId) || b.targets.includes(a.planId);
      if (!linked) continue;
      const abType = a.transitionType;
      const baType = b.transitionType;
      addEdge({
        kind: 'transition',
        fromNode: a.nodeId,
        toNode: b.nodeId,
        fromConnectionId: a.connectionId,
        toConnectionId: b.connectionId,
        fromPlanId: a.planId,
        toPlanId: b.planId,
        transitionType: abType,
        seconds: transitionPenaltySeconds(abType),
        cost: transitionCost(abType)
      });
      addEdge({
        kind: 'transition',
        fromNode: b.nodeId,
        toNode: a.nodeId,
        fromConnectionId: b.connectionId,
        toConnectionId: a.connectionId,
        fromPlanId: b.planId,
        toPlanId: a.planId,
        transitionType: baType,
        seconds: transitionPenaltySeconds(baType),
        cost: transitionCost(baType)
      });
    }
  }

  const bestByNode = new Map<string, number>([[START_NODE, 0]]);
  const previous = new Map<string, { prevNode: string; edge: GraphEdge }>();
  const heap = new MinHeap();
  heap.push({ key: START_NODE, score: 0 });
  while (heap.size) {
    const next = heap.pop();
    if (!next) break;
    const currentNode = next.key;
    const currentDist = bestByNode.get(currentNode);
    if (currentDist === undefined) continue;
    if (next.score > currentDist + 0.0001) continue;
    if (currentNode === END_NODE) break;
    for (const edge of adjacency.get(currentNode) || []) {
      const candidate = currentDist + edge.cost;
      const prevBest = bestByNode.get(edge.toNode);
      if (prevBest !== undefined && candidate >= prevBest - 0.0001) continue;
      bestByNode.set(edge.toNode, candidate);
      previous.set(edge.toNode, { prevNode: currentNode, edge });
      heap.push({ key: edge.toNode, score: candidate });
    }
  }

  if (!bestByNode.has(END_NODE)) return { error: 'path-not-found' };

  const orderedEdges: GraphEdge[] = [];
  let cursor = END_NODE;
  while (cursor !== START_NODE) {
    const prev = previous.get(cursor);
    if (!prev) return { error: 'path-not-found' };
    orderedEdges.push(prev.edge);
    cursor = prev.prevNode;
  }
  orderedEdges.reverse();

  const segments: RoutePlanSegment[] = [];
  let transitionSeconds = 0;
  for (let i = 0; i < orderedEdges.length; i += 1) {
    const edge = orderedEdges[i];
    if (edge.kind === 'transition') {
      transitionSeconds += edge.seconds;
      continue;
    }
    const prevTransition = i > 0 && orderedEdges[i - 1].kind === 'transition' ? (orderedEdges[i - 1] as GraphEdge & { kind: 'transition' }) : null;
    const nextTransition =
      i + 1 < orderedEdges.length && orderedEdges[i + 1].kind === 'transition'
        ? (orderedEdges[i + 1] as GraphEdge & { kind: 'transition' })
        : null;
    const plan = planById.get(edge.planId);
    if (!plan) continue;
    segments.push({
      planId: edge.planId,
      planName: String(plan.name || edge.planId),
      startPoint: edge.startPoint,
      endPoint: edge.endPoint,
      route: edge.route,
      startConnectionId: edge.startConnectionId,
      endConnectionId: edge.endConnectionId,
      startTransitionType: prevTransition?.transitionType,
      endTransitionType: nextTransition?.transitionType
    });
  }

  if (!segments.length) return { error: 'path-not-found' };

  const distancePx = segments.reduce((sum, segment) => sum + segment.route.distancePx, 0);
  const hasMeters = segments.every(
    (segment) => typeof segment.route.distanceMeters === 'number' && Number.isFinite(segment.route.distanceMeters)
  );
  const distanceMeters = hasMeters
    ? segments.reduce((sum, segment) => sum + Number(segment.route.distanceMeters || 0), 0)
    : undefined;
  const etaSeconds = distanceMeters !== undefined ? distanceMeters / SPEED_MPS + transitionSeconds : undefined;

  return {
    result: {
      segments,
      distancePx,
      distanceMeters,
      transitionSeconds,
      etaSeconds
    }
  };
};

const formatEta = (seconds?: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '--';
  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  if (!minutes) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const InternalMapModal = ({ open, clients, objectTypeLabels, initialLocation, onClose }: Props) => {
  const t = useT();
  const lang = useLang();
  const patternId = useId().replace(/:/g, '-');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const pdfPreviewRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [startPlanId, setStartPlanId] = useState('');
  const [destinationPlanId, setDestinationPlanId] = useState('');
  const [startMode, setStartMode] = useState<'map' | 'search'>('map');
  const [startQuery, setStartQuery] = useState('');
  const [selectedStartEntryId, setSelectedStartEntryId] = useState<string>('');
  const [startPointSource, setStartPointSource] = useState<'map' | 'search' | null>(null);
  const [destinationMode, setDestinationMode] = useState<'map' | 'search'>('map');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedDestinationEntryId, setSelectedDestinationEntryId] = useState<string>('');
  const [destinationPointSource, setDestinationPointSource] = useState<'map' | 'search' | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<Point | null>(null);
  const [routeResult, setRouteResult] = useState<MultiFloorRouteResult | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [routeError, setRouteError] = useState<string>('');
  const [computing, setComputing] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState('');
  const [pdfPreparing, setPdfPreparing] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const clientsWithPlans = useMemo(
    () => (clients || []).filter((client) => (client.sites || []).some((site) => (site.floorPlans || []).length > 0)),
    [clients]
  );

  const selectedClient = useMemo(
    () => clientsWithPlans.find((client) => client.id === selectedClientId),
    [clientsWithPlans, selectedClientId]
  );
  const availableSites = useMemo(() => (selectedClient?.sites || []).filter((site) => (site.floorPlans || []).length > 0), [selectedClient?.sites]);
  const selectedSite = useMemo(() => availableSites.find((site) => site.id === selectedSiteId), [availableSites, selectedSiteId]);
  const availablePlans = useMemo(() => selectedSite?.floorPlans || [], [selectedSite?.floorPlans]);
  const startPlan = useMemo(() => availablePlans.find((plan) => plan.id === startPlanId), [availablePlans, startPlanId]);
  const destinationPlan = useMemo(
    () => availablePlans.find((plan) => plan.id === destinationPlanId),
    [availablePlans, destinationPlanId]
  );
  const activeRouteSegment = useMemo(() => {
    if (!routeResult) return null;
    if (!routeResult.segments.length) return null;
    const safeIndex = Math.max(0, Math.min(routeResult.segments.length - 1, activeSegmentIndex));
    return routeResult.segments[safeIndex] || null;
  }, [activeSegmentIndex, routeResult]);
  const activeRoutePlan = useMemo(
    () => availablePlans.find((plan) => plan.id === activeRouteSegment?.planId) || null,
    [activeRouteSegment?.planId, availablePlans]
  );
  const mapPlan = step === 1 ? startPlan : step === 2 ? destinationPlan : (activeRoutePlan || destinationPlan || startPlan || null);
  const mapWidth = Number(mapPlan?.width || 0) > 0 ? Number(mapPlan?.width) : 1600;
  const mapHeight = Number(mapPlan?.height || 0) > 0 ? Number(mapPlan?.height) : 900;
  const activeRoute = activeRouteSegment?.route || null;
  const routeSegmentCount = routeResult?.segments.length || 0;
  const routeIsMultiFloor = routeSegmentCount > 1;

  useEffect(() => {
    if (!open) return;
    const initialClient = initialLocation?.clientId && clientsWithPlans.some((client) => client.id === initialLocation.clientId)
      ? initialLocation.clientId
      : clientsWithPlans[0]?.id || '';
    const clientEntity = clientsWithPlans.find((client) => client.id === initialClient);
    const initialSite = initialLocation?.siteId && clientEntity?.sites.some((site) => site.id === initialLocation.siteId)
      ? initialLocation.siteId
      : (clientEntity?.sites || []).find((site) => (site.floorPlans || []).length > 0)?.id || '';
    const siteEntity = clientEntity?.sites.find((site) => site.id === initialSite);
    const initialPlan = initialLocation?.planId && siteEntity?.floorPlans.some((plan) => plan.id === initialLocation.planId)
      ? initialLocation.planId
      : siteEntity?.floorPlans?.[0]?.id || '';
    setSelectedClientId(initialClient);
    setSelectedSiteId(initialSite);
    setStartPlanId(initialPlan);
    setDestinationPlanId(initialPlan);
    setStep(1);
    setStartMode('map');
    setStartQuery('');
    setSelectedStartEntryId('');
    setStartPointSource(null);
    setDestinationMode('map');
    setDestinationQuery('');
    setSelectedDestinationEntryId('');
    setDestinationPointSource(null);
    setStartPoint(null);
    setDestinationPoint(null);
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
    setComputing(false);
    setPdfPreviewOpen(false);
    setPdfPreviewHtml('');
    setPdfPreparing(false);
    setPdfExporting(false);
  }, [clientsWithPlans, initialLocation?.clientId, initialLocation?.planId, initialLocation?.siteId, open]);

  useEffect(() => {
    if (!selectedClient) {
      setSelectedSiteId('');
      setStartPlanId('');
      setDestinationPlanId('');
      return;
    }
    if (!availableSites.find((site) => site.id === selectedSiteId)) {
      const nextSiteId = availableSites[0]?.id || '';
      setSelectedSiteId(nextSiteId);
      const nextPlanId = (availableSites[0]?.floorPlans || [])[0]?.id || '';
      setStartPlanId(nextPlanId);
      setDestinationPlanId(nextPlanId);
    }
  }, [availableSites, selectedClient, selectedSiteId]);

  useEffect(() => {
    if (!selectedSite) {
      setStartPlanId('');
      setDestinationPlanId('');
      return;
    }
    if (!availablePlans.find((plan) => plan.id === startPlanId)) {
      const fallbackPlanId = availablePlans[0]?.id || '';
      setStartPlanId(fallbackPlanId);
      if (!availablePlans.find((plan) => plan.id === destinationPlanId)) {
        setDestinationPlanId(fallbackPlanId);
      }
      return;
    }
    if (!availablePlans.find((plan) => plan.id === destinationPlanId)) {
      setDestinationPlanId(startPlanId || availablePlans[0]?.id || '');
    }
  }, [availablePlans, destinationPlanId, selectedSite, startPlanId]);

  const buildSearchEntries = (plan: FloorPlan | null | undefined) => {
    if (!plan) return [] as SearchEntry[];
    const entries: SearchEntry[] = [];
    const roomNameById = new Map<string, string>();
    const roomUserNamesById = new Map<string, string[]>();
    for (const room of plan.rooms || []) {
      roomNameById.set(room.id, String(room.name || '').trim());
    }
    for (const obj of plan.objects || []) {
      const roomId = String(obj.roomId || '').trim();
      if (!roomId) continue;
      const typeId = String(obj.type || '');
      if (typeId !== 'user' && typeId !== 'generic_user' && typeId !== 'real_user') continue;
      const fullName =
        typeId === 'real_user'
          ? `${String((obj as any).firstName || '').trim()} ${String((obj as any).lastName || '').trim()}`.trim()
          : String(obj.name || '').trim();
      if (!fullName) continue;
      const list = roomUserNamesById.get(roomId) || [];
      list.push(fullName);
      roomUserNamesById.set(roomId, list);
    }
    for (const obj of plan.objects || []) {
      const first = String((obj as any).firstName || '').trim();
      const last = String((obj as any).lastName || '').trim();
      const realUserName = `${first} ${last}`.trim();
      const label = obj.type === 'real_user' && realUserName ? realUserName : String(obj.name || '').trim() || objectTypeLabels[obj.type] || obj.type;
      const roomName = obj.roomId ? roomNameById.get(String(obj.roomId)) || '' : '';
      const typeLabel = objectTypeLabels[obj.type] || obj.type;
      const subtitle = roomName
        ? `${typeLabel} - ${t({ it: 'Stanza', en: 'Room' })}: ${roomName}`
        : `${typeLabel} - ${t({ it: 'Oggetto mappa', en: 'Map object' })}`;
      const search = `${label} ${obj.name || ''} ${obj.description || ''} ${typeLabel} ${roomName} ${realUserName}`.toLowerCase();
      entries.push({
        id: `obj:${obj.id}`,
        kind: 'object',
        label,
        subtitle,
        search,
        point: { x: Number(obj.x || 0), y: Number(obj.y || 0) },
        roomId: obj.roomId ? String(obj.roomId) : undefined
      });
    }

    const rackObjectById = new Map((plan.objects || []).filter((obj) => obj.type === 'rack').map((obj) => [obj.id, obj]));
    for (const rackItem of plan.rackItems || []) {
      const rackObject = rackObjectById.get(rackItem.rackId);
      if (!rackObject) continue;
      const label = String(rackItem.name || '').trim() || `${t({ it: 'Apparato rack', en: 'Rack item' })} ${rackItem.type}`;
      const rackName = String(rackObject.name || '').trim() || t({ it: 'Rack', en: 'Rack' });
      const roomName = rackObject.roomId ? roomNameById.get(String(rackObject.roomId)) || '' : '';
      const subtitle = roomName
        ? `${rackName} - ${t({ it: 'Stanza', en: 'Room' })}: ${roomName}`
        : rackName;
      const search = `${label} ${rackItem.type || ''} ${rackItem.model || ''} ${rackItem.brand || ''} ${rackName} ${roomName}`.toLowerCase();
      entries.push({
        id: `rack_item:${rackItem.id}`,
        kind: 'rack_item',
        label,
        subtitle,
        search,
        point: { x: Number(rackObject.x || 0), y: Number(rackObject.y || 0) },
        roomId: rackObject.roomId ? String(rackObject.roomId) : undefined
      });
    }

    for (const room of plan.rooms || []) {
      const polygon = roomPolygon(room);
      const center = polygon.length ? polygonCentroid(polygon) : { x: Number(room.x || 0), y: Number(room.y || 0) };
      const users = roomUserNamesById.get(room.id) || [];
      const subtitle = t({
        it: `Stanza - utenti: ${users.length}`,
        en: `Room - users: ${users.length}`
      });
      const search = `${String(room.name || '')} ${users.join(' ')}`.toLowerCase();
      entries.push({
        id: `room:${room.id}`,
        kind: 'room',
        label: String(room.name || '').trim() || t({ it: 'Stanza senza nome', en: 'Unnamed room' }),
        subtitle,
        search,
        point: center,
        roomId: room.id
      });
    }

    for (const corridor of (plan.corridors || []) as Corridor[]) {
      const polygon = corridorPolygon(corridor);
      if (!polygon.length) continue;
      const center = polygonCentroid(polygon);
      const label = String(corridor.name || '').trim() || t({ it: 'Corridoio', en: 'Corridor' });
      entries.push({
        id: `corridor:${corridor.id}`,
        kind: 'corridor',
        label,
        subtitle: t({ it: 'Corridoio', en: 'Corridor' }),
        search: `${label} corridor corridoio`.toLowerCase(),
        point: center
      });
    }

    return entries;
  };

  const startSearchEntries = useMemo(() => buildSearchEntries(startPlan), [objectTypeLabels, startPlan, t]);
  const destinationSearchEntries = useMemo(() => buildSearchEntries(destinationPlan), [destinationPlan, objectTypeLabels, t]);

  const normalizedStartQuery = startQuery.trim().toLowerCase();
  const filteredStartEntries = useMemo(() => {
    const base = !normalizedStartQuery
      ? startSearchEntries
      : startSearchEntries.filter((entry) => entry.search.includes(normalizedStartQuery));
    return base.slice().sort((a, b) => a.label.localeCompare(b.label, lang === 'it' ? 'it' : 'en', { sensitivity: 'base' }));
  }, [lang, normalizedStartQuery, startSearchEntries]);
  const normalizedDestinationQuery = destinationQuery.trim().toLowerCase();
  const filteredDestinationEntries = useMemo(() => {
    const base = !normalizedDestinationQuery
      ? destinationSearchEntries
      : destinationSearchEntries.filter((entry) => entry.search.includes(normalizedDestinationQuery));
    return base.slice().sort((a, b) => a.label.localeCompare(b.label, lang === 'it' ? 'it' : 'en', { sensitivity: 'base' }));
  }, [destinationSearchEntries, lang, normalizedDestinationQuery]);
  const selectedStartEntry = useMemo(
    () => startSearchEntries.find((entry) => entry.id === selectedStartEntryId) || null,
    [selectedStartEntryId, startSearchEntries]
  );
  const selectedDestinationEntry = useMemo(
    () => destinationSearchEntries.find((entry) => entry.id === selectedDestinationEntryId) || null,
    [destinationSearchEntries, selectedDestinationEntryId]
  );

  const routeMetrics = useMemo(() => {
    if (!routeResult) return null;
    const hasScale = typeof routeResult.distanceMeters === 'number' && Number.isFinite(routeResult.distanceMeters || NaN);
    return {
      distanceLabel: hasScale
        ? `${routeResult.distanceMeters?.toFixed(2)} m`
        : `${routeResult.distancePx.toFixed(1)} px`,
      etaLabel: hasScale ? formatEta(routeResult.etaSeconds) : '--',
      transitionLabel: routeResult.transitionSeconds > 0 ? formatEta(routeResult.transitionSeconds) : null
    };
  }, [routeResult]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsMapFullscreen(Boolean(mapPanelRef.current && document.fullscreenElement === mapPanelRef.current));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const onMapClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!mapPlan) return;
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const world = point.matrixTransform(ctm.inverse());
    if (step === 1 && startMode === 'map') {
      setStartPoint({ x: world.x, y: world.y });
      setSelectedStartEntryId('');
      setStartPointSource('map');
    } else if (step === 2 && destinationMode === 'map') {
      setDestinationPoint({ x: world.x, y: world.y });
      setSelectedDestinationEntryId('');
      setDestinationPointSource('map');
    } else {
      return;
    }
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };

  const handleSelectStartEntry = (entry: SearchEntry) => {
    setSelectedStartEntryId(entry.id);
    setStartPoint({ x: Number(entry.point.x), y: Number(entry.point.y) });
    setStartPointSource('search');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };
  const handleSelectDestinationEntry = (entry: SearchEntry) => {
    setSelectedDestinationEntryId(entry.id);
    setDestinationPoint({ x: Number(entry.point.x), y: Number(entry.point.y) });
    setDestinationPointSource('search');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };

  const runRoute = () => {
    if (!startPlan || !destinationPlan || !startPoint || !destinationPoint) return;
    setComputing(true);
    setRouteError('');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    window.setTimeout(() => {
      const computed = computeMultiFloorRoute(availablePlans, startPlan.id, destinationPlan.id, startPoint, destinationPoint);
      if (computed.result) {
        setRouteResult(computed.result);
        setActiveSegmentIndex(0);
        setStep(3);
      } else {
        const key = computed.error || 'path-not-found';
        if (key === 'no-corridors') {
          setRouteError(t({ it: 'Nessun corridoio configurato nella planimetria selezionata.', en: 'No corridors configured in the selected floor plan.' }));
        } else if (key === 'no-doors') {
          setRouteError(t({ it: 'Nessuna porta corridoio disponibile in planimetria.', en: 'No corridor doors available in this floor plan.' }));
        } else if (key === 'invalid-start') {
          setRouteError(t({ it: 'Porta di partenza non raggiungibile dai corridoi.', en: 'Start door is unreachable from corridors.' }));
        } else if (key === 'invalid-target') {
          setRouteError(t({ it: 'Porta di destinazione non raggiungibile dai corridoi.', en: 'Destination door is unreachable from corridors.' }));
        } else if (key === 'no-walkable-corridors') {
          setRouteError(t({ it: 'I corridoi non risultano percorribili. Controlla il disegno dei corridoi.', en: 'Corridors are not walkable. Check corridor geometry.' }));
        } else {
          setRouteError(t({ it: 'Percorso non trovato. Verifica porte collegate e corridoi.', en: 'Path not found. Check linked doors and corridors.' }));
        }
      }
      setComputing(false);
    }, 0);
  };

  const toggleMapFullscreen = async () => {
    const element = mapPanelRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      setRouteError(t({ it: 'Impossibile aprire la mappa a schermo intero.', en: 'Unable to open fullscreen map.' }));
    }
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('file-read-error'));
      reader.readAsDataURL(blob);
    });

  const loadImageAsDataUrl = async (src: string) => {
    const raw = String(src || '').trim();
    if (!raw) return '';
    if (/^data:/i.test(raw)) return raw;
    try {
      const response = await fetch(raw, { credentials: 'include', mode: 'cors' });
      if (!response.ok) throw new Error(`http-${response.status}`);
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch {
      return raw;
    }
  };

  const waitForNodeImagesReady = async (node: HTMLElement) => {
    const htmlImgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
    const svgImgs = Array.from(node.querySelectorAll('image')) as SVGImageElement[];
    const waitHtml = htmlImgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    );
    const waitSvg = svgImgs.map((svgImg) => {
      const href = String(svgImg.getAttribute('href') || svgImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '').trim();
      if (!href) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const img = new Image();
        if (/^https?:\/\//i.test(href)) img.crossOrigin = 'anonymous';
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = href;
      });
    });
    await Promise.all([...waitHtml, ...waitSvg]);
  };

  const inlineImagesForExport = async (node: HTMLElement) => {
    const cache = new Map<string, Promise<string>>();
    const resolveDataUrl = (rawSrc: string) => {
      const src = String(rawSrc || '').trim();
      if (!src) return Promise.resolve('');
      if (/^data:/i.test(src)) return Promise.resolve(src);
      const cached = cache.get(src);
      if (cached) return cached;
      const task = loadImageAsDataUrl(src);
      cache.set(src, task);
      return task;
    };

    const svgImages = Array.from(node.querySelectorAll('svg image'));
    for (const entry of svgImages) {
      const href = String(entry.getAttribute('href') || entry.getAttribute('xlink:href') || '').trim();
      if (!href) continue;
      const dataUrl = await resolveDataUrl(href);
      if (!dataUrl || !/^data:/i.test(dataUrl)) continue;
      entry.setAttribute('href', dataUrl);
      entry.setAttribute('xlink:href', dataUrl);
    }

    const htmlImages = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
    for (const entry of htmlImages) {
      const src = String(entry.currentSrc || entry.src || '').trim();
      if (!src) continue;
      const dataUrl = await resolveDataUrl(src);
      if (!dataUrl || !/^data:/i.test(dataUrl)) continue;
      entry.src = dataUrl;
      try {
        if (typeof entry.decode === 'function') await entry.decode();
      } catch {
        // ignore decode issues
      }
    }
  };

  const rasterizeSvgsForExport = async (node: HTMLElement) => {
    const svgNodes = Array.from(node.querySelectorAll('svg')) as SVGSVGElement[];
    for (const svg of svgNodes) {
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      const serialized = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const snapshot = new Image();
      const loaded = await new Promise<boolean>((resolve) => {
        const done = (ok: boolean) => {
          snapshot.onload = null;
          snapshot.onerror = null;
          URL.revokeObjectURL(objectUrl);
          resolve(ok);
        };
        const timeout = window.setTimeout(() => done(false), 3500);
        snapshot.onload = () => {
          window.clearTimeout(timeout);
          done(true);
        };
        snapshot.onerror = () => {
          window.clearTimeout(timeout);
          done(false);
        };
        snapshot.src = objectUrl;
      });
      if (!loaded) continue;

      const computed = window.getComputedStyle(svg);
      const rect = svg.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || parseFloat(computed.width) || 1));
      const height = Math.max(1, Math.round(rect.height || parseFloat(computed.height) || 1));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(snapshot, 0, 0, width, height);
      const replacement = document.createElement('img');
      replacement.alt = '';
      replacement.src = canvas.toDataURL('image/png');
      replacement.width = width;
      replacement.height = height;
      replacement.style.display = computed.display === 'inline' ? 'block' : computed.display || 'block';
      replacement.style.width = computed.width && computed.width !== 'auto' ? computed.width : '100%';
      replacement.style.height = computed.height && computed.height !== 'auto' ? computed.height : `${height}px`;
      replacement.style.maxWidth = '100%';
      replacement.style.verticalAlign = computed.verticalAlign || 'baseline';
      try {
        if (typeof replacement.decode === 'function') await replacement.decode();
      } catch {
        // ignore decode failures
      }
      svg.replaceWith(replacement);
    }
  };

  const buildCaptureNode = (source: HTMLElement) => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-100000px';
    host.style.top = '-100000px';
    host.style.pointerEvents = 'none';
    host.style.opacity = '0';
    host.style.zIndex = '-1';
    const clone = source.cloneNode(true) as HTMLElement;
    host.appendChild(clone);
    document.body.appendChild(host);
    return { host, node: clone };
  };

  const buildRoutePdfPreviewHtml = async () => {
    if (!routeResult || !routeResult.segments.length) {
      setRouteError(t({ it: 'Calcola prima il percorso per esportare il PDF.', en: 'Calculate the route first to export the PDF.' }));
      return '';
    }
    const planById = new Map(availablePlans.map((plan) => [plan.id, plan]));
    const planOrder = new Map(availablePlans.map((plan, index) => [plan.id, index]));
    const segmentPlanIds = Array.from(new Set(routeResult.segments.map((segment) => segment.planId)));
    const planImageById = new Map<string, string>();
    await Promise.all(
      segmentPlanIds.map(async (planId) => {
        const plan = planById.get(planId);
        const imageUrl = String(plan?.imageUrl || '').trim();
        if (!imageUrl) return;
        planImageById.set(planId, await loadImageAsDataUrl(imageUrl));
      })
    );
    const mapTitle = t({ it: 'Percorso interno multi-piano', en: 'Multi-floor internal route' });
    const titleSafe = escapeHtml(mapTitle);
    const clientName = String(selectedClient?.shortName || selectedClient?.name || '-').trim() || '-';
    const siteName = String(selectedSite?.name || '-').trim() || '-';
    const siteNameSafe = escapeHtml(siteName);
    const startLabel = String(selectedStartEntry?.label || t({ it: 'punto A', en: 'point A' })).trim();
    const destinationLabel = String(selectedDestinationEntry?.label || t({ it: 'punto B', en: 'point B' })).trim();
    const startPlanLabel = String(startPlan?.name || routeResult.segments[0]?.planName || '-').trim() || '-';
    const destinationPlanLabel = String(destinationPlan?.name || routeResult.segments[routeResult.segments.length - 1]?.planName || '-').trim() || '-';
    const startPathLabel = escapeHtml(`${clientName} > ${siteName} > ${startPlanLabel} > ${startLabel}`);
    const destinationPathLabel = escapeHtml(`${clientName} > ${siteName} > ${destinationPlanLabel} > ${destinationLabel}`);
    const formatDistance = (meters?: number, px?: number) => {
      if (typeof meters === 'number' && Number.isFinite(meters)) {
        if (meters >= 100) return `${Math.round(meters)} m`;
        return `${meters.toFixed(1)} m`;
      }
      const safePx = Number(px || 0);
      return `${safePx.toFixed(1)} px`;
    };
    const totalDistanceLabel = escapeHtml(formatDistance(routeResult.distanceMeters, routeResult.distancePx));
    const totalEtaLabel = escapeHtml(routeResult.etaSeconds ? formatEta(routeResult.etaSeconds) : '--');
    const getRoomNameAtPoint = (plan: FloorPlan | undefined, point: Point | null) => {
      if (!plan || !point) return '';
      for (const room of plan.rooms || []) {
        const poly = roomPolygon(room);
        if (poly.length < 3) continue;
        if (pointInPolygon(point, poly) || pointOnPolygonBoundary(point, poly)) {
          const name = String(room.name || '').trim();
          if (name) return name;
        }
      }
      return '';
    };
    const pickCorridorNameForSegment = (plan: FloorPlan | undefined, segment: RoutePlanSegment) => {
      if (!plan) return t({ it: 'corridoio', en: 'corridor' });
      const routePoints = segment.route.corridorPoints || [];
      if (!routePoints.length) return t({ it: 'corridoio', en: 'corridor' });
      const total = polylineLength(routePoints);
      let midPoint = routePoints[Math.floor(routePoints.length / 2)] || routePoints[0];
      if (total > 0.01) {
        const target = total / 2;
        let walked = 0;
        for (let i = 0; i < routePoints.length - 1; i += 1) {
          const a = routePoints[i];
          const b = routePoints[i + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (walked + len >= target) {
            const ratio = len > 0 ? (target - walked) / len : 0;
            midPoint = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
            break;
          }
          walked += len;
        }
      }
      let bestName = '';
      let bestDist = Number.POSITIVE_INFINITY;
      for (const corridor of (plan.corridors || []) as Corridor[]) {
        const polygon = corridorPolygon(corridor);
        if (polygon.length < 3) continue;
        const name = String(corridor.name || '').trim() || t({ it: 'corridoio', en: 'corridor' });
        if (pointInPolygon(midPoint, polygon) || pointOnPolygonBoundary(midPoint, polygon)) return name;
        const center = polygonCentroid(polygon);
        const dist = Math.hypot(center.x - midPoint.x, center.y - midPoint.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestName = name;
        }
      }
      return bestName || t({ it: 'corridoio', en: 'corridor' });
    };
    const getTurnWord = (route: RouteResult): { it: string; en: string } | null => {
      const points = collectRouteTravelPoints(route);
      for (let i = 0; i < points.length - 2; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        const c = points[i + 2];
        const ax = b.x - a.x;
        const ay = b.y - a.y;
        const bx = c.x - b.x;
        const by = c.y - b.y;
        if (Math.hypot(ax, ay) < 0.001 || Math.hypot(bx, by) < 0.001) continue;
        const cross = ax * by - ay * bx;
        if (Math.abs(cross) < 0.001) continue;
        return cross > 0 ? { it: 'destra', en: 'right' } : { it: 'sinistra', en: 'left' };
      }
      return null;
    };
    const getDestinationSideWord = (route: RouteResult, point: Point | null): { it: string; en: string } | null => {
      if (!point) return null;
      const points = route.corridorPoints || [];
      if (points.length < 2) return null;
      const prev = points[points.length - 2];
      const end = points[points.length - 1];
      const dx = end.x - prev.x;
      const dy = end.y - prev.y;
      if (Math.hypot(dx, dy) < 0.001) return null;
      const relX = point.x - end.x;
      const relY = point.y - end.y;
      const cross = dx * relY - dy * relX;
      if (Math.abs(cross) < 0.001) return null;
      return cross > 0 ? { it: 'destra', en: 'right' } : { it: 'sinistra', en: 'left' };
    };
    const getTransitionAction = (fromPlanId: string, toPlanId: string) => {
      const fromIdx = planOrder.get(fromPlanId);
      const toIdx = planOrder.get(toPlanId);
      if (Number.isFinite(fromIdx) && Number.isFinite(toIdx)) {
        if (Number(toIdx) > Number(fromIdx)) return { it: 'Sali', en: 'Go up' };
        if (Number(toIdx) < Number(fromIdx)) return { it: 'Scendi', en: 'Go down' };
      }
      return { it: 'Prosegui', en: 'Continue' };
    };
    const renderRouteSvg = (segment: RoutePlanSegment, segmentIndex: number) => {
      const plan = planById.get(segment.planId);
      if (!plan) return '';
      const width = Number(plan.width || 0) > 0 ? Number(plan.width) : 1600;
      const height = Number(plan.height || 0) > 0 ? Number(plan.height) : 900;
      const pattern = `pdf-grid-${segmentIndex}`;
      const fmtPoint = (point: Point) => `${Number(point.x.toFixed(2))},${Number(point.y.toFixed(2))}`;
      const fmtPoints = (points: Point[]) => points.map(fmtPoint).join(' ');
      const rooms = (plan.rooms || [])
        .map((room) => {
          const polygon = roomPolygon(room);
          if (polygon.length < 3) return '';
          const points = fmtPoints(polygon);
          const center = polygonCentroid(polygon);
          const label = escapeHtml(String(room.name || '').trim() || t({ it: 'Ufficio', en: 'Office' }));
          return `
            <g>
              <polygon points="${points}" fill="rgba(59,130,246,0.12)" stroke="rgba(37,99,235,0.65)" stroke-width="1.2" />
              <text x="${center.x}" y="${center.y}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="#1e3a8a">${label}</text>
            </g>
          `;
        })
        .join('');
      const corridors = ((plan.corridors || []) as Corridor[])
        .map((corridor) => {
          const polygon = corridorPolygon(corridor);
          if (polygon.length < 3) return '';
          return `<polygon points="${fmtPoints(polygon)}" fill="url(#${pattern})" stroke="rgba(15,118,110,0.9)" stroke-dasharray="5 4" stroke-width="1.4" />`;
        })
        .join('');
      const connections = ((plan.corridors || []) as Corridor[])
        .flatMap((corridor) =>
          (corridor.connections || []).map((connection) => {
            const anchor = getCorridorConnectionAnchor(corridor, connection);
            if (!anchor) return '';
            const type = normalizeTransitionType((connection as any)?.transitionType);
            return `
              <g transform="translate(${anchor.x},${anchor.y})">
                <circle cx="0" cy="0" r="6.5" fill="${type === 'elevator' ? '#a855f7' : '#0ea5e9'}" stroke="#ffffff" stroke-width="1.6" />
                <text x="0" y="0.5" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="800" fill="#ffffff">${type === 'elevator' ? 'E' : 'S'}</text>
              </g>
            `;
          })
        )
        .join('');
      const doors = ((plan.corridors || []) as Corridor[])
        .flatMap((corridor) =>
          (corridor.doors || []).map((door) => {
            const anchor = getCorridorDoorAnchor(corridor, door);
            if (!anchor) return '';
            return `
              <g transform="translate(${anchor.x},${anchor.y})">
                <rect x="-2.4" y="-4.2" width="4.8" height="8.4" rx="0.9" fill="#fff7ed" stroke="#9a3412" stroke-width="0.9" />
                <line x1="0" y1="-4.2" x2="0" y2="4.2" stroke="#9a3412" stroke-width="0.8" />
                <circle cx="0.9" cy="0" r="0.55" fill="#9a3412" />
              </g>
            `;
          })
        )
        .join('');
      const route = segment.route;
      const approach = route.approachPoints?.length
        ? `<polyline points="${fmtPoints(route.approachPoints)}" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" />`
        : '';
      const corridorLine = route.corridorPoints?.length
        ? `<polyline points="${fmtPoints(route.corridorPoints)}" fill="none" stroke="#dc2626" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`
        : '';
      const exit = route.exitPoints?.length
        ? `<polyline points="${fmtPoints(route.exitPoints)}" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" />`
        : '';
      let transitionArrow = '';
      if (segment.endConnectionId) {
        const points = collectRouteTravelPoints(route);
        if (points.length >= 2) {
          const end = points[points.length - 1];
          const prev = points[points.length - 2];
          const dx = end.x - prev.x;
          const dy = end.y - prev.y;
          const len = Math.hypot(dx, dy);
          if (Number.isFinite(len) && len >= 0.0001) {
            const ux = dx / len;
            const uy = dy / len;
            const tip = { x: end.x, y: end.y };
            const base = { x: tip.x - ux * 14, y: tip.y - uy * 14 };
            const left = { x: base.x - uy * 5, y: base.y + ux * 5 };
            const right = { x: base.x + uy * 5, y: base.y - ux * 5 };
            transitionArrow = `<polygon points="${fmtPoint(tip)} ${fmtPoint(left)} ${fmtPoint(right)}" fill="#f97316" stroke="#7c2d12" stroke-width="1" />`;
          }
        }
      }
      const isFirst = segmentIndex === 0;
      const isLast = segmentIndex === routeResult.segments.length - 1;
      const markers = `
        <circle cx="${route.startDoor.x}" cy="${route.startDoor.y}" r="5.5" fill="#fb923c" stroke="#7c2d12" stroke-width="1.3" />
        <circle cx="${route.endDoor.x}" cy="${route.endDoor.y}" r="5.5" fill="#fb923c" stroke="#7c2d12" stroke-width="1.3" />
        ${
          isFirst && startPoint
            ? `<g><circle cx="${startPoint.x}" cy="${startPoint.y}" r="7" fill="#dc2626" stroke="#ffffff" stroke-width="2" /><text x="${startPoint.x + 10}" y="${startPoint.y - 10}" font-size="12" font-weight="700" fill="#7f1d1d">A</text></g>`
            : ''
        }
        ${
          isLast && destinationPoint
            ? `<g><circle cx="${destinationPoint.x}" cy="${destinationPoint.y}" r="7" fill="#16a34a" stroke="#ffffff" stroke-width="2" /><text x="${destinationPoint.x + 10}" y="${destinationPoint.y - 10}" font-size="12" font-weight="700" fill="#14532d">B</text></g>`
            : ''
        }
      `;
      const imageHref = String(planImageById.get(plan.id) || plan.imageUrl || '').trim();
      const imageTag = imageHref
        ? `<image href="${escapeHtml(imageHref)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" opacity="0.72" />`
        : '';
      return `
        <svg viewBox="0 0 ${width} ${height}" class="map-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="${pattern}" width="22" height="22" patternUnits="userSpaceOnUse">
              <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
              <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" stroke-width="1" />
              <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" stroke-width="0.8" />
            </pattern>
          </defs>
          ${imageTag}
          ${rooms}
          ${corridors}
          ${connections}
          ${doors}
          ${approach}
          ${corridorLine}
          ${exit}
          ${transitionArrow}
          ${markers}
        </svg>
      `;
    };
    type PdfInstructionKind = 'start' | 'turn-right' | 'turn-left' | 'corridor' | 'stairs' | 'elevator' | 'arrival';
    type PdfInstruction = { text: string; kind: PdfInstructionKind };
    const renderInstructionIcon = (kind: PdfInstructionKind) => {
      if (kind === 'start') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="6.5" y="2.5" width="11" height="19" rx="4" fill="#0f172a" />
            <circle cx="12" cy="7" r="2" fill="#ef4444" />
            <circle cx="12" cy="12" r="2" fill="#f59e0b" />
            <circle cx="12" cy="17" r="2.2" fill="#22c55e" />
          </svg>
        `;
      }
      if (kind === 'turn-right') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 18V9h9" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 6l4 3-4 3" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'turn-left') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M19 18V9h-9" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 6l-4 3 4 3" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'stairs') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 18h4v-4h4v-4h4V6h4" fill="none" stroke="#0ea5e9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 3l3 3 3-3" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'elevator') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="5" y="4" width="14" height="16" rx="2.5" fill="none" stroke="#a855f7" stroke-width="2"/>
            <path d="M12 6v12" stroke="#a855f7" stroke-width="2"/>
            <path d="M9 8l1.5-1.8L12 8M15 16l-1.5 1.8L12 16" fill="none" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'arrival') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 20V4" stroke="#111827" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M6 5h12v7H6z" fill="#ffffff" stroke="#111827" stroke-width="1.8"/>
            <rect x="6" y="5" width="6" height="3.5" fill="#111827"/>
            <rect x="12" y="8.5" width="6" height="3.5" fill="#111827"/>
          </svg>
        `;
      }
      return `
        <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 12h14" stroke="#334155" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M14 8l5 4-5 4" fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    };
    const instructions: PdfInstruction[] = [];
    const firstSegment = routeResult.segments[0];
    const firstSegmentPlan = planById.get(firstSegment.planId);
    const startRoom = getRoomNameAtPoint(firstSegmentPlan, startPoint);
    const firstTurn = getTurnWord(firstSegment.route);
    if (startRoom) {
      instructions.push({ kind: 'start', text: t({ it: `Esci da ${startRoom}.`, en: `Leave ${startRoom}.` }) });
    } else {
      instructions.push({ kind: 'start', text: t({ it: `Parti da ${startLabel}.`, en: `Start from ${startLabel}.` }) });
    }
    if (firstTurn) {
      instructions.push({
        kind: firstTurn.it === 'destra' ? 'turn-right' : 'turn-left',
        text: t({ it: `Gira a ${firstTurn.it}.`, en: `Turn ${firstTurn.en}.` })
      });
    }
    for (let i = 0; i < routeResult.segments.length; i += 1) {
      const segment = routeResult.segments[i];
      const plan = planById.get(segment.planId);
      const corridorName = pickCorridorNameForSegment(plan, segment);
      const corridorPx = polylineLength(segment.route.corridorPoints || []);
      const metersPerPixel = Number(plan?.scale?.metersPerPixel);
      const corridorMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? corridorPx * metersPerPixel : undefined;
      const corridorSeconds = corridorMeters ? corridorMeters / SPEED_MPS : undefined;
      if (corridorPx > 0.5) {
        instructions.push({
          kind: 'corridor',
          text: t({
            it: `Percorri ${corridorName} (${segment.planName}) per ${formatDistance(corridorMeters, corridorPx)}${
              corridorSeconds ? ` (${formatEta(corridorSeconds)})` : ''
            }.`,
            en: `Follow ${corridorName} (${segment.planName}) for ${formatDistance(corridorMeters, corridorPx)}${
              corridorSeconds ? ` (${formatEta(corridorSeconds)})` : ''
            }.`
          })
        });
      }
      if (segment.endConnectionId && i < routeResult.segments.length - 1) {
        const next = routeResult.segments[i + 1];
        const action = getTransitionAction(segment.planId, next.planId);
        const typeText = segment.endTransitionType === 'elevator' ? t({ it: "l'ascensore", en: 'the elevator' }) : t({ it: 'le scale', en: 'the stairs' });
        const penalty = transitionPenaltySeconds(segment.endTransitionType);
        instructions.push({
          kind: segment.endTransitionType === 'elevator' ? 'elevator' : 'stairs',
          text: `${t(action)} ${t({ it: 'tramite', en: 'via' })} ${typeText} ${t({ it: 'verso', en: 'to' })} ${next.planName} (+${penalty}s).`
        });
      }
    }
    const lastSegment = routeResult.segments[routeResult.segments.length - 1];
    const lastSegmentPlan = planById.get(lastSegment.planId);
    const destinationRoom = getRoomNameAtPoint(lastSegmentPlan, destinationPoint);
    const destinationSide = getDestinationSideWord(lastSegment.route, destinationPoint);
    const destinationSubject = destinationRoom || destinationLabel;
    if (destinationSide) {
      instructions.push({
        kind: 'arrival',
        text: t({
          it: `${destinationSubject} si troverà sulla ${destinationSide.it}.`,
          en: `${destinationSubject} will be on the ${destinationSide.en}.`
        })
      });
    } else {
      instructions.push({ kind: 'arrival', text: t({ it: `Raggiungi ${destinationSubject}.`, en: `Reach ${destinationSubject}.` }) });
    }
    const introBlock = `
      <div class="intro">
        <h1>${titleSafe}</h1>
        <div class="line"><strong>${escapeHtml(t({ it: 'Partenza', en: 'Start' }))}:</strong> ${startPathLabel}</div>
        <div class="line"><strong>${escapeHtml(t({ it: 'Destinazione', en: 'Destination' }))}:</strong> ${destinationPathLabel}</div>
        <div class="line"><strong>${escapeHtml(t({ it: 'Distanza totale', en: 'Total distance' }))}:</strong> ${totalDistanceLabel} | <strong>${escapeHtml(
      t({ it: 'Tempo calcolato', en: 'Calculated time' })
    )}:</strong> ${totalEtaLabel}</div>
      </div>
    `;
    const segmentPages = routeResult.segments
      .map((segment, index) => {
        const isFirst = index === 0;
        const isLast = index === routeResult.segments.length - 1;
        const title = isFirst && isLast
          ? t({ it: `Partenza e arrivo su ${segment.planName}`, en: `Start and arrival on ${segment.planName}` })
          : isFirst
            ? t({ it: `Partenza da ${segment.planName}`, en: `Start from ${segment.planName}` })
            : isLast
              ? t({ it: `Arrivo su ${segment.planName}`, en: `Arrival on ${segment.planName}` })
              : t({ it: `Piano da attraversare: ${segment.planName}`, en: `Transit floor: ${segment.planName}` });
        const role = isFirst && isLast
          ? t({ it: 'partenza + arrivo', en: 'start + arrival' })
          : isFirst
            ? t({ it: 'partenza', en: 'start' })
            : isLast
              ? t({ it: 'arrivo', en: 'arrival' })
              : t({ it: 'attraversamento', en: 'transit' });
        const distanceLabel = formatDistance(segment.route.distanceMeters, segment.route.distancePx);
        const etaLabel = segment.route.etaSeconds ? formatEta(segment.route.etaSeconds) : '--';
        return `
          <section class="pdf-page">
            ${index === 0 ? introBlock : ''}
            <div class="panel">
              <div class="head">
                <div>
                  <h2 class="seg-title">${escapeHtml(title)}</h2>
                  <div class="meta">${siteNameSafe} • ${escapeHtml(role)} • ${index + 1}/${routeResult.segments.length}</div>
                </div>
                <div class="stats">
                  <span>${escapeHtml(t({ it: 'Distanza', en: 'Distance' }))}: <strong>${escapeHtml(distanceLabel)}</strong></span>
                  <span>${escapeHtml(t({ it: 'Tempo', en: 'Time' }))}: <strong>${escapeHtml(etaLabel)}</strong></span>
                </div>
              </div>
              <div class="map-box">
                ${renderRouteSvg(segment, index)}
              </div>
              <div class="floor-badge">${escapeHtml(t({ it: 'Piano', en: 'Floor' }))}: ${escapeHtml(segment.planName)} (${index + 1}/${routeResult.segments.length})</div>
            </div>
          </section>
        `;
      })
      .join('');
    const instructionsItems = instructions
      .map(
        (instruction) => `
          <li class="step-item">
            <div class="step-icon">${renderInstructionIcon(instruction.kind)}</div>
            <div class="step-content">
              <div class="step-text">${escapeHtml(instruction.text)}</div>
            </div>
          </li>
        `
      )
      .join('');
    return `
      <style>
        .pdf-export-root { width: 1080px; margin: 0 auto; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .pdf-page { width: 1080px; box-sizing: border-box; padding: 18px; background: #ffffff; }
        .intro { border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; padding: 14px; margin-bottom: 12px; }
        .intro h1 { margin: 0 0 4px 0; font-size: 20px; }
        .intro .line { margin-top: 8px; font-size: 13px; color: #334155; line-height: 1.35; }
        .panel { border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; padding: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }
        .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .seg-title { margin: 0; font-size: 19px; }
        .meta { margin-top: 2px; color: #475569; font-size: 12px; }
        .stats { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #334155; text-align: right; }
        .map-box { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #e2e8f0; }
        .map-svg { width: 100%; height: auto; display: block; background: #f1f5f9; }
        .floor-badge { margin-top: 8px; font-size: 12px; color: #334155; font-weight: 600; }
        .instructions { border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; padding: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }
        .instructions h2 { margin: 0 0 10px 0; font-size: 18px; }
        .instructions ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 13px; color: #1e293b; }
        .step-item { display: grid; grid-template-columns: 46px 1fr; align-items: center; gap: 12px; border: 1px solid #dbe3ee; border-radius: 10px; background: #f8fafc; padding: 9px 11px; }
        .step-icon { width: 40px; height: 40px; border-radius: 999px; background: #ffffff; border: 1.5px solid #94a3b8; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px #ffffff; }
        .step-icon-svg { width: 28px; height: 28px; display: block; shape-rendering: geometricPrecision; }
        .step-content { display: block; }
        .step-text { line-height: 1.4; color: #0f172a; }
      </style>
      <div class="pdf-export-root">
        ${segmentPages}
        <section class="pdf-page">
          <div class="instructions">
            <h2>${escapeHtml(t({ it: 'Indicazioni passo-passo', en: 'Step-by-step directions' }))}</h2>
            <ol>${instructionsItems}</ol>
          </div>
        </section>
      </div>
    `;
  };

  const openRoutePdfExport = async () => {
    setRouteError('');
    setPdfPreparing(true);
    try {
      const html = await buildRoutePdfPreviewHtml();
      if (!html) return;
      setPdfPreviewHtml(html);
      setPdfPreviewOpen(true);
    } catch {
      setRouteError(t({ it: 'Impossibile preparare l’anteprima PDF.', en: 'Unable to prepare PDF preview.' }));
    } finally {
      setPdfPreparing(false);
    }
  };

  const confirmRoutePdfExport = async () => {
    if (!pdfPreviewRef.current) return;
    setPdfExporting(true);
    try {
      const pages = Array.from(pdfPreviewRef.current.querySelectorAll('.pdf-page')) as HTMLElement[];
      if (!pages.length) {
        setRouteError(t({ it: 'Nessuna pagina disponibile per l’export PDF.', en: 'No pages available for PDF export.' }));
        return;
      }
      const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const targetW = pageW - margin * 2;
      const targetH = pageH - margin * 2;
      let printedPages = 0;
      for (let i = 0; i < pages.length; i += 1) {
        const pageNode = pages[i];
        const capture = buildCaptureNode(pageNode);
        let canvas: HTMLCanvasElement | null = null;
        try {
          await inlineImagesForExport(capture.node);
          await rasterizeSvgsForExport(capture.node);
          await waitForNodeImagesReady(capture.node);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            })
          );
          canvas = await html2canvas(capture.node, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
        } finally {
          capture.host.remove();
        }
        if (!canvas) continue;
        if (printedPages > 0) pdf.addPage();
        const ratio = Math.min(targetW / canvas.width, targetH / canvas.height);
        const drawW = canvas.width * ratio;
        const drawH = canvas.height * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
        printedPages += 1;
      }
      if (!printedPages) {
        setRouteError(t({ it: 'Nessuna pagina disponibile per l’export PDF.', en: 'No pages available for PDF export.' }));
        return;
      }
      const fileDate = new Date().toISOString().slice(0, 10);
      const fileName = `percorso-interno-${fileDate}.pdf`;
      let exported = false;
      try {
        const blob = pdf.output('blob');
        if (blob && blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          anchor.rel = 'noopener';
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 2000);
          exported = true;
        }
      } catch {
        exported = false;
      }
      if (!exported) {
        pdf.save(fileName);
      }
    } catch {
      setRouteError(t({ it: 'Impossibile generare il PDF del percorso.', en: 'Unable to generate the route PDF.' }));
    } finally {
      setPdfExporting(false);
    }
  };

  const close = () => {
    setComputing(false);
    setPdfPreviewOpen(false);
    setPdfPreviewHtml('');
    setPdfPreparing(false);
    setPdfExporting(false);
    onClose();
  };

  const handleMainDialogClose = () => {
    if (pdfPreviewOpen || pdfExporting) return;
    close();
  };

  const canGoStep2 = !!startPlan && !!startPoint;
  const canCalculate = !!startPlan && !!destinationPlan && !!startPoint && !!destinationPoint && !computing;
  const canSelectMapPoint = (step === 1 && startMode === 'map') || (step === 2 && destinationMode === 'map');
  const canOpenStep2 = !!startPoint;
  const canOpenStep3 = !!routeResult;
  const clearStartMapPoint = () => {
    setStartPoint(null);
    setStartPointSource(null);
    setSelectedStartEntryId('');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };
  const clearDestinationMapPoint = () => {
    setDestinationPoint(null);
    setDestinationPointSource(null);
    setSelectedDestinationEntryId('');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };
  const renderRooms = () =>
    (mapPlan?.rooms || []).map((room) => {
      const polygon = roomPolygon(room);
      if (polygon.length < 3) return null;
      const points = polygon.map((point) => `${point.x},${point.y}`).join(' ');
      const center = polygonCentroid(polygon);
      const label = String(room.name || '').trim() || t({ it: 'Ufficio', en: 'Office' });
      return (
        <g key={`room:${room.id}`}>
          <polygon points={points} fill="rgba(59,130,246,0.12)" stroke="rgba(37,99,235,0.65)" strokeWidth={1.2} />
          <text
            x={center.x}
            y={center.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={700}
            fill="#1e3a8a"
            stroke="#ffffff"
            strokeWidth={3}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        </g>
      );
    });
  const renderCorridors = () =>
    ((mapPlan?.corridors || []) as Corridor[]).map((corridor) => {
      const polygon = corridorPolygon(corridor);
      if (polygon.length < 3) return null;
      const points = polygon.map((point) => `${point.x},${point.y}`).join(' ');
      return <polygon key={`corridor:${corridor.id}`} points={points} fill={`url(#${patternId})`} stroke="rgba(15,118,110,0.9)" strokeDasharray="5 4" strokeWidth={1.4} />;
    });
  const renderDoors = () =>
    ((mapPlan?.corridors || []) as Corridor[]).flatMap((corridor) =>
      (corridor.doors || []).map((door) => {
        const anchor = getCorridorDoorAnchor(corridor, door);
        if (!anchor) return null;
        return (
          <g key={`door:${corridor.id}:${door.id}`} transform={`translate(${anchor.x},${anchor.y})`}>
            <rect x={-2.4} y={-4.2} width={4.8} height={8.4} rx={0.9} fill="#fff7ed" stroke="#9a3412" strokeWidth={0.9} />
            <line x1={0} y1={-4.2} x2={0} y2={4.2} stroke="#9a3412" strokeWidth={0.8} />
            <circle cx={0.9} cy={0} r={0.55} fill="#9a3412" />
            {(door as any)?.isEmergency ? <circle cx={3.2} cy={-3.8} r={1.3} fill="#dc2626" stroke="#ffffff" strokeWidth={0.6} /> : null}
          </g>
        );
      })
    );
  const renderConnections = () =>
    ((mapPlan?.corridors || []) as Corridor[]).flatMap((corridor) =>
      (corridor.connections || []).map((connection) => {
        const anchor = getCorridorConnectionAnchor(corridor, connection);
        if (!anchor) return null;
        const type = normalizeTransitionType((connection as any)?.transitionType);
        return (
          <g key={`conn:${corridor.id}:${connection.id}`} transform={`translate(${anchor.x},${anchor.y})`}>
            <circle cx={0} cy={0} r={6.5} fill={type === 'elevator' ? '#a855f7' : '#0ea5e9'} stroke="#ffffff" strokeWidth={1.6} />
            <text x={0} y={0.5} textAnchor="middle" dominantBaseline="middle" fontSize={8.5} fontWeight={800} fill="#ffffff">
              {type === 'elevator' ? 'E' : 'S'}
            </text>
          </g>
        );
      })
    );
  const collectRouteTravelPoints = (route: RouteResult): Point[] => {
    const output: Point[] = [];
    const append = (point: Point) => {
      const prev = output[output.length - 1];
      if (prev && Math.abs(prev.x - point.x) < 0.0001 && Math.abs(prev.y - point.y) < 0.0001) return;
      output.push(point);
    };
    for (const point of route.approachPoints || []) append(point);
    for (const point of route.corridorPoints || []) append(point);
    for (const point of route.exitPoints || []) append(point);
    return output;
  };
  const renderTransitionDirectionArrow = () => {
    if (!activeRouteSegment?.endConnectionId || !activeRoute) return null;
    const points = collectRouteTravelPoints(activeRoute);
    if (points.length < 2) return null;
    const end = points[points.length - 1];
    const prev = points[points.length - 2];
    const dx = end.x - prev.x;
    const dy = end.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 0.0001) return null;
    const ux = dx / len;
    const uy = dy / len;
    const tip = { x: end.x, y: end.y };
    const base = { x: tip.x - ux * 14, y: tip.y - uy * 14 };
    const left = { x: base.x - uy * 5, y: base.y + ux * 5 };
    const right = { x: base.x + uy * 5, y: base.y - ux * 5 };
    return (
      <polygon
        points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
        fill="#f97316"
        stroke="#7c2d12"
        strokeWidth={1}
      />
    );
  };

  return (
    <>
      <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleMainDialogClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-180"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-120"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-7xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Mappa interna', en: 'Internal map' })}</Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {t({
                        it: 'Trova il percorso interno tra il tuo punto di partenza e la destinazione selezionata.',
                        en: 'Find the internal route between your starting point and the selected destination.'
                      })}
                    </Dialog.Description>
                  </div>
                  <button onClick={close} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                    <Info size={13} /> {t({ it: 'Guida rapida', en: 'Quick guide' })}
                  </span>
                  <span className="ml-2">
                    {t({
                      it: '1) Imposta A con ricerca o selezione su mappa. 2) Imposta B sul piano di destinazione. 3) Calcola: percorso in corridoio, passaggi tra piani (Scale/Ascensore) e frecce per piano successivo.',
                      en: '1) Set A via search or map. 2) Set B on the destination floor. 3) Calculate: corridor path, floor transitions (Stairs/Elevator), and arrows for next floor.'
                    })}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${step === 1 ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    1. {t({ it: 'Partenza', en: 'Start' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canOpenStep2) return;
                      setStep(2);
                    }}
                    disabled={!canOpenStep2}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      step === 2 ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    2. {t({ it: 'Destinazione', en: 'Destination' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canOpenStep3) return;
                      setStep(3);
                    }}
                    disabled={!canOpenStep3}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      step === 3 ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    3. {t({ it: 'Percorso', en: 'Route' })}
                  </button>
                </div>

                {step === 1 ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[360px,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Partenza', en: 'Start' })}</div>
                      <label className="mt-2 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Cliente', en: 'Client' })}
                        <select
                          value={selectedClientId}
                          onChange={(event) => {
                            setSelectedClientId(event.target.value);
                            setSelectedSiteId('');
                            setStartPlanId('');
                            setDestinationPlanId('');
                            setSelectedStartEntryId('');
                            setSelectedDestinationEntryId('');
                            setStartPoint(null);
                            setDestinationPoint(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {clientsWithPlans.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.shortName || client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Sede', en: 'Site' })}
                        <select
                          value={selectedSiteId}
                          onChange={(event) => {
                            setSelectedSiteId(event.target.value);
                            setStartPlanId('');
                            setDestinationPlanId('');
                            setSelectedStartEntryId('');
                            setSelectedDestinationEntryId('');
                            setStartPoint(null);
                            setDestinationPoint(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {availableSites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Planimetria', en: 'Floor plan' })}
                        <select
                          value={startPlanId}
                          onChange={(event) => {
                            setStartPlanId(event.target.value);
                            setSelectedStartEntryId('');
                            setStartPoint(null);
                            setStartPointSource(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {availablePlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-3 grid grid-cols-[1fr,1fr,auto] gap-2">
                        <button
                          type="button"
                          onClick={() => setStartMode('search')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            startMode === 'search' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t({ it: 'Ricerca', en: 'Search' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStartMode('map')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            startMode === 'map' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Crosshair size={13} />
                            {t({ it: 'Seleziona su mappa', en: 'Select on map' })}
                          </span>
                        </button>
                        {startPoint && startPointSource === 'map' ? (
                          <button
                            type="button"
                            onClick={clearStartMapPoint}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-2 text-rose-600 hover:bg-rose-50"
                            title={t({ it: 'Rimuovi puntino di partenza', en: 'Remove start map pin' })}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                      {startMode === 'search' ? (
                        <>
                          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <Search size={15} className="text-slate-500" />
                            <input
                              value={startQuery}
                              onChange={(event) => setStartQuery(event.target.value)}
                              placeholder={t({ it: 'Cerca utente, oggetto, stanza...', en: 'Search user, object, room...' })}
                              className="w-full text-sm outline-none"
                            />
                          </div>
                          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                            {filteredStartEntries.length ? (
                              <div className="space-y-1.5">
                                {filteredStartEntries.map((entry) => {
                                  const selected = selectedStartEntryId === entry.id;
                                  return (
                                    <button
                                      key={`start:${entry.id}`}
                                      type="button"
                                      onClick={() => handleSelectStartEntry(entry)}
                                      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left ${
                                        selected ? 'border-primary/50 bg-primary/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                                        {entry.kind === 'room' ? <MapPin size={13} /> : entry.kind === 'rack_item' ? <Server size={13} /> : entry.kind === 'corridor' ? <Route size={13} /> : <User size={13} />}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-slate-800">{entry.label}</span>
                                        <span className="block truncate text-[11px] text-slate-600">{entry.subtitle}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                                {t({ it: 'Nessun risultato con questi filtri.', en: 'No matches for these filters.' })}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          {t({ it: 'Clicca liberamente sulla mappa per impostare il punto A.', en: 'Click freely on the map to set point A.' })}
                        </div>
                      )}
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto A', en: 'Point A' })}</span>
                          <span>{startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-'}</span>
                        </div>
                        {selectedStartEntry ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            {t({ it: 'Partenza selezionata', en: 'Selected start' })}: {selectedStartEntry.label}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Mappa', en: 'Map' })}</div>
                      <div className="relative mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <svg
                          ref={svgRef}
                          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                          className={`h-[62vh] w-full bg-slate-100 ${canSelectMapPoint ? 'cursor-crosshair' : 'cursor-default'}`}
                          onClick={onMapClick}
                        >
                          <defs>
                            <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                              <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
                              <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
                              <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
                            </pattern>
                          </defs>
                          {mapPlan?.imageUrl ? (
                            <image href={mapPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                          ) : null}
                          {renderRooms()}
                          {renderCorridors()}
                          {renderConnections()}
                          {renderDoors()}
                          {startPoint ? (
                            <g>
                              <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                              <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                                A
                              </text>
                            </g>
                          ) : null}
                          {destinationPoint && destinationPlanId === startPlanId ? (
                            <g>
                              <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                              <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                                B
                              </text>
                            </g>
                          ) : null}
                        </svg>
                        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                          {t({ it: 'Piano', en: 'Floor' })}: {mapPlan?.name || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : step === 2 ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[360px,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Destinazione', en: 'Destination' })}</div>
                      <label className="mt-2 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Cliente', en: 'Client' })}
                        <select
                          value={selectedClientId}
                          disabled
                          className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                        >
                          {clientsWithPlans.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.shortName || client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Sede', en: 'Site' })}
                        <select
                          value={selectedSiteId}
                          disabled
                          className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                        >
                          {availableSites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Planimetria', en: 'Floor plan' })}
                        <select
                          value={destinationPlanId}
                          onChange={(event) => {
                            setDestinationPlanId(event.target.value);
                            setSelectedDestinationEntryId('');
                            setDestinationPoint(null);
                            setDestinationPointSource(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {availablePlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        {t({
                          it: 'Cliente e sede sono bloccati sulla scelta di partenza. Puoi cambiare solo il piano di destinazione.',
                          en: 'Client and site are locked to the selected start. You can only change the destination floor.'
                        })}
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr,1fr,auto] gap-2">
                        <button
                          type="button"
                          onClick={() => setDestinationMode('search')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            destinationMode === 'search' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t({ it: 'Ricerca', en: 'Search' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDestinationMode('map')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            destinationMode === 'map' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Crosshair size={13} />
                            {t({ it: 'Seleziona su mappa', en: 'Select on map' })}
                          </span>
                        </button>
                        {destinationPoint && destinationPointSource === 'map' ? (
                          <button
                            type="button"
                            onClick={clearDestinationMapPoint}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-2 text-rose-600 hover:bg-rose-50"
                            title={t({ it: 'Rimuovi puntino di destinazione', en: 'Remove destination map pin' })}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                      {destinationMode === 'search' ? (
                        <>
                          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <Search size={15} className="text-slate-500" />
                            <input
                              value={destinationQuery}
                              onChange={(event) => setDestinationQuery(event.target.value)}
                              placeholder={t({ it: 'Cerca utente, oggetto, stanza...', en: 'Search user, object, room...' })}
                              className="w-full text-sm outline-none"
                            />
                          </div>
                          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                            {filteredDestinationEntries.length ? (
                              <div className="space-y-1.5">
                                {filteredDestinationEntries.map((entry) => {
                                  const selected = selectedDestinationEntryId === entry.id;
                                  return (
                                    <button
                                      key={`destination:${entry.id}`}
                                      type="button"
                                      onClick={() => handleSelectDestinationEntry(entry)}
                                      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left ${
                                        selected ? 'border-primary/50 bg-primary/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                                        {entry.kind === 'room' ? <MapPin size={13} /> : entry.kind === 'rack_item' ? <Server size={13} /> : entry.kind === 'corridor' ? <Route size={13} /> : <User size={13} />}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-slate-800">{entry.label}</span>
                                        <span className="block truncate text-[11px] text-slate-600">{entry.subtitle}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                                {t({ it: 'Nessun risultato con questi filtri.', en: 'No matches for these filters.' })}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          {t({ it: 'Clicca liberamente sulla mappa per impostare il punto B.', en: 'Click freely on the map to set point B.' })}
                        </div>
                      )}
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto B', en: 'Point B' })}</span>
                          <span>{destinationPoint ? `${Math.round(destinationPoint.x)}, ${Math.round(destinationPoint.y)}` : '-'}</span>
                        </div>
                        {selectedDestinationEntry ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            {t({ it: 'Destinazione selezionata', en: 'Selected destination' })}: {selectedDestinationEntry.label}
                          </div>
                        ) : null}
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">{t({ it: 'Punto A', en: 'Point A' })}</span>
                            <span>{startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-'}</span>
                          </div>
                        </div>
                      </div>
                      {routeError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</div> : null}
                    </div>

                    <div ref={mapPanelRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <svg
                        ref={svgRef}
                        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                        className={`h-[62vh] w-full bg-slate-100 ${canSelectMapPoint ? 'cursor-crosshair' : 'cursor-default'}`}
                        onClick={onMapClick}
                      >
                        <defs>
                          <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                            <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
                            <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
                            <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
                          </pattern>
                        </defs>
                        {mapPlan?.imageUrl ? (
                          <image href={mapPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                        ) : null}
                        {renderRooms()}
                        {renderCorridors()}
                        {renderConnections()}
                        {renderDoors()}
                        {destinationPoint ? (
                          <g>
                            <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                            <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                              B
                            </text>
                          </g>
                        ) : null}
                        {startPoint && startPlanId === destinationPlanId ? (
                          <g>
                            <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                            <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                              A
                            </text>
                          </g>
                        ) : null}
                      </svg>
                      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                        {t({ it: 'Piano', en: 'Floor' })}: {mapPlan?.name || '-'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[360px,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Percorso', en: 'Route' })}</div>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto A', en: 'Point A' })}</span>
                          <span>{startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto B', en: 'Point B' })}</span>
                          <span>{destinationPoint ? `${Math.round(destinationPoint.x)}, ${Math.round(destinationPoint.y)}` : '-'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Distanza', en: 'Distance' })}</span>
                          <span>{routeMetrics?.distanceLabel || '--'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Tempo stimato', en: 'Estimated time' })}</span>
                          <span>{routeMetrics?.etaLabel || '--'}</span>
                        </div>
                        {routeMetrics?.transitionLabel ? (
                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-semibold text-slate-700">{t({ it: 'Tempo cambi piano', en: 'Floor-change time' })}</span>
                            <span>{routeMetrics.transitionLabel}</span>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Piano attuale', en: 'Current floor' })}</span>
                          <span>
                            {mapPlan?.name || '-'} {routeIsMultiFloor ? `(${Math.max(1, activeSegmentIndex + 1)}/${routeSegmentCount})` : ''}
                          </span>
                        </div>
                        <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                          {t({ it: 'Tratteggio: accesso alle porte. Rosso: percorso interno a 90° nei corridoi.', en: 'Dashed: door approach/exit. Red: 90° internal corridor route.' })}
                        </div>
                      </div>
                      {routeError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</div> : null}
                    </div>
                    <div ref={mapPanelRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <svg ref={svgRef} viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="h-[62vh] w-full bg-slate-100">
                        <defs>
                          <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                            <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
                            <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
                            <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
                          </pattern>
                        </defs>
                        {mapPlan?.imageUrl ? (
                          <image href={mapPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                        ) : null}
                        {renderRooms()}
                        {renderCorridors()}
                        {renderConnections()}
                        {renderDoors()}
                        {activeRoute?.approachPoints?.length ? (
                          <polyline points={activeRoute.approachPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {activeRoute?.corridorPoints?.length ? (
                          <polyline points={activeRoute.corridorPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#dc2626" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {activeRoute?.exitPoints?.length ? (
                          <polyline points={activeRoute.exitPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {renderTransitionDirectionArrow()}
                        {startPoint && activeSegmentIndex === 0 ? (
                          <g>
                            <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                            <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                              A
                            </text>
                          </g>
                        ) : null}
                        {destinationPoint && activeSegmentIndex === Math.max(0, routeSegmentCount - 1) ? (
                          <g>
                            <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                            <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                              B
                            </text>
                          </g>
                        ) : null}
                        {activeRoute ? (
                          <>
                            <circle cx={activeRoute.startDoor.x} cy={activeRoute.startDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                            <circle cx={activeRoute.endDoor.x} cy={activeRoute.endDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                          </>
                        ) : null}
                      </svg>
                      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                        {t({ it: 'Piano', en: 'Floor' })}: {mapPlan?.name || '-'} {routeIsMultiFloor ? `(${Math.max(1, activeSegmentIndex + 1)}/${routeSegmentCount})` : ''}
                      </div>
                      {routeIsMultiFloor ? (
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveSegmentIndex((prev) => Math.max(0, prev - 1))}
                            disabled={activeSegmentIndex <= 0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={t({ it: 'Piano precedente', en: 'Previous floor' })}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSegmentIndex((prev) => Math.min(routeSegmentCount - 1, prev + 1))}
                            disabled={activeSegmentIndex >= routeSegmentCount - 1}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={t({ it: 'Piano successivo', en: 'Next floor' })}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin size={14} />
                    {step === 1
                      ? t({ it: 'Imposta il punto A tramite ricerca o selezione su mappa.', en: 'Set point A via search or map selection.' })
                      : step === 2
                        ? t({ it: 'Imposta il punto B tramite ricerca o selezione su mappa.', en: 'Set point B via search or map selection.' })
                        : t({ it: 'Percorso calcolato: tratteggio -> porta -> corridoio rosso -> porta -> tratteggio.', en: 'Route computed: dashed -> door -> red corridor path -> door -> dashed.' })}
                  </div>
                  <div className="flex items-center gap-2">
                    {step === 1 ? null : (
                      <button
                        type="button"
                        onClick={() => setStep(step === 2 ? 1 : 2)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {step === 3 ? t({ it: 'Modifica destinazione', en: 'Edit destination' }) : t({ it: 'Modifica partenza', en: 'Edit start' })}
                      </button>
                    )}
                    {step === 1 ? null : (
                      <button
                        type="button"
                        onClick={toggleMapFullscreen}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Mostra mappa a schermo intero', en: 'Show map in fullscreen' })}
                      >
                        {isMapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        {isMapFullscreen ? t({ it: 'Esci da full screen', en: 'Exit fullscreen' }) : t({ it: 'Full screen', en: 'Fullscreen' })}
                      </button>
                    )}
                    {step === 1 ? null : (
                      <button
                        type="button"
                        onClick={openRoutePdfExport}
                        disabled={!routeResult || pdfPreparing}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title={t({ it: 'Apri anteprima PDF', en: 'Open PDF preview' })}
                      >
                        <FileDown size={14} />
                        {pdfPreparing ? t({ it: 'Preparazione...', en: 'Preparing...' }) : t({ it: 'Anteprima PDF', en: 'PDF preview' })}
                      </button>
                    )}
                    {step === 1 ? (
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={!canGoStep2}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {t({ it: 'Seleziona destinazione', en: 'Select destination' })} <Navigation size={14} />
                      </button>
                    ) : step === 2 ? (
                      <button
                        type="button"
                        onClick={runRoute}
                        disabled={!canCalculate}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {computing ? t({ it: 'Calcolo...', en: 'Calculating...' }) : t({ it: 'Calcola percorso', en: 'Calculate route' })}
                        <Route size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          setRouteResult(null);
                          setActiveSegmentIndex(0);
                          setRouteError('');
                        }}
                        disabled={computing}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {t({ it: 'Ricalcola percorso', en: 'Recalculate route' })}
                        <Route size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
      </Transition>
      <Transition show={pdfPreviewOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[70]" onClose={() => (pdfExporting ? undefined : setPdfPreviewOpen(false))}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-180"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-120"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[1200px] rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-slate-900">
                        {t({ it: 'Anteprima PDF percorso interno', en: 'Internal route PDF preview' })}
                      </Dialog.Title>
                      <p className="mt-1 text-xs text-slate-600">
                        {t({ it: 'Verifica il risultato e poi esporta in PDF.', en: 'Review the result, then export to PDF.' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={confirmRoutePdfExport}
                        disabled={pdfExporting || !pdfPreviewHtml}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FileDown size={14} />
                        {pdfExporting ? t({ it: 'Esportazione...', en: 'Exporting...' }) : t({ it: 'Stampa / Salva PDF', en: 'Print / Save PDF' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfPreviewOpen(false)}
                        disabled={pdfExporting}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t({ it: 'Chiudi', en: 'Close' })}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-[78vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3">
                    <div ref={pdfPreviewRef} className="mx-auto w-[1080px] max-w-full" dangerouslySetInnerHTML={{ __html: pdfPreviewHtml }} />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default InternalMapModal;
