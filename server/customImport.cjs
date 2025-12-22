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
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const key = crypto.createHash('sha256').update(Buffer.from(secretB64, 'base64')).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    return plain;
  } catch {
    return null;
  }
};

const normalizeEmployeesResponse = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  const arr = payload.Dipendenti || payload.dipendenti || payload.DIPENDENTI;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => {
      const get = (k) => {
        const v = r?.[k];
        if (v === null || v === undefined) return '';
        return String(v).trim();
      };
      const externalId = get('Id');
      if (!externalId) return null;
      const isExternal = get('Esterno') === '1';
      return {
        externalId,
        firstName: get('Nome'),
        lastName: get('Cognome'),
        role: get('Ruolo'),
        dept1: get('Reparto1'),
        dept2: get('Reparto2'),
        dept3: get('Reparto3'),
        email: get('Email'),
        ext1: get('NumeroInterno1'),
        ext2: get('NumeroInterno2'),
        ext3: get('NumeroInterno3'),
        isExternal
      };
    })
    .filter(Boolean);
};

const fetchEmployeesFromApi = async (config) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const auth = Buffer.from(`${config.username}:${config.password}`, 'utf8').toString('base64');
    const bodyJson = typeof config.bodyJson === 'string' ? config.bodyJson.trim() : '';
    const useBody = !!bodyJson;
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        ...(useBody ? { 'Content-Type': 'application/json' } : {})
      },
      ...(useBody ? { body: bodyJson } : {}),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: text.slice(0, 500), rawSnippet: text.slice(0, 2000), contentType: res.headers.get('content-type') || '' };
    }
    let json = null;
    try {
      let cleaned = String(text || '').trim();
      // Strip UTF-8 BOM if present.
      cleaned = cleaned.replace(/^\uFEFF/, '');
      // Some APIs return a JSON fragment like: `"Dipendenti": [ ... ]` (missing outer braces).
      if (/^"Dipendenti"\s*:/.test(cleaned)) cleaned = `{${cleaned}}`;
      json = JSON.parse(cleaned);
    } catch {
      return {
        ok: false,
        status: res.status,
        error: 'Invalid JSON response',
        rawSnippet: String(text || '').slice(0, 2000),
        contentType: res.headers.get('content-type') || ''
      };
    }
    return { ok: true, status: res.status, employees: normalizeEmployeesResponse(json), raw: json };
  } catch (e) {
    return { ok: false, status: 0, error: e?.name === 'AbortError' ? 'Timeout' : String(e?.message || e) };
  } finally {
    clearTimeout(timeout);
  }
};

const getImportConfig = (db, authSecret, clientId) => {
  const row = db
    .prepare('SELECT clientId, url, username, passwordEnc, bodyJson FROM client_user_import WHERE clientId = ?')
    .get(clientId);
  if (!row) return null;
  const password = decryptString(authSecret, row.passwordEnc);
  return { clientId: row.clientId, url: row.url, username: row.username, password, bodyJson: row.bodyJson || '' };
};

const getImportConfigSafe = (db, clientId) => {
  const row = db
    .prepare('SELECT clientId, url, username, passwordEnc, bodyJson, updatedAt FROM client_user_import WHERE clientId = ?')
    .get(clientId);
  if (!row) return null;
  return {
    clientId: row.clientId,
    url: row.url,
    username: row.username,
    bodyJson: row.bodyJson || '',
    hasPassword: !!row.passwordEnc,
    updatedAt: row.updatedAt
  };
};

const upsertImportConfig = (db, authSecret, payload) => {
  const now = Date.now();
  const prev = db.prepare('SELECT passwordEnc, bodyJson FROM client_user_import WHERE clientId = ?').get(payload.clientId);
  const nextPasswordEnc =
    payload.password !== undefined
      ? payload.password
        ? encryptString(authSecret, payload.password)
        : null
      : prev?.passwordEnc || null;
  const nextBodyJson = payload.bodyJson !== undefined ? String(payload.bodyJson || '') : prev?.bodyJson || '';
  db.prepare(
    `INSERT INTO client_user_import (clientId, url, username, passwordEnc, bodyJson, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(clientId) DO UPDATE SET url=excluded.url, username=excluded.username, passwordEnc=excluded.passwordEnc, bodyJson=excluded.bodyJson, updatedAt=excluded.updatedAt`
  ).run(payload.clientId, payload.url, payload.username, nextPasswordEnc, nextBodyJson, now);
  return getImportConfigSafe(db, payload.clientId);
};

