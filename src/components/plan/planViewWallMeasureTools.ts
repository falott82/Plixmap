import type { Dispatch, SetStateAction } from 'react';
import { DEFAULT_WALL_TYPES } from '../../store/data';
import type { FloorPlan, ObjectTypeDefinition } from '../../store/types';

type Pt = { x: number; y: number };

// Pure computations extracted from usePlanView's wall/measure tool handlers. Bodies are verbatim;
// closed-over values (including stable refs) are passed in via `deps`, mirroring each hook's original
// dependency array. Module imports (DEFAULT_WALL_TYPES) are imported directly here. The hook wrappers
// and their dep arrays stay unchanged.

export type ResolveWallPointDeps = {
  wallSnapPoints: Pt[];
  zoom: number;
  wallDraftPointsRef: { current: Pt[] };
};

export const computeResolveWallPoint = (
  point: { x: number; y: number },
  options:
    | { shiftKey?: boolean; avoidPoint?: { x: number; y: number } | null; avoidDistance?: number }
    | undefined,
  deps: ResolveWallPointDeps
) => {
  const { wallSnapPoints, zoom, wallDraftPointsRef } = deps;
  const anchor = wallDraftPointsRef.current.length
    ? wallDraftPointsRef.current[wallDraftPointsRef.current.length - 1]
    : null;
  const closeThreshold = 12 / Math.max(0.2, zoom || 1);
  let axisLock: 'x' | 'y' | null = null;
  let next = { ...point };
  if (!options?.shiftKey && anchor) {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      axisLock = 'y';
      next.y = anchor.y;
    } else {
      axisLock = 'x';
      next.x = anchor.x;
    }
  }
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const snap of wallSnapPoints) {
    if (options?.avoidPoint && Number.isFinite(options?.avoidDistance)) {
      const avoidDist = Math.hypot(snap.x - options.avoidPoint.x, snap.y - options.avoidPoint.y);
      if (avoidDist <= (options.avoidDistance as number)) continue;
    }
    if (axisLock === 'x' && Math.abs(snap.x - next.x) > closeThreshold) continue;
    if (axisLock === 'y' && Math.abs(snap.y - next.y) > closeThreshold) continue;
    const dist = Math.hypot(snap.x - next.x, snap.y - next.y);
    if (dist <= closeThreshold && dist < bestDist) {
      best = snap;
      bestDist = dist;
    }
  }
  if (best) next = best;
  return next;
};

export type HandleWallPointDeps = {
  addWallSegment: (payload: {
    start: Pt;
    end: Pt;
    typeId: string;
    label: string;
    layerIds?: string[];
    strokeColor?: string;
    opacity?: number;
    strokeWidth?: number;
  }) => string | null;
  finishWallDraw: () => void;
  getTypeLabel: (typeId: string) => string;
  isWallType: (typeId: string) => boolean;
  markTouched: () => void;
  renderPlan: FloorPlan | undefined;
  resolveWallPoint: (
    point: Pt,
    options?: { shiftKey?: boolean; avoidPoint?: Pt | null; avoidDistance?: number }
  ) => Pt;
  wallDrawMode: boolean;
  wallDrawType: string | null;
  wallTypeDefs: ObjectTypeDefinition[];
  zoom: number;
  wallDraftPointsRef: { current: Pt[] };
  wallDraftSegmentIdsRef: { current: string[] };
  lastInsertedRef: { current: { id: string; name: string } | null };
  setWallDraftPoints: Dispatch<SetStateAction<Pt[]>>;
  setWallDraftPointer: Dispatch<SetStateAction<Pt | null>>;
};

