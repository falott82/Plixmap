/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import type { Room } from '../../store/types';
import { runOpenDuplicate } from './planViewCreateObject';
import { computeResolveRoomAssignmentForObject, isPointInRoom } from './planViewRoomGeometry';

// Misc object handlers (duplicate an object, resolve a room assignment, corridor hit-test) extracted
// from usePlanView. Bodies moved verbatim; consumed by the downstream move/create/context hooks.
export const usePlanObjectMiscHandlers = (deps: any) => {
  const {
    renderPlan, isReadOnly, isDeskType, markTouched, getTypeLabel, inferDefaultLayerIds, layerIdSet,
    addObject, ensureObjectLayerVisible, lastInsertedRef, getRoomIdAt, updateObject, push, t, postAuditEvent,
    setModalState
  } = deps;

  const openDuplicate = (objectId: string) => {
    runOpenDuplicate(objectId, {
      renderPlan,
      isReadOnly,
      isDeskType,
      markTouched,
      getTypeLabel,
      inferDefaultLayerIds,
      layerIdSet,
      addObject,
      ensureObjectLayerVisible,
      lastInsertedRef,
      getRoomIdAt,
      updateObject,
      push,
      t,
      postAuditEvent,
      setModalState
    });
  };

  const resolveRoomAssignmentForObject = useCallback(
    (roomId: string | undefined | null, objectType: unknown, roomList?: Room[]) =>
      computeResolveRoomAssignmentForObject(roomId, objectType, roomList, renderPlan?.rooms),
    [renderPlan?.rooms]
  );

  const getCorridorIdAt = useCallback((corridors: any[] | undefined, x: number, y: number) => {
    const list = corridors || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const corridor = list[i];
      if (isPointInRoom(corridor, x, y)) return corridor.id as string;
    }
    return undefined;
  }, []);

  return { openDuplicate, resolveRoomAssignmentForObject, getCorridorIdAt };
};
