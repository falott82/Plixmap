/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { computeResolveWallPoint } from './planViewWallMeasureTools';
import { computeSplitWallAtPoint } from './planViewRoomGeometry';

// Wall tool handlers (resolve a wall point with snapping, split a wall at a point) extracted from
// usePlanView. Delegate to the matching compute* helpers; bodies + dep arrays moved verbatim.
export const usePlanWallToolHandlers = (deps: any) => {
  const {
    wallSnapPoints, zoom, wallDraftPointsRef, addWallSegment, deleteObject, getTypeLabel, getWallTypeColor,
    inferDefaultLayerIds, isReadOnly, isWallType, layerIdSet, markTouched, projectPointOnSegment, renderPlan,
    setSelectedObject, lastInsertedRef
  } = deps;

  const resolveWallPoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean; avoidPoint?: { x: number; y: number } | null; avoidDistance?: number }) =>
      computeResolveWallPoint(point, options, {
        wallSnapPoints,
        zoom,
        wallDraftPointsRef
      }),
    [wallSnapPoints, zoom, wallDraftPointsRef]
  );

  const splitWallAtPoint = useCallback(
    (payload: { id: string; point?: { x: number; y: number } }) =>
      computeSplitWallAtPoint(payload, {
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
      }),
    [
      addWallSegment,
      deleteObject,
      getTypeLabel,
      getWallTypeColor,
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
    ]
  );

  return { resolveWallPoint, splitWallAtPoint };
};
