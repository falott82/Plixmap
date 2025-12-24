import { useMemo, useState } from 'react';
import pkg from '../../../package.json';
import { Download } from 'lucide-react';
import { useT } from '../../i18n/useT';

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
  exceljs: 'Excel export',
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="text-sm font-semibold text-ink">{t({ it: 'Nerd Area (superadmin)', en: 'Nerd Area (superadmin)' })}</div>
        <div className="mt-1 text-sm text-slate-600">
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
