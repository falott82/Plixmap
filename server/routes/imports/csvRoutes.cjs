const registerImportCsvRoutes = (app, ctx) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    upsertExternalUsers,
    upsertExternalDevices,
    parseCsvEmployees,
    parseCsvDevices,
    clearImportDataForClient,
    clearDeviceImportDataForClient
  } = ctx;

  app.post('/api/import/csv', requireAuth, rateByUser('import_csv', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, csvText, mode } = req.body || {};
    const cid = String(clientId || '').trim();
    const importMode = mode === 'replace' ? 'replace' : 'append';
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ error: 'Missing csvText' });
      return;
    }
    const parsed = parseCsvEmployees(csvText);
    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    if (!parsed.employees.length) {
      res.status(400).json({ error: 'No users found in CSV' });
      return;
    }
    let cleanup = null;
    if (importMode === 'replace') {
      cleanup = clearImportDataForClient(cid);
    }
    const sync = upsertExternalUsers(db, cid, parsed.employees || [], { markMissing: false });
    writeAuditLog(db, {
      level: 'important',
      event: 'import_csv',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { mode: importMode, count: parsed.employees.length, created: sync.summary?.created, updated: sync.summary?.updated, duplicateEmails: sync.summary?.duplicateEmails || 0, removedUsers: cleanup?.removedUsers || 0, removedObjects: cleanup?.removedObjects || 0 }
    });
    res.json({ ok: true, ...sync, cleanup });
  });
  
  app.post('/api/device-import/csv', requireAuth, rateByUser('device_import_csv', 60 * 1000, 10), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { clientId, csvText, mode } = req.body || {};
    const cid = String(clientId || '').trim();
    const importMode = mode === 'replace' ? 'replace' : 'append';
    if (!cid) {
      res.status(400).json({ error: 'Missing clientId' });
      return;
    }
    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ error: 'Missing csvText' });
      return;
    }
    const parsed = parseCsvDevices(csvText);
    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    if (!parsed.devices.length) {
      res.status(400).json({ error: 'No devices found in CSV' });
      return;
    }
    let cleanup = null;
    if (importMode === 'replace') {
      cleanup = clearDeviceImportDataForClient(cid);
    }
    const sync = upsertExternalDevices(db, cid, parsed.devices || [], { markMissing: false });
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_csv',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: {
        mode: importMode,
        count: parsed.devices.length,
        created: sync.summary?.created,
        updated: sync.summary?.updated,
        removedDevices: cleanup?.removedDevices || 0
      }
    });
    res.json({ ok: true, ...sync, cleanup });
  });
  
};

module.exports = { registerImportCsvRoutes };
