#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const isIdentifierChar = (ch) => /[A-Za-z0-9_$]/.test(ch || '');

const walk = (dir, out) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (EXTENSIONS.has(ext)) out.push(full);
    }
  }
};

const readFiles = () => {
  if (!fs.existsSync(SRC_DIR)) return [];
  const files = [];
  walk(SRC_DIR, files);
  return files;
};

const getLineCol = (text, idx) => {
  const slice = text.slice(0, idx);
  const parts = slice.split('\n');
  const line = parts.length;
  const col = parts[parts.length - 1].length + 1;
  return { line, col };
};

const extractObjectLiteral = (text, startIndex) => {
  let i = startIndex;
  if (text[i] !== '{') return null;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inSingle) {
      if (ch === '\\') escaped = true;
      else if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') {
        escaped = true;
      } else if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { text: text.slice(startIndex, i + 1), endIndex: i + 1 };
      }
    }
  }
  return null;
};

const lintFile = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  for (let i = 0; i < text.length - 1; i += 1) {
    if (text[i] !== 't' || text[i + 1] !== '(') continue;
    if (isIdentifierChar(text[i - 1])) continue;
    let j = i + 2;
    while (j < text.length && /\s/.test(text[j])) j += 1;
    if (text[j] !== '{') continue;
    const obj = extractObjectLiteral(text, j);
    if (!obj) continue;
    const hasIt = /\bit\s*:/.test(obj.text);
    const hasEn = /\ben\s*:/.test(obj.text);
    if (!hasIt || !hasEn) {
      const { line, col } = getLineCol(text, i);
      issues.push({ line, col, missing: !hasIt && !hasEn ? 'it,en' : !hasIt ? 'it' : 'en' });
    }
    i = obj.endIndex - 1;
  }
  return issues;
};

const main = () => {
  const files = readFiles();
  const errors = [];
  for (const file of files) {
    const issues = lintFile(file);
    for (const issue of issues) {
      errors.push({ file, ...issue });
    }
  }
  if (!errors.length) {
    console.log('i18n lint passed');
    return;
  }
  for (const err of errors) {
    const rel = path.relative(ROOT, err.file);
    console.error(`${rel}:${err.line}:${err.col} Missing ${err.missing} translation key in t({})`);
  }
  process.exit(1);
};

main();
