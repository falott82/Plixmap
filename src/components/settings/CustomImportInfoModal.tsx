/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

// Client import-info modal (counts + last sync details). Extracted from CustomImportPanel.
export const CustomImportInfoModal = (props: any) => {
  const {
    infoOpen,
    infoClient,
    infoCounts,
    infoDialogFocusRef,
    infoSummary,
    formatDate,
    setInfoOpen,
    t,
  } = props;
  return (
      <Transition show={infoOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[135]" onClose={() => setInfoOpen(false)} initialFocus={infoDialogFocusRef}>
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
                  <button ref={infoDialogFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Info cliente', en: 'Client info' })}</Dialog.Title>
                    <button onClick={() => setInfoOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <div>
                      <div className="text-xs uppercase text-slate-500">{t({ it: 'Nome', en: 'Name' })}</div>
                      <div className="font-semibold text-ink">{infoClient?.name || infoClient?.shortName || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-500">ID</div>
                      <div className="font-mono text-xs text-slate-600">{infoClient?.id || '—'}</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Sedi', en: 'Sites' })}</div>
                        <div className="font-semibold text-ink">{infoCounts.sites}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-slate-500">{t({ it: 'Planimetrie', en: 'Floor plans' })}</div>
                        <div className="font-semibold text-ink">{infoCounts.plans}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-500">{t({ it: 'Ultimo import', en: 'Last import' })}</div>
                      <div className="text-slate-600">{formatDate(infoSummary?.lastImportAt)}</div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setInfoOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Chiudi le info cliente', en: 'Close client info' })}
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
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
