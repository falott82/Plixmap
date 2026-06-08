const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const express = require('express');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const { normalizeHttpUrl, serverConfig, validateServerConfig } = require('./config.cjs');
const { openDb, getOrCreateAuthSecret, getOrCreateDataSecret, listMigrationStatus } = require('./db.cjs');
const { createDatabaseBackup, listBackups, resolveBackupDir, resolveBackupRetention } = require('./backup.cjs');
const { evaluateCsrfRequest } = require('./csrf.cjs');
const { createAssetPipeline } = require('./assetPipeline.cjs');
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
const { getWritablePlanIdsForStateSave, hasStateSaveVersionConflict } = require('./stateSaveGuards.cjs');
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
  // Needed for media capture features (for example voice notes in client chat via getUserMedia).
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
  const cookies = parseCookies(req.headers.cookie);
  const result = evaluateCsrfRequest({
    method: req.method,
    path: req.path,
    cookieToken: cookies[CSRF_COOKIE],
    headerToken: req.headers[CSRF_HEADER],
    origin: req.headers.origin,
    referer: req.headers.referer,
    host: req.headers.host,
    protocol: req.protocol
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  next();
});

const uploadsDir = path.join(process.cwd(), 'data', 'uploads');

// Fail fast if the directories the server needs are missing or not writable,
// rather than surfacing as a confusing error on the first DB/upload write.
try {
  validateServerConfig(serverConfig, { uploadsDir });
} catch (error) {
  serverLog('error', 'invalid_server_config', { error: String(error?.message || error) });
  // eslint-disable-next-line no-console
  console.error(String(error?.message || error));
  process.exit(1);
}

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

const {
  CAPACITY_SNAPSHOT_MIN_INTERVAL_MS,
  resolveVisibleClientsForRequest,
  buildCapacityTrendSnapshot,
  buildCapacitySnapshotSignature,
  createCapacityHistoryStore
} = require('./capacityTrends.cjs');
const { readCapacityHistory, writeCapacityHistory } = createCapacityHistoryStore({ getAppSetting, setAppSetting });

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


const {
  parseDataUrl,
  validateDataUrl,
  validateAssetsInClients,
  externalizeDataUrl,
  externalizeAssetsInClients
} = createAssetPipeline({ uploadsDir });

const planRevisionsCache = new Map();

const parseRevisionListJson = (raw) => {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getPlanRevisions = (planId) => {
  const key = String(planId || '').trim();
  if (!key) return [];
  if (planRevisionsCache.has(key)) return planRevisionsCache.get(key) || [];
  const row = db.prepare('SELECT revisionsJson FROM plan_revisions WHERE planId = ?').get(key);
  const revisions = parseRevisionListJson(row?.revisionsJson);
  planRevisionsCache.set(key, revisions);
  return revisions;
};

const setPlanRevisions = (planId, revisions, updatedAt = Date.now()) => {
  const key = String(planId || '').trim();
  if (!key) return [];
  const normalized = Array.isArray(revisions) ? revisions : [];
  if (normalized.length) {
    db.prepare(
      `INSERT INTO plan_revisions (planId, revisionsJson, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(planId) DO UPDATE SET revisionsJson = excluded.revisionsJson, updatedAt = excluded.updatedAt`
    ).run(key, JSON.stringify(normalized), updatedAt);
  } else {
    db.prepare('DELETE FROM plan_revisions WHERE planId = ?').run(key);
  }
  planRevisionsCache.set(key, normalized);
  return normalized;
};

const stripPlanRevisionsFromClients = (clients) => {
  if (!Array.isArray(clients)) return;
  for (const client of clients || []) {
    for (const site of client?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        if (plan && typeof plan === 'object' && 'revisions' in plan) delete plan.revisions;
      }
    }
  }
};

