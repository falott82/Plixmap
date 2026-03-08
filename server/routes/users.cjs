const crypto = require('crypto');
const nodemailer = require('nodemailer');

const { isAdminLike, isStrictSuperAdmin } = require('../access.cjs');
const {
  findPortalUserEmailConflict,
  findLinkedPortalUserConflict,
  getImportedUserByLink,
  normalizeUserEmailKey,
  normalizeLinkedImportedRef,
  mapAdminUsersResponse,
  replaceUserPermissions,
  searchImportedUsers,
  listDirectoryUsers
} = require('../services/users.cjs');
const { getPortalPublicUrl } = require('../email.cjs');

const sanitizeProvisionUsername = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/@/g, '.')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');

const buildProvisionUsernameBase = (row) => {
  const emailLocal = String(row?.email || '')
    .trim()
    .toLowerCase()
    .split('@')[0];
  const fromEmail = sanitizeProvisionUsername(emailLocal);
  if (fromEmail) return fromEmail;
  const first = sanitizeProvisionUsername(String(row?.firstName || '').trim());
  const last = sanitizeProvisionUsername(String(row?.lastName || '').trim());
  const full = [first, last].filter(Boolean).join('.');
  if (full) return full;
  const ext = sanitizeProvisionUsername(String(row?.externalId || '').trim());
  if (ext) return ext;
  return 'user';
};

const nextAvailableProvisionUsername = (db, preferred) => {
  const base = sanitizeProvisionUsername(preferred) || 'user';
  const exists = db.prepare('SELECT 1 FROM users WHERE lower(username) = ? LIMIT 1');
  if (!exists.get(base)) return base;
  for (let idx = 2; idx < 1000; idx += 1) {
    const candidate = `${base}.${idx}`;
    if (!exists.get(candidate)) return candidate;
  }
  return `${base}.${Date.now()}`;
};

const generateTemporaryPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%*-_';
  const all = `${upper}${lower}${numbers}${symbols}`;
  const pick = (source) => source[crypto.randomInt(0, source.length)];
  const chars = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

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
    hashPassword,
    dataSecret,
    APP_BRAND,
    getEmailConfig,
    getClientEmailConfig,
    logEmailAttempt,
    fallbackPortalPublicUrl
  } = deps;
  const insertProvisionedPortalUser = db.transaction((payload) => {
    const {
      req,
      id,
      normalizedUsername,
      salt,
      hash,
      language,
      canCreateMeetings,
      defaultPaletteFavoritesJson,
      firstName,
      lastName,
      phone,
      email,
      linkedClientId,
      linkedExternalId,
      now,
      sendEmail,
      access,
      chat
    } = payload;
    const existingLinked = findLinkedPortalUserConflict(db, linkedClientId, linkedExternalId);
    if (existingLinked) {
      const err = new Error('Imported user is already linked to a portal user');
      err.code = 'LINKED_EXISTS';
      err.existingUserId = String(existingLinked.id || '');
      err.existingUsername = String(existingLinked.username || '');
      throw err;
    }
    const usernameConflict = db.prepare('SELECT id FROM users WHERE lower(username) = ? LIMIT 1').get(normalizedUsername);
    if (usernameConflict) {
      const err = new Error('Username already exists');
      err.code = 'USERNAME_EXISTS';
      throw err;
    }
    const emailConflict = findPortalUserEmailConflict(db, '', email);
    if (emailConflict) {
      const err = new Error(`Email already used by ${emailConflict.username}`);
      err.code = 'EMAIL_EXISTS';
      throw err;
    }
    db.prepare(
      `INSERT INTO users (
        id, username, passwordSalt, passwordHash, tokenVersion,
        isAdmin, isSuperAdmin, disabled, language,
        canCreateMeetings, canManageBusinessPartners, isMeetingOperator,
        paletteFavoritesJson, mustChangePassword,
        firstName, lastName, phone, email,
        linkedExternalClientId, linkedExternalId,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, 1, 0, 0, 0, ?, ?, 0, 0, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      normalizedUsername,
      salt,
      hash,
      String(language),
      canCreateMeetings ? 1 : 0,
      defaultPaletteFavoritesJson,
      firstName,
      lastName,
      phone,
      email,
      linkedClientId,
      linkedExternalId,
      now,
      now
    );
    db.prepare(
      'INSERT INTO permissions (userId, scopeType, scopeId, access, chat) VALUES (?, ?, ?, ?, ?)'
    ).run(id, 'client', linkedClientId, access, chat ? 1 : 0);
    writeAuditLog(db, {
      level: 'important',
      event: 'user_provisioned_from_imported',
      userId: req.userId,
      username: req.username,
      scopeType: 'user',
      scopeId: id,
      ...requestMeta(req),
      details: {
        linkedExternalClientId: linkedClientId,
        linkedExternalId,
        provisionedUsername: normalizedUsername,
        sendEmail: !!sendEmail,
        access,
        chat: !!chat,
        canCreateMeetings: !!canCreateMeetings
      }
    });
  });
  const sendProvisioningMail = async ({
    clientId,
    clientName,
    recipient,
    username,
    temporaryPassword,
    fullName,
    language
  }) => {
    const target = normalizeUserEmailKey(recipient);
    if (!target) return { ok: false, skipped: true, reason: 'missing_recipient' };
    const clientConfig = clientId ? getClientEmailConfig(db, dataSecret, clientId) : null;
    const globalConfig = getEmailConfig(db, dataSecret);
    const configCandidates = [
      { config: clientConfig, scope: 'client' },
      { config: globalConfig, scope: 'global' }
    ];
    const selected = configCandidates.find(
      (entry) =>
        entry.config &&
        entry.config.host &&
        (!entry.config.username || entry.config.password) &&
        (entry.config.fromEmail || entry.config.username)
    );
    const config = selected?.config || null;
    const source = (selected?.scope || (clientConfig?.host ? 'client' : 'global'));
    if (!config || !config.host) {
      if (clientConfig?.host && clientConfig.username && !clientConfig.password && !selected) {
        return { ok: false, skipped: true, reason: 'smtp_client_missing_password' };
      }
      return { ok: false, skipped: true, reason: source === 'client' ? 'smtp_client_not_configured' : 'smtp_not_configured' };
    }
    if (config.username && !config.password) {
      return { ok: false, skipped: true, reason: source === 'client' ? 'smtp_client_missing_password' : 'smtp_missing_password' };
    }
    const fromEmail = config.fromEmail || config.username;
    if (!fromEmail) return { ok: false, skipped: true, reason: 'smtp_missing_from' };
    const fromLabel = config.fromName ? `"${String(config.fromName).replace(/"/g, '')}" <${fromEmail}>` : fromEmail;
    const securityMode = config.securityMode || (config.secure ? 'ssl' : 'starttls');
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: securityMode === 'ssl',
      requireTLS: securityMode === 'starttls',
      ...(config.username ? { auth: { user: config.username, pass: config.password } } : {})
    });
    const portalUrl = getPortalPublicUrl(db, fallbackPortalPublicUrl || '');
    if (!portalUrl) {
      return { ok: false, skipped: true, reason: 'portal_url_not_configured' };
    }
    const lang = language === 'en' ? 'en' : 'it';
    const safeClientName = String(clientName || clientId || APP_BRAND);
    const safeFullName = String(fullName || '').trim() || username;
    const subject =
      lang === 'en'
        ? `[${APP_BRAND}] Your portal account for ${safeClientName}`
        : `[${APP_BRAND}] Il tuo account portale per ${safeClientName}`;
    const text =
      lang === 'en'
        ? [
            `Hello ${safeFullName},`,
            '',
            `a portal account has been created for you on ${APP_BRAND}.`,
            '',
            `Portal: ${portalUrl}`,
            `Username: ${username}`,
            `Temporary password: ${temporaryPassword}`,
            '',
            'At first login you will be required to change the password before accessing the portal.',
            '',
            'If you did not expect this message, please contact your administrator.'
          ].join('\n')
        : [
            `Ciao ${safeFullName},`,
            '',
            `e stato creato per te un account portale su ${APP_BRAND}.`,
            '',
            `Portale: ${portalUrl}`,
            `Username: ${username}`,
            `Password temporanea: ${temporaryPassword}`,
            '',
            'Al primo accesso ti verra richiesto il cambio password prima di poter usare il portale.',
            '',
            'Se non ti aspettavi questo messaggio, contatta il tuo amministratore.'
          ].join('\n');
    try {
      const info = await transport.sendMail({ from: fromLabel, to: target, subject, text });
      logEmailAttempt(db, {
        userId: req.userId,
        username: req.username,
        recipient: target,
        subject,
        success: true,
        details: {
          kind: 'portal_user_provision',
          clientId: clientId || null,
          messageId: info?.messageId || null,
          smtpScope: source
        }
      });
      return { ok: true, messageId: info?.messageId || null, smtpScope: source };
    } catch (error) {
      logEmailAttempt(db, {
        userId: req.userId,
        username: req.username,
        recipient: target,
        subject,
        success: false,
        error: error?.message || 'portal_user_provision_mail_failed',
        details: {
          kind: 'portal_user_provision',
          clientId: clientId || null,
          smtpScope: source
        }
      });
      return { ok: false, skipped: false, reason: error?.message || 'send_failed' };
    }
  };

  app.get('/api/users', requireAuth, (req, res) => {
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const users = db
      .prepare(
        'SELECT id, username, isAdmin, isSuperAdmin, canCreateMeetings, canManageBusinessPartners, isMeetingOperator, disabled, language, mustChangePassword, avatarUrl, firstName, lastName, phone, email, linkedExternalClientId, linkedExternalId, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
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
          mustChangePassword: !!user.mustChangePassword,
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
    const { clientId: linkedClientId, externalId: linkedEid } = normalizeLinkedImportedRef(linkedExternalClientId, linkedExternalId);
    if ((linkedClientId && !linkedEid) || (!linkedClientId && linkedEid)) {
      res.status(400).json({ error: 'Invalid linked imported user reference' });
      return;
    }
    if (linkedClientId && linkedEid) {
      const linkedRow = getImportedUserByLink(db, linkedClientId, linkedEid);
      if (!linkedRow) {
        res.status(400).json({ error: 'Linked imported user not found' });
        return;
      }
      const existingLinked = findLinkedPortalUserConflict(db, linkedClientId, linkedEid);
      if (existingLinked) {
        res.status(409).json({ error: `Imported user already linked to ${String(existingLinked.username || '')}` });
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
    } catch (error) {
      const message = String(error?.message || '');
      if (String(error?.code || '') === 'SQLITE_CONSTRAINT_UNIQUE' && message.includes('idx_users_linked_external_unique')) {
        res.status(409).json({ error: 'Imported user is already linked to a portal user' });
        return;
      }
      res.status(400).json({ error: 'Username already exists' });
      return;
    }
    const permissionCount = replaceUserPermissions(db, id, permissions, meetingOperator ? 'ro' : null);
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
        permissions: permissionCount,
        linkedExternalClientId: linkedClientId,
        linkedExternalId: linkedEid
      }
    });
    res.json({ ok: true, id });
  });

  app.post('/api/users/provision-from-imported', requireAuth, rateByUser('users_provision_imported', 10 * 60 * 1000, 40), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const {
      clientId,
      externalId,
      username,
      firstName,
      lastName,
      phone,
      email,
      language = 'it',
      access = 'ro',
      chat = true,
      canCreateMeetings = false,
      sendEmail = false
    } = req.body || {};
    const { clientId: linkedClientId, externalId: linkedExternalId } = normalizeLinkedImportedRef(clientId, externalId);
    if (!linkedClientId || !linkedExternalId) {
      res.status(400).json({ error: 'Missing linked imported user reference' });
      return;
    }
    if (language !== 'it' && language !== 'en') {
      res.status(400).json({ error: 'Invalid language' });
      return;
    }
    if (access !== 'ro' && access !== 'rw') {
      res.status(400).json({ error: 'Invalid access mode' });
      return;
    }
    const state = readState();
    const client = Array.isArray(state?.clients) ? state.clients.find((row) => String(row?.id || '') === linkedClientId) : null;
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    const imported = getImportedUserByLink(db, linkedClientId, linkedExternalId);
    if (!imported) {
      res.status(404).json({ error: 'Imported user not found' });
      return;
    }
    const nextEmail = String(email ?? imported.email ?? '').trim();
    const nextFirstName = String(firstName ?? imported.firstName ?? '').trim();
    const nextLastName = String(lastName ?? imported.lastName ?? '').trim();
    const nextPhone = String(phone ?? imported.mobile ?? '').trim();
    const normalizedRequestedUsername = sanitizeProvisionUsername(username);
    const normalizedUsername = normalizedRequestedUsername || nextAvailableProvisionUsername(db, buildProvisionUsernameBase({ ...imported, email: nextEmail }));
    const temporaryPassword = generateTemporaryPassword();
    const { salt, hash } = hashPassword(String(temporaryPassword));
    const now = Date.now();
    const id = crypto.randomUUID();
    const defaultPaletteFavoritesJson = JSON.stringify(['real_user', 'user', 'desktop', 'rack']);
    try {
      insertProvisionedPortalUser.immediate({
        req,
        id,
        normalizedUsername,
        salt,
        hash,
        language: String(language),
        canCreateMeetings: !!canCreateMeetings,
        defaultPaletteFavoritesJson,
        firstName: nextFirstName,
        lastName: nextLastName,
        phone: nextPhone,
        email: nextEmail,
        linkedClientId,
        linkedExternalId,
        now,
        sendEmail: !!sendEmail,
        access,
        chat: !!chat
      });
    } catch (error) {
      if (error?.code === 'LINKED_EXISTS') {
        res.status(409).json({
          error: 'Imported user is already linked to a portal user',
          existingUserId: String(error.existingUserId || ''),
          existingUsername: String(error.existingUsername || '')
        });
        return;
      }
      if (error?.code === 'USERNAME_EXISTS') {
        res.status(409).json({
          error: 'Username already exists',
          suggestedUsername: nextAvailableProvisionUsername(db, buildProvisionUsernameBase({ ...imported, email: nextEmail }))
        });
        return;
      }
      if (error?.code === 'EMAIL_EXISTS') {
        res.status(409).json({ error: String(error.message || 'Email already in use') });
        return;
      }
      throw error;
    }
    let mailResult = { ok: false, skipped: true, reason: 'not_requested' };
    if (sendEmail) {
      if (!nextEmail) {
        mailResult = { ok: false, skipped: true, reason: 'missing_recipient' };
      } else {
        mailResult = await sendProvisioningMail({
          clientId: linkedClientId,
          clientName: String(client?.shortName || client?.name || linkedClientId),
          recipient: nextEmail,
          username: normalizedUsername,
          temporaryPassword,
          fullName: `${nextFirstName} ${nextLastName}`.trim(),
          language
        });
      }
    }
    res.json({
      ok: true,
      id,
      username: normalizedUsername,
      temporaryPassword,
      user: {
        id,
        username: normalizedUsername,
        firstName: nextFirstName,
        lastName: nextLastName,
        email: nextEmail,
        phone: nextPhone,
        linkedExternalClientId: linkedClientId,
        linkedExternalId,
        mustChangePassword: true
      },
      emailDelivery: {
        attempted: !!sendEmail,
        sent: !!mailResult?.ok,
        reason: mailResult?.reason || null,
        messageId: mailResult?.messageId || null,
        smtpScope: mailResult?.smtpScope || null
      }
    });
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
    const { clientId: linkedClientId, externalId: linkedEid } = normalizeLinkedImportedRef(linkedExternalClientId, linkedExternalId);
    if ((linkedClientId && !linkedEid) || (!linkedClientId && linkedEid)) {
      res.status(400).json({ error: 'Invalid linked imported user reference' });
      return;
    }
    if (linkedClientId && linkedEid) {
      const linkedRow = getImportedUserByLink(db, linkedClientId, linkedEid);
      if (!linkedRow) {
        res.status(400).json({ error: 'Linked imported user not found' });
        return;
      }
      const existingLinked = findLinkedPortalUserConflict(db, linkedClientId, linkedEid, userId);
      if (existingLinked) {
        res.status(409).json({ error: `Imported user already linked to ${String(existingLinked.username || '')}` });
        return;
      }
    }
    try {
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
    } catch (error) {
      const message = String(error?.message || '');
      if (String(error?.code || '') === 'SQLITE_CONSTRAINT_UNIQUE' && message.includes('idx_users_linked_external_unique')) {
        res.status(409).json({ error: 'Imported user is already linked to a portal user' });
        return;
      }
      throw error;
    }
    if (Array.isArray(permissions)) replaceUserPermissions(db, userId, permissions, meetingOperator ? 'ro' : null);
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
