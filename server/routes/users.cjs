const crypto = require('crypto');

const { isAdminLike, isStrictSuperAdmin } = require('../access.cjs');
const {
  findPortalUserEmailConflict,
  mapAdminUsersResponse,
  searchImportedUsers,
  listDirectoryUsers
} = require('../services/users.cjs');

const registerUserRoutes = (app, deps) => {
  const {
    db,
    readState,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    getUserLock,
    clearUserLoginFailures,
    getChatClientIdsForUser,
    userHasBlocked,
    normalizeLoginKey,
    verifyPassword,
    isStrongPassword,
    hashPassword
  } = deps;

  app.get('/api/users', requireAuth, (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const users = db
      .prepare(
        'SELECT id, username, isAdmin, isSuperAdmin, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, disabled, language, avatarUrl, firstName, lastName, phone, email, linkedExternalClientId, linkedExternalId, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
      )
      .all()
      .map((user) => {
        const normalizedUsername = String(user.username || '').toLowerCase();
        return {
          ...user,
          username: normalizedUsername,
          isAdmin: !!user.isAdmin,
          isSuperAdmin: isStrictSuperAdmin({ ...user, username: normalizedUsername }),
          canCreateMeetings: user.canCreateMeetings === undefined ? true : !!user.canCreateMeetings,
          canManageBusinessPartners: user.canManageBusinessPartners === undefined ? false : !!user.canManageBusinessPartners,
          isMeetingOperator: user.isMeetingOperator === undefined ? false : !!user.isMeetingOperator,
          linkedExternalClientId: String(user.linkedExternalClientId || ''),
          linkedExternalId: String(user.linkedExternalId || ''),
          disabled: !!user.disabled
        };
      });
    res.json({
      users: mapAdminUsersResponse({ db, state: readState(), users, getUserLock })
    });
  });

  app.get('/api/users/imported-user-search', requireAuth, (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const rows = searchImportedUsers({
      db,
      state: readState(),
      qRaw: String(req.query.q || '').trim(),
      emailRaw: String(req.query.email || '').trim(),
      limitRaw: Number(req.query.limit)
    });
    res.json({ ok: true, rows });
  });

  app.get('/api/users/directory', requireAuth, (_req, res) => {
    res.json({ users: listDirectoryUsers(db) });
  });

  app.get('/api/users/:id/profile', requireAuth, (req, res) => {
    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    const target = db
      .prepare('SELECT id, username, firstName, lastName, email, avatarUrl, isAdmin, isSuperAdmin, lastOnlineAt, disabled FROM users WHERE id = ?')
      .get(targetId);
    if (!target || Number(target.disabled) === 1) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (userHasBlocked(String(target.id), req.userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const requesterIsAdmin = isAdminLike(req);
    const targetIsAdmin = !!target.isAdmin || !!target.isSuperAdmin;
    const reqClients = getChatClientIdsForUser(req.userId, requesterIsAdmin);
    const targetClients = getChatClientIdsForUser(String(target.id), targetIsAdmin);
    const common = new Set();
    for (const id of reqClients) {
      if (targetClients.has(id)) common.add(id);
    }
    if (!common.size && !requesterIsAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const state = readState();
    const nameByClientId = new Map();
    for (const client of state?.clients || []) {
      if (!client?.id) continue;
      nameByClientId.set(String(client.id), client.shortName || client.name || String(client.id));
    }
    const clientsCommon = Array.from(common)
      .map((id) => ({ id, name: nameByClientId.get(id) || id }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const normalizedUsername = String(target.username || '').toLowerCase();
    res.json({
      id: String(target.id),
      username: normalizedUsername,
      firstName: String(target.firstName || ''),
      lastName: String(target.lastName || ''),
      email: String(target.email || ''),
      avatarUrl: String(target.avatarUrl || ''),
      lastOnlineAt: target.lastOnlineAt ? Number(target.lastOnlineAt) : null,
      clientsCommon
    });
  });

  app.post('/api/users', requireAuth, rateByUser('users_create', 10 * 60 * 1000, 30), (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const {
      username,
      password,
      firstName = '',
      lastName = '',
      phone = '',
      email = '',
      language = 'it',
      isAdmin = false,
      canCreateMeetings = true,
      canManageBusinessPartners = false,
      isMeetingOperator = false,
      linkedExternalClientId = '',
      linkedExternalId = '',
      permissions = []
    } = req.body || {};
    const normalizedUsername = normalizeLoginKey(username);
    if (!normalizedUsername || !password) {
      res.status(400).json({ error: 'Missing username/password' });
      return;
    }
    if (!isStrongPassword(String(password || ''))) {
      res.status(400).json({ error: 'Weak password' });
      return;
    }
    if (language !== 'it' && language !== 'en') {
      res.status(400).json({ error: 'Invalid language' });
      return;
    }
    if (isAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Only superadmin can create admin users' });
      return;
    }
    const meetingOperator = !!isMeetingOperator && !isAdmin;
    const linkedClientId = String(linkedExternalClientId || '').trim();
    const linkedEid = String(linkedExternalId || '').trim();
    if ((linkedClientId && !linkedEid) || (!linkedClientId && linkedEid)) {
      res.status(400).json({ error: 'Invalid linked imported user reference' });
      return;
    }
    if (linkedClientId && linkedEid) {
      const linkedRow = db
        .prepare('SELECT externalId FROM external_users WHERE clientId = ? AND externalId = ?')
        .get(linkedClientId, linkedEid);
      if (!linkedRow) {
        res.status(400).json({ error: 'Linked imported user not found' });
        return;
      }
    }
    const existing = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(normalizedUsername);
    if (existing) {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }
    const emailConflict = findPortalUserEmailConflict(db, '', email);
    if (emailConflict) {
      res.status(409).json({ error: `Email already used by ${emailConflict.username}` });
      return;
    }
    const now = Date.now();
    const id = crypto.randomUUID();
    const { salt, hash } = hashPassword(String(password));
    const defaultPaletteFavoritesJson = JSON.stringify(['real_user', 'user', 'desktop', 'rack']);
    try {
      db.prepare(
        `INSERT INTO users (id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, language, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, paletteFavoritesJson, firstName, lastName, phone, email, linkedExternalClientId, linkedExternalId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 1, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        normalizedUsername,
        salt,
        hash,
        isAdmin ? 1 : 0,
        String(language),
        meetingOperator ? 1 : canCreateMeetings === false ? 0 : 1,
        canManageBusinessPartners ? 1 : 0,
        meetingOperator ? 1 : 0,
        defaultPaletteFavoritesJson,
        String(firstName || ''),
        String(lastName || ''),
        String(phone || ''),
        String(email || ''),
        linkedClientId,
        linkedEid,
        now,
        now
      );
    } catch {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }
    const insertPerm = db.prepare(
      'INSERT OR REPLACE INTO permissions (userId, scopeType, scopeId, access, chat) VALUES (?, ?, ?, ?, ?)'
    );
    for (const permission of Array.isArray(permissions) ? permissions : []) {
      if (!permission?.scopeType || !permission?.scopeId || !permission?.access) continue;
      insertPerm.run(id, permission.scopeType, permission.scopeId, meetingOperator ? 'ro' : permission.access, permission?.chat ? 1 : 0);
    }
    writeAuditLog(db, {
      level: 'important',
      event: 'user_created',
      userId: req.userId,
      username: req.username,
      scopeType: 'user',
      scopeId: id,
      ...requestMeta(req),
      details: {
        username: normalizedUsername,
        isAdmin: !!isAdmin,
        isMeetingOperator: meetingOperator,
        canManageBusinessPartners: !!canManageBusinessPartners,
        permissions: Array.isArray(permissions) ? permissions.length : 0,
        linkedExternalClientId: linkedClientId,
        linkedExternalId: linkedEid
      }
    });
    res.json({ ok: true, id });
  });

  app.put('/api/users/:id', requireAuth, rateByUser('users_update', 10 * 60 * 1000, 60), (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const userId = req.params.id;
    const target = db
      .prepare('SELECT id, username, isAdmin, isSuperAdmin, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, disabled, language, firstName, lastName, phone, email, linkedExternalClientId, linkedExternalId FROM users WHERE id = ?')
      .get(userId);
    if (!target) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (target.isSuperAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Cannot modify superadmin' });
      return;
    }
    const { firstName, lastName, phone, email, isAdmin, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, disabled, language, linkedExternalClientId, linkedExternalId, permissions } = req.body || {};
    if (isAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Only superadmin can promote admin' });
      return;
    }
    if (language && language !== 'it' && language !== 'en') {
      res.status(400).json({ error: 'Invalid language' });
      return;
    }
    const emailConflict = findPortalUserEmailConflict(db, userId, email);
    if (emailConflict) {
      res.status(409).json({ error: `Email already used by ${emailConflict.username}` });
      return;
    }
    const now = Date.now();
    const lockedDisabled = target.isSuperAdmin ? 0 : (disabled ? 1 : 0);
    const meetingOperator = !!isMeetingOperator && !isAdmin;
    const linkedClientId = String(linkedExternalClientId || '').trim();
    const linkedEid = String(linkedExternalId || '').trim();
    if ((linkedClientId && !linkedEid) || (!linkedClientId && linkedEid)) {
      res.status(400).json({ error: 'Invalid linked imported user reference' });
      return;
    }
    if (linkedClientId && linkedEid) {
      const linkedRow = db
        .prepare('SELECT externalId FROM external_users WHERE clientId = ? AND externalId = ?')
        .get(linkedClientId, linkedEid);
      if (!linkedRow) {
        res.status(400).json({ error: 'Linked imported user not found' });
        return;
      }
    }
    db.prepare(
      'UPDATE users SET isAdmin = ?, canCreateMeetings = ?, canManageBusinessPartners = ?, isMeetingOperator = ?, disabled = ?, language = COALESCE(?, language), firstName = ?, lastName = ?, phone = ?, email = ?, linkedExternalClientId = ?, linkedExternalId = ?, updatedAt = ? WHERE id = ?'
    ).run(
      isAdmin ? 1 : 0,
      meetingOperator ? 1 : canCreateMeetings === undefined ? (Number(target.canCreateMeetings || 1) ? 1 : 0) : canCreateMeetings ? 1 : 0,
      canManageBusinessPartners === undefined ? (Number(target.canManageBusinessPartners || 0) ? 1 : 0) : canManageBusinessPartners ? 1 : 0,
      meetingOperator ? 1 : 0,
      lockedDisabled,
      language || null,
      String(firstName || ''),
      String(lastName || ''),
      String(phone || ''),
      String(email || ''),
      linkedClientId,
      linkedEid,
      now,
      userId
    );
    if (Array.isArray(permissions)) {
      db.prepare('DELETE FROM permissions WHERE userId = ?').run(userId);
      const insertPerm = db.prepare(
        'INSERT OR REPLACE INTO permissions (userId, scopeType, scopeId, access, chat) VALUES (?, ?, ?, ?, ?)'
      );
      for (const permission of permissions) {
        if (!permission?.scopeType || !permission?.scopeId || !permission?.access) continue;
        insertPerm.run(userId, permission.scopeType, permission.scopeId, meetingOperator ? 'ro' : permission.access, permission?.chat ? 1 : 0);
      }
    }
    const changes = [];
    if (typeof isAdmin === 'boolean' && Number(target.isAdmin) !== (isAdmin ? 1 : 0)) changes.push('isAdmin');
    if (typeof canCreateMeetings === 'boolean' && Number(target.canCreateMeetings || 1) !== (canCreateMeetings ? 1 : 0)) changes.push('canCreateMeetings');
    if (typeof canManageBusinessPartners === 'boolean' && Number(target.canManageBusinessPartners || 0) !== (canManageBusinessPartners ? 1 : 0)) changes.push('canManageBusinessPartners');
    if (typeof isMeetingOperator === 'boolean' && Number(target.isMeetingOperator || 0) !== (meetingOperator ? 1 : 0)) changes.push('isMeetingOperator');
    if (typeof disabled === 'boolean' && Number(target.disabled) !== (disabled ? 1 : 0)) changes.push('disabled');
    if (language && String(language) !== String(target.language)) changes.push('language');
    const profileChanged =
      (firstName !== undefined && String(firstName || '') !== String(target.firstName || '')) ||
      (lastName !== undefined && String(lastName || '') !== String(target.lastName || '')) ||
      (phone !== undefined && String(phone || '') !== String(target.phone || '')) ||
      (email !== undefined && String(email || '') !== String(target.email || '')) ||
      (linkedExternalClientId !== undefined && linkedClientId !== String(target.linkedExternalClientId || '')) ||
      (linkedExternalId !== undefined && linkedEid !== String(target.linkedExternalId || ''));
    if (profileChanged) changes.push('profile');
    if (Array.isArray(permissions)) changes.push('permissions');
    if (changes.length) {
      writeAuditLog(db, {
        level: 'important',
        event: 'user_updated',
        userId: req.userId,
        username: req.username,
        scopeType: 'user',
        scopeId: target.id,
        ...requestMeta(req),
        details: { targetUsername: target.username, changes }
      });
    }
    res.json({ ok: true });
  });

  app.post('/api/users/:id/password', requireAuth, rateByUser('users_password', 10 * 60 * 1000, 30), (req, res) => {
    const targetId = req.params.id;
    const { oldPassword, newPassword } = req.body || {};
    if (!isStrongPassword(String(newPassword || ''))) {
      res.status(400).json({ error: 'Weak password' });
      return;
    }
    const isSelf = targetId === req.userId;
    const requesterIsAdmin = isAdminLike(req);
    if (!requesterIsAdmin && !isSelf) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const row = db.prepare('SELECT id, username, passwordSalt, passwordHash, tokenVersion, isSuperAdmin FROM users WHERE id = ?').get(targetId);
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (!isSelf && row.isSuperAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Only superadmin can change superadmin password' });
      return;
    }
    if (!requesterIsAdmin) {
      if (!oldPassword || !verifyPassword(String(oldPassword), row.passwordSalt, row.passwordHash)) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    } else if (isSelf) {
      if (!oldPassword || !verifyPassword(String(oldPassword), row.passwordSalt, row.passwordHash)) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    }
    const { salt, hash } = hashPassword(String(newPassword));
    db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, tokenVersion = ?, updatedAt = ? WHERE id = ?').run(
      salt,
      hash,
      Number(row.tokenVersion) + 1,
      Date.now(),
      targetId
    );
    writeAuditLog(db, {
      level: 'important',
      event: 'user_password_changed',
      userId: req.userId,
      username: req.username,
      scopeType: 'user',
      scopeId: targetId,
      ...requestMeta(req),
      details: { self: isSelf, byAdmin: requesterIsAdmin }
    });
    res.json({ ok: true });
  });

  app.post('/api/users/:id/mfa-reset', requireAuth, rateByUser('users_mfa_reset', 10 * 60 * 1000, 30), (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const targetId = req.params.id;
    const target = db.prepare('SELECT id, username, isSuperAdmin, tokenVersion FROM users WHERE id = ?').get(targetId);
    if (!target) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (target.isSuperAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Only superadmin can reset superadmin MFA' });
      return;
    }
    db.prepare('UPDATE users SET mfaEnabled = 0, mfaSecretEnc = NULL, tokenVersion = ?, updatedAt = ? WHERE id = ?').run(
      Number(target.tokenVersion || 1) + 1,
      Date.now(),
      targetId
    );
    writeAuditLog(db, {
      level: 'important',
      event: 'user_mfa_reset',
      userId: req.userId,
      username: req.username,
      scopeType: 'user',
      scopeId: targetId,
      ...requestMeta(req),
      details: { targetUsername: target.username }
    });
    res.json({ ok: true });
  });

  app.post('/api/users/:id/unlock', requireAuth, rateByUser('users_unlock', 10 * 60 * 1000, 60), (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const targetId = req.params.id;
    const target = db.prepare('SELECT id, username, isSuperAdmin FROM users WHERE id = ?').get(targetId);
    if (!target) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (target.isSuperAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Only superadmin can unlock superadmin' });
      return;
    }
    clearUserLoginFailures(target.username);
    writeAuditLog(db, {
      level: 'important',
      event: 'user_unlocked',
      userId: req.userId,
      username: req.username,
      scopeType: 'user',
      scopeId: targetId,
      ...requestMeta(req),
      details: { targetUsername: target.username }
    });
    res.json({ ok: true });
  });

  app.delete('/api/users/:id', requireAuth, rateByUser('users_delete', 10 * 60 * 1000, 30), (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const targetId = req.params.id;
    if (targetId === req.userId) {
      res.status(400).json({ error: 'Cannot delete self' });
      return;
    }
    const target = db.prepare('SELECT username, isSuperAdmin FROM users WHERE id = ?').get(targetId);
    if (target?.isSuperAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Cannot delete superadmin' });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    db.prepare('DELETE FROM permissions WHERE userId = ?').run(targetId);
    writeAuditLog(db, {
      level: 'important',
      event: 'user_deleted',
      userId: req.userId,
      username: req.username,
      scopeType: 'user',
      scopeId: targetId,
      ...requestMeta(req),
      details: { targetUsername: target?.username || null }
    });
    res.json({ ok: true });
  });
};

module.exports = {
  registerUserRoutes
};
