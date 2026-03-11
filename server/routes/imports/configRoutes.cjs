const registerImportConfigRoutes = (app, ctx) => {
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

  app.get('/api/import/config', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    res.json({ config: getImportConfigSafe(db, clientId) });
  });
  
  app.get('/api/import/summary', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.json({ ok: true, rows: [] });
      return;
    }
    const state = readState();
    const summaries = listImportSummary(db);
    const byId = new Map(summaries.map((s) => [s.clientId, s]));
    const rows = (state.clients || []).map((c) => {
      const entry = byId.get(c.id);
      return {
        clientId: c.id,
        clientName: c.name || c.shortName || c.id,
        lastImportAt: entry?.lastImportAt || null,
        total: entry?.total || 0,
        presentCount: entry?.presentCount || 0,
        missingCount: entry?.missingCount || 0,
        hiddenCount: entry?.hiddenCount || 0,
        configUpdatedAt: entry?.configUpdatedAt || null,
        ldapConfigUpdatedAt: entry?.ldapConfigUpdatedAt || null,
        hasWebApiConfig: !!entry?.configUpdatedAt,
        hasLdapConfig: !!entry?.ldapConfigUpdatedAt,
        hasConfig: !!entry?.configUpdatedAt || !!entry?.ldapConfigUpdatedAt
      };
    });
    res.json({ ok: true, rows });
  });
  
  app.get('/api/device-import/summary', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.json({ ok: true, rows: [] });
      return;
    }
    const state = readState();
    const summaries = listDeviceImportSummary(db);
    const byId = new Map(summaries.map((s) => [s.clientId, s]));
    const rows = (state.clients || []).map((c) => {
      const entry = byId.get(c.id);
      return {
        clientId: c.id,
        clientName: c.name || c.shortName || c.id,
        lastImportAt: entry?.lastImportAt || null,
        total: entry?.total || 0,
        presentCount: entry?.presentCount || 0,
        missingCount: entry?.missingCount || 0,
        hiddenCount: entry?.hiddenCount || 0,
        configUpdatedAt: entry?.configUpdatedAt || null,
        hasConfig: !!entry?.configUpdatedAt
      };
    });
    res.json({ ok: true, rows });
  });
  
  app.put('/api/import/config', requireAuth, rateByUser('import_config', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, url, username, password, bodyJson, method } = req.body || {};
    const cid = String(clientId || '').trim();
    const u = String(url || '').trim();
    const un = String(username || '').trim();
    if (!cid || !u || !un) {
      res.status(400).json({ error: 'Missing clientId/url/username' });
      return;
    }
    const methodRaw = String(method || '').trim().toUpperCase();
    const nextMethod = methodRaw === 'GET' ? 'GET' : methodRaw === 'POST' || !methodRaw ? 'POST' : null;
    if (!nextMethod) {
      res.status(400).json({ error: 'Invalid method (use GET or POST)' });
      return;
    }
    if (bodyJson !== undefined && String(bodyJson || '').trim()) {
      try {
        JSON.parse(String(bodyJson));
      } catch {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
      }
    }
    const cfg = upsertImportConfig(db, dataSecret, { clientId: cid, url: u, username: un, password, method: nextMethod, bodyJson });
    writeAuditLog(db, {
      level: 'important',
      event: 'import_config_update',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: {
        url: u,
        username: un,
        method: nextMethod,
        passwordChanged: password !== undefined,
        bodyChanged: bodyJson !== undefined
      }
    });
    res.json({ ok: true, config: cfg });
  });
  
  app.get('/api/import/ldap/config', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    res.json({ config: getLdapImportConfigSafe(db, clientId) });
  });
  
  app.put('/api/import/ldap/config', requireAuth, rateByUser('import_ldap_config', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const currentSafe = getLdapImportConfigSafe(db, String(req.body?.clientId || '').trim());
    const normalized = normalizeLdapImportConfig({
      ...req.body,
      hasPassword: !!currentSafe?.hasPassword,
      requirePassword: !currentSafe?.hasPassword
    });
    if (!normalized.ok) {
      res.status(400).json({ error: normalized.error || 'Invalid LDAP configuration' });
      return;
    }
    const cfg = upsertLdapImportConfig(db, dataSecret, normalized.config);
    writeAuditLog(db, {
      level: 'important',
      event: 'import_ldap_config_update',
      userId: req.userId,
      scopeType: 'client',
      scopeId: normalized.config.clientId,
      ...requestMeta(req),
      details: {
        server: normalized.config.server,
        port: normalized.config.port,
        security: normalized.config.security,
        authType: normalized.config.authType,
        domain: normalized.config.domain,
        username: normalized.config.username,
        baseDn: normalized.config.baseDn,
        userFilter: normalized.config.userFilter,
        sizeLimit: normalized.config.sizeLimit,
        passwordChanged: req.body?.password !== undefined
      }
    });
    res.json({ ok: true, config: cfg });
  });
  
  app.get('/api/device-import/config', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    res.json({ config: getDeviceImportConfigSafe(db, clientId) });
  });
  
  app.put('/api/device-import/config', requireAuth, rateByUser('device_import_config', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, url, username, password, bodyJson, method } = req.body || {};
    const cid = String(clientId || '').trim();
    const u = String(url || '').trim();
    const un = String(username || '').trim();
    if (!cid || !u || !un) {
      res.status(400).json({ error: 'Missing clientId/url/username' });
      return;
    }
    const methodRaw = String(method || '').trim().toUpperCase();
    const nextMethod = methodRaw === 'GET' ? 'GET' : methodRaw === 'POST' || !methodRaw ? 'POST' : null;
    if (!nextMethod) {
      res.status(400).json({ error: 'Invalid method (use GET or POST)' });
      return;
    }
    if (bodyJson !== undefined && String(bodyJson || '').trim()) {
      try {
        JSON.parse(String(bodyJson));
      } catch {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
      }
    }
    const cfg = upsertDeviceImportConfig(db, dataSecret, { clientId: cid, url: u, username: un, password, method: nextMethod, bodyJson });
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_config_update',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: {
        url: u,
        username: un,
        method: nextMethod,
        passwordChanged: password !== undefined,
        bodyChanged: bodyJson !== undefined
      }
    });
    res.json({ ok: true, config: cfg });
  });
  
};

module.exports = { registerImportConfigRoutes };
