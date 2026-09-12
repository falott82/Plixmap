import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { usePlanView } from './usePlanView';

type PlanUnlockGrantedPromptModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'unlockGrantedPrompt'
  | 'setUnlockGrantedPrompt'
  | 'formatPresenceDate'
  | 'planId'
  | 'requestPlanLock'
  | 'hasNavigationEdits'
  | 'requestSaveAndNavigate'
  | 'setSelectedPlan'
  | 'navigate'
  | 't'
>;

/**
 * Modal shown to a user who has just been granted an unlock window, offering to
 * open the plan and acquire the lock. Extracted from PlanViewView.tsx.
 */
export const PlanUnlockGrantedPromptModal = ({
  unlockGrantedPrompt,
  setUnlockGrantedPrompt,
  formatPresenceDate,
  planId,
  requestPlanLock,
  hasNavigationEdits,
  requestSaveAndNavigate,
  setSelectedPlan,
  navigate,
  t
}: PlanUnlockGrantedPromptModalProps) => (
	      <Transition show={!!unlockGrantedPrompt} as={Fragment}>
	        <Dialog
	          as="div"
	          className="relative z-50"
	          onClose={() => {
	            setUnlockGrantedPrompt(null);
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
	                <Dialog.Panel className="w-full max-w-xl modal-panel">
	                  <div className="modal-header items-center">
	                    <div className="min-w-0">
	                      <Dialog.Title className="modal-title">{t({ it: 'Unlock concesso', en: 'Unlock granted' })}</Dialog.Title>
	                      <div className="mt-1 text-xs text-slate-500">
	                        {[unlockGrantedPrompt?.clientName, unlockGrantedPrompt?.siteName].filter(Boolean).join(' / ')}
	                      </div>
	                    </div>
	                    <button onClick={() => setUnlockGrantedPrompt(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
	                      <X size={18} />
	                    </button>
	                  </div>
		                  <div className="mt-3 text-sm text-slate-700">
		                    {t({
		                      it: `In data ${formatPresenceDate(unlockGrantedPrompt?.grantedAt)} l’utente ${
		                        unlockGrantedPrompt?.grantedBy?.username || 'utente'
		                      } ha concesso lo sblocco della planimetria ${unlockGrantedPrompt?.planName || ''}. Hai ${
		                        unlockGrantedPrompt?.minutes || '—'
		                      } minuti per entrarci e prendere il lock. Nel frattempo la planimetria sarà riservata a te e gli altri utenti vedranno un’icona a forma di clessidra. Vuoi aprire la planimetria e prendere il lock?`,
		                      en: `On ${formatPresenceDate(unlockGrantedPrompt?.grantedAt)} user ${
		                        unlockGrantedPrompt?.grantedBy?.username || 'user'
		                      } granted an unlock for floor plan ${unlockGrantedPrompt?.planName || ''}. You have ${
		                        unlockGrantedPrompt?.minutes || '—'
		                      } minutes to enter and acquire the lock. In the meantime, the floor plan will be reserved for you and other users will see an hourglass icon. Do you want to open the floor plan and acquire the lock?`
		                    })}
		                  </div>
	                  <div className="mt-5 flex flex-wrap gap-2">
	                    <button
	                      onClick={() => {
	                        const targetPlanId = String(unlockGrantedPrompt?.planId || '').trim();
	                        if (!targetPlanId) {
	                          setUnlockGrantedPrompt(null);
	                          return;
	                        }
	                        const url = `/plan/${targetPlanId}`;
	                        setUnlockGrantedPrompt(null);
	                        if (targetPlanId === planId) {
	                          requestPlanLock();
	                          return;
	                        }
	                        if (hasNavigationEdits) {
	                          requestSaveAndNavigate(url);
	                          return;
	                        }
	                        setSelectedPlan(targetPlanId);
	                        navigate(url);
	                      }}
	                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
	                      title={t({ it: 'Apri e prendi lock', en: 'Open and acquire lock' })}
	                    >
	                      {t({ it: 'Sì', en: 'Yes' })}
	                    </button>
	                    <button
	                      onClick={() => setUnlockGrantedPrompt(null)}
	                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
	                      title={t({ it: 'Non ora', en: 'Not now' })}
	                    >
	                      {t({ it: 'No', en: 'No' })}
	                    </button>
	                  </div>
	                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>
);
