import { nanoid } from 'nanoid';
import type {
  BusinessPartner,
  Client,
  DoorVerificationEntry,
  EmergencyContactEntry,
  FloorPlan,
  FloorPlanRevision,
  FloorPlanView,
  LayerDefinition,
  MapObject,
  Room,
  RoomConnectionDoor,
  SecurityCheckEntry,
  SecurityDocumentEntry,
  Site,
  WifiAntennaModel
} from './types';
import {
  ALL_ITEMS_LAYER_ID,
  DEFAULT_CCTV_TYPES,
  DEFAULT_DESK_TYPES,
  DEFAULT_DEVICE_TYPES,
  DEFAULT_IMAGE_TYPES,
  DEFAULT_PHOTO_TYPES,
  DEFAULT_RACK_TYPES,
  DEFAULT_SECURITY_TYPES,
  DEFAULT_TEXT_TYPES,
  DEFAULT_USER_TYPES,
  DEFAULT_WIFI_TYPES,
  DEFAULT_WALL_TYPES,
  WIFI_DEFAULT_STANDARD
} from './data';
import { isSecurityTypeId, SECURITY_LAYER_ID } from './security';

const SYSTEM_LAYER_IDS = new Set([ALL_ITEMS_LAYER_ID, 'rooms', 'corridors', 'cabling', 'quotes']);

export const normalizeViews = (views: FloorPlanView[] | undefined): FloorPlanView[] | undefined => {
  if (!Array.isArray(views)) return views;
  if (!views.length) return [];
  const withUniqueNames = (items: FloorPlanView[]) => {
    const used = new Set<string>();
    return items.map((view) => {
      const baseNameRaw = String(view?.name || '').trim();
      const baseName = baseNameRaw || 'View';
      let candidate = baseName;
      let suffix = 1;
      while (used.has(candidate.toLowerCase())) {
        candidate = `${baseName}_${suffix}`;
        suffix += 1;
      }
      used.add(candidate.toLowerCase());
      return candidate === view.name ? view : { ...view, name: candidate };
    });
  };
  const next = views.map((view) => ({ ...view, pan: { ...view.pan }, name: String(view?.name || '').trim() }));
  let defaultIndex = next.findIndex((view) => view.isDefault);
  if (defaultIndex === -1) {
    defaultIndex = next.findIndex((view) => String(view.name || '').trim().toLowerCase() === 'default');
  }
  if (defaultIndex !== -1) {
    const normalized = next.map((view, idx) => ({
      ...view,
      isDefault: idx === defaultIndex
    }));
    const [defaultView] = normalized.splice(defaultIndex, 1);
    return withUniqueNames([defaultView, ...normalized]);
  }
  return withUniqueNames(next.map((view) => (view.isDefault ? { ...view, isDefault: false } : view)));
};

export const normalizeDoorVerificationHistory = (history: any): DoorVerificationEntry[] => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const company = String(entry?.company || '').trim();
      const date = typeof entry?.date === 'string' ? String(entry.date).trim() : '';
      const notes = typeof entry?.notes === 'string' ? String(entry.notes).trim() : '';
      const createdAtRaw = Number(entry?.createdAt);
      return {
        id: String(entry?.id || nanoid()),
        company,
        date: date || undefined,
        notes: notes || undefined,
        createdAt: Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now()
      } as DoorVerificationEntry;
    })
    .filter((entry) => !!entry.company || !!entry.date)
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const normalizeRoomConnectionDoor = (door: any): RoomConnectionDoor | null => {
  const roomAId = String(door?.roomAId || '').trim();
  const roomBId = String(door?.roomBId || '').trim();
  if (!roomAId || !roomBId || roomAId === roomBId) return null;
  const anchorRoomIdRaw = String(door?.anchorRoomId || '').trim();
  const anchorRoomId = anchorRoomIdRaw === roomAId || anchorRoomIdRaw === roomBId ? anchorRoomIdRaw : roomAId;
  const edgeIndex = Number(door?.edgeIndex);
  const t = Number(door?.t);
  if (!Number.isFinite(edgeIndex) || !Number.isFinite(t)) return null;
  return {
    ...door,
    id: String(door?.id || nanoid()),
    roomAId,
    roomBId,
    anchorRoomId,
    edgeIndex,
    t: Math.max(0, Math.min(1, t)),
    mode:
      door?.mode === 'auto_sensor' || door?.mode === 'automated' || door?.mode === 'static'
        ? door.mode
        : 'static',
    automationUrl: typeof door?.automationUrl === 'string' ? String(door.automationUrl).trim() || undefined : undefined,
    catalogTypeId: typeof door?.catalogTypeId === 'string' ? String(door.catalogTypeId).trim() || undefined : undefined,
    description: typeof door?.description === 'string' ? String(door.description).trim() || undefined : undefined,
    isEmergency: !!door?.isEmergency,
    isMainEntrance: !!door?.isMainEntrance,
    isExternal: !!door?.isExternal,
    isFireDoor: !!door?.isFireDoor,
    lastVerificationAt: typeof door?.lastVerificationAt === 'string' ? String(door.lastVerificationAt).trim() || undefined : undefined,
    verifierCompany: typeof door?.verifierCompany === 'string' ? String(door.verifierCompany).trim() || undefined : undefined,
    verificationHistory: normalizeDoorVerificationHistory(door?.verificationHistory)
  };
};

