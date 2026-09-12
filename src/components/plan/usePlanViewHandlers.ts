import { useCallback } from 'react';
import type { FloorPlanView } from '../../store/types';

// Saved-view handlers extracted from usePlanView (apply a view, save the current
// viewport as a new view, overwrite a view, jump to the default view). Bodies
// are verbatim; shared deps injected once.
export const usePlanViewHandlers = (deps: any) => {
  const {
    renderPlan,
    plan,
    isReadOnly,
    zoom,
    pan,
    saveViewport,
    addView,
    updateView,
    push,
    t,
    setAutoFitEnabled,
    setZoom,
    setPan,
    setSelectedViewId,
    setViewsMenuOpen
  } = deps;

  const applyView = useCallback(
    (view: FloorPlanView) => {
      if (!renderPlan) return;
      setAutoFitEnabled(false);
      setZoom(view.zoom);
      setPan(view.pan);
      saveViewport(renderPlan.id, view.zoom, view.pan);
      setSelectedViewId(view.id);
    },
    [renderPlan, saveViewport, setAutoFitEnabled, setPan, setSelectedViewId, setZoom]
  );

  const handleSaveView = (payload: { name: string; description?: string; isDefault: boolean }) => {
    if (!plan || isReadOnly) return;
    const id = addView(plan.id, { ...payload, zoom, pan, isDefault: payload.isDefault });
    push(t({ it: 'Vista salvata', en: 'View saved' }), 'success');
    setSelectedViewId(id);
    setViewsMenuOpen(false);
  };

  const handleOverwriteView = useCallback(
    (view: FloorPlanView) => {
      if (!plan || isReadOnly) return;
      updateView(plan.id, view.id, { zoom, pan });
      push(t({ it: 'Vista sovrascritta', en: 'View overwritten' }), 'success');
      setSelectedViewId(view.id);
      setViewsMenuOpen(false);
    },
    [isReadOnly, pan, plan, push, t, updateView, zoom, setSelectedViewId, setViewsMenuOpen]
  );

  const goToDefaultView = () => {
    const current = renderPlan;
    if (!current) return;
    const def = current.views?.find((v: FloorPlanView) => v.isDefault);
    if (!def) {
      push(t({ it: 'Nessuna vista di default', en: 'No default view' }), 'info');
      return;
    }
    applyView(def);
    push(t({ it: 'Vista di default caricata', en: 'Default view loaded' }), 'success');
  };

  return { applyView, handleSaveView, handleOverwriteView, goToDefaultView };
};
