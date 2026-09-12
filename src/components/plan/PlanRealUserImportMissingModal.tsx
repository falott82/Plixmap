import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanRealUserImportMissingModalProps = {
  realUserImportMissing: boolean;
  setRealUserImportMissing: (value: boolean) => void;
  t: Translate;
};

/**
 * Info modal shown when a real user is dragged in but no users have been
 * imported for the client yet. Extracted from PlanViewView.tsx.
 */
export const PlanRealUserImportMissingModal = ({
  realUserImportMissing,
  setRealUserImportMissing,
  t
}: PlanRealUserImportMissingModalProps) => (
  <Transition show={realUserImportMissing} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={() => setRealUserImportMissing(false)}>
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
                <Dialog.Title className="modal-title">{t({ it: 'Import utenti richiesto', en: 'User import required' })}</Dialog.Title>
                <button
                  onClick={() => setRealUserImportMissing(false)}
                  className="text-slate-500 hover:text-ink"
                  title={t({ it: 'Chiudi', en: 'Close' })}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                {t({
                  it: 'Non è possibile trascinare un utente reale in quanto non è stato ancora importato nessun utente per questo cliente. Vai su Settings → Custom Import e carica la lista degli utenti reali.',
                  en: 'You cannot place a real user because no users have been imported for this client yet. Go to Settings → Custom Import and load the real users list.'
                })}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setRealUserImportMissing(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Ok', en: 'Ok' })}
                >
                  {t({ it: 'Ok', en: 'Ok' })}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);
