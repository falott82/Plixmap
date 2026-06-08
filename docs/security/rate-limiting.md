# Anti-bruteforce rate limiting

PlixMap throttles login attempts to slow credential-stuffing and brute-force
attacks. The counters live **in process memory** (`server/routes/auth.cjs`):

- **Per-IP limiter** (`loginAttemptBucket`): max **20** attempts per IP per
  **5-minute** sliding window.
- **Per-username limiter** (`loginUserBucket`): max **8** failed logins per
  username per **15-minute** window; on the 8th failure the account is locked
  for **15 minutes**.

## Single-worker assumption (important)

These buckets are **per-process**. The protection is only coherent because the
app is deployed as a **single Node.js worker**:

- `package.json` `start` → `node server/index.cjs` (one process).
- `Dockerfile` `CMD` runs a single `node server/index.cjs`.
- `plix.sh` launches a single start command.
- No `cluster` module, no PM2 `ecosystem.config.js`, no `worker_threads` for
  request handling.

**If the app is ever scaled horizontally** (multiple containers/replicas) or to
multiple workers, each instance keeps its own in-memory buckets, so an attacker
can dilute the limit by spreading attempts across instances. In that case the
limiter must move to a **shared store** — a DB row with a TTL or Redis — so the
counters are authoritative across workers.

## Key eviction (bounded memory)

Inactive keys are evicted lazily so the maps cannot grow without bound:

- `cleanupLoginAttemptBucket` / `cleanupUserLocks` run at most once per 60s
  (gated to avoid sweeping on every request).
- A cleanup pass deletes any entry whose window (`resetAt`) — and, for user
  locks, whose `lockedUntil` — has elapsed.

Cleanup is triggered by the next login-related request after the 60s gate, so a
key for an IP/user that never returns is removed on the first subsequent request
from any client. `clearUserLoginFailures` also removes a key immediately on a
successful login.

`getRateLimitStats()` exposes the current map sizes for tests and ops sanity
checks.

## Tests

`scripts/auth-routes.test.cjs` covers both required behaviours using an injected
clock (`now`):

- blocking over the per-IP threshold (21st attempt rejected);
- eviction of inactive keys once their window/lock expires (map sizes shrink
  back after a cleanup pass).
