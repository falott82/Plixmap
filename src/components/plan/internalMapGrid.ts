import type { Corridor, FloorPlan } from '../../store/types';
import type { Point } from './internalMapTypes';
import { corridorPolygon } from './internalMapGeometry';
import { pointInPolygon, distancePointToSegment } from './planViewUtils';

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
