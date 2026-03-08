import { Dialog, Transition } from '@headlessui/react';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { Fragment, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { MeetingBooking } from '../../api/meetings';
import { currentLocalIsoDay } from '../../utils/localDate';

type Translate = (copy: { it: string; en: string }) => string;

export type RoomMeetingDuplicateModalState = {
  mode: 'duplicate' | 'followup';
  booking: MeetingBooking;
  step: 'setup' | 'calendar';
  roomMode: 'selected' | 'any';
  selectedRoomId: string;
  timeMode: 'same' | 'any_08_18' | 'custom';
  customFromHm: string;
  customToHm: string;
  roomOptions: Array<{ roomId: string; roomName: string; floorPlanId: string; floorPlanName: string }>;
  baseDay: string;
  preferredDay: string;
  monthAnchor: string;
  selectedDays: string[];
  availabilityByDay: Record<string, { state: 'available' | 'occupied' | 'blocked' | 'loading' | 'error'; reason?: string }>;
  candidateByDay: Record<string, { roomId: string; roomName: string; floorPlanId: string; floorPlanName: string; startHm: string; endHm: string }>;
  loadingMonth: boolean;
  saving: boolean;
  error: string | null;
};

type Props = {
  open: boolean;
  modal: RoomMeetingDuplicateModalState | null;
  roomPickerOpen: boolean;
  roomPickerRef: MutableRefObject<HTMLDivElement | null>;
  setModal: Dispatch<SetStateAction<RoomMeetingDuplicateModalState | null>>;
  setRoomPickerOpen: Dispatch<SetStateAction<boolean>>;
  meetingClockFromTs: (ts: number) => string;
  hmToMinutes: (hm: string) => number | null;
  monthAnchorFromIso: (isoDay: string) => string;
  shiftMonthAnchor: (anchor: string, deltaMonths: number) => string;
  t: Translate;
  onClose: () => void;
  onSave: () => void | Promise<void>;
};

const RoomMeetingDuplicateModal = ({
  open,
  modal,
  roomPickerOpen,
  roomPickerRef,
  setModal,
  setRoomPickerOpen,
  meetingClockFromTs,
  hmToMinutes,
  monthAnchorFromIso,
  shiftMonthAnchor,
  t,
  onClose,
  onSave
}: Props) => (
  <Transition show={open} as={Fragment}>
    <Dialog
      as="div"
      className="relative z-[145]"
      onClose={() => {
        if (modal?.saving) return;
        onClose();
      }}
    >
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
      </Transition.Child>
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-[760px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              {(() => {
                const dup = modal;
                if (!dup) return null;
                const monthDate = new Date(`${dup.monthAnchor}T00:00:00`);
                const validMonth = Number.isFinite(monthDate.getTime());
                const year = validMonth ? monthDate.getFullYear() : new Date().getFullYear();
                const month = validMonth ? monthDate.getMonth() : new Date().getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstWeekday = (() => {
                  const weekday = new Date(year, month, 1).getDay();
                  return (weekday + 6) % 7;
                })();
                const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                const baseDay = dup.baseDay;
                const booking = dup.booking;
                const startHm = meetingClockFromTs(Number(booking.startAt || 0));
                const endHm = meetingClockFromTs(Number(booking.endAt || 0));
                const sourceRoomId = String((booking as any)?.roomId || '').trim();
                const sourceRoomName = String((booking as any)?.roomName || '').trim();
                const selectedRoomOption = dup.roomOptions.find((entry) => String(entry.roomId) === String(dup.selectedRoomId));
                const customFromMin = hmToMinutes(String(dup.customFromHm || ''));
                const customToMin = hmToMinutes(String(dup.customToHm || ''));
                const customWindowValid =
                  Number.isFinite(customFromMin) &&
                  Number.isFinite(customToMin) &&
                  Number(customFromMin) < Number(customToMin);
                const today = currentLocalIsoDay();
                const canGoPrev = dup.monthAnchor > monthAnchorFromIso(baseDay);
                const isFollowUpMode = dup.mode === 'followup';
                const cells: Array<{ iso: string | null; dayNum: number | null }> = [];
                for (let i = 0; i < firstWeekday; i += 1) cells.push({ iso: null, dayNum: null });
                for (let day = 1; day <= daysInMonth; day += 1) {
                  const date = new Date(year, month, day);
                  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  cells.push({ iso, dayNum: day });
                }
                while (cells.length % 7) cells.push({ iso: null, dayNum: null });
                const weekdayLabels = [
                  t({ it: 'Lun', en: 'Mon' }),
                  t({ it: 'Mar', en: 'Tue' }),
                  t({ it: 'Mer', en: 'Wed' }),
                  t({ it: 'Gio', en: 'Thu' }),
                  t({ it: 'Ven', en: 'Fri' }),
                  t({ it: 'Sab', en: 'Sat' }),
                  t({ it: 'Dom', en: 'Sun' })
                ];

                return (
                  <>
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                      <div>
                        <div className="text-lg font-semibold text-ink">
                          {isFollowUpMode ? t({ it: 'Create Follow-UP', en: 'Create Follow-UP' }) : t({ it: 'Duplica riunione', en: 'Duplicate meeting' })}
                        </div>
                        <div className="text-xs text-slate-500">
                          {booking.subject || t({ it: 'Meeting', en: 'Meeting' })} • {startHm} - {endHm}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isFollowUpMode
                            ? t({
                                it: 'Pianifica il follow-up della stessa chain. Le date in rosso sono occupate nello stesso orario.',
                                en: 'Schedule the follow-up of the same chain. Red dates are occupied at the same time.'
                              })
                            : t({
                                it: 'Seleziona i giorni successivi. Le date in rosso sono occupate nello stesso orario.',
                                en: 'Select future days. Red dates are occupied at the same time.'
                              })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (dup.saving) return;
                          onClose();
                        }}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {dup.step === 'setup' ? (
                      <>
                        <div className="mt-3 space-y-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {t({ it: 'Scelta saletta', en: 'Room selection' })}
                            </div>
                            <div ref={roomPickerRef} className="relative mt-2">
                              <button
                                type="button"
                                onClick={() => setRoomPickerOpen((prev) => !prev)}
                                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:border-primary/40"
                              >
                                <span className="truncate pr-2">
                                  {dup.roomMode === 'any'
                                    ? t({
                                        it: 'Qualsiasi meeting room disponibile in questa sede',
                                        en: 'Any available meeting room in this site'
                                      })
                                    : `${selectedRoomOption?.roomName || '-'}${selectedRoomOption?.floorPlanName ? ` • ${selectedRoomOption.floorPlanName}` : ''}`}
                                </span>
                                <ChevronDown
                                  size={16}
                                  className={`shrink-0 text-slate-500 transition-transform ${roomPickerOpen ? 'rotate-180' : ''}`}
                                />
                              </button>
                              {roomPickerOpen ? (
                                <div className="absolute z-[220] mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModal((prev) => (prev ? { ...prev, roomMode: 'any', error: null } : prev));
                                      setRoomPickerOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                                      dup.roomMode === 'any' ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>{t({ it: 'Qualsiasi meeting room disponibile in questa sede', en: 'Any available meeting room in this site' })}</span>
                                    {dup.roomMode === 'any' ? <span className="text-xs font-semibold">✓</span> : null}
                                  </button>
                                  {dup.roomOptions.map((option) => {
                                    const isSelected = dup.roomMode === 'selected' && String(option.roomId) === String(dup.selectedRoomId);
                                    const isSource = String(option.roomId) === sourceRoomId;
                                    return (
                                      <button
                                        key={option.roomId}
                                        type="button"
                                        onClick={() => {
                                          setModal((prev) =>
                                            prev ? { ...prev, roomMode: 'selected', selectedRoomId: option.roomId, error: null } : prev
                                          );
                                          setRoomPickerOpen(false);
                                        }}
                                        className={`mt-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                                          isSelected ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                        <span className="flex min-w-0 items-center gap-2">
                                          <span className="truncate">
                                            {option.roomName}
                                            {option.floorPlanName ? ` • ${option.floorPlanName}` : ''}
                                          </span>
                                          {isSource ? (
                                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                                              {t({ it: 'Origine', en: 'Source' })}
                                            </span>
                                          ) : null}
                                        </span>
                                        {isSelected ? <span className="text-xs font-semibold">✓</span> : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              {t({ it: 'Saletta di origine', en: 'Source room' })}: <span className="font-semibold text-slate-700">{sourceRoomName || '-'}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {t({ it: 'Selezione attuale', en: 'Current selection' })}:{' '}
                              {dup.roomMode === 'any'
                                ? t({
                                    it: 'Qualsiasi meeting room disponibile in questa sede',
                                    en: 'Any available meeting room in this site'
                                  })
                                : `${selectedRoomOption?.roomName || '-'}${selectedRoomOption?.floorPlanName ? ` • ${selectedRoomOption.floorPlanName}` : ''}`}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {t({ it: 'Scelta orario', en: 'Time selection' })}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setModal((prev) => (prev ? { ...prev, timeMode: 'same', error: null } : prev))}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                  dup.timeMode === 'same'
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {t({ it: 'Stesso di quello originale', en: 'Same as original' })}
                              </button>
                              <button
                                type="button"
                                onClick={() => setModal((prev) => (prev ? { ...prev, timeMode: 'any_08_18', error: null } : prev))}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                  dup.timeMode === 'any_08_18'
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {t({ it: 'Qualsiasi disponibile tra 08:00 e 18:00', en: 'Any available between 08:00 and 18:00' })}
                              </button>
                              <button
                                type="button"
                                onClick={() => setModal((prev) => (prev ? { ...prev, timeMode: 'custom', error: null } : prev))}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                  dup.timeMode === 'custom'
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {t({ it: 'Seleziona da - a', en: 'Select from - to' })}
                              </button>
                            </div>
                            {dup.timeMode === 'custom' ? (
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <label className="text-xs text-slate-500">
                                  {t({ it: 'Da', en: 'From' })}
                                  <input
                                    type="time"
                                    value={dup.customFromHm}
                                    onChange={(event) => setModal((prev) => (prev ? { ...prev, customFromHm: event.target.value, error: null } : prev))}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                                  />
                                </label>
                                <label className="text-xs text-slate-500">
                                  {t({ it: 'A', en: 'To' })}
                                  <input
                                    type="time"
                                    value={dup.customToHm}
                                    onChange={(event) => setModal((prev) => (prev ? { ...prev, customToHm: event.target.value, error: null } : prev))}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                                  />
                                </label>
                              </div>
                            ) : null}
                            <div className="mt-2 text-xs text-slate-500">
                              {dup.timeMode === 'same'
                                ? `${t({ it: 'Slot origine', en: 'Source slot' })}: ${startHm} - ${endHm}`
                                : dup.timeMode === 'any_08_18'
                                  ? t({
                                      it: 'Il sistema trova il primo slot utile tra 08:00 e 18:00.',
                                      en: 'System picks the first available slot between 08:00 and 18:00.'
                                    })
                                  : `${t({ it: 'Finestra scelta', en: 'Selected window' })}: ${dup.customFromHm} - ${dup.customToHm}`}
                            </div>
                            {dup.timeMode === 'custom' && !customWindowValid ? (
                              <div className="mt-1 text-xs font-semibold text-rose-600">
                                {t({ it: "L'orario 'da' deve essere precedente all'orario 'a'.", en: "The 'from' time must be earlier than the 'to' time." })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={dup.saving}
                            onClick={onClose}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {t({ it: 'Annulla', en: 'Cancel' })}
                          </button>
                          <button
                            type="button"
                            disabled={(dup.roomMode === 'selected' && !dup.selectedRoomId) || (dup.timeMode === 'custom' && !customWindowValid)}
                            onClick={() =>
                              setModal((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      step: 'calendar',
                                      selectedDays: [],
                                      availabilityByDay: {},
                                      candidateByDay: {},
                                      loadingMonth: false,
                                      error: null
                                    }
                                  : prev
                              )
                            }
                            className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                          >
                            {isFollowUpMode ? t({ it: 'Vai alla pianificazione', en: 'Go to scheduling' }) : t({ it: 'Vai al calendario', en: 'Go to calendar' })}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setModal((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        step: 'setup',
                                        selectedDays: [],
                                        availabilityByDay: {},
                                        candidateByDay: {},
                                        loadingMonth: false,
                                        error: null
                                      }
                                    : prev
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <ChevronLeft size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={!canGoPrev}
                              onClick={() => setModal((prev) => (prev ? { ...prev, monthAnchor: shiftMonthAnchor(prev.monthAnchor, -1), error: null } : prev))}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <ChevronLeft size={15} />
                            </button>
                            <div className="min-w-[220px] text-center text-sm font-semibold text-slate-700 capitalize">{monthLabel}</div>
                            <button
                              type="button"
                              onClick={() => setModal((prev) => (prev ? { ...prev, monthAnchor: shiftMonthAnchor(prev.monthAnchor, 1), error: null } : prev))}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <ChevronRight size={15} />
                            </button>
                          </div>
                          <div className="text-xs text-slate-500">
                            {dup.loadingMonth ? (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 size={12} className="animate-spin" />
                                {t({ it: 'Verifica disponibilità…', en: 'Checking availability…' })}
                              </span>
                            ) : dup.selectedDays.length > 0 ? (
                              t({
                                it: `${dup.selectedDays.length} giorn${dup.selectedDays.length === 1 ? 'o selezionato' : 'i selezionati'}`,
                                en: `${dup.selectedDays.length} day(s) selected`
                              })
                            ) : (
                              t({ it: 'Nessun giorno selezionato', en: 'No days selected' })
                            )}
                          </div>
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid grid-cols-7 gap-1">
                            {weekdayLabels.map((label) => (
                              <div key={`dup-weekday-${label}`} className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {label}
                              </div>
                            ))}
                            {cells.map((cell, idx) => {
                              if (!cell.iso) return <div key={`dup-empty-${idx}`} className="h-20 rounded-lg border border-transparent" />;
                              const status =
                                dup.availabilityByDay[cell.iso] ||
                                (cell.iso <= baseDay || cell.iso < today
                                  ? ({
                                      state: 'blocked' as const,
                                      reason:
                                        cell.iso < today
                                          ? t({ it: 'Giorno passato', en: 'Past day' })
                                          : t({ it: 'Giorno di origine', en: 'Source day' })
                                    } as const)
                                  : ({ state: 'loading' as const }));
                              const candidate = dup.candidateByDay[cell.iso];
                              const tooltipText = (() => {
                                const dayLabel = new Date(`${cell.iso}T00:00:00`).toLocaleDateString();
                                if (status.state === 'occupied') {
                                  return `${dayLabel}\n${t({ it: 'Occupata', en: 'Busy' })}\n${status.reason || t({ it: 'Slot già occupato', en: 'Slot already occupied' })}`;
                                }
                                if (status.state === 'blocked') {
                                  return `${dayLabel}\n${status.reason || t({ it: 'Non selezionabile', en: 'Not selectable' })}`;
                                }
                                if (status.state === 'error') {
                                  return `${dayLabel}\n${status.reason || t({ it: 'Errore verifica', en: 'Check error' })}`;
                                }
                                if (status.state === 'loading') {
                                  return `${dayLabel}\n${t({ it: 'Verifica disponibilità in corso', en: 'Checking availability' })}`;
                                }
                                if (candidate) {
                                  return `${dayLabel}\n${candidate.roomName}\n${candidate.startHm} - ${candidate.endHm}`;
                                }
                                return `${dayLabel}\n${t({ it: 'Disponibile', en: 'Available' })}\n${startHm} - ${endHm}`;
                              })();
                              const selected = dup.selectedDays.includes(cell.iso);
                              const blocked = status.state !== 'available';
                              const classes =
                                status.state === 'occupied'
                                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                                  : status.state === 'available' && selected
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : status.state === 'available'
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : status.state === 'blocked'
                                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                                        : status.state === 'loading'
                                          ? 'border-slate-200 bg-white text-slate-500'
                                          : 'border-amber-300 bg-amber-50 text-amber-800';
                              return (
                                <button
                                  key={cell.iso}
                                  type="button"
                                  disabled={blocked}
                                  title={tooltipText}
                                  aria-label={tooltipText}
                                  onClick={() =>
                                    setModal((prev) => {
                                      if (!prev) return prev;
                                      const has = prev.selectedDays.includes(cell.iso!);
                                      return {
                                        ...prev,
                                        error: null,
                                        selectedDays: has ? prev.selectedDays.filter((entry) => entry !== cell.iso) : [...prev.selectedDays, cell.iso!]
                                      };
                                    })
                                  }
                                  className={`group relative h-20 rounded-lg border p-2 text-left transition ${classes} disabled:cursor-not-allowed`}
                                >
                                  <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden max-w-[240px] whitespace-pre-line rounded-lg border border-slate-200 bg-slate-900 px-2 py-1 text-[10px] font-medium leading-snug text-white shadow-lg group-hover:block group-focus-visible:block">
                                    {tooltipText}
                                  </span>
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="text-sm font-semibold">{cell.dayNum}</span>
                                    {status.state === 'occupied' ? (
                                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                        {t({ it: 'Occupata', en: 'Busy' })}
                                      </span>
                                    ) : status.state === 'available' ? (
                                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${selected ? 'bg-primary/15 text-primary' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {selected ? t({ it: 'Selez.', en: 'Selected' }) : t({ it: 'Libera', en: 'Free' })}
                                      </span>
                                    ) : status.state === 'loading' ? (
                                      <Loader2 size={12} className="animate-spin text-slate-400" />
                                    ) : null}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-[11px] leading-tight opacity-90">
                                    {status.state === 'occupied'
                                      ? status.reason || t({ it: 'Già occupata', en: 'Already occupied' })
                                      : status.state === 'blocked'
                                        ? status.reason || t({ it: 'Giorno non selezionabile', en: 'Day not selectable' })
                                        : status.state === 'error'
                                          ? status.reason || t({ it: 'Errore verifica', en: 'Check error' })
                                          : candidate
                                            ? `${candidate.roomName} • ${candidate.startHm} - ${candidate.endHm}`
                                            : `${startHm} - ${endHm}`}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {dup.error ? (
                          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{dup.error}</div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={dup.saving}
                            onClick={onClose}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {t({ it: 'Annulla', en: 'Cancel' })}
                          </button>
                          <button
                            type="button"
                            disabled={dup.saving || !dup.selectedDays.length}
                            onClick={() => void onSave()}
                            className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                          >
                            {dup.saving ? (
                              <>
                                <Loader2 size={14} className="mr-1 inline-block animate-spin" />
                                {isFollowUpMode ? t({ it: 'Creazione follow-up...', en: 'Creating follow-up...' }) : t({ it: 'Duplicazione...', en: 'Duplicating...' })}
                              </>
                            ) : isFollowUpMode ? (
                              t({ it: 'Crea Follow-UP sui giorni selezionati', en: 'Create Follow-UP on selected days' })
                            ) : (
                              t({ it: 'Duplica sui giorni selezionati', en: 'Duplicate on selected days' })
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default RoomMeetingDuplicateModal;