export const computeHandleWallPoint = (
  point: { x: number; y: number },
  options: { shiftKey?: boolean } | undefined,
  deps: HandleWallPointDeps
) => {
  const {
    addWallSegment,
    finishWallDraw,
    getTypeLabel,
    isWallType,
    markTouched,
    renderPlan,
    resolveWallPoint,
    wallDrawMode,
    wallDrawType,
    wallTypeDefs,
    zoom,
    wallDraftPointsRef,
    wallDraftSegmentIdsRef,
    lastInsertedRef,
    setWallDraftPoints,
    setWallDraftPointer
  } = deps;
  if (!wallDrawMode) return;
  const draftPoints = wallDraftPointsRef.current;
  const start = draftPoints[0];
  const closeThreshold = 6 / Math.max(0.2, zoom || 1);
  const distToStartRaw = start ? Math.hypot(point.x - start.x, point.y - start.y) : Infinity;
  const shouldClose = draftPoints.length >= 3 && start && distToStartRaw <= closeThreshold;
  const avoidPoint = start && !shouldClose ? start : null;
  const resolved = resolveWallPoint(point, { ...options, avoidPoint, avoidDistance: closeThreshold });
  if (!draftPoints.length) {
    const nextPoints = [resolved];
    wallDraftPointsRef.current = nextPoints;
    setWallDraftPoints(nextPoints);
    setWallDraftPointer(null);
    return;
  }
  const last = draftPoints[draftPoints.length - 1];
  const minSegment = 2 / Math.max(0.2, zoom || 1);
  const distToLast = Math.hypot(resolved.x - last.x, resolved.y - last.y);
  if (distToLast <= minSegment) return;
  const typeId = (wallDrawType && isWallType(wallDrawType) ? wallDrawType : wallTypeDefs[0]?.id) || DEFAULT_WALL_TYPES[0];
  if (!typeId || !renderPlan) return;
  const endPoint = shouldClose && start ? start : resolved;
  markTouched();
  const label = getTypeLabel(typeId);
  const id = addWallSegment({
    start: last,
    end: endPoint,
    typeId,
    label,
    strokeWidth: 1
  });
  if (id) {
    wallDraftSegmentIdsRef.current.push(id);
    lastInsertedRef.current = { id, name: label };
  }
  const points = [...draftPoints, endPoint];
  wallDraftPointsRef.current = points;
  setWallDraftPoints(points);
  setWallDraftPointer(null);
  if (shouldClose) {
    finishWallDraw();
  }
};

export type HandleMeasurePointDeps = {
  measureMode: boolean;
  resolveAxisLockedPoint: (point: Pt, anchor: Pt | null, options?: { shiftKey?: boolean }) => Pt;
  showMeasureToast: (points: Pt[], state: { closed: boolean; finished: boolean }) => void;
  zoom: number;
  measurePointsRef: { current: Pt[] };
  measureClosedRef: { current: boolean };
  measureFinishedRef: { current: boolean };
  setMeasurePoints: Dispatch<SetStateAction<Pt[]>>;
  setMeasurePointer: Dispatch<SetStateAction<Pt | null>>;
  setMeasureClosed: Dispatch<SetStateAction<boolean>>;
  setMeasureFinished: Dispatch<SetStateAction<boolean>>;
};

export const computeHandleMeasurePoint = (
  point: { x: number; y: number },
  options: { shiftKey?: boolean } | undefined,
  deps: HandleMeasurePointDeps
) => {
  const {
    measureMode,
    resolveAxisLockedPoint,
    showMeasureToast,
    zoom,
    measurePointsRef,
    measureClosedRef,
    measureFinishedRef,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished
  } = deps;
  if (!measureMode || measureFinishedRef.current) return;
  const points = measurePointsRef.current;
  if (!points.length) {
    const next = [point];
    measurePointsRef.current = next;
    setMeasurePoints(next);
    showMeasureToast(next, { closed: false, finished: false });
    return;
  }
  const anchor = points[points.length - 1];
  const resolved = resolveAxisLockedPoint(point, anchor, options);
  const minSegment = 6 / Math.max(0.2, zoom || 1);
  if (Math.hypot(resolved.x - anchor.x, resolved.y - anchor.y) < minSegment) return;
  const closeThreshold = 12 / Math.max(0.2, zoom || 1);
  if (points.length >= 3) {
    const first = points[0];
    const dist = Math.hypot(point.x - first.x, point.y - first.y);
    if (dist <= closeThreshold) {
      setMeasureClosed(true);
      setMeasureFinished(true);
      measureClosedRef.current = true;
      measureFinishedRef.current = true;
      setMeasurePointer(null);
      showMeasureToast(points, { closed: true, finished: true });
      return;
    }
  }
  const next = [...points, resolved];
  measurePointsRef.current = next;
  setMeasurePoints(next);
  showMeasureToast(next, { closed: false, finished: false });
};

