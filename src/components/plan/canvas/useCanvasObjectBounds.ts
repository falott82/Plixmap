/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef } from 'react';
import type { MapObject } from '../../../store/types';
import { computeObjectBounds as computeObjectBoundsImpl } from '../CanvasStage.helpers';
import { spatialCellSize, buildSpatialIndexCells, selectionCandidatesFromIndex } from './canvasSpatialIndex';

type Bounds = { minX: number; minY: number; maxX: number; maxY: number } | null;

// Object-bounds caching + spatial index for marquee selection, extracted from CanvasStage.
// Owns the cache/version/index refs; invalidates (version bump) when objects/wall types change.
export const useCanvasObjectBounds = (deps: any) => {
  const { objects, wallTypeIdSet, objectById, estimateTextWidth, objectNodeRefs, stageRef, baseWidth, baseHeight } = deps;
  const boundsVersionRef = useRef(0);
  const boundsCacheRef = useRef<Map<string, { version: number; bounds: Bounds }>>(new Map());
  const spatialIndexRef = useRef<{ version: number; cellSize: number; cells: Map<string, string[]> } | null>(null);
  const lastObjectsRef = useRef<MapObject[] | null>(null);
  const lastWallTypeIdSetRef = useRef<Set<string> | null>(null);

  if (lastObjectsRef.current !== objects || lastWallTypeIdSetRef.current !== wallTypeIdSet) {
    boundsVersionRef.current += 1;
    boundsCacheRef.current.clear();
    spatialIndexRef.current = null;
    lastObjectsRef.current = objects;
    lastWallTypeIdSetRef.current = wallTypeIdSet;
  }

  const getNodeBounds = useCallback((obj: MapObject): Bounds => {
    const node = objectNodeRefs.current[obj.id];
    const stage = stageRef.current;
    if (!node || !stage) return null;
    try {
      const rect = node.getClientRect({ skipTransform: false, skipStroke: true, skipShadow: true });
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      const p1 = transform.point({ x: rect.x, y: rect.y });
      const p2 = transform.point({ x: rect.x + rect.width, y: rect.y + rect.height });
      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxX = Math.max(p1.x, p2.x);
      const maxY = Math.max(p1.y, p2.y);
      if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
      return { minX, minY, maxX, maxY };
    } catch {
      return null;
    }
  }, [objectNodeRefs, stageRef]);

  const computeObjectBounds = useCallback(
    (obj: MapObject) => computeObjectBoundsImpl(obj, { wallTypeIdSet, getNodeBounds, estimateTextWidth }),
    [estimateTextWidth, getNodeBounds, wallTypeIdSet]
  );

  const getObjectBounds = useCallback(
    (obj: MapObject) => {
      const version = boundsVersionRef.current;
      const cached = boundsCacheRef.current.get(obj.id);
      if (cached && cached.version === version) return cached.bounds;
      const bounds = computeObjectBounds(obj);
      boundsCacheRef.current.set(obj.id, { version, bounds });
      return bounds;
    },
    [computeObjectBounds, boundsCacheRef, boundsVersionRef]
  );

  const getSpatialCellSize = useCallback(() => spatialCellSize(baseWidth, baseHeight), [baseHeight, baseWidth]);

  const buildSpatialIndex = useCallback(() => {
    const version = boundsVersionRef.current;
    const cellSize = getSpatialCellSize();
    const cells = buildSpatialIndexCells(objects, getObjectBounds, cellSize);
    const next = { version, cellSize, cells };
    spatialIndexRef.current = next;
    return next;
  }, [getObjectBounds, getSpatialCellSize, objects, boundsVersionRef, spatialIndexRef]);

  const getSpatialIndex = useCallback(() => {
    const cached = spatialIndexRef.current;
    const version = boundsVersionRef.current;
    const cellSize = getSpatialCellSize();
    if (cached && cached.version === version && Math.abs(cached.cellSize - cellSize) < 0.5) return cached;
    return buildSpatialIndex();
  }, [buildSpatialIndex, getSpatialCellSize, boundsVersionRef, spatialIndexRef]);

  const getSelectionCandidates = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (objects.length < 250) return objects;
      return selectionCandidatesFromIndex(rect, getSpatialIndex(), objectById);
    },
    [getSpatialIndex, objectById, objects]
  );

  return { getNodeBounds, getObjectBounds, getSelectionCandidates };
};
