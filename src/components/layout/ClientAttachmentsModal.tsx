import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Download, Eye, Paperclip, X } from 'lucide-react';
import { Client } from '../../store/types';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  client?: Client;
  onClose: () => void;
}

const ClientAttachmentsModal = ({ open, client, onClose }: Props) => {
  const t = useT();
  const attachments = client?.attachments || [];

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                <div className="modal-header items-center">
                  <div className="min-w-0">
                    <Dialog.Title className="modal-title flex items-center gap-2">
                      <Paperclip size={18} className="text-slate-600" />
                      {t({ it: 'Allegati cliente', en: 'Client attachments' })}
                    </Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {client ? <span className="font-semibold text-slate-700">{client.shortName || client.name}</span> : null}
                    </Dialog.Description>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4">
                  {attachments.length ? (
                    <div className="space-y-2">
                      {attachments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ink">{a.name}</div>
                            <div className="text-xs text-slate-500">PDF</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={a.dataUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              title={t({ it: 'Apri in una nuova scheda', en: 'Open in a new tab' })}
                            >
                              <Eye size={16} />
                            </a>
                            <a
                              href={a.dataUrl}
                              download={a.name}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              title={t({ it: 'Scarica', en: 'Download' })}
                            >
                              <Download size={16} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-mist p-3 text-sm text-slate-700">
                      {t({ it: 'Nessun allegato PDF per questo cliente.', en: 'No PDF attachments for this client.' })}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
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

export default ClientAttachmentsModal;