export const normalizeSecurityDocuments = (docs: any): SecurityDocumentEntry[] => {
  if (!Array.isArray(docs)) return [];
  return docs
    .map((entry) => {
      const name = String(entry?.name || '').trim();
      const fileName = typeof entry?.fileName === 'string' ? String(entry.fileName).trim() : '';
      const dataUrl = typeof entry?.dataUrl === 'string' ? String(entry.dataUrl) : '';
      const uploadedAtRaw = typeof entry?.uploadedAt === 'string' ? String(entry.uploadedAt).trim() : '';
      const validUntilRaw = typeof entry?.validUntil === 'string' ? String(entry.validUntil).trim() : '';
      const notes = typeof entry?.notes === 'string' ? String(entry.notes).trim() : '';
      const archived = !!entry?.archived;
      return {
        id: String(entry?.id || nanoid()),
        name: name || 'Documento',
        fileName: fileName || undefined,
        dataUrl: dataUrl || undefined,
        uploadedAt: uploadedAtRaw || new Date().toISOString().slice(0, 10),
        validUntil: validUntilRaw || undefined,
        notes: notes || undefined,
        archived
      } as SecurityDocumentEntry;
    })
    .filter((entry) => !!entry.name);
};

export const normalizeSecurityCheckHistory = (history: any): SecurityCheckEntry[] => {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const date = typeof entry?.date === 'string' ? String(entry.date).trim() : '';
      const company = typeof entry?.company === 'string' ? String(entry.company).trim() : '';
      const notes = typeof entry?.notes === 'string' ? String(entry.notes).trim() : '';
      const createdAtRaw = Number(entry?.createdAt);
      const archived = !!entry?.archived;
      return {
        id: String(entry?.id || nanoid()),
        date: date || undefined,
        company: company || undefined,
        notes: notes || undefined,
        createdAt: Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now(),
        archived
      } as SecurityCheckEntry;
    })
    .filter((entry) => !!entry.date || !!entry.company || !!entry.notes)
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const normalizeEmergencyContacts = (contacts: any): EmergencyContactEntry[] => {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .map((entry) => {
      const scopeRaw = String(entry?.scope || '').trim();
      const scope: EmergencyContactEntry['scope'] =
        scopeRaw === 'global' || scopeRaw === 'client' || scopeRaw === 'site' || scopeRaw === 'plan' ? scopeRaw : 'client';
      const name = String(entry?.name || '').trim();
      const phone = String(entry?.phone || '').trim();
      const notes = typeof entry?.notes === 'string' ? String(entry.notes).trim() : '';
      const showOnPlanCard = entry?.showOnPlanCard !== false;
      const siteId = typeof entry?.siteId === 'string' ? String(entry.siteId).trim() : '';
      const floorPlanId = typeof entry?.floorPlanId === 'string' ? String(entry.floorPlanId).trim() : '';
      return {
        id: String(entry?.id || nanoid()),
        scope,
        name,
        phone,
        notes: notes || undefined,
        showOnPlanCard,
        siteId: siteId || undefined,
        floorPlanId: floorPlanId || undefined
      } as EmergencyContactEntry;
    })
    .filter((entry) => !!entry.name && !!entry.phone);
};

