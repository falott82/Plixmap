const getWritablePlanIdsForStateSave = (access, blockedPlanIds = []) => {
  const blocked = new Set(
    Array.isArray(blockedPlanIds)
      ? blockedPlanIds.map((planId) => String(planId || '').trim()).filter(Boolean)
      : []
  );
  const writablePlanIds = new Set();
  for (const [planId, level] of access instanceof Map ? access.entries() : []) {
    const normalizedPlanId = String(planId || '').trim();
    if (!normalizedPlanId) continue;
    if (level !== 'rw') continue;
    if (blocked.has(normalizedPlanId)) continue;
    writablePlanIds.add(normalizedPlanId);
  }
  return writablePlanIds;
};

module.exports = {
  getWritablePlanIdsForStateSave
};
