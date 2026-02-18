export const normalizePlanLayerSelection = (
  planLayerIds: string[],
  ids: string[],
  allItemsLayerId: string
): string[] => {
  const orderedLayerIds = planLayerIds.map((id) => String(id));
  const layerSet = new Set(orderedLayerIds);
  const nonAllLayerIds = orderedLayerIds.filter((id) => id !== allItemsLayerId);
  const filtered = Array.from(new Set(ids.map((id) => String(id)).filter((id) => layerSet.has(id))));
  let ordered = orderedLayerIds.filter((id) => filtered.includes(id));
  if (!nonAllLayerIds.length) {
    return layerSet.has(allItemsLayerId) ? [allItemsLayerId] : ordered;
  }
  const hasAll = nonAllLayerIds.every((id) => ordered.includes(id));
  if (hasAll) {
    if (!ordered.includes(allItemsLayerId) && layerSet.has(allItemsLayerId)) {
      ordered = [allItemsLayerId, ...ordered];
    }
  } else {
    ordered = ordered.filter((id) => id !== allItemsLayerId);
  }
  return ordered;
};

export const getDefaultVisiblePlanLayerIds = (
  planLayerIds: string[],
  allItemsLayerId: string,
  hiddenByDefaultLayerIds: string[] = []
): string[] =>
  normalizePlanLayerSelection(
    planLayerIds,
    planLayerIds.filter((id) => id !== allItemsLayerId && !hiddenByDefaultLayerIds.includes(id)),
    allItemsLayerId
  );

export const getEffectiveVisibleLayerIds = (
  normalizedLayerIds: string[],
  hideAllLayers: boolean,
  allItemsLayerId: string
): string[] => {
  if (hideAllLayers) return [];
  const nonAllLayerIds = normalizedLayerIds.filter((id) => id !== allItemsLayerId);
  if (normalizedLayerIds.includes(allItemsLayerId)) return nonAllLayerIds;
  return nonAllLayerIds;
};
