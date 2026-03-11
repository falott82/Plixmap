const registerImportPreviewRoutes = (app, ctx) => {
  const {
    db,
    dataSecret,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    readState,
    allowPrivateImportForRequest,
    getImportConfig,
    getDeviceImportConfig,
    getLdapImportConfig,
    getImportConfigSafe,
    getDeviceImportConfigSafe,
    getLdapImportConfigSafe,
    upsertImportConfig,
    upsertDeviceImportConfig,
    upsertLdapImportConfig,
    upsertExternalUsers,
    upsertExternalDevices,
    listImportSummary,
    listDeviceImportSummary,
    resolveEffectiveWebApiConfig,
    fetchEmployeesFromApi,
    fetchDevicesFromApi,
    normalizeExternalUserPayload,
    normalizeExternalDevicePayload,
    normalizeLdapImportConfig,
    resolveLdapEffectiveConfig,
    fetchEmployeesFromLdap,
    prepareLdapImportPreview,
    selectLdapImportRows,
    applyLdapImportOverrides,
    parseCsvEmployees,
    parseCsvDevices,
    clearImportDataForClient,
    clearDeviceImportDataForClient,
    normalizeImportText,
    normalizeUpperImportText,
    normalizeImportPhone,
    mapImportedEmployeeForPreview,
    mapExternalUserDbRowForPreview,
    loadExistingImportPreviewUsers,
    resolveLdapRuntimeConfigForRequest,
    mapImportedDeviceForPreview,
    mapExternalDeviceDbRowForPreview,
    importedUserChangedAgainstRemote,
    buildImportedDeviceDiff,
    mapRemoteDevicePreviewRow,
    deleteImportedExternalUserForClient,
    deleteImportedExternalDeviceForClient,
    deleteImportedExternalDevicesForClient
  } = ctx;

  app.post('/api/import/diff', requireAuth, rateByUser('import_diff', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const cfg = getImportConfig(db, dataSecret, cid);
    if (!cfg || !cfg.url || !cfg.username) {
      res.status(400).json({ error: 'Missing import config (url/username)' });
      return;
    }
    const result = await fetchEmployeesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
    if (!result.ok) {
      res.status(400).json({ ok: false, status: result.status, error: result.error || 'Request failed', contentType: result.contentType || '', rawSnippet: result.rawSnippet || '' });
      return;
    }
    const remote = (result.employees || []).map(mapImportedEmployeeForPreview);
    const existing = db
      .prepare(
        'SELECT externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, present FROM external_users WHERE clientId = ?'
      )
      .all(cid)
      .map((row) => mapExternalUserDbRowForPreview(row, { includeFlags: true }));
    const byId = new Map(existing.map((r) => [String(r.externalId), r]));
    const remoteIds = new Set(remote.map((e) => String(e.externalId)));
    let newCount = 0;
    let updatedCount = 0;
    let missingCount = 0;
    const missingSample = [];
    const newSample = [];
  
    for (const e of remote) {
      const id = String(e.externalId);
      const prev = byId.get(id);
      if (!prev) {
        newCount += 1;
        if (newSample.length < 10) newSample.push({ externalId: id, firstName: e.firstName || '', lastName: e.lastName || '' });
        continue;
      }
      const changed = importedUserChangedAgainstRemote(prev, e);
      if (changed) updatedCount += 1;
    }
    for (const prev of existing) {
      const id = String(prev.externalId);
      if (remoteIds.has(id)) continue;
      if (Number(prev.present || 1) !== 1) continue;
      missingCount += 1;
      if (missingSample.length < 10) missingSample.push({ externalId: id, firstName: prev.firstName || '', lastName: prev.lastName || '' });
    }
    res.json({
      ok: true,
      remoteCount: remote.length,
      localCount: existing.length,
      newCount,
      updatedCount,
      missingCount,
      newSample,
      missingSample
    });
  });
  
  app.post('/api/import/preview', requireAuth, rateByUser('import_preview', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const resolved = resolveEffectiveWebApiConfig(getImportConfig(db, dataSecret, cid), req.body?.config);
    if (!resolved.ok) {
      res.status(400).json({ error: resolved.error || 'Missing import config (url/username)' });
      return;
    }
    const result = await fetchEmployeesFromApi({ ...resolved.config, allowPrivate: allowPrivateImportForRequest(req) });
    if (!result.ok) {
      res.status(400).json({
        ok: false,
        status: result.status,
        error: result.error || 'Request failed',
        contentType: result.contentType || '',
        rawSnippet: result.rawSnippet || ''
      });
      return;
    }
    const remote = (result.employees || []).map(mapImportedEmployeeForPreview);
    const existing = db
      .prepare(
        'SELECT externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, updatedAt FROM external_users WHERE clientId = ? ORDER BY lastName COLLATE NOCASE, firstName COLLATE NOCASE'
      )
      .all(cid)
      .map((row) => mapExternalUserDbRowForPreview(row, { includeFlags: true }));
    const existingById = new Map(existing.map((r) => [String(r.externalId), r]));
    const remoteRows = remote.map((e) => {
      const prev = existingById.get(String(e.externalId));
      if (!prev) return { ...e, importStatus: 'new' };
      const changed = importedUserChangedAgainstRemote(prev, e);
      return { ...e, importStatus: changed ? 'update' : 'existing' };
    });
    res.json({
      ok: true,
      clientId: cid,
      remoteCount: remoteRows.length,
      existingCount: existing.length,
      remoteRows,
      existingRows: existing
    });
  });
  
  app.post('/api/import/import-one', requireAuth, rateByUser('import_one', 60 * 1000, 30), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    const externalId = String(req.body?.externalId || '').trim();
    if (!cid || !externalId) {
      res.status(400).json({ error: 'Missing clientId/externalId' });
      return;
    }
    let employee = null;
    const candidate = req.body?.user && typeof req.body.user === 'object' ? req.body.user : null;
    if (candidate && String(candidate.externalId || '').trim() === externalId) {
      employee = mapImportedEmployeeForPreview({ ...candidate, externalId });
    }
    if (!employee) {
      const cfg = getImportConfig(db, dataSecret, cid);
      if (!cfg || !cfg.url || !cfg.username) {
        res.status(400).json({ error: 'Missing import config (url/username)' });
        return;
      }
      const result = await fetchEmployeesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
      if (!result.ok) {
        res.status(400).json({
          ok: false,
          status: result.status,
          error: result.error || 'Request failed',
          contentType: result.contentType || '',
          rawSnippet: result.rawSnippet || ''
        });
        return;
      }
      employee = (result.employees || []).find((e) => String(e.externalId) === externalId);
    }
    if (!employee) {
      res.status(404).json({ error: 'Remote user not found' });
      return;
    }
    const sync = upsertExternalUsers(db, cid, [employee], { markMissing: false });
    if ((sync.summary?.duplicateEmails || 0) > 0) {
      const dup = Array.isArray(sync.duplicates) && sync.duplicates.length ? sync.duplicates[0] : null;
      res.status(409).json({ error: dup?.email ? `Duplicate email in client directory: ${dup.email}` : 'Duplicate email in client directory' });
      return;
    }
    writeAuditLog(db, {
      level: 'important',
      event: 'import_one',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { externalId, created: sync.summary?.created || 0, updated: sync.summary?.updated || 0 }
    });
    res.json({ ok: true, externalId, summary: sync.summary, created: sync.created || [], updated: sync.updated || [] });
  });
  
  app.post('/api/import/delete-one', requireAuth, rateByUser('import_delete_one', 60 * 1000, 30), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    const externalId = String(req.body?.externalId || '').trim();
    if (!cid || !externalId) {
      res.status(400).json({ error: 'Missing clientId/externalId' });
      return;
    }
    const cleanup = deleteImportedExternalUserForClient(cid, externalId);
    writeAuditLog(db, {
      level: 'important',
      event: 'import_delete_one',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { externalId, removedUsers: cleanup.removedUsers, removedObjects: cleanup.removedObjects }
    });
    res.json({ ok: true, externalId, ...cleanup });
  });
  
  app.post('/api/import/clear', requireAuth, rateByUser('import_clear', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const cleanup = clearImportDataForClient(cid);
    writeAuditLog(db, { level: 'important', event: 'import_clear', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { removedUsers: cleanup.removedUsers, removedObjects: cleanup.removedObjects } });
    res.json({ ok: true, removedUsers: cleanup.removedUsers, removedObjects: cleanup.removedObjects, updatedAt: cleanup.updatedAt });
  });
  
  app.post('/api/device-import/preview', requireAuth, rateByUser('device_import_preview', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const resolved = resolveEffectiveWebApiConfig(getDeviceImportConfig(db, dataSecret, cid), req.body?.config);
    if (!resolved.ok) {
      res.status(400).json({ error: resolved.error || 'Missing import config (url/username)' });
      return;
    }
    const result = await fetchDevicesFromApi({ ...resolved.config, allowPrivate: allowPrivateImportForRequest(req) });
    if (!result.ok) {
      res.status(400).json({
        ok: false,
        status: result.status,
        error: result.error || 'Request failed',
        contentType: result.contentType || '',
        rawSnippet: result.rawSnippet || ''
      });
      return;
    }
    const remote = (result.devices || []).map(mapImportedDeviceForPreview);
    const existing = db
      .prepare(
        "SELECT devId, deviceType, deviceName, manufacturer, model, serialNumber, hidden, present, updatedAt FROM external_devices WHERE clientId = ? AND lower(devId) NOT LIKE 'manual:%' ORDER BY deviceName COLLATE NOCASE, devId COLLATE NOCASE"
      )
      .all(cid)
      .map((row) => mapExternalDeviceDbRowForPreview(row, { includeFlags: true }));
    const existingById = new Map(existing.map((r) => [String(r.devId), r]));
    const remoteRows = remote.map((d) => mapRemoteDevicePreviewRow(d, existingById.get(String(d.devId))));
    res.json({
      ok: true,
      clientId: cid,
      remoteCount: remoteRows.length,
      existingCount: existing.length,
      remoteRows,
      existingRows: existing
    });
  });
  
  app.post('/api/device-import/import-many', requireAuth, rateByUser('device_import_many', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    const devIds = Array.from(
      new Set(
        (Array.isArray(req.body?.devIds) ? req.body.devIds : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    if (!cid || !devIds.length) {
      res.status(400).json({ error: 'Missing clientId/devIds' });
      return;
    }
    const draftDevices = Array.isArray(req.body?.devices) ? req.body.devices : [];
    const draftById = new Map(
      draftDevices
        .map((device) => mapImportedDeviceForPreview(device))
        .filter((device) => !!String(device.devId || '').trim())
        .map((device) => [String(device.devId), device])
    );
    let selectedDevices = devIds.map((devId) => draftById.get(devId)).filter(Boolean);
    if (selectedDevices.length !== devIds.length) {
      const resolved = resolveEffectiveWebApiConfig(getDeviceImportConfig(db, dataSecret, cid), req.body?.config);
      if (!resolved.ok) {
        res.status(400).json({ error: resolved.error || 'Missing import config (url/username)' });
        return;
      }
      const result = await fetchDevicesFromApi({ ...resolved.config, allowPrivate: allowPrivateImportForRequest(req) });
      if (!result.ok) {
        res.status(400).json({
          ok: false,
          status: result.status,
          error: result.error || 'Request failed',
          contentType: result.contentType || '',
          rawSnippet: result.rawSnippet || ''
        });
        return;
      }
      const remoteById = new Map((result.devices || []).map((device) => [String(device.devId), mapImportedDeviceForPreview(device)]));
      selectedDevices = devIds.map((devId) => draftById.get(devId) || remoteById.get(devId)).filter(Boolean);
    }
    const selectedById = new Map(selectedDevices.map((device) => [String(device.devId), device]));
    const missingDevIds = devIds.filter((devId) => !selectedById.has(devId));
    if (!selectedDevices.length) {
      res.status(404).json({ error: 'No selected remote devices found', missingDevIds });
      return;
    }
    const sync = upsertExternalDevices(db, cid, selectedDevices, { markMissing: false });
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_many',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: {
        requestedCount: devIds.length,
        importedCount: selectedDevices.length,
        missingDevIds,
        created: sync.summary?.created || 0,
        updated: sync.summary?.updated || 0
      }
    });
    res.json({
      ok: true,
      clientId: cid,
      requestedCount: devIds.length,
      importedCount: selectedDevices.length,
      missingDevIds,
      summary: sync.summary,
      created: sync.created || [],
      updated: sync.updated || []
    });
  });
  
  app.post('/api/device-import/import-one', requireAuth, rateByUser('device_import_one', 60 * 1000, 30), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    const devId = String(req.body?.devId || '').trim();
    if (!cid || !devId) {
      res.status(400).json({ error: 'Missing clientId/devId' });
      return;
    }
    let device = null;
    const candidate = req.body?.device && typeof req.body.device === 'object' ? req.body.device : null;
    if (candidate && String(candidate.devId || '').trim() === devId) {
      device = mapImportedDeviceForPreview({ ...candidate, devId });
    }
    if (!device) {
      const cfg = getDeviceImportConfig(db, dataSecret, cid);
      if (!cfg || !cfg.url || !cfg.username) {
        res.status(400).json({ error: 'Missing import config (url/username)' });
        return;
      }
      const result = await fetchDevicesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
      if (!result.ok) {
        res.status(400).json({
          ok: false,
          status: result.status,
          error: result.error || 'Request failed',
          contentType: result.contentType || '',
          rawSnippet: result.rawSnippet || ''
        });
        return;
      }
      device = (result.devices || []).find((d) => String(d.devId) === devId);
    }
    if (!device) {
      res.status(404).json({ error: 'Remote device not found' });
      return;
    }
    const sync = upsertExternalDevices(db, cid, [device], { markMissing: false });
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_one',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { devId, created: sync.summary?.created || 0, updated: sync.summary?.updated || 0 }
    });
    res.json({ ok: true, devId, summary: sync.summary, created: sync.created || [], updated: sync.updated || [] });
  });
  
  app.post('/api/device-import/delete-one', requireAuth, rateByUser('device_import_delete_one', 60 * 1000, 30), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    const devId = String(req.body?.devId || '').trim();
    if (!cid || !devId) {
      res.status(400).json({ error: 'Missing clientId/devId' });
      return;
    }
    const cleanup = deleteImportedExternalDeviceForClient(cid, devId);
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_delete_one',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { devId, removedDevices: cleanup.removedDevices, trackingSupported: cleanup.placementInfo?.supported === true }
    });
    res.json({ ok: true, devId, ...cleanup });
  });
  
  app.post('/api/device-import/delete-many', requireAuth, rateByUser('device_import_delete_many', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    const devIds = Array.from(
      new Set(
        (Array.isArray(req.body?.devIds) ? req.body.devIds : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    if (!cid || !devIds.length) {
      res.status(400).json({ error: 'Missing clientId/devIds' });
      return;
    }
    const cleanup = deleteImportedExternalDevicesForClient(cid, devIds);
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_delete_many',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: {
        requestedCount: devIds.length,
        removedDevices: cleanup.removedDevices,
        missingIds: cleanup.missingIds
      }
    });
    res.json({ ok: true, clientId: cid, requestedCount: devIds.length, ...cleanup });
  });
  
  app.post('/api/device-import/clear', requireAuth, rateByUser('device_import_clear', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const cleanup = clearDeviceImportDataForClient(cid);
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_clear',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { removedDevices: cleanup.removedDevices }
    });
    res.json({ ok: true, removedDevices: cleanup.removedDevices });
  });
  

};

module.exports = { registerImportPreviewRoutes };
