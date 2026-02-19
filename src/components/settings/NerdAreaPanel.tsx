import { useEffect, useMemo, useState } from 'react';
import pkg from '../../../package.json';
import { Download, ShieldCheck } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useUIStore } from '../../store/useUIStore';
import {
  fetchMigrationStatus,
  fetchNpmAuditStatus,
  fetchReadiness,
  runNpmAudit,
  MigrationStatus,
  NpmAuditResult,
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

const NerdAreaPanel = () => {
  const deps = (pkg as any).dependencies || {};
  const devDeps = (pkg as any).devDependencies || {};
  const t = useT();
  const [pkgQuery, setPkgQuery] = useState('');
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<NpmAuditResult | null>(null);
  const [auditRunAt, setAuditRunAt] = useState<number | null>(null);
  const [auditLastCheckAt, setAuditLastCheckAt] = useState<number | null>(null);
  const [auditLastCheckBy, setAuditLastCheckBy] = useState<string | null>(null);
  const [auditDetailsOpen, setAuditDetailsOpen] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [opsBusy, setOpsBusy] = useState(false);
  const { push } = useToastStore();
  const { perfOverlayEnabled, togglePerfOverlay } = useUIStore(
    (s) => ({ perfOverlayEnabled: (s as any).perfOverlayEnabled, togglePerfOverlay: (s as any).togglePerfOverlay })
  );

  const all = [
    ...Object.entries(deps).map(([name, version]) => ({ name, version, scope: 'dependencies' as const })),
    ...Object.entries(devDeps).map(([name, version]) => ({ name, version, scope: 'devDependencies' as const }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  const filteredPkgs = useMemo(() => {
    const q = pkgQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((d) => {
      const hay = `${d.name} ${d.scope} ${String(d.version)} ${(purposes[d.name] || '')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, pkgQuery]);

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchNpmAuditStatus()
      .then((res) => {
        setAuditLastCheckAt(res.lastCheckAt || null);
        setAuditLastCheckBy(res.lastCheckBy || null);
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

  const auditSummary = auditResult?.summary;
  const auditStamp = auditRunAt ? new Date(auditRunAt).toLocaleString() : '';
  const auditLastStamp = auditLastCheckAt ? new Date(auditLastCheckAt).toLocaleString() : '';
  const auditLastLabel = auditLastStamp ? (auditLastCheckBy ? `${auditLastStamp} • ${auditLastCheckBy}` : auditLastStamp) : '';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="text-sm font-semibold text-ink">{t({ it: 'Nerd Area (superadmin)', en: 'Nerd Area (superadmin)' })}</div>
        <div className="modal-description">
          {t({
            it: 'Stack e dipendenze usate per sviluppare Deskly, con versione e scopo. Include anche strumenti di integrazione avanzata.',
            en: 'Stack and dependencies used to build Deskly, with version and purpose. Includes advanced integration tools.'
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
                downloadText(`deskly-nerd-packages.txt`, ['Package\tVersion\tScope\tPurpose', ...lines].join('\n'));
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
    </div>
  );
};

export default NerdAreaPanel;
