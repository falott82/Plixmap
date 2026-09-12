/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';

// Wall-group / room-wall-type modal handlers (open from a room, open from a wall group, create
// walls for the edited room) extracted from usePlanView. Bodies + dep arrays moved verbatim.
export const usePlanWallGroupHandlers = (deps: any) => {
  const { buildRoomWallSegments, setRoomWallTypeModal, getWallPolygonData, roomModal, renderPlan, renderPlanRoomById, t, setRoomModal } = deps;

  const openRoomWallTypes = useCallback(
    (payload: { roomId: string; roomName: string; kind: 'rect' | 'poly'; rect?: { x: number; y: number; width: number; height: number }; points?: { x: number; y: number }[] }) => {
      const segments = buildRoomWallSegments({ kind: payload.kind, rect: payload.rect, points: payload.points });
      if (!segments.length) return;
      setRoomWallTypeModal({ roomId: payload.roomId, roomName: payload.roomName, segments, mode: 'create' });
    },
    [buildRoomWallSegments, setRoomWallTypeModal]
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
    [getWallPolygonData, setRoomWallTypeModal]
  );

  const handleCreateWallsForRoom = useCallback(() => {
    if (!roomModal || roomModal.mode !== 'edit' || !renderPlan) return;
    const room = renderPlanRoomById.get(roomModal.roomId);
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
  }, [openRoomWallTypes, renderPlan, renderPlanRoomById, roomModal, t, setRoomModal]);

  return { openRoomWallTypes, openWallGroupModal, handleCreateWallsForRoom };
};
