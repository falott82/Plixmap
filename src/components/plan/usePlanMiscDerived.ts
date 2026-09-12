/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import type { FloorPlan, FloorPlanView } from '../../store/types';
import { computeLinksInSelection } from './planViewComputeBits2';

// Miscellaneous plan derivations (assigned external-user counts, business-partner directory access,
// ordered views, print-area flag, corridor-connection target plans, links-in-selection, object name
// lookup) extracted from usePlanView. Pure derivations; bodies moved verbatim (dep arrays preserved).
export const usePlanMiscDerived = (deps: any) => {
  const {
    client, isSuperAdmin, user, basePlan, showPrintAreaByPlan, site, planId, selectedObjectIds,
    selectionAllRealUsers, selectedLinkId, renderPlanObjectById
  } = deps;

  const assignedCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!client) return map;
    for (const s of client.sites || []) {
      for (const p of s.floorPlans || []) {
        for (const o of p.objects || []) {
          const cid = (o as any).externalClientId;
          const eid = (o as any).externalUserId;
          if (!cid || !eid) continue;
          const key = `${cid}:${eid}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    }
    return map;
  }, [client]);
  const canOpenBusinessPartnersDirectory = useMemo(
    () => !!isSuperAdmin || !!user?.isAdmin || (user as any)?.canManageBusinessPartners === true,
    [isSuperAdmin, user]
  );

  const orderedViews = useMemo<FloorPlanView[]>(() => {
    const list = (basePlan?.views || []) as FloorPlanView[];
    if (!list.length) return list;
    return list.slice().sort((a, b) => {
      const aDef = a.isDefault ? 1 : 0;
      const bDef = b.isDefault ? 1 : 0;
      if (aDef !== bDef) return bDef - aDef;
      return 0;
    });
  }, [basePlan?.views]);
  const showPrintArea = !!(showPrintAreaByPlan as any)?.[basePlan?.id];
  const corridorConnectionTargetPlans = useMemo(
    () => ((site?.floorPlans || []) as FloorPlan[]).filter((p) => p.id !== planId),
    [planId, site?.floorPlans]
  );

  const linksInSelection = useMemo(
    () => computeLinksInSelection({ basePlan, selectedObjectIds, selectionAllRealUsers, selectedLinkId }),
    [basePlan, selectedLinkId, selectedObjectIds, selectionAllRealUsers]
  );

  const getObjectNameById = useCallback(
    (id: string) => renderPlanObjectById.get(id)?.name || id,
    [renderPlanObjectById]
  );

  return {
    assignedCounts,
    canOpenBusinessPartnersDirectory,
    orderedViews,
    showPrintArea,
    corridorConnectionTargetPlans,
    linksInSelection,
    getObjectNameById,
  };
};
