import { useCallback } from 'react';
import { computeOpenEscapeRouteAt } from './planViewSearchScheduleTools';
import { runToggleSecurityCardVisibility } from './planViewComputeBits2';

// Security/safety handlers extracted from usePlanView (open the escape-route
// modal at a point, toggle the security-card layer visibility). Bodies are
// verbatim; shared deps injected once.
export const usePlanSecurityHandlers = (deps: any) => {
  const {
    contextMenu,
    plan,
    planId,
    push,
    renderPlan,
    siteFloorPlansLength,
    t,
    hideAllLayers,
    allItemsSelected,
    nonAllLayerIds,
    visibleLayerIds,
    normalizeLayerSelection,
    setEscapeRouteModal,
    setContextMenu,
    setHideAllLayers,
    setVisibleLayerIds
  } = deps;

  const openEscapeRouteAt = useCallback(
    (point: { x: number; y: number }, sourceKind: 'map' | 'room' | 'corridor') =>
      computeOpenEscapeRouteAt(point, sourceKind, {
        contextMenu,
        plan,
        planId,
        push,
        renderPlan,
        siteFloorPlansLength,
        t,
        setEscapeRouteModal,
        setContextMenu
      }),
    [contextMenu, plan, planId, push, renderPlan, siteFloorPlansLength, t, setEscapeRouteModal, setContextMenu]
  );

  const toggleSecurityCardVisibility = useCallback(() => {
    runToggleSecurityCardVisibility({
      hideAllLayers,
      allItemsSelected,
      nonAllLayerIds,
      visibleLayerIds,
      setHideAllLayers,
      setVisibleLayerIds,
      planId,
      normalizeLayerSelection
    });
  }, [allItemsSelected, hideAllLayers, nonAllLayerIds, normalizeLayerSelection, planId, setHideAllLayers, setVisibleLayerIds, visibleLayerIds]);

  return { openEscapeRouteAt, toggleSecurityCardVisibility };
};
