const fs = require('fs');
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const { openDb, getOrCreateAuthSecret } = require('./db.cjs');
const {
  parseCookies,
  verifyPassword,
  hashPassword,
  isStrongPassword,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  ensureBootstrapAdmins
} = require('./auth.cjs');
const { getUserWithPermissions, computePlanAccess, filterStateForUser, mergeWritablePlanContent } = require('./permissions.cjs');
const { writeAuthLog, requestMeta } = require('./log.cjs');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(express.json({ limit: '80mb' }));

const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch {}
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: '365d',
    immutable: true
  })
);

const db = openDb();
ensureBootstrapAdmins(db);
const authSecret = getOrCreateAuthSecret(db);
// Invalidate sessions on each server restart (forces login after reboot/redeploy).
const serverInstanceId = crypto.randomBytes(16).toString('hex');

const parseDataUrl = (value) => {
  if (typeof value !== 'string') return null;
  const m = /^data:([^;]+);base64,(.*)$/.exec(value);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
};

const extForMime = (mime) => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/jpg') return 'jpg';
  if (mime === 'application/pdf') return 'pdf';
  return null;
};

const externalizeDataUrl = (dataUrl) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const ext = extForMime(parsed.mime);
  if (!ext) return null;
  const id = crypto.randomUUID();
  const filename = `${id}.${ext}`;
  const filePath = path.join(uploadsDir, filename);
  try {
    const buf = Buffer.from(parsed.base64, 'base64');
    fs.writeFileSync(filePath, buf);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
};

const externalizeAssetsInClients = (clients) => {
  if (!Array.isArray(clients)) return;
  for (const client of clients) {
    if (client?.logoUrl && typeof client.logoUrl === 'string' && client.logoUrl.startsWith('data:')) {
      const url = externalizeDataUrl(client.logoUrl);
      if (url) client.logoUrl = url;
    }
    if (Array.isArray(client?.attachments)) {
      for (const a of client.attachments) {
        if (a?.dataUrl && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:')) {
          const url = externalizeDataUrl(a.dataUrl);
          if (url) a.dataUrl = url;
        }
      }
    }
    for (const site of client?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        if (plan?.imageUrl && typeof plan.imageUrl === 'string' && plan.imageUrl.startsWith('data:')) {
          const url = externalizeDataUrl(plan.imageUrl);
          if (url) plan.imageUrl = url;
        }
        for (const rev of plan?.revisions || []) {
          if (rev?.imageUrl && typeof rev.imageUrl === 'string' && rev.imageUrl.startsWith('data:')) {
            const url = externalizeDataUrl(rev.imageUrl);
            if (url) rev.imageUrl = url;
          }
        }
      }
    }
  }
};

const readState = () => {
  const row = db.prepare('SELECT json, updatedAt FROM state WHERE id = 1').get();
  if (!row) return { clients: [], objectTypes: undefined, updatedAt: null };
  try {
    const parsed = JSON.parse(row.json) || {};
    return { clients: parsed.clients || [], objectTypes: parsed.objectTypes, updatedAt: row.updatedAt };
  } catch {
    return { clients: [], objectTypes: undefined, updatedAt: row.updatedAt };
  }
};

const writeState = (payload) => {
  const now = Date.now();
  // Store large binary blobs (plan images, client logos, pdf attachments) as files instead of inline data URLs.
  // This keeps the JSON state small and avoids huge stringify/GC churn on clients.
  if (payload && payload.clients) externalizeAssetsInClients(payload.clients);
  const json = JSON.stringify(payload);
  db.prepare(
    `INSERT INTO state (id, json, updatedAt) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET json=excluded.json, updatedAt=excluded.updatedAt`
  ).run(json, now);
  return now;
};

const requireAuth = (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.deskly_session;
  const session = verifySession(authSecret, token);
  if (!session?.userId || !session?.tokenVersion || !session?.sid) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (session.sid !== serverInstanceId) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const userRow = db
    .prepare('SELECT id, tokenVersion, isAdmin, isSuperAdmin, disabled, mustChangePassword FROM users WHERE id = ?')
    .get(session.userId);
  if (!userRow) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (Number(userRow.disabled) === 1) {
    clearSessionCookie(res);
    res.status(403).json({ error: 'User disabled' });
    return;
  }
  if (Number(userRow.tokenVersion) !== Number(session.tokenVersion)) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  // Force first-run password change: only allow minimal endpoints until the user sets a new password.
  if (Number(userRow.mustChangePassword) === 1) {
    const allowed = new Set(['/api/auth/me', '/api/auth/first-run', '/api/auth/logout']);
    if (!allowed.has(req.path)) {
      res.status(403).json({ error: 'Password change required' });
      return;
    }
  }
  req.userId = session.userId;
  req.isAdmin = !!userRow.isAdmin;
  req.isSuperAdmin = !!userRow.isSuperAdmin;
  next();
};

