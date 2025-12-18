import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, LogOut, Settings as SettingsIcon, UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import { useT } from '../../i18n/useT';

const UserMenu = () => {
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);
  const t = useT();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const label = useMemo(() => {
    if (!user) return '';
    const name = `${user.firstName} ${user.lastName}`.trim();
    return name || user.username;
  }, [user]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-card hover:bg-slate-50"
        title={t({ it: 'Account', en: 'Account' })}
      >
        <UserCircle2 size={18} className="text-slate-600" />
        <span className="max-w-[180px] truncate">{label}</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase text-slate-500">
            {t({ it: 'Lingua', en: 'Language' })}
          </div>
          <div className="flex items-center gap-2 px-2 pb-2">
            {(['it', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={async () => {
                  try {
                    if ((user as any).language === lang) return;
                    await updateMyProfile({ language: lang });
                    useAuthStore.setState((s) =>
                      s.user ? { user: { ...s.user, language: lang } as any, permissions: s.permissions, hydrated: s.hydrated } : s
                    );
                    // Force full refresh so every view picks up the new language consistently.
                    window.location.reload();
                  } catch {
                    // ignore
                  }
                }}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold ${
                  (user as any).language === lang ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 hover:bg-slate-50'
                }`}
                title={lang === 'it' ? 'Italiano' : 'English'}
              >
                {(user as any).language === lang ? <Check size={14} /> : null}
                {lang === 'it' ? 'ITA' : 'ENG'}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-2" />
          <button
            onClick={() => {
              setOpen(false);
              navigate('/settings?tab=account');
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
          >
            <SettingsIcon size={16} className="text-slate-500" />
            {t({ it: 'Gestione profilo', en: 'Profile' })}
          </button>
          <button
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/login', { replace: true });
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            <LogOut size={16} />
            {t({ it: 'Logout', en: 'Logout' })}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default UserMenu;
