import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, Copy, Eye, Loader2, Pencil, Plus, Search, Trash, X } from 'lucide-react';
import { currentLocalIsoDay } from '../../utils/localDate';
import { getMeetingRoomActiveToneClass, getMeetingTimelineDayClasses, isApprovedMeetingInProgress } from '../../utils/meetingTime';
import { usePlanView } from './usePlanView';

type PlanRoomMeetingsTimelineModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'basePlan' | 'client' | 'closeRoomMeetingsTimelineModal' | 'extendRoomMeetingBooking' | 'jumpToTimelineMeetingFromSearch' | 'meetingManagerOpen' | 'openMeetingManager' | 'openRoomMeetingBookingDetail' | 'openRoomMeetingDuplicateModal' | 'planId' | 'promptDeleteRoomMeetingBooking' | 'reloadRoomMeetingsTimeline' | 'roomMeetingDuplicateModal' | 'roomMeetingExtendBusyId' | 'roomMeetingsTimelineBookingDetail' | 'roomMeetingsTimelineDetailCloseGuardUntilRef' | 'roomMeetingsTimelineHighlightBookingId' | 'roomMeetingsTimelineModal' | 'roomMeetingsTimelineScrollRef' | 'roomMeetingsTimelineSearchActiveIndex' | 'roomMeetingsTimelineSearchError' | 'roomMeetingsTimelineSearchInputRef' | 'roomMeetingsTimelineSearchLoading' | 'roomMeetingsTimelineSearchResults' | 'roomMeetingsTimelineSearchTerm' | 'roomMeetingTimelineContextMenu' | 'roomMeetingTimelineContextMenuRef' | 'setHighlightRoom' | 'setRoomMeetingsTimelineModal' | 'setRoomMeetingsTimelineSearchActiveIndex' | 'setRoomMeetingsTimelineSearchError' | 'setRoomMeetingsTimelineSearchResults' | 'setRoomMeetingsTimelineSearchTerm' | 'setRoomMeetingTimelineContextMenu' | 'shiftIsoDay' | 'site' | 't'
>;

