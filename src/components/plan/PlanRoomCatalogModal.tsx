import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Square, X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanRoomCatalogModalProps = {
  roomCatalogOpen: boolean;
  setRoomCatalogOpen: (value: boolean) => void;
  beginRoomDraw: () => void;
  beginRoomPolyDraw: () => void;
  isReadOnly: boolean;
  t: Translate;
};

/**
 * Modal to pick the room-creation mode (rectangle / polygon), extracted from
 * PlanViewView.tsx.
 */
export const PlanRoomCatalogModal = ({
  roomCatalogOpen,
  setRoomCatalogOpen,
  beginRoomDraw,
  beginRoomPolyDraw,
  isReadOnly,
  t
}: PlanRoomCatalogModalProps) => (
  <Transition show={roomCatalogOpen} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setRoomCatalogOpen(false)}>
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
                <Dialog.Title className="modal-title">{t({ it: 'Crea stanza', en: 'Create room' })}</Dialog.Title>
                <button
                  onClick={() => setRoomCatalogOpen(false)}
                  className="text-slate-500 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <Dialog.Description className="mt-2 text-sm text-slate-600">
                {t({
                  it: 'Scegli la modalità di creazione stanza. Da tastiera: R per rettangolo, P per poligono.',
                  en: 'Choose the room creation mode. Keyboard: R for rectangle, P for polygon.'
                })}
              </Dialog.Description>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    beginRoomDraw();
                    setRoomCatalogOpen(false);
                  }}
                  disabled={isReadOnly}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Rettangolo', en: 'Rectangle' })}
                >
                  <Square size={16} className="text-slate-500" />
                  {t({ it: 'Rettangolo', en: 'Rectangle' })}
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">R</span>
                </button>
                <button
                  onClick={() => {
                    beginRoomPolyDraw();
                    setRoomCatalogOpen(false);
                  }}
                  disabled={isReadOnly}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Poligono', en: 'Polygon' })}
                >
                  <Square size={16} className="text-slate-500" />
                  {t({ it: 'Poligono', en: 'Polygon' })}
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">P</span>
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
