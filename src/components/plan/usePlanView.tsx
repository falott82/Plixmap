import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import { meetingIsoDayFromTs, meetingClockFromTs, shiftIsoDay, monthAnchorFromIso, shiftMonthAnchor, hmToMinutes } from './planViewTime';
import { runRealtimeWsEffect } from './planViewRealtime';
import { runRoomDepartmentOptionsEffect, runMeetingOverviewEffect } from './planViewDepartmentOptions';
import { computeModalInitials } from './planViewModalInitials';
import { computeRackOverlayLinks, computeRoomLayoutExportRows } from './planViewExportData';
import {
  computeSnapRoomRectToAdjacentSide,
  computeOpenEditRoom,
  computeCreateRoomFromRect,
  computeCreateRoomFromPoly,
  computeSplitWallAtPoint,
  computeRoomMeasuresData,
  computeAddWallSegment,
  isPointInRoom,
  getRoomIdAt,
  isUserType,
  polygonsOverlap,
  computeResolveRoomAssignmentForObject
} from './planViewRoomGeometry';
import {
  computeAlignSelection,
  computeGetCorridorPolygon,
  computeHandleWallMove,
  computeCorridorDoorLinkRoomEntries,
  computeCanvasPlan,
  computeSaveRevisionReason
} from './planViewMiscTools';
import { computeHandleQuotePoint, computeConvertMeasurementToQuotes, computeUpdateQuoteLabelPos } from './planViewQuoteScaleTools';
import { computeGetTypeLayerIds, computeGetLayerIdsForType, computeGetObjectLayerIdsForVisibility } from './planViewLayerResolution';
import { computeResolveWallPoint } from './planViewWallMeasureTools';
import { computeEnsureObjectLayerVisible } from './planViewSearchScheduleTools';
import { computeHandleUnlockResponse, computeReloadMyMeetings } from './planViewLockMeetingTools';
import {
  computeGetClosestCorridorEdge,
  computeGetCorridorEdgePoint
} from './planViewCorridorGeometry';
import { computeHandleStageMove, computeHandleMapContextMenu, computeHandleStageSelect } from './planViewStageHandlers';
import { runPlanKeydownEffect } from './planViewKeydown';
import {
  runDismissSelectionHintToasts
} from './planViewSelectionToasts';
import {
  computeLinksModalRows,
  computeCollectUserDepartments,
  computeUpdateRackPortField,
  computeFormatPresenceDate,
  computeFormatPresenceLock,
  computeLinkCreateHint,
  computeGetLayerLabel,
  computeGetObjectToastLabel,
  computeSubmenuStyle,
  computeRecommendedObjectScale,
  computeClientBusinessPartnerNames,
  computeMeetingLocationLabels,
  computeSiteMeetingParticipantCandidates,
  runApplyHistorySnapshot,
  runUnlockRequestEffect,
  runRevertUnsavedChanges,
  runForceSaveNow,
  runSaveRevisionForUnlock
} from './planViewComputeBits';
import {
  computeMyMeetingsFiltered,
  computeSafetyEmergencyContacts,
  runToggleRevisionImmutable,
  computeGetObjectBoundsForAlign,
  computeRoomStatsById,
  computeLinksInSelection,
  computeGetPlanUnsavedChanges,
  computeScaleLine,
  runPerformPendingPostSaveAction,
  runOpenMyMeetingsModal
} from './planViewComputeBits2';
import {
  runCorridorShortcutEffect,
  runHistoryTrackEffect,
  runForceUnlockEventEffect,
  runSearchExportShortcutEffect,
  runLayerVisibilityInitEffect,
  runResetToolsOnPlanChangeEffect,
  runLayerVisibilitySyncEffect
} from './planViewEffects';
import { runHandleCreate, runHandleUpdate, runHandlePlaceNew, runOpenDuplicate, type HandleCreatePayload } from './planViewCreateObject';
import {
  runViewportInitEffect,
  runViewportAutoCenterEffect,
  runViewportPresentationEffect,
  computeGetPastePoint
} from './planViewViewport';
import {
  runUpdateLockedPlans,
  runApplyRoomLayoutExportToSelection
} from './planViewMiscCallbacks';

import { CanvasStageHandle } from './CanvasStage';

import { Corridor, FloorPlan, FloorPlanView, IconName, LayerDefinition, MapObject, MapObjectType, RackItem, RackPortKind, Room, RoomConnectionDoor } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useToastStore } from '../../store/useToast';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchPlanRevisions, savePlanState } from '../../api/state';

import type { UnlockRequestLock } from './UnlockRequestComposeModal';

import { DESK_TYPE_IDS, isDeskType } from './deskTypes';

import type { RoomLayoutExportModalSortKey } from './RoomLayoutExportModal';
import type { CrossPlanSearchResult } from './CrossPlanSearchModal';
import { useRoomMeetingsTimeline, type MyMeetingsModalState } from './useRoomMeetingsTimeline';
import { usePlanSafetyCard } from './usePlanSafetyCard';
import { usePlanCapacity } from './usePlanCapacity';
import { usePlanContextDerived, type PlanContextMenuState } from './usePlanContextDerived';
import { usePlanTypeCatalog } from './usePlanTypeCatalog';
import { usePlanRoomGeometry } from './usePlanRoomGeometry';
import { usePlanRoomModalDerived } from './usePlanRoomModalDerived';
import type {
  PlanObjectModalState,
  RoomDepartmentConfirmState,
  RackPortsLinkState,
  EscapeRouteModalState,
  LayerRevealPromptState,
  MeetingManagerPresetState,
  ClientMeetingsPresetState,
  UnlockPromptState,
  UnlockGrantedPromptState,
  ForceUnlockConfigState,
  ForceUnlockActiveState,
  ForceUnlockIncomingState,
  PlanLockState
} from './planViewStateTypes';
import { usePlanContextMenuHandlers } from './usePlanContextMenuHandlers';
import { usePlanDoorModalHandlers } from './usePlanDoorModalHandlers';
import { usePlanCorridorNameHandlers } from './usePlanCorridorNameHandlers';
import { usePlanRoomDoorDraftHandlers } from './usePlanRoomDoorDraftHandlers';
import { usePlanScaleHandlers } from './usePlanScaleHandlers';
import { usePlanViewHandlers } from './usePlanViewHandlers';
import { usePlanCorridorConnectionHandlers } from './usePlanCorridorConnectionHandlers';
import { usePlanWallTypeHandlers } from './usePlanWallTypeHandlers';
import { usePlanTypeLayerHandlers } from './usePlanTypeLayerHandlers';
import { usePlanToolPointHandlers } from './usePlanToolPointHandlers';
import { usePlanMeasureQuoteToggles } from './usePlanMeasureQuoteToggles';
import { usePlanScaleModeHandlers } from './usePlanScaleModeHandlers';
import { usePlanWallDrawToggles } from './usePlanWallDrawToggles';
import { usePlanWallPointHandlers } from './usePlanWallPointHandlers';
import { usePlanMeetingOpenHandlers } from './usePlanMeetingOpenHandlers';
import { usePlanPaletteFavoriteHandlers } from './usePlanPaletteFavoriteHandlers';
import { usePlanSearchHandlers } from './usePlanSearchHandlers';
import { usePlanEditOpenHandlers } from './usePlanEditOpenHandlers';
import { usePlanMediaViewerHandlers } from './usePlanMediaViewerHandlers';
import { usePlanSecurityHandlers } from './usePlanSecurityHandlers';
import { usePlanSelectionMenuEffects } from './usePlanSelectionMenuEffects';
import { usePlanModalState } from './usePlanModalState';
import { usePlanCorridorModalEffects } from './usePlanCorridorModalEffects';
import { usePlanWallTypeModalEffects } from './usePlanWallTypeModalEffects';
import { useSyncedRef } from './useSyncedRef';
import { usePlanPopoverEffects } from './usePlanPopoverEffects';
import { usePlanHelpToastEffects } from './usePlanHelpToastEffects';
import { usePlanDeeplinkEffects } from './usePlanDeeplinkEffects';
import { usePlanPaletteSectionEffects } from './usePlanPaletteSectionEffects';
import { useClipboard } from './useClipboard';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLang, useT } from '../../i18n/useT';
import { useShallow } from 'zustand/react/shallow';
import { postAuditEvent } from '../../api/audit';
import { hasExternalUsers } from '../../api/customImport';
import { type MeetingBooking } from '../../api/meetings';

import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { perfMetrics } from '../../utils/perfMetrics';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';
import { isSecurityTypeId, SECURITY_LAYER_ID } from '../../store/security';
import { getDefaultVisiblePlanLayerIds, normalizePlanLayerSelection } from '../../utils/layerVisibility';
import { getWallTypeColor } from '../../utils/wallColors';
import { useMeetingRoomKioskInfo } from '../meetings/useMeetingRoomKioskInfo';

import { getRoomPolygon, isRackLinkId, getSharedRoomSides } from './planViewUtils';
import { samePlanSnapshot as samePlanSnapshotUtil, type PlanSnapshotComparable } from './planSnapshotCompare';
import { toPlanHistorySnapshot, toPlanSnapshot, type PlanHistorySnapshot, type PlanSnapshot } from './planSnapshots';
import { getLatestRevision, getRevisionVersion, toRevisionSnapshot } from './planRevisions';
import { usePlanShortcuts } from './usePlanShortcuts';
import { usePlanSelectionState } from './usePlanSelectionState';
import { usePlanDrawingState } from './usePlanDrawingState';
import { usePlanLock } from './usePlanLock';
export const UNLOCK_REQUEST_EVENT = 'plixmap_unlock_request';
export const FORCE_UNLOCK_EVENT = 'plixmap_force_unlock';
const OPEN_MEETING_CENTER_EVENT = 'plixmap_open_meeting_center';
const OPEN_MY_MEETINGS_EVENT = 'plixmap_open_my_meetings';
const OPEN_MEETING_MANAGER_EVENT = 'plixmap_open_meeting_manager';

type RoomKioskInfoModalState = {
  roomId: string;
  roomName: string;
  clientName: string;
  siteName: string;
  planName: string;
};

