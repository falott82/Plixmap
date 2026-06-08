// Pure helpers and search/normalization utilities extracted from
// CustomImportPanel.tsx (sorting, search indexing, LDAP/provision reason
// humanizers, import-draft normalization).
import { useT } from '../../i18n/useT';
import { ExternalUserRow, ImportPreviewRow } from '../../api/customImport';

export type SearchableImportUser = Pick<
  ExternalUserRow,
  'externalId' | 'firstName' | 'lastName' | 'role' | 'dept1' | 'dept2' | 'dept3' | 'email' | 'mobile'
>;
export type SearchablePreviewUser = Pick<
  ImportPreviewRow,
  'externalId' | 'firstName' | 'lastName' | 'role' | 'dept1' | 'dept2' | 'dept3' | 'email' | 'mobile'
>;

export const normalizeSearchText = (value: unknown) => String(value || '').trim().toLowerCase();
export const personSortKey = (row: { firstName?: string; lastName?: string }) =>
  `${String(row.lastName || '').trim()} ${String(row.firstName || '').trim()}`.toLowerCase();
export const comparePeopleByName = (a: { firstName?: string; lastName?: string }, b: { firstName?: string; lastName?: string }) =>
  personSortKey(a).localeCompare(personSortKey(b));
export const importUserSearchIndex = (row: SearchableImportUser | SearchablePreviewUser) =>
  [
    row.externalId,
    row.firstName,
    row.lastName,
    row.email,
    row.mobile,
    row.role,
    row.dept1,
    row.dept2,
    row.dept3
  ]
    .map((v) => String(v || '').trim())
    .join(' ')
    .toLowerCase();
export const matchesImportUserQuery = (row: SearchableImportUser | SearchablePreviewUser, query: string) =>
  !query || importUserSearchIndex(row).includes(query);
export const importPreviewVariationRank = (variation?: string) => (variation === 'remove' ? 0 : variation === 'update' ? 1 : 2);
export const suggestPortalUsername = (row: Partial<ExternalUserRow>) => {
  const emailLocal = String(row.email || '')
    .trim()
    .toLowerCase()
    .split('@')[0];
  const source = emailLocal || [String(row.firstName || '').trim(), String(row.lastName || '').trim()].filter(Boolean).join('.');
  const sanitized = String(source || 'user')
    .toLowerCase()
    .replace(/@/g, '.')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
  return sanitized || 'user';
};
export const humanizeProvisionMailReason = (reason: string, t: ReturnType<typeof useT>) => {
  switch (String(reason || '').trim()) {
    case 'missing_recipient':
      return t({ it: 'email destinatario mancante', en: 'missing recipient email' });
    case 'portal_url_not_configured':
      return t({ it: 'URL pubblico del portale non configurato', en: 'public portal URL not configured' });
    case 'smtp_client_missing_password':
      return t({ it: 'SMTP cliente incompleto (password mancante)', en: 'client SMTP incomplete (missing password)' });
    case 'smtp_client_not_configured':
      return t({ it: 'SMTP cliente non configurato', en: 'client SMTP not configured' });
    case 'smtp_not_configured':
      return t({ it: 'SMTP globale non configurato', en: 'global SMTP not configured' });
    case 'smtp_missing_from':
      return t({ it: 'mittente SMTP mancante', en: 'missing SMTP sender' });
    case 'send_failed':
      return t({ it: 'invio non riuscito', en: 'delivery failed' });
    case 'not_requested':
      return t({ it: 'invio non richiesto', en: 'delivery not requested' });
    default:
      return reason || t({ it: 'errore sconosciuto', en: 'unknown error' });
  }
};

export const humanizeLdapSkipReason = (reason: string, t: ReturnType<typeof useT>) => {
  switch (String(reason || '').trim()) {
    case 'missing_email':
      return t({ it: 'email mancante su LDAP', en: 'missing LDAP email' });
    case 'duplicate_email_in_ldap':
      return t({ it: 'email duplicata nel risultato LDAP', en: 'duplicate email in LDAP result' });
    case 'duplicate_external_id_in_ldap':
      return t({ it: 'external ID duplicato nel risultato LDAP', en: 'duplicate external ID in LDAP result' });
    case 'already_present_email':
      return t({ it: 'gia presente per email', en: 'already present by email' });
    case 'already_present_external_id':
      return t({ it: 'gia presente per external ID', en: 'already present by external ID' });
    default:
      return reason || t({ it: 'motivo sconosciuto', en: 'unknown reason' });
  }
};

export const toWebApiConfigPayload = (
  cfg: { url: string; username: string; method: 'GET' | 'POST' | string; bodyJson: string } | null,
  password: string
) => {
  if (!cfg) return undefined;
  return {
    url: String(cfg.url || '').trim(),
    username: String(cfg.username || '').trim(),
    method: String(cfg.method || 'POST').trim().toUpperCase(),
    bodyJson: cfg.bodyJson || '',
    ...(password ? { password } : {})
  };
};

