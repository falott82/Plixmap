import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n/useT';

export type LinkEditPayload = { name?: string; description?: string };

interface Props {
  open: boolean;
  initial?: LinkEditPayload;
  onClose: () => void;
  onSubmit: (payload: LinkEditPayload) => void;
}

const LinkEditModal = ({ open, initial, onClose, onSubmit }: Props) => {
  const t = useT();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(String(initial?.name || ''));
    setDescription(String(initial?.description || ''));
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initial, open]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Modifica collegamento', en: 'Edit link' })}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {t({
                    it: 'Aggiorna nome e descrizione del collegamento.',
                    en: 'Update the link name and description.'
                  })}
                </Dialog.Description>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <label className="text-sm font-semibold text-slate-700">
                    {t({ it: 'Nome', en: 'Name' })}
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Opzionale', en: 'Optional' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onSubmit({ name: name.trim() || undefined, description: description.trim() || undefined });
                        }
                      }}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {t({ it: 'Descrizione', en: 'Description' })}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 h-28 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Opzionale', en: 'Optional' })}
                    />
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={() => onSubmit({ name: name.trim() || undefined, description: description.trim() || undefined })}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    {t({ it: 'Salva', en: 'Save' })}
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

export default LinkEditModal;

