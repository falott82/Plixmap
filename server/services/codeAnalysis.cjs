const fs = require('fs');
const path = require('path');

const analyzeCode = (root = process.cwd()) => {
  const ignoredDirs = new Set([
    '.git',
    '.idea',
    '.next',
    '.turbo',
    '.vite',
    'coverage',
    'data',
    'dist',
    'node_modules',
    'release-data',
    'test-results'
  ]);
  const ignoredFiles = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'plix.log']);
  const allowedExt = new Set(['.cjs', '.css', '.html', '.js', '.jsx', '.mjs', '.scss', '.ts', '.tsx']);
  const maxBytes = 2 * 1024 * 1024;
  const rows = [];
  const countMatches = (text, re) => {
    const matches = text.match(re);
    return matches ? matches.length : 0;
  };
  const isCodeLine = (line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) return false;
    return true;
  };
  const formatBytes = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };
  const scanDir = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry || entry.name.startsWith('.') && entry.name !== '.githooks') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) scanDir(fullPath);
        continue;
      }
      if (!entry.isFile() || ignoredFiles.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExt.has(ext)) continue;
      let stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (!stat || stat.size > maxBytes) continue;
      let text = '';
      try {
        text = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      const lines = text.split(/\r?\n/);
      const codeLines = lines.filter(isCodeLine).length;
      const isJsxFile = ext === '.tsx' || ext === '.jsx';
      const rel = path.relative(root, fullPath);
      rows.push({
        name: entry.name,
        path: rel,
        codeLines,
        hooks: countMatches(text, /\buse[A-Z0-9]\w*\s*\(/g),
        responsive: countMatches(text, /\b(?:sm|md|lg|xl|2xl):/g) + countMatches(text, /@media\b/g),
        jsx: isJsxFile ? countMatches(text, /<\/?[A-Za-z][A-Za-z0-9:._-]*(?:\s|>|\/>)/g) : 0,
        functions: countMatches(text, /\bfunction\b/g) + countMatches(text, /=>/g),
        propTypes: countMatches(text, /\b(?:type|interface)\s+\w*Props\b/g),
        propRefs: countMatches(text, /\bprops\./g) + countMatches(text, /\{[^}\n]*\}\s*:\s*\w*Props\b/g),
        bytes: stat.size,
        weight: formatBytes(stat.size)
      });
    }
  };
  scanDir(root);
  rows.sort((a, b) => b.codeLines - a.codeLines || b.bytes - a.bytes || a.path.localeCompare(b.path));
  return {
    ok: true, root, filesScanned: rows.length,
    totalLines: rows.reduce((sum, row) => sum + row.codeLines, 0),
    largestFileLines: rows[0]?.codeLines || 0, updatedAt: Date.now(),
    files: rows.slice(0, 150).map((row, idx) => ({ rank: idx + 1, ...row }))
  };
};

module.exports = { analyzeCode };
