import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { usePlanView } from './usePlanView';

type PlanUnlockPromptModalProps = Pick<
  ReturnType<typeof usePlanView>,
  'unlockPrompt' | 'setUnlockPrompt' | 'unlockBusy' | 'hasNavigationEdits' | 'handleUnlockResponse' | 't'
>;

/**
 * Modal shown to a lock holder when another user requests the edit lock
 * (grant/save/discard/deny). Extracted from PlanViewView.tsx.
 */
export const PlanUnlockPromptModal = ({
  unlockPrompt,
  setUnlockPrompt,
  unlockBusy,
  hasNavigationEdits,
  handleUnlockResponse,
  t
}: PlanUnlockPromptModalProps) => (
      <Transition show={!!unlockPrompt} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (unlockBusy) return;
            setUnlockPrompt(null);
          }}
        >
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
                <Dialog.Panel className="w-full max-w-lg modal-panel">
		                  <div className="modal-header items-center">
		                    <div className="min-w-0">
		                      <Dialog.Title className="modal-title">
		                        {t({ it: 'Richiesta di unlock', en: 'Unlock request' })}
		                      </Dialog.Title>
                      <div className="modal-description">
	                        {t({
	                          it: `L’utente @${unlockPrompt?.requestedBy?.username || 'utente'} chiede la possibilità di modificare la planimetria ${
	                            unlockPrompt?.planName || ''
	                          }.`,
	                          en: `User @${unlockPrompt?.requestedBy?.username || 'user'} requests permission to edit floor plan ${unlockPrompt?.planName || ''}.`
	                        })}
	                      </div>
		                      <div className="mt-1 text-xs text-slate-500">
		                        {[unlockPrompt?.clientName, unlockPrompt?.siteName].filter(Boolean).join(' / ')}
		                      </div>
		                      {String(unlockPrompt?.message || '').trim() ? (
		                        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
		                          <div className="text-[11px] font-semibold uppercase text-sky-700">
			                            {t({ it: 'Messaggio', en: 'Message' })}{' '}
			                            <span className="normal-case text-sky-700/80">@{unlockPrompt?.requestedBy?.username || 'admin'}</span>
			                          </div>
		                          <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-sky-950">
		                            {String(unlockPrompt?.message || '').trim()}
		                          </div>
		                        </div>
		                      ) : null}
		                    </div>
                    <button
                      onClick={() => {
                        if (unlockBusy) return;
                        setUnlockPrompt(null);
                      }}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
	                  </div>
	                  <div className="mt-4 text-sm text-slate-600">
	                    {hasNavigationEdits
	                      ? t({
	                          it: 'Puoi salvare le modifiche e concedere il lock, oppure annullare le modifiche e concederlo.',
	                          en: 'You can save your changes and grant the lock, or discard changes and grant it.'
	                        })
	                      : t({
	                          it: 'Non hai modifiche da salvare. Vuoi concedere l’unlock?',
	                          en: 'No changes to save. Do you want to grant the unlock?'
	                        })}
	                  </div>
	                  <div className="mt-6 flex flex-wrap gap-2">
	                    {hasNavigationEdits ? (
	                      <>
	                        <button
	                          onClick={() => handleUnlockResponse('grant_save')}
	                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Salva le modifiche e concede il lock', en: 'Save changes and grant the lock' })}
	                        >
	                          {t({ it: 'Salva e concedi', en: 'Save and grant' })}
	                        </button>
	                        <button
	                          onClick={() => handleUnlockResponse('grant_discard')}
	                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Annulla le modifiche e concede il lock', en: 'Discard changes and grant the lock' })}
	                        >
	                          {t({ it: 'Non salvare e concedi', en: 'Discard and grant' })}
	                        </button>
	                        <button
	                          onClick={() => handleUnlockResponse('deny')}
	                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Non concedere il lock', en: 'Do not grant the lock' })}
	                        >
	                          {t({ it: 'Non concedere', en: 'Do not grant' })}
	                        </button>
	                      </>
	                    ) : (
	                      <>
	                        <button
	                          onClick={() => handleUnlockResponse('grant')}
	                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Concedi l’unlock', en: 'Grant unlock' })}
	                        >
	                          {t({ it: 'Concedi', en: 'Grant' })}
	                        </button>
	                        <button
	                          onClick={() => handleUnlockResponse('deny')}
	                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
	                          disabled={unlockBusy}
	                          title={t({ it: 'Nega l’unlock', en: 'Deny unlock' })}
	                        >
	                          {t({ it: 'Nega', en: 'Deny' })}
	                        </button>
	                      </>
	                    )}
	                  </div>
	                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>
);
