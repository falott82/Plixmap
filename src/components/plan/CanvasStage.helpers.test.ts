import { describe, it, expect } from 'vitest';
import {
  hexToRgba,
  formatMeasure,
  getRotatedRectBounds,
  getViewportWorldBounds,
  isObjectPotentiallyVisible,
  intersectRaySegment,
  polygonCentroid,
  getRoomBounds,
  getRoomPolygonPoints,
  getCorridorPolygonPoints,
  getCorridorEdgePoint,
  getClosestCorridorEdgePoint,
  getRoomEdgePoint,
  pointInPolygon,
  distancePointToSegment,
  nearestWallSegment,
  findInteriorPointAtY,
  getPolygonBounds,
  getPolygonLabelBounds,
  buildCameraFovPolygon,
  dragRectFromCorners,
  findNearestRoomCorner,
  buildWallSegments,
  buildCameraWallSegments,
  buildWifiRayAngles
} from './CanvasStage.helpers';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
];

describe('hexToRgba', () => {
  it('expands shorthand and full hex', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255,255,255,1)');
    expect(hexToRgba('#000000', 0.5)).toBe('rgba(0,0,0,0.5)');
  });
  it('clamps alpha and falls back on invalid hex', () => {
    expect(hexToRgba('#ffffff', 5)).toBe('rgba(255,255,255,1)');
    expect(hexToRgba('not-a-color', 0.3)).toBe('rgba(100,116,139,0.3)');
  });
});

describe('formatMeasure', () => {
  it('trims trailing .00 and handles non-finite', () => {
    expect(formatMeasure(3)).toBe('3');
    expect(formatMeasure(3.5)).toBe('3.50');
    expect(formatMeasure(Number.NaN)).toBe('0');
  });
});

describe('getRotatedRectBounds', () => {
  it('returns axis-aligned bounds for 0 rotation', () => {
    expect(getRotatedRectBounds(0, 0, 10, 20, 0)).toEqual({ minX: -5, minY: -10, maxX: 5, maxY: 10 });
  });
  it('returns null for degenerate size', () => {
    expect(getRotatedRectBounds(0, 0, 0, 20, 0)).toBeNull();
  });
  it('rotating 90° swaps width/height extents', () => {
    const b = getRotatedRectBounds(0, 0, 10, 20, 90)!;
    expect(Math.round(b.maxX - b.minX)).toBe(20);
    expect(Math.round(b.maxY - b.minY)).toBe(10);
  });
});

describe('getViewportWorldBounds', () => {
  it('maps screen viewport to world space via pan/zoom', () => {
    expect(getViewportWorldBounds({ width: 100, height: 50 }, { x: 0, y: 0 }, 2)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 25
    });
  });
});

describe('isObjectPotentiallyVisible', () => {
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  it('accepts objects inside the margin and rejects far ones', () => {
    expect(isObjectPotentiallyVisible({ x: 50, y: 50 } as any, bounds, 10)).toBe(true);
    expect(isObjectPotentiallyVisible({ x: 500, y: 50 } as any, bounds, 10)).toBe(false);
  });
});

describe('intersectRaySegment', () => {
  it('finds the ray parameter where it crosses a segment', () => {
    const t = intersectRaySegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: -1 }, { x: 5, y: 1 });
    expect(t).toBeCloseTo(5, 5);
  });
  it('returns null when parallel or behind', () => {
    expect(intersectRaySegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 5, y: 1 })).toBeNull();
    expect(intersectRaySegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -5, y: -1 }, { x: -5, y: 1 })).toBeNull();
  });
});

describe('polygonCentroid', () => {
  it('computes the centroid of a square', () => {
    expect(polygonCentroid(square)).toEqual({ x: 5, y: 5 });
  });
  it('falls back to vertex average for degenerate area', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 4, y: 0 }
    ];
    expect(polygonCentroid(line)).toEqual({ x: 2, y: 0 });
  });
});

