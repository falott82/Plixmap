// Network/security header helpers extracted from index.cjs: Content-Security-
// Policy builder and IP normalization / private-range detection.
const net = require('net');
const { serverConfig } = require('./config.cjs');

const buildCspHeader = () => {
  const allowMediaPipe = serverConfig.cspAllowMediaPipe;
  const allowEval = serverConfig.cspAllowEval;
  const scriptSrc = ["'self'"];
  const connectSrc = ["'self'", 'ws:', 'wss:'];
  const workerSrc = ["'self'", 'blob:'];
  if (allowEval) scriptSrc.push("'unsafe-eval'", "'wasm-unsafe-eval'");
  if (allowMediaPipe) {
    scriptSrc.push('https://cdn.jsdelivr.net');
    connectSrc.push('https://cdn.jsdelivr.net', 'https://storage.googleapis.com');
    workerSrc.push('https://cdn.jsdelivr.net');
  }
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src ${scriptSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `worker-src ${workerSrc.join(' ')}`
  ].join('; ');
};

const normalizeIp = (ip) => {
  if (!ip) return '';
  let value = String(ip).trim();
  if (!value) return '';
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value;
};

const isPrivateIpv4 = (ip) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isPrivateIpv6 = (ip) => {
  const val = ip.toLowerCase();
  if (val === '::1') return true;
  if (val.startsWith('fe80:') || val.startsWith('fe80::')) return true;
  if (val.startsWith('fc') || val.startsWith('fd')) return true;
  return false;
};

const isPrivateIp = (ip) => {
  const type = net.isIP(ip);
  if (type === 4) return isPrivateIpv4(ip);
  if (type === 6) return isPrivateIpv6(ip);
  return false;
};

const allowPrivateImportForRequest = (req) => {
  const ip = normalizeIp(req.ip || req.connection?.remoteAddress || '');
  if (!ip) return false;
  return isPrivateIp(ip);
};

module.exports = { buildCspHeader, normalizeIp, isPrivateIp, allowPrivateImportForRequest };
