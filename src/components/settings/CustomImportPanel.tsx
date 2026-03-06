import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpCircle, Eye, EyeOff, FileDown, Info, Pencil, Plus, RefreshCw, Save, Search, Settings2, TestTube, Trash2, UploadCloud, Users, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { useAuthStore } from '../../store/useAuthStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  clearImport,
  createManualExternalUser,
  deleteOneImportedUser,
  deleteManualExternalUser,
  importOneWebApiUser,
  ImportPreviewExistingRow,
  ImportPreviewRow,
  ExternalUserRow,
  fetchImportSummary,
  getImportConfig,
  ImportSummaryRow,
  importCsv,
  listExternalUsers,
  previewImport,
  saveImportConfig,
  setExternalUserHidden,
  syncImport,
  testImport,
  updateManualExternalUser
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
  const [importMode, setImportMode] = useState<'webapi' | 'csv' | 'manual'>('webapi');
  const [cfg, setCfg] = useState<{ url: string; username: string; method: 'GET' | 'POST' | string; hasPassword: boolean; bodyJson: string; updatedAt?: number } | null>(null);
  const [password, setPassword] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingClientId, setSyncingClientId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; count?: number; error?: string; contentType?: string; rawSnippet?: string } | null>(null);
  const [webApiTestPassedByClient, setWebApiTestPassedByClient] = useState<Record<string, boolean>>({});
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [usersLoading, setUsersLoading] = useState(false);
  const [usersRows, setUsersRows] = useState<ExternalUserRow[]>([]);
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
  const [webApiPreviewImportingIds, setWebApiPreviewImportingIds] = useState<Record<string, boolean>>({});
  const [webApiPreviewDeletingIds, setWebApiPreviewDeletingIds] = useState<Record<string, boolean>>({});

  const [csvFile, setCsvFile] = useState<{ name: string; text: string } | null>(null);
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClientId, setInfoClientId] = useState<string | null>(null);
  const [manualUserModalOpen, setManualUserModalOpen] = useState(false);
  const [manualUserEditingId, setManualUserEditingId] = useState<string | null>(null);
  const [manualUserSaving, setManualUserSaving] = useState(false);
  const [manualUserDeletingId, setManualUserDeletingId] = useState<string | null>(null);
  const [manualDeleteCandidate, setManualDeleteCandidate] = useState<ExternalUserRow | null>(null);
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);
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
  const usersDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const manualUserDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const csvConfirmDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const infoDialogFocusRef = useRef<HTMLButtonElement | null>(null);

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
  const configChildDialogOpen = csvConfirmOpen || clearConfirmOpen;
  const usersChildDialogOpen = manualUserModalOpen || !!manualDeleteCandidate || duplicatesModalOpen;
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
    const filtered = !q ? rows : rows.filter((r) => matchesImportUserQuery(r, q));
    return filtered.sort((a, b) => {
      const d = importPreviewVariationRank(a.variationType) - importPreviewVariationRank(b.variationType);
      if (d) return d;
      return comparePeopleByName(a, b);
    });
  }, [webApiMissingExistingRows, webApiPreviewRightQuery, webApiPreviewRemoteRows]);

  const resetManualUserForm = useCallback(() => {
    setManualUserEditingId(null);
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
    setManualUserModalOpen(true);
  }, [resetManualUserForm]);

  const openManualUserEdit = useCallback((row: ExternalUserRow) => {
    setManualUserEditingId(row.externalId);
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

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return t({ it: 'Mai', en: 'Never' });
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return t({ it: 'Mai', en: 'Never' });
    }
  };

  const openConfig = async (clientId: string, mode?: 'webapi' | 'csv' | 'manual') => {
    setActiveClientId(clientId);
    setConfigOpen(true);
    setUsersOpen(false);
    const nextMode = mode || 'webapi';
    setConfigExpanded(lockClientSelection ? nextMode === 'webapi' : false);
    setImportMode(nextMode);
    setCsvFile(null);
    setWebApiPreviewOpen(false);
    await loadConfig(clientId);
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
    await loadUsers(clientId);
  };

  const refreshWebApiPreview = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setWebApiPreviewLoading(true);
    setWebApiPreviewError(null);
    try {
      const res = await previewImport(clientId);
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
  }, [loadUsers, setUsersRows, t]);

  const openWebApiPreview = useCallback(async () => {
    if (!activeClientId) return;
    setWebApiPreviewOpen(true);
    setConfigOpen(false);
    setUsersOpen(false);
    setWebApiPreviewLeftQuery('');
    setWebApiPreviewRightQuery('');
    await refreshWebApiPreview(activeClientId);
  }, [activeClientId, refreshWebApiPreview]);

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
      const res = await testImport(activeClientId);
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
        await updateManualExternalUser({
          clientId: activeClientId,
          externalId: manualUserEditingId,
          user: manualUserForm
        });
        push(t({ it: 'Utente manuale aggiornato', en: 'Manual user updated' }), 'success');
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
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span>{t({ it: 'Sorgente importazione', en: 'Import source' })} · {activeClient?.shortName || activeClient?.name || '—'}</span>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-ink"
                  title={t({
                    it: 'Gestisci la rubrica utenti del cliente con tre sorgenti: WebAPI, CSV e inserimento manuale. Tutti gli utenti finiscono in un unico contenitore. I duplicati vengono segnalati per email o, se assente, per nome+cognome. Da questa schermata puoi configurare, testare e importare dalla WebAPI, importare da CSV e aggiungere utenti manuali.',
                    en: 'Manage the client user directory with three sources: WebAPI, CSV and manual entry. All users go into one container. Duplicates are flagged by email or, if missing, by first and last name. From here you can configure, test and import from WebAPI, import from CSV and add manual users.'
                  })}
                  aria-label={t({ it: 'Informazioni import utenti', en: 'User import information' })}
                >
                  <Info size={14} />
                </button>
              </div>
              <div className="modal-description">
                {t({
                  it: 'Tutti gli utenti reali (WebAPI, CSV e manuali) finiscono in un unico contenitore del cliente. I duplicati vengono segnalati per email oppure nome+cognome.',
                  en: 'All real users (WebAPI, CSV and manual) go into a single client container. Duplicates are flagged by email or first+last name.'
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openUsersOrExplain(activeClientId)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  (activeSummary?.total || 0) > 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={
                  (activeSummary?.total || 0) > 0
                    ? t({ it: 'Apri il contenitore utenti importati', en: 'Open imported users container' })
                    : t({ it: 'Nessun utente importato: fai prima una importazione o un inserimento manuale', en: 'No imported users yet: import or add manual users first' })
                }
              >
                <Users size={15} />
                {t({ it: 'Utenti importati', en: 'Imported users' })}
              </button>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                {t({ it: 'Totale', en: 'Total' })}: {activeSummary?.total ?? 0}
              </span>
              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${duplicateGroups.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                {t({ it: 'Duplicati', en: 'Duplicates' })}: {duplicateGroups.length}
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setImportMode('webapi')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'webapi' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>WebAPI</button>
            <button type="button" onClick={() => setImportMode('csv')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'csv' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>CSV</button>
            <button type="button" onClick={() => setImportMode('manual')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t({ it: 'Inserimento manuale', en: 'Manual entry' })}</button>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {importMode === 'webapi' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => openConfig(activeClientId, 'webapi')} className="btn-primary">
                  {t({ it: 'Configurazione', en: 'Configuration' })}
                </button>
                <button
                  type="button"
                  onClick={() => void openWebApiPreview()}
                  disabled={!canOpenWebApiImportPreview}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
                  title={
                    canOpenWebApiImportPreview
                      ? t({ it: 'Apri l’anteprima utenti trovati dalla WebAPI', en: 'Open WebAPI users preview' })
                      : t({ it: 'Configura e testa prima la WebAPI per abilitare l’importazione.', en: 'Configure and test WebAPI first to enable import.' })
                  }
                >
                  <UploadCloud size={16} />
                  {t({ it: 'Importazione', en: 'Import' })}
                </button>
              </div>
            ) : importMode === 'csv' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => openConfig(activeClientId, 'csv')} className="btn-primary">
                  {t({ it: 'Apri import CSV', en: 'Open CSV import' })}
                </button>
                <button type="button" onClick={downloadCsvTemplate} className="btn-secondary inline-flex items-center gap-2">
                  <FileDown size={16} />
                  {t({ it: 'Modello CSV', en: 'CSV template' })}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={async () => { await openUsers(activeClientId); openManualUserCreate(); }} className="btn-secondary inline-flex items-center gap-2">
                  <Plus size={16} />
                  {t({ it: 'Nuovo utente manuale', en: 'New manual user' })}
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
                    {row.hasConfig ? (
                      <button
                        onClick={() => runSync(row.clientId)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Aggiorna importazione da WebAPI', en: 'Sync import from WebAPI' })}
                        disabled={syncingClientId === row.clientId}
                      >
                        <RefreshCw size={14} className={syncingClientId === row.clientId ? 'animate-spin' : ''} />
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
                        {t({ it: 'Configurazione importazione', en: 'Import configuration' })}
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
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
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
                        <form onSubmit={(e) => e.preventDefault()} className="block">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Password', en: 'Password' })}
                            <input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                              placeholder={cfg?.hasPassword ? t({ it: 'Lascia vuoto per non cambiare', en: 'Leave empty to keep' }) : '••••••'}
                            />
                          </label>
                        </form>
                        <label className="block text-sm font-medium text-slate-700">
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
                      </>
                    ) : null}
                    {!lockClientSelection && (activeSummary?.total || syncResult?.ok || importMode === 'manual') ? (
                      <button
                        onClick={() => activeClientId && openUsers(activeClientId)}
                        className="flex items-center gap-2 btn-secondary"
                        title={t({ it: 'Apri utenti importati', en: 'Open imported users' })}
                      >
                        <Users size={16} /> {t({ it: 'Utenti importati', en: 'Imported users' })}
                      </button>
                    ) : null}
                    {importMode !== 'webapi' ? (
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
                  {importMode === 'webapi' ? (
                    <div className="mt-3">
                      <div className="h-px w-full bg-slate-200" />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        {!lockClientSelection ? (
                          <>
                            <button
                              onClick={() => void openWebApiPreview()}
                              disabled={!canOpenWebApiImportPreview}
                              className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                              title={
                                !canOpenWebApiImportPreview
                                  ? t({ it: 'Configura e testa prima la WebAPI.', en: 'Configure and test WebAPI first.' })
                                  : t({ it: 'Apri anteprima importazione WebAPI', en: 'Open WebAPI import preview' })
                              }
                            >
                              <UploadCloud size={16} />
                              {t({ it: 'Importa', en: 'Import' })}
                            </button>
                            <button
                              onClick={() => setClearConfirmOpen(true)}
                              disabled={!activeClientId || clearing || !canClearWebApiImport}
                              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                              title={
                                !canClearWebApiImport
                                  ? t({ it: 'Disponibile solo dopo almeno una importazione.', en: 'Available only after at least one import.' })
                                  : t({ it: 'Elimina utenti importati dal contenitore', en: 'Delete imported users from the container' })
                              }
                            >
                              <Trash2 size={16} /> {clearing ? t({ it: 'Eliminazione…', en: 'Deleting…' }) : t({ it: 'Elimina', en: 'Delete' })}
                            </button>
                          </>
                        ) : null}
                      </div>
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
                    <button onClick={() => setWebApiPreviewOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                    <button type="button" onClick={() => activeClientId && refreshWebApiPreview(activeClientId)} className="btn-secondary inline-flex items-center gap-2">
                      <RefreshCw size={16} className={webApiPreviewLoading ? 'animate-spin' : ''} />
                      {t({ it: 'Ricarica', en: 'Reload' })}
                    </button>
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="font-semibold text-ink">
                      {t({ it: 'Totali da importazione', en: 'Total from import' })}: {webApiPreviewRemoteRows.length} · {t({ it: 'Utenti esistenti', en: 'Existing users' })}: {webApiPreviewExistingRows.length}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-rose-700">{t({ it: 'Da eliminare', en: 'To delete' })}: {previewSummaryCounts.remove}</span>
                      <span className="text-amber-700">{t({ it: 'Da aggiornare', en: 'To update' })}: {previewSummaryCounts.update}</span>
                      <span className="text-emerald-700">{t({ it: 'Da aggiungere', en: 'To add' })}: {previewSummaryCounts.add}</span>
                    </div>
                  </div>
                  {webApiPreviewError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{webApiPreviewError}</div> : null}
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
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
                        {webApiPreviewExistingFiltered.map((r) => {
                          const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || r.externalId;
                          const isMissingFromImport = !webApiPreviewRemoteById.has(String(r.externalId));
                          return (
                            <div key={`existing:${r.externalId}`} className="border-t border-slate-100 px-4 py-3 text-sm">
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
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
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
                        {webApiVariationRows.map((r: any) => {
                          const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || r.externalId;
                          const variationType = String(r.variationType || '');
                          const isAdd = variationType === 'add';
                          const isUpdate = variationType === 'update';
                          const tagClass = isAdd ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isUpdate ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700';
                          return (
                            <div key={`remote:${r.externalId}`} className="border-t border-slate-100 px-4 py-3 text-sm">
                              <div className="flex items-start gap-2">
                                {isAdd || isUpdate ? (
                                  <button
                                    type="button"
                                    onClick={() => void importSingleWebApiUser(r)}
                                    disabled={!!webApiPreviewImportingIds[r.externalId]}
                                    className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-40"
                                    title={isAdd ? t({ it: 'Aggiungi utente', en: 'Add user' }) : t({ it: 'Aggiorna utente esistente', en: 'Update existing user' })}
                                  >
                                    {isAdd ? <Plus size={14} className={webApiPreviewImportingIds[r.externalId] ? 'animate-pulse' : ''} /> : <ArrowUpCircle size={14} className={webApiPreviewImportingIds[r.externalId] ? 'animate-pulse' : ''} />}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void deleteSingleImportedUser(r.externalId)}
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
                  <div className="modal-footer">
                    <button onClick={() => setWebApiPreviewOpen(false)} className="btn-secondary">{t({ it: 'Chiudi', en: 'Close' })}</button>
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
                              <th className="px-4 py-3 text-right" title={t({ it: 'Azioni disponibili: modifica/elimina manuale e nascondi/mostra o includi/escludi.', en: 'Available actions: edit/delete manual and hide/show or include/exclude.' })}>
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
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      {(r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:')) ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => openManualUserEdit(r)}
                                            className="btn-inline"
                                            title={t({ it: 'Modifica utente manuale', en: 'Edit manual user' })}
                                          >
                                            <Pencil size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setManualDeleteCandidate(r)}
                                            disabled={manualUserDeletingId === r.externalId}
                                            className="btn-inline text-rose-700 hover:bg-rose-50"
                                            title={t({ it: 'Rimuovi utente manuale', en: 'Delete manual user' })}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </>
                                      ) : null}
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
                                              ? t({ it: 'Includi nel contenitore utenti', en: 'Include in user container' })
                                              : t({ it: 'Escludi dal contenitore utenti', en: 'Exclude from user container' })
                                            : r.hidden
                                              ? t({ it: 'Mostra utente', en: 'Unhide user' })
                                              : t({ it: 'Nascondi utente', en: 'Hide user' })
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
                        {manualUserEditingId ? t({ it: 'Modifica utente manuale', en: 'Edit manual user' }) : t({ it: 'Nuovo utente manuale', en: 'New manual user' })}
                      </Dialog.Title>
                      <div className="modal-description">{activeClient ? activeClient.name : ''}</div>
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
                      {t({
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
