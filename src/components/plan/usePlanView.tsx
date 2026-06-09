import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { meetingIsoDayFromTs, meetingClockFromTs, shiftIsoDay, monthAnchorFromIso, shiftMonthAnchor, hmToMinutes } from './planViewTime';
import { runRoomDepartmentOptionsEffect, runMeetingOverviewEffect } from './planViewDepartmentOptions';
import { computeRackOverlayLinks } from './planViewExportData';
import {
  isPointInRoom, getRoomIdAt, isUserType,
  polygonsOverlap
} from './planViewRoomGeometry';
import {
  computeAlignSelection,
  computeGetCorridorPolygon,
  computeSaveRevisionReason
} from './planViewMiscTools';
import {
  computeGetClosestCorridorEdge,
  computeGetCorridorEdgePoint
} from './planViewCorridorGeometry';
import {
  computeSubmenuStyle, computeClientBusinessPartnerNames, computeMeetingLocationLabels, computeSiteMeetingParticipantCandidates
} from './planViewComputeBits';
import {
  computeMyMeetingsFiltered, runToggleRevisionImmutable,
  runPerformPendingPostSaveAction
} from './planViewComputeBits2';
import {
  runCorridorShortcutEffect, runSearchExportShortcutEffect, runResetToolsOnPlanChangeEffect,
  runLayerVisibilitySyncEffect
} from './planViewEffects';
import {
  runViewportInitEffect,
  runViewportAutoCenterEffect,
  runViewportPresentationEffect
} from './planViewViewport';

import { CanvasStageHandle } from './CanvasStage';

import { Corridor, FloorPlan, FloorPlanView, IconName, MapObject, MapObjectType, Room } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useToastStore } from '../../store/useToast';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchPlanRevisions } from '../../api/state';


import { isDeskType } from './deskTypes';

