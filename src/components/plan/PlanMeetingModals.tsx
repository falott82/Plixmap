import { Suspense, lazy } from 'react';
import MeetingManagerOpenPanel from './MeetingManagerOpenPanel';
import { currentLocalIsoDay } from '../../utils/localDate';
import { isDeskType } from './deskTypes';
import { postAuditEvent } from '../../api/audit';
import { mobileCheckInMeeting } from '../../api/mobile';
import { usePlanView } from './usePlanView';

const MeetingHubModal = lazy(() => import('./MeetingHubModal'));
const MyMeetingsModal = lazy(() => import('./MyMeetingsModal'));
const RoomAllocationModal = lazy(() => import('./RoomAllocationModal'));
const CapacityDashboardModal = lazy(() => import('./CapacityDashboardModal'));
const RoomMeasuresModal = lazy(() => import('./RoomMeasuresModal'));
const RoomLayoutExportModal = lazy(() => import('./RoomLayoutExportModal'));
const RoomMeetingDuplicateModal = lazy(() => import('./RoomMeetingDuplicateModal'));
const BulkEditDescriptionModal = lazy(() => import('./BulkEditDescriptionModal'));
const BulkEditSelectionModal = lazy(() => import('./BulkEditSelectionModal'));
const MeetingNotesModal = lazy(() => import('../meetings/MeetingNotesModal'));

type PlanMeetingModalsProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'allClients' | 'applyRoomLayoutExportToSelection' | 'bulkEditOpen' | 'bulkEditSelectionOpen' | 'canManageMeetingScheduling' | 'canUseMeetingNotes' | 'capacityDashboardOpen' | 'capacityDashboardPreset' | 'clearRoomLayoutExportSelection' | 'client' | 'closeMyMeetingsModal' | 'closeRoomLayoutExportModal' | 'dispatchOpenClientMeetingsTimeline' | 'getTypeIcon' | 'getTypeLabel' | 'hmToMinutes' | 'isReadOnly' | 'markTouched' | 'meetingClockFromTs' | 'meetingHubFocusRef' | 'meetingHubModalOpen' | 'meetingIsoDayFromTs' | 'meetingLocationLabels' | 'meetingManagerOpen' | 'meetingManagerPreset' | 'monthAnchorFromIso' | 'myMeetingsCheckInBusyId' | 'myMeetingsCheckInDoneById' | 'myMeetingsFiltered' | 'myMeetingsFocusRef' | 'myMeetingsModal' | 'myMeetingsRestoreRef' | 'myMeetingsSearch' | 'navigate' | 'openImageViewer' | 'openMyMeetingsFromHub' | 'openPhotoViewer' | 'openRoomMeetingBookingDetail' | 'openRoomMeetingDuplicateModal' | 'openSchedulingFromHub' | 'plan' | 'planId' | 'push' | 'reloadMyMeetings' | 'reloadRoomMeetingsTimeline' | 'renderPlan' | 'renderPlanObjectById' | 'restoreMyMeetingsFromSnapshot' | 'returnToBulkEditRef' | 'roomAllocationOpen' | 'roomAllocationPreset' | 'roomDepartmentOptions' | 'roomLayoutExportModal' | 'roomLayoutExportRows' | 'roomLayoutExportSource' | 'roomMeasuresData' | 'roomMeasuresModal' | 'roomMeetingDuplicateModal' | 'roomMeetingDuplicateRoomPickerOpen' | 'roomMeetingDuplicateRoomPickerRef' | 'roomMeetingNotesModalBooking' | 'roomMeetingNotesModalState' | 'roomMeetingNotesReturnToMyMeetings' | 'roomMeetingsTimelineModal' | 'rooms' | 'saveRoomMeetingDuplicates' | 'selectAllRoomLayoutExportRows' | 'selectedObjectIds' | 'setBulkEditOpen' | 'setBulkEditSelectionOpen' | 'setCapacityDashboardOpen' | 'setCapacityDashboardPreset' | 'setHighlightRoom' | 'setMeetingHubModalOpen' | 'setMeetingManagerOpen' | 'setMeetingManagerPreset' | 'setMeetingStatusByRoomId' | 'setMyMeetingsCheckInBusyId' | 'setMyMeetingsCheckInDoneById' | 'setMyMeetingsModal' | 'setMyMeetingsSearch' | 'setRoomAllocationOpen' | 'setRoomAllocationPreset' | 'setRoomMeasuresModal' | 'setRoomMeetingDuplicateModal' | 'setRoomMeetingDuplicateRoomPickerOpen' | 'setRoomMeetingNotesModalBooking' | 'setRoomMeetingNotesModalState' | 'setRoomMeetingNotesReturnToMyMeetings' | 'setRoomsOpen' | 'setSelectedPlan' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 'shiftMonthAnchor' | 'site' | 'sortRoomLayoutExportRows' | 't' | 'toggleAllRoomLayoutExportRows' | 'toggleRoomLayoutExportRow' | 'updateObject'
>;

