import { useCallback } from 'react';
import { computeHandleWallPoint } from './planViewWallMeasureTools';
import { runHandleWallSegmentDblClick } from './planViewComputeBits2';

// Wall point/segment handlers extracted from usePlanView (place a wall corner,
// finish/cancel the draft on context menu, show segment length on double-click).
// Bodies are verbatim; shared deps (incl. addWallSegment/finishWallDraw/
// resolveWallPoint closures) injected once.
export const usePlanWallPointHandlers = (deps: any) => {
  const {
    addWallSegment,
    finishWallDraw,
    resolveWallPoint,
    getTypeLabel,
    isWallType,
    markTouched,
    renderPlan,
    wallDrawMode,
    wallDrawType,
    wallTypeDefs,
    zoom,
    lang,
    metersPerPixel,
    push,
    t,
    formatNumber,
    wallDraftPointsRef,
    wallDraftSegmentIdsRef,
    lastInsertedRef,
    setWallDraftPoints,
    setWallDraftPointer,
    setContextMenu
  } = deps;

  const handleWallPoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) =>
      computeHandleWallPoint(point, options, {
        addWallSegment,
        finishWallDraw,
        getTypeLabel,
        isWallType,
        markTouched,
        renderPlan,
        resolveWallPoint,
        wallDrawMode,
        wallDrawType,
        wallTypeDefs,
        zoom,
        wallDraftPointsRef,
        wallDraftSegmentIdsRef,
        lastInsertedRef,
        setWallDraftPoints,
        setWallDraftPointer
      }),
    [addWallSegment, finishWallDraw, getTypeLabel, isWallType, markTouched, renderPlan, resolveWallPoint, wallDrawMode, wallDrawType, wallTypeDefs, zoom, wallDraftPointsRef, wallDraftSegmentIdsRef, lastInsertedRef, setWallDraftPoints, setWallDraftPointer]
  );

  const handleWallDraftContextMenu = useCallback(() => {
    if (!wallDrawMode) return;
    setContextMenu(null);
    if (wallDraftSegmentIdsRef.current.length || wallDraftPointsRef.current.length >= 2) {
      finishWallDraw();
    } else {
      finishWallDraw({ cancel: true });
    }
  }, [finishWallDraw, wallDrawMode, setContextMenu, wallDraftPointsRef, wallDraftSegmentIdsRef]);

  const handleWallSegmentDblClick = useCallback(
    (payload: { id: string; lengthPx: number }) => {
      runHandleWallSegmentDblClick(payload, { metersPerPixel, lang, push, t, formatNumber });
    },
    [formatNumber, lang, metersPerPixel, push, t]
  );

  return { handleWallPoint, handleWallDraftContextMenu, handleWallSegmentDblClick };
};
