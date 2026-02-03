const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const express = require('express');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const nodemailer = require('nodemailer');
const { openDb, getOrCreateAuthSecret, getOrCreateDataSecret } = require('./db.cjs');
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
const { getAuditVerboseEnabled, setAuditVerboseEnabled, writeAuditLog } = require('./audit.cjs');
const { encryptSecret, decryptSecret, generateTotpSecret, verifyTotp } = require('./mfa.cjs');
const {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getObjectCustomValues,
  setObjectCustomValues,
  validateValuesAgainstFields
} = require('./customFields.cjs');
const {
  fetchEmployeesFromApi,
  getImportConfig,
  getImportConfigSafe,
  upsertImportConfig,
  upsertExternalUsers,
  listExternalUsers,
  setExternalUserHidden,
  listImportSummary
} = require('./customImport.cjs');
const { getEmailConfigSafe, getEmailConfig, upsertEmailConfig, logEmailAttempt, listEmailLogs } = require('./email.cjs');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

const normalizeIp = (ip) => {
  if (!ip) return '';
  let value = String(ip).trim();
  if (!value) return '';
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value;
};

const isPrivateIpv4 = (ip) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isPrivateIpv6 = (ip) => {
  const val = ip.toLowerCase();
  if (val === '::1') return true;
  if (val.startsWith('fe80:') || val.startsWith('fe80::')) return true;
  if (val.startsWith('fc') || val.startsWith('fd')) return true;
  return false;
};

const isPrivateIp = (ip) => {
  const type = net.isIP(ip);
  if (type === 4) return isPrivateIpv4(ip);
  if (type === 6) return isPrivateIpv6(ip);
  return false;
};

const allowPrivateImportForRequest = (req) => {
  const ip = normalizeIp(req.ip || req.connection?.remoteAddress || '');
  if (!ip) return false;
  return isPrivateIp(ip);
};

const app = express();
app.use(express.json({ limit: '80mb' }));
const trustProxyValue = process.env.DESKLY_TRUST_PROXY;
if (typeof trustProxyValue === 'string' && trustProxyValue.trim() !== '') {
  const normalized = trustProxyValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    app.set('trust proxy', true);
  } else if (['0', 'false', 'no', 'off'].includes(normalized)) {
    app.set('trust proxy', false);
  } else {
    app.set('trust proxy', trustProxyValue);
  }
}
const resolveSecureCookie = (req) => {
  const override = process.env.DESKLY_COOKIE_SECURE;
  if (typeof override === 'string' && override.trim() !== '') {
    return ['1', 'true', 'yes', 'on'].includes(override.trim().toLowerCase());
  }
  const forwarded = req.headers['x-forwarded-proto'];
  if (forwarded) {
    const proto = String(forwarded).split(',')[0].trim().toLowerCase();
    if (proto === 'https') return true;
    if (proto === 'http') return false;
  }
  return req.secure === true || req.protocol === 'https';
};
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self' ws: wss:; font-src 'self' data: https://fonts.gstatic.com; worker-src 'self' blob:; frame-ancestors 'none'"
  );
  if (resolveSecureCookie(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});
// Prevent browser/proxy caching for API responses (avoids stale auth state and UI inconsistencies after restarts).
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

const CSRF_COOKIE = 'deskly_csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_MAX_AGE = 60 * 60 * 24 * 30;
const csrfExemptPaths = new Set(['/auth/login', '/auth/bootstrap-status']);

const appendSetCookie = (res, value) => {
  if (typeof res.append === 'function') {
    res.append('Set-Cookie', value);
    return;
  }
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', value);
    return;
  }
  const next = Array.isArray(prev) ? [...prev, value] : [prev, value];
  res.setHeader('Set-Cookie', next);
};

const setCsrfCookie = (res, token, secure) => {
  const parts = [
    `${CSRF_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${CSRF_MAX_AGE}`
  ];
  if (secure) parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
};

const clearCsrfCookie = (res) => {
  appendSetCookie(res, `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
};

const ensureCsrfCookie = (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[CSRF_COOKIE];
  if (existing) return existing;
  const token = crypto.randomBytes(32).toString('base64');
  setCsrfCookie(res, token, resolveSecureCookie(req));
  return token;
};

app.use('/api', (req, res, next) => {
  const method = String(req.method || '').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  if (csrfExemptPaths.has(req.path)) return next();
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  if (!cookieToken || !headerToken || String(headerToken) !== String(cookieToken)) {
    res.status(403).json({ error: 'CSRF validation failed' });
    return;
  }
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  if (host) {
    const expected = `${req.protocol}://${host}`;
    if (origin && origin !== expected) {
      res.status(403).json({ error: 'CSRF origin mismatch' });
      return;
    }
    if (!origin && referer && !String(referer).startsWith(expected)) {
      res.status(403).json({ error: 'CSRF referer mismatch' });
      return;
    }
  }
  next();
});

const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch {}

const db = openDb();
ensureBootstrapAdmins(db);
const authSecret = getOrCreateAuthSecret(db);
const dataSecret = getOrCreateDataSecret(db);
// Invalidate sessions on each server restart (forces login after reboot/redeploy).
const serverInstanceId = crypto.randomBytes(16).toString('hex');

const readLogsMeta = () => {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('logsMeta');
    if (!row?.value) return {};
    return JSON.parse(row.value) || {};
  } catch {
    return {};
  }
};

const resolveUsername = (userId) => {
  if (!userId) return null;
  try {
    return db.prepare('SELECT username FROM users WHERE id = ?').get(userId)?.username || null;
  } catch {
    return null;
  }
};

const setAppSetting = (key, value) => {
  const now = Date.now();
  try {
    db.prepare(
      `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt`
    ).run(key, String(value), now);
  } catch {
    // ignore
  }
};

const getAppSetting = (key) => {
  try {
    return db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value || null;
  } catch {
    return null;
  }
};

const writeLogsMeta = (next) => {
  setAppSetting('logsMeta', JSON.stringify(next));
};

const markLogsCleared = (kind, userId, username) => {
  const meta = readLogsMeta();
  const resolved = username || resolveUsername(userId);
  meta[kind] = { clearedAt: Date.now(), userId: userId || null, username: resolved || null };
  writeLogsMeta(meta);
  return meta;
};

// --- Realtime (WebSocket): plan presence + plan locking (exclusive editor) ---
const wsPlanMembers = new Map(); // planId -> Set<ws>
const wsClientInfo = new Map(); // ws -> { userId, username, plans:Set<string> }
const planLocks = new Map(); // planId -> { userId, username, ts }

const jsonSend = (ws, obj) => {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    // ignore
  }
};

const broadcastToPlan = (planId, obj) => {
  const members = wsPlanMembers.get(planId);
  if (!members) return;
  for (const ws of members) jsonSend(ws, obj);
};

const computePresence = (planId) => {
  const members = wsPlanMembers.get(planId);
  const users = [];
  if (members) {
    const seen = new Set();
    for (const ws of members) {
      const info = wsClientInfo.get(ws);
      if (!info) continue;
      const key = info.userId;
      if (seen.has(key)) continue;
      seen.add(key);
      users.push({ userId: info.userId, username: info.username });
    }
  }
  return users;
};

const emitPresence = (planId) => {
  broadcastToPlan(planId, { type: 'presence', planId, users: computePresence(planId) });
};

const emitLockState = (planId) => {
  const lock = planLocks.get(planId) || null;
  broadcastToPlan(planId, { type: 'lock_state', planId, lockedBy: lock ? { userId: lock.userId, username: lock.username } : null });
};

const releaseLocksForWs = (ws) => {
  const info = wsClientInfo.get(ws);
  if (!info) return;
  for (const planId of info.plans) {
    const members = wsPlanMembers.get(planId);
    if (members) {
      members.delete(ws);
      if (!members.size) wsPlanMembers.delete(planId);
    }
    const lock = planLocks.get(planId);
    if (lock && lock.userId === info.userId) {
      // release only if no other sockets from same user are still in the plan
      const remaining = wsPlanMembers.get(planId);
      let stillThere = false;
      if (remaining) {
        for (const otherWs of remaining) {
          const otherInfo = wsClientInfo.get(otherWs);
          if (otherInfo?.userId === info.userId) {
            stillThere = true;
            break;
          }
        }
      }
      if (!stillThere) {
        planLocks.delete(planId);
        writeAuditLog(db, { level: 'important', event: 'plan_lock_released', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId, details: { reason: 'ws_close' } });
        emitLockState(planId);
      }
    }
    emitPresence(planId);
  }
  wsClientInfo.delete(ws);
};

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
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return null;
};

const MAX_IMAGE_BYTES = (() => {
  const raw = Number(process.env.DESKLY_UPLOAD_MAX_IMAGE_MB || '');
  return Number.isFinite(raw) && raw > 0 ? raw * 1024 * 1024 : 12 * 1024 * 1024;
})();
const MAX_PDF_BYTES = (() => {
  const raw = Number(process.env.DESKLY_UPLOAD_MAX_PDF_MB || '');
  return Number.isFinite(raw) && raw > 0 ? raw * 1024 * 1024 : 20 * 1024 * 1024;
})();
const allowedDataMimes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']);

const base64SizeBytes = (base64) => {
  const len = base64.length;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
};

const validateDataUrl = (dataUrl) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false, reason: 'invalid' };
  const mime = String(parsed.mime || '').toLowerCase();
  if (!allowedDataMimes.has(mime)) return { ok: false, reason: 'mime', mime };
  const maxBytes = mime === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  const sizeBytes = base64SizeBytes(parsed.base64 || '');
  if (sizeBytes > maxBytes) return { ok: false, reason: 'size', mime, maxBytes, sizeBytes };
  return { ok: true, mime, sizeBytes };
};

const validateImagesInHtml = (html) => {
  if (typeof html !== 'string' || !html.includes('data:image/')) return { ok: true };
  const re = /<img\b[^>]*?\bsrc\s*=\s*"(data:image\/[^;"]+;base64,[^"]+)"[^>]*?>/gi;
  let match;
  while ((match = re.exec(html))) {
    const res = validateDataUrl(match[1]);
    if (!res.ok) return { ok: false, reason: res.reason, mime: res.mime, maxBytes: res.maxBytes, sizeBytes: res.sizeBytes };
  }
  return { ok: true };
};

