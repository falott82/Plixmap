

import { Suspense, lazy } from 'react';

import { currentLocalIsoDay } from '../../utils/localDate';

import { fetchMeetingOverview } from '../../api/meetings';

import { usePlanView } from './usePlanView';

const MeetingManagerModal = lazy(() => import('../meetings/MeetingManagerModal'));

type MeetingManagerOpenPanelProps = Pick<ReturnType<typeof usePlanView>, 'allClients' | 'client' | 'meetingManagerOpen' | 'meetingManagerPreset' | 'navigate' | 'planId' | 'reloadRoomMeetingsTimeline' | 'roomMeetingsTimelineModal' | 'setHighlightRoom' | 'setMeetingManagerOpen' | 'setMeetingManagerPreset' | 'setMeetingStatusByRoomId' | 'setSelectedPlan' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 'site'>;

const MeetingManagerOpenPanel = (props: MeetingManagerOpenPanelProps) => {
  const {
    allClients,
    client,
    meetingManagerOpen,
    meetingManagerPreset,
    navigate,
    planId,
    reloadRoomMeetingsTimeline,
    roomMeetingsTimelineModal,
    setHighlightRoom,
    setMeetingManagerOpen,
    setMeetingManagerPreset,
    setMeetingStatusByRoomId,
    setSelectedPlan,
    setSelectedRoomId,
    setSelectedRoomIds,
    site
  } = props;
  if (!meetingManagerOpen) return null;
  return (
        <Suspense fallback={null}>
          <MeetingManagerModal
            open={meetingManagerOpen}
            clients={allClients}
            initialClientId={meetingManagerPreset?.clientId || client?.id}
            initialSiteId={meetingManagerPreset?.siteId || site?.id}
            initialFloorPlanId={meetingManagerPreset?.floorPlanId || planId}
            initialRoomId={meetingManagerPreset?.roomId}
            initialDay={meetingManagerPreset?.day}
            onClose={() => {
              setMeetingManagerOpen(false);
              setMeetingManagerPreset(null);
            }}
            onCreated={() => {
              const cid = String(client?.id || '').trim();
              const sid = String(site?.id || '').trim();
              if (cid && sid) {
                void fetchMeetingOverview({ clientId: cid, siteId: sid, floorPlanId: planId, day: currentLocalIsoDay() })
                  .then((payload) => {
                    const nowTs = Date.now();
                    const next: Record<string, { hasMeetingToday: boolean; inProgress: boolean; hasFutureToday: boolean }> = {};
                    for (const row of payload.rooms || []) {
                      const hasFutureToday = Array.isArray(row.bookings) ? row.bookings.some((b) => Number(b.startAt) > nowTs) : false;
                      next[String(row.roomId)] = {
                        hasMeetingToday: !!row.hasMeetingToday,
                        inProgress: !!row.inProgress,
                        hasFutureToday
                      };
                    }
                    setMeetingStatusByRoomId(next);
                  })
                  .catch(() => {});
              }
              if (roomMeetingsTimelineModal?.roomId) {
                void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, roomMeetingsTimelineModal.day);
              }
            }}
            onGoToRoom={(roomId) => {
              let targetPlanId: string | null = null;
              for (const c of allClients || []) {
                for (const s of c.sites || []) {
                  const hit = (s.floorPlans || []).find((p) => (p.rooms || []).some((r) => r.id === roomId));
                  if (hit?.id) {
                    targetPlanId = hit.id;
                    break;
                  }
                }
                if (targetPlanId) break;
              }
              if (!targetPlanId) return;
              setMeetingManagerOpen(false);
              setMeetingManagerPreset(null);
              if (targetPlanId !== planId) {
                setSelectedPlan(targetPlanId);
                navigate(`/plan/${targetPlanId}?focusRoom=${encodeURIComponent(roomId)}`);
                return;
              }
              setSelectedRoomId(roomId);
              setSelectedRoomIds([roomId]);
              setHighlightRoom({ roomId, until: Date.now() + 3200 });
            }}
          />
        </Suspense>
  );
};

export default MeetingManagerOpenPanel;
