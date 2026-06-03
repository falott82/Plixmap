import { describe, it, expect } from 'vitest';
import { pointInPolygon, projectPointToSegment, distancePointToSegment, polygonCentroid } from './planViewUtils';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
];

describe('pointInPolygon', () => {
  it('inside / outside a square', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
  it('false for empty polygon', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
  });
});

describe('projectPointToSegment / distancePointToSegment', () => {
  it('projects onto a horizontal segment', () => {
    const pr = projectPointToSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 4 });
    expect(pr).toMatchObject({ x: 5, y: 0 });
    expect(pr.distSq).toBeCloseTo(16);
  });
  it('distance equals sqrt(distSq)', () => {
    expect(distancePointToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(4);
    // clamps to the nearer endpoint when the projection falls outside the segment
    expect(distancePointToSegment({ x: -3, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });
  it('degenerate (zero-length) segment → distance to the point', () => {
    expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('polygonCentroid', () => {
  it('centroid of a square is its center', () => {
    expect(polygonCentroid(square)).toEqual({ x: 5, y: 5 });
  });
  it('returns null for an empty polygon', () => {
    expect(polygonCentroid([])).toBeNull();
  });
  it('degenerate (collinear / zero-area) polygon falls back to vertex average', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 }
    ];
    expect(polygonCentroid(line)).toEqual({ x: 2, y: 0 });
  });
});
