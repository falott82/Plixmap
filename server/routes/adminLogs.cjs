const registerAdminLogRoutes = (app, deps) => {
  const { db, requireAuth, markLogsCleared, writeAuditLog, requestMeta } = deps;

  app.get('/api/admin/logs', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 200));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const where = q
      ? "WHERE lower(coalesce(username,'')) LIKE ? OR lower(coalesce(ip,'')) LIKE ? OR lower(coalesce(path,'')) LIKE ? OR lower(coalesce(event,'')) LIKE ?"
      : '';
    const base = `
      SELECT id, ts, event, success, userId, username, ip, method, path, userAgent, details
      FROM auth_log
      ${where}
      ORDER BY ts DESC
      LIMIT ? OFFSET ?`;
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit, offset] : [limit, offset];
    const rows = db.prepare(base).all(...params).map((row) => ({ ...row, success: !!row.success }));
    const total = q
      ? Number(
          db
            .prepare(
              `SELECT COUNT(1) as c
               FROM auth_log
               ${where}`
            )
            .get(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)?.c || 0
        )
      : Number(db.prepare('SELECT COUNT(1) as c FROM auth_log').get()?.c || 0);
    res.json({ rows, limit, offset, total });
  });

  app.post('/api/admin/logs/clear', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    db.prepare('DELETE FROM auth_log').run();
    markLogsCleared('auth', req.userId, req.username);
    writeAuditLog(db, {
      level: 'important',
      event: 'auth_log_cleared',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req)
    });
    res.json({ ok: true });
  });
};

module.exports = { registerAdminLogRoutes };