// Public: used by the login UI to decide whether to show first-run credentials.
app.get('/api/auth/bootstrap-status', (_req, res) => {
  try {
    const row = db.prepare("SELECT mustChangePassword FROM users WHERE username = 'superadmin'").get();
    res.json({ showFirstRunCredentials: !!row && Number(row.mustChangePassword) === 1 });
  } catch {
    res.json({ showFirstRunCredentials: false });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Missing username/password' });
    return;
  }
  const row = db
    .prepare('SELECT id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled FROM users WHERE username = ?')
    .get(String(username).trim());
  if (!row) {
    writeAuthLog(db, { event: 'login', success: false, username: String(username), ...requestMeta(req), details: { reason: 'user_not_found' } });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (row && Number(row.disabled) === 1) {
    writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...requestMeta(req), details: { reason: 'disabled' } });
    res.status(403).json({ error: 'User disabled' });
    return;
  }
  if (!verifyPassword(String(password), row.passwordSalt, row.passwordHash)) {
    writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...requestMeta(req), details: { reason: 'bad_password' } });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signSession(authSecret, {
    userId: row.id,
    tokenVersion: row.tokenVersion,
    sid: serverInstanceId,
    iat: Date.now()
  });
  setSessionCookie(res, token);
  writeAuthLog(db, { event: 'login', success: true, userId: row.id, username: row.username, ...requestMeta(req) });
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySession(authSecret, cookies.deskly_session);
  clearSessionCookie(res);
  if (session?.userId) {
    const row = db.prepare('SELECT username FROM users WHERE id = ?').get(session.userId);
    writeAuthLog(db, { event: 'logout', success: true, userId: session.userId, username: row?.username, ...requestMeta(req) });
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const ctx = getUserWithPermissions(db, req.userId);
  if (!ctx) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user: ctx.user, permissions: ctx.permissions });
});

app.post('/api/auth/first-run', requireAuth, (req, res) => {
  const { newPassword, language } = req.body || {};
  const nextLanguage = language === 'en' ? 'en' : 'it';
  if (!isStrongPassword(String(newPassword || ''))) {
    res.status(400).json({ error: 'Weak password' });
    return;
  }
  const row = db
    .prepare('SELECT id, tokenVersion, mustChangePassword FROM users WHERE id = ?')
    .get(req.userId);
  if (!row) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (Number(row.mustChangePassword) !== 1) {
    res.status(400).json({ error: 'Not in first-run mode' });
    return;
  }
  const { salt, hash } = hashPassword(String(newPassword));
  const nextTokenVersion = Number(row.tokenVersion) + 1;
  db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, tokenVersion = ?, mustChangePassword = 0, language = ?, updatedAt = ? WHERE id = ?').run(
    salt,
    hash,
    nextTokenVersion,
    nextLanguage,
    Date.now(),
    req.userId
  );
  const token = signSession(authSecret, {
    userId: req.userId,
    tokenVersion: nextTokenVersion,
    sid: serverInstanceId,
    iat: Date.now()
  });
  setSessionCookie(res, token);
  res.json({ ok: true });
});

