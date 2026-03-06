const crypto = require('crypto');
const nodemailer = require('nodemailer');

const createMeetingServices = (deps) => {
  const {
    db,
    readState,
    dataSecret,
    getUserWithPermissions,
    computePlanAccess,
    filterStateForUser,
    getEmailConfig,
    getClientEmailConfig,
    logEmailAttempt,
    wsClientInfo,
    sendToUser,
    chat
  } = deps;

  const MEETING_ACTIVE_STATUSES = new Set(['pending', 'approved']);
  const ROOM_PEOPLE_TYPE_IDS = new Set(['user', 'real_user']);
  const ROOM_EQUIPMENT_LABELS = {
    tv: 'TV',
    desktop: 'PC',
    laptop: 'Laptop',
    tablet: 'Tablet',
    camera: 'Camera',
    mic: 'Microphone',
    phone: 'Phone',
    videoIntercom: 'Video intercom',
    intercom: 'Intercom',
    wifi: 'Wi-Fi',
    scanner: 'Scanner',
    printer: 'Printer'
  };
  const ROOM_MEETING_FEATURE_LABELS = {
    meetingProjector: 'Projector',
    meetingTv: 'TV',
    meetingVideoConf: 'Autonomous video conference',
    meetingCoffeeService: 'Coffee service',
    meetingWhiteboard: 'Whiteboard',
    wifiAvailable: 'Guest Wifi',
    fridgeAvailable: 'Fridge'
  };

  const safeJsonParse = (raw, fallback) => {
    try {
      const parsed = JSON.parse(String(raw || ''));
      return parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  };

  const parseIsoDay = (value) => {
    const raw = String(value || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day, value: `${m[1]}-${m[2]}-${m[3]}` };
  };

  const parseClockTime = (value) => {
    const raw = String(value || '').trim();
    const m = raw.match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    const hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes, value: `${m[1]}:${m[2]}` };
  };

  const toLocalTs = (day, time) => new Date(day.year, day.month - 1, day.day, time.hours, time.minutes, 0, 0).getTime();

  const dayRangeFromIso = (value) => {
    const day = parseIsoDay(value);
    if (!day) return null;
    const start = new Date(day.year, day.month - 1, day.day, 0, 0, 0, 0).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return { day: day.value, start, end };
  };

  const clampMeetingBuffer = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(60, Math.floor(parsed)));
  };

  const normalizeMeetingKioskLanguage = (value) => {
    const raw = String(value == null ? '' : value).trim().toLowerCase();
    if (!raw || raw === 'auto' || raw === 'system' || raw === 'default') return '';
    return ['it', 'en', 'ru', 'ar', 'zh'].includes(raw) ? raw : '';
  };

  const getVisibleClientsForMeetings = (req, state) => {
    if (req.isAdmin || req.isSuperAdmin) return state.clients || [];
    const ctx = getUserWithPermissions(db, req.userId);
    const access = computePlanAccess(state.clients || [], ctx?.permissions || []);
    return filterStateForUser(state.clients || [], access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator });
  };

  const buildPlanRoomStats = (plan, metadataOnly = false) => {
    if (metadataOnly) return new Map();
    const byRoomId = new Map();
    for (const obj of plan?.objects || []) {
      const roomId = String(obj?.roomId || '').trim();
      if (!roomId) continue;
      let stats = byRoomId.get(roomId);
      if (!stats) {
        stats = { people: 0, equipment: new Set() };
        byRoomId.set(roomId, stats);
      }
      const typeId = String(obj?.type || '').trim();
      if (ROOM_PEOPLE_TYPE_IDS.has(typeId)) stats.people += 1;
      const label = ROOM_EQUIPMENT_LABELS[typeId];
      if (label) stats.equipment.add(label);
    }
    return byRoomId;
  };

  const listMeetingRoomsFromClients = (clients, filters = {}) => {
    const out = [];
    const clientIdFilter = String(filters.clientId || '').trim();
    const siteIdFilter = String(filters.siteId || '').trim();
    const planIdFilter = String(filters.floorPlanId || '').trim();
    const includeNonMeeting = !!filters.includeNonMeeting;
    const metadataOnly = !!filters.metadataOnly;
    for (const client of clients || []) {
      if (!client?.id) continue;
      if (clientIdFilter && String(client.id) !== clientIdFilter) continue;
      for (const site of client.sites || []) {
        if (!site?.id) continue;
        if (siteIdFilter && String(site.id) !== siteIdFilter) continue;
        for (const plan of site.floorPlans || []) {
          if (!plan?.id) continue;
          if (planIdFilter && String(plan.id) !== planIdFilter) continue;
          const roomStatsByRoomId = buildPlanRoomStats(plan, metadataOnly);
          for (const room of plan.rooms || []) {
            if (!room?.id) continue;
            const isMeetingRoom = !!room.meetingRoom;
            if (!isMeetingRoom && !includeNonMeeting) continue;
            if (!isMeetingRoom && (room.storageRoom || room.bathroom || room.technicalRoom)) continue;
            const rawCapacity = Number(room.capacity);
            const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
            const roomId = String(room.id);
            const equipmentSet = new Set();
            for (const [featureKey, featureLabel] of Object.entries(ROOM_MEETING_FEATURE_LABELS)) {
              if ((room || {})[featureKey]) equipmentSet.add(featureLabel);
            }
            const roomStats = roomStatsByRoomId.get(roomId);
            const currentPeople = Number(roomStats?.people || 0);
            if (roomStats?.equipment && roomStats.equipment.size) {
              for (const label of roomStats.equipment.values()) equipmentSet.add(label);
            }
            out.push({
              clientId: String(client.id),
              clientName: String(client.shortName || client.name || ''),
              clientLogoUrl: String(client.logoUrl || '').trim() || null,
              businessPartners: Array.isArray(client.businessPartners)
                ? client.businessPartners
                    .map((bp) => ({
                      id: String(bp?.id || ''),
                      name: String(bp?.name || '').trim(),
                      logoUrl: String(bp?.logoUrl || '').trim() || null
                    }))
                    .filter((bp) => bp.name)
                : [],
              siteId: String(site.id),
              siteName: String(site.name || ''),
              siteSupportContacts: site.supportContacts || null,
              floorPlanId: String(plan.id),
              floorPlanName: String(plan.name || ''),
              roomId,
              roomName: String(room.name || ''),
              isMeetingRoom,
              capacity,
              currentPeople,
              availableSeats: Math.max(0, capacity - currentPeople),
              equipment: Array.from(equipmentSet).sort((a, b) => a.localeCompare(b)),
              surfaceSqm: Number.isFinite(Number(room?.surfaceSqm)) ? Number(room.surfaceSqm) : null,
              shape:
                String(room?.kind || '') === 'poly' && Array.isArray(room?.points) && room.points.length >= 3
                  ? {
                      kind: 'poly',
                      points: room.points
                        .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
                        .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
                    }
                  : {
                      kind: 'rect',
                      x: Number(room?.x || 0),
                      y: Number(room?.y || 0),
                      width: Number(room?.width || 0),
                      height: Number(room?.height || 0)
                    }
            });
          }
        }
      }
    }
    return out;
  };

  const mapMeetingRow = (row) => {
    if (!row) return null;
    const rawAdminIds = safeJsonParse(row.meetingAdminIdsJson || '[]', []);
    const meetingAdminIds = Array.isArray(rawAdminIds)
      ? Array.from(
          new Set(
            rawAdminIds
              .map((id) => String(id || '').trim())
              .filter(Boolean)
          )
        )
      : [];
    return {
      id: String(row.id),
      meetingNumber: Number(row.meetingNumber) || 0,
      status: String(row.status || 'pending'),
      approvalRequired: Number(row.approvalRequired) === 1,
      clientId: String(row.clientId || ''),
      siteId: String(row.siteId || ''),
      floorPlanId: String(row.floorPlanId || ''),
      roomId: String(row.roomId || ''),
      roomName: String(row.roomName || ''),
      subject: String(row.subject || ''),
      requestedSeats: Number(row.requestedSeats) || 0,
      roomCapacity: Number(row.roomCapacity) || 0,
      equipment: safeJsonParse(row.equipmentJson || '[]', []),
      participants: safeJsonParse(row.participantsJson || '[]', []),
      externalGuests: Number(row.externalGuests) === 1,
      externalGuestsList: safeJsonParse(row.externalGuestsJson || '[]', []),
      externalGuestsDetails: safeJsonParse(row.externalGuestsDetailsJson || '[]', []),
      sendEmail: Number(row.sendEmail) === 1,
      technicalSetup: Number(row.technicalSetup) === 1,
      technicalEmail: String(row.technicalEmail || ''),
      notes: String(row.notes || ''),
      videoConferenceLink: String(row.videoConferenceLink || ''),
      kioskLanguage: (() => {
        const normalized = normalizeMeetingKioskLanguage(row.kioskLanguage);
        return normalized || null;
      })(),
      setupBufferBeforeMin: Number(row.setupBufferBeforeMin) || 0,
      setupBufferAfterMin: Number(row.setupBufferAfterMin) || 0,
      startAt: Number(row.startAt) || 0,
      endAt: Number(row.endAt) || 0,
      effectiveStartAt: Number(row.effectiveStartAt) || 0,
      effectiveEndAt: Number(row.effectiveEndAt) || 0,
      multiDayGroupId: row.multiDayGroupId ? String(row.multiDayGroupId) : null,
      occurrenceDate: String(row.occurrenceDate || ''),
      followUpOfMeetingId: row.followUpOfMeetingId ? String(row.followUpOfMeetingId) : null,
      followUpSequence: Number(row.followUpSequence) || 0,
      requestedById: String(row.requestedById || ''),
      meetingAdminIds,
      requestedByUsername: String(row.requestedByUsername || ''),
      requestedByEmail: String(row.requestedByEmail || ''),
      requestedAt: Number(row.requestedAt) || 0,
      reviewedAt: row.reviewedAt ? Number(row.reviewedAt) : null,
      reviewedById: row.reviewedById ? String(row.reviewedById) : null,
      reviewedByUsername: row.reviewedByUsername ? String(row.reviewedByUsername) : null,
      rejectReason: row.rejectReason ? String(row.rejectReason) : null,
      createdAt: Number(row.createdAt) || 0,
      updatedAt: Number(row.updatedAt) || 0
    };
  };

  const getMeetingConflicts = (roomId, effectiveStartAt, effectiveEndAt, excludeBookingId) => {
    const rid = String(roomId || '').trim();
    if (!rid) return [];
    const start = Number(effectiveStartAt);
    const end = Number(effectiveEndAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const rows = excludeBookingId
      ? db
          .prepare(
            `SELECT * FROM meeting_bookings
             WHERE roomId = ?
               AND status IN ('pending','approved')
               AND id <> ?
               AND effectiveStartAt < ?
               AND effectiveEndAt > ?
             ORDER BY startAt ASC`
          )
          .all(rid, String(excludeBookingId), end, start)
      : db
          .prepare(
            `SELECT * FROM meeting_bookings
             WHERE roomId = ?
               AND status IN ('pending','approved')
               AND effectiveStartAt < ?
               AND effectiveEndAt > ?
             ORDER BY startAt ASC`
          )
          .all(rid, end, start);
    return rows.map(mapMeetingRow).filter(Boolean);
  };

  const writeMeetingAuditLog = (bookingId, event, actorUserId, actorUsername, details) => {
    const id = String(bookingId || '').trim();
    const evt = String(event || '').trim();
    if (!id || !evt) return;
    let json = '{}';
    try {
      json = JSON.stringify(details || {});
    } catch {
      json = '{}';
    }
    db.prepare(
      `INSERT INTO meeting_audit_log (bookingId, event, actorUserId, actorUsername, detailsJson, ts)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, evt, actorUserId ? String(actorUserId) : null, actorUsername ? String(actorUsername) : null, json, Date.now());
  };

  const listActiveAdmins = () =>
    db
      .prepare(
        `SELECT id, username, email
         FROM users
         WHERE disabled = 0
           AND (isAdmin = 1 OR isSuperAdmin = 1)`
      )
      .all()
      .map((row) => ({
        id: String(row.id),
        username: String(row.username || '').toLowerCase(),
        email: String(row.email || '')
      }));

  const isUserOnline = (userId) => {
    const uid = String(userId || '').trim();
    if (!uid) return false;
    for (const info of wsClientInfo.values()) {
      if (String(info?.userId || '') === uid) return true;
    }
    return false;
  };

  const pushMeetingDm = (fromUserId, toUserId, text) => {
    const fromId = String(fromUserId || '').trim();
    const toId = String(toUserId || '').trim();
    const body = String(text || '').trim();
    if (!fromId || !toId || !body) return null;
    const fromUser = db.prepare('SELECT id, username, avatarUrl, disabled FROM users WHERE id = ?').get(fromId);
    const toUser = db.prepare('SELECT id, disabled FROM users WHERE id = ?').get(toId);
    if (!fromUser || !toUser) return null;
    if (Number(fromUser.disabled) === 1 || Number(toUser.disabled) === 1) return null;
    if (chat.userHasBlocked(toId, fromId) || chat.userHasBlocked(fromId, toId)) return null;
    const [a, b] = fromId < toId ? [fromId, toId] : [toId, fromId];
    const pairKey = `${a}:${b}`;
    const threadId = `dm:${pairKey}`;
    const now = Date.now();
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(10).toString('hex');
    const deliveredAt = isUserOnline(toId) ? now : null;
    db.prepare(
      `INSERT INTO dm_chat_messages (id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, text, deleted, deliveredAt, readAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NULL, '[]', '[]', '{}', ?, 0, ?, NULL, ?, ?)`
    ).run(id, pairKey, fromId, toId, String(fromUser.username || '').toLowerCase(), String(fromUser.avatarUrl || ''), body, deliveredAt, now, now);
    const row = db
      .prepare(
        `SELECT id, pairKey, fromUserId, toUserId, username, avatarUrl, replyToId, attachmentsJson, starredByJson, reactionsJson, deletedForJson, text, deleted, deletedAt, deletedById, editedAt, deliveredAt, readAt, createdAt, updatedAt
         FROM dm_chat_messages
         WHERE id = ?`
      )
      .get(id);
    const message = chat.normalizeDmChatMessageRow(row);
    if (!message) return null;
    sendToUser(fromId, { type: 'dm_chat_new', threadId, message });
    if (deliveredAt) sendToUser(toId, { type: 'dm_chat_new', threadId, message });
    return { id, threadId, message };
  };

  const pendingMeetingCount = () => Number(db.prepare("SELECT COUNT(1) as c FROM meeting_bookings WHERE status = 'pending'").get()?.c || 0);

  const notifyAdminsForMeetingRequest = (booking) => {
    const admins = listActiveAdmins();
    const count = pendingMeetingCount();
    for (const admin of admins) {
      if (!admin?.id) continue;
      sendToUser(admin.id, {
        type: 'meeting_request_new',
        booking,
        pendingCount: count
      });
      if (String(admin.id) === String(booking?.requestedById || '')) continue;
      pushMeetingDm(
        String(booking?.requestedById || ''),
        admin.id,
        `MEETING_REQUEST:${String(booking?.id || '')}\n${booking?.subject || 'Meeting'}\nRoom: ${booking?.roomName || booking?.roomId || '-'}\nUse meeting panel or chat actions to approve/reject.`
      );
    }
  };

  const broadcastMeetingPendingSummary = () => {
    const admins = listActiveAdmins();
    const count = pendingMeetingCount();
    for (const admin of admins) {
      if (!admin?.id) continue;
      sendToUser(admin.id, { type: 'meeting_pending_summary', pendingCount: count });
    }
  };

  const notifyMeetingReviewToRequester = (booking, action, reason) => {
    if (!booking?.requestedById) return;
    sendToUser(String(booking.requestedById), {
      type: 'meeting_request_reviewed',
      bookingId: booking.id,
      action,
      reason: reason ? String(reason) : null
    });
    if (booking.reviewedById && String(booking.reviewedById) !== String(booking.requestedById)) {
      const title = action === 'approved' ? 'approved' : 'rejected';
      const reasonPart = reason ? `\nReason: ${String(reason)}` : '';
      pushMeetingDm(
        String(booking.reviewedById),
        String(booking.requestedById),
        `[MEETING ${title.toUpperCase()}]\n${booking.subject || booking.id}${reasonPart}`
      );
    }
  };

  const sendMeetingMail = async ({ recipients, subject, text, actorUserId, actorUsername, details, attachments, clientId }) => {
    const list = Array.from(new Set((recipients || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)));
    if (!list.length) return { ok: false, skipped: true, reason: 'no_recipients' };
    const cid = String(clientId || '').trim();
    const state = readState();
    const clientName =
      cid && Array.isArray(state?.clients)
        ? String(
            (state.clients.find((c) => String(c?.id || '') === cid)?.shortName ||
              state.clients.find((c) => String(c?.id || '') === cid)?.name ||
              cid)
          )
        : null;
    const config = cid ? getClientEmailConfig(db, dataSecret, cid) : getEmailConfig(db, dataSecret);
    if (!config || !config.host) {
      return {
        ok: false,
        skipped: true,
        reason: cid ? 'smtp_client_not_configured' : 'smtp_not_configured',
        clientId: cid || null,
        clientName
      };
    }
    if (config.username && !config.password) {
      return {
        ok: false,
        skipped: true,
        reason: cid ? 'smtp_client_missing_password' : 'smtp_missing_password',
        clientId: cid || null,
        clientName
      };
    }
    const fromEmail = config.fromEmail || config.username;
    if (!fromEmail) return { ok: false, skipped: true, reason: 'smtp_missing_from' };
    const fromLabel = config.fromName ? `"${config.fromName.replace(/"/g, '')}" <${fromEmail}>` : fromEmail;
    const securityMode = config.securityMode || (config.secure ? 'ssl' : 'starttls');
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: securityMode === 'ssl',
      requireTLS: securityMode === 'starttls',
      ...(config.username ? { auth: { user: config.username, pass: config.password } } : {})
    });
    try {
      const info = await transport.sendMail({
        from: fromLabel,
        to: list.join(', '),
        subject: String(subject || 'Meeting notification'),
        text: String(text || ''),
        attachments: Array.isArray(attachments) ? attachments : undefined
      });
      logEmailAttempt(db, {
        userId: actorUserId ? String(actorUserId) : null,
        username: actorUsername ? String(actorUsername) : null,
        recipient: list.join(', '),
        subject: String(subject || ''),
        success: true,
        details: {
          ...(details || {}),
          clientId: cid || null,
          messageId: info?.messageId || null,
          recipients: list.length,
          attachments: Array.isArray(attachments) ? attachments.length : 0
        }
      });
      return { ok: true, recipients: list.length, messageId: info?.messageId || null };
    } catch (error) {
      logEmailAttempt(db, {
        userId: actorUserId ? String(actorUserId) : null,
        username: actorUsername ? String(actorUsername) : null,
        recipient: list.join(', '),
        subject: String(subject || ''),
        success: false,
        error: error?.message || 'meeting_mail_failed',
        details: details || {}
      });
      return { ok: false, skipped: false, reason: error?.message || 'send_failed' };
    }
  };

  const resolveParticipantEmails = (clientId, participants) => {
    const cid = String(clientId || '').trim();
    const byExternalId = new Map();
    if (cid) {
      const rows = db
        .prepare(
          `SELECT externalId, firstName, lastName, email, dept1
           FROM external_users
           WHERE clientId = ?`
        )
        .all(cid);
      for (const row of rows) {
        byExternalId.set(String(row.externalId || ''), {
          fullName: `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim(),
          email: String(row.email || '').trim(),
          department: String(row.dept1 || '').trim()
        });
      }
    }
    const normalized = [];
    const emails = [];
    const missingEmails = [];
    for (const entry of Array.isArray(participants) ? participants : []) {
      const kind = entry?.kind === 'manual' ? 'manual' : 'real_user';
      const externalId = String(entry?.externalId || '').trim();
      let fullName = String(entry?.fullName || entry?.name || '').trim();
      let email = String(entry?.email || '').trim();
      let department = String(entry?.department || '').trim();
      const optional = !!entry?.optional;
      const remote = !!entry?.remote;
      const company = String(entry?.company || '').trim() || null;
      if (kind === 'real_user' && externalId && byExternalId.has(externalId)) {
        const found = byExternalId.get(externalId);
        if (!fullName) fullName = String(found?.fullName || '').trim();
        if (!email) email = String(found?.email || '').trim();
        if (!department) department = String(found?.department || '').trim();
      }
      const row = {
        kind,
        externalId: externalId || null,
        fullName,
        email: email || null,
        department: department || null,
        optional,
        remote,
        company
      };
      normalized.push(row);
      if (email) emails.push(email);
      else if (kind === 'real_user' || fullName) missingEmails.push(fullName || externalId || 'participant');
    }
    return { normalized, emails, missingEmails };
  };

  const normalizeMeetingAdminIds = (value, fallback = []) => {
    const source = Array.isArray(value) ? value : [];
    const fallbackList = Array.isArray(fallback) ? fallback : [fallback];
    const out = new Set();
    for (const raw of [...source, ...fallbackList]) {
      const id = String(raw || '').trim();
      if (!id) continue;
      out.add(id);
    }
    return Array.from(out);
  };

  const createMeetingOccurrences = ({ startDate, endDate, startTime, endTime, maxDays = 30 }) => {
    const startDay = parseIsoDay(startDate);
    const endDay = parseIsoDay(endDate || startDate);
    const startClock = parseClockTime(startTime);
    const endClock = parseClockTime(endTime);
    if (!startDay || !endDay || !startClock || !endClock) return { error: 'Invalid date/time' };
    const startDateObj = new Date(startDay.year, startDay.month - 1, startDay.day, 0, 0, 0, 0);
    const endDateObj = new Date(endDay.year, endDay.month - 1, endDay.day, 0, 0, 0, 0);
    if (endDateObj.getTime() < startDateObj.getTime()) return { error: 'Invalid date range' };
    const occurrences = [];
    const cursor = new Date(startDateObj.getTime());
    while (cursor.getTime() <= endDateObj.getTime()) {
      if (occurrences.length >= maxDays) return { error: 'Too many days selected' };
      const day = {
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        day: cursor.getDate(),
        value: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      };
      const startAt = toLocalTs(day, startClock);
      const endAt = toLocalTs(day, endClock);
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
        return { error: 'Invalid time range' };
      }
      occurrences.push({ day: day.value, startAt, endAt });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!occurrences.length) return { error: 'No meeting occurrences' };
    return { occurrences };
  };

  const meetingSummaryText = (booking, actionLabel) => {
    const start = Number(booking?.startAt || 0);
    const end = Number(booking?.endAt || 0);
    const when = start && end ? `${new Date(start).toLocaleString()} - ${new Date(end).toLocaleTimeString()}` : '-';
    let locationPath = '';
    try {
      const state = readState();
      const client = (state?.clients || []).find((c) => String(c?.id || '') === String(booking?.clientId || ''));
      const site = (client?.sites || []).find((s) => String(s?.id || '') === String(booking?.siteId || ''));
      const plan = (site?.floorPlans || []).find((p) => String(p?.id || '') === String(booking?.floorPlanId || ''));
      const clientName = String(client?.shortName || client?.name || '').trim();
      const siteName = String(site?.name || '').trim();
      const planName = String(plan?.name || '').trim();
      locationPath = [clientName, siteName, planName].filter(Boolean).join(' -> ');
    } catch {
      locationPath = '';
    }
    const internalParticipants = (Array.isArray(booking?.participants) ? booking.participants : [])
      .map((p) => {
        const label = String(p?.fullName || p?.externalId || '-').trim() || '-';
        const flags = [];
        if (p?.remote) flags.push('remote');
        if (p?.optional) flags.push('optional');
        return flags.length ? `${label} (${flags.join(', ')})` : label;
      })
      .filter(Boolean);
    const externalParticipants = (Array.isArray(booking?.externalGuestsDetails) ? booking.externalGuestsDetails : [])
      .map((g) => `${String(g?.name || '-')}${g?.remote ? ' (remote)' : ' (on-site)'}${g?.email ? ` <${String(g.email)}>` : ''}`)
      .filter(Boolean);
    return [
      `${actionLabel}`,
      '',
      `Subject: ${booking?.subject || '-'}`,
      locationPath ? `Location: ${locationPath}` : null,
      `Room: ${booking?.roomName || booking?.roomId || '-'}`,
      `When: ${when}`,
      `Seats: ${booking?.requestedSeats || 0}`,
      `Room capacity: ${booking?.roomCapacity || 0}`,
      internalParticipants.length ? `Internal participants: ${internalParticipants.join(', ')}` : null,
      externalParticipants.length ? `External participants: ${externalParticipants.join(', ')}` : null,
      `Setup pre-meeting (min): ${Number(booking?.setupBufferBeforeMin) || 0}`,
      `Setup post-meeting (min): ${Number(booking?.setupBufferAfterMin) || 0}`,
      `Technical setup: ${booking?.technicalSetup ? 'Yes' : 'No'}`,
      booking?.technicalSetup && booking?.technicalEmail ? `Technical contact: ${booking.technicalEmail}` : null,
      booking?.videoConferenceLink ? `Video link: ${booking.videoConferenceLink}` : null,
      booking?.notes ? `Notes: ${booking.notes}` : null
    ].filter(Boolean).join('\n');
  };

  const meetingNotificationRecipientsFromBooking = (booking) => {
    const internal = (Array.isArray(booking?.participants) ? booking.participants : [])
      .map((p) => String(p?.email || '').trim().toLowerCase())
      .filter(Boolean);
    const external = (Array.isArray(booking?.externalGuestsDetails) ? booking.externalGuestsDetails : [])
      .filter((g) => g?.sendEmail && g?.email)
      .map((g) => String(g.email || '').trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set([...internal, ...external]));
  };

  const meetingChangeSummaryText = (before, after) => {
    const lines = [];
    if (String(before?.subject || '') !== String(after?.subject || '')) {
      lines.push(`Subject: "${before?.subject || '-'}" -> "${after?.subject || '-'}"`);
    }
    if (Number(before?.startAt || 0) !== Number(after?.startAt || 0) || Number(before?.endAt || 0) !== Number(after?.endAt || 0)) {
      const prevRange = `${new Date(Number(before?.startAt || 0)).toLocaleString()} - ${new Date(Number(before?.endAt || 0)).toLocaleTimeString()}`;
      const nextRange = `${new Date(Number(after?.startAt || 0)).toLocaleString()} - ${new Date(Number(after?.endAt || 0)).toLocaleTimeString()}`;
      lines.push(`Schedule: ${prevRange} -> ${nextRange}`);
    }
    if (String(before?.notes || '') !== String(after?.notes || '')) {
      lines.push('Notes updated');
    }
    if (String(before?.videoConferenceLink || '') !== String(after?.videoConferenceLink || '')) {
      lines.push('Video conference link updated');
    }
    const beforeParticipants = Array.isArray(before?.participants) ? before.participants : [];
    const afterParticipants = Array.isArray(after?.participants) ? after.participants : [];
    const beforeParticipantSig = beforeParticipants
      .map((p) => `${String(p?.fullName || p?.externalId || '-')}${p?.remote ? ' [remote]' : ''}${p?.optional ? ' [opt]' : ''}`)
      .join(', ');
    const afterParticipantSig = afterParticipants
      .map((p) => `${String(p?.fullName || p?.externalId || '-')}${p?.remote ? ' [remote]' : ''}${p?.optional ? ' [opt]' : ''}`)
      .join(', ');
    if (beforeParticipantSig !== afterParticipantSig) {
      lines.push(`Participants updated (${beforeParticipants.length} -> ${afterParticipants.length})`);
    }
    if (
      Number(before?.setupBufferBeforeMin || 0) !== Number(after?.setupBufferBeforeMin || 0) ||
      Number(before?.setupBufferAfterMin || 0) !== Number(after?.setupBufferAfterMin || 0)
    ) {
      lines.push(
        `Setup buffers: pre ${Number(before?.setupBufferBeforeMin || 0)}m / post ${Number(before?.setupBufferAfterMin || 0)}m -> pre ${Number(after?.setupBufferBeforeMin || 0)}m / post ${Number(after?.setupBufferAfterMin || 0)}m`
      );
    }
    return lines;
  };

  const parseInlinePngDataUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const m = /^data:image\/png;base64,([a-z0-9+/=\s]+)$/i.exec(raw);
    if (!m) return null;
    try {
      const base64 = String(m[1] || '').replace(/\s+/g, '');
      const content = Buffer.from(base64, 'base64');
      if (!content.length) return null;
      if (content.length > 8 * 1024 * 1024) return null;
      return {
        filename: 'meeting-room-layout.png',
        contentType: 'image/png',
        content
      };
    } catch {
      return null;
    }
  };

  const getMeetingCheckInMap = (meetingId) => {
    const id = String(meetingId || '').trim();
    if (!id) return {};
    const rows = db.prepare('SELECT entryKey, checked FROM meeting_checkins WHERE meetingId = ?').all(id);
    const out = {};
    for (const row of rows) {
      if (Number(row.checked) === 1) out[String(row.entryKey || '')] = true;
    }
    return out;
  };

  const getMeetingCheckInMapByMeetingIds = (meetingIds) => {
    const ids = Array.from(new Set((meetingIds || []).map((v) => String(v || '').trim()).filter(Boolean)));
    const out = {};
    if (!ids.length) return out;
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT meetingId, entryKey, checked FROM meeting_checkins WHERE meetingId IN (${placeholders})`)
      .all(...ids);
    for (const row of rows) {
      const mid = String(row.meetingId || '').trim();
      if (!mid) continue;
      if (!out[mid]) out[mid] = {};
      if (Number(row.checked) === 1) out[mid][String(row.entryKey || '')] = true;
    }
    return out;
  };

  const getMeetingCheckInTimestampsByMeetingIds = (meetingIds) => {
    const ids = Array.from(new Set((meetingIds || []).map((v) => String(v || '').trim()).filter(Boolean)));
    const out = {};
    if (!ids.length) return out;
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT meetingId, entryKey, checked, updatedAt FROM meeting_checkins WHERE meetingId IN (${placeholders})`)
      .all(...ids);
    for (const row of rows) {
      const mid = String(row.meetingId || '').trim();
      const entryKey = String(row.entryKey || '').trim();
      if (!mid || !entryKey) continue;
      if (Number(row.checked) !== 1) continue;
      if (!out[mid]) out[mid] = {};
      out[mid][entryKey] = Number(row.updatedAt || 0) || Date.now();
    }
    return out;
  };

  const buildCheckInKeyForRealParticipant = (participant) => {
    const tag = participant?.optional ? 'OPT' : 'INT';
    const label = String(participant?.fullName || participant?.externalId || '-').trim().toLowerCase();
    const email = String(participant?.email || '').trim().toLowerCase();
    return `${tag}::${label}::${email}`;
  };

  const resolveLinkedRealUserForPortalUser = (userId) => {
    const row = db
      .prepare('SELECT id, email, linkedExternalClientId, linkedExternalId FROM users WHERE id = ? LIMIT 1')
      .get(String(userId || '').trim());
    if (!row) return null;
    const portalEmail = String(row.email || '').trim().toLowerCase();
    const linkedClientId = String(row.linkedExternalClientId || '').trim();
    const linkedExternalId = String(row.linkedExternalId || '').trim();
    let imported = null;
    if (linkedClientId && linkedExternalId) {
      imported = db
        .prepare(
          `SELECT clientId, externalId, firstName, lastName, email
           FROM external_users
           WHERE clientId = ? AND externalId = ?
           LIMIT 1`
        )
        .get(linkedClientId, linkedExternalId);
    }
    const importedEmail = String(imported?.email || '').trim().toLowerCase();
    return {
      portalEmail,
      clientId: linkedClientId || String(imported?.clientId || '').trim(),
      externalId: linkedExternalId || String(imported?.externalId || '').trim(),
      importedEmail,
      fullName: `${String(imported?.firstName || '').trim()} ${String(imported?.lastName || '').trim()}`.trim()
    };
  };

  const findMeetingParticipantForLinkedUser = (booking, linked) => {
    const participants = Array.isArray(booking?.participants) ? booking.participants : [];
    const targetExternalId = String(linked?.externalId || '').trim();
    const targetEmailSet = new Set(
      [String(linked?.portalEmail || '').trim().toLowerCase(), String(linked?.importedEmail || '').trim().toLowerCase()].filter(Boolean)
    );
    for (const p of participants) {
      if (String(p?.kind || 'real_user') === 'manual') continue;
      const pExternalId = String(p?.externalId || '').trim();
      const pEmail = String(p?.email || '').trim().toLowerCase();
      if (targetExternalId && pExternalId && pExternalId === targetExternalId) return p;
      if (pEmail && targetEmailSet.has(pEmail)) return p;
    }
    return null;
  };

  const normalizeMeetingNoteAuthorDisplay = (row) => {
    const raw = String(row?.authorDisplayName || '').trim();
    if (raw) return raw;
    const username = String(row?.authorUsername || '').trim();
    if (username) return username;
    return 'Unknown';
  };

  const mapMeetingNoteRow = (row) => {
    if (!row) return null;
    return {
      id: String(row.id || ''),
      meetingId: String(row.meetingId || ''),
      authorUserId: String(row.authorUserId || ''),
      authorUsername: String(row.authorUsername || ''),
      authorDisplayName: normalizeMeetingNoteAuthorDisplay(row),
      authorExternalId: String(row.authorExternalId || ''),
      authorEmail: String(row.authorEmail || ''),
      title: String(row.title || ''),
      contentText: String(row.contentText || ''),
      contentHtml: String(row.contentHtml || ''),
      contentLexical: String(row.contentLexical || ''),
      shared: Number(row.shared) === 1,
      createdAt: Number(row.createdAt) || 0,
      updatedAt: Number(row.updatedAt) || 0
    };
  };

  const getVisibleMeetingRoomIdsForUser = (req) => {
    if (req.isAdmin || req.isSuperAdmin) return null;
    const state = readState();
    const visibleClients = getVisibleClientsForMeetings(req, state);
    return new Set(listMeetingRoomsFromClients(visibleClients, { includeNonMeeting: true }).map((room) => String(room.roomId || '')));
  };

  const getAccessibleMeetingBookingForUser = (req, meetingId) => {
    const id = String(meetingId || '').trim();
    if (!id) return null;
    const booking = mapMeetingRow(db.prepare('SELECT * FROM meeting_bookings WHERE id = ? LIMIT 1').get(id));
    if (!booking) return null;
    const visibleRoomIds = getVisibleMeetingRoomIdsForUser(req);
    if (visibleRoomIds && !visibleRoomIds.has(String(booking.roomId || ''))) return null;
    return booking;
  };

  const isMeetingParticipantForRequestUser = (req, booking) => {
    if (!booking) return false;
    if (req.isAdmin || req.isSuperAdmin) return true;
    const linked = resolveLinkedRealUserForPortalUser(req.userId);
    if (!linked) return false;
    return !!findMeetingParticipantForLinkedUser(booking, linked);
  };

  const participantRosterFromMeetingBooking = (booking) => {
    const out = [];
    const participantDeptByExternalId = new Map();
    const participantDeptByEmail = new Map();
    const clientId = String(booking?.clientId || '').trim();
    if (clientId) {
      const rows = db
        .prepare(
          `SELECT externalId, email, dept1
           FROM external_users
           WHERE clientId = ?`
        )
        .all(clientId);
      for (const row of rows) {
        const externalId = String(row.externalId || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const department = String(row.dept1 || '').trim();
        if (externalId && department) participantDeptByExternalId.set(externalId, department);
        if (email && department) participantDeptByEmail.set(email, department);
      }
    }
    const pushIfMissing = (entry) => {
      const key = String(entry?.key || '').trim();
      if (!key) return;
      if (out.some((row) => String(row.key) === key)) return;
      out.push(entry);
    };
    for (const p of Array.isArray(booking?.participants) ? booking.participants : []) {
      const kind = String(p?.kind || 'real_user') === 'manual' ? 'external' : 'internal';
      const externalId = String(p?.externalId || '').trim();
      const fullName = String(p?.fullName || externalId || '-').trim() || '-';
      const email = String(p?.email || '').trim().toLowerCase();
      const department =
        String(p?.department || '').trim() ||
        (externalId ? String(participantDeptByExternalId.get(externalId) || '').trim() : '') ||
        (email ? String(participantDeptByEmail.get(email) || '').trim() : '');
      const key = externalId ? `ext:${externalId}` : email ? `mail:${email}` : `name:${fullName.toLowerCase()}`;
      pushIfMissing({
        key,
        kind,
        label: fullName,
        email: email || null,
        department: department || null,
        company: String(p?.company || '').trim() || null,
        remote: !!p?.remote,
        optional: !!p?.optional,
        sharedCount: 0,
        hasShared: false
      });
    }
    for (const g of Array.isArray(booking?.externalGuestsDetails) ? booking.externalGuestsDetails : []) {
      const name = String(g?.name || '').trim();
      if (!name) continue;
      const email = String(g?.email || '').trim().toLowerCase();
      const key = email ? `mail:${email}` : `name:${name.toLowerCase()}`;
      pushIfMissing({
        key,
        kind: 'external',
        label: name,
        email: email || null,
        department: null,
        company: String(g?.company || '').trim() || null,
        remote: !!g?.remote,
        optional: false,
        sharedCount: 0,
        hasShared: false
      });
    }
    return out;
  };

  const participantKeysFromMeetingNote = (note) => {
    const out = [];
    const ext = String(note?.authorExternalId || '').trim();
    const email = String(note?.authorEmail || '').trim().toLowerCase();
    const name = String(note?.authorDisplayName || note?.authorUsername || '').trim().toLowerCase();
    if (ext) out.push(`ext:${ext}`);
    if (email) out.push(`mail:${email}`);
    if (name) out.push(`name:${name}`);
    return out;
  };

  const canManageMeetingForUser = (req, booking) => {
    if (!booking) return false;
    if (req.isAdmin || req.isSuperAdmin) return true;
    const userId = String(req.userId || '').trim();
    if (!userId) return false;
    const admins = normalizeMeetingAdminIds(booking.meetingAdminIds, [booking.requestedById]);
    return admins.includes(userId);
  };

  const canEditMeetingManagerFieldsForUser = (req, booking) => {
    if (!booking) return false;
    if (canManageMeetingForUser(req, booking)) return true;
    return isMeetingParticipantForRequestUser(req, booking);
  };

  const sanitizeMeetingManagerActions = (value) => {
    const normalizeStatus = (input) => {
      const raw = String(input || '').trim().toLowerCase();
      if (raw === 'done') return 'done';
      if (raw === 'not_needed') return 'not_needed';
      if (raw === 'reschedule') return 'reschedule';
      return 'open';
    };
    const normalizeProgress = (input) => {
      const numeric = Number(input);
      if (!Number.isFinite(numeric)) return 0;
      const stepped = Math.round(numeric / 5) * 5;
      return Math.max(0, Math.min(100, stepped));
    };
    const actions = [];
    for (const row of Array.isArray(value) ? value : []) {
      const action = String(row?.action || '').trim().slice(0, 400);
      const assignedTo = String(row?.assignedTo || '').trim().slice(0, 160);
      const openingDateRaw = String(row?.openingDate || '').trim().slice(0, 20);
      const openingDate = openingDateRaw && parseIsoDay(openingDateRaw) ? openingDateRaw : '';
      const completionDate = String(row?.completionDate || '').trim().slice(0, 20);
      const progressPct = normalizeProgress(row?.progressPct);
      const statusRaw = normalizeStatus(row?.status);
      const status = statusRaw === 'not_needed' ? 'not_needed' : progressPct >= 100 ? 'done' : 'open';
      if (!action && !assignedTo && !openingDate && !completionDate && progressPct <= 0) continue;
      actions.push({ action, assignedTo, openingDate, completionDate, progressPct, status });
      if (actions.length >= 200) break;
    }
    return actions;
  };

  const mapMeetingManagerFieldsRow = (row) => {
    if (!row) {
      return {
        meetingId: '',
        topicsText: '',
        summaryText: '',
        actions: [],
        nextMeetingDate: '',
        updatedAt: 0,
        updatedById: '',
        updatedByUsername: ''
      };
    }
    return {
      meetingId: String(row.meetingId || ''),
      topicsText: String(row.topicsText || ''),
      summaryText: String(row.summaryText || ''),
      actions: sanitizeMeetingManagerActions(safeJsonParse(row.actionsJson || '[]', [])),
      nextMeetingDate: String(row.nextMeetingDate || ''),
      updatedAt: Number(row.updatedAt) || 0,
      updatedById: String(row.updatedById || ''),
      updatedByUsername: String(row.updatedByUsername || '')
    };
  };

  const getMeetingManagerFields = (meetingId) => {
    const id = String(meetingId || '').trim();
    if (!id) return mapMeetingManagerFieldsRow(null);
    const row = db.prepare('SELECT * FROM meeting_manager_fields WHERE meetingId = ? LIMIT 1').get(id);
    const mapped = mapMeetingManagerFieldsRow(row);
    mapped.meetingId = id;
    return mapped;
  };

  const getFollowUpRootMeetingId = (meetingId) => {
    let currentId = String(meetingId || '').trim();
    if (!currentId) return '';
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const row = db.prepare('SELECT id, followUpOfMeetingId FROM meeting_bookings WHERE id = ? LIMIT 1').get(currentId);
      if (!row) break;
      const parentId = String(row.followUpOfMeetingId || '').trim();
      if (!parentId) return String(row.id || currentId);
      currentId = parentId;
    }
    return currentId;
  };

  const getMeetingFollowUpChainMeetingIds = (meetingId) => {
    const rootMeetingId = getFollowUpRootMeetingId(meetingId);
    if (!rootMeetingId) return [];
    return db
      .prepare(
        `WITH RECURSIVE followup_chain(id) AS (
           SELECT id
           FROM meeting_bookings
           WHERE id = ?
           UNION ALL
           SELECT child.id
           FROM meeting_bookings child
           JOIN followup_chain chain ON child.followUpOfMeetingId = chain.id
         )
         SELECT id
         FROM meeting_bookings
         WHERE id IN (SELECT id FROM followup_chain)
         ORDER BY startAt ASC, followUpSequence ASC, createdAt ASC`
      )
      .all(rootMeetingId)
      .map((row) => String(row?.id || '').trim())
      .filter(Boolean);
  };

  const getMeetingFollowUpChain = (req, booking) => {
    if (!booking) return [];
    const rootMeetingId = getFollowUpRootMeetingId(String(booking.id || ''));
    if (!rootMeetingId) return [];
    const rows = db
      .prepare(
        `WITH RECURSIVE followup_chain(id) AS (
           SELECT id
           FROM meeting_bookings
           WHERE id = ?
           UNION ALL
           SELECT child.id
           FROM meeting_bookings child
           JOIN followup_chain chain ON child.followUpOfMeetingId = chain.id
         )
         SELECT *
         FROM meeting_bookings
         WHERE id IN (SELECT id FROM followup_chain)
         ORDER BY startAt ASC, followUpSequence ASC, createdAt ASC`
      )
      .all(rootMeetingId)
      .map(mapMeetingRow)
      .filter(Boolean);
    return rows.map((row) => ({
      meeting: row,
      managerFields: getMeetingManagerFields(String(row.id || '')),
      canManageMeeting: canEditMeetingManagerFieldsForUser(req, row),
      isCurrent: String(row.id || '') === String(booking.id || '')
    }));
  };

  return {
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
    pushMeetingDm,
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
    getMeetingFollowUpChain
  };
};

module.exports = { createMeetingServices };
