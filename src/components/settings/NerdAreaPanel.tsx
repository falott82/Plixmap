import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import pkg from '../../../package.json';
import { Box, CheckSquare, Copy, Download, DownloadCloud, FileCode2, PackageOpen, RefreshCw, Search, ShieldCheck, Terminal } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useUIStore } from '../../store/useUIStore';
import {
  checkPackageUpdates,
  fetchCodeAnalyzer,
  fetchPackageUpdateStatus,
  fetchMigrationStatus,
  fetchNpmAuditStatus,
  fetchReadiness,
  runNpmAudit,
  CodeAnalyzerResult,
  MigrationStatus,
  NpmAuditResult,
  PackageUpdateResult,
  ReadinessStatus
} from '../../api/nerd';
import { useToastStore } from '../../store/useToast';

const purposes: Record<string, string> = {
  react: 'UI framework',
  'react-dom': 'React rendering',
  vite: 'Dev server + build',
  typescript: 'Type checking',
  zustand: 'State management',
  tailwindcss: 'Styling (utility CSS)',
  '@headlessui/react': 'Accessible modals/popovers',
  konva: 'Canvas engine',
  'react-konva': 'React bindings for Konva',
  'use-image': 'Image loading for Konva',
  'lucide-react': 'Icon set',
  jspdf: 'PDF generation',
  html2canvas: 'DOM → canvas for export',
  express: 'Backend API server',
  'better-sqlite3': 'SQLite persistence',
  nanoid: 'ID generator',
  classnames: 'Conditional className helper',
  ws: 'WebSocket server (realtime locks/presence)',
  speakeasy: 'TOTP MFA',
  qrcode: 'QR code for MFA',
  'vite-plugin-pwa': 'PWA (service worker + install)',
  lexical: 'Rich text editor engine (Client notes)',
  '@lexical/react': 'Lexical React bindings (Client notes)',
  '@lexical/rich-text': 'Rich text nodes for Lexical (Client notes)',
  '@lexical/list': 'Lists for Lexical (Client notes)',
  '@lexical/link': 'Links for Lexical (Client notes)',
  '@lexical/table': 'Tables for Lexical (Client notes)',
  '@lexical/history': 'Undo/redo for Lexical (Client notes)',
  '@lexical/html': 'HTML import/export for Lexical (Client notes)',
  '@lexical/utils': 'Lexical helpers (Client notes)',
  'workbox-precaching': 'PWA precache',
  'workbox-routing': 'PWA routing',
  'workbox-strategies': 'PWA caching strategies',
  'workbox-expiration': 'PWA cache expiration'
};

const backendPackages = new Set([
  'better-sqlite3',
  'express',
  'ldapts',
  'nanoid',
  'nodemailer',
  'qrcode',
  'speakeasy',
  'ws',
  '@types/node'
]);

