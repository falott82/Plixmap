import pkg from '../../../package.json';

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
  classnames: 'Conditional className helper'
};

const NerdAreaPanel = () => {
  const deps = (pkg as any).dependencies || {};
  const devDeps = (pkg as any).devDependencies || {};

  const all = [
    ...Object.entries(deps).map(([name, version]) => ({ name, version, scope: 'dependencies' as const })),
    ...Object.entries(devDeps).map(([name, version]) => ({ name, version, scope: 'devDependencies' as const }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="text-sm font-semibold text-ink">Nerd Area (superadmin)</div>
        <div className="mt-1 text-sm text-slate-600">
          Stack e dipendenze usate per sviluppare Deskly, con versione e scopo.
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Runtime consigliato: <span className="font-semibold text-ink">Node.js 18+</span> (server API + build tools).
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <div className="col-span-4">Pacchetto</div>
          <div className="col-span-2">Versione</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-4">Uso</div>
        </div>
        {all.map((d) => (
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

