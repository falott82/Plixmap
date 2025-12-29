import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  LayoutGrid,
  HelpCircle,
  Trash,
  Copy,
  MoveDiagonal,
  Square,
  X,
  Pencil,
  Star,
  BookmarkPlus,
  Plus,
  FileDown,
  Crop,
  Home,
  History,
  Save,
  Cog,
  EyeOff,
  CornerDownRight,
  Link2,
  User,
  LocateFixed,
  Users,
  Activity
} from 'lucide-react';
import Toolbar from './Toolbar';
import CanvasStage, { CanvasStageHandle } from './CanvasStage';
import SearchBar from './SearchBar';
import ExportButton from './ExportButton';
import ObjectModal from './ObjectModal';
import RoomAllocationModal from './RoomAllocationModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { FloorPlan, FloorPlanView, MapObject, MapObjectType, PlanLink } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useToastStore } from '../../store/useToast';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import VersionBadge from '../ui/VersionBadge';
import UserMenu from '../layout/UserMenu';
import ViewModal from './ViewModal';
import SearchResultsModal from './SearchResultsModal';
import ChooseDefaultViewModal from './ChooseDefaultViewModal';
import Icon from '../ui/Icon';
import RevisionsModal from './RevisionsModal';
import SaveRevisionModal from './SaveRevisionModal';
import RoomModal from './RoomModal';
import BulkEditDescriptionModal from './BulkEditDescriptionModal';
import BulkEditSelectionModal from './BulkEditSelectionModal';
import SelectedObjectsModal from './SelectedObjectsModal';
import RealUserPickerModal from './RealUserPickerModal';
import PrintModal from './PrintModal';
import CrossPlanSearchModal, { CrossPlanSearchResult } from './CrossPlanSearchModal';
import AllObjectTypesModal from './AllObjectTypesModal';
import CableModal from './CableModal';
import LinksModal from './LinksModal';
import LinkEditModal from './LinkEditModal';
import RealUserDetailsModal from './RealUserDetailsModal';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang, useT } from '../../i18n/useT';
import { shallow } from 'zustand/shallow';
import { postAuditEvent } from '../../api/audit';
import { hasExternalUsers } from '../../api/customImport';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { perfMetrics } from '../../utils/perfMetrics';

interface Props {
  planId: string;
}

