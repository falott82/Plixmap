import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToast';
import { changePassword } from '../../api/auth';
import PasswordModal from './PasswordModal';
import { useT } from '../../i18n/useT';

const AccountPanel = () => {
  const { user } = useAuthStore();
  const { push } = useToastStore();
  const [pwOpen, setPwOpen] = useState(false);
  const t = useT();

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="text-sm font-semibold text-ink">{t({ it: 'Account', en: 'Account' })}</div>
        <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Username</div>
            <div className="font-semibold text-ink">{user.username}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Ruolo', en: 'Role' })}</div>
            <div className="font-semibold text-ink">{user.isAdmin ? 'Admin' : t({ it: 'Utente', en: 'User' })}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Nome', en: 'Name' })}</div>
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
              <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Telefono', en: 'Phone' })}</div>
              <div className="font-semibold text-ink">{user.phone}</div>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Password', en: 'Password' })}</div>
          <button
            onClick={() => setPwOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <KeyRound size={16} />
            {t({ it: 'Cambia password', en: 'Change password' })}
          </button>
        </div>
      </div>

      <PasswordModal
        open={pwOpen}
        title={t({ it: 'Cambia password', en: 'Change password' })}
        requireOld
        onClose={() => setPwOpen(false)}
        onSubmit={async ({ oldPassword, newPassword }) => {
          try {
            await changePassword(user.id, { oldPassword, newPassword });
            push(t({ it: 'Password aggiornata', en: 'Password updated' }), 'success');
            setPwOpen(false);
          } catch {
            push(t({ it: 'Password attuale non valida', en: 'Invalid current password' }), 'danger');
          }
        }}
      />
    </div>
  );
};

export default AccountPanel;
