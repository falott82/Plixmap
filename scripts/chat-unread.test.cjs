'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createChatServices } = require('../server/services/chat.cjs');

const setupDb = () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE client_chat_messages (
      id TEXT PRIMARY KEY, clientId TEXT, userId TEXT,
      deleted INTEGER DEFAULT 0, deletedForJson TEXT, createdAt INTEGER
    );
    CREATE TABLE client_chat_reads (userId TEXT, clientId TEXT, lastReadAt INTEGER);
  `);
  return db;
};

const makeServices = (db) =>
  createChatServices({
    db,
    readState: () => ({ clients: [] }),
    getChatClientIdsForUser: () => new Set(),
    parseDataUrl: () => null,
    base64SizeBytes: () => 0,
    uploadsDir: '/tmp',
    wsClientInfo: new Map(),
    sendToUser: () => {}
  });

test('computeClientUnreadCounts respects per-client lastReadAt, deleted and hidden-for-user', () => {
  const db = setupDb();
  const ins = db.prepare(
    'INSERT INTO client_chat_messages (id, clientId, userId, deleted, deletedForJson, createdAt) VALUES (?,?,?,?,?,?)'
  );
  // client A: lastReadAt=10 -> only createdAt>10 count; deleted + hidden excluded
  ins.run('a1', 'A', 'u2', 0, null, 5); // read
  ins.run('a2', 'A', 'u2', 0, null, 15); // unread
  ins.run('a3', 'A', 'u2', 0, null, 20); // unread
  ins.run('a4', 'A', 'u2', 1, null, 25); // deleted
  ins.run('a5', 'A', 'u2', 0, JSON.stringify(['me']), 30); // hidden for me
  // client B: no read row -> lastReadAt defaults to 0 -> counts
  ins.run('b1', 'B', 'u2', 0, null, 1);
  db.prepare('INSERT INTO client_chat_reads (userId, clientId, lastReadAt) VALUES (?,?,?)').run('me', 'A', 10);

  const counts = makeServices(db).computeClientUnreadCounts('me', ['A', 'B', 'C']);
  assert.equal(counts.get('A'), 2);
  assert.equal(counts.get('B'), 1);
  assert.equal(counts.get('C'), 0); // allowed but no messages -> explicit 0
});

test('computeClientUnreadCounts matches the naive per-client computation', () => {
  const db = setupDb();
  const ins = db.prepare(
    'INSERT INTO client_chat_messages (id, clientId, userId, deleted, deletedForJson, createdAt) VALUES (?,?,?,?,?,?)'
  );
  const clients = ['A', 'B', 'C', 'D'];
  let n = 0;
  for (const c of clients) {
    for (let i = 0; i < 7; i += 1) ins.run(`${c}-${i}`, c, 'u2', i % 5 === 0 ? 1 : 0, null, i * 10);
  }
  const readStmt = db.prepare('INSERT INTO client_chat_reads (userId, clientId, lastReadAt) VALUES (?,?,?)');
  readStmt.run('me', 'A', 0);
  readStmt.run('me', 'B', 25);
  readStmt.run('me', 'C', 100);
  // D: no read row

  const svc = makeServices(db);
  const batched = svc.computeClientUnreadCounts('me', clients);

  // naive reference
  const reads = new Map([['A', 0], ['B', 25], ['C', 100]]);
  for (const c of clients) {
    const lastReadAt = reads.get(c) || 0;
    const naive = db
      .prepare('SELECT id, deletedForJson FROM client_chat_messages WHERE clientId = ? AND deleted = 0 AND createdAt > ?')
      .all(c, lastReadAt)
      .filter((row) => !svc.isMessageHiddenForUser(row, 'me')).length;
    assert.equal(batched.get(c), naive, `client ${c}`);
  }
  void n;
});

test('computeClientUnreadCounts returns an empty map for no allowed clients', () => {
  assert.equal(makeServices(setupDb()).computeClientUnreadCounts('me', []).size, 0);
});
