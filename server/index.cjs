const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const compression = require('compression');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { normalizeHttpUrl, serverConfig, validateServerConfig } = require('./config.cjs');
const { openDb, getOrCreateAuthSecret, getOrCreateDataSecret, listMigrationStatus } = require('./db.cjs');
const { createDatabaseBackup, listBackups, resolveBackupDir, resolveBackupRetention } = require('./backup.cjs');
const { evaluateCsrfRequest } = require('./csrf.cjs');
const { createAssetPipeline } = require('./assetPipeline.cjs');
const { buildCspHeader, normalizeIp, allowPrivateImportForRequest } = require('./network.cjs');
const { createPlanRevisionStore } = require('./planRevisionStore.cjs');
const { createAppSettingsStore } = require('./appSettingsStore.cjs');
const { rateLimit, rateByUser } = require('./rateLimit.cjs');
const { normalizeSemver, compareSemver } = require('./semver.cjs');
const { serverLog } = require('./serverLog.cjs');
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
const { registerMaintenanceRoutes } = require('./routes/maintenance.cjs');
const { registerOpsRoutes } = require('./routes/ops.cjs');
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


const buildKioskPublicUrl = (req, roomId) => buildMeetingRoomPublicUrl(req, roomId);
const buildKioskPublicUploadUrl = (req, rawUrl) => buildPublicUploadUrl(req, rawUrl);
const UPDATE_MANIFEST_URL = serverConfig.updateManifestUrl;
const UPDATE_MANIFEST_FALLBACK_URL = serverConfig.updateManifestFallbackUrl;



const CSP_HEADER_VALUE = buildCspHeader();

const app = express();
// Don't advertise the framework; nothing legitimate depends on this header.
app.disable('x-powered-by');
// Compress every compressible response (JS/CSS bundles, JSON API payloads, HTML).
// Brotli is preferred when the client supports it, gzip otherwise; images/PDFs
// and already-compressed payloads are skipped by the default filter.
app.use(compression({ threshold: 1024 }));
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

const {
  readLogsMeta,
  resolveUsername,
  setAppSetting,
  getAppSetting,
  writeLogsMeta,
  markLogsCleared
} = createAppSettingsStore({ db });

const {
  CAPACITY_SNAPSHOT_MIN_INTERVAL_MS,
  resolveVisibleClientsForRequest,
  buildCapacityTrendSnapshot,
  buildCapacitySnapshotSignature,
  createCapacityHistoryStore
} = require('./capacityTrends.cjs');
const { readCapacityHistory, writeCapacityHistory } = createCapacityHistoryStore({ getAppSetting, setAppSetting });

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
  base64SizeBytes,
  validateDataUrl,
  validateAssetsInClients,
  externalizeDataUrl,
  externalizeAssetsInClients
} = createAssetPipeline({ uploadsDir });

const {
  getPlanRevisions,
  setPlanRevisions,
  stripPlanRevisionsFromClients,
  replaceStoredPlanRevisionsFromClients
} = createPlanRevisionStore({ db });

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


const shouldUseSecureCookie = (req) => resolveSecureCookie(req);

registerMaintenanceRoutes(app, {
  db,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  getAuditVerboseEnabled,
  getAppSetting,
  setAppSetting,
  resolveUsername,
  serverLog,
  normalizeHttpUrl,
  normalizeSemver,
  compareSemver,
  APP_VERSION,
  UPDATE_CHECK_TIMEOUT_MS,
  UPDATE_MANIFEST_URL,
  UPDATE_MANIFEST_FALLBACK_URL
});

registerOpsRoutes(app, {
  db,
  requireAuth,
  rateByUser,
  requestMeta,
  writeAuditLog,
  serverLog,
  readState,
  resolveVisibleClientsForRequest,
  buildCapacityTrendSnapshot,
  buildCapacitySnapshotSignature,
  readCapacityHistory,
  writeCapacityHistory,
  CAPACITY_SNAPSHOT_MIN_INTERVAL_MS,
  listMigrationStatus,
  createDatabaseBackup,
  listBackups,
  resolveBackupDir,
  resolveBackupRetention,
  STARTED_AT,
  // wss is created after the routes are registered; resolve lazily.
  getWsClientCount: () => (wss?.clients ? wss.clients.size : 0)
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
