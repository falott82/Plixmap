import { useCallback } from 'react';
import { currentLocalIsoDay } from '../../utils/localDate';
import { runOpenMeetingManager } from './planViewComputeBits2';
import { computeOpenSchedulingFromHub } from './planViewSearchScheduleTools';

const OPEN_CLIENT_MEETINGS_EVENT = 'plixmap_open_client_meetings';

type SchedulingPreset = { clientId?: string; siteId?: string; siteLocked?: boolean; day?: string; returnTo?: 'hub' | 'myMeetings' };

// Meeting-open handlers extracted from usePlanView (open the meeting manager,
// dispatch the client-meetings-timeline event, open scheduling from the hub).
// Bodies are verbatim; shared deps injected once.
export const usePlanMeetingOpenHandlers = (deps: any) => {
  const {
    client,
    site,
    planId,
    hasNavigationEdits,
    isReadOnly,
    canManageMeetingScheduling,
    push,
    t,
    setPendingMeetingManagerPreset,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen,
    setMeetingManagerPreset,
    setMeetingManagerOpen,
    setPendingClientMeetingsPreset
  } = deps;

  const openMeetingManager = useCallback(
    (preset?: { roomId?: string; floorPlanId?: string; siteId?: string; clientId?: string; day?: string }) => {
      runOpenMeetingManager(preset, {
        client,
        site,
        planId,
        hasNavigationEdits,
        isReadOnly,
        setPendingMeetingManagerPreset,
        setSaveRevisionModalPreset,
        setSaveRevisionOpen,
        push,
        t,
        setMeetingManagerPreset,
        setMeetingManagerOpen
      });
    },
    [client?.id, hasNavigationEdits, isReadOnly, planId, push, site?.id, t]
  );

  const dispatchOpenClientMeetingsTimeline = useCallback(
    (preset?: SchedulingPreset) => {
      const clientId = String(preset?.clientId || client?.id || '').trim();
      if (!clientId) return;
      window.dispatchEvent(
        new CustomEvent(OPEN_CLIENT_MEETINGS_EVENT, {
          detail: {
            clientId,
            siteId: String(preset?.siteId || site?.id || '').trim() || 'all',
            siteLocked: !!preset?.siteLocked,
            day: String(preset?.day || currentLocalIsoDay()),
            returnTo: preset?.returnTo || null
          }
        })
      );
    },
    [client?.id, site?.id]
  );

  const openSchedulingFromHub = useCallback(
    (preset?: SchedulingPreset) =>
      computeOpenSchedulingFromHub(preset, {
        canManageMeetingScheduling,
        client,
        dispatchOpenClientMeetingsTimeline,
        hasNavigationEdits,
        isReadOnly,
        push,
        site,
        t,
        setPendingClientMeetingsPreset,
        setSaveRevisionModalPreset,
        setSaveRevisionOpen
      }),
    [canManageMeetingScheduling, client?.id, dispatchOpenClientMeetingsTimeline, hasNavigationEdits, isReadOnly, push, site?.id, t]
  );

  return { openMeetingManager, dispatchOpenClientMeetingsTimeline, openSchedulingFromHub };
};
