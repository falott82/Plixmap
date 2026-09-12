/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import type { MapObject, Room } from '../../store/types';

// Object/room index derivations (render + base plan id→object and id→room maps, room-modal base
// room, selected object list + single selection) extracted from usePlanView. Pure derivations of
// the render/base plan + modal/selection state; bodies moved verbatim (dep arrays preserved).
export const usePlanObjectIndex = (deps: any) => {
  const { renderPlan, basePlan, roomModal, selectedObjectIds } = deps;

  const renderPlanObjectById = useMemo(() => {
    const map = new Map<string, MapObject>();
    const objects = (renderPlan?.objects || []) as MapObject[];
    for (const obj of objects) {
      map.set(obj.id, obj);
    }
    return map;
  }, [renderPlan?.objects]);
  const basePlanObjectById = useMemo(() => {
    const map = new Map<string, MapObject>();
    const objects = (basePlan?.objects || []) as MapObject[];
    for (const obj of objects) {
      map.set(obj.id, obj);
    }
    return map;
  }, [basePlan?.objects]);
  const renderPlanRoomById = useMemo(() => {
    const map = new Map<string, Room>();
    const rooms = (renderPlan?.rooms || []) as Room[];
    for (const room of rooms) {
      map.set(room.id, room);
    }
    return map;
  }, [renderPlan?.rooms]);
  const basePlanRoomById = useMemo(() => {
    const map = new Map<string, Room>();
    const rooms = (basePlan?.rooms || []) as Room[];
    for (const room of rooms) {
      map.set(room.id, room);
    }
    return map;
  }, [basePlan?.rooms]);
  const roomModalBaseRoom = useMemo(() => {
    if (!roomModal || roomModal.mode !== 'edit') return undefined;
    return basePlanRoomById.get(roomModal.roomId);
  }, [basePlanRoomById, roomModal]);
  const selectedObjects = useMemo(() => {
    if (!selectedObjectIds.length) return [] as MapObject[];
    const out: MapObject[] = [];
    for (const id of selectedObjectIds) {
      const obj = renderPlanObjectById.get(id);
      if (obj) out.push(obj);
    }
    return out;
  }, [renderPlanObjectById, selectedObjectIds]);
  const selectedSingleObject = useMemo(() => {
    if (selectedObjectIds.length !== 1) return undefined;
    return renderPlanObjectById.get(selectedObjectIds[0]);
  }, [renderPlanObjectById, selectedObjectIds]);

  return {
    renderPlanObjectById,
    basePlanObjectById,
    renderPlanRoomById,
    basePlanRoomById,
    roomModalBaseRoom,
    selectedObjects,
    selectedSingleObject,
  };
};