describe('room/corridor polygon + bounds', () => {
  it('getRoomBounds handles rect and poly', () => {
    expect(getRoomBounds({ kind: 'rect', x: 1, y: 2, width: 3, height: 4 })).toEqual({ minX: 1, minY: 2, maxX: 4, maxY: 6 });
    expect(getRoomBounds({ kind: 'poly', points: square })).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
  it('getRoomPolygonPoints derives rect corners', () => {
    expect(getRoomPolygonPoints({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 })).toEqual(square);
  });
  it('getCorridorPolygonPoints derives rect corners', () => {
    expect(getCorridorPolygonPoints({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 })).toEqual(square);
  });
});

describe('edge points', () => {
  it('getCorridorEdgePoint / getRoomEdgePoint interpolate along an edge', () => {
    expect(getCorridorEdgePoint(square, 0, 0.5)).toEqual({ x: 5, y: 0 });
    expect(getRoomEdgePoint(square, 1, 0.5)).toEqual({ x: 10, y: 5 });
  });
  it('getClosestCorridorEdgePoint finds the nearest edge projection', () => {
    const best = getClosestCorridorEdgePoint(square, { x: 5, y: -3 })!;
    expect(best.edgeIndex).toBe(0);
    expect(best).toMatchObject({ x: 5, y: 0 });
  });
});

describe('point/segment utilities', () => {
  it('pointInPolygon detects inside/outside', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });
  it('distancePointToSegment measures perpendicular + endpoint distance', () => {
    expect(distancePointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3, 5);
    expect(distancePointToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(4, 5);
  });
  it('nearestWallSegment returns the closest polyline edge', () => {
    const seg = nearestWallSegment(square, { x: 5, y: -2 })!;
    expect(seg.index).toBe(0);
  });
  it('findInteriorPointAtY returns the widest interior midpoint', () => {
    const p = findInteriorPointAtY(5, square)!;
    expect(p).toEqual({ x: 5, y: 5 });
  });
});

describe('polygon label bounds', () => {
  it('getPolygonBounds returns x/y/width/height', () => {
    expect(getPolygonBounds(square)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
  it('getPolygonLabelBounds stays within the polygon bounds', () => {
    const b = getPolygonLabelBounds(square);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(10.0001);
    expect(b.y + b.height).toBeLessThanOrEqual(10.0001);
  });
});

describe('wall segments + ray angles', () => {
  const walls = [
    { type: 'concrete', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
    { type: 'glass', points: [{ x: 0, y: 5 }, { x: 5, y: 5 }] }
  ];
  it('buildWallSegments emits attenuating segments, skipping zero-attenuation types', () => {
    const map = new Map<string, number>([['concrete', 6]]); // glass absent -> 0
    const segs = buildWallSegments(walls, map);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ attenuation: 6 });
  });
  it('buildCameraWallSegments drops glass/window walls', () => {
    const segs = buildCameraWallSegments(walls);
    expect(segs).toHaveLength(2); // only the 2 concrete segments; glass excluded
  });
  it('buildWifiRayAngles spans a full circle', () => {
    const angles = buildWifiRayAngles(4);
    expect(angles).toHaveLength(4);
    expect(angles[0]).toBe(0);
    expect(angles[1]).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('dragRectFromCorners', () => {
  it('normalizes two corners into an axis-aligned rect regardless of order', () => {
    expect(dragRectFromCorners(2, 3, 8, 9)).toEqual({ x: 2, y: 3, width: 6, height: 6 });
    expect(dragRectFromCorners(8, 9, 2, 3)).toEqual({ x: 2, y: 3, width: 6, height: 6 });
  });
});

describe('findNearestRoomCorner', () => {
  const rooms = [{ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }];
  it('snaps to a nearby corner within the zoom-scaled threshold', () => {
    expect(findNearestRoomCorner(rooms, { x: 1, y: 1 }, 1)).toEqual({ x: 0, y: 0 });
  });
  it('returns null when no corner is within threshold', () => {
    expect(findNearestRoomCorner(rooms, { x: 100, y: 100 }, 1)).toBeNull();
    expect(findNearestRoomCorner([], { x: 0, y: 0 }, 1)).toBeNull();
  });
});

describe('buildCameraFovPolygon', () => {
  it('returns null for invalid range/angle', () => {
    expect(buildCameraFovPolygon({ x: 0, y: 0 }, 0, 90, 0, [])).toBeNull();
    expect(buildCameraFovPolygon({ x: 0, y: 0 }, 100, 0, 0, [])).toBeNull();
  });
  it('starts at the origin and emits a flat point list with no walls', () => {
    const pts = buildCameraFovPolygon({ x: 0, y: 0 }, 100, 90, 0, [])!;
    expect(pts.slice(0, 2)).toEqual([0, 0]);
    expect(pts.length % 2).toBe(0);
    expect(pts.length).toBeGreaterThan(2);
  });
});
