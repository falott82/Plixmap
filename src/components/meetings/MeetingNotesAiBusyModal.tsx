/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2 } from 'lucide-react';

// AI transform busy/spinner modal extracted from MeetingNotesModal.
export const MeetingNotesAiBusyModal = (props: any) => {
  const { aiBusy, aiPreview, aiBusyDialogInitialFocusRef, t } = props;
  return (
      <Transition show={!!aiBusy && !aiPreview} as={Fragment}>
        <Dialog as="div" className="relative z-[165]" onClose={() => {}} initialFocus={aiBusyDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-2xl">
                <button
                  ref={aiBusyDialogInitialFocusRef}
                  type="button"
                  className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
                >
                  focus-sentinel
                </button>
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 size={22} className="animate-spin" />
                </div>
                <Dialog.Title className="mt-3 text-base font-semibold text-ink">
                  {aiBusy === 'translate'
                    ? t({ it: 'Traduzione selezione in corso', en: 'Selection translation in progress' })
                    : t({ it: 'Correzione selezione in corso', en: 'Selection correction in progress' })}
                </Dialog.Title>
                <div className="mt-1 text-sm text-slate-500">
                  {aiBusy === 'translate'
                    ? t({
                        it: 'Stiamo traducendo la selezione. Attendi qualche secondo…',
                        en: 'We are translating the selection. Please wait a few seconds…'
                      })
                    : t({
                        it: 'Stiamo correggendo la selezione. Attendi qualche secondo…',
                        en: 'We are correcting the selection. Please wait a few seconds…'
                      })}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
  );
};
