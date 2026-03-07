const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveRequestPublicOrigin,
  buildMeetingRoomPublicUrl,
  buildMobilePublicUrl,
  buildPublicUploadUrl
} = require('../server/publicUrls.cjs');

const makeReq = (host, extraHeaders = {}) => ({
  headers: {
    host,
    ...extraHeaders
  },
  protocol: 'http'
});

test('resolveRequestPublicOrigin uses forwarded proto and LAN fallback for localhost', () => {
  const req = makeReq('localhost:8787', { 'x-forwarded-proto': 'https' });
  assert.equal(resolveRequestPublicOrigin(req, { lanHost: '192.168.1.10' }), 'https://192.168.1.10:8787');
});

test('meeting room and mobile public URLs share the same origin resolver', () => {
  const req = makeReq('intranet.acme.local:9000');
  assert.equal(buildMeetingRoomPublicUrl(req, 'room 42'), 'http://intranet.acme.local:9000/meetingroom/room%2042');
  assert.equal(buildMobilePublicUrl(req, 'room 42'), 'http://intranet.acme.local:9000/mobile?roomId=room%2042');
  assert.equal(buildMobilePublicUrl(req), 'http://intranet.acme.local:9000/mobile');
});

test('buildPublicUploadUrl preserves absolute/data/blob URLs and rewrites upload paths', () => {
  const req = makeReq('[::1]:8787');
  assert.equal(buildPublicUploadUrl(req, 'https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png');
  assert.equal(buildPublicUploadUrl(req, 'data:image/png;base64,abc'), 'data:image/png;base64,abc');
  assert.equal(buildPublicUploadUrl(req, 'blob:https://app.example.com/id'), 'blob:https://app.example.com/id');
  assert.equal(buildPublicUploadUrl(req, '/uploads/logo.png', { lanHost: '10.0.0.8' }), 'http://10.0.0.8:8787/public-uploads/logo.png');
});
