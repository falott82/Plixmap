/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarChart3, Plus } from 'lucide-react';
import { normalizeActionProgress } from './MeetingNotesModal.helpers';

// "Actions" tab (task table) extracted from MeetingNotesModal.
export const MeetingNotesActionsTab = (props: any) => {
  const { normalizedManagerActions, setManagerActionField, canManageMeeting, openManageActionModal, setActionsInsightsModalOpen, addManagerAction, t } = props;
  return (
                          <section className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-4">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                              <table className="min-w-full border-collapse text-sm text-slate-700">
                                <thead className="bg-slate-100 text-xs uppercase tracking-[0.14em] text-slate-600">
                                  <tr>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Descrizione attività da eseguire', en: 'Task description' })}>
                                      {t({ it: 'Task', en: 'Task' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Persona o team assegnato', en: 'Assigned owner' })}>
                                      {t({ it: 'Assegnata a', en: 'Assigned to' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Data apertura task', en: 'Task opening date' })}>
                                      {t({ it: 'Apertura', en: 'Opening date' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Data obiettivo chiusura task', en: 'Task target completion date' })}>
                                      {t({ it: 'Completamento', en: 'Completion date' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Stato operativo della task', en: 'Task operational status' })}>
                                      {t({ it: 'Stato', en: 'Status' })}
                                    </th>
                                    <th className="px-3 py-2 text-center" title={t({ it: 'Azioni disponibili sulla riga', en: 'Available row actions' })}>
                                      {t({ it: 'Azioni', en: 'Actions' })}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {normalizedManagerActions.length ? (
                                    normalizedManagerActions.map((row: any, index: number) => {
                                      const progressPct = normalizeActionProgress(Number(row.progressPct || 0));
                                      const isNotNeeded = row.status === 'not_needed';
                                      const isDone = !isNotNeeded && progressPct >= 100;
                                      const rowHasPayload = !!(
                                        String(row.action || '').trim() ||
                                        String(row.assignedTo || '').trim() ||
                                        String(row.openingDate || '').trim() ||
                                        String(row.completionDate || '').trim() ||
                                        progressPct > 0 ||
                                        row.status === 'not_needed' ||
                                        row.status === 'done'
                                      );
                                      const rowNeedsTitle = rowHasPayload && !String(row.action || '').trim();
                                      const rowTone = isNotNeeded ? 'bg-slate-100' : isDone ? 'bg-emerald-50' : 'bg-amber-50';
                                      const barTone = isNotNeeded ? 'bg-slate-400' : isDone ? 'bg-emerald-500' : 'bg-amber-500';
                                      const statusLabel = isNotNeeded
                                        ? t({ it: 'Non necessaria', en: 'Not needed' })
                                        : isDone
                                          ? t({ it: 'Completata', en: 'Done' })
                                          : t({ it: 'In corso', en: 'In progress' });
                                      return (
                                        <tr
                                          key={`manager-action-${index}`}
                                          className={`border-t border-slate-200 align-top ${rowTone}`}
                                        >
                                          <td className="px-3 py-2">
                                            <input
                                              value={String(row.action || '')}
                                              onChange={(e) => setManagerActionField(index, 'action', e.target.value)}
                                              disabled={!canManageMeeting}
                                              aria-invalid={rowNeedsTitle}
                                              className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100 ${
                                                rowNeedsTitle ? 'border-rose-300 focus:ring-rose-200' : 'border-slate-200'
                                              }`}
                                              placeholder={t({ it: 'Azione da completare', en: 'Action to complete' })}
                                              title={
                                                rowNeedsTitle
                                                  ? t({ it: 'Titolo task obbligatorio prima del salvataggio', en: 'Task title is required before saving' })
                                                  : t({ it: 'Descrizione attività', en: 'Task description' })
                                              }
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input
                                              value={String(row.assignedTo || '')}
                                              onChange={(e) => setManagerActionField(index, 'assignedTo', e.target.value)}
                                              disabled={!canManageMeeting}
                                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                              placeholder={t({ it: 'Assegnata a (testo libero)', en: 'Assigned to (free text)' })}
                                              title={t({ it: 'Assegnatario attività', en: 'Task owner' })}
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input
                                              type="date"
                                              value={String(row.openingDate || '')}
                                              onChange={(e) => setManagerActionField(index, 'openingDate', e.target.value)}
                                              disabled={!canManageMeeting}
                                              className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                              title={t({ it: 'Data apertura task', en: 'Task opening date' })}
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input
                                              type="date"
                                              value={String(row.completionDate || '')}
                                              onChange={(e) => setManagerActionField(index, 'completionDate', e.target.value)}
                                              disabled={!canManageMeeting}
                                              className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                              title={t({ it: 'Data obiettivo completamento', en: 'Target completion date' })}
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                                <span>{statusLabel}</span>
                                                <span>{isNotNeeded ? '—' : `${progressPct}%`}</span>
                                              </div>
                                              <div className="mt-1 h-2 rounded-full bg-slate-200" title={t({ it: 'Avanzamento task', en: 'Task progress' })}>
                                                <span className={`block h-2 rounded-full ${barTone}`} style={{ width: `${isNotNeeded ? 100 : progressPct}%` }} />
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => openManageActionModal(index)}
                                              className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                                              title={t({ it: 'Gestisci avanzamento e stato task', en: 'Manage task progress and status' })}
                                            >
                                              {t({ it: 'Gestisci', en: 'Manage' })}
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                        {t({ it: 'Nessuna azione inserita', en: 'No actions added' })}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setActionsInsightsModalOpen(true)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                title={t({
                                  it: 'Apri grafici e statistiche azioni',
                                  en: 'Open action charts and statistics'
                                })}
                              >
                                <BarChart3 size={15} />
                              </button>
                              {canManageMeeting ? (
                                <button
                                  type="button"
                                  onClick={addManagerAction}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  title={t({ it: 'Nuova azione', en: 'New action' })}
                                >
                                  <Plus size={16} />
                                </button>
                              ) : null}
                            </div>
                          </section>
  );
};
