import type { Dispatch, SetStateAction } from 'react';
import { DEFAULT_WALL_TYPES } from '../../store/data';
import { getRoomPolygon, projectPointToSegment } from './planViewUtils';
import { getWallTypeColor } from '../../utils/wallColors';
import { isNonPeopleRoom } from '../../utils/roomProperties';
import type { FloorPlan, Room } from '../../store/types';
import type { useDataStore } from '../../store/useDataStore';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';

type Pt = { x: number; y: number };
type DataStoreState = ReturnType<typeof useDataStore.getState>;

type RoomWallTypeModalState = {
  roomId: string;
  roomName: string;
  segments: { start: Pt; end: Pt; label: string }[];
  mode?: 'create' | 'edit';
  wallIds?: string[];
  wallTypes?: string[];
} | null;

// Pure computations extracted from usePlanView. Bodies are verbatim; the closed-over values are
// passed in via `deps`, mirroring each hook's original dependency array (refs are also passed,
// they are stable). The hook wrappers and their dep arrays stay unchanged.

export type SnapRoomRectDeps = {
  plan: FloorPlan | undefined;
};

export const computeSnapRoomRectToAdjacentSide = (
  inputRect: { x: number; y: number; width: number; height: number },
  deps: SnapRoomRectDeps
) => {
  const { plan } = deps;
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
};

export type OpenEditRoomDeps = {
  rooms: Room[];
  isReadOnly: boolean;
  setRoomModal: Dispatch<SetStateAction<RoomModalState>>;
};

// Populate the room-edit modal from an existing room's properties. Verbatim.
export const computeOpenEditRoom = (
  roomId: string,
  options: { openDepartments?: boolean } | undefined,
  deps: OpenEditRoomDeps
) => {
  const { rooms, isReadOnly, setRoomModal } = deps;
  const room = rooms.find((r) => r.id === roomId);
  if (!room || isReadOnly) return;
  setRoomModal({
    mode: 'edit',
    roomId,
    openDepartments: !!options?.openDepartments,
    initialName: room.name,
    initialNameEn: (room as any).nameEn,
    initialCapacity: room.capacity,
    initialShowName: room.showName,
    initialSurfaceSqm: room.surfaceSqm,
    initialNotes: room.notes,
    initialLogical: room.logical,
    initialMeetingRoom: !!(room as any).meetingRoom,
    initialMeetingProjector: !!(room as any).meetingProjector,
    initialMeetingTv: !!(room as any).meetingTv,
    initialMeetingVideoConf: !!(room as any).meetingVideoConf,
    initialMeetingCoffeeService: !!(room as any).meetingCoffeeService,
    initialMeetingWhiteboard: !!(room as any).meetingWhiteboard,
    initialNoWindows: !!(room as any).noWindows,
    initialWifiAvailable: !!(room as any).wifiAvailable,
    initialFridgeAvailable: !!(room as any).fridgeAvailable,
    initialStorageRoom: !!(room as any).storageRoom,
    initialBathroom: !!(room as any).bathroom,
    initialTechnicalRoom: !!(room as any).technicalRoom
  });
};

export type CreateRoomFromRectDeps = {
  isReadOnly: boolean;
  snapRoomRectToAdjacentSide: (rect: { x: number; y: number; width: number; height: number }) => { x: number; y: number; width: number; height: number };
  hasRoomOverlap: (room: any, excludeId?: string) => boolean;
  notifyRoomOverlap: () => void;
  setRoomDrawMode: (value: null) => void;
  setRoomModal: Dispatch<SetStateAction<RoomModalState>>;
};

