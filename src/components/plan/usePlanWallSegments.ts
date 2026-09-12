/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import { computeAddWallSegment } from './planViewRoomGeometry';

// Wall-segment creation + wall snap points extracted from usePlanView. Bodies + dep arrays moved
// verbatim; both feed the downstream wall tool/point handler hooks.
export const usePlanWallSegments = (deps: any) => {
  const { addObject, ensureObjectLayerVisible, inferDefaultLayerIds, layerIdSet, renderPlan, getWallTypeColor, isWallType } = deps;

  const addWallSegment = useCallback(
    (payload: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      typeId: string;
      label: string;
      layerIds?: string[];
      strokeColor?: string;
      opacity?: number;
      strokeWidth?: number;
    }) =>
      computeAddWallSegment(payload, {
        addObject,
        ensureObjectLayerVisible,
        inferDefaultLayerIds,
        layerIdSet,
        renderPlan
      }),
    [addObject, ensureObjectLayerVisible, getWallTypeColor, inferDefaultLayerIds, layerIdSet, renderPlan]
  );

  const wallSnapPoints = useMemo(() => {
    if (!renderPlan) return [];
    const out: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    for (const obj of renderPlan.objects || []) {
      if (!isWallType(obj.type)) continue;
      for (const point of obj.points || []) {
        const key = `${point.x}:${point.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x: point.x, y: point.y });
      }
    }
    return out;
  }, [isWallType, renderPlan]);

  return { addWallSegment, wallSnapPoints };
};
