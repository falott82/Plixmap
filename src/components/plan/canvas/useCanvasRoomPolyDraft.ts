/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { perfMetrics } from '../../../utils/perfMetrics';
import { useUIStore } from '../../../store/useUIStore';

type Pt = { x: number; y: number };

// Room polygon drawing (click to add, axis-locked unless Shift, click-near-start/Enter closes,
// Backspace undoes) extracted from CanvasStage. The room rect+poly drafts share ONE reset effect in
// the host, so this hook exposes a stable resetDraftPoly() the host calls from that effect (rather
// than owning a second reset effect, which would add a set-state-in-effect warning).
export const useCanvasRoomPolyDraft = (deps: {
  roomDrawMode: any;
  readOnly: boolean;
  perfEnabled: boolean;
  suspendKeyboardShortcuts: boolean;
  onCreateRoom?: (payload: { kind: 'poly'; points: Pt[] }) => void;
}) => {
  const { roomDrawMode, readOnly, perfEnabled, suspendKeyboardShortcuts, onCreateRoom } = deps;
  const [draftPolyPoints, setDraftPolyPoints] = useState<Pt[]>([]);
  const [draftPolyPointer, setDraftPolyPointer] = useState<Pt | null>(null);
  const draftPolyRaf = useRef<number | null>(null);
  const draftPolyPointsRef = useRef<Pt[]>([]);

  const constrain = (world: Pt, shiftKey?: boolean): Pt => {
    const last = draftPolyPointsRef.current[draftPolyPointsRef.current.length - 1];
    if (!last || shiftKey) return world;
    const dx = world.x - last.x;
    const dy = world.y - last.y;
    if (Math.abs(dx) >= Math.abs(dy)) return { x: world.x, y: last.y };
    return { x: last.x, y: world.y };
  };

  const previewDraftPolyLine = useMemo(() => {
    if (roomDrawMode !== 'poly') return null;
    if (!draftPolyPoints.length) return null;
    const pts = [...draftPolyPoints];
    if (draftPolyPointer) pts.push(draftPolyPointer);
    return pts.flatMap((p) => [p.x, p.y]);
  }, [draftPolyPointer, draftPolyPoints, roomDrawMode]);

  // Stable reset the host calls from its shared room reset effect.
  const resetDraftPoly = useCallback(() => {
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPoints([]);
    draftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPointer(null);
    if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
    draftPolyRaf.current = null;
  }, [perfEnabled]);

  const finalizeDraftPoly = useCallback(() => {
    if (roomDrawMode !== 'poly' || readOnly) return false;
    const points = draftPolyPointsRef.current;
    if (points.length < 3) return true;
    const nextPoints = points.slice();
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPoints([]);
    draftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPointer(null);
    onCreateRoom?.({ kind: 'poly', points: nextPoints });
    return true;
  }, [onCreateRoom, perfEnabled, readOnly, roomDrawMode]);

  const addDraftPolyPoint = useCallback(
    (world: Pt, zoom: number, shiftKey?: boolean) => {
      const constrained = constrain(world, shiftKey);
      const closeThreshold = 12 / Math.max(0.2, zoom || 1);
      const currentPoints = draftPolyPointsRef.current;
      if (currentPoints.length >= 3) {
        const first = currentPoints[0];
        if (Math.hypot(constrained.x - first.x, constrained.y - first.y) <= closeThreshold) {
          finalizeDraftPoly();
          return;
        }
      }
      if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
      setDraftPolyPoints((prev) => {
        const next = [...prev, { x: constrained.x, y: constrained.y }];
        draftPolyPointsRef.current = next;
        return next;
      });
    },
    [finalizeDraftPoly, perfEnabled]
  );

  const updateDraftPolyPointer = useCallback(
    (world: Pt, shiftKey?: boolean) => {
      const constrained = constrain(world, shiftKey);
      if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
      draftPolyRaf.current = requestAnimationFrame(() => {
        if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
        setDraftPolyPointer({ x: constrained.x, y: constrained.y });
      });
    },
    [perfEnabled]
  );

  useEffect(() => {
    draftPolyPointsRef.current = draftPolyPoints;
  }, [draftPolyPoints]);

  useEffect(() => {
    if (roomDrawMode !== 'poly') return;
    const handler = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finalizeDraftPoly();
      }
      if (e.key === 'Backspace') {
        if (!draftPolyPointsRef.current.length) return;
        e.preventDefault();
        if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
        setDraftPolyPoints((prev) => {
          const next = prev.slice(0, -1);
          draftPolyPointsRef.current = next;
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [finalizeDraftPoly, perfEnabled, roomDrawMode, suspendKeyboardShortcuts]);

  useEffect(
    () => () => {
      if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
    },
    []
  );

  return { draftPolyPoints, previewDraftPolyLine, resetDraftPoly, addDraftPolyPoint, updateDraftPolyPointer };
};
