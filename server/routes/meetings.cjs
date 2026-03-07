const crypto = require('crypto');
const express = require('express');

const registerMeetingRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    readState,
    serverLog,
    aiDailyUsageByScope,
    APP_BRAND,
    buildKioskPublicUrl,
    buildMobilePublicUrl,
    buildKioskPublicUploadUrl,
    meeting
  } = deps;
  const {
    MEETING_ACTIVE_STATUSES,
    safeJsonParse,
    dayRangeFromIso,
    parseIsoDay,
    parseClockTime,
    toLocalTs,
    clampMeetingBuffer,
    normalizeMeetingKioskLanguage,
    getVisibleClientsForMeetings,
    listMeetingRoomsFromClients,
    mapMeetingRow,
    getMeetingConflicts,
    writeMeetingAuditLog,
    pendingMeetingCount,
    notifyAdminsForMeetingRequest,
    broadcastMeetingPendingSummary,
    notifyMeetingReviewToRequester,
    sendMeetingMail,
    resolveParticipantEmails,
    normalizeMeetingAdminIds,
    createMeetingOccurrences,
    meetingSummaryText,
    meetingNotificationRecipientsFromBooking,
    meetingChangeSummaryText,
    parseInlinePngDataUrl,
    getMeetingCheckInMap,
    getMeetingCheckInMapByMeetingIds,
    getMeetingCheckInTimestampsByMeetingIds,
    buildCheckInKeyForRealParticipant,
    resolveLinkedRealUserForPortalUser,
    findMeetingParticipantForLinkedUser,
    mapMeetingNoteRow,
    getAccessibleMeetingBookingForUser,
    isMeetingParticipantForRequestUser,
    participantRosterFromMeetingBooking,
    participantKeysFromMeetingNote,
    canEditMeetingManagerFieldsForUser,
    sanitizeMeetingManagerActions,
    getMeetingManagerFields,
    getFollowUpRootMeetingId,
    getMeetingFollowUpChainMeetingIds,
    getMeetingFollowUpChain,
    pushMeetingDm
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
      const endOfDayEmpty = dayRangeEmpty ? dayRangeEmpty.end : startOfDayEmpty + 24 * 60 * 60 * 1000;
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
    const checkInStatusByMeetingId = getMeetingCheckInMapByMeetingIds(bookings.map((b) => b.id));
    const checkInTimestampsByMeetingId = getMeetingCheckInTimestampsByMeetingIds(bookings.map((b) => b.id));
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
    const ids = meetings.map((m) => m.id);
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

  app.get('/api/meetings', requireAuth, (req, res) => {
    const state = readState();
    const visibleClients = getVisibleClientsForMeetings(req, state);
    const visibleRoomIds = new Set(listMeetingRoomsFromClients(visibleClients, { includeNonMeeting: true }).map((room) => room.roomId));
    const siteId = String(req.query.siteId || '').trim();
    const roomId = String(req.query.roomId || '').trim();
    const statusCsv = String(req.query.status || '').trim();
    const fromAt = Number(req.query.fromAt);
    const toAt = Number(req.query.toAt);
    const where = [];
    const params = [];
    if (siteId) {
      where.push('siteId = ?');
      params.push(siteId);
    }
    if (roomId) {
      where.push('roomId = ?');
      params.push(roomId);
    }
    if (Number.isFinite(fromAt)) {
      where.push('effectiveEndAt >= ?');
      params.push(Math.floor(fromAt));
    }
    if (Number.isFinite(toAt)) {
      where.push('effectiveStartAt <= ?');
      params.push(Math.floor(toAt));
    }
    if (statusCsv) {
      const requested = statusCsv
        .split(',')
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => ['pending', 'approved', 'rejected', 'cancelled'].includes(v));
      if (requested.length) {
        where.push(`status IN (${requested.map(() => '?').join(',')})`);
        params.push(...requested);
      }
    }
    const sql = `SELECT * FROM meeting_bookings ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY startAt ASC LIMIT 1500`;
    const rows = db.prepare(sql).all(...params).map(mapMeetingRow).filter(Boolean);
    const visibleRows = req.isAdmin || req.isSuperAdmin ? rows : rows.filter((row) => visibleRoomIds.has(String(row.roomId || '')));
    res.json({ meetings: visibleRows });
  });

  app.get('/api/meetings/mine', requireAuth, (req, res) => {
    const state = readState();
    const visibleClients = getVisibleClientsForMeetings(req, state);
    const visibleRoomIds = new Set(listMeetingRoomsFromClients(visibleClients, { includeNonMeeting: true }).map((room) => String(room.roomId || '')));
    const isAdminLike = !!req.isAdmin || !!req.isSuperAdmin;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(20, Math.min(4000, Math.floor(limitRaw))) : 1500;
    const fromAtRaw = Number(req.query.fromAt);
    const toAtRaw = Number(req.query.toAt);
    const fromAt = Number.isFinite(fromAtRaw) ? Math.floor(fromAtRaw) : null;
    const toAt = Number.isFinite(toAtRaw) ? Math.floor(toAtRaw) : null;
    const linked = resolveLinkedRealUserForPortalUser(req.userId);
    const where = [];
    const params = [];
    if (fromAt !== null) {
      where.push('effectiveEndAt >= ?');
      params.push(fromAt);
    }
    if (toAt !== null) {
      where.push('effectiveStartAt <= ?');
      params.push(toAt);
    }
    const sql = `SELECT * FROM meeting_bookings ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY startAt ASC LIMIT ?`;
    const rows = db.prepare(sql).all(...params, limit).map(mapMeetingRow).filter(Boolean);
    const visibleRows = isAdminLike ? rows : rows.filter((row) => visibleRoomIds.has(String(row.roomId || '')));
    const scopedRows = visibleRows.filter((row) => {
      const startAt = Number(row?.startAt || 0);
      const endAt = Number(row?.endAt || 0);
      if (isAdminLike) return true;
      if (fromAt !== null && endAt > 0 && endAt < fromAt) return false;
      if (toAt !== null && startAt > toAt) return false;
      if (String(row?.requestedById || '') === String(req.userId || '')) return true;
      if (Array.isArray(row?.meetingAdminIds) && row.meetingAdminIds.includes(String(req.userId || ''))) return true;
      if (!linked) return false;
      return !!findMeetingParticipantForLinkedUser(row, linked);
    });
    const now = Date.now();
    const inProgress = scopedRows.filter((row) => Number(row.startAt || 0) <= now && now < Number(row.endAt || 0));
    const upcoming = scopedRows.filter((row) => Number(row.startAt || 0) > now);
    const past = scopedRows.filter((row) => Number(row.endAt || 0) <= now);
    res.json({
      meetings: scopedRows,
      now,
      counts: {
        total: scopedRows.length,
        inProgress: inProgress.length,
        upcoming: upcoming.length,
        past: past.length
      }
    });
  });

  app.get('/api/meetings/pending', requireAuth, (req, res) => {
    if (!req.isAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const rows = db
      .prepare("SELECT * FROM meeting_bookings WHERE status = 'pending' ORDER BY requestedAt ASC LIMIT 500")
      .all()
      .map(mapMeetingRow)
      .filter(Boolean);
    res.json({ pending: rows, pendingCount: rows.length });
  });

  app.get('/api/meetings/log', requireAuth, (req, res) => {
    if (!req.isAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const q = String(req.query.q || '').trim().toLowerCase();
    const format = String(req.query.format || '').trim().toLowerCase();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, Math.floor(limitRaw))) : 400;
    const rows = db
      .prepare(
        `SELECT l.id, l.bookingId, l.event, l.actorUserId, l.actorUsername, l.detailsJson, l.ts, b.subject, b.roomName, b.status
         FROM meeting_audit_log l
         LEFT JOIN meeting_bookings b ON b.id = l.bookingId
         ORDER BY l.ts DESC
         LIMIT ?`
      )
      .all(limit)
      .map((row) => ({
        id: Number(row.id) || 0,
        bookingId: String(row.bookingId || ''),
        event: String(row.event || ''),
        actorUserId: row.actorUserId ? String(row.actorUserId) : null,
        actorUsername: row.actorUsername ? String(row.actorUsername) : null,
        ts: Number(row.ts) || 0,
        subject: String(row.subject || ''),
        roomName: String(row.roomName || ''),
        bookingStatus: String(row.status || ''),
        details: safeJsonParse(row.detailsJson || '{}', {})
      }))
      .filter((row) => {
        if (!q) return true;
        return (
          row.bookingId.toLowerCase().includes(q) ||
          row.event.toLowerCase().includes(q) ||
          row.subject.toLowerCase().includes(q) ||
          row.roomName.toLowerCase().includes(q) ||
          String(row.actorUsername || '').toLowerCase().includes(q)
        );
      });
    if (format === 'csv') {
      const esc = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
      const lines = [
        'id,bookingId,event,actorUsername,subject,roomName,bookingStatus,timestamp',
        ...rows.map((row) =>
          [
            row.id,
            esc(row.bookingId),
            esc(row.event),
            esc(row.actorUsername || ''),
            esc(row.subject || ''),
            esc(row.roomName || ''),
            esc(row.bookingStatus || ''),
            row.ts
          ].join(',')
        )
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="plixmap-meeting-log-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(lines.join('\n'));
      return;
    }
    res.json({ rows, total: rows.length });
  });

  app.get('/api/meetings/:id/notes', requireAuth, (req, res) => {
    const meetingId = String(req.params.id || '').trim();
    if (!meetingId) {
      res.status(400).json({ error: 'Missing meeting id' });
      return;
    }
    const booking = getAccessibleMeetingBookingForUser(req, meetingId);
    if (!booking) {
      res.status(404).json({ error: 'Meeting not found or not accessible' });
      return;
    }
    const isParticipant = isMeetingParticipantForRequestUser(req, booking);
    const canEditManagerFields = canEditMeetingManagerFieldsForUser(req, booking);
    if (!isParticipant && !canEditManagerFields) {
      res.status(403).json({ error: 'Only participants or meeting managers can access meeting notes' });
      return;
    }
    const rows = db
      .prepare(
        `SELECT id, meetingId, authorUserId, authorUsername, authorExternalId, authorEmail, authorDisplayName, title, contentText, contentHtml, contentLexical, shared, createdAt, updatedAt
         FROM meeting_notes
         WHERE meetingId = ?
         ORDER BY updatedAt DESC, createdAt DESC`
      )
      .all(meetingId)
      .map(mapMeetingNoteRow)
      .filter(Boolean);
    const visibleNotes = req.isAdmin || req.isSuperAdmin ? rows : rows.filter((row) => row.authorUserId === String(req.userId) || row.shared);
    const participants = participantRosterFromMeetingBooking(booking);
    const byKey = new Map(participants.map((p) => [String(p.key), p]));
    for (const note of rows.filter((row) => row.shared)) {
      const keys = participantKeysFromMeetingNote(note);
      for (const key of keys) {
        const row = byKey.get(String(key));
        if (!row) continue;
        row.sharedCount = Math.max(0, Number(row.sharedCount || 0)) + 1;
        row.hasShared = true;
      }
    }
    const followUpChain = getMeetingFollowUpChain(req, booking);
    const followUpMeetingIds = followUpChain.map((entry) => String(entry?.meeting?.id || '').trim()).filter(Boolean);
    const checkInStatusByMeetingId = followUpMeetingIds.length ? getMeetingCheckInMapByMeetingIds(followUpMeetingIds) : {};
    const checkInTimestampsByMeetingId = followUpMeetingIds.length ? getMeetingCheckInTimestampsByMeetingIds(followUpMeetingIds) : {};
    res.json({
      ok: true,
      meetingId,
      meeting: booking,
      notes: visibleNotes,
      participants,
      canManageMeeting: canEditManagerFields,
      managerFields: getMeetingManagerFields(meetingId),
      followUpChain,
      checkInStatusByMeetingId,
      checkInTimestampsByMeetingId
    });
  });

  app.get('/api/meetings/:id/manager-fields', requireAuth, (req, res) => {
    const meetingId = String(req.params.id || '').trim();
    if (!meetingId) {
      res.status(400).json({ error: 'Missing meeting id' });
      return;
    }
    const booking = getAccessibleMeetingBookingForUser(req, meetingId);
    if (!booking) {
      res.status(404).json({ error: 'Meeting not found or not accessible' });
      return;
    }
    const canEditManagerFields = canEditMeetingManagerFieldsForUser(req, booking);
    const isParticipant = isMeetingParticipantForRequestUser(req, booking);
    if (!isParticipant && !canEditManagerFields) {
      res.status(403).json({ error: 'Only participants or meeting managers can access manager fields' });
      return;
    }
    res.json({
      ok: true,
      meetingId,
      managerFields: getMeetingManagerFields(meetingId),
      canManageMeeting: canEditManagerFields
    });
  });

  app.put('/api/meetings/:id/manager-fields', requireAuth, express.json({ limit: '256kb' }), (req, res) => {
    const meetingId = String(req.params.id || '').trim();
    if (!meetingId) {
      res.status(400).json({ error: 'Missing meeting id' });
      return;
    }
    const booking = getAccessibleMeetingBookingForUser(req, meetingId);
    if (!booking) {
      res.status(404).json({ error: 'Meeting not found or not accessible' });
      return;
    }
    const canEditManagerFields = canEditMeetingManagerFieldsForUser(req, booking);
    if (!canEditManagerFields) {
      res.status(403).json({ error: 'Only meeting participants or meeting managers can edit manager fields' });
      return;
    }
    const body = req.body || {};
    const topicsText = String(body.topicsText || '').trim().slice(0, 20000);
    const summaryText = String(body.summaryText || '').trim().slice(0, 20000);
    const actions = sanitizeMeetingManagerActions(body.actions);
    const nextMeetingDate = String(body.nextMeetingDate || '').trim().slice(0, 20);
    if (nextMeetingDate && !parseIsoDay(nextMeetingDate)) {
      res.status(400).json({ error: 'Invalid next meeting date' });
      return;
    }
    const now = Date.now();
    const updatedById = String(req.userId || '');
    const updatedByUsername = String(req.username || '');
    const upsertManagerFieldsStmt = db.prepare(
      `INSERT INTO meeting_manager_fields
        (meetingId, topicsText, summaryText, actionsJson, nextMeetingDate, updatedAt, updatedById, updatedByUsername)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(meetingId) DO UPDATE
         SET topicsText = excluded.topicsText,
             summaryText = excluded.summaryText,
             actionsJson = excluded.actionsJson,
             nextMeetingDate = excluded.nextMeetingDate,
             updatedAt = excluded.updatedAt,
             updatedById = excluded.updatedById,
             updatedByUsername = excluded.updatedByUsername`
    );
    const persistManagerFields = (targetMeetingId, fields) => {
      upsertManagerFieldsStmt.run(
        String(targetMeetingId || '').trim(),
        String(fields?.topicsText || '').trim().slice(0, 20000),
        String(fields?.summaryText || '').trim().slice(0, 20000),
        JSON.stringify(sanitizeMeetingManagerActions(fields?.actions)),
        String(fields?.nextMeetingDate || '').trim().slice(0, 20),
        now,
        updatedById,
        updatedByUsername
      );
    };
    persistManagerFields(meetingId, {
      topicsText,
      summaryText,
      actions,
      nextMeetingDate
    });
    if (Object.prototype.hasOwnProperty.call(body, 'actions')) {
      const chainMeetingIds = getMeetingFollowUpChainMeetingIds(meetingId).filter((id) => id && id !== meetingId);
      if (chainMeetingIds.length) {
        const persistActionsForChainTx = db.transaction((ids) => {
          for (const linkedMeetingId of ids) {
            const existingFields = getMeetingManagerFields(linkedMeetingId);
            persistManagerFields(linkedMeetingId, {
              topicsText: existingFields.topicsText,
              summaryText: existingFields.summaryText,
              actions,
              nextMeetingDate: existingFields.nextMeetingDate
            });
          }
        });
        persistActionsForChainTx(chainMeetingIds);
      }
    }
    res.json({
      ok: true,
      meetingId,
      managerFields: getMeetingManagerFields(meetingId),
      canManageMeeting: canEditManagerFields
    });
  });

  app.post('/api/meetings/:id/notes', requireAuth, express.json({ limit: '2mb' }), (req, res) => {
    const meetingId = String(req.params.id || '').trim();
    if (!meetingId) {
      res.status(400).json({ error: 'Missing meeting id' });
      return;
    }
    const booking = getAccessibleMeetingBookingForUser(req, meetingId);
    if (!booking) {
      res.status(404).json({ error: 'Meeting not found or not accessible' });
      return;
    }
    if (!isMeetingParticipantForRequestUser(req, booking)) {
      res.status(403).json({ error: 'Only participants can edit meeting notes' });
      return;
    }
    const userRow = db
      .prepare('SELECT id, username, firstName, lastName, email, linkedExternalId, linkedExternalClientId, disabled FROM users WHERE id = ? LIMIT 1')
      .get(String(req.userId || '').trim());
    if (!userRow || Number(userRow.disabled) === 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const payload = req.body || {};
    const noteId = String(payload.id || '').trim();
    const now = Date.now();
    const title = String(payload.title || '').trim().slice(0, 140) || 'Meeting note';
    const contentText = String(payload.contentText || '').trim().slice(0, 200000);
    const contentHtml = String(payload.contentHtml || '').slice(0, 1500000);
    const contentLexical = String(payload.contentLexical || '').slice(0, 1500000);
    const shared = !!payload.shared;
    const authorDisplayName = `${String(userRow.firstName || '').trim()} ${String(userRow.lastName || '').trim()}`.trim() || String(userRow.username || '');
    const linkedExternalId = String(userRow.linkedExternalId || '').trim();
    const linkedExternalClientId = String(userRow.linkedExternalClientId || '').trim();
    const authorExternalId =
      linkedExternalId && linkedExternalClientId && linkedExternalClientId === String(booking.clientId || '')
        ? linkedExternalId
        : '';
    const authorEmail = String(userRow.email || '').trim().toLowerCase();
    if (noteId) {
      const current = db.prepare('SELECT * FROM meeting_notes WHERE id = ? AND meetingId = ? LIMIT 1').get(noteId, meetingId);
      if (!current) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }
      if (!req.isAdmin && !req.isSuperAdmin && String(current.authorUserId || '') !== String(req.userId || '')) {
        res.status(403).json({ error: 'Only author can edit this note' });
        return;
      }
      db.prepare(
        `UPDATE meeting_notes
         SET title = ?, contentText = ?, contentHtml = ?, contentLexical = ?, shared = ?, updatedAt = ?
         WHERE id = ? AND meetingId = ?`
      ).run(title, contentText, contentHtml, contentLexical, shared ? 1 : 0, now, noteId, meetingId);
      const next = mapMeetingNoteRow(
        db
          .prepare(
            `SELECT id, meetingId, authorUserId, authorUsername, authorExternalId, authorEmail, authorDisplayName, title, contentText, contentHtml, contentLexical, shared, createdAt, updatedAt
             FROM meeting_notes
             WHERE id = ? AND meetingId = ?
             LIMIT 1`
          )
          .get(noteId, meetingId)
      );
      res.json({ ok: true, note: next });
      return;
    }
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
    db.prepare(
      `INSERT INTO meeting_notes
        (id, meetingId, authorUserId, authorUsername, authorExternalId, authorEmail, authorDisplayName, title, contentText, contentHtml, contentLexical, shared, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      meetingId,
      String(req.userId || ''),
      String(req.username || ''),
      authorExternalId,
      authorEmail,
      authorDisplayName,
      title,
      contentText,
      contentHtml,
      contentLexical,
      shared ? 1 : 0,
      now,
      now
    );
    const created = mapMeetingNoteRow(
      db
        .prepare(
          `SELECT id, meetingId, authorUserId, authorUsername, authorExternalId, authorEmail, authorDisplayName, title, contentText, contentHtml, contentLexical, shared, createdAt, updatedAt
           FROM meeting_notes
           WHERE id = ? AND meetingId = ?
           LIMIT 1`
        )
        .get(id, meetingId)
    );
    res.json({ ok: true, note: created });
  });

  app.delete('/api/meetings/:id/notes/:noteId', requireAuth, (req, res) => {
    const meetingId = String(req.params.id || '').trim();
    const noteId = String(req.params.noteId || '').trim();
    if (!meetingId || !noteId) {
      res.status(400).json({ error: 'Missing ids' });
      return;
    }
    const booking = getAccessibleMeetingBookingForUser(req, meetingId);
    if (!booking) {
      res.status(404).json({ error: 'Meeting not found or not accessible' });
      return;
    }
    if (!isMeetingParticipantForRequestUser(req, booking)) {
      res.status(403).json({ error: 'Only participants can edit meeting notes' });
      return;
    }
    const row = db.prepare('SELECT id, authorUserId FROM meeting_notes WHERE id = ? AND meetingId = ? LIMIT 1').get(noteId, meetingId);
    if (!row) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    if (!req.isAdmin && !req.isSuperAdmin && String(row.authorUserId || '') !== String(req.userId || '')) {
      res.status(403).json({ error: 'Only author can delete this note' });
      return;
    }
    db.prepare('DELETE FROM meeting_notes WHERE id = ? AND meetingId = ?').run(noteId, meetingId);
    res.json({ ok: true });
  });

  app.get('/api/meetings/:id/notes-export', requireAuth, (req, res) => {
    const meetingId = String(req.params.id || '').trim();
    if (!meetingId) {
      res.status(400).json({ error: 'Missing meeting id' });
      return;
    }
    const booking = getAccessibleMeetingBookingForUser(req, meetingId);
    if (!booking) {
      res.status(404).json({ error: 'Meeting not found or not accessible' });
      return;
    }
    if (!isMeetingParticipantForRequestUser(req, booking)) {
      res.status(403).json({ error: 'Only participants can access meeting notes' });
      return;
    }
    const allRows = db
      .prepare(
        `SELECT id, meetingId, authorUserId, authorUsername, authorExternalId, authorEmail, authorDisplayName, title, contentText, contentHtml, contentLexical, shared, createdAt, updatedAt
         FROM meeting_notes
         WHERE meetingId = ?
         ORDER BY updatedAt DESC, createdAt DESC`
      )
      .all(meetingId)
      .map(mapMeetingNoteRow)
      .filter(Boolean);
    const rows = req.isAdmin || req.isSuperAdmin ? allRows : allRows.filter((r) => r.authorUserId === String(req.userId) || r.shared);
    const esc = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const lines = [
      'title,author,email,shared,updatedAt,contentText',
      ...rows.map((row) =>
        [
          esc(row.title),
          esc(row.authorDisplayName || row.authorUsername || ''),
          esc(row.authorEmail || ''),
          esc(row.shared ? 'yes' : 'no'),
          esc(row.updatedAt ? new Date(Number(row.updatedAt)).toISOString() : ''),
          esc(row.contentText || '')
        ].join(',')
      )
    ];
    const safeRoom = String(booking.roomName || 'meeting-room')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    const fileName = `plixmap-meeting-notes-${safeRoom || 'meeting-room'}-${meetingId.slice(0, 8)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(lines.join('\n'));
  });

  app.post(
    '/api/meetings/:id/notes/ai-transform',
    requireAuth,
    rateByUser('meeting_notes_ai', 60 * 1000, 30),
    express.json({ limit: '512kb' }),
    async (req, res) => {
      const meetingId = String(req.params.id || '').trim();
      if (!meetingId) {
        res.status(400).json({ error: 'Missing meeting id' });
        return;
      }
      const booking = getAccessibleMeetingBookingForUser(req, meetingId);
      if (!booking) {
        res.status(404).json({ error: 'Meeting not found or not accessible' });
        return;
      }
      if (!isMeetingParticipantForRequestUser(req, booking)) {
        res.status(403).json({ error: 'Only participants can edit meeting notes' });
        return;
      }
      const mode = String(req.body?.mode || '').trim().toLowerCase();
      if (mode !== 'translate' && mode !== 'correct') {
        res.status(400).json({ error: 'Invalid mode' });
        return;
      }
      const sourceText = String(req.body?.text || '')
        .replace(/\r\n?/g, '\n')
        .trim();
      if (!sourceText) {
        res.status(400).json({ error: 'Missing text' });
        return;
      }
      if (sourceText.length > 20000) {
        res.status(400).json({ error: 'Text too long (max 20000 chars)' });
        return;
      }
      const targetLanguage = mode === 'translate' ? String(req.body?.targetLanguage || '').trim() : '';
      if (mode === 'translate' && !targetLanguage) {
        res.status(400).json({ error: 'Missing target language' });
        return;
      }

      const state = readState();
      const clients = Array.isArray(state.clients) ? state.clients : [];
      const client = clients.find((c) => String(c?.id || '') === String(booking.clientId || '')) || null;
      const apiKey = String(client?.openAiApiKey || '').trim();
      if (!apiKey) {
        const clientLabel = String(client?.shortName || client?.name || booking.clientId || 'cliente');
        res.status(400).json({ error: `OpenAI API key non configurata per il cliente ${clientLabel}` });
        return;
      }

      const tokenLimitPerUserDaily = Math.max(0, Number(client?.openAiDailyTokensPerUser || 0) || 0);
      const usageDay = new Date().toISOString().slice(0, 10);
      const usageKey = `${usageDay}|${String(booking.clientId || '')}|${String(req.userId || '')}`;
      const estimatedInputTokens = Math.max(1, Math.ceil(sourceText.length / 4));
      const usedSoFar = Number(aiDailyUsageByScope.get(usageKey) || 0);
      if (tokenLimitPerUserDaily > 0 && usedSoFar + estimatedInputTokens > tokenLimitPerUserDaily) {
        res.status(429).json({ error: `Limite token giornaliero raggiunto (${usedSoFar}/${tokenLimitPerUserDaily})` });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const systemPrompt =
          mode === 'translate'
            ? `Translate the user text to ${targetLanguage}. Keep the original meaning, structure and bulleting. Return only the translated text with no preface.`
            : 'Correct grammar, spelling and punctuation of the user text while preserving meaning and structure. Return only the corrected text with no preface.';
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: sourceText }
            ]
          }),
          signal: controller.signal
        });
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        const body = contentType.includes('application/json')
          ? await response.json().catch(() => null)
          : await response.text().catch(() => null);
        if (!response.ok) {
          const detail =
            (body && typeof body === 'object' && (body.error?.message || body.message)) ||
            `OpenAI request failed (${response.status})`;
          writeAuditLog(db, {
            level: 'important',
            event: 'meeting_notes_ai_transform_failed',
            userId: req.userId,
            username: req.username,
            scopeType: 'client',
            scopeId: String(booking.clientId || ''),
            ...requestMeta(req),
            details: { meetingId, mode, status: response.status, detail: String(detail || '').slice(0, 300) }
          });
          res.status(400).json({ error: detail, status: response.status });
          return;
        }
        const transformedText = String(body?.choices?.[0]?.message?.content || '').trim();
        if (!transformedText) {
          res.status(502).json({ error: 'AI response is empty' });
          return;
        }
        const usageTokensRaw = Number(body?.usage?.total_tokens || 0);
        const estimatedOutputTokens = Math.max(1, Math.ceil(transformedText.length / 4));
        const consumed = usageTokensRaw > 0 ? usageTokensRaw : estimatedInputTokens + estimatedOutputTokens;
        aiDailyUsageByScope.set(usageKey, usedSoFar + consumed);
        writeAuditLog(db, {
          level: 'important',
          event: 'meeting_notes_ai_transform_ok',
          userId: req.userId,
          username: req.username,
          scopeType: 'client',
          scopeId: String(booking.clientId || ''),
          ...requestMeta(req),
          details: {
            meetingId,
            mode,
            targetLanguage: targetLanguage || null,
            tokenLimitPerUserDaily: tokenLimitPerUserDaily || null,
            tokensUsedNow: consumed,
            tokensUsedToday: usedSoFar + consumed
          }
        });
        res.json({
          ok: true,
          mode,
          targetLanguage: targetLanguage || null,
          transformedText
        });
      } catch (err) {
        const detail = err?.name === 'AbortError' ? 'OpenAI request timeout' : err?.message || 'OpenAI request failed';
        writeAuditLog(db, {
          level: 'important',
          event: 'meeting_notes_ai_transform_failed',
          userId: req.userId,
          username: req.username,
          scopeType: 'client',
          scopeId: String(booking.clientId || ''),
          ...requestMeta(req),
          details: { meetingId, mode, detail: String(detail || '').slice(0, 300) }
        });
        res.status(500).json({ error: 'Failed to process AI request', detail });
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );

  app.post('/api/meetings', requireAuth, async (req, res) => {
    const payload = req.body || {};
    const clientId = String(payload.clientId || '').trim();
    const siteId = String(payload.siteId || '').trim();
    const floorPlanId = String(payload.floorPlanId || '').trim();
    const roomId = String(payload.roomId || '').trim();
    const subject = String(payload.subject || '').trim();
    const requestedSeatsRaw = Number(payload.requestedSeats);
    const requestedSeats = Number.isFinite(requestedSeatsRaw) ? Math.max(1, Math.floor(requestedSeatsRaw)) : 0;
    const setupBufferBeforeMin = clampMeetingBuffer(payload.setupBufferBeforeMin);
    const setupBufferAfterMin = clampMeetingBuffer(payload.setupBufferAfterMin);
    const sendEmail = !!payload.sendEmail;
    const technicalSetup = !!payload.technicalSetup;
    const technicalEmail = String(payload.technicalEmail || '').trim().toLowerCase();
    const notes = String(payload.notes || '').trim();
    const videoConferenceLink = String(payload.videoConferenceLink || '').trim();
    const kioskLanguage = normalizeMeetingKioskLanguage(payload.kioskLanguage);
    const roomSnapshotAttachment = parseInlinePngDataUrl(payload.roomSnapshotPngDataUrl);
    const followUpOfMeetingIdRaw = String(payload.followUpOfMeetingId || '').trim();
    const externalGuests = !!payload.externalGuests;
    const externalGuestsDetails = Array.isArray(payload.externalGuestsDetails)
      ? payload.externalGuestsDetails
          .map((row) => ({
            name: String(row?.name || '').trim(),
            email: String(row?.email || '').trim().toLowerCase() || null,
            sendEmail: !!row?.sendEmail,
            remote: !!row?.remote
          }))
          .filter((row) => row.name)
      : [];
    const externalGuestsList = Array.isArray(payload.externalGuestsList)
      ? payload.externalGuestsList.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)
      : [];
    if (!clientId || !siteId || !roomId || !subject || !requestedSeats) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const state = readState();
    const visibleClients = getVisibleClientsForMeetings(req, state);
    const rooms = listMeetingRoomsFromClients(visibleClients, { clientId, siteId, includeNonMeeting: true });
    const room = rooms.find((entry) => entry.roomId === roomId && (!floorPlanId || entry.floorPlanId === floorPlanId));
    if (!room) {
      res.status(403).json({ error: 'Room not accessible' });
      return;
    }
    if (!room.isMeetingRoom) {
      res.status(400).json({ error: 'Selected room is not marked as meeting room' });
      return;
    }
    let followUpOfMeetingId = null;
    let followUpSequenceBase = 0;
    if (followUpOfMeetingIdRaw) {
      const sourceMeeting = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ? LIMIT 1').get(followUpOfMeetingIdRaw));
      if (!sourceMeeting) {
        res.status(400).json({ error: 'Follow-up source meeting not found' });
        return;
      }
      if (String(sourceMeeting.clientId || '') !== clientId || String(sourceMeeting.siteId || '') !== siteId) {
        res.status(400).json({ error: 'Follow-up source meeting must belong to the same client/site' });
        return;
      }
      followUpOfMeetingId = getFollowUpRootMeetingId(String(sourceMeeting.id || '')) || String(sourceMeeting.id || '');
      const maxFollowUpRow = db
        .prepare(
          `SELECT COALESCE(MAX(followUpSequence), 0) as maxSeq
           FROM meeting_bookings
           WHERE id = ? OR followUpOfMeetingId = ?`
        )
        .get(followUpOfMeetingId, followUpOfMeetingId);
      followUpSequenceBase = Math.max(0, Number(maxFollowUpRow?.maxSeq || 0) || 0);
    }
    const occurrenceResult = createMeetingOccurrences({
      startDate: payload.startDate,
      endDate: payload.endDate || payload.startDate,
      startTime: payload.startTime,
      endTime: payload.endTime
    });
    if (occurrenceResult.error) {
      res.status(400).json({ error: occurrenceResult.error });
      return;
    }
    const participantResolution = resolveParticipantEmails(clientId, payload.participants);
    if (sendEmail && participantResolution.missingEmails.length) {
      res.status(400).json({ error: 'Missing participant emails', missingEmails: participantResolution.missingEmails });
      return;
    }
    if (technicalSetup && !technicalEmail) {
      res.status(400).json({ error: 'Technical setup email required' });
      return;
    }
    const actor = db
      .prepare('SELECT id, username, email, canCreateMeetings, isAdmin, isSuperAdmin, disabled FROM users WHERE id = ?')
      .get(req.userId);
    if (!actor || Number(actor.disabled) === 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canCreateAutonomously = req.isAdmin || req.isSuperAdmin || Number(actor.canCreateMeetings) === 1;
    const requestedMeetingAdminIds = normalizeMeetingAdminIds(payload.meetingAdminIds, [req.userId]);
    let meetingAdminIds = normalizeMeetingAdminIds([], [req.userId]);
    if (requestedMeetingAdminIds.length) {
      const placeholders = requestedMeetingAdminIds.map(() => '?').join(',');
      const validRows = db
        .prepare(`SELECT id FROM users WHERE disabled = 0 AND id IN (${placeholders})`)
        .all(...requestedMeetingAdminIds);
      const validIds = validRows.map((row) => String(row.id || '').trim()).filter(Boolean);
      meetingAdminIds = normalizeMeetingAdminIds(validIds, [req.userId]);
    }
    const status = canCreateAutonomously ? 'approved' : 'pending';
    const approvalRequired = canCreateAutonomously ? 0 : 1;
    const conflictsByDay = [];
    for (const occ of occurrenceResult.occurrences) {
      const effectiveStartAt = Number(occ.startAt) - setupBufferBeforeMin * 60_000;
      const effectiveEndAt = Number(occ.endAt) + setupBufferAfterMin * 60_000;
      const conflicts = getMeetingConflicts(room.roomId, effectiveStartAt, effectiveEndAt, null);
      if (conflicts.length) conflictsByDay.push({ day: occ.day, conflicts });
    }
    if (conflictsByDay.length) {
      res.status(409).json({ error: 'Time slot not available', conflictsByDay });
      return;
    }
    const now = Date.now();
    const multiDayGroupId = occurrenceResult.occurrences.length > 1 ? (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex')) : null;
    const createdIds = [];
    const insert = db.prepare(
      `INSERT INTO meeting_bookings
        (id, meetingNumber, status, approvalRequired, clientId, siteId, floorPlanId, roomId, roomName, subject, requestedSeats, roomCapacity, equipmentJson, participantsJson, externalGuests, externalGuestsJson, externalGuestsDetailsJson, sendEmail, technicalSetup, technicalEmail, notes, videoConferenceLink, kioskLanguage, setupBufferBeforeMin, setupBufferAfterMin, startAt, endAt, effectiveStartAt, effectiveEndAt, multiDayGroupId, occurrenceDate, followUpOfMeetingId, followUpSequence, requestedById, requestedByUsername, requestedByEmail, meetingAdminIdsJson, requestedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const equipmentJson = JSON.stringify(room.equipment || []);
    const participantsJson = JSON.stringify(participantResolution.normalized || []);
    const normalizedExternalGuestsDetails = externalGuests ? externalGuestsDetails : [];
    const externalGuestEmailsFromDetails = normalizedExternalGuestsDetails
      .filter((row) => row.sendEmail && row.email)
      .map((row) => String(row.email || '').trim().toLowerCase())
      .filter(Boolean);
    const effectiveExternalGuestsList = externalGuestEmailsFromDetails.length ? externalGuestEmailsFromDetails : externalGuestsList;
    const externalGuestsDetailsJson = JSON.stringify(normalizedExternalGuestsDetails);
    const requestedByUsername = String(actor.username || '').toLowerCase();
    const requestedByEmail = String(actor.email || '').trim().toLowerCase();
    const meetingAdminIdsJson = JSON.stringify(meetingAdminIds);
    const tx = db.transaction(() => {
      let nextMeetingNumber = Number(
        db.prepare('SELECT COALESCE(MAX(meetingNumber), 0) as value FROM meeting_bookings').get()?.value || 0
      );
      let followUpSequence = followUpSequenceBase;
      for (const occ of occurrenceResult.occurrences) {
        const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
        nextMeetingNumber += 1;
        if (followUpOfMeetingId) followUpSequence += 1;
        const effectiveStartAt = Number(occ.startAt) - setupBufferBeforeMin * 60_000;
        const effectiveEndAt = Number(occ.endAt) + setupBufferAfterMin * 60_000;
        insert.run(
          id,
          nextMeetingNumber,
          status,
          approvalRequired,
          clientId,
          siteId,
          room.floorPlanId,
          room.roomId,
          room.roomName,
          subject,
          requestedSeats,
          room.capacity || 0,
          equipmentJson,
          participantsJson,
          externalGuests ? 1 : 0,
          JSON.stringify(effectiveExternalGuestsList),
          externalGuestsDetailsJson,
          sendEmail ? 1 : 0,
          technicalSetup ? 1 : 0,
          technicalEmail,
          notes,
          videoConferenceLink,
          kioskLanguage,
          setupBufferBeforeMin,
          setupBufferAfterMin,
          Number(occ.startAt),
          Number(occ.endAt),
          effectiveStartAt,
          effectiveEndAt,
          multiDayGroupId,
          occ.day,
          followUpOfMeetingId,
          followUpOfMeetingId ? followUpSequence : 0,
          req.userId,
          requestedByUsername,
          requestedByEmail,
          meetingAdminIdsJson,
          now,
          now,
          now
        );
        createdIds.push(id);
        writeMeetingAuditLog(id, 'created', req.userId, req.username, {
          status,
          approvalRequired: !!approvalRequired,
          roomId: room.roomId,
          roomName: room.roomName,
          siteId,
          floorPlanId: room.floorPlanId,
          meetingAdminIds
        });
      }
    });
    tx();
    const createdBookings = createdIds
      .map((id) => db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(id))
      .map(mapMeetingRow)
      .filter(Boolean);
    if (!canCreateAutonomously) {
      for (const booking of createdBookings) notifyAdminsForMeetingRequest(booking);
      broadcastMeetingPendingSummary();
    }
    if (canCreateAutonomously && sendEmail) {
      const recipients = [...participantResolution.emails, ...effectiveExternalGuestsList];
      const mailWarnings = [];
      for (const booking of createdBookings) {
        const mailRes = await sendMeetingMail({
          recipients,
          subject: `[${APP_BRAND}] Meeting invitation: ${booking.subject || ''}`,
          text: meetingSummaryText(booking, 'Meeting scheduled'),
          attachments: roomSnapshotAttachment ? [roomSnapshotAttachment] : undefined,
          clientId: booking.clientId,
          actorUserId: req.userId,
          actorUsername: req.username,
          details: { kind: 'meeting_invite', bookingId: booking.id }
        });
        if (!mailRes?.ok && (mailRes?.reason === 'smtp_client_not_configured' || mailRes?.reason === 'smtp_client_missing_password')) {
          const label = String(mailRes?.clientName || booking.clientName || booking.clientId || 'cliente');
          const msg =
            mailRes?.reason === 'smtp_client_missing_password'
              ? `SMTP non completato per il cliente ${label} (password mancante).`
              : `SMTP non configurato per il cliente ${label}.`;
          if (!mailWarnings.includes(msg)) mailWarnings.push(msg);
        }
      }
      if (mailWarnings.length) {
        res.json({
          ok: true,
          status,
          approvalRequired: !!approvalRequired,
          bookings: createdBookings,
          warnings: mailWarnings
        });
        return;
      }
    }
    if (technicalSetup && technicalEmail) {
      for (const booking of createdBookings) {
        await sendMeetingMail({
          recipients: [technicalEmail],
          subject: `[${APP_BRAND}] Technical setup required`,
          text: `${meetingSummaryText(booking, 'Technical setup requested')}\n\nRequester: ${requestedByUsername}`,
          attachments: roomSnapshotAttachment ? [roomSnapshotAttachment] : undefined,
          clientId: booking.clientId,
          actorUserId: req.userId,
          actorUsername: req.username,
          details: { kind: 'meeting_technical_setup', bookingId: booking.id }
        });
      }
      const techUser = db.prepare('SELECT id FROM users WHERE lower(email) = ? AND disabled = 0 LIMIT 1').get(technicalEmail);
      if (techUser?.id && String(techUser.id) !== String(req.userId)) {
        for (const booking of createdBookings) {
          pushMeetingDm(
            req.userId,
            String(techUser.id),
            `[TECH SETUP]\n${booking.subject || booking.id}\nRoom: ${booking.roomName || '-'}\n${new Date(Number(booking.startAt)).toLocaleString()}`
          );
        }
      }
    }
    writeAuditLog(db, {
      level: 'important',
      event: 'meeting_created',
      userId: req.userId,
      username: req.username,
      scopeType: 'site',
      scopeId: siteId,
      ...requestMeta(req),
      details: { count: createdBookings.length, status, roomId: room.roomId, roomName: room.roomName }
    });
    res.json({
      ok: true,
      status,
      approvalRequired: !!approvalRequired,
      bookings: createdBookings
    });
  });

  app.post('/api/meetings/:id/review', requireAuth, async (req, res) => {
    if (!req.isAdmin && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const bookingId = String(req.params.id || '').trim();
    const action = String(req.body?.action || '').trim().toLowerCase();
    const reason = String(req.body?.reason || '').trim();
    if (!bookingId || (action !== 'approve' && action !== 'reject')) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    if (action === 'reject' && !reason) {
      res.status(400).json({ error: 'Reason is required when rejecting' });
      return;
    }
    const current = db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId);
    const row = mapMeetingRow(current);
    if (!row) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    if (row.status === 'cancelled' || row.status === 'rejected') {
      res.status(400).json({ error: 'Meeting already closed' });
      return;
    }
    if (action === 'approve') {
      const conflicts = getMeetingConflicts(row.roomId, row.effectiveStartAt, row.effectiveEndAt, row.id);
      if (conflicts.length) {
        res.status(409).json({ error: 'Cannot approve due to overlap', conflicts });
        return;
      }
    }
    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    const now = Date.now();
    db.prepare(
      `UPDATE meeting_bookings
       SET status = ?, reviewedAt = ?, reviewedById = ?, reviewedByUsername = ?, rejectReason = ?, updatedAt = ?
       WHERE id = ?`
    ).run(nextStatus, now, req.userId, req.username, action === 'reject' ? reason : null, now, bookingId);
    const updated = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
    writeMeetingAuditLog(bookingId, action === 'approve' ? 'approved' : 'rejected', req.userId, req.username, {
      reason: action === 'reject' ? reason : null
    });
    notifyMeetingReviewToRequester({ ...updated, reviewedById: req.userId }, nextStatus, reason || null);
    if (nextStatus === 'approved' && updated?.sendEmail) {
      const participantEmails = (updated?.participants || [])
        .map((p) => String(p?.email || '').trim().toLowerCase())
        .filter(Boolean);
      const guestEmailsDetailed = (updated?.externalGuestsDetails || [])
        .filter((g) => g?.sendEmail && g?.email)
        .map((g) => String(g?.email || '').trim().toLowerCase())
        .filter(Boolean);
      const guestEmails = guestEmailsDetailed.length
        ? guestEmailsDetailed
        : (updated?.externalGuestsList || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
      await sendMeetingMail({
        recipients: [...participantEmails, ...guestEmails],
        subject: `[${APP_BRAND}] Meeting approved: ${updated.subject || ''}`,
        text: meetingSummaryText(updated, 'Meeting approved'),
        clientId: updated.clientId,
        actorUserId: req.userId,
        actorUsername: req.username,
        details: { kind: 'meeting_approved', bookingId: updated.id }
      });
    }
    writeAuditLog(db, {
      level: 'important',
      event: 'meeting_reviewed',
      userId: req.userId,
      username: req.username,
      scopeType: 'meeting',
      scopeId: bookingId,
      ...requestMeta(req),
      details: { action: nextStatus, reason: reason || null }
    });
    const pendingCount = pendingMeetingCount();
    broadcastMeetingPendingSummary();
    res.json({ ok: true, booking: updated, pendingCount });
  });

  app.post('/api/meetings/:id/cancel', requireAuth, (req, res) => {
    const bookingId = String(req.params.id || '').trim();
    if (!bookingId) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    const current = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
    if (!current) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    const meetingAdminIds = normalizeMeetingAdminIds((current && current.meetingAdminIds) || [], [current?.requestedById]);
    const canCancel = req.isAdmin || req.isSuperAdmin || meetingAdminIds.includes(String(req.userId || ''));
    if (!canCancel) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (current.status === 'cancelled' || current.status === 'rejected') {
      res.json({ ok: true, booking: current });
      return;
    }
    const now = Date.now();
    db.prepare('UPDATE meeting_bookings SET status = ?, updatedAt = ? WHERE id = ?').run('cancelled', now, bookingId);
    writeMeetingAuditLog(bookingId, 'cancelled', req.userId, req.username, {});
    broadcastMeetingPendingSummary();
    const updated = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
    if (updated?.sendEmail) {
      const recipients = meetingNotificationRecipientsFromBooking(updated);
      if (recipients.length) {
        void sendMeetingMail({
          recipients,
          subject: `[Plixmap] Meeting cancelled: ${updated.subject || updated.roomName || updated.id}`,
          text: `${meetingSummaryText(updated, 'Meeting cancelled')}\n\nThis meeting has been cancelled.`,
          clientId: updated.clientId,
          actorUserId: req.userId,
          actorUsername: req.username,
          details: { kind: 'meeting_cancelled', bookingId: updated.id }
        });
      }
    }
    res.json({ ok: true, booking: updated });
  });

  app.put('/api/meetings/:id', requireAuth, express.json({ limit: '256kb' }), async (req, res) => {
    const bookingId = String(req.params.id || '').trim();
    if (!bookingId) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    const current = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
    if (!current) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    if (!MEETING_ACTIVE_STATUSES.has(String(current.status || ''))) {
      res.status(400).json({ error: 'Meeting is not editable' });
      return;
    }
    const currentMeetingAdminIds = normalizeMeetingAdminIds((current && current.meetingAdminIds) || [], [current?.requestedById]);
    const canEdit = req.isAdmin || req.isSuperAdmin || currentMeetingAdminIds.includes(String(req.userId || ''));
    if (!canEdit) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const body = req.body || {};
    const applyToSeries = !!body.applyToSeries && !!current.multiDayGroupId;
    const subject = body.subject !== undefined ? String(body.subject || '').trim() : String(current.subject || '');
    if (!subject) {
      res.status(400).json({ error: 'Missing subject' });
      return;
    }
    const occurrenceDate = body.day !== undefined ? String(body.day || '').trim() : String(current.occurrenceDate || '').trim();
    const requestedDay = parseIsoDay(occurrenceDate);
    const startTimeParsed = parseClockTime(body.startTime !== undefined ? body.startTime : new Date(Number(current.startAt || 0)).toTimeString().slice(0, 5));
    const endTimeParsed = parseClockTime(body.endTime !== undefined ? body.endTime : new Date(Number(current.endAt || 0)).toTimeString().slice(0, 5));
    if ((!applyToSeries && !requestedDay) || !startTimeParsed || !endTimeParsed) {
      res.status(400).json({ error: 'Invalid date/time' });
      return;
    }
    const setupBufferBeforeMin = body.setupBufferBeforeMin !== undefined ? clampMeetingBuffer(body.setupBufferBeforeMin) : Number(current.setupBufferBeforeMin || 0);
    const setupBufferAfterMin = body.setupBufferAfterMin !== undefined ? clampMeetingBuffer(body.setupBufferAfterMin) : Number(current.setupBufferAfterMin || 0);
    const notes = body.notes !== undefined ? String(body.notes || '') : String(current.notes || '');
    const videoConferenceLink = body.videoConferenceLink !== undefined ? String(body.videoConferenceLink || '') : String(current.videoConferenceLink || '');
    const kioskLanguage = body.kioskLanguage !== undefined ? normalizeMeetingKioskLanguage(body.kioskLanguage) : normalizeMeetingKioskLanguage(current.kioskLanguage);
    const requestedMeetingAdminIds =
      body.meetingAdminIds !== undefined
        ? normalizeMeetingAdminIds(body.meetingAdminIds, [current.requestedById])
        : normalizeMeetingAdminIds((current && current.meetingAdminIds) || [], [current.requestedById]);
    let meetingAdminIds = normalizeMeetingAdminIds([], [current.requestedById]);
    if (requestedMeetingAdminIds.length) {
      const placeholders = requestedMeetingAdminIds.map(() => '?').join(',');
      const validRows = db
        .prepare(`SELECT id FROM users WHERE disabled = 0 AND id IN (${placeholders})`)
        .all(...requestedMeetingAdminIds);
      const validIds = validRows.map((row) => String(row.id || '').trim()).filter(Boolean);
      meetingAdminIds = normalizeMeetingAdminIds(validIds, [current.requestedById]);
    }
    const meetingAdminIdsJson = JSON.stringify(meetingAdminIds);
    const participantInput = body.participants !== undefined ? body.participants : current.participants;
    const participantResolution = resolveParticipantEmails(current.clientId, participantInput);
    const participantsNormalized = Array.isArray(participantResolution.normalized) ? participantResolution.normalized : [];
    const manualParticipants = participantsNormalized.filter((p) => p && p.kind === 'manual');
    const existingExternalByKey = new Map(
      (Array.isArray(current.externalGuestsDetails) ? current.externalGuestsDetails : []).map((g) => [
        `${String(g?.name || '').trim().toLowerCase()}|${String(g?.email || '').trim().toLowerCase()}`,
        g
      ])
    );
    const externalGuestsDetails = Array.isArray(body.externalGuestsDetails)
      ? body.externalGuestsDetails
          .map((row) => ({
            name: String(row?.name || '').trim(),
            email: String(row?.email || '').trim() || null,
            sendEmail: !!row?.sendEmail,
            remote: !!row?.remote
          }))
          .filter((row) => row.name)
      : manualParticipants
          .map((p) => {
            const key = `${String(p?.fullName || '').trim().toLowerCase()}|${String(p?.email || '').trim().toLowerCase()}`;
            const prev = existingExternalByKey.get(key);
            return {
              name: String(p?.fullName || '').trim(),
              email: p?.email ? String(p.email).trim() : null,
              sendEmail: prev ? !!prev.sendEmail : false,
              remote: !!p?.remote
            };
          })
          .filter((row) => row.name);
    const externalGuests = externalGuestsDetails.length > 0;
    const externalGuestsList = externalGuestsDetails.map((g) => String(g.name || '').trim()).filter(Boolean);
    const requestedSeats =
      participantsNormalized.filter((p) => !p?.remote).length +
      externalGuestsDetails.filter((g) => !g?.remote).length;
    const participantsJson = JSON.stringify(participantsNormalized);
    const externalGuestsJson = JSON.stringify(externalGuestsList);
    const externalGuestsDetailsJson = JSON.stringify(externalGuestsDetails);
    const now = Date.now();
    const updateStmt = db.prepare(
      `UPDATE meeting_bookings
       SET subject = ?, notes = ?, videoConferenceLink = ?, kioskLanguage = ?, requestedSeats = ?, participantsJson = ?, externalGuests = ?, externalGuestsJson = ?, externalGuestsDetailsJson = ?, setupBufferBeforeMin = ?, setupBufferAfterMin = ?, meetingAdminIdsJson = ?, startAt = ?, endAt = ?, effectiveStartAt = ?, effectiveEndAt = ?, occurrenceDate = ?, updatedAt = ?
       WHERE id = ?`
    );

    const targets = applyToSeries
      ? db
          .prepare(
            `SELECT * FROM meeting_bookings
             WHERE multiDayGroupId = ?
               AND status IN ('pending','approved')
             ORDER BY startAt ASC`
          )
          .all(String(current.multiDayGroupId))
          .map(mapMeetingRow)
          .filter(Boolean)
      : [current];
    if (!targets.length) {
      res.status(404).json({ error: 'Meeting series not found' });
      return;
    }

    const planned = [];
    for (const row of targets) {
      const rowDay = applyToSeries ? parseIsoDay(String(row.occurrenceDate || '')) : requestedDay;
      if (!rowDay) {
        res.status(400).json({ error: 'Invalid occurrence date in series' });
        return;
      }
      const startAt = toLocalTs(rowDay, startTimeParsed);
      const endAt = toLocalTs(rowDay, endTimeParsed);
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
        res.status(400).json({ error: 'Invalid time range' });
        return;
      }
      const effectiveStartAt = startAt - setupBufferBeforeMin * 60 * 1000;
      const effectiveEndAt = endAt + setupBufferAfterMin * 60 * 1000;
      const conflicts = getMeetingConflicts(row.roomId, effectiveStartAt, effectiveEndAt, row.id);
      if (conflicts.length) {
        res.status(409).json({ error: 'Meeting conflicts detected', conflicts, bookingId: row.id, applyToSeries });
        return;
      }
      planned.push({
        row,
        occurrenceDate: rowDay.value,
        startAt,
        endAt,
        effectiveStartAt,
        effectiveEndAt
      });
    }

    const tx = db.transaction(() => {
      for (const item of planned) {
        updateStmt.run(
          subject,
          notes,
          videoConferenceLink,
          kioskLanguage,
          requestedSeats,
          participantsJson,
          externalGuests ? 1 : 0,
          externalGuestsJson,
          externalGuestsDetailsJson,
          setupBufferBeforeMin,
          setupBufferAfterMin,
          meetingAdminIdsJson,
          item.startAt,
          item.endAt,
          item.effectiveStartAt,
          item.effectiveEndAt,
          item.occurrenceDate,
          now,
          item.row.id
        );
      }
    });
    tx();

    const updatedRows = planned
      .map((item) => mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(item.row.id)))
      .filter(Boolean);
    const updated = updatedRows.find((row) => String(row.id) === bookingId) || updatedRows[0] || null;
    for (const row of updatedRows) {
      const before = targets.find((t) => String(t.id) === String(row.id)) || current;
      const changeLines = meetingChangeSummaryText(before, row);
      writeMeetingAuditLog(row.id, 'updated', req.userId, req.username, {
        changes: changeLines,
        applyToSeries,
        meetingAdminIds
      });
      if (row?.sendEmail) {
        const recipients = meetingNotificationRecipientsFromBooking(row);
        if (recipients.length) {
          void sendMeetingMail({
            recipients,
            subject: `[Plixmap] Meeting updated: ${row.subject || row.roomName || row.id}`,
            text: `${meetingSummaryText(row, 'Meeting updated')}\n\nChanges:\n${changeLines.length ? changeLines.map((line) => `- ${line}`).join('\n') : '- Minor updates'}\n`,
            clientId: row.clientId,
            actorUserId: req.userId,
            actorUsername: req.username,
            details: { kind: 'meeting_updated', bookingId: row.id, changedFields: changeLines, applyToSeries }
          });
        }
      }
    }

    res.json({ ok: true, booking: updated, updatedCount: updatedRows.length, applyToSeries });
  });

  app.get('/manifest-kiosk/:roomId.webmanifest', (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    const safeRoomId = encodeURIComponent(roomId || 'unknown');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.json({
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
    });
  });

  app.get('/manifest-mobile.webmanifest', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.json({
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
      .prepare(`SELECT id, roomId, status, startAt, endAt FROM meeting_bookings WHERE id = ? LIMIT 1`)
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
    const target =
      service === 'it'
        ? support.it
        : service === 'cleaning'
          ? support.cleaning
          : support.coffee;
    const recipient = String(target?.email || '').trim();
    if (!recipient) {
      res.status(400).json({ error: 'Support email not configured' });
      return;
    }
    const serviceLabel =
      service === 'it'
        ? 'IT Service'
        : service === 'cleaning'
          ? 'Cleaning Service'
          : 'Coffee Service';
    const roomName = String(room.roomName || roomId);
    const locationPath = [room.clientName, room.siteName, room.floorPlanName].filter(Boolean).join(' -> ');
    const helpMailResult = await sendMeetingMail({
      recipients: [recipient],
      subject: `Need ${serviceLabel} room ${roomName}`,
      text: [
        `Need ${serviceLabel} room ${roomName}`,
        locationPath ? `Location: ${locationPath}` : null,
        `Requested at: ${new Date().toLocaleString()}`,
        `Source: Kiosk mode`
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

module.exports = { registerMeetingRoutes };
