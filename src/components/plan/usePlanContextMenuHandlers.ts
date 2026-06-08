import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PlanContextMenuState } from './usePlanContextDerived';

type XY = { clientX: number; clientY: number };
type WorldXY = XY & { worldX: number; worldY: number };

// Context-menu open handlers extracted from usePlanView. Each is a thin setter
// that dismisses selection hints and opens the typed context menu; room context
// first tries to consume an in-progress room-door draft. Bodies are verbatim.
export const usePlanContextMenuHandlers = (deps: {
  dismissSelectionHintToasts: () => void;
  setContextMenu: Dispatch<SetStateAction<PlanContextMenuState>>;
  roomDoorDraft: unknown;
  createRoomDoorFromDraft: (roomId: string, point: { x: number; y: number }) => boolean | void;
  planScale: { start?: unknown; end?: unknown } | null | undefined;
  isRackLinkId: (id: string) => boolean;
}) => {
  const { dismissSelectionHintToasts, setContextMenu, roomDoorDraft, createRoomDoorFromDraft, planScale, isRackLinkId } = deps;

  const handleObjectContextMenu = useCallback(
    ({ id, clientX, clientY, wallSegmentLengthPx }: { id: string; wallSegmentLengthPx?: number } & XY) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'object', id, x: clientX, y: clientY, wallSegmentLengthPx });
    },
    [dismissSelectionHintToasts, setContextMenu]
  );

  const handleLinkContextMenu = useCallback(
    ({ id, clientX, clientY }: { id: string } & XY) => {
      if (isRackLinkId(id)) return;
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'link', id, x: clientX, y: clientY });
    },
    [dismissSelectionHintToasts, isRackLinkId, setContextMenu]
  );

  const handleSafetyCardContextMenu = useCallback(
    ({ clientX, clientY, worldX, worldY }: WorldXY) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'safety_card', x: clientX, y: clientY, worldX, worldY });
    },
    [dismissSelectionHintToasts, setContextMenu]
  );

  const handleRoomContextMenu = useCallback(
    ({ id, clientX, clientY, worldX, worldY }: { id: string } & WorldXY) => {
      dismissSelectionHintToasts();
      if (roomDoorDraft) {
        if (createRoomDoorFromDraft(id, { x: worldX, y: worldY })) return;
      }
      setContextMenu({ kind: 'room', id, x: clientX, y: clientY, worldX, worldY });
    },
    [createRoomDoorFromDraft, dismissSelectionHintToasts, roomDoorDraft, setContextMenu]
  );

  const handleCorridorContextMenu = useCallback(
    ({ id, clientX, clientY, worldX, worldY }: { id: string } & WorldXY) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'corridor', id, x: clientX, y: clientY, worldX, worldY });
    },
    [dismissSelectionHintToasts, setContextMenu]
  );

  const handleCorridorConnectionContextMenu = useCallback(
    ({
      corridorId,
      connectionId,
      clientX,
      clientY,
      worldX,
      worldY
    }: { corridorId: string; connectionId: string } & WorldXY) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'corridor_connection', corridorId, connectionId, x: clientX, y: clientY, worldX, worldY });
    },
    [dismissSelectionHintToasts, setContextMenu]
  );

  const handleCorridorDoorContextMenu = useCallback(
    ({ corridorId, doorId, clientX, clientY }: { corridorId: string; doorId: string } & XY) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'corridor_door', corridorId, doorId, x: clientX, y: clientY });
    },
    [dismissSelectionHintToasts, setContextMenu]
  );

  const handleRoomDoorContextMenu = useCallback(
    ({ doorId, clientX, clientY }: { doorId: string } & XY) => {
      dismissSelectionHintToasts();
      setContextMenu({ kind: 'room_door', doorId, x: clientX, y: clientY });
    },
    [dismissSelectionHintToasts, setContextMenu]
  );

  const handleScaleContextMenu = useCallback(
    ({ clientX, clientY }: XY) => {
      if (!planScale?.start || !planScale?.end) return;
      setContextMenu({ kind: 'scale', x: clientX, y: clientY });
    },
    [planScale?.end, planScale?.start, setContextMenu]
  );

  return {
    handleObjectContextMenu,
    handleLinkContextMenu,
    handleSafetyCardContextMenu,
    handleRoomContextMenu,
    handleCorridorContextMenu,
    handleCorridorConnectionContextMenu,
    handleCorridorDoorContextMenu,
    handleRoomDoorContextMenu,
    handleScaleContextMenu
  };
};
