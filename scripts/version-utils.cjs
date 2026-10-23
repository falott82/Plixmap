const fs = require('node:fs');
const path = require('node:path');

const README_VERSION_REGEX = /Current version:\s*([0-9]+\.[0-9]+\.[0-9]+)/i;
const HISTORY_VERSION_REGEX = /version:\s*'([0-9]+\.[0-9]+\.[0-9]+)'/;
const CURRENT_VERSION_REGEX = /APP_VERSION\s*=\s*'([0-9]+\.[0-9]+\.[0-9]+)'/;

const extractReadmeVersion = (readmeText) => {
  const match = README_VERSION_REGEX.exec(String(readmeText || ''));
  return match ? String(match[1]) : null;
};

const extractCurrentVersion = (currentText) => {
  const match = CURRENT_VERSION_REGEX.exec(String(currentText || ''));
  return match ? String(match[1]) : null;
};

const extractHistoryVersion = (historyText) => {
  const match = HISTORY_VERSION_REGEX.exec(String(historyText || ''));
  return match ? String(match[1]) : null;
};

const readHistoryVersion = (filePath, readFile = fs.readFileSync, visited = new Set()) => {
  const absolutePath = path.resolve(filePath);
  if (visited.has(absolutePath)) return null;
  visited.add(absolutePath);
  const source = readFile(absolutePath, 'utf8');
  const inlineVersion = extractHistoryVersion(source);
  if (inlineVersion) return inlineVersion;

  const lazyHistory = /pending\s*=\s*import\(['"]([^'"]+)['"]\)/.exec(source)?.[1];
  if (lazyHistory) {
    return readHistoryVersion(path.resolve(path.dirname(absolutePath), `${lazyHistory}.ts`), readFile, visited);
  }

  // Follow the first spread in the public history array, preserving its release order.
  const firstPart = /\breleaseHistory\b[^=]*=\s*\[\s*\.\.\.(\w+)/.exec(source)?.[1];
  if (!firstPart) return null;
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const bindings = match[1].split(',').map((binding) => binding.trim().split(/\s+as\s+/).at(-1));
    if (!bindings.includes(firstPart)) continue;
    const importedPath = path.resolve(path.dirname(absolutePath), match[2]);
    return readHistoryVersion(path.extname(importedPath) ? importedPath : `${importedPath}.ts`, readFile, visited);
  }
  return null;
};

const validateVersionConsistency = ({ packageVersion, readmeVersion, historyVersion }) => {
  const errors = [];
  if (!packageVersion) errors.push('Missing package.json version');
  if (!readmeVersion) errors.push('Unable to parse README version');
  if (!historyVersion) errors.push('Unable to parse src/version/history/partRecent.ts latest version');
  if (packageVersion && readmeVersion && packageVersion !== readmeVersion) {
    errors.push(`Version mismatch: package.json=${packageVersion}, README=${readmeVersion}`);
  }
  if (packageVersion && historyVersion && packageVersion !== historyVersion) {
    errors.push(`Version mismatch: package.json=${packageVersion}, history=${historyVersion}`);
  }
  return errors;
};

module.exports = {
  extractCurrentVersion,
  extractHistoryVersion,
  readHistoryVersion,
  extractReadmeVersion,
  validateVersionConsistency
};
