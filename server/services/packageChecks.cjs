const { execFile } = require('child_process');

const truncateOutput = (value) => {
  const text = String(value || '');
  return text.length <= 20000 ? text : `${text.slice(0, 20000)}\n... (truncated)`;
};

const readLastCheck = (raw, resolveUsername, includeCount = false) => {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {}
  const metadata = parsed && typeof parsed === 'object' ? parsed : {};
  const result = {
    lastCheckAt: Number(metadata.ts || metadata.lastCheckAt || raw || 0) || null,
    lastCheckBy: metadata.username || (metadata.userId ? resolveUsername(metadata.userId) : null) || null,
    lastCheckUserId: metadata.userId || null
  };
  if (includeCount) {
    result.count = metadata.count != null && Number.isFinite(Number(metadata.count)) ? Number(metadata.count) : null;
  }
  return result;
};

// npm uses exit code 1 for findings; execution errors and JSON error payloads are failures.
const runNpmJson = (args, execute = execFile) => new Promise((resolve) => {
  const startedAt = Date.now();
  execute(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    { cwd: process.cwd(), timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
    (error, stdout, stderr) => {
      let data = null;
      try {
        data = JSON.parse(String(stdout || '').trim() || '{}');
      } catch {}
      const exitCode = error ? (typeof error.code === 'number' ? error.code : null) : 0;
      const ok = (!error || exitCode === 1) && !!data && typeof data === 'object' && !Array.isArray(data) && !data.error;
      resolve({
        data,
        ok: !!ok,
        exitCode,
        durationMs: Date.now() - startedAt,
        stderr: truncateOutput(stderr),
        error: ok ? undefined : error?.message || 'Invalid npm response'
      });
    }
  );
});

const checkNpmAudit = async (execute) => {
  const { data, ...result } = await runNpmJson(['audit', '--omit=dev', '--audit-level=high', '--json'], execute);
  const counts = data?.metadata?.vulnerabilities;
  const ok = result.ok && !!counts && typeof counts === 'object';
  const summary = ok ? Object.fromEntries(['info', 'low', 'moderate', 'high', 'critical'].map((level) => [level, Number(counts[level] || 0)])) : null;
  if (summary) summary.total = Object.values(summary).reduce((total, count) => total + count, 0);
  return { ...result, ok, summary, error: ok ? undefined : result.error || 'Invalid npm audit report' };
};

const checkPackageUpdates = async (execute) => {
  const { data, ...result } = await runNpmJson(['outdated', '--json', '--long'], execute);
  const scopes = new Set(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']);
  const packages = result.ok ? Object.entries(data).map(([name, info]) => ({
    name,
    current: String(info?.current || ''),
    wanted: String(info?.wanted || ''),
    latest: String(info?.latest || ''),
    scope: scopes.has(info?.type) ? info.type : 'unknown',
    dependent: info?.dependent || null,
    homepage: info?.homepage || null,
    type: info?.type || null
  })).sort((a, b) => a.name.localeCompare(b.name)) : [];
  return { ...result, packages, count: packages.length };
};

module.exports = { readLastCheck, checkNpmAudit, checkPackageUpdates };
