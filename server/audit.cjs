const safeJson = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ error: 'unserializable' });
  }
};

const getAuditVerboseEnabled = (db) => {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'auditVerbose'").get();
    return row?.value === '1';
  } catch {
    return false;
  }
};

const setAuditVerboseEnabled = (db, enabled) => {
  const now = Date.now();
  db.prepare(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES ('auditVerbose', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt`
  ).run(enabled ? '1' : '0', now);
};

const writeAuditLog = (db, payload) => {
  const {
    level = 'important',
    event,
    userId = null,
    username = null,
    ip = null,
    method = null,
    path = null,
    userAgent = null,
    scopeType = null,
    scopeId = null,
    details = null
  } = payload || {};

  const lev = level === 'verbose' ? 'verbose' : 'important';
  if (lev === 'verbose' && !getAuditVerboseEnabled(db)) return;

  db.prepare(
    `INSERT INTO audit_log (ts, level, event, userId, username, ip, method, path, userAgent, scopeType, scopeId, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Date.now(),
    lev,
    String(event || 'event'),
    userId,
    username,
    ip,
    method,
    path,
    userAgent,
    scopeType,
    scopeId,
    details ? safeJson(details) : null
  );
};

module.exports = { getAuditVerboseEnabled, setAuditVerboseEnabled, writeAuditLog };

