#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extractHistoryVersion, extractReadmeVersion, validateVersionConsistency } = require('./version-utils.cjs');

const ROOT = process.cwd();

const readUtf8 = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');

const main = () => {
  const pkg = JSON.parse(readUtf8('package.json'));
  const readme = readUtf8('README.md');
  const history = readUtf8('src/version/history.ts');
  const packageVersion = String(pkg.version || '');
  const readmeVersion = extractReadmeVersion(readme);
  const historyVersion = extractHistoryVersion(history);
  const errors = validateVersionConsistency({ packageVersion, readmeVersion, historyVersion });

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }

  console.log(`Version check OK (${packageVersion})`);
};

main();
