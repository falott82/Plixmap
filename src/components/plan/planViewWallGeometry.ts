import { DEFAULT_WALL_TYPES } from '../../store/data';
import type { FloorPlan, MapObject, Room } from '../../store/types';
import type { useT } from '../../i18n/useT';

type Pt = { x: number; y: number };
type WallSegment = { start: Pt; end: Pt; label: string };

export type WallPolygonDeps = {
  renderPlan: FloorPlan | undefined;
  renderPlanObjectById: Map<string, MapObject>;
  renderPlanRoomById: Map<string, Room>;
  isWallType: (type: string) => boolean;
  formatCornerLabel: (index: number) => string;
  buildRoomWallSegments: (room: {
    kind: 'rect' | 'poly';
    rect?: { x: number; y: number; width: number; height: number };
    points?: Pt[];
  }) => WallSegment[];
  t: ReturnType<typeof useT>;
  defaultWallTypeId: string;
};

// Pure computation extracted from usePlanView's getWallPolygonData useCallback. Behaviour is
// identical; the closed-over values are passed in via `deps` (which mirror the original
// useCallback dependency array), keeping the hook wrapper and its deps unchanged.
export const computeWallPolygonData = (wallId: string, deps: WallPolygonDeps) => {
  const {
    renderPlan,
    renderPlanObjectById,
    renderPlanRoomById,
    isWallType,
    formatCornerLabel,
    buildRoomWallSegments,
    t,
    defaultWallTypeId
  } = deps;
  if (!renderPlan) return null;
  const wall = renderPlanObjectById.get(wallId);
  if (!wall || !isWallType(wall.type)) return null;

  const groupId = String((wall as any).wallGroupId || '');
  if (groupId) {
    const groupWalls = renderPlan.objects.filter(
      (o) => isWallType(o.type) && String((o as any).wallGroupId || '') === groupId
    );
    if (groupWalls.length >= 3) {
      const room = renderPlanRoomById.get(groupId);
      const ordered = groupWalls
        .slice()
        .sort((a, b) => Number((a as any).wallGroupIndex ?? 0) - Number((b as any).wallGroupIndex ?? 0));
      const segmentsFromWalls = ordered
        .map((w, index) => {
          const pts = (w as any).points as { x: number; y: number }[] | undefined;
          if (!Array.isArray(pts) || pts.length < 2) return null;
          const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % ordered.length)}`;
          return { start: pts[0], end: pts[1], label };
        })
        .filter(Boolean) as { start: { x: number; y: number }; end: { x: number; y: number }; label: string }[];
      let segments: { start: { x: number; y: number }; end: { x: number; y: number }; label: string }[] = segmentsFromWalls;
      if (room) {
        const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
        const roomSegments = buildRoomWallSegments({
          kind,
          rect: kind === 'rect' ? { x: room.x || 0, y: room.y || 0, width: room.width || 0, height: room.height || 0 } : undefined,
          points: kind === 'poly' ? room.points || [] : undefined
        });
        if (roomSegments.length === ordered.length) segments = roomSegments;
      }
      const wallIds = ordered.map((w) => w.id);
      const wallTypes = ordered.map((w) => w.type);
      return {
        roomId: groupId,
        roomName: room?.name || t({ it: 'Poligono muri', en: 'Wall polygon' }),
        segments,
        wallIds,
        wallTypes
      };
    }
  }

  const walls = renderPlan.objects.filter((o) => isWallType(o.type));
  const byId = new Map(walls.map((w) => [w.id, w]));
  const keyOf = (p: { x: number; y: number }) =>
    `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`;
  const adjacency = new Map<string, Array<{ wallId: string; otherKey: string; otherPoint: { x: number; y: number } }>>();
  const addAdj = (from: { x: number; y: number }, to: { x: number; y: number }, id: string) => {
    const fromKey = keyOf(from);
    const list = adjacency.get(fromKey) || [];
    list.push({ wallId: id, otherKey: keyOf(to), otherPoint: to });
    adjacency.set(fromKey, list);
  };
  walls.forEach((w) => {
    const pts = (w as any).points as { x: number; y: number }[] | undefined;
    if (!Array.isArray(pts) || pts.length < 2) return;
    addAdj(pts[0], pts[1], w.id);
    addAdj(pts[1], pts[0], w.id);
  });

  const startWall = byId.get(wallId);
  const startPts = (startWall as any)?.points as { x: number; y: number }[] | undefined;
  if (!startWall || !startPts || startPts.length < 2) return null;

  const tryBuild = (startPoint: { x: number; y: number }, nextPoint: { x: number; y: number }) => {
    const startKey = keyOf(startPoint);
    let currentKey = keyOf(nextPoint);
    const wallIds = [startWall.id];
    const points = [startPoint, nextPoint];
    const visited = new Set<string>(wallIds);
    let guard = 0;
    while (guard < walls.length + 2) {
      guard += 1;
      if (currentKey === startKey) {
        return wallIds.length >= 3 ? { wallIds, points } : null;
      }
      const options = (adjacency.get(currentKey) || []).filter((o) => !visited.has(o.wallId));
      if (options.length !== 1) return null;
      const next = options[0];
      visited.add(next.wallId);
      wallIds.push(next.wallId);
      points.push(next.otherPoint);
      currentKey = next.otherKey;
    }
    return null;
  };

  const attempt = tryBuild(startPts[0], startPts[1]) || tryBuild(startPts[1], startPts[0]);
  if (!attempt) return null;
  const pts = attempt.points.slice();
  if (pts.length < 3) return null;
  if (pts.length > 2 && keyOf(pts[0]) === keyOf(pts[pts.length - 1])) {
    pts.pop();
  }
  if (pts.length < 3) return null;
  const segments = pts.map((start, index) => {
    const end = pts[(index + 1) % pts.length];
    const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % pts.length)}`;
    return { start, end, label };
  });
  const wallIds = attempt.wallIds;
  const wallTypes = wallIds.map((id) => byId.get(id)?.type || defaultWallTypeId || DEFAULT_WALL_TYPES[0]);
  return {
    roomId: wallId,
    roomName: t({ it: 'Poligono muri', en: 'Wall polygon' }),
    segments,
    wallIds,
    wallTypes
  };
};
