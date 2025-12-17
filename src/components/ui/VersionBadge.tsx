import { useMemo, useState } from 'react';
import { FileDown, History, Search, X } from 'lucide-react';
import { releaseHistory } from '../../version/history';
import { exportChangelogToPdf } from '../../utils/pdf';

const VersionBadge = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return releaseHistory.filter(
      (r) => r.version.includes(q) || r.notes.some((n) => n.toLowerCase().includes(q))
    );
  }, [query]);

  const latest = releaseHistory[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-ink shadow-card hover:bg-slate-50"
        title="Changelog"
      >
        <History size={14} />
        v{latest.version}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">Changelog</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportChangelogToPdf(releaseHistory)}
                className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-ink hover:bg-slate-50"
                title="Esporta changelog in PDF"
              >
                <FileDown size={14} />
                PDF
              </button>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-ink" title="Chiudi">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca in versioni e note"
              className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 py-2 text-xs outline-none ring-primary/30 focus:ring-2"
            />
          </div>
          <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
            {filtered.map((rel) => (
              <div key={rel.version} className="rounded-xl bg-slate-50 p-2">
                <div className="flex items-center justify-between text-xs font-semibold text-ink">
                  <span>v{rel.version}</span>
                  <span className="text-slate-500">{rel.date}</span>
                </div>
                <ul className="ml-4 list-disc space-y-1 pt-1 text-xs text-slate-700">
                  {rel.notes.map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default VersionBadge;