export const usePlanView = (planId: string) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasStageRef = useRef<CanvasStageHandle | null>(null);
  const t = useT();
  const lang = useLang();
  const renderKeybindToast = useCallback(
    (title: { it: string; en: string }, items: Array<{ cmd: string; it: string; en: string }>) => (
      <div className="text-left text-slate-900">
        <div className="text-sm font-semibold text-slate-900">{t(title)}</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-900">
          {items.map((item, index) => (
            <li key={`${item.cmd}-${index}`}>
              <strong className="font-semibold">{item.cmd}</strong> {t({ it: item.it, en: item.en })}
            </li>
          ))}
        </ul>
      </div>
    ),
    [t]
  );
  const [autoFitEnabled, setAutoFitEnabled] = useState(true);
  const presentationViewportRef = useRef<{ zoom: number; pan: { x: number; y: number }; autoFitEnabled: boolean } | null>(null);
  const {
    addObject,
    updateObject,
    moveObject,
    deleteObject,
    updateFloorPlan,
    setFloorPlanContent,
    addView,
    updateView,
    deleteView,
    setDefaultView,
    clearObjects,
    setObjectRoomIds,
    addRoom,
    updateRoom,
    deleteRoom,
    addRevision,
    restoreRevision,
    updateRevision,
    deleteRevision,
    clearRevisions,
    setFloorPlanRevisions,
    addLink,
    deleteLink,
    updateLink,
    addRackLink,
    deleteRackLink,
    updateRackItem,
    updateClientLayers
  } = useDataStore(
    useShallow((s) => ({
      addObject: s.addObject,
      updateObject: s.updateObject,
      moveObject: s.moveObject,
      deleteObject: s.deleteObject,
      updateFloorPlan: s.updateFloorPlan,
      setFloorPlanContent: s.setFloorPlanContent,
      addView: s.addView,
      updateView: s.updateView,
      deleteView: s.deleteView,
      setDefaultView: s.setDefaultView,
      clearObjects: s.clearObjects,
      setObjectRoomIds: s.setObjectRoomIds,
      addRoom: s.addRoom,
      updateRoom: s.updateRoom,
      deleteRoom: s.deleteRoom,
      addRevision: s.addRevision,
      restoreRevision: (s as any).restoreRevision,
      updateRevision: (s as any).updateRevision,
      deleteRevision: s.deleteRevision,
      clearRevisions: s.clearRevisions,
      setFloorPlanRevisions: (s as any).setFloorPlanRevisions,
      addLink: (s as any).addLink,
      deleteLink: (s as any).deleteLink,
      updateLink: (s as any).updateLink,
      addRackLink: (s as any).addRackLink,
      deleteRackLink: (s as any).deleteRackLink,
      updateRackItem: (s as any).updateRackItem,
      updateClientLayers: (s as any).updateClientLayers
	    }))
	  );

  const objectTypeDefs = useDataStore((s) => s.objectTypes);
  const {
    objectTypeById,
    wallTypeIdSet,
    wallTypeDefs,
    doorTypeIdSet,
    defaultDoorCatalogId,
    deskCatalogDefs,
    wallAttenuationByType,
    defaultWallTypeId,
    getTypeLabel,
    getTypeIcon,
    isWallType,
    isDoorType,
    formatNumber,
    getLayerNote,
    objectTypeIcons,
    objectTypeLabels,
    isCameraType,
    inferDefaultLayerIds,
    normalizeVisibleLayerIdsByPlan,
  } = usePlanTypeCatalog(objectTypeDefs, lang);

  const {
    selectedObjectId,
    selectedObjectIds,
    setSelectedObject,
    setSelection,
    toggleSelectedObject,
    clearSelection,
    setSelectedPlan,
    selectedRevisionByPlan,
    setSelectedRevision,
    zoom,
    setZoom,
    pan,
    setPan,
    saveViewport,
	    loadViewport,
	    triggerHighlight,
	    highlight,
	    lastObjectScale,
	    setLastObjectScale,
    lastQuoteScale,
    setLastQuoteScale,
    lastQuoteColor,
    setLastQuoteColor,
    lastQuoteLabelPosH,
    setLastQuoteLabelPosH,
    lastQuoteLabelPosV,
    setLastQuoteLabelPosV,
    lastQuoteLabelScale,
    setLastQuoteLabelScale,
    lastQuoteLabelBg,
    setLastQuoteLabelBg,
    lastQuoteLabelColor,
    setLastQuoteLabelColor,
    lastQuoteDashed,
    setLastQuoteDashed,
    lastQuoteEndpoint,
    setLastQuoteEndpoint,
    visibleLayerIdsByPlan,
    setVisibleLayerIds,
    gridSnapEnabled,
    gridSize,
    showGrid,
    setGridSnapEnabled,
    setGridSize,
    setShowGrid,
    showPrintAreaByPlan,
    toggleShowPrintArea,
	    roomCapacityStateByPlan,
	    setRoomCapacityState,
		    perfOverlayEnabled,
		    presentationMode,
		    togglePresentationMode,
		    presentationEnterRequested,
		    clearPresentationEnterRequest,
		    hiddenLayersByPlan,
		    setHideAllLayers,
	    setLockedPlans,
    setPlanDirty,
    requestSaveAndNavigate,
    pendingSaveNavigateTo,
    clearPendingSaveNavigate,
    pendingPostSaveAction,
    clearPendingPostSaveAction
  } = useUIStore(
    useShallow((s) => ({
      selectedObjectId: s.selectedObjectId,
      selectedObjectIds: s.selectedObjectIds,
      setSelectedObject: s.setSelectedObject,
      setSelection: s.setSelection,
      toggleSelectedObject: s.toggleSelectedObject,
      clearSelection: s.clearSelection,
      setSelectedPlan: s.setSelectedPlan,
      selectedRevisionByPlan: s.selectedRevisionByPlan,
      setSelectedRevision: s.setSelectedRevision,
      zoom: s.zoom,
      setZoom: s.setZoom,
      pan: s.pan,
      setPan: s.setPan,
      saveViewport: s.saveViewport,
	      loadViewport: s.loadViewport,
	      triggerHighlight: s.triggerHighlight,
	      highlight: s.highlight,
	      lastObjectScale: s.lastObjectScale,
	      setLastObjectScale: s.setLastObjectScale,
      lastQuoteScale: s.lastQuoteScale,
      setLastQuoteScale: s.setLastQuoteScale,
      lastQuoteColor: s.lastQuoteColor,
      setLastQuoteColor: s.setLastQuoteColor,
      lastQuoteLabelPosH: s.lastQuoteLabelPosH,
      setLastQuoteLabelPosH: s.setLastQuoteLabelPosH,
      lastQuoteLabelPosV: s.lastQuoteLabelPosV,
      setLastQuoteLabelPosV: s.setLastQuoteLabelPosV,
      lastQuoteLabelScale: s.lastQuoteLabelScale,
      setLastQuoteLabelScale: s.setLastQuoteLabelScale,
      lastQuoteLabelBg: s.lastQuoteLabelBg,
      setLastQuoteLabelBg: s.setLastQuoteLabelBg,
      lastQuoteLabelColor: s.lastQuoteLabelColor,
      setLastQuoteLabelColor: s.setLastQuoteLabelColor,
      lastQuoteDashed: s.lastQuoteDashed,
      setLastQuoteDashed: s.setLastQuoteDashed,
      lastQuoteEndpoint: s.lastQuoteEndpoint,
      setLastQuoteEndpoint: s.setLastQuoteEndpoint,
      visibleLayerIdsByPlan: (s as any).visibleLayerIdsByPlan,
      setVisibleLayerIds: (s as any).setVisibleLayerIds,
      gridSnapEnabled: (s as any).gridSnapEnabled,
      gridSize: (s as any).gridSize,
      showGrid: (s as any).showGrid,
      setGridSnapEnabled: (s as any).setGridSnapEnabled,
      setGridSize: (s as any).setGridSize,
      setShowGrid: (s as any).setShowGrid,
      showPrintAreaByPlan: (s as any).showPrintAreaByPlan,
      toggleShowPrintArea: (s as any).toggleShowPrintArea,
	      roomCapacityStateByPlan: (s as any).roomCapacityStateByPlan,
	      setRoomCapacityState: (s as any).setRoomCapacityState,
		      perfOverlayEnabled: (s as any).perfOverlayEnabled,
		      presentationMode: (s as any).presentationMode,
		      togglePresentationMode: (s as any).togglePresentationMode,
		      presentationEnterRequested: (s as any).presentationEnterRequested,
		      clearPresentationEnterRequest: (s as any).clearPresentationEnterRequest,
		      hiddenLayersByPlan: (s as any).hiddenLayersByPlan,
		      setHideAllLayers: (s as any).setHideAllLayers,
	      setLockedPlans: (s as any).setLockedPlans,
      setPlanDirty: (s as any).setPlanDirty,
      requestSaveAndNavigate: (s as any).requestSaveAndNavigate,
      pendingSaveNavigateTo: (s as any).pendingSaveNavigateTo,
      clearPendingSaveNavigate: (s as any).clearPendingSaveNavigate,
      pendingPostSaveAction: (s as any).pendingPostSaveAction,
      clearPendingPostSaveAction: (s as any).clearPendingPostSaveAction
    }))
  );

  const { push, pushStack } = useToastStore((s) => ({ push: s.push, pushStack: (s as any).pushStack }));
  const saveCustomValues = useCustomFieldsStore((s) => s.saveObjectValues);
  const loadCustomValues = useCustomFieldsStore((s) => s.loadObjectValues);
  const dataVersion = useDataStore((s) => s.version);
  const [pendingType, setPendingType] = useState<MapObjectType | null>(null);
  const [linkCreateMode, setLinkCreateMode] = useState<'arrow' | 'cable'>('arrow');
  const [modalState, setModalState] = useState<PlanObjectModalState>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [pendingRoomDeletes, setPendingRoomDeletes] = useState<string[]>([]);
  const [confirmDeleteViewId, setConfirmDeleteViewId] = useState<string | null>(null);
  const [confirmSetDefaultViewId, setConfirmSetDefaultViewId] = useState<string | null>(null);
  const [confirmClearObjects, setConfirmClearObjects] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditSelectionOpen, setBulkEditSelectionOpen] = useState(false);
  const returnToBulkEditRef = useRef(false);
  const [selectedObjectsModalOpen, setSelectedObjectsModalOpen] = useState(false);
  const [chooseDefaultModal, setChooseDefaultModal] = useState<{ deletingViewId: string } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  // reserved for future multi-plan export (disabled for now)
  const [printAreaMode, setPrintAreaMode] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [saveRevisionOpen, setSaveRevisionOpen] = useState(false);
  const [saveRevisionModalPreset, setSaveRevisionModalPreset] = useState<{ initialBump: 'major' | 'minor'; requireNoteForMajor: boolean }>({
    initialBump: 'minor',
    requireNoteForMajor: false
  });
  const [realUserPicker, setRealUserPicker] = useState<{ x: number; y: number } | null>(null);
  const [realUserImportMissing, setRealUserImportMissing] = useState(false);
  const [roomDepartmentConfirm, setRoomDepartmentConfirm] = useState<RoomDepartmentConfirmState>(null);
  const [undoConfirm, setUndoConfirm] = useState<{ id: string; name: string } | null>(null);
  const [overlapNotice, setOverlapNotice] = useState<string | null>(null);
  const roomOverlapNoticeRef = useRef(0);
  const roomLayerNoticeRef = useRef(0);
  const nonPeopleRoomNoticeRef = useRef(0);
  const [allTypesOpen, setAllTypesOpen] = useState(false);
  const [allTypesDefaultTab, setAllTypesDefaultTab] = useState<'all' | 'objects' | 'desks' | 'walls' | 'text' | 'notes' | 'security'>(
    'objects'
  );
  const [roomCatalogOpen, setRoomCatalogOpen] = useState(false);
  const [wallCatalogOpen, setWallCatalogOpen] = useState(false);
  const [deskCatalogOpen, setDeskCatalogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<PlanContextMenuState>(null);
  const [layersContextMenu, setLayersContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const returnToSelectionListRef = useRef(false);
  const lastInsertedRef = useRef<{ id: string; name: string } | null>(null);
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerClickRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<Map<string, { x: number; y: number; roomId?: string }>>(new Map());
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const [rackModal, setRackModal] = useState<{ objectId: string } | null>(null);
  const [rackPortsLink, setRackPortsLink] = useState<RackPortsLinkState>(null);
  const [selectedViewId, setSelectedViewId] = useState<string>('__last__');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchResultsTerm, setSearchResultsTerm] = useState('');
  const [searchResultsObjects, setSearchResultsObjects] = useState<MapObject[]>([]);
  const [searchResultsRooms, setSearchResultsRooms] = useState<Room[]>([]);
  const [crossPlanSearchOpen, setCrossPlanSearchOpen] = useState(false);
  const [crossPlanSearchTerm, setCrossPlanSearchTerm] = useState('');
  const [crossPlanResults, setCrossPlanResults] = useState<CrossPlanSearchResult[]>([]);
  const [internalMapOpen, setInternalMapOpen] = useState(false);
  const [escapeRouteModal, setEscapeRouteModal] = useState<EscapeRouteModalState>(null);
  const [emergencyContactsOpen, setEmergencyContactsOpen] = useState(false);
  const [countsOpen, setCountsOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [layersPopoverOpen, setLayersPopoverOpen] = useState(false);
  const [layersQuickMenu, setLayersQuickMenu] = useState<{ x: number; y: number } | null>(null);
  const [layerRevealPrompt, setLayerRevealPrompt] = useState<LayerRevealPromptState>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [typeMenu, setTypeMenu] = useState<{ typeId: string; label: string; icon?: IconName; x: number; y: number } | null>(null);
  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const layersContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [typeLayerModal, setTypeLayerModal] = useState<{ typeId: string; label: string } | null>(null);
  const [typeLayerName, setTypeLayerName] = useState('');
  const [typeLayerColor, setTypeLayerColor] = useState('#0ea5e9');
  const typeLayerNameRef = useRef<HTMLInputElement | null>(null);
  const [objectListQuery, setObjectListQuery] = useState('');
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [roomAllocationOpen, setRoomAllocationOpen] = useState(false);
  const [roomAllocationPreset, setRoomAllocationPreset] = useState<{ clientId?: string; siteId?: string } | null>(null);
  const [meetingManagerOpen, setMeetingManagerOpen] = useState(false);
  const [meetingHubModalOpen, setMeetingHubModalOpen] = useState(false);
  const [meetingManagerPreset, setMeetingManagerPreset] = useState<MeetingManagerPresetState>(null);
  const [myMeetingsModal, setMyMeetingsModal] = useState<MyMeetingsModalState | null>(null);
  const [myMeetingsSearch, setMyMeetingsSearch] = useState('');
  const [myMeetingsCheckInBusyId, setMyMeetingsCheckInBusyId] = useState<string | null>(null);
  const [myMeetingsCheckInDoneById, setMyMeetingsCheckInDoneById] = useState<Record<string, true>>({});
  const [pendingMeetingManagerPreset, setPendingMeetingManagerPreset] = useState<MeetingManagerPresetState>(null);
  const [pendingClientMeetingsPreset, setPendingClientMeetingsPreset] = useState<ClientMeetingsPresetState>(null);
  const [meetingStatusByRoomId, setMeetingStatusByRoomId] = useState<Record<string, { hasMeetingToday: boolean; inProgress: boolean; hasFutureToday: boolean }>>({});
  const meetingHubFocusRef = useRef<HTMLButtonElement | null>(null);
  const myMeetingsFocusRef = useRef<HTMLButtonElement | null>(null);
  const myMeetingsRestoreRef = useRef<MyMeetingsModalState | null>(null);
  const reloadMyMeetingsRef = useRef<null | (() => Promise<void>)>(null);
  const [roomKioskInfoModal, setRoomKioskInfoModal] = useState<RoomKioskInfoModalState | null>(null);
  const { link: roomKioskInfoLink, qrDataUrl: roomKioskInfoQrDataUrl } = useMeetingRoomKioskInfo({
    roomId: roomKioskInfoModal?.roomId,
    enabled: !!roomKioskInfoModal?.roomId,
    qrWidth: 300
  });
  const [roomDepartmentOptions, setRoomDepartmentOptions] = useState<string[]>([]);
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement | null>(null);
  const presenceRef = useRef<HTMLDivElement | null>(null);
  const [scaleActionsOpen, setScaleActionsOpen] = useState(false);
  const [clearScaleConfirmOpen, setClearScaleConfirmOpen] = useState(false);
  const [scalePromptDismissed, setScalePromptDismissed] = useState(false);
  const layersPopoverRef = useRef<HTMLDivElement | null>(null);
  const layersQuickMenuRef = useRef<HTMLDivElement | null>(null);
  const {
    panToolActive,
    setPanToolActive,
    expandedRoomId,
    setExpandedRoomId,
    selectedRoomId,
    setSelectedRoomId,
    selectedRoomIds,
    setSelectedRoomIds,
    selectedCorridorId,
    setSelectedCorridorId,
    selectedCorridorDoor,
    setSelectedCorridorDoor,
    selectedRoomDoorId,
    setSelectedRoomDoorId,
    selectedLinkId,
    setSelectedLinkId,
    wallQuickMenu,
    setWallQuickMenu,
    corridorQuickMenu,
    setCorridorQuickMenu,
    corridorDoorDraft,
    setCorridorDoorDraft,
    roomDoorDraft,
    setRoomDoorDraft,
    wallTypeMenu,
    setWallTypeMenu,
    mapSubmenu,
    setMapSubmenu,
    linkFromId,
    setLinkFromId,
    cableModal,
    setCableModal,
    linksModalObjectId,
    setLinksModalObjectId,
    linkEditId,
    setLinkEditId,
    realUserDetailsId,
    setRealUserDetailsId,
    photoViewer,
    setPhotoViewer
  } = usePlanSelectionState();
  const {
    roomDrawMode,
    setRoomDrawMode,
    corridorDrawMode,
    setCorridorDrawMode,
    wallDrawMode,
    setWallDrawMode,
    wallDrawType,
    setWallDrawType,
    wallDraftPoints,
    setWallDraftPoints,
    wallDraftPointer,
    setWallDraftPointer,
    scaleMode,
    setScaleMode,
    scaleDraft,
    setScaleDraft,
    scaleDraftPointer,
    setScaleDraftPointer,
    scaleModal,
    setScaleModal,
    scaleMetersInput,
    setScaleMetersInput,
    showScaleLine,
    setShowScaleLine,
    measureMode,
    setMeasureMode,
    measurePoints,
    setMeasurePoints,
    measurePointer,
    setMeasurePointer,
    measureClosed,
    setMeasureClosed,
    measureFinished,
    setMeasureFinished,
    quoteMode,
    setQuoteMode,
    quotePoints,
    setQuotePoints,
    quotePointer,
    setQuotePointer
  } = usePlanDrawingState();
  const wallDraftPointsRef = useRef<{ x: number; y: number }[]>([]);
  const wallDraftSegmentIdsRef = useRef<string[]>([]);
  const measurePointsRef = useRef<{ x: number; y: number }[]>([]);
  const measureClosedRef = useRef(false);
  const measureFinishedRef = useRef(false);
  const toolClickHistoryRef = useRef<{ x: number; y: number; at: number }[]>([]);
  const scaleToastIdRef = useRef<string | number | null>(null);
  const wallToastIdRef = useRef<string | number | null>(null);
  const measureToastIdRef = useRef<string | number | null>(null);
  useSyncedRef(measurePointsRef, measurePoints);
  useSyncedRef(measureClosedRef, measureClosed);
  useSyncedRef(measureFinishedRef, measureFinished);
  const toolMode: 'scale' | 'wall' | 'quote' | 'measure' | null = scaleMode ? 'scale' : wallDrawMode ? 'wall' : quoteMode ? 'quote' : measureMode ? 'measure' : null;
  const [newRoomMenuOpen, setNewRoomMenuOpen] = useState(false);
  const [highlightRoom, setHighlightRoom] = useState<{ roomId: string; until: number } | null>(null);
  const {
    roomModal,
    setRoomModal,
    roomMeasuresModal,
    setRoomMeasuresModal,
    roomLayoutExportModal,
    setRoomLayoutExportModal,
    confirmDeleteRoomId,
    setConfirmDeleteRoomId,
    confirmDeleteRoomIds,
    setConfirmDeleteRoomIds,
    confirmDeleteCorridorId,
    setConfirmDeleteCorridorId,
    corridorModal,
    setCorridorModal,
    corridorNameInput,
    setCorridorNameInput,
    corridorNameEnInput,
    setCorridorNameEnInput,
    corridorNameInputRef,
    corridorShowNameInput,
    setCorridorShowNameInput,
    corridorDoorModal,
    setCorridorDoorModal,
    corridorDoorLinkModal,
    setCorridorDoorLinkModal,
    corridorDoorLinkQuery,
    setCorridorDoorLinkQuery,
    corridorConnectionModal,
    setCorridorConnectionModal,
    wallTypeModal,
    setWallTypeModal,
    wallTypeDraft,
    setWallTypeDraft,
    roomWallTypeModal,
    setRoomWallTypeModal,
    roomWallTypeSelections,
    setRoomWallTypeSelections,
    roomWallPrompt,
    setRoomWallPrompt
  } = usePlanModalState();
  usePlanCorridorModalEffects({
    corridorModal,
    setCorridorNameInput,
    setCorridorNameEnInput,
    setCorridorShowNameInput,
    corridorNameInputRef,
    corridorDoorLinkModal,
    corridorDoorLinkQuery,
    setCorridorDoorLinkQuery
  });
  const planRef = useRef<FloorPlan | undefined>(undefined);
  const selectedObjectIdRef = useRef<string | undefined>(selectedObjectId);
  const selectedObjectIdsRef = useRef<string[]>(selectedObjectIds);
  const selectedLinkIdRef = useRef<string | null>(selectedLinkId);
  const selectedRoomIdRef = useRef<string | undefined>(selectedRoomId);
  const confirmDeleteRef = useRef<string[] | null>(confirmDelete);
  const pendingRoomDeletesRef = useRef<string[]>(pendingRoomDeletes);
  const skipRoomWallTypesRef = useRef(false);
  const deskToastKeyRef = useRef<string>('');
  const deskToastIdRef = useRef<string | number | null>(null);
  const wallMoveBatchRef = useRef<{ id: string | null; movedGroups: Set<string>; movedWalls: Set<string>; movedRooms: Set<string> }>({
    id: null,
    movedGroups: new Set(),
    movedWalls: new Set(),
    movedRooms: new Set()
  });
  const selectionToastKeyRef = useRef<string>('');
  const selectionToastIdRef = useRef<string | number | null>(null);
  const multiToastKeyRef = useRef<string>('');
  const multiToastIdRef = useRef<string | number | null>(null);
  const quoteToastKeyRef = useRef('');
  const quoteToastIdRef = useRef<string | number | null>(null);
  const mediaToastKeyRef = useRef('');
  const mediaToastIdRef = useRef<string | number | null>(null);
  const selectionHintToastIds = useRef({
    selection: 'plixmap-selection-hint',
    desk: 'plixmap-desk-hint',
    multi: 'plixmap-multi-hint',
    quote: 'plixmap-quote-hint',
    media: 'plixmap-media-hint'
  });
  const zoomRef = useRef<number>(zoom);
  const renderStartRef = useRef(0);
  const layerVisibilitySyncRef = useRef<string>('');
  renderStartRef.current = performance.now();

  const dismissSelectionHintToasts = useCallback(() => {
    runDismissSelectionHintToasts({
      selectionHintToastIds,
      selectionToastKeyRef,
      selectionToastIdRef,
      deskToastKeyRef,
      deskToastIdRef,
      multiToastKeyRef,
      multiToastIdRef,
      quoteToastKeyRef,
      quoteToastIdRef,
      mediaToastKeyRef,
      mediaToastIdRef
    });
  }, []);

  useSyncedRef(zoomRef, zoom);
  const panRef = useRef(pan);
  useSyncedRef(panRef, pan);
  const handleMapMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
  }, []);
  const handleMapMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
    lastPointerClickRef.current = { x: event.clientX, y: event.clientY };
  }, []);
  const getPastePoint = useCallback(
    () => computeGetPastePoint({ lastPointerClickRef, mapRef, zoomRef, panRef }),
    []
  );
  useSyncedRef(wallDraftPointsRef, wallDraftPoints);

  const plan = useDataStore(
    useCallback((s) => s.findFloorPlan(planId), [planId])
  );
  const allClients = useDataStore((s) => s.clients);
  const client = useDataStore(
    useCallback((s) => s.findClientByPlan(planId), [planId])
  );
  const updateClient = useDataStore((s: any) => s.updateClient);
  const site = useDataStore(
    useCallback((s) => s.findSiteByPlan(planId), [planId])
  );
  const siteFloorPlans = useMemo(() => ((site?.floorPlans || []) as FloorPlan[]).filter(Boolean), [site?.floorPlans]);
  useEffect(() => {
    if (!planId) return;
    if (plan?.revisionsLoaded) return;
    let cancelled = false;
    fetchPlanRevisions(planId)
      .then((payload) => {
        if (cancelled) return;
        setFloorPlanRevisions(planId, Array.isArray(payload?.revisions) ? payload.revisions : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [plan?.revisionsLoaded, planId, setFloorPlanRevisions]);
  const clientBusinessPartnerNames = useMemo(() => computeClientBusinessPartnerNames(client), [client]);
  const siteMeetingParticipantCandidates = useMemo(
    () => computeSiteMeetingParticipantCandidates(siteFloorPlans),
    [siteFloorPlans]
  );
  useEffect(() => runMeetingOverviewEffect({
    client,
    site,
    planId,
    setMeetingStatusByRoomId
  }), [client?.id, planId, site?.id]);

  const {
    addTimelineMeetingManualParticipant,
    addTimelineMeetingRealParticipant,
    adjustRoomMeetingEditEndTime,
    closeRoomMeetingBookingDetail,
    closeRoomMeetingEditParticipantsModal,
    closeRoomMeetingsTimelineModal,
    confirmDeleteRoomMeetingBooking,
    extendRoomMeetingBooking,
    getMeetingCheckInStats,
    getRoomMeetingCheckInEntries,
    jumpToTimelineMeetingFromSearch,
    meetingCheckInEntryKey,
    openRoomMeetingBookingDetail,
    openRoomMeetingDuplicateModal,
    openRoomMeetingEditParticipantsModal,
    openRoomMeetingsTimeline,
    promptDeleteRoomMeetingBooking,
    reloadRoomMeetingsTimeline,
    removeTimelineMeetingParticipant,
    restoreMyMeetingsFromSnapshot,
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
    saveRoomMeetingBookingEdit,
    saveRoomMeetingDuplicates,
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
    toggleTimelineMeetingParticipantFlag
  } = useRoomMeetingsTimeline({
    t,
    push,
    plan,
    client,
    site,
    planId,
    siteMeetingParticipantCandidates,
    myMeetingsModal,
    setMyMeetingsModal,
    myMeetingsRestoreRef,
    reloadMyMeetingsRef
  });

  useEffect(() => runRoomDepartmentOptionsEffect({
    client,
    allClients,
    setRoomDepartmentOptions
  }), [allClients, client?.id]);
  const { user, permissions } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);

  const selectedRevisionId = selectedRevisionByPlan[planId] ?? null;
  const activeRevision = useMemo(() => {
    if (!plan || !selectedRevisionId) return undefined;
    return (plan.revisions || []).find((r) => r.id === selectedRevisionId);
  }, [plan, selectedRevisionId]);

  const location = useLocation();
  const navigate = useNavigate();
  const searchDebugEnabled = useMemo(() => {
    if (!import.meta.env.DEV) return false;
    try {
      return new URLSearchParams(location.search || '').get('searchDebug') === '1';
    } catch {
      return false;
    }
  }, [location.search]);
  const perfEnabled = (() => {
    try {
      return new URLSearchParams(location.search || '').get('perf') === '1' || perfOverlayEnabled;
    } catch {
      return perfOverlayEnabled;
    }
  })();

  useEffect(() => {
    if (!perfEnabled) return;
    perfMetrics.planViewRenders += 1;
    perfMetrics.planViewLastRenderMs = Math.round(performance.now() - renderStartRef.current);
  });

  usePlanWallTypeModalEffects({
    wallTypeModal,
    setWallTypeDraft,
    roomWallTypeModal,
    setRoomWallTypeSelections,
    defaultWallTypeId
  });

  useEffect(() => {
    // Always start from the "present" when entering the workspace for a plan.
    setSelectedRevision(planId, null);
  }, [planId, setSelectedRevision]);

  const forceDefaultView = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search || '');
      return sp.get('dv') === '1';
    } catch {
      return false;
    }
  }, [location.search]);

  // Avoid re-applying viewport on every data change (plan updates clone references).
  const viewportInitRef = useRef<string | null>(null);
  const autoCenterRef = useRef<string | null>(null);

  useEffect(() => {
    // Close any open context menus when switching plans.
    setContextMenu(null);
    setLayersContextMenu(null);
    setLinksModalObjectId(null);
    setWallQuickMenu(null);
    setWallTypeMenu(null);
  }, [planId]);

  useEffect(() => {
    if (!forceDefaultView) return;
    viewportInitRef.current = null;
    // Clean up the URL (removes dv=1) once we are back in the workspace.
    window.setTimeout(() => {
      navigate(`/plan/${planId}`, { replace: true });
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceDefaultView, navigate, planId, selectedRevisionId]);

  const planAccess = useMemo<'ro' | 'rw'>(() => {
    if (!user) return 'ro';
    if (user.isAdmin) return 'rw';
    const planPerm = permissions.find((p) => p.scopeType === 'plan' && p.scopeId === planId);
    if (planPerm) return planPerm.access;
    if (site?.id) {
      const sitePerm = permissions.find((p) => p.scopeType === 'site' && p.scopeId === site.id);
      if (sitePerm) return sitePerm.access;
    }
    if (client?.id) {
      const clientPerm = permissions.find((p) => p.scopeType === 'client' && p.scopeId === client.id);
      if (clientPerm) return clientPerm.access;
    }
    return 'ro';
  }, [client?.id, permissions, planId, site?.id, user]);
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const isMeetingAdminLike = !!user?.isAdmin || !!user?.isSuperAdmin;
  const canManageMeetingScheduling = useMemo(
    () =>
      isMeetingAdminLike ||
      !!(user as any)?.canCreateMeetings ||
      !!(user as any)?.isMeetingOperator,
    [isMeetingAdminLike, user]
  );
  const canUseMeetingNotes = useCallback(
    (booking: MeetingBooking | null | undefined) => {
      if (!booking) return false;
      if (isMeetingAdminLike) return true;
      const linkedExternalClientId = String((user as any)?.linkedExternalClientId || '').trim();
      const linkedExternalId = String((user as any)?.linkedExternalId || '').trim();
      const userEmail = String(user?.email || '').trim().toLowerCase();
      const participants = Array.isArray(booking.participants) ? booking.participants : [];
      return participants.some((row) => {
        if (String(row?.kind || 'real_user') === 'manual') return false;
        const participantExternalId = String(row?.externalId || '').trim();
        const participantEmail = String(row?.email || '').trim().toLowerCase();
        if (linkedExternalId && linkedExternalClientId && linkedExternalClientId === String(booking.clientId || '') && participantExternalId === linkedExternalId) {
          return true;
        }
        return !!userEmail && !!participantEmail && participantEmail === userEmail;
      });
    },
    [isMeetingAdminLike, user]
  );

  const meetingLocationLabels = useMemo(() => computeMeetingLocationLabels(allClients), [allClients]);

  const myMeetingsFiltered = useMemo(
    () => computeMyMeetingsFiltered({ myMeetingsModal, myMeetingsSearch, meetingLocationLabels }),
    [meetingLocationLabels, myMeetingsModal?.meetings, myMeetingsSearch]
  );

  const LOCK_REQUEST_THROTTLE_MS = 5_000;
  const LOCK_TOAST_MS = 5_000;

	  type PresenceUser = {
	    userId: string;
	    username: string;
	    avatarUrl?: string;
	    connectedAt?: number | null;
	    ip?: string;
	    lock?: { planId: string; clientName?: string; siteName?: string; planName?: string } | null;
	    locks?: { planId: string; clientName?: string; siteName?: string; planName?: string }[];
	  };

		  const [lockState, setLockState] = useState<PlanLockState>({ lockedBy: null, mine: false, grant: null, meta: null });
  const {
    lockInfoOpen,
    setLockInfoOpen,
    lockInfoRef,
    lockActiveTitle,
    lockedByTitle,
    formatMinutes,
    grantRemainingMinutes
  } = usePlanLock({ t, lockState });
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [globalPresenceUsers, setGlobalPresenceUsers] = useState<PresenceUser[]>([]);
  const [realtimeDisabled, setRealtimeDisabled] = useState(false);
  const realtimeDisabledRef = useRef(false);
		  const wsRef = useRef<WebSocket | null>(null);
		  const lockRequestAtRef = useRef(0);
		  const [unlockPrompt, setUnlockPrompt] = useState<UnlockPromptState>(null);
		  const [unlockBusy, setUnlockBusy] = useState(false);
		  const [unlockCompose, setUnlockCompose] = useState<{ target: PresenceUser; locks: UnlockRequestLock[] } | null>(null);
		  const [unlockGrantedPrompt, setUnlockGrantedPrompt] = useState<UnlockGrantedPromptState>(null);
		  const [forceUnlockConfig, setForceUnlockConfig] = useState<ForceUnlockConfigState>(null);
		  const [forceUnlockGraceMinutes, setForceUnlockGraceMinutes] = useState(5);
		  const [forceUnlockStarting, setForceUnlockStarting] = useState(false);
			  const [forceUnlockActive, setForceUnlockActive] = useState<ForceUnlockActiveState>(null);
			  const [forceUnlockIncoming, setForceUnlockIncoming] = useState<ForceUnlockIncomingState>(null);
  const [forceUnlockExecuteCommand, setForceUnlockExecuteCommand] = useState<{ requestId: string; action: 'save' | 'discard' } | null>(null);
  const [forceUnlockTick, setForceUnlockTick] = useState(0);
  const forceUnlockActiveFocusRef = useRef<HTMLButtonElement | null>(null);
  const forceUnlockIncomingFocusRef = useRef<HTMLButtonElement | null>(null);
  const forceUnlockConfigRef = useRef(forceUnlockConfig);
  const forceUnlockActiveRef = useRef(forceUnlockActive);
  const forceUnlockIncomingRef = useRef(forceUnlockIncoming);
		  useEffect(() => {
		    forceUnlockConfigRef.current = forceUnlockConfig;
		  }, [forceUnlockConfig]);
		  useEffect(() => {
		    forceUnlockActiveRef.current = forceUnlockActive;
		  }, [forceUnlockActive]);
		  useEffect(() => {
		    forceUnlockIncomingRef.current = forceUnlockIncoming;
		  }, [forceUnlockIncoming]);
  const formatPresenceDate = useCallback((value?: number | null) => computeFormatPresenceDate(value), []);

  const formatPresenceLock = useCallback(
    (
      lock?: { planId: string; clientName?: string; siteName?: string; planName?: string } | null,
      locks?: { planId: string; clientName?: string; siteName?: string; planName?: string }[]
    ) => computeFormatPresenceLock(lock, locks, t),
    [t]
  );

  // Prefer the global presence list (includes "locks" array). Fallback to plan presence if global is not available yet.
  const globalPresenceFallback = globalPresenceUsers.length ? globalPresenceUsers : presenceUsers;
  const presenceEntries = globalPresenceFallback;
  const presenceCount = presenceEntries.length;

	  const sendWs = useCallback((payload: any) => {
	    const ws = wsRef.current;
	    if (!ws || ws.readyState !== WebSocket.OPEN) return;
	    try {
	      ws.send(JSON.stringify(payload));
	    } catch {
	      // ignore
	    }
	  }, []);

	  useEffect(() => {
	    if (!forceUnlockActive && !forceUnlockIncoming) return;
	    const id = window.setInterval(() => setForceUnlockTick((x) => x + 1), 1000);
	    return () => window.clearInterval(id);
	  }, [forceUnlockActive?.requestId, forceUnlockIncoming?.requestId]);

  useEffect(() => runRealtimeWsEffect({
    user,
    realtimeDisabled,
    realtimeDisabledRef,
    activeRevision,
    planAccess,
    planId,
    perfEnabled,
    LOCK_TOAST_MS,
    wsRef,
    isReadOnlyRef,
    lockMineRef,
    planRef,
    forceUnlockConfigRef,
    forceUnlockActiveRef,
    forceUnlockIncomingRef,
    setLockState,
    updateLockedPlans,
    setPresenceUsers,
    setGlobalPresenceUsers,
    setLockedPlans,
    setUnlockPrompt,
    setUnlockGrantedPrompt,
    setForceUnlockStarting,
    setForceUnlockActive,
    setForceUnlockConfig,
    setForceUnlockIncoming,
    setForceUnlockExecuteCommand,
    setRealtimeDisabled,
    pushStack,
    t
  }), [activeRevision, planAccess, planId, realtimeDisabled, user?.id]);

	  const lockRequired = !realtimeDisabled && planAccess === 'rw' && !activeRevision;
	  const grantBlocks = lockRequired && !!lockState.grant && !!lockState.grant.userId && lockState.grant.userId !== user?.id;
	  const lockedByOther = lockRequired && ((!!lockState.lockedBy && !lockState.mine) || grantBlocks);
	  const lockAvailable =
	    lockRequired && !lockState.lockedBy && (!lockState.grant || !lockState.grant.userId || lockState.grant.userId === user?.id);
	  const isReadOnly = !!activeRevision || planAccess !== 'rw' || (lockRequired && !lockState.mine);
	  const isReadOnlyRef = useRef(isReadOnly);
	  const lockMineRef = useRef(lockState.mine);
	  const planIdRefForWs = useRef(planId);
	  const lastPlanActionSentAtRef = useRef(0);
	  const lastPlanDirtySentAtRef = useRef(0);
	  const lastPlanDirtyValueRef = useRef<boolean | null>(null);
	  useEffect(() => {
	    isReadOnlyRef.current = isReadOnly;
	  }, [isReadOnly]);
	  useEffect(() => {
	    lockMineRef.current = lockState.mine;
	  }, [lockState.mine]);
	  useEffect(() => {
	    planIdRefForWs.current = planId;
	  }, [planId]);

	  const requestPlanLock = useCallback(() => {
	    if (!lockRequired) return;
	    if (lockState.mine) return;
	    if (lockState.lockedBy) return;
	    if (lockState.grant?.userId && lockState.grant.userId !== user?.id) return;
	    const now = Date.now();
	    if (now - lockRequestAtRef.current < LOCK_REQUEST_THROTTLE_MS) return;
	    lockRequestAtRef.current = now;
	    sendWs({ type: 'request_lock', planId });
	  }, [LOCK_REQUEST_THROTTLE_MS, lockRequired, lockState.grant?.userId, lockState.lockedBy, lockState.mine, planId, sendWs, user?.id]);

	  const updateLockedPlans = useCallback(
	    (
	      lockedBy: { userId: string; username: string; avatarUrl?: string } | null,
	      grant:
	        | {
	            userId: string;
	            username: string;
	            avatarUrl?: string;
	            grantedAt?: number | null;
	            expiresAt?: number | null;
	            minutes?: number | null;
	            grantedBy?: { userId: string; username: string } | null;
	          }
	        | null,
	      meta:
	        | {
	            lastActionAt?: number | null;
	            lastSavedAt?: number | null;
	            lastSavedRev?: string | null;
	          }
	        | null,
	      targetPlanId: string
	    ) => {
	      runUpdateLockedPlans(lockedBy, grant, meta, targetPlanId, { setLockedPlans });
	    },
	    [setLockedPlans]
	  );

	  useEffect(() => {
	    if (!lockAvailable) return;
	    if (lockState.mine) return;
	    requestPlanLock();
	  }, [lockAvailable, lockState.mine, requestPlanLock]);

  const prevMineRef = useRef(false);
  useEffect(() => {
	    if (prevMineRef.current && !lockState.mine && lockRequired) {
	      pushStack(
	        t({
	          it: 'Lock perso: la planimetria è ora in sola lettura.',
	          en: 'Lock lost: the floor plan is now read-only.'
	        }),
	        'info',
	        { duration: LOCK_TOAST_MS }
	      );
	    }
    prevMineRef.current = lockState.mine;
  }, [LOCK_TOAST_MS, lockRequired, lockState.mine, pushStack, t]);
  const renderPlan = useMemo<FloorPlan | undefined>(() => {
    if (!plan) return undefined;
    if (!activeRevision) return plan;
    const revisionViews = (activeRevision as any).views as FloorPlanView[] | undefined;
    const effectiveViews =
      Array.isArray(revisionViews) && revisionViews.length ? revisionViews : plan.views || [];
    return {
      ...plan,
      scale: (activeRevision as any).scale ?? plan.scale,
      imageUrl: activeRevision.imageUrl,
      width: activeRevision.width,
      height: activeRevision.height,
      rooms: activeRevision.rooms,
      corridors: (activeRevision as any).corridors ?? (plan as any).corridors,
      roomDoors: (activeRevision as any).roomDoors ?? (plan as any).roomDoors,
      links: (activeRevision as any).links || (plan as any).links,
      safetyCardLayout: (activeRevision as any).safetyCardLayout || (plan as any).safetyCardLayout,
      objects: activeRevision.objects,
      views: effectiveViews as any
    } as FloorPlan;
  }, [activeRevision, plan]);
  const {
    safetyCardPos,
    safetyCardSize,
    safetyCardFontSize,
    safetyCardFontIndex,
    safetyCardColorIndex,
    safetyCardTextBgIndex,
    handleSafetyCardChange
  } = usePlanSafetyCard({
    planRef,
    isReadOnlyRef,
    renderPlan,
    updateFloorPlan
  });
  const basePlan = plan as FloorPlan;
  const renderPlanObjectById = useMemo(() => {
    const map = new Map<string, MapObject>();
    const objects = (renderPlan?.objects || []) as MapObject[];
    for (const obj of objects) {
      map.set(obj.id, obj);
    }
    return map;
  }, [renderPlan?.objects]);
  const basePlanObjectById = useMemo(() => {
    const map = new Map<string, MapObject>();
    const objects = (basePlan?.objects || []) as MapObject[];
    for (const obj of objects) {
      map.set(obj.id, obj);
    }
    return map;
  }, [basePlan?.objects]);
  const renderPlanRoomById = useMemo(() => {
    const map = new Map<string, Room>();
    const rooms = (renderPlan?.rooms || []) as Room[];
    for (const room of rooms) {
      map.set(room.id, room);
    }
    return map;
  }, [renderPlan?.rooms]);
  const basePlanRoomById = useMemo(() => {
    const map = new Map<string, Room>();
    const rooms = (basePlan?.rooms || []) as Room[];
    for (const room of rooms) {
      map.set(room.id, room);
    }
    return map;
  }, [basePlan?.rooms]);
  const roomModalBaseRoom = useMemo(() => {
    if (!roomModal || roomModal.mode !== 'edit') return undefined;
    return basePlanRoomById.get(roomModal.roomId);
  }, [basePlanRoomById, roomModal]);
  const selectedObjects = useMemo(() => {
    if (!selectedObjectIds.length) return [] as MapObject[];
    const out: MapObject[] = [];
    for (const id of selectedObjectIds) {
      const obj = renderPlanObjectById.get(id);
      if (obj) out.push(obj);
    }
    return out;
  }, [renderPlanObjectById, selectedObjectIds]);
  const selectedSingleObject = useMemo(() => {
    if (selectedObjectIds.length !== 1) return undefined;
    return renderPlanObjectById.get(selectedObjectIds[0]);
  }, [renderPlanObjectById, selectedObjectIds]);
  const planScale = renderPlan?.scale;
  const metersPerPixel = useMemo(() => {
    const value = Number(planScale?.metersPerPixel);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [planScale?.metersPerPixel]);
  const {
    computePolylineLength,
    computePolygonArea,
    computeRoomSurfaceSqm,
    formatCornerLabel,
    buildRoomPreview,
    projectPointOnSegment,
    buildRoomWallSegments,
    getWallPolygonData,
  } = usePlanRoomGeometry({ metersPerPixel, lang, formatNumber, renderPlan, renderPlanObjectById, renderPlanRoomById, isWallType, defaultWallTypeId, t });
  useEffect(() => runResetToolsOnPlanChangeEffect({
    setWallDrawMode, setWallDrawType, setWallDraftPoints, wallDraftPointsRef, wallDraftSegmentIdsRef, setWallDraftPointer,
    setScaleMode, setScaleDraft, setScaleDraftPointer, setScaleModal, setScaleMetersInput, setShowScaleLine, planScale,
    setMeasureMode, setMeasurePoints, setMeasurePointer, setMeasureClosed, setMeasureFinished, setQuoteMode, setQuotePoints,
    setQuotePointer, setScalePromptDismissed
  }), [planId, planScale]);
  const scaleLabel = useMemo(() => {
    if (!planScale?.meters) return null;
    const unit = lang === 'it' ? 'ml' : 'm';
    return `${formatNumber(Number(planScale.meters))} ${unit}`;
  }, [formatNumber, lang, planScale?.meters]);
  const recommendedObjectScale = useMemo(
    () => computeRecommendedObjectScale(Number(renderPlan?.width || 0), Number(renderPlan?.height || 0)),
    [renderPlan?.height, renderPlan?.width]
  );
  const defaultObjectScale = useMemo(() => {
    if (lastObjectScale !== 1) return lastObjectScale;
    return Number.isFinite(recommendedObjectScale) ? recommendedObjectScale : 1;
  }, [lastObjectScale, recommendedObjectScale]);
  const scaleLine = useMemo(
    () => computeScaleLine({ showScaleLine, planScale, scaleLabel }),
    [
      planScale?.end,
      planScale?.labelScale,
      planScale?.opacity,
      planScale?.start,
      planScale?.strokeWidth,
      scaleLabel,
      showScaleLine
    ]
  );
  const measurePreviewPoints = useMemo(() => {
    if (!measurePoints.length) return [];
    if (measurePointer && !measureFinished && !measureClosed) {
      return [...measurePoints, measurePointer];
    }
    return measurePoints;
  }, [measureClosed, measureFinished, measurePointer, measurePoints]);
  const measureLengthPx = useMemo(() => {
    if (measurePreviewPoints.length < 2) return 0;
    let length = computePolylineLength(measurePreviewPoints);
    if (measureClosed && measurePreviewPoints.length > 2) {
      const first = measurePreviewPoints[0];
      const last = measurePreviewPoints[measurePreviewPoints.length - 1];
      length += Math.hypot(first.x - last.x, first.y - last.y);
    }
    return length;
  }, [computePolylineLength, measureClosed, measurePreviewPoints]);
  const measureAreaPx = useMemo(() => (measureClosed ? computePolygonArea(measurePoints) : 0), [computePolygonArea, measureClosed, measurePoints]);
  const measureLabel = useMemo(() => {
    if (!measurePreviewPoints.length) return null;
    if (metersPerPixel) {
      const meters = measureLengthPx * metersPerPixel;
      const unit = lang === 'it' ? 'ml' : 'm';
      return `${formatNumber(meters)} ${unit}`;
    }
    return `${formatNumber(measureLengthPx)} px`;
  }, [formatNumber, lang, measureLengthPx, measurePreviewPoints.length, metersPerPixel]);
  const measureAreaLabel = useMemo(() => {
    if (!measureClosed || !metersPerPixel) return null;
    const sqm = measureAreaPx * metersPerPixel * metersPerPixel;
    const unit = lang === 'it' ? 'mq' : 'sqm';
    return `${formatNumber(sqm)} ${unit}`;
  }, [formatNumber, lang, measureAreaPx, measureClosed, metersPerPixel]);
  const formatQuoteLabel = useCallback(
    (points: { x: number; y: number }[]) => {
      if (points.length < 2) return null;
      const lengthPx = computePolylineLength(points);
      if (metersPerPixel) {
        const unit = lang === 'it' ? 'ml' : 'm';
        return `${formatNumber(lengthPx * metersPerPixel)} ${unit}`;
      }
      return `${formatNumber(lengthPx)} px`;
    },
    [computePolylineLength, formatNumber, lang, metersPerPixel]
  );
  const quoteDraftLabel = useMemo(() => {
    if (!quotePoints.length) return null;
    const points = quotePointer ? [...quotePoints, quotePointer] : quotePoints;
    return formatQuoteLabel(points);
  }, [formatQuoteLabel, quotePoints, quotePointer]);

  const rackOverlayLinks = useMemo(() => computeRackOverlayLinks({ renderPlan }), [renderPlan]);

  const rackOverlayById = useMemo(
    () => new Map(rackOverlayLinks.map((link) => [String(link.id), link])),
    [rackOverlayLinks]
  );

  const planLayers = useMemo(() => {
    const layers = (client?.layers || []) as LayerDefinition[];
    return [...layers].sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
  }, [client?.layers]);
  const orderedPlanLayers = useMemo(() => {
    const idx = planLayers.findIndex((layer) => String(layer.id) === ALL_ITEMS_LAYER_ID);
    if (idx <= 0) return planLayers;
    const next = planLayers.slice();
    const [allItems] = next.splice(idx, 1);
    return [allItems, ...next];
  }, [planLayers]);
  const allItemsLabel = t({ it: 'Mostra Tutto', en: 'Show All' });
  const layerIds = useMemo(() => planLayers.map((l: any) => String(l.id)), [planLayers]);
  const nonAllLayerIds = useMemo(
    () => layerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID),
    [layerIds]
  );
  const defaultVisibleLayerIds = useMemo(
    () => getDefaultVisiblePlanLayerIds(layerIds, ALL_ITEMS_LAYER_ID, [SECURITY_LAYER_ID]),
    [layerIds]
  );
  const layerIdSet = useMemo(() => new Set(layerIds), [layerIds]);
  const normalizeLayerSelection = useCallback(
    (ids: string[]) => normalizePlanLayerSelection(layerIds, ids, ALL_ITEMS_LAYER_ID),
    [layerIds]
  );
  const getTypeLayerIds = useCallback((typeId: string) => computeGetTypeLayerIds(typeId, planLayers), [planLayers]);
  const getLayerIdsForType = useCallback(
    (typeId: string) => computeGetLayerIdsForType(typeId, { planLayers, inferDefaultLayerIds, layerIdSet }),
    [planLayers, inferDefaultLayerIds, layerIdSet]
  );
  const getObjectLayerIdsForVisibility = useCallback(
    (obj: MapObject) => computeGetObjectLayerIdsForVisibility(obj, { planLayers, inferDefaultLayerIds, layerIdSet }),
    [planLayers, inferDefaultLayerIds, layerIdSet]
  );
  const prevLayerIdsByPlanRef = useRef<Record<string, string[]>>({});
  const visibleLayerIds = useMemo(() => {
    const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
    if (typeof current === 'undefined') return normalizeLayerSelection(defaultVisibleLayerIds);
    return normalizeLayerSelection(current);
  }, [defaultVisibleLayerIds, normalizeLayerSelection, planId, visibleLayerIdsByPlan]);
  const hideAllLayers = !!hiddenLayersByPlan[planId];
  const allItemsSelected = visibleLayerIds.includes(ALL_ITEMS_LAYER_ID);
  const effectiveVisibleLayerIds = hideAllLayers
    ? []
    : allItemsSelected
      ? nonAllLayerIds
      : visibleLayerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID);
  const visibleLayerCount = hideAllLayers ? 0 : allItemsSelected ? nonAllLayerIds.length : effectiveVisibleLayerIds.length;
  const totalLayerCount = nonAllLayerIds.length;
  const layerActivationRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    layerActivationRef.current = new Set(effectiveVisibleLayerIds);
  }, [effectiveVisibleLayerIds]);

  const getLayerLabel = useCallback(
    (layerId: string) => computeGetLayerLabel(layerId, { planLayers, lang }),
    [lang, planLayers]
  );
  const getObjectToastLabel = useCallback(
    (name: string | undefined, typeId: string) => computeGetObjectToastLabel(name, typeId, getTypeLabel),
    [getTypeLabel]
  );
  const promptRevealForObject = useCallback(
    (obj: MapObject) => {
      const normalizedLayerIds = getObjectLayerIdsForVisibility(obj);
      if (!normalizedLayerIds.length) return false;
      const visibleSet = new Set(effectiveVisibleLayerIds);
      const missing = hideAllLayers
        ? normalizedLayerIds
        : normalizedLayerIds.filter((layerId) => !visibleSet.has(layerId));
      if (!missing.length) return false;
      setLayerRevealPrompt({
        objectId: obj.id,
        objectName: String(obj.name || ''),
        typeId: obj.type,
        missingLayerIds: Array.from(new Set(missing))
      });
      return true;
    },
    [effectiveVisibleLayerIds, getObjectLayerIdsForVisibility, hideAllLayers]
  );
  const getObjectBoundsForAlign = useCallback(
    (obj: MapObject) => computeGetObjectBoundsForAlign(obj, { canvasStageRef }),
    []
  );
  const ensureObjectLayerVisible = useCallback(
    (layerIds: string[] | undefined, name: string | undefined, typeId: string) =>
      computeEnsureObjectLayerVisible(layerIds, name, typeId, {
        getLayerLabel,
        getObjectToastLabel,
        hideAllLayers,
        layerIdSet,
        normalizeLayerSelection,
        planId,
        push,
        setHideAllLayers,
        setVisibleLayerIds,
        t,
        visibleLayerIds,
        layerActivationRef
      }),
    [
      getLayerLabel,
      getObjectToastLabel,
      hideAllLayers,
      layerIdSet,
      normalizeLayerSelection,
      planId,
      push,
      setHideAllLayers,
      setVisibleLayerIds,
      t,
      visibleLayerIds
    ]
  );
  useEffect(() => runLayerVisibilityInitEffect({
    layerIds, visibleLayerIdsByPlan, planId, prevLayerIdsByPlanRef, normalizeLayerSelection, defaultVisibleLayerIds, setVisibleLayerIds
  }), [defaultVisibleLayerIds, layerIds, normalizeLayerSelection, planId, setVisibleLayerIds, visibleLayerIdsByPlan]);

  const canvasPlan = useMemo(() => {
    return computeCanvasPlan({
      allItemsSelected,
      effectiveVisibleLayerIds,
      getObjectLayerIdsForVisibility,
      hideAllLayers,
      rackOverlayLinks,
      renderPlan
    });
  }, [allItemsSelected, effectiveVisibleLayerIds, getObjectLayerIdsForVisibility, hideAllLayers, rackOverlayLinks, renderPlan]);
  const securityLayerVisible = useMemo(
    () => !hideAllLayers && (allItemsSelected || effectiveVisibleLayerIds.includes(SECURITY_LAYER_ID)),
    [allItemsSelected, effectiveVisibleLayerIds, hideAllLayers]
  );
  const safetyEmergencyContacts = useMemo(
    () => computeSafetyEmergencyContacts({ client, planId, site }),
    [client, planId, site?.id]
  );
  const safetyEmergencyPoints = useMemo(() => {
    const objects = (((renderPlan as any)?.objects || []) as any[]).filter((obj) => String(obj?.type || '') === 'safety_assembly_point');
    return objects.map((obj) => ({
      id: String(obj?.id || ''),
      name: String(obj?.name || obj?.type || ''),
      gps: String((obj as any)?.gpsCoords || ''),
      coords: `${Math.round(Number(obj?.x || 0))}, ${Math.round(Number(obj?.y || 0))}`
    }));
  }, [renderPlan]);
  const safetyNumbersInline = useMemo(
    () => safetyEmergencyContacts.map((entry: any) => `| ${entry.name || '—'} ${entry.phone || '—'}`).join(' '),
    [safetyEmergencyContacts]
  );
  const safetyPointsInline = useMemo(
    () => safetyEmergencyPoints.map((point) => `| ${point.name || '—'}`).join(' '),
    [safetyEmergencyPoints]
  );
  const quoteLabels = useMemo(() => {
    const map: Record<string, string> = {};
    const objects = ((canvasPlan || renderPlan) as any)?.objects || [];
    for (const obj of objects) {
      if (!obj || obj.type !== 'quote') continue;
      const pts = obj.points || [];
      const label = formatQuoteLabel(pts);
      const name = String(obj.name || '').trim();
      const combined = name && label ? `${name} · ${label}` : name || label;
      if (combined) map[obj.id] = combined;
    }
    return map;
  }, [canvasPlan, formatQuoteLabel, renderPlan]);

  const getQuoteOrientation = useCallback((points?: { x: number; y: number }[]) => {
    if (!points || points.length < 2) return 'horizontal' as const;
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.abs(dy) > Math.abs(dx) ? ('vertical' as const) : ('horizontal' as const);
  }, []);

  const linksModalObjectName = useMemo(() => {
    if (!linksModalObjectId) return '';
    const obj = ((renderPlan as any)?.objects || []).find((o: any) => o.id === linksModalObjectId);
    return String(obj?.name || linksModalObjectId);
  }, [linksModalObjectId, renderPlan]);

  const linksModalRows = useMemo(
    () => computeLinksModalRows({ linksModalObjectId, renderPlan, objectTypeDefs, lang }),
    [lang, linksModalObjectId, objectTypeDefs, renderPlan]
  );

  const linkCreateHint = useMemo(
    () => computeLinkCreateHint({ linkFromId, isReadOnly, renderPlan, linkCreateMode, t }),
    [isReadOnly, linkCreateMode, linkFromId, renderPlan, t]
  );

  const rackPortsLinkItem = useMemo(() => {
    if (!rackPortsLink || !renderPlan) return null;
    return ((renderPlan as any).rackItems || []).find((item: RackItem) => item.id === rackPortsLink.itemId) || null;
  }, [rackPortsLink, renderPlan]);

  useEffect(() => {
    if (!rackPortsLink) return;
    if (!rackPortsLinkItem) setRackPortsLink(null);
  }, [rackPortsLink, rackPortsLinkItem]);

  const openRackLinkPorts = useCallback(
    (id: string) => {
      const link = rackOverlayById.get(id);
      if (!link) return;
      const targetItemId = link.rackFromItemId || link.rackToItemId;
      if (!targetItemId) return;
      setRackPortsLink({
        itemId: String(targetItemId),
        kind: link.rackKind as RackPortKind,
        openConnections: true
      });
    },
    [rackOverlayById]
  );

  const handleRackPortsRename = useCallback(
    (itemId: string, kind: RackPortKind, index: number, name: string) =>
      computeUpdateRackPortField(itemId, kind, index, name, 'names', { isReadOnly, planId, renderPlan, updateRackItem }),
    [isReadOnly, planId, renderPlan, updateRackItem]
  );

  const handleRackPortsNote = useCallback(
    (itemId: string, kind: RackPortKind, index: number, note: string) =>
      computeUpdateRackPortField(itemId, kind, index, note, 'notes', { isReadOnly, planId, renderPlan, updateRackItem }),
    [isReadOnly, planId, renderPlan, updateRackItem]
  );

  const latestRev = useMemo(() => {
    const latest = getLatestRevision(plan?.revisions as any[] | undefined);
    return getRevisionVersion(latest as any);
  }, [plan?.revisions]);

  const hasAnyRevision = !!(plan?.revisions || []).length;
  const baselineSnapshotRef = useRef<{
    imageUrl: string;
    width?: number;
    height?: number;
    scale?: any;
    objects: any[];
    views?: any[];
    rooms?: any[];
    corridors?: any[];
    racks?: any[];
    rackItems?: any[];
    rackLinks?: any[];
  } | null>(null);
  const entrySnapshotRef = useRef<{
    imageUrl: string;
    width?: number;
    height?: number;
    scale?: any;
    objects: any[];
    views?: any[];
    rooms?: any[];
    corridors?: any[];
    racks?: any[];
    rackItems?: any[];
    rackLinks?: any[];
  } | null>(null);
	  const touchedRef = useRef(false);
	  const [touchedTick, setTouchedTick] = useState(0);
	  const markTouched = useCallback(() => {
	    // Track "last action" for lock tooltips even after the plan is already marked as dirty.
	    if (lockMineRef.current) {
	      const now = Date.now();
	      if (now - lastPlanActionSentAtRef.current > 1500) {
	        lastPlanActionSentAtRef.current = now;
	        sendWs({ type: 'plan_action', planId: planIdRefForWs.current });
	      }
	    }
	    if (touchedRef.current) return;
	    touchedRef.current = true;
	    setTouchedTick((x) => x + 1);
	  }, []);
  const resetTouched = useCallback(() => {
    if (!touchedRef.current) return;
    touchedRef.current = false;
    setTouchedTick((x) => x + 1);
  }, []);
  const alignSelection = useCallback(
    (mode: 'horizontal' | 'vertical', referenceId?: string) =>
      computeAlignSelection(mode, referenceId, {
        getObjectBoundsForAlign,
        isReadOnly,
        isWallType,
        markTouched,
        moveObject,
        renderPlan,
        selectedObjects,
        updateObject
      }),
    [getObjectBoundsForAlign, isReadOnly, isWallType, markTouched, moveObject, renderPlan, selectedObjects, updateObject]
  );

  const snapshotCacheRef = useRef<WeakMap<object, PlanSnapshot>>(new WeakMap());
  const latestRevisionCacheRef = useRef<WeakMap<object, any>>(new WeakMap());
  const revisionSnapshotCacheRef = useRef<WeakMap<object, PlanSnapshotComparable>>(new WeakMap());
  const unsavedAgainstLatestCacheRef = useRef<WeakMap<object, WeakMap<object, boolean>>>(new WeakMap());
  const getPlanSnapshot = useCallback((p: any): PlanSnapshot => {
    if (p && typeof p === 'object') {
      const cached = snapshotCacheRef.current.get(p as object);
      if (cached) return cached;
      const snap = toPlanSnapshot(p);
      snapshotCacheRef.current.set(p as object, snap);
      return snap;
    }
    return toPlanSnapshot(p);
  }, []);
  const getLatestRevisionCached = useCallback((revisions: any[] | undefined | null) => {
    if (!Array.isArray(revisions)) return null;
    const key = revisions as unknown as object;
    const cached = latestRevisionCacheRef.current.get(key);
    if (cached !== undefined) return cached;
    const latest = getLatestRevision(revisions as any[]);
    latestRevisionCacheRef.current.set(key, latest || null);
    return latest;
  }, []);
  const getRevisionSnapshotCached = useCallback((revision: any): PlanSnapshotComparable => {
    if (revision && typeof revision === 'object') {
      const key = revision as object;
      const cached = revisionSnapshotCacheRef.current.get(key);
      if (cached) return cached;
      const snap = toRevisionSnapshot(revision);
      revisionSnapshotCacheRef.current.set(key, snap);
      return snap;
    }
    return toRevisionSnapshot(revision);
  }, []);

  type HistorySnapshot = PlanHistorySnapshot;
  type HistoryEntry = { snap: HistorySnapshot; key: string };

  const [historyTick, setHistoryTick] = useState(0);
  const historySnapshotRef = useRef<HistorySnapshot | null>(null);
  const historyKeyRef = useRef('');
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const historyLockRef = useRef(false);

  const toHistorySnapshot = useCallback(
    (p: any): HistorySnapshot => toPlanHistorySnapshot(p, getPlanSnapshot(p)),
    [getPlanSnapshot]
  );

  const resetHistory = useCallback(() => {
    historySnapshotRef.current = null;
    historyKeyRef.current = '';
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryTick((x) => x + 1);
  }, []);

  useEffect(() => {
    snapshotCacheRef.current = new WeakMap();
    latestRevisionCacheRef.current = new WeakMap();
    revisionSnapshotCacheRef.current = new WeakMap();
    unsavedAgainstLatestCacheRef.current = new WeakMap();
    baselineSnapshotRef.current = null;
    entrySnapshotRef.current = null;
    touchedRef.current = false;
    setTouchedTick((x) => x + 1);
    resetHistory();
  }, [planId]);

  useEffect(() => {
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) {
      baselineSnapshotRef.current = null;
      return;
    }
    const snap = getPlanSnapshot(plan);
    // Keep baseline aligned with background normalizations until the user edits.
    if (!baselineSnapshotRef.current || !touchedRef.current) baselineSnapshotRef.current = snap;
  }, [plan, getPlanSnapshot]);

  const samePlanSnapshot = useCallback(
    (current: PlanSnapshotComparable, latest: PlanSnapshotComparable, options?: { ignoreDims?: boolean }) =>
      samePlanSnapshotUtil(current, latest, options),
    []
  );

  const samePlanSnapshotIgnoringDims = useCallback(
    (a: PlanSnapshotComparable, b: PlanSnapshotComparable) => samePlanSnapshot(a, b, { ignoreDims: true }),
    [samePlanSnapshot]
  );

  const applyHistorySnapshot = useCallback(
    (entry: HistoryEntry) => {
      runApplyHistorySnapshot(entry, {
        planId,
        historyLockRef,
        historySnapshotRef,
        historyKeyRef,
        setFloorPlanContent,
        markTouched,
        setHistoryTick
      });
    },
    [markTouched, planId, setFloorPlanContent]
  );

  const performUndo = useCallback(() => {
    const current = historySnapshotRef.current;
    const prev = undoStackRef.current.pop();
    if (!prev || !current) return false;
    redoStackRef.current.push({ snap: current, key: historyKeyRef.current });
    applyHistorySnapshot(prev);
    return true;
  }, [applyHistorySnapshot]);

  const performRedo = useCallback(() => {
    const current = historySnapshotRef.current;
    const next = redoStackRef.current.pop();
    if (!next || !current) return false;
    undoStackRef.current.push({ snap: current, key: historyKeyRef.current });
    applyHistorySnapshot(next);
    return true;
  }, [applyHistorySnapshot]);

  useEffect(() => runHistoryTrackEffect({
    plan, toHistorySnapshot, historyKeyRef, historySnapshotRef, historyLockRef, undoStackRef, redoStackRef, setHistoryTick
  }), [plan, toHistorySnapshot]);

  // Track plan state when the user enters it. Used for the navigation prompt.
  useEffect(() => {
    if (!plan) return;
    const snap = getPlanSnapshot(plan);
    if (!entrySnapshotRef.current || !touchedRef.current) entrySnapshotRef.current = snap;
  }, [plan, getPlanSnapshot]);

  const getPlanUnsavedChanges = useCallback(
    (targetPlan?: FloorPlan | null) =>
      computeGetPlanUnsavedChanges(targetPlan, {
        getPlanSnapshot,
        baselineSnapshotRef,
        getLatestRevisionCached,
        getRevisionSnapshotCached,
        unsavedAgainstLatestCacheRef,
        samePlanSnapshot
      }),
    [getLatestRevisionCached, getPlanSnapshot, getRevisionSnapshotCached, samePlanSnapshot]
  );

  const { canUndo, canRedo } = useMemo(
    () => ({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0
    }),
    [historyTick]
  );

  const hasLocalEdits = useMemo(() => {
    if (!plan) return false;
    const entry = entrySnapshotRef.current;
    if (!entry) return false;
    return !samePlanSnapshotIgnoringDims(entry, getPlanSnapshot(plan));
  }, [plan, samePlanSnapshotIgnoringDims, getPlanSnapshot]);

  const hasNavigationEdits = useMemo(
    () => touchedRef.current && hasLocalEdits,
    // touchedRef is a ref; touchedTick is used to re-evaluate when touched changes.
    [hasLocalEdits, touchedTick]
  );
  // UI "Unsaved" badge should reflect user edits only, not legacy normalization differences in old revisions.
  const hasUnsavedUi = hasNavigationEdits;

  useEffect(() => {
    // If the only change is an automatic width/height fill (e.g. measured from image), do not treat it as
    // a "revision-worthy" unsaved change when the plan has no revision history yet.
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) return;
    const base = baselineSnapshotRef.current;
    if (!base) return;
    const current = getPlanSnapshot(plan);
    if (samePlanSnapshot(current, base)) return;

    const baseDimsMissing = (base.width ?? null) === null && (base.height ?? null) === null;
    const currentHasDims = typeof current.width === 'number' || typeof current.height === 'number';
    if (!baseDimsMissing || !currentHasDims) return;
    if (!samePlanSnapshotIgnoringDims(base, current)) return;

    baselineSnapshotRef.current = current;
  }, [plan, samePlanSnapshotIgnoringDims, getPlanSnapshot]);

  const pendingNavigateRef = useRef<string | null>(null);

  const enterFullscreenFromGesture = useCallback(() => {
    try {
      const doc: any = document as any;
      const root: any = document.documentElement as any;
      if (!!doc.fullscreenElement) return;
      const p = root?.requestFullscreen?.();
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          // ignore: fullscreen may be blocked or already active
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const requestEnterPresentation = useCallback(() => {
    if (presentationMode) return;
    enterFullscreenFromGesture();
    togglePresentationMode?.();
  }, [enterFullscreenFromGesture, presentationMode, togglePresentationMode]);

  const handleTogglePresentation = useCallback(() => {
    if (presentationMode) {
      togglePresentationMode?.();
      return;
    }
    requestEnterPresentation();
  }, [presentationMode, requestEnterPresentation, togglePresentationMode]);

  useEffect(() => {
    if (!presentationEnterRequested) return;
    clearPresentationEnterRequest?.();
    if (presentationMode) return;
    requestEnterPresentation();
  }, [clearPresentationEnterRequest, presentationEnterRequested, presentationMode, requestEnterPresentation]);

  usePlanDeeplinkEffects({
    location,
    navigate,
    planId,
    isReadOnly,
    push,
    t,
    setSelectedObject,
    triggerHighlight,
    clearSelection,
    setSelectedRoomId,
    setSelectedRoomIds,
    setHighlightRoom,
    setRevisionsOpen,
    setPrintAreaMode,
    setRoomAllocationPreset,
    setRoomAllocationOpen
  });

		  useEffect(() => {
		    if (!printAreaMode) return;
		    const onKey = (e: KeyboardEvent) => {
		      if ((useUIStore.getState() as any)?.clientChatOpen) return;
		      if (e.key === 'Escape') {
		        e.preventDefault();
		        setPrintAreaMode(false);
		        push(t({ it: 'Impostazione area di stampa annullata', en: 'Print area selection cancelled' }), 'info');
		      }
		    };
		    window.addEventListener('keydown', onKey);
		    return () => window.removeEventListener('keydown', onKey);
		  }, [printAreaMode, push, t]);

  const revertUnsavedChanges = useCallback(() => {
    runRevertUnsavedChanges({ plan, getLatestRevisionCached, restoreRevision, baselineSnapshotRef, setFloorPlanContent });
  }, [getLatestRevisionCached, plan, restoreRevision, setFloorPlanContent]);

  const forceSaveNow = useCallback(async () => {
    return runForceSaveNow({ plan, planId, useDataStoreGetState: useDataStore.getState, savePlanState });
  }, [plan?.id, planId]);

  const saveRevisionForUnlock = useCallback(async () => {
    return runSaveRevisionForUnlock({
      plan,
      hasNavigationEdits,
      hasAnyRevision,
      latestRev,
      addRevision,
      push,
      t,
      postAuditEvent,
      resetTouched,
      entrySnapshotRef,
      getPlanSnapshot,
      planRef,
      forceSaveNow
    });
  }, [addRevision, forceSaveNow, hasAnyRevision, hasNavigationEdits, latestRev.major, latestRev.minor, plan, postAuditEvent, push, resetTouched, t, getPlanSnapshot]);

	  const handleUnlockResponse = useCallback(
	    async (action: 'grant' | 'grant_save' | 'grant_discard' | 'deny') =>
	      computeHandleUnlockResponse(action, {
	        LOCK_TOAST_MS,
	        hasNavigationEdits,
	        plan,
	        push,
	        pushStack,
	        resetTouched,
	        revertUnsavedChanges,
	        saveRevisionForUnlock,
	        sendWs,
	        t,
	        getPlanSnapshot,
	        unlockBusy,
	        unlockPrompt,
	        entrySnapshotRef,
	        planRef,
	        setUnlockBusy,
	        setUnlockPrompt
	      }),
    [
      LOCK_TOAST_MS,
      hasNavigationEdits,
      plan,
      push,
      pushStack,
      resetTouched,
      revertUnsavedChanges,
      saveRevisionForUnlock,
      sendWs,
      t,
      getPlanSnapshot,
      unlockBusy,
      unlockPrompt
    ]
  );

  const toggleRevisionImmutable = useCallback(
    (revisionId: string, nextValue: boolean) => {
      runToggleRevisionImmutable(revisionId, nextValue, { isSuperAdmin, user, updateRevision, planId, postAuditEvent, push, t });
    },
    [isSuperAdmin, planId, postAuditEvent, push, t, updateRevision, user?.id, user?.username]
  );

	  const openUnlockCompose = useCallback(
	    (userEntry: PresenceUser) => {
	      if (!userEntry?.userId) return;
	      if (userEntry.userId === user?.id) return;
	      const lockList: UnlockRequestLock[] =
	        Array.isArray((userEntry as any).locks) && (userEntry as any).locks.length
	          ? (userEntry as any).locks
	          : (userEntry as any).lock
	            ? [(userEntry as any).lock]
	            : [];
	      if (!lockList.length) return;
	      setUnlockCompose({ target: userEntry, locks: lockList });
	    },
	    [user?.id]
	  );

		  const executeForceUnlock = useCallback(
		    async (requestId: string, action: 'save' | 'discard') => {
		      let ok = true;
	      if (action === 'save') {
	        ok = await saveRevisionForUnlock();
	      } else if (action === 'discard') {
	        if (hasNavigationEdits) {
	          revertUnsavedChanges();
	          resetTouched();
	          entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
	        }
	      }
	      // Release lock (best-effort); the server will also enforce the deadline.
	      sendWs({ type: 'release_lock', planId });
	      sendWs({ type: 'force_unlock_done', requestId, action, ok });
	      setForceUnlockIncoming(null);
	      return ok;
	    },
	    [hasNavigationEdits, plan, planId, resetTouched, revertUnsavedChanges, saveRevisionForUnlock, sendWs, getPlanSnapshot]
	  );

	  useEffect(() => {
	    if (!forceUnlockExecuteCommand) return;
	    const cmd = forceUnlockExecuteCommand;
	    setForceUnlockExecuteCommand(null);
	    void executeForceUnlock(cmd.requestId, cmd.action);
	  }, [executeForceUnlock, forceUnlockExecuteCommand]);

	  useEffect(() => runUnlockRequestEffect({ user, setUnlockCompose }), [user?.id]);

	  useEffect(() => runForceUnlockEventEffect({ isSuperAdmin, setForceUnlockGraceMinutes, setForceUnlockStarting, setForceUnlockConfig }),
	    [isSuperAdmin]);

	  useEffect(() => {
	    setPlanDirty?.(planId, !!hasNavigationEdits);
	    return () => {
	      setPlanDirty?.(planId, false);
	    };
	  }, [hasNavigationEdits, planId, setPlanDirty]);

	  useEffect(() => {
	    if (!lockRequired) return;
	    if (!lockState.mine) return;
	    const dirty = !!hasNavigationEdits;
	    const now = Date.now();
	    if (lastPlanDirtyValueRef.current === dirty && now - lastPlanDirtySentAtRef.current < 1500) return;
	    if (now - lastPlanDirtySentAtRef.current < 900) return;
	    lastPlanDirtyValueRef.current = dirty;
	    lastPlanDirtySentAtRef.current = now;
	    sendWs({ type: 'plan_dirty', planId, dirty });
	  }, [hasNavigationEdits, lockRequired, lockState.mine, planId, sendWs]);

  useEffect(() => {
    if (!pendingSaveNavigateTo) return;
    if (isReadOnly) {
      navigate(pendingSaveNavigateTo);
      clearPendingSaveNavigate?.();
      return;
    }
    if (!hasNavigationEdits) {
      navigate(pendingSaveNavigateTo);
      clearPendingSaveNavigate?.();
      return;
    }
    pendingNavigateRef.current = pendingSaveNavigateTo;
    setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
    setSaveRevisionOpen(true);
  }, [clearPendingSaveNavigate, hasNavigationEdits, isReadOnly, navigate, pendingSaveNavigateTo]);

  const performPendingPostSaveAction = useCallback(
    async (action: { type: 'language'; value: 'it' | 'en' } | { type: 'logout' }) => {
      await runPerformPendingPostSaveAction(action, { logout, navigate });
    },
    [logout, navigate]
  );

  useEffect(() => {
    if (!pendingPostSaveAction) return;
    if (isReadOnly || !hasNavigationEdits) {
      clearPendingPostSaveAction();
      void performPendingPostSaveAction(pendingPostSaveAction);
      return;
    }
    if (!saveRevisionOpen) {
      setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
      setSaveRevisionOpen(true);
    }
  }, [clearPendingPostSaveAction, hasNavigationEdits, isReadOnly, pendingPostSaveAction, performPendingPostSaveAction, saveRevisionOpen]);

  const saveRevisionReason = useMemo(() => {
    return computeSaveRevisionReason({
      pendingClientMeetingsPreset,
      pendingMeetingManagerPreset,
      pendingPostSaveAction,
      pendingNavigateRef
    });
  }, [pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingPostSaveAction]);
  const {
    contextObject,
    contextObjectTypeLabel,
    realUserDetails,
    realUserDetailsName,
    contextLink,
    contextObjectLinkCount,
    hasDefaultView,
    contextIsMulti,
    contextIsRack,
    contextIsDesk,
    contextIsCamera,
    contextIsWall,
    contextIsQuote,
    contextIsWifi,
    contextIsPhoto,
    contextIsText,
    contextIsAssemblyPoint,
    contextAssemblyMapsUrl,
    contextPhotoMulti,
    planPhotoIds,
    contextWifiRangeOn,
    contextWifiRangeScale,
    contextWifiBaseRadiusM,
    contextWifiBaseDiameterM,
    contextWifiBaseAreaSqm,
    contextWifiEffectiveRadiusM,
    contextWifiEffectiveDiameterM,
    contextWifiEffectiveAreaSqm,
    contextWallPolygon,
    contextQuoteOrientation,
    contextQuoteLabelPos,
    roomModalInitialSurfaceSqm,
    roomWallTypeAllValue,
    canEditWallType,
    selectionHasRack,
    selectionHasDesk,
    selectionHasPhoto,
    selectionPhotoIds,
    selectedWifiIds,
    selectionAllRealUsers
  } = usePlanContextDerived({
    renderPlan,
    contextMenu,
    renderPlanObjectById,
    objectTypeLabels,
    realUserDetailsId,
    selectedObjectIds,
    selectedObjects,
    isDeskType,
    isWallType,
    getWallPolygonData,
    getQuoteOrientation,
    lastQuoteLabelPosV,
    lastQuoteLabelPosH,
    roomModal,
    computeRoomSurfaceSqm,
    metersPerPixel,
    roomWallTypeSelections,
    defaultWallTypeId
  });

  usePlanSelectionMenuEffects({
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
  });

  const getSubmenuStyle = useCallback(
    (submenuWidth: number) => computeSubmenuStyle(submenuWidth, { contextMenu, contextMenuRef }),
    [contextMenu]
  );

  useLayoutEffect(() => {
    if (!contextMenu) return;
    const el = contextMenuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const bounds = mapRef.current?.getBoundingClientRect();
    const margin = 8;
    const minX = bounds ? bounds.left + margin : margin;
    const minY = bounds ? bounds.top + margin : margin;
    const maxX = (bounds ? bounds.right : window.innerWidth) - rect.width - margin;
    const maxY = (bounds ? bounds.bottom : window.innerHeight) - rect.height - margin;
    const nextX = Math.min(Math.max(contextMenu.x, minX), Math.max(minX, maxX));
    const nextY = Math.min(Math.max(contextMenu.y, minY), Math.max(minY, maxY));
    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
    }
  }, [contextMenu, mapRef]);

  useEffect(() => {
    setSelectedPlan(planId);
  }, [planId, setSelectedPlan]);

  useLayoutEffect(() => runViewportInitEffect({
    renderPlan, planId, selectedRevisionId, location, viewportInitRef, forceDefaultView, selectedViewId,
    setAutoFitEnabled, setZoom, setPan, saveViewport, setSelectedViewId, loadViewport
  }), [forceDefaultView, loadViewport, location.key, planId, renderPlan, saveViewport, selectedRevisionId, setPan, setZoom]);

  useEffect(() => runViewportAutoCenterEffect({
    renderPlan, planId, selectedRevisionId, autoCenterRef, mapRef, canvasStageRef, zoom, pan
  }), [pan?.x, pan?.y, planId, renderPlan, renderPlan?.height, renderPlan?.width, selectedRevisionId, zoom]);

  useEffect(() => runViewportPresentationEffect({
    canvasStageRef, presentationMode, presentationViewportRef, zoom, pan, autoFitEnabled,
    setAutoFitEnabled, setZoom, setPan, saveViewport, planId
  }), [planId, presentationMode, saveViewport, setAutoFitEnabled, setPan, setZoom]);

  useEffect(() => {
    // entering/leaving read-only mode clears pending placement and context menu
    setPendingType(null);
    setContextMenu(null);
    setWallQuickMenu(null);
    setWallTypeMenu(null);
    setCorridorQuickMenu(null);
    setCorridorDoorDraft(null);
    clearSelection();
    setSelectedRoomId(undefined);
    setSelectedRoomIds([]);
    setSelectedCorridorId(undefined);
    setSelectedCorridorDoor(null);
    setSelectedRoomDoorId(null);
    setSelectedLinkId(null);
    setRoomDoorDraft(null);
    setLinkFromId(null);
  }, [isReadOnly]);

  useEffect(() => {
    // If the user selects an object to place while drawing an area, cancel creation mode.
    if (!roomDrawMode && !corridorDrawMode) return;
    if (!pendingType) return;
    setRoomDrawMode(null);
    setCorridorDrawMode(null);
    setNewRoomMenuOpen(false);
  }, [corridorDrawMode, pendingType, roomDrawMode]);

  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!plan) return;
    if (!Number.isFinite(zoom) || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveViewport(plan.id, zoom, pan);
    }, 220);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [plan, zoom, pan, saveViewport]);

	  const handleStageSelect = useCallback(
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
        setSelectedCorridorId,
	      setSelectedObject,
	      t,
	      toggleSelectedObject
	    ]
	  );



  const { handleCorridorDoorDraftPoint, createRoomDoorFromDraft, startRoomDoorDraft } = usePlanRoomDoorDraftHandlers({
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
  });

  const toggleMapSubmenu = useCallback((section: typeof mapSubmenu) => {
    setMapSubmenu((prev) => (prev === section ? null : section));
  }, []);


  const { openMeetingManager, dispatchOpenClientMeetingsTimeline, openSchedulingFromHub } = usePlanMeetingOpenHandlers({
    client,
    site,
    planId,
    hasNavigationEdits,
    isReadOnly,
    canManageMeetingScheduling,
    push,
    t,
    setPendingMeetingManagerPreset,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen,
    setMeetingManagerPreset,
    setMeetingManagerOpen,
    setPendingClientMeetingsPreset
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      openMeetingManager({
        clientId: String(detail?.clientId || '').trim() || undefined,
        siteId: String(detail?.siteId || '').trim() || undefined,
        floorPlanId: String(detail?.floorPlanId || '').trim() || undefined,
        roomId: String(detail?.roomId || '').trim() || undefined,
        day: String(detail?.day || '').trim() || undefined
      });
    };
    window.addEventListener(OPEN_MEETING_MANAGER_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_MEETING_MANAGER_EVENT, handler as EventListener);
  }, [openMeetingManager]);

  const reloadMyMeetings = useCallback(async () => {
    await computeReloadMyMeetings({ t, setMyMeetingsModal });
  }, [t]);
  reloadMyMeetingsRef.current = reloadMyMeetings;

  const openMyMeetingsModal = useCallback((opts?: { returnToHub?: boolean; restore?: MyMeetingsModalState | null }) => {
    runOpenMyMeetingsModal(opts, { setMyMeetingsSearch, setMyMeetingsModal, reloadMyMeetings });
  }, [reloadMyMeetings]);

  const openMyMeetingsFromHub = useCallback(() => {
    openMyMeetingsModal({ returnToHub: true });
  }, [openMyMeetingsModal]);

  useEffect(() => {
    const onOpenMeetingCenter = () => {
      setMyMeetingsModal(null);
      setMeetingHubModalOpen(true);
    };
    window.addEventListener(OPEN_MEETING_CENTER_EVENT, onOpenMeetingCenter as EventListener);
    return () => window.removeEventListener(OPEN_MEETING_CENTER_EVENT, onOpenMeetingCenter as EventListener);
  }, []);

  useEffect(() => {
    const onOpenMyMeetings = () => {
      const restore = myMeetingsRestoreRef.current;
      myMeetingsRestoreRef.current = null;
      openMyMeetingsModal({ returnToHub: false, restore });
    };
    window.addEventListener(OPEN_MY_MEETINGS_EVENT, onOpenMyMeetings as EventListener);
    return () => window.removeEventListener(OPEN_MY_MEETINGS_EVENT, onOpenMyMeetings as EventListener);
  }, [openMyMeetingsModal]);

  const closeMyMeetingsModal = useCallback(() => {
    const shouldReturnToHub = !!myMeetingsModal?.returnToHub;
    setMyMeetingsModal(null);
    if (shouldReturnToHub) {
      setMeetingHubModalOpen(true);
    }
  }, [myMeetingsModal?.returnToHub]);

  const {
    handleWallQuickMenu,
    handleCorridorQuickMenu,
    handleObjectContextMenu,
    handleLinkContextMenu,
    handleSafetyCardContextMenu,
    handleRoomContextMenu,
    handleCorridorContextMenu,
    handleCorridorConnectionContextMenu,
    handleCorridorDoorContextMenu,
    handleRoomDoorContextMenu,
    handleScaleContextMenu
  } = usePlanContextMenuHandlers({
    dismissSelectionHintToasts,
    setContextMenu,
    roomDoorDraft,
    createRoomDoorFromDraft,
    planScale,
    isRackLinkId,
    isReadOnlyRef,
    selectedObjectIdsRef,
    corridorDoorDraft,
    setWallQuickMenu,
    setWallTypeMenu,
    setCorridorQuickMenu
  });

  const { handleScaleDoubleClick, handleScaleMove, updateScaleStyle, openScaleEdit } = usePlanScaleHandlers({
    plan,
    isReadOnly,
    planScale,
    markTouched,
    updateFloorPlan,
    setContextMenu,
    setScaleActionsOpen,
    setScaleMode,
    setScaleDraft,
    setScaleDraftPointer,
    setScaleModal,
    setScaleMetersInput,
    formatNumber
  });

  const updateQuoteLabelPos = useCallback(
    (id: string, pos: 'center' | 'above' | 'below' | 'left' | 'right', orientation?: 'horizontal' | 'vertical') =>
      computeUpdateQuoteLabelPos(id, pos, orientation, {
        getQuoteOrientation,
        renderPlan,
        updateObject,
        setLastQuoteLabelPosH,
        setLastQuoteLabelPosV
      }),
    [getQuoteOrientation, renderPlan, setLastQuoteLabelPosH, setLastQuoteLabelPosV, updateObject]
  );

  const handleMapContextMenu = useCallback(
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
      zoom
    ]
  );


  const { openEscapeRouteAt, toggleSecurityCardVisibility } = usePlanSecurityHandlers({
    contextMenu,
    plan,
    planId,
    push,
    renderPlan,
    siteFloorPlansLength: siteFloorPlans.length,
    t,
    hideAllLayers,
    allItemsSelected,
    nonAllLayerIds,
    visibleLayerIds,
    normalizeLayerSelection,
    setEscapeRouteModal,
    setContextMenu,
    setHideAllLayers,
    setVisibleLayerIds
  });

  const { applyView, handleSaveView, handleOverwriteView, goToDefaultView } = usePlanViewHandlers({
    renderPlan,
    plan,
    isReadOnly,
    zoom,
    pan,
    saveViewport,
    addView,
    updateView,
    push,
    t,
    setAutoFitEnabled,
    setZoom,
    setPan,
    setSelectedViewId,
    setViewsMenuOpen
  });

  const openDuplicate = (objectId: string) => {
    runOpenDuplicate(objectId, {
      renderPlan,
      isReadOnly,
      isDeskType,
      markTouched,
      getTypeLabel,
      inferDefaultLayerIds,
      layerIdSet,
      addObject,
      ensureObjectLayerVisible,
      lastInsertedRef,
      getRoomIdAt,
      updateObject,
      push,
      t,
      postAuditEvent,
      setModalState
    });
  };

  useEffect(() => runSearchExportShortcutEffect({ searchInputRef, setExportModalOpen }), []);

  const resolveRoomAssignmentForObject = useCallback(
    (roomId: string | undefined | null, objectType: unknown, roomList?: Room[]) =>
      computeResolveRoomAssignmentForObject(roomId, objectType, roomList, renderPlan?.rooms),
    [renderPlan?.rooms]
  );

  function getCorridorIdAt(corridors: any[] | undefined, x: number, y: number) {
    const list = corridors || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const corridor = list[i];
      if (isPointInRoom(corridor, x, y)) return corridor.id as string;
    }
    return undefined;
  }

  const { copySelection, requestPaste, pasteConfirm, confirmPaste, cancelPaste } = useClipboard({
    t,
    client,
    planId,
    planRef,
    isReadOnlyRef,
    inferDefaultLayerIds,
    layerIdSet,
    addObject,
    updateObject,
    ensureObjectLayerVisible,
    getRoomIdAt,
    saveCustomValues,
    loadCustomValues,
    markTouched,
    push,
    pushStack,
    getTypeLabel,
    setSelection,
    setContextMenu,
    lastInsertedRef,
    triggerHighlight,
    getPastePoint
  });

  const getCorridorPolygon = useCallback((corridor: any) => computeGetCorridorPolygon(corridor), []);

  const getClosestCorridorEdge = useCallback(
    (corridor: Corridor, point: { x: number; y: number }) => computeGetClosestCorridorEdge(corridor, point, getCorridorPolygon),
    [getCorridorPolygon]
  );
  const getCorridorEdgePoint = useCallback(
    (corridor: Corridor, edgeIndex: number, t: number) => computeGetCorridorEdgePoint(corridor, edgeIndex, t, getCorridorPolygon),
    [getCorridorPolygon]
  );

  const roomMeasuresData = useMemo(() => {
    return computeRoomMeasuresData({
      computePolygonArea,
      computePolylineLength,
      formatCornerLabel,
      formatNumber,
      lang,
      metersPerPixel,
      renderPlan,
      renderPlanRoomById,
      roomMeasuresModal
    });
  }, [
    computePolygonArea,
    computePolylineLength,
    formatCornerLabel,
    formatNumber,
    getRoomPolygon,
    lang,
    metersPerPixel,
    renderPlan,
    renderPlanRoomById,
    roomMeasuresModal
  ]);

  const roomLayoutExportRows = useMemo(
    () => computeRoomLayoutExportRows({ allClients, roomLayoutExportModal }),
    [allClients, roomLayoutExportModal]
  );

  const roomLayoutExportSource = useMemo(
    () => roomLayoutExportRows.find((row) => row.isSource) || null,
    [roomLayoutExportRows]
  );

  const applyRoomLayoutExportToSelection = useCallback(() => {
    runApplyRoomLayoutExportToSelection({
      roomLayoutExportModal,
      roomLayoutExportSource,
      roomLayoutExportRows,
      push,
      t,
      updateRoom,
      planId,
      markTouched,
      setPlanDirty,
      setRoomLayoutExportModal
    });
  }, [markTouched, planId, push, roomLayoutExportModal, roomLayoutExportRows, roomLayoutExportSource, setPlanDirty, t, updateRoom]);

  const closeRoomLayoutExportModal = useCallback(() => {
    setRoomLayoutExportModal(null);
  }, []);

  const selectAllRoomLayoutExportRows = useCallback(() => {
    setRoomLayoutExportModal((prev) =>
      !prev
        ? prev
        : {
            ...prev,
            selectedKeys: roomLayoutExportRows.filter((row) => !row.isSource).map((row) => row.key)
          }
    );
  }, [roomLayoutExportRows]);

  const clearRoomLayoutExportSelection = useCallback(() => {
    setRoomLayoutExportModal((prev) => (prev ? { ...prev, selectedKeys: [] } : prev));
  }, []);

  const toggleAllRoomLayoutExportRows = useCallback(
    (checked: boolean) => {
      setRoomLayoutExportModal((prev) =>
        !prev
          ? prev
          : {
              ...prev,
              selectedKeys: checked ? roomLayoutExportRows.filter((row) => !row.isSource).map((row) => row.key) : []
            }
      );
    },
    [roomLayoutExportRows]
  );

  const toggleRoomLayoutExportRow = useCallback((key: string, checked: boolean) => {
    setRoomLayoutExportModal((prev) => {
      if (!prev) return prev;
      const selected = new Set(prev.selectedKeys || []);
      if (checked) selected.add(key);
      else selected.delete(key);
      return { ...prev, selectedKeys: Array.from(selected) };
    });
  }, []);

  const sortRoomLayoutExportRows = useCallback((key: RoomLayoutExportModalSortKey) => {
    setRoomLayoutExportModal((prev) =>
      !prev
        ? prev
        : {
            ...prev,
            sortKey: key,
            sortDir: prev.sortKey === key && prev.sortDir === 'asc' ? 'desc' : 'asc'
          }
    );
  }, []);

  const { roomModalMetrics, roomModalPreview, roomHasWalls, roomWallPreview } = usePlanRoomModalDerived({
    computePolygonArea, computePolylineLength, formatCornerLabel, formatNumber, lang, metersPerPixel,
    renderPlan, roomModal, renderPlanRoomById, getRoomPolygon, buildRoomPreview, isWallType, roomWallTypeModal
  });

  const hasRoomOverlap = useCallback(
    (nextRoom: any, excludeId?: string) => {
      const nextPoly = getRoomPolygon(nextRoom);
      if (!nextPoly.length) return false;
      const list = ((plan as FloorPlan)?.rooms || []).filter((r) => r.id !== excludeId);
      for (const other of list) {
        const otherPoly = getRoomPolygon(other);
        if (!otherPoly.length) continue;
        if (polygonsOverlap(nextPoly, otherPoly)) return true;
      }
      return false;
    },
    [plan]
  );

  const notifyRoomOverlap = useCallback(() => {
    const now = Date.now();
    if (now - roomOverlapNoticeRef.current < 1200) return;
    roomOverlapNoticeRef.current = now;
    const message = t({ it: 'Attenzione: non è possibile sovrapporre due stanze.', en: 'Warning: rooms cannot overlap.' });
    setOverlapNotice(message);
  }, [t]);

  const notifyNonPeopleRoomBlocked = useCallback(() => {
    const now = Date.now();
    if (now - nonPeopleRoomNoticeRef.current < 1200) return;
    nonPeopleRoomNoticeRef.current = now;
    push(
      t({
        it: 'Questa stanza non è occupabile (ripostiglio/bagno/locale tecnico): spostamento utente non consentito.',
        en: 'This room is non-occupiable (storage/bathroom/technical): user placement is not allowed.'
      }),
      'info'
    );
  }, [push, t]);

  const resetToolClickHistory = useCallback(() => {
    toolClickHistoryRef.current = [];
  }, []);

  const dismissScaleToast = useCallback(() => {
    if (scaleToastIdRef.current == null) return;
    toast.dismiss(scaleToastIdRef.current);
    scaleToastIdRef.current = null;
  }, []);

  const dismissMeasureToast = useCallback(() => {
    if (measureToastIdRef.current == null) return;
    toast.dismiss(measureToastIdRef.current);
    measureToastIdRef.current = null;
  }, []);

  const formatMeasureLengthLabel = useCallback(
    (lengthPx: number) => {
      if (metersPerPixel) {
        const unit = lang === 'it' ? 'ml' : 'm';
        return `${formatNumber(lengthPx * metersPerPixel)} ${unit}`;
      }
      return `${formatNumber(lengthPx)} px`;
    },
    [formatNumber, lang, metersPerPixel]
  );

  const showMeasureToast = useCallback(
    (points: { x: number; y: number }[], options?: { closed?: boolean; finished?: boolean }) => {
      const closed = !!options?.closed;
      const finished = !!options?.finished;
      let totalPx = computePolylineLength(points);
      if (closed && points.length > 2) {
        const first = points[0];
        const last = points[points.length - 1];
        totalPx += Math.hypot(first.x - last.x, first.y - last.y);
      }
      const sideCount = Math.max(0, points.length - 1) + (closed && points.length > 2 ? 1 : 0);
      const totalLabel = formatMeasureLengthLabel(totalPx);
      const message =
        lang === 'it' ? (
          <span>
            Misurazione attiva: default orizz./vert., <strong>Shift</strong> linea libera, <strong>Backspace</strong> annulla ultimo punto,{' '}
            <strong>Invio</strong> termina, <strong>Q</strong> converte in quote.
            <br />
            <strong>
              Lati: {sideCount} | Totale: {totalLabel}
            </strong>
            {finished ? (
              <>
                <br />
                Misurazione conclusa. Premi <strong>Q</strong> per convertirla in quote.
              </>
            ) : null}
          </span>
        ) : (
          <span>
            Measurement active: default horizontal/vertical, <strong>Shift</strong> free line, <strong>Backspace</strong> removes last point,{' '}
            <strong>Enter</strong> finishes, <strong>Q</strong> converts to quotes.
            <br />
            <strong>
              Sides: {sideCount} | Total: {totalLabel}
            </strong>
            {finished ? (
              <>
                <br />
                Measurement finished. Press <strong>Q</strong> to convert it into quotes.
              </>
            ) : null}
          </span>
        );
      const toastId = toast.info(message, { duration: Infinity, id: measureToastIdRef.current || undefined });
      measureToastIdRef.current = toastId;
    },
    [computePolylineLength, formatMeasureLengthLabel, lang]
  );

  const computeRoomReassignments = (rooms: any[] | undefined, objects: any[]) => {
    const updates: Record<string, string | undefined> = {};
    for (const obj of objects) {
      const rawRoomId = getRoomIdAt(rooms, obj.x, obj.y);
      const nextRoomId = resolveRoomAssignmentForObject(rawRoomId, obj.type, (rooms || []) as Room[]);
      const current = obj.roomId ?? undefined;
      if (current !== nextRoomId) {
        updates[obj.id] = nextRoomId;
      }
    }
    return updates;
  };

  const resolveAxisLockedPoint = useCallback(
    (point: { x: number; y: number }, anchor: { x: number; y: number } | null, options?: { shiftKey?: boolean }) => {
      if (!anchor) return point;
      if (options?.shiftKey) return point;
      const dx = point.x - anchor.x;
      const dy = point.y - anchor.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        return { x: point.x, y: anchor.y };
      }
      return { x: anchor.x, y: point.y };
    },
    []
  );

  const { startScaleMode, cancelScaleMode, handleScalePoint, applyScale, clearScaleNow, requestClearScale, closeScaleModal } = usePlanScaleModeHandlers({
    isReadOnly,
    scaleMode,
    scaleDraft,
    plan,
    planScale,
    scaleMetersInput,
    scaleModal,
    push,
    t,
    markTouched,
    updateFloorPlan,
    updateRoom,
    dismissScaleToast,
    resetToolClickHistory,
    resolveAxisLockedPoint,
    computeRoomSurfaceSqm,
    scaleToastIdRef,
    setScaleMode,
    setScaleDraft,
    setScaleDraftPointer,
    setScaleModal,
    setScaleMetersInput,
    setRoomDrawMode,
    setMeasureMode,
    setWallDrawMode,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setPendingType,
    setShowScaleLine,
    setClearScaleConfirmOpen
  });

  const { startWallDraw, finishWallDraw } = usePlanWallDrawToggles({
    isReadOnly,
    wallDrawMode,
    wallDrawType,
    wallTypeDefs,
    lang,
    push,
    t,
    dismissScaleToast,
    resetToolClickHistory,
    isWallType,
    wallDraftPointsRef,
    wallDraftSegmentIdsRef,
    wallToastIdRef,
    setWallDrawType,
    setWallDrawMode,
    setWallDraftPoints,
    setWallDraftPointer,
    setRoomDrawMode,
    setScaleMode,
    setMeasureMode,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setPendingType
  });

  const addWallSegment = useCallback(
    (payload: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      typeId: string;
      label: string;
      layerIds?: string[];
      strokeColor?: string;
      opacity?: number;
      strokeWidth?: number;
    }) =>
      computeAddWallSegment(payload, {
        addObject,
        ensureObjectLayerVisible,
        inferDefaultLayerIds,
        layerIdSet,
        renderPlan
      }),
    [addObject, ensureObjectLayerVisible, getWallTypeColor, inferDefaultLayerIds, layerIdSet, renderPlan]
  );

  const wallSnapPoints = useMemo(() => {
    if (!renderPlan) return [];
    const out: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    for (const obj of renderPlan.objects || []) {
      if (!isWallType(obj.type)) continue;
      for (const point of obj.points || []) {
        const key = `${point.x}:${point.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x: point.x, y: point.y });
      }
    }
    return out;
  }, [isWallType, renderPlan]);

  const resolveWallPoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean; avoidPoint?: { x: number; y: number } | null; avoidDistance?: number }) =>
      computeResolveWallPoint(point, options, {
        wallSnapPoints,
        zoom,
        wallDraftPointsRef
      }),
    [wallSnapPoints, zoom]
  );

  const splitWallAtPoint = useCallback(
    (payload: { id: string; point?: { x: number; y: number } }) =>
      computeSplitWallAtPoint(payload, {
        addWallSegment,
        deleteObject,
        getTypeLabel,
        inferDefaultLayerIds,
        isReadOnly,
        isWallType,
        layerIdSet,
        markTouched,
        projectPointOnSegment,
        renderPlan,
        setSelectedObject,
        zoom,
        lastInsertedRef
      }),
    [
      addWallSegment,
      deleteObject,
      getTypeLabel,
      getWallTypeColor,
      inferDefaultLayerIds,
      isReadOnly,
      isWallType,
      layerIdSet,
      markTouched,
      projectPointOnSegment,
      renderPlan,
      setSelectedObject,
      zoom
    ]
  );

  const { handleWallPoint, handleWallDraftContextMenu, handleWallSegmentDblClick } = usePlanWallPointHandlers({
    addWallSegment,
    finishWallDraw,
    resolveWallPoint,
    getTypeLabel,
    isWallType,
    markTouched,
    renderPlan,
    wallDrawMode,
    wallDrawType,
    wallTypeDefs,
    zoom,
    lang,
    metersPerPixel,
    push,
    t,
    formatNumber,
    wallDraftPointsRef,
    wallDraftSegmentIdsRef,
    lastInsertedRef,
    setWallDraftPoints,
    setWallDraftPointer,
    setContextMenu
  });

  const { startMeasure, stopMeasure, startQuote, stopQuote } = usePlanMeasureQuoteToggles({
    metersPerPixel,
    isReadOnly,
    measureMode,
    quoteMode,
    push,
    t,
    showMeasureToast,
    dismissMeasureToast,
    measurePointsRef,
    measureClosedRef,
    measureFinishedRef,
    setMeasureMode,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setRoomDrawMode,
    setScaleMode,
    setWallDrawMode,
    setPendingType
  });

  useEffect(() => {
    if (!measureMode) dismissMeasureToast();
  }, [dismissMeasureToast, measureMode]);

  const handleQuotePoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) =>
      computeHandleQuotePoint(point, options, {
        addObject,
        ensureObjectLayerVisible,
        getQuoteOrientation,
        getTypeLabel,
        isReadOnly,
        lastQuoteColor,
        lastQuoteDashed,
        lastQuoteEndpoint,
        lastQuoteLabelColor,
        lastQuoteLabelPosH,
        lastQuoteLabelPosV,
        lastQuoteLabelScale,
        lastQuoteLabelBg,
        lastQuoteScale,
        markTouched,
        quoteMode,
        quotePoints,
        renderPlan,
        resolveAxisLockedPoint,
        zoom,
        setQuotePoints,
        setQuotePointer
      }),
    [
      addObject,
      ensureObjectLayerVisible,
      getQuoteOrientation,
      getTypeLabel,
      inferDefaultLayerIds,
      isReadOnly,
      lastQuoteColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      lastQuoteLabelPosH,
      lastQuoteLabelPosV,
      lastQuoteLabelScale,
      lastQuoteLabelBg,
      lastQuoteScale,
      layerIdSet,
      markTouched,
      quoteMode,
      quotePoints,
      renderPlan,
      resolveAxisLockedPoint,
      t,
      zoom
    ]
  );

  const convertMeasurementToQuotes = useCallback(() => {
    computeConvertMeasurementToQuotes({
      addObject,
      dismissMeasureToast,
      ensureObjectLayerVisible,
      getQuoteOrientation,
      getTypeLabel,
      inferDefaultLayerIds,
      isReadOnly,
      lastQuoteColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      lastQuoteLabelBg,
      lastQuoteLabelColor,
      lastQuoteLabelPosH,
      lastQuoteLabelPosV,
      lastQuoteLabelScale,
      lastQuoteScale,
      layerIdSet,
      markTouched,
      measureMode,
      push,
      renderPlan,
      t,
      zoom,
      measurePointsRef,
      measureClosedRef,
      measureFinishedRef,
      setMeasureMode,
      setMeasurePoints,
      setMeasurePointer,
      setMeasureClosed,
      setMeasureFinished
    });
  }, [
    addObject,
    dismissMeasureToast,
    ensureObjectLayerVisible,
    getQuoteOrientation,
    getTypeLabel,
    inferDefaultLayerIds,
    isReadOnly,
    lastQuoteColor,
    lastQuoteDashed,
    lastQuoteEndpoint,
    lastQuoteLabelBg,
    lastQuoteLabelColor,
    lastQuoteLabelPosH,
    lastQuoteLabelPosV,
    lastQuoteLabelScale,
    lastQuoteScale,
    layerIdSet,
    markTouched,
    measureMode,
    push,
    renderPlan,
    t,
    zoom
  ]);


  const { handleToolPoint, handleToolMove, handleToolDoubleClick } = usePlanToolPointHandlers({
    measureMode,
    quoteMode,
    scaleMode,
    wallDrawMode,
    isReadOnly,
    zoom,
    quotePoints,
    scaleDraft,
    resolveAxisLockedPoint,
    resolveWallPoint,
    showMeasureToast,
    handleScalePoint,
    handleWallPoint,
    handleQuotePoint,
    measurePointsRef,
    measureClosedRef,
    measureFinishedRef,
    wallDraftPointsRef,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished,
    setScaleDraftPointer,
    setWallDraftPointer,
    setQuotePointer
  });


  const { applyWallTypeToIds, applyWallType, setRoomWallTypeAt, applyRoomWallTypeAll, createRoomWalls } = usePlanWallTypeHandlers({
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
  });

  const {
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
  } = usePlanShortcuts({
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
  });

  useEffect(() => runPlanKeydownEffect({
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
  }), [
    addRevision,
    addLink,
    allTypesOpen,
    cancelScaleMode,
    clearSelection,
    convertMeasurementToQuotes,
    copySelection,
    deleteLink,
    deleteObject,
    finishWallDraw,
    getPlanUnsavedChanges,
    getLatestRevisionCached,
    getQuoteOrientation,
    isDeskType,
    isWallType,
    linkFromId,
    markTouched,
    measureMode,
    moveObject,
    notifyNonPeopleRoomBlocked,
    performRedo,
    performUndo,
    postAuditEvent,
    push,
    quoteMode,
    requestPaste,
    resetTouched,
    runArrowShortcut,
    runConfirmDeleteShortcut,
    runBlockingUiShortcut,
    runCtrlArrowQuoteShortcut,
    runDrawingShortcut,
    runDraftCancelShortcut,
    runEscapeSelectionShortcut,
    runRotateShortcut,
    runSaveShortcut,
    runScaleShortcut,
    runSelectAllShortcut,
    runTextShortcut,
    runUndoRedoShortcut,
    corridorDoorDraft,
    roomDoorDraft,
    corridorDrawMode,
    corridorModal,
    corridorConnectionModal,
    corridorDoorModal,
    corridorDoorLinkModal,
    roomDrawMode,
    roomCatalogOpen,
    saveRevisionOpen,
    scaleMode,
    selectedCorridorId,
    selectedCorridorDoor,
    selectedRoomDoorId,
    selectedRoomId,
    selectedRoomIds,
    setConfirmDeleteCorridorId,
    setCorridorDoorDraft,
    setCorridorModal,
    setCorridorConnectionModal,
    setCorridorDoorLinkModal,
    setCorridorDoorModal,
    setContextMenu,
    setSelection,
    setSelectedCorridorId,
    setSelectedCorridorDoor,
    startQuote,
    startWallDraw,
    stopMeasure,
    stopQuote,
    showMeasureToast,
    t,
    getPlanSnapshot,
    resolveRoomAssignmentForObject,
    runDeleteShortcut,
	    updateFloorPlan,
	    updateObject,
    updateRoom,
	    updateQuoteLabelPos,
	    photoViewer
	  ]);

  const objectsByType = useMemo(() => {
    const map = new Map<string, any[]>();
    const objs = renderPlan?.objects || [];
    for (const obj of objs) {
      const list = map.get(obj.type) || [];
      list.push(obj);
      map.set(obj.type, list);
    }
    return map;
  }, [renderPlan?.objects]);

  const counts = useMemo(
    () =>
      (objectTypeDefs || [])
        .map((def) => ({
          id: def.id,
          label: getTypeLabel(def.id),
          icon: def.icon,
          count: (objectsByType.get(def.id) || []).length
        }))
        .filter((t) => t.count > 0),
    [getTypeLabel, objectTypeDefs, objectsByType]
  );

  const canManageLayers = !!user?.isAdmin || isSuperAdmin;

  const { handleSelectType, handleDeleteType, handleOpenTypeLayer, handleCreateTypeLayer } = usePlanTypeLayerHandlers({
    objectsByType,
    isReadOnly,
    canManageLayers,
    client,
    getTypeLayerIds,
    inferDefaultLayerIds,
    layerIdSet,
    markTouched,
    planLayers,
    push,
    setPlanDirty,
    t,
    typeLayerColor,
    typeLayerModal,
    typeLayerName,
    updateClientLayers,
    setSelection,
    setCountsOpen,
    setTypeMenu,
    setConfirmDelete,
    setTypeLayerModal
  });

  const isUserObject = useCallback((type: string) => type === 'user' || type === 'real_user' || type === 'generic_user', []);
  const getUserObjectLabel = useCallback(
    (obj: MapObject) => {
      const first = String((obj as any).firstName || '').trim();
      const last = String((obj as any).lastName || '').trim();
      if (obj.type === 'real_user' && (first || last)) return `${first} ${last}`.trim();
      const name = String(obj.name || '').trim();
      return name || t({ it: 'Utente', en: 'User' });
    },
    [t]
  );
  const collectUserDepartments = useCallback((obj: MapObject) => computeCollectUserDepartments(obj), []);

  const rooms = useMemo(() => renderPlan?.rooms || [], [renderPlan?.rooms]);
  const corridors = useMemo(() => (renderPlan?.corridors || []) as Corridor[], [renderPlan?.corridors]);
  const corridorById = useMemo(() => {
    const map = new Map<string, Corridor>();
    for (const corridor of corridors) map.set(corridor.id, corridor);
    return map;
  }, [corridors]);
  const roomDoors = useMemo(() => ((renderPlan as any)?.roomDoors || []) as RoomConnectionDoor[], [(renderPlan as any)?.roomDoors]);
  usePlanHelpToastEffects({
    t,
    isReadOnly,
    selectedCorridorId,
    corridorById,
    corridorDrawMode,
    roomDrawMode,
    selectedRoomId
  });

  const paletteFavorites = useAuthStore((s) => (s.user as any)?.paletteFavorites) as string[] | undefined;
  const paletteOrder = useMemo(() => {
    const fav = Array.isArray(paletteFavorites) ? paletteFavorites : [];
    return fav.filter((id) => !isWallType(id) && !isDoorType(id) && !isSecurityTypeId(id));
  }, [isDoorType, isWallType, paletteFavorites]);
  // User-configured palette: list can be empty (meaning no objects enabled).
  const paletteHasCustom = paletteOrder.length > 0;
  const paletteIsEmpty = Array.isArray(paletteFavorites) && paletteOrder.length === 0;
  const paletteHasMore = useMemo(() => {
    const all = (objectTypeDefs || [])
      .map((d) => d.id)
      .filter((id) => !isDeskType(id) && !isWallType(id) && !isDoorType(id) && !isSecurityTypeId(id));
    const fav = new Set(paletteOrder);
    return all.some((id) => !fav.has(id));
  }, [isDoorType, isWallType, objectTypeDefs, paletteOrder]);
  const deskTypeSet = useMemo(() => new Set(DESK_TYPE_IDS as readonly string[]), []);
  const deskPaletteDefs = useMemo(() => {
    const defs = objectTypeDefs || [];
    return defs.filter((d) => deskTypeSet.has(d.id));
  }, [deskTypeSet, objectTypeDefs]);
  const deskPaletteOrder = useMemo(() => {
    const filtered = paletteOrder.filter((id) => deskTypeSet.has(id));
    return filtered.length ? filtered : undefined;
  }, [deskTypeSet, paletteOrder]);
  const securityPaletteDefs = useMemo(() => {
    const defs = objectTypeDefs || [];
    return defs.filter((d) => isSecurityTypeId(d.id));
  }, [objectTypeDefs]);
  const otherPaletteDefs = useMemo(() => {
    const defs = objectTypeDefs || [];
    return defs.filter((d) => !deskTypeSet.has(d.id) && !isWallType(d.id) && !isDoorType(d.id) && !isSecurityTypeId(d.id));
  }, [deskTypeSet, isDoorType, isWallType, objectTypeDefs]);
  const [paletteSection, setPaletteSection] = useState<'desks' | 'objects' | 'security'>('objects');
  const [annotationsOpen, setAnnotationsOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [desksOpen, setDesksOpen] = useState(false);
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  usePlanPaletteSectionEffects({
    paletteSection,
    setPaletteSection,
    deskPaletteDefs,
    otherPaletteDefs,
    securityPaletteDefs,
    setDesksOpen,
    setObjectsOpen,
    setSecurityOpen
  });
  const paletteSettingsSection: 'desks' | 'security' | 'objects' = paletteSection === 'desks' ? 'desks' : paletteSection === 'security' ? 'security' : 'objects';

  const { addTypeToPalette, removeTypeFromPalette } = usePlanPaletteFavoriteHandlers({ isDoorType, push, t });

  useEffect(() => {
    if (!gridMenuOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!gridMenuRef.current) return;
      if (!gridMenuRef.current.contains(e.target as any)) setGridMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [gridMenuOpen]);

  const roomStatsCacheRef = useRef<{
    key: string;
    value: Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }>;
  }>({ key: '', value: new Map() });
  const roomStatsById = useMemo(
    () => computeRoomStatsById({ renderPlan, isUserObject, roomStatsCacheRef }),
    [isUserObject, renderPlan?.objects]
  );
  const corridorDoorLinkRoomEntries = useMemo(() => {
    return computeCorridorDoorLinkRoomEntries({
      corridorDoorLinkModal,
      corridorDoorLinkQuery,
      getUserObjectLabel,
      isUserObject,
      lang,
      renderPlan,
      roomStatsById
    });
  }, [corridorDoorLinkModal?.magneticRoomIds, corridorDoorLinkModal?.nearestRoomId, corridorDoorLinkQuery, getUserObjectLabel, isUserObject, lang, renderPlan?.rooms, roomStatsById]);

  const {
    capacityConfirm,
    setCapacityConfirm,
    capacityConfirmRef,
    capacityDashboardOpen,
    setCapacityDashboardOpen,
    capacityDashboardPreset,
    setCapacityDashboardPreset,
    shouldConfirmCapacity
  } = usePlanCapacity({
    t,
    push,
    planId,
    plan,
    location,
    navigate,
    rooms,
    roomStatsById,
    roomCapacityStateByPlan,
    setRoomCapacityState,
    getRoomIdAt,
    notifyNonPeopleRoomBlocked
  });

  const handleStageMoveStart = useCallback((id: string, x: number, y: number, roomId?: string) => {
    dragStartRef.current.set(id, { x, y, roomId });
  }, []);

  const handleStageMove = useCallback(
    (id: string, x: number, y: number) =>
      computeHandleStageMove(id, x, y, {
        collectUserDepartments,
        getUserObjectLabel,
        markTouched,
        moveObject,
        notifyNonPeopleRoomBlocked,
        resolveRoomAssignmentForObject,
        roomStatsById,
        t,
        updateObject,
        isReadOnlyRef,
        planRef,
        dragStartRef,
        getRoomIdAt,
        isUserType,
        setCapacityConfirm,
        setRoomDepartmentConfirm
      }),
    [
      collectUserDepartments,
      getUserObjectLabel,
      markTouched,
      moveObject,
      notifyNonPeopleRoomBlocked,
      resolveRoomAssignmentForObject,
      roomStatsById,
      t,
      updateObject
    ]
  );

  const handleWallMove = useCallback(
    (id: string, dx: number, dy: number, batchId?: string, movedRoomIds?: string[]) =>
      computeHandleWallMove(id, dx, dy, batchId, movedRoomIds, {
        markTouched,
        updateObject,
        wallMoveBatchRef,
        planRef,
        isReadOnlyRef
      }),
    [
      markTouched,
      updateObject
    ]
  );

  const objectListMatches = useMemo(() => {
    const q = objectListQuery.trim().toLowerCase();
    if (!q) return [];
    return (renderPlan?.objects || []).filter(
      (o) =>
        !isDeskType(o.type) &&
        (o.name.toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q))
    );
  }, [objectListQuery, renderPlan?.objects]);

  usePlanPopoverEffects({
    countsOpen,
    setObjectListQuery,
    setExpandedType,
    setTypeMenu,
    typeMenu,
    typeMenuRef,
    typeLayerModal,
    setTypeLayerName,
    setTypeLayerColor,
    typeLayerNameRef,
    presenceOpen,
    presenceRef,
    setPresenceOpen,
    layersPopoverOpen,
    layersPopoverRef,
    setLayersPopoverOpen,
    layersQuickMenu,
    layersQuickMenuRef,
    setLayersQuickMenu,
    roomsOpen,
    setExpandedRoomId,
    setNewRoomMenuOpen
  });

  useEffect(() => {
    if (!user) return;
    const normalized = normalizeVisibleLayerIdsByPlan((user as any)?.visibleLayerIdsByPlan || {});
    layerVisibilitySyncRef.current = JSON.stringify(normalized);
  }, [normalizeVisibleLayerIdsByPlan, user]);

  useEffect(() => runLayerVisibilitySyncEffect({ user, normalizeVisibleLayerIdsByPlan, visibleLayerIdsByPlan, layerVisibilitySyncRef }),
    [normalizeVisibleLayerIdsByPlan, user, visibleLayerIdsByPlan]);

  const beginRoomDraw = () => {
    if (isReadOnly) return;
    setPendingType(null);
    setRoomDrawMode('rect');
    setRoomsOpen(false);
    setContextMenu(null);
    push(t({ it: 'Disegna un rettangolo sulla mappa per creare una stanza', en: 'Draw a rectangle on the map to create a room' }), 'info');
  };

  const beginRoomPolyDraw = () => {
    if (isReadOnly) return;
    setPendingType(null);
    setRoomDrawMode('poly');
    setRoomsOpen(false);
    setContextMenu(null);
    push(
      t({
        it: 'Clicca più punti per disegnare un poligono. Clicca sul primo punto (o premi Invio) per chiudere.',
        en: 'Click multiple points to draw a polygon. Click the first point (or press Enter) to close.'
      }),
      'info'
    );
  };

  const beginCorridorPolyDraw = () => {
    if (isReadOnly) return;
    setPendingType(null);
    setRoomDrawMode(null);
    setCorridorDoorDraft(null);
    setCorridorQuickMenu(null);
    setCorridorDrawMode('poly');
    setRoomsOpen(false);
    setContextMenu(null);
  };

  const openEditRoom = (roomId: string, options?: { openDepartments?: boolean }) =>
    computeOpenEditRoom(roomId, options, { rooms, isReadOnly, setRoomModal });

  const snapRoomRectToAdjacentSide = useCallback(
    (inputRect: { x: number; y: number; width: number; height: number }) =>
      computeSnapRoomRectToAdjacentSide(inputRect, { plan }),
    [plan]
  );

  const handleCreateRoomFromRect = (rect: { x: number; y: number; width: number; height: number }) =>
    computeCreateRoomFromRect(rect, { isReadOnly, snapRoomRectToAdjacentSide, hasRoomOverlap, notifyRoomOverlap, setRoomDrawMode, setRoomModal });

  const handleCreateRoomFromPoly = (points: { x: number; y: number }[]) =>
    computeCreateRoomFromPoly(points, { isReadOnly, hasRoomOverlap, notifyRoomOverlap, setRoomDrawMode, setRoomModal });

  const { openEditCorridor, handleCreateCorridorFromPoly, saveCorridorModal, updateCorridorLabelScale } = usePlanCorridorNameHandlers({
    corridorById,
    isReadOnly,
    plan,
    t,
    setCorridorDrawMode,
    corridorModal,
    corridorNameInput,
    corridorNameEnInput,
    corridorShowNameInput,
    markTouched,
    push,
    updateFloorPlan,
    setSelectedCorridorId,
    setCorridorModal,
    setCorridorNameInput,
    setCorridorNameEnInput,
    setCorridorShowNameInput
  });

  const {
    openCorridorDoorModal,
    openRoomDoorModal,
    openCorridorDoorLinkModal,
    saveCorridorDoorModal,
    saveCorridorDoorLinkModal
  } = usePlanDoorModalHandlers({
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
  });


  useEffect(() => runCorridorShortcutEffect({ selectedCorridorId, isReadOnly, openEditCorridor, updateCorridorLabelScale }),
    [isReadOnly, openEditCorridor, selectedCorridorId, updateCorridorLabelScale]);

  const {
    startCorridorDoorDraw,
    insertCorridorJunctionPoint,
    openCorridorConnectionModalAt,
    openEditCorridorConnectionModal,
    saveCorridorConnectionModal
  } = usePlanCorridorConnectionHandlers({
    isReadOnly,
    push,
    t,
    markTouched,
    plan,
    updateFloorPlan,
    corridorById,
    corridorConnectionModal,
    getClosestCorridorEdge,
    getCorridorPolygon,
    getCorridorEdgePoint,
    setCorridorDoorDraft,
    setCorridorQuickMenu,
    setSelectedCorridorDoor,
    setSelectedCorridorId,
    setCorridorConnectionModal
  });

  const openRoomWallTypes = useCallback(
    (payload: { roomId: string; roomName: string; kind: 'rect' | 'poly'; rect?: { x: number; y: number; width: number; height: number }; points?: { x: number; y: number }[] }) => {
      const segments = buildRoomWallSegments({ kind: payload.kind, rect: payload.rect, points: payload.points });
      if (!segments.length) return;
      setRoomWallTypeModal({ roomId: payload.roomId, roomName: payload.roomName, segments, mode: 'create' });
    },
    [buildRoomWallSegments]
  );

  const openWallGroupModal = useCallback(
    (wallId: string) => {
      const data = getWallPolygonData(wallId);
      if (!data || data.segments.length < 3) return false;
      setRoomWallTypeModal({
        roomId: data.roomId,
        roomName: data.roomName,
        segments: data.segments,
        mode: 'edit',
        wallIds: data.wallIds,
        wallTypes: data.wallTypes
      });
      return true;
    },
    [getWallPolygonData]
  );

  const handleCreateWallsForRoom = useCallback(() => {
    if (!roomModal || roomModal.mode !== 'edit' || !renderPlan) return;
    const room = renderPlanRoomById.get(roomModal.roomId);
    if (!room) return;
    const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
    openRoomWallTypes({
      roomId: room.id,
      roomName: room.name || t({ it: 'Stanza', en: 'Room' }),
      kind,
      rect: kind === 'rect' ? { x: room.x || 0, y: room.y || 0, width: room.width || 0, height: room.height || 0 } : undefined,
      points: kind === 'poly' ? room.points || [] : undefined
    });
    setRoomModal(null);
  }, [openRoomWallTypes, renderPlan, renderPlanRoomById, roomModal, t]);

  const openRealUserPickerAt = useCallback(
    async (x: number, y: number) => {
      if (isReadOnly) return;
      setPendingType(null);
      if (!client?.id) {
        setRealUserImportMissing(true);
        return;
      }
      try {
        const hasUsers = await hasExternalUsers(client.id);
        if (!hasUsers) {
          setRealUserImportMissing(true);
          return;
        }
        setRealUserPicker({ x, y });
      } catch {
        setRealUserImportMissing(true);
      }
    },
    [client?.id, isReadOnly]
  );

  const proceedPlaceUser = useCallback(
    (type: MapObjectType, x: number, y: number) => {
      if (type === 'real_user') {
        void openRealUserPickerAt(x, y);
        return;
      }
      setModalState({ mode: 'create', type, coords: { x, y } });
      setPendingType(null);
    },
    [openRealUserPickerAt]
  );

  const handlePlaceNew = (
    type: MapObjectType,
    x: number,
    y: number,
    options?: { textBoxWidth?: number; textBoxHeight?: number }
  ) => {
    runHandlePlaceNew(type, x, y, options, {
      isReadOnly,
      panToolActive,
      setPanToolActive,
      shouldConfirmCapacity,
      proceedPlaceUser,
      isDeskType,
      plan,
      markTouched,
      getTypeLabel,
      addObject,
      defaultObjectScale,
      ensureObjectLayerVisible,
      lastInsertedRef,
      getRoomIdAt,
      updateObject,
      push,
      t,
      postAuditEvent,
      setModalState,
      setPendingType
    });
  };

  const getCameraDefaults = useCallback(
    () => ({
      rotation: 0,
      cctvRange: 160,
      cctvAngle: 70,
      cctvOpacity: 0.6
    }),
    []
  );

  const handleCreate = (payload: HandleCreatePayload) => {
    runHandleCreate(payload, {
      plan,
      modalState,
      isReadOnly,
      markTouched,
      defaultObjectScale,
      lastQuoteLabelPosH,
      lastQuoteLabelBg,
      isCameraType,
      getCameraDefaults,
      lastQuoteColor,
      lastQuoteLabelScale,
      lastQuoteLabelColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      getTypeLayerIds,
      inferDefaultLayerIds,
      layerIdSet,
      addObject,
      ensureObjectLayerVisible,
      setLastQuoteScale,
      setLastQuoteColor,
      setLastQuoteLabelScale,
      setLastQuoteLabelBg,
      setLastQuoteLabelColor,
      setLastQuoteLabelPosH,
      setLastQuoteLabelPosV,
      setLastQuoteDashed,
      setLastQuoteEndpoint,
      setLastObjectScale,
      lastInsertedRef,
      getRoomIdAt,
      resolveRoomAssignmentForObject,
      isUserType,
      notifyNonPeopleRoomBlocked,
      updateObject,
      saveCustomValues,
      push,
      t,
      postAuditEvent,
      getQuoteOrientation
    });
  };

  const { handleEdit, openEditFromSelectionList, openLinkEditFromSelectionList } = usePlanEditOpenHandlers({
    renderPlan,
    renderPlanObjectById,
    isDeskType,
    isWallType,
    openWallGroupModal,
    returnToSelectionListRef,
    setRackModal,
    setWallTypeModal,
    setModalState,
    setSelectedObjectsModalOpen,
    setLinkEditId
  });

  const { openPhotoViewer, openImageViewer, focusPhotoFromGallery } = usePlanMediaViewerHandlers({
    renderPlan,
    renderPlanObjectById,
    push,
    t,
    setPhotoViewer,
    returnToBulkEditRef,
    triggerHighlight,
    setSelection,
    setSelectedObject,
    setSelectedRoomId,
    setSelectedRoomIds,
    setSelectedLinkId
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pg') !== '1') return;
    if (planPhotoIds.length) {
      openPhotoViewer({ id: planPhotoIds[0], selectionIds: planPhotoIds });
    }
    params.delete('pg');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate, openPhotoViewer, planPhotoIds]);

  const closeReturnToSelectionList = () => {
    if (!returnToSelectionListRef.current) return;
    returnToSelectionListRef.current = false;
    setSelectedObjectsModalOpen(true);
  };

  const handleUpdate = (payload: HandleCreatePayload) => {
    runHandleUpdate(payload, {
      modalState,
      isReadOnly,
      markTouched,
      plan,
      updateObject,
      setLastQuoteScale,
      setLastQuoteLabelScale,
      setLastQuoteLabelBg,
      setLastQuoteLabelColor,
      getQuoteOrientation,
      setLastQuoteLabelPosV,
      setLastQuoteLabelPosH,
      setLastQuoteColor,
      setLastQuoteDashed,
      setLastQuoteEndpoint,
      setLastObjectScale,
      saveCustomValues,
      push,
      t,
      postAuditEvent,
      planId
    });
  };

  const handleSearch = (term: string) => {
    // Run search only on Enter. Typing hides any previous results.
    if (!term.trim()) {
      setSearchResultsOpen(false);
      setSearchResultsObjects([]);
      setSearchResultsRooms([]);
      return;
    }
    setSearchResultsOpen(false);
    setSearchResultsObjects([]);
    setSearchResultsRooms([]);
  };

  const handleZoomChange = useCallback(
    (value: number) => {
      setAutoFitEnabled(false);
      setZoom(value);
    },
    [setZoom]
  );
  const handlePanChange = useCallback(
    (value: { x: number; y: number }) => {
      setAutoFitEnabled(false);
      setPan(value);
    },
    [setPan]
  );

  const clientSearchIndexRef = useRef<{
    key: string;
    value: { planId: string; search: string; result: CrossPlanSearchResult }[];
  }>({ key: '', value: [] });
  const { handleSearchEnter } = usePlanSearchHandlers({
    client,
    dataVersion,
    clientSearchIndexRef,
    renderPlan,
    plan,
    isDeskType,
    searchDebugEnabled,
    renderPlanObjectById,
    basePlanObjectById,
    renderPlanRoomById,
    basePlanRoomById,
    push,
    t,
    clearSelection,
    promptRevealForObject,
    triggerHighlight,
    setSearchResultsOpen,
    setSearchResultsTerm,
    setSearchResultsObjects,
    setSearchResultsRooms,
    setCrossPlanSearchOpen,
    setCrossPlanSearchTerm,
    setSelectedRoomId,
    setSelectedRoomIds,
    setHighlightRoom,
    setCrossPlanResults,
    setSelectedObject
  });

  const modalInitials = useMemo(
    () =>
      computeModalInitials({
        modalState,
        renderPlan,
        renderPlanObjectById,
        layerIdSet,
        defaultObjectScale,
        getTypeLayerIds,
        inferDefaultLayerIds,
        formatQuoteLabel,
        lastQuoteLabelScale,
        lastQuoteLabelBg,
        lastQuoteLabelPosH,
        lastQuoteDashed,
        lastQuoteEndpoint,
        lastQuoteColor,
        lastQuoteLabelColor
      }),
    [
      defaultObjectScale,
      formatQuoteLabel,
      getTypeLayerIds,
      inferDefaultLayerIds,
      layerIdSet,
      lastQuoteColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      lastQuoteLabelColor,
      lastQuoteLabelPosH,
      lastQuoteLabelBg,
      lastQuoteLabelScale,
      modalState,
      renderPlan,
      renderPlanObjectById
    ]
  );

  const assignedCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!client) return map;
    for (const s of client.sites || []) {
      for (const p of s.floorPlans || []) {
        for (const o of p.objects || []) {
          const cid = (o as any).externalClientId;
          const eid = (o as any).externalUserId;
          if (!cid || !eid) continue;
          const key = `${cid}:${eid}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    }
    return map;
  }, [client]);
  const canOpenBusinessPartnersDirectory = useMemo(
    () => !!isSuperAdmin || !!user?.isAdmin || (user as any)?.canManageBusinessPartners === true,
    [isSuperAdmin, user]
  );

  const orderedViews = useMemo(() => {
    const list = basePlan?.views || [];
    if (!list.length) return list;
    return list.slice().sort((a, b) => {
      const aDef = a.isDefault ? 1 : 0;
      const bDef = b.isDefault ? 1 : 0;
      if (aDef !== bDef) return bDef - aDef;
      return 0;
    });
  }, [basePlan?.views]);
  const showPrintArea = !!(showPrintAreaByPlan as any)?.[basePlan?.id];
  const corridorConnectionTargetPlans = useMemo(
    () => ((site?.floorPlans || []) as FloorPlan[]).filter((p) => p.id !== planId),
    [planId, site?.floorPlans]
  );

  const linksInSelection = useMemo(
    () => computeLinksInSelection({ basePlan, selectedObjectIds, selectionAllRealUsers, selectedLinkId }),
    [basePlan, selectedLinkId, selectedObjectIds, selectionAllRealUsers]
  );

  const getObjectNameById = useCallback(
    (id: string) => renderPlanObjectById.get(id)?.name || id,
    [renderPlanObjectById]
  );

  return {
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
    corridors,
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
    permissions,
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
  };
};
