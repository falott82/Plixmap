// In-process general request rate limiter, extracted from index.cjs. Buckets
// live in process memory (single-worker deployment — see
// docs/security/rate-limiting.md) and expired buckets are evicted lazily to
// keep the map bounded.
const rateBuckets = new Map(); // key -> { count, resetAt }
let lastRateCleanup = 0;
const cleanupRateBuckets = (now) => {
  if (now - lastRateCleanup < 60_000) return;
  lastRateCleanup = now;
  for (const [key, entry] of rateBuckets.entries()) {
    if (now > entry.resetAt) rateBuckets.delete(key);
  }
};
const rateLimit =
  ({ name, windowMs, max, key }) =>
  (req, res, next) => {
    const now = Date.now();
    cleanupRateBuckets(now);
    const bucketKey = `${name}:${key(req) || 'unknown'}`;
    const entry = rateBuckets.get(bucketKey);
    if (!entry || now > entry.resetAt) {
      rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
const rateByUser = (name, windowMs, max) =>
  rateLimit({
    name,
    windowMs,
    max,
    key: (req) => req.userId || req.ip
  });

module.exports = { rateLimit, rateByUser };
