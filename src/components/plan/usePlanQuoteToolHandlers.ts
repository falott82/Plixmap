/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { computeHandleQuotePoint, computeConvertMeasurementToQuotes } from './planViewQuoteScaleTools';

// Quote tool handlers (place a quote point, convert an active measurement into quotes) extracted
// from usePlanView. Delegate to the matching compute* helpers; bodies + dep arrays moved verbatim.
export const usePlanQuoteToolHandlers = (deps: any) => {
  const {
    addObject, ensureObjectLayerVisible, getQuoteOrientation, getTypeLabel, inferDefaultLayerIds, isReadOnly,
    lastQuoteColor, lastQuoteDashed, lastQuoteEndpoint, lastQuoteLabelColor, lastQuoteLabelPosH, lastQuoteLabelPosV,
    lastQuoteLabelScale, lastQuoteLabelBg, lastQuoteScale, layerIdSet, markTouched, quoteMode, quotePoints,
    renderPlan, resolveAxisLockedPoint, t, zoom, setQuotePoints, setQuotePointer, dismissMeasureToast, measureMode,
    push, measurePointsRef, measureClosedRef, measureFinishedRef, setMeasureMode, setMeasurePoints, setMeasurePointer,
    setMeasureClosed, setMeasureFinished
  } = deps;

  const handleQuotePoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) =>
      computeHandleQuotePoint(point, options, {
        addObject,
        ensureObjectLayerVisible,
        getQuoteOrientation,
        getTypeLabel,
        isReadOnly,
        lastQuoteColor,
        lastQuoteDashed,
        lastQuoteEndpoint,
        lastQuoteLabelColor,
        lastQuoteLabelPosH,
        lastQuoteLabelPosV,
        lastQuoteLabelScale,
        lastQuoteLabelBg,
        lastQuoteScale,
        markTouched,
        quoteMode,
        quotePoints,
        renderPlan,
        resolveAxisLockedPoint,
        zoom,
        setQuotePoints,
        setQuotePointer
      }),
    [
      addObject,
      ensureObjectLayerVisible,
      getQuoteOrientation,
      getTypeLabel,
      inferDefaultLayerIds,
      isReadOnly,
      lastQuoteColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      lastQuoteLabelPosH,
      lastQuoteLabelPosV,
      lastQuoteLabelScale,
      lastQuoteLabelBg,
      lastQuoteScale,
      layerIdSet,
      markTouched,
      quoteMode,
      quotePoints,
      renderPlan,
      resolveAxisLockedPoint,
      t,
      zoom
    ]
  );

  const convertMeasurementToQuotes = useCallback(() => {
    computeConvertMeasurementToQuotes({
      addObject,
      dismissMeasureToast,
      ensureObjectLayerVisible,
      getQuoteOrientation,
      getTypeLabel,
      inferDefaultLayerIds,
      isReadOnly,
      lastQuoteColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      lastQuoteLabelBg,
      lastQuoteLabelColor,
      lastQuoteLabelPosH,
      lastQuoteLabelPosV,
      lastQuoteLabelScale,
      lastQuoteScale,
      layerIdSet,
      markTouched,
      measureMode,
      push,
      renderPlan,
      t,
      zoom,
      measurePointsRef,
      measureClosedRef,
      measureFinishedRef,
      setMeasureMode,
      setMeasurePoints,
      setMeasurePointer,
      setMeasureClosed,
      setMeasureFinished
    });
  }, [
    addObject,
    dismissMeasureToast,
    ensureObjectLayerVisible,
    getQuoteOrientation,
    getTypeLabel,
    inferDefaultLayerIds,
    isReadOnly,
    lastQuoteColor,
    lastQuoteDashed,
    lastQuoteEndpoint,
    lastQuoteLabelBg,
    lastQuoteLabelColor,
    lastQuoteLabelPosH,
    lastQuoteLabelPosV,
    lastQuoteLabelScale,
    lastQuoteScale,
    layerIdSet,
    markTouched,
    measureMode,
    push,
    renderPlan,
    t,
    zoom
  ]);

  return { handleQuotePoint, convertMeasurementToQuotes };
};
