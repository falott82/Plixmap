/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { perfMetrics } from '../../../utils/perfMetrics';
import { dragRectFromCorners } from '../CanvasStage.helpers';

type Rect = { x: number; y: number; width: number; height: number };
type Pt = { x: number; y: number };

// Marquee box-selection extracted from CanvasStage. Owns the box state + box-specific refs; the
// shared selection refs (selectedRoomIds/boxSelectionActive/lastBoxSelectAt) stay in the host (used
// by its sync effect / click-suppression) and are passed in.
export const useCanvasSelectionBox = (deps: {
  pointerToWorld: (x: number, y: number) => Pt;
  perfEnabled: boolean;
  getSelectionCandidates: (rect: Rect) => any[];
  getObjectBounds: (o: any) => { minX: number; minY: number; maxX: number; maxY: number } | null;
  getRoomBounds: (room: any) => { minX: number; minY: number; maxX: number; maxY: number } | null;
  rooms: any[];
  getZoom: () => number;
  onSelect: (id?: string, opts?: { multi?: boolean }) => void;
  onSelectMany?: (ids: string[]) => void;
  onSelectRooms?: (ids: string[]) => void;
  selectedRoomIdsRef: { current: string[] };
  boxSelectionActiveRef: { current: boolean };
  lastBoxSelectAtRef: { current: number };
}) => {
  const {
    pointerToWorld,
    perfEnabled,
    getSelectionCandidates,
    getObjectBounds,
    getRoomBounds,
    rooms,
    getZoom,
    onSelect,
    onSelectMany,
    onSelectRooms,
    selectedRoomIdsRef,
    boxSelectionActiveRef,
    lastBoxSelectAtRef
  } = deps;
  const [selectionBox, setSelectionBox] = useState<Rect | null>(null);
  const selectionOrigin = useRef<Pt | null>(null);
  const selectionBoxRaf = useRef<number | null>(null);
  const pendingSelectionBoxRef = useRef<Rect | null>(null);
  const lastSelectionBoxRef = useRef<Rect | null>(null);

  const isBoxSelecting = () => !!selectionOrigin.current;

  const beginSelectionBox = (world: Pt) => {
    selectionOrigin.current = { x: world.x, y: world.y };
    pendingSelectionBoxRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
    lastSelectionBoxRef.current = pendingSelectionBoxRef.current;
    setSelectionBox(pendingSelectionBoxRef.current);
    lastBoxSelectAtRef.current = Date.now();
  };

  const updateSelectionBox = (event: any) => {
    if (!selectionOrigin.current) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const { x, y, width, height } = dragRectFromCorners(selectionOrigin.current.x, selectionOrigin.current.y, world.x, world.y);
    pendingSelectionBoxRef.current = { x, y, width, height };
    lastSelectionBoxRef.current = pendingSelectionBoxRef.current;
    if (selectionBoxRaf.current) return true;
    selectionBoxRaf.current = requestAnimationFrame(() => {
      selectionBoxRaf.current = null;
      const next = pendingSelectionBoxRef.current;
      pendingSelectionBoxRef.current = null;
      if (!next) return;
      if (perfEnabled) perfMetrics.selectionBoxUpdates += 1;
      setSelectionBox(next);
    });
    return true;
  };

  const finalizeSelectionBox = () => {
    if (!selectionOrigin.current) return false;
    const rect = lastSelectionBoxRef.current || pendingSelectionBoxRef.current || selectionBox;
    selectionOrigin.current = null;
    if (selectionBoxRaf.current) cancelAnimationFrame(selectionBoxRaf.current);
    selectionBoxRaf.current = null;
    pendingSelectionBoxRef.current = null;
    lastSelectionBoxRef.current = null;
    if (perfEnabled) perfMetrics.selectionBoxUpdates += 1;
    setSelectionBox(null);
    if (!rect) return true;
    const wPx = rect.width * Math.max(0.001, getZoom() || 1);
    const hPx = rect.height * Math.max(0.001, getZoom() || 1);
    if (wPx < 8 || hPx < 8) {
      // Desktop behavior: click on empty area clears selection.
      onSelect(undefined);
      selectedRoomIdsRef.current = [];
      return true;
    }
    const minX = rect.x;
    const maxX = rect.x + rect.width;
    const minY = rect.y;
    const maxY = rect.y + rect.height;
    const candidates = getSelectionCandidates(rect);
    const ids = candidates
      .filter((o) => {
        const bounds = getObjectBounds(o);
        const x = Number(o.x);
        const y = Number(o.y);
        const pointInside = Number.isFinite(x) && Number.isFinite(y) && x >= minX && x <= maxX && y >= minY && y <= maxY;
        if (bounds) {
          const boundsHit = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
          return boundsHit || pointInside;
        }
        return pointInside;
      })
      .map((o) => o.id);
    const roomIds = (rooms || [])
      .filter((room) => {
        const bounds = getRoomBounds(room);
        if (!bounds) return false;
        return bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
      })
      .map((room) => room.id);
    selectedRoomIdsRef.current = roomIds;
    if (onSelectRooms) onSelectRooms(roomIds);
    boxSelectionActiveRef.current = true;
    if (onSelectMany) onSelectMany(ids);
    else {
      onSelect(undefined);
      for (const id of ids) onSelect(id, { multi: true });
    }
    lastBoxSelectAtRef.current = Date.now();
    return true;
  };

  useEffect(
    () => () => {
      if (selectionBoxRaf.current) cancelAnimationFrame(selectionBoxRaf.current);
    },
    []
  );

  return { selectionBox, isBoxSelecting, beginSelectionBox, updateSelectionBox, finalizeSelectionBox };
};
