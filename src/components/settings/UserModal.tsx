import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { AdminUserRow, Permission } from '../../api/auth';
import { Client } from '../../store/types';
import PermissionsEditor, { permissionsListToMap, permissionsMapToList } from './PermissionsEditor';
import { useT } from '../../i18n/useT';
import { SEED_CLIENT_ID } from '../../store/data';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  clients: Client[];
  canCreateAdmin: boolean;
  templates?: AdminUserRow[];
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

const UserModal = ({ open, mode, clients, canCreateAdmin, templates, initial, onClose, onSubmit }: Props) => {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [permMap, setPermMap] = useState<Record<string, '' | 'ro' | 'rw'>>({});
  const [importFromUserId, setImportFromUserId] = useState('');
  const userRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const seedClientExists = clients.some((c) => c.id === SEED_CLIENT_ID);
    if (mode === 'create') {
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setIsAdmin(false);
      setDisabled(false);
      setLanguage('it');
      setPermMap(seedClientExists ? { [SEED_CLIENT_ID]: 'rw' } : {});
      setImportFromUserId('');
    } else {
      setUsername((initial?.username || '').toLowerCase());
      setPassword('');
      setConfirmPassword('');
      setFirstName(initial?.firstName || '');
      setLastName(initial?.lastName || '');
      setPhone(initial?.phone || '');
      setEmail(initial?.email || '');
      setIsAdmin(!!initial?.isAdmin);
      setDisabled(!!(initial as any)?.disabled);
      setLanguage(((initial as any)?.language === 'en' ? 'en' : 'it') as 'it' | 'en');
      setPermMap(permissionsListToMap(initial?.permissions));
      setImportFromUserId('');
    }
    window.setTimeout(() => userRef.current?.focus(), 0);
  }, [clients, initial, mode, open]);

  const templateOptions = useMemo(() => {
    const list = Array.isArray(templates) ? templates : [];
    if (!canCreateAdmin) {
      return list.filter((u) => !u.isAdmin && !u.isSuperAdmin);
    }
    return list;
  }, [canCreateAdmin, templates]);

  const applyTemplate = (templateId: string) => {
    setImportFromUserId(templateId);
    if (!templateId) {
      const seedClientExists = clients.some((c) => c.id === SEED_CLIENT_ID);
      setIsAdmin(false);
      setPermMap(seedClientExists ? { [SEED_CLIENT_ID]: 'rw' } : {});
      return;
    }
    const source = templateOptions.find((u) => u.id === templateId);
    if (!source) return;
    if (source.isAdmin && canCreateAdmin) {
      setIsAdmin(true);
      setPermMap({});
      return;
    }
    setIsAdmin(false);
    setPermMap(permissionsListToMap(source.permissions));
  };

  useEffect(() => {
    if (mode !== 'create') return;
    if (!isAdmin) return;
    setImportFromUserId('');
    setPermMap({});
  }, [isAdmin, mode]);

  const normalizePhone = (value: string) => {
    const raw = String(value || '');
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch >= '0' && ch <= '9') {
        out += ch;
        continue;
      }
      if (ch === '+' && out.length === 0) {
        out += '+';
      }
    }
    return out;
  };

  const passwordRules = useMemo(() => {
    const s = password;
    return {
      min: s.length >= 8,
      lower: /[a-z]/.test(s),
      upper: /[A-Z]/.test(s),
      number: /[0-9]/.test(s),
      symbol: /[^A-Za-z0-9]/.test(s)
    };
  }, [password]);
  const isStrongPassword =
    passwordRules.min &&
    passwordRules.lower &&
    passwordRules.upper &&
    passwordRules.number &&
    passwordRules.symbol;

  const canSubmit = useMemo(() => {
    if (!firstName.trim() || !lastName.trim()) return false;
    if (!email.trim()) return false;
    if (mode === 'create') {
      if (!username.trim()) return false;
      if (!password.trim()) return false;
      if (!isStrongPassword) return false;
      if (password !== confirmPassword) return false;
      return true;
    }
    return true;
  }, [confirmPassword, email, firstName, isStrongPassword, lastName, mode, password, username]);

  const submit = () => {
    if (!canSubmit) return;
    const lockedDisabled = initial?.isSuperAdmin ? false : disabled;
    onSubmit({
      ...(mode === 'create' ? { username: username.trim().toLowerCase(), password } : {}),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      isAdmin,
      disabled: lockedDisabled,
      language,
      permissions: permissionsMapToList(permMap)
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
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

                <form className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
                  <div className="space-y-3">
                    {mode === 'create' ? (
                      <>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Username', en: 'Username' })} <span className="text-rose-600">*</span>
                          <input
                            ref={userRef}
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder=""
                            autoComplete="new-username"
                            name="deskly_new_username"
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
                            autoComplete="new-password"
                            name="deskly_new_password"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Conferma password', en: 'Confirm password' })}{' '}
                          <span className="text-rose-600">*</span>
                          <input
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            type="password"
                            placeholder="••••••••"
                            autoComplete="new-password"
                            name="deskly_new_password_confirm"
                          />
                          {confirmPassword && password !== confirmPassword ? (
                            <div className="mt-1 text-xs font-semibold text-rose-700">
                              {t({ it: 'Le password non coincidono', en: 'Passwords do not match' })}
                            </div>
                          ) : null}
                        </label>
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <div className="font-semibold text-slate-800">
                            {t({ it: 'Requisiti password', en: 'Password requirements' })}
                          </div>
                          <ul className="ml-4 list-disc space-y-0.5 pt-1">
                            <li className={passwordRules.min ? 'text-emerald-700' : ''}>
                              {t({ it: 'Almeno 8 caratteri', en: 'At least 8 characters' })}
                            </li>
                            <li className={passwordRules.upper ? 'text-emerald-700' : ''}>
                              {t({ it: 'Almeno 1 maiuscola', en: 'At least 1 uppercase letter' })}
                            </li>
                            <li className={passwordRules.lower ? 'text-emerald-700' : ''}>
                              {t({ it: 'Almeno 1 minuscola', en: 'At least 1 lowercase letter' })}
                            </li>
                            <li className={passwordRules.number ? 'text-emerald-700' : ''}>
                              {t({ it: 'Almeno 1 numero', en: 'At least 1 number' })}
                            </li>
                            <li className={passwordRules.symbol ? 'text-emerald-700' : ''}>
                              {t({ it: 'Almeno 1 simbolo', en: 'At least 1 symbol' })}
                            </li>
                          </ul>
                        </div>
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
                        onChange={(e) => setPhone(normalizePhone(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="+39..."
                        inputMode="tel"
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

                    {mode === 'edit' && !initial?.isSuperAdmin ? (
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
                    {mode === 'create' && !isAdmin ? (
                      <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <div className="text-xs font-semibold uppercase text-slate-500">
                          {t({ it: 'Importa permessi', en: 'Import permissions' })}
                        </div>
                        <label className="mt-2 block text-sm font-medium text-slate-700">
                          {t({ it: 'Importa clienti/permessi da', en: 'Import clients/permissions from' })}
                          <select
                            value={importFromUserId}
                            onChange={(e) => applyTemplate(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            <option value="">{t({ it: 'Nessun import', en: 'No import' })}</option>
                            {templateOptions.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.username} {u.isSuperAdmin ? '· superadmin' : u.isAdmin ? '· admin' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="mt-2 text-xs text-slate-500">
                          {t({
                            it: 'Puoi copiare rapidamente i permessi da un utente esistente.',
                            en: 'Quickly copy permissions from an existing user.'
                          })}
                        </div>
                      </div>
                    ) : null}
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
                  <div className="mt-6 flex justify-end gap-2 lg:col-span-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Chiudi senza salvare l’utente', en: 'Close without saving the user' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
                      title={t({ it: 'Salva l’utente', en: 'Save the user' })}
                    >
                      {t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default UserModal;
