/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { computeHandleStageMove } from './planViewStageHandlers';
import { computeHandleWallMove } from './planViewMiscTools';

// Object/wall move handlers extracted from usePlanView. Delegate to the matching compute* helpers;
// bodies + dep arrays moved verbatim.
export const usePlanMoveHandlers = (deps: any) => {
  const {
    collectUserDepartments, getUserObjectLabel, markTouched, moveObject, notifyNonPeopleRoomBlocked,
    resolveRoomAssignmentForObject, roomStatsById, t, updateObject, isReadOnlyRef, planRef, dragStartRef,
    getRoomIdAt, isUserType, setCapacityConfirm, setRoomDepartmentConfirm, wallMoveBatchRef
  } = deps;

  const handleStageMove = useCallback(
    (id: string, x: number, y: number) =>
      computeHandleStageMove(id, x, y, {
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
      }),
    [
      collectUserDepartments,
      getUserObjectLabel,
      markTouched,
      moveObject,
      notifyNonPeopleRoomBlocked,
      resolveRoomAssignmentForObject,
      roomStatsById,
      t,
      updateObject,
      dragStartRef,
      getRoomIdAt,
      isReadOnlyRef,
      isUserType,
      planRef,
      setCapacityConfirm,
      setRoomDepartmentConfirm
    ]
  );

  const handleWallMove = useCallback(
    (id: string, dx: number, dy: number, batchId?: string, movedRoomIds?: string[]) =>
      computeHandleWallMove(id, dx, dy, batchId, movedRoomIds, {
        markTouched,
        updateObject,
        wallMoveBatchRef,
        planRef,
        isReadOnlyRef
      }),
    [
      markTouched,
      updateObject,
      isReadOnlyRef,
      planRef,
      wallMoveBatchRef
    ]
  );

  return { handleStageMove, handleWallMove };
};
