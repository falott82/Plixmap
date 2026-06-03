import { lazy, Suspense } from 'react';

import { Room } from '../../store/types';

import { postAuditEvent } from '../../api/audit';

import { usePlanView } from './usePlanView';

const RoomModal = lazy(() => import('./RoomModal'));

type RoomModalContainerProps = Pick<ReturnType<typeof usePlanView>, 'addRoom' | 'basePlan' | 'getTypeIcon' | 'getTypeLabel' | 'handleCreateWallsForRoom' | 'hasRoomOverlap' | 'isPointInRoom' | 'isReadOnly' | 'isUserObject' | 'markTouched' | 'metersPerPixel' | 'notifyRoomOverlap' | 'openPhotoViewer' | 'push' | 'resolveRoomAssignmentForObject' | 'roomDepartmentOptions' | 'roomHasWalls' | 'roomModal' | 'roomModalBaseRoom' | 'roomModalInitialSurfaceSqm' | 'roomModalMetrics' | 'roomModalPreview' | 'roomStatsById' | 'setConfirmDelete' | 'setHighlightRoom' | 'setObjectRoomIds' | 'setRoomModal' | 'setRoomWallPrompt' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 'siteFloorPlans' | 'skipRoomWallTypesRef' | 't' | 'updateRoom'>;

