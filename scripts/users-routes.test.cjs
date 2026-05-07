const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { createProvisioningMailSender } = require('../server/routes/users.cjs');

test('createProvisioningMailSender logs with actor identity and does not depend on req scope', async () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  const emailAttempts = [];
  const sendProvisioningMail = createProvisioningMailSender({
    db,
    dataSecret: 'secret',
    APP_BRAND: 'Plixmap',
    getEmailConfig: () => ({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      securityMode: 'starttls',
      username: 'mailer',
      password: 'pw',
      fromName: 'Plixmap',
      fromEmail: 'noreply@example.com'
    }),
    getClientEmailConfig: () => null,
    logEmailAttempt: (_db, payload) => emailAttempts.push(payload),
    fallbackPortalPublicUrl: 'https://portal.example.com',
    transportFactory: () => ({
      sendMail: async () => ({ messageId: 'message-1' })
    })
  });

  const result = await sendProvisioningMail({
    actorUserId: 'admin-1',
    actorUsername: 'superadmin',
    clientId: 'client-1',
    clientName: 'Client One',
    recipient: 'user@example.com',
    username: 'new.user',
    temporaryPassword: 'Temp1234!',
    fullName: 'New User',
    language: 'en'
  });

  assert.deepEqual(result, { ok: true, messageId: 'message-1', smtpScope: 'global' });
  assert.equal(emailAttempts.length, 1);
  assert.equal(emailAttempts[0].userId, 'admin-1');
  assert.equal(emailAttempts[0].username, 'superadmin');
  assert.equal(emailAttempts[0].recipient, 'user@example.com');
});
