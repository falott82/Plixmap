import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage } from 'react-konva';
import { renderToStaticMarkup } from 'react-dom/server';
import useImage from 'use-image';
import { toast } from 'sonner';
import { FloorPlan, IconName, MapObject, MapObjectType } from '../../store/types';
import { isSecurityTypeId } from '../../store/security';
import { useUIStore } from '../../store/useUIStore';
import { clamp } from '../../utils/geometry';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';
import { perfMetrics } from '../../utils/perfMetrics';
import { isDeskType } from './deskTypes';
import { getRoomSpecialType } from '../../utils/roomProperties';
import { CorridorsLayer } from './canvas/CorridorsLayer';
import { RoomsLayer } from './canvas/RoomsLayer';
import { WallsLinksLayer } from './canvas/WallsLinksLayer';
import { ObjectsLayer } from './canvas/ObjectsLayer';
import { CanvasToolbar } from './canvas/CanvasToolbar';
import { useCanvasPrintAreaDraft } from './canvas/useCanvasPrintAreaDraft';
import { useCanvasTextDraft } from './canvas/useCanvasTextDraft';
import { useCanvasCorridorPolyDraft } from './canvas/useCanvasCorridorPolyDraft';
import { useCanvasRoomPolyDraft } from './canvas/useCanvasRoomPolyDraft';
import { useCanvasRoomRectDraft } from './canvas/useCanvasRoomRectDraft';
import { useCanvasSelectionBox } from './canvas/useCanvasSelectionBox';
import { useCanvasPointerHandlers } from './canvas/useCanvasPointerHandlers';
import { useCanvasCameraRotation } from './canvas/useCanvasCameraRotation';
import { useCanvasObjectTransforms } from './canvas/useCanvasObjectTransforms';
import { useCanvasImperativeHandle } from './canvas/useCanvasImperativeHandle';
import { useCanvasSafetyCardActions } from './canvas/useCanvasSafetyCardActions';
import { useCanvasSafetyCardHelpToast } from './canvas/useCanvasSafetyCardHelpToast';
import { useCanvasObjectBounds } from './canvas/useCanvasObjectBounds';
import { useCanvasViewport } from './canvas/useCanvasViewport';
import { renderRoomLabels as renderRoomLabelsImpl } from './canvas/renderRoomLabels';
import {
  hexToRgba,
  formatMeasure,
  SAFETY_CARD_HELP_TOAST_ID,
  sameSafetyCardDraftLayout,
  getDeskBounds,
  getViewportWorldBounds,
  isObjectPotentiallyVisible,
  polygonCentroid,
  getRoomBounds,
  getRoomPolygonPoints,
  getCorridorPolygonPoints,
  getCorridorEdgePoint,
  getClosestCorridorEdgePoint,
  getRoomEdgePoint,
  pointInPolygon,
  nearestWallSegment,
  getPolygonLabelBounds,
  buildWifiRangeRings as buildWifiRangeRingsImpl,
  buildCameraFovPolygon as buildCameraFovPolygonImpl,
  buildWallSegments,
  buildCameraWallSegments,
  buildWifiRayAngles,
  findPhotoAt,
} from './CanvasStage.helpers';

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
  meetingRoomStatusById?: Record<string, { hasMeetingToday?: boolean; inProgress?: boolean; hasFutureToday?: boolean }>;
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
  containerRef: React.RefObject<HTMLDivElement | null>;
  autoFit?: boolean;
  onGoDefaultView?: () => void;
  hasDefaultView?: boolean;
  onToggleViewsMenu?: () => void;
  suspendKeyboardShortcuts?: boolean;
  presentationMode?: boolean;
  onTogglePresentation?: () => void;
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
  onMeetingBadgeContextMenu?: (payload: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onMeetingBadgeDblClick?: (payload: { id: string; clientX: number; clientY: number; worldX: number; worldY: number }) => void;
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
  meetingRoomStatusById = {},
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
  onMeetingBadgeDblClick,
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

  const {
    viewportRef, isPanning, applyStageTransform, commitViewport, scheduleWheelCommit, clampPan,
    fitViewRef, wheelCommitTimer, panRaf, fitApplied, handleWheel, startPan, movePan, endPan,
    isPanGesture, isBoxSelectGesture
  } = useCanvasViewport({
    zoom, pan, stageRef, dimensions, baseWidth, baseHeight, onZoomChange, onPanChange, containerRef,
    presentationMode, plan, autoFit, bgImage, focusTarget, panToolActive, pendingType, roomDrawMode,
    readOnly, corridorDrawMode, printAreaMode, toolMode, perfEnabled
  });
  const objects = plan.objects || [];
  const lastContextMenuAtRef = useRef(0);
  const lastBoxSelectAtRef = useRef(0);
  const [roomHighlightNow, setRoomHighlightNow] = useState(Date.now());
  const [corridorDoorHover, setCorridorDoorHover] = useState<{ edgeIndex: number; t: number; x: number; y: number } | null>(null);
  const corridorDoorDraftActive = !!corridorDoorDraft?.corridorId;

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
  const safetyCardDraftRef = useRef<typeof safetyCardDraft>(null);
  const [safetyCardSelected, setSafetyCardSelected] = useState(false);
  const safetyCardRectRef = useRef<any>(null);
  const safetyCardTransformerRef = useRef<any>(null);
  const safetyCardDraggingRef = useRef(false);
  const objectById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);
  useEffect(() => {
    safetyCardDraftRef.current = safetyCardDraft;
  }, [safetyCardDraft]);
  useEffect(() => {
    if (!safetyCard) {
      if (safetyCardDraftRef.current) {
        safetyCardDraftRef.current = null;
        setSafetyCardDraft(null);
      }
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
    const prev = safetyCardDraftRef.current;
    if (safetyCardDraggingRef.current && prev) return;
    if (sameSafetyCardDraftLayout(prev, next)) return;
    safetyCardDraftRef.current = next;
    setSafetyCardDraft(next);
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
  const { isSafetyCardNode, adjustSafetyCardFont, cycleSafetyCardFont, cycleSafetyCardColor, cycleSafetyCardTextBg } =
    useCanvasSafetyCardActions({ safetyCardDraft, setSafetyCardDraft, onSafetyCardChange });
  const pendingHoverRef = useRef<{ clientX: number; clientY: number; obj: any } | null>(null);
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
  const findPhotoAtPoint = useCallback((x: number, y: number) => findPhotoAt(objects, x, y), [objects]);


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


  const renderRoomLabels = (options: any) => renderRoomLabelsImpl(options, estimateTextWidth);

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
  }, [plan.id, plan.imageUrl, fitApplied]);

  useEffect(() => {
    viewportRef.current = { zoom, pan };
    applyStageTransform(zoom, pan);
    if (wheelCommitTimer.current) {
      window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = null;
    }
  }, [applyStageTransform, zoom, pan, viewportRef, wheelCommitTimer]);


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

  const { draftPolyPoints, previewDraftPolyLine, resetDraftPoly, addDraftPolyPoint, updateDraftPolyPointer } =
    useCanvasRoomPolyDraft({ roomDrawMode, readOnly, perfEnabled, suspendKeyboardShortcuts, onCreateRoom });

  const getRoomRectZoom = useCallback(() => viewportRef.current.zoom, [viewportRef]);
  const {
    draftRect,
    roomRectSnapHint,
    isRectDrafting,
    resetDraftRect,
    clearRoomRectSnapHint,
    beginRectDraft,
    updateDraftRect,
    finalizeDraftRect,
    updateRectSnapPreview
  } = useCanvasRoomRectDraft({ roomDrawMode, readOnly, perfEnabled, rooms: (plan.rooms || []) as any[], getZoom: getRoomRectZoom, onCreateRoom });

  useEffect(() => {
    if (roomDrawMode) return;
    resetDraftRect();
    resetDraftPoly();
  }, [resetDraftRect, resetDraftPoly, roomDrawMode]);

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
      if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
    };
  }, [panRaf, wheelCommitTimer]);

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
  }, [applyStageTransform, clampPan, commitViewport, perfEnabled, containerRef, viewportRef]);

  const toStageCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const x = (localX - viewportRef.current.pan.x) / viewportRef.current.zoom;
    const y = (localY - viewportRef.current.pan.y) / viewportRef.current.zoom;
    return { x, y };
  };

  const pointerToWorld = useCallback((localX: number, localY: number) => ({
    x: (localX - viewportRef.current.pan.x) / viewportRef.current.zoom,
    y: (localY - viewportRef.current.pan.y) / viewportRef.current.zoom
  }), [viewportRef]);

  const { draftPrintRect, beginPrintDraft, updateDraftPrintRect, finalizeDraftPrintRect } = useCanvasPrintAreaDraft({
    printAreaMode,
    readOnly,
    perfEnabled,
    pointerToWorld,
    onSetPrintArea
  });

  const { textDraftRect, isTextDrafting, beginTextDraft, updateTextDraftRect, finalizeTextDraftRect } =
    useCanvasTextDraft({ pointerToWorld });

  const {
    corridorDraftPolyPoints,
    previewCorridorDraftPolyLine,
    undoCorridorDraftSegment,
    addCorridorDraftPolyPoint,
    updateCorridorDraftPointer
  } = useCanvasCorridorPolyDraft({ corridorDrawMode, readOnly, perfEnabled, suspendKeyboardShortcuts, onCreateCorridor });

  const { cameraRotateId, setCameraRotateId, cameraRotateRef, scheduleCameraRotation, stopCameraRotation } =
    useCanvasCameraRotation({ onUpdateObject, readOnly });

  const { quoteResizeRef, quoteResizePreview, setQuoteResizePreview, updateQuoteResizePreview, commitQuoteResize, scheduleTextTransform } =
    useCanvasObjectTransforms({ stageRef, pointerToWorld, onUpdateObject, onUpdateQuotePoints });



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
  }, [pendingType, pointerToWorld]);



  const isContextClick = (evt: any) => evt?.button === 2 || (evt?.button === 0 && !!evt?.ctrlKey);

  const { getObjectBounds, getSelectionCandidates } = useCanvasObjectBounds({ objects, wallTypeIdSet, objectById, estimateTextWidth, objectNodeRefs, stageRef, baseWidth, baseHeight });

  const { selectionBox, isBoxSelecting, beginSelectionBox, updateSelectionBox, finalizeSelectionBox } = useCanvasSelectionBox({
    pointerToWorld,
    perfEnabled,
    getSelectionCandidates,
    getObjectBounds,
    getRoomBounds,
    rooms: (plan.rooms || []) as any[],
    getZoom: getRoomRectZoom,
    onSelect,
    onSelectMany,
    onSelectRooms,
    selectedRoomIdsRef,
    boxSelectionActiveRef,
    lastBoxSelectAtRef
  });

  useCanvasImperativeHandle(ref, { dimensions, stageRef, fitViewRef, objectById, getObjectBounds });

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (readOnly) return;
    const type =
      event.dataTransfer.getData('application/plixmap-type') as MapObjectType;
    if (!type) return;
    const { x, y } = toStageCoords(event.clientX, event.clientY);
    onPlaceNew(type, x, y);
  };

  const backPlate = useMemo(() => {
    return (
      <Group>
        <Rect name="bg-rect" x={0} y={0} width={baseWidth} height={baseHeight} fill="#f8fafc" />
        {bgImage ? <KonvaImage image={bgImage} width={baseWidth} height={baseHeight} opacity={0.96} listening={false} /> : null}
      </Group>
    );
  }, [bgImage, baseWidth, baseHeight]);



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
  const { showSafetyCardHelpToast } = useCanvasSafetyCardHelpToast({ t, readOnly, safetyCard, safetyCardSelected });

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
  const wallSegments = useMemo(() => buildWallSegments(wallObjects, wallAttenuationMap), [wallAttenuationMap, wallObjects]);
  const cameraWallSegments = useMemo(() => buildCameraWallSegments(wallObjects), [wallObjects]);
  const wifiRayAngles = useMemo(() => buildWifiRayAngles(), []);
  const buildWifiRangeRings = useCallback(
    (origin: { x: number; y: number }, baseRadiusPx: number) =>
      buildWifiRangeRingsImpl(origin, baseRadiusPx, wallSegments, wifiRayAngles),
    [wallSegments, wifiRayAngles]
  );
  const buildCameraFovPolygon = useCallback(
    (origin: { x: number; y: number }, rangePx: number, angleDeg: number, rotationDeg: number) =>
      buildCameraFovPolygonImpl(origin, rangePx, angleDeg, rotationDeg, cameraWallSegments),
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
    clearRoomRectSnapHint();
  }, [clearRoomRectSnapHint, readOnly, roomDrawMode]);
  const allowTool = !!toolMode && (!readOnly || toolMode === 'measure');

  const handleZoomIn = () => {
    const nextZoom = clamp(viewportRef.current.zoom * 1.1, 0.2, 3);
    viewportRef.current = { zoom: nextZoom, pan: viewportRef.current.pan };
    applyStageTransform(nextZoom, viewportRef.current.pan);
    scheduleWheelCommit(nextZoom, viewportRef.current.pan);
  };
  const handleZoomOut = () => {
    const nextZoom = clamp(viewportRef.current.zoom / 1.1, 0.2, 3);
    viewportRef.current = { zoom: nextZoom, pan: viewportRef.current.pan };
    applyStageTransform(nextZoom, viewportRef.current.pan);
    scheduleWheelCommit(nextZoom, viewportRef.current.pan);
  };

  const pointerHandlerDeps = {
    corridorDrawMode,
    readOnly,
    isContextClick,
    undoCorridorDraftSegment,
    safetyCardTransformerRef,
    safetyCardSelected,
    isSafetyCardNode,
    setSafetyCardSelected,
    toolMode,
    onWallDraftContextMenu,
    isPanGesture,
    startPan,
    corridorDoorDraft,
    pointerToWorld,
    plan,
    getCorridorPolygonPoints,
    getClosestCorridorEdgePoint,
    onCorridorDoorDraftPoint,
    viewportRef,
    allowTool,
    onToolPoint,
    pendingType,
    beginTextDraft,
    onPlaceNew,
    isBoxSelectGesture,
    roomDrawMode,
    printAreaMode,
    beginSelectionBox,
    beginPrintDraft,
    beginRectDraft,
    addDraftPolyPoint,
    addCorridorDraftPolyPoint,
    onSelect,
    onOpenPhoto,
    findPhotoAtPoint,
    selectedIds,
    selectedId,
    lastPhotoOpenAtRef,
    onToolDoubleClick,
    quoteResizeRef,
    updateQuoteResizePreview,
    isTextDrafting,
    updateTextDraftRect,
    cameraRotateRef,
    scheduleCameraRotation,
    isPanning,
    movePan,
    onToolMove,
    pendingPreviewRef,
    pendingPreviewRaf,
    setPendingPreview,
    corridorDoorHover,
    setCorridorDoorHover,
    updateRectSnapPreview,
    updateSelectionBox,
    updateDraftPrintRect,
    isRectDrafting,
    updateDraftRect,
    updateCorridorDraftPointer,
    updateDraftPolyPointer,
    finalizeTextDraftRect,
    stopCameraRotation,
    finalizeSelectionBox,
    finalizeDraftPrintRect,
    finalizeDraftRect,
    endPan,
    clearRoomRectSnapHint,
    setDoorHoverCard,
    commitQuoteResize
  };
  const { onMouseDown, onDblClick, onMouseMove, onMouseUp, onMouseLeave } = useCanvasPointerHandlers(pointerHandlerDeps);

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
        onMouseDown={onMouseDown}
        onDblClick={onDblClick}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/* Static background layer (non-listening to avoid hit graph work and keep pan/drag fluidity). */}
        <Layer perfectDrawEnabled={false} listening={false}>
          {backPlate}
          {gridLines}
        </Layer>

        {/* Corridors layer */}
        <CorridorsLayer
          {...{
            plan,
            toolMode,
            readOnly,
            panToolActive,
            pendingType,
            selectedCorridorId,
            corridorDoorDraft,
            corridorDoorHover,
            connectionPlanNamesById,
            corridorPattern,
            corridorNodeRefs,
            corridorPolyLineRefs,
            corridorVertexRefs,
            corridorDragRef,
            corridorLabelDragRef,
            hexToRgba,
            getCorridorPolygonPoints,
            getCorridorEdgePoint,
            getClosestCorridorEdgePoint,
            getPolygonLabelBounds,
            getLocalizedName,
            pointInPolygon,
            pointerToWorld,
            isBoxSelecting,
            setDoorHoverCard,
            t,
            onSelectCorridor,
            onSelectCorridorDoor,
            onCorridorClick,
            onCorridorMiddleClick,
            onCorridorContextMenu,
            onCorridorConnectionContextMenu,
            onUpdateCorridor,
            onAdjustCorridorLabelScale
          }}
        />
        {/* Rooms layer */}
        <RoomsLayer
          {...{
            plan,
            toolMode,
            corridorDoorDraftActive,
            roomDrawMode,
            corridorDrawMode,
            readOnly,
            panToolActive,
            pendingType,
            selectedRoomId,
            selectedRoomIds,
            roomStatsById,
            meetingRoomStatusById,
            highlightRoomId,
            highlightRoomUntil,
            roomHighlightNow,
            printArea,
            printAreaMode,
            showPrintArea,
            draftRect,
            draftPrintRect,
            textDraftRect,
            roomRectSnapHint,
            draftPolyPoints,
            corridorDraftPolyPoints,
            previewDraftPolyLine,
            previewCorridorDraftPolyLine,
            roomNodeRefs,
            polyLineRefs,
            polyVertexRefs,
            selectedRoomNodeRef,
            roomDragRef,
            transformerRef,
            lastContextMenuAtRef,
            hexToRgba,
            getPolygonLabelBounds,
            getRoomPolygonPoints,
            getRoomSpecialType,
            getLocalizedName,
            renderRoomLabels,
            pointerToWorld,
            isBoxSelecting,
            setDoorHoverCard,
            t,
            onSelectRoom,
            onOpenRoomDetails,
            onRoomContextMenu,
            onMeetingBadgeDblClick,
            onUpdateRoom
          }}
        />
        {/* Walls + links layer */}
        <WallsLinksLayer
          {...{
            plan,
            wallObjects,
            quoteObjects,
            objectById,
            toolMode,
            corridorDoorDraftActive,
            readOnly,
            panToolActive,
            pendingType,
            selectedId,
            selectedIds,
            selectedLinkId,
            highlightId,
            highlightUntil,
            highlightNow,
            metersPerPixel,
            quoteLabels,
            quoteResizePreview,
            selectedRoomDoorId,
            roomDoorDraft,
            selectedCorridorId,
            corridorDoorDraft,
            selectedCorridorDoor,
            objectNodeRefs,
            quoteResizeRef,
            corridorDoorPointerRef,
            lastContextMenuAtRef,
            pointerToWorld,
            isBoxSelecting,
            nearestWallSegment,
            estimateTextWidth,
            getRoomPolygonPoints,
            getRoomEdgePoint,
            getCorridorPolygonPoints,
            getCorridorEdgePoint,
            getClosestCorridorEdgePoint,
            setQuoteResizePreview,
            setDoorHoverCard,
            t,
            onMoveWall,
            onSelect,
            onWallClick,
            onWallSegmentDblClick,
            onContextMenu,
            onMoveStart,
            onMove,
            onEdit,
            onUpdateQuotePoints,
            onSelectLink,
            onLinkDblClick,
            onLinkContextMenu,
            onSelectRoomDoor,
            onRoomDoorContextMenu,
            onRoomDoorDblClick,
            onSelectCorridorDoor,
            onCorridorDoorContextMenu,
            onCorridorDoorDblClick,
            onUpdateCorridor
          }}
        />
        {/* Objects layer */}
        <ObjectsLayer
          {...{
            plan,
            visibleRegularObjects,
            objectById,
            selectedId,
            selectedIds,
            hideMultiSelectionBox,
            highlightId,
            highlightUntil,
            highlightNow,
            readOnly,
            panToolActive,
            toolMode,
            corridorDoorDraftActive,
            pendingType,
            pendingPreview,
            metersPerPixel,
            snapEnabled,
            zoom,
            perfEnabled,
            iconImages,
            imageObjects,
            cameraRotateId,
            selectedBounds,
            selectionBox,
            wallTypeIdSet,
            wallDraft,
            scaleDraft,
            scaleLine,
            measureDraft,
            quoteDraft,
            textDraftRect,
            safetyCard,
            safetyCardDraft,
            safetyCardSelected,
            objectNodeRefs,
            objectsLayerRef,
            dragStartRef,
            hoverRaf,
            pendingHoverRef,
            cameraRotateRef,
            deskTransformerRef,
            freeTransformerRef,
            safetyCardRectRef,
            safetyCardTransformerRef,
            safetyCardDraggingRef,
            selectionDragRef,
            selectedRoomIdsRef,
            roomNodeRefs,
            lastContextMenuAtRef,
            stageRef,
            estimateTextWidth,
            snap,
            pointerToWorld,
            isBoxSelecting,
            buildCameraFovPolygon,
            buildWifiRangeRings,
            scheduleCameraRotation,
            scheduleTextTransform,
            showSafetyCardHelpToast,
            getDeskBounds,
            polygonCentroid,
            formatMeasure,
            setHoverCard,
            setCameraRotateId,
            setSafetyCardSelected,
            setSafetyCardDraft,
            t,
            onMove,
            onMoveStart,
            onMoveWall,
            onSelect,
            onEdit,
            onUpdateObject,
            onUpdateRoom,
            onScaleMove,
            onScaleContextMenu,
            onScaleDoubleClick,
            onContextMenu,
            onSafetyCardChange,
            onSafetyCardContextMenu,
            onSafetyCardDoubleClick
          }}
        />
      </Stage>
      <CanvasToolbar
        t={t}
        panToolActive={panToolActive}
        onTogglePanTool={onTogglePanTool}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        onToggleViewsMenu={onToggleViewsMenu}
        hasDefaultView={hasDefaultView}
        onGoDefaultView={onGoDefaultView}
        onTogglePresentation={onTogglePresentation}
        presentationMode={presentationMode}
      />
    </div>
  );
};

const CanvasStage = memo(forwardRef(CanvasStageImpl));
CanvasStage.displayName = 'CanvasStage';
export default CanvasStage;
