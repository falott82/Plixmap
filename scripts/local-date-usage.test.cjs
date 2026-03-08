const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('plan meeting flows do not use UTC day slicing for current-day logic', () => {
  const planView = read('src/components/plan/PlanView.tsx');
  const duplicateModal = read('src/components/plan/RoomMeetingDuplicateModal.tsx');
  const meetingManager = read('src/components/meetings/MeetingManagerModal.tsx');

  assert.doesNotMatch(planView, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.doesNotMatch(duplicateModal, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(meetingManager, /currentLocalIsoDay/);
});

test('localDate utility derives day values from local date parts', () => {
  const source = read('src/utils/localDate.ts');

  assert.match(source, /safeDate\.getFullYear\(\)/);
  assert.match(source, /safeDate\.getMonth\(\) \+ 1/);
  assert.match(source, /safeDate\.getDate\(\)/);
  assert.match(source, /export const currentLocalIsoDay/);
  assert.match(source, /export const toLocalMonthAnchor/);
});
