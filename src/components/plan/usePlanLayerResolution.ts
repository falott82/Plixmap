/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { LayerDefinition, MapObject } from '../../store/types';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';
import { SECURITY_LAYER_ID } from '../../store/security';
import { getDefaultVisiblePlanLayerIds, normalizePlanLayerSelection } from '../../utils/layerVisibility';
import { computeGetTypeLayerIds, computeGetLayerIdsForType, computeGetObjectLayerIdsForVisibility } from './planViewLayerResolution';
import { computeGetLayerLabel, computeGetObjectToastLabel } from './planViewComputeBits';
import { computeGetObjectBoundsForAlign } from './planViewComputeBits2';
import { computeEnsureObjectLayerVisible } from './planViewSearchScheduleTools';
import { runLayerVisibilityInitEffect } from './planViewEffects';

// Plan layer resolution (ordered layers, layer-id sets, per-type layer inference, visibility
// selection, reveal prompts, layer-aware toast labels) extracted from usePlanView. Bodies moved
// verbatim (dep arrays preserved). Owns the layer-activation + visibility-init effects internally.
export const usePlanLayerResolution = (deps: any) => {
  const {
    client, t, lang, planId, visibleLayerIdsByPlan, hiddenLayersByPlan, setVisibleLayerIds,
    setHideAllLayers, push, setLayerRevealPrompt, canvasStageRef, inferDefaultLayerIds, getTypeLabel
  } = deps;

  const planLayers = useMemo(() => {
    const layers = (client?.layers || []) as LayerDefinition[];
    return [...layers].sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
  }, [client?.layers]);
  const orderedPlanLayers = useMemo(() => {
    const idx = planLayers.findIndex((layer) => String(layer.id) === ALL_ITEMS_LAYER_ID);
    if (idx <= 0) return planLayers;
    const next = planLayers.slice();
    const [allItems] = next.splice(idx, 1);
    return [allItems, ...next];
  }, [planLayers]);
  const allItemsLabel = t({ it: 'Mostra Tutto', en: 'Show All' });
  const layerIds = useMemo(() => planLayers.map((l: any) => String(l.id)), [planLayers]);
  const nonAllLayerIds = useMemo(
    () => layerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID),
    [layerIds]
  );
  const defaultVisibleLayerIds = useMemo(
    () => getDefaultVisiblePlanLayerIds(layerIds, ALL_ITEMS_LAYER_ID, [SECURITY_LAYER_ID]),
    [layerIds]
  );
  const layerIdSet = useMemo(() => new Set(layerIds), [layerIds]);
  const normalizeLayerSelection = useCallback(
    (ids: string[]) => normalizePlanLayerSelection(layerIds, ids, ALL_ITEMS_LAYER_ID),
    [layerIds]
  );
  const getTypeLayerIds = useCallback((typeId: string) => computeGetTypeLayerIds(typeId, planLayers), [planLayers]);
  const getLayerIdsForType = useCallback(
    (typeId: string) => computeGetLayerIdsForType(typeId, { planLayers, inferDefaultLayerIds, layerIdSet }),
    [planLayers, inferDefaultLayerIds, layerIdSet]
  );
  const getObjectLayerIdsForVisibility = useCallback(
    (obj: MapObject) => computeGetObjectLayerIdsForVisibility(obj, { planLayers, inferDefaultLayerIds, layerIdSet }),
    [planLayers, inferDefaultLayerIds, layerIdSet]
  );
  const prevLayerIdsByPlanRef = useRef<Record<string, string[]>>({});
  const visibleLayerIds = useMemo(() => {
    const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
    if (typeof current === 'undefined') return normalizeLayerSelection(defaultVisibleLayerIds);
    return normalizeLayerSelection(current);
  }, [defaultVisibleLayerIds, normalizeLayerSelection, planId, visibleLayerIdsByPlan]);
  const hideAllLayers = !!hiddenLayersByPlan[planId];
  const allItemsSelected = visibleLayerIds.includes(ALL_ITEMS_LAYER_ID);
  const effectiveVisibleLayerIds = hideAllLayers
    ? []
    : allItemsSelected
      ? nonAllLayerIds
      : visibleLayerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID);
  const visibleLayerCount = hideAllLayers ? 0 : allItemsSelected ? nonAllLayerIds.length : effectiveVisibleLayerIds.length;
  const totalLayerCount = nonAllLayerIds.length;
  const layerActivationRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    layerActivationRef.current = new Set(effectiveVisibleLayerIds);
  }, [effectiveVisibleLayerIds]);

  const getLayerLabel = useCallback(
    (layerId: string) => computeGetLayerLabel(layerId, { planLayers, lang }),
    [lang, planLayers]
  );
  const getObjectToastLabel = useCallback(
    (name: string | undefined, typeId: string) => computeGetObjectToastLabel(name, typeId, getTypeLabel),
    [getTypeLabel]
  );
  const promptRevealForObject = useCallback(
    (obj: MapObject) => {
      const normalizedLayerIds = getObjectLayerIdsForVisibility(obj);
      if (!normalizedLayerIds.length) return false;
      const visibleSet = new Set(effectiveVisibleLayerIds);
      const missing = hideAllLayers
        ? normalizedLayerIds
        : normalizedLayerIds.filter((layerId) => !visibleSet.has(layerId));
      if (!missing.length) return false;
      setLayerRevealPrompt({
        objectId: obj.id,
        objectName: String(obj.name || ''),
        typeId: obj.type,
        missingLayerIds: Array.from(new Set(missing))
      });
      return true;
    },
    [effectiveVisibleLayerIds, getObjectLayerIdsForVisibility, hideAllLayers]
  );
  const getObjectBoundsForAlign = useCallback(
    (obj: MapObject) => computeGetObjectBoundsForAlign(obj, { canvasStageRef }),
    []
  );
  const ensureObjectLayerVisible = useCallback(
    (layerIds: string[] | undefined, name: string | undefined, typeId: string) =>
      computeEnsureObjectLayerVisible(layerIds, name, typeId, {
        getLayerLabel,
        getObjectToastLabel,
        hideAllLayers,
        layerIdSet,
        normalizeLayerSelection,
        planId,
        push,
        setHideAllLayers,
        setVisibleLayerIds,
        t,
        visibleLayerIds,
        layerActivationRef
      }),
    [
      getLayerLabel,
      getObjectToastLabel,
      hideAllLayers,
      layerIdSet,
      normalizeLayerSelection,
      planId,
      push,
      setHideAllLayers,
      setVisibleLayerIds,
      t,
      visibleLayerIds
    ]
  );
  useEffect(() => runLayerVisibilityInitEffect({
    layerIds, visibleLayerIdsByPlan, planId, prevLayerIdsByPlanRef, normalizeLayerSelection, defaultVisibleLayerIds, setVisibleLayerIds
  }), [defaultVisibleLayerIds, layerIds, normalizeLayerSelection, planId, setVisibleLayerIds, visibleLayerIdsByPlan]);

  return {
    planLayers,
    orderedPlanLayers,
    allItemsLabel,
    layerIds,
    nonAllLayerIds,
    defaultVisibleLayerIds,
    layerIdSet,
    normalizeLayerSelection,
    getTypeLayerIds,
    getLayerIdsForType,
    getObjectLayerIdsForVisibility,
    visibleLayerIds,
    hideAllLayers,
    allItemsSelected,
    effectiveVisibleLayerIds,
    visibleLayerCount,
    totalLayerCount,
    getLayerLabel,
    getObjectToastLabel,
    promptRevealForObject,
    getObjectBoundsForAlign,
    ensureObjectLayerVisible,
  };
};
