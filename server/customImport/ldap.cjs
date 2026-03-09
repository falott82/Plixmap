const { Client } = require('ldapts');

const LDAP_SECURITY_VALUES = new Set(['ldaps', 'starttls', 'ldap']);
const LDAP_AUTH_TYPES = new Set(['anonymous', 'simple', 'domain_user', 'user_principal_name']);
const LDAP_SCOPE_VALUES = new Set(['sub', 'one']);
const LDAP_ATTRIBUTE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9._;-]*$/;
const DEFAULT_SECURITY = 'ldaps';
const DEFAULT_AUTH_TYPE = 'simple';
const DEFAULT_SIZE_LIMIT = 1000;
const DEFAULT_TIMEOUT_MS = 5000;

const normalizeText = (value) => (value === null || value === undefined ? '' : String(value).trim());
const normalizeEmailKey = (value) => normalizeText(value).toLowerCase();
const normalizeUpperText = (value) => normalizeText(value).toUpperCase();
const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, '');
const normalizeAttributeName = (value, fallback) => {
  const raw = normalizeText(value);
  if (!raw) return fallback;
  return LDAP_ATTRIBUTE_NAME_REGEX.test(raw) ? raw : fallback;
};

const normalizeLdapServer = (server, security, port) => {
  const raw = normalizeText(server);
  if (!raw) return { ok: false, error: 'Missing LDAP server' };
  try {
    if (raw.includes('://')) {
      const parsed = new URL(raw);
      if (!['ldap:', 'ldaps:'].includes(parsed.protocol)) {
        return { ok: false, error: 'Invalid LDAP server protocol' };
      }
      if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
        return { ok: false, error: 'Invalid LDAP server URL' };
      }
      const protocolSecurity = parsed.protocol === 'ldaps:' ? 'ldaps' : security === 'starttls' ? 'starttls' : 'ldap';
      return {
        ok: true,
        server: parsed.hostname,
        port: Number(parsed.port || port || (protocolSecurity === 'ldaps' ? 636 : 389)),
        security: protocolSecurity
      };
    }
    return {
      ok: true,
      server: raw.replace(/^\/+|\/+$/g, ''),
      port: Number(port || (security === 'ldaps' ? 636 : 389)),
      security
    };
  } catch {
    return { ok: false, error: 'Invalid LDAP server' };
  }
};

const normalizeLdapImportConfig = (payload = {}) => {
  const security = LDAP_SECURITY_VALUES.has(normalizeText(payload.security).toLowerCase())
    ? normalizeText(payload.security).toLowerCase()
    : DEFAULT_SECURITY;
  const authType = LDAP_AUTH_TYPES.has(normalizeText(payload.authType).toLowerCase())
    ? normalizeText(payload.authType).toLowerCase()
    : DEFAULT_AUTH_TYPE;
  const scope = LDAP_SCOPE_VALUES.has(normalizeText(payload.scope).toLowerCase())
    ? normalizeText(payload.scope).toLowerCase()
    : 'sub';
  const sizeLimit = Number.isFinite(Number(payload.sizeLimit))
    ? Math.max(1, Math.min(5000, Math.floor(Number(payload.sizeLimit))))
    : DEFAULT_SIZE_LIMIT;
  const timeoutMs = Number.isFinite(Number(payload.timeoutMs))
    ? Math.max(1000, Math.min(30000, Math.floor(Number(payload.timeoutMs))))
    : DEFAULT_TIMEOUT_MS;
  const serverResult = normalizeLdapServer(payload.server, security, payload.port);
  if (!serverResult.ok) return serverResult;
  const normalized = {
    clientId: normalizeText(payload.clientId),
    server: serverResult.server,
    port: serverResult.port,
    security: serverResult.security,
    scope,
    authType,
    domain: normalizeText(payload.domain),
    username: normalizeText(payload.username),
    password: payload.password === undefined ? undefined : String(payload.password || ''),
    baseDn: normalizeText(payload.baseDn),
    userFilter: normalizeText(payload.userFilter) || '(mail=*)',
    emailAttribute: normalizeAttributeName(payload.emailAttribute, 'mail'),
    firstNameAttribute: normalizeAttributeName(payload.firstNameAttribute, 'givenName'),
    lastNameAttribute: normalizeAttributeName(payload.lastNameAttribute, 'sn'),
    externalIdAttribute: normalizeAttributeName(payload.externalIdAttribute, 'sAMAccountName'),
    roleAttribute: normalizeAttributeName(payload.roleAttribute, 'title'),
    mobileAttribute: normalizeAttributeName(payload.mobileAttribute, 'mobile'),
    dept1Attribute: normalizeAttributeName(payload.dept1Attribute, 'department'),
    sizeLimit,
    timeoutMs
  };
  if (!normalized.baseDn) return { ok: false, error: 'Missing LDAP base DN' };
  if (normalized.authType !== 'anonymous' && !normalized.username) {
    return { ok: false, error: 'Missing LDAP username' };
  }
  if ((normalized.authType === 'domain_user' || normalized.authType === 'user_principal_name') && !normalized.domain) {
    return { ok: false, error: 'Missing LDAP domain' };
  }
  if (normalized.authType !== 'anonymous' && payload.requirePassword && !normalizeText(payload.password) && !payload.hasPassword) {
    return { ok: false, error: 'Missing LDAP password' };
  }
  if (normalized.userFilter.length > 1000) return { ok: false, error: 'LDAP filter too long' };
  return { ok: true, config: normalized };
};

