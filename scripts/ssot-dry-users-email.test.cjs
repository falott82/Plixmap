const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const {
  normalizePortalPublicUrl,
  getPortalPublicUrl,
  setPortalPublicUrl
} = require('../server/email.cjs');
const {
  normalizeLinkedImportedRef,
  findLinkedPortalUserConflict,
  replaceUserPermissions
} = require('../server/services/users.cjs');

const createDb = () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      linkedExternalClientId TEXT NOT NULL DEFAULT '',
      linkedExternalId TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      scopeType TEXT NOT NULL,
      scopeId TEXT NOT NULL,
      access TEXT NOT NULL,
      chat INTEGER NOT NULL DEFAULT 0,
      UNIQUE(userId, scopeType, scopeId)
    );
  `);
  return db;
};

test('portal public URL is normalized and persisted as SSOT', () => {
  const db = createDb();
  assert.equal(normalizePortalPublicUrl(' https://portal.example.com/app/ '), 'https://portal.example.com/app');
  assert.equal(normalizePortalPublicUrl('ftp://portal.example.com'), '');
  assert.equal(getPortalPublicUrl(db, 'https://fallback.example.com/base/'), 'https://fallback.example.com/base');
  assert.equal(setPortalPublicUrl(db, 'https://portal.example.com/app/'), 'https://portal.example.com/app');
  assert.equal(getPortalPublicUrl(db, 'https://fallback.example.com/base'), 'https://portal.example.com/app');
});

test('linked imported user helpers normalize and detect conflicts', () => {
  const db = createDb();
  db.prepare('INSERT INTO users (id, username, linkedExternalClientId, linkedExternalId) VALUES (?, ?, ?, ?)').run(
    'u1',
    'mario',
    'client-a',
    'ext-1'
  );
  assert.deepEqual(normalizeLinkedImportedRef(' client-a ', ' ext-1 '), { clientId: 'client-a', externalId: 'ext-1' });
  assert.deepEqual(findLinkedPortalUserConflict(db, 'client-a', 'ext-1'), { id: 'u1', username: 'mario' });
  assert.equal(findLinkedPortalUserConflict(db, 'client-a', 'ext-1', 'u1'), null);
});

test('replaceUserPermissions rewrites permissions from a single source', () => {
  const db = createDb();
  db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run('u1', 'mario');
  db.prepare('INSERT INTO permissions (userId, scopeType, scopeId, access, chat) VALUES (?, ?, ?, ?, ?)').run('u1', 'client', 'c1', 'ro', 0);
  const inserted = replaceUserPermissions(
    db,
    'u1',
    [
      { scopeType: 'client', scopeId: 'c2', access: 'rw', chat: true },
      { scopeType: 'site', scopeId: 's1', access: 'ro', chat: false }
    ],
    'ro'
  );
  assert.equal(inserted, 2);
  const rows = db.prepare('SELECT scopeType, scopeId, access, chat FROM permissions WHERE userId = ? ORDER BY scopeType, scopeId').all('u1');
  assert.deepEqual(rows, [
    { scopeType: 'client', scopeId: 'c2', access: 'ro', chat: 1 },
    { scopeType: 'site', scopeId: 's1', access: 'ro', chat: 0 }
  ]);
});
