import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, Eye, Loader2, Plus, Search, X } from 'lucide-react';
import { getMeetingBookingDayToneClass, getMeetingRoomActiveToneClass, isApprovedMeetingInProgress } from '../../utils/meetingTime';
import { shiftIsoDay, todayIso, toEpochMs } from './SidebarTree.helpers';

const OPEN_MEETING_MANAGER_EVENT = 'plixmap_open_meeting_manager';

type SidebarClientMeetingsModalProps = Record<string, any> & { t: (msg: { it: string; en: string }) => string };

/** Client meetings timeline modal (agenda, search, per-booking actions). Extracted from SidebarTree.tsx. */
export const SidebarClientMeetingsModal = ({
  clientMeetingsBookingDetail,
  clientMeetingsDetailCloseGuardUntilRef,
  clientMeetingsDuplicateModal,
  clientMeetingsError,
  clientMeetingsFocusRef,
  clientMeetingsHighlightBookingId,
  clientMeetingsLoading,
  clientMeetingsModal,
  clientMeetingsNowTs,
  clientMeetingsRows,
  clientMeetingsSearchActiveIndex,
  clientMeetingsSearchError,
  clientMeetingsSearchInputRef,
  clientMeetingsSearchLoading,
  clientMeetingsSearchResults,
  clientMeetingsSearchTerm,
  clientMeetingsTimelineContextMenu,
  clientMeetingsTimelineContextMenuRef,
  clientMeetingsTimelineMeta,
  closeClientMeetingsModal,
  jumpToClientTimelineMeeting,
  openClientMeetingDuplicateModal,
  reloadClientMeetingsTimeline,
  selectedClientForMeetings,
  setClientMeetingsBookingDetail,
  setClientMeetingsModal,
  setClientMeetingsRoomPreview,
  setClientMeetingsSearchActiveIndex,
  setClientMeetingsSearchError,
  setClientMeetingsSearchResults,
  setClientMeetingsSearchTerm,
  setClientMeetingsShowCheckInDetails,
  setClientMeetingsTimelineContextMenu,
  t,
}: SidebarClientMeetingsModalProps) => {
  return (
      <Transition show={!!clientMeetingsModal && !clientMeetingsDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[90]"
          initialFocus={clientMeetingsFocusRef}
          onClose={() => {
            if (clientMeetingsBookingDetail) return;
            if (Date.now() < clientMeetingsDetailCloseGuardUntilRef.current) return;
            closeClientMeetingsModal();
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
                <Dialog.Panel className="w-full max-w-[1480px] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Mostra meetings', en: 'Show meetings' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {selectedClientForMeetings ? (selectedClientForMeetings.shortName || selectedClientForMeetings.name) : '-'}
                      </div>
                    </div>
                    <button
                      ref={clientMeetingsFocusRef}
                      type="button"
                      onClick={closeClientMeetingsModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[340px,260px,minmax(0,1fr),auto]">
                    <label className="text-xs font-semibold text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={13} /> {t({ it: 'Data', en: 'Date' })}
                      </span>
                      <div className="mt-1 grid grid-cols-[24px,1fr,24px] items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setClientMeetingsModal((prev: any) =>
                              prev ? { ...prev, day: shiftIsoDay(prev.day || todayIso(), -1) } : prev
                            )
                          }
                          className="inline-flex h-[24px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Giorno precedente', en: 'Previous day' })}
                        >
                            <ChevronLeft size={11} />
                        </button>
                        <input
                          type="date"
                          value={clientMeetingsModal?.day || todayIso()}
                          onChange={(e) =>
                            setClientMeetingsModal((prev: any) => (prev ? { ...prev, day: e.target.value || todayIso() } : prev))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setClientMeetingsModal((prev: any) =>
                              prev ? { ...prev, day: shiftIsoDay(prev.day || todayIso(), 1) } : prev
                            )
                          }
                          className="inline-flex h-[24px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Giorno successivo', en: 'Next day' })}
                        >
                            <ChevronRight size={11} />
                        </button>
                      </div>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      {t({ it: 'Sede', en: 'Site' })}
                      <select
                        value={clientMeetingsModal?.siteId || 'all'}
                        disabled={!!clientMeetingsModal?.siteLocked}
                        onChange={(e) =>
                          setClientMeetingsModal((prev: any) =>
                            prev ? { ...prev, siteId: (e.target.value as string) || 'all' } : prev
                          )
                        }
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                          clientMeetingsModal?.siteLocked
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <option value="all">{t({ it: 'Tutte le sedi', en: 'All sites' })}</option>
                        {(selectedClientForMeetings?.sites || []).map((site: any) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="relative">
                      <label className="text-xs font-semibold text-slate-600">
                        {t({ it: 'Ricerca meeting (ID o titolo)', en: 'Search meeting (ID or title)' })}
                      </label>
                      <div className="relative mt-1">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={clientMeetingsSearchInputRef}
                          value={clientMeetingsSearchTerm}
                          onChange={(e) => {
                            setClientMeetingsSearchTerm(e.target.value);
                            setClientMeetingsSearchActiveIndex(-1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setClientMeetingsSearchActiveIndex((prev: any) =>
                                Math.min((clientMeetingsSearchResults.length || 1) - 1, Math.max(0, prev + 1))
                              );
                              return;
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setClientMeetingsSearchActiveIndex((prev: any) => Math.max(0, prev <= 0 ? 0 : prev - 1));
                              return;
                            }
                            if (e.key === 'Enter') {
                              const candidate = clientMeetingsSearchResults[clientMeetingsSearchActiveIndex];
                              if (candidate) {
                                e.preventDefault();
                                jumpToClientTimelineMeeting(candidate);
                              }
                              return;
                            }
                            if (e.key === 'Escape') {
                              setClientMeetingsSearchTerm('');
                              setClientMeetingsSearchResults([]);
                              setClientMeetingsSearchActiveIndex(-1);
                              setClientMeetingsSearchError(null);
                            }
                          }}
                          placeholder={t({ it: 'Es. #104 o Budget review', en: 'e.g. #104 or Budget review' })}
                          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                        />
                        {clientMeetingsSearchLoading ? (
                          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                        ) : null}
                      </div>
                      {String(clientMeetingsSearchTerm || '').trim() ? (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {clientMeetingsSearchError ? (
                            <div className="px-3 py-2 text-xs font-semibold text-rose-600">{clientMeetingsSearchError}</div>
                          ) : null}
                          {!clientMeetingsSearchLoading && !clientMeetingsSearchError && !clientMeetingsSearchResults.length ? (
                            <div className="px-3 py-2 text-xs text-slate-500">{t({ it: 'Nessun risultato.', en: 'No results.' })}</div>
                          ) : null}
                          {clientMeetingsSearchResults.map((row: any, index: number) => {
                            const isActive = index === clientMeetingsSearchActiveIndex;
                            const meetingNumber = Number((row.booking as any)?.meetingNumber || 0);
                            const startAt = Number(row.booking.startAt || 0);
                            const endAt = Number(row.booking.endAt || 0);
                            return (
                              <button
                                key={`client-meetings-search-${row.booking.id}`}
                                type="button"
                                onMouseEnter={() => setClientMeetingsSearchActiveIndex(index)}
                                onClick={() => jumpToClientTimelineMeeting(row)}
                                className={`block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
                                  isActive ? 'bg-sky-50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                                  <span className="truncate">
                                    {meetingNumber > 0 ? `#${meetingNumber} • ` : ''}
                                    {row.booking.subject || t({ it: 'Meeting', en: 'Meeting' })}
                                  </span>
                                  <span className="shrink-0 text-slate-500">
                                    {new Date(startAt).toLocaleDateString()} •{' '}
                                    {new Date(startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-
                                    {new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  {row.siteName}
                                  {row.floorPlanName ? ` • ${row.floorPlanName}` : ''} • {row.roomName} • {t({ it: 'Partecipanti', en: 'Participants' })}:{' '}
                                  {row.participantsCount}
                                  {row.participantsLabel && row.participantsLabel !== '-' ? ` • ${row.participantsLabel}` : ''}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const selectedSiteId =
                            clientMeetingsModal?.siteId && clientMeetingsModal.siteId !== 'all'
                              ? String(clientMeetingsModal.siteId)
                              : String(selectedClientForMeetings?.sites?.[0]?.id || '');
                          const selectedSite =
                            (selectedClientForMeetings?.sites || []).find((entry: any) => String(entry.id) === selectedSiteId) ||
                            selectedClientForMeetings?.sites?.[0];
                          const selectedPlanId = String(selectedSite?.floorPlans?.[0]?.id || '');
                          setClientMeetingsModal(null);
                          window.dispatchEvent(
                            new CustomEvent(OPEN_MEETING_MANAGER_EVENT, {
                              detail: {
                                clientId: clientMeetingsModal?.clientId,
                                siteId: selectedSiteId,
                                floorPlanId: selectedPlanId,
                                day: clientMeetingsModal?.day || todayIso()
                              }
                            })
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        title={t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      >
                        <Plus size={14} />
                        {t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => reloadClientMeetingsTimeline()}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {clientMeetingsLoading ? t({ it: 'Aggiornamento...', en: 'Refreshing...' }) : t({ it: 'Aggiorna', en: 'Refresh' })}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {clientMeetingsError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {clientMeetingsError}
                      </div>
                    ) : null}
                    {!clientMeetingsError && !clientMeetingsRows.length && !clientMeetingsLoading ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                        {t({ it: 'Nessuna meeting room trovata per il filtro selezionato.', en: 'No meeting rooms found for the selected filter.' })}
                      </div>
                    ) : null}
                    {!clientMeetingsError && clientMeetingsRows.length ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="grid grid-cols-[240px,1fr] border-b border-slate-200 bg-slate-50">
                          <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t({ it: 'Meeting room', en: 'Meeting room' })}
                          </div>
                          <div className="relative overflow-hidden px-0 py-2">
                            <div className="relative h-10">
                              {clientMeetingsTimelineMeta.hours.map((minute: any) => {
                                const total = Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes);
                                const leftPct = ((minute - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                return (
                                  <div key={`h-${minute}`} className="absolute inset-y-0" style={{ left: `${leftPct}%` }}>
                                    <div className="h-full border-l border-slate-200" />
                                  </div>
                                );
                              })}
                              {clientMeetingsTimelineMeta.hours.slice(0, -1).map((minute: any) => {
                                const total = Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes);
                                const centerMinute = Math.min(clientMeetingsTimelineMeta.maxMinutes, minute + 30);
                                const leftPct = ((centerMinute - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                return (
                                  <div
                                    key={`hl-${minute}`}
                                    className="absolute top-1 -translate-x-1/2 text-center text-[11px] font-semibold text-slate-500"
                                    style={{ left: `${leftPct}%`, width: '70px' }}
                                  >
                                    {`${String(Math.floor(minute / 60)).padStart(2, '0')}:00`}
                                  </div>
                                );
                              })}
                              {clientMeetingsTimelineMeta.showNowLine ? (
                                  <div
                                    className="absolute inset-y-0 z-10"
                                    style={{
                                    left: `${((clientMeetingsTimelineMeta.nowMinutes - clientMeetingsTimelineMeta.minMinutes) /
                                      Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes)) * 100}%`
                                  }}
                                >
                                  <div className="absolute top-7 left-0 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                    {t({ it: 'ORA', en: 'NOW' })}
                                  </div>
                                  <div className="h-full border-l-2 border-blue-500/70" />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="max-h-[56vh] overflow-auto">
                          {clientMeetingsRows.map((row: any) => {
                            const total = Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes);
                            const nowTs = clientMeetingsNowTs;
                            const roomHasInProgress = (row.bookings || []).some((booking: any) => isApprovedMeetingInProgress(booking, nowTs));
                            const roomTone = getMeetingRoomActiveToneClass(roomHasInProgress);
                            return (
                              <div key={`${row.siteId}:${row.roomId}`} className="grid grid-cols-[240px,1fr] border-b border-slate-100 last:border-b-0">
                                <div className={`sticky left-0 z-10 px-3 py-2 ${roomTone}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="truncate text-sm font-semibold text-ink">{row.roomName || '-'}</div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setClientMeetingsRoomPreview({
                                          roomId: String(row.roomId),
                                          floorPlanId: String((row as any).floorPlanId || ''),
                                          siteId: String(row.siteId)
                                        });
                                      }}
                                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                      title={t({ it: 'Mostra planimetria sala', en: 'Show room floor plan' })}
                                    >
                                      <Eye size={14} />
                                    </button>
                                  </div>
                                  <div className="truncate text-xs text-slate-500">{row.siteName}</div>
                                  <div className="truncate text-xs text-slate-500">{String((row as any).floorPlanName || '')}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {t({ it: 'Capienza', en: 'Capacity' })}: {row.capacity}
                                  </div>
                                </div>
                                <div className="relative h-[66px] bg-white">
                                  {clientMeetingsTimelineMeta.hours.map((minute: any) => {
                                    const leftPct = ((minute - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                    return <div key={`${row.roomId}-grid-${minute}`} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${leftPct}%` }} />;
                                  })}
                                  {clientMeetingsTimelineMeta.showNowLine ? (
                                    <div
                                      className="absolute inset-y-0 z-10 border-l-2 border-blue-500/70"
                                      style={{
                                        left: `${((clientMeetingsTimelineMeta.nowMinutes - clientMeetingsTimelineMeta.minMinutes) / total) * 100}%`
                                      }}
                                    />
                                  ) : null}
                                  {(row.bookings || []).map((booking: any) => {
                                    const bookingStartTs = toEpochMs((booking as any).startAt);
                                    const bookingEndTs = toEpochMs((booking as any).endAt);
                                    const start = new Date(bookingStartTs || 0);
                                    const end = new Date(bookingEndTs || 0);
                                    const startMin = start.getHours() * 60 + start.getMinutes();
                                    const endMin = end.getHours() * 60 + end.getMinutes();
                                    const clampedStart = Math.max(clientMeetingsTimelineMeta.minMinutes, Math.min(clientMeetingsTimelineMeta.maxMinutes, startMin));
                                    const clampedEnd = Math.max(clampedStart + 1, Math.max(clientMeetingsTimelineMeta.minMinutes, Math.min(clientMeetingsTimelineMeta.maxMinutes, endMin)));
                                    const leftPct = ((clampedStart - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                    const widthPct = Math.max(1, ((clampedEnd - clampedStart) / total) * 100);
                                    const tone = getMeetingBookingDayToneClass(booking, nowTs);
                                    return (
                                      <div
                                        key={booking.id}
                                        className={`absolute top-2 h-[50px] overflow-hidden rounded-lg border px-2 py-1 shadow-sm ${tone} ${
                                          String(clientMeetingsHighlightBookingId || '') === String(booking.id || '')
                                            ? 'ring-2 ring-primary ring-offset-1'
                                            : ''
                                        }`}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                        onContextMenu={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          setClientMeetingsTimelineContextMenu({
                                            booking,
                                            x: event.clientX,
                                            y: event.clientY
                                          });
                                        }}
                                        onDoubleClick={() => {
                                          setClientMeetingsShowCheckInDetails(false);
                                          setClientMeetingsBookingDetail({ booking, roomName: row.roomName, siteName: row.siteName });
                                        }}
                                        title={`${booking.subject} • ${new Date(bookingStartTs || 0).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })} - ${new Date(bookingEndTs || 0).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}`}
                                      >
                                        <div className="truncate text-xs font-semibold">{booking.subject || t({ it: 'Meeting', en: 'Meeting' })}</div>
                                        <div className="truncate text-[11px] opacity-90">
                                          {new Date(bookingStartTs || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                                          {new Date(bookingEndTs || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="truncate text-[10px] opacity-80">{booking.requestedByUsername || '-'}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <Clock3 size={12} />
                      {t({
                        it: 'La linea verticale mostra l’orario attuale (solo se la data selezionata è oggi).',
                        en: 'The vertical line shows current time (only when selected date is today).'
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={closeClientMeetingsModal}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                  {clientMeetingsTimelineContextMenu ? (
                    <div
                      ref={clientMeetingsTimelineContextMenuRef}
                      className="fixed z-[97] min-w-[210px] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                      style={{
                        left: Math.max(12, Math.min(clientMeetingsTimelineContextMenu.x, window.innerWidth - 240)),
                        top: Math.max(12, Math.min(clientMeetingsTimelineContextMenu.y, window.innerHeight - 120))
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          openClientMeetingDuplicateModal(clientMeetingsTimelineContextMenu.booking);
                          setClientMeetingsTimelineContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy size={14} />
                        <span>{t({ it: 'Follow-up…', en: 'Follow-up…' })}</span>
                      </button>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