export const computeCreateRoomFromRect = (
  rect: { x: number; y: number; width: number; height: number },
  deps: CreateRoomFromRectDeps
) => {
  const { isReadOnly, snapRoomRectToAdjacentSide, hasRoomOverlap, notifyRoomOverlap, setRoomDrawMode, setRoomModal } = deps;
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

export type CreateRoomFromPolyDeps = {
  isReadOnly: boolean;
  hasRoomOverlap: (room: any, excludeId?: string) => boolean;
  notifyRoomOverlap: () => void;
  setRoomDrawMode: (value: null) => void;
  setRoomModal: Dispatch<SetStateAction<RoomModalState>>;
};

export const computeCreateRoomFromPoly = (points: { x: number; y: number }[], deps: CreateRoomFromPolyDeps) => {
  const { isReadOnly, hasRoomOverlap, notifyRoomOverlap, setRoomDrawMode, setRoomModal } = deps;
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

export type SplitWallAtPointDeps = {
  addWallSegment: (payload: {
    start: Pt;
    end: Pt;
    typeId: string;
    label: string;
    layerIds?: string[];
    strokeColor?: string;
    opacity?: number;
    strokeWidth?: number;
  }) => string | null;
  deleteObject: DataStoreState['deleteObject'];
  getTypeLabel: (typeId: string) => string;
  inferDefaultLayerIds: (typeId: string, layerIdSet?: Set<string>) => string[];
  isReadOnly: boolean;
  isWallType: (typeId: string) => boolean;
  layerIdSet: Set<string>;
  markTouched: () => void;
  projectPointOnSegment: (point: Pt, a: Pt, b: Pt) => Pt;
  renderPlan: FloorPlan | undefined;
  setSelectedObject: (id?: string) => void;
  zoom: number;
  lastInsertedRef: { current: { id: string; name: string } | null };
};

export const computeSplitWallAtPoint = (
  payload: { id: string; point?: { x: number; y: number } },
  deps: SplitWallAtPointDeps
) => {
  const {
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
  } = deps;
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
};

export type CreateRoomWallsDeps = {
  addObject: DataStoreState['addObject'];
  defaultWallTypeId: string;
  ensureObjectLayerVisible: (layerIds: string[] | undefined, name: string | undefined, typeId: string) => void;
  getTypeLabel: (typeId: string) => string;
  inferDefaultLayerIds: (typeId: string, layerIdSet?: Set<string>) => string[];
  isReadOnly: boolean;
  layerIdSet: Set<string>;
  markTouched: () => void;
  push: (message: string, tone?: ToastTone) => void;
  renderPlan: FloorPlan | undefined;
  roomWallTypeModal: RoomWallTypeModalState;
  roomWallTypeSelections: string[];
  t: ReturnType<typeof useT>;
  updateObject: DataStoreState['updateObject'];
  setRoomWallTypeModal: Dispatch<SetStateAction<RoomWallTypeModalState>>;
};

export const computeCreateRoomWalls = (deps: CreateRoomWallsDeps) => {
  const {
    addObject,
    defaultWallTypeId,
    ensureObjectLayerVisible,
    getTypeLabel,
    inferDefaultLayerIds,
    isReadOnly,
    layerIdSet,
    markTouched,
    push,
    renderPlan,
    roomWallTypeModal,
    roomWallTypeSelections,
    t,
    updateObject,
    setRoomWallTypeModal
  } = deps;
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
};

type RoomMeasuresModalState = { roomId: string } | null;

type RoomModalState =
  | { mode: 'create'; kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
  | { mode: 'create'; kind: 'poly'; points: { x: number; y: number }[] }
  | {
      mode: 'edit';
      roomId: string;
      openDepartments?: boolean;
      initialName: string;
      initialNameEn?: string;
      initialCapacity?: number;
      initialShowName?: boolean;
      initialSurfaceSqm?: number;
      initialNotes?: string;
      initialLogical?: boolean;
      initialMeetingRoom?: boolean;
      initialMeetingProjector?: boolean;
      initialMeetingTv?: boolean;
      initialMeetingVideoConf?: boolean;
      initialMeetingCoffeeService?: boolean;
      initialMeetingWhiteboard?: boolean;
      initialNoWindows?: boolean;
      initialWifiAvailable?: boolean;
      initialFridgeAvailable?: boolean;
      initialStorageRoom?: boolean;
      initialBathroom?: boolean;
      initialTechnicalRoom?: boolean;
    }
  | null;

export type RoomMeasuresDataDeps = {
  computePolygonArea: (points: Pt[]) => number;
  computePolylineLength: (points: Pt[]) => number;
  formatCornerLabel: (index: number) => string;
  formatNumber: (value: number) => string;
  lang: 'it' | 'en';
  metersPerPixel: number | null;
  renderPlan: FloorPlan | undefined;
  renderPlanRoomById: Map<string, Room>;
  roomMeasuresModal: RoomMeasuresModalState;
};

export const computeRoomMeasuresData = (deps: RoomMeasuresDataDeps) => {
  const {
    computePolygonArea,
    computePolylineLength,
    formatCornerLabel,
    formatNumber,
    lang,
    metersPerPixel,
    renderPlan,
    renderPlanRoomById,
    roomMeasuresModal
  } = deps;
  if (!roomMeasuresModal || !renderPlan) return null;
  const room = renderPlanRoomById.get(roomMeasuresModal.roomId);
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
  return { roomName: room.name, points, segments, perimeterLabel, areaLabel, scaleMissing };
};

export type RoomModalMetricsDeps = {
  computePolygonArea: (points: Pt[]) => number;
  computePolylineLength: (points: Pt[]) => number;
  formatCornerLabel: (index: number) => string;
  formatNumber: (value: number) => string;
  lang: 'it' | 'en';
  metersPerPixel: number | null;
  renderPlan: FloorPlan | undefined;
  roomModal: RoomModalState;
  renderPlanRoomById: Map<string, Room>;
};

export const computeRoomModalMetrics = (deps: RoomModalMetricsDeps) => {
  const {
    computePolygonArea,
    computePolylineLength,
    formatCornerLabel,
    formatNumber,
    lang,
    metersPerPixel,
    renderPlan,
    roomModal,
    renderPlanRoomById
  } = deps;
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
    const room = renderPlanRoomById.get(roomModal.roomId);
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
};

export type BuildRoomWallSegmentsDeps = {
  formatCornerLabel: (index: number) => string;
};

export const computeBuildRoomWallSegments = (
  room: { kind: 'rect' | 'poly'; rect?: { x: number; y: number; width: number; height: number }; points?: Pt[] },
  deps: BuildRoomWallSegmentsDeps
) => {
  const { formatCornerLabel } = deps;
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
};

export type AddWallSegmentDeps = {
  addObject: DataStoreState['addObject'];
  ensureObjectLayerVisible: (layerIds: string[] | undefined, name: string | undefined, typeId: string) => void;
  inferDefaultLayerIds: (typeId: string, layerIdSet: Set<string>) => string[];
  layerIdSet: Set<string>;
  renderPlan: FloorPlan | undefined;
};

export const computeAddWallSegment = (
  payload: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    typeId: string;
    label: string;
    layerIds?: string[];
    strokeColor?: string;
    opacity?: number;
    strokeWidth?: number;
  },
  deps: AddWallSegmentDeps
) => {
  const { addObject, ensureObjectLayerVisible, inferDefaultLayerIds, layerIdSet, renderPlan } = deps;
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
};

// Pure point-in-room geometry helpers extracted verbatim from usePlanView. No React state is
// closed over; identical behaviour.
export const isPointInPoly = (points: { x: number; y: number }[], x: number, y: number) => {
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

export const isPointInRoom = (room: any, x: number, y: number) => {
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

export function getRoomIdAt(rooms: any[] | undefined, x: number, y: number) {
  const list = rooms || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const room = list[i];
    if (isPointInRoom(room, x, y)) return room.id as string;
  }
  return undefined;
}

export const isUserType = (type: unknown) => {
  const value = String(type || '');
  return value === 'user' || value === 'real_user' || value === 'generic_user';
};

// A room can host users unless it is flagged non-people (storage/bathroom/etc).
export const computeIsRoomAssignableForUsers = (
  roomId: string | undefined | null,
  roomList: Room[] | undefined,
  renderPlanRooms: Room[] | undefined
): boolean => {
  if (!roomId) return true;
  const source = Array.isArray(roomList) ? roomList : renderPlanRooms || [];
  const room = (source || []).find((entry) => entry.id === roomId);
  if (!room) return true;
  return !isNonPeopleRoom(room);
};

// Resolve the effective room assignment for a dropped/moved object: non-user
// objects keep their room; user objects only stay if the room is people-capable.
export const computeResolveRoomAssignmentForObject = (
  roomId: string | undefined | null,
  objectType: unknown,
  roomList: Room[] | undefined,
  renderPlanRooms: Room[] | undefined
): string | undefined => {
  if (!isUserType(objectType)) return roomId || undefined;
  return computeIsRoomAssignableForUsers(roomId || undefined, roomList, renderPlanRooms) ? roomId || undefined : undefined;
};

// Pure polygon-overlap helpers extracted verbatim from usePlanView. No React state closed over.
const cross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

export const segmentsProperlyIntersect = (
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

export const isPointStrictlyInsidePolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]) => {
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

export const polygonsOverlap = (a: { x: number; y: number }[], b: { x: number; y: number }[]) => {
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