export const normalizeBusinessPartners = (items: any): BusinessPartner[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((entry) => {
      const name = String(entry?.name || '').trim();
      const logoUrl = String(entry?.logoUrl || '').trim();
      const email = String(entry?.email || '').trim();
      const phone = String(entry?.phone || '').trim();
      const notes = String(entry?.notes || '').trim();
      return {
        id: String(entry?.id || nanoid()),
        name,
        logoUrl: logoUrl || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined
      } as BusinessPartner;
    })
    .filter((row) => !!row.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
};

const normalizeSupportContactValue = (value: any) => {
  if (!value || typeof value !== 'object') return undefined;
  const email = typeof value.email === 'string' ? String(value.email).trim().toLowerCase() : '';
  const phone = typeof value.phone === 'string' ? String(value.phone).trim() : '';
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
  const holidayCalendar =
    typeof value.holidayCalendar === 'string'
      ? (String(value.holidayCalendar || '').trim() as NonNullable<Site['siteSchedule']>['holidayCalendar'])
      : undefined;
  const weeklySource = value.weekly && typeof value.weekly === 'object' ? value.weekly : {};
  const weekly: NonNullable<Site['siteSchedule']>['weekly'] = {};
  let hasWeekly = false;
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
    const row = weeklySource[day];
    if (!row || typeof row !== 'object') continue;
    const start = typeof row.start === 'string' ? String(row.start).trim() : '';
    const end = typeof row.end === 'string' ? String(row.end).trim() : '';
    const closed = !!row.closed;
    if (!start && !end && !closed) continue;
    weekly[day] = {
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(closed ? { closed: true } : {})
    };
    hasWeekly = true;
  }
  if (!holidayCalendar && !hasWeekly) return undefined;
  return {
    ...(holidayCalendar ? { holidayCalendar } : {}),
    ...(hasWeekly ? { weekly } : {})
  };
};

export const normalizeOpenAiDailyTokensPerUser = (value: any): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : undefined;
};

export const normalizeWifiAntennaModels = (models?: WifiAntennaModel[]): WifiAntennaModel[] => {
  const list = Array.isArray(models) ? models : [];
  const normalized = list
    .map((entry) => ({
      id: String(entry?.id || nanoid()),
      brand: String(entry?.brand || '').trim(),
      model: String(entry?.model || '').trim(),
      modelCode: String((entry as any)?.modelCode || '').trim(),
      standard: String(entry?.standard || '').trim() || WIFI_DEFAULT_STANDARD,
      band24: !!entry?.band24,
      band5: !!entry?.band5,
      band6: !!entry?.band6,
      coverageSqm: Number.isFinite(Number(entry?.coverageSqm)) ? Math.max(1, Math.floor(Number(entry.coverageSqm))) : 0
    }))
    .filter((entry) => !!entry.brand || !!entry.model || !!entry.modelCode);
  if (!normalized.length) return [];
  const unique = new Map<string, WifiAntennaModel>();
  for (const entry of normalized) {
    unique.set(entry.id, entry);
  }
  return Array.from(unique.values());
};

