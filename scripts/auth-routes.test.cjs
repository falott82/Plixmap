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
    isStrictSuperAdmin: (user) => String(user?.username || '') === 'superadmin'
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
