import type { MapObjectType, RackPortKind } from '../../store/types';

// State-shape types extracted from usePlanView's inline useState generics, so the
// hook body stays terser. Verbatim shapes.

export type PlanObjectModalState =
  | { mode: 'create'; type: MapObjectType; coords: { x: number; y: number }; textBoxWidth?: number; textBoxHeight?: number }
  | { mode: 'edit'; objectId: string }
  | { mode: 'duplicate'; objectId: string; coords: { x: number; y: number } }
  | null;

export type RoomDepartmentConfirmState = {
  objectId: string;
  userName: string;
  x: number;
  y: number;
  roomId: string;
  roomName: string;
  departmentToAdd: string;
} | null;

export type RackPortsLinkState = { itemId: string; kind?: RackPortKind; openConnections?: boolean } | null;

export type EscapeRouteModalState = {
  startPoint: { x: number; y: number };
  startPlanId: string;
  sourceKind: 'map' | 'room' | 'corridor';
} | null;

export type LayerRevealPromptState = {
  objectId: string;
  objectName: string;
  typeId: string;
  missingLayerIds: string[];
} | null;

export type MeetingManagerPresetState = {
  clientId?: string;
  siteId?: string;
  floorPlanId?: string;
  roomId?: string;
  day?: string;
} | null;

export type ClientMeetingsPresetState = {
  clientId?: string;
  siteId?: string;
  siteLocked?: boolean;
  day?: string;
  returnTo?: 'hub' | 'myMeetings';
} | null;
