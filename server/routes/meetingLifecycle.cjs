const crypto = require('crypto');
const express = require('express');

const registerMeetingLifecycleRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    requestMeta,
    writeAuditLog,
    readState,
    APP_BRAND,
    meeting
  } = deps;
  const {
    MEETING_ACTIVE_STATUSES,
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
    resolvePersistedMeetingAdminIds,
    createMeetingOccurrences,
    meetingSummaryText,
    meetingNotificationRecipientsFromBooking,
    meetingChangeSummaryText,
    parseInlinePngDataUrl,
    getFollowUpRootMeetingId,
    pushMeetingDm
  } = meeting;

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
      ? payload.externalGuestsList.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
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
    const meetingAdminIds = resolvePersistedMeetingAdminIds(payload.meetingAdminIds, [req.userId]);
    const status = canCreateAutonomously ? 'approved' : 'pending';
    const approvalRequired = canCreateAutonomously ? 0 : 1;
    const conflictsByDay = [];
    for (const occurrence of occurrenceResult.occurrences) {
      const effectiveStartAt = Number(occurrence.startAt) - setupBufferBeforeMin * 60_000;
      const effectiveEndAt = Number(occurrence.endAt) + setupBufferAfterMin * 60_000;
      const conflicts = getMeetingConflicts(room.roomId, effectiveStartAt, effectiveEndAt, null);
      if (conflicts.length) conflictsByDay.push({ day: occurrence.day, conflicts });
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
      let nextMeetingNumber = Number(db.prepare('SELECT COALESCE(MAX(meetingNumber), 0) as value FROM meeting_bookings').get()?.value || 0);
      let followUpSequence = followUpSequenceBase;
      for (const occurrence of occurrenceResult.occurrences) {
        const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
        nextMeetingNumber += 1;
        if (followUpOfMeetingId) followUpSequence += 1;
        const effectiveStartAt = Number(occurrence.startAt) - setupBufferBeforeMin * 60_000;
        const effectiveEndAt = Number(occurrence.endAt) + setupBufferAfterMin * 60_000;
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
          Number(occurrence.startAt),
          Number(occurrence.endAt),
          effectiveStartAt,
          effectiveEndAt,
          multiDayGroupId,
          occurrence.day,
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
    const createdBookings = createdIds.map((id) => db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(id)).map(mapMeetingRow).filter(Boolean);
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
          const message =
            mailRes?.reason === 'smtp_client_missing_password'
              ? `SMTP non completato per il cliente ${label} (password mancante).`
              : `SMTP non configurato per il cliente ${label}.`;
          if (!mailWarnings.includes(message)) mailWarnings.push(message);
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
    const row = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(bookingId));
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
      const participantEmails = (updated?.participants || []).map((p) => String(p?.email || '').trim().toLowerCase()).filter(Boolean);
      const guestEmailsDetailed = (updated?.externalGuestsDetails || [])
        .filter((g) => g?.sendEmail && g?.email)
        .map((g) => String(g?.email || '').trim().toLowerCase())
        .filter(Boolean);
      const guestEmails = guestEmailsDetailed.length
        ? guestEmailsDetailed
        : (updated?.externalGuestsList || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
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
    writeAuditLog(db, {
      level: 'important',
      event: 'meeting_cancelled',
      userId: req.userId,
      username: req.username,
      scopeType: 'meeting',
      scopeId: bookingId,
      ...requestMeta(req),
      details: {
        roomId: updated?.roomId || current.roomId,
        roomName: updated?.roomName || current.roomName,
        previousStatus: current.status,
        status: updated?.status || 'cancelled'
      }
    });
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
    const meetingAdminIds = resolvePersistedMeetingAdminIds(
      body.meetingAdminIds !== undefined ? body.meetingAdminIds : (current && current.meetingAdminIds) || [],
      [current.requestedById]
    );
    const meetingAdminIdsJson = JSON.stringify(meetingAdminIds);
    const participantInput = body.participants !== undefined ? body.participants : current.participants;
    const participantResolution = resolveParticipantEmails(current.clientId, participantInput);
    if (current.sendEmail && participantResolution.missingEmails.length) {
      res.status(400).json({ error: 'Missing participant emails', missingEmails: participantResolution.missingEmails });
      return;
    }
    const participantsNormalized = Array.isArray(participantResolution.normalized) ? participantResolution.normalized : [];
    const manualParticipants = participantsNormalized.filter((participant) => participant && participant.kind === 'manual');
    const existingExternalByKey = new Map(
      (Array.isArray(current.externalGuestsDetails) ? current.externalGuestsDetails : []).map((guest) => [
        `${String(guest?.name || '').trim().toLowerCase()}|${String(guest?.email || '').trim().toLowerCase()}`,
        guest
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
          .map((participant) => {
            const key = `${String(participant?.fullName || '').trim().toLowerCase()}|${String(participant?.email || '').trim().toLowerCase()}`;
            const prev = existingExternalByKey.get(key);
            return {
              name: String(participant?.fullName || '').trim(),
              email: participant?.email ? String(participant.email).trim() : null,
              sendEmail: prev ? !!prev.sendEmail : false,
              remote: !!participant?.remote
            };
          })
          .filter((row) => row.name);
    const externalGuests = externalGuestsDetails.length > 0;
    const externalGuestsList = externalGuestsDetails.map((guest) => String(guest.name || '').trim()).filter(Boolean);
    const requestedSeats =
      participantsNormalized.filter((participant) => !participant?.remote).length +
      externalGuestsDetails.filter((guest) => !guest?.remote).length;
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
    const updatedRows = planned.map((item) => mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ?').get(item.row.id))).filter(Boolean);
    const updated = updatedRows.find((row) => String(row.id) === bookingId) || updatedRows[0] || null;
    for (const row of updatedRows) {
      const before = targets.find((target) => String(target.id) === String(row.id)) || current;
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
    writeAuditLog(db, {
      level: 'important',
      event: 'meeting_updated',
      userId: req.userId,
      username: req.username,
      scopeType: 'meeting',
      scopeId: bookingId,
      ...requestMeta(req),
      details: {
        applyToSeries,
        updatedCount: updatedRows.length,
        bookingIds: updatedRows.map((row) => row.id)
      }
    });
    res.json({ ok: true, booking: updated, updatedCount: updatedRows.length, applyToSeries });
  });
};

module.exports = { registerMeetingLifecycleRoutes };
