import { useCallback } from 'react';
import { computeHandleMeasurePoint, computeHandleToolMove } from './planViewWallMeasureTools';

type Pt = { x: number; y: number };
type PointOpts = { shiftKey?: boolean };

// Active-tool pointer handlers extracted from usePlanView (measure-point capture,
// the tool-point dispatcher routing to scale/wall/quote/measure, tool-move
// preview, and measure double-click finish). Bodies are verbatim; the
// scale/wall/quote point handlers are injected (they live in the parent).
export const usePlanToolPointHandlers = (deps: any) => {
  const {
    measureMode,
    quoteMode,
    scaleMode,
    wallDrawMode,
    isReadOnly,
    zoom,
    quotePoints,
    scaleDraft,
    resolveAxisLockedPoint,
    resolveWallPoint,
    showMeasureToast,
    handleScalePoint,
    handleWallPoint,
    handleQuotePoint,
    measurePointsRef,
    measureClosedRef,
    measureFinishedRef,
    wallDraftPointsRef,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished,
    setScaleDraftPointer,
    setWallDraftPointer,
    setQuotePointer
  } = deps;

  const handleMeasurePoint = useCallback(
    (point: Pt, options?: PointOpts) =>
      computeHandleMeasurePoint(point, options, {
        measureMode,
        resolveAxisLockedPoint,
        showMeasureToast,
        zoom,
        measurePointsRef,
        measureClosedRef,
        measureFinishedRef,
        setMeasurePoints,
        setMeasurePointer,
        setMeasureClosed,
        setMeasureFinished
      }),
    [measureMode, resolveAxisLockedPoint, showMeasureToast, zoom]
  );

  const handleToolPoint = useCallback(
    (point: Pt, options?: PointOpts) => {
      if (scaleMode) {
        handleScalePoint(point, options);
        return;
      }
      if (wallDrawMode) {
        handleWallPoint(point, options);
        return;
      }
      if (quoteMode) {
        handleQuotePoint(point, options);
        return;
      }
      if (measureMode) {
        handleMeasurePoint(point, options);
      }
    },
    [handleMeasurePoint, handleQuotePoint, handleScalePoint, handleWallPoint, measureMode, quoteMode, scaleMode, wallDrawMode]
  );

  const handleToolMove = useCallback(
    (point: Pt, options?: PointOpts) =>
      computeHandleToolMove(point, options, {
        isReadOnly,
        measureMode,
        quoteMode,
        quotePoints,
        resolveAxisLockedPoint,
        resolveWallPoint,
        scaleDraft,
        scaleMode,
        wallDrawMode,
        zoom,
        wallDraftPointsRef,
        measurePointsRef,
        measureFinishedRef,
        setScaleDraftPointer,
        setWallDraftPointer,
        setQuotePointer,
        setMeasurePointer
      }),
    [isReadOnly, measureMode, quoteMode, quotePoints, resolveAxisLockedPoint, resolveWallPoint, scaleDraft, scaleMode, wallDrawMode, zoom]
  );

  const handleToolDoubleClick = useCallback(() => {
    if (measureMode) {
      if (measureClosedRef.current) {
        setMeasureFinished(true);
        measureFinishedRef.current = true;
        setMeasurePointer(null);
        showMeasureToast(measurePointsRef.current, { closed: true, finished: true });
      }
      return;
    }
  }, [measureMode, showMeasureToast]);

  return { handleMeasurePoint, handleToolPoint, handleToolMove, handleToolDoubleClick };
};
