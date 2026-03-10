const DAY_MS = 24 * 60 * 60 * 1000;
const LOG_RETENTION_SETTINGS_KEY = 'logsRetentionSettingsV1';
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 90;
const DEFAULT_RETENTION_DAYS = 30;
const LOG_RETENTION_KINDS = ['auth', 'mail', 'audit'];

const LOG_TABLES = {
  auth: {
    table: 'auth_log',
    orderBy: 'ts DESC, id DESC',
    columns: ['id', 'ts', 'event', 'success', 'userId', 'username', 'ip', 'method', 'path', 'userAgent', 'details'],
    csvHeader: ['ts', 'event', 'success', 'userId', 'username', 'ip', 'method', 'path', 'userAgent', 'details']
  },
  mail: {
    table: 'email_log',
    orderBy: 'ts DESC, id DESC',
    columns: ['id', 'ts', 'userId', 'username', 'recipient', 'subject', 'success', 'error', 'details'],
    csvHeader: ['ts', 'userId', 'username', 'recipient', 'subject', 'success', 'error', 'details']
  },
  audit: {
    table: 'audit_log',
    orderBy: 'ts DESC, id DESC',
    columns: ['id', 'ts', 'level', 'event', 'userId', 'username', 'ip', 'method', 'path', 'userAgent', 'scopeType', 'scopeId', 'details'],
    csvHeader: ['ts', 'level', 'event', 'userId', 'username', 'ip', 'method', 'path', 'userAgent', 'scopeType', 'scopeId', 'details']
  }
};

const formatTimestamp = (ts) => {
  const date = new Date(Number(ts) || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString();
};

const escapeCsv = (value) => {
  const raw = String(value ?? '');
  if (!/[,"\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const defaultLogRetentionSettings = () => ({
  auth: { days: DEFAULT_RETENTION_DAYS, autoCleanup: true },
  mail: { days: DEFAULT_RETENTION_DAYS, autoCleanup: true },
  audit: { days: DEFAULT_RETENTION_DAYS, autoCleanup: true }
});

const normalizeDays = (value) => {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return DEFAULT_RETENTION_DAYS;
  return Math.max(MIN_RETENTION_DAYS, Math.min(MAX_RETENTION_DAYS, numeric));
};

const normalizeLogRetentionSettings = (value) => {
  const base = defaultLogRetentionSettings();
  for (const kind of LOG_RETENTION_KINDS) {
    const source = value && typeof value === 'object' ? value[kind] : null;
    base[kind] = {
      days: normalizeDays(source?.days),
      autoCleanup: source?.autoCleanup !== false
    };
  }
  return base;
};

const getCutoffTsForDays = (days, now = Date.now()) => {
  return Number(now) - normalizeDays(days) * DAY_MS;
};

const readLogRetentionSettings = (db) => {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(LOG_RETENTION_SETTINGS_KEY);
    if (!row?.value) return defaultLogRetentionSettings();
    return normalizeLogRetentionSettings(JSON.parse(row.value));
  } catch {
    return defaultLogRetentionSettings();
  }
};

const hasStoredLogRetentionSettings = (db) => {
  try {
    return !!db.prepare('SELECT 1 FROM app_settings WHERE key = ? LIMIT 1').get(LOG_RETENTION_SETTINGS_KEY);
  } catch {
    return false;
  }
};

const writeLogRetentionSettings = (db, settings) => {
  const normalized = normalizeLogRetentionSettings(settings);
  const now = Date.now();
  db.prepare(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt`
  ).run(LOG_RETENTION_SETTINGS_KEY, JSON.stringify(normalized), now);
  return normalized;
};

const getLogTableConfig = (kind) => {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  return LOG_TABLES[normalizedKind] || null;
};

const getExpiredLogPreviewForKind = (db, kind, settings, now = Date.now()) => {
  const table = getLogTableConfig(kind);
  if (!table) throw new Error(`Unsupported log kind: ${kind}`);
  const config = normalizeLogRetentionSettings(settings)[kind];
  const cutoffTs = getCutoffTsForDays(config.days, now);
  const aggregates = db
    .prepare(`SELECT COUNT(1) as count, MIN(ts) as oldestTs, MAX(ts) as newestTs FROM ${table.table} WHERE ts < ?`)
    .get(cutoffTs);
  return {
    kind,
    days: config.days,
    autoCleanup: !!config.autoCleanup,
    cutoffTs,
    count: Number(aggregates?.count || 0),
    oldestTs: aggregates?.oldestTs ? Number(aggregates.oldestTs) : null,
    newestTs: aggregates?.newestTs ? Number(aggregates.newestTs) : null
  };
};

const buildLogRetentionPreview = (db, settings, now = Date.now()) => {
  const normalized = normalizeLogRetentionSettings(settings);
  const byKind = {};
  let totalCount = 0;
  for (const kind of LOG_RETENTION_KINDS) {
    const preview = getExpiredLogPreviewForKind(db, kind, normalized, now);
    byKind[kind] = preview;
    totalCount += preview.autoCleanup ? preview.count : 0;
  }
  return {
    now,
    settings: normalized,
    totalCount,
    byKind
  };
};

const listExpiredLogRows = (db, kind, settings, now = Date.now()) => {
  const table = getLogTableConfig(kind);
  if (!table) throw new Error(`Unsupported log kind: ${kind}`);
  const preview = getExpiredLogPreviewForKind(db, kind, settings, now);
  const rows = db
    .prepare(
      `SELECT ${table.columns.join(', ')}
       FROM ${table.table}
       WHERE ts < ?
       ORDER BY ${table.orderBy}`
    )
    .all(preview.cutoffTs);
  return { preview, rows };
};

const buildExpiredLogsCsv = (db, kind, settings, now = Date.now()) => {
  const table = getLogTableConfig(kind);
  if (!table) throw new Error(`Unsupported log kind: ${kind}`);
  const { rows } = listExpiredLogRows(db, kind, settings, now);
  const lines = [table.csvHeader.join(',')];
  for (const row of rows) {
    const values = table.csvHeader.map((column) => {
      if (column === 'ts') return formatTimestamp(row.ts);
      if (column === 'success') return row.success ? 'true' : 'false';
      return row[column];
    });
    lines.push(values.map(escapeCsv).join(','));
  }
  return lines.join('\n');
};

const purgeExpiredLogs = (db, settings, now = Date.now()) => {
  const normalized = normalizeLogRetentionSettings(settings);
  const byKind = {};
  let totalDeleted = 0;
  for (const kind of LOG_RETENTION_KINDS) {
    const table = getLogTableConfig(kind);
    const config = normalized[kind];
    const cutoffTs = getCutoffTsForDays(config.days, now);
    const deleted = config.autoCleanup
      ? Number(db.prepare(`DELETE FROM ${table.table} WHERE ts < ?`).run(cutoffTs).changes || 0)
      : 0;
    byKind[kind] = {
      kind,
      days: config.days,
      autoCleanup: !!config.autoCleanup,
      cutoffTs,
      deleted
    };
    totalDeleted += deleted;
  }
  return { now, settings: normalized, totalDeleted, byKind };
};

module.exports = {
  DAY_MS,
  LOG_RETENTION_KINDS,
  MIN_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  DEFAULT_RETENTION_DAYS,
  defaultLogRetentionSettings,
  normalizeLogRetentionSettings,
  hasStoredLogRetentionSettings,
  readLogRetentionSettings,
  writeLogRetentionSettings,
  getCutoffTsForDays,
  getExpiredLogPreviewForKind,
  buildLogRetentionPreview,
  listExpiredLogRows,
  buildExpiredLogsCsv,
  purgeExpiredLogs
};
