const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const nodemailer = require('nodemailer');
const { openDb, getOrCreateAuthSecret, getOrCreateDataSecret, listMigrationStatus } = require('./db.cjs');
const { createDatabaseBackup, listBackups, resolveBackupDir, resolveBackupRetention } = require('./backup.cjs');
const {
  parseCookies,
  verifyPassword,
  hashPassword,
  isStrongPassword,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  ensureBootstrapAdmins,
  PRIMARY_SESSION_COOKIE
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
  getExternalUser,
  setExternalUserHidden,
  listImportSummary,
  isManualExternalId,
  upsertManualExternalUser,
  deleteManualExternalUser
} = require('./customImport.cjs');
const {
  getEmailConfigSafe,
  getEmailConfig,
  upsertEmailConfig,
  getClientEmailConfigSafe,
  getClientEmailConfig,
  upsertClientEmailConfig,
  logEmailAttempt,
  listEmailLogs
} = require('./email.cjs');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const STARTED_AT = Date.now();
const APP_BRAND = 'Plixmap';
const DEFAULT_UPDATE_MANIFEST_URL = 'https://www.plixmap.com/updates/latest.json';
const DEFAULT_UPDATE_MANIFEST_FALLBACK_URL = 'https://raw.githubusercontent.com/falott82/plixmap.com/main/updates/latest.json';
const UPDATE_CHECK_TIMEOUT_MS = 5000;
const APP_VERSION = (() => {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return String(parsed?.version || '').trim() || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

const readEnv = (name) => process.env[name];

const isEnabled = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const normalizeSemver = (value) => {
  const raw = String(value || '').trim();
  return SEMVER_REGEX.test(raw) ? raw : null;
};
const compareSemver = (a, b) => {
  const aParts = String(a || '')
    .split('.')
    .map((part) => Number(part));
  const bParts = String(b || '')
    .split('.')
    .map((part) => Number(part));
  for (let i = 0; i < 3; i += 1) {
    const left = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const right = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
};

const getPreferredLanIPv4 = () => {
  try {
    const nets = os.networkInterfaces ? os.networkInterfaces() : {};
    const candidates = [];
    for (const entries of Object.values(nets || {})) {
      for (const entry of entries || []) {
        if (!entry || entry.internal) continue;
        if (entry.family !== 'IPv4' && entry.family !== 4) continue;
        const addr = String(entry.address || '').trim();
        if (!addr) continue;
        candidates.push(addr);
      }
    }
    const privateFirst =
      candidates.find((ip) => /^192\.168\./.test(ip)) ||
      candidates.find((ip) => /^10\./.test(ip)) ||
      candidates.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) ||
      candidates[0];
    return privateFirst || null;
  } catch {
    return null;
  }
};

const buildKioskPublicUrl = (req, roomId) => {
  const encoded = encodeURIComponent(String(roomId || '').trim());
  const hostHeader = String(req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim() || 'http';
  let hostname = '';
  let port = '';
  if (hostHeader.startsWith('[')) {
    const m = /^\[([^\]]+)\](?::(\d+))?$/.exec(hostHeader);
    hostname = String(m?.[1] || '');
    port = String(m?.[2] || '');
  } else {
    const [h, p] = hostHeader.split(':');
    hostname = String(h || '');
    port = String(p || '');
  }
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    hostname = getPreferredLanIPv4() || hostname || 'localhost';
  }
  const portPart = port ? `:${port}` : '';
  return `${proto}://${hostname}${portPart}/meetingroom/${encoded}`;
};
const buildKioskPublicUploadUrl = (req, rawUrl) => {
  const raw = String(rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/uploads/')) return raw;
  const hostHeader = String(req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim() || 'http';
  let hostname = '';
  let port = '';
  if (hostHeader.startsWith('[')) {
    const m = /^\[([^\]]+)\](?::(\d+))?$/.exec(hostHeader);
    hostname = String(m?.[1] || '');
    port = String(m?.[2] || '');
  } else {
    const [h, p] = hostHeader.split(':');
    hostname = String(h || '');
    port = String(p || '');
  }
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    hostname = getPreferredLanIPv4() || hostname || 'localhost';
  }
  const portPart = port ? `:${port}` : '';
  return `${proto}://${hostname}${portPart}/public-uploads/${raw.slice('/uploads/'.length)}`;
};
const normalizeHttpUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
};
const resolveUpdateManifestUrl = () => {
  const requested = normalizeHttpUrl(readEnv('PLIXMAP_UPDATE_MANIFEST_URL'));
  return requested || DEFAULT_UPDATE_MANIFEST_URL;
};
const resolveUpdateManifestFallbackUrl = () => {
  const requested = normalizeHttpUrl(readEnv('PLIXMAP_UPDATE_MANIFEST_FALLBACK_URL'));
  return requested || DEFAULT_UPDATE_MANIFEST_FALLBACK_URL;
};
const UPDATE_MANIFEST_URL = resolveUpdateManifestUrl();
const UPDATE_MANIFEST_FALLBACK_URL = resolveUpdateManifestFallbackUrl();

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const SERVER_LOG_LEVEL = (() => {
  const requested = String(readEnv('PLIXMAP_LOG_LEVEL') || 'info').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOG_LEVELS, requested) ? requested : 'info';
})();

const shouldLogLevel = (level) => LOG_LEVELS[level] >= LOG_LEVELS[SERVER_LOG_LEVEL];
const serverLog = (level, event, context = {}) => {
  if (!shouldLogLevel(level)) return;
  const payload = {
    at: new Date().toISOString(),
    level,
    event,
    ...context
  };
  const json = JSON.stringify(payload);
  if (level === 'error') console.error(json);
  else if (level === 'warn') console.warn(json);
  else console.log(json);
};

const buildCspHeader = () => {
  const allowMediaPipe = isEnabled(readEnv('PLIXMAP_CSP_ALLOW_MEDIAPIPE'), false);
  const allowEval = isEnabled(readEnv('PLIXMAP_CSP_ALLOW_EVAL'), false) || allowMediaPipe;
  const scriptSrc = ["'self'"];
  const connectSrc = ["'self'", 'ws:', 'wss:'];
  const workerSrc = ["'self'", 'blob:'];
  if (allowEval) scriptSrc.push("'unsafe-eval'", "'wasm-unsafe-eval'");
  if (allowMediaPipe) {
    scriptSrc.push('https://cdn.jsdelivr.net');
    connectSrc.push('https://cdn.jsdelivr.net', 'https://storage.googleapis.com');
    workerSrc.push('https://cdn.jsdelivr.net');
  }
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src ${scriptSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `worker-src ${workerSrc.join(' ')}`
  ].join('; ');
};

const CSP_HEADER_VALUE = buildCspHeader();

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
const trustProxyValue = readEnv('PLIXMAP_TRUST_PROXY');
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
app.use((req, res, next) => {
  const forwarded = req.headers['x-request-id'];
  const candidate = typeof forwarded === 'string' ? forwarded.trim() : Array.isArray(forwarded) ? String(forwarded[0] || '').trim() : '';
  const requestId =
    candidate && candidate.length <= 120 ? candidate : crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    if (!String(req.originalUrl || '').startsWith('/api') && res.statusCode < 400) return;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    serverLog(level, 'http_request', {
      requestId,
      method: req.method || '',
      path: req.originalUrl || req.url || '',
      status: res.statusCode,
      durationMs,
      userId: req.userId || null
    });
  });
  next();
});
const resolveSecureCookie = (req) => {
  const override = readEnv('PLIXMAP_COOKIE_SECURE');
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
  // Needed for voice notes in client chat + presentation mode webcam controls (getUserMedia).
  // Browser permission prompts still apply; this only controls whether the feature is allowed at all.
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP_HEADER_VALUE);
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

