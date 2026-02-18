#!/usr/bin/env node

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:8787';

const check = async (path) => {
  const url = new URL(path, baseUrl).toString();
  const res = await fetch(url, { method: 'GET' });
  if (res.status >= 500) throw new Error(`Smoke check failed for ${url}: HTTP ${res.status}`);
  return { url, status: res.status };
};

const main = async () => {
  const targets = ['/', '/api/auth/bootstrap-status'];
  const results = [];
  for (const target of targets) {
    results.push(await check(target));
  }
  for (const row of results) {
    console.log(`OK ${row.status} ${row.url}`);
  }
};

main().catch((error) => {
  const message = error?.message || String(error);
  const cause = error?.cause ? ` | cause: ${String(error.cause)}` : '';
  console.error(`${message}${cause}`);
  process.exit(1);
});