export const normalizeUpperInput = (value: unknown) => String(value || '').trim().toUpperCase();
export const normalizeImportEmailInput = (value: unknown) => String(value || '').trim().toLowerCase();
export const normalizeImportMobileInput = (value: unknown) => String(value || '').trim().replace(/\s+/g, '');
export const mergeLdapImportDraft = (row: ImportPreviewRow, draft?: Partial<ImportPreviewRow> | null): ImportPreviewRow => ({
  ...row,
  ...(draft || {}),
  firstName: Object.prototype.hasOwnProperty.call(draft || {}, 'firstName') ? normalizeUpperInput(draft?.firstName) : normalizeUpperInput(row.firstName),
  lastName: Object.prototype.hasOwnProperty.call(draft || {}, 'lastName') ? normalizeUpperInput(draft?.lastName) : normalizeUpperInput(row.lastName),
  role: Object.prototype.hasOwnProperty.call(draft || {}, 'role') ? normalizeUpperInput(draft?.role) : normalizeUpperInput(row.role),
  dept1: Object.prototype.hasOwnProperty.call(draft || {}, 'dept1') ? normalizeUpperInput(draft?.dept1) : normalizeUpperInput(row.dept1),
  dept2: Object.prototype.hasOwnProperty.call(draft || {}, 'dept2') ? normalizeUpperInput(draft?.dept2) : normalizeUpperInput(row.dept2),
  dept3: Object.prototype.hasOwnProperty.call(draft || {}, 'dept3') ? normalizeUpperInput(draft?.dept3) : normalizeUpperInput(row.dept3),
  email: Object.prototype.hasOwnProperty.call(draft || {}, 'email') ? normalizeImportEmailInput(draft?.email) : normalizeImportEmailInput(row.email),
  mobile: Object.prototype.hasOwnProperty.call(draft || {}, 'mobile') ? normalizeImportMobileInput(draft?.mobile) : normalizeImportMobileInput(row.mobile)
});
export const getLdapImportMissingFields = (row: ImportPreviewRow) =>
  [
    !String(row.firstName || '').trim() ? 'firstName' : '',
    !String(row.lastName || '').trim() ? 'lastName' : '',
    !String(row.email || '').trim() ? 'email' : '',
    !String(row.mobile || '').trim() ? 'mobile' : '',
    !String(row.role || '').trim() ? 'role' : '',
    !String(row.dept1 || '').trim() ? 'dept1' : ''
  ].filter(Boolean) as Array<'firstName' | 'lastName' | 'email' | 'mobile' | 'role' | 'dept1'>;
export const humanizeLdapImportField = (field: 'firstName' | 'lastName' | 'email' | 'mobile' | 'role' | 'dept1', t: ReturnType<typeof useT>) => {
  switch (field) {
    case 'firstName':
      return t({ it: 'nome', en: 'first name' });
    case 'lastName':
      return t({ it: 'cognome', en: 'last name' });
    case 'email':
      return 'email';
    case 'mobile':
      return t({ it: 'cellulare', en: 'mobile' });
    case 'role':
      return t({ it: 'ruolo', en: 'role' });
    case 'dept1':
      return t({ it: 'reparto', en: 'department' });
  }
};

export const formatLdapActionError = (
  action: 'save' | 'test' | 'preview' | 'import',
  detail: string | null | undefined,
  t: ReturnType<typeof useT>
) => {
  const fallback =
    action === 'save'
      ? t({ it: 'Salvataggio LDAP fallito', en: 'LDAP save failed' })
      : action === 'preview'
        ? t({ it: 'Anteprima LDAP non disponibile', en: 'LDAP preview unavailable' })
        : action === 'import'
          ? t({ it: 'Import LDAP fallito', en: 'LDAP import failed' })
          : t({ it: 'Test LDAP fallito', en: 'LDAP test failed' });
  const normalized = String(detail || '').trim();
  return normalized ? `${fallback}: ${normalized}` : fallback;
};

// Dedup key for an external user row (email, else first|last name). Pure.
const externalUserDedupKey = (row: any): string => {
  const email = String(row.email || '').trim().toLowerCase();
  const first = String(row.firstName || '').trim().toLowerCase();
  const last = String(row.lastName || '').trim().toLowerCase();
  return email ? `email:${email}` : first || last ? `name:${first}|${last}` : '';
};

// Group external user rows that collide on the dedup key (groups of >1). Pure.
export const computeDuplicateGroups = (usersRows: any[]): Array<{ key: string; rows: any[] }> => {
  const byKey = new Map<string, any[]>();
  for (const row of usersRows || []) {
    const key = externalUserDedupKey(row);
    if (!key) continue;
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }
  return Array.from(byKey.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, rows]) => ({ key, rows }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

// Whether a row set contains any dedup-key collision. Pure.
export const rowsHaveDuplicates = (rows: any[]): boolean => {
  const seen = new Map<string, number>();
  for (const row of rows || []) {
    const key = externalUserDedupKey(row);
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
    if ((seen.get(key) || 0) > 1) return true;
  }
  return false;
};
