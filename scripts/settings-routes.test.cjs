const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMailFromLabel,
  buildMailTransportConfig,
  normalizeLogsMeta
} = require('../server/routes/settings.cjs');

test('normalizeLogsMeta resolves missing usernames without mutating input shape', () => {
  const meta = {
    mail: { userId: 'u1', username: '', ts: 10 },
    audit: { userId: 'u2', username: 'alice', ts: 20 },
    broken: null
  };
  const resolved = normalizeLogsMeta(meta, (userId) => (userId === 'u1' ? 'mario' : null));
  assert.deepEqual(resolved, {
    mail: { userId: 'u1', username: 'mario', ts: 10 },
    audit: { userId: 'u2', username: 'alice', ts: 20 }
  });
});

test('buildMailTransportConfig preserves tls mode semantics', () => {
  assert.deepEqual(buildMailTransportConfig({ host: 'smtp.example.com', port: 465, secure: true, username: 'user', password: 'pwd' }), {
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    requireTLS: false,
    auth: { user: 'user', pass: 'pwd' }
  });
  assert.deepEqual(buildMailTransportConfig({ host: 'smtp.example.com', port: 587, securityMode: 'starttls', username: '', password: '' }), {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    requireTLS: true
  });
});

test('buildMailFromLabel safely formats sender labels', () => {
  assert.equal(buildMailFromLabel({ fromName: 'Ops "Team"', fromEmail: 'ops@example.com', username: '' }), '"Ops Team" <ops@example.com>');
  assert.equal(buildMailFromLabel({ fromName: '', fromEmail: '', username: 'smtp@example.com' }), 'smtp@example.com');
});
