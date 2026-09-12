/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

// Task charts/statistics modal extracted from MeetingNotesModal.
export const MeetingNotesActionsInsightsModal = (props: any) => {
  const { actionsInsightsModalOpen, closeActionsInsightsModal, actionInsightsDialogInitialFocusRef, actionInsights, t } = props;
  return (
      <Transition show={actionsInsightsModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[161]" onClose={closeActionsInsightsModal} initialFocus={actionInsightsDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={actionInsightsDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Grafici e statistiche task', en: 'Task charts and statistics' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">{actionInsights.total} {t({ it: 'task in analisi', en: 'tasks in analysis' })}</div>
                    </div>
                    <button
                      type="button"
                      onClick={closeActionsInsightsModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi grafici', en: 'Close charts' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t({ it: 'Barre percentuali task', en: 'Task percentage bars' })}
                      </div>
                      <div className="mt-3 space-y-2">
                        {actionInsights.taskProgressBars.length ? (
                          actionInsights.taskProgressBars.map((entry: any) => (
                            <div key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                                <span className="truncate">
                                  {`${String(entry.row.action || '').trim() || `${t({ it: 'Task', en: 'Task' })} ${entry.index + 1}`} (${entry.openingLabel} -> ${entry.completionLabel}, ${entry.daysLeftLabel})`}
                                </span>
                                <span>{entry.row.status === 'not_needed' ? t({ it: 'N/A', en: 'N/A' }) : `${entry.progressPct}%`}</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-200">
                                <span className={`block h-2 rounded-full ${entry.tone}`} style={{ width: `${entry.row.status === 'not_needed' ? 100 : entry.progressPct}%` }} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                            {t({ it: 'Aggiungi task per vedere i grafici', en: 'Add tasks to view charts' })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t({ it: 'Fatte vs da fare', en: 'Done vs to-do' })}
                        </div>
                        <div className="mt-3 flex items-center gap-4">
                          <div
                            className="h-24 w-24 rounded-full border border-slate-200"
                            style={{
                              background: `conic-gradient(#16a34a 0deg ${
                                actionInsights.total ? Math.round((actionInsights.done / actionInsights.total) * 360) : 0
                              }deg, #cbd5e1 ${
                                actionInsights.total ? Math.round((actionInsights.done / actionInsights.total) * 360) : 0
                              }deg 360deg)`
                            }}
                            title={t({ it: 'Grafico torta azioni completate e rimanenti', en: 'Pie chart of completed and pending actions' })}
                          />
                          <div className="text-sm text-slate-700">
                            <div>{t({ it: 'Completate', en: 'Completed' })}: {actionInsights.done}</div>
                            <div>{t({ it: 'In corso', en: 'In progress' })}: {actionInsights.inProgress}</div>
                            <div>{t({ it: 'Non necessarie', en: 'Not needed' })}: {actionInsights.notNeeded}</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Percentuale task completate', en: 'Completed task rate' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Tasso completamento', en: 'Completion rate' })}</div>
                          <div className="mt-1 text-lg font-semibold text-emerald-700">{actionInsights.completionRate}%</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Tempo medio tra apertura e chiusura task', en: 'Average time from opening to closure' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Tempo medio', en: 'Avg resolution' })}</div>
                          <div className="mt-1 text-lg font-semibold text-slate-800">{actionInsights.avgResolutionDays || 0}d</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Task oltre la data prevista', en: 'Tasks overdue' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'In ritardo', en: 'Overdue' })}</div>
                          <div className="mt-1 text-lg font-semibold text-rose-700">{actionInsights.overdue}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Task attualmente in lavorazione', en: 'Tasks currently in progress' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'In corso', en: 'In progress' })}</div>
                          <div className="mt-1 text-lg font-semibold text-amber-700">{actionInsights.inProgress}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
