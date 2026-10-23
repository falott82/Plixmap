const { requireSuperAdmin } = require('../access.cjs');
const fs = require('fs');
const path = require('path');
const { listMigrationStatus } = require('../db.cjs');
const { createDatabaseBackup, listBackups, resolveBackupDir, resolveBackupRetention } = require('../backup.cjs');
const registerOperationsRoutes = (app, { db, requireAuth, rateByUser, STARTED_AT, getWsClientCount, writeAuditLog, requestMeta, serverLog }) => {
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
    if (!requireSuperAdmin(req, res)) return;
    res.json(listMigrationStatus(db));
  });

  app.get('/api/settings/backups', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
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
    if (!requireSuperAdmin(req, res)) return;
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
    if (!requireSuperAdmin(req, res)) return;
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

module.exports = { registerOperationsRoutes };
