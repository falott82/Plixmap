// Plan-revision persistence extracted from index.cjs: a small DB-backed store
// (with an in-memory cache) for per-plan revision lists, plus helpers to strip
// inline revisions from client payloads and to reconcile stored revisions.
const createPlanRevisionStore = ({ db }) => {
const planRevisionsCache = new Map();

const parseRevisionListJson = (raw) => {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getPlanRevisions = (planId) => {
  const key = String(planId || '').trim();
  if (!key) return [];
  if (planRevisionsCache.has(key)) return planRevisionsCache.get(key) || [];
  const row = db.prepare('SELECT revisionsJson FROM plan_revisions WHERE planId = ?').get(key);
  const revisions = parseRevisionListJson(row?.revisionsJson);
  planRevisionsCache.set(key, revisions);
  return revisions;
};

const setPlanRevisions = (planId, revisions, updatedAt = Date.now()) => {
  const key = String(planId || '').trim();
  if (!key) return [];
  const normalized = Array.isArray(revisions) ? revisions : [];
  if (normalized.length) {
    db.prepare(
      `INSERT INTO plan_revisions (planId, revisionsJson, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(planId) DO UPDATE SET revisionsJson = excluded.revisionsJson, updatedAt = excluded.updatedAt`
    ).run(key, JSON.stringify(normalized), updatedAt);
  } else {
    db.prepare('DELETE FROM plan_revisions WHERE planId = ?').run(key);
  }
  planRevisionsCache.set(key, normalized);
  return normalized;
};

const stripPlanRevisionsFromClients = (clients) => {
  if (!Array.isArray(clients)) return;
  for (const client of clients || []) {
    for (const site of client?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        if (plan && typeof plan === 'object' && 'revisions' in plan) delete plan.revisions;
      }
    }
  }
};

const replaceStoredPlanRevisionsFromClients = (clients, updatedAt) => {
  const nextPlanIds = new Set();
  if (Array.isArray(clients)) {
    for (const client of clients || []) {
      for (const site of client?.sites || []) {
        for (const plan of site?.floorPlans || []) {
          const planId = String(plan?.id || '').trim();
          if (!planId) continue;
          nextPlanIds.add(planId);
          setPlanRevisions(planId, Array.isArray(plan?.revisions) ? plan.revisions : [], updatedAt);
        }
      }
    }
  }
  const existingRows = db.prepare('SELECT planId FROM plan_revisions').all();
  const deleteRevisionSet = db.prepare('DELETE FROM plan_revisions WHERE planId = ?');
  for (const row of existingRows || []) {
    const planId = String(row?.planId || '').trim();
    if (!planId || nextPlanIds.has(planId)) continue;
    deleteRevisionSet.run(planId);
    planRevisionsCache.delete(planId);
  }
};

  return {
    getPlanRevisions,
    setPlanRevisions,
    stripPlanRevisionsFromClients,
    replaceStoredPlanRevisionsFromClients
  };
};

module.exports = { createPlanRevisionStore };
