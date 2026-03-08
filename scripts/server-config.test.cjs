const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createServerConfig, normalizeHttpUrl, readSecretInput } = require('../server/config.cjs');

test('createServerConfig applies defaults and normalizes supported values', () => {
  const config = createServerConfig(
    {
      NODE_ENV: 'production',
      PORT: '9000',
      HOST: '127.0.0.1',
      PLIXMAP_LOG_LEVEL: 'debug',
      PLIXMAP_TRUST_PROXY: 'loopback',
      PLIXMAP_COOKIE_SECURE: 'true',
      PLIXMAP_CSP_ALLOW_MEDIAPIPE: '1',
      PLIXMAP_UPLOAD_MAX_IMAGE_MB: '16',
      PLIXMAP_UPLOAD_MAX_PDF_MB: '24',
      PLIXMAP_IMPORT_MAX_BYTES: '4096',
      PLIXMAP_IMPORT_ALLOW_PRIVATE: 'yes',
      PLIXMAP_CHAT_MAX_VOICE_MB: '8',
      PUBLIC_APP_URL: ' https://portal.example.com/base ',
      PLIXMAP_BACKUP_DIR: '/tmp/plixmap-backups',
      PLIXMAP_BACKUP_KEEP: '30',
      PLIXMAP_SECRET_MIN_LENGTH: '48',
      PLIXMAP_REQUIRE_ENV_SECRETS: 'true',
      PLIXMAP_UPDATE_MANIFEST_URL: 'https://cdn.example.com/latest.json',
      PLIXMAP_UPDATE_MANIFEST_FALLBACK_URL: 'https://cdn.example.com/latest-fallback.json'
    },
    { cwd: '/srv/plixmap' }
  );

  assert.equal(config.nodeEnv, 'production');
  assert.equal(config.port, 9000);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.logLevel, 'debug');
  assert.equal(config.trustProxy, 'loopback');
  assert.equal(config.cookieSecureOverride, true);
  assert.equal(config.cspAllowMediaPipe, true);
  assert.equal(config.cspAllowEval, true);
  assert.equal(config.uploadMaxImageBytes, 16 * 1024 * 1024);
  assert.equal(config.uploadMaxPdfBytes, 24 * 1024 * 1024);
  assert.equal(config.importMaxResponseBytes, 4096);
  assert.equal(config.importAllowPrivate, true);
  assert.equal(config.chatMaxVoiceAttachmentBytes, 8 * 1024 * 1024);
  assert.equal(config.publicAppUrl, 'https://portal.example.com/base');
  assert.equal(config.backupDir, '/tmp/plixmap-backups');
  assert.equal(config.backupRetention, 30);
  assert.equal(config.secretMinLength, 48);
  assert.equal(config.requireEnvSecrets, true);
  assert.equal(config.updateManifestUrl, 'https://cdn.example.com/latest.json');
  assert.equal(config.updateManifestFallbackUrl, 'https://cdn.example.com/latest-fallback.json');
  assert.ok(Object.isFrozen(config));
});

test('createServerConfig falls back on invalid values', () => {
  const config = createServerConfig(
    {
      PORT: 'abc',
      PLIXMAP_LOG_LEVEL: 'verbose',
      PLIXMAP_COOKIE_SECURE: '',
      PLIXMAP_BACKUP_KEEP: '0',
      PLIXMAP_SECRET_MIN_LENGTH: '12',
      PLIXMAP_UPDATE_MANIFEST_URL: 'ftp://invalid.example.com/release.json'
    },
    { cwd: '/srv/plixmap' }
  );

  assert.equal(config.port, 8787);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.logLevel, 'info');
  assert.equal(config.cookieSecureOverride, null);
  assert.equal(config.backupRetention, 20);
  assert.equal(config.secretMinLength, 32);
  assert.equal(config.dbPath, '/srv/plixmap/data/plixmap.sqlite');
  assert.equal(config.updateManifestUrl, 'https://www.plixmap.com/updates/latest.json');
});

test('createServerConfig preserves PORT=0 for ephemeral binds', () => {
  const config = createServerConfig({ PORT: '0' });
  assert.equal(config.port, 0);
});

test('createServerConfig fails fast on invalid security booleans', () => {
  assert.throws(
    () => createServerConfig({ PLIXMAP_REQUIRE_ENV_SECRETS: 'maybe' }),
    /PLIXMAP_REQUIRE_ENV_SECRETS/
  );
  assert.throws(
    () => createServerConfig({ PLIXMAP_COOKIE_SECURE: 'maybe' }),
    /PLIXMAP_COOKIE_SECURE/
  );
});

test('readSecretInput supports direct env values and *_FILE mounts', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plixmap-config-'));
  const secretFile = path.join(tempDir, 'auth-secret.txt');
  fs.writeFileSync(secretFile, '  mounted-secret  ', 'utf8');

  assert.equal(readSecretInput('PLIXMAP_AUTH_SECRET', { PLIXMAP_AUTH_SECRET: ' direct-secret ' }), 'direct-secret');
  assert.equal(readSecretInput('PLIXMAP_AUTH_SECRET', { PLIXMAP_AUTH_SECRET_FILE: secretFile }), 'mounted-secret');
});

test('normalizeHttpUrl only accepts http and https URLs', () => {
  assert.equal(normalizeHttpUrl('https://app.example.com/path/'), 'https://app.example.com/path/');
  assert.equal(normalizeHttpUrl('http://app.example.com/path'), 'http://app.example.com/path');
  assert.equal(normalizeHttpUrl('ftp://app.example.com/path'), null);
  assert.equal(normalizeHttpUrl('not a url'), null);
});
