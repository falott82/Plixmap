import { useEffect, useMemo, useState } from 'react';
import { Download, Info, RefreshCw, Trash2 } from 'lucide-react';
import { AuditLogRow, clearAuthLogs, fetchAuditLogs } from '../../api/auth';
import { useToastStore } from '../../store/useToast';
import { useT } from '../../i18n/useT';
import ConfirmDialog from '../ui/ConfirmDialog';
import { LogsClearMeta } from '../../api/logs';

const formatTs = (ts: number) => {
  const d = new Date(ts);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const toCsv = (rows: AuditLogRow[]) => {
  const esc = (v: any) => {
    const s = String(v ?? '');
    if (!/[,"\n]/.test(s)) return s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ['ts', 'event', 'success', 'username', 'ip', 'method', 'path', 'userAgent', 'details'];
  const out = [header.join(',')];
  for (const r of rows) {
    out.push(
      [
        formatTs(r.ts),
        r.event,
        r.success ? 'true' : 'false',
        r.username || '',
        r.ip || '',
        r.method || '',
        r.path || '',
        r.userAgent || '',
        r.details || ''
      ]
        .map(esc)
        .join(',')
    );
  }
  return out.join('\n');
};

type Props = {
  clearInfo?: LogsClearMeta;
  onCleared?: () => void;
};

const LogsPanel = ({ clearInfo, onCleared }: Props) => {
  const { push } = useToastStore();
  const t = useT();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs({ q: query.trim() || undefined, limit, offset });
      setRows(res.rows);
      setTotal(res.total || 0);
    } catch {
      push(t({ it: 'Errore caricamento log', en: 'Failed to load logs' }), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset]);

  const rangeLabel = useMemo(() => {
    if (!total) return '0';
    const start = total ? offset + 1 : 0;
    const end = Math.min(total, offset + rows.length);
    return `${start}-${end} / ${total}`;
  }, [offset, rows.length, total]);

  const clearedLabel = useMemo(() => {
    if (!clearInfo?.clearedAt) return '';
    const ts = formatTs(clearInfo.clearedAt);
    const who = clearInfo.username || (clearInfo.userId ? t({ it: 'utente sconosciuto', en: 'unknown user' }) : '');
    return who ? `${ts} • ${who}` : ts;
  }, [clearInfo?.clearedAt, clearInfo?.userId, clearInfo?.username, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">{t({ it: 'Log accessi (superadmin)', en: 'Authentication logs (superadmin)' })}</div>
          <div className="text-xs text-slate-500">{t({ it: `Righe: ${rangeLabel}`, en: `Rows: ${rangeLabel}` })}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csv = toCsv(rows);
              downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `plixmap-auth-logs-${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Esporta CSV', en: 'Export CSV' })}
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setConfirmClearOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            title={t({ it: 'Svuota log', en: 'Clear logs' })}
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => {
              setOffset(0);
              load();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Aggiorna', en: 'Refresh' })}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-card">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 text-slate-500">
            <Info size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Cosa sono i logs', en: 'What logs are' })}</div>
            <div className="mt-1 text-sm text-slate-700">
              {t({
                it: 'Qui trovi solo eventi di autenticazione: login (anche falliti) e logout. Per gli eventi di sistema e le azioni importanti usa la tab “Audit trail”.',
                en: 'This section includes authentication events only: login attempts (including failures) and logout. For system events and important actions, use the “Audit trail” tab.'
              })}
            </div>
            <div className="mt-2 text-xs text-slate-600">
              <span className="font-semibold">login</span>:{' '}
              {t({
                it: 'tentativo di accesso (success/fail). In details.reason puoi trovare bad_password / user_not_found / disabled.',
                en: 'login attempt (success/fail). In details.reason you may see bad_password / user_not_found / disabled.'
              })}
              <span className="mx-2">•</span>
              <span className="font-semibold">logout</span>: {t({ it: 'uscita dell’utente.', en: 'user signed out.' })}
            </div>
            {clearedLabel ? (
              <div className="mt-2 text-xs font-semibold text-sky-600">
                {t({ it: 'Ultimo svuotamento', en: 'Last cleared' })}: {clearedLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t({ it: 'Cerca per username, IP, path o evento…', en: 'Search by username, IP, path or event…' })}
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setOffset(0);
                load();
              }
            }}
          />
        </div>
        <select
          value={limit}
          onChange={(e) => {
            setOffset(0);
            setLimit(Math.min(200, Math.max(1, Number(e.target.value) || 200)));
          }}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none ring-primary/30 focus:ring-2"
          title={t({ it: 'Mostra righe', en: 'Rows per page' })}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <button
          onClick={() => {
            setOffset(0);
            load();
          }}
          className="rounded-2xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90"
          title={t({ it: 'Applica filtri e aggiorna la lista', en: 'Apply filters and refresh the list' })}
        >
          {t({ it: 'Cerca', en: 'Search' })}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <div className="col-span-2">{t({ it: 'Quando', en: 'When' })}</div>
          <div className="col-span-2">{t({ it: 'Evento', en: 'Event' })}</div>
          <div className="col-span-2">{t({ it: 'Utente', en: 'User' })}</div>
          <div className="col-span-2">IP</div>
          <div className="col-span-2">HTTP</div>
          <div className="col-span-2">{t({ it: 'Dettagli', en: 'Details' })}</div>
        </div>
        {rows.length ? (
          rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs hover:bg-slate-50">
              <div className="col-span-2 text-slate-600">{formatTs(r.ts)}</div>
              <div className="col-span-2">
                <span className={`rounded-full px-2 py-1 font-semibold ${r.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {r.event}
                </span>
              </div>
              <div className="col-span-2 truncate text-slate-700">{r.username || '-'}</div>
              <div className="col-span-2 truncate text-slate-700">{r.ip || '-'}</div>
              <div className="col-span-2 truncate text-slate-700">{r.method ? `${r.method} ${r.path || ''}` : r.path || '-'}</div>
              <div className="col-span-2 truncate text-slate-600" title={r.details ? String(r.details) : ''}>
                {r.details ? String(r.details).slice(0, 60) : '-'}
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-600">
            {query.trim() ? t({ it: 'Nessun risultato.', en: 'No results.' }) : t({ it: 'Nessun log.', en: 'No logs.' })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          disabled={offset <= 0 || loading}
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title={t({ it: 'Vai alla pagina precedente', en: 'Go to previous page' })}
        >
          {t({ it: 'Precedente', en: 'Previous' })}
        </button>
        <button
          disabled={offset + rows.length >= total || loading}
          onClick={() => setOffset((o) => o + limit)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title={t({ it: 'Vai alla pagina successiva', en: 'Go to next page' })}
        >
          {t({ it: 'Successiva', en: 'Next' })}
        </button>
      </div>

      <ConfirmDialog
        open={confirmClearOpen}
        title={t({ it: 'Svuotare i log accessi?', en: 'Clear authentication logs?' })}
        description={t({
          it: 'Svuota tutti i log accessi. Operazione irreversibile. L’azione verrà registrata con il tuo utente.',
          en: 'Clear all auth logs. This cannot be undone. The action will be recorded with your user.'
        })}
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={async () => {
          setConfirmClearOpen(false);
          try {
            await clearAuthLogs();
            setOffset(0);
            await load();
            onCleared?.();
            push(t({ it: 'Log svuotati', en: 'Logs cleared' }), 'success');
          } catch {
            push(t({ it: 'Impossibile svuotare i log', en: 'Failed to clear logs' }), 'danger');
          }
        }}
        confirmLabel={t({ it: 'Svuota', en: 'Clear' })}
      />
    </div>
  );
};

export default LogsPanel;
