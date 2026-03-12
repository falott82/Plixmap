const Database = require('better-sqlite3');
const { performance } = require('node:perf_hooks');

const LOG_ROWS = Math.max(1000, Number(process.env.BENCH_LOG_ROWS) || 120000);
const USER_ROWS = Math.max(1000, Number(process.env.BENCH_USER_ROWS) || 150000);
const REPEATS = Math.max(3, Number(process.env.BENCH_REPEATS) || 8);

const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
};

const measureStatement = (stmt, params, mode = 'all') => {
  if (mode === 'get') stmt.get(...params);
  else stmt.all(...params);
  const samples = [];
  for (let i = 0; i < REPEATS; i += 1) {
    const start = performance.now();
    if (mode === 'get') stmt.get(...params);
    else stmt.all(...params);
    samples.push(performance.now() - start);
  }
  return {
    avgMs: Number(average(samples).toFixed(3)),
    p95Ms: Number(percentile(samples, 95).toFixed(3))
  };
};

const runBenchmarks = (db, cutoffTs) => {
  const q = {
    authRecent: db.prepare('SELECT id, ts, event FROM auth_log ORDER BY ts DESC LIMIT 200 OFFSET 0'),
    authExpiredAgg: db.prepare('SELECT COUNT(1) as c, MIN(ts) as minTs, MAX(ts) as maxTs FROM auth_log WHERE ts < ?'),
    authExpiredRows: db.prepare('SELECT id, ts, event FROM auth_log WHERE ts < ? ORDER BY ts DESC, id DESC LIMIT 5000'),
    emailExpiredRows: db.prepare('SELECT id, ts, recipient FROM email_log WHERE ts < ? ORDER BY ts DESC, id DESC LIMIT 5000'),
    auditByLevel: db.prepare('SELECT id, ts, level, event FROM audit_log WHERE level = ? ORDER BY id DESC LIMIT 500 OFFSET 0'),
    externalUsersVisible: db.prepare(
      'SELECT externalId, firstName, lastName FROM external_users WHERE clientId = ? AND hidden = 0 AND present = 1 LIMIT 5000'
    )
  };
  return {
    authRecent: measureStatement(q.authRecent, []),
    authExpiredAgg: measureStatement(q.authExpiredAgg, [cutoffTs], 'get'),
    authExpiredRows: measureStatement(q.authExpiredRows, [cutoffTs]),
    emailExpiredRows: measureStatement(q.emailExpiredRows, [cutoffTs]),
    auditByLevel: measureStatement(q.auditByLevel, ['important']),
    externalUsersVisible: measureStatement(q.externalUsersVisible, ['c3'])
  };
};

const db = new Database(':memory:');
db.pragma('journal_mode = MEMORY');
db.pragma('synchronous = OFF');
db.pragma('temp_store = MEMORY');
db.exec(`
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
  CREATE TABLE external_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId TEXT NOT NULL,
    externalId TEXT NOT NULL,
    firstName TEXT NOT NULL DEFAULT '',
    lastName TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    dept1 TEXT NOT NULL DEFAULT '',
    dept2 TEXT NOT NULL DEFAULT '',
    dept3 TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    mobile TEXT NOT NULL DEFAULT '',
    ext1 TEXT NOT NULL DEFAULT '',
    ext2 TEXT NOT NULL DEFAULT '',
    ext3 TEXT NOT NULL DEFAULT '',
    isExternal INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    present INTEGER NOT NULL DEFAULT 1,
    lastSeenAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(clientId, externalId)
  );
`);

const now = Date.now();
const authInsert = db.prepare(
  'INSERT INTO auth_log (ts, event, success, userId, username, ip, method, path, userAgent, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const emailInsert = db.prepare(
  'INSERT INTO email_log (ts, userId, username, recipient, subject, success, error, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const auditInsert = db.prepare(
  'INSERT INTO audit_log (ts, level, event, userId, username, ip, method, path, userAgent, scopeType, scopeId, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const userInsert = db.prepare(
  `INSERT INTO external_users (clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

db.transaction(() => {
  for (let i = 0; i < LOG_ROWS; i += 1) {
    const ts = now - i * 120000;
    authInsert.run(ts, `evt_${i % 12}`, i % 2, `u${i % 5000}`, `user${i % 5000}`, `10.0.${i % 255}.${i % 255}`, 'POST', '/api/auth/login', 'bench', '{}');
    emailInsert.run(ts, `u${i % 3000}`, `user${i % 3000}`, `recipient${i}@mail.test`, `subject ${i % 40}`, i % 2, null, '{}');
    auditInsert.run(
      ts,
      i % 4 === 0 ? 'verbose' : 'important',
      `audit_${i % 20}`,
      `u${i % 3500}`,
      `user${i % 3500}`,
      `10.1.${i % 255}.${i % 255}`,
      'POST',
      '/api/audit',
      'bench',
      i % 2 ? 'client' : 'site',
      `scope-${i % 50}`,
      '{}'
    );
  }
  for (let i = 0; i < USER_ROWS; i += 1) {
    const clientId = `c${i % 7}`;
    userInsert.run(
      clientId,
      `ext-${i}`,
      `name${i}`,
      `surname${i}`,
      `role${i % 30}`,
      `dept${i % 10}`,
      '',
      '',
      `user${i}@corp.test`,
      `${i}`,
      '',
      '',
      '',
      0,
      i % 10 === 0 ? 1 : 0,
      i % 9 === 0 ? 0 : 1,
      now - i * 1000,
      now - i * 1000,
      now - i * 500
    );
  }
})();

const cutoffTs = now - 30 * 24 * 60 * 60 * 1000;
const explainBefore = {
  authExpiredRows: db
    .prepare('EXPLAIN QUERY PLAN SELECT id, ts, event FROM auth_log WHERE ts < ? ORDER BY ts DESC, id DESC LIMIT 5000')
    .all(cutoffTs),
  externalUsersVisible: db
    .prepare('EXPLAIN QUERY PLAN SELECT externalId FROM external_users WHERE clientId = ? AND hidden = 0 AND present = 1 LIMIT 5000')
    .all('c3')
};
const before = runBenchmarks(db, cutoffTs);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_auth_log_ts_id ON auth_log(ts DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_email_log_ts_id ON email_log(ts DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_log_ts_id ON audit_log(ts DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_external_users_client_present ON external_users(clientId, present, hidden);
`);

const explainAfter = {
  authExpiredRows: db
    .prepare('EXPLAIN QUERY PLAN SELECT id, ts, event FROM auth_log WHERE ts < ? ORDER BY ts DESC, id DESC LIMIT 5000')
    .all(cutoffTs),
  externalUsersVisible: db
    .prepare('EXPLAIN QUERY PLAN SELECT externalId FROM external_users WHERE clientId = ? AND hidden = 0 AND present = 1 LIMIT 5000')
    .all('c3')
};
const after = runBenchmarks(db, cutoffTs);

const speedup = {};
for (const key of Object.keys(before)) {
  const pre = Number(before[key].avgMs || 0);
  const post = Number(after[key].avgMs || 0);
  speedup[key] = pre > 0 ? Number((pre / Math.max(post, 0.0001)).toFixed(2)) : null;
}

console.log(
  JSON.stringify(
    {
      input: { logRows: LOG_ROWS, userRows: USER_ROWS, repeats: REPEATS },
      before,
      after,
      speedup,
      explainBefore,
      explainAfter
    },
    null,
    2
  )
);
