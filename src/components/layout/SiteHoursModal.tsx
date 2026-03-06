import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { CalendarRange, Clock3, CopyPlus, Landmark, Minus, Plus } from 'lucide-react';
import type { Site, SiteHoliday, SiteHolidayCalendar, SiteSchedule, SiteScheduleDayKey } from '../../store/types';
import { useT } from '../../i18n/useT';
import ModalShell from '../ui/ModalShell';

type Props = {
  open: boolean;
  clientName: string;
  siteName: string;
  currentSiteId: string;
  siblingSites: Array<{ id: string; name: string }>;
  initialSchedule?: Site['siteSchedule'];
  canApplyToOtherSites: boolean;
  onClose: () => void;
  onSave: (payload: { siteSchedule?: SiteSchedule; applyToSiteIds: string[] }) => void;
};

type EditorSlot = {
  id: string;
  start: string;
  end: string;
};

type EditorDay = {
  enabled: boolean;
  slots: EditorSlot[];
};

type EditorHoliday = {
  id: string;
  date: string;
  label: string;
  source: 'custom' | 'national';
};

type CalendarPresetOption = {
  value: SiteHolidayCalendar;
  label: string;
};

const DAY_KEYS: SiteScheduleDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAULT_WEEK_SLOT = { start: '09:00', end: '18:00' };
const DEFAULT_SAT_SLOT = { start: '09:00', end: '13:00' };

const makeId = () => Math.random().toString(36).slice(2, 10);

const makeSlot = (start = DEFAULT_WEEK_SLOT.start, end = DEFAULT_WEEK_SLOT.end): EditorSlot => ({
  id: makeId(),
  start,
  end
});

const defaultWeeklyEditorState = (): Record<SiteScheduleDayKey, EditorDay> => ({
  mon: { enabled: true, slots: [makeSlot()] },
  tue: { enabled: true, slots: [makeSlot()] },
  wed: { enabled: true, slots: [makeSlot()] },
  thu: { enabled: true, slots: [makeSlot()] },
  fri: { enabled: true, slots: [makeSlot()] },
  sat: { enabled: false, slots: [makeSlot(DEFAULT_SAT_SLOT.start, DEFAULT_SAT_SLOT.end)] },
  sun: { enabled: false, slots: [makeSlot(DEFAULT_SAT_SLOT.start, DEFAULT_SAT_SLOT.end)] }
});

const easterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const formatIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const shiftDate = (date: Date, deltaDays: number) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + deltaDays);
  return next;
};

const nthWeekdayOfMonth = (year: number, monthIndex: number, weekday: number, nth: number) => {
  const first = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const delta = (weekday - first.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + delta + (nth - 1) * 7, 0, 0, 0, 0);
};

const lastWeekdayOfMonth = (year: number, monthIndex: number, weekday: number) => {
  const last = new Date(year, monthIndex + 1, 0, 0, 0, 0, 0);
  const delta = (last.getDay() - weekday + 7) % 7;
  return new Date(year, monthIndex + 1, 0 - delta, 0, 0, 0, 0);
};

const observedFixedHoliday = (year: number, monthIndex: number, day: number, label: string): SiteHoliday[] => {
  const actual = new Date(year, monthIndex, day, 0, 0, 0, 0);
  const items: SiteHoliday[] = [{ date: formatIsoDate(actual), label, source: 'national' }];
  if (actual.getDay() === 6) {
    items.push({ date: formatIsoDate(shiftDate(actual, -1)), label: `${label} (observed)`, source: 'national' });
  } else if (actual.getDay() === 0) {
    items.push({ date: formatIsoDate(shiftDate(actual, 1)), label: `${label} (observed)`, source: 'national' });
  }
  return items;
};

const substituteMondayHoliday = (date: Date, label: string): SiteHoliday[] => {
  const items: SiteHoliday[] = [{ date: formatIsoDate(date), label, source: 'national' }];
  if (date.getDay() === 6) items.push({ date: formatIsoDate(shiftDate(date, 2)), label: `${label} (substitute)`, source: 'national' });
  if (date.getDay() === 0) items.push({ date: formatIsoDate(shiftDate(date, 1)), label: `${label} (substitute)`, source: 'national' });
  return items;
};

