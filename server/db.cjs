const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const readEnv = (name) => process.env[name];

const resolveDefaultDbPath = () => {
  const plixmapDb = path.join(process.cwd(), 'data', 'plixmap.sqlite');
  const desklyDb = path.join(process.cwd(), 'data', 'deskly.sqlite');
  if (fs.existsSync(plixmapDb)) return plixmapDb;
  if (fs.existsSync(desklyDb)) return desklyDb;
  return plixmapDb;
};

const dbPath = readEnv('PLIXMAP_DB_PATH') || resolveDefaultDbPath();

const defaultPaletteFavoritesJson = JSON.stringify(['real_user', 'user', 'desktop', 'rack']);
const DEFAULT_MIN_SECRET_LENGTH = 32;

const isEnabled = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const requireEnvSecrets = () => isEnabled(readEnv('PLIXMAP_REQUIRE_ENV_SECRETS'), false);
const minSecretLength = () => {
  const raw = Number(readEnv('PLIXMAP_SECRET_MIN_LENGTH') || DEFAULT_MIN_SECRET_LENGTH);
  return Number.isFinite(raw) && raw >= 16 ? Math.round(raw) : DEFAULT_MIN_SECRET_LENGTH;
};

const readSecretInput = (baseName) => {
  const fileVar = readEnv(`${baseName}_FILE`);
  if (typeof fileVar === 'string' && fileVar.trim()) {
    const filePath = String(fileVar).trim();
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      throw new Error(`${baseName}_FILE unreadable (${filePath}): ${error?.message || 'read failed'}`);
    }
  }
  const direct = readEnv(baseName);
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return '';
};

const ensureSecretStrength = (value, name) => {
  const secret = String(value || '').trim();
  const min = minSecretLength();
  if (!secret) return '';
  if (secret.length < min) {
    throw new Error(`${name} must be at least ${min} characters`);
  }
  return secret;
};

