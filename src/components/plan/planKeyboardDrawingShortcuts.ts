type Ref<T> = { current: T };

type DrawingShortcutStaticDeps = {
  cancelScaleMode: () => void,
  markTouched: () => void,
  deleteObject: (id: string) => void,
  setWallDraftPoints: (value: any) => void,
  setWallDraftPointer: (value: any) => void,
  finishWallDraw: (opts?: { cancel?: boolean }) => void,
  startWallDraw: () => void,
  startMeasure: () => void,
  stopMeasure: () => void,
  startQuote: () => void,
  stopQuote: () => void,
  convertMeasurementToQuotes: () => void,
  setMeasureClosed: (value: boolean) => void,
  setMeasureFinished: (value: boolean) => void,
  setMeasurePointer: (value: any) => void,
  setMeasurePoints: (value: any) => void,
  showMeasureToast: (points: Array<{ x: number; y: number }>, state: { closed: boolean; finished: boolean }) => void,
  setQuotePoints: (value: any) => void,
  setQuotePointer: (value: any) => void,
  wallDraftSegmentIdsRef: Ref<string[]>,
  wallDraftPointsRef: Ref<Array<{ x: number; y: number }>>,
  measureClosedRef: Ref<boolean>,
  measureFinishedRef: Ref<boolean>,
  measurePointsRef: Ref<Array<{ x: number; y: number }>>
};

export const createPlanDrawingShortcutHandler = ({
  cancelScaleMode,
  markTouched,
  deleteObject,
  setWallDraftPoints,
  setWallDraftPointer,
  finishWallDraw,
  startWallDraw,
  startMeasure,
  stopMeasure,
  startQuote,
  stopQuote,
  convertMeasurementToQuotes,
  setMeasureClosed,
  setMeasureFinished,
  setMeasurePointer,
  setMeasurePoints,
  showMeasureToast,
  setQuotePoints,
  setQuotePointer,
  wallDraftSegmentIdsRef,
  wallDraftPointsRef,
  measureClosedRef,
  measureFinishedRef,
  measurePointsRef
}: DrawingShortcutStaticDeps) =>
  (
    e: KeyboardEvent,
    isTyping: boolean,
    scaleMode: boolean,
    wallDrawMode: boolean,
    measureMode: boolean,
    quoteMode: boolean
  ): boolean => {
    const key = e.key;
    if (scaleMode && key === 'Escape') {
      e.preventDefault();
      cancelScaleMode();
      return true;
    }

    if (wallDrawMode && key === 'Escape') {
      e.preventDefault();
      const ids = wallDraftSegmentIdsRef.current;
      if (ids.length) {
        const lastId = ids.pop();
        if (lastId) {
          markTouched();
          deleteObject(lastId);
        }
        const next = wallDraftPointsRef.current.slice(0, -1);
        wallDraftPointsRef.current = next;
        setWallDraftPoints(next);
        setWallDraftPointer(null);
      } else {
        finishWallDraw({ cancel: true });
      }
      return true;
    }

    if (!isTyping && wallDrawMode && key === 'Enter') {
      e.preventDefault();
      finishWallDraw();
      return true;
    }

    if (measureMode && key === 'Escape') {
      e.preventDefault();
      stopMeasure();
      return true;
    }

    if (quoteMode && key === 'Escape') {
      e.preventDefault();
      stopQuote();
      return true;
    }

    const isM = key === 'm' || key === 'M';
    const isQ = key === 'q' || key === 'Q';
    const isW = key === 'w' || key === 'W';
    if (!isTyping && isM) {
      e.preventDefault();
      if (measureMode) stopMeasure();
      else startMeasure();
      return true;
    }

    if (!isTyping && measureMode && isQ) {
      e.preventDefault();
      convertMeasurementToQuotes();
      return true;
    }

    if (!isTyping && isQ) {
      e.preventDefault();
      if (quoteMode) stopQuote();
      else startQuote();
      return true;
    }

    if (!isTyping && isW) {
      e.preventDefault();
      if (wallDrawMode) finishWallDraw();
      else startWallDraw();
      return true;
    }

    const isBackDelete = key === 'Backspace' || key === 'Delete';
    if (!isTyping && wallDrawMode && isBackDelete) {
      e.preventDefault();
      const ids = wallDraftSegmentIdsRef.current;
      if (ids.length) {
        const lastId = ids.pop();
        if (lastId) {
          markTouched();
          deleteObject(lastId);
        }
        const next = wallDraftPointsRef.current.slice(0, -1);
        wallDraftPointsRef.current = next;
        setWallDraftPoints(next);
        setWallDraftPointer(null);
      } else {
        finishWallDraw({ cancel: true });
      }
      return true;
    }

    if (!isTyping && measureMode && isBackDelete) {
      e.preventDefault();
      setMeasureClosed(false);
      setMeasureFinished(false);
      measureClosedRef.current = false;
      measureFinishedRef.current = false;
      const next = measurePointsRef.current.slice(0, -1);
      measurePointsRef.current = next;
      setMeasurePoints(next);
      showMeasureToast(next, { closed: false, finished: false });
      return true;
    }

    if (!isTyping && quoteMode && isBackDelete) {
      e.preventDefault();
      setQuotePoints((prev: any[]) => prev.slice(0, -1));
      setQuotePointer(null);
      return true;
    }

    if (!isTyping && measureMode && key === 'Enter') {
      e.preventDefault();
      setMeasureFinished(true);
      measureFinishedRef.current = true;
      setMeasurePointer(null);
      showMeasureToast(measurePointsRef.current, { closed: measureClosedRef.current, finished: true });
      return true;
    }

    return false;
  };
