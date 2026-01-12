const { openDb } = require('./db.cjs');
const { writeAuditLog } = require('./audit.cjs');

const run = () => {
  const db = openDb();
  const row = db.prepare('SELECT id, username, tokenVersion FROM users WHERE username = ?').get('superadmin');
  if (!row) {
    console.error('Superadmin not found.');
    process.exit(1);
  }
  db.prepare('UPDATE users SET mfaEnabled = 0, mfaSecretEnc = NULL, tokenVersion = ?, updatedAt = ? WHERE id = ?').run(
    Number(row.tokenVersion || 1) + 1,
    Date.now(),
    row.id
  );
  writeAuditLog(db, {
    level: 'important',
    event: 'superadmin_mfa_reset_cli',
    username: 'system',
    scopeType: 'user',
    scopeId: row.id,
    details: { targetUsername: row.username, source: 'cli' }
  });
  console.log('Superadmin MFA reset. Active sessions were invalidated.');
  db.close();
};

run();
