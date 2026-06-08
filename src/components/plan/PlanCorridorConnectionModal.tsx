import { Fragment, type Dispatch, type SetStateAction } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type CorridorConnectionState = {
  connectionId?: string | null;
  corridorId: string;
  edgeIndex: number;
  t: number;
  x: number;
  y: number;
  selectedPlanIds: string[];
  transitionType: 'stairs' | 'elevator';
};

export type PlanCorridorConnectionModalProps = {
  corridorConnectionModal: CorridorConnectionState | null;
  setCorridorConnectionModal: Dispatch<SetStateAction<CorridorConnectionState | null>>;
  corridorConnectionTargetPlans: Array<{ id: string; name: string }>;
  saveCorridorConnectionModal: () => void;
  t: Translate;
};

/**
 * Modal to create/edit a floor-connection point on a corridor (stairs/elevator
 * + linked floor plans), extracted from PlanViewView.tsx.
 */
export const PlanCorridorConnectionModal = ({
  corridorConnectionModal,
  setCorridorConnectionModal,
  corridorConnectionTargetPlans,
  saveCorridorConnectionModal,
  t
}: PlanCorridorConnectionModalProps) => (
  <Transition show={!!corridorConnectionModal} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setCorridorConnectionModal(null)}>
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
              <div className="flex items-center justify-between">
                <Dialog.Title className="modal-title">
                  {corridorConnectionModal?.connectionId
                    ? t({ it: 'Modifica punto di collegamento tra piani', en: 'Edit floor-connection point' })
                    : t({ it: 'Nuovo punto di collegamento tra piani', en: 'New floor-connection point' })}
                </Dialog.Title>
                <button
                  onClick={() => setCorridorConnectionModal(null)}
                  className="text-slate-500 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <Dialog.Description className="mt-2 text-sm text-slate-600">
                {t({
                  it: 'Opzionale: seleziona i piani collegati da questo punto di collegamento.',
                  en: 'Optional: select floor plans linked by this connection point.'
                })}
              </Dialog.Description>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Tipo collegamento', en: 'Connection type' })}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCorridorConnectionModal((prev) => (prev ? { ...prev, transitionType: 'stairs' } : prev))}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      corridorConnectionModal?.transitionType !== 'elevator'
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t({ it: 'Scale', en: 'Stairs' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorridorConnectionModal((prev) => (prev ? { ...prev, transitionType: 'elevator' } : prev))}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      corridorConnectionModal?.transitionType === 'elevator'
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t({ it: 'Ascensore', en: 'Elevator' })}
                  </button>
                </div>
              </div>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                {corridorConnectionTargetPlans.length ? (
                  corridorConnectionTargetPlans.map((floorPlan) => {
                    const checked = !!corridorConnectionModal?.selectedPlanIds.includes(floorPlan.id);
                    return (
                      <label
                        key={floorPlan.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked;
                            setCorridorConnectionModal((prev) => {
                              if (!prev) return prev;
                              const ids = nextChecked
                                ? Array.from(new Set([...prev.selectedPlanIds, floorPlan.id]))
                                : prev.selectedPlanIds.filter((id) => id !== floorPlan.id);
                              return { ...prev, selectedPlanIds: ids };
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="truncate">{floorPlan.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    {t({ it: 'Nessun altro piano disponibile in questa sede.', en: 'No other floor plans available in this site.' })}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setCorridorConnectionModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  {t({ it: 'Annulla', en: 'Cancel' })}
                </button>
                <button onClick={saveCorridorConnectionModal} className="btn-primary">
                  {corridorConnectionModal?.connectionId
                    ? t({ it: 'Salva modifiche', en: 'Save changes' })
                    : t({ it: 'Crea punto di collegamento', en: 'Create connection point' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
