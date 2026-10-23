const buildMailTransportConfig = (config) => {
  const securityMode = config.securityMode || (config.secure ? 'ssl' : 'starttls');
  return {
    host: config.host,
    port: config.port,
    secure: securityMode === 'ssl',
    requireTLS: securityMode === 'starttls',
    ...(config.username ? { auth: { user: config.username, pass: config.password } } : {})
  };
};

const buildMailFromLabel = (config) => {
  const fromEmail = config.fromEmail || config.username;
  if (!fromEmail) return '';
  return config.fromName ? `"${String(config.fromName).replace(/"/g, '')}" <${fromEmail}>` : fromEmail;
};

module.exports = { buildMailTransportConfig, buildMailFromLabel };
