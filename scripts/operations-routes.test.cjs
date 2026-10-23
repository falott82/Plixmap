const test = require('node:test');
const assert = require('node:assert/strict');
const { registerOperationsRoutes } = require('../server/routes/operations.cjs');
const { registerMaintenanceRoutes } = require('../server/routes/maintenance.cjs');
const { registerCapacityRoutes } = require('../server/routes/capacity.cjs');
const { registerUpdateRoutes } = require('../server/routes/updates.cjs');

const createApp = () => {
  const routes = new Map();
  const app = { routes };
  for (const method of ['get', 'post']) {
    app[method] = (path, ...handlers) => routes.set(`${method} ${path}`, handlers.at(-1));
  }
  return app;
};
const createRes = () => ({
  code: 200,
  status(code) { this.code = code; return this; },
  json(payload) { this.payload = payload; return this; }
});
const middleware = { requireAuth: () => {}, rateByUser: () => () => {} };

test('extracted administrative endpoints reject non-superadmins before accessing services', async () => {
  const app = createApp();
  for (const register of [registerOperationsRoutes, registerMaintenanceRoutes, registerCapacityRoutes, registerUpdateRoutes]) {
    register(app, middleware);
  }
  for (const [key, handler] of app.routes) {
    if (key.includes('/api/health/') || key === 'get /api/capacity/history') continue;
    const res = createRes();
    await handler({ isSuperAdmin: false }, res);
    assert.equal(res.code, 403, key);
    assert.deepEqual(res.payload, { error: 'Forbidden' }, key);
  }
});

test('readiness returns 503 when database is unavailable', () => {
  const app = createApp();
  registerOperationsRoutes(app, { ...middleware, db: { prepare() { throw new Error('DB unavailable'); } } });
  const res = createRes();
  app.routes.get('get /api/health/ready')({}, res);
  assert.equal(res.code, 503);
  assert.equal(res.payload.status, 'not_ready');
});

const clients = ['allowed', 'private'].map((id) => ({ id, sites: [{ id: `${id}-site`, floorPlans: [{ id: `${id}-plan` }] }] }));
const scopedDb = {
  prepare(sql) {
    return sql.includes('FROM users')
      ? { get: () => ({ id: 'u1', username: 'alice' }) }
      : { all: () => [{ scopeType: 'client', scopeId: 'allowed', access: 'ro' }] };
  }
};

test('capacity history supports ordinary users and filters unauthorized clients', () => {
  const app = createApp();
  registerCapacityRoutes(app, {
    ...middleware, db: scopedDb, readState: () => ({ clients }),
    readCapacityHistory: () => ({ snapshots: [{ at: 100, clients: [{ clientId: 'allowed' }, { clientId: 'private' }] }], lastSnapshotAt: 100 })
  });
  const handler = app.routes.get('get /api/capacity/history');
  const res = createRes();
  handler({ userId: 'u1', query: {} }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.payload.snapshots, [{ at: 100, clients: [{ clientId: 'allowed' }] }]);
  const forbidden = createRes();
  handler({ userId: 'u1', query: { clientId: 'private' } }, forbidden);
  assert.equal(forbidden.code, 403);
});

test('failed package checks preserve the last successful metadata', async () => {
  const app = createApp();
  const writes = [];
  registerMaintenanceRoutes(app, {
    ...middleware, resolveUsername: () => 'alice', requestMeta: () => ({}),
    setAppSetting: (...args) => writes.push(args),
    executeNpm: (_cmd, _args, _options, callback) => callback({ code: 'ENOENT', message: 'npm unavailable' }, '', '')
  });
  const res = createRes();
  await app.routes.get('post /api/settings/package-updates')({ isSuperAdmin: true, userId: 'u1' }, res);
  assert.equal(res.payload.ok, false);
  assert.equal(writes.length, 0);
});
