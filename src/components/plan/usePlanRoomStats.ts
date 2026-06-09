/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef } from 'react';
import type { MapObject } from '../../store/types';
import { computeRoomStatsById } from './planViewComputeBits2';
import { computeCorridorDoorLinkRoomEntries } from './planViewMiscTools';

// Room occupancy stats + corridor-door-link room entries extracted from usePlanView. Pure read-only
// derivations; owns the stats cache ref internally. Bodies moved verbatim (dep arrays preserved).
export const usePlanRoomStats = (deps: any) => {
  const { renderPlan, isUserObject, corridorDoorLinkModal, corridorDoorLinkQuery, getUserObjectLabel, lang } = deps;

  const roomStatsCacheRef = useRef<{
    key: string;
    value: Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }>;
  }>({ key: '', value: new Map() });
  const roomStatsById = useMemo(
    () => computeRoomStatsById({ renderPlan, isUserObject, roomStatsCacheRef }),
    [isUserObject, renderPlan?.objects]
  );
  const corridorDoorLinkRoomEntries = useMemo(() => {
    return computeCorridorDoorLinkRoomEntries({
      corridorDoorLinkModal,
      corridorDoorLinkQuery,
      getUserObjectLabel,
      isUserObject,
      lang,
      renderPlan,
      roomStatsById
    });
  }, [corridorDoorLinkModal?.magneticRoomIds, corridorDoorLinkModal?.nearestRoomId, corridorDoorLinkQuery, getUserObjectLabel, isUserObject, lang, renderPlan?.rooms, roomStatsById]);

  return { roomStatsById, corridorDoorLinkRoomEntries };
};
