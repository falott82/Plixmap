import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import CorridorDoorLinkRoomEntriesPanel from './CorridorDoorLinkRoomEntriesPanel';
import { usePlanView } from './usePlanView';

type PlanCorridorDoorLinkModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'corridorDoorLinkModal'
  | 'setCorridorDoorLinkModal'
  | 'corridorDoorLinkQuery'
  | 'setCorridorDoorLinkQuery'
  | 'corridorDoorLinkRoomEntries'
  | 'selectedRoomIds'
  | 'saveCorridorDoorLinkModal'
  | 't'
>;

/**
 * Modal to link one or more rooms to a corridor door, extracted from
 * PlanViewView.tsx.
 */
export const PlanCorridorDoorLinkModal = ({
  corridorDoorLinkModal,
  setCorridorDoorLinkModal,
  corridorDoorLinkQuery,
  setCorridorDoorLinkQuery,
  corridorDoorLinkRoomEntries,
  selectedRoomIds,
  saveCorridorDoorLinkModal,
  t
}: PlanCorridorDoorLinkModalProps) => (
      <Transition show={!!corridorDoorLinkModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCorridorDoorLinkModal(null)}>
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
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Collega stanza', en: 'Link room' })}</Dialog.Title>
                    <button
                      onClick={() => setCorridorDoorLinkModal(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Seleziona una o più stanze da collegare alla porta. Per default è selezionata la stanza più vicina.',
                      en: 'Select one or more rooms to link to this door. The nearest room is preselected by default.'
                    })}
                  </Dialog.Description>
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                    <span className="font-semibold">{t({ it: 'Guida rapida:', en: 'Quick hint:' })}</span>{' '}
                    {t({
                      it: 'badge verde = stanza più vicina alla porta; badge azzurro = prossimità al perimetro del corridoio.',
                      en: 'green badge = nearest room to the door; cyan badge = close to the corridor perimeter.'
                    })}
                  </div>
                  <div className="mt-4">
                    <input
                      value={corridorDoorLinkQuery}
                      onChange={(e) => setCorridorDoorLinkQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({
                        it: 'Cerca stanza o utente...',
                        en: 'Search room or user...'
                      })}
                    />
                  </div>
                  <div className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {corridorDoorLinkRoomEntries.length ? <CorridorDoorLinkRoomEntriesPanel {...{ corridorDoorLinkModal, corridorDoorLinkRoomEntries, selectedRoomIds, setCorridorDoorLinkModal, t }} /> : (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        {t({ it: 'Nessuna stanza trovata con questi filtri.', en: 'No rooms found with these filters.' })}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <div className="mr-auto text-xs text-slate-500">
                      {t({
                        it: `${corridorDoorLinkModal?.selectedRoomIds.length || 0} stanze selezionate`,
                        en: `${corridorDoorLinkModal?.selectedRoomIds.length || 0} rooms selected`
                      })}
                    </div>
                    <button
                      onClick={() => setCorridorDoorLinkModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button onClick={saveCorridorDoorLinkModal} className="btn-primary">
                      {t({ it: 'Salva collegamenti', en: 'Save links' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
);
