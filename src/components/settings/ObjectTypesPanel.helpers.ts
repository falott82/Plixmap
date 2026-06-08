// Pure types + geometry helpers extracted verbatim from ObjectTypesPanel.tsx (<2k).
import { nanoid } from 'nanoid';
import { isDeskType } from '../plan/deskTypes';
import { isSecurityTypeId } from '../../store/security';
import type { Corridor, DoorVerificationEntry, FloorPlan, IconName, Room } from '../../store/types';

export type Point = { x: number; y: number };
export type DoorRegistrySortKey =
  | 'clientName'
  | 'siteName'
  | 'planName'
  | 'doorId'
  | 'description'
  | 'doorType'
  | 'isEmergency'
  | 'lastVerificationAt'
  | 'verifierCompany'
  | 'corridorName'
  | 'nearestRoomName';

export type DoorRegistryRow = {
  rowId: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  corridorId: string;
  corridorName: string;
  doorId: string;
  description: string;
  doorType: string;
  isEmergency: boolean;
  lastVerificationAt: string;
  verifierCompany: string;
  nearestRoomName: string;
  openUrl: string;
  mode: string;
  verificationHistory: DoorVerificationEntry[];
  plan: FloorPlan;
};

export const toRectPolygon = (x: number, y: number, width: number, height: number): Point[] => {
  if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

export const roomPolygon = (room: Room): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly' && Array.isArray(room?.points) && room.points.length >= 3) {
    return room.points
      .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
  }
  return toRectPolygon(Number(room?.x || 0), Number(room?.y || 0), Number(room?.width || 0), Number(room?.height || 0));
};

export const corridorPolygon = (corridor: Corridor): Point[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly' && Array.isArray(corridor?.points) && corridor.points.length >= 3) {
    return corridor.points
      .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
  }
  return toRectPolygon(
    Number(corridor?.x || 0),
    Number(corridor?.y || 0),
    Number(corridor?.width || 0),
    Number(corridor?.height || 0)
  );
};

export const polygonCentroid = (polygon: Point[]): Point | null => {
  if (!polygon.length) return null;
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) < 1e-6) {
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
};

export const getDoorAnchor = (corridor: Corridor, door: any): Point | null => {
  const points = corridorPolygon(corridor);
  if (points.length < 2) return null;
  const edgeIndex = Number(door?.edgeIndex);
  const t = Number(door?.t);
  if (!Number.isFinite(edgeIndex) || !Number.isFinite(t)) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  const clampedT = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * clampedT, y: a.y + (b.y - a.y) * clampedT };
};

export const polygonPath = (points: Point[]) => {
  if (!points.length) return '';
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;
};


// Build the door-registry map preview geometry (corridor/room shapes + door
// anchors + viewBox) for a single plan. Pure given the preview row. Extracted
// from ObjectTypesPanel.
export const computeDoorMapPreviewData = (doorMapPreviewRow: any) => {
  if (!doorMapPreviewRow) return null;
  const plan = doorMapPreviewRow.plan;
  const corridors = ((plan?.corridors || []) as Corridor[]).filter(Boolean);
  const rooms = (plan?.rooms || []).filter(Boolean);
  const corridorShapes = corridors.map((corridor) => ({ corridor, points: corridorPolygon(corridor) })).filter((entry) => entry.points.length >= 3);
  const roomShapes = rooms.map((room: any) => ({ room, points: roomPolygon(room), center: polygonCentroid(roomPolygon(room)) })).filter((entry: any) => entry.points.length >= 3);
  const doorAnchors = corridorShapes.flatMap((entry) =>
    (entry.corridor.doors || [])
      .map((door) => ({ door, point: getDoorAnchor(entry.corridor, door), corridorId: entry.corridor.id }))
      .filter((item): item is { door: any; point: Point; corridorId: string } => !!item.point)
  );
  const allPoints: Point[] = [
    ...corridorShapes.flatMap((entry) => entry.points),
    ...roomShapes.flatMap((entry: any) => entry.points),
    ...doorAnchors.map((entry) => entry.point)
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = Number(plan?.width || 1200) || 1200;
    maxY = Number(plan?.height || 800) || 800;
  }
  if (Number.isFinite(Number(plan?.width)) && Number.isFinite(Number(plan?.height)) && Number(plan?.width) > 0 && Number(plan?.height) > 0) {
    minX = Math.min(minX, 0);
    minY = Math.min(minY, 0);
    maxX = Math.max(maxX, Number(plan?.width));
    maxY = Math.max(maxY, Number(plan?.height));
  }
  const pad = 24;
  return {
    corridorShapes,
    roomShapes,
    doorAnchors,
    viewBox: `${minX - pad} ${minY - pad} ${Math.max(100, maxX - minX + pad * 2)} ${Math.max(100, maxY - minY + pad * 2)}`
  };
};

