/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import type { MapObject } from '../../../store/types';
import {
  getViewportWorldBounds,
  isObjectPotentiallyVisible,
  buildWifiRangeRings as buildWifiRangeRingsImpl,
  buildCameraFovPolygon as buildCameraFovPolygonImpl,
  buildWallSegments,
  buildCameraWallSegments,
  buildWifiRayAngles,
} from '../CanvasStage.helpers';

// Derived-object partition + visibility + wall/wifi/camera segment derivations, extracted from
// CanvasStage. Pure functions of objects/wallTypeIdSet/viewport/attenuation; bodies moved verbatim.
export const useCanvasDerivedObjects = (deps: any) => {
  const { objects, wallTypeIdSet, dimensions, pan, zoom, wallAttenuationMap } = deps;

  const [wallObjects, quoteObjects, regularObjects] = useMemo(() => {
    if (!wallTypeIdSet.size) {
      const quotes = objects.filter((obj: MapObject) => obj.type === 'quote');
      const others = objects.filter((obj: MapObject) => obj.type !== 'quote');
      return [[], quotes, others];
    }
    const walls: MapObject[] = [];
    const quotes: MapObject[] = [];
    const others: MapObject[] = [];
    for (const obj of objects) {
      if (wallTypeIdSet.has(obj.type)) walls.push(obj);
      else if (obj.type === 'quote') quotes.push(obj);
      else others.push(obj);
    }
    return [walls, quotes, others];
  }, [objects, wallTypeIdSet]);
  const viewportWorldBounds = useMemo(() => getViewportWorldBounds(dimensions, pan, zoom), [dimensions, pan, zoom]);
  const visibleRegularObjects = useMemo(
    () => regularObjects.filter((obj: MapObject) => isObjectPotentiallyVisible(obj, viewportWorldBounds)),
    [regularObjects, viewportWorldBounds]
  );
  const wallSegments = useMemo(() => buildWallSegments(wallObjects, wallAttenuationMap), [wallAttenuationMap, wallObjects]);
  const cameraWallSegments = useMemo(() => buildCameraWallSegments(wallObjects), [wallObjects]);
  const wifiRayAngles = useMemo(() => buildWifiRayAngles(), []);
  const buildWifiRangeRings = useCallback(
    (origin: { x: number; y: number }, baseRadiusPx: number) =>
      buildWifiRangeRingsImpl(origin, baseRadiusPx, wallSegments, wifiRayAngles),
    [wallSegments, wifiRayAngles]
  );
  const buildCameraFovPolygon = useCallback(
    (origin: { x: number; y: number }, rangePx: number, angleDeg: number, rotationDeg: number) =>
      buildCameraFovPolygonImpl(origin, rangePx, angleDeg, rotationDeg, cameraWallSegments),
    [cameraWallSegments]
  );

  return {
    wallObjects,
    quoteObjects,
    regularObjects,
    viewportWorldBounds,
    visibleRegularObjects,
    wallSegments,
    cameraWallSegments,
    wifiRayAngles,
    buildWifiRangeRings,
    buildCameraFovPolygon,
  };
};
