const crypto = require('crypto');

const mapObjectTypeRequest = (row) => {
  let payload = null;
  let finalPayload = null;
  try {
    payload = JSON.parse(row.payloadJson || '{}');
  } catch {
    payload = null;
  }
  try {
    finalPayload = row.finalPayloadJson ? JSON.parse(row.finalPayloadJson) : null;
  } catch {
    finalPayload = null;
  }
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt,
    requestedBy: { id: row.requestedById, username: row.requestedByUsername },
    reviewedAt: row.reviewedAt || null,
    reviewedBy: row.reviewedById ? { id: row.reviewedById, username: row.reviewedByUsername } : null,
    reason: row.reason || null,
    payload,
    finalPayload
  };
};

const normalizeObjectTypePayload = (input) => {
  const typeId = String(input?.typeId || '').trim();
  const nameIt = String(input?.nameIt || '').trim();
  const nameEn = String(input?.nameEn || '').trim();
  const icon = String(input?.icon || '').trim();
  if (!typeId || !nameIt || !nameEn || !icon) return null;
  const customFields = Array.isArray(input?.customFields)
    ? input.customFields
        .map((field) => ({
          label: String(field?.label || '').trim(),
          valueType:
            field?.valueType === 'number'
              ? 'number'
              : field?.valueType === 'boolean'
                ? 'boolean'
                : field?.valueType === 'string'
                  ? 'string'
                  : ''
        }))
        .filter((field) => field.label && field.valueType)
    : [];
  return { typeId, nameIt, nameEn, icon, customFields };
};

const registerObjectTypeRequestRoutes = (app, deps) => {
  const { db, requireAuth, readState, writeState, createCustomField } = deps;

  app.get('/api/object-type-requests', requireAuth, (req, res) => {
    const rows = req.isSuperAdmin
      ? db.prepare('SELECT * FROM object_type_requests ORDER BY requestedAt DESC').all()
      : db.prepare('SELECT * FROM object_type_requests WHERE requestedById = ? ORDER BY requestedAt DESC').all(req.userId);
    res.json({ requests: rows.map(mapObjectTypeRequest) });
  });

  app.post('/api/object-type-requests', requireAuth, (req, res) => {
    const payload = normalizeObjectTypePayload(req.body || {});
    if (!payload) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }
    const userRow = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId);
    if (!userRow?.username) {
      res.status(400).json({ error: 'Invalid user' });
      return;
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO object_type_requests
        (id, status, payloadJson, requestedAt, requestedById, requestedByUsername)
        VALUES (?, 'pending', ?, ?, ?, ?)`
    ).run(id, JSON.stringify(payload), now, req.userId, userRow.username);
    res.json({ ok: true, id });
  });

  app.put('/api/object-type-requests/:id', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const requestId = String(req.params.id || '').trim();
    if (!requestId) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    const row = db.prepare('SELECT id FROM object_type_requests WHERE id = ?').get(requestId);
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const status = String(req.body?.status || '');
    const reason = req.body?.reason;
    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const now = Date.now();
    const reviewer = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId);
    const finalPayload = req.body?.finalPayload ? normalizeObjectTypePayload(req.body.finalPayload) : null;
    const finalJson = finalPayload ? JSON.stringify(finalPayload) : null;
    db.prepare(
      `UPDATE object_type_requests
       SET status = ?, reason = ?, reviewedAt = ?, reviewedById = ?, reviewedByUsername = ?, finalPayloadJson = ?
       WHERE id = ?`
    ).run(status, reason ? String(reason) : null, now, req.userId, reviewer?.username || '', finalJson, requestId);
    if (status === 'approved' && finalPayload) {
      const serverState = readState();
      const existingTypes = Array.isArray(serverState.objectTypes) ? serverState.objectTypes : [];
      const nextTypes = existingTypes.map((type) => ({ ...type, name: { ...type.name } }));
      const existing = nextTypes.find((type) => type.id === finalPayload.typeId);
      if (existing) {
        existing.name = { it: finalPayload.nameIt, en: finalPayload.nameEn };
        existing.icon = finalPayload.icon;
        if (existing.builtin === undefined) existing.builtin = false;
      } else {
        nextTypes.push({
          id: finalPayload.typeId,
          name: { it: finalPayload.nameIt, en: finalPayload.nameEn },
          icon: finalPayload.icon,
          builtin: false
        });
      }
      writeState({ clients: serverState.clients, objectTypes: nextTypes });
    }
    if (status === 'approved' && finalPayload?.customFields?.length) {
      const users = db.prepare('SELECT id FROM users').all();
      const tx = db.transaction(() => {
        for (const user of users) {
          for (const field of finalPayload.customFields) {
            createCustomField(db, user.id, {
              typeId: finalPayload.typeId,
              label: field.label,
              valueType: field.valueType
            });
          }
        }
      });
      try {
        tx();
      } catch {
        // ignore duplicate or invalid field creation failures
      }
    }
    res.json({ ok: true });
  });

  app.put('/api/object-type-requests/:id/user', requireAuth, (req, res) => {
    const requestId = String(req.params.id || '').trim();
    if (!requestId) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    const row = db.prepare('SELECT id, status, requestedById FROM object_type_requests WHERE id = ?').get(requestId);
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (row.requestedById !== req.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (row.status === 'approved') {
      res.status(400).json({ error: 'Already approved' });
      return;
    }
    const payload = normalizeObjectTypePayload(req.body || {});
    if (!payload) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }
    db.prepare(
      `UPDATE object_type_requests
       SET status = 'pending', payloadJson = ?, reviewedAt = NULL, reviewedById = NULL, reviewedByUsername = NULL, reason = NULL, finalPayloadJson = NULL
       WHERE id = ?`
    ).run(JSON.stringify(payload), requestId);
    res.json({ ok: true });
  });

  app.delete('/api/object-type-requests/:id', requireAuth, (req, res) => {
    const requestId = String(req.params.id || '').trim();
    if (!requestId) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }
    const row = db.prepare('SELECT id, status, requestedById FROM object_type_requests WHERE id = ?').get(requestId);
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (row.requestedById !== req.userId && !req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (row.status === 'approved') {
      res.status(400).json({ error: 'Already approved' });
      return;
    }
    db.prepare('DELETE FROM object_type_requests WHERE id = ?').run(requestId);
    res.json({ ok: true });
  });
};

module.exports = { registerObjectTypeRequestRoutes };
