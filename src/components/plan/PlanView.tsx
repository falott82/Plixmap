import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Eye,
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
  Home,
  History,
  Save,
  Cog
} from 'lucide-react';
import Toolbar from './Toolbar';
import CanvasStage from './CanvasStage';
import SearchBar from './SearchBar';
import ExportButton from './ExportButton';
import ObjectModal from './ObjectModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { FloorPlan, FloorPlanView, MapObjectType } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useToastStore } from '../../store/useToast';
import { useAuthStore } from '../../store/useAuthStore';
import VersionBadge from '../ui/VersionBadge';
import UserMenu from '../layout/UserMenu';
import ViewModal from './ViewModal';
import SearchResultsModal from './SearchResultsModal';
import { exportPlanToPdf } from '../../utils/pdf';
import ChooseDefaultViewModal from './ChooseDefaultViewModal';
import Icon from '../ui/Icon';
import PdfExportModal from './PdfExportModal';
import RevisionsModal from './RevisionsModal';
import SaveRevisionModal from './SaveRevisionModal';
import RoomModal from './RoomModal';
import BulkEditDescriptionModal from './BulkEditDescriptionModal';
import BulkEditSelectionModal from './BulkEditSelectionModal';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang, useT } from '../../i18n/useT';
import { shallow } from 'zustand/shallow';

interface Props {
  planId: string;
}

