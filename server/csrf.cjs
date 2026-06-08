// CSRF protection decision logic, extracted from the inline /api middleware in
// index.cjs so it can be unit-tested in isolation.
//
// Model: double-submit cookie. A mutating request must carry both the CSRF
// cookie and a matching `x-csrf-token` header, and (when a Host is known) its
// Origin/Referer must match `${protocol}://${host}`.
//
// NOTE: there is intentionally NO Bearer-token exemption — the app authenticates
// via the session cookie, so every non-exempt, non-safe request is subject to
// the double-submit check regardless of any Authorization header.

const CSRF_EXEMPT_PATHS = new Set(['/auth/login', '/auth/bootstrap-status']);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Public meeting-room kiosk endpoints that are reachable without the SPA's CSRF
// cookie (display devices), matched by suffix under /meeting-room/.
const isMeetingRoomKioskPath = (path) =>
  typeof path === 'string' &&
  path.startsWith('/meeting-room/') &&
  (path.endsWith('/checkin-toggle') || path.endsWith('/help-request'));

const isCsrfExemptPath = (path) => CSRF_EXEMPT_PATHS.has(path) || isMeetingRoomKioskPath(path);

/**
 * Decide whether a request passes CSRF protection.
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
const evaluateCsrfRequest = ({ method, path, cookieToken, headerToken, origin, referer, host, protocol }) => {
  const normalizedMethod = String(method || '').toUpperCase();
  if (SAFE_METHODS.has(normalizedMethod)) return { ok: true };
  if (isCsrfExemptPath(path)) return { ok: true };

  if (!cookieToken || !headerToken || String(headerToken) !== String(cookieToken)) {
    return { ok: false, status: 403, error: 'CSRF validation failed' };
  }

  if (host) {
    const expected = `${protocol}://${host}`;
    if (origin && origin !== expected) {
      return { ok: false, status: 403, error: 'CSRF origin mismatch' };
    }
    if (!origin && referer && !String(referer).startsWith(expected)) {
      return { ok: false, status: 403, error: 'CSRF referer mismatch' };
    }
  }

  return { ok: true };
};

module.exports = {
  CSRF_EXEMPT_PATHS,
  isCsrfExemptPath,
  evaluateCsrfRequest
};
