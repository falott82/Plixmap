const createAuthRuntime = (deps) => {
  const {
    db,
    authSecret,
    serverInstanceId,
    PRIMARY_SESSION_COOKIE,
    parseCookies,
    verifySession,
    clearSessionCookie,
    ensureCsrfCookie,
    isStrictSuperAdmin
  } = deps;

  const loginAttemptBucket = new Map(); // ip -> { count, resetAt }
  let lastLoginAttemptCleanup = 0;
  const cleanupLoginAttemptBucket = (now) => {
    if (now - lastLoginAttemptCleanup < 60_000) return;
    lastLoginAttemptCleanup = now;
    for (const [key, entry] of loginAttemptBucket.entries()) {
      if (now > entry.resetAt) loginAttemptBucket.delete(key);
    }
  };
  const allowLoginAttempt = (ip) => {
    const key = String(ip || '').trim() || 'unknown';
    const now = Date.now();
    cleanupLoginAttemptBucket(now);
    const row = loginAttemptBucket.get(key);
    if (!row || now > row.resetAt) {
      loginAttemptBucket.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
      return true;
    }
    row.count += 1;
    return row.count <= 20;
  };

  const loginUserBucket = new Map(); // username -> { count, resetAt, lockedUntil }
  let lastUserLockCleanup = 0;
  const LOGIN_USER_WINDOW_MS = 15 * 60 * 1000;
  const LOGIN_USER_MAX_ATTEMPTS = 8;
  const LOGIN_USER_LOCK_MS = 15 * 60 * 1000;
  const cleanupUserLocks = (now) => {
    if (now - lastUserLockCleanup < 60_000) return;
    lastUserLockCleanup = now;
    for (const [key, entry] of loginUserBucket.entries()) {
      if (now > entry.resetAt && now > entry.lockedUntil) loginUserBucket.delete(key);
    }
  };
  const normalizeLoginKey = (value) => String(value || '').trim().toLowerCase();
  const getUserLock = (username) => {
    const key = normalizeLoginKey(username);
    if (!key) return 0;
    const now = Date.now();
    cleanupUserLocks(now);
    const entry = loginUserBucket.get(key);
    if (!entry) return 0;
    return now < entry.lockedUntil ? entry.lockedUntil : 0;
  };
  const registerUserLoginFailure = (username) => {
    const key = normalizeLoginKey(username);
    if (!key) return { lockedNow: false };
    const now = Date.now();
    cleanupUserLocks(now);
    let entry = loginUserBucket.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + LOGIN_USER_WINDOW_MS, lockedUntil: 0 };
      loginUserBucket.set(key, entry);
    }
    entry.count += 1;
    if (entry.count >= LOGIN_USER_MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOGIN_USER_LOCK_MS;
      return { lockedNow: true, lockedUntil: entry.lockedUntil };
    }
    return { lockedNow: false };
  };
  const clearUserLoginFailures = (username) => {
    const key = normalizeLoginKey(username);
    if (key) loginUserBucket.delete(key);
  };

  const requireAuth = (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySession(authSecret, cookies[PRIMARY_SESSION_COOKIE]);
    if (!session?.userId || !session?.tokenVersion || !session?.sid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (session.sid !== serverInstanceId) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userRow = db
      .prepare('SELECT id, username, tokenVersion, isAdmin, isSuperAdmin, disabled, mustChangePassword FROM users WHERE id = ?')
      .get(session.userId);
    if (!userRow) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (Number(userRow.disabled) === 1) {
      clearSessionCookie(res);
      res.status(403).json({ error: 'User disabled' });
      return;
    }
    if (Number(userRow.tokenVersion) !== Number(session.tokenVersion)) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (Number(userRow.mustChangePassword) === 1) {
      const allowed = new Set(['/api/auth/me', '/api/auth/first-run', '/api/auth/logout']);
      if (!allowed.has(req.path)) {
        res.status(403).json({ error: 'Password change required' });
        return;
      }
    }
    const normalizedUsername = String(userRow.username || '').toLowerCase();
    req.userId = session.userId;
    req.username = normalizedUsername;
    req.isAdmin = !!userRow.isAdmin;
    req.isSuperAdmin = isStrictSuperAdmin({ ...userRow, username: normalizedUsername });
    ensureCsrfCookie(req, res);
    next();
  };

  const getWsAuthContext = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySession(authSecret, cookies[PRIMARY_SESSION_COOKIE]);
    if (!session?.userId || !session?.tokenVersion || !session?.sid) return null;
    if (session.sid !== serverInstanceId) return null;
    const row = db.prepare('SELECT id, username, isAdmin, isSuperAdmin, disabled, avatarUrl FROM users WHERE id = ?').get(session.userId);
    if (!row) return null;
    if (Number(row.disabled) === 1) return null;
    const normalizedUsername = String(row.username || '').toLowerCase();
    return {
      userId: row.id,
      username: normalizedUsername,
      isAdmin: !!row.isAdmin,
      isSuperAdmin: isStrictSuperAdmin({ ...row, username: normalizedUsername }),
      avatarUrl: String(row.avatarUrl || '')
    };
  };

  return {
    allowLoginAttempt,
    normalizeLoginKey,
    getUserLock,
    registerUserLoginFailure,
    clearUserLoginFailures,
    requireAuth,
    getWsAuthContext
  };
};

