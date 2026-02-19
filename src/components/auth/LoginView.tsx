import { FormEvent, useEffect, useRef, useState } from 'react';
import { Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useT } from '../../i18n/useT';
import { fetchBootstrapStatus, MFARequiredError } from '../../api/auth';
import { releaseHistory } from '../../version/history';
import { PLIXMAP_WEBSITE_URL } from '../../constants/links';

const LoginView = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFirstRunCredentials, setShowFirstRunCredentials] = useState(false);
  const otpRef = useRef<HTMLInputElement | null>(null);
  const version = releaseHistory[0]?.version || '';

  useEffect(() => {
    let cancelled = false;
    fetchBootstrapStatus()
      .then((s) => {
        if (cancelled) return;
        setShowFirstRunCredentials(!!s.showFirstRunCredentials);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(username.trim().toLowerCase(), password, otpRequired ? otp.trim() : undefined);
      navigate('/', { replace: true });
    } catch (e: any) {
      if (e?.lockedUntil) {
        const remainingMs = Math.max(0, Number(e.lockedUntil) - Date.now());
        const minutes = Math.ceil(remainingMs / 60000);
        setError(
          t({
            it: `Account bloccato temporaneamente. Riprova tra ${minutes} minuti.`,
            en: `Account temporarily locked. Try again in ${minutes} minutes.`
          })
        );
        return;
      }
      if (e instanceof MFARequiredError || e?.name === 'MFARequiredError') {
        setOtpRequired(true);
        setOtp('');
        window.setTimeout(() => otpRef.current?.focus(), 0);
        return;
      }
      setError(t({ it: 'Credenziali non valide', en: 'Invalid credentials' }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-blue-100 to-indigo-200 px-4 text-ink">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-24 h-72 w-72 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="relative w-full max-w-md rounded-[28px] border border-white/50 bg-white/85 p-8 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="flex items-center gap-3">
          <a href={PLIXMAP_WEBSITE_URL} target="_blank" rel="noreferrer" title="www.plixmap.com">
            <img
              src="/plixmap-logo.png"
              alt="Plixmap"
              className="h-[4.5rem] w-[4.5rem] rounded-2xl border border-slate-200 object-cover shadow-card"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('/favicon.svg')) return;
                target.src = '/favicon.svg';
              }}
            />
          </a>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Plixmap</div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{t({ it: 'Login', en: 'Login' })}</h1>
              {version ? <span className="text-xs font-semibold text-slate-400">v{version}</span> : null}
            </div>
            <a
              href={PLIXMAP_WEBSITE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
            >
              www.plixmap.com
            </a>
          </div>
        </div>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            {t({ it: 'Utente', en: 'Username' })}
            <div className="relative mt-1">
              <User size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full rounded-xl border border-slate-200 bg-white/90 pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                placeholder={t({ it: 'Nome utente', en: 'Username' })}
                autoComplete="username"
              />
            </div>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t({ it: 'Password', en: 'Password' })}
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/90 pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />
            </div>
          </label>
          {otpRequired ? (
            <label className="block text-sm font-medium text-slate-700">
              {t({ it: 'Codice MFA', en: 'MFA code' })}
              <div className="relative mt-1">
                <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  ref={otpRef}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white/90 pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                  placeholder={t({ it: 'Codice a 6 cifre', en: '6-digit code' })}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOtpRequired(false);
                      setOtp('');
                    }
                  }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t({
                  it: 'Inserisci il codice della tua app di autenticazione.',
                  en: 'Enter the code from your authenticator app.'
                })}
              </div>
            </label>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password || (otpRequired && !otp.trim())}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card enabled:hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? t({ it: 'Accesso…', en: 'Signing in…' }) : t({ it: 'Entra', en: 'Sign in' })}
          </button>
        </form>

        {showFirstRunCredentials ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">{t({ it: 'Primo accesso', en: 'First access' })}</div>
            <div className="mt-1 text-sm">
              {t({
                it: 'Credenziali iniziali: superadmin / deskly. Al primo login verrà richiesto il cambio password.',
                en: 'Initial credentials: superadmin / deskly. On first login you will be asked to change the password.'
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LoginView;
