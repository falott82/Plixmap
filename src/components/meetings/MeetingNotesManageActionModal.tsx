/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CalendarPlus, Trash2, X } from 'lucide-react';
import { parseIsoDay, toIsoDay, DAY_MS } from './MeetingNotesModal.helpers';

// Per-task management modal (progress + deadline + status) extracted from MeetingNotesModal.
export const MeetingNotesManageActionModal = (props: any) => {
  const {
    manageActionModalIndex,
    closeManageActionModal,
    actionManageDialogInitialFocusRef,
    managedAction,
    managedActionIsNotNeeded,
    managedActionProgress,
    updateManagedActionProgress,
    canManageMeeting,
    manageActionDueDateInputRef,
    manageActionDueDateDraft,
    setManageActionDueDateDraft,
    openManagedActionDatePicker,
    applyManagedActionDueDate,
    markManagedActionAsNotNeeded,
    deleteManagedAction,
    t
  } = props;
  return (
      <Transition show={manageActionModalIndex >= 0} as={Fragment}>
        <Dialog as="div" className="relative z-[162]" onClose={closeManageActionModal} initialFocus={actionManageDialogInitialFocusRef}>
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
                <Dialog.Panel className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={actionManageDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Gestione task', en: 'Task management' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">{String(managedAction?.action || '').trim() || '—'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={closeManageActionModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi gestione task', en: 'Close task management' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-4 px-4 py-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <span>{t({ it: 'Avanzamento', en: 'Progress' })}</span>
                        <span>{managedActionIsNotNeeded ? t({ it: 'Non necessaria', en: 'Not needed' }) : `${managedActionProgress}%`}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200">
                        <span
                          className={`block h-3 rounded-full ${managedActionIsNotNeeded ? 'bg-slate-400' : managedActionProgress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${managedActionIsNotNeeded ? 100 : managedActionProgress}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={managedActionIsNotNeeded ? 0 : managedActionProgress}
                        onChange={(event) => updateManagedActionProgress(Number(event.target.value))}
                        disabled={!canManageMeeting || managedActionIsNotNeeded}
                        className="mt-3 w-full"
                        title={t({ it: 'Imposta avanzamento da 0 a 100 con step 5', en: 'Set progress from 0 to 100 in steps of 5' })}
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Scadenza', en: 'Deadline' })}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          ref={manageActionDueDateInputRef}
                          type="date"
                          value={manageActionDueDateDraft}
                          onChange={(event) => setManageActionDueDateDraft(event.target.value)}
                          disabled={!canManageMeeting}
                          className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                          title={t({ it: 'Seleziona nuova data di scadenza task', en: 'Select new task deadline' })}
                        />
                        <button
                          type="button"
                          onClick={openManagedActionDatePicker}
                          disabled={!canManageMeeting}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          title={t({ it: 'Apri selettore data', en: 'Open date picker' })}
                        >
                          <CalendarPlus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={applyManagedActionDueDate}
                          disabled={!canManageMeeting || !String(manageActionDueDateDraft || '').trim()}
                          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                          title={t({ it: 'Applica nuova scadenza task', en: 'Apply new task deadline' })}
                        >
                          {t({ it: 'Prolunga scadenza', en: 'Extend deadline' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const baseTs = parseIsoDay(manageActionDueDateDraft || String(managedAction?.completionDate || '')) ?? Date.now();
                            setManageActionDueDateDraft(toIsoDay(baseTs + 7 * DAY_MS));
                          }}
                          disabled={!canManageMeeting}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          title={t({ it: 'Aggiungi 7 giorni alla scadenza proposta', en: 'Add 7 days to draft deadline' })}
                        >
                          +7d
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={markManagedActionAsNotNeeded}
                      disabled={!canManageMeeting}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      title={t({ it: 'Imposta task come non necessaria', en: 'Set task as not needed' })}
                    >
                      {t({ it: 'Non necessaria', en: 'Not needed' })}
                    </button>
                    <button
                      type="button"
                      onClick={deleteManagedAction}
                      disabled={!canManageMeeting}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      title={t({ it: 'Elimina task', en: 'Delete task' })}
                    >
                      <Trash2 size={14} />
                      {t({ it: 'Elimina', en: 'Delete' })}
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
