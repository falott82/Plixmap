

import { Trash, Plus } from 'lucide-react';

import { nanoid } from 'nanoid';

import { normalizeDoorVerificationHistory } from './planViewUtils';

import { usePlanView } from './usePlanView';

type CorridorDoorModalPanelProps = Pick<ReturnType<typeof usePlanView>, 'corridorDoorModal' | 'push' | 'setCorridorDoorModal' | 't'>;

const CorridorDoorModalPanel = (props: CorridorDoorModalPanelProps) => {
  const {
    corridorDoorModal,
    push,
    setCorridorDoorModal,
    t
  } = props;
  return (
                            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                                {t({ it: 'Verifiche antipanico', en: 'Panic checks' })}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                  {t({ it: 'Data ultima verifica (opzionale)', en: 'Last check date (optional)' })}
                                  <input
                                    type="date"
                                    value={corridorDoorModal?.lastVerificationAt || ''}
                                    onChange={(e) =>
                                      setCorridorDoorModal((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              lastVerificationAt: e.target.value
                                            }
                                          : prev
                                      )
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                  />
                                </label>
                                <label className="text-sm font-semibold text-slate-700">
                                  {t({ it: 'Società verificatrice', en: 'Verifier company' })}
                                  <input
                                    value={corridorDoorModal?.verifierCompany || ''}
                                    onChange={(e) =>
                                      setCorridorDoorModal((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              verifierCompany: e.target.value
                                            }
                                          : prev
                                      )
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                    placeholder={t({ it: 'Es. SafeCheck Srl', en: 'e.g. SafeCheck Ltd' })}
                                  />
                                </label>
                              </div>
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const company = String(corridorDoorModal?.verifierCompany || '').trim();
                                    const date = String(corridorDoorModal?.lastVerificationAt || '').trim();
                                    if (!company && !date) {
                                      push(
                                        t({
                                          it: 'Inserisci almeno società o data per aggiungere una verifica allo storico.',
                                          en: 'Enter at least company or date to add a history check.'
                                        }),
                                        'info'
                                      );
                                      return;
                                    }
                                    setCorridorDoorModal((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            verificationHistory: normalizeDoorVerificationHistory([
                                              { id: nanoid(), company, date: date || undefined, createdAt: Date.now() },
                                              ...(prev.verificationHistory || [])
                                            ])
                                          }
                                        : prev
                                    );
                                  }}
                                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                  title={t({ it: 'Aggiungi verifica allo storico', en: 'Add check to history' })}
                                >
                                  <Plus size={13} />
                                  {t({ it: 'Aggiungi allo storico', en: 'Add to history' })}
                                </button>
                              </div>
                              <div className="mt-3 space-y-2">
                                {(corridorDoorModal?.verificationHistory || []).length ? (
                                  (corridorDoorModal?.verificationHistory || []).map((entry) => (
                                    <div key={entry.id} className="flex items-center justify-between rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-xs">
                                      <div className="min-w-0">
                                        <div className="truncate font-semibold text-slate-700">
                                          {entry.company || t({ it: 'Società non indicata', en: 'Company not specified' })}
                                        </div>
                                        <div className="text-slate-500">
                                          {(entry.date && entry.date.trim()) || t({ it: 'Data non indicata', en: 'Date not specified' })}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCorridorDoorModal((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  verificationHistory: (prev.verificationHistory || []).filter((item) => item.id !== entry.id)
                                                }
                                              : prev
                                          )
                                        }
                                        className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                                        title={t({ it: 'Rimuovi voce storico', en: 'Remove history entry' })}
                                      >
                                        <Trash size={12} />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-lg border border-dashed border-rose-200 bg-white px-2.5 py-2 text-xs text-slate-500">
                                    {t({ it: 'Nessuna verifica storica registrata.', en: 'No historical checks registered.' })}
                                  </div>
                                )}
                              </div>
                            </div>
  );
};

export default CorridorDoorModalPanel;
