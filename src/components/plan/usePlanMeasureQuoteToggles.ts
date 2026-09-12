import { useCallback } from 'react';
import { runStartMeasure } from './planViewComputeBits2';

// Measure/quote mode toggle handlers extracted from usePlanView (start/stop
// measuring, start/stop quoting). Bodies are verbatim; shared deps injected once.
export const usePlanMeasureQuoteToggles = (deps: any) => {
  const {
    metersPerPixel,
    isReadOnly,
    measureMode,
    quoteMode,
    push,
    t,
    showMeasureToast,
    dismissMeasureToast,
    measurePointsRef,
    measureClosedRef,
    measureFinishedRef,
    setMeasureMode,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setRoomDrawMode,
    setScaleMode,
    setWallDrawMode,
    setPendingType
  } = deps;

  const startMeasure = useCallback(
    (point?: { x: number; y: number }) => {
      runStartMeasure(point, {
        metersPerPixel,
        push,
        t,
        setMeasureMode,
        measurePointsRef,
        setMeasurePoints,
        setMeasurePointer,
        setMeasureClosed,
        setMeasureFinished,
        measureClosedRef,
        measureFinishedRef,
        setQuoteMode,
        setQuotePoints,
        setQuotePointer,
        setRoomDrawMode,
        setScaleMode,
        setWallDrawMode,
        setPendingType,
        showMeasureToast
      });
    },
    [metersPerPixel, push, showMeasureToast, t]
  );

  const stopMeasure = useCallback(() => {
    if (!measureMode) return;
    dismissMeasureToast();
    setMeasureMode(false);
    setMeasurePoints([]);
    setMeasurePointer(null);
    setMeasureClosed(false);
    setMeasureFinished(false);
    measurePointsRef.current = [];
    measureClosedRef.current = false;
    measureFinishedRef.current = false;
    push(t({ it: 'Misurazione annullata', en: 'Measurement cancelled' }), 'info');
  }, [dismissMeasureToast, measureMode, push, t]);

  const startQuote = useCallback(
    (point?: { x: number; y: number }) => {
      if (!metersPerPixel) {
        push(t({ it: 'Imposta la scala prima di creare quote.', en: 'Set the scale before creating quotes.' }), 'info');
        return;
      }
      if (isReadOnly) return;
      setQuoteMode(true);
      setQuotePoints(point ? [point] : []);
      setQuotePointer(null);
      setRoomDrawMode(null);
      setScaleMode(false);
      setWallDrawMode(false);
      setMeasureMode(false);
      setPendingType(null);
      push(t({ it: 'Quota: clicca due punti per fissare la misura.', en: 'Quote: click two points to fix the measurement.' }), 'info');
    },
    [isReadOnly, metersPerPixel, push, t]
  );

  const stopQuote = useCallback(() => {
    if (!quoteMode) return;
    setQuoteMode(false);
    setQuotePoints([]);
    setQuotePointer(null);
    push(t({ it: 'Quota annullata', en: 'Quote cancelled' }), 'info');
  }, [quoteMode, push, t]);

  return { startMeasure, stopMeasure, startQuote, stopQuote };
};
