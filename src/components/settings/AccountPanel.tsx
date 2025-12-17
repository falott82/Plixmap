import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToast';
import { changePassword } from '../../api/auth';
import PasswordModal from './PasswordModal';

const AccountPanel = () => {
  const { user } = useAuthStore();
  const { push } = useToastStore();
  const [pwOpen, setPwOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="text-sm font-semibold text-ink">Account</div>
        <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Username</div>
            <div className="font-semibold text-ink">{user.username}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Ruolo</div>
            <div className="font-semibold text-ink">{user.isAdmin ? 'Admin' : 'Utente'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Nome</div>
            <div className="font-semibold text-ink">
              {user.firstName} {user.lastName}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Email</div>
            <div className="font-semibold text-ink">{user.email}</div>
          </div>
          {user.phone ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2">
              <div className="text-xs font-semibold uppercase text-slate-500">Telefono</div>
              <div className="font-semibold text-ink">{user.phone}</div>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="text-sm font-semibold text-ink">Password</div>
          <button
            onClick={() => setPwOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <KeyRound size={16} />
            Cambia password
          </button>
        </div>
      </div>

      <PasswordModal
        open={pwOpen}
        title="Cambia password"
        requireOld
        onClose={() => setPwOpen(false)}
        onSubmit={async ({ oldPassword, newPassword }) => {
          try {
            await changePassword(user.id, { oldPassword, newPassword });
            push('Password aggiornata', 'success');
            setPwOpen(false);
          } catch {
            push('Password attuale non valida', 'danger');
          }
        }}
      />
    </div>
  );
};

export default AccountPanel;

