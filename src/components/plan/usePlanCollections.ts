/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import type { Corridor, IconName, MapObject, Room, RoomConnectionDoor } from '../../store/types';
import { computeCollectUserDepartments } from './planViewComputeBits';

// Plan collection derivations (objects grouped by type, per-type counts, user-object predicates/
// labels, rooms/corridors/corridor index/room doors) extracted from usePlanView. Pure derivations
// of the render plan + type catalog; bodies moved verbatim (dep arrays preserved exactly).
export const usePlanCollections = (deps: any) => {
  const { renderPlan, objectTypeDefs, getTypeLabel, t } = deps;

  const objectsByType = useMemo(() => {
    const map = new Map<string, any[]>();
    const objs = renderPlan?.objects || [];
    for (const obj of objs) {
      const list = map.get(obj.type) || [];
      list.push(obj);
      map.set(obj.type, list);
    }
    return map;
  }, [renderPlan?.objects]);

  const counts = useMemo<{ id: string; label: string; icon?: IconName; count: number }[]>(
    () =>
      (objectTypeDefs || [])
        .map((def: any) => ({
          id: def.id,
          label: getTypeLabel(def.id),
          icon: def.icon,
          count: (objectsByType.get(def.id) || []).length
        }))
        .filter((t: { count: number }) => t.count > 0),
    [getTypeLabel, objectTypeDefs, objectsByType]
  );

  const isUserObject = useCallback((type: string) => type === 'user' || type === 'real_user' || type === 'generic_user', []);
  const getUserObjectLabel = useCallback(
    (obj: MapObject) => {
      const first = String((obj as any).firstName || '').trim();
      const last = String((obj as any).lastName || '').trim();
      if (obj.type === 'real_user' && (first || last)) return `${first} ${last}`.trim();
      const name = String(obj.name || '').trim();
      return name || t({ it: 'Utente', en: 'User' });
    },
    [t]
  );
  const collectUserDepartments = useCallback((obj: MapObject) => computeCollectUserDepartments(obj), []);

  const rooms = useMemo<Room[]>(() => (renderPlan?.rooms || []) as Room[], [renderPlan?.rooms]);
  const corridors = useMemo(() => (renderPlan?.corridors || []) as Corridor[], [renderPlan?.corridors]);
  const corridorById = useMemo(() => {
    const map = new Map<string, Corridor>();
    for (const corridor of corridors) map.set(corridor.id, corridor);
    return map;
  }, [corridors]);
  const roomDoors = useMemo(() => ((renderPlan as any)?.roomDoors || []) as RoomConnectionDoor[], [(renderPlan as any)?.roomDoors]);

  return {
    objectsByType,
    counts,
    isUserObject,
    getUserObjectLabel,
    collectUserDepartments,
    rooms,
    corridors,
    corridorById,
    roomDoors,
  };
};
