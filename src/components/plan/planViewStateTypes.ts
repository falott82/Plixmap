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

type UserRef = { userId: string; username: string };

export type UnlockPromptState = {
  requestId: string;
  planId: string;
  planName: string;
  clientName?: string;
  siteName?: string;
  requestedBy: UserRef;
  message?: string;
} | null;

export type UnlockGrantedPromptState = {
  planId: string;
  clientName?: string;
  siteName?: string;
  planName?: string;
  grantedBy?: (UserRef & { avatarUrl?: string }) | null;
  grantedAt?: number | null;
  expiresAt?: number | null;
  minutes?: number | null;
} | null;

export type ForceUnlockConfigState = {
  planId: string;
  planName: string;
  clientName: string;
  siteName: string;
  userId: string;
  username: string;
  avatarUrl?: string;
} | null;

export type ForceUnlockActiveState = {
  requestId: string;
  planId: string;
  targetUserId: string;
  targetUsername: string;
  graceEndsAt: number;
  decisionEndsAt: number;
  graceMinutes: number;
  hasUnsavedChanges?: boolean | null;
} | null;

export type ForceUnlockIncomingState = {
  requestId: string;
  planId: string;
  clientName?: string;
  siteName?: string;
  planName?: string;
  requestedBy?: UserRef | null;
  graceEndsAt: number;
  decisionEndsAt: number;
  graceMinutes: number;
  hasUnsavedChanges?: boolean | null;
} | null;
