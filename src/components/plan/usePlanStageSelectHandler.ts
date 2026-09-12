/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { computeHandleStageSelect } from './planViewStageHandlers';

// Stage select handler (click selection / link creation / draw-mode dispatch) extracted from
// usePlanView. Body moved verbatim; dep array lists every param (all stable setters/refs/functions
// plus the reactive draw-mode/link state) so exhaustive-deps stays clean.
export const usePlanStageSelectHandler = (deps: any) => {
  const {
    addLink, clearSelection, linkCreateMode, linkFromId, markTouched, panToolActive, push, corridorDrawMode,
    roomDrawMode, setPanToolActive, setSelectedObject, t, toggleSelectedObject, isReadOnlyRef, planRef,
    selectedObjectIdsRef, selectedObjectIdRef, setRoomDrawMode, setNewRoomMenuOpen, setCorridorDrawMode,
    setLinkFromId, setCableModal, setSelectedRoomId, setSelectedRoomIds, setSelectedCorridorId,
    setSelectedCorridorDoor, setSelectedRoomDoorId, setCorridorQuickMenu, setSelectedLinkId, setContextMenu
  } = deps;

  return useCallback(
    (id?: string, options?: { keepContext?: boolean; multi?: boolean }) =>
      computeHandleStageSelect(id, options, {
        addLink,
        clearSelection,
        linkCreateMode,
        linkFromId,
        markTouched,
        panToolActive,
        push,
        corridorDrawMode,
        roomDrawMode,
        setPanToolActive,
        setSelectedObject,
        t,
        toggleSelectedObject,
        isReadOnlyRef,
        planRef,
        selectedObjectIdsRef,
        selectedObjectIdRef,
        setRoomDrawMode,
        setNewRoomMenuOpen,
        setCorridorDrawMode,
        setLinkFromId,
        setCableModal,
        setSelectedRoomId,
        setSelectedRoomIds,
        setSelectedCorridorId,
        setSelectedCorridorDoor,
        setSelectedRoomDoorId,
        setCorridorQuickMenu,
        setSelectedLinkId,
        setContextMenu
      }),
    [
      addLink, clearSelection, linkCreateMode, linkFromId, markTouched, panToolActive, push, corridorDrawMode,
      roomDrawMode, setPanToolActive, setSelectedObject, t, toggleSelectedObject, isReadOnlyRef, planRef,
      selectedObjectIdsRef, selectedObjectIdRef, setRoomDrawMode, setNewRoomMenuOpen, setCorridorDrawMode,
      setLinkFromId, setCableModal, setSelectedRoomId, setSelectedRoomIds, setSelectedCorridorId,
      setSelectedCorridorDoor, setSelectedRoomDoorId, setCorridorQuickMenu, setSelectedLinkId, setContextMenu
    ]
  );
};
