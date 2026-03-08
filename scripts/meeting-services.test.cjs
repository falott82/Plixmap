const test = require('node:test');
const assert = require('node:assert/strict');

const { createMeetingServices } = require('../server/services/meetings.cjs');

const createDeps = (db) => ({
  db: db || { prepare: () => ({ all: () => [], get: () => null, run: () => ({}) }) },
  readState: () => ({ clients: [] }),
  dataSecret: 'secret',
  getUserWithPermissions: () => null,
  computePlanAccess: () => [],
  filterStateForUser: (clients) => clients,
  getEmailConfig: () => null,
  getClientEmailConfig: () => null,
  logEmailAttempt: () => {},
  wsClientInfo: new Map(),
  sendToUser: () => {},
  chat: {
    userHasBlocked: () => false,
    normalizeDmChatMessageRow: (row) => row
  }
});

test('sanitizeMeetingManagerActions preserves reschedule and validates completion dates', () => {
  const meeting = createMeetingServices(createDeps());

  const actions = meeting.sanitizeMeetingManagerActions([
    {
      action: 'Call vendor',
      assignedTo: 'Ops',
      openingDate: '2026-03-08',
      completionDate: 'not-a-date',
      progressPct: 52,
      status: 'reschedule'
    },
    {
      action: 'Close room setup',
      progressPct: 96,
      status: 'done',
      completionDate: '2026-03-09'
    }
  ]);

  assert.deepEqual(actions, [
    {
      action: 'Call vendor',
      assignedTo: 'Ops',
      openingDate: '2026-03-08',
      completionDate: '',
      progressPct: 50,
      status: 'reschedule'
    },
    {
      action: 'Close room setup',
      assignedTo: '',
      openingDate: '',
      completionDate: '2026-03-09',
      progressPct: 95,
      status: 'done'
    }
  ]);
});

test('resolvePersistedMeetingAdminIds filters requested ids but preserves canonical fallback owner', () => {
  const db = {
    prepare: (sql) => ({
      all: (...ids) => {
        assert.match(sql, /FROM users/);
        return ids.filter((id) => id === 'owner' || id === 'admin-1').map((id) => ({ id }));
      },
      get: () => null,
      run: () => ({})
    })
  };
  const meeting = createMeetingServices(createDeps(db));

  assert.deepEqual(
    meeting.resolvePersistedMeetingAdminIds(['admin-1', 'missing', 'admin-1'], ['owner']),
    ['admin-1', 'owner']
  );
});

test('meeting note helpers reuse a single mapped shape for list and single-note lookups', () => {
  const noteRow = {
    id: 'note-1',
    meetingId: 'meeting-1',
    authorUserId: 'u1',
    authorUsername: 'mario',
    authorExternalId: '',
    authorEmail: 'mario@example.com',
    authorDisplayName: '',
    title: 'Weekly review',
    contentText: 'summary',
    contentHtml: '<p>summary</p>',
    contentLexical: '{}',
    shared: 1,
    createdAt: 10,
    updatedAt: 20
  };
  const db = {
    prepare: (sql) => ({
      all: (meetingId) => {
        assert.match(sql, /FROM meeting_notes/);
        assert.equal(meetingId, 'meeting-1');
        return [noteRow];
      },
      get: (noteId, meetingId) => {
        assert.match(sql, /FROM meeting_notes/);
        assert.equal(noteId, 'note-1');
        assert.equal(meetingId, 'meeting-1');
        return noteRow;
      },
      run: () => ({})
    })
  };
  const meeting = createMeetingServices(createDeps(db));

  assert.deepEqual(meeting.listMeetingNotesByMeetingId('meeting-1'), [
    {
      id: 'note-1',
      meetingId: 'meeting-1',
      authorUserId: 'u1',
      authorUsername: 'mario',
      authorDisplayName: 'mario',
      authorExternalId: '',
      authorEmail: 'mario@example.com',
      title: 'Weekly review',
      contentText: 'summary',
      contentHtml: '<p>summary</p>',
      contentLexical: '{}',
      shared: true,
      createdAt: 10,
      updatedAt: 20
    }
  ]);
  assert.deepEqual(meeting.getMeetingNoteById('meeting-1', 'note-1'), {
    id: 'note-1',
    meetingId: 'meeting-1',
    authorUserId: 'u1',
    authorUsername: 'mario',
    authorDisplayName: 'mario',
    authorExternalId: '',
    authorEmail: 'mario@example.com',
    title: 'Weekly review',
    contentText: 'summary',
    contentHtml: '<p>summary</p>',
    contentLexical: '{}',
    shared: true,
    createdAt: 10,
    updatedAt: 20
  });
});