const registerAuthRoutes = (app, deps) => {
  const {
    db,
    readState,
    authSecret,
    serverInstanceId,
    requestMeta,
    writeAuthLog,
    writeAuditLog,
    getUserWithPermissions,
    computePlanAccess,
    ensureBootstrapAdmins,
    verifyPassword,
    hashPassword,
    isStrongPassword,
    signSession,
    setSessionCookie,
    clearSessionCookie,
    parseCookies,
    verifySession,
    PRIMARY_SESSION_COOKIE,
    encryptSecret,
    decryptSecret,
    generateTotpSecret,
    verifyTotp,
    buildMobilePublicUrl,
    shouldUseSecureCookie,
    ensureCsrfCookie,
    clearCsrfCookie,
    validateDataUrl,
    externalizeDataUrl,
    wsClientInfo,
    planLocks,
    emitLockState,
    emitGlobalPresence,
    runtime
  } = deps;
  const {
    requireAuth,
    allowLoginAttempt,
    normalizeLoginKey,
    getUserLock,
    registerUserLoginFailure,
    clearUserLoginFailures
  } = runtime;

  app.get('/api/auth/bootstrap-status', (_req, res) => {
    try {
      const row = db
        .prepare("SELECT mustChangePassword, passwordSalt, passwordHash FROM users WHERE lower(username) = 'superadmin'")
        .get();
      const count = db.prepare('SELECT COUNT(*) as n FROM users').get()?.n || 0;
      if (!row) {
        res.json({ showFirstRunCredentials: count === 0 });
        return;
      }
      const isBootstrapCred =
        Number(row.mustChangePassword) === 1 && verifyPassword('deskly', row.passwordSalt, row.passwordHash);
      res.json({ showFirstRunCredentials: isBootstrapCred });
    } catch {
      res.json({ showFirstRunCredentials: false });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password, otp } = req.body || {};
    const normalizedUsername = normalizeLoginKey(username);
    if (!normalizedUsername || !password) {
      res.status(400).json({ error: 'Missing username/password' });
      return;
    }
    const meta = requestMeta(req);
    if (!allowLoginAttempt(meta.ip)) {
      res.status(429).json({ error: 'Too many attempts' });
      return;
    }
    const lockedUntil = getUserLock(normalizedUsername);
    if (lockedUntil) {
      writeAuthLog(db, { event: 'login', success: false, username: normalizedUsername, ...meta, details: { reason: 'locked', lockedUntil } });
      res.status(429).json({ error: 'Account temporarily locked', lockedUntil });
      return;
    }
    let row = db
      .prepare(
        'SELECT id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, mfaEnabled, mfaSecretEnc, mustChangePassword FROM users WHERE lower(username) = ?'
      )
      .get(normalizedUsername);
    if (!row) {
      if (normalizedUsername === 'superadmin' && String(password) === 'deskly') {
        try {
          const count = db.prepare('SELECT COUNT(*) as n FROM users').get()?.n || 0;
          if (count === 0) {
            ensureBootstrapAdmins(db);
            row = db
              .prepare(
                'SELECT id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, mfaEnabled, mfaSecretEnc, mustChangePassword FROM users WHERE lower(username) = ?'
              )
              .get(normalizedUsername);
          }
        } catch {
          // ignore bootstrap recovery failure
        }
      }
      if (!row) {
        const lock = registerUserLoginFailure(normalizedUsername);
        if (lock.lockedNow) {
          writeAuditLog(db, { level: 'important', event: 'login_lockout', username: normalizedUsername, ...meta, details: { lockedUntil: lock.lockedUntil } });
        }
        writeAuthLog(db, { event: 'login', success: false, username: normalizedUsername, ...meta, details: { reason: 'user_not_found' } });
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    }
    if (Number(row.disabled) === 1) {
      writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'disabled' } });
      res.status(403).json({ error: 'User disabled' });
      return;
    }
    const passwordValue = String(password);
    let passwordOk = verifyPassword(passwordValue, row.passwordSalt, row.passwordHash);
    const isBootstrapAttempt =
      row.username === 'superadmin' && Number(row.mustChangePassword) === 1 && passwordValue === 'deskly';
    if (!passwordOk && isBootstrapAttempt) {
      try {
        const { salt, hash } = hashPassword('deskly');
        db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, updatedAt = ? WHERE id = ?').run(
          salt,
          hash,
          Date.now(),
          row.id
        );
        row.passwordSalt = salt;
        row.passwordHash = hash;
        passwordOk = true;
      } catch {
        passwordOk = false;
      }
    }
    if (!passwordOk) {
      const lock = registerUserLoginFailure(row.username);
      if (lock.lockedNow) {
        writeAuditLog(db, { level: 'important', event: 'login_lockout', userId: row.id, username: row.username, ...meta, details: { lockedUntil: lock.lockedUntil } });
        writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_password' } });
        res.status(429).json({ error: 'Account temporarily locked', lockedUntil: lock.lockedUntil });
        return;
      }
      writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_password' } });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (Number(row.mfaEnabled) === 1) {
      if (!otp) {
        writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'mfa_required' } });
        res.status(401).json({ error: 'MFA required', mfaRequired: true });
        return;
      }
      const secret = decryptSecret(authSecret, row.mfaSecretEnc);
      if (!secret || !verifyTotp(secret, otp)) {
        const lock = registerUserLoginFailure(row.username);
        if (lock.lockedNow) {
          writeAuditLog(db, { level: 'important', event: 'login_lockout', userId: row.id, username: row.username, ...meta, details: { lockedUntil: lock.lockedUntil } });
          writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_mfa' } });
          res.status(429).json({ error: 'Account temporarily locked', lockedUntil: lock.lockedUntil });
          return;
        }
        writeAuthLog(db, { event: 'login', success: false, userId: row.id, username: row.username, ...meta, details: { reason: 'bad_mfa' } });
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    }
    const token = signSession(authSecret, {
      userId: row.id,
      tokenVersion: row.tokenVersion,
      sid: serverInstanceId,
      iat: Date.now()
    });
    setSessionCookie(res, token, undefined, { secure: shouldUseSecureCookie(req) });
    ensureCsrfCookie(req, res);
    clearUserLoginFailures(row.username);
    writeAuthLog(db, { event: 'login', success: true, userId: row.id, username: row.username, ...meta });
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySession(authSecret, cookies[PRIMARY_SESSION_COOKIE]);
    clearSessionCookie(res);
    clearCsrfCookie(res);
    if (session?.userId) {
      const row = db.prepare('SELECT username FROM users WHERE id = ?').get(session.userId);
      writeAuthLog(db, { event: 'logout', success: true, userId: session.userId, username: row?.username, ...requestMeta(req) });
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const ctx = getUserWithPermissions(db, req.userId);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ user: ctx.user, permissions: ctx.permissions });
  });

  app.get('/api/mobile/app-url', requireAuth, (req, res) => {
    res.json({ url: buildMobilePublicUrl(req) });
  });

  app.get('/api/auth/mfa', requireAuth, (req, res) => {
    const row = db.prepare('SELECT mfaEnabled FROM users WHERE id = ?').get(req.userId);
    res.json({ enabled: !!row && Number(row.mfaEnabled) === 1 });
  });

  app.post('/api/auth/mfa/setup', requireAuth, (req, res) => {
    const { password } = req.body || {};
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }
    const row = db.prepare('SELECT username, passwordSalt, passwordHash, mfaEnabled FROM users WHERE id = ?').get(req.userId);
    if (!row) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!verifyPassword(String(password), row.passwordSalt, row.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (Number(row.mfaEnabled) === 1) {
      res.status(400).json({ error: 'MFA already enabled' });
      return;
    }
    const secret = generateTotpSecret(row.username);
    const enc = encryptSecret(authSecret, secret.base32);
    db.prepare('UPDATE users SET mfaSecretEnc = ?, mfaEnabled = 0, updatedAt = ? WHERE id = ?').run(enc, Date.now(), req.userId);
    writeAuditLog(db, { level: 'important', event: 'mfa_setup', userId: req.userId, username: row.username, ...requestMeta(req) });
    res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url });
  });

  app.post('/api/auth/mfa/enable', requireAuth, (req, res) => {
    const { otp } = req.body || {};
    if (!otp) {
      res.status(400).json({ error: 'Missing otp' });
      return;
    }
    const row = db.prepare('SELECT username, mfaSecretEnc, mfaEnabled FROM users WHERE id = ?').get(req.userId);
    if (!row) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (Number(row.mfaEnabled) === 1) {
      res.status(400).json({ error: 'MFA already enabled' });
      return;
    }
    const secret = decryptSecret(authSecret, row.mfaSecretEnc);
    if (!secret || !verifyTotp(secret, otp)) {
      res.status(400).json({ error: 'Invalid otp' });
      return;
    }
    db.prepare('UPDATE users SET mfaEnabled = 1, updatedAt = ? WHERE id = ?').run(Date.now(), req.userId);
    writeAuditLog(db, { level: 'important', event: 'mfa_enabled', userId: req.userId, username: row.username, ...requestMeta(req) });
    res.json({ ok: true });
  });

  app.post('/api/auth/mfa/disable', requireAuth, (req, res) => {
    const { password, otp } = req.body || {};
    if (!password || !otp) {
      res.status(400).json({ error: 'Missing password/otp' });
      return;
    }
    const row = db.prepare('SELECT username, passwordSalt, passwordHash, mfaSecretEnc, mfaEnabled, tokenVersion FROM users WHERE id = ?').get(req.userId);
    if (!row) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!verifyPassword(String(password), row.passwordSalt, row.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (Number(row.mfaEnabled) !== 1) {
      res.status(400).json({ error: 'MFA not enabled' });
      return;
    }
    const secret = decryptSecret(authSecret, row.mfaSecretEnc);
    if (!secret || !verifyTotp(secret, otp)) {
      res.status(400).json({ error: 'Invalid otp' });
      return;
    }
    db.prepare('UPDATE users SET mfaEnabled = 0, mfaSecretEnc = NULL, tokenVersion = ?, updatedAt = ? WHERE id = ?').run(
      Number(row.tokenVersion) + 1,
      Date.now(),
      req.userId
    );
    writeAuditLog(db, { level: 'important', event: 'mfa_disabled', userId: req.userId, username: row.username, ...requestMeta(req) });
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/auth/first-run', requireAuth, (req, res) => {
    const { newPassword, language } = req.body || {};
    const nextLanguage = language === 'en' ? 'en' : 'it';
    if (!isStrongPassword(String(newPassword || ''))) {
      res.status(400).json({ error: 'Weak password' });
      return;
    }
    const row = db
      .prepare('SELECT id, tokenVersion, mustChangePassword FROM users WHERE id = ?')
      .get(req.userId);
    if (!row) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (Number(row.mustChangePassword) !== 1) {
      res.status(400).json({ error: 'Not in first-run mode' });
      return;
    }
    const { salt, hash } = hashPassword(String(newPassword));
    const nextTokenVersion = Number(row.tokenVersion) + 1;
    db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, tokenVersion = ?, mustChangePassword = 0, language = ?, updatedAt = ? WHERE id = ?').run(
      salt,
      hash,
      nextTokenVersion,
      nextLanguage,
      Date.now(),
      req.userId
    );
    const token = signSession(authSecret, {
      userId: req.userId,
      tokenVersion: nextTokenVersion,
      sid: serverInstanceId,
      iat: Date.now()
    });
    setSessionCookie(res, token, undefined, { secure: shouldUseSecureCookie(req) });
    ensureCsrfCookie(req, res);
    writeAuditLog(db, {
      level: 'important',
      event: 'first_run_completed',
      userId: req.userId,
      username: req.username,
      ...requestMeta(req)
    });
    res.json({ ok: true });
  });

  app.put('/api/auth/me', requireAuth, (req, res) => {
    const { language, defaultPlanId, clientOrder, paletteFavorites, visibleLayerIdsByPlan, avatarUrl, chatLayout } = req.body || {};
    const nextLanguage = language === 'en' ? 'en' : language === 'it' ? 'it' : undefined;
    const nextDefaultPlanId =
      typeof defaultPlanId === 'string' ? defaultPlanId : defaultPlanId === null ? null : undefined;
    const nextClientOrder =
      Array.isArray(clientOrder) && clientOrder.every((x) => typeof x === 'string')
        ? [...new Set(clientOrder.map((x) => String(x)))]
        : clientOrder === null
          ? []
          : undefined;
    const nextPaletteFavorites =
      Array.isArray(paletteFavorites) && paletteFavorites.every((x) => typeof x === 'string')
        ? paletteFavorites.map((x) => String(x))
        : paletteFavorites === null
          ? []
          : undefined;
    const nextVisibleLayerIdsByPlan =
      visibleLayerIdsByPlan === null
        ? {}
        : visibleLayerIdsByPlan && typeof visibleLayerIdsByPlan === 'object' && !Array.isArray(visibleLayerIdsByPlan)
          ? visibleLayerIdsByPlan
          : undefined;
    const nextAvatarUrl = (() => {
      if (avatarUrl === null) return '';
      if (typeof avatarUrl !== 'string') return undefined;
      const value = String(avatarUrl || '').trim();
      if (!value) return '';
      if (value.startsWith('data:')) {
        const validation = validateDataUrl(value);
        if (!validation.ok) return { error: 'Invalid avatar upload', reason: validation.reason };
        const url = externalizeDataUrl(value);
        if (!url) return { error: 'Invalid avatar upload' };
        return url;
      }
      if (value.startsWith('/uploads/')) return value;
      return { error: 'Invalid avatarUrl' };
    })();
    const nextChatLayout = (() => {
      if (chatLayout === null) return {};
      if (!chatLayout || typeof chatLayout !== 'object' || Array.isArray(chatLayout)) return undefined;
      const keys = Object.keys(chatLayout);
      if (keys.length > 50) return undefined;
      try {
        const json = JSON.stringify(chatLayout);
        if (json.length > 6000) return undefined;
        return chatLayout;
      } catch {
        return undefined;
      }
    })();

    if (
      nextLanguage === undefined &&
      nextDefaultPlanId === undefined &&
      nextClientOrder === undefined &&
      nextPaletteFavorites === undefined &&
      nextVisibleLayerIdsByPlan === undefined &&
      nextAvatarUrl === undefined &&
      nextChatLayout === undefined
    ) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    if (nextAvatarUrl && typeof nextAvatarUrl === 'object') {
      res.status(400).json({ error: nextAvatarUrl.error || 'Invalid avatar upload' });
      return;
    }

    const state = readState();
    if (nextDefaultPlanId !== undefined && nextDefaultPlanId !== null) {
      let allowed = false;
      if (req.isAdmin) allowed = true;
      else {
        const ctx = getUserWithPermissions(db, req.userId);
        const access = computePlanAccess(state.clients, ctx?.permissions || []);
        allowed = access.has(nextDefaultPlanId);
      }
      if (!allowed) {
        res.status(400).json({ error: 'Invalid defaultPlanId' });
        return;
      }
    }

    let validatedPaletteFavorites = [];
    if (nextPaletteFavorites !== undefined) {
      const allowed = new Set((state.objectTypes || []).map((definition) => definition.id));
      const uniq = [];
      const seen = new Set();
      for (const id of nextPaletteFavorites) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (allowed.size && !allowed.has(id)) continue;
        uniq.push(id);
      }
      validatedPaletteFavorites = uniq;
    }

    let validatedVisibleLayerIdsByPlan = {};
    if (nextVisibleLayerIdsByPlan !== undefined) {
      let allowedPlanIds = null;
      if (!req.isAdmin) {
        const ctx = getUserWithPermissions(db, req.userId);
        allowedPlanIds = computePlanAccess(state.clients, ctx?.permissions || []);
      }
      const out = {};
      for (const [planId, ids] of Object.entries(nextVisibleLayerIdsByPlan || {})) {
        if (typeof planId !== 'string') continue;
        if (allowedPlanIds && !allowedPlanIds.has(planId)) continue;
        if (!Array.isArray(ids)) continue;
        const uniq = [];
        const seen = new Set();
        for (const id of ids) {
          const value = String(id);
          if (seen.has(value)) continue;
          seen.add(value);
          uniq.push(value);
        }
        out[planId] = uniq;
      }
      validatedVisibleLayerIdsByPlan = out;
    }

    const now = Date.now();
    const sets = [];
    const params = [];
    if (nextLanguage !== undefined) {
      sets.push('language = ?');
      params.push(nextLanguage);
    }
    if (nextDefaultPlanId !== undefined) {
      sets.push('defaultPlanId = ?');
      params.push(nextDefaultPlanId);
    }
    if (nextClientOrder !== undefined) {
      sets.push('clientOrderJson = ?');
      params.push(JSON.stringify(nextClientOrder));
    }
    if (nextPaletteFavorites !== undefined) {
      sets.push('paletteFavoritesJson = ?');
      params.push(JSON.stringify(validatedPaletteFavorites));
    }
    if (nextVisibleLayerIdsByPlan !== undefined) {
      sets.push('visibleLayerIdsByPlanJson = ?');
      params.push(JSON.stringify(validatedVisibleLayerIdsByPlan));
    }
    if (nextAvatarUrl !== undefined) {
      sets.push('avatarUrl = ?');
      params.push(String(nextAvatarUrl || ''));
    }
    if (nextChatLayout !== undefined) {
      sets.push('chatLayoutJson = ?');
      params.push(JSON.stringify(nextChatLayout || {}));
    }
    sets.push('updatedAt = ?');
    params.push(now, req.userId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    if (nextAvatarUrl !== undefined) {
      for (const [ws, info] of wsClientInfo.entries()) {
        if (info?.userId !== req.userId) continue;
        info.avatarUrl = String(nextAvatarUrl || '');
      }
      for (const [planId, lock] of planLocks.entries()) {
        if (lock?.userId !== req.userId) continue;
        lock.avatarUrl = String(nextAvatarUrl || '');
        planLocks.set(planId, lock);
        emitLockState(planId);
      }
      emitGlobalPresence();
    }

    res.json({ ok: true });
  });
};

module.exports = { createAuthRuntime, registerAuthRoutes };
