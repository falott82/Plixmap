import { useCallback } from 'react';
import { runOpenCorridorDoorModal, runOpenRoomDoorModal } from './planViewDoorModals';
import { computeOpenCorridorDoorLinkModal, computeSaveCorridorDoorModal, computeSaveCorridorDoorLinkModal } from './planViewCorridorGeometry';

// Corridor/room door modal open + save handlers extracted from usePlanView.
// Each is a thin wrapper delegating to the existing run*/compute* helpers; the
// shared closure deps are injected once here. Bodies are verbatim.
export const usePlanDoorModalHandlers = (deps: any) => {
  const {
    corridorById,
    defaultDoorCatalogId,
    doorTypeIdSet,
    objectTypeById,
    setCorridorDoorModal,
    roomDoors,
    getCorridorEdgePoint,
    normalizeLayerSelection,
    planId,
    renderPlan,
    setHideAllLayers,
    setVisibleLayerIds,
    visibleLayerIds,
    setCorridorDoorLinkModal,
    setCorridorDoorLinkQuery,
    corridorDoorModal,
    corridorDoorLinkModal,
    isReadOnly,
    markTouched,
    plan,
    push,
    t,
    updateFloorPlan
  } = deps;

  const openCorridorDoorModal = useCallback(
    (corridorId: string, doorId: string) => {
      runOpenCorridorDoorModal(corridorId, doorId, { corridorById, defaultDoorCatalogId, doorTypeIdSet, objectTypeById, setCorridorDoorModal });
    },
    [corridorById, defaultDoorCatalogId, doorTypeIdSet, objectTypeById, setCorridorDoorModal]
  );

  const openRoomDoorModal = useCallback(
    (doorId: string) => {
      runOpenRoomDoorModal(doorId, { roomDoors, defaultDoorCatalogId, doorTypeIdSet, objectTypeById, setCorridorDoorModal });
    },
    [defaultDoorCatalogId, doorTypeIdSet, objectTypeById, roomDoors, setCorridorDoorModal]
  );

  const openCorridorDoorLinkModal = useCallback(
    (corridorId: string, doorId: string) =>
      computeOpenCorridorDoorLinkModal(corridorId, doorId, {
        corridorById,
        getCorridorEdgePoint,
        normalizeLayerSelection,
        planId,
        renderPlan,
        setHideAllLayers,
        setVisibleLayerIds,
        visibleLayerIds,
        setCorridorDoorLinkModal,
        setCorridorDoorLinkQuery
      }),
    [
      corridorById,
      getCorridorEdgePoint,
      normalizeLayerSelection,
      planId,
      renderPlan,
      setHideAllLayers,
      setVisibleLayerIds,
      visibleLayerIds,
      setCorridorDoorLinkModal,
      setCorridorDoorLinkQuery
    ]
  );

  const saveCorridorDoorModal = useCallback(() => {
    computeSaveCorridorDoorModal({ corridorDoorModal, isReadOnly, markTouched, plan, push, t, updateFloorPlan, setCorridorDoorModal });
  }, [corridorDoorModal, isReadOnly, markTouched, plan, push, t, updateFloorPlan, setCorridorDoorModal]);

  const saveCorridorDoorLinkModal = useCallback(() => {
    computeSaveCorridorDoorLinkModal({ corridorDoorLinkModal, isReadOnly, markTouched, plan, push, renderPlan, t, updateFloorPlan, setCorridorDoorLinkModal });
  }, [corridorDoorLinkModal, isReadOnly, markTouched, plan, push, renderPlan, t, updateFloorPlan, setCorridorDoorLinkModal]);

  return { openCorridorDoorModal, openRoomDoorModal, openCorridorDoorLinkModal, saveCorridorDoorModal, saveCorridorDoorLinkModal };
};