const validateImagesInLexicalState = (stateJson) => {
  if (typeof stateJson !== 'string' || !stateJson.includes('data:image/')) return { ok: true };
  try {
    const obj = JSON.parse(stateJson);
    let invalid = null;
    const walk = (node) => {
      if (!node || typeof node !== 'object' || invalid) return;
      if (node.type === 'image' && typeof node.src === 'string' && node.src.startsWith('data:')) {
        const res = validateDataUrl(node.src);
        if (!res.ok) invalid = res;
        return;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') walk(v);
      }
    };
    walk(obj);
    if (invalid) return { ok: false, reason: invalid.reason, mime: invalid.mime, maxBytes: invalid.maxBytes, sizeBytes: invalid.sizeBytes };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
};

const validateAssetsInClients = (clients) => {
  if (!Array.isArray(clients)) return { ok: true };
  for (const client of clients) {
    if (client?.logoUrl && typeof client.logoUrl === 'string' && client.logoUrl.startsWith('data:')) {
      const res = validateDataUrl(client.logoUrl);
      if (!res.ok) return { ok: false, field: 'client.logoUrl', ...res };
    }
    if (Array.isArray(client?.attachments)) {
      for (const a of client.attachments) {
        if (a?.dataUrl && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:')) {
          const res = validateDataUrl(a.dataUrl);
          if (!res.ok) return { ok: false, field: 'client.attachments', ...res };
        }
      }
    }
    if (client?.notesHtml && typeof client.notesHtml === 'string' && client.notesHtml.includes('data:image/')) {
      const res = validateImagesInHtml(client.notesHtml);
      if (!res.ok) return { ok: false, field: 'client.notesHtml', ...res };
    }
    if (client?.notesLexical && typeof client.notesLexical === 'string' && client.notesLexical.includes('data:image/')) {
      const res = validateImagesInLexicalState(client.notesLexical);
      if (!res.ok) return { ok: false, field: 'client.notesLexical', ...res };
    }
    if (Array.isArray(client?.notes)) {
      for (const note of client.notes) {
        if (note?.notesHtml && typeof note.notesHtml === 'string' && note.notesHtml.includes('data:image/')) {
          const res = validateImagesInHtml(note.notesHtml);
          if (!res.ok) return { ok: false, field: 'client.notes[].notesHtml', ...res };
        }
        if (note?.notesLexical && typeof note.notesLexical === 'string' && note.notesLexical.includes('data:image/')) {
          const res = validateImagesInLexicalState(note.notesLexical);
          if (!res.ok) return { ok: false, field: 'client.notes[].notesLexical', ...res };
        }
      }
    }
    for (const site of client?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        if (plan?.imageUrl && typeof plan.imageUrl === 'string' && plan.imageUrl.startsWith('data:')) {
          const res = validateDataUrl(plan.imageUrl);
          if (!res.ok) return { ok: false, field: 'plan.imageUrl', ...res };
        }
        for (const rev of plan?.revisions || []) {
          if (rev?.imageUrl && typeof rev.imageUrl === 'string' && rev.imageUrl.startsWith('data:')) {
            const res = validateDataUrl(rev.imageUrl);
            if (!res.ok) return { ok: false, field: 'plan.revisions[].imageUrl', ...res };
          }
        }
      }
    }
  }
  return { ok: true };
};

const externalizeDataUrl = (dataUrl) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const validation = validateDataUrl(dataUrl);
  if (!validation.ok) return null;
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

const externalizeImagesInHtml = (html) => {
  if (typeof html !== 'string' || !html.includes('data:image/')) return html;
  return html.replace(/<img\b([^>]*?)\bsrc\s*=\s*"(data:image\/[^;"]+;base64,[^"]+)"([^>]*?)>/gi, (m, pre, dataUrl, post) => {
    const url = externalizeDataUrl(dataUrl);
    if (!url) return m;
    return `<img${pre}src="${url}"${post}>`;
  });
};

const externalizeImagesInLexicalState = (stateJson) => {
  if (typeof stateJson !== 'string' || !stateJson.includes('data:image/')) return stateJson;
  try {
    const obj = JSON.parse(stateJson);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'image' && typeof node.src === 'string' && node.src.startsWith('data:')) {
        const url = externalizeDataUrl(node.src);
        if (url) node.src = url;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) {
          for (const item of v) walk(item);
        } else if (v && typeof v === 'object') {
          walk(v);
        }
      }
    };
    walk(obj);
    return JSON.stringify(obj);
  } catch {
    return stateJson;
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
    if (client?.notesHtml && typeof client.notesHtml === 'string' && client.notesHtml.includes('data:image/')) {
      client.notesHtml = externalizeImagesInHtml(client.notesHtml);
    }
    if (client?.notesLexical && typeof client.notesLexical === 'string' && client.notesLexical.includes('data:image/')) {
      client.notesLexical = externalizeImagesInLexicalState(client.notesLexical);
    }
    if (Array.isArray(client?.notes)) {
      for (const note of client.notes) {
        if (note?.notesHtml && typeof note.notesHtml === 'string' && note.notesHtml.includes('data:image/')) {
          note.notesHtml = externalizeImagesInHtml(note.notesHtml);
        }
        if (note?.notesLexical && typeof note.notesLexical === 'string' && note.notesLexical.includes('data:image/')) {
          note.notesLexical = externalizeImagesInLexicalState(note.notesLexical);
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

const hasPlanIdInClients = (clients, planId) => {
  for (const client of clients || []) {
    for (const site of client?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        if (plan?.id === planId) return true;
      }
    }
  }
  return false;
};

const getPlanAccessForUser = (userId, planId) => {
  if (!userId || !planId) return null;
  const state = readState();
  if (!hasPlanIdInClients(state.clients, planId)) return null;
  const ctx = getUserWithPermissions(db, userId);
  if (!ctx) return null;
  if (ctx.user.isAdmin) return 'rw';
  const access = computePlanAccess(state.clients, ctx.permissions || []);
  return access.get(planId) || null;
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
    .prepare('SELECT id, username, tokenVersion, isAdmin, isSuperAdmin, disabled, mustChangePassword FROM users WHERE id = ?')
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
  const normalizedUsername = String(userRow.username || '').toLowerCase();
  req.userId = session.userId;
  req.username = normalizedUsername;
  req.isAdmin = !!userRow.isAdmin;
  req.isSuperAdmin = !!userRow.isSuperAdmin && normalizedUsername === 'superadmin';
  ensureCsrfCookie(req, res);
  next();
};

app.use(
  '/uploads',
  requireAuth,
  express.static(uploadsDir, {
    maxAge: '365d',
    immutable: true
  })
);

const getWsAuthContext = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.deskly_session;
  const session = verifySession(authSecret, token);
  if (!session?.userId || !session?.tokenVersion || !session?.sid) return null;
  if (session.sid !== serverInstanceId) return null;
  const row = db.prepare('SELECT id, username, disabled FROM users WHERE id = ?').get(session.userId);
  if (!row) return null;
  if (Number(row.disabled) === 1) return null;
  return { userId: row.id, username: String(row.username || '').toLowerCase() };
};

// Public: used by the login UI to decide whether to show first-run credentials.
app.get('/api/auth/bootstrap-status', (_req, res) => {
  try {
    const row = db
      .prepare("SELECT mustChangePassword, passwordSalt, passwordHash FROM users WHERE lower(username) = 'superadmin'")
      .get();
    const count = db.prepare('SELECT COUNT(*) as n FROM users').get()?.n || 0;
    if (!row) {
      res.json({ showFirstRunCredentials: count === 0 });
      return;
    }
    const isDefault =
      Number(row.mustChangePassword) === 1 && verifyPassword('deskly', row.passwordSalt, row.passwordHash);
    res.json({ showFirstRunCredentials: isDefault });
  } catch {
    res.json({ showFirstRunCredentials: false });
  }
});

const loginAttemptBucket = new Map(); // ip -> { count, resetAt }
let lastLoginAttemptCleanup = 0;
const cleanupLoginAttemptBucket = (now) => {
  if (now - lastLoginAttemptCleanup < 60_000) return;
  lastLoginAttemptCleanup = now;
  for (const [key, entry] of loginAttemptBucket.entries()) {
    if (now > entry.resetAt) loginAttemptBucket.delete(key);
  }
};
const allowLoginAttempt = (ip) => {
  const key = ip || 'unknown';
  const now = Date.now();
  cleanupLoginAttemptBucket(now);
  const row = loginAttemptBucket.get(key);
  if (!row || now > row.resetAt) {
    loginAttemptBucket.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  row.count += 1;
  if (row.count > 20) return false;
  return true;
};

const loginUserBucket = new Map(); // username -> { count, resetAt, lockedUntil }
let lastLoginUserCleanup = 0;
const LOGIN_USER_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_USER_MAX_ATTEMPTS = 8;
const LOGIN_USER_LOCK_MS = 15 * 60 * 1000;
const cleanupLoginUserBucket = (now) => {
  if (now - lastLoginUserCleanup < 60_000) return;
  lastLoginUserCleanup = now;
  for (const [key, entry] of loginUserBucket.entries()) {
    if (now > entry.resetAt && now > entry.lockedUntil) loginUserBucket.delete(key);
  }
};
const normalizeLoginKey = (value) => String(value || '').trim().toLowerCase();
const getUserLock = (username) => {
  const key = normalizeLoginKey(username);
  if (!key) return null;
  const now = Date.now();
  cleanupLoginUserBucket(now);
  const entry = loginUserBucket.get(key);
  if (!entry) return null;
  if (entry.lockedUntil && now < entry.lockedUntil) return entry.lockedUntil;
  return null;
};
const registerUserLoginFailure = (username) => {
  const key = normalizeLoginKey(username);
  if (!key) return { lockedNow: false };
  const now = Date.now();
  cleanupLoginUserBucket(now);
  let entry = loginUserBucket.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + LOGIN_USER_WINDOW_MS, lockedUntil: 0 };
    loginUserBucket.set(key, entry);
  }
  entry.count += 1;
  if (entry.count >= LOGIN_USER_MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOGIN_USER_LOCK_MS;
    return { lockedNow: true, lockedUntil: entry.lockedUntil };
  }
  return { lockedNow: false };
};
const clearUserLoginFailures = (username) => {
  const key = normalizeLoginKey(username);
  if (key) loginUserBucket.delete(key);
};

const rateBuckets = new Map(); // key -> { count, resetAt }
let lastRateCleanup = 0;
const cleanupRateBuckets = (now) => {
  if (now - lastRateCleanup < 60_000) return;
  lastRateCleanup = now;
  for (const [key, entry] of rateBuckets.entries()) {
    if (now > entry.resetAt) rateBuckets.delete(key);
  }
};
const rateLimit =
  ({ name, windowMs, max, key }) =>
  (req, res, next) => {
    const now = Date.now();
    cleanupRateBuckets(now);
    const bucketKey = `${name}:${key(req) || 'unknown'}`;
    const entry = rateBuckets.get(bucketKey);
    if (!entry || now > entry.resetAt) {
      rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
const rateByUser = (name, windowMs, max) =>
  rateLimit({
    name,
    windowMs,
    max,
    key: (req) => req.userId || req.ip
  });

const shouldUseSecureCookie = (req) => resolveSecureCookie(req);

app.post('/api/auth/login', (req, res) => {
  const { username, password, otp } = req.body || {};
  const normalizedUsername = normalizeLoginKey(username);
  if (!normalizedUsername || !password) {
    res.status(400).json({ error: 'Missing username/password' });
    return;
  }
  const meta = requestMeta(req);
  if (!allowLoginAttempt(meta.ip)) {
    res.status(429).json({ error: 'Too many attempts' });
    return;
  }
  const lockedUntil = getUserLock(normalizedUsername);
  if (lockedUntil) {
    writeAuthLog(db, { event: 'login', success: false, username: normalizedUsername, ...meta, details: { reason: 'locked', lockedUntil } });
    res.status(429).json({ error: 'Account temporarily locked', lockedUntil });
    return;
  }
  let row = db
    .prepare(
      'SELECT id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, mfaEnabled, mfaSecretEnc, mustChangePassword FROM users WHERE lower(username) = ?'
    )
    .get(normalizedUsername);
  if (!row) {
    if (normalizedUsername === 'superadmin' && String(password) === 'deskly') {
      try {
        const count = db.prepare('SELECT COUNT(*) as n FROM users').get()?.n || 0;
        if (count === 0) {
          ensureBootstrapAdmins(db);
          row = db
            .prepare(
              'SELECT id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, mfaEnabled, mfaSecretEnc, mustChangePassword FROM users WHERE lower(username) = ?'
            )
            .get(normalizedUsername);
        }
      } catch {
        // ignore
      }
    }
    if (!row) {
      const lock = registerUserLoginFailure(normalizedUsername);
      if (lock.lockedNow) {
        writeAuditLog(db, { level: 'important', event: 'login_lockout', username: normalizedUsername, ...meta, details: { lockedUntil: lock.lockedUntil } });
      }
      writeAuthLog(db, { event: 'login', success: false, username: normalizedUsername, ...meta, details: { reason: 'user_not_found' } });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
  }
  if (row && Number(row.disabled) === 1) {
    writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'disabled' } });
    res.status(403).json({ error: 'User disabled' });
    return;
  }
  const passwordValue = String(password);
  let passwordOk = verifyPassword(passwordValue, row.passwordSalt, row.passwordHash);
  const isBootstrapAttempt =
    row.username === 'superadmin' && Number(row.mustChangePassword) === 1 && passwordValue === 'deskly';
  if (!passwordOk && isBootstrapAttempt) {
    try {
      const { salt, hash } = hashPassword('deskly');
      db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, updatedAt = ? WHERE id = ?').run(
        salt,
        hash,
        Date.now(),
        row.id
      );
      row.passwordSalt = salt;
      row.passwordHash = hash;
      passwordOk = true;
    } catch {
      passwordOk = false;
    }
  }
  if (!passwordOk) {
    const lock = registerUserLoginFailure(row.username);
    if (lock.lockedNow) {
      writeAuditLog(db, { level: 'important', event: 'login_lockout', userId: row.id, username: row.username, ...meta, details: { lockedUntil: lock.lockedUntil } });
      writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_password' } });
      res.status(429).json({ error: 'Account temporarily locked', lockedUntil: lock.lockedUntil });
      return;
    }
    writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_password' } });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (Number(row.mfaEnabled) === 1) {
    if (!otp) {
      writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'mfa_required' } });
      res.status(401).json({ error: 'MFA required', mfaRequired: true });
      return;
    }
    const secret = decryptSecret(authSecret, row.mfaSecretEnc);
    if (!secret || !verifyTotp(secret, otp)) {
      const lock = registerUserLoginFailure(row.username);
      if (lock.lockedNow) {
        writeAuditLog(db, { level: 'important', event: 'login_lockout', userId: row.id, username: row.username, ...meta, details: { lockedUntil: lock.lockedUntil } });
        writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_mfa' } });
        res.status(429).json({ error: 'Account temporarily locked', lockedUntil: lock.lockedUntil });
        return;
      }
      writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_mfa' } });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
  }
  const token = signSession(authSecret, {
    userId: row.id,
    tokenVersion: row.tokenVersion,
    sid: serverInstanceId,
    iat: Date.now()
  });
  setSessionCookie(res, token, undefined, { secure: shouldUseSecureCookie(req) });
  ensureCsrfCookie(req, res);
  clearUserLoginFailures(row.username);
  writeAuthLog(db, { event: 'login', success: true, userId: row.id, username: row.username, ...meta });
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySession(authSecret, cookies.deskly_session);
  clearSessionCookie(res);
  clearCsrfCookie(res);
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

