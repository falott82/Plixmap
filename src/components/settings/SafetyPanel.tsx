import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Menu, Transition } from '@headlessui/react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  ExternalLink,
  History,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  X
} from 'lucide-react';
import { nanoid } from 'nanoid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useDataStore } from '../../store/useDataStore';
import { useLang, useT } from '../../i18n/useT';
import { Corridor, FloorPlan, Room, SecurityCheckEntry, SecurityDocumentEntry } from '../../store/types';
import Icon from '../ui/Icon';
import { isSecurityTypeId } from '../../store/security';
import { TEXT_FONT_OPTIONS } from '../../store/data';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';
import { useAuthStore } from '../../store/useAuthStore';

type Point = { x: number; y: number };

type SafetySortKey =
  | 'clientName'
  | 'siteName'
  | 'planName'
  | 'typeLabel'
  | 'name'
  | 'description'
  | 'notes'
  | 'lastVerificationAt'
  | 'locationName';

type DoorSortKey =
  | 'clientName'
  | 'siteName'
  | 'planName'
  | 'doorId'
  | 'description'
  | 'doorType'
  | 'lastVerificationAt'
  | 'verifierCompany'
  | 'corridorName'
  | 'nearestRoomName';

type SafetyRow = {
  rowId: string;
  objectId: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  icon: string;
  typeLabel: string;
  name: string;
  description: string;
  notes: string;
  lastVerificationAt: string;
  verifierCompany: string;
  gpsCoords: string;
  locationName: string;
  point: Point;
  plan: FloorPlan;
  securityCheckHistory: SecurityCheckEntry[];
  securityDocuments: SecurityDocumentEntry[];
};

type EmergencyDoorRow = {
  rowId: string;
  clientId: string;
  siteId: string;
  planId: string;
  clientName: string;
  siteName: string;
  planName: string;
  doorId: string;
  description: string;
  doorType: string;
  corridorName: string;
  nearestRoomName: string;
  lastVerificationAt: string;
  verifierCompany: string;
  openUrl: string;
  mode: string;
  isFireDoor: boolean;
  corridorId: string;
  plan: FloorPlan;
  verificationHistory: Array<{ id: string; date?: string; company: string; notes?: string; createdAt: number }>;
};

const toRectPolygon = (x: number, y: number, width: number, height: number): Point[] => {
  if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

const roomPolygon = (room: Room): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly' && Array.isArray(room?.points) && room.points.length >= 3) {
    return room.points.map((p) => ({ x: Number(p?.x || 0), y: Number(p?.y || 0) }));
  }
  return toRectPolygon(Number(room?.x || 0), Number(room?.y || 0), Number(room?.width || 0), Number(room?.height || 0));
};

const corridorPolygon = (corridor: Corridor): Point[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly' && Array.isArray(corridor?.points) && corridor.points.length >= 3) {
    return corridor.points.map((p) => ({ x: Number(p?.x || 0), y: Number(p?.y || 0) }));
  }
  return toRectPolygon(
    Number(corridor?.x || 0),
    Number(corridor?.y || 0),
    Number(corridor?.width || 0),
    Number(corridor?.height || 0)
  );
};