const PlanView = ({ planId }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasStageRef = useRef<CanvasStageHandle | null>(null);
  const t = useT();
  const lang = useLang();
  const [autoFitEnabled, setAutoFitEnabled] = useState(true);
  const {
    addObject,
    updateObject,
    deleteObject,
    updateFloorPlan,
    setFloorPlanContent,
    addView,
    deleteView,
    setDefaultView,
    clearObjects,
    setObjectRoomIds,
    addRoom,
    updateRoom,
    deleteRoom,
    addRevision,
    restoreRevision,
    deleteRevision,
    clearRevisions,
    addLink,
    deleteLink,
    updateLink
  } = useDataStore(
    (s) => ({
      addObject: s.addObject,
      updateObject: s.updateObject,
      deleteObject: s.deleteObject,
      updateFloorPlan: s.updateFloorPlan,
      setFloorPlanContent: s.setFloorPlanContent,
      addView: s.addView,
      deleteView: s.deleteView,
      setDefaultView: s.setDefaultView,
      clearObjects: s.clearObjects,
      setObjectRoomIds: s.setObjectRoomIds,
      addRoom: s.addRoom,
      updateRoom: s.updateRoom,
      deleteRoom: s.deleteRoom,
      addRevision: s.addRevision,
      restoreRevision: (s as any).restoreRevision,
      deleteRevision: s.deleteRevision,
      clearRevisions: s.clearRevisions,
	      addLink: (s as any).addLink,
	      deleteLink: (s as any).deleteLink,
        updateLink: (s as any).updateLink
	    }),
	    shallow
	  );

  const objectTypeDefs = useDataStore((s) => s.objectTypes);
  const objectTypeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const def of objectTypeDefs || []) map.set(def.id, def);
    return map;
  }, [objectTypeDefs]);

  const getTypeLabel = useCallback(
    (typeId: string) => {
      const def = objectTypeById.get(typeId);
      return (def?.name?.[lang] as string) || (def?.name?.it as string) || typeId;
    },
    [lang, objectTypeById]
  );

  const getTypeIcon = useCallback((typeId: string) => objectTypeById.get(typeId)?.icon, [objectTypeById]);

  const objectTypeIcons = useMemo(() => {
    const out: Record<string, any> = {};
    for (const def of objectTypeDefs || []) out[def.id] = def.icon;
    return out;
  }, [objectTypeDefs]);

  const objectTypeLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const def of objectTypeDefs || []) out[def.id] = getTypeLabel(def.id);
    return out;
  }, [getTypeLabel, objectTypeDefs]);

  const inferDefaultLayerIds = useCallback((typeId: string) => (typeId === 'user' || typeId === 'real_user' || typeId === 'generic_user' ? ['users'] : ['devices']), []);

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
    openHelp,
    lastObjectScale,
    visibleLayerIdsByPlan,
    toggleLayerVisibility,
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
    togglePerfOverlay,
    setPlanDirty,
    requestSaveAndNavigate,
    pendingSaveNavigateTo,
    clearPendingSaveNavigate
  } = useUIStore(
    (s) => ({
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
      openHelp: s.openHelp,
      lastObjectScale: s.lastObjectScale,
      visibleLayerIdsByPlan: (s as any).visibleLayerIdsByPlan,
      toggleLayerVisibility: (s as any).toggleLayerVisibility,
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
      togglePerfOverlay: (s as any).togglePerfOverlay,
      setPlanDirty: (s as any).setPlanDirty,
      requestSaveAndNavigate: (s as any).requestSaveAndNavigate,
      pendingSaveNavigateTo: (s as any).pendingSaveNavigateTo,
      clearPendingSaveNavigate: (s as any).clearPendingSaveNavigate
    }),
    shallow
  );

  const push = useToastStore((s) => s.push);
  const saveCustomValues = useCustomFieldsStore((s) => s.saveObjectValues);
  const dataVersion = useDataStore((s) => s.version);
  const [pendingType, setPendingType] = useState<MapObjectType | null>(null);
  const [linkCreateMode, setLinkCreateMode] = useState<'arrow' | 'cable'>('arrow');
  const [modalState, setModalState] = useState<
    | { mode: 'create'; type: MapObjectType; coords: { x: number; y: number } }
    | { mode: 'edit'; objectId: string }
    | { mode: 'duplicate'; objectId: string; coords: { x: number; y: number } }
    | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [confirmDeleteViewId, setConfirmDeleteViewId] = useState<string | null>(null);
  const [confirmSetDefaultViewId, setConfirmSetDefaultViewId] = useState<string | null>(null);
  const [confirmClearObjects, setConfirmClearObjects] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditSelectionOpen, setBulkEditSelectionOpen] = useState(false);
  const [selectedObjectsModalOpen, setSelectedObjectsModalOpen] = useState(false);
  const [chooseDefaultModal, setChooseDefaultModal] = useState<{ deletingViewId: string } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  // reserved for future multi-plan export (disabled for now)
  const [printAreaMode, setPrintAreaMode] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [saveRevisionOpen, setSaveRevisionOpen] = useState(false);
  const [realUserPicker, setRealUserPicker] = useState<{ x: number; y: number } | null>(null);
  const [realUserImportMissing, setRealUserImportMissing] = useState(false);
  const [capacityConfirm, setCapacityConfirm] = useState<{
    type: MapObjectType;
    x: number;
    y: number;
    roomName: string;
    capacity: number;
  } | null>(null);
  const [undoConfirm, setUndoConfirm] = useState<{ id: string; name: string } | null>(null);
  const [overlapNotice, setOverlapNotice] = useState<string | null>(null);
  const roomOverlapNoticeRef = useRef(0);
  const overlapNoticeTimeoutRef = useRef<number | null>(null);
  const [allTypesOpen, setAllTypesOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<
    | { kind: 'object'; id: string; x: number; y: number }
    | { kind: 'link'; id: string; x: number; y: number }
    | { kind: 'room'; id: string; x: number; y: number }
    | { kind: 'map'; x: number; y: number; worldX: number; worldY: number; addOpen: boolean; roomOpen: boolean }
    | null
  >(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const returnToSelectionListRef = useRef(false);
  const lastInsertedRef = useRef<{ id: string; name: string } | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<string>('__last__');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchResultsTerm, setSearchResultsTerm] = useState('');
  const [searchResultsIds, setSearchResultsIds] = useState<string[]>([]);
  const [searchRoomIds, setSearchRoomIds] = useState<string[]>([]);
  const [crossPlanSearchOpen, setCrossPlanSearchOpen] = useState(false);
  const [crossPlanSearchTerm, setCrossPlanSearchTerm] = useState('');
  const [crossPlanResults, setCrossPlanResults] = useState<CrossPlanSearchResult[]>([]);
  const [countsOpen, setCountsOpen] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [objectListQuery, setObjectListQuery] = useState('');
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [roomAllocationOpen, setRoomAllocationOpen] = useState(false);
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [cableModal, setCableModal] = useState<{ mode: 'create'; fromId: string; toId: string } | { mode: 'edit'; linkId: string } | null>(null);
  const [linksModalObjectId, setLinksModalObjectId] = useState<string | null>(null);
  const [linkEditId, setLinkEditId] = useState<string | null>(null);
  const [realUserDetailsId, setRealUserDetailsId] = useState<string | null>(null);
  const [roomDrawMode, setRoomDrawMode] = useState<'rect' | 'poly' | null>(null);
  const [newRoomMenuOpen, setNewRoomMenuOpen] = useState(false);
  const [highlightRoom, setHighlightRoom] = useState<{ roomId: string; until: number } | null>(null);
  const [roomModal, setRoomModal] = useState<
    | { mode: 'create'; kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
    | { mode: 'create'; kind: 'poly'; points: { x: number; y: number }[] }
    | {
        mode: 'edit';
        roomId: string;
        initialName: string;
        initialCapacity?: number;
        initialShowName?: boolean;
        initialSurfaceSqm?: number;
        initialNotes?: string;
      }
    | null
  >(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);

  const planRef = useRef<FloorPlan | undefined>(undefined);
  const selectedObjectIdRef = useRef<string | undefined>(selectedObjectId);
  const selectedObjectIdsRef = useRef<string[]>(selectedObjectIds);
  const selectedLinkIdRef = useRef<string | null>(selectedLinkId);
  const confirmDeleteRef = useRef<string[] | null>(confirmDelete);
  const zoomRef = useRef<number>(zoom);
  const renderStartRef = useRef(0);
  renderStartRef.current = performance.now();

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const plan = useDataStore(
    useCallback((s) => s.findFloorPlan(planId), [planId])
  );
  const client = useDataStore(
    useCallback((s) => s.findClientByPlan(planId), [planId])
  );
  const site = useDataStore(
    useCallback((s) => s.findSiteByPlan(planId), [planId])
  );
  const { user, permissions } = useAuthStore();

  const selectedRevisionId = selectedRevisionByPlan[planId] ?? null;
  const activeRevision = useMemo(() => {
    if (!plan || !selectedRevisionId) return undefined;
    return (plan.revisions || []).find((r) => r.id === selectedRevisionId);
  }, [plan, selectedRevisionId]);

  const location = useLocation();
  const navigate = useNavigate();
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

  useEffect(() => {
    // Close any open context menus when switching plans.
    setContextMenu(null);
    setLinksModalObjectId(null);
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

  const [lockState, setLockState] = useState<{ lockedBy: { userId: string; username: string } | null; mine: boolean }>(
    { lockedBy: null, mine: false }
  );
  const [presenceUsers, setPresenceUsers] = useState<{ userId: string; username: string }[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const canRequestLock = !activeRevision && planAccess === 'rw';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    let closed = false;

    const send = (obj: any) => {
      try {
        ws.send(JSON.stringify(obj));
      } catch {
        // ignore
      }
    };

    ws.onopen = () => {
      send({ type: 'join', planId, wantLock: canRequestLock });
    };
    ws.onmessage = (ev) => {
      if (perfEnabled) perfMetrics.wsMessages += 1;
      let msg: any;
      try {
        msg = JSON.parse(String(ev.data || ''));
      } catch {
        return;
      }
      if (msg?.type === 'lock_state' && msg.planId === planId) {
        const lockedBy = msg.lockedBy || null;
        setLockState({ lockedBy, mine: !!lockedBy && lockedBy.userId === user.id });
      }
      if (msg?.type === 'lock_denied' && msg.planId === planId) {
        const lockedBy = msg.lockedBy || null;
        setLockState({ lockedBy, mine: false });
      }
      if (msg?.type === 'presence' && msg.planId === planId) {
        if (perfEnabled) perfMetrics.presenceUpdates += 1;
        setPresenceUsers(Array.isArray(msg.users) ? msg.users : []);
      }
    };
    ws.onclose = () => {
      if (closed) return;
      closed = true;
      setPresenceUsers([]);
      setLockState({ lockedBy: null, mine: false });
    };
    ws.onerror = () => {
      // ignore
    };

    return () => {
      closed = true;
      try {
        if (ws.readyState === WebSocket.OPEN) send({ type: 'leave', planId });
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [activeRevision, planAccess, planId, user?.id]);

  const lockedByOther = !!lockState.lockedBy && !lockState.mine;
  const isReadOnly = !!activeRevision || planAccess !== 'rw' || lockedByOther;
  const isReadOnlyRef = useRef(isReadOnly);
  useEffect(() => {
    isReadOnlyRef.current = isReadOnly;
  }, [isReadOnly]);
  const renderPlan = useMemo<FloorPlan | undefined>(() => {
    if (!plan) return undefined;
    if (!activeRevision) return plan;
    const revisionViews = (activeRevision as any).views as FloorPlanView[] | undefined;
    const effectiveViews =
      Array.isArray(revisionViews) && revisionViews.length ? revisionViews : plan.views || [];
    return {
      ...plan,
      imageUrl: activeRevision.imageUrl,
      width: activeRevision.width,
      height: activeRevision.height,
      layers: (activeRevision as any).layers || plan.layers,
      rooms: activeRevision.rooms,
      links: (activeRevision as any).links || (plan as any).links,
      objects: activeRevision.objects,
      views: effectiveViews as any
    } as FloorPlan;
  }, [activeRevision, plan]);

  const planLayers = useMemo(() => {
    const layers = (renderPlan as any)?.layers || [];
    return [...layers].sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
  }, [renderPlan]);
  const visibleLayerIds = visibleLayerIdsByPlan[planId] || planLayers.map((l: any) => l.id);
  useEffect(() => {
    if (!visibleLayerIdsByPlan[planId] && planLayers.length) {
      setVisibleLayerIds(planId, planLayers.map((l: any) => l.id));
    }
  }, [planId, planLayers, setVisibleLayerIds, visibleLayerIdsByPlan]);

  const canvasPlan = useMemo(() => {
    if (!renderPlan) return renderPlan;
    const visible = new Set(visibleLayerIds);
    const normalizedLayerIdsForType = (typeId: string) => {
      if (typeId === 'user' || typeId === 'real_user' || typeId === 'generic_user') return ['users'];
      return ['devices'];
    };
    const objects = renderPlan.objects.filter((o: any) => {
      const ids = Array.isArray(o.layerIds) && o.layerIds.length ? o.layerIds : normalizedLayerIdsForType(o.type);
      return ids.some((id: string) => visible.has(id));
    });
    const rooms = visible.has('rooms') ? renderPlan.rooms : [];
    const visibleObjectIds = new Set(objects.map((o: any) => o.id));
    const links = Array.isArray((renderPlan as any).links)
      ? ((renderPlan as any).links as any[]).filter((l) => {
          if (!visible.has('cabling')) return false;
          return visibleObjectIds.has(String((l as any).fromId || '')) && visibleObjectIds.has(String((l as any).toId || ''));
        })
      : (renderPlan as any).links;
    return { ...renderPlan, objects, rooms, links };
  }, [renderPlan, visibleLayerIds]);

  const linksModalObjectName = useMemo(() => {
    if (!linksModalObjectId) return '';
    const obj = ((renderPlan as any)?.objects || []).find((o: any) => o.id === linksModalObjectId);
    return String(obj?.name || linksModalObjectId);
  }, [linksModalObjectId, renderPlan]);

  const linksModalRows = useMemo(() => {
    if (!linksModalObjectId || !renderPlan) return [];
    const links = (((renderPlan as any).links || []) as any[]).filter(
      (l) => String(l?.fromId || '') === linksModalObjectId || String(l?.toId || '') === linksModalObjectId
    );
    const byId = new Map<string, any>(((renderPlan as any).objects || []).map((o: any) => [o.id, o]));
    const typeLabelById = new Map<string, string>();
    for (const d of objectTypeDefs || []) {
      typeLabelById.set(String(d.id), String((d as any)?.name?.[lang] || (d as any)?.name?.it || d.id));
    }
    return links.map((l) => {
      const kind = String((l as any).kind || 'arrow') === 'cable' ? 'cable' : 'arrow';
      const otherId = String(l.fromId) === linksModalObjectId ? String(l.toId) : String(l.fromId);
      const other = byId.get(otherId);
      return {
        id: String(l.id),
        kind,
        name: String((l as any).name || (l as any).label || '').trim(),
        description: String((l as any).description || '').trim() || undefined,
        otherId,
        otherName: String(other?.name || otherId),
        otherTypeLabel: other ? typeLabelById.get(String(other.type || '')) || String(other.type || '') : undefined,
        color: (l as any).color,
        width: typeof (l as any).width === 'number' ? (l as any).width : undefined,
        dashed: !!(l as any).dashed,
        route: (l as any).route === 'hv' ? 'hv' : (l as any).route === 'vh' ? 'vh' : undefined
      };
    });
  }, [lang, linksModalObjectId, objectTypeDefs, renderPlan]);

  const linkCreateHint = useMemo(() => {
    if (!linkFromId || isReadOnly) return null;
    const from = (renderPlan as any)?.objects?.find((o: any) => o.id === linkFromId);
    const fromName = String(from?.name || '').trim();
    const modeLabel =
      linkCreateMode === 'cable'
        ? t({ it: 'collegamento 90°', en: '90° link' })
        : t({ it: 'collegamento', en: 'link' });
    return {
      title: t({
        it: `Seleziona un secondo oggetto per creare un ${modeLabel}.`,
        en: `Select a second object to create a ${modeLabel}.`
      }),
      subtitle: t({
        it: `${fromName ? `Origine: ${fromName}. ` : ''}Premi Esc per annullare.`,
        en: `${fromName ? `From: ${fromName}. ` : ''}Press Esc to cancel.`
      })
    };
  }, [isReadOnly, linkCreateMode, linkFromId, renderPlan, t]);

  const latestRev = useMemo(() => {
    const revs: any[] = plan?.revisions || [];
    const sorted = [...revs].sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    const first = sorted[0];
    if (first && typeof first.revMajor === 'number' && typeof first.revMinor === 'number') {
      return { major: first.revMajor, minor: first.revMinor };
    }
    if (first && typeof first.version === 'number') {
      return { major: 1, minor: Math.max(0, Number(first.version) - 1) };
    }
    return { major: 1, minor: 0 };
  }, [plan?.revisions]);

  const hasAnyRevision = !!(plan?.revisions || []).length;
  const baselineSnapshotRef = useRef<{
    imageUrl: string;
    width?: number;
    height?: number;
    objects: any[];
    views?: any[];
    rooms?: any[];
  } | null>(null);
  const entrySnapshotRef = useRef<{
    imageUrl: string;
    width?: number;
    height?: number;
    objects: any[];
    views?: any[];
    rooms?: any[];
  } | null>(null);
  const touchedRef = useRef(false);
  const [touchedTick, setTouchedTick] = useState(0);
  const markTouched = useCallback(() => {
    if (touchedRef.current) return;
    touchedRef.current = true;
    setTouchedTick((x) => x + 1);
  }, []);
  const resetTouched = useCallback(() => {
    if (!touchedRef.current) return;
    touchedRef.current = false;
    setTouchedTick((x) => x + 1);
  }, []);

  const toSnapshot = useCallback((p: any) => {
    return {
      imageUrl: p?.imageUrl || '',
      width: p?.width,
      height: p?.height,
      objects: Array.isArray(p?.objects) ? p.objects : [],
      views: Array.isArray(p?.views) ? p.views : [],
      rooms: Array.isArray(p?.rooms) ? p.rooms : []
    };
  }, []);

  useEffect(() => {
    baselineSnapshotRef.current = null;
    entrySnapshotRef.current = null;
    touchedRef.current = false;
    setTouchedTick((x) => x + 1);
  }, [planId]);

  useEffect(() => {
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) {
      baselineSnapshotRef.current = null;
      return;
    }
    const snap = toSnapshot(plan);
    // Keep baseline aligned with background normalizations until the user edits.
    if (!baselineSnapshotRef.current || !touchedRef.current) baselineSnapshotRef.current = snap;
  }, [plan, toSnapshot]);

  const samePlanSnapshot = (
    current: {
      imageUrl: string;
      width?: number;
      height?: number;
      objects: any[];
      views?: any[];
      rooms?: any[];
    },
    latest: {
      imageUrl: string;
      width?: number;
      height?: number;
      objects: any[];
      views?: any[];
      rooms?: any[];
    }
  ) => {
    if (current.imageUrl !== latest.imageUrl) return false;
    if ((current.width ?? null) !== (latest.width ?? null)) return false;
    if ((current.height ?? null) !== (latest.height ?? null)) return false;

    const aObjs = current.objects || [];
    const bObjs = latest.objects || [];
    if (aObjs.length !== bObjs.length) return false;
    const bById = new Map<string, any>();
    for (const o of bObjs) bById.set(o.id, o);
    for (const o of aObjs) {
      const other = bById.get(o.id);
      if (!other) return false;
      if (o.type !== other.type) return false;
      if (o.name !== other.name) return false;
      if ((o.description || '') !== (other.description || '')) return false;
      if (o.x !== other.x || o.y !== other.y) return false;
      if ((o.scale ?? 1) !== (other.scale ?? 1)) return false;
      if ((o.roomId ?? null) !== (other.roomId ?? null)) return false;
    }

    const aViews = current.views || [];
    const bViews = latest.views || [];
    if (aViews.length !== bViews.length) return false;
    const bViewsById = new Map<string, any>();
    for (const v of bViews) bViewsById.set(v.id, v);
    for (const v of aViews) {
      const other = bViewsById.get(v.id);
      if (!other) return false;
      if (v.name !== other.name) return false;
      if ((v.description || '') !== (other.description || '')) return false;
      if (v.zoom !== other.zoom) return false;
      if ((v.pan?.x ?? 0) !== (other.pan?.x ?? 0)) return false;
      if ((v.pan?.y ?? 0) !== (other.pan?.y ?? 0)) return false;
      if (!!v.isDefault !== !!other.isDefault) return false;
    }

    const aRooms = current.rooms || [];
    const bRooms = latest.rooms || [];
    if (aRooms.length !== bRooms.length) return false;
    const bRoomsById = new Map<string, any>();
    for (const r of bRooms) bRoomsById.set(r.id, r);
    for (const r of aRooms) {
      const other = bRoomsById.get(r.id);
      if (!other) return false;
      if (r.name !== other.name) return false;
      if (r.x !== other.x || r.y !== other.y) return false;
      if (r.width !== other.width || r.height !== other.height) return false;
    }

    return true;
  };

  const samePlanSnapshotIgnoringDims = useCallback(
    (
      a: {
        imageUrl: string;
        width?: number;
        height?: number;
        objects: any[];
        views?: any[];
        rooms?: any[];
      },
      b: {
        imageUrl: string;
        width?: number;
        height?: number;
        objects: any[];
        views?: any[];
        rooms?: any[];
      }
    ) => samePlanSnapshot({ ...a, width: undefined, height: undefined }, { ...b, width: undefined, height: undefined }),
    []
  );

  // Track plan state when the user enters it. Used for the navigation prompt.
  useEffect(() => {
    if (!plan) return;
    const snap = toSnapshot(plan);
    if (!entrySnapshotRef.current || !touchedRef.current) entrySnapshotRef.current = snap;
  }, [plan, toSnapshot]);

  const hasUnsavedChanges = useMemo(() => {
    if (!plan) return false;
    const revisions = plan.revisions || [];
    if (!revisions.length) {
      const base = baselineSnapshotRef.current;
      if (!base) return false;
      return !samePlanSnapshot(toSnapshot(plan), base);
    }
    const latest: any = [...revisions].sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))[0];
    return !samePlanSnapshot(toSnapshot(plan), {
      imageUrl: latest.imageUrl,
      width: latest.width,
      height: latest.height,
      objects: latest.objects,
      views: latest.views,
      rooms: latest.rooms
    });
  }, [plan, toSnapshot]);

  const hasLocalEdits = useMemo(() => {
    if (!plan) return false;
    const entry = entrySnapshotRef.current;
    if (!entry) return false;
    return !samePlanSnapshotIgnoringDims(entry, toSnapshot(plan));
  }, [plan, samePlanSnapshotIgnoringDims, toSnapshot]);

  const hasNavigationEdits = useMemo(
    () => touchedRef.current && hasLocalEdits,
    // touchedRef is a ref; touchedTick is used to re-evaluate when touched changes.
    [hasLocalEdits, touchedTick]
  );

  useEffect(() => {
    // If the only change is an automatic width/height fill (e.g. measured from image), do not treat it as
    // a "revision-worthy" unsaved change when the plan has no revision history yet.
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) return;
    const base = baselineSnapshotRef.current;
    if (!base) return;
    const current = toSnapshot(plan);
    if (samePlanSnapshot(current, base)) return;

    const baseDimsMissing = (base.width ?? null) === null && (base.height ?? null) === null;
    const currentHasDims = typeof current.width === 'number' || typeof current.height === 'number';
    if (!baseDimsMissing || !currentHasDims) return;
    if (!samePlanSnapshotIgnoringDims(base, current)) return;

    baselineSnapshotRef.current = current;
  }, [plan, samePlanSnapshotIgnoringDims, toSnapshot]);

  const pendingNavigateRef = useRef<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    const focusObject = sp.get('focusObject');
    const focusRoom = sp.get('focusRoom');
    if (!focusObject && !focusRoom) return;
    const timer = window.setTimeout(() => {
      if (focusObject) {
        setSelectedObject(focusObject);
        triggerHighlight(focusObject);
      }
      if (focusRoom) {
        clearSelection();
        setSelectedRoomId(focusRoom);
        setHighlightRoom({ roomId: focusRoom, until: Date.now() + 3200 });
      }
      navigate(`/plan/${planId}`, { replace: true });
    }, 40);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tm') !== '1') return;
    setRevisionsOpen(true);
    params.delete('tm');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pa') !== '1') return;
    if (isReadOnly) return;
    setPrintAreaMode(true);
    push(
      t({
        it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
        en: 'Draw a rectangle on the map to set the print area.'
      }),
      'info'
    );
    params.delete('pa');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    if (!printAreaMode) return;
    const onKey = (e: KeyboardEvent) => {
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
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) {
      const latest = [...revisions].sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))[0];
      if (latest?.id) restoreRevision(plan.id, latest.id);
      return;
    }
    const base = baselineSnapshotRef.current;
    if (!base) return;
    setFloorPlanContent(plan.id, {
      imageUrl: base.imageUrl,
      width: base.width,
      height: base.height,
      objects: base.objects,
      rooms: base.rooms,
      views: base.views
    });
  }, [plan, restoreRevision, setFloorPlanContent]);

  useEffect(() => {
    setPlanDirty?.(planId, !!hasNavigationEdits);
    return () => {
      setPlanDirty?.(planId, false);
    };
  }, [hasNavigationEdits, planId, setPlanDirty]);

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
    setSaveRevisionOpen(true);
  }, [clearPendingSaveNavigate, hasNavigationEdits, isReadOnly, navigate, pendingSaveNavigateTo]);
  const contextObject = useMemo(() => {
    if (!renderPlan || !contextMenu || contextMenu.kind !== 'object') return undefined;
    return renderPlan.objects.find((o) => o.id === contextMenu.id);
  }, [renderPlan, contextMenu]);

  const realUserDetails = useMemo(() => {
    if (!realUserDetailsId || !renderPlan) return null;
    const obj = renderPlan.objects.find((o: any) => o.id === realUserDetailsId);
    if (!obj || obj.type !== 'real_user') return null;
    return {
      externalUserId: (obj as any).externalUserId,
      firstName: (obj as any).firstName,
      lastName: (obj as any).lastName,
      externalEmail: (obj as any).externalEmail,
      externalRole: (obj as any).externalRole,
      externalDept1: (obj as any).externalDept1,
      externalDept2: (obj as any).externalDept2,
      externalDept3: (obj as any).externalDept3,
      externalExt1: (obj as any).externalExt1,
      externalExt2: (obj as any).externalExt2,
      externalExt3: (obj as any).externalExt3,
      externalIsExternal: (obj as any).externalIsExternal
    };
  }, [realUserDetailsId, renderPlan]);

  const realUserDetailsName = useMemo(() => {
    if (!realUserDetailsId || !renderPlan) return '';
    const obj = renderPlan.objects.find((o: any) => o.id === realUserDetailsId);
    return String(obj?.name || realUserDetailsId);
  }, [realUserDetailsId, renderPlan]);

  const contextLink = useMemo(() => {
    if (!renderPlan || !contextMenu || contextMenu.kind !== 'link') return undefined;
    return ((renderPlan as any).links || []).find((l: any) => l.id === contextMenu.id);
  }, [renderPlan, contextMenu]);

  const contextObjectLinkCount = useMemo(() => {
    if (!renderPlan || !contextMenu || contextMenu.kind !== 'object') return 0;
    const links = ((renderPlan as any).links || []) as any[];
    const id = contextMenu.id;
    return links.filter((l) => String(l?.fromId || '') === id || String(l?.toId || '') === id).length;
  }, [contextMenu, renderPlan]);

  const hasDefaultView = useMemo(
    () => !!(renderPlan?.views || []).find((v) => v.isDefault),
    [renderPlan?.views]
  );

  const contextIsMulti = useMemo(() => {
    if (!contextMenu || contextMenu.kind !== 'object') return false;
    if (!selectedObjectIds?.length || selectedObjectIds.length < 2) return false;
    return selectedObjectIds.includes(contextMenu.id);
  }, [contextMenu, selectedObjectIds]);

  useEffect(() => {
    planRef.current = renderPlan;
  }, [renderPlan]);
  useEffect(() => {
    selectedObjectIdRef.current = selectedObjectId;
  }, [selectedObjectId]);
  useEffect(() => {
    selectedObjectIdsRef.current = selectedObjectIds;
  }, [selectedObjectIds]);
  useEffect(() => {
    selectedLinkIdRef.current = selectedLinkId;
  }, [selectedLinkId]);
  useEffect(() => {
    confirmDeleteRef.current = confirmDelete;
  }, [confirmDelete]);

  useEffect(() => {
    setSelectedPlan(planId);
  }, [planId, setSelectedPlan]);

  useLayoutEffect(() => {
    if (!renderPlan) return;
    const viewportKey = `${planId}:${selectedRevisionId || 'present'}:${location.key || ''}`;
    const def = renderPlan?.views?.find((v) => v.isDefault);
    if (def && viewportInitRef.current !== viewportKey && (forceDefaultView || selectedViewId === '__last__')) {
      viewportInitRef.current = viewportKey;
      setAutoFitEnabled(false);
      setZoom(def.zoom);
      setPan(def.pan);
      saveViewport(planId, def.zoom, def.pan);
      setSelectedViewId(def.id);
      return;
    }
    if (forceDefaultView) {
      // Explicit request from Settings → Workspace: fall back to auto-fit only if no default exists.
      setAutoFitEnabled(true);
      setSelectedViewId('__last__');
      return;
    }
    if (!def && (!renderPlan.views || !renderPlan.views.length)) {
      // Views not ready yet; wait so default can be applied when available.
      return;
    }
    if (viewportInitRef.current === viewportKey) return;
    viewportInitRef.current = viewportKey;
    const saved = loadViewport(planId);
    if (saved) {
      setAutoFitEnabled(false);
      setZoom(saved.zoom);
      setPan(saved.pan);
      setSelectedViewId('__last__');
      return;
    }
    setAutoFitEnabled(true);
  }, [forceDefaultView, loadViewport, location.key, planId, renderPlan, saveViewport, selectedRevisionId, setPan, setZoom]);

  useEffect(() => {
    // entering/leaving read-only mode clears pending placement and context menu
    setPendingType(null);
    setContextMenu(null);
    clearSelection();
    setSelectedLinkId(null);
    setLinkFromId(null);
  }, [isReadOnly]);

  useEffect(() => {
    // If the user selects an object to place while drawing a room, cancel the room creation mode.
    if (!roomDrawMode) return;
    if (!pendingType) return;
    setRoomDrawMode(null);
    setNewRoomMenuOpen(false);
  }, [pendingType, roomDrawMode]);

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
	    (id?: string, options?: { keepContext?: boolean; multi?: boolean }) => {
	      // If the user is drawing a room (especially polygon mode) and clicks an object,
	      // treat it as an explicit cancel of the drawing gesture.
	      if (roomDrawMode && id) {
	        setRoomDrawMode(null);
	        setNewRoomMenuOpen(false);
	      }
	      if (linkFromId && id && planRef.current && !isReadOnlyRef.current) {
	        if (id !== linkFromId) {
	          markTouched();
            if (linkCreateMode === 'cable') {
              setCableModal({ mode: 'create', fromId: linkFromId, toId: id });
            } else {
              addLink((planRef.current as any).id, linkFromId, id, { kind: 'arrow' });
              postAuditEvent({ event: 'link_create', scopeType: 'plan', scopeId: (planRef.current as any).id, details: { fromId: linkFromId, toId: id } });
              push(t({ it: 'Collegamento creato', en: 'Link created' }), 'success');
            }
	        }
	        setLinkFromId(null);
	      }
      if (!id) {
        clearSelection();
        setSelectedRoomId(undefined);
        setSelectedLinkId(null);
      } else if (options?.multi) {
        setSelectedRoomId(undefined);
        setSelectedLinkId(null);
        toggleSelectedObject(id);
      } else {
        setSelectedRoomId(undefined);
        setSelectedLinkId(null);
        const currentSelectedIds = selectedObjectIdsRef.current;
        const currentSelectedId = selectedObjectIdRef.current;
        if (currentSelectedIds.length === 1 && currentSelectedId === id) {
          clearSelection();
        } else {
          setSelectedObject(id);
        }
      }
	      if (!options?.keepContext) {
	        setContextMenu(null);
	      }
	    },
	    [
	      addLink,
	      clearSelection,
	      linkCreateMode,
	      linkFromId,
	      markTouched,
	      push,
	      roomDrawMode,
	      setSelectedObject,
	      t,
	      toggleSelectedObject
	    ]
	  );

  const handleStageMove = useCallback(
    (id: string, x: number, y: number) => {
      if (!isReadOnlyRef.current) markTouched();
      const currentPlan = planRef.current as FloorPlan | undefined;
      const currentObj = currentPlan?.objects?.find((o) => o.id === id);
      const nextRoomId = !isReadOnlyRef.current && currentPlan ? getRoomIdAt(currentPlan.rooms, x, y) : undefined;
      const currentRoomId = currentObj?.roomId ?? undefined;
      updateObject(id, { x, y, ...(currentRoomId !== nextRoomId ? { roomId: nextRoomId } : {}) });
    },
    [markTouched, updateObject]
  );

  const handleObjectContextMenu = useCallback(
    ({ id, clientX, clientY }: { id: string; clientX: number; clientY: number }) =>
      setContextMenu({ kind: 'object', id, x: clientX, y: clientY }),
    []
  );

  const handleLinkContextMenu = useCallback(
    ({ id, clientX, clientY }: { id: string; clientX: number; clientY: number }) =>
      setContextMenu({ kind: 'link', id, x: clientX, y: clientY }),
    []
  );

  const handleRoomContextMenu = useCallback(
    ({ id, clientX, clientY }: { id: string; clientX: number; clientY: number }) =>
      setContextMenu({ kind: 'room', id, x: clientX, y: clientY }),
    []
  );

  const handleMapContextMenu = useCallback(
    ({ clientX, clientY, worldX, worldY }: { clientX: number; clientY: number; worldX: number; worldY: number }) =>
      setContextMenu({ kind: 'map', x: clientX, y: clientY, worldX, worldY, addOpen: false, roomOpen: false }),
    []
  );

  const applyView = useCallback((view: FloorPlanView) => {
    if (!renderPlan) return;
    setAutoFitEnabled(false);
    setZoom(view.zoom);
    setPan(view.pan);
    saveViewport(renderPlan.id, view.zoom, view.pan);
    setSelectedViewId(view.id);
  }, [renderPlan, saveViewport, setAutoFitEnabled, setPan, setZoom]);

  const handleSaveView = (payload: { name: string; description?: string; isDefault: boolean }) => {
    if (!plan || isReadOnly) return;
    const id = addView(plan.id, { ...payload, zoom, pan, isDefault: payload.isDefault });
    push(t({ it: 'Vista salvata', en: 'View saved' }), 'success');
    setSelectedViewId(id);
    setViewsMenuOpen(false);
  };

  const goToDefaultView = () => {
    const current = renderPlan;
    if (!current) return;
    const def = current.views?.find((v) => v.isDefault);
    if (!def) {
      push(t({ it: 'Nessuna vista di default', en: 'No default view' }), 'info');
      return;
    }
    applyView(def);
    push(t({ it: 'Vista di default caricata', en: 'Default view loaded' }), 'success');
  };

  const openDuplicate = (objectId: string) => {
    const obj = renderPlan?.objects.find((o) => o.id === objectId);
    if (!renderPlan || !obj || isReadOnly) return;
    const offset = 44 * (obj.scale ?? 1);
    setModalState({ mode: 'duplicate', objectId, coords: { x: obj.x + offset, y: obj.y + offset * 0.4 } });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdF = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f';
      if (isCmdF) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isPointInPoly = (points: { x: number; y: number }[], x: number, y: number) => {
    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isPointInRoom = (room: any, x: number, y: number) => {
    const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as
      | 'rect'
      | 'poly';
    if (kind === 'poly') {
      const pts = Array.isArray(room?.points) ? room.points : [];
      if (pts.length < 3) return false;
      // quick bbox check
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      return isPointInPoly(pts, x, y);
    }
    const rx = Number(room?.x || 0);
    const ry = Number(room?.y || 0);
    const rw = Number(room?.width || 0);
    const rh = Number(room?.height || 0);
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  };

  const getRoomIdAt = (rooms: any[] | undefined, x: number, y: number) => {
    const list = rooms || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const room = list[i];
      if (isPointInRoom(room, x, y)) return room.id as string;
    }
    return undefined;
  };

  const getRoomPolygon = (room: any) => {
    const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
    if (kind === 'poly') {
      const pts = Array.isArray(room?.points) ? room.points : [];
      return pts.length >= 3 ? pts : [];
    }
    const x = Number(room?.x || 0);
    const y = Number(room?.y || 0);
    const w = Number(room?.width || 0);
    const h = Number(room?.height || 0);
    if (!w || !h) return [];
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ];
  };

  const segmentsIntersect = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    d: { x: number; y: number }
  ) => {
    const orient = (p: any, q: any, r: any) => {
      const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
      if (Math.abs(v) < 0.000001) return 0;
      return v > 0 ? 1 : 2;
    };
    const onSegment = (p: any, q: any, r: any) =>
      Math.min(p.x, r.x) <= q.x + 0.000001 &&
      q.x <= Math.max(p.x, r.x) + 0.000001 &&
      Math.min(p.y, r.y) <= q.y + 0.000001 &&
      q.y <= Math.max(p.y, r.y) + 0.000001;
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a, c, b)) return true;
    if (o2 === 0 && onSegment(a, d, b)) return true;
    if (o3 === 0 && onSegment(c, a, d)) return true;
    if (o4 === 0 && onSegment(c, b, d)) return true;
    return false;
  };

  const polygonsOverlap = (a: { x: number; y: number }[], b: { x: number; y: number }[]) => {
    if (a.length < 3 || b.length < 3) return false;
    const bounds = (pts: { x: number; y: number }[]) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return { minX, minY, maxX, maxY };
    };
    const aBox = bounds(a);
    const bBox = bounds(b);
    if (aBox.maxX < bBox.minX || aBox.minX > bBox.maxX || aBox.maxY < bBox.minY || aBox.minY > bBox.maxY) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      const a1 = a[i];
      const a2 = a[(i + 1) % a.length];
      for (let j = 0; j < b.length; j += 1) {
        const b1 = b[j];
        const b2 = b[(j + 1) % b.length];
        if (segmentsIntersect(a1, a2, b1, b2)) return true;
      }
    }
    if (isPointInPoly(a, b[0].x, b[0].y)) return true;
    if (isPointInPoly(b, a[0].x, a[0].y)) return true;
    return false;
  };

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
    if (overlapNoticeTimeoutRef.current) window.clearTimeout(overlapNoticeTimeoutRef.current);
    overlapNoticeTimeoutRef.current = window.setTimeout(() => setOverlapNotice(null), 3000);
  }, [t]);

  const computeRoomReassignments = (rooms: any[] | undefined, objects: any[]) => {
    const updates: Record<string, string | undefined> = {};
    for (const obj of objects) {
      const nextRoomId = getRoomIdAt(rooms, obj.x, obj.y);
      const current = obj.roomId ?? undefined;
      if (current !== nextRoomId) {
        updates[obj.id] = nextRoomId;
      }
    }
    return updates;
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;

      const currentConfirm = confirmDeleteRef.current;
      const currentSelectedIds = selectedObjectIdsRef.current;
      const currentPlan = planRef.current;

      if (roomDrawMode && e.key === 'Escape') {
        e.preventDefault();
        setRoomDrawMode(null);
        push(t({ it: 'Disegno stanza annullato', en: 'Room drawing cancelled' }), 'info');
        return;
      }

      if (e.key === 'Escape' && linkFromId) {
        e.preventDefault();
        setLinkFromId(null);
        push(t({ it: 'Creazione collegamento annullata', en: 'Link creation cancelled' }), 'info');
        return;
      }

      if (currentConfirm) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setConfirmDelete(null);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          currentConfirm.forEach((id) => deleteObject(id));
          push(
            currentConfirm.length === 1
              ? t({ it: 'Oggetto eliminato', en: 'Object deleted' })
              : t({ it: 'Oggetti eliminati', en: 'Objects deleted' }),
            'info'
          );
          setConfirmDelete(null);
          setContextMenu(null);
          clearSelection();
          return;
        }
      }

      if (isTyping) return;

      const isCmdS = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
      if (isCmdS) {
        if (!currentPlan || isReadOnlyRef.current) return;
        e.preventDefault();
        const revisions: any[] = (currentPlan as FloorPlan).revisions || [];
        const sorted = [...revisions].sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
        const first = sorted[0];
        const latest =
          first && typeof first.revMajor === 'number' && typeof first.revMinor === 'number'
            ? { major: first.revMajor, minor: first.revMinor }
            : first && typeof first.version === 'number'
              ? { major: 1, minor: Math.max(0, Number(first.version) - 1) }
              : { major: 1, minor: 0 };
        const next = revisions.length ? { major: latest.major, minor: latest.minor + 1 } : { major: 1, minor: 0 };
        const stamp = new Date().toLocaleString();
        const quickName = t({ it: 'Aggiornamento rapido', en: 'Quick update' });
        addRevision((currentPlan as FloorPlan).id, {
          bump: 'minor',
          name: quickName,
          description: t({ it: `Aggiornamento rapido ${stamp}`, en: `Quick update ${stamp}` })
        });
        push(
          t({
            it: `Aggiornamento rapido Ver: ${next.major}.${next.minor}`,
            en: `Quick update Ver: ${next.major}.${next.minor}`
          }),
          'success'
        );
        postAuditEvent({
          event: 'revision_quick_save',
          scopeType: 'plan',
          scopeId: (currentPlan as FloorPlan).id,
          details: { rev: `${next.major}.${next.minor}`, note: stamp }
        });
        resetTouched();
        entrySnapshotRef.current = toSnapshot(planRef.current || currentPlan);
        return;
      }

      const isCmdZ = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
      if (isCmdZ) {
        if (!currentPlan || isReadOnlyRef.current) return;
        e.preventDefault();
        const last = lastInsertedRef.current;
        if (!last) return;
        const exists = (currentPlan as FloorPlan).objects?.some((o) => o.id === last.id);
        if (!exists) {
          lastInsertedRef.current = null;
          return;
        }
        setUndoConfirm(last);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (!currentPlan) return;
        e.preventDefault();
        const allIds = ((currentPlan as FloorPlan).objects || []).map((o) => o.id);
        setSelection(allIds);
        setContextMenu(null);
        setSelectedRoomId(undefined);
        setSelectedLinkId(null);
        push(
          t({
            it: `Selezionati ${allIds.length} oggetti (Ctrl/Cmd+A).`,
            en: `Selected ${allIds.length} objects (Ctrl/Cmd+A).`
          }),
          'info'
        );
        return;
      }

      if (e.key === 'Escape') {
        if (currentSelectedIds.length || selectedRoomId) {
          e.preventDefault();
          setContextMenu(null);
          clearSelection();
          setSelectedRoomId(undefined);
          setSelectedLinkId(null);
        }
        return;
      }

      const isArrow =
        e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (isArrow) {
        if (!currentSelectedIds.length || !currentPlan) return;
        if (isReadOnlyRef.current) return;
        e.preventDefault();
        const z = zoomRef.current || 1;
        const step = (e.shiftKey ? 10 : 1) / Math.max(0.2, z);
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        for (const id of currentSelectedIds) {
          const obj = (currentPlan as FloorPlan).objects?.find((o) => o.id === id);
          if (!obj) continue;
          const nextX = obj.x + dx;
          const nextY = obj.y + dy;
          const nextRoomId = getRoomIdAt((currentPlan as FloorPlan).rooms, nextX, nextY);
          const currentRoomId = obj.roomId ?? undefined;
          updateObject(id, { x: nextX, y: nextY, ...(currentRoomId !== nextRoomId ? { roomId: nextRoomId } : {}) });
        }
        return;
      }
      const linkId = selectedLinkIdRef.current;
      if (!currentSelectedIds.length && !selectedRoomId && linkId && (e.key === 'Delete' || e.key === 'Backspace') && currentPlan) {
        e.preventDefault();
        if (isReadOnlyRef.current) return;
        markTouched();
        deleteLink((currentPlan as FloorPlan).id, linkId);
        postAuditEvent({ event: 'link_delete', scopeType: 'plan', scopeId: (currentPlan as FloorPlan).id, details: { id: linkId } });
        push(t({ it: 'Collegamento eliminato', en: 'Link deleted' }), 'info');
        setSelectedLinkId(null);
        return;
      }
      if (!currentSelectedIds.length || !currentPlan) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setConfirmDelete([...currentSelectedIds]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    addRevision,
    deleteObject,
    push,
    clearSelection,
    roomDrawMode,
    selectedRoomId,
    linkFromId,
    deleteLink,
    markTouched,
    resetTouched,
    setSelection,
    t,
    toSnapshot,
    updateObject
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

  const isUserObject = useCallback((type: string) => type === 'user' || type === 'real_user' || type === 'generic_user', []);

  const rooms = useMemo(() => renderPlan?.rooms || [], [renderPlan?.rooms]);

  const paletteFavorites = useAuthStore((s) => (s.user as any)?.paletteFavorites) as string[] | undefined;
  const paletteOrder = useMemo(() => (Array.isArray(paletteFavorites) ? paletteFavorites : []), [paletteFavorites]);
  // User-configured palette: list can be empty (meaning no objects enabled).
  const paletteHasCustom = paletteOrder.length > 0;
  const paletteHasMore = useMemo(() => {
    const all = (objectTypeDefs || []).map((d) => d.id);
    const fav = new Set(paletteOrder);
    return all.some((id) => !fav.has(id));
  }, [objectTypeDefs, paletteOrder]);

  const addTypeToPalette = useCallback(
    async (typeId: string) => {
      const user = useAuthStore.getState().user as any;
      const enabled = Array.isArray(user?.paletteFavorites) ? (user.paletteFavorites as string[]) : [];
      if (enabled.includes(typeId)) return;
      const next = [...enabled, typeId];
      try {
        await updateMyProfile({ paletteFavorites: next });
        useAuthStore.setState((s) =>
          s.user ? ({ user: { ...s.user, paletteFavorites: next } as any, permissions: s.permissions, hydrated: s.hydrated } as any) : s
        );
        push(t({ it: 'Oggetto aggiunto alla palette', en: 'Object added to palette' }), 'success');
      } catch {
        push(t({ it: 'Salvataggio non riuscito', en: 'Save failed' }), 'danger');
      }
    },
    [push, t]
  );

  const removeTypeFromPalette = useCallback(
    async (typeId: string) => {
      const user = useAuthStore.getState().user as any;
      const enabled = Array.isArray(user?.paletteFavorites) ? (user.paletteFavorites as string[]) : [];
      if (!enabled.includes(typeId)) return;
      const next = enabled.filter((x) => x !== typeId);
      try {
        await updateMyProfile({ paletteFavorites: next });
        useAuthStore.setState((s) =>
          s.user ? ({ user: { ...s.user, paletteFavorites: next } as any, permissions: s.permissions, hydrated: s.hydrated } as any) : s
        );
        push(t({ it: 'Oggetto rimosso dalla palette', en: 'Object removed from palette' }), 'info');
      } catch {
        push(t({ it: 'Salvataggio non riuscito', en: 'Save failed' }), 'danger');
      }
    },
    [push, t]
  );

  const mapAddMenuTypes = useMemo(() => {
    const defs = objectTypeDefs || [];
    if (!paletteHasCustom) return defs;
    const fav = new Set(paletteOrder);
    return defs.filter((d) => !fav.has(d.id));
  }, [objectTypeDefs, paletteHasCustom, paletteOrder]);

  useEffect(() => {
    if (!gridMenuOpen) return;
    const onDown = (e: MouseEvent) => {
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
  const roomStatsById = useMemo(() => {
    const objs = renderPlan?.objects || [];
    let key = `${objs.length}`;
    for (const obj of objs) {
      key += `|${obj.id}:${obj.roomId || ''}:${obj.type}`;
    }
    if (roomStatsCacheRef.current.key === key) return roomStatsCacheRef.current.value;
    const map = new Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }>();
    for (const obj of objs) {
      if (!obj.roomId) continue;
      const entry =
        map.get(obj.roomId) || { items: [] as MapObject[], userCount: 0, otherCount: 0, totalCount: 0 };
      entry.items.push(obj);
      if (isUserObject(String(obj.type))) entry.userCount += 1;
      else entry.otherCount += 1;
      entry.totalCount += 1;
      map.set(obj.roomId, entry);
    }
    roomStatsCacheRef.current = { key, value: map };
    return map;
  }, [isUserObject, renderPlan?.objects]);

  useEffect(() => {
    const prevState = roomCapacityStateByPlan?.[planId];
    const nextState: Record<string, { userCount: number; capacity?: number }> = {};
    let nextKey = '';
    let prevKey = '';
    for (const room of rooms) {
      const rawCapacity = Number(room.capacity);
      const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.floor(rawCapacity) : undefined;
      const userCount = roomStatsById.get(room.id)?.userCount || 0;
      nextState[room.id] = { userCount, capacity };
      nextKey += `|${room.id}:${userCount}:${capacity ?? ''}`;
      if (prevState) {
        const prev = prevState[room.id];
        prevKey += `|${room.id}:${prev?.userCount ?? ''}:${prev?.capacity ?? ''}`;
      }
      if (!capacity) continue;
      if (!prevState) continue;
      const prev = prevState[room.id];
      const prevCapacity = prev?.capacity ?? Infinity;
      const prevCount = prev?.userCount ?? userCount;
      const wasOver = prevCount > prevCapacity;
      const isOver = userCount > capacity;
      if (!wasOver && isOver) {
        push(
          t({
            it: `Attenzione la stanza ospita un massimo di ${capacity} postazioni`,
            en: `Warning: this room hosts a maximum of ${capacity} seats`
          }),
          'danger'
        );
      }
    }
    if (nextKey === prevKey) return;
    setRoomCapacityState(planId, nextState);
  }, [planId, push, roomCapacityStateByPlan, roomStatsById, rooms, setRoomCapacityState, t]);

  const objectListMatches = useMemo(() => {
    const q = objectListQuery.trim().toLowerCase();
    if (!q) return [];
    return (renderPlan?.objects || []).filter(
      (o) => o.name.toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q)
    );
  }, [objectListQuery, renderPlan?.objects]);

  useEffect(() => {
    if (!countsOpen) return;
    setObjectListQuery('');
    setExpandedType(null);
  }, [countsOpen]);

  useEffect(() => {
    if (!roomsOpen) return;
    setExpandedRoomId(null);
    setNewRoomMenuOpen(false);
  }, [roomsOpen]);

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

  const openEditRoom = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || isReadOnly) return;
    setRoomModal({
      mode: 'edit',
      roomId,
      initialName: room.name,
      initialCapacity: room.capacity,
      initialShowName: room.showName,
      initialSurfaceSqm: room.surfaceSqm,
      initialNotes: room.notes
    });
  };

  const handleCreateRoomFromRect = (rect: { x: number; y: number; width: number; height: number }) => {
    if (isReadOnly) return;
    const testRoom = { id: 'new-room', name: '', kind: 'rect', ...rect };
    if (hasRoomOverlap(testRoom)) {
      notifyRoomOverlap();
      setRoomDrawMode(null);
      return;
    }
    setRoomDrawMode(null);
    setRoomModal({ mode: 'create', kind: 'rect', rect });
  };

  const handleCreateRoomFromPoly = (points: { x: number; y: number }[]) => {
    if (isReadOnly) return;
    const testRoom = { id: 'new-room', name: '', kind: 'poly', points };
    if (hasRoomOverlap(testRoom)) {
      notifyRoomOverlap();
      setRoomDrawMode(null);
      return;
    }
    setRoomDrawMode(null);
    setRoomModal({ mode: 'create', kind: 'poly', points });
  };

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

  const shouldConfirmCapacity = useCallback(
    (type: MapObjectType, x: number, y: number) => {
      if (type !== 'user' && type !== 'real_user' && type !== 'generic_user') return false;
      const roomId = getRoomIdAt((plan as FloorPlan)?.rooms, x, y);
      if (!roomId) return false;
      const room = (rooms || []).find((r) => r.id === roomId);
      const rawCapacity = Number(room?.capacity);
      const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.floor(rawCapacity) : undefined;
      if (!capacity) return false;
      const userCount = roomStatsById.get(roomId)?.userCount || 0;
      if (userCount < capacity) return false;
      setCapacityConfirm({
        type,
        x,
        y,
        roomName: room?.name || t({ it: 'Stanza', en: 'Room' }),
        capacity
      });
      return true;
    },
    [plan, roomStatsById, rooms, t]
  );

  const handlePlaceNew = (type: MapObjectType, x: number, y: number) => {
    if (isReadOnly) return;
    if (shouldConfirmCapacity(type, x, y)) return;
    if (type === 'real_user' || type === 'user' || type === 'generic_user') {
      proceedPlaceUser(type, x, y);
      return;
    }
    setModalState({ mode: 'create', type, coords: { x, y } });
    setPendingType(null);
  };

  const handleCreate = (payload: { name: string; description?: string; layerIds?: string[]; customValues?: Record<string, any> }) => {
    if (!plan || !modalState || isReadOnly) return;
    if (modalState.mode === 'create') {
      markTouched();
      const id = addObject(
        plan.id,
        modalState.type,
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        lastObjectScale,
        payload.layerIds?.length ? payload.layerIds : inferDefaultLayerIds(modalState.type)
      );
      lastInsertedRef.current = { id, name: payload.name };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      if (roomId) updateObject(id, { roomId });
      if (payload.customValues && Object.keys(payload.customValues).length) {
        saveCustomValues(id, modalState.type, payload.customValues).catch(() => {});
      }
      push(t({ it: 'Oggetto creato', en: 'Object created' }), 'success');
      postAuditEvent({
        event: 'object_create',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { id, type: modalState.type, name: payload.name, roomId: roomId || null }
      });
    }
    if (modalState.mode === 'duplicate') {
      markTouched();
      const base = plan.objects.find((o) => o.id === modalState.objectId);
      const scale = base?.scale ?? 1;
      const id = addObject(
        plan.id,
        base?.type || 'user',
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        scale,
        payload.layerIds?.length ? payload.layerIds : inferDefaultLayerIds(base?.type || 'user')
      );
      lastInsertedRef.current = { id, name: payload.name };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      if (roomId) updateObject(id, { roomId });
      if (payload.customValues && Object.keys(payload.customValues).length) {
        saveCustomValues(id, base?.type || 'user', payload.customValues).catch(() => {});
      }
      push(t({ it: 'Oggetto duplicato', en: 'Object duplicated' }), 'success');
      postAuditEvent({
        event: 'object_duplicate',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { fromId: modalState.objectId, id, type: base?.type, name: payload.name, roomId: roomId || null }
      });
    }
  };

  const handleEdit = (objectId: string) => setModalState({ mode: 'edit', objectId });
  const openEditFromSelectionList = (objectId: string) => {
    returnToSelectionListRef.current = true;
    setSelectedObjectsModalOpen(false);
    setModalState({ mode: 'edit', objectId });
  };
  const openLinkEditFromSelectionList = (linkId: string) => {
    returnToSelectionListRef.current = true;
    setSelectedObjectsModalOpen(false);
    setLinkEditId(linkId);
  };

  const closeReturnToSelectionList = () => {
    if (!returnToSelectionListRef.current) return;
    returnToSelectionListRef.current = false;
    setSelectedObjectsModalOpen(true);
  };

  const handleUpdate = (payload: { name: string; description?: string; layerIds?: string[]; customValues?: Record<string, any> }) => {
    if (!modalState || modalState.mode !== 'edit' || isReadOnly) return;
    markTouched();
    updateObject(modalState.objectId, { name: payload.name, description: payload.description, layerIds: payload.layerIds });
    const obj = plan?.objects?.find((o) => o.id === modalState.objectId);
    if (obj && payload.customValues) {
      saveCustomValues(modalState.objectId, obj.type, payload.customValues).catch(() => {});
    }
    push(t({ it: 'Oggetto aggiornato', en: 'Object updated' }), 'success');
    postAuditEvent({
      event: 'object_update',
      scopeType: 'plan',
      scopeId: planId,
      details: { id: modalState.objectId, name: payload.name, description: payload.description || '', layerIds: payload.layerIds || [] }
    });
  };

  const handleSearch = (_term: string) => {
    // live search only highlights on Enter to avoid loops
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

  const renderObjectById = useMemo(
    () => new Map<string, any>((renderPlan?.objects || []).map((o) => [o.id, o])),
    [renderPlan?.objects]
  );
  const renderRoomById = useMemo(
    () => new Map<string, any>((renderPlan?.rooms || []).map((r) => [r.id, r])),
    [renderPlan?.rooms]
  );

  const searchIndexCacheRef = useRef<{
    key: string;
    value: { objects: { id: string; search: string }[]; rooms: { id: string; search: string }[] };
  }>({ key: '', value: { objects: [], rooms: [] } });
  const currentPlanSearchIndex = useMemo(() => {
    if (!renderPlan) return { objects: [] as { id: string; search: string }[], rooms: [] as { id: string; search: string }[] };
    const objs = renderPlan.objects || [];
    const rms = renderPlan.rooms || [];
    let key = `${objs.length}:${rms.length}`;
    for (const o of objs) {
      const extra =
        o.type === 'real_user'
          ? `${String((o as any).firstName || '')} ${String((o as any).lastName || '')}`.trim()
          : '';
      key += `|${o.id}:${o.name}:${o.description || ''}:${extra}`;
    }
    for (const r of rms) {
      key += `|r:${r.id}:${r.name || ''}`;
    }
    if (searchIndexCacheRef.current.key === key) return searchIndexCacheRef.current.value;
    const objects = objs.map((o) => {
      const extra =
        o.type === 'real_user'
          ? `${String((o as any).firstName || '')} ${String((o as any).lastName || '')}`.trim()
          : '';
      const search = `${o.name} ${o.description || ''} ${extra}`.toLowerCase();
      return { id: o.id, search };
    });
    const rooms = rms.map((r) => ({ id: r.id, search: String(r.name || '').toLowerCase() }));
    const value = { objects, rooms };
    searchIndexCacheRef.current = { key, value };
    return value;
  }, [renderPlan]);

  const clientSearchIndexRef = useRef<{
    key: string;
    value: { planId: string; search: string; result: CrossPlanSearchResult }[];
  }>({ key: '', value: [] });
  const getClientSearchIndex = useCallback(() => {
    if (!client) return [] as { planId: string; search: string; result: CrossPlanSearchResult }[];
    const key = `${client.id}:${dataVersion}`;
    if (clientSearchIndexRef.current.key === key) return clientSearchIndexRef.current.value;
    const out: { planId: string; search: string; result: CrossPlanSearchResult }[] = [];
    for (const s of client.sites || []) {
      for (const p of s.floorPlans || []) {
        for (const o of p.objects || []) {
          const label =
            o.type === 'real_user' &&
            (((o as any).firstName && String((o as any).firstName).trim()) || ((o as any).lastName && String((o as any).lastName).trim()))
              ? `${String((o as any).firstName || '').trim()} ${String((o as any).lastName || '').trim()}`.trim()
              : o.name;
          const extra = o.type === 'real_user' ? `${String((o as any).firstName || '')} ${String((o as any).lastName || '')}`.trim() : '';
          const search = `${label} ${o.name} ${o.description || ''} ${extra}`.toLowerCase();
          out.push({
            planId: p.id,
            search,
            result: {
              kind: 'object',
              clientId: client.id,
              clientName: client.shortName || client.name,
              siteId: s.id,
              siteName: s.name,
              planId: p.id,
              planName: p.name,
              objectId: o.id,
              objectType: o.type,
              objectLabel: label,
              objectDescription: o.description || ''
            }
          });
        }
        for (const r of p.rooms || []) {
          const search = `${r.name || ''}`.toLowerCase();
          out.push({
            planId: p.id,
            search,
            result: {
              kind: 'room',
              clientId: client.id,
              clientName: client.shortName || client.name,
              siteId: s.id,
              siteName: s.name,
              planId: p.id,
              planName: p.name,
              roomId: r.id,
              roomName: r.name
            }
          });
        }
      }
    }
    clientSearchIndexRef.current = { key, value: out };
    return out;
  }, [client, dataVersion]);

  const handleSearchEnter = (term: string) => {
    if (!renderPlan) return;
    if (!term.trim()) return;
    const normalized = term.toLowerCase();
    const objectMatches = currentPlanSearchIndex.objects
      .filter((o) => o.search.includes(normalized))
      .map((o) => renderObjectById.get(o.id))
      .filter(Boolean) as any[];
    const roomMatches = currentPlanSearchIndex.rooms
      .filter((r) => r.search.includes(normalized))
      .map((r) => renderRoomById.get(r.id))
      .filter(Boolean) as any[];

    const crossResults: CrossPlanSearchResult[] = client
      ? getClientSearchIndex().filter((x) => x.search.includes(normalized)).map((x) => x.result)
      : [
          ...objectMatches.map((o) => {
            const label =
              o.type === 'real_user' &&
              (((o as any).firstName && String((o as any).firstName).trim()) || ((o as any).lastName && String((o as any).lastName).trim()))
                ? `${String((o as any).firstName || '').trim()} ${String((o as any).lastName || '').trim()}`.trim()
                : o.name;
            return {
              kind: 'object',
              clientId: '',
              clientName: '',
              siteId: '',
              siteName: '',
              planId,
              planName: renderPlan.name,
              objectId: o.id,
              objectType: o.type,
              objectLabel: label,
              objectDescription: o.description || ''
            } as any;
          }),
          ...roomMatches.map(
            (r) =>
              ({
                kind: 'room',
                clientId: '',
                clientName: '',
                siteId: '',
                siteName: '',
                planId,
                planName: renderPlan.name,
                roomId: r.id,
                roomName: r.name
              }) as any
          )
        ];

    if (!crossResults.length) {
      push(t({ it: 'Nessun risultato trovato', en: 'No results found' }), 'info');
      return;
    }

    const uniquePlans = new Set(crossResults.map((r) => r.planId));
    const needsCrossPlanChooser = crossResults.some((r) => r.planId !== planId) || uniquePlans.size > 1;
    if (needsCrossPlanChooser) {
      setCrossPlanSearchTerm(term);
      setCrossPlanResults(crossResults);
      setCrossPlanSearchOpen(true);
      return;
    }
    if (objectMatches.length + roomMatches.length === 1) {
      if (objectMatches.length === 1) {
        const found = objectMatches[0];
        setSelectedObject(found.id);
        triggerHighlight(found.id);
        return;
      }
      const room = roomMatches[0];
      clearSelection();
      setSelectedRoomId(room.id);
      setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
      return;
    }
    // Multiple matches: let the user pick which one to focus
    setSearchResultsTerm(term);
    setSearchResultsIds(objectMatches.map((m) => m.id));
    setSearchRoomIds(roomMatches.map((r) => r.id));
    setSearchResultsOpen(true);
  };

  const modalInitials = useMemo(() => {
    if (!modalState || !renderPlan) return null;
    if (modalState.mode === 'create') {
      return { type: modalState.type, name: '', description: '', layerIds: inferDefaultLayerIds(modalState.type) };
    }
    const obj = renderPlan.objects.find((o) => o.id === modalState.objectId);
    if (!obj) return null;
    return {
      type: obj.type,
      name: modalState.mode === 'duplicate' ? '' : obj.name,
      description: modalState.mode === 'duplicate' ? '' : obj.description || '',
      layerIds: modalState.mode === 'duplicate' ? (obj.layerIds || inferDefaultLayerIds(obj.type)) : (obj.layerIds || inferDefaultLayerIds(obj.type))
    };
  }, [inferDefaultLayerIds, modalState, renderPlan]);

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

  const basePlan = plan as FloorPlan;
  const orderedViews = useMemo(() => {
    const list = basePlan.views || [];
    if (!list.length) return list;
    return list.slice().sort((a, b) => {
      const aDef = a.isDefault ? 1 : 0;
      const bDef = b.isDefault ? 1 : 0;
      if (aDef !== bDef) return bDef - aDef;
      return 0;
    });
  }, [basePlan.views]);
  const showPrintArea = !!(showPrintAreaByPlan as any)?.[basePlan.id];

  const linksInSelection = useMemo(() => {
    const planLinks = ((basePlan as any)?.links || []) as PlanLink[];
    const ids = selectedObjectIds;
    if (!planLinks.length) return [] as PlanLink[];
    const seen = new Set<string>();
    const out: PlanLink[] = [];
    const inSel = new Set(ids);
    for (const l of planLinks) {
      if (seen.has(l.id)) continue;
      const includeSelected = !!selectedLinkId && l.id === selectedLinkId;
      const includeBetween = ids.length > 1 && inSel.has(l.fromId) && inSel.has(l.toId);
      if (!includeSelected && !includeBetween) continue;
      seen.add(l.id);
      out.push(l);
    }
    // Put explicitly selected link first (if present).
    if (selectedLinkId) out.sort((a, b) => (a.id === selectedLinkId ? -1 : b.id === selectedLinkId ? 1 : 0));
    return out;
  }, [basePlan, selectedLinkId, selectedObjectIds]);

  const getObjectNameById = useCallback(
    (id: string) => renderPlan.objects.find((o) => o.id === id)?.name || id,
    [renderPlan.objects]
  );

  return (
    <div className="flex h-screen flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-slate-500">
            {client?.shortName || client?.name} → {site?.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-ink">{renderPlan.name}</h1>
            {!isReadOnly ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPrintAreaMode(true);
                    push(
                      t({
                        it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
                        en: 'Draw a rectangle on the map to set the print area.'
                      }),
                      'info'
                    );
                  }}
                  title={t({ it: 'Imposta area di stampa', en: 'Set print area' })}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm hover:bg-slate-50 ${
                    (basePlan as any)?.printArea ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <Crop size={16} />
                </button>
                {(basePlan as any)?.printArea ? (
                  <button
                    onClick={() => {
                      updateFloorPlan(basePlan.id, { printArea: undefined });
                      push(t({ it: 'Area di stampa rimossa correttamente', en: 'Print area removed successfully' }), 'info');
                    }}
                    title={t({ it: 'Rimuovi area di stampa', en: 'Clear print area' })}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}
            {isReadOnly ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                {activeRevision
                  ? t({ it: `Sola lettura: ${activeRevision.name}`, en: `Read-only: ${activeRevision.name}` })
                  : planAccess !== 'rw'
                    ? t({ it: 'Sola lettura (permessi)', en: 'Read-only (permissions)' })
                    : lockedByOther
                      ? t({
                          it: `Bloccata da ${lockState.lockedBy?.username || 'utente'}`,
                          en: `Locked by ${lockState.lockedBy?.username || 'user'}`
                        })
                      : t({ it: 'Sola lettura', en: 'Read-only' })}
              </span>
            ) : null}
            {presenceUsers.length ? (
              <span
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                title={presenceUsers.map((u) => u.username).join(', ')}
              >
                {t({ it: `${presenceUsers.length} utenti online`, en: `${presenceUsers.length} users online` })}
              </span>
            ) : null}
            <div className="relative">
              <button
                onClick={() => setCountsOpen((v) => !v)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                title={t({ it: 'Numero oggetti', en: 'Object count' })}
              >
                {t({ it: `${renderPlan.objects.length} oggetti`, en: `${renderPlan.objects.length} objects` })}
              </button>
	              {countsOpen ? (
	                <div className="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
	                  <div className="flex items-center justify-between px-2 pb-2">
	                    <div className="text-sm font-semibold text-ink">
                        {t({ it: 'Dettaglio oggetti', en: 'Objects' })}
                      </div>
	                    <button onClick={() => setCountsOpen(false)} className="text-slate-400 hover:text-ink">
	                      <X size={14} />
	                    </button>
	                  </div>
	                  <div className="px-2 pb-2">
	                    <input
	                      value={objectListQuery}
	                      onChange={(e) => setObjectListQuery(e.target.value)}
	                      placeholder={t({ it: 'Cerca oggetto…', en: 'Search object…' })}
	                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
	                    />
	                  </div>
	                  <div className="space-y-1">
	                    {objectListQuery.trim() ? (
	                      <>
		                        {objectListMatches.map((o) => {
		                          const label = getTypeLabel(o.type);
                              const icon = getTypeIcon(o.type);
		                          return (
		                            <button
		                              key={o.id}
	                              onClick={() => {
	                                setSelectedObject(o.id);
	                                triggerHighlight(o.id);
	                                setCountsOpen(false);
	                              }}
	                              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
		                            >
		                              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
		                                <Icon name={icon} />
		                              </span>
		                              <div className="min-w-0 flex-1">
		                                <div className="truncate font-semibold text-ink">{o.name}</div>
		                                <div className="truncate text-xs text-slate-500">{label}</div>
		                              </div>
		                            </button>
		                          );
		                        })}
	                        {!objectListMatches.length ? (
	                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              {t({ it: 'Nessun risultato.', en: 'No results.' })}
                            </div>
	                        ) : null}
	                      </>
	                    ) : (
	                      <>
		                        {counts.map((t) => (
		                          <div key={t.id} className="rounded-lg border border-slate-100">
		                            <button
		                              onClick={() => setExpandedType(expandedType === t.id ? null : t.id)}
		                              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
		                            >
		                              <span className="flex items-center gap-2 font-semibold text-ink">
		                                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
		                                  <Icon name={t.icon} />
		                                </span>
		                                {t.count}× {t.label}
		                              </span>
		                              <ChevronDown size={16} className="text-slate-400" />
		                            </button>
		                            {expandedType === t.id ? (
		                              <div className="px-2 pb-2 text-sm text-slate-700">
		                                {(objectsByType.get(t.id) || []).map((o) => (
		                                  <button
		                                    key={o.id}
		                                    onClick={() => {
	                                      setSelectedObject(o.id);
	                                      triggerHighlight(o.id);
	                                      setCountsOpen(false);
	                                    }}
		                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-slate-50"
		                                  >
		                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
		                                      <Icon name={getTypeIcon(o.type)} />
		                                    </span>
		                                    <span className="truncate">{o.name}</span>
		                                  </button>
		                                ))}
		                              </div>
		                            ) : null}
		                          </div>
		                        ))}
	                        {!renderPlan.objects.length ? (
	                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              {t({ it: 'Nessun oggetto.', en: 'No objects.' })}
                            </div>
	                        ) : null}
	                      </>
	                    )}
	                  </div>
	                </div>
	              ) : null}
	            </div>
            <div className="relative">
              <button
                onClick={() => setRoomsOpen((v) => !v)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                title={t({ it: 'Stanze', en: 'Rooms' })}
              >
                {rooms.length} {t({ it: 'stanze', en: 'rooms' })}
              </button>
              {roomsOpen ? (
                <div className="absolute left-0 z-50 mt-2 w-96 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="text-sm font-semibold text-ink">{t({ it: 'Stanze', en: 'Rooms' })}</div>
                    <button onClick={() => setRoomsOpen(false)} className="text-slate-400 hover:text-ink">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="px-2 pb-2">
                    {!isReadOnly ? (
                      <div className="relative">
                        <button
                          onClick={() => setNewRoomMenuOpen((v) => !v)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                        >
                          <Square size={16} /> {t({ it: 'Nuova stanza', en: 'New room' })}
                          <ChevronDown size={16} className="text-white/90" />
                        </button>
                        {newRoomMenuOpen ? (
                          <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                            <button
                              onClick={() => {
                                setNewRoomMenuOpen(false);
                                beginRoomDraw();
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Square size={16} className="text-slate-500" /> {t({ it: 'Rettangolo', en: 'Rectangle' })}
                            </button>
                            <button
                              onClick={() => {
                                setNewRoomMenuOpen(false);
                                beginRoomPolyDraw();
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Square size={16} className="text-slate-500" /> {t({ it: 'Poligono', en: 'Polygon' })}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {t({ it: 'Sola lettura.', en: 'Read-only.' })}
                      </div>
                    )}
                    {roomDrawMode && !isReadOnly ? (
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        <span>{t({ it: 'Modalità disegno attiva', en: 'Drawing mode active' })}</span>
                        <button
                          onClick={() => setRoomDrawMode(null)}
                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Esc
                        </button>
                      </div>
                    ) : null}
                    <button
                      onClick={() => setRoomAllocationOpen(true)}
                      disabled={!rooms.length}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Users size={16} /> {t({ it: 'Trova capienza', en: 'Find capacity' })}
                    </button>
                  </div>
                  <div className="max-h-96 space-y-2 overflow-auto px-2 pb-2">
                    {rooms.length ? (
                      rooms.map((room) => {
                        const isExpanded = expandedRoomId === room.id;
                        const stats =
                          roomStatsById.get(room.id) || ({ items: [], userCount: 0, otherCount: 0, totalCount: 0 } as const);
                        const assigned = stats.items;
                        const rawCapacity = Number(room.capacity);
                        const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.floor(rawCapacity) : undefined;
                        const capacityLabel = capacity ? `${stats.userCount}/${capacity}` : null;
                        const overCapacity = capacity ? stats.userCount > capacity : false;
                        return (
                          <div key={room.id} className="rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 px-3 py-2.5">
                              <button
                                onClick={() => {
                                  setExpandedRoomId(isExpanded ? null : room.id);
                                  clearSelection();
                                  setSelectedRoomId(room.id);
                                  setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
                                }}
                                className={`min-w-0 flex-1 text-left text-sm ${
                                  selectedRoomId === room.id ? 'font-semibold text-ink' : 'text-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate">{room.name}</div>
                                  {capacityLabel ? (
                                    <span
                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        overCapacity ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {capacityLabel}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {t({
                                    it: `${stats.otherCount} oggetti · ${stats.userCount} utenti (tot ${stats.totalCount})`,
                                    en: `${stats.otherCount} objects · ${stats.userCount} users (tot ${stats.totalCount})`
                                  })}
                                </div>
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  title={t({ it: 'Evidenzia', en: 'Highlight' })}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRoomId(room.id);
                                    setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
                                >
                                  <LocateFixed size={14} />
                                </button>
                                {!isReadOnly ? (
                                  <>
                                    <button
                                      title={t({ it: 'Rinomina', en: 'Rename' })}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditRoom(room.id);
                                        setRoomsOpen(false);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      title={t({ it: 'Elimina', en: 'Delete' })}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteRoomId(room.id);
                                        setRoomsOpen(false);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    >
                                      <Trash size={14} />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {isExpanded ? (
                              <div className="border-t border-slate-100 px-3 pb-2 pt-2">
                                {assigned.length ? (
                                  <div className="space-y-1">
                                    {assigned.map((o) => (
                                      <button
                                        key={o.id}
                                        onClick={() => {
                                          setSelectedObject(o.id);
                                          triggerHighlight(o.id);
                                          setRoomsOpen(false);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                                      >
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
                                          <Icon name={getTypeIcon(o.type)} />
                                        </span>
                                        <span className="truncate">{o.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    {t({ it: 'Nessun oggetto in questa stanza.', en: 'No objects in this room.' })}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {t({
                          it: 'Nessuna stanza. Crea una stanza per organizzare gli oggetti.',
                          en: 'No rooms. Create a room to organize objects.'
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="ml-1 flex h-9 items-center gap-2">
              {selectedObjectId ? (
                <>
                  <span className="text-sm font-semibold text-slate-600">
                    {t({ it: 'Selezionato:', en: 'Selected:' })}
                  </span>
                  <span className="max-w-[220px] truncate rounded-full bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">
                    {selectedObjectIds.length > 1 || linksInSelection.length
                      ? t({
                          it: `${selectedObjectIds.length + linksInSelection.length} elementi`,
                          en: `${selectedObjectIds.length + linksInSelection.length} items`
                        })
                      : renderPlan.objects.find((o) => o.id === selectedObjectId)?.name}
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Modifica', en: 'Edit' })}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete([...selectedObjectIds])}
                    disabled={isReadOnly}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    title={t({ it: 'Elimina', en: 'Delete' })}
                  >
                    <Trash size={14} />
                  </button>
                </>
              ) : selectedLinkId ? (
                <>
                  <span className="text-sm font-semibold text-slate-600">{t({ it: 'Collegamento:', en: 'Link:' })}</span>
                  <span className="max-w-[320px] truncate rounded-full bg-slate-100 px-2 py-1 text-sm font-semibold text-ink">
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Modifica', en: 'Edit' })}
                  >
                    <Pencil size={14} />
                  </button>
                </>
              ) : (
                selectedRoomId ? (
                  <>
                    <span className="text-sm font-semibold text-slate-600">{t({ it: 'Stanza:', en: 'Room:' })}</span>
                    <span className="max-w-[220px] truncate rounded-full bg-slate-100 px-2 py-1 text-sm font-semibold text-ink">
                      {rooms.find((r) => r.id === selectedRoomId)?.name || t({ it: 'Stanza', en: 'Room' })}
                    </span>
                    {!isReadOnly ? (
                      <>
                        <button
                          onClick={() => openEditRoom(selectedRoomId)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Rinomina stanza', en: 'Rename room' })}
                        >
                          <Pencil size={14} />
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
          <SearchBar onSearch={handleSearch} onEnter={handleSearchEnter} inputRef={searchInputRef} className="w-96" />
          {!isReadOnly ? (
            <button
              onClick={() => {
                if (!plan) return;
                if (!hasUnsavedChanges) {
                  push(t({ it: 'Nessuna modifica da salvare', en: 'No changes to save' }), 'info');
                  return;
                }
                setSaveRevisionOpen(true);
              }}
              title={t({ it: 'Salva revisione', en: 'Save revision' })}
              disabled={!hasUnsavedChanges}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-card ${
                hasUnsavedChanges
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-400 opacity-60'
              }`}
            >
              <Save size={18} />
            </button>
          ) : null}
          <button
            onClick={() => setRevisionsOpen(true)}
            title={t({ it: 'Time machine', en: 'Time machine' })}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
          >
            <History size={18} />
          </button>
          <div className="relative">
            <button
              onClick={() => setViewsMenuOpen((v) => !v)}
              disabled={isReadOnly}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50 disabled:opacity-60"
              title={t({ it: 'Viste', en: 'Views' })}
            >
              <Eye size={18} className="text-slate-700" />
            </button>
            {viewsMenuOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                <div className="flex items-center justify-between px-2 pb-2">
                  <div className="text-sm font-semibold text-ink">{t({ it: 'Viste salvate', en: 'Saved views' })}</div>
                  <button
                    onClick={() => setViewsMenuOpen(false)}
                    className="text-slate-400 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSelectedViewId('__last__');
                      setViewsMenuOpen(false);
                      push(t({ it: 'Vista: ultima posizione', en: 'View: last position' }), 'info');
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                      selectedViewId === '__last__' ? 'bg-slate-100 font-semibold' : ''
                    }`}
                  >
                    <Eye size={16} className="text-slate-500" />
                    {t({ it: 'Ultima posizione', en: 'Last position' })}
                  </button>
                  {orderedViews.map((view) => (
                    <div key={view.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-2 py-2 hover:bg-slate-50">
                      <button
                        onClick={() => {
                          applyView(view);
                          setViewsMenuOpen(false);
                        }}
                        className={`flex min-w-0 flex-1 items-start gap-2 text-left text-sm ${
                          selectedViewId === view.id ? 'font-semibold' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-ink">{view.name}</div>
                          {view.description ? (
                            <div className="truncate text-xs text-slate-500">{view.description}</div>
                          ) : null}
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          title={t({ it: view.isDefault ? 'Vista di default' : 'Rendi default', en: view.isDefault ? 'Default view' : 'Make default' })}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!view.isDefault) setConfirmSetDefaultViewId(view.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-white"
                        >
                          <Star size={14} className={view.isDefault ? 'text-amber-500' : 'text-slate-400'} />
                        </button>
                        <button
                          title={t({ it: 'Elimina vista', en: 'Delete view' })}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (view.isDefault && (basePlan.views || []).length > 1) {
                              setChooseDefaultModal({ deletingViewId: view.id });
                              return;
                            }
                            setConfirmDeleteViewId(view.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <button
                    onClick={() => {
                      setViewsMenuOpen(false);
                      setViewModalOpen(true);
                    }}
                    className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    {t({ it: 'Salva nuova vista', en: 'Save new view' })}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div ref={gridMenuRef} className="relative">
              <button
                onClick={() => setGridMenuOpen((v) => !v)}
                title={t({ it: 'Griglia', en: 'Grid' })}
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
            <ExportButton onClick={() => setExportModalOpen(true)} />
            <VersionBadge />
            <button
              onClick={togglePerfOverlay}
              title={t({ it: 'Telemetria prestazioni', en: 'Performance telemetry' })}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-card ${
                perfEnabled
                  ? 'border-ink bg-ink text-white hover:bg-ink/90'
                  : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
            >
              <Activity size={18} />
            </button>
            <button
              onClick={() => {
                if (hasNavigationEdits && !isReadOnly) {
                  requestSaveAndNavigate('/settings');
                  return;
                }
                navigate('/settings');
              }}
              title={t({ it: 'Impostazioni', en: 'Settings' })}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
            >
              <Cog size={18} />
            </button>
            <button
              onClick={openHelp}
              title={t({ it: 'Aiuto', en: 'Help' })}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-card hover:bg-slate-50"
            >
              <HelpCircle size={18} />
            </button>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="relative flex h-full min-h-0 gap-4 overflow-hidden">
	        <div className="flex-1 min-w-0 min-h-0">
	            <div className="relative h-full min-h-0 w-full" ref={mapRef}>
				              <CanvasStage
                        ref={canvasStageRef}
				                containerRef={mapRef}
				                plan={(canvasPlan || renderPlan) as any}
				                selectedId={selectedObjectId}
				                selectedIds={selectedObjectIds}
	                    selectedRoomId={selectedRoomId}
	                    selectedLinkId={selectedLinkId}
				                highlightId={highlight?.objectId}
				                highlightUntil={highlight?.until}
	                    highlightRoomId={highlightRoom?.roomId}
	                    highlightRoomUntil={highlightRoom?.until}
				                pendingType={pendingType}
				                readOnly={isReadOnly}
	                    roomDrawMode={roomDrawMode}
                      printArea={(basePlan as any)?.printArea || null}
                      printAreaMode={printAreaMode}
                      showPrintArea={showPrintArea}
                      onSetPrintArea={(rect) => {
                        if (isReadOnly) return;
                        updateFloorPlan(basePlan.id, { printArea: rect });
                        setPrintAreaMode(false);
                        push(t({ it: 'Area di stampa impostata correttamente', en: 'Print area set successfully' }), 'success');
                      }}
	                    objectTypeIcons={objectTypeIcons}
                      snapEnabled={gridSnapEnabled}
                      gridSize={gridSize}
                      showGrid={showGrid}
				                zoom={zoom}
				                pan={pan}
				                autoFit={autoFitEnabled && !hasDefaultView}
                      perfEnabled={perfEnabled}
			                onZoomChange={handleZoomChange}
			                onPanChange={handlePanChange}
					                onSelect={handleStageSelect}
                      roomStatsById={roomStatsById}
	                    onSelectLink={(id) => {
	                      setSelectedLinkId(id || null);
	                      setContextMenu(null);
	                      clearSelection();
	                      setSelectedRoomId(undefined);
	                    }}
	                  onSelectMany={(ids) => {
	                    setSelectedRoomId(undefined);
                      setSelectedLinkId(null);
	                    setSelection(ids);
	                    setContextMenu(null);
	                  }}
					                onMove={handleStageMove}
					                onPlaceNew={handlePlaceNew}
		                onEdit={handleEdit}
		        onContextMenu={handleObjectContextMenu}
                    onLinkContextMenu={handleLinkContextMenu}
                    onRoomContextMenu={handleRoomContextMenu}
                    onLinkDblClick={(id) => {
                      if (isReadOnly) return;
                      setLinkEditId(id);
                    }}
		                onMapContextMenu={handleMapContextMenu}
	                onGoDefaultView={goToDefaultView}
                    onSelectRoom={(roomId, options) => {
                      clearSelection();
                      setSelectedRoomId(roomId);
                      if (!options?.keepContext) setContextMenu(null);
                    }}
                    onOpenRoomDetails={(roomId) => {
                      setSelectedRoomId(roomId);
                      openEditRoom(roomId);
                    }}
                    onCreateRoom={(shape) => {
                      if (shape.kind === 'rect') handleCreateRoomFromRect(shape.rect);
                      else handleCreateRoomFromPoly(shape.points);
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
                      const nextRooms = ((plan as FloorPlan).rooms || []).map((r) => (r.id === roomId ? { ...r, ...payload } : r));
                      updateRoom((plan as FloorPlan).id, roomId, payload as any);
                      const updates = computeRoomReassignments(nextRooms, (plan as FloorPlan).objects);
                      if (Object.keys(updates).length) setObjectRoomIds((plan as FloorPlan).id, updates);
                    }}
	              />
	            </div>
	          </div>
            {linkCreateHint ? (
              <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
                <div className="max-w-[720px] rounded-2xl bg-slate-900/90 px-4 py-3 text-white shadow-card backdrop-blur">
                  <div className="text-sm font-semibold">{linkCreateHint.title}</div>
                  <div className="mt-0.5 text-xs text-white/80">{linkCreateHint.subtitle}</div>
                </div>
              </div>
            ) : null}
            {overlapNotice ? (
              <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-card">
                  {overlapNotice}
                </div>
              </div>
            ) : null}
		          {!isReadOnly ? (
		            <aside className="sticky top-0 h-fit w-28 shrink-0 self-start rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
		            <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-500">
	                <span>{t({ it: 'Palette', en: 'Palette' })}</span>
	                  <div className="flex items-center gap-1">
	                    <button
	                      onClick={() => {
	                        if (hasNavigationEdits && !isReadOnly) {
	                          requestSaveAndNavigate('/settings?tab=objects');
	                          return;
	                        }
	                        navigate('/settings?tab=objects');
	                      }}
	                      title={t({ it: 'Gestisci palette', en: 'Manage palette' })}
	                      className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
	                    >
	                      <Star size={14} />
	                    </button>
	                    <button
	                      onClick={() => {
	                        if (hasNavigationEdits && !isReadOnly) {
	                          requestSaveAndNavigate('/settings?tab=objects');
	                          return;
	                        }
	                        navigate('/settings?tab=objects');
	                      }}
	                      title={t({ it: 'Impostazioni oggetti', en: 'Object settings' })}
	                      className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
	                    >
	                      <Pencil size={14} />
	                    </button>
	                  </div>
	              </div>
                {planLayers.length ? (
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold uppercase text-slate-500">{t({ it: 'Livelli', en: 'Layers' })}</div>
                    <div className="mt-2 flex flex-col gap-2">
                      {planLayers.map((l: any) => {
                        const isOn = visibleLayerIds.includes(l.id);
                        const label = (l?.name?.[lang] as string) || (l?.name?.it as string) || l.id;
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleLayerVisibility(planId, l.id)}
                            className={`flex items-center justify-between rounded-xl border px-2 py-1 text-[11px] font-semibold ${
                              isOn ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                            title={label}
                          >
                            <span className="truncate">{label}</span>
                            <span
                              className="ml-2 h-2 w-2 shrink-0 rounded-full"
                              style={{ background: l.color || (isOn ? '#2563eb' : '#cbd5e1') }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
			            <div className="mt-3 flex flex-col items-center gap-3">
				              <Toolbar
                      defs={objectTypeDefs || []}
                      order={paletteOrder}
                      onSelectType={(type) => setPendingType(type)}
                      onRemoveFromPalette={(type) => removeTypeFromPalette(type)}
                      activeType={pendingType}
                    />
			            </div>
                {/* Bottom action: show all types when favorites are enabled */}
                {paletteHasCustom && paletteHasMore ? (
                  <button
                    onClick={() => setAllTypesOpen(true)}
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

      {contextMenu && plan ? (
        <>
        <div
          className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-semibold text-ink">{t({ it: 'Menu', en: 'Menu' })}</span>
            <button
              onClick={() => setContextMenu(null)}
              className="text-slate-400 hover:text-ink"
              title={t({ it: 'Chiudi', en: 'Close' })}
            >
              <X size={14} />
            </button>
          </div>

	          {contextMenu.kind === 'link' ? (
              <>
                <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600">
                  {t({ it: 'Collegamento selezionato', en: 'Selected link' })}
                  {contextLink ? (
                    <div className="mt-1 text-[11px] font-normal text-slate-600">
                      {(() => {
                        const from = renderPlan.objects.find((o) => o.id === contextLink.fromId);
                        const to = renderPlan.objects.find((o) => o.id === contextLink.toId);
                        return `${from?.name || contextLink.fromId} → ${to?.name || contextLink.toId}`;
                      })()}
                    </div>
                  ) : null}
                </div>
                {!isReadOnly ? (
                  <button
                    onClick={() => {
                      if (contextMenu.kind !== 'link') return;
                      setLinkEditId(contextMenu.id);
                      setContextMenu(null);
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <Pencil size={14} /> {t({ it: 'Modifica descrizione', en: 'Edit description' })}
                  </button>
                ) : null}
	                {!isReadOnly ? (
                    (contextLink as any)?.kind === 'cable' ? (
                      <button
                        onClick={() => {
                          if (contextMenu.kind !== 'link') return;
                          setCableModal({ mode: 'edit', linkId: contextMenu.id });
                          setContextMenu(null);
                        }}
                        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      >
                        <Pencil size={14} /> {t({ it: 'Modifica stile', en: 'Edit style' })}
                      </button>
                    ) : null
                  ) : null}
                  {!isReadOnly ? (
	                  <button
	                    onClick={() => {
	                      if (contextMenu.kind !== 'link') return;
	                      markTouched();
	                      deleteLink(basePlan.id, contextMenu.id);
                      postAuditEvent({ event: 'link_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: contextMenu.id } });
                      push(t({ it: 'Collegamento eliminato', en: 'Link deleted' }), 'info');
                      setContextMenu(null);
                      setSelectedLinkId(null);
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash size={14} /> {t({ it: 'Elimina collegamento', en: 'Delete link' })}
                  </button>
                ) : null}
              </>
            ) : contextMenu.kind === 'object' ? (
	            <>
              {contextIsMulti ? (
                <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600">
                  {t({ it: `${selectedObjectIds.length} oggetti selezionati`, en: `${selectedObjectIds.length} objects selected` })}
                </div>
              ) : (
	                <>
                  <button
                    onClick={() => {
                      handleEdit(contextMenu.id);
                      setContextMenu(null);
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                  </button>
                  {contextObject?.type === 'real_user' ? (
                    <button
                      onClick={() => {
                        setRealUserDetailsId(contextMenu.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Mostra dettagli importati dell’utente reale', en: 'Show imported details for this real user' })}
                    >
                      <User size={14} className="text-slate-500" /> {t({ it: 'Dettagli utente', en: 'User details' })}
                    </button>
                  ) : null}
                  {contextObjectLinkCount ? (
                    <button
                      onClick={() => {
                        setLinksModalObjectId(contextMenu.id);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Mostra tutti i collegamenti di questo oggetto', en: 'Show all links for this object' })}
                    >
                      <Link2 size={14} className="text-slate-500" />{' '}
                      {t({
                        it: `Mostra collegamenti (${contextObjectLinkCount})`,
                        en: `Show links (${contextObjectLinkCount})`
                      })}
                    </button>
                  ) : null}
                  <div className="my-2 h-px bg-slate-100" />
		                  <button
		                    onClick={() => {
		                      if (isReadOnly) return;
                          setLinkCreateMode('arrow');
		                      setLinkFromId(contextMenu.id);
		                      setContextMenu(null);
	                    }}
		                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
		                  >
		                    <MoveDiagonal size={14} className="text-slate-500" /> {t({ it: 'Crea collegamento', en: 'Create link' })}
		                  </button>
                      <button
                        onClick={() => {
                          if (isReadOnly) return;
                          setLinkCreateMode('cable');
                          setLinkFromId(contextMenu.id);
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      >
                        <CornerDownRight size={14} className="text-slate-500" /> {t({ it: 'Crea collegamento 90°', en: 'Create 90° link' })}
                      </button>
                      <div className="my-2 h-px bg-slate-100" />
		                  <button
		                    onClick={() => {
		                      openDuplicate(contextMenu.id);
		                      setContextMenu(null);
		                    }}
	                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                  >
	                    <Copy size={14} /> {t({ it: 'Duplica', en: 'Duplicate' })}
	                  </button>
                  <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <MoveDiagonal size={14} /> {t({ it: 'Scala', en: 'Scale' })}
                      <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                        {(contextObject?.scale ?? 1).toFixed(2)}
                      </span>
                    </div>
	                    <input
	                      key={contextMenu.id}
	                      type="range"
	                      min={0.2}
	                      max={2.4}
	                      step={0.05}
	                      value={contextObject?.scale ?? 1}
	                      onChange={(e) => {
	                        const next = Number(e.target.value);
	                        updateObject(contextMenu.id, { scale: next });
	                        useUIStore.getState().setLastObjectScale(next);
                      }}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div className="my-2 h-px bg-slate-100" />
                </>
              )}

              {contextIsMulti ? (
                !isReadOnly && selectedObjectIds.length === 2 ? (
                  <button
                    onClick={() => {
                      const [a, b] = selectedObjectIds;
                      if (!a || !b) return;
                      const links = (((basePlan as any).links || []) as any[]).filter(Boolean);
                      const existing = links.find(
                        (l) =>
                          (String((l as any).fromId || '') === a && String((l as any).toId || '') === b) ||
                          (String((l as any).fromId || '') === b && String((l as any).toId || '') === a)
                      );
                      if (existing) {
                        setSelectedLinkId(String(existing.id));
                        push(t({ it: 'Collegamento già presente', en: 'Link already exists' }), 'info');
                        setContextMenu(null);
                        return;
                      }
                      markTouched();
                      const id = addLink(basePlan.id, a, b, { kind: 'arrow' });
                      postAuditEvent({ event: 'link_create', scopeType: 'plan', scopeId: basePlan.id, details: { id, fromId: a, toId: b, kind: 'arrow' } });
                      setSelectedLinkId(id);
                      push(t({ it: 'Collegamento creato', en: 'Link created' }), 'success');
                      setContextMenu(null);
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                    title={t({
                      it: 'Crea un collegamento lineare tra i 2 oggetti selezionati (se non esiste già).',
                      en: 'Creates a straight link between the 2 selected objects (if it does not already exist).'
                    })}
                  >
                    <Link2 size={14} className="text-slate-500" /> {t({ it: 'Collega oggetti', en: 'Link objects' })}
                  </button>
                ) : null
              ) : null}

              {contextIsMulti ? (
                <button
                  onClick={() => {
                    setBulkEditSelectionOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <Pencil size={14} /> {t({ it: 'Modifica rapida oggetti', en: 'Quick edit objects' })}
                </button>
              ) : null}
              {contextIsMulti ? <div className="my-2 h-px bg-slate-100" /> : null}
              <button
                onClick={() => {
                  const ids =
                    selectedObjectIds.includes(contextMenu.id) && selectedObjectIds.length > 1
                      ? [...selectedObjectIds]
                      : [contextMenu.id];
                  setConfirmDelete(ids);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
              >
                <Trash size={14} /> {t({ it: 'Elimina', en: 'Delete' })}
              </button>
            </>
          ) : contextMenu.kind === 'room' ? (
            <>
              <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600">
                {t({ it: 'Stanza selezionata', en: 'Selected room' })}
                <div className="mt-1 text-[11px] font-normal text-slate-600">
                  {rooms.find((r) => r.id === contextMenu.id)?.name || t({ it: 'Stanza', en: 'Room' })}
                </div>
              </div>
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    openEditRoom(contextMenu.id);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <Pencil size={14} /> {t({ it: 'Rinomina', en: 'Rename' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    setConfirmDeleteRoomId(contextMenu.id);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                >
                  <Trash size={14} /> {t({ it: 'Elimina stanza', en: 'Delete room' })}
                </button>
              ) : null}
            </>
          ) : (
            <>
              {!isReadOnly ? (
                <button
                onClick={() => {
                  setViewModalOpen(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <BookmarkPlus size={14} className="text-slate-500" /> {t({ it: 'Salva vista', en: 'Save view' })}
              </button>
              ) : null}
              <div className="my-2 h-px bg-slate-100" />
              {!isReadOnly ? (
                <button
                  onClick={() => setContextMenu({ ...contextMenu, roomOpen: !contextMenu.roomOpen, addOpen: false })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Nuova stanza', en: 'New room' })}
                  <ChevronRight size={14} className="ml-auto text-slate-400" />
                </button>
              ) : null}
              <button
                onClick={() => {
                  goToDefaultView();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <Home size={14} className="text-slate-500" /> {t({ it: 'Vai a default', en: 'Go to default' })}
              </button>
              {!isReadOnly ? (
                <button
                onClick={() => setContextMenu({ ...contextMenu, addOpen: !contextMenu.addOpen })}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <Plus size={14} className="text-slate-500" /> {t({ it: 'Aggiungi oggetto', en: 'Add object' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              ) : null}
              {!isReadOnly ? (
                <button
                onClick={() => {
                  setConfirmClearObjects(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
              >
                <Trash size={14} /> {t({ it: 'Elimina tutti gli oggetti', en: 'Delete all objects' })}
              </button>
              ) : null}
              <div className="my-2 h-px bg-slate-100" />
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if ((basePlan as any)?.printArea) {
                      updateFloorPlan(basePlan.id, { printArea: undefined });
                      setContextMenu(null);
                      push(t({ it: 'Area di stampa rimossa correttamente', en: 'Print area removed successfully' }), 'info');
                      return;
                    }
                    setPrintAreaMode(true);
                    setContextMenu(null);
                    push(
                      t({
                        it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
                        en: 'Draw a rectangle on the map to set the print area.'
                      }),
                      'info'
                    );
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <Crop size={14} className="text-slate-500" />{' '}
                  {(basePlan as any)?.printArea
                    ? t({ it: 'Rimuovi area di stampa', en: 'Clear print area' })
                    : t({ it: 'Imposta area di stampa', en: 'Set print area' })}
                </button>
              ) : null}
              {(basePlan as any)?.printArea ? (
                <button
                  onClick={() => {
                    toggleShowPrintArea(basePlan.id);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Mostra/nascondi area di stampa come overlay', en: 'Show/hide the print area overlay' })}
                >
                  {showPrintArea ? <EyeOff size={14} className="text-slate-500" /> : <Eye size={14} className="text-slate-500" />}{' '}
                  {showPrintArea
                    ? t({ it: 'Nascondi area di stampa', en: 'Hide print area' })
                    : t({ it: 'Mostra area di stampa', en: 'Show print area' })}
                </button>
              ) : null}
              <button
                onClick={() => {
                  setExportModalOpen(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <FileDown size={14} className="text-slate-500" /> {t({ it: 'Esporta PDF', en: 'Export PDF' })}
              </button>
            </>
          )}
        </div>

        {contextMenu.kind !== 'object' && contextMenu.kind !== 'link' && (contextMenu as any).addOpen ? (
          <div
            className="fixed z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={{ top: contextMenu.y, left: contextMenu.x + 236 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Aggiungi oggetto', en: 'Add object' })}</div>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2">
              {mapAddMenuTypes.map((def) => (
                <button
                  key={def.id}
                  onClick={() => {
                    if ((contextMenu as any).kind !== 'map') return;
                    if (def.id === 'real_user' || def.id === 'user' || def.id === 'generic_user') {
                      const worldX = (contextMenu as any).worldX;
                      const worldY = (contextMenu as any).worldY;
                      if (!shouldConfirmCapacity(def.id as MapObjectType, worldX, worldY)) {
                        proceedPlaceUser(def.id as MapObjectType, worldX, worldY);
                      }
                      setContextMenu(null);
                      return;
                    }
                    setModalState({
                      mode: 'create',
                      type: def.id,
                      coords: { x: (contextMenu as any).worldX, y: (contextMenu as any).worldY }
                    });
                    setContextMenu(null);
                  }}
                  className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  title={getTypeLabel(def.id)}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                    <Icon name={def.icon} />
                  </span>
                  <span className="leading-tight">{getTypeLabel(def.id)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {contextMenu.kind !== 'object' && contextMenu.kind !== 'link' && (contextMenu as any).roomOpen && !isReadOnly ? (
          <div
            className="fixed z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={{ top: contextMenu.y + 40, left: contextMenu.x + 236 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Nuova stanza', en: 'New room' })}</div>
            <button
              onClick={() => {
                beginRoomDraw();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Square size={14} className="text-slate-500" /> {t({ it: 'Rettangolo', en: 'Rectangle' })}
            </button>
            <button
              onClick={() => {
                beginRoomPolyDraw();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Square size={14} className="text-slate-500" /> {t({ it: 'Poligono', en: 'Polygon' })}
            </button>
          </div>
        ) : null}
        </>
      ) : null}

      <ObjectModal
		        open={!!modalState}
            objectId={modalState?.mode === 'edit' ? (modalState as any).objectId : undefined}
		        type={modalInitials?.type}
	          icon={modalInitials?.type ? getTypeIcon(modalInitials.type) : undefined}
            layers={planLayers.filter((l: any) => l.id !== 'rooms').map((l: any) => ({ id: l.id, label: (l?.name?.[lang] as string) || (l?.name?.it as string) || l.id, color: l.color }))}
            initialLayerIds={(modalInitials as any)?.layerIds || []}
		        typeLabel={
		          modalState?.mode === 'create'
		            ? `${t({ it: 'Nuovo', en: 'New' })} ${modalInitials?.type ? getTypeLabel(modalInitials.type) : ''} (${Math.round((modalState as any)?.coords?.x || 0)}, ${Math.round(
		                (modalState as any)?.coords?.y || 0
		              )})`
		            : undefined
		        }
		        initialName={modalInitials?.name}
		        initialDescription={modalInitials?.description}
            readOnly={isReadOnly}
		        onClose={() => {
              setModalState(null);
              closeReturnToSelectionList();
            }}
		        onSubmit={modalState?.mode === 'edit' ? handleUpdate : handleCreate}
		      />

      <SelectedObjectsModal
        open={selectedObjectsModalOpen}
        objects={
          selectedObjectIds
            .map((id) => renderPlan.objects.find((o) => o.id === id))
            .filter(Boolean) as MapObject[]
        }
        links={linksInSelection}
        getTypeLabel={getTypeLabel}
        getTypeIcon={getTypeIcon}
        getObjectName={getObjectNameById}
        onPickObject={openEditFromSelectionList}
        onPickLink={openLinkEditFromSelectionList}
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

      <RealUserPickerModal
        open={!!realUserPicker}
        clientId={client?.id || ''}
        clientName={client?.name || client?.shortName || ''}
        assignedCounts={assignedCounts}
        onClose={() => setRealUserPicker(null)}
        onSelect={(u) => {
          if (!plan || !realUserPicker || isReadOnly) return;
          markTouched();
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
            lastObjectScale,
            ['users'],
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
          lastInsertedRef.current = { id, name };
          const roomId = getRoomIdAt((plan as FloorPlan).rooms, realUserPicker.x, realUserPicker.y);
          if (roomId) updateObject(id, { roomId });
          push(t({ it: 'Utente reale inserito', en: 'Real user placed' }), 'success');
          postAuditEvent({
            event: 'real_user_place',
            scopeType: 'plan',
            scopeId: plan.id,
            details: { id, externalId: u.externalId, name, roomId: roomId || null }
          });
          setRealUserPicker(null);
          setPendingType(null);
        }}
      />

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
                <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Import utenti richiesto', en: 'User import required' })}</Dialog.Title>
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

      <RoomModal
        open={!!roomModal}
        initialName={roomModal?.mode === 'edit' ? roomModal.initialName : ''}
        initialColor={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.color
            : undefined
        }
        initialCapacity={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.capacity
            : undefined
        }
        initialLabelScale={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.labelScale
            : undefined
        }
        initialShowName={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.showName
            : undefined
        }
        initialSurfaceSqm={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.surfaceSqm
            : undefined
        }
        initialNotes={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.notes
            : undefined
        }
        objects={roomModal?.mode === 'edit' ? roomStatsById.get(roomModal.roomId)?.items || [] : undefined}
        getTypeLabel={getTypeLabel}
        getTypeIcon={getTypeIcon}
        isUserObject={isUserObject}
        onDeleteObject={
          !isReadOnly && roomModal?.mode === 'edit'
            ? (id) => {
                setConfirmDelete([id]);
              }
            : undefined
        }
        onClose={() => setRoomModal(null)}
        onSubmit={({ name, color, capacity, labelScale, showName, surfaceSqm, notes }) => {
          if (!roomModal || isReadOnly) return false;
          if (roomModal.mode === 'edit') {
            const existing = (basePlan.rooms || []).find((r) => r.id === roomModal.roomId);
            const nextRoom = { ...(existing || {}), name, color, capacity, labelScale, showName, surfaceSqm, notes };
            if (hasRoomOverlap(nextRoom, roomModal.roomId)) {
              notifyRoomOverlap();
              return false;
            }
            markTouched();
            updateRoom(basePlan.id, roomModal.roomId, { name, color, capacity, labelScale, showName, surfaceSqm, notes });
            push(t({ it: 'Stanza aggiornata', en: 'Room updated' }), 'success');
            postAuditEvent({
              event: 'room_update',
              scopeType: 'plan',
              scopeId: basePlan.id,
              details: {
                id: roomModal.roomId,
                name,
                color: color || null,
                capacity: capacity ?? null,
                labelScale: labelScale ?? null,
                showName,
                surfaceSqm: surfaceSqm ?? null,
                notes: notes ?? null
              }
            });
            setSelectedRoomId(roomModal.roomId);
            setHighlightRoom({ roomId: roomModal.roomId, until: Date.now() + 2600 });
            setRoomModal(null);
            return true;
          }
          const testRoom =
            roomModal.kind === 'rect'
              ? {
                  id: 'new-room',
                  name,
                  color,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  kind: 'rect',
                  ...roomModal.rect
                }
              : { id: 'new-room', name, color, capacity, labelScale, showName, surfaceSqm, notes, kind: 'poly', points: roomModal.points };
          if (hasRoomOverlap(testRoom)) {
            notifyRoomOverlap();
            return false;
          }
          markTouched();
          const id =
            roomModal.kind === 'rect'
              ? addRoom(basePlan.id, {
                  name,
                  color,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  kind: 'rect',
                  ...roomModal.rect
                })
              : addRoom(basePlan.id, {
                  name,
                  color,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  kind: 'poly',
                  points: roomModal.points
                });
          postAuditEvent({
            event: 'room_create',
            scopeType: 'plan',
            scopeId: basePlan.id,
            details: {
              id,
              name,
              kind: roomModal.kind,
              color: color || null,
              capacity: capacity ?? null,
              labelScale: labelScale ?? null,
              showName,
              surfaceSqm: surfaceSqm ?? null,
              notes: notes ?? null
            }
          });
          const updates: Record<string, string | undefined> = {};
          for (const obj of basePlan.objects) {
            if (isPointInRoom({ ...testRoom, id }, obj.x, obj.y)) {
              updates[obj.id] = id;
            }
          }
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          push(t({ it: 'Stanza creata', en: 'Room created' }), 'success');
          setSelectedRoomId(id);
          setHighlightRoom({ roomId: id, until: Date.now() + 3200 });
          setRoomModal(null);
          return true;
        }}
      />

      <ConfirmDialog
        open={!!capacityConfirm}
        title={t({ it: 'Capienza stanza superata', en: 'Room capacity exceeded' })}
        description={t({
          it: `La stanza "${capacityConfirm?.roomName || t({ it: 'Stanza', en: 'Room' })}" ospita un massimo di ${capacityConfirm?.capacity || 0} postazioni. Vuoi continuare comunque?`,
          en: `Room "${capacityConfirm?.roomName || t({ it: 'Room', en: 'Room' })}" hosts a maximum of ${capacityConfirm?.capacity || 0} seats. Do you want to continue anyway?`
        })}
        confirmLabel={t({ it: 'Continua', en: 'Continue' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setCapacityConfirm(null)}
        onConfirm={() => {
          if (!capacityConfirm) return;
          const { type, x, y } = capacityConfirm;
          setCapacityConfirm(null);
          proceedPlaceUser(type, x, y);
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

      <RoomAllocationModal
        open={roomAllocationOpen}
        rooms={rooms}
        roomStatsById={roomStatsById}
        onHighlight={(roomId) => {
          setSelectedRoomId(roomId);
          setHighlightRoom({ roomId, until: Date.now() + 3200 });
        }}
        onClose={() => setRoomAllocationOpen(false)}
      />

      {/* kept for potential future use */}
      <BulkEditDescriptionModal
        open={bulkEditOpen}
        count={selectedObjectIds.length}
        onClose={() => setBulkEditOpen(false)}
        onSubmit={({ description }) => {
          if (isReadOnly) return;
          if (selectedObjectIds.length) markTouched();
          for (const id of selectedObjectIds) {
            updateObject(id, { description });
          }
          push(t({ it: 'Descrizione aggiornata', en: 'Description updated' }), 'success');
          if (selectedObjectIds.length) {
            postAuditEvent({
              event: 'objects_bulk_update',
              scopeType: 'plan',
              scopeId: planId,
              details: { ids: selectedObjectIds, changes: { description } }
            });
          }
        }}
      />

      <BulkEditSelectionModal
        open={bulkEditSelectionOpen}
        objects={(renderPlan?.objects || []).filter((o) => selectedObjectIds.includes(o.id))}
        getTypeLabel={getTypeLabel}
        getTypeIcon={getTypeIcon}
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
	              const obj = renderPlan.objects.find((o) => o.id === confirmDelete[0]);
	              const label = obj ? getTypeLabel(obj.type) : undefined;
	              const name = obj?.name || t({ it: 'oggetto', en: 'object' });
                return t({
                  it: `Rimuovere ${label ? `${label.toLowerCase()} ` : ''}"${name}" dalla planimetria?`,
                  en: `Remove ${label ? `${label} ` : ''}"${name}" from the floor plan?`
                });
	            }
	            return t({
                it: `Rimuovere ${confirmDelete.length} oggetti dalla planimetria?`,
                en: `Remove ${confirmDelete.length} objects from the floor plan?`
              });
	          })()
	        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete || !confirmDelete.length) return;
          markTouched();
          confirmDelete.forEach((id) => deleteObject(id));
          if (lastInsertedRef.current && confirmDelete.includes(lastInsertedRef.current.id)) {
            lastInsertedRef.current = null;
          }
          push(
            confirmDelete.length === 1
              ? t({ it: 'Oggetto eliminato', en: 'Object deleted' })
              : t({ it: 'Oggetti eliminati', en: 'Objects deleted' }),
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
          const remainingRooms = rooms.filter((r) => r.id !== confirmDeleteRoomId);
          const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
          deleteRoom(basePlan.id, confirmDeleteRoomId);
          postAuditEvent({ event: 'room_delete', scopeType: 'plan', scopeId: basePlan.id, details: { id: confirmDeleteRoomId } });
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          if (selectedRoomId === confirmDeleteRoomId) setSelectedRoomId(undefined);
          push(t({ it: 'Stanza eliminata', en: 'Room deleted' }), 'info');
          setConfirmDeleteRoomId(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
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

      <ViewModal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onSubmit={handleSaveView}
      />

      <PrintModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} mode="single" singlePlanId={basePlan.id} />

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
                  width: Number(l.width || ((l as any).kind === 'cable' ? 3 : 2)),
                  dashed: !!l.dashed
                };
              })()
            : undefined
        }
        onClose={() => {
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
            dashed: payload.dashed
          });
          postAuditEvent({ event: 'link_update', scopeType: 'plan', scopeId: basePlan.id, details: { id: linkEditId, ...payload } });
          push(t({ it: 'Collegamento aggiornato', en: 'Link updated' }), 'success');
          setLinkEditId(null);
          closeReturnToSelectionList();
        }}
      />

      <RealUserDetailsModal
        open={!!realUserDetailsId}
        userName={realUserDetailsName}
        details={realUserDetails}
        onClose={() => setRealUserDetailsId(null)}
      />

      <AllObjectTypesModal
        open={allTypesOpen}
        defs={objectTypeDefs || []}
        onClose={() => setAllTypesOpen(false)}
        onPick={(typeId) => {
          setPendingType(typeId);
          push(t({ it: 'Seleziona un punto sulla mappa per inserire l’oggetto', en: 'Click on the map to place the object' }), 'info');
        }}
        paletteTypeIds={paletteOrder}
        onAddToPalette={addTypeToPalette}
      />

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
          deleteRevision(basePlan.id, revisionId);
          if (selectedRevisionId === revisionId) {
            setSelectedRevision(planId, null);
          }
          push(t({ it: 'Revisione eliminata', en: 'Revision deleted' }), 'info');
        }}
        onClearAll={() => {
          clearRevisions(basePlan.id);
          setSelectedRevision(planId, null);
          push(t({ it: 'Revisioni eliminate', en: 'Revisions deleted' }), 'info');
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
        }}
      />

      <SaveRevisionModal
        open={saveRevisionOpen}
        hasExisting={hasAnyRevision}
        latestRevMajor={latestRev.major}
        latestRevMinor={latestRev.minor}
        reason={
          pendingNavigateRef.current
            ? {
                it: 'Stai cambiando planimetria: salva una revisione per non perdere le modifiche.',
                en: 'You are switching floor plans: save a revision to avoid losing changes.'
              }
            : null
        }
        onDiscard={
          pendingNavigateRef.current
            ? () => {
                const to = pendingNavigateRef.current;
                pendingNavigateRef.current = null;
                revertUnsavedChanges();
                resetTouched();
                entrySnapshotRef.current = toSnapshot(planRef.current || plan);
                clearPendingSaveNavigate?.();
                setSaveRevisionOpen(false);
                if (to) navigate(to);
              }
            : undefined
        }
        onClose={() => {
          setSaveRevisionOpen(false);
          pendingNavigateRef.current = null;
          clearPendingSaveNavigate?.();
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
          entrySnapshotRef.current = toSnapshot(planRef.current || plan);
          if (pendingNavigateRef.current) {
            const to = pendingNavigateRef.current;
            pendingNavigateRef.current = null;
            clearPendingSaveNavigate?.();
            navigate(to);
          }
        }}
      />

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

      <SearchResultsModal
        open={searchResultsOpen}
        term={searchResultsTerm}
        objectResults={(renderPlan?.objects || []).filter((o) => searchResultsIds.includes(o.id))}
        roomResults={(renderPlan?.rooms || []).filter((r) => searchRoomIds.includes(r.id))}
        onClose={() => {
          setSearchResultsOpen(false);
          setSearchRoomIds([]);
          setSearchResultsIds([]);
        }}
        onSelectObject={(objectId) => {
          const obj = renderPlan.objects.find((o) => o.id === objectId);
          if (!obj) return;
          setSelectedObject(obj.id);
          triggerHighlight(obj.id);
        }}
        onSelectRoom={(roomId) => {
          const room = (renderPlan.rooms || []).find((r) => r.id === roomId);
          if (!room) return;
          clearSelection();
          setSelectedRoomId(room.id);
          setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
        }}
      />

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
            setHighlightRoom({ roomId: r.roomId, until: Date.now() + 3200 });
          }
        }}
      />

      {/* legacy multi-print modal kept for future use */}
    </div>
  );
};

export default PlanView;
