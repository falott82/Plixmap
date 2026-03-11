export type PlanSnapshotComparable = {
  imageUrl: string;
  width?: number;
  height?: number;
  scale?: any;
  safetyCardLayout?: {
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize?: number;
    fontIndex?: number;
    colorIndex?: number;
    textBgIndex?: number;
  };
  objects: any[];
  views?: any[];
  rooms?: any[];
  corridors?: any[];
  roomDoors?: any[];
  racks?: any[];
  rackItems?: any[];
  rackLinks?: any[];
};

const ROOM_FALSE_IF_MISSING_COMPARE_KEYS = new Set([
  'logical',
  'meetingRoom',
  'meetingProjector',
  'meetingTv',
  'meetingVideoConf',
  'meetingCoffeeService',
  'meetingWhiteboard',
  'meetingKioskEnabled',
  'wifiAvailable',
  'fridgeAvailable',
  'noWindows',
  'storageRoom',
  'bathroom',
  'technicalRoom'
]);

const SORT_ASC = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const sameList = (a?: string[], b?: string[]) => {
  const aList = a || [];
  const bList = b || [];
  if (aList.length !== bList.length) return false;
  for (let i = 0; i < aList.length; i += 1) {
    if ((aList[i] || '') !== (bList[i] || '')) return false;
  }
  return true;
};

const normalizeForCompare = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((entry) => normalizeForCompare(entry));
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (typeof value !== 'object') return value;
  const out: Record<string, any> = {};
  const keys = Object.keys(value).sort(SORT_ASC);
  for (const key of keys) {
    const next = normalizeForCompare(value[key]);
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
};

const normalizeRoomForCompare = (room: any) => {
  const base = room || {};
  const normalized: Record<string, any> = {};
  const keys = Object.keys(base).sort(SORT_ASC);
  for (const key of keys) {
    const value = base[key];
    if (value === undefined) continue;
    if (key === 'showName' && value === true) continue;
    if (ROOM_FALSE_IF_MISSING_COMPARE_KEYS.has(key) && value === false) continue;
    if (key === 'capacity' && Number(value) === 0) continue;
    if (typeof value === 'string' && String(value) === '') continue;
    if (key === 'labelPosition' && (value === 'top' || value === '' || value == null)) continue;
    if (key === 'labelScale' && (value === null || value === undefined || Number(value) === 1)) continue;
    if (key === 'fillOpacity' && (value === null || value === undefined || Math.abs(Number(value) - 0.08) < 0.0001)) continue;
    if ((key === 'color' || key === 'fillColor' || key === 'strokeColor') && String(value || '').trim() === '') continue;
    if (key === 'departmentTags') {
      normalized[key] = Array.isArray(value)
        ? value
            .map((entry: any) => String(entry || '').trim())
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        : [];
      continue;
    }
    if (key === 'points') {
      normalized[key] = Array.isArray(value)
        ? value.map((point: any) => ({
            x: Number(point?.x ?? 0),
            y: Number(point?.y ?? 0)
          }))
        : [];
      continue;
    }
    normalized[key] = normalizeForCompare(value);
  }
  return normalized;
};

