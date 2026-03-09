const dns = require('dns').promises;
const { execFile, spawn } = require('child_process');
const http = require('http');
const https = require('https');
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
    return { ok: true, url: parsed.toString(), hostname, address: hostname };
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
  return {
    ok: true,
    url: parsed.toString(),
    hostname,
    address: String(records[0]?.address || '')
  };
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

const getHeaderValue = (headers, name) => {
  const raw = headers?.[String(name || '').toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || '');
  return raw ? String(raw) : '';
};

const formatRequestError = (error) => {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || error || '').trim();
  if (code && message && !message.includes(code)) return `${code}: ${message}`;
  if (message) return message;
  if (code) return code;
  return 'Request failed';
};

const shouldRetryInChildProcess = (error) => {
  const message = String(error || '').toUpperCase();
  return message.includes('EHOSTUNREACH') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT');
};

const escapeCurlConfigValue = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');

const CHILD_REQUEST_SCRIPT = `
const http = require('http');
const https = require('https');
const net = require('net');

const getHeaderValue = (headers, name) => {
  const raw = headers?.[String(name || '').toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || '');
  return raw ? String(raw) : '';
};

const formatRequestError = (error) => {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || error || '').trim();
  if (code && message && !message.includes(code)) return \`\${code}: \${message}\`;
  if (message) return message;
  if (code) return code;
  return 'Request failed';
};

const requestPayload = (rawUrl, options = {}) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let parsed;
    try {
      parsed = new URL(String(rawUrl || '').trim());
    } catch {
      finish({ ok: false, status: 0, error: 'Invalid URL' });
      return;
    }
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: options.connectAddress || parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: \`\${parsed.pathname || '/'}\${parsed.search || ''}\`,
        servername: parsed.protocol === 'https:' && !net.isIP(parsed.hostname) ? parsed.hostname : undefined,
        family: options.family || (options.connectAddress && net.isIP(options.connectAddress) === 4 ? 4 : undefined),
        agent: false,
        headers: {
          ...(parsed.host ? { Host: parsed.host } : {}),
          ...(options.headers || {})
        },
        method: options.method || 'POST'
      },
      (res) => {
        const status = Number(res.statusCode || 0);
        const contentType = getHeaderValue(res.headers, 'content-type');
        const contentLength = Number(getHeaderValue(res.headers, 'content-length') || 0);
        if (contentLength && contentLength > options.limitBytes) {
          res.destroy();
          finish({ ok: false, status, error: 'Response too large', rawSnippet: '', contentType });
          return;
        }
        let received = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          received += buffer.length;
          if (received > options.limitBytes) {
            res.destroy(new Error('Response too large'));
            return;
          }
          chunks.push(buffer);
        });
        res.on('error', (error) => {
          finish({
            ok: false,
            status,
            error: error?.message === 'Response too large' ? 'Response too large' : formatRequestError(error),
            rawSnippet: '',
            contentType
          });
        });
        res.on('end', () => {
          finish({
            ok: true,
            status,
            text: Buffer.concat(chunks).toString('utf8'),
            contentType
          });
        });
      }
    );
    req.setTimeout(options.timeoutMs || 12000, () => {
      req.destroy(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', (error) => {
      finish({ ok: false, status: 0, error: formatRequestError(error) });
    });
    if (options.body) req.write(options.body);
    req.end();
  });

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(input || '{}');
    const result = await requestPayload(payload.rawUrl, payload.options || {});
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stderr.write(String(error?.message || error));
    process.exit(1);
  }
});
`;

