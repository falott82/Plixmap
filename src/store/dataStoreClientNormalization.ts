// Client/site/plan normalization helpers extracted from useDataStore.ts. Pure
// functions that coerce persisted/imported shapes into the canonical model
// (default layers, site support contacts/schedule, wifi models, plan layers,
// and full plan normalization). No store state.
import { nanoid } from 'nanoid';
import { Client, Corridor, FloorPlan, LayerDefinition, MapObject, Room, RoomConnectionDoor, Site, WifiAntennaModel } from './types';
import {
  ALL_ITEMS_LAYER_ID,
  SYSTEM_LAYER_IDS,
  ALL_ITEMS_LAYER_COLOR,
  DEFAULT_CCTV_TYPES,
  DEFAULT_DESK_TYPES,
  DEFAULT_DEVICE_TYPES,
  DEFAULT_IMAGE_TYPES,
  DEFAULT_PHOTO_TYPES,
  DEFAULT_RACK_TYPES,
  DEFAULT_SECURITY_TYPES,
  DEFAULT_TEXT_TYPES,
  DEFAULT_USER_TYPES,
  DEFAULT_WIFI_ANTENNA_MODELS,
  DEFAULT_WIFI_TYPES,
  DEFAULT_WALL_TYPES,
  QUOTE_LAYER_COLOR,
  WIFI_DEFAULT_STANDARD,
  WALL_LAYER_COLOR,
  WIFI_LAYER_COLOR
} from './data';
import { isSecurityTypeId, SECURITY_LAYER_ID } from './security';
import {
  normalizeDoorVerificationHistory,
  normalizeRoomConnectionDoor,
  normalizeSecurityCheckHistory,
  normalizeSecurityDocuments,
  normalizeViews
} from './dataStoreNormalization';

export const defaultLayers = (): LayerDefinition[] => [
  { id: ALL_ITEMS_LAYER_ID, name: { it: 'Tutti gli elementi', en: 'All Items' }, color: ALL_ITEMS_LAYER_COLOR, order: 1 },
  { id: 'users', name: { it: 'Utenti', en: 'Users' }, color: '#2563eb', order: 2, typeIds: DEFAULT_USER_TYPES },
  { id: 'devices', name: { it: 'Dispositivi', en: 'Devices' }, color: '#0ea5e9', order: 3, typeIds: DEFAULT_DEVICE_TYPES },
  { id: 'wifi', name: { it: 'WiFi', en: 'WiFi' }, color: WIFI_LAYER_COLOR, order: 4, typeIds: DEFAULT_WIFI_TYPES },
  { id: 'cctv', name: { it: 'CCTV', en: 'CCTV' }, color: '#22c55e', order: 5, typeIds: DEFAULT_CCTV_TYPES },
  { id: 'desks', name: { it: 'Scrivanie', en: 'Desks' }, color: '#8b5cf6', order: 6, typeIds: DEFAULT_DESK_TYPES },
  { id: SECURITY_LAYER_ID, name: { it: 'Sicurezza', en: 'Safety' }, color: '#ef4444', order: 7, typeIds: DEFAULT_SECURITY_TYPES },
  { id: 'cabling', name: { it: 'Cablaggi', en: 'Cabling' }, color: '#10b981', order: 8 },
  { id: 'walls', name: { it: 'Mura', en: 'Walls' }, color: WALL_LAYER_COLOR, order: 9, typeIds: DEFAULT_WALL_TYPES },
  { id: 'quotes', name: { it: 'Quote', en: 'Quotes' }, color: QUOTE_LAYER_COLOR, order: 10 },
  { id: 'rooms', name: { it: 'Stanze', en: 'Rooms' }, color: '#64748b', order: 11 },
  { id: 'corridors', name: { it: 'Corridoi', en: 'Corridors' }, color: '#94a3b8', order: 12 },
  { id: 'racks', name: { it: 'Rack', en: 'Racks' }, color: '#f97316', order: 13, typeIds: DEFAULT_RACK_TYPES },
  { id: 'text', name: { it: 'Testo', en: 'Text' }, color: '#0f172a', order: 14, typeIds: DEFAULT_TEXT_TYPES },
  { id: 'images', name: { it: 'Immagini', en: 'Images' }, color: '#64748b', order: 15, typeIds: DEFAULT_IMAGE_TYPES },
  { id: 'photos', name: { it: 'Foto', en: 'Photos' }, color: '#14b8a6', order: 16, typeIds: DEFAULT_PHOTO_TYPES }
];

