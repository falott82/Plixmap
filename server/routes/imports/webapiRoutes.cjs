const registerImportWebApiRoutes = (app, ctx) => {
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

  app.post('/api/import/test', requireAuth, rateByUser('import_test', 60 * 1000, 10), async (req, res) => {
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
    writeAuditLog(db, { level: 'important', event: 'import_test', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { ok: !!result.ok, status: result.status } });
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
    const preview = (result.employees || []).slice(0, 25);
    res.json({ ok: true, status: result.status, count: (result.employees || []).length, preview });
  });
  
  app.post('/api/import/sync', requireAuth, rateByUser('import_sync', 60 * 1000, 10), async (req, res) => {
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
      writeAuditLog(db, { level: 'important', event: 'import_sync', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { ok: false, status: result.status, error: result.error || '' } });
      res.status(400).json({
        ok: false,
        status: result.status,
        error: result.error || 'Request failed',
        contentType: result.contentType || '',
        rawSnippet: result.rawSnippet || ''
      });
      return;
    }
    const sync = upsertExternalUsers(db, cid, result.employees || []);
    writeAuditLog(db, { level: 'important', event: 'import_sync', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: sync.summary });
    res.json({ ok: true, ...sync });
  });
  
  app.post('/api/device-import/test', requireAuth, rateByUser('device_import_test', 60 * 1000, 10), async (req, res) => {
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
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_test',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { ok: !!result.ok, status: result.status }
    });
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
    const preview = (result.devices || []).slice(0, 25);
    res.json({ ok: true, status: result.status, count: (result.devices || []).length, preview });
  });
  
  app.post('/api/device-import/sync', requireAuth, rateByUser('device_import_sync', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const cid = String(req.body?.clientId || '').trim();
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    const cfg = getDeviceImportConfig(db, dataSecret, cid);
    if (!cfg || !cfg.url || !cfg.username) {
      res.status(400).json({ error: 'Missing import config (url/username)' });
      return;
    }
    const result = await fetchDevicesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
    if (!result.ok) {
      writeAuditLog(db, {
        level: 'important',
        event: 'device_import_sync',
        userId: req.userId,
        scopeType: 'client',
        scopeId: cid,
        ...requestMeta(req),
        details: { ok: false, status: result.status, error: result.error || '' }
      });
      res.status(400).json({
        ok: false,
        status: result.status,
        error: result.error || 'Request failed',
        contentType: result.contentType || '',
        rawSnippet: result.rawSnippet || ''
      });
      return;
    }
    const sync = upsertExternalDevices(db, cid, result.devices || []);
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_sync',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: sync.summary
    });
    res.json({ ok: true, ...sync });
  });
  
};

module.exports = { registerImportWebApiRoutes };
