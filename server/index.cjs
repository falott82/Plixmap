const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const express = require('express');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const { normalizeHttpUrl, serverConfig } = require('./config.cjs');
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
const { createAuthRuntime, registerAuthRoutes } = require('./routes/auth.cjs');
const { getWritablePlanIdsForStateSave } = require('./stateSaveGuards.cjs');
const { registerUserRoutes } = require('./routes/users.cjs');
const { registerChatRoutes } = require('./routes/chat.cjs');
const { registerMeetingRoutes } = require('./routes/meetings.cjs');
const { registerImportRoutes } = require('./routes/imports.cjs');
const { registerExternalDirectoryRoutes } = require('./routes/externalDirectory.cjs');
const { registerDataRoutes } = require('./routes/dataRoutes.cjs');
const { registerObjectTypeRequestRoutes } = require('./routes/objectTypeRequests.cjs');
const { registerAdminLogRoutes } = require('./routes/adminLogs.cjs');
const { registerSettingsRoutes } = require('./routes/settings.cjs');
const { hasStoredLogRetentionSettings, purgeExpiredLogs, readLogRetentionSettings } = require('./logRetention.cjs');
const { createRealtimeRuntime } = require('./realtime.cjs');
const { createChatServices } = require('./services/chat.cjs');
const { createMeetingServices } = require('./services/meetings.cjs');
const { attachStaticApp } = require('./staticApp.cjs');
const { buildPermissionCacheKey } = require('./permissionCacheKey.cjs');
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
  resolveEffectiveWebApiConfig,
  getImportConfig,
  getDeviceImportConfig,
  getLdapImportConfig,
  getImportConfigSafe,
  getDeviceImportConfigSafe,
  getLdapImportConfigSafe,
  upsertImportConfig,
  upsertDeviceImportConfig,
  upsertLdapImportConfig,
  upsertExternalUsers,
  upsertExternalDevices,
  listExternalUsers,
  listExternalDevices,
  getExternalUser,
  getExternalDevice,
  updateExternalUser,
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
  normalizeExternalUserPayload,
  normalizeExternalDevicePayload
} = require('./customImport.cjs');
const {
  normalizeLdapImportConfig,
  resolveLdapEffectiveConfig,
  fetchEmployeesFromLdap,
  prepareLdapImportPreview,
  selectLdapImportRows,
  applyLdapImportOverrides
} = require('./customImport/ldap.cjs');
const {
  getEmailConfig,
  getClientEmailConfig,
  logEmailAttempt,
  getEmailConfigSafe,
  upsertEmailConfig,
  getClientEmailConfigSafe,
  upsertClientEmailConfig,
  normalizePortalPublicUrl,
  getPortalPublicUrl,
  setPortalPublicUrl,
  listEmailLogs
} = require('./email.cjs');
const {
  buildMeetingRoomPublicUrl,
  buildMobilePublicUrl,
  buildPublicUploadUrl
} = require('./publicUrls.cjs');

const PORT = serverConfig.port;
const HOST = serverConfig.host;
const STARTED_AT = Date.now();
const APP_BRAND = 'Plixmap';
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

const buildKioskPublicUrl = (req, roomId) => buildMeetingRoomPublicUrl(req, roomId);
const buildKioskPublicUploadUrl = (req, rawUrl) => buildPublicUploadUrl(req, rawUrl);
const UPDATE_MANIFEST_URL = serverConfig.updateManifestUrl;
const UPDATE_MANIFEST_FALLBACK_URL = serverConfig.updateManifestFallbackUrl;

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const SERVER_LOG_LEVEL = serverConfig.logLevel;

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
  const allowMediaPipe = serverConfig.cspAllowMediaPipe;
  const allowEval = serverConfig.cspAllowEval;
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
if (serverConfig.trustProxy !== null) app.set('trust proxy', serverConfig.trustProxy);
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
  if (serverConfig.cookieSecureOverride !== null) return serverConfig.cookieSecureOverride;
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

