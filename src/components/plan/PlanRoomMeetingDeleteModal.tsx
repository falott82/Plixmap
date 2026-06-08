import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, X } from 'lucide-react';
import { usePlanView } from './usePlanView';

type PlanRoomMeetingDeleteModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'roomMeetingDeleteModal'
  | 'setRoomMeetingDeleteModal'
  | 'meetingManagerOpen'
  | 'roomMeetingDuplicateModal'
  | 'roomMeetingsTimelineModal'
  | 'confirmDeleteRoomMeetingBooking'
  | 't'
>;

/**
 * Confirmation modal for deleting a room-meeting booking (with details +
 * email-notification note). Extracted from PlanViewView.tsx.
 */
export const PlanRoomMeetingDeleteModal = ({
  roomMeetingDeleteModal,
  setRoomMeetingDeleteModal,
  meetingManagerOpen,
  roomMeetingDuplicateModal,
  roomMeetingsTimelineModal,
  confirmDeleteRoomMeetingBooking,
  t
}: PlanRoomMeetingDeleteModalProps) => (
      <Transition show={!!roomMeetingDeleteModal && !meetingManagerOpen && !roomMeetingDuplicateModal} as={Fragment}>
        <Dialog as="div" className="relative z-[92]" onClose={() => setRoomMeetingDeleteModal(null)}>
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
                        {t({ it: 'Eliminare meeting?', en: 'Delete meeting?' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Controlla i dettagli prima di confermare. Se era attivo invio mail, i partecipanti verranno notificati.',
                          en: 'Review details before confirming. If email delivery was enabled, participants will be notified.'
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRoomMeetingDeleteModal(null)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {roomMeetingDeleteModal?.booking ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Oggetto', en: 'Subject' })}</div>
                        <div className="text-sm font-semibold text-ink">{roomMeetingDeleteModal.booking.subject || t({ it: 'Meeting', en: 'Meeting' })}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Data / ora', en: 'Date / time' })}</div>
                        <div className="text-sm font-semibold text-ink">
                          {new Date(roomMeetingDeleteModal.booking.startAt).toLocaleDateString()} •{' '}
                          {new Date(roomMeetingDeleteModal.booking.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-
                          {new Date(roomMeetingDeleteModal.booking.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Sala', en: 'Room' })}</div>
                        <div className="text-sm font-semibold text-ink">{roomMeetingsTimelineModal?.roomName || '-'}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Richiedente', en: 'Requester' })}</div>
                        <div className="text-sm font-semibold text-ink">{roomMeetingDeleteModal.booking.requestedByUsername || '-'}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Partecipanti', en: 'Participants' })}</div>
                        <div className="text-sm font-semibold text-ink">{Array.isArray(roomMeetingDeleteModal.booking.participants) ? roomMeetingDeleteModal.booking.participants.length : 0}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Invio mail', en: 'Email delivery' })}</div>
                        <div className="text-sm font-semibold text-ink">
                          {roomMeetingDeleteModal.booking.sendEmail ? t({ it: 'Sì', en: 'Yes' }) : t({ it: 'No', en: 'No' })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {roomMeetingDeleteModal?.error ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{roomMeetingDeleteModal.error}</div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRoomMeetingDeleteModal(null)}
                      disabled={!!roomMeetingDeleteModal?.deleting}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDeleteRoomMeetingBooking()}
                      disabled={!!roomMeetingDeleteModal?.deleting}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {roomMeetingDeleteModal?.deleting ? <Loader2 size={14} className="animate-spin" /> : null}
                      {t({ it: 'Elimina meeting', en: 'Delete meeting' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
);
