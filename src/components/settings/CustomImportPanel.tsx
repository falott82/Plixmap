import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FileDown, Info, Plus, RefreshCw, Settings2, UploadCloud, Users, X } from 'lucide-react';
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
import {
  normalizeSearchText,
  comparePeopleByName,
  matchesImportUserQuery,
  suggestPortalUsername,
  toWebApiConfigPayload,
  normalizeUpperInput,
  normalizeImportEmailInput,
  normalizeImportMobileInput,
  mergeLdapImportDraft,
  formatLdapActionError,
  computeDuplicateGroups,
  rowsHaveDuplicates,
  filterImportUsers,
  sortImportUsers,
  buildWebApiVariationRows
} from './CustomImportPanel.helpers';
import { CustomImportWebApiPreviewModal } from './CustomImportWebApiPreviewModal';
import { CustomImportLdapCompareModal } from './CustomImportLdapCompareModal';
import { CustomImportUsersModal } from './CustomImportUsersModal';
import { CustomImportPortalProvisionModal } from './CustomImportPortalProvisionModal';
import { CustomImportManualUserModal } from './CustomImportManualUserModal';
import { CustomImportLdapImportSelectModal } from './CustomImportLdapImportSelectModal';
import { CustomImportLdapEditRowModal } from './CustomImportLdapEditRowModal';
import { CustomImportPortalProvisionResultModal } from './CustomImportPortalProvisionResultModal';
import { CustomImportCsvLdapInfoModals } from './CustomImportCsvLdapInfoModals';
import { CustomImportConfigModal } from './CustomImportConfigModal';

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
  const duplicateGroups = useMemo(() => computeDuplicateGroups(usersRows), [usersRows]);
  const hasDuplicatesInRows = useCallback((rows: ExternalUserRow[]) => rowsHaveDuplicates(rows), []);
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

  const filteredUsers = useMemo(
    () => filterImportUsers(usersRows, usersQuery, includeMissing, onlyMissing),
    [includeMissing, onlyMissing, usersQuery, usersRows]
  );

  const sortedUsers = useMemo(
    () => sortImportUsers(filteredUsers, usersSortState, assignedCounts),
    [assignedCounts, filteredUsers, usersSortState]
  );

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

  const webApiVariationRows = useMemo(
    () => buildWebApiVariationRows(webApiPreviewRemoteRows, webApiMissingExistingRows, webApiPreviewFilter, webApiPreviewRightQuery),
    [webApiMissingExistingRows, webApiPreviewFilter, webApiPreviewRightQuery, webApiPreviewRemoteRows]
  );

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
                  Add
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

      <CustomImportConfigModal {...{ configOpen, lockClientSelection, formatDate, activeClient, activeClientId, activeSummary, canClearWebApiImport, canRunWebApiTest, canSaveWebApiSettings, cfg, clearing, configChildDialogOpen, configDialogFocusRef, configExpanded, csvFile, csvImporting, downloadCsvTemplate, handleCsvFile, importMode, ldapCfg, ldapConfigTab, ldapImporting, ldapImportResult, ldapPassword, ldapPreviewLoading, ldapPreviewResult, ldapTesting, ldapTestResult, manualRowsCount, openLdapCompareModal, openLdapImportSelection, openManualUserCreate, openUsers, password, runLdapTest, runTest, saveConfig, saveLdapConfigHandler, savingCfg, savingLdapCfg, syncResult, testResult, testing, usersOpen, setCfg, setClearConfirmOpen, setConfigExpanded, setConfigOpen, setImportMode, setIncludeMissing, setLdapCfg, setLdapConfigTab, setLdapInfoOpen, setLdapPassword, setOnlyMissing, setPassword, t }} />

      <CustomImportWebApiPreviewModal {...{ webApiPreviewOpen, activeClient, activeClientId, applySelectedWebApiVariations, clearWebApiPreviewSelection, deleteSingleImportedUser, handleWebApiPreviewRowMouseDown, importSingleWebApiUser, openWebApiPreviewContextMenu, openWebApiPreviewRowContextMenu, previewSummaryCounts, refreshWebApiPreview, selectAllWebApiPreviewRows, t, webApiPreviewContextMenu, webApiPreviewContextMenuFocusRef, webApiPreviewContextMenuRef, webApiPreviewDeletingIds, webApiPreviewDialogFocusRef, webApiPreviewError, webApiPreviewExistingFiltered, webApiPreviewExistingRows, webApiPreviewFilter, webApiPreviewImportingIds, webApiPreviewLeftQuery, webApiPreviewLoading, webApiPreviewRemoteById, webApiPreviewRemoteRows, webApiPreviewRightQuery, webApiPreviewSelectedAddRows, webApiPreviewSelectedDeleteRows, webApiPreviewSelectedLeftIdSet, webApiPreviewSelectedRightIdSet, webApiPreviewSelectedUpdateRows, webApiPreviewSelectedVariationRows, webApiVariationRows, setWebApiPreviewFilter, setWebApiPreviewLeftQuery, setWebApiPreviewOpen, setWebApiPreviewRightQuery }} />

      <CustomImportLdapCompareModal {...{ ldapCompareOpen, ldapCompareDialogFocusRef, ldapImporting, ldapImportSelectOpen, ldapPreviewFetchedAt, ldapPreviewLoading, ldapPreviewResult, openLdapImportSelection, runLdapPreview, setLdapCompareOpen, setLdapImportSelectOpen, setLdapSelectedExternalIds, t }} />

      <CustomImportLdapImportSelectModal {...{ ldapImportSelectOpen, clearLdapImportSelection, ldapImporting, ldapImportRowsWithDrafts, ldapImportSelectDialogFocusRef, ldapPreviewResult, ldapSelectedExternalIdSet, ldapSelectedImportableCount, openLdapImportEditModal, runLdapImport, selectAllLdapImportRows, toggleLdapImportSelection, setLdapImportSelectOpen, t }} />

      <CustomImportLdapEditRowModal {...{ ldapImportEditRowId, ldapImportEditDialogFocusRef, ldapImportEditForm, ldapImporting, saveLdapImportEdit, setLdapImportEditForm, setLdapImportEditRowId, t }} />

      <CustomImportUsersModal {...{ usersOpen, activeClient, activeClientId, assignedCounts, duplicateUserKeys, includeMissing, loadUsers, manualUserDeletingId, onlyMissing, openManualUserCreate, openManualUserEdit, openPortalProvisionModal, portalUserByImportedKey, portalUsersLoading, sortedUsers, usersChildDialogOpen, usersDialogFocusRef, usersLoading, usersQuery, usersSortState, setExternalUserHidden, setIncludeMissing, setManualDeleteCandidate, setOnlyMissing, setUsersOpen, setUsersQuery, setUsersSortState, push, t }} />

      <CustomImportPortalProvisionModal {...{ portalProvisionModalOpen, portalProvisionDialogFocusRef, portalProvisionForm, portalProvisionSaving, portalProvisionSourceUser, submitPortalProvision, setPortalProvisionForm, setPortalProvisionModalOpen, t }} />

      <CustomImportPortalProvisionResultModal {...{ portalProvisionResult, portalProvisionResultFocusRef, copyPortalProvisionSecret, setPortalProvisionResult, t }} />

      <CustomImportManualUserModal {...{ manualUserModalOpen, activeClient, activeClientId, manualUserDialogFocusRef, manualUserEditingId, manualUserEditingKind, manualUserForm, manualUserSaving, saveManualUser, setManualUserForm, setManualUserModalOpen, t }} />

      <CustomImportCsvLdapInfoModals {...{ csvConfirmOpen, csvConfirmDialogFocusRef, csvFile, csvImporting, runCsvImport, ldapInfoOpen, ldapInfoDialogFocusRef, setCsvConfirmOpen, setLdapInfoOpen, t }} />

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
