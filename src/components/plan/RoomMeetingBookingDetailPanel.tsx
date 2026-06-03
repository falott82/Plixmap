import { Fragment } from 'react';

import { Transition } from '@headlessui/react';

import { Copy, X, Plus, Link2, Users, Globe, StickyNote, Building2, Search } from 'lucide-react';

import UserAvatar from '../ui/UserAvatar';

import { usePlanView } from './usePlanView';

type RoomMeetingBookingDetailPanelProps = Pick<ReturnType<typeof usePlanView>, 'addTimelineMeetingManualParticipant' | 'addTimelineMeetingRealParticipant' | 'adjustRoomMeetingEditEndTime' | 'canOpenBusinessPartnersDirectory' | 'canUseMeetingNotes' | 'client' | 'clientBusinessPartnerNames' | 'closeRoomMeetingBookingDetail' | 'closeRoomMeetingEditParticipantsModal' | 'extendRoomMeetingBooking' | 'getMeetingCheckInStats' | 'getRoomMeetingCheckInEntries' | 'meetingCheckInEntryKey' | 'openRoomMeetingDuplicateModal' | 'openRoomMeetingEditParticipantsModal' | 'push' | 'removeTimelineMeetingParticipant' | 'roomMeetingCheckInListOpen' | 'roomMeetingEditBusinessPartnersModalOpen' | 'roomMeetingEditManualCompanyIsOther' | 'roomMeetingEditParticipantCandidates' | 'roomMeetingEditParticipantsCloseGuardUntilRef' | 'roomMeetingEditParticipantsModalOpen' | 'roomMeetingEditParticipantsNameInputRef' | 'roomMeetingExtendBusyId' | 'roomMeetingsTimelineBookingDetail' | 'roomMeetingsTimelineModal' | 'saveRoomMeetingBookingEdit' | 'setRoomMeetingCheckInListOpen' | 'setRoomMeetingEditBusinessPartnersModalOpen' | 'setRoomMeetingEditManualCompanyIsOther' | 'setRoomMeetingNotesModalBooking' | 'setRoomMeetingNotesModalState' | 'setRoomMeetingNotesReturnToMyMeetings' | 'setRoomMeetingsTimelineBookingDetail' | 't' | 'toggleTimelineMeetingParticipantFlag'>;

