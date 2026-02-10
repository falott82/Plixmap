import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FileDown, History, Search, X } from 'lucide-react';
import { releaseHistory } from '../../version/history';
import { exportChangelogToPdf } from '../../utils/pdf';
import { useLang, useT } from '../../i18n/useT';
import { useUIStore } from '../../store/useUIStore';
import { shallow } from 'zustand/shallow';

const ChangelogPanel = () => {
  const { changelogOpen, closeChangelog } = useUIStore((s) => ({ changelogOpen: s.changelogOpen, closeChangelog: s.closeChangelog }), shallow);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const t = useT();
  const lang = useLang();

  useEffect(() => {
    if (!changelogOpen) return;
    setQuery('');
    // Scroll to top when reopening.
    window.setTimeout(() => {
      try {
        ref.current?.scrollTo?.({ top: 0 });
      } catch {}
    }, 0);
  }, [changelogOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return releaseHistory;
    return releaseHistory.filter(
      (r) => r.version.includes(q) || r.notes.some((n) => (lang === 'en' ? n.en : n.it).toLowerCase().includes(q))
    );
  }, [lang, query]);

  const latest = releaseHistory[0];

  return (
    <Transition show={changelogOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeChangelog}>
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
              <Dialog.Panel className="w-full max-w-2xl modal-panel">
                <div className="modal-header items-center">
                  <div className="min-w-0">
                    <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
                      <History size={18} className="text-primary" />
                      {t({ it: 'Changelog', en: 'Changelog' })}
                    </Dialog.Title>
                    {latest?.version ? <div className="text-xs font-semibold text-slate-500">v{latest.version}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportChangelogToPdf(releaseHistory, { lang })}
                      className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-ink hover:bg-slate-50"
                      title={t({ it: 'Esporta changelog in PDF', en: 'Export changelog to PDF' })}
                    >
                      <FileDown size={16} />
                      PDF
                    </button>
                    <button onClick={closeChangelog} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="relative mt-4">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t({ it: 'Cerca in versioni e note…', en: 'Search versions and notes…' })}
                    className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
                  />
                </div>

                <div ref={ref} className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto">
                  {filtered.map((rel) => (
                    <div key={rel.version} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                        <span className="shrink-0">v{rel.version}</span>
                        <span className="shrink-0 text-xs font-semibold text-slate-500">{rel.date}</span>
                      </div>
                      <ul className="ml-4 list-disc space-y-1 pt-2 text-sm text-slate-700">
                        {rel.notes.map((note, idx) => (
                          <li key={idx}>{lang === 'en' ? note.en : note.it}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {!filtered.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      {t({ it: 'Nessun risultato.', en: 'No results.' })}
                    </div>
                  ) : null}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ChangelogPanel;

