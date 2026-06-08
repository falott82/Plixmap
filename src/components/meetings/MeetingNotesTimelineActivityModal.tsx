/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

// "Task Time Machine" timeline + task-activity modal extracted from MeetingNotesModal.
export const MeetingNotesTimelineActivityModal = (props: any) => {
  const {
    timelineActivityModalOpen,
    closeTimelineActivityModal,
    timelineActivityDialogInitialFocusRef,
    timelineChain,
    timelineTaskEvents,
    t
  } = props;
  return (
      <Transition show={timelineActivityModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[162]" onClose={closeTimelineActivityModal} initialFocus={timelineActivityDialogInitialFocusRef}>
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
                  <button ref={timelineActivityDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Task Time Machine', en: 'Task Time Machine' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({ it: 'Timeline meeting in alto, log attività task in basso', en: 'Meeting timeline on top, task activity log below' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeTimelineActivityModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi time machine', en: 'Close time machine' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Timeline meeting', en: 'Meeting timeline' })}</div>
                      <div className="overflow-x-auto">
                        <div className="relative min-w-[880px] px-6 py-6">
                          <div className="absolute left-10 right-10 top-1/2 h-[2px] -translate-y-1/2 bg-slate-300" />
                          <div className="relative flex items-center justify-between gap-6">
                            {timelineChain.length ? (
                              timelineChain.map((node: any) => (
                                <div key={`timeline-node-${String(node.entry.meeting.id || node.index)}`} className="relative flex min-w-[160px] flex-col items-center text-center">
                                  <span
                                    className={`z-10 h-4 w-4 rounded-full border-2 ${
                                      node.phase === 'past'
                                        ? 'border-slate-400 bg-slate-200'
                                        : node.phase === 'current'
                                          ? 'border-emerald-500 bg-emerald-200'
                                          : 'border-sky-500 bg-sky-200'
                                    }`}
                                  />
                                  <div className="mt-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                    {String(node.index + 1).padStart(2, '0')}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-slate-700">{new Date(Number(node.entry.meeting.startAt || 0)).toLocaleDateString()}</div>
                                  <div className="text-[11px] text-slate-500">{node.phaseLabel}</div>
                                </div>
                              ))
                            ) : (
                              <div className="w-full text-center text-sm text-slate-500">{t({ it: 'Nessuna timeline disponibile', en: 'No timeline available' })}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Attività task', en: 'Task activity' })}</div>
                      <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
                        {timelineTaskEvents.length ? (
                          timelineTaskEvents.map((event: any) => (
                            <div key={event.id} className={`rounded-xl border px-3 py-2 ${event.tone}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold">{event.taskLabel}</div>
                                <div className="text-[11px] opacity-80">{new Date(Number(event.ts || 0)).toLocaleString()}</div>
                              </div>
                              <div className="mt-1 text-xs font-semibold">{event.actionLabel}</div>
                              <div className="mt-0.5 text-[11px] opacity-80">{event.meetingLabel}</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                            {t({ it: 'Nessuna attività task registrata', en: 'No task activity recorded' })}
                          </div>
                        )}
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
