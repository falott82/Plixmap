import { useCallback, useEffect, useRef, useState } from 'react';
import type { useLocation, useNavigate } from 'react-router-dom';
import type { FloorPlan, MapObject, MapObjectType, Room } from '../../store/types';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';
import { isNonPeopleRoom } from '../../utils/roomProperties';

type RoomStats = { items: MapObject[]; userCount: number; otherCount: number; totalCount: number };

export type UsePlanCapacityDeps = {
  t: ReturnType<typeof useT>;
  push: (message: string, tone?: ToastTone) => void;
  planId: string;
  plan: FloorPlan | undefined;
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  rooms: Room[];
  roomStatsById: Map<string, RoomStats>;
  roomCapacityStateByPlan: Record<string, Record<string, { userCount: number; capacity?: number }>>;
  setRoomCapacityState: (planId: string, state: Record<string, { userCount: number; capacity?: number }>) => void;
  getRoomIdAt: (rooms: any[] | undefined, x: number, y: number) => string | undefined;
  notifyNonPeopleRoomBlocked: () => void;
};

export function usePlanCapacity(deps: UsePlanCapacityDeps) {
  const {
    t,
    push,
    planId,
    plan,
    location,
    navigate,
    rooms,
    roomStatsById,
    roomCapacityStateByPlan,
    setRoomCapacityState,
    getRoomIdAt,
    notifyNonPeopleRoomBlocked
  } = deps;

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

  const [capacityDashboardOpen, setCapacityDashboardOpen] = useState(false);
  const [capacityDashboardPreset, setCapacityDashboardPreset] = useState<{ clientId?: string; siteId?: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('cd') !== '1') return;
    const presetClientId = String(params.get('cdClient') || '').trim();
    const presetSiteId = String(params.get('cdSite') || '').trim();
    setCapacityDashboardPreset({
      clientId: presetClientId || undefined,
      siteId: presetSiteId || undefined
    });
    setCapacityDashboardOpen(true);
    params.delete('cd');
    params.delete('cdClient');
    params.delete('cdSite');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const prevState = roomCapacityStateByPlan?.[planId];
    const nextState: Record<string, { userCount: number; capacity?: number }> = {};
    let nextKey = '';
    let prevKey = '';
    for (const room of rooms) {
      const rawCapacity = Number(room.capacity);
      const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
      const userCount = roomStatsById.get(room.id)?.userCount || 0;
      nextState[room.id] = { userCount, capacity };
      nextKey += `|${room.id}:${userCount}:${capacity ?? ''}`;
      if (prevState) {
        const prev = prevState[room.id];
        prevKey += `|${room.id}:${prev?.userCount ?? ''}:${prev?.capacity ?? ''}`;
      }
      if (!prevState) continue;
    }
    if (nextKey === prevKey) return;
    setRoomCapacityState(planId, nextState);
  }, [planId, push, roomCapacityStateByPlan, roomStatsById, rooms, setRoomCapacityState, t]);

  const shouldConfirmCapacity = useCallback(
    (type: MapObjectType, x: number, y: number) => {
      if (type !== 'user' && type !== 'real_user' && type !== 'generic_user') return false;
      const roomId = getRoomIdAt((plan as FloorPlan)?.rooms, x, y);
      if (!roomId) return false;
      const room = (rooms || []).find((r) => r.id === roomId);
      if (room && isNonPeopleRoom(room)) {
        notifyNonPeopleRoomBlocked();
        return true;
      }
      const rawCapacity = Number(room?.capacity);
      const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
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
    [notifyNonPeopleRoomBlocked, plan, roomStatsById, rooms, t]
  );

  return {
    capacityConfirm,
    setCapacityConfirm,
    capacityConfirmRef,
    capacityDashboardOpen,
    setCapacityDashboardOpen,
    capacityDashboardPreset,
    setCapacityDashboardPreset,
    shouldConfirmCapacity
  };
}
