import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { AdminUserRow, Permission } from '../../api/auth';
import { Client } from '../../store/types';
import PermissionsEditor, { permissionsListToMap, permissionsMapToList } from './PermissionsEditor';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  clients: Client[];
  canCreateAdmin: boolean;
  initial?: AdminUserRow | null;
  onClose: () => void;
  onSubmit: (payload: {
    username?: string;
    password?: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    language: 'it' | 'en';
    isAdmin: boolean;
    disabled?: boolean;
    permissions: Permission[];
  }) => void;
}

const UserModal = ({ open, mode, clients, canCreateAdmin, initial, onClose, onSubmit }: Props) => {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [permMap, setPermMap] = useState<Record<string, '' | 'ro' | 'rw'>>({});
  const userRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === 'create') {
      setUsername('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setIsAdmin(false);
      setDisabled(false);
      setLanguage('it');
      setPermMap({});
    } else {
      setUsername(initial?.username || '');
      setPassword('');
      setFirstName(initial?.firstName || '');
      setLastName(initial?.lastName || '');
      setPhone(initial?.phone || '');
      setEmail(initial?.email || '');
      setIsAdmin(!!initial?.isAdmin);
      setDisabled(!!(initial as any)?.disabled);
      setLanguage(((initial as any)?.language === 'en' ? 'en' : 'it') as 'it' | 'en');
      setPermMap(permissionsListToMap(initial?.permissions));
    }
    window.setTimeout(() => userRef.current?.focus(), 0);
  }, [initial, mode, open]);

  const canSubmit = useMemo(() => {
    if (!firstName.trim() || !lastName.trim()) return false;
    if (!email.trim()) return false;
    if (mode === 'create') return !!username.trim() && !!password.trim();
    return true;
  }, [email, firstName, lastName, mode, password, username]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      ...(mode === 'create' ? { username: username.trim(), password } : {}),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      isAdmin,
      disabled,
      language,
      permissions: permissionsMapToList(permMap)
    });
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
              <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {mode === 'create' ? t({ it: 'Nuovo utente', en: 'New user' }) : t({ it: 'Modifica utente', en: 'Edit user' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    {mode === 'create' ? (
                      <>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Username', en: 'Username' })} <span className="text-rose-600">*</span>
                          <input
                            ref={userRef}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder=""
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Password', en: 'Password' })} <span className="text-rose-600">*</span>
                          <input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            type="password"
                            placeholder=""
                          />
                        </label>
                      </>
                    ) : null}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome', en: 'First name' })} <span className="text-rose-600">*</span>
                        <input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Cognome', en: 'Last name' })} <span className="text-rose-600">*</span>
                        <input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        />
                      </label>
                    </div>

                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Email', en: 'Email' })} <span className="text-rose-600">*</span>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder=""
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Telefono', en: 'Phone' })}
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="+39..."
                      />
                    </label>

                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={isAdmin}
                        onChange={(e) => setIsAdmin(e.target.checked)}
                        disabled={!canCreateAdmin}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      {t({ it: 'Admin (accesso completo)', en: 'Admin (full access)' })}
                    </label>
                    {!canCreateAdmin ? (
                      <div className="text-xs text-slate-500">
                        {t({ it: 'Solo i superadmin possono creare o promuovere utenti admin.', en: 'Only superadmins can create or promote admin users.' })}
                      </div>
                    ) : null}

                    {mode === 'edit' ? (
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">
                        <input
                          type="checkbox"
                          checked={disabled}
                          onChange={(e) => setDisabled(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        {t({ it: 'Utente disattivato', en: 'User disabled' })}
                      </label>
                    ) : null}

                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Lingua', en: 'Language' })}
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'it')}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        title={t({ it: 'Lingua', en: 'Language' })}
                      >
                        <option value="it">Italiano</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    {isAdmin ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        {t({
                          it: 'Gli admin hanno accesso completo in lettura/scrittura a tutti i clienti: nessun permesso da configurare.',
                          en: 'Admins have full read/write access to all clients: no permissions to configure.'
                        })}
                      </div>
                    ) : (
                      <PermissionsEditor clients={clients} value={permMap} onChange={setPermMap} />
                    )}
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
                    disabled={!canSubmit}
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

export default UserModal;
