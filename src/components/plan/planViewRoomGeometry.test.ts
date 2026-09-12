import { describe, it, expect } from 'vitest';
import {
  isPointInPoly,
  isPointInRoom,
  getRoomIdAt,
  isUserType,
  segmentsProperlyIntersect,
  isPointStrictlyInsidePolygon,
  polygonsOverlap,
  computeBuildRoomWallSegments
} from './planViewRoomGeometry';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
];

describe('isPointInPoly', () => {
  it('detects points inside / outside a square', () => {
    expect(isPointInPoly(square, 5, 5)).toBe(true);
    expect(isPointInPoly(square, 15, 5)).toBe(false);
    expect(isPointInPoly(square, -1, 5)).toBe(false);
  });
});

describe('isPointInRoom', () => {
  it('handles rect rooms', () => {
    const room = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    expect(isPointInRoom(room, 5, 5)).toBe(true);
    expect(isPointInRoom(room, 11, 5)).toBe(false);
  });
  it('handles poly rooms', () => {
    const room = { kind: 'poly', points: square };
    expect(isPointInRoom(room, 5, 5)).toBe(true);
    expect(isPointInRoom(room, 20, 20)).toBe(false);
  });
  it('falls back to rect bounds for degenerate polys', () => {
    const room = { kind: 'poly', points: [{ x: 0, y: 0 }], x: 0, y: 0, width: 10, height: 10 };
    expect(isPointInRoom(room, 5, 5)).toBe(true);
  });
});

describe('getRoomIdAt', () => {
  it('returns the topmost (last) matching room id', () => {
    const rooms = [
      { id: 'a', kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      { id: 'b', kind: 'rect', x: 0, y: 0, width: 10, height: 10 }
    ];
    expect(getRoomIdAt(rooms, 5, 5)).toBe('b');
  });
  it('returns undefined when no room contains the point', () => {
    expect(getRoomIdAt([{ id: 'a', kind: 'rect', x: 0, y: 0, width: 4, height: 4 }], 9, 9)).toBeUndefined();
    expect(getRoomIdAt(undefined, 0, 0)).toBeUndefined();
  });
});

describe('isUserType', () => {
  it('recognizes user-like type ids', () => {
    expect(isUserType('user')).toBe(true);
    expect(isUserType('real_user')).toBe(true);
    expect(isUserType('generic_user')).toBe(true);
    expect(isUserType('desk')).toBe(false);
    expect(isUserType(null)).toBe(false);
  });
});

describe('segmentsProperlyIntersect', () => {
  it('detects a proper crossing (X shape)', () => {
    expect(segmentsProperlyIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
  });
  it('returns false for parallel / non-crossing segments', () => {
    expect(segmentsProperlyIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
  });
});

describe('isPointStrictlyInsidePolygon', () => {
  it('is true well inside, false on/near an edge', () => {
    expect(isPointStrictlyInsidePolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(isPointStrictlyInsidePolygon({ x: 0, y: 5 }, square)).toBe(false); // on the edge
  });
});

describe('polygonsOverlap', () => {
  it('true for overlapping, false for disjoint', () => {
    const shifted = square.map((p) => ({ x: p.x + 5, y: p.y + 5 }));
    const far = square.map((p) => ({ x: p.x + 100, y: p.y + 100 }));
    expect(polygonsOverlap(square, shifted)).toBe(true);
    expect(polygonsOverlap(square, far)).toBe(false);
  });
});

describe('computeBuildRoomWallSegments', () => {
  const deps = { formatCornerLabel: (i: number) => String.fromCharCode(65 + i) };
  it('builds 4 labelled segments for a rect room', () => {
    const segs = computeBuildRoomWallSegments({ kind: 'rect', rect: { x: 0, y: 0, width: 10, height: 10 } }, deps);
    expect(segs.map((s) => s.label)).toEqual(['A-B', 'B-C', 'C-D', 'D-A']);
    expect(segs[0]).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } });
  });
  it('returns [] for a zero-area rect', () => {
    expect(computeBuildRoomWallSegments({ kind: 'rect', rect: { x: 0, y: 0, width: 0, height: 10 } }, deps)).toEqual([]);
  });
});