const buildLdapUrl = (config) => `${config.security === 'ldaps' ? 'ldaps' : 'ldap'}://${config.server}:${config.port}`;

const resolveLdapEffectiveConfig = ({ clientId, savedConfig = null, draftConfig = null } = {}) => {
  const cid = normalizeText(clientId);
  if (!cid) return { ok: false, error: 'Missing clientId' };
  if (!savedConfig && !draftConfig) return { ok: false, error: 'Missing LDAP config' };
  const merged = {
    ...(savedConfig || {}),
    ...(draftConfig || {}),
    clientId: cid,
    password:
      draftConfig && Object.prototype.hasOwnProperty.call(draftConfig, 'password')
        ? draftConfig.password
        : savedConfig?.password
  };
  return normalizeLdapImportConfig({
    ...merged,
    hasPassword: !!savedConfig?.password,
    requirePassword: !savedConfig?.password
  });
};

const buildLdapBindIdentity = (config) => {
  if (config.authType === 'anonymous') return '';
  if (config.authType === 'domain_user') return `${config.domain}\\${config.username}`;
  if (config.authType === 'user_principal_name') return `${config.username}@${config.domain}`;
  return config.username;
};

const getLdapTlsOptions = (config) => ({
  minVersion: 'TLSv1.2',
  servername: config.server,
  rejectUnauthorized: true
});

