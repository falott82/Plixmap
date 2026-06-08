/* eslint-disable @typescript-eslint/no-explicit-any */
import { Users } from 'lucide-react';

// "Details" tab (participants + meeting metadata) extracted from MeetingNotesModal.
export const MeetingNotesDetailsTab = (props: any) => {
  const { participants, meeting, selectedClient, selectedSite, selectedFloorPlan, t } = props;
  return (
                          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[360px,minmax(0,1fr)]">
                            <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <Users size={13} />
                                {t({ it: 'Partecipanti', en: 'Participants' })}
                              </div>
                              <div className="min-h-0 space-y-1 overflow-auto pr-1">
                                {participants.length ? (
                                  participants.map((p: any) => (
                                    <div
                                      key={p.key}
                                      className={`rounded-lg border px-2 py-1.5 text-xs ${
                                        p.hasShared ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'
                                      }`}
                                      title={
                                        p.hasShared
                                          ? t({ it: 'Ha condiviso appunti', en: 'Has shared notes' })
                                          : t({ it: 'Nessun appunto condiviso', en: 'No shared notes' })
                                      }
                                    >
                                      <div className="truncate font-semibold">{p.label}</div>
                                      <div className="truncate text-[10px] text-slate-500">
                                        {p.department || p.email || p.company || '—'}
                                      </div>
                                      <div className="truncate text-[10px] text-slate-400">{p.email || p.company || '—'}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-2 py-2 text-xs text-slate-500">
                                    {t({ it: 'Nessun partecipante disponibile', en: 'No participants available' })}
                                  </div>
                                )}
                              </div>
                            </aside>
                            <section className="min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ID</div>
                                  <div className="text-sm font-semibold text-slate-800">#{meeting.meetingNumber || '—'}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Stato', en: 'Status' })}</div>
                                  <div className="text-sm font-semibold text-slate-800">{meeting.status}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Titolo meeting', en: 'Meeting title' })}</div>
                                  <div className="text-sm font-semibold text-slate-800">{meeting.subject || '-'}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Cliente/Sede/Piano', en: 'Client/Site/Floor' })}</div>
                                  <div className="text-sm text-slate-700">
                                    {selectedClient?.name || meeting.clientId} • {selectedSite?.name || meeting.siteId} • {selectedFloorPlan?.name || meeting.floorPlanId}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Sala e orario', en: 'Room and time' })}</div>
                                  <div className="text-sm text-slate-700">
                                    {meeting.roomName || '-'} • {new Date(Number(meeting.startAt || 0)).toLocaleString()} - {new Date(Number(meeting.endAt || 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            </section>
                          </div>
  );
};
