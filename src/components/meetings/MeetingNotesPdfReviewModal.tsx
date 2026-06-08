/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Download, Loader2, X } from 'lucide-react';
import { normalizePdfText, normalizeActionProgress, formatIsoDayLabel, formatStamp, normalizePdfNoteText } from './MeetingNotesModal.helpers';

// PDF report review/preview modal extracted from MeetingNotesModal.
export const MeetingNotesPdfReviewModal = (props: any) => {
  const {
    pdfReviewModalOpen,
    closePdfReviewModal,
    pdfReviewDialogInitialFocusRef,
    selectedClient,
    selectedSite,
    selectedFloorPlan,
    meeting,
    invitedParticipants,
    reportParticipantsColumns,
    reportChainRows,
    managerFields,
    reportNextMeeting,
    reportActions,
    selectedNotesForPdf,
    actionInsights,
    exportNotesPdf,
    pdfExporting,
    t
  } = props;
  return (
      <Transition show={pdfReviewModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[164]" onClose={closePdfReviewModal} initialFocus={pdfReviewDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={pdfReviewDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Rivedi report PDF', en: 'Review report PDF' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Controlla il contenuto del report prima della generazione.',
                          en: 'Review report content before generating the PDF.'
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closePdfReviewModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi review', en: 'Close review' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-3 px-4 py-3">
                    <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3">
                      <article
                        className="mx-auto w-full max-w-[780px] space-y-4 rounded-xl border border-slate-300 bg-white p-4 text-slate-800 shadow-sm"
                        style={{ fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif' }}
                      >
                        <section className="rounded-xl bg-blue-800 px-4 py-3 text-white">
                          <div className="text-lg font-semibold">{t({ it: 'Report meeting manager', en: 'Meeting manager report' })}</div>
                          <div className="mt-1 text-sm text-blue-100">{`${String(selectedClient?.name || meeting.clientId || '-')} • ${String(selectedSite?.name || meeting.siteId || '-')} • ${String(
                            selectedFloorPlan?.name || meeting.floorPlanId || '-'
                          )}`}</div>
                          <div className="text-sm text-blue-100">{`${String(meeting.roomName || '-')} • ${new Date(Number(meeting.startAt || 0)).toLocaleDateString()} • ${new Date(
                            Number(meeting.startAt || 0)
                          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(Number(meeting.endAt || 0)).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`}</div>
                          <div className="mt-1 text-sm font-semibold">{`${t({ it: 'Riunione', en: 'Meeting' })}: ${String(
                            meeting.subject || t({ it: 'Senza oggetto', en: 'Untitled' })
                          )}`}</div>
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Partecipanti', en: 'Participants' })}</div>
                          {invitedParticipants.length ? (
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                              {Array.from({ length: Math.max(reportParticipantsColumns.left.length, reportParticipantsColumns.right.length) }).map((_: any, rowIndex: number) => {
                                const left = reportParticipantsColumns.left[rowIndex];
                                const right = reportParticipantsColumns.right[rowIndex];
                                const renderCell = (person?: any) => {
                                  if (!person) return <span className="text-slate-400">—</span>;
                                  const locationLabel = person.remote ? 'remote' : 'on site';
                                  const secondary =
                                    person.kind === 'internal' ? String(person.department || '').trim() : String(person.company || '').trim();
                                  return (
                                    <span>
                                      <span className="font-semibold">{person.name}</span>
                                      <span className="text-slate-500">{` (${locationLabel})${secondary ? ` • ${secondary}` : ''}`}</span>
                                    </span>
                                  );
                                };
                                return (
                                  <div key={`pdf-preview-participants-row-${rowIndex}`} className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-sm last:border-b-0">
                                    <div className="border-r border-slate-200 px-3 py-2">{renderCell(left)}</div>
                                    <div className="px-3 py-2">{renderCell(right)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                              {t({ it: 'Nessun partecipante disponibile', en: 'No participants available' })}
                            </div>
                          )}
                        </section>

                        {String((meeting as any)?.followUpOfMeetingId || '').trim() || reportChainRows.length > 1 ? (
                          <section className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Chain follow-up', en: 'Follow-up chain' })}</div>
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                              {reportChainRows.map((row: any) => {
                                const phaseTone =
                                  row.phase === 'past'
                                    ? 'bg-slate-100 text-slate-700'
                                    : row.phase === 'current'
                                      ? 'bg-emerald-50 text-emerald-800'
                                      : 'bg-sky-50 text-sky-800';
                                return (
                                  <div key={`pdf-preview-chain-${row.id}`} className={`grid grid-cols-[46px,120px,120px,minmax(0,1fr)] border-b border-slate-200 px-2 py-2 text-xs last:border-b-0 ${phaseTone}`}>
                                    <div className="font-semibold">{String(row.index + 1).padStart(2, '0')}</div>
                                    <div>{new Date(Number(row.entry.meeting.startAt || 0)).toLocaleDateString()}</div>
                                    <div>{row.phaseLabel}</div>
                                    <div className="truncate">{`${String(row.entry.meeting.subject || t({ it: 'Riunione', en: 'Meeting' }))} • ${String(
                                      row.entry.meeting.roomName || '-'
                                    )}`}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ) : null}

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Temi e sommario', en: 'Topics and summary' })}</div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t({ it: 'Temi trattati', en: 'Topics discussed' })}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{normalizePdfText(String(managerFields.topicsText || '')) || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t({ it: 'Sommario generale', en: 'General summary' })}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{normalizePdfText(String(managerFields.summaryText || '')) || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{t({ it: 'Prossima riunione', en: 'Next meeting' })}</div>
                            <div className="mt-1 text-sm font-semibold">{`${reportNextMeeting.dateLabel} (${reportNextMeeting.dayLabel})`}</div>
                            <div className="text-sm">{reportNextMeeting.timeLabel}</div>
                            <div className="text-sm">{reportNextMeeting.roomLabel}</div>
                          </div>
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Azioni meeting', en: 'Meeting actions' })}</div>
                          {reportActions.length ? (
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                              <div className="grid grid-cols-[34%,20%,20%,26%] bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                <div>{t({ it: 'Task', en: 'Task' })}</div>
                                <div>{t({ it: 'Assegnata a', en: 'Assigned to' })}</div>
                                <div>{t({ it: 'Date', en: 'Dates' })}</div>
                                <div>{t({ it: 'Stato', en: 'Status' })}</div>
                              </div>
                              {reportActions.map((row: any, index: number) => {
                                const progress = normalizeActionProgress(Number(row.progressPct || 0));
                                const isNotNeeded = String(row.status || '') === 'not_needed';
                                const isDone = !isNotNeeded && progress >= 100;
                                const tone = isNotNeeded ? 'bg-slate-100' : isDone ? 'bg-emerald-50' : 'bg-amber-50';
                                const statusLabel = isNotNeeded
                                  ? `${t({ it: 'Non necessaria', en: 'Not needed' })} (N/A)`
                                  : isDone
                                    ? `${t({ it: 'Completata', en: 'Completed' })} (100%)`
                                    : `${t({ it: 'In corso', en: 'In progress' })} (${progress}%)`;
                                return (
                                  <div key={`pdf-preview-action-${index}`} className={`grid grid-cols-[34%,20%,20%,26%] border-t border-slate-200 px-3 py-2 text-xs text-slate-700 ${tone}`}>
                                    <div className="whitespace-pre-wrap break-words">{String(row.action || '').trim() || '—'}</div>
                                    <div className="whitespace-pre-wrap break-words">{String(row.assignedTo || '').trim() || '—'}</div>
                                    <div className="whitespace-pre-wrap break-words">{`${formatIsoDayLabel(String(row.openingDate || ''))} -> ${formatIsoDayLabel(String(
                                      row.completionDate || ''
                                    ))}`}</div>
                                    <div className="whitespace-pre-wrap break-words">{statusLabel}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                              {t({ it: 'Nessuna azione disponibile', en: 'No actions available' })}
                            </div>
                          )}
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Appunti selezionati', en: 'Selected notes' })}</div>
                          {selectedNotesForPdf.length ? (
                            selectedNotesForPdf.map((note: any, index: number) => (
                              <div key={`pdf-preview-note-${String(note.id || index)}`} className="rounded-xl border border-slate-200 bg-white">
                                <div className="rounded-t-xl bg-sky-100 px-3 py-2">
                                  <div className="text-sm font-semibold text-sky-800">{`${index + 1}. ${String(
                                    note.title || t({ it: 'Senza titolo', en: 'Untitled' })
                                  )}`}</div>
                                  <div className="text-xs text-sky-700">{`${note.authorDisplayName || note.authorUsername || '-'} • ${formatStamp(Number(
                                    note.updatedAt || 0
                                  ))}`}</div>
                                </div>
                                <div className="px-3 py-2 text-sm text-slate-700">
                                  <div className="whitespace-pre-wrap break-words leading-6">
                                    {normalizePdfNoteText(String(note.contentHtml || note.contentText || '').trim())}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                              {t({ it: 'Nessun appunto incluso nel report.', en: 'No notes included in the report.' })}
                            </div>
                          )}
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Grafici e statistiche', en: 'Charts and statistics' })}</div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-sm font-semibold text-slate-700">{t({ it: 'Mix completamento', en: 'Completion mix' })}</div>
                            <div className="mt-2 h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              <div className="flex h-full">
                                <span className="h-full bg-emerald-500" style={{ width: `${actionInsights.total ? (actionInsights.done / actionInsights.total) * 100 : 0}%` }} />
                                <span className="h-full bg-amber-500" style={{ width: `${actionInsights.total ? (actionInsights.inProgress / actionInsights.total) * 100 : 0}%` }} />
                                <span className="h-full bg-slate-400" style={{ width: `${actionInsights.total ? (actionInsights.notNeeded / actionInsights.total) * 100 : 0}%` }} />
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">
                              <div>{`${t({ it: 'Completate', en: 'Completed' })}: ${actionInsights.done}`}</div>
                              <div>{`${t({ it: 'In corso', en: 'In progress' })}: ${actionInsights.inProgress}`}</div>
                              <div>{`${t({ it: 'Non necessarie', en: 'Not needed' })}: ${actionInsights.notNeeded}`}</div>
                              <div>{`${t({ it: 'In ritardo', en: 'Overdue' })}: ${actionInsights.overdue}`}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Completamento', en: 'Completion' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{actionInsights.completionRate}%</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Tempo medio', en: 'Avg resolution' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{`${actionInsights.avgResolutionDays || 0}d`}</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Task totali', en: 'Total tasks' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{actionInsights.total}</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Chain', en: 'Chain' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{reportChainRows.length || 1}</div>
                            </div>
                          </div>
                        </section>
                      </article>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closePdfReviewModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Torna alla selezione', en: 'Back to selection' })}
                    >
                      {t({ it: 'Indietro', en: 'Back' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportNotesPdf()}
                      disabled={pdfExporting}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                      title={t({ it: 'Genera il PDF finale', en: 'Generate final PDF' })}
                    >
                      {pdfExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      {pdfExporting ? t({ it: 'Creazione PDF…', en: 'Building PDF…' }) : t({ it: 'Genera PDF', en: 'Generate PDF' })}
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
