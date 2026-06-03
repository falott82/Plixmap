import type { Dispatch, SetStateAction } from 'react';
import { isDeskType } from './deskTypes';
import { postAuditEvent } from '../../api/audit';
import type { Client, Corridor, FloorPlan, LayerDefinition, MapObject, MapObjectType, Room } from '../../store/types';
import type { useDataStore } from '../../store/useDataStore';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';

type DataStoreState = ReturnType<typeof useDataStore.getState>;

type CapacityConfirmState = {
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
} | null;

type RoomDepartmentConfirmState = {
  objectId: string;
  userName: string;
  x: number;
  y: number;
  roomId: string;
  roomName: string;
  departmentToAdd: string;
} | null;

type TypeLayerModalState = { typeId: string; label: string } | null;

type ContextMenuValue =
  | { kind: 'corridor_door'; corridorId: string; doorId: string; x: number; y: number }
  | { kind: 'corridor'; id: string; x: number; y: number; worldX: number; worldY: number }
  | { kind: 'room'; id: string; x: number; y: number; worldX: number; worldY: number }
  | { kind: 'map'; x: number; y: number; worldX: number; worldY: number };

// Pure computations extracted from usePlanView. Bodies are verbatim; closed-over values (including
// stable refs and local helpers absent from the original dep array, e.g. getRoomIdAt/isUserType)
// are passed in via `deps`. The hook wrappers and their dep arrays stay unchanged.

export type HandleStageMoveDeps = {
  collectUserDepartments: (obj: MapObject) => string[];
  getUserObjectLabel: (obj: MapObject) => string;
  markTouched: () => void;
  moveObject: DataStoreState['moveObject'];
  notifyNonPeopleRoomBlocked: () => void;
  resolveRoomAssignmentForObject: (
    roomId: string | undefined | null,
    objectType: unknown,
    roomList?: Room[]
  ) => string | undefined;
  roomStatsById: Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }>;
  t: ReturnType<typeof useT>;
  updateObject: DataStoreState['updateObject'];
  isReadOnlyRef: { current: boolean };
  planRef: { current: FloorPlan | undefined };
  dragStartRef: { current: Map<string, { x: number; y: number; roomId?: string }> };
  getRoomIdAt: (rooms: any[] | undefined, x: number, y: number) => string | undefined;
  isUserType: (type: unknown) => boolean;
  setCapacityConfirm: Dispatch<SetStateAction<CapacityConfirmState>>;
  setRoomDepartmentConfirm: Dispatch<SetStateAction<RoomDepartmentConfirmState>>;
};

export const computeHandleStageMove = (id: string, x: number, y: number, deps: HandleStageMoveDeps) => {
  const {
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
  } = deps;
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
  const rawNextRoomId = !isReadOnlyRef.current && currentPlan ? getRoomIdAt(currentPlan.rooms, x, y) : undefined;
  const nextRoomId = currentPlan
    ? resolveRoomAssignmentForObject(rawNextRoomId, currentObj.type, (currentPlan.rooms || []) as Room[])
    : rawNextRoomId;
  const currentRoomId = currentObj.roomId ?? undefined;
  if (rawNextRoomId && !nextRoomId && isUserType(currentObj.type)) {
    notifyNonPeopleRoomBlocked();
    return false;
  }
  if (
    nextRoomId &&
    nextRoomId !== currentRoomId &&
    (currentObj.type === 'user' || currentObj.type === 'real_user' || currentObj.type === 'generic_user')
  ) {
    const room = (currentPlan?.rooms || []).find((r) => r.id === nextRoomId);
    const rawCapacity = Number(room?.capacity);
    const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
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
    const roomDepartmentTags = Array.isArray((room as any)?.departmentTags)
      ? ((room as any).departmentTags as any[])
          .map((tag) => String(tag || '').trim())
          .filter(Boolean)
      : [];
    const roomDepartmentSet = new Set(roomDepartmentTags.map((tag) => tag.toLocaleLowerCase()));
    const missingDepartment = collectUserDepartments(currentObj).find(
      (dept) => !roomDepartmentSet.has(dept.toLocaleLowerCase())
    );
    if (missingDepartment) {
      setRoomDepartmentConfirm({
        objectId: String(currentObj.id || ''),
        userName: getUserObjectLabel(currentObj),
        x,
        y,
        roomId: nextRoomId,
        roomName: room?.name || t({ it: 'Stanza', en: 'Room' }),
        departmentToAdd: missingDepartment
      });
      return false;
    }
  }
  moveObject(id, x, y);
  if (currentRoomId !== nextRoomId) {
    updateObject(id, { roomId: nextRoomId });
  }
  dragStartRef.current.delete(id);
  return true;
};

