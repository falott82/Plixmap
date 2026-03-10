import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Download, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import ModalShell from '../ui/ModalShell';
import { useT } from '../../i18n/useT';
import { useToastStore } from '../../store/useToast';
import {
  exportExpiredLogsCsv,
  fetchLogRetentionSettings,
  previewLogRetention,
  saveLogRetentionSettings,
  type LogRetentionKind,
  type LogRetentionPreview,
  type LogRetentionSettings
} from '../../api/logs';

const KINDS: LogRetentionKind[] = ['auth', 'mail', 'audit'];

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

const formatDateTime = (ts?: number | null) => {
  if (!ts) return '—';
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString();
};

const areSettingsEqual = (a: LogRetentionSettings | null, b: LogRetentionSettings | null) => {
  if (!a || !b) return false;
  return KINDS.every((kind) => a[kind]?.days === b[kind]?.days && !!a[kind]?.autoCleanup === !!b[kind]?.autoCleanup);
};

const LogsRetentionPanel = ({ onApplied }: { onApplied?: () => void }) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState<LogRetentionSettings | null>(null);
  const [draft, setDraft] = useState<LogRetentionSettings | null>(null);
  const [confirmState, setConfirmState] = useState<{ settings: LogRetentionSettings; preview: LogRetentionPreview } | null>(null);
  const confirmFocusRef = useRef<HTMLButtonElement | null>(null);

  const labels = {
    auth: t({ it: 'Auth', en: 'Auth' }),
    mail: t({ it: 'Mail', en: 'Mail' }),
    audit: t({ it: 'Audit', en: 'Audit' })
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await fetchLogRetentionSettings();
      setSettings(current);
      setDraft(current);
    } catch {
      push(t({ it: 'Errore caricamento policy logs', en: 'Failed to load log retention policy' }), 'danger');
    } finally {
      setLoading(false);
    }
  }, [push, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => !areSettingsEqual(settings, draft), [draft, settings]);

  const updateDraft = (kind: LogRetentionKind, patch: Partial<LogRetentionSettings[LogRetentionKind]>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [kind]: {
          ...prev[kind],
          ...patch
        }
      };
    });
  };

  const persist = useCallback(
    async (nextSettings: LogRetentionSettings, options?: { purgeNow?: boolean }) => {
      setSaving(true);
      try {
        const result = await saveLogRetentionSettings(nextSettings, { purgeNow: options?.purgeNow !== false });
        setSettings(result.settings);
        setDraft(result.settings);
        setConfirmState(null);
        onApplied?.();
        push(
          result.purgeSummary?.totalDeleted
            ? t({
                it: `Policy logs salvata. Eliminati ${result.purgeSummary.totalDeleted} log fuori retention.`,
                en: `Log policy saved. Deleted ${result.purgeSummary.totalDeleted} out-of-retention logs.`
              })
            : t({ it: 'Policy logs salvata', en: 'Log policy saved' }),
          'success'
        );
      } catch {
        push(t({ it: 'Impossibile salvare la policy logs', en: 'Failed to save log policy' }), 'danger');
      } finally {
        setSaving(false);
      }
    },
    [onApplied, push, t]
  );

  const handleSave = useCallback(async () => {
    if (!draft) return;
    try {
      const preview = await previewLogRetention(draft);
      const affected = KINDS.some((kind) => preview.byKind[kind]?.autoCleanup && preview.byKind[kind]?.count > 0);
      if (affected) {
        setConfirmState({ settings: draft, preview });
        return;
      }
      await persist(draft, { purgeNow: true });
    } catch {
      push(t({ it: 'Impossibile analizzare i log da eliminare', en: 'Failed to analyze logs eligible for deletion' }), 'danger');
    }
  }, [draft, persist, push, t]);

  const handleExportAndSave = useCallback(async () => {
    if (!confirmState) return;
    setExporting(true);
    try {
      for (const kind of KINDS) {
        const item = confirmState.preview.byKind[kind];
        if (!item?.autoCleanup || !item.count) continue;
        const blob = await exportExpiredLogsCsv(kind, confirmState.settings);
        downloadBlob(blob, `plixmap-${kind}-logs-before-retention-${new Date().toISOString().slice(0, 10)}.csv`);
      }
      await persist(confirmState.settings, { purgeNow: true });
    } catch {
      push(t({ it: 'Export CSV dei log fallito', en: 'Failed to export logs CSV' }), 'danger');
    } finally {
      setExporting(false);
    }
  }, [confirmState, persist, push, t]);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Archive size={16} />
              {t({ it: 'Retention e autopulizia logs', en: 'Logs retention and auto-cleanup' })}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {t({
                it: 'Imposta quanti giorni mantenere per Auth, Mail e Audit. La retention va da 1 a 90 giorni. Default consigliato: 30 giorni.',
                en: 'Set how many days to keep Auth, Mail and Audit logs. Retention ranges from 1 to 90 days. Recommended default: 30 days.'
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              title={t({ it: 'Ricarica policy logs', en: 'Reload log policy' })}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!draft || !dirty || saving || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {t({ it: 'Salva policy', en: 'Save policy' })}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {KINDS.map((kind) => {
            const current = draft?.[kind];
            if (!current) return null;
            return (
              <div key={kind} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-ink">{labels[kind]}</div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={current.autoCleanup}
                      onChange={(event) => updateDraft(kind, { autoCleanup: event.target.checked })}
                    />
                    {t({ it: 'Autopulizia', en: 'Auto-cleanup' })}
                  </label>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{t({ it: 'Retention', en: 'Retention' })}</span>
                    <span className="font-semibold text-ink">{t({ it: `${current.days} gg`, en: `${current.days} d` })}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={90}
                    value={current.days}
                    onChange={(event) => updateDraft(kind, { days: Number(event.target.value) || 30 })}
                    className="mt-3 w-full accent-primary"
                    aria-label={`${labels[kind]} retention`}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{t({ it: '1 gg', en: '1 d' })}</span>
                    <span>{t({ it: '30 gg', en: '30 d' })}</span>
                    <span>{t({ it: '90 gg', en: '90 d' })}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {current.autoCleanup
                    ? t({
                        it: `I log ${labels[kind]} più vecchi di ${current.days} giorni saranno eliminati automaticamente.`,
                        en: `${labels[kind]} logs older than ${current.days} days will be removed automatically.`
                      })
                    : t({
                        it: `I log ${labels[kind]} manterranno la retention impostata ma senza eliminazione automatica.`,
                        en: `${labels[kind]} logs keep the selected retention window without automatic deletion.`
                      })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ModalShell
        open={!!confirmState}
        onClose={() => {
          if (saving || exporting) return;
          setConfirmState(null);
        }}
        title={t({ it: 'Conferma eliminazione log fuori retention', en: 'Confirm out-of-retention log cleanup' })}
        description={t({
          it: 'Hai impostato una retention che elimina log già esistenti. Puoi esportarli in CSV prima del purge.',
          en: 'You set a retention that will delete existing logs. You can export them to CSV before purge.'
        })}
        sizeClassName="max-w-2xl"
        initialFocusRef={confirmFocusRef as any}
      >
        <button ref={confirmFocusRef} type="button" className="sr-only" tabIndex={0}>
          focus
        </button>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">
                {t({ it: 'I log antecedenti alle date sotto indicate verranno eliminati.', en: 'Logs older than the dates below will be deleted.' })}
              </div>
              <div className="mt-1 text-xs">
                {t({
                  it: 'Se vuoi conservarli, esportali ora in CSV. Verrà generato un file per ogni tipologia coinvolta.',
                  en: 'If you want to preserve them, export them now to CSV. One file will be generated for each affected log type.'
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {confirmState
            ? KINDS.filter((kind) => {
                const row = confirmState.preview.byKind[kind];
                return row?.autoCleanup && row?.count > 0;
              }).map((kind) => {
                const row = confirmState.preview.byKind[kind];
                return (
                  <div key={kind} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <div className="font-semibold text-ink">{labels[kind]}</div>
                    <div className="mt-1 text-slate-700">
                      {t({
                        it: `Retention: ${row.days} giorni. I log antecedenti a ${formatDateTime(row.cutoffTs)} saranno eliminati.`,
                        en: `Retention: ${row.days} days. Logs older than ${formatDateTime(row.cutoffTs)} will be deleted.`
                      })}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t({ it: `Righe coinvolte: ${row.count}`, en: `Affected rows: ${row.count}` })}
                      {' · '}
                      {t({ it: `Più vecchio: ${formatDateTime(row.oldestTs)}`, en: `Oldest: ${formatDateTime(row.oldestTs)}` })}
                    </div>
                  </div>
                );
              })
            : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => setConfirmState(null)} className="btn-secondary" disabled={saving || exporting}>
            {t({ it: 'Annulla', en: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={() => confirmState && void persist(confirmState.settings, { purgeNow: true })}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            disabled={saving || exporting}
          >
            {saving ? t({ it: 'Salvataggio…', en: 'Saving…' }) : t({ it: 'Salva senza export', en: 'Save without export' })}
          </button>
          <button
            type="button"
            onClick={() => void handleExportAndSave()}
            className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:opacity-50"
            disabled={saving || exporting}
          >
            <Download size={16} />
            {exporting ? t({ it: 'Export + salvataggio…', en: 'Export + save…' }) : t({ it: 'Esporta CSV e salva', en: 'Export CSV and save' })}
          </button>
        </div>
      </ModalShell>
    </>
  );
};

export default LogsRetentionPanel;
