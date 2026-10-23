import { describe, expect, it } from 'vitest';
import type { Corridor, FloorPlan, Room } from '../../store/types';
import {
  corridorPolygon, roomPolygon, getCorridorDoorAnchor, getCorridorConnectionAnchor,
  getPolygonEdgePoint, computeRoute, computeMultiFloorRoute, reverseRoute,
  buildWalkableGrid, buildCorridorGuides, findCenterBiasedPath
} from './internalMapRouting';

const corridor: Corridor = { id: 'c', name: 'Corridor', x: 0, y: 0, width: 160, height: 64 };
const room: Room = { id: 'r', name: 'Room', x: 0, y: 0, width: 100, height: 100 };
const plan: FloorPlan = { id: 'p', siteId: 's', name: 'Plan', imageUrl: '', objects: [], rooms: [room], corridors: [] };

describe('shared routing geometry', () => {
  it('uses the same rectangle and polygon rules for rooms and corridors', () => {
    expect(roomPolygon(room)).toEqual(corridorPolygon({ ...corridor, width: 100, height: 100 }));
    expect(roomPolygon({ ...room, width: -1 })).toEqual([]);
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }];
    expect(roomPolygon({ ...room, kind: 'poly', points })).toBe(points);
    expect(roomPolygon({ ...room, kind: 'poly', points: [] })).toEqual(roomPolygon(room));
  });

  it('clamps door ratios, wraps edge indices and rejects missing edges', () => {
    expect(getCorridorDoorAnchor(corridor, { edgeIndex: 0, t: 2 })).toEqual({ x: 160, y: 0 });
    expect(getCorridorDoorAnchor(corridor, { edgeIndex: -1, t: 0.5 })).toEqual({ x: 0, y: 32 });
    expect(getCorridorDoorAnchor(corridor, {})).toBeNull();
    expect(getPolygonEdgePoint([], 0, 0.5)).toBeNull();
  });

  it('preserves explicit connection coordinates and falls back to a polygon edge', () => {
    expect(getCorridorConnectionAnchor(corridor, { x: 0, y: 10 })).toEqual({ x: 0, y: 10 });
    expect(getCorridorConnectionAnchor(corridor, { edgeIndex: 0, t: 0.5 })).toEqual({ x: 80, y: 0 });
  });
});

describe('routing after module extraction', () => {
  it('keeps direct room routes, scale conversion and reverse symmetry', () => {
    const start = { x: 10, y: 10 }, end = { x: 40, y: 50 };
    const scaled = { ...plan, scale: { start, end, meters: 5, metersPerPixel: 0.1 } };
    const { route } = computeRoute(scaled, start, end);
    expect(route).toBeDefined();
    expect(route!.distancePx).toBe(50);
    expect(route!.distanceMeters).toBe(5);
    expect(reverseRoute(reverseRoute(route!))).toEqual(route);
    expect(computeMultiFloorRoute([scaled], 'p', 'p', start, end).result?.distanceMeters).toBe(5);
  });

  it('finds connected corridor paths and rejects disconnected grid components', () => {
    const { walkable, clearanceByKey } = buildWalkableGrid([corridor], 16);
    const { componentByKey, guideByComponent } = buildCorridorGuides(walkable, clearanceByKey);
    const path = findCenterBiasedPath('0:1', '9:1', walkable, clearanceByKey, componentByKey, guideByComponent);
    expect(path[0]).toBe('0:1');
    expect(path.at(-1)).toBe('9:1');
    expect(path.every((key) => walkable.has(key))).toBe(true);
    expect(findCenterBiasedPath('0:1', '99:99', walkable, clearanceByKey, componentByKey, guideByComponent)).toEqual([]);
  });
});
