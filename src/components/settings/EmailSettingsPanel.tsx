import { useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, Send } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useToastStore } from '../../store/useToast';
import { fetchEmailSettings, sendTestEmail, updateEmailSettings } from '../../api/email';

const EmailSettingsPanel = () => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [passwordEditing, setPasswordEditing] = useState(false);
  const [testError, setTestError] = useState('');
  const [testResult, setTestResult] = useState('');
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
  const [testRecipient, setTestRecipient] = useState('');
  const formatNow = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const buildTestSubject = () => `Test Email ${formatNow()}`;
  const [testSubject, setTestSubject] = useState(buildTestSubject());

  const updatedLabel = useMemo(() => {
    if (!form.updatedAt) return '';
    try {
      return new Date(form.updatedAt).toLocaleString();
    } catch {
      return '';
    }
  }, [form.updatedAt]);

  const load = async () => {
    setLoading(true);
    try {
      const cfg = await fetchEmailSettings();
      if (cfg) {
        setForm((prev) => ({
          ...prev,
          host: cfg.host || '',
          port: cfg.port ? String(cfg.port) : prev.port,
          securityMode: cfg.securityMode || (cfg.secure ? 'ssl' : 'starttls'),
          username: cfg.username || '',
          fromName: cfg.fromName || '',
          fromEmail: cfg.fromEmail || '',
          hasPassword: !!cfg.hasPassword,
          updatedAt: cfg.updatedAt || null
        }));
      }
    } catch {
      push(t({ it: 'Errore caricamento impostazioni email', en: 'Failed to load email settings' }), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (saving) return;
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
      const updated = await updateEmailSettings(payload);
      setPasswordDirty(false);
      setPasswordEditing(false);
      setForm((prev) => ({
        ...prev,
        password: '',
        hasPassword: !!updated?.hasPassword,
        updatedAt: updated?.updatedAt || prev.updatedAt
      }));
      push(t({ it: 'Impostazioni email salvate', en: 'Email settings saved' }), 'success');
    } catch {
      push(t({ it: 'Salvataggio fallito', en: 'Save failed' }), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (sending) return;
    if (!testRecipient.trim()) {
      push(t({ it: 'Imposta il destinatario del test', en: 'Set the test recipient' }), 'info');
      return;
    }
    setSending(true);
    setTestError('');
    setTestResult('');
    try {
      const subject = testSubject.trim() || buildTestSubject();
      if (!testSubject.trim()) setTestSubject(subject);
      const res = await sendTestEmail(testRecipient.trim(), subject);
      const msg = res?.messageId ? `ID: ${res.messageId}` : '';
      setTestResult(msg);
      push(t({ it: 'Email di test inviata', en: 'Test email sent' }), 'success');
    } catch (err: any) {
      const message = String(err?.message || '').trim();
      setTestError(message);
      push(t({ it: 'Invio email di test fallito', en: 'Failed to send test email' }), 'danger');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Mail size={16} className="text-primary" />
              {t({ it: 'Email (superadmin)', en: 'Email (superadmin)' })}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {t({
                it: 'Configura SMTP per inviare email di test. Salva prima di inviare.',
                en: 'Configure SMTP to send test emails. Save before sending.'
              })}
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            title={t({ it: 'Ricarica impostazioni', en: 'Reload settings' })}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t({ it: 'Ricarica', en: 'Reload' })}
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">SMTP Host</label>
            <input
              value={form.host}
              onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
              placeholder="smtp.example.com"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Port</label>
              <input
                type="number"
                min={1}
                value={form.port}
                onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value }))}
                placeholder="587"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">{t({ it: 'Sicurezza', en: 'Security' })}</label>
              <select
                value={form.securityMode}
                onChange={(e) => {
                  const mode = e.target.value === 'ssl' ? 'ssl' : 'starttls';
                  const port = mode === 'ssl' ? '465' : '587';
                  setForm((prev) => ({ ...prev, securityMode: mode, port }));
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none ring-primary/30 focus:ring-2"
              >
                <option value="ssl">SSL</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="user@example.com"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">{t({ it: 'Password SMTP', en: 'SMTP Password' })}</label>
            <input
              type="password"
              value={!passwordEditing && form.hasPassword ? '********' : form.password}
              onFocus={() => {
                if (!passwordEditing && form.hasPassword) setPasswordEditing(true);
              }}
              onBlur={() => {
                if (!passwordDirty && !form.password) setPasswordEditing(false);
              }}
              onChange={(e) => {
                if (!passwordEditing) setPasswordEditing(true);
                setPasswordDirty(true);
                setForm((prev) => ({ ...prev, password: e.target.value }));
              }}
              placeholder={form.hasPassword ? '********' : ''}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
            />
            <div className="mt-1 text-[11px] text-slate-500">
              {form.hasPassword
                ? t({ it: 'Password salvata. Modifica per sovrascrivere o lascia vuoto per rimuoverla.', en: 'Password saved. Edit to overwrite or leave blank to remove it.' })
                : t({ it: 'Nessuna password salvata.', en: 'No password saved.' })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">{t({ it: 'Nome mittente', en: 'Sender name' })}</label>
            <input
              value={form.fromName}
              onChange={(e) => setForm((prev) => ({ ...prev, fromName: e.target.value }))}
              placeholder="Deskly"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">{t({ it: 'Email mittente', en: 'Sender email' })}</label>
            <input
              value={form.fromEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, fromEmail: e.target.value }))}
              placeholder="noreply@example.com"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">{updatedLabel ? `${t({ it: 'Ultimo aggiornamento', en: 'Last update' })}: ${updatedLabel}` : ''}</div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t({ it: 'Salvataggio...', en: 'Saving...' }) : t({ it: 'Salva impostazioni', en: 'Save settings' })}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Email di test', en: 'Test email' })}</div>
            <div className="mt-1 text-xs text-slate-600">
              {t({ it: 'Oggetto: "Test Deskly Email".', en: 'Subject: "Test Deskly Email".' })}
            </div>
          </div>
          <button
            onClick={handleSendTest}
            disabled={sending}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={16} />
            {sending ? t({ it: 'Invio...', en: 'Sending...' }) : t({ it: 'Invia test', en: 'Send test' })}
          </button>
        </div>
        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-600">{t({ it: 'Oggetto test', en: 'Test subject' })}</label>
          <input
            value={testSubject}
            onChange={(e) => setTestSubject(e.target.value)}
            placeholder={buildTestSubject()}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
          />
        </div>
        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-600">{t({ it: 'Destinatario test', en: 'Test recipient' })}</label>
          <input
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="test@example.com"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
          />
          {testError ? <div className="mt-2 text-xs font-semibold text-rose-600">{testError}</div> : null}
          {!testError && testResult ? <div className="mt-2 text-xs font-semibold text-emerald-600">{testResult}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default EmailSettingsPanel;
