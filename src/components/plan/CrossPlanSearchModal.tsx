import { Fragment, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { MapPin, Square, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import Icon from '../ui/Icon';

export type CrossPlanSearchResult =
  | {
      kind: 'object';
      clientId: string;
      clientName: string;
      siteId: string;
      siteName: string;
      planId: string;
      planName: string;
      objectId: string;
      objectType: string;
      objectLabel: string;
      objectDescription?: string;
    }
  | {
      kind: 'room';
      clientId: string;
      clientName: string;
      siteId: string;
      siteName: string;
      planId: string;
      planName: string;
      roomId: string;
      roomName: string;
    };

interface Props {
  open: boolean;
  currentPlanId: string;
  term: string;
  results: CrossPlanSearchResult[];
  objectTypeIcons: Record<string, any>;
  objectTypeLabels: Record<string, string>;
  onClose: () => void;
  onPick: (result: CrossPlanSearchResult) => void;
}

const CrossPlanSearchModal = ({ open, currentPlanId, term, results, objectTypeIcons, objectTypeLabels, onClose, onPick }: Props) => {
  const t = useT();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return results;
    return results.filter((r) => {
      if (r.kind === 'object') {
        return (
          r.objectLabel.toLowerCase().includes(query) ||
          (r.objectDescription || '').toLowerCase().includes(query) ||
          (objectTypeLabels[r.objectType] || '').toLowerCase().includes(query) ||
          r.planName.toLowerCase().includes(query) ||
          r.siteName.toLowerCase().includes(query) ||
          r.clientName.toLowerCase().includes(query)
        );
      }
      return (
        r.roomName.toLowerCase().includes(query) ||
        r.planName.toLowerCase().includes(query) ||
        r.siteName.toLowerCase().includes(query) ||
        r.clientName.toLowerCase().includes(query)
      );
    });
  }, [objectTypeLabels, q, results]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; items: CrossPlanSearchResult[] }>();
    for (const r of filtered) {
      const key = `${r.clientId}:${r.siteId}:${r.planId}`;
      const title = `${r.clientName} \u2192 ${r.siteName} \u2192 ${r.planName}`;
      const g = map.get(key) || { key, title, items: [] };
      g.items.push(r);
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [filtered]);

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-card transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Risultati ricerca', en: 'Search results' })}</Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {t({
                        it: `Trovati ${results.length} risultati per “${term}”. Seleziona la planimetria da aprire.`,
                        en: `Found ${results.length} results for “${term}”. Choose which floor plan to open.`
                      })}
                    </Dialog.Description>
                  </div>
                  <button onClick={onClose} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="h-10 w-full max-w-md rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                    placeholder={t({ it: 'Filtra risultati…', en: 'Filter results…' })}
                  />
                  <div className="text-xs font-semibold text-slate-600">
                    {t({ it: 'Suggerimento', en: 'Tip' })}: {t({ it: 'clicca un risultato per aprire e lampeggiare.', en: 'click a result to open and blink it.' })}
                  </div>
                </div>

                <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200">
                  {groups.length ? (
                    <div className="divide-y divide-slate-200">
                      {groups.map((g) => {
                        const planId = g.items[0]?.planId;
                        const isCurrent = planId === currentPlanId;
                        return (
                          <div key={g.key} className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-ink">{g.title}</div>
                              {isCurrent ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                  {t({ it: 'Plan corrente', en: 'Current plan' })}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {g.items.map((r, idx) => {
                                const key = r.kind === 'object' ? `o:${r.objectId}` : `r:${r.roomId}`;
                                return (
                                  <button
                                    key={`${key}:${idx}`}
                                    type="button"
                                    onClick={() => onPick(r)}
                                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
                                    title={t({ it: 'Apri e lampeggia', en: 'Open & blink' })}
                                  >
                                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                                      {r.kind === 'object' ? (
                                        <Icon name={objectTypeIcons[r.objectType]} size={18} />
                                      ) : (
                                        <Square size={18} />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      {r.kind === 'object' ? (
                                        <>
                                          <div className="truncate font-semibold text-ink">{r.objectLabel}</div>
                                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600">
                                            <span className="truncate">{objectTypeLabels[r.objectType] || r.objectType}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className="flex items-center gap-1 text-slate-600">
                                              <MapPin size={14} /> {t({ it: 'Apri e lampeggia', en: 'Open & blink' })}
                                            </span>
                                          </div>
                                          {r.objectDescription ? (
                                            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{r.objectDescription}</div>
                                          ) : null}
                                        </>
                                      ) : (
                                        <>
                                          <div className="truncate font-semibold text-ink">{r.roomName}</div>
                                          <div className="mt-0.5 text-xs text-slate-600">{t({ it: 'Stanza', en: 'Room' })}</div>
                                        </>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-slate-600">{t({ it: 'Nessun risultato.', en: 'No results.' })}</div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Chiudi', en: 'Close' })}
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
  );
};

export default CrossPlanSearchModal;
