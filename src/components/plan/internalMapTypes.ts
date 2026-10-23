export type Point = { x: number; y: number };
export type Axis = 'x' | 'y';

export type EntryKind = 'object' | 'rack_item' | 'room' | 'corridor';

export interface SearchEntry {
  id: string;
  kind: EntryKind;
  label: string;
  subtitle: string;
  search: string;
  point: Point;
  roomId?: string;
}

export interface RouteResult {
  startDoor: Point;
  endDoor: Point;
  approachPoints: Point[];
  corridorPoints: Point[];
  exitPoints: Point[];
  distancePx: number;
  distanceMeters?: number;
  etaSeconds?: number;
  directDashedOnly?: boolean;
}

export type ConnectionTransitionType = 'stairs' | 'elevator';

export interface RoutePlanSegment {
  planId: string;
  planName: string;
  startPoint: Point;
  endPoint: Point;
  route: RouteResult;
  startConnectionId?: string;
  endConnectionId?: string;
  startTransitionType?: ConnectionTransitionType;
  endTransitionType?: ConnectionTransitionType;
}

export interface MultiFloorRouteResult {
  segments: RoutePlanSegment[];
  distancePx: number;
  distanceMeters?: number;
  transitionSeconds: number;
  etaSeconds?: number;
}
