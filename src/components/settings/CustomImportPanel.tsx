import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpDown, ChevronDown, ChevronUp, Download, Info, RefreshCw, Save, TestTube, Trash2, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import ConfirmDialog from '../ui/ConfirmDialog';
import { clearImport, diffImport, getImportConfig, listExternalUsers, saveImportConfig, setExternalUserHidden, syncImport, testImport } from '../../api/customImport';
import { fetchState } from '../../api/state';

const CustomImportPanel = () => {
  const t = useT();
  const clients = useDataStore((s) => s.clients);
  const removeRealUserAllocations = useDataStore((s: any) => s.removeRealUserAllocations);
  const setServerState = useDataStore((s) => s.setServerState);
  const { push } = useToastStore();

  const [clientId, setClientId] = useState<string>(clients[0]?.id || '');
  const [cfg, setCfg] = useState<{ url: string; username: string; hasPassword: boolean; bodyJson: string; updatedAt?: number } | null>(null);
  const [password, setPassword] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [loadingCfg, setLoadingCfg] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [diffing, setDiffing] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: number;
    count?: number;
    preview?: any[];
    error?: string;
    contentType?: string;
    rawSnippet?: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [usersQuery, setUsersQuery] = useState('');
  const [includeHidden, setIncludeHidden] = useState(false);
  const [includeMissing, setIncludeMissing] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [sort, setSort] = useState<{ key: 'externalId' | 'name' | 'dept' | 'alloc'; dir: 'asc' | 'desc' }>({
    key: 'externalId',
    dir: 'asc'
  });
  const [infoRow, setInfoRow] = useState<any | null>(null);
  const [confirmRemoveMissing, setConfirmRemoveMissing] = useState<{ externalId: string; firstName: string; lastName: string } | null>(null);
  const [confirmImport, setConfirmImport] = useState<any | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const activeClient = useMemo(() => clients.find((c) => c.id === clientId) || null, [clientId, clients]);
  const assignedCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!activeClient) return map;
    for (const s of activeClient.sites || []) {
      for (const p of s.floorPlans || []) {
        for (const o of p.objects || []) {
          const cid = (o as any).externalClientId;
          const eid = (o as any).externalUserId;
          if (!cid || !eid) continue;
          const key = `${cid}:${eid}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    }
    return map;
  }, [activeClient]);

  const sortedRows = useMemo(() => {
    const arr = Array.isArray(rows) ? [...rows] : [];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const norm = (v: any) => String(v || '').toLowerCase().trim();
    const dept = (r: any) => [r.dept1, r.dept2, r.dept3].filter(Boolean).join(' / ');
    arr.sort((a, b) => {
      if (sort.key === 'alloc') {
        const ca = assignedCounts.get(`${a.clientId}:${a.externalId}`) || 0;
        const cb = assignedCounts.get(`${b.clientId}:${b.externalId}`) || 0;
        if (ca !== cb) return (ca - cb) * dir;
        return norm(a.externalId).localeCompare(norm(b.externalId)) * dir;
      }
      if (sort.key === 'dept') {
        const da = norm(dept(a));
        const db = norm(dept(b));
        if (da !== db) return da.localeCompare(db) * dir;
        return norm(a.externalId).localeCompare(norm(b.externalId)) * dir;
      }
      if (sort.key === 'name') {
        const na = norm(`${a.lastName || ''} ${a.firstName || ''}`);
        const nb = norm(`${b.lastName || ''} ${b.firstName || ''}`);
        if (na !== nb) return na.localeCompare(nb) * dir;
        return norm(a.externalId).localeCompare(norm(b.externalId)) * dir;
      }
      return norm(a.externalId).localeCompare(norm(b.externalId)) * dir;
    });
    return arr;
  }, [assignedCounts, rows, sort.dir, sort.key]);

  const toggleSort = (key: 'externalId' | 'name' | 'dept' | 'alloc') => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const loadCfg = async () => {
    if (!clientId) return;
    setLoadingCfg(true);
    try {
      const res = await getImportConfig(clientId);
      setCfg(
        res.config
          ? {
              url: res.config.url,
              username: res.config.username,
              hasPassword: res.config.hasPassword,
              bodyJson: res.config.bodyJson || '{}',
              updatedAt: res.config.updatedAt
            }
          : null
      );
    } catch {
      setCfg(null);
    } finally {
      setLoadingCfg(false);
    }
  };

  const loadUsers = async () => {
    if (!clientId) return;
    try {
      const res = await listExternalUsers({ clientId, q: usersQuery, includeHidden, includeMissing });
      setRows(res.rows || []);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    if (!clientId && clients[0]?.id) setClientId(clients[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length]);

  useEffect(() => {
    setTestResult(null);
    setSyncResult(null);
    setPassword('');
    setShowRaw(false);
    setConfirmImport(null);
    setConfirmClearAll(false);
    loadCfg();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersQuery, includeHidden, includeMissing]);

  const downloadText = (filename: string, text: string, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toCsvCell = (value: any) => {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const normalizedBodyJson = (raw: string | undefined | null) => (String(raw || '').trim() ? String(raw) : '{}');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Custom Import (Utenti reali)', en: 'Custom Import (Real users)' })}</div>
            <div className="mt-1 text-sm text-slate-600">
              {t({
                it: 'Importa e sincronizza una rubrica dipendenti da una WebAPI per Cliente.',
                en: 'Import and sync an employee directory from a WebAPI per Client.'
              })}
            </div>
          </div>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Info', en: 'Info' })}
          >
            <Info size={16} />
          </button>
        </div>

        {showInfo ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-ink">{t({ it: 'Come funziona', en: 'How it works' })}</div>
              <button onClick={() => setShowInfo(false)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                <X size={16} />
              </button>
            </div>
            <ul className="ml-5 list-disc space-y-1 pt-2">
              <li>
                {t({
                  it: 'Chiamata WebAPI: POST. Puoi inviare un body JSON opzionale (es. {"Utente":"...","Password":"..."}).',
                  en: 'WebAPI call: POST. You can optionally send a JSON body (e.g. {"Utente":"...","Password":"..."}).'
                })}
              </li>
              <li>
                {t({
                  it: 'Autenticazione: Basic Auth (Username/Password).',
                  en: 'Authentication: Basic Auth (Username/Password).'
                })}
              </li>
              <li>
                {t({
                  it: '“Test” non modifica il DB: mostra un’anteprima della risposta.',
                  en: '“Test” does not modify the DB: it shows a response preview.'
                })}
              </li>
              <li>
                {t({
                  it: '“Importa/Resync” aggiorna il DB locale: nuovi utenti, aggiornamenti e “mancanti”.',
                  en: '“Import/Resync” updates the local DB: new users, updates and “missing” users.'
                })}
              </li>
              <li>
                {t({
                  it: 'In mappa usa “Utente reale”: scegli il dipendente da una lista con ricerca e filtro “Solo non assegnati”.',
                  en: 'In the workspace use “Real user”: pick an employee from a searchable list with “Only unassigned” filter.'
                })}
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Cliente', en: 'Client' })}</div>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              onClick={async () => {
                await loadCfg();
                await loadUsers();
                push(t({ it: 'Aggiornato', en: 'Refreshed' }), 'info');
              }}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50"
              title={t({ it: 'Ricarica configurazione e lista utenti', en: 'Reload config and user list' })}
            >
              <RefreshCw size={16} className="text-slate-600" />
              {t({ it: 'Ricarica', en: 'Reload' })}
            </button>
            <button
              onClick={() => {
                const header = [
                  'ExternalId',
                  'FirstName',
                  'LastName',
                  'Email',
                  'Role',
                  'Dept1',
                  'Dept2',
                  'Dept3',
                  'Ext1',
                  'Ext2',
                  'Ext3',
                  'IsExternal',
                  'Hidden',
                  'Present',
                  'Allocations'
                ];
                const lines = sortedRows.map((r) => {
                  const count = assignedCounts.get(`${r.clientId}:${r.externalId}`) || 0;
                  return [
                    r.externalId,
                    r.firstName,
                    r.lastName,
                    r.email,
                    r.role,
                    r.dept1,
                    r.dept2,
                    r.dept3,
                    r.ext1,
                    r.ext2,
                    r.ext3,
                    r.isExternal ? 1 : 0,
                    r.hidden ? 1 : 0,
                    r.present ? 1 : 0,
                    count
                  ]
                    .map(toCsvCell)
                    .join(',');
                });
                downloadText(`deskly-external-users-${clientId}.csv`, [header.join(','), ...lines].join('\n'), 'text/csv;charset=utf-8');
              }}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50"
              title={t({ it: 'Esporta la lista utenti (filtri e ordinamento inclusi)', en: 'Export the user list (includes filters and sorting)' })}
            >
              <Download size={16} className="text-slate-600" />
              {t({ it: 'Esporta CSV', en: 'Export CSV' })}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <button
            onClick={() => setConfigCollapsed((v) => !v)}
            className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-slate-100"
          >
            <span className="flex items-center gap-2">
              {t({ it: 'Configurazione WebAPI', en: 'WebAPI configuration' })}
              {cfg?.hasPassword ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {t({ it: 'Password salvata', en: 'Password saved' })}
                </span>
              ) : null}
              {cfg?.updatedAt ? (
                <span className="text-xs font-medium text-slate-500">
                  {t({
                    it: `Aggiornata: ${new Date(cfg.updatedAt).toLocaleString()}`,
                    en: `Updated: ${new Date(cfg.updatedAt).toLocaleString()}`
                  })}
                </span>
              ) : null}
            </span>
            {configCollapsed ? <ChevronDown size={18} className="text-slate-600" /> : <ChevronUp size={18} className="text-slate-600" />}
          </button>
          {!configCollapsed ? (
            <div className="p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">URL</div>
                  <input
                    value={cfg?.url || ''}
                    onChange={(e) => setCfg((p) => ({ ...(p || { url: '', username: '', hasPassword: false, bodyJson: '' }), url: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                    placeholder="https://url/miaapi"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-3">
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Username', en: 'Username' })}</div>
                    <input
                      value={cfg?.username || ''}
                      onChange={(e) =>
                        setCfg((p) => ({ ...(p || { url: '', username: '', hasPassword: false, bodyJson: '' }), username: e.target.value }))
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                      placeholder={t({ it: 'utente API', en: 'API user' })}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        {t({ it: 'Password', en: 'Password' })}
                      </div>
                      <div className="text-[11px] text-slate-500">{t({ it: 'Lascia vuoto per non cambiarla', en: 'Leave empty to keep current' })}</div>
                    </div>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                      placeholder={cfg?.hasPassword ? t({ it: '•••••••• (salvata)', en: '•••••••• (saved)' }) : '••••••••'}
                    />
                  </div>
                </div>
                <div className="lg:col-span-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Body JSON (opzionale)', en: 'JSON body (optional)' })}</div>
                  <textarea
                    value={cfg ? normalizedBodyJson(cfg.bodyJson) : '{}'}
                    onChange={(e) =>
                      setCfg((p) => ({ ...(p || { url: '', username: '', hasPassword: false, bodyJson: '{}' }), bodyJson: e.target.value }))
                    }
                    className="mt-1 h-16 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 font-mono text-[12px] outline-none focus:border-primary"
                    placeholder="{}"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    {t({
                      it: 'Di default è {}. Deve essere JSON valido.',
                      en: 'Default is {}. Must be valid JSON.'
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  disabled={savingCfg || loadingCfg || !clientId || !cfg?.url || !cfg?.username}
                  onClick={async () => {
                    if (!cfg) return;
                    setSavingCfg(true);
                    try {
                      const res = await saveImportConfig({
                        clientId,
                        url: cfg.url.trim(),
                        username: cfg.username.trim(),
                        bodyJson: normalizedBodyJson(cfg.bodyJson),
                        ...(password ? { password } : {})
                      });
                      setCfg({
                        url: res.config.url,
                        username: res.config.username,
                        hasPassword: res.config.hasPassword,
                        bodyJson: normalizedBodyJson(res.config.bodyJson || ''),
                        updatedAt: res.config.updatedAt
                      });
                      setPassword('');
                      push(t({ it: 'Configurazione salvata', en: 'Configuration saved' }), 'success');
                    } catch (e: any) {
                      const msg = String(e?.message || '');
                      push(msg.includes('Invalid JSON') ? t({ it: 'Body JSON non valido', en: 'Invalid JSON body' }) : t({ it: 'Errore nel salvataggio', en: 'Save failed' }), 'danger');
                    } finally {
                      setSavingCfg(false);
                    }
                  }}
                  className="flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                  title={t({ it: 'Salva configurazione', en: 'Save configuration' })}
                >
                  <Save size={16} />
                  {t({ it: 'Salva', en: 'Save' })}
                </button>

                <button
                  disabled={testing || !cfg?.url || !cfg?.username || (!cfg?.hasPassword && !password)}
                  onClick={async () => {
                    setTesting(true);
                    setTestResult(null);
                    setShowRaw(false);
                    try {
                      if (password) {
                        await saveImportConfig({
                          clientId,
                          url: cfg!.url.trim(),
                          username: cfg!.username.trim(),
                          bodyJson: normalizedBodyJson(cfg!.bodyJson),
                          password
                        });
                        setPassword('');
                        await loadCfg();
                      }
                      const res = await testImport(clientId);
                      setTestResult(res);
                      if (res.ok)
                        push(
                          t({
                            it: `Trovati ${res.count || 0} utenti, importazione possibile.`,
                            en: `Found ${res.count || 0} users, import is possible.`
                          }),
                          'success'
                        );
                      else push(t({ it: 'Test fallito', en: 'Test failed' }), 'danger');
                    } catch {
                      setTestResult({ ok: false, status: 0, error: 'Request failed' });
                      push(t({ it: 'Test fallito', en: 'Test failed' }), 'danger');
                    } finally {
                      setTesting(false);
                    }
                  }}
                  className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Esegui test WebAPI', en: 'Run WebAPI test' })}
                >
                  <TestTube size={16} className="text-slate-600" />
                  {t({ it: 'Test', en: 'Test' })}
                </button>

                <button
                  disabled={diffing || !cfg?.url || !cfg?.username || (!cfg?.hasPassword && !password)}
                  onClick={async () => {
                    setDiffing(true);
                    setConfirmImport(null);
                    setShowRaw(false);
                    try {
                      if (password) {
                        await saveImportConfig({
                          clientId,
                          url: cfg!.url.trim(),
                          username: cfg!.username.trim(),
                          bodyJson: normalizedBodyJson(cfg!.bodyJson),
                          password
                        });
                        setPassword('');
                        await loadCfg();
                      }
                      const diff = await diffImport(clientId);
                      if (!diff.ok) {
                        setSyncResult(diff);
                        push(t({ it: 'Impossibile calcolare differenze', en: 'Unable to compute diff' }), 'danger');
                        return;
                      }
                      if (!diff.newCount && !diff.updatedCount && !diff.missingCount) {
                        push(t({ it: 'Nessuna variazione rilevata', en: 'No changes detected' }), 'info');
                        return;
                      }
                      setConfirmImport(diff);
                    } finally {
                      setDiffing(false);
                    }
                  }}
                  className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Importa / Resync', en: 'Import / Resync' })}
                >
                  <RefreshCw size={16} className="text-slate-600" />
                  {t({ it: 'Importa', en: 'Import' })}
                </button>

                <button
                  disabled={clearingAll || !rows.length}
                  onClick={() => setConfirmClearAll(true)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  title={t({ it: 'Elimina tutti gli utenti importati', en: 'Delete all imported users' })}
                >
                  <Trash2 size={16} />
                  {t({ it: 'Elimina tutto', en: 'Delete all' })}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {testResult ? (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm ${
              testResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <div className="font-semibold">
              {testResult.ok
                ? t({ it: `Trovati ${testResult.count || 0} utenti, importazione possibile.`, en: `Found ${testResult.count || 0} users, import is possible.` })
                : t({
                    it: `KO (HTTP ${testResult.status}) — ${testResult.error || ''}`,
                    en: `Failed (HTTP ${testResult.status}) — ${testResult.error || ''}`
                  })}
            </div>
            {!testResult.ok && testResult.rawSnippet ? (
              <div className="mt-2">
                <button onClick={() => setShowRaw((v) => !v)} className="text-xs font-semibold underline decoration-dotted">
                  {showRaw ? t({ it: 'Nascondi risposta', en: 'Hide response' }) : t({ it: 'Mostra risposta ricevuta', en: 'Show received response' })}
                </button>
                {showRaw ? (
                  <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-rose-200 bg-white p-3 text-[11px] text-slate-800">
                    {String(testResult.contentType || '').trim()
                      ? `content-type: ${testResult.contentType}\n\n${testResult.rawSnippet}`
                      : testResult.rawSnippet}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {syncResult?.ok ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="font-semibold text-ink">{t({ it: 'Risultato import', en: 'Import result' })}</div>
            <div className="mt-1">
              {t({ it: 'Creati', en: 'Created' })}: <span className="font-semibold">{syncResult.summary?.created ?? 0}</span> ·{' '}
              {t({ it: 'Aggiornati', en: 'Updated' })}: <span className="font-semibold">{syncResult.summary?.updated ?? 0}</span> ·{' '}
              {t({ it: 'Mancanti', en: 'Missing' })}: <span className="font-semibold">{syncResult.summary?.missing ?? 0}</span>
            </div>
            {Array.isArray(syncResult.missing) && syncResult.missing.length ? (
              <div className="mt-2">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  {t({ it: 'Utenti non più presenti nella WebAPI', en: 'Users no longer present in the WebAPI' })}
                </div>
                <div className="mt-1 space-y-1">
                  {syncResult.missing.slice(0, 8).map((m: any) => (
                    <div key={m.externalId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">
                          {m.firstName} {m.lastName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t({ it: 'ID', en: 'ID' })}: {m.externalId}
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmRemoveMissing(m)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        {t({ it: 'Gestisci…', en: 'Handle…' })}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : syncResult && syncResult.ok === false ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <div className="font-semibold">
              {t({ it: `Import fallito — ${syncResult.error || ''}`, en: `Import failed — ${syncResult.error || ''}` })}
            </div>
            {syncResult.rawSnippet ? (
              <div className="mt-2">
                <button onClick={() => setShowRaw((v) => !v)} className="text-xs font-semibold underline decoration-dotted">
                  {showRaw ? t({ it: 'Nascondi risposta', en: 'Hide response' }) : t({ it: 'Mostra risposta ricevuta', en: 'Show received response' })}
                </button>
                {showRaw ? (
                  <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-rose-200 bg-white p-3 text-[11px] text-slate-800">
                    {String(syncResult.contentType || '').trim()
                      ? `content-type: ${syncResult.contentType}\n\n${syncResult.rawSnippet}`
                      : syncResult.rawSnippet}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-ink">{t({ it: 'Utenti importati', en: 'Imported users' })}</div>
            <div className="flex flex-wrap items-center gap-2">
                <input
                  value={usersQuery}
                  onChange={(e) => setUsersQuery(e.target.value)}
                  className="h-10 w-64 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  placeholder={t({ it: 'Cerca per nome/reparto/email…', en: 'Search by name/department/email…' })}
                />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)} />
                {t({ it: 'Mostra nascosti', en: 'Show hidden' })}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={includeMissing} onChange={(e) => setIncludeMissing(e.target.checked)} />
                {t({ it: 'Includi mancanti', en: 'Include missing' })}
              </label>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              <button
                type="button"
                onClick={() => toggleSort('externalId')}
                className="col-span-2 flex items-center gap-1 text-left hover:text-ink"
                title={t({ it: 'Ordina per ID', en: 'Sort by ID' })}
              >
                {t({ it: 'ID', en: 'ID' })} <ArrowUpDown size={12} className="opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => toggleSort('name')}
                className="col-span-4 flex items-center gap-1 text-left hover:text-ink"
                title={t({ it: 'Ordina per nome', en: 'Sort by name' })}
              >
                {t({ it: 'Nome', en: 'Name' })} <ArrowUpDown size={12} className="opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => toggleSort('dept')}
                className="col-span-3 flex items-center gap-1 text-left hover:text-ink"
                title={t({ it: 'Ordina per reparto', en: 'Sort by department' })}
              >
                {t({ it: 'Reparto', en: 'Department' })} <ArrowUpDown size={12} className="opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => toggleSort('alloc')}
                className="col-span-1 flex items-center justify-center gap-1 hover:text-ink"
                title={t({ it: 'Ordina per allocazioni', en: 'Sort by allocations' })}
              >
                {t({ it: 'Alloc.', en: 'Alloc.' })} <ArrowUpDown size={12} className="opacity-70" />
              </button>
              <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
            </div>
            {sortedRows.map((r) => {
              const key = `${r.clientId}:${r.externalId}`;
              const count = assignedCounts.get(key) || 0;
              return (
                <div key={key} className="grid grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-sm hover:bg-slate-50">
                  <div className="col-span-2 font-mono text-[12px] text-slate-700">{r.externalId}</div>
                  <div className="col-span-4 min-w-0">
                    <div className="truncate font-semibold text-ink">
                      {r.firstName} {r.lastName}
                      {!r.present ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{t({ it: 'Mancante', en: 'Missing' })}</span>
                      ) : null}
                      {r.hidden ? (
                        <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{t({ it: 'Nascosto', en: 'Hidden' })}</span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-slate-500">{r.email || ''}</div>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="truncate text-xs text-slate-700">{[r.dept1, r.dept2, r.dept3].filter(Boolean).join(' / ') || '—'}</div>
                  </div>
                  <div className="col-span-1 text-center text-sm font-semibold text-slate-700">{count}</div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setInfoRow(r)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
                      title={t({ it: 'Info', en: 'Info' })}
                    >
                      <Info size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await setExternalUserHidden({ clientId, externalId: r.externalId, hidden: !r.hidden });
                          await loadUsers();
                          push(t({ it: 'Aggiornato', en: 'Updated' }), 'success');
                        } catch {
                          push(t({ it: 'Errore', en: 'Error' }), 'danger');
                        }
                      }}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-ink hover:bg-white"
                      title={r.hidden ? t({ it: 'Mostra utente', en: 'Unhide user' }) : t({ it: 'Nascondi utente', en: 'Hide user' })}
                    >
                      {r.hidden ? t({ it: 'Mostra', en: 'Show' }) : t({ it: 'Nascondi', en: 'Hide' })}
                    </button>
                  </div>
                </div>
              );
            })}
            {!rows.length ? <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div> : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmImport}
        title={t({ it: 'Conferma importazione', en: 'Confirm import' })}
        description={t({
          it:
            confirmImport?.newCount && !confirmImport?.missingCount && !confirmImport?.updatedCount
              ? `Rilevati ${confirmImport.newCount} nuovi utenti, importare?`
              : `Importare le modifiche? Nuovi: ${confirmImport?.newCount || 0}, Aggiornati: ${confirmImport?.updatedCount || 0}, Mancanti: ${confirmImport?.missingCount || 0}. (WebAPI: ${confirmImport?.remoteCount || 0}, Locali: ${confirmImport?.localCount || 0})`,
          en:
            confirmImport?.newCount && !confirmImport?.missingCount && !confirmImport?.updatedCount
              ? `Detected ${confirmImport.newCount} new users. Import now?`
              : `Import changes? New: ${confirmImport?.newCount || 0}, Updated: ${confirmImport?.updatedCount || 0}, Missing: ${confirmImport?.missingCount || 0}. (WebAPI: ${confirmImport?.remoteCount || 0}, Local: ${confirmImport?.localCount || 0})`
        })}
        confirmLabel={t({ it: 'Importa', en: 'Import' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setConfirmImport(null)}
        onConfirm={async () => {
          setConfirmImport(null);
          setSyncResult(null);
          try {
            const res = await syncImport(clientId);
            setSyncResult(res);
            if (res.ok) {
              push(t({ it: 'Import completato', en: 'Import completed' }), 'success');
              await loadUsers();
            } else {
              push(t({ it: 'Import fallito', en: 'Import failed' }), 'danger');
            }
          } catch {
            setSyncResult({ ok: false, error: 'Request failed', contentType: '', rawSnippet: '' });
            push(t({ it: 'Import fallito', en: 'Import failed' }), 'danger');
          } finally {
          }
        }}
      />

      <ConfirmDialog
        open={confirmClearAll}
        title={t({ it: 'Eliminare tutti gli utenti importati?', en: 'Delete all imported users?' })}
        description={t({
          it: 'Procedendo verranno eliminati tutti gli utenti importati per questo cliente e verranno rimossi anche gli oggetti “Utente reale” presenti nelle planimetrie. Operazione non annullabile.',
          en: 'This will delete all imported users for this client and remove all “Real user” objects from its floor plans. This cannot be undone.'
        })}
        confirmLabel={t({ it: 'Elimina tutto', en: 'Delete all' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={async () => {
          setConfirmClearAll(false);
          setClearingAll(true);
          try {
            const res = await clearImport(clientId);
            push(
              t({
                it: `Eliminati ${res.removedUsers} utenti e rimossi ${res.removedObjects} oggetti dalla mappa.`,
                en: `Deleted ${res.removedUsers} users and removed ${res.removedObjects} map objects.`
              }),
              'success'
            );
            await loadUsers();
            try {
              const state = await fetchState();
              if (Array.isArray(state.clients)) setServerState({ clients: state.clients, objectTypes: state.objectTypes });
            } catch {}
          } catch {
            push(t({ it: 'Eliminazione fallita', en: 'Delete failed' }), 'danger');
          } finally {
            setClearingAll(false);
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmRemoveMissing}
        title={t({ it: 'Utente non più presente nella WebAPI', en: 'User no longer present in the WebAPI' })}
        description={t({
          it: `L'utente "${confirmRemoveMissing?.firstName || ''} ${confirmRemoveMissing?.lastName || ''}" (ID ${confirmRemoveMissing?.externalId || ''}) non è più presente nella WebAPI. Vuoi rimuovere anche le sue allocazioni (oggetti "Real User") dalle planimetrie di questo Cliente?`,
          en: `The user "${confirmRemoveMissing?.firstName || ''} ${confirmRemoveMissing?.lastName || ''}" (ID ${confirmRemoveMissing?.externalId || ''}) is no longer present in the WebAPI. Do you want to remove their allocations ("Real User" objects) from this Client’s floor plans as well?`
        })}
        confirmLabel={t({ it: 'Rimuovi oggetti', en: 'Remove objects' })}
        cancelLabel={t({ it: 'Lascia invariato', en: 'Keep' })}
        onCancel={() => setConfirmRemoveMissing(null)}
        onConfirm={() => {
          if (!confirmRemoveMissing) return;
          try {
            removeRealUserAllocations?.(clientId, confirmRemoveMissing.externalId);
            push(
              t({
                it: 'Allocazioni rimosse (salva una revisione per rendere persistente)',
                en: 'Allocations removed (save a revision to make it persistent)'
              }),
              'info'
            );
          } catch {
            push(t({ it: 'Errore', en: 'Error' }), 'danger');
          } finally {
            setConfirmRemoveMissing(null);
          }
        }}
      />

      <Transition appear show={!!infoRow} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setInfoRow(null)}>
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-card transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Dettagli utente', en: 'User details' })}</Dialog.Title>
                    <button onClick={() => setInfoRow(null)} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({ it: 'Campi rilevati (solo non vuoti):', en: 'Detected fields (non-empty only):' })}
                  </Dialog.Description>

                  {infoRow ? (
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      {[
                        ['ID', infoRow.externalId],
                        [t({ it: 'Nome', en: 'First name' }), infoRow.firstName],
                        [t({ it: 'Cognome', en: 'Last name' }), infoRow.lastName],
                        ['Email', infoRow.email],
                        [t({ it: 'Ruolo', en: 'Role' }), infoRow.role],
                        [t({ it: 'Reparto 1', en: 'Department 1' }), infoRow.dept1],
                        [t({ it: 'Reparto 2', en: 'Department 2' }), infoRow.dept2],
                        [t({ it: 'Reparto 3', en: 'Department 3' }), infoRow.dept3],
                        [t({ it: 'Interno 1', en: 'Extension 1' }), infoRow.ext1],
                        [t({ it: 'Interno 2', en: 'Extension 2' }), infoRow.ext2],
                        [t({ it: 'Interno 3', en: 'Extension 3' }), infoRow.ext3],
                        [t({ it: 'Esterno', en: 'External' }), infoRow.isExternal ? '1' : '0'],
                        [t({ it: 'Nascosto', en: 'Hidden' }), infoRow.hidden ? '1' : '0'],
                        [t({ it: 'Presente', en: 'Present' }), infoRow.present ? '1' : '0']
                      ]
                        .filter(([, v]) => String(v || '').trim())
                        .map(([k, v]) => (
                          <div key={String(k)} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-xs font-semibold uppercase text-slate-500">{String(k)}</div>
                            <div className="min-w-0 text-right font-medium text-ink">{String(v)}</div>
                          </div>
                        ))}
                    </div>
                  ) : null}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setInfoRow(null)}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
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
    </div>
  );
};

export default CustomImportPanel;
