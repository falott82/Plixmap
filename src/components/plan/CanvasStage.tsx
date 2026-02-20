import { Fragment, forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer, Wedge } from 'react-konva';
import { renderToStaticMarkup } from 'react-dom/server';
import useImage from 'use-image';
import { Crosshair, Eye, Hand, MonitorPlay, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Corridor, FloorPlan, IconName, MapObject, MapObjectType, RoomConnectionDoor } from '../../store/types';
import { TEXT_FONT_OPTIONS, WALL_LAYER_COLOR, WIFI_RANGE_SCALE_MAX } from '../../store/data';
import { isSecurityTypeId } from '../../store/security';
import { useUIStore } from '../../store/useUIStore';
import { clamp } from '../../utils/geometry';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';
import { perfMetrics } from '../../utils/perfMetrics';
import { isDeskType } from './deskTypes';
import { getRoomSpecialType, isRoomWithoutWindows } from '../../utils/roomProperties';
import { getWallTypeColor } from '../../utils/wallColors';

interface Props {
  plan: FloorPlan;
  selectedId?: string;
  selectedIds?: string[];
  hideMultiSelectionBox?: boolean;
  selectedRoomId?: string;
  selectedRoomIds?: string[];
  selectedCorridorId?: string;
  selectedLinkId?: string | null;
  snapEnabled?: boolean;
  gridSize?: number;
  showGrid?: boolean;
  highlightId?: string;
  highlightUntil?: number;
  highlightRoomId?: string;
  highlightRoomUntil?: number;
  roomStatsById?: Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }>;
  focusTarget?: { x: number; y: number; zoom?: number; nonce: number };
  pendingType?: MapObjectType | null;
  readOnly?: boolean;
  panToolActive?: boolean;
  onTogglePanTool?: () => void;
  roomDrawMode?: 'rect' | 'poly' | null;
  corridorDrawMode?: 'poly' | null;
  printArea?: { x: number; y: number; width: number; height: number } | null;
  printAreaMode?: boolean;
  showPrintArea?: boolean;
  toolMode?: 'scale' | 'wall' | 'measure' | 'quote' | null;
  onToolPoint?: (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => void;
  onToolMove?: (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => void;
  onToolDoubleClick?: (point: { x: number; y: number }) => void;
  onWallDraftContextMenu?: () => void;
  wallTypeIds?: Set<string>;
  wallDraft?: { points: { x: number; y: number }[]; pointer?: { x: number; y: number } | null };
  scaleDraft?: { start?: { x: number; y: number }; end?: { x: number; y: number }; pointer?: { x: number; y: number } | null };
  scaleLine?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    label?: string;
    labelScale?: number;
    opacity?: number;
    strokeWidth?: number;
  };
  onScaleMove?: (payload: { start: { x: number; y: number }; end: { x: number; y: number } }) => void;
  measureDraft?: {
    points: { x: number; y: number }[];
    pointer?: { x: number; y: number } | null;
    closed?: boolean;
    label?: string;
    areaLabel?: string;
  };
  quoteDraft?: {
    points: { x: number; y: number }[];
    pointer?: { x: number; y: number } | null;
    label?: string;
  };
  quoteLabels?: Record<string, string>;
  objectTypeIcons: Record<string, IconName | undefined>;
  metersPerPixel?: number | null;
  zoom: number;
  pan: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement>;
  autoFit?: boolean;
  onGoDefaultView?: () => void;
  hasDefaultView?: boolean;
  onToggleViewsMenu?: () => void;
  suspendKeyboardShortcuts?: boolean;
  presentationMode?: boolean;
  onTogglePresentation?: () => void;
  webcamEnabled?: boolean;
  webcamReady?: boolean;
  webcamHandDetected?: boolean;
  onToggleWebcam?: () => void;
  onCalibrateWebcam?: () => void;
  perfEnabled?: boolean;
  onZoomChange: (zoom: number) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onSelect: (id?: string, options?: { keepContext?: boolean; multi?: boolean }) => void;
	  onSelectMany?: (ids: string[]) => void;
	  onSelectRooms?: (ids: string[]) => void;
	  onMoveStart?: (id: string, x: number, y: number, roomId?: string) => void;
	  onMove: (id: string, x: number, y: number) => boolean | void;
  onPlaceNew: (
    type: MapObjectType,
    x: number,
    y: number,
    options?: { textBoxWidth?: number; textBoxHeight?: number }
  ) => void;
	  onEdit: (id: string) => void;
  onContextMenu: (payload: { id: string; clientX: number; clientY: number; wallSegmentLengthPx?: number }) => void;
  onScaleContextMenu?: (payload: { clientX: number; clientY: number }) => void;
  onScaleDoubleClick?: () => void;
  onWallSegmentDblClick?: (payload: { id: string; lengthPx: number }) => void;
  onWallClick?: (payload: { id: string; clientX: number; clientY: number; world: { x: number; y: number } }) => void;
  onLinkContextMenu?: (payload: { id: string; clientX: number; clientY: number }) => void;
  onLinkDblClick?: (id: string) => void;
  onMapContextMenu: (payload: { clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onSelectRoom?: (roomId?: string, options?: { keepContext?: boolean; multi?: boolean; preserveSelection?: boolean; worldX?: number; worldY?: number }) => void;
  onSelectCorridor?: (corridorId?: string, options?: { keepContext?: boolean }) => void;
  selectedCorridorDoor?: { corridorId: string; doorId: string } | null;
  selectedRoomDoorId?: string | null;
  roomDoorDraft?: { roomAId: string; roomBId: string } | null;
  corridorDoorDraft?: { corridorId: string; start?: { edgeIndex: number; t: number; x: number; y: number } } | null;
  onCorridorClick?: (payload: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onCorridorMiddleClick?: (payload: { corridorId: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onCorridorDoorDraftPoint?: (payload: {
    corridorId: string;
    clientX: number;
    clientY: number;
    point: { edgeIndex: number; t: number; x: number; y: number };
  }) => void;
  onSelectCorridorDoor?: (payload?: { corridorId: string; doorId: string }) => void;
  onSelectRoomDoor?: (doorId?: string) => void;
  onCorridorDoorContextMenu?: (payload: { corridorId: string; doorId: string; clientX: number; clientY: number }) => void;
  onCorridorDoorDblClick?: (payload: { corridorId: string; doorId: string }) => void;
  onRoomDoorContextMenu?: (payload: { doorId: string; clientX: number; clientY: number }) => void;
  onRoomDoorDblClick?: (doorId: string) => void;
  onOpenRoomDetails?: (roomId: string) => void;
  onRoomContextMenu?: (payload: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onCorridorContextMenu?: (payload: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onCorridorConnectionContextMenu?: (payload: {
    corridorId: string;
    connectionId: string;
    clientX: number;
    clientY: number;
    worldX: number;
    worldY: number;
  }) => void;
  onSelectLink?: (id?: string) => void;
  onCreateRoom?: (
    shape:
      | { kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
      | { kind: 'poly'; points: { x: number; y: number }[] }
  ) => void;
  onCreateCorridor?: (
    shape:
      | { kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
      | { kind: 'poly'; points: { x: number; y: number }[] }
  ) => void;
  onUpdateCorridor?: (
    corridorId: string,
    payload: {
      kind?: 'rect' | 'poly';
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      labelX?: number;
      labelY?: number;
      labelScale?: number;
      points?: { x: number; y: number }[];
      doors?: Array<{
        id: string;
        edgeIndex: number;
        t: number;
        edgeIndexTo?: number;
        tTo?: number;
        catalogTypeId?: string;
        mode?: 'static' | 'auto_sensor' | 'automated';
        automationUrl?: string;
        description?: string;
        isEmergency?: boolean;
        isMainEntrance?: boolean;
        isExternal?: boolean;
        lastVerificationAt?: string;
        verifierCompany?: string;
        verificationHistory?: Array<{ id: string; date?: string; company: string; notes?: string; createdAt: number }>;
        linkedRoomIds?: string[];
      }>;
      connections?: Array<{ id: string; edgeIndex: number; t: number; planIds: string[]; transitionType?: 'stairs' | 'elevator' }>;
    }
  ) => void;
  onAdjustCorridorLabelScale?: (corridorId: string, delta: number) => void;
  onUpdateRoom?: (
    roomId: string,
    payload: {
      kind?: 'rect' | 'poly';
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      points?: { x: number; y: number }[];
      labelScale?: number;
      labelPosition?: 'top' | 'bottom' | 'left' | 'right';
    }
  ) => void;
  onUpdateObject?: (
    id: string,
    changes: Partial<
      Pick<MapObject, 'scaleX' | 'scaleY' | 'rotation' | 'postitCompact' | 'textBoxWidth' | 'textBoxHeight' | 'textBg'>
    >
  ) => void;
  onOpenPhoto?: (payload: { id: string; selectionIds?: string[] }) => void;
  onMoveWall?: (id: string, dx: number, dy: number, batchId?: string, movedRoomIds?: string[]) => void;
  onSetPrintArea?: (rect: { x: number; y: number; width: number; height: number }) => void;
  wallAttenuationByType?: Map<string, number>;
  onUpdateQuotePoints?: (id: string, points: { x: number; y: number }[]) => void;
  safetyCard?: {
    visible: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    fontIndex?: number;
    colorIndex?: number;
    textBgIndex?: number;
    title: string;
    numbersLabel: string;
    pointsLabel: string;
    numbersText: string;
    pointsText: string;
    noNumbersText: string;
    noPointsText: string;
  } | null;
  onSafetyCardChange?: (
    layout: { x: number; y: number; w: number; h: number; fontSize: number; fontIndex?: number; colorIndex?: number; textBgIndex?: number },
    options?: { commit?: boolean }
  ) => void;
  onSafetyCardDoubleClick?: () => void;
  onSafetyCardContextMenu?: (payload: { clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  connectionPlanNamesById?: Record<string, string>;
}

export interface CanvasStageHandle {
  getSize: () => { width: number; height: number };
  exportDataUrl: (options?: { pixelRatio?: number; mimeType?: string; quality?: number }) => { dataUrl: string; width: number; height: number };
  fitView: () => void;
  getObjectBounds: (id: string) => { minX: number; minY: number; maxX: number; maxY: number } | null;
}

const hexToRgba = (hex: string, alpha: number) => {
  const h = String(hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(100,116,139,${alpha})`; // slate-500 fallback
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};

const formatMeasure = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/, '');
};

const TEXT_BOX_MIN_WIDTH = 80;
const TEXT_BOX_MIN_HEIGHT = 32;
const TEXT_BOX_DEFAULT_WIDTH = 160;
const TEXT_BOX_DEFAULT_HEIGHT = 56;
const OBJECT_CULL_MARGIN = 420;
const PHOTO_ICON_BASE_SIZE = 34;
const SELECTION_STROKE_SCALE = 0.6;
const SELECTION_COLOR = '#2563eb';
const SELECTION_FILL = 'rgba(37,99,235,0.1)';
const SELECTION_GLOW = 'rgba(37,99,235,0.18)';
const SELECTION_DASH = [6, 6];
const SAFETY_CARD_HELP_TOAST_ID = 'safety-card-help';
const SAFETY_CARD_COLOR_VARIANTS = [
  { body: '#e0f2fe', header: '#bae6fd', border: '#0ea5e9', title: '#075985', text: '#0f172a' },
  { body: '#ecfeff', header: '#cffafe', border: '#06b6d4', title: '#0e7490', text: '#0f172a' },
  { body: '#dbeafe', header: '#bfdbfe', border: '#3b82f6', title: '#1d4ed8', text: '#0f172a' },
  { body: '#f0f9ff', header: '#e0f2fe', border: '#0284c7', title: '#0c4a6e', text: '#111827' }
] as const;
const SAFETY_CARD_TEXT_BG_VARIANTS = ['transparent', '#ecfeff', '#dbeafe', '#e0f2fe'] as const;
const SAFETY_CARD_FONT_VALUES = (TEXT_FONT_OPTIONS || []).map((entry) => String(entry.value || '').trim()).filter(Boolean);

const getDeskBounds = (
  type: string,
  dims: {
    deskSize: number;
    deskRectW: number;
    deskRectH: number;
    deskLongW: number;
    deskLongH: number;
    deskDoubleW: number;
    deskDoubleH: number;
    deskDoubleGap: number;
    deskTrapBottom: number;
    deskTrapHeight: number;
  }
) => {
  if (type === 'desk_rect') return { width: dims.deskRectW, height: dims.deskRectH };
  if (type === 'desk_double') return { width: dims.deskDoubleW * 2 + dims.deskDoubleGap, height: dims.deskDoubleH };
  if (type === 'desk_long') return { width: dims.deskLongW, height: dims.deskLongH };
  if (type === 'desk_trap') return { width: dims.deskTrapBottom, height: dims.deskTrapHeight };
  return { width: dims.deskSize, height: dims.deskSize };
};

const getRotatedRectBounds = (centerX: number, centerY: number, width: number, height: number, rotation: number) => {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  if (!w || !h) return null;
  const angle = Number(rotation) || 0;
  if (!angle) {
    const halfW = w / 2;
    const halfH = h / 2;
    return { minX: centerX - halfW, minY: centerY - halfH, maxX: centerX + halfW, maxY: centerY + halfH };
  }
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = w / 2;
  const halfH = h / 2;
  const points = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH }
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const rx = p.x * cos - p.y * sin + centerX;
    const ry = p.x * sin + p.y * cos + centerY;
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { minX, minY, maxX, maxY };
};

const getViewportWorldBounds = (
  dimensions: { width: number; height: number },
  pan: { x: number; y: number },
  zoom: number
) => {
  const safeZoom = Math.max(0.001, Number(zoom) || 1);
  const minX = (0 - pan.x) / safeZoom;
  const minY = (0 - pan.y) / safeZoom;
  const maxX = (dimensions.width - pan.x) / safeZoom;
  const maxY = (dimensions.height - pan.y) / safeZoom;
  return { minX, minY, maxX, maxY };
};

const isObjectPotentiallyVisible = (
  obj: MapObject,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  margin = OBJECT_CULL_MARGIN
) => {
  const x = Number(obj?.x || 0);
  const y = Number(obj?.y || 0);
  return x >= bounds.minX - margin && x <= bounds.maxX + margin && y >= bounds.minY - margin && y <= bounds.maxY + margin;
};

const intersectRaySegment = (
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
) => {
  const v = { x: b.x - a.x, y: b.y - a.y };
  const denom = dir.x * v.y - dir.y * v.x;
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-6) return null;
  const w = { x: a.x - origin.x, y: a.y - origin.y };
  const t = (w.x * v.y - w.y * v.x) / denom;
  const u = (w.x * dir.y - w.y * dir.x) / denom;
  if (t < 0) return null;
  if (u < 0 || u > 1) return null;
  return t;
};

const CanvasStageImpl = (
  {
  plan,
  selectedId,
  selectedIds,
  hideMultiSelectionBox = false,
  selectedRoomId,
  selectedRoomIds,
  selectedCorridorId,
  selectedLinkId = null,
  snapEnabled = false,
  gridSize = 20,
  showGrid = false,
  highlightId,
  highlightUntil,
  highlightRoomId,
  highlightRoomUntil,
  roomStatsById,
  focusTarget,
  pendingType,
  readOnly = false,
  panToolActive = false,
  onTogglePanTool,
  roomDrawMode = null,
  corridorDrawMode = null,
  printArea = null,
  printAreaMode = false,
  showPrintArea = false,
  toolMode = null,
  onToolPoint,
  onToolMove,
  onToolDoubleClick,
  onWallDraftContextMenu,
  wallTypeIds,
  wallDraft,
  scaleDraft,
  scaleLine,
  onScaleMove,
  measureDraft,
  quoteDraft,
  quoteLabels,
  objectTypeIcons,
  metersPerPixel = null,
  zoom,
  pan,
  containerRef,
  autoFit = true,
  onGoDefaultView,
  hasDefaultView = false,
  onToggleViewsMenu,
  suspendKeyboardShortcuts = false,
  presentationMode = false,
  onTogglePresentation,
  webcamEnabled = false,
  webcamReady = false,
  webcamHandDetected = false,
  onToggleWebcam,
  onCalibrateWebcam,
  perfEnabled = false,
  onZoomChange,
  onPanChange,
		  onSelect,
	  onSelectMany,
  onSelectRooms,
	  onMoveStart,
	  onMove,
	  onPlaceNew,
  onEdit,
  onContextMenu,
  onScaleContextMenu,
  onScaleDoubleClick,
  onWallSegmentDblClick,
  onWallClick,
  onLinkContextMenu,
  onLinkDblClick,
  onMapContextMenu,
  onSelectRoom,
  onSelectCorridor,
  selectedCorridorDoor = null,
  selectedRoomDoorId = null,
  roomDoorDraft = null,
  corridorDoorDraft = null,
  onCorridorClick,
  onCorridorMiddleClick,
  onCorridorDoorDraftPoint,
  onSelectCorridorDoor,
  onSelectRoomDoor,
  onCorridorDoorContextMenu,
  onCorridorDoorDblClick,
  onRoomDoorContextMenu,
  onRoomDoorDblClick,
  onOpenRoomDetails,
  onSelectLink,
  onCreateRoom,
  onCreateCorridor,
  onUpdateRoom,
  onUpdateCorridor,
  onAdjustCorridorLabelScale,
  onUpdateObject,
  onOpenPhoto,
  onMoveWall,
  onRoomContextMenu,
  onCorridorContextMenu,
  onCorridorConnectionContextMenu,
  onSetPrintArea,
  wallAttenuationByType,
  onUpdateQuotePoints,
  safetyCard = null,
  onSafetyCardChange,
  onSafetyCardDoubleClick,
  onSafetyCardContextMenu,
  connectionPlanNamesById
}: Props,
  ref: React.ForwardedRef<CanvasStageHandle>
) => {
  const t = useT();
  const lang = useLang();
  const getLocalizedName = useCallback(
    (entity: { name?: string; nameEn?: string }, fallback = '') => {
      const itName = String(entity?.name || '').trim();
      const enName = String(entity?.nameEn || '').trim();
      if (lang === 'en') return enName || itName || fallback;
      return itName || enName || fallback;
    },
    [lang]
  );
  const stageRef = useRef<any>(null);
  const renderStartRef = useRef(0);
  renderStartRef.current = performance.now();
  const [hoverCard, setHoverCard] = useState<
    | null
    | {
        clientX: number;
        clientY: number;
        obj: any;
      }
  >(null);
  const [doorHoverCard, setDoorHoverCard] = useState<null | { clientX: number; clientY: number; content: ReactNode }>(null);
  const hoverRaf = useRef<number | null>(null);
  const dragStartRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [highlightNow, setHighlightNow] = useState(Date.now());
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [bgImage] = useImage(plan.imageUrl, plan.imageUrl.startsWith('http') ? 'anonymous' : undefined);
  const baseWidth = plan.width || bgImage?.width || dimensions.width;
  const baseHeight = plan.height || bgImage?.height || dimensions.height;
  const objects = plan.objects || [];
  const viewportRef = useRef({ zoom, pan });
  const fitViewRef = useRef<() => void>(() => undefined);
  const wheelCommitTimer = useRef<number | null>(null);
  const pendingFocusRef = useRef<{ x: number; y: number; zoom?: number; nonce: number } | null>(null);
  const appliedFocusNonceRef = useRef<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef<{ x: number; y: number } | null>(null);
  const fitApplied = useRef<string | null>(null);
  const lastContextMenuAtRef = useRef(0);
  const lastCorridorUndoAtRef = useRef(0);
  const lastBoxSelectAtRef = useRef(0);
  const [roomHighlightNow, setRoomHighlightNow] = useState(Date.now());
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [roomRectSnapHint, setRoomRectSnapHint] = useState<{ x: number; y: number } | null>(null);
  const draftOrigin = useRef<{ x: number; y: number } | null>(null);
  const [textDraftRect, setTextDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  const textDraftOrigin = useRef<{ x: number; y: number } | null>(null);
  const [draftPrintRect, setDraftPrintRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const printOrigin = useRef<{ x: number; y: number } | null>(null);
  const [draftPolyPoints, setDraftPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [draftPolyPointer, setDraftPolyPointer] = useState<{ x: number; y: number } | null>(null);
  const draftPolyRaf = useRef<number | null>(null);
  const draftPolyPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [corridorDraftPolyPoints, setCorridorDraftPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [corridorDraftPolyPointer, setCorridorDraftPolyPointer] = useState<{ x: number; y: number } | null>(null);
  const corridorDraftPolyRaf = useRef<number | null>(null);
  const corridorDraftPolyPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [corridorDoorHover, setCorridorDoorHover] = useState<{ edgeIndex: number; t: number; x: number; y: number } | null>(null);
  const corridorDoorDraftActive = !!corridorDoorDraft?.corridorId;
  const panRaf = useRef<number | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoxRaf = useRef<number | null>(null);
  const pendingSelectionBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const lastSelectionBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const draftRectRaf = useRef<number | null>(null);
  const pendingDraftRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const textDraftRaf = useRef<number | null>(null);
  const pendingTextDraftRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const draftPrintRectRaf = useRef<number | null>(null);
  const pendingDraftPrintRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const textTransformRaf = useRef<number | null>(null);
  const pendingTextTransformRef = useRef<{ id: string; width: number; height: number } | null>(null);
  const [cameraRotateId, setCameraRotateId] = useState<string | null>(null);
  const cameraRotateRef = useRef<{ id: string; origin: { x: number; y: number } } | null>(null);
  const cameraRotateRaf = useRef<number | null>(null);
  const cameraRotatePendingRef = useRef<{ x: number; y: number } | null>(null);
  const cameraRotateSnapRef = useRef<boolean>(false);
  const quoteResizeRef = useRef<{ id: string; index: number; points: { x: number; y: number }[]; node?: any } | null>(null);
  const [quoteResizePreview, setQuoteResizePreview] = useState<{ id: string; points: { x: number; y: number }[] } | null>(
    null
  );

  useEffect(() => {
    if (!perfEnabled) return;
    perfMetrics.canvasRenders += 1;
    perfMetrics.canvasLastRenderMs = Math.round(performance.now() - renderStartRef.current);
  });

  useEffect(() => {
    if (!perfEnabled) return;
    const countNodes = (node: any): number => {
      if (!node || typeof node.getChildren !== 'function') return 1;
      const children = node.getChildren() || [];
      if (!children.length) return 1;
      let total = 1;
      for (const child of children) total += countNodes(child);
      return total;
    };
    const tick = () => {
      const stage = stageRef.current;
      if (!stage || typeof stage.getChildren !== 'function') return;
      const layers = stage.getChildren() || [];
      perfMetrics.konvaLayerCount = layers.length;
      let nodes = 1;
      for (const layer of layers) nodes += countNodes(layer);
      perfMetrics.konvaNodeCount = nodes;
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [perfEnabled]);

  const transformerRef = useRef<any>(null);
  const deskTransformerRef = useRef<any>(null);
  const freeTransformerRef = useRef<any>(null);
  const selectedRoomNodeRef = useRef<any>(null);
  const roomNodeRefs = useRef<Record<string, any>>({});
  const polyLineRefs = useRef<Record<string, any>>({});
  const polyVertexRefs = useRef<Record<string, Record<number, any>>>({});
  const corridorNodeRefs = useRef<Record<string, any>>({});
  const corridorPolyLineRefs = useRef<Record<string, any>>({});
  const corridorVertexRefs = useRef<Record<string, Record<number, any>>>({});
  const objectsLayerRef = useRef<any>(null);
  const objectNodeRefs = useRef<Record<string, any>>({});
  const lastPhotoOpenAtRef = useRef(0);
  const selectedRoomIdsRef = useRef<string[]>([]);
  const boxSelectionActiveRef = useRef(false);
  const roomDragRef = useRef<{
    roomId: string;
    kind: 'rect' | 'poly';
    startX: number;
    startY: number;
    node: any;
    cancelled: boolean;
  } | null>(null);
  const corridorDragRef = useRef<{
    corridorId: string;
    startX: number;
    startY: number;
    node: any;
    cancelled: boolean;
  } | null>(null);
  const corridorLabelDragRef = useRef<{
    corridorId: string;
    node: any;
    points: { x: number; y: number }[];
    lastX: number;
    lastY: number;
  } | null>(null);
  const corridorDoorPointerRef = useRef<{ corridorId: string; doorId: string; allowDrag: boolean } | null>(null);
  const [iconImages, setIconImages] = useState<Record<string, HTMLImageElement | null>>({});
  const [imageObjects, setImageObjects] = useState<Record<string, HTMLImageElement | null>>({});
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  const [pendingPreview, setPendingPreview] = useState<{ x: number; y: number } | null>(null);
  const pendingPreviewRef = useRef<{ x: number; y: number } | null>(null);
  const pendingPreviewRaf = useRef<number | null>(null);
  const [safetyCardDraft, setSafetyCardDraft] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    fontIndex: number;
    colorIndex: number;
    textBgIndex: number;
  } | null>(null);
  const [safetyCardSelected, setSafetyCardSelected] = useState(false);
  const safetyCardRectRef = useRef<any>(null);
  const safetyCardTransformerRef = useRef<any>(null);
  const safetyCardDraggingRef = useRef(false);
  const objectById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);
  const isSafetyCardNode = useCallback((node: any) => {
    let cursor = node;
    while (cursor) {
      const name = String(cursor?.attrs?.name || '');
      if (name === 'safety-card-group' || name.startsWith('safety-card-')) return true;
      const parent = cursor.getParent?.();
      if (!parent || parent === cursor) break;
      cursor = parent;
    }
    return false;
  }, []);
  useEffect(() => {
    if (!safetyCard) {
      setSafetyCardDraft(null);
      return;
    }
    const next = {
      x: Number.isFinite(Number(safetyCard.x)) ? Number(safetyCard.x) : 24,
      y: Number.isFinite(Number(safetyCard.y)) ? Number(safetyCard.y) : 24,
      w: Math.max(220, Number(safetyCard.w) || 420),
      h: Math.max(56, Number(safetyCard.h) || 84),
      fontSize: Math.max(8, Math.min(22, Number(safetyCard.fontSize) || 10)),
      fontIndex: Number.isFinite(Number(safetyCard.fontIndex)) ? Math.max(0, Math.floor(Number(safetyCard.fontIndex))) : 0,
      colorIndex: Number.isFinite(Number(safetyCard.colorIndex)) ? Math.max(0, Math.floor(Number(safetyCard.colorIndex))) : 0,
      textBgIndex: Number.isFinite(Number(safetyCard.textBgIndex)) ? Math.max(0, Math.floor(Number(safetyCard.textBgIndex))) : 0
    };
    setSafetyCardDraft((prev) => {
      if (!prev) return next;
      if (safetyCardDraggingRef.current) return prev;
      const same =
        Math.abs(prev.x - next.x) < 0.01 &&
        Math.abs(prev.y - next.y) < 0.01 &&
        Math.abs(prev.w - next.w) < 0.01 &&
        Math.abs(prev.h - next.h) < 0.01 &&
        Math.abs(prev.fontSize - next.fontSize) < 0.01 &&
        prev.fontIndex === next.fontIndex &&
        prev.colorIndex === next.colorIndex &&
        prev.textBgIndex === next.textBgIndex;
      return same ? prev : next;
    });
  }, [safetyCard]);
  useEffect(() => {
    if (!safetyCard?.visible) {
      setSafetyCardSelected(false);
      toast.dismiss(SAFETY_CARD_HELP_TOAST_ID);
    }
  }, [safetyCard?.visible]);
  useEffect(() => {
    if (!safetyCardSelected) return;
    const hasOtherSelection =
      !!selectedId ||
      !!selectedRoomId ||
      !!selectedCorridorId ||
      !!selectedRoomDoorId ||
      !!selectedLinkId ||
      (Array.isArray(selectedIds) && selectedIds.length > 0) ||
      (Array.isArray(selectedRoomIds) && selectedRoomIds.length > 0);
    if (!hasOtherSelection) return;
    setSafetyCardSelected(false);
    toast.dismiss(SAFETY_CARD_HELP_TOAST_ID);
  }, [safetyCardSelected, selectedCorridorId, selectedId, selectedIds, selectedLinkId, selectedRoomDoorId, selectedRoomId, selectedRoomIds]);
  const adjustSafetyCardFont = useCallback(
    (delta: number) => {
      if (!safetyCardDraft || !onSafetyCardChange) return;
      const nextFontSize = Math.max(8, Math.min(22, Number(safetyCardDraft.fontSize || 10) + delta));
      if (Math.abs(nextFontSize - safetyCardDraft.fontSize) < 0.01) return;
      const nextLayout = { ...safetyCardDraft, fontSize: nextFontSize };
      setSafetyCardDraft(nextLayout);
      onSafetyCardChange(nextLayout, { commit: true });
    },
    [onSafetyCardChange, safetyCardDraft]
  );
  const cycleSafetyCardFont = useCallback(
    (delta: number) => {
      if (!safetyCardDraft || !onSafetyCardChange || !SAFETY_CARD_FONT_VALUES.length) return;
      const current = Number(safetyCardDraft.fontIndex) || 0;
      const nextLayout = {
        ...safetyCardDraft,
        fontIndex: (current + delta + SAFETY_CARD_FONT_VALUES.length) % SAFETY_CARD_FONT_VALUES.length
      };
      setSafetyCardDraft(nextLayout);
      onSafetyCardChange(nextLayout, { commit: true });
    },
    [onSafetyCardChange, safetyCardDraft]
  );
  const cycleSafetyCardColor = useCallback(() => {
    if (!safetyCardDraft || !onSafetyCardChange) return;
    const nextLayout = {
      ...safetyCardDraft,
      colorIndex: (Number(safetyCardDraft.colorIndex) + 1) % SAFETY_CARD_COLOR_VARIANTS.length
    };
    setSafetyCardDraft(nextLayout);
    onSafetyCardChange(nextLayout, { commit: true });
  }, [onSafetyCardChange, safetyCardDraft]);
  const cycleSafetyCardTextBg = useCallback(() => {
    if (!safetyCardDraft || !onSafetyCardChange) return;
    const nextLayout = {
      ...safetyCardDraft,
      textBgIndex: (Number(safetyCardDraft.textBgIndex) + 1) % SAFETY_CARD_TEXT_BG_VARIANTS.length
    };
    setSafetyCardDraft(nextLayout);
    onSafetyCardChange(nextLayout, { commit: true });
  }, [onSafetyCardChange, safetyCardDraft]);
  const selectionOrigin = useRef<{ x: number; y: number } | null>(null);
  const boundsVersionRef = useRef(0);
  const boundsCacheRef = useRef<Map<string, { version: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } | null }>>(
    new Map()
  );
  const spatialIndexRef = useRef<{ version: number; cellSize: number; cells: Map<string, string[]> } | null>(null);
  const pendingHoverRef = useRef<{ clientX: number; clientY: number; obj: any } | null>(null);
  const lastObjectsRef = useRef<MapObject[] | null>(null);
  const lastWallTypeIdSetRef = useRef<Set<string> | null>(null);
  const selectionDragRef = useRef<{
    startX: number;
    startY: number;
    startById: Record<string, { x: number; y: number }>;
    batchId: string;
    roomStartById?: Record<string, { x: number; y: number; kind: 'rect' | 'poly' }>;
  } | null>(null);
  const stagePixelRatio = useMemo(() => {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(1.5, Math.max(1, dpr));
  }, []);
  const wallTypeIdSet = useMemo(() => wallTypeIds || new Set<string>(), [wallTypeIds]);
  const wallAttenuationMap = useMemo(() => wallAttenuationByType || new Map<string, number>(), [wallAttenuationByType]);
  const findPhotoAtPoint = useCallback(
    (x: number, y: number) => {
      for (let i = objects.length - 1; i >= 0; i -= 1) {
        const obj = objects[i];
        if (!obj || obj.type !== 'photo') continue;
        const scale = Number(obj.scale ?? 1) || 1;
        const size = PHOTO_ICON_BASE_SIZE * scale;
        const half = size / 2;
        if (x >= obj.x - half && x <= obj.x + half && y >= obj.y - half && y <= obj.y + half) {
          return obj;
        }
      }
      return null;
    },
    [objects]
  );

  const applyStageTransform = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const stage = stageRef.current;
    if (!stage) return;
    const z = Number(nextZoom);
    const x = Number(nextPan?.x);
    const y = Number(nextPan?.y);
    if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      return;
    }
    stage.scale({ x: z, y: z });
    stage.position({ x, y });
    stage.batchDraw();
  }, []);

  const snap = useCallback(
    (value: number) => {
      const step = Math.max(1, Number(gridSize) || 1);
      return Math.round(value / step) * step;
    },
    [gridSize]
  );

  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const step = Math.max(5, Number(gridSize) || 20);
    const maxV = Math.floor(baseWidth / step);
    const maxH = Math.floor(baseHeight / step);
    if (maxV + maxH > 400) return null;
    const stroke = 'rgba(15,23,42,0.07)';
    const lines: any[] = [];
    for (let i = 0; i <= maxV; i++) {
      const x = i * step;
      lines.push(<Line key={`gv-${i}`} points={[x, 0, x, baseHeight]} stroke={stroke} strokeWidth={1} listening={false} />);
    }
    for (let j = 0; j <= maxH; j++) {
      const y = j * step;
      lines.push(<Line key={`gh-${j}`} points={[0, y, baseWidth, y]} stroke={stroke} strokeWidth={1} listening={false} />);
    }
    return lines;
  }, [baseHeight, baseWidth, gridSize, showGrid]);
  const corridorPattern = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 24, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, 24, 24);
    ctx.strokeStyle = 'rgba(71,85,105,0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 11, 11);
    ctx.strokeRect(12.5, 0.5, 11, 11);
    ctx.strokeRect(0.5, 12.5, 11, 11);
    ctx.strokeRect(12.5, 12.5, 11, 11);
    return canvas;
  }, []);

  const estimateTextWidth = useCallback((text: string, fontSize: number) => text.length * fontSize * 0.6, []);

  const pointInPolygon = (x: number, y: number, points: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  };

const polygonCentroid = (points: { x: number; y: number }[]) => {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    area += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  area *= 0.5;
  if (!Number.isFinite(area) || Math.abs(area) < 0.00001) {
    const avg = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const count = points.length || 1;
    return { x: avg.x / count, y: avg.y / count };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
};

const getRoomBounds = (room: any) => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as
    | 'rect'
    | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(room?.points) ? room.points : [];
    if (pts.length < 3) return null;
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
  }
  const rx = Number(room?.x || 0);
  const ry = Number(room?.y || 0);
  const rw = Number(room?.width || 0);
  const rh = Number(room?.height || 0);
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rw) || !Number.isFinite(rh)) return null;
  return { minX: rx, minY: ry, maxX: rx + rw, maxY: ry + rh };
};

const getRoomPolygonPoints = (room: any): { x: number; y: number }[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(room?.points) ? room.points : [];
    if (pts.length >= 3) return pts;
    const x = Number(room?.x || 0);
    const y = Number(room?.y || 0);
    const w = Number(room?.width || 0);
    const h = Number(room?.height || 0);
    if (w > 0 && h > 0) {
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
    }
    return [];
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const w = Number(room?.width || 0);
  const h = Number(room?.height || 0);
  if (!(w > 0 && h > 0)) return [];
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
};

const getCorridorPolygonPoints = (corridor: Corridor | any): { x: number; y: number }[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as
    | 'rect'
    | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(corridor?.points) ? corridor.points : [];
    if (pts.length >= 3) return pts;
    const x = Number(corridor?.x || 0);
    const y = Number(corridor?.y || 0);
    const w = Number(corridor?.width || 0);
    const h = Number(corridor?.height || 0);
    if (w > 0 && h > 0) {
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
    }
    return [];
  }
  const x = Number(corridor?.x || 0);
  const y = Number(corridor?.y || 0);
  const w = Number(corridor?.width || 0);
  const h = Number(corridor?.height || 0);
  if (!(w > 0 && h > 0)) return [];
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
};

const getCorridorEdgePoint = (points: { x: number; y: number }[], edgeIndex: number, t: number) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const idx = Number.isFinite(edgeIndex) ? Math.floor(edgeIndex) : 0;
  const a = points[((idx % points.length) + points.length) % points.length];
  const b = points[(idx + 1 + points.length) % points.length];
  if (!a || !b) return null;
  const ratio = Math.max(0, Math.min(1, Number(t) || 0));
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio
  };
};

const getClosestCorridorEdgePoint = (points: { x: number; y: number }[], point: { x: number; y: number }) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  let best: { edgeIndex: number; t: number; x: number; y: number; distSq: number } | null = null;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0.0000001 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq)) : 0;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const distSq = (point.x - x) * (point.x - x) + (point.y - y) * (point.y - y);
    if (!best || distSq < best.distSq) best = { edgeIndex: i, t, x, y, distSq };
  }
  return best;
};

const getRoomEdgePoint = (points: { x: number; y: number }[], edgeIndex: number, t: number) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const idx = Number.isFinite(edgeIndex) ? Math.floor(edgeIndex) : 0;
  const a = points[((idx % points.length) + points.length) % points.length];
  const b = points[(idx + 1 + points.length) % points.length];
  if (!a || !b) return null;
  const ratio = Math.max(0, Math.min(1, Number(t) || 0));
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio
  };
};

  const distancePointToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + clamped * dx, y: a.y + clamped * dy };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  };

  const nearestWallSegment = (points: { x: number; y: number }[], target: { x: number; y: number }) => {
    if (points.length < 2) return null;
    let best: { index: number; length: number; distance: number } | null = null;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const distance = distancePointToSegment(target, a, b);
      if (!best || distance < best.distance) {
        best = { index: i, length, distance };
      }
    }
    return best;
  };

  const findInteriorPointAtY = (y: number, points: { x: number; y: number }[]) => {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const y1 = p1.y;
      const y2 = p2.y;
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const x = p1.x + ((y - y1) * (p2.x - p1.x)) / (y2 - y1);
        xs.push(x);
      }
    }
    if (xs.length < 2) return null;
    xs.sort((a, b) => a - b);
    let best: { x: number; y: number } | null = null;
    let bestLen = -1;
    for (let i = 0; i < xs.length - 1; i += 2) {
      const x1 = xs[i];
      const x2 = xs[i + 1];
      if (x2 <= x1) continue;
      const len = x2 - x1;
      if (len > bestLen) {
        bestLen = len;
        best = { x: (x1 + x2) / 2, y };
      }
    }
    return best;
  };

  const getPolygonBounds = (points: { x: number; y: number }[]) => {
    if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  };

  const getPolygonLabelBounds = (points: { x: number; y: number }[]) => {
    const bounds = getPolygonBounds(points);
    if (!points.length || !bounds.width || !bounds.height) return bounds;
    const minDim = Math.min(bounds.width, bounds.height);
    const step = Math.max(4, minDim / 12);
    for (let shrink = 0; shrink <= minDim / 2; shrink += step) {
      const inner = {
        x: bounds.x + shrink,
        y: bounds.y + shrink,
        width: bounds.width - shrink * 2,
        height: bounds.height - shrink * 2
      };
      if (inner.width < 24 || inner.height < 18) break;
      const corners = [
        { x: inner.x, y: inner.y },
        { x: inner.x + inner.width, y: inner.y },
        { x: inner.x + inner.width, y: inner.y + inner.height },
        { x: inner.x, y: inner.y + inner.height }
      ];
      if (corners.every((p) => pointInPolygon(p.x, p.y, points))) return inner;
    }
    const centroid = polygonCentroid(points);
    const centerY = bounds.y + bounds.height / 2;
    const candidateYs = [
      centerY,
      centroid.y,
      bounds.y + bounds.height * 0.35,
      bounds.y + bounds.height * 0.65
    ].filter((y) => Number.isFinite(y));
    for (const y of candidateYs) {
      const p = findInteriorPointAtY(y, points);
      if (p) {
        const width = Math.min(bounds.width, 160);
        const height = Math.min(bounds.height, 48);
        return {
          x: clamp(p.x - width / 2, bounds.x, bounds.x + bounds.width - width),
          y: clamp(p.y - height / 2, bounds.y, bounds.y + bounds.height - height),
          width,
          height
        };
      }
    }
    return bounds;
  };

  const renderRoomLabels = (options: {
    bounds: { x: number; y: number; width: number; height: number };
    name: string;
    showName: boolean;
    capacityText?: string | null;
    overCapacity?: boolean;
    labelScale?: number;
    labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  }) => {
    const { bounds, name, showName, capacityText, overCapacity, labelScale, labelPosition } = options;
    if (!bounds.width || !bounds.height) return null;
    const minDim = Math.max(8, Math.min(bounds.width, bounds.height));
    const padding = Math.max(2, Math.min(4, Math.round(minDim / 12)));
    const baseNameSize = Math.max(7, Math.min(12, Math.round(minDim / 7)));
    const baseCapacitySize = Math.max(6, Math.min(10, Math.round(minDim / 9)));
    const scale = Number(labelScale) > 0 ? Number(labelScale) : 1;
    const nameFontSize = Math.max(4, Math.round(baseNameSize * scale));
    const capacityFontSize = Math.max(4, Math.round(baseCapacitySize * scale));
    const nameVisible = showName && !!name;
    const capacityVisible = !!capacityText;
    if (!nameVisible && !capacityVisible) return null;
    const isVertical = labelPosition === 'left' || labelPosition === 'right';
    if (isVertical) {
      const verticalParts: string[] = [];
      if (nameVisible) verticalParts.push(String(name || '').trim());
      if (capacityVisible) verticalParts.push(String(capacityText || '').trim());
      const verticalText = verticalParts.filter(Boolean).join(' · ');
      if (!verticalText) return null;
      const fontSize = Math.max(nameFontSize, capacityFontSize);
      const labelPad = Math.max(1, Math.min(8, Math.round(fontSize * 0.16)));
      const boxWidth = Math.max(12, Math.round(fontSize + labelPad * 2 + 1));
      const maxLabelHeight = Math.max(24, bounds.height - padding * 2);
      const preferredHeight = Math.round(estimateTextWidth(verticalText, fontSize) + labelPad * 2 + 1);
      const boxHeight = Math.max(24, Math.min(maxLabelHeight, preferredHeight));
      const labelX =
        labelPosition === 'left'
          ? bounds.x + padding
          : bounds.x + Math.max(padding, bounds.width - boxWidth - padding);
      const labelY = clamp(
        bounds.y + (bounds.height - boxHeight) / 2,
        bounds.y + padding,
        bounds.y + Math.max(padding, bounds.height - boxHeight - padding)
      );
      const textWidth = Math.max(10, boxHeight - labelPad * 2);
      return (
        <>
          <Rect
            x={labelX}
            y={labelY}
            width={boxWidth}
            height={boxHeight}
            fill="rgba(255,255,255,0.85)"
            stroke="rgba(148,163,184,0.6)"
            strokeWidth={0.9}
            cornerRadius={3}
            listening={false}
          />
          <Text
            x={labelX + boxWidth / 2}
            y={labelY + boxHeight / 2}
            width={textWidth}
            offsetX={textWidth / 2}
            offsetY={fontSize / 2}
            rotation={labelPosition === 'left' ? -90 : 90}
            text={verticalText}
            align="center"
            fontSize={fontSize}
            fontStyle="bold"
            fill={overCapacity ? '#dc2626' : '#0f172a'}
            wrap="none"
            ellipsis
            lineHeight={1.05}
            listening={false}
          />
        </>
      );
    }
    const maxWidth = Math.max(0, bounds.width - padding * 2);
    const maxHeight = Math.max(0, bounds.height - padding * 2);
    if (!maxWidth || maxWidth <= 0 || !maxHeight || maxHeight <= 0) return null;
    const maxLabelFont = Math.max(nameFontSize, capacityFontSize);
    const innerPadX = Math.max(1, Math.min(10, Math.round(maxLabelFont * 0.18)));
    const innerPadY = Math.max(1, Math.min(8, Math.round(maxLabelFont * 0.14)));
    const capacityWidth = capacityVisible ? estimateTextWidth(capacityText || '', capacityFontSize) + innerPadX * 2 : 0;
    const wrapNameLines = (raw: string, maxLineWidth: number, fontSize: number) => {
      const text = String(raw || '').trim();
      if (!text) return { text: '', lineCount: 0 };
      const avgChar = Math.max(1, fontSize * 0.58);
      const maxChars = Math.max(4, Math.floor(maxLineWidth / avgChar));
      if (text.length <= maxChars) return { text, lineCount: 1 };
      const splitIdx = text.lastIndexOf(' ', maxChars);
      const firstBreak = splitIdx >= Math.floor(maxChars * 0.55) ? splitIdx : maxChars;
      const line1 = text.slice(0, firstBreak).trim() || text.slice(0, maxChars).trim();
      let line2 = text.slice(firstBreak).trim();
      if (line2.length > maxChars) {
        const secondSplit = line2.lastIndexOf(' ', maxChars - 1);
        const cutAt = secondSplit >= Math.floor(maxChars * 0.55) ? secondSplit : maxChars - 1;
        line2 = `${line2.slice(0, cutAt).trim()}...`;
      }
      if (!line2) return { text: line1, lineCount: 1 };
      return { text: `${line1}\n${line2}`, lineCount: 2 };
    };
    const labelWidth = maxWidth;
    const inlineNameWidth = Math.max(24, labelWidth - (capacityVisible ? capacityWidth : 0) - innerPadX * 2);
    const wrappedName = nameVisible ? wrapNameLines(name, inlineNameWidth, nameFontSize) : { text: '', lineCount: 0 };
    let useStacked = false;
    if (nameVisible && capacityVisible) {
      const inlineNameNaturalWidth = estimateTextWidth(name, nameFontSize) + innerPadX * 2;
      useStacked = wrappedName.lineCount > 1 || inlineNameNaturalWidth + capacityWidth > labelWidth;
    }
    if (wrappedName.lineCount > 1) useStacked = true;
    const wrappedNameForStacked =
      nameVisible && useStacked ? wrapNameLines(name, Math.max(24, labelWidth - innerPadX * 2), nameFontSize) : wrappedName;
    const finalNameText = useStacked ? wrappedNameForStacked.text : wrappedName.text;
    const finalNameLineCount = useStacked ? wrappedNameForStacked.lineCount : wrappedName.lineCount;
    const lineGap = Math.max(1, Math.round(maxLabelFont * 0.08));
    const nameBlockHeight = nameVisible ? Math.max(nameFontSize, Math.round(nameFontSize * 1.05 * Math.max(1, finalNameLineCount))) : 0;
    const naturalHeight = useStacked
      ? nameBlockHeight + (capacityVisible ? capacityFontSize + lineGap : 0) + innerPadY * 2
      : Math.max(nameBlockHeight || nameFontSize, capacityFontSize) + innerPadY * 2;
    const labelHeight = Math.max(12, Math.min(maxHeight, naturalHeight));
    if (!labelWidth || labelWidth <= 0) return null;
    const verticalMin = bounds.y + padding;
    const verticalMax = bounds.y + Math.max(padding, bounds.height - labelHeight - padding);
    const centeredY = clamp(bounds.y + (bounds.height - labelHeight) / 2, verticalMin, verticalMax);
    const labelX = bounds.x + (bounds.width - labelWidth) / 2;
    const labelY =
      labelPosition === 'bottom'
        ? bounds.y + Math.max(padding, bounds.height - labelHeight - padding)
        : labelPosition === 'top'
          ? bounds.y + padding
          : centeredY;
    const capacityAlign = nameVisible ? 'right' : 'center';
    const textInnerWidth = Math.max(10, labelWidth - innerPadX * 2);
    return (
      <>
        <Rect
          x={labelX}
          y={labelY}
          width={labelWidth}
          height={labelHeight}
          fill="rgba(255,255,255,0.85)"
          stroke="rgba(148,163,184,0.6)"
          strokeWidth={0.9}
          cornerRadius={3}
          listening={false}
        />
        {useStacked ? (
          <>
            {nameVisible ? (
              <Text
                x={labelX + innerPadX}
                y={labelY + innerPadY}
                width={textInnerWidth}
                text={finalNameText}
                fontSize={nameFontSize}
                fontStyle="bold"
                fill="#0f172a"
                listening={false}
                lineHeight={1.05}
                align="center"
              />
            ) : null}
            {capacityVisible ? (
              <Text
                x={labelX + innerPadX}
                y={labelY + innerPadY + nameBlockHeight + lineGap}
                width={textInnerWidth}
                align="right"
                text={capacityText || ''}
                fontSize={capacityFontSize}
                fontStyle="bold"
                fill={overCapacity ? '#dc2626' : '#334155'}
                listening={false}
              />
            ) : null}
          </>
        ) : (
          <>
            {nameVisible ? (
              <Text
                x={labelX + innerPadX}
                y={labelY + innerPadY}
                width={Math.max(0, labelWidth - innerPadX * 2 - (capacityVisible ? capacityWidth : 0))}
                text={finalNameText}
                fontSize={nameFontSize}
                fontStyle="bold"
                fill="#0f172a"
                listening={false}
                lineHeight={1.05}
              />
            ) : null}
            {capacityVisible ? (
              <Text
                x={labelX + innerPadX}
                y={labelY + innerPadY}
                width={textInnerWidth}
                align={capacityAlign}
                text={capacityText || ''}
                fontSize={capacityFontSize}
                fontStyle="bold"
                fill={overCapacity ? '#dc2626' : '#334155'}
                listening={false}
              />
            ) : null}
          </>
        )}
      </>
    );
  };

  const refreshStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.getLayers()?.forEach((layer: { batchDraw: () => void }) => layer.batchDraw());
  }, []);

  useEffect(() => {
    const last = { width: -1, height: -1 };
    let raf = 0;
    const lastCommitAt = { value: 0 };
    const commit = (width: number, height: number) => {
      setDimensions((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    const applySize = (width: number, height: number) => {
      const roundedWidth = Math.round(width);
      const roundedHeight = Math.round(height);
      // Avoid committing zero sizes during transient layout states (e.g. modal/panel animations),
      // which can cause the Stage to "disappear" and become unresponsive until the next resize.
      if (roundedWidth <= 0 || roundedHeight <= 0) return;
      if (roundedWidth === last.width && roundedHeight === last.height) return;
      const dw = Math.abs(roundedWidth - last.width);
      const dh = Math.abs(roundedHeight - last.height);
      perfMetrics.resizeLastWidth = roundedWidth;
      perfMetrics.resizeLastHeight = roundedHeight;
      if (!perfMetrics.resizeMinWidth || roundedWidth < perfMetrics.resizeMinWidth) perfMetrics.resizeMinWidth = roundedWidth;
      if (!perfMetrics.resizeMaxWidth || roundedWidth > perfMetrics.resizeMaxWidth) perfMetrics.resizeMaxWidth = roundedWidth;
      if (!perfMetrics.resizeMinHeight || roundedHeight < perfMetrics.resizeMinHeight) perfMetrics.resizeMinHeight = roundedHeight;
      if (!perfMetrics.resizeMaxHeight || roundedHeight > perfMetrics.resizeMaxHeight) perfMetrics.resizeMaxHeight = roundedHeight;
      perfMetrics.resizeDeltaMax = Math.max(perfMetrics.resizeDeltaMax, dw, dh);
      if (dw <= 1 && dh <= 1) perfMetrics.resizeSmallJitter += 1;
      if (dw >= 4 || dh >= 4) perfMetrics.resizeLargeJitter += 1;
      const now = performance.now();
      if (now - lastCommitAt.value < 250 && dw < 3 && dh < 3) return;
      lastCommitAt.value = now;
      last.width = roundedWidth;
      last.height = roundedHeight;
      if (perfEnabled) perfMetrics.resizeObserverCommits += 1;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => commit(roundedWidth, roundedHeight));
    };
    const handleResize = () => {
      if (perfEnabled) perfMetrics.resizeObserverTicks += 1;
      const el = containerRef.current;
      if (!el) return;
      applySize(el.clientWidth, el.clientHeight);
    };
    handleResize();
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== containerRef.current) continue;
        if (perfEnabled) perfMetrics.resizeObserverTicks += 1;
        const rect = entry.contentRect;
        applySize(rect.width, rect.height);
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        handleResize();
        refreshStage();
      }
    };
    const onFocus = () => {
      handleResize();
      refreshStage();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [containerRef, perfEnabled, refreshStage]);

  useEffect(() => {
    fitApplied.current = null;
  }, [plan.id, plan.imageUrl]);

  useEffect(() => {
    viewportRef.current = { zoom, pan };
    applyStageTransform(zoom, pan);
    if (wheelCommitTimer.current) {
      window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = null;
    }
  }, [applyStageTransform, zoom, pan]);

  const applyFocus = (target: { x: number; y: number; zoom?: number; nonce: number }) => {
    if (dimensions.width <= 0 || dimensions.height <= 0) return false;
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
    if (wheelCommitTimer.current) {
      window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = null;
    }
    const baseZoom = target.zoom ?? viewportRef.current.zoom;
    const nextZoom = clamp(Math.max(baseZoom, 1.0), 0.2, 3);
    const unclampedPan = {
      x: dimensions.width / 2 - target.x * nextZoom,
      y: dimensions.height / 2 - target.y * nextZoom
    };
    const nextPan = clampPan(nextZoom, unclampedPan);
    setIsPanning(false);
    panOrigin.current = null;
    viewportRef.current = { zoom: nextZoom, pan: nextPan };
    applyStageTransform(nextZoom, nextPan);
    commitViewport(nextZoom, nextPan);
    appliedFocusNonceRef.current = target.nonce;
    pendingFocusRef.current = null;
    return true;
  };

  useEffect(() => {
    if (!focusTarget) return;
    if (appliedFocusNonceRef.current === focusTarget.nonce) return;
    pendingFocusRef.current = focusTarget;
    applyFocus(focusTarget);
  }, [focusTarget?.nonce]);

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    applyFocus(pendingFocusRef.current);
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!highlightId || !highlightUntil) return;
    if (highlightUntil <= Date.now()) return;
    const interval = window.setInterval(() => {
      if (perfEnabled) perfMetrics.highlightTicks += 1;
      setHighlightNow(Date.now());
    }, 120);
    const timeout = window.setTimeout(() => window.clearInterval(interval), highlightUntil - Date.now() + 80);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [highlightId, highlightUntil, perfEnabled]);

  useEffect(() => {
    if (!highlightRoomId || !highlightRoomUntil) return;
    if (highlightRoomUntil <= Date.now()) return;
    const interval = window.setInterval(() => {
      if (perfEnabled) perfMetrics.roomHighlightTicks += 1;
      setRoomHighlightNow(Date.now());
    }, 120);
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      highlightRoomUntil - Date.now() + 80
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [highlightRoomId, highlightRoomUntil, perfEnabled]);

  useEffect(() => {
    if (roomDrawMode) return;
    draftOrigin.current = null;
    if (perfEnabled) perfMetrics.draftRectUpdates += 1;
    setDraftRect(null);
    if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
    draftRectRaf.current = null;
    pendingDraftRectRef.current = null;
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPoints([]);
    draftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPointer(null);
    if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
    draftPolyRaf.current = null;
  }, [perfEnabled, roomDrawMode]);
  useEffect(() => {
    draftPolyPointsRef.current = draftPolyPoints;
  }, [draftPolyPoints]);
  useEffect(() => {
    if (corridorDrawMode) return;
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPoints([]);
    corridorDraftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPointer(null);
    if (corridorDraftPolyRaf.current) cancelAnimationFrame(corridorDraftPolyRaf.current);
    corridorDraftPolyRaf.current = null;
  }, [corridorDrawMode, perfEnabled]);
  useEffect(() => {
    corridorDraftPolyPointsRef.current = corridorDraftPolyPoints;
  }, [corridorDraftPolyPoints]);

  useEffect(() => {
    if (!transformerRef.current) return;
    const selectedRoom = (plan.rooms || []).find((r) => r.id === selectedRoomId);
    const selectedKind = (selectedRoom?.kind || (selectedRoom?.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
    if (!selectedRoomId || !selectedRoomNodeRef.current || selectedKind !== 'rect') {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    transformerRef.current.nodes([selectedRoomNodeRef.current]);
    transformerRef.current.getLayer()?.batchDraw?.();
  }, [selectedRoomId, plan.rooms]);
  useEffect(() => {
    const transformer = safetyCardTransformerRef.current;
    if (!transformer) return;
    if (!safetyCard?.visible || !safetyCardSelected || readOnly || !safetyCardRectRef.current) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw?.();
      return;
    }
    transformer.nodes([safetyCardRectRef.current]);
    transformer.getLayer()?.batchDraw?.();
  }, [readOnly, safetyCard?.visible, safetyCardSelected, safetyCardDraft?.w, safetyCardDraft?.h]);

  useEffect(() => {
    if (!deskTransformerRef.current) return;
    if (readOnly) {
      deskTransformerRef.current.nodes([]);
      deskTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    const ids = selectedIds?.length ? selectedIds : selectedId ? [selectedId] : [];
    if (ids.length !== 1) {
      deskTransformerRef.current.nodes([]);
      deskTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    const obj = objectById.get(ids[0]);
    if (!obj || !isDeskType(obj.type)) {
      deskTransformerRef.current.nodes([]);
      deskTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    const node = objectNodeRefs.current[obj.id];
    if (!node) {
      deskTransformerRef.current.nodes([]);
      deskTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    deskTransformerRef.current.nodes([node]);
    deskTransformerRef.current.getLayer()?.batchDraw?.();
  }, [objectById, readOnly, selectedId, selectedIds]);

  useEffect(() => {
    if (!freeTransformerRef.current) return;
    if (readOnly) {
      freeTransformerRef.current.nodes([]);
      freeTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    const ids = selectedIds?.length ? selectedIds : selectedId ? [selectedId] : [];
    if (ids.length !== 1) {
      freeTransformerRef.current.nodes([]);
      freeTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    const obj = objectById.get(ids[0]);
    if (!obj || (obj.type !== 'text' && obj.type !== 'image')) {
      freeTransformerRef.current.nodes([]);
      freeTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    const node = objectNodeRefs.current[obj.id];
    if (!node) {
      freeTransformerRef.current.nodes([]);
      freeTransformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    freeTransformerRef.current.nodes([node]);
    freeTransformerRef.current.getLayer()?.batchDraw?.();
  }, [objectById, readOnly, selectedId, selectedIds]);

  useEffect(() => {
    return () => {
      if (wheelCommitTimer.current) window.clearTimeout(wheelCommitTimer.current);
      if (panRaf.current) cancelAnimationFrame(panRaf.current);
      if (selectionBoxRaf.current) cancelAnimationFrame(selectionBoxRaf.current);
      if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
      if (textDraftRaf.current) cancelAnimationFrame(textDraftRaf.current);
      if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
      if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
      if (corridorDraftPolyRaf.current) cancelAnimationFrame(corridorDraftPolyRaf.current);
      if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
      if (textTransformRaf.current) cancelAnimationFrame(textTransformRaf.current);
      textTransformRaf.current = null;
      pendingTextTransformRef.current = null;
    };
  }, []);

  useEffect(() => {
    // build icon images from SVGs so markers match palette (and update if icon mapping changes)
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    setIconImages({});

    Object.entries(objectTypeIcons || {}).forEach(([typeId, iconName]) => {
      if (!iconName) return;
      const svg = renderToStaticMarkup(
        <Icon name={iconName} size={18} color={isSecurityTypeId(typeId) ? '#dc2626' : '#2563eb'} strokeWidth={1.8} />
      );
      const img = new window.Image();
      imgs.push(img);
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      img.onload = () => {
        if (cancelled) return;
        setIconImages((prev) => ({
          ...prev,
          [typeId]: img
        }));
      };
    });

    return () => {
      cancelled = true;
      for (const img of imgs) img.onload = null;
    };
  }, [objectTypeIcons]);

  useEffect(() => {
    let cancelled = false;
    const pending: HTMLImageElement[] = [];
    const entries = objects
      .filter((o) => o.type === 'image' && (o as any).imageUrl)
      .map((o) => ({ id: o.id, src: String((o as any).imageUrl || '') }));
    setImageObjects((prev) => {
      const next: Record<string, HTMLImageElement | null> = {};
      for (const entry of entries) {
        const cached = prev[entry.id];
        if (cached && cached.src === entry.src) {
          next[entry.id] = cached;
          continue;
        }
        if (!entry.src) continue;
        const img = new window.Image();
        pending.push(img);
        img.onload = () => {
          if (cancelled) return;
          setImageObjects((current) => ({ ...current, [entry.id]: img }));
        };
        img.onerror = () => {
          if (cancelled) return;
          setImageObjects((current) => ({ ...current, [entry.id]: null }));
        };
        img.src = entry.src;
        next[entry.id] = null;
      }
      return next;
    });
    return () => {
      cancelled = true;
      for (const img of pending) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [objects]);

  const commitViewport = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      if (perfEnabled) perfMetrics.viewportCommits += 1;
      onZoomChange(nextZoom);
      onPanChange(nextPan);
    },
    [onPanChange, onZoomChange, perfEnabled]
  );

  const scheduleWheelCommit = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      if (wheelCommitTimer.current) window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = window.setTimeout(() => commitViewport(nextZoom, nextPan), 140);
    },
    [commitViewport]
  );

  const clampPan = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      const margin = 220;
      if (!Number.isFinite(nextZoom) || !Number.isFinite(nextPan.x) || !Number.isFinite(nextPan.y)) return { x: 0, y: 0 };
      if (!Number.isFinite(baseWidth) || !Number.isFinite(baseHeight) || baseWidth <= 0 || baseHeight <= 0) return nextPan;
      const contentW = baseWidth * nextZoom;
      const contentH = baseHeight * nextZoom;

      // If content is smaller than viewport, allow free movement inside viewport (+ margin),
      // otherwise clamp so it can't drift into infinity (still elastic with margin).
      const minX = contentW < dimensions.width ? -margin : dimensions.width - contentW - margin;
      const maxX = contentW < dimensions.width ? dimensions.width - contentW + margin : margin;
      const minY = contentH < dimensions.height ? -margin : dimensions.height - contentH - margin;
      const maxY = contentH < dimensions.height ? dimensions.height - contentH + margin : margin;

      return {
        x: clamp(nextPan.x, Math.min(minX, maxX), Math.max(minX, maxX)),
        y: clamp(nextPan.y, Math.min(minY, maxY), Math.max(minY, maxY))
      };
    },
    [baseHeight, baseWidth, dimensions.height, dimensions.width]
  );

  const fitView = useCallback(() => {
    if (!containerRef.current || !baseWidth || !baseHeight) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = baseWidth;
    const ih = baseHeight;
    // Default: do not upscale small images (keeps markers proportional and avoids giant UI).
    // Presentation mode: allow upscaling to make the map fill the screen.
    const fitScale = presentationMode ? Math.min(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih, 1);
    const scale = clamp(fitScale, 0.2, 3);
    const panX = (cw - iw * scale) / 2;
    const panY = (ch - ih * scale) / 2;
    const clampedPan = clampPan(scale, { x: panX, y: panY });
    viewportRef.current = { zoom: scale, pan: clampedPan };
    applyStageTransform(scale, clampedPan);
    commitViewport(scale, clampedPan);
    fitApplied.current = plan.id;
  }, [applyStageTransform, baseHeight, baseWidth, clampPan, commitViewport, containerRef, plan.id, presentationMode]);

  useEffect(() => {
    fitViewRef.current = fitView;
  }, [fitView]);

  useEffect(() => {
    if (!autoFit) return;
    if (fitApplied.current === plan.id) return;
    fitView();
  }, [autoFit, bgImage, fitView, plan.id]);

  // Canvas watchdog: fixes rare cases where the Stage becomes 0-sized or the transform becomes invalid,
  // which can make the map "disappear" until a manual refresh.
  useEffect(() => {
    const tick = () => {
      if (perfEnabled) perfMetrics.watchdogTicks += 1;
      const el = containerRef.current;
      const stage = stageRef.current;
      if (!el || !stage) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;

      // Recover from transient 0-sized stage.
      const sw = Number(stage.width?.() ?? 0);
      const sh = Number(stage.height?.() ?? 0);
      if (sw <= 0 || sh <= 0) {
        setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }

      // Recover from invalid transforms.
      const z = Number(viewportRef.current.zoom);
      const p = viewportRef.current.pan;
      const px = Number(p?.x);
      const py = Number(p?.y);
      if (!Number.isFinite(z) || !Number.isFinite(px) || !Number.isFinite(py) || z <= 0) {
        const nextZoom = clamp(1, 0.2, 3);
        const nextPan = clampPan(nextZoom, { x: 0, y: 0 });
        viewportRef.current = { zoom: nextZoom, pan: nextPan };
        applyStageTransform(nextZoom, nextPan);
        commitViewport(nextZoom, nextPan);
      }
    };
    const id = window.setInterval(tick, 1500);
    return () => window.clearInterval(id);
  }, [applyStageTransform, clampPan, commitViewport, perfEnabled]);

  const toStageCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const x = (localX - viewportRef.current.pan.x) / viewportRef.current.zoom;
    const y = (localY - viewportRef.current.pan.y) / viewportRef.current.zoom;
    return { x, y };
  };

  const pointerToWorld = (localX: number, localY: number) => ({
    x: (localX - viewportRef.current.pan.x) / viewportRef.current.zoom,
    y: (localY - viewportRef.current.pan.y) / viewportRef.current.zoom
  });

  const updateQuoteResizePreview = useCallback((shiftKey?: boolean) => {
    if (!quoteResizeRef.current) return;
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition?.();
    if (!pos) return;
    const world = pointerToWorld(pos.x, pos.y);
    const { id, index, points } = quoteResizeRef.current;
    let nextX = world.x;
    let nextY = world.y;
    if (shiftKey) {
      const fixed = points[index === 0 ? points.length - 1 : 0];
      const dx = nextX - fixed.x;
      const dy = nextY - fixed.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        nextY = fixed.y;
      } else {
        nextX = fixed.x;
      }
    }
    const next = points.map((p, i) => (i === index ? { x: nextX, y: nextY } : p));
    setQuoteResizePreview({ id, points: next });
  }, []);

  const commitQuoteResize = useCallback(() => {
    const ref = quoteResizeRef.current;
    if (!ref || !onUpdateQuotePoints) return;
    const preview = quoteResizePreview && quoteResizePreview.id === ref.id ? quoteResizePreview.points : ref.points;
    onUpdateQuotePoints(ref.id, preview);
    ref.node?.draggable?.(true);
    quoteResizeRef.current = null;
    setQuoteResizePreview(null);
  }, [onUpdateQuotePoints, quoteResizePreview]);

  const commitCameraRotation = useCallback(() => {
    const active = cameraRotateRef.current;
    const pending = cameraRotatePendingRef.current;
    if (!active || !pending || !onUpdateObject || readOnly) return;
    const dx = pending.x - active.origin.x;
    const dy = pending.y - active.origin.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (!Number.isFinite(angle)) return;
    let normalized = angle < 0 ? angle + 360 : angle;
    if (cameraRotateSnapRef.current) {
      normalized = Math.round(normalized / 90) * 90;
    }
    onUpdateObject(active.id, { rotation: normalized });
  }, [onUpdateObject, readOnly]);

  const scheduleCameraRotation = useCallback(
    (world: { x: number; y: number }, shiftKey?: boolean) => {
      cameraRotateSnapRef.current = !!shiftKey;
      cameraRotatePendingRef.current = world;
      if (cameraRotateRaf.current) return;
      cameraRotateRaf.current = requestAnimationFrame(() => {
        cameraRotateRaf.current = null;
        commitCameraRotation();
      });
    },
    [commitCameraRotation]
  );

  const stopCameraRotation = useCallback(() => {
    if (!cameraRotateRef.current) return false;
    cameraRotateRef.current = null;
    cameraRotatePendingRef.current = null;
    if (cameraRotateRaf.current) {
      cancelAnimationFrame(cameraRotateRaf.current);
      cameraRotateRaf.current = null;
    }
    cameraRotateSnapRef.current = false;
    setCameraRotateId(null);
    return true;
  }, []);

  const scheduleTextTransform = useCallback(
    (payload: { id: string; width: number; height: number }) => {
      if (!onUpdateObject) return;
      pendingTextTransformRef.current = payload;
      if (textTransformRaf.current) return;
      textTransformRaf.current = requestAnimationFrame(() => {
        textTransformRaf.current = null;
        const next = pendingTextTransformRef.current;
        pendingTextTransformRef.current = null;
        if (!next) return;
        onUpdateObject(next.id, {
          textBoxWidth: next.width,
          textBoxHeight: next.height,
          scaleX: 1,
          scaleY: 1
        });
      });
    },
    [onUpdateObject]
  );

  const isBoxSelecting = () => !!selectionOrigin.current;

  useEffect(() => {
    if (!pendingType) {
      if (pendingPreviewRaf.current) cancelAnimationFrame(pendingPreviewRaf.current);
      pendingPreviewRaf.current = null;
      pendingPreviewRef.current = null;
      setPendingPreview(null);
      return;
    }
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const world = pointerToWorld(pos.x, pos.y);
    setPendingPreview(world);
  }, [pendingType]);

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    const evt = event.evt as WheelEvent;
    const wantsZoom = !!evt.ctrlKey || !!evt.metaKey || evt.deltaMode !== 0;
    if (!wantsZoom) {
      const nextPan = clampPan(viewportRef.current.zoom, {
        x: viewportRef.current.pan.x - evt.deltaX,
        y: viewportRef.current.pan.y - evt.deltaY
      });
      viewportRef.current = { zoom: viewportRef.current.zoom, pan: nextPan };
      applyStageTransform(viewportRef.current.zoom, nextPan);
      scheduleWheelCommit(viewportRef.current.zoom, nextPan);
      return;
    }
    // Smooth, multiplicative zoom (pinch/ctrl+wheel)
    const scaleBy = Math.exp(-evt.deltaY * 0.001);
    const newZoom = clamp(viewportRef.current.zoom * scaleBy, 0.2, 3);
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer || !containerRef.current) {
      viewportRef.current = { zoom: newZoom, pan: viewportRef.current.pan };
      applyStageTransform(newZoom, viewportRef.current.pan);
      scheduleWheelCommit(newZoom, viewportRef.current.pan);
      return;
    }
    const mousePointTo = {
      x: (pointer.x - viewportRef.current.pan.x) / viewportRef.current.zoom,
      y: (pointer.y - viewportRef.current.pan.y) / viewportRef.current.zoom
    };
    const newPos = {
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom
    };
    const clampedPan = clampPan(newZoom, newPos);
    viewportRef.current = { zoom: newZoom, pan: clampedPan };
    applyStageTransform(newZoom, clampedPan);
    scheduleWheelCommit(newZoom, clampedPan);
  };

  const startPan = (event: any) => {
    if (pendingType) return;
    const stage = event.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    setIsPanning(true);
    panOrigin.current = { x: pos.x - viewportRef.current.pan.x, y: pos.y - viewportRef.current.pan.y };
  };

  const movePan = (event: any) => {
    if (!isPanning) return;
    const stage = event.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos || !panOrigin.current) return;
    const rawPan = { x: pos.x - panOrigin.current.x, y: pos.y - panOrigin.current.y };
    const nextPan = clampPan(viewportRef.current.zoom, rawPan);
    pendingPanRef.current = nextPan;
    if (panRaf.current) return;
    panRaf.current = requestAnimationFrame(() => {
      panRaf.current = null;
      const p = pendingPanRef.current;
      pendingPanRef.current = null;
      if (!p) return;
      viewportRef.current = { zoom: viewportRef.current.zoom, pan: p };
      applyStageTransform(viewportRef.current.zoom, p);
    });
  };

  const endPan = () => {
    setIsPanning(false);
    panOrigin.current = null;
    if (panRaf.current) cancelAnimationFrame(panRaf.current);
    panRaf.current = null;
    if (pendingPanRef.current) {
      const p = pendingPanRef.current;
      pendingPanRef.current = null;
      viewportRef.current = { zoom: viewportRef.current.zoom, pan: p };
      applyStageTransform(viewportRef.current.zoom, p);
    }
    commitViewport(viewportRef.current.zoom, viewportRef.current.pan);
  };

  const isContextClick = (evt: any) => evt?.button === 2 || (evt?.button === 0 && !!evt?.ctrlKey);
  // Pan: middle mouse OR Cmd+right (macOS) / Alt+right (Windows/Linux).
  const isPanGesture = (evt: any) =>
    evt?.button === 1 ||
    (evt?.button === 2 && (!!evt?.metaKey || !!evt?.altKey)) ||
    (panToolActive &&
      evt?.button === 0 &&
      !pendingType &&
      (!roomDrawMode || readOnly) &&
      (!corridorDrawMode || readOnly) &&
      (!printAreaMode || readOnly) &&
      !toolMode);
  // Box select: left-drag on empty area (desktop-like).
  const isBoxSelectGesture = (evt: any) => evt?.button === 0;

  const getNodeBounds = useCallback((obj: MapObject) => {
    const node = objectNodeRefs.current[obj.id];
    const stage = stageRef.current;
    if (!node || !stage) return null;
    try {
      const rect = node.getClientRect({ skipTransform: false, skipStroke: true, skipShadow: true });
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      const p1 = transform.point({ x: rect.x, y: rect.y });
      const p2 = transform.point({ x: rect.x + rect.width, y: rect.y + rect.height });
      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxX = Math.max(p1.x, p2.x);
      const maxY = Math.max(p1.y, p2.y);
      if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
      return { minX, minY, maxX, maxY };
    } catch {
      return null;
    }
  }, []);

  const computeObjectBounds = useCallback(
    (obj: MapObject) => {
    const type = obj.type;
    if (wallTypeIdSet.has(type) || type === 'quote') {
      const pts = obj.points || [];
      if (pts.length < 2) return null;
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
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
      return { minX, minY, maxX, maxY };
    }
    const x = Number(obj.x);
    const y = Number(obj.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    if (type === 'text') {
      const nodeBounds = getNodeBounds(obj);
      if (nodeBounds) return nodeBounds;
      const textSize = clamp(Number((obj as any).textSize ?? 18) || 18, 6, 160);
      const textValue = String(obj.name || '');
      const textLines = textValue ? textValue.split('\n') : [''];
      const textLineHeight = 1.2;
      const textNaturalWidth = Math.max(40, ...textLines.map((line) => estimateTextWidth(line || ' ', textSize)));
      const textNaturalHeight = Math.max(textSize, textLines.length * textSize * textLineHeight);
      const textPadding = Math.max(4, Math.round(textSize * 0.35));
      const baseTextBoxWidth = Number((obj as any).textBoxWidth || 0);
      const baseTextBoxHeight = Number((obj as any).textBoxHeight || 0);
      const fallbackTextBoxWidth = Math.max(TEXT_BOX_DEFAULT_WIDTH, textNaturalWidth + textPadding * 2);
      const fallbackTextBoxHeight = Math.max(TEXT_BOX_DEFAULT_HEIGHT, textNaturalHeight + textPadding * 2);
      const rawTextBoxWidth =
        Number.isFinite(baseTextBoxWidth) && baseTextBoxWidth > 0 ? baseTextBoxWidth : fallbackTextBoxWidth;
      const rawTextBoxHeight =
        Number.isFinite(baseTextBoxHeight) && baseTextBoxHeight > 0 ? baseTextBoxHeight : fallbackTextBoxHeight;
      const freeScaleX = clamp(Number((obj as any).scaleX ?? 1) || 1, 0.2, 6);
      const freeScaleY = clamp(Number((obj as any).scaleY ?? 1) || 1, 0.2, 6);
      const width = Math.max(TEXT_BOX_MIN_WIDTH, rawTextBoxWidth * freeScaleX);
      const height = Math.max(TEXT_BOX_MIN_HEIGHT, rawTextBoxHeight * freeScaleY);
      const rotation = Number((obj as any).rotation || 0);
      return getRotatedRectBounds(x, y, width, height, rotation);
    }

    if (type === 'image') {
      const baseW = Math.max(40, Number((obj as any).imageWidth ?? 160) || 160);
      const baseH = Math.max(30, Number((obj as any).imageHeight ?? 120) || 120);
      const scaleX = clamp(Number((obj as any).scaleX ?? 1) || 1, 0.2, 6);
      const scaleY = clamp(Number((obj as any).scaleY ?? 1) || 1, 0.2, 6);
      const rotation = Number((obj as any).rotation || 0);
      return getRotatedRectBounds(x, y, baseW * scaleX, baseH * scaleY, rotation);
    }

    const baseScale = clamp(Number(obj.scale ?? 1) || 1, 0.2, 6);

    if (type === 'postit') {
      const postItCompact = !!(obj as any).postitCompact;
      const size = (postItCompact ? 26 : 36) * baseScale;
      return getRotatedRectBounds(x, y, size, size, 0);
    }

    if (isDeskType(type)) {
      const deskScaleX = clamp(Number(obj.scaleX ?? 1) || 1, 0.4, 4);
      const deskScaleY = clamp(Number(obj.scaleY ?? 1) || 1, 0.4, 4);
      const deskSize = 38 * baseScale;
      const deskRectW = deskSize * 1.45;
      const deskRectH = deskSize * 0.75;
      const deskLongW = deskSize * 1.85;
      const deskLongH = deskSize * 0.6;
      const deskDoubleW = deskSize * 0.7;
      const deskDoubleH = deskSize * 0.95;
      const deskDoubleGap = 4 * baseScale;
      const deskTrapBottom = deskSize * 1.15;
      const deskTrapHeight = deskSize * 0.75;
      const bounds = getDeskBounds(type, {
        deskSize,
        deskRectW,
        deskRectH,
        deskLongW,
        deskLongH,
        deskDoubleW,
        deskDoubleH,
        deskDoubleGap,
        deskTrapBottom,
        deskTrapHeight
      });
      const rotation = Number(obj.rotation || 0);
      return getRotatedRectBounds(x, y, bounds.width * deskScaleX, bounds.height * deskScaleY, rotation);
    }

    const size = 36 * baseScale;
    const rotation = type === 'camera' ? Number(obj.rotation || 0) : 0;
    return getRotatedRectBounds(x, y, size, size, rotation);
    },
    [estimateTextWidth, getNodeBounds, wallTypeIdSet]
  );

  const getObjectBounds = useCallback(
    (obj: MapObject) => {
      const version = boundsVersionRef.current;
      const cached = boundsCacheRef.current.get(obj.id);
      if (cached && cached.version === version) return cached.bounds;
      const bounds = computeObjectBounds(obj);
      boundsCacheRef.current.set(obj.id, { version, bounds });
      return bounds;
    },
    [computeObjectBounds]
  );

  const getSpatialCellSize = useCallback(() => {
    const minDim = Math.min(baseWidth || 0, baseHeight || 0);
    return Math.max(140, Math.min(520, minDim ? minDim / 12 : 320));
  }, [baseHeight, baseWidth]);

  const buildSpatialIndex = useCallback(() => {
    const version = boundsVersionRef.current;
    const cellSize = getSpatialCellSize();
    const cells = new Map<string, string[]>();
    for (const obj of objects) {
      const bounds = getObjectBounds(obj);
      const x = Number(obj.x);
      const y = Number(obj.y);
      const minX = bounds?.minX ?? x;
      const minY = bounds?.minY ?? y;
      const maxX = bounds?.maxX ?? x;
      const maxY = bounds?.maxY ?? y;
      if (![minX, minY, maxX, maxY].every(Number.isFinite)) continue;
      const minCellX = Math.floor(minX / cellSize);
      const maxCellX = Math.floor(maxX / cellSize);
      const minCellY = Math.floor(minY / cellSize);
      const maxCellY = Math.floor(maxY / cellSize);
      for (let cx = minCellX; cx <= maxCellX; cx += 1) {
        for (let cy = minCellY; cy <= maxCellY; cy += 1) {
          const key = `${cx},${cy}`;
          const bucket = cells.get(key);
          if (bucket) bucket.push(obj.id);
          else cells.set(key, [obj.id]);
        }
      }
    }
    const next = { version, cellSize, cells };
    spatialIndexRef.current = next;
    return next;
  }, [getObjectBounds, getSpatialCellSize, objects]);

  const getSpatialIndex = useCallback(() => {
    const cached = spatialIndexRef.current;
    const version = boundsVersionRef.current;
    const cellSize = getSpatialCellSize();
    if (cached && cached.version === version && Math.abs(cached.cellSize - cellSize) < 0.5) return cached;
    return buildSpatialIndex();
  }, [buildSpatialIndex, getSpatialCellSize]);

  const getSelectionCandidates = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (objects.length < 250) return objects;
      const index = getSpatialIndex();
      const minX = rect.x;
      const minY = rect.y;
      const maxX = rect.x + rect.width;
      const maxY = rect.y + rect.height;
      const minCellX = Math.floor(minX / index.cellSize);
      const maxCellX = Math.floor(maxX / index.cellSize);
      const minCellY = Math.floor(minY / index.cellSize);
      const maxCellY = Math.floor(maxY / index.cellSize);
      const ids = new Set<string>();
      for (let cx = minCellX; cx <= maxCellX; cx += 1) {
        for (let cy = minCellY; cy <= maxCellY; cy += 1) {
          const bucket = index.cells.get(`${cx},${cy}`);
          if (!bucket) continue;
          for (const id of bucket) ids.add(id);
        }
      }
      if (!ids.size) return [];
      const list: MapObject[] = [];
      ids.forEach((id) => {
        const obj = objectById.get(id);
        if (obj) list.push(obj);
      });
      return list;
    },
    [getSpatialIndex, objectById, objects]
  );

  useImperativeHandle(
    ref,
    () => ({
      getSize: () => ({ width: dimensions.width, height: dimensions.height }),
      exportDataUrl: (options) => {
        const stage = stageRef.current;
        const pixelRatio = Math.max(1, Number(options?.pixelRatio || 1));
        const mimeType = options?.mimeType || 'image/jpeg';
        const quality = typeof options?.quality === 'number' ? options.quality : 0.82;
        const width = Math.round(dimensions.width * pixelRatio);
        const height = Math.round(dimensions.height * pixelRatio);
        if (!stage) return { dataUrl: '', width, height };
        try {
          // Konva JPEG export fills transparency with black. Render to canvas, then composite on white.
          const rawCanvas: HTMLCanvasElement | null = stage.toCanvas ? stage.toCanvas({ pixelRatio }) : null;
          if (!rawCanvas) {
            if (!stage.toDataURL) return { dataUrl: '', width, height };
            const dataUrl = stage.toDataURL({ pixelRatio, mimeType, quality });
            return { dataUrl, width, height };
          }
          const out = document.createElement('canvas');
          out.width = rawCanvas.width;
          out.height = rawCanvas.height;
          const ctx = out.getContext('2d');
          if (!ctx) return { dataUrl: '', width, height };
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, out.width, out.height);
          ctx.drawImage(rawCanvas, 0, 0);
          const dataUrl = out.toDataURL(mimeType, quality);
          return { dataUrl, width: out.width, height: out.height };
        } catch {
          return { dataUrl: '', width, height };
        }
      },
      fitView: () => fitViewRef.current(),
      getObjectBounds: (id: string) => {
        const obj = objectById.get(id);
        if (!obj) return null;
        return getObjectBounds(obj);
      }
    }),
    [dimensions.height, dimensions.width, getObjectBounds, objectById]
  );

  const updateSelectionBox = (event: any) => {
    if (!selectionOrigin.current) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const x1 = selectionOrigin.current.x;
    const y1 = selectionOrigin.current.y;
    const x2 = world.x;
    const y2 = world.y;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    pendingSelectionBoxRef.current = { x, y, width, height };
    lastSelectionBoxRef.current = pendingSelectionBoxRef.current;
    if (selectionBoxRaf.current) return true;
    selectionBoxRaf.current = requestAnimationFrame(() => {
      selectionBoxRaf.current = null;
      const next = pendingSelectionBoxRef.current;
      pendingSelectionBoxRef.current = null;
      if (!next) return;
      if (perfEnabled) perfMetrics.selectionBoxUpdates += 1;
      setSelectionBox(next);
    });
    return true;
  };

  const finalizeSelectionBox = () => {
    if (!selectionOrigin.current) return false;
    const rect = lastSelectionBoxRef.current || pendingSelectionBoxRef.current || selectionBox;
    selectionOrigin.current = null;
    if (selectionBoxRaf.current) cancelAnimationFrame(selectionBoxRaf.current);
    selectionBoxRaf.current = null;
    pendingSelectionBoxRef.current = null;
    lastSelectionBoxRef.current = null;
    if (perfEnabled) perfMetrics.selectionBoxUpdates += 1;
    setSelectionBox(null);
    if (!rect) return true;
    const wPx = rect.width * Math.max(0.001, viewportRef.current.zoom || 1);
    const hPx = rect.height * Math.max(0.001, viewportRef.current.zoom || 1);
    if (wPx < 8 || hPx < 8) {
      // Desktop behavior: click on empty area clears selection.
      onSelect(undefined);
      selectedRoomIdsRef.current = [];
      return true;
    }
    const minX = rect.x;
    const maxX = rect.x + rect.width;
    const minY = rect.y;
    const maxY = rect.y + rect.height;
    const candidates = getSelectionCandidates(rect);
    const ids = candidates
      .filter((o) => {
        const bounds = getObjectBounds(o);
        const x = Number(o.x);
        const y = Number(o.y);
        const pointInside =
          Number.isFinite(x) && Number.isFinite(y) && x >= minX && x <= maxX && y >= minY && y <= maxY;
        if (bounds) {
          const boundsHit = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
          return boundsHit || pointInside;
        }
        return pointInside;
      })
      .map((o) => o.id);
    const roomIds = (plan.rooms || [])
      .filter((room) => {
        const bounds = getRoomBounds(room);
        if (!bounds) return false;
        return bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
      })
      .map((room) => room.id);
    selectedRoomIdsRef.current = roomIds;
    if (onSelectRooms) onSelectRooms(roomIds);
    boxSelectionActiveRef.current = true;
    if (onSelectMany) onSelectMany(ids);
    else {
      onSelect(undefined);
      for (const id of ids) onSelect(id, { multi: true });
    }
    lastBoxSelectAtRef.current = Date.now();
    return true;
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (readOnly) return;
    const type =
      event.dataTransfer.getData('application/plixmap-type') as MapObjectType;
    if (!type) return;
    const { x, y } = toStageCoords(event.clientX, event.clientY);
    onPlaceNew(type, x, y);
  };

  const updateTextDraftRect = (event: any) => {
    const origin = textDraftOrigin.current;
    if (!origin) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const x1 = origin.x;
    const y1 = origin.y;
    const x2 = world.x;
    const y2 = world.y;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    pendingTextDraftRef.current = { x, y, width, height };
    if (textDraftRaf.current) return true;
    textDraftRaf.current = requestAnimationFrame(() => {
      textDraftRaf.current = null;
      const next = pendingTextDraftRef.current;
      pendingTextDraftRef.current = null;
      if (!next) return;
      setTextDraftRect(next);
    });
    return true;
  };

  const finalizeTextDraftRect = () => {
    if (!textDraftOrigin.current) return null;
    const origin = textDraftOrigin.current;
    const rect = textDraftRect || { x: origin.x, y: origin.y, width: 0, height: 0 };
    let { x, y, width, height } = rect;
    const isClick = width < 3 && height < 3;
    if (isClick) {
      width = TEXT_BOX_DEFAULT_WIDTH;
      height = TEXT_BOX_DEFAULT_HEIGHT;
      x = origin.x - width / 2;
      y = origin.y - height / 2;
    } else {
      const draggedLeft = rect.x < origin.x;
      const draggedUp = rect.y < origin.y;
      if (width < TEXT_BOX_MIN_WIDTH) {
        width = TEXT_BOX_MIN_WIDTH;
        x = draggedLeft ? origin.x - width : origin.x;
      }
      if (height < TEXT_BOX_MIN_HEIGHT) {
        height = TEXT_BOX_MIN_HEIGHT;
        y = draggedUp ? origin.y - height : origin.y;
      }
    }
    textDraftOrigin.current = null;
    if (textDraftRaf.current) cancelAnimationFrame(textDraftRaf.current);
    textDraftRaf.current = null;
    pendingTextDraftRef.current = null;
    setTextDraftRect(null);
    return { x, y, width, height };
  };

  const updateDraftRect = (event: any) => {
    if (roomDrawMode !== 'rect' || readOnly) return false;
    const origin = draftOrigin.current;
    if (!origin) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const x1 = origin.x;
    const y1 = origin.y;
    const x2 = world.x;
    const y2 = world.y;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    pendingDraftRectRef.current = { x, y, width, height };
    if (draftRectRaf.current) return true;
    draftRectRaf.current = requestAnimationFrame(() => {
      draftRectRaf.current = null;
      const next = pendingDraftRectRef.current;
      pendingDraftRectRef.current = null;
      if (!next) return;
      if (perfEnabled) perfMetrics.draftRectUpdates += 1;
      setDraftRect(next);
    });
    return true;
  };

  const getNearestRoomCorner = useCallback(
    (point: { x: number; y: number }) => {
      const rooms = ((plan.rooms || []) as any[]).filter(Boolean);
      if (!rooms.length) return null;
      const zoomValue = Math.max(0.2, viewportRef.current.zoom || 1);
      const snapThreshold = 14 / zoomValue;
      const snapThresholdSq = snapThreshold * snapThreshold;
      let best: { x: number; y: number; distSq: number } | null = null;
      for (const room of rooms) {
        const points = getRoomPolygonPoints(room);
        if (!points.length) continue;
        for (const vertex of points) {
          const dx = vertex.x - point.x;
          const dy = vertex.y - point.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > snapThresholdSq) continue;
          if (!best || distSq < best.distSq) {
            best = { x: vertex.x, y: vertex.y, distSq };
          }
        }
      }
      if (!best) return null;
      return { x: best.x, y: best.y };
    },
    [plan.rooms]
  );

  const snapRoomRectStartToCorner = useCallback(
    (point: { x: number; y: number }) => getNearestRoomCorner(point) || point,
    [getNearestRoomCorner]
  );

  const updateDraftPrintRect = (event: any) => {
    if (!printAreaMode || readOnly) return false;
    const origin = printOrigin.current;
    if (!origin) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const x1 = origin.x;
    const y1 = origin.y;
    const x2 = world.x;
    const y2 = world.y;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    pendingDraftPrintRectRef.current = { x, y, width, height };
    if (draftPrintRectRaf.current) return true;
    draftPrintRectRaf.current = requestAnimationFrame(() => {
      draftPrintRectRaf.current = null;
      const next = pendingDraftPrintRectRef.current;
      pendingDraftPrintRectRef.current = null;
      if (!next) return;
      if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
      setDraftPrintRect(next);
    });
    return true;
  };

  const finalizeDraftRect = () => {
    if (roomDrawMode !== 'rect' || readOnly) return false;
    if (!draftOrigin.current || !draftRect) return false;
    const rect = {
      x: draftRect.x,
      y: draftRect.y,
      width: Math.max(0, draftRect.width),
      height: Math.max(0, draftRect.height)
    };
    draftOrigin.current = null;
    if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
    draftRectRaf.current = null;
    pendingDraftRectRef.current = null;
    setRoomRectSnapHint(null);
    setDraftRect(null);
    if (rect.width < 20 || rect.height < 20) return true;
    onCreateRoom?.({ kind: 'rect', rect });
    return true;
  };

  const finalizeDraftPrintRect = () => {
    if (!printAreaMode || readOnly) return false;
    if (!printOrigin.current || !draftPrintRect) return false;
    const rect = {
      x: draftPrintRect.x,
      y: draftPrintRect.y,
      width: Math.max(0, draftPrintRect.width),
      height: Math.max(0, draftPrintRect.height)
    };
    printOrigin.current = null;
    if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
    draftPrintRectRaf.current = null;
    pendingDraftPrintRectRef.current = null;
    if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
    setDraftPrintRect(null);
    if (rect.width < 20 || rect.height < 20) return true;
    onSetPrintArea?.(rect);
    return true;
  };
  const constrainRoomPolyPoint = useCallback(
    (world: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      const last = draftPolyPointsRef.current[draftPolyPointsRef.current.length - 1];
      if (!last || options?.shiftKey) return world;
      const dx = world.x - last.x;
      const dy = world.y - last.y;
      if (Math.abs(dx) >= Math.abs(dy)) return { x: world.x, y: last.y };
      return { x: last.x, y: world.y };
    },
    []
  );

  const backPlate = useMemo(() => {
    return (
      <Group>
        <Rect name="bg-rect" x={0} y={0} width={baseWidth} height={baseHeight} fill="#f8fafc" />
        {bgImage ? <KonvaImage image={bgImage} width={baseWidth} height={baseHeight} opacity={0.96} listening={false} /> : null}
      </Group>
    );
  }, [bgImage, baseWidth, baseHeight]);

  const previewDraftPolyLine = useMemo(() => {
    if (roomDrawMode !== 'poly') return null;
    if (!draftPolyPoints.length) return null;
    const pts = [...draftPolyPoints];
    if (draftPolyPointer) pts.push(draftPolyPointer);
    return pts.flatMap((p) => [p.x, p.y]);
  }, [draftPolyPointer, draftPolyPoints, roomDrawMode]);
  const previewCorridorDraftPolyLine = useMemo(() => {
    if (corridorDrawMode !== 'poly') return null;
    if (!corridorDraftPolyPoints.length) return null;
    const pts = [...corridorDraftPolyPoints];
    if (corridorDraftPolyPointer) pts.push(corridorDraftPolyPointer);
    return pts.flatMap((p) => [p.x, p.y]);
  }, [corridorDraftPolyPointer, corridorDraftPolyPoints, corridorDrawMode]);

  const finalizeDraftPoly = useCallback(() => {
    if (roomDrawMode !== 'poly' || readOnly) return false;
    const points = draftPolyPointsRef.current;
    if (points.length < 3) return true;
    const nextPoints = points.slice();
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPoints([]);
    draftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setDraftPolyPointer(null);
    onCreateRoom?.({ kind: 'poly', points: nextPoints });
    return true;
  }, [onCreateRoom, perfEnabled, readOnly, roomDrawMode]);
  const finalizeCorridorDraftPoly = useCallback(() => {
    if (corridorDrawMode !== 'poly' || readOnly) return false;
    const points = corridorDraftPolyPointsRef.current;
    if (points.length < 3) return true;
    const nextPoints = points.slice();
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPoints([]);
    corridorDraftPolyPointsRef.current = [];
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPointer(null);
    onCreateCorridor?.({ kind: 'poly', points: nextPoints });
    return true;
  }, [corridorDrawMode, onCreateCorridor, perfEnabled, readOnly]);
  const undoCorridorDraftSegment = useCallback(() => {
    if (corridorDrawMode !== 'poly' || readOnly) return false;
    const now = Date.now();
    if (now - lastCorridorUndoAtRef.current < 60) return true;
    lastCorridorUndoAtRef.current = now;
    if (!corridorDraftPolyPointsRef.current.length) return true;
    if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
    setCorridorDraftPolyPoints((prev) => {
      const next = prev.slice(0, -1);
      corridorDraftPolyPointsRef.current = next;
      return next;
    });
    return true;
  }, [corridorDrawMode, perfEnabled, readOnly]);

  useEffect(() => {
    if (roomDrawMode !== 'poly') return;
    const handler = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finalizeDraftPoly();
      }
	      if (e.key === 'Backspace') {
        if (!draftPolyPointsRef.current.length) return;
        e.preventDefault();
        if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
        setDraftPolyPoints((prev) => {
          const next = prev.slice(0, -1);
          draftPolyPointsRef.current = next;
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [finalizeDraftPoly, perfEnabled, roomDrawMode, suspendKeyboardShortcuts]);
  useEffect(() => {
    if (corridorDrawMode !== 'poly') return;
    const handler = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finalizeCorridorDraftPoly();
      }
      if (e.key === 'Backspace') {
        if (!corridorDraftPolyPointsRef.current.length) return;
        e.preventDefault();
        if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
        setCorridorDraftPolyPoints((prev) => {
          const next = prev.slice(0, -1);
          corridorDraftPolyPointsRef.current = next;
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [corridorDrawMode, finalizeCorridorDraftPoly, perfEnabled, suspendKeyboardShortcuts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      if (e.key !== 'Escape') return;
      const labelDrag = corridorLabelDragRef.current;
      if (labelDrag) {
        e.preventDefault();
        corridorLabelDragRef.current = null;
        try {
          const nx = Number(labelDrag.node?.x?.() ?? labelDrag.lastX ?? 0);
          const ny = Number(labelDrag.node?.y?.() ?? labelDrag.lastY ?? 0);
          if (pointInPolygon(nx, ny, labelDrag.points)) {
            onUpdateCorridor?.(labelDrag.corridorId, { labelX: Number(nx.toFixed(3)), labelY: Number(ny.toFixed(3)) });
          }
          labelDrag.node?.stopDrag?.();
          labelDrag.node?.getLayer()?.batchDraw?.();
        } catch {
          // ignore
        }
        return;
      }
      const active = roomDragRef.current;
      const corridorActive = corridorDragRef.current;
      if (!active && !corridorActive) return;
      e.preventDefault();
      if (active) {
        active.cancelled = true;
        try {
          active.node.stopDrag?.();
          active.node.position({ x: active.startX, y: active.startY });
          active.node.getLayer()?.batchDraw?.();
        } catch {
          // ignore
        }
      }
      if (corridorActive) {
        corridorActive.cancelled = true;
        try {
          corridorActive.node.stopDrag?.();
          corridorActive.node.position({ x: corridorActive.startX, y: corridorActive.startY });
          corridorActive.node.getLayer()?.batchDraw?.();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [suspendKeyboardShortcuts]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (suspendKeyboardShortcuts) return;
      if (!safetyCardSelected || !safetyCardDraft || !safetyCard?.visible || readOnly) return;
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      const key = String(e.key || '');
      if (key === '+' || key === '=' || key === '-' || key === '_') {
        e.preventDefault();
        e.stopPropagation();
        adjustSafetyCardFont(key === '-' || key === '_' ? -1 : 1);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        cycleSafetyCardColor();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        cycleSafetyCardFont(e.shiftKey ? -1 : 1);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        cycleSafetyCardTextBg();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [adjustSafetyCardFont, cycleSafetyCardColor, cycleSafetyCardFont, cycleSafetyCardTextBg, readOnly, safetyCard?.visible, safetyCardDraft, safetyCardSelected, suspendKeyboardShortcuts]);
  const showSafetyCardHelpToast = useCallback(() => {
    toast.info(
      <div className="text-left text-slate-900">
        <div className="text-sm font-semibold text-slate-900">
          {t({ it: 'Scheda sicurezza selezionata', en: 'Safety card selected' })}
        </div>
        <div className="mt-1.5 space-y-0.5 text-xs text-slate-700">
          <div>
            <strong className="font-semibold">Drag</strong> {t({ it: 'sposta', en: 'move' })}
          </div>
          <div>
            <strong className="font-semibold">Resize</strong> {t({ it: 'come una stanza', en: 'like a room' })}
          </div>
          <div>
            <strong className="font-semibold">+ / -</strong> {t({ it: 'dimensione testo', en: 'text size' })}
          </div>
          <div>
            <strong className="font-semibold">F / Shift+F</strong> {t({ it: 'font successivo / precedente', en: 'next / previous font' })}
          </div>
          <div>
            <strong className="font-semibold">C</strong> {t({ it: 'colore scheda', en: 'card color' })}
          </div>
          <div>
            <strong className="font-semibold">B</strong> {t({ it: 'sfondo testo', en: 'text background' })}
          </div>
          <div>
            <strong className="font-semibold">{t({ it: 'Click', en: 'Click' })}</strong> {t({ it: 'seleziona la scheda', en: 'selects the card' })}
          </div>
          <div>
            <strong className="font-semibold">{t({ it: 'Doppio click', en: 'Double click' })}</strong> {t({ it: 'apre rubrica emergenze', en: 'opens emergency directory' })}
          </div>
          <div>
            <strong className="font-semibold">{t({ it: 'Tasto destro', en: 'Right click' })}</strong> {t({ it: 'apre il menu scheda sicurezza', en: 'opens the safety card menu' })}
          </div>
          {readOnly ? (
            <div className="pt-0.5 text-[11px] font-semibold text-amber-700">{t({ it: 'Modalita sola lettura: drag/resize disabilitati', en: 'Read-only mode: drag/resize disabled' })}</div>
          ) : null}
        </div>
      </div>,
      { id: SAFETY_CARD_HELP_TOAST_ID, duration: Infinity }
    );
  }, [readOnly, t]);
  useEffect(() => {
    if (!safetyCard?.visible) {
      toast.dismiss(SAFETY_CARD_HELP_TOAST_ID);
      return;
    }
    if (!safetyCardSelected) {
      toast.dismiss(SAFETY_CARD_HELP_TOAST_ID);
      return;
    }
    showSafetyCardHelpToast();
  }, [safetyCard?.visible, safetyCardSelected, showSafetyCardHelpToast]);

  useEffect(() => {
    if (printAreaMode) return;
    printOrigin.current = null;
    if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
    setDraftPrintRect(null);
    if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
    draftPrintRectRaf.current = null;
    pendingDraftPrintRectRef.current = null;
  }, [perfEnabled, printAreaMode]);

  if (lastObjectsRef.current !== objects || lastWallTypeIdSetRef.current !== wallTypeIdSet) {
    boundsVersionRef.current += 1;
    boundsCacheRef.current.clear();
    spatialIndexRef.current = null;
    lastObjectsRef.current = objects;
    lastWallTypeIdSetRef.current = wallTypeIdSet;
  }
  const [wallObjects, quoteObjects, regularObjects] = useMemo(() => {
    if (!wallTypeIdSet.size) {
      const quotes = objects.filter((obj) => obj.type === 'quote');
      const others = objects.filter((obj) => obj.type !== 'quote');
      return [[], quotes, others];
    }
    const walls: MapObject[] = [];
    const quotes: MapObject[] = [];
    const others: MapObject[] = [];
    for (const obj of objects) {
      if (wallTypeIdSet.has(obj.type)) walls.push(obj);
      else if (obj.type === 'quote') quotes.push(obj);
      else others.push(obj);
    }
    return [walls, quotes, others];
  }, [objects, wallTypeIdSet]);
  const viewportWorldBounds = useMemo(() => getViewportWorldBounds(dimensions, pan, zoom), [dimensions, pan, zoom]);
  const visibleRegularObjects = useMemo(
    () => regularObjects.filter((obj) => isObjectPotentiallyVisible(obj, viewportWorldBounds)),
    [regularObjects, viewportWorldBounds]
  );
  const wallSegments = useMemo(() => {
    if (!wallObjects.length) return [] as Array<{ a: { x: number; y: number }; b: { x: number; y: number }; attenuation: number }>;
    const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; attenuation: number }> = [];
    for (const wall of wallObjects) {
      const attenuation = Number(wallAttenuationMap.get(wall.type) ?? 0);
      if (!Number.isFinite(attenuation) || attenuation <= 0) continue;
      const pts = wall.points || [];
      if (pts.length < 2) continue;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        segments.push({ a, b, attenuation });
      }
    }
    return segments;
  }, [wallAttenuationMap, wallObjects]);
  const cameraWallSegments = useMemo(() => {
    if (!wallObjects.length) return [] as Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>;
    const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
    for (const wall of wallObjects) {
      const typeId = String(wall.type || '');
      if (typeId.includes('glass') || typeId.includes('window')) continue;
      const pts = wall.points || [];
      if (pts.length < 2) continue;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        segments.push({ a, b });
      }
    }
    return segments;
  }, [wallObjects]);
  const wifiRayAngles = useMemo(() => {
    const steps = 72;
    const list: number[] = [];
    for (let i = 0; i < steps; i += 1) {
      list.push((i / steps) * Math.PI * 2);
    }
    return list;
  }, []);
  const buildWifiRangeRings = useCallback(
    (origin: { x: number; y: number }, baseRadiusPx: number) => {
      const outer: number[] = [];
      const mid: number[] = [];
      const inner: number[] = [];
      for (const angle of wifiRayAngles) {
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const hits: Array<{ t: number; attenuation: number }> = [];
        if (wallSegments.length) {
          for (const seg of wallSegments) {
            const t = intersectRaySegment(origin, dir, seg.a, seg.b);
            if (t !== null && t <= baseRadiusPx) {
              hits.push({ t, attenuation: seg.attenuation });
            }
          }
        }
        hits.sort((a, b) => a.t - b.t);
        let dist = baseRadiusPx;
        for (const hit of hits) {
          if (hit.t > dist) break;
          const remaining = dist - hit.t;
          if (remaining <= 0) {
            dist = hit.t;
            break;
          }
          const factor = Math.pow(10, hit.attenuation / 20);
          dist = hit.t + remaining / factor;
        }
        dist = Math.max(0, dist);
        outer.push(dir.x * dist, dir.y * dist);
        mid.push(dir.x * dist * 0.7, dir.y * dist * 0.7);
        inner.push(dir.x * dist * 0.4, dir.y * dist * 0.4);
      }
      return { outer, mid, inner };
    },
    [wallSegments, wifiRayAngles]
  );
  const buildCameraFovPolygon = useCallback(
    (origin: { x: number; y: number }, rangePx: number, angleDeg: number, rotationDeg: number) => {
      if (!Number.isFinite(rangePx) || rangePx <= 0) return null;
      if (!Number.isFinite(angleDeg) || angleDeg <= 0) return null;
      const clampedAngle = Math.min(360, Math.max(5, angleDeg));
      const steps = Math.max(12, Math.ceil(clampedAngle / 5));
      const startRad = ((rotationDeg - clampedAngle / 2) * Math.PI) / 180;
      const endRad = ((rotationDeg + clampedAngle / 2) * Math.PI) / 180;
      const points: number[] = [0, 0];
      for (let i = 0; i <= steps; i += 1) {
        const angle = startRad + ((endRad - startRad) * i) / steps;
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        let dist = rangePx;
        if (cameraWallSegments.length) {
          for (const seg of cameraWallSegments) {
            const t = intersectRaySegment(origin, dir, seg.a, seg.b);
            if (t !== null && t < dist) dist = t;
          }
        }
        dist = Math.max(0, dist);
        points.push(dir.x * dist, dir.y * dist);
      }
      return points;
    },
    [cameraWallSegments]
  );

  const selectedBounds = useMemo(() => {
    const idsArr = selectedIds || (selectedId ? [selectedId] : []);
    if (!idsArr.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of idsArr) {
      const obj = objectById.get(id);
      if (!obj) continue;
      const bounds = getObjectBounds(obj);
      if (!bounds) continue;
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY };
  }, [getObjectBounds, objectById, selectedId, selectedIds]);

  useEffect(() => {
    if (boxSelectionActiveRef.current) {
      boxSelectionActiveRef.current = false;
      return;
    }
    selectedRoomIdsRef.current = Array.isArray(selectedRoomIds) ? [...selectedRoomIds] : [];
  }, [selectedRoomIds]);
  useEffect(() => {
    if (roomDrawMode === 'rect' && !readOnly) return;
    setRoomRectSnapHint(null);
  }, [readOnly, roomDrawMode]);
  const allowTool = !!toolMode && (!readOnly || toolMode === 'measure');

  return (
    <div
      className={`relative h-full w-full rounded-2xl border border-slate-200 border-b-4 border-b-slate-200 bg-white shadow-card ${
        roomDrawMode || corridorDrawMode || printAreaMode || allowTool ? 'cursor-crosshair' : ''
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        if (corridorDrawMode === 'poly') {
          undoCorridorDraftSegment();
          return;
        }
        // If another Konva context menu was just opened (object/link/bg), don't open map menu too.
        if (Date.now() - lastContextMenuAtRef.current < 60) return;
        if (pendingType || readOnly || toolMode) return;
        if (roomDrawMode) return;
        if ((e as any).metaKey || (e as any).altKey) return;
        if (isBoxSelecting()) return;
        const stage = stageRef.current;
        if (!stage) return;
        try {
          stage.setPointersPositions(e);
        } catch {
          // ignore
        }
        const pos = stage.getPointerPosition?.();
        if (!pos) return;
        const world = pointerToWorld(pos.x, pos.y);
        onMapContextMenu({ clientX: e.clientX, clientY: e.clientY, worldX: world.x, worldY: world.y });
      }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {hoverCard ? (
        hoverCard.obj?.type === 'postit' ? (
          <div
            className="pointer-events-none fixed z-50 w-[320px] -translate-x-1/2 rounded-2xl border border-amber-200 bg-[#fde68a]/95 p-3 text-xs text-amber-900 shadow-card backdrop-blur"
            style={{ left: hoverCard.clientX, top: hoverCard.clientY + 14 }}
          >
            <div className="text-xs font-semibold uppercase text-amber-700">{t({ it: 'Post-it', en: 'Post-it' })}</div>
            <div className="mt-2 whitespace-pre-wrap text-sm">
              {String(hoverCard.obj.name || '').trim() || t({ it: 'Nota vuota', en: 'Empty note' })}
            </div>
          </div>
        ) : (
          <div
            className="pointer-events-none fixed z-50 w-[280px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-card backdrop-blur"
            style={{ left: hoverCard.clientX, top: hoverCard.clientY + 14 }}
          >
            <div className="text-sm font-semibold text-ink">
              {(hoverCard.obj.firstName || hoverCard.obj.name || '').toString()} {(hoverCard.obj.lastName || '').toString()}
            </div>
            <div className="mt-1 space-y-1">
              {hoverCard.obj.externalRole ? (
                <div>
                  <span className="font-semibold text-slate-600">{t({ it: 'Ruolo', en: 'Role' })}:</span> {hoverCard.obj.externalRole}
                </div>
              ) : null}
              {[hoverCard.obj.externalDept1, hoverCard.obj.externalDept2, hoverCard.obj.externalDept3].filter(Boolean).length ? (
                <div>
                  <span className="font-semibold text-slate-600">{t({ it: 'Reparto', en: 'Department' })}:</span>{' '}
                  {[hoverCard.obj.externalDept1, hoverCard.obj.externalDept2, hoverCard.obj.externalDept3].filter(Boolean).join(' / ')}
                </div>
              ) : null}
              {hoverCard.obj.externalEmail ? (
                <div>
                  <span className="font-semibold text-slate-600">{t({ it: 'Email', en: 'Email' })}:</span> {hoverCard.obj.externalEmail}
                </div>
              ) : null}
              {hoverCard.obj.externalMobile ? (
                <div>
                  <span className="font-semibold text-slate-600">{t({ it: 'Cellulare', en: 'Mobile' })}:</span> {hoverCard.obj.externalMobile}
                </div>
              ) : null}
              {[hoverCard.obj.externalExt1, hoverCard.obj.externalExt2, hoverCard.obj.externalExt3].filter(Boolean).length ? (
                <div>
                  <span className="font-semibold text-slate-600">{t({ it: 'Interni', en: 'Extensions' })}:</span>{' '}
                  {[hoverCard.obj.externalExt1, hoverCard.obj.externalExt2, hoverCard.obj.externalExt3].filter(Boolean).join(', ')}
                </div>
              ) : null}
              {hoverCard.obj.externalUserId ? (
                <div className="text-[11px] text-slate-500">
                  ID: <span className="font-mono">{hoverCard.obj.externalUserId}</span>
                  {hoverCard.obj.externalIsExternal ? ` · ${t({ it: 'Esterno', en: 'External' })}` : ''}
                </div>
              ) : null}
            </div>
          </div>
        )
      ) : null}
      {doorHoverCard ? (
        <div
          className="pointer-events-none fixed z-50 max-w-[340px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-card backdrop-blur"
          style={{ left: doorHoverCard.clientX, top: doorHoverCard.clientY + 14 }}
        >
          {doorHoverCard.content}
        </div>
      ) : null}
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        pixelRatio={stagePixelRatio}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (corridorDrawMode === 'poly' && !readOnly && isContextClick(e.evt)) {
            e.evt.preventDefault();
            e.cancelBubble = true;
            undoCorridorDraftSegment();
            return;
          }
          const isSafetyTransformerTarget = (() => {
            const transformer = safetyCardTransformerRef.current;
            if (!transformer || !safetyCardSelected) return false;
            let cursor: any = e.target;
            while (cursor) {
              if (cursor === transformer) return true;
              const parent = cursor.getParent?.();
              if (!parent || parent === cursor) break;
              cursor = parent;
            }
            return false;
          })();
          const isSafetyTarget = isSafetyCardNode(e.target) || isSafetyTransformerTarget;
          const isEmptyTarget = e.target === e.target.getStage() || e.target?.attrs?.name === 'bg-rect';
          if (!isSafetyTarget && safetyCardSelected) {
            setSafetyCardSelected(false);
          }
          if (toolMode === 'wall' && isContextClick(e.evt)) {
            e.evt.preventDefault();
            onWallDraftContextMenu?.();
            return;
          }
          if (isPanGesture(e.evt)) {
            e.evt.preventDefault();
            startPan(e);
            return;
          }
          if (corridorDoorDraft?.corridorId && !readOnly && !isContextClick(e.evt) && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            const corridor = ((plan.corridors || []) as Corridor[]).find((c) => c.id === corridorDoorDraft.corridorId);
            const corridorPoints = corridor ? getCorridorPolygonPoints(corridor) : [];
            const snap = corridorPoints.length ? getClosestCorridorEdgePoint(corridorPoints, world) : null;
            if (snap && onCorridorDoorDraftPoint) {
              const maxDistance = 42 / Math.max(0.2, viewportRef.current.zoom || 1);
              const distance = Math.hypot(world.x - snap.x, world.y - snap.y);
              if (distance <= maxDistance) {
                onCorridorDoorDraftPoint({
                  corridorId: corridorDoorDraft.corridorId,
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  point: { edgeIndex: snap.edgeIndex, t: snap.t, x: snap.x, y: snap.y }
                });
              }
            }
            return;
          }
          if (allowTool && !isContextClick(e.evt) && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            onToolPoint?.(world, { shiftKey: !!e.evt.shiftKey });
            return;
          }
          if (pendingType && !readOnly && !isContextClick(e.evt) && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            if (pendingType === 'text') {
              textDraftOrigin.current = { x: world.x, y: world.y };
              pendingTextDraftRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
              setTextDraftRect(pendingTextDraftRef.current);
              return;
            }
            onPlaceNew(pendingType, world.x, world.y);
            return;
          }
          if (
            isEmptyTarget &&
            isBoxSelectGesture(e.evt) &&
            !pendingType &&
            (!roomDrawMode || readOnly) &&
            (!corridorDrawMode || readOnly) &&
            (!printAreaMode || readOnly) &&
            !toolMode
          ) {
            e.evt.preventDefault();
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            selectionOrigin.current = { x: world.x, y: world.y };
            pendingSelectionBoxRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
            lastSelectionBoxRef.current = pendingSelectionBoxRef.current;
            setSelectionBox(pendingSelectionBoxRef.current);
            lastBoxSelectAtRef.current = Date.now();
            return;
          }
          if (isContextClick(e.evt)) return;
          if (printAreaMode && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            printOrigin.current = { x: world.x, y: world.y };
            pendingDraftPrintRectRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
            if (perfEnabled) perfMetrics.draftPrintRectUpdates += 1;
            setDraftPrintRect(pendingDraftPrintRectRef.current);
            return;
          }
          if (roomDrawMode === 'rect' && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = snapRoomRectStartToCorner(pointerToWorld(pos.x, pos.y));
            setRoomRectSnapHint(null);
            draftOrigin.current = { x: world.x, y: world.y };
            pendingDraftRectRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
            if (perfEnabled) perfMetrics.draftRectUpdates += 1;
            setDraftRect(pendingDraftRectRef.current);
            return;
          }
          if (roomDrawMode === 'poly' && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            const constrained = constrainRoomPolyPoint(world, { shiftKey: !!e.evt.shiftKey });
            const closeThreshold = 12 / Math.max(0.2, viewportRef.current.zoom || 1);
            const currentPoints = draftPolyPointsRef.current;
            if (currentPoints.length >= 3) {
              const first = currentPoints[0];
              const dx = constrained.x - first.x;
              const dy = constrained.y - first.y;
              if (Math.hypot(dx, dy) <= closeThreshold) {
                finalizeDraftPoly();
                return;
              }
            }
            if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
            setDraftPolyPoints((prev) => {
              const next = [...prev, { x: constrained.x, y: constrained.y }];
              draftPolyPointsRef.current = next;
              return next;
            });
            return;
          }
          if (corridorDrawMode === 'poly' && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            const closeThreshold = 12 / Math.max(0.2, viewportRef.current.zoom || 1);
            const currentPoints = corridorDraftPolyPointsRef.current;
            if (currentPoints.length >= 3) {
              const first = currentPoints[0];
              const dx = world.x - first.x;
              const dy = world.y - first.y;
              if (Math.hypot(dx, dy) <= closeThreshold) {
                finalizeCorridorDraftPoly();
                return;
              }
            }
            if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
            setCorridorDraftPolyPoints((prev) => {
              const next = [...prev, { x: world.x, y: world.y }];
              corridorDraftPolyPointsRef.current = next;
              return next;
            });
            return;
          }
          // Clear selection on left-click empty area (no pending placement)
          if (!pendingType && !toolMode && !roomDrawMode && !corridorDrawMode && isEmptyTarget && e.evt.button === 0) onSelect(undefined);
        }}
        onDblClick={(e) => {
          if (typeof e.evt?.button === 'number' && e.evt.button !== 0) return;
          const stage = e.target.getStage();
          const pos = stage?.getPointerPosition();
          if (!pos) return;
          const world = pointerToWorld(pos.x, pos.y);
          if (onOpenPhoto) {
            const hit = findPhotoAtPoint(world.x, world.y);
            if (hit) {
              const selectionSnapshot = selectedIds ? [...selectedIds] : selectedId ? [selectedId] : [];
              if (!selectionSnapshot.includes(hit.id)) selectionSnapshot.push(hit.id);
              const now = Date.now();
              if (now - lastPhotoOpenAtRef.current > 200) {
                lastPhotoOpenAtRef.current = now;
                onOpenPhoto({ id: hit.id, selectionIds: selectionSnapshot });
              }
              e.cancelBubble = true;
              return;
            }
          }
          if (!allowTool) return;
          e.cancelBubble = true;
          onToolDoubleClick?.(world);
        }}
        onMouseMove={(e) => {
          if (quoteResizeRef.current) {
            e.evt.preventDefault();
            updateQuoteResizePreview(!!e.evt.shiftKey);
            return;
          }
          if (textDraftOrigin.current) {
            updateTextDraftRect(e);
            return;
          }
          if (cameraRotateRef.current) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              scheduleCameraRotation(world, !!e.evt.shiftKey);
            }
            return;
          }
          if (allowTool) {
            if (isPanning) {
              movePan(e);
              return;
            }
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              onToolMove?.(world, { shiftKey: !!e.evt.shiftKey });
            }
            return;
          }
          if (pendingType && !readOnly) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              pendingPreviewRef.current = world;
              if (!pendingPreviewRaf.current) {
                pendingPreviewRaf.current = requestAnimationFrame(() => {
                  pendingPreviewRaf.current = null;
                  const next = pendingPreviewRef.current;
                  pendingPreviewRef.current = null;
                  if (next) setPendingPreview(next);
                });
              }
            }
          }
          if (corridorDoorDraft?.corridorId && !readOnly) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              const corridor = ((plan.corridors || []) as Corridor[]).find((c) => c.id === corridorDoorDraft.corridorId);
              const corridorPoints = corridor ? getCorridorPolygonPoints(corridor) : [];
              const snap = corridorPoints.length ? getClosestCorridorEdgePoint(corridorPoints, world) : null;
              if (snap) setCorridorDoorHover({ edgeIndex: snap.edgeIndex, t: snap.t, x: snap.x, y: snap.y });
              else setCorridorDoorHover(null);
            } else {
              setCorridorDoorHover(null);
            }
          } else if (corridorDoorHover) {
            setCorridorDoorHover(null);
          }
          if (roomDrawMode === 'rect' && !readOnly && !draftOrigin.current) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              const nearestCorner = getNearestRoomCorner(world);
              setRoomRectSnapHint((prev) => {
                if (!nearestCorner) return prev ? null : prev;
                if (prev && Math.hypot(prev.x - nearestCorner.x, prev.y - nearestCorner.y) < 0.001) return prev;
                return nearestCorner;
              });
            } else {
              setRoomRectSnapHint(null);
            }
          } else if (roomRectSnapHint) {
            setRoomRectSnapHint(null);
          }
          if (updateSelectionBox(e)) return;
          if (updateDraftPrintRect(e)) return;
          if (updateDraftRect(e)) return;
          if (corridorDrawMode === 'poly' && !readOnly) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              if (corridorDraftPolyRaf.current) cancelAnimationFrame(corridorDraftPolyRaf.current);
              corridorDraftPolyRaf.current = requestAnimationFrame(() => {
                if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
                setCorridorDraftPolyPointer({ x: world.x, y: world.y });
              });
            }
            return;
          }
          if (roomDrawMode === 'poly' && !readOnly) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              const constrained = constrainRoomPolyPoint(world, { shiftKey: !!e.evt.shiftKey });
              if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
              draftPolyRaf.current = requestAnimationFrame(() => {
                if (perfEnabled) perfMetrics.draftPolyUpdates += 1;
                setDraftPolyPointer({ x: constrained.x, y: constrained.y });
              });
            }
            return;
          }
          movePan(e);
        }}
        onMouseUp={(e) => {
          if (quoteResizeRef.current) {
            e.evt.preventDefault();
            commitQuoteResize();
            return;
          }
          if (textDraftOrigin.current) {
            const rect = finalizeTextDraftRect();
            if (rect && pendingType === 'text' && !readOnly) {
              const centerX = rect.x + rect.width / 2;
              const centerY = rect.y + rect.height / 2;
              onPlaceNew('text', centerX, centerY, { textBoxWidth: rect.width, textBoxHeight: rect.height });
            }
            return;
          }
          if (stopCameraRotation()) return;
          if (finalizeSelectionBox()) return;
          if (isContextClick(e.evt)) return;
          if (finalizeDraftPrintRect()) return;
          if (finalizeDraftRect()) return;
          endPan();
        }}
        onMouseLeave={() => {
          if (quoteResizeRef.current) {
            commitQuoteResize();
            return;
          }
          if (textDraftOrigin.current) {
            const rect = finalizeTextDraftRect();
            if (rect && pendingType === 'text' && !readOnly) {
              const centerX = rect.x + rect.width / 2;
              const centerY = rect.y + rect.height / 2;
              onPlaceNew('text', centerX, centerY, { textBoxWidth: rect.width, textBoxHeight: rect.height });
            }
            return;
          }
          if (stopCameraRotation()) return;
          if (finalizeSelectionBox()) return;
          if (finalizeDraftPrintRect()) return;
          if (finalizeDraftRect()) return;
          endPan();
          if (pendingType) {
            if (pendingPreviewRaf.current) cancelAnimationFrame(pendingPreviewRaf.current);
            pendingPreviewRaf.current = null;
            pendingPreviewRef.current = null;
            setPendingPreview(null);
          }
          setCorridorDoorHover(null);
          setRoomRectSnapHint(null);
          setDoorHoverCard(null);
        }}
      >
        {/* Static background layer (non-listening to avoid hit graph work and keep pan/drag fluidity). */}
        <Layer perfectDrawEnabled={false} listening={false}>
          {backPlate}
          {gridLines}
        </Layer>

        {/* Corridors layer */}
        <Layer perfectDrawEnabled={false} listening={!toolMode}>
          {((plan.corridors || []) as Corridor[]).map((corridor) => {
            const points = getCorridorPolygonPoints(corridor);
            if (points.length < 3) return null;
            const flat = points.flatMap((p: { x: number; y: number }) => [p.x, p.y]);
            const bounds = getPolygonLabelBounds(points);
            const isSelectedCorridor = selectedCorridorId === corridor.id;
            const baseColor = String(corridor.color || '#94a3b8');
            const fillColor = hexToRgba(baseColor, isSelectedCorridor ? 0.24 : 0.18);
            const strokeColor = isSelectedCorridor ? '#0f766e' : '#64748b';
            const strokeWidth = isSelectedCorridor ? 2.2 : 1.3;
            const label = corridor.showName !== false ? getLocalizedName(corridor as any) : '';
            const labelScale = clamp(Number((corridor as any).labelScale || 1), 0.6, 3);
            const labelCenterX = Number.isFinite(Number((corridor as any).labelX))
              ? Number((corridor as any).labelX)
              : bounds.x + bounds.width / 2;
            const labelCenterY = Number.isFinite(Number((corridor as any).labelY))
              ? Number((corridor as any).labelY)
              : bounds.y + bounds.height / 2;
            const connections = Array.isArray(corridor.connections) ? corridor.connections : [];
            const kind = (corridor.kind || (Array.isArray(corridor.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            const isDraftTarget = corridorDoorDraft?.corridorId === corridor.id;
            const canDragCorridor =
              isSelectedCorridor &&
              kind === 'rect' &&
              !readOnly &&
                  !panToolActive &&
                  !pendingType &&
                  !toolMode &&
                  !isDraftTarget;
            const canDragLabel = isSelectedCorridor && !readOnly && !isDraftTarget;
            return (
              <Group
                key={corridor.id}
                ref={(node) => {
                  if (node) corridorNodeRefs.current[corridor.id] = node;
                  else delete corridorNodeRefs.current[corridor.id];
                }}
                draggable={canDragCorridor}
                onDragStart={(e) => {
                  corridorDragRef.current = {
                    corridorId: corridor.id,
                    startX: e.target.x(),
                    startY: e.target.y(),
                    node: e.target,
                    cancelled: false
                  };
                }}
                onDragEnd={(e) => {
                  if (!canDragCorridor) return;
                  const active = corridorDragRef.current;
                  if (active && active.corridorId === corridor.id) {
                    corridorDragRef.current = null;
                    if (active.cancelled) {
                      e.target.position({ x: active.startX, y: active.startY });
                      e.target.getLayer()?.batchDraw?.();
                      return;
                    }
                  }
                  const node = e.target;
                  const dx = node.x();
                  const dy = node.y();
                  node.position({ x: 0, y: 0 });
                  node.getLayer()?.batchDraw?.();
                  if (!dx && !dy) return;
                  onUpdateCorridor?.(corridor.id, {
                    kind: 'rect',
                    x: Number(corridor.x || 0) + dx,
                    y: Number(corridor.y || 0) + dy,
                    width: Number(corridor.width || 0),
                    height: Number(corridor.height || 0)
                  });
                }}
                onMouseDown={(e) => {
                  if (e.evt?.button !== 1) return;
                  if (readOnly || panToolActive || !!toolMode) return;
                  if (isDraftTarget) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  onSelectCorridor?.(corridor.id);
                  onSelectCorridorDoor?.(undefined);
                  onCorridorMiddleClick?.({
                    corridorId: corridor.id,
                    clientX: e.evt.clientX,
                    clientY: e.evt.clientY,
                    worldX: world.x,
                    worldY: world.y
                  });
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                  if (isDraftTarget) {
                    onSelectCorridor?.(corridor.id);
                    return;
                  }
                  onSelectCorridor?.(corridor.id);
                  onSelectCorridorDoor?.(undefined);
                  onCorridorClick?.({
                    id: corridor.id,
                    clientX: e.evt.clientX,
                    clientY: e.evt.clientY,
                    worldX: world.x,
                    worldY: world.y
                  });
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if (String((e.target as any)?.attrs?.name || '') === 'corridor-connection-point') return;
                  if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                  if (isBoxSelecting()) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                  onSelectCorridor?.(corridor.id, { keepContext: true });
                  onSelectCorridorDoor?.(undefined);
                  onCorridorContextMenu?.({
                    id: corridor.id,
                    clientX: e.evt.clientX,
                    clientY: e.evt.clientY,
                    worldX: world.x,
                    worldY: world.y
                  });
                }}
              >
                <Line
                  ref={(node) => {
                    if (node) corridorPolyLineRefs.current[corridor.id] = node;
                    else delete corridorPolyLineRefs.current[corridor.id];
                  }}
                  points={flat}
                  closed
                  fill={fillColor}
                  fillPatternImage={(corridorPattern as any) || undefined}
                  fillPatternRepeat="repeat"
                  fillPatternScale={{ x: 1, y: 1 }}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  dash={[4, 3]}
                  lineJoin="round"
                />
                <Line
                  points={flat}
                  closed
                  fill="rgba(15,23,42,0.001)"
                  strokeEnabled={false}
                />
                {label ? (
                  (() => {
                    const maxWidth = Math.max(40, bounds.width - 12);
                    const labelWidth = Math.min(maxWidth, Math.max(40, (label.length * 6.4 + 18) * labelScale));
                    const labelHeight = 20 * labelScale;
                    return (
                      <>
                        <Group
                          x={labelCenterX}
                          y={labelCenterY}
                          draggable={canDragLabel}
                          onDragStart={(e) => {
                            e.cancelBubble = true;
                            corridorLabelDragRef.current = {
                              corridorId: corridor.id,
                              node: e.target,
                              points: points.map((p) => ({ x: p.x, y: p.y })),
                              lastX: e.target.x(),
                              lastY: e.target.y()
                            };
                          }}
                          onDragMove={(e) => {
                            e.cancelBubble = true;
                            if (!corridorLabelDragRef.current || corridorLabelDragRef.current.corridorId !== corridor.id) return;
                            corridorLabelDragRef.current.lastX = e.target.x();
                            corridorLabelDragRef.current.lastY = e.target.y();
                          }}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            if (e.evt?.button !== 0) return;
                            onSelectCorridor?.(corridor.id);
                          }}
                          onDragEnd={(e) => {
                            corridorLabelDragRef.current = null;
                            if (!canDragLabel) return;
                            const nx = e.target.x();
                            const ny = e.target.y();
                            if (!pointInPolygon(nx, ny, points)) {
                              e.target.position({ x: labelCenterX, y: labelCenterY });
                              e.target.getLayer()?.batchDraw?.();
                              return;
                            }
                            onUpdateCorridor?.(corridor.id, {
                              labelX: Number(nx.toFixed(3)),
                              labelY: Number(ny.toFixed(3))
                            });
                          }}
                        >
                          <Rect
                            x={-labelWidth / 2}
                            y={-labelHeight / 2}
                            width={labelWidth}
                            height={labelHeight}
                            cornerRadius={6 * labelScale}
                            fill="rgba(255,255,255,0.9)"
                            stroke={isSelectedCorridor ? 'rgba(15,118,110,0.65)' : 'rgba(100,116,139,0.45)'}
                            strokeWidth={isSelectedCorridor ? 1.2 : 0.8}
                          />
                          <Text
                            x={-labelWidth / 2 + 5 * labelScale}
                            y={-labelHeight / 2 + 4 * labelScale}
                            width={labelWidth - 10 * labelScale}
                            text={label}
                            align="center"
                            fontSize={11 * labelScale}
                            fontStyle={isSelectedCorridor ? '700' : '600'}
                            fill={isSelectedCorridor ? '#0f172a' : '#334155'}
                            wrap="none"
                            ellipsis
                          />
                        </Group>
                        {isSelectedCorridor ? (
                          <Group x={labelCenterX + labelWidth / 2 + 11} y={labelCenterY - labelHeight / 2 - 1}>
                            <Group
                              onClick={(e) => {
                                e.cancelBubble = true;
                                onAdjustCorridorLabelScale?.(corridor.id, 0.1);
                              }}
                            >
                              <Circle radius={8} fill="rgba(15,23,42,0.88)" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} />
                              <Text x={-3.5} y={-5.8} text="+" fontSize={11} fill="#ffffff" listening={false} />
                            </Group>
                            <Group
                              y={19}
                              onClick={(e) => {
                                e.cancelBubble = true;
                                onAdjustCorridorLabelScale?.(corridor.id, -0.1);
                              }}
                            >
                              <Circle radius={8} fill="rgba(15,23,42,0.88)" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} />
                              <Text x={-2.8} y={-5.8} text="-" fontSize={11} fill="#ffffff" listening={false} />
                            </Group>
                          </Group>
                        ) : null}
                      </>
                    );
                  })()
                ) : null}
                {connections.map((connection) => {
                  const point =
                    (Number.isFinite(Number((connection as any).x)) && Number.isFinite(Number((connection as any).y))
                      ? { x: Number((connection as any).x), y: Number((connection as any).y) }
                      : null) || getCorridorEdgePoint(points, Number(connection.edgeIndex), Number(connection.t));
                  if (!point) return null;
                  const canDragConnection = isSelectedCorridor && !readOnly && !isDraftTarget;
                  const transitionType = (connection as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs';
                  const transitionLabel =
                    transitionType === 'elevator'
                      ? t({ it: 'Ascensore', en: 'Elevator' })
                      : t({ it: 'Scale', en: 'Stairs' });
                  const connectedPlanIds = Array.from(
                    new Set(
                      (Array.isArray((connection as any)?.planIds) ? (connection as any).planIds : [])
                        .map((id: any) => String(id || '').trim())
                        .filter(Boolean)
                    )
                  ) as string[];
                  const connectedPlanNames = connectedPlanIds
                    .map((id) => String(connectionPlanNamesById?.[id] || '').trim())
                    .filter(Boolean);
                  const currentPlanName = String((plan as any)?.name || '').trim() || t({ it: 'Piano corrente', en: 'Current floor' });
                  const renderPlanNames = () => {
                    if (!connectedPlanNames.length) return <span>{t({ it: 'piani non configurati', en: 'no floors configured' })}</span>;
                    return connectedPlanNames.map((name, idx) => (
                      <Fragment key={`${connection.id}:${name}:${idx}`}>
                        <strong>{name}</strong>
                        {idx < connectedPlanNames.length - 1 ? ', ' : ''}
                      </Fragment>
                    ));
                  };
                  const connectionHoverContent = (
                    <div className="space-y-0.5">
                      <div>
                        <span className="font-semibold">{transitionLabel}</span> {t({ it: 'per', en: 'to' })} {renderPlanNames()}
                      </div>
                      <div>
                        {t({ it: 'Collega', en: 'Connects' })}: <strong>{currentPlanName}</strong>
                        {connectedPlanNames.length ? (
                          <>
                            {' '}
                            ↔ {renderPlanNames()}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                  const resolveClientPoint = (e: any): { clientX: number; clientY: number } => {
                    const cx = Number((e?.evt as any)?.clientX);
                    const cy = Number((e?.evt as any)?.clientY);
                    if (Number.isFinite(cx) && Number.isFinite(cy)) return { clientX: cx, clientY: cy };
                    const stage = e?.target?.getStage?.();
                    const pos = stage?.getPointerPosition?.();
                    const rect = stage?.container?.()?.getBoundingClientRect?.();
                    if (pos && rect) return { clientX: Number(rect.left + pos.x), clientY: Number(rect.top + pos.y) };
                    return { clientX: 0, clientY: 0 };
                  };
                  return (
                    <Group key={connection.id}>
                      <Circle
                        name="corridor-connection-point"
                        x={point.x}
                        y={point.y}
                        radius={5.2}
                        fill="#ef4444"
                        stroke="#7f1d1d"
                        strokeWidth={1.1}
                        draggable={canDragConnection}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          onSelectCorridor?.(corridor.id);
                        }}
                        onMouseEnter={(e) => {
                          const clientPoint = resolveClientPoint(e);
                          setDoorHoverCard({ clientX: clientPoint.clientX, clientY: clientPoint.clientY, content: connectionHoverContent });
                        }}
                        onMouseMove={(e) => {
                          const clientPoint = resolveClientPoint(e);
                          setDoorHoverCard((prev) =>
                            prev
                              ? { ...prev, clientX: clientPoint.clientX, clientY: clientPoint.clientY, content: connectionHoverContent }
                              : { clientX: clientPoint.clientX, clientY: clientPoint.clientY, content: connectionHoverContent }
                          );
                        }}
                        onMouseLeave={() => {
                          setDoorHoverCard(null);
                        }}
                        onDragEnd={(e) => {
                          if (!canDragConnection) return;
                          const node = e.target;
                          const nx = node.x();
                          const ny = node.y();
                          if (!pointInPolygon(nx, ny, points)) {
                            node.position({ x: point.x, y: point.y });
                            node.getLayer()?.batchDraw?.();
                            return;
                          }
                          const snap = getClosestCorridorEdgePoint(points, { x: nx, y: ny });
                          const nextConnections = connections.map((cp) =>
                            cp.id === connection.id
                              ? {
                                  ...cp,
                                  edgeIndex: snap ? snap.edgeIndex : Number(cp.edgeIndex),
                                  t: snap ? Number(snap.t.toFixed(4)) : Number(cp.t),
                                  x: Number(nx.toFixed(3)),
                                  y: Number(ny.toFixed(3))
                                }
                              : cp
                          );
                          onUpdateCorridor?.(corridor.id, { connections: nextConnections as any });
                        }}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          e.evt.stopPropagation?.();
                          e.cancelBubble = true;
                          if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                          if (isBoxSelecting()) return;
                          onSelectCorridor?.(corridor.id, { keepContext: true });
                          onSelectCorridorDoor?.(undefined);
                          onCorridorConnectionContextMenu?.({
                            corridorId: corridor.id,
                            connectionId: connection.id,
                            clientX: e.evt.clientX,
                            clientY: e.evt.clientY,
                            worldX: point.x,
                            worldY: point.y
                          });
                        }}
                      />
                      <Circle x={point.x} y={point.y} radius={1.8} fill="#fee2e2" listening={false} />
                    </Group>
                  );
                })}
                {isSelectedCorridor && kind === 'poly' && !readOnly && !isDraftTarget
                  ? points.map((p, idx) => (
                      <Circle
                        key={`${corridor.id}:v:${idx}`}
                        ref={(node) => {
                          if (!corridorVertexRefs.current[corridor.id]) corridorVertexRefs.current[corridor.id] = {};
                          if (node) corridorVertexRefs.current[corridor.id][idx] = node;
                          else if (corridorVertexRefs.current[corridor.id]) delete corridorVertexRefs.current[corridor.id][idx];
                        }}
                        x={p.x}
                        y={p.y}
                        radius={3.8}
                        fill="#ffffff"
                        stroke="#0f766e"
                        strokeWidth={1.3}
                        draggable={!panToolActive}
                        onDragMove={() => {
                          const line = corridorPolyLineRefs.current[corridor.id];
                          const node = corridorVertexRefs.current[corridor.id]?.[idx];
                          if (!line || !node) return;
                          const next = points.flatMap((pt, i) => {
                            const x = i === idx ? node.x() : pt.x;
                            const y = i === idx ? node.y() : pt.y;
                            return [x, y];
                          });
                          line.points(next);
                          line.getLayer()?.batchDraw?.();
                        }}
                        onDragEnd={() => {
                          const node = corridorVertexRefs.current[corridor.id]?.[idx];
                          if (!node) return;
                          const nextPoints = points.map((pt, i) =>
                            i === idx ? { x: Number(node.x()), y: Number(node.y()) } : { x: pt.x, y: pt.y }
                          );
                          if (nextPoints.length < 3) return;
                          if (nextPoints.some((pt) => !Number.isFinite(pt.x) || !Number.isFinite(pt.y))) return;
                          onUpdateCorridor?.(corridor.id, { kind: 'poly', points: nextPoints });
                        }}
                      />
                    ))
                  : null}
              </Group>
            );
          })}
          {corridorDoorDraft?.corridorId && corridorDoorHover ? (
            <>
              <Group x={corridorDoorHover.x} y={corridorDoorHover.y} listening={false}>
                <Circle radius={8} fill="rgba(146,64,14,0.26)" stroke="#92400e" strokeWidth={1.4} />
                <Rect x={-2.8} y={-4.2} width={5.6} height={8.4} cornerRadius={1.2} stroke="#92400e" strokeWidth={1} fillEnabled={false} />
                <Line points={[0, -4.2, 0, 4.2]} stroke="#92400e" strokeWidth={1} />
              </Group>
            </>
          ) : null}
        </Layer>

        {/* Rooms layer */}
        <Layer perfectDrawEnabled={false} listening={!toolMode && !corridorDoorDraftActive && !roomDrawMode}>
          {(plan.rooms || []).map((room) => {
            const isSelectedRoom = selectedRoomId === room.id || (selectedRoomIds || []).includes(room.id);
            const kind = (room.kind || (room.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            const baseColor = (room as any).color || '#64748b';
            const roomSpecialType = getRoomSpecialType(room as any);
            const roomWithoutWindows = isRoomWithoutWindows(room as any);
            const specialPalette =
              roomSpecialType === 'bathroom'
                ? { fill: '#0ea5e9', stroke: '#0284c7' }
                : roomSpecialType === 'technical'
                  ? { fill: '#334155', stroke: '#0f172a' }
                  : roomSpecialType === 'storage'
                    ? { fill: '#f59e0b', stroke: '#b45309' }
                    : roomWithoutWindows
                      ? { fill: '#94a3b8', stroke: '#475569' }
                      : null;
            const fillBaseColor = specialPalette?.fill || baseColor;
            const strokeBaseColor = specialPalette?.stroke || baseColor;
            const fillOpacity = specialPalette ? 0.17 : 0.08;
            const stats = roomStatsById?.get(room.id);
            const userCount = stats?.userCount || 0;
            const rawCapacity = Number((room as any).capacity);
            const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
            const capacityText = `${userCount}/${capacity}`;
            const overCapacity = userCount > capacity;
            const showName = (room as any).showName !== false;
            const roomName = getLocalizedName(room as any);
            const highlightActive = !!(
              highlightRoomId &&
              highlightRoomUntil &&
              highlightRoomId === room.id &&
              highlightRoomUntil > roomHighlightNow
            );
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(roomHighlightNow / 80) : 0;
            const stroke = highlightActive ? '#22d3ee' : isSelectedRoom ? '#2563eb' : strokeBaseColor;
            const strokeWidth = highlightActive ? 2 + 0.8 * pulse : isSelectedRoom ? 2 : 1.1;
            if (kind === 'poly') {
              const pts = room.points || [];
              const labelBounds = getPolygonLabelBounds(pts);
              const flat = pts.flatMap((p) => [p.x, p.y]);
              return (
                <Group
                  key={room.id}
                  ref={(node) => {
                    if (node) roomNodeRefs.current[room.id] = node;
                    else delete roomNodeRefs.current[room.id];
                  }}
                  draggable={!readOnly && !panToolActive}
                  onDragStart={(e) => {
                    roomDragRef.current = {
                      roomId: room.id,
                      kind: 'poly',
                      startX: e.target.x(),
                      startY: e.target.y(),
                      node: e.target,
                      cancelled: false
                    };
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    const world = pos
                      ? pointerToWorld(pos.x, pos.y)
                      : pts[0] || { x: 0, y: 0 };
                    const multi = !!((e.evt as any)?.ctrlKey || (e.evt as any)?.metaKey || (e.evt as any)?.shiftKey);
                    onSelectRoom?.(room.id, { multi, worldX: world.x, worldY: world.y });
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    if (readOnly) return;
                    onSelectRoom?.(room.id);
                    onOpenRoomDetails?.(room.id);
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                    if (isBoxSelecting()) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    const fallbackPoint = labelBounds
                      ? { x: Number(labelBounds.x) + Number(labelBounds.width) / 2, y: Number(labelBounds.y) + Number(labelBounds.height) / 2 }
                      : pts[0] || { x: 0, y: 0 };
                    const world = pos ? pointerToWorld(pos.x, pos.y) : fallbackPoint;
                    lastContextMenuAtRef.current = Date.now();
                    const currentSelectedRoomIds = Array.isArray(selectedRoomIds) ? selectedRoomIds : [];
                    const preserveSelection = currentSelectedRoomIds.includes(room.id) && currentSelectedRoomIds.length > 1;
                    if (!preserveSelection) {
                      onSelectRoom?.(room.id, { keepContext: true, preserveSelection: false, worldX: world.x, worldY: world.y });
                    }
                    onRoomContextMenu?.({ id: room.id, clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
                  }}
                  onDragEnd={(e) => {
                    if (readOnly) return;
                    const active = roomDragRef.current;
                    if (active && active.roomId === room.id) {
                      roomDragRef.current = null;
                      if (active.cancelled) {
                        e.target.position({ x: active.startX, y: active.startY });
                        e.target.getLayer()?.batchDraw?.();
                        return;
                      }
                    }
                    const node = e.target;
                    const dx = node.x();
                    const dy = node.y();
                    node.position({ x: 0, y: 0 });
                    node.getLayer()?.batchDraw?.();
                    if (!dx && !dy) return;
                    onUpdateRoom?.(room.id, { kind: 'poly', points: pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
                  }}
                >
                  <Line
                    ref={(node) => {
                      if (node) polyLineRefs.current[room.id] = node;
                      else delete polyLineRefs.current[room.id];
                    }}
                    points={flat}
                    closed
                    fill={hexToRgba(fillBaseColor, fillOpacity)}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    dash={[5, 4]}
                    lineJoin="round"
                  />
                  <Group
                    listening={false}
                    clipFunc={(ctx) => {
                      if (!pts.length) return;
                      ctx.beginPath();
                      ctx.moveTo(pts[0].x, pts[0].y);
                      for (let i = 1; i < pts.length; i++) {
                        ctx.lineTo(pts[i].x, pts[i].y);
                      }
                      ctx.closePath();
                    }}
                  >
                    {renderRoomLabels({
                      bounds: labelBounds,
                      name: roomName,
                      showName,
                      capacityText,
                      overCapacity,
                      labelScale: (room as any).labelScale,
                      labelPosition: (room as any).labelPosition
                    })}
                  </Group>
                  {isSelectedRoom && !readOnly && !roomDrawMode
                    ? pts.map((p, idx) => (
                        <Circle
                          key={`${room.id}:${idx}`}
                          ref={(node) => {
                            if (!polyVertexRefs.current[room.id]) polyVertexRefs.current[room.id] = {};
                            if (node) polyVertexRefs.current[room.id][idx] = node;
                            else if (polyVertexRefs.current[room.id]) delete polyVertexRefs.current[room.id][idx];
                          }}
                          x={p.x}
                          y={p.y}
                          radius={3.5}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={1.2}
                          draggable={!panToolActive}
                          onDragMove={() => {
                            const line = polyLineRefs.current[room.id];
                            const verts = polyVertexRefs.current[room.id];
                            if (!line || !verts) return;
                            const next = Object.keys(verts)
                              .map((k) => Number(k))
                              .sort((a, b) => a - b)
                              .flatMap((i) => [verts[i].x(), verts[i].y()]);
                            line.points(next);
                            line.getLayer()?.batchDraw?.();
                          }}
                          onDragEnd={() => {
                            const verts = polyVertexRefs.current[room.id];
                            if (!verts) return;
                            const nextPoints = Object.keys(verts)
                              .map((k) => Number(k))
                              .sort((a, b) => a - b)
                              .map((i) => ({ x: verts[i].x(), y: verts[i].y() }));
                            onUpdateRoom?.(room.id, { kind: 'poly', points: nextPoints });
                          }}
                        />
                      ))
                    : null}
                </Group>
              );
            }
            const bounds = { x: 0, y: 0, width: room.width || 0, height: room.height || 0 };
            return (
              <Group
                key={room.id}
                ref={(node) => {
                  if (node) roomNodeRefs.current[room.id] = node;
                  else delete roomNodeRefs.current[room.id];
                }}
                x={room.x || 0}
                y={room.y || 0}
                draggable={!readOnly && !panToolActive && !pendingType}
                onDragStart={(e) => {
                  roomDragRef.current = {
                    roomId: room.id,
                    kind: 'rect',
                    startX: e.target.x(),
                    startY: e.target.y(),
                    node: e.target,
                    cancelled: false
                  };
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: Number(room.x || 0) + Number(room.width || 0) / 2, y: Number(room.y || 0) + Number(room.height || 0) / 2 };
                  const multi = !!((e.evt as any)?.ctrlKey || (e.evt as any)?.metaKey || (e.evt as any)?.shiftKey);
                  onSelectRoom?.(room.id, { multi, worldX: world.x, worldY: world.y });
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  if (readOnly) return;
                  onSelectRoom?.(room.id);
                  onOpenRoomDetails?.(room.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if ((e.evt as any)?.metaKey) return;
                  if (isBoxSelecting()) return;
                  const stage = e.target.getStage();
                  const pos = stage?.getPointerPosition();
                  const world = pos
                    ? pointerToWorld(pos.x, pos.y)
                    : { x: Number(room.x || 0) + Number(room.width || 0) / 2, y: Number(room.y || 0) + Number(room.height || 0) / 2 };
                  lastContextMenuAtRef.current = Date.now();
                  const currentSelectedRoomIds = Array.isArray(selectedRoomIds) ? selectedRoomIds : [];
                  const preserveSelection = currentSelectedRoomIds.includes(room.id) && currentSelectedRoomIds.length > 1;
                  if (!preserveSelection) {
                    onSelectRoom?.(room.id, { keepContext: true, preserveSelection: false, worldX: world.x, worldY: world.y });
                  }
                  onRoomContextMenu?.({ id: room.id, clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
                }}
                onDragEnd={(e) => {
                  if (readOnly) return;
                  const node = e.target;
                  const active = roomDragRef.current;
                  if (active && active.roomId === room.id) {
                    roomDragRef.current = null;
                    if (active.cancelled) {
                      node.position({ x: active.startX, y: active.startY });
                      node.getLayer()?.batchDraw?.();
                      return;
                    }
                  }
                  onUpdateRoom?.(room.id, {
                    kind: 'rect',
                    x: node.x(),
                    y: node.y(),
                    width: room.width || 0,
                    height: room.height || 0
                  });
                }}
              >
                <Rect
                  ref={(node) => {
                    if (isSelectedRoom) selectedRoomNodeRef.current = node;
                  }}
                  x={0}
                  y={0}
                  width={room.width || 0}
                  height={room.height || 0}
                  fill={hexToRgba(fillBaseColor, fillOpacity)}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  dash={[5, 4]}
                  cornerRadius={6}
                  onTransformEnd={(e) => {
                    if (readOnly) return;
                    const node = e.target as any;
                    const group = node.getParent();
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const nextX = (group?.x() || 0) + node.x();
                    const nextY = (group?.y() || 0) + node.y();
                    node.scaleX(1);
                    node.scaleY(1);
                    node.position({ x: 0, y: 0 });
                    onUpdateRoom?.(room.id, {
                      kind: 'rect',
                      x: nextX,
                      y: nextY,
                      width: Math.max(10, node.width() * scaleX),
                      height: Math.max(10, node.height() * scaleY)
                    });
                  }}
                />
                <Group
                  listening={false}
                  clipFunc={(ctx) => {
                    ctx.beginPath();
                    ctx.rect(0, 0, Number(room.width || 0), Number(room.height || 0));
                    ctx.closePath();
                  }}
                >
                    {renderRoomLabels({
                      bounds,
                      name: roomName,
                      showName,
                    capacityText,
                    overCapacity,
                    labelScale: (room as any).labelScale,
                    labelPosition: (room as any).labelPosition
                  })}
                </Group>
              </Group>
            );
          })}

          {selectedRoomId &&
          !roomDrawMode &&
          !readOnly &&
          (() => {
            const r = (plan.rooms || []).find((x) => x.id === selectedRoomId);
            const k = (r?.kind || (r?.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            return k === 'rect';
          })() ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              keepRatio={false}
              boundBoxFunc={(_oldBox: any, newBox: any) => {
                if (newBox.width < 10 || newBox.height < 10) return _oldBox;
                return newBox;
              }}
            />
          ) : null}

          {/* Print area overlay (optional) */}
          {printArea && (printAreaMode || showPrintArea) ? (
            <Rect
              x={printArea.x}
              y={printArea.y}
              width={printArea.width}
              height={printArea.height}
              stroke="#0ea5e9"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
          {draftPrintRect ? (
            <Rect
              x={draftPrintRect.x}
              y={draftPrintRect.y}
              width={draftPrintRect.width}
              height={draftPrintRect.height}
              fill="rgba(14,165,233,0.06)"
              stroke="#0ea5e9"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
          {textDraftRect ? (
            <Rect
              x={textDraftRect.x}
              y={textDraftRect.y}
              width={textDraftRect.width}
              height={textDraftRect.height}
              fill="rgba(37,99,235,0.08)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 4]}
              listening={false}
              cornerRadius={6}
            />
          ) : null}
          {draftRect ? (
            <Rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.width}
              height={draftRect.height}
              fill="rgba(37,99,235,0.08)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
          {roomDrawMode === 'rect'
            ? ((plan.rooms || []) as any[]).flatMap((room: any) => {
                const points = getRoomPolygonPoints(room);
                if (!points.length) return [];
                return points.map((p, idx) => (
                  <Rect
                    key={`room-corner-anchor:${room?.id || 'room'}:${idx}`}
                    x={p.x - 3}
                    y={p.y - 3}
                    width={6}
                    height={6}
                    cornerRadius={1.2}
                    fill="rgba(148,163,184,0.18)"
                    stroke="rgba(51,65,85,0.55)"
                    strokeWidth={0.8}
                    listening={false}
                  />
                ));
              })
            : null}
          {roomDrawMode === 'rect' && roomRectSnapHint ? (
            <Group x={roomRectSnapHint.x} y={roomRectSnapHint.y} listening={false}>
              <Rect x={-5} y={-5} width={10} height={10} cornerRadius={1.8} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth={1.2} />
              <Rect x={-2.1} y={-2.1} width={4.2} height={4.2} cornerRadius={0.8} fill="#ffffff" stroke="#2563eb" strokeWidth={0.9} />
            </Group>
          ) : null}

          {/* Draft poly */}
          {previewDraftPolyLine ? (
            <Line
              points={previewDraftPolyLine}
              closed={draftPolyPoints.length >= 3}
              fill="rgba(37,99,235,0.06)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 6]}
              lineJoin="round"
              listening={false}
            />
          ) : null}
          {previewCorridorDraftPolyLine ? (
            <Line
              points={previewCorridorDraftPolyLine}
              closed={corridorDraftPolyPoints.length >= 3}
              fill="rgba(14,116,144,0.08)"
              stroke="#0e7490"
              strokeWidth={1.5}
              dash={[6, 6]}
              lineJoin="round"
              listening={false}
            />
          ) : null}
          {roomDrawMode === 'poly' && draftPolyPoints.length ? (
            <Circle
              x={draftPolyPoints[0].x}
              y={draftPolyPoints[0].y}
              radius={6}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={1.5}
              listening={false}
            />
          ) : null}
          {corridorDrawMode === 'poly' && corridorDraftPolyPoints.length ? (
            <Circle
              x={corridorDraftPolyPoints[0].x}
              y={corridorDraftPolyPoints[0].y}
              radius={6}
              fill="#ffffff"
              stroke="#0e7490"
              strokeWidth={1.5}
              listening={false}
            />
          ) : null}
        </Layer>

        {/* Walls + links layer */}
        <Layer perfectDrawEnabled={false} listening={!toolMode && !corridorDoorDraftActive}>
          {wallObjects.map((obj) => {
            const pts = obj.points || [];
            if (pts.length < 2) return null;
            const isSelected = selectedIds ? selectedIds.includes(obj.id) : selectedId === obj.id;
            const highlightActive = !!(highlightId && highlightUntil && highlightId === obj.id && highlightUntil > highlightNow);
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(highlightNow / 80) : 0;
            const rawStroke = typeof obj.strokeColor === 'string' && obj.strokeColor.trim() ? obj.strokeColor.trim() : '';
            const typeStroke = getWallTypeColor(obj.type);
            const baseStroke = rawStroke && rawStroke !== WALL_LAYER_COLOR ? rawStroke : typeStroke;
            const baseWidth = clamp(Number(obj.strokeWidth ?? 1) || 1, 1, 12);
            const lineOpacity = clamp(Number(obj.opacity ?? 1) || 1, 0.1, 1);
            const stroke = highlightActive ? '#22d3ee' : isSelected ? '#2563eb' : baseStroke;
            const strokeWidth = highlightActive ? baseWidth + 1 + 2 * pulse : isSelected ? baseWidth + 1 : baseWidth;
            const linePoints = pts.flatMap((p) => [p.x, p.y]);
            const multiSelected = (selectedIds || []).length > 1;
            const allowWallDrag = isSelected && !readOnly && !panToolActive && !toolMode && !multiSelected;
            return (
              <Group
                key={obj.id}
                ref={(node) => {
                  if (node) objectNodeRefs.current[obj.id] = node;
                  else delete objectNodeRefs.current[obj.id];
                }}
                draggable={allowWallDrag}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                }}
                onDragEnd={(e) => {
                  if (!allowWallDrag) return;
                  const node = e.target;
                  const dx = node.x();
                  const dy = node.y();
                  node.position({ x: 0, y: 0 });
                  node.getLayer()?.batchDraw?.();
                  if (!dx && !dy) return;
                  onMoveWall?.(obj.id, dx, dy);
                }}
              >
                <Line
                  points={linePoints}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  lineCap="round"
                  lineJoin="round"
                  hitStrokeWidth={Math.max(12, strokeWidth + 10)}
                  opacity={lineOpacity}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    const isMulti = !!(e.evt.ctrlKey || e.evt.metaKey);
                    onSelect(obj.id, { multi: isMulti });
                    if (onWallClick && !isMulti) {
                      const stage = e.target.getStage();
                      const pos = stage?.getPointerPosition();
                      if (!pos) return;
                      const world = pointerToWorld(pos.x, pos.y);
                      onWallClick({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY, world });
                    }
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    if (!pos) return;
                    const world = pointerToWorld(pos.x, pos.y);
                    const segment = nearestWallSegment(pts, world);
                    if (!segment) return;
                    onWallSegmentDblClick?.({ id: obj.id, lengthPx: segment.length });
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                    if (isBoxSelecting()) return;
                    lastContextMenuAtRef.current = Date.now();
                    const multiSelected = (selectedIds || []).length > 1;
                    const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                    if (!isSelected || !multiSelected) {
                      onSelect(obj.id, { keepContext: true, multi: multiKey });
                    }
                    if (pendingType || readOnly) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    const world = pos ? pointerToWorld(pos.x, pos.y) : null;
                    const segment = world ? nearestWallSegment(pts, world) : null;
                    onContextMenu({
                      id: obj.id,
                      clientX: e.evt.clientX,
                      clientY: e.evt.clientY,
                      wallSegmentLengthPx: segment?.length
                    });
                  }}
                />
              </Group>
            );
          })}
          {quoteObjects.map((obj) => {
            const pts = obj.points || [];
            if (pts.length < 2) return null;
            const displayPts = quoteResizePreview?.id === obj.id ? quoteResizePreview.points : pts;
            if (displayPts.length < 2) return null;
            const start = displayPts[0];
            const end = displayPts[displayPts.length - 1];
            const isSelected = !!selectedIds?.includes(obj.id);
            const baseStroke = typeof obj.strokeColor === 'string' && obj.strokeColor.trim() ? obj.strokeColor.trim() : '#f97316';
            const stroke = isSelected ? '#2563eb' : baseStroke;
            const scale = clamp(Number(obj.scale ?? 1) || 1, 0.5, 1.6);
            const labelScale = clamp(Number((obj as any).quoteLabelScale ?? 1) || 1, 0.6, 2);
            const strokeWidth = clamp((Number(obj.strokeWidth ?? 2) || 2) * scale, 0.8, 6);
            const opacity = clamp(Number(obj.opacity ?? 1) || 1, 0.2, 1);
            const pointerSize = Math.max(4, Math.round(5 * scale));
            const labelFontSize = Math.max(8, Math.round(9 * labelScale));
            const labelPadding = Math.max(6, Math.round(8 * labelScale));
            const computedLabel = (() => {
              const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
              const lengthLabel =
                Number.isFinite(metersPerPixel) && (metersPerPixel as number) > 0
                  ? `${(lengthPx * (metersPerPixel as number)).toFixed(2)} m`
                  : `${Math.round(lengthPx)} px`;
              const name = String(obj.name || '').trim();
              return name && lengthLabel ? `${name} · ${lengthLabel}` : name || lengthLabel;
            })();
            const label = quoteLabels?.[obj.id] || computedLabel;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const textW = label ? estimateTextWidth(label, labelFontSize) + labelPadding : 0;
            const textH = Math.max(12, Math.round(14 * labelScale));
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const orientation = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
            const labelPos = (obj as any).quoteLabelPos || 'center';
            const labelBg = labelPos === 'center' || (obj as any).quoteLabelBg === true;
            const labelColor = String((obj as any).quoteLabelColor || '#0f172a');
            const labelOffset = Number((obj as any).quoteLabelOffset);
            const labelOffsetFactor = Number.isFinite(labelOffset) && labelOffset > 0 ? labelOffset : 1;
            const normalizedOffsetFactor = Math.abs(labelOffsetFactor - 1.15) < 0.001 ? 1 : labelOffsetFactor;
            const baseOffset = Math.max(6, Math.round(6 * labelScale));
            const perpSize = textH;
            const offsetDist = (baseOffset + perpSize / 2) * normalizedOffsetFactor;
            let offsetX = 0;
            let offsetY = 0;
            if (orientation === 'vertical') {
              if (labelPos === 'left') offsetX = -offsetDist;
              if (labelPos === 'right') offsetX = offsetDist;
            } else {
              if (labelPos === 'above') offsetY = -offsetDist;
              if (labelPos === 'below') offsetY = offsetDist;
            }
            const endpoint = (obj as any).quoteEndpoint || 'arrows';
            const dashed = !!(obj as any).quoteDashed;
            const dash = dashed ? [8 * scale, 6 * scale] : undefined;
            const isResizing = quoteResizePreview?.id === obj.id;
            return (
              <Group
                key={obj.id}
                draggable={isSelected && !readOnly && !panToolActive && !toolMode && !isResizing}
                onDragStart={() => {
                  if (!isSelected || !onMoveStart) return;
                  onMoveStart(obj.id, obj.x ?? start.x, obj.y ?? start.y, obj.roomId);
                }}
                onDragEnd={(e) => {
                  if (!isSelected || !onMove) return;
                  const dx = e.target.x();
                  const dy = e.target.y();
                  e.target.position({ x: 0, y: 0 });
                  if (!dx && !dy) return;
                  const baseX = Number.isFinite(obj.x) ? obj.x : start.x;
                  const baseY = Number.isFinite(obj.y) ? obj.y : start.y;
                  onMove(obj.id, baseX + dx, baseY + dy);
                }}
              >
                {endpoint === 'arrows' ? (
                  <Arrow
                    points={[start.x, start.y, end.x, end.y]}
                    stroke={stroke}
                    fill={stroke}
                    pointerLength={pointerSize}
                    pointerWidth={pointerSize}
                    pointerAtBeginning
                    pointerAtEnding
                    strokeWidth={strokeWidth}
                    dash={dash}
                    hitStrokeWidth={Math.max(10, strokeWidth + 8)}
                    opacity={opacity}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (e.evt?.button !== 0) return;
                      onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (readOnly || toolMode) return;
                      onEdit(obj.id);
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                      if (isBoxSelecting()) return;
                      lastContextMenuAtRef.current = Date.now();
                      const multiSelected = (selectedIds || []).length > 1;
                      const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                      if (!selectedIds?.includes(obj.id) || !multiSelected) {
                        onSelect(obj.id, { keepContext: true, multi: multiKey });
                      }
                      if (pendingType || readOnly) return;
                      onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                  />
                ) : (
                  <>
                    <Line
                      points={[start.x, start.y, end.x, end.y]}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      dash={dash}
                      lineCap="round"
                      hitStrokeWidth={Math.max(10, strokeWidth + 8)}
                      opacity={opacity}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (e.evt?.button !== 0) return;
                        onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                      }}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        if (readOnly || toolMode) return;
                        onEdit(obj.id);
                      }}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        e.cancelBubble = true;
                        if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                        if (isBoxSelecting()) return;
                        lastContextMenuAtRef.current = Date.now();
                        const multiSelected = (selectedIds || []).length > 1;
                        const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                        if (!selectedIds?.includes(obj.id) || !multiSelected) {
                          onSelect(obj.id, { keepContext: true, multi: multiKey });
                        }
                        if (pendingType || readOnly) return;
                        onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                      }}
                    />
                    {endpoint === 'dots' ? (
                      <>
                        <Circle x={start.x} y={start.y} radius={Math.max(2, Math.round(3 * scale))} fill={stroke} opacity={opacity} />
                        <Circle x={end.x} y={end.y} radius={Math.max(2, Math.round(3 * scale))} fill={stroke} opacity={opacity} />
                      </>
                    ) : null}
                  </>
                )}
                {label ? (
                  <Group
                    x={midX + offsetX}
                    y={midY + offsetY}
                    opacity={opacity}
                    rotation={orientation === 'vertical' ? -90 : 0}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (e.evt?.button !== 0) return;
                      onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (readOnly || toolMode) return;
                      onEdit(obj.id);
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                      if (isBoxSelecting()) return;
                      lastContextMenuAtRef.current = Date.now();
                      const multiSelected = (selectedIds || []).length > 1;
                      const multiKey = !!(e.evt.ctrlKey || e.evt.metaKey);
                      if (!selectedIds?.includes(obj.id) || !multiSelected) {
                        onSelect(obj.id, { keepContext: true, multi: multiKey });
                      }
                      if (pendingType || readOnly) return;
                      onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                  >
                    {labelBg ? (
                      <Rect
                        x={-textW / 2}
                        y={-textH / 2}
                        width={textW}
                        height={textH}
                        fill="rgba(255,255,255,0.9)"
                        cornerRadius={4}
                      />
                    ) : null}
                    <Text
                      text={label}
                      x={-textW / 2}
                      y={-textH / 2}
                      width={textW}
                      height={textH}
                      align="center"
                      fontSize={labelFontSize}
                      fontStyle="bold"
                      fill={isSelected ? stroke : labelColor}
                    />
                  </Group>
                ) : null}
                {isSelected && !readOnly && !panToolActive && !toolMode && !!onUpdateQuotePoints ? (
                  <>
                    <Circle
                      x={start.x}
                      y={start.y}
                      radius={Math.max(4, Math.round(4 * scale))}
                      fill="#ffffff"
                      stroke={stroke}
                      strokeWidth={2}
                      onMouseDown={(e) => {
                        if (!onUpdateQuotePoints) return;
                        e.cancelBubble = true;
                        const basePoints = pts.map((p) => ({ x: p.x, y: p.y }));
                        const group = e.target.getParent();
                        group?.stopDrag?.();
                        group?.draggable?.(false);
                        quoteResizeRef.current = { id: obj.id, index: 0, points: basePoints, node: group };
                        setQuoteResizePreview({ id: obj.id, points: basePoints });
                      }}
                    />
                    <Circle
                      x={end.x}
                      y={end.y}
                      radius={Math.max(4, Math.round(4 * scale))}
                      fill="#ffffff"
                      stroke={stroke}
                      strokeWidth={2}
                      onMouseDown={(e) => {
                        if (!onUpdateQuotePoints) return;
                        e.cancelBubble = true;
                        const basePoints = pts.map((p) => ({ x: p.x, y: p.y }));
                        const group = e.target.getParent();
                        group?.stopDrag?.();
                        group?.draggable?.(false);
                        quoteResizeRef.current = { id: obj.id, index: basePoints.length - 1, points: basePoints, node: group };
                        setQuoteResizePreview({ id: obj.id, points: basePoints });
                      }}
                    />
                  </>
                ) : null}
              </Group>
            );
          })}
          {(plan.links || []).map((link) => {
            const from = objectById.get(link.fromId);
            const to = objectById.get(link.toId);
            if (!from || !to) return null;
            const isSelected = !!selectedLinkId && selectedLinkId === link.id;
            const kind = (link as any).kind || 'arrow';
            const arrowMode = (link as any).arrow ?? 'none';
            const arrowStart = arrowMode === 'start' || arrowMode === 'both';
            const arrowEnd = arrowMode === 'end' || arrowMode === 'both';
            const stroke = isSelected ? '#2563eb' : link.color || '#94a3b8';
            const widthRaw = Number((link as any).width);
            const width = Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : 1;
            const selectedWidthDeltaRaw = Number((link as any).selectedWidthDelta);
            const selectedWidthDelta =
              Number.isFinite(selectedWidthDeltaRaw) && selectedWidthDeltaRaw > 0 ? selectedWidthDeltaRaw : 1;
            const dash = (link as any).dashed ? [8, 6] : undefined;
            const route = ((link as any).route || 'vh') as 'vh' | 'hv';

            if (kind === 'cable') {
              const offset = Number((link as any).offset || 0);
              let fromX = from.x;
              let fromY = from.y;
              let toX = to.x;
              let toY = to.y;
              if (offset) {
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.hypot(dx, dy);
                if (len) {
                  const nx = -dy / len;
                  const ny = dx / len;
                  const shiftX = nx * offset;
                  const shiftY = ny * offset;
                  fromX += shiftX;
                  fromY += shiftY;
                  toX += shiftX;
                  toY += shiftY;
                }
              }
              const points =
                route === 'hv'
                  ? [fromX, fromY, toX, fromY, toX, toY]
                  : [fromX, fromY, fromX, toY, toX, toY];

              const label = String((link as any).name || (link as any).label || '').trim();
              const mid = (() => {
                const pts = points;
                let total = 0;
                for (let i = 0; i < pts.length - 2; i += 2) total += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
                const half = total / 2;
                let acc = 0;
                for (let i = 0; i < pts.length - 2; i += 2) {
                  const x1 = pts[i];
                  const y1 = pts[i + 1];
                  const x2 = pts[i + 2];
                  const y2 = pts[i + 3];
                  const seg = Math.hypot(x2 - x1, y2 - y1);
                  if (acc + seg >= half) {
                    const t = seg ? (half - acc) / seg : 0;
                    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
                  }
                  acc += seg;
                }
                return { x: (fromX + toX) / 2, y: (fromY + toY) / 2 };
              })();

              return (
                <Group key={link.id}>
                  <Line
                    points={points}
                    stroke={stroke}
                    strokeWidth={isSelected ? width + selectedWidthDelta : width}
                    hitStrokeWidth={Math.max(14, (isSelected ? width + selectedWidthDelta : width) + 10)}
                    dash={dash as any}
                    lineCap="round"
                    lineJoin="round"
                    opacity={0.9}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      onSelectLink?.(link.id);
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (!onLinkDblClick) return;
                      if (readOnly) return;
                      onSelectLink?.(link.id);
                      onLinkDblClick(link.id);
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                      if (!onLinkContextMenu) return;
                      onSelectLink?.(link.id);
                      onLinkContextMenu({ id: link.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                  />
                  {label ? (
                    <Text
                      text={label}
                      x={mid.x - 120}
                      y={mid.y - 14}
                      width={240}
                      align="center"
                      fontSize={11}
                      fontStyle="bold"
                      fill="#0f172a"
                      listening={false}
                    />
                  ) : null}
                </Group>
              );
            }

            return (
              <Group key={link.id}>
                <Arrow
                  points={[from.x, from.y, to.x, to.y]}
                  stroke={stroke}
                  fill={stroke}
                  pointerLength={arrowStart || arrowEnd ? 8 : 0}
                  pointerWidth={arrowStart || arrowEnd ? 8 : 0}
                  pointerAtBeginning={arrowStart}
                  pointerAtEnding={arrowEnd}
                  strokeWidth={isSelected ? width + selectedWidthDelta : width}
                  hitStrokeWidth={Math.max(14, (isSelected ? width + selectedWidthDelta : width) + 10)}
                  opacity={0.85}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectLink?.(link.id);
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (!onLinkDblClick) return;
                    if (readOnly) return;
                    onSelectLink?.(link.id);
                    onLinkDblClick(link.id);
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                    if (!onLinkContextMenu) return;
                    onSelectLink?.(link.id);
                    onLinkContextMenu({ id: link.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                  }}
                />
                {String(link.name || link.label || '').trim() ? (
                  <Text
                    text={String(link.name || link.label || '').trim()}
                    x={(from.x + to.x) / 2 - 120}
                    y={(from.y + to.y) / 2 - 18}
                    width={240}
                    align="center"
                    fontSize={11}
                    fontStyle="bold"
                    fill="#0f172a"
                    listening={false}
                  />
                ) : null}
              </Group>
            );
          })}
          {/* Room connection doors */}
          {(() => {
            const planRoomDoors = Array.isArray((plan as any)?.roomDoors) ? (((plan as any).roomDoors as RoomConnectionDoor[]).filter(Boolean)) : [];
            if (!planRoomDoors.length) return null;
            const roomsById = new Map<string, any>(((plan.rooms || []) as any[]).map((room: any) => [String(room?.id || ''), room]));
            return planRoomDoors.map((door) => {
              const roomAId = String((door as any)?.roomAId || '').trim();
              const roomBId = String((door as any)?.roomBId || '').trim();
              if (!roomAId || !roomBId || roomAId === roomBId) return null;
              const anchorRoomIdRaw = String((door as any)?.anchorRoomId || '').trim();
              const anchorRoomId = anchorRoomIdRaw === roomAId || anchorRoomIdRaw === roomBId ? anchorRoomIdRaw : roomAId;
              const anchorRoom = roomsById.get(anchorRoomId) || roomsById.get(roomAId) || roomsById.get(roomBId);
              if (!anchorRoom) return null;
              const anchorPoints = getRoomPolygonPoints(anchorRoom);
              const anchor = getRoomEdgePoint(anchorPoints, Number((door as any)?.edgeIndex), Number((door as any)?.t));
              if (!anchor) return null;
              const isDoorSelected = selectedRoomDoorId === door.id;
              const inDraftPair =
                !!roomDoorDraft &&
                ((roomDoorDraft.roomAId === roomAId && roomDoorDraft.roomBId === roomBId) ||
                  (roomDoorDraft.roomAId === roomBId && roomDoorDraft.roomBId === roomAId));
              const doorMode = (door as any).mode === 'auto_sensor' || (door as any).mode === 'automated' ? (door as any).mode : 'static';
              const doorColor = doorMode === 'automated' ? '#16a34a' : doorMode === 'auto_sensor' ? '#2563eb' : '#0f766e';
              const stroke = isDoorSelected ? '#f8fafc' : '#e2e8f0';
              const openContext = (e: any) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                if (isBoxSelecting()) return;
                lastContextMenuAtRef.current = Date.now();
                onSelectRoomDoor?.(door.id);
                onRoomDoorContextMenu?.({ doorId: door.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
              };
              return (
                <Group
                  key={`room-door:${door.id}`}
                  name="room-door-point"
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectRoomDoor?.(door.id);
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectRoomDoor?.(door.id);
                    onRoomDoorDblClick?.(door.id);
                  }}
                  onContextMenu={(e) => {
                    openContext(e);
                  }}
                >
                  <Group x={anchor.x} y={anchor.y}>
                    <Circle radius={11} fill="rgba(15,23,42,0.001)" strokeEnabled={false} />
                    <Rect
                      x={-3.2}
                      y={-4.8}
                      width={6.4}
                      height={9.6}
                      cornerRadius={1.1}
                      fill={doorColor}
                      stroke={stroke}
                      strokeWidth={isDoorSelected ? 1.9 : 1.2}
                    />
                    <Line points={[0, -4.8, 0, 4.8]} stroke={stroke} strokeWidth={isDoorSelected ? 1.5 : 1.1} />
                    {!!(door as any)?.isEmergency ? <Circle x={2.8} y={-5} radius={1.4} fill="#dc2626" stroke="#ffffff" strokeWidth={0.55} /> : null}
                    {inDraftPair ? <Circle x={-2.8} y={-5} radius={1.4} fill="#0ea5e9" stroke="#ffffff" strokeWidth={0.55} /> : null}
                  </Group>
                </Group>
              );
            });
          })()}
          {/* Corridor doors (kept in the same layer to reduce total layer count) */}
          {((plan.corridors || []) as Corridor[]).map((corridor) => {
            const points = getCorridorPolygonPoints(corridor);
            if (points.length < 3) return null;
            const doors = Array.isArray(corridor.doors) ? corridor.doors : [];
            if (!doors.length) return null;
            const isSelectedCorridor = selectedCorridorId === corridor.id;
            const isDraftTarget = corridorDoorDraft?.corridorId === corridor.id;
            return doors.map((door) => {
              const anchor = getCorridorEdgePoint(points, Number(door.edgeIndex), Number(door.t));
              if (!anchor) return null;
              const isDoorSelected = selectedCorridorDoor?.corridorId === corridor.id && selectedCorridorDoor?.doorId === door.id;
              const canDragDoor = (isDoorSelected || isSelectedCorridor) && !readOnly && !isDraftTarget;
              const doorMode = (door as any).mode === 'auto_sensor' || (door as any).mode === 'automated' ? (door as any).mode : 'static';
              const doorColor = doorMode === 'automated' ? '#16a34a' : doorMode === 'auto_sensor' ? '#2563eb' : '#92400e';
              const resolveClientPoint = (e: any): { clientX: number; clientY: number } => {
                const cx = Number((e?.evt as any)?.clientX);
                const cy = Number((e?.evt as any)?.clientY);
                if (Number.isFinite(cx) && Number.isFinite(cy)) return { clientX: cx, clientY: cy };
                const stage = e?.target?.getStage?.();
                const pos = stage?.getPointerPosition?.();
                const rect = stage?.container?.()?.getBoundingClientRect?.();
                if (pos && rect) return { clientX: Number(rect.left + pos.x), clientY: Number(rect.top + pos.y) };
                return { clientX: 0, clientY: 0 };
              };
              const openDoorContextMenu = (e: any) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                if (isBoxSelecting()) return;
                lastContextMenuAtRef.current = Date.now();
                const point = resolveClientPoint(e);
                onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                onCorridorDoorContextMenu?.({
                  corridorId: corridor.id,
                  doorId: door.id,
                  clientX: point.clientX,
                  clientY: point.clientY
                });
              };
              const doorDescription = String((door as any).description || '').trim();
              const emergency = !!(door as any).isEmergency;
              const mainEntrance = !!(door as any).isMainEntrance;
              const isExternal = !!(door as any).isExternal;
              const isFireDoor = !!(door as any).isFireDoor;
              const automationUrl = String((door as any).automationUrl || '').trim();
              const mode = String((door as any).mode || 'static');
              const modeLabel =
                mode === 'automated'
                  ? t({ it: 'Apertura automatizzata', en: 'Automated opening' })
                  : mode === 'auto_sensor'
                    ? t({ it: 'Apertura a rilevazione', en: 'Sensor opening' })
                    : t({ it: 'Statica', en: 'Static' });
              const lastVerificationAt = String((door as any).lastVerificationAt || '').trim();
              const verifierCompany = String((door as any).verifierCompany || '').trim();
              const hoverTextParts = [
                doorDescription ? `${t({ it: 'Descrizione', en: 'Description' })}: ${doorDescription}` : t({ it: 'Porta', en: 'Door' }),
                `${t({ it: 'Modalità', en: 'Mode' })}: ${modeLabel}`,
                emergency ? t({ it: 'Porta antipanico', en: 'Panic door' }) : '',
                mainEntrance ? t({ it: 'Ingresso principale', en: 'Main entrance' }) : '',
                isExternal ? t({ it: 'Porta esterna', en: 'External door' }) : '',
                isFireDoor ? t({ it: 'Tagliafuoco', en: 'Fire door' }) : '',
                automationUrl ? `${t({ it: 'URL apertura', en: 'Open URL' })}: ${automationUrl}` : '',
                emergency && (lastVerificationAt || verifierCompany)
                  ? `${t({ it: 'Ultima revisione', en: 'Latest check' })}: ${lastVerificationAt || '—'}${verifierCompany ? ` · ${verifierCompany}` : ''}`
                  : ''
              ].filter(Boolean);
              const hoverText = hoverTextParts.join(' · ');
              return (
                <Group
                  key={`${corridor.id}:${door.id}`}
                  name="corridor-door-point"
                  corridorId={corridor.id}
                  doorId={door.id}
                  onMouseDown={(e) => {
                    const button = Number((e.evt as any)?.button ?? 0);
                    const isContextIntent = button === 2 || !!(e.evt as any)?.ctrlKey;
                    corridorDoorPointerRef.current = {
                      corridorId: corridor.id,
                      doorId: door.id,
                      allowDrag: !isContextIntent && button === 0
                    };
                    if (!isContextIntent && button === 0) onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                    if (isContextIntent) openDoorContextMenu(e);
                  }}
                  onMouseEnter={(e) => {
                    const point = resolveClientPoint(e);
                    setDoorHoverCard({ clientX: point.clientX, clientY: point.clientY, content: hoverText });
                  }}
                  onMouseMove={(e) => {
                    const point = resolveClientPoint(e);
                    setDoorHoverCard((prev) =>
                      prev
                        ? { ...prev, clientX: point.clientX, clientY: point.clientY, content: hoverText }
                        : { clientX: point.clientX, clientY: point.clientY, content: hoverText }
                    );
                  }}
                  onMouseLeave={() => {
                    setDoorHoverCard(null);
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt?.button !== 0) return;
                    onSelectCorridorDoor?.({ corridorId: corridor.id, doorId: door.id });
                    onCorridorDoorDblClick?.({ corridorId: corridor.id, doorId: door.id });
                  }}
                  onContextMenu={(e) => {
                    openDoorContextMenu(e);
                  }}
                >
                  <Group
                    x={anchor.x}
                    y={anchor.y}
                    draggable={canDragDoor}
                    onDragStart={(e) => {
                      const dragState = corridorDoorPointerRef.current;
                      const allowDrag =
                        !!dragState &&
                        dragState.allowDrag &&
                        dragState.corridorId === corridor.id &&
                        dragState.doorId === door.id;
                      if (allowDrag) return;
                      e.target.stopDrag();
                      e.target.position({ x: anchor.x, y: anchor.y });
                      e.target.getLayer()?.batchDraw?.();
                    }}
                    onContextMenu={(e) => {
                      openDoorContextMenu(e);
                    }}
                    onDragEnd={(e) => {
                      e.cancelBubble = true;
                      const dragState = corridorDoorPointerRef.current;
                      const allowDrag =
                        !!dragState &&
                        dragState.allowDrag &&
                        dragState.corridorId === corridor.id &&
                        dragState.doorId === door.id;
                      if (!allowDrag) {
                        e.target.position({ x: anchor.x, y: anchor.y });
                        e.target.getLayer()?.batchDraw?.();
                        return;
                      }
                      const snap = getClosestCorridorEdgePoint(points, { x: e.target.x(), y: e.target.y() });
                      if (!snap) {
                        e.target.position({ x: anchor.x, y: anchor.y });
                        e.target.getLayer()?.batchDraw?.();
                        return;
                      }
                      const nextDoors = doors.map((entry) =>
                        entry.id === door.id
                          ? {
                              ...entry,
                              edgeIndex: snap.edgeIndex,
                              t: Number(snap.t.toFixed(4))
                            }
                          : entry
                      );
                      onUpdateCorridor?.(corridor.id, { doors: nextDoors as any });
                    }}
                  >
                    <Circle radius={13} fill="rgba(15,23,42,0.001)" strokeEnabled={false} />
                    <Rect
                      x={-3.4}
                      y={-5.1}
                      width={6.8}
                      height={10.2}
                      cornerRadius={1.2}
                      fill={doorColor}
                      stroke={isDoorSelected ? '#f8fafc' : '#e2e8f0'}
                      strokeWidth={isDoorSelected ? 1.6 : 1}
                    />
                    <Line points={[0, -5.1, 0, 5.1]} stroke="#ffffff" strokeWidth={1} />
                    <Circle x={1.3} y={0} radius={0.72} fill="#ffffff" />
                    {emergency ? <Circle x={4.5} y={-4.8} radius={2.2} fill="#dc2626" stroke="#ffffff" strokeWidth={1.2} /> : null}
                  </Group>
                </Group>
              );
            });
          })}
        </Layer>

        {/* Objects layer */}
        <Layer perfectDrawEnabled={false} ref={objectsLayerRef} listening={!toolMode && !corridorDoorDraftActive}>
          {visibleRegularObjects.map((obj) => {
            const isSelected = selectedIds ? selectedIds.includes(obj.id) : selectedId === obj.id;
            const highlightActive = !!(highlightId && highlightUntil && highlightId === obj.id && highlightUntil > highlightNow);
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(highlightNow / 80) : 0;
            const isDesk = isDeskType(obj.type);
            const isText = obj.type === 'text';
            const isImage = obj.type === 'image';
            const isPhoto = obj.type === 'photo';
            const isPostIt = obj.type === 'postit';
            const multiSelected = (selectedIds || []).length > 1;
            const baseScale = Number(obj.scale ?? 1) || 1;
            const scale = isText || isImage ? 1 : baseScale;
            const isCamera = obj.type === 'camera';
            const isWifi = obj.type === 'wifi';
            const isSecurityObject = isSecurityTypeId(obj.type);
            const deskScaleX = isDesk ? clamp(Number(obj.scaleX ?? 1) || 1, 0.4, 4) : 1;
            const deskScaleY = isDesk ? clamp(Number(obj.scaleY ?? 1) || 1, 0.4, 4) : 1;
            const freeScaleX = isText || isImage ? clamp(Number(obj.scaleX ?? 1) || 1, 0.2, 6) : 1;
            const freeScaleY = isText || isImage ? clamp(Number(obj.scaleY ?? 1) || 1, 0.2, 6) : 1;
            const freeRotation = isText || isImage ? Number(obj.rotation || 0) : 0;
            const objectOpacity = typeof obj.opacity === 'number' ? Math.max(0.2, Math.min(1, obj.opacity)) : 1;
            const iconImg = iconImages[obj.type];
            const labelText =
              obj.type === 'real_user' && (((obj as any).firstName && String((obj as any).firstName).trim()) || ((obj as any).lastName && String((obj as any).lastName).trim()))
                ? `${String((obj as any).firstName || '').trim()}\n${String((obj as any).lastName || '').trim()}`.trim()
                : obj.name;
            const labelValue = String(labelText || '').trim();
            const labelLines = labelValue.includes('\n') ? 2 : 1;
            const labelLineHeight = 1.2;
            const labelFontSize = Math.max(4, 10 * scale);
            const labelHeight = labelLines * labelFontSize * labelLineHeight;
            const labelGap = 6;
            const labelY = -(18 * scale) - labelGap - labelHeight;
            const showLabel = !!labelValue && !isText && !isImage && !isPhoto && !isPostIt;
            const outline = highlightActive ? '#22d3ee' : isSelected ? (isPhoto ? '#16a34a' : '#2563eb') : '#cbd5e1';
            const outlineWidth = highlightActive
              ? (3 + 2 * pulse) * SELECTION_STROKE_SCALE
              : isSelected
                ? 3 * SELECTION_STROKE_SCALE
                : 2;
            const deskStrokeColor =
              typeof (obj as any).strokeColor === 'string' && String((obj as any).strokeColor).trim()
                ? String((obj as any).strokeColor).trim()
                : '#cbd5e1';
            const baseDeskStrokeWidth = clamp(Number((obj as any).strokeWidth ?? 2) || 2, 0.5, 6);
            const deskStroke = highlightActive ? '#22d3ee' : isSelected ? '#2563eb' : deskStrokeColor;
            const deskStrokeWidth = highlightActive
              ? baseDeskStrokeWidth + (1 + 2 * pulse) * SELECTION_STROKE_SCALE
              : isSelected
                ? baseDeskStrokeWidth + 1 * SELECTION_STROKE_SCALE
                : baseDeskStrokeWidth;
            const deskSize = 38 * scale;
            const deskHalf = deskSize / 2;
            const deskThickness = 12 * scale;
            const deskRotation = isDesk ? Number(obj.rotation || 0) : 0;
            const cameraRotation = isCamera ? Number(obj.rotation || 0) : 0;
            const textFont = (obj as any).textFont || 'Arial, sans-serif';
            const textSize = clamp(Number((obj as any).textSize ?? 18) || 18, 6, 160);
            const textColor = (obj as any).textColor || '#000000';
            const textBg = !!(obj as any).textBg;
            const textBgColor = (obj as any).textBgColor || '#ffffff';
            const textValue = isText ? String(obj.name || '') : '';
            const textLines = textValue ? textValue.split('\n') : [''];
            const textLineHeight = 1.2;
            const textNaturalWidth = isText
              ? Math.max(40, ...textLines.map((line) => estimateTextWidth(line || ' ', textSize)))
              : 0;
            const textNaturalHeight = isText ? Math.max(textSize, textLines.length * textSize * textLineHeight) : 0;
            const textPadding = Math.max(4, Math.round(textSize * 0.35));
            const baseTextBoxWidth = Number((obj as any).textBoxWidth || 0);
            const baseTextBoxHeight = Number((obj as any).textBoxHeight || 0);
            const fallbackTextBoxWidth = Math.max(TEXT_BOX_DEFAULT_WIDTH, textNaturalWidth + textPadding * 2);
            const fallbackTextBoxHeight = Math.max(TEXT_BOX_DEFAULT_HEIGHT, textNaturalHeight + textPadding * 2);
            const rawTextBoxWidth =
              Number.isFinite(baseTextBoxWidth) && baseTextBoxWidth > 0 ? baseTextBoxWidth : fallbackTextBoxWidth;
            const rawTextBoxHeight =
              Number.isFinite(baseTextBoxHeight) && baseTextBoxHeight > 0 ? baseTextBoxHeight : fallbackTextBoxHeight;
            const textBoxWidth = isText ? Math.max(TEXT_BOX_MIN_WIDTH, rawTextBoxWidth * freeScaleX) : 0;
            const textBoxHeight = isText ? Math.max(TEXT_BOX_MIN_HEIGHT, rawTextBoxHeight * freeScaleY) : 0;
            const textAreaWidth = Math.max(10, textBoxWidth - textPadding * 2);
            const textAreaHeight = Math.max(10, textBoxHeight - textPadding * 2);
            const imageW = Math.max(40, Number((obj as any).imageWidth ?? 160) || 160) * scale;
            const imageH = Math.max(30, Number((obj as any).imageHeight ?? 120) || 120) * scale;
            const postItCompact = !!(obj as any).postitCompact;
            const postItSize = (postItCompact ? 26 : 36) * scale;
            const postItHalf = postItSize / 2;
            const postItFold = postItSize * 0.28;
            const imageNode = isImage ? imageObjects[obj.id] : null;
            const photoSize = 34 * scale;
            const photoHalf = photoSize / 2;
            const photoRadius = Math.max(6, 7 * scale);
            const photoGradient = {
              fillLinearGradientStartPoint: { x: -photoHalf, y: -photoHalf },
              fillLinearGradientEndPoint: { x: photoHalf, y: photoHalf },
              fillLinearGradientColorStops: [0, '#f97316', 0.45, '#22d3ee', 1, '#6366f1']
            };
            const cameraRange = isCamera ? clamp(Number((obj as any).cctvRange ?? 160) || 160, 60, 600) : 0;
            const cameraAngle = isCamera ? clamp(Number((obj as any).cctvAngle ?? 70) || 70, 20, 160) : 0;
            const cameraOpacity = isCamera ? clamp(Number((obj as any).cctvOpacity ?? 0.6) || 0.6, 0.1, 0.9) : 0;
            const cameraOpacityLow = isCamera ? Math.max(0.05, cameraOpacity * 0.15) : 0;
            const cameraOpacityMid = isCamera ? Math.max(0.1, cameraOpacity * 0.55) : 0;
            const cameraFovPoints = isCamera ? buildCameraFovPolygon({ x: obj.x, y: obj.y }, cameraRange, cameraAngle, cameraRotation) : null;
            const showCameraHandle = isCamera && isSelected && !readOnly;
            const cameraHandleDistance = isCamera ? Math.max(22, Math.min(cameraRange * 0.85, cameraRange - 8)) : 0;
            const cameraHandleAngle = (cameraRotation * Math.PI) / 180;
            const cameraHandleX = isCamera ? Math.cos(cameraHandleAngle) * cameraHandleDistance : 0;
            const cameraHandleY = isCamera ? Math.sin(cameraHandleAngle) * cameraHandleDistance : 0;
            const wifiCoverageSqm = isWifi ? Number((obj as any).wifiCoverageSqm || 0) : 0;
            const wifiShowRange = isWifi ? (obj as any).wifiShowRange !== false : false;
            const wifiRangeScale = isWifi ? clamp(Number((obj as any).wifiRangeScale ?? 1) || 1, 0, WIFI_RANGE_SCALE_MAX) : 1;
            const wifiRangePx =
              isWifi && metersPerPixel && Number.isFinite(wifiCoverageSqm) && wifiCoverageSqm > 0
                ? (Math.sqrt(wifiCoverageSqm / Math.PI) * wifiRangeScale) / metersPerPixel
                : 0;
            const wifiRings =
              isWifi && wifiShowRange && wifiRangePx > 0 ? buildWifiRangeRings({ x: obj.x, y: obj.y }, wifiRangePx) : null;
            const bodyOpacity = isCamera ? 1 : objectOpacity;
            const deskRectW = deskSize * 1.45;
            const deskRectH = deskSize * 0.75;
            const deskLongW = deskSize * 1.85;
            const deskLongH = deskSize * 0.6;
            const deskDoubleW = deskSize * 0.7;
            const deskDoubleH = deskSize * 0.95;
            const deskDoubleGap = 4 * scale;
            const deskTrapTop = deskSize * 0.75;
            const deskTrapBottom = deskSize * 1.15;
            const deskTrapHeight = deskSize * 0.75;
            const deskTopLight = '#f9f3e7';
            const deskTopDark = '#e2c79b';
            const deskInsetStroke = 'rgba(255,255,255,0.55)';
            const deskInset = Math.max(1.5, 2 * scale);
            const deskGradient = (w: number, h: number) => ({
              fillLinearGradientStartPoint: { x: -w / 2, y: -h / 2 },
              fillLinearGradientEndPoint: { x: w / 2, y: h / 2 },
              fillLinearGradientColorStops: [0, deskTopLight, 1, deskTopDark]
            });
            const deskBounds = isDesk
              ? getDeskBounds(obj.type, {
                  deskSize,
                  deskRectW,
                  deskRectH,
                  deskLongW,
                  deskLongH,
                  deskDoubleW,
                  deskDoubleH,
                  deskDoubleGap,
                  deskTrapBottom,
                  deskTrapHeight
                })
              : null;
            const rotateHandleRadius = 8;
            const rotateHandleOffset = 10;
            const rotateHandleScaleX = isDesk ? 1 / Math.max(0.2, deskScaleX) : 1;
            const rotateHandleScaleY = isDesk ? 1 / Math.max(0.2, deskScaleY) : 1;
            const rotateHandleScale = 1 / Math.max(0.2, zoom);
            return (
              <Fragment key={obj.id}>
              <Group
                ref={(node) => {
                  if (node) objectNodeRefs.current[obj.id] = node;
                  else delete objectNodeRefs.current[obj.id];
                }}
                x={obj.x}
                y={obj.y}
                scaleX={isDesk ? deskScaleX : isImage ? freeScaleX : 1}
                scaleY={isDesk ? deskScaleY : isImage ? freeScaleY : 1}
                rotation={isText || isImage ? freeRotation : 0}
                draggable={!readOnly && !panToolActive && !toolMode && !(isCamera && cameraRotateId === obj.id)}
                onDragStart={(e) => {
                  if (cameraRotateRef.current?.id === obj.id) {
                    e.cancelBubble = true;
                    e.target.stopDrag?.();
                    return;
                  }
                  dragStartRef.current.set(obj.id, { x: obj.x, y: obj.y });
                  onMoveStart?.(obj.id, obj.x, obj.y, obj.roomId);
                  if (!isSelected) {
                    onSelect(obj.id, { multi: !!(e?.evt?.ctrlKey || e?.evt?.metaKey) });
                  }
                }}
                onMouseEnter={(e) => {
                  if (obj.type !== 'real_user' && obj.type !== 'postit') return;
                  if (perfEnabled) perfMetrics.hoverUpdates += 1;
                  setHoverCard({ clientX: e.evt.clientX, clientY: e.evt.clientY, obj });
                }}
                onMouseMove={(e) => {
                  if (obj.type !== 'real_user' && obj.type !== 'postit') return;
                  pendingHoverRef.current = { clientX: e.evt.clientX, clientY: e.evt.clientY, obj };
                  if (hoverRaf.current) return;
                  hoverRaf.current = requestAnimationFrame(() => {
                    hoverRaf.current = null;
                    const pending = pendingHoverRef.current;
                    if (!pending) return;
                    if (perfEnabled) perfMetrics.hoverUpdates += 1;
                    setHoverCard((prev) =>
                      prev ? { ...prev, clientX: pending.clientX, clientY: pending.clientY } : pending
                    );
                  });
                }}
                onMouseLeave={() => {
                  if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
                  hoverRaf.current = null;
                  pendingHoverRef.current = null;
                  if (perfEnabled) perfMetrics.hoverUpdates += 1;
                  setHoverCard(null);
                }}
                onDragEnd={(e) => {
                  if (readOnly) return;
                  const stage = stageRef.current;
                  if (!stage) {
                    const nextX = snapEnabled ? snap(e.target.x()) : e.target.x();
                    const nextY = snapEnabled ? snap(e.target.y()) : e.target.y();
                    const accepted = onMove(obj.id, nextX, nextY);
                  if (accepted === false) {
                    const prev = dragStartRef.current.get(obj.id);
                    if (prev) {
                      e.target.position({ x: prev.x, y: prev.y });
                      stage?.batchDraw();
                    }
                  }
                    dragStartRef.current.delete(obj.id);
                    return;
                  }
                  const transform = stage.getAbsoluteTransform().copy();
                  transform.invert();
                  const abs = e.target.getAbsolutePosition();
                  const world = transform.point(abs);
                  const nextX = snapEnabled ? snap(world.x) : world.x;
                  const nextY = snapEnabled ? snap(world.y) : world.y;
                  const accepted = onMove(obj.id, nextX, nextY);
                  if (accepted === false) {
                    const prev = dragStartRef.current.get(obj.id);
                    if (prev) {
                      e.target.position({ x: prev.x, y: prev.y });
                      stage?.batchDraw();
                    }
                  }
                  dragStartRef.current.delete(obj.id);
                }}
                onTransform={(e) => {
                  if (readOnly || !onUpdateObject) return;
                  if (!isText) return;
                  const activeAnchor = freeTransformerRef.current?.getActiveAnchor?.();
                  if (activeAnchor === 'rotater') return;
                  const node = e.target as any;
                  const baseWidth = textBoxWidth || TEXT_BOX_DEFAULT_WIDTH;
                  const baseHeight = textBoxHeight || TEXT_BOX_DEFAULT_HEIGHT;
                  const nextWidth = Math.max(TEXT_BOX_MIN_WIDTH, baseWidth * node.scaleX());
                  const nextHeight = Math.max(TEXT_BOX_MIN_HEIGHT, baseHeight * node.scaleY());
                  node.scaleX(1);
                  node.scaleY(1);
                  scheduleTextTransform({ id: obj.id, width: nextWidth, height: nextHeight });
                }}
                onTransformEnd={(e) => {
                  if (readOnly || !onUpdateObject) return;
                  if (!isDesk && !isText && !isImage) return;
                  const node = e.target as any;
                  if (isDesk) {
                    const nextScaleX = clamp(node.scaleX(), 0.4, 4);
                    const nextScaleY = clamp(node.scaleY(), 0.4, 4);
                    node.scaleX(1);
                    node.scaleY(1);
                    onUpdateObject(obj.id, { scaleX: nextScaleX, scaleY: nextScaleY });
                    return;
                  }
                  let nextRotation = Number.isFinite(node.rotation()) ? node.rotation() : 0;
                  if ((e.evt as any)?.shiftKey) {
                    nextRotation = Math.round(nextRotation / 90) * 90;
                    node.rotation(nextRotation);
                  }
                  if (isText) {
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const baseWidth = textBoxWidth || TEXT_BOX_DEFAULT_WIDTH;
                    const baseHeight = textBoxHeight || TEXT_BOX_DEFAULT_HEIGHT;
                    const nextWidth =
                      scaleX !== 1 ? Math.max(TEXT_BOX_MIN_WIDTH, baseWidth * scaleX) : undefined;
                    const nextHeight =
                      scaleY !== 1 ? Math.max(TEXT_BOX_MIN_HEIGHT, baseHeight * scaleY) : undefined;
                    node.scaleX(1);
                    node.scaleY(1);
                    const payload: any = { scaleX: 1, scaleY: 1, rotation: nextRotation };
                    if (nextWidth) payload.textBoxWidth = nextWidth;
                    if (nextHeight) payload.textBoxHeight = nextHeight;
                    onUpdateObject(obj.id, payload);
                    return;
                  }
                  const nextScaleX = clamp(node.scaleX(), 0.2, 6);
                  const nextScaleY = clamp(node.scaleY(), 0.2, 6);
                  node.scaleX(1);
                  node.scaleY(1);
                  onUpdateObject(obj.id, { scaleX: nextScaleX, scaleY: nextScaleY, rotation: nextRotation });
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (typeof e.evt?.button === 'number' && e.evt.button !== 0) return;
                  const multiSelectionActive = (selectedIds || []).length > 1 && (selectedIds || []).includes(obj.id);
                  if (isPhoto && multiSelectionActive && !(e.evt.ctrlKey || e.evt.metaKey)) {
                    return;
                  }
                  if (isPostIt && isSelected && !readOnly) {
                    onUpdateObject?.(obj.id, { postitCompact: !(obj as any).postitCompact });
                  }
                  onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                }}
                onDblClick={(e) => {
                  if (isPhoto) return;
                  e.cancelBubble = true;
                  if (typeof e.evt?.button === 'number' && e.evt.button !== 0) return;
                  if (readOnly) return;
                  onEdit(obj.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                  if (isBoxSelecting()) return;
                  lastContextMenuAtRef.current = Date.now();
                  // If the object is already within a multi-selection, keep the selection as-is.
                  // Otherwise select it (single) before opening the context menu.
                  const multiSelected = (selectedIds || []).length > 1;
                  if (!isSelected || !multiSelected) {
                    onSelect(obj.id, { keepContext: true });
                  }
                  if (pendingType || readOnly) return;
                  onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                }}
              >
                {isCamera && cameraFovPoints ? (
                  <Line
                    points={cameraFovPoints}
                    closed
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndRadius={cameraRange}
                    fillRadialGradientColorStops={[
                      0,
                      `rgba(34,197,94,${cameraOpacity})`,
                      0.6,
                      `rgba(34,197,94,${cameraOpacityMid})`,
                      1,
                      `rgba(34,197,94,${cameraOpacityLow})`
                    ]}
                    opacity={1}
                    listening={false}
                  />
                ) : null}
                {showCameraHandle ? (
                  <Circle
                    x={cameraHandleX}
                    y={cameraHandleY}
                    radius={4}
                    fill="#0f172a"
                    stroke="#f8fafc"
                    strokeWidth={1.5}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      if (readOnly) return;
                      cameraRotateRef.current = { id: obj.id, origin: { x: obj.x, y: obj.y } };
                      setCameraRotateId(obj.id);
                      const stage = e.target.getStage();
                      const pos = stage?.getPointerPosition();
                      if (pos) {
                        const world = pointerToWorld(pos.x, pos.y);
                        scheduleCameraRotation(world, !!e.evt.shiftKey);
                      }
                    }}
                  />
                ) : null}
                {wifiRings ? (
                  <>
                    <Line
                      points={wifiRings.outer}
                      closed
                      fill="rgba(239,68,68,0.12)"
                      listening={false}
                    />
                    <Line
                      points={wifiRings.mid}
                      closed
                      fill="rgba(234,179,8,0.18)"
                      listening={false}
                    />
                    <Line
                      points={wifiRings.inner}
                      closed
                      fill="rgba(34,197,94,0.22)"
                      listening={false}
                    />
                  </>
                ) : null}
                {isDesk ? (
                  <Group rotation={deskRotation} opacity={objectOpacity}>
                    {obj.type === 'desk_round' ? (
                      <>
                        <Circle
                          x={0}
                          y={0}
                          radius={deskHalf}
                          fillRadialGradientStartPoint={{ x: -deskHalf * 0.3, y: -deskHalf * 0.3 }}
                          fillRadialGradientStartRadius={deskHalf * 0.1}
                          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                          fillRadialGradientEndRadius={deskHalf}
                          fillRadialGradientColorStops={[0, '#fdf8ef', 0.7, deskTopLight, 1, deskTopDark]}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Circle
                          x={0}
                          y={0}
                          radius={Math.max(6 * scale, deskHalf - deskInset)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_square' ? (
                      <>
                        <Rect
                          x={-deskHalf}
                          y={-deskHalf}
                          width={deskSize}
                          height={deskSize}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskSize, deskSize)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={-deskHalf + deskInset}
                          width={deskSize - deskInset * 2}
                          height={deskSize - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_rect' ? (
                      <>
                        <Rect
                          x={-deskRectW / 2}
                          y={-deskRectH / 2}
                          width={deskRectW}
                          height={deskRectH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskRectW, deskRectH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskRectW / 2 + deskInset}
                          y={-deskRectH / 2 + deskInset}
                          width={deskRectW - deskInset * 2}
                          height={deskRectH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_double' ? (
                      <>
                        <Rect
                          x={-(deskDoubleW + deskDoubleGap / 2)}
                          y={-deskDoubleH / 2}
                          width={deskDoubleW}
                          height={deskDoubleH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskDoubleW, deskDoubleH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={deskDoubleGap / 2}
                          y={-deskDoubleH / 2}
                          width={deskDoubleW}
                          height={deskDoubleH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskDoubleW, deskDoubleH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-(deskDoubleW + deskDoubleGap / 2) + deskInset}
                          y={-deskDoubleH / 2 + deskInset}
                          width={deskDoubleW - deskInset * 2}
                          height={deskDoubleH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                        <Rect
                          x={deskDoubleGap / 2 + deskInset}
                          y={-deskDoubleH / 2 + deskInset}
                          width={deskDoubleW - deskInset * 2}
                          height={deskDoubleH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_long' ? (
                      <>
                        <Rect
                          x={-deskLongW / 2}
                          y={-deskLongH / 2}
                          width={deskLongW}
                          height={deskLongH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskLongW, deskLongH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskLongW / 2 + deskInset}
                          y={-deskLongH / 2 + deskInset}
                          width={deskLongW - deskInset * 2}
                          height={deskLongH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_trap' ? (
                      <Line
                        points={[
                          -deskTrapTop / 2,
                          -deskTrapHeight / 2,
                          deskTrapTop / 2,
                          -deskTrapHeight / 2,
                          deskTrapBottom / 2,
                          deskTrapHeight / 2,
                          -deskTrapBottom / 2,
                          deskTrapHeight / 2
                        ]}
                        closed
                        {...deskGradient(deskTrapBottom, deskTrapHeight)}
                        stroke={deskStroke}
                        strokeWidth={deskStrokeWidth}
                        strokeScaleEnabled={false}
                        shadowBlur={0}
                        shadowColor="transparent"
                      />
                    ) : obj.type === 'desk_l' ? (
                      <>
                        <Rect
                          x={-deskHalf}
                          y={deskHalf - deskThickness}
                          width={deskSize}
                          height={deskThickness}
                          {...deskGradient(deskSize, deskThickness)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf}
                          y={-deskHalf}
                          width={deskThickness}
                          height={deskSize}
                          {...deskGradient(deskThickness, deskSize)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={deskHalf - deskThickness + deskInset}
                          width={deskSize - deskInset * 2}
                          height={Math.max(2, deskThickness - deskInset * 2)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={-deskHalf + deskInset}
                          width={Math.max(2, deskThickness - deskInset * 2)}
                          height={deskSize - deskInset * 2}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : (
                      <>
                        <Rect
                          x={-deskHalf}
                          y={deskHalf - deskThickness}
                          width={deskSize}
                          height={deskThickness}
                          {...deskGradient(deskSize, deskThickness)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={deskHalf - deskThickness}
                          y={-deskHalf}
                          width={deskThickness}
                          height={deskSize}
                          {...deskGradient(deskThickness, deskSize)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={deskHalf - deskThickness + deskInset}
                          width={deskSize - deskInset * 2}
                          height={Math.max(2, deskThickness - deskInset * 2)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                        <Rect
                          x={deskHalf - deskThickness + deskInset}
                          y={-deskHalf + deskInset}
                          width={Math.max(2, deskThickness - deskInset * 2)}
                          height={deskSize - deskInset * 2}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    )}
                  </Group>
                ) : isText ? (
                  <>
                    {isSelected ? (
                      <Rect
                        x={-textBoxWidth / 2}
                        y={-textBoxHeight / 2}
                        width={textBoxWidth}
                        height={textBoxHeight}
                        stroke="rgba(37,99,235,0.6)"
                        strokeWidth={Math.max(0.6, 1 * SELECTION_STROKE_SCALE)}
                        dash={[6, 6]}
                        listening={false}
                      />
                    ) : null}
                    <Group
                      opacity={objectOpacity}
                      clipX={-textBoxWidth / 2}
                      clipY={-textBoxHeight / 2}
                      clipWidth={textBoxWidth}
                      clipHeight={textBoxHeight}
                    >
                      <Rect
                        x={-textBoxWidth / 2}
                        y={-textBoxHeight / 2}
                        width={textBoxWidth}
                        height={textBoxHeight}
                        fill={textBg ? textBgColor : 'transparent'}
                        cornerRadius={Math.max(4, Math.round(textSize * 0.25))}
                        shadowBlur={0}
                        shadowColor="transparent"
                      />
                      <Text
                        text={textValue}
                        x={-textBoxWidth / 2 + textPadding}
                        y={-textBoxHeight / 2 + textPadding}
                        width={textAreaWidth}
                        height={textAreaHeight}
                        align="left"
                        verticalAlign="middle"
                        wrap="char"
                        lineHeight={textLineHeight}
                        fontSize={textSize}
                        fontFamily={textFont}
                        fill={textColor}
                        shadowBlur={0}
                        shadowColor="transparent"
                      />
                    </Group>
                  </>
                ) : isPhoto ? (
                  <Group opacity={objectOpacity}>
                    <Rect
                      x={-photoHalf}
                      y={-photoHalf}
                      width={photoSize}
                      height={photoSize}
                      cornerRadius={photoRadius}
                      stroke={outline}
                      strokeWidth={outlineWidth}
                      strokeScaleEnabled={false}
                      {...photoGradient}
                    />
                    <Circle x={-photoHalf + photoSize * 0.28} y={-photoHalf + photoSize * 0.28} radius={Math.max(2.2, 2.8 * scale)} fill="rgba(255,255,255,0.9)" />
                    <Line
                      points={[
                        -photoHalf + photoSize * 0.2,
                        photoHalf - photoSize * 0.28,
                        -photoHalf + photoSize * 0.42,
                        photoHalf - photoSize * 0.46,
                        -photoHalf + photoSize * 0.64,
                        photoHalf - photoSize * 0.3
                      ]}
                      stroke="#ffffff"
                      strokeWidth={Math.max(1.2, 1.6 * scale)}
                      lineCap="round"
                      lineJoin="round"
                      strokeScaleEnabled={false}
                    />
                  </Group>
                ) : isImage ? (
                  <Group opacity={objectOpacity}>
                    {imageNode ? (
                      <KonvaImage
                        image={imageNode}
                        x={-imageW / 2}
                        y={-imageH / 2}
                        width={imageW}
                        height={imageH}
                      />
                    ) : (
                      <>
                        <Rect
                          x={-imageW / 2}
                          y={-imageH / 2}
                          width={imageW}
                          height={imageH}
                          stroke="#94a3b8"
                          strokeWidth={1.5}
                          dash={[6, 4]}
                          fill="#ffffff"
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Text
                          text="IMG"
                          x={-imageW / 2}
                          y={-8}
                          width={imageW}
                          align="center"
                          fontSize={12}
                          fontStyle="bold"
                          fill="#94a3b8"
                        />
                      </>
                    )}
                  </Group>
                ) : isPostIt ? (
                  <Group opacity={objectOpacity}>
                    <Rect
                      x={-postItHalf}
                      y={-postItHalf}
                      width={postItSize}
                      height={postItSize}
                      cornerRadius={6 * scale}
                      fill="#fde047"
                      stroke={outline}
                      strokeWidth={outlineWidth}
                      strokeScaleEnabled={false}
                      shadowBlur={0}
                      shadowColor="transparent"
                    />
                    <Line
                      points={[
                        postItHalf - postItFold,
                        -postItHalf,
                        postItHalf,
                        -postItHalf,
                        postItHalf,
                        -postItHalf + postItFold
                      ]}
                      closed
                      fill="#fef08a"
                      stroke={outline}
                      strokeWidth={Math.max(1, outlineWidth * 0.6)}
                      strokeScaleEnabled={false}
                    />
                    <Line
                      points={[
                        -postItHalf + 6 * scale,
                        -postItHalf + postItSize * 0.45,
                        postItHalf - 8 * scale,
                        -postItHalf + postItSize * 0.45
                      ]}
                      stroke="#b45309"
                      strokeWidth={Math.max(1, 1.6 * scale)}
                      strokeLinecap="round"
                      strokeScaleEnabled={false}
                    />
                    <Line
                      points={[
                        -postItHalf + 6 * scale,
                        -postItHalf + postItSize * 0.62,
                        postItHalf - 12 * scale,
                        -postItHalf + postItSize * 0.62
                      ]}
                      stroke="#b45309"
                      strokeWidth={Math.max(1, 1.6 * scale)}
                      strokeLinecap="round"
                      strokeScaleEnabled={false}
                    />
                  </Group>
                ) : (
                  <Group rotation={isCamera ? cameraRotation : 0} opacity={isCamera ? objectOpacity : 1}>
                    <Rect
                      x={-(18 * scale)}
                      y={-(18 * scale)}
                      width={36 * scale}
                      height={36 * scale}
                      cornerRadius={12 * scale}
                      fill={isSecurityObject ? '#fee2e2' : '#ffffff'}
                      stroke={outline}
                      strokeWidth={outlineWidth}
                      opacity={bodyOpacity}
                      shadowBlur={0}
                      shadowColor="transparent"
                    />
                    {iconImg ? (
                      <KonvaImage
                        image={iconImg}
                        x={-9 * scale}
                        y={-9 * scale}
                        width={18 * scale}
                        height={18 * scale}
                        opacity={bodyOpacity}
                        listening={false}
                      />
                    ) : (
                      <Text
                        text={'?'}
                        x={-(18 * scale)}
                        y={-(18 * scale) / 1.2}
                        width={36 * scale}
                        align="center"
                        fontSize={15 * scale}
                        fontStyle="bold"
                        fill={isSecurityObject ? '#dc2626' : '#2563eb'}
                        opacity={bodyOpacity}
                        listening={false}
                      />
                    )}
                  </Group>
                )}
                {isDesk && isSelected && !readOnly && deskBounds && !multiSelected ? (
                  <Group
                    x={deskBounds.width / 2 + rotateHandleOffset}
                    y={-(deskBounds.height / 2 + rotateHandleOffset)}
                    scaleX={rotateHandleScaleX * rotateHandleScale}
                    scaleY={rotateHandleScaleY * rotateHandleScale}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (!onUpdateObject) return;
                      onUpdateObject(obj.id, { rotation: (deskRotation + 90) % 360 });
                    }}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                    }}
                  >
                    <Circle radius={rotateHandleRadius} fill="#0f172a" stroke="#ffffff" strokeWidth={1.5} opacity={0.92} />
                    <Text
                      text="↻"
                      x={-rotateHandleRadius}
                      y={-rotateHandleRadius}
                      width={rotateHandleRadius * 2}
                      height={rotateHandleRadius * 2}
                      align="center"
                      verticalAlign="middle"
                      fontSize={rotateHandleRadius + 2}
                      fontStyle="bold"
                      fill="#ffffff"
                      listening={false}
                    />
                  </Group>
                ) : null}
              </Group>
              {showLabel ? (
                <Text
                  text={labelValue}
                  x={obj.x - 80}
                  y={obj.y + labelY}
                  width={160}
                  align="center"
                  fontStyle="bold"
                  fill="#0f172a"
                  fontSize={labelFontSize}
                  lineHeight={labelLineHeight}
                  shadowBlur={0}
                  shadowColor="transparent"
                  listening={false}
                />
              ) : null}
              </Fragment>
            );
          })}
          {!readOnly ? (
            <>
              <Transformer
                ref={deskTransformerRef}
                rotateEnabled={false}
                keepRatio={false}
                boundBoxFunc={(oldBox: any, newBox: any) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
              <Transformer
                ref={freeTransformerRef}
                rotateEnabled
                keepRatio={false}
                boundBoxFunc={(oldBox: any, newBox: any) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
            </>
          ) : null}
        {/* Overlays (drafts + selection) */}
          {(scaleLine || scaleDraft || wallDraft || measureDraft || quoteDraft || (pendingType && pendingPreview)) ? (
            <>
              {scaleLine ? (() => {
                const scaleOpacity = clamp(Number(scaleLine.opacity ?? 1) || 1, 0.2, 1);
                const scaleLabelScale = clamp(Number(scaleLine.labelScale ?? 1) || 1, 0.6, 1.6);
                const rawLineWidth = Number(scaleLine.strokeWidth ?? 1.2);
                const lineWidth = clamp(Number.isFinite(rawLineWidth) ? rawLineWidth : 1.2, 0.6, 6);
                const dotRadius = Math.max(2, lineWidth + 1);
                const labelFontSize = Math.max(8, Math.round(9 * scaleLabelScale));
                const labelPadding = Math.max(6, Math.round(8 * scaleLabelScale));
                const labelHeight = Math.max(12, Math.round(12 * scaleLabelScale));
                return (
                  <Group
                    draggable={!readOnly && !toolMode && !!onScaleMove}
                    onDragStart={(e) => {
                      if (!onScaleMove || readOnly || toolMode) return;
                      e.cancelBubble = true;
                    }}
                    onDragEnd={(e) => {
                      if (!onScaleMove || !scaleLine || readOnly) return;
                      const node = e.target;
                      const dx = node.x();
                      const dy = node.y();
                      node.position({ x: 0, y: 0 });
                      node.getLayer()?.batchDraw?.();
                      if (!dx && !dy) return;
                      onScaleMove({
                        start: { x: scaleLine.start.x + dx, y: scaleLine.start.y + dy },
                        end: { x: scaleLine.end.x + dx, y: scaleLine.end.y + dy }
                      });
                    }}
                    onContextMenu={(e) => {
                      if (!onScaleContextMenu) return;
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      onScaleContextMenu({ clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                    onDblClick={(e) => {
                      if (!onScaleDoubleClick) return;
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      onScaleDoubleClick();
                    }}
                  >
                    <Line
                      points={[scaleLine.start.x, scaleLine.start.y, scaleLine.end.x, scaleLine.end.y]}
                      stroke="#0f172a"
                      strokeWidth={lineWidth}
                      dash={[6, 4]}
                      lineCap="round"
                      lineJoin="round"
                      opacity={scaleOpacity}
                    />
                    <Circle x={scaleLine.start.x} y={scaleLine.start.y} radius={dotRadius} fill="#0f172a" opacity={scaleOpacity} />
                    <Circle x={scaleLine.end.x} y={scaleLine.end.y} radius={dotRadius} fill="#0f172a" opacity={scaleOpacity} />
                    {scaleLine.label ? (() => {
                      const midX = (scaleLine.start.x + scaleLine.end.x) / 2;
                      const midY = (scaleLine.start.y + scaleLine.end.y) / 2;
                      const textW = estimateTextWidth(scaleLine.label, labelFontSize) + labelPadding;
                      return (
                        <Group
                          x={midX - textW / 2}
                          y={midY - labelHeight - 4}
                          opacity={scaleOpacity}
                          onContextMenu={(e) => {
                            if (!onScaleContextMenu) return;
                            e.evt.preventDefault();
                            e.cancelBubble = true;
                            onScaleContextMenu({ clientX: e.evt.clientX, clientY: e.evt.clientY });
                          }}
                        >
                          <Rect width={textW} height={labelHeight} fill="rgba(15,23,42,0.85)" cornerRadius={4} />
                          <Text
                            text={scaleLine.label}
                            width={textW}
                            height={labelHeight}
                            align="center"
                            verticalAlign="middle"
                            fontSize={labelFontSize}
                            fill="#f8fafc"
                          />
                        </Group>
                      );
                    })() : null}
                  </Group>
                );
              })() : null}
              <Group listening={false}>
              {scaleDraft?.start && (scaleDraft.end || scaleDraft.pointer) ? (
                <>
                  <Line
                    points={[
                      scaleDraft.start.x,
                      scaleDraft.start.y,
                      (scaleDraft.end || scaleDraft.pointer)!.x,
                      (scaleDraft.end || scaleDraft.pointer)!.y
                    ]}
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                    lineCap="round"
                    lineJoin="round"
                  />
                  <Circle x={scaleDraft.start.x} y={scaleDraft.start.y} radius={3} fill="#0ea5e9" opacity={0.85} />
                  {scaleDraft.end ? <Circle x={scaleDraft.end.x} y={scaleDraft.end.y} radius={3} fill="#0ea5e9" opacity={0.85} /> : null}
                </>
              ) : null}

              {wallDraft?.points?.length ? (
                <>
                  <Line
                    points={[
                      ...wallDraft.points.flatMap((p) => [p.x, p.y]),
                      ...(wallDraft.pointer ? [wallDraft.pointer.x, wallDraft.pointer.y] : [])
                    ]}
                    stroke="#475569"
                    strokeWidth={2}
                    dash={[6, 4]}
                    lineCap="round"
                    lineJoin="round"
                  />
                  {wallDraft.points.map((p, idx) => (
                    <Circle key={`wall-draft-${idx}`} x={p.x} y={p.y} radius={3} fill="#475569" opacity={0.9} />
                  ))}
                  {wallDraft.pointer ? (
                    <Circle
                      x={wallDraft.pointer.x}
                      y={wallDraft.pointer.y}
                      radius={4}
                      fill="#0ea5e9"
                      opacity={0.95}
                    />
                  ) : null}
                  {metersPerPixel && wallDraft.pointer ? (() => {
                    const start = wallDraft.points[wallDraft.points.length - 1];
                    if (!start) return null;
                    const end = wallDraft.pointer;
                    const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
                    const meters = lengthPx * metersPerPixel;
                    const unit = t({ it: 'ml', en: 'm' });
                    const label = `${formatMeasure(meters)} ${unit}`;
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    const textW = estimateTextWidth(label, 10) + 10;
                    return (
                      <Group x={midX - textW / 2} y={midY - 18}>
                        <Rect width={textW} height={16} fill="rgba(15,23,42,0.85)" cornerRadius={5} />
                        <Text
                          text={label}
                          width={textW}
                          height={16}
                          align="center"
                          verticalAlign="middle"
                          fontSize={10}
                          fill="#f8fafc"
                        />
                      </Group>
                    );
                  })() : null}
                </>
              ) : wallDraft?.pointer ? (
                <Circle x={wallDraft.pointer.x} y={wallDraft.pointer.y} radius={4} fill="#0ea5e9" opacity={0.95} />
              ) : null}

              {measureDraft?.points?.length ? (
                <>
                  <Line
                    points={[
                      ...measureDraft.points.flatMap((p) => [p.x, p.y]),
                      ...(measureDraft.pointer ? [measureDraft.pointer.x, measureDraft.pointer.y] : [])
                    ]}
                    stroke="#f97316"
                    strokeWidth={2}
                    lineCap="round"
                    lineJoin="round"
                    closed={!!measureDraft.closed}
                    fill={measureDraft.closed ? 'rgba(249,115,22,0.12)' : undefined}
                  />
                  {measureDraft.label ? (() => {
                    const anchor = measureDraft.pointer || measureDraft.points[measureDraft.points.length - 1];
                    const textW = estimateTextWidth(measureDraft.label, 12) + 12;
                    return (
                      <Group x={anchor.x + 8} y={anchor.y - 20}>
                        <Rect width={textW} height={18} fill="rgba(15,23,42,0.85)" cornerRadius={6} />
                        <Text
                          text={measureDraft.label}
                          width={textW}
                          height={18}
                          align="center"
                          verticalAlign="middle"
                          fontSize={12}
                          fill="#f8fafc"
                        />
                      </Group>
                    );
                  })() : null}
                  {measureDraft.areaLabel && measureDraft.closed && measureDraft.points.length >= 3 ? (() => {
                    const centroid = polygonCentroid(measureDraft.points);
                    const textW = estimateTextWidth(measureDraft.areaLabel, 12) + 12;
                    return (
                      <Group x={centroid.x - textW / 2} y={centroid.y - 10}>
                        <Rect width={textW} height={18} fill="rgba(15,23,42,0.85)" cornerRadius={6} />
                        <Text
                          text={measureDraft.areaLabel}
                          width={textW}
                          height={18}
                          align="center"
                          verticalAlign="middle"
                          fontSize={12}
                          fill="#f8fafc"
                        />
                      </Group>
                    );
                  })() : null}
                </>
              ) : null}
              {quoteDraft?.points?.length ? (() => {
                const pts = quoteDraft.pointer ? [...quoteDraft.points, quoteDraft.pointer] : quoteDraft.points;
                if (pts.length < 2) return null;
                const start = pts[0];
                const end = pts[1];
                const label = quoteDraft.label;
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                const textW = label ? estimateTextWidth(label, 10) + 10 : 0;
                return (
                  <>
                    <Arrow
                      points={[start.x, start.y, end.x, end.y]}
                      stroke="#f97316"
                      fill="#f97316"
                      pointerLength={6}
                      pointerWidth={6}
                      pointerAtBeginning
                      strokeWidth={2}
                      opacity={0.9}
                    />
                    {label ? (
                      <Group x={midX - textW / 2} y={midY - 16}>
                        <Rect width={textW} height={16} fill="rgba(255,255,255,0.9)" cornerRadius={5} />
                        <Text text={label} width={textW} height={16} align="center" fontSize={10} fontStyle="bold" fill="#0f172a" />
                      </Group>
                    ) : null}
                  </>
                );
              })() : null}

              {pendingType && pendingPreview && !(pendingType === 'text' && textDraftRect) ? (
                <Group x={pendingPreview.x} y={pendingPreview.y} opacity={0.7}>
                  {pendingType === 'camera' ? (
                    <Wedge
                      radius={160}
                      angle={70}
                      rotation={-35}
                      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                      fillRadialGradientStartRadius={0}
                      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                      fillRadialGradientEndRadius={160}
                      fillRadialGradientColorStops={[
                        0,
                        'rgba(34,197,94,0.08)',
                        0.6,
                        'rgba(34,197,94,0.25)',
                        1,
                        'rgba(34,197,94,0.45)'
                      ]}
                    />
                  ) : null}
                  <Rect
                    x={-18}
                    y={-18}
                    width={36}
                    height={36}
                    cornerRadius={12}
                    fill="#ffffff"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    shadowBlur={0}
                    shadowColor="transparent"
                  />
                  {pendingType ? (
                    pendingType === 'text' ? (
                      <Text
                        text={'T'}
                        x={-18}
                        y={-14}
                        width={36}
                        align="center"
                        fontSize={15}
                        fontStyle="bold"
                        fill={'#2563eb'}
                        opacity={0.9}
                      />
                    ) : pendingType === 'image' ? (
                      <Text
                        text={'IMG'}
                        x={-18}
                        y={-8}
                        width={36}
                        align="center"
                        fontSize={10}
                        fontStyle="bold"
                        fill={'#2563eb'}
                        opacity={0.9}
                      />
                    ) : iconImages[pendingType] ? (
                      <KonvaImage
                        image={iconImages[pendingType] as HTMLImageElement}
                        x={-9}
                        y={-9}
                        width={18}
                        height={18}
                        opacity={0.9}
                      />
                    ) : (
                      <Text
                        text={'?'}
                        x={-18}
                        y={-14}
                        width={36}
                        align="center"
                        fontSize={15}
                        fontStyle="bold"
                        fill={'#2563eb'}
                        opacity={0.9}
                      />
                    )
                  ) : null}
                </Group>
              ) : null}
              </Group>
            </>
          ) : null}

          {safetyCard?.visible && safetyCardDraft ? (
            (() => {
              const cardW = safetyCardDraft.w;
              const cardH = safetyCardDraft.h;
              const headerHeight = Math.max(20, safetyCardDraft.fontSize * 1.48);
              const bodyFontSize = Math.max(8, safetyCardDraft.fontSize);
              const bodyLineHeight = Math.max(12, bodyFontSize * 1.22);
              const titleFontSize = Math.max(9, safetyCardDraft.fontSize * 0.92);
              const titleY = Math.max(4, Math.round((headerHeight - titleFontSize) / 2) + 1);
              const bodyTop = Math.max(headerHeight + 6, Math.round((cardH - bodyLineHeight * 2) / 2 + 3));
              const numbersText = `${safetyCard.numbersLabel}: ${safetyCard.numbersText || safetyCard.noNumbersText}`;
              const pointsText = `${safetyCard.pointsLabel}: ${safetyCard.pointsText || safetyCard.noPointsText}`;
              const colorVariant =
                SAFETY_CARD_COLOR_VARIANTS[((Number(safetyCardDraft.colorIndex) % SAFETY_CARD_COLOR_VARIANTS.length) + SAFETY_CARD_COLOR_VARIANTS.length) % SAFETY_CARD_COLOR_VARIANTS.length];
              const textBgFill =
                SAFETY_CARD_TEXT_BG_VARIANTS[
                  ((Number(safetyCardDraft.textBgIndex) % SAFETY_CARD_TEXT_BG_VARIANTS.length) + SAFETY_CARD_TEXT_BG_VARIANTS.length) %
                    SAFETY_CARD_TEXT_BG_VARIANTS.length
                ];
              const fontFamily = SAFETY_CARD_FONT_VALUES.length
                ? SAFETY_CARD_FONT_VALUES[
                    ((Number(safetyCardDraft.fontIndex) % SAFETY_CARD_FONT_VALUES.length) + SAFETY_CARD_FONT_VALUES.length) %
                      SAFETY_CARD_FONT_VALUES.length
                  ]
                : 'Arial, sans-serif';
              const linePad = 3;
              const textBgWidth = Math.max(24, cardW - 16);
              const textBgHeight = bodyLineHeight + linePad * 2;
              return (
                <>
                  <Group
                    name="safety-card-group"
                    x={safetyCardDraft.x}
                    y={safetyCardDraft.y}
                    draggable={!readOnly && !panToolActive && !toolMode && !pendingType}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      onSelect(undefined);
                      setSafetyCardSelected(true);
                      showSafetyCardHelpToast();
                    }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      showSafetyCardHelpToast();
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      lastContextMenuAtRef.current = Date.now();
                      onSafetyCardContextMenu?.({
                        clientX: e.evt.clientX,
                        clientY: e.evt.clientY,
                        worldX: Number(safetyCardDraft.x || 0),
                        worldY: Number(safetyCardDraft.y || 0)
                      });
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      onSafetyCardDoubleClick?.();
                    }}
                    onDragStart={() => {
                      safetyCardDraggingRef.current = true;
                    }}
                    onDragMove={(e) => {
                      const nextX = e.target.x();
                      const nextY = e.target.y();
                      setSafetyCardDraft((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
                    }}
                    onDragEnd={(e) => {
                      safetyCardDraggingRef.current = false;
                      const nextX = e.target.x();
                      const nextY = e.target.y();
                      const nextLayout = {
                        ...safetyCardDraft,
                        x: nextX,
                        y: nextY
                      };
                      setSafetyCardDraft(nextLayout);
                      onSafetyCardChange?.(nextLayout, { commit: true });
                    }}
                  >
                    <Rect
                      ref={safetyCardRectRef}
                      name="safety-card-body"
                      x={0}
                      y={0}
                      width={cardW}
                      height={cardH}
                      cornerRadius={0}
                      fill={colorVariant.body}
                      stroke={safetyCardSelected ? '#0284c7' : colorVariant.border}
                      strokeWidth={safetyCardSelected ? 2.1 : 1.5}
                      shadowColor="#0c4a6e"
                      shadowBlur={6}
                      shadowOpacity={0.16}
                      shadowOffset={{ x: 0, y: 1 }}
                      onTransformEnd={(e) => {
                        const node = e.target as any;
                        const scaleX = Number(node.scaleX() || 1);
                        const scaleY = Number(node.scaleY() || 1);
                        const nextW = Math.max(220, Number(node.width() || cardW) * scaleX);
                        const nextH = Math.max(56, Number(node.height() || cardH) * scaleY);
                        node.scaleX(1);
                        node.scaleY(1);
                        node.width(nextW);
                        node.height(nextH);
                        const nextLayout = {
                          ...safetyCardDraft,
                          w: nextW,
                          h: nextH
                        };
                        setSafetyCardDraft(nextLayout);
                        onSafetyCardChange?.(nextLayout, { commit: true });
                      }}
                    />
                    <Rect
                      name="safety-card-header"
                      x={1}
                      y={1}
                      width={Math.max(1, cardW - 2)}
                      height={Math.max(1, headerHeight - 2)}
                      cornerRadius={0}
                      fill={colorVariant.header}
                      listening={false}
                    />
                    <Text
                      x={10}
                      y={titleY}
                      width={Math.max(20, cardW - 20)}
                      text={String(safetyCard.title || '')}
                      fontSize={titleFontSize}
                      fontStyle="bold"
                      fontFamily={fontFamily}
                      fill={colorVariant.title}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                    {textBgFill !== 'transparent' ? (
                      <>
                        <Rect
                          x={8}
                          y={bodyTop - linePad}
                          width={textBgWidth}
                          height={textBgHeight}
                          fill={textBgFill}
                          cornerRadius={0}
                          opacity={0.95}
                          listening={false}
                        />
                        <Rect
                          x={8}
                          y={bodyTop + bodyLineHeight - linePad}
                          width={textBgWidth}
                          height={textBgHeight}
                          fill={textBgFill}
                          cornerRadius={0}
                          opacity={0.95}
                          listening={false}
                        />
                      </>
                    ) : null}
                    <Text
                      x={10}
                      y={bodyTop}
                      width={Math.max(20, cardW - 20)}
                      text={numbersText}
                      fontSize={bodyFontSize}
                      fontStyle="bold"
                      fontFamily={fontFamily}
                      fill={colorVariant.text}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                    <Text
                      x={10}
                      y={bodyTop + bodyLineHeight}
                      width={Math.max(20, cardW - 20)}
                      text={pointsText}
                      fontSize={bodyFontSize}
                      fontStyle="bold"
                      fontFamily={fontFamily}
                      fill={colorVariant.text}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                  </Group>
                  {safetyCardSelected && !readOnly ? (
                    <Transformer
                      ref={safetyCardTransformerRef}
                      rotateEnabled={false}
                      keepRatio={false}
                      ignoreStroke
                      borderStroke="#0284c7"
                      borderStrokeWidth={1.2}
                      anchorStroke="#0284c7"
                      anchorFill="#ffffff"
                      anchorCornerRadius={0}
                      anchorSize={8}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        e.cancelBubble = true;
                      }}
                      boundBoxFunc={(oldBox: any, newBox: any) => {
                        if (newBox.width < 220 || newBox.height < 56) return oldBox;
                        return newBox;
                      }}
                    />
                  ) : null}
                </>
              );
            })()
          ) : null}

          {selectionBox ? (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill={SELECTION_FILL}
              stroke={SELECTION_COLOR}
              strokeWidth={1.2}
              dash={SELECTION_DASH}
              listening={false}
              cornerRadius={10}
            />
          ) : null}

          {!readOnly && selectedBounds && (selectedIds || []).length > 1 ? (
            <Group
              x={selectedBounds.minX}
              y={selectedBounds.minY}
              draggable={!panToolActive && !toolMode}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                if (isBoxSelecting()) return;
                const firstId = (selectedIds || [])[0];
                if (!firstId) return;
                lastContextMenuAtRef.current = Date.now();
                onContextMenu({ id: firstId, clientX: e.evt.clientX, clientY: e.evt.clientY });
              }}
              onDragStart={(e) => {
                const startById: Record<string, { x: number; y: number }> = {};
                const ids = selectedIds || [];
                for (const id of ids) {
                  const obj = objectById.get(id);
                  if (!obj) continue;
                  const node = objectNodeRefs.current[id];
                  if (node) {
                    const pos = node.position();
                    startById[id] = { x: pos.x, y: pos.y };
                  } else {
                    startById[id] = { x: obj.x, y: obj.y };
                  }
                }
                const roomStartById: Record<string, { x: number; y: number; kind: 'rect' | 'poly' }> = {};
                for (const roomId of selectedRoomIdsRef.current) {
                  const room = (plan.rooms || []).find((r) => r.id === roomId);
                  if (!room) continue;
                  const node = roomNodeRefs.current[roomId];
                  if (!node) continue;
                  const pos = node.position();
                  const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as
                    | 'rect'
                    | 'poly';
                  roomStartById[roomId] = { x: pos.x, y: pos.y, kind };
                }
                const batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                selectionDragRef.current = { startX: e.target.x(), startY: e.target.y(), startById, batchId, roomStartById };
              }}
              onDragMove={(e) => {
                const ref = selectionDragRef.current;
                if (!ref) return;
                const dx = e.target.x() - ref.startX;
                const dy = e.target.y() - ref.startY;
                for (const [id, start] of Object.entries(ref.startById)) {
                  const node = objectNodeRefs.current[id];
                  if (!node) continue;
                  node.position({ x: start.x + dx, y: start.y + dy });
                }
                if (ref.roomStartById) {
                  for (const [roomId, start] of Object.entries(ref.roomStartById)) {
                    const node = roomNodeRefs.current[roomId];
                    if (!node) continue;
                    node.position({ x: start.x + dx, y: start.y + dy });
                    node.getLayer()?.batchDraw?.();
                  }
                }
                objectsLayerRef.current?.batchDraw?.();
              }}
              onDragEnd={(e) => {
                const ref = selectionDragRef.current;
                selectionDragRef.current = null;
                if (!ref) return;
                const dx = e.target.x() - ref.startX;
                const dy = e.target.y() - ref.startY;
                const movedRoomIds = ref.roomStartById ? Object.keys(ref.roomStartById) : undefined;
                for (const [id, start] of Object.entries(ref.startById)) {
                  const nx = start.x + dx;
                  const ny = start.y + dy;
                  const obj = objectById.get(id);
                  if (obj && wallTypeIdSet.has(obj.type)) {
                    const node = objectNodeRefs.current[id];
                    if (node) {
                      node.position({ x: 0, y: 0 });
                      node.getLayer()?.batchDraw?.();
                    }
                    onMoveWall?.(id, dx, dy, ref.batchId, movedRoomIds);
                  } else {
                    onMove(id, snapEnabled ? snap(nx) : nx, snapEnabled ? snap(ny) : ny);
                  }
                }
                if (ref.roomStartById) {
                  for (const [roomId] of Object.entries(ref.roomStartById)) {
                    const room = (plan.rooms || []).find((r) => r.id === roomId);
                    if (!room) continue;
                    const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as
                      | 'rect'
                      | 'poly';
                    if (kind === 'poly') {
                      const node = roomNodeRefs.current[roomId];
                      if (node) {
                        node.position({ x: 0, y: 0 });
                        node.getLayer()?.batchDraw?.();
                      }
                      const pts = Array.isArray(room.points) ? room.points : [];
                      if (!pts.length) continue;
                      onUpdateRoom?.(roomId, { kind: 'poly', points: pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) });
                    } else {
                      const rx = Number(room.x || 0);
                      const ry = Number(room.y || 0);
                      onUpdateRoom?.(roomId, { kind: 'rect', x: rx + dx, y: ry + dy, width: room.width || 0, height: room.height || 0 });
                    }
                  }
                }
              }}
            >
              {hideMultiSelectionBox ? (
                <Rect
                  x={-12}
                  y={-12}
                  width={selectedBounds.maxX - selectedBounds.minX + 24}
                  height={selectedBounds.maxY - selectedBounds.minY + 24}
                  fill="rgba(0,0,0,0.001)"
                  strokeWidth={0}
                  listening={false}
                />
              ) : (
                <>
                  <Rect
                    x={-14}
                    y={-14}
                    width={selectedBounds.maxX - selectedBounds.minX + 28}
                    height={selectedBounds.maxY - selectedBounds.minY + 28}
                    fill="rgba(0,0,0,0.001)"
                    stroke={SELECTION_GLOW}
                    strokeWidth={4}
                    dash={SELECTION_DASH}
                    cornerRadius={14}
                    listening={false}
                  />
                  <Rect
                    x={-12}
                    y={-12}
                    width={selectedBounds.maxX - selectedBounds.minX + 24}
                    height={selectedBounds.maxY - selectedBounds.minY + 24}
                    fill="rgba(0,0,0,0.001)"
                    stroke="rgba(37,99,235,0.75)"
                    strokeWidth={1.2}
                    dash={SELECTION_DASH}
                    cornerRadius={12}
                    listening={true}
                  />
                </>
              )}
            </Group>
          ) : null}
        </Layer>
      </Stage>
      <div className="absolute right-4 top-4 flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/95 p-2 shadow-card backdrop-blur">
        <button
          title={t({ it: 'Modalità pan', en: 'Pan tool' })}
          aria-pressed={panToolActive}
          onClick={() => onTogglePanTool?.()}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-ink hover:bg-slate-50 ${
            panToolActive ? 'border-primary text-primary' : 'border-slate-200'
          }`}
        >
          <Hand size={16} />
        </button>
	        <button
	          title={t({ it: 'Aumenta zoom', en: 'Zoom in' })}
	          onClick={() => {
	            const nextZoom = clamp(viewportRef.current.zoom * 1.1, 0.2, 3);
	            viewportRef.current = { zoom: nextZoom, pan: viewportRef.current.pan };
	            applyStageTransform(nextZoom, viewportRef.current.pan);
	            scheduleWheelCommit(nextZoom, viewportRef.current.pan);
	          }}
	          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-ink hover:bg-slate-50"
	        >
	          +
	        </button>
	        <button
	          title={t({ it: 'Riduci zoom', en: 'Zoom out' })}
	          onClick={() => {
	            const nextZoom = clamp(viewportRef.current.zoom / 1.1, 0.2, 3);
	            viewportRef.current = { zoom: nextZoom, pan: viewportRef.current.pan };
	            applyStageTransform(nextZoom, viewportRef.current.pan);
	            scheduleWheelCommit(nextZoom, viewportRef.current.pan);
	          }}
	          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-ink hover:bg-slate-50"
	        >
	          -
	        </button>
          {onToggleViewsMenu ? (
            <button
              title={t({ it: 'Viste salvate', en: 'Saved views' })}
              onClick={() => onToggleViewsMenu?.()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-ink hover:bg-slate-50"
            >
              <Eye size={16} />
            </button>
          ) : null}
	        <button
	          title={
              hasDefaultView
                ? t({ it: 'Vai alla vista predefinita', en: 'Go to default view' })
                : t({ it: 'Imposta prima una vista di default', en: 'Set a default view first' })
            }
	          onClick={() => {
              if (!hasDefaultView) return;
              onGoDefaultView?.();
            }}
            disabled={!hasDefaultView}
	          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
	        >
	          VD
	        </button>
	        {onTogglePresentation ? (
	          <button
	            title={
	              presentationMode
	                ? t({ it: 'Esci da presentazione (Esc)', en: 'Exit presentation (Esc)' })
                : t({ it: 'Presentazione (P)', en: 'Presentation (P)' })
            }
            aria-pressed={presentationMode}
            onClick={() => onTogglePresentation?.()}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-slate-50 ${
              presentationMode ? 'border-primary text-primary' : 'border-slate-200 text-ink'
            }`}
	          >
	            <MonitorPlay size={16} />
	          </button>
	        ) : null}
	        {presentationMode && onToggleWebcam ? (
	          <button
	            title={
	              webcamEnabled
	                ? webcamHandDetected
                    ? t({ it: 'Webcam attiva (mano rilevata)', en: 'Webcam enabled (hand detected)' })
                    : t({ it: 'Webcam attiva (nessuna mano)', en: 'Webcam enabled (no hand detected)' })
	                : t({ it: 'Attiva webcam (per gesti)', en: 'Enable webcam (for gestures)' })
	            }
	            aria-pressed={webcamEnabled}
	            onClick={() => onToggleWebcam?.()}
	            className={`flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-slate-50 ${
	              webcamEnabled ? 'border-primary text-primary' : 'border-slate-200 text-ink'
	            }`}
	          >
	            <Video size={16} />
	            {webcamEnabled && webcamReady ? <span className="sr-only">{t({ it: 'Tracking attivo', en: 'Tracking active' })}</span> : null}
	          </button>
	        ) : null}
	        {presentationMode && onCalibrateWebcam ? (
	          <button
	            title={t({ it: 'Calibra (pinch)', en: 'Calibrate (pinch)' })}
	            onClick={() => onCalibrateWebcam?.()}
	            disabled={!webcamEnabled}
	            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
	          >
	            <Crosshair size={16} />
	          </button>
	        ) : null}
      </div>
    </div>
  );
};

const CanvasStage = memo(forwardRef(CanvasStageImpl));
CanvasStage.displayName = 'CanvasStage';
export default CanvasStage;