const RoomModalContainer = (props: RoomModalContainerProps) => {
  const {
    addRoom,
    basePlan,
    getTypeIcon,
    getTypeLabel,
    handleCreateWallsForRoom,
    hasRoomOverlap,
    isPointInRoom,
    isReadOnly,
    isUserObject,
    markTouched,
    metersPerPixel,
    notifyRoomOverlap,
    openPhotoViewer,
    push,
    resolveRoomAssignmentForObject,
    roomDepartmentOptions,
    roomHasWalls,
    roomModal,
    roomModalBaseRoom,
    roomModalInitialSurfaceSqm,
    roomModalMetrics,
    roomModalPreview,
    roomStatsById,
    setConfirmDelete,
    setHighlightRoom,
    setObjectRoomIds,
    setRoomModal,
    setRoomWallPrompt,
    setSelectedRoomId,
    setSelectedRoomIds,
    siteFloorPlans,
    skipRoomWallTypesRef,
    t,
    updateRoom
  } = props;
  // The parent renders this only when the gate value is truthy; narrow it here so the
  // (previously enclosing-conditional) JSX type-checks identically.
  if (!roomModal) return null;
  return (
        <Suspense fallback={null}>
          <RoomModal
        open={!!roomModal}
        initialDepartmentsOpen={roomModal?.mode === 'edit' ? !!roomModal.openDepartments : false}
        initialName={roomModal?.mode === 'edit' ? roomModal.initialName : ''}
        initialNameEn={roomModal?.mode === 'edit' ? roomModal.initialNameEn : ''}
        initialDepartmentTags={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.departmentTags : undefined
        }
        departmentOptions={roomDepartmentOptions}
        initialColor={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.color : undefined
        }
        initialFillOpacity={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.fillOpacity : undefined
        }
        initialCapacity={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.capacity : undefined
        }
        initialLabelScale={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.labelScale : undefined
        }
        initialShowName={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.showName : undefined
        }
        initialSurfaceSqm={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.surfaceSqm : roomModalInitialSurfaceSqm
        }
        surfaceLocked={!!metersPerPixel}
        measurements={roomModalMetrics}
        shapePreview={roomModalPreview}
        initialNotes={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.notes : undefined
        }
        initialLogical={
          roomModal?.mode === 'edit' ? roomModalBaseRoom?.logical : undefined
        }
        initialMeetingRoom={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.meetingRoom : undefined
        }
        initialMeetingProjector={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.meetingProjector : undefined
        }
        initialMeetingTv={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.meetingTv : undefined
        }
        initialMeetingVideoConf={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.meetingVideoConf : undefined
        }
        initialMeetingCoffeeService={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.meetingCoffeeService : undefined
        }
        initialMeetingWhiteboard={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.meetingWhiteboard : undefined
        }
        initialMeetingKioskEnabled={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.meetingKioskEnabled : undefined
        }
        initialNoWindows={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.noWindows : undefined
        }
        initialWifiAvailable={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.wifiAvailable : undefined
        }
        initialFridgeAvailable={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.fridgeAvailable : undefined
        }
        initialStorageRoom={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.storageRoom : undefined
        }
        initialBathroom={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.bathroom : undefined
        }
        initialTechnicalRoom={
          roomModal?.mode === 'edit' ? !!roomModalBaseRoom?.technicalRoom : undefined
        }
        objects={roomModal?.mode === 'edit' ? roomStatsById.get(roomModal.roomId)?.items || [] : undefined}
        getTypeLabel={getTypeLabel}
        getTypeIcon={getTypeIcon}
        isUserObject={isUserObject}
        onOpenPhotos={openPhotoViewer}
        canCreateWalls={roomModal?.mode === 'edit' && !roomHasWalls && !isReadOnly}
        onCreateWalls={handleCreateWallsForRoom}
        onDeleteObject={
          !isReadOnly && roomModal?.mode === 'edit'
            ? (id) => {
                setConfirmDelete([id]);
              }
            : undefined
        }
        onClose={() => {
          skipRoomWallTypesRef.current = false;
          setRoomModal(null);
        }}
        kioskRoomId={roomModal?.mode === 'edit' ? roomModal.roomId : undefined}
        onSubmit={({
          name,
          nameEn,
          departmentTags,
          color,
          fillOpacity,
          capacity,
          labelScale,
          showName,
          surfaceSqm,
          notes,
          logical,
          meetingRoom,
          meetingProjector,
          meetingTv,
          meetingVideoConf,
          meetingCoffeeService,
          meetingWhiteboard,
          meetingKioskEnabled,
          noWindows,
          wifiAvailable,
          fridgeAvailable,
          storageRoom,
          bathroom,
          technicalRoom
        }) => {
          if (!roomModal || isReadOnly) return false;
          const normalizedMeetingName = String(name || '').trim().toLocaleLowerCase();
          const hasDuplicateMeetingRoomNameInSite = (excludeRoomId?: string) => {
            if (!meetingRoom || !normalizedMeetingName) return false;
            return (siteFloorPlans || []).some((fp) =>
              (fp.rooms || []).some((r) => {
                if (!r?.id) return false;
                if (excludeRoomId && String(r.id) === String(excludeRoomId)) return false;
                if (!(r as any)?.meetingRoom) return false;
                return String(r.name || '').trim().toLocaleLowerCase() === normalizedMeetingName;
              })
            );
          };
          if (roomModal.mode === 'edit') {
            if (hasDuplicateMeetingRoomNameInSite(roomModal.roomId)) {
              push(
                t({
                  it: `Esiste già una meeting room con nome "${name}" in questa sede. Usa un nome univoco.`,
                  en: `A meeting room named "${name}" already exists in this site. Use a unique name.`
                }),
                'danger'
              );
              return false;
            }
            const existing = roomModalBaseRoom;
            const nextRoom = {
              ...(existing || {}),
              name,
              nameEn,
              departmentTags,
              color,
              fillOpacity,
              capacity,
              labelScale,
              showName,
              surfaceSqm,
              notes,
              logical,
              meetingRoom,
              meetingProjector,
              meetingTv,
              meetingVideoConf,
              meetingCoffeeService,
              meetingWhiteboard,
              meetingKioskEnabled,
              noWindows,
              wifiAvailable,
              fridgeAvailable,
              storageRoom,
              bathroom,
              technicalRoom
            };
            if (hasRoomOverlap(nextRoom, roomModal.roomId)) {
              notifyRoomOverlap();
              return false;
            }
            markTouched();
            updateRoom(basePlan.id, roomModal.roomId, {
              name,
              nameEn,
              departmentTags,
              color,
              fillOpacity,
              capacity,
              labelScale,
              showName,
              surfaceSqm,
              notes,
              logical,
              meetingRoom,
              meetingProjector,
              meetingTv,
              meetingVideoConf,
              meetingCoffeeService,
              meetingWhiteboard,
              meetingKioskEnabled,
              noWindows,
              wifiAvailable,
              fridgeAvailable,
              storageRoom,
              bathroom,
              technicalRoom
            });
            push(
              t({ it: `Stanza aggiornata: ${name}`, en: `Room updated: ${name}` }),
              'success'
            );
            postAuditEvent({
              event: 'room_update',
              scopeType: 'plan',
              scopeId: basePlan.id,
              details: {
                id: roomModal.roomId,
                name,
                nameEn: nameEn ?? null,
                departmentTags: departmentTags || null,
                color: color || null,
                fillOpacity: fillOpacity ?? null,
                capacity: capacity ?? null,
                labelScale: labelScale ?? null,
                showName,
                surfaceSqm: surfaceSqm ?? null,
                notes: notes ?? null,
                logical: logical ?? null,
                meetingRoom: meetingRoom ?? null,
                meetingProjector: meetingProjector ?? null,
                meetingTv: meetingTv ?? null,
                meetingVideoConf: meetingVideoConf ?? null,
                meetingCoffeeService: meetingCoffeeService ?? null,
                meetingWhiteboard: meetingWhiteboard ?? null,
                meetingKioskEnabled: meetingKioskEnabled ?? null,
                noWindows: noWindows ?? null,
                wifiAvailable: wifiAvailable ?? null,
                fridgeAvailable: fridgeAvailable ?? null,
                storageRoom: storageRoom ?? null,
                bathroom: bathroom ?? null,
                technicalRoom: technicalRoom ?? null
              }
            });
            setSelectedRoomId(roomModal.roomId);
            setSelectedRoomIds([roomModal.roomId]);
            setHighlightRoom({ roomId: roomModal.roomId, until: Date.now() + 2600 });
            setRoomModal(null);
            return true;
          }
          if (hasDuplicateMeetingRoomNameInSite()) {
            push(
              t({
                it: `Esiste già una meeting room con nome "${name}" in questa sede. Usa un nome univoco.`,
                en: `A meeting room named "${name}" already exists in this site. Use a unique name.`
              }),
              'danger'
            );
            return false;
          }
          const testRoom =
            roomModal.kind === 'rect'
              ? {
                  id: 'new-room',
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  fillOpacity,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
                  meetingRoom,
                  meetingProjector,
                  meetingTv,
                  meetingVideoConf,
                  meetingCoffeeService,
                  meetingWhiteboard,
                  meetingKioskEnabled,
                  noWindows,
                  wifiAvailable,
                  fridgeAvailable,
                  storageRoom,
                  bathroom,
                  technicalRoom,
                  kind: 'rect',
                  ...roomModal.rect
                }
              : {
                  id: 'new-room',
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  fillOpacity,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
                  meetingRoom,
                  meetingProjector,
                  meetingTv,
                  meetingVideoConf,
                  meetingCoffeeService,
                  meetingWhiteboard,
                  meetingKioskEnabled,
                  noWindows,
                  wifiAvailable,
                  fridgeAvailable,
                  storageRoom,
                  bathroom,
                  technicalRoom,
                  kind: 'poly',
                  points: roomModal.points
                };
          if (hasRoomOverlap(testRoom)) {
            notifyRoomOverlap();
            return false;
          }
          markTouched();
          const id =
            roomModal.kind === 'rect'
              ? addRoom(basePlan.id, {
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  fillOpacity,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
                  meetingRoom,
                  meetingProjector,
                  meetingTv,
                  meetingVideoConf,
                  meetingCoffeeService,
                  meetingWhiteboard,
                  meetingKioskEnabled,
                  noWindows,
                  wifiAvailable,
                  fridgeAvailable,
                  storageRoom,
                  bathroom,
                  technicalRoom,
                  kind: 'rect',
                  ...roomModal.rect
                })
              : addRoom(basePlan.id, {
                  name,
                  nameEn,
                  departmentTags,
                  color,
                  fillOpacity,
                  capacity,
                  labelScale,
                  showName,
                  surfaceSqm,
                  notes,
                  logical,
                  meetingRoom,
                  meetingProjector,
                  meetingTv,
                  meetingVideoConf,
                  meetingCoffeeService,
                  meetingWhiteboard,
                  meetingKioskEnabled,
                  noWindows,
                  wifiAvailable,
                  fridgeAvailable,
                  storageRoom,
                  bathroom,
                  technicalRoom,
                  kind: 'poly',
                  points: roomModal.points
                });
          postAuditEvent({
            event: 'room_create',
            scopeType: 'plan',
            scopeId: basePlan.id,
            details: {
              id,
              name,
              nameEn: nameEn ?? null,
              departmentTags: departmentTags || null,
              kind: roomModal.kind,
                  color: color || null,
                  fillOpacity: fillOpacity ?? null,
                  capacity: capacity ?? null,
              labelScale: labelScale ?? null,
              showName,
              surfaceSqm: surfaceSqm ?? null,
              notes: notes ?? null,
              logical: logical ?? null,
              meetingRoom: meetingRoom ?? null,
              meetingProjector: meetingProjector ?? null,
              meetingTv: meetingTv ?? null,
              meetingVideoConf: meetingVideoConf ?? null,
              meetingCoffeeService: meetingCoffeeService ?? null,
              meetingWhiteboard: meetingWhiteboard ?? null,
              meetingKioskEnabled: meetingKioskEnabled ?? null,
              noWindows: noWindows ?? null,
              wifiAvailable: wifiAvailable ?? null,
              fridgeAvailable: fridgeAvailable ?? null,
              storageRoom: storageRoom ?? null,
              bathroom: bathroom ?? null,
              technicalRoom: technicalRoom ?? null
            }
          });
          const updates: Record<string, string | undefined> = {};
          const roomsForAssignment = [{ ...(testRoom as any), id }, ...((basePlan.rooms || []) as Room[])];
          for (const obj of basePlan.objects) {
            if (isPointInRoom({ ...testRoom, id }, obj.x, obj.y)) {
              updates[obj.id] = resolveRoomAssignmentForObject(id, obj.type, roomsForAssignment);
            }
          }
          if (Object.keys(updates).length) setObjectRoomIds(basePlan.id, updates);
          push(
            t({ it: `Stanza creata: ${name}`, en: `Room created: ${name}` }),
            'success'
          );
          setSelectedRoomId(id);
          setSelectedRoomIds([id]);
          setHighlightRoom({ roomId: id, until: Date.now() + 3200 });
          skipRoomWallTypesRef.current = false;
          setRoomModal(null);
          setRoomWallPrompt({
            roomId: id,
            roomName: name,
            kind: roomModal.kind,
            rect: roomModal.kind === 'rect' ? roomModal.rect : undefined,
            points: roomModal.kind === 'poly' ? roomModal.points : undefined
          });
          return true;
        }}
      />
        </Suspense>
  );
};

export default RoomModalContainer;
