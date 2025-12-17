import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Client } from '../../store/types';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
}

const ClientInfoModal = ({ open, client, onClose }: Props) => {
  const t = useT();

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
              <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Info cliente', en: 'Client info' })}
                    </Dialog.Title>
                    <div className="mt-1 truncate text-sm text-slate-600">{client?.shortName || client?.name || ''}</div>
                  </div>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Nome (breve)', en: 'Short name' })}</div>
                    <div className="mt-1 text-sm font-semibold text-ink">{client?.shortName || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Ragione sociale', en: 'Legal name' })}</div>
                    <div className="mt-1 text-sm font-semibold text-ink">{client?.name || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Indirizzo', en: 'Address' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.address || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Telefono', en: 'Phone' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.phone || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Email', en: 'Email' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.email || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'PEC', en: 'PEC' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.pecEmail || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Partita IVA', en: 'VAT ID' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.vatId || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Descrizione', en: 'Description' })}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-ink">{client?.description || '—'}</div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ClientInfoModal;

