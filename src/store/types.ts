export type MapObjectType = string;

export type IconName =
  | 'user'
  | 'printer'
  | 'server'
  | 'wifi'
  | 'radio'
  | 'tv'
  | 'desktop'
  | 'laptop'
  | 'camera'
  | 'router'
  | 'switch'
  | 'phone'
  | 'tablet'
  | 'shield'
  | 'key'
  | 'database'
  | 'cctv';

export interface ObjectTypeDefinition {
  id: string; // stable key used in MapObject.type
  name: { it: string; en: string };
  icon: IconName;
  builtin?: boolean;
}

export interface MapObject {
  id: string;
  floorPlanId: string;
  type: MapObjectType;
  name: string;
  description?: string;
  x: number;
  y: number;
  scale?: number;
  roomId?: string;
}

export interface Room {
  id: string;
  name: string;
  kind?: 'rect' | 'poly';
  // rect
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // poly (world-space points)
  points?: { x: number; y: number }[];
}

export interface FloorPlan {
  id: string;
  siteId: string;
  name: string;
  imageUrl: string;
  order?: number;
  width?: number;
  height?: number;
  views?: FloorPlanView[];
  revisions?: FloorPlanRevision[];
  rooms?: Room[];
  objects: MapObject[];
}

export interface FloorPlanView {
  id: string;
  name: string;
  description?: string;
  zoom: number;
  pan: { x: number; y: number };
  isDefault?: boolean;
}

export interface FloorPlanRevision {
  id: string;
  createdAt: number;
  revMajor?: number;
  revMinor?: number;
  name: string;
  description?: string;
  imageUrl: string;
  width?: number;
  height?: number;
  views?: FloorPlanView[];
  rooms?: Room[];
  objects: MapObject[];
}

export interface Site {
  id: string;
  clientId: string;
  name: string;
  coords?: string;
  floorPlans: FloorPlan[];
}

export interface Client {
  id: string;
  name: string;
  logoUrl?: string;
  shortName?: string;
  address?: string;
  phone?: string;
  email?: string;
  vatId?: string;
  pecEmail?: string;
  description?: string;
  attachments?: { id: string; name: string; dataUrl: string }[];
  sites: Site[];
}

export interface HighlightState {
  objectId?: string;
  until?: number;
}