export const normalizeSupportContactValue = (value: any) => {
  const email = String(value?.email || '').trim();
  const phone = String(value?.phone || '').trim();
  if (!email && !phone) return undefined;
  return { ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
};

export const normalizeSiteSupportContacts = (value: any) => {
  if (!value || typeof value !== 'object') return undefined;
  const cleaning = normalizeSupportContactValue(value.cleaning);
  const it = normalizeSupportContactValue(value.it);
  const coffee = normalizeSupportContactValue(value.coffee);
  if (!cleaning && !it && !coffee) return undefined;
  return {
    ...(cleaning ? { cleaning } : {}),
    ...(it ? { it } : {}),
    ...(coffee ? { coffee } : {})
  };
};

export const normalizeSiteSchedule = (value: any): Site['siteSchedule'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const holidayCalendar = ['custom', 'it', 'us', 'uk', 'de', 'fr', 'es', 'cn', 'sa', 'ae'].includes(String(value.holidayCalendar || '').trim())
    ? (String(value.holidayCalendar || '').trim() as NonNullable<Site['siteSchedule']>['holidayCalendar'])
    : undefined;
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const weeklySource = value.weekly && typeof value.weekly === 'object' ? value.weekly : {};
  const weekly: Record<string, { closed?: boolean; open?: string; close?: string; slots?: Array<{ start: string; end: string }> }> = {};
  for (const key of dayKeys) {
    const row = (weeklySource as any)?.[key];
    if (!row || typeof row !== 'object') continue;
    const slots = Array.isArray(row.slots)
      ? row.slots
          .map((slot: any) => {
            const start = String(slot?.start || '').trim();
            const end = String(slot?.end || '').trim();
            if (!start || !end) return null;
            return { start, end };
          })
          .filter(Boolean)
      : [];
    const open = String(row.open || slots[0]?.start || '').trim();
    const close = String(row.close || (slots.length ? slots[slots.length - 1]?.end : '') || '').trim();
    const closed = !!row.closed;
    if (!closed && !open && !close && !slots.length) continue;
    weekly[key] = {
      ...(closed ? { closed: true } : {}),
      ...(!closed && open ? { open } : {}),
      ...(!closed && close ? { close } : {}),
      ...(!closed && slots.length ? { slots: slots as any } : {})
    };
  }
  const holidays = Array.isArray(value.holidays)
    ? value.holidays
        .map((h: any) => {
          const date = String(h?.date || '').trim();
          const label = String(h?.label || '').trim();
          const source = String(h?.source || '').trim();
          if (!date) return null;
          return {
            date,
            ...(label ? { label } : {}),
            ...(h?.closed === false ? { closed: false } : {}),
            ...(source === 'national' || source === 'custom' ? { source: source as 'national' | 'custom' } : {})
          };
        })
        .filter(Boolean)
    : [];
  if (!Object.keys(weekly).length && !holidays.length) return undefined;
  return {
    ...(holidayCalendar ? { holidayCalendar } : {}),
    ...(Object.keys(weekly).length ? { weekly: weekly as any } : {}),
    ...(holidays.length ? { holidays: holidays as any } : {})
  };
};

export const normalizeOpenAiDailyTokensPerUser = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed);
};

