// DataState store interface extracted from useDataStore.ts.
import {
  Client,
  FloorPlan,
  FloorPlanRevision,
  FloorPlanView,
  LayerDefinition,
  MapObject,
  MapObjectType,
  ObjectTypeDefinition,
  PlanLink,
  RackDefinition,
  RackItem,
  RackLink,
  Room,
  Site
} from './types';

export interface DataState {
  clients: Client[];
  objectTypes: ObjectTypeDefinition[];
  version: number;
  savedVersion: number;
  setServerState: (payload: { clients: Client[]; objectTypes?: ObjectTypeDefinition[] }) => void;
  setClients: (clients: Client[]) => void;
  markSaved: () => void;
  addObjectType: (payload: {
    id: string;
    nameIt: string;
    nameEn: string;
    icon: ObjectTypeDefinition['icon'];
    category?: ObjectTypeDefinition['category'];
    doorConfig?: ObjectTypeDefinition['doorConfig'];
  }) => void;
  updateObjectType: (
    id: string,
    payload: Partial<{
      nameIt: string;
      nameEn: string;
      icon: ObjectTypeDefinition['icon'];
      category: ObjectTypeDefinition['category'];
      doorConfig: ObjectTypeDefinition['doorConfig'];
    }>
  ) => void;
  deleteObjectType: (id: string) => void;
  addClient: (name: string) => string;
  updateClient: (
    id: string,
    payload: Partial<
      Pick<
        Client,
        'name'
          | 'logoUrl'
          | 'openAiApiKey'
          | 'openAiDailyTokensPerUser'
          | 'shortName'
          | 'address'
          | 'phone'
          | 'email'
          | 'vatId'
          | 'pecEmail'
          | 'description'
          | 'attachments'
          | 'businessPartners'
          | 'wifiAntennaModels'
          | 'emergencyContacts'
      >
    >
  ) => void;
  deleteClient: (id: string) => void;
  addSite: (
    clientId: string,
    payload: {
      name: string;
      coords?: string;
      supportContacts?: {
        cleaning?: { email?: string; phone?: string };
        it?: { email?: string; phone?: string };
        coffee?: { email?: string; phone?: string };
      };
      siteSchedule?: Site['siteSchedule'];
    }
  ) => string;
  updateSite: (
    id: string,
    payload: {
      name?: string;
      coords?: string;
      supportContacts?: {
        cleaning?: { email?: string; phone?: string };
        it?: { email?: string; phone?: string };
        coffee?: { email?: string; phone?: string };
      };
      siteSchedule?: Site['siteSchedule'];
    }
  ) => void;
  deleteSite: (id: string) => void;
  addFloorPlan: (siteId: string, name: string, imageUrl: string, width?: number, height?: number) => string;
  updateFloorPlan: (
    id: string,
    payload: Partial<
      Pick<FloorPlan, 'name' | 'imageUrl' | 'width' | 'height' | 'printArea' | 'scale' | 'corridors' | 'roomDoors' | 'safetyCardLayout'>
    >
  ) => void;
  deleteFloorPlan: (id: string) => void;
  reorderFloorPlans: (siteId: string, movingPlanId: string, targetPlanId: string, before?: boolean) => void;
  setFloorPlanContent: (
    floorPlanId: string,
    payload: Pick<FloorPlan, 'imageUrl' | 'width' | 'height' | 'objects' | 'rooms' | 'views'> &
      Partial<
        Pick<FloorPlan, 'corridors' | 'roomDoors' | 'links' | 'racks' | 'rackItems' | 'rackLinks' | 'printArea' | 'scale' | 'safetyCardLayout'>
      >
  ) => void;
  addObject: (
    floorPlanId: string,
    type: MapObjectType,
    name: string,
    description: string | undefined,
    x: number,
    y: number,
    scale?: number,
    layerIds?: string[],
    extra?: Partial<
      Pick<
        MapObject,
        | 'externalClientId'
        | 'externalUserId'
        | 'firstName'
        | 'lastName'
        | 'externalRole'
        | 'externalDept1'
        | 'externalDept2'
        | 'externalDept3'
        | 'externalEmail'
        | 'externalMobile'
        | 'externalExt1'
        | 'externalExt2'
        | 'externalExt3'
        | 'externalIsExternal'
        | 'opacity'
        | 'rotation'
        | 'scaleX'
        | 'scaleY'
        | 'strokeWidth'
        | 'strokeColor'
        | 'quoteLabelPos'
        | 'quoteLabelScale'
        | 'quoteLabelBg'
        | 'quoteLabelColor'
        | 'quoteLabelOffset'
        | 'quoteDashed'
        | 'quoteEndpoint'
        | 'textFont'
        | 'textSize'
        | 'textColor'
        | 'textBg'
        | 'textBgColor'
        | 'textBoxWidth'
        | 'textBoxHeight'
        | 'imageUrl'
        | 'imageWidth'
        | 'imageHeight'
        | 'postitCompact'
        | 'wifiDb'
        | 'wifiStandard'
        | 'wifiBand24'
        | 'wifiBand5'
        | 'wifiBand6'
        | 'wifiBrand'
        | 'wifiModel'
        | 'wifiModelCode'
        | 'wifiCoverageSqm'
        | 'wifiCatalogId'
        | 'wifiShowRange'
        | 'wifiRangeScale'
        | 'ip'
        | 'url'
        | 'notes'
        | 'lastVerificationAt'
        | 'verifierCompany'
        | 'gpsCoords'
        | 'securityDocuments'
        | 'securityCheckHistory'
        | 'points'
        | 'wallGroupId'
        | 'wallGroupIndex'
      >
    >
  ) => string;
  updateObject: (
    id: string,
    changes: Partial<
      Pick<
        MapObject,
        | 'name'
        | 'description'
        | 'scale'
        | 'x'
        | 'y'
        | 'roomId'
        | 'layerIds'
        | 'externalClientId'
        | 'externalUserId'
        | 'firstName'
        | 'lastName'
        | 'externalRole'
        | 'externalDept1'
        | 'externalDept2'
        | 'externalDept3'
        | 'externalEmail'
        | 'externalMobile'
        | 'externalExt1'
        | 'externalExt2'
        | 'externalExt3'
        | 'externalIsExternal'
        | 'opacity'
        | 'rotation'
        | 'scaleX'
        | 'scaleY'
        | 'strokeWidth'
        | 'strokeColor'
        | 'quoteLabelPos'
        | 'quoteLabelScale'
        | 'quoteLabelBg'
        | 'quoteLabelColor'
        | 'quoteLabelOffset'
        | 'quoteDashed'
        | 'quoteEndpoint'
        | 'textFont'
        | 'textSize'
        | 'textColor'
        | 'textBg'
        | 'textBgColor'
        | 'textBoxWidth'
        | 'textBoxHeight'
        | 'imageUrl'
        | 'imageWidth'
        | 'imageHeight'
        | 'postitCompact'
        | 'wifiDb'
        | 'wifiStandard'
        | 'wifiBand24'
        | 'wifiBand5'
        | 'wifiBand6'
        | 'wifiBrand'
        | 'wifiModel'
        | 'wifiModelCode'
        | 'wifiCoverageSqm'
        | 'wifiCatalogId'
        | 'wifiShowRange'
        | 'wifiRangeScale'
        | 'ip'
        | 'url'
        | 'notes'
        | 'lastVerificationAt'
        | 'verifierCompany'
        | 'gpsCoords'
        | 'securityDocuments'
        | 'securityCheckHistory'
        | 'points'
        | 'wallGroupId'
        | 'wallGroupIndex'
        | 'cctvAngle'
        | 'cctvRange'
        | 'cctvOpacity'
        | 'type'
      >
    >
  ) => void;
  moveObject: (id: string, x: number, y: number) => void;
  deleteObject: (id: string) => void;
  clearObjects: (floorPlanId: string) => void;
  removeRealUserAllocations: (clientId: string, externalUserId: string) => void;
  removeRealUserAllocationsBulk: (
    clientId: string,
    externalUserIds: string[]
  ) => { affectedPlans: { planId: string; removedObjectIds: string[] }[] };
  setObjectRoomIds: (floorPlanId: string, roomIdByObjectId: Record<string, string | undefined>) => void;
  addRoom: (floorPlanId: string, room: Omit<Room, 'id'>) => string;
  updateRoom: (floorPlanId: string, roomId: string, changes: Partial<Omit<Room, 'id'>>) => void;
  deleteRoom: (floorPlanId: string, roomId: string) => void;
  addRevision: (floorPlanId: string, payload?: { name?: string; description?: string; bump?: 'major' | 'minor' }) => string;
  restoreRevision: (floorPlanId: string, revisionId: string) => void;
  updateRevision: (floorPlanId: string, revisionId: string, changes: Partial<FloorPlanRevision>) => void;
  deleteRevision: (floorPlanId: string, revisionId: string) => void;
  clearRevisions: (floorPlanId: string) => void;
  setFloorPlanRevisions: (floorPlanId: string, revisions: FloorPlanRevision[]) => void;
  commitSavedFloorPlan: (floorPlanId: string, plan: FloorPlan, revisions?: FloorPlanRevision[]) => void;
  findFloorPlan: (id: string) => FloorPlan | undefined;
  findClientByPlan: (planId: string) => Client | undefined;
  findSiteByPlan: (planId: string) => Site | undefined;
  addView: (floorPlanId: string, view: Omit<FloorPlanView, 'id'>) => string;
  updateView: (floorPlanId: string, viewId: string, changes: Partial<Omit<FloorPlanView, 'id'>>) => void;
  deleteView: (floorPlanId: string, viewId: string) => void;
  setDefaultView: (floorPlanId: string, viewId: string) => void;
  addLink: (
    floorPlanId: string,
    fromId: string,
    toId: string,
    payload?: {
      kind?: 'arrow' | 'cable';
      arrow?: 'none' | 'start' | 'end' | 'both';
      name?: string;
      description?: string;
      label?: string;
      color?: string;
      width?: number;
      dashed?: boolean;
      route?: 'vh' | 'hv';
    }
  ) => string;
  deleteLink: (floorPlanId: string, linkId: string) => void;
  updateLink: (
    floorPlanId: string,
    linkId: string,
    payload: Partial<Pick<PlanLink, 'name' | 'description' | 'color' | 'width' | 'dashed' | 'route' | 'arrow'>>
  ) => void;
  ensureRack: (floorPlanId: string, rackId: string, payload: Pick<RackDefinition, 'name' | 'totalUnits'>) => void;
  updateRack: (floorPlanId: string, rackId: string, changes: Partial<Pick<RackDefinition, 'name' | 'totalUnits' | 'notes'>>) => void;
  deleteRack: (floorPlanId: string, rackId: string) => void;
  addRackItem: (floorPlanId: string, rackItem: Omit<RackItem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateRackItem: (floorPlanId: string, itemId: string, changes: Partial<Omit<RackItem, 'id' | 'rackId'>>) => void;
  deleteRackItem: (floorPlanId: string, itemId: string) => void;
  addRackLink: (floorPlanId: string, payload: Omit<RackLink, 'id' | 'createdAt'>) => string;
  deleteRackLink: (floorPlanId: string, linkId: string) => void;
  cloneFloorPlan: (
    sourcePlanId: string,
    options?: { name?: string; includeRooms?: boolean; includeObjects?: boolean; includeViews?: boolean; includeLayers?: boolean }
  ) => string | null;
  updateClientLayers: (
    clientId: string,
    layers: LayerDefinition[],
    options?: { updateObjects?: (obj: MapObject) => MapObject }
  ) => void;
}
