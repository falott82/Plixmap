import { describe, it, expect } from 'vitest';
import { spatialCellSize, buildSpatialIndexCells, selectionCandidatesFromIndex } from './canvasSpatialIndex';

describe('spatialCellSize', () => {
  it('clamps between 140 and 520', () => {
    expect(spatialCellSize(0, 0)).toBe(320);
    expect(spatialCellSize(600, 600)).toBe(140); // 600/12=50 -> clamped up to 140
    expect(spatialCellSize(100000, 100000)).toBe(520); // clamped down
    expect(spatialCellSize(2400, 4800)).toBe(200); // min dim 2400/12
  });
});

const bounds = (o: any) => ({ minX: o.x, minY: o.y, maxX: o.x, maxY: o.y });

describe('buildSpatialIndexCells', () => {
  it('buckets objects into the cell covering their position', () => {
    const objects = [
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 250, y: 10 }
    ] as any[];
    const cells = buildSpatialIndexCells(objects, bounds, 100);
    expect(cells.get('0,0')).toEqual(['a']);
    expect(cells.get('2,0')).toEqual(['b']);
  });
  it('skips objects with non-finite bounds', () => {
    const objects = [{ id: 'x', x: Number.NaN, y: 0 }] as any[];
    expect(buildSpatialIndexCells(objects, bounds, 100).size).toBe(0);
  });
});

describe('selectionCandidatesFromIndex', () => {
  it('returns objects whose cells intersect the rect', () => {
    const objects = [
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 250, y: 10 }
    ] as any[];
    const objectById = new Map(objects.map((o) => [o.id, o]));
    const index = { version: 0, cellSize: 100, cells: buildSpatialIndexCells(objects, bounds, 100) };
    const hits = selectionCandidatesFromIndex({ x: 0, y: 0, width: 50, height: 50 }, index, objectById);
    expect(hits.map((o) => o.id)).toEqual(['a']);
  });
  it('returns [] when the rect hits no occupied cell', () => {
    const index = { version: 0, cellSize: 100, cells: new Map<string, string[]>() };
    expect(selectionCandidatesFromIndex({ x: 0, y: 0, width: 10, height: 10 }, index, new Map())).toEqual([]);
  });
});
