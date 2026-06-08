import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage } from 'react-konva';
import { renderToStaticMarkup } from 'react-dom/server';
import useImage from 'use-image';
import { toast } from 'sonner';
import { Corridor, FloorPlan, IconName, MapObject, MapObjectType } from '../../store/types';
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
import { spatialCellSize, buildSpatialIndexCells, selectionCandidatesFromIndex } from './canvas/canvasSpatialIndex';
import { renderRoomLabels as renderRoomLabelsImpl } from './canvas/renderRoomLabels';
import {
  hexToRgba,
  formatMeasure,
  TEXT_BOX_MIN_WIDTH,
  TEXT_BOX_MIN_HEIGHT,
  TEXT_BOX_DEFAULT_WIDTH,
  TEXT_BOX_DEFAULT_HEIGHT,
  PHOTO_ICON_BASE_SIZE,
  SAFETY_CARD_HELP_TOAST_ID,
  SAFETY_CARD_COLOR_VARIANTS,
  SAFETY_CARD_TEXT_BG_VARIANTS,
  SAFETY_CARD_FONT_VALUES,
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
  computeObjectBounds as computeObjectBoundsImpl,
  buildWifiRangeRings as buildWifiRangeRingsImpl,
  buildCameraFovPolygon as buildCameraFovPolygonImpl,
  dragRectFromCorners,
  findNearestRoomCorner,
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
  const safetyCardDraftRef = useRef<typeof safetyCardDraft>(null);
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
    (obj: MapObject) => computeObjectBoundsImpl(obj, { wallTypeIdSet, getNodeBounds, estimateTextWidth }),
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

  const getSpatialCellSize = useCallback(() => spatialCellSize(baseWidth, baseHeight), [baseHeight, baseWidth]);

  const buildSpatialIndex = useCallback(() => {
    const version = boundsVersionRef.current;
    const cellSize = getSpatialCellSize();
    const cells = buildSpatialIndexCells(objects, getObjectBounds, cellSize);
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
      return selectionCandidatesFromIndex(rect, getSpatialIndex(), objectById);
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
    const { x, y, width, height } = dragRectFromCorners(x1, y1, x2, y2);
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
    const { x, y, width, height } = dragRectFromCorners(x1, y1, x2, y2);
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
    const { x, y, width, height } = dragRectFromCorners(x1, y1, x2, y2);
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
    (point: { x: number; y: number }) => findNearestRoomCorner((plan.rooms || []) as any[], point, viewportRef.current.zoom),
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
    const { x, y, width, height } = dragRectFromCorners(x1, y1, x2, y2);
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
    setRoomRectSnapHint(null);
  }, [readOnly, roomDrawMode]);
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
