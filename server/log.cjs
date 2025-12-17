const safeJson = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ error: 'unserializable' });
  }
};

const redact = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    if (String(key).toLowerCase().includes('password')) clone[key] = '[redacted]';
  }
  return clone;
};

const writeAuthLog = (db, payload) => {
  const {
    event,
    success,
    userId = null,
    username = null,
    ip = null,
    method = null,
    path = null,
    userAgent = null,
    details = null
  } = payload;
  db.prepare(
    `INSERT INTO auth_log (ts, event, success, userId, username, ip, method, path, userAgent, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Date.now(),
    String(event),
    success ? 1 : 0,
    userId,
    username,
    ip,
    method,
    path,
    userAgent,
    details ? safeJson(details) : null
  );
};

const requestMeta = (req) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || null;
  return {
    ip,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'] || null,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer
    }
  };
};

module.exports = { writeAuthLog, requestMeta, redact };
