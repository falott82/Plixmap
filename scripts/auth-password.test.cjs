const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, verifyPassword, isStrongPassword, MAX_PASSWORD_LENGTH } = require('../server/auth.cjs');

test('verifyPassword round-trips the exact password and rejects a different one', () => {
  const password = 'Str0ng!Pass';
  const { salt, hash } = hashPassword(password);
  assert.equal(verifyPassword(password, salt, hash), true);
  assert.equal(verifyPassword('Str0ng!Pasz', salt, hash), false);
});

test('passwords sharing a 72-byte prefix are NOT interchangeable (no bcrypt-style truncation)', () => {
  // First 72 bytes are identical; only the 73rd byte differs. bcrypt would
  // truncate at 72 bytes and treat these as the same password — scrypt does not.
  const prefix72 = `A1!${'a'.repeat(69)}`; // 72 ASCII bytes, satisfies the strength policy
  assert.equal(Buffer.byteLength(prefix72, 'utf8'), 72);
  const passwordA = `${prefix72}X`; // 73 bytes
  const passwordB = `${prefix72}Y`; // 73 bytes, same first 72 bytes

  const { salt, hash } = hashPassword(passwordA);
  assert.equal(verifyPassword(passwordA, salt, hash), true, 'the original password must verify');
  assert.equal(
    verifyPassword(passwordB, salt, hash),
    false,
    'a password sharing the 72-byte prefix but differing afterwards must NOT verify'
  );

  // Symmetric: hashing B must not be satisfied by A either.
  const hashedB = hashPassword(passwordB);
  assert.equal(verifyPassword(passwordA, hashedB.salt, hashedB.hash), false);
});

test('isStrongPassword enforces the length cap and complexity rules', () => {
  // Valid baseline.
  assert.equal(isStrongPassword('Str0ng!Pass'), true);
  // Too short / missing character classes.
  assert.equal(isStrongPassword('Ab1!'), false);
  assert.equal(isStrongPassword('alllowercase1!'), false);
  // Exactly at the cap is allowed; one over is rejected.
  const atCap = `Aa1!${'a'.repeat(MAX_PASSWORD_LENGTH - 4)}`;
  assert.equal(atCap.length, MAX_PASSWORD_LENGTH);
  assert.equal(isStrongPassword(atCap), true);
  const overCap = `${atCap}a`;
  assert.equal(overCap.length, MAX_PASSWORD_LENGTH + 1);
  assert.equal(isStrongPassword(overCap), false);
});
