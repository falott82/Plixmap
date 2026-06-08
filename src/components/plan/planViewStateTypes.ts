import type { MapObjectType } from '../../store/types';

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
