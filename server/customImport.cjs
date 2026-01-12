const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

const MAX_IMPORT_RESPONSE_BYTES = (() => {
  const raw = Number(process.env.DESKLY_IMPORT_MAX_BYTES || '');
  return Number.isFinite(raw) && raw > 0 ? raw : 2 * 1024 * 1024;
})();
const ALLOW_PRIVATE_IMPORT = (() => {
  const raw = String(process.env.DESKLY_IMPORT_ALLOW_PRIVATE || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
})();

const isPrivateIpv4 = (ip) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isPrivateIpv6 = (ip) => {
  const val = ip.toLowerCase();
  if (val === '::1') return true;
  if (val.startsWith('fe80:') || val.startsWith('fe80::')) return true;
  if (val.startsWith('fc') || val.startsWith('fd')) return true;
  return false;
};

const isPrivateIp = (ip) => {
  const type = net.isIP(ip);
  if (type === 4) return isPrivateIpv4(ip);
  if (type === 6) return isPrivateIpv6(ip);
  return false;
};

const isLoopbackHost = (hostname) => {
  const h = String(hostname || '').trim().toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost');
};

const resolveHost = async (hostname) => {
  const timeoutMs = 2000;
  let timeout = null;
  try {
    const result = await Promise.race([
      dns.lookup(hostname, { all: true }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs);
      })
    ]);
    return result;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const validateImportUrl = async (rawUrl) => {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Invalid URL protocol' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL must not include credentials' };
  }
  if (!parsed.hostname) {
    return { ok: false, error: 'Invalid URL host' };
  }
  if (!ALLOW_PRIVATE_IMPORT && isLoopbackHost(parsed.hostname)) {
    return { ok: false, error: 'Host not allowed' };
  }
  const ipType = net.isIP(parsed.hostname);
  if (ipType) {
    if (!ALLOW_PRIVATE_IMPORT && isPrivateIp(parsed.hostname)) {
      return { ok: false, error: 'Host not allowed' };
    }
    return { ok: true, url: parsed.toString() };
  }
  let records;
  try {
    records = await resolveHost(parsed.hostname);
  } catch {
    return { ok: false, error: 'Unable to resolve host' };
  }
  if (!Array.isArray(records) || !records.length) {
    return { ok: false, error: 'Unable to resolve host' };
  }
  if (!ALLOW_PRIVATE_IMPORT) {
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return { ok: false, error: 'Host not allowed' };
      }
    }
  }
  return { ok: true, url: parsed.toString() };
};

const readResponseText = async (res, limitBytes) => {
  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > limitBytes) {
    return { ok: false, error: 'Response too large' };
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    if (text.length > limitBytes) return { ok: false, error: 'Response too large' };
    return { ok: true, text };
  }
  const reader = res.body.getReader();
  let received = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.length;
    if (received > limitBytes) {
      try {
        await reader.cancel();
      } catch {}
      return { ok: false, error: 'Response too large' };
    }
    chunks.push(Buffer.from(value));
  }
  return { ok: true, text: Buffer.concat(chunks).toString('utf8') };
};

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
    const urlCheck = await validateImportUrl(config.url);
    if (!urlCheck.ok) {
      return { ok: false, status: 0, error: urlCheck.error || 'Invalid URL' };
    }
    const auth = Buffer.from(`${config.username}:${config.password}`, 'utf8').toString('base64');
    const bodyJson = typeof config.bodyJson === 'string' ? config.bodyJson.trim() : '';
    const useBody = !!bodyJson;
    const res = await fetch(urlCheck.url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        ...(useBody ? { 'Content-Type': 'application/json' } : {})
      },
      ...(useBody ? { body: bodyJson } : {}),
      signal: controller.signal
    });
    const readResult = await readResponseText(res, MAX_IMPORT_RESPONSE_BYTES);
    if (!readResult.ok) {
      return { ok: false, status: res.status, error: readResult.error || 'Response too large', rawSnippet: '', contentType: res.headers.get('content-type') || '' };
    }
    const text = readResult.text;
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

const upsertExternalUsers = (db, clientId, employees, options = {}) => {
  const now = Date.now();
  const shouldMarkMissing = options.markMissing !== false;
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
  const markMissingStmt = db.prepare(`UPDATE external_users SET present=0, updatedAt=? WHERE clientId=? AND externalId=?`);

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

  if (shouldMarkMissing) {
    for (const prev of existing) {
      const id = String(prev.externalId);
      if (!incomingIds.has(id) && Number(prev.present || 1) === 1) {
        markMissingStmt.run(now, clientId, id);
        missing.push({ externalId: id, firstName: prev.firstName || '', lastName: prev.lastName || '' });
      }
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
      '(lower(externalId) LIKE ? ESCAPE \'\\\\\' OR lower(firstName) LIKE ? ESCAPE \'\\\\\' OR lower(lastName) LIKE ? ESCAPE \'\\\\\' OR lower(role) LIKE ? ESCAPE \'\\\\\' OR lower(dept1) LIKE ? ESCAPE \'\\\\\' OR lower(dept2) LIKE ? ESCAPE \'\\\\\' OR lower(dept3) LIKE ? ESCAPE \'\\\\\' OR lower(email) LIKE ? ESCAPE \'\\\\\')'
    );
    values.push(like, like, like, like, like, like, like, like);
  }
  let sql = `SELECT clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt
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
      isExternal: Number(r.isExternal) === 1,
      hidden: Number(r.hidden) === 1,
      present: Number(r.present) === 1,
      lastSeenAt: r.lastSeenAt || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  return rows;
};

const setExternalUserHidden = (db, clientId, externalId, hidden) => {
  db.prepare('UPDATE external_users SET hidden=?, updatedAt=? WHERE clientId=? AND externalId=?').run(hidden ? 1 : 0, Date.now(), clientId, externalId);
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
  const byClient = new Map();
  for (const row of userRows) {
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
  setExternalUserHidden,
  listImportSummary
};
