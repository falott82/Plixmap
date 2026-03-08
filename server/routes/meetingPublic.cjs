const express = require('express');

const buildKioskManifest = (roomId) => {
  const safeRoomId = encodeURIComponent(String(roomId || 'unknown'));
  return {
    name: 'Plixmap Kiosk',
    short_name: 'Plixmap Kiosk',
    description: 'Plixmap meeting room kiosk mode',
    start_url: `/meetingroom/${safeRoomId}`,
    scope: '/meetingroom/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    lang: 'en',
    icons: [{ src: '/plixmap-logo.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }]
  };
};

const buildMobileManifest = () => ({
  name: 'Plixmap Mobile',
  short_name: 'Plixmap Mobile',
  description: 'Plixmap mobile web app',
  start_url: '/mobile',
  scope: '/mobile',
  display: 'standalone',
  background_color: '#020617',
  theme_color: '#020617',
  lang: 'en',
  icons: [{ src: '/plixmap-logo.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }]
});

const registerMeetingPublicRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    readState,
    serverLog,
    buildKioskPublicUrl,
    buildMobilePublicUrl,
    buildKioskPublicUploadUrl,
    meeting
  } = deps;
  const {
    dayRangeFromIso,
    parseIsoDay,
    parseClockTime,
    toLocalTs,
    clampMeetingBuffer,
    getVisibleClientsForMeetings,
    listMeetingRoomsFromClients,
    mapMeetingRow,
    getMeetingCheckInMap,
    getMeetingCheckInMapByMeetingIds,
    getMeetingCheckInTimestampsByMeetingIds,
    buildCheckInKeyForRealParticipant,
    resolveLinkedRealUserForPortalUser,
    findMeetingParticipantForLinkedUser,
    sendMeetingMail
  } = meeting;

  const toLocalIsoDay = (ts) => {
    const d = new Date(Number(ts || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const collectMeetingDaysInRange = (startAt, endAt, rangeStart, rangeEnd) => {
    const safeStart = Math.max(Number(startAt || 0), Number(rangeStart || 0));
    const safeEnd = Math.min(Number(endAt || 0), Number(rangeEnd || 0));
    if (!(safeEnd > safeStart)) return [];
    const first = new Date(safeStart);
    const last = new Date(Math.max(safeStart, safeEnd - 1));
    let cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0, 0).getTime();
    const lastDayStart = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 0, 0, 0, 0).getTime();
    const days = [];
    while (cursor <= lastDayStart) {
      days.push(toLocalIsoDay(cursor));
      cursor += 24 * 60 * 60 * 1000;
    }
    return days;
  };

  app.get('/api/meetings/overview', requireAuth, (req, res) => {
    const state = readState();
    const visibleClients = getVisibleClientsForMeetings(req, state);
    const clientId = String(req.query.clientId || '').trim();
    const siteId = String(req.query.siteId || '').trim();
    const floorPlanId = String(req.query.floorPlanId || '').trim();
    const dayRaw = String(req.query.day || '').trim();
    const includeNonMeeting = String(req.query.includeNonMeeting || '') === '1';
    if (!siteId) {
      res.status(400).json({ error: 'Missing siteId' });
      return;
    }
    const roomRows = listMeetingRoomsFromClients(visibleClients, {
      clientId: clientId || undefined,
      siteId,
      floorPlanId: floorPlanId || undefined,
      includeNonMeeting
    });
    if (!roomRows.length) {
      const dayRangeEmpty = dayRaw ? dayRangeFromIso(dayRaw) : null;
      const startOfDayEmpty = dayRangeEmpty ? dayRangeEmpty.start : new Date(new Date().setHours(0, 0, 0, 0)).getTime();
      const startClockEmpty = parseClockTime(req.query.startTime);
      const endClockEmpty = parseClockTime(req.query.endTime);
      const beforeMinEmpty = clampMeetingBuffer(req.query.setupBufferBeforeMin);
      const afterMinEmpty = clampMeetingBuffer(req.query.setupBufferAfterMin);
      res.json({
        rooms: [],
        checkInStatusByMeetingId: {},
        checkInTimestampsByMeetingId: {},
        meta: {
          day: dayRangeEmpty ? dayRangeEmpty.day : new Date(startOfDayEmpty).toISOString().slice(0, 10),
          siteId,
          floorPlanId: floorPlanId || null,
          slot:
            startClockEmpty && endClockEmpty
              ? {
                  startTime: startClockEmpty.value,
                  endTime: endClockEmpty.value,
                  setupBufferBeforeMin: beforeMinEmpty,
                  setupBufferAfterMin: afterMinEmpty
                }
              : null
        }
      });
      return;
    }
    const dayRange = dayRaw ? dayRangeFromIso(dayRaw) : null;
    const now = Date.now();
    const startOfDay = dayRange ? dayRange.start : new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const endOfDay = dayRange ? dayRange.end : startOfDay + 24 * 60 * 60 * 1000;
    const bookings = db
      .prepare(
        `SELECT * FROM meeting_bookings
         WHERE siteId = ?
           AND status IN ('pending','approved')
           AND effectiveStartAt < ?
           AND effectiveEndAt > ?
         ORDER BY startAt ASC`
      )
      .all(siteId, endOfDay, startOfDay)
      .map(mapMeetingRow)
      .filter(Boolean);
    const byRoom = new Map();
    for (const booking of bookings) {
      const rid = String(booking.roomId || '');
      const list = byRoom.get(rid) || [];
      list.push(booking);
      byRoom.set(rid, list);
    }
    const startClock = parseClockTime(req.query.startTime);
    const endClock = parseClockTime(req.query.endTime);
    const beforeMin = clampMeetingBuffer(req.query.setupBufferBeforeMin);
    const afterMin = clampMeetingBuffer(req.query.setupBufferAfterMin);
    const dayForSlot = dayRange ? parseIsoDay(dayRange.day) : parseIsoDay(new Date().toISOString().slice(0, 10));
    const hasSlot = !!(dayForSlot && startClock && endClock);
    const slotStartAt = hasSlot ? toLocalTs(dayForSlot, startClock) : null;
    const slotEndAt = hasSlot ? toLocalTs(dayForSlot, endClock) : null;
    const slotEffectiveStart = hasSlot ? Number(slotStartAt) - beforeMin * 60_000 : null;
    const slotEffectiveEnd = hasSlot ? Number(slotEndAt) + afterMin * 60_000 : null;
    const rooms = roomRows.map((room) => {
      const entries = byRoom.get(room.roomId) || [];
      const inProgress = entries.some((row) => Number(row.startAt) <= now && Number(row.endAt) > now);
      const hasToday = entries.length > 0;
      const slotConflicts =
        hasSlot && Number(slotEffectiveEnd) > Number(slotEffectiveStart)
          ? entries.filter((row) => Number(row.effectiveStartAt) < Number(slotEffectiveEnd) && Number(row.effectiveEndAt) > Number(slotEffectiveStart))
          : [];
      return {
        ...room,
        hasMeetingToday: hasToday,
        inProgress,
        bookings: entries,
        slotConflicts
      };
    });
    const checkInStatusByMeetingId = getMeetingCheckInMapByMeetingIds(bookings.map((booking) => booking.id));
    const checkInTimestampsByMeetingId = getMeetingCheckInTimestampsByMeetingIds(bookings.map((booking) => booking.id));
    res.json({
      rooms,
      checkInStatusByMeetingId,
      checkInTimestampsByMeetingId,
      meta: {
        day: dayRange ? dayRange.day : new Date(startOfDay).toISOString().slice(0, 10),
        siteId,
        floorPlanId: floorPlanId || null,
        slot: hasSlot
          ? {
              startTime: startClock.value,
              endTime: endClock.value,
              setupBufferBeforeMin: beforeMin,
              setupBufferAfterMin: afterMin
            }
          : null
      }
    });
  });

  app.get('/api/mobile/agenda', requireAuth, (req, res) => {
    const t0 = Number(process.hrtime.bigint()) / 1e6;
    const stage = {
      parseDayMs: 0,
      resolveLinkedMs: 0,
      readStateMs: 0,
      visibleClientsMs: 0,
      roomLookupMs: 0,
      queryMs: 0,
      mapMs: 0,
      checkinMs: 0
    };
    const day = String(req.query.day || '').trim() || new Date().toISOString().slice(0, 10);
    const tParseStart = Number(process.hrtime.bigint()) / 1e6;
    const parsedDay = parseIsoDay(day);
    stage.parseDayMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tParseStart);
    if (!parsedDay) {
      res.status(400).json({ error: 'Invalid day' });
      return;
    }
    const tLinkedStart = Number(process.hrtime.bigint()) / 1e6;
    const linked = resolveLinkedRealUserForPortalUser(req.userId);
    stage.resolveLinkedMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tLinkedStart);
    if (!linked?.clientId || (!linked?.externalId && !linked?.portalEmail && !linked?.importedEmail)) {
      res.status(400).json({ error: 'Portal user is not linked to an imported user' });
      return;
    }
    const dayStart = new Date(parsedDay.year, parsedDay.month - 1, parsedDay.day, 0, 0, 0, 0).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const tStateStart = Number(process.hrtime.bigint()) / 1e6;
    const state = readState();
    stage.readStateMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tStateStart);
    const tVisibleStart = Number(process.hrtime.bigint()) / 1e6;
    const visibleClients = getVisibleClientsForMeetings(req, state);
    stage.visibleClientsMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tVisibleStart);
    const tRoomStart = Number(process.hrtime.bigint()) / 1e6;
    const roomLookup = new Map(
      listMeetingRoomsFromClients(visibleClients, {
        includeNonMeeting: true,
        clientId: String(linked.clientId || ''),
        metadataOnly: true
      }).map((room) => [String(room.roomId), room])
    );
    stage.roomLookupMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tRoomStart);
    const tQueryStart = Number(process.hrtime.bigint()) / 1e6;
    const bookingRows = db
      .prepare(
        `SELECT * FROM meeting_bookings
         WHERE clientId = ?
           AND status IN ('pending','approved')
           AND endAt > ?
           AND startAt < ?
         ORDER BY startAt ASC`
      )
      .all(String(linked.clientId), dayStart, dayEnd);
    stage.queryMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tQueryStart);
    const tMapStart = Number(process.hrtime.bigint()) / 1e6;
    const meetings = bookingRows
      .map(mapMeetingRow)
      .filter(Boolean)
      .filter((booking) => roomLookup.has(String(booking.roomId || '')))
      .map((booking) => {
        const participant = findMeetingParticipantForLinkedUser(booking, linked);
        if (!participant) return null;
        const roomMeta = roomLookup.get(String(booking.roomId || '')) || {};
        return {
          ...booking,
          clientName: String(roomMeta.clientName || ''),
          siteName: String(roomMeta.siteName || ''),
          floorPlanName: String(roomMeta.floorPlanName || ''),
          participantMatch: {
            kind: 'real_user',
            externalId: String(participant?.externalId || linked.externalId || ''),
            fullName: String(participant?.fullName || linked.fullName || ''),
            email: String(participant?.email || linked.importedEmail || linked.portalEmail || ''),
            optional: !!participant?.optional,
            remote: !!participant?.remote
          }
        };
      })
      .filter(Boolean);
    stage.mapMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tMapStart);
    const ids = meetings.map((meetingRow) => meetingRow.id);
    const tCheckinStart = Number(process.hrtime.bigint()) / 1e6;
    const checkInStatusByMeetingId = getMeetingCheckInMapByMeetingIds(ids);
    const checkInTimestampsByMeetingId = getMeetingCheckInTimestampsByMeetingIds(ids);
    stage.checkinMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - tCheckinStart);
    const totalMs = Math.max(0, (Number(process.hrtime.bigint()) / 1e6) - t0);
    const timingsMs = {
      total: Math.round(totalMs),
      parseDay: Math.round(stage.parseDayMs),
      resolveLinked: Math.round(stage.resolveLinkedMs),
      readState: Math.round(stage.readStateMs),
      visibleClients: Math.round(stage.visibleClientsMs),
      roomLookup: Math.round(stage.roomLookupMs),
      query: Math.round(stage.queryMs),
      map: Math.round(stage.mapMs),
      checkIn: Math.round(stage.checkinMs)
    };
    if (timingsMs.total >= 800) {
      serverLog('warn', 'mobile_agenda_slow', {
        userId: req.userId,
        username: req.username,
        day,
        clientId: String(linked.clientId || ''),
        timingsMs
      });
    }
    res.setHeader('X-Mobile-Agenda-Timings', JSON.stringify(timingsMs));
    res.json({
      ok: true,
      day,
      mobilePublicUrl: buildMobilePublicUrl(req),
      linkedUser: {
        clientId: linked.clientId,
        externalId: linked.externalId || '',
        fullName: linked.fullName || '',
        portalEmail: linked.portalEmail || '',
        importedEmail: linked.importedEmail || ''
      },
      meetings,
      checkInStatusByMeetingId,
      checkInTimestampsByMeetingId,
      perf: timingsMs
    });
  });

  app.get('/api/mobile/agenda-month', requireAuth, (req, res) => {
    const monthRaw = String(req.query.month || '').trim();
    const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthRaw);
    if (!monthMatch) {
      res.status(400).json({ error: 'Invalid month' });
      return;
    }
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'Invalid month' });
      return;
    }
    const linked = resolveLinkedRealUserForPortalUser(req.userId);
    if (!linked?.clientId || (!linked?.externalId && !linked?.portalEmail && !linked?.importedEmail)) {
      res.status(400).json({ error: 'Portal user is not linked to an imported user' });
      return;
    }
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
    const monthEnd = new Date(year, month, 1, 0, 0, 0, 0).getTime();
    const state = readState();
    const visibleClients = getVisibleClientsForMeetings(req, state);
    const roomLookup = new Map(
      listMeetingRoomsFromClients(visibleClients, {
        includeNonMeeting: true,
        clientId: String(linked.clientId || ''),
        metadataOnly: true
      }).map((room) => [String(room.roomId), room])
    );
    const meetings = db
      .prepare(
        `SELECT * FROM meeting_bookings
         WHERE clientId = ?
           AND status IN ('pending','approved')
           AND endAt > ?
           AND startAt < ?
         ORDER BY startAt ASC`
      )
      .all(String(linked.clientId), monthStart, monthEnd)
      .map(mapMeetingRow)
      .filter(Boolean)
      .filter((booking) => roomLookup.has(String(booking.roomId || '')))
      .filter((booking) => !!findMeetingParticipantForLinkedUser(booking, linked));
    const days = {};
    for (const booking of meetings) {
      const meetingDays = collectMeetingDaysInRange(booking.startAt, booking.endAt, monthStart, monthEnd);
      for (const dayKey of meetingDays) {
        days[dayKey] = Number(days[dayKey] || 0) + 1;
      }
    }
    res.json({
      ok: true,
      month: monthRaw,
      linkedUser: {
        clientId: linked.clientId,
        externalId: linked.externalId || '',
        fullName: linked.fullName || '',
        portalEmail: linked.portalEmail || '',
        importedEmail: linked.importedEmail || ''
      },
      days
    });
  });

  app.post('/api/mobile/checkin', requireAuth, express.json({ limit: '64kb' }), (req, res) => {
    const meetingId = String(req.body?.meetingId || '').trim();
    const checked = req.body?.checked === undefined ? true : !!req.body?.checked;
    if (!meetingId) {
      res.status(400).json({ error: 'Missing meetingId' });
      return;
    }
    const linked = resolveLinkedRealUserForPortalUser(req.userId);
    if (!linked?.clientId || (!linked?.externalId && !linked?.portalEmail && !linked?.importedEmail)) {
      res.status(400).json({ error: 'Portal user is not linked to an imported user' });
      return;
    }
    const booking = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ? LIMIT 1').get(meetingId));
    if (!booking) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    if (String(booking.clientId || '') !== String(linked.clientId || '')) {
      res.status(403).json({ error: 'Meeting not available for this user' });
      return;
    }
    if (!['approved', 'pending'].includes(String(booking.status || ''))) {
      res.status(409).json({ error: 'Meeting not active' });
      return;
    }
    const participant = findMeetingParticipantForLinkedUser(booking, linked);
    if (!participant) {
      res.status(403).json({ error: 'User is not a participant of this meeting' });
      return;
    }
    if (participant?.remote) {
      res.status(409).json({ error: 'Remote participants are considered already present' });
      return;
    }
    const now = Date.now();
    if (!(Number(booking.startAt) <= now && now < Number(booking.endAt))) {
      res.status(409).json({ error: 'Check-in available only during the meeting' });
      return;
    }
    const key = buildCheckInKeyForRealParticipant(participant);
    if (checked) {
      db.prepare(
        `INSERT INTO meeting_checkins (meetingId, entryKey, checked, updatedAt)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(meetingId, entryKey) DO UPDATE SET checked = excluded.checked, updatedAt = excluded.updatedAt`
      ).run(meetingId, key, now);
    } else {
      db.prepare('DELETE FROM meeting_checkins WHERE meetingId = ? AND entryKey = ?').run(meetingId, key);
    }
    res.json({
      ok: true,
      meetingId,
      checked,
      roomId: String(booking.roomId || ''),
      participantName: String(participant?.fullName || linked.fullName || req.username || 'Utente'),
      key,
      checkInMap: getMeetingCheckInMap(meetingId),
      checkInTimestamps: getMeetingCheckInTimestampsByMeetingIds([meetingId])[meetingId] || {}
    });
  });

  app.get('/manifest-kiosk/:roomId.webmanifest', (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildKioskManifest(roomId));
  });

  app.get('/manifest-mobile.webmanifest', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildMobileManifest());
  });

  app.get('/api/meeting-room/:roomId/schedule', (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    if (!roomId) {
      res.status(400).json({ error: 'Missing roomId' });
      return;
    }
    const state = readState();
    const rooms = listMeetingRoomsFromClients(state.clients || [], { includeNonMeeting: true });
    const room = rooms.find((entry) => entry.roomId === roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const publicRoom = {
      ...room,
      clientLogoUrl: buildKioskPublicUploadUrl(req, room.clientLogoUrl) || null,
      businessPartners: Array.isArray(room.businessPartners)
        ? room.businessPartners.map((bp) => ({
            ...bp,
            logoUrl: buildKioskPublicUploadUrl(req, bp.logoUrl) || null
          }))
        : []
    };
    const now = Date.now();
    const start = now - 12 * 60 * 60 * 1000;
    const end = now + 7 * 24 * 60 * 60 * 1000;
    const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
    const rows = db
      .prepare(
        `SELECT * FROM meeting_bookings
         WHERE roomId = ?
           AND status IN ('pending','approved')
           AND effectiveStartAt < ?
           AND effectiveEndAt > ?
         ORDER BY startAt ASC`
      )
      .all(roomId, end, start)
      .map(mapMeetingRow)
      .filter(Boolean);
    const inProgress = rows.find((row) => Number(row.startAt) <= now && Number(row.endAt) > now) || null;
    const upcoming = rows.filter((row) => Number(row.startAt) > now).slice(0, 20);
    const daySchedule = rows
      .filter((row) => Number(row.endAt) > startOfToday && Number(row.startAt) < endOfToday)
      .sort((a, b) => Number(a.startAt) - Number(b.startAt));
    const checkInStatusByMeetingId = getMeetingCheckInMapByMeetingIds(rows.map((row) => row.id));
    const checkInTimestampsByMeetingId = getMeetingCheckInTimestampsByMeetingIds(rows.map((row) => row.id));
    res.json({
      room: publicRoom,
      now,
      inProgress,
      upcoming,
      daySchedule,
      checkInStatusByMeetingId,
      checkInTimestampsByMeetingId,
      kioskPublicUrl: buildKioskPublicUrl(req, roomId),
      mobilePublicUrl: buildMobilePublicUrl(req, roomId)
    });
  });

  app.post('/api/meeting-room/:roomId/checkin-toggle', express.json({ limit: '256kb' }), (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    const meetingId = String(req.body?.meetingId || '').trim();
    const key = String(req.body?.key || '').trim();
    const checked = !!req.body?.checked;
    if (!roomId || !meetingId || !key) {
      res.status(400).json({ error: 'Missing check-in parameters' });
      return;
    }
    const booking = db
      .prepare('SELECT id, roomId, status, startAt, endAt FROM meeting_bookings WHERE id = ? LIMIT 1')
      .get(meetingId);
    if (!booking || String(booking.roomId || '') !== roomId) {
      res.status(404).json({ error: 'Meeting not found for room' });
      return;
    }
    if (!['approved', 'pending'].includes(String(booking.status || ''))) {
      res.status(409).json({ error: 'Meeting not active for check-in' });
      return;
    }
    const now = Date.now();
    if (checked) {
      db.prepare(
        `INSERT INTO meeting_checkins (meetingId, entryKey, checked, updatedAt)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(meetingId, entryKey) DO UPDATE SET checked = excluded.checked, updatedAt = excluded.updatedAt`
      ).run(meetingId, key, now);
    } else {
      db.prepare('DELETE FROM meeting_checkins WHERE meetingId = ? AND entryKey = ?').run(meetingId, key);
    }
    res.json({
      ok: true,
      meetingId,
      checkInMap: getMeetingCheckInMap(meetingId),
      checkInTimestamps: getMeetingCheckInTimestampsByMeetingIds([meetingId])[meetingId] || {}
    });
  });

  app.post('/api/meeting-room/:roomId/help-request', express.json({ limit: '64kb' }), async (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    const service = String(req.body?.service || '').trim().toLowerCase();
    if (!roomId || !['it', 'cleaning', 'coffee'].includes(service)) {
      res.status(400).json({ error: 'Invalid help request' });
      return;
    }
    const state = readState();
    const rooms = listMeetingRoomsFromClients(state.clients || [], { includeNonMeeting: true });
    const room = rooms.find((entry) => entry.roomId === roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const support = room.siteSupportContacts || {};
    const target = service === 'it' ? support.it : service === 'cleaning' ? support.cleaning : support.coffee;
    const recipient = String(target?.email || '').trim();
    if (!recipient) {
      res.status(400).json({ error: 'Support email not configured' });
      return;
    }
    const serviceLabel = service === 'it' ? 'IT Service' : service === 'cleaning' ? 'Cleaning Service' : 'Coffee Service';
    const roomName = String(room.roomName || roomId);
    const locationPath = [room.clientName, room.siteName, room.floorPlanName].filter(Boolean).join(' -> ');
    const helpMailResult = await sendMeetingMail({
      recipients: [recipient],
      subject: `Need ${serviceLabel} room ${roomName}`,
      text: [
        `Need ${serviceLabel} room ${roomName}`,
        locationPath ? `Location: ${locationPath}` : null,
        `Requested at: ${new Date().toLocaleString()}`,
        'Source: Kiosk mode'
      ]
        .filter(Boolean)
        .join('\n'),
      clientId: room.clientId,
      actorUserId: null,
      actorUsername: 'kiosk',
      details: { kind: 'meeting_room_help_request', roomId, service }
    });
    if (!helpMailResult?.ok) {
      if (helpMailResult?.reason === 'smtp_client_not_configured' || helpMailResult?.reason === 'smtp_client_missing_password') {
        const clientLabel = String(helpMailResult?.clientName || room.clientName || room.clientId || 'cliente');
        res.status(400).json({
          error:
            helpMailResult?.reason === 'smtp_client_missing_password'
              ? `SMTP non completato per il cliente ${clientLabel} (password mancante).`
              : `SMTP non configurato per il cliente ${clientLabel}.`
        });
        return;
      }
      res.status(500).json({ error: 'Failed to send help request', detail: helpMailResult?.reason || null });
      return;
    }
    res.json({ ok: true, service });
  });
};

module.exports = {
  buildKioskManifest,
  buildMobileManifest,
  registerMeetingPublicRoutes
};