const uniqueHolidayRows = (rows: SiteHoliday[]) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${String(row.date || '').trim()}|${String(row.label || '').trim()}`;
    if (!row.date || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const qingmingDate = (year: number) => {
  const day = year <= 1999
    ? Math.floor((year % 100) * 0.2422 + 5.59) - Math.floor((year % 100) / 4)
    : Math.floor((year % 100) * 0.2422 + 4.81) - Math.floor((year % 100) / 4);
  return `${year}-04-${String(day).padStart(2, '0')}`;
};

const italianNationalHolidaysForYear = (year: number): SiteHoliday[] => {
  const easter = easterSunday(year);
  const easterMonday = new Date(easter.getTime());
  easterMonday.setDate(easterMonday.getDate() + 1);
  return [
    { date: `${year}-01-01`, label: 'Capodanno', source: 'national' },
    { date: `${year}-01-06`, label: 'Epifania', source: 'national' },
    { date: formatIsoDate(easter), label: 'Pasqua', source: 'national' },
    { date: formatIsoDate(easterMonday), label: "Lunedi dell'Angelo", source: 'national' },
    { date: `${year}-04-25`, label: 'Festa della Liberazione', source: 'national' },
    { date: `${year}-05-01`, label: 'Festa del Lavoro', source: 'national' },
    { date: `${year}-06-02`, label: 'Festa della Repubblica', source: 'national' },
    { date: `${year}-08-15`, label: 'Ferragosto', source: 'national' },
    { date: `${year}-11-01`, label: 'Ognissanti', source: 'national' },
    { date: `${year}-12-08`, label: 'Immacolata Concezione', source: 'national' },
    { date: `${year}-12-25`, label: 'Natale', source: 'national' },
    { date: `${year}-12-26`, label: 'Santo Stefano', source: 'national' }
  ];
};

const frenchNationalHolidaysForYear = (year: number): SiteHoliday[] => {
  const easter = easterSunday(year);
  return [
    { date: `${year}-01-01`, label: "Jour de l'An", source: 'national' },
    { date: formatIsoDate(shiftDate(easter, 1)), label: 'Lundi de Paques', source: 'national' },
    { date: `${year}-05-01`, label: 'Fete du Travail', source: 'national' },
    { date: `${year}-05-08`, label: 'Victoire 1945', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, 39)), label: 'Ascension', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, 50)), label: 'Lundi de Pentecote', source: 'national' },
    { date: `${year}-07-14`, label: 'Fete nationale', source: 'national' },
    { date: `${year}-08-15`, label: 'Assomption', source: 'national' },
    { date: `${year}-11-01`, label: 'Toussaint', source: 'national' },
    { date: `${year}-11-11`, label: 'Armistice', source: 'national' },
    { date: `${year}-12-25`, label: 'Noel', source: 'national' }
  ];
};

const germanNationalHolidaysForYear = (year: number): SiteHoliday[] => {
  const easter = easterSunday(year);
  return [
    { date: `${year}-01-01`, label: 'Neujahr', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, -2)), label: 'Karfreitag', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, 1)), label: 'Ostermontag', source: 'national' },
    { date: `${year}-05-01`, label: 'Tag der Arbeit', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, 39)), label: 'Christi Himmelfahrt', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, 50)), label: 'Pfingstmontag', source: 'national' },
    { date: `${year}-10-03`, label: 'Tag der Deutschen Einheit', source: 'national' },
    { date: `${year}-12-25`, label: 'Erster Weihnachtstag', source: 'national' },
    { date: `${year}-12-26`, label: 'Zweiter Weihnachtstag', source: 'national' }
  ];
};

const spanishNationalHolidaysForYear = (year: number): SiteHoliday[] => {
  const easter = easterSunday(year);
  return [
    { date: `${year}-01-01`, label: 'Ano Nuevo', source: 'national' },
    { date: `${year}-01-06`, label: 'Epifania del Senor', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, -2)), label: 'Viernes Santo', source: 'national' },
    { date: `${year}-05-01`, label: 'Fiesta del Trabajo', source: 'national' },
    { date: `${year}-08-15`, label: 'Asuncion de la Virgen', source: 'national' },
    { date: `${year}-10-12`, label: 'Fiesta Nacional de Espana', source: 'national' },
    { date: `${year}-11-01`, label: 'Todos los Santos', source: 'national' },
    { date: `${year}-12-06`, label: 'Dia de la Constitucion', source: 'national' },
    { date: `${year}-12-08`, label: 'Inmaculada Concepcion', source: 'national' },
    { date: `${year}-12-25`, label: 'Navidad', source: 'national' }
  ];
};

const chinaNationalHolidaysForYear = (year: number): SiteHoliday[] =>
  uniqueHolidayRows([
    { date: `${year}-01-01`, label: "New Year's Day", source: 'national' },
    { date: qingmingDate(year), label: 'Qingming Festival', source: 'national' },
    { date: `${year}-05-01`, label: 'Labour Day', source: 'national' },
    { date: `${year}-10-01`, label: 'National Day', source: 'national' },
    { date: `${year}-10-02`, label: 'National Day Holiday', source: 'national' },
    { date: `${year}-10-03`, label: 'National Day Holiday', source: 'national' }
  ]);

const saudiNationalHolidaysForYear = (year: number): SiteHoliday[] =>
  uniqueHolidayRows([
    { date: `${year}-02-22`, label: 'Founding Day', source: 'national' },
    { date: `${year}-09-23`, label: 'National Day', source: 'national' }
  ]);

const uaeNationalHolidaysForYear = (year: number): SiteHoliday[] =>
  uniqueHolidayRows([
    { date: `${year}-01-01`, label: "New Year's Day", source: 'national' },
    { date: `${year}-12-02`, label: 'National Day', source: 'national' },
    { date: `${year}-12-03`, label: 'National Day Holiday', source: 'national' }
  ]);

const usFederalHolidaysForYear = (year: number): SiteHoliday[] =>
  uniqueHolidayRows([
    ...observedFixedHoliday(year, 0, 1, "New Year's Day"),
    { date: formatIsoDate(nthWeekdayOfMonth(year, 0, 1, 3)), label: 'Martin Luther King Jr. Day', source: 'national' },
    { date: formatIsoDate(nthWeekdayOfMonth(year, 1, 1, 3)), label: "Washington's Birthday", source: 'national' },
    { date: formatIsoDate(lastWeekdayOfMonth(year, 4, 1)), label: 'Memorial Day', source: 'national' },
    ...observedFixedHoliday(year, 5, 19, 'Juneteenth National Independence Day'),
    ...observedFixedHoliday(year, 6, 4, 'Independence Day'),
    { date: formatIsoDate(nthWeekdayOfMonth(year, 8, 1, 1)), label: 'Labor Day', source: 'national' },
    { date: formatIsoDate(nthWeekdayOfMonth(year, 9, 1, 2)), label: 'Columbus Day', source: 'national' },
    ...observedFixedHoliday(year, 10, 11, 'Veterans Day'),
    { date: formatIsoDate(nthWeekdayOfMonth(year, 10, 4, 4)), label: 'Thanksgiving Day', source: 'national' },
    ...observedFixedHoliday(year, 11, 25, 'Christmas Day')
  ]);

const ukBankHolidaysForYear = (year: number): SiteHoliday[] => {
  const easter = easterSunday(year);
  const christmas = new Date(year, 11, 25, 0, 0, 0, 0);
  const boxingDay = new Date(year, 11, 26, 0, 0, 0, 0);
  return uniqueHolidayRows([
    ...substituteMondayHoliday(new Date(year, 0, 1, 0, 0, 0, 0), "New Year's Day"),
    { date: formatIsoDate(shiftDate(easter, -2)), label: 'Good Friday', source: 'national' },
    { date: formatIsoDate(shiftDate(easter, 1)), label: 'Easter Monday', source: 'national' },
    { date: formatIsoDate(nthWeekdayOfMonth(year, 4, 1, 1)), label: 'Early May bank holiday', source: 'national' },
    { date: formatIsoDate(lastWeekdayOfMonth(year, 4, 1)), label: 'Spring bank holiday', source: 'national' },
    { date: formatIsoDate(lastWeekdayOfMonth(year, 7, 1)), label: 'Summer bank holiday', source: 'national' },
    ...substituteMondayHoliday(christmas, 'Christmas Day'),
    ...substituteMondayHoliday(boxingDay, 'Boxing Day')
  ]);
};

const nationalHolidaysForCalendar = (calendar: SiteHolidayCalendar, year: number): SiteHoliday[] => {
  switch (calendar) {
    case 'it':
      return italianNationalHolidaysForYear(year);
    case 'us':
      return usFederalHolidaysForYear(year);
    case 'uk':
      return ukBankHolidaysForYear(year);
    case 'de':
      return germanNationalHolidaysForYear(year);
    case 'fr':
      return frenchNationalHolidaysForYear(year);
    case 'es':
      return spanishNationalHolidaysForYear(year);
    case 'cn':
      return chinaNationalHolidaysForYear(year);
    case 'sa':
      return saudiNationalHolidaysForYear(year);
    case 'ae':
      return uaeNationalHolidaysForYear(year);
    default:
      return [];
  }
};

const scheduleToEditor = (schedule?: Site['siteSchedule']) => {
  const weekly = defaultWeeklyEditorState();
  for (const key of DAY_KEYS) {
    const raw = schedule?.weekly?.[key];
    if (!raw) continue;
    const slots = Array.isArray(raw.slots) && raw.slots.length
      ? raw.slots
          .map((slot) => {
            const start = String(slot?.start || '').trim();
            const end = String(slot?.end || '').trim();
            if (!start || !end) return null;
            return { id: makeId(), start, end };
          })
          .filter(Boolean) as EditorSlot[]
      : raw.open || raw.close
        ? [
            makeSlot(
              String(raw.open || DEFAULT_WEEK_SLOT.start).trim() || DEFAULT_WEEK_SLOT.start,
              String(raw.close || DEFAULT_WEEK_SLOT.end).trim() || DEFAULT_WEEK_SLOT.end
            )
          ]
        : [];
    const enabled = !raw.closed && slots.length > 0;
    weekly[key] = {
      enabled,
      slots: slots.length ? slots : weekly[key].slots
    };
  }
  const holidays: EditorHoliday[] = Array.isArray(schedule?.holidays)
    ? schedule!.holidays!
        .map((entry) => {
          const date = String(entry?.date || '').trim();
          if (!date) return null;
          return {
            id: makeId(),
            date,
            label: String(entry?.label || '').trim(),
            source: entry?.source === 'national' ? 'national' : 'custom'
          };
        })
        .filter(Boolean) as EditorHoliday[]
    : [];
  return {
    weekly,
    holidays,
    holidayCalendar: schedule?.holidayCalendar || 'it'
  };
};

const editorToSchedule = (
  weekly: Record<SiteScheduleDayKey, EditorDay>,
  holidays: EditorHoliday[],
  holidayCalendar: SiteHolidayCalendar
): SiteSchedule | undefined => {
  const nextWeekly: Partial<Record<SiteScheduleDayKey, NonNullable<SiteSchedule['weekly']>[SiteScheduleDayKey]>> = {};
  for (const key of DAY_KEYS) {
    const row = weekly[key];
    if (!row?.enabled) {
      nextWeekly[key] = { closed: true };
      continue;
    }
    const slots = (row.slots || [])
      .map((slot) => ({
        start: String(slot.start || '').trim(),
        end: String(slot.end || '').trim()
      }))
      .filter((slot) => slot.start && slot.end);
    if (!slots.length) {
      nextWeekly[key] = { closed: true };
      continue;
    }
    nextWeekly[key] = {
      open: slots[0]?.start,
      close: slots[slots.length - 1]?.end,
      slots
    };
  }
  const nextHolidays = holidays
    .map((entry) => {
      const date = String(entry.date || '').trim();
      const label = String(entry.label || '').trim();
      if (!date) return null;
      return {
        date,
        ...(label ? { label } : {}),
        closed: true,
        source: entry.source
      };
    })
    .filter(Boolean) as SiteHoliday[];
  if (!Object.keys(nextWeekly).length && !nextHolidays.length) return undefined;
  return {
    ...(holidayCalendar ? { holidayCalendar } : {}),
    ...(Object.keys(nextWeekly).length ? { weekly: nextWeekly as SiteSchedule['weekly'] } : {}),
    ...(nextHolidays.length ? { holidays: nextHolidays } : {})
  };
};

const sortHolidays = (rows: EditorHoliday[]) =>
  rows
    .slice()
    .sort((a, b) => {
      const byDate = String(a.date || '').localeCompare(String(b.date || ''));
      if (byDate !== 0) return byDate;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });

type HolidaysEditorModalProps = {
  open: boolean;
  holidayCalendar: SiteHolidayCalendar;
  setHolidayCalendar: (value: SiteHolidayCalendar) => void;
  presetYear: string;
  setPresetYear: (value: string) => void;
  calendarOptions: CalendarPresetOption[];
  selectedCalendarLabel: string;
  holidayCalendarNotice: string;
  holidays: EditorHoliday[];
  setHolidays: Dispatch<SetStateAction<EditorHoliday[]>>;
  addNationalPreset: () => void;
  addCustomHoliday: () => void;
  onClose: () => void;
};

const HolidaysEditorModal = ({
  open,
  holidayCalendar,
  setHolidayCalendar,
  presetYear,
  setPresetYear,
  calendarOptions,
  selectedCalendarLabel,
  holidayCalendarNotice,
  holidays,
  setHolidays,
  addNationalPreset,
  addCustomHoliday,
  onClose
}: HolidaysEditorModalProps) => {
  const t = useT();

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t({ it: 'Festivi e chiusure aziendali', en: 'Holidays and business closures' })}
      description={t({
        it: 'Gestisci calendario nazionale, chiusure custom e nome delle festivita.',
        en: 'Manage national calendar, custom closures, and holiday names.'
      })}
      sizeClassName="max-w-[min(94vw,1180px)]"
      rootClassName="z-[70]"
      backdropClassName="bg-slate-950/12"
      footer={
        <button type="button" onClick={onClose} className="btn-primary">
          {t({ it: 'Chiudi', en: 'Close' })}
        </button>
      }
    >
      <div className="space-y-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarRange size={16} className="text-cyan-700" />
            <div className="text-sm font-semibold text-ink">{t({ it: 'Calendario festivi', en: 'Holiday calendar' })}</div>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {t({
              it: 'Scegli il calendario di riferimento e importa il relativo anno. I nomi delle festivita sono modificabili.',
              en: 'Choose the source calendar and import the relevant year. Holiday names remain editable.'
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Landmark size={14} className="text-amber-600" />
              {t({ it: 'Calendario', en: 'Calendar' })}
            </div>
            <select
              value={holidayCalendar}
              onChange={(event) => setHolidayCalendar(event.target.value as SiteHolidayCalendar)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-primary/20 focus:ring-2"
            >
              {calendarOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={2000}
              max={2100}
              value={presetYear}
              onChange={(event) => setPresetYear(event.target.value)}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
            />
            <button
              type="button"
              onClick={addNationalPreset}
              disabled={holidayCalendar === 'custom'}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} />
              {t({ it: 'Importa anno', en: 'Import year' })}
            </button>
          </div>

          <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            {holidayCalendar === 'custom'
              ? t({
                  it: 'Preset automatici disattivati. Puoi aggiungere solo chiusure manuali.',
                  en: 'Automatic presets are disabled. You can add manual closures only.'
                })
              : t({
                  it: `Verranno importati i festivi del calendario ${selectedCalendarLabel}.`,
                  en: `${selectedCalendarLabel} holidays will be imported.`
                })}
          </div>
          {holidayCalendarNotice ? (
            <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {holidayCalendarNotice}
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">{t({ it: 'Elenco festivita e chiusure', en: 'Holiday and closure list' })}</div>
              <div className="mt-1 text-xs text-slate-500">
                {t({
                  it: 'Per ogni giorno puoi indicare data, nome della festivita e origine.',
                  en: 'For each day you can define date, holiday name, and origin.'
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={addCustomHoliday}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <Plus size={14} />
              {t({ it: 'Aggiungi chiusura', en: 'Add closure' })}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {holidays.map((holiday) => (
              <div key={holiday.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="grid gap-2 lg:grid-cols-[160px_minmax(0,1fr)_auto_auto] lg:items-center">
                  <input
                    type="date"
                    value={holiday.date}
                    onChange={(event) =>
                      setHolidays((prev) =>
                        sortHolidays(prev.map((row) => (row.id === holiday.id ? { ...row, date: event.target.value } : row)))
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
                  />
                  <input
                    type="text"
                    value={holiday.label}
                    onChange={(event) =>
                      setHolidays((prev) => prev.map((row) => (row.id === holiday.id ? { ...row, label: event.target.value } : row)))
                    }
                    placeholder={t({ it: 'Nome festivita o chiusura', en: 'Holiday or closure name' })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
                  />
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      holiday.source === 'national' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {holiday.source === 'national' ? t({ it: 'Nazionale', en: 'National' }) : t({ it: 'Custom', en: 'Custom' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHolidays((prev) => prev.filter((row) => row.id !== holiday.id))}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-500"
                    title={t({ it: 'Rimuovi festivo', en: 'Remove holiday' })}
                  >
                    <Minus size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!holidays.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {t({ it: 'Nessun giorno festivo configurato.', en: 'No holiday configured yet.' })}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </ModalShell>
  );
};

const SiteHoursModal = ({ open, clientName, siteName, currentSiteId, siblingSites, initialSchedule, canApplyToOtherSites, onClose, onSave }: Props) => {
  const t = useT();
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const [weekly, setWeekly] = useState<Record<SiteScheduleDayKey, EditorDay>>(defaultWeeklyEditorState);
  const [holidays, setHolidays] = useState<EditorHoliday[]>([]);
  const [applyToSiteIds, setApplyToSiteIds] = useState<string[]>([]);
  const [presetYear, setPresetYear] = useState(String(new Date().getFullYear()));
  const [holidayCalendar, setHolidayCalendar] = useState<SiteHolidayCalendar>('it');
  const [holidaysModalOpen, setHolidaysModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = scheduleToEditor(initialSchedule);
    setWeekly(next.weekly);
    setHolidays(sortHolidays(next.holidays));
    setHolidayCalendar(next.holidayCalendar);
    setApplyToSiteIds([]);
    setPresetYear(String(new Date().getFullYear()));
    setHolidaysModalOpen(false);
  }, [initialSchedule, open]);

  const dayLabels = useMemo(
    () => ({
      mon: t({ it: 'Lunedi', en: 'Monday' }),
      tue: t({ it: 'Martedi', en: 'Tuesday' }),
      wed: t({ it: 'Mercoledi', en: 'Wednesday' }),
      thu: t({ it: 'Giovedi', en: 'Thursday' }),
      fri: t({ it: 'Venerdi', en: 'Friday' }),
      sat: t({ it: 'Sabato', en: 'Saturday' }),
      sun: t({ it: 'Domenica', en: 'Sunday' })
    }),
    [t]
  );

  const siblingChoices = useMemo(
    () => (siblingSites || []).filter((site) => String(site.id) !== String(currentSiteId)),
    [currentSiteId, siblingSites]
  );

  const calendarOptions = useMemo<CalendarPresetOption[]>(
    () => [
      { value: 'it', label: t({ it: 'Italia', en: 'Italy' }) },
      { value: 'us', label: t({ it: 'Stati Uniti', en: 'United States' }) },
      { value: 'uk', label: t({ it: 'Regno Unito', en: 'United Kingdom' }) },
      { value: 'de', label: t({ it: 'Germania', en: 'Germany' }) },
      { value: 'fr', label: t({ it: 'Francia', en: 'France' }) },
      { value: 'es', label: t({ it: 'Spagna', en: 'Spain' }) },
      { value: 'cn', label: t({ it: 'Cina', en: 'China' }) },
      { value: 'sa', label: t({ it: 'Arabia Saudita', en: 'Saudi Arabia' }) },
      { value: 'ae', label: t({ it: 'Emirati Arabi Uniti', en: 'United Arab Emirates' }) },
      { value: 'custom', label: t({ it: 'Solo manuale', en: 'Manual only' }) }
    ],
    [t]
  );

  const selectedCalendarLabel = useMemo(
    () => calendarOptions.find((entry) => entry.value === holidayCalendar)?.label || '',
    [calendarOptions, holidayCalendar]
  );

  const holidayCalendarNotice = useMemo(() => {
    if (holidayCalendar === 'cn') {
      return t({
        it: 'Per la Cina il preset include i principali festivi nazionali a data fissa. Capodanno lunare, Dragon Boat, Mid-Autumn e i weekend compensativi vanno aggiunti manualmente.',
        en: 'For China, the preset includes the main fixed-date national holidays. Lunar New Year, Dragon Boat, Mid-Autumn, and makeup weekends should be added manually.'
      });
    }
    if (holidayCalendar === 'sa' || holidayCalendar === 'ae') {
      return t({
        it: 'Per questo calendario i festivi islamici possono variare in base al calendario lunare e agli annunci ufficiali: aggiungili manualmente quando necessario.',
        en: 'For this calendar, Islamic holidays may vary based on the lunar calendar and official announcements: add them manually when needed.'
      });
    }
    return '';
  }, [holidayCalendar, t]);

  const holidayPreview = useMemo(() => holidays.slice(0, 6), [holidays]);

  const toggleDayEnabled = (day: SiteScheduleDayKey, enabled: boolean) => {
    setWeekly((prev) => ({
      ...prev,
      [day]: {
        enabled,
        slots: enabled ? (prev[day].slots.length ? prev[day].slots : [makeSlot()]) : prev[day].slots
      }
    }));
  };

  const addSlot = (day: SiteScheduleDayKey) => {
    setWeekly((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: true, slots: [...prev[day].slots, makeSlot('13:00', '18:00')] }
    }));
  };

  const updateSlot = (day: SiteScheduleDayKey, slotId: string, patch: Partial<EditorSlot>) => {
    setWeekly((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot))
      }
    }));
  };

  const removeSlot = (day: SiteScheduleDayKey, slotId: string) => {
    setWeekly((prev) => {
      const nextSlots = prev[day].slots.filter((slot) => slot.id !== slotId);
      return {
        ...prev,
        [day]: {
          ...prev[day],
          enabled: nextSlots.length > 0 ? prev[day].enabled : false,
          slots: nextSlots.length ? nextSlots : prev[day].slots
        }
      };
    });
  };

  const addCustomHoliday = () => {
    setHolidays((prev) =>
      sortHolidays([
        ...prev,
        {
          id: makeId(),
          date: '',
          label: '',
          source: 'custom'
        }
      ])
    );
  };

  const addNationalPreset = () => {
    const year = Number(presetYear);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return;
    if (holidayCalendar === 'custom') return;
    const existingDates = new Set(holidays.map((entry) => String(entry.date || '').trim()));
    const nextRows = nationalHolidaysForCalendar(holidayCalendar, year)
      .filter((entry) => !existingDates.has(entry.date))
      .map((entry) => ({
        id: makeId(),
        date: entry.date,
        label: String(entry.label || ''),
        source: 'national' as const
      }));
    if (!nextRows.length) return;
    setHolidays((prev) => sortHolidays([...prev, ...nextRows]));
  };

  const save = () => {
    onSave({
      siteSchedule: editorToSchedule(weekly, holidays, holidayCalendar),
      applyToSiteIds: canApplyToOtherSites ? applyToSiteIds : []
    });
    onClose();
  };

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title={t({ it: 'Orari sede', en: 'Site hours' })}
        description={
          <span>
            <span className="font-semibold text-ink">{siteName}</span>
            <span className="mx-1 text-slate-400">•</span>
            <span>{clientName}</span>
          </span>
        }
        sizeClassName="max-w-[min(96vw,1500px)]"
        initialFocusRef={saveButtonRef}
        closeDisabled={holidaysModalOpen}
        footer={
          <>
            <button type="button" onClick={onClose} className="btn-secondary">
              {t({ it: 'Annulla', en: 'Cancel' })}
            </button>
            <button ref={saveButtonRef} type="button" onClick={save} className="btn-primary">
              {t({ it: 'Salva orari', en: 'Save hours' })}
            </button>
          </>
        }
      >
        <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(360px,0.95fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <CalendarRange size={16} className="text-cyan-700" />
                  {t({ it: 'Festivi e chiusure', en: 'Holidays and closures' })}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t({
                    it: 'Gestisci calendario nazionale, giorni di festa e chiusure aziendali da una modale dedicata.',
                    en: 'Manage national calendar, holiday days, and business closures from a dedicated modal.'
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHolidaysModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <Plus size={14} />
                {t({ it: 'Gestisci festivi', en: 'Manage holidays' })}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                {holidayCalendar === 'custom'
                  ? t({ it: 'Solo chiusure manuali', en: 'Manual closures only' })
                  : t({ it: `Calendario: ${selectedCalendarLabel}`, en: `Calendar: ${selectedCalendarLabel}` })}
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                {holidays.length
                  ? t({ it: `${holidays.length} giorni configurati`, en: `${holidays.length} configured days` })
                  : t({ it: 'Nessun giorno configurato', en: 'No configured days' })}
              </span>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {holidayPreview.length ? (
                <div className="flex flex-wrap gap-2">
                  {holidayPreview.map((holiday) => (
                    <span
                      key={holiday.id}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {holiday.date}
                      {holiday.label ? ` · ${holiday.label}` : ''}
                    </span>
                  ))}
                  {holidays.length > holidayPreview.length ? (
                    <button
                      type="button"
                      onClick={() => setHolidaysModalOpen(true)}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {t({ it: `Altri ${holidays.length - holidayPreview.length}`, en: `${holidays.length - holidayPreview.length} more` })}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  {t({
                    it: 'Nessun festivo o chiusura aziendale configurato.',
                    en: 'No holiday or business closure configured.'
                  })}
                </div>
              )}
            </div>
          </section>

          {canApplyToOtherSites && siblingChoices.length ? (
            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CopyPlus size={16} className="text-emerald-700" />
                <div className="text-sm font-semibold text-ink">{t({ it: 'Applica ad altre sedi', en: 'Apply to other sites' })}</div>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t({
                  it: 'Operazione disponibile solo per admin e superadmin. Seleziona eventuali sedi sorelle dello stesso cliente.',
                  en: 'Available only for admin and superadmin. Select any sibling sites of the same client.'
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setApplyToSiteIds(siblingChoices.map((site) => site.id))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {t({ it: 'Seleziona tutte', en: 'Select all' })}
                </button>
                <button
                  type="button"
                  onClick={() => setApplyToSiteIds([])}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {t({ it: 'Azzera', en: 'Clear' })}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {siblingChoices.map((site) => {
                  const checked = applyToSiteIds.includes(site.id);
                  return (
                    <label
                      key={site.id}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border px-3 py-3 transition ${
                        checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{site.name}</span>
                        <span className="mt-1 block text-xs text-slate-500">{t({ it: 'Stessa configurazione orari e festivi', en: 'Same hours and holiday setup' })}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setApplyToSiteIds((prev) =>
                            event.target.checked ? [...prev, site.id] : prev.filter((entry) => entry !== site.id)
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

          <section className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{t({ it: 'Programmazione settimanale', en: 'Weekly schedule' })}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {t({
                    it: 'Configura una o piu fasce orarie per ogni giorno. Sono supportate anche fasce notturne o 24h.',
                    en: 'Configure one or more time ranges per day. Overnight and 24h ranges are supported.'
                  })}
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                <Clock3 size={14} />
                {t({ it: 'Multi fascia', en: 'Multi-range' })}
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {DAY_KEYS.map((day) => {
                const row = weekly[day];
                return (
                  <div key={day} className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{dayLabels[day]}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.enabled
                            ? t({ it: 'Sede operativa in questa giornata', en: 'Site is open on this day' })
                            : t({ it: 'Sede chiusa in questa giornata', en: 'Site is closed on this day' })}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDayEnabled(day, !row.enabled)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            row.enabled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${row.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {row.enabled ? t({ it: 'Aperta', en: 'Open' }) : t({ it: 'Chiusa', en: 'Closed' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => addSlot(day)}
                          disabled={!row.enabled}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus size={12} />
                          {t({ it: 'Aggiungi fascia', en: 'Add range' })}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {row.enabled ? (
                        row.slots.map((slot, index) => (
                          <div key={slot.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[92px_minmax(140px,1fr)_20px_minmax(140px,1fr)_40px] md:items-center">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {t({ it: `Fascia ${index + 1}`, en: `Range ${index + 1}` })}
                            </div>
                            <input
                              type="time"
                              step={300}
                              value={slot.start}
                              onChange={(event) => updateSlot(day, slot.id, { start: event.target.value })}
                              className="min-w-[140px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-primary/20 focus:ring-2"
                            />
                            <div className="hidden text-center text-sm text-slate-400 md:block">→</div>
                            <input
                              type="time"
                              step={300}
                              value={slot.end}
                              onChange={(event) => updateSlot(day, slot.id, { end: event.target.value })}
                              className="min-w-[140px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-primary/20 focus:ring-2"
                            />
                            <button
                              type="button"
                              onClick={() => removeSlot(day, slot.id)}
                              disabled={row.slots.length <= 1}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:cursor-not-allowed disabled:opacity-35"
                              title={t({ it: 'Rimuovi fascia', en: 'Remove range' })}
                            >
                              <Minus size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                          {t({ it: 'Nessuna fascia attiva per questo giorno.', en: 'No active time range for this day.' })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </ModalShell>
      <HolidaysEditorModal
        open={holidaysModalOpen}
        holidayCalendar={holidayCalendar}
        setHolidayCalendar={setHolidayCalendar}
        presetYear={presetYear}
        setPresetYear={setPresetYear}
        calendarOptions={calendarOptions}
        selectedCalendarLabel={selectedCalendarLabel}
        holidayCalendarNotice={holidayCalendarNotice}
        holidays={holidays}
        setHolidays={setHolidays}
        addNationalPreset={addNationalPreset}
        addCustomHoliday={addCustomHoliday}
        onClose={() => setHolidaysModalOpen(false)}
      />
    </>
  );
};

export default SiteHoursModal;
