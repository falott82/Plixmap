const test = require('node:test');
const assert = require('node:assert/strict');

const { createAuthRuntime } = require('../server/routes/auth.cjs');

const createRuntime = (overrides = {}) => {
  const db = overrides.db || {
    prepare: () => ({
      get: () => null
    })
  };
  const cleared = [];
  const ensured = [];
  const runtime = createAuthRuntime({
    db,
    authSecret: 'secret',
    serverInstanceId: 'sid-1',
    PRIMARY_SESSION_COOKIE: 'plixmap_auth',
    parseCookies: (cookieHeader) => {
      const out = {};
      for (const chunk of String(cookieHeader || '').split(';')) {
        const [name, ...rest] = chunk.split('=');
        const key = String(name || '').trim();
        if (!key) continue;
        out[key] = rest.join('=').trim();
      }
      return out;
    },
    verifySession: (_secret, token) => (token === 'valid-token' ? { userId: 'u1', tokenVersion: 3, sid: 'sid-1' } : null),
    clearSessionCookie: (res) => cleared.push(res),
    ensureCsrfCookie: (req, res) => ensured.push({ req, res }),
    isStrictSuperAdmin: (user) => String(user?.username || '') === 'superadmin',
    now: overrides.now
  });
  return { runtime, cleared, ensured };
};

test('createAuthRuntime locks user after repeated failures and supports explicit reset', () => {
  const { runtime } = createRuntime();

  for (let i = 0; i < 7; i += 1) {
    assert.deepEqual(runtime.registerUserLoginFailure(' Mario '), { lockedNow: false });
  }
  const locked = runtime.registerUserLoginFailure('mario');
  assert.equal(locked.lockedNow, true);
  assert.ok(Number(locked.lockedUntil) > Date.now());
  assert.equal(runtime.getUserLock('MARIO'), locked.lockedUntil);

  runtime.clearUserLoginFailures('mario');
  assert.equal(runtime.getUserLock('mario'), 0);
});

test('createAuthRuntime blocks login attempts over the per-IP threshold', () => {
  let clock = 1_000_000_000;
  const { runtime } = createRuntime({ now: () => clock });

  // First 20 attempts from the same IP are allowed within the 5-minute window.
  for (let i = 0; i < 20; i += 1) {
    assert.equal(runtime.allowLoginAttempt('203.0.113.7'), true, `attempt ${i + 1} should be allowed`);
  }
  // The 21st attempt is blocked.
  assert.equal(runtime.allowLoginAttempt('203.0.113.7'), false);
  // A different IP is unaffected by another IP's bucket.
  assert.equal(runtime.allowLoginAttempt('203.0.113.8'), true);
});

test('createAuthRuntime evicts inactive rate-limit keys once their window expires', () => {
  let clock = 1_000_000_000;
  const { runtime } = createRuntime({ now: () => clock });

  // Two IPs and one username become active.
  runtime.allowLoginAttempt('198.51.100.1');
  runtime.allowLoginAttempt('198.51.100.2');
  for (let i = 0; i < 8; i += 1) runtime.registerUserLoginFailure('mallory'); // locks the account
  assert.ok(runtime.getUserLock('mallory') > 0, 'account should be locked after 8 failures');
  assert.deepEqual(runtime.getRateLimitStats(), { ipKeys: 2, userKeys: 1 });

  // Advance past every window/lock (15 min) plus the 60s cleanup gate, then let a
  // single fresh request from another key trigger the lazy cleanup pass.
  clock += 15 * 60 * 1000 + 61_000;
  runtime.allowLoginAttempt('198.51.100.9'); // triggers IP-bucket cleanup
  runtime.registerUserLoginFailure('newcomer'); // triggers user-bucket cleanup

  // The two stale IP keys are gone (only the fresh one remains) and the expired
  // user lock is gone (only the fresh username remains): the maps stay bounded.
  assert.deepEqual(runtime.getRateLimitStats(), { ipKeys: 1, userKeys: 1 });
  assert.equal(runtime.getUserLock('mallory'), 0, 'expired lock should no longer apply');
});

test('createAuthRuntime requireAuth enforces first-run endpoint allowlist', () => {
  const db = {
    prepare: () => ({
      get: () => ({
        id: 'u1',
        username: 'Mario',
        tokenVersion: 3,
        isAdmin: 0,
        isSuperAdmin: 0,
        disabled: 0,
        mustChangePassword: 1
      })
    })
  };
  const { runtime, ensured } = createRuntime({ db });

  const blockedRes = {
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  runtime.requireAuth({ headers: { cookie: 'plixmap_auth=valid-token' }, path: '/api/state' }, blockedRes, () => {
    throw new Error('next should not be called');
  });
  assert.equal(blockedRes.code, 403);
  assert.deepEqual(blockedRes.body, { error: 'Password change required' });

  let nextCalled = false;
  const allowedReq = { headers: { cookie: 'plixmap_auth=valid-token' }, path: '/api/auth/me' };
  const allowedRes = {
    status() {
      return this;
    },
    json() {
      return this;
    }
  };
  runtime.requireAuth(allowedReq, allowedRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(allowedReq.userId, 'u1');
  assert.equal(allowedReq.username, 'mario');
  assert.equal(ensured.length, 1);
});