app.put('/api/auth/me', requireAuth, (req, res) => {
  const { language, defaultPlanId } = req.body || {};
  const nextLanguage = language === 'en' ? 'en' : language === 'it' ? 'it' : undefined;
  const nextDefaultPlanId =
    typeof defaultPlanId === 'string' ? defaultPlanId : defaultPlanId === null ? null : undefined;

  if (nextLanguage === undefined && nextDefaultPlanId === undefined) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  // Validate defaultPlanId: must exist and be accessible to the current user (unless admin).
  if (nextDefaultPlanId !== undefined) {
    if (nextDefaultPlanId !== null) {
      const state = readState();
      let ok = false;
      if (req.isAdmin) ok = true;
      else {
        const ctx = getUserWithPermissions(db, req.userId);
        const access = computePlanAccess(state.clients, ctx?.permissions || []);
        ok = access.has(nextDefaultPlanId);
      }
      if (!ok) {
        res.status(400).json({ error: 'Invalid defaultPlanId' });
        return;
      }
    }
  }

  const now = Date.now();
  const sets = [];
  const params = [];
  if (nextLanguage !== undefined) {
    sets.push('language = ?');
    params.push(nextLanguage);
  }
  if (nextDefaultPlanId !== undefined) {
    sets.push('defaultPlanId = ?');
    params.push(nextDefaultPlanId);
  }
  sets.push('updatedAt = ?');
  params.push(now);
  params.push(req.userId);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

app.get('/api/state', requireAuth, (req, res) => {
  const state = readState();
  if (req.isAdmin) {
    res.json(state);
    return;
  }
  const ctx = getUserWithPermissions(db, req.userId);
  const access = computePlanAccess(state.clients, ctx?.permissions || []);
  const filtered = filterStateForUser(state.clients, access, false);
  res.json({ clients: filtered, objectTypes: state.objectTypes, updatedAt: state.updatedAt });
});

app.put('/api/state', requireAuth, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || !('clients' in body)) {
    res.status(400).json({ error: 'Invalid payload (expected {clients})' });
    return;
  }
  const serverState = readState();
  if (req.isAdmin) {
    const payload = { clients: body.clients, objectTypes: Array.isArray(body.objectTypes) ? body.objectTypes : serverState.objectTypes };
    const updatedAt = writeState(payload);
    res.json({ ok: true, updatedAt, clients: payload.clients, objectTypes: payload.objectTypes });
    return;
  }
  const ctx = getUserWithPermissions(db, req.userId);
  const access = computePlanAccess(serverState.clients, ctx?.permissions || []);
  const writablePlanIds = new Set();
  for (const [planId, a] of access.entries()) {
    if (a === 'rw') writablePlanIds.add(planId);
  }
  const nextClients = mergeWritablePlanContent(serverState.clients, body.clients, writablePlanIds);
  const payload = { clients: nextClients, objectTypes: serverState.objectTypes };
  const updatedAt = writeState(payload);
  const filtered = filterStateForUser(payload.clients, access, false);
  res.json({ ok: true, updatedAt, clients: filtered, objectTypes: payload.objectTypes });
});

// User management (admin)
app.get('/api/users', requireAuth, (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const users = db
    .prepare(
      'SELECT id, username, isAdmin, isSuperAdmin, disabled, language, firstName, lastName, phone, email, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
    )
    .all()
    .map((u) => ({ ...u, isAdmin: !!u.isAdmin, isSuperAdmin: !!u.isSuperAdmin, disabled: !!u.disabled }));
  const perms = db.prepare('SELECT userId, scopeType, scopeId, access FROM permissions').all();
  const permsByUser = new Map();
  for (const p of perms) {
    const list = permsByUser.get(p.userId) || [];
    list.push({ scopeType: p.scopeType, scopeId: p.scopeId, access: p.access });
    permsByUser.set(p.userId, list);
  }
  res.json({
    users: users.map((u) => ({ ...u, permissions: permsByUser.get(u.id) || [] }))
  });
});

