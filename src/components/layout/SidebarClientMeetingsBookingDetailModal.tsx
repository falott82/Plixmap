import { Fragment, type MutableRefObject } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Copy, FileText, X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarClientMeetingsBookingDetailModalProps = {
  clientMeetingsBookingDetail: any;
  clientMeetingsBookingDetailFocusRef: MutableRefObject<any>;
  clientMeetingsCheckInStatusByMeetingId: Record<string, any>;
  clientMeetingsCheckInTimestampsByMeetingId: Record<string, any>;
  clientMeetingsDetailCloseGuardUntilRef: MutableRefObject<number>;
  clientMeetingsDuplicateModal: unknown;
  clientMeetingsShowCheckInDetails: boolean;
  getClientMeetingCheckInEntries: (...args: any[]) => any;
  getClientMeetingCheckInStats: (...args: any[]) => any;
  openClientMeetingDuplicateModal: (...args: any[]) => void;
  setClientMeetingsBookingDetail: (value: any) => void;
  setClientMeetingsNotesBooking: (value: any) => void;
  setClientMeetingsShowCheckInDetails: (value: any) => void;
  t: Translate;
};

/**
 * Client meetings timeline booking detail modal (status/details, check-in list,
 * duplicate/notes actions). Extracted from SidebarTree.tsx.
 */
