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
const { isAdminLike, isStrictSuperAdmin } = require('./access.cjs');
const { getUserWithPermissions, computePlanAccess, filterStateForUser, mergeWritablePlanContent } = require('./permissions.cjs');
const { registerUserRoutes } = require('./routes/users.cjs');
const { registerChatRoutes } = require('./routes/chat.cjs');
const { registerMeetingRoutes } = require('./routes/meetings.cjs');
const { registerObjectTypeRequestRoutes } = require('./routes/objectTypeRequests.cjs');
const { registerAdminLogRoutes } = require('./routes/adminLogs.cjs');
const { createRealtimeRuntime } = require('./realtime.cjs');
const { createChatServices } = require('./services/chat.cjs');
const { createMeetingServices } = require('./services/meetings.cjs');
const { attachStaticApp } = require('./staticApp.cjs');
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
  fetchDevicesFromApi,
  getImportConfig,
  getDeviceImportConfig,
  getImportConfigSafe,
  getDeviceImportConfigSafe,
  upsertImportConfig,
  upsertDeviceImportConfig,
  upsertExternalUsers,
  upsertExternalDevices,
  listExternalUsers,
  listExternalDevices,
  getExternalUser,
  getExternalDevice,
  setExternalUserHidden,
  setExternalDeviceHidden,
  listImportSummary,
  listDeviceImportSummary,
  isManualExternalId,
  isManualDeviceId,
  upsertManualExternalUser,
  deleteManualExternalUser,
  upsertManualExternalDevice,
  deleteManualExternalDevice,
  findExternalEmailConflict
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
const buildMobilePublicUrl = (req, roomId) => {
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
  const base = `${proto}://${hostname}${portPart}/mobile`;
  const rid = String(roomId || '').trim();
  if (!rid) return base;
  return `${base}?roomId=${encodeURIComponent(rid)}`;
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

let stateSnapshotCache = null;
const filteredStateCache = new Map();

const buildPermissionCacheKey = (ctx) => {
  const user = ctx?.user || {};
  const permissions = Array.isArray(ctx?.permissions) ? ctx.permissions : [];
  const permissionKey = permissions
    .map((entry) =>
      [
        String(entry?.scopeType || '').trim(),
        String(entry?.scopeId || '').trim(),
        String(entry?.access || '').trim(),
        entry?.chat ? '1' : '0'
      ].join(':')
    )
    .sort()
    .join('|');
  return [
    String(user?.id || '').trim(),
    user?.isAdmin ? 'admin' : 'user',
    user?.isSuperAdmin ? 'super' : 'std',
    user?.isMeetingOperator ? 'meetingop' : 'full',
    permissionKey
  ].join('::');
};

const readState = () => {
  if (stateSnapshotCache) return stateSnapshotCache;
  const row = db.prepare('SELECT json, updatedAt FROM state WHERE id = 1').get();
  if (!row) {
    stateSnapshotCache = { clients: [], objectTypes: undefined, updatedAt: null };
    return stateSnapshotCache;
  }
  try {
    const parsed = JSON.parse(row.json) || {};
    stateSnapshotCache = { clients: parsed.clients || [], objectTypes: parsed.objectTypes, updatedAt: row.updatedAt };
    return stateSnapshotCache;
  } catch {
    stateSnapshotCache = { clients: [], objectTypes: undefined, updatedAt: row.updatedAt };
    return stateSnapshotCache;
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
const aiDailyUsageByScope = new Map(); // key: YYYY-MM-DD|clientId|userId -> tokens

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

const realtime = createRealtimeRuntime({
  db,
  readState,
  writeAuditLog,
  getChatClientIdsForUser,
  getPlanAccessForUser
});
const {
  wsClientInfo,
  planLocks,
  planLockGrants,
  purgeExpiredLocks,
  sendToUser,
  broadcastToChatClient,
  emitGlobalPresence,
  emitLockState
} = realtime;

const chatServices = createChatServices({
  db,
  readState,
  getChatClientIdsForUser,
  parseDataUrl,
  base64SizeBytes,
  uploadsDir,
  wsClientInfo,
  sendToUser
});

const meetingServices = createMeetingServices({
  db,
  readState,
  dataSecret,
  getUserWithPermissions,
  computePlanAccess,
  filterStateForUser,
  getEmailConfig,
  getClientEmailConfig,
  logEmailAttempt,
  wsClientInfo,
  sendToUser,
  chat: chatServices
});

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
  stateSnapshotCache = { clients: payload?.clients || [], objectTypes: payload?.objectTypes, updatedAt: now };
  filteredStateCache.clear();
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
  req.isSuperAdmin = isStrictSuperAdmin({ ...userRow, username: normalizedUsername });
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
  const isSuperAdmin = isStrictSuperAdmin({ ...row, username: normalizedUsername });
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

app.get('/api/mobile/app-url', requireAuth, (req, res) => {
  res.json({ url: buildMobilePublicUrl(req) });
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
  const employees = [];
  const generatedIds = new Set();
  const compactPhone = (value) => String(value || '').replace(/\s+/g, '').trim();
  const makeCsvExternalId = (base, rowIndex) => {
    const cleaned = String(base || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    let candidate = `csv:${cleaned || `row-${rowIndex + 1}`}`;
    let suffix = 2;
    while (generatedIds.has(candidate)) {
      candidate = `csv:${cleaned || `row-${rowIndex + 1}`}-${suffix++}`;
    }
    generatedIds.add(candidate);
    return candidate;
  };
  const parseBool = (value) => {
    const v = String(value || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y';
  };
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const get = (key) => {
      const idx = map.get(key);
      if (idx === undefined) return '';
      return String(row[idx] || '').trim();
    };
    const firstName = get('firstName');
    const lastName = get('lastName');
    const email = get('email');
    const explicitExternalId = map.has('externalId') ? get('externalId') : '';
    const externalId =
      explicitExternalId ||
      makeCsvExternalId(email || `${firstName} ${lastName}`.trim() || `row-${rowIndex + 1}`, rowIndex);
    if (!externalId) continue;
    employees.push({
      externalId,
      firstName,
      lastName,
      role: get('role'),
      dept1: get('dept1'),
      dept2: get('dept2'),
      dept3: get('dept3'),
      email,
      mobile: compactPhone(get('mobile')),
      ext1: get('ext1'),
      ext2: get('ext2'),
      ext3: get('ext3'),
      isExternal: parseBool(get('isExternal'))
    });
  }
  return { employees, error: null };
};

const parseCsvDevices = (text) => {
  const rows = parseCsvRows(String(text || ''));
  if (!rows.length) return { devices: [], error: 'Empty CSV' };
  const header = rows.shift().map((h) => String(h || '').trim().toLowerCase());
  if (!header.length) return { devices: [], error: 'Missing header' };
  const map = new Map();
  const mapping = {
    devid: 'devId',
    dev_id: 'devId',
    deviceid: 'devId',
    device_type: 'deviceType',
    devicetype: 'deviceType',
    type: 'deviceType',
    device_name: 'deviceName',
    devicename: 'deviceName',
    name: 'deviceName',
    manufacturer: 'manufacturer',
    model: 'model',
    serialnumber: 'serialNumber',
    serial_number: 'serialNumber',
    serial: 'serialNumber'
  };
  header.forEach((key, idx) => {
    const normalized = mapping[key] || null;
    if (normalized) map.set(normalized, idx);
  });
  const devices = [];
  const generatedIds = new Set();
  const makeCsvDeviceId = (base, rowIndex) => {
    const cleaned = String(base || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    let candidate = `csvdev:${cleaned || `row-${rowIndex + 1}`}`;
    let suffix = 2;
    while (generatedIds.has(candidate)) {
      candidate = `csvdev:${cleaned || `row-${rowIndex + 1}`}-${suffix++}`;
    }
    generatedIds.add(candidate);
    return candidate;
  };
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const get = (key) => {
      const idx = map.get(key);
      if (idx === undefined) return '';
      return String(row[idx] || '').trim();
    };
    const deviceName = get('deviceName');
    const serialNumber = get('serialNumber');
    const explicitDeviceId = map.has('devId') ? get('devId') : '';
    const devId = explicitDeviceId || makeCsvDeviceId(serialNumber || deviceName || `row-${rowIndex + 1}`, rowIndex);
    if (!devId) continue;
    devices.push({
      devId,
      deviceType: get('deviceType'),
      deviceName,
      manufacturer: get('manufacturer'),
      model: get('model'),
      serialNumber
    });
  }
  return { devices, error: null };
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

const clearDeviceImportDataForClient = (cid) => {
  const removedDevices = db.prepare('DELETE FROM external_devices WHERE clientId = ?').run(cid).changes || 0;
  return { removedDevices };
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

const deleteImportedExternalDeviceForClient = (cid, devId) => {
  const did = String(devId || '').trim();
  if (!cid || !did) return { removedDevices: 0 };
  const removedDevices = db.prepare('DELETE FROM external_devices WHERE clientId = ? AND devId = ?').run(cid, did).changes || 0;
  return { removedDevices };
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
    res.json({ ok: true, rows: [] });
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

app.get('/api/device-import/summary', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.json({ ok: true, rows: [] });
    return;
  }
  const state = readState();
  const summaries = listDeviceImportSummary(db);
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

app.get('/api/device-import/config', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const clientId = String(req.query.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  res.json({ config: getDeviceImportConfigSafe(db, clientId) });
});

app.put('/api/device-import/config', requireAuth, rateByUser('device_import_config', 60 * 1000, 10), (req, res) => {
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
  const cfg = upsertDeviceImportConfig(db, dataSecret, { clientId: cid, url: u, username: un, password, method: nextMethod, bodyJson });
  writeAuditLog(db, {
    level: 'important',
    event: 'device_import_config_update',
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
    details: { mode: importMode, count: parsed.employees.length, created: sync.summary?.created, updated: sync.summary?.updated, duplicateEmails: sync.summary?.duplicateEmails || 0, removedUsers: cleanup?.removedUsers || 0, removedObjects: cleanup?.removedObjects || 0 }
  });
  res.json({ ok: true, ...sync, cleanup });
});

app.post('/api/device-import/test', requireAuth, rateByUser('device_import_test', 60 * 1000, 10), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cfg = getDeviceImportConfig(db, dataSecret, cid);
  if (!cfg || !cfg.url || !cfg.username) {
    res.status(400).json({ error: 'Missing import config (url/username)' });
    return;
  }
  const result = await fetchDevicesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
  writeAuditLog(db, {
    level: 'important',
    event: 'device_import_test',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: { ok: !!result.ok, status: result.status }
  });
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
  const preview = (result.devices || []).slice(0, 25);
  res.json({ ok: true, status: result.status, count: (result.devices || []).length, preview });
});

app.post('/api/device-import/sync', requireAuth, rateByUser('device_import_sync', 60 * 1000, 10), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cfg = getDeviceImportConfig(db, dataSecret, cid);
  if (!cfg || !cfg.url || !cfg.username) {
    res.status(400).json({ error: 'Missing import config (url/username)' });
    return;
  }
  const result = await fetchDevicesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
  if (!result.ok) {
    writeAuditLog(db, {
      level: 'important',
      event: 'device_import_sync',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { ok: false, status: result.status, error: result.error || '' }
    });
    res.status(400).json({
      ok: false,
      status: result.status,
      error: result.error || 'Request failed',
      contentType: result.contentType || '',
      rawSnippet: result.rawSnippet || ''
    });
    return;
  }
  const sync = upsertExternalDevices(db, cid, result.devices || []);
  writeAuditLog(db, {
    level: 'important',
    event: 'device_import_sync',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: sync.summary
  });
  res.json({ ok: true, ...sync });
});

app.post('/api/device-import/csv', requireAuth, rateByUser('device_import_csv', 60 * 1000, 10), (req, res) => {
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
  const parsed = parseCsvDevices(csvText);
  if (parsed.error) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  if (!parsed.devices.length) {
    res.status(400).json({ error: 'No devices found in CSV' });
    return;
  }
  let cleanup = null;
  if (importMode === 'replace') {
    cleanup = clearDeviceImportDataForClient(cid);
  }
  const sync = upsertExternalDevices(db, cid, parsed.devices || [], { markMissing: false });
  writeAuditLog(db, {
    level: 'important',
    event: 'device_import_csv',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: {
      mode: importMode,
      count: parsed.devices.length,
      created: sync.summary?.created,
      updated: sync.summary?.updated,
      removedDevices: cleanup?.removedDevices || 0
    }
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

const mapImportedDeviceForPreview = (device) => ({
  devId: String(device?.devId || ''),
  deviceType: String(device?.deviceType || ''),
  deviceName: String(device?.deviceName || ''),
  manufacturer: String(device?.manufacturer || ''),
  model: String(device?.model || ''),
  serialNumber: String(device?.serialNumber || '')
});

const mapExternalDeviceDbRowForPreview = (row, { includeFlags = false } = {}) => ({
  devId: String(row?.devId || ''),
  deviceType: String(row?.deviceType || ''),
  deviceName: String(row?.deviceName || ''),
  manufacturer: String(row?.manufacturer || ''),
  model: String(row?.model || ''),
  serialNumber: String(row?.serialNumber || ''),
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

const importedDeviceChangedAgainstRemote = (previous, remoteDevice) => {
  if (!previous || !remoteDevice) return true;
  return (
    normalizeImportText(previous.deviceType) !== normalizeImportText(remoteDevice.deviceType) ||
    normalizeImportText(previous.deviceName) !== normalizeImportText(remoteDevice.deviceName) ||
    normalizeImportText(previous.manufacturer) !== normalizeImportText(remoteDevice.manufacturer) ||
    normalizeImportText(previous.model) !== normalizeImportText(remoteDevice.model) ||
    normalizeImportText(previous.serialNumber) !== normalizeImportText(remoteDevice.serialNumber) ||
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
  if ((sync.summary?.duplicateEmails || 0) > 0) {
    const dup = Array.isArray(sync.duplicates) && sync.duplicates.length ? sync.duplicates[0] : null;
    res.status(409).json({ error: dup?.email ? `Duplicate email in client directory: ${dup.email}` : 'Duplicate email in client directory' });
    return;
  }
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

app.post('/api/device-import/preview', requireAuth, rateByUser('device_import_preview', 60 * 1000, 10), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cfg = getDeviceImportConfig(db, dataSecret, cid);
  if (!cfg || !cfg.url || !cfg.username) {
    res.status(400).json({ error: 'Missing import config (url/username)' });
    return;
  }
  const result = await fetchDevicesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
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
  const remote = (result.devices || []).map(mapImportedDeviceForPreview);
  const existing = db
    .prepare(
      'SELECT devId, deviceType, deviceName, manufacturer, model, serialNumber, hidden, present, updatedAt FROM external_devices WHERE clientId = ? ORDER BY deviceName COLLATE NOCASE, devId COLLATE NOCASE'
    )
    .all(cid)
    .map((row) => mapExternalDeviceDbRowForPreview(row, { includeFlags: true }));
  const existingById = new Map(existing.map((r) => [String(r.devId), r]));
  const remoteRows = remote.map((d) => {
    const prev = existingById.get(String(d.devId));
    if (!prev) return { ...d, importStatus: 'new' };
    const changed = importedDeviceChangedAgainstRemote(prev, d);
    return { ...d, importStatus: changed ? 'update' : 'existing' };
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

app.post('/api/device-import/import-one', requireAuth, rateByUser('device_import_one', 60 * 1000, 30), async (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  const devId = String(req.body?.devId || '').trim();
  if (!cid || !devId) {
    res.status(400).json({ error: 'Missing clientId/devId' });
    return;
  }
  let device = null;
  const candidate = req.body?.device && typeof req.body.device === 'object' ? req.body.device : null;
  if (candidate && String(candidate.devId || '').trim() === devId) {
    device = mapImportedDeviceForPreview({ ...candidate, devId });
  }
  if (!device) {
    const cfg = getDeviceImportConfig(db, dataSecret, cid);
    if (!cfg || !cfg.url || !cfg.username) {
      res.status(400).json({ error: 'Missing import config (url/username)' });
      return;
    }
    const result = await fetchDevicesFromApi({ ...cfg, allowPrivate: allowPrivateImportForRequest(req) });
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
    device = (result.devices || []).find((d) => String(d.devId) === devId);
  }
  if (!device) {
    res.status(404).json({ error: 'Remote device not found' });
    return;
  }
  const sync = upsertExternalDevices(db, cid, [device], { markMissing: false });
  writeAuditLog(db, {
    level: 'important',
    event: 'device_import_one',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: { devId, created: sync.summary?.created || 0, updated: sync.summary?.updated || 0 }
  });
  res.json({ ok: true, devId, summary: sync.summary, created: sync.created || [], updated: sync.updated || [] });
});

app.post('/api/device-import/delete-one', requireAuth, rateByUser('device_import_delete_one', 60 * 1000, 30), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  const devId = String(req.body?.devId || '').trim();
  if (!cid || !devId) {
    res.status(400).json({ error: 'Missing clientId/devId' });
    return;
  }
  const cleanup = deleteImportedExternalDeviceForClient(cid, devId);
  writeAuditLog(db, {
    level: 'important',
    event: 'device_import_delete_one',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: { devId, removedDevices: cleanup.removedDevices }
  });
  res.json({ ok: true, devId, ...cleanup });
});

app.post('/api/device-import/clear', requireAuth, rateByUser('device_import_clear', 60 * 1000, 10), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const cid = String(req.body?.clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const cleanup = clearDeviceImportDataForClient(cid);
  writeAuditLog(db, {
    level: 'important',
    event: 'device_import_clear',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: { removedDevices: cleanup.removedDevices }
  });
  res.json({ ok: true, removedDevices: cleanup.removedDevices });
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
    if (err?.code === 'DUPLICATE_EMAIL') {
      res.status(409).json({ error: err.message || 'Duplicate email in client directory' });
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
    if (err?.code === 'DUPLICATE_EMAIL') {
      res.status(409).json({ error: err.message || 'Duplicate email in client directory' });
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

app.get('/api/external-devices', requireAuth, (req, res) => {
  const clientId = String(req.query.clientId || '').trim();
  if (!clientId) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  const serverState = readState();
  if (!req.isAdmin && !req.isSuperAdmin) {
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
  const rows = listExternalDevices(db, { clientId, q, includeHidden, includeMissing });
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

app.post('/api/external-devices/hide', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, devId, hidden } = req.body || {};
  const cid = String(clientId || '').trim();
  const did = String(devId || '').trim();
  if (!cid || !did) {
    res.status(400).json({ error: 'Missing clientId/devId' });
    return;
  }
  setExternalDeviceHidden(db, cid, did, !!hidden);
  writeAuditLog(db, {
    level: 'important',
    event: 'external_device_hide',
    userId: req.userId,
    scopeType: 'client',
    scopeId: cid,
    ...requestMeta(req),
    details: { devId: did, hidden: !!hidden }
  });
  res.json({ ok: true });
});

app.post('/api/external-devices/manual', requireAuth, rateByUser('external_device_manual_create', 60 * 1000, 30), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, device } = req.body || {};
  const cid = String(clientId || '').trim();
  if (!cid) {
    res.status(400).json({ error: 'Missing clientId' });
    return;
  }
  try {
    const row = upsertManualExternalDevice(db, cid, device || {});
    writeAuditLog(db, {
      level: 'important',
      event: 'external_device_manual_create',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { devId: row?.devId, deviceName: row?.deviceName || '' }
    });
    res.json({ ok: true, row });
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      res.status(400).json({ error: err.message || 'Invalid payload' });
      return;
    }
    if (String(err?.message || '').toLowerCase().includes('unique')) {
      res.status(409).json({ error: 'Duplicate devId for client' });
      return;
    }
    res.status(500).json({ error: 'Unable to create manual device' });
  }
});

app.put('/api/external-devices/manual', requireAuth, rateByUser('external_device_manual_update', 60 * 1000, 60), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, devId, device } = req.body || {};
  const cid = String(clientId || '').trim();
  const did = String(devId || '').trim();
  if (!cid || !did) {
    res.status(400).json({ error: 'Missing clientId/devId' });
    return;
  }
  if (!isManualDeviceId(did)) {
    res.status(400).json({ error: 'Only manual devices can be updated' });
    return;
  }
  try {
    const row = upsertManualExternalDevice(db, cid, { ...(device || {}), devId: did }, { devId: did });
    writeAuditLog(db, {
      level: 'important',
      event: 'external_device_manual_update',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { devId: did }
    });
    res.json({ ok: true, row });
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      res.status(400).json({ error: err.message || 'Invalid payload' });
      return;
    }
    if (err?.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    if (String(err?.message || '').toLowerCase().includes('unique')) {
      res.status(409).json({ error: 'Duplicate devId for client' });
      return;
    }
    res.status(500).json({ error: 'Unable to update manual device' });
  }
});

app.delete('/api/external-devices/manual', requireAuth, rateByUser('external_device_manual_delete', 60 * 1000, 60), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { clientId, devId } = req.body || {};
  const cid = String(clientId || '').trim();
  const did = String(devId || '').trim();
  if (!cid || !did) {
    res.status(400).json({ error: 'Missing clientId/devId' });
    return;
  }
  if (!isManualDeviceId(did)) {
    res.status(400).json({ error: 'Only manual devices can be deleted' });
    return;
  }
  try {
    const existing = getExternalDevice(db, cid, did);
    if (!existing) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    const result = deleteManualExternalDevice(db, cid, did);
    writeAuditLog(db, {
      level: 'important',
      event: 'external_device_manual_delete',
      userId: req.userId,
      scopeType: 'client',
      scopeId: cid,
      ...requestMeta(req),
      details: { devId: did }
    });
    res.json({ ok: true, removed: result.removed || 0 });
  } catch {
    res.status(500).json({ error: 'Unable to delete manual device' });
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

app.post('/api/settings/openai/test', requireAuth, rateByUser('openai_test', 5 * 60 * 1000, 15), async (req, res) => {
  if (!req.isAdmin && !req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const apiKey = String(req.body?.apiKey || '').trim();
  if (!apiKey) {
    res.status(400).json({ error: 'Missing OpenAI API key' });
    return;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://api.openai.com/v1/models?limit=1', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal
    });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        (body && typeof body === 'object' && (body.error?.message || body.message)) ||
        `OpenAI request failed (${response.status})`;
      writeAuditLog(db, {
        level: 'important',
        event: 'openai_key_test_failed',
        userId: req.userId,
        username: req.username,
        ...requestMeta(req),
        details: { status: response.status, reason: String(errorMessage || '').slice(0, 300) }
      });
      res.status(400).json({ ok: false, error: errorMessage, status: response.status });
      return;
    }
    const firstModel =
      body && typeof body === 'object' && Array.isArray(body.data) && body.data.length
        ? String(body.data[0]?.id || '').trim() || null
        : null;
    writeAuditLog(db, {
      level: 'important',
      event: 'openai_key_test_ok',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req),
      details: { firstModel }
    });
    res.json({ ok: true, provider: 'openai', firstModel });
  } catch (err) {
    const detail = err?.name === 'AbortError' ? 'OpenAI request timeout' : err?.message || 'OpenAI request failed';
    writeAuditLog(db, {
      level: 'important',
      event: 'openai_key_test_failed',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req),
      details: { status: 0, reason: String(detail || '').slice(0, 300) }
    });
    res.status(500).json({ ok: false, error: 'Failed to test OpenAI key', detail });
  } finally {
    clearTimeout(timeoutId);
  }
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
  const stateVersionKey = String(state?.updatedAt || '0');
  const permissionKey = buildPermissionCacheKey(ctx);
  const cacheKey = `${stateVersionKey}::${permissionKey}`;
  const cached = filteredStateCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }
  const access = computePlanAccess(state.clients, ctx?.permissions || []);
  const filtered = filterStateForUser(state.clients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
  const payload = { clients: filtered, objectTypes: state.objectTypes, updatedAt: state.updatedAt };
  filteredStateCache.set(cacheKey, payload);
  res.json(payload);
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

registerUserRoutes(app, {
  db,
  readState,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  getUserLock,
  clearUserLoginFailures,
  getChatClientIdsForUser,
  userHasBlocked: chatServices.userHasBlocked,
  normalizeLoginKey,
  verifyPassword,
  isStrongPassword,
  hashPassword,
  dataSecret,
  APP_BRAND,
  getEmailConfig,
  getClientEmailConfig,
  logEmailAttempt
});

registerChatRoutes(app, {
  db,
  readState,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  getChatClientIdsForUser,
  userCanChatClient,
  getClientScopeMaps,
  wsClientInfo,
  sendToUser,
  broadcastToChatClient,
  chat: chatServices
});

registerMeetingRoutes(app, {
  db,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  readState,
  serverLog,
  aiDailyUsageByScope,
  APP_BRAND,
  buildKioskPublicUrl,
  buildMobilePublicUrl,
  buildKioskPublicUploadUrl,
  meeting: meetingServices
});

registerObjectTypeRequestRoutes(app, {
  db,
  requireAuth,
  readState,
  writeState,
  createCustomField
});

registerAdminLogRoutes(app, {
  db,
  requireAuth,
  markLogsCleared,
  writeAuditLog,
  requestMeta
});

attachStaticApp(app, { distDir: path.join(process.cwd(), 'dist') });

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
realtime.attachWebSocketServer({
  wss,
  getWsAuthContext,
  getWsClientIp,
  pendingMeetingCount: meetingServices.pendingMeetingCount,
  getChatServices: () => chatServices
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
