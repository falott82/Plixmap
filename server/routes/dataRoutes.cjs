const registerDataRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    markLogsCleared,
    listCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getObjectCustomValues,
    setObjectCustomValues,
    validateValuesAgainstFields,
    readState,
    writeState,
    getUserWithPermissions,
    buildPermissionCacheKey,
    filteredStateCache,
    computePlanAccess,
    filterStateForUser,
    getWritablePlanIdsForStateSave,
    mergeWritablePlanContent,
    validateAssetsInClients,
    purgeExpiredLocks,
    planLocks,
    planLockGrants
  } = deps;

  app.post('/api/audit', requireAuth, (req, res) => {
    const { event, level, scopeType, scopeId, details } = req.body || {};
    if (!event || typeof event !== 'string') {
      res.status(400).json({ error: 'Missing event' });
      return;
    }
    // Only allow client-side audit events from authenticated users; the server decides whether verbose is enabled.
    const ctx = getUserWithPermissions(db, req.userId);
    writeAuditLog(db, {
      level: level === 'verbose' ? 'verbose' : 'important',
      event: String(event).slice(0, 80),
      userId: req.userId,
      username: ctx?.user?.username || null,
      scopeType: scopeType ? String(scopeType).slice(0, 16) : null,
      scopeId: scopeId ? String(scopeId).slice(0, 128) : null,
      ...requestMeta(req),
      details: details && typeof details === 'object' ? details : details ? { value: String(details) } : null
    });
    res.json({ ok: true });
  });
  
  app.get('/api/audit', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const q = String(req.query.q || '').trim().toLowerCase();
    const level = String(req.query.level || 'all');
    const scopeType = String(req.query.scopeType || '').trim().toLowerCase();
    const scopeId = String(req.query.scopeId || '').trim();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const where = [];
    const params = {};
    if (level === 'important' || level === 'verbose') {
      where.push('level = @level');
      params.level = level;
    }
    if (q) {
      where.push(`(LOWER(event) LIKE @q OR LOWER(COALESCE(username,'')) LIKE @q OR LOWER(COALESCE(details,'')) LIKE @q OR LOWER(COALESCE(scopeId,'')) LIKE @q)`);
      params.q = `%${q}%`;
    }
    if (scopeType) {
      where.push('LOWER(COALESCE(scopeType, \'\')) = @scopeType');
      params.scopeType = scopeType;
    }
    if (scopeId) {
      where.push('COALESCE(scopeId, \'\') = @scopeId');
      params.scopeId = scopeId;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(
      db
        .prepare(
          `SELECT COUNT(1) as c
           FROM audit_log
           ${whereSql}`
        )
        .get({ ...params })?.c || 0
    );
    const rows = db
      .prepare(
        `SELECT id, ts, level, event, userId, username, ip, method, path, userAgent, scopeType, scopeId, details
         FROM audit_log
         ${whereSql}
         ORDER BY id DESC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset })
      .map((r) => ({
        ...r,
        details: (() => {
          try {
            return r.details ? JSON.parse(r.details) : null;
          } catch {
            return r.details;
          }
        })()
      }));
    res.json({ rows, limit, offset, total });
  });
  
  app.post('/api/audit/clear', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    db.prepare('DELETE FROM audit_log').run();
    markLogsCleared('audit', req.userId, req.username);
    writeAuditLog(db, { level: 'important', event: 'audit_log_cleared', userId: req.userId, username: req.username, ...requestMeta(req) });
    res.json({ ok: true });
  });
  
  // --- Per-user custom fields for objects (profile-scoped) ---
  app.get('/api/custom-fields', requireAuth, (req, res) => {
    res.json({ fields: listCustomFields(db, req.userId) });
  });
  
  app.post('/api/custom-fields', requireAuth, (req, res) => {
    const result = createCustomField(db, req.userId, req.body || {});
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Invalid payload' });
      return;
    }
    writeAuditLog(db, { level: 'important', event: 'custom_field_create', userId: req.userId, ...requestMeta(req), details: { id: result.id } });
    res.json({ ok: true, id: result.id });
  });
  
  app.post('/api/custom-fields/bulk', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const typeId = String(req.body?.typeId || '').trim();
    const fields = Array.isArray(req.body?.fields) ? req.body.fields : [];
    const nextFields = fields
      .map((f) => ({
        label: String(f?.label || '').trim(),
        valueType: f?.valueType === 'number' ? 'number' : f?.valueType === 'boolean' ? 'boolean' : f?.valueType === 'string' ? 'string' : ''
      }))
      .filter((f) => f.label && f.valueType);
    if (!typeId) {
      res.status(400).json({ error: 'Missing typeId' });
      return;
    }
    if (!nextFields.length) {
      res.json({ ok: true, created: 0 });
      return;
    }
    const users = db.prepare('SELECT id FROM users').all();
    const tx = db.transaction(() => {
      for (const u of users) {
        for (const f of nextFields) {
          createCustomField(db, u.id, { typeId, label: f.label, valueType: f.valueType });
        }
      }
    });
    try {
      tx();
    } catch {
      // ignore
    }
    writeAuditLog(db, {
      level: 'important',
      event: 'custom_field_bulk_create',
      userId: req.userId,
      ...requestMeta(req),
      details: { typeId, fields: nextFields.length }
    });
    res.json({ ok: true, created: nextFields.length * users.length });
  });
  
  app.put('/api/custom-fields/:id', requireAuth, (req, res) => {
    const result = updateCustomField(db, req.userId, req.params.id, req.body || {});
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Invalid payload' });
      return;
    }
    writeAuditLog(db, { level: 'important', event: 'custom_field_update', userId: req.userId, ...requestMeta(req), details: { id: String(req.params.id) } });
    res.json({ ok: true });
  });
  
  app.delete('/api/custom-fields/:id', requireAuth, (req, res) => {
    const result = deleteCustomField(db, req.userId, req.params.id);
    if (!result.ok) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    writeAuditLog(db, { level: 'important', event: 'custom_field_delete', userId: req.userId, ...requestMeta(req), details: { id: String(req.params.id) } });
    res.json({ ok: true });
  });
  
  app.get('/api/object-custom/:objectId', requireAuth, (req, res) => {
    const objectId = String(req.params.objectId || '').trim();
    if (!objectId) {
      res.status(400).json({ error: 'Missing objectId' });
      return;
    }
    const values = getObjectCustomValues(db, req.userId, objectId);
    res.json({ values });
  });
  
  app.put('/api/object-custom/:objectId', requireAuth, (req, res) => {
    const objectId = String(req.params.objectId || '').trim();
    const typeId = String(req.body?.typeId || '').trim();
    if (!objectId || !typeId) {
      res.status(400).json({ error: 'Missing objectId/typeId' });
      return;
    }
    const fields = listCustomFields(db, req.userId).filter((f) => String(f.typeId) === typeId);
    const next = validateValuesAgainstFields(fields, req.body?.values || {});
    setObjectCustomValues(db, req.userId, objectId, next);
    res.json({ ok: true });
  });
  
  app.get('/api/state', requireAuth, (req, res) => {
    const state = readState();
    if (req.isAdmin) {
      res.json(state);
      return;
    }
    const ctx = getUserWithPermissions(db, req.userId);
    const stateVersionKey = String(state?.updatedAt || '0');
    const permissionKey = buildPermissionCacheKey(ctx);
    const cacheKey = `${stateVersionKey}::${permissionKey}`;
    const cached = filteredStateCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const access = computePlanAccess(state.clients, ctx?.permissions || []);
    const filtered = filterStateForUser(state.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
    const payload = { clients: filtered, objectTypes: state.objectTypes, updatedAt: state.updatedAt };
    filteredStateCache.set(cacheKey, payload);
    res.json(payload);
  });
  
  app.put('/api/state', requireAuth, rateByUser('state_save', 60 * 1000, 240), (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || !('clients' in body)) {
      res.status(400).json({ error: 'Invalid payload (expected {clients})' });
      return;
    }
    const assetValidation = validateAssetsInClients(body.clients);
    if (!assetValidation.ok) {
      res.status(400).json({
        error: 'Invalid upload',
        details: {
          field: assetValidation.field,
          reason: assetValidation.reason,
          mime: assetValidation.mime,
          maxBytes: assetValidation.maxBytes
        }
      });
      return;
    }
    const serverState = readState();
    const lockedByOthers = new Set();
    purgeExpiredLocks();
    for (const [planId, lock] of planLocks.entries()) {
      if (!lock) continue;
      if (lock.userId && lock.userId !== req.userId) lockedByOthers.add(planId);
    }
    for (const [planId, grant] of planLockGrants.entries()) {
      if (!grant) continue;
      if (grant.expiresAt && grant.expiresAt <= Date.now()) continue;
      const lock = planLocks.get(planId);
      if (lock?.userId) continue;
      if (grant.userId && grant.userId !== req.userId) lockedByOthers.add(planId);
    }
  
    const buildPlanMap = (clients) => {
      const map = new Map();
      for (const c of clients || []) {
        for (const s of c?.sites || []) {
          for (const p of s?.floorPlans || []) {
            if (p?.id) map.set(p.id, p);
          }
        }
      }
      return map;
    };
  
    const hasPlanId = (clients, planId) => {
      for (const c of clients || []) {
        for (const s of c?.sites || []) {
          for (const p of s?.floorPlans || []) {
            if (p?.id === planId) return true;
          }
        }
      }
      return false;
    };
  
    const applyLockedPlans = (incomingClients) => {
      if (!lockedByOthers.size) return incomingClients;
      const serverPlans = buildPlanMap(serverState.clients);
      // Prevent destructive operations on a plan that is currently locked by another user.
      for (const planId of lockedByOthers) {
        if (hasPlanId(serverState.clients, planId) && !hasPlanId(incomingClients, planId)) {
          res.status(423).json({ error: 'Plan is locked', planId });
          return null;
        }
      }
      // Replace any locked plan with the server version to avoid overwriting concurrent edits.
      for (const c of incomingClients || []) {
        for (const s of c?.sites || []) {
          for (let i = 0; i < (s?.floorPlans || []).length; i += 1) {
            const p = s.floorPlans[i];
            if (!p?.id) continue;
            if (!lockedByOthers.has(p.id)) continue;
            const serverPlan = serverPlans.get(p.id);
            if (serverPlan) s.floorPlans[i] = serverPlan;
          }
        }
      }
      return incomingClients;
    };
  
    if (req.isAdmin) {
      const incomingClients = Array.isArray(body.clients) ? body.clients : [];
      const lockedApplied = applyLockedPlans(incomingClients);
      if (!lockedApplied) return;
      const incomingIds = new Set((lockedApplied || []).map((c) => c.id));
      const removedClientIds = (serverState.clients || []).map((c) => c.id).filter((id) => id && !incomingIds.has(id));
      if (removedClientIds.length) {
        const delUsers = db.prepare('DELETE FROM external_users WHERE clientId = ?');
        const delCfg = db.prepare('DELETE FROM client_user_import WHERE clientId = ?');
        const tx = db.transaction((ids) => {
          for (const cid of ids) {
            delUsers.run(cid);
            delCfg.run(cid);
          }
        });
        tx(removedClientIds);
        for (const cid of removedClientIds) {
          writeAuditLog(db, { level: 'important', event: 'import_cleanup', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { reason: 'client_deleted' } });
        }
      }
      const payload = { clients: lockedApplied, objectTypes: Array.isArray(body.objectTypes) ? body.objectTypes : serverState.objectTypes };
      const updatedAt = writeState(payload);
      res.json({ ok: true, updatedAt, clients: payload.clients, objectTypes: payload.objectTypes });
      return;
    }
    const ctx = getUserWithPermissions(db, req.userId);
    const access = computePlanAccess(serverState.clients, ctx?.permissions || []);
    const writablePlanIds = getWritablePlanIdsForStateSave(access, [...lockedByOthers]);
    if (!writablePlanIds.size) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const nextClients = mergeWritablePlanContent(serverState.clients, body.clients, writablePlanIds);
    const payload = { clients: nextClients, objectTypes: serverState.objectTypes };
    const updatedAt = writeState(payload);
    const filtered = filterStateForUser(payload.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
    res.json({ ok: true, updatedAt, clients: filtered, objectTypes: payload.objectTypes });
  });
  

};

module.exports = { registerDataRoutes };
