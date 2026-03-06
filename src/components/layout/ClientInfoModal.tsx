import { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CalendarRange, Clock3, Pencil, X } from 'lucide-react';
import { Client, type Site, type SiteScheduleDayKey } from '../../store/types';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  client?: Client | null;
  canManageSiteHours?: boolean;
  onOpenSiteHours?: (siteId: string) => void;
  onClose: () => void;
}

const DAY_KEYS: SiteScheduleDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const ClientInfoModal = ({ open, client, canManageSiteHours = false, onOpenSiteHours, onClose }: Props) => {
  const t = useT();
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

  const formatDaySummary = (site: Site, key: SiteScheduleDayKey) => {
    const row = site.siteSchedule?.weekly?.[key];
    if (!row || row.closed) return t({ it: 'Chiusa', en: 'Closed' });
    const slots = Array.isArray(row.slots) && row.slots.length
      ? row.slots
      : row.open || row.close
        ? [{ start: String(row.open || '').trim(), end: String(row.close || '').trim() }]
        : [];
    if (!slots.length) return t({ it: 'Chiusa', en: 'Closed' });
    return slots
      .map((slot) => `${String(slot.start || '').trim() || '00:00'} - ${String(slot.end || '').trim() || '00:00'}`)
      .join(' · ');
  };

  const summarizeSite = (site: Site) => {
    const activeDays = DAY_KEYS.filter((key) => {
      const row = site.siteSchedule?.weekly?.[key];
      if (!row || row.closed) return false;
      return (Array.isArray(row.slots) && row.slots.length) || row.open || row.close;
    });
    const holidays = Array.isArray(site.siteSchedule?.holidays) ? site.siteSchedule?.holidays || [] : [];
    return {
      activeDays,
      holidays,
      hasSchedule: activeDays.length > 0 || holidays.length > 0
    };
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
                          const summary = summarizeSite(site);
                          return (
                            <div key={site.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-ink">{site.name}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-cyan-700">
                                      <Clock3 size={12} />
                                      {summary.activeDays.length
                                        ? t({
                                            it: `${summary.activeDays.length} giorni attivi`,
                                            en: `${summary.activeDays.length} active days`
                                          })
                                        : t({ it: 'Nessun orario', en: 'No hours set' })}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                                      <CalendarRange size={12} />
                                      {summary.holidays.length
                                        ? t({
                                            it: `${summary.holidays.length} festivi`,
                                            en: `${summary.holidays.length} holidays`
                                          })
                                        : t({ it: 'Nessun festivo', en: 'No holidays' })}
                                    </span>
                                  </div>
                                </div>
                                {canManageSiteHours && onOpenSiteHours ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenSiteHours(site.id)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Pencil size={13} />
                                    {t({ it: 'Apri orari sede', en: 'Open site hours' })}
                                  </button>
                                ) : null}
                              </div>
                              {summary.hasSchedule ? (
                                <>
                                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                    {DAY_KEYS.map((key) => (
                                      <div key={`${site.id}-${key}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{dayLabels[key]}</div>
                                        <div className="mt-1 text-sm font-medium text-slate-800">{formatDaySummary(site, key)}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                      {t({ it: 'Festivi configurati', en: 'Configured holidays' })}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {summary.holidays.length ? (
                                        summary.holidays.map((holiday, index) => (
                                          <span
                                            key={`${site.id}-holiday-${holiday.date}-${index}`}
                                            className="inline-flex items-center rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-900"
                                          >
                                            {holiday.date}
                                            {holiday.label ? ` · ${holiday.label}` : ''}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-sm text-slate-500">{t({ it: 'Nessun festivo configurato', en: 'No holiday configured' })}</span>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                  {t({
                                    it: 'Nessun orario impostato per questa sede. Usa il menu contestuale con tasto destro per configurarlo.',
                                    en: 'No hours set for this site yet. Use the right-click context menu to configure them.'
                                  })}
                                </div>
                              )}
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