const requestImportPayload = (rawUrl, options = {}) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let parsed;
    try {
      parsed = new URL(String(rawUrl || '').trim());
    } catch {
      finish({ ok: false, status: 0, error: 'Invalid URL' });
      return;
    }
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: options.connectAddress || parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname || '/'}${parsed.search || ''}`,
        servername: parsed.protocol === 'https:' && !net.isIP(parsed.hostname) ? parsed.hostname : undefined,
        family: options.family || (options.connectAddress && net.isIP(options.connectAddress) === 4 ? 4 : undefined),
        agent: false,
        headers: {
          ...(parsed.host ? { Host: parsed.host } : {}),
          ...(options.headers || {})
        },
        method: options.method || 'POST'
      },
      (res) => {
        const status = Number(res.statusCode || 0);
        const contentType = getHeaderValue(res.headers, 'content-type');
        const contentLength = Number(getHeaderValue(res.headers, 'content-length') || 0);
        if (contentLength && contentLength > options.limitBytes) {
          res.destroy();
          finish({ ok: false, status, error: 'Response too large', rawSnippet: '', contentType });
          return;
        }
        let received = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          received += buffer.length;
          if (received > options.limitBytes) {
            res.destroy(new Error('Response too large'));
            return;
          }
          chunks.push(buffer);
        });
        res.on('error', (error) => {
          finish({
            ok: false,
            status,
            error: error?.message === 'Response too large' ? 'Response too large' : formatRequestError(error),
            rawSnippet: '',
            contentType
          });
        });
        res.on('end', () => {
          finish({
            ok: true,
            status,
            text: Buffer.concat(chunks).toString('utf8'),
            contentType
          });
        });
      }
    );
    req.setTimeout(options.timeoutMs || 12_000, () => {
      req.destroy(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', (error) => {
      finish({ ok: false, status: 0, error: formatRequestError(error) });
    });
    if (options.body) req.write(options.body);
    req.end();
  });

const requestImportPayloadViaChild = (rawUrl, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', CHILD_REQUEST_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
    });
    child.on('error', (error) => {
      resolve({ ok: false, status: 0, error: formatRequestError(error) });
    });
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, status: 0, error: stderr.trim() || stdout.trim() || 'Child request failed' });
        return;
      }
      try {
        resolve(JSON.parse(stdout || '{}'));
      } catch {
        resolve({ ok: false, status: 0, error: 'Invalid child response' });
      }
    });
    child.stdin.end(JSON.stringify({ rawUrl, options }));
  });

const requestImportPayloadViaCurl = (rawUrl, options = {}) =>
  new Promise((resolve) => {
    const marker = '__PLIXMAP_CURL_META__';
    const child = execFile(
      'curl',
      ['--config', '-'],
      {
        timeout: options.timeoutMs || 12_000,
        maxBuffer: Math.max((options.limitBytes || 0) + 16_384, 64 * 1024)
      },
      (error, stdout = '', stderr = '') => {
        if (error) {
          const message = String(stderr || '').trim();
          resolve({
            ok: false,
            status: 0,
            error: message || formatRequestError(error)
          });
          return;
        }
        const raw = String(stdout || '');
        const idx = raw.lastIndexOf(`\n${marker}`);
        if (idx < 0) {
          resolve({ ok: false, status: 0, error: 'Invalid curl response' });
          return;
        }
        const text = raw.slice(0, idx);
        if (Buffer.byteLength(text, 'utf8') > (options.limitBytes || 0)) {
          resolve({ ok: false, status: 0, error: 'Response too large' });
          return;
        }
        const meta = raw.slice(idx + marker.length + 1).trim();
        const [statusRaw, contentTypeRaw = ''] = meta.split('|');
        resolve({
          ok: true,
          status: Number(statusRaw || 0),
          text,
          contentType: String(contentTypeRaw || '')
        });
      }
    );
    const headers = options.headers || {};
    const lines = [
      `url = "${escapeCurlConfigValue(rawUrl)}"`,
      `request = "${escapeCurlConfigValue(options.method || 'POST')}"`,
      'silent',
      'show-error',
      `write-out = "\\n${marker}%{http_code}|%{content_type}"`
    ];
    for (const [name, value] of Object.entries(headers)) {
      if (!value) continue;
      lines.push(`header = "${escapeCurlConfigValue(`${name}: ${value}`)}"`);
    }
    if (options.body) {
      lines.push(`data = "${escapeCurlConfigValue(options.body)}"`);
    }
    child.stdin.end(`${lines.join('\n')}\n`);
  });

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
    const requestOptions = {
      connectAddress: urlCheck.address || '',
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        ...(useBody ? { 'Content-Type': 'application/json' } : {})
      },
      ...(useBody ? { body: bodyJson } : {}),
      limitBytes: options.maxResponseBytes,
      timeoutMs: 12_000
    };
    let response = await requestImportPayload(urlCheck.url, requestOptions);
    if (!response.ok && shouldRetryInChildProcess(response.error)) {
      response = await requestImportPayloadViaChild(urlCheck.url, requestOptions);
      if (!response.ok && shouldRetryInChildProcess(response.error)) {
        response = await requestImportPayloadViaCurl(urlCheck.url, requestOptions);
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: response.error || 'Request failed',
        rawSnippet: response.rawSnippet || '',
        contentType: response.contentType || ''
      };
    }
    const text = response.text;
    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        status: response.status,
        error: text.slice(0, 500),
        rawSnippet: text.slice(0, 2000),
        contentType: response.contentType || ''
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
        status: response.status,
        error: 'Invalid JSON response',
        rawSnippet: String(text || '').slice(0, 2000),
        contentType: response.contentType || ''
      };
    }
    return { ok: true, status: response.status, raw: json };
  } catch (error) {
    return { ok: false, status: 0, error: String(error?.message || error) };
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
    fragmentPattern: /^"devices"\s*:|^"Devices"\s*:|^"Dispositivi"\s*:/
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