const CSRF_COOKIE = 'plixmap_csrf';
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
  const buildCookie = (name) => {
    const parts = [
      `${name}=${encodeURIComponent(token)}`,
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${CSRF_MAX_AGE}`
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  };
  appendSetCookie(res, buildCookie(CSRF_COOKIE));
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
  if (
    req.path.startsWith('/meeting-room/') &&
    (req.path.endsWith('/checkin-toggle') || req.path.endsWith('/help-request'))
  ) {
    return next();
  }
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

const CAPACITY_HISTORY_SETTING_KEY = 'capacityHistoryV1';
const CAPACITY_HISTORY_LIMIT = 540;
const CAPACITY_SNAPSHOT_MIN_INTERVAL_MS = 60 * 60 * 1000;
const CAPACITY_USER_TYPES = new Set(['user', 'real_user', 'generic_user']);

const capacityNormalizeText = (value) => String(value || '').trim();
const capacityToPositiveInt = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
};
const capacityToPositive = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

const resolveVisibleClientsForRequest = (req, allClients) => {
  if (req.isAdmin || req.isSuperAdmin) return allClients;
  const ctx = getUserWithPermissions(db, req.userId);
  if (!ctx) return [];
  const access = computePlanAccess(allClients, ctx.permissions || []);
  return filterStateForUser(allClients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator }) || [];
};

const buildCapacityTrendSnapshot = (clients, at = Date.now()) => {
  const clientEntries = [];
  for (const client of clients || []) {
    const clientId = String(client?.id || '').trim();
    if (!clientId) continue;
    const clientName = capacityNormalizeText(client.shortName) || capacityNormalizeText(client.name) || clientId;
    const siteEntries = [];
    let clientCapacity = 0;
    let clientUsers = 0;
    let clientSurfaceSqm = 0;
    let clientRooms = 0;
    let clientFloors = 0;

    for (const site of client?.sites || []) {
      const siteId = String(site?.id || '').trim();
      if (!siteId) continue;
      const siteName = capacityNormalizeText(site?.name) || siteId;
      let siteCapacity = 0;
      let siteUsers = 0;
      let siteSurfaceSqm = 0;
      let siteRooms = 0;
      let siteFloors = 0;

      for (const plan of site?.floorPlans || []) {
        const roomUsersById = new Map();
        for (const obj of plan?.objects || []) {
          if (!CAPACITY_USER_TYPES.has(String(obj?.type || ''))) continue;
          const roomId = String(obj?.roomId || '').trim();
          if (!roomId) continue;
          roomUsersById.set(roomId, Number(roomUsersById.get(roomId) || 0) + 1);
        }
        const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
        for (const room of rooms) {
          const roomId = String(room?.id || '').trim();
          if (!roomId) continue;
          const roomCapacity = capacityToPositiveInt(room?.capacity);
          const roomUsers = Number(roomUsersById.get(roomId) || 0);
          const surfaceSqm = capacityToPositive(room?.surfaceSqm);
          if (roomCapacity !== null) siteCapacity += roomCapacity;
          siteUsers += roomUsers;
          siteSurfaceSqm += surfaceSqm || 0;
          siteRooms += 1;
        }
        siteFloors += 1;
      }

      siteEntries.push({
        siteId,
        siteName,
        totalCapacity: siteCapacity,
        totalUsers: siteUsers,
        totalSurfaceSqm: siteSurfaceSqm,
        roomsCount: siteRooms,
        floorsCount: siteFloors
      });

      clientCapacity += siteCapacity;
      clientUsers += siteUsers;
      clientSurfaceSqm += siteSurfaceSqm;
      clientRooms += siteRooms;
      clientFloors += siteFloors;
    }

    siteEntries.sort((a, b) => a.siteName.localeCompare(b.siteName));
    clientEntries.push({
      clientId,
      clientName,
      totalCapacity: clientCapacity,
      totalUsers: clientUsers,
      totalSurfaceSqm: clientSurfaceSqm,
      roomsCount: clientRooms,
      floorsCount: clientFloors,
      sitesCount: siteEntries.length,
      sites: siteEntries
    });
  }
  clientEntries.sort((a, b) => a.clientName.localeCompare(b.clientName));
  return { at: Number(at) || Date.now(), clients: clientEntries };
};

const buildCapacitySnapshotSignature = (snapshot) => {
  return (snapshot?.clients || [])
    .map((client) => {
      const sites = (client?.sites || [])
        .map((site) => `${site.siteId}:${site.totalCapacity}:${site.totalUsers}:${site.roomsCount}:${site.floorsCount}`)
        .join(',');
      return `${client.clientId}[${sites}]`;
    })
    .join('|');
};

const sanitizeCapacitySnapshot = (entry) => {
  const at = Number(entry?.at || 0);
  if (!Number.isFinite(at) || at <= 0) return null;
  const clients = Array.isArray(entry?.clients) ? entry.clients : [];
  const sanitizedClients = [];
  for (const client of clients) {
    const clientId = String(client?.clientId || '').trim();
    if (!clientId) continue;
    const siteRows = Array.isArray(client?.sites) ? client.sites : [];
    const sites = [];
    for (const site of siteRows) {
      const siteId = String(site?.siteId || '').trim();
      if (!siteId) continue;
      sites.push({
        siteId,
        siteName: capacityNormalizeText(site?.siteName) || siteId,
        totalCapacity: Number(site?.totalCapacity || 0),
        totalUsers: Number(site?.totalUsers || 0),
        totalSurfaceSqm: Number(site?.totalSurfaceSqm || 0),
        roomsCount: Number(site?.roomsCount || 0),
        floorsCount: Number(site?.floorsCount || 0)
      });
    }
    sites.sort((a, b) => a.siteName.localeCompare(b.siteName));
    sanitizedClients.push({
      clientId,
      clientName: capacityNormalizeText(client?.clientName) || clientId,
      totalCapacity: Number(client?.totalCapacity || 0),
      totalUsers: Number(client?.totalUsers || 0),
      totalSurfaceSqm: Number(client?.totalSurfaceSqm || 0),
      roomsCount: Number(client?.roomsCount || 0),
      floorsCount: Number(client?.floorsCount || 0),
      sitesCount: Number(client?.sitesCount || sites.length || 0),
      sites
    });
  }
  sanitizedClients.sort((a, b) => a.clientName.localeCompare(b.clientName));
  return { at, clients: sanitizedClients };
};

const readCapacityHistory = () => {
  try {
    const raw = getAppSetting(CAPACITY_HISTORY_SETTING_KEY);
    if (!raw) return { snapshots: [], lastSignature: '', lastSnapshotAt: 0 };
    const parsed = JSON.parse(raw) || {};
    const snapshots = Array.isArray(parsed?.snapshots)
      ? parsed.snapshots.map((entry) => sanitizeCapacitySnapshot(entry)).filter(Boolean)
      : [];
    const lastSnapshotAt = Number(parsed?.lastSnapshotAt || snapshots[snapshots.length - 1]?.at || 0) || 0;
    const lastSignature = String(parsed?.lastSignature || '');
    return { snapshots, lastSignature, lastSnapshotAt };
  } catch {
    return { snapshots: [], lastSignature: '', lastSnapshotAt: 0 };
  }
};

const writeCapacityHistory = (payload) => {
  const snapshots = Array.isArray(payload?.snapshots)
    ? payload.snapshots.map((entry) => sanitizeCapacitySnapshot(entry)).filter(Boolean)
    : [];
  const trimmed = snapshots.slice(-CAPACITY_HISTORY_LIMIT);
  const lastSnapshot = trimmed[trimmed.length - 1];
  setAppSetting(
    CAPACITY_HISTORY_SETTING_KEY,
    JSON.stringify({
      snapshots: trimmed,
      lastSignature: String(payload?.lastSignature || ''),
      lastSnapshotAt: Number(payload?.lastSnapshotAt || lastSnapshot?.at || 0) || 0
    })
  );
  return trimmed;
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
const wsClientInfo = new Map(); // ws -> { userId, username, ip, connectedAt, isSuperAdmin, plans: Map<planId, joinedAt> }
const unlockRequests = new Map(); // requestId -> { requestedById, requestedByName, requestedByAvatarUrl, targetUserId, planId, message, grantMinutes, createdAt }
const planLocks = new Map(); // planId -> { userId, username, avatarUrl, acquiredAt, ts, lastActionAt, dirty }
const planLockGrants = new Map(); // planId -> { userId, username, avatarUrl, grantedAt, expiresAt, minutes, grantedById, grantedByName, lastActionAt }
const forceUnlocks = new Map(); // requestId -> { planId, targetUserId, requestedById, requestedByName, createdAt, graceEndsAt, decisionEndsAt, graceMinutes }
const LOCK_CLEANUP_MS = 5_000;
const FORCE_UNLOCK_TAKEOVER_MINUTES = 60;

// Locks never expire automatically (no inactivity/TTL decay). We still use periodic cleanup for:
// - unlock request expiry
// - lock grants expiry
// - force unlock deadlines
const purgeExpiredLocks = () => {
  // legacy no-op (kept because other code paths call it)
  return [];
};

const purgeExpiredGrants = () => {
  const now = Date.now();
  const expired = [];
  for (const [planId, grant] of planLockGrants.entries()) {
    if (!grant?.expiresAt || grant.expiresAt > now) continue;
    planLockGrants.delete(planId);
    expired.push({ planId, grant });
  }
  return expired;
};

const purgeExpiredForceUnlocks = () => {
  const now = Date.now();
  const expired = [];
  for (const [requestId, entry] of forceUnlocks.entries()) {
    const exp = Number(entry?.decisionEndsAt ?? entry?.deadlineAt ?? 0) || 0;
    if (!exp || exp > now) continue;
    forceUnlocks.delete(requestId);
    expired.push({ requestId, entry });
  }
  return expired;
};

const getValidLock = (planId) => {
  const lock = planLocks.get(planId);
  if (!lock) return null;
  return lock;
};

const getValidGrant = (planId) => {
  const grant = planLockGrants.get(planId);
  if (!grant) return null;
  if (grant.expiresAt && grant.expiresAt <= Date.now()) {
    planLockGrants.delete(planId);
    return null;
  }
  return grant;
};

const jsonSend = (ws, obj) => {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    // ignore
  }
};

const broadcastToAll = (obj) => {
  for (const ws of wss.clients || []) jsonSend(ws, obj);
};

const sendToUser = (userId, obj) => {
  let sent = 0;
  for (const [ws, info] of wsClientInfo.entries()) {
    if (info?.userId !== userId) continue;
    jsonSend(ws, obj);
    sent += 1;
  }
  return sent;
};

const broadcastToChatClient = (clientId, obj) => {
  if (!clientId) return;
  for (const [ws, info] of wsClientInfo.entries()) {
    if (!info?.userId) continue;
    const isAdmin = !!info.isAdmin || !!info.isSuperAdmin;
    if (!isAdmin) {
      const allowed = getChatClientIdsForUser(info.userId, false);
      if (!allowed.has(clientId)) continue;
    }
    jsonSend(ws, obj);
  }
};

const broadcastToPlan = (planId, obj) => {
  const members = wsPlanMembers.get(planId);
  if (!members) return;
  for (const ws of members) jsonSend(ws, obj);
};

const resolveUserIdentity = (userId, fallbackUsername = 'user') => {
  const fallback = { userId, username: fallbackUsername || 'user', avatarUrl: '' };
  if (!userId) return fallback;
  // Prefer connected WS info for avatarUrl.
  for (const info of wsClientInfo.values()) {
    if (!info || info.userId !== userId) continue;
    return { userId, username: info.username || fallback.username, avatarUrl: info.avatarUrl || '' };
  }
  try {
    const row = db.prepare('SELECT username, avatarUrl FROM users WHERE id = ?').get(userId);
    return { userId, username: String(row?.username || fallback.username), avatarUrl: String(row?.avatarUrl || '') };
  } catch {
    return fallback;
  }
};

const userIsJoinedToPlan = (planId, userId) => {
  const members = wsPlanMembers.get(planId);
  if (!members) return false;
  for (const ws of members) {
    const info = wsClientInfo.get(ws);
    if (info?.userId === userId) return true;
  }
  return false;
};

const findForceUnlockByPlanAndTarget = (planId, targetUserId) => {
  if (!planId || !targetUserId) return null;
  for (const [requestId, entry] of forceUnlocks.entries()) {
    if (!entry) continue;
    if (entry.planId === planId && entry.targetUserId === targetUserId) return { requestId, entry };
  }
  return null;
};

const completeForceUnlockAsAutoDiscard = (planId, targetUserId, lastActionAt, reason) => {
  const hit = findForceUnlockByPlanAndTarget(planId, targetUserId);
  if (!hit) return false;
  const { requestId, entry } = hit;
  forceUnlocks.delete(requestId);
  // Notify requester (best effort).
  sendToUser(entry.requestedById, { type: 'force_unlock_done', requestId, planId: entry.planId, action: 'discard', ok: true, auto: true, reason });
  writeAuditLog(db, {
    level: 'important',
    event: 'plan_force_unlock_auto_discard',
    userId: entry.requestedById,
    username: entry.requestedByName,
    scopeType: 'plan',
    scopeId: entry.planId,
    details: { targetUserId: entry.targetUserId, reason: reason || 'target_left', requestId }
  });
  finalizeForceUnlockTakeover(entry.planId, entry.requestedById, entry.requestedByName, lastActionAt, requestId, reason || 'target_left');
  return true;
};

const finalizeForceUnlockTakeover = (planId, requestedById, requestedByName, lastActionAt, requestId, reason) => {
  if (!planId || !requestedById) return;
  const identity = resolveUserIdentity(requestedById, requestedByName || 'user');
  const now = Date.now();
  // If the requester is already inside the plan, grant the lock immediately; otherwise reserve it with an hourglass.
  if (userIsJoinedToPlan(planId, requestedById)) {
    planLockGrants.delete(planId);
    planLocks.set(planId, {
      userId: requestedById,
      username: identity.username,
      avatarUrl: identity.avatarUrl || '',
      acquiredAt: now,
      ts: now,
      lastActionAt: null,
      dirty: false
    });
    writeAuditLog(db, {
      level: 'important',
      event: 'plan_lock_acquired',
      userId: requestedById,
      username: identity.username,
      scopeType: 'plan',
      scopeId: planId,
      details: { reason: reason || 'force_unlock', requestId }
    });
  } else {
    const minutes = FORCE_UNLOCK_TAKEOVER_MINUTES;
    const expiresAt = now + Math.round(minutes * 60_000);
    // Only reserve if the plan isn't currently locked.
    const current = getValidLock(planId);
    if (!current) {
      planLockGrants.set(planId, {
        userId: requestedById,
        username: identity.username,
        avatarUrl: identity.avatarUrl || '',
        grantedAt: now,
        expiresAt,
        minutes,
        grantedById: requestedById,
        grantedByName: identity.username,
        lastActionAt: lastActionAt || null
      });
      writeAuditLog(db, {
        level: 'important',
        event: 'plan_lock_granted',
        userId: requestedById,
        username: identity.username,
        scopeType: 'plan',
        scopeId: planId,
        details: { reason: reason || 'force_unlock', requestId, minutes }
      });
    }
  }
  emitLockState(planId);
};

const buildPlanPathMap = (clients) => {
  const map = new Map();
  const formatRev = (rev) => {
    if (!rev) return '';
    if (typeof rev.revMajor === 'number' && typeof rev.revMinor === 'number') return `Rev ${rev.revMajor}.${rev.revMinor}`;
    if (typeof rev.version === 'number') return `Rev 1.${Math.max(0, Number(rev.version) - 1)}`;
    return '';
  };
  for (const c of clients || []) {
    const clientName = c?.shortName || c?.name || '';
    for (const s of c?.sites || []) {
      const siteName = s?.name || '';
      for (const p of s?.floorPlans || []) {
        if (!p?.id) continue;
        const revs = Array.isArray(p?.revisions) ? p.revisions : [];
        let latest = null;
        for (const r of revs) {
          if (!r) continue;
          const ts = Number(r.createdAt || 0) || 0;
          if (!latest || ts > (Number(latest.createdAt || 0) || 0)) latest = r;
        }
        const lastSavedAt = latest ? (Number(latest.createdAt || 0) || null) : null;
        const lastSavedRev = latest ? formatRev(latest) : '';
        map.set(p.id, { clientName, siteName, planName: p?.name || '', lastSavedAt, lastSavedRev });
      }
    }
  }
  return map;
};

const computePresence = (planId) => {
  const members = wsPlanMembers.get(planId);
  const users = new Map();
  const state = readState();
  const planPathMap = buildPlanPathMap(state.clients || []);
  const lockByUser = new Map();
  for (const [lockPlanId, lock] of planLocks.entries()) {
    if (!lock?.userId) continue;
    const path = planPathMap.get(lockPlanId);
    const entry = { planId: lockPlanId, clientName: path?.clientName || '', siteName: path?.siteName || '', planName: path?.planName || '' };
    const existing = lockByUser.get(lock.userId);
    if (!existing || (lock.ts || 0) > (existing.ts || 0)) {
      lockByUser.set(lock.userId, { ...entry, ts: lock.ts || 0 });
    }
  }
  if (members) {
    for (const ws of members) {
      const info = wsClientInfo.get(ws);
      if (!info) continue;
      const key = info.userId;
      const joinedAt = info.plans?.get?.(planId) || null;
      const existing = users.get(key);
      const lock = lockByUser.get(key);
      if (!existing) {
        users.set(key, {
          userId: info.userId,
          username: info.username,
          avatarUrl: info.avatarUrl || '',
          connectedAt: joinedAt,
          ip: info.ip || '',
          lock: lock
            ? { planId: lock.planId, clientName: lock.clientName, siteName: lock.siteName, planName: lock.planName }
            : null
        });
      } else {
        if (joinedAt && (!existing.connectedAt || joinedAt < existing.connectedAt)) existing.connectedAt = joinedAt;
        if (lock && !existing.lock) {
          existing.lock = { planId: lock.planId, clientName: lock.clientName, siteName: lock.siteName, planName: lock.planName };
        }
      }
    }
  }
  return Array.from(users.values());
};

const computeGlobalPresence = () => {
  const state = readState();
  const planPathMap = buildPlanPathMap(state.clients || []);
  const locksByUser = new Map();
  for (const [lockPlanId, lock] of planLocks.entries()) {
    if (!lock?.userId) continue;
    const path = planPathMap.get(lockPlanId);
    const entry = {
      planId: lockPlanId,
      clientName: path?.clientName || '',
      siteName: path?.siteName || '',
      planName: path?.planName || ''
    };
    const existing = locksByUser.get(lock.userId);
    if (!existing) {
      locksByUser.set(lock.userId, [entry]);
    } else {
      existing.push(entry);
    }
  }
  const usersById = new Map();
  for (const info of wsClientInfo.values()) {
    const entry = usersById.get(info.userId);
    const lockList = locksByUser.get(info.userId) || [];
    if (!entry) {
      usersById.set(info.userId, {
        userId: info.userId,
        username: info.username,
        avatarUrl: info.avatarUrl || '',
        connectedAt: info.connectedAt || null,
        ip: info.ip || '',
        locks: lockList
      });
    } else {
      if (info.connectedAt && (!entry.connectedAt || info.connectedAt < entry.connectedAt)) entry.connectedAt = info.connectedAt;
      if (!entry.ip && info.ip) entry.ip = info.ip;
      if (lockList.length && (!entry.locks || !entry.locks.length)) entry.locks = lockList;
    }
  }
  return Array.from(usersById.values());
};

const getLockedPlansSnapshot = () => {
  const out = {};
  const state = readState();
  const planPathMap = buildPlanPathMap(state.clients || []);
  for (const [planId, lock] of planLocks.entries()) {
    if (!lock?.userId) continue;
    const path = planPathMap.get(planId);
    out[planId] = {
      kind: 'lock',
      userId: lock.userId,
      username: lock.username,
      avatarUrl: lock.avatarUrl || '',
      lastActionAt: lock.lastActionAt || null,
      lastSavedAt: path?.lastSavedAt ?? null,
      lastSavedRev: path?.lastSavedRev ?? ''
    };
  }
  for (const [planId, grant] of planLockGrants.entries()) {
    if (!grant?.userId) continue;
    if (grant.expiresAt && grant.expiresAt <= Date.now()) continue;
    // Only show grants when the plan isn't currently locked.
    const lock = planLocks.get(planId);
    if (lock?.userId) continue;
    const path = planPathMap.get(planId);
    out[planId] = {
      kind: 'grant',
      userId: grant.userId,
      username: grant.username,
      avatarUrl: grant.avatarUrl || '',
      grantedAt: grant.grantedAt || null,
      expiresAt: grant.expiresAt || null,
      minutes: grant.minutes || null,
      grantedBy: { userId: grant.grantedById || '', username: grant.grantedByName || '' },
      lastActionAt: grant.lastActionAt || null,
      lastSavedAt: path?.lastSavedAt ?? null,
      lastSavedRev: path?.lastSavedRev ?? ''
    };
  }
  return out;
};

const emitGlobalPresence = () => {
  broadcastToAll({
    type: 'global_presence',
    users: computeGlobalPresence(),
    lockedPlans: getLockedPlansSnapshot()
  });
};

const emitPresence = (planId) => {
  broadcastToPlan(planId, { type: 'presence', planId, users: computePresence(planId) });
};

const emitLockState = (planId) => {
  const lock = getValidLock(planId) || null;
  const grant = getValidGrant(planId) || null;
  const state = readState();
  const planPathMap = buildPlanPathMap(state.clients || []);
  const path = planPathMap.get(planId);
  broadcastToPlan(planId, {
    type: 'lock_state',
    planId,
    lockedBy: lock ? { userId: lock.userId, username: lock.username, avatarUrl: lock.avatarUrl || '' } : null,
    grant: grant
      ? {
          userId: grant.userId,
          username: grant.username,
          avatarUrl: grant.avatarUrl || '',
          grantedAt: grant.grantedAt || null,
          expiresAt: grant.expiresAt || null,
          minutes: grant.minutes || null,
          grantedBy: { userId: grant.grantedById || '', username: grant.grantedByName || '' }
        }
      : null,
    meta: {
      lastActionAt: lock?.lastActionAt || grant?.lastActionAt || null,
      lastSavedAt: path?.lastSavedAt ?? null,
      lastSavedRev: path?.lastSavedRev ?? ''
    }
  });
  emitPresence(planId);
  emitGlobalPresence();
};

const releaseLocksForWs = (ws) => {
  const info = wsClientInfo.get(ws);
  if (!info) return;
  const userId = info.userId;
  for (const planId of info.plans.keys()) {
    const members = wsPlanMembers.get(planId);
    if (members) {
      members.delete(ws);
      if (!members.size) wsPlanMembers.delete(planId);
    }
	    const lock = planLocks.get(planId);
	    if (lock && lock.userId === info.userId) {
	      const lastActionAt = lock.lastActionAt || lock.ts || null;
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
	        const completed = completeForceUnlockAsAutoDiscard(planId, info.userId, lastActionAt, 'ws_close');
	        if (!completed) emitLockState(planId);
	      }
	    }
    emitPresence(planId);
  }
  wsClientInfo.delete(ws);
  // Update "last online" only when the user has no more active sockets.
  let stillConnected = false;
  for (const other of wsClientInfo.values()) {
    if (other?.userId === userId) {
      stillConnected = true;
      break;
    }
  }
  if (!stillConnected) {
    try {
      db.prepare('UPDATE users SET lastOnlineAt = ? WHERE id = ?').run(Date.now(), userId);
    } catch {}
  }
};

const parseDataUrl = (value) => {
  if (typeof value !== 'string') return null;
  // Allow optional data URL parameters like `data:audio/webm;codecs=opus;base64,...`
  const m = /^data:([^;]+)(?:;[^,]+)*;base64,(.*)$/.exec(value);
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
  const raw = Number(readEnv('PLIXMAP_UPLOAD_MAX_IMAGE_MB') || '');
  return Number.isFinite(raw) && raw > 0 ? raw * 1024 * 1024 : 12 * 1024 * 1024;
})();
const MAX_PDF_BYTES = (() => {
  const raw = Number(readEnv('PLIXMAP_UPLOAD_MAX_PDF_MB') || '');
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

const buildClientScopeMaps = (clients) => {
  const siteToClient = new Map();
  const planToClient = new Map();
  const clientIds = new Set();
  for (const c of clients || []) {
    if (!c?.id) continue;
    clientIds.add(c.id);
    for (const s of c?.sites || []) {
      if (s?.id) siteToClient.set(s.id, c.id);
      for (const p of s?.floorPlans || []) {
        if (p?.id) planToClient.set(p.id, c.id);
      }
    }
  }
  return { siteToClient, planToClient, clientIds };
};

let cachedClientScopeMaps = { updatedAt: null, siteToClient: new Map(), planToClient: new Map(), clientIds: new Set() };
const getClientScopeMaps = () => {
  const state = readState();
  if (cachedClientScopeMaps.updatedAt !== state.updatedAt) {
    cachedClientScopeMaps = { updatedAt: state.updatedAt, ...buildClientScopeMaps(state.clients || []) };
  }
  return cachedClientScopeMaps;
};

const CHAT_CACHE_TTL_MS = 4000;
const chatClientIdsCacheByUser = new Map(); // userId -> { ts, set }

const getChatClientIdsForUser = (userId, isAdmin) => {
  const maps = getClientScopeMaps();
  if (isAdmin) return new Set(maps.clientIds);
  const now = Date.now();
  const cached = chatClientIdsCacheByUser.get(userId);
  if (cached && now - cached.ts < CHAT_CACHE_TTL_MS) return cached.set;
  const rows = db
    .prepare('SELECT scopeType, scopeId FROM permissions WHERE userId = ? AND chat = 1')
    .all(userId);
  const out = new Set();
  for (const r of rows || []) {
    if (r.scopeType === 'client') {
      if (maps.clientIds.has(r.scopeId)) out.add(r.scopeId);
      continue;
    }
    if (r.scopeType === 'site') {
      const clientId = maps.siteToClient.get(r.scopeId);
      if (clientId) out.add(clientId);
      continue;
    }
    if (r.scopeType === 'plan') {
      const clientId = maps.planToClient.get(r.scopeId);
      if (clientId) out.add(clientId);
      continue;
    }
  }
  chatClientIdsCacheByUser.set(userId, { ts: now, set: out });
  return out;
};

const userCanChatClient = (userId, isAdmin, clientId) => {
  if (!userId || !clientId) return false;
  const maps = getClientScopeMaps();
  if (!maps.clientIds.has(clientId)) return false;
  if (isAdmin) return true;
  const allowed = getChatClientIdsForUser(userId, false);
  return allowed.has(clientId);
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
  const token = cookies[PRIMARY_SESSION_COOKIE];
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
  '/public-uploads',
  express.static(uploadsDir, {
    maxAge: '365d',
    immutable: true
  })
);
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
  const token = cookies[PRIMARY_SESSION_COOKIE];
  const session = verifySession(authSecret, token);
  if (!session?.userId || !session?.tokenVersion || !session?.sid) return null;
  if (session.sid !== serverInstanceId) return null;
  const row = db.prepare('SELECT id, username, isAdmin, isSuperAdmin, disabled, avatarUrl FROM users WHERE id = ?').get(session.userId);
  if (!row) return null;
  if (Number(row.disabled) === 1) return null;
  const normalizedUsername = String(row.username || '').toLowerCase();
  const isSuperAdmin = !!row.isSuperAdmin && normalizedUsername === 'superadmin';
  return {
    userId: row.id,
    username: normalizedUsername,
    isAdmin: !!row.isAdmin,
    isSuperAdmin,
    avatarUrl: String(row.avatarUrl || '')
  };
};

const getWsClientIp = (req) =>
  normalizeIp(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.connection?.remoteAddress || '');

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
  const session = verifySession(authSecret, cookies[PRIMARY_SESSION_COOKIE]);
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

app.get('/api/update/latest', requireAuth, rateByUser('update_check', 60 * 1000, 30), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const checkedAt = Date.now();
  const manifestUrls = [UPDATE_MANIFEST_URL, UPDATE_MANIFEST_FALLBACK_URL].filter((url, idx, list) => !!url && list.indexOf(url) === idx);
  const basePayload = {
    ok: false,
    currentVersion: APP_VERSION,
    latestVersion: null,
    minSupportedVersion: null,
    updateAvailable: false,
    unsupported: false,
    mandatory: false,
    downloadUrl: null,
    releaseNotesUrl: null,
    publishedAt: null,
    checkedAt
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
  try {
    let chosenPayload = null;
    let chosenSource = '';
    let lastError = '';
    for (const manifestUrl of manifestUrls) {
      try {
        const response = await fetch(manifestUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
        if (!response.ok) {
          lastError = `Manifest not reachable (${response.status}) from ${manifestUrl}`;
          continue;
        }
        const payload = await response.json();
        const latestVersion = normalizeSemver(payload?.latestVersion);
        if (!latestVersion) {
          lastError = `Manifest missing valid latestVersion at ${manifestUrl}`;
          continue;
        }
        chosenPayload = payload;
        chosenSource = manifestUrl;
        break;
      } catch (error) {
        lastError = `Manifest request failed for ${manifestUrl}: ${error?.message || 'unknown_error'}`;
      }
    }
    if (!chosenPayload) {
      res.json({ ...basePayload, error: lastError || 'Manifest not reachable' });
      return;
    }
    const latestVersion = normalizeSemver(chosenPayload?.latestVersion);
    const minSupportedVersion = normalizeSemver(chosenPayload?.minSupportedVersion);
    const currentVersion = normalizeSemver(APP_VERSION) || APP_VERSION;
    const updateAvailable = !!latestVersion && compareSemver(latestVersion, currentVersion) > 0;
    const unsupported = !!(minSupportedVersion && compareSemver(currentVersion, minSupportedVersion) < 0);
    const publishedAt =
      typeof chosenPayload?.publishedAt === 'string' && !Number.isNaN(Date.parse(chosenPayload.publishedAt))
        ? new Date(chosenPayload.publishedAt).toISOString()
        : null;
    res.json({
      ok: true,
      currentVersion,
      latestVersion: latestVersion || null,
      minSupportedVersion: minSupportedVersion || null,
      updateAvailable,
      unsupported,
      mandatory: !!chosenPayload?.mandatory || unsupported,
      downloadUrl: normalizeHttpUrl(chosenPayload?.downloadUrl),
      releaseNotesUrl: normalizeHttpUrl(chosenPayload?.releaseNotesUrl),
      publishedAt,
      checkedAt,
      source: chosenSource
    });
  } catch (error) {
    serverLog('warn', 'update_check_failed', {
      userId: req.userId || null,
      requestId: req.requestId || null,
      error: error?.message || 'unknown_error'
    });
    res.json({ ...basePayload, error: 'Unable to check updates right now' });
  } finally {
    clearTimeout(timeout);
  }
});

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
      wsClients: Number((wss?.clients && wss.clients.size) || 0),
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
    mobile: 'mobile',
    cell: 'mobile',
    cellulare: 'mobile',
    phone: 'mobile',
    telefono: 'mobile',
    numero_cellulare: 'mobile',
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
      mobile: get('mobile'),
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

const deleteImportedExternalUserForClient = (cid, externalId) => {
  const eid = String(externalId || '').trim();
  if (!cid || !eid) return { removedUsers: 0, removedObjects: 0, updatedAt: null };
  const removedUsers = db.prepare('DELETE FROM external_users WHERE clientId = ? AND externalId = ?').run(cid, eid).changes || 0;
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
          const nextObjects = (p.objects || []).filter((o) => !(o.type === 'real_user' && o.externalClientId === cid && String(o.externalUserId || '') === eid));
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

const normalizeImportText = (value) => String(value || '').trim();

const mapImportedEmployeeForPreview = (employee) => ({
  externalId: String(employee?.externalId || ''),
  firstName: String(employee?.firstName || ''),
  lastName: String(employee?.lastName || ''),
  role: String(employee?.role || ''),
  dept1: String(employee?.dept1 || ''),
  dept2: String(employee?.dept2 || ''),
  dept3: String(employee?.dept3 || ''),
  email: String(employee?.email || ''),
  mobile: String(employee?.mobile || ''),
  ext1: String(employee?.ext1 || ''),
  ext2: String(employee?.ext2 || ''),
  ext3: String(employee?.ext3 || ''),
  isExternal: !!employee?.isExternal
});

const mapExternalUserDbRowForPreview = (row, { includeFlags = false } = {}) => ({
  externalId: String(row?.externalId || ''),
  firstName: String(row?.firstName || ''),
  lastName: String(row?.lastName || ''),
  role: String(row?.role || ''),
  dept1: String(row?.dept1 || ''),
  dept2: String(row?.dept2 || ''),
  dept3: String(row?.dept3 || ''),
  email: String(row?.email || ''),
  mobile: String(row?.mobile || ''),
  ext1: String(row?.ext1 || ''),
  ext2: String(row?.ext2 || ''),
  ext3: String(row?.ext3 || ''),
  isExternal: Number(row?.isExternal || 0) === 1,
  ...(includeFlags
    ? {
        hidden: Number(row?.hidden || 0) === 1,
        present: Number(row?.present || 0) === 1,
        updatedAt: row?.updatedAt || null
      }
    : {})
});

const importedUserChangedAgainstRemote = (previous, remoteUser) => {
  if (!previous || !remoteUser) return true;
  return (
    normalizeImportText(previous.firstName) !== normalizeImportText(remoteUser.firstName) ||
    normalizeImportText(previous.lastName) !== normalizeImportText(remoteUser.lastName) ||
    normalizeImportText(previous.role) !== normalizeImportText(remoteUser.role) ||
    normalizeImportText(previous.dept1) !== normalizeImportText(remoteUser.dept1) ||
    normalizeImportText(previous.dept2) !== normalizeImportText(remoteUser.dept2) ||
    normalizeImportText(previous.dept3) !== normalizeImportText(remoteUser.dept3) ||
    normalizeImportText(previous.email) !== normalizeImportText(remoteUser.email) ||
    normalizeImportText(previous.mobile) !== normalizeImportText(remoteUser.mobile) ||
    normalizeImportText(previous.ext1) !== normalizeImportText(remoteUser.ext1) ||
    normalizeImportText(previous.ext2) !== normalizeImportText(remoteUser.ext2) ||
    normalizeImportText(previous.ext3) !== normalizeImportText(remoteUser.ext3) ||
    Number(previous.isExternal || 0) !== (remoteUser.isExternal ? 1 : 0) ||
    Number(previous.present || 1) !== 1
  );
};

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
  const remote = (result.employees || []).map(mapImportedEmployeeForPreview);
  const existing = db
    .prepare(
      'SELECT externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, present FROM external_users WHERE clientId = ?'
    )
    .all(cid)
    .map((row) => mapExternalUserDbRowForPreview(row, { includeFlags: true }));
  const byId = new Map(existing.map((r) => [String(r.externalId), r]));
  const remoteIds = new Set(remote.map((e) => String(e.externalId)));
  let newCount = 0;
  let updatedCount = 0;
  let missingCount = 0;
  const missingSample = [];
  const newSample = [];

  for (const e of remote) {
    const id = String(e.externalId);
    const prev = byId.get(id);
    if (!prev) {
      newCount += 1;
      if (newSample.length < 10) newSample.push({ externalId: id, firstName: e.firstName || '', lastName: e.lastName || '' });
      continue;
    }
    const changed = importedUserChangedAgainstRemote(prev, e);
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

app.post('/api/import/preview', requireAuth, rateByUser('import_preview', 60 * 1000, 10), async (req, res) => {
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
    res.status(400).json({
      ok: false,
      status: result.status,
      error: result.error || 'Request failed',
      contentType: result.contentType || '',
      rawSnippet: result.rawSnippet || ''
    });
    return;
  }
  const remote = (result.employees || []).map(mapImportedEmployeeForPreview);
  const existing = db
    .prepare(
      'SELECT externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, updatedAt FROM external_users WHERE clientId = ? ORDER BY lastName COLLATE NOCASE, firstName COLLATE NOCASE'
    )
    .all(cid)
    .map((row) => mapExternalUserDbRowForPreview(row, { includeFlags: true }));
  const existingById = new Map(existing.map((r) => [String(r.externalId), r]));
  const remoteRows = remote.map((e) => {
    const prev = existingById.get(String(e.externalId));
    if (!prev) return { ...e, importStatus: 'new' };
    const changed = importedUserChangedAgainstRemote(prev, e);
    return { ...e, importStatus: changed ? 'update' : 'existing' };
  });
  res.json({
    ok: true,
    clientId: cid,
    remoteCount: remoteRows.length,
    existingCount: existing.length,
    remoteRows,
    existingRows: existing
  });
});

app.post('/api/import/import-one', requireAuth, rateByUser('import_one', 60 * 1000, 30), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  const externalId = String(req.body?.externalId || '').trim();
  if (!cid || !externalId) {
    res.status(400).json({ error: 'Missing clientId/externalId' });
    return;
  }
  let employee = null;
  const candidate = req.body?.user && typeof req.body.user === 'object' ? req.body.user : null;
  if (candidate && String(candidate.externalId || '').trim() === externalId) {
    employee = mapImportedEmployeeForPreview({ ...candidate, externalId });
  }
  if (!employee) {
    const cfg = getImportConfig(db, dataSecret, cid);
    if (!cfg || !cfg.url || !cfg.username) {
      res.status(400).json({ error: 'Missing import config (url/username)' });
      return;
    }
    const result = await fetchEmployeesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
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
    employee = (result.employees || []).find((e) => String(e.externalId) === externalId);
  }
  if (!employee) {
    res.status(404).json({ error: 'Remote user not found' });
    return;
  }
  const sync = upsertExternalUsers(db, cid, [employee], { markMissing: false });
  writeAuditLog(db, {
    level: 'important',
    event: 'import_one',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: { externalId, created: sync.summary?.created || 0, updated: sync.summary?.updated || 0 }
  });
  res.json({ ok: true, externalId, summary: sync.summary, created: sync.created || [], updated: sync.updated || [] });
});

app.post('/api/import/delete-one', requireAuth, rateByUser('import_delete_one', 60 * 1000, 30), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  const externalId = String(req.body?.externalId || '').trim();
  if (!cid || !externalId) {
    res.status(400).json({ error: 'Missing clientId/externalId' });
    return;
  }
  const cleanup = deleteImportedExternalUserForClient(cid, externalId);
  writeAuditLog(db, {
    level: 'important',
    event: 'import_delete_one',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: { externalId, removedUsers: cleanup.removedUsers, removedObjects: cleanup.removedObjects }
  });
  res.json({ ok: true, externalId, ...cleanup });
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
    const filtered = filterStateForUser(serverState.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
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

app.post('/api/external-users/manual', requireAuth, rateByUser('external_user_manual_create', 60 * 1000, 30), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, user } = req.body || {};
  const cid = String(clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  try {
    const row = upsertManualExternalUser(db, cid, user || {});
    writeAuditLog(db, {
      level: 'important',
      event: 'external_user_manual_create',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { externalId: row?.externalId, name: `${row?.firstName || ''} ${row?.lastName || ''}`.trim() }
    });
    res.json({ ok: true, row });
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      res.status(400).json({ error: err.message || 'Invalid payload' });
      return;
    }
    if (String(err?.message || '').toLowerCase().includes('unique')) {
      res.status(409).json({ error: 'Duplicate externalId for client' });
      return;
    }
    res.status(500).json({ error: 'Unable to create manual user' });
  }
});

app.put('/api/external-users/manual', requireAuth, rateByUser('external_user_manual_update', 60 * 1000, 60), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, externalId, user } = req.body || {};
  const cid = String(clientId || '').trim();
  const eid = String(externalId || '').trim();
  if (!cid || !eid) {
    res.status(400).json({ error: 'Missing clientId/externalId' });
    return;
  }
  if (!isManualExternalId(eid)) {
    res.status(400).json({ error: 'Only manual users can be updated' });
    return;
  }
  try {
    const row = upsertManualExternalUser(db, cid, { ...(user || {}), externalId: eid }, { externalId: eid });
    writeAuditLog(db, {
      level: 'important',
      event: 'external_user_manual_update',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { externalId: eid }
    });
    res.json({ ok: true, row });
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      res.status(400).json({ error: err.message || 'Invalid payload' });
      return;
    }
    if (err?.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (String(err?.message || '').toLowerCase().includes('unique')) {
      res.status(409).json({ error: 'Duplicate externalId for client' });
      return;
    }
    res.status(500).json({ error: 'Unable to update manual user' });
  }
});

app.delete('/api/external-users/manual', requireAuth, rateByUser('external_user_manual_delete', 60 * 1000, 60), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, externalId } = req.body || {};
  const cid = String(clientId || '').trim();
  const eid = String(externalId || '').trim();
  if (!cid || !eid) {
    res.status(400).json({ error: 'Missing clientId/externalId' });
    return;
  }
  if (!isManualExternalId(eid)) {
    res.status(400).json({ error: 'Only manual users can be deleted' });
    return;
  }
  try {
    const existing = getExternalUser(db, cid, eid);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const result = deleteManualExternalUser(db, cid, eid);
    writeAuditLog(db, {
      level: 'important',
      event: 'external_user_manual_delete',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { externalId: eid }
    });
    res.json({ ok: true, removed: result.removed || 0 });
  } catch {
    res.status(500).json({ error: 'Unable to delete manual user' });
  }
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

app.get('/api/clients/:clientId/email-settings', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  res.json({ config: getClientEmailConfigSafe(db, clientId) });
});

app.get('/api/clients/email-settings-summary', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const state = readState();
  const clients = Array.isArray(state?.clients) ? state.clients : [];
  const byClientId = {};
  for (const client of clients) {
    const cid = String(client?.id || '').trim();
    if (!cid) continue;
    const cfg = getClientEmailConfigSafe(db, cid);
    byClientId[cid] = !!(cfg && String(cfg.host || '').trim());
  }
  res.json({ byClientId });
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

app.put('/api/clients/:clientId/email-settings', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const payload = req.body || {};
  const updated = upsertClientEmailConfig(db, dataSecret, clientId, {
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
    event: 'client_email_settings_update',
    userId: req.userId,
    username: req.username,
    scopeType: 'client',
    scopeId: clientId,
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
      text: `This is a test email from ${APP_BRAND}.`
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

app.post('/api/clients/:clientId/email-settings/test', requireAuth, rateByUser('client_email_test', 5 * 60 * 1000, 10), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const clientId = String(req.params.clientId || '').trim();
  const recipient = String(req.body?.recipient || '').trim();
  const subjectInput = String(req.body?.subject || '').trim();
  if (!clientId || !recipient) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }
  const state = readState();
  const clientName =
    (state.clients || []).find((c) => String(c?.id || '') === clientId)?.shortName ||
    (state.clients || []).find((c) => String(c?.id || '') === clientId)?.name ||
    clientId;
  const config = getClientEmailConfig(db, dataSecret, clientId);
  if (!config || !config.host) return res.status(400).json({ error: `SMTP non configurato per il cliente ${clientName}.` });
  if (config.username && !config.password) return res.status(400).json({ error: `SMTP non completato per il cliente ${clientName} (password mancante).` });
  const fromEmail = config.fromEmail || config.username;
  if (!fromEmail) return res.status(400).json({ error: `SMTP non completato per il cliente ${clientName} (mittente mancante).` });
  const subject = subjectInput || 'Client SMTP Test Email';
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
    const info = await transport.sendMail({ from: fromLabel, to: recipient, subject, text: `This is a client-scoped SMTP test email from ${APP_BRAND}.` });
    logEmailAttempt(db, {
      userId: req.userId,
      username: req.username,
      recipient,
      subject,
      success: true,
      details: { kind: 'client_email_test', clientId, messageId: info?.messageId || null }
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
      details: { kind: 'client_email_test', clientId }
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
  const scopeType = String(req.query.scopeType || '').trim().toLowerCase();
  const scopeId = String(req.query.scopeId || '').trim();
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
  if (scopeType) {
    where.push('LOWER(COALESCE(scopeType, \'\')) = @scopeType');
    params.scopeType = scopeType;
  }
  if (scopeId) {
    where.push('COALESCE(scopeId, \'\') = @scopeId');
    params.scopeId = scopeId;
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
  const { language, defaultPlanId, clientOrder, paletteFavorites, visibleLayerIdsByPlan, avatarUrl, chatLayout } = req.body || {};
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
  const nextAvatarUrl = (() => {
    if (avatarUrl === null) return '';
    if (typeof avatarUrl !== 'string') return undefined;
    const s = String(avatarUrl || '').trim();
    if (!s) return '';
    if (s.startsWith('data:')) {
      const v = validateDataUrl(s);
      if (!v.ok) return { error: 'Invalid avatar upload', reason: v.reason };
      const url = externalizeDataUrl(s);
      if (!url) return { error: 'Invalid avatar upload' };
      return url;
    }
    if (s.startsWith('/uploads/')) return s;
    return { error: 'Invalid avatarUrl' };
  })();
  const nextChatLayout = (() => {
    if (chatLayout === null) return {};
    if (!chatLayout || typeof chatLayout !== 'object' || Array.isArray(chatLayout)) return undefined;
    // Keep it permissive (forward compatible), but prevent huge payloads.
    const keys = Object.keys(chatLayout);
    if (keys.length > 50) return undefined;
    try {
      const json = JSON.stringify(chatLayout);
      if (json.length > 6000) return undefined;
      return chatLayout;
    } catch {
      return undefined;
    }
  })();

  if (
    nextLanguage === undefined &&
    nextDefaultPlanId === undefined &&
    nextClientOrder === undefined &&
    nextPaletteFavorites === undefined &&
    nextVisibleLayerIdsByPlan === undefined &&
    nextAvatarUrl === undefined &&
    nextChatLayout === undefined
  ) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  if (nextAvatarUrl && typeof nextAvatarUrl === 'object') {
    res.status(400).json({ error: nextAvatarUrl.error || 'Invalid avatar upload' });
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
  if (nextAvatarUrl !== undefined) {
    sets.push('avatarUrl = ?');
    params.push(String(nextAvatarUrl || ''));
  }
  if (nextChatLayout !== undefined) {
    sets.push('chatLayoutJson = ?');
    params.push(JSON.stringify(nextChatLayout || {}));
  }
  sets.push('updatedAt = ?');
  params.push(now);
  params.push(req.userId);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  // Keep realtime presence/locks in sync (avatar is cached in wsClientInfo + planLocks).
  if (nextAvatarUrl !== undefined) {
    for (const [ws, info] of wsClientInfo.entries()) {
      if (info?.userId !== req.userId) continue;
      info.avatarUrl = String(nextAvatarUrl || '');
    }
    for (const [planId, lock] of planLocks.entries()) {
      if (lock?.userId !== req.userId) continue;
      lock.avatarUrl = String(nextAvatarUrl || '');
      planLocks.set(planId, lock);
      emitLockState(planId);
    }
    emitGlobalPresence();
  }
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
  const filtered = filterStateForUser(state.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
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
  purgeExpiredLocks();
  for (const [planId, lock] of planLocks.entries()) {
    if (!lock) continue;
    if (lock.userId && lock.userId !== req.userId) lockedByOthers.add(planId);
  }
  for (const [planId, grant] of planLockGrants.entries()) {
    if (!grant) continue;
    if (grant.expiresAt && grant.expiresAt <= Date.now()) continue;
    const lock = planLocks.get(planId);
    if (lock?.userId) continue;
    if (grant.userId && grant.userId !== req.userId) lockedByOthers.add(planId);
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
  const filtered = filterStateForUser(payload.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
  res.json({ ok: true, updatedAt, clients: filtered, objectTypes: payload.objectTypes });
});

const MEETING_ACTIVE_STATUSES = new Set(['pending', 'approved']);
const ROOM_PEOPLE_TYPE_IDS = new Set(['user', 'real_user']);
const ROOM_EQUIPMENT_LABELS = {
  tv: 'TV',
  desktop: 'PC',
  laptop: 'Laptop',
  tablet: 'Tablet',
  camera: 'Camera',
  mic: 'Microphone',
  phone: 'Phone',
  videoIntercom: 'Video intercom',
  intercom: 'Intercom',
  wifi: 'Wi-Fi',
  scanner: 'Scanner',
  printer: 'Printer'
};
const ROOM_MEETING_FEATURE_LABELS = {
  meetingProjector: 'Projector',
  meetingTv: 'TV',
  meetingVideoConf: 'Autonomous video conference',
  meetingCoffeeService: 'Coffee service',
  meetingWhiteboard: 'Whiteboard',
  wifiAvailable: 'Guest Wifi',
  fridgeAvailable: 'Fridge'
};

const safeJsonParse = (raw, fallback) => {
  try {
    const parsed = JSON.parse(String(raw || ''));
    return parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const parseIsoDay = (value) => {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day, value: `${m[1]}-${m[2]}-${m[3]}` };
};

const parseClockTime = (value) => {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes, value: `${m[1]}:${m[2]}` };
};

const toLocalTs = (day, time) => new Date(day.year, day.month - 1, day.day, time.hours, time.minutes, 0, 0).getTime();

const dayRangeFromIso = (value) => {
  const day = parseIsoDay(value);
  if (!day) return null;
  const start = new Date(day.year, day.month - 1, day.day, 0, 0, 0, 0).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { day: day.value, start, end };
};

const clampMeetingBuffer = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(60, Math.floor(parsed)));
};

const getVisibleClientsForMeetings = (req, state) => {
  if (req.isAdmin || req.isSuperAdmin) return state.clients || [];
  const ctx = getUserWithPermissions(db, req.userId);
  const access = computePlanAccess(state.clients || [], ctx?.permissions || []);
  return filterStateForUser(state.clients || [], access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
};

const listMeetingRoomsFromClients = (clients, filters = {}) => {
  const out = [];
  const clientIdFilter = String(filters.clientId || '').trim();
  const siteIdFilter = String(filters.siteId || '').trim();
  const planIdFilter = String(filters.floorPlanId || '').trim();
  const includeNonMeeting = !!filters.includeNonMeeting;
  for (const client of clients || []) {
    if (!client?.id) continue;
    if (clientIdFilter && String(client.id) !== clientIdFilter) continue;
    for (const site of client.sites || []) {
      if (!site?.id) continue;
      if (siteIdFilter && String(site.id) !== siteIdFilter) continue;
      for (const plan of site.floorPlans || []) {
        if (!plan?.id) continue;
        if (planIdFilter && String(plan.id) !== planIdFilter) continue;
        for (const room of plan.rooms || []) {
          if (!room?.id) continue;
          const isMeetingRoom = !!room.meetingRoom;
          if (!isMeetingRoom && !includeNonMeeting) continue;
          // Legacy/inconsistent data may keep special-room flags enabled together with meetingRoom.
          // When a room is explicitly a meeting room, keep it visible in meeting management.
          if (!isMeetingRoom && (room.storageRoom || room.bathroom || room.technicalRoom)) continue;
          const rawCapacity = Number(room.capacity);
          const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
          const roomId = String(room.id);
          const equipmentSet = new Set();
          for (const [featureKey, featureLabel] of Object.entries(ROOM_MEETING_FEATURE_LABELS)) {
            if ((room || {})[featureKey]) equipmentSet.add(featureLabel);
          }
          let currentPeople = 0;
          for (const obj of plan.objects || []) {
            if (String(obj?.roomId || '') !== roomId) continue;
            const typeId = String(obj?.type || '').trim();
            if (ROOM_PEOPLE_TYPE_IDS.has(typeId)) currentPeople += 1;
            const label = ROOM_EQUIPMENT_LABELS[typeId];
            if (label) equipmentSet.add(label);
          }
          out.push({
            clientId: String(client.id),
            clientName: String(client.shortName || client.name || ''),
            clientLogoUrl: String(client.logoUrl || '').trim() || null,
            businessPartners: Array.isArray(client.businessPartners)
              ? client.businessPartners
                  .map((bp) => ({
                    id: String(bp?.id || ''),
                    name: String(bp?.name || '').trim(),
                    logoUrl: String(bp?.logoUrl || '').trim() || null
                  }))
                  .filter((bp) => bp.name)
              : [],
            siteId: String(site.id),
            siteName: String(site.name || ''),
            siteSupportContacts: site.supportContacts || null,
            floorPlanId: String(plan.id),
            floorPlanName: String(plan.name || ''),
            roomId,
            roomName: String(room.name || ''),
            isMeetingRoom,
            capacity,
            currentPeople,
            availableSeats: Math.max(0, capacity - currentPeople),
            equipment: Array.from(equipmentSet).sort((a, b) => a.localeCompare(b)),
            surfaceSqm: Number.isFinite(Number(room?.surfaceSqm)) ? Number(room.surfaceSqm) : null,
            shape:
              String(room?.kind || '') === 'poly' && Array.isArray(room?.points) && room.points.length >= 3
                ? {
                    kind: 'poly',
                    points: room.points
                      .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
                      .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
                  }
                : {
                    kind: 'rect',
                    x: Number(room?.x || 0),
                    y: Number(room?.y || 0),
                    width: Number(room?.width || 0),
                    height: Number(room?.height || 0)
                  }
          });
        }
      }
    }
  }
  return out;
};

const mapMeetingRow = (row) => {
  if (!row) return null;
  return {
    id: String(row.id),
    status: String(row.status || 'pending'),
    approvalRequired: Number(row.approvalRequired) === 1,
    clientId: String(row.clientId || ''),
    siteId: String(row.siteId || ''),
    floorPlanId: String(row.floorPlanId || ''),
    roomId: String(row.roomId || ''),
    roomName: String(row.roomName || ''),
    subject: String(row.subject || ''),
    requestedSeats: Number(row.requestedSeats) || 0,
    roomCapacity: Number(row.roomCapacity) || 0,
    equipment: safeJsonParse(row.equipmentJson || '[]', []),
    participants: safeJsonParse(row.participantsJson || '[]', []),
    externalGuests: Number(row.externalGuests) === 1,
    externalGuestsList: safeJsonParse(row.externalGuestsJson || '[]', []),
    externalGuestsDetails: safeJsonParse(row.externalGuestsDetailsJson || '[]', []),
    sendEmail: Number(row.sendEmail) === 1,
    technicalSetup: Number(row.technicalSetup) === 1,
    technicalEmail: String(row.technicalEmail || ''),
    notes: String(row.notes || ''),
    videoConferenceLink: String(row.videoConferenceLink || ''),
    setupBufferBeforeMin: Number(row.setupBufferBeforeMin) || 0,
    setupBufferAfterMin: Number(row.setupBufferAfterMin) || 0,
    startAt: Number(row.startAt) || 0,
    endAt: Number(row.endAt) || 0,
    effectiveStartAt: Number(row.effectiveStartAt) || 0,
    effectiveEndAt: Number(row.effectiveEndAt) || 0,
    multiDayGroupId: row.multiDayGroupId ? String(row.multiDayGroupId) : null,
    occurrenceDate: String(row.occurrenceDate || ''),
    requestedById: String(row.requestedById || ''),
    requestedByUsername: String(row.requestedByUsername || ''),
    requestedByEmail: String(row.requestedByEmail || ''),
    requestedAt: Number(row.requestedAt) || 0,
    reviewedAt: row.reviewedAt ? Number(row.reviewedAt) : null,
    reviewedById: row.reviewedById ? String(row.reviewedById) : null,
    reviewedByUsername: row.reviewedByUsername ? String(row.reviewedByUsername) : null,
    rejectReason: row.rejectReason ? String(row.rejectReason) : null,
    createdAt: Number(row.createdAt) || 0,
    updatedAt: Number(row.updatedAt) || 0
  };
};

const getMeetingConflicts = (roomId, effectiveStartAt, effectiveEndAt, excludeBookingId) => {
  const rid = String(roomId || '').trim();
  if (!rid) return [];
  const start = Number(effectiveStartAt);
  const end = Number(effectiveEndAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const rows = excludeBookingId
    ? db
        .prepare(
          `SELECT * FROM meeting_bookings
           WHERE roomId = ?
             AND status IN ('pending','approved')
             AND id <> ?
             AND effectiveStartAt < ?
             AND effectiveEndAt > ?
           ORDER BY startAt ASC`
        )
        .all(rid, String(excludeBookingId), end, start)
    : db
        .prepare(
          `SELECT * FROM meeting_bookings
           WHERE roomId = ?
             AND status IN ('pending','approved')
             AND effectiveStartAt < ?
             AND effectiveEndAt > ?
           ORDER BY startAt ASC`
        )
        .all(rid, end, start);
  return rows.map(mapMeetingRow).filter(Boolean);
};

const writeMeetingAuditLog = (bookingId, event, actorUserId, actorUsername, details) => {
  const id = String(bookingId || '').trim();
  const evt = String(event || '').trim();
  if (!id || !evt) return;
  let json = '{}';
  try {
    json = JSON.stringify(details || {});
  } catch {
    json = '{}';
  }
  db.prepare(
    `INSERT INTO meeting_audit_log (bookingId, event, actorUserId, actorUsername, detailsJson, ts)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, evt, actorUserId ? String(actorUserId) : null, actorUsername ? String(actorUsername) : null, json, Date.now());
};

