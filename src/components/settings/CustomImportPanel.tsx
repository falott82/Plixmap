import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FileDown, Filter, Info, RefreshCw, Search, Settings2, TestTube, Trash2, UploadCloud, Users, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  clearImport,
  ExternalUserRow,
  fetchImportSummary,
  getImportConfig,
  ImportSummaryRow,
  importCsv,
  listExternalUsers,
  saveImportConfig,
  setExternalUserHidden,
  syncImport,
  testImport
} from '../../api/customImport';
import { fetchState } from '../../api/state';

const CustomImportPanel = () => {
  const t = useT();
  const clients = useDataStore((s) => s.clients);
  const setServerState = useDataStore((s) => s.setServerState);
  const { push } = useToastStore();

  const [summaryRows, setSummaryRows] = useState<ImportSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  const [configExpanded, setConfigExpanded] = useState(false);
  const [importMode, setImportMode] = useState<'webapi' | 'csv'>('webapi');
  const [cfg, setCfg] = useState<{ url: string; username: string; method: 'GET' | 'POST' | string; hasPassword: boolean; bodyJson: string; updatedAt?: number } | null>(null);
  const [password, setPassword] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingClientId, setSyncingClientId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; count?: number; error?: string; contentType?: string; rawSnippet?: string } | null>(null);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [usersLoading, setUsersLoading] = useState(false);
  const [usersRows, setUsersRows] = useState<ExternalUserRow[]>([]);
  const [usersQuery, setUsersQuery] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [includeMissing, setIncludeMissing] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);

  const [csvFile, setCsvFile] = useState<{ name: string; text: string } | null>(null);
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClientId, setInfoClientId] = useState<string | null>(null);

  const summaryById = useMemo(() => new Map(summaryRows.map((r) => [r.clientId, r])), [summaryRows]);
  const activeClient = useMemo(() => clients.find((c) => c.id === activeClientId) || null, [activeClientId, clients]);
  const activeSummary = useMemo(() => (activeClientId ? summaryById.get(activeClientId) || null : null), [activeClientId, summaryById]);
  const infoClient = useMemo(() => (infoClientId ? clients.find((c) => c.id === infoClientId) || null : null), [clients, infoClientId]);
  const infoSummary = useMemo(() => (infoClientId ? summaryById.get(infoClientId) || null : null), [infoClientId, summaryById]);
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
    setSummaryLoading(true);
    try {
      const res = await fetchImportSummary();
      setSummaryRows(res.rows || []);
    } catch {
      setSummaryRows([]);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

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
      return;
    }
    setUsersLoading(true);
    try {
      const res = await listExternalUsers({ clientId, includeHidden: true, includeMissing: true });
      setUsersRows(res.rows || []);
    } catch {
      setUsersRows([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const filteredUsers = useMemo(() => {
    const query = usersQuery.trim().toLowerCase();
    let list = usersRows;
    if (!includeHidden) list = list.filter((r) => !r.hidden);
    if (!includeMissing) list = list.filter((r) => r.present);
    if (onlyUnassigned) {
      list = list.filter((r) => (assignedCounts.get(`${r.clientId}:${r.externalId}`) || 0) === 0);
    }
    if (!query) return list;
    return list.filter((r) => {
      const hay = `${r.externalId} ${r.firstName} ${r.lastName} ${r.role} ${r.dept1} ${r.dept2} ${r.dept3} ${r.email}`.toLowerCase();
      return hay.includes(query);
    });
  }, [assignedCounts, includeHidden, includeMissing, onlyUnassigned, usersQuery, usersRows]);

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return t({ it: 'Mai', en: 'Never' });
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return t({ it: 'Mai', en: 'Never' });
    }
  };

  const openConfig = async (clientId: string, mode?: 'webapi' | 'csv') => {
    setActiveClientId(clientId);
    setConfigOpen(true);
    setUsersOpen(false);
    setConfigExpanded(false);
    setImportMode(mode || 'webapi');
    setCsvFile(null);
    await loadConfig(clientId);
  };

  const openUsers = async (clientId: string) => {
    setActiveClientId(clientId);
    setUsersOpen(true);
    setConfigOpen(false);
    setUsersQuery('');
    setOnlyUnassigned(false);
    setIncludeMissing(false);
    setIncludeHidden(false);
    setCsvFile(null);
    await loadUsers(clientId);
  };

  const runSync = async (clientId: string) => {
    setSyncingClientId(clientId);
    setSyncResult(null);
    try {
      const res = await syncImport(clientId);
      setSyncResult(res);
      if (res.ok) {
        push(t({ it: 'Import completato', en: 'Import completed' }), 'success');
        await loadSummary();
        if (usersOpen && activeClientId === clientId) await loadUsers(clientId);
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
      if (res.ok) push(t({ it: 'Test riuscito', en: 'Test successful' }), 'success');
      else push(t({ it: 'Test fallito', en: 'Test failed' }), 'danger');
    } catch {
      setTestResult({ ok: false, status: 0, error: 'Request failed' });
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
    const template = [
      'externalId,firstName,lastName,role,dept1,dept2,dept3,email,ext1,ext2,ext3,isExternal',
      'u-001,Mario,Rossi,HR,People,,,mario.rossi@example.com,101,,,"0"'
    ].join('\n');
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deskly-users-template.csv';
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
      setCsvFile(null);
      await loadSummary();
      if (usersOpen && activeClientId) await loadUsers(activeClientId);
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Import WebAPI / CSV (Utenti reali)', en: 'WebAPI / CSV Import (Real users)' })}</div>
            <div className="modal-description">
              {t({
                it: 'Ogni cliente ha la propria rubrica utenti: scegli la fonte e sincronizza da qui.',
                en: 'Each client has its own user directory: choose the source and sync from here.'
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
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
            {summaryRows.map((row) => {
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
            {!summaryRows.length && !summaryLoading ? (
              <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun cliente disponibile.', en: 'No clients available.' })}</div>
            ) : null}
            {summaryLoading ? <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</div> : null}
          </div>
        </div>
      </div>

      <Transition show={configOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setConfigOpen(false)}>
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
                  <div className="modal-header">
                    <div>
                      <Dialog.Title className="modal-title">
                        {t({ it: 'Configurazione importazione', en: 'Import configuration' })}
                      </Dialog.Title>
                      <div className="modal-description">
                        {activeClient ? activeClient.name : t({ it: 'Nessun cliente selezionato', en: 'No client selected' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {importMode === 'webapi' ? (
                        <button
                          onClick={() => setConfigExpanded((v) => !v)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Mostra/Nascondi impostazioni WebAPI', en: 'Show/Hide WebAPI settings' })}
                        >
                          <Settings2 size={16} />
                        </button>
                      ) : null}
                      <button onClick={() => setConfigOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>

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
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Mancanti', en: 'Missing' })}</div>
                        <div className="text-base font-semibold text-ink">{activeSummary?.missingCount ?? 0}</div>
                      </div>
                    </div>
                  </div>

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
                  </div>

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
                        {t({
                          it: 'Apri le impostazioni WebAPI con l’icona ingranaggio per configurare URL e credenziali.',
                          en: 'Open the WebAPI settings via the gear icon to configure URL and credentials.'
                        })}
                      </div>
                    )
                  ) : (
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
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {importMode === 'webapi' ? (
                      <>
                        <button
                          onClick={saveConfig}
                          disabled={savingCfg || !activeClientId}
                          className="btn-primary disabled:opacity-60"
                          title={t({ it: 'Salva configurazione WebAPI', en: 'Save WebAPI configuration' })}
                        >
                          {savingCfg ? t({ it: 'Salvataggio…', en: 'Saving…' }) : t({ it: 'Salva impostazioni', en: 'Save settings' })}
                        </button>
                        <button
                          onClick={runTest}
                          disabled={testing || !activeClientId}
                          className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                          title={t({ it: 'Verifica connessione WebAPI', en: 'Test WebAPI connection' })}
                        >
                          <TestTube size={16} /> {testing ? t({ it: 'Test…', en: 'Testing…' }) : t({ it: 'Test WebAPI', en: 'Test WebAPI' })}
                        </button>
                        {activeSummary?.hasConfig ? (
                          <button
                            onClick={() => activeClientId && runSync(activeClientId)}
                            disabled={!activeClientId || syncingClientId === activeClientId}
                            className="flex items-center gap-2 btn-secondary disabled:opacity-60"
                            title={t({ it: 'Aggiorna importazione da WebAPI', en: 'Sync import from WebAPI' })}
                          >
                            <RefreshCw size={16} className={syncingClientId === activeClientId ? 'animate-spin' : ''} />
                            {t({ it: 'Aggiorna importazione', en: 'Sync import' })}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {activeSummary?.total || syncResult?.ok ? (
                      <button
                        onClick={() => activeClientId && openUsers(activeClientId)}
                        className="flex items-center gap-2 btn-secondary"
                        title={t({ it: 'Apri utenti importati', en: 'Open imported users' })}
                      >
                        <Users size={16} /> {t({ it: 'Utenti importati', en: 'Imported users' })}
                      </button>
                    ) : null}
                    <button
                      onClick={() => setClearConfirmOpen(true)}
                      disabled={!activeClientId || clearing}
                      className="ml-auto flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      title={t({ it: 'Elimina dati importati', en: 'Clear imported data' })}
                    >
                      <Trash2 size={16} /> {clearing ? t({ it: 'Svuotamento…', en: 'Clearing…' }) : t({ it: 'Svuota importazione', en: 'Clear import' })}
                    </button>
                  </div>

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

      <Transition show={usersOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setUsersOpen(false)}>
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
                        placeholder={t({ it: 'Cerca per nome, reparto, email…', en: 'Search by name, dept, email…' })}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => activeClientId && loadUsers(activeClientId)}
                      className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Ricarica elenco', en: 'Reload list' })}
                    >
                      <RefreshCw size={16} className={usersLoading ? 'animate-spin text-primary' : 'text-slate-500'} />
                      {t({ it: 'Aggiorna', en: 'Refresh' })}
                    </button>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <Filter size={16} className="text-slate-500" />
                      <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
                      {t({ it: 'Solo non assegnati', en: 'Only unassigned' })}
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={includeMissing} onChange={(e) => setIncludeMissing(e.target.checked)} />
                      {t({ it: 'Includi mancanti', en: 'Include missing' })}
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)} />
                      {t({ it: 'Mostra nascosti', en: 'Show hidden' })}
                    </label>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      <div className="col-span-4">{t({ it: 'Nome', en: 'Name' })}</div>
                      <div className="col-span-2">{t({ it: 'ID', en: 'ID' })}</div>
                      <div className="col-span-4">{t({ it: 'Ruolo / Reparto', en: 'Role / Dept' })}</div>
                      <div className="col-span-1 text-center">{t({ it: 'Alloc.', en: 'Alloc.' })}</div>
                      <div className="col-span-1 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
                    </div>
                    <div className="max-h-[380px] overflow-auto">
                      {usersLoading ? <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</div> : null}
                      {!usersLoading && !filteredUsers.length ? (
                        <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div>
                      ) : null}
                      {filteredUsers.map((r) => {
                        const count = assignedCounts.get(`${r.clientId}:${r.externalId}`) || 0;
                        const displayName = `${String(r.firstName || '').trim()} ${String(r.lastName || '').trim()}`.trim() || r.email || r.externalId;
                        return (
                          <div key={r.externalId} className="grid grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-sm">
                            <div className="col-span-4 min-w-0">
                              <div className="truncate font-semibold text-ink">
                                {displayName}
                                {!r.present ? (
                                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                    {t({ it: 'Mancante', en: 'Missing' })}
                                  </span>
                                ) : null}
                                {r.hidden ? (
                                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                    {t({ it: 'Nascosto', en: 'Hidden' })}
                                  </span>
                                ) : null}
                              </div>
                              <div className="truncate text-xs text-slate-500">{r.email || ''}</div>
                            </div>
                            <div className="col-span-2 font-mono text-[12px] text-slate-700">{r.externalId}</div>
                            <div className="col-span-4 min-w-0">
                              <div className="truncate text-xs text-slate-700">{r.role || '—'}</div>
                              <div className="truncate text-[11px] text-slate-500">{[r.dept1, r.dept2, r.dept3].filter(Boolean).join(' / ')}</div>
                            </div>
                            <div className="col-span-1 text-center text-sm font-semibold text-slate-700">{count}</div>
                            <div className="col-span-1 flex items-center justify-end">
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
                                title={r.hidden ? t({ it: 'Mostra utente', en: 'Unhide user' }) : t({ it: 'Nascondi utente', en: 'Hide user' })}
                              >
                                {r.hidden ? t({ it: 'Mostra', en: 'Show' }) : t({ it: 'Nascondi', en: 'Hide' })}
                              </button>
                            </div>
                          </div>
                        );
                      })}
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
                    {activeSummary?.hasConfig ? (
                      <button
                        onClick={() => activeClientId && runSync(activeClientId)}
                        disabled={!activeClientId || syncingClientId === activeClientId}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                        title={t({ it: 'Aggiorna importazione WebAPI', en: 'Sync WebAPI import' })}
                      >
                        <RefreshCw size={16} className={syncingClientId === activeClientId ? 'animate-spin' : ''} />
                        {t({ it: 'Aggiorna importazione', en: 'Sync import' })}
                      </button>
                    ) : null}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={csvConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCsvConfirmOpen(false)}>
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
        <Dialog as="div" className="relative z-50" onClose={() => setInfoOpen(false)}>
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
        open={clearConfirmOpen}
        title={t({ it: 'Eliminare tutti gli utenti importati?', en: 'Delete all imported users?' })}
        description={t({
          it: 'Procedendo verranno eliminati tutti gli utenti importati per questo cliente e rimossi gli oggetti “Utente reale” dalle planimetrie. Operazione non annullabile.',
          en: 'This will delete all imported users for this client and remove all “Real user” objects from floor plans. This cannot be undone.'
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
