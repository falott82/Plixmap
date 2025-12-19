import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { fetchAuditLogs, AuditLogRow } from '../../api/auth';
import { useToastStore } from '../../store/useToast';
import { useT } from '../../i18n/useT';

const formatTs = (ts: number) => {
  const d = new Date(ts);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

const LogsPanel = () => {
  const { push } = useToastStore();
  const t = useT();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [limit] = useState(200);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs({ q: query.trim() || undefined, limit });
      setRows(res.rows);
    } catch {
      push(t({ it: 'Errore caricamento log', en: 'Failed to load logs' }), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compact = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        detailsObj: (() => {
          if (!r.details) return null;
          try {
            return JSON.parse(r.details);
          } catch {
            return { raw: r.details };
          }
        })()
      })),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return compact;
    return compact.filter((r) => {
      const hay = `${r.event} ${r.username || ''} ${r.ip || ''} ${r.method || ''} ${r.path || ''} ${r.userAgent || ''} ${r.details || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [compact, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">{t({ it: 'Log accessi (superadmin)', en: 'Authentication logs (superadmin)' })}</div>
          <div className="text-xs text-slate-500">
            {t({
              it: 'Solo eventi di autenticazione: login (anche falliti) e logout.',
              en: 'Authentication events only: login attempts (including failures) and logout.'
            })}
          </div>
        </div>
        <button
          onClick={load}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          title={t({ it: 'Aggiorna', en: 'Refresh' })}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-card">
        <div className="text-sm font-semibold text-ink">{t({ it: 'Legenda eventi', en: 'Event legend' })}</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
          <li>
            <span className="font-semibold">login</span>:{' '}
            {t({
              it: 'tentativo di accesso (success/fail). In details.reason puoi trovare bad_password / user_not_found / disabled.',
              en: 'login attempt (success/fail). In details.reason you may see bad_password / user_not_found / disabled.'
            })}
          </li>
          <li>
            <span className="font-semibold">logout</span>: {t({ it: 'uscita dell’utente.', en: 'user signed out.' })}
          </li>
        </ul>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t({ it: 'Cerca per username, IP, path o evento…', en: 'Search by username, IP, path or event…' })}
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') load();
          }}
        />
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
        {filtered.length ? (
          filtered.map((r) => (
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
              <div className="col-span-2 truncate text-slate-600">
                {r.detailsObj ? (
                  <span title={JSON.stringify(r.detailsObj, null, 2)} className="cursor-help">
                    {Object.keys(r.detailsObj).join(', ')}
                  </span>
                ) : (
                  '-'
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-sm text-slate-600">
            {query.trim() ? t({ it: 'Nessun risultato.', en: 'No results.' }) : t({ it: 'Nessun log.', en: 'No logs.' })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsPanel;
