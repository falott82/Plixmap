const crypto = require('crypto');
const fs = require('fs');

const { isStrictSuperAdmin } = require('../access.cjs');

const CHAT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const CHAT_MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const CHAT_VOICE_MAX_ATTACHMENT_BYTES = (() => {
  const raw = Number(process.env.PLIXMAP_CHAT_MAX_VOICE_MB || '');
  return Number.isFinite(raw) && raw > 0 ? raw * 1024 * 1024 : 40 * 1024 * 1024;
})();
const CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES = CHAT_VOICE_MAX_ATTACHMENT_BYTES;
const CHAT_MAX_ATTACHMENTS = 10;
const CHAT_ALLOWED_REACTIONS = new Set(['👍', '👎', '❤️', '😂', '😮', '😢', '🙏']);
const CHAT_OVERVIEW_PREVIEW_LIMIT = 16;
const CHAT_VOICE_EXTS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm']);
const CHAT_ALLOWED_EXTS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'gif',
  'webp',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
  'rar',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'mp4',
  'webm',
  'mov'
]);

const chatExtForMime = (mime) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/pjpeg') return 'jpg';
  if (m === 'image/jpg') return 'jpg';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/webp') return 'webp';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'application/msword') return 'doc';
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (m === 'application/vnd.ms-excel') return 'xls';
  if (m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (m === 'application/vnd.ms-powerpoint') return 'ppt';
  if (m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (m === 'application/zip') return 'zip';
  if (m === 'application/x-zip-compressed') return 'zip';
  if (m === 'application/vnd.rar') return 'rar';
  if (m === 'application/x-rar-compressed') return 'rar';
  if (m === 'audio/mpeg') return 'mp3';
  if (m === 'audio/mp3') return 'mp3';
  if (m === 'audio/wav') return 'wav';
  if (m === 'audio/x-wav') return 'wav';
  if (m === 'audio/wave') return 'wav';
  if (m === 'audio/mp4') return 'm4a';
  if (m === 'audio/x-m4a') return 'm4a';
  if (m === 'audio/aac') return 'aac';
  if (m === 'audio/ogg') return 'ogg';
  if (m === 'audio/webm') return 'webm';
  if (m === 'video/mp4') return 'mp4';
  if (m === 'video/webm') return 'webm';
  if (m === 'video/quicktime') return 'mov';
  return null;
};

const chatExtFromFilename = (name) => {
  const base = String(name || '').trim();
  const idx = base.lastIndexOf('.');
  if (idx === -1) return null;
  const ext = base.slice(idx + 1).toLowerCase();
  return ext || null;
};

const normalizeChatAttachmentList = (raw) => {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const url = String(item.url || '');
    if (!url || !url.startsWith('/uploads/')) continue;
    out.push({
      name: String(item.name || '').slice(0, 200),
      url,
      mime: String(item.mime || ''),
      sizeBytes: Number(item.sizeBytes) || 0
    });
  }
  return out;
};

const parseDeletedForUserIds = (raw) => {
  if (!raw) return new Set();
  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return new Set();
    }
  }
  if (!Array.isArray(parsed)) return new Set();
  const out = new Set();
  for (const entry of parsed) {
    const id = String(entry || '').trim();
    if (id) out.add(id);
  }
  return out;
};

const encodeDeletedForUserIds = (set) => JSON.stringify(Array.from(set || []));

