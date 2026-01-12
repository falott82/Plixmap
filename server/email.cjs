const { encryptString, decryptString } = require('./customImport.cjs');

const SETTINGS_KEY = 'emailConfig';

const safeJson = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ error: 'unserializable' });
  }
};

const parsePort = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.round(num);
};

const normalizeSecurityMode = (raw) => {
  const mode = typeof raw?.securityMode === 'string' ? raw.securityMode.trim().toLowerCase() : '';
  if (mode === 'ssl' || mode === 'starttls') return mode;
  const secure = raw?.secure === true || raw?.secure === 1 || raw?.secure === 'true';
  return secure ? 'ssl' : 'starttls';
};

const normalizeConfig = (raw, fallbackPort) => {
  const securityMode = normalizeSecurityMode(raw);
  const secure = securityMode === 'ssl';
  const defaultPort = Number.isFinite(fallbackPort) ? fallbackPort : secure ? 465 : 587;
  return {
    host: typeof raw?.host === 'string' ? raw.host.trim() : '',
    port: parsePort(raw?.port, defaultPort),
    secure,
    securityMode,
    username: typeof raw?.username === 'string' ? raw.username.trim() : '',
    passwordEnc: typeof raw?.passwordEnc === 'string' && raw.passwordEnc ? raw.passwordEnc : null,
    fromName: typeof raw?.fromName === 'string' ? raw.fromName.trim() : '',
    fromEmail: typeof raw?.fromEmail === 'string' ? raw.fromEmail.trim() : ''
  };
};

const getConfigRow = (db) =>
  db.prepare('SELECT value, updatedAt FROM app_settings WHERE key = ?').get(SETTINGS_KEY);

const parseConfigRow = (row) => {
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
};

const getEmailConfigSafe = (db) => {
  const row = getConfigRow(db);
  const parsed = parseConfigRow(row);
  if (!parsed) return null;
  const cfg = normalizeConfig(parsed);
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    securityMode: cfg.securityMode,
    username: cfg.username,
    fromName: cfg.fromName,
    fromEmail: cfg.fromEmail,
    hasPassword: !!cfg.passwordEnc,
    updatedAt: row.updatedAt || null
  };
};

const getEmailConfig = (db, dataSecret) => {
  const row = getConfigRow(db);
  const parsed = parseConfigRow(row);
  if (!parsed) return null;
  const cfg = normalizeConfig(parsed);
  const password = decryptString(dataSecret, cfg.passwordEnc);
  return { ...cfg, password };
};

const upsertEmailConfig = (db, dataSecret, payload) => {
  const now = Date.now();
  const prevRow = getConfigRow(db);
  const prevParsed = parseConfigRow(prevRow) || {};
  const prev = normalizeConfig(prevParsed);
  const next = { ...prev };

  if (Object.prototype.hasOwnProperty.call(payload, 'host')) next.host = String(payload.host || '').trim();
  if (Object.prototype.hasOwnProperty.call(payload, 'username')) next.username = String(payload.username || '').trim();
  if (Object.prototype.hasOwnProperty.call(payload, 'fromName')) next.fromName = String(payload.fromName || '').trim();
  if (Object.prototype.hasOwnProperty.call(payload, 'fromEmail')) next.fromEmail = String(payload.fromEmail || '').trim();
  if (Object.prototype.hasOwnProperty.call(payload, 'securityMode')) {
    const nextMode = String(payload.securityMode || '').trim().toLowerCase();
    next.securityMode = nextMode === 'ssl' ? 'ssl' : 'starttls';
    next.secure = next.securityMode === 'ssl';
  } else if (Object.prototype.hasOwnProperty.call(payload, 'secure')) {
    next.secure = !!payload.secure;
    next.securityMode = next.secure ? 'ssl' : 'starttls';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'port')) {
    const fallback = Number.isFinite(prev.port) ? prev.port : next.secure ? 465 : 587;
    next.port = parsePort(payload.port, fallback);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'password')) {
    const nextPassword = String(payload.password || '').trim();
    if (nextPassword) {
      next.passwordEnc = encryptString(dataSecret, nextPassword);
    }
  }

  db.prepare(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt`
  ).run(SETTINGS_KEY, safeJson(next), now);

  return getEmailConfigSafe(db);
};

const logEmailAttempt = (db, payload) => {
  const {
    userId = null,
    username = null,
    recipient = null,
    subject = null,
    success = false,
    error = null,
    details = null
  } = payload || {};
  db.prepare(
    `INSERT INTO email_log (ts, userId, username, recipient, subject, success, error, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Date.now(),
    userId,
    username,
    recipient,
    subject,
    success ? 1 : 0,
    error ? String(error).slice(0, 500) : null,
    details ? safeJson(details) : null
  );
};

const listEmailLogs = (db, params = {}) => {
  const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
  const offset = Math.max(0, Number(params.offset) || 0);
  const q = String(params.q || '').trim().toLowerCase();
  const where = q
    ? "WHERE lower(coalesce(recipient,'')) LIKE ? OR lower(coalesce(subject,'')) LIKE ? OR lower(coalesce(username,'')) LIKE ?"
    : '';
  const base = `
    SELECT id, ts, userId, username, recipient, subject, success, error, details
    FROM email_log
    ${where}
    ORDER BY ts DESC
    LIMIT ? OFFSET ?`;
  const queryParams = q ? [`%${q}%`, `%${q}%`, `%${q}%`, limit, offset] : [limit, offset];
  const rows = db.prepare(base).all(...queryParams).map((r) => ({ ...r, success: !!r.success }));
  const total = q
    ? Number(
        db
          .prepare(
            `SELECT COUNT(1) as c
             FROM email_log
             ${where}`
          )
          .get(`%${q}%`, `%${q}%`, `%${q}%`)?.c || 0
      )
    : Number(db.prepare('SELECT COUNT(1) as c FROM email_log').get()?.c || 0);
  return { rows, limit, offset, total };
};

module.exports = { getEmailConfigSafe, getEmailConfig, upsertEmailConfig, logEmailAttempt, listEmailLogs };
