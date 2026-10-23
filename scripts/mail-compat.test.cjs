const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { buildMailFromLabel, buildMailTransportConfig } = require('../server/routes/settings.cjs');
const { createAssetPipeline } = require('../server/assetPipeline.cjs');

test('updated Nodemailer composes notification mail and calendar attachments without network access', async () => {
  const config = { host: 'smtp.example.test', port: 587, securityMode: 'starttls', username: 'plix@example.test', password: 'test', fromName: 'Plixmap' };
  assert.equal(buildMailTransportConfig(config).requireTLS, true);
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: buildMailFromLabel(config), to: ['alice@example.test', 'bob@example.test'], subject: 'Meeting notification',
    text: 'Meeting details', html: '<p>Meeting details</p>',
    attachments: [{ filename: 'meeting.ics', content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR', contentType: 'text/calendar' }]
  });
  assert.deepEqual(result.envelope.to, ['alice@example.test', 'bob@example.test']);
  const mime = result.message.toString();
  assert.match(mime, /Subject: Meeting notification/);
  assert.match(mime, /text\/html/);
  assert.match(mime, /text\/calendar/);
  assert.match(mime, /meeting\.ics/);
});

test('asset pipeline exposes the shared base64 size helper required by chat startup', () => {
  const { base64SizeBytes, parseDataUrl } = createAssetPipeline({ uploadsDir: '/unused' });
  for (const value of ['', 'a', 'ab', 'abc', 'hello']) {
    const base64 = Buffer.from(value).toString('base64');
    assert.equal(base64SizeBytes(base64), Buffer.byteLength(value));
  }
  assert.deepEqual(parseDataUrl('data:audio/webm;codecs=opus;base64,YQ=='), { mime: 'audio/webm', base64: 'YQ==' });
});