const RoomMeetingBookingDetailPanel = (props: RoomMeetingBookingDetailPanelProps) => {
  const {
    addTimelineMeetingManualParticipant,
    addTimelineMeetingRealParticipant,
    adjustRoomMeetingEditEndTime,
    canOpenBusinessPartnersDirectory,
    canUseMeetingNotes,
    client,
    clientBusinessPartnerNames,
    closeRoomMeetingBookingDetail,
    closeRoomMeetingEditParticipantsModal,
    extendRoomMeetingBooking,
    getMeetingCheckInStats,
    getRoomMeetingCheckInEntries,
    meetingCheckInEntryKey,
    openRoomMeetingDuplicateModal,
    openRoomMeetingEditParticipantsModal,
    push,
    removeTimelineMeetingParticipant,
    roomMeetingCheckInListOpen,
    roomMeetingEditBusinessPartnersModalOpen,
    roomMeetingEditManualCompanyIsOther,
    roomMeetingEditParticipantCandidates,
    roomMeetingEditParticipantsCloseGuardUntilRef,
    roomMeetingEditParticipantsModalOpen,
    roomMeetingEditParticipantsNameInputRef,
    roomMeetingExtendBusyId,
    roomMeetingsTimelineBookingDetail,
    roomMeetingsTimelineModal,
    saveRoomMeetingBookingEdit,
    setRoomMeetingCheckInListOpen,
    setRoomMeetingEditBusinessPartnersModalOpen,
    setRoomMeetingEditManualCompanyIsOther,
    setRoomMeetingNotesModalBooking,
    setRoomMeetingNotesModalState,
    setRoomMeetingNotesReturnToMyMeetings,
    setRoomMeetingsTimelineBookingDetail,
    t,
    toggleTimelineMeetingParticipantFlag
  } = props;
  // The parent renders this only when the gate value is truthy; narrow it here so the
  // (previously enclosing-conditional) JSX type-checks identically.
  if (!roomMeetingsTimelineBookingDetail) return null;
  return (
                    <div className="mt-3 space-y-3">
                      {roomMeetingsTimelineBookingDetail.mode === 'view' ? (
                        <>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-base font-semibold text-ink">
                              {Number((roomMeetingsTimelineBookingDetail.booking as any)?.meetingNumber || 0) > 0
                                ? `#${Number((roomMeetingsTimelineBookingDetail.booking as any)?.meetingNumber || 0)} • `
                                : ''}
                              {roomMeetingsTimelineBookingDetail.booking.subject || t({ it: 'Meeting', en: 'Meeting' })}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              {new Date(roomMeetingsTimelineBookingDetail.booking.startAt).toLocaleString()} - {new Date(roomMeetingsTimelineBookingDetail.booking.endAt).toLocaleTimeString()}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {t({ it: 'Stato', en: 'Status' })}: {roomMeetingsTimelineBookingDetail.booking.status} • {t({ it: 'Richiedente', en: 'Requester' })}:{' '}
                              {roomMeetingsTimelineBookingDetail.booking.requestedByUsername || '-'}
                            </div>
                            {(() => {
                              const booking = roomMeetingsTimelineBookingDetail.booking;
                              const checkMap =
                                roomMeetingsTimelineModal?.checkInStatusByMeetingId?.[String(booking.id || '')] || {};
                              const checkTsMap =
                                roomMeetingsTimelineModal?.checkInTimestampsByMeetingId?.[String(booking.id || '')] || {};
                              const stats = getMeetingCheckInStats(booking, checkMap);
                              const checkedEntries = getRoomMeetingCheckInEntries(booking, checkMap, checkTsMap);
                              return (
                                <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="font-semibold text-slate-700">
                                      {t({ it: 'Stato check-in', en: 'Check-in status' })}
                                    </div>
                                    <div className="text-slate-600">
                                      {stats.checked}/{stats.total} • {stats.percent}%
                                    </div>
                                  </div>
                                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.percent}%` }} />
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                    <span>
                                      {t({ it: 'Interni in sede', en: 'Internal on-site' })}: {stats.internalOnSite}
                                    </span>
                                    <span>
                                      {t({ it: 'Esterni in sede', en: 'External on-site' })}: {stats.externalOnSite}
                                    </span>
                                    <span>
                                      {t({ it: 'Partecipanti remoti', en: 'Remote participants' })}: {stats.remoteParticipants}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-[11px] text-slate-500">
                                      {t({
                                        it: 'Visualizza chi ha effettuato il check-in con data/ora registrata dal server.',
                                        en: 'Show who checked in with date/time recorded by the server.'
                                      })}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setRoomMeetingCheckInListOpen((prev) => !prev)}
                                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      {roomMeetingCheckInListOpen
                                        ? t({ it: 'Nascondi check-in', en: 'Hide check-in' })
                                        : t({ it: 'Mostra check-in', en: 'Show check-in' })}
                                    </button>
                                  </div>
                                  {roomMeetingCheckInListOpen ? (
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                      {checkedEntries.length ? (
                                        <div className="grid max-h-64 gap-2 overflow-auto pr-1">
                                          {checkedEntries.map((entry) => (
                                            <div
                                              key={`chk-${entry.key}`}
                                              className="grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2"
                                            >
                                              <UserAvatar src={entry.logoUrl || undefined} username={entry.label} size={28} />
                                              <div className="min-w-0">
                                                <div className={`truncate text-sm font-semibold ${entry.kind === 'external' ? 'text-violet-800 uppercase tracking-[0.02em]' : 'text-slate-800'}`}>
                                                  {entry.label}
                                                </div>
                                                <div className="truncate text-[11px] text-slate-500">
                                                  {entry.company || (entry.kind === 'internal' ? (client?.shortName || client?.name || '-') : '—')}
                                                  {entry.email ? ` • ${entry.email}` : ''}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className="text-[11px] font-semibold text-emerald-700">
                                                  {t({ it: 'Check-in', en: 'Check-in' })}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                  {entry.checkedAt ? new Date(entry.checkedAt).toLocaleString() : '—'}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                                          {t({ it: 'Nessun check-in registrato al momento.', en: 'No check-ins registered yet.' })}
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()}
                            {roomMeetingsTimelineBookingDetail.booking.notes ? (
                              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                                {roomMeetingsTimelineBookingDetail.booking.notes}
                              </div>
                            ) : null}
                            {roomMeetingsTimelineBookingDetail.booking.videoConferenceLink ? (
                              <a
                                href={roomMeetingsTimelineBookingDetail.booking.videoConferenceLink}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-primary hover:bg-slate-50"
                              >
                                <Link2 size={14} />
                                <span className="truncate">{roomMeetingsTimelineBookingDetail.booking.videoConferenceLink}</span>
                              </a>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="mr-auto flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canUseMeetingNotes(roomMeetingsTimelineBookingDetail.booking)) return;
                                  setRoomMeetingNotesReturnToMyMeetings(false);
                                  setRoomMeetingNotesModalState(null);
                                  setRoomMeetingNotesModalBooking(roomMeetingsTimelineBookingDetail.booking);
                                  closeRoomMeetingBookingDetail();
                                }}
                                disabled={!canUseMeetingNotes(roomMeetingsTimelineBookingDetail.booking)}
                                title={
                                  canUseMeetingNotes(roomMeetingsTimelineBookingDetail.booking)
                                    ? t({ it: 'Apri appunti meeting', en: 'Open meeting notes' })
                                    : t({
                                        it: 'Solo i partecipanti del meeting possono usare gli appunti.',
                                        en: 'Only meeting participants can use notes.'
                                      })
                                }
                                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                                  canUseMeetingNotes(roomMeetingsTimelineBookingDetail.booking)
                                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                }`}
                              >
                                <StickyNote size={13} className="mr-1 inline-block" />
                                {t({ it: 'Appunti', en: 'Notes' })}
                              </button>
                              <button
                                type="button"
                                onClick={() => openRoomMeetingDuplicateModal(roomMeetingsTimelineBookingDetail.booking)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Copy size={13} className="mr-1 inline-block" />
                                {t({ it: 'Duplica', en: 'Duplicate' })}
                              </button>
                              <span className="text-xs font-semibold text-slate-600">{t({ it: 'Estendi', en: 'Extend' })}</span>
                              {Number(roomMeetingsTimelineBookingDetail.booking.endAt || 0) <= Date.now() ? (
                                <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-400">
                                  {t({ it: 'Meeting concluso', en: 'Meeting ended' })}
                                </span>
                              ) : (
                                [
                                  ['10m', t({ it: '10m', en: '10m' })],
                                  ['30m', t({ it: '30m', en: '30m' })],
                                  ['1h', t({ it: '1h', en: '1h' })],
                                  ['1.5h', t({ it: '1,5h', en: '1.5h' })],
                                  ['2h', t({ it: '2h', en: '2h' })],
                                  ['max', t({ it: 'Più possibile', en: 'As much as possible' })]
                                ].map(([key, label]) => (
                                  <button
                                    key={`detail-extend-${key}`}
                                    type="button"
                                    disabled={roomMeetingExtendBusyId === String(roomMeetingsTimelineBookingDetail.booking.id)}
                                    onClick={() => void extendRoomMeetingBooking(roomMeetingsTimelineBookingDetail.booking, key as any)}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {label}
                                  </button>
                                ))
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => closeRoomMeetingBookingDetail()}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t({ it: 'Chiudi', en: 'Close' })}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const detail = roomMeetingsTimelineBookingDetail;
                            const filter = String(detail.participantFilter || '').trim().toLowerCase();
                            const selectedRealIds = new Set(
                              detail.participantsDraft.filter((p) => p.kind === 'real_user').map((p) => String(p.externalId || ''))
                            );
                            const filteredCandidates = roomMeetingEditParticipantCandidates.filter((row) => {
                              if (!filter) return true;
                              return (
                                row.fullName.toLowerCase().includes(filter) ||
                                String(row.email || '').toLowerCase().includes(filter) ||
                                row.externalId.toLowerCase().includes(filter) ||
                                String((row as any).department || '').toLowerCase().includes(filter) ||
                                String((row as any).phone || '').toLowerCase().includes(filter)
                              );
                            });
                            const onsiteInternal = detail.participantsDraft.filter((p) => p.kind === 'real_user' && !p.remote).length;
                            const remoteInternal = detail.participantsDraft.filter((p) => p.kind === 'real_user' && !!p.remote).length;
                            const onsiteManual = detail.participantsDraft.filter((p) => p.kind === 'manual' && !p.remote).length;
                            const remoteManual = detail.participantsDraft.filter((p) => p.kind === 'manual' && !!p.remote).length;
                            const requestedSeatsPreview = onsiteInternal + onsiteManual;
                            const nowTs = Date.now();
                            const bookingStartTs = Number(detail.booking.startAt || 0);
                            const bookingEndTs = Number(detail.booking.endAt || 0);
                            const isMeetingInProgressEdit = bookingStartTs <= nowTs && nowTs < bookingEndTs;
                            const hasMeetingStartedEdit = bookingStartTs <= nowTs;
                            const nowDateLocal = new Date(nowTs);
                            const nowHmLocal = `${String(nowDateLocal.getHours()).padStart(2, '0')}:${String(nowDateLocal.getMinutes()).padStart(2, '0')}`;
                            const lockedPreSetupMin = Math.max(0, Math.min(60, Number(detail.booking.setupBufferBeforeMin) || 0));
                            const lockedPostSetupMin = Math.max(0, Math.min(60, Number(detail.booking.setupBufferAfterMin) || 0));
                            const bookingCheckMap = roomMeetingsTimelineModal?.checkInStatusByMeetingId?.[String(detail.booking.id || '')] || {};
                            const bookingCheckTsMap = roomMeetingsTimelineModal?.checkInTimestampsByMeetingId?.[String(detail.booking.id || '')] || {};
                            const toDetailLocalTs = (isoDay: string, hhmm: string) => {
                              const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
                              const tm = /^(\d{1,2}):(\d{1,2})$/.exec(String(hhmm || '').trim());
                              if (!dm || !tm) return null;
                              const y = Number(dm[1]);
                              const mo = Number(dm[2]) - 1;
                              const da = Number(dm[3]);
                              const hh = Number(tm[1]);
                              const mm = Number(tm[2]);
                              if (![y, mo, da, hh, mm].every(Number.isFinite)) return null;
                              if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
                              const dt = new Date(y, mo, da, hh, mm, 0, 0);
                              return Number.isFinite(dt.getTime()) ? dt.getTime() : null;
                            };
                            const detailStartTs = toDetailLocalTs(detail.day, detail.startTime);
                            const detailEndTs = toDetailLocalTs(detail.day, detail.endTime);
                            const siblingBookings = (roomMeetingsTimelineModal?.bookings || [])
                              .filter((b) => String(b.id) !== String(detail.booking.id))
                              .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0));
                            const prevNeighbor =
                              detailStartTs === null
                                ? null
                                : [...siblingBookings]
                                    .filter((b) => Number((b as any).effectiveEndAt ?? b.endAt ?? 0) <= detailStartTs)
                                    .sort((a, b) => Number((b as any).effectiveEndAt ?? b.endAt ?? 0) - Number((a as any).effectiveEndAt ?? a.endAt ?? 0))[0] || null;
                            const nextNeighbor =
                              detailEndTs === null
                                ? null
                                : siblingBookings
                                    .filter((b) => Number((b as any).effectiveStartAt ?? b.startAt ?? 0) >= detailEndTs)
                                    .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0))[0] || null;
                            const prevBoundaryTs = prevNeighbor ? Number((prevNeighbor as any).effectiveEndAt ?? prevNeighbor.endAt ?? 0) : null;
                            const nextBoundaryTs = nextNeighbor ? Number((nextNeighbor as any).effectiveStartAt ?? nextNeighbor.startAt ?? 0) : null;
                            const freeBeforeSetupEdit =
                              detailStartTs === null || prevBoundaryTs === null
                                ? 60
                                : Math.max(0, Math.min(60, Math.floor((detailStartTs - prevBoundaryTs) / 60000)));
                            const freeAfterSetupEdit =
                              detailEndTs === null || nextBoundaryTs === null
                                ? 60
                                : Math.max(0, Math.min(60, Math.floor((nextBoundaryTs - detailEndTs) / 60000)));
                            const detailDurationMin =
                              detailStartTs === null || detailEndTs === null ? 0 : Math.max(0, Math.floor((detailEndTs - detailStartTs) / 60000));
                            const borrowableFromDetailMeeting = Math.max(0, detailDurationMin - 1);
                            const maxBeforeSetupEdit = Math.max(0, Math.min(60, freeBeforeSetupEdit + borrowableFromDetailMeeting));
                            const maxAfterSetupEdit = Math.max(0, Math.min(60, freeAfterSetupEdit + borrowableFromDetailMeeting));
                            return (
                              <>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="text-sm font-semibold text-slate-700">
                              {t({ it: 'Oggetto meeting', en: 'Meeting subject' })}
                              <input
                                value={roomMeetingsTimelineBookingDetail.subject}
                                onChange={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, subject: e.target.value } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="text-sm font-semibold text-slate-700">
                              {t({ it: 'Data', en: 'Date' })}
                              <input
                                type="date"
                                value={roomMeetingsTimelineBookingDetail.day}
                                onChange={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, day: e.target.value } : prev))
                                }
                                disabled={
                                  (!!roomMeetingsTimelineBookingDetail.applyToSeries &&
                                    !!roomMeetingsTimelineBookingDetail.booking.multiDayGroupId) ||
                                  isMeetingInProgressEdit
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                              {isMeetingInProgressEdit ? (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {t({
                                    it: 'Meeting in corso: la data non è modificabile.',
                                    en: 'Meeting in progress: date cannot be changed.'
                                  })}
                                </div>
                              ) : null}
                            </label>
                            <label className="text-sm font-semibold text-slate-700">
                              {t({ it: 'Inizio', en: 'Start' })}
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="HH:MM"
                                value={roomMeetingsTimelineBookingDetail.startTime}
                                disabled={isMeetingInProgressEdit}
                                onChange={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => {
                                    if (!prev) return prev;
                                    const nextStart = e.target.value;
                                    let nextEnd = prev.endTime;
                                    if (nextStart && nextEnd && nextStart >= nextEnd) {
                                      const [hh, mm] = nextStart.split(':').map((v) => Number(v));
                                      if (Number.isFinite(hh) && Number.isFinite(mm)) {
                                        const end = new Date(2000, 0, 1, hh, mm, 0, 0);
                                        end.setHours(end.getHours() + 1);
                                        nextEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                                      }
                                    }
                                    return { ...prev, startTime: nextStart, endTime: nextEnd };
                                  })
                                }
                                onBlur={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => {
                                    if (!prev) return prev;
                                    const raw = String(e.target.value || '').trim();
                                    const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
                                    if (!m) return prev;
                                    const hh = Number(m[1]);
                                    const mm = Number(m[2]);
                                    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return prev;
                                    const normalized = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                                    let nextEnd = prev.endTime;
                                    if (normalized && nextEnd && normalized >= nextEnd) {
                                      const end = new Date(2000, 0, 1, hh, mm, 0, 0);
                                      end.setHours(end.getHours() + 1);
                                      nextEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                                    }
                                    return { ...prev, startTime: normalized, endTime: nextEnd };
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                              {isMeetingInProgressEdit ? (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {t({
                                    it: 'Meeting in corso: l’orario di inizio non è modificabile.',
                                    en: 'Meeting in progress: start time cannot be changed.'
                                  })}
                                </div>
                              ) : null}
                            </label>
                            <label className="text-sm font-semibold text-slate-700">
                              {t({ it: 'Fine', en: 'End' })}
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <input
                                  type="time"
                                  value={roomMeetingsTimelineBookingDetail.endTime}
                                  max={hasMeetingStartedEdit ? nowHmLocal : undefined}
                                  onChange={(e) =>
                                    setRoomMeetingsTimelineBookingDetail((prev) => {
                                      if (!prev) return prev;
                                      let nextEnd = String(e.target.value || '').trim();
                                      if (!nextEnd) return prev;
                                      if (hasMeetingStartedEdit && nextEnd > nowHmLocal) nextEnd = nowHmLocal;
                                      if (prev.startTime && nextEnd && prev.startTime >= nextEnd) {
                                        const [hh, mm] = prev.startTime.split(':').map((v) => Number(v));
                                        if (Number.isFinite(hh) && Number.isFinite(mm)) {
                                          const end = new Date(2000, 0, 1, hh, mm, 0, 0);
                                          end.setHours(end.getHours() + 1);
                                          return {
                                            ...prev,
                                            endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
                                          };
                                        }
                                      }
                                      return { ...prev, endTime: nextEnd };
                                    })
                                  }
                                  className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                />
                                {isMeetingInProgressEdit ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRoomMeetingsTimelineBookingDetail((prev) =>
                                        prev ? { ...prev, endTime: nowHmLocal } : prev
                                      )
                                    }
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                    title={t({ it: 'Termina il meeting all’orario attuale', en: 'End meeting at current time' })}
                                  >
                                    {t({ it: 'Termina meeting', en: 'End meeting' })}
                                  </button>
                                ) : null}
                              </div>
                              {isMeetingInProgressEdit ? (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  {[
                                    ['10m', t({ it: '+10m', en: '+10m' })],
                                    ['30m', t({ it: '+30m', en: '+30m' })],
                                    ['1h', t({ it: '+1h', en: '+1h' })],
                                    ['2h', t({ it: '+2h', en: '+2h' })],
                                    ['max', t({ it: 'Più possibile', en: 'As much as possible' })]
                                  ].map(([key, label]) => (
                                    <button
                                      key={`edit-end-shift-${key}`}
                                      type="button"
                                      onClick={() => adjustRoomMeetingEditEndTime(key as '10m' | '30m' | '1h' | '2h' | 'max')}
                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </label>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <span>{t({ it: 'Lingua kiosk meeting', en: 'Meeting kiosk language' })}</span>
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
                                title={t({
                                  it: 'Auto usa la lingua del kiosk (impostazione manuale o lingua del dispositivo). Se imposti una lingua, il kiosk la applica automaticamente quando la riunione è in corso.',
                                  en: 'Auto uses the kiosk default language (manual choice or device language). If you set a language, the kiosk applies it automatically while the meeting is in progress.'
                                })}
                              >
                                i
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { key: 'auto', flag: '🌐', label: t({ it: 'Auto', en: 'Auto' }) },
                                { key: 'it', flag: '🇮🇹', label: 'IT' },
                                { key: 'en', flag: '🇬🇧', label: 'EN' },
                                { key: 'ru', flag: '🇷🇺', label: 'RU' },
                                { key: 'ar', flag: '🇸🇦', label: 'AR' },
                                { key: 'zh', flag: '🇨🇳', label: 'ZH' }
                              ].map((opt) => {
                                const active = roomMeetingsTimelineBookingDetail.kioskLanguage === (opt.key as any);
                                return (
                                  <button
                                    key={`room-meeting-kiosk-lang-${opt.key}`}
                                    type="button"
                                    onClick={() =>
                                      setRoomMeetingsTimelineBookingDetail((prev) =>
                                        prev ? { ...prev, kioskLanguage: opt.key as any } : prev
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                                      active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span>{opt.flag}</span>
                                    <span>{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="text-sm font-semibold text-slate-700">
                              {t({ it: 'Setup pre-riunione (min)', en: 'Pre-meeting setup (min)' })}: {roomMeetingsTimelineBookingDetail.setupBufferBeforeMin}
                              <input
                                type="range"
                                min={isMeetingInProgressEdit ? lockedPreSetupMin : 0}
                                max={maxBeforeSetupEdit}
                                step={5}
                                value={roomMeetingsTimelineBookingDetail.setupBufferBeforeMin}
                                disabled={isMeetingInProgressEdit}
                                onChange={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => {
                                    if (!prev) return prev;
                                    const desired = Math.max(0, Math.min(maxBeforeSetupEdit, Number(e.target.value) || 0));
                                    const overflow = Math.max(0, desired - freeBeforeSetupEdit);
                                    if (overflow > 0 && detailDurationMin > 1) {
                                      const borrow = Math.min(overflow, Math.max(0, detailDurationMin - 1));
                                      const baseStart = String(prev.startTime || '');
                                      const [hh, mm] = baseStart.split(':').map((v) => Number(v));
                                      if (Number.isFinite(hh) && Number.isFinite(mm)) {
                                        const dt = new Date(2000, 0, 1, hh, mm, 0, 0);
                                        dt.setMinutes(dt.getMinutes() + borrow);
                                        const startTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                                        return { ...prev, startTime, setupBufferBeforeMin: desired };
                                      }
                                    }
                                    return { ...prev, setupBufferBeforeMin: desired };
                                  })
                                }
                                className="mt-2 w-full"
                              />
                              {isMeetingInProgressEdit ? (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {t({
                                    it: 'Meeting in corso: il setup pre-riunione non è modificabile.',
                                    en: 'Meeting in progress: pre-meeting setup cannot be changed.'
                                  })}
                                </div>
                              ) : null}
                              <div className="mt-1 text-[11px] text-slate-500">
                                {prevNeighbor
                                  ? t({
                                      it: `Max ${maxBeforeSetupEdit} min (considerando meeting precedente ${new Date(prevNeighbor.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(prevNeighbor.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                                      en: `Max ${maxBeforeSetupEdit} min (considering previous meeting ${new Date(prevNeighbor.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(prevNeighbor.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                    })
                                  : t({ it: 'Nessun meeting precedente: max 60 min.', en: 'No previous meeting: max 60 min.' })}
                              </div>
                            </label>
                            <label className="text-sm font-semibold text-slate-700">
                              {t({ it: 'Setup post-riunione (min)', en: 'Post-meeting setup (min)' })}: {roomMeetingsTimelineBookingDetail.setupBufferAfterMin}
                              <input
                                type="range"
                                min={isMeetingInProgressEdit ? lockedPostSetupMin : 0}
                                max={Math.max(maxAfterSetupEdit, isMeetingInProgressEdit ? lockedPostSetupMin : 0)}
                                step={5}
                                value={roomMeetingsTimelineBookingDetail.setupBufferAfterMin}
                                onChange={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => {
                                    if (!prev) return prev;
                                    const minAllowed = isMeetingInProgressEdit ? lockedPostSetupMin : 0;
                                    const maxAllowed = Math.max(maxAfterSetupEdit, minAllowed);
                                    const desired = Math.max(minAllowed, Math.min(maxAllowed, Number(e.target.value) || 0));
                                    const overflow = Math.max(0, desired - freeAfterSetupEdit);
                                    if (overflow > 0 && detailDurationMin > 1) {
                                      const borrow = Math.min(overflow, Math.max(0, detailDurationMin - 1));
                                      const baseEnd = String(prev.endTime || '');
                                      const [hh, mm] = baseEnd.split(':').map((v) => Number(v));
                                      if (Number.isFinite(hh) && Number.isFinite(mm)) {
                                        const dt = new Date(2000, 0, 1, hh, mm, 0, 0);
                                        dt.setMinutes(dt.getMinutes() - borrow);
                                        const endTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                                        return { ...prev, endTime, setupBufferAfterMin: desired };
                                      }
                                    }
                                    return { ...prev, setupBufferAfterMin: desired };
                                  })
                                }
                                className="mt-2 w-full"
                              />
                              {isMeetingInProgressEdit ? (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {t({
                                    it: 'Meeting in corso: puoi solo aumentare il setup post-riunione.',
                                    en: 'Meeting in progress: you can only increase post-meeting setup.'
                                  })}
                                </div>
                              ) : null}
                              <div className="mt-1 text-[11px] text-slate-500">
                                {nextNeighbor
                                  ? t({
                                      it: `Max ${maxAfterSetupEdit} min (prima del meeting successivo ${new Date(nextNeighbor.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(nextNeighbor.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                                      en: `Max ${maxAfterSetupEdit} min (before next meeting ${new Date(nextNeighbor.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(nextNeighbor.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                    })
                                  : t({ it: 'Nessun meeting successivo: max 60 min.', en: 'No next meeting: max 60 min.' })}
                              </div>
                            </label>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-ink">{t({ it: 'Partecipanti', en: 'Participants' })}</div>
                              <button
                                type="button"
                                onClick={openRoomMeetingEditParticipantsModal}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Users size={14} className="mr-1 inline-block" />
                                {t({ it: 'Gestisci partecipanti', en: 'Manage participants' })}
                              </button>
                            </div>
                            <div className="text-xs text-slate-500">
                              {t({
                                it: `Posti richiesti (in sede): ${requestedSeatsPreview} · Interni remoti: ${remoteInternal} · Ospiti remoti: ${remoteManual}`,
                                en: `Requested seats (on-site): ${requestedSeatsPreview} · Remote internal: ${remoteInternal} · Remote guests: ${remoteManual}`
                              })}
                            </div>
                            <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-auto rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1.5">
                              {detail.participantsDraft.length ? (
                                detail.participantsDraft.map((p) => {
                                  const checkTag = p.kind === 'manual' ? 'EXT' : p.optional ? 'OPT' : 'INT';
                                  const checkKey = meetingCheckInEntryKey({
                                    tag: checkTag,
                                    label: String(p.fullName || '').trim(),
                                    email: p.email ? String(p.email) : null
                                  });
                                  const hasCheckIn = !!bookingCheckMap[checkKey];
                                  const checkInAt = Number(bookingCheckTsMap[checkKey] || 0) || null;
                                  const canRemoveParticipant = !(hasMeetingStartedEdit && hasCheckIn);
                                  const startAtLabel = new Date(Number(detail.booking.startAt || 0)).toLocaleString();
                                  const checkAtLabel = checkInAt ? new Date(checkInAt).toLocaleString() : t({ it: 'non effettuato', en: 'not done' });
                                  return (
                                    <span
                                      key={`meeting-edit-chip-${p.key}`}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                                        hasMeetingStartedEdit && hasCheckIn
                                          ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                          : p.kind === 'manual'
                                            ? 'border-violet-200 bg-violet-50 text-violet-800'
                                            : 'border-slate-200 bg-slate-50 text-slate-700'
                                      }`}
                                      title={t({
                                        it: `Inizio riunione: ${startAtLabel} • Check-in: ${checkAtLabel}`,
                                        en: `Meeting start: ${startAtLabel} • Check-in: ${checkAtLabel}`
                                      })}
                                    >
                                      <span className="truncate">{p.fullName}</span>
                                      {p.kind === 'manual' ? <span className="text-[10px] font-bold">EXT</span> : null}
                                      {hasMeetingStartedEdit && hasCheckIn ? (
                                        <span className="text-[10px] font-bold">{t({ it: 'OK', en: 'OK' })}</span>
                                      ) : null}
                                      {canRemoveParticipant ? (
                                        <button
                                          type="button"
                                          onClick={(evt) => {
                                            evt.preventDefault();
                                            evt.stopPropagation();
                                            removeTimelineMeetingParticipant(p.key);
                                          }}
                                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                          title={t({ it: 'Rimuovi partecipante', en: 'Remove participant' })}
                                        >
                                          <X size={10} />
                                        </button>
                                      ) : null}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-slate-500">{t({ it: 'Nessun partecipante configurato.', en: 'No participants configured.' })}</span>
                              )}
                            </div>
                          </div>
                          <Transition show={roomMeetingEditParticipantsModalOpen} as={Fragment}>
                            <div
                              className="fixed inset-0 z-[96] pointer-events-none"
                              role="dialog"
                              aria-modal="true"
                              aria-label={t({ it: 'Gestisci partecipanti meeting', en: 'Manage meeting participants' })}
                            >
                              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                                <div
                                  className="pointer-events-auto fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (roomMeetingEditBusinessPartnersModalOpen) return;
                                    if (Date.now() < roomMeetingEditParticipantsCloseGuardUntilRef.current) return;
                                    closeRoomMeetingEditParticipantsModal();
                                  }}
                                />
                              </Transition.Child>
                              <div
                                className="pointer-events-auto fixed inset-0 overflow-y-auto"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex min-h-full items-center justify-center p-4">
                                  <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                    <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                                        <div>
                                          <h2 className="text-lg font-semibold text-ink">{t({ it: 'Gestisci partecipanti', en: 'Manage participants' })}</h2>
                                          <div className="text-xs text-slate-500">
                                            {t({
                                              it: 'Aggiungi utenti reali e altri ospiti. Premi OK per tornare alla modifica meeting.',
                                              en: 'Add real users and other guests. Press OK to return to meeting edit.'
                                            })}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={closeRoomMeetingEditParticipantsModal}
                                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                                        >
                                          <X size={18} />
                                        </button>
                                      </div>
                                      <div className="mt-3 space-y-3">
                                        <div>
                                          <div className="relative">
                                            <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                                            <input
                                              ref={roomMeetingEditParticipantsNameInputRef}
                                              value={detail.participantFilter}
                                              onChange={(e) =>
                                                setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, participantFilter: e.target.value } : prev))
                                              }
                                              placeholder={t({ it: 'Filtra utenti reali...', en: 'Filter real users...' })}
                                              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
                                            />
                                          </div>
                                          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                                            <div className="mb-1 grid grid-cols-[auto,minmax(0,1.2fr),minmax(0,1.1fr),minmax(0,0.8fr),84px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                              <span />
                                              <span>{t({ it: 'Nome', en: 'Name' })}</span>
                                              <span>{t({ it: 'Email', en: 'Email' })}</span>
                                              <span>{t({ it: 'Reparto', en: 'Department' })}</span>
                                              <span>{t({ it: 'Telefono', en: 'Phone' })}</span>
                                            </div>
                                            <div className="max-h-56 space-y-1 overflow-auto">
                                              {filteredCandidates.map((candidate) => {
                                                const selected = selectedRealIds.has(String(candidate.externalId));
                                                return (
                                                  <div
                                                    key={`cand-${candidate.externalId}`}
                                                    className="grid grid-cols-[auto,minmax(0,1.2fr),minmax(0,1.1fr),minmax(0,0.8fr),84px] items-center gap-2 px-1 text-sm"
                                                  >
                                                    <button
                                                      type="button"
                                                      onClick={() => addTimelineMeetingRealParticipant(candidate.externalId)}
                                                      disabled={selected}
                                                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                                                        selected
                                                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                                          : 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                      }`}
                                                      title={selected ? t({ it: 'Già selezionato', en: 'Already selected' }) : t({ it: 'Aggiungi', en: 'Add' })}
                                                    >
                                                      <Plus size={12} />
                                                    </button>
                                                    <span className="truncate text-slate-700">{candidate.fullName}</span>
                                                    <span className="truncate text-xs text-slate-500">{candidate.email || 'no email'}</span>
                                                    <button
                                                      type="button"
                                                      onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        const dept = String((candidate as any).department || '').trim();
                                                        if (!dept) return;
                                                        const rows = filteredCandidates.filter(
                                                          (row) =>
                                                            String((row as any).department || '').trim().toLowerCase() === dept.toLowerCase()
                                                        );
                                                        if (!rows.length) return;
                                                        setRoomMeetingsTimelineBookingDetail((prev) => {
                                                          if (!prev) return prev;
                                                          const existing = new Set(
                                                            prev.participantsDraft
                                                              .filter((p) => p.kind === 'real_user' && p.externalId)
                                                              .map((p) => String(p.externalId))
                                                          );
                                                          const toAdd = rows
                                                            .filter((row) => !existing.has(String(row.externalId)))
                                                            .map((row) => ({
                                                              key: `real:${row.externalId}`,
                                                              kind: 'real_user' as const,
                                                              externalId: row.externalId,
                                                              fullName: row.fullName,
                                                              email: row.email,
                                                              optional: false,
                                                              remote: false,
                                                              company: null
                                                            }));
                                                          if (!toAdd.length) return prev;
                                                          return { ...prev, participantsDraft: [...prev.participantsDraft, ...toAdd] };
                                                        });
                                                        push(
                                                          t({ it: `Reparto aggiunto: ${dept}`, en: `Department added: ${dept}` }),
                                                          'success'
                                                        );
                                                      }}
                                                      className="truncate rounded-md px-1.5 py-1 text-left text-xs text-slate-600 hover:bg-slate-100"
                                                      title={t({
                                                        it: 'Tasto destro per aggiungere tutto il reparto visibile nel filtro',
                                                        en: 'Right click to add the whole department visible in the filter'
                                                      })}
                                                    >
                                                      {(candidate as any).department || '—'}
                                                    </button>
                                                    <span className="truncate text-xs text-slate-500">{(candidate as any).phone || '—'}</span>
                                                  </div>
                                                );
                                              })}
                                              {!filteredCandidates.length ? (
                                                <div className="text-xs text-slate-500">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div>
                                              ) : null}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="max-h-52 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                                          {detail.participantsDraft.map((p) => (
                                            (() => {
                                              const checkTag = p.kind === 'manual' ? 'EXT' : p.optional ? 'OPT' : 'INT';
                                              const checkKey = meetingCheckInEntryKey({
                                                tag: checkTag,
                                                label: String(p.fullName || '').trim(),
                                                email: p.email ? String(p.email) : null
                                              });
                                              const hasCheckIn = !!bookingCheckMap[checkKey];
                                              const checkInAt = Number(bookingCheckTsMap[checkKey] || 0) || null;
                                              const canRemoveParticipant = !(hasMeetingStartedEdit && hasCheckIn);
                                              const startAtLabel = new Date(Number(detail.booking.startAt || 0)).toLocaleString();
                                              const checkAtLabel = checkInAt ? new Date(checkInAt).toLocaleString() : t({ it: 'non effettuato', en: 'not done' });
                                              return (
                                                <div
                                                  key={p.key}
                                                  className={`grid grid-cols-[minmax(0,1fr),auto] items-center gap-2 rounded-lg border px-2 py-1.5 ${
                                                    hasMeetingStartedEdit && hasCheckIn
                                                      ? 'border-emerald-200 bg-emerald-50'
                                                      : 'border-slate-100 bg-white'
                                                  }`}
                                                  title={t({
                                                    it: `Inizio riunione: ${startAtLabel} • Check-in: ${checkAtLabel}`,
                                                    en: `Meeting start: ${startAtLabel} • Check-in: ${checkAtLabel}`
                                                  })}
                                                >
                                                  <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                      <span className={`truncate text-sm font-medium uppercase tracking-[0.02em] ${p.kind === 'manual' ? 'text-violet-800' : 'text-slate-700'}`}>
                                                        {p.fullName}
                                                      </span>
                                                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${p.kind === 'manual' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                                                        {p.kind === 'manual' ? t({ it: 'OSP', en: 'GST' }) : t({ it: 'INT', en: 'INT' })}
                                                      </span>
                                                      {hasMeetingStartedEdit && hasCheckIn ? (
                                                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                                          {t({ it: 'CHECK-IN', en: 'CHECK-IN' })}
                                                        </span>
                                                      ) : null}
                                                      {p.optional ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">OPT</span> : null}
                                                      {p.remote ? <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">REM</span> : null}
                                                      {p.company ? <span className="truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{p.company}</span> : null}
                                                    </div>
                                                    <div className="truncate text-xs text-slate-500">{p.email || (p.kind === 'manual' ? t({ it: 'Ospite senza email', en: 'Guest without email' }) : 'no email')}</div>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleTimelineMeetingParticipantFlag(p.key, 'optional')}
                                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.optional ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                                                    >
                                                      {t({ it: 'Facolt.', en: 'Optional' })}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleTimelineMeetingParticipantFlag(p.key, 'remote')}
                                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.remote ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}
                                                    >
                                                      {t({ it: 'Remoto', en: 'Remote' })}
                                                    </button>
                                                    {canRemoveParticipant ? (
                                                      <button
                                                        type="button"
                                                        onClick={() => removeTimelineMeetingParticipant(p.key)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                        title={t({ it: 'Rimuovi', en: 'Remove' })}
                                                      >
                                                        <X size={12} />
                                                      </button>
                                                    ) : (
                                                      <span
                                                        className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                                                        title={t({
                                                          it: 'Partecipante già in check-in: non removibile durante la riunione.',
                                                          en: 'Participant already checked-in: cannot be removed during meeting.'
                                                        })}
                                                      >
                                                        {t({ it: 'LOCK', en: 'LOCK' })}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })()
                                          ))}
                                          {!detail.participantsDraft.length ? (
                                            <div className="text-xs text-slate-500">{t({ it: 'Nessun partecipante configurato.', en: 'No participants configured.' })}</div>
                                          ) : null}
                                        </div>

                                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {t({ it: 'Altri ospiti', en: 'Other guests' })}
                                          </div>
                                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,1fr]">
                                            <input
                                              value={detail.manualParticipantName}
                                              onChange={(e) =>
                                                setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, manualParticipantName: e.target.value } : prev))
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  addTimelineMeetingManualParticipant();
                                                }
                                              }}
                                              placeholder={t({ it: 'Altri ospiti', en: 'Other guests' })}
                                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            />
                                            <div className="flex items-center gap-2">
                                              <select
                                                value={
                                                  roomMeetingEditManualCompanyIsOther
                                                    ? '__OTHER__'
                                                    : clientBusinessPartnerNames.includes(String(detail.manualParticipantCompany || '').trim())
                                                      ? String(detail.manualParticipantCompany || '').trim()
                                                      : ''
                                                }
                                                onChange={(e) => {
                                                  const value = e.target.value;
                                                  if (value === '__OTHER__') {
                                                    setRoomMeetingEditManualCompanyIsOther(true);
                                                    setRoomMeetingsTimelineBookingDetail((prev) =>
                                                      prev ? { ...prev, manualParticipantCompany: '' } : prev
                                                    );
                                                    return;
                                                  }
                                                  setRoomMeetingEditManualCompanyIsOther(false);
                                                  setRoomMeetingsTimelineBookingDetail((prev) =>
                                                    prev ? { ...prev, manualParticipantCompany: value } : prev
                                                  );
                                                }}
                                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                              >
                                                <option value="">{t({ it: 'Azienda (opzionale)', en: 'Company (optional)' })}</option>
                                                {clientBusinessPartnerNames.map((name) => (
                                                  <option key={`planview-bp-opt-${name}`} value={name}>
                                                    {name}
                                                  </option>
                                                ))}
                                                <option value="__OTHER__">{t({ it: 'Altro', en: 'Other' })}</option>
                                              </select>
                                              {canOpenBusinessPartnersDirectory ? (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setRoomMeetingEditBusinessPartnersModalOpen(true);
                                                  }}
                                                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700 hover:bg-slate-50"
                                                  title={t({ it: 'Apri rubrica Business Partner', en: 'Open Business Partner directory' })}
                                                >
                                                  <Building2 size={14} />
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                          {roomMeetingEditManualCompanyIsOther ? (
                                            <div className="mt-2">
                                              <input
                                                value={detail.manualParticipantCompany}
                                                onChange={(e) =>
                                                  setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, manualParticipantCompany: e.target.value } : prev))
                                                }
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    addTimelineMeetingManualParticipant();
                                                  }
                                                }}
                                                placeholder={t({ it: 'Nome azienda (Altro)', en: 'Company name (Other)' })}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                              />
                                            </div>
                                          ) : null}
                                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
                                            <input
                                              value={detail.manualParticipantEmail}
                                              onChange={(e) =>
                                                setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, manualParticipantEmail: e.target.value } : prev))
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  addTimelineMeetingManualParticipant();
                                                }
                                              }}
                                              placeholder={t({ it: 'Email (opzionale)', en: 'Email (optional)' })}
                                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            />
                                            <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                                              <input
                                                type="checkbox"
                                                checked={detail.manualParticipantOptional}
                                                onChange={(e) =>
                                                  setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, manualParticipantOptional: e.target.checked } : prev))
                                                }
                                              />
                                              {t({ it: 'Facolt.', en: 'Optional' })}
                                            </label>
                                            <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                                              <input
                                                type="checkbox"
                                                checked={detail.manualParticipantRemote}
                                                onChange={(e) =>
                                                  setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, manualParticipantRemote: e.target.checked } : prev))
                                                }
                                              />
                                              {t({ it: 'Remoto', en: 'Remote' })}
                                            </label>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                addTimelineMeetingManualParticipant();
                                              }}
                                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                              {t({ it: 'Aggiungi', en: 'Add' })}
                                            </button>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                                          <button
                                            type="button"
                                            onClick={closeRoomMeetingEditParticipantsModal}
                                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                          >
                                            {t({ it: 'OK', en: 'OK' })}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </Transition.Child>
                                </div>
                              </div>
                            </div>
                          </Transition>
                          <div className="text-xs text-slate-500">
                            {t({
                              it: `${onsiteInternal} interni in sede · ${remoteInternal} interni remoti · ${onsiteManual} ospiti in sede · ${remoteManual} ospiti remoti`,
                              en: `${onsiteInternal} on-site internal · ${remoteInternal} remote internal · ${onsiteManual} on-site guests · ${remoteManual} remote guests`
                            })}
                          </div>
                          <label className="block text-sm font-semibold text-slate-700">
                            {t({ it: 'Video conference LINK', en: 'Video conference LINK' })}
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                value={roomMeetingsTimelineBookingDetail.videoConferenceLink}
                                onChange={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, videoConferenceLink: e.target.value } : prev))
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const url = String(roomMeetingsTimelineBookingDetail.videoConferenceLink || '').trim();
                                  if (!url) return;
                                  const finalUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
                                  window.open(finalUrl, '_blank', 'noopener,noreferrer');
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                title={t({ it: 'Apri link', en: 'Open link' })}
                              >
                                <Globe size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const url = String(roomMeetingsTimelineBookingDetail.videoConferenceLink || '').trim();
                                  if (!url) return;
                                  try {
                                    await navigator.clipboard.writeText(url);
                                    push(t({ it: 'Link copiato.', en: 'Link copied.' }), 'success');
                                  } catch {
                                    push(t({ it: 'Copia link non riuscita.', en: 'Failed to copy link.' }), 'danger');
                                  }
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                title={t({ it: 'Copia link', en: 'Copy link' })}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={3}
                              value={roomMeetingsTimelineBookingDetail.notes}
                              onChange={(e) =>
                                setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </label>
                              </>
                            );
                          })()}
                          {roomMeetingsTimelineBookingDetail.booking.multiDayGroupId ? (
                            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={roomMeetingsTimelineBookingDetail.applyToSeries}
                                onChange={(e) =>
                                  setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, applyToSeries: e.target.checked } : prev))
                                }
                              />
                              {t({ it: 'Applica modifiche a tutta la serie multi-giorno', en: 'Apply changes to the whole multi-day series' })}
                            </label>
                          ) : null}
                          {roomMeetingsTimelineBookingDetail.applyToSeries && roomMeetingsTimelineBookingDetail.booking.multiDayGroupId ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              {t({
                                it: 'Modalità serie: la data della singola occorrenza resta invariata per ogni giorno della serie; vengono applicati oggetto/orari/note/link/setup.',
                                en: 'Series mode: each occurrence keeps its own date; subject/time/notes/link/setup are applied across the series.'
                              })}
                            </div>
                          ) : null}
                          {roomMeetingsTimelineBookingDetail.error ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                              {roomMeetingsTimelineBookingDetail.error}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (roomMeetingsTimelineBookingDetail.returnToMeetingNotes) {
                                  closeRoomMeetingBookingDetail();
                                  return;
                                }
                                setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, mode: 'view', saving: false, error: null } : prev));
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t({ it: 'Annulla', en: 'Cancel' })}
                            </button>
                            <button
                              type="button"
                              onClick={saveRoomMeetingBookingEdit}
                              disabled={roomMeetingsTimelineBookingDetail.saving}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                            >
                              {roomMeetingsTimelineBookingDetail.saving ? t({ it: 'Salvataggio...', en: 'Saving...' }) : t({ it: 'Salva modifiche', en: 'Save changes' })}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
  );
};

export default RoomMeetingBookingDetailPanel;
