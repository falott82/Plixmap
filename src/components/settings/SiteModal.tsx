import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { MapPinned, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  initialName?: string;
  initialCoords?: string;
  initialSupportContacts?: {
    cleaning?: { email?: string; phone?: string };
    it?: { email?: string; phone?: string };
    coffee?: { email?: string; phone?: string };
  };
  initialSiteSchedule?: {
    weekly?: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { closed?: boolean; open?: string; close?: string }>>;
    holidays?: Array<{ date: string; label?: string; closed?: boolean }>;
  };
  title: string;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    coords?: string;
    supportContacts?: {
      cleaning?: { email?: string; phone?: string };
      it?: { email?: string; phone?: string };
      coffee?: { email?: string; phone?: string };
    };
    siteSchedule?: {
      weekly?: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { closed?: boolean; open?: string; close?: string }>>;
      holidays?: Array<{ date: string; label?: string; closed?: boolean }>;
    };
  }) => void;
}

const parseCoords = (value: string): { lat: number; lng: number } | null => {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_KEYS)[number];

const SiteModal = ({ open, initialName = '', initialCoords = '', initialSupportContacts, initialSiteSchedule, title, onClose, onSubmit }: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [coords, setCoords] = useState(initialCoords);
  const [cleaningEmail, setCleaningEmail] = useState('');
  const [cleaningPhone, setCleaningPhone] = useState('');
  const [itEmail, setItEmail] = useState('');
  const [itPhone, setItPhone] = useState('');
  const [coffeeEmail, setCoffeeEmail] = useState('');
  const [coffeePhone, setCoffeePhone] = useState('');
  const [weeklyHours, setWeeklyHours] = useState<Record<DayKey, { closed: boolean; open: string; close: string }>>({
    mon: { closed: false, open: '09:00', close: '18:00' },
    tue: { closed: false, open: '09:00', close: '18:00' },
    wed: { closed: false, open: '09:00', close: '18:00' },
    thu: { closed: false, open: '09:00', close: '18:00' },
    fri: { closed: false, open: '09:00', close: '18:00' },
    sat: { closed: true, open: '09:00', close: '13:00' },
    sun: { closed: true, open: '09:00', close: '13:00' }
  });
  const [holidaysText, setHolidaysText] = useState('');
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCoords(initialCoords);
    setCleaningEmail(String(initialSupportContacts?.cleaning?.email || ''));
    setCleaningPhone(String(initialSupportContacts?.cleaning?.phone || ''));
    setItEmail(String(initialSupportContacts?.it?.email || ''));
    setItPhone(String(initialSupportContacts?.it?.phone || ''));
    setCoffeeEmail(String(initialSupportContacts?.coffee?.email || ''));
    setCoffeePhone(String(initialSupportContacts?.coffee?.phone || ''));
    const nextWeekly = { ...weeklyHours };
    for (const key of DAY_KEYS) {
      const row = (initialSiteSchedule?.weekly as any)?.[key];
      nextWeekly[key] = {
        closed: !!row?.closed,
        open: String(row?.open || nextWeekly[key].open || ''),
        close: String(row?.close || nextWeekly[key].close || '')
      };
    }
    setWeeklyHours(nextWeekly);
    setHolidaysText(
      Array.isArray(initialSiteSchedule?.holidays)
        ? initialSiteSchedule!.holidays!
            .map((h) => `${String(h.date || '')}${h?.label ? `|${String(h.label)}` : ''}`)
            .filter(Boolean)
            .join('\n')
        : ''
    );
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initialCoords, initialName, initialSupportContacts, initialSiteSchedule, open]);

  const canSubmit = useMemo(() => !!name.trim(), [name]);
  const parsed = useMemo(() => parseCoords(coords), [coords]);

  const submit = () => {
    if (!canSubmit) return;
    const supportContacts = {
      ...(cleaningEmail.trim() || cleaningPhone.trim()
        ? { cleaning: { ...(cleaningEmail.trim() ? { email: cleaningEmail.trim() } : {}), ...(cleaningPhone.trim() ? { phone: cleaningPhone.trim() } : {}) } }
        : {}),
      ...(itEmail.trim() || itPhone.trim()
        ? { it: { ...(itEmail.trim() ? { email: itEmail.trim() } : {}), ...(itPhone.trim() ? { phone: itPhone.trim() } : {}) } }
        : {}),
      ...(coffeeEmail.trim() || coffeePhone.trim()
        ? { coffee: { ...(coffeeEmail.trim() ? { email: coffeeEmail.trim() } : {}), ...(coffeePhone.trim() ? { phone: coffeePhone.trim() } : {}) } }
        : {})
    };
    const weekly = Object.fromEntries(
      DAY_KEYS.map((key) => [
        key,
        weeklyHours[key].closed
          ? { closed: true }
          : {
              open: String(weeklyHours[key].open || '').trim() || '09:00',
              close: String(weeklyHours[key].close || '').trim() || '18:00'
            }
      ])
    );
    const holidays = holidaysText
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
      .filter(Boolean) as Array<{ date: string; label?: string }>;
    onSubmit({
      name: name.trim(),
      coords: coords.trim() || undefined,
      supportContacts: Object.keys(supportContacts).length ? supportContacts : undefined,
      siteSchedule: { weekly: weekly as any, ...(holidays.length ? { holidays } : {}) }
    });
    onClose();
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
              <Dialog.Panel className="w-full max-w-2xl modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">{title}</Dialog.Title>
                  <button
                    onClick={onClose}
                    className="icon-button"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome sede', en: 'Site name' })} <span className="text-rose-600">*</span>
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. HQ Via Nave 11', en: 'e.g. HQ Wall Street 01' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        }
                      }}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Coordinate (Google)', en: 'Coordinates (Google)' })}
                    <div className="text-xs font-normal text-slate-500">
                      {t({
                        it: 'Facoltativo. Formato: “lat, lng” (es. 43.697000, 11.809931).',
                        en: 'Optional. Format: “lat, lng” (e.g. 43.697000, 11.809931).'
                      })}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        value={coords}
                        onChange={(e) => setCoords(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="43.697000, 11.809931"
                      />
                      {parsed ? (
                        <a
                          href={`https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Apri su Google Maps', en: 'Open in Google Maps' })}
                        >
                          <MapPinned size={18} className="text-emerald-700" />
                        </a>
                      ) : null}
                    </div>
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-semibold text-slate-700">{t({ it: 'Contatti utili', en: 'Useful contacts' })}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t({
                        it: 'Usati nel Kiosk mode per richieste rapide di assistenza.',
                        en: 'Used in Kiosk mode for quick assistance requests.'
                      })}
                    </div>
                    {[
                      { key: 'cleaning', labelIt: 'Cleaning service', labelEn: 'Cleaning service', email: cleaningEmail, setEmail: setCleaningEmail, phone: cleaningPhone, setPhone: setCleaningPhone },
                      { key: 'it', labelIt: 'IT Service', labelEn: 'IT Service', email: itEmail, setEmail: setItEmail, phone: itPhone, setPhone: setItPhone },
                      { key: 'coffee', labelIt: 'Coffee service', labelEn: 'Coffee service', email: coffeeEmail, setEmail: setCoffeeEmail, phone: coffeePhone, setPhone: setCoffeePhone }
                    ].map((row) => (
                      <div key={row.key} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {t({ it: row.labelIt, en: row.labelEn })}
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <label className="block text-xs font-medium text-slate-600">
                            Email
                            <input
                              value={row.email}
                              onChange={(e) => row.setEmail(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder="team@example.com"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-600">
                            {t({ it: 'Telefono', en: 'Phone' })}
                            <input
                              value={row.phone}
                              onChange={(e) => row.setPhone(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder="+39 ..."
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-semibold text-slate-700">{t({ it: 'Orari sede', en: 'Site opening hours' })}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t({
                        it: 'Configura gli orari per giorno. Giorni festivi: una riga per data (YYYY-MM-DD|descrizione facoltativa).',
                        en: 'Set hours by day. Holidays: one row per date (YYYY-MM-DD|optional description).'
                      })}
                    </div>
                    <div className="mt-3 space-y-2">
                      {DAY_KEYS.map((key) => {
                        const row = weeklyHours[key];
                        const labels: Record<DayKey, { it: string; en: string }> = {
                          mon: { it: 'Lunedì', en: 'Monday' },
                          tue: { it: 'Martedì', en: 'Tuesday' },
                          wed: { it: 'Mercoledì', en: 'Wednesday' },
                          thu: { it: 'Giovedì', en: 'Thursday' },
                          fri: { it: 'Venerdì', en: 'Friday' },
                          sat: { it: 'Sabato', en: 'Saturday' },
                          sun: { it: 'Domenica', en: 'Sunday' }
                        };
                        return (
                          <div key={key} className="grid items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-[140px,auto,1fr,1fr]">
                            <div className="text-xs font-semibold text-slate-700">{t(labels[key])}</div>
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                              <input
                                type="checkbox"
                                checked={row.closed}
                                onChange={(e) => setWeeklyHours((prev) => ({ ...prev, [key]: { ...prev[key], closed: e.target.checked } }))}
                              />
                              {t({ it: 'Chiuso', en: 'Closed' })}
                            </label>
                            <input
                              type="time"
                              step={60}
                              disabled={row.closed}
                              value={row.open}
                              onChange={(e) => setWeeklyHours((prev) => ({ ...prev, [key]: { ...prev[key], open: e.target.value } }))}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100"
                            />
                            <input
                              type="time"
                              step={60}
                              disabled={row.closed}
                              value={row.close}
                              onChange={(e) => setWeeklyHours((prev) => ({ ...prev, [key]: { ...prev[key], close: e.target.value } }))}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-600">
                        {t({ it: 'Giorni festivi / chiusure', en: 'Holidays / closures' })}
                        <textarea
                          rows={4}
                          value={holidaysText}
                          onChange={(e) => setHolidaysText(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          placeholder="2026-12-25|Natale&#10;2026-08-15|Ferragosto"
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    onClick={onClose}
                    className="btn-secondary"
                    title={t({ it: 'Chiudi senza salvare le modifiche', en: 'Close without saving changes' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    disabled={!canSubmit}
                    className="btn-primary disabled:opacity-60"
                    title={t({ it: 'Salva la sede', en: 'Save the site' })}
                  >
                    {t({ it: 'Salva', en: 'Save' })}
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

export default SiteModal;
