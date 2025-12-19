const crypto = require('crypto');
const speakeasy = require('speakeasy');

const keyFromAuthSecret = (authSecretB64) => {
  const buf = Buffer.from(String(authSecretB64 || ''), 'base64');
  return crypto.createHash('sha256').update(buf).digest(); // 32 bytes
};

const encryptSecret = (authSecretB64, plaintext) => {
  const key = keyFromAuthSecret(authSecretB64);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
};

const decryptSecret = (authSecretB64, blob) => {
  if (!blob || typeof blob !== 'string') return null;
  const [ivB64, tagB64, ctB64] = blob.split('.');
  if (!ivB64 || !tagB64 || !ctB64) return null;
  const key = keyFromAuthSecret(authSecretB64);
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
};

const generateTotpSecret = (username) => {
  return speakeasy.generateSecret({ name: `Deskly (${username})`, length: 20 });
};

const verifyTotp = (secretBase32, token) => {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token: String(token || '').replace(/\s+/g, ''),
    window: 1
  });
};

module.exports = { encryptSecret, decryptSecret, generateTotpSecret, verifyTotp };

