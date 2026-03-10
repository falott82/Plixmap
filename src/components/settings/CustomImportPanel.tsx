import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpCircle, Copy, Eye, EyeOff, FileDown, Info, Mail, Pencil, Plus, RefreshCw, Save, Search, Settings2, TestTube, Trash2, UploadCloud, UserPlus, Users, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { useAuthStore } from '../../store/useAuthStore';
import { adminFetchUsers, type AdminUserRow } from '../../api/auth';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  clearImport,
  createManualExternalUser,
  deleteOneImportedUser,
  deleteManualExternalUser,
  getLdapImportConfig,
  importOneWebApiUser,
  ImportPreviewExistingRow,
  ImportPreviewRow,
  LdapImportSkippedRow,
  ExternalUserRow,
  fetchImportSummary,
  getImportConfig,
  ImportSummaryRow,
  importCsv,
  listExternalUsers,
  previewImport,
  previewLdapImport,
  provisionPortalUserFromImported,
  saveImportConfig,
  saveLdapImportConfig,
  setExternalUserHidden,
  syncImport,
  syncLdapImport,
  testLdapImport,
  testImport,
  updateExternalUser,
} from '../../api/customImport';
import { fetchState } from '../../api/state';

type SearchableImportUser = Pick<
  ExternalUserRow,
  'externalId' | 'firstName' | 'lastName' | 'role' | 'dept1' | 'dept2' | 'dept3' | 'email' | 'mobile'
>;
type SearchablePreviewUser = Pick<
  ImportPreviewRow,
  'externalId' | 'firstName' | 'lastName' | 'role' | 'dept1' | 'dept2' | 'dept3' | 'email' | 'mobile'
>;

const normalizeSearchText = (value: unknown) => String(value || '').trim().toLowerCase();
const personSortKey = (row: { firstName?: string; lastName?: string }) =>
  `${String(row.lastName || '').trim()} ${String(row.firstName || '').trim()}`.toLowerCase();
const comparePeopleByName = (a: { firstName?: string; lastName?: string }, b: { firstName?: string; lastName?: string }) =>
  personSortKey(a).localeCompare(personSortKey(b));
const importUserSearchIndex = (row: SearchableImportUser | SearchablePreviewUser) =>
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
const matchesImportUserQuery = (row: SearchableImportUser | SearchablePreviewUser, query: string) =>
  !query || importUserSearchIndex(row).includes(query);