app.get('/api/auth/mfa', requireAuth, (req, res) => {
  const row = db.prepare('SELECT mfaEnabled FROM users WHERE id = ?').get(req.userId);
  res.json({ enabled: !!row && Number(row.mfaEnabled) === 1 });
});

app.post('/api/auth/mfa/setup', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    res.status(400).json({ error: 'Missing password' });
    return;
  }
  const row = db.prepare('SELECT username, passwordSalt, passwordHash, mfaEnabled FROM users WHERE id = ?').get(req.userId);
  if (!row) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!verifyPassword(String(password), row.passwordSalt, row.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (Number(row.mfaEnabled) === 1) {
    res.status(400).json({ error: 'MFA already enabled' });
    return;
  }
  const secret = generateTotpSecret(row.username);
  const enc = encryptSecret(authSecret, secret.base32);
  db.prepare('UPDATE users SET mfaSecretEnc = ?, mfaEnabled = 0, updatedAt = ? WHERE id = ?').run(enc, Date.now(), req.userId);
  writeAuditLog(db, { level: 'important', event: 'mfa_setup', userId: req.userId, username: row.username, ...requestMeta(req) });
  res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url });
});

app.post('/api/auth/mfa/enable', requireAuth, (req, res) => {
  const { otp } = req.body || {};
  if (!otp) {
    res.status(400).json({ error: 'Missing otp' });
    return;
  }
  const row = db.prepare('SELECT username, mfaSecretEnc, mfaEnabled FROM users WHERE id = ?').get(req.userId);
  if (!row) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (Number(row.mfaEnabled) === 1) {
    res.status(400).json({ error: 'MFA already enabled' });
    return;
  }
  const secret = decryptSecret(authSecret, row.mfaSecretEnc);
  if (!secret || !verifyTotp(secret, otp)) {
    res.status(400).json({ error: 'Invalid otp' });
    return;
  }
  db.prepare('UPDATE users SET mfaEnabled = 1, updatedAt = ? WHERE id = ?').run(Date.now(), req.userId);
  writeAuditLog(db, { level: 'important', event: 'mfa_enabled', userId: req.userId, username: row.username, ...requestMeta(req) });
  res.json({ ok: true });
});

app.post('/api/auth/mfa/disable', requireAuth, (req, res) => {
  const { password, otp } = req.body || {};
  if (!password || !otp) {
    res.status(400).json({ error: 'Missing password/otp' });
    return;
  }
  const row = db.prepare('SELECT username, passwordSalt, passwordHash, mfaSecretEnc, mfaEnabled, tokenVersion FROM users WHERE id = ?').get(req.userId);
  if (!row) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!verifyPassword(String(password), row.passwordSalt, row.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (Number(row.mfaEnabled) !== 1) {
    res.status(400).json({ error: 'MFA not enabled' });
    return;
  }
  const secret = decryptSecret(authSecret, row.mfaSecretEnc);
  if (!secret || !verifyTotp(secret, otp)) {
    res.status(400).json({ error: 'Invalid otp' });
    return;
  }
  db.prepare('UPDATE users SET mfaEnabled = 0, mfaSecretEnc = NULL, tokenVersion = ?, updatedAt = ? WHERE id = ?').run(
    Number(row.tokenVersion) + 1,
    Date.now(),
    req.userId
  );
  writeAuditLog(db, { level: 'important', event: 'mfa_disabled', userId: req.userId, username: row.username, ...requestMeta(req) });
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/settings/audit', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ auditVerbose: getAuditVerboseEnabled(db) });
});

app.get('/api/settings/npm-audit', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const raw = getAppSetting('npmAuditLastCheck');
  let lastCheckAt = null;
  let lastCheckBy = null;
  let lastCheckUserId = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        lastCheckAt = Number(parsed.ts || parsed.lastCheckAt || 0) || null;
        lastCheckUserId = parsed.userId || null;
        lastCheckBy = parsed.username || resolveUsername(parsed.userId) || null;
      } else {
        lastCheckAt = Number(raw) || null;
      }
    } catch {
      lastCheckAt = Number(raw) || null;
    }
  }
  res.json({ lastCheckAt, lastCheckBy, lastCheckUserId });
});

