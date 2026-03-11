const registerImportLdapRoutes = (app, ctx) => {
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

  app.post('/api/import/ldap/test', requireAuth, rateByUser('import_ldap_test', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const runtime = resolveLdapRuntimeConfigForRequest(req);
    if (!runtime.ok) {
      res.status(runtime.status).json({ error: runtime.error });
      return;
    }
    const result = await fetchEmployeesFromLdap(runtime.config, { sizeLimit: Math.min(Number(runtime.config.sizeLimit || 25), 25) });
    writeAuditLog(db, {
      level: 'important',
      event: 'import_ldap_test',
      userId: req.userId,
      scopeType: 'client',
      scopeId: runtime.clientId,
      ...requestMeta(req),
      details: { ok: !!result.ok, status: result.status, returnedCount: result.returnedCount || 0 }
    });
    if (!result.ok) {
      res.status(400).json({ ok: false, status: result.status, error: result.error || 'LDAP request failed' });
      return;
    }
    res.json({
      ok: true,
      status: result.status,
      count: (result.employees || []).length,
      preview: (result.employees || []).slice(0, 25)
    });
  });
  
  app.post('/api/import/ldap/preview', requireAuth, rateByUser('import_ldap_preview', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const runtime = resolveLdapRuntimeConfigForRequest(req);
    if (!runtime.ok) {
      res.status(runtime.status).json({ error: runtime.error });
      return;
    }
    const result = await fetchEmployeesFromLdap(runtime.config);
    if (!result.ok) {
      res.status(400).json({ ok: false, status: result.status, error: result.error || 'LDAP request failed' });
      return;
    }
    const existingRows = loadExistingImportPreviewUsers(runtime.clientId);
    const preview = prepareLdapImportPreview(existingRows, (result.employees || []).map(mapImportedEmployeeForPreview));
    writeAuditLog(db, {
      level: 'verbose',
      event: 'import_ldap_preview',
      userId: req.userId,
      scopeType: 'client',
      scopeId: runtime.clientId,
      ...requestMeta(req),
      details: {
        remoteCount: preview.remoteCount,
        importableCount: preview.importableCount,
        existingCount: preview.existingCount,
        skippedCount: preview.skippedCount
      }
    });
    res.json({ ok: true, clientId: runtime.clientId, ...preview });
  });
  
  app.post('/api/import/ldap/sync', requireAuth, rateByUser('import_ldap_sync', 60 * 1000, 10), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const runtime = resolveLdapRuntimeConfigForRequest(req);
    if (!runtime.ok) {
      res.status(runtime.status).json({ error: runtime.error });
      return;
    }
    const result = await fetchEmployeesFromLdap(runtime.config);
    if (!result.ok) {
      writeAuditLog(db, {
        level: 'important',
        event: 'import_ldap_sync',
        userId: req.userId,
        scopeType: 'client',
        scopeId: runtime.clientId,
        ...requestMeta(req),
        details: { ok: false, status: result.status, error: result.error || 'LDAP request failed' }
      });
      res.status(400).json({ ok: false, status: result.status, error: result.error || 'LDAP request failed' });
      return;
    }
    const existingRows = loadExistingImportPreviewUsers(runtime.clientId);
    const remoteRows = (result.employees || []).map(mapImportedEmployeeForPreview);
    const previewBeforeImport = prepareLdapImportPreview(existingRows, remoteRows);
    const selectedRows = selectLdapImportRows(previewBeforeImport.importableRows, req.body?.selectedExternalIds);
    if (!selectedRows.ok) {
      res.status(400).json({ ok: false, error: selectedRows.error });
      return;
    }
    const selectedRowsWithOverrides = applyLdapImportOverrides(selectedRows.rows, req.body?.overridesByExternalId);
    if (!selectedRowsWithOverrides.ok) {
      res.status(400).json({ ok: false, error: selectedRowsWithOverrides.error });
      return;
    }
    const finalRows = selectedRowsWithOverrides.rows.map((row) => normalizeExternalUserPayload(row));
    const sync = finalRows.length
      ? upsertExternalUsers(db, runtime.clientId, finalRows, { markMissing: false })
      : { summary: { created: 0, updated: 0, missing: 0, duplicateEmails: 0 }, created: [], updated: [], missing: [], duplicates: [] };
    const preview = prepareLdapImportPreview(loadExistingImportPreviewUsers(runtime.clientId), remoteRows);
    writeAuditLog(db, {
      level: 'important',
      event: 'import_ldap_sync',
      userId: req.userId,
      scopeType: 'client',
      scopeId: runtime.clientId,
      ...requestMeta(req),
      details: {
        fetched: previewBeforeImport.remoteCount,
        importableBefore: previewBeforeImport.importableCount,
        selectedRequested: selectedRows.requestedCount,
        selectedImportable: selectedRows.selectedCount,
        existingBefore: previewBeforeImport.existingCount,
        skippedBefore: previewBeforeImport.skippedCount,
        created: sync.summary?.created || 0,
        updated: sync.summary?.updated || 0
      }
    });
    res.json({
      ok: true,
      clientId: runtime.clientId,
      preview,
      summary: {
        fetched: previewBeforeImport.remoteCount,
        importable: previewBeforeImport.importableCount,
        selected: selectedRows.selectedCount,
        existing: previewBeforeImport.existingCount,
        skipped: previewBeforeImport.skippedCount,
        created: sync.summary?.created || 0,
        updated: sync.summary?.updated || 0
      },
      created: sync.created || [],
      updated: sync.updated || [],
      skippedRows: preview.skippedRows || []
    });
  });
  
};

module.exports = { registerImportLdapRoutes };
