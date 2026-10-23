const test = require('node:test');
const assert = require('node:assert/strict');
const { readLastCheck, checkNpmAudit, checkPackageUpdates } = require('../server/services/packageChecks.cjs');

const execute = (stdout, error = null, stderr = '') => (_cmd, _args, _options, callback) => callback(error, stdout, stderr);

test('last-check metadata accepts legacy timestamps and resolves deleted/renamed actors', () => {
  assert.deepEqual(readLastCheck('123', () => null), { lastCheckAt: 123, lastCheckBy: null, lastCheckUserId: null });
  assert.deepEqual(readLastCheck('{"ts":456,"userId":"u1","count":0}', () => 'alice', true), {
    lastCheckAt: 456, lastCheckBy: 'alice', lastCheckUserId: 'u1', count: 0
  });
  assert.equal(readLastCheck('invalid', () => null, true).count, null);
  assert.equal(readLastCheck('{"count":null}', () => null, true).count, null);
});

test('npm audit accepts exit code 1 with valid findings and totals severity counts', async () => {
  const result = await checkNpmAudit(execute('{"metadata":{"vulnerabilities":{"high":2,"low":1}}}', { code: 1 }));
  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.summary, { info: 0, low: 1, moderate: 0, high: 2, critical: 0, total: 3 });
});

test('npm audit rejects error JSON, malformed output and missing reports', async () => {
  for (const stdout of ['{"error":{"code":"ENOTFOUND"}}', '{invalid', '', '{}', '[]', 'null']) {
    const result = await checkNpmAudit(execute(stdout));
    assert.equal(result.ok, false, stdout);
    assert.equal(result.summary, null);
  }
});

test('npm execution failures never become successful empty update checks', async () => {
  for (const error of [{ code: 'ENOENT', message: 'npm missing' }, { code: 2 }, { killed: true, message: 'timeout' }]) {
    const result = await checkPackageUpdates(execute('', error));
    assert.equal(result.ok, false);
    assert.deepEqual(result.packages, []);
  }
});

test('npm outdated accepts findings, sorts packages and preserves dependency scopes', async () => {
  const result = await checkPackageUpdates(execute(JSON.stringify({
    z: { current: '1', wanted: '2', latest: '3', type: 'devDependencies' },
    a: { current: '1', latest: '2', type: 'dependencies' }
  }), { code: 1 }));
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.deepEqual(result.packages.map(({ name, scope }) => ({ name, scope })), [
    { name: 'a', scope: 'dependencies' }, { name: 'z', scope: 'devDependencies' }
  ]);
  assert.equal((await checkPackageUpdates(execute(''))).ok, true);
});

test('npm diagnostic output is bounded before returning it to the client', async () => {
  const result = await checkPackageUpdates(execute('{}', null, 'x'.repeat(30000)));
  assert.ok(result.stderr.length < 20100);
  assert.match(result.stderr, /truncated/);
});
