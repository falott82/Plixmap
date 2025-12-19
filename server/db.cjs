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
      clientOrderJson TEXT NOT NULL DEFAULT '[]',
      paletteFavoritesJson TEXT NOT NULL DEFAULT '[]',
      mustChangePassword INTEGER NOT NULL DEFAULT 0,
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
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('important','verbose')),
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
    CREATE TABLE IF NOT EXISTS client_user_import (
      clientId TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      username TEXT NOT NULL,
      passwordEnc TEXT,
      bodyJson TEXT,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS external_users (
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

    CREATE TABLE IF NOT EXISTS user_custom_fields (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      typeId TEXT NOT NULL,
      fieldKey TEXT NOT NULL,
      label TEXT NOT NULL,
      valueType TEXT NOT NULL CHECK (valueType IN ('string','number','boolean')),
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(userId, typeId, fieldKey),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_object_custom_values (
      userId TEXT NOT NULL,
      objectId TEXT NOT NULL,
      valuesJson TEXT NOT NULL DEFAULT '{}',
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY(userId, objectId),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // lightweight migrations for existing DBs
  const cols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
  if (!cols.includes('isSuperAdmin')) db.exec('ALTER TABLE users ADD COLUMN isSuperAdmin INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('disabled')) db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('language')) db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'it'");
  if (!cols.includes('defaultPlanId')) db.exec("ALTER TABLE users ADD COLUMN defaultPlanId TEXT");
  if (!cols.includes('clientOrderJson')) db.exec("ALTER TABLE users ADD COLUMN clientOrderJson TEXT NOT NULL DEFAULT '[]'");
  if (!cols.includes('paletteFavoritesJson')) db.exec("ALTER TABLE users ADD COLUMN paletteFavoritesJson TEXT NOT NULL DEFAULT '[]'");
  if (!cols.includes('mustChangePassword')) db.exec('ALTER TABLE users ADD COLUMN mustChangePassword INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('mfaEnabled')) db.exec('ALTER TABLE users ADD COLUMN mfaEnabled INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('mfaSecretEnc')) db.exec('ALTER TABLE users ADD COLUMN mfaSecretEnc TEXT');

  // Custom Import migrations (if table exists already)
  try {
    const importCols = db.prepare("PRAGMA table_info('client_user_import')").all().map((c) => c.name);
    if (importCols.length && !importCols.includes('bodyJson')) db.exec('ALTER TABLE client_user_import ADD COLUMN bodyJson TEXT');
  } catch {
    // ignore
  }

  // Custom fields migrations (for older DBs created before tables existed)
  try {
    db.prepare("SELECT 1 FROM user_custom_fields LIMIT 1").get();
  } catch {
    // ignore: table created by main schema
  }
  try {
    db.prepare("SELECT 1 FROM user_object_custom_values LIMIT 1").get();
  } catch {
    // ignore: table created by main schema
  }

  // mark bootstrap users as superadmins if present (legacy)
  try {
    db.prepare("UPDATE users SET isSuperAdmin = 1, isAdmin = 1 WHERE username IN ('admin','admin2')").run();
  } catch {
    // ignore
  }
  return db;
};

const getOrCreateAuthSecret = (db) => {
  const envSecret = process.env.DESKLY_AUTH_SECRET;
  if (envSecret && typeof envSecret === 'string' && envSecret.trim().length >= 32) return envSecret.trim();
  // In development, rotate the signing secret on each server start so a restart always forces re-login.
  // In production (NODE_ENV=production, e.g. Dockerfile), keep a stable secret in DB for persistent sessions.
  if (process.env.NODE_ENV !== 'production') {
    return crypto.randomBytes(32).toString('base64');
  }
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('authSecret');
  if (row?.value) return row.value;
  const secret = crypto.randomBytes(32).toString('base64');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('authSecret', secret);
  return secret;
};

// Stable secret for encrypting stored credentials (e.g. Custom Import password) that must survive restarts.
const getOrCreateDataSecret = (db) => {
  const envSecret = process.env.DESKLY_DATA_SECRET;
  if (envSecret && typeof envSecret === 'string' && envSecret.trim().length >= 32) return envSecret.trim();
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('dataSecret');
  if (row?.value) return row.value;
  const secret = crypto.randomBytes(32).toString('base64');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('dataSecret', secret);
  return secret;
};

module.exports = { openDb, dbPath, getOrCreateAuthSecret, getOrCreateDataSecret };
