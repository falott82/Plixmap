import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { IconName, MapObjectType } from '../../store/types';
import Icon from '../ui/Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; description?: string }) => void;
  initialName?: string;
  initialDescription?: string;
  typeLabel?: string;
  type?: MapObjectType;
  icon?: IconName;
}

const ObjectModal = ({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialDescription = '',
  typeLabel,
  type,
  icon
}: Props) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      window.setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open, initialDescription, initialName]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || undefined });
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
                    {initialName ? 'Modifica oggetto' : 'Nuovo oggetto'}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                {typeLabel ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    {icon ? <Icon name={icon} className="text-primary" /> : type ? <Icon type={type} className="text-primary" /> : null}
                    {typeLabel}
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Nome
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder="Es. Stampante HR"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Descrizione
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder="Facoltativa"
                      rows={3}
                    />
                  </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSave}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    Salva
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

export default ObjectModal;
