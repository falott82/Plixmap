#!/usr/bin/env node

const { performance } = require('node:perf_hooks');

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:8787';
const requestTimeoutMs = Math.max(1000, Number(process.env.E2E_SMOKE_TIMEOUT_MS) || 12000);
const smokeUsername = String(process.env.E2E_SMOKE_USER || 'superadmin').trim();
const smokePassword = String(process.env.E2E_SMOKE_PASS || 'deskly');

const getSetCookieHeaders = (res) => {
  if (res?.headers && typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }
  const raw = res?.headers?.get ? res.headers.get('set-cookie') : '';
  if (!raw) return [];
  return raw.split(/,(?=[^;,\s]+=)/g);
};

const parseCookie = (setCookie) => {
  const first = String(setCookie || '').split(';')[0] || '';
  const eq = first.indexOf('=');
  if (eq <= 0) return null;
  return { name: first.slice(0, eq).trim(), value: first.slice(eq + 1).trim() };
};

const createCookieJar = () => {
  const values = new Map();
  return {
    apply(headers) {
      const cookie = Array.from(values.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
      if (cookie) headers.cookie = cookie;
    },
    get(name) {
      return values.get(String(name || '')) || '';
    },
    getDecoded(name) {
      const raw = values.get(String(name || '')) || '';
      if (!raw) return '';
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    },
    capture(res) {
      const rows = getSetCookieHeaders(res);
      for (const row of rows) {
        const parsed = parseCookie(row);
        if (!parsed) continue;
        if (!parsed.value || parsed.value.toLowerCase() === 'deleted') {
          values.delete(parsed.name);
        } else {
          values.set(parsed.name, parsed.value);
        }
      }
    }
  };
};

const request = async (path, options = {}) => {
  const {
    method = 'GET',
    expectedStatuses = [200],
    jar = null,
    json = null,
    label = path
  } = options;
  const url = new URL(path, baseUrl).toString();
  const headers = {};
  if (jar) jar.apply(headers);
  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (jar && normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD' && normalizedMethod !== 'OPTIONS') {
    const csrf = jar.getDecoded('plixmap_csrf');
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  let body = undefined;
  if (json !== null) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const startedAt = performance.now();
  const res = await fetch(url, {
    method: normalizedMethod,
    headers,
    body,
    signal: AbortSignal.timeout(requestTimeoutMs)
  });
  if (jar) jar.capture(res);
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
  if (!expectedStatuses.includes(res.status)) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} failed: HTTP ${res.status} (${url}) body=${text.slice(0, 260)}`);
  }
  return { res, url, elapsedMs, status: res.status, label };
};

const main = async () => {
  const rows = [];
  const jar = createCookieJar();

  rows.push(await request('/', { label: 'public_home' }));
  rows.push(await request('/api/health/live', { label: 'health_live' }));
  rows.push(await request('/api/health/ready', { label: 'health_ready' }));

  const bootstrap = await request('/api/auth/bootstrap-status', { label: 'bootstrap_status' });
  rows.push(bootstrap);
  const bootstrapJson = await bootstrap.res.json().catch(() => null);
  if (!bootstrapJson || typeof bootstrapJson.showFirstRunCredentials !== 'boolean') {
    throw new Error('bootstrap_status failed: unexpected payload');
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    expectedStatuses: [200],
    jar,
    label: 'auth_login',
    json: { username: smokeUsername, password: smokePassword }
  });
  rows.push(login);
  const loginJson = await login.res.json().catch(() => null);
  if (!loginJson || loginJson.ok !== true) throw new Error('auth_login failed: unexpected payload');

  const me = await request('/api/auth/me', { expectedStatuses: [200], jar, label: 'auth_me' });
  rows.push(me);
  const meJson = await me.res.json().catch(() => null);
  if (!meJson?.user?.id) throw new Error('auth_me failed: missing user id');

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    expectedStatuses: [200],
    jar,
    label: 'auth_logout'
  });
  rows.push(logout);

  rows.push(await request('/api/auth/me', { expectedStatuses: [401], jar, label: 'auth_me_after_logout' }));

  for (const row of rows) {
    console.log(`OK ${row.label} ${row.status} ${row.url} ${row.elapsedMs}ms`);
  }
};

main().catch((error) => {
  const message = error?.message || String(error);
  const cause = error?.cause ? ` | cause: ${String(error.cause)}` : '';
  console.error(`${message}${cause}`);
  process.exit(1);
});
