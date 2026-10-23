const { requireSuperAdmin } = require('../access.cjs');
const { readLastCheck, checkNpmAudit, checkPackageUpdates } = require('../services/packageChecks.cjs');
const { analyzeCode } = require('../services/codeAnalysis.cjs');

const registerMaintenanceRoutes = (app, {
  db, requireAuth, rateByUser, getAppSetting, setAppSetting, resolveUsername, writeAuditLog, requestMeta,
  executeNpm
}) => {
  const actorName = (req) => req.username || resolveUsername(req.userId) || null;
  const saveCheck = (key, req, ts, extra = {}) => setAppSetting(key, JSON.stringify({
    ts, userId: req.userId || null, username: actorName(req), ...extra
  }));
  const logCheck = (event, req, details) => writeAuditLog(db, {
    level: 'important', event, userId: req.userId, ...requestMeta(req), details
  });

  app.get('/api/settings/npm-audit', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json(readLastCheck(getAppSetting('npmAuditLastCheck'), resolveUsername));
  });

  app.post('/api/settings/npm-audit', requireAuth, rateByUser('npm_audit', 10 * 60 * 1000, 2), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const checkedAt = Date.now();
    const result = await checkNpmAudit(executeNpm);
    if (result.ok) {
      logCheck('npm_audit_run', req, { summary: result.summary, exitCode: result.exitCode, durationMs: result.durationMs });
    }
    saveCheck('npmAuditLastCheck', req, checkedAt);
    res.json({ ...result, lastCheckAt: checkedAt, lastCheckBy: actorName(req) });
  });

  app.get('/api/settings/package-updates', requireAuth, (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json(readLastCheck(getAppSetting('packageUpdatesLastCheck'), resolveUsername, true));
  });

  app.post('/api/settings/package-updates', requireAuth, rateByUser('package_updates', 5 * 60 * 1000, 6), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const checkedAt = Date.now();
    const result = await checkPackageUpdates(executeNpm);
    if (result.ok) {
      logCheck('package_updates_check', req, { count: result.count, exitCode: result.exitCode, durationMs: result.durationMs });
      saveCheck('packageUpdatesLastCheck', req, checkedAt, { count: result.count });
    }
    res.json({ ...result, checkedAt, lastCheckBy: actorName(req), lastCheckUserId: req.userId || null });
  });

  app.post('/api/settings/code-analyzer', requireAuth, rateByUser('code_analyzer', 60 * 1000, 20), (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      res.json(analyzeCode());
    } catch (error) {
      res.status(500).json({
        ok: false, root: process.cwd(), filesScanned: 0, totalLines: 0,
        largestFileLines: 0, updatedAt: Date.now(), files: [], error: error?.message || 'Code analysis failed'
      });
    }
  });
};

module.exports = { registerMaintenanceRoutes };
