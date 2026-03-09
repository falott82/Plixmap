const crypto = require('crypto');
const { serverConfig } = require('./config.cjs');
const {
  normalizeEmployeesResponse,
  normalizeDevicesResponse,
  fetchEmployeesFromApi: fetchEmployeesFromApiInternal,
  fetchDevicesFromApi: fetchDevicesFromApiInternal,
  validateImportUrl: validateImportUrlInternal,
  readResponseText
} = require('./customImport/network.cjs');
const {
  encryptString,
  decryptString,
  getImportConfig,
  getDeviceImportConfig,
  getLdapImportConfig,
  getImportConfigSafe,
  getDeviceImportConfigSafe,
  getLdapImportConfigSafe,
  upsertImportConfig,
  upsertDeviceImportConfig,
  upsertLdapImportConfig
} = require('./customImport/configStore.cjs');

const MAX_IMPORT_RESPONSE_BYTES = serverConfig.importMaxResponseBytes;
const ALLOW_PRIVATE_IMPORT = serverConfig.importAllowPrivate;

const isManualExternalId = (externalId) => String(externalId || '').trim().toLowerCase().startsWith('manual:');

const mapExternalUserRow = (r) => ({
  clientId: r.clientId,
  externalId: String(r.externalId),
  firstName: r.firstName || '',
  lastName: r.lastName || '',
  role: r.role || '',
  dept1: r.dept1 || '',
  dept2: r.dept2 || '',
  dept3: r.dept3 || '',
  email: r.email || '',
  mobile: r.mobile || '',
  ext1: r.ext1 || '',
  ext2: r.ext2 || '',
  ext3: r.ext3 || '',
  isExternal: Number(r.isExternal) === 1,
  hidden: Number(r.hidden) === 1,
  present: Number(r.present) === 1,
  lastSeenAt: r.lastSeenAt || null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  manual: isManualExternalId(r.externalId),
  sourceKind: isManualExternalId(r.externalId) ? 'manual' : 'imported'
});

const isManualDeviceId = (devId) => String(devId || '').trim().toLowerCase().startsWith('manual:');

const mapExternalDeviceRow = (r) => ({
  clientId: String(r.clientId || ''),
  devId: String(r.devId || ''),
  deviceType: String(r.deviceType || ''),
  deviceName: String(r.deviceName || ''),
  manufacturer: String(r.manufacturer || ''),
  model: String(r.model || ''),
  serialNumber: String(r.serialNumber || ''),
  hidden: Number(r.hidden) === 1,
  present: Number(r.present) === 1,
  lastSeenAt: r.lastSeenAt || null,
  createdAt: Number(r.createdAt) || 0,
  updatedAt: Number(r.updatedAt) || 0,
  manual: isManualDeviceId(r.devId),
  sourceKind: isManualDeviceId(r.devId) ? 'manual' : 'imported'
});

const toStr = (v) => (v === null || v === undefined ? '' : String(v).trim());
const normalizePhone = (v) => toStr(v).replace(/\s+/g, '');
const normalizeUpperText = (v) => toStr(v).toUpperCase();
const normalizeExternalUserPayload = (payload) => {
  return {
    externalId: toStr(payload?.externalId),
    firstName: normalizeUpperText(payload?.firstName),
    lastName: normalizeUpperText(payload?.lastName),
    role: normalizeUpperText(payload?.role),
    dept1: normalizeUpperText(payload?.dept1),
    dept2: normalizeUpperText(payload?.dept2),
    dept3: normalizeUpperText(payload?.dept3),
    email: toStr(payload?.email).toLowerCase(),
    mobile: normalizePhone(payload?.mobile),
    ext1: normalizeUpperText(payload?.ext1),
    ext2: normalizeUpperText(payload?.ext2),
    ext3: normalizeUpperText(payload?.ext3),
    isExternal: !!payload?.isExternal
  };
};
const normalizeManualExternalUserInput = (payload) => normalizeExternalUserPayload(payload);

