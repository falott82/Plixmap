const getUserWithPermissions = (db, userId) => {
  const user = db
    .prepare(
      'SELECT id, username, isAdmin, isSuperAdmin, disabled, language, defaultPlanId, clientOrderJson, paletteFavoritesJson, mustChangePassword, tokenVersion, firstName, lastName, phone, email, createdAt, updatedAt FROM users WHERE id = ?'
    )
    .get(userId);
  if (!user) return null;
  const isAdmin = !!user.isAdmin;
  const isSuperAdmin = !!user.isSuperAdmin && user.username === 'superadmin';
  const clientOrder = (() => {
    try {
      const arr = JSON.parse(user.clientOrderJson || '[]');
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })();
  const paletteFavorites = (() => {
    try {
      const arr = JSON.parse(user.paletteFavoritesJson || '[]');
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })();
  const permissions = isAdmin
    ? []
    : db
        .prepare('SELECT scopeType, scopeId, access FROM permissions WHERE userId = ? ORDER BY scopeType, scopeId')
        .all(userId);
  // Do not leak raw JSON column.
  delete user.clientOrderJson;
  delete user.paletteFavoritesJson;
  return {
    user: {
      ...user,
      clientOrder,
      paletteFavorites,
      isAdmin,
      isSuperAdmin,
      disabled: !!user.disabled,
      mustChangePassword: !!user.mustChangePassword
    },
    permissions
  };
};

const computePlanAccess = (clients, permissions) => {
  const clientAccess = new Map();
  const siteAccess = new Map();
  const planAccess = new Map();
  for (const p of permissions || []) {
    const map = p.scopeType === 'client' ? clientAccess : p.scopeType === 'site' ? siteAccess : planAccess;
    const prev = map.get(p.scopeId);
    if (!prev || prev === 'ro') map.set(p.scopeId, p.access);
  }
  const planIdToAccess = new Map();
  for (const client of clients || []) {
    const ca = clientAccess.get(client.id);
    for (const site of client.sites || []) {
      const sa = siteAccess.get(site.id);
      for (const plan of site.floorPlans || []) {
        const pa = planAccess.get(plan.id);
        const eff = pa || sa || ca || null;
        if (eff) planIdToAccess.set(plan.id, eff);
      }
    }
  }
  return planIdToAccess;
};

const filterStateForUser = (clients, planIdToAccess, isAdmin) => {
  if (isAdmin) return clients;
  const out = [];
  for (const client of clients || []) {
    const nextClient = { ...client, sites: [] };
    for (const site of client.sites || []) {
      const nextSite = { ...site, floorPlans: [] };
      for (const plan of site.floorPlans || []) {
        const access = planIdToAccess.get(plan.id);
        if (!access) continue;
        nextSite.floorPlans.push(plan);
      }
      if (nextSite.floorPlans.length) nextClient.sites.push(nextSite);
    }
    if (nextClient.sites.length) out.push(nextClient);
  }
  return out;
};

const mergeWritablePlanContent = (serverClients, incomingClients, writablePlanIds) => {
  const incomingPlanById = new Map();
  for (const client of incomingClients || []) {
    for (const site of client.sites || []) {
      for (const plan of site.floorPlans || []) {
        incomingPlanById.set(plan.id, plan);
      }
    }
  }

  const nextClients = (serverClients || []).map((client) => ({
    ...client,
    sites: (client.sites || []).map((site) => ({
      ...site,
      floorPlans: (site.floorPlans || []).map((plan) => {
        if (!writablePlanIds.has(plan.id)) return plan;
        const incoming = incomingPlanById.get(plan.id);
        if (!incoming) return plan;
        return {
          ...plan,
          objects: Array.isArray(incoming.objects) ? incoming.objects : plan.objects,
          rooms: Array.isArray(incoming.rooms) ? incoming.rooms : plan.rooms,
          views: Array.isArray(incoming.views) ? incoming.views : plan.views,
          layers: Array.isArray(incoming.layers) ? incoming.layers : plan.layers,
          links: Array.isArray(incoming.links) ? incoming.links : plan.links,
          revisions: Array.isArray(incoming.revisions) ? incoming.revisions : plan.revisions
        };
      })
    }))
  }));
  return nextClients;
};

module.exports = {
  getUserWithPermissions,
  computePlanAccess,
  filterStateForUser,
  mergeWritablePlanContent
};
