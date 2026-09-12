import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_WALL_TYPES } from '../../store/data';

type WallTypeModalLike = { typeId: string } | null;
type RoomWallTypeModalLike = { segments: unknown[]; wallTypes?: string[] } | null;

export type UsePlanWallTypeModalEffectsDeps = {
  wallTypeModal: WallTypeModalLike;
  setWallTypeDraft: Dispatch<SetStateAction<string>>;
  roomWallTypeModal: RoomWallTypeModalLike;
  setRoomWallTypeSelections: Dispatch<SetStateAction<string[]>>;
  defaultWallTypeId: string | undefined;
};

/**
 * Draft-sync effects for the wall-type modals: seed the single wall-type draft
 * when the wall-type modal opens, and seed the per-segment selections (from the
 * room's stored wall types or the default) when the room-wall-type modal opens.
 */
export function usePlanWallTypeModalEffects(deps: UsePlanWallTypeModalEffectsDeps) {
  const { wallTypeModal, setWallTypeDraft, roomWallTypeModal, setRoomWallTypeSelections, defaultWallTypeId } = deps;

  useEffect(() => {
    if (!wallTypeModal) return;
    setWallTypeDraft(wallTypeModal.typeId);
  }, [wallTypeModal]);

  useEffect(() => {
    if (!roomWallTypeModal) {
      setRoomWallTypeSelections([]);
      return;
    }
    const nextDefault = defaultWallTypeId || DEFAULT_WALL_TYPES[0];
    const desired =
      roomWallTypeModal.wallTypes && roomWallTypeModal.wallTypes.length === roomWallTypeModal.segments.length
        ? roomWallTypeModal.wallTypes
        : roomWallTypeModal.segments.map(() => nextDefault);
    setRoomWallTypeSelections(desired);
  }, [defaultWallTypeId, roomWallTypeModal]);
}
