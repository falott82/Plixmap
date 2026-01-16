export type MapObjectType = string;

export type RackItemType =
  | 'switch'
  | 'router'
  | 'firewall'
  | 'server'
  | 'patchpanel'
  | 'optical_drawer'
  | 'passacavo'
  | 'ups'
  | 'power_strip'
  | 'misc';
export type RackPortKind = 'ethernet' | 'fiber';

export interface RackDefinition {
  id: string;
  name: string;
  totalUnits: number;
  notes?: string;
  createdAt?: number;
}

export interface RackItem {
  id: string;
  rackId: string;
  type: RackItemType;
  name: string;
  brand?: string;
  model?: string;
  ip?: string;
  hostName?: string;
  mgmtIp?: string;
  idracIp?: string;
  dualPower?: boolean;
  notes?: string;
  connectorType?: 'SC' | 'LC' | 'ST' | 'FC';
  rails?: boolean;
  outlets?: number;
  mainSwitch?: boolean;
  maintenanceDate?: string;
  batteryChangeDate?: string;
  unitStart: number;
  unitSize: number;
  ethPorts?: number;
  fiberPorts?: number;
  ethRangeStart?: number;
  fiberRangeStart?: number;
  ethPortNames?: string[];
  fiberPortNames?: string[];
  ethPortNotes?: string[];
  fiberPortNotes?: string[];
  createdAt?: number;
  updatedAt?: number;
}

export interface RackLink {
  id: string;
  fromItemId: string;
  fromPortKind: RackPortKind;
  fromPortIndex: number;
  fromSide?: 'female' | 'cable';
  toItemId: string;
  toPortKind: RackPortKind;
  toPortIndex: number;
  toSide?: 'female' | 'cable';
  kind: RackPortKind;
  color: string;
  speed?: string;
  name?: string;
  createdAt?: number;
}

export type IconName =
  | 'user'
  | 'userCheck'
  | 'printer'
  | 'server'
  | 'wifi'
  | 'radio'
  | 'tv'
  | 'desktop'
  | 'laptop'
  | 'camera'
  | 'intercom'
  | 'videoIntercom'
  | 'scanner'
  | 'mic'
  | 'router'
  | 'switch'
  | 'phone'
  | 'tablet'
  | 'shield'
  | 'key'
  | 'database'
  | 'cctv'
  | 'lightbulb'
  | 'plug'
  | 'plugZap'
  | 'wrench'
  | 'cpu'
  | 'hardDrive'
  | 'bell'
  | 'lock'
  | 'unlock'
  | 'thermometer'
  | 'fan'
  | 'airVent'
  | 'wind'
  | 'snowflake'
  | 'thermometerSnowflake'
  | 'thermometerSun'
  | 'droplets'
  | 'flame'
  | 'gauge'
  | 'power'
  | 'zap'
  | 'battery'
  | 'batteryCharging'
  | 'batteryFull'
  | 'batteryLow'
  | 'network'
  | 'wifiOff'
  | 'cable'
  | 'lockKeyhole'
  | 'badgeCheck'
  | 'shieldCheck'
  | 'shieldAlert'
  | 'bellRing'
  | 'videoOff'
  | 'micOff'
  | 'volume2'
  | 'headphones'
  | 'users'
  | 'usersRound'
  | 'userSearch'
  | 'car'
  | 'truck'
  | 'bike'
  | 'bus'
  | 'train'
  | 'deskRound'
  | 'deskSquare'
  | 'deskRect'
  | 'deskDouble'
  | 'deskLong'
  | 'deskTrapezoid'
  | 'deskL'
  | 'deskLReverse';

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
  // Real users (imported from external directory)
  externalClientId?: string;
  externalUserId?: string;
  firstName?: string;
  lastName?: string;
  externalRole?: string;
  externalDept1?: string;
  externalDept2?: string;
  externalDept3?: string;
  externalEmail?: string;
  externalExt1?: string;
  externalExt2?: string;
  externalExt3?: string;
  externalIsExternal?: boolean;
  x: number;
  y: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  rotation?: number;
  strokeWidth?: number;
  strokeColor?: string;
  roomId?: string;
  layerIds?: string[];
  cctvAngle?: number;
  cctvRange?: number;
  cctvOpacity?: number;
}

export interface LayerDefinition {
  id: string; // stable key
  name: { it: string; en: string };
  color?: string;
  order?: number;
  typeIds?: string[];
  note?: { it: string; en: string };
}

export interface PlanLink {
  id: string;
  fromId: string;
  toId: string;
  kind?: 'arrow' | 'cable';
  name?: string;
  description?: string;
  color?: string;
  width?: number;
  dashed?: boolean;
  route?: 'vh' | 'hv';
  // legacy
  label?: string;
}

export interface Room {
  id: string;
  name: string;
  color?: string;
  capacity?: number;
  labelScale?: number;
  showName?: boolean;
  surfaceSqm?: number;
  notes?: string;
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
  printArea?: { x: number; y: number; width: number; height: number };
  layers?: LayerDefinition[];
  views?: FloorPlanView[];
  revisions?: FloorPlanRevision[];
  rooms?: Room[];
  links?: PlanLink[];
  racks?: RackDefinition[];
  rackItems?: RackItem[];
  rackLinks?: RackLink[];
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
  createdBy?: { id: string; username: string; firstName: string; lastName: string };
  revMajor?: number;
  revMinor?: number;
  name: string;
  description?: string;
  imageUrl: string;
  width?: number;
  height?: number;
  layers?: LayerDefinition[];
  views?: FloorPlanView[];
  rooms?: Room[];
  links?: PlanLink[];
  racks?: RackDefinition[];
  rackItems?: RackItem[];
  rackLinks?: RackLink[];
  objects: MapObject[];
}

export interface Site {
  id: string;
  clientId: string;
  name: string;
  coords?: string;
  floorPlans: FloorPlan[];
}

export interface ClientNote {
  id: string;
  title: string;
  notesHtml?: string;
  notesLexical?: string;
  updatedAt?: number;
  updatedBy?: { id: string; username: string };
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
  layers?: LayerDefinition[];
  // Legacy single-note fields (kept for migration/backward compatibility)
  notesHtml?: string;
  notesLexical?: string;
  notesUpdatedAt?: number;
  notesUpdatedBy?: { id: string; username: string };
  // New multi-note model
  notes?: ClientNote[];
  attachments?: { id: string; name: string; dataUrl: string }[];
  sites: Site[];
}

export interface HighlightState {
  objectId?: string;
  until?: number;
}
