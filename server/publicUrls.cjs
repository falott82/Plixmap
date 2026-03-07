const os = require('os');

const LOCALHOST_HOSTS = new Set(['', 'localhost', '127.0.0.1', '::1']);

const getPreferredLanIPv4 = () => {
  try {
    const nets = os.networkInterfaces ? os.networkInterfaces() : {};
    const candidates = [];
    for (const entries of Object.values(nets || {})) {
      for (const entry of entries || []) {
        if (!entry || entry.internal) continue;
        if (entry.family !== 'IPv4' && entry.family !== 4) continue;
        const addr = String(entry.address || '').trim();
        if (!addr) continue;
        candidates.push(addr);
      }
    }
    return (
      candidates.find((ip) => /^192\.168\./.test(ip)) ||
      candidates.find((ip) => /^10\./.test(ip)) ||
      candidates.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) ||
      candidates[0] ||
      null
    );
  } catch {
    return null;
  }
};

const parseHostHeader = (hostHeader) => {
  const raw = String(hostHeader || '').trim();
  if (raw.startsWith('[')) {
    const match = /^\[([^\]]+)\](?::(\d+))?$/.exec(raw);
    return {
      hostname: String(match?.[1] || ''),
      port: String(match?.[2] || '')
    };
  }
  const [hostname, port] = raw.split(':');
  return {
    hostname: String(hostname || ''),
    port: String(port || '')
  };
};

const resolveRequestPublicOrigin = (req, options = {}) => {
  const { lanHost = getPreferredLanIPv4() } = options;
  const host = parseHostHeader(req?.headers?.host || '');
  const proto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http')
    .split(',')[0]
    .trim() || 'http';
  const hostname = LOCALHOST_HOSTS.has(host.hostname) ? lanHost || host.hostname || 'localhost' : host.hostname;
  const portPart = host.port ? `:${host.port}` : '';
  return `${proto}://${hostname}${portPart}`;
};

const buildMeetingRoomPublicUrl = (req, roomId, options = {}) => {
  const encoded = encodeURIComponent(String(roomId || '').trim());
  return `${resolveRequestPublicOrigin(req, options)}/meetingroom/${encoded}`;
};

const buildMobilePublicUrl = (req, roomId, options = {}) => {
  const base = `${resolveRequestPublicOrigin(req, options)}/mobile`;
  const rid = String(roomId || '').trim();
  return rid ? `${base}?roomId=${encodeURIComponent(rid)}` : base;
};

const buildPublicUploadUrl = (req, rawUrl, options = {}) => {
  const raw = String(rawUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/uploads/')) return raw;
  return `${resolveRequestPublicOrigin(req, options)}/public-uploads/${raw.slice('/uploads/'.length)}`;
};

module.exports = {
  getPreferredLanIPv4,
  resolveRequestPublicOrigin,
  buildMeetingRoomPublicUrl,
  buildMobilePublicUrl,
  buildPublicUploadUrl
};