const listActiveAdmins = () =>
  db
    .prepare(
      `SELECT id, username, email
       FROM users
       WHERE disabled = 0
         AND (isAdmin = 1 OR isSuperAdmin = 1)`
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      username: String(row.username || '').toLowerCase(),
      email: String(row.email || '')
    }));

const isUserOnline = (userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return false;
  for (const info of wsClientInfo.values()) {
    if (String(info?.userId || '') === uid) return true;
  }
  return false;
};

const pushMeetingDm = (fromUserId, toUserId, text) => {
  const fromId = String(fromUserId || '').trim();
  const toId = String(toUserId || '').trim();
  const body = String(text || '').trim();
  if (!fromId || !toId || !body) return null;
  const fromUser = db.prepare('SELECT id, username, avatarUrl, disabled FROM users WHERE id = ?').get(fromId);
  const toUser = db.prepare('SELECT id, disabled FROM users WHERE id = ?').get(toId);
  if (!fromUser || !toUser) return null;
  if (Number(fromUser.disabled) === 1 || Number(toUser.disabled) === 1) return null;
  if (userHasBlocked(toId, fromId) || userHasBlocked(fromId, toId)) return null;
  const [a, b] = fromId < toId ? [fromId, toId] : [toId, fromId];
  const pairKey = `${a}:${b}`;
  const threadId = `dm:${pairKey}`;
  const now = Date.now();
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
  const deliveredAt = isUserOnline(toId) ? now : null;
  db.prepare(
    `INSERT INTO dm_chat_messages (id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deliveredAt, readAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, NULL, '[]', '[]', '{}', ?, 0, ?, NULL, ?, ?)`
  ).run(id, pairKey, fromId, toId, String(fromUser.username || '').toLowerCase(), String(fromUser.avatarUrl || ''), body, deliveredAt, now, now);
  const row = db
    .prepare(
      `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
       FROM dm_chat_messages
       WHERE id = ?`
    )
    .get(id);
  const message = normalizeDmChatMessageRow(row);
  if (!message) return null;
  sendToUser(fromId, { type: 'dm_chat_new', threadId, message });
  if (deliveredAt) sendToUser(toId, { type: 'dm_chat_new', threadId, message });
  return { id, threadId, message };
};

const pendingMeetingCount = () => Number(db.prepare("SELECT COUNT(1) as c FROM meeting_bookings WHERE status = 'pending'").get()?.c || 0);

const notifyAdminsForMeetingRequest = (booking) => {
  const admins = listActiveAdmins();
  const count = pendingMeetingCount();
  for (const admin of admins) {
    if (!admin?.id) continue;
    sendToUser(admin.id, {
      type: 'meeting_request_new',
      booking,
      pendingCount: count
    });
    if (String(admin.id) === String(booking?.requestedById || '')) continue;
    pushMeetingDm(
      String(booking?.requestedById || ''),
      admin.id,
      `MEETING_REQUEST:${String(booking?.id || '')}\n${booking?.subject || 'Meeting'}\nRoom: ${booking?.roomName || booking?.roomId || '-'}\nUse meeting panel or chat actions to approve/reject.`
    );
  }
};

const broadcastMeetingPendingSummary = () => {
  const admins = listActiveAdmins();
  const count = pendingMeetingCount();
  for (const admin of admins) {
    if (!admin?.id) continue;
    sendToUser(admin.id, { type: 'meeting_pending_summary', pendingCount: count });
  }
};

const notifyMeetingReviewToRequester = (booking, action, reason) => {
  if (!booking?.requestedById) return;
  sendToUser(String(booking.requestedById), {
    type: 'meeting_request_reviewed',
    bookingId: booking.id,
    action,
    reason: reason ? String(reason) : null
  });
  if (booking.reviewedById && String(booking.reviewedById) !== String(booking.requestedById)) {
    const title = action === 'approved' ? 'approved' : 'rejected';
    const reasonPart = reason ? `\nReason: ${String(reason)}` : '';
    pushMeetingDm(
      String(booking.reviewedById),
      String(booking.requestedById),
      `[MEETING ${title.toUpperCase()}]\n${booking.subject || booking.id}${reasonPart}`
    );
  }
};

const sendMeetingMail = async ({ recipients, subject, text, actorUserId, actorUsername, details, attachments, clientId }) => {
  const list = Array.from(new Set((recipients || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)));
  if (!list.length) return { ok: false, skipped: true, reason: 'no_recipients' };
  const cid = String(clientId || '').trim();
  const state = readState();
  const clientName =
    cid && Array.isArray(state?.clients)
      ? String(
          (state.clients.find((c) => String(c?.id || '') === cid)?.shortName ||
            state.clients.find((c) => String(c?.id || '') === cid)?.name ||
            cid)
        )
      : null;
  const config = cid ? getClientEmailConfig(db, dataSecret, cid) : getEmailConfig(db, dataSecret);
  if (!config || !config.host) {
    return {
      ok: false,
      skipped: true,
      reason: cid ? 'smtp_client_not_configured' : 'smtp_not_configured',
      clientId: cid || null,
      clientName
    };
  }
  if (config.username && !config.password) {
    return {
      ok: false,
      skipped: true,
      reason: cid ? 'smtp_client_missing_password' : 'smtp_missing_password',
      clientId: cid || null,
      clientName
    };
  }
  const fromEmail = config.fromEmail || config.username;
  if (!fromEmail) return { ok: false, skipped: true, reason: 'smtp_missing_from' };
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
      to: list.join(', '),
      subject: String(subject || 'Meeting notification'),
      text: String(text || ''),
      attachments: Array.isArray(attachments) ? attachments : undefined
    });
    logEmailAttempt(db, {
      userId: actorUserId ? String(actorUserId) : null,
      username: actorUsername ? String(actorUsername) : null,
      recipient: list.join(', '),
      subject: String(subject || ''),
      success: true,
      details: {
        ...(details || {}),
        clientId: cid || null,
        messageId: info?.messageId || null,
        recipients: list.length,
        attachments: Array.isArray(attachments) ? attachments.length : 0
      }
    });
    return { ok: true, recipients: list.length, messageId: info?.messageId || null };
  } catch (error) {
    logEmailAttempt(db, {
      userId: actorUserId ? String(actorUserId) : null,
      username: actorUsername ? String(actorUsername) : null,
      recipient: list.join(', '),
      subject: String(subject || ''),
      success: false,
      error: error?.message || 'meeting_mail_failed',
      details: details || {}
    });
    return { ok: false, skipped: false, reason: error?.message || 'send_failed' };
  }
};

