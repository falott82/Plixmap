/* eslint-disable @typescript-eslint/no-explicit-any */

// "Manager" tab (topics + summary textareas) extracted from MeetingNotesModal.
export const MeetingNotesManagerTab = (props: any) => {
  const { managerFields, setManagerField, canManageMeeting, t } = props;
  return (
                          <section className="flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {t({ it: 'Topics and Summary', en: 'Topics and Summary' })}
                            </div>
                            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
                              <label className="flex min-h-0 flex-col text-xs font-semibold text-slate-600">
                                {t({ it: 'Temi trattati', en: 'Topics discussed' })}
                                <textarea
                                  value={managerFields.topicsText}
                                  onChange={(e) => setManagerField('topicsText', e.target.value)}
                                  disabled={!canManageMeeting}
                                  rows={10}
                                  className="mt-1 h-full min-h-[460px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                />
                              </label>
                              <label className="flex min-h-0 flex-col text-xs font-semibold text-slate-600">
                                {t({ it: 'Sommario generale', en: 'General summary' })}
                                <textarea
                                  value={managerFields.summaryText}
                                  onChange={(e) => setManagerField('summaryText', e.target.value)}
                                  disabled={!canManageMeeting}
                                  rows={10}
                                  className="mt-1 h-full min-h-[460px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                />
                              </label>
                            </div>
                          </section>
  );
};