export type HandleMapContextMenuDeps = {
  clearSelection: () => void;
  createRoomDoorFromDraft: (roomId: string, point: { x: number; y: number }) => boolean;
  dismissSelectionHintToasts: () => void;
  effectiveVisibleLayerIds: string[];
  push: (message: string, tone?: ToastTone) => void;
  renderPlan: FloorPlan | undefined;
  roomDoorDraft: { roomAId: string; roomBId: string } | null;
  t: ReturnType<typeof useT>;
  toolMode: 'scale' | 'wall' | 'quote' | 'measure' | null;
  zoom: number;
  getCorridorIdAt: (corridors: any[] | undefined, x: number, y: number) => string | undefined;
  getRoomIdAt: (rooms: any[] | undefined, x: number, y: number) => string | undefined;
  roomLayerNoticeRef: { current: number };
  setSelectedRoomDoorId: Dispatch<SetStateAction<string | null>>;
  setSelectedCorridorDoor: Dispatch<SetStateAction<{ corridorId: string; doorId: string } | null>>;
  setSelectedCorridorId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedLinkId: Dispatch<SetStateAction<string | null>>;
  setSelectedRoomId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedRoomIds: Dispatch<SetStateAction<string[]>>;
  setContextMenu: (value: ContextMenuValue) => void;
};

export const computeHandleMapContextMenu = (
  { clientX, clientY, worldX, worldY }: { clientX: number; clientY: number; worldX: number; worldY: number },
  deps: HandleMapContextMenuDeps
) => {
  const {
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
  } = deps;
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
};

export type HandleCreateTypeLayerDeps = {
  canManageLayers: boolean;
  client: Client | undefined;
  getTypeLayerIds: (typeId: string) => string[] | null;
  inferDefaultLayerIds: (typeId: string, layerIdSet?: Set<string>) => string[];
  isReadOnly: boolean;
  layerIdSet: Set<string>;
  markTouched: () => void;
  planLayers: LayerDefinition[];
  push: (message: string, tone?: ToastTone) => void;
  setPlanDirty?: (planId: string, dirty: boolean) => void;
  t: ReturnType<typeof useT>;
  typeLayerColor: string;
  typeLayerModal: TypeLayerModalState;
  typeLayerName: string;
  updateClientLayers: DataStoreState['updateClientLayers'];
  setTypeLayerModal: Dispatch<SetStateAction<TypeLayerModalState>>;
};

export const computeHandleCreateTypeLayer = (deps: HandleCreateTypeLayerDeps) => {
  const {
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
    updateClientLayers,
    setTypeLayerModal
  } = deps;
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
  updateClientLayers(client.id, nextLayers as LayerDefinition[], { updateObjects });
  for (const site of client.sites || []) {
    for (const plan of site.floorPlans || []) {
      setPlanDirty?.(plan.id, true);
    }
  }
  push(t({ it: 'Layer creato', en: 'Layer created' }), 'success');
  setTypeLayerModal(null);
};

export type HandleStageSelectDeps = {
  addLink: DataStoreState['addLink'];
  clearSelection: () => void;
  linkCreateMode: 'arrow' | 'cable';
  linkFromId: string | null;
  markTouched: () => void;
  panToolActive: boolean;
  push: (message: string, tone?: ToastTone) => void;
  corridorDrawMode: unknown;
  roomDrawMode: unknown;
  setPanToolActive: (value: boolean) => void;
  setSelectedCorridorId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedObject: (id: string) => void;
  t: ReturnType<typeof useT>;
  toggleSelectedObject: (id: string) => void;
  isReadOnlyRef: { current: boolean };
  planRef: { current: FloorPlan | undefined };
  selectedObjectIdsRef: { current: string[] };
  selectedObjectIdRef: { current: string | undefined };
  setRoomDrawMode: (value: null) => void;
  setNewRoomMenuOpen: (value: boolean) => void;
  setCorridorDrawMode: (value: null) => void;
  setLinkFromId: (value: string | null) => void;
  setCableModal: (value: { mode: 'create'; fromId: string; toId: string }) => void;
  setSelectedRoomId: (value: string | undefined) => void;
  setSelectedRoomIds: (value: string[]) => void;
  setSelectedCorridorDoor: (value: null) => void;
  setSelectedRoomDoorId: (value: null) => void;
  setCorridorQuickMenu: (value: null) => void;
  setSelectedLinkId: (value: null) => void;
  setContextMenu: (value: null) => void;
};

export const computeHandleStageSelect = (
  id: string | undefined,
  options: { keepContext?: boolean; multi?: boolean } | undefined,
  deps: HandleStageSelectDeps
) => {
  const {
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
  } = deps;
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
      if (!options?.keepContext) {
        clearSelection();
      }
    } else {
      setSelectedObject(id);
    }
  }
  if (!options?.keepContext) {
    setContextMenu(null);
  }
};
