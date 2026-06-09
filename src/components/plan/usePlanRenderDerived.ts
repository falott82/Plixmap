/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import { SECURITY_LAYER_ID } from '../../store/security';
import { computeCanvasPlan } from './planViewMiscTools';
import { computeSafetyEmergencyContacts } from './planViewComputeBits2';

// Render-derived data (the layer-filtered canvas plan, security-layer visibility, safety
// emergency contacts/points + inline strings, quote labels, quote orientation) extracted from
// usePlanView. Pure read-only derivations; bodies moved verbatim (dep arrays preserved exactly).
export const usePlanRenderDerived = (deps: any) => {
  const {
    allItemsSelected, effectiveVisibleLayerIds, getObjectLayerIdsForVisibility, hideAllLayers,
    rackOverlayLinks, renderPlan, client, planId, site, formatQuoteLabel
  } = deps;

  const canvasPlan = useMemo(() => {
    return computeCanvasPlan({
      allItemsSelected,
      effectiveVisibleLayerIds,
      getObjectLayerIdsForVisibility,
      hideAllLayers,
      rackOverlayLinks,
      renderPlan
    });
  }, [allItemsSelected, effectiveVisibleLayerIds, getObjectLayerIdsForVisibility, hideAllLayers, rackOverlayLinks, renderPlan]);
  const securityLayerVisible = useMemo(
    () => !hideAllLayers && (allItemsSelected || effectiveVisibleLayerIds.includes(SECURITY_LAYER_ID)),
    [allItemsSelected, effectiveVisibleLayerIds, hideAllLayers]
  );
  const safetyEmergencyContacts = useMemo(
    () => computeSafetyEmergencyContacts({ client, planId, site }),
    [client, planId, site?.id]
  );
  const safetyEmergencyPoints = useMemo(() => {
    const objects = (((renderPlan as any)?.objects || []) as any[]).filter((obj) => String(obj?.type || '') === 'safety_assembly_point');
    return objects.map((obj) => ({
      id: String(obj?.id || ''),
      name: String(obj?.name || obj?.type || ''),
      gps: String((obj as any)?.gpsCoords || ''),
      coords: `${Math.round(Number(obj?.x || 0))}, ${Math.round(Number(obj?.y || 0))}`
    }));
  }, [renderPlan]);
  const safetyNumbersInline = useMemo(
    () => safetyEmergencyContacts.map((entry: any) => `| ${entry.name || '—'} ${entry.phone || '—'}`).join(' '),
    [safetyEmergencyContacts]
  );
  const safetyPointsInline = useMemo(
    () => safetyEmergencyPoints.map((point) => `| ${point.name || '—'}`).join(' '),
    [safetyEmergencyPoints]
  );
  const quoteLabels = useMemo(() => {
    const map: Record<string, string> = {};
    const objects = ((canvasPlan || renderPlan) as any)?.objects || [];
    for (const obj of objects) {
      if (!obj || obj.type !== 'quote') continue;
      const pts = obj.points || [];
      const label = formatQuoteLabel(pts);
      const name = String(obj.name || '').trim();
      const combined = name && label ? `${name} · ${label}` : name || label;
      if (combined) map[obj.id] = combined;
    }
    return map;
  }, [canvasPlan, formatQuoteLabel, renderPlan]);

  const getQuoteOrientation = useCallback((points?: { x: number; y: number }[]) => {
    if (!points || points.length < 2) return 'horizontal' as const;
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.abs(dy) > Math.abs(dx) ? ('vertical' as const) : ('horizontal' as const);
  }, []);

  return {
    canvasPlan,
    securityLayerVisible,
    safetyEmergencyContacts,
    safetyEmergencyPoints,
    safetyNumbersInline,
    safetyPointsInline,
    quoteLabels,
    getQuoteOrientation,
  };
};