export const normalizeClientLayers = (client: Client): LayerDefinition[] => {
  const usedTypeIds = new Set<string>();
  for (const site of client.sites || []) {
    for (const plan of site.floorPlans || []) {
      for (const obj of plan.objects || []) {
        if (obj?.type) usedTypeIds.add(String(obj.type));
      }
    }
  }
  const legacyLayers = Array.isArray((client as any).layers) ? (client as any).layers : [];
  const baseLayers = Array.isArray(client.layers) && client.layers.length ? client.layers : legacyLayers;
  const defaultsById = new Map(defaultLayersForClient().map((layer) => [layer.id, layer]));
  const byId = new Map<string, LayerDefinition>();

  for (const entry of baseLayers) {
    const id = String(entry?.id || '').trim();
    if (!id) continue;
    const base = defaultsById.get(id);
    const next: LayerDefinition = {
      ...(base || {}),
      ...(entry as LayerDefinition),
      id,
      name: {
        it: String(entry?.name?.it || base?.name?.it || id).trim() || id,
        en: String(entry?.name?.en || base?.name?.en || id).trim() || id
      },
      color: String(entry?.color || base?.color || '#64748b').trim() || '#64748b',
      order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : Number(base?.order || 0)
    };
    if (id === ALL_ITEMS_LAYER_ID || SYSTEM_LAYER_IDS.has(id)) {
      delete (next as any).typeIds;
    } else if (Array.isArray(entry?.typeIds)) {
      next.typeIds = Array.from(new Set(entry.typeIds.map((typeId: string) => String(typeId || '').trim()).filter(Boolean)));
    } else if (Array.isArray(base?.typeIds)) {
      next.typeIds = [...base.typeIds];
    }
    byId.set(id, next);
  }

  for (const base of defaultsById.values()) {
    if (!byId.has(base.id)) {
      byId.set(base.id, { ...base, ...(base.typeIds ? { typeIds: [...base.typeIds] } : {}) });
    }
  }

  const securityBuiltinIconById = new Map<string, string>([
    ['camera', 'cctv'],
    ['fire_extinguisher', 'flame'],
    ['alarm', 'bell'],
    ['first_aid', 'heart'],
    ['evacuation_chair', 'armchair'],
    ['aed', 'heartPulse']
  ]);

  for (const id of usedTypeIds) {
    if (defaultsById.has(id) || byId.has(id)) continue;
    if (isSecurityTypeId(id)) {
      byId.set(id, {
        id,
        name: { it: id, en: id },
        color: '#ef4444',
        order: 999,
        typeIds: [id]
      });
    }
  }

  for (const [id, def] of byId) {
    if (!isSecurityTypeId(id)) continue;
    const expectedIcon = securityBuiltinIconById.get(id);
    if (expectedIcon && (def as any).icon !== expectedIcon) {
      byId.set(id, { ...(def as any), icon: expectedIcon } as any);
    }
  }

  return Array.from(byId.values()).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
};

const defaultLayersForClient = (): LayerDefinition[] => [
  { id: ALL_ITEMS_LAYER_ID, name: { it: 'Tutti gli elementi', en: 'All Items' }, color: '#64748b', order: 1 },
  { id: 'users', name: { it: 'Utenti', en: 'Users' }, color: '#2563eb', order: 2, typeIds: DEFAULT_USER_TYPES },
  { id: 'devices', name: { it: 'Dispositivi', en: 'Devices' }, color: '#0ea5e9', order: 3, typeIds: DEFAULT_DEVICE_TYPES },
  { id: 'wifi', name: { it: 'WiFi', en: 'WiFi' }, color: '#0ea5e9', order: 4, typeIds: DEFAULT_WIFI_TYPES },
  { id: 'cctv', name: { it: 'CCTV', en: 'CCTV' }, color: '#22c55e', order: 5, typeIds: DEFAULT_CCTV_TYPES },
  { id: 'desks', name: { it: 'Scrivanie', en: 'Desks' }, color: '#8b5cf6', order: 6, typeIds: DEFAULT_DESK_TYPES },
  { id: SECURITY_LAYER_ID, name: { it: 'Sicurezza', en: 'Safety' }, color: '#ef4444', order: 7, typeIds: DEFAULT_SECURITY_TYPES },
  { id: 'cabling', name: { it: 'Cablaggi', en: 'Cabling' }, color: '#10b981', order: 8 },
  { id: 'walls', name: { it: 'Mura', en: 'Walls' }, color: '#64748b', order: 9, typeIds: DEFAULT_WALL_TYPES },
  { id: 'quotes', name: { it: 'Quote', en: 'Quotes' }, color: '#64748b', order: 10 },
  { id: 'rooms', name: { it: 'Stanze', en: 'Rooms' }, color: '#64748b', order: 11 },
  { id: 'text', name: { it: 'Testo', en: 'Text' }, color: '#475569', order: 12, typeIds: DEFAULT_TEXT_TYPES },
  { id: 'images', name: { it: 'Immagini', en: 'Images' }, color: '#f59e0b', order: 13, typeIds: DEFAULT_IMAGE_TYPES },
  { id: 'photos', name: { it: 'Foto', en: 'Photos' }, color: '#ec4899', order: 14, typeIds: DEFAULT_PHOTO_TYPES },
  { id: 'racks', name: { it: 'Rack', en: 'Racks' }, color: '#6366f1', order: 15, typeIds: DEFAULT_RACK_TYPES }
];

