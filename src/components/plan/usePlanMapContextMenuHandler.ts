/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { computeHandleMapContextMenu } from './planViewStageHandlers';

// Map context-menu handler (resolves what was right-clicked — room door draft / corridor / room /
// link — and opens the appropriate context menu) extracted from usePlanView. Body + dep array
// moved verbatim.
export const usePlanMapContextMenuHandler = (deps: any) => {
  const {
    clearSelection, createRoomDoorFromDraft, dismissSelectionHintToasts, effectiveVisibleLayerIds, push,
    renderPlan, roomDoorDraft, t, toolMode, zoom, getCorridorIdAt, getRoomIdAt, roomLayerNoticeRef,
    setSelectedRoomDoorId, setSelectedCorridorDoor, setSelectedCorridorId, setSelectedLinkId,
    setSelectedRoomId, setSelectedRoomIds, setContextMenu
  } = deps;

  return useCallback(
    (payload: { clientX: number; clientY: number; worldX: number; worldY: number }) =>
      computeHandleMapContextMenu(payload, {
        clearSelection,
        createRoomDoorFromDraft,
        dismissSelectionHintToasts,
        effectiveVisibleLayerIds,
        push,
        renderPlan,
        roomDoorDraft,
        t,
        toolMode,
        zoom,
        getCorridorIdAt,
        getRoomIdAt,
        roomLayerNoticeRef,
        setSelectedRoomDoorId,
        setSelectedCorridorDoor,
        setSelectedCorridorId,
        setSelectedLinkId,
        setSelectedRoomId,
        setSelectedRoomIds,
        setContextMenu
      }),
    [
      clearSelection,
      createRoomDoorFromDraft,
      dismissSelectionHintToasts,
      effectiveVisibleLayerIds,
      push,
      renderPlan,
      roomDoorDraft,
      setSelectedRoomDoorId,
      setSelectedCorridorDoor,
      setSelectedCorridorId,
      setSelectedLinkId,
      setSelectedRoomId,
      setSelectedRoomIds,
      t,
      toolMode,
      zoom,
      getCorridorIdAt,
      getRoomIdAt,
      roomLayerNoticeRef,
      setContextMenu
    ]
  );
};
