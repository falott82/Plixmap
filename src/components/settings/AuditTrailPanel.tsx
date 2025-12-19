import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import { fetchAuditTrail, getAuditSettings, setAuditSettings, AuditRow } from '../../api/audit';
import { useToastStore } from '../../store/useToast';
import { useT } from '../../i18n/useT';

const formatTs = (ts: number) => {
  const d = new Date(ts);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

const AuditTrailPanel = () => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | 'important' | 'verbose'>('all');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditVerbose, setAuditVerbose] = useState(false);
  const [auditVerboseLoading, setAuditVerboseLoading] = useState(false);

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
      const res = await fetchAuditTrail({ q: query.trim() || undefined, level, limit: 250 });
      setRows(res.rows);
    } catch {
      push(t({ it: 'Errore caricamento audit trail', en: 'Failed to load audit trail' }), 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t({ it: 'Cerca evento, utente, scope o dettagli…', en: 'Search event, user, scope or details…' })}
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') load();
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
        <button
          onClick={load}
          className="rounded-2xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90"
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
    </div>
  );
};

export default AuditTrailPanel;

