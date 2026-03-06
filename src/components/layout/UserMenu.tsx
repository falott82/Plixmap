import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cog, Copy, ExternalLink, History, Info, LogOut, MessageSquare, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRCodeLib from 'qrcode';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import { useT } from '../../i18n/useT';
import { useUIStore } from '../../store/useUIStore';
import { fetchMobileAppUrl } from '../../api/mobile';
import UserAvatar from '../ui/UserAvatar';

const UserMenu = () => {
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileAppUrl, setMobileAppUrl] = useState('');
  const [mobileQrUrl, setMobileQrUrl] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef<HTMLDivElement | null>(null);
  const t = useT();
  const { dirtyByPlan, setPendingPostSaveAction, requestSaveAndNavigate, openHelp, openChangelog, openUpdateCheck, toggleClientChat, chatUnreadSenderIds } = useUIStore((s) => ({
    dirtyByPlan: s.dirtyByPlan,
    setPendingPostSaveAction: s.setPendingPostSaveAction,
    requestSaveAndNavigate: s.requestSaveAndNavigate,
    openHelp: s.openHelp,
    openChangelog: s.openChangelog,
    openUpdateCheck: s.openUpdateCheck,
    toggleClientChat: (s as any).toggleClientChat,
    chatUnreadSenderIds: (s as any).chatUnreadSenderIds || {}
  }));
  const hasDirtyPlans = useMemo(() => Object.values(dirtyByPlan || {}).some(Boolean), [dirtyByPlan]);
  const unreadSendersCount = useMemo(() => Object.keys(chatUnreadSenderIds || {}).length, [chatUnreadSenderIds]);
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (!mobileModalOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchMobileAppUrl();
        const url = String(res?.url || '').trim() || `${window.location.origin}/mobile`;
        if (cancelled) return;
        setMobileAppUrl(url);
        try {
          const qr = await QRCodeLib.toDataURL(url, { width: 220, margin: 1 });
          if (!cancelled) setMobileQrUrl(qr);
        } catch {
          if (!cancelled) setMobileQrUrl('');
        }
      } catch {
        const fallback = `${window.location.origin}/mobile`;
        if (cancelled) return;
        setMobileAppUrl(fallback);
        try {
          const qr = await QRCodeLib.toDataURL(fallback, { width: 220, margin: 1 });
          if (!cancelled) setMobileQrUrl(qr);
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mobileModalOpen]);

  const label = useMemo(() => {
    if (!user) return '';
    const name = `${user.firstName} ${user.lastName}`.trim();
    return name || user.username;
  }, [user]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggleClientChat()}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
          title={t({
            it: 'Chat (C): apre la chat clienti/utenti con badge non letti e storico conversazioni.',
            en: 'Chat (C): opens client/user chat with unread badges and conversation history.'
          })}
          aria-label={t({ it: 'Chat', en: 'Chat' })}
        >
          <MessageSquare size={18} className="text-slate-700" />
          {unreadSendersCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
              {unreadSendersCount > 99 ? '99+' : String(unreadSendersCount)}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-card hover:bg-slate-50"
          title={t({ it: 'Account', en: 'Account' })}
        >
          <UserAvatar
            src={(user as any).avatarUrl}
            name={`${user.firstName} ${user.lastName}`.trim()}
            username={user.username}
            size={20}
            className="border-slate-200"
          />
          <span className="max-w-[180px] truncate">{label}</span>
        </button>
      </div>
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
                    if (hasDirtyPlans) {
                      setOpen(false);
                      setPendingPostSaveAction({ type: 'language', value: lang });
                      return;
                    }
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
              if (location.pathname.startsWith('/plan/') && hasDirtyPlans) {
                requestSaveAndNavigate('/settings');
                return;
              }
              navigate('/settings');
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
          >
            <Cog size={16} className="text-slate-500" />
            {t({ it: 'Impostazioni', en: 'Settings' })}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              openHelp();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
            title={t({ it: 'Info', en: 'Info' })}
          >
            <Info size={16} className="text-slate-500" />
            {t({ it: 'Info', en: 'Info' })}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              openChangelog();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
            title={t({ it: 'Changelog', en: 'Changelog' })}
          >
            <History size={16} className="text-slate-500" />
            {t({ it: 'Changelog', en: 'Changelog' })}
          </button>
          {isSuperAdmin ? (
            <button
              onClick={() => {
                setOpen(false);
                openUpdateCheck();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
              title={t({ it: 'Controlla aggiornamenti', en: 'Check updates' })}
            >
              <RefreshCw size={16} className="text-slate-500" />
              {t({ it: 'Check updates', en: 'Check updates' })}
            </button>
          ) : null}
          <button
            onClick={() => {
              setOpen(false);
              setMobileModalOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
            title={t({
              it: 'Mobile App: mostra URL e QR per aprire la web app mobile (agenda meeting, chat e check-in).',
              en: 'Mobile App: shows URL and QR code for the mobile web app (meeting agenda, chat and check-in).'
            })}
          >
            <Smartphone size={16} className="text-slate-500" />
            {t({ it: 'Mobile App', en: 'Mobile App' })}
          </button>
          <button
            onClick={async () => {
              setOpen(false);
              if (hasDirtyPlans) {
                setPendingPostSaveAction({ type: 'logout' });
                return;
              }
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
      {mobileModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={() => setMobileModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-ink">{t({ it: 'Mobile App', en: 'Mobile App' })}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {t({
                    it: 'Scansiona il QR dal telefono per aprire la web app mobile (agenda giornaliera, chat e check-in meeting).',
                    en: 'Scan the QR code from your phone to open the mobile web app (daily agenda, chat and meeting check-in).'
                  })}
                </div>
              </div>
              <button type="button" onClick={() => setMobileModalOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center">
              {mobileQrUrl ? (
                <img src={mobileQrUrl} alt="Mobile app QR code" className="h-56 w-56 rounded-2xl border border-slate-200 bg-white p-2" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-slate-400">
                  <QrCode size={28} />
                </div>
              )}
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t({ it: 'URL mobile', en: 'Mobile URL' })}
              </label>
              <input readOnly value={mobileAppUrl} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(mobileAppUrl);
                  } catch {}
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                <Copy size={15} />
                {t({ it: 'Copia link', en: 'Copy link' })}
              </button>
              <button
                type="button"
                onClick={() => window.open(mobileAppUrl, '_blank', 'noopener,noreferrer')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <ExternalLink size={15} />
                {t({ it: 'Apri link', en: 'Open link' })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UserMenu;
