const crypto = require('crypto');

const createRealtimeRuntime = (deps) => {
  const { db, readState, writeAuditLog, getChatClientIdsForUser, getPlanAccessForUser } = deps;

  const wsPlanMembers = new Map();
  const wsClientInfo = new Map();
  const unlockRequests = new Map();
  const planLocks = new Map();
  const planLockGrants = new Map();
  const forceUnlocks = new Map();
  const LOCK_CLEANUP_MS = 5_000;
  const FORCE_UNLOCK_TAKEOVER_MINUTES = 60;

  let wss = null;
  let heartbeatTimer = null;
  let lockCleanupTimer = null;

  const purgeExpiredLocks = () => [];

  const purgeExpiredGrants = () => {
    const now = Date.now();
    const expired = [];
    for (const [planId, grant] of planLockGrants.entries()) {
      if (!grant?.expiresAt || grant.expiresAt > now) continue;
      planLockGrants.delete(planId);
      expired.push({ planId, grant });
    }
    return expired;
  };

  const purgeExpiredForceUnlocks = () => {
    const now = Date.now();
    const expired = [];
    for (const [requestId, entry] of forceUnlocks.entries()) {
      const exp = Number(entry?.decisionEndsAt ?? entry?.deadlineAt ?? 0) || 0;
      if (!exp || exp > now) continue;
      forceUnlocks.delete(requestId);
      expired.push({ requestId, entry });
    }
    return expired;
  };

  const getValidLock = (planId) => {
    const lock = planLocks.get(planId);
    return lock || null;
  };

  const getValidGrant = (planId) => {
    const grant = planLockGrants.get(planId);
    if (!grant) return null;
    if (grant.expiresAt && grant.expiresAt <= Date.now()) {
      planLockGrants.delete(planId);
      return null;
    }
    return grant;
  };

  const jsonSend = (ws, obj) => {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      // ignore socket send errors
    }
  };

  const broadcastToAll = (obj) => {
    for (const ws of wss?.clients || []) jsonSend(ws, obj);
  };

  const sendToUser = (userId, obj) => {
    let sent = 0;
    for (const [ws, info] of wsClientInfo.entries()) {
      if (info?.userId !== userId) continue;
      jsonSend(ws, obj);
      sent += 1;
    }
    return sent;
  };

  const broadcastToChatClient = (clientId, obj) => {
    if (!clientId) return;
    for (const [ws, info] of wsClientInfo.entries()) {
      if (!info?.userId) continue;
      const isAdmin = !!info.isAdmin || !!info.isSuperAdmin;
      if (!isAdmin) {
        const allowed = getChatClientIdsForUser(info.userId, false);
        if (!allowed.has(clientId)) continue;
      }
      jsonSend(ws, obj);
    }
  };

  const broadcastToPlan = (planId, obj) => {
    const members = wsPlanMembers.get(planId);
    if (!members) return;
    for (const ws of members) jsonSend(ws, obj);
  };

  const resolveUserIdentity = (userId, fallbackUsername = 'user') => {
    const fallback = { userId, username: fallbackUsername || 'user', avatarUrl: '' };
    if (!userId) return fallback;
    for (const info of wsClientInfo.values()) {
      if (!info || info.userId !== userId) continue;
      return { userId, username: info.username || fallback.username, avatarUrl: info.avatarUrl || '' };
    }
    try {
      const row = db.prepare('SELECT username, avatarUrl FROM users WHERE id = ?').get(userId);
      return { userId, username: String(row?.username || fallback.username), avatarUrl: String(row?.avatarUrl || '') };
    } catch {
      return fallback;
    }
  };

  const userIsJoinedToPlan = (planId, userId) => {
    const members = wsPlanMembers.get(planId);
    if (!members) return false;
    for (const ws of members) {
      const info = wsClientInfo.get(ws);
      if (info?.userId === userId) return true;
    }
    return false;
  };

  const findForceUnlockByPlanAndTarget = (planId, targetUserId) => {
    if (!planId || !targetUserId) return null;
    for (const [requestId, entry] of forceUnlocks.entries()) {
      if (!entry) continue;
      if (entry.planId === planId && entry.targetUserId === targetUserId) return { requestId, entry };
    }
    return null;
  };

  const buildPlanPathMap = (clients) => {
    const map = new Map();
    const formatRev = (rev) => {
      if (!rev) return '';
      if (typeof rev.revMajor === 'number' && typeof rev.revMinor === 'number') return `Rev ${rev.revMajor}.${rev.revMinor}`;
      if (typeof rev.version === 'number') return `Rev 1.${Math.max(0, Number(rev.version) - 1)}`;
      return '';
    };
    for (const client of clients || []) {
      const clientName = client?.shortName || client?.name || '';
      for (const site of client?.sites || []) {
        const siteName = site?.name || '';
        for (const plan of site?.floorPlans || []) {
          if (!plan?.id) continue;
          const revisions = Array.isArray(plan?.revisions) ? plan.revisions : [];
          let latest = null;
          for (const revision of revisions) {
            if (!revision) continue;
            const ts = Number(revision.createdAt || 0) || 0;
            if (!latest || ts > (Number(latest.createdAt || 0) || 0)) latest = revision;
          }
          const lastSavedAt = latest ? Number(latest.createdAt || 0) || null : null;
          const lastSavedRev = latest ? formatRev(latest) : '';
          map.set(plan.id, { clientName, siteName, planName: plan?.name || '', lastSavedAt, lastSavedRev });
        }
      }
    }
    return map;
  };

  const computePresence = (planId) => {
    const members = wsPlanMembers.get(planId);
    const users = new Map();
    const state = readState();
    const planPathMap = buildPlanPathMap(state.clients || []);
    const lockByUser = new Map();
    for (const [lockPlanId, lock] of planLocks.entries()) {
      if (!lock?.userId) continue;
      const path = planPathMap.get(lockPlanId);
      const entry = { planId: lockPlanId, clientName: path?.clientName || '', siteName: path?.siteName || '', planName: path?.planName || '' };
      const existing = lockByUser.get(lock.userId);
      if (!existing || (lock.ts || 0) > (existing.ts || 0)) {
        lockByUser.set(lock.userId, { ...entry, ts: lock.ts || 0 });
      }
    }
    if (members) {
      for (const ws of members) {
        const info = wsClientInfo.get(ws);
        if (!info) continue;
        const joinedAt = info.plans?.get?.(planId) || null;
        const existing = users.get(info.userId);
        const lock = lockByUser.get(info.userId);
        if (!existing) {
          users.set(info.userId, {
            userId: info.userId,
            username: info.username,
            avatarUrl: info.avatarUrl || '',
            connectedAt: joinedAt,
            ip: info.ip || '',
            lock: lock ? { planId: lock.planId, clientName: lock.clientName, siteName: lock.siteName, planName: lock.planName } : null
          });
        } else {
          if (joinedAt && (!existing.connectedAt || joinedAt < existing.connectedAt)) existing.connectedAt = joinedAt;
          if (lock && !existing.lock) {
            existing.lock = { planId: lock.planId, clientName: lock.clientName, siteName: lock.siteName, planName: lock.planName };
          }
        }
      }
    }
    return Array.from(users.values());
  };

  const computeGlobalPresence = () => {
    const state = readState();
    const planPathMap = buildPlanPathMap(state.clients || []);
    const locksByUser = new Map();
    for (const [lockPlanId, lock] of planLocks.entries()) {
      if (!lock?.userId) continue;
      const path = planPathMap.get(lockPlanId);
      const entry = {
        planId: lockPlanId,
        clientName: path?.clientName || '',
        siteName: path?.siteName || '',
        planName: path?.planName || ''
      };
      const existing = locksByUser.get(lock.userId);
      if (!existing) locksByUser.set(lock.userId, [entry]);
      else existing.push(entry);
    }
    const usersById = new Map();
    for (const info of wsClientInfo.values()) {
      const entry = usersById.get(info.userId);
      const lockList = locksByUser.get(info.userId) || [];
      if (!entry) {
        usersById.set(info.userId, {
          userId: info.userId,
          username: info.username,
          avatarUrl: info.avatarUrl || '',
          connectedAt: info.connectedAt || null,
          ip: info.ip || '',
          locks: lockList
        });
      } else {
        if (info.connectedAt && (!entry.connectedAt || info.connectedAt < entry.connectedAt)) entry.connectedAt = info.connectedAt;
        if (!entry.ip && info.ip) entry.ip = info.ip;
        if (lockList.length && (!entry.locks || !entry.locks.length)) entry.locks = lockList;
      }
    }
    return Array.from(usersById.values());
  };

  const getLockedPlansSnapshot = () => {
    const out = {};
    const state = readState();
    const planPathMap = buildPlanPathMap(state.clients || []);
    for (const [planId, lock] of planLocks.entries()) {
      if (!lock?.userId) continue;
      const path = planPathMap.get(planId);
      out[planId] = {
        kind: 'lock',
        userId: lock.userId,
        username: lock.username,
        avatarUrl: lock.avatarUrl || '',
        lastActionAt: lock.lastActionAt || null,
        lastSavedAt: path?.lastSavedAt ?? null,
        lastSavedRev: path?.lastSavedRev ?? ''
      };
    }
    for (const [planId, grant] of planLockGrants.entries()) {
      if (!grant?.userId) continue;
      if (grant.expiresAt && grant.expiresAt <= Date.now()) continue;
      const lock = planLocks.get(planId);
      if (lock?.userId) continue;
      const path = planPathMap.get(planId);
      out[planId] = {
        kind: 'grant',
        userId: grant.userId,
        username: grant.username,
        avatarUrl: grant.avatarUrl || '',
        grantedAt: grant.grantedAt || null,
        expiresAt: grant.expiresAt || null,
        minutes: grant.minutes || null,
        grantedBy: { userId: grant.grantedById || '', username: grant.grantedByName || '' },
        lastActionAt: grant.lastActionAt || null,
        lastSavedAt: path?.lastSavedAt ?? null,
        lastSavedRev: path?.lastSavedRev ?? ''
      };
    }
    return out;
  };

  const emitGlobalPresence = () => {
    broadcastToAll({
      type: 'global_presence',
      users: computeGlobalPresence(),
      lockedPlans: getLockedPlansSnapshot()
    });
  };

  const emitPresence = (planId) => {
    broadcastToPlan(planId, { type: 'presence', planId, users: computePresence(planId) });
  };

  const emitLockState = (planId) => {
    const lock = getValidLock(planId) || null;
    const grant = getValidGrant(planId) || null;
    const state = readState();
    const planPathMap = buildPlanPathMap(state.clients || []);
    const path = planPathMap.get(planId);
    broadcastToPlan(planId, {
      type: 'lock_state',
      planId,
      lockedBy: lock ? { userId: lock.userId, username: lock.username, avatarUrl: lock.avatarUrl || '' } : null,
      grant: grant
        ? {
            userId: grant.userId,
            username: grant.username,
            avatarUrl: grant.avatarUrl || '',
            grantedAt: grant.grantedAt || null,
            expiresAt: grant.expiresAt || null,
            minutes: grant.minutes || null,
            grantedBy: { userId: grant.grantedById || '', username: grant.grantedByName || '' }
          }
        : null,
      meta: {
        lastActionAt: lock?.lastActionAt || grant?.lastActionAt || null,
        lastSavedAt: path?.lastSavedAt ?? null,
        lastSavedRev: path?.lastSavedRev ?? ''
      }
    });
    emitPresence(planId);
    emitGlobalPresence();
  };

  const finalizeForceUnlockTakeover = (planId, requestedById, requestedByName, lastActionAt, requestId, reason) => {
    if (!planId || !requestedById) return;
    const identity = resolveUserIdentity(requestedById, requestedByName || 'user');
    const now = Date.now();
    if (userIsJoinedToPlan(planId, requestedById)) {
      planLockGrants.delete(planId);
      planLocks.set(planId, {
        userId: requestedById,
        username: identity.username,
        avatarUrl: identity.avatarUrl || '',
        acquiredAt: now,
        ts: now,
        lastActionAt: null,
        dirty: false
      });
      writeAuditLog(db, {
        level: 'important',
        event: 'plan_lock_acquired',
        userId: requestedById,
        username: identity.username,
        scopeType: 'plan',
        scopeId: planId,
        details: { reason: reason || 'force_unlock', requestId }
      });
    } else {
      const minutes = FORCE_UNLOCK_TAKEOVER_MINUTES;
      const expiresAt = now + Math.round(minutes * 60_000);
      const current = getValidLock(planId);
      if (!current) {
        planLockGrants.set(planId, {
          userId: requestedById,
          username: identity.username,
          avatarUrl: identity.avatarUrl || '',
          grantedAt: now,
          expiresAt,
          minutes,
          grantedById: requestedById,
          grantedByName: identity.username,
          lastActionAt: lastActionAt || null
        });
        writeAuditLog(db, {
          level: 'important',
          event: 'plan_lock_granted',
          userId: requestedById,
          username: identity.username,
          scopeType: 'plan',
          scopeId: planId,
          details: { reason: reason || 'force_unlock', requestId, minutes }
        });
      }
    }
    emitLockState(planId);
  };

  const completeForceUnlockAsAutoDiscard = (planId, targetUserId, lastActionAt, reason) => {
    const hit = findForceUnlockByPlanAndTarget(planId, targetUserId);
    if (!hit) return false;
    const { requestId, entry } = hit;
    forceUnlocks.delete(requestId);
    sendToUser(entry.requestedById, {
      type: 'force_unlock_done',
      requestId,
      planId: entry.planId,
      action: 'discard',
      ok: true,
      auto: true,
      reason
    });
    writeAuditLog(db, {
      level: 'important',
      event: 'plan_force_unlock_auto_discard',
      userId: entry.requestedById,
      username: entry.requestedByName,
      scopeType: 'plan',
      scopeId: entry.planId,
      details: { targetUserId: entry.targetUserId, reason: reason || 'target_left', requestId }
    });
    finalizeForceUnlockTakeover(entry.planId, entry.requestedById, entry.requestedByName, lastActionAt, requestId, reason || 'target_left');
    return true;
  };

  const releaseLocksForWs = (ws) => {
    const info = wsClientInfo.get(ws);
    if (!info) return;
    const userId = info.userId;
    for (const planId of info.plans.keys()) {
      const members = wsPlanMembers.get(planId);
      if (members) {
        members.delete(ws);
        if (!members.size) wsPlanMembers.delete(planId);
      }
      const lock = planLocks.get(planId);
      if (lock && lock.userId === info.userId) {
        const lastActionAt = lock.lastActionAt || lock.ts || null;
        const remaining = wsPlanMembers.get(planId);
        let stillThere = false;
        if (remaining) {
          for (const otherWs of remaining) {
            const otherInfo = wsClientInfo.get(otherWs);
            if (otherInfo?.userId === info.userId) {
              stillThere = true;
              break;
            }
          }
        }
        if (!stillThere) {
          planLocks.delete(planId);
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_lock_released',
            userId: info.userId,
            username: info.username,
            scopeType: 'plan',
            scopeId: planId,
            details: { reason: 'ws_close' }
          });
          const completed = completeForceUnlockAsAutoDiscard(planId, info.userId, lastActionAt, 'ws_close');
          if (!completed) emitLockState(planId);
        }
      }
      emitPresence(planId);
    }
    wsClientInfo.delete(ws);
    let stillConnected = false;
    for (const other of wsClientInfo.values()) {
      if (other?.userId === userId) {
        stillConnected = true;
        break;
      }
    }
    if (!stillConnected) {
      try {
        db.prepare('UPDATE users SET lastOnlineAt = ? WHERE id = ?').run(Date.now(), userId);
      } catch {}
    }
  };

  const attachWebSocketServer = ({ wss: nextWss, getWsAuthContext, getWsClientIp, pendingMeetingCount, getChatServices }) => {
    wss = nextWss;
    wss.on('connection', (ws, req) => {
      const auth = getWsAuthContext(req);
      if (!auth) {
        try {
          ws.close(1008, 'unauthorized');
        } catch {}
        return;
      }
      try {
        db.prepare('UPDATE users SET lastOnlineAt = ? WHERE id = ?').run(Date.now(), auth.userId);
      } catch {}
      wsClientInfo.set(ws, {
        userId: auth.userId,
        username: auth.username,
        avatarUrl: auth.avatarUrl || '',
        ip: getWsClientIp(req),
        connectedAt: Date.now(),
        isAdmin: !!auth.isAdmin,
        isSuperAdmin: !!auth.isSuperAdmin,
        plans: new Map()
      });
      jsonSend(ws, { type: 'hello', userId: auth.userId, username: auth.username, avatarUrl: auth.avatarUrl || '' });
      if (auth.isAdmin || auth.isSuperAdmin) {
        jsonSend(ws, { type: 'meeting_pending_summary', pendingCount: pendingMeetingCount() });
      }
      const chatServices = getChatServices();
      chatServices.deliverPendingDmMessagesToUser(auth.userId);
      emitGlobalPresence();

      ws.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(String(raw || ''));
        } catch {
          return;
        }
        const info = wsClientInfo.get(ws);
        if (!info) return;

        if (msg?.type === 'join') {
          const planId = String(msg.planId || '').trim();
          if (!planId) return;
          const access = getPlanAccessForUser(info.userId, planId);
          if (!access) {
            jsonSend(ws, { type: 'access_denied', planId });
            return;
          }
          if (!wsPlanMembers.has(planId)) wsPlanMembers.set(planId, new Set());
          wsPlanMembers.get(planId).add(ws);
          info.plans.set(planId, Date.now());

          const state = readState();
          const planPathMap = buildPlanPathMap(state.clients || []);
          const path = planPathMap.get(planId);
          const lock = getValidLock(planId) || null;
          const grant = lock ? null : getValidGrant(planId) || null;
          jsonSend(ws, {
            type: 'lock_state',
            planId,
            lockedBy: lock ? { userId: lock.userId, username: lock.username, avatarUrl: lock.avatarUrl || '' } : null,
            grant: grant
              ? {
                  userId: grant.userId,
                  username: grant.username,
                  avatarUrl: grant.avatarUrl || '',
                  grantedAt: grant.grantedAt || null,
                  expiresAt: grant.expiresAt || null,
                  minutes: grant.minutes || null,
                  grantedBy: { userId: grant.grantedById || '', username: grant.grantedByName || '' }
                }
              : null,
            meta: {
              lastActionAt: lock?.lastActionAt || grant?.lastActionAt || null,
              lastSavedAt: path?.lastSavedAt ?? null,
              lastSavedRev: path?.lastSavedRev ?? ''
            }
          });
          jsonSend(ws, { type: 'presence', planId, users: computePresence(planId) });

          if (!!msg.wantLock) {
            if (access !== 'rw') {
              jsonSend(ws, { type: 'lock_denied', planId, lockedBy: null, grant: null });
              emitPresence(planId);
              return;
            }
            const existing = getValidLock(planId);
            const activeGrant = existing ? null : getValidGrant(planId);
            if (activeGrant && activeGrant.userId && activeGrant.userId !== info.userId) {
              jsonSend(ws, {
                type: 'lock_denied',
                planId,
                lockedBy: null,
                grant: {
                  userId: activeGrant.userId,
                  username: activeGrant.username,
                  avatarUrl: activeGrant.avatarUrl || '',
                  grantedAt: activeGrant.grantedAt || null,
                  expiresAt: activeGrant.expiresAt || null,
                  minutes: activeGrant.minutes || null,
                  grantedBy: { userId: activeGrant.grantedById || '', username: activeGrant.grantedByName || '' }
                }
              });
              emitPresence(planId);
              return;
            }
            if (!existing || existing.userId === info.userId) {
              const now = Date.now();
              if (activeGrant && activeGrant.userId === info.userId) planLockGrants.delete(planId);
              planLocks.set(planId, {
                userId: info.userId,
                username: info.username,
                avatarUrl: info.avatarUrl || '',
                acquiredAt: now,
                ts: now,
                lastActionAt: null,
                dirty: false
              });
              writeAuditLog(db, { level: 'important', event: 'plan_lock_acquired', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId });
              emitLockState(planId);
            } else {
              jsonSend(ws, {
                type: 'lock_denied',
                planId,
                lockedBy: { userId: existing.userId, username: existing.username, avatarUrl: existing.avatarUrl || '' },
                grant: null
              });
              writeAuditLog(db, {
                level: 'important',
                event: 'plan_lock_denied',
                userId: info.userId,
                username: info.username,
                scopeType: 'plan',
                scopeId: planId,
                details: { lockedBy: { userId: existing.userId, username: existing.username } }
              });
            }
          }
          emitPresence(planId);
          emitGlobalPresence();
          return;
        }

        if (msg?.type === 'request_lock') {
          const planId = String(msg.planId || '').trim();
          if (!planId) return;
          const access = getPlanAccessForUser(info.userId, planId);
          if (access !== 'rw') {
            jsonSend(ws, { type: 'lock_denied', planId, lockedBy: null, grant: null });
            return;
          }
          const existing = getValidLock(planId);
          const activeGrant = existing ? null : getValidGrant(planId);
          if (activeGrant && activeGrant.userId && activeGrant.userId !== info.userId) {
            jsonSend(ws, {
              type: 'lock_denied',
              planId,
              lockedBy: null,
              grant: {
                userId: activeGrant.userId,
                username: activeGrant.username,
                avatarUrl: activeGrant.avatarUrl || '',
                grantedAt: activeGrant.grantedAt || null,
                expiresAt: activeGrant.expiresAt || null,
                minutes: activeGrant.minutes || null,
                grantedBy: { userId: activeGrant.grantedById || '', username: activeGrant.grantedByName || '' }
              }
            });
            return;
          }
          if (!existing || existing.userId === info.userId) {
            const now = Date.now();
            if (activeGrant && activeGrant.userId === info.userId) planLockGrants.delete(planId);
            planLocks.set(planId, {
              userId: info.userId,
              username: info.username,
              avatarUrl: info.avatarUrl || '',
              acquiredAt: now,
              ts: now,
              lastActionAt: null,
              dirty: false
            });
            writeAuditLog(db, { level: 'important', event: 'plan_lock_acquired', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId });
            emitLockState(planId);
          } else {
            jsonSend(ws, {
              type: 'lock_denied',
              planId,
              lockedBy: { userId: existing.userId, username: existing.username, avatarUrl: existing.avatarUrl || '' },
              grant: null
            });
          }
          return;
        }

        if (msg?.type === 'renew_lock') {
          const planId = String(msg.planId || '').trim();
          if (!planId) return;
          const lock = getValidLock(planId);
          if (!lock || lock.userId !== info.userId) {
            jsonSend(ws, {
              type: 'lock_denied',
              planId,
              lockedBy: lock ? { userId: lock.userId, username: lock.username, avatarUrl: lock.avatarUrl || '' } : null,
              grant: null
            });
            return;
          }
          const now = Date.now();
          lock.ts = now;
          planLocks.set(planId, lock);
          jsonSend(ws, { type: 'lock_renewed', planId });
          return;
        }

        if (msg?.type === 'plan_action') {
          const planId = String(msg.planId || '').trim();
          if (!planId) return;
          const lock = getValidLock(planId);
          if (!lock || lock.userId !== info.userId) return;
          const now = Date.now();
          lock.ts = now;
          lock.lastActionAt = now;
          planLocks.set(planId, lock);
          emitLockState(planId);
          return;
        }

        if (msg?.type === 'plan_dirty') {
          const planId = String(msg.planId || '').trim();
          if (!planId) return;
          const lock = getValidLock(planId);
          if (!lock || lock.userId !== info.userId) return;
          lock.dirty = !!msg.dirty;
          planLocks.set(planId, lock);
          emitLockState(planId);
          return;
        }

        if (msg?.type === 'force_unlock_start') {
          const planId = String(msg.planId || '').trim();
          const targetUserId = String(msg.targetUserId || '').trim();
          const rawMinutes = Number(msg.graceMinutes ?? msg.minutes ?? '');
          const graceMinutes = Number.isFinite(rawMinutes) ? Math.max(0, Math.min(60, rawMinutes)) : 0;
          if (!planId || !targetUserId) return;
          if (!info?.isSuperAdmin) {
            jsonSend(ws, { type: 'force_unlock_denied', planId, targetUserId, reason: 'forbidden' });
            return;
          }
          const lock = getValidLock(planId);
          if (!lock || lock.userId !== targetUserId) {
            jsonSend(ws, { type: 'force_unlock_denied', planId, targetUserId, reason: 'no_lock' });
            return;
          }
          const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
          const now = Date.now();
          const graceEndsAt = now + Math.round(graceMinutes * 60_000);
          const decisionEndsAt = graceEndsAt + 5 * 60_000;
          forceUnlocks.set(requestId, {
            planId,
            targetUserId,
            requestedById: info.userId,
            requestedByName: info.username,
            createdAt: now,
            graceEndsAt,
            decisionEndsAt,
            graceMinutes
          });
          const state = readState();
          const planPathMap = buildPlanPathMap(state.clients || []);
          const path = planPathMap.get(planId);
          const payload = {
            type: 'force_unlock',
            requestId,
            planId,
            clientName: path?.clientName || '',
            siteName: path?.siteName || '',
            planName: path?.planName || '',
            requestedBy: { userId: info.userId, username: info.username },
            deadlineAt: graceEndsAt,
            graceEndsAt,
            decisionEndsAt,
            graceMinutes,
            hasUnsavedChanges: !!lock.dirty
          };
          sendToUser(targetUserId, payload);
          jsonSend(ws, {
            type: 'force_unlock_started',
            requestId,
            planId,
            targetUserId,
            deadlineAt: graceEndsAt,
            graceEndsAt,
            decisionEndsAt,
            graceMinutes,
            hasUnsavedChanges: !!lock.dirty
          });
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_force_unlock_started',
            userId: info.userId,
            username: info.username,
            scopeType: 'plan',
            scopeId: planId,
            details: { targetUserId, graceMinutes }
          });
          return;
        }

        if (msg?.type === 'force_unlock_cancel') {
          const requestId = String(msg.requestId || '').trim();
          if (!requestId) return;
          const entry = forceUnlocks.get(requestId);
          if (!entry) return;
          if (!info?.isSuperAdmin) return;
          if (entry.requestedById !== info.userId) return;
          if (Number(entry.graceEndsAt || 0) > Date.now()) return;
          forceUnlocks.delete(requestId);
          sendToUser(entry.targetUserId, { type: 'force_unlock_cancelled', requestId, planId: entry.planId });
          jsonSend(ws, { type: 'force_unlock_cancelled', requestId, planId: entry.planId, targetUserId: entry.targetUserId });
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_force_unlock_cancelled',
            userId: info.userId,
            username: info.username,
            scopeType: 'plan',
            scopeId: entry.planId,
            details: { targetUserId: entry.targetUserId, requestId }
          });
          return;
        }

        if (msg?.type === 'force_unlock_execute') {
          const requestId = String(msg.requestId || '').trim();
          const action = String(msg.action || '').trim();
          if (!requestId) return;
          const entry = forceUnlocks.get(requestId);
          if (!entry) return;
          if (entry.requestedById !== info.userId) return;
          if (action !== 'save' && action !== 'discard') return;
          if (Number(entry.graceEndsAt || 0) > Date.now()) return;
          sendToUser(entry.targetUserId, { type: 'force_unlock_execute', requestId, planId: entry.planId, action });
          return;
        }

        if (msg?.type === 'force_unlock_done') {
          const requestId = String(msg.requestId || '').trim();
          const action = String(msg.action || '').trim();
          const ok = !!msg.ok;
          if (!requestId) return;
          const entry = forceUnlocks.get(requestId);
          if (!entry) return;
          if (entry.targetUserId !== info.userId) return;
          sendToUser(entry.requestedById, { type: 'force_unlock_done', requestId, planId: entry.planId, action, ok });
          if (ok) {
            const lock = getValidLock(entry.planId);
            const lastActionAt = lock?.lastActionAt || lock?.ts || null;
            if (lock && lock.userId === entry.targetUserId) {
              planLocks.delete(entry.planId);
              writeAuditLog(db, {
                level: 'important',
                event: 'plan_lock_released',
                userId: lock.userId,
                username: lock.username,
                scopeType: 'plan',
                scopeId: entry.planId,
                details: { reason: 'force_unlock_done', requestId, action }
              });
            }
            forceUnlocks.delete(requestId);
            finalizeForceUnlockTakeover(entry.planId, entry.requestedById, entry.requestedByName, lastActionAt, requestId, 'force_unlock_done');
          }
          return;
        }

        if (msg?.type === 'leave') {
          const planId = String(msg.planId || '').trim();
          if (!planId) return;
          const members = wsPlanMembers.get(planId);
          if (members) {
            members.delete(ws);
            if (!members.size) wsPlanMembers.delete(planId);
          }
          info.plans.delete(planId);
          const lock = planLocks.get(planId);
          if (lock && lock.userId === info.userId) {
            const lastActionAt = lock.lastActionAt || lock.ts || null;
            const remaining = wsPlanMembers.get(planId);
            let stillThere = false;
            if (remaining) {
              for (const otherWs of remaining) {
                const otherInfo = wsClientInfo.get(otherWs);
                if (otherInfo?.userId === info.userId) {
                  stillThere = true;
                  break;
                }
              }
            }
            if (!stillThere) {
              planLocks.delete(planId);
              writeAuditLog(db, { level: 'important', event: 'plan_lock_released', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId, details: { reason: 'leave' } });
              const completed = completeForceUnlockAsAutoDiscard(planId, info.userId, lastActionAt, 'target_left');
              if (!completed) emitLockState(planId);
            }
          }
          emitPresence(planId);
          emitGlobalPresence();
          return;
        }

        if (msg?.type === 'release_lock') {
          const planId = String(msg.planId || '').trim();
          const lock = planLocks.get(planId);
          if (lock && lock.userId === info.userId) {
            const lastActionAt = lock.lastActionAt || lock.ts || null;
            planLocks.delete(planId);
            writeAuditLog(db, { level: 'important', event: 'plan_lock_released', userId: info.userId, username: info.username, scopeType: 'plan', scopeId: planId, details: { reason: 'release' } });
            const completed = completeForceUnlockAsAutoDiscard(planId, info.userId, lastActionAt, 'target_released');
            if (!completed) emitLockState(planId);
          }
          return;
        }

        if (msg?.type === 'unlock_request') {
          const planId = String(msg.planId || '').trim();
          const targetUserId = String(msg.targetUserId || '').trim();
          const message = typeof msg.message === 'string' ? String(msg.message || '').trim() : '';
          const rawMinutes = Number(msg.grantMinutes ?? msg.minutes ?? '');
          const grantMinutes = Number.isFinite(rawMinutes) ? Math.max(0.5, Math.min(60, rawMinutes)) : 10;
          if (!planId || !targetUserId) return;
          const requesterAccess = getPlanAccessForUser(info.userId, planId);
          if (requesterAccess !== 'rw') {
            jsonSend(ws, { type: 'unlock_denied', planId, targetUserId, reason: 'forbidden' });
            return;
          }
          const lock = getValidLock(planId);
          if (!lock || lock.userId !== targetUserId) {
            jsonSend(ws, { type: 'unlock_denied', planId, targetUserId, reason: 'no_lock' });
            return;
          }
          const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
          const state = readState();
          const planPathMap = buildPlanPathMap(state.clients || []);
          const path = planPathMap.get(planId);
          const payload = {
            type: 'unlock_request',
            requestId,
            planId,
            clientName: path?.clientName || '',
            siteName: path?.siteName || '',
            planName: path?.planName || '',
            requestedBy: { userId: info.userId, username: info.username },
            grantMinutes,
            message: message ? message.slice(0, 1000) : ''
          };
          const sent = sendToUser(targetUserId, payload);
          if (!sent) {
            jsonSend(ws, { type: 'unlock_denied', planId, targetUserId, reason: 'offline' });
            return;
          }
          unlockRequests.set(requestId, {
            requestedById: info.userId,
            requestedByName: info.username,
            requestedByAvatarUrl: info.avatarUrl || '',
            targetUserId,
            planId,
            message: message ? message.slice(0, 1000) : '',
            grantMinutes,
            createdAt: Date.now()
          });
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_unlock_requested',
            userId: info.userId,
            username: info.username,
            scopeType: 'plan',
            scopeId: planId,
            details: { targetUserId }
          });
          jsonSend(ws, { type: 'unlock_sent', requestId, planId, targetUserId });
          return;
        }

        if (msg?.type === 'unlock_response') {
          const requestId = String(msg.requestId || '').trim();
          const planId = String(msg.planId || '').trim();
          const action = String(msg.action || '').trim();
          if (!requestId || !planId) return;
          const request = unlockRequests.get(requestId);
          if (!request) return;
          if (request.targetUserId !== info.userId) return;
          unlockRequests.delete(requestId);
          const granted = action === 'grant' || action === 'grant_save' || action === 'grant_discard';
          let released = false;
          let grantCreated = false;
          let lockAssignedToRequester = false;
          let grantPayload = null;
          let takeover = null;
          let lastActionAt = null;
          if (granted) {
            const current = getValidLock(planId);
            if (current && current.userId && current.userId !== info.userId) {
              released = false;
            } else {
              if (current && current.userId === info.userId) {
                lastActionAt = current.lastActionAt || current.ts || null;
                planLocks.delete(planId);
                writeAuditLog(db, {
                  level: 'important',
                  event: 'plan_lock_released',
                  userId: info.userId,
                  username: info.username,
                  scopeType: 'plan',
                  scopeId: planId,
                  details: { reason: 'unlock_request', action }
                });
                released = true;
              }
              const after = getValidLock(planId);
              if (!after) {
                const requesterJoined = userIsJoinedToPlan(planId, request.requestedById);
                if (requesterJoined) {
                  const now = Date.now();
                  const requester = resolveUserIdentity(request.requestedById, request.requestedByName || 'user');
                  planLocks.set(planId, {
                    userId: requester.userId,
                    username: requester.username,
                    avatarUrl: requester.avatarUrl || '',
                    acquiredAt: now,
                    ts: now,
                    lastActionAt: null,
                    dirty: false
                  });
                  writeAuditLog(db, {
                    level: 'important',
                    event: 'plan_lock_acquired',
                    userId: requester.userId,
                    username: requester.username,
                    scopeType: 'plan',
                    scopeId: planId,
                    details: { reason: 'unlock_request_immediate' }
                  });
                  lockAssignedToRequester = true;
                  takeover = 'immediate';
                } else {
                  const minutes = Number.isFinite(Number(request.grantMinutes)) ? Math.max(0.5, Math.min(60, Number(request.grantMinutes))) : 10;
                  const now = Date.now();
                  const expiresAt = now + Math.round(minutes * 60_000);
                  planLockGrants.set(planId, {
                    userId: request.requestedById,
                    username: request.requestedByName,
                    avatarUrl: request.requestedByAvatarUrl || '',
                    grantedAt: now,
                    expiresAt,
                    minutes,
                    grantedById: info.userId,
                    grantedByName: info.username,
                    lastActionAt
                  });
                  grantCreated = true;
                  takeover = 'reserved';
                  grantPayload = {
                    userId: request.requestedById,
                    username: request.requestedByName,
                    avatarUrl: request.requestedByAvatarUrl || '',
                    grantedAt: now,
                    expiresAt,
                    minutes,
                    grantedBy: { userId: info.userId, username: info.username }
                  };
                }
              }
            }
          }
          if (released || grantCreated || lockAssignedToRequester) emitLockState(planId);
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_unlock_response',
            userId: info.userId,
            username: info.username,
            scopeType: 'plan',
            scopeId: planId,
            details: { action, released, requestedById: request.requestedById }
          });
          sendToUser(request.requestedById, {
            type: 'unlock_result',
            requestId,
            planId,
            targetUserId: info.userId,
            action,
            released,
            grantedBy: { userId: info.userId, username: info.username, avatarUrl: info.avatarUrl || '' },
            takeover,
            grant: grantPayload,
            plan: (() => {
              const state = readState();
              const planPathMap = buildPlanPathMap(state.clients || []);
              const path = planPathMap.get(planId);
              return { clientName: path?.clientName || '', siteName: path?.siteName || '', planName: path?.planName || '' };
            })()
          });
        }
      });

      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        releaseLocksForWs(ws);
        emitGlobalPresence();
      });
    });

    heartbeatTimer = setInterval(() => {
      for (const ws of wss.clients) {
        if (ws.isAlive === false) {
          try {
            ws.terminate();
          } catch {}
          continue;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {}
      }
    }, 30_000);

    lockCleanupTimer = setInterval(() => {
      const expiredGrants = purgeExpiredGrants();
      if (expiredGrants.length) {
        for (const entry of expiredGrants) {
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_lock_grant_expired',
            userId: entry.grant.userId,
            username: entry.grant.username,
            scopeType: 'plan',
            scopeId: entry.planId
          });
          emitLockState(entry.planId);
        }
      }
      const expiredForce = purgeExpiredForceUnlocks();
      if (expiredForce.length) {
        for (const { requestId, entry } of expiredForce) {
          sendToUser(entry.requestedById, { type: 'force_unlock_expired', requestId, planId: entry.planId, targetUserId: entry.targetUserId });
          sendToUser(entry.targetUserId, { type: 'force_unlock_expired', requestId, planId: entry.planId });
          writeAuditLog(db, {
            level: 'important',
            event: 'plan_force_unlock_expired',
            userId: entry.requestedById,
            username: entry.requestedByName,
            scopeType: 'plan',
            scopeId: entry.planId,
            details: { targetUserId: entry.targetUserId, requestId }
          });
        }
      }
      const now = Date.now();
      for (const [requestId, request] of unlockRequests.entries()) {
        if (now - (request.createdAt || 0) > 5 * 60_000) unlockRequests.delete(requestId);
      }
    }, LOCK_CLEANUP_MS);

    wss.on('close', () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (lockCleanupTimer) clearInterval(lockCleanupTimer);
    });
  };

  return {
    wsClientInfo,
    planLocks,
    planLockGrants,
    purgeExpiredLocks,
    sendToUser,
    broadcastToChatClient,
    emitGlobalPresence,
    emitLockState,
    attachWebSocketServer
  };
};

module.exports = {
  createRealtimeRuntime
};