const createChatServices = (deps) => {
  const {
    db,
    readState,
    getChatClientIdsForUser,
    parseDataUrl,
    base64SizeBytes,
    uploadsDir,
    wsClientInfo,
    sendToUser
  } = deps;

  const validateChatAttachmentInput = (attachment) => {
    const name = String(attachment?.name || '').trim();
    const dataUrl = String(attachment?.dataUrl || '').trim();
    if (!name || !dataUrl) return { ok: false, reason: 'invalid' };
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return { ok: false, reason: 'invalid' };
    const mime = String(parsed.mime || '').toLowerCase();
    const sizeBytes = base64SizeBytes(parsed.base64 || '');
    const extFromMime = chatExtForMime(mime);
    const extFromName = chatExtFromFilename(name);
    const ext = extFromMime || extFromName;
    if (!ext || !CHAT_ALLOWED_EXTS.has(ext)) return { ok: false, reason: 'type', mime, ext };
    const isVoice = name.toLowerCase().startsWith('voice-') && CHAT_VOICE_EXTS.has(ext);
    const maxBytes = isVoice ? CHAT_VOICE_MAX_ATTACHMENT_BYTES : CHAT_MAX_ATTACHMENT_BYTES;
    if (sizeBytes > maxBytes) return { ok: false, reason: 'size', maxBytes, sizeBytes };
    if (extFromMime === null && mime !== 'application/octet-stream' && mime !== '') {
      return { ok: false, reason: 'mime', mime, ext };
    }
    return { ok: true, name, dataUrl, mime, sizeBytes, ext, isVoice };
  };

  const externalizeChatAttachmentDataUrl = (name, dataUrl, ext) => {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    const validation = validateChatAttachmentInput({ name, dataUrl });
    if (!validation.ok) return null;
    const id = crypto.randomUUID();
    const filename = `${id}.${ext}`;
    try {
      fs.writeFileSync(`${uploadsDir}/${filename}`, Buffer.from(parsed.base64, 'base64'));
      return `/uploads/${filename}`;
    } catch {
      return null;
    }
  };

  const isMessageHiddenForUser = (row, userId) => {
    if (!row || !userId) return false;
    const hiddenFor = parseDeletedForUserIds(row.deletedForJson);
    return hiddenFor.has(String(userId));
  };

  const normalizeChatMessageRow = (row) => {
    const deleted = Number(row.deleted) === 1;
    const attachments = deleted ? [] : normalizeChatAttachmentList(row.attachmentsJson);
    const deletedFor = parseDeletedForUserIds(deleted ? [] : row.deletedForJson);
    const starredBy = (() => {
      const raw = deleted ? [] : row.starredByJson;
      if (!raw) return [];
      let parsed = raw;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return [];
        }
      }
      if (!Array.isArray(parsed)) return [];
      const uniq = new Set();
      for (const value of parsed) {
        const id = String(value || '').trim();
        if (id) uniq.add(id);
      }
      return Array.from(uniq);
    })();
    const reactions = (() => {
      const raw = deleted ? {} : row.reactionsJson;
      if (!raw) return {};
      let parsed = raw;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return {};
        }
      }
      if (!parsed || typeof parsed !== 'object') return {};
      const out = {};
      for (const [emoji, users] of Object.entries(parsed)) {
        if (!CHAT_ALLOWED_REACTIONS.has(String(emoji))) continue;
        if (!Array.isArray(users)) continue;
        const uniq = new Set();
        for (const value of users) {
          const id = String(value || '').trim();
          if (id) uniq.add(id);
        }
        if (uniq.size) out[String(emoji)] = Array.from(uniq);
      }
      return out;
    })();
    return {
      id: String(row.id),
      clientId: String(row.clientId),
      userId: String(row.userId),
      username: String(row.username || '').toLowerCase(),
      avatarUrl: String(row.avatarUrl || ''),
      replyToId: row.replyToId ? String(row.replyToId) : null,
      attachments,
      starredBy,
      reactions,
      text: deleted ? '' : String(row.text || ''),
      deleted,
      deletedFor: Array.from(deletedFor),
      deletedAt: row.deletedAt ? Number(row.deletedAt) : null,
      deletedById: row.deletedById ? String(row.deletedById) : null,
      editedAt: row.editedAt ? Number(row.editedAt) : null,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt)
    };
  };

  const dmThreadIdForUsers = (a, b) => {
    const x = String(a || '').trim();
    const y = String(b || '').trim();
    if (!x || !y) return null;
    const [u1, u2] = x < y ? [x, y] : [y, x];
    return `dm:${u1}:${u2}`;
  };

  const parseDmThreadId = (threadId) => {
    const raw = String(threadId || '').trim();
    if (!raw.startsWith('dm:')) return null;
    const parts = raw
      .slice(3)
      .split(':')
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    if (parts.length !== 2) return null;
    const [a, b] = parts[0] < parts[1] ? [parts[0], parts[1]] : [parts[1], parts[0]];
    return { a, b, pairKey: `${a}:${b}`, threadId: `dm:${a}:${b}` };
  };

  const userHasBlocked = (blockerId, blockedId) => {
    try {
      const row = db.prepare('SELECT 1 FROM user_blocks WHERE blockerId = ? AND blockedId = ?').get(blockerId, blockedId);
      return !!row;
    } catch {
      return false;
    }
  };

  const normalizeDmChatMessageRow = (row) => {
    if (!row) return null;
    const base = normalizeChatMessageRow({
      ...row,
      clientId: `dm:${String(row.pairKey || '').trim()}`,
      userId: String(row.fromUserId || '')
    });
    if (!base) return null;
    return {
      ...base,
      clientId: `dm:${String(row.pairKey || '').trim()}`,
      userId: String(row.fromUserId || ''),
      toUserId: String(row.toUserId || ''),
      deliveredAt: row.deliveredAt ? Number(row.deliveredAt) : null,
      readAt: row.readAt ? Number(row.readAt) : null
    };
  };

  const getLatestVisibleClientChatMessage = (clientId, userId) => {
    const rows = db
      .prepare(
        `SELECT id, clientId, userId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, createdAt, updatedAt
         FROM client_chat_messages
         WHERE clientId = ?
         ORDER BY createdAt DESC
         LIMIT ?`
      )
      .all(String(clientId || ''), CHAT_OVERVIEW_PREVIEW_LIMIT);
    for (const row of rows || []) {
      if (isMessageHiddenForUser(row, userId)) continue;
      return normalizeChatMessageRow(row);
    }
    return null;
  };

  const getLatestVisibleDmChatMessage = (pairKey, userId) => {
    const rows = db
      .prepare(
        `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
         FROM dm_chat_messages
         WHERE pairKey = ?
         ORDER BY createdAt DESC
         LIMIT ?`
      )
      .all(String(pairKey || ''), CHAT_OVERVIEW_PREVIEW_LIMIT);
    for (const row of rows || []) {
      if (isMessageHiddenForUser(row, userId)) continue;
      return normalizeDmChatMessageRow(row);
    }
    return null;
  };

  const findChatMessageById = (id) => {
    const messageId = String(id || '').trim();
    if (!messageId) return null;
    const clientRow = db
      .prepare('SELECT id, clientId, userId, deleted, createdAt, deletedForJson FROM client_chat_messages WHERE id = ?')
      .get(messageId);
    if (clientRow) return { kind: 'client', row: clientRow };
    const dmRow = db
      .prepare('SELECT id, pairKey, fromUserId, toUserId, deleted, createdAt, deletedForJson FROM dm_chat_messages WHERE id = ?')
      .get(messageId);
    return dmRow ? { kind: 'dm', row: dmRow } : null;
  };

  const deliverPendingDmMessagesToUser = (userId) => {
    const uid = String(userId || '').trim();
    if (!uid) return 0;
    const now = Date.now();
    let rows = [];
    try {
      rows = db
        .prepare(
          `SELECT id, pairKey, fromUserId, toUserId
           FROM dm_chat_messages
           WHERE toUserId = ? AND deleted = 0 AND deliveredAt IS NULL
           ORDER BY createdAt ASC
           LIMIT 200`
        )
        .all(uid);
    } catch {
      return 0;
    }
    let delivered = 0;
    for (const row of rows || []) {
      const fromUserId = String(row.fromUserId || '').trim();
      const toUserId = String(row.toUserId || '').trim();
      const pairKey = String(row.pairKey || '').trim();
      if (!fromUserId || !toUserId || !pairKey || toUserId !== uid) continue;
      if (userHasBlocked(toUserId, fromUserId)) continue;
      try {
        db.prepare('UPDATE dm_chat_messages SET deliveredAt = ?, updatedAt = ? WHERE id = ? AND deliveredAt IS NULL').run(now, now, String(row.id));
        const updated = db
          .prepare(
            `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
             FROM dm_chat_messages
             WHERE id = ?`
          )
          .get(String(row.id));
        const message = normalizeDmChatMessageRow(updated);
        const threadId = `dm:${pairKey}`;
        sendToUser(toUserId, { type: 'dm_chat_new', threadId, message, backfill: true });
        sendToUser(fromUserId, { type: 'dm_chat_update', threadId, message, receipt: true });
        delivered += 1;
      } catch {
        // ignore single-row delivery errors
      }
    }
    return delivered;
  };

  const getClientNameById = (clientId) => {
    const state = readState();
    const client = (state.clients || []).find((item) => item?.id === clientId);
    return client?.shortName || client?.name || clientId;
  };

  const listDmContactUsers = (meId, meIsAdmin) => {
    const myClients = getChatClientIdsForUser(meId, meIsAdmin);
    const onlineIds = new Set();
    for (const info of wsClientInfo.values()) {
      if (info?.userId) onlineIds.add(String(info.userId));
    }

    const lastDmAtByPair = new Map();
    try {
      const rows = db
        .prepare(
          `SELECT pairKey, createdAt, deletedForJson
           FROM dm_chat_messages
           WHERE (fromUserId = ? OR toUserId = ?) AND deleted = 0`
        )
        .all(meId, meId);
      for (const row of rows || []) {
        if (isMessageHiddenForUser(row, meId)) continue;
        const key = String(row.pairKey || '').trim();
        if (!key) continue;
        const createdAt = Number(row.createdAt) || 0;
        const prev = Number(lastDmAtByPair.get(key) || 0);
        if (createdAt > prev) lastDmAtByPair.set(key, createdAt);
      }
    } catch {}

    const blockedByMe = new Set();
    const blockedMe = new Set();
    try {
      const rows = db.prepare('SELECT blockerId, blockedId FROM user_blocks WHERE blockerId = ? OR blockedId = ?').all(meId, meId);
      for (const row of rows || []) {
        if (String(row.blockerId) === meId && row.blockedId) blockedByMe.add(String(row.blockedId));
        if (String(row.blockedId) === meId && row.blockerId) blockedMe.add(String(row.blockerId));
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
        if (isMessageHiddenForUser(row, meId)) continue;
        const id = String(row.otherId || '').trim();
        if (id && id !== meId) dmHistoryOtherIds.add(id);
      }
    } catch {}

    const state = readState();
    const clientById = new Map();
    for (const client of state?.clients || []) {
      if (!client?.id) continue;
      clientById.set(String(client.id), {
        id: String(client.id),
        name: client.shortName || client.name || String(client.id),
        logoUrl: String(client.logoUrl || '')
      });
    }

    return db
      .prepare('SELECT id, username, firstName, lastName, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users ORDER BY username ASC')
      .all()
      .filter((user) => Number(user.disabled) !== 1)
      .map((user) => {
        const id = String(user.id);
        const normalizedUsername = String(user.username || '').toLowerCase();
        return {
          id,
          username: normalizedUsername,
          firstName: String(user.firstName || ''),
          lastName: String(user.lastName || ''),
          avatarUrl: String(user.avatarUrl || ''),
          isAdmin: !!user.isAdmin,
          isSuperAdmin: isStrictSuperAdmin({ ...user, username: normalizedUsername }),
          lastOnlineAt: user.lastOnlineAt ? Number(user.lastOnlineAt) : null
        };
      })
      .filter((user) => user.id !== meId)
      .map((user) => {
        const pairKey = user.id && meId ? (String(meId) < String(user.id) ? `${meId}:${user.id}` : `${user.id}:${meId}`) : '';
        const lastMessageAt = pairKey ? Number(lastDmAtByPair.get(pairKey) || 0) || 0 : 0;
        const targetClients = getChatClientIdsForUser(user.id, !!user.isAdmin || !!user.isSuperAdmin);
        const common = [];
        for (const id of myClients) {
          if (!targetClients.has(id)) continue;
          const meta = clientById.get(String(id));
          if (meta) common.push(meta);
        }
        common.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        const hasCommon = common.length > 0;
        const hasHistory = dmHistoryOtherIds.has(user.id);
        return {
          ...user,
          online: onlineIds.has(user.id),
          commonClients: common,
          canChat: hasCommon,
          readOnly: !hasCommon && hasHistory,
          hasHistory,
          lastMessageAt: lastMessageAt || null,
          blockedByMe: blockedByMe.has(user.id),
          blockedMe: blockedMe.has(user.id)
        };
      })
      .filter((user) => user.canChat || user.hasHistory);
  };

  return {
    maxAttachments: CHAT_MAX_ATTACHMENTS,
    maxTotalAttachmentBytes: CHAT_MAX_TOTAL_ATTACHMENT_BYTES,
    voiceMaxTotalAttachmentBytes: CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES,
    allowedReactions: CHAT_ALLOWED_REACTIONS,
    normalizeChatAttachmentList,
    validateChatAttachmentInput,
    externalizeChatAttachmentDataUrl,
    parseDeletedForUserIds,
    encodeDeletedForUserIds,
    isMessageHiddenForUser,
    normalizeChatMessageRow,
    dmThreadIdForUsers,
    parseDmThreadId,
    userHasBlocked,
    normalizeDmChatMessageRow,
    getLatestVisibleClientChatMessage,
    getLatestVisibleDmChatMessage,
    findChatMessageById,
    deliverPendingDmMessagesToUser,
    getClientNameById,
    listDmContactUsers
  };
};

module.exports = {
  createChatServices,
  CHAT_MAX_ATTACHMENTS,
  CHAT_MAX_TOTAL_ATTACHMENT_BYTES,
  CHAT_VOICE_MAX_TOTAL_ATTACHMENT_BYTES,
  CHAT_ALLOWED_REACTIONS
};