const formatLdapError = (error) => {
  const code = normalizeText(error?.code || '').toUpperCase();
  const rawMessage = normalizeText(error?.message || '');
  if (code === 'ENOTFOUND') return 'LDAP host not found (check server name / DNS)';
  if (code === 'ECONNREFUSED') return 'LDAP connection refused (check host / port / firewall)';
  if (code === 'ECONNRESET') return 'LDAP connection reset by peer';
  if (code === 'ETIMEDOUT') return 'LDAP connection timed out';
  if (code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    return 'LDAP TLS certificate not trusted';
  }
  if (code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return 'LDAP TLS certificate verification failed';
  if (/InvalidCredentialsError/i.test(rawMessage)) return 'LDAP bind failed: invalid username or password';
  if (/NoSuchObjectError/i.test(rawMessage)) return 'LDAP search failed: base DN not found';
  if (/ConstraintViolationError/i.test(rawMessage)) return 'LDAP query rejected by directory constraints';
  if (/OperationsError/i.test(rawMessage)) return 'LDAP operation failed';
  if (/socket hang up/i.test(rawMessage)) return 'LDAP socket closed unexpectedly';
  return rawMessage || 'LDAP request failed';
};

const getEntryValue = (entry, attributeName) => {
  const target = normalizeText(attributeName).toLowerCase();
  if (!target || !entry || typeof entry !== 'object') return '';
  const matchKey = Object.keys(entry).find((key) => String(key || '').toLowerCase() === target);
  if (!matchKey) return '';
  const raw = entry[matchKey];
  if (Array.isArray(raw)) {
    const first = raw.find((value) => value !== null && value !== undefined && String(value).trim());
    return first === undefined ? '' : String(first).trim();
  }
  if (Buffer.isBuffer(raw)) return raw.toString('utf8').trim();
  return normalizeText(raw);
};

const mapLdapEntryToEmployee = (entry, config, index) => {
  const email = normalizeText(getEntryValue(entry, config.emailAttribute)).toLowerCase();
  const externalSourceId =
    getEntryValue(entry, config.externalIdAttribute) ||
    getEntryValue(entry, 'uid') ||
    getEntryValue(entry, 'cn') ||
    email ||
    `row-${index + 1}`;
  return {
    externalId: `ldap:${externalSourceId}`,
    firstName: normalizeUpperText(getEntryValue(entry, config.firstNameAttribute)),
    lastName: normalizeUpperText(getEntryValue(entry, config.lastNameAttribute)),
    role: normalizeUpperText(getEntryValue(entry, config.roleAttribute)),
    dept1: normalizeUpperText(getEntryValue(entry, config.dept1Attribute)),
    dept2: '',
    dept3: '',
    email,
    mobile: normalizePhone(getEntryValue(entry, config.mobileAttribute)),
    ext1: '',
    ext2: '',
    ext3: '',
    isExternal: false
  };
};

const createLdapClient = (config) =>
  new Client({
    url: buildLdapUrl(config),
    timeout: config.timeoutMs || DEFAULT_TIMEOUT_MS,
    connectTimeout: config.timeoutMs || DEFAULT_TIMEOUT_MS,
    tlsOptions: config.security === 'ldaps' ? getLdapTlsOptions(config) : undefined
  });

const withBoundLdapClient = async (config, factory, callback) => {
  const clientFactory = typeof factory === 'function' ? factory : createLdapClient;
  const client = clientFactory(config);
  let bound = false;
  try {
    if (config.security === 'starttls') {
      await client.startTLS(getLdapTlsOptions(config));
    }
    if (config.authType !== 'anonymous') {
      await client.bind(buildLdapBindIdentity(config), String(config.password || ''));
    }
    bound = true;
    return await callback(client);
  } finally {
    if (client && typeof client.unbind === 'function') {
      try {
        await client.unbind();
      } catch {
        if (!bound) {
          // ignore cleanup errors on failed binds
        }
      }
    }
  }
};

const fetchEmployeesFromLdap = async (config, options = {}) => {
  const normalizedResult = normalizeLdapImportConfig(config);
  if (!normalizedResult.ok) {
    return { ok: false, status: 400, error: normalizedResult.error };
  }
  const normalized = normalizedResult.config;
  const sizeLimit = Math.max(1, Math.min(normalized.sizeLimit, Number(options.sizeLimit || normalized.sizeLimit)));
  const attributeList = Array.from(
    new Set([
      normalized.emailAttribute,
      normalized.firstNameAttribute,
      normalized.lastNameAttribute,
      normalized.externalIdAttribute,
      normalized.roleAttribute,
      normalized.mobileAttribute,
      normalized.dept1Attribute
    ])
  );
  try {
    const result = await withBoundLdapClient(normalized, options.clientFactory, async (client) => {
      const search = await client.search(normalized.baseDn, {
        scope: normalized.scope,
        filter: normalized.userFilter,
        attributes: attributeList,
        sizeLimit
      });
      const employees = (search.searchEntries || []).map((entry, index) => mapLdapEntryToEmployee(entry, normalized, index));
      return {
        ok: true,
        status: 200,
        employees,
        returnedCount: employees.length
      };
    });
    return result;
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: formatLdapError(error)
    };
  }
};

const prepareLdapImportPreview = (existingRows, employees) => {
  const localRows = Array.isArray(existingRows) ? existingRows : [];
  const remoteRows = Array.isArray(employees) ? employees : [];
  const localByEmail = new Map();
  const localByExternalId = new Map();
  for (const row of localRows) {
    const emailKey = normalizeEmailKey(row.email);
    const externalId = normalizeText(row.externalId);
    if (emailKey && !localByEmail.has(emailKey)) localByEmail.set(emailKey, row);
    if (externalId && !localByExternalId.has(externalId)) localByExternalId.set(externalId, row);
  }
  const incomingEmailCounts = new Map();
  const incomingIdCounts = new Map();
  for (const row of remoteRows) {
    const emailKey = normalizeEmailKey(row.email);
    const externalId = normalizeText(row.externalId);
    if (emailKey) incomingEmailCounts.set(emailKey, (incomingEmailCounts.get(emailKey) || 0) + 1);
    if (externalId) incomingIdCounts.set(externalId, (incomingIdCounts.get(externalId) || 0) + 1);
  }
  const importableRows = [];
  const skippedRows = [];
  const matchedExistingRows = [];
  const matchedExistingKeys = new Set();
  for (const row of remoteRows) {
    const emailKey = normalizeEmailKey(row.email);
    const externalId = normalizeText(row.externalId);
    if (!emailKey) {
      skippedRows.push({ ...row, skipReason: 'missing_email' });
      continue;
    }
    if ((incomingEmailCounts.get(emailKey) || 0) > 1) {
      skippedRows.push({ ...row, skipReason: 'duplicate_email_in_ldap' });
      continue;
    }
    if (externalId && (incomingIdCounts.get(externalId) || 0) > 1) {
      skippedRows.push({ ...row, skipReason: 'duplicate_external_id_in_ldap' });
      continue;
    }
    const existingByEmail = localByEmail.get(emailKey) || null;
    if (existingByEmail) {
      const matchKey = `${normalizeText(existingByEmail.clientId)}:${normalizeText(existingByEmail.externalId)}`;
      if (!matchedExistingKeys.has(matchKey)) {
        matchedExistingKeys.add(matchKey);
        matchedExistingRows.push(existingByEmail);
      }
      skippedRows.push({ ...row, skipReason: 'already_present_email', existingExternalId: normalizeText(existingByEmail.externalId) });
      continue;
    }
    if (externalId && localByExternalId.has(externalId)) {
      skippedRows.push({ ...row, skipReason: 'already_present_external_id', existingExternalId: externalId });
      continue;
    }
    importableRows.push(row);
  }
  return {
    remoteCount: remoteRows.length,
    importableCount: importableRows.length,
    existingCount: matchedExistingRows.length,
    skippedCount: skippedRows.length,
    importableRows,
    existingRows: matchedExistingRows,
    skippedRows
  };
};