const resolveParticipantEmails = (clientId, participants) => {
  const cid = String(clientId || '').trim();
  const byExternalId = new Map();
  if (cid) {
    const rows = db
      .prepare(
        `SELECT externalId, firstName, lastName, email
         FROM external_users
         WHERE clientId = ?`
      )
      .all(cid);
    for (const row of rows) {
      byExternalId.set(String(row.externalId || ''), {
        fullName: `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim(),
        email: String(row.email || '').trim()
      });
    }
  }
  const normalized = [];
  const emails = [];
  const missingEmails = [];
  for (const entry of Array.isArray(participants) ? participants : []) {
    const kind = entry?.kind === 'manual' ? 'manual' : 'real_user';
    const externalId = String(entry?.externalId || '').trim();
    let fullName = String(entry?.fullName || entry?.name || '').trim();
    let email = String(entry?.email || '').trim();
    const optional = !!entry?.optional;
    const remote = !!entry?.remote;
    const company = String(entry?.company || '').trim() || null;
    if (kind === 'real_user' && externalId && byExternalId.has(externalId)) {
      const found = byExternalId.get(externalId);
      if (!fullName) fullName = String(found?.fullName || '').trim();
      if (!email) email = String(found?.email || '').trim();
    }
    const row = { kind, externalId: externalId || null, fullName, email: email || null, optional, remote, company };
    normalized.push(row);
    if (email) emails.push(email);
    else if (kind === 'real_user' || fullName) missingEmails.push(fullName || externalId || 'participant');
  }
  return { normalized, emails, missingEmails };
};

const createMeetingOccurrences = ({ startDate, endDate, startTime, endTime, maxDays = 30 }) => {
  const startDay = parseIsoDay(startDate);
  const endDay = parseIsoDay(endDate || startDate);
  const startClock = parseClockTime(startTime);
  const endClock = parseClockTime(endTime);
  if (!startDay || !endDay || !startClock || !endClock) return { error: 'Invalid date/time' };
  const startDateObj = new Date(startDay.year, startDay.month - 1, startDay.day, 0, 0, 0, 0);
  const endDateObj = new Date(endDay.year, endDay.month - 1, endDay.day, 0, 0, 0, 0);
  if (endDateObj.getTime() < startDateObj.getTime()) return { error: 'Invalid date range' };
  const occurrences = [];
  const cursor = new Date(startDateObj.getTime());
  while (cursor.getTime() <= endDateObj.getTime()) {
    if (occurrences.length >= maxDays) return { error: 'Too many days selected' };
    const day = {
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      day: cursor.getDate(),
      value: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    };
    const startAt = toLocalTs(day, startClock);
    const endAt = toLocalTs(day, endClock);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      return { error: 'Invalid time range' };
    }
    occurrences.push({ day: day.value, startAt, endAt });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!occurrences.length) return { error: 'No meeting occurrences' };
  return { occurrences };
};

const meetingSummaryText = (booking, actionLabel) => {
  const start = Number(booking?.startAt || 0);
  const end = Number(booking?.endAt || 0);
  const when = start && end ? `${new Date(start).toLocaleString()} - ${new Date(end).toLocaleTimeString()}` : '-';
  let locationPath = '';
  try {
    const state = readState();
    const client = (state?.clients || []).find((c) => String(c?.id || '') === String(booking?.clientId || ''));
    const site = (client?.sites || []).find((s) => String(s?.id || '') === String(booking?.siteId || ''));
    const plan = (site?.floorPlans || []).find((p) => String(p?.id || '') === String(booking?.floorPlanId || ''));
    const clientName = String(client?.shortName || client?.name || '').trim();
    const siteName = String(site?.name || '').trim();
    const planName = String(plan?.name || '').trim();
    locationPath = [clientName, siteName, planName].filter(Boolean).join(' -> ');
  } catch {
    locationPath = '';
  }
  const internalParticipants = (Array.isArray(booking?.participants) ? booking.participants : [])
    .map((p) => {
      const label = String(p?.fullName || p?.externalId || '-').trim() || '-';
      const flags = [];
      if (p?.remote) flags.push('remote');
      if (p?.optional) flags.push('optional');
      return flags.length ? `${label} (${flags.join(', ')})` : label;
    })
    .filter(Boolean);
  const externalParticipants = (Array.isArray(booking?.externalGuestsDetails) ? booking.externalGuestsDetails : [])
    .map((g) => `${String(g?.name || '-')}${g?.remote ? ' (remote)' : ' (on-site)'}${g?.email ? ` <${String(g.email)}>` : ''}`)
    .filter(Boolean);
  return [
    `${actionLabel}`,
    '',
    `Subject: ${booking?.subject || '-'}`,
    locationPath ? `Location: ${locationPath}` : null,
    `Room: ${booking?.roomName || booking?.roomId || '-'}`,
    `When: ${when}`,
    `Seats: ${booking?.requestedSeats || 0}`,
    `Room capacity: ${booking?.roomCapacity || 0}`,
    internalParticipants.length ? `Internal participants: ${internalParticipants.join(', ')}` : null,
    externalParticipants.length ? `External participants: ${externalParticipants.join(', ')}` : null,
    `Setup pre-meeting (min): ${Number(booking?.setupBufferBeforeMin) || 0}`,
    `Setup post-meeting (min): ${Number(booking?.setupBufferAfterMin) || 0}`,
    `Technical setup: ${booking?.technicalSetup ? 'Yes' : 'No'}`,
    booking?.technicalSetup && booking?.technicalEmail ? `Technical contact: ${booking.technicalEmail}` : null,
    booking?.videoConferenceLink ? `Video link: ${booking.videoConferenceLink}` : null,
    booking?.notes ? `Notes: ${booking.notes}` : null
  ].filter(Boolean).join('\n');
};

const meetingNotificationRecipientsFromBooking = (booking) => {
  const internal = (Array.isArray(booking?.participants) ? booking.participants : [])
    .map((p) => String(p?.email || '').trim().toLowerCase())
    .filter(Boolean);
  const external = (Array.isArray(booking?.externalGuestsDetails) ? booking.externalGuestsDetails : [])
    .filter((g) => g?.sendEmail && g?.email)
    .map((g) => String(g.email || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...internal, ...external]));
};

const meetingChangeSummaryText = (before, after) => {
  const lines = [];
  if (String(before?.subject || '') !== String(after?.subject || '')) {
    lines.push(`Subject: "${before?.subject || '-'}" -> "${after?.subject || '-'}"`);
  }
  if (Number(before?.startAt || 0) !== Number(after?.startAt || 0) || Number(before?.endAt || 0) !== Number(after?.endAt || 0)) {
    const prevRange = `${new Date(Number(before?.startAt || 0)).toLocaleString()} - ${new Date(Number(before?.endAt || 0)).toLocaleTimeString()}`;
    const nextRange = `${new Date(Number(after?.startAt || 0)).toLocaleString()} - ${new Date(Number(after?.endAt || 0)).toLocaleTimeString()}`;
    lines.push(`Schedule: ${prevRange} -> ${nextRange}`);
  }
  if (String(before?.notes || '') !== String(after?.notes || '')) {
    lines.push('Notes updated');
  }
  if (String(before?.videoConferenceLink || '') !== String(after?.videoConferenceLink || '')) {
    lines.push('Video conference link updated');
  }
  const beforeParticipants = Array.isArray(before?.participants) ? before.participants : [];
  const afterParticipants = Array.isArray(after?.participants) ? after.participants : [];
  const beforeParticipantSig = beforeParticipants
    .map((p) => `${String(p?.fullName || p?.externalId || '-')}${p?.remote ? ' [remote]' : ''}${p?.optional ? ' [opt]' : ''}`)
    .join(', ');
  const afterParticipantSig = afterParticipants
    .map((p) => `${String(p?.fullName || p?.externalId || '-')}${p?.remote ? ' [remote]' : ''}${p?.optional ? ' [opt]' : ''}`)
    .join(', ');
  if (beforeParticipantSig !== afterParticipantSig) {
    lines.push(`Participants updated (${beforeParticipants.length} -> ${afterParticipants.length})`);
  }
  if (
    Number(before?.setupBufferBeforeMin || 0) !== Number(after?.setupBufferBeforeMin || 0) ||
    Number(before?.setupBufferAfterMin || 0) !== Number(after?.setupBufferAfterMin || 0)
  ) {
    lines.push(
      `Setup buffers: pre ${Number(before?.setupBufferBeforeMin || 0)}m / post ${Number(before?.setupBufferAfterMin || 0)}m -> pre ${Number(after?.setupBufferBeforeMin || 0)}m / post ${Number(after?.setupBufferAfterMin || 0)}m`
    );
  }
  return lines;
};

const parseInlinePngDataUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const m = /^data:image\/png;base64,([a-z0-9+/=\s]+)$/i.exec(raw);
  if (!m) return null;
  try {
    const base64 = String(m[1] || '').replace(/\s+/g, '');
    const content = Buffer.from(base64, 'base64');
    if (!content.length) return null;
    if (content.length > 8 * 1024 * 1024) return null;
    return {
      filename: 'meeting-room-layout.png',
      contentType: 'image/png',
      content
    };
  } catch {
    return null;
  }
};

const getMeetingCheckInMap = (meetingId) => {
  const id = String(meetingId || '').trim();
  if (!id) return {};
  const rows = db.prepare('SELECT entryKey, checked FROM meeting_checkins WHERE meetingId = ?').all(id);
  const out = {};
  for (const row of rows) {
    if (Number(row.checked) === 1) out[String(row.entryKey || '')] = true;
  }
  return out;
};

const getMeetingCheckInMapByMeetingIds = (meetingIds) => {
  const ids = Array.from(new Set((meetingIds || []).map((v) => String(v || '').trim()).filter(Boolean)));
  const out = {};
  if (!ids.length) return out;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT meetingId, entryKey, checked FROM meeting_checkins WHERE meetingId IN (${placeholders})`)
    .all(...ids);
  for (const row of rows) {
    const mid = String(row.meetingId || '').trim();
    if (!mid) continue;
    if (!out[mid]) out[mid] = {};
    if (Number(row.checked) === 1) out[mid][String(row.entryKey || '')] = true;
  }
  return out;
};

const getMeetingCheckInTimestampsByMeetingIds = (meetingIds) => {
  const ids = Array.from(new Set((meetingIds || []).map((v) => String(v || '').trim()).filter(Boolean)));
  const out = {};
  if (!ids.length) return out;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT meetingId, entryKey, checked, updatedAt FROM meeting_checkins WHERE meetingId IN (${placeholders})`)
    .all(...ids);
  for (const row of rows) {
    const mid = String(row.meetingId || '').trim();
    const entryKey = String(row.entryKey || '').trim();
    if (!mid || !entryKey) continue;
    if (Number(row.checked) !== 1) continue;
    if (!out[mid]) out[mid] = {};
    out[mid][entryKey] = Number(row.updatedAt || 0) || Date.now();
  }
  return out;
};

app.get('/api/meetings/overview', requireAuth, (req, res) => {
  const state = readState();
  const visibleClients = getVisibleClientsForMeetings(req, state);
  const clientId = String(req.query.clientId || '').trim();
  const siteId = String(req.query.siteId || '').trim();
  const floorPlanId = String(req.query.floorPlanId || '').trim();
  const dayRaw = String(req.query.day || '').trim();
  const includeNonMeeting = String(req.query.includeNonMeeting || '') === '1';
  if (!siteId) {
    res.status(400).json({ error: 'Missing siteId' });
    return;
  }
  const roomRows = listMeetingRoomsFromClients(visibleClients, {
    clientId: clientId || undefined,
    siteId,
    floorPlanId: floorPlanId || undefined,
    includeNonMeeting
  });
  if (!roomRows.length) {
    const dayRangeEmpty = dayRaw ? dayRangeFromIso(dayRaw) : null;
    const startOfDayEmpty = dayRangeEmpty ? dayRangeEmpty.start : new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const endOfDayEmpty = dayRangeEmpty ? dayRangeEmpty.end : startOfDayEmpty + 24 * 60 * 60 * 1000;
    const startClockEmpty = parseClockTime(req.query.startTime);
    const endClockEmpty = parseClockTime(req.query.endTime);
    const beforeMinEmpty = clampMeetingBuffer(req.query.setupBufferBeforeMin);
    const afterMinEmpty = clampMeetingBuffer(req.query.setupBufferAfterMin);
    res.json({
      rooms: [],
      checkInStatusByMeetingId: {},
      checkInTimestampsByMeetingId: {},
      meta: {
        day: dayRangeEmpty ? dayRangeEmpty.day : new Date(startOfDayEmpty).toISOString().slice(0, 10),
        siteId,
        floorPlanId: floorPlanId || null,
        slot:
          startClockEmpty && endClockEmpty
            ? {
                startTime: startClockEmpty.value,
                endTime: endClockEmpty.value,
                setupBufferBeforeMin: beforeMinEmpty,
                setupBufferAfterMin: afterMinEmpty
              }
            : null
      }
    });
    return;
  }
  const dayRange = dayRaw ? dayRangeFromIso(dayRaw) : null;
  const now = Date.now();
  const startOfDay = dayRange ? dayRange.start : new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const endOfDay = dayRange ? dayRange.end : startOfDay + 24 * 60 * 60 * 1000;
  const bookings = db
    .prepare(
      `SELECT * FROM meeting_bookings
       WHERE siteId = ?
         AND status IN ('pending','approved')
         AND effectiveStartAt < ?
         AND effectiveEndAt > ?
       ORDER BY startAt ASC`
    )
    .all(siteId, endOfDay, startOfDay)
    .map(mapMeetingRow)
    .filter(Boolean);
  const byRoom = new Map();
  for (const booking of bookings) {
    const rid = String(booking.roomId || '');
    const list = byRoom.get(rid) || [];
    list.push(booking);
    byRoom.set(rid, list);
  }
  const startClock = parseClockTime(req.query.startTime);
  const endClock = parseClockTime(req.query.endTime);
  const beforeMin = clampMeetingBuffer(req.query.setupBufferBeforeMin);
  const afterMin = clampMeetingBuffer(req.query.setupBufferAfterMin);
  const dayForSlot = dayRange ? parseIsoDay(dayRange.day) : parseIsoDay(new Date().toISOString().slice(0, 10));
  const hasSlot = !!(dayForSlot && startClock && endClock);
  const slotStartAt = hasSlot ? toLocalTs(dayForSlot, startClock) : null;
  const slotEndAt = hasSlot ? toLocalTs(dayForSlot, endClock) : null;
  const slotEffectiveStart = hasSlot ? Number(slotStartAt) - beforeMin * 60_000 : null;
  const slotEffectiveEnd = hasSlot ? Number(slotEndAt) + afterMin * 60_000 : null;
  const rooms = roomRows.map((room) => {
    const entries = byRoom.get(room.roomId) || [];
    const inProgress = entries.some((row) => Number(row.startAt) <= now && Number(row.endAt) > now);
    const hasToday = entries.length > 0;
    const slotConflicts =
      hasSlot && Number(slotEffectiveEnd) > Number(slotEffectiveStart)
        ? entries.filter((row) => Number(row.effectiveStartAt) < Number(slotEffectiveEnd) && Number(row.effectiveEndAt) > Number(slotEffectiveStart))
        : [];
    return {
      ...room,
      hasMeetingToday: hasToday,
      inProgress,
      bookings: entries,
      slotConflicts
    };
  });
  const checkInStatusByMeetingId = getMeetingCheckInMapByMeetingIds(bookings.map((b) => b.id));
  const checkInTimestampsByMeetingId = getMeetingCheckInTimestampsByMeetingIds(bookings.map((b) => b.id));
  res.json({
    rooms,
    checkInStatusByMeetingId,
    checkInTimestampsByMeetingId,
    meta: {
      day: dayRange ? dayRange.day : new Date(startOfDay).toISOString().slice(0, 10),
      siteId,
      floorPlanId: floorPlanId || null,
      slot: hasSlot
        ? {
            startTime: startClock.value,
            endTime: endClock.value,
            setupBufferBeforeMin: beforeMin,
            setupBufferAfterMin: afterMin
          }
        : null
    }
  });
});

app.get('/api/meetings', requireAuth, (req, res) => {
  const state = readState();
  const visibleClients = getVisibleClientsForMeetings(req, state);
  const visibleRoomIds = new Set(listMeetingRoomsFromClients(visibleClients, { includeNonMeeting: true }).map((room) => room.roomId));
  const siteId = String(req.query.siteId || '').trim();
  const roomId = String(req.query.roomId || '').trim();
  const statusCsv = String(req.query.status || '').trim();
  const fromAt = Number(req.query.fromAt);
  const toAt = Number(req.query.toAt);
  const where = [];
  const params = [];
  if (siteId) {
    where.push('siteId = ?');
    params.push(siteId);
  }
  if (roomId) {
    where.push('roomId = ?');
    params.push(roomId);
  }
  if (Number.isFinite(fromAt)) {
    where.push('effectiveEndAt >= ?');
    params.push(Math.floor(fromAt));
  }
  if (Number.isFinite(toAt)) {
    where.push('effectiveStartAt <= ?');
    params.push(Math.floor(toAt));
  }
  if (statusCsv) {
    const requested = statusCsv
      .split(',')
      .map((v) => String(v || '').trim().toLowerCase())
      .filter((v) => ['pending', 'approved', 'rejected', 'cancelled'].includes(v));
    if (requested.length) {
      where.push(`status IN (${requested.map(() => '?').join(',')})`);
      params.push(...requested);
    }
  }
  const sql = `SELECT * FROM meeting_bookings ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY startAt ASC LIMIT 1500`;
  const rows = db.prepare(sql).all(...params).map(mapMeetingRow).filter(Boolean);
  const visibleRows = req.isAdmin ? rows : rows.filter((row) => visibleRoomIds.has(String(row.roomId || '')));
  res.json({ meetings: visibleRows });
});

app.get('/api/meetings/pending', requireAuth, (req, res) => {
  if (!req.isAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const rows = db
    .prepare("SELECT * FROM meeting_bookings WHERE status = 'pending' ORDER BY requestedAt ASC LIMIT 500")
    .all()
    .map(mapMeetingRow)
    .filter(Boolean);
  res.json({ pending: rows, pendingCount: rows.length });
});

app.get('/api/meetings/log', requireAuth, (req, res) => {
  if (!req.isAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const q = String(req.query.q || '').trim().toLowerCase();
  const format = String(req.query.format || '').trim().toLowerCase();
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, Math.floor(limitRaw))) : 400;
  const rows = db
    .prepare(
      `SELECT l.id, l.bookingId, l.event, l.actorUserId, l.actorUsername, l.detailsJson, l.ts, b.subject, b.roomName, b.status
       FROM meeting_audit_log l
       LEFT JOIN meeting_bookings b ON b.id = l.bookingId
       ORDER BY l.ts DESC
       LIMIT ?`
    )
    .all(limit)
    .map((row) => ({
      id: Number(row.id) || 0,
      bookingId: String(row.bookingId || ''),
      event: String(row.event || ''),
      actorUserId: row.actorUserId ? String(row.actorUserId) : null,
      actorUsername: row.actorUsername ? String(row.actorUsername) : null,
      ts: Number(row.ts) || 0,
      subject: String(row.subject || ''),
      roomName: String(row.roomName || ''),
      bookingStatus: String(row.status || ''),
      details: safeJsonParse(row.detailsJson || '{}', {})
    }))
    .filter((row) => {
      if (!q) return true;
      return (
        row.bookingId.toLowerCase().includes(q) ||
        row.event.toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q) ||
        row.roomName.toLowerCase().includes(q) ||
        String(row.actorUsername || '').toLowerCase().includes(q)
      );
    });
  if (format === 'csv') {
    const esc = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
    const lines = [
      'id,bookingId,event,actorUsername,subject,roomName,bookingStatus,timestamp',
      ...rows.map((row) =>
        [
          row.id,
          esc(row.bookingId),
          esc(row.event),
          esc(row.actorUsername || ''),
          esc(row.subject || ''),
          esc(row.roomName || ''),
          esc(row.bookingStatus || ''),
          row.ts
        ].join(',')
      )
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="plixmap-meeting-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\n'));
    return;
  }
  res.json({ rows, total: rows.length });
});

app.post('/api/meetings', requireAuth, async (req, res) => {
  const payload = req.body || {};
  const clientId = String(payload.clientId || '').trim();
  const siteId = String(payload.siteId || '').trim();
  const floorPlanId = String(payload.floorPlanId || '').trim();
  const roomId = String(payload.roomId || '').trim();
  const subject = String(payload.subject || '').trim();
  const requestedSeatsRaw = Number(payload.requestedSeats);
  const requestedSeats = Number.isFinite(requestedSeatsRaw) ? Math.max(1, Math.floor(requestedSeatsRaw)) : 0;
  const setupBufferBeforeMin = clampMeetingBuffer(payload.setupBufferBeforeMin);
  const setupBufferAfterMin = clampMeetingBuffer(payload.setupBufferAfterMin);
  const sendEmail = !!payload.sendEmail;
  const technicalSetup = !!payload.technicalSetup;
  const technicalEmail = String(payload.technicalEmail || '').trim().toLowerCase();
  const notes = String(payload.notes || '').trim();
  const videoConferenceLink = String(payload.videoConferenceLink || '').trim();
  const roomSnapshotAttachment = parseInlinePngDataUrl(payload.roomSnapshotPngDataUrl);
  const externalGuests = !!payload.externalGuests;
  const externalGuestsDetails = Array.isArray(payload.externalGuestsDetails)
    ? payload.externalGuestsDetails
        .map((row) => ({
          name: String(row?.name || '').trim(),
          email: String(row?.email || '').trim().toLowerCase() || null,
          sendEmail: !!row?.sendEmail,
          remote: !!row?.remote
        }))
        .filter((row) => row.name)
    : [];
  const externalGuestsList = Array.isArray(payload.externalGuestsList)
    ? payload.externalGuestsList.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (!clientId || !siteId || !roomId || !subject || !requestedSeats) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const state = readState();
  const visibleClients = getVisibleClientsForMeetings(req, state);
  const rooms = listMeetingRoomsFromClients(visibleClients, { clientId, siteId, includeNonMeeting: true });
  const room = rooms.find((entry) => entry.roomId === roomId && (!floorPlanId || entry.floorPlanId === floorPlanId));
  if (!room) {
    res.status(403).json({ error: 'Room not accessible' });
    return;
  }
  if (!room.isMeetingRoom) {
    res.status(400).json({ error: 'Selected room is not marked as meeting room' });
    return;
  }
  const occurrenceResult = createMeetingOccurrences({
    startDate: payload.startDate,
    endDate: payload.endDate || payload.startDate,
    startTime: payload.startTime,
    endTime: payload.endTime
  });
  if (occurrenceResult.error) {
    res.status(400).json({ error: occurrenceResult.error });
    return;
  }
  const participantResolution = resolveParticipantEmails(clientId, payload.participants);
  if (sendEmail && participantResolution.missingEmails.length) {
    res.status(400).json({ error: 'Missing participant emails', missingEmails: participantResolution.missingEmails });
    return;
  }
  if (technicalSetup && !technicalEmail) {
    res.status(400).json({ error: 'Technical setup email required' });
    return;
  }
  const actor = db
    .prepare('SELECT id, username, email, canCreateMeetings, isAdmin, isSuperAdmin, disabled FROM users WHERE id = ?')
    .get(req.userId);
  if (!actor || Number(actor.disabled) === 1) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const canCreateAutonomously = req.isAdmin || req.isSuperAdmin || Number(actor.canCreateMeetings) === 1;
  const status = canCreateAutonomously ? 'approved' : 'pending';
  const approvalRequired = canCreateAutonomously ? 0 : 1;
  const conflictsByDay = [];
  for (const occ of occurrenceResult.occurrences) {
    const effectiveStartAt = Number(occ.startAt) - setupBufferBeforeMin * 60_000;
    const effectiveEndAt = Number(occ.endAt) + setupBufferAfterMin * 60_000;
    const conflicts = getMeetingConflicts(room.roomId, effectiveStartAt, effectiveEndAt, null);
    if (conflicts.length) conflictsByDay.push({ day: occ.day, conflicts });
  }
  if (conflictsByDay.length) {
    res.status(409).json({ error: 'Time slot not available', conflictsByDay });
    return;
  }
  const now = Date.now();
  const multiDayGroupId = occurrenceResult.occurrences.length > 1 ? (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex')) : null;
  const createdIds = [];
  const insert = db.prepare(
    `INSERT INTO meeting_bookings
      (id, status, approvalRequired, clientId, siteId, floorPlanId, roomId, roomName, subject, requestedSeats, roomCapacity, equipmentJson, participantsJson, externalGuests, externalGuestsJson, externalGuestsDetailsJson, sendEmail, technicalSetup, technicalEmail, notes, videoConferenceLink, setupBufferBeforeMin, setupBufferAfterMin, startAt, endAt, effectiveStartAt, effectiveEndAt, multiDayGroupId, occurrenceDate, requestedById, requestedByUsername, requestedByEmail, requestedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const equipmentJson = JSON.stringify(room.equipment || []);
  const participantsJson = JSON.stringify(participantResolution.normalized || []);
  const normalizedExternalGuestsDetails = externalGuests
    ? externalGuestsDetails
    : [];
  const externalGuestEmailsFromDetails = normalizedExternalGuestsDetails
    .filter((row) => row.sendEmail && row.email)
    .map((row) => String(row.email || '').trim().toLowerCase())
    .filter(Boolean);
  const effectiveExternalGuestsList = externalGuestEmailsFromDetails.length ? externalGuestEmailsFromDetails : externalGuestsList;
  const externalGuestsJson = JSON.stringify(externalGuestsList);
  const externalGuestsDetailsJson = JSON.stringify(normalizedExternalGuestsDetails);
  const requestedByUsername = String(actor.username || '').toLowerCase();
  const requestedByEmail = String(actor.email || '').trim().toLowerCase();
  const tx = db.transaction(() => {
    for (const occ of occurrenceResult.occurrences) {
      const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
      const effectiveStartAt = Number(occ.startAt) - setupBufferBeforeMin * 60_000;
      const effectiveEndAt = Number(occ.endAt) + setupBufferAfterMin * 60_000;
      insert.run(
        id,
        status,
        approvalRequired,
        clientId,
        siteId,
        room.floorPlanId,
        room.roomId,
        room.roomName,
        subject,
        requestedSeats,
        room.capacity || 0,
        equipmentJson,
        participantsJson,
        externalGuests ? 1 : 0,
        JSON.stringify(effectiveExternalGuestsList),
        externalGuestsDetailsJson,
        sendEmail ? 1 : 0,
        technicalSetup ? 1 : 0,
        technicalEmail,
        notes,
        videoConferenceLink,
        setupBufferBeforeMin,
        setupBufferAfterMin,
        Number(occ.startAt),
        Number(occ.endAt),
        effectiveStartAt,
        effectiveEndAt,
        multiDayGroupId,
        occ.day,
        req.userId,
        requestedByUsername,
        requestedByEmail,
        now,
        now,
        now
      );
      createdIds.push(id);
      writeMeetingAuditLog(id, 'created', req.userId, req.username, {
        status,
        approvalRequired: !!approvalRequired,
        roomId: room.roomId,
        roomName: room.roomName,
        siteId,
        floorPlanId: room.floorPlanId
      });
    }
  });
  tx();
  const createdBookings = createdIds
    .map((id) => db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(id))
    .map(mapMeetingRow)
    .filter(Boolean);
  if (!canCreateAutonomously) {
    for (const booking of createdBookings) notifyAdminsForMeetingRequest(booking);
    broadcastMeetingPendingSummary();
  }
  if (canCreateAutonomously && sendEmail) {
    const recipients = [...participantResolution.emails, ...effectiveExternalGuestsList];
    const mailWarnings = [];
    for (const booking of createdBookings) {
      const mailRes = await sendMeetingMail({
        recipients,
        subject: `[${APP_BRAND}] Meeting invitation: ${booking.subject || ''}`,
        text: meetingSummaryText(booking, 'Meeting scheduled'),
        attachments: roomSnapshotAttachment ? [roomSnapshotAttachment] : undefined,
        clientId: booking.clientId,
        actorUserId: req.userId,
        actorUsername: req.username,
        details: { kind: 'meeting_invite', bookingId: booking.id }
      });
      if (!mailRes?.ok && (mailRes?.reason === 'smtp_client_not_configured' || mailRes?.reason === 'smtp_client_missing_password')) {
        const label = String(mailRes?.clientName || booking.clientName || booking.clientId || 'cliente');
        const msg =
          mailRes?.reason === 'smtp_client_missing_password'
            ? `SMTP non completato per il cliente ${label} (password mancante).`
            : `SMTP non configurato per il cliente ${label}.`;
        if (!mailWarnings.includes(msg)) mailWarnings.push(msg);
      }
    }
    if (mailWarnings.length) {
      res.json({
        ok: true,
        status,
        approvalRequired: !!approvalRequired,
        bookings: createdBookings,
        warnings: mailWarnings
      });
      return;
    }
  }
  if (technicalSetup && technicalEmail) {
    for (const booking of createdBookings) {
      await sendMeetingMail({
        recipients: [technicalEmail],
        subject: `[${APP_BRAND}] Technical setup required`,
        text: `${meetingSummaryText(booking, 'Technical setup requested')}\n\nRequester: ${requestedByUsername}`,
        attachments: roomSnapshotAttachment ? [roomSnapshotAttachment] : undefined,
        clientId: booking.clientId,
        actorUserId: req.userId,
        actorUsername: req.username,
        details: { kind: 'meeting_technical_setup', bookingId: booking.id }
      });
    }
    const techUser = db.prepare('SELECT id FROM users WHERE lower(email) = ? AND disabled = 0 LIMIT 1').get(technicalEmail);
    if (techUser?.id && String(techUser.id) !== String(req.userId)) {
      for (const booking of createdBookings) {
        pushMeetingDm(
          req.userId,
          String(techUser.id),
          `[TECH SETUP]\n${booking.subject || booking.id}\nRoom: ${booking.roomName || '-'}\n${new Date(Number(booking.startAt)).toLocaleString()}`
        );
      }
    }
  }
  writeAuditLog(db, {
    level: 'important',
    event: 'meeting_created',
    userId: req.userId,
    username: req.username,
    scopeType: 'site',
    scopeId: siteId,
    ...requestMeta(req),
    details: { count: createdBookings.length, status, roomId: room.roomId, roomName: room.roomName }
  });
  res.json({
    ok: true,
    status,
    approvalRequired: !!approvalRequired,
    bookings: createdBookings
  });
});

app.post('/api/meetings/:id/review', requireAuth, async (req, res) => {
  if (!req.isAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const bookingId = String(req.params.id || '').trim();
  const action = String(req.body?.action || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();
  if (!bookingId || (action !== 'approve' && action !== 'reject')) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  if (action === 'reject' && !reason) {
    res.status(400).json({ error: 'Reason is required when rejecting' });
    return;
  }
  const current = db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId);
  const row = mapMeetingRow(current);
  if (!row) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }
  if (row.status === 'cancelled' || row.status === 'rejected') {
    res.status(400).json({ error: 'Meeting already closed' });
    return;
  }
  if (action === 'approve') {
    const conflicts = getMeetingConflicts(row.roomId, row.effectiveStartAt, row.effectiveEndAt, row.id);
    if (conflicts.length) {
      res.status(409).json({ error: 'Cannot approve due to overlap', conflicts });
      return;
    }
  }
  const nextStatus = action === 'approve' ? 'approved' : 'rejected';
  const now = Date.now();
  db.prepare(
    `UPDATE meeting_bookings
     SET status = ?, reviewedAt = ?, reviewedById = ?, reviewedByUsername = ?, rejectReason = ?, updatedAt = ?
     WHERE id = ?`
  ).run(nextStatus, now, req.userId, req.username, action === 'reject' ? reason : null, now, bookingId);
  const updated = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
  writeMeetingAuditLog(bookingId, action === 'approve' ? 'approved' : 'rejected', req.userId, req.username, {
    reason: action === 'reject' ? reason : null
  });
  notifyMeetingReviewToRequester({ ...updated, reviewedById: req.userId }, nextStatus, reason || null);
  if (nextStatus === 'approved' && updated?.sendEmail) {
    const participantEmails = (updated?.participants || [])
      .map((p) => String(p?.email || '').trim().toLowerCase())
      .filter(Boolean);
    const guestEmailsDetailed = (updated?.externalGuestsDetails || [])
      .filter((g) => g?.sendEmail && g?.email)
      .map((g) => String(g?.email || '').trim().toLowerCase())
      .filter(Boolean);
    const guestEmails = guestEmailsDetailed.length
      ? guestEmailsDetailed
      : (updated?.externalGuestsList || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
    await sendMeetingMail({
      recipients: [...participantEmails, ...guestEmails],
      subject: `[${APP_BRAND}] Meeting approved: ${updated.subject || ''}`,
      text: meetingSummaryText(updated, 'Meeting approved'),
      clientId: updated.clientId,
      actorUserId: req.userId,
      actorUsername: req.username,
      details: { kind: 'meeting_approved', bookingId: updated.id }
    });
  }
  writeAuditLog(db, {
    level: 'important',
    event: 'meeting_reviewed',
    userId: req.userId,
    username: req.username,
    scopeType: 'meeting',
    scopeId: bookingId,
    ...requestMeta(req),
    details: { action: nextStatus, reason: reason || null }
  });
  const pendingCount = pendingMeetingCount();
  broadcastMeetingPendingSummary();
  res.json({ ok: true, booking: updated, pendingCount });
});

app.post('/api/meetings/:id/cancel', requireAuth, (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  if (!bookingId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const current = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
  if (!current) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }
  const canCancel = req.isAdmin || req.isSuperAdmin || String(current.requestedById || '') === String(req.userId || '');
  if (!canCancel) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (current.status === 'cancelled' || current.status === 'rejected') {
    res.json({ ok: true, booking: current });
    return;
  }
  const now = Date.now();
  db.prepare('UPDATE meeting_bookings SET status = ?, updatedAt = ? WHERE id = ?').run('cancelled', now, bookingId);
  writeMeetingAuditLog(bookingId, 'cancelled', req.userId, req.username, {});
  broadcastMeetingPendingSummary();
  const updated = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
  if (updated?.sendEmail) {
    const recipients = meetingNotificationRecipientsFromBooking(updated);
    if (recipients.length) {
      void sendMeetingMail({
        recipients,
        subject: `[Plixmap] Meeting cancelled: ${updated.subject || updated.roomName || updated.id}`,
        text: `${meetingSummaryText(updated, 'Meeting cancelled')}\n\nThis meeting has been cancelled.`,
        clientId: updated.clientId,
        actorUserId: req.userId,
        actorUsername: req.username,
        details: { kind: 'meeting_cancelled', bookingId: updated.id }
      });
    }
  }
  res.json({ ok: true, booking: updated });
});

app.put('/api/meetings/:id', requireAuth, express.json({ limit: '256kb' }), async (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  if (!bookingId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const current = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
  if (!current) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }
  if (!MEETING_ACTIVE_STATUSES.has(String(current.status || ''))) {
    res.status(400).json({ error: 'Meeting is not editable' });
    return;
  }
  const canEdit = req.isAdmin || req.isSuperAdmin || String(current.requestedById || '') === String(req.userId || '');
  if (!canEdit) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const body = req.body || {};
  const applyToSeries = !!body.applyToSeries && !!current.multiDayGroupId;
  const subject = body.subject !== undefined ? String(body.subject || '').trim() : String(current.subject || '');
  if (!subject) {
    res.status(400).json({ error: 'Missing subject' });
    return;
  }
  const occurrenceDate = body.day !== undefined ? String(body.day || '').trim() : String(current.occurrenceDate || '').trim();
  const requestedDay = parseIsoDay(occurrenceDate);
  const startTimeParsed = parseClockTime(body.startTime !== undefined ? body.startTime : new Date(Number(current.startAt || 0)).toTimeString().slice(0, 5));
  const endTimeParsed = parseClockTime(body.endTime !== undefined ? body.endTime : new Date(Number(current.endAt || 0)).toTimeString().slice(0, 5));
  if ((!applyToSeries && !requestedDay) || !startTimeParsed || !endTimeParsed) {
    res.status(400).json({ error: 'Invalid date/time' });
    return;
  }
  const setupBufferBeforeMin = body.setupBufferBeforeMin !== undefined ? clampMeetingBuffer(body.setupBufferBeforeMin) : Number(current.setupBufferBeforeMin || 0);
  const setupBufferAfterMin = body.setupBufferAfterMin !== undefined ? clampMeetingBuffer(body.setupBufferAfterMin) : Number(current.setupBufferAfterMin || 0);
  const notes = body.notes !== undefined ? String(body.notes || '') : String(current.notes || '');
  const videoConferenceLink = body.videoConferenceLink !== undefined ? String(body.videoConferenceLink || '') : String(current.videoConferenceLink || '');
  const participantInput = body.participants !== undefined ? body.participants : current.participants;
  const participantResolution = resolveParticipantEmails(current.clientId, participantInput);
  const participantsNormalized = Array.isArray(participantResolution.normalized) ? participantResolution.normalized : [];
  const manualParticipants = participantsNormalized.filter((p) => p && p.kind === 'manual');
  const existingExternalByKey = new Map(
    (Array.isArray(current.externalGuestsDetails) ? current.externalGuestsDetails : []).map((g) => [
      `${String(g?.name || '').trim().toLowerCase()}|${String(g?.email || '').trim().toLowerCase()}`,
      g
    ])
  );
  const externalGuestsDetails = Array.isArray(body.externalGuestsDetails)
    ? body.externalGuestsDetails.map((row) => ({
        name: String(row?.name || '').trim(),
        email: String(row?.email || '').trim() || null,
        sendEmail: !!row?.sendEmail,
        remote: !!row?.remote
      })).filter((row) => row.name)
    : manualParticipants.map((p) => {
        const key = `${String(p?.fullName || '').trim().toLowerCase()}|${String(p?.email || '').trim().toLowerCase()}`;
        const prev = existingExternalByKey.get(key);
        return {
          name: String(p?.fullName || '').trim(),
          email: p?.email ? String(p.email).trim() : null,
          sendEmail: prev ? !!prev.sendEmail : false,
          remote: !!p?.remote
        };
      }).filter((row) => row.name);
  const externalGuests = externalGuestsDetails.length > 0;
  const externalGuestsList = externalGuestsDetails.map((g) => String(g.name || '').trim()).filter(Boolean);
  const requestedSeats =
    participantsNormalized.filter((p) => !p?.remote).length +
    externalGuestsDetails.filter((g) => !g?.remote).length;
  const participantsJson = JSON.stringify(participantsNormalized);
  const externalGuestsJson = JSON.stringify(externalGuestsList);
  const externalGuestsDetailsJson = JSON.stringify(externalGuestsDetails);
  const now = Date.now();
  const updateStmt = db.prepare(
    `UPDATE meeting_bookings
     SET subject = ?, notes = ?, videoConferenceLink = ?, requestedSeats = ?, participantsJson = ?, externalGuests = ?, externalGuestsJson = ?, externalGuestsDetailsJson = ?, setupBufferBeforeMin = ?, setupBufferAfterMin = ?, startAt = ?, endAt = ?, effectiveStartAt = ?, effectiveEndAt = ?, occurrenceDate = ?, updatedAt = ?
     WHERE id = ?`
  );

  const targets = applyToSeries
    ? db
        .prepare(
          `SELECT * FROM meeting_bookings
           WHERE multiDayGroupId = ?
             AND status IN ('pending','approved')
           ORDER BY startAt ASC`
        )
        .all(String(current.multiDayGroupId))
        .map(mapMeetingRow)
        .filter(Boolean)
    : [current];
  if (!targets.length) {
    res.status(404).json({ error: 'Meeting series not found' });
    return;
  }

  const planned = [];
  for (const row of targets) {
    const rowDay = applyToSeries ? parseIsoDay(String(row.occurrenceDate || '')) : requestedDay;
    if (!rowDay) {
      res.status(400).json({ error: 'Invalid occurrence date in series' });
      return;
    }
    const startAt = toLocalTs(rowDay, startTimeParsed);
    const endAt = toLocalTs(rowDay, endTimeParsed);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      res.status(400).json({ error: 'Invalid time range' });
      return;
    }
    const effectiveStartAt = startAt - setupBufferBeforeMin * 60 * 1000;
    const effectiveEndAt = endAt + setupBufferAfterMin * 60 * 1000;
    const conflicts = getMeetingConflicts(row.roomId, effectiveStartAt, effectiveEndAt, row.id);
    if (conflicts.length) {
      res.status(409).json({ error: 'Meeting conflicts detected', conflicts, bookingId: row.id, applyToSeries });
      return;
    }
    planned.push({
      row,
      occurrenceDate: rowDay.value,
      startAt,
      endAt,
      effectiveStartAt,
      effectiveEndAt
    });
  }

  const tx = db.transaction(() => {
    for (const item of planned) {
      updateStmt.run(
        subject,
        notes,
        videoConferenceLink,
        requestedSeats,
        participantsJson,
        externalGuests ? 1 : 0,
        externalGuestsJson,
        externalGuestsDetailsJson,
        setupBufferBeforeMin,
        setupBufferAfterMin,
        item.startAt,
        item.endAt,
        item.effectiveStartAt,
        item.effectiveEndAt,
        item.occurrenceDate,
        now,
        item.row.id
      );
    }
  });
  tx();

  const updatedRows = planned
    .map((item) => mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(item.row.id)))
    .filter(Boolean);
  const updated = updatedRows.find((row) => String(row.id) === bookingId) || updatedRows[0] || null;
  for (const row of updatedRows) {
    const before = targets.find((t) => String(t.id) === String(row.id)) || current;
    const changeLines = meetingChangeSummaryText(before, row);
    writeMeetingAuditLog(row.id, 'updated', req.userId, req.username, { changes: changeLines, applyToSeries });
    if (row?.sendEmail) {
      const recipients = meetingNotificationRecipientsFromBooking(row);
      if (recipients.length) {
        void sendMeetingMail({
          recipients,
          subject: `[Plixmap] Meeting updated: ${row.subject || row.roomName || row.id}`,
          text: `${meetingSummaryText(row, 'Meeting updated')}\n\nChanges:\n${changeLines.length ? changeLines.map((line) => `- ${line}`).join('\n') : '- Minor updates'}\n`,
          clientId: row.clientId,
          actorUserId: req.userId,
          actorUsername: req.username,
          details: { kind: 'meeting_updated', bookingId: row.id, changedFields: changeLines, applyToSeries }
        });
      }
    }
  }

  res.json({ ok: true, booking: updated, updatedCount: updatedRows.length, applyToSeries });
});

app.get('/manifest-kiosk/:roomId.webmanifest', (req, res) => {
  const roomId = String(req.params.roomId || '').trim();
  const safeRoomId = encodeURIComponent(roomId || 'unknown');
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    name: 'Plixmap Kiosk',
    short_name: 'Plixmap Kiosk',
    description: 'Plixmap meeting room kiosk mode',
    start_url: `/meetingroom/${safeRoomId}`,
    scope: '/meetingroom/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    lang: 'en',
    icons: [{ src: '/plixmap-logo.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }]
  });
});

app.get('/api/meeting-room/:roomId/schedule', (req, res) => {
  const roomId = String(req.params.roomId || '').trim();
  if (!roomId) {
    res.status(400).json({ error: 'Missing roomId' });
    return;
  }
  const state = readState();
  const rooms = listMeetingRoomsFromClients(state.clients || [], { includeNonMeeting: true });
  const room = rooms.find((entry) => entry.roomId === roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const publicRoom = {
    ...room,
    clientLogoUrl: buildKioskPublicUploadUrl(req, room.clientLogoUrl) || null,
    businessPartners: Array.isArray(room.businessPartners)
      ? room.businessPartners.map((bp) => ({
          ...bp,
          logoUrl: buildKioskPublicUploadUrl(req, bp.logoUrl) || null
        }))
      : []
  };
  const now = Date.now();
  const start = now - 12 * 60 * 60 * 1000;
  const end = now + 7 * 24 * 60 * 60 * 1000;
  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
  const rows = db
    .prepare(
      `SELECT * FROM meeting_bookings
       WHERE roomId = ?
         AND status IN ('pending','approved')
         AND effectiveStartAt < ?
         AND effectiveEndAt > ?
       ORDER BY startAt ASC`
    )
    .all(roomId, end, start)
    .map(mapMeetingRow)
    .filter(Boolean);
  const inProgress = rows.find((row) => Number(row.startAt) <= now && Number(row.endAt) > now) || null;
  const upcoming = rows.filter((row) => Number(row.startAt) > now).slice(0, 20);
  const daySchedule = rows
    .filter((row) => Number(row.endAt) > startOfToday && Number(row.startAt) < endOfToday)
    .sort((a, b) => Number(a.startAt) - Number(b.startAt));
  const checkInStatusByMeetingId = getMeetingCheckInMapByMeetingIds(rows.map((row) => row.id));
  const checkInTimestampsByMeetingId = getMeetingCheckInTimestampsByMeetingIds(rows.map((row) => row.id));
  res.json({
    room: publicRoom,
    now,
    inProgress,
    upcoming,
    daySchedule,
    checkInStatusByMeetingId,
    checkInTimestampsByMeetingId,
    kioskPublicUrl: buildKioskPublicUrl(req, roomId)
  });
});

app.post('/api/meeting-room/:roomId/checkin-toggle', express.json({ limit: '256kb' }), (req, res) => {
  const roomId = String(req.params.roomId || '').trim();
  const meetingId = String(req.body?.meetingId || '').trim();
  const key = String(req.body?.key || '').trim();
  const checked = !!req.body?.checked;
  if (!roomId || !meetingId || !key) {
    res.status(400).json({ error: 'Missing check-in parameters' });
    return;
  }
  const booking = db
    .prepare(`SELECT id, roomId, status, startAt, endAt FROM meeting_bookings WHERE id = ? LIMIT 1`)
    .get(meetingId);
  if (!booking || String(booking.roomId || '') !== roomId) {
    res.status(404).json({ error: 'Meeting not found for room' });
    return;
  }
  if (!['approved', 'pending'].includes(String(booking.status || ''))) {
    res.status(409).json({ error: 'Meeting not active for check-in' });
    return;
  }
  const now = Date.now();
  if (checked) {
    db.prepare(
      `INSERT INTO meeting_checkins (meetingId, entryKey, checked, updatedAt)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(meetingId, entryKey) DO UPDATE SET checked = excluded.checked, updatedAt = excluded.updatedAt`
    ).run(meetingId, key, now);
  } else {
    db.prepare('DELETE FROM meeting_checkins WHERE meetingId = ? AND entryKey = ?').run(meetingId, key);
  }
  res.json({
    ok: true,
    meetingId,
    checkInMap: getMeetingCheckInMap(meetingId),
    checkInTimestamps: getMeetingCheckInTimestampsByMeetingIds([meetingId])[meetingId] || {}
  });
});

app.post('/api/meeting-room/:roomId/help-request', express.json({ limit: '64kb' }), async (req, res) => {
  const roomId = String(req.params.roomId || '').trim();
  const service = String(req.body?.service || '').trim().toLowerCase();
  if (!roomId || !['it', 'cleaning', 'coffee'].includes(service)) {
    res.status(400).json({ error: 'Invalid help request' });
    return;
  }
  const state = readState();
  const rooms = listMeetingRoomsFromClients(state.clients || [], { includeNonMeeting: true });
  const room = rooms.find((entry) => entry.roomId === roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const support = room.siteSupportContacts || {};
  const target =
    service === 'it'
      ? support.it
      : service === 'cleaning'
        ? support.cleaning
        : support.coffee;
  const recipient = String(target?.email || '').trim();
  if (!recipient) {
    res.status(400).json({ error: 'Support email not configured' });
    return;
  }
  const serviceLabel =
    service === 'it'
      ? 'IT Service'
      : service === 'cleaning'
        ? 'Cleaning Service'
        : 'Coffee Service';
  const roomName = String(room.roomName || roomId);
  const locationPath = [room.clientName, room.siteName, room.floorPlanName].filter(Boolean).join(' -> ');
  const helpMailResult = await sendMeetingMail({
    recipients: [recipient],
    subject: `Need ${serviceLabel} room ${roomName}`,
    text: [
      `Need ${serviceLabel} room ${roomName}`,
      locationPath ? `Location: ${locationPath}` : null,
      `Requested at: ${new Date().toLocaleString()}`,
      `Source: Kiosk mode`
    ]
      .filter(Boolean)
      .join('\n'),
    clientId: room.clientId,
    actorUserId: null,
    actorUsername: 'kiosk',
    details: { kind: 'meeting_room_help_request', roomId, service }
  });
  if (!helpMailResult?.ok) {
    if (helpMailResult?.reason === 'smtp_client_not_configured' || helpMailResult?.reason === 'smtp_client_missing_password') {
      const clientLabel = String(helpMailResult?.clientName || room.clientName || room.clientId || 'cliente');
      res.status(400).json({
        error:
          helpMailResult?.reason === 'smtp_client_missing_password'
            ? `SMTP non completato per il cliente ${clientLabel} (password mancante).`
            : `SMTP non configurato per il cliente ${clientLabel}.`
      });
      return;
    }
    res.status(500).json({ error: 'Failed to send help request', detail: helpMailResult?.reason || null });
    return;
  }
  res.json({ ok: true, service });
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
      'SELECT id, username, isAdmin, isSuperAdmin, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, disabled, language, avatarUrl, firstName, lastName, phone, email, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
    )
    .all()
    .map((u) => {
      const normalizedUsername = String(u.username || '').toLowerCase();
      return {
        ...u,
        username: normalizedUsername,
        isAdmin: !!u.isAdmin,
        isSuperAdmin: !!u.isSuperAdmin && normalizedUsername === 'superadmin',
        canCreateMeetings: u.canCreateMeetings === undefined ? true : !!u.canCreateMeetings,
        canManageBusinessPartners: u.canManageBusinessPartners === undefined ? false : !!u.canManageBusinessPartners,
        isMeetingOperator: u.isMeetingOperator === undefined ? false : !!u.isMeetingOperator,
        disabled: !!u.disabled
      };
    });
  const perms = db.prepare('SELECT userId, scopeType, scopeId, access, chat FROM permissions').all();
  const permsByUser = new Map();
  for (const p of perms) {
    const list = permsByUser.get(p.userId) || [];
    list.push({ scopeType: p.scopeType, scopeId: p.scopeId, access: p.access, chat: !!p.chat });
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

// Public-ish user directory (authenticated): used to resolve avatars for historical revisions.
app.get('/api/users/directory', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, username, isAdmin, isSuperAdmin, disabled, firstName, lastName, avatarUrl FROM users ORDER BY username ASC')
    .all()
    .filter((u) => Number(u.disabled) !== 1)
    .map((u) => {
      const normalizedUsername = String(u.username || '').toLowerCase();
      return {
        id: String(u.id),
        username: normalizedUsername,
        firstName: String(u.firstName || ''),
        lastName: String(u.lastName || ''),
        avatarUrl: String(u.avatarUrl || ''),
        isAdmin: !!u.isAdmin,
        isSuperAdmin: !!u.isSuperAdmin && normalizedUsername === 'superadmin'
      };
    });
  res.json({ users: rows });
});

// Lightweight user profile for in-app views (chat avatars, etc.).
// Only available when users share at least one chat-enabled client, unless requester is admin.
app.get('/api/users/:id/profile', requireAuth, (req, res) => {
  const targetId = String(req.params.id || '').trim();
  if (!targetId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const target = db
    .prepare('SELECT id, username, firstName, lastName, email, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users WHERE id = ?')
    .get(targetId);
  if (!target || Number(target.disabled) === 1) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // WhatsApp-like: a blocked user can't see the blocker profile.
  if (userHasBlocked(String(target.id), req.userId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const requesterIsAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  const targetIsAdmin = !!target.isAdmin || !!target.isSuperAdmin;
  const reqClients = getChatClientIdsForUser(req.userId, requesterIsAdmin);
  const targetClients = getChatClientIdsForUser(String(target.id), targetIsAdmin);
  const common = new Set();
  for (const id of reqClients) if (targetClients.has(id)) common.add(id);
  if (!common.size && !requesterIsAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const state = readState();
  const nameByClientId = new Map();
  for (const c of state?.clients || []) {
    if (!c?.id) continue;
    nameByClientId.set(String(c.id), c.shortName || c.name || String(c.id));
  }
  const clientsCommon = Array.from(common)
    .map((id) => ({ id, name: nameByClientId.get(id) || id }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  const normalizedUsername = String(target.username || '').toLowerCase();
  res.json({
    id: String(target.id),
    username: normalizedUsername,
    firstName: String(target.firstName || ''),
    lastName: String(target.lastName || ''),
    email: String(target.email || ''),
    avatarUrl: String(target.avatarUrl || ''),
    lastOnlineAt: target.lastOnlineAt ? Number(target.lastOnlineAt) : null,
    clientsCommon
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
    canCreateMeetings = true,
    canManageBusinessPartners = false,
    isMeetingOperator = false,
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
  const meetingOperator = !!isMeetingOperator && !isAdmin;
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
      `INSERT INTO users (id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, language, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, paletteFavoritesJson, firstName, lastName, phone, email, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      normalizedUsername,
      salt,
      hash,
      isAdmin ? 1 : 0,
      String(language),
      meetingOperator ? 1 : canCreateMeetings === false ? 0 : 1,
      canManageBusinessPartners ? 1 : 0,
      meetingOperator ? 1 : 0,
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
    'INSERT OR REPLACE INTO permissions (userId, scopeType, scopeId, access, chat) VALUES (?, ?, ?, ?, ?)'
  );
  for (const p of Array.isArray(permissions) ? permissions : []) {
    if (!p?.scopeType || !p?.scopeId || !p?.access) continue;
    insertPerm.run(id, p.scopeType, p.scopeId, meetingOperator ? 'ro' : p.access, p?.chat ? 1 : 0);
  }
  writeAuditLog(db, {
    level: 'important',
    event: 'user_created',
    userId: req.userId,
    username: req.username,
    scopeType: 'user',
    scopeId: id,
    ...requestMeta(req),
      details: { username: normalizedUsername, isAdmin: !!isAdmin, isMeetingOperator: meetingOperator, canManageBusinessPartners: !!canManageBusinessPartners, permissions: Array.isArray(permissions) ? permissions.length : 0 }
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
    .prepare('SELECT id, username, isAdmin, isSuperAdmin, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, disabled, language, firstName, lastName, phone, email FROM users WHERE id = ?')
    .get(userId);
  if (!target) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (target.isSuperAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Cannot modify superadmin' });
    return;
  }
  const { firstName, lastName, phone, email, isAdmin, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, disabled, language, permissions } = req.body || {};
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
  const meetingOperator = !!isMeetingOperator && !isAdmin;
  db.prepare(
    'UPDATE users SET isAdmin = ?, canCreateMeetings = ?, canManageBusinessPartners = ?, isMeetingOperator = ?, disabled = ?, language = COALESCE(?, language), firstName = ?, lastName = ?, phone = ?, email = ?, updatedAt = ? WHERE id = ?'
  ).run(
    isAdmin ? 1 : 0,
    meetingOperator ? 1 : canCreateMeetings === undefined ? (Number(target.canCreateMeetings || 1) ? 1 : 0) : canCreateMeetings ? 1 : 0,
    canManageBusinessPartners === undefined ? (Number(target.canManageBusinessPartners || 0) ? 1 : 0) : canManageBusinessPartners ? 1 : 0,
    meetingOperator ? 1 : 0,
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
      'INSERT OR REPLACE INTO permissions (userId, scopeType, scopeId, access, chat) VALUES (?, ?, ?, ?, ?)'
    );
    for (const p of permissions) {
      if (!p?.scopeType || !p?.scopeId || !p?.access) continue;
      insertPerm.run(userId, p.scopeType, p.scopeId, meetingOperator ? 'ro' : p.access, p?.chat ? 1 : 0);
    }
  }
  const changes = [];
  if (typeof isAdmin === 'boolean' && Number(target.isAdmin) !== (isAdmin ? 1 : 0)) changes.push('isAdmin');
  if (typeof canCreateMeetings === 'boolean' && Number(target.canCreateMeetings || 1) !== (canCreateMeetings ? 1 : 0)) changes.push('canCreateMeetings');
  if (typeof canManageBusinessPartners === 'boolean' && Number(target.canManageBusinessPartners || 0) !== (canManageBusinessPartners ? 1 : 0)) changes.push('canManageBusinessPartners');
  if (typeof isMeetingOperator === 'boolean' && Number(target.isMeetingOperator || 0) !== (meetingOperator ? 1 : 0)) changes.push('isMeetingOperator');
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

// Client chat
const CHAT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const CHAT_MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;
// Voice notes (recorded in-app) can be larger than generic attachments.
// They are still bounded to avoid huge base64 JSON payloads.
const CHAT_VOICE_MAX_ATTACHMENT_BYTES = (() => {
  const raw = Number(readEnv('PLIXMAP_CHAT_MAX_VOICE_MB') || '');
  return Number.isFinite(raw) && raw > 0 ? raw * 1024 * 1024 : 40 * 1024 * 1024;
})();
const CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES = CHAT_VOICE_MAX_ATTACHMENT_BYTES;
const CHAT_MAX_ATTACHMENTS = 10;
const CHAT_ALLOWED_REACTIONS = new Set(['👍', '👎', '❤️', '😂', '😮', '😢', '🙏']);
const chatVoiceExts = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm']);
const chatAllowedExts = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'gif',
  'webp',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
  'rar',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'mp4',
  'webm',
  'mov'
]);

const chatExtForMime = (mime) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/pjpeg') return 'jpg';
  if (m === 'image/jpg') return 'jpg';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/webp') return 'webp';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'application/msword') return 'doc';
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (m === 'application/vnd.ms-excel') return 'xls';
  if (m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (m === 'application/vnd.ms-powerpoint') return 'ppt';
  if (m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (m === 'application/zip') return 'zip';
  if (m === 'application/x-zip-compressed') return 'zip';
  if (m === 'application/vnd.rar') return 'rar';
  if (m === 'application/x-rar-compressed') return 'rar';
  if (m === 'audio/mpeg') return 'mp3';
  if (m === 'audio/mp3') return 'mp3';
  if (m === 'audio/wav') return 'wav';
  if (m === 'audio/x-wav') return 'wav';
  if (m === 'audio/wave') return 'wav';
  if (m === 'audio/mp4') return 'm4a';
  if (m === 'audio/x-m4a') return 'm4a';
  if (m === 'audio/aac') return 'aac';
  if (m === 'audio/ogg') return 'ogg';
  if (m === 'audio/webm') return 'webm';
  if (m === 'video/mp4') return 'mp4';
  if (m === 'video/webm') return 'webm';
  if (m === 'video/quicktime') return 'mov';
  return null;
};

const chatExtFromFilename = (name) => {
  const base = String(name || '').trim();
  const idx = base.lastIndexOf('.');
  if (idx === -1) return null;
  const ext = base.slice(idx + 1).toLowerCase();
  if (!ext) return null;
  return ext;
};

const normalizeChatAttachmentList = (raw) => {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue;
    const url = String(a.url || '');
    if (!url || !url.startsWith('/uploads/')) continue;
    out.push({
      name: String(a.name || '').slice(0, 200),
      url,
      mime: String(a.mime || ''),
      sizeBytes: Number(a.sizeBytes) || 0
    });
  }
  return out;
};

const validateChatAttachmentInput = (a) => {
  const name = String(a?.name || '').trim();
  const dataUrl = String(a?.dataUrl || '').trim();
  if (!name || !dataUrl) return { ok: false, reason: 'invalid' };
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false, reason: 'invalid' };
  const mime = String(parsed.mime || '').toLowerCase();
  const sizeBytes = base64SizeBytes(parsed.base64 || '');
  const extFromMime = chatExtForMime(mime);
  const extFromName = chatExtFromFilename(name);
  const ext = extFromMime || extFromName;
  if (!ext || !chatAllowedExts.has(ext)) return { ok: false, reason: 'type', mime, ext };
  const isVoice = name.toLowerCase().startsWith('voice-') && chatVoiceExts.has(ext);
  const maxBytes = isVoice ? CHAT_VOICE_MAX_ATTACHMENT_BYTES : CHAT_MAX_ATTACHMENT_BYTES;
  if (sizeBytes > maxBytes) return { ok: false, reason: 'size', maxBytes, sizeBytes };
  // Accept known mimes OR generic octet-stream when extension is allowlisted.
  if (extFromMime === null && mime !== 'application/octet-stream' && mime !== '') {
    // Some browsers return empty mime; FileReader usually provides application/octet-stream for unknown types.
    // We only allow unknown mimes as octet-stream.
    return { ok: false, reason: 'mime', mime, ext };
  }
  return { ok: true, name, dataUrl, mime, sizeBytes, ext, isVoice };
};

const externalizeChatAttachmentDataUrl = (name, dataUrl, ext) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  // Validate again with the original name so voice-note size rules stay consistent.
  const validation = validateChatAttachmentInput({ name, dataUrl });
  if (!validation.ok) return null;
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

const normalizeChatMessageRow = (r) => {
  const deleted = Number(r.deleted) === 1;
  const attachments = deleted ? [] : normalizeChatAttachmentList(r.attachmentsJson);
  const starredBy = (() => {
    const raw = deleted ? [] : r.starredByJson;
    if (!raw) return [];
    let parsed = raw;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    const uniq = new Set();
    for (const v of parsed) {
      const id = String(v || '').trim();
      if (!id) continue;
      uniq.add(id);
    }
    return Array.from(uniq);
  })();
  const reactions = (() => {
    const raw = deleted ? {} : r.reactionsJson;
    if (!raw) return {};
    let parsed = raw;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return {};
      }
    }
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [emoji, users] of Object.entries(parsed)) {
      if (!CHAT_ALLOWED_REACTIONS.has(String(emoji))) continue;
      if (!Array.isArray(users)) continue;
      const uniq = new Set();
      for (const v of users) {
        const id = String(v || '').trim();
        if (!id) continue;
        uniq.add(id);
      }
      if (uniq.size) out[String(emoji)] = Array.from(uniq);
    }
    return out;
  })();
  return {
    id: String(r.id),
    clientId: String(r.clientId),
    userId: String(r.userId),
    username: String(r.username || '').toLowerCase(),
    avatarUrl: String(r.avatarUrl || ''),
    replyToId: r.replyToId ? String(r.replyToId) : null,
    attachments,
    starredBy,
    reactions,
    text: deleted ? '' : String(r.text || ''),
    deleted,
    deletedAt: r.deletedAt ? Number(r.deletedAt) : null,
    deletedById: r.deletedById ? String(r.deletedById) : null,
    editedAt: r.editedAt ? Number(r.editedAt) : null,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt)
  };
};

const dmThreadIdForUsers = (a, b) => {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x || !y) return null;
  const [u1, u2] = x < y ? [x, y] : [y, x];
  return `dm:${u1}:${u2}`;
};

const parseDmThreadId = (threadId) => {
  const s = String(threadId || '').trim();
  if (!s.startsWith('dm:')) return null;
  const parts = s.slice(3).split(':').map((p) => String(p || '').trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const [a, b] = parts[0] < parts[1] ? [parts[0], parts[1]] : [parts[1], parts[0]];
  return { a, b, pairKey: `${a}:${b}`, threadId: `dm:${a}:${b}` };
};

const userHasBlocked = (blockerId, blockedId) => {
  try {
    const row = db.prepare('SELECT 1 FROM user_blocks WHERE blockerId = ? AND blockedId = ?').get(blockerId, blockedId);
    return !!row;
  } catch {
    return false;
  }
};

const normalizeDmChatMessageRow = (r) => {
  if (!r) return null;
  const base = normalizeChatMessageRow({
    ...r,
    clientId: `dm:${String(r.pairKey || '').trim()}`,
    userId: String(r.fromUserId || '')
  });
  if (!base) return null;
  return {
    ...base,
    clientId: `dm:${String(r.pairKey || '').trim()}`,
    userId: String(r.fromUserId || ''),
    toUserId: String(r.toUserId || ''),
    deliveredAt: r.deliveredAt ? Number(r.deliveredAt) : null,
    readAt: r.readAt ? Number(r.readAt) : null
  };
};

const findChatMessageById = (id) => {
  const mid = String(id || '').trim();
  if (!mid) return null;
  const clientRow = db
    .prepare('SELECT id, clientId, userId, deleted, createdAt FROM client_chat_messages WHERE id = ?')
    .get(mid);
  if (clientRow) return { kind: 'client', row: clientRow };
  const dmRow = db
    .prepare('SELECT id, pairKey, fromUserId, toUserId, deleted, createdAt FROM dm_chat_messages WHERE id = ?')
    .get(mid);
  if (dmRow) return { kind: 'dm', row: dmRow };
  return null;
};

const deliverPendingDmMessagesToUser = (userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return 0;
  const now = Date.now();
  let delivered = 0;
  let rows = [];
  try {
    rows = db
      .prepare(
        `SELECT id, pairKey, fromUserId, toUserId
         FROM dm_chat_messages
         WHERE toUserId = ? AND deleted = 0 AND deliveredAt IS NULL
         ORDER BY createdAt ASC
         LIMIT 200`
      )
      .all(uid);
  } catch {
    return 0;
  }
  for (const r of rows || []) {
    const fromUserId = String(r.fromUserId || '').trim();
    const toUserId = String(r.toUserId || '').trim();
    const pairKey = String(r.pairKey || '').trim();
    if (!fromUserId || !toUserId || !pairKey) continue;
    if (toUserId !== uid) continue;
    // If the recipient blocked the sender, keep it undelivered forever (1 gray tick on sender).
    if (userHasBlocked(toUserId, fromUserId)) continue;
    try {
      db.prepare('UPDATE dm_chat_messages SET deliveredAt = ?, updatedAt = ? WHERE id = ? AND deliveredAt IS NULL').run(now, now, String(r.id));
      const updated = db
        .prepare(
          `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
           FROM dm_chat_messages
           WHERE id = ?`
        )
        .get(String(r.id));
      const message = normalizeDmChatMessageRow(updated);
      const threadId = `dm:${pairKey}`;
      sendToUser(toUserId, { type: 'dm_chat_new', threadId, message, backfill: true });
      sendToUser(fromUserId, { type: 'dm_chat_update', threadId, message, receipt: true });
      delivered += 1;
    } catch {
      // ignore single row
    }
  }
  return delivered;
};

const getClientNameById = (clientId) => {
  const state = readState();
  const c = (state.clients || []).find((x) => x?.id === clientId);
  return c?.shortName || c?.name || clientId;
};

app.get('/api/chat/unread', requireAuth, (req, res) => {
  const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  const allowedClientIds = Array.from(getChatClientIdsForUser(req.userId, isAdmin));
  const reads = db.prepare('SELECT clientId, lastReadAt FROM client_chat_reads WHERE userId = ?').all(req.userId);
  const lastReadAtByClient = new Map();
  for (const r of reads || []) lastReadAtByClient.set(String(r.clientId), Number(r.lastReadAt) || 0);
  const countStmt = db.prepare('SELECT COUNT(1) as c FROM client_chat_messages WHERE clientId = ? AND deleted = 0 AND createdAt > ?');
  const out = {};
  for (const clientId of allowedClientIds) {
    const lastReadAt = lastReadAtByClient.get(clientId) || 0;
    out[clientId] = Number(countStmt.get(clientId, lastReadAt)?.c || 0);
  }

  // DM unread (per threadId).
  try {
    const dmRows = db
      .prepare(
        `SELECT pairKey, COUNT(1) as c
         FROM dm_chat_messages
         WHERE toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL
         GROUP BY pairKey`
      )
      .all(req.userId);
    for (const r of dmRows || []) {
      const key = String(r.pairKey || '').trim();
      if (!key) continue;
      out[`dm:${key}`] = Number(r.c || 0);
    }
  } catch {
    // ignore: table may not exist yet on older DBs
  }
  res.json({ unreadByClientId: out });
});

app.get('/api/chat/unread-senders', requireAuth, (req, res) => {
  const senderIds = new Set();
  const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;

  // Group chats (client).
  try {
    const allowedClientIds = Array.from(getChatClientIdsForUser(req.userId, isAdmin));
    const reads = db.prepare('SELECT clientId, lastReadAt FROM client_chat_reads WHERE userId = ?').all(req.userId);
    const lastReadAtByClient = new Map();
    for (const r of reads || []) lastReadAtByClient.set(String(r.clientId), Number(r.lastReadAt) || 0);
    const stmt = db.prepare(
      `SELECT DISTINCT userId
       FROM client_chat_messages
       WHERE clientId = ? AND deleted = 0 AND createdAt > ? AND userId != ?`
    );
    for (const clientId of allowedClientIds) {
      const lastReadAt = lastReadAtByClient.get(clientId) || 0;
      const rows = stmt.all(clientId, lastReadAt, req.userId);
      for (const r of rows || []) {
        if (!r?.userId) continue;
        senderIds.add(String(r.userId));
      }
    }
  } catch {}

  // DMs (only messages that were actually delivered).
  try {
    const rows = db
      .prepare(
        `SELECT DISTINCT fromUserId
         FROM dm_chat_messages
         WHERE toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL`
      )
      .all(req.userId);
    for (const r of rows || []) {
      if (!r?.fromUserId) continue;
      senderIds.add(String(r.fromUserId));
    }
  } catch {}

  res.json({ count: senderIds.size, senderIds: Array.from(senderIds) });
});

app.get('/api/chat/dm/contacts', requireAuth, (req, res) => {
  const meId = req.userId;
  const meIsAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  const meClients = getChatClientIdsForUser(meId, meIsAdmin);

  const onlineIds = new Set();
  for (const info of wsClientInfo.values()) {
    if (info?.userId) onlineIds.add(String(info.userId));
  }

  const lastDmAtByPair = new Map();
  try {
    const rows = db
      .prepare(
        `SELECT pairKey, MAX(createdAt) as lastMessageAt
         FROM dm_chat_messages
         WHERE (fromUserId = ? OR toUserId = ?) AND deleted = 0
         GROUP BY pairKey`
      )
      .all(meId, meId);
    for (const r of rows || []) {
      const key = String(r.pairKey || '').trim();
      if (!key) continue;
      lastDmAtByPair.set(key, Number(r.lastMessageAt) || 0);
    }
  } catch {}

  const blockedByMe = new Set();
  const blockedMe = new Set();
  try {
    const rows = db.prepare('SELECT blockerId, blockedId FROM user_blocks WHERE blockerId = ? OR blockedId = ?').all(meId, meId);
    for (const r of rows || []) {
      if (String(r.blockerId) === meId && r.blockedId) blockedByMe.add(String(r.blockedId));
      if (String(r.blockedId) === meId && r.blockerId) blockedMe.add(String(r.blockerId));
    }
  } catch {}

  const dmHistoryOtherIds = new Set();
  try {
    const rows = db
      .prepare(
        `SELECT DISTINCT
           CASE WHEN fromUserId = ? THEN toUserId ELSE fromUserId END as otherId
         FROM dm_chat_messages
         WHERE fromUserId = ? OR toUserId = ?`
      )
      .all(meId, meId, meId);
    for (const r of rows || []) {
      const id = String(r.otherId || '').trim();
      if (id && id !== meId) dmHistoryOtherIds.add(id);
    }
  } catch {}

  const state = readState();
  const clientById = new Map();
  for (const c of state?.clients || []) {
    if (!c?.id) continue;
    clientById.set(String(c.id), { id: String(c.id), name: c.shortName || c.name || String(c.id), logoUrl: String(c.logoUrl || '') });
  }

  const users = db
    .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users ORDER BY username ASC')
    .all()
    .filter((u) => Number(u.disabled) !== 1)
    .map((u) => {
      const id = String(u.id);
      const normalizedUsername = String(u.username || '').toLowerCase();
      return {
        id,
        username: normalizedUsername,
        firstName: String(u.firstName || ''),
        lastName: String(u.lastName || ''),
        avatarUrl: String(u.avatarUrl || ''),
        isAdmin: !!u.isAdmin,
        isSuperAdmin: !!u.isSuperAdmin && normalizedUsername === 'superadmin',
        lastOnlineAt: u.lastOnlineAt ? Number(u.lastOnlineAt) : null
      };
    })
    .filter((u) => u.id !== meId)
    .map((u) => {
      const pairKey = u.id && meId ? (String(meId) < String(u.id) ? `${meId}:${u.id}` : `${u.id}:${meId}`) : '';
      const lastMessageAt = pairKey ? Number(lastDmAtByPair.get(pairKey) || 0) || 0 : 0;
      const targetClients = getChatClientIdsForUser(u.id, !!u.isAdmin || !!u.isSuperAdmin);
      const common = [];
      for (const id of meClients) {
        if (!targetClients.has(id)) continue;
        const meta = clientById.get(String(id));
        if (meta) common.push(meta);
      }
      common.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      const hasCommon = common.length > 0;
      const hasHistory = dmHistoryOtherIds.has(u.id);
      return {
        ...u,
        online: onlineIds.has(u.id),
        commonClients: common,
        canChat: hasCommon,
        readOnly: !hasCommon && hasHistory,
        hasHistory,
        lastMessageAt: lastMessageAt || null,
        blockedByMe: blockedByMe.has(u.id),
        blockedMe: blockedMe.has(u.id)
      };
    })
    // Only show users with common customers, plus existing DMs (read-only).
    .filter((u) => u.canChat || u.hasHistory);

  res.json({ users });
});

app.post('/api/chat/blocks/:id', requireAuth, (req, res) => {
  const targetId = String(req.params.id || '').trim();
  if (!targetId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  if (targetId === req.userId) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const now = Date.now();
  try {
    db.prepare(
      `INSERT INTO user_blocks (blockerId, blockedId, createdAt)
       VALUES (?, ?, ?)
       ON CONFLICT(blockerId, blockedId) DO UPDATE SET createdAt = excluded.createdAt`
    ).run(req.userId, targetId, now);
  } catch {
    res.status(500).json({ error: 'Failed' });
    return;
  }
  res.json({ ok: true });
});

app.delete('/api/chat/blocks/:id', requireAuth, (req, res) => {
  const targetId = String(req.params.id || '').trim();
  if (!targetId) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  if (targetId === req.userId) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    db.prepare('DELETE FROM user_blocks WHERE blockerId = ? AND blockedId = ?').run(req.userId, targetId);
  } catch {
    res.status(500).json({ error: 'Failed' });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/chat/:clientId/messages', requireAuth, (req, res) => {
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }

  const dm = parseDmThreadId(clientId);
  if (dm) {
    if (req.userId !== dm.a && req.userId !== dm.b) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const otherUserId = req.userId === dm.a ? dm.b : dm.a;
    const other = db
      .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users WHERE id = ?')
      .get(otherUserId);
    if (!other || Number(other.disabled) === 1) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const meIsAdmin = !!req.isAdmin || !!req.isSuperAdmin;
    const otherIsAdmin = !!other.isAdmin || !!other.isSuperAdmin;
    const myClients = getChatClientIdsForUser(req.userId, meIsAdmin);
    const otherClients = getChatClientIdsForUser(String(other.id), otherIsAdmin);
    const commonIds = [];
    for (const id of myClients) if (otherClients.has(id)) commonIds.push(String(id));
    const canChat = commonIds.length > 0 || meIsAdmin;

    const hasHistory = (() => {
      try {
        const row = db
          .prepare('SELECT 1 FROM dm_chat_messages WHERE pairKey = ? AND (fromUserId = ? OR toUserId = ?) LIMIT 1')
          .get(dm.pairKey, req.userId, req.userId);
        return !!row;
      } catch {
        return false;
      }
    })();

    if (!canChat && !hasHistory) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const state = readState();
    const nameByClientId = new Map();
    const logoByClientId = new Map();
    for (const c of state?.clients || []) {
      if (!c?.id) continue;
      nameByClientId.set(String(c.id), c.shortName || c.name || String(c.id));
      logoByClientId.set(String(c.id), String(c.logoUrl || ''));
    }
    const commonClients = commonIds
      .map((id) => ({ id, name: nameByClientId.get(id) || id, logoUrl: logoByClientId.get(id) || '' }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
    const rows = db
      .prepare(
        `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
         FROM dm_chat_messages
         WHERE pairKey = ?
         ORDER BY createdAt ASC
         LIMIT ?`
      )
      .all(dm.pairKey, limit)
      .map(normalizeDmChatMessageRow)
      .filter(Boolean);

    const normalizedUsername = String(other.username || '').toLowerCase();
    const displayName = `${String(other.firstName || '').trim()} ${String(other.lastName || '').trim()}`.trim() || normalizedUsername;
    res.json({
      clientId: dm.threadId,
      clientName: displayName,
      lastReadAt: 0,
      messages: rows,
      dm: {
        otherUserId,
        other: {
          id: String(other.id),
          username: normalizedUsername,
          firstName: String(other.firstName || ''),
          lastName: String(other.lastName || ''),
          avatarUrl: String(other.avatarUrl || ''),
          lastOnlineAt: other.lastOnlineAt ? Number(other.lastOnlineAt) : null
        },
        commonClients,
        canChat: !!canChat,
        readOnly: !canChat,
        blockedByMe: userHasBlocked(req.userId, otherUserId),
        blockedMe: userHasBlocked(otherUserId, req.userId)
      }
    });
    return;
  }

  const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  if (!userCanChatClient(req.userId, isAdmin, clientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
  const rows = db
    .prepare(
      `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
       FROM client_chat_messages
       WHERE clientId = ?
       ORDER BY createdAt ASC
       LIMIT ?`
    )
    .all(clientId, limit)
    .map(normalizeChatMessageRow);
  const readRow = db.prepare('SELECT lastReadAt FROM client_chat_reads WHERE userId = ? AND clientId = ?').get(req.userId, clientId);
  res.json({ clientId, clientName: getClientNameById(clientId), lastReadAt: Number(readRow?.lastReadAt || 0) || 0, messages: rows });
});

app.get('/api/chat/:clientId/members', requireAuth, (req, res) => {
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }

  const dm = parseDmThreadId(clientId);
  if (dm) {
    if (req.userId !== dm.a && req.userId !== dm.b) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const otherUserId = req.userId === dm.a ? dm.b : dm.a;
    const other = db
      .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users WHERE id = ?')
      .get(otherUserId);
    if (!other || Number(other.disabled) === 1) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const meIsAdmin = !!req.isAdmin || !!req.isSuperAdmin;
    const otherIsAdmin = !!other.isAdmin || !!other.isSuperAdmin;
    const myClients = getChatClientIdsForUser(req.userId, meIsAdmin);
    const otherClients = getChatClientIdsForUser(String(other.id), otherIsAdmin);
    let hasCommon = false;
    for (const id of myClients) {
      if (otherClients.has(id)) {
        hasCommon = true;
        break;
      }
    }
    const readOnly = !hasCommon && !meIsAdmin;

    const onlineIds = new Set();
    for (const info of wsClientInfo.values()) {
      if (info?.userId) onlineIds.add(String(info.userId));
    }

    const normalize = (u) => {
      const normalizedUsername = String(u.username || '').toLowerCase();
      return {
        id: String(u.id),
        username: normalizedUsername,
        firstName: String(u.firstName || ''),
        lastName: String(u.lastName || ''),
        avatarUrl: String(u.avatarUrl || ''),
        online: readOnly ? false : onlineIds.has(String(u.id)),
        lastOnlineAt: readOnly ? null : u.lastOnlineAt ? Number(u.lastOnlineAt) : null,
        lastReadAt: 0
      };
    };

    const meRow = db.prepare('SELECT id, username, firstName, lastName, avatarUrl, lastOnlineAt FROM users WHERE id = ?').get(req.userId);
    res.json({
      clientId: dm.threadId,
      kind: 'dm',
      readOnly,
      users: [meRow ? normalize(meRow) : { id: req.userId, username: req.username, firstName: '', lastName: '', avatarUrl: '', online: true, lastOnlineAt: Date.now(), lastReadAt: 0 }, normalize(other)]
    });
    return;
  }

  const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  if (!userCanChatClient(req.userId, isAdmin, clientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const maps = getClientScopeMaps();
  if (!maps.clientIds.has(clientId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const adminUserIds = new Set(
    db
      .prepare("SELECT id FROM users WHERE disabled = 0 AND isAdmin = 1")
      .all()
      .map((r) => String(r.id))
  );

  const perms = db.prepare('SELECT userId, scopeType, scopeId FROM permissions WHERE chat = 1').all();
  const memberUserIds = new Set();
  for (const id of adminUserIds) memberUserIds.add(id);
  for (const p of perms || []) {
    const userId = String(p.userId || '');
    if (!userId) continue;
    if (p.scopeType === 'client') {
      if (String(p.scopeId) === clientId) memberUserIds.add(userId);
      continue;
    }
    if (p.scopeType === 'site') {
      const cid = maps.siteToClient.get(String(p.scopeId || ''));
      if (cid === clientId) memberUserIds.add(userId);
      continue;
    }
    if (p.scopeType === 'plan') {
      const cid = maps.planToClient.get(String(p.scopeId || ''));
      if (cid === clientId) memberUserIds.add(userId);
      continue;
    }
  }

  // Ensure requester is present.
  memberUserIds.add(req.userId);

  const onlineIds = new Set();
  for (const info of wsClientInfo.values()) {
    if (info?.userId) onlineIds.add(String(info.userId));
  }

  const users = db
    .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users')
    .all()
    .filter((u) => Number(u.disabled) !== 1)
    .map((u) => {
      const normalizedUsername = String(u.username || '').toLowerCase();
      return {
        id: String(u.id),
        username: normalizedUsername,
        firstName: String(u.firstName || ''),
        lastName: String(u.lastName || ''),
        avatarUrl: String(u.avatarUrl || ''),
        isAdmin: !!u.isAdmin,
        isSuperAdmin: !!u.isSuperAdmin && normalizedUsername === 'superadmin',
        online: onlineIds.has(String(u.id)),
        lastOnlineAt: u.lastOnlineAt ? Number(u.lastOnlineAt) : null
      };
    })
    .filter((u) => memberUserIds.has(u.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  const reads = db.prepare('SELECT userId, lastReadAt FROM client_chat_reads WHERE clientId = ?').all(clientId);
  const lastReadAtByUserId = new Map();
  for (const r of reads || []) lastReadAtByUserId.set(String(r.userId), Number(r.lastReadAt) || 0);
  const usersWithRead = users.map((u) => ({ ...u, lastReadAt: lastReadAtByUserId.get(u.id) || 0 }));

  res.json({ clientId, users: usersWithRead });
});

app.post('/api/chat/:clientId/read', requireAuth, rateByUser('chat_read', 60 * 1000, 600), (req, res) => {
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }

  const dm = parseDmThreadId(clientId);
  if (dm) {
    if (req.userId !== dm.a && req.userId !== dm.b) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const otherUserId = req.userId === dm.a ? dm.b : dm.a;
    const now = Date.now();
    let ids = [];
    try {
      ids = db
        .prepare(
          `SELECT id
           FROM dm_chat_messages
           WHERE pairKey = ? AND toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL
           ORDER BY createdAt ASC
           LIMIT 800`
        )
        .all(dm.pairKey, req.userId)
        .map((r) => String(r.id));
      db.prepare(
        `UPDATE dm_chat_messages
         SET readAt = ?, updatedAt = ?
         WHERE pairKey = ? AND toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL`
      ).run(now, now, dm.pairKey, req.userId);
    } catch {
      res.status(500).json({ error: 'Failed' });
      return;
    }
    if (ids.length) {
      sendToUser(otherUserId, { type: 'dm_chat_read', threadId: dm.threadId, messageIds: ids, readAt: now });
    }
    res.json({ ok: true, lastReadAt: now });
    return;
  }

  const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  if (!userCanChatClient(req.userId, isAdmin, clientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const now = Date.now();
  db.prepare(
    `INSERT INTO client_chat_reads (userId, clientId, lastReadAt)
     VALUES (?, ?, ?)
     ON CONFLICT(userId, clientId) DO UPDATE SET lastReadAt = excluded.lastReadAt`
  ).run(req.userId, clientId, now);
  broadcastToChatClient(clientId, { type: 'client_chat_read', clientId, userId: req.userId, lastReadAt: now });
  res.json({ ok: true, lastReadAt: now });
});

app.post('/api/chat/:clientId/messages', requireAuth, rateByUser('chat_send', 60 * 1000, 120), (req, res) => {
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }

  const dm = parseDmThreadId(clientId);
  if (dm) {
    if (req.userId !== dm.a && req.userId !== dm.b) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const otherUserId = req.userId === dm.a ? dm.b : dm.a;
    const other = db.prepare('SELECT id, username, avatarUrl, isAdmin, isSuperAdmin, disabled FROM users WHERE id = ?').get(otherUserId);
    if (!other || Number(other.disabled) === 1) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const meIsAdmin = !!req.isAdmin || !!req.isSuperAdmin;
    const otherIsAdmin = !!other.isAdmin || !!other.isSuperAdmin;
    const myClients = getChatClientIdsForUser(req.userId, meIsAdmin);
    const otherClients = getChatClientIdsForUser(String(other.id), otherIsAdmin);
    let hasCommon = false;
    for (const id of myClients) {
      if (otherClients.has(id)) {
        hasCommon = true;
        break;
      }
    }
    if (!hasCommon && !meIsAdmin) {
      res.status(403).json({ error: 'Read-only' });
      return;
    }

    // Optional: if I blocked the other user, require unblock to send.
    if (userHasBlocked(req.userId, otherUserId)) {
      res.status(403).json({ error: 'Blocked' });
      return;
    }

    const text = typeof req.body?.text === 'string' ? String(req.body.text) : '';
    const trimmed = text.replace(/\r\n/g, '\n').trim();
    if (trimmed.length > 4000) {
      res.status(400).json({ error: 'Message too long' });
      return;
    }
    const attachmentsIn = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    const replyToId = typeof req.body?.replyToId === 'string' ? String(req.body.replyToId).trim() : '';
    if (!trimmed && (!attachmentsIn || !attachmentsIn.length)) {
      res.status(400).json({ error: 'Empty message' });
      return;
    }
    if (attachmentsIn.length > CHAT_MAX_ATTACHMENTS) {
      res.status(400).json({ error: 'Too many attachments' });
      return;
    }

    const attachments = [];
    let totalOtherBytes = 0;
    let totalVoiceBytes = 0;
    for (const a of attachmentsIn) {
      const v = validateChatAttachmentInput(a);
      if (!v.ok) {
        res.status(400).json({ error: 'Invalid attachment', ...v });
        return;
      }
      if (v.isVoice) totalVoiceBytes += Number(v.sizeBytes) || 0;
      else totalOtherBytes += Number(v.sizeBytes) || 0;
      if (totalOtherBytes > CHAT_MAX_TOTAL_ATTACHMENT_BYTES) {
        res.status(400).json({ error: 'Attachments too large', reason: 'total_size', maxBytes: CHAT_MAX_TOTAL_ATTACHMENT_BYTES, sizeBytes: totalOtherBytes });
        return;
      }
      if (totalVoiceBytes > CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES) {
        res.status(400).json({ error: 'Voice note too large', reason: 'voice_total_size', maxBytes: CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES, sizeBytes: totalVoiceBytes });
        return;
      }
      const url = externalizeChatAttachmentDataUrl(v.name, v.dataUrl, v.ext);
      if (!url) {
        res.status(400).json({ error: 'Failed to store attachment' });
        return;
      }
      attachments.push({ name: v.name.slice(0, 200), url, mime: v.mime, sizeBytes: v.sizeBytes });
    }

    const me = db.prepare('SELECT username, avatarUrl FROM users WHERE id = ?').get(req.userId);
    const now = Date.now();
    const id = crypto.randomUUID();
    if (replyToId) {
      const ok = db.prepare('SELECT id FROM dm_chat_messages WHERE id = ? AND pairKey = ?').get(replyToId, dm.pairKey);
      if (!ok) {
        res.status(400).json({ error: 'Invalid replyToId' });
        return;
      }
    }

    const recipientHasBlockedSender = userHasBlocked(otherUserId, req.userId);
    const recipientOnline = (() => {
      for (const info of wsClientInfo.values()) {
        if (info?.userId === otherUserId) return true;
      }
      return false;
    })();
    const deliveredAt = !recipientHasBlockedSender && recipientOnline ? now : null;

    db.prepare(
      `INSERT INTO dm_chat_messages (id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deliveredAt, readAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '{}', ?, 0, ?, NULL, ?, ?)`
    ).run(
      id,
      dm.pairKey,
      req.userId,
      otherUserId,
      String(me?.username || req.username || ''),
      String(me?.avatarUrl || ''),
      replyToId || null,
      JSON.stringify(attachments),
      trimmed,
      deliveredAt,
      now,
      now
    );

    const row = db
      .prepare(
        `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
         FROM dm_chat_messages
         WHERE id = ?`
      )
      .get(id);
    const message = normalizeDmChatMessageRow(row);

    // Always notify the sender (all active sockets).
    sendToUser(req.userId, { type: 'dm_chat_new', threadId: dm.threadId, message });
    // Notify recipient only if not blocked by them.
    if (!recipientHasBlockedSender) {
      if (deliveredAt) sendToUser(otherUserId, { type: 'dm_chat_new', threadId: dm.threadId, message });
    }
    res.json({ ok: true, message });
    return;
  }

  const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  if (!userCanChatClient(req.userId, isAdmin, clientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const text = typeof req.body?.text === 'string' ? String(req.body.text) : '';
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed.length > 4000) {
    res.status(400).json({ error: 'Message too long' });
    return;
  }
  const attachmentsIn = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const replyToId = typeof req.body?.replyToId === 'string' ? String(req.body.replyToId).trim() : '';
  if (!trimmed && (!attachmentsIn || !attachmentsIn.length)) {
    res.status(400).json({ error: 'Empty message' });
    return;
  }
  if (attachmentsIn.length > CHAT_MAX_ATTACHMENTS) {
    res.status(400).json({ error: 'Too many attachments' });
    return;
  }
  const attachments = [];
  let totalOtherBytes = 0;
  let totalVoiceBytes = 0;
  for (const a of attachmentsIn) {
    const v = validateChatAttachmentInput(a);
    if (!v.ok) {
      res.status(400).json({ error: 'Invalid attachment', ...v });
      return;
    }
    if (v.isVoice) totalVoiceBytes += Number(v.sizeBytes) || 0;
    else totalOtherBytes += Number(v.sizeBytes) || 0;
    if (totalOtherBytes > CHAT_MAX_TOTAL_ATTACHMENT_BYTES) {
      res.status(400).json({ error: 'Attachments too large', reason: 'total_size', maxBytes: CHAT_MAX_TOTAL_ATTACHMENT_BYTES, sizeBytes: totalOtherBytes });
      return;
    }
    if (totalVoiceBytes > CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES) {
      res.status(400).json({ error: 'Voice note too large', reason: 'voice_total_size', maxBytes: CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES, sizeBytes: totalVoiceBytes });
      return;
    }
    const url = externalizeChatAttachmentDataUrl(v.name, v.dataUrl, v.ext);
    if (!url) {
      res.status(400).json({ error: 'Failed to store attachment' });
      return;
    }
    attachments.push({ name: v.name.slice(0, 200), url, mime: v.mime, sizeBytes: v.sizeBytes });
  }
  const me = db.prepare('SELECT username, avatarUrl FROM users WHERE id = ?').get(req.userId);
  const now = Date.now();
  const id = crypto.randomUUID();
  if (replyToId) {
    const ok = db
      .prepare('SELECT id FROM client_chat_messages WHERE id = ? AND clientId = ?')
      .get(replyToId, clientId);
    if (!ok) {
      res.status(400).json({ error: 'Invalid replyToId' });
      return;
    }
  }
  db.prepare(
    `INSERT INTO client_chat_messages (id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '{}', ?, 0, ?, ?)`
  ).run(
    id,
    clientId,
    req.userId,
    String(me?.username || req.username || ''),
    String(me?.avatarUrl || ''),
    replyToId || null,
    JSON.stringify(attachments),
    trimmed,
    now,
    now
  );
  db.prepare(
    `INSERT INTO client_chat_reads (userId, clientId, lastReadAt)
     VALUES (?, ?, ?)
     ON CONFLICT(userId, clientId) DO UPDATE SET lastReadAt = excluded.lastReadAt`
  ).run(req.userId, clientId, now);

  const row = db
    .prepare(
      `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
       FROM client_chat_messages
       WHERE id = ?`
    )
    .get(id);
  const message = normalizeChatMessageRow(row);
  broadcastToChatClient(clientId, { type: 'client_chat_new', clientId, message });
  res.json({ ok: true, message });
});

app.put('/api/chat/messages/:id', requireAuth, rateByUser('chat_edit', 60 * 1000, 120), (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const text = typeof req.body?.text === 'string' ? String(req.body.text) : '';
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) {
    res.status(400).json({ error: 'Empty message' });
    return;
  }
  if (trimmed.length > 4000) {
    res.status(400).json({ error: 'Message too long' });
    return;
  }
  const hit = findChatMessageById(id);
  if (!hit) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const row = hit.row;
  if (Number(row.deleted) === 1) {
    res.status(400).json({ error: 'Deleted' });
    return;
  }
  const ownerId = hit.kind === 'client' ? String(row.userId) : String(row.fromUserId);
  if (ownerId !== req.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const createdAt = Number(row.createdAt) || 0;
  const now = Date.now();
  if (now - createdAt > 30 * 60 * 1000) {
    res.status(400).json({ error: 'Edit window expired' });
    return;
  }
  if (hit.kind === 'client') {
    db.prepare('UPDATE client_chat_messages SET text = ?, editedAt = ?, updatedAt = ? WHERE id = ?').run(trimmed, now, now, id);
    const updated = db
      .prepare(
        `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
         FROM client_chat_messages
         WHERE id = ?`
      )
      .get(id);
    const message = normalizeChatMessageRow(updated);
    broadcastToChatClient(String(row.clientId), { type: 'client_chat_update', clientId: String(row.clientId), message });
    res.json({ ok: true, message });
    return;
  }

  db.prepare('UPDATE dm_chat_messages SET text = ?, editedAt = ?, updatedAt = ? WHERE id = ?').run(trimmed, now, now, id);
  const updated = db
    .prepare(
      `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
       FROM dm_chat_messages
       WHERE id = ?`
    )
    .get(id);
  const message = normalizeDmChatMessageRow(updated);
  const threadId = `dm:${String(row.pairKey || '').trim()}`;
  sendToUser(String(row.fromUserId), { type: 'dm_chat_update', threadId, message });
  if (message?.deliveredAt && !userHasBlocked(String(row.toUserId), String(row.fromUserId))) {
    sendToUser(String(row.toUserId), { type: 'dm_chat_update', threadId, message });
  }
  res.json({ ok: true, message });
});

app.delete('/api/chat/messages/:id', requireAuth, rateByUser('chat_delete', 60 * 1000, 120), (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const hit = findChatMessageById(id);
  if (!hit) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const row = hit.row;
  if (Number(row.deleted) === 1) {
    res.json({ ok: true });
    return;
  }
  const isOwner = (hit.kind === 'client' ? String(row.userId) : String(row.fromUserId)) === req.userId;
  if (!isOwner && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const now = Date.now();
  if (hit.kind === 'client') {
    db.prepare('UPDATE client_chat_messages SET deleted = 1, deletedAt = ?, deletedById = ?, updatedAt = ? WHERE id = ?').run(
      now,
      req.userId,
      now,
      id
    );
    const updated = db
      .prepare(
        `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
         FROM client_chat_messages
         WHERE id = ?`
      )
      .get(id);
    const message = normalizeChatMessageRow(updated);
    broadcastToChatClient(String(row.clientId), { type: 'client_chat_update', clientId: String(row.clientId), message });
    res.json({ ok: true });
    return;
  }

  db.prepare('UPDATE dm_chat_messages SET deleted = 1, deletedAt = ?, deletedById = ?, updatedAt = ? WHERE id = ?').run(now, req.userId, now, id);
  const updated = db
    .prepare(
      `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
       FROM dm_chat_messages
       WHERE id = ?`
    )
    .get(id);
  const message = normalizeDmChatMessageRow(updated);
  const threadId = `dm:${String(row.pairKey || '').trim()}`;
  sendToUser(String(row.fromUserId), { type: 'dm_chat_update', threadId, message });
  if (message?.deliveredAt && !userHasBlocked(String(row.toUserId), String(row.fromUserId))) {
    sendToUser(String(row.toUserId), { type: 'dm_chat_update', threadId, message });
  }
  res.json({ ok: true });
});

app.post('/api/chat/messages/:id/star', requireAuth, rateByUser('chat_star', 60 * 1000, 240), (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  let kind = 'client';
  let row = db.prepare('SELECT id, clientId, deleted, starredByJson FROM client_chat_messages WHERE id = ?').get(id);
  if (!row) {
    kind = 'dm';
    row = db.prepare('SELECT id, pairKey, fromUserId, toUserId, deleted, deliveredAt, starredByJson FROM dm_chat_messages WHERE id = ?').get(id);
  }
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (Number(row.deleted) === 1) {
    res.status(400).json({ error: 'Deleted' });
    return;
  }
  if (kind === 'client') {
    const clientId = String(row.clientId);
    const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
    if (!userCanChatClient(req.userId, isAdmin, clientId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  } else {
    const isParticipant = String(row.fromUserId) === req.userId || String(row.toUserId) === req.userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }
  let list = [];
  try {
    const parsed = JSON.parse(String(row.starredByJson || '[]'));
    if (Array.isArray(parsed)) list = parsed;
  } catch {}
  const uniq = new Set(list.map((x) => String(x || '').trim()).filter(Boolean));
  const wantStar = typeof req.body?.star === 'boolean' ? !!req.body.star : !uniq.has(req.userId);
  if (wantStar) uniq.add(req.userId);
  else uniq.delete(req.userId);
  const now = Date.now();
  if (kind === 'client') {
    const clientId = String(row.clientId);
    db.prepare('UPDATE client_chat_messages SET starredByJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(Array.from(uniq)), now, id);
    const updated = db
      .prepare(
        `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
         FROM client_chat_messages
         WHERE id = ?`
      )
      .get(id);
    const message = normalizeChatMessageRow(updated);
    broadcastToChatClient(clientId, { type: 'client_chat_update', clientId, message });
    res.json({ ok: true, message });
    return;
  }

  db.prepare('UPDATE dm_chat_messages SET starredByJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(Array.from(uniq)), now, id);
  const updated = db
    .prepare(
      `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
       FROM dm_chat_messages
       WHERE id = ?`
    )
    .get(id);
  const message = normalizeDmChatMessageRow(updated);
  const threadId = `dm:${String(row.pairKey || '').trim()}`;
  sendToUser(String(row.fromUserId), { type: 'dm_chat_update', threadId, message });
  if (message?.deliveredAt && !userHasBlocked(String(row.toUserId), String(row.fromUserId))) {
    sendToUser(String(row.toUserId), { type: 'dm_chat_update', threadId, message });
  }
  res.json({ ok: true, message });
});

app.post('/api/chat/messages/:id/react', requireAuth, rateByUser('chat_react', 60 * 1000, 600), (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }
  const emoji = typeof req.body?.emoji === 'string' ? String(req.body.emoji) : '';
  if (!CHAT_ALLOWED_REACTIONS.has(emoji)) {
    res.status(400).json({ error: 'Invalid emoji' });
    return;
  }
  let kind = 'client';
  let row = db.prepare('SELECT id, clientId, deleted, reactionsJson FROM client_chat_messages WHERE id = ?').get(id);
  if (!row) {
    kind = 'dm';
    row = db.prepare('SELECT id, pairKey, fromUserId, toUserId, deleted, deliveredAt, reactionsJson FROM dm_chat_messages WHERE id = ?').get(id);
  }
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (Number(row.deleted) === 1) {
    res.status(400).json({ error: 'Deleted' });
    return;
  }
  if (kind === 'client') {
    const clientId = String(row.clientId);
    const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
    if (!userCanChatClient(req.userId, isAdmin, clientId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  } else {
    const isParticipant = String(row.fromUserId) === req.userId || String(row.toUserId) === req.userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }
  let parsed = {};
  try {
    const obj = JSON.parse(String(row.reactionsJson || '{}'));
    if (obj && typeof obj === 'object') parsed = obj;
  } catch {}

  // WhatsApp-like: one reaction per user per message. Clicking same emoji toggles off.
  let already = false;
  for (const [k, users] of Object.entries(parsed)) {
    if (!Array.isArray(users)) continue;
    const next = users.map((x) => String(x || '').trim()).filter(Boolean).filter((x) => x !== req.userId);
    if (String(k) === emoji && next.length !== users.length) already = true;
    parsed[k] = next;
  }
  if (!already) {
    const list = Array.isArray(parsed[emoji]) ? parsed[emoji] : [];
    const uniq = new Set(list.map((x) => String(x || '').trim()).filter(Boolean));
    uniq.add(req.userId);
    parsed[emoji] = Array.from(uniq);
  }
  // Drop empty keys and unknown emojis.
  for (const k of Object.keys(parsed)) {
    if (!CHAT_ALLOWED_REACTIONS.has(k)) {
      delete parsed[k];
      continue;
    }
    const users = parsed[k];
    if (!Array.isArray(users) || users.length === 0) delete parsed[k];
  }

  const now = Date.now();
  if (kind === 'client') {
    const clientId = String(row.clientId);
    db.prepare('UPDATE client_chat_messages SET reactionsJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(parsed), now, id);
    const updated = db
      .prepare(
        `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
         FROM client_chat_messages
         WHERE id = ?`
      )
      .get(id);
    const message = normalizeChatMessageRow(updated);
    broadcastToChatClient(clientId, { type: 'client_chat_update', clientId, message });
    res.json({ ok: true, message });
    return;
  }

  db.prepare('UPDATE dm_chat_messages SET reactionsJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(parsed), now, id);
  const updated = db
    .prepare(
      `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
       FROM dm_chat_messages
       WHERE id = ?`
    )
    .get(id);
  const message = normalizeDmChatMessageRow(updated);
  const threadId = `dm:${String(row.pairKey || '').trim()}`;
  sendToUser(String(row.fromUserId), { type: 'dm_chat_update', threadId, message });
  if (message?.deliveredAt && !userHasBlocked(String(row.toUserId), String(row.fromUserId))) {
    sendToUser(String(row.toUserId), { type: 'dm_chat_update', threadId, message });
  }
  res.json({ ok: true, message });
});

app.post('/api/chat/:clientId/clear', requireAuth, rateByUser('chat_clear', 10 * 60 * 1000, 30), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const maps = getClientScopeMaps();
  if (!maps.clientIds.has(clientId)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  db.prepare('DELETE FROM client_chat_messages WHERE clientId = ?').run(clientId);
  writeAuditLog(db, {
    level: 'important',
    event: 'client_chat_cleared',
    userId: req.userId,
    username: req.username,
    scopeType: 'client',
    scopeId: clientId,
    ...requestMeta(req),
    details: { clientName: getClientNameById(clientId) }
  });
  broadcastToChatClient(clientId, { type: 'client_chat_clear', clientId, clearedAt: Date.now() });
  res.json({ ok: true });
});

app.get('/api/chat/:clientId/export', requireAuth, (req, res) => {
  const clientId = String(req.params.clientId || '').trim();
  if (!clientId) {
    res.status(400).send('Missing clientId');
    return;
  }

  const dm = parseDmThreadId(clientId);
  if (dm) {
    if (req.userId !== dm.a && req.userId !== dm.b) {
      res.status(403).send('Forbidden');
      return;
    }
    const otherUserId = req.userId === dm.a ? dm.b : dm.a;
    const other = db.prepare('SELECT id, username, firstName, lastName, disabled FROM users WHERE id = ?').get(otherUserId);
    if (!other || Number(other.disabled) === 1) {
      res.status(404).send('Not found');
      return;
    }
    const normalizedUsername = String(other.username || '').toLowerCase();
    const title = `${String(other.firstName || '').trim()} ${String(other.lastName || '').trim()}`.trim() || normalizedUsername;

    const qf = String(req.query.format || 'txt').toLowerCase();
    const format = qf === 'json' ? 'json' : qf === 'html' ? 'html' : 'txt';
    const rows = db
      .prepare(
        `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
         FROM dm_chat_messages
         WHERE pairKey = ?
         ORDER BY createdAt ASC`
      )
      .all(dm.pairKey)
      .map(normalizeDmChatMessageRow)
      .filter(Boolean);

    const safeName = String(title || 'dm')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .slice(0, 40) || 'dm';
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.json\"`);
      res.send(JSON.stringify({ threadId: dm.threadId, title, exportedAt: Date.now(), messages: rows }, null, 2));
      return;
    }
    if (format === 'html') {
      const escapeHtml = (s) =>
        String(s || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;');
      const items = rows
        .map((m) => {
          const d = new Date(m.createdAt);
          const ts = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          const body = m.deleted ? '<em>Messaggio eliminato</em>' : escapeHtml(m.text).replace(/\n/g, '<br/>');
          const edited = m.editedAt && !m.deleted ? ' <span class="edited">(modificato)</span>' : '';
          const attachments = (m.attachments || []).length
            ? `<div class="attachments">${m.attachments
                .map((a) => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer">${escapeHtml(a.name || a.url)}</a>`)
                .join('')}</div>`
            : '';
          return `<div class="msg"><div class="meta"><span class="ts">[${escapeHtml(ts)}]</span> <strong>${escapeHtml(
            m.username
          )}</strong>${edited}</div><div class="body">${body}</div>${attachments}</div>`;
        })
        .join('\n');
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Chat ${escapeHtml(title)}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#0b1220; color:#e2e8f0; padding:24px;}
    .wrap{max-width:900px;margin:0 auto;}
    h1{font-size:18px;margin:0 0 8px 0;}
    .sub{font-size:12px;color:#94a3b8;margin:0 0 18px 0;}
    .msg{border:1px solid rgba(148,163,184,.22); background:rgba(15,23,42,.6); border-radius:14px; padding:12px 14px; margin:10px 0;}
    .meta{font-size:12px;color:#cbd5e1;margin-bottom:6px;}
    .ts{color:#94a3b8;}
    .edited{font-weight:700;color:#a7f3d0;}
    .body{font-size:14px;line-height:1.35;white-space:normal}
    .attachments{margin-top:8px; display:flex; flex-wrap:wrap; gap:8px;}
    .attachments a{display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.22); color:#e2e8f0; text-decoration:none;}
    .attachments a:hover{background:rgba(148,163,184,.12);}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Chat: ${escapeHtml(title)}</h1>
    <div class="sub">Export: ${escapeHtml(new Date().toISOString())}</div>
    ${items}
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.html\"`);
      res.send(html);
      return;
    }
    const lines = [];
    for (const m of rows) {
      const d = new Date(m.createdAt);
      const ts = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const body = m.deleted ? '(messaggio eliminato)' : m.text.replace(/\n/g, ' ');
      const edited = m.editedAt ? ' (modificato)' : '';
      const att = (m.attachments || []).length ? ` [allegati: ${(m.attachments || []).map((a) => a?.name || a?.url).join(', ')}]` : '';
      lines.push(`[${ts}] ${m.username}: ${body}${edited}${att}`);
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.txt\"`);
    res.send(lines.join('\n'));
    return;
  }

  const isAdmin = !!req.isAdmin || !!req.isSuperAdmin;
  if (!userCanChatClient(req.userId, isAdmin, clientId)) {
    res.status(403).send('Forbidden');
    return;
  }
  const qf = String(req.query.format || 'txt').toLowerCase();
  const format = qf === 'json' ? 'json' : qf === 'html' ? 'html' : 'txt';
  const rows = db
    .prepare(
      `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
       FROM client_chat_messages
       WHERE clientId = ?
       ORDER BY createdAt ASC`
    )
    .all(clientId)
    .map(normalizeChatMessageRow);

  const safeName = String(getClientNameById(clientId) || clientId)
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .slice(0, 40) || clientId;
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.json\"`);
    res.send(JSON.stringify({ clientId, clientName: getClientNameById(clientId), exportedAt: Date.now(), messages: rows }, null, 2));
    return;
  }
  if (format === 'html') {
    const escapeHtml = (s) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const items = rows
      .map((m) => {
        const d = new Date(m.createdAt);
        const ts = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const body = m.deleted ? '<em>Messaggio eliminato</em>' : escapeHtml(m.text).replace(/\n/g, '<br/>');
        const edited = m.editedAt && !m.deleted ? ' <span class="edited">(modificato)</span>' : '';
        const attachments = (m.attachments || []).length
          ? `<div class="attachments">${m.attachments
              .map((a) => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer">${escapeHtml(a.name || a.url)}</a>`)
              .join('')}</div>`
          : '';
        return `<div class="msg"><div class="meta"><span class="ts">[${escapeHtml(ts)}]</span> <strong>${escapeHtml(
          m.username
        )}</strong>${edited}</div><div class="body">${body}</div>${attachments}</div>`;
      })
      .join('\n');
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Chat ${escapeHtml(getClientNameById(clientId))}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#0b1220; color:#e2e8f0; padding:24px;}
    .wrap{max-width:900px;margin:0 auto;}
    h1{font-size:18px;margin:0 0 8px 0;}
    .sub{font-size:12px;color:#94a3b8;margin:0 0 18px 0;}
    .msg{border:1px solid rgba(148,163,184,.22); background:rgba(15,23,42,.6); border-radius:14px; padding:12px 14px; margin:10px 0;}
    .meta{font-size:12px;color:#cbd5e1;margin-bottom:6px;}
    .ts{color:#94a3b8;}
    .edited{font-weight:700;color:#a7f3d0;}
    .body{font-size:14px;line-height:1.35;white-space:normal}
    .attachments{margin-top:8px; display:flex; flex-wrap:wrap; gap:8px;}
    .attachments a{display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.22); color:#e2e8f0; text-decoration:none;}
    .attachments a:hover{background:rgba(148,163,184,.12);}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Chat: ${escapeHtml(getClientNameById(clientId))}</h1>
    <div class="sub">Export: ${escapeHtml(new Date().toISOString())}</div>
    ${items}
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.html\"`);
    res.send(html);
    return;
  }
  const lines = [];
  for (const m of rows) {
    const d = new Date(m.createdAt);
    const ts = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const body = m.deleted ? '(messaggio eliminato)' : m.text.replace(/\n/g, ' ');
    const edited = m.editedAt ? ' (modificato)' : '';
    const att = (m.attachments || []).length ? ` [allegati: ${(m.attachments || []).map((a) => a?.name || a?.url).join(', ')}]` : '';
    lines.push(`[${ts}] ${m.username}: ${body}${edited}${att}`);
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.txt\"`);
  res.send(lines.join('\n'));
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
  const readIndexHtml = () => {
    return fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  };
  const renderKioskIndexHtml = (roomId) => {
    const rid = encodeURIComponent(String(roomId || '').trim());
    let html = readIndexHtml();
    const kioskManifestHref = `/manifest-kiosk/${rid}.webmanifest`;
    if (html.includes('rel="manifest"')) {
      html = html.replace(/<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/i, `<link rel="manifest" href="${kioskManifestHref}">`);
    } else {
      html = html.replace(/<\/head>/i, `  <link rel="manifest" href="${kioskManifestHref}"></head>`);
    }
    return html;
  };

  app.get(/^\/meetingroom\/([^/]+)\/?$/, (req, res) => {
    try {
      const roomId = String(req.params?.[0] || '').trim();
      if (!roomId) return res.sendFile(path.join(distDir, 'index.html'));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(renderKioskIndexHtml(roomId));
    } catch {
      res.sendFile(path.join(distDir, 'index.html'));
    }
  });
  const distAssetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(distAssetsDir)) {
    app.use(
      '/assets',
      express.static(distAssetsDir, {
        fallthrough: false,
        maxAge: '1y',
        immutable: true
      })
    );
  }
  app.use(express.static(distDir, { maxAge: 0 }));
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distDir, 'index.html'));
  });
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
  try {
    db.prepare('UPDATE users SET lastOnlineAt = ? WHERE id = ?').run(Date.now(), auth.userId);
  } catch {}
  wsClientInfo.set(ws, {
    userId: auth.userId,
    username: auth.username,
    avatarUrl: auth.avatarUrl || '',
    ip: getWsClientIp(req),
    connectedAt: Date.now(),
    isAdmin: !!auth.isAdmin,
    isSuperAdmin: !!auth.isSuperAdmin,
    plans: new Map()
  });
  jsonSend(ws, { type: 'hello', userId: auth.userId, username: auth.username, avatarUrl: auth.avatarUrl || '' });
  if (auth.isAdmin || auth.isSuperAdmin) {
    jsonSend(ws, { type: 'meeting_pending_summary', pendingCount: pendingMeetingCount() });
  }
  // Deliver pending DM messages (turns 1 gray tick into 2 gray ticks when the recipient connects).
  deliverPendingDmMessagesToUser(auth.userId);
  emitGlobalPresence();

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
	      info.plans.set(planId, Date.now());

	      const state = readState();
	      const planPathMap = buildPlanPathMap(state.clients || []);
	      const path = planPathMap.get(planId);
	      const lock = getValidLock(planId) || null;
	      const grant = lock ? null : getValidGrant(planId) || null;
	      jsonSend(ws, {
	        type: 'lock_state',
	        planId,
	        lockedBy: lock ? { userId: lock.userId, username: lock.username, avatarUrl: lock.avatarUrl || '' } : null,
	        grant: grant
	          ? {
	              userId: grant.userId,
	              username: grant.username,
	              avatarUrl: grant.avatarUrl || '',
	              grantedAt: grant.grantedAt || null,
	              expiresAt: grant.expiresAt || null,
	              minutes: grant.minutes || null,
	              grantedBy: { userId: grant.grantedById || '', username: grant.grantedByName || '' }
	            }
	          : null,
	        meta: {
	          lastActionAt: lock?.lastActionAt || grant?.lastActionAt || null,
	          lastSavedAt: path?.lastSavedAt ?? null,
	          lastSavedRev: path?.lastSavedRev ?? ''
	        }
	      });
	      jsonSend(ws, { type: 'presence', planId, users: computePresence(planId) });

	      if (!!msg.wantLock) {
	        if (access !== 'rw') {
	          jsonSend(ws, { type: 'lock_denied', planId, lockedBy: null, grant: null });
	          emitPresence(planId);
	          return;
	        }
	        const existing = getValidLock(planId);
	        const activeGrant = existing ? null : getValidGrant(planId);
	        if (activeGrant && activeGrant.userId && activeGrant.userId !== info.userId) {
	          jsonSend(ws, {
	            type: 'lock_denied',
	            planId,
	            lockedBy: null,
	            grant: {
	              userId: activeGrant.userId,
	              username: activeGrant.username,
	              avatarUrl: activeGrant.avatarUrl || '',
	              grantedAt: activeGrant.grantedAt || null,
	              expiresAt: activeGrant.expiresAt || null,
	              minutes: activeGrant.minutes || null,
	              grantedBy: { userId: activeGrant.grantedById || '', username: activeGrant.grantedByName || '' }
	            }
	          });
	          emitPresence(planId);
	          return;
	        }
	        if (!existing || existing.userId === info.userId) {
	          const now = Date.now();
	          if (activeGrant && activeGrant.userId === info.userId) planLockGrants.delete(planId);
	          planLocks.set(planId, {
	            userId: info.userId,
	            username: info.username,
	            avatarUrl: info.avatarUrl || '',
	            acquiredAt: now,
	            ts: now,
	            lastActionAt: null,
	            dirty: false
	          });
	          writeAuditLog(db, { level: 'important', event: 'plan_lock_acquired', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId });
	          emitLockState(planId);
	        } else {
	          jsonSend(ws, {
	            type: 'lock_denied',
	            planId,
	            lockedBy: { userId: existing.userId, username: existing.username, avatarUrl: existing.avatarUrl || '' },
	            grant: null
	          });
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
      emitGlobalPresence();
	      return;
	    }

	    if (msg?.type === 'request_lock') {
	      const planId = String(msg.planId || '').trim();
	      if (!planId) return;
	      const access = getPlanAccessForUser(info.userId, planId);
	      if (access !== 'rw') {
	        jsonSend(ws, { type: 'lock_denied', planId, lockedBy: null, grant: null });
	        return;
	      }
	      const existing = getValidLock(planId);
	      const activeGrant = existing ? null : getValidGrant(planId);
	      if (activeGrant && activeGrant.userId && activeGrant.userId !== info.userId) {
	        jsonSend(ws, {
	          type: 'lock_denied',
	          planId,
	          lockedBy: null,
	          grant: {
	            userId: activeGrant.userId,
	            username: activeGrant.username,
	            avatarUrl: activeGrant.avatarUrl || '',
	            grantedAt: activeGrant.grantedAt || null,
	            expiresAt: activeGrant.expiresAt || null,
	            minutes: activeGrant.minutes || null,
	            grantedBy: { userId: activeGrant.grantedById || '', username: activeGrant.grantedByName || '' }
	          }
	        });
	        return;
	      }
	      if (!existing || existing.userId === info.userId) {
	        const now = Date.now();
	        if (activeGrant && activeGrant.userId === info.userId) planLockGrants.delete(planId);
	        planLocks.set(planId, {
	          userId: info.userId,
	          username: info.username,
	          avatarUrl: info.avatarUrl || '',
	          acquiredAt: now,
	          ts: now,
	          lastActionAt: null,
	          dirty: false
	        });
	        writeAuditLog(db, { level: 'important', event: 'plan_lock_acquired', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId });
	        emitLockState(planId);
	      } else {
	        jsonSend(ws, {
	          type: 'lock_denied',
	          planId,
	          lockedBy: { userId: existing.userId, username: existing.username, avatarUrl: existing.avatarUrl || '' },
	          grant: null
	        });
	      }
	      return;
	    }

	    if (msg?.type === 'renew_lock') {
	      const planId = String(msg.planId || '').trim();
	      if (!planId) return;
	      const lock = getValidLock(planId);
	      if (!lock || lock.userId !== info.userId) {
	        jsonSend(ws, {
	          type: 'lock_denied',
	          planId,
	          lockedBy: lock ? { userId: lock.userId, username: lock.username, avatarUrl: lock.avatarUrl || '' } : null,
	          grant: null
	        });
	        return;
	      }
	      const now = Date.now();
	      lock.ts = now;
	      planLocks.set(planId, lock);
	      // Legacy heartbeat; locks never expire, but keeping ts fresh helps "last seen" info.
	      jsonSend(ws, { type: 'lock_renewed', planId });
	      return;
	    }

	    if (msg?.type === 'plan_action') {
	      const planId = String(msg.planId || '').trim();
	      if (!planId) return;
	      const lock = getValidLock(planId);
	      if (!lock || lock.userId !== info.userId) return;
	      const now = Date.now();
	      lock.ts = now;
	      lock.lastActionAt = now;
	      planLocks.set(planId, lock);
	      emitLockState(planId);
	      return;
	    }

	    if (msg?.type === 'plan_dirty') {
	      const planId = String(msg.planId || '').trim();
	      if (!planId) return;
	      const lock = getValidLock(planId);
	      if (!lock || lock.userId !== info.userId) return;
	      lock.dirty = !!msg.dirty;
	      planLocks.set(planId, lock);
	      // Keep superadmin UI reasonably up-to-date without spamming too much (client should throttle).
	      emitLockState(planId);
	      return;
	    }

		    if (msg?.type === 'force_unlock_start') {
		      const planId = String(msg.planId || '').trim();
		      const targetUserId = String(msg.targetUserId || '').trim();
		      const rawMinutes = Number(msg.graceMinutes ?? msg.minutes ?? '');
		      const graceMinutes = Number.isFinite(rawMinutes) ? Math.max(0, Math.min(60, rawMinutes)) : 0;
		      if (!planId || !targetUserId) return;
	      if (!info?.isSuperAdmin) {
	        jsonSend(ws, { type: 'force_unlock_denied', planId, targetUserId, reason: 'forbidden' });
	        return;
	      }
		      const lock = getValidLock(planId);
		      if (!lock || lock.userId !== targetUserId) {
		        jsonSend(ws, { type: 'force_unlock_denied', planId, targetUserId, reason: 'no_lock' });
		        return;
		      }
		      const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
		      const now = Date.now();
		      const graceEndsAt = now + Math.round(graceMinutes * 60_000);
		      const decisionEndsAt = graceEndsAt + 5 * 60_000;
		      forceUnlocks.set(requestId, {
		        planId,
		        targetUserId,
		        requestedById: info.userId,
		        requestedByName: info.username,
		        createdAt: now,
		        graceEndsAt,
		        decisionEndsAt,
		        graceMinutes
		      });
	      const state = readState();
	      const planPathMap = buildPlanPathMap(state.clients || []);
	      const path = planPathMap.get(planId);
		      const payload = {
		        type: 'force_unlock',
		        requestId,
		        planId,
		        clientName: path?.clientName || '',
		        siteName: path?.siteName || '',
		        planName: path?.planName || '',
		        requestedBy: { userId: info.userId, username: info.username },
		        // keep legacy field name for older clients
		        deadlineAt: graceEndsAt,
		        graceEndsAt,
		        decisionEndsAt,
		        graceMinutes,
		        hasUnsavedChanges: !!lock.dirty
		      };
		      sendToUser(targetUserId, payload);
		      jsonSend(ws, {
		        type: 'force_unlock_started',
		        requestId,
		        planId,
		        targetUserId,
		        // keep legacy field name for older clients
		        deadlineAt: graceEndsAt,
		        graceEndsAt,
		        decisionEndsAt,
		        graceMinutes,
		        hasUnsavedChanges: !!lock.dirty
		      });
		      writeAuditLog(db, {
		        level: 'important',
		        event: 'plan_force_unlock_started',
		        userId: info.userId,
		        username: info.username,
	        scopeType: 'plan',
	        scopeId: planId,
	        details: { targetUserId, graceMinutes }
		      });
		      return;
		    }

		    if (msg?.type === 'force_unlock_cancel') {
		      const requestId = String(msg.requestId || '').trim();
		      if (!requestId) return;
		      const entry = forceUnlocks.get(requestId);
		      if (!entry) return;
		      if (!info?.isSuperAdmin) return;
		      if (entry.requestedById !== info.userId) return;
		      // Cancel is only available after the grace window (decision phase).
		      if (Number(entry.graceEndsAt || 0) > Date.now()) return;
		      forceUnlocks.delete(requestId);
		      sendToUser(entry.targetUserId, { type: 'force_unlock_cancelled', requestId, planId: entry.planId });
		      jsonSend(ws, { type: 'force_unlock_cancelled', requestId, planId: entry.planId, targetUserId: entry.targetUserId });
		      writeAuditLog(db, {
		        level: 'important',
		        event: 'plan_force_unlock_cancelled',
		        userId: info.userId,
		        username: info.username,
		        scopeType: 'plan',
		        scopeId: entry.planId,
		        details: { targetUserId: entry.targetUserId, requestId }
		      });
		      return;
		    }

		    if (msg?.type === 'force_unlock_execute') {
		      const requestId = String(msg.requestId || '').trim();
		      const action = String(msg.action || '').trim(); // save|discard
		      if (!requestId) return;
		      const entry = forceUnlocks.get(requestId);
		      if (!entry) return;
		      if (entry.requestedById !== info.userId) return;
		      if (action !== 'save' && action !== 'discard') return;
		      // Execute is only available after the grace window (decision phase).
		      if (Number(entry.graceEndsAt || 0) > Date.now()) return;
		      sendToUser(entry.targetUserId, { type: 'force_unlock_execute', requestId, planId: entry.planId, action });
		      return;
		    }

		    if (msg?.type === 'force_unlock_done') {
		      const requestId = String(msg.requestId || '').trim();
		      const action = String(msg.action || '').trim();
		      const ok = !!msg.ok;
		      if (!requestId) return;
		      const entry = forceUnlocks.get(requestId);
		      if (!entry) return;
		      if (entry.targetUserId !== info.userId) return;
		      sendToUser(entry.requestedById, { type: 'force_unlock_done', requestId, planId: entry.planId, action, ok });
		      if (ok) {
		        // Finalize server-side: ensure the lock is released and reserve/assign it to the superadmin.
		        const lock = getValidLock(entry.planId);
		        const lastActionAt = lock?.lastActionAt || lock?.ts || null;
		        if (lock && lock.userId === entry.targetUserId) {
		          planLocks.delete(entry.planId);
		          writeAuditLog(db, {
		            level: 'important',
		            event: 'plan_lock_released',
		            userId: lock.userId,
		            username: lock.username,
		            scopeType: 'plan',
		            scopeId: entry.planId,
		            details: { reason: 'force_unlock_done', requestId, action }
		          });
		        }
		        forceUnlocks.delete(requestId);
		        finalizeForceUnlockTakeover(entry.planId, entry.requestedById, entry.requestedByName, lastActionAt, requestId, 'force_unlock_done');
		      }
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
	        const lastActionAt = lock.lastActionAt || lock.ts || null;
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
	          // If a force unlock is active for this plan/target, treat leaving/closing as "discard".
	          const completed = completeForceUnlockAsAutoDiscard(planId, info.userId, lastActionAt, 'target_left');
	          if (!completed) emitLockState(planId);
	        }
	      }
	      emitPresence(planId);
	      emitGlobalPresence();
	      return;
	    }

	    if (msg?.type === 'release_lock') {
	      const planId = String(msg.planId || '').trim();
	      const lock = planLocks.get(planId);
	      if (lock && lock.userId === info.userId) {
	        const lastActionAt = lock.lastActionAt || lock.ts || null;
	        planLocks.delete(planId);
	        writeAuditLog(db, { level: 'important', event: 'plan_lock_released', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId, details: { reason: 'release' } });
	        const completed = completeForceUnlockAsAutoDiscard(planId, info.userId, lastActionAt, 'target_released');
	        if (!completed) emitLockState(planId);
	      }
	      return;
	    }

		    if (msg?.type === 'unlock_request') {
		      const planId = String(msg.planId || '').trim();
		      const targetUserId = String(msg.targetUserId || '').trim();
		      const message = typeof msg.message === 'string' ? String(msg.message || '').trim() : '';
		      const rawMinutes = Number(msg.grantMinutes ?? msg.minutes ?? '');
		      const grantMinutes = Number.isFinite(rawMinutes) ? Math.max(0.5, Math.min(60, rawMinutes)) : 10;
		      if (!planId || !targetUserId) return;
		      const requesterAccess = getPlanAccessForUser(info.userId, planId);
		      if (requesterAccess !== 'rw') {
		        jsonSend(ws, { type: 'unlock_denied', planId, targetUserId, reason: 'forbidden' });
		        return;
		      }
	      const lock = getValidLock(planId);
	      if (!lock || lock.userId !== targetUserId) {
	        jsonSend(ws, { type: 'unlock_denied', planId, targetUserId, reason: 'no_lock' });
	        return;
      }
      const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
      const state = readState();
      const planPathMap = buildPlanPathMap(state.clients || []);
      const path = planPathMap.get(planId);
		      const payload = {
		        type: 'unlock_request',
		        requestId,
		        planId,
		        clientName: path?.clientName || '',
		        siteName: path?.siteName || '',
		        planName: path?.planName || '',
		        requestedBy: { userId: info.userId, username: info.username },
		        grantMinutes,
		        message: message ? message.slice(0, 1000) : ''
		      };
      const sent = sendToUser(targetUserId, payload);
      if (!sent) {
        jsonSend(ws, { type: 'unlock_denied', planId, targetUserId, reason: 'offline' });
        return;
      }
		      unlockRequests.set(requestId, {
		        requestedById: info.userId,
		        requestedByName: info.username,
		        requestedByAvatarUrl: info.avatarUrl || '',
		        targetUserId,
		        planId,
		        message: message ? message.slice(0, 1000) : '',
		        grantMinutes,
		        createdAt: Date.now()
		      });
      writeAuditLog(db, {
        level: 'important',
        event: 'plan_unlock_requested',
        userId: info.userId,
        username: info.username,
        scopeType: 'plan',
        scopeId: planId,
        details: { targetUserId }
      });
      jsonSend(ws, { type: 'unlock_sent', requestId, planId, targetUserId });
      return;
    }

		    if (msg?.type === 'unlock_response') {
	      const requestId = String(msg.requestId || '').trim();
	      const planId = String(msg.planId || '').trim();
	      const action = String(msg.action || '').trim();
	      if (!requestId || !planId) return;
	      const request = unlockRequests.get(requestId);
	      if (!request) return;
	      if (request.targetUserId !== info.userId) return;
	      unlockRequests.delete(requestId);
		      const granted = action === 'grant' || action === 'grant_save' || action === 'grant_discard';
		      let released = false;
		      let grantCreated = false;
		      let lockAssignedToRequester = false;
		      let grantPayload = null;
		      let takeover = null; // 'reserved' | 'immediate' | null
		      let lastActionAt = null;
		      if (granted) {
		        const current = getValidLock(planId);
		        // If the plan is currently locked by someone else, do not create a grant.
		        if (current && current.userId && current.userId !== info.userId) {
		          released = false;
		        } else {
		          if (current && current.userId === info.userId) {
		            lastActionAt = current.lastActionAt || current.ts || null;
		            planLocks.delete(planId);
		            writeAuditLog(db, {
		              level: 'important',
		              event: 'plan_lock_released',
		              userId: info.userId,
		              username: info.username,
		              scopeType: 'plan',
		              scopeId: planId,
		              details: { reason: 'unlock_request', action }
		            });
		            released = true;
		          }
		          // If the requester is already inside the plan, assign the lock immediately.
		          const after = getValidLock(planId);
		          if (!after) {
		            const requesterJoined = userIsJoinedToPlan(planId, request.requestedById);
		            if (requesterJoined) {
		              const now = Date.now();
		              const requester = resolveUserIdentity(request.requestedById, request.requestedByName || 'user');
		              planLocks.set(planId, {
		                userId: requester.userId,
		                username: requester.username,
		                avatarUrl: requester.avatarUrl || '',
		                acquiredAt: now,
		                ts: now,
		                lastActionAt: null,
		                dirty: false
		              });
		              writeAuditLog(db, {
		                level: 'important',
		                event: 'plan_lock_acquired',
		                userId: requester.userId,
		                username: requester.username,
		                scopeType: 'plan',
		                scopeId: planId,
		                details: { reason: 'unlock_request_immediate' }
		              });
		              lockAssignedToRequester = true;
		              takeover = 'immediate';
		            } else {
		              // Otherwise reserve the lock for a limited time window (hourglass).
		              const minutes = Number.isFinite(Number(request.grantMinutes)) ? Math.max(0.5, Math.min(60, Number(request.grantMinutes))) : 10;
		              const now = Date.now();
		              const expiresAt = now + Math.round(minutes * 60_000);
		              planLockGrants.set(planId, {
		                userId: request.requestedById,
		                username: request.requestedByName,
		                avatarUrl: request.requestedByAvatarUrl || '',
		                grantedAt: now,
		                expiresAt,
		                minutes,
		                grantedById: info.userId,
		                grantedByName: info.username,
		                lastActionAt
		              });
		              grantCreated = true;
		              takeover = 'reserved';
		              grantPayload = {
		                userId: request.requestedById,
		                username: request.requestedByName,
		                avatarUrl: request.requestedByAvatarUrl || '',
		                grantedAt: now,
		                expiresAt,
		                minutes,
		                grantedBy: { userId: info.userId, username: info.username }
		              };
		            }
		          }
		        }
		      }
		      if (released || grantCreated || lockAssignedToRequester) emitLockState(planId);
		      writeAuditLog(db, {
		        level: 'important',
		        event: 'plan_unlock_response',
		        userId: info.userId,
	        username: info.username,
        scopeType: 'plan',
        scopeId: planId,
        details: {
          action,
          released,
          requestedById: request.requestedById
        }
      });
		      sendToUser(request.requestedById, {
		        type: 'unlock_result',
		        requestId,
		        planId,
		        targetUserId: info.userId,
		        action,
		        released,
		        grantedBy: { userId: info.userId, username: info.username, avatarUrl: info.avatarUrl || '' },
		        takeover,
		        grant: grantPayload,
		        plan: (() => {
		          const state = readState();
		          const planPathMap = buildPlanPathMap(state.clients || []);
		          const path = planPathMap.get(planId);
	          return { clientName: path?.clientName || '', siteName: path?.siteName || '', planName: path?.planName || '' };
	        })()
	      });
	      return;
	    }
  });

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    releaseLocksForWs(ws);
    emitGlobalPresence();
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

const lockCleanupTimer = setInterval(() => {
  const expiredGrants = purgeExpiredGrants();
  if (expiredGrants.length) {
    for (const entry of expiredGrants) {
      writeAuditLog(db, {
        level: 'important',
        event: 'plan_lock_grant_expired',
        userId: entry.grant.userId,
        username: entry.grant.username,
        scopeType: 'plan',
        scopeId: entry.planId
      });
      emitLockState(entry.planId);
    }
  }
	  const expiredForce = purgeExpiredForceUnlocks();
	  if (expiredForce.length) {
	    for (const { requestId, entry } of expiredForce) {
	      // Deadline reached without an explicit execute: expire the request, keep the lock as-is.
	      sendToUser(entry.requestedById, { type: 'force_unlock_expired', requestId, planId: entry.planId, targetUserId: entry.targetUserId });
	      sendToUser(entry.targetUserId, { type: 'force_unlock_expired', requestId, planId: entry.planId });
	      writeAuditLog(db, {
	        level: 'important',
	        event: 'plan_force_unlock_expired',
	        userId: entry.requestedById,
	        username: entry.requestedByName,
	        scopeType: 'plan',
	        scopeId: entry.planId,
	        details: { targetUserId: entry.targetUserId, requestId }
	      });
	    }
	  }
  const now = Date.now();
  for (const [requestId, req] of unlockRequests.entries()) {
    if (now - (req.createdAt || 0) > 5 * 60_000) unlockRequests.delete(requestId);
  }
}, LOCK_CLEANUP_MS);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
  clearInterval(lockCleanupTimer);
});

app.use((err, req, res, _next) => {
  serverLog('error', 'api_unhandled_error', {
    requestId: req?.requestId || null,
    method: req?.method || '',
    path: req?.originalUrl || req?.url || '',
    message: err?.message || 'Unhandled error'
  });
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  serverLog('error', 'process_unhandled_rejection', {
    reason: String(reason || '')
  });
});

process.on('uncaughtException', (error) => {
  serverLog('error', 'process_uncaught_exception', {
    message: error?.message || 'unknown'
  });
});

server.listen(PORT, HOST, () => {
});
const hostHint = HOST === '0.0.0.0' ? 'localhost' : HOST;
serverLog('info', 'server_started', {
  host: hostHint,
  port: PORT,
  cspAllowEval: isEnabled(readEnv('PLIXMAP_CSP_ALLOW_EVAL'), false),
  cspAllowMediaPipe: isEnabled(readEnv('PLIXMAP_CSP_ALLOW_MEDIAPIPE'), false),
  backupDir: resolveBackupDir(),
  backupRetention: resolveBackupRetention()
});
console.log(`[plixmap] API listening on http://${hostHint}:${PORT}`);
if (HOST === '0.0.0.0') {
  console.log(`[plixmap] API listening on all interfaces (http://0.0.0.0:${PORT})`);
}
