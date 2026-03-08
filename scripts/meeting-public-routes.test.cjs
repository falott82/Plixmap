const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildKioskManifest,
  buildMobileManifest,
  registerMeetingPublicRoutes
} = require('../server/routes/meetingPublic.cjs');

const createAppStub = () => {
  const routes = { get: [], post: [] };
  return {
    routes,
    get(path, ...handlers) {
      routes.get.push({ path, handlers });
    },
    post(path, ...handlers) {
      routes.post.push({ path, handlers });
    }
  };
};

const createRes = () => ({
  code: 200,
  headers: {},
  payload: null,
  status(code) {
    this.code = code;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  },
  json(payload) {
    this.payload = payload;
    return this;
  }
});

test('meeting public manifests preserve standalone payload and encode room ids', () => {
  assert.equal(buildKioskManifest('room 42').start_url, '/meetingroom/room%2042');
  assert.equal(buildKioskManifest('room 42').scope, '/meetingroom/');
  assert.equal(buildMobileManifest().start_url, '/mobile');
  assert.equal(buildMobileManifest().scope, '/mobile');
});

test('registerMeetingPublicRoutes toggles kiosk check-ins and returns updated maps', () => {
  const app = createAppStub();
  const runs = [];
  registerMeetingPublicRoutes(app, {
    db: {
      prepare(sql) {
        if (sql.includes('SELECT id, roomId, status, startAt, endAt FROM meeting_bookings')) {
          return {
            get(meetingId) {
              return meetingId === 'm1' ? { id: 'm1', roomId: 'r1', status: 'approved', startAt: 0, endAt: 10 } : null;
            }
          };
        }
        return {
          run(...args) {
            runs.push({ sql, args });
          }
        };
      }
    },
    requireAuth: (_req, _res, next) => next(),
    readState: () => ({ clients: [] }),
    serverLog: () => {},
    buildKioskPublicUrl: () => 'http://example.test/meetingroom/r1',
    buildMobilePublicUrl: () => 'http://example.test/mobile?roomId=r1',
    buildKioskPublicUploadUrl: () => null,
    meeting: {
      dayRangeFromIso: () => null,
      parseIsoDay: () => null,
      parseClockTime: () => null,
      toLocalTs: () => 0,
      clampMeetingBuffer: () => 0,
      getVisibleClientsForMeetings: () => [],
      listMeetingRoomsFromClients: () => [],
      mapMeetingRow: (row) => row,
      getMeetingCheckInMap: (meetingId) => ({ [meetingId]: { attendee: true } }),
      getMeetingCheckInMapByMeetingIds: () => ({}),
      getMeetingCheckInTimestampsByMeetingIds: (ids) => Object.fromEntries(ids.map((id) => [id, { attendee: 123 }])),
      buildCheckInKeyForRealParticipant: () => 'attendee',
      resolveLinkedRealUserForPortalUser: () => null,
      findMeetingParticipantForLinkedUser: () => null,
      sendMeetingMail: async () => ({ ok: true })
    }
  });

  const route = app.routes.post.find((entry) => entry.path === '/api/meeting-room/:roomId/checkin-toggle');
  assert.ok(route, 'route should be registered');

  const req = {
    params: { roomId: 'r1' },
    body: { meetingId: 'm1', key: 'attendee', checked: true }
  };
  const res = createRes();
  route.handlers[1](req, res);

  assert.equal(res.code, 200);
  assert.deepEqual(res.payload, {
    ok: true,
    meetingId: 'm1',
    checkInMap: { m1: { attendee: true } },
    checkInTimestamps: { attendee: 123 }
  });
  assert.equal(runs.length, 1);
  assert.match(runs[0].sql, /INSERT INTO meeting_checkins/);
  assert.deepEqual(runs[0].args, ['m1', 'attendee', runs[0].args[2]]);
  assert.ok(Number.isFinite(runs[0].args[2]));
});
