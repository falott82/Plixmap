import { Fragment, type MutableRefObject } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanCorridorModalProps = {
  corridorModal: { mode?: 'create' | 'edit' } | null;
  setCorridorModal: (value: null) => void;
  corridorNameInputRef: MutableRefObject<HTMLInputElement | null>;
  corridorNameInput: string;
  setCorridorNameInput: (value: string) => void;
  corridorNameEnInput: string;
  setCorridorNameEnInput: (value: string) => void;
  corridorShowNameInput: boolean;
  setCorridorShowNameInput: (value: boolean) => void;
  saveCorridorModal: () => void;
  t: Translate;
};

/**
 * Modal to name a corridor (create/rename) and toggle its on-map label,
 * extracted from PlanViewView.tsx.
 */
export const PlanCorridorModal = ({
  corridorModal,
  setCorridorModal,
  corridorNameInputRef,
  corridorNameInput,
  setCorridorNameInput,
  corridorNameEnInput,
  setCorridorNameEnInput,
  corridorShowNameInput,
  setCorridorShowNameInput,
  saveCorridorModal,
  t
}: PlanCorridorModalProps) => (
  <Transition show={!!corridorModal} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setCorridorModal(null)}>
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
                  {corridorModal?.mode === 'edit'
                    ? t({ it: 'Rinomina corridoio', en: 'Rename corridor' })
                    : t({ it: 'Nuovo corridoio', en: 'New corridor' })}
                </Dialog.Title>
                <button
                  onClick={() => setCorridorModal(null)}
                  className="text-slate-500 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <Dialog.Description className="mt-2 text-sm text-slate-600">
                {corridorModal?.mode === 'edit'
                  ? t({
                      it: 'Aggiorna il nome del corridoio e scegli se mostrarlo in planimetria.',
                      en: 'Update corridor name and choose whether to display it on the map.'
                    })
                  : t({
                      it: 'Definisci il nome del corridoio appena disegnato e se deve essere visibile.',
                      en: 'Set corridor name and whether it should be visible.'
                    })}
              </Dialog.Description>
              <div className="mt-4">
                <label className="text-sm font-semibold text-slate-700">
                  {t({ it: 'Nome corridoio', en: 'Corridor name' })}
                  <input
                    ref={corridorNameInputRef}
                    value={corridorNameInput}
                    onChange={(e) => setCorridorNameInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    placeholder={t({ it: 'Es. Corridoio principale', en: 'e.g. Main corridor' })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveCorridorModal();
                      }
                    }}
                  />
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  {t({ it: 'Nome corridoio (EN)', en: 'Corridor name (EN)' })}
                  <input
                    value={corridorNameEnInput}
                    onChange={(e) => setCorridorNameEnInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    placeholder={t({ it: 'Es. Main corridor', en: 'e.g. Main corridor' })}
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={corridorShowNameInput}
                    onChange={(e) => setCorridorShowNameInput(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>{t({ it: 'Mostra nome dentro il corridoio', en: 'Show name inside corridor' })}</span>
                </label>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setCorridorModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  {t({ it: 'Annulla', en: 'Cancel' })}
                </button>
                <button onClick={saveCorridorModal} className="btn-primary">
                  {corridorModal?.mode === 'edit' ? t({ it: 'Salva', en: 'Save' }) : t({ it: 'Crea corridoio', en: 'Create corridor' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
