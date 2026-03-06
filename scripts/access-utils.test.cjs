const test = require('node:test');
const assert = require('node:assert/strict');

const { isAdminLike, isStrictSuperAdmin } = require('../server/access.cjs');

test('isStrictSuperAdmin only accepts the canonical superadmin account', () => {
  assert.equal(isStrictSuperAdmin({ username: 'superadmin', isSuperAdmin: true }), true);
  assert.equal(isStrictSuperAdmin({ username: 'SuperAdmin', isSuperAdmin: true }), true);
  assert.equal(isStrictSuperAdmin({ username: 'admin', isSuperAdmin: true }), false);
  assert.equal(isStrictSuperAdmin({ username: 'superadmin', isSuperAdmin: false }), false);
});

test('isAdminLike accepts admins and canonical superadmin', () => {
  assert.equal(isAdminLike({ username: 'mario', isAdmin: true, isSuperAdmin: false }), true);
  assert.equal(isAdminLike({ username: 'superadmin', isAdmin: false, isSuperAdmin: true }), true);
  assert.equal(isAdminLike({ username: 'admin', isAdmin: false, isSuperAdmin: true }), false);
  assert.equal(isAdminLike({ username: 'anna', isAdmin: false, isSuperAdmin: false }), false);
});
