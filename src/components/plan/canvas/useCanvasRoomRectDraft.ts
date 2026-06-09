/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useState } from 'react';
import { perfMetrics } from '../../../utils/perfMetrics';
import { dragRectFromCorners, findNearestRoomCorner } from '../CanvasStage.helpers';

type Rect = { x: number; y: number; width: number; height: number };
type Pt = { x: number; y: number };

// Room rectangle drawing (drag from a corner-snapped origin) extracted from CanvasStage.
// Exposes stable resetDraftRect()/clearRoomRectSnapHint() so the host's existing reset effects call
// them (no new set-state-in-effect warnings). All pointer methods take an already-converted world point.
export const useCanvasRoomRectDraft = (deps: {
  roomDrawMode: any;
  readOnly: boolean;
  perfEnabled: boolean;
  rooms: any[];
  getZoom: () => number;
  onCreateRoom?: (payload: { kind: 'rect'; rect: Rect }) => void;
}) => {
  const { roomDrawMode, readOnly, perfEnabled, rooms, getZoom, onCreateRoom } = deps;
  const [draftRect, setDraftRect] = useState<Rect | null>(null);
  const [roomRectSnapHint, setRoomRectSnapHint] = useState<Pt | null>(null);
  const draftOrigin = useRef<Pt | null>(null);
  const draftRectRaf = useRef<number | null>(null);
  const pendingDraftRectRef = useRef<Rect | null>(null);

  const getNearestRoomCorner = useCallback(
    (point: Pt) => findNearestRoomCorner((rooms || []) as any[], point, getZoom()),
    [rooms, getZoom]
  );

  const isRectDrafting = useCallback(() => !!draftOrigin.current, []);

  const clearRoomRectSnapHint = useCallback(() => setRoomRectSnapHint(null), []);

  const resetDraftRect = useCallback(() => {
    draftOrigin.current = null;
    if (perfEnabled) perfMetrics.draftRectUpdates += 1;
    setDraftRect(null);
    if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
    draftRectRaf.current = null;
    pendingDraftRectRef.current = null;
    setRoomRectSnapHint(null);
  }, [perfEnabled]);

  const beginRectDraft = useCallback((world: Pt) => {
    const snapped = getNearestRoomCorner(world) || world;
    setRoomRectSnapHint(null);
    draftOrigin.current = { x: snapped.x, y: snapped.y };
    pendingDraftRectRef.current = { x: snapped.x, y: snapped.y, width: 0, height: 0 };
    if (perfEnabled) perfMetrics.draftRectUpdates += 1;
    setDraftRect(pendingDraftRectRef.current);
  }, [getNearestRoomCorner, perfEnabled]);

  const updateDraftRect = useCallback((world: Pt) => {
    const origin = draftOrigin.current;
    if (!origin) return;
    pendingDraftRectRef.current = dragRectFromCorners(origin.x, origin.y, world.x, world.y);
    if (draftRectRaf.current) return;
    draftRectRaf.current = requestAnimationFrame(() => {
      draftRectRaf.current = null;
      const next = pendingDraftRectRef.current;
      pendingDraftRectRef.current = null;
      if (!next) return;
      if (perfEnabled) perfMetrics.draftRectUpdates += 1;
      setDraftRect(next);
    });
  }, [perfEnabled]);

  const finalizeDraftRect = useCallback(() => {
    if (roomDrawMode !== 'rect' || readOnly) return false;
    if (!draftOrigin.current || !draftRect) return false;
    const rect = {
      x: draftRect.x,
      y: draftRect.y,
      width: Math.max(0, draftRect.width),
      height: Math.max(0, draftRect.height)
    };
    draftOrigin.current = null;
    if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
    draftRectRaf.current = null;
    pendingDraftRectRef.current = null;
    setRoomRectSnapHint(null);
    setDraftRect(null);
    if (rect.width < 20 || rect.height < 20) return true;
    onCreateRoom?.({ kind: 'rect', rect });
    return true;
  }, [draftRect, onCreateRoom, readOnly, roomDrawMode]);

  // Pointer-move snap-hint preview while in rect mode before a drag starts. world=null when no pointer.
  const updateRectSnapPreview = useCallback(
    (world: Pt | null) => {
      if (roomDrawMode === 'rect' && !readOnly && !draftOrigin.current) {
        if (world) {
          const nearestCorner = getNearestRoomCorner(world);
          setRoomRectSnapHint((prev) => {
            if (!nearestCorner) return prev ? null : prev;
            if (prev && Math.hypot(prev.x - nearestCorner.x, prev.y - nearestCorner.y) < 0.001) return prev;
            return nearestCorner;
          });
        } else {
          setRoomRectSnapHint(null);
        }
      } else {
        setRoomRectSnapHint((prev) => (prev ? null : prev));
      }
    },
    [getNearestRoomCorner, readOnly, roomDrawMode]
  );

  return {
    draftRect,
    roomRectSnapHint,
    isRectDrafting,
    resetDraftRect,
    clearRoomRectSnapHint,
    beginRectDraft,
    updateDraftRect,
    finalizeDraftRect,
    updateRectSnapPreview
  };
};
