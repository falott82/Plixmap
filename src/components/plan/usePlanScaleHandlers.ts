import { useCallback } from 'react';
import { computeHandleScaleMove, computeUpdateScaleStyle } from './planViewQuoteScaleTools';

// Scale-edit handlers extracted from usePlanView (open the scale actions menu on
// double-click, move the scale segment, update its styling, open the calibrate
// modal). Bodies are verbatim; shared deps injected once.
export const usePlanScaleHandlers = (deps: any) => {
  const {
    plan,
    isReadOnly,
    planScale,
    markTouched,
    updateFloorPlan,
    setContextMenu,
    setScaleActionsOpen,
    setScaleMode,
    setScaleDraft,
    setScaleDraftPointer,
    setScaleModal,
    setScaleMetersInput,
    formatNumber
  } = deps;

  const handleScaleDoubleClick = useCallback(() => {
    if (!planScale?.start || !planScale?.end || isReadOnly) return;
    setContextMenu(null);
    setScaleActionsOpen(true);
  }, [isReadOnly, planScale?.end, planScale?.start, setContextMenu, setScaleActionsOpen]);

  const handleScaleMove = useCallback(
    (payload: { start: { x: number; y: number }; end: { x: number; y: number } }) =>
      computeHandleScaleMove(payload, { plan, isReadOnly, planScale, markTouched, updateFloorPlan }),
    [isReadOnly, markTouched, plan, planScale?.meters, planScale?.metersPerPixel, updateFloorPlan]
  );

  const updateScaleStyle = useCallback(
    (payload: { labelScale?: number; strokeWidth?: number }) =>
      computeUpdateScaleStyle(payload, { plan, isReadOnly, planScale, markTouched, updateFloorPlan }),
    [isReadOnly, markTouched, plan, planScale?.end, planScale?.meters, planScale?.metersPerPixel, planScale?.opacity, planScale?.start, updateFloorPlan]
  );

  const openScaleEdit = useCallback(() => {
    if (!planScale?.start || !planScale?.end || isReadOnly) return;
    const distance = Math.hypot(planScale.end.x - planScale.start.x, planScale.end.y - planScale.start.y);
    if (!Number.isFinite(distance) || distance <= 0) return;
    setScaleMode(false);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleModal({ start: planScale.start, end: planScale.end, distance });
    const meters = Number(planScale.meters);
    setScaleMetersInput(Number.isFinite(meters) ? formatNumber(meters) : '');
  }, [formatNumber, isReadOnly, planScale?.end, planScale?.meters, planScale?.start, setScaleDraft, setScaleDraftPointer, setScaleMetersInput, setScaleModal, setScaleMode]);

  return { handleScaleDoubleClick, handleScaleMove, updateScaleStyle, openScaleEdit };
};
