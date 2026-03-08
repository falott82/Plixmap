const crypto = require('crypto');

const encryptString = (secretB64, plaintext) => {
  if (!plaintext) return null;
  try {
    const key = crypto.createHash('sha256').update(Buffer.from(secretB64, 'base64')).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  } catch {
    return null;
  }
};

const decryptString = (secretB64, blobB64) => {
  if (!blobB64) return null;
  try {
    const buf = Buffer.from(String(blobB64), 'base64');
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const key = crypto.createHash('sha256').update(Buffer.from(secretB64, 'base64')).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};

const getImportConfigInternal = (db, authSecret, tableName, clientId) => {
  const row = db
    .prepare(`SELECT clientId, url, username, passwordEnc, method, bodyJson FROM ${tableName} WHERE clientId = ?`)
    .get(clientId);
  if (!row) return null;
  return {
    clientId: row.clientId,
    url: row.url,
    username: row.username,
    password: decryptString(authSecret, row.passwordEnc),
    method: row.method || 'POST',
    bodyJson: row.bodyJson || ''
  };
};

const getImportConfigSafeInternal = (db, tableName, clientId) => {
  const row = db
    .prepare(`SELECT clientId, url, username, passwordEnc, method, bodyJson, updatedAt FROM ${tableName} WHERE clientId = ?`)
    .get(clientId);
  if (!row) return null;
  return {
    clientId: row.clientId,
    url: row.url,
    username: row.username,
    method: row.method || 'POST',
    bodyJson: row.bodyJson || '',
    hasPassword: !!row.passwordEnc,
    updatedAt: row.updatedAt
  };
};

const upsertImportConfigInternal = (db, authSecret, tableName, payload) => {
  const now = Date.now();
  const prev = db.prepare(`SELECT passwordEnc, bodyJson, method FROM ${tableName} WHERE clientId = ?`).get(payload.clientId);
  const nextPasswordEnc =
    payload.password !== undefined
      ? payload.password
        ? encryptString(authSecret, payload.password)
        : null
      : prev?.passwordEnc || null;
  const nextBodyJson = payload.bodyJson !== undefined ? String(payload.bodyJson || '') : prev?.bodyJson || '';
  const nextMethod = payload.method !== undefined ? String(payload.method || 'POST') : prev?.method || 'POST';
  db.prepare(
    `INSERT INTO ${tableName} (clientId, url, username, passwordEnc, method, bodyJson, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(clientId) DO UPDATE SET url=excluded.url, username=excluded.username, passwordEnc=excluded.passwordEnc, method=excluded.method, bodyJson=excluded.bodyJson, updatedAt=excluded.updatedAt`
  ).run(payload.clientId, payload.url, payload.username, nextPasswordEnc, nextMethod, nextBodyJson, now);
  return getImportConfigSafeInternal(db, tableName, payload.clientId);
};

const getImportConfig = (db, authSecret, clientId) => getImportConfigInternal(db, authSecret, 'client_user_import', clientId);

const getDeviceImportConfig = (db, authSecret, clientId) => getImportConfigInternal(db, authSecret, 'client_device_import', clientId);

const getImportConfigSafe = (db, clientId) => getImportConfigSafeInternal(db, 'client_user_import', clientId);

const getDeviceImportConfigSafe = (db, clientId) => getImportConfigSafeInternal(db, 'client_device_import', clientId);

const upsertImportConfig = (db, authSecret, payload) => upsertImportConfigInternal(db, authSecret, 'client_user_import', payload);

const upsertDeviceImportConfig = (db, authSecret, payload) =>
  upsertImportConfigInternal(db, authSecret, 'client_device_import', payload);

module.exports = {
  encryptString,
  decryptString,
  getImportConfig,
  getDeviceImportConfig,
  getImportConfigSafe,
  getDeviceImportConfigSafe,
  upsertImportConfig,
  upsertDeviceImportConfig
};
