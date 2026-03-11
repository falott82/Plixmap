import type { Corridor, FloorPlan } from '../../store/types';

type Translator = (msg: { it: string; en: string }) => string;

type DeleteShortcutStaticDeps = {
  markTouched: () => void,
  updateFloorPlan: (planId: string, patch: any) => void,
  setSelectedCorridorDoor: (value: any) => void,
  setSelectedRoomDoorId: (value: any) => void,
  setConfirmDeleteRoomId: (value: any) => void,
  setConfirmDeleteRoomIds: (value: any) => void,
  setConfirmDeleteCorridorId: (value: any) => void,
  deleteLink: (planId: string, linkId: string) => void,
  postAuditEvent: (payload: any) => void,
  push: (message: string, kind: 'info' | 'success' | 'danger') => void,
  setSelectedLinkId: (value: any) => void,
  setPendingRoomDeletes: (value: string[]) => void,
  setConfirmDelete: (value: string[] | null) => void,
  isRackLinkId: (id: string) => boolean,
  t: Translator
};

export const createPlanDeleteShortcutHandler = ({
  markTouched,
  updateFloorPlan,
  setSelectedCorridorDoor,
  setSelectedRoomDoorId,
  setConfirmDeleteRoomId,
  setConfirmDeleteRoomIds,
  setConfirmDeleteCorridorId,
  deleteLink,
  postAuditEvent,
  push,
  setSelectedLinkId,
  setPendingRoomDeletes,
  setConfirmDelete,
  isRackLinkId,
  t
}: DeleteShortcutStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    currentSelectedIds: string[],
    selectedRoomId: string | undefined,
    selectedRoomIds: string[],
    selectedCorridorId: string | undefined,
    selectedCorridorDoor: { corridorId: string; doorId: string } | null,
    selectedRoomDoorId: string | null,
    selectedLinkId: string | null,
    isReadOnly: boolean
  ): boolean => {
    const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace';
    if (!isDeleteKey || !currentPlan) return false;

    if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && selectedCorridorDoor) {
      e.preventDefault();
      if (isReadOnly) return true;
      const currentCorridors = (((currentPlan.corridors || []) as Corridor[])).filter(Boolean);
      const next = currentCorridors.map((corridor) => {
        if (corridor.id !== selectedCorridorDoor.corridorId) return corridor;
        const doors = Array.isArray(corridor.doors) ? corridor.doors.filter((door) => door.id !== selectedCorridorDoor.doorId) : [];
        return { ...corridor, doors };
      });
      markTouched();
      updateFloorPlan(currentPlan.id, { corridors: next } as any);
      setSelectedCorridorDoor(null);
      push(t({ it: 'Porta del corridoio eliminata', en: 'Corridor door deleted' }), 'info');
      return true;
    }

    if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && selectedRoomDoorId) {
      e.preventDefault();
      if (isReadOnly) return true;
      const currentDoors = Array.isArray((currentPlan as any).roomDoors) ? ((currentPlan as any).roomDoors as any[]) : [];
      const nextDoors = currentDoors.filter((door) => String((door as any)?.id || '') !== String(selectedRoomDoorId));
      markTouched();
      updateFloorPlan(currentPlan.id, { roomDoors: nextDoors as any } as any);
      setSelectedRoomDoorId(null);
      push(t({ it: 'Porta di collegamento eliminata', en: 'Connecting door deleted' }), 'info');
      return true;
    }

    if (!currentSelectedIds.length && selectedRoomIds.length) {
      e.preventDefault();
      if (isReadOnly) return true;
      if (selectedRoomIds.length === 1) setConfirmDeleteRoomId(selectedRoomIds[0]);
      else setConfirmDeleteRoomIds([...selectedRoomIds]);
      return true;
    }

    if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && selectedCorridorId) {
      e.preventDefault();
      if (isReadOnly) return true;
      setConfirmDeleteCorridorId(selectedCorridorId);
      return true;
    }

    if (!currentSelectedIds.length && !selectedRoomId && !selectedRoomIds.length && !selectedCorridorId && selectedLinkId) {
      e.preventDefault();
      if (isRackLinkId(selectedLinkId)) return true;
      if (isReadOnly) return true;
      markTouched();
      deleteLink(currentPlan.id, selectedLinkId);
      postAuditEvent({ event: 'link_delete', scopeType: 'plan', scopeId: currentPlan.id, details: { id: selectedLinkId } });
      push(t({ it: 'Collegamento eliminato', en: 'Link deleted' }), 'info');
      setSelectedLinkId(null);
      return true;
    }

    if (!currentSelectedIds.length) return false;
    e.preventDefault();
    setPendingRoomDeletes([...selectedRoomIds]);
    setConfirmDelete([...currentSelectedIds]);
    return true;
  };
