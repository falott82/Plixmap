const crypto = require('crypto');
const express = require('express');

const registerMeetingNoteRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    readState,
    aiDailyUsageByScope,
    meeting
  } = deps;
  const {
    listMeetingNotesByMeetingId,
    getMeetingNoteById,
    getAccessibleMeetingBookingForUser,
    isMeetingParticipantForRequestUser,
    participantRosterFromMeetingBooking,
    participantKeysFromMeetingNote,
    getVisibleClientsForMeetings,
    canEditMeetingManagerFieldsForUser,
    sanitizeMeetingManagerActions,
    getMeetingManagerFields,
    parseIsoDay,
    getMeetingFollowUpChainMeetingIds,
    getMeetingFollowUpChain,
    getMeetingCheckInMapByMeetingIds,
    getMeetingCheckInTimestampsByMeetingIds
  } = meeting;

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
    const rows = listMeetingNotesByMeetingId(meetingId);
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
      const next = getMeetingNoteById(meetingId, noteId);
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
    const created = getMeetingNoteById(meetingId, id);
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
    const allRows = listMeetingNotesByMeetingId(meetingId);
    const rows = req.isAdmin || req.isSuperAdmin ? allRows : allRows.filter((row) => row.authorUserId === String(req.userId) || row.shared);
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
      const client = (Array.isArray(state.clients) ? state.clients : []).find((entry) => String(entry?.id || '') === String(booking.clientId || '')) || null;
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

  app.post(
    '/api/clients/:clientId/notes/ai-transform',
    requireAuth,
    rateByUser('client_notes_ai', 60 * 1000, 30),
    express.json({ limit: '512kb' }),
    async (req, res) => {
      const clientId = String(req.params.clientId || '').trim();
      if (!clientId) {
        res.status(400).json({ error: 'Missing client id' });
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
      const client = clients.find((entry) => String(entry?.id || '').trim() === clientId) || null;
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      if (!req.isAdmin && !req.isSuperAdmin) {
        const visibleClients = getVisibleClientsForMeetings(req, state);
        const allowed = visibleClients.some((entry) => String(entry?.id || '').trim() === clientId);
        if (!allowed) {
          res.status(403).json({ error: 'Client not accessible' });
          return;
        }
      }

      const apiKey = String(client?.openAiApiKey || '').trim();
      if (!apiKey) {
        const clientLabel = String(client?.shortName || client?.name || clientId);
        res.status(400).json({ error: `OpenAI API key non configurata per il cliente ${clientLabel}` });
        return;
      }

      const tokenLimitPerUserDaily = Math.max(0, Number(client?.openAiDailyTokensPerUser || 0) || 0);
      const usageDay = new Date().toISOString().slice(0, 10);
      const usageKey = `${usageDay}|${clientId}|${String(req.userId || '')}`;
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
            event: 'client_notes_ai_transform_failed',
            userId: req.userId,
            username: req.username,
            scopeType: 'client',
            scopeId: clientId,
            ...requestMeta(req),
            details: { mode, status: response.status, detail: String(detail || '').slice(0, 300) }
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
          event: 'client_notes_ai_transform_ok',
          userId: req.userId,
          username: req.username,
          scopeType: 'client',
          scopeId: clientId,
          ...requestMeta(req),
          details: {
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
          event: 'client_notes_ai_transform_failed',
          userId: req.userId,
          username: req.username,
          scopeType: 'client',
          scopeId: clientId,
          ...requestMeta(req),
          details: { mode, detail: String(detail || '').slice(0, 300) }
        });
        res.status(500).json({ error: 'Failed to process AI request', detail });
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
};

module.exports = { registerMeetingNoteRoutes };
