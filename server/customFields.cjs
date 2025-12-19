const crypto = require('crypto');

const listCustomFields = (db, userId) => {
  return db
    .prepare('SELECT id, typeId, fieldKey, label, valueType, createdAt, updatedAt FROM user_custom_fields WHERE userId = ? ORDER BY typeId, fieldKey')
    .all(userId);
};

const createCustomField = (db, userId, payload) => {
  const typeId = String(payload?.typeId || '').trim();
  const fieldKey = String(payload?.fieldKey || '').trim();
  const label = String(payload?.label || '').trim();
  const valueType = payload?.valueType === 'number' ? 'number' : payload?.valueType === 'boolean' ? 'boolean' : payload?.valueType === 'string' ? 'string' : '';
  if (!typeId || !fieldKey || !label || !valueType) return { ok: false, error: 'Missing fields' };
  if (!/^[a-zA-Z][a-zA-Z0-9_]{1,31}$/.test(fieldKey)) return { ok: false, error: 'Invalid fieldKey' };
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    db.prepare(
      'INSERT INTO user_custom_fields (id, userId, typeId, fieldKey, label, valueType, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, userId, typeId, fieldKey, label, valueType, now, now);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: 'Already exists' };
  }
};

const updateCustomField = (db, userId, id, payload) => {
  const label = payload?.label !== undefined ? String(payload.label || '').trim() : undefined;
  if (label !== undefined && !label) return { ok: false, error: 'Invalid label' };
  const row = db.prepare('SELECT id FROM user_custom_fields WHERE id = ? AND userId = ?').get(String(id), userId);
  if (!row) return { ok: false, error: 'Not found' };
  const now = Date.now();
  if (label !== undefined) {
    db.prepare('UPDATE user_custom_fields SET label = ?, updatedAt = ? WHERE id = ? AND userId = ?').run(label, now, String(id), userId);
  }
  return { ok: true };
};

const deleteCustomField = (db, userId, id) => {
  const info = db.prepare('DELETE FROM user_custom_fields WHERE id = ? AND userId = ?').run(String(id), userId);
  return { ok: info.changes > 0 };
};

const getObjectCustomValues = (db, userId, objectId) => {
  const row = db.prepare('SELECT valuesJson FROM user_object_custom_values WHERE userId = ? AND objectId = ?').get(userId, String(objectId));
  if (!row?.valuesJson) return {};
  try {
    const parsed = JSON.parse(row.valuesJson);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const setObjectCustomValues = (db, userId, objectId, values) => {
  const now = Date.now();
  const json = JSON.stringify(values && typeof values === 'object' ? values : {});
  db.prepare(
    `INSERT INTO user_object_custom_values (userId, objectId, valuesJson, updatedAt) VALUES (?,?,?,?)
     ON CONFLICT(userId, objectId) DO UPDATE SET valuesJson=excluded.valuesJson, updatedAt=excluded.updatedAt`
  ).run(userId, String(objectId), json, now);
  return { ok: true };
};

const validateValuesAgainstFields = (fields, values) => {
  const v = values && typeof values === 'object' ? values : {};
  const byKey = new Map((fields || []).map((f) => [String(f.fieldKey), f]));
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const f = byKey.get(k);
    if (!f) continue;
    if (f.valueType === 'string') {
      out[k] = String(val ?? '');
    } else if (f.valueType === 'number') {
      const n = typeof val === 'number' ? val : Number(val);
      if (Number.isFinite(n)) out[k] = n;
    } else if (f.valueType === 'boolean') {
      out[k] = !!val;
    }
  }
  return out;
};

module.exports = {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getObjectCustomValues,
  setObjectCustomValues,
  validateValuesAgainstFields
};