const polygonCentroid = (polygon: Point[]): Point | null => {
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

const pointInPolygon = (point: Point, polygon: Point[]) => {
  if (!polygon.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

const getDoorAnchor = (corridor: Corridor, door: any): Point | null => {
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

const polygonPath = (points: Point[]) => {
  if (!points.length) return '';
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;
};

const compareText = (a: string, b: string, lang: string) => a.localeCompare(b, lang, { sensitivity: 'base' });
const DEFAULT_SAFETY_CARD_LAYOUT = { x: 24, y: 24, w: 420, h: 84, fontSize: 10, fontIndex: 0, colorIndex: 0, textBgIndex: 0 } as const;
const SAFETY_CARD_COLOR_VARIANTS = [
  { body: '#e0f2fe', header: '#bae6fd', border: '#0ea5e9', title: '#075985', text: '#0f172a' },
  { body: '#ecfeff', header: '#cffafe', border: '#06b6d4', title: '#0e7490', text: '#0f172a' },
  { body: '#dbeafe', header: '#bfdbfe', border: '#3b82f6', title: '#1d4ed8', text: '#0f172a' },
  { body: '#f0f9ff', header: '#e0f2fe', border: '#0284c7', title: '#0c4a6e', text: '#111827' }
] as const;
const SAFETY_CARD_TEXT_BG_VARIANTS = ['transparent', '#ecfeff', '#dbeafe', '#e0f2fe'] as const;
const SAFETY_CARD_FONT_VALUES = (TEXT_FONT_OPTIONS || []).map((entry) => String(entry.value || '').trim()).filter(Boolean);

const parseDateForSort = (value: string) => {
  const ts = value ? Date.parse(value) : NaN;
  return Number.isFinite(ts) ? ts : 0;
};

const SafetyPanel = () => {
  const t = useT();
  const lang = useLang();
  const { clients, objectTypes, updateObject } = useDataStore();
  const updateFloorPlan = useDataStore((s) => s.updateFloorPlan);
  const { user, permissions } = useAuthStore();
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const [q, setQ] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [safetySort, setSafetySort] = useState<{ key: SafetySortKey; dir: 'asc' | 'desc' }>({ key: 'clientName', dir: 'asc' });
  const [doorSort, setDoorSort] = useState<{ key: DoorSortKey; dir: 'asc' | 'desc' }>({ key: 'clientName', dir: 'asc' });
  const [mapPreview, setMapPreview] = useState<{ kind: 'device'; row: SafetyRow } | { kind: 'door'; row: EmergencyDoorRow } | null>(null);
  const [selectedMapItems, setSelectedMapItems] = useState<string[]>([]);
  const [multiMapPreview, setMultiMapPreview] = useState<{ keys: string[]; planId: string } | null>(null);
  const [multiMapFullscreen, setMultiMapFullscreen] = useState(false);
  const [multiMapExporting, setMultiMapExporting] = useState(false);
  const [selectedExportPlanIds, setSelectedExportPlanIds] = useState<string[]>([]);
  const [multiMapOptions, setMultiMapOptions] = useState({
    showRoomNames: true,
    showCorridorNames: true,
    showSafetyCard: true
  });
  const [deviceHistory, setDeviceHistory] = useState<SafetyRow | null>(null);
  const [doorHistory, setDoorHistory] = useState<EmergencyDoorRow | null>(null);
  const [docDraft, setDocDraft] = useState<{ name: string; validUntil: string; notes: string; fileName?: string; dataUrl?: string }>({
    name: '',
    validUntil: '',
    notes: ''
  });
  const [checkDraft, setCheckDraft] = useState<{ date: string; company: string; notes: string }>({ date: '', company: '', notes: '' });
  const [editorError, setEditorError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const singleMapRef = useRef<HTMLDivElement | null>(null);
  const multiMapRef = useRef<HTMLDivElement | null>(null);
  const singleMapExportRef = useRef<HTMLDivElement | null>(null);
  const multiMapExportRef = useRef<HTMLDivElement | null>(null);
  const multiMapViewportRef = useRef<HTMLDivElement | null>(null);
  const typeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const def of objectTypes || []) map.set(def.id, def);
    return map;
  }, [objectTypes]);
  const canManageScope = (clientId?: string, siteId?: string, planId?: string) => {
    if (isSuperAdmin) return true;
    if (!user?.isAdmin) return false;
    const perms = permissions || [];
    if (clientId && perms.some((entry) => entry.scopeType === 'client' && entry.scopeId === clientId && entry.access === 'rw')) return true;
    if (siteId && perms.some((entry) => entry.scopeType === 'site' && entry.scopeId === siteId && entry.access === 'rw')) return true;
    if (planId && perms.some((entry) => entry.scopeType === 'plan' && entry.scopeId === planId && entry.access === 'rw')) return true;
    return false;
  };

  const safetyRowsRaw = useMemo<SafetyRow[]>(() => {
    const rows: SafetyRow[] = [];
    for (const client of clients || []) {
      for (const site of client.sites || []) {
        for (const plan of site.floorPlans || []) {
          const roomShapes = (plan.rooms || []).map((room) => ({ room, points: roomPolygon(room), center: polygonCentroid(roomPolygon(room)) }));
          const corridorShapes = ((plan.corridors || []) as Corridor[]).map((corridor) => ({
            corridor,
            points: corridorPolygon(corridor),
            center: polygonCentroid(corridorPolygon(corridor))
          }));
          for (const obj of plan.objects || []) {
            if (!isSecurityTypeId(obj.type)) continue;
            const typeDef = typeById.get(obj.type);
            const locationPoint = { x: Number(obj.x || 0), y: Number(obj.y || 0) };
            const containingRoom = roomShapes.find((entry) => pointInPolygon(locationPoint, entry.points));
            const containingCorridor = corridorShapes.find((entry) => pointInPolygon(locationPoint, entry.points));
            let nearestLabel = '';
            if (containingRoom?.room?.name) nearestLabel = containingRoom.room.name;
            else if (containingCorridor?.corridor?.name) nearestLabel = containingCorridor.corridor.name;
            if (!nearestLabel) {
              const candidates = [
                ...roomShapes
                  .filter((entry) => entry.center)
                  .map((entry) => ({
                    label: entry.room.name,
                    dist: Math.hypot(locationPoint.x - (entry.center as Point).x, locationPoint.y - (entry.center as Point).y)
                  })),
                ...corridorShapes
                  .filter((entry) => entry.center)
                  .map((entry) => ({
                    label: entry.corridor.name,
                    dist: Math.hypot(locationPoint.x - (entry.center as Point).x, locationPoint.y - (entry.center as Point).y)
                  }))
              ].sort((a, b) => a.dist - b.dist);
              nearestLabel = candidates[0]?.label || '';
            }
            rows.push({
              rowId: `${client.id}:${site.id}:${plan.id}:${obj.id}`,
              objectId: obj.id,
              clientId: client.id,
              clientName: client.shortName || client.name,
              siteId: site.id,
              siteName: site.name,
              planId: plan.id,
              planName: plan.name,
              icon: String(typeDef?.icon || obj.type || 'shield'),
              typeLabel: String(typeDef?.name?.[lang] || typeDef?.name?.it || typeDef?.name?.en || obj.type),
              name: String(obj.name || ''),
              description: String(obj.description || ''),
              notes: String(obj.notes || ''),
              lastVerificationAt: String(obj.lastVerificationAt || ''),
              verifierCompany: String(obj.verifierCompany || ''),
              gpsCoords: String(obj.gpsCoords || ''),
              locationName: String(nearestLabel || ''),
              point: locationPoint,
              plan,
              securityCheckHistory: Array.isArray(obj.securityCheckHistory) ? obj.securityCheckHistory : [],
              securityDocuments: Array.isArray(obj.securityDocuments) ? obj.securityDocuments : []
            });
          }
        }
      }
    }
    return rows;
  }, [clients, lang, typeById]);

  const emergencyDoorRowsRaw = useMemo<EmergencyDoorRow[]>(() => {
    const rows: EmergencyDoorRow[] = [];
    for (const client of clients || []) {
      for (const site of client.sites || []) {
        for (const plan of site.floorPlans || []) {
          const roomCenters = (plan.rooms || [])
            .map((room) => ({ room, center: polygonCentroid(roomPolygon(room)) }))
            .filter((entry): entry is { room: Room; center: Point } => !!entry.center);
          for (const corridor of (plan.corridors || []) as Corridor[]) {
            for (const door of corridor?.doors || []) {
              if (!door?.isEmergency) continue;
              const typeDef = door?.catalogTypeId ? typeById.get(door.catalogTypeId) : null;
              const typeLabel = typeDef
                ? String(typeDef?.name?.[lang] || typeDef?.name?.it || typeDef?.name?.en || typeDef.id)
                : String(door?.catalogTypeId || '');
              const anchor = getDoorAnchor(corridor, door);
              const nearestRoomName = anchor
                ? roomCenters
                    .map((entry) => ({
                      name: String(entry.room?.name || ''),
                      dist: Math.hypot(anchor.x - entry.center.x, anchor.y - entry.center.y)
                    }))
                    .sort((a, b) => a.dist - b.dist)[0]?.name || ''
                : '';
              const verificationHistory = (Array.isArray((door as any)?.verificationHistory) ? (door as any).verificationHistory : [])
                .map((entry: any) => ({
                  id: String(entry?.id || nanoid()),
                  date: typeof entry?.date === 'string' ? String(entry.date).trim() || undefined : undefined,
                  company: String(entry?.company || '').trim(),
                  notes: typeof entry?.notes === 'string' ? String(entry.notes).trim() || undefined : undefined,
                  createdAt: Number.isFinite(Number(entry?.createdAt)) ? Number(entry.createdAt) : Date.now()
                }))
                .filter((entry: any) => !!entry.company || !!entry.date)
                .sort((a: any, b: any) => b.createdAt - a.createdAt);
              rows.push({
                rowId: `${client.id}:${site.id}:${plan.id}:${corridor.id}:${door.id}`,
                clientId: client.id,
                siteId: site.id,
                planId: plan.id,
                clientName: client.shortName || client.name,
                siteName: site.name,
                planName: plan.name,
                doorId: String(door?.id || ''),
                description: String((door as any)?.description || ''),
                doorType: typeLabel || '—',
                corridorName: String(corridor.name || ''),
                nearestRoomName,
                lastVerificationAt: String((door as any)?.lastVerificationAt || ''),
                verifierCompany: String((door as any)?.verifierCompany || ''),
                openUrl: String((door as any)?.automationUrl || ''),
                mode: String((door as any)?.mode || 'static'),
                isFireDoor: !!(door as any)?.isFireDoor,
                corridorId: corridor.id,
                plan,
                verificationHistory
              });
            }
          }
        }
      }
    }
    return rows;
  }, [clients, lang, typeById]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of safetyRowsRaw) map.set(row.clientId, row.clientName);
    for (const row of emergencyDoorRowsRaw) map.set(row.clientId, row.clientName);
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => compareText(a.label, b.label, lang));
  }, [emergencyDoorRowsRaw, lang, safetyRowsRaw]);
  const siteOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; clientId: string }>();
    for (const row of safetyRowsRaw) {
      if (clientFilter !== 'all' && row.clientId !== clientFilter) continue;
      map.set(row.siteId, { id: row.siteId, label: row.siteName, clientId: row.clientId });
    }
    for (const row of emergencyDoorRowsRaw) {
      if (clientFilter !== 'all' && row.clientId !== clientFilter) continue;
      map.set(row.siteId, { id: row.siteId, label: row.siteName, clientId: row.clientId });
    }
    return Array.from(map.values()).sort((a, b) => compareText(a.label, b.label, lang));
  }, [clientFilter, emergencyDoorRowsRaw, lang, safetyRowsRaw]);
  const planOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; clientId: string; siteId: string }>();
    for (const row of safetyRowsRaw) {
      if (clientFilter !== 'all' && row.clientId !== clientFilter) continue;
      if (siteFilter !== 'all' && row.siteId !== siteFilter) continue;
      map.set(row.planId, { id: row.planId, label: row.planName, clientId: row.clientId, siteId: row.siteId });
    }
    for (const row of emergencyDoorRowsRaw) {
      if (clientFilter !== 'all' && row.clientId !== clientFilter) continue;
      if (siteFilter !== 'all' && row.siteId !== siteFilter) continue;
      map.set(row.planId, { id: row.planId, label: row.planName, clientId: row.clientId, siteId: row.siteId });
    }
    return Array.from(map.values()).sort((a, b) => compareText(a.label, b.label, lang));
  }, [clientFilter, emergencyDoorRowsRaw, lang, safetyRowsRaw, siteFilter]);
  const typeOptions = useMemo(() => {
    const values = Array.from(
      new Set([...safetyRowsRaw.map((row) => row.typeLabel), ...emergencyDoorRowsRaw.map((row) => row.doorType)].filter(Boolean))
    );
    return values.sort((a, b) => compareText(a, b, lang));
  }, [emergencyDoorRowsRaw, lang, safetyRowsRaw]);
  useEffect(() => {
    if (siteFilter !== 'all' && !siteOptions.some((entry) => entry.id === siteFilter)) {
      setSiteFilter('all');
    }
  }, [siteFilter, siteOptions]);
  useEffect(() => {
    if (planFilter !== 'all' && !planOptions.some((entry) => entry.id === planFilter)) {
      setPlanFilter('all');
    }
  }, [planFilter, planOptions]);

  const filteredSafetyRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = term
      ? safetyRowsRaw.filter((row) =>
          `${row.clientName} ${row.siteName} ${row.planName} ${row.typeLabel} ${row.name} ${row.description} ${row.notes} ${row.lastVerificationAt} ${row.locationName}`
            .toLowerCase()
            .includes(term)
        )
      : safetyRowsRaw.slice();
    const scoped = rows.filter((row) => {
      if (clientFilter !== 'all' && row.clientId !== clientFilter) return false;
      if (siteFilter !== 'all' && row.siteId !== siteFilter) return false;
      if (planFilter !== 'all' && row.planId !== planFilter) return false;
      if (typeFilter !== 'all' && row.typeLabel !== typeFilter) return false;
      return true;
    });
    scoped.sort((a, b) => {
      const dir = safetySort.dir === 'asc' ? 1 : -1;
      let base = 0;
      switch (safetySort.key) {
        case 'lastVerificationAt':
          base = parseDateForSort(a.lastVerificationAt) - parseDateForSort(b.lastVerificationAt);
          break;
        default:
          base = compareText(String(a[safetySort.key] || ''), String(b[safetySort.key] || ''), lang);
      }
      if (base !== 0) return base * dir;
      return compareText(a.rowId, b.rowId, lang) * dir;
    });
    return scoped;
  }, [clientFilter, lang, planFilter, q, safetyRowsRaw, safetySort.dir, safetySort.key, siteFilter, typeFilter]);

  const filteredDoorRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = term
      ? emergencyDoorRowsRaw.filter((row) =>
          `${row.clientName} ${row.siteName} ${row.planName} ${row.doorId} ${row.description} ${row.doorType} ${row.corridorName} ${row.nearestRoomName} ${row.lastVerificationAt} ${row.verifierCompany}`
            .toLowerCase()
            .includes(term)
        )
      : emergencyDoorRowsRaw.slice();
    const scoped = rows.filter((row) => {
      if (clientFilter !== 'all' && row.clientId !== clientFilter) return false;
      if (siteFilter !== 'all' && row.siteId !== siteFilter) return false;
      if (planFilter !== 'all' && row.planId !== planFilter) return false;
      if (typeFilter !== 'all' && row.doorType !== typeFilter) return false;
      return true;
    });
    scoped.sort((a, b) => {
      const dir = doorSort.dir === 'asc' ? 1 : -1;
      let base = 0;
      switch (doorSort.key) {
        case 'lastVerificationAt':
          base = parseDateForSort(a.lastVerificationAt) - parseDateForSort(b.lastVerificationAt);
          break;
        default:
          base = compareText(String(a[doorSort.key] || ''), String(b[doorSort.key] || ''), lang);
      }
      if (base !== 0) return base * dir;
      return compareText(a.rowId, b.rowId, lang) * dir;
    });
    return scoped;
  }, [clientFilter, doorSort.dir, doorSort.key, emergencyDoorRowsRaw, lang, planFilter, q, siteFilter, typeFilter]);

  const mapRowsByKey = useMemo(() => {
    const map = new Map<string, { kind: 'device'; row: SafetyRow } | { kind: 'door'; row: EmergencyDoorRow }>();
    for (const row of safetyRowsRaw) map.set(`device:${row.rowId}`, { kind: 'device', row });
    for (const row of emergencyDoorRowsRaw) map.set(`door:${row.rowId}`, { kind: 'door', row });
    return map;
  }, [emergencyDoorRowsRaw, safetyRowsRaw]);
  useEffect(() => {
    setSelectedMapItems((prev) => prev.filter((key) => mapRowsByKey.has(key)));
  }, [mapRowsByKey]);
  const selectedRows = useMemo(
    () => selectedMapItems.map((key) => mapRowsByKey.get(key)).filter(Boolean) as Array<{ kind: 'device'; row: SafetyRow } | { kind: 'door'; row: EmergencyDoorRow }>,
    [mapRowsByKey, selectedMapItems]
  );
  const planOrderById = useMemo(() => {
    const order = new Map<string, number>();
    let cursor = 0;
    for (const client of clients || []) {
      for (const site of client?.sites || []) {
        for (const plan of site?.floorPlans || []) {
          const id = String(plan?.id || '').trim();
          if (!id || order.has(id)) continue;
          order.set(id, cursor);
          cursor += 1;
        }
      }
    }
    return order;
  }, [clients]);
  const selectedPlanOptions = useMemo(() => {
    const seen = new Map<string, { planId: string; clientId: string; siteId: string; label: string; clientName: string; siteName: string; planName: string }>();
    for (const entry of selectedRows) {
      const row = entry.row as any;
      if (seen.has(row.planId)) continue;
      seen.set(row.planId, {
        planId: row.planId,
        clientId: row.clientId,
        siteId: row.siteId,
        label: `${row.clientName} / ${row.siteName} / ${row.planName}`,
        clientName: row.clientName,
        siteName: row.siteName,
        planName: row.planName
      });
    }
    return Array.from(seen.values()).sort((a, b) => {
      const aOrder = planOrderById.get(a.planId);
      const bOrder = planOrderById.get(b.planId);
      if (Number.isFinite(aOrder) && Number.isFinite(bOrder) && aOrder !== bOrder) return Number(aOrder) - Number(bOrder);
      if (Number.isFinite(aOrder) && !Number.isFinite(bOrder)) return -1;
      if (!Number.isFinite(aOrder) && Number.isFinite(bOrder)) return 1;
      return compareText(a.label, b.label, lang);
    });
  }, [lang, planOrderById, selectedRows]);
  const toggleSelection = useCallback((key: string, checked: boolean) => {
    setSelectedMapItems((prev) => {
      if (checked) return prev.includes(key) ? prev : [...prev, key];
      return prev.filter((entry) => entry !== key);
    });
  }, []);
  const toggleAllFilteredDevices = useCallback((checked: boolean) => {
    const keys = filteredSafetyRows.map((row) => `device:${row.rowId}`);
    setSelectedMapItems((prev) => {
      if (!checked) return prev.filter((key) => !keys.includes(key));
      const next = new Set(prev);
      for (const key of keys) next.add(key);
      return Array.from(next);
    });
  }, [filteredSafetyRows]);
  const toggleAllFilteredDoors = useCallback((checked: boolean) => {
    const keys = filteredDoorRows.map((row) => `door:${row.rowId}`);
    setSelectedMapItems((prev) => {
      if (!checked) return prev.filter((key) => !keys.includes(key));
      const next = new Set(prev);
      for (const key of keys) next.add(key);
      return Array.from(next);
    });
  }, [filteredDoorRows]);
  const openSelectedOnMap = useCallback(() => {
    if (!selectedRows.length) return;
    const firstPlanId = selectedPlanOptions[0]?.planId;
    if (!firstPlanId) return;
    setSelectedExportPlanIds(selectedPlanOptions.map((entry) => entry.planId));
    setMultiMapPreview({ keys: selectedMapItems, planId: firstPlanId });
  }, [selectedMapItems, selectedPlanOptions, selectedRows.length]);
  useEffect(() => {
    if (!multiMapPreview) return;
    if (!selectedPlanOptions.length) {
      setMultiMapPreview(null);
      return;
    }
    if (!selectedPlanOptions.some((entry) => entry.planId === multiMapPreview.planId)) {
      setMultiMapPreview((prev) => (prev ? { ...prev, planId: selectedPlanOptions[0].planId } : prev));
    }
  }, [multiMapPreview, selectedPlanOptions]);
  useEffect(() => {
    if (!multiMapPreview) {
      setSelectedExportPlanIds([]);
      return;
    }
    const allPlanIds = selectedPlanOptions.map((entry) => entry.planId);
    setSelectedExportPlanIds((prev) => {
      const scoped = prev.filter((id) => allPlanIds.includes(id));
      return scoped.length ? scoped : allPlanIds;
    });
  }, [multiMapPreview, selectedPlanOptions]);
  const activeSelectedPlanIndex = useMemo(() => {
    if (!multiMapPreview) return -1;
    return selectedPlanOptions.findIndex((entry) => entry.planId === multiMapPreview.planId);
  }, [multiMapPreview, selectedPlanOptions]);
  const goToSelectedPlanOffset = useCallback(
    (delta: number) => {
      if (!multiMapPreview || selectedPlanOptions.length <= 1) return;
      const currentIndex = selectedPlanOptions.findIndex((entry) => entry.planId === multiMapPreview.planId);
      if (currentIndex < 0) return;
      const nextIndex = Math.max(0, Math.min(selectedPlanOptions.length - 1, currentIndex + delta));
      if (nextIndex === currentIndex) return;
      const nextPlanId = selectedPlanOptions[nextIndex]?.planId;
      if (!nextPlanId) return;
      setMultiMapPreview((prev) => (prev ? { ...prev, planId: nextPlanId } : prev));
    },
    [multiMapPreview, selectedPlanOptions]
  );

  const mapData = useMemo(() => {
    if (!mapPreview) return null;
    const plan = mapPreview.row.plan;
    const planWidth = Math.max(200, Number(plan?.width || 1200));
    const planHeight = Math.max(200, Number(plan?.height || 800));
    const corridors = ((plan?.corridors || []) as Corridor[])
      .map((corridor) => {
        const points = corridorPolygon(corridor);
        return { corridor, points, center: polygonCentroid(points) };
      })
      .filter((entry) => entry.points.length >= 3);
    const rooms = (plan?.rooms || []).map((room) => ({ room, points: roomPolygon(room), center: polygonCentroid(roomPolygon(room)) })).filter((entry) => entry.points.length >= 3);
    const doorAnchors = corridors.flatMap((entry) =>
      (entry.corridor.doors || [])
        .map((door) => ({ door, point: getDoorAnchor(entry.corridor, door), corridorId: entry.corridor.id }))
        .filter((item): item is { door: any; point: Point; corridorId: string } => !!item.point)
    );
    const points = [
      ...corridors.flatMap((entry) => entry.points),
      ...rooms.flatMap((entry) => entry.points),
      ...doorAnchors.map((entry) => entry.point),
      { x: 0, y: 0 },
      { x: planWidth, y: planHeight },
      ...(mapPreview.kind === 'device' ? [mapPreview.row.point] : [])
    ];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      minX = 0;
      minY = 0;
      maxX = Number(plan?.width || 1200);
      maxY = Number(plan?.height || 800);
    }
    const pad = 24;
    return {
      corridors,
      rooms,
      doorAnchors,
      planWidth,
      planHeight,
      imageUrl: String(plan?.imageUrl || ''),
      viewBox: `${minX - pad} ${minY - pad} ${Math.max(100, maxX - minX + pad * 2)} ${Math.max(100, maxY - minY + pad * 2)}`
    };
  }, [mapPreview]);

  const multiMapData = useMemo(() => {
    if (!multiMapPreview) return null;
    const items = multiMapPreview.keys
      .map((key) => mapRowsByKey.get(key))
      .filter((entry): entry is { kind: 'device'; row: SafetyRow } | { kind: 'door'; row: EmergencyDoorRow } => !!entry)
      .filter((entry) => entry.row.planId === multiMapPreview.planId);
    if (!items.length) return null;
    const plan = items[0].row.plan;
    const planWidth = Math.max(200, Number(plan?.width || 1200));
    const planHeight = Math.max(200, Number(plan?.height || 800));
    const corridors = ((plan?.corridors || []) as Corridor[])
      .map((corridor) => {
        const points = corridorPolygon(corridor);
        return { corridor, points, center: polygonCentroid(points) };
      })
      .filter((entry) => entry.points.length >= 3);
    const rooms = (plan?.rooms || []).map((room) => ({ room, points: roomPolygon(room), center: polygonCentroid(roomPolygon(room)) })).filter((entry) => entry.points.length >= 3);
    const doorAnchors = corridors.flatMap((entry) =>
      (entry.corridor.doors || [])
        .map((door) => ({ door, point: getDoorAnchor(entry.corridor, door), corridorId: entry.corridor.id }))
        .filter((item): item is { door: any; point: Point; corridorId: string } => !!item.point)
    );
    const selectedDevices = items
      .filter((entry): entry is { kind: 'device'; row: SafetyRow } => entry.kind === 'device')
      .map((entry) => entry.row);
    const selectedDoors = items
      .filter((entry): entry is { kind: 'door'; row: EmergencyDoorRow } => entry.kind === 'door')
      .map((entry) => entry.row);
    const cardLayoutRaw = (plan as any)?.safetyCardLayout;
    const safetyCardLayout = {
      x: Number.isFinite(Number(cardLayoutRaw?.x)) ? Number(cardLayoutRaw.x) : DEFAULT_SAFETY_CARD_LAYOUT.x,
      y: Number.isFinite(Number(cardLayoutRaw?.y)) ? Number(cardLayoutRaw.y) : DEFAULT_SAFETY_CARD_LAYOUT.y,
      w: Number.isFinite(Number(cardLayoutRaw?.w)) ? Math.max(220, Number(cardLayoutRaw.w)) : DEFAULT_SAFETY_CARD_LAYOUT.w,
      h: Number.isFinite(Number(cardLayoutRaw?.h)) ? Math.max(56, Number(cardLayoutRaw.h)) : DEFAULT_SAFETY_CARD_LAYOUT.h,
      fontSize: Number.isFinite(Number(cardLayoutRaw?.fontSize))
        ? Math.max(8, Math.min(22, Number(cardLayoutRaw.fontSize)))
        : DEFAULT_SAFETY_CARD_LAYOUT.fontSize,
      fontIndex: Number.isFinite(Number(cardLayoutRaw?.fontIndex))
        ? Math.max(0, Math.floor(Number(cardLayoutRaw.fontIndex)))
        : DEFAULT_SAFETY_CARD_LAYOUT.fontIndex,
      colorIndex: Number.isFinite(Number(cardLayoutRaw?.colorIndex))
        ? Math.max(0, Math.floor(Number(cardLayoutRaw.colorIndex)))
        : DEFAULT_SAFETY_CARD_LAYOUT.colorIndex,
      textBgIndex: Number.isFinite(Number(cardLayoutRaw?.textBgIndex))
        ? Math.max(0, Math.floor(Number(cardLayoutRaw.textBgIndex)))
        : DEFAULT_SAFETY_CARD_LAYOUT.textBgIndex
    };
    const points = [
      ...corridors.flatMap((entry) => entry.points),
      ...rooms.flatMap((entry) => entry.points),
      ...doorAnchors.map((entry) => entry.point),
      ...selectedDevices.map((entry) => entry.point),
      { x: safetyCardLayout.x, y: safetyCardLayout.y },
      { x: safetyCardLayout.x + safetyCardLayout.w, y: safetyCardLayout.y + safetyCardLayout.h },
      { x: 0, y: 0 },
      { x: planWidth, y: planHeight }
    ];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
    const firstRow = items[0]?.row as SafetyRow | EmergencyDoorRow | undefined;
    const clientRef = firstRow?.clientId ? (clients || []).find((entry: any) => String(entry?.id || '') === String(firstRow.clientId)) : undefined;
    const emergencyContacts = Array.isArray((clientRef as any)?.emergencyContacts) ? ((clientRef as any).emergencyContacts as any[]) : [];
    const scopedContacts = emergencyContacts
      .filter((entry) => {
        const scope = String(entry?.scope || '');
        const showOnPlanCard = entry?.showOnPlanCard !== false;
        if (!showOnPlanCard) return false;
        if (scope === 'global' || scope === 'client') return true;
        if (scope === 'site') return String(entry?.siteId || '') === String(firstRow?.siteId || '');
        if (scope === 'plan') return String(entry?.floorPlanId || '') === String(firstRow?.planId || '');
        return false;
      })
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), lang, { sensitivity: 'base' }));
    const meetingPoints = ((plan?.objects || []) as any[])
      .filter((obj) => String(obj?.type || '') === 'safety_assembly_point')
      .map((obj) => ({
        name: String(obj?.name || obj?.type || '').trim(),
        gps: String(obj?.gpsCoords || '').trim(),
        coords: `${Math.round(Number(obj?.x || 0))}, ${Math.round(Number(obj?.y || 0))}`
      }));
    const pad = 24;
    return {
      plan,
      items,
      selectedDevices,
      selectedDoors,
      corridors,
      rooms,
      doorAnchors,
      planWidth,
      planHeight,
      imageUrl: String(plan?.imageUrl || ''),
      safetyCard: {
        title: t({ it: 'Scheda sicurezza', en: 'Safety card' }),
        numbersLabel: t({ it: 'Numeri utili', en: 'Emergency numbers' }),
        pointsLabel: t({ it: 'Punti di ritrovo', en: 'Meeting points' }),
        noNumbersText: t({ it: 'Nessun numero', en: 'No numbers' }),
        noPointsText: t({ it: 'Nessun punto', en: 'No points' }),
        numbersText: scopedContacts.map((entry) => `${entry?.name || '—'} ${entry?.phone || '—'}`).join(' | '),
        pointsText: meetingPoints.map((entry) => `${entry.name || '—'} ${entry.gps || entry.coords}`).join(' | '),
        layout: safetyCardLayout
      },
      viewBox: `${minX - pad} ${minY - pad} ${Math.max(100, maxX - minX + pad * 2)} ${Math.max(100, maxY - minY + pad * 2)}`
    };
  }, [clients, lang, mapRowsByKey, multiMapPreview, t]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const target = multiMapViewportRef.current;
      setMultiMapFullscreen(!!target && document.fullscreenElement === target);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleMultiMapFullscreen = useCallback(async () => {
    const target = multiMapViewportRef.current;
    if (!target) return;
    try {
      if (document.fullscreenElement === target) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch {
      // ignore unsupported fullscreen transitions
    }
  }, []);

  useEffect(() => {
    if (!multiMapPreview) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = String(target?.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || !!(target as any)?.isContentEditable;
      if (!isTyping && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && selectedPlanOptions.length > 1) {
        event.preventDefault();
        goToSelectedPlanOffset(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (event.key === 'Escape') {
        const targetPanel = multiMapViewportRef.current;
        if (targetPanel && document.fullscreenElement === targetPanel) {
          event.preventDefault();
          void document.exitFullscreen().catch(() => undefined);
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [goToSelectedPlanOffset, multiMapPreview, selectedPlanOptions.length]);

  const exportElementToPdf = useCallback(async (element: HTMLElement | null, filename: string) => {
    if (!element) return;
    const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 18;
    const targetW = pageW - margin * 2;
    const targetH = pageH - margin * 2;
    const ratio = Math.min(targetW / canvas.width, targetH / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH, undefined, 'FAST');
    pdf.save(filename);
  }, []);

  const buildMultiMapPdfCaptureNode = useCallback(
    (
      source: HTMLElement,
      meta: {
        clientName: string;
        siteName: string;
        planName: string;
        clientLogoUrl?: string;
      }
    ) => {
      const host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-10000px';
      host.style.top = '0';
      host.style.width = '1680px';
      host.style.padding = '0';
      host.style.margin = '0';
      host.style.background = '#ffffff';
      host.style.zIndex = '-1';
      host.style.pointerEvents = 'none';

      const clone = source.cloneNode(true) as HTMLElement;
      clone.style.width = '1680px';
      clone.style.background = '#ffffff';
      clone.style.padding = '0';
      clone.style.margin = '0';
      clone.style.border = 'none';
      clone.style.borderRadius = '0';

      clone.querySelectorAll('[data-pdf-hide="true"]').forEach((node) => node.remove());
      clone.querySelectorAll('input[type="checkbox"]').forEach((node) => node.remove());

      const viewport = clone.querySelector('[data-pdf-map-wrap="true"]') as HTMLElement | null;
      if (viewport) {
        viewport.style.marginTop = '0';
        viewport.style.padding = '0';
        viewport.style.border = 'none';
        viewport.style.borderRadius = '0';
        viewport.style.background = '#ffffff';
      }

      const svg = clone.querySelector('svg') as SVGElement | null;
      if (svg) {
        const viewBoxRaw = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/).map((value) => Number(value));
        const vbW = viewBoxRaw.length === 4 ? Number(viewBoxRaw[2]) : NaN;
        const vbH = viewBoxRaw.length === 4 ? Number(viewBoxRaw[3]) : NaN;
        const targetW = 1660;
        const targetH = Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 0 ? Math.round((targetW * vbH) / vbW) : 930;
        const clampedH = Math.max(520, Math.min(1200, targetH));
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        (svg as any).style.width = '100%';
        (svg as any).style.height = `${clampedH}px`;
        (svg as any).style.display = 'block';
        (svg as any).style.objectFit = 'contain';
      }

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '14px';
      header.style.padding = '14px 10px 12px 10px';
      header.style.borderBottom = '1px solid #e2e8f0';
      header.style.marginBottom = '8px';
      header.style.fontFamily = 'Inter, Arial, sans-serif';
      header.style.color = '#0f172a';

      if (meta.clientLogoUrl) {
        const logo = document.createElement('img');
        logo.src = meta.clientLogoUrl;
        logo.alt = meta.clientName;
        logo.style.width = '36px';
        logo.style.height = '36px';
        logo.style.objectFit = 'contain';
        logo.style.borderRadius = '8px';
        logo.style.border = '1px solid #e2e8f0';
        header.appendChild(logo);
      }

      const labels = document.createElement('div');
      labels.style.display = 'flex';
      labels.style.flexDirection = 'column';
      labels.style.gap = '2px';

      const appLine = document.createElement('div');
      appLine.textContent = 'Plixmap';
      appLine.style.fontSize = '13px';
      appLine.style.fontWeight = '700';
      appLine.style.color = '#0369a1';
      labels.appendChild(appLine);

      const breadcrumb = document.createElement('div');
      breadcrumb.textContent = `${meta.clientName} -> ${meta.siteName} -> ${meta.planName}`;
      breadcrumb.style.fontSize = '15px';
      breadcrumb.style.fontWeight = '700';
      breadcrumb.style.color = '#0f172a';
      labels.appendChild(breadcrumb);

      header.appendChild(labels);
      clone.prepend(header);
      host.appendChild(clone);
      document.body.appendChild(host);
      return { host, node: clone };
    },
    []
  );

  const inlineImagesForExport = useCallback(async (node: HTMLElement) => {
    const toDataUrl = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });

    const cache = new Map<string, Promise<string | null>>();
    const resolveDataUrl = (rawUrl: string): Promise<string | null> => {
      const url = String(rawUrl || '').trim();
      if (!url) return Promise.resolve(null);
      if (url.startsWith('data:')) return Promise.resolve(url);
      const existing = cache.get(url);
      if (existing) return existing;
      const task = (async () => {
        try {
          const response = await fetch(url, { credentials: 'include', cache: 'force-cache' });
          if (!response.ok) return null;
          const blob = await response.blob();
          if (!blob || blob.size === 0) return null;
          return await toDataUrl(blob);
        } catch {
          return null;
        }
      })();
      cache.set(url, task);
      return task;
    };

    const svgImages = Array.from(node.querySelectorAll('svg image'));
    for (const entry of svgImages) {
      const href = entry.getAttribute('href') || entry.getAttribute('xlink:href') || '';
      const dataUrl = await resolveDataUrl(href);
      if (!dataUrl) continue;
      entry.setAttribute('href', dataUrl);
      entry.setAttribute('xlink:href', dataUrl);
    }

    const htmlImages = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
    for (const entry of htmlImages) {
      const src = entry.currentSrc || entry.src || '';
      const dataUrl = await resolveDataUrl(src);
      if (!dataUrl) continue;
      entry.src = dataUrl;
      try {
        if (typeof entry.decode === 'function') await entry.decode();
      } catch {
        // ignore
      }
    }
  }, []);

  const waitForNodeImagesReady = useCallback(async (node: HTMLElement | null) => {
    if (!node) return;
    const waitForSource = (rawSrc: string) =>
      new Promise<void>((resolve) => {
        const src = String(rawSrc || '').trim();
        if (!src) {
          resolve();
          return;
        }
        const probe = new Image();
        const done = () => {
          probe.onload = null;
          probe.onerror = null;
          resolve();
        };
        const timeout = window.setTimeout(done, 2500);
        probe.onload = () => {
          window.clearTimeout(timeout);
          done();
        };
        probe.onerror = () => {
          window.clearTimeout(timeout);
          done();
        };
        probe.src = src;
      });

    const htmlJobs = Array.from(node.querySelectorAll('img')).map((entry) =>
      new Promise<void>((resolve) => {
        const img = entry as HTMLImageElement;
        if (img.complete && img.naturalWidth > 0) {
          resolve();
          return;
        }
        const wrappedDone = () => {
          window.clearTimeout(timeout);
          img.removeEventListener('load', wrappedDone);
          img.removeEventListener('error', wrappedDone);
          resolve();
        };
        const timeout = window.setTimeout(wrappedDone, 2500);
        img.addEventListener('load', wrappedDone, { once: true });
        img.addEventListener('error', wrappedDone, { once: true });
      })
    );
    const svgJobs = Array.from(node.querySelectorAll('svg image')).map((entry) =>
      waitForSource(entry.getAttribute('href') || entry.getAttribute('xlink:href') || '')
    );
    await Promise.all([...htmlJobs, ...svgJobs]);
  }, []);

  const rasterizeSvgsForExport = useCallback(async (node: HTMLElement) => {
    const svgNodes = Array.from(node.querySelectorAll('svg')) as SVGSVGElement[];
    for (const svg of svgNodes) {
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      const serialized = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
      const svgObjectUrl = URL.createObjectURL(svgBlob);
      const snapshot = new Image();
      const loaded = await new Promise<boolean>((resolve) => {
        const done = (ok: boolean) => {
          snapshot.onload = null;
          snapshot.onerror = null;
          URL.revokeObjectURL(svgObjectUrl);
          resolve(ok);
        };
        const timeout = window.setTimeout(() => done(false), 3500);
        snapshot.onload = () => {
          window.clearTimeout(timeout);
          done(true);
        };
        snapshot.onerror = () => {
          window.clearTimeout(timeout);
          done(false);
        };
        snapshot.src = svgObjectUrl;
      });
      if (!loaded) continue;

      const computed = window.getComputedStyle(svg);
      const rect = svg.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || parseFloat(computed.width) || 1));
      const height = Math.max(1, Math.round(rect.height || parseFloat(computed.height) || 1));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(snapshot, 0, 0, width, height);
      const replacement = document.createElement('img');
      replacement.alt = '';
      replacement.src = canvas.toDataURL('image/png');
      replacement.width = width;
      replacement.height = height;
      replacement.style.display = computed.display === 'inline' ? 'block' : computed.display || 'block';
      replacement.style.width = computed.width && computed.width !== 'auto' ? computed.width : '100%';
      replacement.style.height = computed.height && computed.height !== 'auto' ? computed.height : `${height}px`;
      replacement.style.maxWidth = '100%';
      replacement.style.verticalAlign = computed.verticalAlign || 'baseline';
      try {
        if (typeof replacement.decode === 'function') await replacement.decode();
      } catch {
        // ignore decode failures
      }
      svg.replaceWith(replacement);
    }
  }, []);

  const waitForRenderedMultiMapPlan = useCallback(async (planId: string) => {
    const targetPlanId = String(planId || '').trim();
    if (!targetPlanId) return false;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 2600) {
      const sourceNode = multiMapExportRef.current;
      const svg = sourceNode?.querySelector('svg[data-export-plan-id]') as SVGElement | null;
      const renderedPlanId = String(svg?.getAttribute('data-export-plan-id') || '').trim();
      if (renderedPlanId === targetPlanId) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          })
        );
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 30));
    }
    return false;
  }, []);

  const exportSelectedMapsToPdf = useCallback(async () => {
    if (!multiMapPreview) return;
    const allPlanIds = selectedPlanOptions.map((entry) => entry.planId);
    const exportPlanIds =
      allPlanIds.length > 1
        ? allPlanIds.filter((id) => selectedExportPlanIds.includes(id))
        : [multiMapPreview.planId];
    const finalPlanIds = exportPlanIds.length ? exportPlanIds : [multiMapPreview.planId];
    if (!multiMapExportRef.current) return;
    const originalPlanId = multiMapPreview.planId;
    setMultiMapExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const targetW = pageW - margin * 2;
      const targetH = pageH - margin * 2;
      let printedPages = 0;
      let activePlanId = String(multiMapPreview.planId || '');
      for (const planId of finalPlanIds) {
        if (planId !== activePlanId) {
          setMultiMapPreview((prev) => (prev ? { ...prev, planId } : prev));
          activePlanId = planId;
        }
        await waitForRenderedMultiMapPlan(planId);
        const sourceNode = multiMapExportRef.current;
        if (!sourceNode) continue;
        await waitForNodeImagesReady(sourceNode);
        const meta = selectedPlanOptions.find((entry) => entry.planId === planId) || selectedPlanOptions[0];
        const clientLogoUrl = meta?.clientId
          ? String((clients || []).find((client: any) => String(client?.id || '') === String(meta.clientId))?.logoUrl || '')
          : '';
        const capture = buildMultiMapPdfCaptureNode(sourceNode, {
          clientName: meta?.clientName || '',
          siteName: meta?.siteName || '',
          planName: meta?.planName || '',
          clientLogoUrl
        });
        let canvas: HTMLCanvasElement | null = null;
        try {
          await inlineImagesForExport(capture.node);
          await rasterizeSvgsForExport(capture.node);
          await waitForNodeImagesReady(capture.node);
          await new Promise((resolve) => window.setTimeout(resolve, 60));
          canvas = await html2canvas(capture.node, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
        } finally {
          capture.host.remove();
        }
        if (!canvas) continue;
        if (printedPages > 0) pdf.addPage();
        const ratio = Math.min(targetW / canvas.width, targetH / canvas.height);
        const drawW = canvas.width * ratio;
        const drawH = canvas.height * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH, undefined, 'FAST');
        printedPages += 1;
      }
      if (printedPages > 0) {
        pdf.save(printedPages > 1 ? 'safety-selected-maps.pdf' : 'safety-selected-map.pdf');
      }
    } finally {
      setMultiMapPreview((prev) => (prev ? { ...prev, planId: originalPlanId } : prev));
      setMultiMapExporting(false);
    }
  }, [buildMultiMapPdfCaptureNode, clients, inlineImagesForExport, multiMapPreview, rasterizeSvgsForExport, selectedExportPlanIds, selectedPlanOptions, waitForNodeImagesReady, waitForRenderedMultiMapPlan]);

  const closeMultiMapPreview = useCallback(() => {
    const panel = multiMapViewportRef.current;
    if (panel && document.fullscreenElement === panel) {
      void document.exitFullscreen().catch(() => undefined);
    }
    setMultiMapPreview(null);
  }, []);

  const closeSingleMapPreview = useCallback(() => {
    setMapPreview(null);
  }, []);

  const allSelectedForExport = selectedPlanOptions.length > 0 && selectedPlanOptions.every((entry) => selectedExportPlanIds.includes(entry.planId));

  const toggleAllExportPlans = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedExportPlanIds(multiMapPreview ? [multiMapPreview.planId] : []);
        return;
      }
      setSelectedExportPlanIds(selectedPlanOptions.map((entry) => entry.planId));
    },
    [multiMapPreview, selectedPlanOptions]
  );

  const toggleExportPlanId = useCallback((planId: string, checked: boolean) => {
    setSelectedExportPlanIds((prev) => {
      if (checked) return prev.includes(planId) ? prev : [...prev, planId];
      const next = prev.filter((id) => id !== planId);
      return next.length ? next : [planId];
    });
  }, []);

  const canGoPrevPlan = activeSelectedPlanIndex > 0;
  const canGoNextPlan = activeSelectedPlanIndex >= 0 && activeSelectedPlanIndex < selectedPlanOptions.length - 1;

  const exportCsv = (type: 'devices' | 'doors') => {
    const rows = type === 'devices' ? filteredSafetyRows : filteredDoorRows;
    if (!rows.length) return;
    const header =
      type === 'devices'
        ? ['Cliente', 'Sede', 'Planimetria', 'Tipo oggetto', 'Nome', 'Descrizione', 'Note', 'Ultima revisione', 'Azienda verifica', 'Ufficio/Corridoio', 'GPS']
        : ['Cliente', 'Sede', 'Planimetria', 'Descrizione', 'Tipo porta', 'Tag', 'Ultima revisione', 'Azienda verifica', 'Corridoio', 'Ufficio vicino'];
    const lines = [
      header.join(';'),
      ...rows.map((row: any) =>
        (type === 'devices'
          ? [
              row.clientName,
              row.siteName,
              row.planName,
              row.typeLabel,
              row.name,
              row.description,
              row.notes,
              row.lastVerificationAt,
              row.verifierCompany,
              row.locationName,
              row.gpsCoords
            ]
          : [
              row.clientName,
              row.siteName,
              row.planName,
              row.description,
              row.doorType,
              row.mode === 'automated' && row.isFireDoor ? '[AU+TF]' : row.mode === 'automated' ? '[AU]' : row.isFireDoor ? '[TF]' : '',
              row.lastVerificationAt,
              row.verifierCompany,
              row.corridorName,
              row.nearestRoomName
            ]
        )
          .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
          .join(';')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'devices' ? 'safety-devices.csv' : 'emergency-doors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSortIcon = (active: boolean, dir: 'asc' | 'desc') => {
    if (!active) return <ArrowUpDown size={13} className="text-slate-400" />;
    return dir === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />;
  };

  const resetDeviceEditor = () => {
    setDocDraft({ name: '', validUntil: '', notes: '' });
    setCheckDraft({ date: '', company: '', notes: '' });
    setEditorError('');
  };
  const deviceEditorReadOnly = useMemo(
    () => !deviceHistory || !canManageScope(deviceHistory.clientId, deviceHistory.siteId, deviceHistory.planId),
    [deviceHistory, permissions, user?.isAdmin, user?.isSuperAdmin, user?.username]
  );
  const doorEditorReadOnly = useMemo(
    () => !doorHistory || !canManageScope(doorHistory.clientId, doorHistory.siteId, doorHistory.planId),
    [doorHistory, permissions, user?.isAdmin, user?.isSuperAdmin, user?.username]
  );

  const appendDeviceDocument = async (files: FileList | null) => {
    if (!deviceHistory || !files?.[0]) return;
    const file = files[0];
    const valid = validateFile(file, { allowedTypes: uploadMimes.pdf, maxBytes: uploadLimits.pdfBytes });
    if (!valid.ok) {
      setEditorError(
        valid.reason === 'size'
          ? t({ it: `File troppo grande (max ${formatBytes(uploadLimits.pdfBytes)}).`, en: `File too large (max ${formatBytes(uploadLimits.pdfBytes)}).` })
          : t({ it: 'Formato non supportato. Usa PDF.', en: 'Unsupported format. Use PDF.' })
      );
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDocDraft((prev) => ({ ...prev, fileName: file.name, dataUrl }));
      setEditorError('');
    } catch {
      setEditorError(t({ it: 'Upload non riuscito.', en: 'Upload failed.' }));
    }
  };

  const saveDeviceHistory = () => {
    if (!deviceHistory) return;
    if (deviceEditorReadOnly) return;
    let nextDocs = [...(deviceHistory.securityDocuments || [])];
    let nextChecks = [...(deviceHistory.securityCheckHistory || [])];
    const docName = docDraft.name.trim();
    if (docName) {
      nextDocs = [
        ...nextDocs,
        {
          id: nanoid(),
          name: docName,
          fileName: docDraft.fileName || undefined,
          dataUrl: docDraft.dataUrl || undefined,
          uploadedAt: new Date().toISOString(),
          validUntil: docDraft.validUntil.trim() || undefined,
          notes: docDraft.notes.trim() || undefined
        }
      ];
    }
    const checkCompany = checkDraft.company.trim();
    const checkDate = checkDraft.date.trim();
    const checkNotes = checkDraft.notes.trim();
    if (checkCompany || checkDate || checkNotes) {
      nextChecks = [
        ...nextChecks,
        {
          id: nanoid(),
          date: checkDate || undefined,
          company: checkCompany || undefined,
          notes: checkNotes || undefined,
          createdAt: Date.now()
        }
      ];
    }
    updateObject(deviceHistory.objectId, {
      securityDocuments: nextDocs,
      securityCheckHistory: nextChecks,
      lastVerificationAt: checkDate || deviceHistory.lastVerificationAt || undefined,
      verifierCompany: checkCompany || deviceHistory.verifierCompany || undefined
    });
    setDeviceHistory((prev) =>
      prev
        ? {
            ...prev,
            securityDocuments: nextDocs,
            securityCheckHistory: nextChecks,
            lastVerificationAt: checkDate || prev.lastVerificationAt,
            verifierCompany: checkCompany || prev.verifierCompany
          }
        : prev
    );
    resetDeviceEditor();
  };

  const saveDoorHistoryCheck = () => {
    if (!doorHistory) return;
    if (doorEditorReadOnly) return;
    const company = checkDraft.company.trim();
    const date = checkDraft.date.trim();
    const notes = checkDraft.notes.trim();
    if (!company && !date && !notes) return;
    const nextEntry = { id: nanoid(), date: date || undefined, company: company || '', notes: notes || undefined, createdAt: Date.now() };
    const plan = doorHistory.plan;
    const nextCorridors = (plan.corridors || []).map((corridor) => {
      if (corridor.id !== doorHistory.corridorId) return corridor;
      return {
        ...corridor,
        doors: (corridor.doors || []).map((door) => {
          if (String(door.id) !== String(doorHistory.doorId)) return door;
          return {
            ...door,
            lastVerificationAt: date || door.lastVerificationAt,
            verifierCompany: company || door.verifierCompany,
            verificationHistory: [...(door.verificationHistory || []), nextEntry]
          };
        })
      };
    });
    updateFloorPlan(plan.id, { corridors: nextCorridors as any });
    setDoorHistory((prev) =>
      prev
        ? {
            ...prev,
            lastVerificationAt: date || prev.lastVerificationAt,
            verifierCompany: company || prev.verifierCompany,
            verificationHistory: [...prev.verificationHistory, nextEntry]
          }
        : prev
    );
    setCheckDraft({ date: '', company: '', notes: '' });
  };
  const allFilteredDevicesSelected =
    !!filteredSafetyRows.length && filteredSafetyRows.every((row) => selectedMapItems.includes(`device:${row.rowId}`));
  const allFilteredDoorsSelected =
    !!filteredDoorRows.length && filteredDoorRows.every((row) => selectedMapItems.includes(`door:${row.rowId}`));

  return (
    <div ref={panelRef} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{t({ it: 'Sicurezza', en: 'Safety' })}</div>
          <div className="text-xs text-slate-500">
            {t({
              it: 'Catalogo dispositivi sicurezza e porte d’emergenza presenti nelle planimetrie.',
              en: 'Catalog of safety devices and emergency doors placed on floor plans.'
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selectedMapItems.length}
            onClick={openSelectedOnMap}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Crosshair size={14} />
            {t({
              it: `Mostra selezionati in mappa (${selectedMapItems.length})`,
              en: `Show selected on map (${selectedMapItems.length})`
            })}
          </button>
          <Menu as="div" className="relative">
            <Menu.Button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Download size={14} />
              {t({ it: 'Export', en: 'Export' })}
              <ChevronDown size={14} className="text-slate-500" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-card focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => void exportElementToPdf(panelRef.current, 'safety-screen.pdf')}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${
                        active ? 'bg-slate-50 text-ink' : 'text-slate-700'
                      }`}
                    >
                      <Download size={13} />
                      {t({ it: 'Esporta PDF schermata', en: 'Export screen PDF' })}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => exportCsv('devices')}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${
                        active ? 'bg-slate-50 text-ink' : 'text-slate-700'
                      }`}
                    >
                      <Download size={13} />
                      {t({ it: 'Export dispositivi', en: 'Export devices' })}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => exportCsv('doors')}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold ${
                        active ? 'bg-slate-50 text-ink' : 'text-slate-700'
                      }`}
                    >
                      <Download size={13} />
                      {t({ it: 'Export porte', en: 'Export doors' })}
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 lg:w-1/2">
            <Search size={16} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder={t({
                it: 'Cerca cliente, sede, planimetria, oggetto, porta, corridoio…',
                en: 'Search client, site, floor plan, device, door, corridor...'
              })}
            />
          </label>
          <button
            type="button"
            title={t({ it: 'Azzera tutti i filtri', en: 'Reset all filters' })}
            onClick={() => {
              setClientFilter('all');
              setSiteFilter('all');
              setPlanFilter('all');
              setTypeFilter('all');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw size={14} />
            {t({ it: 'Reset filtri', en: 'Reset filters' })}
          </button>
        </div>
        <div className="mt-2 grid gap-2 lg:grid-cols-4">
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          <option value="all">{t({ it: 'Tutti i clienti', en: 'All clients' })}</option>
          {clientOptions.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
          </select>
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          <option value="all">{t({ it: 'Tutte le sedi', en: 'All sites' })}</option>
          {siteOptions.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
          </select>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          <option value="all">{t({ it: 'Tutte le planimetrie', en: 'All floor plans' })}</option>
          {planOptions.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          <option value="all">{t({ it: 'Tutti i tipi', en: 'All types' })}</option>
          {typeOptions.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {t({ it: 'Dispositivi sicurezza', en: 'Safety devices' })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1700px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredDevicesSelected}
                    onChange={(e) => toggleAllFilteredDevices(e.target.checked)}
                    title={t({ it: 'Seleziona tutti i dispositivi visibili', en: 'Select all visible devices' })}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setSafetySort((prev) => ({ key: 'clientName', dir: prev.key === 'clientName' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Cliente', en: 'Client' })} {toggleSortIcon(safetySort.key === 'clientName', safetySort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setSafetySort((prev) => ({ key: 'siteName', dir: prev.key === 'siteName' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Sede', en: 'Site' })} {toggleSortIcon(safetySort.key === 'siteName', safetySort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setSafetySort((prev) => ({ key: 'planName', dir: prev.key === 'planName' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Planimetria', en: 'Floor plan' })} {toggleSortIcon(safetySort.key === 'planName', safetySort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-center">{t({ it: 'Icona', en: 'Icon' })}</th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setSafetySort((prev) => ({ key: 'typeLabel', dir: prev.key === 'typeLabel' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Tipo oggetto', en: 'Object type' })} {toggleSortIcon(safetySort.key === 'typeLabel', safetySort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setSafetySort((prev) => ({ key: 'name', dir: prev.key === 'name' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Nome', en: 'Name' })} {toggleSortIcon(safetySort.key === 'name', safetySort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">{t({ it: 'Descrizione', en: 'Description' })}</th>
                <th className="px-3 py-2 text-left">{t({ it: 'Note', en: 'Notes' })}</th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setSafetySort((prev) => ({ key: 'lastVerificationAt', dir: prev.key === 'lastVerificationAt' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Ultima revisione', en: 'Last revision' })} {toggleSortIcon(safetySort.key === 'lastVerificationAt', safetySort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setSafetySort((prev) => ({ key: 'locationName', dir: prev.key === 'locationName' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Ufficio/Corridoio', en: 'Room/Corridor' })} {toggleSortIcon(safetySort.key === 'locationName', safetySort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSafetyRows.length ? (
                filteredSafetyRows.map((row) => (
                  <tr key={row.rowId} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedMapItems.includes(`device:${row.rowId}`)}
                        onChange={(e) => toggleSelection(`device:${row.rowId}`, e.target.checked)}
                        title={t({ it: 'Seleziona dispositivo', en: 'Select device' })}
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold text-ink">{row.clientName || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.siteName || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.planName || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600">
                        <Icon name={row.icon as any} size={15} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.typeLabel}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{row.name || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.description || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.notes || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.lastVerificationAt || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.locationName || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMapPreview({ kind: 'device', row })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Mirino: mostra su planimetria', en: 'Crosshair: show on floor plan' })}
                        >
                          <Crosshair size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeviceHistory(row);
                            resetDeviceEditor();
                          }}
                          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          title={t({ it: 'Storico e documenti', en: 'History and documents' })}
                        >
                          <History size={14} />
                          {(row.securityCheckHistory.length || row.securityDocuments.length) ? (
                            <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[9px] font-bold text-rose-700">
                              {row.securityCheckHistory.length + row.securityDocuments.length}
                            </span>
                          ) : null}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-sm text-slate-500">
                    {t({ it: 'Nessun dispositivo sicurezza trovato.', en: 'No safety devices found.' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {t({ it: 'Porte d’emergenza', en: 'Emergency doors' })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1700px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredDoorsSelected}
                    onChange={(e) => toggleAllFilteredDoors(e.target.checked)}
                    title={t({ it: 'Seleziona tutte le porte visibili', en: 'Select all visible doors' })}
                  />
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setDoorSort((prev) => ({ key: 'clientName', dir: prev.key === 'clientName' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Cliente', en: 'Client' })} {toggleSortIcon(doorSort.key === 'clientName', doorSort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setDoorSort((prev) => ({ key: 'siteName', dir: prev.key === 'siteName' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Sede', en: 'Site' })} {toggleSortIcon(doorSort.key === 'siteName', doorSort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setDoorSort((prev) => ({ key: 'planName', dir: prev.key === 'planName' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'Planimetria', en: 'Floor plan' })} {toggleSortIcon(doorSort.key === 'planName', doorSort.dir)}
                  </button>
                </th>
                <th className="px-3 py-2 text-left">{t({ it: 'Descrizione porta', en: 'Door description' })}</th>
                <th className="px-3 py-2 text-left">{t({ it: 'Tipo porta', en: 'Door type' })}</th>
                <th className="px-3 py-2 text-left">
                  <span
                    title={t({
                      it: 'AU = automatizzata, TF = tagliafuoco.',
                      en: 'AU = automated, TF = fire door.'
                    })}
                  >
                    {t({ it: 'Tag', en: 'Tag' })}
                  </span>
                </th>
                <th className="px-3 py-2 text-left">{t({ it: 'Ultima revisione', en: 'Last revision' })}</th>
                <th className="px-3 py-2 text-left">{t({ it: 'Ultima azienda revisionatrice', en: 'Last verifier company' })}</th>
                <th className="px-3 py-2 text-left">{t({ it: 'Nome corridoio', en: 'Corridor' })}</th>
                <th className="px-3 py-2 text-left">{t({ it: 'Ufficio più vicino', en: 'Nearest office' })}</th>
                <th className="px-3 py-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDoorRows.length ? (
                filteredDoorRows.map((row) => {
                  const tag = row.mode === 'automated' && row.isFireDoor ? '[AU+TF]' : row.mode === 'automated' ? '[AU]' : row.isFireDoor ? '[TF]' : '';
                  return (
                    <tr key={row.rowId} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedMapItems.includes(`door:${row.rowId}`)}
                          onChange={(e) => toggleSelection(`door:${row.rowId}`, e.target.checked)}
                          title={t({ it: 'Seleziona porta', en: 'Select door' })}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-ink">{row.clientName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.siteName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.planName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.description || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.doorType || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{tag || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.lastVerificationAt || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.verifierCompany || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.corridorName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.nearestRoomName || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setMapPreview({ kind: 'door', row })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Mirino: mostra su planimetria', en: 'Crosshair: show on floor plan' })}
                          >
                            <Crosshair size={14} />
                          </button>
                          {row.mode === 'automated' && String(row.openUrl || '').trim() ? (
                            <button
                              type="button"
                              onClick={() => {
                                const normalized = /^https?:\/\//i.test(row.openUrl) ? row.openUrl : `https://${row.openUrl}`;
                                window.open(normalized, '_blank', 'noopener,noreferrer');
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title={t({ it: 'Apri porta', en: 'Open door' })}
                            >
                              <ExternalLink size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setDoorHistory(row);
                              setCheckDraft({ date: '', company: '', notes: '' });
                            }}
                            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            title={t({ it: 'Storico verifiche', en: 'Check history' })}
                          >
                            <History size={14} />
                            {row.verificationHistory.length ? (
                              <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[9px] font-bold text-rose-700">
                                {row.verificationHistory.length}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-sm text-slate-500">
                    {t({ it: 'Nessuna porta d’emergenza trovata.', en: 'No emergency doors found.' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Transition show={!!mapPreview} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeSingleMapPreview}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-6xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">
                      {mapPreview?.kind === 'device'
                        ? t({ it: 'Mirino dispositivo sicurezza', en: 'Safety device crosshair' })
                        : t({ it: 'Mirino porta emergenza', en: 'Emergency door crosshair' })}
                    </Dialog.Title>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void exportElementToPdf(singleMapExportRef.current, 'safety-crosshair.pdf')}
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        <Download size={13} />
                        {t({ it: 'Esporta PDF', en: 'Export PDF' })}
                      </button>
                      <button onClick={closeSingleMapPreview} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  {mapPreview ? (
                    <div ref={singleMapExportRef}>
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="font-semibold">{mapPreview.row.clientName}</span> · <span className="font-semibold">{mapPreview.row.siteName}</span> ·{' '}
                        <span className="font-semibold">{mapPreview.row.planName}</span>
                      </div>
                      <div ref={singleMapRef} className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                        <svg viewBox={mapData?.viewBox || '0 0 100 100'} preserveAspectRatio="xMidYMid meet" className="h-[68vh] w-full">
                          {mapData?.imageUrl ? (
                            <image
                              href={mapData.imageUrl}
                              xlinkHref={mapData.imageUrl}
                              x={0}
                              y={0}
                              width={mapData.planWidth}
                              height={mapData.planHeight}
                              preserveAspectRatio="xMidYMid meet"
                              opacity={0.95}
                            />
                          ) : null}
                          {mapData?.corridors.map((entry) => (
                            <path key={`c-${entry.corridor.id}`} d={polygonPath(entry.points)} fill="#e2e8f0" stroke="#64748b" strokeWidth={2} opacity={0.95} />
                          ))}
                          {mapData?.rooms.map((entry) => (
                            <Fragment key={`r-${entry.room.id}`}>
                              <path d={polygonPath(entry.points)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1.6} />
                              {entry.center ? (
                                <text x={entry.center.x} y={entry.center.y} fill="#1e3a8a" fontSize={14} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700 }}>
                                  {entry.room.name}
                                </text>
                              ) : null}
                            </Fragment>
                          ))}
                          {mapData?.doorAnchors.map((entry) => {
                            const selectedDoor =
                              mapPreview.kind === 'door' &&
                              entry.corridorId === mapPreview.row.corridorId &&
                              String(entry.door?.id || '') === String(mapPreview.row.doorId || '');
                            const doorRow = mapPreview.kind === 'door' ? mapPreview.row : null;
                            const doorLabel = String(doorRow?.description || doorRow?.doorId || '').trim();
                            return (
                              <Fragment key={`d-${entry.corridorId}-${entry.door.id}`}>
                                <circle
                                  cx={entry.point.x}
                                  cy={entry.point.y}
                                  r={selectedDoor ? 6.5 : 4.5}
                                  fill={selectedDoor ? '#f97316' : '#334155'}
                                  stroke={selectedDoor ? '#7c2d12' : '#ffffff'}
                                  strokeWidth={2}
                                />
                                {selectedDoor && doorLabel ? (
                                  <text x={entry.point.x} y={entry.point.y - 10} fill="#7c2d12" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                    {doorLabel}
                                  </text>
                                ) : null}
                              </Fragment>
                            );
                          })}
                          {mapPreview.kind === 'device' ? (
                            <>
                              <circle cx={mapPreview.row.point.x} cy={mapPreview.row.point.y} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth={2.2} />
                              <circle cx={mapPreview.row.point.x} cy={mapPreview.row.point.y} r={13} fill="none" stroke="#ef4444" strokeWidth={1.4} strokeDasharray="4 4" />
                              {mapPreview.row.name ? (
                                <text x={mapPreview.row.point.x} y={mapPreview.row.point.y - 12} fill="#7f1d1d" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                  {mapPreview.row.name}
                                </text>
                              ) : null}
                            </>
                          ) : null}
                        </svg>
                      </div>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!multiMapPreview} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeMultiMapPreview}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-6xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Mirino oggetti selezionati', en: 'Selected items crosshair' })}</Dialog.Title>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void exportSelectedMapsToPdf()}
                        disabled={multiMapExporting}
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        <Download size={13} />
                        {multiMapExporting
                          ? t({ it: 'Export in corso…', en: 'Exporting…' })
                          : t({ it: 'Esporta PDF', en: 'Export PDF' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleMultiMapFullscreen()}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Schermo intero (Esc per uscire)', en: 'Fullscreen (Esc to exit)' })}
                      >
                        {multiMapFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                        {multiMapFullscreen ? t({ it: 'Esci full screen', en: 'Exit fullscreen' }) : t({ it: 'Full screen', en: 'Fullscreen' })}
                      </button>
                      <button onClick={closeMultiMapPreview} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  {multiMapPreview ? (
                    <div ref={multiMapExportRef}>
                      <div data-pdf-hide="true" className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="text-xs text-slate-600">
                          {t({
                            it: `${selectedRows.length} oggetti selezionati`,
                            en: `${selectedRows.length} selected items`
                          })}
                        </div>
                        {selectedPlanOptions.length > 1 ? (
                          <select
                            value={multiMapPreview.planId}
                            onChange={(e) => setMultiMapPreview((prev) => (prev ? { ...prev, planId: e.target.value } : prev))}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            {selectedPlanOptions.map((entry) => (
                              <option key={entry.planId} value={entry.planId}>
                                {entry.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                      {selectedPlanOptions.length > 1 ? (
                        <div data-pdf-hide="true" className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                          <div className="mb-2 font-semibold">{t({ it: 'Export planimetrie', en: 'Export floor plans' })}</div>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center gap-2">
                              <input type="checkbox" checked={allSelectedForExport} onChange={(e) => toggleAllExportPlans(e.target.checked)} />
                              <span className="font-semibold">{t({ it: 'Tutte', en: 'All' })}</span>
                            </label>
                            {selectedPlanOptions.map((entry) => (
                              <label key={`exp-${entry.planId}`} className="inline-flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedExportPlanIds.includes(entry.planId)}
                                  onChange={(e) => toggleExportPlanId(entry.planId, e.target.checked)}
                                />
                                <span>{entry.planName}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div data-pdf-hide="true" className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={multiMapOptions.showRoomNames}
                            onChange={(e) =>
                              setMultiMapOptions((prev) => ({
                                ...prev,
                                showRoomNames: e.target.checked
                              }))
                            }
                          />
                          {t({ it: 'Nomi stanze', en: 'Room names' })}
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={multiMapOptions.showCorridorNames}
                            onChange={(e) =>
                              setMultiMapOptions((prev) => ({
                                ...prev,
                                showCorridorNames: e.target.checked
                              }))
                            }
                          />
                          {t({ it: 'Nomi corridoi', en: 'Corridor names' })}
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={multiMapOptions.showSafetyCard}
                            onChange={(e) =>
                              setMultiMapOptions((prev) => ({
                                ...prev,
                                showSafetyCard: e.target.checked
                              }))
                            }
                          />
                          {t({ it: 'Scheda sicurezza', en: 'Safety card' })}
                        </label>
                        {selectedPlanOptions.length > 1 ? (
                          <span className="ml-auto text-[11px] font-semibold text-slate-500">
                            {t({ it: 'Frecce tastiera: planimetria precedente/successiva', en: 'Arrow keys: previous/next floor plan' })}
                          </span>
                        ) : null}
                      </div>
                      <div ref={multiMapViewportRef} data-pdf-map-wrap="true" className="mt-4 relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                        <div ref={multiMapRef}>
                          <svg
                            viewBox={multiMapData?.viewBox || '0 0 100 100'}
                            data-export-plan-id={multiMapData?.plan?.id || ''}
                            preserveAspectRatio="xMidYMid meet"
                            className={multiMapFullscreen ? 'h-[calc(100vh-1rem)] w-full' : 'h-[68vh] w-full'}
                          >
                            {multiMapData?.imageUrl ? (
                              <image
                                href={multiMapData.imageUrl}
                                xlinkHref={multiMapData.imageUrl}
                                x={0}
                                y={0}
                                width={multiMapData.planWidth}
                                height={multiMapData.planHeight}
                                preserveAspectRatio="xMidYMid meet"
                                opacity={0.95}
                              />
                            ) : null}
                            {multiMapData?.corridors.map((entry) => (
                              <Fragment key={`mc-${entry.corridor.id}`}>
                                <path d={polygonPath(entry.points)} fill="#e2e8f0" stroke="#64748b" strokeWidth={2} opacity={0.95} />
                                {multiMapOptions.showCorridorNames && entry.center && String(entry.corridor?.name || '').trim() ? (
                                  <text x={entry.center.x} y={entry.center.y} fill="#0f172a" fontSize={12} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700 }}>
                                    {entry.corridor.name}
                                  </text>
                                ) : null}
                              </Fragment>
                            ))}
                            {multiMapData?.rooms.map((entry) => (
                              <Fragment key={`mr-${entry.room.id}`}>
                                <path d={polygonPath(entry.points)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1.3} />
                                {multiMapOptions.showRoomNames && entry.center && String(entry.room?.name || '').trim() ? (
                                  <text x={entry.center.x} y={entry.center.y} fill="#1e3a8a" fontSize={12} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700 }}>
                                    {entry.room.name}
                                  </text>
                                ) : null}
                              </Fragment>
                            ))}
                            {multiMapOptions.showSafetyCard && multiMapData?.safetyCard ? (
                              (() => {
                                const layout = multiMapData.safetyCard.layout;
                                const headerHeight = Math.max(18, Number(layout.fontSize || 10) * 1.48);
                                const bodyFontSize = Math.max(8, Number(layout.fontSize || 10));
                                const colorVariant =
                                  SAFETY_CARD_COLOR_VARIANTS[
                                    ((Number(layout.colorIndex) % SAFETY_CARD_COLOR_VARIANTS.length) + SAFETY_CARD_COLOR_VARIANTS.length) %
                                      SAFETY_CARD_COLOR_VARIANTS.length
                                  ];
                                const textBgFill =
                                  SAFETY_CARD_TEXT_BG_VARIANTS[
                                    ((Number(layout.textBgIndex) % SAFETY_CARD_TEXT_BG_VARIANTS.length) + SAFETY_CARD_TEXT_BG_VARIANTS.length) %
                                      SAFETY_CARD_TEXT_BG_VARIANTS.length
                                  ];
                                const fontFamily = SAFETY_CARD_FONT_VALUES.length
                                  ? SAFETY_CARD_FONT_VALUES[
                                      ((Number(layout.fontIndex) % SAFETY_CARD_FONT_VALUES.length) + SAFETY_CARD_FONT_VALUES.length) %
                                        SAFETY_CARD_FONT_VALUES.length
                                    ]
                                  : 'Arial, sans-serif';
                                const numbersText = `${multiMapData.safetyCard.numbersLabel}: ${
                                  multiMapData.safetyCard.numbersText || multiMapData.safetyCard.noNumbersText
                                }`;
                                const pointsText = `${multiMapData.safetyCard.pointsLabel}: ${
                                  multiMapData.safetyCard.pointsText || multiMapData.safetyCard.noPointsText
                                }`;
                                return (
                                  <g>
                                    <rect x={layout.x} y={layout.y} width={layout.w} height={layout.h} fill={colorVariant.body} stroke={colorVariant.border} strokeWidth={1.6} rx={0} />
                                    <rect
                                      x={layout.x + 1}
                                      y={layout.y + 1}
                                      width={Math.max(1, layout.w - 2)}
                                      height={Math.max(1, headerHeight - 1)}
                                      fill={colorVariant.header}
                                      rx={0}
                                    />
                                    <text
                                      x={layout.x + 10}
                                      y={layout.y + headerHeight / 2 + 1}
                                      fill={colorVariant.title}
                                      fontSize={Math.max(9, bodyFontSize * 0.92)}
                                      fontFamily={fontFamily}
                                      dominantBaseline="middle"
                                      style={{ fontWeight: 700 }}
                                    >
                                      {multiMapData.safetyCard.title}
                                    </text>
                                    {textBgFill !== 'transparent' ? (
                                      <>
                                        <rect x={layout.x + 8} y={layout.y + headerHeight + 1} width={Math.max(24, layout.w - 16)} height={Math.max(10, bodyFontSize * 1.26)} fill={textBgFill} />
                                        <rect
                                          x={layout.x + 8}
                                          y={layout.y + headerHeight + bodyFontSize + 5}
                                          width={Math.max(24, layout.w - 16)}
                                          height={Math.max(10, bodyFontSize * 1.26)}
                                          fill={textBgFill}
                                        />
                                      </>
                                    ) : null}
                                    <text x={layout.x + 10} y={layout.y + headerHeight + bodyFontSize + 2} fill={colorVariant.text} fontSize={bodyFontSize} fontFamily={fontFamily} style={{ fontWeight: 700 }}>
                                      {numbersText}
                                    </text>
                                    <text x={layout.x + 10} y={layout.y + headerHeight + bodyFontSize * 2 + 6} fill={colorVariant.text} fontSize={bodyFontSize} fontFamily={fontFamily} style={{ fontWeight: 700 }}>
                                      {pointsText}
                                    </text>
                                  </g>
                                );
                              })()
                            ) : null}
                            {multiMapData?.selectedDoors.map((entry) => {
                              const anchor = multiMapData.doorAnchors.find((item) => item.corridorId === entry.corridorId && String(item.door.id) === String(entry.doorId));
                              if (!anchor) return null;
                              const label = String(entry.description || entry.doorId || '').trim();
                              return (
                                <Fragment key={`md-${entry.rowId}`}>
                                  <circle cx={anchor.point.x} cy={anchor.point.y} r={6.5} fill="#f97316" stroke="#7c2d12" strokeWidth={2} />
                                  {label ? (
                                    <text x={anchor.point.x} y={anchor.point.y - 10} fill="#7c2d12" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                      {label}
                                    </text>
                                  ) : null}
                                </Fragment>
                              );
                            })}
                            {multiMapData?.selectedDevices.map((entry) => (
                              <Fragment key={`mdev-${entry.rowId}`}>
                                <circle cx={entry.point.x} cy={entry.point.y} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth={2.2} />
                                <circle cx={entry.point.x} cy={entry.point.y} r={13} fill="none" stroke="#ef4444" strokeWidth={1.4} strokeDasharray="4 4" />
                                {entry.name ? (
                                  <text x={entry.point.x} y={entry.point.y - 12} fill="#7f1d1d" fontSize={11} textAnchor="middle" dominantBaseline="ideographic" style={{ fontWeight: 700 }}>
                                    {entry.name}
                                  </text>
                                ) : null}
                              </Fragment>
                            ))}
                          </svg>
                        </div>
                        {selectedPlanOptions.length > 1 ? (
                          <>
                            <button
                              data-pdf-hide="true"
                              type="button"
                              onClick={() => goToSelectedPlanOffset(-1)}
                              disabled={!canGoPrevPlan}
                              className="absolute bottom-3 left-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-card hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                              title={t({ it: 'Planimetria precedente (←)', en: 'Previous floor plan (←)' })}
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <button
                              data-pdf-hide="true"
                              type="button"
                              onClick={() => goToSelectedPlanOffset(1)}
                              disabled={!canGoNextPlan}
                              className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-card hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                              title={t({ it: 'Planimetria successiva (→)', en: 'Next floor plan (→)' })}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!deviceHistory} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDeviceHistory(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-4xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Storico revisioni e documenti', en: 'Checks history and documents' })}</Dialog.Title>
                    <button onClick={() => setDeviceHistory(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  {deviceHistory ? (
                    <>
                      <div className="mt-2 text-xs text-slate-600">
                        {deviceHistory.clientName} · {deviceHistory.siteName} · {deviceHistory.planName} · <span className="font-semibold">{deviceHistory.name}</span>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Allega documento', en: 'Attach document' })}</div>
                          <div className="mt-2 grid gap-2">
                            <input
                              value={docDraft.name}
                              disabled={deviceEditorReadOnly}
                              onChange={(e) => setDocDraft((prev) => ({ ...prev, name: e.target.value }))}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Nome documento', en: 'Document name' })}
                            />
                            <input
                              type="date"
                              value={docDraft.validUntil}
                              disabled={deviceEditorReadOnly}
                              onChange={(e) => setDocDraft((prev) => ({ ...prev, validUntil: e.target.value }))}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                            <textarea
                              value={docDraft.notes}
                              disabled={deviceEditorReadOnly}
                              onChange={(e) => setDocDraft((prev) => ({ ...prev, notes: e.target.value }))}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              rows={2}
                              placeholder={t({ it: 'Note documento', en: 'Document notes' })}
                            />
                            <label className={`relative inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold ${
                              deviceEditorReadOnly ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'cursor-pointer bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}>
                              {docDraft.fileName || t({ it: 'Carica PDF', en: 'Upload PDF' })}
                              <input
                                type="file"
                                accept={uploadMimes.pdf.join(',')}
                                disabled={deviceEditorReadOnly}
                                onChange={(e) => {
                                  void appendDeviceDocument(e.target.files);
                                  e.currentTarget.value = '';
                                }}
                                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                              />
                            </label>
                            <div className="text-[11px] text-slate-500">
                              {t({
                                it: `Formato accettato: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`,
                                en: `Accepted format: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Aggiungi verifica', en: 'Add check' })}</div>
                          <div className="mt-2 grid gap-2">
                            <input
                              type="date"
                              value={checkDraft.date}
                              disabled={deviceEditorReadOnly}
                              onChange={(e) => setCheckDraft((prev) => ({ ...prev, date: e.target.value }))}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                            <input
                              value={checkDraft.company}
                              disabled={deviceEditorReadOnly}
                              onChange={(e) => setCheckDraft((prev) => ({ ...prev, company: e.target.value }))}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Azienda verifica', en: 'Verifier company' })}
                            />
                            <textarea
                              value={checkDraft.notes}
                              disabled={deviceEditorReadOnly}
                              onChange={(e) => setCheckDraft((prev) => ({ ...prev, notes: e.target.value }))}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              rows={2}
                              placeholder={t({ it: 'Note verifica', en: 'Check notes' })}
                            />
                          </div>
                        </div>
                      </div>
                      {editorError ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{editorError}</div> : null}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={saveDeviceHistory}
                          disabled={deviceEditorReadOnly}
                          className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t({ it: 'Salva aggiornamenti', en: 'Save updates' })}
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Documenti', en: 'Documents' })}</div>
                          {(deviceHistory.securityDocuments || []).length ? (
                            <div className="space-y-2">
                              {(deviceHistory.securityDocuments || []).map((doc) => (
                                <div key={doc.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                                  <div className="font-semibold">{doc.name}</div>
                                  <div className="text-slate-500">
                                    {(doc.fileName || 'PDF')}{doc.validUntil ? ` · ${doc.validUntil}` : ''}
                                  </div>
                                  {doc.notes ? <div className="mt-1 text-slate-600">{doc.notes}</div> : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                              {t({ it: 'Nessun documento allegato.', en: 'No attached documents.' })}
                            </div>
                          )}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Storico revisioni', en: 'Check history' })}</div>
                          {(deviceHistory.securityCheckHistory || []).length ? (
                            <div className="space-y-2">
                              {(deviceHistory.securityCheckHistory || [])
                                .slice()
                                .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
                                .map((entry) => (
                                  <div key={entry.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                                    <div className="font-semibold">{entry.company || '—'}</div>
                                    <div className="text-slate-500">{entry.date || '—'}</div>
                                    {entry.notes ? <div className="mt-1 text-slate-600">{entry.notes}</div> : null}
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                              {t({ it: 'Nessuna revisione registrata.', en: 'No checks recorded.' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!doorHistory} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDoorHistory(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Storico check porta emergenza', en: 'Emergency door checks history' })}</Dialog.Title>
                    <button onClick={() => setDoorHistory(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  {doorHistory ? (
                    <>
                      <div className="mt-2 text-xs text-slate-600">
                        {doorHistory.clientName} · {doorHistory.siteName} · {doorHistory.planName} · {t({ it: 'Porta', en: 'Door' })}: <span className="font-mono">{doorHistory.doorId}</span>
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <input
                            type="date"
                            value={checkDraft.date}
                            disabled={doorEditorReadOnly}
                            onChange={(e) => setCheckDraft((prev) => ({ ...prev, date: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                          <input
                            value={checkDraft.company}
                            disabled={doorEditorReadOnly}
                            onChange={(e) => setCheckDraft((prev) => ({ ...prev, company: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Azienda verifica', en: 'Verifier company' })}
                          />
                          <button
                            onClick={saveDoorHistoryCheck}
                            disabled={doorEditorReadOnly}
                            className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t({ it: 'Aggiungi check', en: 'Add check' })}
                          </button>
                          <textarea
                            value={checkDraft.notes}
                            disabled={doorEditorReadOnly}
                            onChange={(e) => setCheckDraft((prev) => ({ ...prev, notes: e.target.value }))}
                            className="sm:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            rows={2}
                            placeholder={t({ it: 'Note', en: 'Notes' })}
                          />
                        </div>
                      </div>
                      <div className="mt-3 max-h-[52vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
                        {(doorHistory.verificationHistory || []).length ? (
                          <div className="divide-y divide-slate-100">
                            {(doorHistory.verificationHistory || [])
                              .slice()
                              .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
                              .map((entry) => (
                                <div key={entry.id} className="px-4 py-3">
                                  <div className="text-sm font-semibold text-ink">{entry.company || '—'}</div>
                                  <div className="mt-1 text-xs text-slate-600">{entry.date || '—'}</div>
                                  {entry.notes ? <div className="mt-1 text-xs text-slate-600">{entry.notes}</div> : null}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="px-4 py-6 text-sm text-slate-500">
                            {t({ it: 'Nessun check registrato per questa porta.', en: 'No checks registered for this door.' })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default SafetyPanel;