const getSchemaVersion = (db) => {
  try {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('schemaVersion');
    const parsed = row?.value ? Number(row.value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const setSchemaVersion = (db, version) => {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'schemaVersion',
    String(version)
  );
};

const migrations = [
  {
    version: 1,
    up: (db) => {
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

      const importCols = db.prepare("PRAGMA table_info('client_user_import')").all().map((c) => c.name);
      if (importCols.length && !importCols.includes('bodyJson')) {
        db.exec('ALTER TABLE client_user_import ADD COLUMN bodyJson TEXT');
      }

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
    }
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_log (
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
      `);
    }
  },
  {
    version: 3,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
      if (!cols.includes('visibleLayerIdsByPlanJson')) {
        db.exec("ALTER TABLE users ADD COLUMN visibleLayerIdsByPlanJson TEXT NOT NULL DEFAULT '{}'");
      }
    }
  },
  {
    version: 4,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('client_user_import')").all().map((c) => c.name);
      if (!cols.includes('method')) {
        db.exec("ALTER TABLE client_user_import ADD COLUMN method TEXT NOT NULL DEFAULT 'POST'");
      }
    }
  },
  {
    version: 5,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('external_users')").all().map((c) => c.name);
      if (!cols.includes('mobile')) {
        db.exec("ALTER TABLE external_users ADD COLUMN mobile TEXT NOT NULL DEFAULT ''");
      }
    }
  },
  {
    version: 6,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
      if (!cols.includes('avatarUrl')) {
        db.exec("ALTER TABLE users ADD COLUMN avatarUrl TEXT NOT NULL DEFAULT ''");
      }
    }
  },
  {
    version: 7,
    up: (db) => {
      const permCols = db.prepare("PRAGMA table_info('permissions')").all().map((c) => c.name);
      if (permCols.length && !permCols.includes('chat')) {
        db.exec('ALTER TABLE permissions ADD COLUMN chat INTEGER NOT NULL DEFAULT 0');
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS client_chat_messages (
          id TEXT PRIMARY KEY,
          clientId TEXT NOT NULL,
          userId TEXT NOT NULL,
          username TEXT NOT NULL,
          avatarUrl TEXT NOT NULL DEFAULT '',
          replyToId TEXT,
          attachmentsJson TEXT NOT NULL DEFAULT '[]',
          starredByJson TEXT NOT NULL DEFAULT '[]',
          reactionsJson TEXT NOT NULL DEFAULT '{}',
          text TEXT NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0,
          deletedAt INTEGER,
          deletedById TEXT,
          editedAt INTEGER,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_client_createdAt ON client_chat_messages(clientId, createdAt);
        CREATE TABLE IF NOT EXISTS client_chat_reads (
          userId TEXT NOT NULL,
          clientId TEXT NOT NULL,
          lastReadAt INTEGER NOT NULL,
          PRIMARY KEY(userId, clientId)
        );
      `);
    }
  }
  ,
  {
    version: 8,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('client_chat_messages')").all().map((c) => c.name);
      if (cols.length && !cols.includes('attachmentsJson')) {
        db.exec("ALTER TABLE client_chat_messages ADD COLUMN attachmentsJson TEXT NOT NULL DEFAULT '[]'");
      }
    }
  },
  {
    version: 9,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('client_chat_messages')").all().map((c) => c.name);
      if (cols.length && !cols.includes('replyToId')) {
        db.exec("ALTER TABLE client_chat_messages ADD COLUMN replyToId TEXT");
      }
      if (cols.length && !cols.includes('starredByJson')) {
        db.exec("ALTER TABLE client_chat_messages ADD COLUMN starredByJson TEXT NOT NULL DEFAULT '[]'");
      }
    }
  },
  {
    version: 10,
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('client_chat_messages')").all().map((c) => c.name);
      if (cols.length && !cols.includes('reactionsJson')) {
        db.exec("ALTER TABLE client_chat_messages ADD COLUMN reactionsJson TEXT NOT NULL DEFAULT '{}'");
      }
    }
  },
  {
    version: 11,
    up: (db) => {
      const userCols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
      if (!userCols.includes('lastOnlineAt')) {
        db.exec('ALTER TABLE users ADD COLUMN lastOnlineAt INTEGER');
      }
      if (!userCols.includes('chatLayoutJson')) {
        db.exec("ALTER TABLE users ADD COLUMN chatLayoutJson TEXT NOT NULL DEFAULT '{}'");
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS user_blocks (
          blockerId TEXT NOT NULL,
          blockedId TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          PRIMARY KEY(blockerId, blockedId)
        );
        CREATE INDEX IF NOT EXISTS idx_user_blocks_blockedId ON user_blocks(blockedId);

        CREATE TABLE IF NOT EXISTS dm_chat_messages (
          id TEXT PRIMARY KEY,
          pairKey TEXT NOT NULL,
          fromUserId TEXT NOT NULL,
          toUserId TEXT NOT NULL,
          username TEXT NOT NULL,
          avatarUrl TEXT NOT NULL DEFAULT '',
          replyToId TEXT,
          attachmentsJson TEXT NOT NULL DEFAULT '[]',
          starredByJson TEXT NOT NULL DEFAULT '[]',
          reactionsJson TEXT NOT NULL DEFAULT '{}',
          text TEXT NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0,
          deletedAt INTEGER,
          deletedById TEXT,
          editedAt INTEGER,
          deliveredAt INTEGER,
          readAt INTEGER,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dm_chat_messages_pair_createdAt ON dm_chat_messages(pairKey, createdAt);
        CREATE INDEX IF NOT EXISTS idx_dm_chat_messages_toUser_readAt ON dm_chat_messages(toUserId, readAt);
        CREATE INDEX IF NOT EXISTS idx_dm_chat_messages_toUser_deliveredAt ON dm_chat_messages(toUserId, deliveredAt);
      `);
    }
  }
];

const ensureMigrationTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt INTEGER NOT NULL
    );
  `);
};

const getAppliedMigrations = (db) => {
  ensureMigrationTable(db);
  const rows = db.prepare('SELECT version, name, appliedAt FROM schema_migrations ORDER BY version ASC').all();
  return rows.map((row) => ({
    version: Number(row.version) || 0,
    name: String(row.name || ''),
    appliedAt: Number(row.appliedAt) || 0
  }));
};

const validateMigrations = () => {
  let previousVersion = 0;
  const seen = new Set();
  for (const migration of migrations) {
    const version = Number(migration?.version || 0);
    if (!Number.isInteger(version) || version <= 0) {
      throw new Error(`Invalid migration version: ${String(migration?.version || '')}`);
    }
    if (seen.has(version)) {
      throw new Error(`Duplicate migration version: ${String(version)}`);
    }
    if (version <= previousVersion) {
      throw new Error(`Migrations are not strictly increasing at version ${String(version)}`);
    }
    seen.add(version);
    previousVersion = version;
  }
};

const runMigrations = (db) => {
  ensureMigrationTable(db);
  validateMigrations();
  let current = getSchemaVersion(db);
  const appliedVersions = new Set(getAppliedMigrations(db).map((entry) => entry.version));
  for (const migration of migrations) {
    const shouldRun = migration.version > current || !appliedVersions.has(migration.version);
    if (!shouldRun) continue;
    db.transaction(() => {
      migration.up(db);
      db.prepare(
        `INSERT INTO schema_migrations (version, name, appliedAt)
         VALUES (?, ?, ?)
         ON CONFLICT(version) DO UPDATE SET name=excluded.name, appliedAt=excluded.appliedAt`
      ).run(migration.version, String(migration.name || `migration_${migration.version}`), Date.now());
    })();
    setSchemaVersion(db, migration.version);
    current = migration.version;
  }
};

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
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt INTEGER NOT NULL
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
      visibleLayerIdsByPlanJson TEXT NOT NULL DEFAULT '{}',
      mustChangePassword INTEGER NOT NULL DEFAULT 0,
      avatarUrl TEXT NOT NULL DEFAULT '',
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
      chat INTEGER NOT NULL DEFAULT 0,
      UNIQUE(userId, scopeType, scopeId),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
	    CREATE TABLE IF NOT EXISTS client_chat_messages (
	      id TEXT PRIMARY KEY,
	      clientId TEXT NOT NULL,
	      userId TEXT NOT NULL,
	      username TEXT NOT NULL,
	      avatarUrl TEXT NOT NULL DEFAULT '',
	      replyToId TEXT,
	      attachmentsJson TEXT NOT NULL DEFAULT '[]',
	      starredByJson TEXT NOT NULL DEFAULT '[]',
	      reactionsJson TEXT NOT NULL DEFAULT '{}',
	      text TEXT NOT NULL,
	      deleted INTEGER NOT NULL DEFAULT 0,
	      deletedAt INTEGER,
	      deletedById TEXT,
	      editedAt INTEGER,
	      createdAt INTEGER NOT NULL,
	      updatedAt INTEGER NOT NULL
	    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_client_createdAt ON client_chat_messages(clientId, createdAt);
    CREATE TABLE IF NOT EXISTS client_chat_reads (
      userId TEXT NOT NULL,
      clientId TEXT NOT NULL,
      lastReadAt INTEGER NOT NULL,
      PRIMARY KEY(userId, clientId)
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
    CREATE TABLE IF NOT EXISTS email_log (
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
      method TEXT NOT NULL DEFAULT 'POST',
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

    CREATE TABLE IF NOT EXISTS object_type_requests (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
      payloadJson TEXT NOT NULL,
      requestedAt INTEGER NOT NULL,
      requestedById TEXT NOT NULL,
      requestedByUsername TEXT NOT NULL,
      reviewedAt INTEGER,
      reviewedById TEXT,
      reviewedByUsername TEXT,
      reason TEXT,
      finalPayloadJson TEXT
    );
  `);

  runMigrations(db);

  // enforce single superadmin account
  try {
    db.prepare("UPDATE users SET isSuperAdmin = 0 WHERE username <> 'superadmin'").run();
    db.prepare("UPDATE users SET isSuperAdmin = 1, isAdmin = 1 WHERE username = 'superadmin'").run();
  } catch {
    // ignore
  }
  try {
    db.prepare("UPDATE users SET paletteFavoritesJson = ? WHERE paletteFavoritesJson = '[]'").run(
      defaultPaletteFavoritesJson
    );
  } catch {
    // ignore
  }
  return db;
};

const getOrCreateAuthSecret = (db) => {
  const strictEnv = requireEnvSecrets();
  const secretName = 'PLIXMAP_AUTH_SECRET';
  const envSecret = ensureSecretStrength(readSecretInput(secretName), secretName);
  if (envSecret) return envSecret;
  if (strictEnv) throw new Error(`${secretName} is required when PLIXMAP_REQUIRE_ENV_SECRETS=1`);
  // In development, rotate the signing secret on each server start so a restart always forces re-login.
  // In production (NODE_ENV=production, e.g. Dockerfile), keep a stable secret in DB for persistent sessions.
  if (process.env.NODE_ENV !== 'production') {
    return crypto.randomBytes(32).toString('base64');
  }
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('authSecret');
  const persisted = String(row?.value || '').trim();
  if (persisted.length >= minSecretLength()) return persisted;
  const secret = crypto.randomBytes(32).toString('base64');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'authSecret',
    secret
  );
  return secret;
};

// Stable secret for encrypting stored credentials (e.g. Custom Import password) that must survive restarts.
const getOrCreateDataSecret = (db) => {
  const strictEnv = requireEnvSecrets();
  const secretName = 'PLIXMAP_DATA_SECRET';
  const envSecret = ensureSecretStrength(readSecretInput(secretName), secretName);
  if (envSecret) return envSecret;
  if (strictEnv) throw new Error(`${secretName} is required when PLIXMAP_REQUIRE_ENV_SECRETS=1`);
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('dataSecret');
  const persisted = String(row?.value || '').trim();
  if (persisted.length >= minSecretLength()) return persisted;
  const secret = crypto.randomBytes(32).toString('base64');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'dataSecret',
    secret
  );
  return secret;
};

const listMigrationStatus = (db) => {
  const applied = getAppliedMigrations(db);
  const latestVersion = migrations.length ? migrations[migrations.length - 1].version : 0;
  return {
    schemaVersion: getSchemaVersion(db),
    latestVersion,
    upToDate: getSchemaVersion(db) >= latestVersion,
    applied
  };
};

module.exports = {
  openDb,
  dbPath,
  migrations,
  listMigrationStatus,
  getOrCreateAuthSecret,
  getOrCreateDataSecret
};
