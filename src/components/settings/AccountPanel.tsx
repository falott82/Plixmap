import { useEffect, useState } from 'react';
import { KeyRound, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToast';
import { changePassword } from '../../api/auth';
import PasswordModal from './PasswordModal';
import { useT } from '../../i18n/useT';
import { getMfaStatus } from '../../api/mfa';
import MfaModal from './MfaModal';

const AccountPanel = () => {
  const { user } = useAuthStore();
  const { push } = useToastStore();
  const [pwOpen, setPwOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const t = useT();

  if (!user) return null;

  const loadMfa = async () => {
    try {
      const s = await getMfaStatus();
      setMfaEnabled(!!s.enabled);
    } catch {
      setMfaEnabled(false);
    }
  };

  useEffect(() => {
    loadMfa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="text-sm font-semibold text-ink">{t({ it: 'Account', en: 'Account' })}</div>
        <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Username', en: 'Username' })}</div>
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
            <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Email', en: 'Email' })}</div>
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
            title={t({ it: 'Apri cambio password', en: 'Open password change' })}
          >
            <KeyRound size={16} />
            {t({ it: 'Cambia password', en: 'Change password' })}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">{t({ it: 'MFA (opzionale)', en: 'MFA (optional)' })}</div>
            <div className="text-xs text-slate-500">
              {mfaEnabled ? t({ it: 'Attiva', en: 'Enabled' }) : t({ it: 'Non attiva', en: 'Not enabled' })}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t({
                it: 'Per attivare: clicca “Attiva”, inserisci la password, poi “Genera QR” e infine conferma il codice a 6 cifre.',
                en: 'To enable: click “Enable”, enter your password, then “Generate QR”, and finally confirm the 6-digit code.'
              })}
            </div>
          </div>
          <button
            onClick={() => setMfaOpen(true)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              mfaEnabled ? 'border border-slate-200 bg-white text-ink hover:bg-slate-50' : 'bg-primary text-white hover:bg-primary/90'
            }`}
            title={t({ it: 'Gestisci MFA', en: 'Manage MFA' })}
          >
            <Shield size={16} className={mfaEnabled ? 'text-slate-700' : 'text-white'} />
            {mfaEnabled ? t({ it: 'Gestisci', en: 'Manage' }) : t({ it: 'Attiva', en: 'Enable' })}
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

      <MfaModal
        open={mfaOpen}
        enabled={mfaEnabled}
        onClose={() => setMfaOpen(false)}
        onChanged={async () => {
          await loadMfa();
          // If MFA was disabled, the server clears the session cookie.
          // Refresh to force a consistent auth state.
          window.setTimeout(() => window.location.reload(), 300);
        }}
      />
    </div>
  );
};

export default AccountPanel;
