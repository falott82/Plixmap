const { registerMeetingNoteRoutes } = require('./meetingNotes.cjs');
const { registerMeetingPublicRoutes } = require('./meetingPublic.cjs');
const { registerMeetingLifecycleRoutes } = require('./meetingLifecycle.cjs');

const registerMeetingRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    requestMeta,
    readState,
    meeting
  } = deps;
  const {
    safeJsonParse,
    getVisibleClientsForMeetings,
    listMeetingRoomsFromClients,
    mapMeetingRow,
    broadcastMeetingPendingSummary,
    resolveLinkedRealUserForPortalUser,
    findMeetingParticipantForLinkedUser,
    normalizeMeetingAdminIds
  } = meeting;
  registerMeetingPublicRoutes(app, deps);
  registerMeetingLifecycleRoutes(app, deps);

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

  registerMeetingNoteRoutes(app, {
    db,
    requireAuth,
    rateByUser: deps.rateByUser,
    requestMeta,
    writeAuditLog: deps.writeAuditLog,
    readState,
    aiDailyUsageByScope: deps.aiDailyUsageByScope,
    meeting
  });
};

module.exports = { registerMeetingRoutes };
