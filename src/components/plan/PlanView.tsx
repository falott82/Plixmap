import { Fragment, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
	LayoutGrid,
	Trash,
	Copy,
  MoveDiagonal,
  Square,
  X,
  Pencil,
  Star,
  BookmarkPlus,
  Plus,
  DoorOpen,
  FileDown,
  Crop,
  Home,
  PhoneCall,
  History,
		Save,
		Cog,
	  EyeOff,
  CornerDownRight,
  Link2,
  BarChart3,
  User,
  LocateFixed,
  Footprints,
  Users,
  Ruler,
  Hourglass,
  Unlock,
  Undo2,
  Redo2,
  ExternalLink,
  Type as TypeIcon,
  Image as ImageIcon,
  Camera,
  StickyNote
		} from 'lucide-react';
import Toolbar from './Toolbar';
import CanvasStage, { CanvasStageHandle } from './CanvasStage';
import SearchBar from './SearchBar';
import ObjectModal from './ObjectModal';
import RoomAllocationModal from './RoomAllocationModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  Corridor,
  DoorVerificationEntry,
  FloorPlan,
  FloorPlanView,
  IconName,
  LayerDefinition,
  MapObject,
  MapObjectType,
  ObjectTypeDefinition,
  PlanLink,
  RackItem,
  RackLink,
  RackPortKind,
  Room,
  RoomConnectionDoor
} from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useToastStore } from '../../store/useToast';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import { saveState } from '../../api/state';
import UserMenu from '../layout/UserMenu';
import EmergencyContactsModal from '../layout/EmergencyContactsModal';
import PrinterMenuButton from './PrinterMenuButton';
import UserAvatar from '../ui/UserAvatar';
import UnlockRequestComposeModal, { UnlockRequestLock } from './UnlockRequestComposeModal';
import ViewModal from './ViewModal';
import SearchResultsPopover from './SearchResultsPopover';
import ChooseDefaultViewModal from './ChooseDefaultViewModal';
import Icon from '../ui/Icon';
import RevisionsModal from './RevisionsModal';
import SaveRevisionModal from './SaveRevisionModal';
import { DESK_TYPE_IDS, isDeskType } from './deskTypes';
import RoomModal from './RoomModal';
import RoomShapePreview from './RoomShapePreview';
import CapacityDashboardModal from './CapacityDashboardModal';
import RackModal from './RackModal';
import RackPortsModal from './RackPortsModal';
import BulkEditDescriptionModal from './BulkEditDescriptionModal';
import BulkEditSelectionModal from './BulkEditSelectionModal';
import RealUserPickerModal from './RealUserPickerModal';
import PrintModal from './PrintModal';
import AllObjectTypesModal from './AllObjectTypesModal';
import CableModal from './CableModal';
import LinksModal from './LinksModal';
import LinkEditModal from './LinkEditModal';
import RealUserDetailsModal from './RealUserDetailsModal';
import type { CrossPlanSearchResult } from './CrossPlanSearchModal';
import type { PhotoItem } from './PhotoViewerModal';
import { useClipboard } from './useClipboard';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang, useT } from '../../i18n/useT';
import { shallow } from 'zustand/shallow';
import { postAuditEvent } from '../../api/audit';
import { hasExternalUsers, listExternalUsers } from '../../api/customImport';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { perfMetrics } from '../../utils/perfMetrics';
import { nanoid } from 'nanoid';
import {
  ALL_ITEMS_LAYER_ID,
  DEFAULT_WALL_TYPES,
  TEXT_COLOR_OPTIONS,
  TEXT_FONT_OPTIONS,
  WALL_TYPE_IDS,
  WIFI_DEFAULT_STANDARD,
  WIFI_RANGE_SCALE_MAX
} from '../../store/data';
import { isSecurityTypeId, SECURITY_LAYER_ID } from '../../store/security';
import { getDefaultVisiblePlanLayerIds, normalizePlanLayerSelection } from '../../utils/layerVisibility';
import { getWallTypeColor } from '../../utils/wallColors';
import { closeSocketSafely, getWsUrl } from '../../utils/ws';
import { usePresentationWebcamHands } from './presentation/usePresentationWebcamHands';

const SelectedObjectsModal = lazy(() => import('./SelectedObjectsModal'));
const CrossPlanSearchModal = lazy(() => import('./CrossPlanSearchModal'));
const InternalMapModal = lazy(() => import('./InternalMapModal'));
const EscapeRouteModal = lazy(() => import('./EscapeRouteModal'));
const PhotoViewerModal = lazy(() => import('./PhotoViewerModal'));

interface Props {
  planId: string;
}

const isRackLinkId = (id?: string | null) => typeof id === 'string' && id.startsWith('racklink:');
const UNLOCK_REQUEST_EVENT = 'plixmap_unlock_request';
const FORCE_UNLOCK_EVENT = 'plixmap_force_unlock';
const SYSTEM_LAYER_IDS = new Set([ALL_ITEMS_LAYER_ID, 'rooms', 'corridors', 'cabling', 'quotes']);
const DEFAULT_SAFETY_CARD_LAYOUT = { x: 24, y: 24, w: 420, h: 84, fontSize: 10, fontIndex: 0, colorIndex: 0, textBgIndex: 0 } as const;
const normalizeDoorVerificationHistory = (history: any): DoorVerificationEntry[] => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const company = String(entry?.company || '').trim();
      const date = typeof entry?.date === 'string' ? String(entry.date).trim() : '';
      const notes = typeof entry?.notes === 'string' ? String(entry.notes).trim() : '';
      const createdAtRaw = Number(entry?.createdAt);
      return {
        id: String(entry?.id || nanoid()),
        company,
        date: date || undefined,
        notes: notes || undefined,
        createdAt: Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now()
      } as DoorVerificationEntry;
    })
    .filter((entry) => !!entry.company || !!entry.date)
    .sort((a, b) => b.createdAt - a.createdAt);
};
const parseGoogleMapsCoordinates = (rawValue: string): { lat: number; lng: number } | null => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  const decimal = '[-+]?\\d{1,3}(?:\\.\\d+)?';
  const pair = new RegExp(`(${decimal})\\s*,\\s*(${decimal})`);
  const direct = raw.match(pair);
  const fromPair = direct || raw.match(/[@?&]q=([-+]?\d{1,3}(?:\.\d+)?),\s*([-+]?\d{1,3}(?:\.\d+)?)/);
  if (!fromPair) return null;
  const lat = Number(fromPair[1]);
  const lng = Number(fromPair[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};
const googleMapsUrlFromCoords = (rawValue: string) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const parsed = parseGoogleMapsCoordinates(raw);
  if (!parsed) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(`${parsed.lat},${parsed.lng}`)}`;
};

type SharedRoomSide = {
  anchorRoomId: string;
  otherRoomId: string;
  edgeIndex: number;
  otherEdgeIndex: number;
  tMin: number;
  tMax: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
};

const getRoomPolygon = (room: any): Array<{ x: number; y: number }> => {
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

const projectPointToSegment = (a: { x: number; y: number }, b: { x: number; y: number }, p: { x: number; y: number }) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0000001) {
    return { t: 0, x: a.x, y: a.y, distSq: (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) };
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  const distSq = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
  return { t, x, y, distSq };
};

const getSharedRoomSides = (roomA: Room, roomB: Room): SharedRoomSide[] => {
  const polyA = getRoomPolygon(roomA as any);
  const polyB = getRoomPolygon(roomB as any);
  if (polyA.length < 2 || polyB.length < 2) return [];
  const out: SharedRoomSide[] = [];
  const minOverlap = 8;
  const collinearTolerance = 1.8;
  const parallelTolerance = 0.03;
  const pushShared = (
    sourcePoly: { x: number; y: number }[],
    sourceRoomId: string,
    targetPoly: { x: number; y: number }[],
    targetRoomId: string
  ) => {
    for (let i = 0; i < sourcePoly.length; i += 1) {
      const a = sourcePoly[i];
      const b = sourcePoly[(i + 1) % sourcePoly.length];
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const len = Math.hypot(ux, uy);
      if (len < 0.0001) continue;
      const uxn = ux / len;
      const uyn = uy / len;
      for (let j = 0; j < targetPoly.length; j += 1) {
        const c = targetPoly[j];
        const d = targetPoly[(j + 1) % targetPoly.length];
        const vx = d.x - c.x;
        const vy = d.y - c.y;
        const vLen = Math.hypot(vx, vy);
        if (vLen < 0.0001) continue;
        const cross = Math.abs(uxn * (vy / vLen) - uyn * (vx / vLen));
        if (cross > parallelTolerance) continue;
        const lineDistC = Math.abs((c.x - a.x) * uy - (c.y - a.y) * ux) / len;
        const lineDistD = Math.abs((d.x - a.x) * uy - (d.y - a.y) * ux) / len;
        if (Math.min(lineDistC, lineDistD) > collinearTolerance) continue;
        const projC = (c.x - a.x) * uxn + (c.y - a.y) * uyn;
        const projD = (d.x - a.x) * uxn + (d.y - a.y) * uyn;
        const from = Math.max(0, Math.min(projC, projD));
        const to = Math.min(len, Math.max(projC, projD));
        const overlap = to - from;
        if (overlap < minOverlap) continue;
        const tMin = Math.max(0, Math.min(1, from / len));
        const tMax = Math.max(0, Math.min(1, to / len));
        if (tMax - tMin < 0.0001) continue;
        out.push({
          anchorRoomId: sourceRoomId,
          otherRoomId: targetRoomId,
          edgeIndex: i,
          otherEdgeIndex: j,
          tMin,
          tMax,
          a: { x: a.x + ux * tMin, y: a.y + uy * tMin },
          b: { x: a.x + ux * tMax, y: a.y + uy * tMax }
        });
      }
    }
  };
  pushShared(polyA, String(roomA.id), polyB, String(roomB.id));
  pushShared(polyB, String(roomB.id), polyA, String(roomA.id));
  return out;
};

const normalizeRoomConnectionDoorInput = (door: any): RoomConnectionDoor | null => {
  const roomAId = String(door?.roomAId || '').trim();
  const roomBId = String(door?.roomBId || '').trim();
  if (!roomAId || !roomBId || roomAId === roomBId) return null;
  const anchorRoomIdRaw = String(door?.anchorRoomId || '').trim();
  const anchorRoomId = anchorRoomIdRaw === roomAId || anchorRoomIdRaw === roomBId ? anchorRoomIdRaw : roomAId;
  const edgeIndex = Number(door?.edgeIndex);
  const t = Number(door?.t);
  if (!Number.isFinite(edgeIndex) || !Number.isFinite(t)) return null;
  return {
    ...door,
    id: String(door?.id || nanoid()),
    roomAId,
    roomBId,
    anchorRoomId,
    edgeIndex: Number(edgeIndex),
    t: Math.max(0, Math.min(1, Number(t))),
    catalogTypeId: typeof door?.catalogTypeId === 'string' ? String(door.catalogTypeId).trim() || undefined : undefined,
    mode: door?.mode === 'auto_sensor' || door?.mode === 'automated' ? door.mode : 'static',
    automationUrl: typeof door?.automationUrl === 'string' ? String(door.automationUrl).trim() || undefined : undefined,
    description: typeof door?.description === 'string' ? String(door.description).trim() || undefined : undefined,
    isEmergency: !!door?.isEmergency,
    isMainEntrance: !!door?.isMainEntrance,
    isExternal: !!door?.isExternal,
    isFireDoor: !!door?.isFireDoor,
    lastVerificationAt: typeof door?.lastVerificationAt === 'string' ? String(door.lastVerificationAt).trim() || undefined : undefined,
    verifierCompany: typeof door?.verifierCompany === 'string' ? String(door.verifierCompany).trim() || undefined : undefined,
    verificationHistory: normalizeDoorVerificationHistory(door?.verificationHistory)
  };
};

const PlanView = ({ planId }: Props) => {
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
  const viewportLiveRef = useRef<{ zoom: number; pan: { x: number; y: number } }>({ zoom: 1, pan: { x: 0, y: 0 } });
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
    addLink,
    deleteLink,
    updateLink,
    addRackLink,
    deleteRackLink,
    updateRackItem,
    updateClientLayers
  } = useDataStore(
    (s) => ({
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
      addLink: (s as any).addLink,
      deleteLink: (s as any).deleteLink,
      updateLink: (s as any).updateLink,
      addRackLink: (s as any).addRackLink,
      deleteRackLink: (s as any).deleteRackLink,
      updateRackItem: (s as any).updateRackItem,
      updateClientLayers: (s as any).updateClientLayers
	    }),
	    shallow
	  );

  const objectTypeDefs = useDataStore((s) => s.objectTypes);
  const objectTypeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const def of objectTypeDefs || []) map.set(def.id, def);
    return map;
  }, [objectTypeDefs]);
  const wallTypeIdSet = useMemo(() => {
    const ids = new Set<string>(WALL_TYPE_IDS as string[]);
    for (const def of objectTypeDefs || []) {
      if ((def as any)?.category === 'wall') ids.add(def.id);
    }
    return ids;
  }, [objectTypeDefs]);
  const wallTypeDefs = useMemo(
    () => (objectTypeDefs || []).filter((def) => wallTypeIdSet.has(def.id)),
    [objectTypeDefs, wallTypeIdSet]
  );
  const doorTypeIdSet = useMemo(() => {
    const ids = new Set<string>();
    for (const def of objectTypeDefs || []) {
      if ((def as any)?.category === 'door') ids.add(def.id);
    }
    return ids;
  }, [objectTypeDefs]);
  const doorTypeDefs = useMemo(
    () =>
      (objectTypeDefs || [])
        .filter((def) => doorTypeIdSet.has(def.id))
        .slice()
        .sort((a, b) => ((a?.name?.[lang] as string) || a.id).localeCompare((b?.name?.[lang] as string) || b.id)),
    [doorTypeIdSet, lang, objectTypeDefs]
  );
  const defaultDoorCatalogId = useMemo(() => {
    if (doorTypeIdSet.has('door_standard')) return 'door_standard';
    return doorTypeDefs[0]?.id || '';
  }, [doorTypeDefs, doorTypeIdSet]);
  const deskCatalogDefs = useMemo(
    () => (objectTypeDefs || []).filter((def) => isDeskType(def.id)),
    [objectTypeDefs]
  );
  const wallAttenuationByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const def of wallTypeDefs || []) {
      const value = Number((def as any).attenuationDb);
      if (Number.isFinite(value) && value > 0) {
        map.set(def.id, value);
      }
    }
    return map;
  }, [wallTypeDefs]);
  const defaultWallTypeId = useMemo(() => {
    if (wallTypeIdSet.has('wall_brick')) return 'wall_brick';
    return wallTypeDefs[0]?.id || DEFAULT_WALL_TYPES[0];
  }, [wallTypeDefs, wallTypeIdSet]);

  const getTypeLabel = useCallback(
    (typeId: string) => {
      const def = objectTypeById.get(typeId);
      return (def?.name?.[lang] as string) || (def?.name?.it as string) || typeId;
    },
    [lang, objectTypeById]
  );

  const getTypeIcon = useCallback((typeId: string) => objectTypeById.get(typeId)?.icon, [objectTypeById]);
  const isWallType = useCallback((typeId: string) => wallTypeIdSet.has(typeId), [wallTypeIdSet]);
  const isDoorType = useCallback((typeId: string) => doorTypeIdSet.has(typeId), [doorTypeIdSet]);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [lang]
  );
  const formatNumber = useCallback(
    (value: number) => (Number.isFinite(value) ? numberFormatter.format(value) : '--'),
    [numberFormatter]
  );
  const getLayerNote = useCallback(
    (layer: any) => {
      const note = layer?.note;
      if (!note) return '';
      if (typeof note === 'string') return note;
      return String(note?.[lang] || note?.it || note?.en || '').trim();
    },
    [lang]
  );

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

  const isCameraType = useCallback((typeId: string) => typeId === 'camera', []);

  const inferDefaultLayerIds = useCallback(
    (typeId: string, layerIdSet?: Set<string>) => {
      const ids =
        typeId === 'user' || typeId === 'real_user' || typeId === 'generic_user'
          ? ['users']
          : typeId === 'rack'
            ? ['racks']
            : isDeskType(typeId)
              ? ['desks']
              : isCameraType(typeId)
                ? ['cctv']
                : typeId === 'wifi'
                  ? ['wifi']
                  : typeId === 'quote'
                    ? ['quotes']
                    : typeId === 'text'
                      ? ['text']
                    : typeId === 'image'
                      ? ['images']
                      : typeId === 'photo'
                        ? ['photos']
                : typeId === 'postit'
                  ? ['text']
                  : isSecurityTypeId(typeId)
                    ? [SECURITY_LAYER_ID]
                    : isWallType(typeId)
                      ? ['walls']
                      : ['devices'];
      return layerIdSet ? ids.filter((id) => layerIdSet.has(id)) : ids;
    },
    [isCameraType, isWallType]
  );
  const normalizeVisibleLayerIdsByPlan = useCallback((input?: Record<string, string[]>) => {
    const out: Record<string, string[]> = {};
    for (const [planId, ids] of Object.entries(input || {})) {
      if (!Array.isArray(ids)) continue;
      const uniq = Array.from(new Set(ids.map((id) => String(id))));
      uniq.sort();
      out[planId] = uniq;
    }
    return out;
  }, []);

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
	    presentationWebcamEnabled,
	    setPresentationWebcamEnabled,
	    presentationWebcamCalib,
	    setPresentationWebcamCalib,
	    presentationEnterRequested,
	    clearPresentationEnterRequest,
      cameraPermissionState,
      setCameraPermissionState,
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
	      presentationWebcamEnabled: (s as any).presentationWebcamEnabled,
	      setPresentationWebcamEnabled: (s as any).setPresentationWebcamEnabled,
	      presentationWebcamCalib: (s as any).presentationWebcamCalib,
	      setPresentationWebcamCalib: (s as any).setPresentationWebcamCalib,
	      presentationEnterRequested: (s as any).presentationEnterRequested,
	      clearPresentationEnterRequest: (s as any).clearPresentationEnterRequest,
        cameraPermissionState: (s as any).cameraPermissionState,
        setCameraPermissionState: (s as any).setCameraPermissionState,
	      hiddenLayersByPlan: (s as any).hiddenLayersByPlan,
	      setHideAllLayers: (s as any).setHideAllLayers,
	      setLockedPlans: (s as any).setLockedPlans,
      setPlanDirty: (s as any).setPlanDirty,
      requestSaveAndNavigate: (s as any).requestSaveAndNavigate,
      pendingSaveNavigateTo: (s as any).pendingSaveNavigateTo,
      clearPendingSaveNavigate: (s as any).clearPendingSaveNavigate,
      pendingPostSaveAction: (s as any).pendingPostSaveAction,
      clearPendingPostSaveAction: (s as any).clearPendingPostSaveAction
    }),
    shallow
  );

  const { push, pushStack } = useToastStore((s) => ({ push: s.push, pushStack: (s as any).pushStack }));
  const saveCustomValues = useCustomFieldsStore((s) => s.saveObjectValues);
  const loadCustomValues = useCustomFieldsStore((s) => s.loadObjectValues);
  const dataVersion = useDataStore((s) => s.version);
  const [pendingType, setPendingType] = useState<MapObjectType | null>(null);
  const [linkCreateMode, setLinkCreateMode] = useState<'arrow' | 'cable'>('arrow');
  const [modalState, setModalState] = useState<
    | { mode: 'create'; type: MapObjectType; coords: { x: number; y: number }; textBoxWidth?: number; textBoxHeight?: number }
    | { mode: 'edit'; objectId: string }
    | { mode: 'duplicate'; objectId: string; coords: { x: number; y: number } }
    | null
  >(null);
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
  const [realUserPicker, setRealUserPicker] = useState<{ x: number; y: number } | null>(null);
  const [realUserImportMissing, setRealUserImportMissing] = useState(false);
  const [capacityConfirm, setCapacityConfirm] = useState<{
    mode: 'place' | 'move';
    type: MapObjectType;
    x: number;
    y: number;
    roomId: string;
    roomName: string;
    capacity: number;
    objectId?: string;
    prevX?: number;
    prevY?: number;
    prevRoomId?: string;
  } | null>(null);
  const capacityConfirmRef = useRef<typeof capacityConfirm>(null);
  useEffect(() => {
    capacityConfirmRef.current = capacityConfirm;
  }, [capacityConfirm]);
  const [undoConfirm, setUndoConfirm] = useState<{ id: string; name: string } | null>(null);
  const [overlapNotice, setOverlapNotice] = useState<string | null>(null);
  const roomOverlapNoticeRef = useRef(0);
  const roomLayerNoticeRef = useRef(0);
  const [allTypesOpen, setAllTypesOpen] = useState(false);
  const [allTypesDefaultTab, setAllTypesDefaultTab] = useState<'all' | 'objects' | 'desks' | 'walls' | 'text' | 'notes' | 'security'>(
    'objects'
  );
  const [roomCatalogOpen, setRoomCatalogOpen] = useState(false);
  const [wallCatalogOpen, setWallCatalogOpen] = useState(false);
  const [deskCatalogOpen, setDeskCatalogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<
    | { kind: 'object'; id: string; x: number; y: number; wallSegmentLengthPx?: number }
    | { kind: 'link'; id: string; x: number; y: number }
    | { kind: 'room'; id: string; x: number; y: number; worldX: number; worldY: number }
    | { kind: 'corridor'; id: string; x: number; y: number; worldX: number; worldY: number }
    | { kind: 'corridor_door'; corridorId: string; doorId: string; x: number; y: number }
    | { kind: 'room_door'; doorId: string; x: number; y: number }
    | { kind: 'corridor_connection'; corridorId: string; connectionId: string; x: number; y: number; worldX: number; worldY: number }
    | { kind: 'safety_card'; x: number; y: number; worldX: number; worldY: number }
    | { kind: 'scale'; x: number; y: number }
    | { kind: 'map'; x: number; y: number; worldX: number; worldY: number }
    | null
  >(null);
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
  const [rackPortsLink, setRackPortsLink] = useState<{
    itemId: string;
    kind?: RackPortKind;
    openConnections?: boolean;
  } | null>(null);
  const [selectedViewId, setSelectedViewId] = useState<string>('__last__');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchResultsTerm, setSearchResultsTerm] = useState('');
  const [searchResultsObjects, setSearchResultsObjects] = useState<MapObject[]>([]);
  const [searchResultsRooms, setSearchResultsRooms] = useState<Room[]>([]);
  const [crossPlanSearchOpen, setCrossPlanSearchOpen] = useState(false);
  const [crossPlanSearchTerm, setCrossPlanSearchTerm] = useState('');
  const [crossPlanResults, setCrossPlanResults] = useState<CrossPlanSearchResult[]>([]);
  const [internalMapOpen, setInternalMapOpen] = useState(false);
  const [escapeRouteModal, setEscapeRouteModal] = useState<{
    startPoint: { x: number; y: number };
    startPlanId: string;
    sourceKind: 'map' | 'room' | 'corridor';
  } | null>(null);
  const [emergencyContactsOpen, setEmergencyContactsOpen] = useState(false);
  const normalizeSafetyCardLayout = useCallback((layout: any) => {
    const x = Number(layout?.x);
    const y = Number(layout?.y);
    const w = Number(layout?.w);
    const h = Number(layout?.h);
    const fontSize = Number(layout?.fontSize);
    const fontIndex = Number(layout?.fontIndex);
    const colorIndex = Number(layout?.colorIndex);
    const textBgIndex = Number(layout?.textBgIndex);
    return {
      x: Number.isFinite(x) ? x : DEFAULT_SAFETY_CARD_LAYOUT.x,
      y: Number.isFinite(y) ? y : DEFAULT_SAFETY_CARD_LAYOUT.y,
      w: Number.isFinite(w) ? Math.max(220, w) : DEFAULT_SAFETY_CARD_LAYOUT.w,
      h: Number.isFinite(h) ? Math.max(56, h) : DEFAULT_SAFETY_CARD_LAYOUT.h,
      fontSize: Number.isFinite(fontSize) ? Math.max(8, Math.min(22, fontSize)) : DEFAULT_SAFETY_CARD_LAYOUT.fontSize,
      fontIndex: Number.isFinite(fontIndex) ? Math.max(0, Math.floor(fontIndex)) : DEFAULT_SAFETY_CARD_LAYOUT.fontIndex,
      colorIndex: Number.isFinite(colorIndex) ? Math.max(0, Math.floor(colorIndex)) : DEFAULT_SAFETY_CARD_LAYOUT.colorIndex,
      textBgIndex: Number.isFinite(textBgIndex) ? Math.max(0, Math.floor(textBgIndex)) : DEFAULT_SAFETY_CARD_LAYOUT.textBgIndex
    };
  }, []);
  const [safetyCardPos, setSafetyCardPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 }); // world coords
  const [safetyCardSize, setSafetyCardSize] = useState<{ w: number; h: number }>({ w: 420, h: 84 }); // world size
  const [safetyCardFontSize, setSafetyCardFontSize] = useState<number>(10);
  const [safetyCardFontIndex, setSafetyCardFontIndex] = useState<number>(0);
  const [safetyCardColorIndex, setSafetyCardColorIndex] = useState<number>(0);
  const [safetyCardTextBgIndex, setSafetyCardTextBgIndex] = useState<number>(0);
  const [countsOpen, setCountsOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [layersPopoverOpen, setLayersPopoverOpen] = useState(false);
  const [layersQuickMenu, setLayersQuickMenu] = useState<{ x: number; y: number } | null>(null);
  const [layerRevealPrompt, setLayerRevealPrompt] = useState<{
    objectId: string;
    objectName: string;
    typeId: string;
    missingLayerIds: string[];
  } | null>(null);
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
  const [capacityDashboardOpen, setCapacityDashboardOpen] = useState(false);
  const [roomDepartmentOptions, setRoomDepartmentOptions] = useState<string[]>([]);
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement | null>(null);
  const presenceRef = useRef<HTMLDivElement | null>(null);
  const [scaleActionsOpen, setScaleActionsOpen] = useState(false);
  const [clearScaleConfirmOpen, setClearScaleConfirmOpen] = useState(false);
  const [scalePromptDismissed, setScalePromptDismissed] = useState(false);
  const layersPopoverRef = useRef<HTMLDivElement | null>(null);
  const layersQuickMenuRef = useRef<HTMLDivElement | null>(null);
  const [panToolActive, setPanToolActive] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string | undefined>(undefined);
  const [selectedCorridorDoor, setSelectedCorridorDoor] = useState<{ corridorId: string; doorId: string } | null>(null);
  const [selectedRoomDoorId, setSelectedRoomDoorId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [wallQuickMenu, setWallQuickMenu] = useState<{
    id: string;
    x: number;
    y: number;
    world: { x: number; y: number };
  } | null>(null);
  const [corridorQuickMenu, setCorridorQuickMenu] = useState<{
    id: string;
    x: number;
    y: number;
    world: { x: number; y: number };
  } | null>(null);
  const [corridorDoorDraft, setCorridorDoorDraft] = useState<{
    corridorId: string;
    start?: { edgeIndex: number; t: number; x: number; y: number };
  } | null>(null);
  const [roomDoorDraft, setRoomDoorDraft] = useState<{
    roomAId: string;
    roomBId: string;
    sharedSides: SharedRoomSide[];
  } | null>(null);
  const [wallTypeMenu, setWallTypeMenu] = useState<{ ids: string[]; x: number; y: number } | null>(null);
  const [mapSubmenu, setMapSubmenu] = useState<null | 'view' | 'measure' | 'create' | 'print' | 'manage'>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [cableModal, setCableModal] = useState<{ mode: 'create'; fromId: string; toId: string } | { mode: 'edit'; linkId: string } | null>(null);
  const [linksModalObjectId, setLinksModalObjectId] = useState<string | null>(null);
  const [linkEditId, setLinkEditId] = useState<string | null>(null);
  const [realUserDetailsId, setRealUserDetailsId] = useState<string | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{
    photos: PhotoItem[];
    initialId?: string;
    title?: { it: string; en: string };
    countLabel?: { it: string; en: string };
    itemLabel?: { it: string; en: string };
    emptyLabel?: { it: string; en: string };
  } | null>(null);
  const [roomDrawMode, setRoomDrawMode] = useState<'rect' | 'poly' | null>(null);
  const [corridorDrawMode, setCorridorDrawMode] = useState<'poly' | null>(null);
  const [wallDrawMode, setWallDrawMode] = useState(false);
  const [wallDrawType, setWallDrawType] = useState<MapObjectType | null>(null);
  const [wallDraftPoints, setWallDraftPoints] = useState<{ x: number; y: number }[]>([]);
  const [wallDraftPointer, setWallDraftPointer] = useState<{ x: number; y: number } | null>(null);
  const wallDraftPointsRef = useRef<{ x: number; y: number }[]>([]);
  const wallDraftSegmentIdsRef = useRef<string[]>([]);
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleDraft, setScaleDraft] = useState<{ start?: { x: number; y: number }; end?: { x: number; y: number } } | null>(null);
  const [scaleDraftPointer, setScaleDraftPointer] = useState<{ x: number; y: number } | null>(null);
  const [scaleModal, setScaleModal] = useState<{ start: { x: number; y: number }; end: { x: number; y: number }; distance: number } | null>(
    null
  );
  const [scaleMetersInput, setScaleMetersInput] = useState('');
  const [showScaleLine, setShowScaleLine] = useState(true);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const [measurePointer, setMeasurePointer] = useState<{ x: number; y: number } | null>(null);
  const [measureClosed, setMeasureClosed] = useState(false);
  const [measureFinished, setMeasureFinished] = useState(false);
  const measurePointsRef = useRef<{ x: number; y: number }[]>([]);
  const measureClosedRef = useRef(false);
  const measureFinishedRef = useRef(false);
  const toolClickHistoryRef = useRef<{ x: number; y: number; at: number }[]>([]);
  const scaleToastIdRef = useRef<string | number | null>(null);
  const wallToastIdRef = useRef<string | number | null>(null);
  const measureToastIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    measurePointsRef.current = measurePoints;
  }, [measurePoints]);
  useEffect(() => {
    measureClosedRef.current = measureClosed;
  }, [measureClosed]);
  useEffect(() => {
    measureFinishedRef.current = measureFinished;
  }, [measureFinished]);
  const [quoteMode, setQuoteMode] = useState(false);
  const [quotePoints, setQuotePoints] = useState<{ x: number; y: number }[]>([]);
  const [quotePointer, setQuotePointer] = useState<{ x: number; y: number } | null>(null);
  const toolMode = scaleMode ? 'scale' : wallDrawMode ? 'wall' : quoteMode ? 'quote' : measureMode ? 'measure' : null;
  const [newRoomMenuOpen, setNewRoomMenuOpen] = useState(false);
  const [highlightRoom, setHighlightRoom] = useState<{ roomId: string; until: number } | null>(null);
  const [roomModal, setRoomModal] = useState<
    | { mode: 'create'; kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
    | { mode: 'create'; kind: 'poly'; points: { x: number; y: number }[] }
    | {
        mode: 'edit';
        roomId: string;
        initialName: string;
        initialNameEn?: string;
        initialCapacity?: number;
        initialShowName?: boolean;
        initialSurfaceSqm?: number;
        initialNotes?: string;
        initialLogical?: boolean;
      }
    | null
  >(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);
  const [confirmDeleteRoomIds, setConfirmDeleteRoomIds] = useState<string[] | null>(null);
  const [confirmDeleteCorridorId, setConfirmDeleteCorridorId] = useState<string | null>(null);
  const [corridorModal, setCorridorModal] = useState<
    | {
        mode: 'create';
        kind: 'poly';
        points: { x: number; y: number }[];
        initialName?: string;
        initialNameEn?: string;
        initialShowName?: boolean;
      }
    | { mode: 'edit'; corridorId: string; initialName: string; initialNameEn?: string; initialShowName?: boolean }
    | null
  >(null);
  const [corridorNameInput, setCorridorNameInput] = useState('');
  const [corridorNameEnInput, setCorridorNameEnInput] = useState('');
  const corridorNameInputRef = useRef<HTMLInputElement | null>(null);
  const [corridorShowNameInput, setCorridorShowNameInput] = useState(true);
  const [corridorDoorModal, setCorridorDoorModal] = useState<{
    corridorId: string;
    doorId: string;
    description: string;
    isEmergency: boolean;
    isMainEntrance: boolean;
    isExternal: boolean;
    isFireDoor: boolean;
    lastVerificationAt: string;
    verifierCompany: string;
    verificationHistory: DoorVerificationEntry[];
    mode: 'static' | 'auto_sensor' | 'automated';
    automationUrl: string;
  } | null>(null);
  const [corridorDoorLinkModal, setCorridorDoorLinkModal] = useState<{
    corridorId: string;
    doorId: string;
    selectedRoomIds: string[];
    nearestRoomId?: string;
    magneticRoomIds?: string[];
  } | null>(null);
  const [corridorDoorLinkQuery, setCorridorDoorLinkQuery] = useState('');
  const [corridorConnectionModal, setCorridorConnectionModal] = useState<{
    connectionId?: string | null;
    corridorId: string;
    edgeIndex: number;
    t: number;
    x: number;
    y: number;
    selectedPlanIds: string[];
    transitionType: 'stairs' | 'elevator';
  } | null>(null);
  const handleSafetyCardChange = useCallback(
    (
      layout: { x: number; y: number; w: number; h: number; fontSize: number; fontIndex?: number; colorIndex?: number; textBgIndex?: number },
      options?: { commit?: boolean }
    ) => {
      const normalized = normalizeSafetyCardLayout(layout);
      setSafetyCardPos({ x: normalized.x, y: normalized.y });
      setSafetyCardSize({ w: normalized.w, h: normalized.h });
      setSafetyCardFontSize(normalized.fontSize);
      setSafetyCardFontIndex(normalized.fontIndex);
      setSafetyCardColorIndex(normalized.colorIndex);
      setSafetyCardTextBgIndex(normalized.textBgIndex);
      if (!options?.commit || !planRef.current || isReadOnlyRef.current) return;
      const baseLayout = normalizeSafetyCardLayout((planRef.current as any)?.safetyCardLayout);
      const hasDiff =
        Math.abs(normalized.x - baseLayout.x) > 0.15 ||
        Math.abs(normalized.y - baseLayout.y) > 0.15 ||
        Math.abs(normalized.w - baseLayout.w) > 0.15 ||
        Math.abs(normalized.h - baseLayout.h) > 0.15 ||
        Math.abs(normalized.fontSize - baseLayout.fontSize) > 0.01 ||
        normalized.fontIndex !== baseLayout.fontIndex ||
        normalized.colorIndex !== baseLayout.colorIndex ||
        normalized.textBgIndex !== baseLayout.textBgIndex;
      if (hasDiff) updateFloorPlan((planRef.current as any).id, { safetyCardLayout: normalized } as any);
    },
    [normalizeSafetyCardLayout, updateFloorPlan]
  );
  useEffect(() => {
    if (!corridorModal) return;
    setCorridorNameInput(corridorModal.initialName || '');
    setCorridorNameEnInput(corridorModal.initialNameEn || '');
    setCorridorShowNameInput(corridorModal.initialShowName !== false);
  }, [corridorModal]);
  useEffect(() => {
    if (!corridorModal) return;
    const timer = window.setTimeout(() => {
      const el = corridorNameInputRef.current;
      if (!el) return;
      const len = el.value.length;
      el.focus();
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore unsupported inputs
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [corridorModal]);
  useEffect(() => {
    if (corridorDoorLinkModal) return;
    if (corridorDoorLinkQuery) setCorridorDoorLinkQuery('');
  }, [corridorDoorLinkModal, corridorDoorLinkQuery]);
  const [wallTypeModal, setWallTypeModal] = useState<{ ids: string[]; typeId: string } | null>(null);
  const [wallTypeDraft, setWallTypeDraft] = useState<string>('');
  const [roomWallTypeModal, setRoomWallTypeModal] = useState<{
    roomId: string;
    roomName: string;
    segments: { start: { x: number; y: number }; end: { x: number; y: number }; label: string }[];
    mode?: 'create' | 'edit';
    wallIds?: string[];
    wallTypes?: string[];
  } | null>(null);
  const [roomWallTypeSelections, setRoomWallTypeSelections] = useState<string[]>([]);
  const [roomWallPrompt, setRoomWallPrompt] = useState<{
    roomId: string;
    roomName: string;
    kind: 'rect' | 'poly';
    rect?: { x: number; y: number; width: number; height: number };
    points?: { x: number; y: number }[];
  } | null>(null);

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
  const zoomRef = useRef<number>(zoom);
  const renderStartRef = useRef(0);
  const layerVisibilitySyncRef = useRef<string>('');
  renderStartRef.current = performance.now();

  const dismissSelectionHintToasts = useCallback(() => {
    selectionToastKeyRef.current = '';
    if (selectionToastIdRef.current != null) {
      toast.dismiss(selectionToastIdRef.current);
      selectionToastIdRef.current = null;
    }
    deskToastKeyRef.current = '';
    if (deskToastIdRef.current != null) {
      toast.dismiss(deskToastIdRef.current);
      deskToastIdRef.current = null;
    }
    multiToastKeyRef.current = '';
    if (multiToastIdRef.current != null) {
      toast.dismiss(multiToastIdRef.current);
      multiToastIdRef.current = null;
    }
    quoteToastKeyRef.current = '';
    if (quoteToastIdRef.current != null) {
      toast.dismiss(quoteToastIdRef.current);
      quoteToastIdRef.current = null;
    }
    mediaToastKeyRef.current = '';
    if (mediaToastIdRef.current != null) {
      toast.dismiss(mediaToastIdRef.current);
      mediaToastIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  const handleMapMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
  }, []);
  const handleMapMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
    lastPointerClickRef.current = { x: event.clientX, y: event.clientY };
  }, []);
  const getPastePoint = useCallback(() => {
    const last = lastPointerClickRef.current;
    const el = mapRef.current;
    if (!last || !el) return null;
    const rect = el.getBoundingClientRect();
    const localX = last.x - rect.left;
    const localY = last.y - rect.top;
    const z = zoomRef.current || 1;
    const p = panRef.current || { x: 0, y: 0 };
    return { x: (localX - p.x) / z, y: (localY - p.y) / z };
  }, []);
  useEffect(() => {
    wallDraftPointsRef.current = wallDraftPoints;
  }, [wallDraftPoints]);

  const plan = useDataStore(
    useCallback((s) => s.findFloorPlan(planId), [planId])
  );
  const allClients = useDataStore((s) => s.clients);
  const client = useDataStore(
    useCallback((s) => s.findClientByPlan(planId), [planId])
  );
  const site = useDataStore(
    useCallback((s) => s.findSiteByPlan(planId), [planId])
  );
  const siteFloorPlans = useMemo(() => ((site?.floorPlans || []) as FloorPlan[]).filter(Boolean), [site?.floorPlans]);
  useEffect(() => {
    let cancelled = false;
    const clientId = String(client?.id || '').trim();
    if (!clientId) {
      setRoomDepartmentOptions([]);
      return;
    }
    const fallbackSet = new Map<string, string>();
    const clientEntry = (allClients || []).find((entry) => entry.id === clientId);
    for (const siteEntry of clientEntry?.sites || []) {
      for (const floor of siteEntry.floorPlans || []) {
        for (const room of floor.rooms || []) {
          for (const tag of (room as any)?.departmentTags || []) {
            const normalized = String(tag || '').trim();
            if (!normalized) continue;
            const folded = normalized.toLocaleLowerCase();
            if (!fallbackSet.has(folded)) fallbackSet.set(folded, normalized);
          }
        }
        for (const obj of floor.objects || []) {
          if (String(obj.type) !== 'real_user') continue;
          for (const dept of [obj.externalDept1, obj.externalDept2, obj.externalDept3]) {
            const normalized = String(dept || '').trim();
            if (!normalized) continue;
            const folded = normalized.toLocaleLowerCase();
            if (!fallbackSet.has(folded)) fallbackSet.set(folded, normalized);
          }
        }
      }
    }
    const applyFallback = () => {
      const fallback = Array.from(fallbackSet.values()).sort((a, b) => a.localeCompare(b));
      if (!cancelled) setRoomDepartmentOptions(fallback);
    };
    void (async () => {
      try {
        const res = await listExternalUsers({ clientId, includeHidden: true, includeMissing: true, limit: 5000 });
        const fromImport = new Map<string, string>();
        for (const row of res.rows || []) {
          for (const dept of [row.dept1, row.dept2, row.dept3]) {
            const normalized = String(dept || '').trim();
            if (!normalized) continue;
            const folded = normalized.toLocaleLowerCase();
            if (!fromImport.has(folded)) fromImport.set(folded, normalized);
          }
        }
        for (const [key, value] of fallbackSet.entries()) {
          if (!fromImport.has(key)) fromImport.set(key, value);
        }
        if (cancelled) return;
        setRoomDepartmentOptions(Array.from(fromImport.values()).sort((a, b) => a.localeCompare(b)));
      } catch {
        applyFallback();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allClients, client?.id]);
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

  useEffect(() => {
    if (!wallTypeModal) return;
    setWallTypeDraft(wallTypeModal.typeId);
  }, [wallTypeModal]);

  useEffect(() => {
    if (!roomWallTypeModal) {
      setRoomWallTypeSelections([]);
      return;
    }
    const nextDefault = defaultWallTypeId || DEFAULT_WALL_TYPES[0];
    const desired =
      roomWallTypeModal.wallTypes && roomWallTypeModal.wallTypes.length === roomWallTypeModal.segments.length
        ? roomWallTypeModal.wallTypes
        : roomWallTypeModal.segments.map(() => nextDefault);
    setRoomWallTypeSelections(desired);
  }, [defaultWallTypeId, roomWallTypeModal]);

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

		  const [lockState, setLockState] = useState<{
		    lockedBy: { userId: string; username: string; avatarUrl?: string } | null;
		    mine: boolean;
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
		      | null;
		    meta:
		      | {
		          lastActionAt?: number | null;
		          lastSavedAt?: number | null;
		          lastSavedRev?: string | null;
		        }
		      | null;
		  }>({ lockedBy: null, mine: false, grant: null, meta: null });
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [globalPresenceUsers, setGlobalPresenceUsers] = useState<PresenceUser[]>([]);
  const [realtimeDisabled, setRealtimeDisabled] = useState(false);
  const realtimeDisabledRef = useRef(false);
		  const wsRef = useRef<WebSocket | null>(null);
		  const lockRequestAtRef = useRef(0);
		  const [unlockPrompt, setUnlockPrompt] = useState<{
		    requestId: string;
		    planId: string;
	    planName: string;
	    clientName?: string;
	    siteName?: string;
	    requestedBy: { userId: string; username: string };
	    message?: string;
		  } | null>(null);
		  const [unlockBusy, setUnlockBusy] = useState(false);
		  const [unlockCompose, setUnlockCompose] = useState<{ target: PresenceUser; locks: UnlockRequestLock[] } | null>(null);
		  const [unlockGrantedPrompt, setUnlockGrantedPrompt] = useState<{
		    planId: string;
		    clientName?: string;
		    siteName?: string;
		    planName?: string;
		    grantedBy?: { userId: string; username: string; avatarUrl?: string } | null;
		    grantedAt?: number | null;
		    expiresAt?: number | null;
		    minutes?: number | null;
		  } | null>(null);
		  const [lockInfoOpen, setLockInfoOpen] = useState(false);
		  const lockInfoRef = useRef<HTMLDivElement | null>(null);
		  const [forceUnlockConfig, setForceUnlockConfig] = useState<{
		    planId: string;
		    planName: string;
		    clientName: string;
		    siteName: string;
		    userId: string;
		    username: string;
		    avatarUrl?: string;
		  } | null>(null);
		  const [forceUnlockGraceMinutes, setForceUnlockGraceMinutes] = useState(5);
		  const [forceUnlockStarting, setForceUnlockStarting] = useState(false);
			  const [forceUnlockActive, setForceUnlockActive] = useState<{
			    requestId: string;
			    planId: string;
			    targetUserId: string;
			    targetUsername: string;
			    graceEndsAt: number;
			    decisionEndsAt: number;
			    graceMinutes: number;
			    hasUnsavedChanges?: boolean | null;
			  } | null>(null);
			  const [forceUnlockIncoming, setForceUnlockIncoming] = useState<{
			    requestId: string;
			    planId: string;
			    clientName?: string;
			    siteName?: string;
			    planName?: string;
			    requestedBy?: { userId: string; username: string } | null;
			    graceEndsAt: number;
			    decisionEndsAt: number;
			    graceMinutes: number;
			    hasUnsavedChanges?: boolean | null;
			  } | null>(null);
		  const [forceUnlockExecuteCommand, setForceUnlockExecuteCommand] = useState<{ requestId: string; action: 'save' | 'discard' } | null>(null);
		  const [forceUnlockTick, setForceUnlockTick] = useState(0);
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
  const formatPresenceDate = useCallback(
    (value?: number | null) => {
      if (!value) return '—';
      try {
        return new Date(value).toLocaleString();
      } catch {
        return '—';
      }
    },
    []
  );

  const formatPresenceLock = useCallback(
    (
      lock?: { planId: string; clientName?: string; siteName?: string; planName?: string } | null,
      locks?: { planId: string; clientName?: string; siteName?: string; planName?: string }[]
    ) => {
      const list = Array.isArray(locks) && locks.length ? locks : lock ? [lock] : [];
      if (!list.length) return t({ it: 'Nessun lock', en: 'No lock' });
      if (list.length > 1) {
        return t({ it: `Lock attivi: ${list.length}`, en: `Active locks: ${list.length}` });
      }
      const entry = list[0];
      const parts = [entry.clientName, entry.siteName, entry.planName].filter((v) => v && String(v).trim().length);
      if (parts.length) return parts.join(' / ');
      return entry.planId || t({ it: 'Lock attivo', en: 'Lock active' });
    },
    [t]
  );

	  const lockActiveTitle = t({
	    it: 'Lock esclusivo: finché è attivo, solo tu puoi modificare questa planimetria. Il lock non scade per inattività: resta attivo finché non salvi o non concedi uno sblocco.',
	    en: 'Exclusive lock: while active, only you can edit this floor plan. The lock does not expire due to inactivity: it stays active until you save or grant an unlock.'
	  });
  const lockedByTitle = t({
    it: `Lock esclusivo detenuto da ${lockState.lockedBy?.username || 'utente'}. Finché è attivo, la planimetria è in sola lettura. Puoi acquisire il lock quando torna libero.`,
    en: `Exclusive lock held by ${lockState.lockedBy?.username || 'user'}. While active, this floor plan is read-only. You can acquire the lock when it becomes available.`
  });

  const formatMinutes = useCallback((value?: number | null): string => {
    if (value === null || value === undefined) return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (n === 0.5) return '0,5';
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 10) / 10);
  }, []);

  const grantRemainingMinutes = useMemo(() => {
    const exp = Number(lockState?.grant?.expiresAt || 0);
    if (!Number.isFinite(exp) || exp <= 0) return null;
    const ms = exp - Date.now();
    if (ms <= 0) return 0;
    // Round to nearest 0.5 minute (matches SidebarTree).
    return Math.round((ms / 60_000) * 2) / 2;
  }, [lockState?.grant?.expiresAt, lockInfoOpen]);

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
	    if (!lockInfoOpen) return;
	    const onDown = (e: MouseEvent) => {
	      if (!lockInfoRef.current) return;
	      if (!lockInfoRef.current.contains(e.target as any)) setLockInfoOpen(false);
	    };
	    window.addEventListener('mousedown', onDown);
	    return () => window.removeEventListener('mousedown', onDown);
	  }, [lockInfoOpen]);

	  useEffect(() => {
	    if (!forceUnlockActive && !forceUnlockIncoming) return;
	    const id = window.setInterval(() => setForceUnlockTick((x) => x + 1), 1000);
	    return () => window.clearInterval(id);
	  }, [forceUnlockActive?.requestId, forceUnlockIncoming?.requestId]);

  useEffect(() => {
    if (!user?.id || realtimeDisabledRef.current || realtimeDisabled) return;
    const canRequestLock = !activeRevision && planAccess === 'rw';
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    let closed = false;
    let opened = false;

    const send = (obj: any) => {
      try {
        ws.send(JSON.stringify(obj));
      } catch {
        // ignore
      }
    };

    ws.onopen = () => {
      opened = true;
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
	        setLockState({
	          lockedBy,
	          mine: !!lockedBy && lockedBy.userId === user.id,
	          grant: msg.grant || null,
	          meta: msg.meta || null
	        });
	        updateLockedPlans(lockedBy, msg.grant || null, msg.meta || null, planId);
	      }
	      if (msg?.type === 'lock_denied' && msg.planId === planId) {
	        const lockedBy = msg.lockedBy || null;
	        setLockState({
	          lockedBy,
	          mine: false,
	          grant: msg.grant || null,
	          meta: msg.meta || null
	        });
	        updateLockedPlans(lockedBy, msg.grant || null, msg.meta || null, planId);
	      }
      if (msg?.type === 'presence' && msg.planId === planId) {
        if (perfEnabled) perfMetrics.presenceUpdates += 1;
        setPresenceUsers(Array.isArray(msg.users) ? msg.users : []);
      }
      if (msg?.type === 'global_presence') {
        setGlobalPresenceUsers(Array.isArray(msg.users) ? msg.users : []);
        if (msg.lockedPlans && typeof msg.lockedPlans === 'object') {
          setLockedPlans(msg.lockedPlans);
        }
      }
	      if (msg?.type === 'unlock_request' && msg.planId === planId) {
	        if (isReadOnlyRef.current || !lockMineRef.current) return;
	        setUnlockPrompt({
	          requestId: String(msg.requestId || ''),
	          planId: String(msg.planId || planId),
	          planName: String(msg.planName || planRef.current?.name || ''),
	          clientName: String(msg.clientName || ''),
	          siteName: String(msg.siteName || ''),
		          requestedBy: {
		            userId: String(msg.requestedBy?.userId || ''),
		            username: String(msg.requestedBy?.username || 'user')
		          },
	          message: String(msg.message || '')
	        });
	      }
      if (msg?.type === 'unlock_sent') {
        pushStack(
          t({
            it: 'Richiesta di unlock inviata.',
            en: 'Unlock request sent.'
          }),
          'info',
          { duration: LOCK_TOAST_MS }
        );
      }
      if (msg?.type === 'unlock_denied') {
        pushStack(
          t({
            it: 'Impossibile inviare la richiesta di unlock.',
            en: 'Unable to send unlock request.'
          }),
          'danger',
          { duration: LOCK_TOAST_MS }
        );
      }
		      if (msg?.type === 'unlock_result') {
		        const granted = msg.action === 'grant' || msg.action === 'grant_save' || msg.action === 'grant_discard';
		        if (granted) {
		          const takeover = String(msg?.takeover || '').trim(); // reserved|immediate|'' (legacy)
		          const minutes = typeof msg?.grant?.minutes === 'number' ? msg.grant.minutes : null;
		          pushStack(
		            t({
		              it:
		                takeover === 'immediate'
		                  ? 'Unlock concesso: lock acquisito immediatamente.'
		                  : `Unlock concesso${minutes ? `: valido per ${minutes} minuti` : ''}.`,
		              en:
		                takeover === 'immediate'
		                  ? 'Unlock granted: lock acquired immediately.'
		                  : `Unlock granted${minutes ? `: valid for ${minutes} minutes` : ''}.`
		            }),
		            'success',
		            { duration: LOCK_TOAST_MS }
		          );
		          if (takeover === 'immediate') {
		            // If we're already inside the plan, the server assigns the lock immediately; no takeover prompt needed.
		            return;
		          }
		          setUnlockGrantedPrompt({
		            planId: String(msg.planId || ''),
		            clientName: String(msg?.plan?.clientName || ''),
		            siteName: String(msg?.plan?.siteName || ''),
	            planName: String(msg?.plan?.planName || ''),
	            grantedBy: msg?.grantedBy
	              ? {
	                  userId: String(msg.grantedBy.userId || ''),
	                  username: String(msg.grantedBy.username || ''),
	                  avatarUrl: String(msg.grantedBy.avatarUrl || '')
	                }
	              : null,
		            grantedAt: typeof msg?.grant?.grantedAt === 'number' ? msg.grant.grantedAt : null,
		            expiresAt: typeof msg?.grant?.expiresAt === 'number' ? msg.grant.expiresAt : null,
		            minutes
		          });
		        } else {
	          pushStack(
	            t({
	              it: 'Unlock non concesso dall’utente.',
	              en: 'Unlock request denied by the user.'
	            }),
	            'danger',
	            { duration: LOCK_TOAST_MS }
	          );
	        }
	      }

		      if (msg?.type === 'force_unlock_started') {
		        setForceUnlockStarting(false);
		        const requestId = String(msg.requestId || '').trim();
		        const activePlanId = String(msg.planId || '').trim();
		        const targetUserId = String(msg.targetUserId || '').trim();
		        const graceEndsAt = Number(msg.graceEndsAt || msg.deadlineAt || 0) || Date.now();
		        const decisionEndsAt = Number(msg.decisionEndsAt || 0) || graceEndsAt + 5 * 60_000;
		        const graceMinutes = Number(msg.graceMinutes || 0) || 0;
		        const hasUnsavedChanges = typeof msg.hasUnsavedChanges === 'boolean' ? msg.hasUnsavedChanges : null;
		        const targetUsername = forceUnlockConfigRef.current?.username || 'user';
		        setForceUnlockActive({ requestId, planId: activePlanId, targetUserId, targetUsername, graceEndsAt, decisionEndsAt, graceMinutes, hasUnsavedChanges });
		        setForceUnlockConfig(null);
		        pushStack(t({ it: 'Force unlock avviato.', en: 'Force unlock started.' }), 'info', { duration: LOCK_TOAST_MS });
		      }
	      if (msg?.type === 'force_unlock_denied') {
	        setForceUnlockStarting(false);
	        pushStack(t({ it: 'Force unlock non disponibile.', en: 'Force unlock denied.' }), 'danger', { duration: LOCK_TOAST_MS });
	      }
		      if (msg?.type === 'force_unlock_done') {
		        const requestId = String(msg.requestId || '').trim();
		        if (forceUnlockActiveRef.current?.requestId === requestId) {
		          pushStack(t({ it: 'Force unlock completato.', en: 'Force unlock completed.' }), 'success', { duration: LOCK_TOAST_MS });
		          setForceUnlockActive(null);
		        }
		      }
		      if (msg?.type === 'force_unlock_cancelled' || msg?.type === 'force_unlock_expired') {
		        const requestId = String(msg.requestId || '').trim();
		        const isExpired = msg?.type === 'force_unlock_expired';
		        const userMsg = t({
		          it: isExpired
		            ? 'Unlock forzato scaduto o annullato: puoi continuare il tuo lavoro e lasciare il lock all’utente.'
		            : 'Unlock forzato scaduto o annullato: puoi continuare il tuo lavoro e lasciare il lock all’utente.',
		          en: isExpired
		            ? 'Force unlock expired or cancelled: you can keep working and keep the lock.'
		            : 'Force unlock expired or cancelled: you can keep working and keep the lock.'
		        });
		        if (forceUnlockIncomingRef.current?.requestId === requestId) {
		          pushStack(userMsg, 'info', { duration: LOCK_TOAST_MS });
		          setForceUnlockIncoming(null);
		        }
		        if (forceUnlockActiveRef.current?.requestId === requestId) {
		          pushStack(
		            t({
		              it: isExpired ? 'Force unlock scaduto.' : 'Force unlock annullato.',
		              en: isExpired ? 'Force unlock expired.' : 'Force unlock cancelled.'
		            }),
		            'info',
		            { duration: LOCK_TOAST_MS }
		          );
		          setForceUnlockActive(null);
		        }
		      }

		      if (msg?.type === 'force_unlock' && msg.planId === planId) {
		        const graceEndsAt = Number(msg.graceEndsAt || msg.deadlineAt || 0) || Date.now();
		        const decisionEndsAt = Number(msg.decisionEndsAt || 0) || graceEndsAt + 5 * 60_000;
		        setForceUnlockIncoming({
		          requestId: String(msg.requestId || ''),
		          planId: String(msg.planId || planId),
		          clientName: String(msg.clientName || ''),
		          siteName: String(msg.siteName || ''),
		          planName: String(msg.planName || planRef.current?.name || ''),
		          requestedBy: msg.requestedBy
		            ? { userId: String(msg.requestedBy.userId || ''), username: String(msg.requestedBy.username || '') }
		            : null,
		          graceEndsAt,
		          decisionEndsAt,
		          graceMinutes: Number(msg.graceMinutes || 0) || 0,
		          hasUnsavedChanges: typeof msg.hasUnsavedChanges === 'boolean' ? msg.hasUnsavedChanges : null
		        });
		      }
		      if (msg?.type === 'force_unlock_execute' && msg.planId === planId) {
		        const requestId = String(msg.requestId || '').trim();
		        const action = String(msg.action || '').trim();
		        if (!requestId || (action !== 'save' && action !== 'discard')) return;
		        setForceUnlockExecuteCommand({ requestId, action });
		      }
	    };
    ws.onclose = () => {
      if (closed) return;
      closed = true;
      if (!opened) {
        realtimeDisabledRef.current = true;
        setRealtimeDisabled(true);
      }
	      setPresenceUsers([]);
	      setGlobalPresenceUsers([]);
	      setLockedPlans({});
	      setLockState({ lockedBy: null, mine: false, grant: null, meta: null });
	      wsRef.current = null;
	    };
    ws.onerror = () => {
      if (!opened) {
        realtimeDisabledRef.current = true;
        setRealtimeDisabled(true);
      }
      wsRef.current = null;
    };

    return () => {
      closed = true;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          if (lockMineRef.current) send({ type: 'release_lock', planId });
          send({ type: 'leave', planId });
        }
        closeSocketSafely(ws);
      } catch {
        // ignore
      } finally {
        wsRef.current = null;
      }
    };
	  }, [activeRevision, planAccess, planId, realtimeDisabled, user?.id]);

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
	      const prev = (useUIStore.getState() as any)?.lockedPlans || {};
	      const next = { ...prev };
	      if (lockedBy) {
	        next[targetPlanId] = {
	          kind: 'lock',
	          ...lockedBy,
	          lastActionAt: meta?.lastActionAt ?? null,
	          lastSavedAt: meta?.lastSavedAt ?? null,
	          lastSavedRev: meta?.lastSavedRev ?? null
	        };
	      } else if (grant?.userId) {
	        next[targetPlanId] = {
	          kind: 'grant',
	          userId: grant.userId,
	          username: grant.username,
	          avatarUrl: grant.avatarUrl || '',
	          grantedAt: grant.grantedAt ?? null,
	          expiresAt: grant.expiresAt ?? null,
	          minutes: grant.minutes ?? null,
	          grantedBy: grant.grantedBy ?? null,
	          lastActionAt: meta?.lastActionAt ?? null,
	          lastSavedAt: meta?.lastSavedAt ?? null,
	          lastSavedRev: meta?.lastSavedRev ?? null
	        };
	      } else {
	        delete next[targetPlanId];
	      }
	      setLockedPlans(next);
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
  const planScale = renderPlan?.scale;
  const metersPerPixel = useMemo(() => {
    const value = Number(planScale?.metersPerPixel);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [planScale?.metersPerPixel]);
  const computePolylineLength = useCallback((points: { x: number; y: number }[]) => {
    if (!points.length) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return total;
  }, []);

  const computePolygonArea = useCallback((points: { x: number; y: number }[]) => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) * 0.5;
  }, []);
  const computeRoomSurfaceSqm = useCallback(
    (room: { kind?: string; points?: { x: number; y: number }[]; x?: number; y?: number; width?: number; height?: number }, metersPerPixelValue?: number | null) => {
      if (!metersPerPixelValue) return undefined;
      const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
      let areaPx = 0;
      if (kind === 'poly') {
        areaPx = computePolygonArea(room.points || []);
      } else {
        areaPx = Number(room?.width || 0) * Number(room?.height || 0);
      }
      const sqm = areaPx * metersPerPixelValue * metersPerPixelValue;
      return Number.isFinite(sqm) && sqm > 0 ? Math.round(sqm * 100) / 100 : undefined;
    },
    [computePolygonArea]
  );
  const formatCornerLabel = useCallback((index: number) => {
    if (index < 0) return '';
    let n = index;
    let label = '';
    while (n >= 0) {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  }, []);
  const buildRoomPreview = useCallback(
    (points: { x: number; y: number }[]) => {
      if (!points.length) return null;
      const cleaned =
        points.length >= 3 && points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y
          ? points.slice(0, -1)
          : points;
      if (cleaned.length < 2) return null;
      const unit = metersPerPixel ? (lang === 'it' ? 'ml' : 'm') : 'px';
      const segments = cleaned.map((start, index) => {
        const end = cleaned[(index + 1) % cleaned.length];
        const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
        const lengthLabel = metersPerPixel
          ? `${formatNumber(lengthPx * metersPerPixel)} ${unit}`
          : `${formatNumber(lengthPx)} ${unit}`;
        const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % cleaned.length)}`;
        return { label, lengthLabel };
      });
      return { points: cleaned, segments };
    },
    [formatCornerLabel, formatNumber, lang, metersPerPixel]
  );
  const projectPointOnSegment = useCallback(
    (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lenSq = dx * dx + dy * dy;
      if (!lenSq) return { x: start.x, y: start.y, t: 0 };
      let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      return { x: start.x + t * dx, y: start.y + t * dy, t };
    },
    []
  );
  const buildRoomWallSegments = useCallback(
    (room: { kind: 'rect' | 'poly'; rect?: { x: number; y: number; width: number; height: number }; points?: { x: number; y: number }[] }) => {
      let points: { x: number; y: number }[] = [];
      if (room.kind === 'rect' && room.rect) {
        const { x, y, width, height } = room.rect;
        if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) return [];
        points = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height }
        ];
      } else {
        points = (room.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      }
      if (points.length < 2) return [];
      const last = points[points.length - 1];
      const first = points[0];
      const trimmed =
        points.length >= 3 && first.x === last.x && first.y === last.y ? points.slice(0, -1) : points;
      if (trimmed.length < 2) return [];
      const segments: { start: { x: number; y: number }; end: { x: number; y: number }; label: string }[] = [];
      for (let i = 0; i < trimmed.length; i += 1) {
        const start = trimmed[i];
        const end = trimmed[(i + 1) % trimmed.length];
        if (!end) continue;
        const label = `${formatCornerLabel(i)}-${formatCornerLabel((i + 1) % trimmed.length)}`;
        segments.push({ start, end, label });
      }
      return segments;
    },
    [formatCornerLabel]
  );
  const getWallPolygonData = useCallback(
    (wallId: string) => {
      if (!renderPlan) return null;
      const wall = renderPlan.objects.find((o) => o.id === wallId);
      if (!wall || !isWallType(wall.type)) return null;

      const groupId = String((wall as any).wallGroupId || '');
      if (groupId) {
        const groupWalls = renderPlan.objects.filter(
          (o) => isWallType(o.type) && String((o as any).wallGroupId || '') === groupId
        );
        if (groupWalls.length >= 3) {
          const room = (renderPlan.rooms || []).find((r) => r.id === groupId);
          const ordered = groupWalls
            .slice()
            .sort((a, b) => Number((a as any).wallGroupIndex ?? 0) - Number((b as any).wallGroupIndex ?? 0));
          const segmentsFromWalls = ordered
            .map((w, index) => {
              const pts = (w as any).points as { x: number; y: number }[] | undefined;
              if (!Array.isArray(pts) || pts.length < 2) return null;
              const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % ordered.length)}`;
              return { start: pts[0], end: pts[1], label };
            })
            .filter(Boolean) as { start: { x: number; y: number }; end: { x: number; y: number }; label: string }[];
          let segments: { start: { x: number; y: number }; end: { x: number; y: number }; label: string }[] = segmentsFromWalls;
          if (room) {
            const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            const roomSegments = buildRoomWallSegments({
              kind,
              rect: kind === 'rect' ? { x: room.x || 0, y: room.y || 0, width: room.width || 0, height: room.height || 0 } : undefined,
              points: kind === 'poly' ? room.points || [] : undefined
            });
            if (roomSegments.length === ordered.length) segments = roomSegments;
          }
          const wallIds = ordered.map((w) => w.id);
          const wallTypes = ordered.map((w) => w.type);
          return {
            roomId: groupId,
            roomName: room?.name || t({ it: 'Poligono muri', en: 'Wall polygon' }),
            segments,
            wallIds,
            wallTypes
          };
        }
      }

      const walls = renderPlan.objects.filter((o) => isWallType(o.type));
      const byId = new Map(walls.map((w) => [w.id, w]));
      const keyOf = (p: { x: number; y: number }) =>
        `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`;
      const adjacency = new Map<string, Array<{ wallId: string; otherKey: string; otherPoint: { x: number; y: number } }>>();
      const addAdj = (from: { x: number; y: number }, to: { x: number; y: number }, id: string) => {
        const fromKey = keyOf(from);
        const list = adjacency.get(fromKey) || [];
        list.push({ wallId: id, otherKey: keyOf(to), otherPoint: to });
        adjacency.set(fromKey, list);
      };
      walls.forEach((w) => {
        const pts = (w as any).points as { x: number; y: number }[] | undefined;
        if (!Array.isArray(pts) || pts.length < 2) return;
        addAdj(pts[0], pts[1], w.id);
        addAdj(pts[1], pts[0], w.id);
      });

      const startWall = byId.get(wallId);
      const startPts = (startWall as any)?.points as { x: number; y: number }[] | undefined;
      if (!startWall || !startPts || startPts.length < 2) return null;

      const tryBuild = (startPoint: { x: number; y: number }, nextPoint: { x: number; y: number }) => {
        const startKey = keyOf(startPoint);
        let currentKey = keyOf(nextPoint);
        const wallIds = [startWall.id];
        const points = [startPoint, nextPoint];
        const visited = new Set<string>(wallIds);
        let guard = 0;
        while (guard < walls.length + 2) {
          guard += 1;
          if (currentKey === startKey) {
            return wallIds.length >= 3 ? { wallIds, points } : null;
          }
          const options = (adjacency.get(currentKey) || []).filter((o) => !visited.has(o.wallId));
          if (options.length !== 1) return null;
          const next = options[0];
          visited.add(next.wallId);
          wallIds.push(next.wallId);
          points.push(next.otherPoint);
          currentKey = next.otherKey;
        }
        return null;
      };

      const attempt =
        tryBuild(startPts[0], startPts[1]) || tryBuild(startPts[1], startPts[0]);
      if (!attempt) return null;
      const pts = attempt.points.slice();
      if (pts.length < 3) return null;
      if (pts.length > 2 && keyOf(pts[0]) === keyOf(pts[pts.length - 1])) {
        pts.pop();
      }
      if (pts.length < 3) return null;
      const segments = pts.map((start, index) => {
        const end = pts[(index + 1) % pts.length];
        const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % pts.length)}`;
        return { start, end, label };
      });
      const wallIds = attempt.wallIds;
      const wallTypes = wallIds.map((id) => byId.get(id)?.type || defaultWallTypeId || DEFAULT_WALL_TYPES[0]);
      return {
        roomId: wallId,
        roomName: t({ it: 'Poligono muri', en: 'Wall polygon' }),
        segments,
        wallIds,
        wallTypes
      };
    },
    [buildRoomWallSegments, defaultWallTypeId, formatCornerLabel, isWallType, renderPlan, t]
  );
  useEffect(() => {
    setWallDrawMode(false);
    setWallDrawType(null);
    setWallDraftPoints([]);
    wallDraftPointsRef.current = [];
    wallDraftSegmentIdsRef.current = [];
    setWallDraftPointer(null);
    setScaleMode(false);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleModal(null);
    setScaleMetersInput('');
    setShowScaleLine(!!planScale);
    setMeasureMode(false);
    setMeasurePoints([]);
    setMeasurePointer(null);
    setMeasureClosed(false);
    setMeasureFinished(false);
    setQuoteMode(false);
    setQuotePoints([]);
    setQuotePointer(null);
    setScalePromptDismissed(false);
  }, [planId, planScale]);
  const scaleLabel = useMemo(() => {
    if (!planScale?.meters) return null;
    const unit = lang === 'it' ? 'ml' : 'm';
    return `${formatNumber(Number(planScale.meters))} ${unit}`;
  }, [formatNumber, lang, planScale?.meters]);
  const recommendedObjectScale = useMemo(() => {
    const w = Number(renderPlan?.width || 0);
    const h = Number(renderPlan?.height || 0);
    const maxDim = Math.max(w, h);
    if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
    const minDim = 3000;
    const maxDimRef = 12000;
    if (maxDim <= minDim) return 1;
    if (maxDim >= maxDimRef) return 2.4;
    const t = (maxDim - minDim) / (maxDimRef - minDim);
    return Number((1 + t * (2.4 - 1)).toFixed(2));
  }, [renderPlan?.height, renderPlan?.width]);
  const defaultObjectScale = useMemo(() => {
    if (lastObjectScale !== 1) return lastObjectScale;
    return Number.isFinite(recommendedObjectScale) ? recommendedObjectScale : 1;
  }, [lastObjectScale, recommendedObjectScale]);
  const scaleLine = useMemo(() => {
    if (!showScaleLine || !planScale?.start || !planScale?.end) return null;
    const labelScale = Number(planScale?.labelScale);
    const opacity = Number(planScale?.opacity);
    const strokeWidth = Number(planScale?.strokeWidth);
    return {
      start: planScale.start,
      end: planScale.end,
      label: scaleLabel || undefined,
      labelScale: Number.isFinite(labelScale) ? labelScale : 1,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : 1.2
    };
  }, [
    planScale?.end,
    planScale?.labelScale,
    planScale?.opacity,
    planScale?.start,
    planScale?.strokeWidth,
    scaleLabel,
    showScaleLine
  ]);
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

  const rackOverlayLinks = useMemo(() => {
    if (!renderPlan) return [] as any[];
    const rackItems = ((renderPlan as any).rackItems || []) as RackItem[];
    const rackLinks = ((renderPlan as any).rackLinks || []) as RackLink[];
    if (!rackItems.length || !rackLinks.length) return [] as any[];
    const itemsById = new Map(rackItems.map((item) => [item.id, item]));
    const rackObjectsById = new Map(
      (renderPlan.objects || []).filter((obj) => obj.type === 'rack').map((obj) => [obj.id, obj])
    );
    const grouped = new Map<
      string,
      { rackA: string; rackB: string; ethernet: { link: RackLink; fromItem: RackItem; toItem: RackItem }[]; fiber: { link: RackLink; fromItem: RackItem; toItem: RackItem }[] }
    >();
    for (const link of rackLinks) {
      const fromItem = itemsById.get(link.fromItemId);
      const toItem = itemsById.get(link.toItemId);
      if (!fromItem || !toItem) continue;
      if (fromItem.rackId === toItem.rackId) continue;
      const fromObj = rackObjectsById.get(fromItem.rackId);
      const toObj = rackObjectsById.get(toItem.rackId);
      if (!fromObj || !toObj) continue;
      const pair = [fromItem.rackId, toItem.rackId].sort();
      const key = pair.join('|');
      const kind = link.kind === 'fiber' ? 'fiber' : 'ethernet';
      const entry = grouped.get(key) || { rackA: pair[0], rackB: pair[1], ethernet: [], fiber: [] };
      entry[kind].push({ link, fromItem, toItem });
      grouped.set(key, entry);
    }
    const out: any[] = [];
    const spacing = 8;
    const baseWidth = 2 * 0.6;
    grouped.forEach((entry, key) => {
      const hasEthernet = entry.ethernet.length > 0;
      const hasFiber = entry.fiber.length > 0;
      const offsetDelta = hasEthernet && hasFiber ? spacing / 2 : 0;
      if (hasEthernet) {
        const rep = entry.ethernet
          .slice()
          .sort((a, b) => Number(a.link.createdAt || 0) - Number(b.link.createdAt || 0))[0];
        if (rep) {
          out.push({
            id: `racklink:${key}:ethernet`,
            fromId: entry.rackA,
            toId: entry.rackB,
            kind: 'cable',
            dashed: true,
            route: 'vh',
            width: baseWidth,
            selectedWidthDelta: 0.6,
            color: '#3b82f6',
            offset: hasFiber ? -offsetDelta : 0,
            rackLinkId: rep.link.id,
            rackFromItemId: rep.link.fromItemId,
            rackToItemId: rep.link.toItemId,
            rackKind: 'ethernet',
            rackFromRackId: rep.fromItem.rackId,
            rackToRackId: rep.toItem.rackId
          });
        }
      }
      if (hasFiber) {
        const rep = entry.fiber
          .slice()
          .sort((a, b) => Number(a.link.createdAt || 0) - Number(b.link.createdAt || 0))[0];
        if (rep) {
          out.push({
            id: `racklink:${key}:fiber`,
            fromId: entry.rackA,
            toId: entry.rackB,
            kind: 'cable',
            dashed: true,
            route: 'vh',
            width: baseWidth,
            selectedWidthDelta: 0.6,
            color: '#a855f7',
            offset: hasEthernet ? offsetDelta : 0,
            rackLinkId: rep.link.id,
            rackFromItemId: rep.link.fromItemId,
            rackToItemId: rep.link.toItemId,
            rackKind: 'fiber',
            rackFromRackId: rep.fromItem.rackId,
            rackToRackId: rep.toItem.rackId
          });
        }
      }
    });
    return out;
  }, [renderPlan]);

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
  const getTypeLayerIds = useCallback(
    (typeId: string) => {
      const matched = planLayers
        .filter((l: any) => !SYSTEM_LAYER_IDS.has(String(l.id)) && Array.isArray(l.typeIds) && l.typeIds.includes(typeId))
        .map((l: any) => String(l.id));
      return matched.length ? matched : null;
    },
    [planLayers]
  );
  const getLayerIdsForType = useCallback(
    (typeId: string) => {
      const mapped = getTypeLayerIds(typeId);
      const fallback = inferDefaultLayerIds(typeId, layerIdSet);
      const raw = (mapped?.length ? mapped : fallback).map((id) => String(id)).filter((id) => id !== ALL_ITEMS_LAYER_ID);
      if (typeId === 'real_user') {
        const preferred = raw.filter((id) => id !== 'users');
        if (preferred.length) return Array.from(new Set(preferred));
      }
      return Array.from(new Set(raw));
    },
    [getTypeLayerIds, inferDefaultLayerIds, layerIdSet]
  );
  const getObjectLayerIdsForVisibility = useCallback(
    (obj: MapObject) => {
      const explicit = (Array.isArray(obj.layerIds) ? obj.layerIds : [])
        .map((id) => String(id))
        .filter((id) => id !== ALL_ITEMS_LAYER_ID);
      const typeLayers = getLayerIdsForType(obj.type);
      if (obj.type === 'real_user') {
        const explicitPreferred = explicit.filter((id) => id !== 'users');
        if (explicitPreferred.length) return Array.from(new Set(explicitPreferred));
        if (typeLayers.length) return typeLayers;
        return explicit;
      }
      return explicit.length ? Array.from(new Set(explicit)) : typeLayers;
    },
    [getLayerIdsForType]
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
    (layerId: string) => {
      const layer = planLayers.find((l: any) => String(l.id) === layerId);
      if (!layer) return layerId;
      const name = layer?.name;
      if (typeof name === 'string') return name;
      return String(name?.[lang] || name?.it || name?.en || layerId);
    },
    [lang, planLayers]
  );
  const getObjectToastLabel = useCallback(
    (name: string | undefined, typeId: string) => {
      const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
      const fallback = getTypeLabel(typeId);
      const value = trimmed || fallback || typeId;
      if (value.length > 60) return `${value.slice(0, 57)}...`;
      return value;
    },
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
  const getObjectBoundsForAlign = useCallback((obj: MapObject) => {
    const boundsFromStage = canvasStageRef.current?.getObjectBounds?.(obj.id);
    if (boundsFromStage) return boundsFromStage;
    if (Array.isArray((obj as any).points) && (obj as any).points.length) {
      const pts = (obj as any).points as { x: number; y: number }[];
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
      if ([minX, minY, maxX, maxY].every(Number.isFinite)) return { minX, minY, maxX, maxY };
    }
    const x = Number(obj.x);
    const y = Number(obj.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { minX: x, minY: y, maxX: x, maxY: y };
    return null;
  }, []);
  const ensureObjectLayerVisible = useCallback(
    (layerIds: string[] | undefined, name: string | undefined, typeId: string) => {
      if (!planId || !layerIds?.length) return;
      const valid = layerIds.filter((id) => layerIdSet.has(id) && id !== ALL_ITEMS_LAYER_ID);
      if (!valid.length) return;
      const visibleSet = new Set(layerActivationRef.current);
      const missing = valid.filter((id) => !visibleSet.has(id));
      if (!missing.length && !hideAllLayers) return;
      if (hideAllLayers) setHideAllLayers(planId, false);
      if (!missing.length) return;
      missing.forEach((id) => visibleSet.add(id));
      layerActivationRef.current = visibleSet;
      const next = normalizeLayerSelection([...visibleLayerIds, ...missing]);
      setVisibleLayerIds(planId, next);
      const layerLabel = getLayerLabel(missing[0]);
      const objectLabel = getObjectToastLabel(name, typeId);
      push(
        t({
          it: `Attivato Layer ${layerLabel} per visualizzazione oggetto ${objectLabel}.`,
          en: `Enabled layer ${layerLabel} to show object ${objectLabel}.`
        }),
        'info'
      );
    },
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
  useEffect(() => {
    if (!layerIds.length) return;
    const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
    const prev = prevLayerIdsByPlanRef.current[planId];
    if (typeof current === 'undefined') {
      const nextDefault = normalizeLayerSelection(defaultVisibleLayerIds);
      setVisibleLayerIds(planId, nextDefault);
      prevLayerIdsByPlanRef.current[planId] = layerIds;
      return;
    }
    const filteredCurrent = normalizeLayerSelection(current);
    let next = filteredCurrent;
    if (prev) {
      const newIds = layerIds.filter((id) => !prev.includes(id));
      if (newIds.length && filteredCurrent.includes(ALL_ITEMS_LAYER_ID)) {
        next = normalizeLayerSelection([...filteredCurrent, ...newIds]);
      }
    }
    if (next.length !== current.length || next.some((id, idx) => id !== current[idx])) {
      setVisibleLayerIds(planId, next);
    }
    prevLayerIdsByPlanRef.current[planId] = layerIds;
  }, [defaultVisibleLayerIds, layerIds, normalizeLayerSelection, planId, setVisibleLayerIds, visibleLayerIdsByPlan]);

  const canvasPlan = useMemo(() => {
    if (!renderPlan) return renderPlan;
    if (hideAllLayers) {
      return { ...renderPlan, objects: [], rooms: [], corridors: [], links: [] };
    }
    const showAll = allItemsSelected;
    const visible = new Set(effectiveVisibleLayerIds);
    const objects = showAll
      ? renderPlan.objects
      : renderPlan.objects.filter((o: any) => {
          const ids = getObjectLayerIdsForVisibility(o);
          return ids.some((id: string) => visible.has(id));
        });
    const rooms = showAll || visible.has('rooms') ? renderPlan.rooms : [];
    const corridors = showAll || visible.has('corridors') ? (renderPlan as any).corridors : [];
    const visibleObjectIds = new Set(objects.map((o: any) => o.id));
    const baseLinks = Array.isArray((renderPlan as any).links)
      ? ((renderPlan as any).links as any[]).filter((l) => {
          if (!showAll && !visible.has('cabling')) return false;
          return visibleObjectIds.has(String((l as any).fromId || '')) && visibleObjectIds.has(String((l as any).toId || ''));
        })
      : [];
    const showRackLinks = showAll || visible.has('cabling') || visible.has('racks');
    const rackLinks = showRackLinks
      ? rackOverlayLinks.filter((l) => visibleObjectIds.has(String(l.fromId)) && visibleObjectIds.has(String(l.toId)))
      : [];
    const links = [...baseLinks, ...rackLinks];
    return { ...renderPlan, objects, rooms, corridors, links };
  }, [allItemsSelected, effectiveVisibleLayerIds, getObjectLayerIdsForVisibility, hideAllLayers, rackOverlayLinks, renderPlan]);
  const securityLayerVisible = useMemo(
    () => !hideAllLayers && (allItemsSelected || effectiveVisibleLayerIds.includes(SECURITY_LAYER_ID)),
    [allItemsSelected, effectiveVisibleLayerIds, hideAllLayers]
  );
  useEffect(() => {
    if (!renderPlan) return;
    const layout = normalizeSafetyCardLayout((renderPlan as any)?.safetyCardLayout);
    setSafetyCardPos((prev) => (Math.abs(prev.x - layout.x) > 0.01 || Math.abs(prev.y - layout.y) > 0.01 ? { x: layout.x, y: layout.y } : prev));
    setSafetyCardSize((prev) => (Math.abs(prev.w - layout.w) > 0.01 || Math.abs(prev.h - layout.h) > 0.01 ? { w: layout.w, h: layout.h } : prev));
    setSafetyCardFontSize((prev) => (Math.abs(prev - layout.fontSize) > 0.01 ? layout.fontSize : prev));
    setSafetyCardFontIndex((prev) => (prev !== layout.fontIndex ? layout.fontIndex : prev));
    setSafetyCardColorIndex((prev) => (prev !== layout.colorIndex ? layout.colorIndex : prev));
    setSafetyCardTextBgIndex((prev) => (prev !== layout.textBgIndex ? layout.textBgIndex : prev));
  }, [normalizeSafetyCardLayout, renderPlan]);
  const safetyEmergencyContacts = useMemo(() => {
    const list = Array.isArray((client as any)?.emergencyContacts) ? ((client as any).emergencyContacts as any[]) : [];
    const scopeRank = (scope: string) => {
      if (scope === 'global') return 0;
      if (scope === 'client') return 1;
      if (scope === 'site') return 2;
      if (scope === 'plan') return 3;
      return 9;
    };
    const out = list.filter((entry) => {
      const scope = String(entry?.scope || '');
      const showOnPlanCard = entry?.showOnPlanCard !== false;
      if (!showOnPlanCard) return false;
      if (scope === 'global' || scope === 'client') return true;
      if (scope === 'site') return String(entry?.siteId || '') === String(site?.id || '');
      if (scope === 'plan') return String(entry?.floorPlanId || '') === String(planId || '');
      return false;
    });
    return out.sort((a, b) => {
      const aScope = String(a?.scope || '');
      const bScope = String(b?.scope || '');
      const byScope = scopeRank(aScope) - scopeRank(bScope);
      if (byScope !== 0) return byScope;
      return `${a?.name || ''}`.localeCompare(`${b?.name || ''}`);
    });
  }, [client, planId, site?.id]);
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
    (itemId: string, kind: RackPortKind, index: number, name: string) => {
      if (isReadOnly || !renderPlan) return;
      const item = ((renderPlan as any).rackItems || []).find((entry: RackItem) => entry.id === itemId);
      if (!item) return;
      const key = kind === 'ethernet' ? 'ethPortNames' : 'fiberPortNames';
      const current = ((item as any)[key] as string[] | undefined) || [];
      const next = [...current];
      const normalized = name.trim();
      while (next.length < index) next.push('');
      next[index - 1] = normalized;
      updateRackItem(planId, itemId, { [key]: next } as Partial<RackItem>);
    },
    [isReadOnly, planId, renderPlan, updateRackItem]
  );

  const handleRackPortsNote = useCallback(
    (itemId: string, kind: RackPortKind, index: number, note: string) => {
      if (isReadOnly || !renderPlan) return;
      const item = ((renderPlan as any).rackItems || []).find((entry: RackItem) => entry.id === itemId);
      if (!item) return;
      const key = kind === 'ethernet' ? 'ethPortNotes' : 'fiberPortNotes';
      const current = ((item as any)[key] as string[] | undefined) || [];
      const next = [...current];
      const normalized = note.trim();
      while (next.length < index) next.push('');
      next[index - 1] = normalized;
      updateRackItem(planId, itemId, { [key]: next } as Partial<RackItem>);
    },
    [isReadOnly, planId, renderPlan, updateRackItem]
  );

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
    (mode: 'horizontal' | 'vertical', referenceId?: string) => {
      if (isReadOnly || !renderPlan) return;
      if (selectedObjectIds.length < 2) return;
      const objects = selectedObjectIds
        .map((id) => renderPlan.objects.find((o) => o.id === id))
        .filter(Boolean) as MapObject[];
      if (objects.length < 2) return;
      const fallbackRef = objects[0];
      const refObject = referenceId ? objects.find((obj) => obj.id === referenceId) || fallbackRef : fallbackRef;
      if (!refObject) return;
      const boundsById = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
      for (const obj of objects) {
        const bounds = getObjectBoundsForAlign(obj);
        if (bounds) boundsById.set(obj.id, bounds);
      }
      const refBounds = boundsById.get(refObject.id);
      if (!refBounds) return;
      const targetX = (refBounds.minX + refBounds.maxX) / 2;
      const targetY = (refBounds.minY + refBounds.maxY) / 2;
      markTouched();
      for (const obj of objects) {
        const bounds = boundsById.get(obj.id);
        if (!bounds) continue;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const dx = mode === 'vertical' ? targetX - centerX : 0;
        const dy = mode === 'horizontal' ? targetY - centerY : 0;
        if (!dx && !dy) continue;
        if (isWallType(obj.type) || obj.type === 'quote') {
          const pts = Array.isArray((obj as any).points) ? (obj as any).points : [];
          if (!pts.length) continue;
          const nextPoints = pts.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
          const nextX = Number.isFinite(Number(obj.x)) ? Number(obj.x) + dx : obj.x;
          const nextY = Number.isFinite(Number(obj.y)) ? Number(obj.y) + dy : obj.y;
          updateObject(obj.id, { points: nextPoints, x: nextX, y: nextY });
          continue;
        }
        const nextX = Number(obj.x) + dx;
        const nextY = Number(obj.y) + dy;
        if (Number.isFinite(nextX) && Number.isFinite(nextY)) moveObject(obj.id, nextX, nextY);
      }
    },
    [getObjectBoundsForAlign, isReadOnly, isWallType, markTouched, moveObject, renderPlan, selectedObjectIds, updateObject]
  );

  const toSnapshot = useCallback((p: any) => {
    return {
      imageUrl: p?.imageUrl || '',
      width: p?.width,
      height: p?.height,
      scale: p?.scale,
      safetyCardLayout: (p as any)?.safetyCardLayout
        ? {
            x: Number((p as any).safetyCardLayout.x || 0),
            y: Number((p as any).safetyCardLayout.y || 0),
            w: Number((p as any).safetyCardLayout.w || 420),
            h: Number((p as any).safetyCardLayout.h || 84),
            fontSize: Number((p as any).safetyCardLayout.fontSize || 10),
            fontIndex: Number((p as any).safetyCardLayout.fontIndex || 0),
            colorIndex: Number((p as any).safetyCardLayout.colorIndex || 0),
            textBgIndex: Number((p as any).safetyCardLayout.textBgIndex || 0)
          }
        : undefined,
      objects: Array.isArray(p?.objects) ? p.objects : [],
      views: Array.isArray(p?.views) ? p.views : [],
      rooms: Array.isArray(p?.rooms) ? p.rooms : [],
      corridors: Array.isArray((p as any)?.corridors) ? (p as any).corridors : [],
      roomDoors: Array.isArray((p as any)?.roomDoors) ? (p as any).roomDoors : [],
      racks: Array.isArray((p as any)?.racks) ? (p as any).racks : [],
      rackItems: Array.isArray((p as any)?.rackItems) ? (p as any).rackItems : [],
      rackLinks: Array.isArray((p as any)?.rackLinks) ? (p as any).rackLinks : []
    };
  }, []);

  type HistorySnapshot = ReturnType<typeof toSnapshot> & {
    printArea?: { x: number; y: number; width: number; height: number } | null;
    links?: any[];
  };

  const [historyTick, setHistoryTick] = useState(0);
  const historySnapshotRef = useRef<HistorySnapshot | null>(null);
  const historyKeyRef = useRef('');
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const historyLockRef = useRef(false);

  const toHistorySnapshot = useCallback(
    (p: any): HistorySnapshot => ({
      ...toSnapshot(p),
      printArea: (p as any)?.printArea ?? null,
      links: Array.isArray((p as any)?.links) ? (p as any).links : []
    }),
    [toSnapshot]
  );

  const resetHistory = useCallback(() => {
    historySnapshotRef.current = null;
    historyKeyRef.current = '';
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryTick((x) => x + 1);
  }, []);

  useEffect(() => {
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
    const snap = toSnapshot(plan);
    // Keep baseline aligned with background normalizations until the user edits.
    if (!baselineSnapshotRef.current || !touchedRef.current) baselineSnapshotRef.current = snap;
  }, [plan, toSnapshot]);


  const samePlanSnapshot = useCallback((
    current: {
      imageUrl: string;
      width?: number;
      height?: number;
      scale?: any;
      safetyCardLayout?: { x: number; y: number; w: number; h: number; fontSize?: number; fontIndex?: number; colorIndex?: number; textBgIndex?: number };
      objects: any[];
      views?: any[];
      rooms?: any[];
      corridors?: any[];
      roomDoors?: any[];
      racks?: any[];
      rackItems?: any[];
      rackLinks?: any[];
    },
    latest: {
      imageUrl: string;
      width?: number;
      height?: number;
      scale?: any;
      safetyCardLayout?: { x: number; y: number; w: number; h: number; fontSize?: number; fontIndex?: number; colorIndex?: number; textBgIndex?: number };
      objects: any[];
      views?: any[];
      rooms?: any[];
      corridors?: any[];
      roomDoors?: any[];
      racks?: any[];
      rackItems?: any[];
      rackLinks?: any[];
    }
  ) => {
    if (current.imageUrl !== latest.imageUrl) return false;
    if ((current.width ?? null) !== (latest.width ?? null)) return false;
    if ((current.height ?? null) !== (latest.height ?? null)) return false;
    const aScale = current.scale;
    const bScale = latest.scale;
    if (!!aScale || !!bScale) {
      if (!aScale || !bScale) return false;
      if (Number(aScale.meters || 0) !== Number(bScale.meters || 0)) return false;
      if (Number(aScale.metersPerPixel || 0) !== Number(bScale.metersPerPixel || 0)) return false;
      if ((aScale.start?.x ?? 0) !== (bScale.start?.x ?? 0)) return false;
      if ((aScale.start?.y ?? 0) !== (bScale.start?.y ?? 0)) return false;
      if ((aScale.end?.x ?? 0) !== (bScale.end?.x ?? 0)) return false;
      if ((aScale.end?.y ?? 0) !== (bScale.end?.y ?? 0)) return false;
    }
    const aSafetyCard = current.safetyCardLayout;
    const bSafetyCard = latest.safetyCardLayout;
    if (!!aSafetyCard || !!bSafetyCard) {
      if (!aSafetyCard || !bSafetyCard) return false;
      if (Number(aSafetyCard.x || 0) !== Number(bSafetyCard.x || 0)) return false;
      if (Number(aSafetyCard.y || 0) !== Number(bSafetyCard.y || 0)) return false;
      if (Number(aSafetyCard.w || 0) !== Number(bSafetyCard.w || 0)) return false;
      if (Number(aSafetyCard.h || 0) !== Number(bSafetyCard.h || 0)) return false;
      if (Number(aSafetyCard.fontSize || 10) !== Number(bSafetyCard.fontSize || 10)) return false;
      if (Number(aSafetyCard.fontIndex || 0) !== Number(bSafetyCard.fontIndex || 0)) return false;
      if (Number(aSafetyCard.colorIndex || 0) !== Number(bSafetyCard.colorIndex || 0)) return false;
      if (Number(aSafetyCard.textBgIndex || 0) !== Number(bSafetyCard.textBgIndex || 0)) return false;
    }

    const sameList = (a?: string[], b?: string[]) => {
      const aList = a || [];
      const bList = b || [];
      if (aList.length !== bList.length) return false;
      for (let i = 0; i < aList.length; i += 1) {
        if ((aList[i] || '') !== (bList[i] || '')) return false;
      }
      return true;
    };

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

    const aCorridors = current.corridors || [];
    const bCorridors = latest.corridors || [];
    if (aCorridors.length !== bCorridors.length) return false;
    const bCorridorsById = new Map<string, any>();
    for (const c of bCorridors) bCorridorsById.set(c.id, c);
    for (const c of aCorridors) {
      const other = bCorridorsById.get(c.id);
      if (!other) return false;
      if (c.name !== other.name) return false;
      if ((c.showName !== false) !== (other.showName !== false)) return false;
      if (Number((c as any).labelX ?? -1) !== Number((other as any).labelX ?? -1)) return false;
      if (Number((c as any).labelY ?? -1) !== Number((other as any).labelY ?? -1)) return false;
      if (Number((c as any).labelScale ?? 1) !== Number((other as any).labelScale ?? 1)) return false;
      if ((c.kind || 'poly') !== (other.kind || 'poly')) return false;
      if ((c.color || '') !== (other.color || '')) return false;
      if ((c.x ?? null) !== (other.x ?? null)) return false;
      if ((c.y ?? null) !== (other.y ?? null)) return false;
      if ((c.width ?? null) !== (other.width ?? null)) return false;
      if ((c.height ?? null) !== (other.height ?? null)) return false;
      const cPts = Array.isArray(c.points) ? c.points : [];
      const oPts = Array.isArray(other.points) ? other.points : [];
      if (cPts.length !== oPts.length) return false;
      for (let i = 0; i < cPts.length; i += 1) {
        if ((cPts[i]?.x ?? 0) !== (oPts[i]?.x ?? 0)) return false;
        if ((cPts[i]?.y ?? 0) !== (oPts[i]?.y ?? 0)) return false;
      }
      const cDoors = Array.isArray(c.doors) ? c.doors : [];
      const oDoors = Array.isArray(other.doors) ? other.doors : [];
      if (cDoors.length !== oDoors.length) return false;
      const oDoorsById = new Map<string, any>();
      for (const d of oDoors) oDoorsById.set(d.id, d);
      for (const d of cDoors) {
        const od = oDoorsById.get(d.id);
        if (!od) return false;
        if (Number(d.edgeIndex) !== Number(od.edgeIndex)) return false;
        if (Number(d.t) !== Number(od.t)) return false;
        if (Number((d as any).edgeIndexTo ?? -1) !== Number((od as any).edgeIndexTo ?? -1)) return false;
        if (Number((d as any).tTo ?? -1) !== Number((od as any).tTo ?? -1)) return false;
        if (String((d as any).mode || 'static') !== String((od as any).mode || 'static')) return false;
        if (String((d as any).automationUrl || '') !== String((od as any).automationUrl || '')) return false;
        const aLinked = Array.isArray((d as any).linkedRoomIds) ? (d as any).linkedRoomIds.map((id: any) => String(id)).sort() : [];
        const bLinked = Array.isArray((od as any).linkedRoomIds) ? (od as any).linkedRoomIds.map((id: any) => String(id)).sort() : [];
        if (aLinked.length !== bLinked.length) return false;
        for (let i = 0; i < aLinked.length; i += 1) {
          if (aLinked[i] !== bLinked[i]) return false;
        }
      }
      const cConn = Array.isArray(c.connections) ? c.connections : [];
      const oConn = Array.isArray(other.connections) ? other.connections : [];
      if (cConn.length !== oConn.length) return false;
      const oConnById = new Map<string, any>();
      for (const cp of oConn) oConnById.set(cp.id, cp);
      for (const cp of cConn) {
        const ocp = oConnById.get(cp.id);
        if (!ocp) return false;
        if (Number(cp.edgeIndex) !== Number(ocp.edgeIndex)) return false;
        if (Number(cp.t) !== Number(ocp.t)) return false;
        if (Number((cp as any).x ?? -1) !== Number((ocp as any).x ?? -1)) return false;
        if (Number((cp as any).y ?? -1) !== Number((ocp as any).y ?? -1)) return false;
        if (String((cp as any).transitionType || 'stairs') !== String((ocp as any).transitionType || 'stairs')) return false;
        const aPlanIds = Array.isArray(cp.planIds) ? cp.planIds.map((id: any) => String(id)).sort() : [];
        const bPlanIds = Array.isArray(ocp.planIds) ? ocp.planIds.map((id: any) => String(id)).sort() : [];
        if (aPlanIds.length !== bPlanIds.length) return false;
        for (let i = 0; i < aPlanIds.length; i += 1) {
          if (aPlanIds[i] !== bPlanIds[i]) return false;
        }
      }
    }

    const aRoomDoors = Array.isArray((current as any).roomDoors) ? ((current as any).roomDoors as any[]) : [];
    const bRoomDoors = Array.isArray((latest as any).roomDoors) ? ((latest as any).roomDoors as any[]) : [];
    if (aRoomDoors.length !== bRoomDoors.length) return false;
    const bRoomDoorsById = new Map<string, any>();
    for (const door of bRoomDoors) bRoomDoorsById.set(String((door as any)?.id || ''), door);
    for (const door of aRoomDoors) {
      const id = String((door as any)?.id || '');
      const other = bRoomDoorsById.get(id);
      if (!other) return false;
      if (String((door as any)?.roomAId || '') !== String((other as any)?.roomAId || '')) return false;
      if (String((door as any)?.roomBId || '') !== String((other as any)?.roomBId || '')) return false;
      if (String((door as any)?.anchorRoomId || '') !== String((other as any)?.anchorRoomId || '')) return false;
      if (Number((door as any)?.edgeIndex) !== Number((other as any)?.edgeIndex)) return false;
      if (Number((door as any)?.t) !== Number((other as any)?.t)) return false;
      if (String((door as any)?.mode || 'static') !== String((other as any)?.mode || 'static')) return false;
      if (String((door as any)?.automationUrl || '') !== String((other as any)?.automationUrl || '')) return false;
    }

    const aRacks = current.racks || [];
    const bRacks = latest.racks || [];
    if (aRacks.length !== bRacks.length) return false;
    const bRacksById = new Map<string, any>();
    for (const r of bRacks) bRacksById.set(r.id, r);
    for (const r of aRacks) {
      const other = bRacksById.get(r.id);
      if (!other) return false;
      if (r.name !== other.name) return false;
      if (Number(r.totalUnits || 0) !== Number(other.totalUnits || 0)) return false;
    }

    const aItems = current.rackItems || [];
    const bItems = latest.rackItems || [];
    if (aItems.length !== bItems.length) return false;
    const bItemsById = new Map<string, any>();
    for (const i of bItems) bItemsById.set(i.id, i);
    for (const i of aItems) {
      const other = bItemsById.get(i.id);
      if (!other) return false;
      if (i.rackId !== other.rackId) return false;
      if (i.type !== other.type) return false;
      if (i.name !== other.name) return false;
      if ((i.brand || '') !== (other.brand || '')) return false;
      if ((i.model || '') !== (other.model || '')) return false;
      if ((i.ip || '') !== (other.ip || '')) return false;
      if (Number(i.unitStart) !== Number(other.unitStart)) return false;
      if (Number(i.unitSize) !== Number(other.unitSize)) return false;
      if (Number(i.ethPorts || 0) !== Number(other.ethPorts || 0)) return false;
      if (Number(i.fiberPorts || 0) !== Number(other.fiberPorts || 0)) return false;
      if (Number(i.ethRangeStart || 0) !== Number(other.ethRangeStart || 0)) return false;
      if (Number(i.fiberRangeStart || 0) !== Number(other.fiberRangeStart || 0)) return false;
      if (!sameList(i.ethPortNames, other.ethPortNames)) return false;
      if (!sameList(i.fiberPortNames, other.fiberPortNames)) return false;
      if (!sameList(i.ethPortNotes, other.ethPortNotes)) return false;
      if (!sameList(i.fiberPortNotes, other.fiberPortNotes)) return false;
    }

    const aLinks = current.rackLinks || [];
    const bLinks = latest.rackLinks || [];
    if (aLinks.length !== bLinks.length) return false;
    const bLinksById = new Map<string, any>();
    for (const l of bLinks) bLinksById.set(l.id, l);
    for (const l of aLinks) {
      const other = bLinksById.get(l.id);
      if (!other) return false;
      if (l.fromItemId !== other.fromItemId) return false;
      if (l.toItemId !== other.toItemId) return false;
      if (l.fromPortKind !== other.fromPortKind) return false;
      if (l.toPortKind !== other.toPortKind) return false;
      if (Number(l.fromPortIndex) !== Number(other.fromPortIndex)) return false;
      if (Number(l.toPortIndex) !== Number(other.toPortIndex)) return false;
      if (l.kind !== other.kind) return false;
      if (l.color !== other.color) return false;
      if ((l.name || '') !== (other.name || '')) return false;
    }

    return true;
  }, []);

  const samePlanSnapshotIgnoringDims = useCallback(
    (
      a: {
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
      },
      b: {
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
      }
    ) => samePlanSnapshot({ ...a, width: undefined, height: undefined }, { ...b, width: undefined, height: undefined }),
    [samePlanSnapshot]
  );

  const applyHistorySnapshot = useCallback(
    (snap: HistorySnapshot) => {
      if (!planId) return;
      historyLockRef.current = true;
      historySnapshotRef.current = snap;
      historyKeyRef.current = JSON.stringify(snap);
      setFloorPlanContent(planId, {
        ...snap,
        printArea: snap.printArea ?? undefined,
        scale: snap.scale,
        safetyCardLayout: (snap as any).safetyCardLayout,
        objects: snap.objects,
        views: snap.views,
        rooms: snap.rooms,
        corridors: snap.corridors,
        roomDoors: (snap as any).roomDoors,
        links: snap.links,
        racks: snap.racks,
        rackItems: snap.rackItems,
        rackLinks: snap.rackLinks
      });
      markTouched();
      setHistoryTick((x) => x + 1);
    },
    [markTouched, planId, setFloorPlanContent]
  );

  const performUndo = useCallback(() => {
    const current = historySnapshotRef.current;
    const prev = undoStackRef.current.pop();
    if (!prev || !current) return false;
    redoStackRef.current.push(current);
    applyHistorySnapshot(prev);
    return true;
  }, [applyHistorySnapshot]);

  const performRedo = useCallback(() => {
    const current = historySnapshotRef.current;
    const next = redoStackRef.current.pop();
    if (!next || !current) return false;
    undoStackRef.current.push(current);
    applyHistorySnapshot(next);
    return true;
  }, [applyHistorySnapshot]);

  useEffect(() => {
    if (!plan) return;
    const snap = toHistorySnapshot(plan);
    const nextKey = JSON.stringify(snap);
    const prevKey = historyKeyRef.current;
    const prev = historySnapshotRef.current;
    if (!prev || !prevKey) {
      historySnapshotRef.current = snap;
      historyKeyRef.current = nextKey;
      return;
    }
    if (historyLockRef.current) {
      historySnapshotRef.current = snap;
      historyKeyRef.current = nextKey;
      historyLockRef.current = false;
      return;
    }
    if (prevKey === nextKey) return;
    undoStackRef.current.push(prev);
    if (undoStackRef.current.length > 80) undoStackRef.current.shift();
    redoStackRef.current = [];
    historySnapshotRef.current = snap;
    historyKeyRef.current = nextKey;
    setHistoryTick((x) => x + 1);
  }, [plan, toHistorySnapshot]);

  // Track plan state when the user enters it. Used for the navigation prompt.
  useEffect(() => {
    if (!plan) return;
    const snap = toSnapshot(plan);
    if (!entrySnapshotRef.current || !touchedRef.current) entrySnapshotRef.current = snap;
  }, [plan, toSnapshot]);

  const getPlanUnsavedChanges = useCallback(
    (targetPlan?: FloorPlan | null) => {
      if (!targetPlan) return false;
      const revisions = targetPlan.revisions || [];
      const current = toSnapshot(targetPlan);
      if (!revisions.length) {
        const base = baselineSnapshotRef.current;
        if (!base) return false;
        return !samePlanSnapshot(current, base);
      }
      const latest: any = [...revisions].sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))[0];
      const latestSnapshot = {
        imageUrl: latest.imageUrl,
        width: latest.width,
        height: latest.height,
        scale: latest.scale,
        safetyCardLayout: latest.safetyCardLayout,
        objects: latest.objects,
        views: latest.views,
        rooms: latest.rooms,
        corridors: latest.corridors,
        roomDoors: (latest as any).roomDoors,
        racks: latest.racks,
        rackItems: latest.rackItems,
        rackLinks: latest.rackLinks
      };
      const normalizedCurrent = {
        ...current,
        corridors: latestSnapshot.corridors === undefined ? undefined : current.corridors,
        roomDoors: (latestSnapshot as any).roomDoors === undefined ? undefined : (current as any).roomDoors,
        racks: latestSnapshot.racks === undefined ? undefined : current.racks,
        rackItems: latestSnapshot.rackItems === undefined ? undefined : current.rackItems,
        rackLinks: latestSnapshot.rackLinks === undefined ? undefined : current.rackLinks,
        safetyCardLayout: latestSnapshot.safetyCardLayout === undefined ? undefined : current.safetyCardLayout
      };
      return !samePlanSnapshot(normalizedCurrent, latestSnapshot);
    },
    [samePlanSnapshot, toSnapshot]
  );

  const hasUnsavedChanges = useMemo(() => getPlanUnsavedChanges(plan), [getPlanUnsavedChanges, plan]);
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
    viewportLiveRef.current = { zoom, pan };
  }, [pan, zoom]);

  const getViewport = useCallback(() => viewportLiveRef.current, []);

  const [presentationEnterModalOpen, setPresentationEnterModalOpen] = useState(false);
  const [presentationEnterBusy, setPresentationEnterBusy] = useState(false);
  const webcamGesturesEnabled = false;

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

  const queryCameraPermission = useCallback(async () => {
    try {
      const p: any = (navigator as any)?.permissions;
      if (!p?.query) return 'unknown' as const;
      const status = await p.query({ name: 'camera' as any });
      const state = String(status?.state || '');
      if (state === 'granted' || state === 'denied' || state === 'prompt') return state as any;
      return 'unknown' as const;
    } catch {
      return 'unknown' as const;
    }
  }, []);

  const requestEnterPresentation = useCallback(() => {
    if (presentationEnterBusy) return;
    setPresentationWebcamEnabled(false);
    setPresentationWebcamCalib(null);
    setPresentationEnterModalOpen(false);
    enterFullscreenFromGesture();
    togglePresentationMode?.();
  }, [
    enterFullscreenFromGesture,
    presentationEnterBusy,
    setPresentationWebcamCalib,
    setPresentationWebcamEnabled,
    togglePresentationMode
  ]);

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

  useEffect(() => {
    if (!presentationEnterModalOpen) return;
    let cancelled = false;
    void (async () => {
      const perm = await queryCameraPermission();
      if (cancelled) return;
      setCameraPermissionState?.(perm);
    })();
    return () => {
      cancelled = true;
    };
  }, [presentationEnterModalOpen, queryCameraPermission, setCameraPermissionState]);

  const requestCameraPermissionOnce = useCallback(async () => {
    try {
      const md: any = (navigator as any)?.mediaDevices;
      if (!md?.getUserMedia) return false;
      const stream: MediaStream = await md.getUserMedia({ video: true, audio: false });
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetToDefaultViewFromGesture = useCallback(() => {
    const current = renderPlan;
    if (!current) return;
    const def = current.views?.find((v) => v.isDefault);
    if (!def) {
      canvasStageRef.current?.fitView?.();
      return;
    }
    setAutoFitEnabled(false);
    setZoom(def.zoom);
    setPan(def.pan);
    saveViewport(current.id, def.zoom, def.pan);
    setSelectedViewId(def.id);
  }, [renderPlan, saveViewport, setAutoFitEnabled, setPan, setZoom]);

  const {
    guideStep: webcamGuideStep,
    guideVisible: webcamGuideVisible,
    calibrationProgress: webcamCalibrationProgress,
    calibrationPinchSeen: webcamCalibrationPinchSeen,
    guidePanDone: webcamGuidePanDone,
    guideOpenDone: webcamGuideOpenDone,
  } = usePresentationWebcamHands({
    active: presentationMode && webcamGesturesEnabled,
    webcamEnabled: webcamGesturesEnabled && presentationWebcamEnabled,
    setWebcamEnabled: setPresentationWebcamEnabled,
    calib: presentationWebcamCalib,
    setCalib: setPresentationWebcamCalib,
    mapRef,
    getViewport,
    setPan,
    onResetView: resetToDefaultViewFromGesture,
    onInfo: (msg) => push(t(msg), 'info'),
    onError: (msg) => push(t(msg), 'danger')
  });

  useEffect(() => {
    if (webcamGesturesEnabled) return;
    if (presentationWebcamEnabled) setPresentationWebcamEnabled(false);
    if (presentationWebcamCalib) setPresentationWebcamCalib(null);
  }, [
    presentationWebcamCalib,
    presentationWebcamEnabled,
    setPresentationWebcamCalib,
    setPresentationWebcamEnabled,
    webcamGesturesEnabled
  ]);

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
        setSelectedRoomIds([focusRoom]);
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
      scale: base.scale,
      safetyCardLayout: (base as any).safetyCardLayout,
      objects: base.objects,
      rooms: base.rooms,
      corridors: base.corridors,
      views: base.views,
      racks: base.racks,
      rackItems: base.rackItems,
      rackLinks: base.rackLinks
    });
  }, [plan, restoreRevision, setFloorPlanContent]);

  const forceSaveNow = useCallback(async () => {
    try {
      const store = useDataStore.getState() as any;
      const res = await saveState(store.clients, store.objectTypes);
      if (Array.isArray(res.clients)) {
        store.setServerState({ clients: res.clients, objectTypes: res.objectTypes });
      } else if (typeof store.markSaved === 'function') {
        store.markSaved();
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const saveRevisionForUnlock = useCallback(async () => {
    if (!plan || !hasNavigationEdits) return true;
    const bump = hasAnyRevision ? 'minor' : 'minor';
    const next = !hasAnyRevision
      ? { major: 1, minor: 0 }
      : { major: latestRev.major, minor: latestRev.minor + 1 };
    addRevision(plan.id, {
      bump,
      name: 'Salvataggio',
      description: 'Unlock request'
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
      details: { bump, rev: `${next.major}.${next.minor}`, note: 'Unlock request' }
    });
    resetTouched();
    entrySnapshotRef.current = toSnapshot(planRef.current || plan);
    return forceSaveNow();
  }, [addRevision, forceSaveNow, hasAnyRevision, hasNavigationEdits, latestRev.major, latestRev.minor, plan, postAuditEvent, push, resetTouched, t, toSnapshot]);

	  const handleUnlockResponse = useCallback(
	    async (action: 'grant' | 'grant_save' | 'grant_discard' | 'deny') => {
      if (!unlockPrompt) return;
      if (unlockBusy) return;
      setUnlockBusy(true);
      if (action === 'grant_save') {
        const ok = await saveRevisionForUnlock();
        if (!ok) {
          push(
            t({ it: 'Salvataggio non riuscito. Riprova.', en: 'Save failed. Please try again.' }),
            'danger'
          );
          setUnlockBusy(false);
          return;
        }
      }
      if (action === 'grant_discard') {
        if (hasNavigationEdits) {
          revertUnsavedChanges();
          resetTouched();
          entrySnapshotRef.current = toSnapshot(planRef.current || plan);
        }
      }
      sendWs({ type: 'unlock_response', requestId: unlockPrompt.requestId, planId: unlockPrompt.planId, action });
      setUnlockPrompt(null);
      setUnlockBusy(false);
      if (action === 'deny') {
        pushStack(t({ it: 'Richiesta rifiutata.', en: 'Request denied.' }), 'info', { duration: LOCK_TOAST_MS });
      } else {
        pushStack(t({ it: 'Lock rilasciato.', en: 'Lock released.' }), 'success', { duration: LOCK_TOAST_MS });
      }
    },
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
      toSnapshot,
      unlockBusy,
      unlockPrompt
    ]
  );

  const toggleRevisionImmutable = useCallback(
    (revisionId: string, nextValue: boolean) => {
      if (!isSuperAdmin) return;
      const actorId = String(user?.id || '');
      const actorName = String(user?.username || '');
      updateRevision(planId, revisionId, {
        immutable: !!nextValue,
        immutableBy: nextValue && actorId ? { id: actorId, username: actorName } : undefined
      });
      postAuditEvent({
        event: nextValue ? 'revision_immutable_set' : 'revision_immutable_clear',
        scopeType: 'plan',
        scopeId: planId,
        details: { id: revisionId, by: actorName || undefined }
      });
      push(
        t({
          it: nextValue ? 'Revisione resa immutabile' : 'Revisione sbloccata',
          en: nextValue ? 'Revision set to immutable' : 'Revision unlocked'
        }),
        'info'
      );
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
	          entrySnapshotRef.current = toSnapshot(planRef.current || plan);
	        }
	      }
	      // Release lock (best-effort); the server will also enforce the deadline.
	      sendWs({ type: 'release_lock', planId });
	      sendWs({ type: 'force_unlock_done', requestId, action, ok });
	      setForceUnlockIncoming(null);
	      return ok;
	    },
	    [hasNavigationEdits, plan, planId, resetTouched, revertUnsavedChanges, saveRevisionForUnlock, sendWs, toSnapshot]
	  );

	  useEffect(() => {
	    if (!forceUnlockExecuteCommand) return;
	    const cmd = forceUnlockExecuteCommand;
	    setForceUnlockExecuteCommand(null);
	    void executeForceUnlock(cmd.requestId, cmd.action);
	  }, [executeForceUnlock, forceUnlockExecuteCommand]);

	  useEffect(() => {
	    const handler = (event: Event) => {
	      const detail = (event as CustomEvent).detail || {};
	      const planId = String(detail.planId || '').trim();
	      const userId = String(detail.userId || '').trim();
	      if (!planId || !userId) return;
	      if (userId === user?.id) return;
	      const target: PresenceUser = {
	        userId,
	        username: String(detail.username || 'user'),
	        avatarUrl: String(detail.avatarUrl || ''),
        lock: {
          planId,
          clientName: String(detail.clientName || ''),
          siteName: String(detail.siteName || ''),
          planName: String(detail.planName || '')
        }
      };
	      setUnlockCompose({
	        target,
	        locks: [
          {
            planId,
            clientName: String(detail.clientName || ''),
            siteName: String(detail.siteName || ''),
            planName: String(detail.planName || '')
          }
        ]
	      });
	    };
	    window.addEventListener(UNLOCK_REQUEST_EVENT, handler as EventListener);
	    return () => {
	      window.removeEventListener(UNLOCK_REQUEST_EVENT, handler as EventListener);
	    };
	  }, [user?.id]);

	  useEffect(() => {
	    const handler = (event: Event) => {
	      if (!isSuperAdmin) return;
	      const detail = (event as CustomEvent).detail || {};
	      const planId = String(detail.planId || '').trim();
	      const userId = String(detail.userId || '').trim();
	      if (!planId || !userId) return;
	      setForceUnlockGraceMinutes(5);
	      setForceUnlockStarting(false);
	      setForceUnlockConfig({
	        planId,
	        planName: String(detail.planName || ''),
	        clientName: String(detail.clientName || ''),
	        siteName: String(detail.siteName || ''),
	        userId,
	        username: String(detail.username || 'user'),
	        avatarUrl: String(detail.avatarUrl || '')
	      });
	    };
	    window.addEventListener(FORCE_UNLOCK_EVENT, handler as EventListener);
	    return () => {
	      window.removeEventListener(FORCE_UNLOCK_EVENT, handler as EventListener);
	    };
	  }, [isSuperAdmin]);

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
    setSaveRevisionOpen(true);
  }, [clearPendingSaveNavigate, hasNavigationEdits, isReadOnly, navigate, pendingSaveNavigateTo]);

  const performPendingPostSaveAction = useCallback(
    async (action: { type: 'language'; value: 'it' | 'en' } | { type: 'logout' }) => {
      if (action.type === 'language') {
        try {
          await updateMyProfile({ language: action.value });
          useAuthStore.setState((s) =>
            s.user
              ? { user: { ...s.user, language: action.value } as any, permissions: s.permissions, hydrated: s.hydrated }
              : s
          );
        } catch {
          // ignore
        }
        window.location.reload();
        return;
      }
      await logout();
      navigate('/login', { replace: true });
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
    if (!saveRevisionOpen) setSaveRevisionOpen(true);
  }, [clearPendingPostSaveAction, hasNavigationEdits, isReadOnly, pendingPostSaveAction, performPendingPostSaveAction, saveRevisionOpen]);

  const saveRevisionReason = useMemo(() => {
    if (pendingNavigateRef.current) {
      return {
        it: 'Stai cambiando planimetria: salva una revisione per non perdere le modifiche.',
        en: 'You are switching floor plans: save a revision to avoid losing changes.'
      };
    }
    if (pendingPostSaveAction?.type === 'language') {
      return {
        it: 'Stai cambiando lingua: salva una revisione per non perdere le modifiche.',
        en: 'You are changing language: save a revision to avoid losing changes.'
      };
    }
    if (pendingPostSaveAction?.type === 'logout') {
      return {
        it: 'Stai uscendo: salva una revisione per non perdere le modifiche.',
        en: 'You are logging out: save a revision to avoid losing changes.'
      };
    }
    return null;
  }, [pendingPostSaveAction]);
  const contextObject = useMemo(() => {
    if (!renderPlan || !contextMenu || contextMenu.kind !== 'object') return undefined;
    return renderPlan.objects.find((o) => o.id === contextMenu.id);
  }, [renderPlan, contextMenu]);
  const contextObjectTypeLabel = useMemo(() => {
    if (!contextObject) return '';
    return objectTypeLabels[contextObject.type] || contextObject.type;
  }, [contextObject, objectTypeLabels]);

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

  const contextIsRack = contextObject?.type === 'rack';
  const contextIsDesk = contextObject ? isDeskType(contextObject.type) : false;
  const contextIsCamera = contextObject?.type === 'camera';
  const contextIsWall = contextObject ? isWallType(contextObject.type) : false;
  const contextIsQuote = contextObject?.type === 'quote';
  const contextIsWifi = contextObject?.type === 'wifi';
  const contextIsPhoto = contextObject?.type === 'photo';
  const contextIsAssemblyPoint = contextObject?.type === 'safety_assembly_point';
  const contextAssemblyGps = contextIsAssemblyPoint ? String((contextObject as any)?.gpsCoords || '') : '';
  const contextAssemblyMapsUrl = useMemo(() => googleMapsUrlFromCoords(contextAssemblyGps), [contextAssemblyGps]);
  const contextPhotoSelectionIds = useMemo(() => {
    if (!contextIsPhoto || !renderPlan) return [];
    const ids =
      contextIsMulti && selectedObjectIds.length
        ? selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'photo')
        : contextMenu && contextMenu.kind === 'object'
          ? [contextMenu.id]
          : [];
    return ids;
  }, [contextIsMulti, contextIsPhoto, contextMenu, renderPlan, selectedObjectIds]);
  const contextPhotoMulti = contextPhotoSelectionIds.length > 1;
  const planPhotoIds = useMemo(() => {
    if (!renderPlan) return [];
    return renderPlan.objects.filter((o) => o.type === 'photo').map((o) => o.id);
  }, [renderPlan]);
  const contextWifiRangeOn = contextIsWifi ? (contextObject as any)?.wifiShowRange !== false : false;
  const contextWifiRangeScale = contextIsWifi
    ? Math.max(0, Math.min(WIFI_RANGE_SCALE_MAX, Number((contextObject as any)?.wifiRangeScale ?? 1) || 1))
    : 1;
  const contextWifiCoverageSqm = contextIsWifi ? Number((contextObject as any)?.wifiCoverageSqm || 0) : 0;
  const contextWifiBaseRadiusM =
    contextIsWifi && Number.isFinite(contextWifiCoverageSqm) && contextWifiCoverageSqm > 0
      ? Math.sqrt(contextWifiCoverageSqm / Math.PI)
      : 0;
  const contextWifiBaseDiameterM = contextWifiBaseRadiusM > 0 ? contextWifiBaseRadiusM * 2 : 0;
  const contextWifiBaseAreaSqm = Number.isFinite(contextWifiCoverageSqm) && contextWifiCoverageSqm > 0 ? contextWifiCoverageSqm : 0;
  const contextWifiEffectiveRadiusM = contextWifiBaseRadiusM > 0 ? contextWifiBaseRadiusM * contextWifiRangeScale : 0;
  const contextWifiEffectiveDiameterM = contextWifiBaseDiameterM > 0 ? contextWifiBaseDiameterM * contextWifiRangeScale : 0;
  const contextWifiEffectiveAreaSqm =
    contextWifiBaseAreaSqm > 0 ? contextWifiBaseAreaSqm * Math.pow(contextWifiRangeScale, 2) : 0;
  const contextWallPolygon = useMemo(() => {
    if (!contextIsWall || !contextMenu || contextMenu.kind !== 'object') return null;
    return getWallPolygonData(contextMenu.id);
  }, [contextIsWall, contextMenu, getWallPolygonData]);
  const contextQuoteOrientation = useMemo(() => {
    if (!contextIsQuote) return 'horizontal' as const;
    const pts = (contextObject as any)?.points as { x: number; y: number }[] | undefined;
    return getQuoteOrientation(pts);
  }, [contextIsQuote, contextObject, getQuoteOrientation]);
  const contextQuoteLabelPos = useMemo(() => {
    if (!contextIsQuote) return 'center' as const;
    const current = String((contextObject as any)?.quoteLabelPos || 'center');
    if (contextQuoteOrientation === 'vertical') {
      return current === 'left' || current === 'right' || current === 'center' ? (current as any) : lastQuoteLabelPosV;
    }
    return current === 'above' || current === 'below' || current === 'center' ? (current as any) : lastQuoteLabelPosH;
  }, [contextIsQuote, contextObject, contextQuoteOrientation, lastQuoteLabelPosH, lastQuoteLabelPosV]);
  const roomModalInitialSurfaceSqm = useMemo(() => {
    if (!roomModal || roomModal.mode !== 'create') return undefined;
    if (roomModal.kind === 'rect' && roomModal.rect) {
      return computeRoomSurfaceSqm(roomModal.rect, metersPerPixel);
    }
    if (roomModal.kind === 'poly') {
      return computeRoomSurfaceSqm({ kind: 'poly', points: roomModal.points }, metersPerPixel);
    }
    return undefined;
  }, [computeRoomSurfaceSqm, metersPerPixel, roomModal]);
  const roomWallTypeAllValue = useMemo(() => {
    if (!roomWallTypeSelections.length) return defaultWallTypeId;
    const first = roomWallTypeSelections[0];
    if (!first) return defaultWallTypeId;
    return roomWallTypeSelections.every((value) => value === first) ? first : '';
  }, [defaultWallTypeId, roomWallTypeSelections]);
  const selectionAllWalls = useMemo(() => {
    if (!renderPlan) return false;
    if (!selectedObjectIds?.length) return false;
    return selectedObjectIds.every((id) => {
      const obj = renderPlan.objects.find((o) => o.id === id);
      return !!obj && isWallType(obj.type);
    });
  }, [isWallType, renderPlan, selectedObjectIds]);
  const canEditWallType = contextIsMulti ? selectionAllWalls : contextIsWall;

  const selectionHasRack = useMemo(() => {
    if (!renderPlan) return false;
    if (!selectedObjectIds?.length) return false;
    return selectedObjectIds.some((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'rack');
  }, [renderPlan, selectedObjectIds]);
  const selectionHasDesk = useMemo(() => {
    if (!renderPlan) return false;
    if (!selectedObjectIds?.length) return false;
    return selectedObjectIds.some((id) => {
      const obj = renderPlan.objects.find((o) => o.id === id);
      return !!obj && isDeskType(obj.type);
    });
  }, [renderPlan, selectedObjectIds]);
  const selectionHasPhoto = useMemo(() => {
    if (!renderPlan) return false;
    if (!selectedObjectIds?.length) return false;
    return selectedObjectIds.some((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'photo');
  }, [renderPlan, selectedObjectIds]);
  const selectionPhotoIds = useMemo(() => {
    if (!renderPlan || !selectedObjectIds?.length) return [];
    return selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'photo');
  }, [renderPlan, selectedObjectIds]);
  const selectionAllRealUsers = useMemo(() => {
    if (!renderPlan) return false;
    if (!selectedObjectIds?.length) return false;
    return selectedObjectIds.every((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'real_user');
  }, [renderPlan, selectedObjectIds]);

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
    if (contextMenu || !renderPlan || selectedObjectIds.length < 2) {
      multiToastKeyRef.current = '';
      if (multiToastIdRef.current != null) {
        toast.dismiss(multiToastIdRef.current);
        multiToastIdRef.current = null;
      }
      return;
    }
    const key = selectedObjectIds.slice().sort().join(',');
    if (multiToastKeyRef.current === key) return;
    multiToastKeyRef.current = key;
    if (multiToastIdRef.current != null) {
      toast.dismiss(multiToastIdRef.current);
    }
    const count = selectedObjectIds.length;
    const items =
      count === 2
        ? [
            { cmd: 'L', it: 'collega i 2 oggetti', en: 'link the 2 objects' },
            { cmd: '+ / −', it: 'scala', en: 'scale' },
            { cmd: 'Ctrl/Cmd + C / V', it: 'copia/incolla', en: 'copy/paste' },
            { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
            { cmd: 'Canc', it: 'elimina', en: 'delete' }
          ]
        : [
            { cmd: '+ / −', it: 'scala', en: 'scale' },
            { cmd: 'Ctrl/Cmd + C / V', it: 'copia/incolla', en: 'copy/paste' },
            { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
            { cmd: 'Canc', it: 'elimina', en: 'delete' }
          ];
    multiToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: `${count} oggetti selezionati`, en: `${count} objects selected` },
        items
      ),
      { duration: Infinity }
    );
  }, [contextMenu, renderKeybindToast, renderPlan, selectedObjectIds]);
  useEffect(() => {
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      deskToastKeyRef.current = '';
      if (deskToastIdRef.current != null) {
        toast.dismiss(deskToastIdRef.current);
        deskToastIdRef.current = null;
      }
      return;
    }
    const deskIds = selectedObjectIds.filter((id) => {
      const obj = renderPlan.objects.find((o) => o.id === id);
      return !!obj && isDeskType(obj.type);
    });
    if (!deskIds.length) {
      deskToastKeyRef.current = '';
      if (deskToastIdRef.current != null) {
        toast.dismiss(deskToastIdRef.current);
        deskToastIdRef.current = null;
      }
      return;
    }
    const key = deskIds.slice().sort().join(',');
    if (deskToastKeyRef.current === key) return;
    deskToastKeyRef.current = key;
    if (deskToastIdRef.current != null) {
      toast.dismiss(deskToastIdRef.current);
    }
    deskToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: 'Scrivania selezionata', en: 'Desk selected' },
        [
          { cmd: 'Frecce', it: 'sposta (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
          { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
          { cmd: '+ / −', it: 'scala', en: 'scale' },
          { cmd: 'L', it: 'collega 2 oggetti selezionati', en: 'link 2 selected objects' }
        ]
      ),
      { duration: Infinity }
    );
  }, [contextMenu, renderKeybindToast, renderPlan, selectedObjectIds]);
  useEffect(() => {
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      quoteToastKeyRef.current = '';
      if (quoteToastIdRef.current != null) {
        toast.dismiss(quoteToastIdRef.current);
        quoteToastIdRef.current = null;
      }
      return;
    }
    const quoteIds = selectedObjectIds.filter((id) => {
      const obj = renderPlan.objects.find((o) => o.id === id);
      return !!obj && obj.type === 'quote';
    });
    if (!quoteIds.length) {
      quoteToastKeyRef.current = '';
      if (quoteToastIdRef.current != null) {
        toast.dismiss(quoteToastIdRef.current);
        quoteToastIdRef.current = null;
      }
      return;
    }
    const key = quoteIds.slice().sort().join(',');
    if (quoteToastKeyRef.current === key) return;
    quoteToastKeyRef.current = key;
    if (quoteToastIdRef.current != null) {
      toast.dismiss(quoteToastIdRef.current);
    }
    quoteToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: 'Quota selezionata', en: 'Quote selected' },
        [
          { cmd: 'Trascina', it: 'sposta la quota', en: 'move the quote' },
          { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
          { cmd: 'Ctrl/Cmd + Frecce', it: 'sposta la scritta', en: 'move the label' },
          {
            cmd: 'Trascina gli apici',
            it: 'allunga/accorcia (Shift blocca orizz./vert.)',
            en: 'extend/shrink (Shift locks horizontal/vertical)'
          },
          { cmd: '+ / −', it: 'scala', en: 'scale' },
          { cmd: 'E', it: 'modifica', en: 'edit' },
          { cmd: 'L', it: 'collega 2 oggetti selezionati', en: 'link 2 selected objects' }
        ]
      ),
      { duration: Infinity }
    );
  }, [contextMenu, renderKeybindToast, renderPlan, selectedObjectIds]);
  useEffect(() => {
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      mediaToastKeyRef.current = '';
      if (mediaToastIdRef.current != null) {
        toast.dismiss(mediaToastIdRef.current);
        mediaToastIdRef.current = null;
      }
      return;
    }
    const textIds = selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'text');
    const imageIds = selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'image');
    const photoIds = selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'photo');
    const postitIds = selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'postit');
    if (!textIds.length && !imageIds.length && !photoIds.length && !postitIds.length) {
      mediaToastKeyRef.current = '';
      if (mediaToastIdRef.current != null) {
        toast.dismiss(mediaToastIdRef.current);
        mediaToastIdRef.current = null;
      }
      return;
    }
    const key = `t:${textIds.slice().sort().join(',')}|i:${imageIds.slice().sort().join(',')}|ph:${photoIds
      .slice()
      .sort()
      .join(',')}|p:${postitIds
      .slice()
      .sort()
      .join(',')}`;
    if (mediaToastKeyRef.current === key) return;
    mediaToastKeyRef.current = key;
    if (mediaToastIdRef.current != null) {
      toast.dismiss(mediaToastIdRef.current);
    }
    const message =
      textIds.length && !imageIds.length && !photoIds.length && !postitIds.length
        ? renderKeybindToast(
            { it: 'Testo selezionato', en: 'Text selected' },
            [
              { cmd: 'Trascina', it: 'sposta', en: 'move' },
              { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
              { cmd: 'Maniglie', it: 'ridimensiona/ruota', en: 'resize/rotate' },
              { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
              { cmd: '+ / −', it: 'dimensione font', en: 'font size' },
              { cmd: 'F', it: 'font avanti', en: 'next font' },
              { cmd: 'Shift + B', it: 'font indietro', en: 'previous font' },
              { cmd: 'C', it: 'colore avanti', en: 'next color' },
              { cmd: 'Shift + C', it: 'colore indietro', en: 'previous color' },
              { cmd: 'B', it: 'mostra/nasconde background', en: 'toggle background' },
              { cmd: 'E', it: 'modifica', en: 'edit' },
              { cmd: 'L', it: 'collega 2 oggetti selezionati', en: 'link 2 selected objects' }
            ]
          )
        : imageIds.length && !textIds.length && !photoIds.length && !postitIds.length
          ? renderKeybindToast(
              { it: 'Immagine selezionata', en: 'Image selected' },
              [
                { cmd: 'Trascina', it: 'sposta', en: 'move' },
                { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
                { cmd: 'Maniglie', it: 'ridimensiona/ruota', en: 'resize/rotate' },
                { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
                { cmd: '+ / −', it: 'scala', en: 'scale' },
                { cmd: 'E', it: 'modifica', en: 'edit' },
                { cmd: 'L', it: 'collega 2 oggetti selezionati', en: 'link 2 selected objects' }
              ]
            )
            : photoIds.length && !textIds.length && !imageIds.length && !postitIds.length
              ? renderKeybindToast(
                  { it: 'Foto selezionata', en: 'Photo selected' },
                  [
                    { cmd: 'Trascina', it: 'sposta', en: 'move' },
                    { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
                    { cmd: '+ / −', it: 'scala', en: 'scale' },
                    { cmd: 'Doppio click', it: 'apri foto', en: 'open photo' },
                    { cmd: 'E', it: 'modifica', en: 'edit' }
                  ]
                )
              : postitIds.length && !textIds.length && !imageIds.length && !photoIds.length
                ? renderKeybindToast(
                    { it: 'Post-it selezionato', en: 'Post-it selected' },
                [
                  { cmd: 'Trascina', it: 'sposta', en: 'move' },
                  { cmd: 'Click icona', it: 'compatta/espandi', en: 'compact/expand' },
                  { cmd: '+ / −', it: 'scala', en: 'scale' },
                  { cmd: 'E', it: 'modifica', en: 'edit' },
                  { cmd: 'L', it: 'collega 2 oggetti selezionati', en: 'link 2 selected objects' }
                ]
              )
            : (() => {
                const base = [
                  { cmd: 'Trascina', it: 'sposta', en: 'move' },
                  { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
                  { cmd: 'Maniglie', it: 'ridimensiona/ruota', en: 'resize/rotate' },
                  { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
                  { cmd: '+ / −', it: 'scala', en: 'scale' },
                  { cmd: 'E', it: 'modifica', en: 'edit' }
                ];
                if (!textIds.length && !imageIds.length) {
                  const rotateIdx = base.findIndex((item) => item.cmd === 'Ctrl/Cmd + ←/→');
                  if (rotateIdx >= 0) base.splice(rotateIdx, 1);
                  const handleIdx = base.findIndex((item) => item.cmd === 'Maniglie');
                  if (handleIdx >= 0) base.splice(handleIdx, 1);
                }
                if (!photoIds.length) {
                  base.push({ cmd: 'L', it: 'collega 2 oggetti selezionati', en: 'link 2 selected objects' });
                }
                return renderKeybindToast({ it: 'Annotazioni selezionate', en: 'Annotations selected' }, base);
              })();
    mediaToastIdRef.current = toast.info(message, { duration: Infinity });
  }, [contextMenu, renderKeybindToast, renderPlan, selectedObjectIds]);
  useEffect(() => {
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      selectionToastKeyRef.current = '';
      if (selectionToastIdRef.current != null) {
        toast.dismiss(selectionToastIdRef.current);
        selectionToastIdRef.current = null;
      }
      return;
    }
    const id = selectedObjectIds[0];
    const obj = renderPlan.objects.find((o) => o.id === id);
    if (!obj) return;
    if (
      isDeskType(obj.type) ||
      obj.type === 'quote' ||
      obj.type === 'text' ||
      obj.type === 'image' ||
      obj.type === 'photo' ||
      obj.type === 'postit'
    ) {
      selectionToastKeyRef.current = '';
      if (selectionToastIdRef.current != null) {
        toast.dismiss(selectionToastIdRef.current);
        selectionToastIdRef.current = null;
      }
      return;
    }
    if (selectionToastKeyRef.current === id) return;
    selectionToastKeyRef.current = id;
    if (selectionToastIdRef.current != null) {
      toast.dismiss(selectionToastIdRef.current);
    }
    const objectTypeLabel = getTypeLabel(obj.type);
    const objectNameLabel = String(obj.name || '').trim() || t({ it: 'Senza nome', en: 'Unnamed' });
    selectionToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: 'Oggetto selezionato', en: 'Object selected' },
        [
          { cmd: t({ it: 'Tipo oggetto:', en: 'Object type:' }), it: objectTypeLabel, en: objectTypeLabel },
          { cmd: t({ it: 'Nome oggetto:', en: 'Object name:' }), it: objectNameLabel, en: objectNameLabel },
          { cmd: 'Trascina', it: 'sposta', en: 'move' },
          { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
          { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
          { cmd: '+ / −', it: 'scala', en: 'scale' },
          { cmd: 'E', it: 'modifica', en: 'edit' }
        ]
      ),
      { duration: Infinity }
    );
  }, [contextMenu, getTypeLabel, renderKeybindToast, renderPlan, selectedObjectIds, t]);
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
    const currentRoomDoors = Array.isArray((renderPlan as any)?.roomDoors) ? (((renderPlan as any).roomDoors as RoomConnectionDoor[]).filter(Boolean)) : [];
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
    setWallQuickMenu(null);
    setWallTypeMenu(null);
    setCorridorQuickMenu(null);
    setAlignMenuOpen(false);
    setLayersContextMenu(null);
    if (contextMenu.kind === 'map') {
      setMapSubmenu(null);
    }
  }, [contextMenu]);

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

  const getSubmenuStyle = useCallback(
    (submenuWidth: number) => {
      if (!contextMenu) return { top: 0, left: 0 };
      const gap = 8;
      const menuWidth = contextMenuRef.current?.offsetWidth || 224;
      let left = contextMenu.x + menuWidth + gap;
      if (typeof window !== 'undefined') {
        if (left + submenuWidth > window.innerWidth - 12) {
          const alt = contextMenu.x - submenuWidth - gap;
          if (alt >= 12) left = alt;
        }
      }
      return { top: contextMenu.y, left };
    },
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
    if (!renderPlan) return;
    const key = `${planId}:${selectedRevisionId || 'present'}`;
    if (autoCenterRef.current === key) return;
    const timer = window.setTimeout(() => {
      const el = mapRef.current;
      const stage = canvasStageRef.current;
      if (!el || !stage?.fitView) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const width = Number(renderPlan.width || 0);
      const height = Number(renderPlan.height || 0);
      const z = Number(zoom);
      const px = Number(pan?.x);
      const py = Number(pan?.y);
      let shouldFit = false;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        shouldFit = true;
      } else if (!Number.isFinite(z) || z <= 0 || !Number.isFinite(px) || !Number.isFinite(py) || cw <= 0 || ch <= 0) {
        shouldFit = true;
      } else {
        const viewMinX = (-px) / z;
        const viewMinY = (-py) / z;
        const viewMaxX = (cw - px) / z;
        const viewMaxY = (ch - py) / z;
        const interW = Math.max(0, Math.min(width, viewMaxX) - Math.max(0, viewMinX));
        const interH = Math.max(0, Math.min(height, viewMaxY) - Math.max(0, viewMinY));
        const visibleRatio = (interW * interH) / (width * height);
        shouldFit = !Number.isFinite(visibleRatio) || visibleRatio < 0.2;
      }
      if (shouldFit) {
        stage.fitView();
      }
      autoCenterRef.current = key;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pan?.x, pan?.y, planId, renderPlan, renderPlan?.height, renderPlan?.width, selectedRevisionId, zoom]);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage?.fitView) return;

    if (presentationMode) {
      // Entering fullscreen changes the map container size. Explicitly re-fit to use all available space.
      if (!presentationViewportRef.current) {
        presentationViewportRef.current = { zoom, pan, autoFitEnabled };
      }

      const t1 = window.setTimeout(() => stage.fitView?.(), 200);
      const t2 = window.setTimeout(() => stage.fitView?.(), 700);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    const prev = presentationViewportRef.current;
    if (!prev) return;
    presentationViewportRef.current = null;

    // Restore the previous viewport when leaving presentation.
    setAutoFitEnabled(prev.autoFitEnabled);
    setZoom(prev.zoom);
    setPan(prev.pan);
    saveViewport(planId, prev.zoom, prev.pan);
  }, [planId, presentationMode, saveViewport, setAutoFitEnabled, setPan, setZoom]);

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
	    (id?: string, options?: { keepContext?: boolean; multi?: boolean }) => {
        if (panToolActive && id) setPanToolActive(false);
	      // If the user is drawing a room (especially polygon mode) and clicks an object,
	      // treat it as an explicit cancel of the drawing gesture.
	      if (roomDrawMode && id) {
	        setRoomDrawMode(null);
	        setNewRoomMenuOpen(false);
	      }
        if (corridorDrawMode && id) {
          setCorridorDrawMode(null);
        }
	      if (linkFromId && id && planRef.current && !isReadOnlyRef.current) {
	        if (id !== linkFromId) {
            const fromObj = (planRef.current as any).objects?.find((o: any) => o.id === linkFromId);
            const toObj = (planRef.current as any).objects?.find((o: any) => o.id === id);
            if (fromObj?.type === 'photo' || toObj?.type === 'photo') {
              push(t({ it: 'Le foto non possono essere collegate', en: 'Photos cannot be linked' }), 'info');
              setLinkFromId(null);
              return;
            }
            if ((fromObj && isDeskType(fromObj.type)) || (toObj && isDeskType(toObj.type))) {
              push(t({ it: 'Le scrivanie non possono essere collegate', en: 'Desks cannot be linked' }), 'info');
              setLinkFromId(null);
              return;
            }
	          markTouched();
            if (linkCreateMode === 'cable') {
              setCableModal({ mode: 'create', fromId: linkFromId, toId: id });
            } else {
              addLink((planRef.current as any).id, linkFromId, id, { kind: 'arrow', arrow: 'none' });
              postAuditEvent({ event: 'link_create', scopeType: 'plan', scopeId: (planRef.current as any).id, details: { fromId: linkFromId, toId: id } });
              push(t({ it: 'Collegamento creato', en: 'Link created' }), 'success');
            }
	        }
	        setLinkFromId(null);
	      }
      if (!id) {
        clearSelection();
        setSelectedRoomId(undefined);
        setSelectedRoomIds([]);
        setSelectedCorridorId(undefined);
        setSelectedCorridorDoor(null);
        setSelectedRoomDoorId(null);
        setCorridorQuickMenu(null);
        setSelectedLinkId(null);
      } else if (options?.multi) {
        setSelectedRoomId(undefined);
        setSelectedRoomIds([]);
        setSelectedCorridorId(undefined);
        setSelectedCorridorDoor(null);
        setSelectedRoomDoorId(null);
        setCorridorQuickMenu(null);
        setSelectedLinkId(null);
        toggleSelectedObject(id);
      } else {
        setSelectedRoomId(undefined);
        setSelectedRoomIds([]);
        setSelectedCorridorId(undefined);
        setSelectedCorridorDoor(null);
        setSelectedRoomDoorId(null);
        setCorridorQuickMenu(null);
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

  const handleObjectContextMenu = useCallback(
    ({
      id,
      clientX,
      clientY,
      wallSegmentLengthPx
    }: {
      id: string;
      clientX: number;
      clientY: number;
      wallSegmentLengthPx?: number;
    }) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'object', id, x: clientX, y: clientY, wallSegmentLengthPx });
    },
    [dismissSelectionHintToasts]
  );

  const handleWallQuickMenu = useCallback(
    ({ id, clientX, clientY, world }: { id: string; clientX: number; clientY: number; world: { x: number; y: number } }) => {
      if (isReadOnlyRef.current) return;
      const selectedIds = selectedObjectIdsRef.current || [];
      if (selectedIds.length > 1 && selectedIds.includes(id)) {
        setWallQuickMenu(null);
        setWallTypeMenu(null);
        return;
      }
      setWallQuickMenu({ id, x: clientX, y: clientY, world });
      setWallTypeMenu(null);
    },
    []
  );

  const handleCorridorQuickMenu = useCallback(
    ({ id, clientX, clientY, worldX, worldY }: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => {
      if (isReadOnlyRef.current) return;
      if (corridorDoorDraft && corridorDoorDraft.corridorId !== id) return;
      setCorridorQuickMenu({ id, x: clientX, y: clientY, world: { x: worldX, y: worldY } });
    },
    [corridorDoorDraft]
  );

  const handleCorridorDoorDraftPoint = useCallback(
    ({
      corridorId,
      point
    }: {
      corridorId: string;
      clientX: number;
      clientY: number;
      point: { edgeIndex: number; t: number; x: number; y: number };
    }) => {
      if (isReadOnlyRef.current) return;
      const currentPlan = planRef.current as FloorPlan | undefined;
      if (!currentPlan) return;
      const draft = corridorDoorDraft;
      if (!draft || draft.corridorId !== corridorId) return;
      const current = (currentPlan.corridors || []) as Corridor[];
      let created = false;
      const next = current.map((c) => {
        if (c.id !== corridorId) return c;
        const doors = Array.isArray(c.doors) ? [...c.doors] : [];
        const duplicate = doors.some((d: any) => {
          const sameEdge = Number(d.edgeIndex) === Number(point.edgeIndex);
          if (!sameEdge) return false;
          return Math.abs(Number(d.t) - Number(point.t)) < 0.02;
        });
        if (duplicate) return c;
        created = true;
        const doorId = nanoid();
        const defaultDoorType = defaultDoorCatalogId
          ? (objectTypeById.get(defaultDoorCatalogId) as ObjectTypeDefinition | undefined)
          : undefined;
        const defaultEmergency = !!defaultDoorType?.doorConfig?.isEmergency;
        setSelectedCorridorDoor({ corridorId, doorId });
        return {
          ...c,
          doors: [
            ...doors,
            {
              id: doorId,
              edgeIndex: Number(point.edgeIndex),
              t: Number(point.t.toFixed(4)),
              edgeIndexTo: undefined,
              tTo: undefined,
              catalogTypeId: defaultDoorCatalogId || undefined,
              mode: 'static',
              description: undefined,
              isEmergency: defaultEmergency,
              isMainEntrance: false,
              isExternal: false,
              isFireDoor: false,
              verificationHistory: [],
              linkedRoomIds: []
            }
          ]
        };
      });
      if (!created) {
        push(t({ it: 'Porta già presente in questo punto', en: 'A door already exists at this point' }), 'info');
        return;
      }
      markTouched();
      updateFloorPlan(currentPlan.id, { corridors: next } as any);
      push(t({ it: 'Porta creata sul corridoio', en: 'Door created on corridor' }), 'success');
      setCorridorDoorDraft(null);
      setCorridorQuickMenu(null);
    },
    [corridorDoorDraft, defaultDoorCatalogId, markTouched, objectTypeById, push, t, updateFloorPlan]
  );

  const createRoomDoorFromDraft = useCallback(
    (roomId: string, point: { x: number; y: number }) => {
      if (isReadOnlyRef.current) return false;
      const currentPlan = planRef.current as FloorPlan | undefined;
      const draft = roomDoorDraft;
      if (!currentPlan || !draft) return false;
      const normalizedRoomId = String(roomId || '').trim();
      if (!normalizedRoomId) return false;
      const candidateSides = draft.sharedSides.filter((side) => side.anchorRoomId === normalizedRoomId);
      if (!candidateSides.length) return false;
      let best:
        | {
            side: SharedRoomSide;
            x: number;
            y: number;
            distSq: number;
            along: number;
          }
        | null = null;
      for (const side of candidateSides) {
        const proj = projectPointToSegment(side.a, side.b, point);
        const segLenSq = (side.b.x - side.a.x) * (side.b.x - side.a.x) + (side.b.y - side.a.y) * (side.b.y - side.a.y);
        const along =
          segLenSq > 0.000001
            ? Math.max(
                0,
                Math.min(1, ((proj.x - side.a.x) * (side.b.x - side.a.x) + (proj.y - side.a.y) * (side.b.y - side.a.y)) / segLenSq)
              )
            : 0;
        if (!best || proj.distSq < best.distSq) {
          best = { side, x: proj.x, y: proj.y, distSq: proj.distSq, along };
        }
      }
      if (!best) return false;
      const maxSnapDist = 18;
      if (best.distSq > maxSnapDist * maxSnapDist) {
        push(
          t({
            it: 'Posiziona la porta sul lato condiviso tra le due stanze selezionate.',
            en: 'Place the door on the shared side between the two selected rooms.'
          }),
          'info'
        );
        return true;
      }
      const side = best.side;
      const tValue = side.tMin + (side.tMax - side.tMin) * best.along;
      const roomAId = String(draft.roomAId);
      const roomBId = String(draft.roomBId);
      const existingDoors = Array.isArray((currentPlan as any).roomDoors) ? ((currentPlan as any).roomDoors as any[]) : [];
      const duplicate = existingDoors.some((door) => {
        const normalized = normalizeRoomConnectionDoorInput(door);
        if (!normalized) return false;
        const samePair =
          (normalized.roomAId === roomAId && normalized.roomBId === roomBId) ||
          (normalized.roomAId === roomBId && normalized.roomBId === roomAId);
        if (!samePair) return false;
        if (normalized.anchorRoomId !== side.anchorRoomId) return false;
        if (Number(normalized.edgeIndex) !== Number(side.edgeIndex)) return false;
        return Math.abs(Number(normalized.t) - Number(tValue)) < 0.02;
      });
      if (duplicate) {
        push(t({ it: 'Porta di collegamento già presente in questo punto.', en: 'A linking door already exists at this point.' }), 'info');
        return true;
      }
      const doorId = nanoid();
      const defaultDoorType = defaultDoorCatalogId
        ? (objectTypeById.get(defaultDoorCatalogId) as ObjectTypeDefinition | undefined)
        : undefined;
      const defaultEmergency = !!defaultDoorType?.doorConfig?.isEmergency;
      const nextDoor: RoomConnectionDoor = {
        id: doorId,
        roomAId,
        roomBId,
        anchorRoomId: side.anchorRoomId,
        edgeIndex: Number(side.edgeIndex),
        t: Number(Math.max(0, Math.min(1, tValue)).toFixed(4)),
        catalogTypeId: defaultDoorCatalogId || undefined,
        mode: 'static',
        description: undefined,
        isEmergency: defaultEmergency,
        isMainEntrance: false,
        isExternal: false,
        isFireDoor: false,
        verificationHistory: []
      };
      markTouched();
      updateFloorPlan(currentPlan.id, { roomDoors: [...existingDoors, nextDoor] as any } as any);
      setRoomDoorDraft(null);
      setSelectedRoomDoorId(doorId);
      setContextMenu(null);
      push(t({ it: 'Porta di collegamento creata', en: 'Connecting door created' }), 'success');
      return true;
    },
    [defaultDoorCatalogId, markTouched, objectTypeById, projectPointToSegment, push, roomDoorDraft, t, updateFloorPlan]
  );

  const startRoomDoorDraft = useCallback(
    (roomAId: string, roomBId: string) => {
      if (isReadOnlyRef.current) return;
      const currentPlan = renderPlan as FloorPlan | undefined;
      if (!currentPlan) return;
      const roomA = ((currentPlan.rooms || []) as Room[]).find((room) => room.id === roomAId);
      const roomB = ((currentPlan.rooms || []) as Room[]).find((room) => room.id === roomBId);
      if (!roomA || !roomB) return;
      const sharedSides = getSharedRoomSides(roomA, roomB);
      if (!sharedSides.length) {
        push(
          t({
            it: 'Le due stanze devono condividere un lato sovrapposto per creare una porta di collegamento.',
            en: 'The two rooms must share an overlapping side to create a connecting door.'
          }),
          'danger'
        );
        return;
      }
      setRoomDoorDraft({ roomAId, roomBId, sharedSides });
      setSelectedRoomDoorId(null);
      setContextMenu(null);
      push(
        t({
          it: 'Seleziona sul perimetro condiviso di una delle due stanze il punto in cui inserire la porta.',
          en: 'Select on the shared perimeter of one of the two rooms where to place the door.'
        }),
        'info'
      );
    },
    [getSharedRoomSides, push, renderPlan, t]
  );

  const toggleMapSubmenu = useCallback((section: typeof mapSubmenu) => {
    setMapSubmenu((prev) => (prev === section ? null : section));
  }, []);

  const handleLinkContextMenu = useCallback(
    ({ id, clientX, clientY }: { id: string; clientX: number; clientY: number }) => {
      if (isRackLinkId(id)) return;
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'link', id, x: clientX, y: clientY });
    },
    [dismissSelectionHintToasts]
  );

  const handleRoomContextMenu = useCallback(
    ({ id, clientX, clientY, worldX, worldY }: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => {
      dismissSelectionHintToasts();
      if (roomDoorDraft) {
        if (createRoomDoorFromDraft(id, { x: worldX, y: worldY })) return;
      }
      setContextMenu({ kind: 'room', id, x: clientX, y: clientY, worldX, worldY });
    },
    [createRoomDoorFromDraft, dismissSelectionHintToasts, roomDoorDraft]
  );

  const handleCorridorContextMenu = useCallback(
    ({ id, clientX, clientY, worldX, worldY }: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'corridor', id, x: clientX, y: clientY, worldX, worldY });
    },
    [dismissSelectionHintToasts]
  );
  const handleCorridorConnectionContextMenu = useCallback(
    ({
      corridorId,
      connectionId,
      clientX,
      clientY,
      worldX,
      worldY
    }: {
      corridorId: string;
      connectionId: string;
      clientX: number;
      clientY: number;
      worldX: number;
      worldY: number;
    }) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'corridor_connection', corridorId, connectionId, x: clientX, y: clientY, worldX, worldY });
    },
    [dismissSelectionHintToasts]
  );
  const handleCorridorDoorContextMenu = useCallback(
    ({ corridorId, doorId, clientX, clientY }: { corridorId: string; doorId: string; clientX: number; clientY: number }) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'corridor_door', corridorId, doorId, x: clientX, y: clientY });
    },
    [dismissSelectionHintToasts]
  );
  const handleRoomDoorContextMenu = useCallback(
    ({ doorId, clientX, clientY }: { doorId: string; clientX: number; clientY: number }) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'room_door', doorId, x: clientX, y: clientY });
    },
    [dismissSelectionHintToasts]
  );

  const handleScaleContextMenu = useCallback(
    ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      if (!planScale?.start || !planScale?.end) return;
      setContextMenu({ kind: 'scale', x: clientX, y: clientY });
    },
    [planScale?.end, planScale?.start]
  );

  const handleScaleDoubleClick = useCallback(() => {
    if (!planScale?.start || !planScale?.end || isReadOnly) return;
    setContextMenu(null);
    setScaleActionsOpen(true);
  }, [isReadOnly, planScale?.end, planScale?.start]);

  const handleScaleMove = useCallback(
    (payload: { start: { x: number; y: number }; end: { x: number; y: number } }) => {
      if (!plan || isReadOnly) return;
      if (!planScale?.meters || !planScale?.metersPerPixel) return;
      markTouched();
      updateFloorPlan(plan.id, {
        scale: {
          ...(planScale as any),
          start: payload.start,
          end: payload.end,
          meters: planScale.meters,
          metersPerPixel: planScale.metersPerPixel
        }
      });
    },
    [isReadOnly, markTouched, plan, planScale?.meters, planScale?.metersPerPixel, updateFloorPlan]
  );

  const updateScaleStyle = useCallback(
    (payload: { labelScale?: number; strokeWidth?: number }) => {
      if (!plan || isReadOnly) return;
      if (!planScale?.start || !planScale?.end || !planScale?.meters || !planScale?.metersPerPixel) return;
      markTouched();
      updateFloorPlan(plan.id, {
        scale: {
          start: planScale.start,
          end: planScale.end,
          meters: planScale.meters,
          metersPerPixel: planScale.metersPerPixel,
          labelScale: Number.isFinite(payload.labelScale as number) ? Number(payload.labelScale) : (planScale as any).labelScale,
          strokeWidth: Number.isFinite(payload.strokeWidth as number) ? Number(payload.strokeWidth) : (planScale as any).strokeWidth,
          opacity: Number.isFinite(Number(planScale.opacity)) ? Number(planScale.opacity) : 1
        }
      });
    },
    [isReadOnly, markTouched, plan, planScale?.end, planScale?.meters, planScale?.metersPerPixel, planScale?.opacity, planScale?.start, updateFloorPlan]
  );

  const openScaleEdit = useCallback(() => {
    if (!planScale?.start || !planScale?.end || isReadOnly) return;
    const distance = Math.hypot(planScale.end.x - planScale.start.x, planScale.end.y - planScale.start.y);
    if (!Number.isFinite(distance) || distance <= 0) return;
    setScaleMode(false);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleModal({ start: planScale.start, end: planScale.end, distance });
    const meters = Number(planScale.meters);
    setScaleMetersInput(Number.isFinite(meters) ? formatNumber(meters) : '');
  }, [formatNumber, isReadOnly, planScale?.end, planScale?.meters, planScale?.start]);

  const updateQuoteLabelPos = useCallback(
    (id: string, pos: 'center' | 'above' | 'below' | 'left' | 'right', orientation?: 'horizontal' | 'vertical') => {
      if (!id) return;
      updateObject(id, { quoteLabelPos: pos });
      const resolved = orientation || getQuoteOrientation((renderPlan as any)?.objects?.find((o: any) => o.id === id)?.points);
      if (resolved === 'vertical') {
        if (pos === 'left' || pos === 'right' || pos === 'center') setLastQuoteLabelPosV(pos as any);
      } else {
        if (pos === 'above' || pos === 'below' || pos === 'center') setLastQuoteLabelPosH(pos as any);
      }
    },
    [getQuoteOrientation, renderPlan, setLastQuoteLabelPosH, setLastQuoteLabelPosV, updateObject]
  );

  const handleMapContextMenu = useCallback(
    ({ clientX, clientY, worldX, worldY }: { clientX: number; clientY: number; worldX: number; worldY: number }) => {
      dismissSelectionHintToasts();
      if (toolMode) return;
      const getCorridorPoints = (corridor: any): { x: number; y: number }[] => {
        const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
        if (kind === 'poly' && Array.isArray(corridor?.points) && corridor.points.length >= 3) {
          return corridor.points
            .filter((p: any) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
            .map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
        }
        const x = Number(corridor?.x || 0);
        const y = Number(corridor?.y || 0);
        const width = Number(corridor?.width || 0);
        const height = Number(corridor?.height || 0);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          return [];
        }
        return [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height }
        ];
      };
      const getEdgePoint = (points: { x: number; y: number }[], edgeIndex: number, t: number): { x: number; y: number } | null => {
        if (!points.length) return null;
        const len = points.length;
        const from = points[((Math.floor(edgeIndex) % len) + len) % len];
        const to = points[(((Math.floor(edgeIndex) % len) + len) % len + 1) % len];
        if (!from || !to) return null;
        const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
        return {
          x: from.x + (to.x - from.x) * clamped,
          y: from.y + (to.y - from.y) * clamped
        };
      };
      const planCorridors = (((renderPlan as FloorPlan | undefined)?.corridors || []) as Corridor[]).filter(Boolean);
      if (planCorridors.length) {
        const hitRadius = 16 / Math.max(0.2, Number(zoom) || 1);
        const hitRadiusSq = hitRadius * hitRadius;
        let bestHit: { corridorId: string; doorId: string; distanceSq: number } | null = null;
        for (const corridor of planCorridors) {
          const doors = Array.isArray(corridor.doors) ? corridor.doors : [];
          if (!doors.length) continue;
          const points = getCorridorPoints(corridor);
          if (!points.length) continue;
          for (const door of doors) {
            const anchor = getEdgePoint(points, Number((door as any)?.edgeIndex), Number((door as any)?.t));
            if (!anchor) continue;
            const dx = anchor.x - worldX;
            const dy = anchor.y - worldY;
            const distSq = dx * dx + dy * dy;
            if (distSq > hitRadiusSq) continue;
            if (!bestHit || distSq < bestHit.distanceSq) {
              bestHit = { corridorId: corridor.id, doorId: door.id, distanceSq: distSq };
            }
          }
        }
        if (bestHit) {
          clearSelection();
          setSelectedLinkId(null);
          setSelectedRoomId(undefined);
          setSelectedRoomIds([]);
          setSelectedCorridorId(undefined);
          setSelectedRoomDoorId(null);
          setSelectedCorridorDoor({ corridorId: bestHit.corridorId, doorId: bestHit.doorId });
          setContextMenu({
            kind: 'corridor_door',
            corridorId: bestHit.corridorId,
            doorId: bestHit.doorId,
            x: clientX,
            y: clientY
          });
          return;
        }
      }
      const corridorId = getCorridorIdAt((renderPlan as FloorPlan | undefined)?.corridors as any, worldX, worldY);
      if (corridorId) {
        clearSelection();
        setSelectedLinkId(null);
        setSelectedRoomId(undefined);
        setSelectedRoomIds([]);
        setSelectedCorridorDoor(null);
        setSelectedRoomDoorId(null);
        setSelectedCorridorId(corridorId);
        setContextMenu({ kind: 'corridor', id: corridorId, x: clientX, y: clientY, worldX, worldY });
        return;
      }
      const roomId = getRoomIdAt((renderPlan as FloorPlan | undefined)?.rooms, worldX, worldY);
      if (roomId) {
        if (roomDoorDraft && createRoomDoorFromDraft(roomId, { x: worldX, y: worldY })) return;
        if (!effectiveVisibleLayerIds.includes('rooms')) {
          const now = Date.now();
          if (now - roomLayerNoticeRef.current > 1200) {
            roomLayerNoticeRef.current = now;
            push(
              t({
                it: 'La stanza è nascosta: abilita il layer "Stanze" per interagire.',
                en: 'The room is hidden: enable the "Rooms" layer to interact.'
              }),
              'info'
            );
          }
          setContextMenu({ kind: 'map', x: clientX, y: clientY, worldX, worldY });
          return;
        }
        clearSelection();
        setSelectedLinkId(null);
        setSelectedCorridorId(undefined);
        setSelectedCorridorDoor(null);
        setSelectedRoomDoorId(null);
        setSelectedRoomId(roomId);
        setSelectedRoomIds([roomId]);
        setContextMenu({ kind: 'room', id: roomId, x: clientX, y: clientY, worldX, worldY });
        return;
      }
      setContextMenu({ kind: 'map', x: clientX, y: clientY, worldX, worldY });
    },
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

  const handleSafetyCardContextMenu = useCallback(
    ({ clientX, clientY, worldX, worldY }: { clientX: number; clientY: number; worldX: number; worldY: number }) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'safety_card', x: clientX, y: clientY, worldX, worldY });
    },
    [dismissSelectionHintToasts]
  );

  const openEscapeRouteAt = useCallback(
    (point: { x: number; y: number }, sourceKind: 'map' | 'room' | 'corridor') => {
      if (!siteFloorPlans.length) {
        push(t({ it: 'Nessuna planimetria disponibile per la sede selezionata.', en: 'No floor plans available for the selected site.' }), 'info');
        return;
      }
      setEscapeRouteModal({
        startPoint: { x: Number(point.x), y: Number(point.y) },
        startPlanId: planId,
        sourceKind
      });
      setContextMenu(null);
    },
    [planId, push, siteFloorPlans.length, t]
  );
  const toggleSecurityCardVisibility = useCallback(() => {
    const baseVisible = hideAllLayers
      ? []
      : allItemsSelected
        ? nonAllLayerIds
        : visibleLayerIds;
    const hasSecurity = baseVisible.includes(SECURITY_LAYER_ID);
    const nextRaw = hasSecurity
      ? baseVisible.filter((id) => id !== SECURITY_LAYER_ID)
      : [...baseVisible, SECURITY_LAYER_ID];
    if (hideAllLayers) setHideAllLayers(planId, false);
    setVisibleLayerIds(planId, normalizeLayerSelection(nextRaw));
  }, [
    allItemsSelected,
    hideAllLayers,
    nonAllLayerIds,
    normalizeLayerSelection,
    planId,
    setHideAllLayers,
    setVisibleLayerIds,
    visibleLayerIds
  ]);

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

  const handleOverwriteView = useCallback(
    (view: FloorPlanView) => {
      if (!plan || isReadOnly) return;
      updateView(plan.id, view.id, { zoom, pan });
      push(t({ it: 'Vista sovrascritta', en: 'View overwritten' }), 'success');
      setSelectedViewId(view.id);
      setViewsMenuOpen(false);
    },
    [isReadOnly, pan, plan, push, t, updateView, zoom]
  );

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
    if (isDeskType(obj.type)) {
      markTouched();
      const label = String(obj.name || getTypeLabel(obj.type)).trim() || getTypeLabel(obj.type);
      const layerIds = obj.layerIds || inferDefaultLayerIds(obj.type, layerIdSet);
      const id = addObject(
        renderPlan.id,
        obj.type,
        '',
        obj.description,
        obj.x + offset,
        obj.y + offset * 0.4,
        obj.scale ?? 1,
        layerIds,
        {
          opacity: obj.opacity,
          rotation: obj.rotation,
          strokeWidth: obj.strokeWidth,
          strokeColor: obj.strokeColor,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY
        }
      );
      ensureObjectLayerVisible(layerIds, label, obj.type);
      lastInsertedRef.current = { id, name: label };
      const roomId = getRoomIdAt((renderPlan as FloorPlan).rooms, obj.x + offset, obj.y + offset * 0.4);
      if (roomId) updateObject(id, { roomId });
      push(t({ it: `Oggetto duplicato: ${label}`, en: `Object duplicated: ${label}` }), 'success');
      postAuditEvent({
        event: 'object_duplicate',
        scopeType: 'plan',
        scopeId: renderPlan.id,
        details: { fromId: obj.id, id, type: obj.type, name: label, roomId: roomId || null }
      });
      return;
    }
    setModalState({ mode: 'duplicate', objectId, coords: { x: obj.x + offset, y: obj.y + offset * 0.4 } });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
        if (isTyping) return;

	      const isCmdF = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f';
	      if (isCmdF) {
	        e.preventDefault();
	        searchInputRef.current?.focus();
	      }

        const isCmdP = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p';
        if (isCmdP) {
          e.preventDefault();
          setExportModalOpen(true);
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
      if (pts.length < 3) {
        const rx = Number(room?.x || 0);
        const ry = Number(room?.y || 0);
        const rw = Number(room?.width || 0);
        const rh = Number(room?.height || 0);
        return rw > 0 && rh > 0 && x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
      }
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

  function getRoomIdAt(rooms: any[] | undefined, x: number, y: number) {
    const list = rooms || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const room = list[i];
      if (isPointInRoom(room, x, y)) return room.id as string;
    }
    return undefined;
  }

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

  const getCorridorPolygon = useCallback((corridor: any) => {
    const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
    if (kind === 'poly') {
      const pts = Array.isArray(corridor?.points) ? corridor.points : [];
      if (pts.length >= 3) return pts;
      const x = Number(corridor?.x || 0);
      const y = Number(corridor?.y || 0);
      const w = Number(corridor?.width || 0);
      const h = Number(corridor?.height || 0);
      if (!w || !h) return [];
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
    }
    const x = Number(corridor?.x || 0);
    const y = Number(corridor?.y || 0);
    const w = Number(corridor?.width || 0);
    const h = Number(corridor?.height || 0);
    if (!w || !h) return [];
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ];
  }, []);

  const getClosestCorridorEdge = useCallback(
    (corridor: Corridor, point: { x: number; y: number }) => {
      const pts = getCorridorPolygon(corridor);
      if (pts.length < 2) return null;
      let best: { edgeIndex: number; t: number; x: number; y: number; distSq: number } | null = null;
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const proj = projectPointToSegment(a, b, point);
        if (!best || proj.distSq < best.distSq) {
          best = { edgeIndex: i, t: proj.t, x: proj.x, y: proj.y, distSq: proj.distSq };
        }
      }
      return best;
    },
    [getCorridorPolygon, projectPointToSegment]
  );
  const getCorridorEdgePoint = useCallback(
    (corridor: Corridor, edgeIndex: number, t: number) => {
      const pts = getCorridorPolygon(corridor);
      if (pts.length < 2) return null;
      const idx = ((Math.floor(edgeIndex) % pts.length) + pts.length) % pts.length;
      const a = pts[idx];
      const b = pts[(idx + 1) % pts.length];
      if (!a || !b) return null;
      const ratio = Math.max(0, Math.min(1, Number(t) || 0));
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    },
    [getCorridorPolygon]
  );


  const roomContextMetrics = useMemo(() => {
    if (!contextMenu || contextMenu.kind !== 'room' || !renderPlan) return null;
    const room = (renderPlan.rooms || []).find((r) => r.id === contextMenu.id);
    if (!room) return null;
    const points = getRoomPolygon(room);
    if (points.length < 2) return null;
    const unit = metersPerPixel ? (lang === 'it' ? 'ml' : 'm') : 'px';
    const areaUnit = metersPerPixel ? (lang === 'it' ? 'mq' : 'sqm') : 'px^2';
    const scaleMissing = !metersPerPixel;
    const segments = points.map((start: { x: number; y: number }, index: number) => {
      const end = points[(index + 1) % points.length];
      const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
      const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % points.length)}`;
      const lengthLabel = scaleMissing ? null : `${formatNumber(lengthPx * metersPerPixel)} ${unit}`;
      return { label, lengthPx, lengthLabel };
    });
    const perimeterPx = computePolylineLength([...points, points[0]]);
    const areaPx = computePolygonArea(points);
    const perimeterLabel = scaleMissing ? null : `${formatNumber(perimeterPx * metersPerPixel)} ${unit}`;
    const areaLabel = scaleMissing
      ? null
      : `${formatNumber(areaPx * metersPerPixel * metersPerPixel)} ${areaUnit}`;
    return { segments, perimeterLabel, areaLabel, scaleMissing };
  }, [
    computePolygonArea,
    computePolylineLength,
    contextMenu,
    formatCornerLabel,
    formatNumber,
    getRoomPolygon,
    lang,
    metersPerPixel,
    renderPlan
  ]);

  const roomModalMetrics = useMemo(() => {
    if (!roomModal) return null;
    let points: { x: number; y: number }[] = [];
    if (roomModal.mode === 'create') {
      if (roomModal.kind === 'rect' && roomModal.rect) {
        const { x, y, width, height } = roomModal.rect;
        points = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height }
        ];
      } else if (roomModal.kind === 'poly') {
        points = roomModal.points || [];
      }
    } else if (roomModal.mode === 'edit' && renderPlan) {
      const room = (renderPlan.rooms || []).find((r) => r.id === roomModal.roomId);
      if (room) points = getRoomPolygon(room);
    }
    if (points.length < 2) return null;
    const unit = metersPerPixel ? (lang === 'it' ? 'ml' : 'm') : 'px';
    const areaUnit = metersPerPixel ? (lang === 'it' ? 'mq' : 'sqm') : 'px^2';
    const scaleMissing = !metersPerPixel;
    const segments = points.map((start, index) => {
      const end = points[(index + 1) % points.length];
      const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
      const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % points.length)}`;
      const lengthLabel = scaleMissing ? null : `${formatNumber(lengthPx * metersPerPixel)} ${unit}`;
      return { label, lengthLabel };
    });
    const perimeterPx = computePolylineLength([...points, points[0]]);
    const areaPx = computePolygonArea(points);
    const perimeterLabel = scaleMissing ? null : `${formatNumber(perimeterPx * metersPerPixel)} ${unit}`;
    const areaLabel = scaleMissing
      ? null
      : `${formatNumber(areaPx * metersPerPixel * metersPerPixel)} ${areaUnit}`;
    return { segments, perimeterLabel, areaLabel, scaleMissing };
  }, [
    computePolygonArea,
    computePolylineLength,
    formatCornerLabel,
    formatNumber,
    getRoomPolygon,
    lang,
    metersPerPixel,
    renderPlan,
    roomModal
  ]);
  const roomModalPreview = useMemo(() => {
    if (!roomModal) return null;
    let points: { x: number; y: number }[] = [];
    if (roomModal.mode === 'create') {
      if (roomModal.kind === 'rect' && roomModal.rect) {
        const { x, y, width, height } = roomModal.rect;
        points = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height }
        ];
      } else if (roomModal.kind === 'poly') {
        points = roomModal.points || [];
      }
    } else if (roomModal.mode === 'edit' && renderPlan) {
      const room = (renderPlan.rooms || []).find((r) => r.id === roomModal.roomId);
      if (room) points = getRoomPolygon(room);
    }
    return buildRoomPreview(points);
  }, [buildRoomPreview, getRoomPolygon, renderPlan, roomModal]);
  const roomHasWalls = useMemo(() => {
    if (!roomModal || roomModal.mode !== 'edit' || !renderPlan) return false;
    return (renderPlan.objects || []).some(
      (obj) => isWallType(obj.type) && (obj as any).wallGroupId === roomModal.roomId
    );
  }, [isWallType, renderPlan, roomModal]);
  const roomWallPreview = useMemo(() => {
    if (!roomWallTypeModal) return null;
    const points = (roomWallTypeModal.segments || []).map((segment) => segment.start);
    return buildRoomPreview(points);
  }, [buildRoomPreview, roomWallTypeModal]);

  const cross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  const segmentsProperlyIntersect = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    d: { x: number; y: number }
  ) => {
    const tolerance = 0.000001;
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    const straddleAB = (c1 > tolerance && c2 < -tolerance) || (c1 < -tolerance && c2 > tolerance);
    const straddleCD = (c3 > tolerance && c4 < -tolerance) || (c3 < -tolerance && c4 > tolerance);
    return straddleAB && straddleCD;
  };

  const isPointStrictlyInsidePolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]) => {
    if (polygon.length < 3) return false;
    if (!isPointInPoly(polygon, point.x, point.y)) return false;
    const interiorTolerancePx = 0.75;
    let minDistSq = Infinity;
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const projected = projectPointToSegment(a, b, point);
      if (projected.distSq < minDistSq) minDistSq = projected.distSq;
    }
    return minDistSq > interiorTolerancePx * interiorTolerancePx;
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
        if (segmentsProperlyIntersect(a1, a2, b1, b2)) return true;
      }
    }
    for (const p of a) {
      if (isPointStrictlyInsidePolygon(p, b)) return true;
    }
    for (const p of b) {
      if (isPointStrictlyInsidePolygon(p, a)) return true;
    }
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
  }, [t]);

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
      const nextRoomId = getRoomIdAt(rooms, obj.x, obj.y);
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

  const startScaleMode = useCallback(() => {
    if (isReadOnly) return;
    dismissScaleToast();
    resetToolClickHistory();
    setScaleMode(true);
    setScaleDraft({});
    setScaleDraftPointer(null);
    setScaleModal(null);
    setScaleMetersInput('');
    setRoomDrawMode(null);
    setMeasureMode(false);
    setWallDrawMode(false);
    setQuoteMode(false);
    setQuotePoints([]);
    setQuotePointer(null);
    setPendingType(null);
    scaleToastIdRef.current = toast.info(
      t({
        it: 'Scala: clicca due punti. La linea resta orizzontale/verticale di default, tieni Shift per renderla libera.',
        en: 'Scale: click two points. The line snaps horizontal/vertical by default; hold Shift to make it free.'
      }),
      { duration: Infinity }
    );
  }, [dismissScaleToast, isReadOnly, resetToolClickHistory, t]);

  const cancelScaleMode = useCallback(() => {
    if (!scaleMode) return;
    setScaleMode(false);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleMetersInput('');
    dismissScaleToast();
    resetToolClickHistory();
    push(t({ it: 'Impostazione scala annullata', en: 'Scale setup cancelled' }), 'info');
  }, [dismissScaleToast, push, resetToolClickHistory, scaleMode, t]);

  const handleScalePoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      if (!scaleMode) return;
      if (!scaleDraft?.start) {
        setScaleDraft({ start: point });
        setScaleDraftPointer(null);
        return;
      }
      const start = scaleDraft.start;
      const resolved = resolveAxisLockedPoint(point, start, options);
      const distance = Math.hypot(resolved.x - start.x, resolved.y - start.y);
      if (!Number.isFinite(distance) || distance <= 0.0001) return;
      setScaleDraft({ start, end: resolved });
      setScaleDraftPointer(null);
      setScaleMode(false);
      setScaleMetersInput('');
      setScaleModal({ start, end: resolved, distance });
    },
    [resolveAxisLockedPoint, scaleDraft, scaleMode]
  );

  const applyScale = useCallback(() => {
    if (!scaleModal || !plan || isReadOnly) return;
    const raw = scaleMetersInput.trim().replace(',', '.');
    const meters = Number(raw);
    if (!Number.isFinite(meters) || meters <= 0) {
      push(t({ it: 'Inserisci un valore valido in metri.', en: 'Enter a valid value in meters.' }), 'danger');
      return;
    }
    const metersPerPixel = meters / scaleModal.distance;
    if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
      push(t({ it: 'Scala non valida.', en: 'Invalid scale.' }), 'danger');
      return;
    }
    const labelScaleValue = Number(planScale?.labelScale);
    const opacityValue = Number(planScale?.opacity);
    const strokeWidthValue = Number(planScale?.strokeWidth);
    const prevMeters = Number(planScale?.meters);
    const ratio = Number.isFinite(prevMeters) && prevMeters > 0 ? meters / prevMeters : 1;
    const boost = ratio > 1 ? ratio : 1;
    const clampScale = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const nextLabelScale = clampScale((Number.isFinite(labelScaleValue) ? labelScaleValue : 1) * boost, 0.6, 1.8);
    const nextStrokeWidth = clampScale((Number.isFinite(strokeWidthValue) ? strokeWidthValue : 1.2) * boost, 0.6, 6);
    markTouched();
    updateFloorPlan(plan.id, {
      scale: {
        start: scaleModal.start,
        end: scaleModal.end,
        meters,
        metersPerPixel,
        labelScale: nextLabelScale,
        opacity: Number.isFinite(opacityValue) ? opacityValue : 1,
        strokeWidth: nextStrokeWidth
      }
    });
    if (Array.isArray(plan.rooms) && plan.rooms.length) {
      plan.rooms.forEach((room) => {
        const surfaceSqm = computeRoomSurfaceSqm(room, metersPerPixel);
        updateRoom(plan.id, room.id, { surfaceSqm });
      });
    }
    dismissScaleToast();
    push(
      t({
        it: 'Scala impostata: superfici delle stanze aggiornate automaticamente e non modificabili manualmente.',
        en: 'Scale set: room surfaces have been updated automatically and are no longer editable.'
      }),
      'info'
    );
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setShowScaleLine(true);
    setScaleModal(null);
    push(t({ it: 'Scala impostata correttamente', en: 'Scale saved successfully' }), 'success');
  }, [
    computeRoomSurfaceSqm,
    dismissScaleToast,
    isReadOnly,
    markTouched,
    plan,
    planScale?.labelScale,
    planScale?.opacity,
    planScale?.strokeWidth,
    push,
    scaleMetersInput,
    scaleModal,
    t,
    updateFloorPlan,
    updateRoom
  ]);

  const clearScaleNow = useCallback(() => {
    if (!plan || isReadOnly) return;
    markTouched();
    updateFloorPlan(plan.id, { scale: undefined });
    setScaleMode(false);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleMetersInput('');
    setShowScaleLine(false);
    setScaleModal(null);
    dismissScaleToast();
    push(t({ it: 'Scala rimossa', en: 'Scale cleared' }), 'success');
  }, [dismissScaleToast, isReadOnly, markTouched, plan, push, t, updateFloorPlan]);

  const requestClearScale = useCallback(() => {
    if (!plan || isReadOnly) return;
    setClearScaleConfirmOpen(true);
  }, [isReadOnly, plan]);

  const closeScaleModal = useCallback(() => {
    setScaleModal(null);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleMetersInput('');
    dismissScaleToast();
  }, [dismissScaleToast]);

  const startWallDraw = useCallback(
    (typeId?: string) => {
      if (isReadOnly) return;
      dismissScaleToast();
      resetToolClickHistory();
      const resolved = (typeId && isWallType(typeId) ? typeId : wallDrawType) || wallTypeDefs[0]?.id || DEFAULT_WALL_TYPES[0];
      if (!resolved) return;
      setWallDrawType(resolved);
      setWallDrawMode(true);
      setWallDraftPoints([]);
      wallDraftPointsRef.current = [];
      wallDraftSegmentIdsRef.current = [];
      setWallDraftPointer(null);
      setRoomDrawMode(null);
      setScaleMode(false);
      setMeasureMode(false);
      setQuoteMode(false);
      setQuotePoints([]);
      setQuotePointer(null);
      setPendingType(null);
      if (wallToastIdRef.current != null) {
        toast.dismiss(wallToastIdRef.current);
      }
      wallToastIdRef.current = toast.info(
        lang === 'it' ? (
          <span>
            Disegno muro: clicca per aggiungere angoli. <strong>Tasto destro</strong> o <strong>Invio</strong> per terminare, ESC elimina l’ultimo segmento. Se non li vedi, abilita il layer Mura.
          </span>
        ) : (
          <span>
            Wall drawing: click to add corners. <strong>Right click</strong> or <strong>Enter</strong> to finish, ESC removes the last segment. If you cannot see them, enable the Walls layer.
          </span>
        ),
        { duration: Infinity }
      );
    },
    [dismissScaleToast, isReadOnly, isWallType, lang, resetToolClickHistory, wallDrawType, wallTypeDefs]
  );

  const finishWallDraw = useCallback(
    (options?: { cancel?: boolean }) => {
      if (!wallDrawMode) return;
      setWallDrawMode(false);
      setWallDraftPoints([]);
      wallDraftPointsRef.current = [];
      wallDraftSegmentIdsRef.current = [];
      setWallDraftPointer(null);
      resetToolClickHistory();
      if (wallToastIdRef.current != null) {
        toast.dismiss(wallToastIdRef.current);
        wallToastIdRef.current = null;
      }
      if (options?.cancel) {
        push(t({ it: 'Disegno muro annullato', en: 'Wall drawing cancelled' }), 'info');
      }
    },
    [push, resetToolClickHistory, t, wallDrawMode]
  );

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
    }) => {
      if (!renderPlan) return null;
      const layerIds = payload.layerIds || inferDefaultLayerIds(payload.typeId, layerIdSet);
      const id = addObject(
        renderPlan.id,
        payload.typeId,
        payload.label,
        undefined,
        payload.start.x,
        payload.start.y,
        1,
        layerIds,
        {
          points: [payload.start, payload.end],
          strokeColor: payload.strokeColor || getWallTypeColor(payload.typeId),
          opacity: Number.isFinite(payload.opacity) ? payload.opacity : 1,
          strokeWidth: Number.isFinite(payload.strokeWidth) ? payload.strokeWidth : 1
        }
      );
      ensureObjectLayerVisible(layerIds, payload.label, payload.typeId);
      return id;
    },
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
    (point: { x: number; y: number }, options?: { shiftKey?: boolean; avoidPoint?: { x: number; y: number } | null; avoidDistance?: number }) => {
      const anchor = wallDraftPointsRef.current.length
        ? wallDraftPointsRef.current[wallDraftPointsRef.current.length - 1]
        : null;
      const closeThreshold = 12 / Math.max(0.2, zoom || 1);
      let axisLock: 'x' | 'y' | null = null;
      let next = { ...point };
      if (!options?.shiftKey && anchor) {
        const dx = point.x - anchor.x;
        const dy = point.y - anchor.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
          axisLock = 'y';
          next.y = anchor.y;
        } else {
          axisLock = 'x';
          next.x = anchor.x;
        }
      }
      let best: { x: number; y: number } | null = null;
      let bestDist = Infinity;
      for (const snap of wallSnapPoints) {
        if (options?.avoidPoint && Number.isFinite(options?.avoidDistance)) {
          const avoidDist = Math.hypot(snap.x - options.avoidPoint.x, snap.y - options.avoidPoint.y);
          if (avoidDist <= (options.avoidDistance as number)) continue;
        }
        if (axisLock === 'x' && Math.abs(snap.x - next.x) > closeThreshold) continue;
        if (axisLock === 'y' && Math.abs(snap.y - next.y) > closeThreshold) continue;
        const dist = Math.hypot(snap.x - next.x, snap.y - next.y);
        if (dist <= closeThreshold && dist < bestDist) {
          best = snap;
          bestDist = dist;
        }
      }
      if (best) next = best;
      return next;
    },
    [wallSnapPoints, zoom]
  );

  const splitWallAtPoint = useCallback(
    (payload: { id: string; point?: { x: number; y: number } }) => {
      if (isReadOnly || !renderPlan) return;
      const wall = renderPlan.objects.find((obj) => obj.id === payload.id);
      if (!wall || !isWallType(wall.type)) return;
      const pts = wall.points || [];
      if (pts.length < 2) return;
      const start = pts[0];
      const end = pts[pts.length - 1];
      const fallbackPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const rawPoint = payload.point && Number.isFinite(payload.point.x) && Number.isFinite(payload.point.y) ? payload.point : fallbackPoint;
      const projected = projectPointOnSegment(rawPoint, start, end);
      const minDistance = 6 / Math.max(0.2, zoom || 1);
      if (
        Math.hypot(projected.x - start.x, projected.y - start.y) <= minDistance ||
        Math.hypot(projected.x - end.x, projected.y - end.y) <= minDistance
      ) {
        return;
      }
      const typeId = wall.type;
      const label = String(wall.name || getTypeLabel(typeId));
      const layerIds = Array.isArray((wall as any).layerIds)
        ? (wall as any).layerIds
        : inferDefaultLayerIds(typeId, layerIdSet);
      const strokeColor =
        typeof wall.strokeColor === 'string' && wall.strokeColor.trim()
          ? wall.strokeColor.trim()
          : getWallTypeColor(typeId);
      const opacity = Number.isFinite(Number(wall.opacity)) ? Number(wall.opacity) : 1;
      const strokeWidth = Number.isFinite(Number(wall.strokeWidth)) ? Number(wall.strokeWidth) : 1;
      markTouched();
      deleteObject(wall.id);
      const firstId = addWallSegment({
        start,
        end: projected,
        typeId,
        label,
        layerIds,
        strokeColor,
        opacity,
        strokeWidth
      });
      const secondId = addWallSegment({
        start: projected,
        end,
        typeId,
        label,
        layerIds,
        strokeColor,
        opacity,
        strokeWidth
      });
      const nextId = firstId || secondId;
      if (nextId) {
        lastInsertedRef.current = { id: nextId, name: label };
        setSelectedObject(nextId);
      }
    },
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

  const handleWallPoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      if (!wallDrawMode) return;
      const draftPoints = wallDraftPointsRef.current;
      const start = draftPoints[0];
      const closeThreshold = 6 / Math.max(0.2, zoom || 1);
      const distToStartRaw = start ? Math.hypot(point.x - start.x, point.y - start.y) : Infinity;
      const shouldClose = draftPoints.length >= 3 && start && distToStartRaw <= closeThreshold;
      const avoidPoint = start && !shouldClose ? start : null;
      const resolved = resolveWallPoint(point, { ...options, avoidPoint, avoidDistance: closeThreshold });
      if (!draftPoints.length) {
        const nextPoints = [resolved];
        wallDraftPointsRef.current = nextPoints;
        setWallDraftPoints(nextPoints);
        setWallDraftPointer(null);
        return;
      }
      const last = draftPoints[draftPoints.length - 1];
      const minSegment = 2 / Math.max(0.2, zoom || 1);
      const distToLast = Math.hypot(resolved.x - last.x, resolved.y - last.y);
      if (distToLast <= minSegment) return;
      const typeId = (wallDrawType && isWallType(wallDrawType) ? wallDrawType : wallTypeDefs[0]?.id) || DEFAULT_WALL_TYPES[0];
      if (!typeId || !renderPlan) return;
      const endPoint = shouldClose && start ? start : resolved;
      markTouched();
      const label = getTypeLabel(typeId);
      const id = addWallSegment({
        start: last,
        end: endPoint,
        typeId,
        label,
        strokeWidth: 1
      });
      if (id) {
        wallDraftSegmentIdsRef.current.push(id);
        lastInsertedRef.current = { id, name: label };
      }
      const points = [...draftPoints, endPoint];
      wallDraftPointsRef.current = points;
      setWallDraftPoints(points);
      setWallDraftPointer(null);
      if (shouldClose) {
        finishWallDraw();
      }
    },
    [
      addWallSegment,
      finishWallDraw,
      getTypeLabel,
      isWallType,
      markTouched,
      renderPlan,
      resolveWallPoint,
      wallDrawMode,
      wallDrawType,
      wallTypeDefs,
      zoom
    ]
  );

  const startMeasure = useCallback(
    (point?: { x: number; y: number }) => {
      if (!metersPerPixel) {
        push(t({ it: 'Imposta la scala prima di misurare.', en: 'Set the scale before measuring.' }), 'info');
        return;
      }
      setMeasureMode(true);
      const nextPoints = point ? [point] : [];
      measurePointsRef.current = nextPoints;
      setMeasurePoints(nextPoints);
      setMeasurePointer(null);
      setMeasureClosed(false);
      setMeasureFinished(false);
      measureClosedRef.current = false;
      measureFinishedRef.current = false;
      setQuoteMode(false);
      setQuotePoints([]);
      setQuotePointer(null);
      setRoomDrawMode(null);
      setScaleMode(false);
      setWallDrawMode(false);
      setPendingType(null);
      showMeasureToast(nextPoints, { closed: false, finished: false });
    },
    [metersPerPixel, push, showMeasureToast, t]
  );

  const stopMeasure = useCallback(() => {
    if (!measureMode) return;
    dismissMeasureToast();
    setMeasureMode(false);
    setMeasurePoints([]);
    setMeasurePointer(null);
    setMeasureClosed(false);
    setMeasureFinished(false);
    measurePointsRef.current = [];
    measureClosedRef.current = false;
    measureFinishedRef.current = false;
    push(t({ it: 'Misurazione annullata', en: 'Measurement cancelled' }), 'info');
  }, [dismissMeasureToast, measureMode, push, t]);

  useEffect(() => {
    if (!measureMode) dismissMeasureToast();
  }, [dismissMeasureToast, measureMode]);

  const startQuote = useCallback(
    (point?: { x: number; y: number }) => {
      if (!metersPerPixel) {
        push(t({ it: 'Imposta la scala prima di creare quote.', en: 'Set the scale before creating quotes.' }), 'info');
        return;
      }
      if (isReadOnly) return;
      setQuoteMode(true);
      setQuotePoints(point ? [point] : []);
      setQuotePointer(null);
      setRoomDrawMode(null);
      setScaleMode(false);
      setWallDrawMode(false);
      setMeasureMode(false);
      setPendingType(null);
      push(t({ it: 'Quota: clicca due punti per fissare la misura.', en: 'Quote: click two points to fix the measurement.' }), 'info');
    },
    [isReadOnly, metersPerPixel, push, t]
  );

  const stopQuote = useCallback(() => {
    if (!quoteMode) return;
    setQuoteMode(false);
    setQuotePoints([]);
    setQuotePointer(null);
    push(t({ it: 'Quota annullata', en: 'Quote cancelled' }), 'info');
  }, [quoteMode, push, t]);

  const handleQuotePoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      if (!quoteMode || isReadOnly || !renderPlan) return;
      if (!quotePoints.length) {
        setQuotePoints([point]);
        return;
      }
      const start = quotePoints[0];
      const resolved = resolveAxisLockedPoint(point, start, options);
      const dist = Math.hypot(resolved.x - start.x, resolved.y - start.y);
      const minSegment = 6 / Math.max(0.2, zoom || 1);
      if (dist < minSegment) return;
      const quoteScale = Math.max(0.5, Math.min(1.6, Number(lastQuoteScale) || 1));
      const orientation = getQuoteOrientation([start, resolved]);
      const quoteLabelPos = orientation === 'vertical' ? lastQuoteLabelPosV : lastQuoteLabelPosH;
      const quoteColor = lastQuoteColor || '#f97316';
      const quoteLabelScale = Math.max(0.6, Math.min(2, Number(lastQuoteLabelScale) || 1));
      const quoteLabelBg = quoteLabelPos === 'center' || lastQuoteLabelBg === true;
      const quoteLabelColor = lastQuoteLabelColor || '#0f172a';
      const quoteLabelOffset = 1;
      const quoteDashed = !!lastQuoteDashed;
      const quoteEndpoint = lastQuoteEndpoint || 'arrows';
      markTouched();
      addObject(
        renderPlan.id,
        'quote',
        '',
        undefined,
        start.x,
        start.y,
        quoteScale,
        ['quotes'],
        {
          points: [start, resolved],
          strokeColor: quoteColor,
          strokeWidth: 2,
          opacity: 1,
          quoteLabelPos,
          quoteLabelScale,
          quoteLabelBg,
          quoteLabelColor,
          quoteLabelOffset,
          quoteDashed,
          quoteEndpoint
        }
      );
      ensureObjectLayerVisible(['quotes'], getTypeLabel('quote'), 'quote');
      setQuotePoints([]);
      setQuotePointer(null);
    },
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
    if (!measureMode) return;
    if (isReadOnly || !renderPlan) {
      push(t({ it: 'Non puoi creare quote in sola lettura.', en: 'You cannot create quotes in read-only mode.' }), 'info');
      return;
    }
    const points = [...measurePointsRef.current];
    const closed = !!measureClosedRef.current;
    const segments: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      segments.push({ start: points[i], end: points[i + 1] });
    }
    if (closed && points.length > 2) {
      segments.push({ start: points[points.length - 1], end: points[0] });
    }
    if (!segments.length) {
      push(t({ it: 'Aggiungi almeno due punti per convertire in quote.', en: 'Add at least two points to convert into quotes.' }), 'info');
      return;
    }
    const minSegment = 6 / Math.max(0.2, zoom || 1);
    const quoteScale = Math.max(0.5, Math.min(1.6, Number(lastQuoteScale) || 1));
    const quoteColor = lastQuoteColor || '#f97316';
    const quoteLabelScale = Math.max(0.6, Math.min(2, Number(lastQuoteLabelScale) || 1));
    const quoteLabelColor = lastQuoteLabelColor || '#0f172a';
    const quoteLabelOffset = 1;
    const quoteDashed = !!lastQuoteDashed;
    const quoteEndpoint = lastQuoteEndpoint || 'arrows';
    let created = 0;
    markTouched();
    for (const segment of segments) {
      const distance = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
      if (distance < minSegment) continue;
      const orientation = getQuoteOrientation([segment.start, segment.end]);
      const quoteLabelPos = orientation === 'vertical' ? lastQuoteLabelPosV : lastQuoteLabelPosH;
      const quoteLabelBg = quoteLabelPos === 'center' || lastQuoteLabelBg === true;
      addObject(
        renderPlan.id,
        'quote',
        '',
        undefined,
        segment.start.x,
        segment.start.y,
        quoteScale,
        inferDefaultLayerIds('quote', layerIdSet),
        {
          points: [segment.start, segment.end],
          strokeColor: quoteColor,
          strokeWidth: 2,
          opacity: 1,
          quoteLabelPos,
          quoteLabelScale,
          quoteLabelBg,
          quoteLabelColor,
          quoteLabelOffset,
          quoteDashed,
          quoteEndpoint
        }
      );
      created += 1;
    }
    if (!created) {
      push(t({ it: 'Nessun lato valido da convertire in quota.', en: 'No valid side to convert into quote.' }), 'info');
      return;
    }
    ensureObjectLayerVisible(['quotes'], getTypeLabel('quote'), 'quote');
    setMeasureMode(false);
    setMeasurePoints([]);
    setMeasurePointer(null);
    setMeasureClosed(false);
    setMeasureFinished(false);
    measurePointsRef.current = [];
    measureClosedRef.current = false;
    measureFinishedRef.current = false;
    dismissMeasureToast();
    push(
      t({
        it: `Quote create dalla misurazione: ${created}.`,
        en: `Quotes created from measurement: ${created}.`
      }),
      'success'
    );
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

  const handleMeasurePoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      if (!measureMode || measureFinishedRef.current) return;
      const points = measurePointsRef.current;
      if (!points.length) {
        const next = [point];
        measurePointsRef.current = next;
        setMeasurePoints(next);
        showMeasureToast(next, { closed: false, finished: false });
        return;
      }
      const anchor = points[points.length - 1];
      const resolved = resolveAxisLockedPoint(point, anchor, options);
      const minSegment = 6 / Math.max(0.2, zoom || 1);
      if (Math.hypot(resolved.x - anchor.x, resolved.y - anchor.y) < minSegment) return;
      const closeThreshold = 12 / Math.max(0.2, zoom || 1);
      if (points.length >= 3) {
        const first = points[0];
        const dist = Math.hypot(point.x - first.x, point.y - first.y);
        if (dist <= closeThreshold) {
          setMeasureClosed(true);
          setMeasureFinished(true);
          measureClosedRef.current = true;
          measureFinishedRef.current = true;
          setMeasurePointer(null);
          showMeasureToast(points, { closed: true, finished: true });
          return;
        }
      }
      const next = [...points, resolved];
      measurePointsRef.current = next;
      setMeasurePoints(next);
      showMeasureToast(next, { closed: false, finished: false });
    },
    [measureMode, resolveAxisLockedPoint, showMeasureToast, zoom]
  );

  const handleToolPoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      if (scaleMode) {
        handleScalePoint(point, options);
        return;
      }
      if (wallDrawMode) {
        handleWallPoint(point, options);
        return;
      }
      if (quoteMode) {
        handleQuotePoint(point, options);
        return;
      }
      if (measureMode) {
        handleMeasurePoint(point, options);
      }
    },
    [handleMeasurePoint, handleQuotePoint, handleScalePoint, handleWallPoint, measureMode, quoteMode, scaleMode, wallDrawMode]
  );

  const handleToolMove = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      if (scaleMode && scaleDraft?.start && !scaleDraft?.end) {
        setScaleDraftPointer(resolveAxisLockedPoint(point, scaleDraft.start, options));
        return;
      }
      if (wallDrawMode) {
        const draftPoints = wallDraftPointsRef.current;
        const start = draftPoints[0];
        const closeThreshold = 6 / Math.max(0.2, zoom || 1);
        const distToStartRaw = start ? Math.hypot(point.x - start.x, point.y - start.y) : Infinity;
        const shouldClose = draftPoints.length >= 3 && start && distToStartRaw <= closeThreshold;
        const avoidPoint = start && !shouldClose ? start : null;
        const resolved = resolveWallPoint(point, { ...options, avoidPoint, avoidDistance: closeThreshold });
        if (shouldClose && start) {
          setWallDraftPointer(start);
          return;
        }
        setWallDraftPointer(resolved);
        return;
      }
      if (quoteMode) {
        if (quotePoints.length && !isReadOnly) {
          setQuotePointer(resolveAxisLockedPoint(point, quotePoints[0], options));
        }
        return;
      }
      if (measureMode) {
        if (measureFinishedRef.current) return;
        const points = measurePointsRef.current;
        const anchor = points.length ? points[points.length - 1] : null;
        const resolved = resolveAxisLockedPoint(point, anchor, options);
        if (points.length >= 3) {
          const first = points[0];
          const closeThreshold = 12 / Math.max(0.2, zoom || 1);
          const dist = Math.hypot(point.x - first.x, point.y - first.y);
          if (dist <= closeThreshold) {
            setMeasurePointer(first);
            return;
          }
        }
        setMeasurePointer(resolved);
      }
    },
    [
      isReadOnly,
      measureMode,
      quoteMode,
      quotePoints,
      resolveAxisLockedPoint,
      resolveWallPoint,
      scaleDraft,
      scaleMode,
      wallDrawMode,
      zoom
    ]
  );

  const handleToolDoubleClick = useCallback(() => {
    if (measureMode) {
      if (measureClosedRef.current) {
        setMeasureFinished(true);
        measureFinishedRef.current = true;
        setMeasurePointer(null);
        showMeasureToast(measurePointsRef.current, { closed: true, finished: true });
      }
      return;
    }
  }, [measureMode, showMeasureToast]);

  const handleWallDraftContextMenu = useCallback(() => {
    if (!wallDrawMode) return;
    setContextMenu(null);
    if (wallDraftSegmentIdsRef.current.length || wallDraftPointsRef.current.length >= 2) {
      finishWallDraw();
    } else {
      finishWallDraw({ cancel: true });
    }
  }, [finishWallDraw, wallDrawMode]);

  const handleWallSegmentDblClick = useCallback(
    (payload: { id: string; lengthPx: number }) => {
      const lengthPx = Number(payload?.lengthPx);
      if (!Number.isFinite(lengthPx) || lengthPx <= 0) return;
      if (metersPerPixel) {
        const meters = lengthPx * metersPerPixel;
        const unit = lang === 'it' ? 'ml' : 'm';
        push(
          t({
            it: `Lunghezza lato: ${formatNumber(meters)} ${unit}`,
            en: `Wall side length: ${formatNumber(meters)} ${unit}`
          }),
          'info'
        );
        return;
      }
      push(
        t({
          it: `Lunghezza lato: ${formatNumber(lengthPx)} px`,
          en: `Wall side length: ${formatNumber(lengthPx)} px`
        }),
        'info'
      );
    },
    [formatNumber, lang, metersPerPixel, push, t]
  );

  const applyWallTypeToIds = useCallback(
    (ids: string[], typeId: string) => {
      if (!ids.length || !typeId || !isWallType(typeId) || isReadOnly) return;
      const nextLabel = getTypeLabel(typeId);
      const nextColor = getWallTypeColor(typeId);
      markTouched();
      for (const id of ids) {
        updateObject(id, { type: typeId, name: nextLabel, strokeColor: nextColor });
      }
      push(
        ids.length > 1
          ? t({ it: 'Muri aggiornati', en: 'Walls updated' })
          : t({ it: 'Muro aggiornato', en: 'Wall updated' }),
        'success'
      );
    },
    [getTypeLabel, getWallTypeColor, isReadOnly, isWallType, markTouched, push, t, updateObject]
  );

  const applyWallType = useCallback(() => {
    if (!wallTypeModal || !wallTypeDraft) return;
    applyWallTypeToIds(wallTypeModal.ids, wallTypeDraft);
    setWallTypeModal(null);
  }, [applyWallTypeToIds, wallTypeDraft, wallTypeModal]);

  const setRoomWallTypeAt = useCallback((index: number, typeId: string) => {
    setRoomWallTypeSelections((prev) => {
      const next = prev.slice();
      next[index] = typeId;
      return next;
    });
  }, []);

  const applyRoomWallTypeAll = useCallback(
    (typeId: string) => {
      if (!roomWallTypeModal) return;
      setRoomWallTypeSelections(roomWallTypeModal.segments.map(() => typeId));
    },
    [roomWallTypeModal]
  );

  const createRoomWalls = useCallback(() => {
    if (!roomWallTypeModal || isReadOnly || !renderPlan) return;
    const segments = roomWallTypeModal.segments;
    if (!segments.length) {
      setRoomWallTypeModal(null);
      return;
    }
    markTouched();
    const sampleTypeId = roomWallTypeSelections.find(Boolean) || defaultWallTypeId || DEFAULT_WALL_TYPES[0];
    if (sampleTypeId) {
      ensureObjectLayerVisible(inferDefaultLayerIds(sampleTypeId, layerIdSet), getTypeLabel(sampleTypeId), sampleTypeId);
    }
    if (roomWallTypeModal.mode === 'edit') {
      const wallIds = roomWallTypeModal.wallIds || [];
      segments.forEach((_, index) => {
        const wallId = wallIds[index];
        if (!wallId) return;
        const typeId = roomWallTypeSelections[index] || defaultWallTypeId || DEFAULT_WALL_TYPES[0];
        if (!typeId) return;
        updateObject(wallId, { type: typeId, name: getTypeLabel(typeId), strokeColor: getWallTypeColor(typeId) });
      });
      push(t({ it: 'Muri aggiornati', en: 'Walls updated' }), 'success');
      setRoomWallTypeModal(null);
      return;
    }
    segments.forEach((segment, index) => {
      const typeId = roomWallTypeSelections[index] || defaultWallTypeId || DEFAULT_WALL_TYPES[0];
      if (!typeId) return;
      const label = getTypeLabel(typeId);
      addObject(
        renderPlan.id,
        typeId,
        label,
        undefined,
        segment.start.x,
        segment.start.y,
        1,
        inferDefaultLayerIds(typeId, layerIdSet),
        {
          points: [segment.start, segment.end],
          strokeColor: getWallTypeColor(typeId),
          opacity: 1,
          strokeWidth: 1,
          wallGroupId: roomWallTypeModal.roomId,
          wallGroupIndex: index
        }
      );
    });
    push(
      t({ it: 'Muri stanza creati', en: 'Room walls created' }),
      'success'
    );
    setRoomWallTypeModal(null);
  }, [
    addObject,
    defaultWallTypeId,
    ensureObjectLayerVisible,
    getTypeLabel,
    getWallTypeColor,
    inferDefaultLayerIds,
    isReadOnly,
    layerIdSet,
    markTouched,
    push,
    renderPlan,
    roomWallTypeModal,
    roomWallTypeSelections,
    t,
    updateObject
  ]);

	  useEffect(() => {
	    const handler = (e: KeyboardEvent) => {
	      if ((useUIStore.getState() as any)?.clientChatOpen) return;
	      const target = e.target as HTMLElement | null;
	      const tag = target?.tagName?.toLowerCase();
	      const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;

      const currentConfirm = confirmDeleteRef.current;
      const currentSelectedIds = selectedObjectIdsRef.current;
      const currentPlan = planRef.current;
      const hasBlockingModal = !!corridorModal || !!corridorConnectionModal || !!corridorDoorModal || !!corridorDoorLinkModal;
      const hasObjectSearchModal = !!allTypesOpen;

      // While the "All objects" search modal is open, do not trigger plan keyboard shortcuts.
      // Let keys flow to the modal (including Enter / Escape) without interception here.
      if (hasObjectSearchModal) return;

      if (hasBlockingModal && e.key === 'Escape') {
        e.preventDefault();
        if (corridorDoorLinkModal) setCorridorDoorLinkModal(null);
        else if (corridorDoorModal) setCorridorDoorModal(null);
        else if (corridorConnectionModal) setCorridorConnectionModal(null);
        else if (corridorModal) setCorridorModal(null);
        return;
      }
      if (hasBlockingModal) return;

      if (scaleMode && e.key === 'Escape') {
        e.preventDefault();
        cancelScaleMode();
        return;
      }

      if (wallDrawMode && e.key === 'Escape') {
        e.preventDefault();
        const ids = wallDraftSegmentIdsRef.current;
        if (ids.length) {
          const lastId = ids.pop();
          if (lastId) {
            markTouched();
            deleteObject(lastId);
          }
          const next = wallDraftPointsRef.current.slice(0, -1);
          wallDraftPointsRef.current = next;
          setWallDraftPoints(next);
          setWallDraftPointer(null);
        } else {
          finishWallDraw({ cancel: true });
        }
        return;
      }

      if (!isTyping && wallDrawMode && e.key === 'Enter') {
        e.preventDefault();
        finishWallDraw();
        return;
      }

      if (measureMode && e.key === 'Escape') {
        e.preventDefault();
        stopMeasure();
        return;
      }

      if (quoteMode && e.key === 'Escape') {
        e.preventDefault();
        stopQuote();
        return;
      }

      if (!isTyping && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (measureMode) {
          stopMeasure();
        } else {
          startMeasure();
        }
        return;
      }

	      if (!isTyping && measureMode && e.key.toLowerCase() === 'q') {
	        e.preventDefault();
	        convertMeasurementToQuotes();
	        return;
	      }

	      if (!isTyping && e.key.toLowerCase() === 'q') {
	        e.preventDefault();
	        if (quoteMode) {
	          stopQuote();
	        } else {
	          startQuote();
	        }
	        return;
	      }

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

      if (!isTyping && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (wallDrawMode) {
          finishWallDraw();
        } else {
          startWallDraw();
        }
        return;
      }

      if (!isTyping && wallDrawMode && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        const ids = wallDraftSegmentIdsRef.current;
        if (ids.length) {
          const lastId = ids.pop();
          if (lastId) {
            markTouched();
            deleteObject(lastId);
          }
          const next = wallDraftPointsRef.current.slice(0, -1);
          wallDraftPointsRef.current = next;
          setWallDraftPoints(next);
          setWallDraftPointer(null);
        } else {
          finishWallDraw({ cancel: true });
        }
        return;
      }

      if (!isTyping && measureMode && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        setMeasureClosed(false);
        setMeasureFinished(false);
        measureClosedRef.current = false;
        measureFinishedRef.current = false;
        const next = measurePointsRef.current.slice(0, -1);
        measurePointsRef.current = next;
        setMeasurePoints(next);
        showMeasureToast(next, { closed: false, finished: false });
        return;
      }

      if (!isTyping && quoteMode && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        setQuotePoints((prev) => prev.slice(0, -1));
        setQuotePointer(null);
        return;
      }

      if (!isTyping && measureMode && e.key === 'Enter') {
        e.preventDefault();
        setMeasureFinished(true);
        measureFinishedRef.current = true;
        setMeasurePointer(null);
        showMeasureToast(measurePointsRef.current, { closed: measureClosedRef.current, finished: true });
        return;
      }

      if (roomDrawMode && e.key === 'Escape') {
        e.preventDefault();
        setRoomDrawMode(null);
        push(t({ it: 'Disegno stanza annullato', en: 'Room drawing cancelled' }), 'info');
        return;
      }

      if (corridorDrawMode && e.key === 'Escape') {
        e.preventDefault();
        setCorridorDrawMode(null);
        push(t({ it: 'Disegno corridoio annullato', en: 'Corridor drawing cancelled' }), 'info');
        return;
      }

      if (corridorDoorDraft && e.key === 'Escape') {
        e.preventDefault();
        setCorridorDoorDraft(null);
        push(t({ it: 'Disegno porta corridoio annullato', en: 'Corridor door drawing cancelled' }), 'info');
        return;
      }

      if (roomDoorDraft && e.key === 'Escape') {
        e.preventDefault();
        setRoomDoorDraft(null);
        push(t({ it: 'Inserimento porta di collegamento annullato', en: 'Connecting door placement cancelled' }), 'info');
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
        if (saveRevisionOpen) {
          e.preventDefault();
          return;
        }
        if (!currentPlan || isReadOnlyRef.current) return;
        if (!getPlanUnsavedChanges(currentPlan as FloorPlan)) {
          e.preventDefault();
          push(t({ it: 'Nessuna modifica da salvare', en: 'No changes to save' }), 'info');
          return;
        }
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

      const isArrowLeft = e.key === 'ArrowLeft' || e.code === 'ArrowLeft';
      const isArrowRight = e.key === 'ArrowRight' || e.code === 'ArrowRight';
      const isArrowUp = e.key === 'ArrowUp' || e.code === 'ArrowUp';
      const isArrowDown = e.key === 'ArrowDown' || e.code === 'ArrowDown';
      const isArrow = isArrowUp || isArrowDown || isArrowLeft || isArrowRight;
      const isCtrlArrow = (e.ctrlKey || e.metaKey) && isArrow;
      if (isCtrlArrow) {
        const ids = currentSelectedIds.length
          ? currentSelectedIds
          : (selectedObjectIdRef.current ? [selectedObjectIdRef.current] : []);
        if (!ids.length || !currentPlan || isReadOnlyRef.current) return;
        const quoteObjs = ids
          .map((id) => (currentPlan as FloorPlan).objects?.find((o) => o.id === id))
          .filter((obj): obj is MapObject => !!obj && obj.type === 'quote');
        if (quoteObjs.length) {
          e.preventDefault();
          markTouched();
          for (const obj of quoteObjs) {
            const orientation = getQuoteOrientation(obj.points);
            const currentRaw = String((obj as any)?.quoteLabelPos || 'center');
            const currentPos =
              orientation === 'vertical'
                ? (currentRaw === 'left' || currentRaw === 'right' || currentRaw === 'center' ? currentRaw : 'center')
                : (currentRaw === 'above' || currentRaw === 'below' || currentRaw === 'center' ? currentRaw : 'center');
            let nextPos: 'center' | 'above' | 'below' | 'left' | 'right' | null = null;
            if (orientation === 'vertical') {
              if (isArrowLeft) {
                if (currentPos === 'right') nextPos = 'center';
                else if (currentPos === 'center') nextPos = 'left';
                else nextPos = 'left';
              } else if (isArrowRight) {
                if (currentPos === 'left') nextPos = 'center';
                else if (currentPos === 'center') nextPos = 'right';
                else nextPos = 'right';
              } else if (isArrowUp || isArrowDown) {
                nextPos = 'center';
              }
            } else {
              if (isArrowUp) {
                if (currentPos === 'below') nextPos = 'center';
                else if (currentPos === 'center') nextPos = 'above';
                else nextPos = 'above';
              } else if (isArrowDown) {
                if (currentPos === 'above') nextPos = 'center';
                else if (currentPos === 'center') nextPos = 'below';
                else nextPos = 'below';
              } else if (isArrowLeft || isArrowRight) {
                nextPos = 'center';
              }
            }
            if (nextPos) updateQuoteLabelPos(obj.id, nextPos, orientation);
          }
          return;
        }
      }
      const isRotateShortcut = (e.ctrlKey || e.metaKey) && (isArrowLeft || isArrowRight);
      if (isRotateShortcut) {
        if (!currentSelectedIds.length || !currentPlan) return;
        if (isReadOnlyRef.current) return;
        const rotatable = currentSelectedIds
          .map((id) => (currentPlan as FloorPlan).objects?.find((o) => o.id === id))
          .filter(
            (obj): obj is MapObject =>
              !!obj &&
              (isDeskType(obj.type) || isCameraType(obj.type) || obj.type === 'text' || obj.type === 'image' || obj.type === 'photo')
          );
        if (!rotatable.length) return;
        e.preventDefault();
        markTouched();
        const delta = isArrowLeft ? -90 : 90;
        for (const obj of rotatable) {
          const current = Number(obj.rotation || 0);
          updateObject(obj.id, { rotation: (current + delta + 360) % 360 });
        }
        return;
      }

      if (isTyping) return;

      const key = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'e') {
        if (!currentPlan || isReadOnlyRef.current) return;
        if (currentSelectedIds.length) {
          if (currentSelectedIds.length !== 1) return;
          const targetId = currentSelectedIds[0];
          const obj = (currentPlan as FloorPlan).objects?.find((o) => o.id === targetId);
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
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'b' && !e.shiftKey) {
        if (!currentSelectedIds.length || !currentPlan || isReadOnlyRef.current) return;
        const textObjs = currentSelectedIds
          .map((id) => (currentPlan as FloorPlan).objects?.find((o) => o.id === id))
          .filter((obj): obj is MapObject => !!obj && obj.type === 'text');
        if (!textObjs.length) return;
        e.preventDefault();
        markTouched();
        for (const obj of textObjs) {
          const current = !!(obj as any).textBg;
          updateObject(obj.id, { textBg: !current });
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (key === 'f' || (key === 'b' && e.shiftKey))) {
        if (!currentSelectedIds.length || !currentPlan || isReadOnlyRef.current) return;
        const textObjs = currentSelectedIds
          .map((id) => (currentPlan as FloorPlan).objects?.find((o) => o.id === id))
          .filter((obj): obj is MapObject => !!obj && obj.type === 'text');
        if (!textObjs.length) return;
        e.preventDefault();
        markTouched();
        const fontValues = TEXT_FONT_OPTIONS.map((opt) => opt.value);
        if (!fontValues.length) return;
        const delta = key === 'f' ? 1 : -1;
        for (const obj of textObjs) {
          const currentFont = String((obj as any).textFont || fontValues[0]);
          const currentIndex = fontValues.indexOf(currentFont);
          const safeIndex = currentIndex >= 0 ? currentIndex : 0;
          const nextFont = fontValues[(safeIndex + delta + fontValues.length) % fontValues.length];
          updateObject(obj.id, { textFont: nextFont });
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'c') {
        if (!currentSelectedIds.length || !currentPlan || isReadOnlyRef.current) return;
        const textObjs = currentSelectedIds
          .map((id) => (currentPlan as FloorPlan).objects?.find((o) => o.id === id))
          .filter((obj): obj is MapObject => !!obj && obj.type === 'text');
        if (!textObjs.length) return;
        e.preventDefault();
        markTouched();
        const colorValues = TEXT_COLOR_OPTIONS.map((opt) => opt.value);
        if (!colorValues.length) return;
        const delta = e.shiftKey ? -1 : 1;
        for (const obj of textObjs) {
          const currentColor = String((obj as any).textColor || colorValues[0]).toLowerCase();
          const currentIndex = colorValues.findIndex((c) => c.toLowerCase() === currentColor);
          const safeIndex = currentIndex >= 0 ? currentIndex : 0;
          const nextColor = colorValues[(safeIndex + delta + colorValues.length) % colorValues.length];
          updateObject(obj.id, { textColor: nextColor });
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === 'l') {
        if (!currentSelectedIds.length || !currentPlan || isReadOnlyRef.current) return;
        if (currentSelectedIds.length !== 2) return;
        e.preventDefault();
        const [a, b] = currentSelectedIds;
        const objA = (currentPlan as FloorPlan).objects?.find((o) => o.id === a);
        const objB = (currentPlan as FloorPlan).objects?.find((o) => o.id === b);
        if (!objA || !objB) return;
        if (objA.type === 'photo' || objB.type === 'photo') {
          push(t({ it: 'Le foto non possono essere collegate', en: 'Photos cannot be linked' }), 'info');
          return;
        }
        if (isDeskType(objA.type) || isDeskType(objB.type)) {
          push(t({ it: 'Questi oggetti non possono essere collegati', en: 'These objects cannot be linked' }), 'info');
          return;
        }
        const links = (((currentPlan as any).links || []) as any[]).filter(Boolean);
        const existing = links.find(
          (l) =>
            (String((l as any).fromId || '') === a && String((l as any).toId || '') === b) ||
            (String((l as any).fromId || '') === b && String((l as any).toId || '') === a)
        );
        if (existing) {
          setSelectedLinkId(String(existing.id));
          push(t({ it: 'Collegamento già presente', en: 'Link already exists' }), 'info');
          return;
        }
        markTouched();
        const id = addLink((currentPlan as FloorPlan).id, a, b, { kind: 'arrow', arrow: 'none' });
        postAuditEvent({
          event: 'link_create',
          scopeType: 'plan',
          scopeId: (currentPlan as FloorPlan).id,
          details: { id, fromId: a, toId: b, kind: 'arrow' }
        });
        setSelectedLinkId(id);
        push(t({ it: 'Collegamento creato', en: 'Link created' }), 'success');
        return;
      }

	      const isScaleUp = (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') && !e.ctrlKey && !e.metaKey;
	      const isScaleDown = (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') && !e.ctrlKey && !e.metaKey;
	      if (isScaleUp || isScaleDown) {
	        if (!currentPlan) return;
	        if (isReadOnlyRef.current) return;
          const selectedRoomKey = selectedRoomIdRef.current;
          if (!currentSelectedIds.length && selectedRoomKey) {
            const room = ((currentPlan as FloorPlan).rooms || []).find((entry) => entry.id === selectedRoomKey);
            if (!room) return;
            e.preventDefault();
            markTouched();
            const step = e.shiftKey ? 0.2 : 0.1;
            const delta = isScaleUp ? step : -step;
            const currentScale = Number((room as any).labelScale ?? 1) || 1;
            const nextScale = Math.max(0.3, Math.min(3, currentScale + delta));
            updateRoom((currentPlan as FloorPlan).id, room.id, { labelScale: nextScale } as any);
            return;
          }
	        if (!currentSelectedIds.length) return;
	        e.preventDefault();
	        markTouched();
	        const step = e.shiftKey ? 0.2 : 0.1;
        const delta = isScaleUp ? step : -step;
        const fontStep = e.shiftKey ? 4 : 2;
        for (const id of currentSelectedIds) {
          const obj = (currentPlan as FloorPlan).objects?.find((o) => o.id === id);
          if (!obj || isWallType(obj.type)) continue;
          if (obj.type === 'text') {
            const currentSize = Number((obj as any).textSize ?? 18) || 18;
            const nextSize = Math.max(6, Math.min(160, currentSize + (isScaleUp ? fontStep : -fontStep)));
            updateObject(id, { textSize: nextSize });
            continue;
          }
          if (obj.type === 'image') {
            const nextScaleX = Math.max(0.2, Math.min(6, Number(obj.scaleX ?? 1) + delta));
            const nextScaleY = Math.max(0.2, Math.min(6, Number(obj.scaleY ?? 1) + delta));
            updateObject(id, { scaleX: nextScaleX, scaleY: nextScaleY });
            continue;
          }
          if (obj.type === 'photo') {
            const nextScale = Math.max(0.2, Math.min(2.4, Number(obj.scale ?? 1) + delta));
            updateObject(id, { scale: nextScale });
            continue;
          }
          const min = obj.type === 'quote' ? 0.5 : 0.2;
          const max = obj.type === 'quote' ? 1.6 : 2.4;
          const nextScale = Math.max(min, Math.min(max, Number(obj.scale ?? 1) + delta));
          updateObject(id, { scale: nextScale });
          if (obj.type === 'quote') {
            setLastQuoteScale(nextScale);
          } else {
            setLastObjectScale(nextScale);
          }
        }
        return;
      }

      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isRedo =
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));
      if (isUndo) {
        if (!currentPlan || isReadOnlyRef.current) return;
        e.preventDefault();
        if (performUndo()) return;
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
      if (isRedo) {
        if (!currentPlan || isReadOnlyRef.current) return;
        e.preventDefault();
        performRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (!currentPlan) return;
        e.preventDefault();
        const allIds = ((currentPlan as FloorPlan).objects || []).map((o) => o.id);
        const allRoomIds = ((currentPlan as FloorPlan).rooms || []).map((r) => r.id);
        setSelectedCorridorId(undefined);
        setSelectedCorridorDoor(null);
        setSelectedRoomDoorId(null);
        setSelection(allIds);
        setContextMenu(null);
        setSelectedRoomId(allRoomIds.length === 1 ? allRoomIds[0] : undefined);
        setSelectedRoomIds(allRoomIds);
        setSelectedLinkId(null);
        push(
          t({
            it: `Selezionati ${allIds.length} oggetti e ${allRoomIds.length} stanze (Ctrl/Cmd+A).`,
            en: `Selected ${allIds.length} objects and ${allRoomIds.length} rooms (Ctrl/Cmd+A).`
          }),
          'info'
        );
        return;
      }

      if (e.key === 'Escape') {
        if (photoViewer) {
          return;
        }
        if (currentSelectedIds.length || selectedRoomId || selectedRoomIds.length || selectedCorridorId || selectedCorridorDoor || selectedRoomDoorId) {
          e.preventDefault();
          setContextMenu(null);
          clearSelection();
          setSelectedRoomId(undefined);
          setSelectedRoomIds([]);
          setSelectedCorridorId(undefined);
          setSelectedCorridorDoor(null);
          setSelectedRoomDoorId(null);
          setSelectedLinkId(null);
        }
        return;
      }

	      if (isArrow) {
	        if (!currentPlan) return;
	        if (isReadOnlyRef.current) return;
          const selectedRoomKey = selectedRoomIdRef.current;
          if (!currentSelectedIds.length && selectedRoomKey && (isArrowUp || isArrowDown || isArrowLeft || isArrowRight)) {
            const room = ((currentPlan as FloorPlan).rooms || []).find((entry) => entry.id === selectedRoomKey);
            if (!room) return;
            e.preventDefault();
            markTouched();
            if (e.shiftKey) {
              const nextPos = isArrowUp ? 'top' : isArrowDown ? 'bottom' : isArrowLeft ? 'left' : 'right';
              updateRoom((currentPlan as FloorPlan).id, room.id, { labelPosition: nextPos } as any);
              return;
            }
            const z = zoomRef.current || 1;
            const step = 1 / Math.max(0.2, z);
            const dx = isArrowLeft ? -step : isArrowRight ? step : 0;
            const dy = isArrowUp ? -step : isArrowDown ? step : 0;
            const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            if (kind === 'poly') {
              const points = (room.points || []).map((p) => ({ x: Number(p.x || 0) + dx, y: Number(p.y || 0) + dy }));
              updateRoom((currentPlan as FloorPlan).id, room.id, { kind: 'poly', points } as any);
            } else {
              updateRoom((currentPlan as FloorPlan).id, room.id, {
                kind: 'rect',
                x: Number(room.x || 0) + dx,
                y: Number(room.y || 0) + dy,
                width: Number(room.width || 0),
                height: Number(room.height || 0)
              } as any);
            }
            return;
          }
	        if (!currentSelectedIds.length) return;
	        e.preventDefault();
	        const z = zoomRef.current || 1;
        const step = (e.shiftKey ? 10 : 1) / Math.max(0.2, z);
        const dx = isArrowLeft ? -step : isArrowRight ? step : 0;
        const dy = isArrowUp ? -step : isArrowDown ? step : 0;
        for (const id of currentSelectedIds) {
          const obj = (currentPlan as FloorPlan).objects?.find((o) => o.id === id);
          if (!obj || isWallType(obj.type)) continue;
          if (obj.type === 'quote') {
            const pts = Array.isArray(obj.points) ? obj.points : [];
            if (pts.length >= 2) {
              updateObject(id, {
                x: obj.x + dx,
                y: obj.y + dy,
                points: pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
              });
            }
            continue;
          }
          const nextX = obj.x + dx;
          const nextY = obj.y + dy;
          const nextRoomId = getRoomIdAt((currentPlan as FloorPlan).rooms, nextX, nextY);
          const currentRoomId = obj.roomId ?? undefined;
          moveObject(id, nextX, nextY);
          if (currentRoomId !== nextRoomId) {
            updateObject(id, { roomId: nextRoomId });
          }
        }
        return;
      }
      const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace';
      if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && selectedCorridorDoor && isDeleteKey && currentPlan) {
        e.preventDefault();
        if (isReadOnlyRef.current) return;
        const currentCorridors = ((((currentPlan as FloorPlan).corridors || []) as Corridor[])).filter(Boolean);
        const next = currentCorridors.map((corridor) => {
          if (corridor.id !== selectedCorridorDoor.corridorId) return corridor;
          const doors = Array.isArray(corridor.doors) ? corridor.doors.filter((door) => door.id !== selectedCorridorDoor.doorId) : [];
          return { ...corridor, doors };
        });
        markTouched();
        updateFloorPlan((currentPlan as FloorPlan).id, { corridors: next } as any);
        setSelectedCorridorDoor(null);
        push(t({ it: 'Porta del corridoio eliminata', en: 'Corridor door deleted' }), 'info');
        return;
      }
      if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && selectedRoomDoorId && isDeleteKey && currentPlan) {
        e.preventDefault();
        if (isReadOnlyRef.current) return;
        const currentDoors = Array.isArray((currentPlan as any).roomDoors) ? ((currentPlan as any).roomDoors as any[]) : [];
        const nextDoors = currentDoors.filter((door) => String((door as any)?.id || '') !== String(selectedRoomDoorId));
        markTouched();
        updateFloorPlan((currentPlan as FloorPlan).id, { roomDoors: nextDoors as any } as any);
        setSelectedRoomDoorId(null);
        push(t({ it: 'Porta di collegamento eliminata', en: 'Connecting door deleted' }), 'info');
        return;
      }
      if (!currentSelectedIds.length && selectedRoomIds.length && isDeleteKey && currentPlan) {
        e.preventDefault();
        if (isReadOnlyRef.current) return;
        if (selectedRoomIds.length === 1) {
          setConfirmDeleteRoomId(selectedRoomIds[0]);
        } else {
          setConfirmDeleteRoomIds([...selectedRoomIds]);
        }
        return;
      }
      if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && selectedCorridorId && isDeleteKey && currentPlan) {
        e.preventDefault();
        if (isReadOnlyRef.current) return;
        setConfirmDeleteCorridorId(selectedCorridorId);
        return;
      }
      const linkId = selectedLinkIdRef.current;
      if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && !selectedCorridorId && linkId && isDeleteKey && currentPlan) {
        e.preventDefault();
        if (isRackLinkId(linkId)) return;
        if (isReadOnlyRef.current) return;
        markTouched();
        deleteLink((currentPlan as FloorPlan).id, linkId);
        postAuditEvent({ event: 'link_delete', scopeType: 'plan', scopeId: (currentPlan as FloorPlan).id, details: { id: linkId } });
        push(t({ it: 'Collegamento eliminato', en: 'Link deleted' }), 'info');
        setSelectedLinkId(null);
        return;
      }
      if (!currentSelectedIds.length || !currentPlan) return;
      if (isDeleteKey) {
        e.preventDefault();
        setPendingRoomDeletes([...selectedRoomIds]);
        setConfirmDelete([...currentSelectedIds]);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [
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
    getQuoteOrientation,
    isDeskType,
    isWallType,
    linkFromId,
    markTouched,
    measureMode,
    moveObject,
    performRedo,
    performUndo,
    postAuditEvent,
    push,
    quoteMode,
    requestPaste,
    resetTouched,
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
    toSnapshot,
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

  const handleSelectType = useCallback(
    (typeId: string) => {
      const ids = (objectsByType.get(typeId) || []).map((o) => o.id);
      if (!ids.length) return;
      setSelection(ids);
      setCountsOpen(false);
      setTypeMenu(null);
    },
    [objectsByType, setSelection]
  );

  const handleDeleteType = useCallback(
    (typeId: string) => {
      if (isReadOnly) return;
      const ids = (objectsByType.get(typeId) || []).map((o) => o.id);
      if (!ids.length) return;
      setConfirmDelete(ids);
      setCountsOpen(false);
      setTypeMenu(null);
    },
    [isReadOnly, objectsByType]
  );

  const canManageLayers = !!user?.isAdmin || isSuperAdmin;

  const handleOpenTypeLayer = useCallback(
    (typeId: string, label: string) => {
      if (isReadOnly || !canManageLayers) return;
      setTypeLayerModal({ typeId, label });
      setTypeMenu(null);
    },
    [canManageLayers, isReadOnly]
  );

  const handleCreateTypeLayer = useCallback(() => {
    if (!typeLayerModal || isReadOnly || !client || !canManageLayers) return;
    const name = typeLayerName.trim();
    if (!name) return;
    const layers = planLayers;
    const fallbackTypeLayerIds =
      getTypeLayerIds(typeLayerModal.typeId) || inferDefaultLayerIds(typeLayerModal.typeId, layerIdSet);
    const fallbackTypeLayerSet = new Set(fallbackTypeLayerIds.map((id) => String(id)));
    const baseId = `layer-${typeLayerModal.typeId}`;
    let id = baseId;
    let suffix = 1;
    while (layers.some((l) => String(l.id) === id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const maxOrder = layers.reduce((acc, l) => Math.max(acc, Number(l.order || 0)), 0);
    const nextLayer = {
      id,
      name: { it: name, en: name },
      color: typeLayerColor || '#0ea5e9',
      order: maxOrder + 1,
      typeIds: [typeLayerModal.typeId]
    };
    const nextLayers = [...layers, nextLayer];
    const updateObjects = (o: any) => {
      if (o.type !== typeLayerModal.typeId) return o;
      const currentLayerIds =
        Array.isArray(o.layerIds) && o.layerIds.length
          ? o.layerIds.map((layerId: string) => String(layerId))
          : fallbackTypeLayerIds;
      const preserved = currentLayerIds.filter((layerId: string) => !fallbackTypeLayerSet.has(String(layerId)));
      const nextLayerIds = Array.from(new Set([id, ...preserved]));
      return { ...o, layerIds: nextLayerIds };
    };
    markTouched();
    updateClientLayers(client.id, nextLayers, { updateObjects });
    for (const site of client.sites || []) {
      for (const plan of site.floorPlans || []) {
        setPlanDirty?.(plan.id, true);
      }
    }
    push(t({ it: 'Layer creato', en: 'Layer created' }), 'success');
    setTypeLayerModal(null);
  }, [
    canManageLayers,
    client,
    getTypeLayerIds,
    inferDefaultLayerIds,
    isReadOnly,
    layerIdSet,
    markTouched,
    planLayers,
    push,
    setPlanDirty,
    t,
    typeLayerColor,
    typeLayerModal,
    typeLayerName,
    updateClientLayers
  ]);

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

  const rooms = useMemo(() => renderPlan?.rooms || [], [renderPlan?.rooms]);
  const corridors = useMemo(() => (renderPlan?.corridors || []) as Corridor[], [renderPlan?.corridors]);
  const roomDoors = useMemo(() => ((renderPlan as any)?.roomDoors || []) as RoomConnectionDoor[], [(renderPlan as any)?.roomDoors]);
  const corridorLabelHelpToastId = 'corridor-label-help';
  const corridorPolyHelpToastId = 'corridor-poly-help';
  const roomPolyHelpToastId = 'room-poly-help';
  const roomLabelHelpToastId = 'room-label-help';
  useEffect(() => {
    if (isReadOnly || !selectedCorridorId) {
      toast.dismiss(corridorLabelHelpToastId);
      return;
    }
    const selected = corridors.find((c) => c.id === selectedCorridorId);
    if (!selected || selected.showName === false || !String(selected.name || '').trim()) {
      toast.dismiss(corridorLabelHelpToastId);
      return;
    }
    toast.info(
      t({
        it: 'Comandi corridoio: trascina etichetta per spostarla, usa + / - per dimensione testo, premi E per rinomina; tasto centrale del mouse sul corridoio = aggiungi punto di snodo.',
        en: 'Corridor commands: drag label to move, use + / - to resize text, press E to rename; middle mouse button on corridor = add junction point.'
      }),
      {
        id: corridorLabelHelpToastId,
        duration: Infinity
      }
    );
  }, [corridors, isReadOnly, selectedCorridorId, t]);
  useEffect(() => {
    return () => {
      toast.dismiss(corridorLabelHelpToastId);
    };
  }, []);
  useEffect(() => {
    if (isReadOnly || corridorDrawMode !== 'poly') {
      toast.dismiss(corridorPolyHelpToastId);
      return;
    }
    toast.info(
      t({
        it:
          'Disegno corridoio: clicca i vertici del perimetro. Click destro rimuove l’ultimo punto. Esc interrompe il disegno. Invio conclude il corridoio (oppure chiudi tornando sul primo punto).',
        en:
          'Corridor drawing: click perimeter vertices. Right click removes the last point. Esc cancels drawing. Enter finalizes the corridor (or close by returning to the first point).'
      }),
      {
        id: corridorPolyHelpToastId,
        duration: Infinity
      }
    );
  }, [corridorDrawMode, isReadOnly, t]);
  useEffect(() => {
    if (isReadOnly || roomDrawMode !== 'poly') {
      toast.dismiss(roomPolyHelpToastId);
      return;
    }
    toast.info(
      t({
        it:
          'Disegno stanza poligonale: linee orizzontali/verticali di default. Tieni premuto Shift per tracciare linee oblique. Per chiudere il poligono torna sul punto iniziale o premi Invio. Backspace annulla l’ultimo vertice.',
        en:
          'Polygon room drawing: horizontal/vertical lines by default. Hold Shift to draw oblique lines. Close the polygon by returning to the starting point or pressing Enter. Backspace removes the last vertex.'
      }),
      {
        id: roomPolyHelpToastId,
        duration: Infinity
      }
    );
  }, [isReadOnly, roomDrawMode, t]);
  useEffect(() => {
    if (isReadOnly || !selectedRoomId || roomDrawMode) {
      toast.dismiss(roomLabelHelpToastId);
      return;
    }
    toast.info(
      t({
        it: 'Stanza selezionata: frecce per spostare la stanza, Shift+frecce per spostare la scritta (alto/basso/sinistra/destra), + / - per dimensione testo.',
        en: 'Selected room: arrows move the room, Shift+arrows move the label (top/bottom/left/right), + / - changes text size.'
      }),
      {
        id: roomLabelHelpToastId,
        duration: Infinity
      }
    );
  }, [isReadOnly, roomDrawMode, selectedRoomId, t]);
  useEffect(() => {
    return () => {
      toast.dismiss(corridorPolyHelpToastId);
      toast.dismiss(roomPolyHelpToastId);
      toast.dismiss(roomLabelHelpToastId);
    };
  }, []);

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

  useEffect(() => {
    if (paletteSection === 'desks' && !deskPaletteDefs.length) {
      setPaletteSection('objects');
    } else if (paletteSection === 'objects' && !otherPaletteDefs.length && deskPaletteDefs.length) {
      setPaletteSection('desks');
    } else if (paletteSection === 'objects' && !otherPaletteDefs.length && !deskPaletteDefs.length && securityPaletteDefs.length) {
      setPaletteSection('security');
    } else if (paletteSection === 'security' && !securityPaletteDefs.length) {
      setPaletteSection(otherPaletteDefs.length ? 'objects' : 'desks');
    }
  }, [deskPaletteDefs.length, otherPaletteDefs.length, paletteSection, securityPaletteDefs.length]);

  useEffect(() => {
    if (!deskPaletteDefs.length) setDesksOpen(false);
    if (!otherPaletteDefs.length) setObjectsOpen(false);
    if (!securityPaletteDefs.length) setSecurityOpen(false);
  }, [deskPaletteDefs.length, otherPaletteDefs.length, securityPaletteDefs.length]);
  const paletteSettingsSection = paletteSection === 'desks' ? 'desks' : paletteSection === 'security' ? 'security' : 'objects';

  const addTypeToPalette = useCallback(
    async (typeId: string) => {
      if (isDoorType(typeId)) {
        push(t({ it: 'Le porte sono gestite dal catalogo dedicato e non dalla palette.', en: 'Doors are managed in the dedicated catalog, not in the palette.' }), 'info');
        return;
      }
      if (isSecurityTypeId(typeId)) {
        push(t({ it: 'I dispositivi sicurezza sono nel pannello Sicurezza dedicato.', en: 'Safety devices are managed in the dedicated Safety panel.' }), 'info');
        return;
      }
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
    [isDoorType, push, t]
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
  const corridorDoorLinkRoomEntries = useMemo(() => {
    const list = (renderPlan?.rooms || []) as Room[];
    const normalized = corridorDoorLinkQuery.trim().toLowerCase();
    const nearestRoomId = String(corridorDoorLinkModal?.nearestRoomId || '');
    const magneticRoomIdSet = new Set((corridorDoorLinkModal?.magneticRoomIds || []).map((id) => String(id)));
    return list
      .map((room) => {
        const stats = roomStatsById.get(room.id) || ({ items: [] as MapObject[], userCount: 0, otherCount: 0, totalCount: 0 } as const);
        const userObjects = stats.items.filter((obj) => isUserObject(String(obj.type)));
        const realUsers = userObjects.filter((obj) => String(obj.type) === 'real_user');
        const userNames = userObjects.map((obj) => getUserObjectLabel(obj)).filter(Boolean);
        const realUserNames = realUsers.map((obj) => getUserObjectLabel(obj)).filter(Boolean);
        const search = `${String(room.name || '')} ${userNames.join(' ')} ${realUserNames.join(' ')}`.toLowerCase();
        return {
          id: room.id,
          name: String(room.name || ''),
          userCount: userObjects.length,
          realUserCount: realUsers.length,
          userNames,
          realUserNames,
          isNearest: nearestRoomId ? room.id === nearestRoomId : false,
          isMagnetic: magneticRoomIdSet.has(room.id),
          search
        };
      })
      .filter((entry) => (!normalized ? true : entry.search.includes(normalized)))
      .sort((a, b) => {
        if (a.isNearest !== b.isNearest) return a.isNearest ? -1 : 1;
        if (a.isMagnetic !== b.isMagnetic) return a.isMagnetic ? -1 : 1;
        return a.name.localeCompare(b.name, lang === 'it' ? 'it' : 'en', { sensitivity: 'base' });
      });
  }, [corridorDoorLinkModal?.magneticRoomIds, corridorDoorLinkModal?.nearestRoomId, corridorDoorLinkQuery, getUserObjectLabel, isUserObject, lang, renderPlan?.rooms, roomStatsById]);

  const handleStageMoveStart = useCallback((id: string, x: number, y: number, roomId?: string) => {
    dragStartRef.current.set(id, { x, y, roomId });
  }, []);

  const handleStageMove = useCallback(
    (id: string, x: number, y: number) => {
      if (!isReadOnlyRef.current) markTouched();
      const currentPlan = planRef.current as FloorPlan | undefined;
      const currentObj = currentPlan?.objects?.find((o) => o.id === id);
      if (!currentObj) return;
      const prev = dragStartRef.current.get(id) || { x: currentObj.x, y: currentObj.y, roomId: currentObj.roomId ?? undefined };
      if (currentObj.type === 'quote') {
        const pts = Array.isArray(currentObj.points) ? currentObj.points : [];
        if (pts.length >= 2) {
          const dx = x - prev.x;
          const dy = y - prev.y;
          updateObject(id, {
            x,
            y,
            points: pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
          });
          dragStartRef.current.delete(id);
          return true;
        }
      }
      const nextRoomId = !isReadOnlyRef.current && currentPlan ? getRoomIdAt(currentPlan.rooms, x, y) : undefined;
      const currentRoomId = currentObj.roomId ?? undefined;
      if (
        nextRoomId &&
        nextRoomId !== currentRoomId &&
        (currentObj.type === 'user' || currentObj.type === 'real_user' || currentObj.type === 'generic_user')
      ) {
        const room = (currentPlan?.rooms || []).find((r) => r.id === nextRoomId);
        const rawCapacity = Number(room?.capacity);
        const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.floor(rawCapacity) : undefined;
        if (capacity) {
          const userCount = roomStatsById.get(nextRoomId)?.userCount || 0;
          if (userCount >= capacity) {
            setCapacityConfirm({
              mode: 'move',
              type: currentObj.type,
              x,
              y,
              roomId: nextRoomId,
              roomName: room?.name || t({ it: 'Stanza', en: 'Room' }),
              capacity,
              objectId: currentObj.id,
              prevX: prev.x,
              prevY: prev.y,
              prevRoomId: prev.roomId
            });
            return false;
          }
        }
      }
      moveObject(id, x, y);
      if (currentRoomId !== nextRoomId) {
        updateObject(id, { roomId: nextRoomId });
      }
      dragStartRef.current.delete(id);
      return true;
    },
    [markTouched, moveObject, roomStatsById, t, updateObject]
  );

  const handleWallMove = useCallback(
    (id: string, dx: number, dy: number, batchId?: string, movedRoomIds?: string[]) => {
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
      if (batchId && wallMoveBatchRef.current.id !== batchId) {
        wallMoveBatchRef.current = { id: batchId, movedGroups: new Set(), movedWalls: new Set(), movedRooms: new Set() };
      }
      if (batchId && Array.isArray(movedRoomIds)) {
        movedRoomIds.forEach((roomId) => wallMoveBatchRef.current.movedRooms.add(roomId));
      }
      const useBatch = !!batchId;
      const currentPlan = planRef.current as FloorPlan | undefined;
      const currentObj = currentPlan?.objects?.find((o) => o.id === id);
      if (!currentObj) return;
      const applyWallMove = (wall: MapObject) => {
        const pts = wall.points || [];
        if (!pts.length) return;
        const baseX = Number.isFinite(Number(wall.x)) ? Number(wall.x) : pts[0]?.x || 0;
        const baseY = Number.isFinite(Number(wall.y)) ? Number(wall.y) : pts[0]?.y || 0;
        const nextPoints = pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
        updateObject(wall.id, { x: baseX + dx, y: baseY + dy, points: nextPoints });
      };
      if (useBatch && wallMoveBatchRef.current.movedWalls.has(currentObj.id)) return;
      if (!isReadOnlyRef.current) markTouched();
      applyWallMove(currentObj);
      if (useBatch) wallMoveBatchRef.current.movedWalls.add(currentObj.id);
    },
    [
      markTouched,
      updateObject
    ]
  );

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
    }
    if (nextKey === prevKey) return;
    setRoomCapacityState(planId, nextState);
  }, [planId, push, roomCapacityStateByPlan, roomStatsById, rooms, setRoomCapacityState, t]);

  const objectListMatches = useMemo(() => {
    const q = objectListQuery.trim().toLowerCase();
    if (!q) return [];
    return (renderPlan?.objects || []).filter(
      (o) =>
        !isDeskType(o.type) &&
        (o.name.toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q))
    );
  }, [objectListQuery, renderPlan?.objects]);

  useEffect(() => {
    if (!countsOpen) return;
    setObjectListQuery('');
    setExpandedType(null);
  }, [countsOpen]);

  useEffect(() => {
    if (countsOpen) return;
    setTypeMenu(null);
  }, [countsOpen]);

  useEffect(() => {
    if (!typeMenu) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!typeMenuRef.current) return;
      if (typeMenuRef.current.contains(event.target as Node)) return;
      setTypeMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [typeMenu]);

  useEffect(() => {
    if (!typeLayerModal) return;
    setTypeLayerName(typeLayerModal.label);
    setTypeLayerColor('#0ea5e9');
    window.setTimeout(() => typeLayerNameRef.current?.focus(), 0);
  }, [typeLayerModal]);

  useEffect(() => {
    if (!presenceOpen) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!presenceRef.current) return;
      if (presenceRef.current.contains(event.target as Node)) return;
      setPresenceOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [presenceOpen]);

  useEffect(() => {
    if (!layersPopoverOpen) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!layersPopoverRef.current) return;
      if (layersPopoverRef.current.contains(event.target as Node)) return;
      setLayersPopoverOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [layersPopoverOpen]);

  useEffect(() => {
    if (!layersQuickMenu) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (layersQuickMenuRef.current?.contains(event.target as Node)) return;
      setLayersQuickMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [layersQuickMenu]);

  useEffect(() => {
    if (!roomsOpen) return;
    setExpandedRoomId(null);
    setNewRoomMenuOpen(false);
  }, [roomsOpen]);

  useEffect(() => {
    if (!user) return;
    const normalized = normalizeVisibleLayerIdsByPlan((user as any)?.visibleLayerIdsByPlan || {});
    layerVisibilitySyncRef.current = JSON.stringify(normalized);
  }, [normalizeVisibleLayerIdsByPlan, user]);

  useEffect(() => {
    if (!user) return;
    const base = normalizeVisibleLayerIdsByPlan((user as any)?.visibleLayerIdsByPlan || {});
    const current = normalizeVisibleLayerIdsByPlan(visibleLayerIdsByPlan || {});
    const merged = { ...base, ...current };
    const next = JSON.stringify(merged);
    if (next === layerVisibilitySyncRef.current) return;
    const handle = window.setTimeout(async () => {
      try {
        await updateMyProfile({ visibleLayerIdsByPlan: merged });
        useAuthStore.setState((s) =>
          s.user
            ? ({ user: { ...s.user, visibleLayerIdsByPlan: merged } as any, permissions: s.permissions, hydrated: s.hydrated } as any)
            : s
        );
        layerVisibilitySyncRef.current = next;
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [normalizeVisibleLayerIdsByPlan, user, visibleLayerIdsByPlan]);

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

  const openEditRoom = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || isReadOnly) return;
    setRoomModal({
      mode: 'edit',
      roomId,
      initialName: room.name,
      initialNameEn: (room as any).nameEn,
      initialCapacity: room.capacity,
      initialShowName: room.showName,
      initialSurfaceSqm: room.surfaceSqm,
      initialNotes: room.notes,
      initialLogical: room.logical
    });
  };

  const snapRoomRectToAdjacentSide = useCallback(
    (inputRect: { x: number; y: number; width: number; height: number }) => {
      const width = Math.max(0, Number(inputRect.width) || 0);
      const height = Math.max(0, Number(inputRect.height) || 0);
      if (width < 1 || height < 1) return inputRect;
      const rect = {
        x: Number(inputRect.x) || 0,
        y: Number(inputRect.y) || 0,
        width,
        height
      };
      const snapThreshold = 14;
      const minOverlap = 10;
      type SnapCandidate = { distance: number; nextX: number; nextY: number };
      let best: SnapCandidate | null = null;
      const registerCandidate = (distance: number, nextX: number, nextY: number) => {
        if (!Number.isFinite(distance) || distance > snapThreshold) return;
        if (best && distance >= best.distance) return;
        best = { distance, nextX, nextY };
      };
      const existingRooms = (((plan as FloorPlan | undefined)?.rooms || []) as Room[]).filter(Boolean);
      for (const room of existingRooms) {
        const points = getRoomPolygon(room as any);
        if (points.length < 2) continue;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const point of points) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        }
        const roomCenterX = (minX + maxX) / 2;
        const roomCenterY = (minY + maxY) / 2;
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const isVertical = Math.abs(dx) <= Math.abs(dy) * 0.15;
          const isHorizontal = Math.abs(dy) <= Math.abs(dx) * 0.15;
          if (!isVertical && !isHorizontal) continue;
          if (isVertical) {
            const edgeX = (a.x + b.x) / 2;
            const edgeMinY = Math.min(a.y, b.y);
            const edgeMaxY = Math.max(a.y, b.y);
            const overlapY = Math.min(rect.y + rect.height, edgeMaxY) - Math.max(rect.y, edgeMinY);
            if (overlapY < minOverlap) continue;
            if (roomCenterX <= edgeX) {
              registerCandidate(Math.abs(rect.x - edgeX), edgeX, rect.y);
            } else {
              registerCandidate(Math.abs(rect.x + rect.width - edgeX), edgeX - rect.width, rect.y);
            }
            continue;
          }
          const edgeY = (a.y + b.y) / 2;
          const edgeMinX = Math.min(a.x, b.x);
          const edgeMaxX = Math.max(a.x, b.x);
          const overlapX = Math.min(rect.x + rect.width, edgeMaxX) - Math.max(rect.x, edgeMinX);
          if (overlapX < minOverlap) continue;
          if (roomCenterY <= edgeY) {
            registerCandidate(Math.abs(rect.y - edgeY), rect.x, edgeY);
          } else {
            registerCandidate(Math.abs(rect.y + rect.height - edgeY), rect.x, edgeY - rect.height);
          }
        }
      }
      if (!best) return rect;
      const snapped = best as SnapCandidate;
      return {
        x: Number(snapped.nextX.toFixed(2)),
        y: Number(snapped.nextY.toFixed(2)),
        width: rect.width,
        height: rect.height
      };
    },
    [plan]
  );

  const handleCreateRoomFromRect = (rect: { x: number; y: number; width: number; height: number }) => {
    if (isReadOnly) return;
    const normalizedRect = {
      x: Number(rect.x) || 0,
      y: Number(rect.y) || 0,
      width: Math.max(0, Number(rect.width) || 0),
      height: Math.max(0, Number(rect.height) || 0)
    };
    const snappedRect = snapRoomRectToAdjacentSide(normalizedRect);
    const candidates = [snappedRect, normalizedRect];
    const accepted = candidates.find((candidate) => !hasRoomOverlap({ id: 'new-room', name: '', kind: 'rect', ...candidate }));
    if (!accepted) {
      notifyRoomOverlap();
      setRoomDrawMode(null);
      return;
    }
    setRoomDrawMode(null);
    setRoomModal({ mode: 'create', kind: 'rect', rect: accepted });
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

  const openEditCorridor = useCallback(
    (corridorId: string) => {
      const corridor = corridors.find((c) => c.id === corridorId);
      if (!corridor || isReadOnly) return;
      setCorridorModal({
        mode: 'edit',
        corridorId,
        initialName: corridor.name || '',
        initialNameEn: (corridor as any).nameEn || '',
        initialShowName: corridor.showName !== false
      });
      setCorridorNameInput(corridor.name || '');
      setCorridorNameEnInput((corridor as any).nameEn || '');
      setCorridorShowNameInput(corridor.showName !== false);
    },
    [corridors, isReadOnly]
  );

  const handleCreateCorridorFromPoly = useCallback(
    (points: { x: number; y: number }[]) => {
      if (isReadOnly || !plan) return;
      setCorridorDrawMode(null);
      const nextIndex = Math.max(1, (plan.corridors || []).length + 1);
      setCorridorModal({
        mode: 'create',
        kind: 'poly',
        points,
        initialName: t({ it: `Corridoio ${nextIndex}`, en: `Corridor ${nextIndex}` }),
        initialNameEn: `Corridor ${nextIndex}`,
        initialShowName: true
      });
      setCorridorNameInput(t({ it: `Corridoio ${nextIndex}`, en: `Corridor ${nextIndex}` }));
      setCorridorNameEnInput(`Corridor ${nextIndex}`);
      setCorridorShowNameInput(true);
    },
    [isReadOnly, plan, t]
  );

  const saveCorridorModal = useCallback(() => {
    if (!plan || !corridorModal || isReadOnly) return;
    const nextName = corridorNameInput.trim() || t({ it: 'Corridoio', en: 'Corridor' });
    const nextNameEn = corridorNameEnInput.trim() || undefined;
    const current = (plan.corridors || []) as Corridor[];
    if (corridorModal.mode === 'create') {
      const next: Corridor = {
        id: nanoid(),
        name: nextName,
        nameEn: nextNameEn,
        showName: corridorShowNameInput,
        color: '#94a3b8',
        kind: corridorModal.kind,
        points: corridorModal.points.map((p) => ({ x: p.x, y: p.y })),
        doors: [],
        connections: []
      };
      markTouched();
      updateFloorPlan(plan.id, { corridors: [...current, next] } as any);
      postAuditEvent({ event: 'corridor_create', scopeType: 'plan', scopeId: plan.id, details: { id: next.id, name: nextName, nameEn: nextNameEn || null } });
      setSelectedCorridorId(next.id);
      push(t({ it: 'Corridoio creato', en: 'Corridor created' }), 'success');
    } else {
      const next = current.map((c) =>
        c.id === corridorModal.corridorId ? { ...c, name: nextName, nameEn: nextNameEn, showName: corridorShowNameInput } : c
      );
      markTouched();
      updateFloorPlan(plan.id, { corridors: next } as any);
      postAuditEvent({
        event: 'corridor_update',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { id: corridorModal.corridorId, name: nextName, nameEn: nextNameEn || null }
      });
      push(t({ it: 'Corridoio aggiornato', en: 'Corridor updated' }), 'success');
    }
    setCorridorModal(null);
    setCorridorNameInput('');
    setCorridorNameEnInput('');
  }, [corridorModal, corridorNameEnInput, corridorNameInput, corridorShowNameInput, isReadOnly, markTouched, plan, push, t, updateFloorPlan]);

  const openCorridorDoorModal = useCallback(
    (corridorId: string, doorId: string) => {
      const corridor = corridors.find((c) => c.id === corridorId);
      const door = (corridor?.doors || []).find((d) => d.id === doorId);
      if (!corridor || !door) return;
      const rawCatalogTypeId = typeof (door as any)?.catalogTypeId === 'string' ? String((door as any).catalogTypeId) : '';
      const catalogTypeId = defaultDoorCatalogId || (doorTypeIdSet.has(rawCatalogTypeId) ? rawCatalogTypeId : '');
      const doorType = catalogTypeId ? (objectTypeById.get(catalogTypeId) as ObjectTypeDefinition | undefined) : undefined;
      const defaultEmergency = !!(doorType as any)?.doorConfig?.isEmergency;
      setCorridorDoorModal({
        corridorId,
        doorId,
        description: typeof (door as any)?.description === 'string' ? String((door as any).description) : '',
        isEmergency: typeof (door as any)?.isEmergency === 'boolean' ? !!(door as any).isEmergency : defaultEmergency,
        isMainEntrance: !!(door as any)?.isMainEntrance,
        isExternal: !!(door as any)?.isExternal,
        isFireDoor: !!(door as any)?.isFireDoor,
        lastVerificationAt: typeof (door as any)?.lastVerificationAt === 'string' ? String((door as any).lastVerificationAt) : '',
        verifierCompany: typeof (door as any)?.verifierCompany === 'string' ? String((door as any).verifierCompany) : '',
        verificationHistory: normalizeDoorVerificationHistory((door as any)?.verificationHistory),
        mode: door.mode === 'auto_sensor' || door.mode === 'automated' ? door.mode : 'static',
        automationUrl: String((door as any).automationUrl || '')
      });
    },
    [corridors, defaultDoorCatalogId, doorTypeIdSet, objectTypeById]
  );
  const openRoomDoorModal = useCallback(
    (doorId: string) => {
      const door = roomDoors.find((entry) => entry.id === doorId);
      if (!door) return;
      const rawCatalogTypeId = typeof (door as any)?.catalogTypeId === 'string' ? String((door as any).catalogTypeId) : '';
      const catalogTypeId = defaultDoorCatalogId || (doorTypeIdSet.has(rawCatalogTypeId) ? rawCatalogTypeId : '');
      const doorType = catalogTypeId ? (objectTypeById.get(catalogTypeId) as ObjectTypeDefinition | undefined) : undefined;
      const defaultEmergency = !!(doorType as any)?.doorConfig?.isEmergency;
      setCorridorDoorModal({
        corridorId: '__room__',
        doorId,
        description: typeof (door as any)?.description === 'string' ? String((door as any).description) : '',
        isEmergency: typeof (door as any)?.isEmergency === 'boolean' ? !!(door as any).isEmergency : defaultEmergency,
        isMainEntrance: !!(door as any)?.isMainEntrance,
        isExternal: !!(door as any)?.isExternal,
        isFireDoor: !!(door as any)?.isFireDoor,
        lastVerificationAt: typeof (door as any)?.lastVerificationAt === 'string' ? String((door as any).lastVerificationAt) : '',
        verifierCompany: typeof (door as any)?.verifierCompany === 'string' ? String((door as any).verifierCompany) : '',
        verificationHistory: normalizeDoorVerificationHistory((door as any)?.verificationHistory),
        mode: door.mode === 'auto_sensor' || door.mode === 'automated' ? door.mode : 'static',
        automationUrl: String((door as any).automationUrl || '')
      });
    },
    [defaultDoorCatalogId, doorTypeIdSet, objectTypeById, roomDoors]
  );
  const openCorridorDoorLinkModal = useCallback(
    (corridorId: string, doorId: string) => {
      const corridor = corridors.find((c) => c.id === corridorId);
      const door = (corridor?.doors || []).find((d) => d.id === doorId);
      if (!corridor || !door) return;
      // Force rooms layer visible for better context while linking door->rooms.
      setHideAllLayers(planId, false);
      setVisibleLayerIds(planId, normalizeLayerSelection([...visibleLayerIds, 'rooms']));
      const availableRooms = (renderPlan?.rooms || []) as Room[];
      const availableRoomIdSet = new Set(availableRooms.map((room) => room.id));
      let selectedRoomIds: string[] = Array.isArray((door as any).linkedRoomIds)
        ? (Array.from(
            new Set((door as any).linkedRoomIds.map((id: any) => String(id)).filter((id: string) => availableRoomIdSet.has(id)))
          ) as string[])
        : [];
      let nearestRoomId: string | undefined;
      let magneticRoomIds: string[] = [];
      if (availableRooms.length) {
        const anchor = getCorridorEdgePoint(corridor, Number((door as any).edgeIndex), Number((door as any).t));
        if (anchor) {
          const getRoomCenter = (room: Room): { x: number; y: number } | null => {
            const points = getRoomPolygon(room as any);
            if (points.length >= 3) {
              const total = points.reduce((acc: { x: number; y: number }, p: { x: number; y: number }) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
                x: 0,
                y: 0
              });
              return { x: total.x / points.length, y: total.y / points.length };
            }
            const x = Number((room as any)?.x || 0);
            const y = Number((room as any)?.y || 0);
            const width = Number((room as any)?.width || 0);
            const height = Number((room as any)?.height || 0);
            if (width > 0 && height > 0) return { x: x + width / 2, y: y + height / 2 };
            return null;
          };
          const roomByDistance: Array<{ id: string; distSq: number }> = [];
          for (const room of availableRooms) {
            const points = getRoomPolygon(room as any);
            let distSq = Number.POSITIVE_INFINITY;
            if (points.length >= 2) {
              for (let i = 0; i < points.length; i += 1) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                const proj = projectPointToSegment(a, b, anchor);
                if (proj.distSq < distSq) distSq = proj.distSq;
              }
            } else {
              const center = getRoomCenter(room);
              if (center) {
                const dx = center.x - anchor.x;
                const dy = center.y - anchor.y;
                distSq = dx * dx + dy * dy;
              }
            }
            if (Number.isFinite(distSq)) roomByDistance.push({ id: room.id, distSq });
          }
          roomByDistance.sort((a, b) => a.distSq - b.distSq);
          nearestRoomId = roomByDistance[0]?.id;
          const magneticThresholdSq = 18 * 18;
          magneticRoomIds = roomByDistance.filter((entry) => entry.distSq <= magneticThresholdSq).map((entry) => entry.id);
          if (!selectedRoomIds.length && nearestRoomId) selectedRoomIds = [nearestRoomId];
        }
      }
      setCorridorDoorLinkModal({ corridorId, doorId, selectedRoomIds, nearestRoomId, magneticRoomIds });
      setCorridorDoorLinkQuery('');
    },
    [
      corridors,
      getCorridorEdgePoint,
      getRoomPolygon,
      normalizeLayerSelection,
      planId,
      projectPointToSegment,
      renderPlan?.rooms,
      setHideAllLayers,
      setVisibleLayerIds,
      visibleLayerIds
    ]
  );

  const saveCorridorDoorModal = useCallback(() => {
    if (!corridorDoorModal || !plan || isReadOnly) return;
    const mode = corridorDoorModal.mode;
    const automationUrl = corridorDoorModal.automationUrl.trim();
    if (mode === 'automated' && automationUrl && !/^https?:\/\//i.test(automationUrl)) {
      push(t({ it: 'Inserisci un URL valido (http/https).', en: 'Enter a valid URL (http/https).' }), 'danger');
      return;
    }
    const isEmergency = !!corridorDoorModal.isEmergency;
    const isMainEntrance = !!corridorDoorModal.isMainEntrance;
    const isExternal = !!corridorDoorModal.isExternal;
    const isFireDoor = !!corridorDoorModal.isFireDoor;
    const description = corridorDoorModal.description.trim();
    const lastVerificationAt = corridorDoorModal.lastVerificationAt.trim();
    const verifierCompany = corridorDoorModal.verifierCompany.trim();
    let verificationHistory = normalizeDoorVerificationHistory(corridorDoorModal.verificationHistory);
    if (isEmergency && (lastVerificationAt || verifierCompany)) {
      const latest = verificationHistory[0];
      if (!latest || (latest.date || '') !== lastVerificationAt || latest.company !== verifierCompany) {
        verificationHistory = normalizeDoorVerificationHistory([
          {
            id: nanoid(),
            date: lastVerificationAt || undefined,
            company: verifierCompany,
            createdAt: Date.now()
          },
          ...verificationHistory
        ]);
      }
    }
    if (corridorDoorModal.corridorId === '__room__') {
      const currentRoomDoors = Array.isArray((plan as any).roomDoors) ? ((plan as any).roomDoors as any[]) : [];
      const nextRoomDoors = currentRoomDoors.map((door) =>
        String((door as any)?.id || '') === corridorDoorModal.doorId
          ? {
              ...door,
              description: description || undefined,
              isEmergency,
              isMainEntrance,
              isExternal,
              isFireDoor,
              lastVerificationAt: isEmergency ? lastVerificationAt || undefined : undefined,
              verifierCompany: isEmergency ? verifierCompany || undefined : undefined,
              verificationHistory,
              mode,
              automationUrl: mode === 'automated' ? automationUrl || undefined : undefined
            }
          : door
      );
      markTouched();
      updateFloorPlan(plan.id, { roomDoors: nextRoomDoors as any } as any);
      push(t({ it: 'Proprietà porta aggiornate', en: 'Door properties updated' }), 'success');
      setCorridorDoorModal(null);
      return;
    }
    const current = (plan.corridors || []) as Corridor[];
    const next = current.map((corridor) => {
      if (corridor.id !== corridorDoorModal.corridorId) return corridor;
      return {
        ...corridor,
        doors: (corridor.doors || []).map((door) =>
          door.id === corridorDoorModal.doorId
            ? {
                ...door,
                description: description || undefined,
                isEmergency,
                isMainEntrance,
                isExternal,
                isFireDoor,
                lastVerificationAt: isEmergency ? lastVerificationAt || undefined : undefined,
                verifierCompany: isEmergency ? verifierCompany || undefined : undefined,
                verificationHistory,
                mode,
                automationUrl: mode === 'automated' ? automationUrl || undefined : undefined
              }
            : door
        )
      };
    });
    markTouched();
    updateFloorPlan(plan.id, { corridors: next } as any);
    push(t({ it: 'Proprietà porta aggiornate', en: 'Door properties updated' }), 'success');
    setCorridorDoorModal(null);
  }, [corridorDoorModal, isReadOnly, markTouched, plan, push, t, updateFloorPlan]);
  const saveCorridorDoorLinkModal = useCallback(() => {
    if (!corridorDoorLinkModal || !plan || isReadOnly) return;
    const availableRooms = ((renderPlan?.rooms || []) as Room[]).filter(Boolean);
    const validRoomIds = new Set(availableRooms.map((room) => room.id));
    const roomNameById = new Map(availableRooms.map((room) => [room.id, String(room.name || '').trim() || t({ it: 'Stanza', en: 'Room' })]));
    const selectedRoomIds = Array.from(
      new Set(corridorDoorLinkModal.selectedRoomIds.map((id) => String(id)).filter((id) => validRoomIds.has(id)))
    );
    const current = (plan.corridors || []) as Corridor[];
    const next = current.map((corridor) => {
      if (corridor.id !== corridorDoorLinkModal.corridorId) return corridor;
      return {
        ...corridor,
        doors: (corridor.doors || []).map((door) =>
          door.id === corridorDoorLinkModal.doorId
            ? {
                ...door,
                linkedRoomIds: selectedRoomIds
              }
            : door
        )
      };
    });
    markTouched();
    updateFloorPlan(plan.id, { corridors: next } as any);
    if (selectedRoomIds.length === 1) {
      const name = roomNameById.get(selectedRoomIds[0]) || t({ it: 'Stanza', en: 'Room' });
      push(t({ it: `Porta correttamente collegata con la stanza: "${name}".`, en: `Door successfully linked to room: "${name}".` }), 'success');
    } else if (selectedRoomIds.length > 1) {
      push(t({ it: 'Porta correttamente collegata alle stanze selezionate.', en: 'Door successfully linked to selected rooms.' }), 'success');
    } else {
      push(t({ it: 'Collegamenti stanza rimossi dalla porta.', en: 'Room links removed from the door.' }), 'info');
    }
    setCorridorDoorLinkModal(null);
  }, [corridorDoorLinkModal, isReadOnly, markTouched, plan, push, renderPlan?.rooms, t, updateFloorPlan]);

  const updateCorridorLabelScale = useCallback(
    (corridorId: string, delta: number) => {
      if (isReadOnly || !plan || !corridorId || !Number.isFinite(delta)) return;
      const current = (plan.corridors || []) as Corridor[];
      const next = current.map((corridor) => {
        if (corridor.id !== corridorId) return corridor;
        const currentScale = Number.isFinite(Number((corridor as any).labelScale)) ? Number((corridor as any).labelScale) : 1;
        const nextScale = Math.max(0.6, Math.min(3, Number((currentScale + delta).toFixed(2))));
        return { ...corridor, labelScale: nextScale };
      });
      markTouched();
      updateFloorPlan(plan.id, { corridors: next } as any);
    },
    [isReadOnly, markTouched, plan, updateFloorPlan]
  );

  useEffect(() => {
    if (!selectedCorridorId || isReadOnly) return;
    const handler = (e: KeyboardEvent) => {
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'e') {
        e.preventDefault();
        openEditCorridor(selectedCorridorId);
        return;
      }
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        updateCorridorLabelScale(selectedCorridorId, 0.1);
        return;
      }
      if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        updateCorridorLabelScale(selectedCorridorId, -0.1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isReadOnly, openEditCorridor, selectedCorridorId, updateCorridorLabelScale]);

  const startCorridorDoorDraw = useCallback(
    (corridorId: string) => {
      if (isReadOnly) return;
      setCorridorDoorDraft({ corridorId });
      setCorridorQuickMenu(null);
      setSelectedCorridorDoor(null);
      setSelectedCorridorId(corridorId);
      push(
        t({
          it: 'Seleziona un punto sul bordo del corridoio per inserire una porta.',
          en: 'Select a point on the corridor perimeter to place a door.'
        }),
        'info'
      );
    },
    [isReadOnly, push, t]
  );

  const insertCorridorJunctionPoint = useCallback(
    (corridorId: string, worldPoint: { x: number; y: number }) => {
      if (isReadOnly || !plan) return;
      const current = (plan.corridors || []) as Corridor[];
      const target = current.find((c) => c.id === corridorId);
      if (!target) return;
      const basePoints = getCorridorPolygon(target);
      if (basePoints.length < 3) return;
      const anchor = getClosestCorridorEdge(target, worldPoint);
      if (!anchor) return;
      const splitT = Number(anchor.t);
      // Avoid creating duplicate vertices too close to edge endpoints.
      if (!Number.isFinite(splitT) || splitT <= 0.02 || splitT >= 0.98) {
        push(
          t({
            it: 'Punto troppo vicino a un vertice esistente.',
            en: 'Point is too close to an existing vertex.'
          }),
          'info'
        );
        return;
      }
      const insertIndex = Number(anchor.edgeIndex) + 1;
      const newPoint = { x: Number(anchor.x.toFixed(3)), y: Number(anchor.y.toFixed(3)) };
      const nextPoints = [...basePoints.slice(0, insertIndex), newPoint, ...basePoints.slice(insertIndex)];
      const edgeCount = basePoints.length;
      const remapEdgeRef = (edgeIndexRaw: any, tRaw: any) => {
        const edgeIndex = ((Math.floor(Number(edgeIndexRaw) || 0) % edgeCount) + edgeCount) % edgeCount;
        const rawT = Number(tRaw);
        const tVal = Number.isFinite(rawT) ? Math.max(0, Math.min(1, rawT)) : 0;
        if (edgeIndex < Number(anchor.edgeIndex)) return { edgeIndex, t: tVal };
        if (edgeIndex > Number(anchor.edgeIndex)) return { edgeIndex: edgeIndex + 1, t: tVal };
        if (tVal <= splitT) {
          const den = splitT;
          return { edgeIndex, t: den > 0.000001 ? tVal / den : 0 };
        }
        const den = 1 - splitT;
        return { edgeIndex: edgeIndex + 1, t: den > 0.000001 ? (tVal - splitT) / den : 1 };
      };
      const getEdgePointOnPoints = (points: { x: number; y: number }[], edgeIndex: number, tVal: number) => {
        if (!points.length) return null;
        const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
        const a = points[idx];
        const b = points[(idx + 1) % points.length];
        if (!a || !b) return null;
        const ratio = Math.max(0, Math.min(1, tVal));
        return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
      };
      const next = current.map((corridor) => {
        if (corridor.id !== corridorId) return corridor;
        const doors = (corridor.doors || []).map((door) => {
          const start = remapEdgeRef(door.edgeIndex, door.t);
          const hasEnd = Number.isFinite(Number((door as any).edgeIndexTo)) && Number.isFinite(Number((door as any).tTo));
          const end = hasEnd ? remapEdgeRef((door as any).edgeIndexTo, (door as any).tTo) : null;
          return {
            ...door,
            edgeIndex: start.edgeIndex,
            t: Number(start.t.toFixed(4)),
            edgeIndexTo: end ? end.edgeIndex : undefined,
            tTo: end ? Number(end.t.toFixed(4)) : undefined
          };
        });
        const connections = (corridor.connections || []).map((cp) => {
          const mapped = remapEdgeRef(cp.edgeIndex, cp.t);
          const pt = getEdgePointOnPoints(nextPoints, mapped.edgeIndex, mapped.t);
          return {
            ...cp,
            edgeIndex: mapped.edgeIndex,
            t: Number(mapped.t.toFixed(4)),
            x: pt ? Number(pt.x.toFixed(3)) : (cp as any).x,
            y: pt ? Number(pt.y.toFixed(3)) : (cp as any).y
          };
        });
        return {
          ...corridor,
          kind: 'poly' as const,
          points: nextPoints,
          doors,
          connections
        };
      });
      markTouched();
      updateFloorPlan(plan.id, { corridors: next } as any);
      push(
        t({
          it: 'Punto di snodo inserito nel perimetro del corridoio.',
          en: 'Junction point inserted on corridor perimeter.'
        }),
        'success'
      );
    },
    [getClosestCorridorEdge, getCorridorPolygon, isReadOnly, markTouched, plan, push, t, updateFloorPlan]
  );

  const openCorridorConnectionModalAt = useCallback(
    (corridorId: string, point: { x: number; y: number }) => {
      const corridor = corridors.find((c) => c.id === corridorId);
      if (!corridor) return;
      const anchor = getClosestCorridorEdge(corridor, point);
      if (!anchor) return;
      setCorridorConnectionModal({
        connectionId: null,
        corridorId,
        edgeIndex: anchor.edgeIndex,
        t: Number(anchor.t.toFixed(4)),
        x: Number(point.x.toFixed(3)),
        y: Number(point.y.toFixed(3)),
        selectedPlanIds: [],
        transitionType: 'stairs'
      });
    },
    [corridors, getClosestCorridorEdge]
  );

  const openEditCorridorConnectionModal = useCallback(
    (corridorId: string, connectionId: string, point?: { x: number; y: number }) => {
      const corridor = corridors.find((c) => c.id === corridorId);
      if (!corridor) return;
      const connection = (corridor.connections || []).find((cp) => cp.id === connectionId);
      if (!connection) return;
      const fallbackPoint =
        point ||
        (Number.isFinite(Number((connection as any).x)) && Number.isFinite(Number((connection as any).y))
          ? { x: Number((connection as any).x), y: Number((connection as any).y) }
          : getCorridorEdgePoint(corridor, Number(connection.edgeIndex), Number(connection.t)));
      if (!fallbackPoint) return;
      const anchor = getClosestCorridorEdge(corridor, fallbackPoint);
      if (!anchor) return;
      setCorridorConnectionModal({
        connectionId,
        corridorId,
        edgeIndex: Number(anchor.edgeIndex),
        t: Number(anchor.t.toFixed(4)),
        x: Number(fallbackPoint.x.toFixed(3)),
        y: Number(fallbackPoint.y.toFixed(3)),
        selectedPlanIds: Array.from(new Set((connection.planIds || []).filter(Boolean))),
        transitionType: (connection as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs'
      });
    },
    [corridors, getClosestCorridorEdge, getCorridorEdgePoint]
  );

  const saveCorridorConnectionModal = useCallback(() => {
    if (!plan || !corridorConnectionModal || isReadOnly) return;
    const selectedPlanIds = Array.from(new Set(corridorConnectionModal.selectedPlanIds.filter(Boolean)));
    const current = (plan.corridors || []) as Corridor[];
    const isEdit = !!corridorConnectionModal.connectionId;
    const next = current.map((c) => {
      if (c.id !== corridorConnectionModal.corridorId) return c;
      const prevConnections = Array.isArray(c.connections) ? c.connections : [];
      const payload = {
        edgeIndex: corridorConnectionModal.edgeIndex,
        t: corridorConnectionModal.t,
        planIds: selectedPlanIds,
        x: corridorConnectionModal.x,
        y: corridorConnectionModal.y,
        transitionType: corridorConnectionModal.transitionType === 'elevator' ? 'elevator' : 'stairs'
      };
      if (isEdit) {
        const connectionId = String(corridorConnectionModal.connectionId);
        let found = false;
        const updated = prevConnections.map((cp) => {
          if (cp.id !== connectionId) return cp;
          found = true;
          return { ...cp, ...payload };
        });
        return {
          ...c,
          connections: found ? updated : [...updated, { id: connectionId, ...payload }]
        };
      }
      return {
        ...c,
        connections: [
          ...prevConnections,
          {
            id: nanoid(),
            ...payload
          }
        ]
      };
    });
    markTouched();
    updateFloorPlan(plan.id, { corridors: next } as any);
    push(
      isEdit
        ? t({ it: 'Punto di collegamento aggiornato', en: 'Connection point updated' })
        : t({ it: 'Punto di collegamento creato', en: 'Connection point created' }),
      'success'
    );
    setCorridorConnectionModal(null);
  }, [corridorConnectionModal, isReadOnly, markTouched, plan, push, t, updateFloorPlan]);

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
    const room = (renderPlan.rooms || []).find((r) => r.id === roomModal.roomId);
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
  }, [openRoomWallTypes, renderPlan, roomModal, t]);

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
        mode: 'place',
        type,
        x,
        y,
        roomId,
        roomName: room?.name || t({ it: 'Stanza', en: 'Room' }),
        capacity
      });
      return true;
    },
    [plan, roomStatsById, rooms, t]
  );

  const handlePlaceNew = (
    type: MapObjectType,
    x: number,
    y: number,
    options?: { textBoxWidth?: number; textBoxHeight?: number }
  ) => {
    if (isReadOnly) return;
    if (panToolActive) setPanToolActive(false);
    if (shouldConfirmCapacity(type, x, y)) return;
    if (type === 'real_user' || type === 'user' || type === 'generic_user') {
      proceedPlaceUser(type, x, y);
      return;
    }
    if (isDeskType(type)) {
      if (!plan) return;
      markTouched();
      const label = getTypeLabel(type);
      const name = '';
      const id = addObject(
        plan.id,
        type,
        name,
        undefined,
        x,
        y,
        defaultObjectScale,
        ['desks'],
        { opacity: 1, rotation: 0, strokeWidth: 2, strokeColor: '#cbd5e1', scaleX: 1, scaleY: 1 }
      );
      ensureObjectLayerVisible(['desks'], label, type);
      lastInsertedRef.current = { id, name: label };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, x, y);
      if (roomId) updateObject(id, { roomId });
      push(t({ it: `Oggetto creato: ${label}`, en: `Object created: ${label}` }), 'success');
      postAuditEvent({
        event: 'object_create',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { id, type, name: label, roomId: roomId || null }
      });
      setPendingType(null);
      return;
    }
    const textBoxWidth =
      type === 'text' && Number.isFinite(options?.textBoxWidth as number) ? Number(options?.textBoxWidth) : undefined;
    const textBoxHeight =
      type === 'text' && Number.isFinite(options?.textBoxHeight as number) ? Number(options?.textBoxHeight) : undefined;
    setModalState({
      mode: 'create',
      type,
      coords: { x, y },
      ...(type === 'text' ? { textBoxWidth, textBoxHeight } : {})
    });
    setPendingType(null);
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

  const handleCreate = (payload: {
    name: string;
    description?: string;
    notes?: string;
    lastVerificationAt?: string;
    verifierCompany?: string;
    gpsCoords?: string;
    securityDocuments?: any[];
    securityCheckHistory?: any[];
    layerIds?: string[];
    customValues?: Record<string, any>;
    scale?: number;
    quoteLabelScale?: number;
    quoteLabelBg?: boolean;
    quoteLabelColor?: string;
    quoteLabelOffset?: number;
    quoteLabelPos?: 'center' | 'above' | 'below' | 'left' | 'right';
    quoteDashed?: boolean;
    quoteEndpoint?: 'arrows' | 'dots' | 'none';
    strokeColor?: string;
    textFont?: string;
    textSize?: number;
    textColor?: string;
    textBg?: boolean;
    textBgColor?: string;
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    wifiDb?: number;
    wifiStandard?: string;
    wifiBand24?: boolean;
    wifiBand5?: boolean;
    wifiBand6?: boolean;
    wifiBrand?: string;
    wifiModel?: string;
    wifiModelCode?: string;
    wifiCoverageSqm?: number;
    wifiCatalogId?: string;
    wifiShowRange?: boolean;
    wifiRangeScale?: number;
    ip?: string;
    url?: string;
  }) => {
    if (!plan || !modalState || isReadOnly) return;
    if (modalState.mode === 'create') {
      markTouched();
      const nextScale = Number.isFinite(payload.scale as number) ? Number(payload.scale) : defaultObjectScale;
      const rawTextBoxWidth = modalState.type === 'text' ? Number((modalState as any).textBoxWidth) : undefined;
      const rawTextBoxHeight = modalState.type === 'text' ? Number((modalState as any).textBoxHeight) : undefined;
      const resolvedTextBoxWidth =
        Number.isFinite(rawTextBoxWidth as number) && (rawTextBoxWidth as number) > 0
          ? Math.max(80, Number(rawTextBoxWidth))
          : undefined;
      const resolvedTextBoxHeight =
        Number.isFinite(rawTextBoxHeight as number) && (rawTextBoxHeight as number) > 0
          ? Math.max(32, Number(rawTextBoxHeight))
          : undefined;
      const resolvedQuoteLabelPos = payload.quoteLabelPos || (lastQuoteLabelPosH as any);
      const resolvedQuoteLabelBg = payload.quoteLabelBg ?? lastQuoteLabelBg;
      const extra = {
        ...(isCameraType(modalState.type) ? getCameraDefaults() : {}),
        ...(modalState.type === 'quote'
          ? {
              strokeColor: payload.strokeColor || lastQuoteColor || '#f97316',
              quoteLabelScale: Number.isFinite(payload.quoteLabelScale as number)
                ? Number(payload.quoteLabelScale)
                : Number(lastQuoteLabelScale) || 1,
              quoteLabelBg: resolvedQuoteLabelBg,
              quoteLabelPos: resolvedQuoteLabelPos,
              quoteLabelColor: payload.quoteLabelColor || lastQuoteLabelColor || '#0f172a',
              quoteLabelOffset: Number.isFinite(payload.quoteLabelOffset as number)
                ? Number(payload.quoteLabelOffset)
                : undefined,
              quoteDashed: payload.quoteDashed ?? lastQuoteDashed,
              quoteEndpoint: payload.quoteEndpoint || lastQuoteEndpoint
            }
          : {}),
        ...(modalState.type === 'wifi'
          ? {
              wifiDb: payload.wifiDb,
              wifiStandard: payload.wifiStandard || WIFI_DEFAULT_STANDARD,
              wifiBand24: payload.wifiBand24,
              wifiBand5: payload.wifiBand5,
              wifiBand6: payload.wifiBand6,
              wifiBrand: payload.wifiBrand,
              wifiModel: payload.wifiModel,
              wifiModelCode: payload.wifiModelCode,
              wifiCoverageSqm: payload.wifiCoverageSqm,
              wifiCatalogId: payload.wifiCatalogId,
              wifiShowRange: payload.wifiShowRange ?? true,
              wifiRangeScale: payload.wifiRangeScale
            }
          : {}),
        ...(modalState.type === 'text'
          ? {
              textFont: payload.textFont,
              textSize: payload.textSize,
              textColor: payload.textColor,
              textBg: payload.textBg ?? false,
              textBgColor: payload.textBgColor || '#ffffff',
              ...(resolvedTextBoxWidth ? { textBoxWidth: resolvedTextBoxWidth } : {}),
              ...(resolvedTextBoxHeight ? { textBoxHeight: resolvedTextBoxHeight } : {})
            }
          : {}),
        ...(modalState.type === 'image' || modalState.type === 'photo'
          ? {
              imageUrl: payload.imageUrl,
              imageWidth: payload.imageWidth,
              imageHeight: payload.imageHeight
            }
          : {}),
        ...(payload.ip !== undefined ? { ip: payload.ip } : {}),
        ...(payload.url !== undefined ? { url: payload.url } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.lastVerificationAt !== undefined ? { lastVerificationAt: payload.lastVerificationAt } : {}),
        ...(payload.verifierCompany !== undefined ? { verifierCompany: payload.verifierCompany } : {}),
        ...(payload.gpsCoords !== undefined ? { gpsCoords: payload.gpsCoords } : {}),
        ...(payload.securityDocuments !== undefined ? { securityDocuments: payload.securityDocuments } : {}),
        ...(payload.securityCheckHistory !== undefined ? { securityCheckHistory: payload.securityCheckHistory } : {})
      };
      const fallbackLayerIds =
        modalState.type === 'quote' ? ['quotes'] : (getTypeLayerIds(modalState.type) || inferDefaultLayerIds(modalState.type, layerIdSet));
      const layerIds =
        modalState.type === 'quote' ? ['quotes'] : (payload.layerIds?.length ? payload.layerIds : fallbackLayerIds);
      const id = addObject(
        plan.id,
        modalState.type,
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        Math.max(0.2, Math.min(2.4, nextScale || 1)),
        layerIds,
        Object.keys(extra).length ? extra : undefined
      );
      ensureObjectLayerVisible(layerIds, payload.name, modalState.type);
      if (modalState.type === 'quote') {
        setLastQuoteScale(Math.max(0.5, Math.min(1.6, nextScale || 1)));
        if (payload.strokeColor) setLastQuoteColor(payload.strokeColor);
        if (payload.quoteLabelScale !== undefined) setLastQuoteLabelScale(payload.quoteLabelScale);
        if (resolvedQuoteLabelBg !== undefined) setLastQuoteLabelBg(resolvedQuoteLabelBg);
        if (payload.quoteLabelColor) setLastQuoteLabelColor(payload.quoteLabelColor);
        if (payload.quoteLabelPos) {
          setLastQuoteLabelPosH(payload.quoteLabelPos as any);
          setLastQuoteLabelPosV(payload.quoteLabelPos as any);
        }
        if (payload.quoteDashed !== undefined) setLastQuoteDashed(payload.quoteDashed);
        if (payload.quoteEndpoint) setLastQuoteEndpoint(payload.quoteEndpoint);
      } else {
        setLastObjectScale(Math.max(0.2, Math.min(2.4, nextScale || 1)));
      }
      lastInsertedRef.current = { id, name: payload.name };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      if (roomId) updateObject(id, { roomId });
      if (payload.customValues && Object.keys(payload.customValues).length) {
        saveCustomValues(id, modalState.type, payload.customValues).catch(() => {});
      }
      push(
        t({ it: `Oggetto creato: ${payload.name}`, en: `Object created: ${payload.name}` }),
        'success'
      );
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
      const scale = Number.isFinite(payload.scale as number) ? Number(payload.scale) : (base?.scale ?? 1);
      const resolvedDupLabelPos =
        payload.quoteLabelPos || (base as any)?.quoteLabelPos || (lastQuoteLabelPosH as any);
      const resolvedDupLabelBg = payload.quoteLabelBg ?? (base as any)?.quoteLabelBg ?? lastQuoteLabelBg;
      const extra = {
        ...(base && isCameraType(base.type)
          ? {
              rotation: base.rotation ?? 0,
              cctvRange: (base as any).cctvRange ?? 160,
              cctvAngle: (base as any).cctvAngle ?? 70,
              cctvOpacity: (base as any).cctvOpacity ?? 0.6
            }
          : {}),
        ...(base?.type === 'quote'
          ? {
              strokeColor: payload.strokeColor || base?.strokeColor || lastQuoteColor || '#f97316',
              quoteLabelScale: Number.isFinite(payload.quoteLabelScale as number)
                ? Number(payload.quoteLabelScale)
                : Number((base as any)?.quoteLabelScale) || Number(lastQuoteLabelScale) || 1,
              quoteLabelBg: resolvedDupLabelBg,
              quoteLabelPos: resolvedDupLabelPos,
              quoteLabelColor: payload.quoteLabelColor || (base as any)?.quoteLabelColor || lastQuoteLabelColor || '#0f172a',
              quoteLabelOffset: Number.isFinite(payload.quoteLabelOffset as number)
                ? Number(payload.quoteLabelOffset)
                : Number((base as any)?.quoteLabelOffset) || undefined,
              quoteDashed: payload.quoteDashed ?? (base as any)?.quoteDashed ?? lastQuoteDashed,
              quoteEndpoint: payload.quoteEndpoint || (base as any)?.quoteEndpoint || lastQuoteEndpoint
            }
          : {}),
        ...(base?.type === 'wifi'
          ? {
              wifiDb: payload.wifiDb ?? (base as any).wifiDb,
              wifiStandard: payload.wifiStandard || (base as any).wifiStandard || WIFI_DEFAULT_STANDARD,
              wifiBand24: payload.wifiBand24 ?? (base as any).wifiBand24,
              wifiBand5: payload.wifiBand5 ?? (base as any).wifiBand5,
              wifiBand6: payload.wifiBand6 ?? (base as any).wifiBand6,
              wifiBrand: payload.wifiBrand ?? (base as any).wifiBrand,
              wifiModel: payload.wifiModel ?? (base as any).wifiModel,
              wifiModelCode: payload.wifiModelCode ?? (base as any).wifiModelCode,
              wifiCoverageSqm: payload.wifiCoverageSqm ?? (base as any).wifiCoverageSqm,
              wifiCatalogId: payload.wifiCatalogId ?? (base as any).wifiCatalogId,
              wifiShowRange: payload.wifiShowRange ?? (base as any).wifiShowRange,
              wifiRangeScale: payload.wifiRangeScale ?? (base as any).wifiRangeScale
            }
          : {}),
        ...(base?.type === 'text'
          ? {
              textFont: payload.textFont || (base as any).textFont,
              textSize: payload.textSize ?? (base as any).textSize,
              textColor: payload.textColor || (base as any).textColor,
              textBg: payload.textBg ?? (base as any).textBg,
              textBgColor: payload.textBgColor || (base as any).textBgColor,
              textBoxWidth: (base as any).textBoxWidth,
              textBoxHeight: (base as any).textBoxHeight
            }
          : {}),
        ...(base?.type === 'image' || base?.type === 'photo'
          ? {
              imageUrl: payload.imageUrl || (base as any).imageUrl,
              imageWidth: payload.imageWidth ?? (base as any).imageWidth,
              imageHeight: payload.imageHeight ?? (base as any).imageHeight
            }
          : {}),
        ip: payload.ip ?? (base as any)?.ip,
        url: payload.url ?? (base as any)?.url,
        notes: payload.notes ?? (base as any)?.notes,
        lastVerificationAt: payload.lastVerificationAt ?? (base as any)?.lastVerificationAt,
        verifierCompany: payload.verifierCompany ?? (base as any)?.verifierCompany,
        gpsCoords: payload.gpsCoords ?? (base as any)?.gpsCoords,
        securityDocuments: payload.securityDocuments ?? (base as any)?.securityDocuments,
        securityCheckHistory: payload.securityCheckHistory ?? (base as any)?.securityCheckHistory
      };
      const layerIds =
        base?.type === 'quote'
          ? ['quotes']
          : (payload.layerIds?.length ? payload.layerIds : inferDefaultLayerIds(base?.type || 'user', layerIdSet));
      const id = addObject(
        plan.id,
        base?.type || 'user',
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        Math.max(0.2, Math.min(2.4, scale || 1)),
        layerIds,
        Object.keys(extra).length ? extra : undefined
      );
      ensureObjectLayerVisible(layerIds, payload.name, base?.type || 'user');
      if (base?.type === 'quote') {
        setLastQuoteScale(Math.max(0.5, Math.min(1.6, scale || 1)));
        if (payload.strokeColor) setLastQuoteColor(payload.strokeColor);
        if (payload.quoteLabelScale !== undefined) setLastQuoteLabelScale(payload.quoteLabelScale);
        if (resolvedDupLabelBg !== undefined) setLastQuoteLabelBg(resolvedDupLabelBg);
        if (payload.quoteLabelColor) setLastQuoteLabelColor(payload.quoteLabelColor);
        if (payload.quoteLabelPos) {
          const orientation = getQuoteOrientation((base as any)?.points);
          if (orientation === 'vertical') setLastQuoteLabelPosV(payload.quoteLabelPos as any);
          else setLastQuoteLabelPosH(payload.quoteLabelPos as any);
        }
        if (payload.quoteDashed !== undefined) setLastQuoteDashed(payload.quoteDashed);
        if (payload.quoteEndpoint) setLastQuoteEndpoint(payload.quoteEndpoint);
      } else {
        setLastObjectScale(Math.max(0.2, Math.min(2.4, scale || 1)));
      }
      lastInsertedRef.current = { id, name: payload.name };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      if (roomId) updateObject(id, { roomId });
      if (payload.customValues && Object.keys(payload.customValues).length) {
        saveCustomValues(id, base?.type || 'user', payload.customValues).catch(() => {});
      }
      push(
        t({ it: `Oggetto duplicato: ${payload.name}`, en: `Object duplicated: ${payload.name}` }),
        'success'
      );
      postAuditEvent({
        event: 'object_duplicate',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { fromId: modalState.objectId, id, type: base?.type, name: payload.name, roomId: roomId || null }
      });
    }
  };

  const handleEdit = (objectId: string) => {
    const obj = renderPlan?.objects.find((o) => o.id === objectId);
    if (obj?.type === 'rack') {
      setRackModal({ objectId });
      return;
    }
    if (obj && isDeskType(obj.type)) return;
    if (obj && isWallType(obj.type)) {
      if (openWallGroupModal(obj.id)) return;
      setWallTypeModal({ ids: [obj.id], typeId: obj.type });
      return;
    }
    setModalState({ mode: 'edit', objectId });
  };
  const openEditFromSelectionList = (objectId: string) => {
    returnToSelectionListRef.current = true;
    setSelectedObjectsModalOpen(false);
    const obj = renderPlan?.objects.find((o) => o.id === objectId);
    if (obj && isDeskType(obj.type)) return;
    if (obj && isWallType(obj.type)) {
      if (openWallGroupModal(obj.id)) return;
      setWallTypeModal({ ids: [obj.id], typeId: obj.type });
      return;
    }
    setModalState({ mode: 'edit', objectId });
  };
  const openLinkEditFromSelectionList = (linkId: string) => {
    returnToSelectionListRef.current = true;
    setSelectedObjectsModalOpen(false);
    setLinkEditId(linkId);
  };

  const openMediaViewer = useCallback(
    (payload: {
      id: string;
      selectionIds?: string[];
      types: string[];
      title: { it: string; en: string };
      countLabel: { it: string; en: string };
      itemLabel: { it: string; en: string };
      emptyToast: { it: string; en: string };
      emptyLabel?: { it: string; en: string };
    }) => {
      if (!renderPlan) return;
      const selection =
        Array.isArray(payload.selectionIds) && payload.selectionIds.length > 0 ? payload.selectionIds : [payload.id];
      const roomNameById = new Map<string, string>();
      for (const room of renderPlan.rooms || []) {
        if (!room?.id) continue;
        roomNameById.set(String(room.id), String(room.name || '').trim());
      }
      const items = selection
        .map((id) => renderPlan.objects.find((o) => o.id === id))
        .filter((obj): obj is MapObject => !!obj && payload.types.includes(obj.type) && !!(obj as any).imageUrl)
        .map((obj) => ({
          id: obj.id,
          name: String(obj.name || '').trim(),
          description: String(obj.description || '').trim(),
          url: String((obj as any).imageUrl || ''),
          roomName: obj.roomId ? roomNameById.get(String(obj.roomId)) || '' : ''
        }))
        .filter((p) => !!p.url);
      if (!items.length) {
        push(t(payload.emptyToast), 'info');
        return;
      }
      setPhotoViewer({
        photos: items,
        initialId: payload.id,
        title: payload.title,
        countLabel: payload.countLabel,
        itemLabel: payload.itemLabel,
        emptyLabel: payload.emptyLabel
      });
    },
    [push, renderPlan, t]
  );

  const openPhotoViewer = useCallback(
    (payload: { id: string; selectionIds?: string[] }) => {
      openMediaViewer({
        ...payload,
        types: ['photo'],
        title: { it: 'Foto', en: 'Photos' },
        countLabel: { it: 'foto', en: 'photos' },
        itemLabel: { it: 'Foto', en: 'Photo' },
        emptyToast: { it: 'Nessuna foto disponibile per la selezione.', en: 'No photos available for this selection.' },
        emptyLabel: { it: 'Nessuna foto disponibile', en: 'No photos available' }
      });
    },
    [openMediaViewer]
  );

  const openImageViewer = useCallback(
    (payload: { id: string; selectionIds?: string[] }) => {
      openMediaViewer({
        ...payload,
        types: ['image'],
        title: { it: 'Immagini', en: 'Images' },
        countLabel: { it: 'immagini', en: 'images' },
        itemLabel: { it: 'Immagine', en: 'Image' },
        emptyToast: { it: 'Nessuna immagine disponibile per la selezione.', en: 'No images available for this selection.' },
        emptyLabel: { it: 'Nessuna immagine disponibile', en: 'No images available' }
      });
    },
    [openMediaViewer]
  );

  const focusPhotoFromGallery = useCallback(
    (id: string) => {
      if (!renderPlan) return;
      returnToBulkEditRef.current = false;
      const obj = renderPlan.objects.find((o) => o.id === id);
      if (!obj) return;
      setSelection([id]);
      setSelectedObject(id);
      setSelectedRoomId(undefined);
      setSelectedRoomIds([]);
      setSelectedLinkId(null);
      triggerHighlight(id);
    },
    [renderPlan, setSelectedLinkId, setSelectedObject, setSelectedRoomId, setSelectedRoomIds, setSelection, triggerHighlight]
  );

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

  const handleUpdate = (payload: {
    name: string;
    description?: string;
    notes?: string;
    lastVerificationAt?: string;
    verifierCompany?: string;
    gpsCoords?: string;
    securityDocuments?: any[];
    securityCheckHistory?: any[];
    layerIds?: string[];
    customValues?: Record<string, any>;
    scale?: number;
    quoteLabelScale?: number;
    quoteLabelBg?: boolean;
    quoteLabelColor?: string;
    quoteLabelOffset?: number;
    quoteLabelPos?: 'center' | 'above' | 'below' | 'left' | 'right';
    quoteDashed?: boolean;
    quoteEndpoint?: 'arrows' | 'dots' | 'none';
    strokeColor?: string;
    textFont?: string;
    textSize?: number;
    textColor?: string;
    textBg?: boolean;
    textBgColor?: string;
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    wifiDb?: number;
    wifiStandard?: string;
    wifiBand24?: boolean;
    wifiBand5?: boolean;
    wifiBand6?: boolean;
    wifiBrand?: string;
    wifiModel?: string;
    wifiModelCode?: string;
    wifiCoverageSqm?: number;
    wifiCatalogId?: string;
    wifiShowRange?: boolean;
    wifiRangeScale?: number;
    ip?: string;
    url?: string;
  }) => {
    if (!modalState || modalState.mode !== 'edit' || isReadOnly) return;
    markTouched();
    const obj = plan?.objects?.find((o) => o.id === modalState.objectId);
    const isQuote = obj?.type === 'quote';
    const resolvedQuoteLabelBg = payload.quoteLabelBg;
	    const wifiUpdates =
	      obj?.type === 'wifi'
	        ? {
	            wifiDb: payload.wifiDb,
	            wifiStandard: payload.wifiStandard || WIFI_DEFAULT_STANDARD,
	            wifiBand24: payload.wifiBand24,
	            wifiBand5: payload.wifiBand5,
	            wifiBand6: payload.wifiBand6,
	            wifiBrand: payload.wifiBrand,
	            wifiModel: payload.wifiModel,
	            wifiModelCode: payload.wifiModelCode,
	            wifiCoverageSqm: payload.wifiCoverageSqm,
	            wifiCatalogId: payload.wifiCatalogId,
	            wifiShowRange: payload.wifiShowRange,
	            wifiRangeScale: payload.wifiRangeScale
	          }
	        : {};
    const textUpdates =
      obj?.type === 'text'
        ? {
            ...(payload.textFont ? { textFont: payload.textFont } : {}),
            ...(payload.textSize !== undefined ? { textSize: payload.textSize } : {}),
            ...(payload.textColor ? { textColor: payload.textColor } : {}),
            ...(payload.textBg !== undefined ? { textBg: payload.textBg } : {}),
            ...(payload.textBgColor ? { textBgColor: payload.textBgColor } : {})
          }
        : {};
    const imageUpdates =
      obj?.type === 'image' || obj?.type === 'photo'
        ? {
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
            ...(payload.imageWidth !== undefined ? { imageWidth: payload.imageWidth } : {}),
            ...(payload.imageHeight !== undefined ? { imageHeight: payload.imageHeight } : {})
          }
        : {};
    updateObject(modalState.objectId, {
      name: payload.name,
      description: payload.description,
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.lastVerificationAt !== undefined ? { lastVerificationAt: payload.lastVerificationAt } : {}),
      ...(payload.verifierCompany !== undefined ? { verifierCompany: payload.verifierCompany } : {}),
      ...(payload.gpsCoords !== undefined ? { gpsCoords: payload.gpsCoords } : {}),
      ...(payload.securityDocuments !== undefined ? { securityDocuments: payload.securityDocuments } : {}),
      ...(payload.securityCheckHistory !== undefined ? { securityCheckHistory: payload.securityCheckHistory } : {}),
      ...(payload.ip !== undefined ? { ip: payload.ip } : {}),
      ...(payload.url !== undefined ? { url: payload.url } : {}),
      layerIds: isQuote ? ['quotes'] : (payload.layerIds ?? obj?.layerIds),
      ...(payload.scale !== undefined ? { scale: Math.max(0.2, Math.min(2.4, Number(payload.scale) || 1)) } : {}),
      ...(isQuote && payload.quoteLabelScale !== undefined
        ? { quoteLabelScale: Math.max(0.6, Math.min(2, Number(payload.quoteLabelScale) || 1)) }
        : {}),
      ...(isQuote && resolvedQuoteLabelBg !== undefined ? { quoteLabelBg: resolvedQuoteLabelBg } : {}),
      ...(isQuote && payload.quoteLabelColor ? { quoteLabelColor: payload.quoteLabelColor } : {}),
      ...(isQuote && payload.quoteLabelOffset !== undefined
        ? { quoteLabelOffset: Math.max(0.5, Math.min(2, Number(payload.quoteLabelOffset) || 1)) }
        : {}),
      ...(isQuote && payload.quoteLabelPos ? { quoteLabelPos: payload.quoteLabelPos } : {}),
      ...(isQuote && payload.quoteDashed !== undefined ? { quoteDashed: payload.quoteDashed } : {}),
      ...(isQuote && payload.quoteEndpoint ? { quoteEndpoint: payload.quoteEndpoint } : {}),
      ...(isQuote && payload.strokeColor ? { strokeColor: payload.strokeColor } : {}),
      ...(wifiUpdates as any),
      ...(textUpdates as any),
      ...(imageUpdates as any)
    });
      if (isQuote) {
        if (payload.scale !== undefined) setLastQuoteScale(Math.max(0.5, Math.min(1.6, Number(payload.scale) || 1)));
        if (payload.quoteLabelScale !== undefined) setLastQuoteLabelScale(payload.quoteLabelScale);
        if (resolvedQuoteLabelBg !== undefined) setLastQuoteLabelBg(resolvedQuoteLabelBg);
        if (payload.quoteLabelColor) setLastQuoteLabelColor(payload.quoteLabelColor);
        if (payload.quoteLabelPos) {
          const orientation = getQuoteOrientation(obj?.points);
          if (orientation === 'vertical') setLastQuoteLabelPosV(payload.quoteLabelPos as any);
          else setLastQuoteLabelPosH(payload.quoteLabelPos as any);
        }
        if (payload.strokeColor) setLastQuoteColor(payload.strokeColor);
        if (payload.quoteDashed !== undefined) setLastQuoteDashed(payload.quoteDashed);
        if (payload.quoteEndpoint) setLastQuoteEndpoint(payload.quoteEndpoint);
    } else if (payload.scale !== undefined) {
      setLastObjectScale(Math.max(0.2, Math.min(2.4, Number(payload.scale) || 1)));
    }
    if (obj && payload.customValues) {
      saveCustomValues(modalState.objectId, obj.type, payload.customValues).catch(() => {});
    }
    push(
      t({ it: `Oggetto aggiornato: ${payload.name}`, en: `Object updated: ${payload.name}` }),
      'success'
    );
    postAuditEvent({
      event: 'object_update',
      scopeType: 'plan',
      scopeId: planId,
      details: { id: modalState.objectId, name: payload.name, description: payload.description || '', layerIds: payload.layerIds || [] }
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
  const getClientSearchIndex = useCallback(() => {
    if (!client) return [] as { planId: string; search: string; result: CrossPlanSearchResult }[];
    const key = `${client.id}:${dataVersion}`;
    if (clientSearchIndexRef.current.key === key) return clientSearchIndexRef.current.value;
    const out: { planId: string; search: string; result: CrossPlanSearchResult }[] = [];
    for (const s of client.sites || []) {
      for (const p of s.floorPlans || []) {
        for (const o of p.objects || []) {
          if (isDeskType(o.type)) continue;
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
    if (!term.trim()) {
      setSearchResultsOpen(false);
      setSearchResultsTerm('');
      setSearchResultsObjects([]);
      setSearchResultsRooms([]);
      setCrossPlanSearchOpen(false);
      setCrossPlanSearchTerm('');
      clearSelection();
      setSelectedRoomId(undefined);
      setSelectedRoomIds([]);
      setHighlightRoom(null);
      return;
    }
    const normalized = term.trim().toLowerCase();
    const simpleObjectMatches = (renderPlan.objects || []).filter(
      (o) =>
        !isDeskType(o.type) &&
        (String(o.name || '').toLowerCase().includes(normalized) ||
          String(o.description || '').toLowerCase().includes(normalized))
    );
    const simpleRoomMatches = (renderPlan.rooms || []).filter((r) =>
      String(r.name || '').toLowerCase().includes(normalized)
    );
    if (searchDebugEnabled) {
      console.log('[search-debug] simple', {
        term,
        normalized,
        objects: simpleObjectMatches.map((o) => o.name),
        rooms: simpleRoomMatches.map((r) => r.name)
      });
    }
    if (simpleObjectMatches.length + simpleRoomMatches.length > 1) {
      setSearchResultsTerm(term);
      setSearchResultsObjects(simpleObjectMatches);
      setSearchResultsRooms(simpleRoomMatches);
      setSearchResultsOpen(true);
      if (searchDebugEnabled) {
        console.log('[search-debug] open popover (simple matches)', {
          total: simpleObjectMatches.length + simpleRoomMatches.length
        });
      }
      return;
    }
    const collectMatches = (objects: MapObject[] = [], rooms: Room[] = []) => {
      const objMatches: MapObject[] = [];
      const roomMatches: Room[] = [];
      for (const o of objects) {
        if (isDeskType(o.type)) continue;
        const first = String((o as any).firstName || '').trim();
        const last = String((o as any).lastName || '').trim();
        const email = String((o as any).externalEmail || (o as any).email || '').trim();
        const role = String((o as any).externalRole || '').trim();
        const dept = [o.externalDept1, o.externalDept2, o.externalDept3].filter(Boolean).join(' ');
        const label =
          o.type === 'real_user' && (first || last)
            ? `${first} ${last}`.trim()
            : String(o.name || '').trim();
        const search = `${label} ${o.name || ''} ${o.description || ''} ${first} ${last} ${email} ${role} ${dept}`.toLowerCase();
        if (search.includes(normalized)) objMatches.push(o);
      }
      for (const r of rooms) {
        if (String(r.name || '').toLowerCase().includes(normalized)) roomMatches.push(r);
      }
      return { objMatches, roomMatches };
    };
    const primary = collectMatches(renderPlan.objects || [], renderPlan.rooms || []);
    const fallback =
      plan && plan !== renderPlan ? collectMatches(plan.objects || [], plan.rooms || []) : { objMatches: [], roomMatches: [] };
    const objectMatchesById = new Map<string, MapObject>();
    const roomMatchesById = new Map<string, Room>();
    for (const o of [...primary.objMatches, ...fallback.objMatches]) objectMatchesById.set(o.id, o);
    for (const r of [...primary.roomMatches, ...fallback.roomMatches]) roomMatchesById.set(r.id, r);
    const objectMatches = Array.from(objectMatchesById.values());
    const roomMatches = Array.from(roomMatchesById.values());
    const indexMatches = client
      ? getClientSearchIndex()
          .filter((x) => x.planId === renderPlan.id && x.search.includes(normalized))
          .map((x) => x.result)
      : [];
    const indexObjectIds = Array.from(new Set(indexMatches.filter((m) => m.kind === 'object').map((m) => (m as any).objectId).filter(Boolean)));
    const indexRoomIds = Array.from(new Set(indexMatches.filter((m) => m.kind === 'room').map((m) => (m as any).roomId).filter(Boolean)));
    const findObjectById = (id: string) =>
      renderPlan.objects.find((o) => o.id === id) || (plan?.objects || []).find((o) => o.id === id);
    const findRoomById = (id: string) =>
      (renderPlan.rooms || []).find((r) => r.id === id) || (plan?.rooms || []).find((r) => r.id === id);
    const indexObjects = indexObjectIds
      .map((id) => findObjectById(id))
      .filter((obj): obj is MapObject => !!obj && !isDeskType(obj.type));
    const indexRooms = indexRoomIds.map((id) => findRoomById(id)).filter(Boolean) as Room[];
    const mergedObjects = objectMatches.length ? objectMatches : indexObjects;
    const mergedRooms = roomMatches.length ? roomMatches : indexRooms;
    const totalMatches = mergedObjects.length + mergedRooms.length;
    if (searchDebugEnabled) {
      console.log('[search-debug] merged', {
        term,
        objects: mergedObjects.map((o) => o.name),
        rooms: mergedRooms.map((r) => r.name),
        total: totalMatches
      });
    }

    if (!totalMatches) {
      const crossResults: CrossPlanSearchResult[] = client
        ? getClientSearchIndex().filter((x) => x.search.includes(normalized)).map((x) => x.result)
        : [];
      if (!crossResults.length) {
        push(t({ it: 'Nessun risultato trovato', en: 'No results found' }), 'info');
        return;
      }
      setCrossPlanSearchTerm(term);
      setCrossPlanResults(crossResults);
      setCrossPlanSearchOpen(true);
      return;
    }
    if (totalMatches === 1) {
      const onlyObject = mergedObjects.length === 1 ? mergedObjects[0] : null;
      const onlyRoom = !onlyObject && mergedRooms.length === 1 ? mergedRooms[0] : null;
      const isExactObjectMatch =
        !!onlyObject && String(onlyObject.name || '').trim().toLowerCase() === normalized;
      const isExactRoomMatch =
        !!onlyRoom && String(onlyRoom.name || '').trim().toLowerCase() === normalized;
      if (isExactObjectMatch && onlyObject) {
        if (promptRevealForObject(onlyObject)) return;
        setSelectedObject(onlyObject.id);
        triggerHighlight(onlyObject.id);
        if (searchDebugEnabled) {
          console.log('[search-debug] exact object match', onlyObject.name);
        }
        return;
      }
      if (isExactRoomMatch && onlyRoom) {
        clearSelection();
        setSelectedRoomId(onlyRoom.id);
        setSelectedRoomIds([onlyRoom.id]);
        setHighlightRoom({ roomId: onlyRoom.id, until: Date.now() + 3200 });
        if (searchDebugEnabled) {
          console.log('[search-debug] exact room match', onlyRoom.name);
        }
        return;
      }
    }
    // Multiple matches: let the user pick which one to focus
    setSearchResultsTerm(term);
    setSearchResultsObjects(mergedObjects);
    setSearchResultsRooms(mergedRooms);
    setSearchResultsOpen(true);
    if (searchDebugEnabled) {
      console.log('[search-debug] open popover (merged matches)', { total: totalMatches });
    }
  };

  const modalInitials = useMemo(() => {
    if (!modalState || !renderPlan) return null;
    if (modalState.mode === 'create') {
      const fallbackLayerIds =
        modalState.type === 'quote' ? ['quotes'] : (getTypeLayerIds(modalState.type) || inferDefaultLayerIds(modalState.type, layerIdSet));
      return {
        type: modalState.type,
        name: '',
        description: '',
        layerIds: fallbackLayerIds,
        scale: defaultObjectScale,
        ...(modalState.type === 'quote'
          ? {
              quoteLabelScale: lastQuoteLabelScale,
              quoteLabelBg: lastQuoteLabelBg,
              quoteLabelPos: lastQuoteLabelPosH,
              quoteDashed: lastQuoteDashed,
              quoteEndpoint: lastQuoteEndpoint,
              quoteColor: lastQuoteColor,
              quoteLabelColor: lastQuoteLabelColor
            }
          : {}),
        ...(modalState.type === 'text'
          ? {
              textBg: false,
              textBgColor: '#ffffff'
            }
          : {}),
        ...(modalState.type === 'wifi'
          ? {
              wifiStandard: WIFI_DEFAULT_STANDARD,
              wifiBand24: false,
              wifiBand5: false,
              wifiBand6: false,
              wifiShowRange: true,
              wifiRangeScale: 1
            }
          : {}),
        ...(isSecurityTypeId(modalState.type)
          ? {
              notes: '',
              lastVerificationAt: '',
              verifierCompany: '',
              gpsCoords: '',
              securityDocuments: [],
              securityCheckHistory: []
            }
          : {})
      };
    }
    const obj = renderPlan.objects.find((o) => o.id === modalState.objectId);
    if (!obj) return null;
    const quoteLabel = obj.type === 'quote' ? formatQuoteLabel(obj.points || []) : undefined;
    return {
      type: obj.type,
      name: modalState.mode === 'duplicate' ? '' : obj.name,
      description: modalState.mode === 'duplicate' ? '' : obj.description || '',
      layerIds:
        modalState.mode === 'duplicate'
          ? (obj.layerIds || getTypeLayerIds(obj.type) || inferDefaultLayerIds(obj.type, layerIdSet))
          : (obj.layerIds || getTypeLayerIds(obj.type) || inferDefaultLayerIds(obj.type, layerIdSet)),
      scale: Number.isFinite(obj.scale as number) ? Number(obj.scale) : defaultObjectScale,
      quoteLabelScale: Number.isFinite((obj as any).quoteLabelScale) ? Number((obj as any).quoteLabelScale) : lastQuoteLabelScale,
      quoteLabelBg: (obj as any).quoteLabelBg ?? lastQuoteLabelBg,
      quoteLabelColor: (obj as any).quoteLabelColor ?? lastQuoteLabelColor,
      quoteLabelOffset: (obj as any).quoteLabelOffset,
      quoteLabelPos: (obj as any).quoteLabelPos,
      quoteDashed: !!(obj as any).quoteDashed,
      quoteEndpoint: (obj as any).quoteEndpoint,
      quoteColor: obj.strokeColor,
      quoteLengthLabel: quoteLabel,
      quotePoints: obj.points,
      textFont: (obj as any).textFont,
      textSize: (obj as any).textSize,
      textColor: (obj as any).textColor,
      textBg: (obj as any).textBg,
      textBgColor: (obj as any).textBgColor,
      imageUrl: (obj as any).imageUrl,
      imageWidth: (obj as any).imageWidth,
      imageHeight: (obj as any).imageHeight,
      ip: (obj as any).ip,
      url: (obj as any).url,
      notes: (obj as any).notes,
      lastVerificationAt: (obj as any).lastVerificationAt,
      verifierCompany: (obj as any).verifierCompany,
      gpsCoords: (obj as any).gpsCoords,
      securityDocuments: (obj as any).securityDocuments,
      securityCheckHistory: (obj as any).securityCheckHistory,
        ...(obj.type === 'wifi'
          ? {
            wifiDb: (obj as any).wifiDb,
            wifiStandard: (obj as any).wifiStandard || WIFI_DEFAULT_STANDARD,
            wifiBand24: !!(obj as any).wifiBand24,
            wifiBand5: !!(obj as any).wifiBand5,
            wifiBand6: !!(obj as any).wifiBand6,
            wifiBrand: (obj as any).wifiBrand,
            wifiModel: (obj as any).wifiModel,
            wifiModelCode: (obj as any).wifiModelCode,
            wifiCoverageSqm: (obj as any).wifiCoverageSqm,
            wifiCatalogId: (obj as any).wifiCatalogId,
            wifiShowRange: (obj as any).wifiShowRange,
            wifiRangeScale: (obj as any).wifiRangeScale
          }
        : {})
    };
  }, [
    defaultObjectScale,
    formatQuoteLabel,
    getTypeLayerIds,
    inferDefaultLayerIds,
    layerIdSet,
    lastQuoteColor,
    lastQuoteDashed,
    lastQuoteEndpoint,
    lastQuoteLabelPosH,
    lastQuoteLabelBg,
    lastQuoteLabelScale,
    modalState,
    renderPlan
  ]);

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
  const corridorConnectionTargetPlans = useMemo(
    () => ((site?.floorPlans || []) as FloorPlan[]).filter((p) => p.id !== planId),
    [planId, site?.floorPlans]
  );

  const linksInSelection = useMemo(() => {
    const planLinks = ((basePlan as any)?.links || []) as PlanLink[];
    const ids = selectedObjectIds;
    if (!planLinks.length) return [] as PlanLink[];
    const seen = new Set<string>();
    const out: PlanLink[] = [];
    const inSel = new Set(ids);
    const allowBetween = !selectionAllRealUsers;
    for (const l of planLinks) {
      if (seen.has(l.id)) continue;
      const includeSelected = !!selectedLinkId && l.id === selectedLinkId;
      const includeBetween = allowBetween && ids.length > 1 && inSel.has(l.fromId) && inSel.has(l.toId);
      if (!includeSelected && !includeBetween) continue;
      seen.add(l.id);
      out.push(l);
    }
    // Put explicitly selected link first (if present).
    if (selectedLinkId) out.sort((a, b) => (a.id === selectedLinkId ? -1 : b.id === selectedLinkId ? 1 : 0));
    return out;
  }, [basePlan, selectedLinkId, selectedObjectIds, selectionAllRealUsers]);

  const getObjectNameById = useCallback(
    (id: string) => renderPlan.objects.find((o) => o.id === id)?.name || id,
    [renderPlan.objects]
  );

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
            {totalLayerCount ? (
              <div ref={layersPopoverRef} className="relative">
	                <button
	                  onClick={() => setLayersPopoverOpen((v) => !v)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setLayersQuickMenu({ x: e.clientX, y: e.clientY });
                    setLayersPopoverOpen(false);
                  }}
	                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                  title={t({ it: 'Layers visibili', en: 'Visible layers' })}
	                >
	                  {t({ it: `${visibleLayerCount}/${totalLayerCount} livelli`, en: `${visibleLayerCount}/${totalLayerCount} layers` })}
                </button>
                {layersPopoverOpen ? (
                  <div className="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-card">
                    <div className="flex items-center justify-between px-2 pb-2">
                      <div className="font-semibold text-ink">{t({ it: 'Layers mostrati', en: 'Visible layers' })}</div>
                      <button
                        onClick={() => setLayersPopoverOpen(false)}
                        className="text-slate-400 hover:text-ink"
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {hideAllLayers ? (
                      <div className="mx-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                        {t({ it: 'Livelli nascosti', en: 'Layers hidden' })}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2 px-2">
                      <button
                        onClick={() => {
                          setHideAllLayers(planId, false);
                          setVisibleLayerIds(planId, layerIds);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Tutti', en: 'All' })}
                      </button>
                      <button
                        onClick={() => {
                          setHideAllLayers(planId, false);
                          setVisibleLayerIds(planId, []);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Nessuno', en: 'None' })}
                      </button>
                    </div>
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto px-2 pb-1">
                        {orderedPlanLayers.map((layer: any) => {
                          const layerId = String(layer.id);
                          const label =
                            layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsLabel
                              : (layer?.name?.[lang] as string) || (layer?.name?.it as string) || layerId;
                          const checked = hideAllLayers
                            ? false
                            : layerId === ALL_ITEMS_LAYER_ID
                              ? allItemsSelected
                              : allItemsSelected || effectiveVisibleLayerIds.includes(layerId);
                          const note = getLayerNote(layer);
                          return (
                          <label
                            key={layerId}
                            className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary"
                              checked={checked}
                              onChange={() => {
                                const base = hideAllLayers ? [] : effectiveVisibleLayerIds;
                                setHideAllLayers(planId, false);
                                if (layerId === ALL_ITEMS_LAYER_ID) {
                                  setVisibleLayerIds(planId, checked ? [] : layerIds);
                                  return;
                                }
                                const next = checked ? base.filter((id) => id !== layerId) : [...base, layerId];
                                setVisibleLayerIds(planId, normalizeLayerSelection(next));
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-semibold">{label}</span>
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: layerId === ALL_ITEMS_LAYER_ID ? '#000' : layer.color || '#94a3b8' }}
                                />
                              </div>
                              {note ? <div className="mt-1 text-[10px] text-slate-500">{note}</div> : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="relative">
	              <button
	                onClick={() => setCountsOpen((v) => !v)}
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
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
	                    <button onClick={() => setCountsOpen(false)} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
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
		                              title={o.name}
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
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTypeMenu({ typeId: t.id, label: t.label, icon: t.icon, x: e.clientX, y: e.clientY });
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                              title={t.label}
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
			                                    title={o.name}
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
	                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
	                title={t({ it: 'Stanze', en: 'Rooms' })}
	              >
	                {rooms.length} {t({ it: 'stanze', en: 'rooms' })}
	              </button>
              {roomsOpen ? (
                <div className="absolute left-0 z-50 mt-2 w-[420px] rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="text-sm font-semibold text-ink">{t({ it: 'Stanze', en: 'Rooms' })}</div>
	                    <button onClick={() => setRoomsOpen(false)} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
	                      <X size={14} />
	                    </button>
                  </div>
                  <div className="px-2 pb-2">
                    {!isReadOnly ? (
                      <div className="relative">
	                        <button
	                          onClick={() => setNewRoomMenuOpen((v) => !v)}
	                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
	                          title={t({ it: 'Nuova stanza', en: 'New room' })}
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
	                              title={t({ it: 'Rettangolo', en: 'Rectangle' })}
	                            >
                              <Square size={16} className="text-slate-500" /> {t({ it: 'Rettangolo', en: 'Rectangle' })}
                            </button>
	                            <button
	                              onClick={() => {
	                                setNewRoomMenuOpen(false);
	                                beginRoomPolyDraw();
	                              }}
	                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
	                              title={t({ it: 'Poligono', en: 'Polygon' })}
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
	                          title={t({ it: 'Annulla disegno', en: 'Cancel drawing' })}
	                        >
	                          Esc
	                        </button>
                      </div>
                    ) : null}
	                    <button
	                      onClick={() => setRoomAllocationOpen(true)}
	                      disabled={!rooms.length}
	                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
	                      title={t({ it: 'Trova capienza', en: 'Find capacity' })}
	                    >
                      <Users size={16} /> {t({ it: 'Trova capienza', en: 'Find capacity' })}
                    </button>
                    <button
                      onClick={() => setCapacityDashboardOpen(true)}
                      disabled={!rooms.length}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
                      title={t({ it: 'Stato capienza', en: 'Capacity dashboard' })}
                    >
                      <BarChart3 size={16} /> {t({ it: 'Stato capienza', en: 'Capacity dashboard' })}
                    </button>
                  </div>
                  <div className="max-h-[28rem] space-y-3 overflow-auto px-3 pb-3">
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
                            <div className="flex items-center gap-3 px-4 py-3">
	                              <button
	                                onClick={() => {
	                                  setExpandedRoomId(isExpanded ? null : room.id);
	                                  clearSelection();
	                                  setSelectedRoomId(room.id);
	                                  setSelectedRoomIds([room.id]);
	                                  setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
	                                }}
	                                className={`min-w-0 flex-1 text-left text-sm ${
	                                  selectedRoomId === room.id ? 'font-semibold text-ink' : 'text-slate-700'
	                                }`}
	                                title={room.name}
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
                              <div className="flex items-center gap-2">
                                <button
                                  title={t({ it: 'Evidenzia', en: 'Highlight' })}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRoomId(room.id);
                                    setSelectedRoomIds([room.id]);
                                    setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
                                  }}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                >
                                  <LocateFixed size={16} />
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
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      title={t({ it: 'Elimina', en: 'Delete' })}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteRoomId(room.id);
                                        setRoomsOpen(false);
                                      }}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    >
                                      <Trash size={16} />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {isExpanded ? (
                              <div className="border-t border-slate-100 px-4 pb-3 pt-2">
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
	                                        title={o.name}
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
                        {!isReadOnly ? (
                          <div className="mt-2">
	                            <button
	                              onClick={() => {
	                                setNewRoomMenuOpen(true);
	                              }}
	                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
	                              title={t({ it: 'Crea stanza', en: 'Create room' })}
	                            >
                              {t({ it: 'Crea stanza', en: 'Create room' })}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
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
              hasUnsavedChanges ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
            }`}
            title={
              hasUnsavedChanges
                ? t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })
                : t({ it: 'Tutto salvato', en: 'All changes saved' })
            }
          >
            {hasUnsavedChanges ? t({ it: 'Non salvato', en: 'Unsaved' }) : t({ it: 'Salvato', en: 'Saved' })}
          </div>
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
		          {/* Presentation button moved to the in-canvas toolbar (under "VD"). */}
	          <div className="relative">
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
	                    title={t({ it: 'Ultima posizione', en: 'Last position' })}
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
	                        title={view.name}
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
                          title={t({ it: 'Sovrascrivi con vista attuale', en: 'Overwrite with current view' })}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOverwriteView(view);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        >
                          <Save size={14} />
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
	                    className="w-full btn-primary"
	                    title={t({ it: 'Salva nuova vista', en: 'Save new view' })}
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
		            <UserMenu />
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
                {webcamGesturesEnabled && presentationMode && webcamGuideVisible ? (
                  <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4">
                    <div className="w-full max-w-md rounded-2xl border border-sky-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                        {t({ it: 'Assistente Webcam', en: 'Webcam Assistant' })}
                      </div>
                      <div className="mt-1 text-base font-semibold text-slate-900">
                        {webcamGuideStep === 'enable'
                          ? t({ it: '1. Clicca sull’icona webcam', en: '1. Click the webcam icon' })
                          : webcamGuideStep === 'calibrate'
                            ? t({ it: '2. Calibrazione in corso', en: '2. Calibration in progress' })
                            : webcamGuideStep === 'pan'
                              ? t({ it: '3. Prova il gesto PAN', en: '3. Try the PAN gesture' })
                              : webcamGuideStep === 'open'
                                ? t({ it: '4. Prova il gesto mano aperta', en: '4. Try the open-hand gesture' })
                                : t({ it: 'Configurazione completata', en: 'Setup completed' })}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {webcamGuideStep === 'enable'
                          ? t({
                              it: 'Premi il pulsante videocamera nella barra per iniziare. Se necessario, autorizza l’accesso alla webcam.',
                              en: 'Press the camera button in the toolbar to start. If needed, allow webcam access.'
                            })
                          : webcamGuideStep === 'calibrate'
                            ? t({
                                it: 'Mostra una mano e fai pinch (pollice + indice) tenendolo fermo per circa 1 secondo.',
                                en: 'Show one hand and pinch (thumb + index), keeping it steady for about 1 second.'
                              })
                            : webcamGuideStep === 'pan'
                              ? t({
                                  it: 'Tieni la mano aperta con dita ravvicinate e spostala lentamente per muovere la planimetria.',
                                  en: 'Keep your hand open with close fingers and move slowly to pan the floor plan.'
                                })
                              : webcamGuideStep === 'open'
                                ? t({
                                    it: 'Apri la mano a “5” e tienila ferma per un attimo: la vista torna alla posizione predefinita.',
                                    en: 'Open your hand like “5” and hold briefly: the view returns to default.'
                                  })
                                : t({
                                    it: 'Ottimo. I controlli gesture sono pronti. Puoi continuare a usare pan e reset vista.',
                                    en: 'Great. Gesture controls are ready. You can keep using pan and view reset.'
                                  })}
                      </div>
                      <div className="mt-3 flex items-center justify-center">
                        {webcamGuideStep === 'calibrate' ? (
                          <svg viewBox="0 0 240 88" className="h-20 w-full max-w-[280px]" aria-hidden="true">
                            <rect x="2" y="2" width="236" height="84" rx="14" fill="#eff6ff" stroke="#bfdbfe" />
                            <circle cx="82" cy="44" r="18" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
                            <circle cx="158" cy="44" r="18" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
                            <path d="M102 44 H138" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" strokeDasharray="5 4" />
                            <path d="M113 34 L102 44 L113 54" fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M127 34 L138 44 L127 54" fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            <text x="120" y="77" textAnchor="middle" fontSize="11" fill="#0369a1" fontWeight="700">
                              PINCH: avvicina pollice e indice
                            </text>
                          </svg>
                        ) : webcamGuideStep === 'pan' ? (
                          <svg viewBox="0 0 240 88" className="h-20 w-full max-w-[280px]" aria-hidden="true">
                            <rect x="2" y="2" width="236" height="84" rx="14" fill="#ecfeff" stroke="#a5f3fc" />
                            <rect x="95" y="22" width="50" height="44" rx="18" fill="#cffafe" stroke="#06b6d4" strokeWidth="2" />
                            <path d="M62 44 H178" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" />
                            <path d="M72 34 L62 44 L72 54" fill="none" stroke="#0891b2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M168 34 L178 44 L168 54" fill="none" stroke="#0891b2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            <text x="120" y="77" textAnchor="middle" fontSize="11" fill="#0e7490" fontWeight="700">
                              PAN: muovi la mano lentamente
                            </text>
                          </svg>
                        ) : webcamGuideStep === 'open' ? (
                          <svg viewBox="0 0 240 88" className="h-20 w-full max-w-[280px]" aria-hidden="true">
                            <rect x="2" y="2" width="236" height="84" rx="14" fill="#f0fdf4" stroke="#bbf7d0" />
                            <rect x="100" y="26" width="40" height="40" rx="16" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
                            <rect x="78" y="16" width="10" height="28" rx="5" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
                            <rect x="94" y="12" width="10" height="30" rx="5" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
                            <rect x="110" y="10" width="10" height="32" rx="5" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
                            <rect x="126" y="12" width="10" height="30" rx="5" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
                            <rect x="142" y="16" width="10" height="28" rx="5" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" />
                            <text x="120" y="77" textAnchor="middle" fontSize="11" fill="#15803d" fontWeight="700">
                              MANO APERTA: reset vista default
                            </text>
                          </svg>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-2 text-xs">
                        <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${presentationWebcamEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span>{t({ it: 'Webcam attiva', en: 'Webcam enabled' })}</span>
                          <span>{presentationWebcamEnabled ? '✓' : '•'}</span>
                        </div>
                        <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${presentationWebcamCalib ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span>{t({ it: 'Calibrazione', en: 'Calibration' })}</span>
                          <span>{presentationWebcamCalib ? '✓' : `${Math.max(0, Math.min(100, Math.round(webcamCalibrationProgress || 0)))}%`}</span>
                        </div>
                        <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${webcamCalibrationPinchSeen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span>{t({ it: 'Pinch rilevato', en: 'Pinch detected' })}</span>
                          <span>{webcamCalibrationPinchSeen ? '✓' : '•'}</span>
                        </div>
                        <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${webcamGuidePanDone ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span>{t({ it: 'Gesto PAN', en: 'PAN gesture' })}</span>
                          <span>{webcamGuidePanDone ? '✓' : '•'}</span>
                        </div>
                        <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${webcamGuideOpenDone ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span>{t({ it: 'Gesto mano aperta', en: 'Open-hand gesture' })}</span>
                          <span>{webcamGuideOpenDone ? '✓' : '•'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
	                        <CanvasStage
	                        ref={canvasStageRef}
	                        containerRef={mapRef}
	                        presentationMode={presentationMode}
	                        onTogglePresentation={() => handleTogglePresentation()}
	                        webcamEnabled={false}
	                        webcamReady={false}
                          webcamHandDetected={false}
	                        onToggleWebcam={undefined}
	                        onCalibrateWebcam={undefined}
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

      {contextMenu && plan ? (
        <>
        <div
          ref={contextMenuRef}
          className="context-menu-panel fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
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

          {planLayers.length &&
          contextMenu.kind !== 'corridor' &&
          contextMenu.kind !== 'corridor_connection' &&
          contextMenu.kind !== 'corridor_door' &&
          contextMenu.kind !== 'safety_card' ? (
            <button
              onClick={() => setLayersContextMenu((prev) => (prev ? null : { x: contextMenu.x, y: contextMenu.y }))}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Livelli (mostra/nascondi)', en: 'Layers (show/hide)' })}
            >
              <span className="flex items-center gap-2">
                <Layers size={14} className="text-slate-500" /> {t({ it: 'Livelli', en: 'Layers' })}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                  {hideAllLayers ? '0' : String(visibleLayerCount)}/{String(totalLayerCount)}
                </span>
                <ChevronRight size={14} className={`text-slate-400 ${layersContextMenu ? 'rotate-90' : ''}`} />
              </span>
            </button>
          ) : null}

	          {contextMenu.kind === 'link' ? (
              <>
                <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                  <span className="badge badge-selected">{t({ it: 'Collegamento selezionato', en: 'Selected link' })}</span>
                  {contextLink ? (
                    <div className="mt-1 text-[11px] text-slate-600">
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
	                    title={t({ it: 'Modifica descrizione', en: 'Edit description' })}
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
	                        title={t({ it: 'Modifica stile', en: 'Edit style' })}
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
	                    title={t({ it: 'Elimina collegamento', en: 'Delete link' })}
	                  >
                    <Trash size={14} /> {t({ it: 'Elimina collegamento', en: 'Delete link' })}
                  </button>
                ) : null}
              </>
            ) : contextMenu.kind === 'object' ? (
              <>
                {contextIsQuote ? (
                  <>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                      <span className="badge badge-selected">{t({ it: 'Quota selezionata', en: 'Selected quote' })}</span>
                    </div>
                    <button
                      onClick={() => {
                        handleEdit(contextMenu.id);
                        setContextMenu(null);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Dettagli quota', en: 'Quote details' })}
                    >
                      <Pencil size={14} /> {t({ it: 'Dettagli', en: 'Details' })}
                    </button>
                    <button
                      onClick={() => {
                        const ids =
                          selectedObjectIds.includes(contextMenu.id) && selectedObjectIds.length > 1
                            ? [...selectedObjectIds]
                            : [contextMenu.id];
                        setConfirmDelete(ids);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                      title={t({ it: 'Elimina quota', en: 'Delete quote' })}
                    >
                      <Trash size={14} /> {t({ it: 'Elimina quota', en: 'Delete quote' })}
                    </button>
                  </>
                ) : (
                  <>
                    {contextIsMulti ? (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                        <span className="badge badge-selected">
                          {t({
                            it: `${selectedObjectIds.length} oggetti selezionati`,
                            en: `${selectedObjectIds.length} objects selected`
                          })}
                        </span>
                      </div>
                    ) : (
                      <>
                        {!contextIsDesk && !contextIsWall ? (
                          <button
                            onClick={() => {
                              handleEdit(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Modifica', en: 'Edit' })}
                          >
                            <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                          </button>
                        ) : null}
                        {contextIsPhoto ? (
                          <button
                            onClick={() => {
                              const ids =
                                contextIsMulti && selectedObjectIds.length ? [...selectedObjectIds] : [contextMenu.id];
                              openPhotoViewer({ id: contextMenu.id, selectionIds: ids });
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t(
                              contextPhotoMulti
                                ? { it: 'Vedi galleria', en: 'View gallery' }
                                : { it: 'Vedi foto', en: 'View photo' }
                            )}
                          >
                            <ImageIcon size={14} className="text-slate-500" />{' '}
                            {t(
                              contextPhotoMulti
                                ? { it: 'Vedi galleria', en: 'View gallery' }
                                : { it: 'Vedi foto', en: 'View photo' }
                            )}
                          </button>
                        ) : null}
	                        {contextObject ? (
                          <button
                            onClick={() => {
                              if (!renderPlan) return;
                              const typeId = contextObject.type;
                              const ids = (renderPlan.objects || []).filter((o) => o.type === typeId).map((o) => o.id);
                              if (!ids.length) return;
                              setSelection(ids);
                              setSelectedRoomId(undefined);
                              setSelectedRoomIds([]);
                              setSelectedLinkId(null);
                              push(
                                t({
                                  it: `Selezionati ${ids.length} oggetti di tipo ${contextObjectTypeLabel}.`,
                                  en: `Selected ${ids.length} ${contextObjectTypeLabel} objects.`
                                }),
                                'info'
                              );
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Seleziona tutti gli oggetti di questo tipo', en: 'Select all objects of this type' })}
                          >
                            <LayoutGrid size={14} className="text-slate-500" />
                            {t({
                              it: `Seleziona tutti: ${contextObjectTypeLabel}`,
                              en: `Select all: ${contextObjectTypeLabel}`
                            })}
                          </button>
	                        ) : null}
                        {contextIsAssemblyPoint && contextAssemblyMapsUrl ? (
                          <button
                            onClick={() => {
                              window.open(contextAssemblyMapsUrl, '_blank', 'noopener,noreferrer');
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Apri in Google Maps', en: 'Open in Google Maps' })}
                          >
                            <ExternalLink size={14} className="text-slate-500" />
                            {t({ it: 'Apri in Google Maps', en: 'Open in Google Maps' })}
                          </button>
                        ) : null}
	                        {contextIsWifi ? (
                          <button
                            onClick={() => {
                              const ids =
                                contextIsMulti && selectedObjectIds.length
                                  ? selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'wifi')
                                  : [contextMenu.id];
                              const nextValue = !contextWifiRangeOn;
                              ids.forEach((id) => updateObject(id, { wifiShowRange: nextValue }));
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({
                              it: contextWifiRangeOn ? 'Nascondi range access point' : 'Mostra range access point',
                              en: contextWifiRangeOn ? 'Hide access point range' : 'Show access point range'
                            })}
                          >
                            <Eye size={14} className="text-slate-500" />{' '}
                            {t({
                              it: contextWifiRangeOn ? 'Nascondi range' : 'Mostra range',
                              en: contextWifiRangeOn ? 'Hide range' : 'Show range'
                            })}
                          </button>
                        ) : null}
                        {contextIsWifi ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <Ruler size={14} className="text-slate-500" />
                              {t({ it: 'Range Wi-Fi', en: 'Wi-Fi range' })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                x{contextWifiRangeScale.toFixed(2)}
                              </span>
                            </div>
                              <input
                                key={`${contextMenu.id}-wifi-range-scale`}
                                type="range"
                                min={0}
                                max={WIFI_RANGE_SCALE_MAX}
                                step={0.05}
                                value={contextWifiRangeScale}
                                onChange={(e) => {
                                  if (!renderPlan) return;
                                  const next = Math.max(0, Math.min(WIFI_RANGE_SCALE_MAX, Number(e.target.value) || 0));
                                  const ids =
                                    contextIsMulti && selectedObjectIds.length
                                      ? selectedObjectIds.filter((id) => renderPlan.objects.find((o) => o.id === id)?.type === 'wifi')
                                      : [contextMenu.id];
                                  ids.forEach((id) => updateObject(id, { wifiRangeScale: next }));
                                }}
                                className="mt-1 w-full"
                                title={t({ it: 'Estendi/riduci range (0..x20)', en: 'Extend/reduce range (0..x20)' })}
                              />
                              {contextWifiBaseRadiusM > 0 ? (
                                <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                                  <div>
                                    {t({ it: 'Base', en: 'Base' })}: r ~{Math.round(contextWifiBaseRadiusM)}m · d ~
                                    {Math.round(contextWifiBaseDiameterM)}m · area ~{Math.round(contextWifiBaseAreaSqm)} m2
                                  </div>
                                  <div>
                                    {t({ it: 'Effettivo', en: 'Effective' })}: r ~{Math.round(contextWifiEffectiveRadiusM)}m · d ~
                                    {Math.round(contextWifiEffectiveDiameterM)}m · area ~{Math.round(contextWifiEffectiveAreaSqm)} m2
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {t({
                                    it: 'Imposta un coverage nel catalogo/proprietà per calcolare il range.',
                                    en: 'Set coverage in catalog/properties to compute range.'
                                  })}
                                </div>
                              )}
                          </div>
                        ) : null}
                        {contextIsWall && contextWallPolygon ? (
                          <button
                            onClick={() => {
                              openWallGroupModal(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Modifica poligono', en: 'Edit polygon' })}
                          >
                            <Pencil size={14} /> {t({ it: 'Modifica poligono', en: 'Edit polygon' })}
                          </button>
                        ) : null}
                        {canEditWallType ? (
                          <button
                            onClick={() => {
                              const ids =
                                contextIsMulti && selectedObjectIds.length ? [...selectedObjectIds] : [contextMenu.id];
                              const fallbackType = contextObject?.type || wallTypeDefs[0]?.id || DEFAULT_WALL_TYPES[0];
                              if (!fallbackType) return;
                              setWallTypeModal({ ids, typeId: fallbackType });
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({ it: 'Cambia tipo muro', en: 'Change wall type' })}
                          >
                            <Pencil size={14} /> {t({ it: 'Cambia tipo muro', en: 'Change wall type' })}
                          </button>
                        ) : null}
                        {contextObject?.type === 'real_user' ? (
                          <button
                            onClick={() => {
                              setRealUserDetailsId(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({
                              it: 'Mostra dettagli importati dell’utente reale',
                              en: 'Show imported details for this real user'
                            })}
                          >
                            <User size={14} className="text-slate-500" /> {t({ it: 'Dettagli utente', en: 'User details' })}
                          </button>
                        ) : null}
                        {contextObjectLinkCount && !contextIsPhoto ? (
                          <button
                            onClick={() => {
                              setLinksModalObjectId(contextMenu.id);
                              setContextMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                            title={t({
                              it: 'Mostra tutti i collegamenti di questo oggetto',
                              en: 'Show all links for this object'
                            })}
                          >
                            <Link2 size={14} className="text-slate-500" />{' '}
                            {t({
                              it: `Mostra collegamenti (${contextObjectLinkCount})`,
                              en: `Show links (${contextObjectLinkCount})`
                            })}
                          </button>
                        ) : null}
                        {!contextIsRack && !contextIsDesk && !contextIsWall && !contextIsPhoto ? (
                          <>
                            <div className="my-2 h-px bg-slate-100" />
                            <button
                              onClick={() => {
                                if (isReadOnly) return;
                                setLinkCreateMode('arrow');
                                setLinkFromId(contextMenu.id);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                              title={t({ it: 'Crea collegamento', en: 'Create link' })}
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
                              title={t({ it: 'Crea collegamento 90°', en: 'Create 90° link' })}
                            >
                              <CornerDownRight size={14} className="text-slate-500" /> {t({ it: 'Crea collegamento 90°', en: 'Create 90° link' })}
                            </button>
                          </>
                        ) : null}
                        {!contextIsWall ? (
                          <>
                            <div className="my-2 h-px bg-slate-100" />
                            <button
                              onClick={() => {
                                openDuplicate(contextMenu.id);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                              title={t({ it: 'Duplica', en: 'Duplicate' })}
                            >
                              <Copy size={14} /> {t({ it: 'Duplica', en: 'Duplicate' })}
                            </button>
                          </>
                        ) : null}
                        {!contextIsWall ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <MoveDiagonal size={14} />{' '}
                              {t({
                                it: contextIsQuote ? 'Scala quota' : 'Scala',
                                en: contextIsQuote ? 'Quote scale' : 'Scale'
                              })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                {(contextObject?.scale ?? 1).toFixed(2)}
                              </span>
                            </div>
                            <input
                              key={contextMenu.id}
                              type="range"
                              min={contextIsQuote ? 0.5 : 0.2}
                              max={contextIsQuote ? 1.6 : 2.4}
                              step={0.05}
                              value={contextObject?.scale ?? 1}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                updateObject(contextMenu.id, { scale: next });
                                if (contextIsQuote) {
                                  setLastQuoteScale(next);
                                } else {
                                  setLastObjectScale(next);
                                }
                              }}
                              className="mt-1 w-full"
                            />
                          </div>
                        ) : null}
                        <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <Eye size={14} />{' '}
                            {t({
                              it: contextIsWall ? 'Opacità linea' : 'Opacità',
                              en: contextIsWall ? 'Line opacity' : 'Opacity'
                            })}
                            <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                              {Math.round(((contextObject?.opacity ?? 1) || 1) * 100)}%
                            </span>
                          </div>
                          <input
                            key={`${contextMenu.id}-opacity`}
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.05}
                            value={contextObject?.opacity ?? 1}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              updateObject(contextMenu.id, { opacity: next });
                            }}
                            className="mt-1 w-full"
                          />
                        </div>
                        {contextIsWall || contextIsQuote ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <MoveDiagonal size={14} /> {t({ it: 'Spessore linea', en: 'Line thickness' })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                {Number(contextObject?.strokeWidth ?? (contextIsQuote ? 2 : 1)).toFixed(1)} px
                              </span>
                            </div>
                            <input
                              key={`${contextMenu.id}-stroke-width`}
                              type="range"
                              min={contextIsQuote ? 0.5 : 1}
                              max={contextIsQuote ? 6 : 12}
                              step={contextIsQuote ? 0.1 : 1}
                              value={contextObject?.strokeWidth ?? (contextIsQuote ? 2 : 1)}
                              onChange={(e) => updateObject(contextMenu.id, { strokeWidth: Number(e.target.value) })}
                              className="mt-1 w-full"
                            />
                          </div>
                        ) : null}
                        {contextIsQuote ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Colore quota', en: 'Quote color' })}</span>
                              <input
                                type="color"
                                value={contextObject?.strokeColor || lastQuoteColor || '#f97316'}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  updateObject(contextMenu.id, { strokeColor: next });
                                  setLastQuoteColor(next);
                                }}
                                className="h-7 w-9 rounded border border-slate-200 bg-white"
                                title={t({ it: 'Colore quota', en: 'Quote color' })}
                              />
                            </div>
                            <div className="mt-2 text-xs font-semibold text-slate-600">
                              {t({ it: 'Posizione scritta', en: 'Label position' })}
                            </div>
                            <select
                              value={contextQuoteLabelPos}
                              onChange={(e) => {
                                const next = e.target.value as any;
                                updateQuoteLabelPos(contextMenu.id, next, contextQuoteOrientation);
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                              title={t({ it: 'Posizione etichetta quota', en: 'Quote label position' })}
                            >
                              {contextQuoteOrientation === 'vertical' ? (
                                <>
                                  <option value="left">{t({ it: 'Sinistra', en: 'Left' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="right">{t({ it: 'Destra', en: 'Right' })}</option>
                                </>
                              ) : (
                                <>
                                  <option value="above">{t({ it: 'Sopra', en: 'Above' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="below">{t({ it: 'Sotto', en: 'Below' })}</option>
                                </>
                              )}
                            </select>
                            <div className="mt-2 text-[11px] text-slate-500">
                              {t({
                                it: 'La prossima quota usa la stessa posizione in base all’orientamento.',
                                en: 'Next quotes reuse this position based on orientation.'
                              })}
                            </div>
                          </div>
                        ) : null}
                        {contextIsCamera ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="text-xs font-semibold text-slate-600">{t({ it: 'CCTV', en: 'CCTV' })}</div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Apertura', en: 'Angle' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(Number(contextObject?.cctvAngle ?? 70))}°
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-angle`}
                                type="range"
                                min={20}
                                max={160}
                                step={5}
                                value={contextObject?.cctvAngle ?? 70}
                                onChange={(e) => updateObject(contextMenu.id, { cctvAngle: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Raggio', en: 'Range' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(Number(contextObject?.cctvRange ?? 160))}
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-range`}
                                type="range"
                                min={60}
                                max={600}
                                step={10}
                                value={contextObject?.cctvRange ?? 160}
                                onChange={(e) => updateObject(contextMenu.id, { cctvRange: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Rotazione', en: 'Rotation' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(Number(contextObject?.rotation ?? 0))}°
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-rotation`}
                                type="range"
                                min={0}
                                max={360}
                                step={5}
                                value={contextObject?.rotation ?? 0}
                                onChange={(e) => updateObject(contextMenu.id, { rotation: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span>{t({ it: 'Intensità', en: 'Intensity' })}</span>
                                <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                  {Math.round(((contextObject?.cctvOpacity ?? 0.6) || 0.6) * 100)}%
                                </span>
                              </div>
                              <input
                                key={`${contextMenu.id}-cctv-opacity`}
                                type="range"
                                min={0.1}
                                max={0.9}
                                step={0.05}
                                value={contextObject?.cctvOpacity ?? 0.6}
                                onChange={(e) => updateObject(contextMenu.id, { cctvOpacity: Number(e.target.value) })}
                                className="mt-1 w-full"
                              />
                            </div>
                          </div>
                        ) : null}
                        {contextIsDesk ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <Pencil size={14} /> {t({ it: 'Linee scrivania', en: 'Desk lines' })}
                              <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">
                                {(contextObject?.strokeWidth ?? 2).toFixed(1)}
                              </span>
                            </div>
                            <input
                              key={`${contextMenu.id}-stroke`}
                              type="range"
                              min={0.5}
                              max={6}
                              step={0.5}
                              value={contextObject?.strokeWidth ?? 2}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                updateObject(contextMenu.id, { strokeWidth: next });
                              }}
                              className="mt-1 w-full"
                            />
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Colore linee', en: 'Line color' })}</span>
                              <input
                                type="color"
                                value={contextObject?.strokeColor || '#cbd5e1'}
                                onChange={(e) => updateObject(contextMenu.id, { strokeColor: e.target.value })}
                                className="h-7 w-9 rounded border border-slate-200 bg-white"
                                title={t({ it: 'Colore linee', en: 'Line color' })}
                              />
                            </div>
                          </div>
                        ) : null}
                        {contextIsDesk ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                            <div className="text-xs font-semibold text-slate-600">{t({ it: 'Rotazione', en: 'Rotation' })}</div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  const current = Number(contextObject?.rotation || 0);
                                  updateObject(contextMenu.id, { rotation: (current - 90 + 360) % 360 });
                                }}
                                className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                title={t({ it: 'Ruota 90° a sinistra', en: 'Rotate 90° left' })}
                              >
                                {t({ it: 'Sinistra', en: 'Left' })}
                              </button>
                              <button
                                onClick={() => {
                                  const current = Number(contextObject?.rotation || 0);
                                  updateObject(contextMenu.id, { rotation: (current + 90) % 360 });
                                }}
                                className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                title={t({ it: 'Ruota 90° a destra', en: 'Rotate 90° right' })}
                              >
                                {t({ it: 'Destra', en: 'Right' })}
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className="my-2 h-px bg-slate-100" />
                      </>
                    )}

                    {contextIsMulti ? (
                      <div className="relative mt-2">
                        <button
                          onClick={() => setAlignMenuOpen((v) => !v)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Allinea', en: 'Align' })}
                        >
                          <span>{t({ it: 'Allinea', en: 'Align' })}</span>
                          <ChevronRight size={14} className="text-slate-400" />
                        </button>
                        {alignMenuOpen ? (
                          <div className="absolute left-full top-0 z-10 ml-2 w-40 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-card">
                            <div className="grid grid-cols-1 gap-1">
                              <button
                                onClick={() => {
                                  alignSelection('horizontal', contextMenu.id);
                                  setAlignMenuOpen(false);
                                  setContextMenu(null);
                                }}
                                className="rounded-md px-2 py-1 text-left font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {t({ it: 'Allinea orizzontale', en: 'Align horizontally' })}
                              </button>
                              <button
                                onClick={() => {
                                  alignSelection('vertical', contextMenu.id);
                                  setAlignMenuOpen(false);
                                  setContextMenu(null);
                                }}
                                className="rounded-md px-2 py-1 text-left font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {t({ it: 'Allinea verticale', en: 'Align vertically' })}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {contextIsMulti && selectionPhotoIds.length > 1 ? (
                      <button
                        onClick={() => {
                          if (!selectionPhotoIds.length) return;
                          openPhotoViewer({ id: selectionPhotoIds[0], selectionIds: selectionPhotoIds });
                          setContextMenu(null);
                        }}
                        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                        title={t({ it: 'Vedi galleria', en: 'View gallery' })}
                      >
                        <ImageIcon size={14} className="text-slate-500" /> {t({ it: 'Vedi galleria', en: 'View gallery' })}
                      </button>
                    ) : null}
                    {contextIsMulti ? (
                      !isReadOnly &&
                      selectedObjectIds.length === 2 &&
                      !selectionHasRack &&
                      !selectionHasDesk &&
                      !selectionHasPhoto ? (
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
                            const id = addLink(basePlan.id, a, b, { kind: 'arrow', arrow: 'none' });
                            postAuditEvent({
                              event: 'link_create',
                              scopeType: 'plan',
                              scopeId: basePlan.id,
                              details: { id, fromId: a, toId: b, kind: 'arrow' }
                            });
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
                        title={t({ it: 'Modifica rapida oggetti', en: 'Quick edit objects' })}
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
                      title={t({ it: 'Elimina', en: 'Delete' })}
                    >
                      <Trash size={14} /> {t({ it: 'Elimina', en: 'Delete' })}
                    </button>
                  </>
                )}
              </>
            ) : contextMenu.kind === 'room' ? (
	            <>
	              {roomContextMetrics ? (
                <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-600">
                  <div className="font-semibold text-slate-600">{t({ it: 'Info stanza', en: 'Room info' })}</div>
                  {roomContextMetrics.scaleMissing ? (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                      {t({ it: 'Imposta una scala per misurare.', en: 'Set a scale to measure.' })}
                    </div>
                  ) : (
                    <>
                      {roomContextMetrics.perimeterLabel ? (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>{t({ it: 'Perimetro', en: 'Perimeter' })}</span>
                          <span className="font-mono">{roomContextMetrics.perimeterLabel}</span>
                        </div>
                      ) : null}
                      {roomContextMetrics.areaLabel ? (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>{t({ it: 'Area', en: 'Area' })}</span>
                          <span className="font-mono">{roomContextMetrics.areaLabel}</span>
                        </div>
                      ) : null}
                      {roomContextMetrics.segments?.length ? (
                        <div className="mt-2">
                          <div className="text-[11px] font-semibold text-slate-500">{t({ it: 'Lati', en: 'Sides' })}</div>
                          <div className="mt-1 space-y-1 text-[11px] text-slate-600">
                            {roomContextMetrics.segments.map((seg: { label: string; lengthLabel?: string | null }) => (
                              <div key={seg.label} className="flex items-center justify-between gap-2">
                                <span className="font-mono">{seg.label}</span>
                                <span className="font-mono">{seg.lengthLabel}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
	                </div>
	              ) : null}
	              <button
	                onClick={() => {
	                  if (contextMenu.kind !== 'room') return;
	                  openEscapeRouteAt({ x: contextMenu.worldX, y: contextMenu.worldY }, 'room');
	                }}
	                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
		                title={t({ it: 'Calcola via di fuga verso uscita esterna antipanico', en: 'Compute escape route to nearest external panic exit' })}
	              >
	                <Footprints size={14} className="text-slate-500" /> {t({ it: 'Via di fuga', en: 'Escape route' })}
	              </button>
                {!isReadOnly
                  ? (() => {
                      const pairIds = Array.from(new Set((selectedRoomIds || []).map((id) => String(id)).filter(Boolean)));
                      const canCreate = pairIds.length === 2 && pairIds.includes(contextMenu.id);
                      if (!canCreate) return null;
                      const [roomAId, roomBId] = pairIds;
                      return (
                        <button
                          onClick={() => {
                            startRoomDoorDraft(roomAId, roomBId);
                            setContextMenu(null);
                          }}
                          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                          title={t({
                            it: 'Crea porta di collegamento tra le due stanze selezionate',
                            en: 'Create connecting door between the two selected rooms'
                          })}
                        >
                          <DoorOpen size={14} className="text-slate-500" /> {t({ it: 'Crea porta di collegamento', en: 'Create connecting door' })}
                        </button>
                      );
                    })()
                  : null}
	              {!isReadOnly ? (
		                <button
	                  onClick={() => {
	                    openEditRoom(contextMenu.id);
	                    setContextMenu(null);
	                  }}
	                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                  title={t({ it: 'Modifica stanza', en: 'Edit room' })}
	                >
                  <Pencil size={14} /> {t({ it: 'Modifica stanza', en: 'Edit room' })}
                </button>
              ) : null}
              {!isReadOnly ? (
	                <button
	                  onClick={() => {
	                    setConfirmDeleteRoomId(contextMenu.id);
	                    setContextMenu(null);
	                  }}
	                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
	                  title={t({ it: 'Elimina stanza', en: 'Delete room' })}
	                >
                  <Trash size={14} /> {t({ it: 'Elimina stanza', en: 'Delete room' })}
                </button>
              ) : null}
            </>
	            ) : contextMenu.kind === 'corridor' ? (
	            <>
              <button
                onClick={() => {
                  if (contextMenu.kind !== 'corridor') return;
                  openEscapeRouteAt({ x: contextMenu.worldX, y: contextMenu.worldY }, 'corridor');
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                title={t({ it: 'Calcola via di fuga verso uscita esterna antipanico', en: 'Compute escape route to nearest external panic exit' })}
              >
                <Footprints size={14} className="text-slate-500" /> {t({ it: 'Via di fuga', en: 'Escape route' })}
              </button>
	              {!isReadOnly ? (
	                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor') return;
                    openCorridorConnectionModalAt(contextMenu.id, { x: contextMenu.worldX, y: contextMenu.worldY });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Collegamento tra piani', en: 'Floor connection' })}
                >
                  <Link2 size={14} className="text-slate-500" /> {t({ it: 'Collegamento tra piani', en: 'Floor connection' })}
                </button>
              ) : null}
            </>
            ) : contextMenu.kind === 'corridor_door' ? (
            <>
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (!plan || contextMenu.kind !== 'corridor_door') return;
                    const current = ((plan.corridors || []) as Corridor[]).filter(Boolean);
                    const next = current.map((corridor) => {
                      if (corridor.id !== contextMenu.corridorId) return corridor;
                      return {
                        ...corridor,
                        doors: (corridor.doors || []).filter((door) => door.id !== contextMenu.doorId)
                      };
                    });
                    markTouched();
                    updateFloorPlan(plan.id, { corridors: next } as any);
                    setSelectedCorridorDoor(null);
                    push(t({ it: 'Porta eliminata', en: 'Door deleted' }), 'info');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Elimina', en: 'Delete' })}
                >
                  <Trash size={14} className="text-rose-600" /> {t({ it: 'Elimina', en: 'Delete' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor_door') return;
                    openCorridorDoorModal(contextMenu.corridorId, contextMenu.doorId);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Modifica', en: 'Edit' })}
                >
                  <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor_door') return;
                    openCorridorDoorLinkModal(contextMenu.corridorId, contextMenu.doorId);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Collega stanza', en: 'Link room' })}
                >
                  <Home size={14} /> {t({ it: 'Collega stanza', en: 'Link room' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                (() => {
                  const corridor = corridors.find((c) => c.id === contextMenu.corridorId);
                  const door = (corridor?.doors || []).find((d) => d.id === contextMenu.doorId);
                  const mode = door?.mode || 'static';
                  const url = String((door as any)?.automationUrl || '').trim();
                  const canOpen = mode === 'automated' && /^https?:\/\//i.test(url);
                  if (!canOpen) return null;
                  return (
                    <button
                      onClick={() => {
                        // Trigger automated door endpoint in background, without opening a new tab/window.
                        try {
                          const requestUrl = `${url}${url.includes('?') ? '&' : '?'}_plixmap_open_ts=${Date.now()}`;
                          fetch(requestUrl, {
                            method: 'GET',
                            mode: 'no-cors',
                            cache: 'no-store',
                            keepalive: true
                          }).catch(() => {
                            // ignore network/CORS errors by design
                          });
                        } catch {
                          // ignore sync errors by design
                        }
                        push(t({ it: 'Comando apertura porta avviato.', en: 'Door opening command started.' }), 'success');
                        setContextMenu(null);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Apri', en: 'Open' })}
                    >
                      <Link2 size={14} className="text-slate-500" /> {t({ it: 'Apri', en: 'Open' })}
                    </button>
                  );
                })()
              ) : null}
            </>
            ) : contextMenu.kind === 'room_door' ? (
            <>
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (!plan || contextMenu.kind !== 'room_door') return;
                    const current = Array.isArray((plan as any).roomDoors) ? ((plan as any).roomDoors as any[]) : [];
                    const next = current.filter((door) => String((door as any)?.id || '') !== contextMenu.doorId);
                    markTouched();
                    updateFloorPlan(plan.id, { roomDoors: next as any } as any);
                    setSelectedRoomDoorId(null);
                    push(t({ it: 'Porta eliminata', en: 'Door deleted' }), 'info');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Elimina', en: 'Delete' })}
                >
                  <Trash size={14} className="text-rose-600" /> {t({ it: 'Elimina', en: 'Delete' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'room_door') return;
                    openRoomDoorModal(contextMenu.doorId);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Modifica', en: 'Edit' })}
                >
                  <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                (() => {
                  const door = roomDoors.find((entry) => entry.id === contextMenu.doorId);
                  const mode = door?.mode || 'static';
                  const url = String((door as any)?.automationUrl || '').trim();
                  const canOpen = mode === 'automated' && /^https?:\/\//i.test(url);
                  if (!canOpen) return null;
                  return (
                    <button
                      onClick={() => {
                        try {
                          const requestUrl = `${url}${url.includes('?') ? '&' : '?'}_plixmap_open_ts=${Date.now()}`;
                          fetch(requestUrl, {
                            method: 'GET',
                            mode: 'no-cors',
                            cache: 'no-store',
                            keepalive: true
                          }).catch(() => {});
                        } catch {
                          // ignore sync errors
                        }
                        push(t({ it: 'Comando apertura porta avviato.', en: 'Door opening command started.' }), 'success');
                        setContextMenu(null);
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      title={t({ it: 'Apri', en: 'Open' })}
                    >
                      <Link2 size={14} className="text-slate-500" /> {t({ it: 'Apri', en: 'Open' })}
                    </button>
                  );
                })()
              ) : null}
            </>
            ) : contextMenu.kind === 'corridor_connection' ? (
            <>
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (contextMenu.kind !== 'corridor_connection') return;
                    openEditCorridorConnectionModal(contextMenu.corridorId, contextMenu.connectionId, {
                      x: contextMenu.worldX,
                      y: contextMenu.worldY
                    });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Modifica punto di collegamento', en: 'Edit connection point' })}
                >
                  <Pencil size={14} /> {t({ it: 'Modifica punto di collegamento', en: 'Edit connection point' })}
                </button>
              ) : null}
              {!isReadOnly ? (
                <button
                  onClick={() => {
                    if (!plan || contextMenu.kind !== 'corridor_connection') return;
                    const current = ((plan.corridors || []) as Corridor[]).filter(Boolean);
                    const next = current.map((corridor) => {
                      if (corridor.id !== contextMenu.corridorId) return corridor;
                      return {
                        ...corridor,
                        connections: (corridor.connections || []).filter((cp) => cp.id !== contextMenu.connectionId)
                      };
                    });
                    markTouched();
                    updateFloorPlan(plan.id, { corridors: next } as any);
                    push(t({ it: 'Punto di collegamento eliminato', en: 'Connection point deleted' }), 'info');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                  title={t({ it: 'Elimina punto di collegamento', en: 'Delete connection point' })}
                >
                  <Trash size={14} /> {t({ it: 'Elimina punto di collegamento', en: 'Delete connection point' })}
                </button>
              ) : null}
            </>
            ) : contextMenu.kind === 'safety_card' ? (
            <>
              <button
                onClick={() => {
                  toggleSecurityCardVisibility();
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({
                  it: securityLayerVisible ? 'Nascondi scheda sicurezza' : 'Mostra scheda sicurezza',
                  en: securityLayerVisible ? 'Hide safety card' : 'Show safety card'
                })}
              >
                {securityLayerVisible ? <EyeOff size={14} className="text-slate-500" /> : <Eye size={14} className="text-slate-500" />}
                {t({
                  it: securityLayerVisible ? 'Nascondi' : 'Mostra',
                  en: securityLayerVisible ? 'Hide' : 'Show'
                })}
              </button>
              <button
                onClick={() => {
                  setEmergencyContactsOpen(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Apri rubrica emergenze', en: 'Open emergency directory' })}
              >
                <PhoneCall size={14} className="text-slate-500" /> {t({ it: 'Rubrica emergenze', en: 'Emergency directory' })}
              </button>
            </>
            ) : contextMenu.kind === 'scale' ? (
            <>
              <button
                onClick={() => {
                  openScaleEdit();
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Ricalibra scala', en: 'Recalibrate scale' })}
              >
                <Ruler size={14} className="text-slate-500" /> {t({ it: 'Ricalibra scala', en: 'Recalibrate scale' })}
              </button>
              <button
                onClick={() => {
                  requestClearScale();
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Elimina scala', en: 'Delete scale' })}
              >
                <Trash size={14} className="text-rose-600" /> {t({ it: 'Elimina scala', en: 'Delete scale' })}
              </button>
            </>
	          ) : (
	            <>
              <button
                onClick={() => {
                  if (contextMenu.kind !== 'map') return;
                  openEscapeRouteAt({ x: contextMenu.worldX, y: contextMenu.worldY }, 'map');
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
	                title={t({ it: 'Calcola via di fuga verso uscita esterna antipanico', en: 'Compute escape route to nearest external panic exit' })}
              >
                <Footprints size={14} className="text-slate-500" /> {t({ it: 'Via di fuga', en: 'Escape route' })}
              </button>
	              {planPhotoIds.length ? (
	                <button
                  onClick={() => {
                    openPhotoViewer({ id: planPhotoIds[0], selectionIds: planPhotoIds });
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  title={t({ it: 'Vedi galleria foto', en: 'View photo gallery' })}
                >
                  <ImageIcon size={14} className="text-slate-500" /> {t({ it: 'Vedi galleria foto', en: 'View photo gallery' })}
                </button>
              ) : null}
              <button
                onClick={() => toggleMapSubmenu('view')}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Visualizza', en: 'View' })}
              >
                <BookmarkPlus size={14} className="text-slate-500" /> {t({ it: 'Vista', en: 'View' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('measure')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Misure', en: 'Measurements' })}
              >
                <Ruler size={14} className="text-slate-500" /> {t({ it: 'Misure', en: 'Measurements' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('create')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Aggiungi', en: 'Add' })}
              >
                <Plus size={14} className="text-slate-500" /> {t({ it: 'Aggiungi', en: 'Add' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('print')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Stampa', en: 'Print & export' })}
              >
                <Crop size={14} className="text-slate-500" /> {t({ it: 'Stampa', en: 'Print' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
              <button
                onClick={() => toggleMapSubmenu('manage')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Gestione', en: 'Manage' })}
              >
                <Trash size={14} className="text-slate-500" /> {t({ it: 'Gestione', en: 'Manage' })}
                <ChevronRight size={14} className="ml-auto text-slate-400" />
              </button>
            </>
          )}
        </div>

        {layersContextMenu ? (
          <div
            ref={layersContextMenuRef}
            className="context-menu-panel fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-semibold text-ink">{t({ it: 'Livelli', en: 'Layers' })}</span>
              <button
                onClick={() => setLayersContextMenu(null)}
                className="text-slate-400 hover:text-ink"
                title={t({ it: 'Chiudi', en: 'Close' })}
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => {
                  setHideAllLayers(planId, false);
                  setVisibleLayerIds(planId, layerIds);
                  setLayersContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                title={t({ it: 'Mostra tutti i livelli', en: 'Show all layers' })}
              >
                <Eye size={14} className="text-slate-500" /> {t({ it: 'Mostra tutti', en: 'Show all' })}
              </button>
	              <button
	                onClick={() => {
	                  setHideAllLayers(planId, true);
	                  setVisibleLayerIds(planId, []);
	                  setLayersContextMenu(null);
	                }}
	                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
	                title={t({ it: 'Nascondi tutti i livelli', en: 'Hide all layers' })}
              >
                <EyeOff size={14} className="text-slate-500" /> {t({ it: 'Nascondi tutti', en: 'Hide all' })}
              </button>
              <div className="my-2 h-px bg-slate-100" />
              <div className="max-h-64 overflow-y-auto">
                {orderedPlanLayers
                  .filter((l: any) => String(l.id) !== ALL_ITEMS_LAYER_ID)
                  .map((l: any) => {
                    const layerId = String(l.id);
                    const isOn = !hideAllLayers && (allItemsSelected ? true : effectiveVisibleLayerIds.includes(layerId));
                    const label = getLayerLabel(layerId);
                    return (
	                      <button
	                        key={layerId}
	                        onClick={() => {
	                          const base = hideAllLayers ? [] : effectiveVisibleLayerIds;
	                          if (hideAllLayers) setHideAllLayers(planId, false);
	                          const nextRaw = base.includes(layerId) ? base.filter((x) => x !== layerId) : [...base, layerId];
	                          const next = normalizeLayerSelection(nextRaw);
	                          setVisibleLayerIds(planId, next);
	                        }}
	                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
	                        title={label}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="inline-flex h-3 w-3 shrink-0 rounded-full border border-slate-200"
                            style={{ background: String((l as any).color || '#94a3b8') }}
                          />
                          <span className="min-w-0 truncate text-sm text-slate-700">{label}</span>
                        </span>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                            isOn ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'
                          }`}
                          title={isOn ? t({ it: 'Visibile', en: 'Visible' }) : t({ it: 'Nascosto', en: 'Hidden' })}
                        >
                          {isOn ? <Eye size={12} /> : <EyeOff size={12} />}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'view' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Vista', en: 'View' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  setViewModalOpen(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Salva vista', en: 'Save view' })}
              >
                <BookmarkPlus size={14} className="text-slate-500" /> {t({ it: 'Salva vista', en: 'Save view' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                if (!hasDefaultView) return;
                goToDefaultView();
                setContextMenu(null);
              }}
              disabled={!hasDefaultView}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                hasDefaultView
                  ? t({ it: 'Vai a default', en: 'Go to default' })
                  : t({ it: 'Imposta prima una vista di default', en: 'Set a default view first' })
              }
            >
              <Home size={14} className="text-slate-500" /> {t({ it: 'Vai a default', en: 'Go to default' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'measure' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
              {t({ it: 'Misure', en: 'Measurements' })}
            </div>
            {!metersPerPixel && !isReadOnly ? (
              <button
                onClick={() => {
                  if ((contextMenu as any).kind !== 'map') return;
                  startScaleMode();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Imposta la scala della planimetria', en: 'Set the floor plan scale' })}
              >
                <Ruler size={14} className="text-rose-600" /> {t({ it: 'Imposta scala', en: 'Set scale' })}
              </button>
            ) : null}
            {metersPerPixel && !isReadOnly ? (
              <button
                onClick={() => {
                  if ((contextMenu as any).kind !== 'map') return;
                  requestClearScale();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Cancella la scala della planimetria', en: 'Clear the floor plan scale' })}
              >
                <Ruler size={14} className="text-rose-600" /> {t({ it: 'Cancella scala', en: 'Clear scale' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                if ((contextMenu as any).kind !== 'map') return;
                startMeasure({ x: (contextMenu as any).worldX, y: (contextMenu as any).worldY });
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Misura distanza (m)', en: 'Measure distance (m)' })}
            >
              <Ruler size={14} className="text-slate-500" /> {t({ it: 'Misura distanza (m)', en: 'Measure distance (m)' })}
            </button>
            <button
              onClick={() => {
                if ((contextMenu as any).kind !== 'map') return;
                startQuote({ x: (contextMenu as any).worldX, y: (contextMenu as any).worldY });
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Quota (Q)', en: 'Quote (Q)' })}
            >
              <MoveDiagonal size={14} className="text-slate-500" /> {t({ it: 'Quota (Q)', en: 'Quote (Q)' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'create' ? (
          <div
            className="fixed z-50 w-80 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(320)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Aggiungi', en: 'Add' })}</div>
            {!isReadOnly ? (
              <>
                <div className="px-2 pt-1 text-[11px] font-semibold text-slate-500">{t({ it: 'Stanze', en: 'Rooms' })}</div>
                <button
                  onClick={() => {
                    setRoomCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Apri catalogo stanze', en: 'Open room catalog' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Catalogo stanze', en: 'Room catalog' })}
                </button>
                <button
                  onClick={() => {
                    beginCorridorPolyDraw();
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Crea corridoio', en: 'Create corridor' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Crea corridoio', en: 'Create corridor' })}
                </button>
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Oggetti', en: 'Objects' })}</div>
                <button
                  onClick={() => {
                    setAllTypesDefaultTab('objects');
                    setAllTypesOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Apri catalogo oggetti', en: 'Open object catalog' })}
                >
                  <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Catalogo oggetti', en: 'Object catalog' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('text');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi testo', en: 'Add text' })}
                >
                  <TypeIcon size={14} className="text-slate-500" /> {t({ it: 'Aggiungi testo', en: 'Add text' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('image');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi immagine', en: 'Add image' })}
                >
                  <ImageIcon size={14} className="text-slate-500" /> {t({ it: 'Aggiungi immagine', en: 'Add image' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('photo');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi foto', en: 'Add photo' })}
                >
                  <Camera size={14} className="text-slate-500" /> {t({ it: 'Aggiungi foto', en: 'Add photo' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('postit');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                >
                  <StickyNote size={14} className="text-slate-500" /> {t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                </button>
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Scrivanie', en: 'Desks' })}</div>
                <button
                  onClick={() => {
                    if (!deskCatalogDefs.length) return;
                    setDeskCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  disabled={!deskCatalogDefs.length}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Apri catalogo scrivanie', en: 'Open desk catalog' })}
                >
                  <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Catalogo scrivanie', en: 'Desk catalog' })}
                </button>
                {!deskCatalogDefs.length ? (
                  <div className="mt-2 px-2 text-xs text-slate-500">
                    {t({ it: 'Nessuna scrivania disponibile.', en: 'No desks available.' })}
                  </div>
                ) : null}
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Mura', en: 'Walls' })}</div>
                <button
                  onClick={() => {
                    if (!wallTypeDefs.length) return;
                    setWallCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  disabled={!wallTypeDefs.length}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Apri catalogo mura', en: 'Open wall catalog' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Catalogo mura', en: 'Wall catalog' })}
                </button>
                {!wallTypeDefs.length ? (
                  <div className="mt-2 px-2 text-xs text-slate-500">
                    {t({ it: 'Nessun muro disponibile.', en: 'No walls available.' })}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="px-2 py-2 text-xs text-slate-500">{t({ it: 'Sola lettura', en: 'Read-only' })}</div>
            )}
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'print' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Stampa', en: 'Print' })}</div>
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
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={(basePlan as any)?.printArea ? t({ it: 'Rimuovi area di stampa', en: 'Clear print area' }) : t({ it: 'Imposta area di stampa', en: 'Set print area' })}
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
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
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
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Esporta PDF', en: 'Export PDF' })}
            >
              <FileDown size={14} className="text-slate-500" /> {t({ it: 'Esporta PDF', en: 'Export PDF' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'manage' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Gestione', en: 'Manage' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  setConfirmClearObjects(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                title={t({ it: 'Elimina tutti gli oggetti', en: 'Delete all objects' })}
              >
                <Trash size={14} /> {t({ it: 'Elimina tutti gli oggetti', en: 'Delete all objects' })}
              </button>
            ) : (
              <div className="px-2 py-2 text-xs text-slate-500">{t({ it: 'Sola lettura', en: 'Read-only' })}</div>
            )}
          </div>
        ) : null}
        </>
      ) : null}

      {rackModal && basePlan ? (
        <RackModal
          open={!!rackModal}
          plan={basePlan}
          rackObjectId={rackModal.objectId}
          rackObjectName={renderPlan.objects.find((o) => o.id === rackModal.objectId)?.name || t({ it: 'Rack', en: 'Rack' })}
          readOnly={isReadOnly}
          onClose={() => setRackModal(null)}
        />
      ) : null}

      {rackPortsLink && rackPortsLinkItem && renderPlan ? (
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

      <Suspense fallback={null}>
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
          onPreviewObject={(objectId) => {
            if (!renderPlan) return;
            const obj = renderPlan.objects.find((o) => o.id === objectId);
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

      <RoomModal
        open={!!roomModal}
        initialName={roomModal?.mode === 'edit' ? roomModal.initialName : ''}
        initialNameEn={roomModal?.mode === 'edit' ? roomModal.initialNameEn : ''}
        initialDepartmentTags={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.departmentTags
            : undefined
        }
        departmentOptions={roomDepartmentOptions}
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
            : roomModalInitialSurfaceSqm
        }
        surfaceLocked={!!metersPerPixel}
        measurements={roomModalMetrics}
        shapePreview={roomModalPreview}
        initialNotes={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.notes
            : undefined
        }
        initialLogical={
          roomModal?.mode === 'edit'
            ? (basePlan.rooms || []).find((r) => r.id === roomModal.roomId)?.logical
            : undefined
        }
        objects={roomModal?.mode === 'edit' ? roomStatsById.get(roomModal.roomId)?.items || [] : undefined}
        getTypeLabel={getTypeLabel}
        getTypeIcon={getTypeIcon}
        isUserObject={isUserObject}
        onOpenPhotos={openPhotoViewer}
        canCreateWalls={roomModal?.mode === 'edit' && !roomHasWalls && !isReadOnly}
        onCreateWalls={handleCreateWallsForRoom}
        onDeleteObject={
          !isReadOnly && roomModal?.mode === 'edit'
            ? (id) => {
                setConfirmDelete([id]);
              }
            : undefined
        }
        onClose={() => {
          skipRoomWallTypesRef.current = false;
          setRoomModal(null);
        }}
        onSubmit={({ name, nameEn, departmentTags, color, capacity, labelScale, showName, surfaceSqm, notes, logical }) => {
          if (!roomModal || isReadOnly) return false;
          if (roomModal.mode === 'edit') {
            const existing = (basePlan.rooms || []).find((r) => r.id === roomModal.roomId);
            const nextRoom = { ...(existing || {}), name, nameEn, departmentTags, color, capacity, labelScale, showName, surfaceSqm, notes, logical };
            if (hasRoomOverlap(nextRoom, roomModal.roomId)) {
              notifyRoomOverlap();
              return false;
            }
            markTouched();
            updateRoom(basePlan.id, roomModal.roomId, { name, nameEn, departmentTags, color, capacity, labelScale, showName, surfaceSqm, notes, logical });
            push(
              t({ it: `Stanza aggiornata: ${name}`, en: `Room updated: ${name}` }),
              'success'
            );
            postAuditEvent({
              event: 'room_update',
              scopeType: 'plan',
              scopeId: basePlan.id,
              details: {
                id: roomModal.roomId,
                name,
                nameEn: nameEn ?? null,
                departmentTags: departmentTags || null,
                color: color || null,
                capacity: capacity ?? null,
                labelScale: labelScale ?? null,
                showName,
                surfaceSqm: surfaceSqm ?? null,
                notes: notes ?? null,
                logical: logical ?? null
              }
            });
            setSelectedRoomId(roomModal.roomId);
            setSelectedRoomIds([roomModal.roomId]);
            setHighlightRoom({ roomId: roomModal.roomId, until: Date.now() + 2600 });
            setRoomModal(null);
            return true;
          }
          const testRoom =
            roomModal.kind === 'rect'
              ? {
                  id: 'new-room',
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
                  kind: 'rect',
                  ...roomModal.rect
                }
              : {
                  id: 'new-room',
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
                  kind: 'poly',
                  points: roomModal.points
                };
          if (hasRoomOverlap(testRoom)) {
            notifyRoomOverlap();
            return false;
          }
          markTouched();
          const id =
            roomModal.kind === 'rect'
              ? addRoom(basePlan.id, {
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
                  kind: 'rect',
                  ...roomModal.rect
                })
              : addRoom(basePlan.id, {
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
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
              nameEn: nameEn ?? null,
              departmentTags: departmentTags || null,
              kind: roomModal.kind,
              color: color || null,
              capacity: capacity ?? null,
              labelScale: labelScale ?? null,
              showName,
              surfaceSqm: surfaceSqm ?? null,
              notes: notes ?? null,
              logical: logical ?? null
            }
          });
          const updates: Record<string, string | undefined> = {};
          for (const obj of basePlan.objects) {
            if (isPointInRoom({ ...testRoom, id }, obj.x, obj.y)) {
              updates[obj.id] = id;
            }
          }
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          push(
            t({ it: `Stanza creata: ${name}`, en: `Room created: ${name}` }),
            'success'
          );
          setSelectedRoomId(id);
          setSelectedRoomIds([id]);
          setHighlightRoom({ roomId: id, until: Date.now() + 3200 });
          skipRoomWallTypesRef.current = false;
          setRoomModal(null);
          setRoomWallPrompt({
            roomId: id,
            roomName: name,
            kind: roomModal.kind,
            rect: roomModal.kind === 'rect' ? roomModal.rect : undefined,
            points: roomModal.kind === 'poly' ? roomModal.points : undefined
          });
          return true;
        }}
      />

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

      <RoomAllocationModal
        open={roomAllocationOpen}
        clients={allClients}
        currentClientId={client?.id}
        currentSiteId={site?.id}
        onHighlight={({ planId: targetPlanId, roomId }) => {
          if (targetPlanId !== planId) {
            setRoomAllocationOpen(false);
            setSelectedPlan(targetPlanId);
            navigate(`/plan/${targetPlanId}?focusRoom=${encodeURIComponent(roomId)}`);
            return;
          }
          setSelectedRoomId(roomId);
          setSelectedRoomIds([roomId]);
          setHighlightRoom({ roomId, until: Date.now() + 3200 });
        }}
        onClose={() => setRoomAllocationOpen(false)}
      />

      <CapacityDashboardModal
        open={capacityDashboardOpen}
        clients={allClients}
        currentClientId={client?.id}
        currentSiteId={site?.id}
        onClose={() => setCapacityDashboardOpen(false)}
      />

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

      <BulkEditSelectionModal
        open={bulkEditSelectionOpen}
        objects={(renderPlan?.objects || []).filter((o) => selectedObjectIds.includes(o.id))}
        getTypeLabel={getTypeLabel}
        getTypeIcon={getTypeIcon}
        onPreviewObject={(objectId) => {
          if (!renderPlan) return;
          const obj = renderPlan.objects.find((o) => o.id === objectId);
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
              const obj = renderPlan.objects.find((o) => o.id === confirmDelete[0]);
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

      <ViewModal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onSubmit={handleSaveView}
        hasExistingDefault={hasDefaultView}
        existingDefaultName={(basePlan.views || []).find((v) => v.isDefault)?.name || ''}
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

      <RealUserDetailsModal
        open={!!realUserDetailsId}
        userName={realUserDetailsName}
        details={realUserDetails}
        onClose={() => setRealUserDetailsId(null)}
      />

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
		        <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
		        <Dialog as="div" className="relative z-50" onClose={() => {}}>
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

      <SaveRevisionModal
        open={saveRevisionOpen}
        hasExisting={hasAnyRevision}
        latestRevMajor={latestRev.major}
        latestRevMinor={latestRev.minor}
        reason={saveRevisionReason}
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
            : pendingPostSaveAction
              ? () => {
                  const action = pendingPostSaveAction;
                  clearPendingPostSaveAction();
                  revertUnsavedChanges();
                  resetTouched();
                  entrySnapshotRef.current = toSnapshot(planRef.current || plan);
                  setSaveRevisionOpen(false);
                  if (action) void performPendingPostSaveAction(action);
                }
              : undefined
        }
        onClose={() => {
          setSaveRevisionOpen(false);
          pendingNavigateRef.current = null;
          clearPendingSaveNavigate?.();
          clearPendingPostSaveAction();
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
          if (pendingPostSaveAction) {
            const action = pendingPostSaveAction;
            clearPendingPostSaveAction();
            void performPendingPostSaveAction(action);
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
      <EmergencyContactsModal
        open={emergencyContactsOpen}
        clientId={client?.id || null}
        readOnly={planAccess !== 'rw'}
        safetyCardVisible={securityLayerVisible}
        onToggleSafetyCard={toggleSecurityCardVisibility}
        safetyCardToggleDisabled={!planId}
        onClose={() => setEmergencyContactsOpen(false)}
      />

      <Transition appear show={webcamGesturesEnabled && presentationEnterModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (presentationEnterBusy) return;
            setPresentationEnterModalOpen(false);
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
                <Dialog.Panel className="modal-panel w-full max-w-lg transform overflow-hidden text-left align-middle transition-all">
                  <div className="modal-header">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Modalità presentazione', en: 'Presentation mode' })}
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        if (presentationEnterBusy) return;
                        setPresentationEnterModalOpen(false);
                      }}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="modal-description">
                    {t({
                      it: 'Stai per passare alla modalità Presentazione a schermo intero. Puoi usare la webcam e i gesti per zoomare e spostarti nella planimetria. Vuoi concedere l’accesso alla webcam e procedere, oppure procedere senza webcam?',
                      en: 'You are about to enter fullscreen Presentation mode. You can use the webcam and hand gestures to pan and zoom the floor plan. Do you want to grant webcam access and proceed, or proceed without the webcam?'
                    })}
                  </Dialog.Description>
                  {cameraPermissionState === 'denied' ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {t({
                        it: 'La webcam risulta bloccata per questo sito nelle impostazioni del browser. Per procedere con i gesti, abilita la camera per questo sito e riprova.',
                        en: 'The webcam appears to be blocked for this site in your browser settings. To use gestures, allow camera access for this site and try again.'
                      })}
                    </div>
                  ) : null}
                  <div className="modal-footer flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (presentationEnterBusy) return;
                        setPresentationEnterModalOpen(false);
                      }}
                      className="btn-secondary"
                      title={t({ it: 'Resta nella modalità attuale', en: 'Stay in the current mode' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={() => {
                        if (presentationEnterBusy) return;
                        setPresentationWebcamEnabled(false);
                        setPresentationWebcamCalib(null);
                        setPresentationEnterModalOpen(false);
                        enterFullscreenFromGesture();
                        togglePresentationMode?.();
                      }}
                      className="btn-secondary"
                      title={t({ it: 'Entra in presentazione senza webcam', en: 'Enter presentation without the webcam' })}
                    >
                      {t({ it: 'Procedi senza webcam', en: 'Proceed without webcam' })}
                    </button>
                    <button
                      onClick={() => {
                        if (presentationEnterBusy) return;
                        setPresentationEnterBusy(true);
                        setPresentationWebcamEnabled(false);
                        setPresentationWebcamCalib(null);
                        setPresentationEnterModalOpen(false);
                        enterFullscreenFromGesture();
                        togglePresentationMode?.();
                        const p = requestCameraPermissionOnce();
                        void p
                          .then(async (ok) => {
                            const perm = await queryCameraPermission();
                            setCameraPermissionState?.(perm);
                            if (!ok) {
                              push(
                                t({
                                  it: 'Accesso alla webcam non concesso. Puoi usare la presentazione senza webcam.',
                                  en: 'Webcam access was not granted. You can still use presentation mode without the webcam.'
                                }),
                                'danger'
                              );
                            }
                          })
                          .finally(() => setPresentationEnterBusy(false));
                      }}
                      className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={presentationEnterBusy}
                      title={t({ it: 'Concedi accesso alla webcam e procedi', en: 'Grant webcam access and proceed' })}
                    >
                      {presentationEnterBusy ? t({ it: 'Attendere…', en: 'Please wait…' }) : t({ it: 'Concedi accesso e procedi', en: 'Grant access and proceed' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* legacy multi-print modal kept for future use */}
    </div>
  );
};

export default PlanView;