const selectLdapImportRows = (importableRows, selectedExternalIds) => {
  const rows = Array.isArray(importableRows) ? importableRows : [];
  if (selectedExternalIds === undefined) {
    return { ok: true, rows, requestedCount: rows.length, selectedCount: rows.length };
  }
  if (!Array.isArray(selectedExternalIds)) {
    return { ok: false, error: 'Invalid LDAP selection' };
  }
  const selectedSet = new Set(
    selectedExternalIds
      .map((value) => normalizeText(value))
      .filter(Boolean)
  );
  if (!selectedSet.size) {
    return { ok: false, error: 'No LDAP users selected for import' };
  }
  const selectedRows = rows.filter((row) => selectedSet.has(normalizeText(row.externalId)));
  if (!selectedRows.length) {
    return { ok: false, error: 'Selected LDAP users are no longer importable. Refresh comparison and try again.' };
  }
  return {
    ok: true,
    rows: selectedRows,
    requestedCount: selectedSet.size,
    selectedCount: selectedRows.length
  };
};

const applyLdapImportOverrides = (rows, overridesByExternalId = {}) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const rawOverrides = overridesByExternalId && typeof overridesByExternalId === 'object' ? overridesByExternalId : {};
  const mergedRows = [];
  for (const row of sourceRows) {
    const externalId = normalizeText(row?.externalId);
    const rawOverride = externalId ? rawOverrides[externalId] : null;
    if (!rawOverride || typeof rawOverride !== 'object') {
      mergedRows.push(row);
      continue;
    }
    const merged = {
      ...row,
      externalId,
      firstName: Object.prototype.hasOwnProperty.call(rawOverride, 'firstName') ? normalizeUpperText(rawOverride.firstName) : normalizeUpperText(row?.firstName),
      lastName: Object.prototype.hasOwnProperty.call(rawOverride, 'lastName') ? normalizeUpperText(rawOverride.lastName) : normalizeUpperText(row?.lastName),
      role: Object.prototype.hasOwnProperty.call(rawOverride, 'role') ? normalizeUpperText(rawOverride.role) : normalizeUpperText(row?.role),
      dept1: Object.prototype.hasOwnProperty.call(rawOverride, 'dept1') ? normalizeUpperText(rawOverride.dept1) : normalizeUpperText(row?.dept1),
      dept2: Object.prototype.hasOwnProperty.call(rawOverride, 'dept2') ? normalizeUpperText(rawOverride.dept2) : normalizeUpperText(row?.dept2),
      dept3: Object.prototype.hasOwnProperty.call(rawOverride, 'dept3') ? normalizeUpperText(rawOverride.dept3) : normalizeUpperText(row?.dept3),
      email: Object.prototype.hasOwnProperty.call(rawOverride, 'email') ? normalizeEmailKey(rawOverride.email) : normalizeEmailKey(row?.email),
      mobile: Object.prototype.hasOwnProperty.call(rawOverride, 'mobile') ? normalizePhone(rawOverride.mobile) : normalizePhone(row?.mobile)
    };
    if (!merged.email) {
      return { ok: false, error: `Missing email for selected LDAP user ${externalId}` };
    }
    mergedRows.push(merged);
  }
  return { ok: true, rows: mergedRows };
};

module.exports = {
  LDAP_SECURITY_VALUES,
  LDAP_AUTH_TYPES,
  LDAP_SCOPE_VALUES,
  normalizeLdapImportConfig,
  resolveLdapEffectiveConfig,
  buildLdapUrl,
  buildLdapBindIdentity,
  formatLdapError,
  mapLdapEntryToEmployee,
  prepareLdapImportPreview,
  selectLdapImportRows,
  applyLdapImportOverrides,
  fetchEmployeesFromLdap,
  withBoundLdapClient
};
