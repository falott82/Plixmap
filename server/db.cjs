const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const dbPath = process.env.DESKLY_DB_PATH || path.join(process.cwd(), 'data', 'deskly.sqlite');

const openDb = () => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      passwordSalt TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      tokenVersion INTEGER NOT NULL DEFAULT 1,
      isAdmin INTEGER NOT NULL DEFAULT 0,
      isSuperAdmin INTEGER NOT NULL DEFAULT 0,
      disabled INTEGER NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT 'it',
      defaultPlanId TEXT,
      firstName TEXT NOT NULL DEFAULT '',
      lastName TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      scopeType TEXT NOT NULL CHECK (scopeType IN ('client','site','plan')),
      scopeId TEXT NOT NULL,
      access TEXT NOT NULL CHECK (access IN ('ro','rw')),
      UNIQUE(userId, scopeType, scopeId),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS auth_log (
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
  `);

  // lightweight migrations for existing DBs
  const cols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
  if (!cols.includes('isSuperAdmin')) db.exec('ALTER TABLE users ADD COLUMN isSuperAdmin INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('disabled')) db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('language')) db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'it'");
  if (!cols.includes('defaultPlanId')) db.exec("ALTER TABLE users ADD COLUMN defaultPlanId TEXT");

  // mark bootstrap users as superadmins if present
  try {
    db.prepare("UPDATE users SET isSuperAdmin = 1, isAdmin = 1 WHERE username IN ('admin','admin2')").run();
  } catch {
    // ignore
  }
  return db;
};

const getOrCreateAuthSecret = (db) => {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('authSecret');
  if (row?.value) return row.value;
  const secret = crypto.randomBytes(32).toString('base64');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('authSecret', secret);
  return secret;
};

module.exports = { openDb, dbPath, getOrCreateAuthSecret };