export const normalizePlan = (plan: FloorPlan): FloorPlan => {
  const next = { ...plan } as FloorPlan;
  next.views = normalizeViews(next.views) || [];
  if (!Array.isArray(next.rooms)) next.rooms = [];
  if (Array.isArray(next.rooms)) {
    next.rooms = next.rooms.map((room: Room) => ({
      ...room,
      capacity: Number.isFinite(Number((room as any)?.capacity)) ? Math.max(0, Math.floor(Number((room as any).capacity))) : 0,
      departmentTags: Array.isArray((room as any)?.departmentTags)
        ? Array.from(
            new Set(
              ((room as any).departmentTags || [])
                .map((value: any) => String(value || '').trim())
                .filter(Boolean)
            )
          )
        : [],
      labelScale: Number.isFinite(Number((room as any)?.labelScale)) ? Math.max(0.3, Math.min(3, Number((room as any).labelScale))) : 1,
      fillOpacity: Number.isFinite(Number((room as any)?.fillOpacity)) ? Math.max(0.05, Math.min(1, Number((room as any).fillOpacity))) : 0.08,
      labelPosition:
        (room as any)?.labelPosition === 'bottom' || (room as any)?.labelPosition === 'left' || (room as any)?.labelPosition === 'right'
          ? (room as any).labelPosition
          : 'center',
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
  if (!Array.isArray((next as any).corridors)) (next as any).corridors = [];
  if (Array.isArray((next as any).corridors)) {
    (next as any).corridors = (next as any).corridors.map((corridor: any) => ({
      ...corridor,
      doors: Array.isArray(corridor?.doors)
        ? corridor.doors.map((door: any) => ({
            ...door,
            verificationHistory: normalizeDoorVerificationHistory((door as any)?.verificationHistory),
            linkedRoomIds: Array.isArray((door as any)?.linkedRoomIds)
              ? (door as any).linkedRoomIds.map((id: any) => String(id))
              : undefined
          }))
        : []
    }));
  }
  if (!Array.isArray(next.roomDoors)) next.roomDoors = [];
  if (Array.isArray(next.roomDoors)) {
    const validRoomIds = new Set((Array.isArray(next.rooms) ? next.rooms : []).map((room: any) => String(room?.id || '').trim()).filter(Boolean));
    next.roomDoors = next.roomDoors
      .map((door: any) => normalizeRoomConnectionDoor(door))
      .filter((door): door is RoomConnectionDoor => !!door)
      .filter((door) => validRoomIds.has(door.roomAId) && validRoomIds.has(door.roomBId));
  }
  if (!Array.isArray(next.objects)) next.objects = [];
  if (Array.isArray(next.objects)) {
    next.objects = next.objects.map((obj: MapObject) => {
      const normalizedLayerIds = Array.isArray(obj.layerIds) ? obj.layerIds.map((id) => String(id)) : [];
      const withSecurityFields = {
        ...obj,
        securityDocuments: normalizeSecurityDocuments((obj as any)?.securityDocuments),
        securityCheckHistory: normalizeSecurityCheckHistory((obj as any)?.securityCheckHistory)
      };
      if (obj.type === 'rack') {
        const nextLayerIds = new Set(normalizedLayerIds);
        nextLayerIds.delete('devices');
        nextLayerIds.add('racks');
        return { ...withSecurityFields, layerIds: [...nextLayerIds] };
      }
      if (obj.type === 'quote') {
        if (normalizedLayerIds.includes('quotes')) return withSecurityFields;
        return { ...withSecurityFields, layerIds: [...normalizedLayerIds, 'quotes'] };
      }
      if (obj.type === 'text') {
        if (normalizedLayerIds.includes('text')) return withSecurityFields;
        return { ...withSecurityFields, layerIds: [...normalizedLayerIds, 'text'] };
      }
      if (obj.type === 'image') {
        if (normalizedLayerIds.includes('images')) return withSecurityFields;
        return { ...withSecurityFields, layerIds: [...normalizedLayerIds, 'images'] };
      }
      if (obj.type === 'photo') {
        if (normalizedLayerIds.includes('photos')) return withSecurityFields;
        const nextLayerIds = new Set(normalizedLayerIds);
        nextLayerIds.delete('images');
        nextLayerIds.add('photos');
        return { ...withSecurityFields, layerIds: [...nextLayerIds] };
      }
      if (isSecurityTypeId(obj.type)) {
        const nextLayerIds = new Set(normalizedLayerIds);
        nextLayerIds.delete('users');
        nextLayerIds.delete('devices');
        nextLayerIds.add(SECURITY_LAYER_ID);
        return { ...withSecurityFields, layerIds: [...nextLayerIds] };
      }
      return { ...withSecurityFields, layerIds: normalizedLayerIds };
    });
  }
  return next;
};

export const snapshotRevision = (
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
    rooms: plan.rooms ? plan.rooms.map((room) => ({ ...room })) : undefined,
    corridors: plan.corridors
      ? plan.corridors.map((corridor) => ({
          ...corridor,
          points: Array.isArray(corridor.points) ? corridor.points.map((point) => ({ ...point })) : undefined,
          doors: Array.isArray(corridor.doors)
            ? corridor.doors.map((door) => ({
                ...door,
                catalogTypeId: typeof (door as any)?.catalogTypeId === 'string' ? String((door as any).catalogTypeId) : undefined,
                description: typeof (door as any)?.description === 'string' ? String((door as any).description) : undefined,
                isEmergency: !!(door as any)?.isEmergency,
                isMainEntrance: !!(door as any)?.isMainEntrance,
                isExternal: !!(door as any)?.isExternal,
                isFireDoor: !!(door as any)?.isFireDoor,
                lastVerificationAt: typeof (door as any)?.lastVerificationAt === 'string' ? String((door as any).lastVerificationAt) : undefined,
                verifierCompany: typeof (door as any)?.verifierCompany === 'string' ? String((door as any).verifierCompany) : undefined,
                verificationHistory: normalizeDoorVerificationHistory((door as any)?.verificationHistory),
                linkedRoomIds: Array.isArray((door as any)?.linkedRoomIds)
                  ? (door as any).linkedRoomIds.map((id: any) => String(id))
                  : undefined
              }))
            : undefined,
          connections: Array.isArray(corridor.connections)
            ? corridor.connections.map((point) => ({
                ...point,
                planIds: [...(point.planIds || [])],
                transitionType: (point as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs'
              }))
            : undefined
        }))
      : undefined,
    roomDoors: Array.isArray((plan as any).roomDoors)
      ? (plan as any).roomDoors
          .map((door: any) => {
            const normalized = normalizeRoomConnectionDoor(door);
            if (!normalized) return null;
            return {
              ...normalized,
              verificationHistory: normalizeDoorVerificationHistory((normalized as any).verificationHistory)
            };
          })
          .filter(Boolean) as RoomConnectionDoor[]
      : undefined,
    links: plan.links ? plan.links.map((link) => ({ ...link })) : undefined,
    racks: plan.racks ? plan.racks.map((rack) => ({ ...rack })) : undefined,
    rackItems: plan.rackItems ? plan.rackItems.map((item) => ({ ...item })) : undefined,
    rackLinks: plan.rackLinks ? plan.rackLinks.map((link) => ({ ...link })) : undefined,
    safetyCardLayout: (plan as any).safetyCardLayout
      ? {
          x: Number((plan as any).safetyCardLayout.x || 0),
          y: Number((plan as any).safetyCardLayout.y || 0),
          w: Number((plan as any).safetyCardLayout.w || 420),
          h: Number((plan as any).safetyCardLayout.h || 84),
          fontSize: Number.isFinite(Number((plan as any).safetyCardLayout.fontSize))
            ? Number((plan as any).safetyCardLayout.fontSize)
            : undefined,
          fontIndex: Number.isFinite(Number((plan as any).safetyCardLayout.fontIndex))
            ? Number((plan as any).safetyCardLayout.fontIndex)
            : undefined,
          colorIndex: Number.isFinite(Number((plan as any).safetyCardLayout.colorIndex))
            ? Number((plan as any).safetyCardLayout.colorIndex)
            : undefined,
          textBgIndex: Number.isFinite(Number((plan as any).safetyCardLayout.textBgIndex))
            ? Number((plan as any).safetyCardLayout.textBgIndex)
            : undefined
        }
      : undefined,
    objects: plan.objects.map((obj) => ({
      ...obj,
      securityDocuments: normalizeSecurityDocuments((obj as any)?.securityDocuments),
      securityCheckHistory: normalizeSecurityCheckHistory((obj as any)?.securityCheckHistory)
    }))
  };
};