const importPreviewVariationRank = (variation?: string) => (variation === 'remove' ? 0 : variation === 'update' ? 1 : 2);
const suggestPortalUsername = (row: Partial<ExternalUserRow>) => {
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
const humanizeProvisionMailReason = (reason: string, t: ReturnType<typeof useT>) => {
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

const humanizeLdapSkipReason = (reason: string, t: ReturnType<typeof useT>) => {
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

const toWebApiConfigPayload = (
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

const normalizeUpperInput = (value: unknown) => String(value || '').trim().toUpperCase();
const normalizeImportEmailInput = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeImportMobileInput = (value: unknown) => String(value || '').trim().replace(/\s+/g, '');
const mergeLdapImportDraft = (row: ImportPreviewRow, draft?: Partial<ImportPreviewRow> | null): ImportPreviewRow => ({
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
const getLdapImportMissingFields = (row: ImportPreviewRow) =>
  [
    !String(row.firstName || '').trim() ? 'firstName' : '',
    !String(row.lastName || '').trim() ? 'lastName' : '',
    !String(row.email || '').trim() ? 'email' : '',
    !String(row.mobile || '').trim() ? 'mobile' : '',
    !String(row.role || '').trim() ? 'role' : '',
    !String(row.dept1 || '').trim() ? 'dept1' : ''
  ].filter(Boolean) as Array<'firstName' | 'lastName' | 'email' | 'mobile' | 'role' | 'dept1'>;
const humanizeLdapImportField = (field: 'firstName' | 'lastName' | 'email' | 'mobile' | 'role' | 'dept1', t: ReturnType<typeof useT>) => {
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

const formatLdapActionError = (
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

const CustomImportPanel = (
  { initialClientId, lockClientSelection = false }: { initialClientId?: string | null; lockClientSelection?: boolean } = {}
) => {
  const t = useT();
  const clients = useDataStore((s) => s.clients);
  const setServerState = useDataStore((s) => s.setServerState);
  const { push } = useToastStore();
  const authUser = useAuthStore((s) => s.user);
  const isSuperAdmin = !!authUser?.isSuperAdmin && String(authUser?.username || '').toLowerCase() === 'superadmin';

  const [summaryRows, setSummaryRows] = useState<ImportSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  const [configExpanded, setConfigExpanded] = useState(false);
  const [importMode, setImportMode] = useState<'webapi' | 'ldap' | 'csv' | 'manual'>('webapi');
  const [cfg, setCfg] = useState<{ url: string; username: string; method: 'GET' | 'POST' | string; hasPassword: boolean; bodyJson: string; updatedAt?: number } | null>(null);
  const [password, setPassword] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingClientId, setSyncingClientId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; count?: number; error?: string; contentType?: string; rawSnippet?: string } | null>(null);
  const [webApiTestPassedByClient, setWebApiTestPassedByClient] = useState<Record<string, boolean>>({});
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [ldapCfg, setLdapCfg] = useState<{
    server: string;
    port: number;
    security: 'ldaps' | 'starttls' | 'ldap' | string;
    scope: 'sub' | 'one' | string;
    authType: 'anonymous' | 'simple' | 'domain_user' | 'user_principal_name' | string;
    domain: string;
    username: string;
    hasPassword: boolean;
    baseDn: string;
    userFilter: string;
    emailAttribute: string;
    firstNameAttribute: string;
    lastNameAttribute: string;
    externalIdAttribute: string;
    roleAttribute: string;
    mobileAttribute: string;
    dept1Attribute: string;
    sizeLimit: number;
    updatedAt?: number;
  } | null>(null);
  const [ldapPassword, setLdapPassword] = useState('');
  const [savingLdapCfg, setSavingLdapCfg] = useState(false);
  const [ldapTesting, setLdapTesting] = useState(false);
  const [ldapTestResult, setLdapTestResult] = useState<{ ok: boolean; status: number; count?: number; error?: string } | null>(null);
  const [ldapPreviewLoading, setLdapPreviewLoading] = useState(false);
  const [ldapCompareOpen, setLdapCompareOpen] = useState(false);
  const [ldapInfoOpen, setLdapInfoOpen] = useState(false);
  const [ldapImportSelectOpen, setLdapImportSelectOpen] = useState(false);
  const [ldapConfigTab, setLdapConfigTab] = useState<'settings' | 'filters'>('settings');
  const [ldapSelectedExternalIds, setLdapSelectedExternalIds] = useState<string[]>([]);
  const [ldapImportDraftsById, setLdapImportDraftsById] = useState<Record<string, Partial<ImportPreviewRow>>>({});
  const [ldapImportEditRowId, setLdapImportEditRowId] = useState<string | null>(null);
  const [ldapImportEditForm, setLdapImportEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    role: '',
    dept1: '',
    dept2: '',
    dept3: ''
  });
  const [ldapPreviewResult, setLdapPreviewResult] = useState<{
    remoteCount: number;
    importableCount: number;
    existingCount: number;
    skippedCount: number;
    importableRows: ImportPreviewRow[];
    existingRows: (ImportPreviewExistingRow & { clientId?: string })[];
    skippedRows: LdapImportSkippedRow[];
  } | null>(null);
  const [ldapPreviewFetchedAt, setLdapPreviewFetchedAt] = useState<number | null>(null);
  const [ldapImporting, setLdapImporting] = useState(false);
  const [ldapImportResult, setLdapImportResult] = useState<{
    fetched: number;
    importable: number;
    selected?: number;
    existing: number;
    skipped: number;
    created: number;
    updated: number;
  } | null>(null);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [usersLoading, setUsersLoading] = useState(false);
  const [usersRows, setUsersRows] = useState<ExternalUserRow[]>([]);
  const [portalUsersLoading, setPortalUsersLoading] = useState(false);
  const [portalUsersRows, setPortalUsersRows] = useState<AdminUserRow[]>([]);
  const [usersQuery, setUsersQuery] = useState('');
  const [includeMissing, setIncludeMissing] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [usersSortState, setUsersSortState] = useState<{ key: 'name' | 'id' | 'alloc' | 'hidden'; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc'
  });

  const [webApiPreviewOpen, setWebApiPreviewOpen] = useState(false);
  const [webApiPreviewLoading, setWebApiPreviewLoading] = useState(false);
  const [webApiPreviewLeftQuery, setWebApiPreviewLeftQuery] = useState('');
  const [webApiPreviewRightQuery, setWebApiPreviewRightQuery] = useState('');
  const [webApiPreviewRemoteRows, setWebApiPreviewRemoteRows] = useState<ImportPreviewRow[]>([]);
  const [webApiPreviewExistingRows, setWebApiPreviewExistingRows] = useState<ImportPreviewExistingRow[]>([]);
  const [webApiPreviewError, setWebApiPreviewError] = useState<string | null>(null);
  const [webApiPreviewFilter, setWebApiPreviewFilter] = useState<'all' | 'remove' | 'update' | 'add'>('all');
  const [webApiPreviewSelectedLeftIds, setWebApiPreviewSelectedLeftIds] = useState<string[]>([]);
  const [webApiPreviewSelectedRightIds, setWebApiPreviewSelectedRightIds] = useState<string[]>([]);
  const [webApiPreviewContextMenu, setWebApiPreviewContextMenu] = useState<null | { side: 'left' | 'right'; x: number; y: number }>(null);
  const [webApiPreviewImportingIds, setWebApiPreviewImportingIds] = useState<Record<string, boolean>>({});
  const [webApiPreviewDeletingIds, setWebApiPreviewDeletingIds] = useState<Record<string, boolean>>({});

  const [csvFile, setCsvFile] = useState<{ name: string; text: string } | null>(null);
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClientId, setInfoClientId] = useState<string | null>(null);
  const [manualUserModalOpen, setManualUserModalOpen] = useState(false);
  const [manualUserEditingId, setManualUserEditingId] = useState<string | null>(null);
  const [manualUserEditingKind, setManualUserEditingKind] = useState<'manual' | 'imported' | null>(null);
  const [manualUserSaving, setManualUserSaving] = useState(false);
  const [manualUserDeletingId, setManualUserDeletingId] = useState<string | null>(null);
  const [manualDeleteCandidate, setManualDeleteCandidate] = useState<ExternalUserRow | null>(null);
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);
  const [portalProvisionModalOpen, setPortalProvisionModalOpen] = useState(false);
  const [portalProvisionSaving, setPortalProvisionSaving] = useState(false);
  const [portalProvisionSourceUser, setPortalProvisionSourceUser] = useState<ExternalUserRow | null>(null);
  const [portalProvisionForm, setPortalProvisionForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    language: 'it' as 'it' | 'en',
    access: 'ro' as 'ro' | 'rw',
    chat: true,
    canCreateMeetings: false,
    sendEmail: false
  });
  const [portalProvisionResult, setPortalProvisionResult] = useState<null | {
    userId: string;
    username: string;
    temporaryPassword: string;
    importedDisplayName: string;
    emailDelivery: {
      attempted: boolean;
      sent: boolean;
      reason?: string | null;
      messageId?: string | null;
      smtpScope?: 'client' | 'global' | null;
    };
  }>(null);
  const [manualUserForm, setManualUserForm] = useState({
    externalId: '',
    firstName: '',
    lastName: '',
    role: '',
    dept1: '',
    dept2: '',
    dept3: '',
    email: '',
    mobile: '',
    ext1: '',
    ext2: '',
    ext3: '',
    isExternal: false
  });
  const configDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const webApiPreviewDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const webApiPreviewContextMenuFocusRef = useRef<HTMLButtonElement | null>(null);
  const webApiPreviewContextMenuRef = useRef<HTMLDivElement | null>(null);
  const usersDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const manualUserDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const portalProvisionDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const portalProvisionResultFocusRef = useRef<HTMLButtonElement | null>(null);
  const csvConfirmDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const infoDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const ldapInfoDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const ldapCompareDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const ldapImportSelectDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const ldapImportEditDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const lastWebApiPreviewLeftSelectionRef = useRef<number | null>(null);
  const lastWebApiPreviewRightSelectionRef = useRef<number | null>(null);

  const summaryById = useMemo(() => new Map(summaryRows.map((r) => [r.clientId, r])), [summaryRows]);
  const visibleSummaryRows = useMemo(() => {
    if (!lockClientSelection) return summaryRows;
    const forced = String(initialClientId || '').trim();
    if (!forced) return summaryRows;
    return summaryRows.filter((row) => String(row.clientId) === forced);
  }, [initialClientId, lockClientSelection, summaryRows]);
  const activeClient = useMemo(() => clients.find((c) => c.id === activeClientId) || null, [activeClientId, clients]);
  const activeSummary = useMemo(() => (activeClientId ? summaryById.get(activeClientId) || null : null), [activeClientId, summaryById]);
  const hasImportedOnce = !!activeSummary?.lastImportAt;
  const hasWebApiConfig = !!activeSummary?.hasConfig;
  const canRunWebApiTest = hasWebApiConfig;
  const canOpenWebApiImportPreview = !!(
    activeClientId &&
    hasWebApiConfig &&
    (webApiTestPassedByClient[activeClientId] || hasImportedOnce)
  );
  const canClearWebApiImport = hasImportedOnce;
  const canSaveWebApiSettings = !hasWebApiConfig || hasImportedOnce;
  const infoClient = useMemo(() => (infoClientId ? clients.find((c) => c.id === infoClientId) || null : null), [clients, infoClientId]);
  const infoSummary = useMemo(() => (infoClientId ? summaryById.get(infoClientId) || null : null), [infoClientId, summaryById]);
  const manualRowsCount = useMemo(() => usersRows.filter((r) => r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:')).length, [usersRows]);
  const duplicateGroups = useMemo(() => {
    const byKey = new Map<string, ExternalUserRow[]>();
    for (const row of usersRows || []) {
      const email = String(row.email || '').trim().toLowerCase();
      const first = String(row.firstName || '').trim().toLowerCase();
      const last = String(row.lastName || '').trim().toLowerCase();
      const key = email ? `email:${email}` : first || last ? `name:${first}|${last}` : '';
      if (!key) continue;
      const list = byKey.get(key) || [];
      list.push(row);
      byKey.set(key, list);
    }
    return Array.from(byKey.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, rows]) => ({ key, rows }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [usersRows]);
  const hasDuplicatesInRows = useCallback((rows: ExternalUserRow[]) => {
    const seen = new Map<string, number>();
    for (const row of rows || []) {
      const email = String(row.email || '').trim().toLowerCase();
      const first = String(row.firstName || '').trim().toLowerCase();
      const last = String(row.lastName || '').trim().toLowerCase();
      const key = email ? `email:${email}` : first || last ? `name:${first}|${last}` : '';
      if (!key) continue;
      seen.set(key, (seen.get(key) || 0) + 1);
      if ((seen.get(key) || 0) > 1) return true;
    }
    return false;
  }, []);
  const duplicateUserKeys = useMemo(() => {
    const set = new Set<string>();
    for (const group of duplicateGroups) {
      for (const row of group.rows) set.add(`${row.clientId}:${row.externalId}`);
    }
    return set;
  }, [duplicateGroups]);
  const configChildDialogOpen = csvConfirmOpen || clearConfirmOpen || ldapCompareOpen || ldapInfoOpen || ldapImportSelectOpen || !!ldapImportEditRowId;
  const ldapSelectedExternalIdSet = useMemo(() => new Set(ldapSelectedExternalIds), [ldapSelectedExternalIds]);
  const ldapSelectedImportableCount = useMemo(
    () => (ldapPreviewResult?.importableRows || []).filter((row) => ldapSelectedExternalIdSet.has(row.externalId)).length,
    [ldapPreviewResult, ldapSelectedExternalIdSet]
  );
  const ldapImportRowsWithDrafts = useMemo(
    () => (ldapPreviewResult?.importableRows || []).map((row) => mergeLdapImportDraft(row, ldapImportDraftsById[row.externalId])),
    [ldapImportDraftsById, ldapPreviewResult]
  );
  const portalUserByImportedKey = useMemo(() => {
    const map = new Map<string, AdminUserRow>();
    for (const row of portalUsersRows || []) {
      const clientId = String(row.linkedExternalClientId || '').trim();
      const externalId = String(row.linkedExternalId || '').trim();
      if (!clientId || !externalId) continue;
      map.set(`${clientId}:${externalId}`, row);
    }
    return map;
  }, [portalUsersRows]);
  const usersChildDialogOpen =
    manualUserModalOpen || !!manualDeleteCandidate || duplicatesModalOpen || portalProvisionModalOpen || !!portalProvisionResult;
  const infoCounts = useMemo(() => {
    if (!infoClient) return { sites: 0, plans: 0 };
    const sites = infoClient.sites?.length || 0;
    let plans = 0;
    for (const s of infoClient.sites || []) plans += s.floorPlans?.length || 0;
    return { sites, plans };
  }, [infoClient]);

  const assignedCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!activeClient) return map;
    for (const s of activeClient.sites || []) {
      for (const p of s.floorPlans || []) {
        for (const o of p.objects || []) {
          const cid = (o as any).externalClientId;
          const eid = (o as any).externalUserId;
          if (!cid || !eid) continue;
          if (cid !== activeClient.id) continue;
          const key = `${cid}:${eid}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    }
    return map;
  }, [activeClient]);

  const loadSummary = useCallback(async () => {
    if (!isSuperAdmin) {
      setSummaryRows([]);
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    try {
      const res = await fetchImportSummary();
      setSummaryRows(res.rows || []);
    } catch {
      setSummaryRows([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [isSuperAdmin]);

  const loadConfig = useCallback(async (clientId: string) => {
    setCfg(null);
    setPassword('');
    setTestResult(null);
    setSyncResult(null);
    if (!clientId) return;
    try {
      const res = await getImportConfig(clientId);
      setCfg(
        res.config
          ? {
              url: res.config.url,
              username: res.config.username,
              hasPassword: res.config.hasPassword,
              method: res.config.method || 'POST',
              bodyJson: res.config.bodyJson || '',
              updatedAt: res.config.updatedAt
            }
          : null
      );
    } catch {
      setCfg(null);
    }
  }, []);

  const loadLdapConfig = useCallback(async (clientId: string) => {
    setLdapCfg(null);
    setLdapPassword('');
    setLdapTestResult(null);
    setLdapPreviewResult(null);
    setLdapImportResult(null);
    if (!clientId) return null;
    try {
      const res = await getLdapImportConfig(clientId);
      const nextConfig =
        res.config
          ? {
              server: res.config.server,
              port: res.config.port || 636,
              security: res.config.security || 'ldaps',
              scope: res.config.scope || 'sub',
              authType: res.config.authType || 'simple',
              domain: res.config.domain || '',
              username: res.config.username || '',
              hasPassword: res.config.hasPassword,
              baseDn: res.config.baseDn || '',
              userFilter: res.config.userFilter || '(mail=*)',
              emailAttribute: res.config.emailAttribute || 'mail',
              firstNameAttribute: res.config.firstNameAttribute || 'givenName',
              lastNameAttribute: res.config.lastNameAttribute || 'sn',
              externalIdAttribute: res.config.externalIdAttribute || 'sAMAccountName',
              roleAttribute: res.config.roleAttribute || 'title',
              mobileAttribute: res.config.mobileAttribute || 'mobile',
              dept1Attribute: res.config.dept1Attribute || 'department',
              sizeLimit: res.config.sizeLimit || 1000,
              updatedAt: res.config.updatedAt
            }
          : {
              server: '',
              port: 636,
              security: 'ldaps',
              scope: 'sub',
              authType: 'simple',
              domain: '',
              username: '',
              hasPassword: false,
              baseDn: '',
              userFilter: '(mail=*)',
              emailAttribute: 'mail',
              firstNameAttribute: 'givenName',
              lastNameAttribute: 'sn',
              externalIdAttribute: 'sAMAccountName',
              roleAttribute: 'title',
              mobileAttribute: 'mobile',
              dept1Attribute: 'department',
              sizeLimit: 1000,
              updatedAt: undefined
            };
      setLdapCfg(nextConfig);
      return nextConfig;
    } catch {
      setLdapCfg(null);
      return null;
    }
  }, []);

  const loadUsers = useCallback(async (clientId: string) => {
    if (!clientId) {
      setUsersRows([]);
      return [];
    }
    setUsersLoading(true);
    try {
      const res = await listExternalUsers({ clientId, includeHidden: true, includeMissing: true });
      const rows = res.rows || [];
      setUsersRows(rows);
      return rows;
    } catch {
      setUsersRows([]);
      return [];
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadPortalUsers = useCallback(async () => {
    if (!isSuperAdmin) {
      setPortalUsersRows([]);
      setPortalUsersLoading(false);
      return [];
    }
    setPortalUsersLoading(true);
    try {
      const res = await adminFetchUsers();
      const rows = Array.isArray(res.users) ? res.users : [];
      setPortalUsersRows(rows);
      return rows;
    } catch {
      setPortalUsersRows([]);
      return [];
    } finally {
      setPortalUsersLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const cid = String(initialClientId || '').trim();
    if (!cid) return;
    setActiveClientId(cid);
  }, [initialClientId]);

  useEffect(() => {
    if (!lockClientSelection) return;
    if (!activeClientId) return;
    void loadUsers(activeClientId);
  }, [activeClientId, loadUsers, lockClientSelection]);

  useEffect(() => {
    if (!webApiPreviewContextMenu) return;
    const close = () => setWebApiPreviewContextMenu(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && webApiPreviewContextMenuRef.current?.contains(target)) return;
      close();
    };
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && webApiPreviewContextMenuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [webApiPreviewContextMenu]);

  const filteredUsers = useMemo(() => {
    const query = normalizeSearchText(usersQuery);
    let list = usersRows;
    if (!includeMissing) list = list.filter((r) => r.present);
    if (onlyMissing) list = list.filter((r) => !r.present);
    if (!query) return list;
    return list.filter((r) => matchesImportUserQuery(r, query));
  }, [includeMissing, onlyMissing, usersQuery, usersRows]);

  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];
    list.sort((a, b) => {
      const dir = usersSortState.dir === 'asc' ? 1 : -1;
      const allocA = assignedCounts.get(`${a.clientId}:${a.externalId}`) || 0;
      const allocB = assignedCounts.get(`${b.clientId}:${b.externalId}`) || 0;
      const primary =
        usersSortState.key === 'id'
          ? String(a.externalId || '').localeCompare(String(b.externalId || ''), undefined, { sensitivity: 'base' })
          : usersSortState.key === 'alloc'
            ? allocA - allocB
            : usersSortState.key === 'hidden'
              ? Number(!!a.hidden) - Number(!!b.hidden)
              : comparePeopleByName(a, b);
      if (primary !== 0) return primary * dir;
      if (!!a.hidden !== !!b.hidden) return Number(!!a.hidden) - Number(!!b.hidden);
      return comparePeopleByName(a, b);
    });
    return list;
  }, [assignedCounts, filteredUsers, usersSortState]);

  const webApiPreviewExistingFiltered = useMemo(() => {
    const q = normalizeSearchText(webApiPreviewLeftQuery);
    const base = [...webApiPreviewExistingRows].sort((a, b) => {
      return comparePeopleByName(a, b);
    });
    if (!q) return base;
    return base.filter((r) => matchesImportUserQuery(r, q));
  }, [webApiPreviewExistingRows, webApiPreviewLeftQuery]);

  const webApiPreviewRemoteById = useMemo(
    () => new Map(webApiPreviewRemoteRows.map((r) => [String(r.externalId), r])),
    [webApiPreviewRemoteRows]
  );

  const webApiMissingExistingRows = useMemo(
    () => webApiPreviewExistingRows.filter((r) => !webApiPreviewRemoteById.has(String(r.externalId))),
    [webApiPreviewExistingRows, webApiPreviewRemoteById]
  );

  const previewSummaryCounts = useMemo(
    () => ({
      add: webApiPreviewRemoteRows.filter((r) => r.importStatus === 'new').length,
      update: webApiPreviewRemoteRows.filter((r) => r.importStatus === 'update').length,
      remove: webApiMissingExistingRows.length
    }),
    [webApiMissingExistingRows.length, webApiPreviewRemoteRows]
  );

  const webApiVariationRows = useMemo(() => {
    const q = normalizeSearchText(webApiPreviewRightQuery);
    const rows: any[] = [];
    for (const r of webApiPreviewRemoteRows) {
      if (r.importStatus === 'new') rows.push({ ...r, variationType: 'add' });
      else if (r.importStatus === 'update') rows.push({ ...r, variationType: 'update' });
    }
    for (const r of webApiMissingExistingRows) rows.push({ ...r, variationType: 'remove' });
    const filteredByType =
      webApiPreviewFilter === 'all' ? rows : rows.filter((r) => String(r.variationType || '') === webApiPreviewFilter);
    const filtered = !q ? filteredByType : filteredByType.filter((r) => matchesImportUserQuery(r, q));
    return filtered.sort((a, b) => {
      const d = importPreviewVariationRank(a.variationType) - importPreviewVariationRank(b.variationType);
      if (d) return d;
      return comparePeopleByName(a, b);
    });
  }, [webApiMissingExistingRows, webApiPreviewFilter, webApiPreviewRightQuery, webApiPreviewRemoteRows]);

  const webApiPreviewSelectedLeftIdSet = useMemo(() => new Set(webApiPreviewSelectedLeftIds), [webApiPreviewSelectedLeftIds]);
  const webApiPreviewSelectedRightIdSet = useMemo(() => new Set(webApiPreviewSelectedRightIds), [webApiPreviewSelectedRightIds]);
  const webApiPreviewSelectedVariationRows = useMemo(
    () => webApiVariationRows.filter((row) => webApiPreviewSelectedRightIdSet.has(String(row.externalId))),
    [webApiPreviewSelectedRightIdSet, webApiVariationRows]
  );
  const webApiPreviewSelectedAddRows = useMemo(
    () => webApiPreviewSelectedVariationRows.filter((row: any) => row.variationType === 'add'),
    [webApiPreviewSelectedVariationRows]
  );
  const webApiPreviewSelectedUpdateRows = useMemo(
    () => webApiPreviewSelectedVariationRows.filter((row: any) => row.variationType === 'update'),
    [webApiPreviewSelectedVariationRows]
  );
  const webApiPreviewSelectedDeleteRows = useMemo(
    () => webApiPreviewSelectedVariationRows.filter((row: any) => row.variationType === 'remove'),
    [webApiPreviewSelectedVariationRows]
  );

  const resetManualUserForm = useCallback(() => {
    setManualUserEditingId(null);
    setManualUserEditingKind(null);
    setManualUserForm({
      externalId: '',
      firstName: '',
      lastName: '',
      role: '',
      dept1: '',
      dept2: '',
      dept3: '',
      email: '',
      mobile: '',
      ext1: '',
      ext2: '',
      ext3: '',
      isExternal: false
    });
  }, []);

  const openManualUserCreate = useCallback(() => {
    resetManualUserForm();
    setManualUserEditingKind('manual');
    setManualUserModalOpen(true);
  }, [resetManualUserForm]);

  const openManualUserEdit = useCallback((row: ExternalUserRow) => {
    setManualUserEditingId(row.externalId);
    setManualUserEditingKind((row.manual || String(row.externalId || '').toLowerCase().startsWith('manual:')) ? 'manual' : 'imported');
    setManualUserForm({
      externalId: row.externalId,
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      role: row.role || '',
      dept1: row.dept1 || '',
      dept2: row.dept2 || '',
      dept3: row.dept3 || '',
      email: row.email || '',
      mobile: row.mobile || '',
      ext1: row.ext1 || '',
      ext2: row.ext2 || '',
      ext3: row.ext3 || '',
      isExternal: !!row.isExternal
    });
    setManualUserModalOpen(true);
  }, []);

  const openPortalProvisionModal = useCallback(
    (row: ExternalUserRow) => {
      setPortalProvisionSourceUser(row);
      setPortalProvisionForm({
        username: suggestPortalUsername(row),
        firstName: String(row.firstName || ''),
        lastName: String(row.lastName || ''),
        phone: String(row.mobile || ''),
        email: String(row.email || ''),
        language: authUser?.language === 'en' ? 'en' : 'it',
        access: 'ro',
        chat: true,
        canCreateMeetings: false,
        sendEmail: !!String(row.email || '').trim()
      });
      setPortalProvisionModalOpen(true);
    },
    [authUser?.language]
  );

  const copyPortalProvisionSecret = useCallback(async (mode: 'credentials' | 'password') => {
    if (!portalProvisionResult) return;
    const text =
      mode === 'password'
        ? portalProvisionResult.temporaryPassword
        : t({
            it: `Username: ${portalProvisionResult.username}\nPassword temporanea: ${portalProvisionResult.temporaryPassword}`,
            en: `Username: ${portalProvisionResult.username}\nTemporary password: ${portalProvisionResult.temporaryPassword}`
          });
    try {
      await navigator.clipboard.writeText(text);
      push(t({ it: 'Copiato negli appunti', en: 'Copied to clipboard' }), 'success');
    } catch {
      push(t({ it: 'Copia non riuscita', en: 'Copy failed' }), 'danger');
    }
  }, [portalProvisionResult, push, t]);

  const submitPortalProvision = useCallback(async () => {
    if (!portalProvisionSourceUser || !activeClientId) return;
    const emailValue = String(portalProvisionForm.email || '').trim();
    if (portalProvisionForm.sendEmail && !emailValue) {
      push(t({ it: 'Inserisci un indirizzo email per inviare le credenziali.', en: 'Enter an email address to send credentials.' }), 'info');
      return;
    }
    setPortalProvisionSaving(true);
    try {
      const res = await provisionPortalUserFromImported({
        clientId: activeClientId,
        externalId: String(portalProvisionSourceUser.externalId || ''),
        username: portalProvisionForm.username,
        firstName: portalProvisionForm.firstName,
        lastName: portalProvisionForm.lastName,
        phone: portalProvisionForm.phone,
        email: emailValue,
        language: portalProvisionForm.language,
        access: portalProvisionForm.access,
        chat: portalProvisionForm.chat,
        canCreateMeetings: portalProvisionForm.canCreateMeetings,
        sendEmail: portalProvisionForm.sendEmail
      });
      setPortalProvisionModalOpen(false);
      setPortalProvisionResult({
        userId: res.id,
        username: res.username,
        temporaryPassword: res.temporaryPassword,
        importedDisplayName:
          `${String(portalProvisionSourceUser.firstName || '').trim()} ${String(portalProvisionSourceUser.lastName || '').trim()}`.trim() ||
          String(portalProvisionSourceUser.email || portalProvisionSourceUser.externalId || ''),
        emailDelivery: res.emailDelivery
      });
      await loadPortalUsers();
      push(t({ it: 'Utente portale creato', en: 'Portal user created' }), 'success');
    } catch (err: any) {
      if (err?.suggestedUsername) {
        setPortalProvisionForm((prev) => ({ ...prev, username: String(err.suggestedUsername || '') }));
      }
      if (err?.existingUsername) {
        push(
          t({
            it: `Questo utente importato e gia collegato all'utente portale ${String(err.existingUsername || '')}.`,
            en: `This imported user is already linked to portal user ${String(err.existingUsername || '')}.`
          }),
          'info'
        );
        return;
      }
      push(
        err?.message ||
          t({ it: 'Creazione utente portale non riuscita', en: 'Failed to create portal user' }),
        'danger'
      );
    } finally {
      setPortalProvisionSaving(false);
    }
  }, [activeClientId, loadPortalUsers, portalProvisionForm, portalProvisionSourceUser, push, t]);

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return t({ it: 'Mai', en: 'Never' });
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return t({ it: 'Mai', en: 'Never' });
    }
  };

  const buildActiveLdapRequestConfig = useCallback(() => {
    if (!activeClientId || !ldapCfg) return null;
    return {
      clientId: activeClientId,
      server: ldapCfg.server.trim(),
      port: Number(ldapCfg.port) || (ldapCfg.security === 'ldaps' ? 636 : 389),
      security: ldapCfg.security,
      scope: ldapCfg.scope,
      authType: ldapCfg.authType,
      domain: ldapCfg.domain.trim(),
      username: ldapCfg.username.trim(),
      password: ldapPassword || undefined,
      baseDn: ldapCfg.baseDn.trim(),
      userFilter: ldapCfg.userFilter.trim(),
      emailAttribute: ldapCfg.emailAttribute.trim(),
      firstNameAttribute: ldapCfg.firstNameAttribute.trim(),
      lastNameAttribute: ldapCfg.lastNameAttribute.trim(),
      externalIdAttribute: ldapCfg.externalIdAttribute.trim(),
      roleAttribute: ldapCfg.roleAttribute.trim(),
      mobileAttribute: ldapCfg.mobileAttribute.trim(),
      dept1Attribute: ldapCfg.dept1Attribute.trim(),
      sizeLimit: Number(ldapCfg.sizeLimit) || 1000
    };
  }, [activeClientId, ldapCfg, ldapPassword]);

  const openConfig = async (clientId: string, mode?: 'webapi' | 'ldap' | 'csv' | 'manual') => {
    setActiveClientId(clientId);
    setConfigOpen(true);
    setUsersOpen(false);
    const nextMode = mode || 'webapi';
    setConfigExpanded(lockClientSelection ? nextMode === 'webapi' || nextMode === 'ldap' : false);
    setImportMode(nextMode);
    if (nextMode === 'ldap') setLdapConfigTab('settings');
    setCsvFile(null);
    setWebApiPreviewOpen(false);
    await Promise.all([loadConfig(clientId), loadLdapConfig(clientId)]);
  };

  const openUsers = async (clientId: string) => {
    setActiveClientId(clientId);
    setUsersOpen(true);
    setConfigOpen(false);
    setUsersQuery('');
    setIncludeMissing(false);
    setOnlyMissing(false);
    setUsersSortState({ key: 'name', dir: 'asc' });
    setCsvFile(null);
    await Promise.all([loadUsers(clientId), loadPortalUsers()]);
  };

  const refreshWebApiPreview = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setWebApiPreviewLoading(true);
    setWebApiPreviewError(null);
    setWebApiPreviewContextMenu(null);
    setWebApiPreviewSelectedLeftIds([]);
    setWebApiPreviewSelectedRightIds([]);
    try {
      const res = await previewImport(clientId, toWebApiConfigPayload(cfg, password));
      if (!res.ok) {
        setWebApiPreviewError(res.error || t({ it: 'Anteprima non disponibile', en: 'Preview unavailable' }));
        setWebApiPreviewRemoteRows([]);
        setWebApiPreviewExistingRows([]);
        return;
      }
      setWebApiPreviewRemoteRows(res.remoteRows || []);
      setWebApiPreviewExistingRows(res.existingRows || []);
      setUsersRows(
        (res.existingRows || []).map((r) => ({
          clientId,
          externalId: r.externalId,
          firstName: r.firstName || '',
          lastName: r.lastName || '',
          role: r.role || '',
          dept1: r.dept1 || '',
          dept2: r.dept2 || '',
          dept3: r.dept3 || '',
          email: r.email || '',
          mobile: r.mobile || '',
          ext1: r.ext1 || '',
          ext2: r.ext2 || '',
          ext3: r.ext3 || '',
          isExternal: !!r.isExternal,
          hidden: !!r.hidden,
          present: !!r.present,
          lastSeenAt: null,
          createdAt: r.updatedAt || Date.now(),
          updatedAt: r.updatedAt || Date.now(),
          manual: String(r.externalId || '').toLowerCase().startsWith('manual:'),
          sourceKind: String(r.externalId || '').toLowerCase().startsWith('manual:') ? 'manual' : 'imported'
        }))
      );
    } catch (err: any) {
      setWebApiPreviewError(err?.message || t({ it: 'Anteprima non disponibile', en: 'Preview unavailable' }));
      setWebApiPreviewRemoteRows([]);
      setWebApiPreviewExistingRows([]);
    } finally {
      setWebApiPreviewLoading(false);
    }
  }, [cfg, loadUsers, password, setUsersRows, t]);

  const openWebApiPreview = useCallback(async () => {
    if (!activeClientId) return;
    setWebApiPreviewOpen(true);
    setConfigOpen(false);
    setUsersOpen(false);
    setWebApiPreviewLeftQuery('');
    setWebApiPreviewRightQuery('');
    setWebApiPreviewFilter('all');
    setWebApiPreviewSelectedLeftIds([]);
    setWebApiPreviewSelectedRightIds([]);
    setWebApiPreviewContextMenu(null);
    await refreshWebApiPreview(activeClientId);
  }, [activeClientId, refreshWebApiPreview]);

  const selectWebApiPreviewRow = useCallback(
    (
      side: 'left' | 'right',
      externalId: string,
      rowIndex: number,
      { shiftKey = false, toggle = false }: { shiftKey?: boolean; toggle?: boolean } = {}
    ) => {
      const normalized = String(externalId || '').trim();
      if (!normalized) return;
      const visibleIds =
        side === 'left'
          ? webApiPreviewExistingFiltered.map((row) => String(row.externalId))
          : webApiVariationRows.map((row: any) => String(row.externalId));
      const currentIndex = rowIndex >= 0 ? rowIndex : visibleIds.indexOf(normalized);
      if (currentIndex < 0) return;
      const anchorRef = side === 'left' ? lastWebApiPreviewLeftSelectionRef : lastWebApiPreviewRightSelectionRef;
      const setSelected = side === 'left' ? setWebApiPreviewSelectedLeftIds : setWebApiPreviewSelectedRightIds;
      const anchorIndexSnapshot = anchorRef.current;
      setSelected((prev) => {
        if (shiftKey) {
          const fallbackAnchorId = prev.length ? prev[0] : '';
          const fallbackAnchorIndex = fallbackAnchorId ? visibleIds.indexOf(fallbackAnchorId) : -1;
          const anchorIndex =
            anchorIndexSnapshot != null && anchorIndexSnapshot >= 0 && anchorIndexSnapshot < visibleIds.length
              ? anchorIndexSnapshot
              : fallbackAnchorIndex >= 0
                ? fallbackAnchorIndex
                : currentIndex;
          const start = Math.min(anchorIndex, currentIndex);
          const end = Math.max(anchorIndex, currentIndex);
          return visibleIds.slice(start, end + 1);
        }
        if (toggle) {
          return prev.includes(normalized) ? prev.filter((value) => value !== normalized) : [...prev, normalized];
        }
        return [normalized];
      });
      if (!shiftKey || anchorRef.current == null) {
        anchorRef.current = currentIndex;
      }
    },
    [webApiPreviewExistingFiltered, webApiVariationRows]
  );

  const handleWebApiPreviewRowMouseDown = useCallback(
    (
      side: 'left' | 'right',
      externalId: string,
      rowIndex: number,
      event: React.MouseEvent
    ) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button')) return;
      event.preventDefault();
      selectWebApiPreviewRow(side, externalId, rowIndex, {
        shiftKey: event.shiftKey,
        toggle: event.metaKey || event.ctrlKey
      });
    },
    [selectWebApiPreviewRow]
  );

  const selectAllWebApiPreviewRows = useCallback(
    (side: 'left' | 'right') => {
      if (side === 'left') {
        setWebApiPreviewSelectedLeftIds(webApiPreviewExistingFiltered.map((row) => String(row.externalId)));
        lastWebApiPreviewLeftSelectionRef.current = webApiPreviewExistingFiltered.length ? webApiPreviewExistingFiltered.length - 1 : null;
        return;
      }
      setWebApiPreviewSelectedRightIds(webApiVariationRows.map((row: any) => String(row.externalId)));
      lastWebApiPreviewRightSelectionRef.current = webApiVariationRows.length ? webApiVariationRows.length - 1 : null;
    },
    [webApiPreviewExistingFiltered, webApiVariationRows]
  );

  const clearWebApiPreviewSelection = useCallback((side?: 'left' | 'right') => {
    if (!side || side === 'left') {
      setWebApiPreviewSelectedLeftIds([]);
      lastWebApiPreviewLeftSelectionRef.current = null;
    }
    if (!side || side === 'right') {
      setWebApiPreviewSelectedRightIds([]);
      lastWebApiPreviewRightSelectionRef.current = null;
    }
  }, []);

  const openWebApiPreviewContextMenu = useCallback((side: 'left' | 'right', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setWebApiPreviewContextMenu({ side, x: event.clientX, y: event.clientY });
  }, []);

  const openWebApiPreviewRowContextMenu = useCallback(
    (side: 'left' | 'right', externalId: string, rowIndex: number, event: React.MouseEvent) => {
      const normalized = String(externalId || '').trim();
      if (normalized) {
        if (event.shiftKey) {
          selectWebApiPreviewRow(side, normalized, rowIndex, { shiftKey: true });
        } else {
          const selectedSet = side === 'left' ? webApiPreviewSelectedLeftIdSet : webApiPreviewSelectedRightIdSet;
          if (!selectedSet.has(normalized)) {
            selectWebApiPreviewRow(side, normalized, rowIndex, { shiftKey: false, toggle: false });
          }
        }
      }
      openWebApiPreviewContextMenu(side, event);
    },
    [
      openWebApiPreviewContextMenu,
      selectWebApiPreviewRow,
      webApiPreviewSelectedLeftIdSet,
      webApiPreviewSelectedRightIdSet
    ]
  );

  const importSingleWebApiUser = useCallback(
    async (row: ImportPreviewRow) => {
      if (!activeClientId) return;
      const key = String(row.externalId || '');
      if (!key) return;
      setWebApiPreviewImportingIds((prev) => ({ ...prev, [key]: true }));
      try {
        await importOneWebApiUser({ clientId: activeClientId, externalId: key, user: row });
        push(t({ it: 'Utente importato', en: 'User imported' }), 'success');
        await Promise.all([loadSummary(), refreshWebApiPreview(activeClientId)]);
      } catch (err: any) {
        push(err?.message || t({ it: 'Import utente fallito', en: 'User import failed' }), 'danger');
      } finally {
        setWebApiPreviewImportingIds((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [activeClientId, loadSummary, loadUsers, push, refreshWebApiPreview, t]
  );

  const importManyWebApiUsers = useCallback(
    async (rows: ImportPreviewRow[]) => {
      if (!activeClientId || !rows.length) return;
      const keys = rows.map((row) => String(row.externalId || '')).filter(Boolean);
      if (!keys.length) return;
      setWebApiPreviewImportingIds((prev) => Object.fromEntries([...Object.entries(prev), ...keys.map((key) => [key, true])]));
      try {
        for (const row of rows) {
          const key = String(row.externalId || '').trim();
          if (!key) continue;
          await importOneWebApiUser({ clientId: activeClientId, externalId: key, user: row });
        }
        push(
          t({
            it: `${rows.length} utenti importati/aggiornati.`,
            en: `${rows.length} users imported/updated.`
          }),
          'success'
        );
        clearWebApiPreviewSelection('right');
        await Promise.all([loadSummary(), refreshWebApiPreview(activeClientId)]);
      } catch (err: any) {
        push(err?.message || t({ it: 'Import massivo fallito', en: 'Bulk import failed' }), 'danger');
      } finally {
        setWebApiPreviewImportingIds((prev) => {
          const next = { ...prev };
          for (const key of keys) delete next[key];
          return next;
        });
      }
    },
    [activeClientId, clearWebApiPreviewSelection, loadSummary, push, refreshWebApiPreview, t]
  );

  const deleteSingleImportedUser = useCallback(
    async (externalId: string) => {
      if (!activeClientId || !externalId) return;
      setWebApiPreviewDeletingIds((prev) => ({ ...prev, [externalId]: true }));
      try {
        await deleteOneImportedUser({ clientId: activeClientId, externalId });
        push(t({ it: 'Utente rimosso', en: 'User removed' }), 'success');
        await Promise.all([loadSummary(), refreshWebApiPreview(activeClientId)]);
      } catch (err: any) {
        push(err?.message || t({ it: 'Rimozione fallita', en: 'Delete failed' }), 'danger');
      } finally {
        setWebApiPreviewDeletingIds((prev) => {
          const next = { ...prev };
          delete next[externalId];
          return next;
        });
      }
    },
    [activeClientId, loadSummary, loadUsers, push, refreshWebApiPreview, t]
  );

  const deleteManyWebApiUsers = useCallback(
    async (externalIds: string[]) => {
      if (!activeClientId || !externalIds.length) return;
      setWebApiPreviewDeletingIds((prev) => Object.fromEntries([...Object.entries(prev), ...externalIds.map((key) => [key, true])]));
      try {
        for (const externalId of externalIds) {
          await deleteOneImportedUser({ clientId: activeClientId, externalId });
        }
        push(
          t({
            it: `${externalIds.length} utenti rimossi.`,
            en: `${externalIds.length} users removed.`
          }),
          'success'
        );
        clearWebApiPreviewSelection();
        await Promise.all([loadSummary(), refreshWebApiPreview(activeClientId)]);
      } catch (err: any) {
        push(err?.message || t({ it: 'Rimozione massiva fallita', en: 'Bulk delete failed' }), 'danger');
      } finally {
        setWebApiPreviewDeletingIds((prev) => {
          const next = { ...prev };
          for (const externalId of externalIds) delete next[externalId];
          return next;
        });
      }
    },
    [activeClientId, clearWebApiPreviewSelection, loadSummary, push, refreshWebApiPreview, t]
  );

  const applySelectedWebApiVariations = useCallback(async () => {
    if (!webApiPreviewSelectedVariationRows.length) return;
    const addRows = webApiPreviewSelectedVariationRows.filter((row: any) => row.variationType === 'add') as ImportPreviewRow[];
    const updateRows = webApiPreviewSelectedVariationRows.filter((row: any) => row.variationType === 'update') as ImportPreviewRow[];
    const deleteIds = webApiPreviewSelectedVariationRows
      .filter((row: any) => row.variationType === 'remove')
      .map((row: any) => String(row.externalId || '').trim())
      .filter(Boolean);

    if (addRows.length) await importManyWebApiUsers(addRows);
    if (updateRows.length) await importManyWebApiUsers(updateRows);
    if (deleteIds.length) await deleteManyWebApiUsers(deleteIds);
  }, [deleteManyWebApiUsers, importManyWebApiUsers, webApiPreviewSelectedVariationRows]);

  const runSync = async (clientId: string) => {
    setSyncingClientId(clientId);
    setSyncResult(null);
    try {
      const res = await syncImport(clientId);
      setSyncResult(res);
      if (res.ok) {
        push(t({ it: 'Import completato', en: 'Import completed' }), 'success');
        if ((res as any)?.summary?.duplicateEmails > 0) {
          push(
            t({
              it: `Import completato con ${(res as any).summary.duplicateEmails} email duplicate saltate. Apri la schermata importazione per gestire le variazioni.`,
              en: `Import completed with ${(res as any).summary.duplicateEmails} duplicate-email records skipped. Open import preview to review changes.`
            }),
            'info'
          );
        }
        await loadSummary();
        const rows = await loadUsers(clientId);
        await refreshWebApiPreview(clientId);
        if (hasDuplicatesInRows(rows || [])) {
          setUsersOpen(true);
          setDuplicatesModalOpen(true);
          push(
            t({
              it: 'Import WebAPI completato con possibili duplicati. Apri la lista e gestisci i record.',
              en: 'WebAPI import completed with possible duplicates. Open the list and review records.'
            }),
            'info'
          );
        }
      } else {
        push(t({ it: 'Import fallito', en: 'Import failed' }), 'danger');
      }
    } catch {
      push(t({ it: 'Import fallito', en: 'Import failed' }), 'danger');
    } finally {
      setSyncingClientId(null);
    }
  };

  const saveConfig = async () => {
    if (!activeClientId) return;
    if (!cfg?.url?.trim() || !cfg?.username?.trim()) {
      push(t({ it: 'Compila URL e username.', en: 'Please fill URL and username.' }), 'info');
      return;
    }
    setSavingCfg(true);
    try {
      const res = await saveImportConfig({
        clientId: activeClientId,
        url: cfg.url.trim(),
        username: cfg.username.trim(),
        password: password || undefined,
        method: cfg.method || 'POST',
        bodyJson: cfg.bodyJson
      });
      setCfg(
        res.config
          ? {
              url: res.config.url,
              username: res.config.username,
              hasPassword: res.config.hasPassword,
              method: res.config.method || 'POST',
              bodyJson: res.config.bodyJson || '',
              updatedAt: res.config.updatedAt
            }
          : null
      );
      setPassword('');
      if (activeClientId) {
        setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: false }));
      }
      push(t({ it: 'Configurazione salvata', en: 'Configuration saved' }), 'success');
      await loadSummary();
    } catch {
      push(t({ it: 'Salvataggio fallito', en: 'Save failed' }), 'danger');
    } finally {
      setSavingCfg(false);
    }
  };

  const runTest = async () => {
    if (!activeClientId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testImport(activeClientId, toWebApiConfigPayload(cfg, password));
      setTestResult({ ok: res.ok, status: res.status, count: res.count, error: res.error, contentType: res.contentType, rawSnippet: res.rawSnippet });
      setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: !!res.ok }));
      if (res.ok) push(t({ it: 'Test riuscito', en: 'Test successful' }), 'success');
      else push(t({ it: 'Test fallito', en: 'Test failed' }), 'danger');
    } catch {
      setTestResult({ ok: false, status: 0, error: 'Request failed' });
      if (activeClientId) setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: false }));
      push(t({ it: 'Test fallito', en: 'Test failed' }), 'danger');
    } finally {
      setTesting(false);
    }
  };

  const saveLdapConfigHandler = async () => {
    if (!activeClientId || !ldapCfg) return;
    if (!ldapCfg.server.trim() || !ldapCfg.baseDn.trim()) {
      push(t({ it: 'Compila almeno server LDAP e base DN.', en: 'Fill at least LDAP server and base DN.' }), 'info');
      return;
    }
    if (ldapCfg.authType !== 'anonymous' && !ldapCfg.username.trim()) {
      push(t({ it: 'Compila lo username LDAP.', en: 'Fill the LDAP username.' }), 'info');
      return;
    }
    setSavingLdapCfg(true);
    try {
      const res = await saveLdapImportConfig({
        clientId: activeClientId,
        server: ldapCfg.server.trim(),
        port: Number(ldapCfg.port) || (ldapCfg.security === 'ldaps' ? 636 : 389),
        security: ldapCfg.security,
        scope: ldapCfg.scope,
        authType: ldapCfg.authType,
        domain: ldapCfg.domain.trim(),
        username: ldapCfg.username.trim(),
        password: ldapPassword || undefined,
        baseDn: ldapCfg.baseDn.trim(),
        userFilter: ldapCfg.userFilter.trim(),
        emailAttribute: ldapCfg.emailAttribute.trim(),
        firstNameAttribute: ldapCfg.firstNameAttribute.trim(),
        lastNameAttribute: ldapCfg.lastNameAttribute.trim(),
        externalIdAttribute: ldapCfg.externalIdAttribute.trim(),
        roleAttribute: ldapCfg.roleAttribute.trim(),
        mobileAttribute: ldapCfg.mobileAttribute.trim(),
        dept1Attribute: ldapCfg.dept1Attribute.trim(),
        sizeLimit: Number(ldapCfg.sizeLimit) || 1000
      });
      setLdapCfg(
        res.config
          ? {
              server: res.config.server,
              port: res.config.port,
              security: res.config.security || 'ldaps',
              scope: res.config.scope || 'sub',
              authType: res.config.authType || 'simple',
              domain: res.config.domain || '',
              username: res.config.username || '',
              hasPassword: res.config.hasPassword,
              baseDn: res.config.baseDn || '',
              userFilter: res.config.userFilter || '(mail=*)',
              emailAttribute: res.config.emailAttribute || 'mail',
              firstNameAttribute: res.config.firstNameAttribute || 'givenName',
              lastNameAttribute: res.config.lastNameAttribute || 'sn',
              externalIdAttribute: res.config.externalIdAttribute || 'sAMAccountName',
              roleAttribute: res.config.roleAttribute || 'title',
              mobileAttribute: res.config.mobileAttribute || 'mobile',
              dept1Attribute: res.config.dept1Attribute || 'department',
              sizeLimit: res.config.sizeLimit || 1000,
              updatedAt: res.config.updatedAt
            }
          : null
      );
      setLdapPassword('');
      push(t({ it: 'Configurazione LDAP salvata', en: 'LDAP configuration saved' }), 'success');
      await loadSummary();
    } catch (err: any) {
      push(formatLdapActionError('save', err?.message, t), 'danger');
    } finally {
      setSavingLdapCfg(false);
    }
  };

  const runLdapTest = async () => {
    if (!activeClientId) return;
    setLdapTesting(true);
    setLdapTestResult(null);
    try {
      const requestConfig = buildActiveLdapRequestConfig();
      const res = await testLdapImport(activeClientId, requestConfig || undefined);
      setLdapTestResult({ ok: res.ok, status: res.status, count: res.count, error: res.error });
      push(
        res.ok ? t({ it: 'Test LDAP riuscito', en: 'LDAP test successful' }) : formatLdapActionError('test', res.error, t),
        res.ok ? 'success' : 'danger'
      );
    } catch (err: any) {
      const detail = err?.message || 'Request failed';
      setLdapTestResult({ ok: false, status: 0, error: detail });
      push(formatLdapActionError('test', detail, t), 'danger');
    } finally {
      setLdapTesting(false);
    }
  };

  const runLdapPreview = async () => {
    if (!activeClientId) return;
    setLdapPreviewLoading(true);
    setLdapImportSelectOpen(false);
    setLdapSelectedExternalIds([]);
    setLdapImportDraftsById({});
    setLdapImportEditRowId(null);
    setLdapPreviewResult(null);
    setLdapPreviewFetchedAt(null);
    setLdapImportResult(null);
    try {
      const requestConfig = buildActiveLdapRequestConfig();
      const res = await previewLdapImport(activeClientId, requestConfig || undefined);
      if (!res.ok) {
        push(formatLdapActionError('preview', res.error, t), 'danger');
        return;
      }
      setLdapPreviewResult({
        remoteCount: res.remoteCount,
        importableCount: res.importableCount,
        existingCount: res.existingCount,
        skippedCount: res.skippedCount,
        importableRows: res.importableRows || [],
        existingRows: res.existingRows || [],
        skippedRows: res.skippedRows || []
      });
      setLdapPreviewFetchedAt(Date.now());
      push(t({ it: 'Confronto LDAP aggiornato', en: 'LDAP comparison refreshed' }), 'success');
    } catch (err: any) {
      push(formatLdapActionError('preview', err?.message, t), 'danger');
    } finally {
      setLdapPreviewLoading(false);
    }
  };

  const openLdapCompareModal = async () => {
    setLdapCompareOpen(true);
    await runLdapPreview();
  };

  const openLdapImportSelection = () => {
    const rows = ldapPreviewResult?.importableRows || [];
    if (!rows.length) {
      push(t({ it: 'Nessun utente LDAP disponibile per importazione.', en: 'No LDAP users available for import.' }), 'info');
      return;
    }
    setLdapSelectedExternalIds(rows.map((row) => row.externalId));
    setLdapImportSelectOpen(true);
  };

  const toggleLdapImportSelection = (externalId: string) => {
    setLdapSelectedExternalIds((prev) => {
      const normalized = String(externalId || '').trim();
      if (!normalized) return prev;
      return prev.includes(normalized) ? prev.filter((value) => value !== normalized) : [...prev, normalized];
    });
  };

  const selectAllLdapImportRows = () => {
    setLdapSelectedExternalIds((ldapPreviewResult?.importableRows || []).map((row) => row.externalId));
  };

  const clearLdapImportSelection = () => {
    setLdapSelectedExternalIds([]);
  };

  const openLdapImportEditModal = (row: ImportPreviewRow) => {
    const merged = mergeLdapImportDraft(row, ldapImportDraftsById[row.externalId]);
    setLdapImportEditRowId(row.externalId);
    setLdapImportEditForm({
      firstName: merged.firstName || '',
      lastName: merged.lastName || '',
      email: merged.email || '',
      mobile: merged.mobile || '',
      role: merged.role || '',
      dept1: merged.dept1 || '',
      dept2: merged.dept2 || '',
      dept3: merged.dept3 || ''
    });
  };

  const saveLdapImportEdit = () => {
    if (!ldapImportEditRowId) return;
    setLdapImportDraftsById((prev) => ({
      ...prev,
      [ldapImportEditRowId]: {
        firstName: normalizeUpperInput(ldapImportEditForm.firstName),
        lastName: normalizeUpperInput(ldapImportEditForm.lastName),
        email: normalizeImportEmailInput(ldapImportEditForm.email),
        mobile: normalizeImportMobileInput(ldapImportEditForm.mobile),
        role: normalizeUpperInput(ldapImportEditForm.role),
        dept1: normalizeUpperInput(ldapImportEditForm.dept1),
        dept2: normalizeUpperInput(ldapImportEditForm.dept2),
        dept3: normalizeUpperInput(ldapImportEditForm.dept3)
      }
    }));
    setLdapImportEditRowId(null);
    push(t({ it: 'Dati LDAP manuali aggiornati per l’import.', en: 'Manual LDAP import data updated.' }), 'success');
  };

  const runLdapImport = async () => {
    if (!activeClientId) return;
    if (!ldapSelectedExternalIds.length) {
      push(t({ it: 'Seleziona almeno un utente LDAP da importare.', en: 'Select at least one LDAP user to import.' }), 'info');
      return;
    }
    setLdapImporting(true);
    try {
      const requestConfig = buildActiveLdapRequestConfig();
      const overridesByExternalId = Object.fromEntries(
        Object.entries(ldapImportDraftsById).filter(([externalId]) => ldapSelectedExternalIdSet.has(externalId))
      );
      const res = await syncLdapImport(activeClientId, requestConfig || undefined, ldapSelectedExternalIds, overridesByExternalId);
      if (!res.ok) {
        push(formatLdapActionError('import', res.error, t), 'danger');
        return;
      }
      setLdapPreviewResult(res.preview);
      setLdapPreviewFetchedAt(Date.now());
      setLdapImportResult(res.summary);
      setLdapImportSelectOpen(false);
      setLdapSelectedExternalIds([]);
      setLdapImportDraftsById({});
      setLdapImportEditRowId(null);
      push(
        t({
          it: `Import LDAP completato (${res.summary.selected || 0} selezionati, ${res.summary.created} nuovi, ${res.summary.existing} gia presenti, ${res.summary.skipped} saltati).`,
          en: `LDAP import completed (${res.summary.selected || 0} selected, ${res.summary.created} new, ${res.summary.existing} already present, ${res.summary.skipped} skipped).`
        }),
        'success'
      );
      await loadSummary();
      await loadUsers(activeClientId);
    } catch (err: any) {
      push(formatLdapActionError('import', err?.message, t), 'danger');
    } finally {
      setLdapImporting(false);
    }
  };

  const clearImportData = async () => {
    if (!activeClientId) return;
    setClearing(true);
    try {
      const res = await clearImport(activeClientId);
      push(
        t({
          it: `Eliminati ${res.removedUsers} utenti e rimossi ${res.removedObjects} oggetti dalla mappa.`,
          en: `Deleted ${res.removedUsers} users and removed ${res.removedObjects} map objects.`
        }),
        'success'
      );
      await loadSummary();
      await loadUsers(activeClientId);
      try {
        const state = await fetchState();
        if (Array.isArray(state.clients)) setServerState({ clients: state.clients, objectTypes: state.objectTypes });
      } catch {}
    } catch {
      push(t({ it: 'Eliminazione fallita', en: 'Delete failed' }), 'danger');
    } finally {
      setClearing(false);
    }
  };

  const handleCsvFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvFile({ name: file.name, text });
      setCsvConfirmOpen(true);
    };
    reader.readAsText(file);
  };

  const downloadCsvTemplate = () => {
    const safeClientName = String(activeClient?.shortName || activeClient?.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    const template = [
      'firstName,lastName,role,dept1,dept2,dept3,email,mobile,ext1,ext2,ext3,isExternal',
      'Mario,Rossi,HR,People,,,mario.rossi@example.com,+39 333 1234567,101,,,"0"'
    ].join('\n');
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeClientName ? `${safeClientName}-users-import-template.csv` : 'users-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runCsvImport = async (mode: 'append' | 'replace') => {
    if (!activeClientId || !csvFile) return;
    setCsvImporting(true);
    setCsvConfirmOpen(false);
    try {
      const res = await importCsv({ clientId: activeClientId, csvText: csvFile.text, mode });
      push(
        t({
          it: `Import CSV completato (${res.summary?.created ?? 0} nuovi, ${res.summary?.updated ?? 0} aggiornati).`,
          en: `CSV import completed (${res.summary?.created ?? 0} new, ${res.summary?.updated ?? 0} updated).`
        }),
        'success'
      );
      if ((res as any)?.summary?.duplicateEmails > 0) {
        push(
          t({
            it: `CSV importato con ${(res as any).summary.duplicateEmails} email duplicate saltate.`,
            en: `CSV imported with ${(res as any).summary.duplicateEmails} duplicate-email records skipped.`
          }),
          'info'
        );
      }
      setCsvFile(null);
      await loadSummary();
      const rows = await loadUsers(activeClientId);
      await refreshWebApiPreview(activeClientId);
      if (hasDuplicatesInRows(rows || [])) {
        setUsersOpen(true);
        setDuplicatesModalOpen(true);
        push(
          t({
            it: 'Import CSV completato con possibili duplicati. Apri la lista e gestisci i record.',
            en: 'CSV import completed with possible duplicates. Open the list and review records.'
          }),
          'info'
        );
      }
      if (mode === 'replace') {
        try {
          const state = await fetchState();
          if (Array.isArray(state.clients)) setServerState({ clients: state.clients, objectTypes: state.objectTypes });
        } catch {}
      }
    } catch (err: any) {
      push(err?.message || t({ it: 'Import CSV fallito', en: 'CSV import failed' }), 'danger');
    } finally {
      setCsvImporting(false);
    }
  };

  const saveManualUser = async () => {
    if (!activeClientId) return;
    const hasIdentity = !!manualUserForm.firstName.trim() || !!manualUserForm.lastName.trim() || !!manualUserForm.email.trim();
    if (!hasIdentity) {
      push(t({ it: 'Compila almeno nome, cognome o email.', en: 'Fill at least first name, last name or email.' }), 'info');
      return;
    }
    const emailKey = String(manualUserForm.email || '').trim().toLowerCase();
    const firstKey = String(manualUserForm.firstName || '').trim().toLowerCase();
    const lastKey = String(manualUserForm.lastName || '').trim().toLowerCase();
    const possibleDuplicate = usersRows.find((r) => {
      if (manualUserEditingId && r.externalId === manualUserEditingId) return false;
      const re = String(r.email || '').trim().toLowerCase();
      if (emailKey && re && emailKey === re) return true;
      if (!emailKey) {
        const rf = String(r.firstName || '').trim().toLowerCase();
        const rl = String(r.lastName || '').trim().toLowerCase();
        if ((firstKey || lastKey) && rf === firstKey && rl === lastKey) return true;
      }
      return false;
    });
    if (possibleDuplicate) {
      push(
        t({
          it: 'Possibile duplicato rilevato (stessa email oppure nome+cognome). Modifica il record esistente o cambia i dati.',
          en: 'Possible duplicate detected (same email or same first+last name). Edit the existing record or change the data.'
        }),
        'info'
      );
      return;
    }
    setManualUserSaving(true);
    try {
      if (manualUserEditingId) {
        await updateExternalUser({
          clientId: activeClientId,
          externalId: manualUserEditingId,
          user: manualUserForm
        });
        push(
          manualUserEditingKind === 'imported'
            ? t({ it: 'Utente importato aggiornato nel contenitore locale', en: 'Imported user updated in the local container' })
            : t({ it: 'Utente manuale aggiornato', en: 'Manual user updated' }),
          'success'
        );
      } else {
        await createManualExternalUser({
          clientId: activeClientId,
          user: manualUserForm
        });
        push(t({ it: 'Utente manuale creato', en: 'Manual user created' }), 'success');
      }
      setManualUserModalOpen(false);
      resetManualUserForm();
      await loadSummary();
      await loadUsers(activeClientId);
    } catch (err: any) {
      push(err?.message || t({ it: 'Operazione fallita', en: 'Operation failed' }), 'danger');
    } finally {
      setManualUserSaving(false);
    }
  };

  const removeManualUser = async (row: ExternalUserRow) => {
    if (!activeClientId) return;
    const assigned = assignedCounts.get(`${row.clientId}:${row.externalId}`) || 0;
    if (assigned > 0) {
      push(
        t({
          it: `Impossibile rimuovere: utente assegnato a ${assigned} oggetti. Rimuovi prima le assegnazioni.`,
          en: `Cannot delete: user is assigned to ${assigned} objects. Remove assignments first.`
        }),
        'info'
      );
      return;
    }
    setManualUserDeletingId(row.externalId);
    try {
      await deleteManualExternalUser({ clientId: activeClientId, externalId: row.externalId });
      push(t({ it: 'Utente manuale rimosso', en: 'Manual user removed' }), 'success');
      await loadSummary();
      await loadUsers(activeClientId);
    } catch (err: any) {
      push(err?.message || t({ it: 'Rimozione fallita', en: 'Delete failed' }), 'danger');
    } finally {
      setManualUserDeletingId(null);
    }
  };

  const openUsersOrExplain = useCallback(async (clientId: string) => {
    const total = Number(activeSummary?.total || 0);
    if (total <= 0) {
      push(
        t({
          it: 'Non ci sono ancora utenti importati per questo cliente. Esegui prima una importazione WebAPI/CSV oppure un inserimento manuale.',
          en: 'There are no imported users for this client yet. Run a WebAPI/CSV import or add manual users first.'
        }),
        'info'
      );
      return;
    }
    await openUsers(clientId);
  }, [activeSummary?.total, openUsers, push, t]);

  return (
    <div className="space-y-6">
      {lockClientSelection && activeClientId ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span>{t({ it: 'Utenti cliente', en: 'Client users' })} · {activeClient?.shortName || activeClient?.name || '—'}</span>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-ink"
                  title={t({
                    it: 'Gestisci la rubrica utenti del cliente con quattro sorgenti: WebAPI, LDAP, CSV e inserimento manuale. Tutti gli utenti finiscono in un unico contenitore. I duplicati vengono segnalati per email o, se assente, per nome+cognome. Da questa schermata puoi configurare, testare e importare da WebAPI e LDAP, importare da CSV e aggiungere utenti manuali.',
                    en: 'Manage the client user directory with four sources: WebAPI, LDAP, CSV and manual entry. All users go into one container. Duplicates are flagged by email or, if missing, by first and last name. From here you can configure, test and import from WebAPI and LDAP, import from CSV and add manual users.'
                  })}
                  aria-label={t({ it: 'Informazioni import utenti', en: 'User import information' })}
                >
                  <Info size={14} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void openUsersOrExplain(activeClientId)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                  (activeSummary?.total || 0) > 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={
                  (activeSummary?.total || 0) > 0
                    ? t({ it: 'Apri il contenitore locale di tutti gli utenti del cliente. Qui trovi utenti importati e manuali, puoi cercarli, nasconderli, modificarli e creare eventuali utenti portale collegati.', en: 'Open the local container of all client users. Here you can find imported and manual users, search them, hide them, edit them, and create linked portal users when needed.' })
                    : t({ it: 'Il contenitore utenti è ancora vuoto. Esegui prima un import da WebAPI, LDAP o CSV, oppure crea un utente manuale.', en: 'The user container is still empty. First run a WebAPI, LDAP, or CSV import, or create a manual user.' })
                }
              >
                <Users size={15} />
                {t({ it: 'Utenti importati', en: 'Imported users' })}
              </button>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {t({ it: 'Totale', en: 'Total' })}: {activeSummary?.total ?? 0}
              </span>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${duplicateGroups.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                {t({ it: 'Duplicati', en: 'Duplicates' })}: {duplicateGroups.length}
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setImportMode('webapi')} title={t({ it: 'Usa una WebAPI esterna per leggere utenti da un servizio remoto. Da qui puoi configurare endpoint, testare la risposta e poi importare nel contenitore locale.', en: 'Use an external WebAPI to read users from a remote service. From here you can configure the endpoint, test the response, and then import into the local container.' })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'webapi' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>WebAPI</button>
            <button type="button" onClick={() => setImportMode('ldap')} title={t({ it: 'Usa un server LDAP o Active Directory in sola lettura. Da qui puoi configurare connessione, fare test, confronto e import selettivo.', en: 'Use a read-only LDAP or Active Directory server. From here you can configure the connection, run tests, compare, and perform selective import.' })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'ldap' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>LDAP</button>
            <button type="button" onClick={() => setImportMode('csv')} title={t({ it: 'Importa utenti da un file CSV. Puoi scaricare un modello, preparare i dati e importarli nel contenitore locale.', en: 'Import users from a CSV file. You can download a template, prepare the data, and import it into the local container.' })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'csv' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>CSV</button>
            <button type="button" onClick={() => setImportMode('manual')} title={t({ it: 'Inserisci a mano un utente direttamente nel contenitore locale del cliente, senza sorgente esterna.', en: 'Manually add a user directly into the client local container, without any external source.' })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t({ it: 'Inserimento manuale', en: 'Manual entry' })}</button>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {importMode === 'webapi' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => openConfig(activeClientId, 'webapi')} className="btn-secondary" disabled={!activeClientId} title={t({ it: 'Apri la configurazione WebAPI di questo cliente: URL, metodo HTTP, credenziali e payload opzionale.', en: 'Open the WebAPI configuration for this client: URL, HTTP method, credentials, and optional payload.' })}>
                  {t({ it: 'Configurazione', en: 'Configuration' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeClientId) return;
                    if (canOpenWebApiImportPreview) {
                      void openWebApiPreview();
                      return;
                    }
                    openConfig(activeClientId, 'webapi');
                  }}
                  disabled={!activeClientId}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                  title={
                    canOpenWebApiImportPreview
                      ? t({ it: 'Apri l’anteprima utenti trovati dalla WebAPI', en: 'Open WebAPI users preview' })
                      : t({ it: 'Configura e testa prima la WebAPI per abilitare l’importazione.', en: 'Configure and test WebAPI first to enable import.' })
                  }
                >
                  <UploadCloud size={16} />
                  {t({ it: 'Import', en: 'Import' })}
                </button>
              </div>
            ) : importMode === 'ldap' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => openConfig(activeClientId, 'ldap')} className="btn-secondary" disabled={!activeClientId} title={t({ it: 'Apri la configurazione LDAP di questo cliente: server, sicurezza, autenticazione, Base DN, filtro, mapping attributi e limiti di lettura.', en: 'Open the LDAP configuration for this client: server, security, authentication, Base DN, filter, attribute mapping, and read limits.' })}>
                  {t({ it: 'Configurazione', en: 'Configuration' })}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!activeClientId) return;
                    const loadedConfig = await loadLdapConfig(activeClientId);
                    const nextHasServer = String(loadedConfig?.server || '').trim();
                    if (nextHasServer) {
                      void openLdapCompareModal();
                      return;
                    }
                    openConfig(activeClientId, 'ldap');
                  }}
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={!activeClientId}
                  title={t({ it: 'Apri confronto LDAP per vedere utenti importabili, gia presenti e saltati. Se LDAP non e ancora configurato, apre prima la configurazione.', en: 'Open LDAP compare to inspect importable, existing and skipped users. If LDAP is not configured yet, it opens configuration first.' })}
                >
                  <UploadCloud size={16} />
                  {t({ it: 'Import', en: 'Import' })}
                </button>
              </div>
            ) : importMode === 'csv' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={downloadCsvTemplate} className="btn-secondary inline-flex items-center gap-2" disabled={!activeClientId} title={t({ it: 'Esporta il modello CSV da compilare offline.', en: 'Export the CSV template to fill offline.' })}>
                  <FileDown size={16} />
                  {t({ it: 'Export template', en: 'Export template' })}
                </button>
                <button type="button" onClick={() => openConfig(activeClientId, 'csv')} className="btn-primary inline-flex items-center gap-2" disabled={!activeClientId} title={t({ it: 'Apri direttamente il flusso di import CSV per caricare il file o usare il modello.', en: 'Open the CSV import flow directly to upload the file or use the template.' })}>
                  <UploadCloud size={16} />
                  {t({ it: 'Import', en: 'Import' })}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={async () => { if (!activeClientId) return; await openUsers(activeClientId); }} className="btn-primary inline-flex items-center gap-2" disabled={!activeClientId} title={t({ it: 'Apri il contenitore locale degli utenti e aggiungi nuove entita con il pulsante + in alto a destra.', en: 'Open the local users container and add new entities with the + button in the top right.' })}>
                  <Plus size={16} />
                  ADD
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {duplicateGroups.length ? (
                <button
                  type="button"
                  onClick={async () => {
                    setDuplicatesModalOpen(true);
                    await openUsers(activeClientId);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                  title={t({ it: 'Apri l’elenco dei potenziali duplicati nel contenitore locale. Qui puoi verificare collisioni per email oppure nome e cognome.', en: 'Open the list of possible duplicates in the local container. Here you can review collisions by email or by first and last name.' })}
                >
                  {t({ it: 'Gestisci duplicati', en: 'Manage duplicates' })}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-card ${lockClientSelection ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Importazioni per cliente', en: 'Client imports' })}</div>
          <button
            onClick={loadSummary}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            title={t({ it: 'Aggiorna elenco', en: 'Refresh list' })}
          >
            <RefreshCw size={16} className={summaryLoading ? 'animate-spin text-primary' : 'text-slate-500'} />
            {t({ it: 'Aggiorna', en: 'Refresh' })}
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <div className="col-span-5">{t({ it: 'Cliente', en: 'Client' })}</div>
            <div className="col-span-3">{t({ it: 'Ultima importazione', en: 'Last import' })}</div>
            <div className="col-span-2">{t({ it: 'Utenti importati', en: 'Imported users' })}</div>
            <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {visibleSummaryRows.map((row) => {
              const lastImport = formatDate(row.lastImportAt);
              const importStatus = row.lastImportAt ? lastImport : t({ it: 'Import non eseguito', en: 'Import not executed' });
              const hasImport = !!row.lastImportAt;
              return (
                <div key={row.clientId} className="grid grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-sm">
                  <div className="col-span-5 min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate font-semibold text-ink">{row.clientName}</div>
                      <button
                        onClick={() => {
                          setInfoClientId(row.clientId);
                          setInfoOpen(true);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                        title={t({ it: 'Info cliente', en: 'Client info' })}
                      >
                        <Info size={12} />
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold uppercase text-slate-400">{importStatus}</div>
                  </div>
                  <div className={`col-span-3 text-xs ${hasImport ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}`}>
                    {hasImport ? lastImport : 'MAI'}
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-semibold text-ink">{row.total}</div>
                    <div className="text-[11px] text-slate-500">
                      {t({ it: `Attivi ${row.presentCount}`, en: `Active ${row.presentCount}` })}
                      {row.missingCount ? ` · ${t({ it: `Mancanti ${row.missingCount}`, en: `Missing ${row.missingCount}` })}` : ''}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openUsers(row.clientId)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Visualizza utenti importati', en: 'View imported users' })}
                    >
                      <Users size={14} />
                    </button>
                    <button
                      onClick={() => openConfig(row.clientId)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Impostazioni importazione per questo cliente', en: 'Import settings for this client' })}
                    >
                      <Settings2 size={14} />
                    </button>
                    {row.hasWebApiConfig ? (
                      <button
                        onClick={() => runSync(row.clientId)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Aggiorna importazione da WebAPI', en: 'Sync import from WebAPI' })}
                        disabled={syncingClientId === row.clientId}
                      >
                        <RefreshCw size={14} className={syncingClientId === row.clientId ? 'animate-spin' : ''} />
                      </button>
                    ) : row.hasLdapConfig ? (
                      <button
                        onClick={() => openConfig(row.clientId, 'ldap')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Apri importazione LDAP per questo cliente', en: 'Open LDAP import for this client' })}
                      >
                        <UploadCloud size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => openConfig(row.clientId, 'csv')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Carica un CSV per questo cliente', en: 'Upload a CSV for this client' })}
                      >
                        <UploadCloud size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!visibleSummaryRows.length && !summaryLoading ? (
              <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun cliente disponibile.', en: 'No clients available.' })}</div>
            ) : null}
            {summaryLoading ? <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</div> : null}
          </div>
        </div>
      </div>

      <Transition show={configOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[120]"
          onClose={() => {
            if (configChildDialogOpen) return;
            setConfigOpen(false);
          }}
          initialFocus={configDialogFocusRef}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <button ref={configDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">
                        {t({ it: 'Configurazione import utenti', en: 'User import configuration' })}
                      </Dialog.Title>
                      <div className="modal-description">
                        {activeClient ? activeClient.name : t({ it: 'Nessun cliente selezionato', en: 'No client selected' })}
                      </div>
                    </div>
                    <button onClick={() => setConfigOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  {!lockClientSelection ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Stato importazione', en: 'Import status' })}</div>
                      <div className="text-xs text-slate-500">
                        {activeSummary
                          ? t({ it: `Ultima importazione: ${formatDate(activeSummary.lastImportAt)}`, en: `Last import: ${formatDate(activeSummary.lastImportAt)}` })
                          : t({ it: 'Nessuna importazione', en: 'No imports yet' })}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Utenti importati', en: 'Imported users' })}</div>
                        <div className="text-base font-semibold text-ink">{activeSummary?.total ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Attivi', en: 'Active' })}</div>
                        <div className="text-base font-semibold text-ink">{activeSummary?.presentCount ?? 0}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeClientId || !(activeSummary?.missingCount || 0)) return;
                          setConfigOpen(false);
                          await openUsers(activeClientId);
                          setIncludeMissing(true);
                          setOnlyMissing(true);
                        }}
                        disabled={!(activeSummary?.missingCount || 0)}
                        className={`rounded-xl border px-3 py-2 text-left ${
                          (activeSummary?.missingCount || 0)
                            ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                            : 'border-slate-200 bg-white'
                        } disabled:cursor-default`}
                        title={
                          (activeSummary?.missingCount || 0)
                            ? t({ it: 'Apri elenco utenti mancanti per decidere se includerli o escluderli', en: 'Open missing users list to include/exclude them' })
                            : undefined
                        }
                      >
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Mancanti', en: 'Missing' })}</div>
                        <div className="text-base font-semibold text-ink">{activeSummary?.missingCount ?? 0}</div>
                      </button>
                    </div>
                  </div>
                  ) : null}

                  {!lockClientSelection ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-ink">{t({ it: 'Sorgente importazione', en: 'Import source' })}</div>
                    <button
                      onClick={() => setImportMode('webapi')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'webapi' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Usa importazione da WebAPI', en: 'Use WebAPI import' })}
                    >
                      WebAPI
                    </button>
                    <button
                      onClick={() => setImportMode('ldap')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'ldap' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Usa importazione da LDAP', en: 'Use LDAP import' })}
                    >
                      LDAP
                    </button>
                    <button
                      onClick={() => setImportMode('csv')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'csv' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Usa importazione da CSV', en: 'Use CSV import' })}
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => setImportMode('manual')}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        importMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={t({ it: 'Gestione manuale utenti reali', en: 'Manual real users management' })}
                    >
                      {t({ it: 'Manuale', en: 'Manual' })}
                    </button>
                    </div>
                  ) : null}

                  {importMode === 'webapi' ? (
                    configExpanded ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="block text-sm font-medium text-slate-700 md:col-span-3">
                          {t({ it: 'WebAPI URL', en: 'WebAPI URL' })}
                          <input
                            value={cfg?.url || ''}
                            onChange={(e) =>
                              setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), url: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="https://api.example.com/users"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Username', en: 'Username' })}
                          <input
                            value={cfg?.username || ''}
                            onChange={(e) =>
                              setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), username: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="api-user"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Password', en: 'Password' })}
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder={cfg?.hasPassword ? t({ it: 'Lascia vuoto per non cambiare', en: 'Leave empty to keep' }) : '••••••'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Metodo', en: 'Method' })}
                          <select
                            value={cfg?.method || 'POST'}
                            onChange={(e) =>
                              setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), method: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700 md:col-span-3">
                          {t({ it: 'Body JSON (opzionale)', en: 'Body JSON (optional)' })}
                          <textarea
                            value={cfg?.bodyJson || ''}
                            onChange={(e) =>
                              setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), bodyJson: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            rows={3}
                            placeholder='{"User":"...","Password":"..."}'
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            {t({
                              it: 'Apri le impostazioni WebAPI con l’icona ingranaggio per configurare URL e credenziali.',
                              en: 'Open the WebAPI settings via the gear icon to configure URL and credentials.'
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfigExpanded(true)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Apri impostazioni WebAPI', en: 'Open WebAPI settings' })}
                          >
                            <Settings2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  ) : importMode === 'ldap' ? (
                    <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {t({ it: 'Configurazione LDAP', en: 'LDAP configuration' })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {t({ it: 'Configurazione generica per LDAP, OpenLDAP e Active Directory.', en: 'Generic configuration for LDAP, OpenLDAP and Active Directory.' })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLdapInfoOpen(true)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          title={t({ it: 'Apri guida completa LDAP', en: 'Open full LDAP guide' })}
                          aria-label={t({ it: 'Guida configurazione LDAP', en: 'LDAP configuration guide' })}
                        >
                          <Info size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLdapConfigTab('settings')}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${ldapConfigTab === 'settings' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          Settings
                        </button>
                        <button
                          type="button"
                          onClick={() => setLdapConfigTab('filters')}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${ldapConfigTab === 'filters' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          Filters
                        </button>
                      </div>
                      {ldapConfigTab === 'settings' ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Server LDAP', en: 'LDAP server' })}
                          <input
                            value={ldapCfg?.server || ''}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), server: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="ldap.example.com"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Porta', en: 'Port' })}
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={String(ldapCfg?.port || '')}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), port: Number(e.target.value || 0) }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="636"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Sicurezza trasporto', en: 'Transport security' })}
                          <select
                            value={ldapCfg?.security || 'ldaps'}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), security: e.target.value as 'ldaps' | 'starttls' | 'ldap', port: e.target.value === 'ldaps' ? 636 : prev?.port || 389 }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="ldaps">LDAPS</option>
                            <option value="starttls">LDAP + StartTLS</option>
                            <option value="ldap">LDAP</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Scope ricerca', en: 'Search scope' })}
                          <select
                            value={ldapCfg?.scope || 'sub'}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), scope: e.target.value as 'sub' | 'one' }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="sub">{t({ it: 'OU corrente + sotto-OU', en: 'Current OU + child OUs' })}</option>
                            <option value="one">{t({ it: 'Solo OU corrente', en: 'Current OU only' })}</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Autenticazione', en: 'Authentication' })}
                          <select
                            value={ldapCfg?.authType || 'simple'}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), authType: e.target.value as 'anonymous' | 'simple' | 'domain_user' | 'user_principal_name' }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="simple">{t({ it: 'Simple bind', en: 'Simple bind' })}</option>
                            <option value="domain_user">{t({ it: 'Dominio\\utente', en: 'Domain\\user' })}</option>
                            <option value="user_principal_name">{t({ it: 'utente@dominio', en: 'user@domain' })}</option>
                            <option value="anonymous">{t({ it: 'Anonima', en: 'Anonymous' })}</option>
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Dominio', en: 'Domain' })}
                          <input
                            value={ldapCfg?.domain || ''}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), domain: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="example.com"
                            disabled={ldapCfg?.authType === 'anonymous' || ldapCfg?.authType === 'simple'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Utente', en: 'User' })}
                          <input
                            value={ldapCfg?.username || ''}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), username: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="ldap-reader"
                            disabled={ldapCfg?.authType === 'anonymous'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Password', en: 'Password' })}
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={ldapPassword}
                            onChange={(e) => setLdapPassword(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder={ldapCfg?.hasPassword ? t({ it: 'Lascia vuoto per non cambiare', en: 'Leave empty to keep' }) : '••••••'}
                            disabled={ldapCfg?.authType === 'anonymous'}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                          {t({ it: 'Base DN', en: 'Base DN' })}
                          <input
                            value={ldapCfg?.baseDn || ''}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), baseDn: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="DC=example,DC=com"
                          />
                        </label>
                      </div>
                      ) : null}
                      {ldapConfigTab === 'filters' ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-sky-900">
                            {t({ it: 'Filtro, mapping attributi e limiti', en: 'Filter, attribute mapping, and limits' })}
                          </div>
                          <div className="mt-1 text-xs leading-6 text-sky-800">
                            {t({
                              it: 'Qui decidi quali utenti LDAP leggere e come copiare i dati nei campi locali. Il filtro sceglie i record da leggere. I campi sotto dicono quale attributo LDAP usare per email, nome, cognome, identificativo, ruolo, telefono e reparto. Se un attributo è vuoto o sbagliato, quel dato arriverà mancante.',
                              en: 'Here you decide which LDAP users to read and how to copy the data into local fields. The filter chooses which records are read. The fields below tell the system which LDAP attribute to use for email, first name, last name, identifier, role, phone, and department. If an attribute is empty or wrong, that value will be missing.'
                            })}
                          </div>
                        </div>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Filtro utenti LDAP', en: 'LDAP user filter' })}
                          <input
                            value={ldapCfg?.userFilter || ''}
                            onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), userFilter: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                            placeholder="(&(objectClass=user)(mail=*))"
                            title={t({ it: 'Filtro LDAP RFC4515. Serve a limitare la lettura solo agli oggetti che ti interessano dentro il Base DN scelto.', en: 'RFC4515 LDAP filter. It limits the read to only the objects you need inside the selected Base DN.' })}
                          />
                          <div className="mt-1 text-[11px] text-sky-800">
                            {t({
                              it: 'Questo filtro si applica sopra il Base DN. Se è troppo largo, leggerai più utenti del necessario.',
                              en: 'This filter is applied on top of the Base DN. If it is too broad, you will read more users than needed.'
                            })}
                          </div>
                        </label>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <label className="block text-sm font-medium text-slate-700">
                          Email
                          <input value={ldapCfg?.emailAttribute || ''} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), emailAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP che contiene l’email. Se manca, l’utente non può essere confrontato correttamente per evitare duplicati.', en: 'LDAP attribute that contains the email. If it is missing, the user cannot be compared correctly to avoid duplicates.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Nome', en: 'First name' })}
                          <input value={ldapCfg?.firstNameAttribute || ''} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), firstNameAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del nome. Esempio comune: givenName.', en: 'LDAP attribute for the first name. Common example: givenName.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Cognome', en: 'Last name' })}
                          <input value={ldapCfg?.lastNameAttribute || ''} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), lastNameAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del cognome. Esempio comune: sn.', en: 'LDAP attribute for the last name. Common example: sn.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          External ID
                          <input value={ldapCfg?.externalIdAttribute || ''} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), externalIdAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Identificativo stabile del record LDAP. Serve a riconoscere la stessa persona tra import successivi.', en: 'Stable identifier of the LDAP record. It is used to recognize the same person across future imports.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Ruolo', en: 'Role' })}
                          <input value={ldapCfg?.roleAttribute || ''} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), roleAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP da usare come ruolo o job title. Se il tuo LDAP non lo ha, puoi lasciarlo vuoto.', en: 'LDAP attribute used as role or job title. If your LDAP does not have it, you can leave it empty.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Mobile', en: 'Mobile' })}
                          <input value={ldapCfg?.mobileAttribute || ''} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), mobileAttribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del numero di telefono o cellulare. Gli spazi vengono rimossi in salvataggio.', en: 'LDAP attribute for the phone or mobile number. Spaces are removed when saving.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Dipartimento', en: 'Department' })}
                          <input value={ldapCfg?.dept1Attribute || ''} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), dept1Attribute: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Attributo LDAP del reparto principale. Viene copiato nel campo locale reparto 1.', en: 'LDAP attribute for the main department. It is copied into the local department 1 field.' })} />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Max utenti', en: 'Max users' })}
                          <input type="number" min={1} max={5000} value={String(ldapCfg?.sizeLimit || 1000)} onChange={(e) => setLdapCfg((prev) => ({ ...(prev || { server: '', port: 636, security: 'ldaps', scope: 'sub', authType: 'simple', domain: '', username: '', hasPassword: false, baseDn: '', userFilter: '(mail=*)', emailAttribute: 'mail', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', externalIdAttribute: 'sAMAccountName', roleAttribute: 'title', mobileAttribute: 'mobile', dept1Attribute: 'department', sizeLimit: 1000 }), sizeLimit: Number(e.target.value || 1000) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" title={t({ it: 'Limite massimo di utenti letti da LDAP nel confronto e nell’import. Il test connessione legge comunque solo un campione fino a 25 utenti.', en: 'Maximum number of users read from LDAP during compare and import. Connection test still reads only a sample up to 25 users.' })} />
                        </label>
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          {t({
                            it: 'LDAP è sempre in sola lettura: il backend usa solo bind, search e unbind. Nessuna operazione di scrittura, modifica o cancellazione viene mai inviata verso il server LDAP.',
                            en: 'LDAP is always read-only: the backend uses only bind, search, and unbind. No write, update, or delete operation is ever sent to the LDAP server.'
                          })}
                        </div>
                      </div>
                      ) : null}
                    </div>
                  ) : importMode === 'csv' ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Import CSV', en: 'CSV import' })}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t({ it: 'Carica un CSV per questo cliente. Puoi sommare o sostituire gli utenti esistenti.', en: 'Upload a CSV for this client. You can append or replace existing users.' })}
                          </div>
                        </div>
                        <button
                          onClick={downloadCsvTemplate}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                          title={t({ it: 'Scarica modello CSV', en: 'Download CSV template' })}
                        >
                          <FileDown size={16} className="text-slate-500" />
                          {t({ it: 'Modello CSV', en: 'CSV template' })}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                          <UploadCloud size={16} />
                          {t({ it: 'Carica CSV', en: 'Upload CSV' })}
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => handleCsvFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        {csvFile ? <span className="text-xs text-slate-500">{csvFile.name}</span> : null}
                        {csvImporting ? <span className="text-xs text-slate-500">{t({ it: 'Import in corso…', en: 'Importing…' })}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Inserimento manuale utenti reali', en: 'Manual real users entry' })}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t({
                              it: 'Aggiungi, modifica o rimuovi utenti senza WebAPI/CSV. Gli utenti manuali restano separati e non vengono marcati mancanti durante la sincronizzazione WebAPI.',
                              en: 'Add, edit or delete users without WebAPI/CSV. Manual users stay separate and are not marked missing during WebAPI sync.'
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                            {t({ it: 'Utenti manuali', en: 'Manual users' })}: {manualRowsCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!activeClientId) return;
                              if (!usersOpen) {
                                openUsers(activeClientId);
                              }
                              openManualUserCreate();
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                          >
                            <Plus size={15} />
                            {t({ it: 'Nuovo utente manuale', en: 'New manual user' })}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {importMode === 'webapi' ? (
                      <>
                        <button
                          onClick={saveConfig}
                          disabled={savingCfg || !activeClientId || !canSaveWebApiSettings}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                          title={
                            !canSaveWebApiSettings
                              ? t({
                                  it: 'Puoi aggiornare le impostazioni solo dopo la prima importazione.',
                                  en: 'You can update settings only after the first import.'
                                })
                              : t({ it: 'Salva / aggiorna impostazioni WebAPI', en: 'Save / update WebAPI settings' })
                          }
                        >
                          <Save size={16} className={savingCfg ? 'animate-pulse' : ''} />
                        </button>
                        <button
                          onClick={runTest}
                          disabled={testing || !activeClientId || !canRunWebApiTest}
                          className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                          title={
                            !canRunWebApiTest
                              ? t({ it: 'Configura prima le impostazioni WebAPI.', en: 'Configure WebAPI settings first.' })
                              : t({ it: 'Verifica connessione WebAPI', en: 'Test WebAPI connection' })
                          }
                        >
                          <TestTube size={16} /> {testing ? t({ it: 'Test…', en: 'Testing…' }) : t({ it: 'Test', en: 'Test' })}
                        </button>
                      </>
                    ) : null}
                    {importMode !== 'webapi' && !lockClientSelection && (activeSummary?.total || syncResult?.ok || importMode === 'manual') ? (
                      <button
                        onClick={() => activeClientId && openUsers(activeClientId)}
                        className="flex items-center gap-2 btn-secondary"
                        title={t({ it: 'Apri utenti importati', en: 'Open imported users' })}
                      >
                        <Users size={16} /> {t({ it: 'Utenti importati', en: 'Imported users' })}
                      </button>
                    ) : null}
                    {importMode !== 'webapi' && importMode !== 'ldap' ? (
                      <button
                        onClick={() => setClearConfirmOpen(true)}
                        disabled={!activeClientId || clearing || !canClearWebApiImport}
                        className="ml-auto flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        title={
                          !canClearWebApiImport
                            ? t({
                                it: 'Disponibile solo dopo almeno una importazione.',
                                en: 'Available only after at least one import.'
                              })
                            : t({ it: 'Elimina dati importati', en: 'Delete imported data' })
                        }
                      >
                        <Trash2 size={16} /> {clearing ? t({ it: 'Eliminazione…', en: 'Deleting…' }) : t({ it: 'Elimina', en: 'Delete' })}
                      </button>
                    ) : null}
                  </div>
                  {importMode === 'ldap' ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={saveLdapConfigHandler}
                          disabled={savingLdapCfg || !activeClientId || !ldapCfg}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                          title={t({ it: 'Salva / aggiorna impostazioni LDAP', en: 'Save / update LDAP settings' })}
                        >
                          <Save size={16} className={savingLdapCfg ? 'animate-pulse' : ''} />
                        </button>
                        <button
                          onClick={runLdapTest}
                          disabled={ldapTesting || !activeClientId || !ldapCfg}
                          className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                          title={t({
                            it: 'Verifica connessione e lettura LDAP con un campione limitato ai primi 25 utenti. Il test non importa nulla.',
                            en: 'Check LDAP connectivity and read access with a sample limited to the first 25 users. The test does not import anything.'
                          })}
                        >
                          <TestTube size={16} /> {ldapTesting ? t({ it: 'Test…', en: 'Testing…' }) : t({ it: 'Test connessione', en: 'Test connection' })}
                        </button>
                        <button
                          onClick={openLdapCompareModal}
                          disabled={ldapPreviewLoading || !activeClientId || !ldapCfg}
                          className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                          title={t({
                            it: 'Apri un confronto dedicato tra utenti LDAP e utenti gia presenti nel contenitore locale.',
                            en: 'Open a dedicated comparison between LDAP users and users already present in the local container.'
                          })}
                        >
                          <Search size={16} /> {ldapPreviewLoading ? t({ it: 'Confronto…', en: 'Comparing…' }) : t({ it: 'Confronta', en: 'Compare' })}
                        </button>
                        <button
                          onClick={openLdapImportSelection}
                          disabled={ldapImporting || !activeClientId || !ldapPreviewResult?.importableCount}
                          className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                        >
                          <UploadCloud size={16} /> {ldapImporting ? t({ it: 'Import…', en: 'Importing…' }) : t({ it: 'Importa', en: 'Import' })}
                        </button>
                      </div>
                      {ldapTestResult ? (
                        <div className={`rounded-xl border px-3 py-2 text-sm ${ldapTestResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                          {ldapTestResult.ok
                            ? t({
                                it: `Connessione LDAP ok. Campione letto nel test: ${ldapTestResult.count ?? 0} utenti su massimo 25.`,
                                en: `LDAP connection ok. Sample read in test: ${ldapTestResult.count ?? 0} users out of max 25.`
                              })
                            : ldapTestResult.error || t({ it: 'Test LDAP fallito', en: 'LDAP test failed' })}
                        </div>
                      ) : null}
                      {ldapImportResult ? (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                          {t({
                            it: `Ultimo import LDAP: letti ${ldapImportResult.fetched}, selezionati ${ldapImportResult.selected || 0}, creati ${ldapImportResult.created}, gia presenti ${ldapImportResult.existing}, saltati ${ldapImportResult.skipped}.`,
                            en: `Last LDAP import: fetched ${ldapImportResult.fetched}, selected ${ldapImportResult.selected || 0}, created ${ldapImportResult.created}, already present ${ldapImportResult.existing}, skipped ${ldapImportResult.skipped}.`
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {testResult ? (
                    testResult.ok ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {t({ it: `Test OK: ${testResult.count ?? 0} utenti trovati.`, en: `Test OK: ${testResult.count ?? 0} users found.` })}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <div className="font-semibold">
                          {t({ it: `Test fallito (HTTP ${testResult.status || 0}).`, en: `Test failed (HTTP ${testResult.status || 0}).` })}
                        </div>
                        {testResult.error ? <div className="mt-1 text-xs">{testResult.error}</div> : null}
                        {testResult.contentType ? <div className="mt-1 text-xs">Content-Type: {testResult.contentType}</div> : null}
                        {testResult.rawSnippet ? (
                          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-[11px] text-slate-700">
                            {String(testResult.rawSnippet).slice(0, 500)}
                          </pre>
                        ) : null}
                      </div>
                    )
                  ) : null}
                  {syncResult && syncResult.ok ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {t({ it: 'Importazione completata con successo.', en: 'Import completed successfully.' })}
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={webApiPreviewOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[130]"
          onClose={() => setWebApiPreviewOpen(false)}
          initialFocus={webApiPreviewDialogFocusRef}
        >
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-6xl modal-panel">
                  <button ref={webApiPreviewDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Importazione WebAPI', en: 'WebAPI import' })}</Dialog.Title>
                      <div className="modal-description">{activeClient ? activeClient.name : ''}</div>
                    </div>
                    <button type="button" onClick={() => activeClientId && refreshWebApiPreview(activeClientId)} className="btn-secondary inline-flex items-center gap-2">
                      <RefreshCw size={16} className={webApiPreviewLoading ? 'animate-spin' : ''} />
                      {t({ it: 'Ricarica', en: 'Reload' })}
                    </button>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="font-semibold text-ink">
                        {t({ it: 'Totali da importazione', en: 'Total from import' })}: {webApiPreviewRemoteRows.length} · {t({ it: 'Utenti esistenti', en: 'Existing users' })}: {webApiPreviewExistingRows.length}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('remove')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'remove' ? 'border-rose-300 bg-rose-100 text-rose-700' : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'}`}
                        >
                          {t({ it: 'Da eliminare', en: 'To delete' })}: {previewSummaryCounts.remove}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('update')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'update' ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'}`}
                        >
                          {t({ it: 'Da aggiornare', en: 'To update' })}: {previewSummaryCounts.update}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('add')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'add' ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'}`}
                        >
                          {t({ it: 'Da aggiungere', en: 'To add' })}: {previewSummaryCounts.add}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebApiPreviewFilter('all')}
                          className={`rounded-full border px-3 py-1 ${webApiPreviewFilter === 'all' ? 'border-slate-300 bg-slate-200 text-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                          {t({ it: 'Tutti', en: 'All' })}
                        </button>
                      </div>
                    </div>
                  </div>
                  {webApiPreviewError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{webApiPreviewError}</div> : null}
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200" onContextMenu={(event) => openWebApiPreviewContextMenu('left', event)}>
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-600">
                        <span>{t({ it: 'Utenti esistenti', en: 'Existing users' })}</span>
                        <span className="text-slate-500">{webApiPreviewExistingFiltered.length}</span>
                      </div>
                      <div className="border-b border-slate-200 bg-white px-3 py-2">
                        <div className="relative">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={webApiPreviewLeftQuery}
                            onChange={(e) => setWebApiPreviewLeftQuery(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-primary"
                            placeholder={t({ it: 'Cerca utenti esistenti…', en: 'Search existing users…' })}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-[420px] overflow-auto">
                        {!webApiPreviewExistingFiltered.length && !webApiPreviewLoading ? <div className="px-4 py-4 text-sm text-slate-500">{t({ it: 'Nessun utente esistente.', en: 'No existing users.' })}</div> : null}
                        {webApiPreviewExistingFiltered.map((r, rowIndex) => {
                          const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || r.externalId;
                          const isMissingFromImport = !webApiPreviewRemoteById.has(String(r.externalId));
                          return (
                            <div
                              key={`existing:${r.externalId}`}
                              onMouseDown={(event) => handleWebApiPreviewRowMouseDown('left', String(r.externalId), rowIndex, event)}
                              onContextMenu={(event) => openWebApiPreviewRowContextMenu('left', String(r.externalId), rowIndex, event)}
                              className={`cursor-pointer select-none border-t border-slate-100 px-4 py-3 text-sm ${webApiPreviewSelectedLeftIdSet.has(String(r.externalId)) ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-white hover:bg-slate-50'}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-semibold text-ink">{name}</div>
                                    {isMissingFromImport ? (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                        {t({ it: 'Rimosso dalla WebAPI', en: 'Removed from WebAPI' })}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="truncate text-xs text-slate-500">{[r.email, r.mobile].filter(Boolean).join(' · ') || '—'}</div>
                                  <div className="truncate text-[11px] text-slate-500">{[r.role, r.dept1, r.dept2, r.dept3].filter(Boolean).join(' · ') || '—'}</div>
                                </div>
                                <div />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200" onContextMenu={(event) => openWebApiPreviewContextMenu('right', event)}>
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-600">
                        <span>{t({ it: 'Variazioni da importazione', en: 'Import variations' })}</span>
                        <span className="text-slate-500">{webApiVariationRows.length}</span>
                      </div>
                      <div className="border-b border-slate-200 bg-white px-3 py-2">
                        <div className="relative">
                          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={webApiPreviewRightQuery}
                            onChange={(e) => setWebApiPreviewRightQuery(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-primary"
                            placeholder={t({ it: 'Cerca variazioni…', en: 'Search variations…' })}
                          />
                        </div>
                      </div>
                      <div className="max-h-[420px] overflow-auto">
                        {webApiPreviewLoading ? <div className="px-4 py-4 text-sm text-slate-500">{t({ it: 'Ricerca in corso…', en: 'Searching…' })}</div> : null}
                        {!webApiPreviewLoading && !webApiVariationRows.length ? <div className="px-4 py-4 text-sm text-slate-500">{t({ it: 'Nessuna variazione rilevata.', en: 'No variations detected.' })}</div> : null}
                        {webApiVariationRows.map((r: any, rowIndex: number) => {
                          const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || r.externalId;
                          const variationType = String(r.variationType || '');
                          const isAdd = variationType === 'add';
                          const isUpdate = variationType === 'update';
                          const tagClass = isAdd ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isUpdate ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700';
                          return (
                            <div
                              key={`remote:${r.externalId}`}
                              onMouseDown={(event) => handleWebApiPreviewRowMouseDown('right', String(r.externalId), rowIndex, event)}
                              onContextMenu={(event) => openWebApiPreviewRowContextMenu('right', String(r.externalId), rowIndex, event)}
                              className={`cursor-pointer select-none border-t border-slate-100 px-4 py-3 text-sm ${webApiPreviewSelectedRightIdSet.has(String(r.externalId)) ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-white hover:bg-slate-50'}`}
                            >
                              <div className="flex items-start gap-2">
                                {isAdd || isUpdate ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void importSingleWebApiUser(r);
                                    }}
                                    disabled={!!webApiPreviewImportingIds[r.externalId]}
                                    className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-40"
                                    title={isAdd ? t({ it: 'Aggiungi utente', en: 'Add user' }) : t({ it: 'Aggiorna utente esistente', en: 'Update existing user' })}
                                  >
                                    {isAdd ? <Plus size={14} className={webApiPreviewImportingIds[r.externalId] ? 'animate-pulse' : ''} /> : <ArrowUpCircle size={14} className={webApiPreviewImportingIds[r.externalId] ? 'animate-pulse' : ''} />}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void deleteSingleImportedUser(r.externalId);
                                    }}
                                    disabled={!!webApiPreviewDeletingIds[r.externalId]}
                                    className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                                    title={t({ it: 'Elimina dal contenitore utenti', en: 'Delete from users container' })}
                                  >
                                    <Trash2 size={14} className={webApiPreviewDeletingIds[r.externalId] ? 'animate-pulse' : ''} />
                                  </button>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-semibold text-ink">{name}</div>
                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tagClass}`}>
                                      {isAdd ? t({ it: 'Da aggiungere', en: 'To add' }) : isUpdate ? t({ it: 'Da aggiornare', en: 'To update' }) : t({ it: 'Da eliminare', en: 'To delete' })}
                                    </span>
                                  </div>
                                  <div className="truncate text-xs text-slate-500">{[r.email, r.mobile].filter(Boolean).join(' · ') || '—'}</div>
                                  <div className="truncate text-[11px] text-slate-500">{[r.role, r.dept1, r.dept2, r.dept3].filter(Boolean).join(' · ') || '—'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {webApiPreviewContextMenu ? (
                    <div
                      ref={webApiPreviewContextMenuRef}
                      className="fixed z-[140] min-w-[200px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                      style={{ left: webApiPreviewContextMenu.x, top: webApiPreviewContextMenu.y }}
                    >
                      <button ref={webApiPreviewContextMenuFocusRef} type="button" className="sr-only" tabIndex={0}>focus</button>
                      <button type="button" onClick={() => selectAllWebApiPreviewRows(webApiPreviewContextMenu.side)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                        {t({ it: 'Seleziona tutto', en: 'Select all' })}
                      </button>
                      <button type="button" onClick={() => clearWebApiPreviewSelection(webApiPreviewContextMenu.side)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                        {t({ it: 'Deseleziona tutto', en: 'Deselect all' })}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span>{t({ it: 'Selezionati', en: 'Selected' })}: <span className="font-semibold text-ink">{webApiPreviewSelectedVariationRows.length}</span></span>
                      <span className="text-emerald-700">{t({ it: 'Add', en: 'Add' })}: {webApiPreviewSelectedAddRows.length}</span>
                      <span className="text-amber-700">{t({ it: 'Update', en: 'Update' })}: {webApiPreviewSelectedUpdateRows.length}</span>
                      <span className="text-rose-700">{t({ it: 'Delete', en: 'Delete' })}: {webApiPreviewSelectedDeleteRows.length}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void applySelectedWebApiVariations()}
                        disabled={
                          !webApiPreviewSelectedVariationRows.length ||
                          Object.keys(webApiPreviewImportingIds).length > 0 ||
                          Object.keys(webApiPreviewDeletingIds).length > 0
                        }
                        className="btn-secondary disabled:opacity-50"
                      >
                        {t({ it: 'Apply selected', en: 'Apply selected' })}
                      </button>
                      <button onClick={() => setWebApiPreviewOpen(false)} className="btn-secondary">{t({ it: 'Chiudi', en: 'Close' })}</button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={ldapCompareOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[132]"
          onClose={() => {
            if (ldapImporting || ldapPreviewLoading || ldapImportSelectOpen) return;
            setLdapCompareOpen(false);
          }}
          initialFocus={ldapCompareDialogFocusRef}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-6xl modal-panel">
                  <button ref={ldapCompareDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Confronto import LDAP', en: 'LDAP import comparison' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Confronta gli utenti letti da LDAP con quelli gia presenti nel contenitore locale. Il confronto usa principalmente l’indirizzo email.',
                          en: 'Compare users read from LDAP with those already present in the local container. The comparison primarily uses the email address.'
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setLdapCompareOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                      disabled={ldapImporting || ldapPreviewLoading}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={runLdapPreview}
                      disabled={ldapPreviewLoading}
                      className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                      title={t({ it: 'Ricarica il confronto LDAP', en: 'Refresh LDAP comparison' })}
                    >
                      <RefreshCw size={16} className={ldapPreviewLoading ? 'animate-spin' : ''} />
                      {ldapPreviewLoading ? t({ it: 'Confronto…', en: 'Comparing…' }) : t({ it: 'Aggiorna confronto', en: 'Refresh comparison' })}
                    </button>
                    <button
                      onClick={openLdapImportSelection}
                      disabled={ldapImporting || !ldapPreviewResult?.importableCount}
                      className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                      title={
                        ldapPreviewResult?.importableCount
                          ? t({ it: 'Apri la selezione degli utenti LDAP importabili.', en: 'Open the selection of importable LDAP users.' })
                          : t({ it: 'Esegui prima il confronto e assicurati che ci siano utenti importabili.', en: 'Run the comparison first and ensure there are importable users.' })
                      }
                    >
                      <UploadCloud size={16} />
                      {ldapImporting ? t({ it: 'Import…', en: 'Importing…' }) : t({ it: 'Importa', en: 'Import' })}
                    </button>
                    {ldapPreviewResult ? (
                      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
                          {t({ it: 'Letti da LDAP', en: 'Read from LDAP' })}: {ldapPreviewResult.remoteCount}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                          {t({ it: 'Importabili', en: 'Importable' })}: {ldapPreviewResult.importableCount}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                          {t({ it: 'Gia presenti', en: 'Already present' })}: {ldapPreviewResult.existingCount}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                          {t({ it: 'Saltati', en: 'Skipped' })}: {ldapPreviewResult.skippedCount}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {ldapPreviewLoading
                      ? t({
                          it: 'Confronto LDAP in aggiornamento: i dati precedenti sono stati scartati e stiamo leggendo di nuovo dal server.',
                          en: 'LDAP comparison is refreshing: previous data was discarded and we are reading again from the server.'
                        })
                      : ldapPreviewFetchedAt
                        ? t({
                            it: `Confronto aggiornato alle ${new Date(ldapPreviewFetchedAt).toLocaleString()}.`,
                            en: `Comparison refreshed at ${new Date(ldapPreviewFetchedAt).toLocaleString()}.`
                          })
                        : t({
                            it: 'Nessun confronto LDAP caricato in questa sessione.',
                            en: 'No LDAP comparison loaded in this session.'
                          })}
                  </div>

                  {!ldapPreviewResult && !ldapPreviewLoading ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      {t({
                        it: 'Apri il confronto per caricare utenti importabili, gia presenti e saltati in una vista separata.',
                        en: 'Open the comparison to load importable, already present, and skipped users in a separate view.'
                      })}
                    </div>
                  ) : null}

                  {ldapPreviewResult ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr),minmax(0,1fr)]">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-xs font-semibold uppercase text-emerald-700">{t({ it: 'Importabili', en: 'Importable' })}</div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-900">{ldapPreviewResult.importableCount}</div>
                        <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto text-sm text-emerald-900">
                          {ldapPreviewResult.importableRows.map((row) => (
                            <div key={`ldap-importable-${row.externalId}`} className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="font-semibold uppercase">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}</div>
                                  <div className="break-all text-xs leading-5 text-emerald-700">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLdapSelectedExternalIds([row.externalId]);
                                    setLdapImportSelectOpen(true);
                                  }}
                                  className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  <UploadCloud size={12} />
                                  {t({ it: 'Importa', en: 'Import' })}
                                </button>
                              </div>
                            </div>
                          ))}
                          {!ldapPreviewResult.importableRows.length ? <div className="text-sm text-emerald-700">{t({ it: 'Nessun nuovo utente da importare.', en: 'No new users to import.' })}</div> : null}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase text-slate-600">{t({ it: 'Gia presenti nel contenitore locale', en: 'Already present in local container' })}</div>
                        <div className="mt-1 text-2xl font-semibold text-ink">{ldapPreviewResult.existingCount}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {t({
                            it: 'Questi record non arrivano da LDAP: sono utenti gia presenti localmente e abbinati per email.',
                            en: 'These records do not come from LDAP: they are users already present locally and matched by email.'
                          })}
                        </div>
                        <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto text-sm text-slate-700">
                          {ldapPreviewResult.existingRows.map((row) => (
                            <div key={`ldap-existing-${row.externalId}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div className="font-semibold uppercase">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}</div>
                              <div className="text-xs text-slate-500">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                            </div>
                          ))}
                          {!ldapPreviewResult.existingRows.length ? <div className="text-sm text-slate-500">{t({ it: 'Nessuna sovrapposizione trovata.', en: 'No overlap found.' })}</div> : null}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-semibold uppercase text-amber-700">{t({ it: 'Saltati', en: 'Skipped' })}</div>
                        <div className="mt-1 text-2xl font-semibold text-amber-900">{ldapPreviewResult.skippedCount}</div>
                        <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto text-sm text-amber-900">
                          {ldapPreviewResult.skippedRows.map((row) => (
                            <div key={`ldap-skipped-${row.externalId}-${row.skipReason}`} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                              <div className="font-semibold uppercase">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}</div>
                              <div className="text-xs text-amber-700">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">{humanizeLdapSkipReason(row.skipReason, t)}</div>
                            </div>
                          ))}
                          {!ldapPreviewResult.skippedRows.length ? <div className="text-sm text-amber-700">{t({ it: 'Nessun utente saltato.', en: 'No skipped users.' })}</div> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={ldapImportSelectOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[133]"
          onClose={() => {
            if (ldapImporting) return;
            setLdapImportSelectOpen(false);
          }}
          initialFocus={ldapImportSelectDialogFocusRef}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl modal-panel">
                  <button ref={ldapImportSelectDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Seleziona utenti LDAP da importare', en: 'Select LDAP users to import' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Scegli solo gli utenti importabili che vuoi importare nel contenitore locale. Il backend ricontrolla comunque il dataset LDAP prima di scrivere.',
                          en: 'Choose only the importable users you want to import into the local container. The backend still rechecks the LDAP dataset before writing.'
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setLdapImportSelectOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                      disabled={ldapImporting}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={selectAllLdapImportRows} className="btn-secondary">
                      {t({ it: 'Seleziona tutti', en: 'Select all' })}
                    </button>
                    <button type="button" onClick={clearLdapImportSelection} className="btn-secondary">
                      {t({ it: 'Deseleziona tutti', en: 'Clear all' })}
                    </button>
                    <div className="ml-auto rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                      {t({
                        it: `${ldapSelectedImportableCount} selezionati su ${(ldapPreviewResult?.importableRows || []).length}`,
                        en: `${ldapSelectedImportableCount} selected out of ${(ldapPreviewResult?.importableRows || []).length}`
                      })}
                    </div>
                  </div>

                  <div className="mt-4 max-h-[60vh] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {ldapImportRowsWithDrafts.map((row) => {
                      const checked = ldapSelectedExternalIdSet.has(row.externalId);
                      const missingFields = getLdapImportMissingFields(row);
                      return (
                        <div
                          key={`ldap-import-select-${row.externalId}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${checked ? 'border-primary/30 bg-primary/5' : 'border-slate-200 bg-white'}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            checked={checked}
                            onChange={() => toggleLdapImportSelection(row.externalId)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold uppercase text-ink">
                              {`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.externalId}
                            </div>
                            <div className="truncate text-xs text-slate-500">{[row.email, row.mobile].filter(Boolean).join(' · ') || row.externalId}</div>
                            <div className="mt-1 truncate text-[11px] uppercase text-slate-500">
                              {[row.role, row.dept1, row.dept2, row.dept3].filter(Boolean).join(' · ') || row.externalId}
                            </div>
                            {missingFields.length ? (
                              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                {t({ it: 'Campi mancanti', en: 'Missing fields' })}: {missingFields.map((field) => humanizeLdapImportField(field, t)).join(', ')}
                              </div>
                            ) : null}
                          </div>
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => openLdapImportEditModal(row)}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${missingFields.length ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                              <Pencil size={14} />
                              {missingFields.length ? t({ it: 'Completa dati', en: 'Complete data' }) : t({ it: 'Modifica', en: 'Edit' })}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!ldapImportRowsWithDrafts.length ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        {t({ it: 'Nessun utente LDAP disponibile per importazione.', en: 'No LDAP users available for import.' })}
                      </div>
                    ) : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setLdapImportSelectOpen(false)} className="btn-secondary" disabled={ldapImporting}>
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={runLdapImport}
                      disabled={ldapImporting || !ldapSelectedImportableCount}
                      className="btn-primary disabled:opacity-60"
                      title={
                        ldapSelectedImportableCount
                          ? t({ it: 'Importa solo gli utenti LDAP selezionati.', en: 'Import only the selected LDAP users.' })
                          : t({ it: 'Seleziona almeno un utente da importare.', en: 'Select at least one user to import.' })
                      }
                    >
                      {ldapImporting ? t({ it: 'Import…', en: 'Importing…' }) : t({ it: 'Importa selezionati', en: 'Import selected' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!ldapImportEditRowId} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[134]"
          onClose={() => {
            if (ldapImporting) return;
            setLdapImportEditRowId(null);
          }}
          initialFocus={ldapImportEditDialogFocusRef}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <button ref={ldapImportEditDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Completa dati utente LDAP', en: 'Complete LDAP user data' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Questi valori vengono applicati solo all’import corrente dei record selezionati.',
                          en: 'These values are applied only to the current import of the selected records.'
                        })}
                      </div>
                    </div>
                    <button onClick={() => setLdapImportEditRowId(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      { key: 'firstName', label: t({ it: 'Nome', en: 'First name' }), placeholder: 'MARIO' },
                      { key: 'lastName', label: t({ it: 'Cognome', en: 'Last name' }), placeholder: 'ROSSI' },
                      { key: 'email', label: 'Email', placeholder: 'mario.rossi@example.com' },
                      { key: 'mobile', label: t({ it: 'Cellulare', en: 'Mobile' }), placeholder: '+39...' },
                      { key: 'role', label: t({ it: 'Ruolo', en: 'Role' }), placeholder: 'TECNICO' },
                      { key: 'dept1', label: 'Reparto 1', placeholder: 'IT' },
                      { key: 'dept2', label: 'Reparto 2', placeholder: '' },
                      { key: 'dept3', label: 'Reparto 3', placeholder: '' }
                    ].map((field) => (
                      <label key={field.key} className="block text-sm font-medium text-slate-700">
                        {field.label}
                        <input
                          value={(ldapImportEditForm as Record<string, string>)[field.key] || ''}
                          onChange={(e) =>
                            setLdapImportEditForm((prev) => ({
                              ...prev,
                              [field.key]:
                                field.key === 'email'
                                  ? normalizeImportEmailInput(e.target.value)
                                  : field.key === 'mobile'
                                    ? normalizeImportMobileInput(e.target.value)
                                    : normalizeUpperInput(e.target.value)
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          placeholder={field.placeholder}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {t({
                      it: 'Nome, cognome, ruolo e reparti vengono salvati in maiuscolo. Email viene normalizzata in minuscolo, telefono senza spazi.',
                      en: 'First name, last name, role, and departments are stored in uppercase. Email is normalized to lowercase, phone without spaces.'
                    })}
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setLdapImportEditRowId(null)} className="btn-secondary">
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button type="button" onClick={saveLdapImportEdit} className="btn-primary">
                      {t({ it: 'Salva dati', en: 'Save data' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={usersOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[125]"
          onClose={() => {
            if (usersChildDialogOpen) return;
            setUsersOpen(false);
          }}
          initialFocus={usersDialogFocusRef}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-7xl modal-panel">
                  <button ref={usersDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Utenti importati', en: 'Imported users' })}</Dialog.Title>
                      <div className="modal-description">{activeClient ? activeClient.name : ''}</div>
                    </div>
                    <button onClick={() => setUsersOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={usersQuery}
                        onChange={(e) => setUsersQuery(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-primary"
                        placeholder={t({ it: 'Cerca per nome, reparto, email, cellulare…', en: 'Search by name, dept, email, mobile…' })}
                        autoFocus
                      />
                    </div>
                    <label
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      title={t({
                        it: 'Mostra anche gli utenti che risultano mancanti nell’ultima importazione (non più presenti nella sorgente).',
                        en: 'Also show users marked as missing in the latest import (no longer present in the source).'
                      })}
                    >
                      <input type="checkbox" checked={includeMissing} onChange={(e) => setIncludeMissing(e.target.checked)} />
                      {t({ it: 'Includi mancanti', en: 'Include missing' })}
                    </label>
                    <label
                      className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
                      title={t({
                        it: 'Mostra solo gli utenti mancanti per decidere se includerli o escluderli dal contenitore utenti.',
                        en: 'Show only missing users so you can include or exclude them from the user container.'
                      })}
                    >
                      <input
                        type="checkbox"
                        checked={onlyMissing}
                        onChange={(e) => {
                          setOnlyMissing(e.target.checked);
                          if (e.target.checked) setIncludeMissing(true);
                        }}
                      />
                      {t({ it: 'Solo mancanti', en: 'Only missing' })}
                    </label>
                    <button
                      type="button"
                      onClick={openManualUserCreate}
                      disabled={!activeClientId}
                      className="flex h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                      title={t({ it: 'Aggiungi utente manuale', en: 'Add manual user' })}
                    >
                      <Plus size={16} />
                      {t({ it: 'Nuovo manuale', en: 'New manual' })}
                    </button>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="max-h-[55vh] overflow-auto">
                      {usersLoading ? <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</div> : null}
                      {!usersLoading && !sortedUsers.length ? (
                        <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div>
                      ) : null}
                      {!usersLoading && sortedUsers.length ? (
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3 text-left" title={t({ it: 'Nome completo utente (badge: manuale, mancante, nascosto, duplicato).', en: 'User full name (badges: manual, missing, hidden, duplicate).' })}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev) => ({
                                      key: 'name',
                                      dir: prev.key === 'name' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                >
                                  {t({ it: 'Nome', en: 'Name' })}
                                  {usersSortState.key === 'name' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left" title={t({ it: 'Email e/o cellulare associati all’utente importato.', en: 'Email and/or mobile associated with the imported user.' })}>
                                {t({ it: 'Email / Cellulare', en: 'Email / Mobile' })}
                              </th>
                              <th className="px-3 py-3 text-left" title={t({ it: 'ID esterno della sorgente importazione (WebAPI/CSV/Manuale).', en: 'External ID from the import source (WebAPI/CSV/Manual).' })}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev) => ({
                                      key: 'id',
                                      dir: prev.key === 'id' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                >
                                  {t({ it: 'ID', en: 'ID' })}
                                  {usersSortState.key === 'id' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-left" title={t({ it: 'Ruolo e reparti importati per l’utente.', en: 'Imported role and departments for the user.' })}>
                                {t({ it: 'Ruolo / Reparto', en: 'Role / Dept' })}
                              </th>
                              <th className="px-3 py-3 text-center" title={t({ it: 'Numero di assegnazioni in planimetria (utenti reali collegati a postazioni/stanze). Clicca per ordinare.', en: 'Number of floor-plan allocations (real users linked to seats/rooms). Click to sort.' })}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev) => ({
                                      key: 'alloc',
                                      dir: prev.key === 'alloc' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                >
                                  {t({ it: 'Alloc.', en: 'Alloc.' })}
                                  {usersSortState.key === 'alloc' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUsersSortState((prev) => ({
                                      key: 'hidden',
                                      dir: prev.key === 'hidden' && prev.dir === 'asc' ? 'desc' : 'asc'
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-ink"
                                  title={t({ it: 'Ordina per visibilità (occhio barrato = nascosto)', en: 'Sort by visibility (slashed eye = hidden)' })}
                                >
                                  {t({ it: 'Vis.', en: 'Vis.' })}
                                  {usersSortState.key === 'hidden' ? <span>{usersSortState.dir === 'asc' ? '▲' : '▼'}</span> : null}
                                </button>
                              </th>
                              <th className="px-3 py-3 text-center" title={t({ it: 'Stato dell’utente del portale collegato all’utente importato.', en: 'Status of the portal user linked to the imported user.' })}>
                                {t({ it: 'Portale', en: 'Portal' })}
                              </th>
                              <th className="px-4 py-3 text-right" title={t({ it: 'Azioni disponibili sul record locale: modifica per tutti gli utenti, eliminazione solo per i manuali, creazione utente portale e gestione visibilità nel contenitore.', en: 'Actions available on the local record: edit for all users, deletion only for manual ones, portal-user creation, and visibility control in the container.' })}>
                                {t({ it: 'Azioni', en: 'Actions' })}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedUsers.map((r) => {
                              const count = assignedCounts.get(`${r.clientId}:${r.externalId}`) || 0;
                              const displayName = `${String(r.firstName || '').trim()} ${String(r.lastName || '').trim()}`.trim() || r.email || r.externalId;
                              const contact = [r.email, r.mobile].filter(Boolean).join(' · ') || '—';
                              const deptLabel = [r.dept1, r.dept2, r.dept3].filter(Boolean).join(' / ');
                              const linkedPortalUser = portalUserByImportedKey.get(`${r.clientId}:${r.externalId}`) || null;
                              return (
                                <tr key={r.externalId} className="border-t border-slate-200 align-top">
                                  <td className="px-4 py-3">
                                    <div className="min-w-[260px]">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-ink">{displayName}</span>
                                        {(r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:')) ? (
                                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                            {t({ it: 'Manuale', en: 'Manual' })}
                                          </span>
                                        ) : null}
                                        {!r.present ? (
                                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                            {t({ it: 'Mancante', en: 'Missing' })}
                                          </span>
                                        ) : null}
                                        {r.hidden ? (
                                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                            {t({ it: 'Nascosto', en: 'Hidden' })}
                                          </span>
                                        ) : null}
                                        {duplicateUserKeys.has(`${r.clientId}:${r.externalId}`) ? (
                                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                            {t({ it: 'Duplicato', en: 'Duplicate' })}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-xs text-slate-600">{contact}</td>
                                  <td className="px-3 py-3 font-mono text-xs text-slate-700">{r.externalId}</td>
                                  <td className="px-3 py-3">
                                    <div className="text-xs text-slate-700">{r.role || '—'}</div>
                                    <div className="text-[11px] text-slate-500">{deptLabel || '—'}</div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span
                                      className={`inline-flex min-w-[56px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                        count > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}
                                      title={t({
                                        it:
                                          count > 0
                                            ? `${count} assegnazioni in planimetria`
                                            : 'Nessuna assegnazione in planimetria',
                                        en:
                                          count > 0
                                            ? `${count} floor-plan allocations`
                                            : 'No floor-plan allocations'
                                      })}
                                    >
                                      {count > 0
                                        ? t({ it: `${count} assegn.`, en: `${count} alloc.` })
                                        : t({ it: 'Nessuna', en: 'None' })}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center text-slate-500" title={r.hidden ? t({ it: 'Nascosto', en: 'Hidden' }) : t({ it: 'Visibile', en: 'Visible' })}>
                                    {r.hidden ? <EyeOff size={15} className="mx-auto" /> : <Eye size={15} className="mx-auto" />}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {linkedPortalUser ? (
                                      <div className="inline-flex flex-col items-center gap-1">
                                        <span
                                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                            linkedPortalUser.mustChangePassword
                                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          }`}
                                          title={
                                            linkedPortalUser.mustChangePassword
                                              ? t({ it: 'Creato ma non ancora attivato al primo login', en: 'Created but not activated yet on first login' })
                                              : t({ it: 'Utente portale gia attivo', en: 'Portal user already active' })
                                          }
                                        >
                                          {linkedPortalUser.mustChangePassword
                                            ? t({ it: 'Da attivare', en: 'Pending' })
                                            : t({ it: 'Attivo', en: 'Active' })}
                                        </span>
                                        <span className="max-w-[150px] truncate text-[11px] text-slate-500" title={linkedPortalUser.username}>
                                          {linkedPortalUser.username}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                        {portalUsersLoading ? t({ it: 'Verifica…', en: 'Checking…' }) : t({ it: 'Assente', en: 'Missing' })}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => openManualUserEdit(r)}
                                        className="btn-inline"
                                        title={
                                          (r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:'))
                                            ? t({ it: 'Modifica questo utente manuale nel contenitore locale. Puoi cambiare dati anagrafici, contatti, ruolo e reparti.', en: 'Edit this manual user in the local container. You can change profile data, contacts, role, and departments.' })
                                            : t({ it: 'Modifica questo utente importato nel contenitore locale. Attenzione: un futuro reimport dalla sorgente può sovrascrivere questi dati.', en: 'Edit this imported user in the local container. Warning: a future reimport from the source may overwrite these values.' })
                                        }
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      {(r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:')) ? (
                                        <button
                                          type="button"
                                          onClick={() => setManualDeleteCandidate(r)}
                                          disabled={manualUserDeletingId === r.externalId}
                                          className="btn-inline text-rose-700 hover:bg-rose-50"
                                          title={t({ it: 'Elimina definitivamente questo utente manuale dal contenitore locale. Questa azione non è disponibile per gli utenti importati.', en: 'Permanently delete this manual user from the local container. This action is not available for imported users.' })}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => openPortalProvisionModal(r)}
                                        disabled={!!linkedPortalUser || portalUsersLoading}
                                        className={`btn-inline ${linkedPortalUser ? 'cursor-not-allowed opacity-50' : 'text-primary hover:bg-primary/10'}`}
                                        title={
                                          linkedPortalUser
                                            ? t({ it: `Questo utente importato è già collegato all’utente portale ${linkedPortalUser.username}. Non serve crearne un altro.`, en: `This imported user is already linked to portal user ${linkedPortalUser.username}. There is no need to create another one.` })
                                            : t({ it: 'Crea un utente portale collegato a questo record importato, così la persona può accedere al portale.', en: 'Create a portal user linked to this imported record so the person can access the portal.' })
                                        }
                                      >
                                        <UserPlus size={13} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!activeClientId) return;
                                          try {
                                            await setExternalUserHidden({ clientId: activeClientId, externalId: r.externalId, hidden: !r.hidden });
                                            await loadUsers(activeClientId);
                                            push(t({ it: 'Aggiornato', en: 'Updated' }), 'success');
                                          } catch {
                                            push(t({ it: 'Errore', en: 'Error' }), 'danger');
                                          }
                                        }}
                                        className="btn-inline"
                                        title={
                                          !r.present
                                            ? r.hidden
                                              ? t({ it: 'Il record è mancante dalla sorgente e nascosto. Clicca per reincluderlo visivamente nel contenitore locale.', en: 'The record is missing from the source and hidden. Click to include it again visually in the local container.' })
                                              : t({ it: 'Il record è mancante dalla sorgente ma ancora visibile. Clicca per escluderlo dalla vista del contenitore locale.', en: 'The record is missing from the source but still visible. Click to exclude it from the local container view.' })
                                            : r.hidden
                                              ? t({ it: 'Mostra di nuovo questo utente nel contenitore locale senza cancellarlo.', en: 'Show this user again in the local container without deleting it.' })
                                              : t({ it: 'Nascondi questo utente nel contenitore locale senza cancellarlo.', en: 'Hide this user in the local container without deleting it.' })
                                        }
                                      >
                                        {r.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : null}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      onClick={() => setUsersOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Chiudi la lista utenti importati', en: 'Close imported users list' })}
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                    <div />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={portalProvisionModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[140]"
          initialFocus={portalProvisionDialogFocusRef}
          onClose={() => {
            if (portalProvisionSaving) return;
            setPortalProvisionModalOpen(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <button ref={portalProvisionDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Crea utente portale', en: 'Create portal user' })}</Dialog.Title>
                      <div className="modal-description">
                        {portalProvisionSourceUser
                          ? `${String(portalProvisionSourceUser.firstName || '').trim()} ${String(portalProvisionSourceUser.lastName || '').trim()}`.trim() ||
                            portalProvisionSourceUser.email ||
                            portalProvisionSourceUser.externalId
                          : ''}
                      </div>
                    </div>
                    <button onClick={() => setPortalProvisionModalOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Username', en: 'Username' })}
                      <input
                        value={portalProvisionForm.username}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, username: e.target.value.toLowerCase() }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="mario.rossi"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Lingua iniziale', en: 'Initial language' })}
                      <select
                        value={portalProvisionForm.language}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, language: e.target.value === 'en' ? 'en' : 'it' }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="it">Italiano</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Nome', en: 'First name' })}
                      <input
                        value={portalProvisionForm.firstName}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Cognome', en: 'Last name' })}
                      <input
                        value={portalProvisionForm.lastName}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, lastName: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Email
                      <input
                        value={portalProvisionForm.email}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Telefono', en: 'Phone' })}
                      <input
                        value={portalProvisionForm.phone}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Accesso sul cliente', en: 'Client access' })}
                      <select
                        value={portalProvisionForm.access}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, access: e.target.value === 'rw' ? 'rw' : 'ro' }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="ro">{t({ it: 'Sola lettura', en: 'Read only' })}</option>
                        <option value="rw">{t({ it: 'Lettura / scrittura', en: 'Read / write' })}</option>
                      </select>
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-800">{t({ it: 'Provisioning automatico', en: 'Automatic provisioning' })}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {t({
                          it: 'La password temporanea viene generata dal server, mostrata una sola volta e l’utente sara obbligato a cambiarla al primo login.',
                          en: 'The temporary password is generated server-side, shown only once, and the user will be forced to change it on first login.'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={portalProvisionForm.chat}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, chat: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      {t({ it: 'Abilita chat sul cliente', en: 'Enable client chat' })}
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={portalProvisionForm.canCreateMeetings}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, canCreateMeetings: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      {t({ it: 'Puo creare meeting in autonomia', en: 'Can create meetings autonomously' })}
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={portalProvisionForm.sendEmail}
                        disabled={!String(portalProvisionForm.email || '').trim()}
                        onChange={(e) => setPortalProvisionForm((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <Mail size={15} />
                      {t({ it: 'Invia credenziali via email', en: 'Send credentials by email' })}
                    </label>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Se configurato, verra usato prima l’SMTP del cliente e in fallback quello globale del portale.',
                        en: 'If configured, the client SMTP is used first, then the global portal SMTP as fallback.'
                      })}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setPortalProvisionModalOpen(false)}
                      className="btn-secondary"
                      disabled={portalProvisionSaving}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitPortalProvision()}
                      className="btn-primary inline-flex items-center gap-2"
                      disabled={portalProvisionSaving}
                    >
                      <UserPlus size={15} />
                      {portalProvisionSaving ? t({ it: 'Creazione…', en: 'Creating…' }) : t({ it: 'Crea utente', en: 'Create user' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!portalProvisionResult} as={Fragment}>
        <Dialog as="div" className="relative z-[145]" initialFocus={portalProvisionResultFocusRef} onClose={() => setPortalProvisionResult(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl modal-panel">
                  <button ref={portalProvisionResultFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Credenziali temporanee generate', en: 'Temporary credentials generated' })}</Dialog.Title>
                      <div className="modal-description">{portalProvisionResult?.importedDisplayName || ''}</div>
                    </div>
                    <button onClick={() => setPortalProvisionResult(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Username', en: 'Username' })}</div>
                      <div className="mt-1 text-base font-semibold text-ink">{portalProvisionResult?.username}</div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <div className="text-xs font-semibold uppercase text-amber-700">{t({ it: 'Password temporanea', en: 'Temporary password' })}</div>
                      <div className="mt-1 break-all font-mono text-base font-semibold text-amber-900">{portalProvisionResult?.temporaryPassword}</div>
                      <div className="mt-1 text-xs text-amber-800">
                        {t({
                          it: 'Visibile solo ora. Al primo accesso l’utente dovra cambiarla obbligatoriamente.',
                          en: 'Visible only now. On first login the user will be forced to change it.'
                        })}
                      </div>
                    </div>
                    <div
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        portalProvisionResult?.emailDelivery.sent
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : portalProvisionResult?.emailDelivery.attempted
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {portalProvisionResult?.emailDelivery.sent
                        ? t({ it: 'Le credenziali sono state inviate via email.', en: 'Credentials were sent by email.' })
                        : portalProvisionResult?.emailDelivery.attempted
                          ? t({
                              it: `Utente creato, ma l’invio email non e riuscito (${humanizeProvisionMailReason(String(portalProvisionResult.emailDelivery.reason || ''), t)}).`,
                              en: `User created, but email delivery failed (${humanizeProvisionMailReason(String(portalProvisionResult.emailDelivery.reason || ''), t)}).`
                            })
                          : t({ it: 'Invio email non richiesto.', en: 'Email delivery not requested.' })}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => void copyPortalProvisionSecret('password')} className="btn-secondary inline-flex items-center gap-2">
                      <Copy size={14} />
                      {t({ it: 'Copia password', en: 'Copy password' })}
                    </button>
                    <button type="button" onClick={() => void copyPortalProvisionSecret('credentials')} className="btn-primary inline-flex items-center gap-2">
                      <Copy size={14} />
                      {t({ it: 'Copia credenziali', en: 'Copy credentials' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={manualUserModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[140]"
          initialFocus={manualUserDialogFocusRef}
          onClose={() => {
            if (manualUserSaving) return;
            setManualUserModalOpen(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl modal-panel">
                  <button ref={manualUserDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">
                        {manualUserEditingId
                          ? manualUserEditingKind === 'imported'
                            ? t({ it: 'Modifica utente importato', en: 'Edit imported user' })
                            : t({ it: 'Modifica utente manuale', en: 'Edit manual user' })
                          : t({ it: 'Nuovo utente manuale', en: 'New manual user' })}
                      </Dialog.Title>
                      <div className="modal-description">
                        {manualUserEditingId && manualUserEditingKind === 'imported'
                          ? t({
                              it: `Stai modificando un utente importato già presente nel contenitore locale di ${activeClient ? activeClient.name : ''}. Questa modifica è locale: un futuro reimport da LDAP/WebAPI/CSV può sovrascriverla.`,
                              en: `You are editing an imported user already present in the local container of ${activeClient ? activeClient.name : ''}. This is a local edit: a future LDAP/WebAPI/CSV reimport may overwrite it.`
                            })
                          : activeClient
                            ? activeClient.name
                            : ''}
                      </div>
                    </div>
                    <button onClick={() => setManualUserModalOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      { key: 'externalId', label: 'External ID', placeholder: 'manual:...' },
                      { key: 'firstName', label: t({ it: 'Nome', en: 'First name' }), placeholder: 'Mario' },
                      { key: 'lastName', label: t({ it: 'Cognome', en: 'Last name' }), placeholder: 'Rossi' },
                      { key: 'email', label: 'Email', placeholder: 'mario.rossi@example.com' },
                      { key: 'mobile', label: t({ it: 'Cellulare', en: 'Mobile' }), placeholder: '+39...' },
                      { key: 'role', label: t({ it: 'Ruolo', en: 'Role' }), placeholder: t({ it: 'Tecnico', en: 'Technician' }) },
                      { key: 'dept1', label: 'Reparto 1', placeholder: 'IT' },
                      { key: 'dept2', label: 'Reparto 2', placeholder: '' },
                      { key: 'dept3', label: 'Reparto 3', placeholder: '' },
                      { key: 'ext1', label: 'Interno 1', placeholder: '' },
                      { key: 'ext2', label: 'Interno 2', placeholder: '' },
                      { key: 'ext3', label: 'Interno 3', placeholder: '' }
                    ].map((field) => (
                      <label key={field.key} className="block text-sm font-medium text-slate-700">
                        {field.label}
                        <input
                          value={(manualUserForm as any)[field.key] || ''}
                          onChange={(e) => setManualUserForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          disabled={field.key === 'externalId' && !!manualUserEditingId}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder={field.placeholder}
                          title={
                            field.key === 'externalId'
                              ? t({ it: 'Identificativo tecnico del record nel contenitore locale. In modifica non è editabile per evitare di rompere i collegamenti esistenti.', en: 'Technical identifier of the record in the local container. In edit mode it is locked to avoid breaking existing links.' })
                              : t({ it: `Campo ${field.label}. Il valore viene salvato nel contenitore locale del cliente.`, en: `${field.label} field. The value is saved in the client local container.` })
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={manualUserForm.isExternal}
                        onChange={(e) => setManualUserForm((prev) => ({ ...prev, isExternal: e.target.checked }))}
                      />
                      {t({ it: 'Utente esterno', en: 'External user' })}
                    </label>
                    <div className="mt-1 text-xs text-slate-500">
                      {(manualUserEditingId && manualUserEditingKind === 'imported')
                        ? t({
                            it: 'Stai modificando un record importato. Il record resta collegato al suo external ID originale e può essere aggiornato di nuovo da una futura sincronizzazione della sorgente.',
                            en: 'You are editing an imported record. The record stays linked to its original external ID and may be updated again by a future source synchronization.'
                          })
                        : t({
                            it: 'Puoi lasciare vuoto External ID in creazione: verrà generato automaticamente con prefisso manual:.',
                            en: 'You can leave External ID empty on creation: it will be generated automatically with manual: prefix.'
                          })}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setManualUserModalOpen(false)}
                      className="btn-secondary"
                      disabled={manualUserSaving}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={saveManualUser}
                      disabled={manualUserSaving || !activeClientId}
                      className="btn-primary disabled:opacity-60"
                      title={
                        manualUserEditingId
                          ? manualUserEditingKind === 'imported'
                            ? t({ it: 'Salva le modifiche locali su questo utente importato nel contenitore del cliente.', en: 'Save the local changes for this imported user in the client container.' })
                            : t({ it: 'Salva le modifiche su questo utente manuale.', en: 'Save the changes for this manual user.' })
                          : t({ it: 'Crea un nuovo utente manuale nel contenitore del cliente.', en: 'Create a new manual user in the client container.' })
                      }
                    >
                      {manualUserSaving ? t({ it: 'Salvataggio…', en: 'Saving…' }) : t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={csvConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[130]" onClose={() => setCsvConfirmOpen(false)} initialFocus={csvConfirmDialogFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <button ref={csvConfirmDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Import CSV', en: 'CSV import' })}</Dialog.Title>
                    <button onClick={() => setCsvConfirmOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="modal-description">
                    {t({
                      it: 'Come vuoi gestire gli utenti del CSV? Puoi sommarli agli esistenti oppure sostituire tutto (rimuove anche gli utenti reali dalla mappa).',
                      en: 'How do you want to handle CSV users? You can append to existing users or replace everything (also removes real users from the map).'
                    })}
                  </div>
                  {csvFile ? <div className="mt-3 text-xs text-slate-500">{csvFile.name}</div> : null}
                  <div className="modal-footer">
                    <button
                      onClick={() => setCsvConfirmOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Annulla import CSV', en: 'Cancel CSV import' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={() => runCsvImport('append')}
                      disabled={csvImporting}
                      className="btn-secondary disabled:opacity-60"
                      title={t({ it: 'Somma utenti del CSV', en: 'Append CSV users' })}
                    >
                      {t({ it: 'Somma utenti', en: 'Append users' })}
                    </button>
                    <button
                      onClick={() => runCsvImport('replace')}
                      disabled={csvImporting}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                      title={t({ it: 'Sostituisci tutti gli utenti con il CSV', en: 'Replace all users with CSV' })}
                    >
                      {t({ it: 'Sostituisci tutto', en: 'Replace all' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={ldapInfoOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[135]" onClose={() => setLdapInfoOpen(false)} initialFocus={ldapInfoDialogFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl modal-panel">
                  <button ref={ldapInfoDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Guida completa configurazione LDAP', en: 'Full LDAP configuration guide' })}</Dialog.Title>
                      <div className="modal-description">
                        {t({
                          it: 'Questa guida spiega in modo semplice a cosa serve ogni campo LDAP e come influisce su test, confronto e import.',
                          en: 'This guide explains in simple terms what each LDAP field does and how it affects test, compare, and import.'
                        })}
                      </div>
                    </div>
                    <button onClick={() => setLdapInfoOpen(false)} className="icon-button" title={t({ it: 'Chiudi guida LDAP', en: 'Close LDAP guide' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 max-h-[70vh] space-y-4 overflow-auto pr-1 text-sm text-slate-700">
                    {[
                      [t({ it: 'Server LDAP', en: 'LDAP server' }), t({ it: 'Indirizzo del server LDAP. Può essere un hostname o un URL ldap:// / ldaps://.', en: 'Address of the LDAP server. It can be a hostname or an ldap:// / ldaps:// URL.' })],
                      [t({ it: 'Porta', en: 'Port' }), t({ it: 'Porta TCP del server. Di solito 636 per LDAPS e 389 per LDAP o StartTLS.', en: 'TCP port of the server. Usually 636 for LDAPS and 389 for LDAP or StartTLS.' })],
                      [t({ it: 'Sicurezza trasporto', en: 'Transport security' }), t({ it: 'Decide se la connessione è cifrata subito con LDAPS, alzata poi con StartTLS oppure lasciata in LDAP semplice.', en: 'Decides whether the connection is encrypted immediately with LDAPS, upgraded with StartTLS, or left as plain LDAP.' })],
                      [t({ it: 'Scope ricerca', en: 'Search scope' }), t({ it: 'Decide quanto in profondità cercare dal Base DN: solo figli diretti oppure tutta la subtree.', en: 'Decides how deep to search from the Base DN: only direct children or the whole subtree.' })],
                      [t({ it: 'Autenticazione', en: 'Authentication' }), t({ it: 'Decide come costruire l’identità del bind: Simple usa solo Utente, Dominio\\utente usa entrambi i campi, utente@dominio costruisce la UPN, Anonima non usa credenziali.', en: 'Decides how to build the bind identity: Simple uses only User, Domain\\user uses both fields, user@domain builds the UPN, Anonymous uses no credentials.' })],
                      [t({ it: 'Dominio', en: 'Domain' }), t({ it: 'Serve solo per Dominio\\utente e utente@dominio. In simple bind e anonima può restare vuoto.', en: 'Used only for Domain\\user and user@domain. It can stay empty for simple bind and anonymous.' })],
                      [t({ it: 'Utente', en: 'User' }), t({ it: 'Nome dell’account LDAP usato per il bind.', en: 'Name of the LDAP account used for bind.' })],
                      [t({ it: 'Password', en: 'Password' }), t({ it: 'Password dell’account LDAP. Se la lasci vuota durante una modifica, viene mantenuta quella già salvata.', en: 'Password of the LDAP account. If you leave it empty while editing, the previously saved one is kept.' })],
                      [t({ it: 'Base DN', en: 'Base DN' }), t({ it: 'Punto di partenza della ricerca LDAP, per esempio DC=example,DC=com oppure OU=People,DC=example,DC=com.', en: 'Starting point of the LDAP search, for example DC=example,DC=com or OU=People,DC=example,DC=com.' })],
                      [t({ it: 'Filtro utenti LDAP', en: 'LDAP user filter' }), t({ it: 'Filtro RFC4515 che restringe quali oggetti leggere dentro il Base DN. Se è troppo largo, leggerai più record del necessario.', en: 'RFC4515 filter that restricts which objects are read inside the Base DN. If it is too broad, you will read more records than necessary.' })],
                      [t({ it: 'Campi Email / Nome / Cognome / External ID / Ruolo / Mobile / Dipartimento', en: 'Email / First name / Last name / External ID / Role / Mobile / Department fields' }), t({ it: 'Qui scrivi i nomi degli attributi LDAP da leggere, non i valori utente. Esempio: mail, givenName, sn, sAMAccountName, title, mobile, department.', en: 'Here you write the names of the LDAP attributes to read, not the user values. Example: mail, givenName, sn, sAMAccountName, title, mobile, department.' })],
                      [t({ it: 'Max utenti', en: 'Max users' }), t({ it: 'Limite massimo di record letti da LDAP in confronto e import. Il test connessione legge comunque solo un campione fino a 25 utenti.', en: 'Maximum number of records read from LDAP during compare and import. Connection test still reads only a sample up to 25 users.' })],
                      [t({ it: 'Sicurezza operativa', en: 'Operational security' }), t({ it: 'L’integrazione LDAP è solo in lettura. Il backend usa solo bind, search e unbind. Non esistono scritture verso LDAP.', en: 'The LDAP integration is read-only. The backend only uses bind, search, and unbind. There are no writes sent to LDAP.' })]
                    ].map(([title, body]) => (
                      <div key={String(title)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="font-semibold text-ink">{title}</div>
                        <div className="mt-1 text-slate-600">{body}</div>
                      </div>
                    ))}
                  </div>
                  <div className="modal-footer">
                    <button type="button" onClick={() => setLdapInfoOpen(false)} className="btn-primary">
                      {t({ it: 'Chiudi guida', en: 'Close guide' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={infoOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[135]" onClose={() => setInfoOpen(false)} initialFocus={infoDialogFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <button ref={infoDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Info cliente', en: 'Client info' })}</Dialog.Title>
                    <button onClick={() => setInfoOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <div>
                      <div className="text-xs uppercase text-slate-500">{t({ it: 'Nome', en: 'Name' })}</div>
                      <div className="font-semibold text-ink">{infoClient?.name || infoClient?.shortName || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-500">ID</div>
                      <div className="font-mono text-xs text-slate-600">{infoClient?.id || '—'}</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Sedi', en: 'Sites' })}</div>
                        <div className="font-semibold text-ink">{infoCounts.sites}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Planimetrie', en: 'Floor plans' })}</div>
                        <div className="font-semibold text-ink">{infoCounts.plans}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-500">{t({ it: 'Ultimo import', en: 'Last import' })}</div>
                      <div className="text-slate-600">{formatDate(infoSummary?.lastImportAt)}</div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setInfoOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Chiudi le info cliente', en: 'Close client info' })}
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmDialog
        open={!!manualDeleteCandidate}
        title={t({ it: 'Rimuovere utente manuale?', en: 'Delete manual user?' })}
        description={
          manualDeleteCandidate
            ? t({
                it: `Confermi la rimozione di ${`${manualDeleteCandidate.firstName || ''} ${manualDeleteCandidate.lastName || ''}`.trim() || manualDeleteCandidate.externalId}?`,
                en: `Confirm deletion of ${`${manualDeleteCandidate.firstName || ''} ${manualDeleteCandidate.lastName || ''}`.trim() || manualDeleteCandidate.externalId}?`
              })
            : undefined
        }
        confirmLabel={t({ it: 'Rimuovi', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setManualDeleteCandidate(null)}
        onConfirm={async () => {
          const row = manualDeleteCandidate;
          setManualDeleteCandidate(null);
          if (!row) return;
          await removeManualUser(row);
        }}
      />

      <ConfirmDialog
        open={duplicatesModalOpen}
        title={t({ it: 'Possibili duplicati rilevati', en: 'Possible duplicates detected' })}
        description={t({
          it: 'Sono presenti utenti con stessa email o stesso nome+cognome (quando la mail manca). Apri la lista filtrata sui duplicati per decidere come gestirli.',
          en: 'Some users share the same email or the same first+last name (when email is missing). Open the list filtered to duplicates to decide how to handle them.'
        })}
        confirmLabel={t({ it: 'Apri duplicati', en: 'Open duplicates' })}
        cancelLabel={t({ it: 'Chiudi', en: 'Close' })}
        onCancel={() => setDuplicatesModalOpen(false)}
        onConfirm={async () => {
          setDuplicatesModalOpen(false);
          if (!activeClientId) return;
          await openUsers(activeClientId);
        }}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        title={t({ it: 'Eliminare tutti gli utenti importati?', en: 'Delete all imported users?' })}
        description={t({
          it: `Procedendo verranno eliminati ${activeSummary?.total ?? 0} utenti importati per questo cliente e rimossi gli oggetti “Utente reale” dalle planimetrie. Operazione non annullabile.`,
          en: `This will delete ${activeSummary?.total ?? 0} imported users for this client and remove all “Real user” objects from floor plans. This cannot be undone.`
        })}
        confirmLabel={t({ it: 'Elimina tutto', en: 'Delete all' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={async () => {
          setClearConfirmOpen(false);
          await clearImportData();
        }}
      />
    </div>
  );
};

export default CustomImportPanel;
