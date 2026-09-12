// Maintenance / "Nerd area" routes: audit verbosity toggle, npm audit runner,
// package update scan, code analyzer, and the remote update check.
// Extracted from server/index.cjs; all collaborators are injected so the module
// stays free of module-level state and is unit-testable.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const registerMaintenanceRoutes = (app, deps) => {
  const {
    db,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    getAuditVerboseEnabled,
    getAppSetting,
    setAppSetting,
    resolveUsername,
    serverLog,
    normalizeHttpUrl,
    normalizeSemver,
    compareSemver,
    APP_VERSION,
    UPDATE_CHECK_TIMEOUT_MS,
    UPDATE_MANIFEST_URL,
    UPDATE_MANIFEST_FALLBACK_URL
  } = deps;

  app.get('/api/settings/audit', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.json({ auditVerbose: getAuditVerboseEnabled(db) });
  });

  app.get('/api/settings/npm-audit', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const raw = getAppSetting('npmAuditLastCheck');
    let lastCheckAt = null;
    let lastCheckBy = null;
    let lastCheckUserId = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          lastCheckAt = Number(parsed.ts || parsed.lastCheckAt || 0) || null;
          lastCheckUserId = parsed.userId || null;
          lastCheckBy = parsed.username || resolveUsername(parsed.userId) || null;
        } else {
          lastCheckAt = Number(raw) || null;
        }
      } catch {
        lastCheckAt = Number(raw) || null;
      }
    }
    res.json({ lastCheckAt, lastCheckBy, lastCheckUserId });
  });

  app.post('/api/settings/npm-audit', requireAuth, rateByUser('npm_audit', 10 * 60 * 1000, 2), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const startedAt = Date.now();
    const checkStartedAt = Date.now();
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFile(
      npmCmd,
      ['audit', '--omit=dev', '--audit-level=high', '--json'],
      { cwd: process.cwd(), timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        let parsed = null;
        let summary = null;
        if (stdout) {
          try {
            parsed = JSON.parse(stdout);
          } catch {}
        }
        if (parsed && parsed.metadata && parsed.metadata.vulnerabilities) {
          const raw = parsed.metadata.vulnerabilities;
          const levels = ['info', 'low', 'moderate', 'high', 'critical'];
          let total = 0;
          summary = {};
          for (const level of levels) {
            const count = Number(raw[level] || 0);
            summary[level] = count;
            total += count;
          }
          summary.total = total;
        }
        const durationMs = Date.now() - startedAt;
        const exitCode = err && typeof err.code === 'number' ? err.code : 0;
        const trim = (text) => {
          const src = String(text || '');
          if (src.length <= 20000) return src;
          return `${src.slice(0, 20000)}\n... (truncated)`;
        };
        const ok = !!parsed;
        if (ok) {
          writeAuditLog(db, {
            level: 'important',
            event: 'npm_audit_run',
            userId: req.userId,
            ...requestMeta(req),
            details: { summary, exitCode, durationMs }
          });
        }
        setAppSetting(
          'npmAuditLastCheck',
          JSON.stringify({
            ts: checkStartedAt,
            userId: req.userId || null,
            username: req.username || resolveUsername(req.userId) || null
          })
        );
        res.json({
          ok,
          summary,
          durationMs,
          exitCode,
          lastCheckAt: checkStartedAt,
          lastCheckBy: req.username || resolveUsername(req.userId) || null,
          error: !ok ? (err?.message || 'Failed to run npm audit') : undefined,
          stderr: trim(stderr)
        });
      }
    );
  });

  app.get('/api/settings/package-updates', requireAuth, (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const raw = getAppSetting('packageUpdatesLastCheck');
    let lastCheckAt = null;
    let lastCheckBy = null;
    let lastCheckUserId = null;
    let count = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          lastCheckAt = Number(parsed.ts || parsed.lastCheckAt || 0) || null;
          lastCheckUserId = parsed.userId || null;
          lastCheckBy = parsed.username || resolveUsername(parsed.userId) || null;
          count = Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : null;
        } else {
          lastCheckAt = Number(raw) || null;
        }
      } catch {
        lastCheckAt = Number(raw) || null;
      }
    }
    res.json({ lastCheckAt, lastCheckBy, lastCheckUserId, count });
  });

  app.post('/api/settings/package-updates', requireAuth, rateByUser('package_updates', 5 * 60 * 1000, 6), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const startedAt = Date.now();
    const checkedAt = Date.now();
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFile(
      npmCmd,
      ['outdated', '--json', '--long'],
      { cwd: process.cwd(), timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const exitCode = err && typeof err.code === 'number' ? err.code : 0;
        const trim = (text) => {
          const src = String(text || '');
          if (src.length <= 20000) return src;
          return `${src.slice(0, 20000)}\n... (truncated)`;
        };
        let parsed = {};
        let parseOk = true;
        if (String(stdout || '').trim()) {
          try {
            parsed = JSON.parse(stdout);
          } catch {
            parseOk = false;
          }
        }
        const packages = parseOk
          ? Object.entries(parsed || {})
              .map(([name, info]) => ({
                name,
                current: String(info?.current || ''),
                wanted: String(info?.wanted || ''),
                latest: String(info?.latest || ''),
                scope:
                  info?.type === 'dependencies' ||
                  info?.type === 'devDependencies' ||
                  info?.type === 'optionalDependencies' ||
                  info?.type === 'peerDependencies'
                    ? info.type
                    : 'unknown',
                dependent: info?.dependent || null,
                homepage: info?.homepage || null,
                type: info?.type || null
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];
        const ok = parseOk && (!err || exitCode === 1);
        if (ok) {
          writeAuditLog(db, {
            level: 'important',
            event: 'package_updates_check',
            userId: req.userId,
            ...requestMeta(req),
            details: { count: packages.length, exitCode, durationMs: Date.now() - startedAt }
          });
          setAppSetting(
            'packageUpdatesLastCheck',
            JSON.stringify({
              ts: checkedAt,
              userId: req.userId || null,
              username: req.username || resolveUsername(req.userId) || null,
              count: packages.length
            })
          );
        }
        res.json({
          ok,
          packages,
          count: packages.length,
          checkedAt,
          durationMs: Date.now() - startedAt,
          exitCode,
          lastCheckBy: req.username || resolveUsername(req.userId) || null,
          lastCheckUserId: req.userId || null,
          error: !ok ? (err?.message || 'Failed to check package updates') : undefined,
          stderr: trim(stderr)
        });
      }
    );
  });

  app.post('/api/settings/code-analyzer', requireAuth, rateByUser('code_analyzer', 60 * 1000, 20), (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const root = process.cwd();
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
    try {
      scanDir(root);
      rows.sort((a, b) => b.codeLines - a.codeLines || b.bytes - a.bytes || a.path.localeCompare(b.path));
      const ranked = rows.slice(0, 150).map((row, idx) => ({ rank: idx + 1, ...row }));
      const totalLines = rows.reduce((sum, row) => sum + row.codeLines, 0);
      res.json({
        ok: true,
        root,
        filesScanned: rows.length,
        totalLines,
        largestFileLines: rows[0]?.codeLines || 0,
        updatedAt: Date.now(),
        files: ranked
      });
    } catch (err) {
      res.status(500).json({ ok: false, root, filesScanned: 0, totalLines: 0, largestFileLines: 0, updatedAt: Date.now(), files: [], error: err?.message || 'Code analysis failed' });
    }
  });

  app.get('/api/update/latest', requireAuth, rateByUser('update_check', 60 * 1000, 30), async (req, res) => {
    if (!req.isSuperAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const checkedAt = Date.now();
    const manifestUrls = [UPDATE_MANIFEST_URL, UPDATE_MANIFEST_FALLBACK_URL].filter((url, idx, list) => !!url && list.indexOf(url) === idx);
    const basePayload = {
      ok: false,
      currentVersion: APP_VERSION,
      latestVersion: null,
      minSupportedVersion: null,
      updateAvailable: false,
      unsupported: false,
      mandatory: false,
      downloadUrl: null,
      releaseNotesUrl: null,
      publishedAt: null,
      checkedAt
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
    try {
      let chosenPayload = null;
      let chosenSource = '';
      let lastError = '';
      for (const manifestUrl of manifestUrls) {
        try {
          const response = await fetch(manifestUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal
          });
          if (!response.ok) {
            lastError = `Manifest not reachable (${response.status}) from ${manifestUrl}`;
            continue;
          }
          const payload = await response.json();
          const latestVersion = normalizeSemver(payload?.latestVersion);
          if (!latestVersion) {
            lastError = `Manifest missing valid latestVersion at ${manifestUrl}`;
            continue;
          }
          chosenPayload = payload;
          chosenSource = manifestUrl;
          break;
        } catch (error) {
          lastError = `Manifest request failed for ${manifestUrl}: ${error?.message || 'unknown_error'}`;
        }
      }
      if (!chosenPayload) {
        res.json({ ...basePayload, error: lastError || 'Manifest not reachable' });
        return;
      }
      const latestVersion = normalizeSemver(chosenPayload?.latestVersion);
      const minSupportedVersion = normalizeSemver(chosenPayload?.minSupportedVersion);
      const currentVersion = normalizeSemver(APP_VERSION) || APP_VERSION;
      const updateAvailable = !!latestVersion && compareSemver(latestVersion, currentVersion) > 0;
      const unsupported = !!(minSupportedVersion && compareSemver(currentVersion, minSupportedVersion) < 0);
      const publishedAt =
        typeof chosenPayload?.publishedAt === 'string' && !Number.isNaN(Date.parse(chosenPayload.publishedAt))
          ? new Date(chosenPayload.publishedAt).toISOString()
          : null;
      res.json({
        ok: true,
        currentVersion,
        latestVersion: latestVersion || null,
        minSupportedVersion: minSupportedVersion || null,
        updateAvailable,
        unsupported,
        mandatory: !!chosenPayload?.mandatory || unsupported,
        downloadUrl: normalizeHttpUrl(chosenPayload?.downloadUrl),
        releaseNotesUrl: normalizeHttpUrl(chosenPayload?.releaseNotesUrl),
        publishedAt,
        checkedAt,
        source: chosenSource
      });
    } catch (error) {
      serverLog('warn', 'update_check_failed', {
        userId: req.userId || null,
        requestId: req.requestId || null,
        error: error?.message || 'unknown_error'
      });
      res.json({ ...basePayload, error: 'Unable to check updates right now' });
    } finally {
      clearTimeout(timeout);
    }
  });

};

module.exports = { registerMaintenanceRoutes };
