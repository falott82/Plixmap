import { Fragment, Suspense, lazy } from 'react';

import { Dialog, Transition } from '@headlessui/react';

import { getMeetingRoomActiveToneClass, getMeetingTimelineDayClasses, isApprovedMeetingInProgress } from '../../utils/meetingTime';
import { currentLocalIsoDay } from '../../utils/localDate';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, LayoutGrid, Trash, Copy, MoveDiagonal, Square, X, Pencil, Plus, DoorOpen, History, Save, Cog, EyeOff, CalendarClock, User, Footprints, Ruler, Hourglass, Unlock, Undo2, Redo2, Type as TypeIcon, Image as ImageIcon, Camera, StickyNote, Search, Loader2 } from 'lucide-react';
import Toolbar from './Toolbar';
import CanvasStage from './CanvasStage';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import SearchBar from './SearchBar';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Corridor, FloorPlan, Room } from '../../store/types';

import { useUIStore } from '../../store/useUIStore';

import PrinterMenuButton from './PrinterMenuButton';
import UserAvatar from '../ui/UserAvatar';

import SearchResultsPopover from './SearchResultsPopover';
import ChooseDefaultViewModal from './ChooseDefaultViewModal';
import Icon from '../ui/Icon';
import { isDeskType } from './deskTypes';
import RoomShapePreview from './RoomShapePreview';

import { Link } from 'react-router-dom';

import { postAuditEvent } from '../../api/audit';
import { fetchMeetingOverview } from '../../api/meetings';
import { mobileCheckInMeeting } from '../../api/mobile';

import { nanoid } from 'nanoid';
import { ALL_ITEMS_LAYER_ID, SYSTEM_LAYER_IDS, DEFAULT_WALL_TYPES } from '../../store/data';
import { getWallTypeColor } from '../../utils/wallColors';

import RoomKioskInfoModal from './RoomKioskInfoModal';
import { isRackLinkId, normalizeDoorVerificationHistory } from './planViewUtils';

const SelectedObjectsModal = lazy(() => import('./SelectedObjectsModal'));
const CrossPlanSearchModal = lazy(() => import('./CrossPlanSearchModal'));
const InternalMapModal = lazy(() => import('./InternalMapModal'));
const EscapeRouteModal = lazy(() => import('./EscapeRouteModal'));
const PhotoViewerModal = lazy(() => import('./PhotoViewerModal'));
const MeetingHubModal = lazy(() => import('./MeetingHubModal'));
const MyMeetingsModal = lazy(() => import('./MyMeetingsModal'));
const UserMenu = lazy(() => import('../layout/UserMenu'));
const EmergencyContactsModal = lazy(() => import('../layout/EmergencyContactsModal'));
const ClientBusinessPartnersModal = lazy(() => import('../layout/ClientBusinessPartnersModal'));
const ObjectModal = lazy(() => import('./ObjectModal'));
const RoomAllocationModal = lazy(() => import('./RoomAllocationModal'));
const ViewModal = lazy(() => import('./ViewModal'));
const RevisionsModal = lazy(() => import('./RevisionsModal'));
const SaveRevisionModal = lazy(() => import('./SaveRevisionModal'));
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
const CableModal = lazy(() => import('./CableModal'));
const LinksModal = lazy(() => import('./LinksModal'));
const LinkEditModal = lazy(() => import('./LinkEditModal'));
const RealUserDetailsModal = lazy(() => import('./RealUserDetailsModal'));
const MeetingManagerModal = lazy(() => import('../meetings/MeetingManagerModal'));
const MeetingNotesModal = lazy(() => import('../meetings/MeetingNotesModal'));
import { usePlanView, UNLOCK_REQUEST_EVENT, FORCE_UNLOCK_EVENT } from './usePlanView';
import RoomMeetingBookingDetailPanel from './RoomMeetingBookingDetailPanel';
import RoomsMenuPanel from './RoomsMenuPanel';
import RoomModalContainer from './RoomModalContainer';
import ContextMenuPanel from './ContextMenuPanel';
import ViewsMenuPanel from './ViewsMenuPanel';
import CountsMenuPanel from './CountsMenuPanel';
import LayersPopoverPanel from './LayersPopoverPanel';

type ViewProps = ReturnType<typeof usePlanView>;