// Full icon option list for object types (static). Extracted from ObjectTypesPanel.
export const OBJECT_TYPE_ICON_OPTIONS: IconName[] = [
    'user',
    'userCheck',
    'printer',
    'server',
    'wifi',
    'radio',
    'tv',
    'desktop',
    'laptop',
    'camera',
    'intercom',
    'videoIntercom',
    'scanner',
    'mic',
    'router',
    'switch',
    'phone',
    'tablet',
    'shield',
    'key',
    'database',
    'cctv',
    'lightbulb',
    'plug',
    'plugZap',
    'wrench',
    'cpu',
    'hardDrive',
    'bell',
    'lock',
    'unlock',
    'thermometer',
    'fan',
    'airVent',
    'wind',
    'snowflake',
    'thermometerSnowflake',
    'thermometerSun',
    'droplets',
    'flame',
    'gauge',
    'power',
    'zap',
    'battery',
    'batteryCharging',
    'batteryFull',
    'batteryLow',
    'network',
    'wifiOff',
    'cable',
    'lockKeyhole',
    'badgeCheck',
    'shieldCheck',
    'shieldAlert',
    'bellRing',
    'videoOff',
    'micOff',
    'volume2',
    'headphones',
    'users',
    'usersRound',
    'assemblyPoint',
    'userSearch',
    'car',
    'truck',
    'bike',
    'bus',
    'train',
    'deskRound',
    'deskSquare',
    'deskRect',
    'deskDouble',
    'deskLong',
    'deskTrapezoid',
    'deskL',
    'deskLReverse'
];

// Build the door-registry rows across all clients/sites/plans (type label,
// emergency flag, nearest room, normalized verification history). Pure given the
// client list, door-type index, language and translate fn. Extracted from ObjectTypesPanel.
export const buildDoorRegistryRowsRaw = (
  allClients: any[],
  doorTypeById: Map<string, any>,
  lang: string,
  t: (msg: { it: string; en: string }) => string
): DoorRegistryRow[] => {
  const rows: DoorRegistryRow[] = [];
  for (const currentClient of allClients || []) {
    for (const site of currentClient?.sites || []) {
      for (const plan of site?.floorPlans || []) {
        const roomCenters = (plan.rooms || [])
          .map((room: any) => ({ room, center: polygonCentroid(roomPolygon(room)) }))
          .filter((entry: any): entry is { room: Room; center: Point } => !!entry.center);
        for (const corridor of (plan.corridors || []) as Corridor[]) {
          for (const door of corridor?.doors || []) {
            const typeDef = door?.catalogTypeId ? doorTypeById.get(door.catalogTypeId) : null;
            const typeLabel = typeDef
              ? ((typeDef?.name?.[lang] as string) || (typeDef?.name?.it as string) || typeDef.id)
              : door?.catalogTypeId || t({ it: 'Non definito', en: 'Undefined' });
            const isEmergency =
              typeof (door as any)?.isEmergency === 'boolean' ? !!(door as any).isEmergency : !!typeDef?.doorConfig?.isEmergency;
            const anchor = getDoorAnchor(corridor, door);
            const nearestRoomName = anchor
              ? roomCenters
                  .map((entry: any) => ({
                    name: String(entry.room?.name || ''),
                    dist: Math.hypot(anchor.x - entry.center.x, anchor.y - entry.center.y)
                  }))
                  .sort((a: any, b: any) => a.dist - b.dist)[0]?.name || ''
              : '';
            const verificationHistory = (Array.isArray((door as any)?.verificationHistory) ? (door as any).verificationHistory : [])
              .map((entry: any) => ({
                id: String(entry?.id || nanoid()),
                date: typeof entry?.date === 'string' ? String(entry.date).trim() || undefined : undefined,
                company: String(entry?.company || '').trim(),
                notes: typeof entry?.notes === 'string' ? String(entry.notes).trim() || undefined : undefined,
                createdAt: Number.isFinite(Number(entry?.createdAt)) ? Number(entry.createdAt) : Date.now()
              }))
              .filter((entry: DoorVerificationEntry) => !!entry.company || !!entry.date)
              .sort((a: DoorVerificationEntry, b: DoorVerificationEntry) => b.createdAt - a.createdAt);
            rows.push({
              rowId: `${currentClient.id}:${site.id}:${plan.id}:${corridor.id}:${door.id}`,
              clientId: currentClient.id,
              clientName: String(currentClient.name || ''),
              siteId: site.id,
              siteName: String(site.name || ''),
              planId: plan.id,
              planName: String(plan.name || ''),
              corridorId: corridor.id,
              corridorName: String(corridor.name || ''),
              doorId: String(door?.id || ''),
              description: String((door as any)?.description || '').trim(),
              doorType: typeLabel,
              isEmergency,
              lastVerificationAt: String((door as any)?.lastVerificationAt || ''),
              verifierCompany: String((door as any)?.verifierCompany || ''),
              nearestRoomName,
              openUrl: String((door as any)?.automationUrl || '').trim(),
              mode: String((door as any)?.mode || 'static'),
              verificationHistory,
              plan
            });
          }
        }
      }
    }
  }
  return rows;
};

