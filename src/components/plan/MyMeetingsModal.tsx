import { Dialog, Transition } from '@headlessui/react';
import { CalendarClock, GitBranch, History, Loader2, Search, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { MeetingBooking } from '../../api/meetings';
import { getMeetingTimePhase, getMeetingTimePhaseLabel } from '../../utils/meetingTime';

type Translate = (copy: { it: string; en: string }) => string;

type MyMeetingsModalState = {
  meetings: MeetingBooking[];
  loading: boolean;
  error: string | null;
  counts: {
    total: number;
    inProgress: number;
    upcoming: number;
    past: number;
  };
  now: number;
};

type Props = {
  open: boolean;
  modal: MyMeetingsModalState | null;
  meetings: MeetingBooking[];
  search: string;
  focusRef: MutableRefObject<HTMLButtonElement | null>;
  t: Translate;
  canUseMeetingNotes: (booking: MeetingBooking) => boolean;
  locationLabels: {
    clientNameById: Map<string, string>;
    siteNameById: Map<string, string>;
    floorPlanNameById: Map<string, string>;
  };
  checkInBusyId: string | null;
  checkInDoneById: Record<string, true>;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onOpenScheduling: () => void;
  onRefresh: () => void;
  onOpenNotes: (booking: MeetingBooking) => void;
  onCheckIn: (booking: MeetingBooking) => void;
};

const MyMeetingsModal = ({
  open,
  modal,
  meetings,
  search,
  focusRef,
  t,
  canUseMeetingNotes,
  locationLabels,
  checkInBusyId,
  checkInDoneById,
  onClose,
  onSearchChange,
  onOpenScheduling,
  onRefresh,
  onOpenNotes,
  onCheckIn
}: Props) => {
  const [chainInfoMeetingId, setChainInfoMeetingId] = useState<string | null>(null);
  const ignoreOuterCloseUntilRef = useRef(0);

  const closeChainInfoModal = () => {
    ignoreOuterCloseUntilRef.current = Date.now() + 320;
    setChainInfoMeetingId(null);
  };

  const requestClose = () => {
    if (chainInfoMeetingId) return;
    if (Date.now() < ignoreOuterCloseUntilRef.current) return;
    onClose();
  };

  const chainByMeetingId = useMemo(() => {
    const rows = Array.isArray(modal?.meetings) ? modal.meetings : [];
    const byId = new Map<string, MeetingBooking>();
    for (const row of rows) {
      const id = String(row.id || '').trim();
      if (!id) continue;
      byId.set(id, row);
    }
    const cachedRootByMeetingId = new Map<string, string>();
    const resolveRootId = (row: MeetingBooking) => {
      const id = String(row.id || '').trim();
      if (!id) return '';
      const cached = cachedRootByMeetingId.get(id);
      if (cached) return cached;
      const visited: string[] = [];
      let cursor: MeetingBooking | null = row;
      let rootId = id;
      while (cursor) {
        const cursorId = String(cursor.id || '').trim();
        if (!cursorId || visited.includes(cursorId)) break;
        visited.push(cursorId);
        const parentId = String(cursor.followUpOfMeetingId || '').trim();
        if (!parentId) {
          rootId = cursorId;
          break;
        }
        const parent = byId.get(parentId);
        if (!parent) {
          rootId = `missing:${parentId}`;
          break;
        }
        cursor = parent;
      }
      for (const entryId of visited) cachedRootByMeetingId.set(entryId, rootId);
      return rootId;
    };
    const groups = new Map<string, MeetingBooking[]>();
    for (const row of rows) {
      const rootId = resolveRootId(row);
      if (!rootId) continue;
      if (!groups.has(rootId)) groups.set(rootId, []);
      groups.get(rootId)!.push(row);
    }
    for (const groupRows of groups.values()) {
      groupRows.sort((a, b) => {
        const aStart = Number(a.startAt || 0);
        const bStart = Number(b.startAt || 0);
        if (aStart !== bStart) return aStart - bStart;
        const aSeq = Number(a.followUpSequence || 0);
        const bSeq = Number(b.followUpSequence || 0);
        if (aSeq !== bSeq) return aSeq - bSeq;
        return Number(a.createdAt || 0) - Number(b.createdAt || 0);
      });
    }
    const lookup = new Map<string, MeetingBooking[]>();
    for (const groupRows of groups.values()) {
      if (groupRows.length <= 1) continue;
      for (const row of groupRows) {
        const id = String(row.id || '').trim();
        if (!id) continue;
        lookup.set(id, groupRows);
      }
    }
    return lookup;
  }, [modal?.meetings]);

  const selectedChainEntries = useMemo(
    () => (chainInfoMeetingId ? chainByMeetingId.get(chainInfoMeetingId) || [] : []),
    [chainByMeetingId, chainInfoMeetingId]
  );

  useEffect(() => {
    if (!open) setChainInfoMeetingId(null);
  }, [open]);

  useEffect(() => {
    if (!chainInfoMeetingId) return;
    if (chainByMeetingId.has(chainInfoMeetingId)) return;
    setChainInfoMeetingId(null);
  }, [chainByMeetingId, chainInfoMeetingId]);

  return (
    <>
      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-[99]" initialFocus={focusRef} onClose={requestClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'I miei meeting', en: 'My meetings' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Meeting passati, in corso e futuri collegati al tuo utente.',
                          en: 'Past, ongoing and upcoming meetings linked to your user.'
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onOpenScheduling}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        title={t({ it: 'Apri scheduling generale', en: 'Open general scheduling' })}
                      >
                        <CalendarClock size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={onRefresh}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        title={modal?.loading ? t({ it: 'Aggiornamento…', en: 'Refreshing…' }) : t({ it: 'Aggiorna', en: 'Refresh' })}
                      >
                        {modal?.loading ? <Loader2 size={16} className="animate-spin" /> : <History size={15} />}
                      </button>
                      <button
                        ref={focusRef}
                        type="button"
                        onClick={requestClose}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t({ it: 'Totale', en: 'Total' })}</div>
                      <div className="text-base font-semibold text-ink">{modal?.counts.total || 0}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <div className="text-emerald-700">{t({ it: 'In corso', en: 'In progress' })}</div>
                      <div className="text-base font-semibold text-emerald-800">{modal?.counts.inProgress || 0}</div>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                      <div className="text-violet-700">{t({ it: 'Futuri', en: 'Upcoming' })}</div>
                      <div className="text-base font-semibold text-violet-800">{modal?.counts.upcoming || 0}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
                      <div className="text-slate-600">{t({ it: 'Passati', en: 'Past' })}</div>
                      <div className="text-base font-semibold text-slate-700">{modal?.counts.past || 0}</div>
                    </div>
                  </div>

                  <div className="relative mt-3">
                    <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder={t({
                        it: 'Cerca per oggetto, sala, cliente, sede, piano o orario…',
                        en: 'Search by subject, room, client, site, floor or time…'
                      })}
                      className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
                    />
                  </div>

                  <div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                    {modal?.error ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {modal.error}
                      </div>
                    ) : null}
                    {!modal?.loading && !(modal?.meetings || []).length ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                        {t({ it: 'Nessun meeting trovato per il tuo utente.', en: 'No meetings found for your user.' })}
                      </div>
                    ) : null}
                    {!modal?.loading && !!(modal?.meetings || []).length && !meetings.length ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                        {t({ it: 'Nessun meeting corrisponde alla ricerca.', en: 'No meetings match your search.' })}
                      </div>
                    ) : null}
                    {meetings.map((booking) => {
                      const now = Number(modal?.now || Date.now());
                      const startAt = Number(booking.startAt || 0);
                      const endAt = Number(booking.endAt || 0);
                      const meetingNumber = Number((booking as any)?.meetingNumber || 0);
                      const bookingId = String(booking.id || '');
                      const chainEntries = chainByMeetingId.get(bookingId) || [];
                      const hasChain = chainEntries.length > 1;
                      const chainStep = hasChain ? Math.max(1, chainEntries.findIndex((row) => String(row.id || '') === bookingId) + 1) : 0;
                      const clientLabel = locationLabels.clientNameById.get(String(booking.clientId || '')) || '';
                      const siteLabel = locationLabels.siteNameById.get(String(booking.siteId || '')) || '';
                      const floorLabel = locationLabels.floorPlanNameById.get(String(booking.floorPlanId || '')) || '';
                      const locationLine = [clientLabel, siteLabel, floorLabel].filter(Boolean).join(' • ');
                      const tone =
                        startAt <= now && now < endAt
                          ? 'border-emerald-200 bg-emerald-50'
                          : startAt > now
                            ? 'border-violet-200 bg-violet-50'
                            : 'border-slate-200 bg-slate-50';
                      return (
                        <div key={`my-meeting-${booking.id}`} className={`rounded-xl border px-3 py-3 ${tone}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-ink">
                                {meetingNumber > 0 ? `#${meetingNumber} • ` : ''}
                                {booking.subject || t({ it: 'Riunione', en: 'Meeting' })}
                              </div>
                              <div className="truncate text-xs text-slate-600">
                                {booking.roomName || '-'} • {new Date(startAt).toLocaleString()} - {new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {locationLine ? <div className="truncate text-[11px] text-slate-500">{locationLine}</div> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              {hasChain ? (
                                <button
                                  type="button"
                                  onClick={() => setChainInfoMeetingId(bookingId)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                  title={t({
                                    it: `Mostra catena follow-up (step ${chainStep}/${chainEntries.length})`,
                                    en: `Show follow-up chain (step ${chainStep}/${chainEntries.length})`
                                  })}
                                >
                                  <GitBranch size={14} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canUseMeetingNotes(booking)) return;
                                  onOpenNotes(booking);
                                }}
                                disabled={!canUseMeetingNotes(booking)}
                                title={
                                  canUseMeetingNotes(booking)
                                    ? t({ it: 'Apri appunti meeting', en: 'Open meeting notes' })
                                    : t({
                                        it: 'Solo i partecipanti del meeting possono usare gli appunti.',
                                        en: 'Only meeting participants can use notes.'
                                      })
                                }
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                                  canUseMeetingNotes(booking)
                                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                }`}
                              >
                                {t({ it: 'Gestione', en: 'Manage' })}
                              </button>
                              {startAt <= now && now < endAt && canUseMeetingNotes(booking) ? (
                                <button
                                  type="button"
                                  onClick={() => onCheckIn(booking)}
                                  disabled={checkInBusyId === String(booking.id)}
                                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                                    checkInDoneById[String(booking.id)]
                                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  } disabled:opacity-60`}
                                  title={
                                    checkInBusyId === String(booking.id)
                                      ? t({ it: 'Aggiornamento check-in in corso…', en: 'Updating check-in…' })
                                      : checkInDoneById[String(booking.id)]
                                        ? t({ it: 'Check-in già registrato', en: 'Check-in already completed' })
                                        : t({ it: 'Registra check-in', en: 'Register check-in' })
                                  }
                                >
                                  {checkInBusyId === String(booking.id)
                                    ? t({ it: 'Check-in…', en: 'Check-in…' })
                                    : checkInDoneById[String(booking.id)]
                                      ? t({ it: 'Check-in OK', en: 'Check-in OK' })
                                      : t({ it: 'Check-in', en: 'Check-in' })}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {modal?.loading ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        {t({ it: 'Caricamento meeting…', en: 'Loading meetings…' })}
                      </div>
                    ) : null}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!chainInfoMeetingId} as={Fragment}>
        <Dialog as="div" className="relative z-[104]" onClose={closeChainInfoModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="inline-flex items-center gap-2 text-base font-semibold text-ink">
                        <GitBranch size={15} />
                        {t({ it: 'Info catena', en: 'Chain info' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {selectedChainEntries.length
                          ? t({
                              it: `${selectedChainEntries.length} step nella chain`,
                              en: `${selectedChainEntries.length} steps in chain`
                            })
                          : t({ it: 'Nessuna chain disponibile', en: 'No chain available' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeChainInfoModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="max-h-[55vh] space-y-2 overflow-y-auto px-4 py-3">
                    {selectedChainEntries.length ? (
                      selectedChainEntries.map((entry, index) => {
                        const rowId = String(entry.id || '');
                        const rowStart = Number(entry.startAt || 0);
                        const rowEnd = Number(entry.endAt || 0);
                        const now = Number(modal?.now || Date.now());
                        const phase = getMeetingTimePhase(rowStart, rowEnd, now);
                        const phaseLabel = getMeetingTimePhaseLabel(phase, t);
                        const phaseTone =
                          phase === 'current'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : phase === 'upcoming'
                              ? 'border-violet-200 bg-violet-50 text-violet-800'
                              : 'border-slate-200 bg-slate-50 text-slate-700';
                        const isSelected = rowId === String(chainInfoMeetingId || '');
                        return (
                          <div key={`chain-step-${rowId || index}`} className={`rounded-xl border px-3 py-2 ${phaseTone} ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase tracking-wide">
                                {t({ it: 'Passo', en: 'Step' })} {index + 1}
                              </div>
                              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold">{phaseLabel}</span>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-ink">{entry.subject || t({ it: 'Riunione', en: 'Meeting' })}</div>
                            <div className="text-xs text-slate-600">
                              {entry.roomName || '-'} • {new Date(rowStart).toLocaleString()} - {new Date(rowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                        {t({ it: 'Nessuna informazione chain disponibile per questo meeting.', en: 'No chain information available for this meeting.' })}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default MyMeetingsModal;
