import { Fragment, Suspense, lazy } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { usePlanView } from './usePlanView';

const ClientBusinessPartnersModal = lazy(() => import('../layout/ClientBusinessPartnersModal'));

type PlanScaleModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'scaleModal'
  | 'closeScaleModal'
  | 'scaleMetersInput'
  | 'setScaleMetersInput'
  | 'applyScale'
  | 'roomMeetingEditBusinessPartnersModalOpen'
  | 'client'
  | 'setRoomMeetingEditBusinessPartnersModalOpen'
  | 'updateClient'
  | 't'
>;

/**
 * "Set scale" modal (enter linear meters for the selected line); also hosts the
 * client business-partners modal. Extracted from PlanViewView.tsx.
 */
export const PlanScaleModal = ({
  scaleModal,
  closeScaleModal,
  scaleMetersInput,
  setScaleMetersInput,
  applyScale,
  roomMeetingEditBusinessPartnersModalOpen,
  client,
  setRoomMeetingEditBusinessPartnersModalOpen,
  updateClient,
  t
}: PlanScaleModalProps) => (
      <Transition show={!!scaleModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeScaleModal}>
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
                <Dialog.Panel className="w-full max-w-md modal-panel">
                  <Dialog.Title className="modal-title">
                    {t({ it: 'Imposta scala', en: 'Set scale' })}
                  </Dialog.Title>
                  <div className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Inserisci i metri lineari della linea selezionata.',
                      en: 'Enter the linear meters for the selected line.'
                    })}
                  </div>
                  <label className="mt-4 block text-sm font-semibold text-slate-700">
                    {t({ it: 'Metri lineari', en: 'Linear meters' })}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={scaleMetersInput}
                      onChange={(e) => setScaleMetersInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyScale();
                        }
                      }}
                      placeholder={t({ it: 'Esempio: 10,20', en: 'Example: 10.20' })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={applyScale}
                      className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      {t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={closeScaleModal}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
          {roomMeetingEditBusinessPartnersModalOpen && client ? (
            <Suspense fallback={null}>
              <ClientBusinessPartnersModal
                open={roomMeetingEditBusinessPartnersModalOpen && !!client}
                client={client || undefined}
                onClose={() => setRoomMeetingEditBusinessPartnersModalOpen(false)}
                onSave={(businessPartners) => {
                  if (!client?.id) return;
                  updateClient(client.id, { businessPartners } as any);
                  setRoomMeetingEditBusinessPartnersModalOpen(false);
                }}
              />
            </Suspense>
          ) : null}
        </Dialog>
      </Transition>
);
