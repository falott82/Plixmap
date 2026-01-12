import { useEffect, useMemo, useState } from 'react';
import { Download, Info, RefreshCw, Shield, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { AuditRow, clearAuditTrail, fetchAuditTrail, getAuditSettings, setAuditSettings } from '../../api/audit';
import { useToastStore } from '../../store/useToast';
import { useT } from '../../i18n/useT';
import ConfirmDialog from '../ui/ConfirmDialog';
import { LogsClearMeta } from '../../api/logs';

const formatTs = (ts: number) => {
  const d = new Date(ts);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

type Props = {
  clearInfo?: LogsClearMeta;
  onCleared?: () => void;
};

const AuditTrailPanel = ({ clearInfo, onCleared }: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | 'important' | 'verbose'>('all');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [limit, setLimit] = useState(200);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [auditVerbose, setAuditVerbose] = useState(false);
  const [auditVerboseLoading, setAuditVerboseLoading] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const loadSettings = async () => {
    try {
      const s = await getAuditSettings();
      setAuditVerbose(!!s.auditVerbose);
    } catch {
      // ignore
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditTrail({ q: query.trim() || undefined, level, limit, offset });
      setRows(res.rows);
      setTotal(res.total || 0);
    } catch {
      push(t({ it: 'Errore caricamento audit trail', en: 'Failed to load audit trail' }), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, level]);

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

  const toCsv = (rows: AuditRow[]) => {
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (!/[,"\n]/.test(s)) return s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ['ts', 'level', 'event', 'username', 'scopeType', 'scopeId', 'ip', 'method', 'path', 'details'];
    const out = [header.join(',')];
    for (const r of rows) {
      out.push(
        [
          formatTs(r.ts),
          r.level,
          r.event,
          r.username || '',
          r.scopeType || '',
          r.scopeId || '',
          r.ip || '',
          r.method || '',
          r.path || '',
          r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : ''
        ]
          .map(esc)
          .join(',')
      );
    }
    return out.join('\n');
  };

  const displayRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        detailsShort: (() => {
          if (!r.details) return '-';
          if (typeof r.details === 'string') return r.details.slice(0, 80);
          try {
            const keys = Object.keys(r.details || {});
            if (!keys.length) return '-';
            return keys.slice(0, 6).join(', ');
          } catch {
            return '-';
          }
        })()
      })),
    [rows]
  );

  const clearedLabel = useMemo(() => {
    if (!clearInfo?.clearedAt) return '';
    const ts = formatTs(clearInfo.clearedAt);
    const who = clearInfo.username || (clearInfo.userId ? t({ it: 'utente sconosciuto', en: 'unknown user' }) : '');
    return who ? `${ts} • ${who}` : ts;
  }, [clearInfo?.clearedAt, clearInfo?.userId, clearInfo?.username, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Shield size={16} /> {t({ it: 'Audit trail', en: 'Audit trail' })}
          </div>
          <div className="text-xs text-slate-500">
            {t({
              it: 'Eventi di sistema e azioni importanti. La modalità “Estesa” aggiunge eventi più dettagliati.',
              en: 'System events and important actions. “Extended” mode adds more detailed events.'
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csv = toCsv(rows);
              downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `deskly-audit-${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t({ it: 'Esporta CSV', en: 'Export CSV' })}
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setConfirmClearOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            title={t({ it: 'Svuota audit trail', en: 'Clear audit trail' })}
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={async () => {
              setAuditVerboseLoading(true);
              try {
                const next = !auditVerbose;
                await setAuditSettings({ auditVerbose: next });
                setAuditVerbose(next);
                push(
                  next
                    ? t({ it: 'Audit esteso abilitato', en: 'Extended audit enabled' })
                    : t({ it: 'Audit esteso disabilitato', en: 'Extended audit disabled' }),
                  'success'
                );
              } catch {
                push(t({ it: 'Impossibile aggiornare impostazione audit', en: 'Failed to update audit setting' }), 'danger');
              } finally {
                setAuditVerboseLoading(false);
              }
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-slate-50"
            title={t({ it: 'Abilita/disabilita audit esteso', en: 'Enable/disable extended audit' })}
            disabled={auditVerboseLoading}
          >
            {auditVerbose ? <ToggleRight size={16} className="text-primary" /> : <ToggleLeft size={16} className="text-slate-500" />}
            {t({ it: 'Estesa', en: 'Extended' })}
          </button>
          <button
            onClick={load}
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
            <div className="text-sm font-semibold text-ink">{t({ it: 'Log estesi', en: 'Extended logs' })}</div>
            <div className="mt-1 text-sm text-slate-700">
              {t({
                it: 'L’audit trail registra eventi di sistema e azioni importanti. Se abiliti “Estesa”, verranno registrati anche eventi più dettagliati (utile per diagnosi, ma genera più righe).',
                en: 'The audit trail records system events and important actions. If you enable “Extended”, more detailed events are recorded as well (useful for troubleshooting, but it generates more entries).'
              })}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {t({ it: `Righe: ${Math.min(total, offset + 1)}-${Math.min(total, offset + rows.length)} / ${total}`, en: `Rows: ${Math.min(total, offset + 1)}-${Math.min(total, offset + rows.length)} / ${total}` })}
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
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t({ it: 'Cerca evento, utente, scope o dettagli…', en: 'Search event, user, scope or details…' })}
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
          value={level}
          onChange={(e) => setLevel(e.target.value as any)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none ring-primary/30 focus:ring-2"
          title={t({ it: 'Filtra livello', en: 'Filter level' })}
        >
          <option value="all">{t({ it: 'Tutti', en: 'All' })}</option>
          <option value="important">{t({ it: 'Importanti', en: 'Important' })}</option>
          <option value="verbose">{t({ it: 'Estesi', en: 'Verbose' })}</option>
        </select>
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
          onClick={load}
          className="rounded-2xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90"
          title={t({ it: 'Applica filtri e aggiorna la lista', en: 'Apply filters and refresh the list' })}
        >
          {t({ it: 'Cerca', en: 'Search' })}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <div className="col-span-2">{t({ it: 'Quando', en: 'When' })}</div>
          <div className="col-span-2">{t({ it: 'Livello', en: 'Level' })}</div>
          <div className="col-span-2">{t({ it: 'Evento', en: 'Event' })}</div>
          <div className="col-span-2">{t({ it: 'Utente', en: 'User' })}</div>
          <div className="col-span-2">{t({ it: 'Scope', en: 'Scope' })}</div>
          <div className="col-span-2">{t({ it: 'Dettagli', en: 'Details' })}</div>
        </div>
        {displayRows.length ? (
          displayRows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs hover:bg-slate-50">
              <div className="col-span-2 text-slate-600">{formatTs(r.ts)}</div>
              <div className="col-span-2">
                <span className={`rounded-full px-2 py-1 font-semibold ${r.level === 'important' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                  {r.level}
                </span>
              </div>
              <div className="col-span-2 truncate text-slate-700" title={r.event}>
                {r.event}
              </div>
              <div className="col-span-2 truncate text-slate-700">{r.username || '-'}</div>
              <div className="col-span-2 truncate text-slate-600" title={`${r.scopeType || ''} ${r.scopeId || ''}`.trim()}>
                {r.scopeType && r.scopeId ? `${r.scopeType}:${r.scopeId}` : '-'}
              </div>
              <div className="col-span-2 truncate text-slate-600" title={r.details ? JSON.stringify(r.details, null, 2) : ''}>
                {r.detailsShort}
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-600">
            {query.trim() ? t({ it: 'Nessun risultato.', en: 'No results.' }) : t({ it: 'Nessun evento.', en: 'No events.' })}
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
        title={t({ it: 'Svuotare l’audit trail?', en: 'Clear audit trail?' })}
        description={t({
          it: 'Svuota tutti gli eventi. Operazione irreversibile. L’azione verrà registrata con il tuo utente.',
          en: 'Clear all events. This cannot be undone. The action will be recorded with your user.'
        })}
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={async () => {
          setConfirmClearOpen(false);
          try {
            await clearAuditTrail();
            setOffset(0);
            await load();
            onCleared?.();
            push(t({ it: 'Audit trail svuotato', en: 'Audit trail cleared' }), 'success');
          } catch {
            push(t({ it: 'Impossibile svuotare audit trail', en: 'Failed to clear audit trail' }), 'danger');
          }
        }}
        confirmLabel={t({ it: 'Svuota', en: 'Clear' })}
      />
    </div>
  );
};

export default AuditTrailPanel;
