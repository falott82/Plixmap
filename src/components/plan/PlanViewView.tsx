import MeetingManagerOpenPanel from './MeetingManagerOpenPanel';
import RevisionsOpenPanel from './RevisionsOpenPanel';
import CableModalPanel from './CableModalPanel';
import ModalStatePanel from './ModalStatePanel';
import SaveRevisionOpenPanel from './SaveRevisionOpenPanel';
import { Suspense, lazy } from 'react';


import { currentLocalIsoDay } from '../../utils/localDate';
import { Cog } from 'lucide-react';

import ConfirmDialog from '../ui/ConfirmDialog';
import { FloorPlan, Room } from '../../store/types';

import { useUIStore } from '../../store/useUIStore';

import ChooseDefaultViewModal from './ChooseDefaultViewModal';
import { isDeskType } from './deskTypes';

import { Link } from 'react-router-dom';

import { postAuditEvent } from '../../api/audit';

import { mobileCheckInMeeting } from '../../api/mobile';


import RoomKioskInfoModal from './RoomKioskInfoModal';

const SelectedObjectsModal = lazy(() => import('./SelectedObjectsModal'));
const CrossPlanSearchModal = lazy(() => import('./CrossPlanSearchModal'));
const InternalMapModal = lazy(() => import('./InternalMapModal'));
const EscapeRouteModal = lazy(() => import('./EscapeRouteModal'));
const PhotoViewerModal = lazy(() => import('./PhotoViewerModal'));
const MeetingHubModal = lazy(() => import('./MeetingHubModal'));
const MyMeetingsModal = lazy(() => import('./MyMeetingsModal'));
const EmergencyContactsModal = lazy(() => import('../layout/EmergencyContactsModal'));
const RoomAllocationModal = lazy(() => import('./RoomAllocationModal'));
const ViewModal = lazy(() => import('./ViewModal'));
const CapacityDashboardModal = lazy(() => import('./CapacityDashboardModal'));
const RackModal = lazy(() => import('./RackModal'));
const RackPortsModal = lazy(() => import('./RackPortsModal'));
const RealUserPickerModal = lazy(() => import('./RealUserPickerModal'));
const PrintModal = lazy(() => import('./PrintModal'));
const RoomMeasuresModal = lazy(() => import('./RoomMeasuresModal'));
const RoomLayoutExportModal = lazy(() => import('./RoomLayoutExportModal'));
const RoomMeetingDuplicateModal = lazy(() => import('./RoomMeetingDuplicateModal'));
const BulkEditDescriptionModal = lazy(() => import('./BulkEditDescriptionModal'));
const BulkEditSelectionModal = lazy(() => import('./BulkEditSelectionModal'));
const UnlockRequestComposeModal = lazy(() => import('./UnlockRequestComposeModal'));
const AllObjectTypesModal = lazy(() => import('./AllObjectTypesModal'));
const LinksModal = lazy(() => import('./LinksModal'));
const LinkEditModal = lazy(() => import('./LinkEditModal'));
const RealUserDetailsModal = lazy(() => import('./RealUserDetailsModal'));
const MeetingNotesModal = lazy(() => import('../meetings/MeetingNotesModal'));
import { usePlanView } from './usePlanView';

import PlanHeaderBar from './PlanHeaderBar';
import PlanCanvasRegion from './PlanCanvasRegion';
import RoomModalContainer from './RoomModalContainer';
import ContextMenuPanel from './ContextMenuPanel';
import { PlanTypeMenu } from './PlanTypeMenu';
import { PlanWallQuickMenu } from './PlanWallQuickMenu';
import { PlanCorridorQuickMenu } from './PlanCorridorQuickMenu';
import { PlanLayersQuickMenu } from './PlanLayersQuickMenu';
import { PlanWallTypeMenu } from './PlanWallTypeMenu';
import { PlanWallTypeModal } from './PlanWallTypeModal';
import { PlanRoomWallTypeModal } from './PlanRoomWallTypeModal';
import { PlanTypeLayerModal } from './PlanTypeLayerModal';
import { PlanRealUserImportMissingModal } from './PlanRealUserImportMissingModal';
import { PlanRoomCatalogModal } from './PlanRoomCatalogModal';
import { PlanWallCatalogModal } from './PlanWallCatalogModal';
import { PlanCorridorModal } from './PlanCorridorModal';
import { PlanCorridorConnectionModal } from './PlanCorridorConnectionModal';
import { PlanCorridorDoorModal } from './PlanCorridorDoorModal';
import { PlanCorridorDoorLinkModal } from './PlanCorridorDoorLinkModal';
import { PlanScaleActionsModal } from './PlanScaleActionsModal';
import { PlanUnlockPromptModal } from './PlanUnlockPromptModal';
import { PlanUnlockGrantedPromptModal } from './PlanUnlockGrantedPromptModal';
import { PlanForceUnlockConfigModal } from './PlanForceUnlockConfigModal';
import { PlanForceUnlockActiveModal } from './PlanForceUnlockActiveModal';
import { PlanForceUnlockIncomingModal } from './PlanForceUnlockIncomingModal';
import { PlanRoomMeetingDeleteModal } from './PlanRoomMeetingDeleteModal';
import { PlanRoomMeetingsTimelineModal } from './PlanRoomMeetingsTimelineModal';
import { PlanRoomMeetingBookingDetailModal } from './PlanRoomMeetingBookingDetailModal';
import { PlanScaleModal } from './PlanScaleModal';
import { PlanPlacementConfirmDialogs } from './PlanPlacementConfirmDialogs';

type ViewProps = ReturnType<typeof usePlanView>;