app.post('/api/settings/npm-audit', requireAuth, rateByUser('npm_audit', 10 * 60 * 1000, 2), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const startedAt = Date.now();
  const checkStartedAt = Date.now();
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFile(
    npmCmd,
    ['audit', '--omit=dev', '--audit-level=high', '--json'],
    { cwd: process.cwd(), timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      let parsed = null;
      let summary = null;
      if (stdout) {
        try {
          parsed = JSON.parse(stdout);
        } catch {}
      }
      if (parsed && parsed.metadata && parsed.metadata.vulnerabilities) {
        const raw = parsed.metadata.vulnerabilities;
        const levels = ['info', 'low', 'moderate', 'high', 'critical'];
        let total = 0;
        summary = {};
        for (const level of levels) {
          const count = Number(raw[level] || 0);
          summary[level] = count;
          total += count;
        }
        summary.total = total;
      }
      const durationMs = Date.now() - startedAt;
      const exitCode = err && typeof err.code === 'number' ? err.code : 0;
      const trim = (text) => {
        const src = String(text || '');
        if (src.length <= 20000) return src;
        return `${src.slice(0, 20000)}\n... (truncated)`;
      };
      const ok = !!parsed;
      if (ok) {
        writeAuditLog(db, {
          level: 'important',
          event: 'npm_audit_run',
          userId: req.userId,
          ...requestMeta(req),
          details: { summary, exitCode, durationMs }
        });
      }
      setAppSetting(
        'npmAuditLastCheck',
        JSON.stringify({
          ts: checkStartedAt,
          userId: req.userId || null,
          username: req.username || resolveUsername(req.userId) || null
        })
      );
      res.json({
        ok,
        summary,
        durationMs,
        exitCode,
        lastCheckAt: checkStartedAt,
        lastCheckBy: req.username || resolveUsername(req.userId) || null,
        error: !ok ? (err?.message || 'Failed to run npm audit') : undefined,
        stderr: trim(stderr)
      });
    }
  );
});

// --- Custom Import: external "real users" per client (superadmin) ---
const parseCsvRows = (text) => {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  const pushCell = () => {
    row.push(cur);
    cur = '';
  };
  const pushRow = () => {
    if (row.length || cur) {
      pushCell();
      rows.push(row);
    }
    row = [];
  };
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      pushCell();
      continue;
    }
    if (ch === '\n') {
      pushRow();
      continue;
    }
    if (ch === '\r') {
      if (src[i + 1] === '\n') i += 1;
      pushRow();
      continue;
    }
    cur += ch;
  }
  if (cur || row.length) pushRow();
  return rows.filter((r) => r.some((cell) => String(cell || '').trim() !== ''));
};

const parseCsvEmployees = (text) => {
  const rows = parseCsvRows(String(text || ''));
  if (!rows.length) return { employees: [], error: 'Empty CSV' };
  const header = rows.shift().map((h) => String(h || '').trim().toLowerCase());
  if (!header.length) return { employees: [], error: 'Missing header' };
  const map = new Map();
  const mapping = {
    externalid: 'externalId',
    firstname: 'firstName',
    lastname: 'lastName',
    role: 'role',
    dept1: 'dept1',
    dept2: 'dept2',
    dept3: 'dept3',
    email: 'email',
    ext1: 'ext1',
    ext2: 'ext2',
    ext3: 'ext3',
    isexternal: 'isExternal'
  };
  header.forEach((key, idx) => {
    const normalized = mapping[key] || null;
    if (normalized) map.set(normalized, idx);
  });
  if (!map.has('externalId')) return { employees: [], error: 'Missing externalId column' };
  const employees = [];
  const parseBool = (value) => {
    const v = String(value || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y';
  };
  for (const row of rows) {
    const externalId = String(row[map.get('externalId')] || '').trim();
    if (!externalId) continue;
    const get = (key) => {
      const idx = map.get(key);
      if (idx === undefined) return '';
      return String(row[idx] || '').trim();
    };
    employees.push({
      externalId,
      firstName: get('firstName'),
      lastName: get('lastName'),
      role: get('role'),
      dept1: get('dept1'),
      dept2: get('dept2'),
      dept3: get('dept3'),
      email: get('email'),
      ext1: get('ext1'),
      ext2: get('ext2'),
      ext3: get('ext3'),
      isExternal: parseBool(get('isExternal'))
    });
  }
  return { employees, error: null };
};

const clearImportDataForClient = (cid) => {
  const removedUsers = db.prepare('DELETE FROM external_users WHERE clientId = ?').run(cid).changes || 0;
  const state = readState();
  let removedObjects = 0;
  const nextClients = (state.clients || []).map((c) => {
    if (c.id !== cid) return c;
    return {
      ...c,
      sites: (c.sites || []).map((s) => ({
        ...s,
        floorPlans: (s.floorPlans || []).map((p) => {
          const prevCount = (p.objects || []).length;
          const nextObjects = (p.objects || []).filter((o) => !(o.type === 'real_user' && o.externalClientId === cid));
          removedObjects += prevCount - nextObjects.length;
          return { ...p, objects: nextObjects };
        })
      }))
    };
  });
  const payload = { clients: nextClients, objectTypes: state.objectTypes };
  const updatedAt = writeState(payload);
  return { removedUsers, removedObjects, updatedAt };
};
app.get('/api/import/config', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const clientId = String(req.query.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  res.json({ config: getImportConfigSafe(db, clientId) });
});

app.get('/api/import/summary', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const state = readState();
  const summaries = listImportSummary(db);
  const byId = new Map(summaries.map((s) => [s.clientId, s]));
  const rows = (state.clients || []).map((c) => {
    const entry = byId.get(c.id);
    return {
      clientId: c.id,
      clientName: c.name || c.shortName || c.id,
      lastImportAt: entry?.lastImportAt || null,
      total: entry?.total || 0,
      presentCount: entry?.presentCount || 0,
      missingCount: entry?.missingCount || 0,
      hiddenCount: entry?.hiddenCount || 0,
      configUpdatedAt: entry?.configUpdatedAt || null,
      hasConfig: !!entry?.configUpdatedAt
    };
  });
  res.json({ ok: true, rows });
});

app.put('/api/import/config', requireAuth, rateByUser('import_config', 60 * 1000, 10), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, url, username, password, bodyJson, method } = req.body || {};
  const cid = String(clientId || '').trim();
  const u = String(url || '').trim();
  const un = String(username || '').trim();
  if (!cid || !u || !un) {
    res.status(400).json({ error: 'Missing clientId/url/username' });
    return;
  }
  const methodRaw = String(method || '').trim().toUpperCase();
  const nextMethod = methodRaw === 'GET' ? 'GET' : methodRaw === 'POST' || !methodRaw ? 'POST' : null;
  if (!nextMethod) {
    res.status(400).json({ error: 'Invalid method (use GET or POST)' });
    return;
  }
  if (bodyJson !== undefined && String(bodyJson || '').trim()) {
    try {
      JSON.parse(String(bodyJson));
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }
  const cfg = upsertImportConfig(db, dataSecret, { clientId: cid, url: u, username: un, password, method: nextMethod, bodyJson });
  writeAuditLog(db, {
    level: 'important',
    event: 'import_config_update',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: {
      url: u,
      username: un,
      method: nextMethod,
      passwordChanged: password !== undefined,
      bodyChanged: bodyJson !== undefined
    }
  });
  res.json({ ok: true, config: cfg });
});

app.post('/api/import/test', requireAuth, rateByUser('import_test', 60 * 1000, 10), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cfg = getImportConfig(db, dataSecret, cid);
  if (!cfg || !cfg.url || !cfg.username) {
    res.status(400).json({ error: 'Missing import config (url/username)' });
    return;
  }
  const result = await fetchEmployeesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
  writeAuditLog(db, { level: 'important', event: 'import_test', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { ok: !!result.ok, status: result.status } });
  if (!result.ok) {
    res.status(400).json({
      ok: false,
      status: result.status,
      error: result.error || 'Request failed',
      contentType: result.contentType || '',
      rawSnippet: result.rawSnippet || ''
    });
    return;
  }
  const preview = (result.employees || []).slice(0, 25);
  res.json({ ok: true, status: result.status, count: (result.employees || []).length, preview });
});

app.post('/api/import/sync', requireAuth, rateByUser('import_sync', 60 * 1000, 10), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cfg = getImportConfig(db, dataSecret, cid);
  if (!cfg || !cfg.url || !cfg.username) {
    res.status(400).json({ error: 'Missing import config (url/username)' });
    return;
  }
  const result = await fetchEmployeesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
  if (!result.ok) {
    writeAuditLog(db, { level: 'important', event: 'import_sync', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { ok: false, status: result.status, error: result.error || '' } });
    res.status(400).json({
      ok: false,
      status: result.status,
      error: result.error || 'Request failed',
      contentType: result.contentType || '',
      rawSnippet: result.rawSnippet || ''
    });
    return;
  }
  const sync = upsertExternalUsers(db, cid, result.employees || []);
  writeAuditLog(db, { level: 'important', event: 'import_sync', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: sync.summary });
  res.json({ ok: true, ...sync });
});

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
    details: { mode: importMode, count: parsed.employees.length, created: sync.summary?.created, updated: sync.summary?.updated, removedUsers: cleanup?.removedUsers || 0, removedObjects: cleanup?.removedObjects || 0 }
  });
  res.json({ ok: true, ...sync, cleanup });
});

app.post('/api/import/diff', requireAuth, rateByUser('import_diff', 60 * 1000, 10), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cfg = getImportConfig(db, dataSecret, cid);
  if (!cfg || !cfg.url || !cfg.username) {
    res.status(400).json({ error: 'Missing import config (url/username)' });
    return;
  }
  const result = await fetchEmployeesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
  if (!result.ok) {
    res.status(400).json({ ok: false, status: result.status, error: result.error || 'Request failed', contentType: result.contentType || '', rawSnippet: result.rawSnippet || '' });
    return;
  }
  const remote = result.employees || [];
  const existing = db
    .prepare(
      'SELECT externalId, firstName, lastName, role, dept1, dept2, dept3, email, ext1, ext2, ext3, isExternal, present FROM external_users WHERE clientId = ?'
    )
    .all(cid);
  const byId = new Map(existing.map((r) => [String(r.externalId), r]));
  const remoteIds = new Set(remote.map((e) => String(e.externalId)));
  let newCount = 0;
  let updatedCount = 0;
  let missingCount = 0;
  const missingSample = [];
  const newSample = [];

  const norm = (s) => String(s || '').trim();
  for (const e of remote) {
    const id = String(e.externalId);
    const prev = byId.get(id);
    if (!prev) {
      newCount += 1;
      if (newSample.length < 10) newSample.push({ externalId: id, firstName: e.firstName || '', lastName: e.lastName || '' });
      continue;
    }
    const changed =
      norm(prev.firstName) !== norm(e.firstName) ||
      norm(prev.lastName) !== norm(e.lastName) ||
      norm(prev.role) !== norm(e.role) ||
      norm(prev.dept1) !== norm(e.dept1) ||
      norm(prev.dept2) !== norm(e.dept2) ||
      norm(prev.dept3) !== norm(e.dept3) ||
      norm(prev.email) !== norm(e.email) ||
      norm(prev.ext1) !== norm(e.ext1) ||
      norm(prev.ext2) !== norm(e.ext2) ||
      norm(prev.ext3) !== norm(e.ext3) ||
      Number(prev.isExternal || 0) !== (e.isExternal ? 1 : 0) ||
      Number(prev.present || 1) !== 1;
    if (changed) updatedCount += 1;
  }
  for (const prev of existing) {
    const id = String(prev.externalId);
    if (remoteIds.has(id)) continue;
    if (Number(prev.present || 1) !== 1) continue;
    missingCount += 1;
    if (missingSample.length < 10) missingSample.push({ externalId: id, firstName: prev.firstName || '', lastName: prev.lastName || '' });
  }
  res.json({
    ok: true,
    remoteCount: remote.length,
    localCount: existing.length,
    newCount,
    updatedCount,
    missingCount,
    newSample,
    missingSample
  });
});

