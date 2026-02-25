import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Mail, RefreshCw, Send, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useToastStore } from '../../store/useToast';
import { fetchClientEmailSettings, sendClientTestEmail, updateClientEmailSettings } from '../../api/email';

interface Props {
  open: boolean;
  clientId?: string | null;
  clientName?: string | null;
  onClose: () => void;
}

const ClientEmailSettingsModal = ({ open, clientId, clientName, onClose }: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [passwordEditing, setPasswordEditing] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testSubject, setTestSubject] = useState('Client SMTP Test');
  const [form, setForm] = useState({
    host: '',
    port: '587',
    securityMode: 'starttls' as 'ssl' | 'starttls',
    username: '',
    password: '',
    fromName: '',
    fromEmail: '',
    hasPassword: false,
    updatedAt: null as number | null
  });

  const updatedLabel = useMemo(() => {
    if (!form.updatedAt) return '';
    try {
      return new Date(form.updatedAt).toLocaleString();
    } catch {
      return '';
    }
  }, [form.updatedAt]);

  const load = async () => {
    const cid = String(clientId || '').trim();
    if (!cid) return;
    setLoading(true);
    try {
      const cfg = await fetchClientEmailSettings(cid);
      setForm((prev) => ({
        ...prev,
        host: cfg?.host || '',
        port: cfg?.port ? String(cfg.port) : '587',
        securityMode: cfg?.securityMode || (cfg?.secure ? 'ssl' : 'starttls'),
        username: cfg?.username || '',
        fromName: cfg?.fromName || '',
        fromEmail: cfg?.fromEmail || '',
        hasPassword: !!cfg?.hasPassword,
        updatedAt: cfg?.updatedAt || null,
        password: ''
      }));
      setPasswordDirty(false);
      setPasswordEditing(false);
    } catch {
      push(t({ it: 'Errore caricamento SMTP cliente', en: 'Failed to load client SMTP' }), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const save = async () => {
    const cid = String(clientId || '').trim();
    if (!cid || saving) return;
    setSaving(true);
    try {
      const payload: any = {
        host: form.host,
        port: form.port,
        securityMode: form.securityMode,
        username: form.username,
        fromName: form.fromName,
        fromEmail: form.fromEmail
      };
      if (passwordDirty && form.password.trim()) payload.password = form.password;
      const updated = await updateClientEmailSettings(cid, payload);
      setForm((prev) => ({
        ...prev,
        hasPassword: !!updated?.hasPassword,
        updatedAt: updated?.updatedAt || prev.updatedAt,
        password: ''
      }));
      setPasswordDirty(false);
      setPasswordEditing(false);
      push(t({ it: 'SMTP cliente salvato', en: 'Client SMTP saved' }), 'success');
    } catch {
      push(t({ it: 'Salvataggio SMTP cliente fallito', en: 'Failed to save client SMTP' }), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const cid = String(clientId || '').trim();
    if (!cid || sending) return;
    if (!testRecipient.trim()) {
      push(t({ it: 'Inserisci destinatario test', en: 'Enter test recipient' }), 'info');
      return;
    }
    setSending(true);
    try {
      await sendClientTestEmail(cid, testRecipient.trim(), testSubject.trim() || undefined);
      push(t({ it: 'Test email inviata', en: 'Test email sent' }), 'success');
    } catch (err: any) {
      push(String(err?.message || t({ it: 'Invio test fallito', en: 'Test send failed' })), 'danger');
    } finally {
      setSending(false);
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[90]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
                      <Mail size={18} className="text-primary" />
                      {t({ it: 'SMTP cliente', en: 'Client SMTP' })}
                    </Dialog.Title>
                    <div className="text-xs text-slate-500">
                      {(clientName || '-') +
                        ' • ' +
                        t({
                          it: 'Usato per inviti/aggiornamenti meeting e richieste kiosk. Se vuoto, fallback al SMTP globale.',
                          en: 'Used for meeting notifications and kiosk help requests. Falls back to global SMTP if empty.'
                        })}
                    </div>
                  </div>
                  <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">SMTP Host</label>
                    <input value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="smtp.example.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Port</label>
                      <input type="number" min={1} value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">{t({ it: 'Sicurezza', en: 'Security' })}</label>
                      <select
                        value={form.securityMode}
                        onChange={(e) => {
                          const mode = e.target.value === 'ssl' ? 'ssl' : 'starttls';
                          setForm((p) => ({ ...p, securityMode: mode, port: mode === 'ssl' ? '465' : '587' }));
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-ink"
                      >
                        <option value="ssl">SSL</option>
                        <option value="starttls">STARTTLS</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Username</label>
                    <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="user@example.com" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">{t({ it: 'Password SMTP', en: 'SMTP Password' })}</label>
                    <form onSubmit={(e) => e.preventDefault()}>
                      <input
                        type="password"
                        value={!passwordEditing && form.hasPassword ? '********' : form.password}
                        onFocus={() => !passwordEditing && form.hasPassword && setPasswordEditing(true)}
                        onChange={(e) => {
                          setPasswordEditing(true);
                          setPasswordDirty(true);
                          setForm((p) => ({ ...p, password: e.target.value }));
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder={t({ it: 'Lascia vuoto per mantenere', en: 'Leave empty to keep current' })}
                      />
                    </form>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">{t({ it: 'Nome mittente', en: 'From name' })}</label>
                    <input value={form.fromName} onChange={(e) => setForm((p) => ({ ...p, fromName: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">{t({ it: 'Email mittente', en: 'From email' })}</label>
                    <input value={form.fromEmail} onChange={(e) => setForm((p) => ({ ...p, fromEmail: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">
                      {updatedLabel
                        ? t({ it: `Ultimo aggiornamento: ${updatedLabel}`, en: `Last updated: ${updatedLabel}` })
                        : t({ it: 'Nessun SMTP cliente configurato. Verrà usato il SMTP globale.', en: 'No client SMTP configured. Global SMTP will be used.' })}
                    </div>
                    <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-slate-50 disabled:opacity-60">
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                      {t({ it: 'Ricarica', en: 'Reload' })}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr,1fr,auto]">
                    <input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder={t({ it: 'Destinatario test', en: 'Test recipient' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                    <input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} placeholder={t({ it: 'Oggetto test', en: 'Test subject' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                    <button type="button" onClick={sendTest} disabled={sending} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60">
                      <Send size={14} />
                      {t({ it: 'Test', en: 'Test' })}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={onClose} className="btn-secondary">
                    {t({ it: 'Chiudi', en: 'Close' })}
                  </button>
                  <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
                    {t({ it: 'Salva SMTP cliente', en: 'Save client SMTP' })}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ClientEmailSettingsModal;
