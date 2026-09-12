import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { MoveDiagonal, X } from 'lucide-react';
import { usePlanView } from './usePlanView';

type PlanScaleActionsModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'scaleActionsOpen'
  | 'setScaleActionsOpen'
  | 'scaleLabel'
  | 'planScale'
  | 'updateScaleStyle'
  | 'openScaleEdit'
  | 'setClearScaleConfirmOpen'
  | 't'
>;

/**
 * Modal to recalibrate/remove the floor-plan scale and tune its line/label
 * styling, extracted from PlanViewView.tsx.
 */
export const PlanScaleActionsModal = ({
  scaleActionsOpen,
  setScaleActionsOpen,
  scaleLabel,
  planScale,
  updateScaleStyle,
  openScaleEdit,
  setClearScaleConfirmOpen,
  t
}: PlanScaleActionsModalProps) => (
      <Transition show={scaleActionsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setScaleActionsOpen(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-card transition-all">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Scala planimetria', en: 'Floor plan scale' })}
                    </Dialog.Title>
                    <button
                      onClick={() => setScaleActionsOpen(false)}
                      className="text-slate-400 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Vuoi aggiornare la scala o rimuoverla dalla planimetria?',
                      en: 'Do you want to update the scale or remove it from the floor plan?'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>{t({ it: 'Dimensione impostata', en: 'Set size' })}</span>
                      <span className="font-mono text-slate-800">
                        {scaleLabel || t({ it: 'Non impostata', en: 'Not set' })}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <MoveDiagonal size={14} />
                          {t({ it: 'Spessore linea scala', en: 'Scale line thickness' })}
                          <span className="ml-auto text-xs font-mono text-slate-600 tabular-nums">
                            {Number(planScale?.strokeWidth ?? 1.2).toFixed(1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={6}
                          step={0.1}
                          value={Number(planScale?.strokeWidth ?? 1.2)}
                          onChange={(e) => updateScaleStyle({ strokeWidth: Number(e.target.value) })}
                          className="mt-1 w-full"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <MoveDiagonal size={14} />
                          {t({ it: 'Scala etichetta', en: 'Label scale' })}
                          <span className="ml-auto text-xs font-mono text-slate-600 tabular-nums">
                            {Number(planScale?.labelScale ?? 1).toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={1.8}
                          step={0.05}
                          value={Number(planScale?.labelScale ?? 1)}
                          onChange={(e) => updateScaleStyle({ labelScale: Number(e.target.value) })}
                          className="mt-1 w-full"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setScaleActionsOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={() => {
                        setScaleActionsOpen(false);
                        openScaleEdit();
                      }}
                      className="btn-secondary"
                    >
                      {t({ it: 'Ricalibra scala', en: 'Recalibrate scale' })}
                    </button>
                    <button
                      onClick={() => {
                        setScaleActionsOpen(false);
                        setClearScaleConfirmOpen(true);
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    >
                      {t({ it: 'Elimina scala', en: 'Delete scale' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
);
