import { Fragment, type MutableRefObject } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanTypeLayerModalProps = {
  typeLayerModal: { label?: string } | null;
  setTypeLayerModal: (value: null) => void;
  typeLayerNameRef: MutableRefObject<HTMLInputElement | null>;
  typeLayerName: string;
  setTypeLayerName: (value: string) => void;
  typeLayerColor: string;
  setTypeLayerColor: (value: string) => void;
  handleCreateTypeLayer: () => void;
  t: Translate;
};

/**
 * Modal to create a layer that collects all objects of a given type,
 * extracted from PlanViewView.tsx.
 */
export const PlanTypeLayerModal = ({
  typeLayerModal,
  setTypeLayerModal,
  typeLayerNameRef,
  typeLayerName,
  setTypeLayerName,
  typeLayerColor,
  setTypeLayerColor,
  handleCreateTypeLayer,
  t
}: PlanTypeLayerModalProps) => (
  <Transition show={!!typeLayerModal} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setTypeLayerModal(null)}>
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
              <div className="flex items-center justify-between gap-3">
                <Dialog.Title className="modal-title">{t({ it: 'Crea layer per tipologia', en: 'Create type layer' })}</Dialog.Title>
                <button
                  onClick={() => setTypeLayerModal(null)}
                  className="text-slate-500 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <Dialog.Description className="mt-2 text-sm text-slate-600">
                {t({
                  it: `Questo layer raccoglierà tutti gli oggetti "${typeLayerModal?.label || ''}".`,
                  en: `This layer will collect all "${typeLayerModal?.label || ''}" objects.`
                })}
              </Dialog.Description>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  {t({ it: 'Nome layer', en: 'Layer name' })}
                  <input
                    ref={typeLayerNameRef}
                    value={typeLayerName}
                    onChange={(e) => setTypeLayerName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    placeholder={t({ it: 'Es. Badge door', en: 'e.g. Badge door' })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && typeLayerName.trim()) {
                        handleCreateTypeLayer();
                      }
                    }}
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {t({ it: 'Colore', en: 'Color' })}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={typeLayerColor}
                      onChange={(e) => setTypeLayerColor(e.target.value)}
                      className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-1"
                      aria-label={t({ it: 'Colore layer', en: 'Layer color' })}
                    />
                    <input
                      value={typeLayerColor}
                      onChange={(e) => setTypeLayerColor(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-mono outline-none ring-primary/30 focus:ring-2"
                      placeholder="#0ea5e9"
                    />
                  </div>
                </label>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setTypeLayerModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  {t({ it: 'Annulla', en: 'Cancel' })}
                </button>
                <button
                  onClick={() => handleCreateTypeLayer()}
                  disabled={!typeLayerName.trim()}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t({ it: 'Crea layer', en: 'Create layer' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
