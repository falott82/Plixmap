const test = require('node:test');
const assert = require('node:assert/strict');

const { registerMeetingLifecycleRoutes } = require('../server/routes/meetingLifecycle.cjs');

const createAppStub = () => {
  const routes = { post: [], put: [] };
  return {
    routes,
    post(path, ...handlers) {
      routes.post.push({ path, handlers });
    },
    put(path, ...handlers) {
      routes.put.push({ path, handlers });
    }
  };
};

const createRes = () => ({
  code: 200,
  payload: null,
  status(code) {
    this.code = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  }
});

const createBooking = (overrides = {}) => ({
  id: 'm1',
  status: 'approved',
  clientId: 'c1',
  siteId: 's1',
  roomId: 'r1',
  roomName: 'Room 1',
  floorPlanId: 'fp1',
  subject: 'Weekly sync',
  startAt: 100,
  endAt: 200,
  effectiveStartAt: 100,
  effectiveEndAt: 200,
  occurrenceDate: '2026-03-10',
  requestedById: 'u1',
  participants: [],
  externalGuestsDetails: [],
  meetingAdminIds: ['u1'],
  sendEmail: false,
  multiDayGroupId: null,
  ...overrides
});

const createDbStub = (booking) => ({
  transaction(fn) {
    return fn;
  },
  prepare(sql) {
    if (/SELECT \* FROM meeting_bookings WHERE id = \?/.test(sql)) {
      return {
        get() {
          return booking;
        }
      };
    }
    if (/UPDATE meeting_bookings SET status = \?, updatedAt = \? WHERE id = \?/.test(sql)) {
      return {
        run(status, updatedAt) {
          booking.status = status;
          booking.updatedAt = updatedAt;
        }
      };
    }
    if (/UPDATE meeting_bookings\s+SET subject = \?/.test(sql)) {
      return {
        run(
          subject,
          notes,
          videoConferenceLink,
          kioskLanguage,
          requestedSeats,
          participantsJson,
          externalGuests,
          externalGuestsJson,
          externalGuestsDetailsJson,
          setupBufferBeforeMin,
          setupBufferAfterMin,
          meetingAdminIdsJson,
          startAt,
          endAt,
          effectiveStartAt,
          effectiveEndAt,
          occurrenceDate,
          updatedAt
        ) {
          booking.subject = subject;
          booking.notes = notes;
          booking.videoConferenceLink = videoConferenceLink;
          booking.kioskLanguage = kioskLanguage;
          booking.requestedSeats = requestedSeats;
          booking.participants = JSON.parse(participantsJson);
          booking.externalGuests = externalGuests;
          booking.externalGuestsList = JSON.parse(externalGuestsJson);
          booking.externalGuestsDetails = JSON.parse(externalGuestsDetailsJson);
          booking.setupBufferBeforeMin = setupBufferBeforeMin;
          booking.setupBufferAfterMin = setupBufferAfterMin;
          booking.meetingAdminIds = JSON.parse(meetingAdminIdsJson);
          booking.startAt = startAt;
          booking.endAt = endAt;
          booking.effectiveStartAt = effectiveStartAt;
          booking.effectiveEndAt = effectiveEndAt;
          booking.occurrenceDate = occurrenceDate;
          booking.updatedAt = updatedAt;
        }
      };
    }
    if (/SELECT \* FROM meeting_bookings\s+WHERE multiDayGroupId = \?/.test(sql)) {
      return {
        all() {
          return [booking];
        }
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
});

const createDeps = (booking, overrides = {}) => {
  const auditEvents = [];
  const deps = {
    db: createDbStub(booking),
    requireAuth: (_req, _res, next) => next(),
    requestMeta: () => ({ ip: '127.0.0.1' }),
    writeAuditLog: (_db, entry) => auditEvents.push(entry),
    readState: () => ({ clients: [] }),
    APP_BRAND: 'Plixmap',
    meeting: {
      MEETING_ACTIVE_STATUSES: new Set(['pending', 'approved']),
      parseIsoDay: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? { value: String(value) } : null),
      parseClockTime: (value) => (/^\d{2}:\d{2}$/.test(String(value || '')) ? String(value) : null),
      toLocalTs: (_day, hm) => (hm === '10:00' ? 1_000 : hm === '11:00' ? 2_000 : 0),
      clampMeetingBuffer: (value) => Math.max(0, Number(value) || 0),
      normalizeMeetingKioskLanguage: (value) => value || null,
      getVisibleClientsForMeetings: () => [],
      listMeetingRoomsFromClients: () => [],
      mapMeetingRow: (row) => row,
      getMeetingConflicts: () => [],
      writeMeetingAuditLog: () => {},
      pendingMeetingCount: () => 0,
      notifyAdminsForMeetingRequest: () => {},
      broadcastMeetingPendingSummary: () => {},
      notifyMeetingReviewToRequester: () => {},
      sendMeetingMail: async () => ({ ok: true }),
      resolveParticipantEmails: () => ({ normalized: [], emails: [], missingEmails: [] }),
      normalizeMeetingAdminIds: (ids = [], fallback = []) => {
        const values = Array.isArray(ids) && ids.length ? ids : fallback;
        return values.map((value) => String(value));
      },
      resolvePersistedMeetingAdminIds: (ids = [], fallback = []) => {
        const values = Array.isArray(ids) && ids.length ? ids : fallback;
        return values.map((value) => String(value));
      },
      createMeetingOccurrences: () => ({ occurrences: [] }),
      meetingSummaryText: () => 'summary',
      meetingNotificationRecipientsFromBooking: () => [],
      meetingChangeSummaryText: () => ['Subject changed'],
      parseInlinePngDataUrl: () => null,
      getFollowUpRootMeetingId: () => null,
      pushMeetingDm: () => {}
    }
  };
  return { deps: { ...deps, ...overrides, meeting: { ...deps.meeting, ...(overrides.meeting || {}) } }, auditEvents };
};

const getRouteHandler = (app, method, path) => {
  const route = app.routes[method].find((entry) => entry.path === path);
  assert.ok(route, `route ${method.toUpperCase()} ${path} should exist`);
  return route.handlers[route.handlers.length - 1];
};

test('meeting lifecycle update rejects missing participant emails when notifications are enabled', async () => {
  const app = createAppStub();
  const booking = createBooking({ sendEmail: true });
  const { deps } = createDeps(booking, {
    meeting: {
      resolveParticipantEmails: () => ({
        normalized: [{ kind: 'real_user', email: null }],
        emails: [],
        missingEmails: ['Mario Rossi']
      })
    }
  });
  registerMeetingLifecycleRoutes(app, deps);

  const handler = getRouteHandler(app, 'put', '/api/meetings/:id');
  const req = {
    params: { id: 'm1' },
    body: { subject: 'Updated', day: '2026-03-10', startTime: '10:00', endTime: '11:00' },
    userId: 'u1',
    username: 'mario',
    isAdmin: false,
    isSuperAdmin: false
  };
  const res = createRes();

  await handler(req, res);

  assert.equal(res.code, 400);
  assert.deepEqual(res.payload, {
    error: 'Missing participant emails',
    missingEmails: ['Mario Rossi']
  });
});

test('meeting lifecycle cancel writes a global audit event', () => {
  const app = createAppStub();
  const booking = createBooking();
  const { deps, auditEvents } = createDeps(booking);
  registerMeetingLifecycleRoutes(app, deps);

  const handler = getRouteHandler(app, 'post', '/api/meetings/:id/cancel');
  const req = {
    params: { id: 'm1' },
    userId: 'u1',
    username: 'mario',
    isAdmin: false,
    isSuperAdmin: false
  };
  const res = createRes();

  handler(req, res);

  assert.equal(res.code, 200);
  assert.equal(booking.status, 'cancelled');
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].event, 'meeting_cancelled');
  assert.equal(auditEvents[0].scopeId, 'm1');
});

test('meeting lifecycle update writes a global audit event on success', async () => {
  const app = createAppStub();
  const booking = createBooking();
  const { deps, auditEvents } = createDeps(booking, {
    meeting: {
      resolveParticipantEmails: () => ({
        normalized: [{ kind: 'real_user', email: 'mario@example.com', remote: false }],
        emails: ['mario@example.com'],
        missingEmails: []
      })
    }
  });
  registerMeetingLifecycleRoutes(app, deps);

  const handler = getRouteHandler(app, 'put', '/api/meetings/:id');
  const req = {
    params: { id: 'm1' },
    body: { subject: 'Updated', day: '2026-03-10', startTime: '10:00', endTime: '11:00' },
    userId: 'u1',
    username: 'mario',
    isAdmin: false,
    isSuperAdmin: false
  };
  const res = createRes();

  await handler(req, res);

  assert.equal(res.code, 200);
  assert.equal(res.payload?.ok, true);
  assert.equal(booking.subject, 'Updated');
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].event, 'meeting_updated');
  assert.deepEqual(auditEvents[0].details, {
    applyToSeries: false,
    updatedCount: 1,
    bookingIds: ['m1']
  });
});
