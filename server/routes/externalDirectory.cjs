const registerExternalDirectoryRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    readState,
    getUserWithPermissions,
    computePlanAccess,
    filterStateForUser,
    listExternalUsers,
    listExternalDevices,
    setExternalUserHidden,
    setExternalDeviceHidden,
    upsertManualExternalUser,
    deleteManualExternalUser,
    upsertManualExternalDevice,
    deleteManualExternalDevice,
    getExternalUser,
    getExternalDevice,
    updateExternalUser,
    isManualExternalId,
    isManualDeviceId
  } = deps;

  app.get('/api/external-users', requireAuth, (req, res) => {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const serverState = readState();
    if (!req.isAdmin && !req.isSuperAdmin) {
      // Non-admin users can list external users only for clients they can see (ro/rw).
      const ctx = getUserWithPermissions(db, req.userId);
      const access = computePlanAccess(serverState.clients, ctx?.permissions || []);
      const filtered = filterStateForUser(serverState.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
      const allowed = (filtered || []).some((c) => c.id === clientId);
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
    const q = String(req.query.q || '').trim();
    const includeHidden = String(req.query.includeHidden || '') === '1';
    const includeMissing = String(req.query.includeMissing || '') === '1';
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const offset = req.query.offset !== undefined ? Number(req.query.offset) : undefined;
    const rows = listExternalUsers(db, { clientId, q, includeHidden, includeMissing, limit, offset });
    const client = (serverState.clients || []).find((c) => c.id === clientId);
    const presentCount = rows.filter((r) => r.present).length;
    const hiddenCount = rows.filter((r) => r.hidden).length;
    const missingCount = rows.filter((r) => !r.present).length;
    res.json({
      ok: true,
      clientId,
      clientName: client?.name || client?.shortName || null,
      total: rows.length,
      presentCount,
      hiddenCount,
      missingCount,
      rows
    });
  });
  
  app.post('/api/external-users/hide', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, externalId, hidden } = req.body || {};
    const cid = String(clientId || '').trim();
    const eid = String(externalId || '').trim();
    if (!cid || !eid) {
      res.status(400).json({ error: 'Missing clientId/externalId' });
      return;
    }
    setExternalUserHidden(db, cid, eid, !!hidden);
    writeAuditLog(db, { level: 'important', event: 'external_user_hide', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { externalId: eid, hidden: !!hidden } });
    res.json({ ok: true });
  });
  
  app.post('/api/external-users/manual', requireAuth, rateByUser('external_user_manual_create', 60 * 1000, 30), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, user } = req.body || {};
    const cid = String(clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    try {
      const row = upsertManualExternalUser(db, cid, user || {});
      writeAuditLog(db, {
        level: 'important',
        event: 'external_user_manual_create',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: { externalId: row?.externalId, name: `${row?.firstName || ''} ${row?.lastName || ''}`.trim() }
      });
      res.json({ ok: true, row });
    } catch (err) {
      if (err?.code === 'VALIDATION') {
        res.status(400).json({ error: err.message || 'Invalid payload' });
        return;
      }
      if (err?.code === 'DUPLICATE_EMAIL') {
        res.status(409).json({ error: err.message || 'Duplicate email in client directory' });
        return;
      }
      if (String(err?.message || '').toLowerCase().includes('unique')) {
        res.status(409).json({ error: 'Duplicate externalId for client' });
        return;
      }
      res.status(500).json({ error: 'Unable to create manual user' });
    }
  });
  
  app.put('/api/external-users/manual', requireAuth, rateByUser('external_user_manual_update', 60 * 1000, 60), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, externalId, user } = req.body || {};
    const cid = String(clientId || '').trim();
    const eid = String(externalId || '').trim();
    if (!cid || !eid) {
      res.status(400).json({ error: 'Missing clientId/externalId' });
      return;
    }
    if (!isManualExternalId(eid)) {
      res.status(400).json({ error: 'Only manual users can be updated' });
      return;
    }
    try {
      const row = upsertManualExternalUser(db, cid, { ...(user || {}), externalId: eid }, { externalId: eid });
      writeAuditLog(db, {
        level: 'important',
        event: 'external_user_manual_update',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: { externalId: eid }
      });
      res.json({ ok: true, row });
    } catch (err) {
      if (err?.code === 'VALIDATION') {
        res.status(400).json({ error: err.message || 'Invalid payload' });
        return;
      }
      if (err?.code === 'DUPLICATE_EMAIL') {
        res.status(409).json({ error: err.message || 'Duplicate email in client directory' });
        return;
      }
      if (err?.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      if (String(err?.message || '').toLowerCase().includes('unique')) {
        res.status(409).json({ error: 'Duplicate externalId for client' });
        return;
      }
      res.status(500).json({ error: 'Unable to update manual user' });
    }
  });
  
  app.put('/api/external-users', requireAuth, rateByUser('external_user_update', 60 * 1000, 60), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, externalId, user } = req.body || {};
    const cid = String(clientId || '').trim();
    const eid = String(externalId || '').trim();
    if (!cid || !eid) {
      res.status(400).json({ error: 'Missing clientId/externalId' });
      return;
    }
    try {
      const before = getExternalUser(db, cid, eid);
      const row = updateExternalUser(db, cid, eid, { ...(user || {}), externalId: eid });
      writeAuditLog(db, {
        level: 'important',
        event: 'external_user_update',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: {
          externalId: eid,
          sourceKind: before?.manual ? 'manual' : 'imported'
        }
      });
      res.json({ ok: true, row });
    } catch (err) {
      if (err?.code === 'VALIDATION') {
        res.status(400).json({ error: err.message || 'Invalid payload' });
        return;
      }
      if (err?.code === 'DUPLICATE_EMAIL') {
        res.status(409).json({ error: err.message || 'Duplicate email in client directory' });
        return;
      }
      if (err?.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.status(500).json({ error: 'Unable to update user' });
    }
  });
  
  app.delete('/api/external-users/manual', requireAuth, rateByUser('external_user_manual_delete', 60 * 1000, 60), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, externalId } = req.body || {};
    const cid = String(clientId || '').trim();
    const eid = String(externalId || '').trim();
    if (!cid || !eid) {
      res.status(400).json({ error: 'Missing clientId/externalId' });
      return;
    }
    if (!isManualExternalId(eid)) {
      res.status(400).json({ error: 'Only manual users can be deleted' });
      return;
    }
    try {
      const existing = getExternalUser(db, cid, eid);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const result = deleteManualExternalUser(db, cid, eid);
      writeAuditLog(db, {
        level: 'important',
        event: 'external_user_manual_delete',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: { externalId: eid }
      });
      res.json({ ok: true, removed: result.removed || 0 });
    } catch {
      res.status(500).json({ error: 'Unable to delete manual user' });
    }
  });
  
  app.get('/api/external-devices', requireAuth, (req, res) => {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const serverState = readState();
    if (!req.isAdmin && !req.isSuperAdmin) {
      const ctx = getUserWithPermissions(db, req.userId);
      const access = computePlanAccess(serverState.clients, ctx?.permissions || []);
      const filtered = filterStateForUser(serverState.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
      const allowed = (filtered || []).some((c) => c.id === clientId);
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
    const q = String(req.query.q || '').trim();
    const includeHidden = String(req.query.includeHidden || '') === '1';
    const includeMissing = String(req.query.includeMissing || '') === '1';
    const rows = listExternalDevices(db, { clientId, q, includeHidden, includeMissing });
    const client = (serverState.clients || []).find((c) => c.id === clientId);
    const presentCount = rows.filter((r) => r.present).length;
    const hiddenCount = rows.filter((r) => r.hidden).length;
    const missingCount = rows.filter((r) => !r.present).length;
    res.json({
      ok: true,
      clientId,
      clientName: client?.name || client?.shortName || null,
      total: rows.length,
      presentCount,
      hiddenCount,
      missingCount,
      rows
    });
  });
  
  app.post('/api/external-devices/hide', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, devId, hidden } = req.body || {};
    const cid = String(clientId || '').trim();
    const did = String(devId || '').trim();
    if (!cid || !did) {
      res.status(400).json({ error: 'Missing clientId/devId' });
      return;
    }
    setExternalDeviceHidden(db, cid, did, !!hidden);
    writeAuditLog(db, {
      level: 'important',
      event: 'external_device_hide',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { devId: did, hidden: !!hidden }
    });
    res.json({ ok: true });
  });
  
  app.post('/api/external-devices/manual', requireAuth, rateByUser('external_device_manual_create', 60 * 1000, 30), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, device } = req.body || {};
    const cid = String(clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    try {
      const row = upsertManualExternalDevice(db, cid, device || {});
      writeAuditLog(db, {
        level: 'important',
        event: 'external_device_manual_create',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: { devId: row?.devId, deviceName: row?.deviceName || '' }
      });
      res.json({ ok: true, row });
    } catch (err) {
      if (err?.code === 'VALIDATION') {
        res.status(400).json({ error: err.message || 'Invalid payload' });
        return;
      }
      if (String(err?.message || '').toLowerCase().includes('unique')) {
        res.status(409).json({ error: 'Duplicate devId for client' });
        return;
      }
      res.status(500).json({ error: 'Unable to create manual device' });
    }
  });
  
  app.put('/api/external-devices/manual', requireAuth, rateByUser('external_device_manual_update', 60 * 1000, 60), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, devId, device } = req.body || {};
    const cid = String(clientId || '').trim();
    const did = String(devId || '').trim();
    if (!cid || !did) {
      res.status(400).json({ error: 'Missing clientId/devId' });
      return;
    }
    if (!isManualDeviceId(did)) {
      res.status(400).json({ error: 'Only manual devices can be updated' });
      return;
    }
    try {
      const row = upsertManualExternalDevice(db, cid, { ...(device || {}), devId: did }, { devId: did });
      writeAuditLog(db, {
        level: 'important',
        event: 'external_device_manual_update',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: { devId: did }
      });
      res.json({ ok: true, row });
    } catch (err) {
      if (err?.code === 'VALIDATION') {
        res.status(400).json({ error: err.message || 'Invalid payload' });
        return;
      }
      if (err?.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      if (String(err?.message || '').toLowerCase().includes('unique')) {
        res.status(409).json({ error: 'Duplicate devId for client' });
        return;
      }
      res.status(500).json({ error: 'Unable to update manual device' });
    }
  });
  
  app.delete('/api/external-devices/manual', requireAuth, rateByUser('external_device_manual_delete', 60 * 1000, 60), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, devId } = req.body || {};
    const cid = String(clientId || '').trim();
    const did = String(devId || '').trim();
    if (!cid || !did) {
      res.status(400).json({ error: 'Missing clientId/devId' });
      return;
    }
    if (!isManualDeviceId(did)) {
      res.status(400).json({ error: 'Only manual devices can be deleted' });
      return;
    }
    try {
      const existing = getExternalDevice(db, cid, did);
      if (!existing) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      const result = deleteManualExternalDevice(db, cid, did);
      writeAuditLog(db, {
        level: 'important',
        event: 'external_device_manual_delete',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: { devId: did }
      });
      res.json({ ok: true, removed: result.removed || 0 });
    } catch {
      res.status(500).json({ error: 'Unable to delete manual device' });
    }
  });
  

};

module.exports = { registerExternalDirectoryRoutes };