const rawJsonEqual = (a: any, b: any) => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export const samePlanSnapshot = (
  current: PlanSnapshotComparable,
  latest: PlanSnapshotComparable,
  options?: { ignoreDims?: boolean }
) => {
  if (current === latest) return true;
  const ignoreDims = !!options?.ignoreDims;
  if (current.imageUrl !== latest.imageUrl) return false;
  if (!ignoreDims) {
    if ((current.width ?? null) !== (latest.width ?? null)) return false;
    if ((current.height ?? null) !== (latest.height ?? null)) return false;
  }

  const aScale = current.scale;
  const bScale = latest.scale;
  if (!!aScale || !!bScale) {
    if (!aScale || !bScale) return false;
    if (Number(aScale.meters || 0) !== Number(bScale.meters || 0)) return false;
    if (Number(aScale.metersPerPixel || 0) !== Number(bScale.metersPerPixel || 0)) return false;
    if ((aScale.start?.x ?? 0) !== (bScale.start?.x ?? 0)) return false;
    if ((aScale.start?.y ?? 0) !== (bScale.start?.y ?? 0)) return false;
    if ((aScale.end?.x ?? 0) !== (bScale.end?.x ?? 0)) return false;
    if ((aScale.end?.y ?? 0) !== (bScale.end?.y ?? 0)) return false;
  }

  const aSafetyCard = current.safetyCardLayout;
  const bSafetyCard = latest.safetyCardLayout;
  if (!!aSafetyCard || !!bSafetyCard) {
    if (!aSafetyCard || !bSafetyCard) return false;
    if (Number(aSafetyCard.x || 0) !== Number(bSafetyCard.x || 0)) return false;
    if (Number(aSafetyCard.y || 0) !== Number(bSafetyCard.y || 0)) return false;
    if (Number(aSafetyCard.w || 0) !== Number(bSafetyCard.w || 0)) return false;
    if (Number(aSafetyCard.h || 0) !== Number(bSafetyCard.h || 0)) return false;
    if (Number(aSafetyCard.fontSize || 10) !== Number(bSafetyCard.fontSize || 10)) return false;
    if (Number(aSafetyCard.fontIndex || 0) !== Number(bSafetyCard.fontIndex || 0)) return false;
    if (Number(aSafetyCard.colorIndex || 0) !== Number(bSafetyCard.colorIndex || 0)) return false;
    if (Number(aSafetyCard.textBgIndex || 0) !== Number(bSafetyCard.textBgIndex || 0)) return false;
  }

  const aObjs = current.objects || [];
  const bObjs = latest.objects || [];
  if (aObjs !== bObjs) {
    if (aObjs.length !== bObjs.length) return false;
    const bById = new Map<string, any>();
    for (const o of bObjs) bById.set(o.id, o);
    for (const o of aObjs) {
      const other = bById.get(o.id);
      if (!other) return false;
      if (rawJsonEqual(o, other)) continue;
      if (JSON.stringify(normalizeForCompare(o)) !== JSON.stringify(normalizeForCompare(other))) return false;
    }
  }

  const aViews = current.views || [];
  const bViews = latest.views || [];
  if (aViews !== bViews) {
    if (aViews.length !== bViews.length) return false;
    const bViewsById = new Map<string, any>();
    for (const v of bViews) bViewsById.set(v.id, v);
    for (const v of aViews) {
      const other = bViewsById.get(v.id);
      if (!other) return false;
      if (v.name !== other.name) return false;
      if ((v.description || '') !== (other.description || '')) return false;
      if (v.zoom !== other.zoom) return false;
      if ((v.pan?.x ?? 0) !== (other.pan?.x ?? 0)) return false;
      if ((v.pan?.y ?? 0) !== (other.pan?.y ?? 0)) return false;
      if (!!v.isDefault !== !!other.isDefault) return false;
    }
  }

  const aRooms = current.rooms || [];
  const bRooms = latest.rooms || [];
  if (aRooms !== bRooms) {
    if (aRooms.length !== bRooms.length) return false;
    const bRoomsById = new Map<string, any>();
    for (const r of bRooms) bRoomsById.set(r.id, r);
    for (const r of aRooms) {
      const other = bRoomsById.get(r.id);
      if (!other) return false;
      if (rawJsonEqual(r, other)) continue;
      if (JSON.stringify(normalizeRoomForCompare(r)) !== JSON.stringify(normalizeRoomForCompare(other))) return false;
    }
  }

  const aCorridors = current.corridors || [];
  const bCorridors = latest.corridors || [];
  if (aCorridors !== bCorridors) {
    if (aCorridors.length !== bCorridors.length) return false;
    const bCorridorsById = new Map<string, any>();
    for (const c of bCorridors) bCorridorsById.set(c.id, c);
    for (const c of aCorridors) {
      const other = bCorridorsById.get(c.id);
      if (!other) return false;
      if (c.name !== other.name) return false;
      if ((c.showName !== false) !== (other.showName !== false)) return false;
      if (Number(c?.labelX ?? -1) !== Number(other?.labelX ?? -1)) return false;
      if (Number(c?.labelY ?? -1) !== Number(other?.labelY ?? -1)) return false;
      if (Number(c?.labelScale ?? 1) !== Number(other?.labelScale ?? 1)) return false;
      if ((c.kind || 'poly') !== (other.kind || 'poly')) return false;
      if ((c.color || '') !== (other.color || '')) return false;
      if ((c.x ?? null) !== (other.x ?? null)) return false;
      if ((c.y ?? null) !== (other.y ?? null)) return false;
      if ((c.width ?? null) !== (other.width ?? null)) return false;
      if ((c.height ?? null) !== (other.height ?? null)) return false;

      const cPts = Array.isArray(c.points) ? c.points : [];
      const oPts = Array.isArray(other.points) ? other.points : [];
      if (cPts.length !== oPts.length) return false;
      for (let i = 0; i < cPts.length; i += 1) {
        if ((cPts[i]?.x ?? 0) !== (oPts[i]?.x ?? 0)) return false;
        if ((cPts[i]?.y ?? 0) !== (oPts[i]?.y ?? 0)) return false;
      }

      const cDoors = Array.isArray(c.doors) ? c.doors : [];
      const oDoors = Array.isArray(other.doors) ? other.doors : [];
      if (cDoors.length !== oDoors.length) return false;
      const oDoorsById = new Map<string, any>();
      for (const d of oDoors) oDoorsById.set(d.id, d);
      for (const d of cDoors) {
        const od = oDoorsById.get(d.id);
        if (!od) return false;
        if (Number(d.edgeIndex) !== Number(od.edgeIndex)) return false;
        if (Number(d.t) !== Number(od.t)) return false;
        if (Number(d?.edgeIndexTo ?? -1) !== Number(od?.edgeIndexTo ?? -1)) return false;
        if (Number(d?.tTo ?? -1) !== Number(od?.tTo ?? -1)) return false;
        if (String(d?.mode || 'static') !== String(od?.mode || 'static')) return false;
        if (String(d?.automationUrl || '') !== String(od?.automationUrl || '')) return false;
        const aLinked = Array.isArray(d?.linkedRoomIds) ? d.linkedRoomIds.map((id: any) => String(id)).sort() : [];
        const bLinked = Array.isArray(od?.linkedRoomIds) ? od.linkedRoomIds.map((id: any) => String(id)).sort() : [];
        if (aLinked.length !== bLinked.length) return false;
        for (let i = 0; i < aLinked.length; i += 1) {
          if (aLinked[i] !== bLinked[i]) return false;
        }
      }

      const cConn = Array.isArray(c.connections) ? c.connections : [];
      const oConn = Array.isArray(other.connections) ? other.connections : [];
      if (cConn.length !== oConn.length) return false;
      const oConnById = new Map<string, any>();
      for (const cp of oConn) oConnById.set(cp.id, cp);
      for (const cp of cConn) {
        const ocp = oConnById.get(cp.id);
        if (!ocp) return false;
        if (Number(cp.edgeIndex) !== Number(ocp.edgeIndex)) return false;
        if (Number(cp.t) !== Number(ocp.t)) return false;
        if (Number(cp?.x ?? -1) !== Number(ocp?.x ?? -1)) return false;
        if (Number(cp?.y ?? -1) !== Number(ocp?.y ?? -1)) return false;
        if (String(cp?.transitionType || 'stairs') !== String(ocp?.transitionType || 'stairs')) return false;
        const aPlanIds = Array.isArray(cp.planIds) ? cp.planIds.map((id: any) => String(id)).sort() : [];
        const bPlanIds = Array.isArray(ocp.planIds) ? ocp.planIds.map((id: any) => String(id)).sort() : [];
        if (aPlanIds.length !== bPlanIds.length) return false;
        for (let i = 0; i < aPlanIds.length; i += 1) {
          if (aPlanIds[i] !== bPlanIds[i]) return false;
        }
      }
    }
  }

  const aRoomDoors = Array.isArray(current.roomDoors) ? current.roomDoors : [];
  const bRoomDoors = Array.isArray(latest.roomDoors) ? latest.roomDoors : [];
  if (aRoomDoors !== bRoomDoors) {
    if (aRoomDoors.length !== bRoomDoors.length) return false;
    const bRoomDoorsById = new Map<string, any>();
    for (const door of bRoomDoors) bRoomDoorsById.set(String(door?.id || ''), door);
    for (const door of aRoomDoors) {
      const id = String(door?.id || '');
      const other = bRoomDoorsById.get(id);
      if (!other) return false;
      if (String(door?.roomAId || '') !== String(other?.roomAId || '')) return false;
      if (String(door?.roomBId || '') !== String(other?.roomBId || '')) return false;
      if (String(door?.anchorRoomId || '') !== String(other?.anchorRoomId || '')) return false;
      if (Number(door?.edgeIndex) !== Number(other?.edgeIndex)) return false;
      if (Number(door?.t) !== Number(other?.t)) return false;
      if (String(door?.mode || 'static') !== String(other?.mode || 'static')) return false;
      if (String(door?.automationUrl || '') !== String(other?.automationUrl || '')) return false;
    }
  }

  const aRacks = current.racks || [];
  const bRacks = latest.racks || [];
  if (aRacks !== bRacks) {
    if (aRacks.length !== bRacks.length) return false;
    const bRacksById = new Map<string, any>();
    for (const r of bRacks) bRacksById.set(r.id, r);
    for (const r of aRacks) {
      const other = bRacksById.get(r.id);
      if (!other) return false;
      if (r.name !== other.name) return false;
      if (Number(r.totalUnits || 0) !== Number(other.totalUnits || 0)) return false;
    }
  }

  const aItems = current.rackItems || [];
  const bItems = latest.rackItems || [];
  if (aItems !== bItems) {
    if (aItems.length !== bItems.length) return false;
    const bItemsById = new Map<string, any>();
    for (const i of bItems) bItemsById.set(i.id, i);
    for (const i of aItems) {
      const other = bItemsById.get(i.id);
      if (!other) return false;
      if (i.rackId !== other.rackId) return false;
      if (i.type !== other.type) return false;
      if (i.name !== other.name) return false;
      if ((i.brand || '') !== (other.brand || '')) return false;
      if ((i.model || '') !== (other.model || '')) return false;
      if ((i.ip || '') !== (other.ip || '')) return false;
      if (Number(i.unitStart) !== Number(other.unitStart)) return false;
      if (Number(i.unitSize) !== Number(other.unitSize)) return false;
      if (Number(i.ethPorts || 0) !== Number(other.ethPorts || 0)) return false;
      if (Number(i.fiberPorts || 0) !== Number(other.fiberPorts || 0)) return false;
      if (Number(i.ethRangeStart || 0) !== Number(other.ethRangeStart || 0)) return false;
      if (Number(i.fiberRangeStart || 0) !== Number(other.fiberRangeStart || 0)) return false;
      if (!sameList(i.ethPortNames, other.ethPortNames)) return false;
      if (!sameList(i.fiberPortNames, other.fiberPortNames)) return false;
      if (!sameList(i.ethPortNotes, other.ethPortNotes)) return false;
      if (!sameList(i.fiberPortNotes, other.fiberPortNotes)) return false;
    }
  }

  const aLinks = current.rackLinks || [];
  const bLinks = latest.rackLinks || [];
  if (aLinks !== bLinks) {
    if (aLinks.length !== bLinks.length) return false;
    const bLinksById = new Map<string, any>();
    for (const l of bLinks) bLinksById.set(l.id, l);
    for (const l of aLinks) {
      const other = bLinksById.get(l.id);
      if (!other) return false;
      if (l.fromItemId !== other.fromItemId) return false;
      if (l.toItemId !== other.toItemId) return false;
      if (l.fromPortKind !== other.fromPortKind) return false;
      if (l.toPortKind !== other.toPortKind) return false;
      if (Number(l.fromPortIndex) !== Number(other.fromPortIndex)) return false;
      if (Number(l.toPortIndex) !== Number(other.toPortIndex)) return false;
      if (l.kind !== other.kind) return false;
      if (l.color !== other.color) return false;
      if ((l.name || '') !== (other.name || '')) return false;
    }
  }

  return true;
};
