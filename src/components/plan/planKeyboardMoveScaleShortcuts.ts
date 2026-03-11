import type { FloorPlan, MapObject, Room } from '../../store/types';

type ResolveObjectById = (id: string) => MapObject | undefined;
type GetRoomIdAt = (rooms: any[] | undefined, x: number, y: number) => string | undefined;
type ResolveRoomAssignmentForObject = (roomId: string | undefined, typeId: string, rooms: Room[]) => string | undefined;
type IsWallType = (typeId: string) => boolean;
type IsUserType = (typeId: string) => boolean;

type ArrowShortcutStaticDeps = {
  markTouched: () => void,
  moveObject: (id: string, x: number, y: number) => void,
  updateObject: (id: string, changes: any) => void,
  updateRoom: (planId: string, roomId: string, changes: any) => void,
  notifyNonPeopleRoomBlocked: () => void
};

type ScaleShortcutStaticDeps = {
  markTouched: () => void,
  updateObject: (id: string, changes: any) => void,
  updateRoom: (planId: string, roomId: string, changes: any) => void,
  setLastQuoteScale: (value: number) => void,
  setLastObjectScale: (value: number) => void
};

export const createPlanArrowShortcutHandler = ({
  markTouched,
  moveObject,
  updateObject,
  updateRoom,
  notifyNonPeopleRoomBlocked
}: ArrowShortcutStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    currentSelectedIds: string[],
    selectedRoomId: string | undefined,
    isReadOnly: boolean,
    zoom: number,
    getSelectedObjectById: ResolveObjectById,
    getRoomIdAt: GetRoomIdAt,
    resolveRoomAssignmentForObject: ResolveRoomAssignmentForObject,
    isUserType: IsUserType,
    isWallType: IsWallType
  ): boolean => {
    const isArrowLeft = e.key === 'ArrowLeft' || e.code === 'ArrowLeft';
    const isArrowRight = e.key === 'ArrowRight' || e.code === 'ArrowRight';
    const isArrowUp = e.key === 'ArrowUp' || e.code === 'ArrowUp';
    const isArrowDown = e.key === 'ArrowDown' || e.code === 'ArrowDown';
    const isArrow = isArrowUp || isArrowDown || isArrowLeft || isArrowRight;
    if (!isArrow) return false;
    if (!currentPlan || isReadOnly) return true;

    if (!currentSelectedIds.length && selectedRoomId && (isArrowUp || isArrowDown || isArrowLeft || isArrowRight)) {
      const room = ((currentPlan as FloorPlan).rooms || []).find((entry) => entry.id === selectedRoomId);
      if (!room) return true;
      e.preventDefault();
      markTouched();
      if (e.shiftKey) {
        const nextPos = isArrowUp ? 'top' : isArrowDown ? 'bottom' : isArrowLeft ? 'left' : 'right';
        updateRoom((currentPlan as FloorPlan).id, room.id, { labelPosition: nextPos } as any);
        return true;
      }
      const step = 1 / Math.max(0.2, zoom || 1);
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
      return true;
    }

    if (!currentSelectedIds.length) return true;
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) / Math.max(0.2, zoom || 1);
    const dx = isArrowLeft ? -step : isArrowRight ? step : 0;
    const dy = isArrowUp ? -step : isArrowDown ? step : 0;
    let didMutate = false;
    for (const id of currentSelectedIds) {
      const obj = getSelectedObjectById(id);
      if (!obj || isWallType(obj.type)) continue;
      if (obj.type === 'quote') {
        const pts = Array.isArray(obj.points) ? obj.points : [];
        if (pts.length >= 2) {
          didMutate = true;
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
      const rawNextRoomId = getRoomIdAt((currentPlan as FloorPlan).rooms, nextX, nextY);
      const nextRoomId = resolveRoomAssignmentForObject(rawNextRoomId, obj.type, ((currentPlan as FloorPlan).rooms || []) as Room[]);
      if (rawNextRoomId && !nextRoomId && isUserType(obj.type)) {
        notifyNonPeopleRoomBlocked();
        continue;
      }
      const currentRoomId = obj.roomId ?? undefined;
      didMutate = true;
      moveObject(id, nextX, nextY);
      if (currentRoomId !== nextRoomId) {
        updateObject(id, { roomId: nextRoomId });
      }
    }
    if (didMutate) markTouched();
    return true;
  };

export const createPlanScaleShortcutHandler = ({
  markTouched,
  updateObject,
  updateRoom,
  setLastQuoteScale,
  setLastObjectScale
}: ScaleShortcutStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    currentSelectedIds: string[],
    selectedRoomId: string | undefined,
    isReadOnly: boolean,
    getSelectedObjectById: ResolveObjectById,
    isWallType: IsWallType
  ): boolean => {
    const isScaleUp = (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') && !e.ctrlKey && !e.metaKey;
    const isScaleDown = (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') && !e.ctrlKey && !e.metaKey;
    if (!isScaleUp && !isScaleDown) return false;
    if (!currentPlan || isReadOnly) return true;

    if (!currentSelectedIds.length && selectedRoomId) {
      const room = ((currentPlan as FloorPlan).rooms || []).find((entry) => entry.id === selectedRoomId);
      if (!room) return true;
      e.preventDefault();
      markTouched();
      const step = e.shiftKey ? 0.2 : 0.1;
      const delta = isScaleUp ? step : -step;
      const currentScale = Number((room as any).labelScale ?? 1) || 1;
      const nextScale = Math.max(0.3, Math.min(3, currentScale + delta));
      updateRoom((currentPlan as FloorPlan).id, room.id, { labelScale: nextScale } as any);
      return true;
    }

    if (!currentSelectedIds.length) return true;
    e.preventDefault();
    markTouched();
    const step = e.shiftKey ? 0.2 : 0.1;
    const delta = isScaleUp ? step : -step;
    const fontStep = e.shiftKey ? 4 : 2;
    for (const id of currentSelectedIds) {
      const obj = getSelectedObjectById(id);
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
    return true;
  };
