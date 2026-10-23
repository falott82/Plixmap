const { requireSuperAdmin } = require('../access.cjs');
const { normalizeHttpUrl } = require('../config.cjs');
const { normalizeSemver, compareSemver } = require('../semver.cjs');
const UPDATE_CHECK_TIMEOUT_MS = 5000;
const registerUpdateRoutes = (app, { requireAuth, rateByUser, APP_VERSION, UPDATE_MANIFEST_URL, UPDATE_MANIFEST_FALLBACK_URL, serverLog }) => {
  app.get('/api/update/latest', requireAuth, rateByUser('update_check', 60 * 1000, 30), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
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

module.exports = { registerUpdateRoutes };
