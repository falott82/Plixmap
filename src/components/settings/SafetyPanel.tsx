import { Fragment, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowDown, ArrowUp, ArrowUpDown, Crosshair, Download, ExternalLink, History, Search, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useDataStore } from '../../store/useDataStore';
import { useLang, useT } from '../../i18n/useT';
import { Corridor, FloorPlan, Room, SecurityCheckEntry, SecurityDocumentEntry } from '../../store/types';
import Icon from '../ui/Icon';
import { isSecurityTypeId } from '../../store/security';
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
  const [safetySort, setSafetySort] = useState<{ key: SafetySortKey; dir: 'asc' | 'desc' }>({ key: 'clientName', dir: 'asc' });
  const [doorSort, setDoorSort] = useState<{ key: DoorSortKey; dir: 'asc' | 'desc' }>({ key: 'clientName', dir: 'asc' });
  const [mapPreview, setMapPreview] = useState<{ kind: 'device'; row: SafetyRow } | { kind: 'door'; row: EmergencyDoorRow } | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<SafetyRow | null>(null);
  const [doorHistory, setDoorHistory] = useState<EmergencyDoorRow | null>(null);
  const [docDraft, setDocDraft] = useState<{ name: string; validUntil: string; notes: string; fileName?: string; dataUrl?: string }>({
    name: '',
    validUntil: '',
    notes: ''
  });
  const [checkDraft, setCheckDraft] = useState<{ date: string; company: string; notes: string }>({ date: '', company: '', notes: '' });
  const [editorError, setEditorError] = useState('');
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

  const filteredSafetyRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = term
      ? safetyRowsRaw.filter((row) =>
          `${row.clientName} ${row.siteName} ${row.planName} ${row.typeLabel} ${row.name} ${row.description} ${row.notes} ${row.lastVerificationAt} ${row.locationName}`
            .toLowerCase()
            .includes(term)
        )
      : safetyRowsRaw.slice();
    rows.sort((a, b) => {
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
    return rows;
  }, [lang, q, safetyRowsRaw, safetySort.dir, safetySort.key]);

  const filteredDoorRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = term
      ? emergencyDoorRowsRaw.filter((row) =>
          `${row.clientName} ${row.siteName} ${row.planName} ${row.doorId} ${row.description} ${row.doorType} ${row.corridorName} ${row.nearestRoomName} ${row.lastVerificationAt} ${row.verifierCompany}`
            .toLowerCase()
            .includes(term)
        )
      : emergencyDoorRowsRaw.slice();
    rows.sort((a, b) => {
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
    return rows;
  }, [doorSort.dir, doorSort.key, emergencyDoorRowsRaw, lang, q]);

  const mapData = useMemo(() => {
    if (!mapPreview) return null;
    const plan = mapPreview.row.plan;
    const corridors = ((plan?.corridors || []) as Corridor[]).map((corridor) => ({ corridor, points: corridorPolygon(corridor) })).filter((entry) => entry.points.length >= 3);
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
      viewBox: `${minX - pad} ${minY - pad} ${Math.max(100, maxX - minX + pad * 2)} ${Math.max(100, maxY - minY + pad * 2)}`
    };
  }, [mapPreview]);

  const exportCsv = (type: 'devices' | 'doors') => {
    const rows = type === 'devices' ? filteredSafetyRows : filteredDoorRows;
    if (!rows.length) return;
    const header =
      type === 'devices'
        ? ['Cliente', 'Sede', 'Planimetria', 'Tipo oggetto', 'Nome', 'Descrizione', 'Note', 'Ultima revisione', 'Azienda verifica', 'Ufficio/Corridoio', 'GPS']
        : ['Cliente', 'Sede', 'Planimetria', 'ID porta', 'Descrizione', 'Tipo porta', 'Tag', 'Ultima revisione', 'Azienda verifica', 'Corridoio', 'Ufficio vicino'];
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
              row.doorId,
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

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
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
            onClick={() => exportCsv('devices')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} />
            {t({ it: 'Export dispositivi', en: 'Export devices' })}
          </button>
          <button
            type="button"
            onClick={() => exportCsv('doors')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} />
            {t({ it: 'Export porte', en: 'Export doors' })}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
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
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {t({ it: 'Dispositivi sicurezza', en: 'Safety devices' })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1700px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
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
                  <td colSpan={11} className="px-3 py-6 text-center text-sm text-slate-500">
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
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => setDoorSort((prev) => ({ key: 'doorId', dir: prev.key === 'doorId' && prev.dir === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-1">
                    {t({ it: 'ID porta', en: 'Door ID' })} {toggleSortIcon(doorSort.key === 'doorId', doorSort.dir)}
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
                      <td className="px-3 py-2 font-semibold text-ink">{row.clientName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.siteName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.planName || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.doorId || '—'}</td>
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
                          {row.openUrl ? (
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
        <Dialog as="div" className="relative z-50" onClose={() => setMapPreview(null)}>
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
                    <button onClick={() => setMapPreview(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  {mapPreview ? (
                    <>
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="font-semibold">{mapPreview.row.clientName}</span> · <span className="font-semibold">{mapPreview.row.siteName}</span> ·{' '}
                        <span className="font-semibold">{mapPreview.row.planName}</span>
                      </div>
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <svg viewBox={mapData?.viewBox || '0 0 100 100'} className="h-[68vh] w-full">
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
                            return (
                              <circle
                                key={`d-${entry.corridorId}-${entry.door.id}`}
                                cx={entry.point.x}
                                cy={entry.point.y}
                                r={selectedDoor ? 6.5 : 4.5}
                                fill={selectedDoor ? '#f97316' : '#334155'}
                                stroke={selectedDoor ? '#7c2d12' : '#ffffff'}
                                strokeWidth={2}
                              />
                            );
                          })}
                          {mapPreview.kind === 'device' ? (
                            <>
                              <circle cx={mapPreview.row.point.x} cy={mapPreview.row.point.y} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth={2.2} />
                              <circle cx={mapPreview.row.point.x} cy={mapPreview.row.point.y} r={13} fill="none" stroke="#ef4444" strokeWidth={1.4} strokeDasharray="4 4" />
                            </>
                          ) : null}
                        </svg>
                      </div>
                    </>
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
