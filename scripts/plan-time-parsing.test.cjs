const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('PlanView treats invalid time strings as invalid instead of midnight', () => {
  const source = read('src/components/plan/PlanView.tsx');

  assert.match(source, /const hmToMinutes = useCallback\(\(hm: string\): number \| null => \{/);
  assert.match(source, /if \(!m\) return null;/);
  assert.match(source, /const parsedSourceStartMin = hmToMinutes\(sourceStartHm\);/);
  assert.match(source, /if \(!Number\.isFinite\(parsedSourceStartMin\)\) return null;/);
});

test('RoomMeetingDuplicateModal accepts nullable time parsing for custom windows', () => {
  const source = read('src/components/plan/RoomMeetingDuplicateModal.tsx');

  assert.match(source, /hmToMinutes: \(hm: string\) => number \| null;/);
  assert.match(source, /Number\.isFinite\(customFromMin\)/);
  assert.match(source, /Number\.isFinite\(customToMin\)/);
  assert.match(source, /Number\(customFromMin\) < Number\(customToMin\)/);
});
