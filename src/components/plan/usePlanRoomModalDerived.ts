/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { computeRoomModalMetrics } from './planViewRoomGeometry';

// Room-modal derived data (metrics, preview, wall presence, wall-type preview) extracted from
// usePlanView. Pure read-only derivations of the room modal state + geometry helpers; bodies
// moved verbatim (dep arrays preserved exactly to keep the ESLint baseline unchanged).
export const usePlanRoomModalDerived = (deps: any) => {
  const {
    computePolygonArea, computePolylineLength, formatCornerLabel, formatNumber, lang, metersPerPixel,
    renderPlan, roomModal, renderPlanRoomById, getRoomPolygon, buildRoomPreview, isWallType, roomWallTypeModal
  } = deps;

  const roomModalMetrics = useMemo(() => {
    return computeRoomModalMetrics({
      computePolygonArea,
      computePolylineLength,
      formatCornerLabel,
      formatNumber,
      lang,
      metersPerPixel,
      renderPlan,
      roomModal,
      renderPlanRoomById
    });
  }, [
    computePolygonArea,
    computePolylineLength,
    formatCornerLabel,
    formatNumber,
    getRoomPolygon,
    lang,
    metersPerPixel,
    renderPlan,
    roomModal,
    renderPlanRoomById
  ]);
  const roomModalPreview = useMemo(() => {
    if (!roomModal) return null;
    let points: { x: number; y: number }[] = [];
    if (roomModal.mode === 'create') {
      if (roomModal.kind === 'rect' && roomModal.rect) {
        const { x, y, width, height } = roomModal.rect;
        points = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height }
        ];
      } else if (roomModal.kind === 'poly') {
        points = roomModal.points || [];
      }
    } else if (roomModal.mode === 'edit' && renderPlan) {
      const room = renderPlanRoomById.get(roomModal.roomId);
      if (room) points = getRoomPolygon(room);
    }
    return buildRoomPreview(points);
  }, [buildRoomPreview, getRoomPolygon, renderPlan, renderPlanRoomById, roomModal]);
  const roomHasWalls = useMemo(() => {
    if (!roomModal || roomModal.mode !== 'edit' || !renderPlan) return false;
    return (renderPlan.objects || []).some(
      (obj: any) => isWallType(obj.type) && (obj as any).wallGroupId === roomModal.roomId
    );
  }, [isWallType, renderPlan, roomModal]);
  const roomWallPreview = useMemo(() => {
    if (!roomWallTypeModal) return null;
    const points = (roomWallTypeModal.segments || []).map((segment: any) => segment.start);
    return buildRoomPreview(points);
  }, [buildRoomPreview, roomWallTypeModal]);

  return { roomModalMetrics, roomModalPreview, roomHasWalls, roomWallPreview };
};
