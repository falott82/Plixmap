import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { KeyRound, Shield, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useT } from '../../i18n/useT';
import { enableMfa, disableMfa, setupMfa } from '../../api/mfa';

export default function MfaModal({
  open,
  enabled,
  onClose,
  onChanged
}: {
  open: boolean;
  enabled: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const otpRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setOtp('');
    setError(null);
    setSetupSecret(null);
    setSetupUrl(null);
    setQrDataUrl(null);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!setupUrl) return;
    QRCode.toDataURL(setupUrl, { margin: 1, width: 220 })
      .then((data: string) => {
        if (cancelled) return;
        setQrDataUrl(data);
        window.setTimeout(() => otpRef.current?.focus(), 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setupUrl]);

  const canSubmit = useMemo(() => {
    if (enabled) return !!password.trim() && !!otp.trim();
    if (!setupSecret) return !!password.trim();
    return !!otp.trim();
  }, [enabled, otp, password, setupSecret]);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (enabled) {
        await disableMfa({ password: password.trim(), otp: otp.trim() });
        onChanged();
        onClose();
        return;
      }
      if (!setupSecret) {
        const res = await setupMfa({ password: password.trim() });
        setSetupSecret(res.secret);
        setSetupUrl(res.otpauthUrl);
        return;
      }
      await enableMfa({ otp: otp.trim() });
      onChanged();
      onClose();
    } catch {
      setError(
        enabled
          ? t({ it: 'Impossibile disattivare MFA. Verifica password e codice.', en: 'Failed to disable MFA. Check password and code.' })
          : t({ it: 'Impossibile attivare MFA. Verifica password e codice.', en: 'Failed to enable MFA. Check password and code.' })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
                    <Shield size={18} /> {enabled ? t({ it: 'Disattiva MFA', en: 'Disable MFA' }) : t({ it: 'Attiva MFA', en: 'Enable MFA' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {enabled
                    ? t({ it: 'Per disattivare MFA conferma password e codice.', en: 'To disable MFA, confirm password and code.' })
                    : t({ it: 'Configura un’app di autenticazione (TOTP) e conferma il codice.', en: 'Set up an authenticator app (TOTP) and confirm the code.' })}
                </div>

                <div className="mt-5 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Password', en: 'Password' })} <span className="text-rose-600">*</span>
                    <div className="relative mt-1">
                      <KeyRound size={16} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !setupSecret && !enabled) submit();
                        }}
                      />
                    </div>
                  </label>

                  {!enabled && setupSecret && setupUrl ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Scansiona QR', en: 'Scan QR' })}</div>
                      <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                        {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="h-[220px] w-[220px] rounded-xl bg-white p-2" /> : null}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-slate-600">
                            {t({ it: 'Se non puoi scansionare, usa questo secret:', en: 'If you cannot scan, use this secret:' })}
                          </div>
                          <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                            {setupSecret}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {(enabled || setupSecret) ? (
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Codice', en: 'Code' })} <span className="text-rose-600">*</span>
                      <input
                        ref={otpRef}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder={t({ it: 'Codice a 6 cifre', en: '6-digit code' })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submit();
                        }}
                      />
                    </label>
                  ) : null}

                  {error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
                  ) : null}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    title={t({ it: 'Chiudi senza modificare MFA', en: 'Close without changing MFA' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    disabled={loading || !canSubmit}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:opacity-60"
                    title={
                      enabled
                        ? t({ it: 'Disattiva MFA', en: 'Disable MFA' })
                        : !setupSecret
                          ? t({ it: 'Genera QR per MFA', en: 'Generate MFA QR' })
                          : t({ it: 'Attiva MFA', en: 'Enable MFA' })
                    }
                  >
                    {enabled
                      ? loading
                        ? t({ it: 'Disattivo…', en: 'Disabling…' })
                        : t({ it: 'Disattiva', en: 'Disable' })
                      : !setupSecret
                        ? loading
                          ? t({ it: 'Genero…', en: 'Generating…' })
                          : t({ it: 'Genera QR', en: 'Generate QR' })
                        : loading
                          ? t({ it: 'Attivo…', en: 'Enabling…' })
                          : t({ it: 'Attiva', en: 'Enable' })}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
