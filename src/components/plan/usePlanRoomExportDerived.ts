/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { computeRoomMeasuresData } from './planViewRoomGeometry';
import { computeRoomLayoutExportRows } from './planViewExportData';

// Room measures + layout-export derived data extracted from usePlanView. Pure read-only
// derivations; bodies moved verbatim (dep arrays preserved exactly).
export const usePlanRoomExportDerived = (deps: any) => {
  const {
    computePolygonArea, computePolylineLength, formatCornerLabel, formatNumber, lang, metersPerPixel,
    renderPlan, renderPlanRoomById, roomMeasuresModal, getRoomPolygon, allClients, roomLayoutExportModal
  } = deps;

  const roomMeasuresData = useMemo(() => {
    return computeRoomMeasuresData({
      computePolygonArea,
      computePolylineLength,
      formatCornerLabel,
      formatNumber,
      lang,
      metersPerPixel,
      renderPlan,
      renderPlanRoomById,
      roomMeasuresModal
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
    renderPlanRoomById,
    roomMeasuresModal
  ]);

  const roomLayoutExportRows = useMemo(
    () => computeRoomLayoutExportRows({ allClients, roomLayoutExportModal }),
    [allClients, roomLayoutExportModal]
  );

  const roomLayoutExportSource = useMemo(
    () => roomLayoutExportRows.find((row) => row.isSource) || null,
    [roomLayoutExportRows]
  );

  return { roomMeasuresData, roomLayoutExportRows, roomLayoutExportSource };
};