export const normalizeWifiAntennaModels = (models?: WifiAntennaModel[]): WifiAntennaModel[] => {
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

export const ensureLayerTypes = (layer: LayerDefinition): LayerDefinition => {
  if (Array.isArray(layer.typeIds) && layer.typeIds.length) return layer;
  if (layer.id === 'users') return { ...layer, typeIds: DEFAULT_USER_TYPES };
  if (layer.id === 'devices') return { ...layer, typeIds: DEFAULT_DEVICE_TYPES };
  if (layer.id === 'wifi') return { ...layer, typeIds: DEFAULT_WIFI_TYPES };
  if (layer.id === 'cctv') return { ...layer, typeIds: DEFAULT_CCTV_TYPES };
  if (layer.id === 'desks') return { ...layer, typeIds: DEFAULT_DESK_TYPES };
  if (layer.id === 'text') return { ...layer, typeIds: DEFAULT_TEXT_TYPES };
  if (layer.id === 'images') return { ...layer, typeIds: DEFAULT_IMAGE_TYPES };
  if (layer.id === 'photos') return { ...layer, typeIds: DEFAULT_PHOTO_TYPES };
  if (layer.id === SECURITY_LAYER_ID) return { ...layer, typeIds: DEFAULT_SECURITY_TYPES };
  if (layer.id === 'walls') return { ...layer, typeIds: DEFAULT_WALL_TYPES };
  if (layer.id === 'racks') return { ...layer, typeIds: DEFAULT_RACK_TYPES };
  return layer;
};

export const normalizeClientLayers = (client: Client): LayerDefinition[] => {
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
    if (id === SECURITY_LAYER_ID) {
      const legacyColor = '#dc2626';
      if (!next.color || next.color === legacyColor) {
        next.color = '#ef4444';
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

export const normalizePlan = (plan: FloorPlan): FloorPlan => {
  const next = { ...plan } as any;
  if (!Array.isArray(next.links)) next.links = [];
  if (next.safetyCardLayout) {
    next.safetyCardLayout = {
      x: Number(next.safetyCardLayout.x || 0),
      y: Number(next.safetyCardLayout.y || 0),
      w: Math.max(220, Number(next.safetyCardLayout.w || 420)),
      h: Math.max(56, Number(next.safetyCardLayout.h || 84)),
      fontSize: Number.isFinite(Number(next.safetyCardLayout.fontSize))
        ? Math.max(8, Math.min(22, Number(next.safetyCardLayout.fontSize)))
        : undefined,
      fontIndex: Number.isFinite(Number(next.safetyCardLayout.fontIndex))
        ? Math.max(0, Math.floor(Number(next.safetyCardLayout.fontIndex)))
        : 0,
      colorIndex: Number.isFinite(Number(next.safetyCardLayout.colorIndex))
        ? Math.max(0, Math.floor(Number(next.safetyCardLayout.colorIndex)))
        : 0,
      textBgIndex: Number.isFinite(Number(next.safetyCardLayout.textBgIndex))
        ? Math.max(0, Math.floor(Number(next.safetyCardLayout.textBgIndex)))
        : 0
    };
  }
  next.views = normalizeViews(next.views) || [];
  if (!Array.isArray(next.rooms)) next.rooms = [];
  if (Array.isArray(next.rooms)) {
    next.rooms = next.rooms.map((room: Room) => ({
      ...room,
      capacity: Number.isFinite(Number((room as any)?.capacity))
        ? Math.max(0, Math.floor(Number((room as any).capacity)))
        : 0,
      departmentTags: Array.isArray((room as any)?.departmentTags)
        ? Array.from(
            new Set(
              ((room as any).departmentTags || [])
                .map((entry: any) => String(entry || '').trim())
                .filter(Boolean)
                .map((entry: string) => entry.toLocaleLowerCase())
            )
          ).map((folded) => {
            const found = ((room as any).departmentTags || []).find(
              (entry: any) => String(entry || '').trim().toLocaleLowerCase() === folded
            );
            return String(found || '').trim();
          })
        : [],
      labelScale: Number.isFinite(Number((room as any)?.labelScale))
        ? Math.max(0.3, Math.min(3, Number((room as any).labelScale)))
        : undefined,
      fillOpacity: Number.isFinite(Number((room as any)?.fillOpacity))
        ? Math.max(0.05, Math.min(1, Number((room as any).fillOpacity)))
        : undefined,
      labelPosition:
        (room as any)?.labelPosition === 'bottom' || (room as any)?.labelPosition === 'left' || (room as any)?.labelPosition === 'right'
          ? (room as any).labelPosition
          : 'top',
      noWindows: !!(room as any)?.noWindows,
      wifiAvailable: !!(room as any)?.wifiAvailable,
      fridgeAvailable: !!(room as any)?.fridgeAvailable,
      storageRoom: !!(room as any)?.storageRoom,
      bathroom: !!(room as any)?.bathroom,
      technicalRoom: !!(room as any)?.technicalRoom,
      meetingProjector: !!(room as any)?.meetingProjector,
      meetingTv: !!(room as any)?.meetingTv,
      meetingVideoConf: !!(room as any)?.meetingVideoConf,
      meetingCoffeeService: !!(room as any)?.meetingCoffeeService,
      meetingWhiteboard: !!(room as any)?.meetingWhiteboard,
      meetingKioskEnabled: !!(room as any)?.meetingKioskEnabled
    }));
  }
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
                catalogTypeId: typeof (d as any)?.catalogTypeId === 'string' ? String((d as any).catalogTypeId).trim() || undefined : undefined,
                description: typeof (d as any)?.description === 'string' ? String((d as any).description).trim() || undefined : undefined,
                isEmergency: !!(d as any)?.isEmergency,
                isMainEntrance: !!(d as any)?.isMainEntrance,
                isExternal: !!(d as any)?.isExternal,
                isFireDoor: !!(d as any)?.isFireDoor,
                lastVerificationAt:
                  typeof (d as any)?.lastVerificationAt === 'string' ? String((d as any).lastVerificationAt).trim() || undefined : undefined,
                verifierCompany:
                  typeof (d as any)?.verifierCompany === 'string' ? String((d as any).verifierCompany).trim() || undefined : undefined,
                verificationHistory: normalizeDoorVerificationHistory((d as any)?.verificationHistory),
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
                y: Number.isFinite(Number((cp as any)?.y)) ? Number((cp as any).y) : undefined,
                transitionType: (cp as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs'
              }))
              .filter((cp) => Number.isFinite(cp.edgeIndex) && Number.isFinite(cp.t))
          : []
      };
    });
  }
  if (!Array.isArray(next.roomDoors)) next.roomDoors = [];
  if (Array.isArray(next.roomDoors)) {
    const validRoomIds = new Set(
      (Array.isArray(next.rooms) ? next.rooms : [])
        .map((room: any) => String(room?.id || '').trim())
        .filter(Boolean)
    );
    next.roomDoors = next.roomDoors
      .map((door: any) => normalizeRoomConnectionDoor(door))
      .filter((door: RoomConnectionDoor | null): door is RoomConnectionDoor => {
        if (!door) return false;
        return validRoomIds.has(door.roomAId) && validRoomIds.has(door.roomBId);
      });
  }
  next.revisionsLoaded = !!next.revisionsLoaded || (Array.isArray(next.revisions) && next.revisions.length > 0);
  if (!Array.isArray(next.revisions)) next.revisions = [];
  if (!Array.isArray(next.objects)) next.objects = [];
  if (Array.isArray(next.objects)) {
    next.objects = next.objects.map((obj: MapObject) => {
      const normalizedLayerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
      const withSecurityFields = {
        ...obj,
        notes: typeof (obj as any)?.notes === 'string' ? String((obj as any).notes).trim() || undefined : undefined,
        lastVerificationAt:
          typeof (obj as any)?.lastVerificationAt === 'string' ? String((obj as any).lastVerificationAt).trim() || undefined : undefined,
        verifierCompany:
          typeof (obj as any)?.verifierCompany === 'string' ? String((obj as any).verifierCompany).trim() || undefined : undefined,
        gpsCoords: typeof (obj as any)?.gpsCoords === 'string' ? String((obj as any).gpsCoords).trim() || undefined : undefined,
        securityDocuments: normalizeSecurityDocuments((obj as any)?.securityDocuments),
        securityCheckHistory: normalizeSecurityCheckHistory((obj as any)?.securityCheckHistory)
      } as MapObject;
      if (obj?.type === 'wifi') {
        const nextLayerIds = new Set(normalizedLayerIds);
        nextLayerIds.delete('devices');
        nextLayerIds.add('wifi');
        return { ...withSecurityFields, layerIds: Array.from(nextLayerIds) };
      }
      if (obj?.type === 'quote') {
        if (normalizedLayerIds.includes('quotes')) return withSecurityFields;
        return { ...withSecurityFields, layerIds: [...normalizedLayerIds, 'quotes'] };
      }
      if (obj?.type === 'text') {
        if (normalizedLayerIds.includes('text')) return withSecurityFields;
        return { ...withSecurityFields, layerIds: [...normalizedLayerIds, 'text'] };
      }
      if (obj?.type === 'postit') {
        if (normalizedLayerIds.includes('text')) return withSecurityFields;
        return { ...withSecurityFields, layerIds: [...normalizedLayerIds, 'text'] };
      }
      if (obj?.type === 'image') {
        if (normalizedLayerIds.includes('images')) return withSecurityFields;
        return { ...withSecurityFields, layerIds: [...normalizedLayerIds, 'images'] };
      }
      if (obj?.type === 'photo') {
        if (normalizedLayerIds.includes('photos')) return withSecurityFields;
        const nextLayerIds = new Set(normalizedLayerIds);
        nextLayerIds.delete('images');
        nextLayerIds.add('photos');
        return { ...withSecurityFields, layerIds: Array.from(nextLayerIds) };
      }
      if (isSecurityTypeId(obj?.type)) {
        const nextLayerIds = new Set(normalizedLayerIds);
        nextLayerIds.add(SECURITY_LAYER_ID);
        return { ...withSecurityFields, layerIds: Array.from(nextLayerIds) };
      }
      return withSecurityFields;
    });
  }
  if (!Array.isArray(next.racks)) next.racks = [];
  if (!Array.isArray(next.rackItems)) next.rackItems = [];
  if (!Array.isArray(next.rackLinks)) next.rackLinks = [];
  return next;
};

