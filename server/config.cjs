const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_SECRET_MIN_LENGTH = 32;
const DEFAULT_BACKUP_RETENTION = 20;
const DEFAULT_IMPORT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_UPLOAD_MAX_IMAGE_MB = 12;
const DEFAULT_UPLOAD_MAX_PDF_MB = 20;
const DEFAULT_CHAT_MAX_VOICE_MB = 40;
const DEFAULT_UPDATE_MANIFEST_URL = 'https://www.plixmap.com/updates/latest.json';
const DEFAULT_UPDATE_MANIFEST_FALLBACK_URL = 'https://raw.githubusercontent.com/falott82/plixmap.com/main/updates/latest.json';
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);
const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

const readEnv = (env, name) => env?.[name];

const parseEnabled = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return ENABLED_VALUES.has(normalized);
};

const parseBooleanStrict = (name, value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;
  throw new Error(`${name} must be one of: 1,true,yes,on,0,false,no,off`);
};

const parseOptionalBooleanStrict = (name, value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;
  throw new Error(`${name} must be one of: 1,true,yes,on,0,false,no,off`);
};

const parseInteger = (value, fallback, { min = null, max = null } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (min !== null && normalized < min) return fallback;
  if (max !== null && normalized > max) return fallback;
  return normalized;
};

const parsePort = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PORT;
  const normalized = Math.floor(parsed);
  if (normalized < 0 || normalized > 65535) return DEFAULT_PORT;
  return normalized;
};

const parseMegabytes = (value, fallbackMb) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMb * 1024 * 1024;
  return parsed * 1024 * 1024;
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

const resolveDefaultDbPath = (cwd = process.cwd()) => {
  const plixmapDb = path.join(cwd, 'data', 'plixmap.sqlite');
  const desklyDb = path.join(cwd, 'data', 'deskly.sqlite');
  if (fs.existsSync(plixmapDb)) return plixmapDb;
  if (fs.existsSync(desklyDb)) return desklyDb;
  return plixmapDb;
};

const parseTrustProxy = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;
  return trimmed;
};

const readSecretInput = (baseName, env = process.env) => {
  const fileVar = readEnv(env, `${baseName}_FILE`);
  if (typeof fileVar === 'string' && fileVar.trim()) {
    const filePath = String(fileVar).trim();
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      throw new Error(`${baseName}_FILE unreadable (${filePath}): ${error?.message || 'read failed'}`);
    }
  }
  const direct = readEnv(env, baseName);
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return '';
};

const createServerConfig = (env = process.env, options = {}) => {
  const cwd = options.cwd || process.cwd();
  const cspAllowMediaPipe = parseEnabled(readEnv(env, 'PLIXMAP_CSP_ALLOW_MEDIAPIPE'), false);
  const cspAllowEval = parseEnabled(readEnv(env, 'PLIXMAP_CSP_ALLOW_EVAL'), false) || cspAllowMediaPipe;
  const requestedLogLevel = String(readEnv(env, 'PLIXMAP_LOG_LEVEL') || DEFAULT_LOG_LEVEL).trim().toLowerCase();

  return Object.freeze({
    nodeEnv: String(readEnv(env, 'NODE_ENV') || '').trim().toLowerCase() || 'development',
    port: parsePort(readEnv(env, 'PORT')),
    host: String(readEnv(env, 'HOST') || DEFAULT_HOST).trim() || DEFAULT_HOST,
    dbPath: String(readEnv(env, 'PLIXMAP_DB_PATH') || '').trim() || resolveDefaultDbPath(cwd),
    publicAppUrl: String(readEnv(env, 'PUBLIC_APP_URL') || '').trim(),
    requireEnvSecrets: parseBooleanStrict('PLIXMAP_REQUIRE_ENV_SECRETS', readEnv(env, 'PLIXMAP_REQUIRE_ENV_SECRETS'), false),
    secretMinLength: parseInteger(readEnv(env, 'PLIXMAP_SECRET_MIN_LENGTH'), DEFAULT_SECRET_MIN_LENGTH, { min: 16 }),
    backupDir: String(readEnv(env, 'PLIXMAP_BACKUP_DIR') || '').trim() || path.join(cwd, 'data', 'backups'),
    backupRetention: parseInteger(readEnv(env, 'PLIXMAP_BACKUP_KEEP'), DEFAULT_BACKUP_RETENTION, { min: 1, max: 365 }),
    cspAllowEval,
    cspAllowMediaPipe,
    logLevel: LOG_LEVELS.has(requestedLogLevel) ? requestedLogLevel : DEFAULT_LOG_LEVEL,
    trustProxy: parseTrustProxy(readEnv(env, 'PLIXMAP_TRUST_PROXY')),
    cookieSecureOverride: parseOptionalBooleanStrict('PLIXMAP_COOKIE_SECURE', readEnv(env, 'PLIXMAP_COOKIE_SECURE')),
    uploadMaxImageBytes: parseMegabytes(readEnv(env, 'PLIXMAP_UPLOAD_MAX_IMAGE_MB'), DEFAULT_UPLOAD_MAX_IMAGE_MB),
    uploadMaxPdfBytes: parseMegabytes(readEnv(env, 'PLIXMAP_UPLOAD_MAX_PDF_MB'), DEFAULT_UPLOAD_MAX_PDF_MB),
    importMaxResponseBytes: parseInteger(readEnv(env, 'PLIXMAP_IMPORT_MAX_BYTES'), DEFAULT_IMPORT_MAX_RESPONSE_BYTES, { min: 1 }),
    importAllowPrivate: parseEnabled(readEnv(env, 'PLIXMAP_IMPORT_ALLOW_PRIVATE'), false),
    updateManifestUrl: normalizeHttpUrl(readEnv(env, 'PLIXMAP_UPDATE_MANIFEST_URL')) || DEFAULT_UPDATE_MANIFEST_URL,
    updateManifestFallbackUrl:
      normalizeHttpUrl(readEnv(env, 'PLIXMAP_UPDATE_MANIFEST_FALLBACK_URL')) || DEFAULT_UPDATE_MANIFEST_FALLBACK_URL,
    chatMaxVoiceAttachmentBytes: parseMegabytes(readEnv(env, 'PLIXMAP_CHAT_MAX_VOICE_MB'), DEFAULT_CHAT_MAX_VOICE_MB)
  });
};

const serverConfig = createServerConfig();

module.exports = {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_LOG_LEVEL,
  DEFAULT_SECRET_MIN_LENGTH,
  DEFAULT_BACKUP_RETENTION,
  DEFAULT_IMPORT_MAX_RESPONSE_BYTES,
  normalizeHttpUrl,
  parseEnabled,
  readSecretInput,
  resolveDefaultDbPath,
  createServerConfig,
  serverConfig
};