/** Room meetings timeline modal (day agenda, search, per-booking actions). Extracted from PlanViewView.tsx. */
export const PlanRoomMeetingsTimelineModal = ({
  basePlan,
  client,
  closeRoomMeetingsTimelineModal,
  extendRoomMeetingBooking,
  jumpToTimelineMeetingFromSearch,
  meetingManagerOpen,
  openMeetingManager,
  openRoomMeetingBookingDetail,
  openRoomMeetingDuplicateModal,
  planId,
  promptDeleteRoomMeetingBooking,
  reloadRoomMeetingsTimeline,
  roomMeetingDuplicateModal,
  roomMeetingExtendBusyId,
  roomMeetingsTimelineBookingDetail,
  roomMeetingsTimelineDetailCloseGuardUntilRef,
  roomMeetingsTimelineHighlightBookingId,
  roomMeetingsTimelineModal,
  roomMeetingsTimelineScrollRef,
  roomMeetingsTimelineSearchActiveIndex,
  roomMeetingsTimelineSearchError,
  roomMeetingsTimelineSearchInputRef,
  roomMeetingsTimelineSearchLoading,
  roomMeetingsTimelineSearchResults,
  roomMeetingsTimelineSearchTerm,
  roomMeetingTimelineContextMenu,
  roomMeetingTimelineContextMenuRef,
  setHighlightRoom,
  setRoomMeetingsTimelineModal,
  setRoomMeetingsTimelineSearchActiveIndex,
  setRoomMeetingsTimelineSearchError,
  setRoomMeetingsTimelineSearchResults,
  setRoomMeetingsTimelineSearchTerm,
  setRoomMeetingTimelineContextMenu,
  shiftIsoDay,
  site,
  t,
}: PlanRoomMeetingsTimelineModalProps) => (
      <Transition show={!!roomMeetingsTimelineModal && !meetingManagerOpen && !roomMeetingDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[75]"
          onClose={() => {
            if (meetingManagerOpen) return;
            if (roomMeetingsTimelineBookingDetail) return;
            if (Date.now() < roomMeetingsTimelineDetailCloseGuardUntilRef.current) return;
            closeRoomMeetingsTimelineModal();
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
                <Dialog.Panel className="w-full max-w-[1320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Mostra meetings', en: 'Show meetings' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {(client?.shortName || client?.name || '-') + ' • ' + (site?.name || '-') + ' • ' + (roomMeetingsTimelineModal?.roomName || '-')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeRoomMeetingsTimelineModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[420px,minmax(0,1fr),auto]">
                    <div className="grid grid-cols-[auto,220px,auto] items-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextDay = shiftIsoDay(roomMeetingsTimelineModal?.day || currentLocalIsoDay(), -1);
                          setRoomMeetingsTimelineModal((prev) => (prev ? { ...prev, day: nextDay } : prev));
                          if (roomMeetingsTimelineModal?.roomId) void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, nextDay);
                        }}
                        className="h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Giorno precedente', en: 'Previous day' })}
                      >
                        <ChevronLeft size={16} />
                      </button>
                    <label className="text-xs font-semibold text-slate-600">
                      {t({ it: 'Data', en: 'Date' })}
                      <input
                        type="date"
                        value={roomMeetingsTimelineModal?.day || currentLocalIsoDay()}
                        onChange={(e) => {
                          const nextDay = e.target.value || currentLocalIsoDay();
                          setRoomMeetingsTimelineModal((prev) => (prev ? { ...prev, day: nextDay } : prev));
                          if (roomMeetingsTimelineModal?.roomId) void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, nextDay);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextDay = shiftIsoDay(roomMeetingsTimelineModal?.day || currentLocalIsoDay(), 1);
                          setRoomMeetingsTimelineModal((prev) => (prev ? { ...prev, day: nextDay } : prev));
                          if (roomMeetingsTimelineModal?.roomId) void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, nextDay);
                        }}
                        className="h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Giorno successivo', en: 'Next day' })}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="relative">
                      <label className="text-xs font-semibold text-slate-600">
                        {t({ it: 'Ricerca meeting (ID o titolo)', en: 'Search meeting (ID or title)' })}
                      </label>
                      <div className="relative mt-1">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={roomMeetingsTimelineSearchInputRef}
                          value={roomMeetingsTimelineSearchTerm}
                          onChange={(e) => {
                            setRoomMeetingsTimelineSearchTerm(e.target.value);
                            setRoomMeetingsTimelineSearchActiveIndex(-1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setRoomMeetingsTimelineSearchActiveIndex((prev) =>
                                Math.min((roomMeetingsTimelineSearchResults.length || 1) - 1, Math.max(0, prev + 1))
                              );
                              return;
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setRoomMeetingsTimelineSearchActiveIndex((prev) =>
                                Math.max(0, prev <= 0 ? 0 : prev - 1)
                              );
                              return;
                            }
                            if (e.key === 'Enter') {
                              const candidate = roomMeetingsTimelineSearchResults[roomMeetingsTimelineSearchActiveIndex];
                              if (candidate) {
                                e.preventDefault();
                                jumpToTimelineMeetingFromSearch(candidate);
                              }
                            }
                            if (e.key === 'Escape') {
                              setRoomMeetingsTimelineSearchTerm('');
                              setRoomMeetingsTimelineSearchResults([]);
                              setRoomMeetingsTimelineSearchActiveIndex(-1);
                              setRoomMeetingsTimelineSearchError(null);
                            }
                          }}
                          placeholder={t({ it: 'Es. #104 o Budget review', en: 'e.g. #104 or Budget review' })}
                          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                        />
                        {roomMeetingsTimelineSearchLoading ? (
                          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                        ) : null}
                      </div>
                      {String(roomMeetingsTimelineSearchTerm || '').trim() ? (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {roomMeetingsTimelineSearchError ? (
                            <div className="px-3 py-2 text-xs font-semibold text-rose-600">{roomMeetingsTimelineSearchError}</div>
                          ) : null}
                          {!roomMeetingsTimelineSearchLoading && !roomMeetingsTimelineSearchError && !roomMeetingsTimelineSearchResults.length ? (
                            <div className="px-3 py-2 text-xs text-slate-500">
                              {t({ it: 'Nessun risultato.', en: 'No results.' })}
                            </div>
                          ) : null}
                          {roomMeetingsTimelineSearchResults.map((row, index) => {
                            const isActive = index === roomMeetingsTimelineSearchActiveIndex;
                            const startAt = Number(row.booking.startAt || 0);
                            const endAt = Number(row.booking.endAt || 0);
                            const meetingNumber = Number((row.booking as any)?.meetingNumber || 0);
                            return (
                              <button
                                key={`timeline-search-${row.booking.id}`}
                                type="button"
                                onMouseEnter={() => setRoomMeetingsTimelineSearchActiveIndex(index)}
                                onClick={() => jumpToTimelineMeetingFromSearch(row)}
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
                                  {t({ it: 'Partecipanti', en: 'Participants' })}: {row.participantsCount} • {row.participantsLabel}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!roomMeetingsTimelineModal?.roomId) return;
                          openMeetingManager({
                            roomId: roomMeetingsTimelineModal.roomId,
                            floorPlanId: planId,
                            siteId: site?.id,
                            clientId: client?.id,
                            day: roomMeetingsTimelineModal.day
                          });
                        }}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        title={t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      >
                        <Plus size={14} className="mr-1 inline-block" />
                        {t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (roomMeetingsTimelineModal?.roomId) {
                            void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, roomMeetingsTimelineModal.day);
                          }
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Aggiorna', en: 'Refresh' })}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {roomMeetingsTimelineModal?.error ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {roomMeetingsTimelineModal.error}
                      </div>
                    ) : null}
                    <div ref={roomMeetingsTimelineScrollRef} className="overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 bg-white">
                      {(() => {
                        const modal = roomMeetingsTimelineModal;
                        const bookings = modal?.bookings || [];
                        let minMinutes = 7 * 60;
                        let maxMinutes = 20 * 60;
                        for (const booking of bookings) {
                          const s = new Date(Number(booking.startAt || 0));
                          const e = new Date(Number(booking.endAt || 0));
                          if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) continue;
                          minMinutes = Math.min(minMinutes, s.getHours() * 60 + s.getMinutes());
                          maxMinutes = Math.max(maxMinutes, e.getHours() * 60 + e.getMinutes());
                        }
                        minMinutes = Math.max(0, Math.floor((minMinutes - 30) / 60) * 60);
                        maxMinutes = Math.min(24 * 60, Math.ceil((maxMinutes + 30) / 60) * 60);
                        if (maxMinutes - minMinutes < 6 * 60) maxMinutes = Math.min(24 * 60, minMinutes + 6 * 60);
                        const total = Math.max(1, maxMinutes - minMinutes);
                        const hourCount = Math.max(1, Math.ceil((maxMinutes - minMinutes) / 60));
                        const hours = Array.from({ length: hourCount + 1 }, (_, i) => minMinutes + i * 60);
                        const timelineWidthPx = Math.max(980, hourCount * 120);
                        const selectedDay = String(modal?.day || '');
                        const nowDate = new Date();
                        const todayIso = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
                        const showNow = selectedDay === todayIso;
                        const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
                        return (
                          <div className="min-w-[1220px]" style={{ width: `${240 + timelineWidthPx}px` }}>
                            <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `240px ${timelineWidthPx}px` }}>
                              <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {t({ it: 'Meeting room', en: 'Meeting room' })}
                              </div>
                              <div className="relative h-12 overflow-hidden" style={{ width: `${timelineWidthPx}px` }}>
                                {hours.map((minute) => {
                                  const left = ((minute - minMinutes) / total) * 100;
                                  return (
                                    <div key={`rm-hour-${minute}`} className="absolute inset-y-0" style={{ left: `${left}%` }}>
                                      <div className="h-full border-l border-slate-200" />
                                    </div>
                                  );
                                })}
                                {hours.slice(0, -1).map((minute) => {
                                  const left = (((minute + 30) - minMinutes) / total) * 100;
                                  return (
                                    <div key={`rm-hour-label-${minute}`} className="absolute top-2 -translate-x-1/2 text-center text-[11px] font-semibold text-slate-500" style={{ left: `${left}%`, width: '70px' }}>
                                      {`${String(Math.floor(minute / 60)).padStart(2, '0')}:00`}
                                    </div>
                                  );
                                })}
                                {showNow ? (
                                  <div className="absolute inset-y-0 z-10" style={{ left: `${((nowMinutes - minMinutes) / total) * 100}%` }}>
                                    <div className="absolute top-7 left-0 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                      {t({ it: 'ORA', en: 'NOW' })}
                                    </div>
                                    <div className="h-full border-l-2 border-blue-500/70" />
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="grid" style={{ gridTemplateColumns: `240px ${timelineWidthPx}px` }}>
                              <div
                                className={`border-r px-3 py-3 ${
                                  getMeetingRoomActiveToneClass((modal?.bookings || []).some((booking) => isApprovedMeetingInProgress(booking, Date.now())))
                                }`}
                                style={{ position: 'sticky', left: 0, zIndex: 10 }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate text-base font-semibold text-ink">{modal?.roomName || '-'}</div>
                                  {modal?.roomId ? (
                                    <button
                                      type="button"
                                      onClick={(evt) => {
                                        evt.preventDefault();
                                        evt.stopPropagation();
                                        closeRoomMeetingsTimelineModal();
                                        setHighlightRoom({ roomId: modal.roomId, until: Date.now() + 3200 });
                                      }}
                                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                      title={t({ it: 'Mostra posizione stanza in planimetria', en: 'Show room on floor plan' })}
                                    >
                                      <Eye size={14} />
                                    </button>
                                  ) : null}
                                </div>
                                <div className="truncate text-xs text-slate-600">
                                  {[site?.name, String(basePlan?.name || '').trim()].filter(Boolean).join(' - ') || '-'}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  {t({ it: 'Capienza', en: 'Capacity' })}: {modal?.capacity || 0}
                                </div>
                              </div>
                              <div className="relative h-[94px] bg-white" style={{ width: `${timelineWidthPx}px` }}>
                                {hours.map((minute) => {
                                  const left = ((minute - minMinutes) / total) * 100;
                                  return <div key={`rm-grid-${minute}`} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${left}%` }} />;
                                })}
                                {showNow ? (
                                  <div className="absolute inset-y-0 z-10 border-l-2 border-blue-500/70" style={{ left: `${((nowMinutes - minMinutes) / total) * 100}%` }} />
                                ) : null}
                                {(bookings || []).map((booking) => {
                                  const s = new Date(Number(booking.startAt || 0));
                                  const e = new Date(Number(booking.endAt || 0));
                                  const es = new Date(Number((booking as any).effectiveStartAt || booking.startAt || 0));
                                  const ee = new Date(Number((booking as any).effectiveEndAt || booking.endAt || 0));
                                  const startMin = s.getHours() * 60 + s.getMinutes();
                                  const endMin = e.getHours() * 60 + e.getMinutes();
                                  const effStartMin = es.getHours() * 60 + es.getMinutes();
                                  const effEndMin = ee.getHours() * 60 + ee.getMinutes();
                                  const clampedStart = Math.max(minMinutes, Math.min(maxMinutes, startMin));
                                  const clampedEnd = Math.max(clampedStart + 1, Math.max(minMinutes, Math.min(maxMinutes, endMin)));
                                  const clampedEffStart = Math.max(minMinutes, Math.min(maxMinutes, effStartMin));
                                  const clampedEffEnd = Math.max(clampedEffStart + 1, Math.max(minMinutes, Math.min(maxMinutes, effEndMin)));
                                  const left = ((clampedStart - minMinutes) / total) * 100;
                                  const width = Math.max(1, ((clampedEnd - clampedStart) / total) * 100);
                                  const effLeft = ((clampedEffStart - minMinutes) / total) * 100;
                                  const effWidth = Math.max(1, ((clampedEffEnd - clampedEffStart) / total) * 100);
                                  const nowTs = Date.now();
                                  const { tone, blockedTone } = getMeetingTimelineDayClasses(booking.startAt, booking.endAt, nowTs);
                                  const isHighlighted = String(roomMeetingsTimelineHighlightBookingId || '') === String(booking.id || '');
                                  const meetingNumber = Number((booking as any)?.meetingNumber || 0);
                                  return (
                                    <Fragment key={booking.id}>
                                      <div
                                        className={`absolute top-1 h-[76px] rounded-lg border border-dashed ${blockedTone}`}
                                        style={{ left: `${effLeft}%`, width: `${effWidth}%` }}
                                        title={`${t({ it: 'Blocco con setup', en: 'Blocked range incl. setup' })}: ${es.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${ee.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                      />
                                      <div
                                        className={`absolute h-[52px] overflow-hidden rounded-lg border px-2 py-1 shadow-sm cursor-pointer ${tone} ${
                                          isHighlighted ? 'ring-2 ring-primary ring-offset-1' : ''
                                        }`}
                                        style={{ left: `${left}%`, width: `${width}%`, top: '12px' }}
                                        title={`${booking.subject} • ${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                        onClick={() => openRoomMeetingBookingDetail(booking)}
                                        onContextMenu={(evt) => {
                                          evt.preventDefault();
                                          evt.stopPropagation();
                                          setRoomMeetingTimelineContextMenu({
                                            x: evt.clientX,
                                            y: evt.clientY,
                                            booking
                                          });
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(evt) => {
                                          if (evt.key === 'Enter' || evt.key === ' ') {
                                            evt.preventDefault();
                                            openRoomMeetingBookingDetail(booking);
                                          }
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="min-w-0 truncate text-xs font-semibold">
                                            {meetingNumber > 0 ? `#${meetingNumber} • ` : ''}
                                            {booking.subject || t({ it: 'Meeting', en: 'Meeting' })}
                                          </div>
                                          <div className="flex shrink-0 items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={(evt) => {
                                                evt.preventDefault();
                                                evt.stopPropagation();
                                                openRoomMeetingBookingDetail(booking, 'edit');
                                              }}
                                              className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/70 text-slate-700 hover:bg-white"
                                              title={t({ it: 'Modifica meeting', en: 'Edit meeting' })}
                                            >
                                              <Pencil size={10} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(evt) => {
                                                evt.preventDefault();
                                                evt.stopPropagation();
                                                promptDeleteRoomMeetingBooking(booking);
                                              }}
                                              className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/70 text-rose-700 hover:bg-white"
                                              title={t({ it: 'Elimina meeting', en: 'Delete meeting' })}
                                            >
                                              <Trash size={10} />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="truncate text-[11px] opacity-90">
                                          {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="truncate text-[10px] opacity-80">{booking.requestedByUsername || '-'}</div>
                                      </div>
                                    </Fragment>
                                  );
                                })}
                                {!bookings.length && !modal?.loading ? (
                                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                                    {t({ it: 'Nessun meeting per la data selezionata.', en: 'No meetings for the selected date.' })}
                                  </div>
                                ) : null}
                                {modal?.loading ? (
                                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                                    {t({ it: 'Caricamento...', en: 'Loading...' })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={closeRoomMeetingsTimelineModal}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>

                  {roomMeetingTimelineContextMenu ? (
                    <div
                      ref={roomMeetingTimelineContextMenuRef}
                      className="fixed z-[90] min-w-[210px] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                      style={{ left: Math.max(12, roomMeetingTimelineContextMenu.x), top: Math.max(12, roomMeetingTimelineContextMenu.y) }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openRoomMeetingDuplicateModal(roomMeetingTimelineContextMenu.booking)}
                        className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy size={14} />
                        <span>{t({ it: 'Duplica…', en: 'Duplicate…' })}</span>
                      </button>
                      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Estendi', en: 'Extend' })}
                      </div>
                      {Number(roomMeetingTimelineContextMenu.booking.endAt || 0) <= Date.now() ? (
                        <div className="px-2 py-2 text-xs font-semibold text-slate-400">
                          {t({ it: 'Meeting concluso: estensione non consentita.', en: 'Meeting ended: extension is not allowed.' })}
                        </div>
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
                            key={`extend-${key}`}
                            type="button"
                            disabled={roomMeetingExtendBusyId === String(roomMeetingTimelineContextMenu.booking.id)}
                            onClick={() => void extendRoomMeetingBooking(roomMeetingTimelineContextMenu.booking, key as any)}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <span>{label}</span>
                            {roomMeetingExtendBusyId === String(roomMeetingTimelineContextMenu.booking.id) ? <Loader2 size={13} className="animate-spin" /> : null}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

);
