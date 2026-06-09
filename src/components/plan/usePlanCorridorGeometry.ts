/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import type { Corridor } from '../../store/types';
import { computeGetCorridorPolygon } from './planViewMiscTools';
import { computeGetClosestCorridorEdge, computeGetCorridorEdgePoint } from './planViewCorridorGeometry';

// Corridor polygon / edge geometry getters extracted from usePlanView. Self-contained (delegate to
// compute* helpers); consumed by the corridor door/connection handler hooks.
export const usePlanCorridorGeometry = () => {
  const getCorridorPolygon = useCallback((corridor: any) => computeGetCorridorPolygon(corridor), []);

  const getClosestCorridorEdge = useCallback(
    (corridor: Corridor, point: { x: number; y: number }) => computeGetClosestCorridorEdge(corridor, point, getCorridorPolygon),
    [getCorridorPolygon]
  );
  const getCorridorEdgePoint = useCallback(
    (corridor: Corridor, edgeIndex: number, t: number) => computeGetCorridorEdgePoint(corridor, edgeIndex, t, getCorridorPolygon),
    [getCorridorPolygon]
  );

  return { getCorridorPolygon, getClosestCorridorEdge, getCorridorEdgePoint };
};