export const SidebarClientMeetingsBookingDetailModal = ({
  clientMeetingsBookingDetail,
  clientMeetingsBookingDetailFocusRef,
  clientMeetingsCheckInStatusByMeetingId,
  clientMeetingsCheckInTimestampsByMeetingId,
  clientMeetingsDetailCloseGuardUntilRef,
  clientMeetingsDuplicateModal,
  clientMeetingsShowCheckInDetails,
  getClientMeetingCheckInEntries,
  getClientMeetingCheckInStats,
  openClientMeetingDuplicateModal,
  setClientMeetingsBookingDetail,
  setClientMeetingsNotesBooking,
  setClientMeetingsShowCheckInDetails,
  t
}: SidebarClientMeetingsBookingDetailModalProps) => {
  const boolBadge = (value: boolean) => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        value ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {value ? t({ it: 'Sì', en: 'Yes' }) : t({ it: 'No', en: 'No' })}
    </span>
  );
  return (
      <Transition show={!!clientMeetingsBookingDetail && !clientMeetingsDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[95]"
          initialFocus={clientMeetingsBookingDetailFocusRef}
          onClose={() => {
            clientMeetingsDetailCloseGuardUntilRef.current = Date.now() + 350;
            setClientMeetingsBookingDetail(null);
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
                <Dialog.Panel className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {clientMeetingsBookingDetail?.booking.subject || t({ it: 'Dettaglio meeting', en: 'Meeting details' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {clientMeetingsBookingDetail
                          ? `${clientMeetingsBookingDetail.siteName} · ${clientMeetingsBookingDetail.roomName}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clientMeetingsDetailCloseGuardUntilRef.current = Date.now() + 350;
                        setClientMeetingsBookingDetail(null);
                      }}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {clientMeetingsBookingDetail ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        [t({ it: 'Stato', en: 'Status' }), clientMeetingsBookingDetail.booking.status],
                        [t({ it: 'Data', en: 'Date' }), new Date(Number(clientMeetingsBookingDetail.booking.startAt)).toLocaleDateString()],
                        [
                          t({ it: 'Ora', en: 'Time' }),
                          `${new Date(Number(clientMeetingsBookingDetail.booking.startAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(
                            Number(clientMeetingsBookingDetail.booking.endAt)
                          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ],
                        [
                          t({ it: 'Posti', en: 'Seats' }),
                          `${clientMeetingsBookingDetail.booking.requestedSeats}/${clientMeetingsBookingDetail.booking.roomCapacity}`
                        ],
                        [t({ it: 'Richiedente', en: 'Requester' }), clientMeetingsBookingDetail.booking.requestedByUsername || '-']
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                          <div className="mt-1 text-sm font-semibold text-ink break-words">{String(value || '-')}</div>
                        </div>
                      ))}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t({ it: 'Approvazione richiesta', en: 'Approval required' })}
                        </div>
                        <div className="mt-1">{boolBadge(!!clientMeetingsBookingDetail.booking.approvalRequired)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Dotazioni', en: 'Equipment' })}</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {(clientMeetingsBookingDetail.booking.equipment || []).length
                            ? (clientMeetingsBookingDetail.booking.equipment || []).join(', ')
                            : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t({ it: 'Video conference LINK', en: 'Video conference LINK' })}
                        </div>
                        <div className="mt-1 break-all text-sm text-slate-700">
                          {clientMeetingsBookingDetail.booking.videoConferenceLink || '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Note', en: 'Notes' })}</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {clientMeetingsBookingDetail.booking.notes || '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Partecipanti', en: 'Participants' })}</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {(clientMeetingsBookingDetail.booking.participants || []).length
                            ? (clientMeetingsBookingDetail.booking.participants || [])
                                .map((p: any) => `${p.fullName || p.externalId || '-'}${p.optional ? ' (OPT)' : ''}`)
                                .join(', ')
                            : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Ospiti esterni', en: 'External guests' })}</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {(clientMeetingsBookingDetail.booking.externalGuestsDetails || []).length
                            ? (clientMeetingsBookingDetail.booking.externalGuestsDetails || [])
                                .map((g: any) => {
                                  const parts = [String(g?.name || '-').trim() || '-'];
                                  if (g?.remote) parts.push(t({ it: 'remoto', en: 'remote' }));
                                  else parts.push(t({ it: 'in sede', en: 'on-site' }));
                                  if (g?.email) parts.push(String(g.email));
                                  if (g?.sendEmail) parts.push(t({ it: 'mail', en: 'mail' }));
                                  return parts.join(' · ');
                                })
                                .join(', ')
                            : (clientMeetingsBookingDetail.booking.externalGuestsList || []).length
                              ? (clientMeetingsBookingDetail.booking.externalGuestsList || []).join(', ')
                              : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Note sistema', en: 'System notes' })}</div>
                        <div className="mt-1 space-y-1 text-sm text-slate-700">
                          <div>
                            {t({ it: 'Setup pre/post', en: 'Pre/post setup' })}: {clientMeetingsBookingDetail.booking.setupBufferBeforeMin}/
                            {clientMeetingsBookingDetail.booking.setupBufferAfterMin} min
                          </div>
                          <div>
                            {t({ it: 'Mail partecipanti', en: 'Send email' })}: {boolBadge(!!clientMeetingsBookingDetail.booking.sendEmail)}
                          </div>
                          <div>
                            {t({ it: 'Setup tecnico', en: 'Technical setup' })}: {boolBadge(!!clientMeetingsBookingDetail.booking.technicalSetup)}
                            {clientMeetingsBookingDetail.booking.technicalEmail ? ` (${clientMeetingsBookingDetail.booking.technicalEmail})` : ''}
                          </div>
                          {clientMeetingsBookingDetail.booking.rejectReason ? (
                            <div>
                              {t({ it: 'Motivazione rifiuto', en: 'Reject reason' })}: {clientMeetingsBookingDetail.booking.rejectReason}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {clientMeetingsShowCheckInDetails ? (
                        (() => {
                          const booking = clientMeetingsBookingDetail.booking;
                          const checkMap = clientMeetingsCheckInStatusByMeetingId[String(booking.id || '')] || {};
                          const checkTsMap = clientMeetingsCheckInTimestampsByMeetingId[String(booking.id || '')] || {};
                          const stats = getClientMeetingCheckInStats(booking, checkMap);
                          const checkedEntries = getClientMeetingCheckInEntries(booking, checkMap, checkTsMap);
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-ink">{t({ it: 'Stato check-in', en: 'Check-in status' })}</div>
                                <div className="text-xs text-slate-600">{stats.checked}/{stats.total} • {stats.percent}%</div>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.percent}%` }} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span>{t({ it: 'Interni in sede', en: 'Internal on-site' })}: {stats.internalOnSite}</span>
                                <span>{t({ it: 'Esterni in sede', en: 'External on-site' })}: {stats.externalOnSite}</span>
                                <span>{t({ it: 'Partecipanti remoti', en: 'Remote participants' })}: {stats.remoteParticipants}</span>
                              </div>
                              <div className="mt-3 text-xs text-slate-500">
                                {t({
                                  it: 'Visualizza chi ha effettuato il check-in con data/ora registrata dal server.',
                                  en: 'See who checked in with server-recorded date/time.'
                                })}
                              </div>
                              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                {checkedEntries.length ? (
                                  <div className="space-y-2">
                                    {checkedEntries.map((entry: any) => (
                                      <div
                                        key={entry.key}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                                      >
                                        <div className="flex min-w-0 items-center gap-3">
                                          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                                            {entry.logoUrl ? (
                                              <img src={entry.logoUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                              <span className="text-[10px] font-bold text-slate-400">
                                                {entry.kind === 'external' ? 'EXT' : 'INT'}
                                              </span>
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <div
                                              className={`truncate text-sm font-semibold ${
                                                entry.kind === 'external' ? 'text-violet-700' : 'text-ink'
                                              }`}
                                            >
                                              {entry.label}
                                            </div>
                                            <div className="truncate text-xs text-slate-500">
                                              {[entry.company || null, entry.email || null].filter(Boolean).join(' • ') || '—'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs font-semibold text-emerald-600">
                                            {t({ it: 'Check-in', en: 'Check-in' })}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {entry.checkedAt ? new Date(Number(entry.checkedAt)).toLocaleString() : '—'}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                                    {t({ it: 'Nessun check-in registrato.', en: 'No check-ins recorded.' })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    {clientMeetingsBookingDetail ? (
                      <button
                        type="button"
                        onClick={() => setClientMeetingsNotesBooking(clientMeetingsBookingDetail.booking)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-1">
                          <FileText size={14} />
                          {t({ it: 'Appunti', en: 'Notes' })}
                        </span>
                      </button>
                    ) : null}
                    {clientMeetingsBookingDetail ? (
                      <button
                        type="button"
                        onClick={() => openClientMeetingDuplicateModal(clientMeetingsBookingDetail.booking)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Copy size={14} />
                          {t({ it: 'Duplica', en: 'Duplicate' })}
                        </span>
                      </button>
                    ) : null}
                    {clientMeetingsBookingDetail ? (
                      <button
                        type="button"
                        onClick={() => setClientMeetingsShowCheckInDetails((prev: any) => !prev)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {clientMeetingsShowCheckInDetails
                          ? t({ it: 'Nascondi check-in', en: 'Hide check-in' })
                          : t({ it: 'Mostra check-in', en: 'Show check-in' })}
                      </button>
                    ) : null}
                    <button
                      ref={clientMeetingsBookingDetailFocusRef}
                      type="button"
                      onClick={() => {
                        clientMeetingsDetailCloseGuardUntilRef.current = Date.now() + 350;
                        setClientMeetingsShowCheckInDetails(false);
                        setClientMeetingsBookingDetail(null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
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
