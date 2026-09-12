/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MapObject } from '../../../store/types';

// Pure spatial-index cores extracted from CanvasStage (ref-caching stays in the component).

export type SpatialIndex = { version: number; cellSize: number; cells: Map<string, string[]> };

// Adaptive grid cell size based on the plan's smallest dimension.
export const spatialCellSize = (baseWidth: number, baseHeight: number) => {
  const minDim = Math.min(baseWidth || 0, baseHeight || 0);
  return Math.max(140, Math.min(520, minDim ? minDim / 12 : 320));
};

// Bucket object ids into grid cells covering each object's bounds. Pure given getObjectBounds.
export const buildSpatialIndexCells = (
  objects: MapObject[],
  getObjectBounds: (obj: MapObject) => { minX: number; minY: number; maxX: number; maxY: number } | null,
  cellSize: number
): Map<string, string[]> => {
  const cells = new Map<string, string[]>();
  for (const obj of objects) {
    const bounds = getObjectBounds(obj);
    const x = Number(obj.x);
    const y = Number(obj.y);
    const minX = bounds?.minX ?? x;
    const minY = bounds?.minY ?? y;
    const maxX = bounds?.maxX ?? x;
    const maxY = bounds?.maxY ?? y;
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) continue;
    const minCellX = Math.floor(minX / cellSize);
    const maxCellX = Math.floor(maxX / cellSize);
    const minCellY = Math.floor(minY / cellSize);
    const maxCellY = Math.floor(maxY / cellSize);
    for (let cx = minCellX; cx <= maxCellX; cx += 1) {
      for (let cy = minCellY; cy <= maxCellY; cy += 1) {
        const key = `${cx},${cy}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(obj.id);
        else cells.set(key, [obj.id]);
      }
    }
  }
  return cells;
};

// Resolve the objects whose grid cells intersect a selection rect. Pure.
export const selectionCandidatesFromIndex = (
  rect: { x: number; y: number; width: number; height: number },
  index: SpatialIndex,
  objectById: Map<string, MapObject>
): MapObject[] => {
  const minCellX = Math.floor(rect.x / index.cellSize);
  const maxCellX = Math.floor((rect.x + rect.width) / index.cellSize);
  const minCellY = Math.floor(rect.y / index.cellSize);
  const maxCellY = Math.floor((rect.y + rect.height) / index.cellSize);
  const ids = new Set<string>();
  for (let cx = minCellX; cx <= maxCellX; cx += 1) {
    for (let cy = minCellY; cy <= maxCellY; cy += 1) {
      const bucket = index.cells.get(`${cx},${cy}`);
      if (!bucket) continue;
      for (const id of bucket) ids.add(id);
    }
  }
  if (!ids.size) return [];
  const list: MapObject[] = [];
  ids.forEach((id) => {
    const obj = objectById.get(id);
    if (obj) list.push(obj);
  });
  return list;
};