const makeManualExternalId = () => `manual:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeEmailKey = (value) => String(value || '').trim().toLowerCase();

const findExternalEmailConflict = (db, clientId, email, currentExternalId = '') => {
  const emailKey = normalizeEmailKey(email);
  if (!emailKey) return null;
  const rows = db
    .prepare('SELECT externalId, firstName, lastName, email FROM external_users WHERE clientId = ?')
    .all(clientId);
  const currentKey = String(currentExternalId || '').trim();
  for (const row of rows) {
    const rowExternalId = String(row.externalId || '').trim();
    if (currentKey && rowExternalId === currentKey) continue;
    if (normalizeEmailKey(row.email) === emailKey) {
      return {
        externalId: rowExternalId,
        firstName: String(row.firstName || ''),
        lastName: String(row.lastName || ''),
        email: String(row.email || '')
      };
    }
  }
  return null;
};

const fetchEmployeesFromApi = async (config) =>
  fetchEmployeesFromApiInternal(config, {
    maxResponseBytes: MAX_IMPORT_RESPONSE_BYTES,
    defaultAllowPrivate: ALLOW_PRIVATE_IMPORT
  });

const fetchDevicesFromApi = async (config) =>
  fetchDevicesFromApiInternal(config, {
    maxResponseBytes: MAX_IMPORT_RESPONSE_BYTES,
    defaultAllowPrivate: ALLOW_PRIVATE_IMPORT
  });

const validateImportUrl = async (rawUrl, options = {}) =>
  validateImportUrlInternal(rawUrl, {
    ...options,
    defaultAllowPrivate: ALLOW_PRIVATE_IMPORT
  });

const upsertExternalUsers = (db, clientId, employees, options = {}) => {
  const now = Date.now();
  const shouldMarkMissing = options.markMissing !== false;
  const normalizedEmployees = (employees || []).map((employee) => normalizeExternalUserPayload(employee));
  const existing = db
    .prepare(
      'SELECT externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present FROM external_users WHERE clientId = ?'
    )
    .all(clientId);
  const existingById = new Map(existing.map((r) => [String(r.externalId), r]));
  const incomingIds = new Set(normalizedEmployees.map((e) => String(e.externalId)));

  const insert = db.prepare(
    `INSERT INTO external_users (clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`
  );
  const update = db.prepare(
    `UPDATE external_users
     SET firstName=?, lastName=?, role=?, dept1=?, dept2=?, dept3=?, email=?, mobile=?, ext1=?, ext2=?, ext3=?, isExternal=?, present=1, lastSeenAt=?, updatedAt=?
     WHERE clientId=? AND externalId=?`
  );
  const markMissingStmt = db.prepare(`UPDATE external_users SET present=0, updatedAt=? WHERE clientId=? AND externalId=?`);

  const created = [];
  const updated = [];
  const missing = [];
  const duplicates = [];
  const incomingEmailCounts = new Map();
  for (const e of normalizedEmployees) {
    const emailKey = normalizeEmailKey(e?.email);
    if (!emailKey) continue;
    incomingEmailCounts.set(emailKey, (incomingEmailCounts.get(emailKey) || 0) + 1);
  }
  const existingEmailOwner = new Map();
  for (const row of existing) {
    const emailKey = normalizeEmailKey(row.email);
    if (!emailKey) continue;
    const key = String(row.externalId || '');
    if (!existingEmailOwner.has(emailKey)) existingEmailOwner.set(emailKey, key);
  }

  for (const e of normalizedEmployees) {
    const id = String(e.externalId);
    const prev = existingById.get(id);
    const emailKey = normalizeEmailKey(e?.email);
    const duplicateInIncoming = !!emailKey && (incomingEmailCounts.get(emailKey) || 0) > 1;
    const existingOwner = emailKey ? String(existingEmailOwner.get(emailKey) || '') : '';
    const duplicateAgainstExisting = !!emailKey && !!existingOwner && existingOwner !== id;
    if (duplicateInIncoming || duplicateAgainstExisting) {
      duplicates.push({
        externalId: id,
        email: String(e.email || ''),
        firstName: String(e.firstName || ''),
        lastName: String(e.lastName || ''),
        reason: duplicateInIncoming ? 'duplicate_email_in_import' : 'duplicate_email_existing',
        conflictExternalId: duplicateAgainstExisting ? existingOwner : ''
      });
      if (prev) {
        db.prepare('UPDATE external_users SET present=1, lastSeenAt=?, updatedAt=? WHERE clientId=? AND externalId=?').run(now, now, clientId, id);
      }
      continue;
    }
    if (!prev) {
      insert.run(
        clientId,
        id,
        e.firstName || '',
        e.lastName || '',
        e.role || '',
        e.dept1 || '',
        e.dept2 || '',
        e.dept3 || '',
        e.email || '',
        e.mobile || '',
        e.ext1 || '',
        e.ext2 || '',
        e.ext3 || '',
        e.isExternal ? 1 : 0,
        now,
        now,
        now
      );
      created.push({ ...e });
      continue;
    }
    const changed =
      String(prev.firstName || '') !== String(e.firstName || '') ||
      String(prev.lastName || '') !== String(e.lastName || '') ||
      String(prev.role || '') !== String(e.role || '') ||
      String(prev.dept1 || '') !== String(e.dept1 || '') ||
      String(prev.dept2 || '') !== String(e.dept2 || '') ||
      String(prev.dept3 || '') !== String(e.dept3 || '') ||
      String(prev.email || '') !== String(e.email || '') ||
      String(prev.mobile || '') !== String(e.mobile || '') ||
      String(prev.ext1 || '') !== String(e.ext1 || '') ||
      String(prev.ext2 || '') !== String(e.ext2 || '') ||
      String(prev.ext3 || '') !== String(e.ext3 || '') ||
      Number(prev.isExternal || 0) !== (e.isExternal ? 1 : 0) ||
      Number(prev.present || 1) !== 1;
    if (changed) {
      update.run(
        e.firstName || '',
        e.lastName || '',
        e.role || '',
        e.dept1 || '',
        e.dept2 || '',
        e.dept3 || '',
        e.email || '',
        e.mobile || '',
        e.ext1 || '',
        e.ext2 || '',
        e.ext3 || '',
        e.isExternal ? 1 : 0,
        now,
        now,
        clientId,
        id
      );
      updated.push({ ...e });
    } else {
      // keep lastSeen fresh
      db.prepare('UPDATE external_users SET present=1, lastSeenAt=?, updatedAt=? WHERE clientId=? AND externalId=?').run(now, now, clientId, id);
    }
  }

  if (shouldMarkMissing) {
    for (const prev of existing) {
      const id = String(prev.externalId);
      if (isManualExternalId(id)) continue;
      if (!incomingIds.has(id) && Number(prev.present || 1) === 1) {
        markMissingStmt.run(now, clientId, id);
        missing.push({ externalId: id, firstName: prev.firstName || '', lastName: prev.lastName || '' });
      }
    }
  }

  return {
    summary: {
      totalBefore: existing.length,
      totalNow: normalizedEmployees.length,
      created: created.length,
      updated: updated.length,
      missing: missing.length,
      duplicateEmails: duplicates.length
    },
    created,
    updated,
    missing,
    duplicates
  };
};

const listExternalUsers = (db, params) => {
  const q = String(params.q || '').trim().toLowerCase();
  const includeHidden = !!params.includeHidden;
  const includeMissing = !!params.includeMissing;
  const limit = Number.isFinite(Number(params.limit)) ? Math.max(0, Number(params.limit)) : null;
  const offset = Number.isFinite(Number(params.offset)) ? Math.max(0, Number(params.offset)) : null;
  const where = ['clientId = ?'];
  const values = [params.clientId];
  if (!includeHidden) where.push('hidden = 0');
  if (!includeMissing) where.push('present = 1');
  if (q) {
    const escaped = q.replace(/[%_]/g, '\\$&');
    const like = `%${escaped}%`;
    where.push(
      '(lower(externalId) LIKE ? ESCAPE \'\\\\\' OR lower(firstName) LIKE ? ESCAPE \'\\\\\' OR lower(lastName) LIKE ? ESCAPE \'\\\\\' OR lower(role) LIKE ? ESCAPE \'\\\\\' OR lower(dept1) LIKE ? ESCAPE \'\\\\\' OR lower(dept2) LIKE ? ESCAPE \'\\\\\' OR lower(dept3) LIKE ? ESCAPE \'\\\\\' OR lower(email) LIKE ? ESCAPE \'\\\\\' OR lower(mobile) LIKE ? ESCAPE \'\\\\\')'
    );
    values.push(like, like, like, like, like, like, like, like, like);
  }
  let sql = `SELECT clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt
       FROM external_users
       WHERE ${where.join(' AND ')}`;
  if (limit !== null) {
    sql += ' LIMIT ?';
    values.push(limit);
    if (offset !== null) {
      sql += ' OFFSET ?';
      values.push(offset);
    }
  }
  const rows = db
    .prepare(sql)
    .all(...values)
    .map(mapExternalUserRow);
  return rows;
};

const getExternalUser = (db, clientId, externalId) => {
  const row = db
    .prepare(
      `SELECT clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt
       FROM external_users WHERE clientId = ? AND externalId = ?`
    )
    .get(clientId, externalId);
  return row ? mapExternalUserRow(row) : null;
};

const updateExternalUser = (db, clientId, externalId, payload) => {
  const now = Date.now();
  const row = getExternalUser(db, clientId, externalId);
  if (!row) {
    const err = new Error('External user not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const data = normalizeExternalUserPayload({ ...(payload || {}), externalId });
  if (!data.firstName && !data.lastName && !data.email) {
    const err = new Error('Missing user identity');
    err.code = 'VALIDATION';
    throw err;
  }
  const emailConflict = findExternalEmailConflict(db, clientId, data.email, externalId);
  if (emailConflict) {
    const err = new Error(`Duplicate email: ${data.email}`);
    err.code = 'DUPLICATE_EMAIL';
    err.details = emailConflict;
    throw err;
  }
  db.prepare(
    `UPDATE external_users
     SET firstName=?, lastName=?, role=?, dept1=?, dept2=?, dept3=?, email=?, mobile=?, ext1=?, ext2=?, ext3=?, isExternal=?, present=1, updatedAt=?
     WHERE clientId=? AND externalId=?`
  ).run(
    data.firstName,
    data.lastName,
    data.role,
    data.dept1,
    data.dept2,
    data.dept3,
    data.email,
    data.mobile,
    data.ext1,
    data.ext2,
    data.ext3,
    data.isExternal ? 1 : 0,
    now,
    clientId,
    externalId
  );
  return getExternalUser(db, clientId, externalId);
};

const setExternalUserHidden = (db, clientId, externalId, hidden) => {
  db.prepare('UPDATE external_users SET hidden=?, updatedAt=? WHERE clientId=? AND externalId=?').run(hidden ? 1 : 0, Date.now(), clientId, externalId);
};

const upsertManualExternalUser = (db, clientId, payload, options = {}) => {
  const now = Date.now();
  const data = normalizeManualExternalUserInput(payload || {});
  let externalId = String(options.externalId || data.externalId || '').trim();
  if (!externalId) externalId = makeManualExternalId();
  if (!isManualExternalId(externalId)) {
    externalId = `manual:${externalId}`;
  }
  const exists = db.prepare('SELECT externalId FROM external_users WHERE clientId=? AND externalId=?').get(clientId, externalId);
  if (options.externalId && !exists) {
    const err = new Error('External user not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!data.firstName && !data.lastName && !data.email) {
    const err = new Error('Missing user identity');
    err.code = 'VALIDATION';
    throw err;
  }
  const emailConflict = findExternalEmailConflict(db, clientId, data.email, externalId);
  if (emailConflict) {
    const err = new Error(`Duplicate email: ${data.email}`);
    err.code = 'DUPLICATE_EMAIL';
    err.details = emailConflict;
    throw err;
  }
  if (exists) {
    db.prepare(
      `UPDATE external_users
       SET firstName=?, lastName=?, role=?, dept1=?, dept2=?, dept3=?, email=?, mobile=?, ext1=?, ext2=?, ext3=?, isExternal=?, present=1, updatedAt=?
       WHERE clientId=? AND externalId=?`
    ).run(
      data.firstName,
      data.lastName,
      data.role,
      data.dept1,
      data.dept2,
      data.dept3,
      data.email,
      data.mobile,
      data.ext1,
      data.ext2,
      data.ext3,
      data.isExternal ? 1 : 0,
      now,
      clientId,
      externalId
    );
  } else {
    db.prepare(
      `INSERT INTO external_users (clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`
    ).run(
      clientId,
      externalId,
      data.firstName,
      data.lastName,
      data.role,
      data.dept1,
      data.dept2,
      data.dept3,
      data.email,
      data.mobile,
      data.ext1,
      data.ext2,
      data.ext3,
      data.isExternal ? 1 : 0,
      now,
      now,
      now
    );
  }
  return getExternalUser(db, clientId, externalId);
};

const deleteManualExternalUser = (db, clientId, externalId) => {
  if (!isManualExternalId(externalId)) {
    const err = new Error('Only manual users can be deleted');
    err.code = 'FORBIDDEN_KIND';
    throw err;
  }
  const row = getExternalUser(db, clientId, externalId);
  if (!row) return { ok: false, removed: 0 };
  const result = db.prepare('DELETE FROM external_users WHERE clientId=? AND externalId=?').run(clientId, externalId);
  return { ok: true, removed: Number(result.changes || 0), row };
};

const normalizeManualDeviceInput = (payload) => {
  const toStr = (v) => (v === null || v === undefined ? '' : String(v).trim());
  return {
    devId: toStr(payload?.devId),
    deviceType: toStr(payload?.deviceType),
    deviceName: toStr(payload?.deviceName),
    manufacturer: toStr(payload?.manufacturer),
    model: toStr(payload?.model),
    serialNumber: toStr(payload?.serialNumber)
  };
};

const makeManualDeviceId = () => `manual:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const upsertExternalDevices = (db, clientId, devices, options = {}) => {
  const now = Date.now();
  const shouldMarkMissing = options.markMissing !== false;
  const existing = db
    .prepare(
      'SELECT devId, deviceType, deviceName, manufacturer, model, serialNumber, hidden, present FROM external_devices WHERE clientId = ?'
    )
    .all(clientId);
  const existingById = new Map(existing.map((r) => [String(r.devId), r]));
  const incomingIds = new Set((devices || []).map((d) => String(d.devId || '').trim()).filter(Boolean));

  const insert = db.prepare(
    `INSERT INTO external_devices (clientId, devId, deviceType, deviceName, manufacturer, model, serialNumber, hidden, present, lastSeenAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`
  );
  const update = db.prepare(
    `UPDATE external_devices
     SET deviceType=?, deviceName=?, manufacturer=?, model=?, serialNumber=?, present=1, lastSeenAt=?, updatedAt=?
     WHERE clientId=? AND devId=?`
  );
  const markMissingStmt = db.prepare(`UPDATE external_devices SET present=0, updatedAt=? WHERE clientId=? AND devId=?`);

  const created = [];
  const updated = [];
  const missing = [];

  for (const raw of devices || []) {
    const row = normalizeManualDeviceInput(raw || {});
    const devId = String(row.devId || '').trim();
    if (!devId) continue;
    const prev = existingById.get(devId);
    if (!prev) {
      insert.run(clientId, devId, row.deviceType, row.deviceName, row.manufacturer, row.model, row.serialNumber, now, now, now);
      created.push({ ...row, devId });
      continue;
    }
    const changed =
      String(prev.deviceType || '') !== row.deviceType ||
      String(prev.deviceName || '') !== row.deviceName ||
      String(prev.manufacturer || '') !== row.manufacturer ||
      String(prev.model || '') !== row.model ||
      String(prev.serialNumber || '') !== row.serialNumber ||
      Number(prev.present || 1) !== 1;
    if (changed) {
      update.run(row.deviceType, row.deviceName, row.manufacturer, row.model, row.serialNumber, now, now, clientId, devId);
      updated.push({ ...row, devId });
    } else {
      db.prepare('UPDATE external_devices SET present=1, lastSeenAt=?, updatedAt=? WHERE clientId=? AND devId=?').run(
        now,
        now,
        clientId,
        devId
      );
    }
  }

  if (shouldMarkMissing) {
    for (const prev of existing) {
      const devId = String(prev.devId || '');
      if (isManualDeviceId(devId)) continue;
      if (!incomingIds.has(devId) && Number(prev.present || 1) === 1) {
        markMissingStmt.run(now, clientId, devId);
        missing.push({
          devId,
          deviceType: String(prev.deviceType || ''),
          deviceName: String(prev.deviceName || '')
        });
      }
    }
  }

  return {
    summary: {
      totalBefore: existing.length,
      totalNow: devices.length,
      created: created.length,
      updated: updated.length,
      missing: missing.length
    },
    created,
    updated,
    missing
  };
};

const listExternalDevices = (db, params) => {
  const q = String(params.q || '').trim().toLowerCase();
  const includeHidden = !!params.includeHidden;
  const includeMissing = !!params.includeMissing;
  const where = ['clientId = ?'];
  const values = [params.clientId];
  if (!includeHidden) where.push('hidden = 0');
  if (!includeMissing) where.push('present = 1');
  if (q) {
    const escaped = q.replace(/[%_]/g, '\\$&');
    const like = `%${escaped}%`;
    where.push(
      '(lower(devId) LIKE ? ESCAPE \'\\\\\' OR lower(deviceType) LIKE ? ESCAPE \'\\\\\' OR lower(deviceName) LIKE ? ESCAPE \'\\\\\' OR lower(manufacturer) LIKE ? ESCAPE \'\\\\\' OR lower(model) LIKE ? ESCAPE \'\\\\\' OR lower(serialNumber) LIKE ? ESCAPE \'\\\\\')'
    );
    values.push(like, like, like, like, like, like);
  }
  const rows = db
    .prepare(
      `SELECT clientId, devId, deviceType, deviceName, manufacturer, model, serialNumber, hidden, present, lastSeenAt, createdAt, updatedAt
       FROM external_devices
       WHERE ${where.join(' AND ')}
       ORDER BY deviceName COLLATE NOCASE, devId COLLATE NOCASE`
    )
    .all(...values)
    .map(mapExternalDeviceRow);
  return rows;
};

const getExternalDevice = (db, clientId, devId) => {
  const row = db
    .prepare(
      `SELECT clientId, devId, deviceType, deviceName, manufacturer, model, serialNumber, hidden, present, lastSeenAt, createdAt, updatedAt
       FROM external_devices WHERE clientId = ? AND devId = ?`
    )
    .get(clientId, devId);
  return row ? mapExternalDeviceRow(row) : null;
};

const setExternalDeviceHidden = (db, clientId, devId, hidden) => {
  db.prepare('UPDATE external_devices SET hidden=?, updatedAt=? WHERE clientId=? AND devId=?').run(hidden ? 1 : 0, Date.now(), clientId, devId);
};

const upsertManualExternalDevice = (db, clientId, payload, options = {}) => {
  const now = Date.now();
  const data = normalizeManualDeviceInput(payload || {});
  let devId = String(options.devId || data.devId || '').trim();
  if (!devId) devId = makeManualDeviceId();
  if (!isManualDeviceId(devId)) devId = `manual:${devId}`;
  const exists = db.prepare('SELECT devId FROM external_devices WHERE clientId=? AND devId=?').get(clientId, devId);
  if (options.devId && !exists) {
    const err = new Error('Device not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!data.deviceName && !data.serialNumber && !data.deviceType) {
    const err = new Error('Missing device identity');
    err.code = 'VALIDATION';
    throw err;
  }
  if (exists) {
    db.prepare(
      `UPDATE external_devices
       SET deviceType=?, deviceName=?, manufacturer=?, model=?, serialNumber=?, present=1, updatedAt=?
       WHERE clientId=? AND devId=?`
    ).run(data.deviceType, data.deviceName, data.manufacturer, data.model, data.serialNumber, now, clientId, devId);
  } else {
    db.prepare(
      `INSERT INTO external_devices (clientId, devId, deviceType, deviceName, manufacturer, model, serialNumber, hidden, present, lastSeenAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`
    ).run(clientId, devId, data.deviceType, data.deviceName, data.manufacturer, data.model, data.serialNumber, now, now, now);
  }
  return getExternalDevice(db, clientId, devId);
};

const deleteManualExternalDevice = (db, clientId, devId) => {
  if (!isManualDeviceId(devId)) {
    const err = new Error('Only manual devices can be deleted');
    err.code = 'FORBIDDEN_KIND';
    throw err;
  }
  const row = getExternalDevice(db, clientId, devId);
  if (!row) return { ok: false, removed: 0 };
  const result = db.prepare('DELETE FROM external_devices WHERE clientId=? AND devId=?').run(clientId, devId);
  return { ok: true, removed: Number(result.changes || 0), row };
};

const listDeviceImportSummary = (db) => {
  const rows = db
    .prepare(
      `SELECT clientId,
              COUNT(*) as total,
              SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) as presentCount,
              SUM(CASE WHEN present = 0 THEN 1 ELSE 0 END) as missingCount,
              SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) as hiddenCount,
              MAX(updatedAt) as lastImportAt
       FROM external_devices
       GROUP BY clientId`
    )
    .all();
  const cfgRows = db.prepare('SELECT clientId, updatedAt FROM client_device_import').all();
  const byClient = new Map();
  for (const row of rows) {
    byClient.set(row.clientId, {
      clientId: row.clientId,
      total: Number(row.total || 0),
      presentCount: Number(row.presentCount || 0),
      missingCount: Number(row.missingCount || 0),
      hiddenCount: Number(row.hiddenCount || 0),
      lastImportAt: row.lastImportAt || null,
      configUpdatedAt: null
    });
  }
  for (const row of cfgRows) {
    const entry = byClient.get(row.clientId) || {
      clientId: row.clientId,
      total: 0,
      presentCount: 0,
      missingCount: 0,
      hiddenCount: 0,
      lastImportAt: null,
      configUpdatedAt: null
    };
    entry.configUpdatedAt = row.updatedAt || null;
    byClient.set(row.clientId, entry);
  }
  return Array.from(byClient.values());
};

const listImportSummary = (db) => {
  const userRows = db
    .prepare(
      `SELECT clientId,
              COUNT(*) as total,
              SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) as presentCount,
              SUM(CASE WHEN present = 0 THEN 1 ELSE 0 END) as missingCount,
              SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) as hiddenCount,
              MAX(updatedAt) as lastImportAt
       FROM external_users
       GROUP BY clientId`
    )
    .all();
  const cfgRows = db.prepare('SELECT clientId, updatedAt FROM client_user_import').all();
  const ldapCfgRows = db.prepare('SELECT clientId, updatedAt FROM client_ldap_import').all();
  const byClient = new Map();
  for (const row of userRows) {
    byClient.set(row.clientId, {
      clientId: row.clientId,
      total: Number(row.total || 0),
      presentCount: Number(row.presentCount || 0),
      missingCount: Number(row.missingCount || 0),
      hiddenCount: Number(row.hiddenCount || 0),
      lastImportAt: row.lastImportAt || null,
      configUpdatedAt: null,
      ldapConfigUpdatedAt: null
    });
  }
  for (const row of cfgRows) {
    const entry = byClient.get(row.clientId) || {
      clientId: row.clientId,
      total: 0,
      presentCount: 0,
      missingCount: 0,
      hiddenCount: 0,
      lastImportAt: null,
      configUpdatedAt: null,
      ldapConfigUpdatedAt: null
    };
    entry.configUpdatedAt = row.updatedAt || null;
    byClient.set(row.clientId, entry);
  }
  for (const row of ldapCfgRows) {
    const entry = byClient.get(row.clientId) || {
      clientId: row.clientId,
      total: 0,
      presentCount: 0,
      missingCount: 0,
      hiddenCount: 0,
      lastImportAt: null,
      configUpdatedAt: null,
      ldapConfigUpdatedAt: null
    };
    entry.ldapConfigUpdatedAt = row.updatedAt || null;
    byClient.set(row.clientId, entry);
  }
  return Array.from(byClient.values());
};

module.exports = {
  encryptString,
  decryptString,
  normalizeEmployeesResponse,
  normalizeDevicesResponse,
  fetchEmployeesFromApi,
  fetchDevicesFromApi,
  getImportConfig,
  getDeviceImportConfig,
  getLdapImportConfig,
  getImportConfigSafe,
  getDeviceImportConfigSafe,
  getLdapImportConfigSafe,
  upsertImportConfig,
  upsertDeviceImportConfig,
  upsertLdapImportConfig,
  upsertExternalUsers,
  upsertExternalDevices,
  listExternalUsers,
  listExternalDevices,
  getExternalUser,
  getExternalDevice,
  updateExternalUser,
  setExternalUserHidden,
  setExternalDeviceHidden,
  listImportSummary,
  listDeviceImportSummary,
  isManualExternalId,
  isManualDeviceId,
  normalizeExternalUserPayload,
  upsertManualExternalUser,
  upsertManualExternalDevice,
  deleteManualExternalUser
  ,deleteManualExternalDevice
  ,findExternalEmailConflict
  ,validateImportUrl
  ,readResponseText
};
