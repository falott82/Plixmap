import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { usePlanView } from './usePlanView';

type PlanForceUnlockIncomingModalProps = Pick<
  ReturnType<typeof usePlanView>,
  'forceUnlockIncoming' | 'forceUnlockIncomingFocusRef' | 'forceUnlockTick' | 'hasNavigationEdits' | 'executeForceUnlock' | 't'
>;

/**
 * Modal shown to a lock owner when a superadmin starts a force unlock against
 * them (save/discard within the grace window). Extracted from PlanViewView.tsx.
 */
export const PlanForceUnlockIncomingModal = ({
  forceUnlockIncoming,
  forceUnlockIncomingFocusRef,
  forceUnlockTick,
  hasNavigationEdits,
  executeForceUnlock,
  t
}: PlanForceUnlockIncomingModalProps) => (
	      <Transition show={!!forceUnlockIncoming} as={Fragment}>
	        <Dialog as="div" className="relative z-50" onClose={() => {}} initialFocus={forceUnlockIncomingFocusRef}>
		          <Transition.Child
		            as={Fragment}
		            enter="ease-out duration-150"
	            enterFrom="opacity-0"
	            enterTo="opacity-100"
	            leave="ease-in duration-100"
	            leaveFrom="opacity-100"
	            leaveTo="opacity-0"
	          >
	            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
	          </Transition.Child>
	          <div className="fixed inset-0 overflow-y-auto">
	            <div className="flex min-h-full items-center justify-center px-4 py-8">
	              <Transition.Child
	                as={Fragment}
	                enter="ease-out duration-150"
	                enterFrom="opacity-0 scale-95"
	                enterTo="opacity-100 scale-100"
	                leave="ease-in duration-100"
	                leaveFrom="opacity-100 scale-100"
	                leaveTo="opacity-0 scale-95"
	              >
	                <Dialog.Panel className="w-full max-w-xl modal-panel">
                    <button ref={forceUnlockIncomingFocusRef} type="button" className="sr-only" tabIndex={0}>
                      focus
                    </button>
                  <div className="modal-header items-center">
		                    <div className="min-w-0">
		                      <Dialog.Title className="modal-title">{t({ it: 'Force unlock richiesto', en: 'Force unlock requested' })}</Dialog.Title>
		                      <div className="mt-1 text-xs text-slate-500">
		                        {[forceUnlockIncoming?.clientName, forceUnlockIncoming?.siteName, forceUnlockIncoming?.planName].filter(Boolean).join(' / ')}
		                      </div>
		                    </div>
		                  </div>
		                  {(() => {
	                    forceUnlockTick;
	                    const graceEndsAt = Number(forceUnlockIncoming?.graceEndsAt || 0);
	                    const decisionEndsAt = Number(forceUnlockIncoming?.decisionEndsAt || 0);
	                    const now = Date.now();
	                    const inGrace = graceEndsAt > now;
	                    const targetAt = inGrace ? graceEndsAt : decisionEndsAt;
	                    const remainingMs = targetAt - now;
	                    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
	                    return (
	                      <>
	                        <div className="mt-3 text-sm text-slate-700">
	                          {inGrace
	                            ? t({
	                                it: `Il superadmin @${forceUnlockIncoming?.requestedBy?.username || 'superadmin'} ha avviato un force unlock. Tempo concesso per salvare.`,
	                                en: `Superadmin @${forceUnlockIncoming?.requestedBy?.username || 'superadmin'} started a force unlock. Time granted to save.`
	                              })
	                            : t({
	                                it: 'Attendi la decisione del superadmin nella finestra di 5 minuti.',
	                                en: 'Wait for the superadmin decision in the 5-minute window.'
	                              })}
	                        </div>
	                        <div className="mt-2 text-sm font-semibold text-slate-800">
	                          {inGrace
	                            ? t({ it: `Countdown salvataggio: ${remainingSec}s`, en: `Save countdown: ${remainingSec}s` })
	                            : t({ it: `Countdown decisione: ${remainingSec}s`, en: `Decision countdown: ${remainingSec}s` })}
	                        </div>
	                      </>
	                    );
	                  })()}
		                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
		                    <div className="font-semibold text-ink">{t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })}</div>
		                    <div className="mt-1">
		                      {hasNavigationEdits
		                        ? t({ it: 'Sono presenti modifiche non salvate.', en: 'There are unsaved changes.' })
		                        : t({ it: 'Non risultano modifiche non salvate.', en: 'No unsaved changes detected.' })}
		                    </div>
		                  </div>
		                  <div className="mt-5 flex flex-wrap gap-2">
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockIncoming?.requestId) return;
		                        void executeForceUnlock(forceUnlockIncoming.requestId, 'save');
		                      }}
		                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
		                      title={t({
		                        it: 'Salva le modifiche (se presenti) e rilascia il lock.',
		                        en: 'Saves changes (if any) and releases the lock.'
		                      })}
		                    >
		                      {t({ it: 'Salva e rilascia', en: 'Save and release' })}
		                    </button>
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockIncoming?.requestId) return;
		                        void executeForceUnlock(forceUnlockIncoming.requestId, 'discard');
		                      }}
		                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
		                      title={t({
		                        it: 'Scarta le modifiche non salvate e rilascia il lock.',
		                        en: 'Discards unsaved changes and releases the lock.'
		                      })}
		                    >
		                      {t({ it: 'Scarta e rilascia', en: 'Discard and release' })}
		                    </button>
		                  </div>
		                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>
);