const runLogRetentionCleanup = (reason = 'scheduled') => {
  try {
    if (!hasStoredLogRetentionSettings(db)) return null;
    const summary = purgeExpiredLogs(db, readLogRetentionSettings(db));
    if (summary.totalDeleted > 0) {
      writeAuditLog(db, {
        level: 'important',
        event: 'logs_retention_cleanup',
        details: {
          reason,
          totalDeleted: summary.totalDeleted,
          byKind: summary.byKind
        }
      });
    }
    return summary;
  } catch {
    return null;
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
  return serverConfig.uploadMaxImageBytes;
})();
const MAX_PDF_BYTES = (() => {
  return serverConfig.uploadMaxPdfBytes;
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

const PLAN_ACCESS_CACHE_TTL_MS = 4000;
const MAX_PLAN_ACCESS_CACHE_ENTRIES = 500;
const planAccessCacheByKey = new Map(); // key -> { ts, accessByPlan }

const getPlanAccessForUser = (userId, planId) => {
  if (!userId || !planId) return null;
  const maps = getClientScopeMaps();
  if (!maps.planToClient.has(planId)) return null;
  const state = readState();
  const ctx = getUserWithPermissions(db, userId);
  if (!ctx) return null;
  if (ctx.user.isAdmin) return 'rw';
  const cacheKey = `${String(state.updatedAt || 0)}::${buildPermissionCacheKey(ctx)}`;
  const now = Date.now();
  const cached = planAccessCacheByKey.get(cacheKey);
  if (cached && now - cached.ts < PLAN_ACCESS_CACHE_TTL_MS) {
    return cached.accessByPlan.get(planId) || null;
  }
  const access = computePlanAccess(state.clients, ctx.permissions || []);
  if (planAccessCacheByKey.size >= MAX_PLAN_ACCESS_CACHE_ENTRIES) {
    // prune stale first, then FIFO one entry if still full
    for (const [key, entry] of planAccessCacheByKey.entries()) {
      if (now - entry.ts >= PLAN_ACCESS_CACHE_TTL_MS) planAccessCacheByKey.delete(key);
    }
    if (planAccessCacheByKey.size >= MAX_PLAN_ACCESS_CACHE_ENTRIES) {
      const oldestKey = planAccessCacheByKey.keys().next().value;
      if (oldestKey) planAccessCacheByKey.delete(oldestKey);
    }
  }
  planAccessCacheByKey.set(cacheKey, { ts: now, accessByPlan: access });
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
  planAccessCacheByKey.clear();
  return now;
};

const authRuntime = createAuthRuntime({
  db,
  authSecret,
  serverInstanceId,
  PRIMARY_SESSION_COOKIE,
  parseCookies,
  verifySession,
  clearSessionCookie,
  ensureCsrfCookie,
  isStrictSuperAdmin
});
const { requireAuth, getWsAuthContext, getUserLock, clearUserLoginFailures, normalizeLoginKey } = authRuntime;

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

const getWsClientIp = (req) =>
  normalizeIp(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.connection?.remoteAddress || '');

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

registerImportRoutes(app, {
  db,
  dataSecret,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  readState,
  writeState,
  parseCsvRows,
  allowPrivateImportForRequest,
  getImportConfig,
  getDeviceImportConfig,
  getLdapImportConfig,
  getImportConfigSafe,
  getDeviceImportConfigSafe,
  getLdapImportConfigSafe,
  upsertImportConfig,
  upsertDeviceImportConfig,
  upsertLdapImportConfig,
  upsertExternalUsers,
  upsertExternalDevices,
  listImportSummary,
  listDeviceImportSummary,
  resolveEffectiveWebApiConfig,
  fetchEmployeesFromApi,
  fetchDevicesFromApi,
  normalizeExternalUserPayload,
  normalizeExternalDevicePayload,
  normalizeLdapImportConfig,
  resolveLdapEffectiveConfig,
  fetchEmployeesFromLdap,
  prepareLdapImportPreview,
  selectLdapImportRows,
  applyLdapImportOverrides
});

registerExternalDirectoryRoutes(app, {
  db,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  readState,
  getUserWithPermissions,
  computePlanAccess,
  filterStateForUser,
  listExternalUsers,
  listExternalDevices,
  setExternalUserHidden,
  setExternalDeviceHidden,
  upsertManualExternalUser,
  deleteManualExternalUser,
  upsertManualExternalDevice,
  deleteManualExternalDevice,
  getExternalUser,
  getExternalDevice,
  updateExternalUser,
  isManualExternalId,
  isManualDeviceId
});

registerDataRoutes(app, {
  db,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  markLogsCleared,
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getObjectCustomValues,
  setObjectCustomValues,
  validateValuesAgainstFields,
  readState,
  writeState,
  getUserWithPermissions,
  buildPermissionCacheKey,
  filteredStateCache,
  computePlanAccess,
  filterStateForUser,
  getWritablePlanIdsForStateSave,
  mergeWritablePlanContent,
  validateAssetsInClients,
  purgeExpiredLocks,
  planLocks,
  planLockGrants
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
  logEmailAttempt,
  fallbackPortalPublicUrl: serverConfig.publicAppUrl
});

registerAuthRoutes(app, {
  db,
  readState,
  authSecret,
  serverInstanceId,
  requestMeta,
  writeAuthLog,
  writeAuditLog,
  getUserWithPermissions,
  computePlanAccess,
  ensureBootstrapAdmins,
  verifyPassword,
  hashPassword,
  isStrongPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  parseCookies,
  verifySession,
  PRIMARY_SESSION_COOKIE,
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  verifyTotp,
  buildMobilePublicUrl,
  shouldUseSecureCookie,
  ensureCsrfCookie,
  clearCsrfCookie,
  validateDataUrl,
  externalizeDataUrl,
  wsClientInfo,
  planLocks,
  emitLockState,
  emitGlobalPresence,
  runtime: authRuntime
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

registerSettingsRoutes(app, {
  db,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  getAuditVerboseEnabled,
  setAuditVerboseEnabled,
  getEmailConfigSafe,
  getEmailConfig,
  upsertEmailConfig,
  getClientEmailConfigSafe,
  getClientEmailConfig,
  upsertClientEmailConfig,
  normalizePortalPublicUrl,
  getPortalPublicUrl,
  setPortalPublicUrl,
  logEmailAttempt,
  listEmailLogs,
  readState,
  APP_BRAND,
  dataSecret,
  fallbackPortalPublicUrl: serverConfig.publicAppUrl,
  readLogsMeta,
  resolveUsername,
  markLogsCleared
});

registerAdminLogRoutes(app, {
  db,
  requireAuth,
  markLogsCleared,
  writeAuditLog,
  requestMeta
});

runLogRetentionCleanup('startup');
const logsRetentionCleanupTimer = setInterval(() => {
  runLogRetentionCleanup('interval');
}, 12 * 60 * 60 * 1000);
if (typeof logsRetentionCleanupTimer.unref === 'function') logsRetentionCleanupTimer.unref();

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
  cspAllowEval: serverConfig.cspAllowEval,
  cspAllowMediaPipe: serverConfig.cspAllowMediaPipe,
  backupDir: resolveBackupDir(),
  backupRetention: resolveBackupRetention()
});
console.log(`[plixmap] API listening on http://${hostHint}:${PORT}`);
if (HOST === '0.0.0.0') {
  console.log(`[plixmap] API listening on all interfaces (http://0.0.0.0:${PORT})`);
}