/** Secondary meeting/room/bulk-edit lazy modals from PlanViewView. */
export const PlanMeetingModals = ({
  allClients,
  applyRoomLayoutExportToSelection,
  bulkEditOpen,
  bulkEditSelectionOpen,
  canManageMeetingScheduling,
  canUseMeetingNotes,
  capacityDashboardOpen,
  capacityDashboardPreset,
  clearRoomLayoutExportSelection,
  client,
  closeMyMeetingsModal,
  closeRoomLayoutExportModal,
  dispatchOpenClientMeetingsTimeline,
  getTypeIcon,
  getTypeLabel,
  hmToMinutes,
  isReadOnly,
  markTouched,
  meetingClockFromTs,
  meetingHubFocusRef,
  meetingHubModalOpen,
  meetingIsoDayFromTs,
  meetingLocationLabels,
  meetingManagerOpen,
  meetingManagerPreset,
  monthAnchorFromIso,
  myMeetingsCheckInBusyId,
  myMeetingsCheckInDoneById,
  myMeetingsFiltered,
  myMeetingsFocusRef,
  myMeetingsModal,
  myMeetingsRestoreRef,
  myMeetingsSearch,
  navigate,
  openImageViewer,
  openMyMeetingsFromHub,
  openPhotoViewer,
  openRoomMeetingBookingDetail,
  openRoomMeetingDuplicateModal,
  openSchedulingFromHub,
  plan,
  planId,
  push,
  reloadMyMeetings,
  reloadRoomMeetingsTimeline,
  renderPlan,
  renderPlanObjectById,
  restoreMyMeetingsFromSnapshot,
  returnToBulkEditRef,
  roomAllocationOpen,
  roomAllocationPreset,
  roomDepartmentOptions,
  roomLayoutExportModal,
  roomLayoutExportRows,
  roomLayoutExportSource,
  roomMeasuresData,
  roomMeasuresModal,
  roomMeetingDuplicateModal,
  roomMeetingDuplicateRoomPickerOpen,
  roomMeetingDuplicateRoomPickerRef,
  roomMeetingNotesModalBooking,
  roomMeetingNotesModalState,
  roomMeetingNotesReturnToMyMeetings,
  roomMeetingsTimelineModal,
  rooms,
  saveRoomMeetingDuplicates,
  selectAllRoomLayoutExportRows,
  selectedObjectIds,
  setBulkEditOpen,
  setBulkEditSelectionOpen,
  setCapacityDashboardOpen,
  setCapacityDashboardPreset,
  setHighlightRoom,
  setMeetingHubModalOpen,
  setMeetingManagerOpen,
  setMeetingManagerPreset,
  setMeetingStatusByRoomId,
  setMyMeetingsCheckInBusyId,
  setMyMeetingsCheckInDoneById,
  setMyMeetingsModal,
  setMyMeetingsSearch,
  setRoomAllocationOpen,
  setRoomAllocationPreset,
  setRoomMeasuresModal,
  setRoomMeetingDuplicateModal,
  setRoomMeetingDuplicateRoomPickerOpen,
  setRoomMeetingNotesModalBooking,
  setRoomMeetingNotesModalState,
  setRoomMeetingNotesReturnToMyMeetings,
  setRoomsOpen,
  setSelectedPlan,
  setSelectedRoomId,
  setSelectedRoomIds,
  shiftMonthAnchor,
  site,
  sortRoomLayoutExportRows,
  t,
  toggleAllRoomLayoutExportRows,
  toggleRoomLayoutExportRow,
  updateObject,
}: PlanMeetingModalsProps) => (
  <>
      {roomLayoutExportModal ? (
        <Suspense fallback={null}>
          <RoomLayoutExportModal
            open={!!roomLayoutExportModal}
            modal={roomLayoutExportModal}
            rows={roomLayoutExportRows}
            source={roomLayoutExportSource}
            t={t}
            onClose={closeRoomLayoutExportModal}
            onSelectAll={selectAllRoomLayoutExportRows}
            onClearSelection={clearRoomLayoutExportSelection}
            onToggleAll={toggleAllRoomLayoutExportRows}
            onToggleRow={toggleRoomLayoutExportRow}
            onSort={sortRoomLayoutExportRows}
            onApply={applyRoomLayoutExportToSelection}
          />
        </Suspense>
      ) : null}

      {roomMeasuresModal ? (
        <Suspense fallback={null}>
          <RoomMeasuresModal
            open={!!roomMeasuresModal}
            data={roomMeasuresData}
            t={t}
            onClose={() => setRoomMeasuresModal(null)}
          />
        </Suspense>
      ) : null}

      {roomMeetingDuplicateModal ? (
        <Suspense fallback={null}>
          <RoomMeetingDuplicateModal
            open={!!roomMeetingDuplicateModal && !meetingManagerOpen}
            modal={roomMeetingDuplicateModal}
            roomPickerOpen={roomMeetingDuplicateRoomPickerOpen}
            roomPickerRef={roomMeetingDuplicateRoomPickerRef}
            setModal={setRoomMeetingDuplicateModal}
            setRoomPickerOpen={setRoomMeetingDuplicateRoomPickerOpen}
            meetingClockFromTs={meetingClockFromTs}
            hmToMinutes={hmToMinutes}
            monthAnchorFromIso={monthAnchorFromIso}
            shiftMonthAnchor={shiftMonthAnchor}
            t={t}
            onClose={() => setRoomMeetingDuplicateModal(null)}
            onSave={saveRoomMeetingDuplicates}
          />
        </Suspense>
      ) : null}

      {meetingHubModalOpen ? (
        <Suspense fallback={null}>
          <MeetingHubModal
            open={meetingHubModalOpen}
            canManageMeetingScheduling={canManageMeetingScheduling}
            t={t}
            focusRef={meetingHubFocusRef}
            onClose={() => setMeetingHubModalOpen(false)}
            onOpenScheduling={() => {
              setMeetingHubModalOpen(false);
              openSchedulingFromHub({
                clientId: client?.id,
                siteId: site?.id,
                siteLocked: false,
                day: currentLocalIsoDay(),
                returnTo: 'hub'
              });
            }}
            onOpenMyMeetings={() => {
              setMeetingHubModalOpen(false);
              openMyMeetingsFromHub();
            }}
          />
        </Suspense>
      ) : null}

      {myMeetingsModal ? (
        <Suspense fallback={null}>
          <MyMeetingsModal
            open={!!myMeetingsModal}
            modal={myMeetingsModal}
            meetings={myMeetingsFiltered}
            search={myMeetingsSearch}
            focusRef={myMeetingsFocusRef}
            t={t}
            canUseMeetingNotes={canUseMeetingNotes}
            locationLabels={meetingLocationLabels}
            checkInBusyId={myMeetingsCheckInBusyId}
            checkInDoneById={myMeetingsCheckInDoneById}
            onClose={closeMyMeetingsModal}
            onSearchChange={setMyMeetingsSearch}
            onOpenScheduling={() => {
              const topMeeting = myMeetingsFiltered[0] || myMeetingsModal?.meetings?.[0] || null;
              myMeetingsRestoreRef.current = myMeetingsModal;
              setMyMeetingsModal(null);
              dispatchOpenClientMeetingsTimeline({
                clientId: String(topMeeting?.clientId || client?.id || '').trim() || undefined,
                siteId: String(topMeeting?.siteId || site?.id || '').trim() || undefined,
                siteLocked: false,
                day: String((topMeeting as any)?.occurrenceDate || (topMeeting?.startAt ? meetingIsoDayFromTs(Number(topMeeting.startAt)) : currentLocalIsoDay())),
                returnTo: 'myMeetings'
              });
            }}
            onRefresh={() => void reloadMyMeetings()}
            onOpenNotes={(booking) => {
              myMeetingsRestoreRef.current = myMeetingsModal;
              setRoomMeetingNotesReturnToMyMeetings(true);
              setRoomMeetingNotesModalState(null);
              setRoomMeetingNotesModalBooking(booking);
              setMyMeetingsModal(null);
            }}
            onCheckIn={(booking) => {
              if (myMeetingsCheckInBusyId) return;
              setMyMeetingsCheckInBusyId(String(booking.id));
              void mobileCheckInMeeting(String(booking.id), true)
                .then(() => {
                  setMyMeetingsCheckInDoneById((prev) => ({ ...prev, [String(booking.id)]: true }));
                  push(t({ it: 'Check-in registrato.', en: 'Check-in registered.' }), 'success');
                })
                .catch((err: any) => {
                  push(String(err?.message || t({ it: 'Errore check-in', en: 'Check-in error' })), 'danger');
                })
                .finally(() => {
                  setMyMeetingsCheckInBusyId(null);
                });
            }}
          />
        </Suspense>
      ) : null}

      {roomAllocationOpen ? (
        <Suspense fallback={null}>
          <RoomAllocationModal
            open={roomAllocationOpen}
            clients={allClients}
            departmentOptions={roomDepartmentOptions}
            currentClientId={roomAllocationPreset?.clientId || client?.id}
            currentSiteId={roomAllocationPreset?.siteId || site?.id}
            onHighlight={({ planId: targetPlanId, roomId }) => {
              if (targetPlanId !== planId) {
                setRoomAllocationOpen(false);
                setRoomAllocationPreset(null);
                setSelectedPlan(targetPlanId);
                navigate(`/plan/${targetPlanId}?focusRoom=${encodeURIComponent(roomId)}`);
                return;
              }
              setSelectedRoomId(roomId);
              setSelectedRoomIds([roomId]);
              setHighlightRoom({ roomId, until: Date.now() + 3200 });
            }}
            onClose={() => {
              setRoomAllocationOpen(false);
              setRoomAllocationPreset(null);
              setRoomsOpen(false);
            }}
          />
        </Suspense>
      ) : null}

      {capacityDashboardOpen ? (
        <Suspense fallback={null}>
          <CapacityDashboardModal
            open={capacityDashboardOpen}
            clients={allClients}
            currentClientId={capacityDashboardPreset?.clientId || client?.id}
            currentSiteId={capacityDashboardPreset?.siteId || site?.id}
            onClose={() => {
              setCapacityDashboardOpen(false);
              setCapacityDashboardPreset(null);
            }}
          />
        </Suspense>
      ) : null}

      {meetingManagerOpen ? <MeetingManagerOpenPanel {...{ allClients, client, meetingManagerOpen, meetingManagerPreset, navigate, plan, planId, reloadRoomMeetingsTimeline, roomMeetingsTimelineModal, rooms, setHighlightRoom, setMeetingManagerOpen, setMeetingManagerPreset, setMeetingStatusByRoomId, setSelectedPlan, setSelectedRoomId, setSelectedRoomIds, site }} /> : null}

      {roomMeetingNotesModalBooking ? (
        <Suspense fallback={null}>
          <MeetingNotesModal
            open={!!roomMeetingNotesModalBooking}
            meeting={roomMeetingNotesModalBooking}
            suspendClose={!!roomMeetingDuplicateModal}
            initialTab={roomMeetingNotesModalState?.initialTab}
            initialHistoryMeetingId={roomMeetingNotesModalState?.historyMeetingId}
            highlightHistoryMeetingId={roomMeetingNotesModalState?.highlightHistoryMeetingId}
            onClose={() => {
              const shouldReturnToMyMeetings = roomMeetingNotesReturnToMyMeetings;
              setRoomMeetingNotesModalBooking(null);
              setRoomMeetingNotesModalState(null);
              setRoomMeetingNotesReturnToMyMeetings(false);
              if (shouldReturnToMyMeetings) {
                restoreMyMeetingsFromSnapshot();
              }
            }}
            onOpenDetails={(booking) => {
              const fromMyMeetings = roomMeetingNotesReturnToMyMeetings;
              setRoomMeetingNotesModalBooking(null);
              setRoomMeetingNotesModalState(null);
              setRoomMeetingNotesReturnToMyMeetings(false);
              openRoomMeetingBookingDetail(booking, 'edit', {
                fromMyMeetings,
                fromMeetingNotes: true,
                meetingNotesState: {
                  initialTab: 'history',
                  historyMeetingId: String(booking.id || ''),
                  highlightHistoryMeetingId: String(booking.id || '')
                }
              });
            }}
            onOpenFollowUpScheduler={(booking, options) => {
              openRoomMeetingDuplicateModal(booking, { ...options, mode: 'followup' });
            }}
          />
        </Suspense>
      ) : null}

      {bulkEditOpen ? (
        <Suspense fallback={null}>
          {/* kept for potential future use */}
          <BulkEditDescriptionModal
            open={bulkEditOpen}
            count={selectedObjectIds.filter((id) => {
              const obj = renderPlan?.objects?.find((o) => o.id === id);
              return !!obj && !isDeskType(obj.type);
            }).length}
            onClose={() => setBulkEditOpen(false)}
            onSubmit={({ description }) => {
              if (isReadOnly) return;
              const targetIds = selectedObjectIds.filter((id) => {
                const obj = renderPlan?.objects?.find((o) => o.id === id);
                return !!obj && !isDeskType(obj.type);
              });
              if (targetIds.length) markTouched();
              for (const id of targetIds) {
                updateObject(id, { description });
              }
              push(t({ it: 'Descrizione aggiornata', en: 'Description updated' }), 'success');
              if (targetIds.length) {
                postAuditEvent({
                  event: 'objects_bulk_update',
                  scopeType: 'plan',
                  scopeId: planId,
                  details: { ids: targetIds, changes: { description } }
                });
              }
            }}
          />
        </Suspense>
      ) : null}

      {bulkEditSelectionOpen ? (
        <Suspense fallback={null}>
          <BulkEditSelectionModal
            open={bulkEditSelectionOpen}
            objects={(renderPlan?.objects || []).filter((o) => selectedObjectIds.includes(o.id))}
            getTypeLabel={getTypeLabel}
            getTypeIcon={getTypeIcon}
            onPreviewObject={(objectId) => {
              if (!renderPlan) return;
              const obj = renderPlanObjectById.get(objectId);
              if (!obj) return;
              if (obj.type !== 'photo' && obj.type !== 'image') return;
              returnToBulkEditRef.current = true;
              setBulkEditSelectionOpen(false);
              if (obj.type === 'photo') {
                openPhotoViewer({ id: objectId, selectionIds: [objectId] });
              } else {
                openImageViewer({ id: objectId, selectionIds: [objectId] });
              }
            }}
            onClose={() => setBulkEditSelectionOpen(false)}
            onApply={(changesById) => {
              if (isReadOnly) return;
              if (Object.keys(changesById || {}).length) markTouched();
              const ids = Object.keys(changesById || {});
              for (const id of ids) {
                updateObject(id, changesById[id]);
              }
              if (ids.length) push(t({ it: 'Oggetti aggiornati', en: 'Objects updated' }), 'success');
              if (ids.length) {
                postAuditEvent({
                  event: 'objects_bulk_update',
                  scopeType: 'plan',
                  scopeId: planId,
                  details: { ids, changesById }
                });
              }
            }}
          />
        </Suspense>
      ) : null}
  </>
);