const PlanViewView = (props: ViewProps) => {
  const {
    activeRevision,
    addLink,
    addObject,
    addRackLink,
    addRevision,
    addRoom,
    addTimelineMeetingManualParticipant,
    addTimelineMeetingRealParticipant,
    addTypeToPalette,
    adjustRoomMeetingEditEndTime,
    alignMenuOpen,
    alignSelection,
    allClients,
    allItemsLabel,
    allItemsSelected,
    allTypesDefaultTab,
    allTypesOpen,
    annotationsOpen,
    applyRoomLayoutExportToSelection,
    applyRoomWallTypeAll,
    applyScale,
    applyView,
    applyWallType,
    applyWallTypeToIds,
    assignedCounts,
    autoFitEnabled,
    basePlan,
    beginCorridorPolyDraw,
    beginRoomDraw,
    beginRoomPolyDraw,
    bulkEditOpen,
    bulkEditSelectionOpen,
    cableModal,
    canEditWallType,
    canManageLayers,
    canManageMeetingScheduling,
    canOpenBusinessPartnersDirectory,
    canRedo,
    canUndo,
    canUseMeetingNotes,
    cancelPaste,
    cancelScaleMode,
    canvasPlan,
    canvasStageRef,
    capacityConfirm,
    capacityConfirmRef,
    capacityDashboardOpen,
    capacityDashboardPreset,
    chooseDefaultModal,
    clearObjects,
    clearPendingPostSaveAction,
    clearPendingSaveNavigate,
    clearRevisions,
    clearRoomLayoutExportSelection,
    clearScaleConfirmOpen,
    clearScaleNow,
    clearSelection,
    client,
    clientBusinessPartnerNames,
    closeMyMeetingsModal,
    closeReturnToSelectionList,
    closeRoomLayoutExportModal,
    closeRoomMeetingBookingDetail,
    closeRoomMeetingEditParticipantsModal,
    closeRoomMeetingsTimelineModal,
    closeScaleModal,
    computeRoomReassignments,
    computeRoomSurfaceSqm,
    confirmClearObjects,
    confirmDelete,
    confirmDeleteCorridorId,
    confirmDeleteRoomId,
    confirmDeleteRoomIds,
    confirmDeleteRoomMeetingBooking,
    confirmDeleteViewId,
    confirmPaste,
    confirmSetDefaultViewId,
    contextAssemblyMapsUrl,
    contextIsAssemblyPoint,
    contextIsCamera,
    contextIsDesk,
    contextIsMulti,
    contextIsPhoto,
    contextIsQuote,
    contextIsRack,
    contextIsText,
    contextIsWall,
    contextIsWifi,
    contextLink,
    contextMenu,
    contextMenuRef,
    contextObject,
    contextObjectLinkCount,
    contextObjectTypeLabel,
    contextPhotoMulti,
    contextQuoteLabelPos,
    contextQuoteOrientation,
    contextWallPolygon,
    contextWifiBaseAreaSqm,
    contextWifiBaseDiameterM,
    contextWifiBaseRadiusM,
    contextWifiEffectiveAreaSqm,
    contextWifiEffectiveDiameterM,
    contextWifiEffectiveRadiusM,
    contextWifiRangeOn,
    contextWifiRangeScale,
    corridorById,
    corridorConnectionModal,
    corridorConnectionTargetPlans,
    corridorDoorDraft,
    corridorDoorLinkModal,
    corridorDoorLinkQuery,
    corridorDoorLinkRoomEntries,
    corridorDoorModal,
    corridorDrawMode,
    corridorModal,
    corridorNameEnInput,
    corridorNameInput,
    corridorNameInputRef,
    corridorQuickMenu,
    corridorShowNameInput,
    counts,
    countsOpen,
    createRoomDoorFromDraft,
    createRoomWalls,
    crossPlanResults,
    crossPlanSearchOpen,
    crossPlanSearchTerm,
    defaultObjectScale,
    defaultWallTypeId,
    deleteLink,
    deleteObject,
    deleteRackLink,
    deleteRevision,
    deleteRoom,
    deleteView,
    deskCatalogDefs,
    deskCatalogOpen,
    deskPaletteDefs,
    deskPaletteOrder,
    desksOpen,
    dismissSelectionHintToasts,
    dispatchOpenClientMeetingsTimeline,
    dragStartRef,
    effectiveVisibleLayerIds,
    emergencyContactsOpen,
    ensureObjectLayerVisible,
    entrySnapshotRef,
    escapeRouteModal,
    executeForceUnlock,
    expandedRoomId,
    expandedType,
    exportModalOpen,
    extendRoomMeetingBooking,
    focusPhotoFromGallery,
    forceUnlockActive,
    forceUnlockActiveFocusRef,
    forceUnlockConfig,
    forceUnlockGraceMinutes,
    forceUnlockIncoming,
    forceUnlockIncomingFocusRef,
    forceUnlockStarting,
    forceUnlockTick,
    formatMinutes,
    formatPresenceDate,
    formatPresenceLock,
    getCorridorPolygon,
    getLayerIdsForType,
    getLayerLabel,
    getLayerNote,
    getMeetingCheckInStats,
    getObjectNameById,
    getObjectToastLabel,
    getPlanSnapshot,
    getRoomIdAt,
    getRoomMeetingCheckInEntries,
    getSubmenuStyle,
    getTypeIcon,
    getTypeLabel,
    goToDefaultView,
    grantRemainingMinutes,
    gridMenuOpen,
    gridMenuRef,
    gridSize,
    gridSnapEnabled,
    handleCorridorConnectionContextMenu,
    handleCorridorContextMenu,
    handleCorridorDoorContextMenu,
    handleCorridorDoorDraftPoint,
    handleCorridorQuickMenu,
    handleCreate,
    handleCreateCorridorFromPoly,
    handleCreateRoomFromPoly,
    handleCreateRoomFromRect,
    handleCreateTypeLayer,
    handleCreateWallsForRoom,
    handleDeleteType,
    handleEdit,
    handleLinkContextMenu,
    handleMapContextMenu,
    handleMapMouseDown,
    handleMapMouseMove,
    handleObjectContextMenu,
    handleOpenTypeLayer,
    handleOverwriteView,
    handlePanChange,
    handlePlaceNew,
    handleRackPortsNote,
    handleRackPortsRename,
    handleRoomContextMenu,
    handleRoomDoorContextMenu,
    handleSafetyCardChange,
    handleSafetyCardContextMenu,
    handleSaveView,
    handleScaleContextMenu,
    handleScaleDoubleClick,
    handleScaleMove,
    handleSearch,
    handleSearchEnter,
    handleSelectType,
    handleStageMove,
    handleStageMoveStart,
    handleStageSelect,
    handleTogglePresentation,
    handleToolDoubleClick,
    handleToolMove,
    handleToolPoint,
    handleUnlockResponse,
    handleUpdate,
    handleWallDraftContextMenu,
    handleWallMove,
    handleWallQuickMenu,
    handleWallSegmentDblClick,
    handleZoomChange,
    hasAnyRevision,
    hasDefaultView,
    hasNavigationEdits,
    hasRoomOverlap,
    hasUnsavedUi,
    hideAllLayers,
    highlight,
    highlightRoom,
    hmToMinutes,
    insertCorridorJunctionPoint,
    internalMapOpen,
    isPointInRoom,
    isReadOnly,
    isSuperAdmin,
    isUserObject,
    isWallType,
    jumpToTimelineMeetingFromSearch,
    lang,
    lastInsertedRef,
    lastQuoteColor,
    latestRev,
    layerIds,
    layerRevealPrompt,
    layersContextMenu,
    layersContextMenuRef,
    layersOpen,
    layersPopoverOpen,
    layersPopoverRef,
    layersQuickMenu,
    layersQuickMenuRef,
    linkCreateHint,
    linkEditId,
    linksInSelection,
    linksModalObjectId,
    linksModalObjectName,
    linksModalRows,
    lockActiveTitle,
    lockAvailable,
    lockInfoOpen,
    lockInfoRef,
    lockRequired,
    lockState,
    lockedByOther,
    lockedByTitle,
    mapRef,
    mapSubmenu,
    markTouched,
    measureAreaLabel,
    measureClosed,
    measureLabel,
    measurePointer,
    measurePoints,
    meetingCheckInEntryKey,
    meetingClockFromTs,
    meetingHubFocusRef,
    meetingHubModalOpen,
    meetingIsoDayFromTs,
    meetingLocationLabels,
    meetingManagerOpen,
    meetingManagerPreset,
    meetingStatusByRoomId,
    metersPerPixel,
    modalInitials,
    modalState,
    monthAnchorFromIso,
    moveObject,
    myMeetingsCheckInBusyId,
    myMeetingsCheckInDoneById,
    myMeetingsFiltered,
    myMeetingsFocusRef,
    myMeetingsModal,
    myMeetingsRestoreRef,
    myMeetingsSearch,
    navigate,
    newRoomMenuOpen,
    normalizeLayerSelection,
    notifyNonPeopleRoomBlocked,
    notifyRoomOverlap,
    objectListMatches,
    objectListQuery,
    objectTypeDefs,
    objectTypeIcons,
    objectTypeLabels,
    objectsByType,
    objectsOpen,
    openCorridorConnectionModalAt,
    openCorridorDoorLinkModal,
    openCorridorDoorModal,
    openDuplicate,
    openEditCorridor,
    openEditCorridorConnectionModal,
    openEditFromSelectionList,
    openEditRoom,
    openEscapeRouteAt,
    openImageViewer,
    openLinkEditFromSelectionList,
    openMeetingManager,
    openMyMeetingsFromHub,
    openPhotoViewer,
    openRackLinkPorts,
    openRoomDoorModal,
    openRoomMeetingBookingDetail,
    openRoomMeetingDuplicateModal,
    openRoomMeetingEditParticipantsModal,
    openRoomMeetingsTimeline,
    openRoomWallTypes,
    openScaleEdit,
    openSchedulingFromHub,
    openUnlockCompose,
    openWallGroupModal,
    orderedPlanLayers,
    orderedViews,
    otherPaletteDefs,
    overlapNotice,
    paletteHasCustom,
    paletteHasMore,
    paletteIsEmpty,
    paletteOrder,
    paletteSettingsSection,
    pan,
    panToolActive,
    pasteConfirm,
    pendingClientMeetingsPreset,
    pendingMeetingManagerPreset,
    pendingNavigateRef,
    pendingPostSaveAction,
    pendingRoomDeletesRef,
    pendingType,
    perfEnabled,
    performPendingPostSaveAction,
    performRedo,
    performUndo,
    photoViewer,
    plan,
    planAccess,
    planId,
    planLayers,
    planPhotoIds,
    planRef,
    planScale,
    presenceCount,
    presenceEntries,
    presenceOpen,
    presenceRef,
    presentationMode,
    printAreaMode,
    proceedPlaceUser,
    promptDeleteRoomMeetingBooking,
    promptRevealForObject,
    push,
    pushStack,
    quoteDraftLabel,
    quoteLabels,
    quotePointer,
    quotePoints,
    rackModal,
    rackOverlayById,
    rackPortsLink,
    rackPortsLinkItem,
    realUserDetails,
    realUserDetailsId,
    realUserDetailsName,
    realUserImportMissing,
    realUserPicker,
    reloadMyMeetings,
    reloadRoomMeetingsTimeline,
    removeTimelineMeetingParticipant,
    removeTypeFromPalette,
    renderPlan,
    renderPlanObjectById,
    requestClearScale,
    requestPlanLock,
    requestSaveAndNavigate,
    resetTouched,
    resolveRoomAssignmentForObject,
    restoreMyMeetingsFromSnapshot,
    restoreRevision,
    returnToBulkEditRef,
    returnToSelectionListRef,
    revertUnsavedChanges,
    revisionsOpen,
    roomAllocationOpen,
    roomAllocationPreset,
    roomCatalogOpen,
    roomDepartmentConfirm,
    roomDepartmentOptions,
    roomDoorDraft,
    roomDoors,
    roomDrawMode,
    roomHasWalls,
    roomKioskInfoLink,
    roomKioskInfoModal,
    roomKioskInfoQrDataUrl,
    roomLayoutExportModal,
    roomLayoutExportRows,
    roomLayoutExportSource,
    roomMeasuresData,
    roomMeasuresModal,
    roomMeetingCheckInListOpen,
    roomMeetingDeleteModal,
    roomMeetingDetailFocusRef,
    roomMeetingDuplicateModal,
    roomMeetingDuplicateRoomPickerOpen,
    roomMeetingDuplicateRoomPickerRef,
    roomMeetingEditBusinessPartnersModalOpen,
    roomMeetingEditManualCompanyIsOther,
    roomMeetingEditParticipantCandidates,
    roomMeetingEditParticipantsCloseGuardUntilRef,
    roomMeetingEditParticipantsModalOpen,
    roomMeetingEditParticipantsNameInputRef,
    roomMeetingExtendBusyId,
    roomMeetingNotesModalBooking,
    roomMeetingNotesModalState,
    roomMeetingNotesReturnToMyMeetings,
    roomMeetingTimelineContextMenu,
    roomMeetingTimelineContextMenuRef,
    roomMeetingsTimelineBookingDetail,
    roomMeetingsTimelineDetailCloseGuardUntilRef,
    roomMeetingsTimelineHighlightBookingId,
    roomMeetingsTimelineModal,
    roomMeetingsTimelineScrollRef,
    roomMeetingsTimelineSearchActiveIndex,
    roomMeetingsTimelineSearchError,
    roomMeetingsTimelineSearchInputRef,
    roomMeetingsTimelineSearchLoading,
    roomMeetingsTimelineSearchResults,
    roomMeetingsTimelineSearchTerm,
    roomModal,
    roomModalBaseRoom,
    roomModalInitialSurfaceSqm,
    roomModalMetrics,
    roomModalPreview,
    roomStatsById,
    roomWallPreview,
    roomWallPrompt,
    roomWallTypeAllValue,
    roomWallTypeModal,
    roomWallTypeSelections,
    rooms,
    roomsOpen,
    safetyCardColorIndex,
    safetyCardFontIndex,
    safetyCardFontSize,
    safetyCardPos,
    safetyCardSize,
    safetyCardTextBgIndex,
    safetyEmergencyContacts,
    safetyNumbersInline,
    safetyPointsInline,
    saveCorridorConnectionModal,
    saveCorridorDoorLinkModal,
    saveCorridorDoorModal,
    saveCorridorModal,
    saveRevisionModalPreset,
    saveRevisionOpen,
    saveRevisionReason,
    saveRoomMeetingBookingEdit,
    saveRoomMeetingDuplicates,
    scaleActionsOpen,
    scaleDraft,
    scaleDraftPointer,
    scaleLabel,
    scaleLine,
    scaleMetersInput,
    scaleModal,
    scaleMode,
    scalePromptDismissed,
    searchInputRef,
    searchResultsObjects,
    searchResultsOpen,
    searchResultsRooms,
    searchResultsTerm,
    securityLayerVisible,
    securityOpen,
    securityPaletteDefs,
    selectAllRoomLayoutExportRows,
    selectedCorridorDoor,
    selectedCorridorId,
    selectedLinkId,
    selectedObjectId,
    selectedObjectIds,
    selectedObjects,
    selectedObjectsModalOpen,
    selectedRevisionId,
    selectedRoomDoorId,
    selectedRoomId,
    selectedRoomIds,
    selectedViewId,
    selectedWifiIds,
    selectionHasDesk,
    selectionHasPhoto,
    selectionHasRack,
    selectionPhotoIds,
    sendWs,
    setAlignMenuOpen,
    setAllTypesDefaultTab,
    setAllTypesOpen,
    setAnnotationsOpen,
    setBulkEditOpen,
    setBulkEditSelectionOpen,
    setCableModal,
    setCapacityConfirm,
    setCapacityDashboardOpen,
    setCapacityDashboardPreset,
    setChooseDefaultModal,
    setClearScaleConfirmOpen,
    setConfirmClearObjects,
    setConfirmDelete,
    setConfirmDeleteCorridorId,
    setConfirmDeleteRoomId,
    setConfirmDeleteRoomIds,
    setConfirmDeleteViewId,
    setConfirmSetDefaultViewId,
    setContextMenu,
    setCorridorConnectionModal,
    setCorridorDoorDraft,
    setCorridorDoorLinkModal,
    setCorridorDoorLinkQuery,
    setCorridorDoorModal,
    setCorridorModal,
    setCorridorNameEnInput,
    setCorridorNameInput,
    setCorridorQuickMenu,
    setCorridorShowNameInput,
    setCountsOpen,
    setCrossPlanResults,
    setCrossPlanSearchOpen,
    setCrossPlanSearchTerm,
    setDefaultView,
    setDeskCatalogOpen,
    setDesksOpen,
    setEmergencyContactsOpen,
    setEscapeRouteModal,
    setExpandedRoomId,
    setExpandedType,
    setExportModalOpen,
    setForceUnlockActive,
    setForceUnlockConfig,
    setForceUnlockGraceMinutes,
    setForceUnlockStarting,
    setGridMenuOpen,
    setGridSize,
    setGridSnapEnabled,
    setHideAllLayers,
    setHighlightRoom,
    setInternalMapOpen,
    setLastObjectScale,
    setLastQuoteColor,
    setLastQuoteScale,
    setLayerRevealPrompt,
    setLayersContextMenu,
    setLayersOpen,
    setLayersPopoverOpen,
    setLayersQuickMenu,
    setLinkCreateMode,
    setLinkEditId,
    setLinkFromId,
    setLinksModalObjectId,
    setLockInfoOpen,
    setMeasureMode,
    setMeetingHubModalOpen,
    setMeetingManagerOpen,
    setMeetingManagerPreset,
    setMeetingStatusByRoomId,
    setModalState,
    setMyMeetingsCheckInBusyId,
    setMyMeetingsCheckInDoneById,
    setMyMeetingsModal,
    setMyMeetingsSearch,
    setNewRoomMenuOpen,
    setObjectListQuery,
    setObjectRoomIds,
    setObjectsOpen,
    setOverlapNotice,
    setPaletteSection,
    setPanToolActive,
    setPendingClientMeetingsPreset,
    setPendingMeetingManagerPreset,
    setPendingRoomDeletes,
    setPendingType,
    setPhotoViewer,
    setPresenceOpen,
    setPrintAreaMode,
    setRackModal,
    setRackPortsLink,
    setRealUserDetailsId,
    setRealUserImportMissing,
    setRealUserPicker,
    setRevisionsOpen,
    setRoomAllocationOpen,
    setRoomAllocationPreset,
    setRoomCatalogOpen,
    setRoomDepartmentConfirm,
    setRoomDrawMode,
    setRoomKioskInfoModal,
    setRoomLayoutExportModal,
    setRoomMeasuresModal,
    setRoomMeetingCheckInListOpen,
    setRoomMeetingDeleteModal,
    setRoomMeetingDuplicateModal,
    setRoomMeetingDuplicateRoomPickerOpen,
    setRoomMeetingEditBusinessPartnersModalOpen,
    setRoomMeetingEditManualCompanyIsOther,
    setRoomMeetingNotesModalBooking,
    setRoomMeetingNotesModalState,
    setRoomMeetingNotesReturnToMyMeetings,
    setRoomMeetingTimelineContextMenu,
    setRoomMeetingsTimelineBookingDetail,
    setRoomMeetingsTimelineModal,
    setRoomMeetingsTimelineSearchActiveIndex,
    setRoomMeetingsTimelineSearchError,
    setRoomMeetingsTimelineSearchResults,
    setRoomMeetingsTimelineSearchTerm,
    setRoomModal,
    setRoomWallPrompt,
    setRoomWallTypeAt,
    setRoomWallTypeModal,
    setRoomsOpen,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen,
    setScaleActionsOpen,
    setScaleMetersInput,
    setScaleMode,
    setScalePromptDismissed,
    setSearchResultsObjects,
    setSearchResultsOpen,
    setSearchResultsRooms,
    setSecurityOpen,
    setSelectedCorridorDoor,
    setSelectedCorridorId,
    setSelectedLinkId,
    setSelectedObject,
    setSelectedObjectsModalOpen,
    setSelectedPlan,
    setSelectedRevision,
    setSelectedRoomDoorId,
    setSelectedRoomId,
    setSelectedRoomIds,
    setSelectedViewId,
    setSelection,
    setShowGrid,
    setShowScaleLine,
    setTypeLayerColor,
    setTypeLayerModal,
    setTypeLayerName,
    setTypeMenu,
    setUndoConfirm,
    setUnlockCompose,
    setUnlockGrantedPrompt,
    setUnlockPrompt,
    setViewModalOpen,
    setViewsMenuOpen,
    setVisibleLayerIds,
    setWallCatalogOpen,
    setWallDrawMode,
    setWallQuickMenu,
    setWallTypeDraft,
    setWallTypeMenu,
    setWallTypeModal,
    shiftIsoDay,
    shiftMonthAnchor,
    showGrid,
    showPrintArea,
    site,
    siteFloorPlans,
    skipRoomWallTypesRef,
    sortRoomLayoutExportRows,
    splitWallAtPoint,
    startCorridorDoorDraw,
    startMeasure,
    startQuote,
    startRoomDoorDraft,
    startScaleMode,
    startWallDraw,
    t,
    toggleAllRoomLayoutExportRows,
    toggleMapSubmenu,
    toggleRevisionImmutable,
    toggleRoomLayoutExportRow,
    toggleSecurityCardVisibility,
    toggleShowPrintArea,
    toggleTimelineMeetingParticipantFlag,
    toolMode,
    totalLayerCount,
    triggerHighlight,
    typeLayerColor,
    typeLayerModal,
    typeLayerName,
    typeLayerNameRef,
    typeMenu,
    typeMenuRef,
    undoConfirm,
    unlockBusy,
    unlockCompose,
    unlockGrantedPrompt,
    unlockPrompt,
    updateClient,
    updateCorridorLabelScale,
    updateFloorPlan,
    updateLink,
    updateObject,
    updateQuoteLabelPos,
    updateRoom,
    updateScaleStyle,
    user,
    viewModalOpen,
    viewsMenuOpen,
    visibleLayerCount,
    visibleLayerIds,
    wallAttenuationByType,
    wallCatalogOpen,
    wallDraftPointer,
    wallDraftPoints,
    wallDrawMode,
    wallDrawType,
    wallQuickMenu,
    wallTypeDefs,
    wallTypeDraft,
    wallTypeIdSet,
    wallTypeMenu,
    wallTypeModal,
    zoom
  } = props;

  if (!renderPlan) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-card">
          <p className="text-sm text-slate-600">
            {t({
              it: 'Seleziona o crea una planimetria dalle Impostazioni.',
              en: 'Select or create a floor plan from Settings.'
            })}
          </p>
          <div className="mt-4 flex justify-center">
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              title={t({ it: 'Apri Impostazioni', en: 'Open Settings' })}
            >
              <Cog size={16} />
              {t({ it: 'Impostazioni', en: 'Settings' })}
            </Link>
          </div>
        </div>
      </div>
    );
  }

    return (
	    <div className={`relative flex h-screen flex-col overflow-hidden ${presentationMode ? '' : 'gap-4 p-6'}`}>
	        {/* Presentation mode uses the in-canvas toolbar button (under "VD") + Esc. */}
          <PlanHeaderBar {...{ activeRevision, allItemsLabel, allItemsSelected, applyView, basePlan, beginRoomDraw, beginRoomPolyDraw, canRedo, canUndo, cancelScaleMode, clearSelection, client, counts, countsOpen, dismissSelectionHintToasts, effectiveVisibleLayerIds, expandedRoomId, expandedType, formatMinutes, formatPresenceDate, formatPresenceLock, getLayerNote, getObjectNameById, getTypeIcon, getTypeLabel, grantRemainingMinutes, gridMenuOpen, gridMenuRef, gridSize, gridSnapEnabled, handleEdit, handleOverwriteView, handleSearch, handleSearchEnter, hasUnsavedUi, hideAllLayers, isReadOnly, isSuperAdmin, lang, layerIds, layersPopoverOpen, layersPopoverRef, linksInSelection, lockActiveTitle, lockAvailable, lockInfoOpen, lockInfoRef, lockRequired, lockState, lockedByOther, lockedByTitle, newRoomMenuOpen, normalizeLayerSelection, objectListMatches, objectListQuery, objectsByType, openEditRoom, openUnlockCompose, orderedPlanLayers, orderedViews, performRedo, performUndo, plan, planAccess, planId, planScale, presenceCount, presenceEntries, presenceOpen, presenceRef, presentationMode, promptRevealForObject, push, rackOverlayById, renderPlan, renderPlanObjectById, requestPlanLock, roomDrawMode, roomStatsById, rooms, roomsOpen, scaleMode, searchInputRef, searchResultsObjects, searchResultsOpen, searchResultsRooms, searchResultsTerm, selectedLinkId, selectedObjectId, selectedObjectIds, selectedRoomId, selectedViewId, setCapacityDashboardOpen, setCapacityDashboardPreset, setChooseDefaultModal, setConfirmDelete, setConfirmDeleteRoomId, setConfirmDeleteViewId, setConfirmSetDefaultViewId, setCountsOpen, setExpandedRoomId, setExpandedType, setExportModalOpen, setGridMenuOpen, setGridSize, setGridSnapEnabled, setHideAllLayers, setHighlightRoom, setInternalMapOpen, setLayersPopoverOpen, setLayersQuickMenu, setLinkEditId, setLockInfoOpen, setMeetingHubModalOpen, setNewRoomMenuOpen, setObjectListQuery, setPresenceOpen, setPrintAreaMode, setRevisionsOpen, setRoomAllocationOpen, setRoomAllocationPreset, setRoomDrawMode, setRoomsOpen, setSaveRevisionModalPreset, setSaveRevisionOpen, setSearchResultsObjects, setSearchResultsOpen, setSearchResultsRooms, setSelectedObject, setSelectedObjectsModalOpen, setSelectedRoomId, setSelectedRoomIds, setSelectedViewId, setShowGrid, setShowScaleLine, setTypeMenu, setViewModalOpen, setViewsMenuOpen, setVisibleLayerIds, showGrid, site, startScaleMode, t, totalLayerCount, triggerHighlight, updateFloorPlan, user, viewsMenuOpen, visibleLayerCount }} />

	      <PlanCanvasRegion {...{ allItemsLabel, allItemsSelected, allTypesOpen, annotationsOpen, autoFitEnabled, basePlan, canvasPlan, canvasStageRef, clearSelection, client, computeRoomReassignments, computeRoomSurfaceSqm, corridorDoorDraft, corridorDrawMode, createRoomDoorFromDraft, deskPaletteDefs, deskPaletteOrder, desksOpen, effectiveVisibleLayerIds, getCorridorPolygon, goToDefaultView, gridSize, gridSnapEnabled, handleCorridorConnectionContextMenu, handleCorridorContextMenu, handleCorridorDoorContextMenu, handleCorridorDoorDraftPoint, handleCorridorQuickMenu, handleCreateCorridorFromPoly, handleCreateRoomFromPoly, handleCreateRoomFromRect, handleEdit, handleLinkContextMenu, handleMapContextMenu, handleMapMouseDown, handleMapMouseMove, handleObjectContextMenu, handlePanChange, handlePlaceNew, handleRoomContextMenu, handleRoomDoorContextMenu, handleSafetyCardChange, handleSafetyCardContextMenu, handleScaleContextMenu, handleScaleDoubleClick, handleScaleMove, handleStageMove, handleStageMoveStart, handleStageSelect, handleTogglePresentation, handleToolDoubleClick, handleToolMove, handleToolPoint, handleWallDraftContextMenu, handleWallMove, handleWallQuickMenu, handleWallSegmentDblClick, handleZoomChange, hasDefaultView, hasNavigationEdits, hasRoomOverlap, hideAllLayers, highlight, highlightRoom, insertCorridorJunctionPoint, isReadOnly, isWallType, lang, layerIds, layersOpen, linkCreateHint, mapRef, markTouched, measureAreaLabel, measureClosed, measureLabel, measurePointer, measurePoints, meetingStatusByRoomId, metersPerPixel, navigate, normalizeLayerSelection, notifyRoomOverlap, objectTypeIcons, objectsOpen, openCorridorDoorModal, openEditRoom, openPhotoViewer, openRackLinkPorts, openRoomDoorModal, openRoomMeetingsTimeline, orderedPlanLayers, otherPaletteDefs, paletteHasCustom, paletteHasMore, paletteIsEmpty, paletteOrder, paletteSettingsSection, pan, panToolActive, pendingType, perfEnabled, plan, planId, planLayers, planScale, presentationMode, printAreaMode, push, quoteDraftLabel, quoteLabels, quotePointer, quotePoints, removeTypeFromPalette, renderPlan, requestSaveAndNavigate, roomDoorDraft, roomDrawMode, roomStatsById, safetyCardColorIndex, safetyCardFontIndex, safetyCardFontSize, safetyCardPos, safetyCardSize, safetyCardTextBgIndex, safetyNumbersInline, safetyPointsInline, scaleDraft, scaleDraftPointer, scaleLine, scalePromptDismissed, securityLayerVisible, securityOpen, securityPaletteDefs, selectedCorridorDoor, selectedCorridorId, selectedLinkId, selectedObjectId, selectedObjectIds, selectedRoomDoorId, selectedRoomId, selectedRoomIds, setAllTypesDefaultTab, setAllTypesOpen, setAnnotationsOpen, setContextMenu, setCorridorQuickMenu, setDesksOpen, setEmergencyContactsOpen, setHideAllLayers, setLayersOpen, setLinkEditId, setMeasureMode, setObjectRoomIds, setObjectsOpen, setPaletteSection, setPanToolActive, setPendingType, setPrintAreaMode, setRoomDrawMode, setScaleMode, setScalePromptDismissed, setSecurityOpen, setSelectedCorridorDoor, setSelectedCorridorId, setSelectedLinkId, setSelectedRoomDoorId, setSelectedRoomId, setSelectedRoomIds, setSelection, setViewsMenuOpen, setVisibleLayerIds, setWallDrawMode, showGrid, showPrintArea, site, startScaleMode, startWallDraw, t, toolMode, updateCorridorLabelScale, updateFloorPlan, updateObject, updateRoom, wallAttenuationByType, wallDraftPointer, wallDraftPoints, wallDrawMode, wallDrawType, wallTypeIdSet, zoom }} />

      {typeMenu ? (
        <PlanTypeMenu
          {...{ typeMenu, typeMenuRef, setTypeMenu, canManageLayers, isReadOnly, handleSelectType, handleOpenTypeLayer, handleDeleteType, t }}
        />
      ) : null}

      {wallQuickMenu ? (
        <PlanWallQuickMenu
          {...{ wallQuickMenu, setWallQuickMenu, setWallTypeMenu, handleEdit, setConfirmDelete, splitWallAtPoint, t }}
        />
      ) : null}

      {corridorQuickMenu ? (
        <PlanCorridorQuickMenu
          {...{ corridorQuickMenu, corridorDoorDraft, openEditCorridor, setCorridorQuickMenu, setCorridorDoorDraft, startCorridorDoorDraw, setConfirmDeleteCorridorId, push, t }}
        />
      ) : null}

      {layersQuickMenu ? (
        <PlanLayersQuickMenu
          {...{ layersQuickMenu, layersQuickMenuRef, planId, layerIds, setHideAllLayers, setVisibleLayerIds, setLayersQuickMenu, t }}
        />
      ) : null}

      {wallTypeMenu ? (
        <PlanWallTypeMenu
          {...{ wallTypeMenu, wallTypeDefs, getTypeLabel, applyWallTypeToIds, setWallTypeMenu, setWallQuickMenu, t }}
        />
      ) : null}

      {unlockCompose ? (
        <Suspense fallback={null}>
          <UnlockRequestComposeModal
            open={!!unlockCompose}
            target={
              unlockCompose
                ? { userId: unlockCompose.target.userId, username: unlockCompose.target.username, avatarUrl: (unlockCompose.target as any).avatarUrl }
                : null
            }
            locks={unlockCompose?.locks || []}
            onClose={() => setUnlockCompose(null)}
	          onSend={({ targetUserId, planId, message, grantMinutes }) => {
	            sendWs({ type: 'unlock_request', targetUserId, planId, message, grantMinutes });
	            setUnlockCompose(null);
	          }}
	        />
        </Suspense>
      ) : null}

      {contextMenu && plan ? <ContextMenuPanel {...{ addLink, alignMenuOpen, alignSelection, allItemsSelected, basePlan, beginCorridorPolyDraw, canEditWallType, client, contextAssemblyMapsUrl, contextIsAssemblyPoint, contextIsCamera, contextIsDesk, contextIsMulti, contextIsPhoto, contextIsQuote, contextIsRack, contextIsText, contextIsWall, contextIsWifi, contextLink, contextMenu, contextMenuRef, contextObject, contextObjectLinkCount, contextObjectTypeLabel, contextPhotoMulti, contextQuoteLabelPos, contextQuoteOrientation, contextWallPolygon, contextWifiBaseAreaSqm, contextWifiBaseDiameterM, contextWifiBaseRadiusM, contextWifiEffectiveAreaSqm, contextWifiEffectiveDiameterM, contextWifiEffectiveRadiusM, contextWifiRangeOn, contextWifiRangeScale, corridorById, deleteLink, deskCatalogDefs, effectiveVisibleLayerIds, getLayerLabel, getSubmenuStyle, goToDefaultView, handleEdit, hasDefaultView, hideAllLayers, isReadOnly, lastQuoteColor, layerIds, layersContextMenu, layersContextMenuRef, mapSubmenu, markTouched, metersPerPixel, normalizeLayerSelection, openCorridorConnectionModalAt, openCorridorDoorLinkModal, openCorridorDoorModal, openDuplicate, openEditCorridorConnectionModal, openEditRoom, openEscapeRouteAt, openMeetingManager, openPhotoViewer, openRoomDoorModal, openRoomMeetingsTimeline, openScaleEdit, openWallGroupModal, orderedPlanLayers, plan, planId, planLayers, planPhotoIds, push, renderPlan, renderPlanObjectById, requestClearScale, roomDoors, securityLayerVisible, selectedObjectIds, selectedRoomIds, selectedWifiIds, selectionHasDesk, selectionHasPhoto, selectionHasRack, selectionPhotoIds, setAlignMenuOpen, setAllTypesDefaultTab, setAllTypesOpen, setBulkEditSelectionOpen, setCableModal, setConfirmClearObjects, setConfirmDelete, setConfirmDeleteRoomId, setContextMenu, setDeskCatalogOpen, setEmergencyContactsOpen, setExportModalOpen, setHideAllLayers, setLastObjectScale, setLastQuoteColor, setLastQuoteScale, setLayersContextMenu, setLinkCreateMode, setLinkEditId, setLinkFromId, setLinksModalObjectId, setMeasureMode, setPaletteSection, setPanToolActive, setPendingType, setPrintAreaMode, setRealUserDetailsId, setRoomCatalogOpen, setRoomDrawMode, setRoomKioskInfoModal, setRoomLayoutExportModal, setRoomMeasuresModal, setScaleMode, setSelectedCorridorDoor, setSelectedLinkId, setSelectedRoomDoorId, setSelectedRoomId, setSelectedRoomIds, setSelection, setViewModalOpen, setVisibleLayerIds, setWallCatalogOpen, setWallDrawMode, setWallTypeModal, showPrintArea, site, startMeasure, startQuote, startRoomDoorDraft, startScaleMode, t, toggleMapSubmenu, toggleSecurityCardVisibility, toggleShowPrintArea, totalLayerCount, updateFloorPlan, updateObject, updateQuoteLabelPos, visibleLayerCount, wallTypeDefs }} /> : null}

      {rackModal && basePlan ? (
        <Suspense fallback={null}>
          <RackModal
            open={!!rackModal}
            plan={basePlan}
            rackObjectId={rackModal.objectId}
            rackObjectName={renderPlanObjectById.get(rackModal.objectId)?.name || t({ it: 'Rack', en: 'Rack' })}
            readOnly={isReadOnly}
            onClose={() => setRackModal(null)}
          />
        </Suspense>
      ) : null}

      {rackPortsLink && rackPortsLinkItem && renderPlan ? (
        <Suspense fallback={null}>
          <RackPortsModal
            open={!!rackPortsLink}
            item={rackPortsLinkItem}
            racks={(renderPlan as any).racks || []}
            rackItems={(renderPlan as any).rackItems || []}
            rackLinks={(renderPlan as any).rackLinks || []}
            readOnly={isReadOnly}
            initialConnectionsOpen={!!rackPortsLink.openConnections}
            initialConnectionsKind={rackPortsLink.kind}
            closeOnBackdrop={false}
            onClose={() => setRackPortsLink(null)}
            onAddLink={(payload) => addRackLink(planId, payload)}
            onDeleteLink={(linkId) => deleteRackLink(planId, linkId)}
            onRenamePort={handleRackPortsRename}
            onSavePortNote={handleRackPortsNote}
          />
        </Suspense>
      ) : null}


      <PlanScaleModal
        {...{ scaleModal, closeScaleModal, scaleMetersInput, setScaleMetersInput, applyScale, roomMeetingEditBusinessPartnersModalOpen, client, setRoomMeetingEditBusinessPartnersModalOpen, updateClient, t }}
      />

      <PlanWallTypeModal
        {...{ wallTypeModal, setWallTypeModal, wallTypeDraft, setWallTypeDraft, wallTypeDefs, getTypeLabel, applyWallType, t }}
      />

      <PlanRoomWallTypeModal
        {...{ roomWallTypeModal, setRoomWallTypeModal, roomWallPreview, roomWallTypeAllValue, applyRoomWallTypeAll, wallTypeDefs, getTypeLabel, roomWallTypeSelections, defaultWallTypeId, setRoomWallTypeAt, createRoomWalls, t }}
      />


      {modalState ? <ModalStatePanel {...{ client, closeReturnToSelectionList, deleteObject, getTypeIcon, getTypeLabel, handleCreate, handleUpdate, isReadOnly, lang, layerIds, markTouched, modalInitials, modalState, plan, planId, planLayers, push, quotePoints, setModalState, t }} /> : null}

      <Suspense fallback={null}>
        <SelectedObjectsModal
          open={selectedObjectsModalOpen}
          objects={selectedObjects}
          links={linksInSelection}
          getTypeLabel={getTypeLabel}
          getTypeIcon={getTypeIcon}
          getObjectName={getObjectNameById}
          onPickObject={openEditFromSelectionList}
          onPickLink={openLinkEditFromSelectionList}
          onPreviewObject={(objectId) => {
            if (!renderPlan) return;
            const obj = renderPlanObjectById.get(objectId);
            if (!obj) return;
            if (obj.type !== 'photo' && obj.type !== 'image') return;
            returnToSelectionListRef.current = true;
            setSelectedObjectsModalOpen(false);
            if (obj.type === 'photo') {
              openPhotoViewer({ id: objectId, selectionIds: [objectId] });
            } else {
              openImageViewer({ id: objectId, selectionIds: [objectId] });
            }
          }}
          onRemoveFromSelection={(objectId) => {
            const next = selectedObjectIds.filter((id) => id !== objectId);
            setSelection(next);
            if (selectedObjectId === objectId) {
              setSelectedObject(next[0]);
            }
          }}
          onFocusObject={(objectId) => {
            setSelectedObjectsModalOpen(false);
            setSelectedObject(objectId);
            triggerHighlight(objectId);
          }}
          readOnly={isReadOnly}
          onSetScaleAll={(scale) => {
            if (isReadOnly) return;
            if (!basePlan) return;
            const next = Math.max(0.2, Math.min(3, Number(scale) || 1));
            if (!selectedObjectIds.length) return;
            markTouched();
            useUIStore.getState().setLastObjectScale(next);
            for (const id of selectedObjectIds) {
              updateObject(id, { scale: next });
            }
            push(t({ it: 'Scala aggiornata', en: 'Scale updated' }), 'success');
          }}
          onRequestDeleteObject={(objectId) => {
            if (isReadOnly) return;
            setConfirmDelete([objectId]);
          }}
          onClose={() => setSelectedObjectsModalOpen(false)}
        />
      </Suspense>

      {realUserPicker ? (
        <Suspense fallback={null}>
          <RealUserPickerModal
            open={!!realUserPicker}
            clientId={client?.id || ''}
            clientName={client?.name || client?.shortName || ''}
            assignedCounts={assignedCounts}
            onClose={() => setRealUserPicker(null)}
            onSelect={(u) => {
              if (!plan || !realUserPicker || isReadOnly) return;
              markTouched();
              const realUserLayerIds = getLayerIdsForType('real_user');
              const name = `${u.firstName} ${u.lastName}`.trim() || u.externalId;
              const desc =
                [u.role, [u.dept1, u.dept2, u.dept3].filter(Boolean).join(' / ')].filter(Boolean).join(' · ') || undefined;
              const id = addObject(
                plan.id,
                'real_user',
                name,
                desc,
                realUserPicker.x,
                realUserPicker.y,
                defaultObjectScale,
                realUserLayerIds,
                {
                  externalClientId: client?.id,
                  externalUserId: u.externalId,
                  firstName: u.firstName,
                  lastName: u.lastName,
                  externalRole: u.role,
                  externalDept1: u.dept1,
                  externalDept2: u.dept2,
                  externalDept3: u.dept3,
                  externalEmail: u.email,
                  externalExt1: u.ext1,
                  externalExt2: u.ext2,
                  externalExt3: u.ext3,
                  externalIsExternal: u.isExternal
                }
              );
              ensureObjectLayerVisible(realUserLayerIds, name, 'real_user');
              lastInsertedRef.current = { id, name };
              const roomId = getRoomIdAt((plan as FloorPlan).rooms, realUserPicker.x, realUserPicker.y);
              const resolvedRoomId = resolveRoomAssignmentForObject(roomId, 'real_user', ((plan as FloorPlan).rooms || []) as Room[]);
              if (roomId && !resolvedRoomId) notifyNonPeopleRoomBlocked();
              if (resolvedRoomId) updateObject(id, { roomId: resolvedRoomId });
              push(t({ it: 'Utente reale inserito', en: 'Real user placed' }), 'success');
              postAuditEvent({
                event: 'real_user_place',
                scopeType: 'plan',
                scopeId: plan.id,
                details: { id, externalId: u.externalId, name, roomId: resolvedRoomId || null }
              });
              setRealUserPicker(null);
              setPendingType(null);
            }}
          />
        </Suspense>
      ) : null}


      <PlanTypeLayerModal
        {...{ typeLayerModal, setTypeLayerModal, typeLayerNameRef, typeLayerName, setTypeLayerName, typeLayerColor, setTypeLayerColor, handleCreateTypeLayer, t }}
      />


      <PlanRealUserImportMissingModal {...{ realUserImportMissing, setRealUserImportMissing, t }} />

      <PlanRoomCatalogModal {...{ roomCatalogOpen, setRoomCatalogOpen, beginRoomDraw, beginRoomPolyDraw, isReadOnly, t }} />

      <PlanWallCatalogModal {...{ wallCatalogOpen, setWallCatalogOpen, wallTypeDefs, startWallDraw, isReadOnly, getTypeLabel, t }} />

      {roomModal ? <RoomModalContainer {...{ addRoom, basePlan, getTypeIcon, getTypeLabel, handleCreateWallsForRoom, hasRoomOverlap, isPointInRoom, isReadOnly, isUserObject, markTouched, metersPerPixel, notifyRoomOverlap, openPhotoViewer, push, resolveRoomAssignmentForObject, roomDepartmentOptions, roomHasWalls, roomModal, roomModalBaseRoom, roomModalInitialSurfaceSqm, roomModalMetrics, roomModalPreview, roomStatsById, setConfirmDelete, setHighlightRoom, setObjectRoomIds, setRoomModal, setRoomWallPrompt, setSelectedRoomId, setSelectedRoomIds, siteFloorPlans, skipRoomWallTypesRef, t, updateRoom }} /> : null}


      <PlanCorridorModal
        {...{ corridorModal, setCorridorModal, corridorNameInputRef, corridorNameInput, setCorridorNameInput, corridorNameEnInput, setCorridorNameEnInput, corridorShowNameInput, setCorridorShowNameInput, saveCorridorModal, t }}
      />

      <PlanCorridorConnectionModal
        {...{ corridorConnectionModal, setCorridorConnectionModal, corridorConnectionTargetPlans, saveCorridorConnectionModal, t }}
      />

      <PlanCorridorDoorModal {...{ corridorDoorModal, setCorridorDoorModal, saveCorridorDoorModal, push, t }} />

      <PlanCorridorDoorLinkModal
        {...{ corridorDoorLinkModal, setCorridorDoorLinkModal, corridorDoorLinkQuery, setCorridorDoorLinkQuery, corridorDoorLinkRoomEntries, selectedRoomIds, saveCorridorDoorLinkModal, t }}
      />

      <ConfirmDialog
        open={!!roomWallPrompt}
        title={t({ it: 'Creare anche i muri?', en: 'Create walls too?' })}
        description={t({
          it: 'Vuoi creare i muri fisici partendo dalla forma della stanza appena creata?',
          en: 'Do you want to create physical walls from the newly created room shape?'
        })}
        confirmLabel={t({ it: 'Si, crea muri', en: 'Yes, create walls' })}
        cancelLabel={t({ it: 'No, solo stanza', en: 'No, room only' })}
        onCancel={() => setRoomWallPrompt(null)}
        onConfirm={() => {
          if (!roomWallPrompt) return;
          openRoomWallTypes({
            roomId: roomWallPrompt.roomId,
            roomName: roomWallPrompt.roomName,
            kind: roomWallPrompt.kind,
            rect: roomWallPrompt.kind === 'rect' ? roomWallPrompt.rect : undefined,
            points: roomWallPrompt.kind === 'poly' ? roomWallPrompt.points : undefined
          });
          setRoomWallPrompt(null);
        }}
      />

      <PlanScaleActionsModal
        {...{ scaleActionsOpen, setScaleActionsOpen, scaleLabel, planScale, updateScaleStyle, openScaleEdit, setClearScaleConfirmOpen, t }}
      />

      <PlanPlacementConfirmDialogs
        {...{ cancelPaste, capacityConfirm, capacityConfirmRef, clearScaleConfirmOpen, clearScaleNow, confirmPaste, deleteObject, dragStartRef, lastInsertedRef, markTouched, moveObject, overlapNotice, pasteConfirm, planId, planRef, proceedPlaceUser, push, roomDepartmentConfirm, setCapacityConfirm, setClearScaleConfirmOpen, setOverlapNotice, setRoomDepartmentConfirm, setUndoConfirm, t, undoConfirm, updateObject, updateRoom }}
      />

      <RoomKioskInfoModal
        modal={roomKioskInfoModal}
        link={roomKioskInfoLink}
        qrDataUrl={roomKioskInfoQrDataUrl}
        t={t}
        onClose={() => setRoomKioskInfoModal(null)}
        onOpenLink={() => {
          if (!roomKioskInfoLink) return;
          if (typeof window !== 'undefined') {
            window.open(roomKioskInfoLink, '_blank', 'noopener,noreferrer');
          }
        }}
        onCopyLink={() => {
          if (!roomKioskInfoLink) return;
          if (!navigator?.clipboard?.writeText) {
            push(t({ it: 'Clipboard non disponibile', en: 'Clipboard not available' }), 'danger');
            return;
          }
          navigator.clipboard.writeText(roomKioskInfoLink)
            .then(() => push(t({ it: 'Link kiosk copiato', en: 'Kiosk link copied' }), 'success'))
            .catch(() => push(t({ it: 'Copia non riuscita', en: 'Copy failed' }), 'danger'));
        }}
      />


      <PlanRoomMeetingDeleteModal
        {...{ roomMeetingDeleteModal, setRoomMeetingDeleteModal, meetingManagerOpen, roomMeetingDuplicateModal, roomMeetingsTimelineModal, confirmDeleteRoomMeetingBooking, t }}
      />

      <PlanRoomMeetingsTimelineModal
        {...{ basePlan, client, closeRoomMeetingsTimelineModal, extendRoomMeetingBooking, jumpToTimelineMeetingFromSearch, meetingManagerOpen, openMeetingManager, openRoomMeetingBookingDetail, openRoomMeetingDuplicateModal, plan, planId, promptDeleteRoomMeetingBooking, reloadRoomMeetingsTimeline, roomMeetingDuplicateModal, roomMeetingExtendBusyId, roomMeetingsTimelineBookingDetail, roomMeetingsTimelineDetailCloseGuardUntilRef, roomMeetingsTimelineHighlightBookingId, roomMeetingsTimelineModal, roomMeetingsTimelineScrollRef, roomMeetingsTimelineSearchActiveIndex, roomMeetingsTimelineSearchError, roomMeetingsTimelineSearchInputRef, roomMeetingsTimelineSearchLoading, roomMeetingsTimelineSearchResults, roomMeetingsTimelineSearchTerm, roomMeetingTimelineContextMenu, roomMeetingTimelineContextMenuRef, setHighlightRoom, setRoomMeetingsTimelineModal, setRoomMeetingsTimelineSearchActiveIndex, setRoomMeetingsTimelineSearchError, setRoomMeetingsTimelineSearchResults, setRoomMeetingsTimelineSearchTerm, setRoomMeetingTimelineContextMenu, shiftIsoDay, site, t }}
      />

      <PlanRoomMeetingBookingDetailModal
        {...{ addTimelineMeetingManualParticipant, addTimelineMeetingRealParticipant, adjustRoomMeetingEditEndTime, canOpenBusinessPartnersDirectory, canUseMeetingNotes, client, clientBusinessPartnerNames, closeRoomMeetingBookingDetail, closeRoomMeetingEditParticipantsModal, extendRoomMeetingBooking, getMeetingCheckInStats, getRoomMeetingCheckInEntries, lang, meetingCheckInEntryKey, meetingManagerOpen, openRoomMeetingDuplicateModal, openRoomMeetingEditParticipantsModal, push, removeTimelineMeetingParticipant, roomMeetingCheckInListOpen, roomMeetingDetailFocusRef, roomMeetingDuplicateModal, roomMeetingEditBusinessPartnersModalOpen, roomMeetingEditManualCompanyIsOther, roomMeetingEditParticipantCandidates, roomMeetingEditParticipantsCloseGuardUntilRef, roomMeetingEditParticipantsModalOpen, roomMeetingEditParticipantsNameInputRef, roomMeetingExtendBusyId, roomMeetingsTimelineBookingDetail, roomMeetingsTimelineModal, saveRoomMeetingBookingEdit, setRoomMeetingCheckInListOpen, setRoomMeetingEditBusinessPartnersModalOpen, setRoomMeetingEditManualCompanyIsOther, setRoomMeetingNotesModalBooking, setRoomMeetingNotesModalState, setRoomMeetingNotesReturnToMyMeetings, setRoomMeetingsTimelineBookingDetail, site, t, toggleTimelineMeetingParticipantFlag }}
      />

      {roomLayoutExportModal ? (
        <Suspense fallback={null}>
          <RoomLayoutExportModal
            open={!!roomLayoutExportModal}
            modal={roomLayoutExportModal}
            rows={roomLayoutExportRows}
            source={roomLayoutExportSource}
            t={t}
            onClose={closeRoomLayoutExportModal}
            onSelectAll={selectAllRoomLayoutExportRows}
            onClearSelection={clearRoomLayoutExportSelection}
            onToggleAll={toggleAllRoomLayoutExportRows}
            onToggleRow={toggleRoomLayoutExportRow}
            onSort={sortRoomLayoutExportRows}
            onApply={applyRoomLayoutExportToSelection}
          />
        </Suspense>
      ) : null}

      {roomMeasuresModal ? (
        <Suspense fallback={null}>
          <RoomMeasuresModal
            open={!!roomMeasuresModal}
            data={roomMeasuresData}
            t={t}
            onClose={() => setRoomMeasuresModal(null)}
          />
        </Suspense>
      ) : null}

      {roomMeetingDuplicateModal ? (
        <Suspense fallback={null}>
          <RoomMeetingDuplicateModal
            open={!!roomMeetingDuplicateModal && !meetingManagerOpen}
            modal={roomMeetingDuplicateModal}
            roomPickerOpen={roomMeetingDuplicateRoomPickerOpen}
            roomPickerRef={roomMeetingDuplicateRoomPickerRef}
            setModal={setRoomMeetingDuplicateModal}
            setRoomPickerOpen={setRoomMeetingDuplicateRoomPickerOpen}
            meetingClockFromTs={meetingClockFromTs}
            hmToMinutes={hmToMinutes}
            monthAnchorFromIso={monthAnchorFromIso}
            shiftMonthAnchor={shiftMonthAnchor}
            t={t}
            onClose={() => setRoomMeetingDuplicateModal(null)}
            onSave={saveRoomMeetingDuplicates}
          />
        </Suspense>
      ) : null}

      {meetingHubModalOpen ? (
        <Suspense fallback={null}>
          <MeetingHubModal
            open={meetingHubModalOpen}
            canManageMeetingScheduling={canManageMeetingScheduling}
            t={t}
            focusRef={meetingHubFocusRef}
            onClose={() => setMeetingHubModalOpen(false)}
            onOpenScheduling={() => {
              setMeetingHubModalOpen(false);
              openSchedulingFromHub({
                clientId: client?.id,
                siteId: site?.id,
                siteLocked: false,
                day: currentLocalIsoDay(),
                returnTo: 'hub'
              });
            }}
            onOpenMyMeetings={() => {
              setMeetingHubModalOpen(false);
              openMyMeetingsFromHub();
            }}
          />
        </Suspense>
      ) : null}

      {myMeetingsModal ? (
        <Suspense fallback={null}>
          <MyMeetingsModal
            open={!!myMeetingsModal}
            modal={myMeetingsModal}
            meetings={myMeetingsFiltered}
            search={myMeetingsSearch}
            focusRef={myMeetingsFocusRef}
            t={t}
            canUseMeetingNotes={canUseMeetingNotes}
            locationLabels={meetingLocationLabels}
            checkInBusyId={myMeetingsCheckInBusyId}
            checkInDoneById={myMeetingsCheckInDoneById}
            onClose={closeMyMeetingsModal}
            onSearchChange={setMyMeetingsSearch}
            onOpenScheduling={() => {
              const topMeeting = myMeetingsFiltered[0] || myMeetingsModal?.meetings?.[0] || null;
              myMeetingsRestoreRef.current = myMeetingsModal;
              setMyMeetingsModal(null);
              dispatchOpenClientMeetingsTimeline({
                clientId: String(topMeeting?.clientId || client?.id || '').trim() || undefined,
                siteId: String(topMeeting?.siteId || site?.id || '').trim() || undefined,
                siteLocked: false,
                day: String((topMeeting as any)?.occurrenceDate || (topMeeting?.startAt ? meetingIsoDayFromTs(Number(topMeeting.startAt)) : currentLocalIsoDay())),
                returnTo: 'myMeetings'
              });
            }}
            onRefresh={() => void reloadMyMeetings()}
            onOpenNotes={(booking) => {
              myMeetingsRestoreRef.current = myMeetingsModal;
              setRoomMeetingNotesReturnToMyMeetings(true);
              setRoomMeetingNotesModalState(null);
              setRoomMeetingNotesModalBooking(booking);
              setMyMeetingsModal(null);
            }}
            onCheckIn={(booking) => {
              if (myMeetingsCheckInBusyId) return;
              setMyMeetingsCheckInBusyId(String(booking.id));
              void mobileCheckInMeeting(String(booking.id), true)
                .then(() => {
                  setMyMeetingsCheckInDoneById((prev) => ({ ...prev, [String(booking.id)]: true }));
                  push(t({ it: 'Check-in registrato.', en: 'Check-in registered.' }), 'success');
                })
                .catch((err: any) => {
                  push(String(err?.message || t({ it: 'Errore check-in', en: 'Check-in error' })), 'danger');
                })
                .finally(() => {
                  setMyMeetingsCheckInBusyId(null);
                });
            }}
          />
        </Suspense>
      ) : null}

      {roomAllocationOpen ? (
        <Suspense fallback={null}>
          <RoomAllocationModal
            open={roomAllocationOpen}
            clients={allClients}
            departmentOptions={roomDepartmentOptions}
            currentClientId={roomAllocationPreset?.clientId || client?.id}
            currentSiteId={roomAllocationPreset?.siteId || site?.id}
            onHighlight={({ planId: targetPlanId, roomId }) => {
              if (targetPlanId !== planId) {
                setRoomAllocationOpen(false);
                setRoomAllocationPreset(null);
                setSelectedPlan(targetPlanId);
                navigate(`/plan/${targetPlanId}?focusRoom=${encodeURIComponent(roomId)}`);
                return;
              }
              setSelectedRoomId(roomId);
              setSelectedRoomIds([roomId]);
              setHighlightRoom({ roomId, until: Date.now() + 3200 });
            }}
            onClose={() => {
              setRoomAllocationOpen(false);
              setRoomAllocationPreset(null);
              setRoomsOpen(false);
            }}
          />
        </Suspense>
      ) : null}

      {capacityDashboardOpen ? (
        <Suspense fallback={null}>
          <CapacityDashboardModal
            open={capacityDashboardOpen}
            clients={allClients}
            currentClientId={capacityDashboardPreset?.clientId || client?.id}
            currentSiteId={capacityDashboardPreset?.siteId || site?.id}
            onClose={() => {
              setCapacityDashboardOpen(false);
              setCapacityDashboardPreset(null);
            }}
          />
        </Suspense>
      ) : null}

      {meetingManagerOpen ? <MeetingManagerOpenPanel {...{ allClients, client, meetingManagerOpen, meetingManagerPreset, navigate, plan, planId, reloadRoomMeetingsTimeline, roomMeetingsTimelineModal, rooms, setHighlightRoom, setMeetingManagerOpen, setMeetingManagerPreset, setMeetingStatusByRoomId, setSelectedPlan, setSelectedRoomId, setSelectedRoomIds, site }} /> : null}

      {roomMeetingNotesModalBooking ? (
        <Suspense fallback={null}>
          <MeetingNotesModal
            open={!!roomMeetingNotesModalBooking}
            meeting={roomMeetingNotesModalBooking}
            suspendClose={!!roomMeetingDuplicateModal}
            initialTab={roomMeetingNotesModalState?.initialTab}
            initialHistoryMeetingId={roomMeetingNotesModalState?.historyMeetingId}
            highlightHistoryMeetingId={roomMeetingNotesModalState?.highlightHistoryMeetingId}
            onClose={() => {
              const shouldReturnToMyMeetings = roomMeetingNotesReturnToMyMeetings;
              setRoomMeetingNotesModalBooking(null);
              setRoomMeetingNotesModalState(null);
              setRoomMeetingNotesReturnToMyMeetings(false);
              if (shouldReturnToMyMeetings) {
                restoreMyMeetingsFromSnapshot();
              }
            }}
            onOpenDetails={(booking) => {
              const fromMyMeetings = roomMeetingNotesReturnToMyMeetings;
              setRoomMeetingNotesModalBooking(null);
              setRoomMeetingNotesModalState(null);
              setRoomMeetingNotesReturnToMyMeetings(false);
              openRoomMeetingBookingDetail(booking, 'edit', {
                fromMyMeetings,
                fromMeetingNotes: true,
                meetingNotesState: {
                  initialTab: 'history',
                  historyMeetingId: String(booking.id || ''),
                  highlightHistoryMeetingId: String(booking.id || '')
                }
              });
            }}
            onOpenFollowUpScheduler={(booking, options) => {
              openRoomMeetingDuplicateModal(booking, { ...options, mode: 'followup' });
            }}
          />
        </Suspense>
      ) : null}

      {bulkEditOpen ? (
        <Suspense fallback={null}>
          {/* kept for potential future use */}
          <BulkEditDescriptionModal
            open={bulkEditOpen}
            count={selectedObjectIds.filter((id) => {
              const obj = renderPlan?.objects?.find((o) => o.id === id);
              return !!obj && !isDeskType(obj.type);
            }).length}
            onClose={() => setBulkEditOpen(false)}
            onSubmit={({ description }) => {
              if (isReadOnly) return;
              const targetIds = selectedObjectIds.filter((id) => {
                const obj = renderPlan?.objects?.find((o) => o.id === id);
                return !!obj && !isDeskType(obj.type);
              });
              if (targetIds.length) markTouched();
              for (const id of targetIds) {
                updateObject(id, { description });
              }
              push(t({ it: 'Descrizione aggiornata', en: 'Description updated' }), 'success');
              if (targetIds.length) {
                postAuditEvent({
                  event: 'objects_bulk_update',
                  scopeType: 'plan',
                  scopeId: planId,
                  details: { ids: targetIds, changes: { description } }
                });
              }
            }}
          />
        </Suspense>
      ) : null}

      {bulkEditSelectionOpen ? (
        <Suspense fallback={null}>
          <BulkEditSelectionModal
            open={bulkEditSelectionOpen}
            objects={(renderPlan?.objects || []).filter((o) => selectedObjectIds.includes(o.id))}
            getTypeLabel={getTypeLabel}
            getTypeIcon={getTypeIcon}
            onPreviewObject={(objectId) => {
              if (!renderPlan) return;
              const obj = renderPlanObjectById.get(objectId);
              if (!obj) return;
              if (obj.type !== 'photo' && obj.type !== 'image') return;
              returnToBulkEditRef.current = true;
              setBulkEditSelectionOpen(false);
              if (obj.type === 'photo') {
                openPhotoViewer({ id: objectId, selectionIds: [objectId] });
              } else {
                openImageViewer({ id: objectId, selectionIds: [objectId] });
              }
            }}
            onClose={() => setBulkEditSelectionOpen(false)}
            onApply={(changesById) => {
              if (isReadOnly) return;
              if (Object.keys(changesById || {}).length) markTouched();
              const ids = Object.keys(changesById || {});
              for (const id of ids) {
                updateObject(id, changesById[id]);
              }
              if (ids.length) push(t({ it: 'Oggetti aggiornati', en: 'Objects updated' }), 'success');
              if (ids.length) {
                postAuditEvent({
                  event: 'objects_bulk_update',
                  scopeType: 'plan',
                  scopeId: planId,
                  details: { ids, changesById }
                });
              }
            }}
          />
        </Suspense>
      ) : null}

      <ConfirmDialog
        open={!!layerRevealPrompt}
        title={t({ it: 'Oggetto in layer nascosto', en: 'Object in hidden layer' })}
        description={
          layerRevealPrompt
            ? t({
                it: `Per visualizzare "${getObjectToastLabel(layerRevealPrompt.objectName, layerRevealPrompt.typeId)}" devi attivare il layer ${getLayerLabel(layerRevealPrompt.missingLayerIds[0])}${
                  layerRevealPrompt.missingLayerIds.length > 1 ? ' (e altri).' : '.'
                }`,
                en: `To show "${getObjectToastLabel(layerRevealPrompt.objectName, layerRevealPrompt.typeId)}" you need to enable layer ${getLayerLabel(layerRevealPrompt.missingLayerIds[0])}${
                  layerRevealPrompt.missingLayerIds.length > 1 ? ' (and others).' : '.'
                }`
              })
            : undefined
        }
        onCancel={() => setLayerRevealPrompt(null)}
        onConfirm={() => {
          if (!layerRevealPrompt) return;
          const missing = layerRevealPrompt.missingLayerIds;
          if (hideAllLayers) setHideAllLayers(planId, false);
          const next = normalizeLayerSelection([...visibleLayerIds, ...missing]);
          setVisibleLayerIds(planId, next);
          const targetId = layerRevealPrompt.objectId;
          setLayerRevealPrompt(null);
          setSelectedObject(targetId);
          triggerHighlight(targetId);
        }}
        confirmLabel={t({ it: 'Mostra', en: 'Show' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title={
          confirmDelete && confirmDelete.length > 1
            ? t({ it: 'Eliminare gli oggetti?', en: 'Delete objects?' })
            : t({ it: 'Eliminare l’oggetto?', en: 'Delete object?' })
        }
	        description={
	          (() => {
	            if (!confirmDelete || !confirmDelete.length)
                return t({
                  it: 'L’oggetto verrà rimosso dalla planimetria.',
                  en: 'The object will be removed from the floor plan.'
                });
            if (confirmDelete.length === 1) {
              const obj = renderPlanObjectById.get(confirmDelete[0]);
              const label = obj ? getTypeLabel(obj.type) : undefined;
              const name = obj?.name || t({ it: 'oggetto', en: 'object' });
              const normalizedLabel = label ? label.trim().toLowerCase() : '';
              const normalizedName = String(name || '').trim().toLowerCase();
              const showLabel = !!label && normalizedLabel && normalizedLabel !== normalizedName;
              return t({
                  it: `Rimuovere ${showLabel ? `${label!.toLowerCase()} ` : ''}"${name}" dalla planimetria?`,
                  en: `Remove ${showLabel ? `${label} ` : ''}"${name}" from the floor plan?`
                });
            }
	            return t({
                it: `Rimuovere ${confirmDelete.length} oggetti dalla planimetria?`,
                en: `Remove ${confirmDelete.length} objects from the floor plan?`
              });
	          })()
	        }
        onCancel={() => {
          setConfirmDelete(null);
          setPendingRoomDeletes([]);
        }}
        onConfirm={() => {
          if (!confirmDelete || !confirmDelete.length) return;
          markTouched();
          confirmDelete.forEach((id) => deleteObject(id));
          if (lastInsertedRef.current && confirmDelete.includes(lastInsertedRef.current.id)) {
            lastInsertedRef.current = null;
          }
          const roomDeletes = pendingRoomDeletesRef.current || [];
          if (roomDeletes.length) {
            const remainingRooms = rooms.filter((r) => !roomDeletes.includes(r.id));
            const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
            const currentRoomDoors = Array.isArray((planRef.current as any)?.roomDoors) ? ((planRef.current as any).roomDoors as any[]) : [];
            for (const roomId of roomDeletes) {
              deleteRoom(basePlan.id, roomId);
              postAuditEvent({ event: 'room_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: roomId } });
            }
            if (currentRoomDoors.length) {
              const nextRoomDoors = currentRoomDoors.filter((door) => {
                const a = String((door as any)?.roomAId || '');
                const b = String((door as any)?.roomBId || '');
                return !roomDeletes.includes(a) && !roomDeletes.includes(b);
              });
              if (nextRoomDoors.length !== currentRoomDoors.length) {
                updateFloorPlan(basePlan.id, { roomDoors: nextRoomDoors as any } as any);
              }
            }
            if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
            setSelectedRoomIds((prev) => prev.filter((id) => !roomDeletes.includes(id)));
            if (selectedRoomId && roomDeletes.includes(selectedRoomId)) setSelectedRoomId(undefined);
            if (selectedRoomDoorId) {
              const stillExists = currentRoomDoors.some(
                (door) =>
                  String((door as any)?.id || '') === selectedRoomDoorId &&
                  !roomDeletes.includes(String((door as any)?.roomAId || '')) &&
                  !roomDeletes.includes(String((door as any)?.roomBId || ''))
              );
              if (!stillExists) setSelectedRoomDoorId(null);
            }
            setPendingRoomDeletes([]);
          }
          push(
            confirmDelete.length === 1 && !roomDeletes.length
              ? t({ it: 'Oggetto eliminato', en: 'Object deleted' })
              : t({
                  it: roomDeletes.length ? 'Oggetti e stanze eliminati' : 'Oggetti eliminati',
                  en: roomDeletes.length ? 'Objects and rooms deleted' : 'Objects deleted'
                }),
            'info'
          );
          postAuditEvent({
            event: confirmDelete.length === 1 ? 'object_delete' : 'objects_delete',
            scopeType: 'plan',
            scopeId: planId,
            details: { ids: confirmDelete }
          });
          setConfirmDelete(null);
          setContextMenu(null);
          clearSelection();
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel="Esc"
      />

      <ConfirmDialog
        open={!!confirmSetDefaultViewId}
        title={t({ it: 'Rendere questa vista predefinita?', en: 'Make this view the default?' })}
        description={t({
          it: 'Procedendo, questa vista diventerà la vista predefinita per la planimetria e sostituirà l’eventuale predefinita esistente.',
          en: 'If you continue, this view will become the default for this floor plan and will replace the current default view (if any).'
        })}
        onCancel={() => setConfirmSetDefaultViewId(null)}
        onConfirm={() => {
          if (!confirmSetDefaultViewId) return;
          setDefaultView(basePlan.id, confirmSetDefaultViewId);
          push(t({ it: 'Vista predefinita aggiornata', en: 'Default view updated' }), 'success');
          setConfirmSetDefaultViewId(null);
        }}
        confirmLabel={t({ it: 'Rendi default', en: 'Make default' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <ConfirmDialog
        open={!!confirmDeleteRoomId}
        title={t({ it: 'Eliminare la stanza?', en: 'Delete room?' })}
        description={
          confirmDeleteRoomId
            ? t({
                it: `Eliminare la stanza "${rooms.find((r) => r.id === confirmDeleteRoomId)?.name || 'stanza'}" e scollegare gli oggetti associati?`,
                en: `Delete room "${rooms.find((r) => r.id === confirmDeleteRoomId)?.name || 'room'}" and unlink associated objects?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteRoomId(null)}
        onConfirm={() => {
          if (!confirmDeleteRoomId) return;
          markTouched();
          const roomName = rooms.find((r) => r.id === confirmDeleteRoomId)?.name;
          const remainingRooms = rooms.filter((r) => r.id !== confirmDeleteRoomId);
          const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
          const currentRoomDoors = Array.isArray((planRef.current as any)?.roomDoors) ? ((planRef.current as any).roomDoors as any[]) : [];
          deleteRoom(basePlan.id, confirmDeleteRoomId);
          if (currentRoomDoors.length) {
            const nextRoomDoors = currentRoomDoors.filter((door) => {
              const a = String((door as any)?.roomAId || '');
              const b = String((door as any)?.roomBId || '');
              return a !== confirmDeleteRoomId && b !== confirmDeleteRoomId;
            });
            if (nextRoomDoors.length !== currentRoomDoors.length) {
              updateFloorPlan(basePlan.id, { roomDoors: nextRoomDoors as any } as any);
            }
          }
          postAuditEvent({ event: 'room_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: confirmDeleteRoomId } });
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          if (selectedRoomId === confirmDeleteRoomId) setSelectedRoomId(undefined);
          if (selectedRoomIds.includes(confirmDeleteRoomId)) {
            setSelectedRoomIds(selectedRoomIds.filter((id) => id !== confirmDeleteRoomId));
          }
          if (selectedRoomDoorId) {
            const stillExists = currentRoomDoors.some(
              (door) =>
                String((door as any)?.id || '') === selectedRoomDoorId &&
                String((door as any)?.roomAId || '') !== confirmDeleteRoomId &&
                String((door as any)?.roomBId || '') !== confirmDeleteRoomId
            );
            if (!stillExists) setSelectedRoomDoorId(null);
          }
          push(
            t({
              it: `Stanza eliminata${roomName ? `: ${roomName}` : ''}`,
              en: `Room deleted${roomName ? `: ${roomName}` : ''}`
            }),
            'info'
          );
          setConfirmDeleteRoomId(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        confirmOnEnter
      />

      <ConfirmDialog
        open={!!confirmDeleteRoomIds}
        title={t({ it: 'Eliminare le stanze?', en: 'Delete rooms?' })}
        description={
          confirmDeleteRoomIds?.length
            ? t({
                it: `Stai per eliminare ${confirmDeleteRoomIds.length} stanze e scollegare gli oggetti associati. Continuare?`,
                en: `You are about to delete ${confirmDeleteRoomIds.length} rooms and unlink associated objects. Continue?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteRoomIds(null)}
        onConfirm={() => {
          if (!confirmDeleteRoomIds?.length) return;
          markTouched();
          const roomIds = [...confirmDeleteRoomIds];
          const remainingRooms = rooms.filter((r) => !roomIds.includes(r.id));
          const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
          const currentRoomDoors = Array.isArray((planRef.current as any)?.roomDoors) ? ((planRef.current as any).roomDoors as any[]) : [];
          for (const roomId of roomIds) {
            deleteRoom(basePlan.id, roomId);
            postAuditEvent({ event: 'room_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: roomId } });
          }
          if (currentRoomDoors.length) {
            const nextRoomDoors = currentRoomDoors.filter((door) => {
              const a = String((door as any)?.roomAId || '');
              const b = String((door as any)?.roomBId || '');
              return !roomIds.includes(a) && !roomIds.includes(b);
            });
            if (nextRoomDoors.length !== currentRoomDoors.length) {
              updateFloorPlan(basePlan.id, { roomDoors: nextRoomDoors as any } as any);
            }
          }
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          setSelectedRoomIds((prev) => prev.filter((id) => !roomIds.includes(id)));
          if (selectedRoomId && roomIds.includes(selectedRoomId)) setSelectedRoomId(undefined);
          if (selectedRoomDoorId) {
            const stillExists = currentRoomDoors.some(
              (door) =>
                String((door as any)?.id || '') === selectedRoomDoorId &&
                !roomIds.includes(String((door as any)?.roomAId || '')) &&
                !roomIds.includes(String((door as any)?.roomBId || ''))
            );
            if (!stillExists) setSelectedRoomDoorId(null);
          }
          push(
            t({
              it: `Stanze eliminate: ${roomIds.length}`,
              en: `Rooms deleted: ${roomIds.length}`
            }),
            'info'
          );
          setConfirmDeleteRoomIds(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        confirmOnEnter
      />

      <ConfirmDialog
        open={!!confirmDeleteCorridorId}
        title={t({ it: 'Eliminare il corridoio?', en: 'Delete corridor?' })}
        description={
          confirmDeleteCorridorId
            ? t({
                it: `Eliminare il corridoio "${(basePlan.corridors || []).find((c) => c.id === confirmDeleteCorridorId)?.name || 'corridoio'}" insieme a porte e punti di connessione?`,
                en: `Delete corridor "${(basePlan.corridors || []).find((c) => c.id === confirmDeleteCorridorId)?.name || 'corridor'}" including doors and connection points?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteCorridorId(null)}
        onConfirm={() => {
          if (!confirmDeleteCorridorId) return;
          const current = (basePlan.corridors || []).filter(Boolean);
          const target = current.find((c) => c.id === confirmDeleteCorridorId);
          if (!target) {
            setConfirmDeleteCorridorId(null);
            return;
          }
          const next = current.filter((c) => c.id !== confirmDeleteCorridorId);
          markTouched();
          updateFloorPlan(basePlan.id, { corridors: next } as any);
          postAuditEvent({
            event: 'corridor_delete',
            scopeType: 'plan',
            scopeId: basePlan.id,
            details: {
              id: target.id,
              name: target.name || null,
              doors: Array.isArray(target.doors) ? target.doors.length : 0,
              connections: Array.isArray(target.connections) ? target.connections.length : 0
            }
          });
          if (selectedCorridorId === confirmDeleteCorridorId) setSelectedCorridorId(undefined);
          if (corridorDoorDraft?.corridorId === confirmDeleteCorridorId) setCorridorDoorDraft(null);
          if (corridorQuickMenu?.id === confirmDeleteCorridorId) setCorridorQuickMenu(null);
          push(t({ it: 'Corridoio eliminato', en: 'Corridor deleted' }), 'info');
          setContextMenu(null);
          setConfirmDeleteCorridorId(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        confirmOnEnter
      />

      <ConfirmDialog
        open={!!confirmDeleteViewId}
        title={t({ it: 'Eliminare la vista?', en: 'Delete view?' })}
        description={
          confirmDeleteViewId
            ? t({
                it: `Eliminare la vista "${basePlan.views?.find((v) => v.id === confirmDeleteViewId)?.name || 'vista'}"?`,
                en: `Delete view "${basePlan.views?.find((v) => v.id === confirmDeleteViewId)?.name || 'view'}"?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteViewId(null)}
        onConfirm={() => {
          if (!confirmDeleteViewId) return;
          markTouched();
          const deleting = basePlan.views?.find((v) => v.id === confirmDeleteViewId);
          deleteView(basePlan.id, confirmDeleteViewId);
          setConfirmDeleteViewId(null);
          setViewsMenuOpen(false);
          push(t({ it: 'Vista eliminata', en: 'View deleted' }), 'info');
          if (selectedViewId === confirmDeleteViewId) setSelectedViewId('__last__');
          // After deleting, always return to default view if available.
          window.setTimeout(() => goToDefaultView(), 0);
          if (deleting?.isDefault && (basePlan.views || []).length <= 1) {
            push(t({ it: 'Nessuna vista di default rimasta', en: 'No default view remaining' }), 'info');
          }
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <ConfirmDialog
        open={confirmClearObjects}
        title={t({ it: 'Eliminare tutti gli oggetti?', en: 'Delete all objects?' })}
        description={t({
          it: 'Tutti gli oggetti della planimetria verranno rimossi. Operazione non annullabile.',
          en: 'All objects in this floor plan will be removed. This cannot be undone.'
        })}
        onCancel={() => setConfirmClearObjects(false)}
        onConfirm={() => {
          clearObjects(basePlan.id);
          push(t({ it: 'Oggetti rimossi', en: 'Objects removed' }), 'info');
          setConfirmClearObjects(false);
          setSelectedObject(undefined);
        }}
        confirmLabel={t({ it: 'Elimina tutti', en: 'Delete all' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      {viewModalOpen ? (
        <Suspense fallback={null}>
          <ViewModal
            open={viewModalOpen}
            onClose={() => setViewModalOpen(false)}
            onSubmit={handleSaveView}
            hasExistingDefault={hasDefaultView}
            existingDefaultName={(basePlan.views || []).find((v) => v.isDefault)?.name || ''}
          />
        </Suspense>
      ) : null}

      {exportModalOpen ? (
        <Suspense fallback={null}>
          <PrintModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} mode="single" singlePlanId={basePlan.id} />
        </Suspense>
      ) : null}

      {cableModal ? <CableModalPanel {...{ addLink, basePlan, cableModal, isReadOnly, markTouched, plan, push, setCableModal, setSelectedLinkId, t, updateLink }} /> : null}

      {linksModalObjectId ? (
        <Suspense fallback={null}>
          <LinksModal
        open={!!linksModalObjectId}
        readOnly={isReadOnly}
        objectName={linksModalObjectName}
        rows={linksModalRows as any}
        onClose={() => setLinksModalObjectId(null)}
        onSelect={(linkId) => {
          setSelectedLinkId(linkId);
          setLinksModalObjectId(null);
        }}
        onEdit={(linkId) => {
          setLinksModalObjectId(null);
          setLinkEditId(linkId);
        }}
        onDelete={(linkId) => {
          if (isReadOnly) return;
          markTouched();
          deleteLink(basePlan.id, linkId);
          postAuditEvent({ event: 'link_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: linkId } });
          push(t({ it: 'Collegamento eliminato', en: 'Link deleted' }), 'info');
          if (selectedLinkId === linkId) setSelectedLinkId(null);
        }}
      />
        </Suspense>
      ) : null}

      {linkEditId ? (
        <Suspense fallback={null}>
          <LinkEditModal
        open={!!linkEditId}
        initial={
          linkEditId
            ? (() => {
                const l = (basePlan.links || []).find((x: any) => x.id === linkEditId);
                if (!l) return undefined;
                return {
                  name: String(l.name || l.label || ''),
                  description: String(l.description || ''),
                  color: String(l.color || '#94a3b8'),
                  width: Number.isFinite(Number(l.width)) && Number(l.width) > 0 ? Number(l.width) : 1,
                  dashed: !!l.dashed,
                  arrow: (l as any).arrow
                };
              })()
            : undefined
        }
        onClose={() => {
          setLinkEditId(null);
          closeReturnToSelectionList();
        }}
        onDelete={() => {
          if (!linkEditId || isReadOnly) return;
          markTouched();
          deleteLink(basePlan.id, linkEditId);
          postAuditEvent({ event: 'link_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: linkEditId } });
          push(t({ it: 'Collegamento eliminato', en: 'Link deleted' }), 'info');
          if (selectedLinkId === linkEditId) setSelectedLinkId(null);
          setLinkEditId(null);
          closeReturnToSelectionList();
        }}
        onSubmit={(payload) => {
          if (!linkEditId || isReadOnly) return;
          markTouched();
          updateLink(basePlan.id, linkEditId, {
            name: payload.name,
            description: payload.description,
            color: payload.color,
            width: payload.width,
            dashed: payload.dashed,
            arrow: payload.arrow
          });
          postAuditEvent({ event: 'link_update', scopeType: 'plan', scopeId: basePlan.id, details: { id: linkEditId, ...payload } });
          push(t({ it: 'Collegamento aggiornato', en: 'Link updated' }), 'success');
          setLinkEditId(null);
          closeReturnToSelectionList();
        }}
      />
        </Suspense>
      ) : null}

      {realUserDetailsId ? (
        <Suspense fallback={null}>
          <RealUserDetailsModal
            open={!!realUserDetailsId}
            userName={realUserDetailsName}
            details={realUserDetails}
            onClose={() => setRealUserDetailsId(null)}
          />
        </Suspense>
      ) : null}


      <PlanUnlockPromptModal
        {...{ unlockPrompt, setUnlockPrompt, unlockBusy, hasNavigationEdits, handleUnlockResponse, t }}
      />

      <PlanUnlockGrantedPromptModal
        {...{ unlockGrantedPrompt, setUnlockGrantedPrompt, formatPresenceDate, planId, requestPlanLock, hasNavigationEdits, requestSaveAndNavigate, setSelectedPlan, navigate, t }}
      />

      <PlanForceUnlockConfigModal
        {...{ forceUnlockConfig, setForceUnlockConfig, forceUnlockStarting, setForceUnlockStarting, forceUnlockGraceMinutes, setForceUnlockGraceMinutes, sendWs, t }}
      />

      <PlanForceUnlockActiveModal
        {...{ forceUnlockActive, forceUnlockActiveFocusRef, forceUnlockTick, sendWs, setForceUnlockActive, pushStack, t }}
      />

      <PlanForceUnlockIncomingModal
        {...{ forceUnlockIncoming, forceUnlockIncomingFocusRef, forceUnlockTick, hasNavigationEdits, executeForceUnlock, t }}
      />

      <Suspense fallback={null}>
        <PhotoViewerModal
          open={!!photoViewer}
          photos={photoViewer?.photos || []}
          initialId={photoViewer?.initialId}
          title={photoViewer?.title}
          countLabel={photoViewer?.countLabel}
          itemLabel={photoViewer?.itemLabel}
          emptyLabel={photoViewer?.emptyLabel}
          onFocus={focusPhotoFromGallery}
          onClose={() => {
            setPhotoViewer(null);
            if (returnToBulkEditRef.current) {
              returnToBulkEditRef.current = false;
              window.setTimeout(() => {
                setBulkEditSelectionOpen(true);
              }, 0);
            }
            closeReturnToSelectionList();
          }}
        />
      </Suspense>

      {allTypesOpen ? (
        <Suspense fallback={null}>
          <AllObjectTypesModal
            open={allTypesOpen}
            defs={(objectTypeDefs || []).filter((def) => (def as any)?.category !== 'door')}
            onClose={() => setAllTypesOpen(false)}
            onPick={(typeId) => {
              setPendingType(typeId);
              push(t({ it: 'Seleziona un punto sulla mappa per inserire l’oggetto', en: 'Click on the map to place the object' }), 'info');
            }}
            defaultTab={allTypesDefaultTab}
            paletteTypeIds={paletteOrder}
            onAddToPalette={addTypeToPalette}
          />
        </Suspense>
      ) : null}

      {deskCatalogOpen ? (
        <Suspense fallback={null}>
          <AllObjectTypesModal
            open={deskCatalogOpen}
            defs={deskCatalogDefs}
            onClose={() => setDeskCatalogOpen(false)}
            onPick={(typeId) => {
              setPendingType(typeId);
              push(t({ it: 'Seleziona un punto sulla mappa per inserire l’oggetto', en: 'Click on the map to place the object' }), 'info');
              setDeskCatalogOpen(false);
            }}
            defaultTab="desks"
          />
        </Suspense>
      ) : null}

      {revisionsOpen ? <RevisionsOpenPanel {...{ basePlan, clearRevisions, client, deleteRevision, isSuperAdmin, plan, planAccess, planId, push, restoreRevision, revisionsOpen, selectedRevisionId, setRevisionsOpen, setSelectedRevision, site, t, toggleRevisionImmutable }} /> : null}

      {saveRevisionOpen ? <SaveRevisionOpenPanel {...{ addRevision, clearPendingPostSaveAction, clearPendingSaveNavigate, dispatchOpenClientMeetingsTimeline, entrySnapshotRef, getPlanSnapshot, hasAnyRevision, latestRev, navigate, pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingNavigateRef, pendingPostSaveAction, performPendingPostSaveAction, plan, planRef, push, resetTouched, revertUnsavedChanges, saveRevisionModalPreset, saveRevisionOpen, saveRevisionReason, setMeetingManagerOpen, setMeetingManagerPreset, setPendingClientMeetingsPreset, setPendingMeetingManagerPreset, setSaveRevisionModalPreset, setSaveRevisionOpen, t }} /> : null}

      <ChooseDefaultViewModal
        open={!!chooseDefaultModal}
        views={orderedViews.filter((v) => v.id !== chooseDefaultModal?.deletingViewId)}
        onClose={() => setChooseDefaultModal(null)}
        onConfirm={(newDefaultId) => {
          if (!chooseDefaultModal) return;
          const deletingId = chooseDefaultModal.deletingViewId;
          setChooseDefaultModal(null);
          // Set a new default, then delete old default.
          setDefaultView(basePlan.id, newDefaultId);
          deleteView(basePlan.id, deletingId);
          if (selectedViewId === deletingId) setSelectedViewId(newDefaultId);
          push(t({ it: 'Vista eliminata e default aggiornata', en: 'View deleted and default updated' }), 'success');
          window.setTimeout(() => goToDefaultView(), 0);
        }}
      />

      <Suspense fallback={null}>
        <CrossPlanSearchModal
          open={crossPlanSearchOpen}
          currentPlanId={planId}
          term={crossPlanSearchTerm}
          results={crossPlanResults}
          objectTypeIcons={objectTypeIcons}
          objectTypeLabels={objectTypeLabels}
          onClose={() => {
            setCrossPlanSearchOpen(false);
            setCrossPlanSearchTerm('');
            setCrossPlanResults([]);
          }}
          onPick={(r) => {
            setCrossPlanSearchOpen(false);
            setCrossPlanSearchTerm('');
            setCrossPlanResults([]);
            if (r.planId !== planId) {
              setSelectedPlan(r.planId);
              if (r.kind === 'object') navigate(`/plan/${r.planId}?focusObject=${encodeURIComponent(r.objectId)}`);
              else navigate(`/plan/${r.planId}?focusRoom=${encodeURIComponent(r.roomId)}`);
              return;
            }
            if (r.kind === 'object') {
              setSelectedObject(r.objectId);
              triggerHighlight(r.objectId);
            } else {
              clearSelection();
              setSelectedRoomId(r.roomId);
              setSelectedRoomIds([r.roomId]);
              setHighlightRoom({ roomId: r.roomId, until: Date.now() + 3200 });
            }
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <InternalMapModal
          open={internalMapOpen}
          clients={allClients}
          objectTypeLabels={objectTypeLabels}
          initialLocation={{ clientId: client?.id, siteId: site?.id, planId }}
          onClose={() => setInternalMapOpen(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <EscapeRouteModal
          open={!!escapeRouteModal}
          plans={siteFloorPlans}
          emergencyContacts={safetyEmergencyContacts}
          startPlanId={escapeRouteModal?.startPlanId || planId}
          startPoint={escapeRouteModal?.startPoint || null}
          sourceKind={escapeRouteModal?.sourceKind || 'map'}
          clientName={String(client?.shortName || client?.name || '').trim()}
          siteName={String(site?.name || '').trim()}
          onClose={() => setEscapeRouteModal(null)}
        />
      </Suspense>
      {emergencyContactsOpen ? (
        <Suspense fallback={null}>
          <EmergencyContactsModal
            open={emergencyContactsOpen}
            clientId={client?.id || null}
            readOnly={planAccess !== 'rw'}
            safetyCardVisible={securityLayerVisible}
            onToggleSafetyCard={toggleSecurityCardVisibility}
            safetyCardToggleDisabled={!planId}
            onClose={() => setEmergencyContactsOpen(false)}
          />
        </Suspense>
      ) : null}

      {/* legacy multi-print modal kept for future use */}
    </div>
  );
};

export default PlanViewView;
