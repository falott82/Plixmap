/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { computeWallPolygonData } from './planViewWallGeometry';
import { computeBuildRoomWallSegments } from './planViewRoomGeometry';
import { computeBuildRoomPreview } from './planViewComputeBits2';

// Room/wall geometry derivations (polyline length, polygon area, surface m², corner labels,
// room preview, segment projection, wall polygon data) extracted from usePlanView. Bodies
// moved verbatim; depends only on values computed earlier in the host (passed via deps).
export const usePlanRoomGeometry = (deps: any) => {
  const { metersPerPixel, lang, formatNumber, renderPlan, renderPlanObjectById, renderPlanRoomById, isWallType, defaultWallTypeId, t } = deps;

  const computePolylineLength = useCallback((points: { x: number; y: number }[]) => {
    if (!points.length) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return total;
  }, []);

  const computePolygonArea = useCallback((points: { x: number; y: number }[]) => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) * 0.5;
  }, []);
  const computeRoomSurfaceSqm = useCallback(
    (room: { kind?: string; points?: { x: number; y: number }[]; x?: number; y?: number; width?: number; height?: number }, metersPerPixelValue?: number | null) => {
      if (!metersPerPixelValue) return undefined;
      const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
      let areaPx = 0;
      if (kind === 'poly') {
        areaPx = computePolygonArea(room.points || []);
      } else {
        areaPx = Number(room?.width || 0) * Number(room?.height || 0);
      }
      const sqm = areaPx * metersPerPixelValue * metersPerPixelValue;
      return Number.isFinite(sqm) && sqm > 0 ? Math.round(sqm * 100) / 100 : undefined;
    },
    [computePolygonArea]
  );
  const formatCornerLabel = useCallback((index: number) => {
    if (index < 0) return '';
    let n = index;
    let label = '';
    while (n >= 0) {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  }, []);
  const buildRoomPreview = useCallback(
    (points: { x: number; y: number }[]) =>
      computeBuildRoomPreview(points, { metersPerPixel, lang, formatNumber, formatCornerLabel }),
    [formatCornerLabel, formatNumber, lang, metersPerPixel]
  );
  const projectPointOnSegment = useCallback(
    (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lenSq = dx * dx + dy * dy;
      if (!lenSq) return { x: start.x, y: start.y, t: 0 };
      let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      return { x: start.x + t * dx, y: start.y + t * dy, t };
    },
    []
  );
  const buildRoomWallSegments = useCallback(
    (room: { kind: 'rect' | 'poly'; rect?: { x: number; y: number; width: number; height: number }; points?: { x: number; y: number }[] }) =>
      computeBuildRoomWallSegments(room, { formatCornerLabel }),
    [formatCornerLabel]
  );
  const getWallPolygonData = useCallback(
    (wallId: string) =>
      computeWallPolygonData(wallId, {
        renderPlan,
        renderPlanObjectById,
        renderPlanRoomById,
        isWallType,
        formatCornerLabel,
        buildRoomWallSegments,
        t,
        defaultWallTypeId
      }),
    [buildRoomWallSegments, defaultWallTypeId, formatCornerLabel, isWallType, renderPlan, renderPlanObjectById, renderPlanRoomById, t]
  );

  return {
    computePolylineLength,
    computePolygonArea,
    computeRoomSurfaceSqm,
    formatCornerLabel,
    buildRoomPreview,
    projectPointOnSegment,
    buildRoomWallSegments,
    getWallPolygonData,
  };
};
