import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { getWallTypeColor } from '../../utils/wallColors';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanWallCatalogModalProps = {
  wallCatalogOpen: boolean;
  setWallCatalogOpen: (value: boolean) => void;
  wallTypeDefs: Array<{ id: string }>;
  startWallDraw: (typeId: string) => void;
  isReadOnly: boolean;
  getTypeLabel: (id: string) => string;
  t: Translate;
};

/**
 * Catalog modal to pick the wall type before drawing, extracted from
 * PlanViewView.tsx.
 */
export const PlanWallCatalogModal = ({
  wallCatalogOpen,
  setWallCatalogOpen,
  wallTypeDefs,
  startWallDraw,
  isReadOnly,
  getTypeLabel,
  t
}: PlanWallCatalogModalProps) => (
  <Transition show={wallCatalogOpen} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setWallCatalogOpen(false)}>
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
              <div className="flex items-center justify-between">
                <Dialog.Title className="modal-title">{t({ it: 'Catalogo mura', en: 'Wall catalog' })}</Dialog.Title>
                <button
                  onClick={() => setWallCatalogOpen(false)}
                  className="text-slate-500 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <Dialog.Description className="mt-2 text-sm text-slate-600">
                {t({ it: 'Seleziona il tipo di muro da disegnare.', en: 'Select the wall type to draw.' })}
              </Dialog.Description>
              <div className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto">
                {wallTypeDefs.length ? (
                  wallTypeDefs.map((def) => (
                    <button
                      key={def.id}
                      onClick={() => {
                        startWallDraw(def.id);
                        setWallCatalogOpen(false);
                      }}
                      disabled={isReadOnly}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title={getTypeLabel(def.id)}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getWallTypeColor(def.id) }} />
                      <span className="truncate">{getTypeLabel(def.id)}</span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {t({ it: 'Nessun muro disponibile.', en: 'No walls available.' })}
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
