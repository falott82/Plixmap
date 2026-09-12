// Operational routes: capacity history/snapshots, liveness/readiness probes,
// DB migration status and database backups.
// Extracted from server/index.cjs; collaborators are injected.
const fs = require('fs');
const path = require('path');

const registerOpsRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    serverLog,
    readState,
    resolveVisibleClientsForRequest,
    buildCapacityTrendSnapshot,
    buildCapacitySnapshotSignature,
    readCapacityHistory,
    writeCapacityHistory,
    CAPACITY_SNAPSHOT_MIN_INTERVAL_MS,
    listMigrationStatus,
    createDatabaseBackup,
    listBackups,
    resolveBackupDir,
    resolveBackupRetention,
    STARTED_AT,
    getWsClientCount
  } = deps;

  app.get('/api/capacity/history', requireAuth, rateByUser('capacity_history', 60 * 1000, 120), (req, res) => {
    const serverState = readState();
    const allClients = serverState.clients || [];
    const visibleClients = resolveVisibleClientsForRequest(req, allClients);
    const visibleClientIds = new Set((visibleClients || []).map((entry) => String(entry?.id || '').trim()).filter(Boolean));
    const requestedClientId = String(req.query.clientId || '').trim();
    if (requestedClientId && !visibleClientIds.has(requestedClientId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const requestedLimitRaw = Number(req.query.limit);
    const requestedLimit = Number.isFinite(requestedLimitRaw) ? Math.max(1, Math.min(720, Math.floor(requestedLimitRaw))) : 180;
    const store = readCapacityHistory();
    const snapshots = (store.snapshots || [])
      .slice(-requestedLimit)
      .map((snapshot) => {
        const clients = (snapshot.clients || []).filter((entry) => {
          const clientId = String(entry?.clientId || '').trim();
          if (!clientId) return false;
          if (!visibleClientIds.has(clientId)) return false;
          if (requestedClientId && clientId !== requestedClientId) return false;
          return true;
        });
        if (!clients.length) return null;
        return { at: snapshot.at, clients };
      })
      .filter(Boolean);
    res.json({ ok: true, snapshots, lastSnapshotAt: store.lastSnapshotAt || null });
  });

  app.post('/api/capacity/snapshot', requireAuth, rateByUser('capacity_snapshot', 60 * 1000, 30), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const force = !!req.body?.force;
    const store = readCapacityHistory();
    const sourceClients = (readState().clients || []).filter(Boolean);
    const snapshot = buildCapacityTrendSnapshot(sourceClients, Date.now());
    const signature = buildCapacitySnapshotSignature(snapshot);
    const lastSnapshot = store.snapshots[store.snapshots.length - 1];
    let appended = true;
    if (
      !force &&
      lastSnapshot &&
      signature &&
      signature === store.lastSignature &&
      Number(lastSnapshot.at || 0) > 0 &&
      snapshot.at - Number(lastSnapshot.at || 0) < CAPACITY_SNAPSHOT_MIN_INTERVAL_MS
    ) {
      appended = false;
    }
    const nextSnapshots = appended ? [...store.snapshots, snapshot] : store.snapshots;
    const trimmed = writeCapacityHistory({
      snapshots: nextSnapshots,
      lastSignature: signature || store.lastSignature || '',
      lastSnapshotAt: appended ? snapshot.at : store.lastSnapshotAt || lastSnapshot?.at || snapshot.at
    });
    res.json({
      ok: true,
      appended,
      snapshotAt: appended ? snapshot.at : Number(store.lastSnapshotAt || lastSnapshot?.at || snapshot.at),
      totalSnapshots: trimmed.length
    });
  });

  app.get('/api/health/live', (_req, res) => {
    res.json({
      ok: true,
      status: 'live',
      uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
      ts: Date.now()
    });
  });

  app.get('/api/health/ready', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      const migration = listMigrationStatus(db);
      res.json({
        ok: true,
        status: 'ready',
        db: 'ok',
        schemaVersion: migration.schemaVersion,
        latestVersion: migration.latestVersion,
        wsClients: Number(getWsClientCount() || 0),
        ts: Date.now()
      });
    } catch (error) {
      res.status(503).json({
        ok: false,
        status: 'not_ready',
        error: error?.message || 'readiness check failed',
        ts: Date.now()
      });
    }
  });

  app.get('/api/settings/db/migrations', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.json(listMigrationStatus(db));
  });

  app.get('/api/settings/backups', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const backups = listBackups().map((entry) => ({
      fileName: entry.fileName,
      sizeBytes: entry.sizeBytes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }));
    res.json({
      backupDir: resolveBackupDir(),
      retention: resolveBackupRetention(),
      backups
    });
  });

  app.post('/api/settings/backups', requireAuth, rateByUser('db_backup', 60 * 1000, 6), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    try {
      const result = await createDatabaseBackup(db, { reason: 'api_manual' });
      writeAuditLog(db, {
        level: 'important',
        event: 'db_backup_create',
        userId: req.userId,
        username: req.username,
        ...requestMeta(req),
        details: { fileName: result.fileName, sizeBytes: result.sizeBytes, pruned: result.pruned || [] }
      });
      res.json({
        ok: true,
        backup: {
          fileName: result.fileName,
          sizeBytes: result.sizeBytes,
          createdAt: result.createdAt,
          pruned: result.pruned || []
        }
      });
    } catch (error) {
      serverLog('error', 'db_backup_failed', {
        requestId: req.requestId || null,
        userId: req.userId || null,
        message: error?.message || 'backup failed'
      });
      res.status(500).json({ error: 'Backup failed' });
    }
  });

  app.get('/api/settings/backups/:fileName', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const fileName = String(req.params.fileName || '').trim();
    if (!fileName || fileName !== path.basename(fileName) || !fileName.endsWith('.sqlite')) {
      res.status(400).json({ error: 'Invalid file name' });
      return;
    }
    const fullPath = path.join(resolveBackupDir(), fileName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    res.download(fullPath, fileName);
  });

};

module.exports = { registerOpsRoutes };
