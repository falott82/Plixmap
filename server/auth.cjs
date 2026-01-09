const crypto = require('crypto');

const base64UrlEncode = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlDecode = (str) => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
};

const parseCookies = (cookieHeader) => {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
};

const scryptHash = (password, saltB64) =>
  crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), 64, { N: 16384, r: 8, p: 1 });

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = scryptHash(password, salt).toString('base64');
  return { salt, hash };
};

const verifyPassword = (password, saltB64, hashB64) => {
  const computed = scryptHash(password, saltB64);
  const expected = Buffer.from(hashB64, 'base64');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
};

const isStrongPassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  const s = password;
  if (s.length < 8) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/[0-9]/.test(s)) return false;
  if (!/[^A-Za-z0-9]/.test(s)) return false;
  return true;
};

const signSession = (secret, payload) => {
  const json = JSON.stringify(payload);
  const body = base64UrlEncode(Buffer.from(json, 'utf8'));
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
};

const verifySession = (secret, token) => {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(body).digest();
  const got = base64UrlDecode(sig);
  if (got.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(got, expected)) return null;
  try {
    const json = base64UrlDecode(body).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const setSessionCookie = (res, token, maxAgeSeconds = 60 * 60 * 24 * 30, options = {}) => {
  const parts = [
    `deskly_session=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`
  ];
  const secure = Object.prototype.hasOwnProperty.call(options, 'secure')
    ? !!options.secure
    : process.env.NODE_ENV === 'production';
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
};

const clearSessionCookie = (res) => {
  res.setHeader('Set-Cookie', `deskly_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
};

const defaultPaletteFavoritesJson = JSON.stringify(['real_user', 'user', 'desktop', 'rack']);

const ensureBootstrapAdmins = (db) => {
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get()?.n || 0;
  if (count > 0) {
    try {
      const row = db
        .prepare('SELECT id, passwordSalt, passwordHash, mustChangePassword FROM users WHERE username = ?')
        .get('superadmin');
      if (row && Number(row.mustChangePassword) === 1) {
        const isDefault = verifyPassword('deskly', row.passwordSalt, row.passwordHash);
        if (!isDefault) {
          const { salt, hash } = hashPassword('deskly');
          db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, updatedAt = ? WHERE id = ?').run(
            salt,
            hash,
            Date.now(),
            row.id
          );
        }
      }
    } catch {
      // ignore
    }
    return;
  }
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO users (id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, language, defaultPlanId, mustChangePassword, paletteFavoritesJson, firstName, lastName, phone, email, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, 1, 1, 0, 'it', ?, 1, ?, ?, ?, ?, ?, ?, ?)`
  );
  const createSuperAdmin = (username, password, defaultPlanId, firstName, lastName, email) => {
    const { salt, hash } = hashPassword(password);
    insert.run(
      crypto.randomUUID(),
      username,
      salt,
      hash,
      defaultPlanId,
      defaultPaletteFavoritesJson,
      firstName,
      lastName,
      '',
      email,
      now,
      now
    );
  };
  createSuperAdmin('superadmin', 'deskly', 'seed-plan-floor-0', 'Super', 'Admin', 'superadmin@deskly.local');
};

module.exports = {
  parseCookies,
  hashPassword,
  verifyPassword,
  isStrongPassword,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  ensureBootstrapAdmins
};
