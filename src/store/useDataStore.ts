import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { Client, Corridor, FloorPlan, FloorPlanRevision, FloorPlanView, LayerDefinition, MapObject, MapObjectType, ObjectTypeDefinition, PlanLink, RackDefinition, RackItem, RackLink, Room, Site, WifiAntennaModel } from './types';
import {
  ALL_ITEMS_LAYER_ID,
  ALL_ITEMS_LAYER_COLOR,
  DEFAULT_CCTV_TYPES,
  DEFAULT_DESK_TYPES,
  DEFAULT_DEVICE_TYPES,
  DEFAULT_IMAGE_TYPES,
  DEFAULT_PHOTO_TYPES,
  DEFAULT_RACK_TYPES,
  DEFAULT_TEXT_TYPES,
  DEFAULT_USER_TYPES,
  DEFAULT_WIFI_ANTENNA_MODELS,
  DEFAULT_WIFI_TYPES,
  DEFAULT_WALL_TYPES,
  QUOTE_LAYER_COLOR,
  WIFI_DEFAULT_STANDARD,
  WALL_LAYER_COLOR,
  WIFI_LAYER_COLOR,
  defaultData,
  defaultObjectTypes
} from './data';
import { useAuthStore } from './useAuthStore';

interface DataState {
  clients: Client[];
  objectTypes: ObjectTypeDefinition[];
  version: number;
  savedVersion: number;
  setServerState: (payload: { clients: Client[]; objectTypes?: ObjectTypeDefinition[] }) => void;
  setClients: (clients: Client[]) => void;
  markSaved: () => void;
  addObjectType: (payload: { id: string; nameIt: string; nameEn: string; icon: ObjectTypeDefinition['icon'] }) => void;
  updateObjectType: (id: string, payload: Partial<{ nameIt: string; nameEn: string; icon: ObjectTypeDefinition['icon'] }>) => void;
  deleteObjectType: (id: string) => void;
  addClient: (name: string) => string;
  updateClient: (
    id: string,
    payload: Partial<
      Pick<
        Client,
        'name'
          | 'logoUrl'
          | 'shortName'
          | 'address'
          | 'phone'
          | 'email'
          | 'vatId'
          | 'pecEmail'
          | 'description'
          | 'attachments'
          | 'wifiAntennaModels'
      >
    >
  ) => void;
  deleteClient: (id: string) => void;
  addSite: (clientId: string, payload: { name: string; coords?: string }) => string;
  updateSite: (id: string, payload: { name?: string; coords?: string }) => void;
  deleteSite: (id: string) => void;
  addFloorPlan: (siteId: string, name: string, imageUrl: string, width?: number, height?: number) => string;
  updateFloorPlan: (id: string, payload: Partial<Pick<FloorPlan, 'name' | 'imageUrl' | 'width' | 'height' | 'printArea' | 'scale' | 'corridors'>>) => void;
  deleteFloorPlan: (id: string) => void;
  reorderFloorPlans: (siteId: string, movingPlanId: string, targetPlanId: string, before?: boolean) => void;
  setFloorPlanContent: (
    floorPlanId: string,
    payload: Pick<FloorPlan, 'imageUrl' | 'width' | 'height' | 'objects' | 'rooms' | 'views'> &
      Partial<Pick<FloorPlan, 'corridors' | 'links' | 'racks' | 'rackItems' | 'rackLinks' | 'printArea' | 'scale'>>
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

const updateFloorPlanById = (
  clients: Client[],
  floorPlanId: string,
  update: (plan: FloorPlan) => FloorPlan
): Client[] => {
  for (let ci = 0; ci < clients.length; ci++) {
    const client = clients[ci];
    for (let si = 0; si < client.sites.length; si++) {
      const site = client.sites[si];
      const pi = site.floorPlans.findIndex((p) => p.id === floorPlanId);
      if (pi === -1) continue;
      const prevPlan = site.floorPlans[pi];
      const nextPlan = update(prevPlan);
      if (nextPlan === prevPlan) return clients;

      const nextPlans = site.floorPlans.slice();
      nextPlans[pi] = nextPlan;
      const nextSite: Site = { ...site, floorPlans: nextPlans };
      const nextSites = client.sites.slice();
      nextSites[si] = nextSite;
      const nextClient: Client = { ...client, sites: nextSites };
      const nextClients = clients.slice();
      nextClients[ci] = nextClient;
      return nextClients;
    }
  }
  return clients;
};

const updateSiteById = (clients: Client[], siteId: string, update: (site: Site) => Site): Client[] => {
  for (let ci = 0; ci < clients.length; ci++) {
    const client = clients[ci];
    const si = client.sites.findIndex((s) => s.id === siteId);
    if (si === -1) continue;
    const prevSite = client.sites[si];
    const nextSite = update(prevSite);
    if (nextSite === prevSite) return clients;
    const nextSites = client.sites.slice();
    nextSites[si] = nextSite;
    const nextClient: Client = { ...client, sites: nextSites };
    const nextClients = clients.slice();
    nextClients[ci] = nextClient;
    return nextClients;
  }
  return clients;
};

const updateObjectById = (
  clients: Client[],
  objectId: string,
  update: (obj: MapObject) => MapObject | null
): Client[] => {
  for (let ci = 0; ci < clients.length; ci++) {
    const client = clients[ci];
    for (let si = 0; si < client.sites.length; si++) {
      const site = client.sites[si];
      for (let pi = 0; pi < site.floorPlans.length; pi++) {
        const plan = site.floorPlans[pi];
        const oi = plan.objects.findIndex((o) => o.id === objectId);
        if (oi === -1) continue;
        const prevObj = plan.objects[oi];
        const nextObj = update(prevObj);

        const nextObjects = plan.objects.slice();
        if (nextObj === null) nextObjects.splice(oi, 1);
        else nextObjects[oi] = nextObj;
        const nextPlan: FloorPlan = { ...plan, objects: nextObjects };

        const nextPlans = site.floorPlans.slice();
        nextPlans[pi] = nextPlan;
        const nextSite: Site = { ...site, floorPlans: nextPlans };
        const nextSites = client.sites.slice();
        nextSites[si] = nextSite;
        const nextClient: Client = { ...client, sites: nextSites };
        const nextClients = clients.slice();
        nextClients[ci] = nextClient;
        return nextClients;
      }
    }
  }
  return clients;
};

const getLatestRev = (plan: FloorPlan): { major: number; minor: number } => {
  const revisions: any[] = plan.revisions || [];
  const first = revisions[0];
  if (first && typeof first.revMajor === 'number' && typeof first.revMinor === 'number') {
    return { major: first.revMajor, minor: first.revMinor };
  }
  // Back-compat: previously stored numeric `version` as 1..N
  if (first && typeof first.version === 'number') {
    return { major: 1, minor: Math.max(0, Number(first.version) - 1) };
  }
  return { major: 1, minor: 0 };
};

const nextRev = (plan: FloorPlan, bump: 'major' | 'minor') => {
  const latest = getLatestRev(plan);
  if (bump === 'major') return { major: latest.major + 1, minor: 0 };
  return { major: latest.major, minor: latest.minor + 1 };
};

const normalizeViews = (views: FloorPlanView[] | undefined): FloorPlanView[] | undefined => {
  if (!Array.isArray(views)) return views;
  if (!views.length) return [];
  const next = views.map((v) => ({ ...v, pan: { ...v.pan } }));
  let defaultIndex = next.findIndex((v) => v.isDefault);
  if (defaultIndex === -1) {
    defaultIndex = next.findIndex((v) => String(v.name || '').trim().toLowerCase() === 'default');
  }
  if (defaultIndex !== -1) {
    const normalized = next.map((v, idx) => ({
      ...v,
      isDefault: idx === defaultIndex,
      name: idx === defaultIndex ? 'DEFAULT' : v.name
    }));
    const [def] = normalized.splice(defaultIndex, 1);
    return [def, ...normalized];
  }
  return next.map((v) => (v.isDefault ? { ...v, isDefault: false } : v));
};

const snapshotRevision = (
  plan: FloorPlan,
  rev: { major: number; minor: number },
  payload?: { name?: string; description?: string; createdBy?: FloorPlanRevision['createdBy'] }
): FloorPlanRevision => {
  const now = Date.now();
  const baseName = payload?.name?.trim() || 'Snapshot';
  return {
    id: nanoid(),
    createdAt: now,
    ...(payload?.createdBy ? { createdBy: payload.createdBy } : {}),
    revMajor: rev.major,
    revMinor: rev.minor,
    name: baseName,
    description: payload?.description?.trim() || undefined,
    imageUrl: plan.imageUrl,
    width: plan.width,
    height: plan.height,
    scale: plan.scale ? { ...plan.scale } : undefined,
    views: normalizeViews(plan.views),
    rooms: plan.rooms ? plan.rooms.map((r) => ({ ...r })) : undefined,
    corridors: plan.corridors
      ? plan.corridors.map((c) => ({
          ...c,
          points: Array.isArray(c.points) ? c.points.map((p) => ({ ...p })) : undefined,
          doors: Array.isArray(c.doors)
            ? c.doors.map((d) => ({
                ...d,
                linkedRoomIds: Array.isArray((d as any)?.linkedRoomIds)
                  ? (d as any).linkedRoomIds.map((id: any) => String(id))
                  : undefined
              }))
            : undefined,
          connections: Array.isArray(c.connections) ? c.connections.map((cp) => ({ ...cp, planIds: [...(cp.planIds || [])] })) : undefined
        }))
      : undefined,
    links: plan.links ? plan.links.map((l) => ({ ...l })) : undefined,
    racks: plan.racks ? plan.racks.map((r) => ({ ...r })) : undefined,
    rackItems: plan.rackItems ? plan.rackItems.map((i) => ({ ...i })) : undefined,
    rackLinks: plan.rackLinks ? plan.rackLinks.map((l) => ({ ...l })) : undefined,
    objects: plan.objects.map((o) => ({ ...o }))
  };
};

const defaultLayers = (): LayerDefinition[] => [
  { id: ALL_ITEMS_LAYER_ID, name: { it: 'Tutti gli elementi', en: 'All Items' }, color: ALL_ITEMS_LAYER_COLOR, order: 1 },
  { id: 'users', name: { it: 'Utenti', en: 'Users' }, color: '#2563eb', order: 2, typeIds: DEFAULT_USER_TYPES },
  { id: 'devices', name: { it: 'Dispositivi', en: 'Devices' }, color: '#0ea5e9', order: 3, typeIds: DEFAULT_DEVICE_TYPES },
  { id: 'wifi', name: { it: 'WiFi', en: 'WiFi' }, color: WIFI_LAYER_COLOR, order: 4, typeIds: DEFAULT_WIFI_TYPES },
  { id: 'cctv', name: { it: 'CCTV', en: 'CCTV' }, color: '#22c55e', order: 5, typeIds: DEFAULT_CCTV_TYPES },
  { id: 'desks', name: { it: 'Scrivanie', en: 'Desks' }, color: '#8b5cf6', order: 6, typeIds: DEFAULT_DESK_TYPES },
  { id: 'cabling', name: { it: 'Cablaggi', en: 'Cabling' }, color: '#10b981', order: 7 },
  { id: 'walls', name: { it: 'Mura', en: 'Walls' }, color: WALL_LAYER_COLOR, order: 8, typeIds: DEFAULT_WALL_TYPES },
  { id: 'quotes', name: { it: 'Quote', en: 'Quotes' }, color: QUOTE_LAYER_COLOR, order: 9 },
  { id: 'rooms', name: { it: 'Stanze', en: 'Rooms' }, color: '#64748b', order: 10 },
  { id: 'corridors', name: { it: 'Corridoi', en: 'Corridors' }, color: '#94a3b8', order: 11 },
  { id: 'racks', name: { it: 'Rack', en: 'Racks' }, color: '#f97316', order: 12, typeIds: DEFAULT_RACK_TYPES },
  { id: 'text', name: { it: 'Testo', en: 'Text' }, color: '#0f172a', order: 13, typeIds: DEFAULT_TEXT_TYPES },
  { id: 'images', name: { it: 'Immagini', en: 'Images' }, color: '#64748b', order: 14, typeIds: DEFAULT_IMAGE_TYPES },
  { id: 'photos', name: { it: 'Foto', en: 'Photos' }, color: '#14b8a6', order: 15, typeIds: DEFAULT_PHOTO_TYPES }
];

const SYSTEM_LAYER_IDS = new Set([ALL_ITEMS_LAYER_ID, 'rooms', 'corridors', 'cabling', 'quotes']);

const normalizeWifiAntennaModels = (models?: WifiAntennaModel[]): WifiAntennaModel[] => {
  const source = Array.isArray(models) && models.length ? models : DEFAULT_WIFI_ANTENNA_MODELS;
  return source.map((entry) => {
    const coverage = Number(entry.coverageSqm);
    return {
      id: String(entry.id || nanoid()),
      brand: String(entry.brand || '').trim(),
      model: String(entry.model || '').trim(),
      modelCode: String(entry.modelCode || '').trim(),
      standard: String(entry.standard || WIFI_DEFAULT_STANDARD),
      band24: !!entry.band24,
      band5: !!entry.band5,
      band6: !!entry.band6,
      coverageSqm: Number.isFinite(coverage) ? coverage : 0
    };
  });
};

const ensureLayerTypes = (layer: LayerDefinition): LayerDefinition => {
  if (Array.isArray(layer.typeIds) && layer.typeIds.length) return layer;
  if (layer.id === 'users') return { ...layer, typeIds: DEFAULT_USER_TYPES };
  if (layer.id === 'devices') return { ...layer, typeIds: DEFAULT_DEVICE_TYPES };
  if (layer.id === 'wifi') return { ...layer, typeIds: DEFAULT_WIFI_TYPES };
  if (layer.id === 'cctv') return { ...layer, typeIds: DEFAULT_CCTV_TYPES };
  if (layer.id === 'desks') return { ...layer, typeIds: DEFAULT_DESK_TYPES };
  if (layer.id === 'text') return { ...layer, typeIds: DEFAULT_TEXT_TYPES };
  if (layer.id === 'images') return { ...layer, typeIds: DEFAULT_IMAGE_TYPES };
  if (layer.id === 'photos') return { ...layer, typeIds: DEFAULT_PHOTO_TYPES };
  if (layer.id === 'walls') return { ...layer, typeIds: DEFAULT_WALL_TYPES };
  if (layer.id === 'racks') return { ...layer, typeIds: DEFAULT_RACK_TYPES };
  return layer;
};

const normalizeClientLayers = (client: Client): LayerDefinition[] => {
  const legacyLayers: LayerDefinition[] = [];
  for (const site of client.sites || []) {
    for (const plan of site.floorPlans || []) {
      if (Array.isArray((plan as any).layers)) {
        legacyLayers.push(...((plan as any).layers as LayerDefinition[]));
      }
    }
  }
  const baseLayers = Array.isArray(client.layers) && client.layers.length ? client.layers : legacyLayers;
  const source = baseLayers.length ? baseLayers : defaultLayers();
  const defaultsById = new Map(defaultLayers().map((layer) => [layer.id, layer]));
  const byId = new Map<string, LayerDefinition>();

  for (const layer of source) {
    if (!layer || !layer.id) continue;
    const id = String(layer.id);
    const base = defaultsById.get(id);
    const note = (layer as any).note;
    const next: LayerDefinition = {
      id,
      name: {
        it: String(layer.name?.it || layer.name?.en || base?.name?.it || id),
        en: String(layer.name?.en || layer.name?.it || base?.name?.en || id)
      },
      color: layer.color || base?.color,
      order: typeof layer.order === 'number' ? layer.order : base?.order,
      typeIds: Array.isArray(layer.typeIds) ? layer.typeIds : base?.typeIds,
      note: typeof note === 'string' ? { it: note, en: note } : note
    };
    if (id === ALL_ITEMS_LAYER_ID) {
      const legacyColor = '#0f172a';
      next.order = 1;
      if (!next.color || next.color === legacyColor) {
        next.color = ALL_ITEMS_LAYER_COLOR;
      }
    }
    if (id === 'walls') {
      const legacyColor = '#334155';
      if (!next.color || next.color === legacyColor) {
        next.color = WALL_LAYER_COLOR;
      }
    }
    if (SYSTEM_LAYER_IDS.has(id)) {
      delete (next as any).typeIds;
    } else {
      next.typeIds = ensureLayerTypes(next).typeIds;
    }
    if (id === 'images' && Array.isArray(next.typeIds)) {
      const filtered = next.typeIds.filter((typeId) => String(typeId) !== 'photo');
      next.typeIds = filtered.length ? filtered : DEFAULT_IMAGE_TYPES;
    }
    if (id === 'photos' && Array.isArray(next.typeIds)) {
      const hasPhoto = next.typeIds.some((typeId) => String(typeId) === 'photo');
      next.typeIds = hasPhoto ? next.typeIds : [...next.typeIds, ...DEFAULT_PHOTO_TYPES];
    }
    byId.set(id, next);
  }

  for (const base of defaultsById.values()) {
    if (!byId.has(base.id)) {
      const note = (base as any).note;
      byId.set(base.id, {
        ...base,
        name: { it: base.name.it, en: base.name.en },
        note: typeof note === 'string' ? { it: note, en: note } : note
      });
    }
  }

  let maxOrder = 0;
  for (const layer of byId.values()) {
    if (typeof layer.order === 'number') maxOrder = Math.max(maxOrder, layer.order);
  }
  for (const layer of byId.values()) {
    if (typeof layer.order !== 'number') {
      maxOrder += 1;
      layer.order = maxOrder;
    }
  }
  return Array.from(byId.values());
};

const normalizePlan = (plan: FloorPlan): FloorPlan => {
  const next = { ...plan } as any;
  if (!Array.isArray(next.links)) next.links = [];
  next.views = normalizeViews(next.views) || [];
  if (!Array.isArray(next.rooms)) next.rooms = [];
  if (!Array.isArray(next.corridors)) next.corridors = [];
  if (Array.isArray(next.corridors)) {
    next.corridors = next.corridors.map((corridor: Corridor) => {
      const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as
        | 'rect'
        | 'poly';
      return {
        ...corridor,
        showName: corridor?.showName !== false,
        labelX: Number.isFinite(Number((corridor as any)?.labelX)) ? Number((corridor as any).labelX) : undefined,
        labelY: Number.isFinite(Number((corridor as any)?.labelY)) ? Number((corridor as any).labelY) : undefined,
        labelScale: Number.isFinite(Number((corridor as any)?.labelScale))
          ? Math.max(0.6, Math.min(3, Number((corridor as any).labelScale)))
          : 1,
        kind,
        points: Array.isArray(corridor?.points) ? corridor.points.map((p) => ({ x: Number(p?.x || 0), y: Number(p?.y || 0) })) : [],
        doors: Array.isArray(corridor?.doors)
          ? corridor.doors
              .map((d) => ({
                ...d,
                edgeIndex: Number(d?.edgeIndex || 0),
                t: Number(d?.t || 0),
                edgeIndexTo: Number.isFinite(Number((d as any)?.edgeIndexTo)) ? Number((d as any).edgeIndexTo) : undefined,
                tTo: Number.isFinite(Number((d as any)?.tTo)) ? Number((d as any).tTo) : undefined,
                mode:
                  (d as any)?.mode === 'auto_sensor' || (d as any)?.mode === 'automated' || (d as any)?.mode === 'static'
                    ? (d as any).mode
                    : 'static',
                automationUrl: typeof (d as any)?.automationUrl === 'string' ? String((d as any).automationUrl) : undefined,
                linkedRoomIds: Array.isArray((d as any)?.linkedRoomIds)
                  ? (d as any).linkedRoomIds.map((id: any) => String(id)).filter(Boolean)
                  : []
              }))
              .filter((d) => Number.isFinite(d.edgeIndex) && Number.isFinite(d.t))
          : [],
        connections: Array.isArray(corridor?.connections)
          ? corridor.connections
              .map((cp) => ({
                ...cp,
                edgeIndex: Number(cp?.edgeIndex || 0),
                t: Number(cp?.t || 0),
                planIds: Array.isArray(cp?.planIds) ? cp.planIds.map((id) => String(id)) : [],
                x: Number.isFinite(Number((cp as any)?.x)) ? Number((cp as any).x) : undefined,
                y: Number.isFinite(Number((cp as any)?.y)) ? Number((cp as any).y) : undefined
              }))
              .filter((cp) => Number.isFinite(cp.edgeIndex) && Number.isFinite(cp.t))
          : []
      };
    });
  }
  if (!Array.isArray(next.revisions)) next.revisions = [];
  if (!Array.isArray(next.objects)) next.objects = [];
  if (Array.isArray(next.objects)) {
    next.objects = next.objects.map((obj: MapObject) => {
      if (obj?.type === 'wifi') {
        const layerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
        const nextLayerIds = new Set(layerIds);
        nextLayerIds.delete('devices');
        nextLayerIds.add('wifi');
        return { ...obj, layerIds: Array.from(nextLayerIds) };
      }
      if (obj?.type === 'quote') {
        const layerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
        if (layerIds.includes('quotes')) return obj;
        return { ...obj, layerIds: [...layerIds, 'quotes'] };
      }
      if (obj?.type === 'text') {
        const layerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
        if (layerIds.includes('text')) return obj;
        return { ...obj, layerIds: [...layerIds, 'text'] };
      }
      if (obj?.type === 'postit') {
        const layerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
        if (layerIds.includes('text')) return obj;
        return { ...obj, layerIds: [...layerIds, 'text'] };
      }
      if (obj?.type === 'image') {
        const layerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
        if (layerIds.includes('images')) return obj;
        return { ...obj, layerIds: [...layerIds, 'images'] };
      }
      if (obj?.type === 'photo') {
        const layerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
        if (layerIds.includes('photos')) return obj;
        const nextLayerIds = new Set(layerIds);
        nextLayerIds.delete('images');
        nextLayerIds.add('photos');
        return { ...obj, layerIds: Array.from(nextLayerIds) };
      }
      return obj;
    });
  }
  if (!Array.isArray(next.racks)) next.racks = [];
  if (!Array.isArray(next.rackItems)) next.rackItems = [];
  if (!Array.isArray(next.rackLinks)) next.rackLinks = [];
  return next;
};

export const useDataStore = create<DataState>()(
  (set, get) => ({
    clients: defaultData(),
    objectTypes: defaultObjectTypes,
    version: 0,
    savedVersion: 0,
    setServerState: ({ clients, objectTypes }) =>
      set((state) => {
        const nextVersion = state.version + 1;
        const incomingTypes = Array.isArray(objectTypes) && objectTypes.length ? objectTypes : state.objectTypes;
        const builtins = defaultObjectTypes.filter((t) => t.builtin);
        const byId = new Map(incomingTypes.map((t) => [t.id, t]));
        for (const b of builtins) {
          if (!byId.has(b.id)) byId.set(b.id, b);
        }
        // Rename legacy "user" label only if it was never customized.
        const userType = byId.get('user');
        if (userType && (userType as any).builtin) {
          const it = userType.name?.it;
          const en = userType.name?.en;
          if (it === 'Utente' && en === 'User') {
            byId.set('user', { ...userType, name: { it: 'Utente generico', en: 'Generic user' } });
          }
        }
        const rackType = byId.get('rack');
        if (rackType && (rackType as any).builtin) {
          const it = rackType.name?.it;
          const en = rackType.name?.en;
          if (it === 'Rack' && en === 'Rack') {
            byId.set('rack', { ...rackType, name: { it: 'Rack rete', en: 'Network rack' } });
          }
        }

        // Migration: older DBs stored wall materials with the generic "cable" icon.
        // Force a dedicated wall icon so walls are recognizable across the UI.
        for (const [id, def] of byId.entries()) {
          if (!def) continue;
          const isWall = (def as any)?.category === 'wall' || String(id).startsWith('wall_');
          if (!isWall) continue;
          if ((def as any).icon === 'wall') continue;
          if (!(def as any).icon || (def as any).icon === 'cable') {
            byId.set(id, { ...(def as any), icon: 'wall' } as any);
          }
        }

        const mergedTypes = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
        return {
          clients: (clients || []).map((c) => ({
            ...c,
            layers: normalizeClientLayers(c),
            wifiAntennaModels: normalizeWifiAntennaModels((c as any).wifiAntennaModels),
            sites: (c.sites || []).map((s) => ({
              ...s,
              floorPlans: (s.floorPlans || []).map((p) => normalizePlan(p))
            }))
          })),
          objectTypes: mergedTypes,
          version: nextVersion,
          savedVersion: nextVersion
        };
      }),
    setClients: (clients) =>
      set((state) => {
        const nextVersion = state.version + 1;
        return { clients, version: nextVersion, savedVersion: nextVersion };
      }),
    markSaved: () => set((state) => ({ savedVersion: state.version })),
    addObjectType: ({ id, nameIt, nameEn, icon }) => {
      const key = String(id).trim();
      if (!key) return;
      set((state) => {
        if (state.objectTypes.some((t) => t.id === key)) return state;
        return {
          objectTypes: [
            ...state.objectTypes,
            { id: key, name: { it: String(nameIt).trim() || key, en: String(nameEn).trim() || key }, icon, builtin: false }
          ],
          version: state.version + 1
        } as any;
      });
    },
    updateObjectType: (id, payload) => {
      set((state) => ({
        objectTypes: state.objectTypes.map((t) =>
          t.id !== id
            ? t
            : {
                ...t,
                icon: payload.icon ?? t.icon,
                name: {
                  it: payload.nameIt !== undefined ? String(payload.nameIt).trim() || t.name.it : t.name.it,
                  en: payload.nameEn !== undefined ? String(payload.nameEn).trim() || t.name.en : t.name.en
                }
              }
        ),
        version: state.version + 1
      }));
    },
    deleteObjectType: (id) => {
      set((state) => {
        const target = state.objectTypes.find((t) => t.id === id);
        if (!target || target.builtin) return state;
        // prevent deletion if used by any object
        const used = state.clients.some((c) =>
          c.sites.some((s) => s.floorPlans.some((p) => p.objects.some((o) => o.type === id)))
        );
        if (used) return state;
        return { objectTypes: state.objectTypes.filter((t) => t.id !== id), version: state.version + 1 } as any;
      });
    },
      addClient: (name) => {
        const id = nanoid();
        set((state) => ({
          clients: [...state.clients, { id, name, layers: defaultLayers(), wifiAntennaModels: DEFAULT_WIFI_ANTENNA_MODELS, sites: [] }],
          version: state.version + 1
        }));
        return id;
      },
      updateClient: (id, payload) => {
        set((state) => ({
          clients: state.clients.map((c) => (c.id === id ? { ...c, ...payload } : c)),
          version: state.version + 1
        }));
      },
      deleteClient: (id) => {
        set((state) => ({ clients: state.clients.filter((c) => c.id !== id), version: state.version + 1 }));
      },
      addSite: (clientId, payload) => {
        const id = nanoid();
        const name = payload?.name || '';
        const coords = payload?.coords;
        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === clientId
              ? { ...client, sites: [...client.sites, { id, clientId, name, coords, floorPlans: [] }] }
              : client
          ),
          version: state.version + 1
        }));
        return id;
      },
      updateSite: (id, payload) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.map((site) =>
              site.id === id
                ? {
                    ...site,
                    ...(payload?.name !== undefined ? { name: payload.name || '' } : {}),
                    ...(payload?.coords !== undefined ? { coords: payload.coords || undefined } : {})
                  }
                : site
            )
          })),
          version: state.version + 1
        }));
      },
      deleteSite: (id) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.filter((site) => site.id !== id)
          })),
          version: state.version + 1
        }));
      },
      addFloorPlan: (siteId, name, imageUrl, width, height) => {
        const id = nanoid();
        set((state) => {
          const nextClients = updateSiteById(state.clients, siteId, (site) => {
            const existing = site.floorPlans || [];
            const maxOrder = Math.max(
              -1,
              ...existing.map((p) => (typeof (p as any).order === 'number' ? (p as any).order : -1))
            );
            const newPlan: FloorPlan = {
              id,
              siteId,
              name,
              imageUrl,
              order: maxOrder + 1,
              width,
              height,
              links: [],
              corridors: [],
              racks: [],
              rackItems: [],
              rackLinks: [],
              objects: []
            };
            return { ...site, floorPlans: [...existing, newPlan] };
          });
          return { clients: nextClients, version: state.version + 1 };
        });
        return id;
      },
      updateFloorPlan: (id, payload) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.map((site) => ({
              ...site,
              floorPlans: site.floorPlans.map((plan) =>
                plan.id === id ? { ...plan, ...payload } : plan
              )
            }))
          })),
          version: state.version + 1
        }));
      },
      deleteFloorPlan: (id) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.map((site) => ({
              ...site,
              floorPlans: site.floorPlans.filter((plan) => plan.id !== id)
            }))
          })),
          version: state.version + 1
        }));
      },
      reorderFloorPlans: (siteId, movingPlanId, targetPlanId, before = true) => {
        set((state) => {
          const nextClients = updateSiteById(state.clients, siteId, (site) => {
            const list = (site.floorPlans || []).slice();
            const from = list.findIndex((p) => p.id === movingPlanId);
            const to = list.findIndex((p) => p.id === targetPlanId);
            if (from === -1 || to === -1 || movingPlanId === targetPlanId) return site;
            const [moving] = list.splice(from, 1);
            const insertAt = before ? (from < to ? to - 1 : to) : from < to ? to : to + 1;
            list.splice(Math.max(0, Math.min(list.length, insertAt)), 0, moving);
            const normalized = list.map((p, idx) => ({ ...p, order: idx }));
            return { ...site, floorPlans: normalized };
          });
          return { clients: nextClients, version: state.version + 1 };
        });
      },
      setFloorPlanContent: (floorPlanId, payload) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            imageUrl: payload.imageUrl,
            width: payload.width,
            height: payload.height,
            ...(payload as any).printArea !== undefined ? { printArea: (payload as any).printArea } : {},
            ...(payload as any).scale !== undefined ? { scale: (payload as any).scale } : {},
            objects: Array.isArray(payload.objects) ? payload.objects : [],
            rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
            corridors: Array.isArray((payload as any).corridors) ? (payload as any).corridors : (plan as any).corridors,
            views: Array.isArray(payload.views) ? payload.views : [],
            links: Array.isArray((payload as any).links) ? (payload as any).links : (plan as any).links,
            racks: Array.isArray((payload as any).racks) ? (payload as any).racks : (plan as any).racks,
            rackItems: Array.isArray((payload as any).rackItems) ? (payload as any).rackItems : (plan as any).rackItems,
            rackLinks: Array.isArray((payload as any).rackLinks) ? (payload as any).rackLinks : (plan as any).rackLinks
          })),
          version: state.version + 1
        }));
      },
      addObject: (floorPlanId, type, name, description, x, y, scale = 0.5, layerIds, extra) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            objects: [
              ...plan.objects,
              {
                id,
                floorPlanId,
                type,
                name,
                description,
                x,
                y,
                scale,
                layerIds,
                ...(extra || {})
              }
            ]
          })),
          version: state.version + 1
        }));
        return id;
      },
      updateObject: (id, changes) => {
        set((state) => ({
          clients: (() => {
            const nextClients = updateObjectById(state.clients, id, (obj) => ({ ...obj, ...changes }));
            if (typeof (changes as any)?.name !== 'string') return nextClients;
            const nextName = String((changes as any).name || '');
            for (let ci = 0; ci < nextClients.length; ci++) {
              const client = nextClients[ci];
              for (let si = 0; si < client.sites.length; si++) {
                const site = client.sites[si];
                for (let pi = 0; pi < site.floorPlans.length; pi++) {
                  const plan = site.floorPlans[pi];
                  const obj = plan.objects.find((o) => o.id === id);
                  if (!obj || obj.type !== 'rack') continue;
                  const racks = Array.isArray((plan as any).racks) ? (plan as any).racks : [];
                  if (!racks.length) return nextClients;
                  const nextRacks = racks.map((r: RackDefinition) => (r.id === id ? { ...r, name: nextName } : r));
                  const nextPlan: FloorPlan = { ...plan, racks: nextRacks };
                  const nextPlans = site.floorPlans.slice();
                  nextPlans[pi] = nextPlan;
                  const nextSite: Site = { ...site, floorPlans: nextPlans };
                  const nextSites = client.sites.slice();
                  nextSites[si] = nextSite;
                  const nextClient: Client = { ...client, sites: nextSites };
                  const patched = nextClients.slice();
                  patched[ci] = nextClient;
                  return patched;
                }
              }
            }
            return nextClients;
          })(),
          version: state.version + 1
        }));
      },
      moveObject: (id, x, y) => {
        set((state) => ({
          clients: updateObjectById(state.clients, id, (obj) => ({ ...obj, x, y })),
          version: state.version + 1
        }));
      },
      deleteObject: (id) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.map((site) => ({
              ...site,
              floorPlans: site.floorPlans.map((plan) => {
                const obj = plan.objects.find((o) => o.id === id);
                if (!obj) return plan;
                const nextObjects = plan.objects.filter((o) => o.id !== id);
                if (obj.type !== 'rack') {
                  return { ...plan, objects: nextObjects };
                }
                const removedIds = new Set(
                  ((plan as any).rackItems || []).filter((i: RackItem) => i.rackId === id).map((i: RackItem) => i.id)
                );
                return {
                  ...plan,
                  objects: nextObjects,
                  racks: ((plan as any).racks || []).filter((r: RackDefinition) => r.id !== id),
                  rackItems: ((plan as any).rackItems || []).filter((i: RackItem) => i.rackId !== id),
                  rackLinks: ((plan as any).rackLinks || []).filter(
                    (l: RackLink) => !removedIds.has(l.fromItemId) && !removedIds.has(l.toItemId)
                  )
                };
              })
            }))
          })),
          version: state.version + 1
        }));
      },
      removeRealUserAllocations: (clientId, externalUserId) => {
        const cid = String(clientId || '').trim();
        const eid = String(externalUserId || '').trim();
        if (!cid || !eid) return;
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id !== cid
              ? c
              : {
                  ...c,
                  sites: c.sites.map((s) => ({
                    ...s,
                    floorPlans: s.floorPlans.map((p) => ({
                      ...p,
                      objects: (p.objects || []).filter(
                        (o) => !(o.type === 'real_user' && (o as any).externalClientId === cid && (o as any).externalUserId === eid)
                      )
                    }))
                  }))
                }
          ),
          version: state.version + 1
        }));
      },
      removeRealUserAllocationsBulk: (clientId, externalUserIds) => {
        const cid = String(clientId || '').trim();
        const ids = Array.isArray(externalUserIds) ? externalUserIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
        const unique = Array.from(new Set(ids));
        if (!cid || !unique.length) return { affectedPlans: [] };

        const affectedPlans: { planId: string; removedObjectIds: string[] }[] = [];

        set((state) => {
          const nextClients = state.clients.map((c) => {
            if (c.id !== cid) return c;
            return {
              ...c,
              sites: c.sites.map((s) => ({
                ...s,
                floorPlans: s.floorPlans.map((p) => {
                  const removed: string[] = [];
                  const nextObjects = (p.objects || []).filter((o) => {
                    if (o.type !== 'real_user') return true;
                    const ocid = String((o as any).externalClientId || '').trim();
                    const oeid = String((o as any).externalUserId || '').trim();
                    const match = ocid === cid && unique.includes(oeid);
                    if (match) removed.push(o.id);
                    return !match;
                  });
                  if (removed.length) affectedPlans.push({ planId: p.id, removedObjectIds: removed });
                  return removed.length ? { ...p, objects: nextObjects } : p;
                })
              }))
            };
          });
          return { clients: nextClients, version: state.version + 1 };
        });

        return { affectedPlans };
      },
      clearObjects: (floorPlanId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({ ...plan, objects: [] })),
          version: state.version + 1
        }));
      },
      setObjectRoomIds: (floorPlanId, roomIdByObjectId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            objects: plan.objects.map((obj) => {
              if (!Object.prototype.hasOwnProperty.call(roomIdByObjectId, obj.id)) return obj;
              const nextRoomId = roomIdByObjectId[obj.id];
              if ((obj.roomId ?? undefined) === (nextRoomId ?? undefined)) return obj;
              return { ...obj, roomId: nextRoomId };
            })
          })),
          version: state.version + 1
        }));
      },
      addRoom: (floorPlanId, room) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rooms: [...(plan.rooms || []), { id, ...room }]
          })),
          version: state.version + 1
        }));
        return id;
      },
      updateRoom: (floorPlanId, roomId, changes) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rooms: (plan.rooms || []).map((r) => (r.id === roomId ? { ...r, ...changes } : r))
          })),
          version: state.version + 1
        }));
      },
      deleteRoom: (floorPlanId, roomId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rooms: (plan.rooms || []).filter((r) => r.id !== roomId),
            objects: plan.objects.map((o) => (o.roomId === roomId ? { ...o, roomId: undefined } : o))
          })),
          version: state.version + 1
        }));
      },
      addRevision: (floorPlanId, payload) => {
        const id = nanoid();
	        const actor = (() => {
	          const u = useAuthStore.getState().user as any;
	          if (!u) return undefined;
	          return {
	            id: String(u.id),
	            username: String(u.username),
	            firstName: String(u.firstName || ''),
	            lastName: String(u.lastName || ''),
	            avatarUrl: String(u.avatarUrl || '')
	          };
	        })();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => {
            const bump = payload?.bump || 'minor';
            const rev = (plan.revisions || []).length ? nextRev(plan, bump) : { major: 1, minor: 0 };
            const revision = snapshotRevision(plan, rev, { ...payload, ...(actor ? { createdBy: actor } : {}) });
            revision.id = id;
            const existing = plan.revisions || [];
            return { ...plan, revisions: [revision, ...existing] };
          }),
          version: state.version + 1
        }));
        return id;
      },
      restoreRevision: (floorPlanId, revisionId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => {
            const rev = (plan.revisions || []).find((r) => r.id === revisionId);
            if (!rev) return plan;
            return {
              ...plan,
            imageUrl: rev.imageUrl,
            width: rev.width,
            height: rev.height,
            objects: Array.isArray(rev.objects) ? rev.objects : [],
              rooms: Array.isArray(rev.rooms) ? rev.rooms : [],
              corridors: Array.isArray((rev as any).corridors) ? (rev as any).corridors : [],
              views: Array.isArray(rev.views) ? rev.views : [],
              links: Array.isArray((rev as any).links) ? (rev as any).links : (plan as any).links,
              racks: Array.isArray((rev as any).racks) ? (rev as any).racks : (plan as any).racks,
              rackItems: Array.isArray((rev as any).rackItems) ? (rev as any).rackItems : (plan as any).rackItems,
              rackLinks: Array.isArray((rev as any).rackLinks) ? (rev as any).rackLinks : (plan as any).rackLinks
            };
          }),
          version: state.version + 1
        }));
      },
      updateRevision: (floorPlanId, revisionId, changes) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            revisions: (plan.revisions || []).map((r) => (r.id === revisionId ? { ...r, ...changes } : r))
          })),
          version: state.version + 1
        }));
      },
      deleteRevision: (floorPlanId, revisionId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            revisions: (plan.revisions || []).filter((r) => r.id !== revisionId)
          })),
          version: state.version + 1
        }));
      },
      clearRevisions: (floorPlanId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({ ...plan, revisions: [] })),
          version: state.version + 1
        }));
      },
      findFloorPlan: (id) => {
        const clients = get().clients;
        for (const client of clients) {
          for (const site of client.sites) {
            const found = site.floorPlans.find((p) => p.id === id);
            if (found) return found;
          }
        }
        return undefined;
      },
      findClientByPlan: (planId) => {
        return get().clients.find((client) =>
          client.sites.some((site) => site.floorPlans.some((plan) => plan.id === planId))
        );
      },
      findSiteByPlan: (planId) => {
        for (const client of get().clients) {
          for (const site of client.sites) {
            if (site.floorPlans.some((plan) => plan.id === planId)) return site;
          }
        }
        return undefined;
      },
      addView: (floorPlanId, view) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => {
            const existing = plan.views || [];
            const nextViews = view.isDefault ? existing.map((v) => ({ ...v, isDefault: false })) : existing;
            const nextView = { id, ...view, name: view.isDefault ? 'DEFAULT' : view.name };
            const merged = view.isDefault ? [nextView, ...nextViews] : [...nextViews, nextView];
            return { ...plan, views: normalizeViews(merged) || [] };
          }),
          version: state.version + 1
        }));
        return id;
      },
      updateView: (floorPlanId, viewId, changes) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            views: normalizeViews(
              (plan.views || []).map((v) => {
                if (v.id !== viewId) return v;
                const next = { ...v, ...changes };
                if (changes?.isDefault) next.name = 'DEFAULT';
                return next;
              })
            ) || []
          })),
          version: state.version + 1
        }));
      },
      deleteView: (floorPlanId, viewId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            views: normalizeViews((plan.views || []).filter((v) => v.id !== viewId)) || []
          })),
          version: state.version + 1
        }));
      },
      setDefaultView: (floorPlanId, viewId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            views: normalizeViews(
              (plan.views || []).map((v) => ({
                ...v,
                isDefault: v.id === viewId,
                name: v.id === viewId ? 'DEFAULT' : v.name
              }))
            ) || []
          })),
          version: state.version + 1
        }));
      },
      addLink: (floorPlanId, fromId, toId, payload) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            links: [
              ...((plan as any).links || []),
              {
                id,
                fromId,
                toId,
                kind: payload?.kind || 'arrow',
                arrow: payload?.arrow ?? 'none',
                name: payload?.name,
                description: payload?.description,
                label: payload?.label,
                color: payload?.color,
                width: payload?.width ?? 1,
                dashed: payload?.dashed,
                route: payload?.route
              }
            ]
          })),
          version: state.version + 1
        }));
        return id;
      },
      deleteLink: (floorPlanId, linkId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            links: ((plan as any).links || []).filter((l: PlanLink) => l.id !== linkId)
          })),
          version: state.version + 1
        }));
      },
      updateLink: (floorPlanId, linkId, payload) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            links: ((plan as any).links || []).map((l: PlanLink) => (l.id === linkId ? { ...l, ...payload } : l))
          })),
          version: state.version + 1
        }));
      },
      ensureRack: (floorPlanId, rackId, payload) => {
        const now = Date.now();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => {
            const racks = Array.isArray((plan as any).racks) ? (plan as any).racks : [];
            const exists = racks.find((r: RackDefinition) => r.id === rackId);
            if (exists) return plan;
            return {
              ...plan,
              racks: [...racks, { id: rackId, name: payload.name, totalUnits: payload.totalUnits, createdAt: now }]
            };
          }),
          version: state.version + 1
        }));
      },
      updateRack: (floorPlanId, rackId, changes) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            racks: ((plan as any).racks || []).map((r: RackDefinition) => (r.id === rackId ? { ...r, ...changes } : r))
          })),
          version: state.version + 1
        }));
      },
      deleteRack: (floorPlanId, rackId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            racks: ((plan as any).racks || []).filter((r: RackDefinition) => r.id !== rackId),
            rackItems: ((plan as any).rackItems || []).filter((i: RackItem) => i.rackId !== rackId),
            rackLinks: (() => {
              const removedIds = new Set(
                ((plan as any).rackItems || []).filter((i: RackItem) => i.rackId === rackId).map((i: RackItem) => i.id)
              );
              return ((plan as any).rackLinks || []).filter(
                (l: RackLink) => !removedIds.has(l.fromItemId) && !removedIds.has(l.toItemId)
              );
            })()
          })),
          version: state.version + 1
        }));
      },
      addRackItem: (floorPlanId, rackItem) => {
        const id = nanoid();
        const now = Date.now();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rackItems: [
              ...((plan as any).rackItems || []),
              { ...rackItem, id, createdAt: now, updatedAt: now }
            ]
          })),
          version: state.version + 1
        }));
        return id;
      },
      updateRackItem: (floorPlanId, itemId, changes) => {
        const now = Date.now();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rackItems: ((plan as any).rackItems || []).map((i: RackItem) => {
              if (i.id !== itemId) return i;
              const nextItem: RackItem = { ...i, ...changes, updatedAt: now };
              if (typeof changes.ethPorts === 'number' && Array.isArray(nextItem.ethPortNames)) {
                nextItem.ethPortNames = nextItem.ethPortNames.slice(0, Math.max(0, changes.ethPorts));
              }
              if (typeof changes.ethPorts === 'number' && Array.isArray(nextItem.ethPortNotes)) {
                nextItem.ethPortNotes = nextItem.ethPortNotes.slice(0, Math.max(0, changes.ethPorts));
              }
              if (typeof changes.fiberPorts === 'number' && Array.isArray(nextItem.fiberPortNames)) {
                nextItem.fiberPortNames = nextItem.fiberPortNames.slice(0, Math.max(0, changes.fiberPorts));
              }
              if (typeof changes.fiberPorts === 'number' && Array.isArray(nextItem.fiberPortNotes)) {
                nextItem.fiberPortNotes = nextItem.fiberPortNotes.slice(0, Math.max(0, changes.fiberPorts));
              }
              return nextItem;
            }),
            rackLinks: (() => {
              if (typeof changes.ethPorts !== 'number' && typeof changes.fiberPorts !== 'number') {
                return (plan as any).rackLinks;
              }
              const nextLinks = ((plan as any).rackLinks || []).filter((l: RackLink) => {
                if (l.fromItemId === itemId) {
                  if (l.fromPortKind === 'ethernet' && typeof changes.ethPorts === 'number') {
                    return l.fromPortIndex <= changes.ethPorts;
                  }
                  if (l.fromPortKind === 'fiber' && typeof changes.fiberPorts === 'number') {
                    return l.fromPortIndex <= changes.fiberPorts;
                  }
                }
                if (l.toItemId === itemId) {
                  if (l.toPortKind === 'ethernet' && typeof changes.ethPorts === 'number') {
                    return l.toPortIndex <= changes.ethPorts;
                  }
                  if (l.toPortKind === 'fiber' && typeof changes.fiberPorts === 'number') {
                    return l.toPortIndex <= changes.fiberPorts;
                  }
                }
                return true;
              });
              return nextLinks;
            })()
          })),
          version: state.version + 1
        }));
      },
      deleteRackItem: (floorPlanId, itemId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rackItems: ((plan as any).rackItems || []).filter((i: RackItem) => i.id !== itemId),
            rackLinks: ((plan as any).rackLinks || []).filter(
              (l: RackLink) => l.fromItemId !== itemId && l.toItemId !== itemId
            )
          })),
          version: state.version + 1
        }));
      },
      addRackLink: (floorPlanId, payload) => {
        const id = nanoid();
        const now = Date.now();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rackLinks: [...((plan as any).rackLinks || []), { ...payload, id, createdAt: now }]
          })),
          version: state.version + 1
        }));
        return id;
      },
      deleteRackLink: (floorPlanId, linkId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rackLinks: ((plan as any).rackLinks || []).filter((l: RackLink) => l.id !== linkId)
          })),
          version: state.version + 1
        }));
      },
      cloneFloorPlan: (sourcePlanId, options) => {
        const source = get().findFloorPlan(sourcePlanId);
        if (!source) return null;
        const includeRooms = options?.includeRooms !== false;
        const includeObjects = !!options?.includeObjects;
        const includeViews = options?.includeViews !== false;
        const id = nanoid();

        const normalizePlanName = (value: string) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
        let sitePlans: FloorPlan[] = [];
        for (const c of get().clients) {
          for (const s of c.sites) {
            if (s.id !== source.siteId) continue;
            sitePlans = s.floorPlans || [];
          }
        }
        const name = String(options?.name || `${source.name} (Copy)`).trim() || `${source.name} (Copy)`;
        const wantedKey = normalizePlanName(name);
        if (wantedKey) {
          const conflict = sitePlans.some((p) => normalizePlanName(String(p?.name || '')) === wantedKey);
          if (conflict) return null;
        }
        const maxOrder = Math.max(-1, ...sitePlans.map((p) => (typeof (p as any).order === 'number' ? (p as any).order : -1)));

        set((state) => {
          const roomIdMap = new Map();
          const nextRooms = includeRooms
            ? (source.rooms || []).map((r) => {
                const nextId = nanoid();
                roomIdMap.set(r.id, nextId);
                return { ...r, id: nextId };
              })
            : [];

          const nextCorridors = includeRooms
            ? ((source as any).corridors || []).map((c: any) => ({
                ...c,
                id: nanoid(),
                points: Array.isArray(c?.points) ? c.points.map((p: any) => ({ ...p })) : [],
                doors: Array.isArray(c?.doors)
                  ? c.doors.map((d: any) => ({
                      ...d,
                      id: nanoid(),
                      linkedRoomIds: Array.isArray(d?.linkedRoomIds)
                        ? d.linkedRoomIds
                            .map((rid: any) => (includeRooms ? roomIdMap.get(String(rid)) : String(rid)))
                            .filter(Boolean)
                        : []
                    }))
                  : [],
                connections: Array.isArray(c?.connections)
                  ? c.connections.map((cp: any) => ({ ...cp, id: nanoid(), planIds: Array.isArray(cp?.planIds) ? [...cp.planIds] : [] }))
                  : []
              }))
            : [];

          const objectIdMap = new Map<string, string>();
          const nextObjects = includeObjects
            ? (source.objects || []).map((o) => {
                const nextId = nanoid();
                objectIdMap.set(o.id, nextId);
                return {
                  ...o,
                  id: nextId,
                  floorPlanId: id,
                  roomId: includeRooms ? (o.roomId ? roomIdMap.get(o.roomId) : undefined) : undefined
                };
              })
            : [];

          const nextLinks = includeObjects
            ? ((source as any).links || [])
                .map((l: any) => {
                  const fromId = objectIdMap.get(l.fromId);
                  const toId = objectIdMap.get(l.toId);
                  if (!fromId || !toId) return null;
                  return { ...l, id: nanoid(), fromId, toId };
                })
                .filter(Boolean)
            : [];

          const rackIdMap = new Map<string, string>();
          const nextRacks = includeObjects
            ? ((source as any).racks || [])
                .map((r: RackDefinition) => {
                  const nextId = objectIdMap.get(r.id);
                  if (!nextId) return null;
                  rackIdMap.set(r.id, nextId);
                  return { ...r, id: nextId };
                })
                .filter(Boolean)
            : [];

          const rackItemIdMap = new Map<string, string>();
          const nextRackItems = includeObjects
            ? ((source as any).rackItems || [])
                .map((i: RackItem) => {
                  const nextRackId = rackIdMap.get(i.rackId);
                  if (!nextRackId) return null;
                  const nextId = nanoid();
                  rackItemIdMap.set(i.id, nextId);
                  return { ...i, id: nextId, rackId: nextRackId };
                })
                .filter(Boolean)
            : [];

          const nextRackLinks = includeObjects
            ? ((source as any).rackLinks || [])
                .map((l: RackLink) => {
                  const fromId = rackItemIdMap.get(l.fromItemId);
                  const toId = rackItemIdMap.get(l.toItemId);
                  if (!fromId || !toId) return null;
                  return { ...l, id: nanoid(), fromItemId: fromId, toItemId: toId };
                })
                .filter(Boolean)
            : [];

          const nextViews = includeViews
            ? (source.views || []).map((v) => ({ ...v, id: nanoid(), pan: { ...v.pan } }))
            : [];

          if (nextViews.length) {
            const def = nextViews.find((v) => v.isDefault);
            if (!def) nextViews[0].isDefault = true;
            else for (const v of nextViews) v.isDefault = v.id === def.id;
          }

          const nextPlan: FloorPlan = normalizePlan({
            id,
            siteId: source.siteId,
            name,
            imageUrl: source.imageUrl,
            order: maxOrder + 1,
            width: source.width,
            height: source.height,
            scale: source.scale ? { ...source.scale } : undefined,
            views: nextViews,
            rooms: nextRooms,
            corridors: nextCorridors,
            revisions: [],
            links: nextLinks,
            racks: nextRacks,
            rackItems: nextRackItems,
            rackLinks: nextRackLinks,
            objects: nextObjects
          });

          const nextClients = updateSiteById(state.clients, source.siteId, (site) => ({
            ...site,
            floorPlans: [...(site.floorPlans || []), nextPlan]
          }));
          return { clients: nextClients, version: state.version + 1 };
        });

        return id;
      },
      updateClientLayers: (clientId, layers, options) => {
        set((state) => {
          const nextClients = state.clients.map((client) => {
            if (client.id !== clientId) return client;
            const nextLayers = normalizeClientLayers({ ...client, layers } as Client);
            if (!options?.updateObjects) {
              return { ...client, layers: nextLayers };
            }
            const nextSites = (client.sites || []).map((site) => ({
              ...site,
              floorPlans: (site.floorPlans || []).map((plan) => ({
                ...plan,
                objects: (plan.objects || []).map((obj) => options.updateObjects!(obj))
              }))
            }));
            return { ...client, layers: nextLayers, sites: nextSites };
          });
          return { clients: nextClients, version: state.version + 1 };
        });
      }
  })
);
