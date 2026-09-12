import type { MutableRefObject } from 'react';
import type { FloorPlan, MapObject } from '../../store/types';
import type { useT } from '../../i18n/useT';
import { useUIStore } from '../../store/useUIStore';

// Body-extraction of usePlanView's global keydown useEffect. The handler logic is moved
// verbatim; every value it closed over is passed in via `deps` (which mirror the hook's
// existing dependency array plus the refs it reads). The effect wrapper and its dependency
// array in usePlanView remain unchanged. Returns the effect cleanup.
export type PlanKeydownDeps = {
  confirmDeleteRef: MutableRefObject<string[] | null>;
  selectedObjectIdsRef: MutableRefObject<string[]>;
  planRef: MutableRefObject<FloorPlan | undefined>;
  isReadOnlyRef: MutableRefObject<boolean>;
  selectedObjectIdRef: MutableRefObject<string | undefined>;
  selectedLinkIdRef: MutableRefObject<string | null>;
  selectedRoomIdRef: MutableRefObject<string | undefined>;
  zoomRef: MutableRefObject<number>;
  allTypesOpen: boolean;
  corridorModal: unknown;
  corridorConnectionModal: unknown;
  corridorDoorModal: unknown;
  corridorDoorLinkModal: unknown;
  roomDrawMode: unknown;
  corridorDrawMode: unknown;
  corridorDoorDraft: unknown;
  roomDoorDraft: unknown;
  linkFromId: unknown;
  roomCatalogOpen: boolean;
  scaleMode: unknown;
  wallDrawMode: unknown;
  measureMode: unknown;
  quoteMode: unknown;
  saveRevisionOpen: boolean;
  photoViewer: unknown;
  selectedRoomId: unknown;
  selectedRoomIds: unknown;
  selectedCorridorId: unknown;
  selectedCorridorDoor: unknown;
  selectedRoomDoorId: unknown;
  copySelection: (plan: FloorPlan, ids: string[], isWallType: (t: string) => boolean) => boolean;
  requestPaste: (plan: FloorPlan) => boolean;
  handleEdit: (objectId: string) => void;
  openEditRoom: (roomId: string) => void;
  getRoomIdAt: (...args: any[]) => any;
  resolveRoomAssignmentForObject: (...args: any[]) => any;
  isDeskType: (type: string) => boolean;
  isRackLinkId: (id: string) => boolean;
  isUserType: (type: unknown) => boolean;
  isWallType: (type: string) => boolean;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  setLinkEditId: (id: string | null) => void;
  setContextMenu: (v: any) => void;
  setPendingType: (v: any) => void;
  setRoomDrawMode: (v: any) => void;
  setRoomsOpen: (v: any) => void;
  setNewRoomMenuOpen: (v: any) => void;
  setRoomCatalogOpen: (v: any) => void;
  setCorridorDrawMode: (v: any) => void;
  setAllTypesDefaultTab: (v: any) => void;
  setAllTypesOpen: (v: any) => void;
  runBlockingUiShortcut: (...args: any[]) => boolean;
  runDrawingShortcut: (...args: any[]) => boolean;
  runDraftCancelShortcut: (...args: any[]) => boolean;
  runConfirmDeleteShortcut: (...args: any[]) => boolean;
  runCtrlArrowQuoteShortcut: (...args: any[]) => boolean;
  runRotateShortcut: (...args: any[]) => boolean;
  runSaveShortcut: (...args: any[]) => void;
  runScaleShortcut: (...args: any[]) => boolean;
  runTextShortcut: (...args: any[]) => boolean;
  runUndoRedoShortcut: (...args: any[]) => void;
  runSelectAllShortcut: (...args: any[]) => void;
  runEscapeSelectionShortcut: (...args: any[]) => void;
  runArrowShortcut: (...args: any[]) => boolean;
  runDeleteShortcut: (...args: any[]) => boolean;
};

