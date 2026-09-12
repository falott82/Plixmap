/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { perfMetrics } from '../../../utils/perfMetrics';
import { useUIStore } from '../../../store/useUIStore';

type Pt = { x: number; y: number };

// Corridor polygon drawing (click to add points, click near start or Enter to close, Backspace to undo)
// extracted from CanvasStage. Owns its draft state + RAF/points refs and the keyboard shortcuts.
export const useCanvasCorridorPolyDraft = (deps: {
  corridorDrawMode: any;
  readOnly: boolean;
  perfEnabled: boolean;
  suspendKeyboardShortcuts: boolean;
  onCreateCorridor?: (payload: { kind: 'poly'; points: Pt[] }) => void;
}) => {
  const { corridorDrawMode, readOnly, perfEnabled, suspendKeyboardShortcuts, onCreateCorridor } = deps;
  const [corridorDraftPolyPoints, setCorridorDraftPolyPoints] = useState<Pt[]>([]);
  const [corridorDraftPolyPointer, setCorridorDraftPolyPointer] = useState<Pt | null>(null);
  const corridorDraftPolyRaf = useRef<number | null>(null);
  const corridorDraftPolyPointsRef = useRef<Pt[]>([]);
  const lastCorridorUndoAtRef = useRef(0);

  const previewCorridorDraftPolyLine = useMemo(() => {
    if (corridorDrawMode !== 'poly') return null;
    if (!corridorDraftPolyPoints.length) return null;
    const pts = [...corridorDraftPolyPoints];
    if (corridorDraftPolyPointer) pts.push(corridorDraftPolyPointer);
    return pts.flatMap((p) => [p.x, p.y]);
  }, [corridorDraftPolyPointer, corridorDraftPolyPoints, corridorDrawMode]);

  const finalizeCorridorDraftPoly = useCallback(() => {
    if (corridorDrawMode !== 'poly' || readOnly) return false;
    const points = corridorDraftPolyPointsRef.current;
    if (points.length < 3) return true;
    const nextPoints = points.slice();
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPoints([]);
    corridorDraftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPointer(null);
    onCreateCorridor?.({ kind: 'poly', points: nextPoints });
    return true;
  }, [corridorDrawMode, onCreateCorridor, perfEnabled, readOnly]);

  const undoCorridorDraftSegment = useCallback(() => {
    if (corridorDrawMode !== 'poly' || readOnly) return false;
    const now = Date.now();
    if (now - lastCorridorUndoAtRef.current < 60) return true;
    lastCorridorUndoAtRef.current = now;
    if (!corridorDraftPolyPointsRef.current.length) return true;
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPoints((prev) => {
      const next = prev.slice(0, -1);
      corridorDraftPolyPointsRef.current = next;
      return next;
    });
    return true;
  }, [corridorDrawMode, perfEnabled, readOnly]);

  // Add a point on click — or close the polygon if clicking near the first point.
  const addCorridorDraftPolyPoint = useCallback(
    (world: Pt, zoom: number) => {
      const closeThreshold = 12 / Math.max(0.2, zoom || 1);
      const currentPoints = corridorDraftPolyPointsRef.current;
      if (currentPoints.length >= 3) {
        const first = currentPoints[0];
        if (Math.hypot(world.x - first.x, world.y - first.y) <= closeThreshold) {
          finalizeCorridorDraftPoly();
          return;
        }
      }
      if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
      setCorridorDraftPolyPoints((prev) => {
        const next = [...prev, { x: world.x, y: world.y }];
        corridorDraftPolyPointsRef.current = next;
        return next;
      });
    },
    [finalizeCorridorDraftPoly, perfEnabled]
  );

  const updateCorridorDraftPointer = useCallback(
    (world: Pt) => {
      if (corridorDraftPolyRaf.current) cancelAnimationFrame(corridorDraftPolyRaf.current);
      corridorDraftPolyRaf.current = requestAnimationFrame(() => {
        if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
        setCorridorDraftPolyPointer({ x: world.x, y: world.y });
      });
    },
    [perfEnabled]
  );

  // Keep the ref mirror in sync for synchronous reads (close-detection / undo).
  useEffect(() => {
    corridorDraftPolyPointsRef.current = corridorDraftPolyPoints;
  }, [corridorDraftPolyPoints]);

  // Reset the draft when leaving corridor-poly mode (+ RAF cleanup).
  useEffect(() => {
    if (corridorDrawMode) return;
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPoints([]);
    corridorDraftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPointer(null);
    if (corridorDraftPolyRaf.current) cancelAnimationFrame(corridorDraftPolyRaf.current);
    corridorDraftPolyRaf.current = null;
  }, [corridorDrawMode, perfEnabled]);

  useEffect(() => {
    if (corridorDrawMode !== 'poly') return;
    const handler = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finalizeCorridorDraftPoly();
      }
      if (e.key === 'Backspace') {
        if (!corridorDraftPolyPointsRef.current.length) return;
        e.preventDefault();
        if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
        setCorridorDraftPolyPoints((prev) => {
          const next = prev.slice(0, -1);
          corridorDraftPolyPointsRef.current = next;
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [corridorDrawMode, finalizeCorridorDraftPoly, perfEnabled, suspendKeyboardShortcuts]);

  useEffect(
    () => () => {
      if (corridorDraftPolyRaf.current) cancelAnimationFrame(corridorDraftPolyRaf.current);
    },
    []
  );

  return {
    corridorDraftPolyPoints,
    corridorDraftPolyPointer,
    previewCorridorDraftPolyLine,
    finalizeCorridorDraftPoly,
    undoCorridorDraftSegment,
    addCorridorDraftPolyPoint,
    updateCorridorDraftPointer
  };
};