// Serialize the door-registry rows to a `;`-separated CSV string (with header
// row, CSV-escaping). Pure. Extracted from ObjectTypesPanel.
export const buildDoorRowsCsv = (rows: DoorRegistryRow[]): string => {
  const headers = [
    'Cliente',
    'Sede',
    'Planimetria',
    'ID porta',
    'Descrizione porta',
    'Tipo porta',
    'Porta emergenza',
    'Ultima revisione (emergenza)',
    'Ultima azienda revisionatrice',
    'Nome corridoio',
    'Ufficio piu vicino'
  ];
  const escapeCsv = (value: string) => {
    const text = String(value ?? '');
    if (!/[;"\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [
    headers.join(';'),
    ...rows.map((row) =>
      [
        row.clientName,
        row.siteName,
        row.planName,
        row.doorId,
        row.description,
        row.doorType,
        row.isEmergency ? 'SI' : 'NO',
        row.isEmergency ? row.lastVerificationAt || '' : '',
        row.isEmergency ? row.verifierCompany || '' : '',
        row.corridorName,
        row.nearestRoomName
      ]
        .map((item) => escapeCsv(String(item)))
        .join(';')
    )
  ];
  return lines.join('\n');
};

// Sort wifi antenna models by the chosen column/direction, with stable
// brand/model/code tiebreakers. Pure. Extracted from ObjectTypesPanel.
export const sortWifiModels = (
  models: any[],
  sortKey: string,
  sortDir: 'asc' | 'desc',
  wifiStandardLabels: Map<string, string>
): any[] => {
  const list = models.slice();
  const getValue = (model: any): string | number => {
    switch (sortKey) {
      case 'brand':
        return model.brand || '';
      case 'model':
        return model.model || '';
      case 'modelCode':
        return model.modelCode || '';
      case 'standard':
        return wifiStandardLabels.get(model.standard) || model.standard || '';
      case 'band24':
        return model.band24 ? 1 : 0;
      case 'band5':
        return model.band5 ? 1 : 0;
      case 'band6':
        return model.band6 ? 1 : 0;
      case 'coverageSqm':
        return Number(model.coverageSqm) || 0;
      default:
        return '';
    }
  };
  const compareValues = (a: string | number, b: string | number) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return `${a}`.localeCompare(`${b}`);
  };
  list.sort((a, b) => {
    const base = compareValues(getValue(a), getValue(b));
    if (base !== 0) return sortDir === 'asc' ? base : -base;
    const brand = (a.brand || '').localeCompare(b.brand || '');
    if (brand !== 0) return brand;
    const model = (a.model || '').localeCompare(b.model || '');
    if (model !== 0) return model;
    return (a.modelCode || '').localeCompare(b.modelCode || '');
  });
  return list;
};

// Compute the enabled / available / merged palette object-type defs for the
// current section + search term. Pure; isWallType is passed in (it closes over
// the wall-type id set). Extracted from ObjectTypesPanel.
export const computeObjectTypePaletteDefs = (params: {
  defById: Map<string, any>;
  enabled: string[];
  objectTypes: any[];
  isWallsSection: boolean;
  isDoorsSection: boolean;
  isSecuritySection: boolean;
  isDesksSection: boolean;
  isWallType: (id: string) => boolean;
  lang: string;
  q: string;
}): { enabledDefs: any[]; availableDefs: any[]; paletteDefs: any[] } => {
  const { defById, enabled, objectTypes, isWallsSection, isDoorsSection, isSecuritySection, isDesksSection, isWallType, lang, q } = params;
  const term = q.trim().toLowerCase();
  const enabledDefs: any[] = [];
  if (!(isWallsSection || isDoorsSection)) {
    for (const id of enabled) {
      const d = defById.get(id);
      if (!d) continue;
      if (isWallType(d.id)) continue;
      if ((d as any)?.category === 'door') continue;
      if (isSecuritySection ? !isSecurityTypeId(d.id) : isSecurityTypeId(d.id)) continue;
      if (isDesksSection ? !isDeskType(d.id) : isDeskType(d.id)) continue;
      if (term && !`${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term)) continue;
      enabledDefs.push(d);
    }
  }
  let availableDefs: any[] = [];
  if (!(isWallsSection || isDoorsSection)) {
    const used = new Set(enabled);
    const list = (objectTypes || []).filter((d) => {
      if (used.has(d.id)) return false;
      if (isWallType(d.id)) return false;
      if ((d as any)?.category === 'door') return false;
      if (isSecuritySection ? !isSecurityTypeId(d.id) : isSecurityTypeId(d.id)) return false;
      return isDesksSection ? isDeskType(d.id) : !isDeskType(d.id);
    });
    const sorted = list.slice().sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
    availableDefs = term
      ? sorted.filter((d) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term))
      : sorted;
  }
  const enabledIds = new Set(enabled);
  const paletteDefs = [...enabledDefs, ...availableDefs.filter((d) => !enabledIds.has(d.id))];
  return { enabledDefs, availableDefs, paletteDefs };
};

// Sorted + search-filtered wifi antenna model lists for the client. Pure.
export const computeWifiModelLists = (client: any, q: string): { wifiModels: any[]; filteredWifiModels: any[] } => {
  const wifiModels = (client?.wifiAntennaModels || []).slice().sort((a: any, b: any) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  const term = q.trim().toLowerCase();
  const filteredWifiModels = !term
    ? wifiModels
    : wifiModels.filter((m: any) => `${m.brand} ${m.model} ${m.modelCode} ${m.standard}`.toLowerCase().includes(term));
  return { wifiModels, filteredWifiModels };
};

// Sorted + search-filtered wall object-type def lists. Pure; isWallType passed in.
export const computeWallDefLists = (
  objectTypes: any[],
  isWallType: (id: string) => boolean,
  lang: string,
  q: string
): { wallDefs: any[]; filteredWallDefs: any[] } => {
  const wallDefs = (objectTypes || [])
    .filter((d) => isWallType(d.id))
    .sort((a: any, b: any) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
  const term = q.trim().toLowerCase();
  const filteredWallDefs = !term
    ? wallDefs
    : wallDefs.filter((d: any) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term));
  return { wallDefs, filteredWallDefs };
};

// Search-filter + column-sort the door-registry rows (stable rowId tiebreaker).
// Pure. Extracted from ObjectTypesPanel.
export const filterSortDoorRegistryRows = (
  doorRowsRaw: DoorRegistryRow[],
  sortKey: DoorRegistrySortKey,
  sortDir: 'asc' | 'desc',
  lang: string,
  q: string
): DoorRegistryRow[] => {
  const term = q.trim().toLowerCase();
  const list = term
    ? doorRowsRaw.filter((row) =>
        `${row.clientName} ${row.siteName} ${row.planName} ${row.doorId} ${row.description} ${row.doorType} ${row.isEmergency ? 'emergency emergenza yes si' : 'no'} ${row.lastVerificationAt} ${row.verifierCompany} ${row.corridorName} ${row.nearestRoomName}`
          .toLowerCase()
          .includes(term)
      )
    : doorRowsRaw.slice();
  const compareText = (a: string, b: string) => a.localeCompare(b, lang, { sensitivity: 'base' });
  list.sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    let base = 0;
    switch (sortKey) {
      case 'isEmergency':
        base = Number(a.isEmergency) - Number(b.isEmergency);
        break;
      case 'clientName':
        base = compareText(a.clientName, b.clientName);
        break;
      case 'siteName':
        base = compareText(a.siteName, b.siteName);
        break;
      case 'planName':
        base = compareText(a.planName, b.planName);
        break;
      case 'doorId':
        base = compareText(a.doorId, b.doorId);
        break;
      case 'description':
        base = compareText(a.description, b.description);
        break;
      case 'doorType':
        base = compareText(a.doorType, b.doorType);
        break;
      case 'lastVerificationAt':
        base = compareText(a.lastVerificationAt, b.lastVerificationAt);
        break;
      case 'verifierCompany':
        base = compareText(a.verifierCompany, b.verifierCompany);
        break;
      case 'corridorName':
        base = compareText(a.corridorName, b.corridorName);
        break;
      case 'nearestRoomName':
        base = compareText(a.nearestRoomName, b.nearestRoomName);
        break;
    }
    if (base !== 0) return base * dir;
    return compareText(a.rowId, b.rowId) * dir;
  });
  return list;
};
