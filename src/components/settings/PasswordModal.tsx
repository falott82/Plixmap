import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  requireOld?: boolean;
  onClose: () => void;
  onSubmit: (payload: { oldPassword?: string; newPassword: string }) => void;
}

const PasswordModal = ({ open, title, requireOld = false, onClose, onSubmit }: Props) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const newRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setOldPassword('');
    setNewPassword('');
    window.setTimeout(() => newRef.current?.focus(), 0);
  }, [open]);

  const submit = () => {
    if (newPassword.trim().length < 6) return;
    onSubmit({ oldPassword: requireOld ? oldPassword : undefined, newPassword: newPassword.trim() });
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
                  {requireOld ? (
                    <label className="block text-sm font-medium text-slate-700">
                      Password attuale
                      <input
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        type="password"
                      />
                    </label>
                  ) : null}
                  <label className="block text-sm font-medium text-slate-700">
                    Nuova password
                    <input
                      ref={newRef}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      type="password"
                      placeholder="min 6 caratteri"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        }
                      }}
                    />
                  </label>
                  <div className="text-xs text-slate-500">Il cambio password invalida le sessioni precedenti.</div>
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
                    disabled={newPassword.trim().length < 6 || (requireOld && !oldPassword)}
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

export default PasswordModal;

