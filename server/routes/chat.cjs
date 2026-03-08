const crypto = require('crypto');

const isAdminReq = (req) => !!req?.isAdmin || !!req?.isSuperAdmin;

const collectOnlineIds = (wsClientInfo) => {
  const onlineIds = new Set();
  for (const info of wsClientInfo.values()) {
    if (info?.userId) onlineIds.add(String(info.userId));
  }
  return onlineIds;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const registerChatRoutes = (app, deps) => {
  const {
    db,
    readState,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    getChatClientIdsForUser,
    userCanChatClient,
    getClientScopeMaps,
    wsClientInfo,
    sendToUser,
    broadcastToChatClient,
    chat
  } = deps;

  app.get('/api/chat/unread', requireAuth, (req, res) => {
    const allowedClientIds = Array.from(getChatClientIdsForUser(req.userId, isAdminReq(req)));
    const reads = db.prepare('SELECT clientId, lastReadAt FROM client_chat_reads WHERE userId = ?').all(req.userId);
    const lastReadAtByClient = new Map();
    for (const row of reads || []) lastReadAtByClient.set(String(row.clientId), Number(row.lastReadAt) || 0);
    const countStmt = db.prepare('SELECT id, deletedForJson FROM client_chat_messages WHERE clientId = ? AND deleted = 0 AND createdAt > ?');
    const out = {};
    for (const clientId of allowedClientIds) {
      const lastReadAt = lastReadAtByClient.get(clientId) || 0;
      const rows = countStmt.all(clientId, lastReadAt);
      out[clientId] = (rows || []).filter((row) => !chat.isMessageHiddenForUser(row, req.userId)).length;
    }
    try {
      const dmRows = db
        .prepare(
          `SELECT pairKey, deletedForJson
           FROM dm_chat_messages
           WHERE toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL`
        )
        .all(req.userId);
      const grouped = new Map();
      for (const row of dmRows || []) {
        if (chat.isMessageHiddenForUser(row, req.userId)) continue;
        const key = String(row.pairKey || '').trim();
        if (!key) continue;
        grouped.set(key, Number(grouped.get(key) || 0) + 1);
      }
      for (const [key, count] of grouped.entries()) out[`dm:${key}`] = count;
    } catch {}
    res.json({ unreadByClientId: out });
  });

  app.get('/api/chat/unread-senders', requireAuth, (req, res) => {
    const senderIds = new Set();
    try {
      const allowedClientIds = Array.from(getChatClientIdsForUser(req.userId, isAdminReq(req)));
      const reads = db.prepare('SELECT clientId, lastReadAt FROM client_chat_reads WHERE userId = ?').all(req.userId);
      const lastReadAtByClient = new Map();
      for (const row of reads || []) lastReadAtByClient.set(String(row.clientId), Number(row.lastReadAt) || 0);
      const stmt = db.prepare(
        `SELECT userId, deletedForJson
         FROM client_chat_messages
         WHERE clientId = ? AND deleted = 0 AND createdAt > ? AND userId != ?`
      );
      for (const clientId of allowedClientIds) {
        const rows = stmt.all(clientId, lastReadAtByClient.get(clientId) || 0, req.userId);
        for (const row of rows || []) {
          if (chat.isMessageHiddenForUser(row, req.userId)) continue;
          if (row?.userId) senderIds.add(String(row.userId));
        }
      }
    } catch {}
    try {
      const rows = db
        .prepare(
          `SELECT fromUserId, deletedForJson
           FROM dm_chat_messages
           WHERE toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL`
        )
        .all(req.userId);
      for (const row of rows || []) {
        if (chat.isMessageHiddenForUser(row, req.userId)) continue;
        if (row?.fromUserId) senderIds.add(String(row.fromUserId));
      }
    } catch {}
    res.json({ count: senderIds.size, senderIds: Array.from(senderIds) });
  });

  app.get('/api/chat/mobile/overview', requireAuth, (req, res) => {
    const meId = String(req.userId || '').trim();
    const state = readState();
    const clientMetaById = new Map();
    for (const client of state?.clients || []) {
      if (!client?.id) continue;
      clientMetaById.set(String(client.id), {
        id: String(client.id),
        name: String(client.shortName || client.name || client.id),
        logoUrl: String(client.logoUrl || '')
      });
    }
    const allowedClientIds = Array.from(getChatClientIdsForUser(meId, isAdminReq(req)));
    const reads = db.prepare('SELECT clientId, lastReadAt FROM client_chat_reads WHERE userId = ?').all(meId);
    const lastReadAtByClient = new Map();
    for (const row of reads || []) lastReadAtByClient.set(String(row.clientId), Number(row.lastReadAt) || 0);
    const clientUnreadStmt = db.prepare('SELECT id, deletedForJson FROM client_chat_messages WHERE clientId = ? AND deleted = 0 AND createdAt > ?');

    const clients = allowedClientIds
      .map((clientId) => {
        const meta = clientMetaById.get(String(clientId)) || { id: String(clientId), name: String(clientId), logoUrl: '' };
        const lastReadAt = lastReadAtByClient.get(String(clientId)) || 0;
        const unreadCount = (clientUnreadStmt.all(String(clientId), lastReadAt) || []).filter((row) => !chat.isMessageHiddenForUser(row, meId)).length;
        const lastMessage = chat.getLatestVisibleClientChatMessage(clientId, meId);
        return {
          id: meta.id,
          name: meta.name,
          logoUrl: meta.logoUrl,
          unreadCount,
          lastMessageAt: Number(lastMessage?.createdAt || 0) || null,
          lastMessage
        };
      })
      .sort((a, b) => {
        const aTs = Number(a.lastMessageAt || 0);
        const bTs = Number(b.lastMessageAt || 0);
        if (aTs !== bTs) return bTs - aTs;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    const lastDmAtByPair = new Map();
    try {
      const rows = db
        .prepare(
          `SELECT pairKey, MAX(createdAt) as lastMessageAt
           FROM dm_chat_messages
           WHERE fromUserId = ? OR toUserId = ?
           GROUP BY pairKey`
        )
        .all(meId, meId);
      for (const row of rows || []) {
        const key = String(row.pairKey || '').trim();
        if (key) lastDmAtByPair.set(key, Number(row.lastMessageAt) || 0);
      }
    } catch {}

    const unreadDmByPair = new Map();
    try {
      const rows = db
        .prepare(
          `SELECT pairKey, deletedForJson
           FROM dm_chat_messages
           WHERE toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL`
        )
        .all(meId);
      for (const row of rows || []) {
        if (chat.isMessageHiddenForUser(row, meId)) continue;
        const key = String(row.pairKey || '').trim();
        if (!key) continue;
        unreadDmByPair.set(key, Number(unreadDmByPair.get(key) || 0) + 1);
      }
    } catch {}

    const dmHistoryOtherIds = new Set();
    try {
      const rows = db
        .prepare(
          `SELECT DISTINCT
             CASE WHEN fromUserId = ? THEN toUserId ELSE fromUserId END as otherId,
             deletedForJson
           FROM dm_chat_messages
           WHERE fromUserId = ? OR toUserId = ?`
        )
        .all(meId, meId, meId);
      for (const row of rows || []) {
        if (chat.isMessageHiddenForUser(row, meId)) continue;
        const id = String(row.otherId || '').trim();
        if (id && id !== meId) dmHistoryOtherIds.add(id);
      }
    } catch {}

    const myClients = getChatClientIdsForUser(meId, isAdminReq(req));
    const dms = db
      .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, disabled FROM users ORDER BY username ASC')
      .all()
      .filter((user) => Number(user.disabled) !== 1)
      .map((user) => {
        const otherId = String(user.id || '').trim();
        if (!otherId || otherId === meId) return null;
        const normalizedUsername = String(user.username || '').toLowerCase();
        const pairKey = meId < otherId ? `${meId}:${otherId}` : `${otherId}:${meId}`;
        const threadId = `dm:${pairKey}`;
        const targetClients = getChatClientIdsForUser(otherId, !!user.isAdmin || !!user.isSuperAdmin);
        let hasCommon = false;
        for (const clientId of myClients) {
          if (targetClients.has(clientId)) {
            hasCommon = true;
            break;
          }
        }
        const hasHistory = dmHistoryOtherIds.has(otherId);
        if (!hasCommon && !hasHistory) return null;
        const displayName = `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() || normalizedUsername;
        const lastMessage = chat.getLatestVisibleDmChatMessage(pairKey, meId);
        return {
          id: otherId,
          threadId,
          name: displayName || 'Direct message',
          avatarUrl: String(user.avatarUrl || ''),
          unreadCount: Number(unreadDmByPair.get(pairKey) || 0),
          lastMessageAt: Number(lastMessage?.createdAt || lastDmAtByPair.get(pairKey) || 0) || null,
          lastMessage
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTs = Number(a.lastMessageAt || 0);
        const bTs = Number(b.lastMessageAt || 0);
        if (aTs !== bTs) return bTs - aTs;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    res.json({ clients, dms, serverAt: Date.now() });
  });

  app.get('/api/chat/dm/contacts', requireAuth, (req, res) => {
    res.json({ users: chat.listDmContactUsers(req.userId, isAdminReq(req)) });
  });

  app.post('/api/chat/blocks/:id', requireAuth, (req, res) => {
    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'Missing id' });
    if (targetId === req.userId) return res.status(400).json({ error: 'Invalid id' });
    try {
      db.prepare(
        `INSERT INTO user_blocks (blockerId, blockedId, createdAt)
         VALUES (?, ?, ?)
         ON CONFLICT(blockerId, blockedId) DO UPDATE SET createdAt = excluded.createdAt`
      ).run(req.userId, targetId, Date.now());
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.delete('/api/chat/blocks/:id', requireAuth, (req, res) => {
    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'Missing id' });
    if (targetId === req.userId) return res.status(400).json({ error: 'Invalid id' });
    try {
      db.prepare('DELETE FROM user_blocks WHERE blockerId = ? AND blockedId = ?').run(req.userId, targetId);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.get('/api/chat/:clientId/messages', requireAuth, (req, res) => {
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

    const dm = chat.parseDmThreadId(clientId);
    if (dm) {
      if (req.userId !== dm.a && req.userId !== dm.b) return res.status(403).json({ error: 'Forbidden' });
      const otherUserId = req.userId === dm.a ? dm.b : dm.a;
      const other = db
        .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users WHERE id = ?')
        .get(otherUserId);
      if (!other || Number(other.disabled) === 1) return res.status(404).json({ error: 'Not found' });

      const meIsAdmin = isAdminReq(req);
      const otherIsAdmin = !!other.isAdmin || !!other.isSuperAdmin;
      const myClients = getChatClientIdsForUser(req.userId, meIsAdmin);
      const otherClients = getChatClientIdsForUser(String(other.id), otherIsAdmin);
      const commonIds = [];
      for (const id of myClients) if (otherClients.has(id)) commonIds.push(String(id));
      const canChat = commonIds.length > 0 || meIsAdmin;
      const hasHistory = (() => {
        try {
          return !!db
            .prepare('SELECT 1 FROM dm_chat_messages WHERE pairKey = ? AND (fromUserId = ? OR toUserId = ?) LIMIT 1')
            .get(dm.pairKey, req.userId, req.userId);
        } catch {
          return false;
        }
      })();
      if (!canChat && !hasHistory) return res.status(403).json({ error: 'Forbidden' });

      const state = readState();
      const nameByClientId = new Map();
      const logoByClientId = new Map();
      for (const client of state?.clients || []) {
        if (!client?.id) continue;
        nameByClientId.set(String(client.id), client.shortName || client.name || String(client.id));
        logoByClientId.set(String(client.id), String(client.logoUrl || ''));
      }
      const commonClients = commonIds
        .map((id) => ({ id, name: nameByClientId.get(id) || id, logoUrl: logoByClientId.get(id) || '' }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
      const messages = db
        .prepare(
          `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
           FROM dm_chat_messages
           WHERE pairKey = ?
           ORDER BY createdAt DESC
           LIMIT ?`
        )
        .all(dm.pairKey, limit)
        .filter((row) => !chat.isMessageHiddenForUser(row, req.userId))
        .map(chat.normalizeDmChatMessageRow)
        .reverse()
        .filter(Boolean);

      const normalizedUsername = String(other.username || '').toLowerCase();
      const displayName = `${String(other.firstName || '').trim()} ${String(other.lastName || '').trim()}`.trim() || normalizedUsername;
      return res.json({
        clientId: dm.threadId,
        clientName: displayName,
        lastReadAt: 0,
        messages,
        dm: {
          otherUserId,
          other: {
            id: String(other.id),
            username: normalizedUsername,
            firstName: String(other.firstName || ''),
            lastName: String(other.lastName || ''),
            avatarUrl: String(other.avatarUrl || ''),
            lastOnlineAt: other.lastOnlineAt ? Number(other.lastOnlineAt) : null
          },
          commonClients,
          canChat: !!canChat,
          readOnly: !canChat,
          blockedByMe: chat.userHasBlocked(req.userId, otherUserId),
          blockedMe: chat.userHasBlocked(otherUserId, req.userId)
        }
      });
    }

    if (!userCanChatClient(req.userId, isAdminReq(req), clientId)) return res.status(403).json({ error: 'Forbidden' });
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
    const rows = db
      .prepare(
        `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
         FROM client_chat_messages
         WHERE clientId = ?
         ORDER BY createdAt DESC
         LIMIT ?`
      )
      .all(clientId, limit)
      .filter((row) => !chat.isMessageHiddenForUser(row, req.userId))
      .map(chat.normalizeChatMessageRow)
      .reverse();
    const readRow = db.prepare('SELECT lastReadAt FROM client_chat_reads WHERE userId = ? AND clientId = ?').get(req.userId, clientId);
    res.json({ clientId, clientName: chat.getClientNameById(clientId), lastReadAt: Number(readRow?.lastReadAt || 0) || 0, messages: rows });
  });

  app.get('/api/chat/:clientId/members', requireAuth, (req, res) => {
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

    const dm = chat.parseDmThreadId(clientId);
    if (dm) {
      if (req.userId !== dm.a && req.userId !== dm.b) return res.status(403).json({ error: 'Forbidden' });
      const otherUserId = req.userId === dm.a ? dm.b : dm.a;
      const other = db
        .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users WHERE id = ?')
        .get(otherUserId);
      if (!other || Number(other.disabled) === 1) return res.status(404).json({ error: 'Not found' });

      const meIsAdmin = isAdminReq(req);
      const otherIsAdmin = !!other.isAdmin || !!other.isSuperAdmin;
      const myClients = getChatClientIdsForUser(req.userId, meIsAdmin);
      const otherClients = getChatClientIdsForUser(String(other.id), otherIsAdmin);
      let hasCommon = false;
      for (const id of myClients) {
        if (otherClients.has(id)) {
          hasCommon = true;
          break;
        }
      }
      const readOnly = !hasCommon && !meIsAdmin;
      const onlineIds = collectOnlineIds(wsClientInfo);
      const normalize = (user) => {
        const normalizedUsername = String(user.username || '').toLowerCase();
        return {
          id: String(user.id),
          username: normalizedUsername,
          firstName: String(user.firstName || ''),
          lastName: String(user.lastName || ''),
          avatarUrl: String(user.avatarUrl || ''),
          online: readOnly ? false : onlineIds.has(String(user.id)),
          lastOnlineAt: readOnly ? null : user.lastOnlineAt ? Number(user.lastOnlineAt) : null,
          lastReadAt: 0
        };
      };
      const meRow = db.prepare('SELECT id, username, firstName, lastName, avatarUrl, lastOnlineAt FROM users WHERE id = ?').get(req.userId);
      return res.json({
        clientId: dm.threadId,
        kind: 'dm',
        readOnly,
        users: [
          meRow
            ? normalize(meRow)
            : { id: req.userId, username: req.username, firstName: '', lastName: '', avatarUrl: '', online: true, lastOnlineAt: Date.now(), lastReadAt: 0 },
          normalize(other)
        ]
      });
    }

    if (!userCanChatClient(req.userId, isAdminReq(req), clientId)) return res.status(403).json({ error: 'Forbidden' });
    const maps = getClientScopeMaps();
    if (!maps.clientIds.has(clientId)) return res.status(404).json({ error: 'Not found' });

    const adminUserIds = new Set(
      db
        .prepare("SELECT id FROM users WHERE disabled = 0 AND isAdmin = 1")
        .all()
        .map((row) => String(row.id))
    );
    const perms = db.prepare('SELECT userId, scopeType, scopeId FROM permissions WHERE chat = 1').all();
    const memberUserIds = new Set(adminUserIds);
    for (const perm of perms || []) {
      const userId = String(perm.userId || '');
      if (!userId) continue;
      if (perm.scopeType === 'client') {
        if (String(perm.scopeId) === clientId) memberUserIds.add(userId);
        continue;
      }
      if (perm.scopeType === 'site') {
        const cid = maps.siteToClient.get(String(perm.scopeId || ''));
        if (cid === clientId) memberUserIds.add(userId);
        continue;
      }
      if (perm.scopeType === 'plan') {
        const cid = maps.planToClient.get(String(perm.scopeId || ''));
        if (cid === clientId) memberUserIds.add(userId);
      }
    }
    memberUserIds.add(req.userId);
    const onlineIds = collectOnlineIds(wsClientInfo);
    const users = db
      .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users')
      .all()
      .filter((user) => Number(user.disabled) !== 1)
      .map((user) => {
        const normalizedUsername = String(user.username || '').toLowerCase();
        return {
          id: String(user.id),
          username: normalizedUsername,
          firstName: String(user.firstName || ''),
          lastName: String(user.lastName || ''),
          avatarUrl: String(user.avatarUrl || ''),
          isAdmin: !!user.isAdmin,
          isSuperAdmin: !!user.isSuperAdmin && normalizedUsername === 'superadmin',
          online: onlineIds.has(String(user.id)),
          lastOnlineAt: user.lastOnlineAt ? Number(user.lastOnlineAt) : null
        };
      })
      .filter((user) => memberUserIds.has(user.id))
      .sort((a, b) => a.username.localeCompare(b.username));
    const reads = db.prepare('SELECT userId, lastReadAt FROM client_chat_reads WHERE clientId = ?').all(clientId);
    const lastReadAtByUserId = new Map();
    for (const row of reads || []) lastReadAtByUserId.set(String(row.userId), Number(row.lastReadAt) || 0);
    res.json({ clientId, users: users.map((user) => ({ ...user, lastReadAt: lastReadAtByUserId.get(user.id) || 0 })) });
  });

  app.post('/api/chat/:clientId/read', requireAuth, rateByUser('chat_read', 60 * 1000, 600), (req, res) => {
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' });
    const dm = chat.parseDmThreadId(clientId);
    if (dm) {
      if (req.userId !== dm.a && req.userId !== dm.b) return res.status(403).json({ error: 'Forbidden' });
      const otherUserId = req.userId === dm.a ? dm.b : dm.a;
      const now = Date.now();
      try {
        const ids = db
          .prepare(
            `SELECT id
             FROM dm_chat_messages
             WHERE pairKey = ? AND toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL
             ORDER BY createdAt ASC
             LIMIT 800`
          )
          .all(dm.pairKey, req.userId)
          .map((row) => String(row.id));
        db.prepare(
          `UPDATE dm_chat_messages
           SET readAt = ?, updatedAt = ?
           WHERE pairKey = ? AND toUserId = ? AND deleted = 0 AND deliveredAt IS NOT NULL AND readAt IS NULL`
        ).run(now, now, dm.pairKey, req.userId);
        if (ids.length) sendToUser(otherUserId, { type: 'dm_chat_read', threadId: dm.threadId, messageIds: ids, readAt: now });
        return res.json({ ok: true, lastReadAt: now });
      } catch {
        return res.status(500).json({ error: 'Failed' });
      }
    }
    if (!userCanChatClient(req.userId, isAdminReq(req), clientId)) return res.status(403).json({ error: 'Forbidden' });
    const now = Date.now();
    db.prepare(
      `INSERT INTO client_chat_reads (userId, clientId, lastReadAt)
       VALUES (?, ?, ?)
       ON CONFLICT(userId, clientId) DO UPDATE SET lastReadAt = excluded.lastReadAt`
    ).run(req.userId, clientId, now);
    broadcastToChatClient(clientId, { type: 'client_chat_read', clientId, userId: req.userId, lastReadAt: now });
    res.json({ ok: true, lastReadAt: now });
  });

  app.post('/api/chat/:clientId/messages', requireAuth, rateByUser('chat_send', 60 * 1000, 120), (req, res) => {
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

    const dm = chat.parseDmThreadId(clientId);
    if (dm) {
      if (req.userId !== dm.a && req.userId !== dm.b) return res.status(403).json({ error: 'Forbidden' });
      const otherUserId = req.userId === dm.a ? dm.b : dm.a;
      const other = db.prepare('SELECT id, username, avatarUrl, isAdmin, isSuperAdmin, disabled FROM users WHERE id = ?').get(otherUserId);
      if (!other || Number(other.disabled) === 1) return res.status(404).json({ error: 'Not found' });
      const meIsAdmin = isAdminReq(req);
      const otherIsAdmin = !!other.isAdmin || !!other.isSuperAdmin;
      const myClients = getChatClientIdsForUser(req.userId, meIsAdmin);
      const otherClients = getChatClientIdsForUser(String(other.id), otherIsAdmin);
      let hasCommon = false;
      for (const id of myClients) {
        if (otherClients.has(id)) {
          hasCommon = true;
          break;
        }
      }
      if (!hasCommon && !meIsAdmin) return res.status(403).json({ error: 'Read-only' });
      if (chat.userHasBlocked(req.userId, otherUserId)) return res.status(403).json({ error: 'Blocked' });

      const text = typeof req.body?.text === 'string' ? String(req.body.text) : '';
      const trimmed = text.replace(/\r\n/g, '\n').trim();
      const attachmentsIn = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
      const replyToId = typeof req.body?.replyToId === 'string' ? String(req.body.replyToId).trim() : '';
      if (trimmed.length > 4000) return res.status(400).json({ error: 'Message too long' });
      if (!trimmed && !attachmentsIn.length) return res.status(400).json({ error: 'Empty message' });
      const attachmentResult = chat.prepareChatAttachments(attachmentsIn);
      if (!attachmentResult.ok) return res.status(400).json(attachmentResult.error);
      const attachments = attachmentResult.attachments;

      const me = db.prepare('SELECT username, avatarUrl FROM users WHERE id = ?').get(req.userId);
      const now = Date.now();
      const id = crypto.randomUUID();
      if (replyToId) {
        const ok = db.prepare('SELECT id FROM dm_chat_messages WHERE id = ? AND pairKey = ?').get(replyToId, dm.pairKey);
        if (!ok) return res.status(400).json({ error: 'Invalid replyToId' });
      }
      const recipientHasBlockedSender = chat.userHasBlocked(otherUserId, req.userId);
      let recipientOnline = false;
      for (const info of wsClientInfo.values()) {
        if (info?.userId === otherUserId) {
          recipientOnline = true;
          break;
        }
      }
      const deliveredAt = !recipientHasBlockedSender && recipientOnline ? now : null;
      db.prepare(
        `INSERT INTO dm_chat_messages (id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deliveredAt, readAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '{}', ?, 0, ?, NULL, ?, ?)`
      ).run(id, dm.pairKey, req.userId, otherUserId, String(me?.username || req.username || ''), String(me?.avatarUrl || ''), replyToId || null, JSON.stringify(attachments), trimmed, deliveredAt, now, now);
      const message = chat.getNormalizedDmChatMessageById(id);
      chat.emitDmMessageEvent('dm_chat_new', {
        pairKey: dm.pairKey,
        fromUserId: req.userId,
        toUserId: otherUserId,
        message
      });
      return res.json({ ok: true, message });
    }

    if (!userCanChatClient(req.userId, isAdminReq(req), clientId)) return res.status(403).json({ error: 'Forbidden' });
    const text = typeof req.body?.text === 'string' ? String(req.body.text) : '';
    const trimmed = text.replace(/\r\n/g, '\n').trim();
    const attachmentsIn = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    const replyToId = typeof req.body?.replyToId === 'string' ? String(req.body.replyToId).trim() : '';
    if (trimmed.length > 4000) return res.status(400).json({ error: 'Message too long' });
    if (!trimmed && !attachmentsIn.length) return res.status(400).json({ error: 'Empty message' });
    const attachmentResult = chat.prepareChatAttachments(attachmentsIn);
    if (!attachmentResult.ok) return res.status(400).json(attachmentResult.error);
    const attachments = attachmentResult.attachments;
    const me = db.prepare('SELECT username, avatarUrl FROM users WHERE id = ?').get(req.userId);
    const now = Date.now();
    const id = crypto.randomUUID();
    if (replyToId) {
      const ok = db.prepare('SELECT id FROM client_chat_messages WHERE id = ? AND clientId = ?').get(replyToId, clientId);
      if (!ok) return res.status(400).json({ error: 'Invalid replyToId' });
    }
    db.prepare(
      `INSERT INTO client_chat_messages (id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '{}', ?, 0, ?, ?)`
    ).run(id, clientId, req.userId, String(me?.username || req.username || ''), String(me?.avatarUrl || ''), replyToId || null, JSON.stringify(attachments), trimmed, now, now);
    db.prepare(
      `INSERT INTO client_chat_reads (userId, clientId, lastReadAt)
       VALUES (?, ?, ?)
       ON CONFLICT(userId, clientId) DO UPDATE SET lastReadAt = excluded.lastReadAt`
    ).run(req.userId, clientId, now);
    const message = chat.getNormalizedClientChatMessageById(id);
    broadcastToChatClient(clientId, { type: 'client_chat_new', clientId, message });
    res.json({ ok: true, message });
  });

  app.put('/api/chat/messages/:id', requireAuth, rateByUser('chat_edit', 60 * 1000, 120), (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const text = typeof req.body?.text === 'string' ? String(req.body.text) : '';
    const trimmed = text.replace(/\r\n/g, '\n').trim();
    if (!trimmed) return res.status(400).json({ error: 'Empty message' });
    if (trimmed.length > 4000) return res.status(400).json({ error: 'Message too long' });
    const hit = chat.findChatMessageById(id);
    if (!hit) return res.status(404).json({ error: 'Not found' });
    const row = hit.row;
    if (Number(row.deleted) === 1) return res.status(400).json({ error: 'Deleted' });
    const ownerId = hit.kind === 'client' ? String(row.userId) : String(row.fromUserId);
    if (ownerId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const now = Date.now();
    if (now - (Number(row.createdAt) || 0) > 30 * 60 * 1000) return res.status(400).json({ error: 'Edit window expired' });
    if (hit.kind === 'client') {
      db.prepare('UPDATE client_chat_messages SET text = ?, editedAt = ?, updatedAt = ? WHERE id = ?').run(trimmed, now, now, id);
      const message = chat.getNormalizedClientChatMessageById(id);
      broadcastToChatClient(String(row.clientId), { type: 'client_chat_update', clientId: String(row.clientId), message });
      return res.json({ ok: true, message });
    }
    db.prepare('UPDATE dm_chat_messages SET text = ?, editedAt = ?, updatedAt = ? WHERE id = ?').run(trimmed, now, now, id);
    const message = chat.getNormalizedDmChatMessageById(id);
    chat.emitDmMessageEvent('dm_chat_update', {
      pairKey: row.pairKey,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      message
    });
    res.json({ ok: true, message });
  });

  app.delete('/api/chat/messages/:id', requireAuth, rateByUser('chat_delete', 60 * 1000, 120), (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const mode = String(req.query?.mode || '').trim().toLowerCase() === 'me' ? 'me' : 'all';
    const hit = chat.findChatMessageById(id);
    if (!hit) return res.status(404).json({ error: 'Not found' });
    const row = hit.row;
    if (Number(row.deleted) === 1 && mode === 'all') return res.json({ ok: true });
    if (mode === 'me') {
      if (hit.kind === 'client') {
        if (!userCanChatClient(req.userId, isAdminReq(req), String(row.clientId || ''))) return res.status(403).json({ error: 'Forbidden' });
        const hiddenFor = chat.parseDeletedForUserIds(row.deletedForJson);
        if (!hiddenFor.has(req.userId)) {
          hiddenFor.add(req.userId);
          db.prepare('UPDATE client_chat_messages SET deletedForJson = ?, updatedAt = ? WHERE id = ?').run(chat.encodeDeletedForUserIds(hiddenFor), Date.now(), id);
        }
        return res.json({ ok: true, mode: 'me' });
      }
      const isParticipant = String(row.fromUserId || '') === req.userId || String(row.toUserId || '') === req.userId;
      if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
      const hiddenFor = chat.parseDeletedForUserIds(row.deletedForJson);
      if (!hiddenFor.has(req.userId)) {
        hiddenFor.add(req.userId);
        db.prepare('UPDATE dm_chat_messages SET deletedForJson = ?, updatedAt = ? WHERE id = ?').run(chat.encodeDeletedForUserIds(hiddenFor), Date.now(), id);
      }
      return res.json({ ok: true, mode: 'me' });
    }
    const isOwner = (hit.kind === 'client' ? String(row.userId) : String(row.fromUserId)) === req.userId;
    if (!isOwner && !req.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    const now = Date.now();
    const createdAt = Number(row.createdAt) || 0;
    if (createdAt && now - createdAt > 30 * 60 * 1000) return res.status(400).json({ error: 'Delete-for-everyone window expired' });
    if (hit.kind === 'client') {
      db.prepare('UPDATE client_chat_messages SET deleted = 1, deletedAt = ?, deletedById = ?, updatedAt = ? WHERE id = ?').run(now, req.userId, now, id);
      const message = chat.getNormalizedClientChatMessageById(id);
      broadcastToChatClient(String(row.clientId), { type: 'client_chat_update', clientId: String(row.clientId), message });
      return res.json({ ok: true });
    }
    db.prepare('UPDATE dm_chat_messages SET deleted = 1, deletedAt = ?, deletedById = ?, updatedAt = ? WHERE id = ?').run(now, req.userId, now, id);
    const message = chat.getNormalizedDmChatMessageById(id);
    chat.emitDmMessageEvent('dm_chat_update', {
      pairKey: row.pairKey,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      message
    });
    res.json({ ok: true });
  });

  app.post('/api/chat/messages/:id/star', requireAuth, rateByUser('chat_star', 60 * 1000, 240), (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });
    let kind = 'client';
    let row = db.prepare('SELECT id, clientId, deleted, starredByJson FROM client_chat_messages WHERE id = ?').get(id);
    if (!row) {
      kind = 'dm';
      row = db.prepare('SELECT id, pairKey, fromUserId, toUserId, deleted, deliveredAt, starredByJson FROM dm_chat_messages WHERE id = ?').get(id);
    }
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (Number(row.deleted) === 1) return res.status(400).json({ error: 'Deleted' });
    if (kind === 'client') {
      if (!userCanChatClient(req.userId, isAdminReq(req), String(row.clientId))) return res.status(403).json({ error: 'Forbidden' });
    } else {
      const isParticipant = String(row.fromUserId) === req.userId || String(row.toUserId) === req.userId;
      if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
    }
    let list = [];
    try {
      const parsed = JSON.parse(String(row.starredByJson || '[]'));
      if (Array.isArray(parsed)) list = parsed;
    } catch {}
    const uniq = new Set(list.map((value) => String(value || '').trim()).filter(Boolean));
    const wantStar = typeof req.body?.star === 'boolean' ? !!req.body.star : !uniq.has(req.userId);
    if (wantStar) uniq.add(req.userId);
    else uniq.delete(req.userId);
    const now = Date.now();
    if (kind === 'client') {
      const clientId = String(row.clientId);
      db.prepare('UPDATE client_chat_messages SET starredByJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(Array.from(uniq)), now, id);
      const message = chat.getNormalizedClientChatMessageById(id);
      broadcastToChatClient(clientId, { type: 'client_chat_update', clientId, message });
      return res.json({ ok: true, message });
    }
    db.prepare('UPDATE dm_chat_messages SET starredByJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(Array.from(uniq)), now, id);
    const message = chat.getNormalizedDmChatMessageById(id);
    chat.emitDmMessageEvent('dm_chat_update', {
      pairKey: row.pairKey,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      message
    });
    res.json({ ok: true, message });
  });

  app.post('/api/chat/messages/:id/react', requireAuth, rateByUser('chat_react', 60 * 1000, 600), (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const emoji = typeof req.body?.emoji === 'string' ? String(req.body.emoji) : '';
    if (!chat.allowedReactions.has(emoji)) return res.status(400).json({ error: 'Invalid emoji' });
    let kind = 'client';
    let row = db.prepare('SELECT id, clientId, deleted, reactionsJson FROM client_chat_messages WHERE id = ?').get(id);
    if (!row) {
      kind = 'dm';
      row = db.prepare('SELECT id, pairKey, fromUserId, toUserId, deleted, deliveredAt, reactionsJson FROM dm_chat_messages WHERE id = ?').get(id);
    }
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (Number(row.deleted) === 1) return res.status(400).json({ error: 'Deleted' });
    if (kind === 'client') {
      if (!userCanChatClient(req.userId, isAdminReq(req), String(row.clientId))) return res.status(403).json({ error: 'Forbidden' });
    } else {
      const isParticipant = String(row.fromUserId) === req.userId || String(row.toUserId) === req.userId;
      if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
    }
    let parsed = {};
    try {
      const obj = JSON.parse(String(row.reactionsJson || '{}'));
      if (obj && typeof obj === 'object') parsed = obj;
    } catch {}
    let already = false;
    for (const [key, users] of Object.entries(parsed)) {
      if (!Array.isArray(users)) continue;
      const next = users.map((value) => String(value || '').trim()).filter(Boolean).filter((value) => value !== req.userId);
      if (String(key) === emoji && next.length !== users.length) already = true;
      parsed[key] = next;
    }
    if (!already) {
      const list = Array.isArray(parsed[emoji]) ? parsed[emoji] : [];
      const uniq = new Set(list.map((value) => String(value || '').trim()).filter(Boolean));
      uniq.add(req.userId);
      parsed[emoji] = Array.from(uniq);
    }
    for (const key of Object.keys(parsed)) {
      if (!chat.allowedReactions.has(key)) {
        delete parsed[key];
        continue;
      }
      if (!Array.isArray(parsed[key]) || parsed[key].length === 0) delete parsed[key];
    }
    const now = Date.now();
    if (kind === 'client') {
      const clientId = String(row.clientId);
      db.prepare('UPDATE client_chat_messages SET reactionsJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(parsed), now, id);
      const message = chat.getNormalizedClientChatMessageById(id);
      broadcastToChatClient(clientId, { type: 'client_chat_update', clientId, message });
      return res.json({ ok: true, message });
    }
    db.prepare('UPDATE dm_chat_messages SET reactionsJson = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(parsed), now, id);
    const message = chat.getNormalizedDmChatMessageById(id);
    chat.emitDmMessageEvent('dm_chat_update', {
      pairKey: row.pairKey,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      message
    });
    res.json({ ok: true, message });
  });

  app.post('/api/chat/:clientId/clear', requireAuth, rateByUser('chat_clear', 10 * 60 * 1000, 30), (req, res) => {
    if (!req.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' });
    const maps = getClientScopeMaps();
    if (!maps.clientIds.has(clientId)) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM client_chat_messages WHERE clientId = ?').run(clientId);
    writeAuditLog(db, {
      level: 'important',
      event: 'client_chat_cleared',
      userId: req.userId,
      username: req.username,
      scopeType: 'client',
      scopeId: clientId,
      ...requestMeta(req),
      details: { clientName: chat.getClientNameById(clientId) }
    });
    broadcastToChatClient(clientId, { type: 'client_chat_clear', clientId, clearedAt: Date.now() });
    res.json({ ok: true });
  });

  app.get('/api/chat/:clientId/export', requireAuth, (req, res) => {
    const clientId = String(req.params.clientId || '').trim();
    if (!clientId) return res.status(400).send('Missing clientId');

    const dm = chat.parseDmThreadId(clientId);
    if (dm) {
      if (req.userId !== dm.a && req.userId !== dm.b) return res.status(403).send('Forbidden');
      const otherUserId = req.userId === dm.a ? dm.b : dm.a;
      const other = db.prepare('SELECT id, username, firstName, lastName, disabled FROM users WHERE id = ?').get(otherUserId);
      if (!other || Number(other.disabled) === 1) return res.status(404).send('Not found');
      const normalizedUsername = String(other.username || '').toLowerCase();
      const title = `${String(other.firstName || '').trim()} ${String(other.lastName || '').trim()}`.trim() || normalizedUsername;
      const qf = String(req.query.format || 'txt').toLowerCase();
      const format = qf === 'json' ? 'json' : qf === 'html' ? 'html' : 'txt';
      const rows = db
        .prepare(
          `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
           FROM dm_chat_messages
           WHERE pairKey = ?
           ORDER BY createdAt ASC`
        )
        .all(dm.pairKey)
        .map(chat.normalizeDmChatMessageRow)
        .filter(Boolean);
      const safeName = String(title || 'dm').replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'dm';
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.json\"`);
        return res.send(JSON.stringify({ threadId: dm.threadId, title, exportedAt: Date.now(), messages: rows }, null, 2));
      }
      if (format === 'html') {
        const items = rows
          .map((message) => {
            const date = new Date(message.createdAt);
            const ts = `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const body = message.deleted ? '<em>Messaggio eliminato</em>' : escapeHtml(message.text).replace(/\n/g, '<br/>');
            const edited = message.editedAt && !message.deleted ? ' <span class="edited">(modificato)</span>' : '';
            const attachments = (message.attachments || []).length
              ? `<div class="attachments">${message.attachments.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.name || item.url)}</a>`).join('')}</div>`
              : '';
            return `<div class="msg"><div class="meta"><span class="ts">[${escapeHtml(ts)}]</span> <strong>${escapeHtml(message.username)}</strong>${edited}</div><div class="body">${body}</div>${attachments}</div>`;
          })
          .join('\n');
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Chat ${escapeHtml(title)}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#0b1220; color:#e2e8f0; padding:24px;}
    .wrap{max-width:900px;margin:0 auto;}
    h1{font-size:18px;margin:0 0 8px 0;}
    .sub{font-size:12px;color:#94a3b8;margin:0 0 18px 0;}
    .msg{border:1px solid rgba(148,163,184,.22); background:rgba(15,23,42,.6); border-radius:14px; padding:12px 14px; margin:10px 0;}
    .meta{font-size:12px;color:#cbd5e1;margin-bottom:6px;}
    .ts{color:#94a3b8;}
    .edited{font-weight:700;color:#a7f3d0;}
    .body{font-size:14px;line-height:1.35;white-space:normal}
    .attachments{margin-top:8px; display:flex; flex-wrap:wrap; gap:8px;}
    .attachments a{display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.22); color:#e2e8f0; text-decoration:none;}
    .attachments a:hover{background:rgba(148,163,184,.12);}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Chat: ${escapeHtml(title)}</h1>
    <div class="sub">Export: ${escapeHtml(new Date().toISOString())}</div>
    ${items}
  </div>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.html\"`);
        return res.send(html);
      }
      const lines = [];
      for (const message of rows) {
        const date = new Date(message.createdAt);
        const ts = `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const body = message.deleted ? '(messaggio eliminato)' : message.text.replace(/\n/g, ' ');
        const edited = message.editedAt ? ' (modificato)' : '';
        const attachments = (message.attachments || []).length ? ` [allegati: ${(message.attachments || []).map((item) => item?.name || item?.url).join(', ')}]` : '';
        lines.push(`[${ts}] ${message.username}: ${body}${edited}${attachments}`);
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.txt\"`);
      return res.send(lines.join('\n'));
    }

    if (!userCanChatClient(req.userId, isAdminReq(req), clientId)) return res.status(403).send('Forbidden');
    const qf = String(req.query.format || 'txt').toLowerCase();
    const format = qf === 'json' ? 'json' : qf === 'html' ? 'html' : 'txt';
    const rows = db
      .prepare(
        `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
         FROM client_chat_messages
         WHERE clientId = ?
         ORDER BY createdAt ASC`
      )
      .all(clientId)
      .map(chat.normalizeChatMessageRow);
    const clientName = chat.getClientNameById(clientId);
    const safeName = String(clientName || clientId).replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || clientId;
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.json\"`);
      return res.send(JSON.stringify({ clientId, clientName, exportedAt: Date.now(), messages: rows }, null, 2));
    }
    if (format === 'html') {
      const items = rows
        .map((message) => {
          const date = new Date(message.createdAt);
          const ts = `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          const body = message.deleted ? '<em>Messaggio eliminato</em>' : escapeHtml(message.text).replace(/\n/g, '<br/>');
          const edited = message.editedAt && !message.deleted ? ' <span class="edited">(modificato)</span>' : '';
          const attachments = (message.attachments || []).length
            ? `<div class="attachments">${message.attachments.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.name || item.url)}</a>`).join('')}</div>`
            : '';
          return `<div class="msg"><div class="meta"><span class="ts">[${escapeHtml(ts)}]</span> <strong>${escapeHtml(message.username)}</strong>${edited}</div><div class="body">${body}</div>${attachments}</div>`;
        })
        .join('\n');
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Chat ${escapeHtml(clientName)}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#0b1220; color:#e2e8f0; padding:24px;}
    .wrap{max-width:900px;margin:0 auto;}
    h1{font-size:18px;margin:0 0 8px 0;}
    .sub{font-size:12px;color:#94a3b8;margin:0 0 18px 0;}
    .msg{border:1px solid rgba(148,163,184,.22); background:rgba(15,23,42,.6); border-radius:14px; padding:12px 14px; margin:10px 0;}
    .meta{font-size:12px;color:#cbd5e1;margin-bottom:6px;}
    .ts{color:#94a3b8;}
    .edited{font-weight:700;color:#a7f3d0;}
    .body{font-size:14px;line-height:1.35;white-space:normal}
    .attachments{margin-top:8px; display:flex; flex-wrap:wrap; gap:8px;}
    .attachments a{display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.22); color:#e2e8f0; text-decoration:none;}
    .attachments a:hover{background:rgba(148,163,184,.12);}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Chat: ${escapeHtml(clientName)}</h1>
    <div class="sub">Export: ${escapeHtml(new Date().toISOString())}</div>
    ${items}
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.html\"`);
      return res.send(html);
    }
    const lines = [];
    for (const message of rows) {
      const date = new Date(message.createdAt);
      const ts = `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const body = message.deleted ? '(messaggio eliminato)' : message.text.replace(/\n/g, ' ');
      const edited = message.editedAt ? ' (modificato)' : '';
      const attachments = (message.attachments || []).length ? ` [allegati: ${(message.attachments || []).map((item) => item?.name || item?.url).join(', ')}]` : '';
      lines.push(`[${ts}] ${message.username}: ${body}${edited}${attachments}`);
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"chat-${safeName}.txt\"`);
    res.send(lines.join('\n'));
  });
};

module.exports = {
  registerChatRoutes
};
