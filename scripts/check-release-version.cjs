#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extractCurrentVersion, extractHistoryVersion, extractReadmeVersion, validateVersionConsistency } = require('./version-utils.cjs');

const ROOT = process.cwd();

const readUtf8 = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');

const main = () => {
  const pkg = JSON.parse(readUtf8('package.json'));
  const readme = readUtf8('README.md');
  const history = readUtf8('src/version/history/partRecent.ts');
  const current = readUtf8('src/version/current.ts');
  const packageVersion = String(pkg.version || '');
  const readmeVersion = extractReadmeVersion(readme);
  const historyVersion = extractHistoryVersion(history);
  const currentVersion = extractCurrentVersion(current);
  const errors = validateVersionConsistency({ packageVersion, readmeVersion, historyVersion });
  if (!currentVersion) errors.push('Unable to parse src/version/current.ts APP_VERSION');
  else if (currentVersion !== packageVersion) {
    errors.push(`Version mismatch: package.json=${packageVersion}, src/version/current.ts=${currentVersion}`);
  }

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }

  console.log(`Version check OK (${packageVersion})`);
};

main();