const PlanView = ({ planId }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const fitApplied = useRef<string | null>(null);
  const t = useT();
  const lang = useLang();
  const {
    addObject,
    updateObject,
    deleteObject,
    moveObject,
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
    clearRevisions
  } = useDataStore(
    (s) => ({
      addObject: s.addObject,
      updateObject: s.updateObject,
      deleteObject: s.deleteObject,
      moveObject: s.moveObject,
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
      clearRevisions: s.clearRevisions
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
    setPlanDirty,
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
      setPlanDirty: (s as any).setPlanDirty,
      pendingSaveNavigateTo: (s as any).pendingSaveNavigateTo,
      clearPendingSaveNavigate: (s as any).clearPendingSaveNavigate
    }),
    shallow
  );

  const push = useToastStore((s) => s.push);
  const [pendingType, setPendingType] = useState<MapObjectType | null>(null);
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
  const [chooseDefaultModal, setChooseDefaultModal] = useState<{ deletingViewId: string } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [saveRevisionOpen, setSaveRevisionOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<
    | { kind: 'object'; id: string; x: number; y: number }
    | { kind: 'map'; x: number; y: number; worldX: number; worldY: number; addOpen: boolean; roomOpen: boolean }
    | null
  >(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<string>('__last__');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchResultsTerm, setSearchResultsTerm] = useState('');
  const [searchResultsIds, setSearchResultsIds] = useState<string[]>([]);
  const [searchRoomIds, setSearchRoomIds] = useState<string[]>([]);
  const [countsOpen, setCountsOpen] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [objectListQuery, setObjectListQuery] = useState('');
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [roomDrawMode, setRoomDrawMode] = useState<'rect' | 'poly' | null>(null);
  const [newRoomMenuOpen, setNewRoomMenuOpen] = useState(false);
  const [highlightRoom, setHighlightRoom] = useState<{ roomId: string; until: number } | null>(null);
  const [roomModal, setRoomModal] = useState<
    | { mode: 'create'; kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
    | { mode: 'create'; kind: 'poly'; points: { x: number; y: number }[] }
    | { mode: 'edit'; roomId: string; initialName: string }
    | null
  >(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);

  const planRef = useRef<FloorPlan | undefined>(undefined);
  const selectedObjectIdRef = useRef<string | undefined>(selectedObjectId);
  const selectedObjectIdsRef = useRef<string[]>(selectedObjectIds);
  const confirmDeleteRef = useRef<string[] | null>(confirmDelete);
  const zoomRef = useRef<number>(zoom);

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

  useEffect(() => {
    // Always start from the "present" when entering the workspace for a plan.
    setSelectedRevision(planId, null);
  }, [planId, setSelectedRevision]);

  // Avoid re-applying viewport on every data change (plan updates clone references).
  const viewportInitRef = useRef<string | null>(null);

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

  const isReadOnly = !!activeRevision || planAccess !== 'rw';
  const isReadOnlyRef = useRef(isReadOnly);
  useEffect(() => {
    isReadOnlyRef.current = isReadOnly;
  }, [isReadOnly]);
  const renderPlan = useMemo(() => {
    if (!plan) return undefined;
    if (!activeRevision) return plan;
    return {
      ...plan,
      imageUrl: activeRevision.imageUrl,
      width: activeRevision.width,
      height: activeRevision.height,
      rooms: activeRevision.rooms,
      objects: activeRevision.objects,
      views: activeRevision.views
    };
  }, [activeRevision, plan]);

  const latestRev = useMemo(() => {
    const revs: any[] = plan?.revisions || [];
    const first = revs[0];
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
  }, [planId]);

  useEffect(() => {
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) {
      baselineSnapshotRef.current = null;
      return;
    }
    if (!baselineSnapshotRef.current) {
      baselineSnapshotRef.current = toSnapshot(plan);
    }
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

  const hasUnsavedChanges = useMemo(() => {
    if (!plan) return false;
    const revisions = plan.revisions || [];
    if (!revisions.length) {
      const base = baselineSnapshotRef.current;
      if (!base) return false;
      return !samePlanSnapshot(toSnapshot(plan), base);
    }
    const latest: any = revisions[0];
    return !samePlanSnapshot(toSnapshot(plan), {
      imageUrl: latest.imageUrl,
      width: latest.width,
      height: latest.height,
      objects: latest.objects,
      views: latest.views,
      rooms: latest.rooms
    });
  }, [plan, toSnapshot]);

  const navigate = useNavigate();
  const location = useLocation();
  const pendingNavigateRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tm') !== '1') return;
    setRevisionsOpen(true);
    params.delete('tm');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const revertUnsavedChanges = useCallback(() => {
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) {
      restoreRevision(plan.id, revisions[0].id);
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
    setPlanDirty?.(planId, !!hasUnsavedChanges);
    return () => {
      setPlanDirty?.(planId, false);
    };
  }, [hasUnsavedChanges, planId, setPlanDirty]);

  useEffect(() => {
    if (!pendingSaveNavigateTo) return;
    if (isReadOnly) {
      navigate(pendingSaveNavigateTo);
      clearPendingSaveNavigate?.();
      return;
    }
    if (!hasUnsavedChanges) {
      navigate(pendingSaveNavigateTo);
      clearPendingSaveNavigate?.();
      return;
    }
    pendingNavigateRef.current = pendingSaveNavigateTo;
    setSaveRevisionOpen(true);
  }, [clearPendingSaveNavigate, hasUnsavedChanges, isReadOnly, navigate, pendingSaveNavigateTo]);
  const contextObject = useMemo(() => {
    if (!renderPlan || !contextMenu || contextMenu.kind !== 'object') return undefined;
    return renderPlan.objects.find((o) => o.id === contextMenu.id);
  }, [renderPlan, contextMenu]);

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
    confirmDeleteRef.current = confirmDelete;
  }, [confirmDelete]);

  useEffect(() => {
    setSelectedPlan(planId);
  }, [planId, setSelectedPlan]);

  useEffect(() => {
    if (!renderPlan) return;
    if (viewportInitRef.current === planId) return;
    viewportInitRef.current = planId;

    const def = renderPlan?.views?.find((v) => v.isDefault);
    if (def) {
      setZoom(def.zoom);
      setPan(def.pan);
      saveViewport(planId, def.zoom, def.pan);
      fitApplied.current = planId;
      setSelectedViewId(def.id);
      return;
    }
    const saved = loadViewport(planId);
    if (saved) {
      setZoom(saved.zoom);
      setPan(saved.pan);
      fitApplied.current = planId;
      setSelectedViewId('__last__');
    }
  }, [loadViewport, planId, renderPlan, saveViewport, setPan, setZoom]);

  useEffect(() => {
    // entering/leaving read-only mode clears pending placement and context menu
    setPendingType(null);
    setContextMenu(null);
    clearSelection();
  }, [isReadOnly]);

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
      if (!id) {
        clearSelection();
        setSelectedRoomId(undefined);
      } else if (options?.multi) {
        setSelectedRoomId(undefined);
        toggleSelectedObject(id);
      } else {
        setSelectedRoomId(undefined);
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
    [clearSelection, setSelectedObject, toggleSelectedObject]
  );

  const handleStageMove = useCallback(
    (id: string, x: number, y: number) => {
      moveObject(id, x, y);
      if (isReadOnlyRef.current) return;
      const currentPlan = planRef.current as FloorPlan | undefined;
      if (!currentPlan) return;
      const currentObj = currentPlan.objects?.find((o) => o.id === id);
      const nextRoomId = getRoomIdAt(currentPlan.rooms, x, y);
      const currentRoomId = currentObj?.roomId ?? undefined;
      if (currentRoomId !== nextRoomId) {
        updateObject(id, { roomId: nextRoomId });
      }
    },
    [moveObject, updateObject]
  );

  const handleObjectContextMenu = useCallback(
    ({ id, clientX, clientY }: { id: string; clientX: number; clientY: number }) =>
      setContextMenu({ kind: 'object', id, x: clientX, y: clientY }),
    []
  );

  const handleMapContextMenu = useCallback(
    ({ clientX, clientY, worldX, worldY }: { clientX: number; clientY: number; worldX: number; worldY: number }) =>
      setContextMenu({ kind: 'map', x: clientX, y: clientY, worldX, worldY, addOpen: false, roomOpen: false }),
    []
  );

  const applyView = useCallback((view: FloorPlanView) => {
    if (!renderPlan) return;
    setZoom(view.zoom);
    setPan(view.pan);
    saveViewport(renderPlan.id, view.zoom, view.pan);
    fitApplied.current = renderPlan.id;
    setSelectedViewId(view.id);
  }, [renderPlan, saveViewport, setPan, setZoom]);

  const handleSaveView = (payload: { name: string; description?: string; isDefault: boolean }) => {
    if (!plan || isReadOnly) return;
    const id = addView(plan.id, { ...payload, zoom, pan, isDefault: payload.isDefault });
    push('Vista salvata', 'success');
    setSelectedViewId(id);
    setViewsMenuOpen(false);
  };

  const goToDefaultView = () => {
    const current = renderPlan;
    if (!current) return;
    const def = current.views?.find((v) => v.isDefault);
    if (!def) {
      push('Nessuna vista di default', 'info');
      return;
    }
    applyView(def);
    push('Vista default caricata', 'success');
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

      if (currentConfirm) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setConfirmDelete(null);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          currentConfirm.forEach((id) => deleteObject(id));
          push(currentConfirm.length === 1 ? 'Oggetto eliminato' : 'Oggetti eliminati', 'info');
          setConfirmDelete(null);
          setContextMenu(null);
          clearSelection();
          return;
        }
      }

      if (isTyping) return;

      if (e.key === 'Escape') {
        if (currentSelectedIds.length || selectedRoomId) {
          e.preventDefault();
          setContextMenu(null);
          clearSelection();
          setSelectedRoomId(undefined);
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
          moveObject(id, nextX, nextY);
          const nextRoomId = getRoomIdAt((currentPlan as FloorPlan).rooms, nextX, nextY);
          const currentRoomId = obj.roomId ?? undefined;
          if (currentRoomId !== nextRoomId) {
            updateObject(id, { roomId: nextRoomId });
          }
        }
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
  }, [deleteObject, push, clearSelection, roomDrawMode, moveObject, updateObject, selectedRoomId]);

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

  const rooms = useMemo(() => renderPlan?.rooms || [], [renderPlan?.rooms]);

  const objectsByRoomId = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const obj of renderPlan?.objects || []) {
      if (!obj.roomId) continue;
      const list = map.get(obj.roomId) || [];
      list.push(obj);
      map.set(obj.roomId, list);
    }
    return map;
  }, [renderPlan?.objects]);

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
    setRoomModal({ mode: 'edit', roomId, initialName: room.name });
  };

  const handleCreateRoomFromRect = (rect: { x: number; y: number; width: number; height: number }) => {
    if (isReadOnly) return;
    setRoomDrawMode(null);
    setRoomModal({ mode: 'create', kind: 'rect', rect });
  };

  const handleCreateRoomFromPoly = (points: { x: number; y: number }[]) => {
    if (isReadOnly) return;
    setRoomDrawMode(null);
    setRoomModal({ mode: 'create', kind: 'poly', points });
  };

  const handlePlaceNew = (type: MapObjectType, x: number, y: number) => {
    if (isReadOnly) return;
    setModalState({ mode: 'create', type, coords: { x, y } });
    setPendingType(null);
  };

  const handleCreate = (payload: { name: string; description?: string }) => {
    if (!plan || !modalState || isReadOnly) return;
    if (modalState.mode === 'create') {
      const id = addObject(
        plan.id,
        modalState.type,
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        lastObjectScale
      );
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      if (roomId) updateObject(id, { roomId });
      push('Oggetto creato', 'success');
    }
    if (modalState.mode === 'duplicate') {
      const base = plan.objects.find((o) => o.id === modalState.objectId);
      const scale = base?.scale ?? 1;
      const id = addObject(
        plan.id,
        base?.type || 'user',
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        scale
      );
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      if (roomId) updateObject(id, { roomId });
      push('Oggetto duplicato', 'success');
    }
  };

  const handleEdit = (objectId: string) => setModalState({ mode: 'edit', objectId });

  const handleUpdate = (payload: { name: string; description?: string }) => {
    if (!modalState || modalState.mode !== 'edit' || isReadOnly) return;
    updateObject(modalState.objectId, payload);
    push('Oggetto aggiornato', 'success');
  };

  const handleSearch = (_term: string) => {
    // live search only highlights on Enter to avoid loops
  };

  const handleZoomChange = useCallback((value: number) => setZoom(value), [setZoom]);
  const handlePanChange = useCallback((value: { x: number; y: number }) => setPan(value), [setPan]);

  const handleSearchEnter = (term: string) => {
    if (!renderPlan) return;
    if (!term.trim()) return;
    const normalized = term.toLowerCase();
    const objectMatches = renderPlan.objects.filter(
      (o) =>
        o.name.toLowerCase().includes(normalized) ||
        (o.description && o.description.toLowerCase().includes(normalized))
    );
    const roomMatches = (renderPlan.rooms || []).filter((r) => (r.name || '').toLowerCase().includes(normalized));

    if (!objectMatches.length && !roomMatches.length) {
      push(t({ it: 'Nessun risultato trovato', en: 'No results found' }), 'info');
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
      return { type: modalState.type, name: '', description: '' };
    }
    const obj = renderPlan.objects.find((o) => o.id === modalState.objectId);
    if (!obj) return null;
    return { type: obj.type, name: modalState.mode === 'duplicate' ? '' : obj.name, description: modalState.mode === 'duplicate' ? '' : obj.description || '' };
  }, [modalState, renderPlan]);

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

  return (
    <div className="flex h-screen flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-slate-500">
            {client?.name} → {site?.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-ink">{renderPlan.name}</h1>
            {isReadOnly ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                {activeRevision ? `Sola lettura: ${activeRevision.name}` : 'Sola lettura (permessi)'}
              </span>
            ) : null}
            <div className="relative">
              <button
                onClick={() => setCountsOpen((v) => !v)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                title="Numero oggetti"
              >
                {renderPlan.objects.length} oggetti
              </button>
	              {countsOpen ? (
	                <div className="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
	                  <div className="flex items-center justify-between px-2 pb-2">
	                    <div className="text-sm font-semibold text-ink">Dettaglio oggetti</div>
	                    <button onClick={() => setCountsOpen(false)} className="text-slate-400 hover:text-ink">
	                      <X size={14} />
	                    </button>
	                  </div>
	                  <div className="px-2 pb-2">
	                    <input
	                      value={objectListQuery}
	                      onChange={(e) => setObjectListQuery(e.target.value)}
	                      placeholder="Cerca oggetto…"
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
	                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Nessun risultato.</div>
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
	                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Nessun oggetto.</div>
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
                <div className="absolute left-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
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
                  </div>
                  <div className="max-h-96 space-y-1 overflow-auto px-2 pb-2">
                    {rooms.length ? (
                      rooms.map((room) => {
                        const isExpanded = expandedRoomId === room.id;
                        const assigned = objectsByRoomId.get(room.id) || [];
                        return (
                          <div key={room.id} className="rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 px-2 py-2">
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
                                <div className="truncate">{room.name}</div>
                                <div className="text-xs text-slate-500">{assigned.length} oggetti</div>
                              </button>
                              {!isReadOnly ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    title="Rinomina"
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
                                    title="Elimina"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteRoomId(room.id);
                                      setRoomsOpen(false);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  >
                                    <Trash size={14} />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            {isExpanded ? (
                              <div className="border-t border-slate-100 px-2 pb-2 pt-2">
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
	                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-slate-50"
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
                                    Nessun oggetto in questa stanza.
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Nessuna stanza. Crea una stanza per organizzare gli oggetti.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="ml-1 flex h-9 items-center gap-2">
              {selectedObjectId ? (
                <>
                  <span className="text-sm font-semibold text-slate-600">Selezionato:</span>
                  <span className="max-w-[220px] truncate rounded-full bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">
                    {selectedObjectIds.length > 1
                      ? `${selectedObjectIds.length} elementi`
                      : renderPlan.objects.find((o) => o.id === selectedObjectId)?.name}
                  </span>
                  <button
                    onClick={() => handleEdit(selectedObjectId)}
                    disabled={isReadOnly}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    title="Modifica"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete([...selectedObjectIds])}
                    disabled={isReadOnly}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    title="Elimina"
                  >
                    <Trash size={14} />
                  </button>
                </>
              ) : (
                selectedRoomId ? (
                  <>
                    <span className="text-sm font-semibold text-slate-600">Stanza:</span>
                    <span className="max-w-[220px] truncate rounded-full bg-slate-100 px-2 py-1 text-sm font-semibold text-ink">
                      {rooms.find((r) => r.id === selectedRoomId)?.name || 'Stanza'}
                    </span>
                    {!isReadOnly ? (
                      <>
                        <button
                          onClick={() => openEditRoom(selectedRoomId)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                          title="Rinomina stanza"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteRoomId(selectedRoomId)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          title="Elimina stanza"
                        >
                          <Trash size={14} />
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className="text-sm text-slate-400">Nessuna selezione</span>
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
                  push('Nessuna modifica da salvare', 'info');
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
                  <div className="text-sm font-semibold text-ink">Viste salvate</div>
                  <button onClick={() => setViewsMenuOpen(false)} className="text-slate-400 hover:text-ink" title="Chiudi">
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSelectedViewId('__last__');
                      setViewsMenuOpen(false);
                      push('Vista: ultima posizione', 'info');
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                      selectedViewId === '__last__' ? 'bg-slate-100 font-semibold' : ''
                    }`}
                  >
                    <Eye size={16} className="text-slate-500" />
                    Ultima posizione
                  </button>
                  {(basePlan.views || []).map((view) => (
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
                          title="Elimina vista"
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
                    Salva nuova vista
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ExportButton elementRef={mapRef} objects={renderPlan.objects} planName={renderPlan.name} />
            <VersionBadge />
            <Link
              to="/settings"
              title={t({ it: 'Impostazioni', en: 'Settings' })}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
            >
              <Cog size={18} />
            </Link>
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

      <div className="flex-1">
        <div className="relative flex h-full gap-4 overflow-hidden">
	        <div className="flex-1 min-w-0">
	            <div className="h-full" ref={mapRef}>
		              <CanvasStage
		                containerRef={mapRef}
		                plan={renderPlan}
		                selectedId={selectedObjectId}
		                selectedIds={selectedObjectIds}
                    selectedRoomId={selectedRoomId}
		                highlightId={highlight?.objectId}
		                highlightUntil={highlight?.until}
                    highlightRoomId={highlightRoom?.roomId}
                    highlightRoomUntil={highlightRoom?.until}
		                pendingType={pendingType}
		                readOnly={isReadOnly}
                    roomDrawMode={roomDrawMode}
                    objectTypeIcons={objectTypeIcons}
		                zoom={zoom}
		                pan={pan}
		                autoFit={!fitApplied.current}
	                onZoomChange={handleZoomChange}
	                onPanChange={handlePanChange}
	                onSelect={handleStageSelect}
                  onSelectMany={(ids) => {
                    setSelectedRoomId(undefined);
                    setSelection(ids);
                    setContextMenu(null);
                  }}
		                onMove={handleStageMove}
		                onPlaceNew={handlePlaceNew}
		                onEdit={handleEdit}
	                onContextMenu={handleObjectContextMenu}
	                onMapContextMenu={handleMapContextMenu}
	                onGoDefaultView={goToDefaultView}
                    onSelectRoom={(roomId) => {
                      clearSelection();
                      setSelectedRoomId(roomId);
                      setContextMenu(null);
                    }}
                    onCreateRoom={(shape) => {
                      if (shape.kind === 'rect') handleCreateRoomFromRect(shape.rect);
                      else handleCreateRoomFromPoly(shape.points);
                    }}
                    onUpdateRoom={(roomId, payload) => {
                      if (isReadOnly) return;
                      const nextRooms = ((plan as FloorPlan).rooms || []).map((r) => (r.id === roomId ? { ...r, ...payload } : r));
                      updateRoom((plan as FloorPlan).id, roomId, payload as any);
                      const updates = computeRoomReassignments(nextRooms, (plan as FloorPlan).objects);
                      if (Object.keys(updates).length) setObjectRoomIds((plan as FloorPlan).id, updates);
                    }}
	              />
	            </div>
	          </div>
	          {!isReadOnly ? (
	            <aside className="sticky top-0 h-fit w-28 shrink-0 self-start rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
	            <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-500">
                <span>Palette</span>
                <Link
                  to="/settings?tab=objects"
                  title={t({ it: 'Modifica tipi oggetto', en: 'Edit object types' })}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-ink"
                >
                  <Pencil size={14} />
                </Link>
              </div>
	            <div className="mt-3 flex flex-col items-center gap-3">
	              <Toolbar onSelectType={(type) => setPendingType(type)} activeType={pendingType} />
	            </div>
	          </aside>
	          ) : null}
	        </div>
	      </div>

      {contextMenu && plan ? (
        <div
          className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-semibold text-ink">Menu</span>
            <button onClick={() => setContextMenu(null)} className="text-slate-400 hover:text-ink">
              <X size={14} />
            </button>
          </div>

          {contextMenu.kind === 'object' ? (
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
                    </div>
                    <input
                      key={contextMenu.id}
                      type="range"
                      min={0.6}
                      max={1.8}
                      step={0.1}
                      value={contextObject?.scale ?? 1}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        updateObject(contextMenu.id, { scale: next });
                        useUIStore.getState().setLastObjectScale(next);
                      }}
                      className="mt-1 w-full"
                    />
                  </div>
                </>
              )}

              {contextIsMulti ? (
                <button
                  onClick={() => {
                    setBulkEditSelectionOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <Pencil size={14} /> {t({ it: 'Modifica selezione…', en: 'Edit selection…' })}
                </button>
              ) : null}
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
                <BookmarkPlus size={14} className="text-slate-500" /> Salva vista
              </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => setContextMenu({ ...contextMenu, roomOpen: !contextMenu.roomOpen, addOpen: false })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Nuova stanza', en: 'New room' })}
                  <ChevronDown size={14} className="ml-auto text-slate-400" />
                </button>
              ) : null}
              {contextMenu.roomOpen && !isReadOnly ? (
                <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    onClick={() => {
                      beginRoomDraw();
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Square size={14} className="text-slate-500" /> {t({ it: 'Rettangolo', en: 'Rectangle' })}
                  </button>
                  <button
                    onClick={() => {
                      beginRoomPolyDraw();
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Square size={14} className="text-slate-500" /> {t({ it: 'Poligono', en: 'Polygon' })}
                  </button>
                </div>
              ) : null}
              <button
                onClick={() => {
                  goToDefaultView();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <Home size={14} className="text-slate-500" /> Vai a default
              </button>
              {!isReadOnly ? (
                <button
                onClick={() => setContextMenu({ ...contextMenu, addOpen: !contextMenu.addOpen })}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <Plus size={14} className="text-slate-500" /> Aggiungi…
              </button>
              ) : null}
              {contextMenu.addOpen ? (
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2">
                  {(objectTypeDefs || []).map((def) => (
                    <button
                      key={def.id}
                      onClick={() => {
                        setModalState({
                          mode: 'create',
                          type: def.id,
                          coords: { x: contextMenu.worldX, y: contextMenu.worldY }
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
              ) : null}
              {!isReadOnly ? (
                <button
                onClick={() => {
                  setConfirmClearObjects(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
              >
                <Trash size={14} /> Elimina tutti gli oggetti
              </button>
              ) : null}
              <button
                onClick={() => {
                  setExportModalOpen(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <FileDown size={14} className="text-slate-500" /> Esporta PDF
              </button>
            </>
          )}
        </div>
      ) : null}

      <ObjectModal
	        open={!!modalState}
	        type={modalInitials?.type}
          icon={modalInitials?.type ? getTypeIcon(modalInitials.type) : undefined}
	        typeLabel={
	          modalState?.mode === 'create'
	            ? `${t({ it: 'Nuovo', en: 'New' })} ${modalInitials?.type ? getTypeLabel(modalInitials.type) : ''} (${Math.round((modalState as any)?.coords?.x || 0)}, ${Math.round(
	                (modalState as any)?.coords?.y || 0
	              )})`
	            : undefined
	        }
	        initialName={modalInitials?.name}
	        initialDescription={modalInitials?.description}
	        onClose={() => setModalState(null)}
	        onSubmit={modalState?.mode === 'edit' ? handleUpdate : handleCreate}
	      />

      <RoomModal
        open={!!roomModal}
        initialName={roomModal?.mode === 'edit' ? roomModal.initialName : ''}
        onClose={() => setRoomModal(null)}
        onSubmit={({ name }) => {
          if (!roomModal || isReadOnly) return;
          if (roomModal.mode === 'edit') {
            updateRoom(basePlan.id, roomModal.roomId, { name });
            push('Stanza aggiornata', 'success');
            setSelectedRoomId(roomModal.roomId);
            setHighlightRoom({ roomId: roomModal.roomId, until: Date.now() + 2600 });
            setRoomModal(null);
            return;
          }
          const id =
            roomModal.kind === 'rect'
              ? addRoom(basePlan.id, { name, kind: 'rect', ...roomModal.rect })
              : addRoom(basePlan.id, { name, kind: 'poly', points: roomModal.points });
          const testRoom =
            roomModal.kind === 'rect'
              ? { id, name, kind: 'rect', ...roomModal.rect }
              : { id, name, kind: 'poly', points: roomModal.points };
          const updates: Record<string, string | undefined> = {};
          for (const obj of basePlan.objects) {
            if (isPointInRoom(testRoom, obj.x, obj.y)) {
              updates[obj.id] = id;
            }
          }
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          push('Stanza creata', 'success');
          setSelectedRoomId(id);
          setHighlightRoom({ roomId: id, until: Date.now() + 3200 });
          setRoomModal(null);
        }}
      />

      {/* kept for potential future use */}
      <BulkEditDescriptionModal
        open={bulkEditOpen}
        count={selectedObjectIds.length}
        onClose={() => setBulkEditOpen(false)}
        onSubmit={({ description }) => {
          if (isReadOnly) return;
          for (const id of selectedObjectIds) {
            updateObject(id, { description });
          }
          push(t({ it: 'Descrizione aggiornata', en: 'Description updated' }), 'success');
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
          const ids = Object.keys(changesById || {});
          for (const id of ids) {
            updateObject(id, changesById[id]);
          }
          if (ids.length) push(t({ it: 'Oggetti aggiornati', en: 'Objects updated' }), 'success');
        }}
      />

	      <ConfirmDialog
	        open={!!confirmDelete}
	        title={confirmDelete && confirmDelete.length > 1 ? 'Eliminare gli oggetti?' : 'Eliminare l’oggetto?'}
	        description={
	          (() => {
	            if (!confirmDelete || !confirmDelete.length) return 'L’oggetto verrà rimosso dalla planimetria.';
	            if (confirmDelete.length === 1) {
	              const obj = renderPlan.objects.find((o) => o.id === confirmDelete[0]);
	              const label = obj ? getTypeLabel(obj.type) : undefined;
	              const name = obj?.name || 'oggetto';
	              return `Rimuovere ${label ? `${label.toLowerCase()} ` : ''}"${name}" dalla planimetria?`;
	            }
	            return `Rimuovere ${confirmDelete.length} oggetti dalla planimetria?`;
	          })()
	        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete || !confirmDelete.length) return;
          confirmDelete.forEach((id) => deleteObject(id));
          push(confirmDelete.length === 1 ? 'Oggetto eliminato' : 'Oggetti eliminati', 'info');
          setConfirmDelete(null);
          setContextMenu(null);
          clearSelection();
        }}
        confirmLabel="Elimina"
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
        title="Eliminare la stanza?"
        description={
          confirmDeleteRoomId
            ? `Eliminare la stanza "${rooms.find((r) => r.id === confirmDeleteRoomId)?.name || 'stanza'}" e scollegare gli oggetti associati?`
            : undefined
        }
        onCancel={() => setConfirmDeleteRoomId(null)}
        onConfirm={() => {
          if (!confirmDeleteRoomId) return;
          const remainingRooms = rooms.filter((r) => r.id !== confirmDeleteRoomId);
          const updates = computeRoomReassignments(remainingRooms, basePlan.objects);
          deleteRoom(basePlan.id, confirmDeleteRoomId);
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          if (selectedRoomId === confirmDeleteRoomId) setSelectedRoomId(undefined);
          push('Stanza eliminata', 'info');
          setConfirmDeleteRoomId(null);
        }}
        confirmLabel="Elimina"
        cancelLabel="Annulla"
      />

      <ConfirmDialog
        open={!!confirmDeleteViewId}
        title="Eliminare la vista?"
        description={
          confirmDeleteViewId
            ? `Eliminare la vista "${basePlan.views?.find((v) => v.id === confirmDeleteViewId)?.name || 'vista'}"?`
            : undefined
        }
        onCancel={() => setConfirmDeleteViewId(null)}
        onConfirm={() => {
          if (!confirmDeleteViewId) return;
          const deleting = basePlan.views?.find((v) => v.id === confirmDeleteViewId);
          deleteView(basePlan.id, confirmDeleteViewId);
          setConfirmDeleteViewId(null);
          setViewsMenuOpen(false);
          push('Vista eliminata', 'info');
          if (selectedViewId === confirmDeleteViewId) setSelectedViewId('__last__');
          // After deleting, always return to default view if available.
          window.setTimeout(() => goToDefaultView(), 0);
          if (deleting?.isDefault && (basePlan.views || []).length <= 1) {
            push('Nessuna vista di default rimasta', 'info');
          }
        }}
        confirmLabel="Elimina"
        cancelLabel="Annulla"
      />

      <ConfirmDialog
        open={confirmClearObjects}
        title="Eliminare tutti gli oggetti?"
        description="Tutti gli oggetti della planimetria verranno rimossi. Operazione non annullabile."
        onCancel={() => setConfirmClearObjects(false)}
        onConfirm={() => {
          clearObjects(basePlan.id);
          push('Oggetti rimossi', 'info');
          setConfirmClearObjects(false);
          setSelectedObject(undefined);
        }}
        confirmLabel="Elimina tutti"
        cancelLabel="Annulla"
      />

      <ViewModal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onSubmit={handleSaveView}
      />

	      <PdfExportModal
	        open={exportModalOpen}
	        onClose={() => setExportModalOpen(false)}
	        onConfirm={async (options) => {
	          if (!renderPlan) return;
	          const el = mapRef.current;
	          if (!el) return;
	          try {
	            await exportPlanToPdf(el, renderPlan.objects, renderPlan.name, options, objectTypeLabels);
	            push('PDF esportato', 'success');
	          } catch (error) {
	            push('Errore durante export', 'danger');
	            console.error(error);
	          }
	        }}
	      />

      <RevisionsModal
        open={revisionsOpen}
        revisions={basePlan.revisions || []}
        selectedRevisionId={selectedRevisionId}
        breadcrumb={[client?.shortName || client?.name, site?.name, basePlan?.name].filter(Boolean).join(' → ')}
        onClose={() => setRevisionsOpen(false)}
        onSelect={(revisionId) => {
          setSelectedRevision(planId, revisionId);
          push('Revisione caricata (sola lettura)', 'info');
        }}
        onBackToPresent={() => {
          setSelectedRevision(planId, null);
          push('Tornato al presente', 'info');
        }}
        onDelete={(revisionId) => {
          deleteRevision(basePlan.id, revisionId);
          if (selectedRevisionId === revisionId) {
            setSelectedRevision(planId, null);
          }
          push('Revisione eliminata', 'info');
        }}
        onClearAll={() => {
          clearRevisions(basePlan.id);
          setSelectedRevision(planId, null);
          push('Revisioni eliminate', 'info');
        }}
        canRestore={planAccess === 'rw'}
        onRestore={(revisionId) => {
          if (planAccess !== 'rw') return;
          restoreRevision(basePlan.id, revisionId);
          setSelectedRevision(planId, null);
          push('Revisione ripristinata (stato attuale aggiornato)', 'success');
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
          push(`Revisione salvata: Rev ${next.major}.${next.minor}`, 'success');
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
        views={(basePlan.views || []).filter((v) => v.id !== chooseDefaultModal?.deletingViewId)}
        onClose={() => setChooseDefaultModal(null)}
        onConfirm={(newDefaultId) => {
          if (!chooseDefaultModal) return;
          const deletingId = chooseDefaultModal.deletingViewId;
          setChooseDefaultModal(null);
          // Set a new default, then delete old default.
          setDefaultView(basePlan.id, newDefaultId);
          deleteView(basePlan.id, deletingId);
          if (selectedViewId === deletingId) setSelectedViewId(newDefaultId);
          push('Vista eliminata e default aggiornata', 'success');
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
    </div>
  );
};

export default PlanView;
