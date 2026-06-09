/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import {
  computeOpenEditRoom,
  computeSnapRoomRectToAdjacentSide,
  computeCreateRoomFromRect,
  computeCreateRoomFromPoly
} from './planViewRoomGeometry';

// Room/corridor draw-begin + room create/edit handlers extracted from usePlanView. Plain handlers
// (recreated each render as before) + the snap-to-adjacent-side useCallback (kept internal). Bodies
// moved verbatim.
export const usePlanRoomDrawHandlers = (deps: any) => {
  const {
    isReadOnly, setPendingType, setRoomDrawMode, setRoomsOpen, setContextMenu, push, t, setCorridorDoorDraft,
    setCorridorQuickMenu, setCorridorDrawMode, rooms, setRoomModal, plan, hasRoomOverlap, notifyRoomOverlap
  } = deps;

  const beginRoomDraw = () => {
    if (isReadOnly) return;
    setPendingType(null);
    setRoomDrawMode('rect');
    setRoomsOpen(false);
    setContextMenu(null);
    push(t({ it: 'Disegna un rettangolo sulla mappa per creare una stanza', en: 'Draw a rectangle on the map to create a room' }), 'info');
  };

  const beginRoomPolyDraw = () => {
    if (isReadOnly) return;
    setPendingType(null);
    setRoomDrawMode('poly');
    setRoomsOpen(false);
    setContextMenu(null);
    push(
      t({
        it: 'Clicca più punti per disegnare un poligono. Clicca sul primo punto (o premi Invio) per chiudere.',
        en: 'Click multiple points to draw a polygon. Click the first point (or press Enter) to close.'
      }),
      'info'
    );
  };

  const beginCorridorPolyDraw = () => {
    if (isReadOnly) return;
    setPendingType(null);
    setRoomDrawMode(null);
    setCorridorDoorDraft(null);
    setCorridorQuickMenu(null);
    setCorridorDrawMode('poly');
    setRoomsOpen(false);
    setContextMenu(null);
  };

  const openEditRoom = (roomId: string, options?: { openDepartments?: boolean }) =>
    computeOpenEditRoom(roomId, options, { rooms, isReadOnly, setRoomModal });

  const snapRoomRectToAdjacentSide = useCallback(
    (inputRect: { x: number; y: number; width: number; height: number }) =>
      computeSnapRoomRectToAdjacentSide(inputRect, { plan }),
    [plan]
  );

  const handleCreateRoomFromRect = (rect: { x: number; y: number; width: number; height: number }) =>
    computeCreateRoomFromRect(rect, { isReadOnly, snapRoomRectToAdjacentSide, hasRoomOverlap, notifyRoomOverlap, setRoomDrawMode, setRoomModal });

  const handleCreateRoomFromPoly = (points: { x: number; y: number }[]) =>
    computeCreateRoomFromPoly(points, { isReadOnly, hasRoomOverlap, notifyRoomOverlap, setRoomDrawMode, setRoomModal });

  return {
    beginRoomDraw,
    beginRoomPolyDraw,
    beginCorridorPolyDraw,
    openEditRoom,
    handleCreateRoomFromRect,
    handleCreateRoomFromPoly,
  };
};