app.post('/api/import/clear', requireAuth, rateByUser('import_clear', 60 * 1000, 10), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cleanup = clearImportDataForClient(cid);
  writeAuditLog(db, { level: 'important', event: 'import_clear', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { removedUsers: cleanup.removedUsers, removedObjects: cleanup.removedObjects } });
  res.json({ ok: true, removedUsers: cleanup.removedUsers, removedObjects: cleanup.removedObjects, updatedAt: cleanup.updatedAt });
});

app.get('/api/external-users', requireAuth, (req, res) => {
  const clientId = String(req.query.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const serverState = readState();
  if (!req.isAdmin && !req.isSuperAdmin) {
    // Non-admin users can list external users only for clients they can see (ro/rw).
    const ctx = getUserWithPermissions(db, req.userId);
    const access = computePlanAccess(serverState.clients, ctx?.permissions || []);
    const filtered = filterStateForUser(serverState.clients, access, false);
    const allowed = (filtered || []).some((c) => c.id === clientId);
    if (!allowed) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }
  const q = String(req.query.q || '').trim();
  const includeHidden = String(req.query.includeHidden || '') === '1';
  const includeMissing = String(req.query.includeMissing || '') === '1';
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  const offset = req.query.offset !== undefined ? Number(req.query.offset) : undefined;
  const rows = listExternalUsers(db, { clientId, q, includeHidden, includeMissing, limit, offset });
  const client = (serverState.clients || []).find((c) => c.id === clientId);
  const presentCount = rows.filter((r) => r.present).length;
  const hiddenCount = rows.filter((r) => r.hidden).length;
  const missingCount = rows.filter((r) => !r.present).length;
  res.json({
    ok: true,
    clientId,
    clientName: client?.name || client?.shortName || null,
    total: rows.length,
    presentCount,
    hiddenCount,
    missingCount,
    rows
  });
});

app.post('/api/external-users/hide', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, externalId, hidden } = req.body || {};
  const cid = String(clientId || '').trim();
  const eid = String(externalId || '').trim();
  if (!cid || !eid) {
    res.status(400).json({ error: 'Missing clientId/externalId' });
    return;
  }
  setExternalUserHidden(db, cid, eid, !!hidden);
  writeAuditLog(db, { level: 'important', event: 'external_user_hide', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { externalId: eid, hidden: !!hidden } });
  res.json({ ok: true });
});

app.put('/api/settings/audit', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const enabled = !!req.body?.auditVerbose;
  setAuditVerboseEnabled(db, enabled);
  writeAuditLog(db, { level: 'important', event: 'audit_settings_update', userId: req.userId, ...requestMeta(req), details: { auditVerbose: enabled } });
  res.json({ ok: true, auditVerbose: enabled });
});

app.get('/api/settings/email', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ config: getEmailConfigSafe(db) });
});

app.put('/api/settings/email', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const payload = req.body || {};
  const updated = upsertEmailConfig(db, dataSecret, {
    host: payload.host,
    port: payload.port,
    secure: payload.secure,
    securityMode: payload.securityMode,
    username: payload.username,
    password: payload.password,
    fromName: payload.fromName,
    fromEmail: payload.fromEmail
  });
  writeAuditLog(db, {
    level: 'important',
    event: 'email_settings_update',
    userId: req.userId,
    username: req.username,
    ...requestMeta(req),
    details: { host: updated?.host || null, port: updated?.port || null, securityMode: updated?.securityMode || null }
  });
  res.json({ ok: true, config: updated });
});

app.post('/api/settings/email/test', requireAuth, rateByUser('email_test', 5 * 60 * 1000, 5), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const recipient = String(req.body?.recipient || '').trim();
  const subjectInput = String(req.body?.subject || '').trim();
  if (!recipient) {
    res.status(400).json({ error: 'Missing recipient' });
    return;
  }
  const config = getEmailConfig(db, dataSecret);
  if (!config || !config.host) {
    res.status(400).json({ error: 'Missing SMTP host' });
    return;
  }
  if (config.username && !config.password) {
    res.status(400).json({ error: 'Missing SMTP password' });
    return;
  }
  const fromEmail = config.fromEmail || config.username;
  if (!fromEmail) {
    res.status(400).json({ error: 'Missing from email' });
    return;
  }
  const subject = subjectInput || 'Test Email';
  const fromLabel = config.fromName ? `"${config.fromName.replace(/"/g, '')}" <${fromEmail}>` : fromEmail;
  const securityMode = config.securityMode || (config.secure ? 'ssl' : 'starttls');
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: securityMode === 'ssl',
    requireTLS: securityMode === 'starttls',
    ...(config.username ? { auth: { user: config.username, pass: config.password } } : {})
  });
  try {
    const info = await transport.sendMail({
      from: fromLabel,
      to: recipient,
      subject,
      text: 'This is a test email from Deskly.'
    });
    logEmailAttempt(db, {
      userId: req.userId,
      username: req.username,
      recipient,
      subject,
      success: true,
      details: {
        host: config.host,
        port: config.port,
        secure: !!config.secure,
        fromEmail,
        messageId: info?.messageId || null
      }
    });
    writeAuditLog(db, {
      level: 'important',
      event: 'email_test_sent',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req),
      details: { recipient, messageId: info?.messageId || null }
    });
    res.json({ ok: true, messageId: info?.messageId || null });
  } catch (err) {
    logEmailAttempt(db, {
      userId: req.userId,
      username: req.username,
      recipient,
      subject,
      success: false,
      error: err?.message || 'Failed to send',
      details: {
        host: config.host,
        port: config.port,
        secure: !!config.secure,
        fromEmail
      }
    });
    res.status(500).json({ error: 'Failed to send test email', detail: err?.message || null });
  }
});

app.get('/api/settings/email/logs', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const result = listEmailLogs(db, { q: req.query.q, limit: req.query.limit, offset: req.query.offset });
  res.json(result);
});

app.post('/api/settings/email/logs/clear', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const total = Number(db.prepare('SELECT COUNT(1) as c FROM email_log').get()?.c || 0);
  db.prepare('DELETE FROM email_log').run();
  markLogsCleared('mail', req.userId, req.username);
  writeAuditLog(db, {
    level: 'important',
    event: 'email_log_cleared',
    userId: req.userId,
    username: req.username,
    ...requestMeta(req),
    details: { count: total }
  });
  res.json({ ok: true, deleted: total });
});

app.get('/api/settings/logs-meta', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const meta = readLogsMeta();
  const normalized = {};
  Object.entries(meta || {}).forEach(([kind, info]) => {
    if (!info || typeof info !== 'object') return;
    const username = info.username || resolveUsername(info.userId);
    normalized[kind] = { ...info, username: username || null };
  });
  res.json({ meta: normalized });
});

app.post('/api/audit', requireAuth, (req, res) => {
  const { event, level, scopeType, scopeId, details } = req.body || {};
  if (!event || typeof event !== 'string') {
    res.status(400).json({ error: 'Missing event' });
    return;
  }
  // Only allow client-side audit events from authenticated users; the server decides whether verbose is enabled.
  const ctx = getUserWithPermissions(db, req.userId);
  writeAuditLog(db, {
    level: level === 'verbose' ? 'verbose' : 'important',
    event: String(event).slice(0, 80),
    userId: req.userId,
    username: ctx?.user?.username || null,
    scopeType: scopeType ? String(scopeType).slice(0, 16) : null,
    scopeId: scopeId ? String(scopeId).slice(0, 128) : null,
    ...requestMeta(req),
    details: details && typeof details === 'object' ? details : details ? { value: String(details) } : null
  });
  res.json({ ok: true });
});

app.get('/api/audit', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const q = String(req.query.q || '').trim().toLowerCase();
  const level = String(req.query.level || 'all');
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const where = [];
  const params = {};
  if (level === 'important' || level === 'verbose') {
    where.push('level = @level');
    params.level = level;
  }
  if (q) {
    where.push(`(LOWER(event) LIKE @q OR LOWER(COALESCE(username,'')) LIKE @q OR LOWER(COALESCE(details,'')) LIKE @q OR LOWER(COALESCE(scopeId,'')) LIKE @q)`);
    params.q = `%${q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    db
      .prepare(
        `SELECT COUNT(1) as c
         FROM audit_log
         ${whereSql}`
      )
      .get({ ...params })?.c || 0
  );
  const rows = db
    .prepare(
      `SELECT id, ts, level, event, userId, username, ip, method, path, userAgent, scopeType, scopeId, details
       FROM audit_log
       ${whereSql}
       ORDER BY id DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset })
    .map((r) => ({
      ...r,
      details: (() => {
        try {
          return r.details ? JSON.parse(r.details) : null;
        } catch {
          return r.details;
        }
      })()
    }));
  res.json({ rows, limit, offset, total });
});

