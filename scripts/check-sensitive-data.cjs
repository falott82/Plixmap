#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const stagedOnly = args.has('--staged');
const root = process.cwd();

const runGit = (gitArgs) =>
  execFileSync('git', gitArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024 * 16
  });

const splitLines = (s) =>
  String(s || '')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

const trackedFiles = stagedOnly
  ? splitLines(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']))
  : splitLines(runGit(['ls-files']));

const pathRules = [
  {
    regex: /^data\/(?!\.gitkeep$).+/i,
    reason: 'Operational instance data under data/ must stay local'
  },
  {
    regex: /(^|\/)[^/]+\.sqlite(?:-shm|-wal)?$/i,
    reason: 'SQLite files can contain personal/sensitive data'
  },
  {
    regex: /(^|\/)[^/]+\.(db|bak)$/i,
    reason: 'Database/backup artifacts must not be tracked'
  }
];

const configLikeFile = (relPath) =>
  /(^|\/)\.env(\..+)?$/i.test(relPath) ||
  /\.(json|ya?ml|toml|ini|conf|properties)$/i.test(relPath);

const skipContentScan = (relPath) =>
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(relPath);

const binaryLikePath = (relPath) =>
  /\.(png|jpe?g|gif|webp|ico|pdf|svg|woff2?|ttf|eot|mp[34]|mov|zip|gz)$/i.test(relPath);

const looksPlaceholder = (rawValue) => {
  const v = String(rawValue || '').trim().replace(/^['"]|['"]$/g, '');
  if (!v) return true;
  return (
    /^(?:\*+|x+|changeme|change_me|example|example\.com|placeholder|none|null|undefined|your_[a-z0-9_]+)$/i.test(v) ||
    /^<[^>]+>$/.test(v)
  );
};

const scanContent = (relPath, content) => {
  const findings = [];
  const text = String(content || '');
  if (text.includes('\u0000')) return findings;

  const urlWithCreds = /(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^/\s:@]+:[^@\s/]+@/gi;
  if (urlWithCreds.test(text)) {
    findings.push('Found URL with inline credentials');
  }

  const envSecret = /(^|\n)\s*([A-Z0-9_]*(?:SMTP|WEBAPI|IMPORT|TOKEN|SECRET|PASSWORD|API[_-]?KEY)[A-Z0-9_]*)\s*=\s*(.+)/gi;
  let envMatch;
  while ((envMatch = envSecret.exec(text)) !== null) {
    const key = String(envMatch[2] || '');
    const value = String(envMatch[3] || '').split(/\s+#/, 1)[0].trim();
    if (!/(PASS|PASSWORD|TOKEN|SECRET|API[_-]?KEY|SMTP|WEBAPI|IMPORT)/i.test(key)) continue;
    if (!looksPlaceholder(value)) findings.push(`Possible secret in env assignment (${key})`);
  }

  const jsonLikeSecret =
    /["']?([A-Za-z0-9_.-]*(?:password|passwd|token|secret|api[_-]?key|smtp(?:host|user|password)|webapi(?:url|user|password|token|key)?)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*["']([^"'\n]+)["']/gi;
  let kvMatch;
  while ((kvMatch = jsonLikeSecret.exec(text)) !== null) {
    const key = String(kvMatch[1] || '');
    const value = String(kvMatch[2] || '').trim();
    if (looksPlaceholder(value)) continue;
    findings.push(`Possible secret literal in key/value (${key})`);
  }

  return findings;
};

const violations = [];

for (const relPath of trackedFiles) {
  const normalized = relPath.replace(/\\/g, '/');

  for (const rule of pathRules) {
    if (rule.regex.test(normalized)) {
      violations.push({ file: normalized, detail: rule.reason });
      break;
    }
  }

  if (!configLikeFile(normalized) || binaryLikePath(normalized) || skipContentScan(normalized)) continue;

  let content = '';
  try {
    if (stagedOnly) {
      content = execFileSync('git', ['show', `:${normalized}`], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024 * 16
      });
    } else {
      content = fs.readFileSync(path.join(root, normalized), 'utf8');
    }
  } catch (_) {
    continue;
  }

  const contentFindings = scanContent(normalized, content);
  for (const finding of contentFindings) {
    violations.push({ file: normalized, detail: finding });
  }
}

if (violations.length) {
  console.error('Sensitive-data guard failed. Remove/redact these before commit/push:');
  for (const v of violations) {
    console.error(`- ${v.file}: ${v.detail}`);
  }
  process.exit(1);
}

console.log(`Sensitive-data guard OK (${trackedFiles.length} file(s) scanned${stagedOnly ? ', staged only' : ''}).`);
