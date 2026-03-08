const test = require('node:test');
const assert = require('node:assert/strict');

const { getWritablePlanIdsForStateSave } = require('../server/stateSaveGuards.cjs');

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
