import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { FloorPlan, MapObject, MapObjectType, RoomConnectionDoor } from '../../store/types';
import type { useT } from '../../i18n/useT';
import {
  runMultiSelectionToastEffect,
  runDeskSelectionToastEffect,
  runQuoteSelectionToastEffect,
  runMediaSelectionToastEffect,
  runObjectSelectionToastEffect,
  type RenderKeybindToast,
  type SelectionHintToastIds
} from './planViewSelectionToasts';
import type { PlanContextMenuState } from './usePlanContextDerived';

type QuickMenuState = { id: string; x: number; y: number; world: { x: number; y: number } };

export type UsePlanSelectionMenuEffectsDeps = {
  planRef: MutableRefObject<FloorPlan | undefined>;
  renderPlan: FloorPlan | undefined;
  selectedObjectIdRef: MutableRefObject<string | undefined>;
  selectedObjectId: string | undefined;
  selectedObjectIdsRef: MutableRefObject<string[]>;
  selectedObjectIds: string[];
  contextMenu: PlanContextMenuState;
  renderKeybindToast: RenderKeybindToast;
  selectionHintToastIds: SelectionHintToastIds;
  multiToastKeyRef: MutableRefObject<string>;
  multiToastIdRef: MutableRefObject<string | number | null>;
  selectedSingleObject: MapObject | undefined;
  isDeskType: (type: MapObjectType) => boolean;
  deskToastKeyRef: MutableRefObject<string>;
  deskToastIdRef: MutableRefObject<string | number | null>;
  quoteToastKeyRef: MutableRefObject<string>;
  quoteToastIdRef: MutableRefObject<string | number | null>;
  mediaToastKeyRef: MutableRefObject<string>;
  mediaToastIdRef: MutableRefObject<string | number | null>;
  getTypeLabel: (type: string) => string;
  t: ReturnType<typeof useT>;
  selectionToastKeyRef: MutableRefObject<string>;
  selectionToastIdRef: MutableRefObject<string | number | null>;
  selectedLinkIdRef: MutableRefObject<string | null>;
  selectedLinkId: string | null;
  internalMapOpen: boolean;
  dismissSelectionHintToasts: () => void;
  selectedRoomIdRef: MutableRefObject<string | undefined>;
  selectedRoomId: string | undefined;
  selectedCorridorDoor: { corridorId: string; doorId: string } | null;
  selectedCorridorId: string | undefined;
  setSelectedCorridorDoor: Dispatch<SetStateAction<{ corridorId: string; doorId: string } | null>>;
  selectedRoomDoorId: string | null;
  setSelectedRoomDoorId: Dispatch<SetStateAction<string | null>>;
  confirmDeleteRef: MutableRefObject<string[] | null>;
  confirmDelete: string[] | null;
  pendingRoomDeletesRef: MutableRefObject<string[]>;
  pendingRoomDeletes: string[];
  wallQuickMenu: QuickMenuState | null;
  setWallQuickMenu: Dispatch<SetStateAction<QuickMenuState | null>>;
  setWallTypeMenu: Dispatch<SetStateAction<{ ids: string[]; x: number; y: number } | null>>;
  corridorQuickMenu: QuickMenuState | null;
  setCorridorQuickMenu: Dispatch<SetStateAction<QuickMenuState | null>>;
  setAlignMenuOpen: Dispatch<SetStateAction<boolean>>;
  setLayersContextMenu: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setMapSubmenu: Dispatch<SetStateAction<null | 'view' | 'measure' | 'create' | 'print' | 'manage'>>;
  toolMode: 'scale' | 'wall' | 'quote' | 'measure' | null;
};

