import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Shield, Trash2, Upload } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToast';
import { changePassword, fetchMe, updateMyProfile } from '../../api/auth';
import PasswordModal from './PasswordModal';
import { useT } from '../../i18n/useT';
import { getMfaStatus } from '../../api/mfa';
import MfaModal from './MfaModal';
import UserAvatar from '../ui/UserAvatar';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';

const AccountPanel = () => {
  const { user } = useAuthStore();
  const { push } = useToastStore();
  const [pwOpen, setPwOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
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

  const displayName = useMemo(() => `${user.firstName} ${user.lastName}`.trim(), [user.firstName, user.lastName]);

  const cropSquare = async (dataUrl: string) => {
    try {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if (!w || !h) return dataUrl;
      const side = Math.min(w, h);
      const sx = Math.max(0, Math.floor((w - side) / 2));
      const sy = Math.max(0, Math.floor((h - side) / 2));
      const out = 256;
      const canvas = document.createElement('canvas');
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext('2d');
      if (!ctx) return dataUrl;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
      // Prefer webp but fall back to jpeg if needed.
      const webp = canvas.toDataURL('image/webp', 0.9);
      if (typeof webp === 'string' && webp.startsWith('data:image/webp')) return webp;
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch {
      return dataUrl;
    }
  };

  const handleAvatar = async (fileList: FileList | null) => {
    if (!fileList || !fileList[0] || avatarBusy) return;
    const file = fileList[0];
    const validation = validateFile(file, { allowedTypes: uploadMimes.images, maxBytes: uploadLimits.avatarImageBytes });
    if (!validation.ok) {
      push(
        validation.reason === 'size'
          ? t({
              it: `File troppo grande (max ${formatBytes(uploadLimits.avatarImageBytes)}).`,
              en: `File too large (max ${formatBytes(uploadLimits.avatarImageBytes)}).`
            })
          : t({
              it: 'Formato non supportato. Usa JPG, PNG o WEBP.',
              en: 'Unsupported format. Use JPG, PNG, or WEBP.'
            }),
        'danger'
      );
      return;
    }
    setAvatarBusy(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const squared = await cropSquare(raw);
      await updateMyProfile({ avatarUrl: squared });
      const me = await fetchMe();
      useAuthStore.getState().setAuth(me);
      push(t({ it: 'Immagine profilo aggiornata', en: 'Profile image updated' }), 'success');
    } catch {
      push(t({ it: 'Errore aggiornamento immagine profilo', en: 'Failed to update profile image' }), 'danger');
    } finally {
      setAvatarBusy(false);
    }
  };

  const clearAvatar = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    try {
      await updateMyProfile({ avatarUrl: null });
      const me = await fetchMe();
      useAuthStore.getState().setAuth(me);
      push(t({ it: 'Immagine profilo rimossa', en: 'Profile image removed' }), 'success');
    } catch {
      push(t({ it: 'Errore rimozione immagine profilo', en: 'Failed to remove profile image' }), 'danger');
    } finally {
      setAvatarBusy(false);
    }
  };

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

          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink">{t({ it: 'Immagine profilo', en: 'Profile image' })}</div>
                <div className="text-xs text-slate-500">
                  {t({
                    it: `JPG/PNG/WEBP (max ${formatBytes(uploadLimits.avatarImageBytes)}).`,
                    en: `JPG/PNG/WEBP (max ${formatBytes(uploadLimits.avatarImageBytes)}).`
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    avatarBusy ? 'border border-slate-200 bg-white text-slate-400' : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                  title={t({ it: 'Carica immagine', en: 'Upload image' })}
                >
                  <Upload size={16} />
                  {t({ it: 'Carica', en: 'Upload' })}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={avatarBusy}
                    onChange={(e) => handleAvatar(e.target.files)}
                  />
                </label>
                <button
                  onClick={clearAvatar}
                  disabled={avatarBusy || !(user as any).avatarUrl}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title={t({ it: 'Rimuovi immagine', en: 'Remove image' })}
                >
                  <Trash2 size={16} />
                  {t({ it: 'Rimuovi', en: 'Remove' })}
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <UserAvatar src={(user as any).avatarUrl} name={displayName} username={user.username} size={56} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{displayName || `@${user.username}`}</div>
                <div className="truncate text-xs text-slate-500">@{user.username}</div>
              </div>
            </div>
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

      {user.isSuperAdmin && user.username === 'superadmin' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Recupero superadmin (offline)', en: 'Superadmin recovery (offline)' })}</div>
          <p className="mt-2 text-sm text-slate-600">
            {t({
              it: 'Se perdi la password, esegui questo comando sul server (o dentro il container) per impostarne una nuova.',
              en: 'If you lose the password, run this command on the server (or inside the container) to set a new one.'
            })}
          </p>
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">
            docker compose exec deskly node server/reset-superadmin.cjs
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {t({
              it: 'Per resettare l’MFA del superadmin (se hai perso l’app Authenticator):',
              en: 'To reset superadmin MFA (if you lost the Authenticator app):'
            })}
          </p>
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">
            docker compose exec deskly node server/reset-superadmin-mfa.cjs
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t({
              it: 'Il reset invalida le sessioni attive. Ti verra richiesta una password forte.',
              en: 'The reset invalidates active sessions. You will be asked for a strong password.'
            })}
          </p>
        </div>
      ) : null}

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
