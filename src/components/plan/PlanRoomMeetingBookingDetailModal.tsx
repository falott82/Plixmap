import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import RoomMeetingBookingDetailPanel from './RoomMeetingBookingDetailPanel';
import { usePlanView } from './usePlanView';

type PlanRoomMeetingBookingDetailModalProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'addTimelineMeetingManualParticipant' | 'addTimelineMeetingRealParticipant' | 'adjustRoomMeetingEditEndTime' | 'canOpenBusinessPartnersDirectory' | 'canUseMeetingNotes' | 'client' | 'clientBusinessPartnerNames' | 'closeRoomMeetingBookingDetail' | 'closeRoomMeetingEditParticipantsModal' | 'extendRoomMeetingBooking' | 'getMeetingCheckInStats' | 'getRoomMeetingCheckInEntries' | 'lang' | 'meetingCheckInEntryKey' | 'meetingManagerOpen' | 'openRoomMeetingDuplicateModal' | 'openRoomMeetingEditParticipantsModal' | 'push' | 'removeTimelineMeetingParticipant' | 'roomMeetingCheckInListOpen' | 'roomMeetingDetailFocusRef' | 'roomMeetingDuplicateModal' | 'roomMeetingEditBusinessPartnersModalOpen' | 'roomMeetingEditManualCompanyIsOther' | 'roomMeetingEditParticipantCandidates' | 'roomMeetingEditParticipantsCloseGuardUntilRef' | 'roomMeetingEditParticipantsModalOpen' | 'roomMeetingEditParticipantsNameInputRef' | 'roomMeetingExtendBusyId' | 'roomMeetingsTimelineBookingDetail' | 'roomMeetingsTimelineModal' | 'saveRoomMeetingBookingEdit' | 'setRoomMeetingCheckInListOpen' | 'setRoomMeetingEditBusinessPartnersModalOpen' | 'setRoomMeetingEditManualCompanyIsOther' | 'setRoomMeetingNotesModalBooking' | 'setRoomMeetingNotesModalState' | 'setRoomMeetingNotesReturnToMyMeetings' | 'setRoomMeetingsTimelineBookingDetail' | 'site' | 't' | 'toggleTimelineMeetingParticipantFlag'
>;

/** Room-meeting booking detail/edit modal (wraps RoomMeetingBookingDetailPanel). Extracted from PlanViewView.tsx. */
export const PlanRoomMeetingBookingDetailModal = ({
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
  lang,
  meetingCheckInEntryKey,
  meetingManagerOpen,
  openRoomMeetingDuplicateModal,
  openRoomMeetingEditParticipantsModal,
  push,
  removeTimelineMeetingParticipant,
  roomMeetingCheckInListOpen,
  roomMeetingDetailFocusRef,
  roomMeetingDuplicateModal,
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
  site,
  t,
  toggleTimelineMeetingParticipantFlag,
}: PlanRoomMeetingBookingDetailModalProps) => (
      <Transition show={!!roomMeetingsTimelineBookingDetail && !meetingManagerOpen && !roomMeetingDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[120]"
          initialFocus={roomMeetingDetailFocusRef}
          onClose={() => {
            if (roomMeetingEditBusinessPartnersModalOpen || roomMeetingEditParticipantsModalOpen) return;
            closeRoomMeetingBookingDetail();
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
                <Dialog.Panel className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {roomMeetingsTimelineBookingDetail?.mode === 'edit'
                          ? t({ it: 'Modifica meeting', en: 'Edit meeting' })
                          : t({ it: 'Dettaglio meeting', en: 'Meeting details' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {roomMeetingsTimelineBookingDetail?.booking?.sendEmail
                          ? t({ it: 'Invio mail attivo: modifica/eliminazione notificheranno i partecipanti.', en: 'Email delivery enabled: update/delete will notify participants.' })
                          : t({ it: 'Invio mail non attivo su questo meeting.', en: 'Email delivery is not enabled for this meeting.' })}
                      </div>
                    </div>
                    <button
                      ref={roomMeetingDetailFocusRef}
                      type="button"
                      onClick={() => closeRoomMeetingBookingDetail()}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {roomMeetingsTimelineBookingDetail ? <RoomMeetingBookingDetailPanel {...{ addTimelineMeetingManualParticipant, addTimelineMeetingRealParticipant, adjustRoomMeetingEditEndTime, canOpenBusinessPartnersDirectory, canUseMeetingNotes, client, clientBusinessPartnerNames, closeRoomMeetingBookingDetail, closeRoomMeetingEditParticipantsModal, extendRoomMeetingBooking, getMeetingCheckInStats, getRoomMeetingCheckInEntries, lang, meetingCheckInEntryKey, openRoomMeetingDuplicateModal, openRoomMeetingEditParticipantsModal, push, removeTimelineMeetingParticipant, roomMeetingCheckInListOpen, roomMeetingEditBusinessPartnersModalOpen, roomMeetingEditManualCompanyIsOther, roomMeetingEditParticipantCandidates, roomMeetingEditParticipantsCloseGuardUntilRef, roomMeetingEditParticipantsModalOpen, roomMeetingEditParticipantsNameInputRef, roomMeetingExtendBusyId, roomMeetingsTimelineBookingDetail, roomMeetingsTimelineModal, saveRoomMeetingBookingEdit, setRoomMeetingCheckInListOpen, setRoomMeetingEditBusinessPartnersModalOpen, setRoomMeetingEditManualCompanyIsOther, setRoomMeetingNotesModalBooking, setRoomMeetingNotesModalState, setRoomMeetingNotesReturnToMyMeetings, setRoomMeetingsTimelineBookingDetail, site, t, toggleTimelineMeetingParticipantFlag }} /> : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
);