export function usePlanSelectionMenuEffects(deps: UsePlanSelectionMenuEffectsDeps) {
  const {
    planRef,
    renderPlan,
    selectedObjectIdRef,
    selectedObjectId,
    selectedObjectIdsRef,
    selectedObjectIds,
    contextMenu,
    renderKeybindToast,
    selectionHintToastIds,
    multiToastKeyRef,
    multiToastIdRef,
    selectedSingleObject,
    isDeskType,
    deskToastKeyRef,
    deskToastIdRef,
    quoteToastKeyRef,
    quoteToastIdRef,
    mediaToastKeyRef,
    mediaToastIdRef,
    getTypeLabel,
    t,
    selectionToastKeyRef,
    selectionToastIdRef,
    selectedLinkIdRef,
    selectedLinkId,
    internalMapOpen,
    dismissSelectionHintToasts,
    selectedRoomIdRef,
    selectedRoomId,
    selectedCorridorDoor,
    selectedCorridorId,
    setSelectedCorridorDoor,
    selectedRoomDoorId,
    setSelectedRoomDoorId,
    confirmDeleteRef,
    confirmDelete,
    pendingRoomDeletesRef,
    pendingRoomDeletes,
    wallQuickMenu,
    setWallQuickMenu,
    setWallTypeMenu,
    corridorQuickMenu,
    setCorridorQuickMenu,
    setAlignMenuOpen,
    setLayersContextMenu,
    setMapSubmenu,
    toolMode
  } = deps;

  useEffect(() => {
    planRef.current = renderPlan;
  }, [renderPlan]);
  useEffect(() => {
    selectedObjectIdRef.current = selectedObjectId;
  }, [selectedObjectId]);
  useEffect(() => {
    selectedObjectIdsRef.current = selectedObjectIds;
  }, [selectedObjectIds]);
  useEffect(() => runMultiSelectionToastEffect({
    contextMenu, renderPlan, selectedObjectIds, renderKeybindToast, selectionHintToastIds,
    multiToastKeyRef, multiToastIdRef
  }), [contextMenu, renderKeybindToast, renderPlan, selectedObjectIds]);
  useEffect(() => runDeskSelectionToastEffect({
    contextMenu, renderPlan, selectedObjectIds, selectedSingleObject, isDeskType, renderKeybindToast,
    selectionHintToastIds, deskToastKeyRef, deskToastIdRef
  }), [contextMenu, isDeskType, renderKeybindToast, renderPlan, selectedObjectIds, selectedSingleObject]);
  useEffect(() => runQuoteSelectionToastEffect({
    contextMenu, renderPlan, selectedObjectIds, selectedSingleObject, renderKeybindToast,
    selectionHintToastIds, quoteToastKeyRef, quoteToastIdRef
  }), [contextMenu, renderKeybindToast, renderPlan, selectedObjectIds, selectedSingleObject]);
  useEffect(() => runMediaSelectionToastEffect({
    contextMenu, renderPlan, selectedObjectIds, selectedSingleObject, renderKeybindToast,
    selectionHintToastIds, mediaToastKeyRef, mediaToastIdRef
  }), [contextMenu, renderKeybindToast, renderPlan, selectedObjectIds, selectedSingleObject]);
  useEffect(() => runObjectSelectionToastEffect({
    contextMenu, renderPlan, selectedObjectIds, selectedSingleObject, isDeskType, getTypeLabel, t,
    renderKeybindToast, selectionHintToastIds, selectionToastKeyRef, selectionToastIdRef
  }), [contextMenu, getTypeLabel, renderKeybindToast, renderPlan, selectedObjectIds, selectedSingleObject, t]);
  useEffect(() => {
    selectedLinkIdRef.current = selectedLinkId;
  }, [selectedLinkId]);
  useEffect(() => {
    if (!internalMapOpen) return;
    dismissSelectionHintToasts();
  }, [dismissSelectionHintToasts, internalMapOpen]);
  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);
  useEffect(() => {
    if (!selectedCorridorDoor) return;
    if (selectedCorridorId && selectedCorridorDoor.corridorId !== selectedCorridorId) {
      setSelectedCorridorDoor(null);
    }
  }, [selectedCorridorDoor, selectedCorridorId]);
  useEffect(() => {
    if (!selectedRoomDoorId) return;
    const currentRoomDoors = Array.isArray(renderPlan?.roomDoors) ? ((renderPlan?.roomDoors as RoomConnectionDoor[]).filter(Boolean)) : [];
    const exists = currentRoomDoors.some((door) => door.id === selectedRoomDoorId);
    if (!exists) setSelectedRoomDoorId(null);
  }, [renderPlan, selectedRoomDoorId]);
  useEffect(() => {
    confirmDeleteRef.current = confirmDelete;
  }, [confirmDelete]);
  useEffect(() => {
    pendingRoomDeletesRef.current = pendingRoomDeletes;
  }, [pendingRoomDeletes]);

  useEffect(() => {
    if (!wallQuickMenu) return;
    const selectedIds = selectedObjectIds || [];
    const stillSelected =
      selectedObjectId === wallQuickMenu.id || (selectedIds.length ? selectedIds.includes(wallQuickMenu.id) : false);
    if (!stillSelected) setWallQuickMenu(null);
  }, [selectedObjectId, selectedObjectIds, wallQuickMenu]);

  useEffect(() => {
    if (wallQuickMenu) return;
    setWallTypeMenu(null);
  }, [wallQuickMenu]);

  useEffect(() => {
    if (!corridorQuickMenu) return;
    if (selectedCorridorId !== corridorQuickMenu.id) setCorridorQuickMenu(null);
  }, [corridorQuickMenu, selectedCorridorId]);

  useEffect(() => {
    if (!contextMenu) return;
    dismissSelectionHintToasts();
    setWallQuickMenu(null);
    setWallTypeMenu(null);
    setCorridorQuickMenu(null);
    setAlignMenuOpen(false);
    setLayersContextMenu(null);
    if (contextMenu.kind === 'map') {
      setMapSubmenu(null);
    }
  }, [contextMenu, dismissSelectionHintToasts]);

  useEffect(() => {
    if (contextMenu) return;
    setLayersContextMenu(null);
  }, [contextMenu]);

  useEffect(() => {
    if (!toolMode) return;
    setWallQuickMenu(null);
    setWallTypeMenu(null);
    setCorridorQuickMenu(null);
  }, [toolMode]);
}
