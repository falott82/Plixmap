// Constants, draft/bounds types and the ObjectsLayerProps interface extracted
// from ObjectsLayer.tsx.
import { FloorPlan, MapObject, MapObjectType } from '../../../store/types';
import { TEXT_FONT_OPTIONS } from '../../../store/data';

export const TEXT_BOX_MIN_WIDTH = 80;
export const TEXT_BOX_MIN_HEIGHT = 32;
export const TEXT_BOX_DEFAULT_WIDTH = 160;
export const TEXT_BOX_DEFAULT_HEIGHT = 56;
export const SELECTION_STROKE_SCALE = 0.6;
export const SELECTION_COLOR = '#2563eb';
export const SELECTION_FILL = 'rgba(37,99,235,0.1)';
export const SELECTION_GLOW = 'rgba(37,99,235,0.18)';
export const SELECTION_DASH = [6, 6];
export const SAFETY_CARD_COLOR_VARIANTS = [
  { body: '#e0f2fe', header: '#bae6fd', border: '#0ea5e9', title: '#075985', text: '#0f172a' },
  { body: '#ecfeff', header: '#cffafe', border: '#06b6d4', title: '#0e7490', text: '#0f172a' },
  { body: '#dbeafe', header: '#bfdbfe', border: '#3b82f6', title: '#1d4ed8', text: '#0f172a' },
  { body: '#f0f9ff', header: '#e0f2fe', border: '#0284c7', title: '#0c4a6e', text: '#111827' }
] as const;
export const SAFETY_CARD_TEXT_BG_VARIANTS = ['transparent', '#ecfeff', '#dbeafe', '#e0f2fe'] as const;
export const SAFETY_CARD_FONT_VALUES = (TEXT_FONT_OPTIONS || []).map((entry) => String(entry.value || '').trim()).filter(Boolean);

export type SafetyCardDraft = {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontIndex: number;
  colorIndex: number;
  textBgIndex: number;
} | null;

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export interface ObjectsLayerProps {
  plan: FloorPlan;
  visibleRegularObjects: MapObject[];
  objectById: Map<string, MapObject>;
  selectedId?: string;
  selectedIds?: string[];
  hideMultiSelectionBox?: boolean;
  highlightId?: string;
  highlightUntil?: number;
  highlightNow: number;
  readOnly?: boolean;
  panToolActive?: boolean;
  toolMode?: 'scale' | 'wall' | 'measure' | 'quote' | null;
  corridorDoorDraftActive: boolean;
  pendingType?: MapObjectType | null;
  pendingPreview: { x: number; y: number } | null;
  metersPerPixel?: number | null;
  snapEnabled?: boolean;
  zoom: number;
  perfEnabled?: boolean;
  iconImages: Record<string, HTMLImageElement | null>;
  imageObjects: Record<string, HTMLImageElement | null>;
  cameraRotateId: string | null;
  selectedBounds: Bounds | null;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  wallTypeIdSet: Set<string>;
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
  textDraftRect: { x: number; y: number; width: number; height: number } | null;
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
  safetyCardDraft: SafetyCardDraft;
  safetyCardSelected: boolean;
  objectNodeRefs: React.MutableRefObject<Record<string, any>>;
  objectsLayerRef: React.MutableRefObject<any>;
  dragStartRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  hoverRaf: React.MutableRefObject<number | null>;
  pendingHoverRef: React.MutableRefObject<{ clientX: number; clientY: number; obj: any } | null>;
  cameraRotateRef: React.MutableRefObject<{ id: string; origin: { x: number; y: number } } | null>;
  deskTransformerRef: React.MutableRefObject<any>;
  freeTransformerRef: React.MutableRefObject<any>;
  safetyCardRectRef: React.MutableRefObject<any>;
  safetyCardTransformerRef: React.MutableRefObject<any>;
  safetyCardDraggingRef: React.MutableRefObject<boolean>;
  selectionDragRef: React.MutableRefObject<{
    startX: number;
    startY: number;
    startById: Record<string, { x: number; y: number }>;
    batchId: string;
    roomStartById?: Record<string, { x: number; y: number; kind: 'rect' | 'poly' }>;
  } | null>;
  selectedRoomIdsRef: React.MutableRefObject<string[]>;
  roomNodeRefs: React.MutableRefObject<Record<string, any>>;
  lastContextMenuAtRef: React.MutableRefObject<number>;
  stageRef: React.MutableRefObject<any>;
  estimateTextWidth: (text: string, fontSize: number) => number;
  snap: (value: number) => number;
  pointerToWorld: (localX: number, localY: number) => { x: number; y: number };
  isBoxSelecting: () => boolean;
  buildCameraFovPolygon: (
    origin: { x: number; y: number },
    rangePx: number,
    angleDeg: number,
    rotationDeg: number
  ) => number[] | null;
  buildWifiRangeRings: (
    origin: { x: number; y: number },
    baseRadiusPx: number
  ) => { outer: number[]; mid: number[]; inner: number[] };
  scheduleCameraRotation: (world: { x: number; y: number }, shiftKey?: boolean) => void;
  scheduleTextTransform: (payload: { id: string; width: number; height: number }) => void;
  showSafetyCardHelpToast: () => void;
  getDeskBounds: (
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
  ) => { width: number; height: number };
  polygonCentroid: (points: { x: number; y: number }[]) => { x: number; y: number };
  formatMeasure: (value: number) => string;
  setHoverCard: React.Dispatch<React.SetStateAction<null | { clientX: number; clientY: number; obj: any }>>;
  setCameraRotateId: React.Dispatch<React.SetStateAction<string | null>>;
  setSafetyCardSelected: React.Dispatch<React.SetStateAction<boolean>>;
  setSafetyCardDraft: React.Dispatch<React.SetStateAction<SafetyCardDraft>>;
  t: (m: { it: string; en: string }) => string;
  onMove: (id: string, x: number, y: number) => boolean | void;
  onMoveStart?: (id: string, x: number, y: number, roomId?: string) => void;
  onMoveWall?: (id: string, dx: number, dy: number, batchId?: string, movedRoomIds?: string[]) => void;
  onSelect: (id?: string, options?: { keepContext?: boolean; multi?: boolean }) => void;
  onEdit: (id: string) => void;
  onUpdateObject?: (
    id: string,
    changes: Partial<
      Pick<MapObject, 'scaleX' | 'scaleY' | 'rotation' | 'postitCompact' | 'textBoxWidth' | 'textBoxHeight' | 'textBg'>
    >
  ) => void;
  onUpdateRoom?: (roomId: string, payload: any) => void;
  onScaleMove?: (payload: { start: { x: number; y: number }; end: { x: number; y: number } }) => void;
  onScaleContextMenu?: (payload: { clientX: number; clientY: number }) => void;
  onScaleDoubleClick?: () => void;
  onContextMenu: (payload: { id: string; clientX: number; clientY: number; wallSegmentLengthPx?: number }) => void;
  onSafetyCardChange?: (
    layout: { x: number; y: number; w: number; h: number; fontSize: number; fontIndex?: number; colorIndex?: number; textBgIndex?: number },
    options?: { commit?: boolean }
  ) => void;
  onSafetyCardContextMenu?: (payload: { clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onSafetyCardDoubleClick?: () => void;
}