import type { CrossPlanSearchResult } from './CrossPlanSearchModal';
import { useRoomMeetingsTimeline, type MyMeetingsModalState } from './useRoomMeetingsTimeline';
import { usePlanSafetyCard } from './usePlanSafetyCard';
import { usePlanCapacity } from './usePlanCapacity';
import { usePlanContextDerived, type PlanContextMenuState } from './usePlanContextDerived';
import { usePlanTypeCatalog } from './usePlanTypeCatalog';
import { usePlanRoomGeometry } from './usePlanRoomGeometry';
import { usePlanRoomModalDerived } from './usePlanRoomModalDerived';
import { usePlanLayerResolution } from './usePlanLayerResolution';
import { usePlanMeasureScale } from './usePlanMeasureScale';
import { usePlanRenderDerived } from './usePlanRenderDerived';
import { usePlanLinkRackModals } from './usePlanLinkRackModals';
import { usePlanPaletteDefs } from './usePlanPaletteDefs';
import { usePlanAccessPermissions } from './usePlanAccessPermissions';
import { usePlanObjectIndex } from './usePlanObjectIndex';
import { usePlanCollections } from './usePlanCollections';
import { usePlanRoomExportDerived } from './usePlanRoomExportDerived';
import { usePlanObjectCreateHandlers } from './usePlanObjectCreateHandlers';
import { usePlanMiscDerived } from './usePlanMiscDerived';
import { usePlanRoomStats } from './usePlanRoomStats';
import { usePlanMeasureToast } from './usePlanMeasureToast';
import { usePlanWallToolHandlers } from './usePlanWallToolHandlers';
import { usePlanQuoteToolHandlers } from './usePlanQuoteToolHandlers';
import { usePlanPresentation } from './usePlanPresentation';
import { usePlanSaveRevisionHandlers } from './usePlanSaveRevisionHandlers';
import { usePlanRoomLayoutExportHandlers } from './usePlanRoomLayoutExportHandlers';
import { usePlanModalInitials } from './usePlanModalInitials';
import { usePlanRoomDrawHandlers } from './usePlanRoomDrawHandlers';
import { usePlanWallGroupHandlers } from './usePlanWallGroupHandlers';
import { usePlanRealUserPlacement } from './usePlanRealUserPlacement';
import { usePlanWallSegments } from './usePlanWallSegments';
import { usePlanMapContextMenuHandler } from './usePlanMapContextMenuHandler';
import { usePlanMoveHandlers } from './usePlanMoveHandlers';
import { usePlanStageSelectHandler } from './usePlanStageSelectHandler';
import { usePlanMyMeetingsModal } from './usePlanMyMeetingsModal';
import { usePlanObjectMiscHandlers } from './usePlanObjectMiscHandlers';
import { usePlanPointerHelpers } from './usePlanPointerHelpers';
import { usePlanHistory } from './usePlanHistory';
import { renderKeybindToastContent } from './planViewKeybindToast';
import { usePlanLockState } from './usePlanLockState';
import { usePlanLockActions } from './usePlanLockActions';
import { usePlanLockEffects } from './usePlanLockEffects';
import { usePlanKeydownEffect } from './usePlanKeydownEffect';
import type {
  PlanObjectModalState, RoomDepartmentConfirmState, RackPortsLinkState, EscapeRouteModalState, LayerRevealPromptState, MeetingManagerPresetState,
  ClientMeetingsPresetState
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

import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { perfMetrics } from '../../utils/perfMetrics';
import { getWallTypeColor } from '../../utils/wallColors';
import { useMeetingRoomKioskInfo } from '../meetings/useMeetingRoomKioskInfo';

import { getRoomPolygon, isRackLinkId, getSharedRoomSides, resolveAxisLockedPoint } from './planViewUtils';
import { getRevisionVersion } from './planRevisions';
import { usePlanShortcuts } from './usePlanShortcuts';
import { usePlanSelectionState } from './usePlanSelectionState';
import { usePlanDrawingState } from './usePlanDrawingState';
export const UNLOCK_REQUEST_EVENT = 'plixmap_unlock_request';
export const FORCE_UNLOCK_EVENT = 'plixmap_force_unlock';

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
    (title: { it: string; en: string }, items: Array<{ cmd: string; it: string; en: string }>) =>
      renderKeybindToastContent(title, items, t),
    [t]
  );
  const [autoFitEnabled, setAutoFitEnabled] = useState(true);
  const presentationViewportRef = useRef<{ zoom: number; pan: { x: number; y: number }; autoFitEnabled: boolean } | null>(null);
  const {
    addObject, updateObject, moveObject, deleteObject, updateFloorPlan,
    setFloorPlanContent, addView, updateView, deleteView, setDefaultView,
    clearObjects, setObjectRoomIds, addRoom, updateRoom, deleteRoom,
    addRevision, restoreRevision, updateRevision, deleteRevision, clearRevisions,
    setFloorPlanRevisions, addLink, deleteLink, updateLink, addRackLink,
    deleteRackLink, updateRackItem, updateClientLayers,
  } = useDataStore(
    useShallow((s) => ({
      addObject: s.addObject, updateObject: s.updateObject, moveObject: s.moveObject, deleteObject: s.deleteObject,
      updateFloorPlan: s.updateFloorPlan, setFloorPlanContent: s.setFloorPlanContent, addView: s.addView, updateView: s.updateView,
      deleteView: s.deleteView, setDefaultView: s.setDefaultView, clearObjects: s.clearObjects, setObjectRoomIds: s.setObjectRoomIds,
      addRoom: s.addRoom, updateRoom: s.updateRoom, deleteRoom: s.deleteRoom, addRevision: s.addRevision,
      restoreRevision: (s as any).restoreRevision, updateRevision: (s as any).updateRevision, deleteRevision: s.deleteRevision, clearRevisions: s.clearRevisions,
      setFloorPlanRevisions: (s as any).setFloorPlanRevisions, addLink: (s as any).addLink, deleteLink: (s as any).deleteLink, updateLink: (s as any).updateLink,
      addRackLink: (s as any).addRackLink, deleteRackLink: (s as any).deleteRackLink, updateRackItem: (s as any).updateRackItem, updateClientLayers: (s as any).updateClientLayers,
	    }))
	  );

  const objectTypeDefs = useDataStore((s) => s.objectTypes);
  const {
    objectTypeById, wallTypeIdSet, wallTypeDefs, doorTypeIdSet, defaultDoorCatalogId, deskCatalogDefs,
    wallAttenuationByType, defaultWallTypeId, getTypeLabel, getTypeIcon, isWallType, isDoorType,
    formatNumber, getLayerNote, objectTypeIcons, objectTypeLabels, isCameraType, inferDefaultLayerIds,
    normalizeVisibleLayerIdsByPlan,
  } = usePlanTypeCatalog(objectTypeDefs, lang);

  const {
    selectedObjectId, selectedObjectIds, setSelectedObject, setSelection, toggleSelectedObject,
    clearSelection, setSelectedPlan, selectedRevisionByPlan, setSelectedRevision, zoom,
    setZoom, pan, setPan, saveViewport, loadViewport,
    triggerHighlight, highlight, lastObjectScale, setLastObjectScale, lastQuoteScale,
    setLastQuoteScale, lastQuoteColor, setLastQuoteColor, lastQuoteLabelPosH, setLastQuoteLabelPosH,
    lastQuoteLabelPosV, setLastQuoteLabelPosV, lastQuoteLabelScale, setLastQuoteLabelScale, lastQuoteLabelBg,
    setLastQuoteLabelBg, lastQuoteLabelColor, setLastQuoteLabelColor, lastQuoteDashed, setLastQuoteDashed,
    lastQuoteEndpoint, setLastQuoteEndpoint, visibleLayerIdsByPlan, setVisibleLayerIds, gridSnapEnabled,
    gridSize, showGrid, setGridSnapEnabled, setGridSize, setShowGrid,
    showPrintAreaByPlan, toggleShowPrintArea, roomCapacityStateByPlan, setRoomCapacityState, perfOverlayEnabled,
    presentationMode, togglePresentationMode, presentationEnterRequested, clearPresentationEnterRequest, hiddenLayersByPlan,
    setHideAllLayers, setLockedPlans, setPlanDirty, requestSaveAndNavigate, pendingSaveNavigateTo,
    clearPendingSaveNavigate, pendingPostSaveAction, clearPendingPostSaveAction,
  } = useUIStore(
    useShallow((s) => ({
      selectedObjectId: s.selectedObjectId, selectedObjectIds: s.selectedObjectIds, setSelectedObject: s.setSelectedObject, setSelection: s.setSelection,
      toggleSelectedObject: s.toggleSelectedObject, clearSelection: s.clearSelection, setSelectedPlan: s.setSelectedPlan, selectedRevisionByPlan: s.selectedRevisionByPlan,
      setSelectedRevision: s.setSelectedRevision, zoom: s.zoom, setZoom: s.setZoom, pan: s.pan,
      setPan: s.setPan, saveViewport: s.saveViewport, loadViewport: s.loadViewport, triggerHighlight: s.triggerHighlight,
      highlight: s.highlight, lastObjectScale: s.lastObjectScale, setLastObjectScale: s.setLastObjectScale, lastQuoteScale: s.lastQuoteScale,
      setLastQuoteScale: s.setLastQuoteScale, lastQuoteColor: s.lastQuoteColor, setLastQuoteColor: s.setLastQuoteColor, lastQuoteLabelPosH: s.lastQuoteLabelPosH,
      setLastQuoteLabelPosH: s.setLastQuoteLabelPosH, lastQuoteLabelPosV: s.lastQuoteLabelPosV, setLastQuoteLabelPosV: s.setLastQuoteLabelPosV, lastQuoteLabelScale: s.lastQuoteLabelScale,
      setLastQuoteLabelScale: s.setLastQuoteLabelScale, lastQuoteLabelBg: s.lastQuoteLabelBg, setLastQuoteLabelBg: s.setLastQuoteLabelBg, lastQuoteLabelColor: s.lastQuoteLabelColor,
      setLastQuoteLabelColor: s.setLastQuoteLabelColor, lastQuoteDashed: s.lastQuoteDashed, setLastQuoteDashed: s.setLastQuoteDashed, lastQuoteEndpoint: s.lastQuoteEndpoint,
      setLastQuoteEndpoint: s.setLastQuoteEndpoint, visibleLayerIdsByPlan: (s as any).visibleLayerIdsByPlan, setVisibleLayerIds: (s as any).setVisibleLayerIds, gridSnapEnabled: (s as any).gridSnapEnabled,
      gridSize: (s as any).gridSize, showGrid: (s as any).showGrid, setGridSnapEnabled: (s as any).setGridSnapEnabled, setGridSize: (s as any).setGridSize,
      setShowGrid: (s as any).setShowGrid, showPrintAreaByPlan: (s as any).showPrintAreaByPlan, toggleShowPrintArea: (s as any).toggleShowPrintArea, roomCapacityStateByPlan: (s as any).roomCapacityStateByPlan,
      setRoomCapacityState: (s as any).setRoomCapacityState, perfOverlayEnabled: (s as any).perfOverlayEnabled, presentationMode: (s as any).presentationMode, togglePresentationMode: (s as any).togglePresentationMode,
      presentationEnterRequested: (s as any).presentationEnterRequested, clearPresentationEnterRequest: (s as any).clearPresentationEnterRequest, hiddenLayersByPlan: (s as any).hiddenLayersByPlan, setHideAllLayers: (s as any).setHideAllLayers,
      setLockedPlans: (s as any).setLockedPlans, setPlanDirty: (s as any).setPlanDirty, requestSaveAndNavigate: (s as any).requestSaveAndNavigate, pendingSaveNavigateTo: (s as any).pendingSaveNavigateTo,
      clearPendingSaveNavigate: (s as any).clearPendingSaveNavigate, pendingPostSaveAction: (s as any).pendingPostSaveAction, clearPendingPostSaveAction: (s as any).clearPendingPostSaveAction,
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
    panToolActive, setPanToolActive, expandedRoomId, setExpandedRoomId, selectedRoomId,
    setSelectedRoomId, selectedRoomIds, setSelectedRoomIds, selectedCorridorId, setSelectedCorridorId,
    selectedCorridorDoor, setSelectedCorridorDoor, selectedRoomDoorId, setSelectedRoomDoorId, selectedLinkId,
    setSelectedLinkId, wallQuickMenu, setWallQuickMenu, corridorQuickMenu, setCorridorQuickMenu,
    corridorDoorDraft, setCorridorDoorDraft, roomDoorDraft, setRoomDoorDraft, wallTypeMenu,
    setWallTypeMenu, mapSubmenu, setMapSubmenu, linkFromId, setLinkFromId,
    cableModal, setCableModal, linksModalObjectId, setLinksModalObjectId, linkEditId,
    setLinkEditId, realUserDetailsId, setRealUserDetailsId, photoViewer, setPhotoViewer,
  } = usePlanSelectionState();
  const {
    roomDrawMode, setRoomDrawMode, corridorDrawMode, setCorridorDrawMode, wallDrawMode,
    setWallDrawMode, wallDrawType, setWallDrawType, wallDraftPoints, setWallDraftPoints,
    wallDraftPointer, setWallDraftPointer, scaleMode, setScaleMode, scaleDraft,
    setScaleDraft, scaleDraftPointer, setScaleDraftPointer, scaleModal, setScaleModal,
    scaleMetersInput, setScaleMetersInput, showScaleLine, setShowScaleLine, measureMode,
    setMeasureMode, measurePoints, setMeasurePoints, measurePointer, setMeasurePointer,
    measureClosed, setMeasureClosed, measureFinished, setMeasureFinished, quoteMode,
    setQuoteMode, quotePoints, setQuotePoints, quotePointer, setQuotePointer,
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
    roomModal, setRoomModal, roomMeasuresModal, setRoomMeasuresModal, roomLayoutExportModal,
    setRoomLayoutExportModal, confirmDeleteRoomId, setConfirmDeleteRoomId, confirmDeleteRoomIds, setConfirmDeleteRoomIds,
    confirmDeleteCorridorId, setConfirmDeleteCorridorId, corridorModal, setCorridorModal, corridorNameInput,
    setCorridorNameInput, corridorNameEnInput, setCorridorNameEnInput, corridorNameInputRef, corridorShowNameInput,
    setCorridorShowNameInput, corridorDoorModal, setCorridorDoorModal, corridorDoorLinkModal, setCorridorDoorLinkModal,
    corridorDoorLinkQuery, setCorridorDoorLinkQuery, corridorConnectionModal, setCorridorConnectionModal, wallTypeModal,
    setWallTypeModal, wallTypeDraft, setWallTypeDraft, roomWallTypeModal, setRoomWallTypeModal,
    roomWallTypeSelections, setRoomWallTypeSelections, roomWallPrompt, setRoomWallPrompt,
  } = usePlanModalState();
  usePlanCorridorModalEffects({
    corridorModal, setCorridorNameInput, setCorridorNameEnInput, setCorridorShowNameInput, corridorNameInputRef, corridorDoorLinkModal,
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


  useSyncedRef(zoomRef, zoom);
  const panRef = useRef(pan);
  useSyncedRef(panRef, pan);
  const { dismissSelectionHintToasts, handleMapMouseMove, handleMapMouseDown, getPastePoint } = usePlanPointerHelpers({
    lastPointerClientRef, lastPointerClickRef, mapRef, zoomRef, panRef, selectionHintToastIds,
    selectionToastKeyRef, selectionToastIdRef, deskToastKeyRef, deskToastIdRef, multiToastKeyRef,
    multiToastIdRef, quoteToastKeyRef, quoteToastIdRef, mediaToastKeyRef, mediaToastIdRef
  });
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
    client, site, planId,
    setMeetingStatusByRoomId
  }), [client?.id, planId, site?.id]);

  const {
    addTimelineMeetingManualParticipant, addTimelineMeetingRealParticipant, adjustRoomMeetingEditEndTime, closeRoomMeetingBookingDetail, closeRoomMeetingEditParticipantsModal,
    closeRoomMeetingsTimelineModal, confirmDeleteRoomMeetingBooking, extendRoomMeetingBooking, getMeetingCheckInStats, getRoomMeetingCheckInEntries,
    jumpToTimelineMeetingFromSearch, meetingCheckInEntryKey, openRoomMeetingBookingDetail, openRoomMeetingDuplicateModal, openRoomMeetingEditParticipantsModal,
    openRoomMeetingsTimeline, promptDeleteRoomMeetingBooking, reloadRoomMeetingsTimeline, removeTimelineMeetingParticipant, restoreMyMeetingsFromSnapshot,
    roomMeetingCheckInListOpen, roomMeetingDeleteModal, roomMeetingDetailFocusRef, roomMeetingDuplicateModal, roomMeetingDuplicateRoomPickerOpen,
    roomMeetingDuplicateRoomPickerRef, roomMeetingEditBusinessPartnersModalOpen, roomMeetingEditManualCompanyIsOther, roomMeetingEditParticipantCandidates, roomMeetingEditParticipantsCloseGuardUntilRef,
    roomMeetingEditParticipantsModalOpen, roomMeetingEditParticipantsNameInputRef, roomMeetingExtendBusyId, roomMeetingNotesModalBooking, roomMeetingNotesModalState,
    roomMeetingNotesReturnToMyMeetings, roomMeetingTimelineContextMenu, roomMeetingTimelineContextMenuRef, roomMeetingsTimelineBookingDetail, roomMeetingsTimelineDetailCloseGuardUntilRef,
    roomMeetingsTimelineHighlightBookingId, roomMeetingsTimelineModal, roomMeetingsTimelineScrollRef, roomMeetingsTimelineSearchActiveIndex, roomMeetingsTimelineSearchError,
    roomMeetingsTimelineSearchInputRef, roomMeetingsTimelineSearchLoading, roomMeetingsTimelineSearchResults, roomMeetingsTimelineSearchTerm, saveRoomMeetingBookingEdit,
    saveRoomMeetingDuplicates, setRoomMeetingCheckInListOpen, setRoomMeetingDeleteModal, setRoomMeetingDuplicateModal, setRoomMeetingDuplicateRoomPickerOpen,
    setRoomMeetingEditBusinessPartnersModalOpen, setRoomMeetingEditManualCompanyIsOther, setRoomMeetingNotesModalBooking, setRoomMeetingNotesModalState, setRoomMeetingNotesReturnToMyMeetings,
    setRoomMeetingTimelineContextMenu, setRoomMeetingsTimelineBookingDetail, setRoomMeetingsTimelineModal, setRoomMeetingsTimelineSearchActiveIndex, setRoomMeetingsTimelineSearchError,
    setRoomMeetingsTimelineSearchResults, setRoomMeetingsTimelineSearchTerm, toggleTimelineMeetingParticipantFlag,
  } = useRoomMeetingsTimeline({
    t, push, plan, client, site, planId,
    siteMeetingParticipantCandidates, myMeetingsModal, setMyMeetingsModal, myMeetingsRestoreRef,
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
    wallTypeModal, setWallTypeDraft, roomWallTypeModal, setRoomWallTypeSelections,
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

  const { planAccess, isSuperAdmin, canManageMeetingScheduling, canUseMeetingNotes } = usePlanAccessPermissions({
    user, permissions, planId, site, client
  });

  const meetingLocationLabels = useMemo(() => computeMeetingLocationLabels(allClients), [allClients]);

  const myMeetingsFiltered = useMemo(
    () => computeMyMeetingsFiltered({ myMeetingsModal, myMeetingsSearch, meetingLocationLabels }),
    [meetingLocationLabels, myMeetingsModal?.meetings, myMeetingsSearch]
  );

  const LOCK_TOAST_MS = 5_000;

  const {
    lockState,
    unlockPrompt, setUnlockPrompt, unlockBusy, setUnlockBusy, unlockCompose, setUnlockCompose,
    unlockGrantedPrompt, setUnlockGrantedPrompt,
    forceUnlockConfig, setForceUnlockConfig, forceUnlockGraceMinutes, setForceUnlockGraceMinutes,
    forceUnlockStarting, setForceUnlockStarting, forceUnlockActive, setForceUnlockActive,
    forceUnlockIncoming, setForceUnlockIncoming, forceUnlockExecuteCommand, setForceUnlockExecuteCommand,
    forceUnlockTick, forceUnlockActiveFocusRef, forceUnlockIncomingFocusRef,
    formatPresenceDate, formatPresenceLock, presenceEntries, presenceCount,
    sendWs, requestPlanLock,
    lockRequired, lockedByOther, lockAvailable, isReadOnly,
    isReadOnlyRef, lockMineRef, planIdRefForWs, lastPlanActionSentAtRef, lastPlanDirtySentAtRef, lastPlanDirtyValueRef,
    lockInfoOpen, setLockInfoOpen, lockInfoRef, lockActiveTitle, lockedByTitle, formatMinutes, grantRemainingMinutes
  } = usePlanLockState({
    t, user, planAccess, activeRevision, planId, perfEnabled, pushStack, setLockedPlans, planRef, LOCK_TOAST_MS
  });
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
    safetyCardPos, safetyCardSize, safetyCardFontSize, safetyCardFontIndex, safetyCardColorIndex, safetyCardTextBgIndex,
    handleSafetyCardChange
  } = usePlanSafetyCard({
    planRef, isReadOnlyRef, renderPlan,
    updateFloorPlan
  });
  const basePlan = plan as FloorPlan;
  const {
    renderPlanObjectById, basePlanObjectById, renderPlanRoomById, basePlanRoomById, roomModalBaseRoom, selectedObjects,
    selectedSingleObject,
  } = usePlanObjectIndex({ renderPlan, basePlan, roomModal, selectedObjectIds });
  const planScale = renderPlan?.scale;
  const metersPerPixel = useMemo(() => {
    const value = Number(planScale?.metersPerPixel);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [planScale?.metersPerPixel]);
  const {
    computePolylineLength, computePolygonArea, computeRoomSurfaceSqm, formatCornerLabel, buildRoomPreview, projectPointOnSegment,
    buildRoomWallSegments, getWallPolygonData,
  } = usePlanRoomGeometry({ metersPerPixel, lang, formatNumber, renderPlan, renderPlanObjectById, renderPlanRoomById, isWallType, defaultWallTypeId, t });
  useEffect(() => runResetToolsOnPlanChangeEffect({
    setWallDrawMode, setWallDrawType, setWallDraftPoints, wallDraftPointsRef, wallDraftSegmentIdsRef, setWallDraftPointer,
    setScaleMode, setScaleDraft, setScaleDraftPointer, setScaleModal, setScaleMetersInput, setShowScaleLine, planScale,
    setMeasureMode, setMeasurePoints, setMeasurePointer, setMeasureClosed, setMeasureFinished, setQuoteMode, setQuotePoints,
    setQuotePointer, setScalePromptDismissed
  }), [planId, planScale]);
  const {
    scaleLabel, defaultObjectScale, scaleLine, measureLabel, measureAreaLabel, formatQuoteLabel,
    quoteDraftLabel,
  } = usePlanMeasureScale({
    planScale, lang, formatNumber, renderPlan, lastObjectScale, showScaleLine, measurePoints,
    measurePointer, measureFinished, measureClosed, computePolylineLength, computePolygonArea,
    metersPerPixel, quotePoints, quotePointer
  });

  const rackOverlayLinks = useMemo(() => computeRackOverlayLinks({ renderPlan }), [renderPlan]);

  const rackOverlayById = useMemo(
    () => new Map(rackOverlayLinks.map((link) => [String(link.id), link])),
    [rackOverlayLinks]
  );

  const {
    planLayers, orderedPlanLayers, allItemsLabel, layerIds, nonAllLayerIds, layerIdSet,
    normalizeLayerSelection, getTypeLayerIds, getLayerIdsForType, getObjectLayerIdsForVisibility, visibleLayerIds, hideAllLayers,
    allItemsSelected, effectiveVisibleLayerIds, visibleLayerCount, totalLayerCount, getLayerLabel, getObjectToastLabel,
    promptRevealForObject, getObjectBoundsForAlign, ensureObjectLayerVisible,
  } = usePlanLayerResolution({
    client, t, lang, planId, visibleLayerIdsByPlan, hiddenLayersByPlan, setVisibleLayerIds,
    setHideAllLayers, push, setLayerRevealPrompt, canvasStageRef, inferDefaultLayerIds, getTypeLabel
  });

  const {
    canvasPlan, securityLayerVisible, safetyEmergencyContacts, safetyNumbersInline, safetyPointsInline, quoteLabels,
    getQuoteOrientation,
  } = usePlanRenderDerived({
    allItemsSelected, effectiveVisibleLayerIds, getObjectLayerIdsForVisibility, hideAllLayers,
    rackOverlayLinks, renderPlan, client, planId, site, formatQuoteLabel
  });

  const {
    linksModalObjectName, linksModalRows, linkCreateHint, rackPortsLinkItem, openRackLinkPorts, handleRackPortsRename,
    handleRackPortsNote,
  } = usePlanLinkRackModals({
    linksModalObjectId, renderPlan, objectTypeDefs, lang, linkFromId, isReadOnly, linkCreateMode, t,
    rackPortsLink, setRackPortsLink, rackOverlayById, planId, updateRackItem
  });

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
	  }, [lockMineRef, lastPlanActionSentAtRef, planIdRefForWs, sendWs]);
  const resetTouched = useCallback(() => {
    if (!touchedRef.current) return;
    touchedRef.current = false;
    setTouchedTick((x) => x + 1);
  }, []);
  const alignSelection = useCallback(
    (mode: 'horizontal' | 'vertical', referenceId?: string) =>
      computeAlignSelection(mode, referenceId, {
        getObjectBoundsForAlign, isReadOnly, isWallType, markTouched, moveObject, renderPlan,
        selectedObjects,
        updateObject
      }),
    [getObjectBoundsForAlign, isReadOnly, isWallType, markTouched, moveObject, renderPlan, selectedObjects, updateObject]
  );

  const {
    getPlanSnapshot, getLatestRevisionCached, performUndo,
    performRedo, getPlanUnsavedChanges, canUndo, canRedo, hasNavigationEdits, hasUnsavedUi, latestRev, hasAnyRevision
  } = usePlanHistory({
    plan, planId, markTouched, setFloorPlanContent, baselineSnapshotRef, entrySnapshotRef, touchedRef, setTouchedTick, touchedTick
  });

  const pendingNavigateRef = useRef<string | null>(null);

  const presentationHandlers = usePlanPresentation({
    presentationMode, togglePresentationMode, presentationEnterRequested, clearPresentationEnterRequest
  });

  usePlanDeeplinkEffects({
    location, navigate, planId, isReadOnly, push, t,
    setSelectedObject, triggerHighlight, clearSelection, setSelectedRoomId, setSelectedRoomIds, setHighlightRoom,
    setRevisionsOpen, setPrintAreaMode, setRoomAllocationPreset,
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

  const { revertUnsavedChanges, saveRevisionForUnlock } = usePlanSaveRevisionHandlers({
    plan, getLatestRevisionCached, restoreRevision, baselineSnapshotRef, setFloorPlanContent, planId,
    hasNavigationEdits, hasAnyRevision, latestRev, addRevision, push, t, postAuditEvent, resetTouched,
    entrySnapshotRef, getPlanSnapshot, planRef
  });

  const { handleUnlockResponse, openUnlockCompose, executeForceUnlock } = usePlanLockActions({
    LOCK_TOAST_MS, hasNavigationEdits, plan, planId, push, pushStack, resetTouched, revertUnsavedChanges,
    saveRevisionForUnlock, sendWs, t, getPlanSnapshot, unlockBusy, unlockPrompt, entrySnapshotRef, planRef,
    setUnlockBusy, setUnlockPrompt, user, setUnlockCompose, setForceUnlockIncoming
  });

  const toggleRevisionImmutable = useCallback(
    (revisionId: string, nextValue: boolean) => {
      runToggleRevisionImmutable(revisionId, nextValue, { isSuperAdmin, user, updateRevision, planId, postAuditEvent, push, t });
    },
    [isSuperAdmin, planId, postAuditEvent, push, t, updateRevision, user?.id, user?.username]
  );



  usePlanLockEffects({
    forceUnlockExecuteCommand, setForceUnlockExecuteCommand, executeForceUnlock, user, setUnlockCompose,
    isSuperAdmin, setForceUnlockGraceMinutes, setForceUnlockStarting, setForceUnlockConfig, setPlanDirty,
    planId, hasNavigationEdits, lockRequired, lockState, lastPlanDirtyValueRef, lastPlanDirtySentAtRef, sendWs
  });

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
      pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingPostSaveAction,
      pendingNavigateRef
    });
  }, [pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingPostSaveAction]);
  const {
    contextObject, contextObjectTypeLabel, realUserDetails, realUserDetailsName, contextLink,
    contextObjectLinkCount, hasDefaultView, contextIsMulti, contextIsRack, contextIsDesk,
    contextIsCamera, contextIsWall, contextIsQuote, contextIsWifi, contextIsPhoto,
    contextIsText, contextIsAssemblyPoint, contextAssemblyMapsUrl, contextPhotoMulti, planPhotoIds,
    contextWifiRangeOn, contextWifiRangeScale, contextWifiBaseRadiusM, contextWifiBaseDiameterM, contextWifiBaseAreaSqm,
    contextWifiEffectiveRadiusM, contextWifiEffectiveDiameterM, contextWifiEffectiveAreaSqm, contextWallPolygon, contextQuoteOrientation,
    contextQuoteLabelPos, roomModalInitialSurfaceSqm, roomWallTypeAllValue, canEditWallType, selectionHasRack,
    selectionHasDesk, selectionHasPhoto, selectionPhotoIds, selectedWifiIds, selectionAllRealUsers,
  } = usePlanContextDerived({
    renderPlan, contextMenu, renderPlanObjectById, objectTypeLabels, realUserDetailsId, selectedObjectIds,
    selectedObjects, isDeskType, isWallType, getWallPolygonData, getQuoteOrientation, lastQuoteLabelPosV,
    lastQuoteLabelPosH, roomModal, computeRoomSurfaceSqm, metersPerPixel, roomWallTypeSelections,
    defaultWallTypeId
  });

  usePlanSelectionMenuEffects({
    planRef, renderPlan, selectedObjectIdRef, selectedObjectId, selectedObjectIdsRef, selectedObjectIds,
    contextMenu, renderKeybindToast, selectionHintToastIds, multiToastKeyRef, multiToastIdRef, selectedSingleObject,
    isDeskType, deskToastKeyRef, deskToastIdRef, quoteToastKeyRef, quoteToastIdRef, mediaToastKeyRef,
    mediaToastIdRef, getTypeLabel, t, selectionToastKeyRef, selectionToastIdRef, selectedLinkIdRef,
    selectedLinkId, internalMapOpen, dismissSelectionHintToasts, selectedRoomIdRef, selectedRoomId, selectedCorridorDoor,
    selectedCorridorId, setSelectedCorridorDoor, selectedRoomDoorId, setSelectedRoomDoorId, confirmDeleteRef, confirmDelete,
    pendingRoomDeletesRef, pendingRoomDeletes, wallQuickMenu, setWallQuickMenu, setWallTypeMenu, corridorQuickMenu,
    setCorridorQuickMenu, setAlignMenuOpen, setLayersContextMenu, setMapSubmenu,
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

  const handleStageSelect = usePlanStageSelectHandler({
    addLink, clearSelection, linkCreateMode, linkFromId, markTouched, panToolActive, push, corridorDrawMode,
    roomDrawMode, setPanToolActive, setSelectedObject, t, toggleSelectedObject, isReadOnlyRef, planRef,
    selectedObjectIdsRef, selectedObjectIdRef, setRoomDrawMode, setNewRoomMenuOpen, setCorridorDrawMode,
    setLinkFromId, setCableModal, setSelectedRoomId, setSelectedRoomIds, setSelectedCorridorId,
    setSelectedCorridorDoor, setSelectedRoomDoorId, setCorridorQuickMenu, setSelectedLinkId, setContextMenu
  });



  const { handleCorridorDoorDraftPoint, createRoomDoorFromDraft, startRoomDoorDraft } = usePlanRoomDoorDraftHandlers({
    corridorDoorDraft, defaultDoorCatalogId, markTouched, objectTypeById, push, t,
    updateFloorPlan, isReadOnlyRef, planRef, setSelectedCorridorDoor, setCorridorDoorDraft, setCorridorQuickMenu,
    roomDoorDraft, setRoomDoorDraft, setSelectedRoomDoorId, setContextMenu, getSharedRoomSides,
    renderPlan
  });

  const toggleMapSubmenu = useCallback((section: typeof mapSubmenu) => {
    setMapSubmenu((prev) => (prev === section ? null : section));
  }, []);


  const { openMeetingManager, dispatchOpenClientMeetingsTimeline, openSchedulingFromHub } = usePlanMeetingOpenHandlers({
    client, site, planId, hasNavigationEdits, isReadOnly, canManageMeetingScheduling,
    push, t, setPendingMeetingManagerPreset, setSaveRevisionModalPreset, setSaveRevisionOpen, setMeetingManagerPreset,
    setMeetingManagerOpen,
    setPendingClientMeetingsPreset
  });

  const myMeetingsModalHandlers = usePlanMyMeetingsModal({
    t, setMyMeetingsModal, setMyMeetingsSearch, reloadMyMeetingsRef, myMeetingsRestoreRef, setMeetingHubModalOpen, myMeetingsModal
  });

  const {
    handleWallQuickMenu, handleCorridorQuickMenu, handleObjectContextMenu, handleLinkContextMenu, handleSafetyCardContextMenu, handleRoomContextMenu,
    handleCorridorContextMenu, handleCorridorConnectionContextMenu, handleCorridorDoorContextMenu, handleRoomDoorContextMenu,
    handleScaleContextMenu
  } = usePlanContextMenuHandlers({
    dismissSelectionHintToasts, setContextMenu, roomDoorDraft, createRoomDoorFromDraft, planScale, isRackLinkId,
    isReadOnlyRef, selectedObjectIdsRef, corridorDoorDraft, setWallQuickMenu, setWallTypeMenu,
    setCorridorQuickMenu
  });

  const { handleScaleDoubleClick, handleScaleMove, updateScaleStyle, openScaleEdit } = usePlanScaleHandlers({
    plan, isReadOnly, planScale, markTouched, updateFloorPlan, setContextMenu,
    setScaleActionsOpen, setScaleMode, setScaleDraft, setScaleDraftPointer, setScaleModal, setScaleMetersInput,
    formatNumber
  });

  const { openDuplicate, resolveRoomAssignmentForObject, getCorridorIdAt, updateQuoteLabelPos, computeRoomReassignments } = usePlanObjectMiscHandlers({
    renderPlan, isReadOnly, isDeskType, markTouched, getTypeLabel, inferDefaultLayerIds, layerIdSet,
    addObject, ensureObjectLayerVisible, lastInsertedRef, getRoomIdAt, updateObject, push, t, postAuditEvent,
    setModalState, getQuoteOrientation, setLastQuoteLabelPosH, setLastQuoteLabelPosV
  });

  const handleMapContextMenu = usePlanMapContextMenuHandler({
    clearSelection, createRoomDoorFromDraft, dismissSelectionHintToasts, effectiveVisibleLayerIds, push,
    renderPlan, roomDoorDraft, t, toolMode, zoom, getCorridorIdAt, getRoomIdAt, roomLayerNoticeRef,
    setSelectedRoomDoorId, setSelectedCorridorDoor, setSelectedCorridorId, setSelectedLinkId,
    setSelectedRoomId, setSelectedRoomIds, setContextMenu
  });


  const { openEscapeRouteAt, toggleSecurityCardVisibility } = usePlanSecurityHandlers({
    contextMenu, plan, planId, push, renderPlan,
    siteFloorPlansLength: siteFloorPlans.length,
    t, hideAllLayers, allItemsSelected, nonAllLayerIds, visibleLayerIds, normalizeLayerSelection,
    setEscapeRouteModal, setContextMenu, setHideAllLayers,
    setVisibleLayerIds
  });

  const { applyView, handleSaveView, handleOverwriteView, goToDefaultView } = usePlanViewHandlers({
    renderPlan, plan, isReadOnly, zoom, pan, saveViewport,
    addView, updateView, push, t, setAutoFitEnabled, setZoom,
    setPan, setSelectedViewId,
    setViewsMenuOpen
  });

  useEffect(() => runSearchExportShortcutEffect({ searchInputRef, setExportModalOpen }), []);



  const { copySelection, requestPaste, pasteConfirm, confirmPaste, cancelPaste } = useClipboard({
    t, client, planId, planRef, isReadOnlyRef, inferDefaultLayerIds,
    layerIdSet, addObject, updateObject, ensureObjectLayerVisible, getRoomIdAt, saveCustomValues,
    loadCustomValues, markTouched, push, pushStack, getTypeLabel, setSelection,
    setContextMenu, lastInsertedRef, triggerHighlight,
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

  const { roomMeasuresData, roomLayoutExportRows, roomLayoutExportSource } = usePlanRoomExportDerived({
    computePolygonArea, computePolylineLength, formatCornerLabel, formatNumber, lang, metersPerPixel,
    renderPlan, renderPlanRoomById, roomMeasuresModal, getRoomPolygon, allClients, roomLayoutExportModal
  });

  const roomLayoutExportHandlers = usePlanRoomLayoutExportHandlers({
    roomLayoutExportModal, roomLayoutExportSource, roomLayoutExportRows, push, t, updateRoom, planId,
    markTouched, setPlanDirty, setRoomLayoutExportModal
  });

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

  const { dismissScaleToast, dismissMeasureToast, showMeasureToast } = usePlanMeasureToast({
    scaleToastIdRef, measureToastIdRef, metersPerPixel, lang, formatNumber, computePolylineLength
  });

  const { startScaleMode, cancelScaleMode, handleScalePoint, applyScale, clearScaleNow, requestClearScale, closeScaleModal } = usePlanScaleModeHandlers({
    isReadOnly, scaleMode, scaleDraft, plan, planScale, scaleMetersInput,
    scaleModal, push, t, markTouched, updateFloorPlan, updateRoom,
    dismissScaleToast, resetToolClickHistory, resolveAxisLockedPoint, computeRoomSurfaceSqm, scaleToastIdRef, setScaleMode,
    setScaleDraft, setScaleDraftPointer, setScaleModal, setScaleMetersInput, setRoomDrawMode, setMeasureMode,
    setWallDrawMode, setQuoteMode, setQuotePoints, setQuotePointer, setPendingType, setShowScaleLine,
    setClearScaleConfirmOpen
  });

  const { startWallDraw, finishWallDraw } = usePlanWallDrawToggles({
    isReadOnly, wallDrawMode, wallDrawType, wallTypeDefs, lang, push,
    t, dismissScaleToast, resetToolClickHistory, isWallType, wallDraftPointsRef, wallDraftSegmentIdsRef,
    wallToastIdRef, setWallDrawType, setWallDrawMode, setWallDraftPoints, setWallDraftPointer, setRoomDrawMode,
    setScaleMode, setMeasureMode, setQuoteMode, setQuotePoints, setQuotePointer,
    setPendingType
  });

  const { addWallSegment, wallSnapPoints } = usePlanWallSegments({
    addObject, ensureObjectLayerVisible, inferDefaultLayerIds, layerIdSet, renderPlan, getWallTypeColor, isWallType
  });

  const { resolveWallPoint, splitWallAtPoint } = usePlanWallToolHandlers({
    wallSnapPoints, zoom, wallDraftPointsRef, addWallSegment, deleteObject, getTypeLabel, getWallTypeColor,
    inferDefaultLayerIds, isReadOnly, isWallType, layerIdSet, markTouched, projectPointOnSegment, renderPlan,
    setSelectedObject, lastInsertedRef
  });

  const { handleWallPoint, handleWallDraftContextMenu, handleWallSegmentDblClick } = usePlanWallPointHandlers({
    addWallSegment, finishWallDraw, resolveWallPoint, getTypeLabel, isWallType, markTouched,
    renderPlan, wallDrawMode, wallDrawType, wallTypeDefs, zoom, lang,
    metersPerPixel, push, t, formatNumber, wallDraftPointsRef, wallDraftSegmentIdsRef,
    lastInsertedRef, setWallDraftPoints, setWallDraftPointer,
    setContextMenu
  });

  const { startMeasure, stopMeasure, startQuote, stopQuote } = usePlanMeasureQuoteToggles({
    metersPerPixel, isReadOnly, measureMode, quoteMode, push, t,
    showMeasureToast, dismissMeasureToast, measurePointsRef, measureClosedRef, measureFinishedRef, setMeasureMode,
    setMeasurePoints, setMeasurePointer, setMeasureClosed, setMeasureFinished, setQuoteMode, setQuotePoints,
    setQuotePointer, setRoomDrawMode, setScaleMode, setWallDrawMode,
    setPendingType
  });

  useEffect(() => {
    if (!measureMode) dismissMeasureToast();
  }, [dismissMeasureToast, measureMode]);

  const { handleQuotePoint, convertMeasurementToQuotes } = usePlanQuoteToolHandlers({
    addObject, ensureObjectLayerVisible, getQuoteOrientation, getTypeLabel, inferDefaultLayerIds, isReadOnly,
    lastQuoteColor, lastQuoteDashed, lastQuoteEndpoint, lastQuoteLabelColor, lastQuoteLabelPosH, lastQuoteLabelPosV,
    lastQuoteLabelScale, lastQuoteLabelBg, lastQuoteScale, layerIdSet, markTouched, quoteMode, quotePoints,
    renderPlan, resolveAxisLockedPoint, t, zoom, setQuotePoints, setQuotePointer, dismissMeasureToast, measureMode,
    push, measurePointsRef, measureClosedRef, measureFinishedRef, setMeasureMode, setMeasurePoints, setMeasurePointer,
    setMeasureClosed, setMeasureFinished
  });


  const { handleToolPoint, handleToolMove, handleToolDoubleClick } = usePlanToolPointHandlers({
    measureMode, quoteMode, scaleMode, wallDrawMode, isReadOnly, zoom,
    quotePoints, scaleDraft, resolveAxisLockedPoint, resolveWallPoint, showMeasureToast, handleScalePoint,
    handleWallPoint, handleQuotePoint, measurePointsRef, measureClosedRef, measureFinishedRef, wallDraftPointsRef,
    setMeasurePoints, setMeasurePointer, setMeasureClosed, setMeasureFinished, setScaleDraftPointer, setWallDraftPointer,
    setQuotePointer
  });


  const { applyWallTypeToIds, applyWallType, setRoomWallTypeAt, applyRoomWallTypeAll, createRoomWalls } = usePlanWallTypeHandlers({
    getTypeLabel, isReadOnly, isWallType, markTouched, push, t,
    updateObject, wallTypeModal, wallTypeDraft, setWallTypeModal, setRoomWallTypeSelections, roomWallTypeModal,
    roomWallTypeSelections, addObject, defaultWallTypeId, ensureObjectLayerVisible, inferDefaultLayerIds, layerIdSet,
    renderPlan,
    setRoomWallTypeModal
  });

  const {
    runDeleteShortcut, runTextShortcut, runConfirmDeleteShortcut, runScaleShortcut, runArrowShortcut, runCtrlArrowQuoteShortcut,
    runRotateShortcut, runSaveShortcut, runUndoRedoShortcut, runSelectAllShortcut, runEscapeSelectionShortcut, runBlockingUiShortcut,
    runDraftCancelShortcut,
    runDrawingShortcut
  } = usePlanShortcuts({
      addRevision, cancelScaleMode, clearSelection, convertMeasurementToQuotes, deleteLink, deleteObject,
      entrySnapshotRef, finishWallDraw, getLatestRevisionCached, getPlanSnapshot, getPlanUnsavedChanges, getQuoteOrientation,
      getRevisionVersion, isCameraType, isDeskType, isRackLinkId, lastInsertedRef, markTouched,
      measureClosedRef, measureFinishedRef, measurePointsRef, moveObject, notifyNonPeopleRoomBlocked, performRedo,
      performUndo, planRef, postAuditEvent, push, resetTouched, setConfirmDelete,
      setConfirmDeleteCorridorId, setConfirmDeleteRoomId, setConfirmDeleteRoomIds, setContextMenu, setCorridorConnectionModal, setCorridorDoorDraft,
      setCorridorDoorLinkModal, setCorridorDoorModal, setCorridorDrawMode, setCorridorModal, setLastObjectScale, setLastQuoteScale,
      setLinkFromId, setMeasureClosed, setMeasureFinished, setMeasurePointer, setMeasurePoints, setPendingRoomDeletes,
      setQuotePointer, setQuotePoints, setRoomDoorDraft, setRoomDrawMode, setSaveRevisionModalPreset, setSaveRevisionOpen,
      setSelectedCorridorDoor, setSelectedCorridorId, setSelectedLinkId, setSelectedRoomDoorId, setSelectedRoomId, setSelectedRoomIds,
      setSelection, setUndoConfirm, setWallDraftPointer, setWallDraftPoints, showMeasureToast, startMeasure,
      startQuote, startWallDraw, stopMeasure, stopQuote, t, updateFloorPlan,
      updateObject, updateQuoteLabelPos, updateRoom, wallDraftPointsRef,
      wallDraftSegmentIdsRef
  });


  const {
    objectsByType, counts, isUserObject, getUserObjectLabel, collectUserDepartments, rooms,
    corridors, corridorById, roomDoors,
  } = usePlanCollections({ renderPlan, objectTypeDefs, getTypeLabel, t });

  const canManageLayers = !!user?.isAdmin || isSuperAdmin;

  const { handleSelectType, handleDeleteType, handleOpenTypeLayer, handleCreateTypeLayer } = usePlanTypeLayerHandlers({
    objectsByType, isReadOnly, canManageLayers, client, getTypeLayerIds, inferDefaultLayerIds,
    layerIdSet, markTouched, planLayers, push, setPlanDirty, t,
    typeLayerColor, typeLayerModal, typeLayerName, updateClientLayers, setSelection, setCountsOpen,
    setTypeMenu, setConfirmDelete,
    setTypeLayerModal
  });


  usePlanHelpToastEffects({
    t, isReadOnly, selectedCorridorId, corridorById, corridorDrawMode, roomDrawMode,
    selectedRoomId
  });

  const paletteFavorites = useAuthStore((s) => (s.user as any)?.paletteFavorites) as string[] | undefined;
  const {
    paletteOrder, paletteHasCustom, paletteIsEmpty, paletteHasMore, deskPaletteDefs, deskPaletteOrder,
    securityPaletteDefs, otherPaletteDefs,
  } = usePlanPaletteDefs({ paletteFavorites, objectTypeDefs, isWallType, isDoorType });
  const [paletteSection, setPaletteSection] = useState<'desks' | 'objects' | 'security'>('objects');
  const [annotationsOpen, setAnnotationsOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [desksOpen, setDesksOpen] = useState(false);
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  usePlanPaletteSectionEffects({
    paletteSection, setPaletteSection, deskPaletteDefs, otherPaletteDefs, securityPaletteDefs, setDesksOpen,
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

  const { roomStatsById, corridorDoorLinkRoomEntries } = usePlanRoomStats({
    renderPlan, isUserObject, corridorDoorLinkModal, corridorDoorLinkQuery, getUserObjectLabel, lang
  });

  const {
    capacityConfirm, setCapacityConfirm, capacityConfirmRef, capacityDashboardOpen, setCapacityDashboardOpen, capacityDashboardPreset,
    setCapacityDashboardPreset,
    shouldConfirmCapacity
  } = usePlanCapacity({
    t, push, planId, plan, location, navigate,
    rooms, roomStatsById, roomCapacityStateByPlan, setRoomCapacityState, getRoomIdAt,
    notifyNonPeopleRoomBlocked
  });

  const handleStageMoveStart = useCallback((id: string, x: number, y: number, roomId?: string) => {
    dragStartRef.current.set(id, { x, y, roomId });
  }, []);

  const moveHandlers = usePlanMoveHandlers({
    collectUserDepartments, getUserObjectLabel, markTouched, moveObject, notifyNonPeopleRoomBlocked,
    resolveRoomAssignmentForObject, roomStatsById, t, updateObject, isReadOnlyRef, planRef, dragStartRef,
    getRoomIdAt, isUserType, setCapacityConfirm, setRoomDepartmentConfirm, wallMoveBatchRef
  });

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
    countsOpen, setObjectListQuery, setExpandedType, setTypeMenu, typeMenu, typeMenuRef,
    typeLayerModal, setTypeLayerName, setTypeLayerColor, typeLayerNameRef, presenceOpen, presenceRef,
    setPresenceOpen, layersPopoverOpen, layersPopoverRef, setLayersPopoverOpen, layersQuickMenu, layersQuickMenuRef,
    setLayersQuickMenu, roomsOpen, setExpandedRoomId,
    setNewRoomMenuOpen
  });

  useEffect(() => {
    if (!user) return;
    const normalized = normalizeVisibleLayerIdsByPlan((user as any)?.visibleLayerIdsByPlan || {});
    layerVisibilitySyncRef.current = JSON.stringify(normalized);
  }, [normalizeVisibleLayerIdsByPlan, user]);

  useEffect(() => runLayerVisibilitySyncEffect({ user, normalizeVisibleLayerIdsByPlan, visibleLayerIdsByPlan, layerVisibilitySyncRef }),
    [normalizeVisibleLayerIdsByPlan, user, visibleLayerIdsByPlan]);

  const roomDrawHandlers = usePlanRoomDrawHandlers({
    isReadOnly, setPendingType, setRoomDrawMode, setRoomsOpen, setContextMenu, push, t, setCorridorDoorDraft,
    setCorridorQuickMenu, setCorridorDrawMode, rooms, setRoomModal, plan, hasRoomOverlap, notifyRoomOverlap
  });

  const { openEditCorridor, handleCreateCorridorFromPoly, saveCorridorModal, updateCorridorLabelScale } = usePlanCorridorNameHandlers({
    corridorById, isReadOnly, plan, t, setCorridorDrawMode, corridorModal,
    corridorNameInput, corridorNameEnInput, corridorShowNameInput, markTouched, push, updateFloorPlan,
    setSelectedCorridorId, setCorridorModal, setCorridorNameInput, setCorridorNameEnInput,
    setCorridorShowNameInput
  });

  const {
    openCorridorDoorModal, openRoomDoorModal, openCorridorDoorLinkModal, saveCorridorDoorModal,
    saveCorridorDoorLinkModal
  } = usePlanDoorModalHandlers({
    corridorById, defaultDoorCatalogId, doorTypeIdSet, objectTypeById, setCorridorDoorModal, roomDoors,
    getCorridorEdgePoint, normalizeLayerSelection, planId, renderPlan, setHideAllLayers, setVisibleLayerIds,
    visibleLayerIds, setCorridorDoorLinkModal, setCorridorDoorLinkQuery, corridorDoorModal, corridorDoorLinkModal, isReadOnly,
    markTouched, plan, push, t,
    updateFloorPlan
  });


  useEffect(() => runCorridorShortcutEffect({ selectedCorridorId, isReadOnly, openEditCorridor, updateCorridorLabelScale }),
    [isReadOnly, openEditCorridor, selectedCorridorId, updateCorridorLabelScale]);

  const {
    startCorridorDoorDraw, insertCorridorJunctionPoint, openCorridorConnectionModalAt, openEditCorridorConnectionModal,
    saveCorridorConnectionModal
  } = usePlanCorridorConnectionHandlers({
    isReadOnly, push, t, markTouched, plan, updateFloorPlan,
    corridorById, corridorConnectionModal, getClosestCorridorEdge, getCorridorPolygon, getCorridorEdgePoint, setCorridorDoorDraft,
    setCorridorQuickMenu, setSelectedCorridorDoor, setSelectedCorridorId,
    setCorridorConnectionModal
  });

  const wallGroupHandlers = usePlanWallGroupHandlers({
    buildRoomWallSegments, setRoomWallTypeModal, getWallPolygonData, roomModal, renderPlan, renderPlanRoomById, t, setRoomModal
  });

  const { proceedPlaceUser } = usePlanRealUserPlacement({
    isReadOnly, setPendingType, client, setRealUserImportMissing, setRealUserPicker, setModalState
  });

  const objectCreateHandlers = usePlanObjectCreateHandlers({
    isReadOnly, panToolActive, setPanToolActive, shouldConfirmCapacity, proceedPlaceUser, isDeskType,
    plan, markTouched, getTypeLabel, addObject, defaultObjectScale, ensureObjectLayerVisible,
    lastInsertedRef, getRoomIdAt, updateObject, push, t, postAuditEvent, setModalState, setPendingType,
    modalState, lastQuoteLabelPosH, lastQuoteLabelBg, isCameraType, lastQuoteColor, lastQuoteLabelScale,
    lastQuoteLabelColor, lastQuoteDashed, lastQuoteEndpoint, getTypeLayerIds, inferDefaultLayerIds,
    layerIdSet, setLastQuoteScale, setLastQuoteColor, setLastQuoteLabelScale, setLastQuoteLabelBg,
    setLastQuoteLabelColor, setLastQuoteLabelPosH, setLastQuoteLabelPosV, setLastQuoteDashed,
    setLastQuoteEndpoint, setLastObjectScale, resolveRoomAssignmentForObject, isUserType,
    notifyNonPeopleRoomBlocked, saveCustomValues, getQuoteOrientation, planId
  });

  const { handleEdit, openEditFromSelectionList, openLinkEditFromSelectionList } = usePlanEditOpenHandlers({
    renderPlan, renderPlanObjectById, isDeskType, isWallType,
    openWallGroupModal: wallGroupHandlers.openWallGroupModal,
    returnToSelectionListRef, setRackModal, setWallTypeModal, setModalState, setSelectedObjectsModalOpen,
    setLinkEditId
  });

  const { openPhotoViewer, openImageViewer, focusPhotoFromGallery } = usePlanMediaViewerHandlers({
    renderPlan, renderPlanObjectById, push, t, setPhotoViewer, returnToBulkEditRef,
    triggerHighlight, setSelection, setSelectedObject, setSelectedRoomId, setSelectedRoomIds,
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
    client, dataVersion, clientSearchIndexRef, renderPlan, plan, isDeskType,
    searchDebugEnabled, renderPlanObjectById, basePlanObjectById, renderPlanRoomById, basePlanRoomById, push,
    t, clearSelection, promptRevealForObject, triggerHighlight, setSearchResultsOpen, setSearchResultsTerm,
    setSearchResultsObjects, setSearchResultsRooms, setCrossPlanSearchOpen, setCrossPlanSearchTerm, setSelectedRoomId, setSelectedRoomIds,
    setHighlightRoom, setCrossPlanResults,
    setSelectedObject
  });

  const modalInitials = usePlanModalInitials({
    modalState, renderPlan, renderPlanObjectById, layerIdSet, defaultObjectScale, getTypeLayerIds,
    inferDefaultLayerIds, formatQuoteLabel, lastQuoteLabelScale, lastQuoteLabelBg, lastQuoteLabelPosH,
    lastQuoteDashed, lastQuoteEndpoint, lastQuoteColor, lastQuoteLabelColor
  });

  const {
    assignedCounts, canOpenBusinessPartnersDirectory, orderedViews, showPrintArea, corridorConnectionTargetPlans, linksInSelection,
    getObjectNameById,
  } = usePlanMiscDerived({
    client, isSuperAdmin, user, basePlan, showPrintAreaByPlan, site, planId, selectedObjectIds,
    selectionAllRealUsers, selectedLinkId, renderPlanObjectById
  });

  usePlanKeydownEffect({
    confirmDeleteRef, selectedObjectIdsRef, planRef, isReadOnlyRef, selectedObjectIdRef, selectedLinkIdRef,
    selectedRoomIdRef, zoomRef, allTypesOpen, corridorModal, corridorConnectionModal, corridorDoorModal,
    corridorDoorLinkModal, roomDrawMode, corridorDrawMode, corridorDoorDraft, roomDoorDraft, linkFromId,
    roomCatalogOpen, scaleMode, wallDrawMode, measureMode, quoteMode, saveRevisionOpen,
    photoViewer, selectedRoomId, selectedRoomIds, selectedCorridorId, selectedCorridorDoor, selectedRoomDoorId,
    copySelection, requestPaste, handleEdit, openEditRoom: roomDrawHandlers.openEditRoom, getRoomIdAt, resolveRoomAssignmentForObject,
    isDeskType, isRackLinkId, isUserType, isWallType, push, t,
    setLinkEditId, setContextMenu, setPendingType, setRoomDrawMode, setRoomsOpen, setNewRoomMenuOpen,
    setRoomCatalogOpen, setCorridorDrawMode, setAllTypesDefaultTab, setAllTypesOpen, runBlockingUiShortcut, runDrawingShortcut,
    runDraftCancelShortcut, runConfirmDeleteShortcut, runCtrlArrowQuoteShortcut, runRotateShortcut, runSaveShortcut, runScaleShortcut,
    runTextShortcut, runUndoRedoShortcut, runSelectAllShortcut, runEscapeSelectionShortcut, runArrowShortcut, runDeleteShortcut,
    addRevision, addLink, cancelScaleMode, clearSelection, convertMeasurementToQuotes, deleteLink,
    deleteObject, finishWallDraw, getPlanUnsavedChanges, getLatestRevisionCached, getQuoteOrientation, markTouched,
    moveObject, notifyNonPeopleRoomBlocked, performRedo, performUndo, postAuditEvent, resetTouched,
    setConfirmDeleteCorridorId, setCorridorDoorDraft, setCorridorModal, setCorridorConnectionModal, setCorridorDoorLinkModal, setCorridorDoorModal,
    setSelection, setSelectedCorridorId, setSelectedCorridorDoor, startQuote, startWallDraw, stopMeasure,
    stopQuote, showMeasureToast, getPlanSnapshot, updateFloorPlan, updateObject, updateRoom,
    updateQuoteLabelPos,
  });

  return {
    ...wallGroupHandlers, ...roomDrawHandlers, ...myMeetingsModalHandlers, ...objectCreateHandlers, ...moveHandlers, ...presentationHandlers, ...roomLayoutExportHandlers, LOCK_TOAST_MS,
    activeRevision, addLink, addObject, addRackLink, addRevision, addRoom, addTimelineMeetingManualParticipant, addTimelineMeetingRealParticipant,
    addTypeToPalette, adjustRoomMeetingEditEndTime, alignMenuOpen, alignSelection, allClients, allItemsLabel, allItemsSelected, allTypesDefaultTab,
    allTypesOpen, annotationsOpen, applyRoomWallTypeAll, applyScale, applyView, applyWallType, applyWallTypeToIds, assignedCounts,
    autoFitEnabled, basePlan, bulkEditOpen, bulkEditSelectionOpen, cableModal, canEditWallType, canManageLayers, canManageMeetingScheduling,
    canOpenBusinessPartnersDirectory, canRedo, canUndo, canUseMeetingNotes, cancelPaste, cancelScaleMode, canvasPlan, canvasStageRef,
    capacityConfirm, capacityConfirmRef, capacityDashboardOpen, capacityDashboardPreset, chooseDefaultModal, clearObjects, clearPendingPostSaveAction, clearPendingSaveNavigate,
    clearRevisions, clearScaleConfirmOpen, clearScaleNow, clearSelection, client, clientBusinessPartnerNames, closeReturnToSelectionList, closeRoomMeetingBookingDetail,
    closeRoomMeetingEditParticipantsModal, closeRoomMeetingsTimelineModal, closeScaleModal, computeRoomReassignments, computeRoomSurfaceSqm, confirmClearObjects, confirmDelete, confirmDeleteCorridorId,
    confirmDeleteRoomId, confirmDeleteRoomIds, confirmDeleteRoomMeetingBooking, confirmDeleteViewId, confirmPaste, confirmSetDefaultViewId, contextAssemblyMapsUrl, contextIsAssemblyPoint,
    contextIsCamera, contextIsDesk, contextIsMulti, contextIsPhoto, contextIsQuote, contextIsRack, contextIsText, contextIsWall,
    contextIsWifi, contextLink, contextMenu, contextMenuRef, contextObject, contextObjectLinkCount, contextObjectTypeLabel, contextPhotoMulti,
    contextQuoteLabelPos, contextQuoteOrientation, contextWallPolygon, contextWifiBaseAreaSqm, contextWifiBaseDiameterM, contextWifiBaseRadiusM, contextWifiEffectiveAreaSqm, contextWifiEffectiveDiameterM,
    contextWifiEffectiveRadiusM, contextWifiRangeOn, contextWifiRangeScale, corridorById, corridorConnectionModal, corridorConnectionTargetPlans, corridorDoorDraft, corridorDoorLinkModal,
    corridorDoorLinkQuery, corridorDoorLinkRoomEntries, corridorDoorModal, corridorDrawMode, corridorModal, corridorNameEnInput, corridorNameInput, corridorNameInputRef,
    corridorQuickMenu, corridorShowNameInput, corridors, counts, countsOpen, createRoomDoorFromDraft, createRoomWalls, crossPlanResults,
    crossPlanSearchOpen, crossPlanSearchTerm, defaultObjectScale, defaultWallTypeId, deleteLink, deleteObject, deleteRackLink, deleteRevision,
    deleteRoom, deleteView, deskCatalogDefs, deskCatalogOpen, deskPaletteDefs, deskPaletteOrder, desksOpen, dismissSelectionHintToasts,
    dispatchOpenClientMeetingsTimeline, dragStartRef, effectiveVisibleLayerIds, emergencyContactsOpen, ensureObjectLayerVisible, entrySnapshotRef, escapeRouteModal, executeForceUnlock,
    expandedRoomId, expandedType, exportModalOpen, extendRoomMeetingBooking, focusPhotoFromGallery, forceUnlockActive, forceUnlockActiveFocusRef, forceUnlockConfig,
    forceUnlockGraceMinutes, forceUnlockIncoming, forceUnlockIncomingFocusRef, forceUnlockStarting, forceUnlockTick, formatMinutes, formatPresenceDate, formatPresenceLock,
    getCorridorPolygon, getLayerIdsForType, getLayerLabel, getLayerNote, getMeetingCheckInStats, getObjectNameById, getObjectToastLabel, getPlanSnapshot,
    getRoomIdAt, getRoomMeetingCheckInEntries, getSubmenuStyle, getTypeIcon, getTypeLabel, goToDefaultView, grantRemainingMinutes, gridMenuOpen,
    gridMenuRef, gridSize, gridSnapEnabled, handleCorridorConnectionContextMenu, handleCorridorContextMenu, handleCorridorDoorContextMenu, handleCorridorDoorDraftPoint, handleCorridorQuickMenu,
    handleCreateCorridorFromPoly, handleCreateTypeLayer, handleDeleteType, handleEdit, handleLinkContextMenu, handleMapContextMenu, handleMapMouseDown, handleMapMouseMove,
    handleObjectContextMenu, handleOpenTypeLayer, handleOverwriteView, handlePanChange, handleRackPortsNote, handleRackPortsRename, handleRoomContextMenu, handleRoomDoorContextMenu,
    handleSafetyCardChange, handleSafetyCardContextMenu, handleSaveView, handleScaleContextMenu, handleScaleDoubleClick, handleScaleMove, handleSearch, handleSearchEnter,
    handleSelectType, handleStageMoveStart, handleStageSelect, handleToolDoubleClick, handleToolMove, handleToolPoint, handleUnlockResponse, handleWallDraftContextMenu,
    handleWallQuickMenu, handleWallSegmentDblClick, handleZoomChange, hasAnyRevision, hasDefaultView, hasNavigationEdits, hasRoomOverlap, hasUnsavedUi,
    hideAllLayers, highlight, highlightRoom, hmToMinutes, insertCorridorJunctionPoint, internalMapOpen, isPointInRoom, isReadOnly,
    isSuperAdmin, isUserObject, isWallType, jumpToTimelineMeetingFromSearch, lang, lastInsertedRef, lastQuoteColor, latestRev,
    layerIds, layerRevealPrompt, layersContextMenu, layersContextMenuRef, layersOpen, layersPopoverOpen, layersPopoverRef, layersQuickMenu,
    layersQuickMenuRef, linkCreateHint, linkEditId, linksInSelection, linksModalObjectId, linksModalObjectName, linksModalRows, lockActiveTitle,
    lockAvailable, lockInfoOpen, lockInfoRef, lockRequired, lockState, lockedByOther, lockedByTitle, mapRef,
    mapSubmenu, markTouched, measureAreaLabel, measureClosed, measureLabel, measurePointer, measurePoints, meetingCheckInEntryKey,
    meetingClockFromTs, meetingHubFocusRef, meetingHubModalOpen, meetingIsoDayFromTs, meetingLocationLabels, meetingManagerOpen, meetingManagerPreset, meetingStatusByRoomId,
    metersPerPixel, modalInitials, modalState, monthAnchorFromIso, moveObject, myMeetingsCheckInBusyId, myMeetingsCheckInDoneById, myMeetingsFiltered,
    myMeetingsFocusRef, myMeetingsModal, myMeetingsRestoreRef, myMeetingsSearch, navigate, newRoomMenuOpen, normalizeLayerSelection, notifyNonPeopleRoomBlocked,
    notifyRoomOverlap, objectListMatches, objectListQuery, objectTypeDefs, objectTypeIcons, objectTypeLabels, objectsByType, objectsOpen,
    openCorridorConnectionModalAt, openCorridorDoorLinkModal, openCorridorDoorModal, openDuplicate, openEditCorridor, openEditCorridorConnectionModal, openEditFromSelectionList, openEscapeRouteAt,
    openImageViewer, openLinkEditFromSelectionList, openMeetingManager, openPhotoViewer, openRackLinkPorts, openRoomDoorModal, openRoomMeetingBookingDetail, openRoomMeetingDuplicateModal,
    openRoomMeetingEditParticipantsModal, openRoomMeetingsTimeline, openScaleEdit, openSchedulingFromHub, openUnlockCompose, orderedPlanLayers, orderedViews, otherPaletteDefs,
    overlapNotice, paletteHasCustom, paletteHasMore, paletteIsEmpty, paletteOrder, paletteSettingsSection, pan, panToolActive,
    pasteConfirm, pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingNavigateRef, pendingPostSaveAction, pendingRoomDeletesRef, pendingType, perfEnabled,
    performPendingPostSaveAction, performRedo, performUndo, permissions, photoViewer, plan, planAccess, planId,
    planLayers, planPhotoIds, planRef, planScale, presenceCount, presenceEntries, presenceOpen, presenceRef,
    presentationMode, printAreaMode, proceedPlaceUser, promptDeleteRoomMeetingBooking, promptRevealForObject, push, pushStack, quoteDraftLabel,
    quoteLabels, quotePointer, quotePoints, rackModal, rackOverlayById, rackPortsLink, rackPortsLinkItem, realUserDetails,
    realUserDetailsId, realUserDetailsName, realUserImportMissing, realUserPicker, reloadRoomMeetingsTimeline, removeTimelineMeetingParticipant, removeTypeFromPalette, renderPlan,
    renderPlanObjectById, requestClearScale, requestPlanLock, requestSaveAndNavigate, resetTouched, resolveRoomAssignmentForObject, restoreMyMeetingsFromSnapshot, restoreRevision,
    returnToBulkEditRef, returnToSelectionListRef, revertUnsavedChanges, revisionsOpen, roomAllocationOpen, roomAllocationPreset, roomCatalogOpen, roomDepartmentConfirm,
    roomDepartmentOptions, roomDoorDraft, roomDoors, roomDrawMode, roomHasWalls, roomKioskInfoLink, roomKioskInfoModal, roomKioskInfoQrDataUrl,
    roomLayoutExportModal, roomLayoutExportRows, roomLayoutExportSource, roomMeasuresData, roomMeasuresModal, roomMeetingCheckInListOpen, roomMeetingDeleteModal, roomMeetingDetailFocusRef,
    roomMeetingDuplicateModal, roomMeetingDuplicateRoomPickerOpen, roomMeetingDuplicateRoomPickerRef, roomMeetingEditBusinessPartnersModalOpen, roomMeetingEditManualCompanyIsOther, roomMeetingEditParticipantCandidates, roomMeetingEditParticipantsCloseGuardUntilRef, roomMeetingEditParticipantsModalOpen,
    roomMeetingEditParticipantsNameInputRef, roomMeetingExtendBusyId, roomMeetingNotesModalBooking, roomMeetingNotesModalState, roomMeetingNotesReturnToMyMeetings, roomMeetingTimelineContextMenu, roomMeetingTimelineContextMenuRef, roomMeetingsTimelineBookingDetail,
    roomMeetingsTimelineDetailCloseGuardUntilRef, roomMeetingsTimelineHighlightBookingId, roomMeetingsTimelineModal, roomMeetingsTimelineScrollRef, roomMeetingsTimelineSearchActiveIndex, roomMeetingsTimelineSearchError, roomMeetingsTimelineSearchInputRef, roomMeetingsTimelineSearchLoading,
    roomMeetingsTimelineSearchResults, roomMeetingsTimelineSearchTerm, roomModal, roomModalBaseRoom, roomModalInitialSurfaceSqm, roomModalMetrics, roomModalPreview, roomStatsById,
    roomWallPreview, roomWallPrompt, roomWallTypeAllValue, roomWallTypeModal, roomWallTypeSelections, rooms, roomsOpen, safetyCardColorIndex,
    safetyCardFontIndex, safetyCardFontSize, safetyCardPos, safetyCardSize, safetyCardTextBgIndex, safetyEmergencyContacts, safetyNumbersInline, safetyPointsInline,
    saveCorridorConnectionModal, saveCorridorDoorLinkModal, saveCorridorDoorModal, saveCorridorModal, saveRevisionModalPreset, saveRevisionOpen, saveRevisionReason, saveRoomMeetingBookingEdit,
    saveRoomMeetingDuplicates, scaleActionsOpen, scaleDraft, scaleDraftPointer, scaleLabel, scaleLine, scaleMetersInput, scaleModal,
    scaleMode, scalePromptDismissed, searchInputRef, searchResultsObjects, searchResultsOpen, searchResultsRooms, searchResultsTerm, securityLayerVisible,
    securityOpen, securityPaletteDefs, selectedCorridorDoor, selectedCorridorId, selectedLinkId, selectedObjectId, selectedObjectIds, selectedObjects,
    selectedObjectsModalOpen, selectedRevisionId, selectedRoomDoorId, selectedRoomId, selectedRoomIds, selectedViewId, selectedWifiIds, selectionHasDesk,
    selectionHasPhoto, selectionHasRack, selectionPhotoIds, sendWs, setAlignMenuOpen, setAllTypesDefaultTab, setAllTypesOpen, setAnnotationsOpen,
    setBulkEditOpen, setBulkEditSelectionOpen, setCableModal, setCapacityConfirm, setCapacityDashboardOpen, setCapacityDashboardPreset, setChooseDefaultModal, setClearScaleConfirmOpen,
    setConfirmClearObjects, setConfirmDelete, setConfirmDeleteCorridorId, setConfirmDeleteRoomId, setConfirmDeleteRoomIds, setConfirmDeleteViewId, setConfirmSetDefaultViewId, setContextMenu,
    setCorridorConnectionModal, setCorridorDoorDraft, setCorridorDoorLinkModal, setCorridorDoorLinkQuery, setCorridorDoorModal, setCorridorModal, setCorridorNameEnInput, setCorridorNameInput,
    setCorridorQuickMenu, setCorridorShowNameInput, setCountsOpen, setCrossPlanResults, setCrossPlanSearchOpen, setCrossPlanSearchTerm, setDefaultView, setDeskCatalogOpen,
    setDesksOpen, setEmergencyContactsOpen, setEscapeRouteModal, setExpandedRoomId, setExpandedType, setExportModalOpen, setForceUnlockActive, setForceUnlockConfig,
    setForceUnlockGraceMinutes, setForceUnlockStarting, setGridMenuOpen, setGridSize, setGridSnapEnabled, setHideAllLayers, setHighlightRoom, setInternalMapOpen,
    setLastObjectScale, setLastQuoteColor, setLastQuoteScale, setLayerRevealPrompt, setLayersContextMenu, setLayersOpen, setLayersPopoverOpen, setLayersQuickMenu,
    setLinkCreateMode, setLinkEditId, setLinkFromId, setLinksModalObjectId, setLockInfoOpen, setMeasureMode, setMeetingHubModalOpen, setMeetingManagerOpen,
    setMeetingManagerPreset, setMeetingStatusByRoomId, setModalState, setMyMeetingsCheckInBusyId, setMyMeetingsCheckInDoneById, setMyMeetingsModal, setMyMeetingsSearch, setNewRoomMenuOpen,
    setObjectListQuery, setObjectRoomIds, setObjectsOpen, setOverlapNotice, setPaletteSection, setPanToolActive, setPendingClientMeetingsPreset, setPendingMeetingManagerPreset,
    setPendingRoomDeletes, setPendingType, setPhotoViewer, setPresenceOpen, setPrintAreaMode, setRackModal, setRackPortsLink, setRealUserDetailsId,
    setRealUserImportMissing, setRealUserPicker, setRevisionsOpen, setRoomAllocationOpen, setRoomAllocationPreset, setRoomCatalogOpen, setRoomDepartmentConfirm, setRoomDrawMode,
    setRoomKioskInfoModal, setRoomLayoutExportModal, setRoomMeasuresModal, setRoomMeetingCheckInListOpen, setRoomMeetingDeleteModal, setRoomMeetingDuplicateModal, setRoomMeetingDuplicateRoomPickerOpen, setRoomMeetingEditBusinessPartnersModalOpen,
    setRoomMeetingEditManualCompanyIsOther, setRoomMeetingNotesModalBooking, setRoomMeetingNotesModalState, setRoomMeetingNotesReturnToMyMeetings, setRoomMeetingTimelineContextMenu, setRoomMeetingsTimelineBookingDetail, setRoomMeetingsTimelineModal, setRoomMeetingsTimelineSearchActiveIndex,
    setRoomMeetingsTimelineSearchError, setRoomMeetingsTimelineSearchResults, setRoomMeetingsTimelineSearchTerm, setRoomModal, setRoomWallPrompt, setRoomWallTypeAt, setRoomWallTypeModal, setRoomsOpen,
    setSaveRevisionModalPreset, setSaveRevisionOpen, setScaleActionsOpen, setScaleMetersInput, setScaleMode, setScalePromptDismissed, setSearchResultsObjects, setSearchResultsOpen,
    setSearchResultsRooms, setSecurityOpen, setSelectedCorridorDoor, setSelectedCorridorId, setSelectedLinkId, setSelectedObject, setSelectedObjectsModalOpen, setSelectedPlan,
    setSelectedRevision, setSelectedRoomDoorId, setSelectedRoomId, setSelectedRoomIds, setSelectedViewId, setSelection, setShowGrid, setShowScaleLine,
    setTypeLayerColor, setTypeLayerModal, setTypeLayerName, setTypeMenu, setUndoConfirm, setUnlockCompose, setUnlockGrantedPrompt, setUnlockPrompt,
    setViewModalOpen, setViewsMenuOpen, setVisibleLayerIds, setWallCatalogOpen, setWallDrawMode, setWallQuickMenu, setWallTypeDraft, setWallTypeMenu,
    setWallTypeModal, shiftIsoDay, shiftMonthAnchor, showGrid, showPrintArea, site, siteFloorPlans, skipRoomWallTypesRef,
    splitWallAtPoint, startCorridorDoorDraw, startMeasure, startQuote, startRoomDoorDraft, startScaleMode, startWallDraw, t,
    toggleMapSubmenu, toggleRevisionImmutable, toggleSecurityCardVisibility, toggleShowPrintArea, toggleTimelineMeetingParticipantFlag, toolMode, totalLayerCount, triggerHighlight,
    typeLayerColor, typeLayerModal, typeLayerName, typeLayerNameRef, typeMenu, typeMenuRef, undoConfirm, unlockBusy,
    unlockCompose, unlockGrantedPrompt, unlockPrompt, updateClient, updateCorridorLabelScale, updateFloorPlan, updateLink, updateObject,
    updateQuoteLabelPos, updateRoom, updateScaleStyle, user, viewModalOpen, viewsMenuOpen, visibleLayerCount, visibleLayerIds,
    wallAttenuationByType, wallCatalogOpen, wallDraftPointer, wallDraftPoints, wallDrawMode, wallDrawType, wallQuickMenu, wallTypeDefs,
    wallTypeDraft, wallTypeIdSet, wallTypeMenu, wallTypeModal, zoom,
  };
};
