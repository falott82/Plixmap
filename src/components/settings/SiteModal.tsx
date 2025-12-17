import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  initialName?: string;
  title: string;
  onClose: () => void;
  onSubmit: (payload: { name: string }) => void;
}

const SiteModal = ({ open, initialName = '', title, onClose, onSubmit }: Props) => {
  const [name, setName] = useState(initialName);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initialName, open]);

  const canSubmit = useMemo(() => !!name.trim(), [name]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ name: name.trim() });
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
                  <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title="Chiudi">
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Nome sede
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder="Es. HQ Via Nave 11"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={submit}
                    disabled={!canSubmit}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
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

export default SiteModal;

