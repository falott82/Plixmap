/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect } from 'react';
import { computeReloadMyMeetings } from './planViewLockMeetingTools';
import { runOpenMyMeetingsModal } from './planViewComputeBits2';

const OPEN_MEETING_CENTER_EVENT = 'plixmap_open_meeting_center';
const OPEN_MY_MEETINGS_EVENT = 'plixmap_open_my_meetings';

// "My meetings" modal handlers + the open-meeting-center / open-my-meetings window-event listeners
// extracted from usePlanView. Bodies moved verbatim; keeps reloadMyMeetingsRef in sync for the
// room-meetings timeline hook.
export const usePlanMyMeetingsModal = (deps: any) => {
  const { t, setMyMeetingsModal, setMyMeetingsSearch, reloadMyMeetingsRef, myMeetingsRestoreRef, setMeetingHubModalOpen, myMeetingsModal } = deps;

  const reloadMyMeetings = useCallback(async () => {
    await computeReloadMyMeetings({ t, setMyMeetingsModal });
  }, [t, setMyMeetingsModal]);
  reloadMyMeetingsRef.current = reloadMyMeetings;

  const openMyMeetingsModal = useCallback((opts?: { returnToHub?: boolean; restore?: any }) => {
    runOpenMyMeetingsModal(opts, { setMyMeetingsSearch, setMyMeetingsModal, reloadMyMeetings });
  }, [reloadMyMeetings, setMyMeetingsSearch, setMyMeetingsModal]);

  const openMyMeetingsFromHub = useCallback(() => {
    openMyMeetingsModal({ returnToHub: true });
  }, [openMyMeetingsModal]);

  useEffect(() => {
    const onOpenMeetingCenter = () => {
      setMyMeetingsModal(null);
      setMeetingHubModalOpen(true);
    };
    window.addEventListener(OPEN_MEETING_CENTER_EVENT, onOpenMeetingCenter as EventListener);
    return () => window.removeEventListener(OPEN_MEETING_CENTER_EVENT, onOpenMeetingCenter as EventListener);
  }, [setMyMeetingsModal, setMeetingHubModalOpen]);

  useEffect(() => {
    const onOpenMyMeetings = () => {
      const restore = myMeetingsRestoreRef.current;
      myMeetingsRestoreRef.current = null;
      openMyMeetingsModal({ returnToHub: false, restore });
    };
    window.addEventListener(OPEN_MY_MEETINGS_EVENT, onOpenMyMeetings as EventListener);
    return () => window.removeEventListener(OPEN_MY_MEETINGS_EVENT, onOpenMyMeetings as EventListener);
  }, [openMyMeetingsModal, myMeetingsRestoreRef]);

  const closeMyMeetingsModal = useCallback(() => {
    const shouldReturnToHub = !!myMeetingsModal?.returnToHub;
    setMyMeetingsModal(null);
    if (shouldReturnToHub) {
      setMeetingHubModalOpen(true);
    }
  }, [myMeetingsModal?.returnToHub, setMyMeetingsModal, setMeetingHubModalOpen]);

  return { reloadMyMeetings, openMyMeetingsModal, openMyMeetingsFromHub, closeMyMeetingsModal };
};
