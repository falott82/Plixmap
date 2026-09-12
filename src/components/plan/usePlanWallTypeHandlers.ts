import { useCallback } from 'react';
import { computeApplyWallTypeToIds } from './planViewMiscTools';
import { computeCreateRoomWalls } from './planViewRoomGeometry';

// Wall-type handlers extracted from usePlanView (apply a wall type to ids / to
// the modal selection, edit per-segment room-wall types, materialize room walls
// from the room-wall-type modal). Bodies are verbatim; shared deps injected once.
export const usePlanWallTypeHandlers = (deps: any) => {
  const {
    getTypeLabel,
    isReadOnly,
    isWallType,
    markTouched,
    push,
    t,
    updateObject,
    wallTypeModal,
    wallTypeDraft,
    setWallTypeModal,
    setRoomWallTypeSelections,
    roomWallTypeModal,
    roomWallTypeSelections,
    addObject,
    defaultWallTypeId,
    ensureObjectLayerVisible,
    inferDefaultLayerIds,
    layerIdSet,
    renderPlan,
    setRoomWallTypeModal
  } = deps;

  const applyWallTypeToIds = useCallback(
    (ids: string[], typeId: string) =>
      computeApplyWallTypeToIds(ids, typeId, { getTypeLabel, isReadOnly, isWallType, markTouched, push, t, updateObject }),
    [getTypeLabel, isReadOnly, isWallType, markTouched, push, t, updateObject]
  );

  const applyWallType = useCallback(() => {
    if (!wallTypeModal || !wallTypeDraft) return;
    applyWallTypeToIds(wallTypeModal.ids, wallTypeDraft);
    setWallTypeModal(null);
  }, [applyWallTypeToIds, wallTypeDraft, wallTypeModal, setWallTypeModal]);

  const setRoomWallTypeAt = useCallback(
    (index: number, typeId: string) => {
      setRoomWallTypeSelections((prev: string[]) => {
        const next = prev.slice();
        next[index] = typeId;
        return next;
      });
    },
    [setRoomWallTypeSelections]
  );

  const applyRoomWallTypeAll = useCallback(
    (typeId: string) => {
      if (!roomWallTypeModal) return;
      setRoomWallTypeSelections(roomWallTypeModal.segments.map(() => typeId));
    },
    [roomWallTypeModal, setRoomWallTypeSelections]
  );

  const createRoomWalls = useCallback(() => {
    computeCreateRoomWalls({
      addObject,
      defaultWallTypeId,
      ensureObjectLayerVisible,
      getTypeLabel,
      inferDefaultLayerIds,
      isReadOnly,
      layerIdSet,
      markTouched,
      push,
      renderPlan,
      roomWallTypeModal,
      roomWallTypeSelections,
      t,
      updateObject,
      setRoomWallTypeModal
    });
  }, [
    addObject,
    defaultWallTypeId,
    ensureObjectLayerVisible,
    getTypeLabel,
    inferDefaultLayerIds,
    isReadOnly,
    layerIdSet,
    markTouched,
    push,
    renderPlan,
    roomWallTypeModal,
    roomWallTypeSelections,
    t,
    updateObject,
    setRoomWallTypeModal
  ]);

  return { applyWallTypeToIds, applyWallType, setRoomWallTypeAt, applyRoomWallTypeAll, createRoomWalls };
};
