import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Save, X } from 'lucide-react';
import { Client } from '../../store/types';
import { useT } from '../../i18n/useT';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';

interface Props {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
}

const ClientInfoModal = ({ open, client, onClose }: Props) => {
  const t = useT();
  const updateSite = useDataStore((s) => s.updateSite);
  const push = useToastStore((s) => s.push);
  const [siteSchedules, setSiteSchedules] = useState<
    Record<string, { weekly: Record<string, { closed: boolean; open: string; close: string }>; holidaysText: string }>
  >({});
  const dayLabels = useMemo(
    () => ({
      mon: t({ it: 'Lunedì', en: 'Monday' }),
      tue: t({ it: 'Martedì', en: 'Tuesday' }),
      wed: t({ it: 'Mercoledì', en: 'Wednesday' }),
      thu: t({ it: 'Giovedì', en: 'Thursday' }),
      fri: t({ it: 'Venerdì', en: 'Friday' }),
      sat: t({ it: 'Sabato', en: 'Saturday' }),
      sun: t({ it: 'Domenica', en: 'Sunday' })
    }),
    [t]
  );
  useEffect(() => {
    if (!open || !client) return;
    const defaults = {
      mon: { closed: false, open: '09:00', close: '18:00' },
      tue: { closed: false, open: '09:00', close: '18:00' },
      wed: { closed: false, open: '09:00', close: '18:00' },
      thu: { closed: false, open: '09:00', close: '18:00' },
      fri: { closed: false, open: '09:00', close: '18:00' },
      sat: { closed: true, open: '09:00', close: '13:00' },
      sun: { closed: true, open: '09:00', close: '13:00' }
    } as Record<string, { closed: boolean; open: string; close: string }>;
    const next: Record<string, { weekly: Record<string, { closed: boolean; open: string; close: string }>; holidaysText: string }> = {};
    for (const site of client.sites || []) {
      const weekly = { ...defaults };
      for (const key of Object.keys(defaults)) {
        const src = (site as any)?.siteSchedule?.weekly?.[key];
        weekly[key] = {
          closed: !!src?.closed,
          open: String(src?.open || weekly[key].open || ''),
          close: String(src?.close || weekly[key].close || '')
        };
      }
      const holidaysText = Array.isArray((site as any)?.siteSchedule?.holidays)
        ? ((site as any).siteSchedule.holidays as Array<{ date: string; label?: string }>)
            .map((h) => `${String(h?.date || '')}${h?.label ? `|${String(h.label)}` : ''}`)
            .filter(Boolean)
            .join('\n')
        : '';
      next[site.id] = { weekly, holidaysText };
    }
    setSiteSchedules(next);
  }, [client, open]);

  const saveSiteSchedule = (siteId: string) => {
    const row = siteSchedules[siteId];
    if (!row) return;
    const holidays = row.holidaysText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [datePart, ...rest] = line.split('|');
        const date = String(datePart || '').trim();
        const label = rest.join('|').trim();
        if (!date) return null;
        return { date, ...(label ? { label } : {}) };
      })
      .filter(Boolean);
    updateSite(siteId, { siteSchedule: { weekly: row.weekly as any, ...(holidays.length ? { holidays } : {}) } } as any);
    push(t({ it: 'Orari sede salvati', en: 'Site hours saved' }), 'success');
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xl modal-panel">
                <div className="modal-header items-center">
                  <div className="min-w-0">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Info cliente', en: 'Client info' })}
                    </Dialog.Title>
                    <div className="modal-description truncate">{client?.shortName || client?.name || ''}</div>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Nome (breve)', en: 'Short name' })}</div>
                    <div className="mt-1 text-sm font-semibold text-ink">{client?.shortName || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Ragione sociale', en: 'Legal name' })}</div>
                    <div className="mt-1 text-sm font-semibold text-ink">{client?.name || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Indirizzo', en: 'Address' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.address || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Telefono', en: 'Phone' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.phone || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Email', en: 'Email' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.email || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'PEC', en: 'PEC' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.pecEmail || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Partita IVA', en: 'VAT ID' })}</div>
                    <div className="mt-1 text-sm text-ink">{client?.vatId || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Descrizione', en: 'Description' })}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-ink">{client?.description || '—'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Orari sedi / Festivi', en: 'Site hours / Holidays' })}</div>
                    <div className="mt-2 space-y-3">
                      {(client?.sites || []).length ? (
                        (client?.sites || []).map((site) => {
                          const entry = siteSchedules[site.id];
                          return (
                            <div key={site.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-ink">{site.name}</div>
                                <button
                                  type="button"
                                  onClick={() => saveSiteSchedule(site.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <Save size={12} />
                                  {t({ it: 'Salva', en: 'Save' })}
                                </button>
                              </div>
                              {entry ? (
                                <>
                                  <div className="mt-2 grid gap-1 md:grid-cols-2">
                                    {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((key) => (
                                      <div key={`${site.id}-${key}`} className="grid items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-[110px,auto,1fr,1fr]">
                                        <div className="text-xs font-semibold text-slate-700">{(dayLabels as any)[key]}</div>
                                        <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                                          <input
                                            type="checkbox"
                                            checked={entry.weekly[key].closed}
                                            onChange={(e) =>
                                              setSiteSchedules((prev) => ({
                                                ...prev,
                                                [site.id]: {
                                                  ...prev[site.id],
                                                  weekly: { ...prev[site.id].weekly, [key]: { ...prev[site.id].weekly[key], closed: e.target.checked } }
                                                }
                                              }))
                                            }
                                          />
                                          {t({ it: 'Chiuso', en: 'Closed' })}
                                        </label>
                                        <input
                                          type="time"
                                          step={60}
                                          disabled={entry.weekly[key].closed}
                                          value={entry.weekly[key].open}
                                          onChange={(e) =>
                                            setSiteSchedules((prev) => ({
                                              ...prev,
                                              [site.id]: {
                                                ...prev[site.id],
                                                weekly: { ...prev[site.id].weekly, [key]: { ...prev[site.id].weekly[key], open: e.target.value } }
                                              }
                                            }))
                                          }
                                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:bg-slate-100"
                                        />
                                        <input
                                          type="time"
                                          step={60}
                                          disabled={entry.weekly[key].closed}
                                          value={entry.weekly[key].close}
                                          onChange={(e) =>
                                            setSiteSchedules((prev) => ({
                                              ...prev,
                                              [site.id]: {
                                                ...prev[site.id],
                                                weekly: { ...prev[site.id].weekly, [key]: { ...prev[site.id].weekly[key], close: e.target.value } }
                                              }
                                            }))
                                          }
                                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:bg-slate-100"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <label className="mt-2 block text-xs font-medium text-slate-600">
                                    {t({ it: 'Festivi (una riga: YYYY-MM-DD|descrizione)', en: 'Holidays (one row: YYYY-MM-DD|description)' })}
                                    <textarea
                                      rows={3}
                                      value={entry.holidaysText}
                                      onChange={(e) =>
                                        setSiteSchedules((prev) => ({
                                          ...prev,
                                          [site.id]: { ...prev[site.id], holidaysText: e.target.value }
                                        }))
                                      }
                                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                    />
                                  </label>
                                </>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-sm text-slate-600">—</div>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ClientInfoModal;