const PlanViewView = (props: ViewProps) => {
  const {
    LOCK_TOAST_MS,
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
          <div className={`flex flex-nowrap items-center justify-between gap-2 ${presentationMode ? 'hidden' : ''}`}>
	        <div className="min-w-0">
	          <div className="text-[11px] font-semibold uppercase text-slate-500">
	            {client?.shortName || client?.name} → {site?.name}
	          </div>
			          {/* Avoid overflow clipping: dropdowns (presence/layers/etc) are positioned absolutely. */}
			          <div className="mt-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-visible whitespace-nowrap">
		            <h1 className="truncate text-xl font-semibold text-ink">{renderPlan.name}</h1>
		            {lockRequired && (lockState.mine || lockedByOther) ? (
		              <div ref={lockInfoRef} className="relative">
		                <button
		                  type="button"
		                  onClick={() => setLockInfoOpen((v) => !v)}
		                  className={
		                    lockState.mine
		                      ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100'
		                      : 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100'
		                  }
		                  title={
		                    lockState.mine
		                      ? lockActiveTitle
		                      : lockState.lockedBy
		                        ? lockedByTitle
		                        : t({
		                            it: `Lock riservato a ${lockState.grant?.username || 'utente'}.`,
		                            en: `Lock reserved for ${lockState.grant?.username || 'user'}.`
		                          })
		                  }
		                >
		                  {lockState.mine ? (
		                    <span>{t({ it: 'Lock attivo', en: 'Lock active' })}</span>
		                  ) : lockState.lockedBy ? (
		                    <span className="inline-flex items-center gap-1.5">
		                      <UserAvatar src={(lockState as any)?.lockedBy?.avatarUrl} username={(lockState as any)?.lockedBy?.username} size={14} />
		                      <span>
		                        {t({
		                          it: `Bloccata da ${lockState.lockedBy?.username || 'utente'}`,
		                          en: `Locked by ${lockState.lockedBy?.username || 'user'}`
		                        })}
		                      </span>
		                    </span>
		                  ) : (
		                    <span className="inline-flex items-center gap-1.5">
		                      <Hourglass size={14} className="text-amber-700" />
		                      <span>
		                        {t({
		                          it: `Lock concesso a ${lockState.grant?.username || 'utente'}`,
		                          en: `Lock granted to ${lockState.grant?.username || 'user'}`
		                        })}
		                      </span>
		                    </span>
		                  )}
		                </button>
		                {lockInfoOpen ? (
		                  <div className="absolute left-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-card">
		                    <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2">
		                      <div className="font-semibold text-ink">{t({ it: 'Lock planimetria', en: 'Floor plan lock' })}</div>
		                      <button
		                        onClick={() => setLockInfoOpen(false)}
		                        className="text-slate-400 hover:text-ink"
		                        title={t({ it: 'Chiudi', en: 'Close' })}
		                      >
		                        <X size={14} />
		                      </button>
		                    </div>
		                    <div className="px-2 pt-2 text-sm font-semibold text-ink">{renderPlan.name}</div>
		                    <div className="px-2 text-[11px] text-slate-500">
		                      {client?.shortName || client?.name} / {site?.name}
		                    </div>
		                    {lockState.grant ? (
		                      <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-slate-600">
		                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700">
		                          <Hourglass size={14} />
		                        </span>
		                        <span>
		                          {t({ it: 'Lock concesso a', en: 'Lock granted to' })}:{' '}
		                          <span className="font-semibold text-ink">{lockState.grant.username}</span>
		                        </span>
		                      </div>
		                    ) : lockState.lockedBy ? (
		                      <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-slate-600">
		                        <UserAvatar src={(lockState as any)?.lockedBy?.avatarUrl} username={(lockState as any)?.lockedBy?.username} size={18} />
		                        <span>
		                          {t({ it: 'Bloccato da', en: 'Locked by' })}:{' '}
		                          <span className="font-semibold text-ink">{lockState.lockedBy.username}</span>
		                        </span>
		                      </div>
		                    ) : null}
		                    <div className="mt-3 space-y-1 px-2 text-[11px] text-slate-600">
		                      <div>
		                        <span className="font-semibold text-slate-700">{t({ it: 'Ultima azione', en: 'Last action' })}</span>:{' '}
		                        {formatPresenceDate((lockState as any)?.meta?.lastActionAt)}
		                      </div>
		                      <div>
		                        <span className="font-semibold text-slate-700">{t({ it: 'Ultimo salvataggio', en: 'Last save' })}</span>:{' '}
		                        {formatPresenceDate((lockState as any)?.meta?.lastSavedAt)}
		                      </div>
		                      <div>
		                        <span className="font-semibold text-slate-700">{t({ it: 'Revisione', en: 'Revision' })}</span>:{' '}
		                        {String((lockState as any)?.meta?.lastSavedRev || '').trim() || '—'}
		                      </div>
		                      {lockState.grant ? (
		                        <div>
		                          <span className="font-semibold text-slate-700">{t({ it: 'Valida per', en: 'Valid for' })}</span>:{' '}
		                          {formatMinutes(grantRemainingMinutes ?? lockState.grant.minutes)} {t({ it: 'minuti', en: 'minutes' })}
		                        </div>
		                      ) : null}
		                    </div>
		                    {lockState.lockedBy && lockState.lockedBy.userId !== user?.id ? (
		                      <button
		                        onClick={() => {
		                          setLockInfoOpen(false);
                              const detail = {
                                planId,
                                planName: renderPlan.name,
                                clientName: client?.shortName || client?.name,
                                siteName: site?.name,
                                userId: lockState.lockedBy?.userId,
                                username: lockState.lockedBy?.username,
                                avatarUrl: (lockState.lockedBy as any)?.avatarUrl || ''
                              };
                              window.dispatchEvent(new CustomEvent(UNLOCK_REQUEST_EVENT, { detail }));
		                        }}
		                        className="mt-3 flex w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
		                        title={t({ it: 'Chiedi unlock', en: 'Request unlock' })}
		                      >
		                        {t({ it: 'Chiedi unlock', en: 'Request unlock' })}
		                      </button>
		                    ) : null}
		                    {isSuperAdmin && lockState.lockedBy && lockState.lockedBy.userId !== user?.id ? (
		                      <button
		                        onClick={() => {
		                          setLockInfoOpen(false);
                              const detail = {
                                planId,
                                planName: renderPlan.name,
                                clientName: client?.shortName || client?.name,
                                siteName: site?.name,
                                userId: lockState.lockedBy?.userId,
                                username: lockState.lockedBy?.username,
                                avatarUrl: (lockState.lockedBy as any)?.avatarUrl || ''
                              };
                              window.dispatchEvent(new CustomEvent(FORCE_UNLOCK_EVENT, { detail }));
		                        }}
		                        className="mt-2 flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
		                        title={t({ it: 'Force unlock (Superadmin)', en: 'Force unlock (Superadmin)' })}
		                      >
		                        {t({ it: 'Force unlock', en: 'Force unlock' })}
		                      </button>
		                    ) : null}
		                  </div>
		                ) : null}
		              </div>
		            ) : null}
		            {isReadOnly && !lockedByOther ? (
		              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
		                {activeRevision
		                  ? t({ it: `Sola lettura: ${activeRevision.name}`, en: `Read-only: ${activeRevision.name}` })
		                  : planAccess !== 'rw'
		                    ? t({ it: 'Sola lettura (permessi)', en: 'Read-only (permissions)' })
		                    : lockRequired
		                      ? t({ it: 'Lock non acquisito', en: 'Lock not acquired' })
		                      : t({ it: 'Sola lettura', en: 'Read-only' })}
		              </span>
		            ) : null}
	            {lockRequired && !lockState.mine && lockAvailable ? (
	              <button
	                onClick={requestPlanLock}
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                title={t({ it: 'Richiedi il lock per modificare', en: 'Request the lock to edit' })}
	              >
	                {t({ it: 'Prendi lock', en: 'Acquire lock' })}
	              </button>
	            ) : null}
	            {presenceCount ? (
	              <div ref={presenceRef} className="relative">
	                <button
	                  onClick={() => setPresenceOpen((v) => !v)}
	                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                  title={t({ it: 'Mostra utenti online', en: 'Show online users' })}
	                >
	                  {t({ it: `${presenceCount} utenti online`, en: `${presenceCount} users online` })}
	                </button>
	                {presenceOpen ? (
	                  <div className="absolute left-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-card">
	                    <div className="flex items-center justify-between px-2 pb-2">
	                      <div className="font-semibold text-ink">{t({ it: 'Utenti online', en: 'Online users' })}</div>
	                      <button
	                        onClick={() => setPresenceOpen(false)}
	                        className="text-slate-400 hover:text-ink"
	                        title={t({ it: 'Chiudi', en: 'Close' })}
	                      >
	                        <X size={14} />
	                      </button>
	                    </div>
		                    <div className="max-h-56 space-y-2 overflow-y-auto px-1 pb-1">
			                      {presenceEntries.map((entry) => (
			                        <div
			                          key={entry.userId}
			                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
			                        >
			                          <div className="flex items-start justify-between gap-2">
			                            <div className="min-w-0">
			                              <div className="flex items-center gap-2">
			                                <UserAvatar src={(entry as any).avatarUrl} username={entry.username} size={18} />
			                                <div className="min-w-0 text-xs font-semibold text-ink">{entry.username || 'user'}</div>
			                              </div>
			                            </div>
				                            {entry.userId !== user?.id ? (
				                              <button
				                                onClick={() => openUnlockCompose(entry)}
				                                disabled={
				                                  !(
				                                    (Array.isArray((entry as any).locks) && (entry as any).locks.length) ||
				                                    (entry as any).lock
				                                  )
				                                }
				                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
				                                title={t({ it: 'Richiedi unlock', en: 'Request unlock' })}
				                              >
				                                <Unlock size={14} />
				                              </button>
				                            ) : null}
			                          </div>
			                          <div className="text-[11px] text-slate-500">
			                            {t({ it: 'Connesso', en: 'Connected' })}: {formatPresenceDate(entry.connectedAt)}
			                          </div>
			                          {isSuperAdmin ? (
			                            <div className="text-[11px] text-slate-500">
			                              {t({ it: 'IP', en: 'IP' })}: {entry.ip || '—'}
			                            </div>
			                          ) : null}
		                          <div className="text-[11px] text-slate-500">
		                            {t({ it: 'Lock', en: 'Lock' })}: {formatPresenceLock(entry.lock, entry.locks)}
		                          </div>
		                        </div>
		                      ))}
	                    </div>
	                  </div>
	                ) : null}
	              </div>
	            ) : null}
            {totalLayerCount ? <LayersPopoverPanel {...{ allItemsLabel, allItemsSelected, effectiveVisibleLayerIds, getLayerNote, hideAllLayers, lang, layerIds, layersPopoverOpen, layersPopoverRef, normalizeLayerSelection, orderedPlanLayers, planId, setHideAllLayers, setLayersPopoverOpen, setLayersQuickMenu, setVisibleLayerIds, t, totalLayerCount, visibleLayerCount }} /> : null}
            <div className="relative">
	              <button
	                onClick={() => setCountsOpen((v) => !v)}
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                title={t({ it: 'Numero oggetti', en: 'Object count' })}
	              >
	                {t({ it: `${renderPlan.objects.length} oggetti`, en: `${renderPlan.objects.length} objects` })}
              </button>
	              {countsOpen ? <CountsMenuPanel {...{ counts, expandedType, getTypeIcon, getTypeLabel, objectListMatches, objectListQuery, objectsByType, renderPlan, setCountsOpen, setExpandedType, setObjectListQuery, setSelectedObject, setTypeMenu, t, triggerHighlight }} /> : null}
	            </div>
            <div className="relative">
	              <button
	                onClick={() => setRoomsOpen((v) => !v)}
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                title={t({ it: 'Stanze', en: 'Rooms' })}
	              >
	                {rooms.length} {t({ it: 'stanze', en: 'rooms' })}
	              </button>
              {roomsOpen ? <RoomsMenuPanel {...{ beginRoomDraw, beginRoomPolyDraw, clearSelection, expandedRoomId, getTypeIcon, isReadOnly, newRoomMenuOpen, openEditRoom, roomDrawMode, roomStatsById, rooms, selectedRoomId, setCapacityDashboardOpen, setCapacityDashboardPreset, setConfirmDeleteRoomId, setExpandedRoomId, setHighlightRoom, setNewRoomMenuOpen, setRoomAllocationOpen, setRoomAllocationPreset, setRoomDrawMode, setRoomsOpen, setSelectedObject, setSelectedRoomId, setSelectedRoomIds, t, triggerHighlight }} /> : null}
            </div>
	            <div className="ml-1 flex h-8 items-center gap-1.5">
	              {selectedObjectId ? (
	                <>
	                  <span className="text-xs font-semibold text-slate-600">
	                    {t({ it: 'Selezionato:', en: 'Selected:' })}
	                  </span>
	                  <span className="inline-flex min-w-0 max-w-[220px] items-center truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
	                    {selectedObjectIds.length > 1 || linksInSelection.length
	                      ? t({
	                          it: `${selectedObjectIds.length + linksInSelection.length} elementi`,
	                          en: `${selectedObjectIds.length + linksInSelection.length} items`
                        })
                      : renderPlanObjectById.get(selectedObjectId)?.name}
                  </span>
                  <button
                    onClick={() => {
                      if (selectedObjectIds.length > 1 || linksInSelection.length) {
                        setSelectedObjectsModalOpen(true);
                        return;
                      }
                      handleEdit(selectedObjectId);
	                    }}
	                    disabled={isReadOnly}
	                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
	                    title={t({ it: 'Modifica', en: 'Edit' })}
	                  >
	                    <Pencil size={12} />
	                  </button>
	                  <button
	                    onClick={() => setConfirmDelete([...selectedObjectIds])}
	                    disabled={isReadOnly}
	                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
	                    title={t({ it: 'Elimina', en: 'Delete' })}
	                  >
	                    <Trash size={12} />
	                  </button>
	                </>
	              ) : selectedLinkId ? (
	                isRackLinkId(selectedLinkId) ? (
	                  <>
	                    <span className="text-xs font-semibold text-slate-600">
	                      {t({ it: 'Collegamento rack:', en: 'Rack link:' })}
	                    </span>
	                    <span className="inline-flex min-w-0 max-w-[320px] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">
	                      {(() => {
	                        const l = rackOverlayById.get(selectedLinkId);
	                        const a = l ? getObjectNameById(String(l.rackFromRackId)) : '';
	                        const b = l ? getObjectNameById(String(l.rackToRackId)) : '';
                        const kindLabel = l?.rackKind === 'fiber' ? t({ it: 'Fibra', en: 'Fiber' }) : t({ it: 'Rame', en: 'Copper' });
                        return `${kindLabel}: ${a} → ${b}`;
                      })()}
                    </span>
                  </>
	                ) : (
	                  <>
	                    <span className="text-xs font-semibold text-slate-600">{t({ it: 'Collegamento:', en: 'Link:' })}</span>
	                    <span className="inline-flex min-w-0 max-w-[320px] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">
	                      {(() => {
	                        const l = ((basePlan as any).links || []).find((x: any) => x.id === selectedLinkId);
	                        const a = l ? getObjectNameById(String(l.fromId)) : '';
	                        const b = l ? getObjectNameById(String(l.toId)) : '';
                        const label = l ? String(l.name || l.label || t({ it: 'Collegamento', en: 'Link' })) : t({ it: 'Collegamento', en: 'Link' });
                        return `${label}: ${a} → ${b}`;
                      })()}
                    </span>
	                    <button
	                      onClick={() => setLinkEditId(selectedLinkId)}
	                      disabled={isReadOnly}
	                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
	                      title={t({ it: 'Modifica', en: 'Edit' })}
	                    >
	                      <Pencil size={12} />
	                    </button>
	                  </>
	                )
	              ) : (
	                selectedRoomId ? (
	                  <>
	                    <span className="text-xs font-semibold text-slate-600">{t({ it: 'Stanza:', en: 'Room:' })}</span>
	                    <span className="inline-flex min-w-0 max-w-[220px] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">
	                      {rooms.find((r) => r.id === selectedRoomId)?.name || t({ it: 'Stanza', en: 'Room' })}
	                    </span>
	                    {!isReadOnly ? (
	                      <>
	                        <button
	                          onClick={() => openEditRoom(selectedRoomId)}
	                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
	                          title={t({ it: 'Rinomina stanza', en: 'Rename room' })}
	                        >
	                          <Pencil size={12} />
	                        </button>
	                      </>
	                    ) : null}
                  </>
                ) : (
                  <span className="text-sm text-slate-400">{t({ it: 'Nessuna selezione', en: 'No selection' })}</span>
                )
              )}
            </div>
          </div>
        </div>
          <div className="flex items-center gap-3">
            <div className="relative">
            <SearchBar onSearch={handleSearch} onEnter={handleSearchEnter} inputRef={searchInputRef} className="w-96" />
            <SearchResultsPopover
              open={searchResultsOpen}
              term={searchResultsTerm}
              objectResults={searchResultsObjects}
              roomResults={searchResultsRooms}
              anchorRef={searchInputRef}
              onClose={() => {
                setSearchResultsOpen(false);
                setSearchResultsObjects([]);
                setSearchResultsRooms([]);
              }}
              onSelectObject={(id) => {
                const obj = renderPlan?.objects.find((o) => o.id === id);
                if (!obj) return;
                if (promptRevealForObject(obj)) return;
                setSelectedObject(id);
                triggerHighlight(id);
              }}
              onSelectRoom={(id) => {
                clearSelection();
                setSelectedRoomId(id);
                setSelectedRoomIds([id]);
                setHighlightRoom({ roomId: id, until: Date.now() + 3200 });
              }}
            />
          </div>
              <div className="group relative">
                <button
                  onClick={() => {
                    setMeetingHubModalOpen(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-600 text-white shadow-card transition hover:bg-emerald-700"
                  title={t({ it: 'Meeting center', en: 'Meeting center' })}
                >
                  <CalendarClock size={15} />
                </button>
                <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-80 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                  {t({
                    it: 'Apri il centro meeting: scegli Scheduling per la timeline sale oppure My meetings per i tuoi meeting.',
                    en: 'Open meeting center: choose Scheduling for room timeline or My meetings for your meetings.'
                  })}
                </div>
              </div>
		          <button
		            onClick={() => {
		              dismissSelectionHintToasts();
		              setInternalMapOpen(true);
	            }}
	            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-card hover:bg-slate-50"
	            title={t({
	              it: 'Mappa interna guidata (3 passi): 1) scegli punto A, 2) scegli punto B, 3) calcola percorso nei corridoi. Supporta ricerca utenti/oggetti/stanze.',
	              en: 'Guided internal map (3 steps): 1) set point A, 2) set point B, 3) compute corridor route. Supports user/object/room search.'
	            })}
	          >
	            <Footprints size={15} />
	          </button>
	          <button
	            onClick={() => setRevisionsOpen(true)}
	            title={t({
	              it: 'Time machine: apri la cronologia revisioni della planimetria, confronta versioni e ripristina uno stato precedente.',
	              en: 'Time machine: open floor-plan revision history, compare versions, and restore a previous state.'
	            })}
	            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
	          >
	            <History size={18} />
	          </button>
	          <div className="flex items-center gap-2">
	            <button
	              onClick={() => performUndo()}
	              disabled={!canUndo || isReadOnly}
	              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t({ it: 'Annulla (Ctrl/Cmd+Z)', en: 'Undo (Ctrl/Cmd+Z)' })}
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={() => performRedo()}
              disabled={!canRedo || isReadOnly}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t({ it: 'Ripeti (Ctrl/Cmd+Y)', en: 'Redo (Ctrl/Cmd+Y)' })}
            >
              <Redo2 size={16} />
            </button>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              hasUnsavedUi ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
            }`}
            title={
              hasUnsavedUi
                ? t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })
                : t({ it: 'Tutto salvato', en: 'All changes saved' })
            }
          >
            {hasUnsavedUi ? t({ it: 'Non salvato', en: 'Unsaved' }) : t({ it: 'Salvato', en: 'Saved' })}
          </div>
          {!isReadOnly ? (
            <button
              onClick={() => {
                if (!plan) return;
                if (!hasUnsavedUi) {
                  push(t({ it: 'Nessuna modifica da salvare', en: 'No changes to save' }), 'info');
                  return;
                }
                setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
                setSaveRevisionOpen(true);
              }}
              title={t({
                it: 'Salva revisione (Cmd/Ctrl+S rapido minor · Cmd/Ctrl+Shift+S major con nota)',
                en: 'Save revision (Cmd/Ctrl+S quick minor · Cmd/Ctrl+Shift+S major with note)'
              })}
              disabled={!hasUnsavedUi}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-card ${
                hasUnsavedUi
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-400 opacity-60'
              }`}
            >
	              <Save size={18} />
	            </button>
	          ) : null}
		          {/* Presentation button moved to the in-canvas toolbar (under "VD"). */}
	          <div className="relative">
            {viewsMenuOpen ? <ViewsMenuPanel {...{ applyView, basePlan, handleOverwriteView, orderedViews, push, selectedViewId, setChooseDefaultModal, setConfirmDeleteViewId, setConfirmSetDefaultViewId, setSelectedViewId, setViewModalOpen, setViewsMenuOpen, t }} /> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
	            <div ref={gridMenuRef} className="relative">
	              <button
	                onClick={() => setGridMenuOpen((v) => !v)}
	                title={t({
                    it: 'Griglia: attiva/disattiva overlay, snap ai punti e step di aggancio per posizionamenti precisi.',
                    en: 'Grid: toggle overlay, snap-to-grid, and step spacing for precise placement.'
                  })}
	                className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-white shadow-card hover:bg-slate-50 ${
	                  gridMenuOpen ? 'border-primary text-primary' : 'border-slate-200 text-ink'
	                }`}
	              >
	                <LayoutGrid size={18} />
              </button>
              {gridMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
                  <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Griglia', en: 'Grid' })}</div>
                  <label className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                    <span>{t({ it: 'Snap', en: 'Snap' })}</span>
                    <input
                      type="checkbox"
                      checked={gridSnapEnabled}
                      onChange={(e) => setGridSnapEnabled(e.target.checked)}
                      aria-label={t({ it: 'Snap', en: 'Snap' })}
                    />
                  </label>
                  <label className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                    <span>{t({ it: 'Mostra', en: 'Show' })}</span>
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      aria-label={t({ it: 'Mostra', en: 'Show' })}
                    />
                  </label>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>{t({ it: 'Step', en: 'Step' })}</span>
                      <span className="tabular-nums">{gridSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      step={5}
                      value={gridSize}
                      onChange={(e) => setGridSize(Number(e.target.value))}
                      className="mt-2 w-full"
                      title={t({ it: 'Dimensione griglia', en: 'Grid size' })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <button
              onClick={(e) => {
                if (scaleMode) {
                  cancelScaleMode();
                  return;
                }
                if (!planScale || e.shiftKey) {
                  startScaleMode();
                  return;
                }
                setShowScaleLine((prev) => !prev);
              }}
              title={
                scaleMode
                  ? t({ it: 'Annulla scala', en: 'Cancel scale' })
                  : planScale
                    ? t({ it: 'Mostra/nascondi scala (Shift per ricalibrare)', en: 'Show/hide scale (Shift to recalibrate)' })
                    : t({
                        it: 'Imposta la scala: necessaria per le misurazioni',
                        en: 'Set the scale: required for measurements'
                      })
              }
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-card ${
                !planScale
                  ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100'
                  : scaleMode
                    ? 'border-primary bg-white text-primary hover:bg-slate-50'
                    : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
	            >
	              <Ruler size={18} />
	            </button>
	            <PrinterMenuButton
		              isReadOnly={isReadOnly}
		              hasPrintArea={!!(basePlan as any)?.printArea}
                  triggerTitle={t({
                    it: 'Stampa: imposta area di stampa, rimuovi area o esporta PDF della planimetria.',
                    en: 'Print: set print area, clear print area, or export floor plan to PDF.'
                  })}
		              onSetPrintArea={() => {
		                setPrintAreaMode(true);
		                push(
	                  t({
	                    it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
	                    en: 'Draw a rectangle on the map to set the print area.'
	                  }),
	                  'info'
	                );
	              }}
		              onClearPrintArea={() => {
	                updateFloorPlan(basePlan.id, { printArea: undefined });
	                push(t({ it: 'Area di stampa rimossa correttamente', en: 'Print area removed successfully' }), 'info');
	              }}
		              onExportPdf={() => setExportModalOpen(true)}
		            />
		            <Suspense fallback={null}>
		              <UserMenu />
		            </Suspense>
		          </div>
		        </div>
		      </div>

	      <div className="flex-1 min-h-0">
	        <div className={`relative flex h-full min-h-0 overflow-hidden ${presentationMode ? 'gap-0' : 'gap-4'}`}>
	        <div className="flex-1 min-w-0 min-h-0">
	            <div
                className={`relative h-full min-h-0 w-full ${panToolActive ? 'cursor-grab active:cursor-grabbing' : ''}`}
                ref={mapRef}
                onMouseMove={handleMapMouseMove}
                onMouseDown={handleMapMouseDown}
              >
                {!presentationMode && !planScale?.metersPerPixel && !scalePromptDismissed ? (
                  <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2">
                    <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-lg">
                      <span>
                        {t({
                          it: 'Imposta la scala della planimetria per misurazioni accurate.',
                          en: 'Set your floor plan scale for accurate measurements.'
                        })}
                      </span>
                      <button
                        onClick={() => setScalePromptDismissed(true)}
                        className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-rose-500"
                      >
                        {t({ it: 'Annulla', en: 'Cancel' })}
                      </button>
                      <button
                        onClick={() => startScaleMode()}
                        disabled={isReadOnly}
                        className="rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t({ it: 'Imposta scala', en: 'Set scale' })}
                      </button>
                    </div>
                  </div>
                ) : null}
		                        <CanvasErrorBoundary>
		                        <CanvasStage
		                        ref={canvasStageRef}
		                        containerRef={mapRef}
		                        presentationMode={presentationMode}
		                        onTogglePresentation={() => handleTogglePresentation()}
		                        plan={(canvasPlan || renderPlan) as any}
	                        selectedId={selectedObjectId}
	                        selectedIds={selectedObjectIds}
	                    selectedRoomId={selectedRoomId}
                      selectedRoomIds={selectedRoomIds}
                      selectedCorridorId={selectedCorridorId}
	                    selectedLinkId={selectedLinkId}
				                highlightId={highlight?.objectId}
				                highlightUntil={highlight?.until}
	                    highlightRoomId={highlightRoom?.roomId}
	                    highlightRoomUntil={highlightRoom?.until}
                    meetingRoomStatusById={meetingStatusByRoomId}
				                pendingType={pendingType}
				                readOnly={isReadOnly || presentationMode}
                        panToolActive={panToolActive}
                        onTogglePanTool={() => setPanToolActive((v) => !v)}
	                    roomDrawMode={roomDrawMode}
                      corridorDrawMode={corridorDrawMode}
                      printArea={(basePlan as any)?.printArea || null}
                      printAreaMode={printAreaMode}
                      showPrintArea={showPrintArea}
                      toolMode={toolMode}
                      onToolPoint={handleToolPoint}
                      onToolMove={handleToolMove}
                      onToolDoubleClick={handleToolDoubleClick}
                      onWallDraftContextMenu={handleWallDraftContextMenu}
                      onWallSegmentDblClick={handleWallSegmentDblClick}
                      onWallClick={handleWallQuickMenu}
                      wallTypeIds={wallTypeIdSet}
                      wallDraft={{ points: wallDraftPoints, pointer: wallDraftPointer }}
                      scaleDraft={{ start: scaleDraft?.start, end: scaleDraft?.end, pointer: scaleDraftPointer }}
                      scaleLine={scaleLine || undefined}
                      onScaleContextMenu={handleScaleContextMenu}
                      onScaleDoubleClick={handleScaleDoubleClick}
                      onScaleMove={handleScaleMove}
                      measureDraft={{
                        points: measurePoints,
                        pointer: measurePointer,
                        closed: measureClosed,
                        label: measureLabel || undefined,
                        areaLabel: measureAreaLabel || undefined
                      }}
                      quoteDraft={{
                        points: quotePoints,
                        pointer: quotePointer,
                        label: quoteDraftLabel || undefined
                      }}
                      quoteLabels={quoteLabels}
                      metersPerPixel={metersPerPixel}
                      wallAttenuationByType={wallAttenuationByType}
                      onSetPrintArea={(rect) => {
                        if (isReadOnly) return;
                        updateFloorPlan(basePlan.id, { printArea: rect });
                        setPrintAreaMode(false);
                        push(t({ it: 'Area di stampa impostata correttamente', en: 'Print area set successfully' }), 'success');
                      }}
                      safetyCard={{
                        visible: securityLayerVisible,
                        x: safetyCardPos.x,
                        y: safetyCardPos.y,
                        w: safetyCardSize.w,
                        h: safetyCardSize.h,
                        fontSize: safetyCardFontSize,
                        fontIndex: safetyCardFontIndex,
                        colorIndex: safetyCardColorIndex,
                        textBgIndex: safetyCardTextBgIndex,
                        title: t({ it: 'Scheda sicurezza', en: 'Safety card' }),
                        numbersLabel: t({ it: 'Numeri utili', en: 'Emergency numbers' }),
                        pointsLabel: t({ it: 'Punti di ritrovo', en: 'Meeting points' }),
                        numbersText: safetyNumbersInline,
                        pointsText: safetyPointsInline,
                        noNumbersText: t({ it: 'Nessun numero', en: 'No numbers' }),
                        noPointsText: t({ it: 'Nessun punto', en: 'No points' })
                      }}
                      onSafetyCardChange={handleSafetyCardChange}
                      onSafetyCardContextMenu={handleSafetyCardContextMenu}
                      onSafetyCardDoubleClick={() => {
                        if (!client?.id) return;
                        setEmergencyContactsOpen(true);
                      }}
	                    objectTypeIcons={objectTypeIcons}
                      snapEnabled={gridSnapEnabled}
                      gridSize={gridSize}
                      showGrid={showGrid}
					                zoom={zoom}
					                pan={pan}
					                autoFit={autoFitEnabled && !hasDefaultView}
                      hasDefaultView={hasDefaultView}
                      onToggleViewsMenu={() => setViewsMenuOpen((v) => !v)}
                      perfEnabled={perfEnabled}
				                onZoomChange={handleZoomChange}
			                onPanChange={handlePanChange}
					                onSelect={handleStageSelect}
                      roomStatsById={roomStatsById}
                      onSelectRooms={(ids) => {
                        setSelectedRoomIds(ids);
                        setSelectedRoomId(ids.length === 1 ? ids[0] : undefined);
                        setSelectedCorridorId(undefined);
                        setSelectedCorridorDoor(null);
                        setSelectedRoomDoorId(null);
                      }}
	                    onSelectLink={(id) => {
	                      if (!id) {
	                        setSelectedLinkId(null);
	                        return;
	                      }
	                      if (isRackLinkId(id)) {
	                        openRackLinkPorts(id);
	                        setSelectedLinkId(id);
	                        setContextMenu(null);
	                        clearSelection();
	                        setSelectedRoomId(undefined);
                        setSelectedRoomIds([]);
                        setSelectedCorridorId(undefined);
                        setSelectedCorridorDoor(null);
                        setSelectedRoomDoorId(null);
	                        return;
	                      }
	                      setSelectedLinkId(id || null);
	                      setContextMenu(null);
	                      clearSelection();
	                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
	                    }}
	                    onSelectMany={(ids) => {
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
	                    setSelection(ids);
	                    setContextMenu(null);
	                  }}
                      onMoveStart={handleStageMoveStart}
					                onMove={handleStageMove}
                      onUpdateQuotePoints={(id, points) => {
                        if (isReadOnly) return;
                        if (!points.length) return;
                        markTouched();
                        updateObject(id, { points, x: points[0].x, y: points[0].y });
                      }}
					                onPlaceNew={handlePlaceNew}
		                onEdit={handleEdit}
		        onContextMenu={handleObjectContextMenu}
                    onLinkContextMenu={handleLinkContextMenu}
                    onRoomContextMenu={handleRoomContextMenu}
                    onMeetingBadgeDblClick={({ id }) => {
                      openRoomMeetingsTimeline(id);
                    }}
                    onCorridorContextMenu={handleCorridorContextMenu}
                    onCorridorConnectionContextMenu={handleCorridorConnectionContextMenu}
                    onCorridorDoorContextMenu={handleCorridorDoorContextMenu}
                    onCorridorDoorDblClick={({ corridorId, doorId }) => openCorridorDoorModal(corridorId, doorId)}
                    onCorridorClick={handleCorridorQuickMenu}
                    onCorridorMiddleClick={({ corridorId, worldX, worldY }) => {
                      insertCorridorJunctionPoint(corridorId, { x: worldX, y: worldY });
                      setCorridorQuickMenu(null);
                    }}
                    onCorridorDoorDraftPoint={handleCorridorDoorDraftPoint}
                    onLinkDblClick={(id) => {
                      if (isRackLinkId(id)) {
                        openRackLinkPorts(id);
                        return;
                      }
                      if (isReadOnly) return;
                      setLinkEditId(id);
                    }}
                    onMapContextMenu={handleMapContextMenu}
                    onGoDefaultView={goToDefaultView}
                    onSelectRoom={(roomId, options) => {
                      if (roomDoorDraft && roomId && Number.isFinite(Number(options?.worldX)) && Number.isFinite(Number(options?.worldY))) {
                        if (createRoomDoorFromDraft(roomId, { x: Number(options?.worldX), y: Number(options?.worldY) })) return;
                      }
                      const shouldPreserveSelection =
                        !!roomId && selectedRoomIds.length > 1 && selectedRoomIds.includes(roomId) && (!!options?.preserveSelection || !!options?.keepContext);
                      if (shouldPreserveSelection && roomId) {
                        clearSelection();
                        setSelectedLinkId(null);
                        setSelectedCorridorId(undefined);
                        setSelectedCorridorDoor(null);
                        setSelectedRoomDoorId(null);
                        setSelectedRoomId(roomId);
                        if (!options?.keepContext) setContextMenu(null);
                        return;
                      }
                      clearSelection();
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
                      if (options?.multi && roomId) {
                        setSelectedRoomIds((prev) => {
                          const has = prev.includes(roomId);
                          const next = has ? prev.filter((id) => id !== roomId) : Array.from(new Set([...prev, roomId]));
                          setSelectedRoomId(next.length === 1 ? next[0] : undefined);
                          return next;
                        });
                        if (!options?.keepContext) setContextMenu(null);
                        return;
                      }
                      setSelectedRoomId(roomId);
                      setSelectedRoomIds(roomId ? [roomId] : []);
                      setSelectedCorridorId(undefined);
                      setSelectedRoomDoorId(null);
                      if (!options?.keepContext) setContextMenu(null);
                    }}
                    onSelectCorridor={(corridorId, options) => {
                      if (corridorDoorDraft?.corridorId && corridorId && corridorId !== corridorDoorDraft.corridorId) return;
                      clearSelection();
                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedLinkId(null);
                      if (!corridorId || selectedCorridorDoor?.corridorId !== corridorId) setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
                      setSelectedCorridorId(corridorId || undefined);
                      if (!options?.keepContext) setContextMenu(null);
                    }}
                    onSelectCorridorDoor={(payload) => {
                      if (!payload) {
                        setSelectedCorridorDoor(null);
                        return;
                      }
                      clearSelection();
                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setCorridorQuickMenu(null);
                      setSelectedRoomDoorId(null);
                      setSelectedCorridorDoor(payload);
                    }}
                    onSelectRoomDoor={(doorId) => {
                      if (!doorId) {
                        setSelectedRoomDoorId(null);
                        return;
                      }
                      clearSelection();
                      setSelectedRoomId(undefined);
                      setSelectedRoomIds([]);
                      setSelectedLinkId(null);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setCorridorQuickMenu(null);
                      setSelectedRoomDoorId(doorId);
                    }}
                    onRoomDoorContextMenu={handleRoomDoorContextMenu}
                    onRoomDoorDblClick={(doorId) => openRoomDoorModal(doorId)}
                    selectedRoomDoorId={selectedRoomDoorId}
                    selectedCorridorDoor={selectedCorridorDoor}
                    corridorDoorDraft={corridorDoorDraft}
                    roomDoorDraft={roomDoorDraft ? { roomAId: roomDoorDraft.roomAId, roomBId: roomDoorDraft.roomBId } : null}
                    onOpenRoomDetails={(roomId) => {
                      setSelectedRoomId(roomId);
                      setSelectedRoomIds([roomId]);
                      setSelectedCorridorId(undefined);
                      setSelectedCorridorDoor(null);
                      setSelectedRoomDoorId(null);
                      openEditRoom(roomId);
                    }}
                    onCreateRoom={(shape) => {
                      if (shape.kind === 'rect') handleCreateRoomFromRect(shape.rect);
                      else handleCreateRoomFromPoly(shape.points);
                    }}
                    onCreateCorridor={(shape) => {
                      if (shape.kind === 'poly') handleCreateCorridorFromPoly(shape.points);
                    }}
                    onUpdateRoom={(roomId, payload) => {
                      if (isReadOnly) return;
                      const currentRoom = ((plan as FloorPlan).rooms || []).find((r) => r.id === roomId);
                      if (currentRoom) {
                        const nextRoom = { ...currentRoom, ...payload };
                        if (hasRoomOverlap(nextRoom, roomId)) {
                          notifyRoomOverlap();
                          return;
                        }
                      }
                      markTouched();
                      const resolvedPayload =
                        metersPerPixel && currentRoom
                          ? { ...payload, surfaceSqm: computeRoomSurfaceSqm({ ...currentRoom, ...payload }, metersPerPixel) }
                          : payload;
                      const nextRooms = ((plan as FloorPlan).rooms || []).map((r) => (r.id === roomId ? { ...r, ...resolvedPayload } : r));
                      updateRoom((plan as FloorPlan).id, roomId, resolvedPayload as any);
                      const updates = computeRoomReassignments(nextRooms, (plan as FloorPlan).objects);
                      if (Object.keys(updates).length) setObjectRoomIds((plan as FloorPlan).id, updates);
                    }}
                    onUpdateCorridor={(corridorId, payload) => {
                      if (isReadOnly) return;
                      const sanitizePoints = (points: { x: number; y: number }[] | undefined) =>
                        (points || [])
                          .filter((p) => Number.isFinite(Number((p as any)?.x)) && Number.isFinite(Number((p as any)?.y)))
                          .map((p) => ({ x: Number((p as any).x), y: Number((p as any).y) }));
                      const current = (((plan as FloorPlan).corridors || []) as Corridor[]).filter(Boolean);
                      const next = current.map((corridor) => {
                        if (corridor.id !== corridorId) return corridor;
                        const currentPoints = sanitizePoints(getCorridorPolygon(corridor));
                        const nextPointsRaw = Array.isArray(payload.points) ? sanitizePoints(payload.points as any) : currentPoints;
                        const resolvedKind = (payload.kind || corridor.kind || (nextPointsRaw.length >= 3 ? 'poly' : 'rect')) as 'rect' | 'poly';
                        const nextPoints = resolvedKind === 'poly' ? (nextPointsRaw.length >= 3 ? nextPointsRaw : currentPoints) : currentPoints;
                        const nextDoors = Array.isArray(payload.doors)
                          ? payload.doors
                              .filter((door) => door && door.id)
                              .map((door) => ({
                                ...door,
                                edgeIndex: Number(door.edgeIndex),
                                t: Number(door.t),
                                edgeIndexTo: Number.isFinite(Number((door as any).edgeIndexTo)) ? Number((door as any).edgeIndexTo) : undefined,
                                tTo: Number.isFinite(Number((door as any).tTo)) ? Number((door as any).tTo) : undefined,
                                mode:
                                  (door as any).mode === 'auto_sensor' ||
                                  (door as any).mode === 'automated' ||
                                  (door as any).mode === 'static'
                                    ? (door as any).mode
                                    : 'static',
                                automationUrl: typeof (door as any).automationUrl === 'string' ? String((door as any).automationUrl) : undefined,
                                catalogTypeId:
                                  typeof (door as any).catalogTypeId === 'string' ? String((door as any).catalogTypeId).trim() || undefined : undefined,
                                description:
                                  typeof (door as any).description === 'string' ? String((door as any).description).trim() || undefined : undefined,
                                isEmergency: !!(door as any).isEmergency,
                                isMainEntrance: !!(door as any).isMainEntrance,
                                isExternal: !!(door as any).isExternal,
                                isFireDoor: !!(door as any).isFireDoor,
                                lastVerificationAt:
                                  typeof (door as any).lastVerificationAt === 'string'
                                    ? String((door as any).lastVerificationAt).trim() || undefined
                                    : undefined,
                                verifierCompany:
                                  typeof (door as any).verifierCompany === 'string'
                                    ? String((door as any).verifierCompany).trim() || undefined
                                    : undefined,
                                verificationHistory: normalizeDoorVerificationHistory((door as any).verificationHistory),
                                linkedRoomIds: Array.isArray((door as any).linkedRoomIds)
                                  ? Array.from(new Set((door as any).linkedRoomIds.map((id: any) => String(id)).filter(Boolean)))
                                  : []
                              }))
                              .filter((door) => Number.isFinite(door.edgeIndex) && Number.isFinite(door.t))
                          : corridor.doors;
                        return {
                          ...corridor,
                          ...payload,
                          kind: resolvedKind,
                          points: nextPoints,
                          doors: nextDoors,
                          connections: Array.isArray(payload.connections)
                            ? payload.connections.map((cp) => ({
                                ...cp,
                                x: Number.isFinite(Number((cp as any)?.x)) ? Number((cp as any).x) : undefined,
                                y: Number.isFinite(Number((cp as any)?.y)) ? Number((cp as any).y) : undefined,
                                planIds: [...(cp.planIds || [])],
                                transitionType: (cp as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs'
                              }))
                            : corridor.connections
                        };
                      });
                      markTouched();
                      updateFloorPlan((plan as FloorPlan).id, { corridors: next } as any);
                    }}
                    onAdjustCorridorLabelScale={updateCorridorLabelScale}
                    onUpdateObject={(id, changes) => {
                      if (isReadOnly) return;
                      markTouched();
                      updateObject(id, changes);
                    }}
                    onOpenPhoto={openPhotoViewer}
                    onMoveWall={handleWallMove}
                    suspendKeyboardShortcuts={allTypesOpen}
                    connectionPlanNamesById={Object.fromEntries(
                      ((site as any)?.floorPlans || []).map((fp: any) => [String(fp?.id || ''), String(fp?.name || fp?.id || '')])
                    )}
	              />
		                        </CanvasErrorBoundary>
	            </div>
	          </div>
            {!presentationMode && linkCreateHint ? (
              <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
                <div className="max-w-[720px] rounded-2xl bg-slate-900/90 px-4 py-3 text-white shadow-card backdrop-blur">
                  <div className="text-sm font-semibold">{linkCreateHint.title}</div>
                  <div className="mt-0.5 text-xs text-white/80">{linkCreateHint.subtitle}</div>
                </div>
              </div>
            ) : null}
		          {!isReadOnly && !presentationMode ? (
		            <aside className="sticky top-0 max-h-[calc(100vh-24px)] w-[9rem] shrink-0 self-start overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 pb-8 shadow-card">
                <div className="rounded-xl bg-slate-50/80 p-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                    <button
                      onClick={() => setAnnotationsOpen((prev) => !prev)}
                      className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      title={
                        annotationsOpen
                          ? t({ it: 'Nascondi annotazioni', en: 'Collapse annotations' })
                          : t({ it: 'Mostra annotazioni', en: 'Expand annotations' })
                      }
                    >
                      {annotationsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>{t({ it: 'Annotazioni', en: 'Annotations' })}</span>
                    </button>
                  </div>
                  {annotationsOpen ? (
                    <div className="mt-2 grid grid-cols-4 justify-items-center gap-3">
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'text');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('text');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi testo', en: 'Add text' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'text'
                            ? 'border-sky-300 bg-sky-100 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <TypeIcon size={16} />
                      </button>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'image');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('image');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi immagine', en: 'Add image' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'image'
                            ? 'border-sky-300 bg-sky-100 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <ImageIcon size={16} />
                      </button>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'photo');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('photo');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi foto', en: 'Add photo' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'photo'
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Camera size={16} />
                      </button>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/plixmap-type', 'postit');
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          setWallDrawMode(false);
                          setMeasureMode(false);
                          setScaleMode(false);
                          setRoomDrawMode(null);
                          setPanToolActive(false);
                          setPendingType('postit');
                          setPaletteSection('objects');
                        }}
                        title={t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          pendingType === 'postit'
                            ? 'border-amber-300 bg-amber-100 text-amber-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <StickyNote size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
                {planLayers.length ? (
                  <div className="mt-3 rounded-xl bg-sky-50/80 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => setLayersOpen((prev) => !prev)}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        title={
                          layersOpen ? t({ it: 'Nascondi livelli', en: 'Collapse layers' }) : t({ it: 'Mostra livelli', en: 'Expand layers' })
                        }
                      >
                        {layersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Livelli', en: 'Layers' })}</span>
                      </button>
                      <div className="flex items-center gap-1">
	                        <button
	                          onClick={() => {
	                            const nextHidden = !hideAllLayers;
	                            setHideAllLayers(planId, nextHidden);
	                            if (nextHidden) {
	                              // Ensure the next layer click starts from an empty selection.
	                              setVisibleLayerIds(planId, []);
	                            }
	                          }}
	                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50"
	                          title={
	                            hideAllLayers
                              ? t({ it: 'Mostra livelli', en: 'Show layers' })
                              : t({ it: 'Nascondi livelli', en: 'Hide layers' })
                          }
                        >
                          {hideAllLayers ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
	                        <button
	                          onClick={() => {
	                            const url = '/settings?tab=layers';
	                            if (hasNavigationEdits && !isReadOnly) {
	                              requestSaveAndNavigate(url);
	                              return;
	                            }
	                            navigate(url);
	                          }}
	                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50"
	                          title={t({ it: 'Gestisci layers', en: 'Manage layers' })}
	                        >
	                          <Cog size={14} />
	                        </button>
	                      </div>
	                    </div>
                    {layersOpen ? (
                      <div className="mt-2 flex flex-col gap-2">
                        {orderedPlanLayers.map((l: any) => {
                          const layerId = String(l.id);
                          const isOn = hideAllLayers
                            ? false
                            : layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsSelected
                              : effectiveVisibleLayerIds.includes(layerId);
                          const label =
                            layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsLabel
                              : (l?.name?.[lang] as string) || (l?.name?.it as string) || l.id;
                          return (
                            <button
                              key={layerId}
                              onClick={() => {
                                const base = hideAllLayers ? [] : effectiveVisibleLayerIds;
                                if (hideAllLayers) setHideAllLayers(planId, false);
                                if (layerId === ALL_ITEMS_LAYER_ID) {
                                  const showAll = hideAllLayers || !allItemsSelected;
                                  setVisibleLayerIds(planId, showAll ? layerIds : []);
                                  return;
                                }
                                const next = isOn ? base.filter((id) => id !== layerId) : [...base, layerId];
                                setVisibleLayerIds(planId, normalizeLayerSelection(next));
                              }}
                              className={`flex items-center justify-between rounded-xl border px-2 py-1 text-[11px] font-semibold ${
                                isOn ? 'border-sky-300 bg-sky-100 text-sky-700' : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                              title={label}
                            >
                              <span className="truncate">{label}</span>
                              <span
                                className="ml-2 h-2 w-2 shrink-0 rounded-full"
                                style={{ background: layerId === ALL_ITEMS_LAYER_ID ? '#000' : l.color || (isOn ? '#2563eb' : '#cbd5e1') }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="my-3 h-px w-full bg-slate-200" />
                <div className="space-y-3">
                  <div className="rounded-xl bg-amber-50/70 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => {
                          if (!deskPaletteDefs.length) return;
                          setPaletteSection('desks');
                          setDesksOpen((prev) => !prev);
                        }}
                        disabled={!deskPaletteDefs.length}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          desksOpen ? t({ it: 'Nascondi scrivanie', en: 'Collapse desks' }) : t({ it: 'Mostra scrivanie', en: 'Expand desks' })
                        }
                      >
                        {desksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Scrivanie', en: 'Desks' })}</span>
                      </button>
                      <button
                        onClick={() => {
                          const url = '/settings?tab=objects&section=desks';
                          if (hasNavigationEdits && !isReadOnly) {
                            requestSaveAndNavigate(url);
                            return;
                          }
                          navigate(url);
                        }}
                        title={t({ it: 'Impostazioni scrivanie', en: 'Desk settings' })}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    {desksOpen && deskPaletteDefs.length ? (
                      <div className="mt-3 flex flex-col items-center gap-3">
                        <Toolbar
                          defs={deskPaletteDefs}
                          order={deskPaletteOrder}
                          onSelectType={(type) => {
                            setPaletteSection('desks');
                            setWallDrawMode(false);
                            setMeasureMode(false);
                            setScaleMode(false);
                            setRoomDrawMode(null);
                            setPendingType(type);
                          }}
                          onRemoveFromPalette={(type) => removeTypeFromPalette(type)}
                          activeType={pendingType || (wallDrawMode ? wallDrawType : null)}
                          allowRemove
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="rounded-xl bg-emerald-50/70 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => {
                          if (!otherPaletteDefs.length) return;
                          setPaletteSection('objects');
                          setObjectsOpen((prev) => !prev);
                        }}
                        disabled={!otherPaletteDefs.length}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          objectsOpen ? t({ it: 'Nascondi oggetti', en: 'Collapse objects' }) : t({ it: 'Mostra oggetti', en: 'Expand objects' })
                        }
                      >
                        {objectsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Oggetti', en: 'Objects' })}</span>
                      </button>
                      <button
                        onClick={() => {
                          const url = '/settings?tab=objects&section=objects';
                          if (hasNavigationEdits && !isReadOnly) {
                            requestSaveAndNavigate(url);
                            return;
                          }
                          navigate(url);
                        }}
                        title={t({ it: 'Impostazioni oggetti', en: 'Object settings' })}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    {objectsOpen && otherPaletteDefs.length ? (
                      <div className="mt-3 flex flex-col items-center gap-3">
                        <Toolbar
                          defs={otherPaletteDefs}
                          order={paletteOrder}
                          onSelectType={(type) => {
                            setPaletteSection('objects');
                            if (isWallType(type)) {
                              startWallDraw(type);
                              return;
                            }
                            setWallDrawMode(false);
                            setMeasureMode(false);
                            setScaleMode(false);
                            setRoomDrawMode(null);
                            setPendingType(type);
                          }}
                          onRemoveFromPalette={(type) => removeTypeFromPalette(type)}
                          activeType={pendingType || (wallDrawMode ? wallDrawType : null)}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="rounded-xl bg-rose-50/70 p-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-slate-500">
                      <button
                        onClick={() => {
                          if (!securityPaletteDefs.length) return;
                          setPaletteSection('security');
                          setSecurityOpen((prev) => !prev);
                        }}
                        disabled={!securityPaletteDefs.length}
                        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          securityOpen
                            ? t({ it: 'Nascondi sicurezza', en: 'Collapse safety' })
                            : t({ it: 'Mostra sicurezza', en: 'Expand safety' })
                        }
                      >
                        {securityOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{t({ it: 'Sicurezza', en: 'Safety' })}</span>
                      </button>
                      <button
                        onClick={() => {
                          const url = '/settings?tab=objects&section=security';
                          if (hasNavigationEdits && !isReadOnly) {
                            requestSaveAndNavigate(url);
                            return;
                          }
                          navigate(url);
                        }}
                        title={t({ it: 'Impostazioni sicurezza', en: 'Safety settings' })}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    {securityOpen && securityPaletteDefs.length ? (
                      <div className="mt-3 flex flex-col items-center gap-3">
                        <Toolbar
                          defs={securityPaletteDefs}
                          onSelectType={(type) => {
                            setPaletteSection('security');
                            setWallDrawMode(false);
                            setMeasureMode(false);
                            setScaleMode(false);
                            setRoomDrawMode(null);
                            setPendingType(type);
                          }}
                          activeType={pendingType || (wallDrawMode ? wallDrawType : null)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                {paletteIsEmpty ? (
                  <button
                    onClick={() => {
                      if (hasNavigationEdits && !isReadOnly) {
                        requestSaveAndNavigate('/settings?tab=objects');
                        return;
                      }
                      navigate('/settings?tab=objects');
                    }}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                    title={t({ it: 'Configura la palette', en: 'Configure the palette' })}
                  >
                    {t({ it: 'Aggiungi oggetti alla palette', en: 'Add objects to palette' })}
                  </button>
                ) : null}
                {/* Bottom action: show all types when favorites are enabled */}
                {paletteHasCustom && paletteHasMore ? (
                  <button
                    onClick={() => {
                      setAllTypesDefaultTab(paletteSettingsSection);
                      setAllTypesOpen(true);
                    }}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Mostra tutti gli oggetti', en: 'Show all objects' })}
                  >
                    {t({ it: 'Mostra tutti', en: 'Show all' })}
                  </button>
                ) : null}
		          </aside>
		          ) : null}
	        </div>
	      </div>

      {typeMenu ? (
        <div
          ref={typeMenuRef}
          className="context-menu-panel fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
          style={{ top: typeMenu.y, left: typeMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
                <Icon name={typeMenu.icon} />
              </span>
              <span className="truncate">{typeMenu.label}</span>
            </div>
            <button
              onClick={() => setTypeMenu(null)}
              className="text-slate-400 hover:text-ink"
              title={t({ it: 'Chiudi', en: 'Close' })}
            >
              <X size={14} />
            </button>
          </div>
          <button
            onClick={() => handleSelectType(typeMenu.typeId)}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
            title={t({ it: 'Seleziona tutti gli oggetti di questo tipo', en: 'Select all objects of this type' })}
          >
            <User size={14} className="text-slate-500" /> {t({ it: 'Seleziona tutti', en: 'Select all' })}
          </button>
          {canManageLayers ? (
            <button
              onClick={() => handleOpenTypeLayer(typeMenu.typeId, typeMenu.label)}
              disabled={isReadOnly}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t({ it: 'Crea un layer per questo tipo', en: 'Create a layer for this type' })}
            >
              <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Crea layer', en: 'Create layer' })}
            </button>
          ) : null}
          <button
            onClick={() => handleDeleteType(typeMenu.typeId)}
            disabled={isReadOnly}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            title={t({ it: 'Rimuovi tutti gli oggetti di questo tipo', en: 'Remove all objects of this type' })}
          >
            <Trash size={14} /> {t({ it: 'Rimuovi tutti', en: 'Remove all' })}
          </button>
        </div>
      ) : null}

      {wallQuickMenu ? (
        <div
          className="context-menu-panel fixed z-50 flex items-center gap-2 rounded-xl bg-slate-900/90 px-2 py-1.5 text-white shadow-card"
          style={{ top: wallQuickMenu.y - 52, left: wallQuickMenu.x - 42 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setWallTypeMenu({ ids: [wallQuickMenu.id], x: wallQuickMenu.x + 8, y: wallQuickMenu.y - 12 });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            title={t({ it: 'Tipo muro', en: 'Wall type' })}
          >
            <Square size={14} />
          </button>
          <button
            onClick={() => {
              handleEdit(wallQuickMenu.id);
              setWallQuickMenu(null);
              setWallTypeMenu(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            title={t({ it: 'Modifica muro', en: 'Edit wall' })}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => {
              setConfirmDelete([wallQuickMenu.id]);
              setWallQuickMenu(null);
              setWallTypeMenu(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            title={t({ it: 'Elimina muro', en: 'Delete wall' })}
          >
            <Trash size={14} />
          </button>
          <button
            onClick={() => {
              splitWallAtPoint({ id: wallQuickMenu.id, point: wallQuickMenu.world });
              setWallQuickMenu(null);
              setWallTypeMenu(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            title={t({ it: 'Dividi muro', en: 'Split wall' })}
          >
            <Plus size={14} />
          </button>
        </div>
      ) : null}

      {corridorQuickMenu ? (
        <div
          className="context-menu-panel fixed z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900/90 px-2 py-1.5 text-white shadow-card"
          style={{ top: corridorQuickMenu.y - 52, left: corridorQuickMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              openEditCorridor(corridorQuickMenu.id);
              setCorridorQuickMenu(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            title={t({ it: 'Rinomina corridoio', en: 'Rename corridor' })}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => {
              if (corridorDoorDraft?.corridorId === corridorQuickMenu.id) {
                setCorridorDoorDraft(null);
                push(t({ it: 'Disegno porta corridoio annullato', en: 'Corridor door drawing cancelled' }), 'info');
                return;
              }
              startCorridorDoorDraw(corridorQuickMenu.id);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${corridorDoorDraft?.corridorId === corridorQuickMenu.id ? 'bg-amber-500/80 text-white' : 'bg-white/10 hover:bg-white/20'}`}
            title={
              corridorDoorDraft?.corridorId === corridorQuickMenu.id
                ? t({ it: 'Annulla inserimento porta', en: 'Cancel door insertion' })
                : t({ it: 'Inserisci porta sul perimetro del corridoio', en: 'Insert door on corridor perimeter' })
            }
          >
            <DoorOpen size={14} />
          </button>
          <button
            onClick={() => {
              setConfirmDeleteCorridorId(corridorQuickMenu.id);
              setCorridorQuickMenu(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            title={t({ it: 'Elimina corridoio', en: 'Delete corridor' })}
          >
            <Trash size={14} />
          </button>
        </div>
      ) : null}

      {layersQuickMenu ? (
        <div
          ref={layersQuickMenuRef}
          className="context-menu-panel fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-card"
          style={{ top: layersQuickMenu.y, left: layersQuickMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setHideAllLayers(planId, false);
              setVisibleLayerIds(planId, layerIds);
              setLayersQuickMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Mostra tutti i livelli', en: 'Show all layers' })}
          >
            <Eye size={14} className="text-slate-500" /> {t({ it: 'Mostra tutti i livelli', en: 'Show all layers' })}
          </button>
          <button
            onClick={() => {
              setHideAllLayers(planId, true);
              setLayersQuickMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Nascondi tutti i livelli', en: 'Hide all layers' })}
          >
            <EyeOff size={14} className="text-slate-500" /> {t({ it: 'Nascondi tutti i livelli', en: 'Hide all layers' })}
          </button>
        </div>
      ) : null}

      {wallTypeMenu ? (
        <div
          className="context-menu-panel fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
          style={{ top: wallTypeMenu.y, left: wallTypeMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
            {t({ it: 'Tipi muro', en: 'Wall types' })}
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {wallTypeDefs.map((def) => {
              const label = getTypeLabel(def.id);
              const attenuation = Number((def as any).attenuationDb);
              const suffix = Number.isFinite(attenuation) ? ` (${attenuation} dB)` : '';
              return (
                <button
                  key={def.id}
                  onClick={() => {
                    applyWallTypeToIds(wallTypeMenu.ids, def.id);
                    setWallTypeMenu(null);
                    setWallQuickMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                >
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full border border-slate-200"
                    style={{ background: getWallTypeColor(def.id) }}
                  />
                  <span className="truncate text-sm text-slate-700">
                    {label}
                    {suffix}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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

      <Transition show={!!scaleModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeScaleModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md modal-panel">
                  <Dialog.Title className="modal-title">
                    {t({ it: 'Imposta scala', en: 'Set scale' })}
                  </Dialog.Title>
                  <div className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Inserisci i metri lineari della linea selezionata.',
                      en: 'Enter the linear meters for the selected line.'
                    })}
                  </div>
                  <label className="mt-4 block text-sm font-semibold text-slate-700">
                    {t({ it: 'Metri lineari', en: 'Linear meters' })}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={scaleMetersInput}
                      onChange={(e) => setScaleMetersInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyScale();
                        }
                      }}
                      placeholder={t({ it: 'Esempio: 10,20', en: 'Example: 10.20' })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={applyScale}
                      className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      {t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={closeScaleModal}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
          {roomMeetingEditBusinessPartnersModalOpen && client ? (
            <Suspense fallback={null}>
              <ClientBusinessPartnersModal
                open={roomMeetingEditBusinessPartnersModalOpen && !!client}
                client={client || undefined}
                onClose={() => setRoomMeetingEditBusinessPartnersModalOpen(false)}
                onSave={(businessPartners) => {
                  if (!client?.id) return;
                  updateClient(client.id, { businessPartners } as any);
                  setRoomMeetingEditBusinessPartnersModalOpen(false);
                }}
              />
            </Suspense>
          ) : null}
        </Dialog>
      </Transition>

      <Transition show={!!wallTypeModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setWallTypeModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md modal-panel">
                  <Dialog.Title className="modal-title">
                    {t({ it: 'Tipo muro', en: 'Wall type' })}
                  </Dialog.Title>
                  <div className="mt-2 text-sm text-slate-600">
                    {(() => {
                      const count = wallTypeModal?.ids.length || 1;
                      const itLabel = count === 1 ? 'muro' : 'muri';
                      const enLabel = count === 1 ? 'wall' : 'walls';
                      return t({
                        it: `Seleziona il materiale per ${count} ${itLabel}.`,
                        en: `Choose the material for ${count} ${enLabel}.`
                      });
                    })()}
                  </div>
                  <label className="mt-4 block text-sm font-semibold text-slate-700">
                    {t({ it: 'Materiale', en: 'Material' })}
                  </label>
                  <select
                    value={wallTypeDraft}
                    onChange={(e) => setWallTypeDraft(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {wallTypeDefs.map((def) => {
                      const label = getTypeLabel(def.id);
                      const attenuation = Number((def as any).attenuationDb);
                      const suffix = Number.isFinite(attenuation) ? ` (${attenuation} dB)` : '';
                      return (
                        <option key={def.id} value={def.id}>
                          {label}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setWallTypeModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={applyWallType}
                      className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      {t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!roomWallTypeModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setRoomWallTypeModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl modal-panel">
                  <Dialog.Title className="modal-title">
                    {t({ it: 'Muri stanza', en: 'Room walls' })}
                  </Dialog.Title>
                  <div className="mt-2 text-sm text-slate-600">
                    {t({
                      it:
                        roomWallTypeModal?.mode === 'edit'
                          ? `Modifica il materiale per i muri della stanza "${roomWallTypeModal?.roomName || 'stanza'}".`
                          : `Seleziona il materiale per i muri della stanza "${roomWallTypeModal?.roomName || 'stanza'}".`,
                      en:
                        roomWallTypeModal?.mode === 'edit'
                          ? `Edit the wall material for room "${roomWallTypeModal?.roomName || 'room'}".`
                          : `Choose the wall material for room "${roomWallTypeModal?.roomName || 'room'}".`
                    })}
                  </div>
                  {roomWallPreview ? (
                    <RoomShapePreview
                      points={roomWallPreview.points}
                      segments={roomWallPreview.segments}
                      className="mt-4 h-48 w-full"
                    />
                  ) : null}
                  <label className="mt-4 block text-sm font-semibold text-slate-700">
                    {t({ it: 'Tipo predefinito', en: 'Default wall type' })}
                  </label>
                  <select
                    value={roomWallTypeAllValue || ''}
                    onChange={(e) => applyRoomWallTypeAll(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="" disabled>
                      {t({ it: 'Selezione personalizzata', en: 'Custom selection' })}
                    </option>
                    {wallTypeDefs.map((def) => {
                      const label = getTypeLabel(def.id);
                      const attenuation = Number((def as any).attenuationDb);
                      const suffix = Number.isFinite(attenuation) ? ` (${attenuation} dB)` : '';
                      return (
                        <option key={def.id} value={def.id}>
                          {label}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      {(roomWallTypeModal?.segments || []).map((segment, index) => {
                        const value = roomWallTypeSelections[index] || defaultWallTypeId || DEFAULT_WALL_TYPES[0];
                        return (
                          <div key={`${segment.label}-${index}`} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                            <div className="min-w-[64px] text-xs font-semibold text-slate-600">{segment.label}</div>
                            <span
                              className="inline-flex h-3 w-3 rounded-full border border-slate-200"
                              style={{ background: getWallTypeColor(value) }}
                            />
                            <select
                              value={value}
                              onChange={(e) => setRoomWallTypeAt(index, e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            >
                              {wallTypeDefs.map((def) => {
                                const label = getTypeLabel(def.id);
                                const attenuation = Number((def as any).attenuationDb);
                                const suffix = Number.isFinite(attenuation) ? ` (${attenuation} dB)` : '';
                                return (
                                  <option key={def.id} value={def.id}>
                                    {label}
                                    {suffix}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setRoomWallTypeModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={createRoomWalls}
                      className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      {roomWallTypeModal?.mode === 'edit'
                        ? t({ it: 'Salva muri', en: 'Save walls' })
                        : t({ it: 'Crea muri', en: 'Create walls' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {modalState ? (
        <Suspense fallback={null}>
          <ObjectModal
		        open={!!modalState}
            objectId={modalState?.mode === 'edit' ? (modalState as any).objectId : undefined}
		        type={modalInitials?.type}
	          icon={modalInitials?.type ? getTypeIcon(modalInitials.type) : undefined}
            layers={planLayers
              .filter((l: any) => !SYSTEM_LAYER_IDS.has(String(l.id)))
              .map((l: any) => ({
                id: l.id,
                label: (l?.name?.[lang] as string) || (l?.name?.it as string) || l.id,
                color: l.color
              }))}
            initialLayerIds={(modalInitials as any)?.layerIds || []}
            initialScale={(modalInitials as any)?.scale}
            initialQuoteLabelScale={(modalInitials as any)?.quoteLabelScale}
            initialQuoteLabelBg={(modalInitials as any)?.quoteLabelBg}
            initialQuoteLabelColor={(modalInitials as any)?.quoteLabelColor}
            initialQuoteLabelOffset={(modalInitials as any)?.quoteLabelOffset}
            initialQuoteLabelPos={(modalInitials as any)?.quoteLabelPos}
            initialQuoteDashed={(modalInitials as any)?.quoteDashed}
            initialQuoteEndpoint={(modalInitials as any)?.quoteEndpoint}
            initialQuoteColor={(modalInitials as any)?.quoteColor}
            initialQuoteLengthLabel={(modalInitials as any)?.quoteLengthLabel}
            initialQuotePoints={(modalInitials as any)?.quotePoints}
            initialTextFont={(modalInitials as any)?.textFont}
            initialTextSize={(modalInitials as any)?.textSize}
            initialTextColor={(modalInitials as any)?.textColor}
            initialTextBg={(modalInitials as any)?.textBg}
            initialTextBgColor={(modalInitials as any)?.textBgColor}
            initialImageUrl={(modalInitials as any)?.imageUrl}
            initialImageWidth={(modalInitials as any)?.imageWidth}
            initialImageHeight={(modalInitials as any)?.imageHeight}
            initialIp={(modalInitials as any)?.ip}
            initialUrl={(modalInitials as any)?.url}
            initialNotes={(modalInitials as any)?.notes}
            initialLastVerificationAt={(modalInitials as any)?.lastVerificationAt}
            initialVerifierCompany={(modalInitials as any)?.verifierCompany}
            initialGpsCoords={(modalInitials as any)?.gpsCoords}
            initialSecurityDocuments={(modalInitials as any)?.securityDocuments}
            initialSecurityCheckHistory={(modalInitials as any)?.securityCheckHistory}
            typeLabel={
              modalState?.mode === 'create'
                ? `${t({ it: 'Nuovo', en: 'New' })} ${modalInitials?.type ? getTypeLabel(modalInitials.type) : ''} (${Math.round((modalState as any)?.coords?.x || 0)}, ${Math.round(
                    (modalState as any)?.coords?.y || 0
                  )})`
                : undefined
            }
            initialName={modalInitials?.name}
            initialDescription={modalInitials?.description}
            initialWifiDb={(modalInitials as any)?.wifiDb}
            initialWifiStandard={(modalInitials as any)?.wifiStandard}
            initialWifiBand24={(modalInitials as any)?.wifiBand24}
            initialWifiBand5={(modalInitials as any)?.wifiBand5}
            initialWifiBand6={(modalInitials as any)?.wifiBand6}
            initialWifiBrand={(modalInitials as any)?.wifiBrand}
            initialWifiModel={(modalInitials as any)?.wifiModel}
            initialWifiModelCode={(modalInitials as any)?.wifiModelCode}
            initialWifiCoverageSqm={(modalInitials as any)?.wifiCoverageSqm}
            initialWifiCatalogId={(modalInitials as any)?.wifiCatalogId}
            initialWifiShowRange={(modalInitials as any)?.wifiShowRange}
            initialWifiRangeScale={(modalInitials as any)?.wifiRangeScale}
            wifiModels={client?.wifiAntennaModels}
            readOnly={isReadOnly}
            onClose={() => {
              setModalState(null);
              closeReturnToSelectionList();
            }}
            onDelete={modalState?.mode === 'edit' ? () => {
              if (isReadOnly) return;
              if (!modalState || modalState.mode !== 'edit') return;
              markTouched();
              deleteObject(modalState.objectId);
              postAuditEvent({
                event: 'object_delete',
                scopeType: 'plan',
                scopeId: planId,
                details: { id: modalState.objectId }
              });
              setModalState(null);
              closeReturnToSelectionList();
              push(t({ it: 'Quota eliminata', en: 'Quote deleted' }), 'info');
            } : undefined}
            onSubmit={modalState?.mode === 'edit' ? handleUpdate : handleCreate}
          />
        </Suspense>
      ) : null}

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

      <Transition show={!!typeLayerModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setTypeLayerModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl modal-panel">
                  <div className="flex items-center justify-between gap-3">
                    <Dialog.Title className="modal-title">{t({ it: 'Crea layer per tipologia', en: 'Create type layer' })}</Dialog.Title>
                    <button
                      onClick={() => setTypeLayerModal(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: `Questo layer raccoglierà tutti gli oggetti "${typeLayerModal?.label || ''}".`,
                      en: `This layer will collect all "${typeLayerModal?.label || ''}" objects.`
                    })}
                  </Dialog.Description>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Nome layer', en: 'Layer name' })}
                      <input
                        ref={typeLayerNameRef}
                        value={typeLayerName}
                        onChange={(e) => setTypeLayerName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. Badge door', en: 'e.g. Badge door' })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && typeLayerName.trim()) {
                            handleCreateTypeLayer();
                          }
                        }}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Colore', en: 'Color' })}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={typeLayerColor}
                          onChange={(e) => setTypeLayerColor(e.target.value)}
                          className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-1"
                          aria-label={t({ it: 'Colore layer', en: 'Layer color' })}
                        />
                        <input
                          value={typeLayerColor}
                          onChange={(e) => setTypeLayerColor(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-mono outline-none ring-primary/30 focus:ring-2"
                          placeholder="#0ea5e9"
                        />
                      </div>
                    </label>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setTypeLayerModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={() => handleCreateTypeLayer()}
                      disabled={!typeLayerName.trim()}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t({ it: 'Crea layer', en: 'Create layer' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={realUserImportMissing} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setRealUserImportMissing(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Import utenti richiesto', en: 'User import required' })}</Dialog.Title>
                    <button
                      onClick={() => setRealUserImportMissing(false)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    {t({
                      it: 'Non è possibile trascinare un utente reale in quanto non è stato ancora importato nessun utente per questo cliente. Vai su Settings → Custom Import e carica la lista degli utenti reali.',
                      en: 'You cannot place a real user because no users have been imported for this client yet. Go to Settings → Custom Import and load the real users list.'
                    })}
                  </div>
                  <div className="mt-5 flex justify-end">
	                    <button
	                      onClick={() => setRealUserImportMissing(false)}
	                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
	                      title={t({ it: 'Ok', en: 'Ok' })}
	                    >
                      {t({ it: 'Ok', en: 'Ok' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={roomCatalogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setRoomCatalogOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Crea stanza', en: 'Create room' })}
                    </Dialog.Title>
                    <button
                      onClick={() => setRoomCatalogOpen(false)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Scegli la modalità di creazione stanza. Da tastiera: R per rettangolo, P per poligono.',
                      en: 'Choose the room creation mode. Keyboard: R for rectangle, P for polygon.'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => {
                        beginRoomDraw();
                        setRoomCatalogOpen(false);
                      }}
                      disabled={isReadOnly}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title={t({ it: 'Rettangolo', en: 'Rectangle' })}
                    >
                      <Square size={16} className="text-slate-500" />
                      {t({ it: 'Rettangolo', en: 'Rectangle' })}
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">R</span>
                    </button>
                    <button
                      onClick={() => {
                        beginRoomPolyDraw();
                        setRoomCatalogOpen(false);
                      }}
                      disabled={isReadOnly}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title={t({ it: 'Poligono', en: 'Polygon' })}
                    >
                      <Square size={16} className="text-slate-500" />
                      {t({ it: 'Poligono', en: 'Polygon' })}
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">P</span>
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={wallCatalogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setWallCatalogOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md modal-panel">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Catalogo mura', en: 'Wall catalog' })}
                    </Dialog.Title>
                    <button
                      onClick={() => setWallCatalogOpen(false)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Seleziona il tipo di muro da disegnare.',
                      en: 'Select the wall type to draw.'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto">
                    {wallTypeDefs.length ? (
                      wallTypeDefs.map((def) => (
                        <button
                          key={def.id}
                          onClick={() => {
                            startWallDraw(def.id);
                            setWallCatalogOpen(false);
                          }}
                          disabled={isReadOnly}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          title={getTypeLabel(def.id)}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getWallTypeColor(def.id) }} />
                          <span className="truncate">{getTypeLabel(def.id)}</span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {t({ it: 'Nessun muro disponibile.', en: 'No walls available.' })}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {roomModal ? <RoomModalContainer {...{ addRoom, basePlan, getTypeIcon, getTypeLabel, handleCreateWallsForRoom, hasRoomOverlap, isPointInRoom, isReadOnly, isUserObject, markTouched, metersPerPixel, notifyRoomOverlap, openPhotoViewer, push, resolveRoomAssignmentForObject, roomDepartmentOptions, roomHasWalls, roomModal, roomModalBaseRoom, roomModalInitialSurfaceSqm, roomModalMetrics, roomModalPreview, roomStatsById, setConfirmDelete, setHighlightRoom, setObjectRoomIds, setRoomModal, setRoomWallPrompt, setSelectedRoomId, setSelectedRoomIds, siteFloorPlans, skipRoomWallTypesRef, t, updateRoom }} /> : null}

      <Transition show={!!corridorModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCorridorModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {corridorModal?.mode === 'edit'
                        ? t({ it: 'Rinomina corridoio', en: 'Rename corridor' })
                        : t({ it: 'Nuovo corridoio', en: 'New corridor' })}
                    </Dialog.Title>
                    <button
                      onClick={() => setCorridorModal(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {corridorModal?.mode === 'edit'
                      ? t({
                          it: 'Aggiorna il nome del corridoio e scegli se mostrarlo in planimetria.',
                          en: 'Update corridor name and choose whether to display it on the map.'
                        })
                      : t({
                          it: 'Definisci il nome del corridoio appena disegnato e se deve essere visibile.',
                          en: 'Set corridor name and whether it should be visible.'
                        })}
                  </Dialog.Description>
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Nome corridoio', en: 'Corridor name' })}
                      <input
                        ref={corridorNameInputRef}
                        value={corridorNameInput}
                        onChange={(e) => setCorridorNameInput(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. Corridoio principale', en: 'e.g. Main corridor' })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveCorridorModal();
                          }
                        }}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      {t({ it: 'Nome corridoio (EN)', en: 'Corridor name (EN)' })}
                      <input
                        value={corridorNameEnInput}
                        onChange={(e) => setCorridorNameEnInput(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. Main corridor', en: 'e.g. Main corridor' })}
                      />
                    </label>
                    <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={corridorShowNameInput}
                        onChange={(e) => setCorridorShowNameInput(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span>{t({ it: 'Mostra nome dentro il corridoio', en: 'Show name inside corridor' })}</span>
                    </label>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setCorridorModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button onClick={saveCorridorModal} className="btn-primary">
                      {corridorModal?.mode === 'edit' ? t({ it: 'Salva', en: 'Save' }) : t({ it: 'Crea corridoio', en: 'Create corridor' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!corridorConnectionModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCorridorConnectionModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {corridorConnectionModal?.connectionId
                        ? t({ it: 'Modifica punto di collegamento tra piani', en: 'Edit floor-connection point' })
                        : t({ it: 'Nuovo punto di collegamento tra piani', en: 'New floor-connection point' })}
                    </Dialog.Title>
                    <button
                      onClick={() => setCorridorConnectionModal(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Opzionale: seleziona i piani collegati da questo punto di collegamento.',
                      en: 'Optional: select floor plans linked by this connection point.'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      {t({ it: 'Tipo collegamento', en: 'Connection type' })}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCorridorConnectionModal((prev) => (prev ? { ...prev, transitionType: 'stairs' } : prev))
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          corridorConnectionModal?.transitionType !== 'elevator'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {t({ it: 'Scale', en: 'Stairs' })}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCorridorConnectionModal((prev) => (prev ? { ...prev, transitionType: 'elevator' } : prev))
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          corridorConnectionModal?.transitionType === 'elevator'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {t({ it: 'Ascensore', en: 'Elevator' })}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {corridorConnectionTargetPlans.length ? (
                      corridorConnectionTargetPlans.map((floorPlan) => {
                        const checked = !!corridorConnectionModal?.selectedPlanIds.includes(floorPlan.id);
                        return (
                          <label
                            key={floorPlan.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nextChecked = e.target.checked;
                                setCorridorConnectionModal((prev) => {
                                  if (!prev) return prev;
                                  const ids = nextChecked
                                    ? Array.from(new Set([...prev.selectedPlanIds, floorPlan.id]))
                                    : prev.selectedPlanIds.filter((id) => id !== floorPlan.id);
                                  return { ...prev, selectedPlanIds: ids };
                                });
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="truncate">{floorPlan.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        {t({ it: 'Nessun altro piano disponibile in questa sede.', en: 'No other floor plans available in this site.' })}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setCorridorConnectionModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={saveCorridorConnectionModal}
                      className="btn-primary"
                    >
                      {corridorConnectionModal?.connectionId
                        ? t({ it: 'Salva modifiche', en: 'Save changes' })
                        : t({ it: 'Crea punto di collegamento', en: 'Create connection point' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!corridorDoorModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCorridorDoorModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Proprietà porta', en: 'Door properties' })}</Dialog.Title>
                    <button
                      onClick={() => setCorridorDoorModal(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({ it: 'Configura tipo e azione della porta selezionata.', en: 'Configure type and action for the selected door.' })}
                  </Dialog.Description>
                  <div className="mt-4 space-y-4">
                    {(() => {
                      const canOpenNow =
                        corridorDoorModal?.mode === 'automated' &&
                        /^https?:\/\//i.test(String(corridorDoorModal?.automationUrl || '').trim());
                      return (
                        <>
                          <label className="text-sm font-semibold text-slate-700">
                            {t({ it: 'Descrizione porta', en: 'Door description' })}
                            <textarea
                              value={corridorDoorModal?.description || ''}
                              onChange={(e) =>
                                setCorridorDoorModal((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        description: e.target.value
                                      }
                                    : prev
                                )
                              }
                              className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Es. Porta lato reception', en: 'e.g. Reception-side door' })}
                            />
                          </label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
	                                it: 'Se attivo puoi registrare verifiche e storico porta antipanico.',
	                                en: 'When enabled you can record checks and panic-door history.'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isEmergency}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isEmergency: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
	                              {t({ it: 'Antipanico', en: 'Panic' })}
                            </label>
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
                                it: 'Segna questa porta come ingresso principale.',
                                en: 'Mark this door as a main entrance.'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isMainEntrance}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isMainEntrance: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Ingresso principale', en: 'Main entrance' })}
                            </label>
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
                                it: "Segna questa porta come esterna (uscita verso l'esterno edificio).",
                                en: 'Mark this door as external (exit to outside of building).'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isExternal}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isExternal: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Esterno', en: 'External' })}
                            </label>
                            <label
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              title={t({
                                it: 'Segna la porta come tagliafuoco.',
                                en: 'Mark this door as fire-rated.'
                              })}
                            >
                              <input
                                type="checkbox"
                                checked={!!corridorDoorModal?.isFireDoor}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isFireDoor: e.target.checked
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Tagliafuoco', en: 'Fire-rated' })}
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={corridorDoorModal?.mode === 'auto_sensor'}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          mode: e.target.checked ? 'auto_sensor' : 'static'
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Apertura a rilevazione', en: 'Sensor opening' })}
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={corridorDoorModal?.mode === 'automated'}
                                onChange={(e) =>
                                  setCorridorDoorModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          mode: e.target.checked ? 'automated' : 'static'
                                        }
                                      : prev
                                  )
                                }
                              />
                              {t({ it: 'Apertura automatizzata', en: 'Automated opening' })}
                            </label>
                          </div>
                          {corridorDoorModal?.isEmergency ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                                {t({ it: 'Verifiche antipanico', en: 'Panic checks' })}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                  {t({ it: 'Data ultima verifica (opzionale)', en: 'Last check date (optional)' })}
                                  <input
                                    type="date"
                                    value={corridorDoorModal?.lastVerificationAt || ''}
                                    onChange={(e) =>
                                      setCorridorDoorModal((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              lastVerificationAt: e.target.value
                                            }
                                          : prev
                                      )
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                  />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                  {t({ it: 'Società verificatrice', en: 'Verifier company' })}
                                  <input
                                    value={corridorDoorModal?.verifierCompany || ''}
                                    onChange={(e) =>
                                      setCorridorDoorModal((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              verifierCompany: e.target.value
                                            }
                                          : prev
                                      )
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                    placeholder={t({ it: 'Es. SafeCheck Srl', en: 'e.g. SafeCheck Ltd' })}
                                  />
                                </label>
                              </div>
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const company = String(corridorDoorModal?.verifierCompany || '').trim();
                                    const date = String(corridorDoorModal?.lastVerificationAt || '').trim();
                                    if (!company && !date) {
                                      push(
                                        t({
                                          it: 'Inserisci almeno società o data per aggiungere una verifica allo storico.',
                                          en: 'Enter at least company or date to add a history check.'
                                        }),
                                        'info'
                                      );
                                      return;
                                    }
                                    setCorridorDoorModal((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            verificationHistory: normalizeDoorVerificationHistory([
                                              { id: nanoid(), company, date: date || undefined, createdAt: Date.now() },
                                              ...(prev.verificationHistory || [])
                                            ])
                                          }
                                        : prev
                                    );
                                  }}
                                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                  title={t({ it: 'Aggiungi verifica allo storico', en: 'Add check to history' })}
                                >
                                  <Plus size={13} />
                                  {t({ it: 'Aggiungi allo storico', en: 'Add to history' })}
                                </button>
                              </div>
                              <div className="mt-3 space-y-2">
                                {(corridorDoorModal?.verificationHistory || []).length ? (
                                  (corridorDoorModal?.verificationHistory || []).map((entry) => (
                                    <div key={entry.id} className="flex items-center justify-between rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-xs">
                                      <div className="min-w-0">
                                        <div className="truncate font-semibold text-slate-700">
                                          {entry.company || t({ it: 'Società non indicata', en: 'Company not specified' })}
                                        </div>
                                        <div className="text-slate-500">
                                          {(entry.date && entry.date.trim()) || t({ it: 'Data non indicata', en: 'Date not specified' })}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCorridorDoorModal((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  verificationHistory: (prev.verificationHistory || []).filter((item) => item.id !== entry.id)
                                                }
                                              : prev
                                          )
                                        }
                                        className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                                        title={t({ it: 'Rimuovi voce storico', en: 'Remove history entry' })}
                                      >
                                        <Trash size={12} />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-lg border border-dashed border-rose-200 bg-white px-2.5 py-2 text-xs text-slate-500">
                                    {t({ it: 'Nessuna verifica storica registrata.', en: 'No historical checks registered.' })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                          {corridorDoorModal?.mode === 'automated' ? (
                            <>
                              <label className="text-sm font-semibold text-slate-700">
                                {t({ it: 'Link apertura', en: 'Opening link' })}
                                <input
                                  value={corridorDoorModal?.automationUrl || ''}
                                  onChange={(e) =>
                                    setCorridorDoorModal((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            automationUrl: e.target.value
                                          }
                                        : prev
                                    )
                                  }
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                  placeholder="https://..."
                                />
                              </label>
                              <div className="text-xs text-slate-500">
                                {t({
                                  it: 'Il link è opzionale. Senza link il pulsante Apri non viene mostrato.',
                                  en: 'The link is optional. Without a link the Open button is hidden.'
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              {t({
                                it: 'Attiva la modalità automatizzata per configurare un eventuale link di apertura remota.',
                                en: 'Enable automated mode to optionally configure a remote opening link.'
                              })}
                            </div>
                          )}
                          {canOpenNow ? (
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const requestUrl = `${String(corridorDoorModal?.automationUrl || '').trim()}${
                                    String(corridorDoorModal?.automationUrl || '').includes('?') ? '&' : '?'
                                  }_plixmap_open_ts=${Date.now()}`;
                                  fetch(requestUrl, {
                                    method: 'GET',
                                    mode: 'no-cors',
                                    cache: 'no-store',
                                    keepalive: true
                                  }).catch(() => {});
                                  push(t({ it: 'Comando apertura porta avviato.', en: 'Door opening command started.' }), 'success');
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                title={t({ it: 'Apri', en: 'Open' })}
                              >
                                <DoorOpen size={14} />
                                {t({ it: 'Apri', en: 'Open' })}
                              </button>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setCorridorDoorModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button onClick={saveCorridorDoorModal} className="btn-primary">
                      {t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!corridorDoorLinkModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCorridorDoorLinkModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl modal-panel">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Collega stanza', en: 'Link room' })}</Dialog.Title>
                    <button
                      onClick={() => setCorridorDoorLinkModal(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Seleziona una o più stanze da collegare alla porta. Per default è selezionata la stanza più vicina.',
                      en: 'Select one or more rooms to link to this door. The nearest room is preselected by default.'
                    })}
                  </Dialog.Description>
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                    <span className="font-semibold">{t({ it: 'Guida rapida:', en: 'Quick hint:' })}</span>{' '}
                    {t({
                      it: 'badge verde = stanza più vicina alla porta; badge azzurro = prossimità al perimetro del corridoio.',
                      en: 'green badge = nearest room to the door; cyan badge = close to the corridor perimeter.'
                    })}
                  </div>
                  <div className="mt-4">
                    <input
                      value={corridorDoorLinkQuery}
                      onChange={(e) => setCorridorDoorLinkQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({
                        it: 'Cerca stanza o utente...',
                        en: 'Search room or user...'
                      })}
                    />
                  </div>
                  <div className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {corridorDoorLinkRoomEntries.length ? (
                      corridorDoorLinkRoomEntries.map((entry) => {
                        const checked = !!corridorDoorLinkModal?.selectedRoomIds.includes(entry.id);
                        return (
                          <label
                            key={entry.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 ${
                              checked ? 'border-primary/40 bg-primary/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nextChecked = e.target.checked;
                                setCorridorDoorLinkModal((prev) => {
                                  if (!prev) return prev;
                                  const ids = nextChecked
                                    ? Array.from(new Set([...prev.selectedRoomIds, entry.id]))
                                    : prev.selectedRoomIds.filter((id) => id !== entry.id);
                                  return { ...prev, selectedRoomIds: ids };
                                });
                              }}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-800">
                                {entry.name}{' '}
                                {entry.isNearest ? (
                                  <span
                                    className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900"
                                    title={t({
                                      it: 'Stanza più vicina alla porta rilevata automaticamente.',
                                      en: 'Nearest room to this door, detected automatically.'
                                    })}
                                  >
                                    {t({ it: 'rilevata prossimità', en: 'proximity detected' })}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-600">
                                {t({
                                  it: `Utenti: ${entry.userCount} · Utenti reali: ${entry.realUserCount}`,
                                  en: `Users: ${entry.userCount} · Real users: ${entry.realUserCount}`
                                })}
                              </div>
                              {entry.isMagnetic ? (
                                <div
                                  className="mt-0.5 inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800"
                                  title={t({
                                    it: 'La stanza è adiacente al perimetro del corridoio vicino alla porta.',
                                    en: 'The room is adjacent to the corridor perimeter near this door.'
                                  })}
                                >
                                  {t({ it: 'Aggancio magnetico corridoio rilevato', en: 'Corridor magnetic match detected' })}
                                </div>
                              ) : null}
                              <div className="mt-1 text-[11px] text-slate-500">
                                {entry.userNames.length
                                  ? entry.userNames.join(', ')
                                  : t({ it: 'Nessun utente assegnato alla stanza', en: 'No users assigned to this room' })}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        {t({ it: 'Nessuna stanza trovata con questi filtri.', en: 'No rooms found with these filters.' })}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <div className="mr-auto text-xs text-slate-500">
                      {t({
                        it: `${corridorDoorLinkModal?.selectedRoomIds.length || 0} stanze selezionate`,
                        en: `${corridorDoorLinkModal?.selectedRoomIds.length || 0} rooms selected`
                      })}
                    </div>
                    <button
                      onClick={() => setCorridorDoorLinkModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button onClick={saveCorridorDoorLinkModal} className="btn-primary">
                      {t({ it: 'Salva collegamenti', en: 'Save links' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

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

      <Transition show={scaleActionsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setScaleActionsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-card transition-all">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Scala planimetria', en: 'Floor plan scale' })}
                    </Dialog.Title>
                    <button
                      onClick={() => setScaleActionsOpen(false)}
                      className="text-slate-400 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Vuoi aggiornare la scala o rimuoverla dalla planimetria?',
                      en: 'Do you want to update the scale or remove it from the floor plan?'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>{t({ it: 'Dimensione impostata', en: 'Set size' })}</span>
                      <span className="font-mono text-slate-800">
                        {scaleLabel || t({ it: 'Non impostata', en: 'Not set' })}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <MoveDiagonal size={14} />
                          {t({ it: 'Spessore linea scala', en: 'Scale line thickness' })}
                          <span className="ml-auto text-xs font-mono text-slate-600 tabular-nums">
                            {Number(planScale?.strokeWidth ?? 1.2).toFixed(1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={6}
                          step={0.1}
                          value={Number(planScale?.strokeWidth ?? 1.2)}
                          onChange={(e) => updateScaleStyle({ strokeWidth: Number(e.target.value) })}
                          className="mt-1 w-full"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <MoveDiagonal size={14} />
                          {t({ it: 'Scala etichetta', en: 'Label scale' })}
                          <span className="ml-auto text-xs font-mono text-slate-600 tabular-nums">
                            {Number(planScale?.labelScale ?? 1).toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={1.8}
                          step={0.05}
                          value={Number(planScale?.labelScale ?? 1)}
                          onChange={(e) => updateScaleStyle({ labelScale: Number(e.target.value) })}
                          className="mt-1 w-full"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setScaleActionsOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={() => {
                        setScaleActionsOpen(false);
                        openScaleEdit();
                      }}
                      className="btn-secondary"
                    >
                      {t({ it: 'Ricalibra scala', en: 'Recalibrate scale' })}
                    </button>
                    <button
                      onClick={() => {
                        setScaleActionsOpen(false);
                        setClearScaleConfirmOpen(true);
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    >
                      {t({ it: 'Elimina scala', en: 'Delete scale' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmDialog
        open={!!capacityConfirm}
        title={t({ it: 'Capienza stanza superata', en: 'Room capacity exceeded' })}
        description={t({
          it: `La stanza "${capacityConfirm?.roomName || t({ it: 'Stanza', en: 'Room' })}" ospita un massimo di ${capacityConfirm?.capacity || 0} postazioni. Vuoi continuare comunque?`,
          en: `Room "${capacityConfirm?.roomName || t({ it: 'Room', en: 'Room' })}" hosts a maximum of ${capacityConfirm?.capacity || 0} seats. Do you want to continue anyway?`
        })}
        confirmLabel={t({ it: 'Sì', en: 'Yes' })}
        cancelLabel={t({ it: 'No', en: 'No' })}
        onCancel={() => {
          const current = capacityConfirmRef.current;
          if (current?.mode === 'move' && current.objectId) {
            moveObject(current.objectId, current.prevX ?? 0, current.prevY ?? 0);
            updateObject(current.objectId, { roomId: current.prevRoomId });
            dragStartRef.current.delete(current.objectId);
          }
          setCapacityConfirm(null);
        }}
        onConfirm={() => {
          const current = capacityConfirmRef.current;
          if (!current) return;
          const { mode, type, x, y, objectId, roomId } = current;
          if (mode === 'move' && objectId) {
            markTouched();
            moveObject(objectId, x, y);
            updateObject(objectId, { roomId });
            dragStartRef.current.delete(objectId);
            setCapacityConfirm(null);
            return;
          }
          setCapacityConfirm(null);
          proceedPlaceUser(type, x, y);
        }}
      />

      <ConfirmDialog
        open={!!overlapNotice}
        title={t({ it: 'Sovrapposizione non consentita', en: 'Overlap not allowed' })}
        description={overlapNotice || undefined}
        confirmLabel={t({ it: 'Ok', en: 'Ok' })}
        cancelLabel={null}
        onCancel={() => setOverlapNotice(null)}
        onConfirm={() => setOverlapNotice(null)}
      />

      <ConfirmDialog
        open={!!roomDepartmentConfirm}
        title={t({ it: 'Allineare reparto stanza?', en: 'Align room department?' })}
        description={
          roomDepartmentConfirm
            ? t({
                it: `L'utente "${roomDepartmentConfirm.userName}" appartiene al reparto "${roomDepartmentConfirm.departmentToAdd}", che non è presente nella stanza "${roomDepartmentConfirm.roomName}". Vuoi aggiungere questo reparto alla stanza?`,
                en: `User "${roomDepartmentConfirm.userName}" belongs to department "${roomDepartmentConfirm.departmentToAdd}", which is not currently assigned to room "${roomDepartmentConfirm.roomName}". Do you want to add this department to the room?`
              })
            : undefined
        }
        confirmLabel={t({ it: 'Aggiungi reparto', en: 'Add department' })}
        cancelLabel={t({ it: 'Non aggiungere', en: 'Do not add' })}
        onCancel={() => {
          const current = roomDepartmentConfirm;
          if (current?.objectId) {
            markTouched();
            moveObject(current.objectId, current.x, current.y);
            updateObject(current.objectId, { roomId: current.roomId });
            dragStartRef.current.delete(current.objectId);
          }
          setRoomDepartmentConfirm(null);
        }}
        onConfirm={() => {
          const current = roomDepartmentConfirm;
          if (!current?.objectId) return;
          const currentPlan = planRef.current as FloorPlan | undefined;
          if (currentPlan) {
            const room = (currentPlan.rooms || []).find((entry) => entry.id === current.roomId);
            if (room) {
              const existingTags = Array.isArray((room as any)?.departmentTags)
                ? ((room as any).departmentTags as any[])
                    .map((tag) => String(tag || '').trim())
                    .filter(Boolean)
                : [];
              const exists = existingTags.some(
                (tag) => tag.toLocaleLowerCase() === String(current.departmentToAdd || '').trim().toLocaleLowerCase()
              );
              if (!exists) {
                updateRoom(currentPlan.id, room.id, { departmentTags: [...existingTags, current.departmentToAdd] } as any);
              }
            }
          }
          markTouched();
          moveObject(current.objectId, current.x, current.y);
          updateObject(current.objectId, { roomId: current.roomId });
          dragStartRef.current.delete(current.objectId);
          setRoomDepartmentConfirm(null);
        }}
      />

      <ConfirmDialog
        open={!!undoConfirm}
        title={t({ it: 'Annullare inserimento?', en: 'Undo placement?' })}
        description={
          undoConfirm
            ? t({
                it: `Stai per annullare l’inserimento dell’oggetto "${undoConfirm.name}".`,
                en: `You are about to undo the insertion of "${undoConfirm.name}".`
              })
            : undefined
        }
        confirmLabel={t({ it: 'Annulla inserimento', en: 'Undo placement' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setUndoConfirm(null)}
        onConfirm={() => {
          if (!undoConfirm) return;
          markTouched();
          deleteObject(undoConfirm.id);
          postAuditEvent({ event: 'object_undo', scopeType: 'plan', scopeId: planId, details: { id: undoConfirm.id } });
          push(t({ it: 'Inserimento annullato', en: 'Placement undone' }), 'info');
          lastInsertedRef.current = null;
          setUndoConfirm(null);
        }}
      />

      <ConfirmDialog
        open={clearScaleConfirmOpen}
        title={t({ it: 'Rimuovere la scala?', en: 'Remove the scale?' })}
        description={t({
          it: 'Se rimuovi la scala, i range WiFi spariranno finché non ne imposti una nuova e le quote verranno convertite in pixel. Confermi?',
          en: 'If you remove the scale, WiFi ranges will disappear until you set a new one, and existing quotes will switch to pixels. Continue?'
        })}
        confirmLabel={t({ it: 'Rimuovi scala', en: 'Remove scale' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setClearScaleConfirmOpen(false)}
        onConfirm={() => {
          setClearScaleConfirmOpen(false);
          clearScaleNow();
        }}
      />

      <ConfirmDialog
        open={!!pasteConfirm}
        title={pasteConfirm?.title || ''}
        description={pasteConfirm?.description}
        confirmLabel={t({ it: 'Incolla', en: 'Paste' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={cancelPaste}
        onConfirm={confirmPaste}
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

      <Transition show={!!roomMeetingDeleteModal && !meetingManagerOpen && !roomMeetingDuplicateModal} as={Fragment}>
        <Dialog as="div" className="relative z-[92]" onClose={() => setRoomMeetingDeleteModal(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Eliminare meeting?', en: 'Delete meeting?' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Controlla i dettagli prima di confermare. Se era attivo invio mail, i partecipanti verranno notificati.',
                          en: 'Review details before confirming. If email delivery was enabled, participants will be notified.'
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRoomMeetingDeleteModal(null)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {roomMeetingDeleteModal?.booking ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Oggetto', en: 'Subject' })}</div>
                        <div className="text-sm font-semibold text-ink">{roomMeetingDeleteModal.booking.subject || t({ it: 'Meeting', en: 'Meeting' })}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Data / ora', en: 'Date / time' })}</div>
                        <div className="text-sm font-semibold text-ink">
                          {new Date(roomMeetingDeleteModal.booking.startAt).toLocaleDateString()} •{' '}
                          {new Date(roomMeetingDeleteModal.booking.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-
                          {new Date(roomMeetingDeleteModal.booking.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Sala', en: 'Room' })}</div>
                        <div className="text-sm font-semibold text-ink">{roomMeetingsTimelineModal?.roomName || '-'}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Richiedente', en: 'Requester' })}</div>
                        <div className="text-sm font-semibold text-ink">{roomMeetingDeleteModal.booking.requestedByUsername || '-'}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Partecipanti', en: 'Participants' })}</div>
                        <div className="text-sm font-semibold text-ink">{Array.isArray(roomMeetingDeleteModal.booking.participants) ? roomMeetingDeleteModal.booking.participants.length : 0}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Invio mail', en: 'Email delivery' })}</div>
                        <div className="text-sm font-semibold text-ink">
                          {roomMeetingDeleteModal.booking.sendEmail ? t({ it: 'Sì', en: 'Yes' }) : t({ it: 'No', en: 'No' })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {roomMeetingDeleteModal?.error ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{roomMeetingDeleteModal.error}</div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRoomMeetingDeleteModal(null)}
                      disabled={!!roomMeetingDeleteModal?.deleting}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDeleteRoomMeetingBooking()}
                      disabled={!!roomMeetingDeleteModal?.deleting}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {roomMeetingDeleteModal?.deleting ? <Loader2 size={14} className="animate-spin" /> : null}
                      {t({ it: 'Elimina meeting', en: 'Delete meeting' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!roomMeetingsTimelineModal && !meetingManagerOpen && !roomMeetingDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[75]"
          onClose={() => {
            if (meetingManagerOpen) return;
            if (roomMeetingsTimelineBookingDetail) return;
            if (Date.now() < roomMeetingsTimelineDetailCloseGuardUntilRef.current) return;
            closeRoomMeetingsTimelineModal();
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[1320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Mostra meetings', en: 'Show meetings' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {(client?.shortName || client?.name || '-') + ' • ' + (site?.name || '-') + ' • ' + (roomMeetingsTimelineModal?.roomName || '-')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeRoomMeetingsTimelineModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[420px,minmax(0,1fr),auto]">
                    <div className="grid grid-cols-[auto,220px,auto] items-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextDay = shiftIsoDay(roomMeetingsTimelineModal?.day || currentLocalIsoDay(), -1);
                          setRoomMeetingsTimelineModal((prev) => (prev ? { ...prev, day: nextDay } : prev));
                          if (roomMeetingsTimelineModal?.roomId) void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, nextDay);
                        }}
                        className="h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Giorno precedente', en: 'Previous day' })}
                      >
                        <ChevronLeft size={16} />
                      </button>
                    <label className="text-xs font-semibold text-slate-600">
                      {t({ it: 'Data', en: 'Date' })}
                      <input
                        type="date"
                        value={roomMeetingsTimelineModal?.day || currentLocalIsoDay()}
                        onChange={(e) => {
                          const nextDay = e.target.value || currentLocalIsoDay();
                          setRoomMeetingsTimelineModal((prev) => (prev ? { ...prev, day: nextDay } : prev));
                          if (roomMeetingsTimelineModal?.roomId) void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, nextDay);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextDay = shiftIsoDay(roomMeetingsTimelineModal?.day || currentLocalIsoDay(), 1);
                          setRoomMeetingsTimelineModal((prev) => (prev ? { ...prev, day: nextDay } : prev));
                          if (roomMeetingsTimelineModal?.roomId) void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, nextDay);
                        }}
                        className="h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Giorno successivo', en: 'Next day' })}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="relative">
                      <label className="text-xs font-semibold text-slate-600">
                        {t({ it: 'Ricerca meeting (ID o titolo)', en: 'Search meeting (ID or title)' })}
                      </label>
                      <div className="relative mt-1">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={roomMeetingsTimelineSearchInputRef}
                          value={roomMeetingsTimelineSearchTerm}
                          onChange={(e) => {
                            setRoomMeetingsTimelineSearchTerm(e.target.value);
                            setRoomMeetingsTimelineSearchActiveIndex(-1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setRoomMeetingsTimelineSearchActiveIndex((prev) =>
                                Math.min((roomMeetingsTimelineSearchResults.length || 1) - 1, Math.max(0, prev + 1))
                              );
                              return;
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setRoomMeetingsTimelineSearchActiveIndex((prev) =>
                                Math.max(0, prev <= 0 ? 0 : prev - 1)
                              );
                              return;
                            }
                            if (e.key === 'Enter') {
                              const candidate = roomMeetingsTimelineSearchResults[roomMeetingsTimelineSearchActiveIndex];
                              if (candidate) {
                                e.preventDefault();
                                jumpToTimelineMeetingFromSearch(candidate);
                              }
                            }
                            if (e.key === 'Escape') {
                              setRoomMeetingsTimelineSearchTerm('');
                              setRoomMeetingsTimelineSearchResults([]);
                              setRoomMeetingsTimelineSearchActiveIndex(-1);
                              setRoomMeetingsTimelineSearchError(null);
                            }
                          }}
                          placeholder={t({ it: 'Es. #104 o Budget review', en: 'e.g. #104 or Budget review' })}
                          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                        />
                        {roomMeetingsTimelineSearchLoading ? (
                          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                        ) : null}
                      </div>
                      {String(roomMeetingsTimelineSearchTerm || '').trim() ? (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {roomMeetingsTimelineSearchError ? (
                            <div className="px-3 py-2 text-xs font-semibold text-rose-600">{roomMeetingsTimelineSearchError}</div>
                          ) : null}
                          {!roomMeetingsTimelineSearchLoading && !roomMeetingsTimelineSearchError && !roomMeetingsTimelineSearchResults.length ? (
                            <div className="px-3 py-2 text-xs text-slate-500">
                              {t({ it: 'Nessun risultato.', en: 'No results.' })}
                            </div>
                          ) : null}
                          {roomMeetingsTimelineSearchResults.map((row, index) => {
                            const isActive = index === roomMeetingsTimelineSearchActiveIndex;
                            const startAt = Number(row.booking.startAt || 0);
                            const endAt = Number(row.booking.endAt || 0);
                            const meetingNumber = Number((row.booking as any)?.meetingNumber || 0);
                            return (
                              <button
                                key={`timeline-search-${row.booking.id}`}
                                type="button"
                                onMouseEnter={() => setRoomMeetingsTimelineSearchActiveIndex(index)}
                                onClick={() => jumpToTimelineMeetingFromSearch(row)}
                                className={`block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
                                  isActive ? 'bg-sky-50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                                  <span className="truncate">
                                    {meetingNumber > 0 ? `#${meetingNumber} • ` : ''}
                                    {row.booking.subject || t({ it: 'Meeting', en: 'Meeting' })}
                                  </span>
                                  <span className="shrink-0 text-slate-500">
                                    {new Date(startAt).toLocaleDateString()} •{' '}
                                    {new Date(startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-
                                    {new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  {t({ it: 'Partecipanti', en: 'Participants' })}: {row.participantsCount} • {row.participantsLabel}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!roomMeetingsTimelineModal?.roomId) return;
                          openMeetingManager({
                            roomId: roomMeetingsTimelineModal.roomId,
                            floorPlanId: planId,
                            siteId: site?.id,
                            clientId: client?.id,
                            day: roomMeetingsTimelineModal.day
                          });
                        }}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        title={t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      >
                        <Plus size={14} className="mr-1 inline-block" />
                        {t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (roomMeetingsTimelineModal?.roomId) {
                            void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, roomMeetingsTimelineModal.day);
                          }
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Aggiorna', en: 'Refresh' })}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {roomMeetingsTimelineModal?.error ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {roomMeetingsTimelineModal.error}
                      </div>
                    ) : null}
                    <div ref={roomMeetingsTimelineScrollRef} className="overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 bg-white">
                      {(() => {
                        const modal = roomMeetingsTimelineModal;
                        const bookings = modal?.bookings || [];
                        let minMinutes = 7 * 60;
                        let maxMinutes = 20 * 60;
                        for (const booking of bookings) {
                          const s = new Date(Number(booking.startAt || 0));
                          const e = new Date(Number(booking.endAt || 0));
                          if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) continue;
                          minMinutes = Math.min(minMinutes, s.getHours() * 60 + s.getMinutes());
                          maxMinutes = Math.max(maxMinutes, e.getHours() * 60 + e.getMinutes());
                        }
                        minMinutes = Math.max(0, Math.floor((minMinutes - 30) / 60) * 60);
                        maxMinutes = Math.min(24 * 60, Math.ceil((maxMinutes + 30) / 60) * 60);
                        if (maxMinutes - minMinutes < 6 * 60) maxMinutes = Math.min(24 * 60, minMinutes + 6 * 60);
                        const total = Math.max(1, maxMinutes - minMinutes);
                        const hourCount = Math.max(1, Math.ceil((maxMinutes - minMinutes) / 60));
                        const hours = Array.from({ length: hourCount + 1 }, (_, i) => minMinutes + i * 60);
                        const timelineWidthPx = Math.max(980, hourCount * 120);
                        const selectedDay = String(modal?.day || '');
                        const nowDate = new Date();
                        const todayIso = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
                        const showNow = selectedDay === todayIso;
                        const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
                        return (
                          <div className="min-w-[1220px]" style={{ width: `${240 + timelineWidthPx}px` }}>
                            <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `240px ${timelineWidthPx}px` }}>
                              <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {t({ it: 'Meeting room', en: 'Meeting room' })}
                              </div>
                              <div className="relative h-12 overflow-hidden" style={{ width: `${timelineWidthPx}px` }}>
                                {hours.map((minute) => {
                                  const left = ((minute - minMinutes) / total) * 100;
                                  return (
                                    <div key={`rm-hour-${minute}`} className="absolute inset-y-0" style={{ left: `${left}%` }}>
                                      <div className="h-full border-l border-slate-200" />
                                    </div>
                                  );
                                })}
                                {hours.slice(0, -1).map((minute) => {
                                  const left = (((minute + 30) - minMinutes) / total) * 100;
                                  return (
                                    <div key={`rm-hour-label-${minute}`} className="absolute top-2 -translate-x-1/2 text-center text-[11px] font-semibold text-slate-500" style={{ left: `${left}%`, width: '70px' }}>
                                      {`${String(Math.floor(minute / 60)).padStart(2, '0')}:00`}
                                    </div>
                                  );
                                })}
                                {showNow ? (
                                  <div className="absolute inset-y-0 z-10" style={{ left: `${((nowMinutes - minMinutes) / total) * 100}%` }}>
                                    <div className="absolute top-7 left-0 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                      {t({ it: 'ORA', en: 'NOW' })}
                                    </div>
                                    <div className="h-full border-l-2 border-blue-500/70" />
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="grid" style={{ gridTemplateColumns: `240px ${timelineWidthPx}px` }}>
                              <div
                                className={`border-r px-3 py-3 ${
                                  getMeetingRoomActiveToneClass((modal?.bookings || []).some((booking) => isApprovedMeetingInProgress(booking, Date.now())))
                                }`}
                                style={{ position: 'sticky', left: 0, zIndex: 10 }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate text-base font-semibold text-ink">{modal?.roomName || '-'}</div>
                                  {modal?.roomId ? (
                                    <button
                                      type="button"
                                      onClick={(evt) => {
                                        evt.preventDefault();
                                        evt.stopPropagation();
                                        closeRoomMeetingsTimelineModal();
                                        setHighlightRoom({ roomId: modal.roomId, until: Date.now() + 3200 });
                                      }}
                                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                      title={t({ it: 'Mostra posizione stanza in planimetria', en: 'Show room on floor plan' })}
                                    >
                                      <Eye size={14} />
                                    </button>
                                  ) : null}
                                </div>
                                <div className="truncate text-xs text-slate-600">
                                  {[site?.name, String(basePlan?.name || '').trim()].filter(Boolean).join(' - ') || '-'}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  {t({ it: 'Capienza', en: 'Capacity' })}: {modal?.capacity || 0}
                                </div>
                              </div>
                              <div className="relative h-[94px] bg-white" style={{ width: `${timelineWidthPx}px` }}>
                                {hours.map((minute) => {
                                  const left = ((minute - minMinutes) / total) * 100;
                                  return <div key={`rm-grid-${minute}`} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${left}%` }} />;
                                })}
                                {showNow ? (
                                  <div className="absolute inset-y-0 z-10 border-l-2 border-blue-500/70" style={{ left: `${((nowMinutes - minMinutes) / total) * 100}%` }} />
                                ) : null}
                                {(bookings || []).map((booking) => {
                                  const s = new Date(Number(booking.startAt || 0));
                                  const e = new Date(Number(booking.endAt || 0));
                                  const es = new Date(Number((booking as any).effectiveStartAt || booking.startAt || 0));
                                  const ee = new Date(Number((booking as any).effectiveEndAt || booking.endAt || 0));
                                  const startMin = s.getHours() * 60 + s.getMinutes();
                                  const endMin = e.getHours() * 60 + e.getMinutes();
                                  const effStartMin = es.getHours() * 60 + es.getMinutes();
                                  const effEndMin = ee.getHours() * 60 + ee.getMinutes();
                                  const clampedStart = Math.max(minMinutes, Math.min(maxMinutes, startMin));
                                  const clampedEnd = Math.max(clampedStart + 1, Math.max(minMinutes, Math.min(maxMinutes, endMin)));
                                  const clampedEffStart = Math.max(minMinutes, Math.min(maxMinutes, effStartMin));
                                  const clampedEffEnd = Math.max(clampedEffStart + 1, Math.max(minMinutes, Math.min(maxMinutes, effEndMin)));
                                  const left = ((clampedStart - minMinutes) / total) * 100;
                                  const width = Math.max(1, ((clampedEnd - clampedStart) / total) * 100);
                                  const effLeft = ((clampedEffStart - minMinutes) / total) * 100;
                                  const effWidth = Math.max(1, ((clampedEffEnd - clampedEffStart) / total) * 100);
                                  const nowTs = Date.now();
                                  const { tone, blockedTone } = getMeetingTimelineDayClasses(booking.startAt, booking.endAt, nowTs);
                                  const isHighlighted = String(roomMeetingsTimelineHighlightBookingId || '') === String(booking.id || '');
                                  const meetingNumber = Number((booking as any)?.meetingNumber || 0);
                                  return (
                                    <Fragment key={booking.id}>
                                      <div
                                        className={`absolute top-1 h-[76px] rounded-lg border border-dashed ${blockedTone}`}
                                        style={{ left: `${effLeft}%`, width: `${effWidth}%` }}
                                        title={`${t({ it: 'Blocco con setup', en: 'Blocked range incl. setup' })}: ${es.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${ee.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                      />
                                      <div
                                        className={`absolute h-[52px] overflow-hidden rounded-lg border px-2 py-1 shadow-sm cursor-pointer ${tone} ${
                                          isHighlighted ? 'ring-2 ring-primary ring-offset-1' : ''
                                        }`}
                                        style={{ left: `${left}%`, width: `${width}%`, top: '12px' }}
                                        title={`${booking.subject} • ${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                        onClick={() => openRoomMeetingBookingDetail(booking)}
                                        onContextMenu={(evt) => {
                                          evt.preventDefault();
                                          evt.stopPropagation();
                                          setRoomMeetingTimelineContextMenu({
                                            x: evt.clientX,
                                            y: evt.clientY,
                                            booking
                                          });
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(evt) => {
                                          if (evt.key === 'Enter' || evt.key === ' ') {
                                            evt.preventDefault();
                                            openRoomMeetingBookingDetail(booking);
                                          }
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="min-w-0 truncate text-xs font-semibold">
                                            {meetingNumber > 0 ? `#${meetingNumber} • ` : ''}
                                            {booking.subject || t({ it: 'Meeting', en: 'Meeting' })}
                                          </div>
                                          <div className="flex shrink-0 items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={(evt) => {
                                                evt.preventDefault();
                                                evt.stopPropagation();
                                                openRoomMeetingBookingDetail(booking, 'edit');
                                              }}
                                              className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/70 text-slate-700 hover:bg-white"
                                              title={t({ it: 'Modifica meeting', en: 'Edit meeting' })}
                                            >
                                              <Pencil size={10} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(evt) => {
                                                evt.preventDefault();
                                                evt.stopPropagation();
                                                promptDeleteRoomMeetingBooking(booking);
                                              }}
                                              className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/70 text-rose-700 hover:bg-white"
                                              title={t({ it: 'Elimina meeting', en: 'Delete meeting' })}
                                            >
                                              <Trash size={10} />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="truncate text-[11px] opacity-90">
                                          {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="truncate text-[10px] opacity-80">{booking.requestedByUsername || '-'}</div>
                                      </div>
                                    </Fragment>
                                  );
                                })}
                                {!bookings.length && !modal?.loading ? (
                                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                                    {t({ it: 'Nessun meeting per la data selezionata.', en: 'No meetings for the selected date.' })}
                                  </div>
                                ) : null}
                                {modal?.loading ? (
                                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                                    {t({ it: 'Caricamento...', en: 'Loading...' })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={closeRoomMeetingsTimelineModal}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>

                  {roomMeetingTimelineContextMenu ? (
                    <div
                      ref={roomMeetingTimelineContextMenuRef}
                      className="fixed z-[90] min-w-[210px] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                      style={{ left: Math.max(12, roomMeetingTimelineContextMenu.x), top: Math.max(12, roomMeetingTimelineContextMenu.y) }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openRoomMeetingDuplicateModal(roomMeetingTimelineContextMenu.booking)}
                        className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy size={14} />
                        <span>{t({ it: 'Duplica…', en: 'Duplicate…' })}</span>
                      </button>
                      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Estendi', en: 'Extend' })}
                      </div>
                      {Number(roomMeetingTimelineContextMenu.booking.endAt || 0) <= Date.now() ? (
                        <div className="px-2 py-2 text-xs font-semibold text-slate-400">
                          {t({ it: 'Meeting concluso: estensione non consentita.', en: 'Meeting ended: extension is not allowed.' })}
                        </div>
                      ) : (
                        [
                          ['10m', t({ it: '10m', en: '10m' })],
                          ['30m', t({ it: '30m', en: '30m' })],
                          ['1h', t({ it: '1h', en: '1h' })],
                          ['1.5h', t({ it: '1,5h', en: '1.5h' })],
                          ['2h', t({ it: '2h', en: '2h' })],
                          ['max', t({ it: 'Più possibile', en: 'As much as possible' })]
                        ].map(([key, label]) => (
                          <button
                            key={`extend-${key}`}
                            type="button"
                            disabled={roomMeetingExtendBusyId === String(roomMeetingTimelineContextMenu.booking.id)}
                            onClick={() => void extendRoomMeetingBooking(roomMeetingTimelineContextMenu.booking, key as any)}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <span>{label}</span>
                            {roomMeetingExtendBusyId === String(roomMeetingTimelineContextMenu.booking.id) ? <Loader2 size={13} className="animate-spin" /> : null}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!roomMeetingsTimelineBookingDetail && !meetingManagerOpen && !roomMeetingDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[120]"
          initialFocus={roomMeetingDetailFocusRef}
          onClose={() => {
            if (roomMeetingEditBusinessPartnersModalOpen || roomMeetingEditParticipantsModalOpen) return;
            closeRoomMeetingBookingDetail();
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {roomMeetingsTimelineBookingDetail?.mode === 'edit'
                          ? t({ it: 'Modifica meeting', en: 'Edit meeting' })
                          : t({ it: 'Dettaglio meeting', en: 'Meeting details' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {roomMeetingsTimelineBookingDetail?.booking?.sendEmail
                          ? t({ it: 'Invio mail attivo: modifica/eliminazione notificheranno i partecipanti.', en: 'Email delivery enabled: update/delete will notify participants.' })
                          : t({ it: 'Invio mail non attivo su questo meeting.', en: 'Email delivery is not enabled for this meeting.' })}
                      </div>
                    </div>
                    <button
                      ref={roomMeetingDetailFocusRef}
                      type="button"
                      onClick={() => closeRoomMeetingBookingDetail()}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {roomMeetingsTimelineBookingDetail ? <RoomMeetingBookingDetailPanel {...{ addTimelineMeetingManualParticipant, addTimelineMeetingRealParticipant, adjustRoomMeetingEditEndTime, canOpenBusinessPartnersDirectory, canUseMeetingNotes, client, clientBusinessPartnerNames, closeRoomMeetingBookingDetail, closeRoomMeetingEditParticipantsModal, extendRoomMeetingBooking, getMeetingCheckInStats, getRoomMeetingCheckInEntries, lang, meetingCheckInEntryKey, openRoomMeetingDuplicateModal, openRoomMeetingEditParticipantsModal, push, removeTimelineMeetingParticipant, roomMeetingCheckInListOpen, roomMeetingEditBusinessPartnersModalOpen, roomMeetingEditManualCompanyIsOther, roomMeetingEditParticipantCandidates, roomMeetingEditParticipantsCloseGuardUntilRef, roomMeetingEditParticipantsModalOpen, roomMeetingEditParticipantsNameInputRef, roomMeetingExtendBusyId, roomMeetingsTimelineBookingDetail, roomMeetingsTimelineModal, saveRoomMeetingBookingEdit, setRoomMeetingCheckInListOpen, setRoomMeetingEditBusinessPartnersModalOpen, setRoomMeetingEditManualCompanyIsOther, setRoomMeetingNotesModalBooking, setRoomMeetingNotesModalState, setRoomMeetingNotesReturnToMyMeetings, setRoomMeetingsTimelineBookingDetail, site, t, toggleTimelineMeetingParticipantFlag }} /> : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

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

      {meetingManagerOpen ? (
        <Suspense fallback={null}>
          <MeetingManagerModal
            open={meetingManagerOpen}
            clients={allClients}
            initialClientId={meetingManagerPreset?.clientId || client?.id}
            initialSiteId={meetingManagerPreset?.siteId || site?.id}
            initialFloorPlanId={meetingManagerPreset?.floorPlanId || planId}
            initialRoomId={meetingManagerPreset?.roomId}
            initialDay={meetingManagerPreset?.day}
            onClose={() => {
              setMeetingManagerOpen(false);
              setMeetingManagerPreset(null);
            }}
            onCreated={() => {
              const cid = String(client?.id || '').trim();
              const sid = String(site?.id || '').trim();
              if (cid && sid) {
                void fetchMeetingOverview({ clientId: cid, siteId: sid, floorPlanId: planId, day: currentLocalIsoDay() })
                  .then((payload) => {
                    const nowTs = Date.now();
                    const next: Record<string, { hasMeetingToday: boolean; inProgress: boolean; hasFutureToday: boolean }> = {};
                    for (const row of payload.rooms || []) {
                      const hasFutureToday = Array.isArray(row.bookings) ? row.bookings.some((b) => Number(b.startAt) > nowTs) : false;
                      next[String(row.roomId)] = {
                        hasMeetingToday: !!row.hasMeetingToday,
                        inProgress: !!row.inProgress,
                        hasFutureToday
                      };
                    }
                    setMeetingStatusByRoomId(next);
                  })
                  .catch(() => {});
              }
              if (roomMeetingsTimelineModal?.roomId) {
                void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, roomMeetingsTimelineModal.day);
              }
            }}
            onGoToRoom={(roomId) => {
              let targetPlanId: string | null = null;
              for (const c of allClients || []) {
                for (const s of c.sites || []) {
                  const hit = (s.floorPlans || []).find((p) => (p.rooms || []).some((r) => r.id === roomId));
                  if (hit?.id) {
                    targetPlanId = hit.id;
                    break;
                  }
                }
                if (targetPlanId) break;
              }
              if (!targetPlanId) return;
              setMeetingManagerOpen(false);
              setMeetingManagerPreset(null);
              if (targetPlanId !== planId) {
                setSelectedPlan(targetPlanId);
                navigate(`/plan/${targetPlanId}?focusRoom=${encodeURIComponent(roomId)}`);
                return;
              }
              setSelectedRoomId(roomId);
              setSelectedRoomIds([roomId]);
              setHighlightRoom({ roomId, until: Date.now() + 3200 });
            }}
          />
        </Suspense>
      ) : null}

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
                it: `Eliminare il corridoio "${(((basePlan as any).corridors || []) as Corridor[]).find((c) => c.id === confirmDeleteCorridorId)?.name || 'corridoio'}" insieme a porte e punti di connessione?`,
                en: `Delete corridor "${(((basePlan as any).corridors || []) as Corridor[]).find((c) => c.id === confirmDeleteCorridorId)?.name || 'corridor'}" including doors and connection points?`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteCorridorId(null)}
        onConfirm={() => {
          if (!confirmDeleteCorridorId) return;
          const current = (((basePlan as any).corridors || []) as Corridor[]).filter(Boolean);
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

      {cableModal ? (
        <Suspense fallback={null}>
          <CableModal
        open={!!cableModal}
        initial={
          cableModal?.mode === 'edit'
            ? (() => {
                const l = ((basePlan as any).links || []).find((x: any) => x.id === (cableModal as any).linkId);
                if (!l) return undefined;
                return {
                  name: l.name || l.label || '',
                  description: l.description || '',
                  color: l.color || '#2563eb',
                  width: l.width || 3,
                  dashed: !!l.dashed,
                  route: l.route || 'vh'
                };
              })()
            : undefined
        }
        onClose={() => setCableModal(null)}
        onSubmit={(payload) => {
          if (isReadOnly) return;
          if (cableModal?.mode === 'create') {
            markTouched();
            const id = addLink(basePlan.id, cableModal.fromId, cableModal.toId, {
              kind: 'cable',
              name: payload.name,
              description: payload.description,
              color: payload.color,
              width: payload.width,
              dashed: payload.dashed,
              route: payload.route
            });
            postAuditEvent({
              event: 'link_create',
              scopeType: 'plan',
              scopeId: basePlan.id,
              details: { id, kind: 'cable', fromId: cableModal.fromId, toId: cableModal.toId, ...payload }
            });
            push(t({ it: 'Collegamento creato', en: 'Link created' }), 'success');
            setSelectedLinkId(id);
            setCableModal(null);
            return;
          }
          if (cableModal?.mode === 'edit') {
            markTouched();
            updateLink(basePlan.id, cableModal.linkId, {
              name: payload.name,
              description: payload.description,
              color: payload.color,
              width: payload.width,
              dashed: payload.dashed,
              route: payload.route
            });
            postAuditEvent({
              event: 'link_update',
              scopeType: 'plan',
              scopeId: basePlan.id,
              details: { id: cableModal.linkId, kind: 'cable', ...payload }
            });
            push(t({ it: 'Collegamento aggiornato', en: 'Link updated' }), 'success');
            setCableModal(null);
          }
        }}
      />
        </Suspense>
      ) : null}

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
                const l = ((basePlan as any).links || []).find((x: any) => x.id === linkEditId);
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

      <Transition show={!!unlockPrompt} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (unlockBusy) return;
            setUnlockPrompt(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
		                  <div className="modal-header items-center">
		                    <div className="min-w-0">
		                      <Dialog.Title className="modal-title">
		                        {t({ it: 'Richiesta di unlock', en: 'Unlock request' })}
		                      </Dialog.Title>
                      <div className="modal-description">
	                        {t({
	                          it: `L’utente @${unlockPrompt?.requestedBy?.username || 'utente'} chiede la possibilità di modificare la planimetria ${
	                            unlockPrompt?.planName || ''
	                          }.`,
	                          en: `User @${unlockPrompt?.requestedBy?.username || 'user'} requests permission to edit floor plan ${unlockPrompt?.planName || ''}.`
	                        })}
	                      </div>
		                      <div className="mt-1 text-xs text-slate-500">
		                        {[unlockPrompt?.clientName, unlockPrompt?.siteName].filter(Boolean).join(' / ')}
		                      </div>
		                      {String(unlockPrompt?.message || '').trim() ? (
		                        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
		                          <div className="text-[11px] font-semibold uppercase text-sky-700">
			                            {t({ it: 'Messaggio', en: 'Message' })}{' '}
			                            <span className="normal-case text-sky-700/80">@{unlockPrompt?.requestedBy?.username || 'admin'}</span>
			                          </div>
		                          <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-sky-950">
		                            {String(unlockPrompt?.message || '').trim()}
		                          </div>
		                        </div>
		                      ) : null}
		                    </div>
                    <button
                      onClick={() => {
                        if (unlockBusy) return;
                        setUnlockPrompt(null);
                      }}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
	                  </div>
	                  <div className="mt-4 text-sm text-slate-600">
	                    {hasNavigationEdits
	                      ? t({
	                          it: 'Puoi salvare le modifiche e concedere il lock, oppure annullare le modifiche e concederlo.',
	                          en: 'You can save your changes and grant the lock, or discard changes and grant it.'
	                        })
	                      : t({
	                          it: 'Non hai modifiche da salvare. Vuoi concedere l’unlock?',
	                          en: 'No changes to save. Do you want to grant the unlock?'
	                        })}
	                  </div>
	                  <div className="mt-6 flex flex-wrap gap-2">
	                    {hasNavigationEdits ? (
	                      <>
	                        <button
	                          onClick={() => handleUnlockResponse('grant_save')}
	                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Salva le modifiche e concede il lock', en: 'Save changes and grant the lock' })}
	                        >
	                          {t({ it: 'Salva e concedi', en: 'Save and grant' })}
	                        </button>
	                        <button
	                          onClick={() => handleUnlockResponse('grant_discard')}
	                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Annulla le modifiche e concede il lock', en: 'Discard changes and grant the lock' })}
	                        >
	                          {t({ it: 'Non salvare e concedi', en: 'Discard and grant' })}
	                        </button>
	                        <button
	                          onClick={() => handleUnlockResponse('deny')}
	                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Non concedere il lock', en: 'Do not grant the lock' })}
	                        >
	                          {t({ it: 'Non concedere', en: 'Do not grant' })}
	                        </button>
	                      </>
	                    ) : (
	                      <>
	                        <button
	                          onClick={() => handleUnlockResponse('grant')}
	                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Concedi l’unlock', en: 'Grant unlock' })}
	                        >
	                          {t({ it: 'Concedi', en: 'Grant' })}
	                        </button>
	                        <button
	                          onClick={() => handleUnlockResponse('deny')}
	                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Nega l’unlock', en: 'Deny unlock' })}
	                        >
	                          {t({ it: 'Nega', en: 'Deny' })}
	                        </button>
	                      </>
	                    )}
	                  </div>
	                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>

	      <Transition show={!!unlockGrantedPrompt} as={Fragment}>
	        <Dialog
	          as="div"
	          className="relative z-50"
	          onClose={() => {
	            setUnlockGrantedPrompt(null);
	          }}
	        >
	          <Transition.Child
	            as={Fragment}
	            enter="ease-out duration-150"
	            enterFrom="opacity-0"
	            enterTo="opacity-100"
	            leave="ease-in duration-100"
	            leaveFrom="opacity-100"
	            leaveTo="opacity-0"
	          >
	            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
	          </Transition.Child>
	          <div className="fixed inset-0 overflow-y-auto">
	            <div className="flex min-h-full items-center justify-center px-4 py-8">
	              <Transition.Child
	                as={Fragment}
	                enter="ease-out duration-150"
	                enterFrom="opacity-0 scale-95"
	                enterTo="opacity-100 scale-100"
	                leave="ease-in duration-100"
	                leaveFrom="opacity-100 scale-100"
	                leaveTo="opacity-0 scale-95"
	              >
	                <Dialog.Panel className="w-full max-w-xl modal-panel">
	                  <div className="modal-header items-center">
	                    <div className="min-w-0">
	                      <Dialog.Title className="modal-title">{t({ it: 'Unlock concesso', en: 'Unlock granted' })}</Dialog.Title>
	                      <div className="mt-1 text-xs text-slate-500">
	                        {[unlockGrantedPrompt?.clientName, unlockGrantedPrompt?.siteName].filter(Boolean).join(' / ')}
	                      </div>
	                    </div>
	                    <button onClick={() => setUnlockGrantedPrompt(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
	                      <X size={18} />
	                    </button>
	                  </div>
		                  <div className="mt-3 text-sm text-slate-700">
		                    {t({
		                      it: `In data ${formatPresenceDate(unlockGrantedPrompt?.grantedAt)} l’utente ${
		                        unlockGrantedPrompt?.grantedBy?.username || 'utente'
		                      } ha concesso lo sblocco della planimetria ${unlockGrantedPrompt?.planName || ''}. Hai ${
		                        unlockGrantedPrompt?.minutes || '—'
		                      } minuti per entrarci e prendere il lock. Nel frattempo la planimetria sarà riservata a te e gli altri utenti vedranno un’icona a forma di clessidra. Vuoi aprire la planimetria e prendere il lock?`,
		                      en: `On ${formatPresenceDate(unlockGrantedPrompt?.grantedAt)} user ${
		                        unlockGrantedPrompt?.grantedBy?.username || 'user'
		                      } granted an unlock for floor plan ${unlockGrantedPrompt?.planName || ''}. You have ${
		                        unlockGrantedPrompt?.minutes || '—'
		                      } minutes to enter and acquire the lock. In the meantime, the floor plan will be reserved for you and other users will see an hourglass icon. Do you want to open the floor plan and acquire the lock?`
		                    })}
		                  </div>
	                  <div className="mt-5 flex flex-wrap gap-2">
	                    <button
	                      onClick={() => {
	                        const targetPlanId = String(unlockGrantedPrompt?.planId || '').trim();
	                        if (!targetPlanId) {
	                          setUnlockGrantedPrompt(null);
	                          return;
	                        }
	                        const url = `/plan/${targetPlanId}`;
	                        setUnlockGrantedPrompt(null);
	                        if (targetPlanId === planId) {
	                          requestPlanLock();
	                          return;
	                        }
	                        if (hasNavigationEdits) {
	                          requestSaveAndNavigate(url);
	                          return;
	                        }
	                        setSelectedPlan(targetPlanId);
	                        navigate(url);
	                      }}
	                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
	                      title={t({ it: 'Apri e prendi lock', en: 'Open and acquire lock' })}
	                    >
	                      {t({ it: 'Sì', en: 'Yes' })}
	                    </button>
	                    <button
	                      onClick={() => setUnlockGrantedPrompt(null)}
	                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
	                      title={t({ it: 'Non ora', en: 'Not now' })}
	                    >
	                      {t({ it: 'No', en: 'No' })}
	                    </button>
	                  </div>
	                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>

	      <Transition show={!!forceUnlockConfig} as={Fragment}>
	        <Dialog
	          as="div"
	          className="relative z-50"
	          onClose={() => {
	            if (forceUnlockStarting) return;
	            setForceUnlockConfig(null);
	          }}
	        >
	          <Transition.Child
	            as={Fragment}
	            enter="ease-out duration-150"
	            enterFrom="opacity-0"
	            enterTo="opacity-100"
	            leave="ease-in duration-100"
	            leaveFrom="opacity-100"
	            leaveTo="opacity-0"
	          >
	            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
	          </Transition.Child>
	          <div className="fixed inset-0 overflow-y-auto">
	            <div className="flex min-h-full items-center justify-center px-4 py-8">
	              <Transition.Child
	                as={Fragment}
	                enter="ease-out duration-150"
	                enterFrom="opacity-0 scale-95"
	                enterTo="opacity-100 scale-100"
	                leave="ease-in duration-100"
	                leaveFrom="opacity-100 scale-100"
	                leaveTo="opacity-0 scale-95"
	              >
	                <Dialog.Panel className="w-full max-w-xl modal-panel">
	                  <div className="modal-header items-center">
	                    <div className="min-w-0">
	                      <Dialog.Title className="modal-title">{t({ it: 'Force unlock', en: 'Force unlock' })}</Dialog.Title>
	                      <div className="mt-1 text-xs text-slate-500">
	                        {forceUnlockConfig?.clientName} / {forceUnlockConfig?.siteName} / {forceUnlockConfig?.planName}
	                      </div>
	                    </div>
	                    <button
	                      onClick={() => {
	                        if (forceUnlockStarting) return;
	                        setForceUnlockConfig(null);
	                      }}
	                      className="icon-button"
	                      title={t({ it: 'Chiudi', en: 'Close' })}
	                    >
	                      <X size={18} />
	                    </button>
	                  </div>
	                  <div className="mt-3 text-sm text-slate-700">
	                    {t({
	                      it: `Vuoi procedere con lo sblocco forzato? L’utente ${forceUnlockConfig?.username || 'utente'} avrà del tempo per salvare.`,
	                      en: `Proceed with the forced unlock? User ${forceUnlockConfig?.username || 'user'} will have some time to save.`
	                    })}
	                  </div>
	                  <div className="mt-4">
	                    <div className="flex items-center justify-between">
	                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Tempo (minuti)', en: 'Time (minutes)' })}</div>
	                      <div className="text-[11px] font-semibold text-slate-700">{forceUnlockGraceMinutes}</div>
	                    </div>
	                    <input
	                      type="range"
	                      min={0}
	                      max={60}
	                      step={1}
	                      value={forceUnlockGraceMinutes}
	                      onChange={(e) => setForceUnlockGraceMinutes(Number(e.target.value))}
	                      className="mt-2 w-full"
	                    />
	                  </div>
	                  <div className="mt-5 flex flex-wrap gap-2">
	                    <button
	                      onClick={() => {
	                        if (!forceUnlockConfig) return;
	                        if (forceUnlockStarting) return;
	                        setForceUnlockStarting(true);
	                        sendWs({
	                          type: 'force_unlock_start',
	                          planId: forceUnlockConfig.planId,
	                          targetUserId: forceUnlockConfig.userId,
	                          graceMinutes: forceUnlockGraceMinutes
	                        });
	                      }}
	                      disabled={forceUnlockStarting}
	                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
	                      title={t({ it: 'Avvia force unlock', en: 'Start force unlock' })}
	                    >
	                      {t({ it: 'Conferma', en: 'Confirm' })}
	                    </button>
	                    <button
	                      onClick={() => {
	                        if (forceUnlockStarting) return;
	                        setForceUnlockConfig(null);
	                      }}
	                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
	                      title={t({ it: 'Annulla', en: 'Cancel' })}
	                    >
	                      {t({ it: 'Annulla', en: 'Cancel' })}
	                    </button>
	                  </div>
	                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>

	      <Transition show={!!forceUnlockActive} as={Fragment}>
	        <Dialog as="div" className="relative z-50" onClose={() => {}} initialFocus={forceUnlockActiveFocusRef}>
		          <Transition.Child
		            as={Fragment}
		            enter="ease-out duration-150"
	            enterFrom="opacity-0"
	            enterTo="opacity-100"
	            leave="ease-in duration-100"
	            leaveFrom="opacity-100"
	            leaveTo="opacity-0"
	          >
	            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
	          </Transition.Child>
	          <div className="fixed inset-0 overflow-y-auto">
	            <div className="flex min-h-full items-center justify-center px-4 py-8">
	              <Transition.Child
	                as={Fragment}
	                enter="ease-out duration-150"
	                enterFrom="opacity-0 scale-95"
	                enterTo="opacity-100 scale-100"
	                leave="ease-in duration-100"
	                leaveFrom="opacity-100 scale-100"
	                leaveTo="opacity-0 scale-95"
	              >
	                <Dialog.Panel className="w-full max-w-2xl modal-panel">
                    <button ref={forceUnlockActiveFocusRef} type="button" className="sr-only" tabIndex={0}>
                      focus
                    </button>
                  <div className="modal-header items-center">
		                    <div className="min-w-0">
		                      <Dialog.Title className="modal-title">{t({ it: 'Force unlock in corso', en: 'Force unlock in progress' })}</Dialog.Title>
		                      <div className="mt-1 text-xs text-slate-500">
		                        {t({
		                          it: `Target: ${forceUnlockActive?.targetUsername || 'utente'}`,
		                          en: `Target: ${forceUnlockActive?.targetUsername || 'user'}`
		                        })}
		                      </div>
		                    </div>
		                  </div>
		                  <div className="mt-3 text-sm text-slate-700">
		                    {(() => {
		                      forceUnlockTick;
	                      const graceEndsAt = Number(forceUnlockActive?.graceEndsAt || 0);
	                      const decisionEndsAt = Number(forceUnlockActive?.decisionEndsAt || 0);
	                      const now = Date.now();
	                      const inGrace = graceEndsAt > now;
	                      const targetAt = inGrace ? graceEndsAt : decisionEndsAt;
	                      const remainingMs = targetAt - now;
	                      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
	                      return inGrace
	                        ? t({
	                            it: `Tempo concesso all’utente per salvare: ${remainingSec}s.`,
	                            en: `Time granted to the user to save: ${remainingSec}s.`
	                          })
	                        : t({
	                            it: `Finestra decisione (5 minuti): ${remainingSec}s rimanenti.`,
	                            en: `Decision window (5 minutes): ${remainingSec}s remaining.`
	                          });
	                    })()}
	                  </div>
		                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
		                    <div className="font-semibold text-ink">{t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })}</div>
		                    <div className="mt-1">
		                      {forceUnlockActive?.hasUnsavedChanges === null || forceUnlockActive?.hasUnsavedChanges === undefined
		                        ? t({ it: 'Stato non disponibile.', en: 'Status not available.' })
		                        : forceUnlockActive?.hasUnsavedChanges
		                          ? t({ it: 'Il proprietario del lock ha modifiche non salvate.', en: 'The lock owner has unsaved changes.' })
		                          : t({ it: 'Il proprietario del lock non risulta avere modifiche non salvate.', en: 'The lock owner does not appear to have unsaved changes.' })}
		                    </div>
		                  </div>
		                  <div className="mt-5 flex flex-wrap gap-2">
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockActive?.requestId) return;
		                        sendWs({ type: 'force_unlock_execute', requestId: forceUnlockActive.requestId, action: 'save' });
		                      }}
		                      disabled={Date.now() < Number(forceUnlockActive?.graceEndsAt || 0)}
		                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
		                      title={t({
		                        it: 'Chiede al proprietario del lock di salvare le modifiche (se presenti) e rilasciare il lock. Il lock passerà al superadmin.',
		                        en: 'Asks the lock owner to save changes (if any) and release the lock. The lock will be taken by the superadmin.'
		                      })}
		                    >
		                      {t({ it: 'Salva e sblocca', en: 'Save and unlock' })}
		                    </button>
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockActive?.requestId) return;
		                        sendWs({ type: 'force_unlock_execute', requestId: forceUnlockActive.requestId, action: 'discard' });
		                      }}
		                      disabled={Date.now() < Number(forceUnlockActive?.graceEndsAt || 0)}
		                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
		                      title={t({
		                        it: 'Chiede al proprietario del lock di scartare le modifiche non salvate e rilasciare il lock. Il lock passerà al superadmin.',
		                        en: 'Asks the lock owner to discard unsaved changes and release the lock. The lock will be taken by the superadmin.'
		                      })}
		                    >
		                      {t({ it: 'Scarta e sblocca', en: 'Discard and unlock' })}
		                    </button>
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockActive?.requestId) return;
		                        sendWs({ type: 'force_unlock_cancel', requestId: forceUnlockActive.requestId });
		                        setForceUnlockActive(null);
		                        pushStack(t({ it: 'Force unlock annullato.', en: 'Force unlock cancelled.' }), 'info', { duration: LOCK_TOAST_MS });
		                      }}
		                      disabled={Date.now() < Number(forceUnlockActive?.graceEndsAt || 0)}
		                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
		                      title={t({
		                        it: 'Annulla la richiesta: il lock resta all’utente e l’avviso si chiude.',
		                        en: 'Cancel the request: the lock remains with the user and the warning closes.'
		                      })}
		                    >
		                      {t({ it: 'Annulla richiesta', en: 'Cancel request' })}
		                    </button>
		                  </div>
		                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>

	      <Transition show={!!forceUnlockIncoming} as={Fragment}>
	        <Dialog as="div" className="relative z-50" onClose={() => {}} initialFocus={forceUnlockIncomingFocusRef}>
		          <Transition.Child
		            as={Fragment}
		            enter="ease-out duration-150"
	            enterFrom="opacity-0"
	            enterTo="opacity-100"
	            leave="ease-in duration-100"
	            leaveFrom="opacity-100"
	            leaveTo="opacity-0"
	          >
	            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
	          </Transition.Child>
	          <div className="fixed inset-0 overflow-y-auto">
	            <div className="flex min-h-full items-center justify-center px-4 py-8">
	              <Transition.Child
	                as={Fragment}
	                enter="ease-out duration-150"
	                enterFrom="opacity-0 scale-95"
	                enterTo="opacity-100 scale-100"
	                leave="ease-in duration-100"
	                leaveFrom="opacity-100 scale-100"
	                leaveTo="opacity-0 scale-95"
	              >
	                <Dialog.Panel className="w-full max-w-xl modal-panel">
                    <button ref={forceUnlockIncomingFocusRef} type="button" className="sr-only" tabIndex={0}>
                      focus
                    </button>
                  <div className="modal-header items-center">
		                    <div className="min-w-0">
		                      <Dialog.Title className="modal-title">{t({ it: 'Force unlock richiesto', en: 'Force unlock requested' })}</Dialog.Title>
		                      <div className="mt-1 text-xs text-slate-500">
		                        {[forceUnlockIncoming?.clientName, forceUnlockIncoming?.siteName, forceUnlockIncoming?.planName].filter(Boolean).join(' / ')}
		                      </div>
		                    </div>
		                  </div>
		                  {(() => {
	                    forceUnlockTick;
	                    const graceEndsAt = Number(forceUnlockIncoming?.graceEndsAt || 0);
	                    const decisionEndsAt = Number(forceUnlockIncoming?.decisionEndsAt || 0);
	                    const now = Date.now();
	                    const inGrace = graceEndsAt > now;
	                    const targetAt = inGrace ? graceEndsAt : decisionEndsAt;
	                    const remainingMs = targetAt - now;
	                    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
	                    return (
	                      <>
	                        <div className="mt-3 text-sm text-slate-700">
	                          {inGrace
	                            ? t({
	                                it: `Il superadmin @${forceUnlockIncoming?.requestedBy?.username || 'superadmin'} ha avviato un force unlock. Tempo concesso per salvare.`,
	                                en: `Superadmin @${forceUnlockIncoming?.requestedBy?.username || 'superadmin'} started a force unlock. Time granted to save.`
	                              })
	                            : t({
	                                it: 'Attendi la decisione del superadmin nella finestra di 5 minuti.',
	                                en: 'Wait for the superadmin decision in the 5-minute window.'
	                              })}
	                        </div>
	                        <div className="mt-2 text-sm font-semibold text-slate-800">
	                          {inGrace
	                            ? t({ it: `Countdown salvataggio: ${remainingSec}s`, en: `Save countdown: ${remainingSec}s` })
	                            : t({ it: `Countdown decisione: ${remainingSec}s`, en: `Decision countdown: ${remainingSec}s` })}
	                        </div>
	                      </>
	                    );
	                  })()}
		                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
		                    <div className="font-semibold text-ink">{t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })}</div>
		                    <div className="mt-1">
		                      {hasNavigationEdits
		                        ? t({ it: 'Sono presenti modifiche non salvate.', en: 'There are unsaved changes.' })
		                        : t({ it: 'Non risultano modifiche non salvate.', en: 'No unsaved changes detected.' })}
		                    </div>
		                  </div>
		                  <div className="mt-5 flex flex-wrap gap-2">
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockIncoming?.requestId) return;
		                        void executeForceUnlock(forceUnlockIncoming.requestId, 'save');
		                      }}
		                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
		                      title={t({
		                        it: 'Salva le modifiche (se presenti) e rilascia il lock.',
		                        en: 'Saves changes (if any) and releases the lock.'
		                      })}
		                    >
		                      {t({ it: 'Salva e rilascia', en: 'Save and release' })}
		                    </button>
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockIncoming?.requestId) return;
		                        void executeForceUnlock(forceUnlockIncoming.requestId, 'discard');
		                      }}
		                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
		                      title={t({
		                        it: 'Scarta le modifiche non salvate e rilascia il lock.',
		                        en: 'Discards unsaved changes and releases the lock.'
		                      })}
		                    >
		                      {t({ it: 'Scarta e rilascia', en: 'Discard and release' })}
		                    </button>
		                  </div>
		                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>

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

      {revisionsOpen ? (
        <Suspense fallback={null}>
          <RevisionsModal
            open={revisionsOpen}
            revisions={basePlan.revisions || []}
            selectedRevisionId={selectedRevisionId}
            breadcrumb={[client?.shortName || client?.name, site?.name, basePlan?.name].filter(Boolean).join(' → ')}
            onClose={() => setRevisionsOpen(false)}
            onSelect={(revisionId) => {
              setSelectedRevision(planId, revisionId);
              push(t({ it: 'Revisione caricata (sola lettura)', en: 'Revision loaded (read-only)' }), 'info');
            }}
            onBackToPresent={() => {
              setSelectedRevision(planId, null);
              push(t({ it: 'Tornato al presente', en: 'Back to present' }), 'info');
            }}
            onDelete={(revisionId) => {
              const rev = (basePlan.revisions || []).find((r) => r.id === revisionId);
              if (rev?.immutable && !isSuperAdmin) {
                push(t({ it: 'Revisione immutabile: non puoi eliminarla.', en: 'Immutable revision: you cannot delete it.' }), 'danger');
                return;
              }
              deleteRevision(basePlan.id, revisionId);
              if (selectedRevisionId === revisionId) {
                setSelectedRevision(planId, null);
              }
              push(t({ it: 'Revisione eliminata', en: 'Revision deleted' }), 'info');
              postAuditEvent({
                event: rev?.immutable ? 'revision_delete_immutable' : 'revision_delete',
                scopeType: 'plan',
                scopeId: basePlan.id,
                details: { id: revisionId, immutable: !!rev?.immutable }
              });
            }}
            onClearAll={() => {
              const hasImmutable = (basePlan.revisions || []).some((r) => r.immutable);
              if (hasImmutable && !isSuperAdmin) {
                push(t({ it: 'Impossibile eliminare le revisioni immutabili.', en: 'Immutable revisions cannot be deleted.' }), 'danger');
                return;
              }
              clearRevisions(basePlan.id);
              setSelectedRevision(planId, null);
              push(t({ it: 'Revisioni eliminate', en: 'Revisions deleted' }), 'info');
              postAuditEvent({
                event: 'revision_clear_all',
                scopeType: 'plan',
                scopeId: basePlan.id,
                details: { immutableIncluded: hasImmutable }
              });
            }}
            canRestore={planAccess === 'rw'}
            onRestore={(revisionId) => {
              if (planAccess !== 'rw') return;
              restoreRevision(basePlan.id, revisionId);
              setSelectedRevision(planId, null);
              push(
                t({ it: 'Revisione ripristinata (stato attuale aggiornato)', en: 'Revision restored (current state updated)' }),
                'success'
              );
              postAuditEvent({ event: 'revision_restore', scopeType: 'plan', scopeId: basePlan.id, details: { id: revisionId } });
            }}
            isSuperAdmin={isSuperAdmin}
            onToggleImmutable={toggleRevisionImmutable}
          />
        </Suspense>
      ) : null}

      {saveRevisionOpen ? (
        <Suspense fallback={null}>
          <SaveRevisionModal
        open={saveRevisionOpen}
        hasExisting={hasAnyRevision}
        latestRevMajor={latestRev.major}
        latestRevMinor={latestRev.minor}
        initialBump={saveRevisionModalPreset.initialBump}
        requireNoteForMajor={saveRevisionModalPreset.requireNoteForMajor}
        reason={saveRevisionReason}
        onDiscard={
          pendingNavigateRef.current
            ? () => {
                const to = pendingNavigateRef.current;
                pendingNavigateRef.current = null;
                revertUnsavedChanges();
                resetTouched();
                entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                clearPendingSaveNavigate?.();
                setSaveRevisionOpen(false);
                if (to) navigate(to);
              }
              : pendingPostSaveAction
                ? () => {
                  const action = pendingPostSaveAction;
                  clearPendingPostSaveAction();
                  revertUnsavedChanges();
                  resetTouched();
                  entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                  setSaveRevisionOpen(false);
                  if (action) void performPendingPostSaveAction(action);
                }
              : pendingMeetingManagerPreset
                ? () => {
                    const preset = pendingMeetingManagerPreset;
                    setPendingMeetingManagerPreset(null);
                    revertUnsavedChanges();
                    resetTouched();
                    entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                    setSaveRevisionOpen(false);
                    if (preset) {
                      setMeetingManagerPreset(preset);
                      setMeetingManagerOpen(true);
                    }
                  }
                : pendingClientMeetingsPreset
                  ? () => {
                      const preset = pendingClientMeetingsPreset;
                      setPendingClientMeetingsPreset(null);
                      revertUnsavedChanges();
                      resetTouched();
                      entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                      setSaveRevisionOpen(false);
                      if (preset) {
                        dispatchOpenClientMeetingsTimeline(preset);
                      }
                    }
                : undefined
        }
        onClose={() => {
          setSaveRevisionOpen(false);
          setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
          pendingNavigateRef.current = null;
          clearPendingSaveNavigate?.();
          clearPendingPostSaveAction();
          setPendingMeetingManagerPreset(null);
          setPendingClientMeetingsPreset(null);
        }}
        onConfirm={({ bump, note }) => {
          if (!plan) return;
          const next = !hasAnyRevision
            ? { major: 1, minor: 0 }
            : bump === 'major'
              ? { major: latestRev.major + 1, minor: 0 }
              : { major: latestRev.major, minor: latestRev.minor + 1 };
          addRevision(plan.id, {
            bump,
            name: 'Salvataggio',
            description: note
          });
          push(
            t({
              it: `Revisione salvata: Rev ${next.major}.${next.minor}`,
              en: `Revision saved: Rev ${next.major}.${next.minor}`
            }),
            'success'
          );
          postAuditEvent({
            event: 'revision_save',
            scopeType: 'plan',
            scopeId: plan.id,
            details: { bump, rev: `${next.major}.${next.minor}`, note: note || '' }
          });
          // New revision = clean state for navigation prompts.
          resetTouched();
          entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
          if (pendingPostSaveAction) {
            const action = pendingPostSaveAction;
            clearPendingPostSaveAction();
            void performPendingPostSaveAction(action);
            return;
          }
          if (pendingMeetingManagerPreset) {
            const preset = pendingMeetingManagerPreset;
            setPendingMeetingManagerPreset(null);
            setMeetingManagerPreset(preset);
            setMeetingManagerOpen(true);
            return;
          }
          if (pendingClientMeetingsPreset) {
            const preset = pendingClientMeetingsPreset;
            setPendingClientMeetingsPreset(null);
            dispatchOpenClientMeetingsTimeline(preset || undefined);
            return;
          }
          if (pendingNavigateRef.current) {
            const to = pendingNavigateRef.current;
            pendingNavigateRef.current = null;
            clearPendingSaveNavigate?.();
            navigate(to);
          }
        }}
      />
        </Suspense>
      ) : null}

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
