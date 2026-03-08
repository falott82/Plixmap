const dns = require('dns').promises;
const net = require('net');

const normalizeHostLiteral = (hostname) => String(hostname || '').trim().replace(/^\[|\]$/g, '');

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

const extractMappedIpv4 = (ip) => {
  const raw = normalizeHostLiteral(ip).toLowerCase();
  const dottedMatch = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(raw);
  if (dottedMatch) return String(dottedMatch[1] || '');
  const hexMatch = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(raw);
  if (!hexMatch) return '';
  const hi = Number.parseInt(String(hexMatch[1] || ''), 16);
  const lo = Number.parseInt(String(hexMatch[2] || ''), 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return '';
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
};

const isPrivateIpv6 = (ip) => {
  const val = normalizeHostLiteral(ip).toLowerCase();
  const mappedIpv4 = extractMappedIpv4(val);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  if (val === '::') return true;
  if (val === '::1') return true;
  if (val.startsWith('fe80:') || val.startsWith('fe80::')) return true;
  if (val.startsWith('fc') || val.startsWith('fd')) return true;
  return false;
};

const isPrivateIp = (ip) => {
  const normalized = normalizeHostLiteral(ip);
  const type = net.isIP(normalized);
  if (type === 4) return isPrivateIpv4(normalized);
  if (type === 6) return isPrivateIpv6(normalized);
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

const validateImportUrl = async (rawUrl, options = {}) => {
  const allowPrivate = options.allowPrivate === true || options.defaultAllowPrivate === true;
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
  const hostname = normalizeHostLiteral(parsed.hostname);
  if (!allowPrivate && isLoopbackHost(hostname)) {
    return { ok: false, error: 'Host not allowed' };
  }
  const ipType = net.isIP(hostname);
  if (ipType) {
    if (!allowPrivate && isPrivateIp(hostname)) {
      return { ok: false, error: 'Host not allowed' };
    }
    return { ok: true, url: parsed.toString() };
  }
  let records;
  try {
    records = await resolveHost(hostname);
  } catch {
    return { ok: false, error: 'Unable to resolve host' };
  }
  if (!Array.isArray(records) || !records.length) {
    return { ok: false, error: 'Unable to resolve host' };
  }
  if (!allowPrivate) {
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
    if (Buffer.byteLength(text, 'utf8') > limitBytes) return { ok: false, error: 'Response too large' };
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

const normalizeEmployeesResponse = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  const arr = payload.Dipendenti || payload.dipendenti || payload.DIPENDENTI;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((row) => {
      const get = (key) => {
        const value = row?.[key];
        if (value === null || value === undefined) return '';
        return String(value).trim();
      };
      const externalId = get('Id');
      if (!externalId) return null;
      const isExternal = get('Esterno') === '1';
      const mobile =
        get('Cellulare') ||
        get('NumeroCellulare') ||
        get('TelefonoCellulare') ||
        get('Mobile') ||
        get('Cell') ||
        '';
      return {
        externalId,
        firstName: get('Nome'),
        lastName: get('Cognome'),
        role: get('Ruolo'),
        dept1: get('Reparto1'),
        dept2: get('Reparto2'),
        dept3: get('Reparto3'),
        email: get('Email'),
        mobile,
        ext1: get('NumeroInterno1'),
        ext2: get('NumeroInterno2'),
        ext3: get('NumeroInterno3'),
        isExternal
      };
    })
    .filter(Boolean);
};

const normalizeDevicesResponse = (payload) => {
  const rawList = (() => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const candidates = [
      payload.devices,
      payload.Devices,
      payload.DISPOSITIVI,
      payload.Dispositivi,
      payload.dispositivi,
      payload.data,
      payload.items
    ];
    const found = candidates.find((item) => Array.isArray(item));
    return Array.isArray(found) ? found : [];
  })();
  const rows = [];
  for (const row of rawList) {
    const get = (...keys) => {
      for (const key of keys) {
        const value = row?.[key];
        if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
      }
      return '';
    };
    const devId = get('dev_id', 'devId', 'device_id', 'id');
    if (!devId) continue;
    rows.push({
      devId,
      deviceType: get('device_type', 'deviceType', 'type'),
      deviceName: get('device_name', 'deviceName', 'name'),
      manufacturer: get('manufacturer', 'brand'),
      model: get('model'),
      serialNumber: get('serial_number', 'serialNumber', 'serial')
    });
  }
  return rows;
};

const fetchImportPayload = async (config, options) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const urlCheck = await validateImportUrl(config.url, {
      allowPrivate: !!config.allowPrivate,
      defaultAllowPrivate: !!options.defaultAllowPrivate
    });
    if (!urlCheck.ok) {
      return { ok: false, status: 0, error: urlCheck.error || 'Invalid URL' };
    }
    const password = config.password ? String(config.password) : '';
    const auth = Buffer.from(`${config.username}:${password}`, 'utf8').toString('base64');
    const method = String(config.method || 'POST').trim().toUpperCase() === 'GET' ? 'GET' : 'POST';
    const bodyJson = typeof config.bodyJson === 'string' ? config.bodyJson.trim() : '';
    const useBody = method === 'POST' && !!bodyJson;
    const res = await fetch(urlCheck.url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        ...(useBody ? { 'Content-Type': 'application/json' } : {})
      },
      ...(useBody ? { body: bodyJson } : {}),
      signal: controller.signal
    });
    const readResult = await readResponseText(res, options.maxResponseBytes);
    if (!readResult.ok) {
      return {
        ok: false,
        status: res.status,
        error: readResult.error || 'Response too large',
        rawSnippet: '',
        contentType: res.headers.get('content-type') || ''
      };
    }
    const text = readResult.text;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 500),
        rawSnippet: text.slice(0, 2000),
        contentType: res.headers.get('content-type') || ''
      };
    }
    let json = null;
    try {
      let cleaned = String(text || '').trim().replace(/^\uFEFF/, '');
      if (options.fragmentPattern.test(cleaned)) cleaned = `{${cleaned}}`;
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
    return { ok: true, status: res.status, raw: json };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name === 'AbortError' ? 'Timeout' : String(error?.message || error) };
  } finally {
    clearTimeout(timeout);
  }
};

const fetchEmployeesFromApi = async (config, options = {}) => {
  const result = await fetchImportPayload(config, {
    maxResponseBytes: options.maxResponseBytes,
    defaultAllowPrivate: options.defaultAllowPrivate,
    fragmentPattern: /^"Dipendenti"\s*:/
  });
  if (!result.ok) return result;
  return {
    ok: true,
    status: result.status,
    employees: normalizeEmployeesResponse(result.raw),
    raw: result.raw
  };
};

const fetchDevicesFromApi = async (config, options = {}) => {
  const result = await fetchImportPayload(config, {
    maxResponseBytes: options.maxResponseBytes,
    defaultAllowPrivate: options.defaultAllowPrivate,
    fragmentPattern: /^"devices"\s*:|^"Dispositivi"\s*:/
  });
  if (!result.ok) return result;
  return {
    ok: true,
    status: result.status,
    devices: normalizeDevicesResponse(result.raw),
    raw: result.raw
  };
};

module.exports = {
  normalizeEmployeesResponse,
  normalizeDevicesResponse,
  fetchEmployeesFromApi,
  fetchDevicesFromApi,
  validateImportUrl,
  readResponseText
};
