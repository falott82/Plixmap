import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../i18n/useT';
import LogsPanel from './LogsPanel';
import EmailLogsPanel from './EmailLogsPanel';
import AuditTrailPanel from './AuditTrailPanel';
import { fetchLogsMeta, LogsMeta } from '../../api/logs';
import { useToastStore } from '../../store/useToast';

type LogsTab = 'auth' | 'mail' | 'audit';

const LogsTabsPanel = () => {
  const t = useT();
  const [tab, setTab] = useState<LogsTab>('auth');
  const push = useToastStore((s) => s.push);
  const [meta, setMeta] = useState<LogsMeta>({});

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetchLogsMeta();
      setMeta(res || {});
    } catch {
      push(t({ it: 'Errore caricamento stato log', en: 'Failed to load log status' }), 'danger');
    }
  }, [push, t]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('deskly_logs_tab');
      if (stored === 'auth' || stored === 'mail' || stored === 'audit') setTab(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('deskly_logs_tab', tab);
    } catch {
      // ignore
    }
  }, [tab]);

  useEffect(() => {
    loadMeta().catch(() => {});
  }, [loadMeta]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab('auth')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'auth'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Auth', en: 'Auth' })}
        </button>
        <button
          onClick={() => setTab('mail')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'mail'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Mail', en: 'Mail' })}
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'audit'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Audit', en: 'Audit' })}
        </button>
      </div>

      {tab === 'auth' ? <LogsPanel clearInfo={meta.auth} onCleared={loadMeta} /> : null}
      {tab === 'mail' ? <EmailLogsPanel clearInfo={meta.mail} onCleared={loadMeta} /> : null}
      {tab === 'audit' ? <AuditTrailPanel clearInfo={meta.audit} onCleared={loadMeta} /> : null}
    </div>
  );
};

export default LogsTabsPanel;
