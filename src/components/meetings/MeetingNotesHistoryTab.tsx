/* eslint-disable @typescript-eslint/no-explicit-any */
import { History, Loader2, Plus, Settings2 } from 'lucide-react';
import { getMeetingSchedulePhase } from '../../utils/meetingTime';

// "History" (follow-up chain timeline) tab extracted from MeetingNotesModal.
export const MeetingNotesHistoryTab = (props: any) => {
  const {
    followUpChain,
    historySelectedMeetingId,
    timelineBlinkMeetingId,
    canManageMeeting,
    scheduleFollowUp,
    selectedHistoryEntry,
    meeting,
    managerFields,
    managerScheduling,
    selectedHistoryParticipants,
    formatMeetingRelativeDayLabel,
    setHistorySelectedMeetingId,
    setNoteContextMenu,
    setTimelineScheduleContextMenu,
    setTimelineActivityModalOpen,
    t
  } = props;
  return (
                          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="min-h-0 flex-1">
                              {followUpChain.length ? (
                                <div className="grid h-full min-h-0 grid-cols-[300px,minmax(0,1fr)] overflow-hidden">
                                  <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50">
                                    <div className="border-b border-slate-200 px-4 py-3">
                                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {t({ it: 'Timeline', en: 'Timeline' })}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {followUpChain.length} {t({ it: 'meeting collegati', en: 'linked meetings' })}
                                      </div>
                                    </div>
                                    <div className="min-h-0 space-y-2 overflow-y-auto p-3">
                                      {followUpChain.map((entry: any, index: number) => {
                                        const active = String(historySelectedMeetingId || '') === String(entry.meeting.id || '');
                                        const blinking = String(timelineBlinkMeetingId || '') === String(entry.meeting.id || '');
                                        const now = Date.now();
                                        const startAt = Number(entry.meeting.effectiveStartAt || entry.meeting.startAt || 0);
                                        const endAt = Number(entry.meeting.effectiveEndAt || entry.meeting.endAt || 0);
                                        const phase = getMeetingSchedulePhase(startAt, endAt, now);
                                        const dayLabel = formatMeetingRelativeDayLabel(startAt);
                                        const canManageEntry = canManageMeeting || entry.canManageMeeting;
                                        return (
                                          <div key={`followup-list-${String(entry.meeting.id || index)}`} className="relative">
                                            <button
                                              type="button"
                                              onClick={() => setHistorySelectedMeetingId(String(entry.meeting.id || ''))}
                                              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                                phase === 'past'
                                                  ? 'border-slate-300 bg-slate-100 text-slate-700'
                                                  : phase === 'current'
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                                    : 'border-sky-300 bg-sky-50 text-sky-800'
                                              } ${active ? 'ring-2 ring-primary/40' : 'hover:opacity-90'} ${blinking ? 'animate-pulse ring-2 ring-emerald-300' : ''} ${
                                                phase === 'scheduled' && canManageEntry ? 'pr-10' : ''
                                              }`}
                                              title={new Date(Number(entry.meeting.startAt || 0)).toLocaleString()}
                                            >
                                              <div className="text-sm font-semibold">{`${new Date(Number(entry.meeting.startAt || 0)).toLocaleDateString()} (${dayLabel})`}</div>
                                              <div className="mt-1 text-xs opacity-80">
                                                {entry.meeting.roomName || '-'} • {entry.meeting.subject || t({ it: 'Riunione', en: 'Meeting' })}
                                              </div>
                                            </button>
                                            {phase === 'scheduled' && canManageEntry ? (
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  setHistorySelectedMeetingId(String(entry.meeting.id || ''));
                                                  setNoteContextMenu(null);
                                                  const triggerRect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                  setTimelineScheduleContextMenu({
                                                    meetingId: String(entry.meeting.id || ''),
                                                    x: Math.max(8, Math.min(triggerRect.right - 236, window.innerWidth - 250)),
                                                    y: Math.max(8, Math.min(triggerRect.bottom + 6, window.innerHeight - 104))
                                                  });
                                                }}
                                                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-sky-300 bg-white/80 text-sky-700 hover:bg-white"
                                                title={t({ it: 'Gestione schedulazione', en: 'Schedule management' })}
                                              >
                                                <Settings2 size={13} />
                                              </button>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void scheduleFollowUp(
                                            selectedHistoryEntry?.meeting || meeting,
                                            String(selectedHistoryEntry?.managerFields?.nextMeetingDate || '').trim() || String(managerFields.nextMeetingDate || '').trim()
                                          )
                                        }
                                        disabled={managerScheduling || !canManageMeeting}
                                        className="w-full rounded-2xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-3 text-left text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-55"
                                        title={
                                          canManageMeeting
                                            ? t({ it: 'Crea un nuovo follow-up in chain', en: 'Create a new follow-up in chain' })
                                            : t({ it: 'Solo partecipanti/manager autorizzati possono creare follow-up', en: 'Only authorized participants/managers can create follow-ups' })
                                        }
                                      >
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                          {managerScheduling ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                          {t({ it: 'Create Follow-UP', en: 'Create Follow-UP' })}
                                        </div>
                                        <div className="mt-1 text-xs opacity-80">{t({ it: 'Nuova riunione della stessa chain', en: 'New meeting in the same chain' })}</div>
                                      </button>
                                    </div>
                                  </aside>

                                  <section className="min-h-0 overflow-y-auto bg-white p-4">
                                    {selectedHistoryEntry ? (
                                      (() => {
                                        const chainMeeting = selectedHistoryEntry.meeting;
                                        return (
                                          <div className="space-y-4">
                                            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                                              <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                  <div className="text-lg font-semibold text-slate-900">
                                                    {chainMeeting.subject || t({ it: 'Riunione', en: 'Meeting' })}
                                                  </div>
                                                  <div className="mt-1 text-sm text-slate-500">
                                                    {chainMeeting.roomName || '-'} • {new Date(Number(chainMeeting.startAt || 0)).toLocaleString()}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                                                  {t({ it: 'Partecipanti', en: 'Participants' })}
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                  {selectedHistoryParticipants.length ? (
                                                    selectedHistoryParticipants.map((participant: any) => (
                                                      <span
                                                        key={participant.key}
                                                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                                          participant.checkedIn
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-slate-100 text-slate-700'
                                                        }`}
                                                        title={
                                                          participant.checkedIn && participant.checkInAt
                                                            ? `${t({ it: 'Check-in effettuato', en: 'Checked in' })} • ${new Date(participant.checkInAt).toLocaleString()}`
                                                            : t({ it: 'Check-in non effettuato', en: 'Not checked in' })
                                                        }
                                                      >
                                                        {participant.label}
                                                      </span>
                                                    ))
                                                  ) : (
                                                    <span className="text-sm text-slate-500">{t({ it: 'Nessun partecipante disponibile', en: 'No participants available' })}</span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="grid gap-4 xl:grid-cols-2">
                                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                  {t({ it: 'Temi trattati', en: 'Topics discussed' })}
                                                </div>
                                                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                                                  {String(selectedHistoryEntry.managerFields.topicsText || '').trim() || '—'}
                                                </div>
                                              </div>
                                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                  {t({ it: 'Sommario generale', en: 'General summary' })}
                                                </div>
                                                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                                                  {String(selectedHistoryEntry.managerFields.summaryText || '').trim() || '—'}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() => setTimelineActivityModalOpen(true)}
                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                title={t({ it: 'Apri time machine e log attività task', en: 'Open time machine and task activity log' })}
                                              >
                                                <History size={14} />
                                                {t({ it: 'Task Time Machine', en: 'Task Time Machine' })}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : null}
                                  </section>
                                </div>
                              ) : (
                                <div className="flex h-full items-center justify-center p-6">
                                  <div className="w-full max-w-xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                                    <div className="text-sm font-semibold text-slate-700">
                                      {t({ it: 'Nessuna timeline follow-up disponibile', en: 'No follow-up timeline available' })}
                                    </div>
                                    <div className="mt-2 text-sm text-slate-500">
                                      {t({
                                        it: 'Quando questo meeting avrà follow-up collegati, li troverai qui con temi, sommario e azioni condivise lungo tutta la chain.',
                                        en: 'When this meeting has linked follow-ups, you will find topics, summary and shared chain actions here.'
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>
  );
};