app.post('/api/users', requireAuth, (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const {
    username,
    password,
    firstName = '',
    lastName = '',
    phone = '',
    email = '',
    language = 'it',
    isAdmin = false,
    permissions = []
  } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Missing username/password' });
    return;
  }
  if (!isStrongPassword(String(password || ''))) {
    res.status(400).json({ error: 'Weak password' });
    return;
  }
  if (language !== 'it' && language !== 'en') {
    res.status(400).json({ error: 'Invalid language' });
    return;
  }
  if (isAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Only superadmin can create admin users' });
    return;
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  const { salt, hash } = hashPassword(String(password));
  try {
    db.prepare(
      `INSERT INTO users (id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, language, firstName, lastName, phone, email, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      String(username).trim(),
      salt,
      hash,
      isAdmin ? 1 : 0,
      String(language),
      String(firstName || ''),
      String(lastName || ''),
      String(phone || ''),
      String(email || ''),
      now,
      now
    );
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
    return;
  }
  const insertPerm = db.prepare(
    'INSERT OR REPLACE INTO permissions (userId, scopeType, scopeId, access) VALUES (?, ?, ?, ?)'
  );
  for (const p of Array.isArray(permissions) ? permissions : []) {
    if (!p?.scopeType || !p?.scopeId || !p?.access) continue;
    insertPerm.run(id, p.scopeType, p.scopeId, p.access);
  }
  res.json({ ok: true, id });
});

app.put('/api/users/:id', requireAuth, (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const userId = req.params.id;
  const target = db.prepare('SELECT id, username, isAdmin, isSuperAdmin FROM users WHERE id = ?').get(userId);
  if (!target) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (target.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Cannot modify superadmin' });
    return;
  }
  const { firstName, lastName, phone, email, isAdmin, disabled, language, permissions } = req.body || {};
  if (isAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Only superadmin can promote admin' });
    return;
  }
  if (language && language !== 'it' && language !== 'en') {
    res.status(400).json({ error: 'Invalid language' });
    return;
  }
  const now = Date.now();
  db.prepare(
    'UPDATE users SET isAdmin = ?, disabled = ?, language = COALESCE(?, language), firstName = ?, lastName = ?, phone = ?, email = ?, updatedAt = ? WHERE id = ?'
  ).run(
    isAdmin ? 1 : 0,
    disabled ? 1 : 0,
    language || null,
    String(firstName || ''),
    String(lastName || ''),
    String(phone || ''),
    String(email || ''),
    now,
    userId
  );
  if (Array.isArray(permissions)) {
    db.prepare('DELETE FROM permissions WHERE userId = ?').run(userId);
    const insertPerm = db.prepare(
      'INSERT OR REPLACE INTO permissions (userId, scopeType, scopeId, access) VALUES (?, ?, ?, ?)'
    );
    for (const p of permissions) {
      if (!p?.scopeType || !p?.scopeId || !p?.access) continue;
      insertPerm.run(userId, p.scopeType, p.scopeId, p.access);
    }
  }
  res.json({ ok: true });
});

app.post('/api/users/:id/password', requireAuth, (req, res) => {
  const targetId = req.params.id;
  const { oldPassword, newPassword } = req.body || {};
  if (!isStrongPassword(String(newPassword || ''))) {
    res.status(400).json({ error: 'Weak password' });
    return;
  }
  const isSelf = targetId === req.userId;
  if (!req.isAdmin && !isSelf) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const row = db.prepare('SELECT id, username, passwordSalt, passwordHash, tokenVersion, isSuperAdmin FROM users WHERE id = ?').get(targetId);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!isSelf && row.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Only superadmin can change superadmin password' });
    return;
  }
  if (!req.isAdmin) {
    if (!oldPassword || !verifyPassword(String(oldPassword), row.passwordSalt, row.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
  } else if (isSelf) {
    if (!oldPassword || !verifyPassword(String(oldPassword), row.passwordSalt, row.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
  }
  const { salt, hash } = hashPassword(String(newPassword));
  db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, tokenVersion = ?, updatedAt = ? WHERE id = ?').run(
    salt,
    hash,
    Number(row.tokenVersion) + 1,
    Date.now(),
    targetId
  );
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const targetId = req.params.id;
  if (targetId === req.userId) {
    res.status(400).json({ error: 'Cannot delete self' });
    return;
  }
  const target = db.prepare('SELECT isSuperAdmin FROM users WHERE id = ?').get(targetId);
  if (target?.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Cannot delete superadmin' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  db.prepare('DELETE FROM permissions WHERE userId = ?').run(targetId);
  res.json({ ok: true });
});

app.get('/api/admin/logs', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const base = `
    SELECT id, ts, event, success, userId, username, ip, method, path, userAgent, details
    FROM auth_log
    ${q ? "WHERE lower(coalesce(username,'')) LIKE ? OR lower(coalesce(ip,'')) LIKE ? OR lower(coalesce(path,'')) LIKE ? OR lower(coalesce(event,'')) LIKE ?" : ''}
    ORDER BY ts DESC
    LIMIT ? OFFSET ?`;
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit, offset] : [limit, offset];
  const rows = db.prepare(base).all(...params).map((r) => ({ ...r, success: !!r.success }));
  res.json({ rows });
});

// Serve built frontend (optional, for docker/prod)
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, HOST, () => {
  console.log(`[deskly] API listening on http://${HOST}:${PORT}`);
});
