# Security middleware test coverage

The review asked for unit tests for three middlewares: **CSRF**, **geo-blocking**,
and **demo-mode**. Only one of them exists in this codebase.

## CSRF — implemented and tested

- **Implementation:** double-submit cookie check on the `/api` mount in
  `server/index.cjs`; the decision logic is extracted into `server/csrf.cjs`
  (`evaluateCsrfRequest`, `isCsrfExemptPath`).
- **Tests:** `scripts/csrf-middleware.test.cjs` covers:
  - safe methods (GET/HEAD/OPTIONS) bypass the check;
  - matching double-submit token + trusted Origin → pass;
  - untrusted Origin → 403 (`CSRF origin mismatch`);
  - Origin absent → Referer is checked; foreign Referer → 403;
  - missing/mismatched token → 403 (`CSRF validation failed`);
  - exempt paths (`/auth/login`, `/auth/bootstrap-status`, and the
    `/meeting-room/*/checkin-toggle|help-request` kiosk endpoints) pass without a
    token;
  - **no Host header → origin/referer comparison is skipped.**

### Divergence from the review's assumptions

- The review expected a **Bearer-token bypass** ("request with only Bearer, no
  cookie → not blocked"). This app authenticates via the **session cookie**, so
  there is intentionally **no Bearer exemption**: a cookie-less mutation is
  rejected with 403. The test
  `Bearer-only requests (no CSRF cookie) are NOT exempt` pins this behavior.
- "Trusted Origin / LAN in dev" is not a separate allowlist — a request is
  trusted only when its Origin equals `${protocol}://${host}` (or the Referer
  starts with it).

## Geo-blocking — NOT IMPLEMENTED

There is no IP-country / GeoIP middleware in `server/`. No GeoIP dependency, no
`allowed_countries`/`GEOIP_DB` config, no country-check code path exists. There
is nothing to unit-test; the "fail-open when the DB is missing" behavior the
review describes does not exist here. Implementing it would be a new feature
with its own requirements (country list, GeoIP DB sourcing, whitelist/private-IP
handling) and is out of scope for adding tests.

## Demo-mode — NOT IMPLEMENTED

There is no demo-session mutation-blocking middleware. No demo session flag and
no POST/PUT/DELETE gate for demo users exist. Nothing to unit-test.

> If geo-blocking and/or demo-mode are desired, they should be tracked as
> feature work (with explicit config and a session model) before tests can be
> written against them.
