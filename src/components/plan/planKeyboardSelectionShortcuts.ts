import type { FloorPlan } from '../../store/types';

type Translator = (msg: { it: string; en: string }) => string;

type SelectAllStaticDeps = {
  setSelectedCorridorId: (value: string | undefined) => void,
  setSelectedCorridorDoor: (value: any) => void,
  setSelectedRoomDoorId: (value: string | null) => void,
  setSelection: (ids: string[]) => void,
  setContextMenu: (value: any) => void,
  setSelectedRoomId: (value: string | undefined) => void,
  setSelectedRoomIds: (value: string[]) => void,
  setSelectedLinkId: (value: string | null) => void,
  push: (message: string, kind: 'info' | 'success' | 'danger') => void,
  t: Translator
};

type EscapeSelectionStaticDeps = {
  setContextMenu: (value: any) => void,
  clearSelection: () => void,
  setSelectedRoomId: (value: string | undefined) => void,
  setSelectedRoomIds: (value: string[]) => void,
  setSelectedCorridorId: (value: string | undefined) => void,
  setSelectedCorridorDoor: (value: any) => void,
  setSelectedRoomDoorId: (value: string | null) => void,
  setSelectedLinkId: (value: string | null) => void
};

export const createPlanSelectAllShortcutHandler = ({
  setSelectedCorridorId,
  setSelectedCorridorDoor,
  setSelectedRoomDoorId,
  setSelection,
  setContextMenu,
  setSelectedRoomId,
  setSelectedRoomIds,
  setSelectedLinkId,
  push,
  t
}: SelectAllStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null
  ): boolean => {
    if (!currentPlan) return true;
    e.preventDefault();
    const allIds = (currentPlan.objects || []).map((obj) => obj.id);
    const allRoomIds = (currentPlan.rooms || []).map((room) => room.id);
    setSelectedCorridorId(undefined);
    setSelectedCorridorDoor(null);
    setSelectedRoomDoorId(null);
    setSelection(allIds);
    setContextMenu(null);
    setSelectedRoomId(allRoomIds.length === 1 ? allRoomIds[0] : undefined);
    setSelectedRoomIds(allRoomIds);
    setSelectedLinkId(null);
    push(
      t({
        it: `Selezionati ${allIds.length} oggetti e ${allRoomIds.length} stanze (Ctrl/Cmd+A).`,
        en: `Selected ${allIds.length} objects and ${allRoomIds.length} rooms (Ctrl/Cmd+A).`
      }),
      'info'
    );
    return true;
  };

export const createPlanEscapeSelectionShortcutHandler = ({
  setContextMenu,
  clearSelection,
  setSelectedRoomId,
  setSelectedRoomIds,
  setSelectedCorridorId,
  setSelectedCorridorDoor,
  setSelectedRoomDoorId,
  setSelectedLinkId
}: EscapeSelectionStaticDeps) =>
  (
    e: KeyboardEvent,
    hasPhotoViewer: boolean,
    currentSelectedIds: string[],
    selectedRoomId: string | undefined,
    selectedRoomIds: string[],
    selectedCorridorId: string | undefined,
    selectedCorridorDoor: any,
    selectedRoomDoorId: string | null
  ): boolean => {
    if (hasPhotoViewer) return true;
    if (currentSelectedIds.length || selectedRoomId || selectedRoomIds.length || selectedCorridorId || selectedCorridorDoor || selectedRoomDoorId) {
      e.preventDefault();
      setContextMenu(null);
      clearSelection();
      setSelectedRoomId(undefined);
      setSelectedRoomIds([]);
      setSelectedCorridorId(undefined);
      setSelectedCorridorDoor(null);
      setSelectedRoomDoorId(null);
      setSelectedLinkId(null);
    }
    return true;
  };
