const test = require('node:test');
const assert = require('node:assert/strict');
const { extractHistoryVersion, extractReadmeVersion, validateVersionConsistency } = require('./version-utils.cjs');

test('extractReadmeVersion returns semantic version', () => {
  const value = extractReadmeVersion('Deskly\nCurrent version: 2.9.1\n');
  assert.equal(value, '2.9.1');
});

test('extractHistoryVersion returns first release entry version', () => {
  const value = extractHistoryVersion("export const releaseHistory = [{ version: '2.9.1' }, { version: '2.9.0' }]");
  assert.equal(value, '2.9.1');
});

test('validateVersionConsistency reports mismatches', () => {
  const errors = validateVersionConsistency({
    packageVersion: '2.9.1',
    readmeVersion: '2.9.0',
    historyVersion: '2.9.1'
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /README/);
});

test('validateVersionConsistency passes when all versions match', () => {
  const errors = validateVersionConsistency({
    packageVersion: '2.9.1',
    readmeVersion: '2.9.1',
    historyVersion: '2.9.1'
  });
  assert.equal(errors.length, 0);
});