const replaceStoredPlanRevisionsFromClients = (clients, updatedAt) => {
  const nextPlanIds = new Set();
  if (Array.isArray(clients)) {
    for (const client of clients || []) {
      for (const site of client?.sites || []) {
        for (const plan of site?.floorPlans || []) {
          const planId = String(plan?.id || '').trim();
          if (!planId) continue;
          nextPlanIds.add(planId);
          setPlanRevisions(planId, Array.isArray(plan?.revisions) ? plan.revisions : [], updatedAt);
        }
      }
    }
  }
  const existingRows = db.prepare('SELECT planId FROM plan_revisions').all();
  const deleteRevisionSet = db.prepare('DELETE FROM plan_revisions WHERE planId = ?');
  for (const row of existingRows || []) {
    const planId = String(row?.planId || '').trim();
    if (!planId || nextPlanIds.has(planId)) continue;
    deleteRevisionSet.run(planId);
    planRevisionsCache.delete(planId);
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

const writeState = (payload, options = {}) => {
  const now = Date.now();
  const replacePlanRevisions = !!options?.replacePlanRevisions;
  // Store large binary blobs (plan images, client logos, pdf attachments) as files instead of inline data URLs.
  // This keeps the JSON state small and avoids huge stringify/GC churn on clients.
  if (payload && payload.clients) {
    externalizeAssetsInClients(payload.clients);
    if (replacePlanRevisions) replaceStoredPlanRevisionsFromClients(payload.clients, now);
    stripPlanRevisionsFromClients(payload.clients);
  }
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

app.get('/api/settings/package-updates', requireAuth, (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const raw = getAppSetting('packageUpdatesLastCheck');
  let lastCheckAt = null;
  let lastCheckBy = null;
  let lastCheckUserId = null;
  let count = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        lastCheckAt = Number(parsed.ts || parsed.lastCheckAt || 0) || null;
        lastCheckUserId = parsed.userId || null;
        lastCheckBy = parsed.username || resolveUsername(parsed.userId) || null;
        count = Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : null;
      } else {
        lastCheckAt = Number(raw) || null;
      }
    } catch {
      lastCheckAt = Number(raw) || null;
    }
  }
  res.json({ lastCheckAt, lastCheckBy, lastCheckUserId, count });
});

