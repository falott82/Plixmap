import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  initialName?: string;
  initialColor?: string;
  onClose: () => void;
  onSubmit: (payload: { name: string; color?: string }) => void;
}

const COLORS = ['#64748b', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9', '#14b8a6'];

const RoomModal = ({ open, initialName = '', initialColor = COLORS[0], onClose, onSubmit }: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setColor(initialColor || COLORS[0]);
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initialColor, initialName, open]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color: color || COLORS[0] });
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
                    {initialName ? t({ it: 'Modifica stanza', en: 'Edit room' }) : t({ it: 'Nuova stanza', en: 'New room' })}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome stanza', en: 'Room name' })}
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. Sala riunioni', en: 'e.g. Meeting room' })}
                    />
                  </label>

                  <div>
                    <div className="text-sm font-medium text-slate-700">{t({ it: 'Colore', en: 'Color' })}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {COLORS.map((c) => {
                        const active = (color || COLORS[0]).toLowerCase() === c.toLowerCase();
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`h-9 w-9 rounded-xl border ${active ? 'border-ink ring-2 ring-primary/30' : 'border-slate-200'}`}
                            style={{ background: c }}
                            title={c}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t({ it: 'Il colore viene usato per evidenziare l’area della stanza.', en: 'The color is used to highlight the room area.' })}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
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

export default RoomModal;