const NerdAreaPanel = () => {
  const deps = (pkg as any).dependencies || {};
  const devDeps = (pkg as any).devDependencies || {};
  const t = useT();
  const [activeTab, setActiveTab] = useState<'system' | 'packet' | 'code'>('system');
  const [pkgQuery, setPkgQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<NpmAuditResult | null>(null);
  const [auditRunAt, setAuditRunAt] = useState<number | null>(null);
  const [auditLastCheckAt, setAuditLastCheckAt] = useState<number | null>(null);
  const [auditLastCheckBy, setAuditLastCheckBy] = useState<string | null>(null);
  const [auditDetailsOpen, setAuditDetailsOpen] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [opsBusy, setOpsBusy] = useState(false);
  const [packageCheckRunning, setPackageCheckRunning] = useState(false);
  const [packageUpdateResult, setPackageUpdateResult] = useState<PackageUpdateResult | null>(null);
  const [packageLastCheckAt, setPackageLastCheckAt] = useState<number | null>(null);
  const [packageLastCheckBy, setPackageLastCheckBy] = useState<string | null>(null);
  const [packageLastCheckCount, setPackageLastCheckCount] = useState<number | null>(null);
  const [packageCopyOpen, setPackageCopyOpen] = useState(false);
  const [codeAnalyzerRunning, setCodeAnalyzerRunning] = useState(false);
  const [codeAnalyzer, setCodeAnalyzer] = useState<CodeAnalyzerResult | null>(null);
  const { push } = useToastStore();
  // Atomic selectors: returning primitives / stable function refs keeps the store snapshot
  // stable, so this panel no longer re-renders on every unrelated store mutation (zustand v5).
  const perfOverlayEnabled = useUIStore((s) => (s as any).perfOverlayEnabled);
  const togglePerfOverlay = useUIStore((s) => (s as any).togglePerfOverlay);

  const all = useMemo(
    () =>
      [
        ...Object.entries(deps).map(([name, version]) => ({
          name,
          version,
          scope: 'dependencies' as const,
          area: backendPackages.has(name) ? 'backend' : 'frontend'
        })),
        ...Object.entries(devDeps).map(([name, version]) => ({
          name,
          version,
          scope: 'devDependencies' as const,
          area: backendPackages.has(name) ? 'backend' : 'frontend'
        }))
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [deps, devDeps]
  );

  const backendCount = all.filter((d) => d.area === 'backend').length;
  const frontendCount = all.length - backendCount;

  const filteredPkgs = useMemo(() => {
    const q = pkgQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((d) => {
      const hay = `${d.name} ${d.scope} ${String(d.version)} ${(purposes[d.name] || '')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, pkgQuery]);

  const filteredCodeFiles = useMemo(() => {
    const files = codeAnalyzer?.files || [];
    const q = codeQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter((file) => `${file.name} ${file.path}`.toLowerCase().includes(q));
  }, [codeAnalyzer?.files, codeQuery]);

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      push(t({ it: 'Lista copiata negli appunti', en: 'List copied to clipboard' }), 'success');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      push(t({ it: 'Lista copiata negli appunti', en: 'List copied to clipboard' }), 'success');
    }
  };

  useEffect(() => {
    fetchNpmAuditStatus()
      .then((res) => {
        setAuditLastCheckAt(res.lastCheckAt || null);
        setAuditLastCheckBy(res.lastCheckBy || null);
      })
      .catch(() => {});
    fetchPackageUpdateStatus()
      .then((res) => {
        setPackageLastCheckAt(res.lastCheckAt || null);
        setPackageLastCheckBy(res.lastCheckBy || null);
        setPackageLastCheckCount(typeof res.count === 'number' ? res.count : null);
      })
      .catch(() => {});
  }, []);

  const loadOps = async () => {
    if (opsBusy) return;
    setOpsBusy(true);
    try {
      const [ready, migration] = await Promise.all([fetchReadiness(), fetchMigrationStatus()]);
      setReadiness(ready);
      setMigrationStatus(migration);
    } catch {
      setReadiness(null);
      setMigrationStatus(null);
    } finally {
      setOpsBusy(false);
    }
  };

  useEffect(() => {
    void loadOps();
  }, []);

  const loadCodeAnalyzer = async () => {
    if (codeAnalyzerRunning) return;
    setCodeAnalyzerRunning(true);
    try {
      const res = await fetchCodeAnalyzer();
      setCodeAnalyzer(res);
      if (!res.ok) {
        push(t({ it: 'Analisi codice fallita.', en: 'Code analysis failed.' }), 'danger');
      }
    } catch (err: any) {
      setCodeAnalyzer({
        ok: false,
        root: '',
        filesScanned: 0,
        totalLines: 0,
        largestFileLines: 0,
        updatedAt: Date.now(),
        files: [],
        error: err?.message || 'Code analysis failed'
      });
      push(t({ it: 'Analisi codice fallita.', en: 'Code analysis failed.' }), 'danger');
    } finally {
      setCodeAnalyzerRunning(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'code' && !codeAnalyzer) void loadCodeAnalyzer();
  }, [activeTab]);

  const handleRunAudit = async () => {
    if (auditRunning) return;
    setAuditRunning(true);
    setAuditDetailsOpen(false);
    try {
      const res = await runNpmAudit();
      setAuditResult(res);
      setAuditRunAt(Date.now());
      if (typeof res.lastCheckAt === 'number') setAuditLastCheckAt(res.lastCheckAt);
      if (res.lastCheckBy !== undefined) setAuditLastCheckBy(res.lastCheckBy || null);
      if (res.ok) {
        const total = res.summary?.total || 0;
        push(
          total
            ? t({ it: 'Audit completato: vulnerabilita trovate.', en: 'Audit completed: vulnerabilities found.' })
            : t({ it: 'Audit completato: nessuna vulnerabilita high/critical.', en: 'Audit completed: no high/critical vulnerabilities.' }),
          total ? 'info' : 'success'
        );
      } else {
        push(t({ it: 'Audit fallito. Controlla il log.', en: 'Audit failed. Check the log.' }), 'danger');
      }
    } catch (err: any) {
      setAuditResult({ ok: false, error: err?.message || 'Audit failed' });
      push(t({ it: 'Audit fallito. Controlla il server.', en: 'Audit failed. Check the server.' }), 'danger');
    } finally {
      setAuditRunning(false);
    }
  };

  const handleCheckPackageUpdates = async () => {
    if (packageCheckRunning) return;
    setPackageCheckRunning(true);
    try {
      const res = await checkPackageUpdates();
      setPackageUpdateResult(res);
      setPackageLastCheckAt(res.checkedAt || null);
      setPackageLastCheckBy(res.lastCheckBy || null);
      setPackageLastCheckCount(res.count);
      if (res.ok) {
        push(
          res.count
            ? t({ it: 'Controllo aggiornamenti completato: pacchetti da aggiornare trovati.', en: 'Update check completed: packages need updates.' })
            : t({ it: 'Controllo aggiornamenti completato: nessun pacchetto da aggiornare.', en: 'Update check completed: no packages need updates.' }),
          res.count ? 'info' : 'success'
        );
      } else {
        push(t({ it: 'Controllo aggiornamenti fallito.', en: 'Update check failed.' }), 'danger');
      }
    } catch (err: any) {
      setPackageUpdateResult({
        ok: false,
        packages: [],
        count: 0,
        checkedAt: Date.now(),
        error: err?.message || 'Update check failed'
      });
      push(t({ it: 'Controllo aggiornamenti fallito.', en: 'Update check failed.' }), 'danger');
    } finally {
      setPackageCheckRunning(false);
    }
  };

  const auditSummary = auditResult?.summary;
  const auditStamp = auditRunAt ? new Date(auditRunAt).toLocaleString() : '';
  const auditLastStamp = auditLastCheckAt ? new Date(auditLastCheckAt).toLocaleString() : '';
  const auditLastLabel = auditLastStamp ? (auditLastCheckBy ? `${auditLastStamp} • ${auditLastCheckBy}` : auditLastStamp) : '';
  const packageUpdateRows = packageUpdateResult?.packages || [];
  const packageCheckedAt = packageUpdateResult?.checkedAt || packageLastCheckAt;
  const packageCheckedStamp = packageCheckedAt ? new Date(packageCheckedAt).toLocaleString() : '';
  const packageCheckedLabel = packageCheckedStamp ? (packageLastCheckBy ? `${packageCheckedStamp} • ${packageLastCheckBy}` : packageCheckedStamp) : '';
  const packageQueueCount = packageUpdateResult?.count ?? packageLastCheckCount ?? 0;
  const packageCopyText = packageUpdateRows.length
    ? packageUpdateRows.map((row) => `${row.name}\t${row.current}\t${row.wanted}\t${row.latest}\t${row.scope}`).join('\n')
    : t({ it: 'Nessun pacchetto da aggiornare.', en: 'No packages need updates.' });
  const packageCommand = packageUpdateRows.length ? `npm install ${packageUpdateRows.map((row) => `${row.name}@latest`).join(' ')}` : '';
  const codeUpdatedStamp = codeAnalyzer?.updatedAt ? new Date(codeAnalyzer.updatedAt).toLocaleString() : '';
  const formatNumber = (value: number) => new Intl.NumberFormat(undefined).format(value || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'system' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Sistema', en: 'System' })}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('packet')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'packet' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          Packet Manager
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'code' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          Code Analyzer
        </button>
      </div>

      {activeTab === 'code' ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-2xl font-semibold text-ink">
                <FileCode2 size={25} className="text-orange-500" />
                Code Analyzer
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {t({
                  it: 'File sorgente ordinati per numero di righe di codice, dal piu grande al piu piccolo.',
                  en: 'Source files sorted by code lines, from largest to smallest.'
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadCodeAnalyzer()}
              disabled={codeAnalyzerRunning}
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t({ it: 'Aggiorna analisi codice', en: 'Refresh code analysis' })}
            >
              <RefreshCw size={16} className={codeAnalyzerRunning ? 'animate-spin' : ''} />
              {t({ it: 'Aggiorna', en: 'Refresh' })}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="text-sm text-slate-500">{t({ it: 'File scansionati', en: 'Files scanned' })}</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{formatNumber(codeAnalyzer?.filesScanned || 0)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="text-sm text-slate-500">{t({ it: 'Totale righe', en: 'Total lines' })}</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{formatNumber(codeAnalyzer?.totalLines || 0)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="text-sm text-slate-500">{t({ it: 'File piu grande', en: 'Largest file' })}</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatNumber(codeAnalyzer?.largestFileLines || 0)} {t({ it: 'righe', en: 'lines' })}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="text-sm text-slate-500">{t({ it: 'Aggiornato', en: 'Updated' })}</div>
              <div className="mt-2 text-sm font-semibold text-ink">{codeUpdatedStamp || '-'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink">
                  {t({ it: 'Classifica file', en: 'File ranking' })} ({filteredCodeFiles.length})
                </div>
                <div className="mt-1 truncate text-sm text-slate-500">
                  {t({ it: 'Radice progetto', en: 'Project root' })}: <span className="font-mono">{codeAnalyzer?.root || '-'}</span>
                </div>
              </div>
              <div className="flex min-w-[260px] flex-1 justify-end gap-2 md:max-w-md">
                <div className="relative w-full">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-primary"
                    placeholder={t({ it: 'Cerca percorso file', en: 'Search file path' })}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
              <div className="col-span-1">#</div>
              <div className="col-span-3">{t({ it: 'Nome file', en: 'File name' })}</div>
              <div className="col-span-2 text-right">{t({ it: 'Righe codice', en: 'Code lines' })}</div>
              <div className="col-span-1 text-right">Hook</div>
              <div className="col-span-1 text-right">Resp.</div>
              <div className="col-span-1 text-right">JSX</div>
              <div className="col-span-1 text-right">{t({ it: 'Funz.', en: 'Func.' })}</div>
              <div className="col-span-1 text-right">Props</div>
              <div className="col-span-1 text-right">{t({ it: 'Peso', en: 'Size' })}</div>
            </div>
            {codeAnalyzerRunning && !codeAnalyzer ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">{t({ it: 'Analisi in corso...', en: 'Analyzing...' })}</div>
            ) : filteredCodeFiles.length ? (
              filteredCodeFiles.map((file) => (
                <div key={file.path} className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50">
                  <div className="col-span-1">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700">
                      {file.rank}
                    </span>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-[12px] text-ink" title={file.path}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyText(file.path)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-ink"
                        title={t({ it: 'Copia percorso file', en: 'Copy file path' })}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2 text-right font-mono text-[12px] font-semibold text-ink">{formatNumber(file.codeLines)}</div>
                  <div className="col-span-1 text-right">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{file.hooks}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{file.responsive}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{file.jsx}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">{file.functions}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      {file.propTypes}T/{file.propRefs}p
                    </span>
                  </div>
                  <div className="col-span-1 text-right text-xs font-semibold text-slate-500">{file.weight}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {codeAnalyzer?.error || t({ it: 'Nessun file da mostrare.', en: 'No files to show.' })}
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'packet' ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <PackageOpen size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-ink">Packet Manager</div>
                  <div className="text-sm text-slate-600">
                    {t({
                      it: 'Registro operativo dei pacchetti backend e frontend con versioni, advisory e update queue.',
                      en: 'Operational registry for backend and frontend packages with versions, advisories and update queue.'
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-start justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPackageCopyOpen(true)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50"
                  title={t({ it: 'Mostra e copia la lista dei pacchetti da aggiornare', en: 'Show and copy the list of packages to update' })}
                >
                  <Terminal size={16} className="text-slate-700" />
                  {t({ it: 'Copia lista', en: 'Copy list' })}
                </button>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleCheckPackageUpdates}
                    disabled={packageCheckRunning}
                    className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    title={t({ it: 'Verifica gli aggiornamenti disponibili per tutti i pacchetti', en: 'Check available updates for all packages' })}
                  >
                    <RefreshCw size={16} className={packageCheckRunning ? 'animate-spin' : ''} />
                    {packageCheckRunning ? t({ it: 'Check...', en: 'Checking...' }) : t({ it: 'Check Updates', en: 'Check Updates' })}
                  </button>
                  <div className="mt-1 text-xs text-slate-500">
                    {packageCheckedLabel ? `${t({ it: 'Last Check', en: 'Last Check' })} ${packageCheckedLabel}` : t({ it: 'Nessun check eseguito', en: 'No check run yet' })}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <Box size={16} className="text-orange-500" />
                <span className="font-semibold text-ink">{backendCount}</span>
                <span className="text-xs text-slate-500">backend</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm">
                <PackageOpen size={16} className="text-emerald-600" />
                <span className="font-semibold text-ink">{frontendCount}</span>
                <span className="text-xs text-slate-500">frontend</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm">
                <CheckSquare size={16} className="text-primary" />
                <span className="font-semibold text-ink">{packageQueueCount}</span>
                <span className="text-xs text-slate-500">{t({ it: 'in coda', en: 'queued' })}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registry</div>
                  <div className="mt-2 text-2xl font-semibold text-ink">{all.length}</div>
                </div>
                <Box size={28} className="text-slate-300" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update Queue</div>
                  <div className="mt-2 text-2xl font-semibold text-primary">{packageQueueCount}</div>
                </div>
                <DownloadCloud size={28} className="text-sky-200" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advisory</div>
                  <div className={`mt-2 text-2xl font-semibold ${(auditSummary?.total || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {auditSummary?.total || 0}
                  </div>
                </div>
                <ShieldCheck size={28} className={(auditSummary?.total || 0) > 0 ? 'text-rose-200' : 'text-emerald-200'} />
              </div>
            </div>
          </div>

          {packageUpdateResult?.error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {packageUpdateResult.error}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white shadow-card">
            <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              <div className="col-span-4">{t({ it: 'Pacchetto', en: 'Package' })}</div>
              <div className="col-span-2">{t({ it: 'Installata', en: 'Installed' })}</div>
              <div className="col-span-2">Wanted</div>
              <div className="col-span-2">Latest</div>
              <div className="col-span-2">{t({ it: 'Tipo', en: 'Scope' })}</div>
            </div>
            {packageUpdateRows.length ? (
              packageUpdateRows.map((row) => (
                <div key={row.name} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-slate-50">
                  <div className="col-span-4 font-mono text-[12px] text-ink">{row.name}</div>
                  <div className="col-span-2 font-mono text-[12px] text-slate-700">{row.current || '-'}</div>
                  <div className="col-span-2 font-mono text-[12px] text-slate-700">{row.wanted || '-'}</div>
                  <div className="col-span-2 font-mono text-[12px] font-semibold text-primary">{row.latest || '-'}</div>
                  <div className="col-span-2 text-xs font-semibold text-slate-600">{row.scope}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {packageUpdateResult
                  ? t({ it: 'Nessun pacchetto da aggiornare.', en: 'No packages need updates.' })
                  : t({ it: 'Esegui Check Updates per popolare la coda.', en: 'Run Check Updates to populate the queue.' })}
              </div>
            )}
          </div>

          <Dialog open={packageCopyOpen} onClose={() => setPackageCopyOpen(false)} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Pacchetti da aggiornare', en: 'Packages to update' })}</Dialog.Title>
                  </div>
                  <Dialog.Description className="modal-description">
                    {t({
                      it: 'Lista generata dall’ultimo Check Updates. Puoi copiare la lista o il comando npm suggerito.',
                      en: 'List generated by the last Check Updates. You can copy the list or the suggested npm command.'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 space-y-3">
                    <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                      {packageCopyText}
                    </pre>
                    {packageCommand ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Comando suggerito', en: 'Suggested command' })}</div>
                        <code className="mt-2 block overflow-auto whitespace-pre-wrap text-[12px] text-slate-800">{packageCommand}</code>
                      </div>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => void copyText(packageCopyText)}
                      className="btn-secondary"
                    >
                      <Copy size={16} />
                      {t({ it: 'Copia lista', en: 'Copy list' })}
                    </button>
                    {packageCommand ? (
                      <button type="button" onClick={() => void copyText(packageCommand)} className="btn-secondary">
                        <Terminal size={16} />
                        {t({ it: 'Copia comando', en: 'Copy command' })}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setPackageCopyOpen(false)} className="btn-primary">
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </div>
            </div>
          </Dialog>
        </>
      ) : (
        <>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="text-sm font-semibold text-ink">{t({ it: 'Nerd Area (superadmin)', en: 'Nerd Area (superadmin)' })}</div>
        <div className="modal-description">
          {t({
            it: 'Stack e dipendenze usate per sviluppare Plixmap, con versione e scopo. Include anche strumenti di integrazione avanzata.',
            en: 'Stack and dependencies used to build Plixmap, with version and purpose. Includes advanced integration tools.'
          })}
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {t({ it: 'Runtime consigliato', en: 'Recommended runtime' })}:{' '}
          <span className="font-semibold text-ink">Node.js 18+</span> ({t({ it: 'server API + build tools', en: 'API server + build tools' })}).
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Telemetria', en: 'Telemetry' })}</div>
            <div className="mt-1 text-xs text-slate-600">
              {t({
                it: 'Mostra il pannello prestazioni per analizzare rallentamenti (solo locale).',
                en: 'Show the performance panel to investigate slowdowns (local only).'
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">{t({ it: 'On/Off', en: 'On/Off' })}</span>
            <button
              type="button"
              onClick={togglePerfOverlay}
              role="switch"
              aria-checked={!!perfOverlayEnabled}
              className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                perfOverlayEnabled ? 'border-primary bg-primary/80' : 'border-slate-200 bg-slate-200'
              }`}
              title={t({ it: 'Abilita telemetria', en: 'Enable telemetry' })}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  perfOverlayEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Stato runtime', en: 'Runtime status' })}</div>
            <div className="mt-1 text-xs text-slate-600">
              {t({
                it: 'Readiness API, client WebSocket connessi e stato migrazioni database.',
                en: 'API readiness, connected WebSocket clients and database migration status.'
              })}
            </div>
          </div>
          <button
            onClick={() => void loadOps()}
            disabled={opsBusy}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {opsBusy ? t({ it: 'Aggiornamento…', en: 'Refreshing…' }) : t({ it: 'Aggiorna stato', en: 'Refresh status' })}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className={`rounded-full px-2 py-1 ${readiness?.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {t({ it: 'Readiness', en: 'Readiness' })}: {readiness?.ok ? 'OK' : 'N/A'}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            WS: {Number(readiness?.wsClients || 0)}
          </span>
          <span className={`rounded-full px-2 py-1 ${migrationStatus?.upToDate ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {t({ it: 'Migrazioni', en: 'Migrations' })}:{' '}
            {migrationStatus ? `${migrationStatus.schemaVersion}/${migrationStatus.latestVersion}` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck size={16} className="text-emerald-500" />
              {t({ it: 'Check sicurezza', en: 'Security check' })}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {t({
                it: 'Esegue npm audit --omit=dev --audit-level=high sul server.',
                en: 'Runs npm audit --omit=dev --audit-level=high on the server.'
              })}
            </div>
            {auditLastLabel ? (
              <div className="mt-1 text-xs font-semibold text-sky-600">
                {t({ it: 'Ultimo check salvato', en: 'Last check saved' })}: {auditLastLabel}
              </div>
            ) : null}
          </div>
          <button
            onClick={handleRunAudit}
            disabled={auditRunning}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            title={t({ it: 'Esegui il check sicurezza delle dipendenze sul server', en: 'Run the dependency security check on the server' })}
          >
            {auditRunning ? t({ it: 'In corso...', en: 'Running...' }) : t({ it: 'Esegui check', en: 'Run check' })}
          </button>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">{t({ it: 'Comandi rapidi', en: 'Quick commands' })}</div>
          <div className="mt-1">
            {t({ it: 'Locale (npm):', en: 'Local (npm):' })}{' '}
            <code className="font-mono text-[11px] text-slate-800">npm run audit:prod</code>
          </div>
          <div className="mt-1">
            {t({ it: 'Docker:', en: 'Docker:' })}{' '}
            <code className="font-mono text-[11px] text-slate-800">docker compose exec deskly npm run audit:prod</code>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {t({
              it: 'Se trovi vulnerabilita high/critical, aggiorna le dipendenze e ripubblica.',
              en: 'If high/critical vulnerabilities are found, update dependencies and republish.'
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          {auditSummary ? (
            <>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                {t({ it: 'Totale', en: 'Total' })}: {auditSummary.total}
              </span>
              <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Critical: {auditSummary.critical}</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">High: {auditSummary.high}</span>
              <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">Moderate: {auditSummary.moderate}</span>
              <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">Low: {auditSummary.low}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Info: {auditSummary.info}</span>
            </>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
              {t({ it: 'Nessun controllo eseguito', en: 'No checks run yet' })}
            </span>
          )}
          {auditStamp ? <span className="text-[11px] text-slate-400">{auditStamp}</span> : null}
        </div>
        {auditResult?.error ? (
          <div className="mt-2 text-xs font-semibold text-rose-600">{auditResult.error}</div>
        ) : null}
        {auditResult?.stderr ? (
          <div className="mt-2">
            <button
              onClick={() => setAuditDetailsOpen((prev) => !prev)}
              className="text-xs font-semibold text-slate-600 hover:text-ink"
              title={
                auditDetailsOpen
                  ? t({ it: 'Nasconde i dettagli del check', en: 'Hide audit details' })
                  : t({ it: 'Mostra i dettagli del check', en: 'Show audit details' })
              }
            >
              {auditDetailsOpen ? t({ it: 'Nascondi dettagli', en: 'Hide details' }) : t({ it: 'Mostra dettagli', en: 'Show details' })}
            </button>
            {auditDetailsOpen ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                {auditResult.stderr}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Dipendenze', en: 'Dependencies' })}</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={pkgQuery}
              onChange={(e) => setPkgQuery(e.target.value)}
              className="h-10 w-64 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
              placeholder={t({ it: 'Cerca pacchetto…', en: 'Search package…' })}
            />
            <button
              onClick={() => {
                const lines = filteredPkgs.map((d) => `${d.name}\t${String(d.version)}\t${d.scope}\t${purposes[d.name] || '-'}`);
                downloadText(`plixmap-nerd-packages.txt`, ['Package\tVersion\tScope\tPurpose', ...lines].join('\n'));
              }}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50"
              title={t({ it: 'Esporta elenco pacchetti', en: 'Export package list' })}
            >
              <Download size={16} className="text-slate-600" />
              {t({ it: 'Esporta', en: 'Export' })}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <div className="col-span-4">{t({ it: 'Pacchetto', en: 'Package' })}</div>
          <div className="col-span-2">{t({ it: 'Versione', en: 'Version' })}</div>
          <div className="col-span-2">{t({ it: 'Tipo', en: 'Scope' })}</div>
          <div className="col-span-4">{t({ it: 'Uso', en: 'Purpose' })}</div>
        </div>
        {filteredPkgs.map((d) => (
          <div key={`${d.scope}:${d.name}`} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-slate-50">
            <div className="col-span-4 font-mono text-[12px] text-ink">{d.name}</div>
            <div className="col-span-2 font-mono text-[12px] text-slate-700">{String(d.version)}</div>
            <div className="col-span-2 text-xs font-semibold text-slate-600">{d.scope}</div>
            <div className="col-span-4 text-xs text-slate-600">{purposes[d.name] || '—'}</div>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
};

export default NerdAreaPanel;