export type HandleToolMoveDeps = {
  isReadOnly: boolean;
  measureMode: boolean;
  quoteMode: boolean;
  quotePoints: Pt[];
  resolveAxisLockedPoint: (point: Pt, anchor: Pt | null, options?: { shiftKey?: boolean }) => Pt;
  resolveWallPoint: (
    point: Pt,
    options?: { shiftKey?: boolean; avoidPoint?: Pt | null; avoidDistance?: number }
  ) => Pt;
  scaleDraft: { start?: Pt; end?: Pt } | null;
  scaleMode: boolean;
  wallDrawMode: boolean;
  zoom: number;
  wallDraftPointsRef: { current: Pt[] };
  measurePointsRef: { current: Pt[] };
  measureFinishedRef: { current: boolean };
  setScaleDraftPointer: Dispatch<SetStateAction<Pt | null>>;
  setWallDraftPointer: Dispatch<SetStateAction<Pt | null>>;
  setQuotePointer: Dispatch<SetStateAction<Pt | null>>;
  setMeasurePointer: Dispatch<SetStateAction<Pt | null>>;
};

export const computeHandleToolMove = (
  point: { x: number; y: number },
  options: { shiftKey?: boolean } | undefined,
  deps: HandleToolMoveDeps
) => {
  const {
    isReadOnly,
    measureMode,
    quoteMode,
    quotePoints,
    resolveAxisLockedPoint,
    resolveWallPoint,
    scaleDraft,
    scaleMode,
    wallDrawMode,
    zoom,
    wallDraftPointsRef,
    measurePointsRef,
    measureFinishedRef,
    setScaleDraftPointer,
    setWallDraftPointer,
    setQuotePointer,
    setMeasurePointer
  } = deps;
  if (scaleMode && scaleDraft?.start && !scaleDraft?.end) {
    setScaleDraftPointer(resolveAxisLockedPoint(point, scaleDraft.start, options));
    return;
  }
  if (wallDrawMode) {
    const draftPoints = wallDraftPointsRef.current;
    const start = draftPoints[0];
    const closeThreshold = 6 / Math.max(0.2, zoom || 1);
    const distToStartRaw = start ? Math.hypot(point.x - start.x, point.y - start.y) : Infinity;
    const shouldClose = draftPoints.length >= 3 && start && distToStartRaw <= closeThreshold;
    const avoidPoint = start && !shouldClose ? start : null;
    const resolved = resolveWallPoint(point, { ...options, avoidPoint, avoidDistance: closeThreshold });
    if (shouldClose && start) {
      setWallDraftPointer(start);
      return;
    }
    setWallDraftPointer(resolved);
    return;
  }
  if (quoteMode) {
    if (quotePoints.length && !isReadOnly) {
      setQuotePointer(resolveAxisLockedPoint(point, quotePoints[0], options));
    }
    return;
  }
  if (measureMode) {
    if (measureFinishedRef.current) return;
    const points = measurePointsRef.current;
    const anchor = points.length ? points[points.length - 1] : null;
    const resolved = resolveAxisLockedPoint(point, anchor, options);
    if (points.length >= 3) {
      const first = points[0];
      const closeThreshold = 12 / Math.max(0.2, zoom || 1);
      const dist = Math.hypot(point.x - first.x, point.y - first.y);
      if (dist <= closeThreshold) {
        setMeasurePointer(first);
        return;
      }
    }
    setMeasurePointer(resolved);
  }
};