const upsertExternalUsers = (db, clientId, employees) => {
  const now = Date.now();
  const existing = db
    .prepare('SELECT externalId, firstName, lastName, role, dept1, dept2, dept3, email, ext1, ext2, ext3, isExternal, hidden, present FROM external_users WHERE clientId = ?')
    .all(clientId);
  const existingById = new Map(existing.map((r) => [String(r.externalId), r]));
  const incomingIds = new Set(employees.map((e) => String(e.externalId)));

  const insert = db.prepare(
    `INSERT INTO external_users (clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`
  );
  const update = db.prepare(
    `UPDATE external_users
     SET firstName=?, lastName=?, role=?, dept1=?, dept2=?, dept3=?, email=?, ext1=?, ext2=?, ext3=?, isExternal=?, present=1, lastSeenAt=?, updatedAt=?
     WHERE clientId=? AND externalId=?`
  );
  const markMissing = db.prepare(`UPDATE external_users SET present=0, updatedAt=? WHERE clientId=? AND externalId=?`);

  const created = [];
  const updated = [];
  const missing = [];

  for (const e of employees) {
    const id = String(e.externalId);
    const prev = existingById.get(id);
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

  for (const prev of existing) {
    const id = String(prev.externalId);
    if (!incomingIds.has(id) && Number(prev.present || 1) === 1) {
      markMissing.run(now, clientId, id);
      missing.push({ externalId: id, firstName: prev.firstName || '', lastName: prev.lastName || '' });
    }
  }

  return {
    summary: { totalBefore: existing.length, totalNow: employees.length, created: created.length, updated: updated.length, missing: missing.length },
    created,
    updated,
    missing
  };
};

const listExternalUsers = (db, params) => {
  const q = String(params.q || '').trim().toLowerCase();
  const includeHidden = !!params.includeHidden;
  const includeMissing = !!params.includeMissing;
  const rows = db
    .prepare(
      `SELECT clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt
       FROM external_users
       WHERE clientId = ?`
    )
    .all(params.clientId)
    .filter((r) => (includeHidden ? true : Number(r.hidden) !== 1))
    .filter((r) => (includeMissing ? true : Number(r.present) === 1))
    .filter((r) => {
      if (!q) return true;
      const hay = `${r.externalId} ${r.firstName} ${r.lastName} ${r.role} ${r.dept1} ${r.dept2} ${r.dept3} ${r.email}`.toLowerCase();
      return hay.includes(q);
    })
    .map((r) => ({
      clientId: r.clientId,
      externalId: String(r.externalId),
      firstName: r.firstName || '',
      lastName: r.lastName || '',
      role: r.role || '',
      dept1: r.dept1 || '',
      dept2: r.dept2 || '',
      dept3: r.dept3 || '',
      email: r.email || '',
      ext1: r.ext1 || '',
      ext2: r.ext2 || '',
      ext3: r.ext3 || '',
      isExternal: !!r.isExternal,
      hidden: !!r.hidden,
      present: !!r.present,
      lastSeenAt: r.lastSeenAt || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  return rows;
};

const setExternalUserHidden = (db, clientId, externalId, hidden) => {
  db.prepare('UPDATE external_users SET hidden=?, updatedAt=? WHERE clientId=? AND externalId=?').run(hidden ? 1 : 0, Date.now(), clientId, externalId);
};

module.exports = {
  encryptString,
  decryptString,
  normalizeEmployeesResponse,
  fetchEmployeesFromApi,
  getImportConfig,
  getImportConfigSafe,
  upsertImportConfig,
  upsertExternalUsers,
  listExternalUsers,
  setExternalUserHidden
};
