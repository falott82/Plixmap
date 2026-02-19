const test = require('node:test');
const assert = require('node:assert/strict');

const { migrations } = require('../server/db.cjs');

test('db migrations are strictly increasing', () => {
  assert.ok(Array.isArray(migrations), 'migrations must be an array');
  assert.ok(migrations.length > 0, 'migrations must not be empty');

  const seen = new Set();
  let previous = 0;
  for (const migration of migrations) {
    assert.equal(typeof migration.up, 'function', `migration ${String(migration?.version || '')} missing up()`);
    assert.equal(Number.isInteger(migration.version), true, 'migration version must be an integer');
    assert.equal(migration.version > 0, true, 'migration version must be > 0');
    assert.equal(seen.has(migration.version), false, `duplicate migration version ${migration.version}`);
    assert.equal(migration.version > previous, true, `migration version ${migration.version} is not > ${previous}`);
    seen.add(migration.version);
    previous = migration.version;
  }
});
