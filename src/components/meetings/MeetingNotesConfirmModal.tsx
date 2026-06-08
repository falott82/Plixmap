/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

// Save/discard/delete confirmation modal extracted from MeetingNotesModal.
export const MeetingNotesConfirmModal = (props: any) => {
  const { confirmState, closeConfirmModal, confirmDialogInitialFocusRef, confirmTitle, confirmDescription, continueWithoutSaving, confirmAction, t } = props;
  return (
      <Transition show={!!confirmState} as={Fragment}>
        <Dialog as="div" className="relative z-[155]" onClose={closeConfirmModal} initialFocus={confirmDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button
                    ref={confirmDialogInitialFocusRef}
                    type="button"
                    className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
                  >
                    focus-sentinel
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <Dialog.Title className="text-lg font-semibold text-ink">{confirmTitle}</Dialog.Title>
                    <button
                      type="button"
                      onClick={closeConfirmModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi dialog', en: 'Close dialog' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-4 py-4 text-sm text-slate-600">{confirmDescription}</div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closeConfirmModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Annulla e torna alla nota', en: 'Cancel and return to note' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    {confirmState?.kind !== 'delete' ? (
                      <button
                        type="button"
                        onClick={continueWithoutSaving}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                        title={t({
                          it: 'Esci o passa alla nota selezionata senza salvare le modifiche correnti',
                          en: 'Close or switch note without saving current changes'
                        })}
                      >
                        {t({ it: 'Continua senza salvare', en: 'Continue without saving' })}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void confirmAction()}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-95 ${
                        confirmState?.kind === 'delete' ? 'bg-rose-600' : 'bg-primary'
                      }`}
                      title={
                        confirmState?.kind === 'delete'
                          ? t({ it: 'Conferma eliminazione appunto', en: 'Confirm note deletion' })
                          : t({ it: 'Salva modifiche e continua', en: 'Save changes and continue' })
                      }
                    >
                      {confirmState?.kind === 'delete' ? t({ it: 'Elimina', en: 'Delete' }) : t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
