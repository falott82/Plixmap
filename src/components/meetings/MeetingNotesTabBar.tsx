/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClipboardList, History, Info, NotebookText } from 'lucide-react';

// Tab bar (manager/actions/notes/history/details) extracted from MeetingNotesModal.
export const MeetingNotesTabBar = (props: any) => {
  const { activeTab, setActiveTab, followUpChain, t } = props;
  return (
                  <div className="border-b border-slate-200 px-4 py-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('manager')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'manager'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ClipboardList size={15} />
                          {t({ it: 'Topics and Summary', en: 'Topics and Summary' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Temi trattati e sommario condiviso', en: 'Shared topics and summary' })}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('actions')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'actions'
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ClipboardList size={15} />
                          {t({ it: 'Actions', en: 'Actions' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Azioni e prossima riunione', en: 'Actions and next meeting' })}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('notes')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'notes'
                            ? 'border-violet-300 bg-violet-50 text-violet-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <NotebookText size={15} />
                          {t({ it: 'Note', en: 'Notes' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Note personali e condivise', en: 'Personal and shared notes' })}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'history'
                            ? 'border-sky-300 bg-sky-50 text-sky-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <History size={15} />
                          {t({ it: 'Timeline', en: 'Timeline' })}
                        </div>
                        <div className="text-xs opacity-80">
                          {followUpChain.length > 1
                            ? t({ it: 'Timeline dei follow-up collegati', en: 'Linked follow-up timeline' })
                            : t({ it: 'Nessun follow-up collegato', en: 'No linked follow-ups' })}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'details'
                            ? 'border-sky-300 bg-sky-50 text-sky-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Info size={15} />
                          {t({ it: 'Dettagli', en: 'Details' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Info meeting e partecipanti', en: 'Meeting info and participants' })}</div>
                      </button>
                    </div>
                  </div>
  );
};
