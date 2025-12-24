import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, History, Search, X } from 'lucide-react';
import { releaseHistory } from '../../version/history';
import { exportChangelogToPdf } from '../../utils/pdf';
import { useLang, useT } from '../../i18n/useT';

const VersionBadge = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const t = useT();
  const lang = useLang();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (el.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return releaseHistory.filter(
      (r) => r.version.includes(q) || r.notes.some((n) => (lang === 'en' ? n.en : n.it).toLowerCase().includes(q))
    );
  }, [lang, query]);

  const latest = releaseHistory[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-ink shadow-card hover:bg-slate-50"
        title={t({ it: 'Changelog', en: 'Changelog' })}
      >
        <History size={14} />
        v{latest.version}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">{t({ it: 'Changelog', en: 'Changelog' })}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportChangelogToPdf(releaseHistory, { lang })}
                className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-ink hover:bg-slate-50"
                title={t({ it: 'Esporta changelog in PDF', en: 'Export changelog to PDF' })}
              >
                <FileDown size={14} />
                PDF
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-ink"
                title={t({ it: 'Chiudi', en: 'Close' })}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t({ it: 'Cerca in versioni e note', en: 'Search versions and notes' })}
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
                  {rel.notes.map((note, idx) => (
                    <li key={idx}>{lang === 'en' ? note.en : note.it}</li>
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
