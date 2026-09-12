import { useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import type { FloorPlan } from '../../store/types';
import { TEXT_COLOR_OPTIONS, TEXT_FONT_OPTIONS } from '../../store/data';
import { createPlanDeleteShortcutHandler } from './planKeyboardDeleteShortcuts';
import { createPlanConfirmDeleteShortcutHandler } from './planKeyboardConfirmDeleteShortcuts';
import { createPlanTextShortcutHandler } from './planKeyboardTextShortcuts';
import { createPlanArrowShortcutHandler, createPlanScaleShortcutHandler } from './planKeyboardMoveScaleShortcuts';
import { createPlanCtrlArrowQuoteShortcutHandler, createPlanRotateShortcutHandler } from './planKeyboardTransformShortcuts';
import { createPlanSaveShortcutHandler, createPlanUndoRedoShortcutHandler } from './planKeyboardSaveHistoryShortcuts';
import { createPlanEscapeSelectionShortcutHandler, createPlanSelectAllShortcutHandler } from './planKeyboardSelectionShortcuts';
import { createPlanBlockingUiShortcutHandler, createPlanDraftCancelShortcutHandler } from './planKeyboardUiShortcuts';
import { createPlanDrawingShortcutHandler } from './planKeyboardDrawingShortcuts';

const TEXT_FONT_VALUES = TEXT_FONT_OPTIONS.map((opt) => opt.value);
const TEXT_COLOR_VALUES = TEXT_COLOR_OPTIONS.map((opt) => opt.value);

// Feature-hook extraction of usePlanView's keyboard-shortcut handler memos. The 14 run*Shortcut
// useMemos (plus their 3 helper callbacks captureEntrySnapshot/getLastInserted/clearLastInserted)
// are moved here VERBATIM, including their dependency arrays. usePlanView calls usePlanShortcuts
// and destructures the returned handlers; they are consumed only by the (already-extracted) global
// keydown effect, so no use-before-declaration arises. Behaviour is identical.

export type PlanShortcutsDeps = {
  entrySnapshotRef: MutableRefObject<any>;
  lastInsertedRef: MutableRefObject<any>;
  measureClosedRef: MutableRefObject<any>;
  measureFinishedRef: MutableRefObject<any>;
  measurePointsRef: MutableRefObject<any>;
  planRef: MutableRefObject<any>;
  wallDraftPointsRef: MutableRefObject<any>;
  wallDraftSegmentIdsRef: MutableRefObject<any>;
  addRevision: any;
  cancelScaleMode: any;
  clearSelection: any;
  convertMeasurementToQuotes: any;
  deleteLink: any;
  deleteObject: any;
  finishWallDraw: any;
  getLatestRevisionCached: any;
  getPlanSnapshot: any;
  getPlanUnsavedChanges: any;
  getQuoteOrientation: any;
  getRevisionVersion: any;
  isCameraType: any;
  isDeskType: any;
  isRackLinkId: any;
  markTouched: any;
  moveObject: any;
  notifyNonPeopleRoomBlocked: any;
  performRedo: any;
  performUndo: any;
  postAuditEvent: any;
  push: any;
  resetTouched: any;
  setConfirmDelete: any;
  setConfirmDeleteCorridorId: any;
  setConfirmDeleteRoomId: any;
  setConfirmDeleteRoomIds: any;
  setContextMenu: any;
  setCorridorConnectionModal: any;
  setCorridorDoorDraft: any;
  setCorridorDoorLinkModal: any;
  setCorridorDoorModal: any;
  setCorridorDrawMode: any;
  setCorridorModal: any;
  setLastObjectScale: any;
  setLastQuoteScale: any;
  setLinkFromId: any;
  setMeasureClosed: any;
  setMeasureFinished: any;
  setMeasurePointer: any;
  setMeasurePoints: any;
  setPendingRoomDeletes: any;
  setQuotePointer: any;
  setQuotePoints: any;
  setRoomDoorDraft: any;
  setRoomDrawMode: any;
  setSaveRevisionModalPreset: any;
  setSaveRevisionOpen: any;
  setSelectedCorridorDoor: any;
  setSelectedCorridorId: any;
  setSelectedLinkId: any;
  setSelectedRoomDoorId: any;
  setSelectedRoomId: any;
  setSelectedRoomIds: any;
  setSelection: any;
  setUndoConfirm: any;
  setWallDraftPointer: any;
  setWallDraftPoints: any;
  showMeasureToast: any;
  startMeasure: any;
  startQuote: any;
  startWallDraw: any;
  stopMeasure: any;
  stopQuote: any;
  t: any;
  updateFloorPlan: any;
  updateObject: any;
  updateQuoteLabelPos: any;
  updateRoom: any;
};

export const usePlanShortcuts = (deps: PlanShortcutsDeps) => {
  const {
    addRevision,
    cancelScaleMode,
    clearSelection,
    convertMeasurementToQuotes,
    deleteLink,
    deleteObject,
    entrySnapshotRef,
    finishWallDraw,
    getLatestRevisionCached,
    getPlanSnapshot,
    getPlanUnsavedChanges,
    getQuoteOrientation,
    getRevisionVersion,
    isCameraType,
    isDeskType,
    isRackLinkId,
    lastInsertedRef,
    markTouched,
    measureClosedRef,
    measureFinishedRef,
    measurePointsRef,
    moveObject,
    notifyNonPeopleRoomBlocked,
    performRedo,
    performUndo,
    planRef,
    postAuditEvent,
    push,
    resetTouched,
    setConfirmDelete,
    setConfirmDeleteCorridorId,
    setConfirmDeleteRoomId,
    setConfirmDeleteRoomIds,
    setContextMenu,
    setCorridorConnectionModal,
    setCorridorDoorDraft,
    setCorridorDoorLinkModal,
    setCorridorDoorModal,
    setCorridorDrawMode,
    setCorridorModal,
    setLastObjectScale,
    setLastQuoteScale,
    setLinkFromId,
    setMeasureClosed,
    setMeasureFinished,
    setMeasurePointer,
    setMeasurePoints,
    setPendingRoomDeletes,
    setQuotePointer,
    setQuotePoints,
    setRoomDoorDraft,
    setRoomDrawMode,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen,
    setSelectedCorridorDoor,
    setSelectedCorridorId,
    setSelectedLinkId,
    setSelectedRoomDoorId,
    setSelectedRoomId,
    setSelectedRoomIds,
    setSelection,
    setUndoConfirm,
    setWallDraftPointer,
    setWallDraftPoints,
    showMeasureToast,
    startMeasure,
    startQuote,
    startWallDraw,
    stopMeasure,
    stopQuote,
    t,
    updateFloorPlan,
    updateObject,
    updateQuoteLabelPos,
    updateRoom,
    wallDraftPointsRef,
    wallDraftSegmentIdsRef
  } = deps;

  const runDeleteShortcut = useMemo(
    () =>
      createPlanDeleteShortcutHandler({
        markTouched,
        updateFloorPlan,
        setSelectedCorridorDoor,
        setSelectedRoomDoorId,
        setConfirmDeleteRoomId,
        setConfirmDeleteRoomIds,
        setConfirmDeleteCorridorId,
        deleteLink,
        postAuditEvent,
        push,
        setSelectedLinkId,
        setPendingRoomDeletes,
        setConfirmDelete,
        isRackLinkId,
        t
      }),
    [
      deleteLink,
      markTouched,
      postAuditEvent,
      push,
      setConfirmDelete,
      setConfirmDeleteCorridorId,
      setConfirmDeleteRoomId,
      setConfirmDeleteRoomIds,
      setPendingRoomDeletes,
      setSelectedCorridorDoor,
      setSelectedLinkId,
      setSelectedRoomDoorId,
      t,
      updateFloorPlan
    ]
  );

  const runTextShortcut = useMemo(
    () =>
      createPlanTextShortcutHandler({
        markTouched,
        updateObject,
        textFontValues: TEXT_FONT_VALUES,
        textColorValues: TEXT_COLOR_VALUES
      }),
    [markTouched, updateObject]
  );

  const runConfirmDeleteShortcut = useMemo(
    () =>
      createPlanConfirmDeleteShortcutHandler({
        deleteObject,
        push,
        setConfirmDelete,
        setContextMenu,
        clearSelection,
        t
      }),
    [clearSelection, deleteObject, push, setConfirmDelete, setContextMenu, t]
  );

  const runScaleShortcut = useMemo(
    () =>
      createPlanScaleShortcutHandler({
        markTouched,
        updateObject,
        updateRoom,
        setLastQuoteScale,
        setLastObjectScale
      }),
    [markTouched, setLastObjectScale, setLastQuoteScale, updateObject, updateRoom]
  );

  const runArrowShortcut = useMemo(
    () =>
      createPlanArrowShortcutHandler({
        markTouched,
        moveObject,
        updateObject,
        updateRoom,
        notifyNonPeopleRoomBlocked
      }),
    [markTouched, moveObject, notifyNonPeopleRoomBlocked, updateObject, updateRoom]
  );

  const runCtrlArrowQuoteShortcut = useMemo(
    () =>
      createPlanCtrlArrowQuoteShortcutHandler({
        markTouched,
        getQuoteOrientation,
        updateQuoteLabelPos
      }),
    [getQuoteOrientation, markTouched, updateQuoteLabelPos]
  );

  const runRotateShortcut = useMemo(
    () =>
      createPlanRotateShortcutHandler({
        markTouched,
        updateObject,
        isDeskType,
        isCameraType
      }),
    [isCameraType, markTouched, updateObject]
  );

  const captureEntrySnapshot = useCallback(
    (fallbackPlan: FloorPlan) => {
      entrySnapshotRef.current = getPlanSnapshot(planRef.current || fallbackPlan);
    },
    [getPlanSnapshot]
  );

  const getLastInserted = useCallback(() => lastInsertedRef.current, []);
  const clearLastInserted = useCallback(() => {
    lastInsertedRef.current = null;
  }, []);

  const runSaveShortcut = useMemo(
    () =>
      createPlanSaveShortcutHandler({
        getPlanUnsavedChanges,
        push,
        t,
        setSaveRevisionModalPreset,
        setSaveRevisionOpen,
        addRevision,
        postAuditEvent,
        resetTouched,
        captureEntrySnapshot,
        getLatestRevisionCached,
        getRevisionVersion
      }),
    [
      addRevision,
      captureEntrySnapshot,
      getLatestRevisionCached,
      getPlanUnsavedChanges,
      postAuditEvent,
      push,
      resetTouched,
      setSaveRevisionModalPreset,
      t
    ]
  );

  const runUndoRedoShortcut = useMemo(
    () =>
      createPlanUndoRedoShortcutHandler({
        performUndo,
        performRedo,
        getLastInserted,
        clearLastInserted,
        setUndoConfirm
      }),
    [clearLastInserted, getLastInserted, performRedo, performUndo, setUndoConfirm]
  );

  const runSelectAllShortcut = useMemo(
    () =>
      createPlanSelectAllShortcutHandler({
        setSelectedCorridorId,
        setSelectedCorridorDoor,
        setSelectedRoomDoorId,
        setSelection,
        setContextMenu,
        setSelectedRoomId,
        setSelectedRoomIds,
        setSelectedLinkId,
        push,
        t
      }),
    [push, setSelection, setSelectedCorridorId, setSelectedCorridorDoor, setSelectedRoomDoorId, t]
  );

  const runEscapeSelectionShortcut = useMemo(
    () =>
      createPlanEscapeSelectionShortcutHandler({
        setContextMenu,
        clearSelection,
        setSelectedRoomId,
        setSelectedRoomIds,
        setSelectedCorridorId,
        setSelectedCorridorDoor,
        setSelectedRoomDoorId,
        setSelectedLinkId
      }),
    [clearSelection, setSelectedCorridorId, setSelectedCorridorDoor, setSelectedRoomDoorId]
  );

  const runBlockingUiShortcut = useMemo(
    () =>
      createPlanBlockingUiShortcutHandler({
        setCorridorDoorLinkModal,
        setCorridorDoorModal,
        setCorridorConnectionModal,
        setCorridorModal
      }),
    [setCorridorConnectionModal, setCorridorDoorLinkModal, setCorridorDoorModal, setCorridorModal]
  );

  const runDraftCancelShortcut = useMemo(
    () =>
      createPlanDraftCancelShortcutHandler({
        setRoomDrawMode,
        setCorridorDrawMode,
        setCorridorDoorDraft,
        setRoomDoorDraft,
        setLinkFromId,
        push,
        t
      }),
    [push, setCorridorDrawMode, setCorridorDoorDraft, setLinkFromId, setRoomDoorDraft, setRoomDrawMode, t]
  );

  const runDrawingShortcut = useMemo(
    () =>
      createPlanDrawingShortcutHandler({
        cancelScaleMode,
        markTouched,
        deleteObject,
        setWallDraftPoints,
        setWallDraftPointer,
        finishWallDraw,
        startWallDraw,
        startMeasure,
        stopMeasure,
        startQuote,
        stopQuote,
        convertMeasurementToQuotes,
        setMeasureClosed,
        setMeasureFinished,
        setMeasurePointer,
        setMeasurePoints,
        showMeasureToast,
        setQuotePoints,
        setQuotePointer,
        wallDraftSegmentIdsRef,
        wallDraftPointsRef,
        measureClosedRef,
        measureFinishedRef,
        measurePointsRef
      }),
    [
      cancelScaleMode,
      convertMeasurementToQuotes,
      deleteObject,
      finishWallDraw,
      markTouched,
      setMeasureClosed,
      setMeasureFinished,
      setMeasurePoints,
      showMeasureToast,
      startMeasure,
      startQuote,
      startWallDraw,
      stopMeasure,
      stopQuote
    ]
  );

  return {
    runDeleteShortcut,
    runTextShortcut,
    runConfirmDeleteShortcut,
    runScaleShortcut,
    runArrowShortcut,
    runCtrlArrowQuoteShortcut,
    runRotateShortcut,
    runSaveShortcut,
    runUndoRedoShortcut,
    runSelectAllShortcut,
    runEscapeSelectionShortcut,
    runBlockingUiShortcut,
    runDraftCancelShortcut,
    runDrawingShortcut
  };
};
