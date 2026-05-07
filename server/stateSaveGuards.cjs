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

const hasStateSaveVersionConflict = (expectedUpdatedAt, currentUpdatedAt) => {
  const expected = Number(expectedUpdatedAt || 0);
  const current = Number(currentUpdatedAt || 0);
  if (!Number.isFinite(expected) || expected <= 0) return false;
  if (!Number.isFinite(current) || current <= 0) return false;
  return expected !== current;
};

module.exports = {
  getWritablePlanIdsForStateSave,
  hasStateSaveVersionConflict
};
