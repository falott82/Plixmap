import type { FloorPlan, MapObject, Room } from '../../store/types';
import type { useDataStore } from '../../store/useDataStore';

type DataStoreState = ReturnType<typeof useDataStore.getState>;
type Pt = { x: number; y: number };

// Pure computations extracted from usePlanView. Bodies are verbatim; closed-over values (including
// stable refs) are passed in via `deps`, mirroring each hook's original dependency array. The hook
// wrappers and their dep arrays stay unchanged.

export type AlignSelectionDeps = {
  getObjectBoundsForAlign: (obj: MapObject) => { minX: number; minY: number; maxX: number; maxY: number } | null;
  isReadOnly: boolean;
  isWallType: (typeId: string) => boolean;
  markTouched: () => void;
  moveObject: DataStoreState['moveObject'];
  renderPlan: FloorPlan | undefined;
  selectedObjects: MapObject[];
  updateObject: DataStoreState['updateObject'];
};

export const computeAlignSelection = (
  mode: 'horizontal' | 'vertical',
  referenceId: string | undefined,
  deps: AlignSelectionDeps
) => {
  const {
    getObjectBoundsForAlign,
    isReadOnly,
    isWallType,
    markTouched,
    moveObject,
    renderPlan,
    selectedObjects,
    updateObject
  } = deps;
  if (isReadOnly || !renderPlan) return;
  if (selectedObjects.length < 2) return;
  const objects = selectedObjects;
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
};

export const computeGetCorridorPolygon = (corridor: any): Pt[] => {
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
};

type WallMoveBatch = {
  id: string | null;
  movedGroups: Set<string>;
  movedWalls: Set<string>;
  movedRooms: Set<string>;
};

export type HandleWallMoveDeps = {
  markTouched: () => void;
  updateObject: DataStoreState['updateObject'];
  wallMoveBatchRef: { current: WallMoveBatch };
  planRef: { current: FloorPlan | undefined };
  isReadOnlyRef: { current: boolean };
};

export const computeHandleWallMove = (
  id: string,
  dx: number,
  dy: number,
  batchId: string | undefined,
  movedRoomIds: string[] | undefined,
  deps: HandleWallMoveDeps
) => {
  const { markTouched, updateObject, wallMoveBatchRef, planRef, isReadOnlyRef } = deps;
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
};

type CorridorDoorLinkModalState = {
  corridorId: string;
  doorId: string;
  selectedRoomIds: string[];
  nearestRoomId?: string;
  magneticRoomIds?: string[];
} | null;

type RoomStats = { items: MapObject[]; userCount: number; otherCount: number; totalCount: number };

export type CorridorDoorLinkRoomEntriesDeps = {
  corridorDoorLinkModal: CorridorDoorLinkModalState;
  corridorDoorLinkQuery: string;
  getUserObjectLabel: (obj: MapObject) => string;
  isUserObject: (type: string) => boolean;
  lang: 'it' | 'en';
  renderPlan: FloorPlan | undefined;
  roomStatsById: Map<string, RoomStats>;
};

export const computeCorridorDoorLinkRoomEntries = (deps: CorridorDoorLinkRoomEntriesDeps) => {
  const {
    corridorDoorLinkModal,
    corridorDoorLinkQuery,
    getUserObjectLabel,
    isUserObject,
    lang,
    renderPlan,
    roomStatsById
  } = deps;
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
};

export type CanvasPlanDeps = {
  allItemsSelected: boolean;
  effectiveVisibleLayerIds: string[];
  getObjectLayerIdsForVisibility: (obj: any) => string[];
  hideAllLayers: boolean;
  rackOverlayLinks: { fromId: string | number; toId: string | number }[];
  renderPlan: FloorPlan | undefined;
};

export const computeCanvasPlan = (deps: CanvasPlanDeps) => {
  const {
    allItemsSelected,
    effectiveVisibleLayerIds,
    getObjectLayerIdsForVisibility,
    hideAllLayers,
    rackOverlayLinks,
    renderPlan
  } = deps;
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
};

export type SaveRevisionReasonDeps = {
  pendingClientMeetingsPreset: unknown;
  pendingMeetingManagerPreset: unknown;
  pendingPostSaveAction: { type?: string } | null;
  pendingNavigateRef: { current: unknown };
};

export const computeSaveRevisionReason = (deps: SaveRevisionReasonDeps) => {
  const { pendingClientMeetingsPreset, pendingMeetingManagerPreset, pendingPostSaveAction, pendingNavigateRef } = deps;
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
  if (pendingMeetingManagerPreset) {
    return {
      it: 'Stai aprendo la pianificazione meeting: salva una revisione per allineare i dati delle stanze (es. nomi/capienze).',
      en: 'You are opening meeting scheduling: save a revision to align room data (e.g. names/capacities).'
    };
  }
  if (pendingClientMeetingsPreset) {
    return {
      it: 'Stai aprendo la timeline meeting: salva una revisione per allineare i dati delle stanze (es. nomi/capienze).',
      en: 'You are opening meeting timeline: save a revision to align room data (e.g. names/capacities).'
    };
  }
  return null;
};
