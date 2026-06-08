import { useCallback } from 'react';
import { computeHandleCorridorDoorDraftPoint, computeCreateRoomDoorFromDraft, computeStartRoomDoorDraft } from './planViewCorridorGeometry';

// Corridor/room door-draft handlers extracted from usePlanView (place a corridor
// door at a drafted point, create a room door from a draft, start a room-door
// draft between two rooms). Thin wrappers over the existing compute* helpers;
// shared deps injected once. Bodies are verbatim.
export const usePlanRoomDoorDraftHandlers = (deps: any) => {
  const {
    corridorDoorDraft,
    defaultDoorCatalogId,
    markTouched,
    objectTypeById,
    push,
    t,
    updateFloorPlan,
    isReadOnlyRef,
    planRef,
    setSelectedCorridorDoor,
    setCorridorDoorDraft,
    setCorridorQuickMenu,
    roomDoorDraft,
    setRoomDoorDraft,
    setSelectedRoomDoorId,
    setContextMenu,
    getSharedRoomSides,
    renderPlan
  } = deps;

  const handleCorridorDoorDraftPoint = useCallback(
    (payload: {
      corridorId: string;
      clientX: number;
      clientY: number;
      point: { edgeIndex: number; t: number; x: number; y: number };
    }) =>
      computeHandleCorridorDoorDraftPoint(payload, {
        corridorDoorDraft,
        defaultDoorCatalogId,
        markTouched,
        objectTypeById,
        push,
        t,
        updateFloorPlan,
        isReadOnlyRef,
        planRef,
        setSelectedCorridorDoor,
        setCorridorDoorDraft,
        setCorridorQuickMenu
      }),
    [corridorDoorDraft, defaultDoorCatalogId, markTouched, objectTypeById, push, t, updateFloorPlan]
  );

  const createRoomDoorFromDraft = useCallback(
    (roomId: string, point: { x: number; y: number }) =>
      computeCreateRoomDoorFromDraft(roomId, point, {
        defaultDoorCatalogId,
        markTouched,
        objectTypeById,
        push,
        roomDoorDraft,
        t,
        updateFloorPlan,
        isReadOnlyRef,
        planRef,
        setRoomDoorDraft,
        setSelectedRoomDoorId,
        setContextMenu
      }),
    [defaultDoorCatalogId, markTouched, objectTypeById, push, roomDoorDraft, t, updateFloorPlan]
  );

  const startRoomDoorDraft = useCallback(
    (roomAId: string, roomBId: string) =>
      computeStartRoomDoorDraft(roomAId, roomBId, {
        getSharedRoomSides,
        push,
        renderPlan,
        t,
        isReadOnlyRef,
        setRoomDoorDraft,
        setSelectedRoomDoorId,
        setContextMenu
      }),
    [getSharedRoomSides, push, renderPlan, t]
  );

  return { handleCorridorDoorDraftPoint, createRoomDoorFromDraft, startRoomDoorDraft };
};
