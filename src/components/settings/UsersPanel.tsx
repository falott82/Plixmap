import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FileSpreadsheet, Plus, RefreshCw, Trash, KeyRound, Pencil, Search, ShieldOff, Unlock, Info, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { adminCreateUser, adminDeleteUser, adminFetchUsers, adminUpdateUser, changePassword, resetUserMfa, unlockUser, AdminUserRow } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';
import UserModal from './UserModal';
import PasswordModal from './PasswordModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useT } from '../../i18n/useT';
import UserAvatar from '../ui/UserAvatar';

const UsersPanel = () => {
  const { clients } = useDataStore();
  const { push } = useToastStore();
  const { user } = useAuthStore();
  const t = useT();
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const location = useLocation();
  const navigate = useNavigate();
  const createHandledRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; user: AdminUserRow } | null>(null);
  const [pwModal, setPwModal] = useState<{ user: AdminUserRow } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUserRow | null>(null);
  const [confirmMfaReset, setConfirmMfaReset] = useState<AdminUserRow | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState<AdminUserRow | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await adminFetchUsers();
      setUsers(res.users);
    } catch {
      push(t({ it: 'Errore caricamento utenti', en: 'Failed to load users' }), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const wantsCreate = search.get('create') === '1';
    if (wantsCreate && !createHandledRef.current) {
      createHandledRef.current = true;
      setModal({ mode: 'create' });
      navigate('/settings?tab=users', { replace: true });
    }
    if (!wantsCreate) {
      createHandledRef.current = false;
    }
  }, [location.search, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...users].sort((a, b) => {
      const aSuper = a.isSuperAdmin && a.username === 'superadmin';
      const bSuper = b.isSuperAdmin && b.username === 'superadmin';
      if (aSuper !== bSuper) return aSuper ? -1 : 1;
      return Number(b.createdAt) - Number(a.createdAt);
    });
    if (!q) return base;
    return base.filter((u) => {
      const hay = `${u.username} ${u.firstName} ${u.lastName} ${u.email} ${u.phone || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, users]);

  const formatCreatedAt = (value: number) => {
    if (!value) return '';
    try {
      return new Date(Number(value)).toLocaleString(user?.language === 'en' ? 'en-GB' : 'it-IT');
    } catch {
      return '';
    }
  };

  const exportUsersCsv = () => {
    const rows = [...users].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    const header = [
      'username',
      'role',
      'status',
      'firstName',
      'lastName',
      'email',
      'phone',
      'language',
      'permissionsCount',
      'createdAt'
    ];
    const csvEscape = (value: any) => {
      const s = String(value ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      header.join(','),
      ...rows.map((u) =>
        [
          u.username,
          u.isSuperAdmin ? 'superadmin' : u.isAdmin ? 'admin' : 'user',
          u.disabled ? 'disabled' : 'active',
          u.firstName,
          u.lastName,
          u.email,
          u.phone || '',
          (u as any).language || 'it',
          u.isAdmin ? 'ALL' : String(u.permissions?.length || 0),
          u.createdAt ? new Date(Number(u.createdAt)).toISOString() : ''
        ]
          .map(csvEscape)
          .join(',')
      )
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deskly-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push(t({ it: 'Export CSV pronto', en: 'CSV export ready' }), 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">{t({ it: 'Gestione utenti', en: 'User management' })}</div>
          <div className="text-xs text-slate-500">
            {t({
              it: 'Crea utenti e assegna permessi per cliente/sede/planimetria.',
              en: 'Create users and assign permissions per client/site/floor plan.'
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportUsersCsv}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Esporta Excel (CSV)', en: 'Export Excel (CSV)' })}
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            onClick={reload}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Aggiorna', en: 'Refresh' })}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Guida pulsanti', en: 'Buttons guide' })}
          >
            <Info size={16} />
          </button>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-primary/90"
            title={t({ it: 'Crea un nuovo utente', en: 'Create a new user' })}
          >
            <Plus size={16} /> {t({ it: 'Nuovo utente', en: 'New user' })}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t({ it: 'Cerca per username, nome, email o telefono…', en: 'Search by username, name, email or phone…' })}
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-[2.5fr_2.5fr_1.2fr_1.6fr_0.8fr_0.8fr_1.4fr] gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <div>{t({ it: 'Utente', en: 'User' })}</div>
          <div>{t({ it: 'Anagrafica', en: 'Details' })}</div>
          <div>{t({ it: 'Stato', en: 'Status' })}</div>
          <div>{t({ it: 'Creato il', en: 'Created' })}</div>
          <div>{t({ it: 'Lingua', en: 'Lang' })}</div>
          <div>{t({ it: 'Permessi', en: 'Perms' })}</div>
          <div className="text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
        </div>
        {filtered.length ? (
          filtered.map((u) => {
            const isStrictSuperAdmin = u.isSuperAdmin && u.username === 'superadmin';
            const lockedUntil = u.lockedUntil ? Number(u.lockedUntil) : 0;
            const locked = !!lockedUntil && lockedUntil > Date.now();
            const remainingMinutes = locked ? Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000)) : 0;
            return (
            <div
              key={u.id}
              className={`grid grid-cols-[2.5fr_2.5fr_1.2fr_1.6fr_0.8fr_0.8fr_1.4fr] items-center gap-2 px-4 py-3 text-sm ${
                isStrictSuperAdmin ? 'bg-rose-50/70' : ''
              } hover:bg-slate-50`}
            >
	              <div>
	                <div className="flex items-center gap-2">
	                  <UserAvatar
	                    src={(u as any).avatarUrl}
	                    name={`${u.firstName} ${u.lastName}`.trim()}
	                    username={u.username}
	                    size={22}
	                  />
	                  <div className="min-w-0">
	                    <div className={`font-semibold ${isStrictSuperAdmin ? 'text-rose-600' : 'text-ink'}`}>{u.username}</div>
	                    <div className="text-xs text-slate-500">
	                      {isStrictSuperAdmin ? 'Superadmin' : u.isAdmin ? 'Admin' : t({ it: 'Utente', en: 'User' })}
	                      {u.disabled ? ` • ${t({ it: 'Disattivato', en: 'Disabled' })}` : ''}
	                    </div>
		                  </div>
		                </div>
		              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">
                  {u.firstName} {u.lastName}
                </div>
                <div className="truncate text-xs text-slate-500">{u.email}</div>
                {u.phone ? <div className="truncate text-xs text-slate-500">{u.phone}</div> : null}
              </div>
              <div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    u.disabled
                      ? 'bg-rose-50 text-rose-700'
                      : locked
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}
                  title={
                    locked
                      ? t({
                          it: `Bloccato per altri ${remainingMinutes} min`,
                          en: `Locked for ${remainingMinutes} more min`
                        })
                      : undefined
                  }
                >
                  {u.disabled
                    ? t({ it: 'Disattivo', en: 'Disabled' })
                    : locked
                      ? t({ it: `Bloccato (${remainingMinutes}m)`, en: `Locked (${remainingMinutes}m)` })
                      : t({ it: 'Attivo', en: 'Active' })}
                </span>
              </div>
              <div className="text-xs text-slate-600">{formatCreatedAt(u.createdAt)}</div>
              <div>
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {u.language === 'en' ? 'ENG' : 'ITA'}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                {u.isAdmin ? t({ it: 'Tutti', en: 'All' }) : `${u.permissions?.length || 0}`}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setModal({ mode: 'edit', user: u })}
                  disabled={!isSuperAdmin && isStrictSuperAdmin}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Modifica', en: 'Edit' })}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setPwModal({ user: u })}
                  disabled={!isSuperAdmin && isStrictSuperAdmin}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Reset password', en: 'Reset password' })}
                >
                  <KeyRound size={14} />
                </button>
                <button
                  onClick={() => setConfirmMfaReset(u)}
                  disabled={!isSuperAdmin && isStrictSuperAdmin}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Reset MFA', en: 'Reset MFA' })}
                >
                  <ShieldOff size={14} />
                </button>
                <button
                  onClick={() => setConfirmUnlock(u)}
                  disabled={!locked || (!isSuperAdmin && isStrictSuperAdmin)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Sblocca accesso', en: 'Unlock access' })}
                >
                  <Unlock size={14} />
                </button>
                <button
                  onClick={() => setConfirmDelete(u)}
                  disabled={!isSuperAdmin && isStrictSuperAdmin}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  title={t({ it: 'Elimina', en: 'Delete' })}
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          );
          })
        ) : (
          <div className="px-4 py-6 text-sm text-slate-600">
            {query.trim() ? t({ it: 'Nessun risultato.', en: 'No results.' }) : t({ it: 'Nessun utente.', en: 'No users.' })}
          </div>
        )}
      </div>

      <Transition show={helpOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setHelpOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-2xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Guida pulsanti', en: 'Buttons guide' })}
                    </Dialog.Title>
                    <button
                      onClick={() => setHelpOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="modal-description">
                    {t({
                      it: 'Queste azioni possono richiedere permessi admin o superadmin.',
                      en: 'These actions may require admin or superadmin permissions.'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Azioni rapide', en: 'Quick actions' })}
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <FileSpreadsheet size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Esporta Excel/CSV degli utenti.', en: 'Export users as Excel/CSV.' })}</div>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <RefreshCw size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Ricarica la lista utenti dal server.', en: 'Reload users list from the server.' })}</div>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <Plus size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Crea un nuovo utente con permessi.', en: 'Create a new user with permissions.' })}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Azioni per utente', en: 'Per-user actions' })}
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <Pencil size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Modifica profilo e permessi utente.', en: 'Edit user profile and permissions.' })}</div>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <KeyRound size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Reset password: imposta una nuova password.', en: 'Reset password: set a new password.' })}</div>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <ShieldOff size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Reset MFA: disattiva l’autenticatore.', en: 'Reset MFA: disable the authenticator.' })}</div>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <Unlock size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Sblocca accesso dopo troppi tentativi falliti.', en: 'Unlock access after too many failed attempts.' })}</div>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <Trash size={16} className="mt-0.5 text-slate-500" />
                        <div>{t({ it: 'Elimina l’utente (irreversibile).', en: 'Delete the user (irreversible).' })}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setHelpOpen(false)}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <UserModal
        open={!!modal}
        mode={modal?.mode === 'edit' ? 'edit' : 'create'}
        clients={clients}
        templates={users}
        canCreateAdmin={isSuperAdmin}
        initial={modal?.mode === 'edit' ? modal.user : null}
        onClose={() => setModal(null)}
        onSubmit={async (payload) => {
          try {
            if (modal?.mode === 'edit') {
              await adminUpdateUser(modal.user.id, {
                firstName: payload.firstName,
                lastName: payload.lastName,
                phone: payload.phone,
                email: payload.email,
                language: payload.language || 'it',
                isAdmin: isSuperAdmin ? payload.isAdmin : false,
                disabled: !!payload.disabled,
                permissions: payload.permissions
              });
              push(t({ it: 'Utente aggiornato', en: 'User updated' }), 'success');
            } else {
              await adminCreateUser({
                username: payload.username || '',
                password: payload.password || '',
                firstName: payload.firstName,
                lastName: payload.lastName,
                phone: payload.phone,
                email: payload.email,
                language: payload.language || 'it',
                isAdmin: isSuperAdmin ? payload.isAdmin : false,
                permissions: payload.permissions
              });
              push(t({ it: 'Utente creato', en: 'User created' }), 'success');
            }
            setModal(null);
            await reload();
          } catch (e: any) {
            push(t({ it: 'Errore salvataggio utente', en: 'Failed to save user' }), 'danger');
          }
        }}
      />

      <PasswordModal
        open={!!pwModal}
        title={pwModal ? `Reset password: ${pwModal.user.username}` : 'Reset password'}
        requireOld={false}
        onClose={() => setPwModal(null)}
        onSubmit={async ({ newPassword }) => {
          if (!pwModal) return;
          try {
            await changePassword(pwModal.user.id, { newPassword });
            push(t({ it: 'Password aggiornata', en: 'Password updated' }), 'success');
            setPwModal(null);
          } catch {
            push(t({ it: 'Errore cambio password', en: 'Failed to change password' }), 'danger');
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title={t({ it: 'Eliminare utente?', en: 'Delete user?' })}
        description={
          confirmDelete
            ? t({
                it: `Eliminare l’utente "${confirmDelete.username}"? Questa azione è irreversibile.`,
                en: `Delete user "${confirmDelete.username}"? This action cannot be undone.`
              })
            : undefined
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await adminDeleteUser(confirmDelete.id);
            push(t({ it: 'Utente eliminato', en: 'User deleted' }), 'info');
            setConfirmDelete(null);
            await reload();
          } catch {
            push(t({ it: 'Errore eliminazione utente', en: 'Failed to delete user' }), 'danger');
          }
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <ConfirmDialog
        open={!!confirmMfaReset}
        title={t({ it: 'Reset MFA?', en: 'Reset MFA?' })}
        description={
          confirmMfaReset
            ? t({
                it: `Disattivare MFA per "${confirmMfaReset.username}"? L’utente dovrà riconfigurare l’app di autenticazione.`,
                en: `Disable MFA for "${confirmMfaReset.username}"? The user will need to set up the authenticator again.`
              })
            : undefined
        }
        onCancel={() => setConfirmMfaReset(null)}
        onConfirm={async () => {
          if (!confirmMfaReset) return;
          try {
            await resetUserMfa(confirmMfaReset.id);
            push(t({ it: 'MFA resettata', en: 'MFA reset' }), 'success');
            setConfirmMfaReset(null);
            await reload();
          } catch {
            push(t({ it: 'Errore reset MFA', en: 'Failed to reset MFA' }), 'danger');
          }
        }}
        confirmLabel={t({ it: 'Reset', en: 'Reset' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <ConfirmDialog
        open={!!confirmUnlock}
        title={t({ it: 'Sbloccare accesso?', en: 'Unlock access?' })}
        description={
          confirmUnlock
            ? t({
                it: `Sbloccare l’account "${confirmUnlock.username}"?`,
                en: `Unlock account "${confirmUnlock.username}"?`
              })
            : undefined
        }
        onCancel={() => setConfirmUnlock(null)}
        onConfirm={async () => {
          if (!confirmUnlock) return;
          try {
            await unlockUser(confirmUnlock.id);
            push(t({ it: 'Account sbloccato', en: 'Account unlocked' }), 'success');
            setConfirmUnlock(null);
            await reload();
          } catch {
            push(t({ it: 'Errore sblocco account', en: 'Failed to unlock account' }), 'danger');
          }
        }}
        confirmLabel={t({ it: 'Sblocca', en: 'Unlock' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />
    </div>
  );
};

export default UsersPanel;
