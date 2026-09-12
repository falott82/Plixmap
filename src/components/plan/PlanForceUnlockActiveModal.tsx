import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { usePlanView } from './usePlanView';

const LOCK_TOAST_MS = 5_000;

type PlanForceUnlockActiveModalProps = Pick<
  ReturnType<typeof usePlanView>,
  'forceUnlockActive' | 'forceUnlockActiveFocusRef' | 'forceUnlockTick' | 'sendWs' | 'setForceUnlockActive' | 'pushStack' | 't'
>;

/**
 * Modal shown to the admin running a force unlock, with the grace/decision
 * countdown and save/discard/cancel actions. Extracted from PlanViewView.tsx.
 */
export const PlanForceUnlockActiveModal = ({
  forceUnlockActive,
  forceUnlockActiveFocusRef,
  forceUnlockTick,
  sendWs,
  setForceUnlockActive,
  pushStack,
  t
}: PlanForceUnlockActiveModalProps) => (
	      <Transition show={!!forceUnlockActive} as={Fragment}>
	        <Dialog as="div" className="relative z-50" onClose={() => {}} initialFocus={forceUnlockActiveFocusRef}>
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
	                <Dialog.Panel className="w-full max-w-2xl modal-panel">
                    <button ref={forceUnlockActiveFocusRef} type="button" className="sr-only" tabIndex={0}>
                      focus
                    </button>
                  <div className="modal-header items-center">
		                    <div className="min-w-0">
		                      <Dialog.Title className="modal-title">{t({ it: 'Force unlock in corso', en: 'Force unlock in progress' })}</Dialog.Title>
		                      <div className="mt-1 text-xs text-slate-500">
		                        {t({
		                          it: `Target: ${forceUnlockActive?.targetUsername || 'utente'}`,
		                          en: `Target: ${forceUnlockActive?.targetUsername || 'user'}`
		                        })}
		                      </div>
		                    </div>
		                  </div>
		                  <div className="mt-3 text-sm text-slate-700">
		                    {(() => {
		                      forceUnlockTick;
	                      const graceEndsAt = Number(forceUnlockActive?.graceEndsAt || 0);
	                      const decisionEndsAt = Number(forceUnlockActive?.decisionEndsAt || 0);
	                      const now = Date.now();
	                      const inGrace = graceEndsAt > now;
	                      const targetAt = inGrace ? graceEndsAt : decisionEndsAt;
	                      const remainingMs = targetAt - now;
	                      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
	                      return inGrace
	                        ? t({
	                            it: `Tempo concesso all’utente per salvare: ${remainingSec}s.`,
	                            en: `Time granted to the user to save: ${remainingSec}s.`
	                          })
	                        : t({
	                            it: `Finestra decisione (5 minuti): ${remainingSec}s rimanenti.`,
	                            en: `Decision window (5 minutes): ${remainingSec}s remaining.`
	                          });
	                    })()}
	                  </div>
		                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
		                    <div className="font-semibold text-ink">{t({ it: 'Modifiche non salvate', en: 'Unsaved changes' })}</div>
		                    <div className="mt-1">
		                      {forceUnlockActive?.hasUnsavedChanges === null || forceUnlockActive?.hasUnsavedChanges === undefined
		                        ? t({ it: 'Stato non disponibile.', en: 'Status not available.' })
		                        : forceUnlockActive?.hasUnsavedChanges
		                          ? t({ it: 'Il proprietario del lock ha modifiche non salvate.', en: 'The lock owner has unsaved changes.' })
		                          : t({ it: 'Il proprietario del lock non risulta avere modifiche non salvate.', en: 'The lock owner does not appear to have unsaved changes.' })}
		                    </div>
		                  </div>
		                  <div className="mt-5 flex flex-wrap gap-2">
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockActive?.requestId) return;
		                        sendWs({ type: 'force_unlock_execute', requestId: forceUnlockActive.requestId, action: 'save' });
		                      }}
		                      disabled={Date.now() < Number(forceUnlockActive?.graceEndsAt || 0)}
		                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
		                      title={t({
		                        it: 'Chiede al proprietario del lock di salvare le modifiche (se presenti) e rilasciare il lock. Il lock passerà al superadmin.',
		                        en: 'Asks the lock owner to save changes (if any) and release the lock. The lock will be taken by the superadmin.'
		                      })}
		                    >
		                      {t({ it: 'Salva e sblocca', en: 'Save and unlock' })}
		                    </button>
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockActive?.requestId) return;
		                        sendWs({ type: 'force_unlock_execute', requestId: forceUnlockActive.requestId, action: 'discard' });
		                      }}
		                      disabled={Date.now() < Number(forceUnlockActive?.graceEndsAt || 0)}
		                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
		                      title={t({
		                        it: 'Chiede al proprietario del lock di scartare le modifiche non salvate e rilasciare il lock. Il lock passerà al superadmin.',
		                        en: 'Asks the lock owner to discard unsaved changes and release the lock. The lock will be taken by the superadmin.'
		                      })}
		                    >
		                      {t({ it: 'Scarta e sblocca', en: 'Discard and unlock' })}
		                    </button>
		                    <button
		                      onClick={() => {
		                        if (!forceUnlockActive?.requestId) return;
		                        sendWs({ type: 'force_unlock_cancel', requestId: forceUnlockActive.requestId });
		                        setForceUnlockActive(null);
		                        pushStack(t({ it: 'Force unlock annullato.', en: 'Force unlock cancelled.' }), 'info', { duration: LOCK_TOAST_MS });
		                      }}
		                      disabled={Date.now() < Number(forceUnlockActive?.graceEndsAt || 0)}
		                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
		                      title={t({
		                        it: 'Annulla la richiesta: il lock resta all’utente e l’avviso si chiude.',
		                        en: 'Cancel the request: the lock remains with the user and the warning closes.'
		                      })}
		                    >
		                      {t({ it: 'Annulla richiesta', en: 'Cancel request' })}
		                    </button>
		                  </div>
		                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>
);
