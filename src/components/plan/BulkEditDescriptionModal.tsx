import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  count: number;
  onClose: () => void;
  onSubmit: (payload: { description?: string }) => void;
}

const BulkEditDescriptionModal = ({ open, count, onClose, onSubmit }: Props) => {
  const t = useT();
  const [description, setDescription] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDescription('');
    window.setTimeout(() => ref.current?.focus(), 0);
  }, [open]);

  const save = () => {
    onSubmit({ description: description.trim() || undefined });
    onClose();
  };

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
              <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Modifica descrizione', en: 'Edit description' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {t({
                    it: `Applicherai questa descrizione a ${count} oggetti selezionati.`,
                    en: `This description will be applied to ${count} selected objects.`
                  })}
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Descrizione', en: 'Description' })}
                    <textarea
                      ref={ref}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault();
                          save();
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Vuota per rimuovere la descrizione', en: 'Leave empty to clear the description' })}
                      rows={4}
                    />
                  </label>
                  <div className="text-xs text-slate-500">
                    {t({ it: 'Suggerimento: Ctrl/⌘ + Invio per salvare.', en: 'Tip: Ctrl/⌘ + Enter to save.' })}
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={save}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    {t({ it: 'Applica', en: 'Apply' })}
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

export default BulkEditDescriptionModal;

