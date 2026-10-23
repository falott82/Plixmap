const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { extractHistoryVersion, readHistoryVersion, extractReadmeVersion, validateVersionConsistency } = require('./version-utils.cjs');

test('extractReadmeVersion returns semantic version', () => {
  const value = extractReadmeVersion('Deskly\nCurrent version: 2.9.1\n');
  assert.equal(value, '2.9.1');
});

test('extractHistoryVersion returns first release entry version', () => {
  const value = extractHistoryVersion("export const releaseHistory = [{ version: '2.9.1' }, { version: '2.9.0' }]");
  assert.equal(value, '2.9.1');
});

test('readHistoryVersion follows array order rather than import declaration order', () => {
  const root = path.resolve('/virtual/history.ts');
  const files = new Map([
    [root, "import { old } from './old'; import { recent as latest } from './recent'; export const releaseHistory: ReleaseNote[] = [...latest, ...old];"],
    [path.resolve('/virtual/recent.ts'), "export const recent = [{version: '3.7.0'}];"],
    [path.resolve('/virtual/old.ts'), "export const old = [{version: '1.0.0'}];"]
  ]);
  assert.equal(readHistoryVersion(root, (file) => files.get(file)), '3.7.0');
});

test('readHistoryVersion matches the actual split release history', () => {
  const pkg = require('../package.json');
  assert.equal(readHistoryVersion(path.join(__dirname, '../src/version/history.ts')), pkg.version);
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
