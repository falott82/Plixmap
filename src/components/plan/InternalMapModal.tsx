import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Crosshair, Info, MapPin, Maximize2, Minimize2, Navigation, Route, Search, Server, Share2, Trash2, User, X } from 'lucide-react';
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
  if (!doors.length) return { error: 'no-doors' };

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

  if (!bestPair) return { error: 'path-not-found' };

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
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
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeError, setRouteError] = useState<string>('');
  const [computing, setComputing] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

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
  const selectedPlan = useMemo(() => availablePlans.find((plan) => plan.id === selectedPlanId), [availablePlans, selectedPlanId]);

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
    setSelectedPlanId(initialPlan);
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
    setRouteError('');
    setComputing(false);
  }, [clientsWithPlans, initialLocation?.clientId, initialLocation?.planId, initialLocation?.siteId, open]);

  useEffect(() => {
    if (!selectedClient) {
      setSelectedSiteId('');
      setSelectedPlanId('');
      return;
    }
    if (!availableSites.find((site) => site.id === selectedSiteId)) {
      const nextSiteId = availableSites[0]?.id || '';
      setSelectedSiteId(nextSiteId);
      const nextPlanId = (availableSites[0]?.floorPlans || [])[0]?.id || '';
      setSelectedPlanId(nextPlanId);
    }
  }, [availableSites, selectedClient, selectedSiteId]);

  useEffect(() => {
    if (!selectedSite) {
      setSelectedPlanId('');
      return;
    }
    if (!availablePlans.find((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(availablePlans[0]?.id || '');
    }
  }, [availablePlans, selectedPlanId, selectedSite]);

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of selectedPlan?.rooms || []) {
      map.set(room.id, String(room.name || '').trim());
    }
    return map;
  }, [selectedPlan?.rooms]);

  const roomUserNamesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const obj of selectedPlan?.objects || []) {
      const roomId = String(obj.roomId || '').trim();
      if (!roomId) continue;
      const typeId = String(obj.type || '');
      if (typeId !== 'user' && typeId !== 'generic_user' && typeId !== 'real_user') continue;
      const fullName =
        typeId === 'real_user'
          ? `${String((obj as any).firstName || '').trim()} ${String((obj as any).lastName || '').trim()}`.trim()
          : String(obj.name || '').trim();
      if (!fullName) continue;
      const list = map.get(roomId) || [];
      list.push(fullName);
      map.set(roomId, list);
    }
    return map;
  }, [selectedPlan?.objects]);

  const searchEntries = useMemo(() => {
    if (!selectedPlan) return [] as SearchEntry[];
    const entries: SearchEntry[] = [];
    for (const obj of selectedPlan.objects || []) {
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

    const rackObjectById = new Map((selectedPlan.objects || []).filter((obj) => obj.type === 'rack').map((obj) => [obj.id, obj]));
    for (const rackItem of selectedPlan.rackItems || []) {
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

    for (const room of selectedPlan.rooms || []) {
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

    for (const corridor of (selectedPlan.corridors || []) as Corridor[]) {
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
  }, [objectTypeLabels, roomNameById, roomUserNamesById, selectedPlan, t]);

  const normalizedStartQuery = startQuery.trim().toLowerCase();
  const filteredStartEntries = useMemo(() => {
    const base = !normalizedStartQuery
      ? searchEntries
      : searchEntries.filter((entry) => entry.search.includes(normalizedStartQuery));
    return base.slice().sort((a, b) => a.label.localeCompare(b.label, lang === 'it' ? 'it' : 'en', { sensitivity: 'base' }));
  }, [lang, normalizedStartQuery, searchEntries]);
  const normalizedDestinationQuery = destinationQuery.trim().toLowerCase();
  const filteredDestinationEntries = useMemo(() => {
    const base = !normalizedDestinationQuery
      ? searchEntries
      : searchEntries.filter((entry) => entry.search.includes(normalizedDestinationQuery));
    return base.slice().sort((a, b) => a.label.localeCompare(b.label, lang === 'it' ? 'it' : 'en', { sensitivity: 'base' }));
  }, [lang, normalizedDestinationQuery, searchEntries]);
  const selectedDestinationEntry = useMemo(
    () => searchEntries.find((entry) => entry.id === selectedDestinationEntryId) || null,
    [searchEntries, selectedDestinationEntryId]
  );

  useEffect(() => {
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
    setRouteError('');
  }, [selectedPlanId]);

  const mapWidth = Number(selectedPlan?.width || 0) > 0 ? Number(selectedPlan?.width) : 1600;
  const mapHeight = Number(selectedPlan?.height || 0) > 0 ? Number(selectedPlan?.height) : 900;

  const routeMetrics = useMemo(() => {
    if (!routeResult) return null;
    const hasScale = typeof routeResult.distanceMeters === 'number' && Number.isFinite(routeResult.distanceMeters);
    return {
      distanceLabel: hasScale
        ? `${routeResult.distanceMeters?.toFixed(2)} m`
        : `${routeResult.distancePx.toFixed(1)} px`,
      etaLabel: hasScale ? formatEta(routeResult.etaSeconds) : '--'
    };
  }, [routeResult]);

  const routeShareText = useMemo(() => {
    const startLabel = startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-';
    const endLabel = destinationPoint ? `${Math.round(destinationPoint.x)}, ${Math.round(destinationPoint.y)}` : '-';
    const distanceLabel = routeMetrics?.distanceLabel || '--';
    const etaLabel = routeMetrics?.etaLabel || '--';
    return t({
      it: `Percorso interno ${selectedPlan?.name || ''}\nPartenza A: ${startLabel}\nDestinazione B: ${endLabel}\nDistanza: ${distanceLabel}\nTempo stimato: ${etaLabel}`,
      en: `Internal route ${selectedPlan?.name || ''}\nStart A: ${startLabel}\nDestination B: ${endLabel}\nDistance: ${distanceLabel}\nEstimated time: ${etaLabel}`
    });
  }, [destinationPoint, routeMetrics?.distanceLabel, routeMetrics?.etaLabel, selectedPlan?.name, startPoint, t]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsMapFullscreen(Boolean(mapPanelRef.current && document.fullscreenElement === mapPanelRef.current));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const onMapClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!selectedPlan) return;
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
    setRouteError('');
  };

  const handleSelectStartEntry = (entry: SearchEntry) => {
    setSelectedStartEntryId(entry.id);
    setStartPoint({ x: Number(entry.point.x), y: Number(entry.point.y) });
    setStartPointSource('search');
    setRouteResult(null);
    setRouteError('');
  };
  const handleSelectDestinationEntry = (entry: SearchEntry) => {
    setSelectedDestinationEntryId(entry.id);
    setDestinationPoint({ x: Number(entry.point.x), y: Number(entry.point.y) });
    setDestinationPointSource('search');
    setRouteResult(null);
    setRouteError('');
  };

  const runRoute = () => {
    if (!selectedPlan || !startPoint || !destinationPoint) return;
    setComputing(true);
    setRouteError('');
    setRouteResult(null);
    window.setTimeout(() => {
      const result = computeRoute(selectedPlan, startPoint, destinationPoint);
      if (result.route) {
        setRouteResult(result.route);
        setStep(3);
      } else {
        const key = result.error || 'path-not-found';
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

  const openRouteSharePanel = async () => {
    if (!routeResult) {
      setRouteError(t({ it: 'Calcola prima il percorso per poter condividere.', en: 'Calculate the route first to share it.' }));
      return;
    }
    const svg = svgRef.current;
    if (!svg) {
      setRouteError(t({ it: 'Mappa non disponibile per la condivisione.', en: 'Map not available for sharing.' }));
      return;
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const serialized = new XMLSerializer().serializeToString(clone);
    const mapDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    const mapTitle = selectedPlan?.name || t({ it: 'Percorso interno', en: 'Internal route' });
    const svgFile = new File([serialized], 'percorso-interno.svg', { type: 'image/svg+xml' });
    if (navigator.canShare?.({ files: [svgFile] })) {
      try {
        await navigator.share({
          title: mapTitle,
          text: routeShareText,
          files: [svgFile]
        });
        return;
      } catch {
        // Fallback to web links/popup below when native share is canceled or unavailable.
      }
    }
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(routeShareText)}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(routeShareText)}`;
    const mailUrl = `mailto:?subject=${encodeURIComponent(mapTitle)}&body=${encodeURIComponent(routeShareText)}`;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=780');
    if (!win) {
      setRouteError(t({ it: 'Popup bloccato dal browser. Abilita i popup per continuare.', en: 'Popup blocked by browser. Enable popups to continue.' }));
      return;
    }
    const titleSafe = escapeHtml(mapTitle);
    const subtitleSafe = escapeHtml(
      t({
        it: 'Condividi via WhatsApp/Telegram/Email oppure usa Stampa per salvare in PDF.',
        en: 'Share via WhatsApp/Telegram/Email or use Print to save as PDF.'
      })
    );
    const labelWhatsapp = escapeHtml(t({ it: 'WhatsApp', en: 'WhatsApp' }));
    const labelTelegram = escapeHtml(t({ it: 'Telegram', en: 'Telegram' }));
    const labelEmail = escapeHtml(t({ it: 'Email', en: 'Email' }));
    const labelPrint = escapeHtml(t({ it: 'Stampa / Salva PDF', en: 'Print / Save PDF' }));
    const labelSvg = escapeHtml(t({ it: 'Scarica SVG', en: 'Download SVG' }));
    win.document.write(`
<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>${titleSafe}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      .wrap { max-width: 1080px; margin: 0 auto; padding: 20px; }
      .panel { border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; padding: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }
      .title { font-size: 20px; margin: 0 0 4px 0; }
      .sub { margin: 0 0 14px 0; font-size: 13px; color: #475569; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
      .btn { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 12px; cursor: pointer; }
      .btn:hover { background: #f8fafc; }
      .img-box { border: 1px solid #cbd5e1; border-radius: 12px; overflow: auto; background: #e2e8f0; }
      .img-box img { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="panel">
        <h1 class="title">${titleSafe}</h1>
        <p class="sub">${subtitleSafe}</p>
        <div class="actions">
          <a class="btn" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">${labelWhatsapp}</a>
          <a class="btn" href="${telegramUrl}" target="_blank" rel="noopener noreferrer">${labelTelegram}</a>
          <a class="btn" href="${mailUrl}" target="_blank" rel="noopener noreferrer">${labelEmail}</a>
          <button class="btn" onclick="window.print()">${labelPrint}</button>
          <a class="btn" href="${mapDataUrl}" download="percorso-interno.svg">${labelSvg}</a>
        </div>
        <div class="img-box">
          <img src="${mapDataUrl}" alt="${titleSafe}" />
        </div>
      </div>
    </div>
  </body>
</html>`);
    win.document.close();
  };

  const close = () => {
    setComputing(false);
    onClose();
  };

  const canGoStep2 = !!selectedPlan && !!startPoint;
  const canCalculate = !!selectedPlan && !!startPoint && !!destinationPoint && !computing;
  const canSelectMapPoint = (step === 1 && startMode === 'map') || (step === 2 && destinationMode === 'map');
  const canOpenStep2 = !!startPoint;
  const canOpenStep3 = !!routeResult;
  const clearStartMapPoint = () => {
    setStartPoint(null);
    setStartPointSource(null);
    setSelectedStartEntryId('');
    setRouteResult(null);
    setRouteError('');
  };
  const clearDestinationMapPoint = () => {
    setDestinationPoint(null);
    setDestinationPointSource(null);
    setSelectedDestinationEntryId('');
    setRouteResult(null);
    setRouteError('');
  };
  const renderRooms = () =>
    (selectedPlan?.rooms || []).map((room) => {
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
    ((selectedPlan?.corridors || []) as Corridor[]).map((corridor) => {
      const polygon = corridorPolygon(corridor);
      if (polygon.length < 3) return null;
      const points = polygon.map((point) => `${point.x},${point.y}`).join(' ');
      return <polygon key={`corridor:${corridor.id}`} points={points} fill={`url(#${patternId})`} stroke="rgba(15,118,110,0.9)" strokeDasharray="5 4" strokeWidth={1.4} />;
    });
  const renderDoors = () =>
    ((selectedPlan?.corridors || []) as Corridor[]).flatMap((corridor) =>
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

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={close}>
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
                      it: '1) Imposta A con ricerca o selezione su mappa. 2) Imposta B allo stesso modo. 3) Calcola: tratteggio fino alla porta, rosso nel corridoio (90°), tratteggio finale fino a B.',
                      en: '1) Set A via search or map. 2) Set B the same way. 3) Calculate: dashed to door, red corridor path (90°), dashed to B.'
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
                          onChange={(event) => setSelectedClientId(event.target.value)}
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
                          onChange={(event) => setSelectedSiteId(event.target.value)}
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
                          value={selectedPlanId}
                          onChange={(event) => setSelectedPlanId(event.target.value)}
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
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Mappa', en: 'Map' })}</div>
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
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
                          {selectedPlan?.imageUrl ? (
                            <image href={selectedPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                          ) : null}
                          {renderRooms()}
                          {renderCorridors()}
                          {renderDoors()}
                          {startPoint ? (
                            <g>
                              <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                              <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                                A
                              </text>
                            </g>
                          ) : null}
                          {destinationPoint ? (
                            <g>
                              <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                              <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                                B
                              </text>
                            </g>
                          ) : null}
                        </svg>
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
                          onChange={(event) => setSelectedClientId(event.target.value)}
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
                          onChange={(event) => setSelectedSiteId(event.target.value)}
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
                          value={selectedPlanId}
                          onChange={(event) => setSelectedPlanId(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {availablePlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </label>
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

                    <div ref={mapPanelRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
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
                        {selectedPlan?.imageUrl ? (
                          <image href={selectedPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                        ) : null}
                        {renderRooms()}
                        {renderCorridors()}
                        {renderDoors()}
                        {routeResult?.approachPoints?.length ? (
                          <polyline
                            points={routeResult.approachPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth={3}
                            strokeDasharray="8 6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : null}
                        {routeResult?.corridorPoints?.length ? (
                          <polyline
                            points={routeResult.corridorPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth={4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : null}
                        {routeResult?.exitPoints?.length ? (
                          <polyline
                            points={routeResult.exitPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth={3}
                            strokeDasharray="8 6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : null}
                        {destinationPoint ? (
                          <g>
                            <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                            <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                              B
                            </text>
                          </g>
                        ) : null}
                        {startPoint ? (
                          <g>
                            <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                            <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                              A
                            </text>
                          </g>
                        ) : null}
                        {routeResult ? (
                          <>
                            <circle cx={routeResult.startDoor.x} cy={routeResult.startDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                            <circle cx={routeResult.endDoor.x} cy={routeResult.endDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                          </>
                        ) : null}
                      </svg>
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
                        <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                          {t({ it: 'Tratteggio: accesso alle porte. Rosso: percorso interno a 90° nei corridoi.', en: 'Dashed: door approach/exit. Red: 90° internal corridor route.' })}
                        </div>
                      </div>
                      {routeError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</div> : null}
                    </div>
                    <div ref={mapPanelRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <svg ref={svgRef} viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="h-[62vh] w-full bg-slate-100">
                        <defs>
                          <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                            <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
                            <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
                            <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
                          </pattern>
                        </defs>
                        {selectedPlan?.imageUrl ? (
                          <image href={selectedPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                        ) : null}
                        {renderRooms()}
                        {renderCorridors()}
                        {renderDoors()}
                        {routeResult?.approachPoints?.length ? (
                          <polyline points={routeResult.approachPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {routeResult?.corridorPoints?.length ? (
                          <polyline points={routeResult.corridorPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#dc2626" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {routeResult?.exitPoints?.length ? (
                          <polyline points={routeResult.exitPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {startPoint ? (
                          <g>
                            <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                            <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                              A
                            </text>
                          </g>
                        ) : null}
                        {destinationPoint ? (
                          <g>
                            <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                            <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                              B
                            </text>
                          </g>
                        ) : null}
                        {routeResult ? (
                          <>
                            <circle cx={routeResult.startDoor.x} cy={routeResult.startDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                            <circle cx={routeResult.endDoor.x} cy={routeResult.endDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                          </>
                        ) : null}
                      </svg>
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
                        onClick={openRouteSharePanel}
                        disabled={!routeResult}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title={t({ it: 'Condividi via WhatsApp/Telegram/Email o stampa/salva PDF', en: 'Share via WhatsApp/Telegram/Email or print/save PDF' })}
                      >
                        <Share2 size={14} />
                        {t({ it: 'Condividi / Esporta', en: 'Share / Export' })}
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
  );
};

export default InternalMapModal;
