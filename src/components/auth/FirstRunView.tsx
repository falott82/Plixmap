import { FormEvent, useMemo, useState } from 'react';
import { Check, Globe, KeyRound, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchMe, firstRunSetup } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';

const FirstRunView = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = (m: { it: string; en: string }) => (language === 'en' ? m.en : m.it);

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

  const canSubmit = useMemo(() => {
    if (!newPassword) return false;
    if (!isStrong) return false;
    if (newPassword !== confirm) return false;
    return true;
  }, [confirm, isStrong, newPassword]);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await firstRunSetup({ newPassword, language });
      const me = await fetchMe();
      useAuthStore.setState({ user: me.user, permissions: me.permissions, hydrated: true });
      try {
        window.sessionStorage.setItem('deskly_first_run_success', '1');
      } catch {}
      navigate('/', { replace: true });
    } catch {
      setError(t({ it: 'Impossibile completare la configurazione.', en: 'Failed to complete setup.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <div className="flex h-screen items-center justify-center bg-mist px-4 text-ink">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-card">
            D
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Deskly</div>
            <h1 className="text-2xl font-semibold">{t({ it: 'Configurazione iniziale', en: 'First-run setup' })}</h1>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <KeyRound size={16} className="text-primary" />
            {t({ it: 'È richiesto un cambio password', en: 'Password change required' })}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {t({
              it: `Benvenuto${user?.username ? `, ${user.username}` : ''}. Scegli una nuova password e la lingua.`,
              en: `Welcome${user?.username ? `, ${user.username}` : ''}. Choose a new password and your language.`
            })}
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Globe size={16} className="text-slate-500" />
              {t({ it: 'Lingua', en: 'Language' })}
            </div>
            <div className="flex items-center gap-2">
              {(['it', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                    language === lang ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                  title={lang === 'it' ? 'Italiano' : 'English'}
                >
                  {language === lang ? <Check size={16} /> : null}
                  {lang === 'it' ? 'ITA' : 'ENG'}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            {t({ it: 'Nuova password', en: 'New password' })} <span className="text-rose-600">*</span>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                placeholder={t({ it: 'Scegli una password forte', en: 'Choose a strong password' })}
                type="password"
                autoComplete="new-password"
              />
            </div>
            <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div className="font-semibold text-slate-800">{t({ it: 'Requisiti password', en: 'Password requirements' })}</div>
              <ul className="ml-4 list-disc space-y-0.5 pt-1">
                <li className={rules.min ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 8 caratteri', en: 'At least 8 characters' })}</li>
                <li className={rules.upper ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 maiuscola', en: 'At least 1 uppercase letter' })}</li>
                <li className={rules.lower ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 minuscola', en: 'At least 1 lowercase letter' })}</li>
                <li className={rules.number ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 numero', en: 'At least 1 number' })}</li>
                <li className={rules.symbol ? 'text-emerald-700' : ''}>{t({ it: 'Almeno 1 simbolo', en: 'At least 1 symbol' })}</li>
              </ul>
            </div>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t({ it: 'Conferma password', en: 'Confirm password' })} <span className="text-rose-600">*</span>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
              />
            </div>
            {confirm && newPassword !== confirm ? (
              <div className="mt-1 text-xs font-semibold text-rose-700">
                {t({ it: 'Le password non coincidono', en: 'Passwords do not match' })}
              </div>
            ) : null}
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card enabled:hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? t({ it: 'Salvataggio…', en: 'Saving…' }) : t({ it: 'Continua', en: 'Continue' })}
          </button>
        </form>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">{t({ it: 'Credenziali iniziali', en: 'Initial credentials' })}</div>
          <div className="mt-1 text-sm">
            {t({
              it: 'Usa: superadmin / deskly (mostrato solo al primo avvio).',
              en: 'Use: superadmin / deskly (shown only on first run).'
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstRunView;
