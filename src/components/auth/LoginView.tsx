import { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useT } from '../../i18n/useT';

const LoginView = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const t = useT();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch {
      setError('Credenziali non valide');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-mist px-4 text-ink">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-card">
            D
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Deskly</div>
            <h1 className="text-2xl font-semibold">{t({ it: 'Login', en: 'Login' })}</h1>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            {t({ it: 'Utente', en: 'Username' })}
            <div className="relative mt-1">
              <User size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                placeholder="admin"
                autoComplete="username"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
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
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
            </div>
          </label>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <button
          onClick={submit}
          disabled={loading || !username.trim() || !password}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card enabled:hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? t({ it: 'Accesso…', en: 'Signing in…' }) : t({ it: 'Entra', en: 'Sign in' })}
        </button>

      </div>
    </div>
  );
};

export default LoginView;
