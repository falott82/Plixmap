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
  replaceUserPermissions,
  listDirectoryUsersForRequester
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
      isAdmin INTEGER NOT NULL DEFAULT 0,
      isSuperAdmin INTEGER NOT NULL DEFAULT 0,
      disabled INTEGER NOT NULL DEFAULT 0,
      firstName TEXT NOT NULL DEFAULT '',
      lastName TEXT NOT NULL DEFAULT '',
      avatarUrl TEXT NOT NULL DEFAULT '',
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

test('listDirectoryUsersForRequester only returns visible users for non-admins and strips role flags', () => {
  const db = createDb();
  db.prepare(
    'INSERT INTO users (id, username, isAdmin, isSuperAdmin, firstName, lastName, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run('u1', 'mario', 0, 0, 'Mario', 'Rossi', '/uploads/mario.png');
  db.prepare(
    'INSERT INTO users (id, username, isAdmin, isSuperAdmin, firstName, lastName) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('u2', 'admin', 1, 0, 'Admin', 'User');
  db.prepare(
    'INSERT INTO users (id, username, isAdmin, isSuperAdmin, firstName, lastName) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('u3', 'other', 0, 0, 'Other', 'User');

  const clientIdsByUserId = new Map([
    ['u1', new Set(['c1'])],
    ['u2', new Set(['c1', 'c2'])],
    ['u3', new Set(['c2'])]
  ]);
  const getChatClientIdsForUser = (userId) => clientIdsByUserId.get(String(userId)) || new Set();

  const visibleToUser = listDirectoryUsersForRequester(
    db,
    { userId: 'u1', isAdmin: false },
    getChatClientIdsForUser
  );
  assert.deepEqual(visibleToUser, [
    { id: 'u2', username: 'admin', firstName: 'Admin', lastName: 'User', avatarUrl: '' },
    { id: 'u1', username: 'mario', firstName: 'Mario', lastName: 'Rossi', avatarUrl: '/uploads/mario.png' }
  ]);

  const visibleToAdmin = listDirectoryUsersForRequester(
    db,
    { userId: 'u2', isAdmin: true },
    getChatClientIdsForUser
  );
  assert.equal(visibleToAdmin.length, 3);
  assert.equal(visibleToAdmin.find((row) => row.id === 'u2')?.isAdmin, true);
});
