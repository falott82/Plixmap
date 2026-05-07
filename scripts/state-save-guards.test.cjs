const test = require('node:test');
const assert = require('node:assert/strict');

const { getWritablePlanIdsForStateSave, hasStateSaveVersionConflict } = require('../server/stateSaveGuards.cjs');

test('getWritablePlanIdsForStateSave keeps only rw plans not blocked by locks', () => {
  const access = new Map([
    ['plan-a', 'rw'],
    ['plan-b', 'ro'],
    ['plan-c', 'rw']
  ]);

  const writable = getWritablePlanIdsForStateSave(access, ['plan-c']);

  assert.deepEqual([...writable], ['plan-a']);
});

test('getWritablePlanIdsForStateSave returns empty set when user cannot save any plan', () => {
  const access = new Map([
    ['plan-a', 'ro'],
    ['plan-b', 'rw']
  ]);

  const writable = getWritablePlanIdsForStateSave(access, ['plan-b']);

  assert.equal(writable.size, 0);
});

test('hasStateSaveVersionConflict only rejects stale positive versions', () => {
  assert.equal(hasStateSaveVersionConflict(null, 10), false);
  assert.equal(hasStateSaveVersionConflict(0, 10), false);
  assert.equal(hasStateSaveVersionConflict(10, null), false);
  assert.equal(hasStateSaveVersionConflict(10, 10), false);
  assert.equal(hasStateSaveVersionConflict(9, 10), true);
});