app.post('/api/audit/clear', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  db.prepare('DELETE FROM audit_log').run();
  markLogsCleared('audit', req.userId, req.username);
  writeAuditLog(db, { level: 'important', event: 'audit_log_cleared', userId: req.userId, username: req.username, ...requestMeta(req) });
  res.json({ ok: true });
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
  setSessionCookie(res, token, undefined, { secure: shouldUseSecureCookie(req) });
  ensureCsrfCookie(req, res);
  writeAuditLog(db, {
    level: 'important',
    event: 'first_run_completed',
    userId: req.userId,
    username: req.username,
    ...requestMeta(req)
  });
  res.json({ ok: true });
});

app.put('/api/auth/me', requireAuth, (req, res) => {
  const { language, defaultPlanId, clientOrder, paletteFavorites, visibleLayerIdsByPlan } = req.body || {};
  const nextLanguage = language === 'en' ? 'en' : language === 'it' ? 'it' : undefined;
  const nextDefaultPlanId =
    typeof defaultPlanId === 'string' ? defaultPlanId : defaultPlanId === null ? null : undefined;
  const nextClientOrder =
    Array.isArray(clientOrder) && clientOrder.every((x) => typeof x === 'string')
      ? [...new Set(clientOrder.map((x) => String(x)))]
      : clientOrder === null
        ? []
        : undefined;
  const nextPaletteFavorites =
    Array.isArray(paletteFavorites) && paletteFavorites.every((x) => typeof x === 'string')
      ? paletteFavorites.map((x) => String(x))
      : paletteFavorites === null
        ? []
        : undefined;
  const nextVisibleLayerIdsByPlan =
    visibleLayerIdsByPlan === null
      ? {}
      : visibleLayerIdsByPlan && typeof visibleLayerIdsByPlan === 'object' && !Array.isArray(visibleLayerIdsByPlan)
        ? visibleLayerIdsByPlan
        : undefined;

  if (
    nextLanguage === undefined &&
    nextDefaultPlanId === undefined &&
    nextClientOrder === undefined &&
    nextPaletteFavorites === undefined &&
    nextVisibleLayerIdsByPlan === undefined
  ) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const state = readState();

  // Validate defaultPlanId: must exist and be accessible to the current user (unless admin).
  if (nextDefaultPlanId !== undefined) {
    if (nextDefaultPlanId !== null) {
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

  if (nextPaletteFavorites !== undefined) {
    const allowed = new Set((state.objectTypes || []).map((d) => d.id));
    const uniq = [];
    const seen = new Set();
    for (const id of nextPaletteFavorites) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (allowed.size && !allowed.has(id)) continue;
      uniq.push(id);
    }
    // If objectTypes is missing (very old state), accept but still de-dupe.
    // (uniq already de-dupes even if allowed is empty)
    var validatedPaletteFavorites = uniq;
  }
  if (nextVisibleLayerIdsByPlan !== undefined) {
    let allowedPlanIds = null;
    if (!req.isAdmin) {
      const ctx = getUserWithPermissions(db, req.userId);
      allowedPlanIds = computePlanAccess(state.clients, ctx?.permissions || []);
    }
    const out = {};
    for (const [planId, ids] of Object.entries(nextVisibleLayerIdsByPlan || {})) {
      if (typeof planId !== 'string') continue;
      if (allowedPlanIds && !allowedPlanIds.has(planId)) continue;
      if (!Array.isArray(ids)) continue;
      const uniq = [];
      const seen = new Set();
      for (const id of ids) {
        const val = String(id);
        if (seen.has(val)) continue;
        seen.add(val);
        uniq.push(val);
      }
      out[planId] = uniq;
    }
    var validatedVisibleLayerIdsByPlan = out;
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
  if (nextClientOrder !== undefined) {
    sets.push('clientOrderJson = ?');
    params.push(JSON.stringify(nextClientOrder));
  }
  if (nextPaletteFavorites !== undefined) {
    sets.push('paletteFavoritesJson = ?');
    params.push(JSON.stringify(validatedPaletteFavorites || []));
  }
  if (nextVisibleLayerIdsByPlan !== undefined) {
    sets.push('visibleLayerIdsByPlanJson = ?');
    params.push(JSON.stringify(validatedVisibleLayerIdsByPlan || {}));
  }
  sets.push('updatedAt = ?');
  params.push(now);
  params.push(req.userId);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

// --- Per-user custom fields for objects (profile-scoped) ---
app.get('/api/custom-fields', requireAuth, (req, res) => {
  res.json({ fields: listCustomFields(db, req.userId) });
});

app.post('/api/custom-fields', requireAuth, (req, res) => {
  const result = createCustomField(db, req.userId, req.body || {});
  if (!result.ok) {
    res.status(400).json({ error: result.error || 'Invalid payload' });
    return;
  }
  writeAuditLog(db, { level: 'important', event: 'custom_field_create', userId: req.userId, ...requestMeta(req), details: { id: result.id } });
  res.json({ ok: true, id: result.id });
});

app.post('/api/custom-fields/bulk', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const typeId = String(req.body?.typeId || '').trim();
  const fields = Array.isArray(req.body?.fields) ? req.body.fields : [];
  const nextFields = fields
    .map((f) => ({
      label: String(f?.label || '').trim(),
      valueType: f?.valueType === 'number' ? 'number' : f?.valueType === 'boolean' ? 'boolean' : f?.valueType === 'string' ? 'string' : ''
    }))
    .filter((f) => f.label && f.valueType);
  if (!typeId) {
    res.status(400).json({ error: 'Missing typeId' });
    return;
  }
  if (!nextFields.length) {
    res.json({ ok: true, created: 0 });
    return;
  }
  const users = db.prepare('SELECT id FROM users').all();
  const tx = db.transaction(() => {
    for (const u of users) {
      for (const f of nextFields) {
        createCustomField(db, u.id, { typeId, label: f.label, valueType: f.valueType });
      }
    }
  });
  try {
    tx();
  } catch {
    // ignore
  }
  writeAuditLog(db, {
    level: 'important',
    event: 'custom_field_bulk_create',
    userId: req.userId,
    ...requestMeta(req),
    details: { typeId, fields: nextFields.length }
  });
  res.json({ ok: true, created: nextFields.length * users.length });
});

app.put('/api/custom-fields/:id', requireAuth, (req, res) => {
  const result = updateCustomField(db, req.userId, req.params.id, req.body || {});
  if (!result.ok) {
    res.status(400).json({ error: result.error || 'Invalid payload' });
    return;
  }
  writeAuditLog(db, { level: 'important', event: 'custom_field_update', userId: req.userId, ...requestMeta(req), details: { id: String(req.params.id) } });
  res.json({ ok: true });
});

app.delete('/api/custom-fields/:id', requireAuth, (req, res) => {
  const result = deleteCustomField(db, req.userId, req.params.id);
  if (!result.ok) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  writeAuditLog(db, { level: 'important', event: 'custom_field_delete', userId: req.userId, ...requestMeta(req), details: { id: String(req.params.id) } });
  res.json({ ok: true });
});

app.get('/api/object-custom/:objectId', requireAuth, (req, res) => {
  const objectId = String(req.params.objectId || '').trim();
  if (!objectId) {
    res.status(400).json({ error: 'Missing objectId' });
    return;
  }
  const values = getObjectCustomValues(db, req.userId, objectId);
  res.json({ values });
});

app.put('/api/object-custom/:objectId', requireAuth, (req, res) => {
  const objectId = String(req.params.objectId || '').trim();
  const typeId = String(req.body?.typeId || '').trim();
  if (!objectId || !typeId) {
    res.status(400).json({ error: 'Missing objectId/typeId' });
    return;
  }
  const fields = listCustomFields(db, req.userId).filter((f) => String(f.typeId) === typeId);
  const next = validateValuesAgainstFields(fields, req.body?.values || {});
  setObjectCustomValues(db, req.userId, objectId, next);
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

app.put('/api/state', requireAuth, rateByUser('state_save', 60 * 1000, 240), (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || !('clients' in body)) {
    res.status(400).json({ error: 'Invalid payload (expected {clients})' });
    return;
  }
  const assetValidation = validateAssetsInClients(body.clients);
  if (!assetValidation.ok) {
    res.status(400).json({
      error: 'Invalid upload',
      details: {
        field: assetValidation.field,
        reason: assetValidation.reason,
        mime: assetValidation.mime,
        maxBytes: assetValidation.maxBytes
      }
    });
    return;
  }
  const serverState = readState();
  const lockedByOthers = new Set();
  for (const [planId, lock] of planLocks.entries()) {
    if (!lock) continue;
    if (lock.userId && lock.userId !== req.userId) lockedByOthers.add(planId);
  }

  const buildPlanMap = (clients) => {
    const map = new Map();
    for (const c of clients || []) {
      for (const s of c?.sites || []) {
        for (const p of s?.floorPlans || []) {
          if (p?.id) map.set(p.id, p);
        }
      }
    }
    return map;
  };

  const hasPlanId = (clients, planId) => {
    for (const c of clients || []) {
      for (const s of c?.sites || []) {
        for (const p of s?.floorPlans || []) {
          if (p?.id === planId) return true;
        }
      }
    }
    return false;
  };

  const applyLockedPlans = (incomingClients) => {
    if (!lockedByOthers.size) return incomingClients;
    const serverPlans = buildPlanMap(serverState.clients);
    // Prevent destructive operations on a plan that is currently locked by another user.
    for (const planId of lockedByOthers) {
      if (hasPlanId(serverState.clients, planId) && !hasPlanId(incomingClients, planId)) {
        res.status(423).json({ error: 'Plan is locked', planId });
        return null;
      }
    }
    // Replace any locked plan with the server version to avoid overwriting concurrent edits.
    for (const c of incomingClients || []) {
      for (const s of c?.sites || []) {
        for (let i = 0; i < (s?.floorPlans || []).length; i += 1) {
          const p = s.floorPlans[i];
          if (!p?.id) continue;
          if (!lockedByOthers.has(p.id)) continue;
          const serverPlan = serverPlans.get(p.id);
          if (serverPlan) s.floorPlans[i] = serverPlan;
        }
      }
    }
    return incomingClients;
  };

  if (req.isAdmin) {
    const incomingClients = Array.isArray(body.clients) ? body.clients : [];
    const lockedApplied = applyLockedPlans(incomingClients);
    if (!lockedApplied) return;
    const incomingIds = new Set((lockedApplied || []).map((c) => c.id));
    const removedClientIds = (serverState.clients || []).map((c) => c.id).filter((id) => id && !incomingIds.has(id));
    if (removedClientIds.length) {
      const delUsers = db.prepare('DELETE FROM external_users WHERE clientId = ?');
      const delCfg = db.prepare('DELETE FROM client_user_import WHERE clientId = ?');
      const tx = db.transaction((ids) => {
        for (const cid of ids) {
          delUsers.run(cid);
          delCfg.run(cid);
        }
      });
      tx(removedClientIds);
      for (const cid of removedClientIds) {
        writeAuditLog(db, { level: 'important', event: 'import_cleanup', userId: req.userId, scopeType: 'client', scopeId: cid, ...requestMeta(req), details: { reason: 'client_deleted' } });
      }
    }
    const payload = { clients: lockedApplied, objectTypes: Array.isArray(body.objectTypes) ? body.objectTypes : serverState.objectTypes };
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
  // Enforce exclusive lock: even if the user has RW permission, they cannot write if another user holds the plan lock.
  for (const planId of lockedByOthers) writablePlanIds.delete(planId);
  const nextClients = mergeWritablePlanContent(serverState.clients, body.clients, writablePlanIds);
  const payload = { clients: nextClients, objectTypes: serverState.objectTypes };
  const updatedAt = writeState(payload);
  const filtered = filterStateForUser(payload.clients, access, false);
  res.json({ ok: true, updatedAt, clients: filtered, objectTypes: payload.objectTypes });
});

// Object type requests (custom object creation)
const mapObjectTypeRequest = (row) => {
  let payload = null;
  let finalPayload = null;
  try {
    payload = JSON.parse(row.payloadJson || '{}');
  } catch {
    payload = null;
  }
  try {
    finalPayload = row.finalPayloadJson ? JSON.parse(row.finalPayloadJson) : null;
  } catch {
    finalPayload = null;
  }
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt,
    requestedBy: { id: row.requestedById, username: row.requestedByUsername },
    reviewedAt: row.reviewedAt || null,
    reviewedBy: row.reviewedById ? { id: row.reviewedById, username: row.reviewedByUsername } : null,
    reason: row.reason || null,
    payload,
    finalPayload
  };
};

app.get('/api/object-type-requests', requireAuth, (req, res) => {
  let rows = [];
  if (req.isSuperAdmin) {
    rows = db.prepare('SELECT * FROM object_type_requests ORDER BY requestedAt DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM object_type_requests WHERE requestedById = ? ORDER BY requestedAt DESC').all(req.userId);
  }
  res.json({ requests: rows.map(mapObjectTypeRequest) });
});

app.post('/api/object-type-requests', requireAuth, (req, res) => {
  const { typeId, nameIt, nameEn, icon, customFields } = req.body || {};
  const cleanedId = String(typeId || '').trim();
  const cleanedIt = String(nameIt || '').trim();
  const cleanedEn = String(nameEn || '').trim();
  const cleanedIcon = String(icon || '').trim();
  if (!cleanedId || !cleanedIt || !cleanedEn || !cleanedIcon) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  const nextCustomFields = Array.isArray(customFields)
    ? customFields
        .map((f) => ({
          label: String(f?.label || '').trim(),
          valueType: f?.valueType === 'number' ? 'number' : f?.valueType === 'boolean' ? 'boolean' : f?.valueType === 'string' ? 'string' : ''
        }))
        .filter((f) => f.label && f.valueType)
    : [];
  const userRow = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId);
  if (!userRow?.username) {
    res.status(400).json({ error: 'Invalid user' });
    return;
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  const payload = {
    typeId: cleanedId,
    nameIt: cleanedIt,
    nameEn: cleanedEn,
    icon: cleanedIcon,
    customFields: nextCustomFields
  };
  db.prepare(
    `INSERT INTO object_type_requests
      (id, status, payloadJson, requestedAt, requestedById, requestedByUsername)
      VALUES (?, 'pending', ?, ?, ?, ?)`
  ).run(id, JSON.stringify(payload), now, req.userId, userRow.username);
  res.json({ ok: true, id });
});

app.put('/api/object-type-requests/:id', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const requestId = String(req.params.id || '').trim();
  if (!requestId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const row = db.prepare('SELECT id FROM object_type_requests WHERE id = ?').get(requestId);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const { status, reason, finalPayload } = req.body || {};
  if (!['approved', 'rejected'].includes(String(status))) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const now = Date.now();
  const reviewer = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId);
  const nextPayload = finalPayload
    ? {
        typeId: String(finalPayload.typeId || '').trim(),
        nameIt: String(finalPayload.nameIt || '').trim(),
        nameEn: String(finalPayload.nameEn || '').trim(),
        icon: String(finalPayload.icon || '').trim(),
        customFields: Array.isArray(finalPayload.customFields)
          ? finalPayload.customFields
              .map((f) => ({
                label: String(f?.label || '').trim(),
                valueType: f?.valueType === 'number' ? 'number' : f?.valueType === 'boolean' ? 'boolean' : f?.valueType === 'string' ? 'string' : ''
              }))
              .filter((f) => f.label && f.valueType)
          : []
      }
    : null;
  const finalJson = nextPayload ? JSON.stringify(nextPayload) : null;
  db.prepare(
    `UPDATE object_type_requests
     SET status = ?, reason = ?, reviewedAt = ?, reviewedById = ?, reviewedByUsername = ?, finalPayloadJson = ?
     WHERE id = ?`
  ).run(String(status), reason ? String(reason) : null, now, req.userId, reviewer?.username || '', finalJson, requestId);
  if (status === 'approved' && nextPayload) {
    const serverState = readState();
    const existingTypes = Array.isArray(serverState.objectTypes) ? serverState.objectTypes : [];
    const nextTypes = existingTypes.map((t) => ({ ...t, name: { ...t.name } }));
    const existing = nextTypes.find((t) => t.id === nextPayload.typeId);
    if (existing) {
      existing.name = { it: nextPayload.nameIt, en: nextPayload.nameEn };
      existing.icon = nextPayload.icon;
      if (existing.builtin === undefined) existing.builtin = false;
    } else {
      nextTypes.push({
        id: nextPayload.typeId,
        name: { it: nextPayload.nameIt, en: nextPayload.nameEn },
        icon: nextPayload.icon,
        builtin: false
      });
    }
    writeState({ clients: serverState.clients, objectTypes: nextTypes });
  }
  if (status === 'approved' && nextPayload && Array.isArray(nextPayload.customFields) && nextPayload.customFields.length) {
    const users = db.prepare('SELECT id FROM users').all();
    const tx = db.transaction(() => {
      for (const u of users) {
        for (const f of nextPayload.customFields) {
          createCustomField(db, u.id, { typeId: nextPayload.typeId, label: f.label, valueType: f.valueType });
        }
      }
    });
    try {
      tx();
    } catch {
      // ignore
    }
  }
  res.json({ ok: true });
});

app.put('/api/object-type-requests/:id/user', requireAuth, (req, res) => {
  const requestId = String(req.params.id || '').trim();
  if (!requestId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const row = db
    .prepare('SELECT id, status, requestedById FROM object_type_requests WHERE id = ?')
    .get(requestId);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (row.requestedById !== req.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (row.status === 'approved') {
    res.status(400).json({ error: 'Already approved' });
    return;
  }
  const { typeId, nameIt, nameEn, icon, customFields } = req.body || {};
  const cleanedId = String(typeId || '').trim();
  const cleanedIt = String(nameIt || '').trim();
  const cleanedEn = String(nameEn || '').trim();
  const cleanedIcon = String(icon || '').trim();
  if (!cleanedId || !cleanedIt || !cleanedEn || !cleanedIcon) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  const nextCustomFields = Array.isArray(customFields)
    ? customFields
        .map((f) => ({
          label: String(f?.label || '').trim(),
          valueType: f?.valueType === 'number' ? 'number' : f?.valueType === 'boolean' ? 'boolean' : f?.valueType === 'string' ? 'string' : ''
        }))
        .filter((f) => f.label && f.valueType)
    : [];
  const payload = {
    typeId: cleanedId,
    nameIt: cleanedIt,
    nameEn: cleanedEn,
    icon: cleanedIcon,
    customFields: nextCustomFields
  };
  db.prepare(
    `UPDATE object_type_requests
     SET status = 'pending', payloadJson = ?, reviewedAt = NULL, reviewedById = NULL, reviewedByUsername = NULL, reason = NULL, finalPayloadJson = NULL
     WHERE id = ?`
  ).run(JSON.stringify(payload), requestId);
  res.json({ ok: true });
});

app.delete('/api/object-type-requests/:id', requireAuth, (req, res) => {
  const requestId = String(req.params.id || '').trim();
  if (!requestId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const row = db
    .prepare('SELECT id, status, requestedById FROM object_type_requests WHERE id = ?')
    .get(requestId);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (row.requestedById !== req.userId && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (row.status === 'approved') {
    res.status(400).json({ error: 'Already approved' });
    return;
  }
  db.prepare('DELETE FROM object_type_requests WHERE id = ?').run(requestId);
  res.json({ ok: true });
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
    .map((u) => {
      const normalizedUsername = String(u.username || '').toLowerCase();
      return {
        ...u,
        username: normalizedUsername,
        isAdmin: !!u.isAdmin,
        isSuperAdmin: !!u.isSuperAdmin && normalizedUsername === 'superadmin',
        disabled: !!u.disabled
      };
    });
  const perms = db.prepare('SELECT userId, scopeType, scopeId, access FROM permissions').all();
  const permsByUser = new Map();
  for (const p of perms) {
    const list = permsByUser.get(p.userId) || [];
    list.push({ scopeType: p.scopeType, scopeId: p.scopeId, access: p.access });
    permsByUser.set(p.userId, list);
  }
  res.json({
    users: users.map((u) => ({
      ...u,
      lockedUntil: getUserLock(u.username),
      permissions: permsByUser.get(u.id) || []
    }))
  });
});

app.post('/api/users', requireAuth, rateByUser('users_create', 10 * 60 * 1000, 30), (req, res) => {
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
  const normalizedUsername = normalizeLoginKey(username);
  if (!normalizedUsername || !password) {
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
  const existing = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(normalizedUsername);
  if (existing) {
    res.status(400).json({ error: 'Username already exists' });
    return;
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  const { salt, hash } = hashPassword(String(password));
  const defaultPaletteFavoritesJson = JSON.stringify(['real_user', 'user', 'desktop', 'rack']);
  try {
    db.prepare(
      `INSERT INTO users (id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, language, paletteFavoritesJson, firstName, lastName, phone, email, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      normalizedUsername,
      salt,
      hash,
      isAdmin ? 1 : 0,
      String(language),
      defaultPaletteFavoritesJson,
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
  writeAuditLog(db, {
    level: 'important',
    event: 'user_created',
    userId: req.userId,
    username: req.username,
    scopeType: 'user',
    scopeId: id,
    ...requestMeta(req),
    details: { username: normalizedUsername, isAdmin: !!isAdmin, permissions: Array.isArray(permissions) ? permissions.length : 0 }
  });
  res.json({ ok: true, id });
});

app.put('/api/users/:id', requireAuth, rateByUser('users_update', 10 * 60 * 1000, 60), (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const userId = req.params.id;
  const target = db
    .prepare('SELECT id, username, isAdmin, isSuperAdmin, disabled, language, firstName, lastName, phone, email FROM users WHERE id = ?')
    .get(userId);
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
  const lockedDisabled = target.isSuperAdmin ? 0 : (disabled ? 1 : 0);
  db.prepare(
    'UPDATE users SET isAdmin = ?, disabled = ?, language = COALESCE(?, language), firstName = ?, lastName = ?, phone = ?, email = ?, updatedAt = ? WHERE id = ?'
  ).run(
    isAdmin ? 1 : 0,
    lockedDisabled,
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
  const changes = [];
  if (typeof isAdmin === 'boolean' && Number(target.isAdmin) !== (isAdmin ? 1 : 0)) changes.push('isAdmin');
  if (typeof disabled === 'boolean' && Number(target.disabled) !== (disabled ? 1 : 0)) changes.push('disabled');
  if (language && String(language) !== String(target.language)) changes.push('language');
  const profileChanged =
    (firstName !== undefined && String(firstName || '') !== String(target.firstName || '')) ||
    (lastName !== undefined && String(lastName || '') !== String(target.lastName || '')) ||
    (phone !== undefined && String(phone || '') !== String(target.phone || '')) ||
    (email !== undefined && String(email || '') !== String(target.email || ''));
  if (profileChanged) changes.push('profile');
  if (Array.isArray(permissions)) changes.push('permissions');
  if (changes.length) {
    writeAuditLog(db, {
      level: 'important',
      event: 'user_updated',
      userId: req.userId,
      username: req.username,
      scopeType: 'user',
      scopeId: target.id,
      ...requestMeta(req),
      details: { targetUsername: target.username, changes }
    });
  }
  res.json({ ok: true });
});

app.post('/api/users/:id/password', requireAuth, rateByUser('users_password', 10 * 60 * 1000, 30), (req, res) => {
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
  writeAuditLog(db, {
    level: 'important',
    event: 'user_password_changed',
    userId: req.userId,
    username: req.username,
    scopeType: 'user',
    scopeId: targetId,
    ...requestMeta(req),
    details: { self: isSelf, byAdmin: !!req.isAdmin }
  });
  res.json({ ok: true });
});

app.post('/api/users/:id/mfa-reset', requireAuth, rateByUser('users_mfa_reset', 10 * 60 * 1000, 30), (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const targetId = req.params.id;
  const target = db.prepare('SELECT id, username, isSuperAdmin, tokenVersion FROM users WHERE id = ?').get(targetId);
  if (!target) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (target.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Only superadmin can reset superadmin MFA' });
    return;
  }
  db.prepare('UPDATE users SET mfaEnabled = 0, mfaSecretEnc = NULL, tokenVersion = ?, updatedAt = ? WHERE id = ?').run(
    Number(target.tokenVersion || 1) + 1,
    Date.now(),
    targetId
  );
  writeAuditLog(db, {
    level: 'important',
    event: 'user_mfa_reset',
    userId: req.userId,
    username: req.username,
    scopeType: 'user',
    scopeId: targetId,
    ...requestMeta(req),
    details: { targetUsername: target.username }
  });
  res.json({ ok: true });
});

app.post('/api/users/:id/unlock', requireAuth, rateByUser('users_unlock', 10 * 60 * 1000, 60), (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const targetId = req.params.id;
  const target = db.prepare('SELECT id, username, isSuperAdmin FROM users WHERE id = ?').get(targetId);
  if (!target) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (target.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Only superadmin can unlock superadmin' });
    return;
  }
  clearUserLoginFailures(target.username);
  writeAuditLog(db, {
    level: 'important',
    event: 'user_unlocked',
    userId: req.userId,
    username: req.username,
    scopeType: 'user',
    scopeId: targetId,
    ...requestMeta(req),
    details: { targetUsername: target.username }
  });
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, rateByUser('users_delete', 10 * 60 * 1000, 30), (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const targetId = req.params.id;
  if (targetId === req.userId) {
    res.status(400).json({ error: 'Cannot delete self' });
    return;
  }
  const target = db.prepare('SELECT username, isSuperAdmin FROM users WHERE id = ?').get(targetId);
  if (target?.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Cannot delete superadmin' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  db.prepare('DELETE FROM permissions WHERE userId = ?').run(targetId);
  writeAuditLog(db, {
    level: 'important',
    event: 'user_deleted',
    userId: req.userId,
    username: req.username,
    scopeType: 'user',
    scopeId: targetId,
    ...requestMeta(req),
    details: { targetUsername: target?.username || null }
  });
  res.json({ ok: true });
});

app.get('/api/admin/logs', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const where = q ? "WHERE lower(coalesce(username,'')) LIKE ? OR lower(coalesce(ip,'')) LIKE ? OR lower(coalesce(path,'')) LIKE ? OR lower(coalesce(event,'')) LIKE ?" : '';
  const base = `
    SELECT id, ts, event, success, userId, username, ip, method, path, userAgent, details
    FROM auth_log
    ${where}
    ORDER BY ts DESC
    LIMIT ? OFFSET ?`;
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit, offset] : [limit, offset];
  const rows = db.prepare(base).all(...params).map((r) => ({ ...r, success: !!r.success }));
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
  writeAuditLog(db, { level: 'important', event: 'auth_log_cleared', userId: req.userId, username: req.username, ...requestMeta(req) });
  res.json({ ok: true });
});

// Serve built frontend (optional, for docker/prod)
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  const auth = getWsAuthContext(req);
  if (!auth) {
    try {
      ws.close(1008, 'unauthorized');
    } catch {}
    return;
  }
  wsClientInfo.set(ws, { userId: auth.userId, username: auth.username, plans: new Set() });
  jsonSend(ws, { type: 'hello', userId: auth.userId, username: auth.username });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw || ''));
    } catch {
      return;
    }
    const info = wsClientInfo.get(ws);
    if (!info) return;

    if (msg?.type === 'join') {
      const planId = String(msg.planId || '').trim();
      if (!planId) return;
      const access = getPlanAccessForUser(info.userId, planId);
      if (!access) {
        jsonSend(ws, { type: 'access_denied', planId });
        return;
      }
      if (!wsPlanMembers.has(planId)) wsPlanMembers.set(planId, new Set());
      wsPlanMembers.get(planId).add(ws);
      info.plans.add(planId);

      const lock = planLocks.get(planId) || null;
      jsonSend(ws, { type: 'lock_state', planId, lockedBy: lock ? { userId: lock.userId, username: lock.username } : null });
      jsonSend(ws, { type: 'presence', planId, users: computePresence(planId) });

      if (!!msg.wantLock) {
        if (access !== 'rw') {
          jsonSend(ws, { type: 'lock_denied', planId, lockedBy: null });
          emitPresence(planId);
          return;
        }
        const existing = planLocks.get(planId);
        if (!existing || existing.userId === info.userId) {
          planLocks.set(planId, { userId: info.userId, username: info.username, ts: Date.now() });
          writeAuditLog(db, { level: 'important', event: 'plan_lock_acquired', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId });
          emitLockState(planId);
        } else {
          jsonSend(ws, { type: 'lock_denied', planId, lockedBy: { userId: existing.userId, username: existing.username } });
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_lock_denied',
            userId: info.userId,
            username: info.username,
            scopeType: 'plan',
            scopeId: planId,
            details: { lockedBy: { userId: existing.userId, username: existing.username } }
          });
        }
      }
      emitPresence(planId);
      return;
    }

    if (msg?.type === 'leave') {
      const planId = String(msg.planId || '').trim();
      if (!planId) return;
      const members = wsPlanMembers.get(planId);
      if (members) {
        members.delete(ws);
        if (!members.size) wsPlanMembers.delete(planId);
      }
      info.plans.delete(planId);
      const lock = planLocks.get(planId);
      if (lock && lock.userId === info.userId) {
        const remaining = wsPlanMembers.get(planId);
        let stillThere = false;
        if (remaining) {
          for (const otherWs of remaining) {
            const otherInfo = wsClientInfo.get(otherWs);
            if (otherInfo?.userId === info.userId) {
              stillThere = true;
              break;
            }
          }
        }
        if (!stillThere) {
          planLocks.delete(planId);
          writeAuditLog(db, { level: 'important', event: 'plan_lock_released', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId, details: { reason: 'leave' } });
          emitLockState(planId);
        }
      }
      emitPresence(planId);
      return;
    }

    if (msg?.type === 'release_lock') {
      const planId = String(msg.planId || '').trim();
      const lock = planLocks.get(planId);
      if (lock && lock.userId === info.userId) {
        planLocks.delete(planId);
        writeAuditLog(db, { level: 'important', event: 'plan_lock_released', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId, details: { reason: 'release' } });
        emitLockState(planId);
      }
    }
  });

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    releaseLocksForWs(ws);
  });
});

const heartbeatTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try {
        ws.terminate();
      } catch {}
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {}
  }
}, 30_000);

wss.on('close', () => clearInterval(heartbeatTimer));

server.listen(PORT, HOST, () => {
});
const hostHint = HOST === '0.0.0.0' ? 'localhost' : HOST;
console.log(`[deskly] API listening on http://${hostHint}:${PORT}`);
if (HOST === '0.0.0.0') {
  console.log(`[deskly] API listening on all interfaces (http://0.0.0.0:${PORT})`);
}
