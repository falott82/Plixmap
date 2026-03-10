const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const {
  DEFAULT_RETENTION_DAYS,
  buildExpiredLogsCsv,
  buildLogRetentionPreview,
  normalizeLogRetentionSettings,
  purgeExpiredLogs,
  readLogRetentionSettings,
  writeLogRetentionSettings
} = require('../server/logRetention.cjs');

const createDb = () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE auth_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      event TEXT NOT NULL,
      success INTEGER NOT NULL,
      userId TEXT,
      username TEXT,
      ip TEXT,
      method TEXT,
      path TEXT,
      userAgent TEXT,
      details TEXT
    );
    CREATE TABLE email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      userId TEXT,
      username TEXT,
      recipient TEXT,
      subject TEXT,
      success INTEGER NOT NULL,
      error TEXT,
      details TEXT
    );
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      userId TEXT,
      username TEXT,
      ip TEXT,
      method TEXT,
      path TEXT,
      userAgent TEXT,
      scopeType TEXT,
      scopeId TEXT,
      details TEXT
    );
  `);
  return db;
};

test('read/write log retention settings use 30 days defaults', () => {
  const db = createDb();
  assert.deepEqual(readLogRetentionSettings(db), {
    auth: { days: DEFAULT_RETENTION_DAYS, autoCleanup: true },
    mail: { days: DEFAULT_RETENTION_DAYS, autoCleanup: true },
    audit: { days: DEFAULT_RETENTION_DAYS, autoCleanup: true }
  });

  const saved = writeLogRetentionSettings(db, {
    auth: { days: 5, autoCleanup: false },
    mail: { days: 120, autoCleanup: true },
    audit: { days: 0, autoCleanup: true }
  });

  assert.deepEqual(saved, {
    auth: { days: 5, autoCleanup: false },
    mail: { days: 90, autoCleanup: true },
    audit: { days: 1, autoCleanup: true }
  });
  assert.deepEqual(readLogRetentionSettings(db), saved);
});

test('preview and purge retention only affect enabled kinds', () => {
  const db = createDb();
  const now = Date.UTC(2026, 2, 10, 12, 0, 0);
  const oldTs = now - 45 * 24 * 60 * 60 * 1000;
  const freshTs = now - 5 * 24 * 60 * 60 * 1000;

  db.prepare('INSERT INTO auth_log (ts, event, success) VALUES (?, ?, ?)').run(oldTs, 'login', 1);
  db.prepare('INSERT INTO auth_log (ts, event, success) VALUES (?, ?, ?)').run(freshTs, 'logout', 1);
  db.prepare('INSERT INTO email_log (ts, success, recipient) VALUES (?, ?, ?)').run(oldTs, 1, 'ops@example.com');
  db.prepare('INSERT INTO audit_log (ts, level, event) VALUES (?, ?, ?)').run(oldTs, 'important', 'settings_update');

  const settings = normalizeLogRetentionSettings({
    auth: { days: 30, autoCleanup: true },
    mail: { days: 30, autoCleanup: false },
    audit: { days: 30, autoCleanup: true }
  });

  const preview = buildLogRetentionPreview(db, settings, now);
  assert.equal(preview.byKind.auth.count, 1);
  assert.equal(preview.byKind.mail.count, 1);
  assert.equal(preview.byKind.audit.count, 1);
  assert.equal(preview.totalCount, 2);

  const purge = purgeExpiredLogs(db, settings, now);
  assert.equal(purge.totalDeleted, 2);
  assert.equal(Number(db.prepare('SELECT COUNT(1) as c FROM auth_log').get().c), 1);
  assert.equal(Number(db.prepare('SELECT COUNT(1) as c FROM email_log').get().c), 1);
  assert.equal(Number(db.prepare('SELECT COUNT(1) as c FROM audit_log').get().c), 0);
});

test('expired logs CSV includes old rows only and preserves headers', () => {
  const db = createDb();
  const now = Date.UTC(2026, 2, 10, 12, 0, 0);
  db.prepare('INSERT INTO email_log (ts, userId, username, recipient, subject, success, error, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    now - 40 * 24 * 60 * 60 * 1000,
    'u1',
    'mario',
    'ops@example.com',
    'Nightly report',
    0,
    'SMTP timeout',
    '{"kind":"test"}'
  );
  db.prepare('INSERT INTO email_log (ts, userId, username, recipient, subject, success, error, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    now - 2 * 24 * 60 * 60 * 1000,
    'u2',
    'anna',
    'help@example.com',
    'Fresh mail',
    1,
    null,
    null
  );

  const csv = buildExpiredLogsCsv(
    db,
    'mail',
    {
      auth: { days: 30, autoCleanup: true },
      mail: { days: 30, autoCleanup: true },
      audit: { days: 30, autoCleanup: true }
    },
    now
  );

  assert.match(csv, /^ts,userId,username,recipient,subject,success,error,details/m);
  assert.match(csv, /ops@example\.com/);
  assert.doesNotMatch(csv, /Fresh mail/);
});