export const runPlanKeydownEffect = (deps: PlanKeydownDeps): (() => void) => {
  const {
    confirmDeleteRef,
    selectedObjectIdsRef,
    planRef,
    isReadOnlyRef,
    selectedObjectIdRef,
    selectedLinkIdRef,
    selectedRoomIdRef,
    zoomRef,
    allTypesOpen,
    corridorModal,
    corridorConnectionModal,
    corridorDoorModal,
    corridorDoorLinkModal,
    roomDrawMode,
    corridorDrawMode,
    corridorDoorDraft,
    roomDoorDraft,
    linkFromId,
    roomCatalogOpen,
    scaleMode,
    wallDrawMode,
    measureMode,
    quoteMode,
    saveRevisionOpen,
    photoViewer,
    selectedRoomId,
    selectedRoomIds,
    selectedCorridorId,
    selectedCorridorDoor,
    selectedRoomDoorId,
    copySelection,
    requestPaste,
    handleEdit,
    openEditRoom,
    getRoomIdAt,
    resolveRoomAssignmentForObject,
    isDeskType,
    isRackLinkId,
    isUserType,
    isWallType,
    push,
    t,
    setLinkEditId,
    setContextMenu,
    setPendingType,
    setRoomDrawMode,
    setRoomsOpen,
    setNewRoomMenuOpen,
    setRoomCatalogOpen,
    setCorridorDrawMode,
    setAllTypesDefaultTab,
    setAllTypesOpen,
    runBlockingUiShortcut,
    runDrawingShortcut,
    runDraftCancelShortcut,
    runConfirmDeleteShortcut,
    runCtrlArrowQuoteShortcut,
    runRotateShortcut,
    runSaveShortcut,
    runScaleShortcut,
    runTextShortcut,
    runUndoRedoShortcut,
    runSelectAllShortcut,
    runEscapeSelectionShortcut,
    runArrowShortcut,
    runDeleteShortcut
  } = deps;
	    const handler = (e: KeyboardEvent) => {
	      if ((useUIStore.getState() as any)?.clientChatOpen) return;
	      const target = e.target as HTMLElement | null;
	      const tag = target?.tagName?.toLowerCase();
	      const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;

      const currentConfirm = confirmDeleteRef.current;
      const currentSelectedIds = selectedObjectIdsRef.current;
      const currentPlan = planRef.current;
      const currentPlanObjects = (((currentPlan as FloorPlan | null)?.objects || []) as MapObject[]);
      let selectedObjectLookup: Map<string, MapObject> | null = null;
      const getSelectedObjectById = (id: string): MapObject | undefined => {
        if (!currentPlanObjects.length) return undefined;
        if (currentSelectedIds.length >= 6) {
          if (!selectedObjectLookup) {
            selectedObjectLookup = new Map(currentPlanObjects.map((obj) => [obj.id, obj] as const));
          }
          return selectedObjectLookup.get(id);
        }
        return currentPlanObjects.find((obj) => obj.id === id);
      };
      const resolveObjectsByIds = (ids: string[]) =>
        ids.map((id) => getSelectedObjectById(id)).filter((obj): obj is MapObject => !!obj);
      if (runBlockingUiShortcut(
        e,
        !!allTypesOpen,
        corridorModal,
        corridorConnectionModal,
        corridorDoorModal,
        corridorDoorLinkModal
      )) return;
      const isDrawingKey =
        e.key === 'Escape' ||
        e.key === 'Enter' ||
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'm' ||
        e.key === 'M' ||
        e.key === 'q' ||
        e.key === 'Q' ||
        e.key === 'w' ||
        e.key === 'W';
      if (isDrawingKey && runDrawingShortcut(e, isTyping, scaleMode, wallDrawMode, measureMode, quoteMode)) return;

	      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'a') {
	        e.preventDefault();
	        setAllTypesDefaultTab('all');
	        setAllTypesOpen(true);
	        return;
	      }

      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r') {
        if (isReadOnlyRef.current) return;
        e.preventDefault();
        if (roomCatalogOpen) {
          setPendingType(null);
          setRoomDrawMode('rect');
          setRoomsOpen(false);
          setNewRoomMenuOpen(false);
          setContextMenu(null);
          setRoomCatalogOpen(false);
          push(
            t({
              it: 'Disegna un rettangolo sulla mappa per creare una stanza',
              en: 'Draw a rectangle on the map to create a room'
            }),
            'info'
          );
          return;
        }
        setPendingType(null);
        setRoomDrawMode(null);
        setCorridorDrawMode(null);
        setRoomsOpen(false);
        setNewRoomMenuOpen(false);
        setContextMenu(null);
        setRoomCatalogOpen(true);
        push(
          t({
            it: 'Seleziona modalità stanza: premi R per rettangolo o P per poligono.',
            en: 'Select room mode: press R for rectangle or P for polygon.'
          }),
          'info'
        );
        return;
      }

      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && roomCatalogOpen && e.key.toLowerCase() === 'p') {
        if (isReadOnlyRef.current) return;
        e.preventDefault();
        setPendingType(null);
        setRoomDrawMode('poly');
        setRoomsOpen(false);
        setNewRoomMenuOpen(false);
        setContextMenu(null);
        setRoomCatalogOpen(false);
        push(
          t({
            it: 'Clicca più punti per disegnare un poligono. Clicca sul primo punto (o premi Invio) per chiudere.',
            en: 'Click multiple points to draw a polygon. Click the first point (or press Enter) to close.'
          }),
          'info'
        );
        return;
      }

      if (runDraftCancelShortcut(
        e,
        roomDrawMode,
        corridorDrawMode,
        corridorDoorDraft,
        roomDoorDraft,
        linkFromId
      )) return;

      if (runConfirmDeleteShortcut(e, currentConfirm)) return;

      const isCopy = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c';
      if (!isTyping && isCopy) {
        if (!currentPlan) return;
        const didCopy = copySelection(currentPlan as FloorPlan, currentSelectedIds, isWallType);
        if (didCopy) e.preventDefault();
        return;
      }

      const isPaste = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v';
      if (!isTyping && isPaste) {
        if (!currentPlan || isReadOnlyRef.current) return;
        const handled = requestPaste(currentPlan as FloorPlan);
        if (handled) e.preventDefault();
        return;
      }

      const isCmdS = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
      if (isCmdS) {
        runSaveShortcut(e, (currentPlan as FloorPlan) || null, !!isReadOnlyRef.current, saveRevisionOpen);
        return;
      }

      const isArrowLeft = e.key === 'ArrowLeft' || e.code === 'ArrowLeft';
      const isArrowRight = e.key === 'ArrowRight' || e.code === 'ArrowRight';
      const isArrowUp = e.key === 'ArrowUp' || e.code === 'ArrowUp';
      const isArrowDown = e.key === 'ArrowDown' || e.code === 'ArrowDown';
      const isArrow = isArrowUp || isArrowDown || isArrowLeft || isArrowRight;
      const isCtrlArrow = (e.ctrlKey || e.metaKey) && isArrow;
      if (isCtrlArrow && runCtrlArrowQuoteShortcut(
        e,
        (currentPlan as FloorPlan) || null,
        currentSelectedIds,
        selectedObjectIdRef.current,
        !!isReadOnlyRef.current,
        resolveObjectsByIds,
        isArrowLeft,
        isArrowRight,
        isArrowUp,
        isArrowDown
      )) return;
      const isRotateShortcut = (e.ctrlKey || e.metaKey) && (isArrowLeft || isArrowRight);
      if (isRotateShortcut && runRotateShortcut(
        e,
        (currentPlan as FloorPlan) || null,
        currentSelectedIds,
        !!isReadOnlyRef.current,
        resolveObjectsByIds,
        isArrowLeft
      )) return;

      if (isTyping) return;

      const key = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'e') {
        if (!currentPlan || isReadOnlyRef.current) return;
        if (currentSelectedIds.length) {
          if (currentSelectedIds.length !== 1) return;
          const targetId = currentSelectedIds[0];
          const obj = getSelectedObjectById(targetId);
          if (!obj || isDeskType(obj.type)) return;
          e.preventDefault();
          handleEdit(targetId);
          return;
        }
        const linkId = selectedLinkIdRef.current;
        if (linkId && !isRackLinkId(linkId)) {
          e.preventDefault();
          setLinkEditId(linkId);
          return;
        }
        const roomId = selectedRoomIdRef.current;
        if (roomId) {
          e.preventDefault();
          openEditRoom(roomId);
        }
        return;
      }
      if (runTextShortcut(e, (currentPlan as FloorPlan) || null, currentSelectedIds, !!isReadOnlyRef.current, resolveObjectsByIds)) return;
      const isScaleKey = (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract')
        && !e.ctrlKey
        && !e.metaKey;
      if (isScaleKey && runScaleShortcut(
        e,
        (currentPlan as FloorPlan) || null,
        currentSelectedIds,
        selectedRoomIdRef.current,
        !!isReadOnlyRef.current,
        getSelectedObjectById,
        isWallType
      )) return;

      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isRedo =
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));
      if (isUndo || isRedo) {
        runUndoRedoShortcut(e, (currentPlan as FloorPlan) || null, !!isReadOnlyRef.current, isUndo);
        return;
      }

      const isSelectAllShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a';
      if (isSelectAllShortcut) {
        runSelectAllShortcut(e, (currentPlan as FloorPlan) || null);
        return;
      }

      if (e.key === 'Escape') {
        runEscapeSelectionShortcut(
          e,
          !!photoViewer,
          currentSelectedIds,
          selectedRoomId,
          selectedRoomIds,
          selectedCorridorId,
          selectedCorridorDoor,
          selectedRoomDoorId
        );
        return;
      }

      if (isArrow && runArrowShortcut(
        e,
        (currentPlan as FloorPlan) || null,
        currentSelectedIds,
        selectedRoomIdRef.current,
        !!isReadOnlyRef.current,
        zoomRef.current || 1,
        getSelectedObjectById,
        getRoomIdAt,
        resolveRoomAssignmentForObject,
        isUserType,
        isWallType
      )) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const handledDeleteShortcut = runDeleteShortcut(
          e,
          (currentPlan as FloorPlan) || null,
          currentSelectedIds,
          selectedRoomId,
          selectedRoomIds,
          selectedCorridorId,
          selectedCorridorDoor,
          selectedRoomDoorId,
          selectedLinkIdRef.current,
          !!isReadOnlyRef.current
        );
        if (handledDeleteShortcut) return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
};
