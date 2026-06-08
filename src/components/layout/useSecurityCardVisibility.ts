import { useMemo } from 'react';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';
import { SECURITY_LAYER_ID } from '../../store/security';
import {
  getDefaultVisiblePlanLayerIds as getDefaultVisiblePlanLayerIdsUtil,
  normalizePlanLayerSelection as normalizePlanLayerSelectionUtil
} from '../../utils/layerVisibility';

export type UseSecurityCardVisibilityParams = {
  planLayerIdsByPlan: Record<string, string[]>;
  visibleLayerIdsByPlan: Record<string, unknown>;
  hiddenLayersByPlan: Record<string, unknown>;
  setVisibleLayerIds: (...args: any[]) => any;
  setHideAllLayers: (...args: any[]) => any;
};

/**
 * Derives and toggles the security-card (safety layer) visibility for a plan,
 * mirroring the per-plan layer-selection rules. Extracted from SidebarTree.tsx.
 */
export const useSecurityCardVisibility = ({
  planLayerIdsByPlan,
  visibleLayerIdsByPlan,
  hiddenLayersByPlan,
  setVisibleLayerIds,
  setHideAllLayers
}: UseSecurityCardVisibilityParams) => {
  const normalizePlanLayerSelectionForPlan = useMemo(
    () => (planLayerIds: string[], ids: string[]) => normalizePlanLayerSelectionUtil(planLayerIds, ids, ALL_ITEMS_LAYER_ID),
    []
  );
  const getPlanLayerIds = useMemo(
    () => (planId: string) => {
      const known = planLayerIdsByPlan[planId] || [];
      if (known.length) return known;
      return Array.from(new Set([ALL_ITEMS_LAYER_ID, SECURITY_LAYER_ID, ...((visibleLayerIdsByPlan[planId] || []) as string[])]));
    },
    [planLayerIdsByPlan, visibleLayerIdsByPlan]
  );
  const getDefaultVisiblePlanLayerIds = useMemo(
    () => (planLayerIds: string[]) =>
      getDefaultVisiblePlanLayerIdsUtil(planLayerIds, ALL_ITEMS_LAYER_ID, [SECURITY_LAYER_ID]),
    []
  );
  const isSecurityCardVisibleForPlan = useMemo(
    () => (planId: string) => {
      if (!planId) return false;
      if (hiddenLayersByPlan[planId]) return false;
      const layerIds = getPlanLayerIds(planId);
      const nonAllLayerIds = layerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
      const visible =
        typeof current === 'undefined'
          ? getDefaultVisiblePlanLayerIds(layerIds)
          : normalizePlanLayerSelectionForPlan(layerIds, current);
      const allItemsSelected = visible.includes(ALL_ITEMS_LAYER_ID);
      const effective = allItemsSelected ? nonAllLayerIds : visible.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      return effective.includes(SECURITY_LAYER_ID);
    },
    [getDefaultVisiblePlanLayerIds, getPlanLayerIds, hiddenLayersByPlan, normalizePlanLayerSelectionForPlan, visibleLayerIdsByPlan]
  );
  const toggleSecurityCardVisibilityForPlan = useMemo(
    () => (planId: string) => {
      if (!planId) return;
      const layerIds = getPlanLayerIds(planId);
      const nonAllLayerIds = layerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
      const hideAll = !!hiddenLayersByPlan[planId];
      const visible =
        typeof current === 'undefined'
          ? getDefaultVisiblePlanLayerIds(layerIds)
          : normalizePlanLayerSelectionForPlan(layerIds, current);
      const allItemsSelected = visible.includes(ALL_ITEMS_LAYER_ID);
      const baseVisible = hideAll ? [] : allItemsSelected ? nonAllLayerIds : visible.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      const hasSecurity = baseVisible.includes(SECURITY_LAYER_ID);
      const nextRaw = hasSecurity
        ? baseVisible.filter((id) => id !== SECURITY_LAYER_ID)
        : [...baseVisible, SECURITY_LAYER_ID];
      if (hideAll) setHideAllLayers(planId, false);
      setVisibleLayerIds(planId, normalizePlanLayerSelectionForPlan(layerIds, nextRaw));
    },
    [
      getDefaultVisiblePlanLayerIds,
      getPlanLayerIds,
      hiddenLayersByPlan,
      normalizePlanLayerSelectionForPlan,
      setHideAllLayers,
      setVisibleLayerIds,
      visibleLayerIdsByPlan
    ]
  );

  return { isSecurityCardVisibleForPlan, toggleSecurityCardVisibilityForPlan };
};
