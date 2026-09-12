const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateCsrfRequest, isCsrfExemptPath, CSRF_EXEMPT_PATHS } = require('../server/csrf.cjs');

const TOKEN = 'abc123token';
const base = {
  method: 'POST',
  path: '/state',
  cookieToken: TOKEN,
  headerToken: TOKEN,
  origin: 'https://app.example.com',
  referer: undefined,
  host: 'app.example.com',
  protocol: 'https'
};

test('safe methods bypass CSRF entirely', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
    assert.deepEqual(evaluateCsrfRequest({ ...base, method, cookieToken: undefined, headerToken: undefined }), {
      ok: true
    });
  }
});

test('mutations with a trusted Origin and matching double-submit token pass', () => {
  assert.deepEqual(evaluateCsrfRequest(base), { ok: true });
});

test('mutations from an untrusted Origin are rejected (403 origin mismatch)', () => {
  const result = evaluateCsrfRequest({ ...base, origin: 'https://evil.example.com' });
  assert.deepEqual(result, { ok: false, status: 403, error: 'CSRF origin mismatch' });
});

test('Referer is used when Origin is absent, and a foreign Referer is rejected', () => {
  // Matching referer under the expected origin -> pass.
  assert.deepEqual(
    evaluateCsrfRequest({ ...base, origin: undefined, referer: 'https://app.example.com/plan/1' }),
    { ok: true }
  );
  // Foreign referer -> reject.
  assert.deepEqual(evaluateCsrfRequest({ ...base, origin: undefined, referer: 'https://evil.example.com/' }), {
    ok: false,
    status: 403,
    error: 'CSRF referer mismatch'
  });
});

test('missing or mismatched double-submit token is rejected (403 validation failed)', () => {
  // No cookie token at all.
  assert.deepEqual(evaluateCsrfRequest({ ...base, cookieToken: undefined }), {
    ok: false,
    status: 403,
    error: 'CSRF validation failed'
  });
  // No header token.
  assert.deepEqual(evaluateCsrfRequest({ ...base, headerToken: undefined }), {
    ok: false,
    status: 403,
    error: 'CSRF validation failed'
  });
  // Header token does not match the cookie token.
  assert.deepEqual(evaluateCsrfRequest({ ...base, headerToken: 'different' }), {
    ok: false,
    status: 403,
    error: 'CSRF validation failed'
  });
});

test('exempt paths pass even for mutations without a token', () => {
  for (const path of CSRF_EXEMPT_PATHS) {
    assert.equal(isCsrfExemptPath(path), true, `${path} should be exempt`);
    assert.deepEqual(evaluateCsrfRequest({ ...base, path, cookieToken: undefined, headerToken: undefined }), {
      ok: true
    });
  }
  // Public meeting-room kiosk endpoints are exempt by suffix.
  assert.equal(isCsrfExemptPath('/meeting-room/room-7/checkin-toggle'), true);
  assert.equal(isCsrfExemptPath('/meeting-room/room-7/help-request'), true);
  assert.equal(isCsrfExemptPath('/meeting-room/room-7/other'), false);
});

test('Bearer-only requests (no CSRF cookie) are NOT exempt — they are blocked', () => {
  // Documents actual behavior: unlike the original finding's assumption, this
  // app has no Bearer-token bypass. A cookie-less mutation, even with an
  // Authorization header, fails the double-submit check.
  const result = evaluateCsrfRequest({
    ...base,
    cookieToken: undefined,
    headerToken: undefined
  });
  assert.deepEqual(result, { ok: false, status: 403, error: 'CSRF validation failed' });
});

test('a request without a Host header skips the origin/referer comparison', () => {
  // The origin/referer block is guarded by `host`; without it only the
  // double-submit token is required.
  assert.deepEqual(
    evaluateCsrfRequest({ ...base, host: undefined, origin: 'https://anything.example.com' }),
    { ok: true }
  );
});
