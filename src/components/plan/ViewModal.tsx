import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; description?: string; isDefault: boolean }) => void;
  initialName?: string;
  initialDescription?: string;
  initialDefault?: boolean;
}

const ViewModal = ({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialDescription = '',
  initialDefault = false
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isDefault, setIsDefault] = useState(initialDefault);
  const [lastCustomName, setLastCustomName] = useState(initialName);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription);
    setIsDefault(initialDefault);
    setLastCustomName(initialName);
  }, [open, initialDefault, initialDescription, initialName]);

  useEffect(() => {
    if (!open) return;
    if (isDefault) {
      if (name !== 'DEFAULT') setName('DEFAULT');
    }
  }, [isDefault, open]);

  const handleSave = () => {
    const finalName = isDefault ? 'DEFAULT' : name.trim();
    if (!finalName) return;
    onSubmit({ name: finalName, description: description.trim() || undefined, isDefault });
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
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Salva vista', en: 'Save view' })}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome vista', en: 'View name' })} {isDefault ? null : <span className="text-rose-600">*</span>}
                    <input
                      value={name}
                      onChange={(e) => {
                        if (isDefault) return;
                        setName(e.target.value);
                        setLastCustomName(e.target.value);
                      }}
                      disabled={isDefault}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. Sala riunioni', en: 'e.g. Meeting room' })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Descrizione (opzionale)', en: 'Description (optional)' })}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. Zoom su stanza A, lato nord', en: 'e.g. Zoom on room A, north side' })}
                      rows={3}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setIsDefault(next);
                        if (next) {
                          if (name && name !== 'DEFAULT') setLastCustomName(name);
                          setName('DEFAULT');
                        } else {
                          setName(lastCustomName || '');
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary"
                    />
                    Default
                  </label>
                  <div className="text-xs text-slate-500">
                    {t({
                      it: 'Se impostata come default, questa vista verrà caricata automaticamente per questa planimetria.',
                      en: 'If set as default, this view will be loaded automatically for this floor plan.'
                    })}
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
                    onClick={handleSave}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
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

export default ViewModal;
