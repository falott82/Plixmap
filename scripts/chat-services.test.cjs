const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createChatServices } = require('../server/services/chat.cjs');

const createDeps = (overrides = {}) => {
  const sent = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plixmap-chat-'));
  const db = overrides.db || {
    prepare: (sql) => ({
      get: (...args) => {
        if (sql.includes('FROM user_blocks')) return null;
        if (typeof overrides.get === 'function') return overrides.get(sql, args);
        return null;
      },
      all: () => []
    })
  };
  const deps = {
    db,
    readState: () => ({ clients: [] }),
    getChatClientIdsForUser: () => new Set(),
    parseDataUrl: (value) => {
      const match = /^data:([^;]+);base64,(.+)$/.exec(String(value || ''));
      if (!match) return null;
      return { mime: match[1], base64: match[2] };
    },
    base64SizeBytes: (base64) => Buffer.from(String(base64 || ''), 'base64').length,
    uploadsDir: tempDir,
    wsClientInfo: new Map(),
    sendToUser: (userId, payload) => sent.push({ userId: String(userId), payload })
  };
  return { deps: { ...deps, ...overrides }, sent, tempDir };
};

test('prepareChatAttachments validates and stores attachments from a shared path', () => {
  const { deps, tempDir } = createDeps();
  const chat = createChatServices(deps);
  const raw = Buffer.from('hello world').toString('base64');
  const result = chat.prepareChatAttachments([{ name: 'note.pdf', dataUrl: `data:application/pdf;base64,${raw}` }]);

  assert.equal(result.ok, true);
  assert.equal(result.attachments.length, 1);
  assert.equal(result.attachments[0].mime, 'application/pdf');
  assert.match(result.attachments[0].url, /^\/uploads\/.+\.pdf$/);
  assert.ok(fs.existsSync(path.join(tempDir, path.basename(result.attachments[0].url))));
});

test('emitDmMessageEvent notifies sender always and recipient only when deliverable', () => {
  const { deps, sent } = createDeps();
  const chat = createChatServices(deps);
  const message = { id: 'm1', deliveredAt: 123 };

  const threadId = chat.emitDmMessageEvent('dm_chat_update', {
    pairKey: 'u1:u2',
    fromUserId: 'u1',
    toUserId: 'u2',
    message
  });

  assert.equal(threadId, 'dm:u1:u2');
  assert.deepEqual(sent, [
    { userId: 'u1', payload: { type: 'dm_chat_update', threadId: 'dm:u1:u2', message } },
    { userId: 'u2', payload: { type: 'dm_chat_update', threadId: 'dm:u1:u2', message } }
  ]);
});

test('emitDmMessageEvent suppresses recipient update when recipient blocked sender', () => {
  const blockedDb = {
    prepare: (sql) => ({
      get: (...args) => {
        if (sql.includes('FROM user_blocks')) {
          const [blockerId, blockedId] = args;
          return blockerId === 'u2' && blockedId === 'u1' ? { 1: 1 } : null;
        }
        return null;
      },
      all: () => []
    })
  };
  const { deps, sent } = createDeps({ db: blockedDb });
  const chat = createChatServices(deps);

  chat.emitDmMessageEvent('dm_chat_update', {
    pairKey: 'u1:u2',
    fromUserId: 'u1',
    toUserId: 'u2',
    message: { id: 'm1', deliveredAt: 123 }
  });

  assert.deepEqual(sent, [
    { userId: 'u1', payload: { type: 'dm_chat_update', threadId: 'dm:u1:u2', message: { id: 'm1', deliveredAt: 123 } } }
  ]);
});
