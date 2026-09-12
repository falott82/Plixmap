// Minimal semantic-version helpers extracted from index.cjs (used by the
// update-check / manifest comparison logic).
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const normalizeSemver = (value) => {
  const raw = String(value || '').trim();
  return SEMVER_REGEX.test(raw) ? raw : null;
};
const compareSemver = (a, b) => {
  const aParts = String(a || '')
    .split('.')
    .map((part) => Number(part));
  const bParts = String(b || '')
    .split('.')
    .map((part) => Number(part));
  for (let i = 0; i < 3; i += 1) {
    const left = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const right = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
};

module.exports = { SEMVER_REGEX, normalizeSemver, compareSemver };
