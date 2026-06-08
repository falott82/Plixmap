import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { usePlanView } from './usePlanView';

type PlanForceUnlockConfigModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'forceUnlockConfig'
  | 'setForceUnlockConfig'
  | 'forceUnlockStarting'
  | 'setForceUnlockStarting'
  | 'forceUnlockGraceMinutes'
  | 'setForceUnlockGraceMinutes'
  | 'sendWs'
  | 't'
>;

/**
 * Admin modal to configure and start a forced unlock (grace minutes) for a plan
 * locked by another user. Extracted from PlanViewView.tsx.
 */
export const PlanForceUnlockConfigModal = ({
  forceUnlockConfig,
  setForceUnlockConfig,
  forceUnlockStarting,
  setForceUnlockStarting,
  forceUnlockGraceMinutes,
  setForceUnlockGraceMinutes,
  sendWs,
  t
}: PlanForceUnlockConfigModalProps) => (
	      <Transition show={!!forceUnlockConfig} as={Fragment}>
	        <Dialog
	          as="div"
	          className="relative z-50"
	          onClose={() => {
	            if (forceUnlockStarting) return;
	            setForceUnlockConfig(null);
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
	                      <Dialog.Title className="modal-title">{t({ it: 'Force unlock', en: 'Force unlock' })}</Dialog.Title>
	                      <div className="mt-1 text-xs text-slate-500">
	                        {forceUnlockConfig?.clientName} / {forceUnlockConfig?.siteName} / {forceUnlockConfig?.planName}
	                      </div>
	                    </div>
	                    <button
	                      onClick={() => {
	                        if (forceUnlockStarting) return;
	                        setForceUnlockConfig(null);
	                      }}
	                      className="icon-button"
	                      title={t({ it: 'Chiudi', en: 'Close' })}
	                    >
	                      <X size={18} />
	                    </button>
	                  </div>
	                  <div className="mt-3 text-sm text-slate-700">
	                    {t({
	                      it: `Vuoi procedere con lo sblocco forzato? L’utente ${forceUnlockConfig?.username || 'utente'} avrà del tempo per salvare.`,
	                      en: `Proceed with the forced unlock? User ${forceUnlockConfig?.username || 'user'} will have some time to save.`
	                    })}
	                  </div>
	                  <div className="mt-4">
	                    <div className="flex items-center justify-between">
	                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Tempo (minuti)', en: 'Time (minutes)' })}</div>
	                      <div className="text-[11px] font-semibold text-slate-700">{forceUnlockGraceMinutes}</div>
	                    </div>
	                    <input
	                      type="range"
	                      min={0}
	                      max={60}
	                      step={1}
	                      value={forceUnlockGraceMinutes}
	                      onChange={(e) => setForceUnlockGraceMinutes(Number(e.target.value))}
	                      className="mt-2 w-full"
	                    />
	                  </div>
	                  <div className="mt-5 flex flex-wrap gap-2">
	                    <button
	                      onClick={() => {
	                        if (!forceUnlockConfig) return;
	                        if (forceUnlockStarting) return;
	                        setForceUnlockStarting(true);
	                        sendWs({
	                          type: 'force_unlock_start',
	                          planId: forceUnlockConfig.planId,
	                          targetUserId: forceUnlockConfig.userId,
	                          graceMinutes: forceUnlockGraceMinutes
	                        });
	                      }}
	                      disabled={forceUnlockStarting}
	                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
	                      title={t({ it: 'Avvia force unlock', en: 'Start force unlock' })}
	                    >
	                      {t({ it: 'Conferma', en: 'Confirm' })}
	                    </button>
	                    <button
	                      onClick={() => {
	                        if (forceUnlockStarting) return;
	                        setForceUnlockConfig(null);
	                      }}
	                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
	                      title={t({ it: 'Annulla', en: 'Cancel' })}
	                    >
	                      {t({ it: 'Annulla', en: 'Cancel' })}
	                    </button>
	                  </div>
	                </Dialog.Panel>
	              </Transition.Child>
	            </div>
	          </div>
	        </Dialog>
	      </Transition>
);
