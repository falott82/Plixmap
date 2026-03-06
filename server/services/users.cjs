const { isStrictSuperAdmin } = require('../access.cjs');

const normalizeUserEmailKey = (value) => String(value || '').trim().toLowerCase();

const findPortalUserEmailConflict = (db, userId, email) => {
  const emailKey = normalizeUserEmailKey(email);
  if (!emailKey) return null;
  const rows = db.prepare('SELECT id, username, email FROM users').all();
  const selfId = String(userId || '').trim();
  for (const row of rows) {
    if (selfId && String(row.id || '') === selfId) continue;
    if (normalizeUserEmailKey(row.email) === emailKey) {
      return { id: String(row.id || ''), username: String(row.username || ''), email: String(row.email || '') };
    }
  }
  return null;
};

const mapAdminUsersResponse = ({ db, state, users, getUserLock }) => {
  const clientNameById = new Map((state?.clients || []).map((client) => [String(client.id || ''), String(client.shortName || client.name || '')]));
  const perms = db.prepare('SELECT userId, scopeType, scopeId, access, chat FROM permissions').all();
  const permsByUser = new Map();
  for (const perm of perms) {
    const list = permsByUser.get(perm.userId) || [];
    list.push({ scopeType: perm.scopeType, scopeId: perm.scopeId, access: perm.access, chat: !!perm.chat });
    permsByUser.set(perm.userId, list);
  }
  const linkedLookupStmt = db.prepare(
    'SELECT clientId, externalId, firstName, lastName, email, mobile, role, dept1 FROM external_users WHERE clientId = ? AND externalId = ?'
  );
  return (users || []).map((user) => ({
    ...user,
    lockedUntil: getUserLock(user.username),
    permissions: permsByUser.get(user.id) || [],
    linkedImportedUser:
      user.linkedExternalClientId && user.linkedExternalId
        ? (() => {
            const row = linkedLookupStmt.get(user.linkedExternalClientId, user.linkedExternalId);
            if (!row) return null;
            return {
              clientId: String(row.clientId || ''),
              clientName: clientNameById.get(String(row.clientId || '')) || String(row.clientId || ''),
              externalId: String(row.externalId || ''),
              firstName: String(row.firstName || ''),
              lastName: String(row.lastName || ''),
              fullName: `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim(),
              email: String(row.email || ''),
              phone: String(row.mobile || ''),
              role: String(row.role || ''),
              department: String(row.dept1 || '')
            };
          })()
        : null
  }));
};

const searchImportedUsers = ({ db, state, qRaw, emailRaw, limitRaw }) => {
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 15;
  const emailKey = normalizeUserEmailKey(emailRaw || qRaw);
  const q = String(qRaw || '').trim().toLowerCase();
  const rows = db
    .prepare(
      `SELECT clientId, externalId, firstName, lastName, email, mobile, role, dept1, hidden, present
       FROM external_users`
    )
    .all();
  const clientNameById = new Map((state?.clients || []).map((client) => [String(client.id || ''), String(client.shortName || client.name || '')]));
  return rows
    .map((row) => {
      const item = {
        clientId: String(row.clientId || ''),
        clientName: clientNameById.get(String(row.clientId || '')) || String(row.clientId || ''),
        externalId: String(row.externalId || ''),
        firstName: String(row.firstName || ''),
        lastName: String(row.lastName || ''),
        fullName: `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim(),
        email: String(row.email || ''),
        phone: String(row.mobile || ''),
        role: String(row.role || ''),
        department: String(row.dept1 || ''),
        hidden: Number(row.hidden || 0) === 1,
        present: Number(row.present || 0) === 1
      };
      const hay = `${item.fullName} ${item.email} ${item.department} ${item.role} ${item.phone} ${item.clientName}`.toLowerCase();
      const itemEmailKey = normalizeUserEmailKey(item.email);
      let score = 0;
      if (emailKey && itemEmailKey && itemEmailKey === emailKey) score += 1000;
      if (q && hay.includes(q)) score += 100;
      if (!q && !emailKey) score += 1;
      if (!item.hidden) score += 5;
      if (item.present) score += 5;
      return { item, score, hay };
    })
    .filter((entry) => {
      if (emailKey && normalizeUserEmailKey(entry.item.email) === emailKey) return true;
      if (!q) return true;
      return entry.hay.includes(q);
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.present !== b.item.present) return a.item.present ? -1 : 1;
      if (a.item.hidden !== b.item.hidden) return a.item.hidden ? 1 : -1;
      return String(a.item.fullName || a.item.email || '').localeCompare(String(b.item.fullName || b.item.email || ''));
    })
    .slice(0, limit)
    .map((entry) => entry.item);
};

const listDirectoryUsers = (db) =>
  db
    .prepare('SELECT id, username, isAdmin, isSuperAdmin, disabled, firstName, lastName, avatarUrl FROM users ORDER BY username ASC')
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
        isSuperAdmin: isStrictSuperAdmin({ ...user, username: normalizedUsername })
      };
    });

module.exports = {
  normalizeUserEmailKey,
  findPortalUserEmailConflict,
  mapAdminUsersResponse,
  searchImportedUsers,
  listDirectoryUsers
};
