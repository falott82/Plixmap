const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('PlanView treats invalid time strings as invalid instead of midnight', () => {
  // PlanView logic now lives in the usePlanView hook; the pure time helpers were extracted
  // into planViewTime.ts (plain functions instead of useCallback wrappers). The
  // room-meetings timeline subsystem was further extracted into the
  // useRoomMeetingsTimeline hook, and its pure resolveRoomDuplicateSlot helper now
  // lives in useRoomMeetingsTimeline.helpers.ts.
  const timeUtils = read('src/components/plan/planViewTime.ts');
  const timelineHelpers = read('src/components/plan/useRoomMeetingsTimeline.helpers.ts');

  assert.match(timeUtils, /export const hmToMinutes = \(hm: string\): number \| null => \{/);
  assert.match(timeUtils, /if \(!m\) return null;/);
  assert.match(timelineHelpers, /const parsedSourceStartMin = hmToMinutes\(sourceStartHm\);/);
  assert.match(timelineHelpers, /if \(!Number\.isFinite\(parsedSourceStartMin\)\) return null;/);
});

test('RoomMeetingDuplicateModal accepts nullable time parsing for custom windows', () => {
  const source = read('src/components/plan/RoomMeetingDuplicateModal.tsx');

  assert.match(source, /hmToMinutes: \(hm: string\) => number \| null;/);
  assert.match(source, /Number\.isFinite\(customFromMin\)/);
  assert.match(source, /Number\.isFinite\(customToMin\)/);
  assert.match(source, /Number\(customFromMin\) < Number\(customToMin\)/);
});
