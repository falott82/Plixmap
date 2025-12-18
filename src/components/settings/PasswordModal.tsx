import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  title: string;
  requireOld?: boolean;
  onClose: () => void;
  onSubmit: (payload: { oldPassword?: string; newPassword: string }) => void;
}

const PasswordModal = ({ open, title, requireOld = false, onClose, onSubmit }: Props) => {
  const t = useT();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const newRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setOldPassword('');
    setNewPassword('');
    setConfirm('');
    window.setTimeout(() => newRef.current?.focus(), 0);
  }, [open]);

  const rules = useMemo(() => {
    const s = newPassword;
    return {
      min: s.length >= 8,
      lower: /[a-z]/.test(s),
      upper: /[A-Z]/.test(s),
      number: /[0-9]/.test(s),
      symbol: /[^A-Za-z0-9]/.test(s)
    };
  }, [newPassword]);
  const isStrong = rules.min && rules.lower && rules.upper && rules.number && rules.symbol;

  const submit = () => {
    if (!isStrong) return;
    if (newPassword !== confirm) return;
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
                  <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {requireOld ? (
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Password attuale', en: 'Current password' })}
                      <input
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        type="password"
                      />
                    </label>
                  ) : null}
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nuova password', en: 'New password' })}
                    <input
                      ref={newRef}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      type="password"
                      placeholder={t({ it: 'Password forte', en: 'Strong password' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        }
                      }}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Conferma password', en: 'Confirm password' })}
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      type="password"
                      placeholder="••••••••"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        }
                      }}
                    />
                    {confirm && newPassword !== confirm ? (
                      <div className="mt-1 text-xs font-semibold text-rose-700">
                        {t({ it: 'Le password non coincidono', en: 'Passwords do not match' })}
                      </div>
                    ) : null}
                  </label>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <div className="font-semibold text-slate-800">{t({ it: 'Requisiti', en: 'Requirements' })}</div>
                    <ul className="ml-4 list-disc space-y-0.5 pt-1">
                      <li className={rules.min ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 8 caratteri', en: 'At least 8 characters' })}</li>
                      <li className={rules.upper ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 maiuscola', en: 'At least 1 uppercase letter' })}</li>
                      <li className={rules.lower ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 minuscola', en: 'At least 1 lowercase letter' })}</li>
                      <li className={rules.number ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 numero', en: 'At least 1 number' })}</li>
                      <li className={rules.symbol ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 simbolo', en: 'At least 1 symbol' })}</li>
                    </ul>
                  </div>
                  <div className="text-xs text-slate-500">
                    {t({
                      it: 'Il cambio password invalida le sessioni precedenti.',
                      en: 'Changing the password invalidates previous sessions.'
                    })}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    disabled={!isStrong || newPassword !== confirm || (requireOld && !oldPassword)}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
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

export default PasswordModal;
