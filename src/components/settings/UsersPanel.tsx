import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Plus, RefreshCw, Trash, KeyRound, Pencil, Search } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { adminCreateUser, adminDeleteUser, adminFetchUsers, adminUpdateUser, changePassword, AdminUserRow } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';
import UserModal from './UserModal';
import PasswordModal from './PasswordModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useT } from '../../i18n/useT';

const UsersPanel = () => {
  const { clients } = useDataStore();
  const { push } = useToastStore();
  const { user } = useAuthStore();
  const t = useT();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; user: AdminUserRow } | null>(null);
  const [pwModal, setPwModal] = useState<{ user: AdminUserRow } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUserRow | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await adminFetchUsers();
      setUsers(res.users);
    } catch {
      push('Errore caricamento utenti', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...users].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    if (!q) return base;
    return base.filter((u) => {
      const hay = `${u.username} ${u.firstName} ${u.lastName} ${u.email} ${u.phone || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, users]);

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
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-primary/90"
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
        <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <div className="col-span-3">{t({ it: 'Utente', en: 'User' })}</div>
          <div className="col-span-3">{t({ it: 'Anagrafica', en: 'Details' })}</div>
          <div className="col-span-2">{t({ it: 'Stato', en: 'Status' })}</div>
          <div className="col-span-1">{t({ it: 'Lingua', en: 'Lang' })}</div>
          <div className="col-span-1">{t({ it: 'Permessi', en: 'Perms' })}</div>
          <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
        </div>
        {filtered.length ? (
          filtered.map((u) => (
            <div key={u.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-slate-50">
              <div className="col-span-3">
                <div className="font-semibold text-ink">{u.username}</div>
                <div className="text-xs text-slate-500">
                  {u.isSuperAdmin ? 'Superadmin' : u.isAdmin ? 'Admin' : t({ it: 'Utente', en: 'User' })}
                  {u.disabled ? ` • ${t({ it: 'Disattivato', en: 'Disabled' })}` : ''}
                </div>
              </div>
              <div className="col-span-3 min-w-0">
                <div className="truncate font-semibold text-ink">
                  {u.firstName} {u.lastName}
                </div>
                <div className="truncate text-xs text-slate-500">{u.email}</div>
                {u.phone ? <div className="truncate text-xs text-slate-500">{u.phone}</div> : null}
              </div>
              <div className="col-span-2">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    u.disabled ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {u.disabled ? t({ it: 'Disattivo', en: 'Disabled' }) : t({ it: 'Attivo', en: 'Active' })}
                </span>
              </div>
              <div className="col-span-1">
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {u.language === 'en' ? 'ENG' : 'ITA'}
                </span>
              </div>
              <div className="col-span-1 text-xs text-slate-600">
                {u.isAdmin ? t({ it: 'Tutti', en: 'All' }) : `${u.permissions?.length || 0}`}
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => setModal({ mode: 'edit', user: u })}
                  disabled={!isSuperAdmin && u.isSuperAdmin}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Modifica', en: 'Edit' })}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setPwModal({ user: u })}
                  disabled={!isSuperAdmin && u.isSuperAdmin}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title={t({ it: 'Reset password', en: 'Reset password' })}
                >
                  <KeyRound size={14} />
                </button>
                <button
                  onClick={() => setConfirmDelete(u)}
                  disabled={!isSuperAdmin && u.isSuperAdmin}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  title={t({ it: 'Elimina', en: 'Delete' })}
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-600">
            {query.trim() ? t({ it: 'Nessun risultato.', en: 'No results.' }) : t({ it: 'Nessun utente.', en: 'No users.' })}
          </div>
        )}
      </div>

      <UserModal
        open={!!modal}
        mode={modal?.mode === 'edit' ? 'edit' : 'create'}
        clients={clients}
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
    </div>
  );
};

export default UsersPanel;
