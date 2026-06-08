import { useCallback } from 'react';
import { runStartScaleMode } from './planViewComputeBits2';
import { computeApplyScale } from './planViewQuoteScaleTools';

// Scale-mode handlers extracted from usePlanView (enter scale mode, cancel it,
// capture the two scale points, apply the calibrated scale). Bodies are
// verbatim; shared deps injected once.
export const usePlanScaleModeHandlers = (deps: any) => {
  const {
    isReadOnly,
    scaleMode,
    scaleDraft,
    plan,
    planScale,
    scaleMetersInput,
    scaleModal,
    push,
    t,
    markTouched,
    updateFloorPlan,
    updateRoom,
    dismissScaleToast,
    resetToolClickHistory,
    resolveAxisLockedPoint,
    computeRoomSurfaceSqm,
    scaleToastIdRef,
    setScaleMode,
    setScaleDraft,
    setScaleDraftPointer,
    setScaleModal,
    setScaleMetersInput,
    setRoomDrawMode,
    setMeasureMode,
    setWallDrawMode,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setPendingType,
    setShowScaleLine
  } = deps;

  const startScaleMode = useCallback(() => {
    runStartScaleMode({
      isReadOnly,
      dismissScaleToast,
      resetToolClickHistory,
      setScaleMode,
      setScaleDraft,
      setScaleDraftPointer,
      setScaleModal,
      setScaleMetersInput,
      setRoomDrawMode,
      setMeasureMode,
      setWallDrawMode,
      setQuoteMode,
      setQuotePoints,
      setQuotePointer,
      setPendingType,
      scaleToastIdRef,
      t
    });
  }, [dismissScaleToast, isReadOnly, resetToolClickHistory, t]);

  const cancelScaleMode = useCallback(() => {
    if (!scaleMode) return;
    setScaleMode(false);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleMetersInput('');
    dismissScaleToast();
    resetToolClickHistory();
    push(t({ it: 'Impostazione scala annullata', en: 'Scale setup cancelled' }), 'info');
  }, [dismissScaleToast, push, resetToolClickHistory, scaleMode, t]);

  const handleScalePoint = useCallback(
    (point: { x: number; y: number }, options?: { shiftKey?: boolean }) => {
      if (!scaleMode) return;
      if (!scaleDraft?.start) {
        setScaleDraft({ start: point });
        setScaleDraftPointer(null);
        return;
      }
      const start = scaleDraft.start;
      const resolved = resolveAxisLockedPoint(point, start, options);
      const distance = Math.hypot(resolved.x - start.x, resolved.y - start.y);
      if (!Number.isFinite(distance) || distance <= 0.0001) return;
      setScaleDraft({ start, end: resolved });
      setScaleDraftPointer(null);
      setScaleMode(false);
      setScaleMetersInput('');
      setScaleModal({ start, end: resolved, distance });
    },
    [resolveAxisLockedPoint, scaleDraft, scaleMode]
  );

  const applyScale = useCallback(() => {
    computeApplyScale({
      computeRoomSurfaceSqm,
      dismissScaleToast,
      isReadOnly,
      markTouched,
      plan,
      planScale,
      push,
      scaleMetersInput,
      scaleModal,
      t,
      updateFloorPlan,
      updateRoom,
      setScaleDraft,
      setScaleDraftPointer,
      setShowScaleLine,
      setScaleModal
    });
  }, [
    computeRoomSurfaceSqm,
    dismissScaleToast,
    isReadOnly,
    markTouched,
    plan,
    planScale?.labelScale,
    planScale?.opacity,
    planScale?.strokeWidth,
    push,
    scaleMetersInput,
    scaleModal,
    t,
    updateFloorPlan,
    updateRoom
  ]);

  return { startScaleMode, cancelScaleMode, handleScalePoint, applyScale };
};