app.post('/api/settings/package-updates', requireAuth, rateByUser('package_updates', 5 * 60 * 1000, 6), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const startedAt = Date.now();
  const checkedAt = Date.now();
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFile(
    npmCmd,
    ['outdated', '--json', '--long'],
    { cwd: process.cwd(), timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      const exitCode = err && typeof err.code === 'number' ? err.code : 0;
      const trim = (text) => {
        const src = String(text || '');
        if (src.length <= 20000) return src;
        return `${src.slice(0, 20000)}\n... (truncated)`;
      };
      let parsed = {};
      let parseOk = true;
      if (String(stdout || '').trim()) {
        try {
          parsed = JSON.parse(stdout);
        } catch {
          parseOk = false;
        }
      }
      const packages = parseOk
        ? Object.entries(parsed || {})
            .map(([name, info]) => ({
              name,
              current: String(info?.current || ''),
              wanted: String(info?.wanted || ''),
              latest: String(info?.latest || ''),
              scope:
                info?.type === 'dependencies' ||
                info?.type === 'devDependencies' ||
                info?.type === 'optionalDependencies' ||
                info?.type === 'peerDependencies'
                  ? info.type
                  : 'unknown',
              dependent: info?.dependent || null,
              homepage: info?.homepage || null,
              type: info?.type || null
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];
      const ok = parseOk && (!err || exitCode === 1);
      if (ok) {
        writeAuditLog(db, {
          level: 'important',
          event: 'package_updates_check',
          userId: req.userId,
          ...requestMeta(req),
          details: { count: packages.length, exitCode, durationMs: Date.now() - startedAt }
        });
        setAppSetting(
          'packageUpdatesLastCheck',
          JSON.stringify({
            ts: checkedAt,
            userId: req.userId || null,
            username: req.username || resolveUsername(req.userId) || null,
            count: packages.length
          })
        );
      }
      res.json({
        ok,
        packages,
        count: packages.length,
        checkedAt,
        durationMs: Date.now() - startedAt,
        exitCode,
        lastCheckBy: req.username || resolveUsername(req.userId) || null,
        lastCheckUserId: req.userId || null,
        error: !ok ? (err?.message || 'Failed to check package updates') : undefined,
        stderr: trim(stderr)
      });
    }
  );
});

app.post('/api/settings/code-analyzer', requireAuth, rateByUser('code_analyzer', 60 * 1000, 20), (req, res) => {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const root = process.cwd();
  const ignoredDirs = new Set([
    '.git',
    '.idea',
    '.next',
    '.turbo',
    '.vite',
    'coverage',
    'data',
    'dist',
    'node_modules',
    'release-data',
    'test-results'
  ]);
  const ignoredFiles = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'plix.log']);
  const allowedExt = new Set(['.cjs', '.css', '.html', '.js', '.jsx', '.mjs', '.scss', '.ts', '.tsx']);
  const maxBytes = 2 * 1024 * 1024;
  const rows = [];
  const countMatches = (text, re) => {
    const matches = text.match(re);
    return matches ? matches.length : 0;
  };
  const isCodeLine = (line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) return false;
    return true;
  };
  const formatBytes = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };
  const scanDir = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry || entry.name.startsWith('.') && entry.name !== '.githooks') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) scanDir(fullPath);
        continue;
      }
      if (!entry.isFile() || ignoredFiles.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExt.has(ext)) continue;
      let stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (!stat || stat.size > maxBytes) continue;
      let text = '';
      try {
        text = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      const lines = text.split(/\r?\n/);
      const codeLines = lines.filter(isCodeLine).length;
      const isJsxFile = ext === '.tsx' || ext === '.jsx';
      const rel = path.relative(root, fullPath);
      rows.push({
        name: entry.name,
        path: rel,
        codeLines,
        hooks: countMatches(text, /\buse[A-Z0-9]\w*\s*\(/g),
        responsive: countMatches(text, /\b(?:sm|md|lg|xl|2xl):/g) + countMatches(text, /@media\b/g),
        jsx: isJsxFile ? countMatches(text, /<\/?[A-Za-z][A-Za-z0-9:._-]*(?:\s|>|\/>)/g) : 0,
        functions: countMatches(text, /\bfunction\b/g) + countMatches(text, /=>/g),
        propTypes: countMatches(text, /\b(?:type|interface)\s+\w*Props\b/g),
        propRefs: countMatches(text, /\bprops\./g) + countMatches(text, /\{[^}\n]*\}\s*:\s*\w*Props\b/g),
        bytes: stat.size,
        weight: formatBytes(stat.size)
      });
    }
  };
  try {
    scanDir(root);
    rows.sort((a, b) => b.codeLines - a.codeLines || b.bytes - a.bytes || a.path.localeCompare(b.path));
    const ranked = rows.slice(0, 150).map((row, idx) => ({ rank: idx + 1, ...row }));
    const totalLines = rows.reduce((sum, row) => sum + row.codeLines, 0);
    res.json({
      ok: true,
      root,
      filesScanned: rows.length,
      totalLines,
      largestFileLines: rows[0]?.codeLines || 0,
      updatedAt: Date.now(),
      files: ranked
    });
  } catch (err) {
    res.status(500).json({ ok: false, root, filesScanned: 0, totalLines: 0, largestFileLines: 0, updatedAt: Date.now(), files: [], error: err?.message || 'Code analysis failed' });
  }
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
  getPlanRevisions,
  setPlanRevisions,
  getUserWithPermissions,
  buildPermissionCacheKey,
  filteredStateCache,
  computePlanAccess,
  filterStateForUser,
  getWritablePlanIdsForStateSave,
  hasStateSaveVersionConflict,
  mergeWritablePlanContent,
  validateAssetsInClients,
  externalizeAssetsInClients,
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
  serverLog,
  chat: chatServices
});

registerMeetingRoutes(app, {
  db,
  requireAuth,
  rateLimit,
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
