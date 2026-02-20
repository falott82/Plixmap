import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Building2, Download, FileText, LocateFixed, MapPinned, Users, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { Client, FloorPlan, MapObject, Room } from '../../store/types';
import { buildCapacityMetrics, findCapacityClientMetric, findCapacitySiteMetric } from '../../utils/capacityMetrics';
import { isNonPeopleRoom } from '../../utils/roomProperties';

type Point = { x: number; y: number };

interface Props {
  open: boolean;
  clients: Client[];
  departmentOptions?: string[];
  currentClientId?: string | null;
  currentSiteId?: string | null;
  onHighlight: (payload: { planId: string; roomId: string }) => void;
  onClose: () => void;
}

const USER_TYPE_SET = new Set(['user', 'real_user', 'generic_user']);
const isUserObject = (obj: MapObject | null | undefined) => USER_TYPE_SET.has(String(obj?.type || ''));

const normalizeLabel = (value: unknown) => String(value || '').trim();

const normalizeTagList = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const value = normalizeLabel(raw);
    if (!value) continue;
    const folded = value.toLocaleLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(value);
  }
  return out;
};

const collectObjectDepartments = (obj: MapObject): string[] =>
  normalizeTagList([(obj as any).externalDept1, (obj as any).externalDept2, (obj as any).externalDept3]);

const roomPolygon = (room: Room): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (points.length >= 3) return points;
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const width = Number(room?.width || 0);
  const height = Number(room?.height || 0);
  if (!(width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

const polygonCentroid = (polygon: Point[]) => {
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
  if (Math.abs(area2) < 0.000001) {
    const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
};

const formatDistanceLabel = (meters: number | null, px: number | null) => {
  if (meters !== null && Number.isFinite(meters)) {
    if (meters >= 100) return `${Math.round(meters)} m`;
    return `${meters.toFixed(1)} m`;
  }
  if (px !== null && Number.isFinite(px)) return `${px.toFixed(1)} px`;
  return '--';
};

const yesNoLabel = (value: boolean, t: ReturnType<typeof useT>) => (value ? t({ it: 'Sì', en: 'Yes' }) : t({ it: 'No', en: 'No' }));

const YesNoToggle = ({
  label,
  value,
  onChange,
  yesLabel,
  noLabel
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  yesLabel: string;
  noLabel: string;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
    <div className="text-xs font-semibold text-slate-600">{label}</div>
    <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${value ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${!value ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
      >
        {noLabel}
      </button>
    </div>
  </div>
);

type RichRoomCandidate = {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  roomId: string;
  roomName: string;
  capacity: number;
  userCount: number;
  freeSeats: number;
  overCapacity: boolean;
  departmentTags: string[];
  occupants: string[];
  point: Point | null;
  isEmptyRoom: boolean;
  matchesDepartment: boolean;
  isMeetingRoom: boolean;
  isNonPeopleRoom: boolean;
};

type RoomPreviewSelection = {
  clientName: string;
  siteName: string;
  targetPlanName: string;
  targetPlanId: string;
  targetRoomId: string;
  sourcePlanName?: string;
  sourcePlanId?: string;
  sourceRoomId?: string;
};

type PlanPreviewData = {
  kind: 'source' | 'target';
  planId: string;
  planName: string;
  focusRoomId: string;
  planImageUrl: string;
  roomEntries: Array<{ room: Room; polygon: Point[]; centroid: Point | null }>;
  userObjects: MapObject[];
  minX: number;
  minY: number;
  viewWidth: number;
  viewHeight: number;
};

const buildPlanPreviewData = (
  plan: FloorPlan,
  focusRoomId: string,
  kind: 'source' | 'target'
): PlanPreviewData => {
  const roomEntries = ((plan.rooms || []) as Room[])
    .map((room) => {
      const polygon = roomPolygon(room);
      if (!polygon.length) return null;
      return {
        room,
        polygon,
        centroid: polygonCentroid(polygon)
      };
    })
    .filter(Boolean) as Array<{ room: Room; polygon: Point[]; centroid: Point | null }>;
  const userObjects = ((plan.objects || []) as MapObject[]).filter((obj) => isUserObject(obj));

  const planWidth = Number(plan.width || 0);
  const planHeight = Number(plan.height || 0);
  if (planWidth > 0 && planHeight > 0) {
    return {
      kind,
      planId: String(plan.id),
      planName: normalizeLabel(plan.name) || String(plan.id),
      focusRoomId: String(focusRoomId || '').trim(),
      planImageUrl: String(plan.imageUrl || ''),
      roomEntries,
      userObjects,
      minX: 0,
      minY: 0,
      viewWidth: planWidth,
      viewHeight: planHeight
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entry of roomEntries) {
    for (const point of entry.polygon) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  for (const obj of userObjects) {
    const x = Number(obj.x);
    const y = Number(obj.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = 1200;
    maxY = 700;
  }
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const padding = Math.max(26, Math.round(Math.max(contentWidth, contentHeight) * 0.05));
  return {
    kind,
    planId: String(plan.id),
    planName: normalizeLabel(plan.name) || String(plan.id),
    focusRoomId: String(focusRoomId || '').trim(),
    planImageUrl: String(plan.imageUrl || ''),
    roomEntries,
    userObjects,
    minX: minX - padding,
    minY: minY - padding,
    viewWidth: contentWidth + padding * 2,
    viewHeight: contentHeight + padding * 2
  };
};

const RoomAllocationModal = ({ open, clients, departmentOptions, currentClientId, currentSiteId, onHighlight, onClose }: Props) => {
  const t = useT();
  const [requested, setRequested] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [searchAlternatives, setSearchAlternatives] = useState(false);
  const [includeEmptyOffices, setIncludeEmptyOffices] = useState(false);
  const [includeOtherDepartments, setIncludeOtherDepartments] = useState(false);
  const [includeMeetingRooms, setIncludeMeetingRooms] = useState(false);
  const [previewSelection, setPreviewSelection] = useState<RoomPreviewSelection | null>(null);
  const [allocationReportOpen, setAllocationReportOpen] = useState(false);
  const [allocationPdfBusy, setAllocationPdfBusy] = useState(false);
  const [computeRouteFn, setComputeRouteFn] = useState<
    | ((
        plans: FloorPlan[],
        startPlanId: string,
        destinationPlanId: string,
        startPoint: Point,
        destinationPoint: Point,
        options?: any
      ) => { result?: { distancePx: number; distanceMeters?: number }; error?: string })
    | null
  >(null);

  const summary = useMemo(() => buildCapacityMetrics(clients || []), [clients]);
  const distanceCacheRef = useRef<Map<string, { meters: number | null; px: number | null }>>(new Map());
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewGoRef = useRef<HTMLButtonElement | null>(null);
  const reportCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setRequested('');
    setSelectedDepartments([]);
    setDepartmentSearch('');
    setSearchAlternatives(false);
    setIncludeEmptyOffices(false);
    setIncludeOtherDepartments(false);
    setIncludeMeetingRooms(false);
    setPreviewSelection(null);
    setAllocationReportOpen(false);
    setAllocationPdfBusy(false);
    distanceCacheRef.current.clear();
    const preferredClient = String(currentClientId || '').trim();
    const firstClient = summary.clients[0]?.clientId || '';
    const nextClientId = summary.clients.some((entry) => entry.clientId === preferredClient) ? preferredClient : firstClient;
    setSelectedClientId(nextClientId);
    const preferredSite = String(currentSiteId || '').trim();
    const candidateClient = summary.clients.find((entry) => entry.clientId === nextClientId);
    const firstSite = candidateClient?.sites?.[0]?.siteId || '';
    const nextSiteId = candidateClient?.sites?.some((entry) => entry.siteId === preferredSite) ? preferredSite : firstSite;
    setSelectedSiteId(nextSiteId);
  }, [currentClientId, currentSiteId, open, summary.clients]);

  const selectedClient = useMemo(() => findCapacityClientMetric(summary, selectedClientId) || null, [selectedClientId, summary]);

  useEffect(() => {
    if (!selectedClient) return;
    if (selectedClientId !== selectedClient.clientId) setSelectedClientId(selectedClient.clientId);
    if (selectedClient.sites.some((entry) => entry.siteId === selectedSiteId)) return;
    setSelectedSiteId(selectedClient.sites[0]?.siteId || '');
  }, [selectedClient, selectedClientId, selectedSiteId]);

  const selectedSite = useMemo(() => findCapacitySiteMetric(selectedClient, selectedSiteId) || null, [selectedClient, selectedSiteId]);
  const selectedClientRaw = useMemo(() => (clients || []).find((entry) => entry.id === selectedClientId) || null, [clients, selectedClientId]);
  const selectedSiteRaw = useMemo(
    () => selectedClientRaw?.sites?.find((entry) => entry.id === selectedSiteId) || null,
    [selectedClientRaw, selectedSiteId]
  );

  const requestedCount = Math.max(0, Math.floor(Number(requested) || 0));
  const selectedDepartmentNorms = useMemo(
    () =>
      selectedDepartments
        .map((entry) => String(entry || '').trim().toLocaleLowerCase())
        .filter(Boolean)
        .filter((entry, index, list) => list.indexOf(entry) === index),
    [selectedDepartments]
  );
  const selectedDepartmentSet = useMemo(() => new Set(selectedDepartmentNorms), [selectedDepartmentNorms]);
  const hasDepartmentFilter = selectedDepartmentSet.size > 0;

  const availableDepartments = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const addDepartment = (value: unknown) => {
      const label = normalizeLabel(value);
      if (!label) return;
      const folded = label.toLocaleLowerCase();
      if (seen.has(folded)) return;
      seen.add(folded);
      out.push(label);
    };

    for (const dept of selectedSite?.departmentPool || []) addDepartment(dept);
    for (const dept of selectedClient?.departmentPool || []) addDepartment(dept);
    for (const dept of departmentOptions || []) addDepartment(dept);

    for (const site of selectedClientRaw?.sites || []) {
      for (const plan of site.floorPlans || []) {
        for (const room of (plan.rooms || []) as Room[]) {
          for (const tag of normalizeTagList((room as any)?.departmentTags || [])) addDepartment(tag);
        }
        for (const obj of (plan.objects || []) as MapObject[]) {
          if (!isUserObject(obj)) continue;
          for (const dept of collectObjectDepartments(obj)) addDepartment(dept);
        }
      }
    }

    return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [departmentOptions, selectedClient?.departmentPool, selectedClientRaw?.sites, selectedSite?.departmentPool]);

  useEffect(() => {
    if (!searchAlternatives) {
      setIncludeEmptyOffices(false);
      setIncludeOtherDepartments(false);
      setIncludeMeetingRooms(false);
    }
  }, [searchAlternatives]);

  useEffect(() => {
    const availableSet = new Set(availableDepartments.map((entry) => entry.toLocaleLowerCase()));
    setSelectedDepartments((prev) => prev.filter((entry) => availableSet.has(String(entry || '').trim().toLocaleLowerCase())));
  }, [availableDepartments]);

  const filteredDepartments = useMemo(() => {
    const query = String(departmentSearch || '').trim().toLocaleLowerCase();
    if (!query) return availableDepartments;
    return availableDepartments.filter((entry) => entry.toLocaleLowerCase().includes(query));
  }, [availableDepartments, departmentSearch]);

  const roomCandidates = useMemo(() => {
    if (!selectedSiteRaw || !selectedClientRaw) return [] as RichRoomCandidate[];
    const siteName = normalizeLabel(selectedSiteRaw.name) || selectedSiteRaw.id;
    const clientName = normalizeLabel(selectedClientRaw.shortName) || normalizeLabel(selectedClientRaw.name) || selectedClientRaw.id;
    const out: RichRoomCandidate[] = [];

    for (const plan of (selectedSiteRaw.floorPlans || []) as FloorPlan[]) {
      const planName = normalizeLabel(plan.name) || plan.id;
      const roomUserMap = new Map<string, { count: number; departments: string[]; occupants: string[] }>();
      for (const obj of (plan.objects || []) as MapObject[]) {
        const roomId = String((obj as any)?.roomId || '').trim();
        if (!roomId || !isUserObject(obj)) continue;
        const current = roomUserMap.get(roomId) || { count: 0, departments: [] as string[], occupants: [] as string[] };
        current.count += 1;
        const displayName =
          String(`${String((obj as any)?.firstName || '').trim()} ${String((obj as any)?.lastName || '').trim()}`).trim() ||
          String(obj.name || '').trim() ||
          String(obj.id || '').trim();
        if (displayName) current.occupants.push(displayName);
        for (const dept of collectObjectDepartments(obj)) {
          if (!current.departments.some((entry) => entry.toLocaleLowerCase() === dept.toLocaleLowerCase())) {
            current.departments.push(dept);
          }
        }
        roomUserMap.set(roomId, current);
      }

      for (const room of (plan.rooms || []) as Room[]) {
        const roomId = String(room?.id || '').trim();
        if (!roomId) continue;
        const roomName = normalizeLabel((room as any)?.nameEn) || normalizeLabel(room.name) || roomId;
        const capacity = Number.isFinite(Number((room as any)?.capacity)) ? Math.max(0, Math.floor(Number((room as any)?.capacity))) : 0;
        const stats = roomUserMap.get(roomId);
        const userCount = Number(stats?.count || 0);
        const freeSeats = Math.max(0, capacity - userCount);
        const polygon = roomPolygon(room);
        const point = polygon.length ? polygonCentroid(polygon) : null;
        const departmentTags = normalizeTagList([...(room as any)?.departmentTags || [], ...(stats?.departments || [])]);
        const matchesDepartment = !hasDepartmentFilter || departmentTags.some((entry) => selectedDepartmentSet.has(entry.toLocaleLowerCase()));
        const isMeetingRoom = !!(room as any)?.meetingRoom;
        const roomBlockedForPeople = isNonPeopleRoom(room);

        out.push({
          clientId: selectedClientRaw.id,
          clientName,
          siteId: selectedSiteRaw.id,
          siteName,
          planId: plan.id,
          planName,
          roomId,
          roomName,
          capacity,
          userCount,
          freeSeats,
          overCapacity: userCount > capacity,
          departmentTags,
          occupants: (stats?.occupants || []).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          point,
          isEmptyRoom: userCount === 0,
          matchesDepartment,
          isMeetingRoom,
          isNonPeopleRoom: roomBlockedForPeople
        });
      }
    }

    return out.sort((a, b) => {
      if (a.planName !== b.planName) return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
      return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
    });
  }, [hasDepartmentFilter, selectedClientRaw, selectedDepartmentSet, selectedSiteRaw]);

  const eligibleRoomCandidates = useMemo(
    () => roomCandidates.filter((room) => !room.isNonPeopleRoom && (includeMeetingRooms ? true : !room.isMeetingRoom)),
    [includeMeetingRooms, roomCandidates]
  );

  const directCandidates = useMemo(() => {
    if (!requestedCount) return [] as RichRoomCandidate[];
    return eligibleRoomCandidates
      .filter((room) => room.matchesDepartment && room.freeSeats >= requestedCount)
      .sort((a, b) => {
        const aFit = a.freeSeats - requestedCount;
        const bFit = b.freeSeats - requestedCount;
        if (aFit !== bFit) return aFit - bFit;
        if (a.planName !== b.planName) return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
        return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
      });
  }, [eligibleRoomCandidates, requestedCount]);

  const departmentRooms = useMemo(
    () => eligibleRoomCandidates.filter((room) => room.matchesDepartment),
    [eligibleRoomCandidates]
  );

  const bestDepartmentRoom = useMemo(() => {
    if (!departmentRooms.length) return null;
    return [...departmentRooms].sort((a, b) => {
      if (a.freeSeats !== b.freeSeats) return b.freeSeats - a.freeSeats;
      if (a.userCount !== b.userCount) return a.userCount - b.userCount;
      if (a.planName !== b.planName) return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
      return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
    })[0];
  }, [departmentRooms]);

  const insufficiencyInfo = useMemo(() => {
    if (!hasDepartmentFilter || !requestedCount || directCandidates.length || !bestDepartmentRoom) return null;
    if (bestDepartmentRoom.freeSeats >= requestedCount) return null;
    return {
      roomName: bestDepartmentRoom.roomName,
      availableSeats: bestDepartmentRoom.freeSeats,
      requested: requestedCount
    };
  }, [bestDepartmentRoom, directCandidates.length, hasDepartmentFilter, requestedCount]);

  const sitePlans = useMemo(() => ((selectedSiteRaw?.floorPlans || []) as FloorPlan[]).filter(Boolean), [selectedSiteRaw?.floorPlans]);
  const shouldLoadRoutes =
    open && requestedCount > 0 && searchAlternatives && (includeEmptyOffices || includeOtherDepartments || includeMeetingRooms);

  useEffect(() => {
    if (!shouldLoadRoutes || computeRouteFn) return;
    let active = true;
    void import('./InternalMapModal')
      .then((module) => {
        if (!active) return;
        setComputeRouteFn(() => module.computeMultiFloorRoute as any);
      })
      .catch(() => {
        if (!active) return;
        setComputeRouteFn(null);
      });
    return () => {
      active = false;
    };
  }, [computeRouteFn, shouldLoadRoutes]);

  const averageMetersPerPixel = useMemo(() => {
    const valid = sitePlans
      .map((plan) => Number(plan?.scale?.metersPerPixel))
      .filter((value) => Number.isFinite(value) && value > 0) as number[];
    if (!valid.length) return 0;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }, [sitePlans]);

  const distanceFromAnchor = useMemo(() => {
    const anchor = bestDepartmentRoom;
    const out = new Map<string, { meters: number | null; px: number | null }>();
    if (!anchor || !anchor.point || !sitePlans.length) return out;
    for (const room of eligibleRoomCandidates) {
      if (!room.point) continue;
      if (room.roomId === anchor.roomId && room.planId === anchor.planId) {
        out.set(`${room.planId}:${room.roomId}`, { meters: 0, px: 0 });
        continue;
      }
      const key = `${anchor.planId}:${anchor.roomId}->${room.planId}:${room.roomId}`;
      const cached = distanceCacheRef.current.get(key);
      if (cached) {
        out.set(`${room.planId}:${room.roomId}`, cached);
        continue;
      }
      const computed = computeRouteFn
        ? computeRouteFn(sitePlans, anchor.planId, room.planId, anchor.point, room.point)
        : { result: undefined, error: 'not-loaded' };
      let meters: number | null = null;
      let px: number | null = null;
      if (computed.result) {
        px = Number.isFinite(Number(computed.result.distancePx)) ? Number(computed.result.distancePx) : null;
        meters =
          typeof computed.result.distanceMeters === 'number' && Number.isFinite(computed.result.distanceMeters)
            ? Number(computed.result.distanceMeters)
            : null;
      } else if (anchor.planId === room.planId) {
        px = Math.hypot(room.point.x - anchor.point.x, room.point.y - anchor.point.y);
      } else {
        const straight = Math.hypot(room.point.x - anchor.point.x, room.point.y - anchor.point.y);
        // Fallback before route engine is loaded: add a floor penalty.
        px = straight + 450;
      }
      if (meters === null && px !== null && averageMetersPerPixel > 0) {
        meters = px * averageMetersPerPixel;
      }
      const value = { meters, px };
      distanceCacheRef.current.set(key, value);
      out.set(`${room.planId}:${room.roomId}`, value);
    }
    return out;
  }, [averageMetersPerPixel, bestDepartmentRoom, computeRouteFn, eligibleRoomCandidates, sitePlans]);

  const samePlanEmptyCandidates = useMemo(() => {
    if (!bestDepartmentRoom) return [] as RichRoomCandidate[];
    return eligibleRoomCandidates.filter(
      (room) =>
        room.planId === bestDepartmentRoom.planId &&
        room.roomId !== bestDepartmentRoom.roomId &&
        room.isEmptyRoom &&
        room.freeSeats > 0
    );
  }, [bestDepartmentRoom, eligibleRoomCandidates]);

  const alternativeCandidates = useMemo(() => {
    if (!requestedCount || !searchAlternatives)
      return [] as Array<RichRoomCandidate & { distanceMeters: number | null; distancePx: number | null; source: 'empty' | 'other' | 'meeting' }>;

    const pool: Array<RichRoomCandidate & { source: 'empty' | 'other' | 'meeting' }> = [];
    if (includeEmptyOffices) {
      const allEmpty = eligibleRoomCandidates.filter((room) => room.isEmptyRoom && room.freeSeats > 0);
      const emptyPool = samePlanEmptyCandidates.length ? samePlanEmptyCandidates : allEmpty;
      for (const room of emptyPool) pool.push({ ...room, source: 'empty' });
    }
    if (includeOtherDepartments) {
      for (const room of eligibleRoomCandidates.filter((entry) => !entry.matchesDepartment && entry.freeSeats > 0)) {
        pool.push({ ...room, source: 'other' });
      }
    }
    if (includeMeetingRooms) {
      for (const room of eligibleRoomCandidates.filter((entry) => entry.isMeetingRoom && entry.freeSeats > 0)) {
        pool.push({ ...room, source: 'meeting' });
      }
    }

    const deduped = new Map<string, RichRoomCandidate & { source: 'empty' | 'other' | 'meeting' }>();
    for (const room of pool) {
      const key = `${room.planId}:${room.roomId}`;
      if (!deduped.has(key)) deduped.set(key, room);
    }

    return [...deduped.values()]
      .map((room) => {
        const distance = distanceFromAnchor.get(`${room.planId}:${room.roomId}`) || { meters: null, px: null };
        return {
          ...room,
          distanceMeters: distance.meters,
          distancePx: distance.px
        };
      })
      .sort((a, b) => {
        const aDist = a.distanceMeters ?? Number.POSITIVE_INFINITY;
        const bDist = b.distanceMeters ?? Number.POSITIVE_INFINITY;
        if (aDist !== bDist) return aDist - bDist;
        const aPx = a.distancePx ?? Number.POSITIVE_INFINITY;
        const bPx = b.distancePx ?? Number.POSITIVE_INFINITY;
        if (aPx !== bPx) return aPx - bPx;
        if (a.freeSeats !== b.freeSeats) return b.freeSeats - a.freeSeats;
        if (a.source !== b.source) {
          const priority = { meeting: 0, empty: 1, other: 2 } as const;
          return priority[a.source] - priority[b.source];
        }
        if (a.planName !== b.planName) return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
        return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
      });
  }, [
    distanceFromAnchor,
    eligibleRoomCandidates,
    includeEmptyOffices,
    includeMeetingRooms,
    includeOtherDepartments,
    requestedCount,
    samePlanEmptyCandidates,
    searchAlternatives
  ]);

  const displayedCandidates = useMemo(() => {
    if (!searchAlternatives) return directCandidates.map((room) => ({ ...room, distanceMeters: null, distancePx: null, source: 'direct' as const }));
    const seen = new Set<string>();
    const out: Array<
      RichRoomCandidate & { distanceMeters: number | null; distancePx: number | null; source: 'direct' | 'empty' | 'other' | 'meeting' }
    > = [];
    for (const room of directCandidates) {
      const key = `${room.planId}:${room.roomId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...room, distanceMeters: null, distancePx: null, source: 'direct' });
    }
    for (const room of alternativeCandidates) {
      const key = `${room.planId}:${room.roomId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(room);
    }
    return out;
  }, [alternativeCandidates, directCandidates, searchAlternatives]);

  const allocationSummary = useMemo(() => {
    if (!requestedCount) return null;
    const roomKey = (room: RichRoomCandidate) => `${room.planId}:${room.roomId}`;
    const toDistanceScore = (room: RichRoomCandidate) => {
      const entry = distanceFromAnchor.get(roomKey(room));
      if (entry?.meters !== null && Number.isFinite(entry?.meters)) return entry!.meters as number;
      if (entry?.px !== null && Number.isFinite(entry?.px)) return (entry!.px as number) * 1000;
      return Number.POSITIVE_INFINITY;
    };

    const primaryPool = departmentRooms
      .filter((room) => room.freeSeats > 0)
      .slice()
      .sort((a, b) => {
        if (a.freeSeats !== b.freeSeats) return b.freeSeats - a.freeSeats;
        const aDist = toDistanceScore(a);
        const bDist = toDistanceScore(b);
        if (aDist !== bDist) return aDist - bDist;
        if (a.planName !== b.planName) return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
        return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
      });

    let fallbackPool: RichRoomCandidate[] = [];
    if (searchAlternatives) {
      if (includeEmptyOffices) {
        fallbackPool = fallbackPool.concat(eligibleRoomCandidates.filter((room) => room.isEmptyRoom && room.freeSeats > 0));
      }
      if (includeOtherDepartments) {
        fallbackPool = fallbackPool.concat(eligibleRoomCandidates.filter((room) => !room.matchesDepartment && room.freeSeats > 0));
      }
      if (includeMeetingRooms) {
        fallbackPool = fallbackPool.concat(eligibleRoomCandidates.filter((room) => room.isMeetingRoom && room.freeSeats > 0));
      }
    }
    fallbackPool = fallbackPool.filter(
      (room, index, list) => list.findIndex((candidate) => candidate.planId === room.planId && candidate.roomId === room.roomId) === index
    );

    fallbackPool = fallbackPool
      .slice()
      .sort((a, b) => {
        const aDist = toDistanceScore(a);
        const bDist = toDistanceScore(b);
        if (aDist !== bDist) return aDist - bDist;
        if (a.freeSeats !== b.freeSeats) return b.freeSeats - a.freeSeats;
        if (a.planName !== b.planName) return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
        return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
      });

    const used = new Set<string>();
    let remaining = requestedCount;
    const allocations: Array<{ room: string; seats: number }> = [];

    for (const room of primaryPool) {
      const seats = Math.min(remaining, Math.max(0, room.freeSeats));
      if (seats <= 0) continue;
      allocations.push({ room: room.roomName, seats });
      used.add(roomKey(room));
      remaining -= seats;
      if (remaining <= 0) break;
    }

    if (remaining > 0 && fallbackPool.length) {
      const fallbackCandidates = fallbackPool.filter((room) => !used.has(roomKey(room)));
      const singleFit = fallbackCandidates
        .filter((room) => room.freeSeats >= remaining)
        .sort((a, b) => {
          if (a.freeSeats !== b.freeSeats) return a.freeSeats - b.freeSeats;
          const aDist = toDistanceScore(a);
          const bDist = toDistanceScore(b);
          if (aDist !== bDist) return aDist - bDist;
          return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
        })[0];

      if (singleFit) {
        allocations.push({ room: singleFit.roomName, seats: remaining });
        used.add(roomKey(singleFit));
        remaining = 0;
      } else {
        const splitCandidates = fallbackCandidates
          .slice()
          .sort((a, b) => {
            if (a.freeSeats !== b.freeSeats) return b.freeSeats - a.freeSeats;
            const aDist = toDistanceScore(a);
            const bDist = toDistanceScore(b);
            if (aDist !== bDist) return aDist - bDist;
            return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
          });
        for (const room of splitCandidates) {
          const seats = Math.min(remaining, Math.max(0, room.freeSeats));
          if (seats <= 0) continue;
          allocations.push({ room: room.roomName, seats });
          used.add(roomKey(room));
          remaining -= seats;
          if (remaining <= 0) break;
        }
      }
    }

    if (!allocations.length) return null;
    return {
      requested: requestedCount,
      placed: requestedCount - Math.max(remaining, 0),
      remaining: Math.max(remaining, 0),
      allocations
    };
  }, [
    departmentRooms,
    distanceFromAnchor,
    eligibleRoomCandidates,
    includeEmptyOffices,
    includeMeetingRooms,
    includeOtherDepartments,
    requestedCount,
    searchAlternatives
  ]);

  const showCrossFloorEmptyHint =
    searchAlternatives &&
    includeEmptyOffices &&
    requestedCount > 0 &&
    samePlanEmptyCandidates.length === 0 &&
    alternativeCandidates.some((entry) => entry.source === 'empty');

  const previewPlans = useMemo(() => {
    if (!previewSelection || !selectedSiteRaw) return null;
    const plans = (selectedSiteRaw.floorPlans || []) as FloorPlan[];
    const byId = new Map(plans.map((plan) => [String(plan.id), plan]));
    const targetPlan = byId.get(String(previewSelection.targetPlanId || ''));
    if (!targetPlan) return null;
    const out: PlanPreviewData[] = [];

    const sourcePlanId = String(previewSelection.sourcePlanId || '').trim();
    const sourceRoomId = String(previewSelection.sourceRoomId || '').trim();
    if (sourcePlanId && sourceRoomId && sourcePlanId !== String(previewSelection.targetPlanId || '').trim()) {
      const sourcePlan = byId.get(sourcePlanId);
      if (sourcePlan) out.push(buildPlanPreviewData(sourcePlan, sourceRoomId, 'source'));
    }

    out.push(buildPlanPreviewData(targetPlan, String(previewSelection.targetRoomId || '').trim(), 'target'));
    return out;
  }, [previewSelection, selectedSiteRaw]);

  const hasChildDialogOpen = Boolean(previewSelection || allocationReportOpen);

  const handleMainDialogClose = () => {
    if (hasChildDialogOpen) return;
    onClose();
  };

  const handleGoToRoomFromPreview = () => {
    if (!previewSelection) return;
    const planId = String(previewSelection.targetPlanId || '').trim();
    const roomId = String(previewSelection.targetRoomId || '').trim();
    if (!planId || !roomId) return;
    setPreviewSelection(null);
    onHighlight({ planId, roomId });
    onClose();
  };

  const exportAllocationReportPdf = async () => {
    if (!allocationSummary) return;
    setAllocationPdfBusy(true);
    try {
      const jsPdfModule = await import('jspdf');
      const JsPDF = (jsPdfModule as any).default;
      const pdf = new JsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (height = 16) => {
        if (y + height <= pageHeight - margin) return;
        pdf.addPage();
        y = margin;
      };
      const writeLine = (text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number }) => {
        const size = options?.size ?? 10;
        const gap = options?.gap ?? 14;
        pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        const color = options?.color ?? [15, 23, 42];
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(String(text || ''), maxWidth);
        for (const line of lines) {
          ensureSpace(gap);
          pdf.text(line, margin, y);
          y += gap;
        }
      };
      const spacer = (size = 8) => {
        y += size;
        ensureSpace(12);
      };

      const nowLabel = new Date().toLocaleString();
      const departmentsLabel = selectedDepartments.length
        ? selectedDepartments.join(', ')
        : t({ it: 'Qualsiasi dipartimento', en: 'Any department' });

      writeLine('Plixmap — Placement Summary', { size: 16, bold: true, gap: 20 });
      writeLine(nowLabel, { size: 9, color: [100, 116, 139], gap: 12 });
      spacer(8);

      writeLine(t({ it: 'Contesto ricerca', en: 'Search context' }), { size: 12, bold: true, gap: 16 });
      writeLine(`${t({ it: 'Cliente', en: 'Client' })}: ${selectedClient?.clientName || '-'}`);
      writeLine(`${t({ it: 'Sede', en: 'Site' })}: ${selectedSite?.siteName || '-'}`);
      writeLine(`${t({ it: 'Dipartimenti', en: 'Departments' })}: ${departmentsLabel}`);
      writeLine(`${t({ it: 'Persone da collocare', en: 'People to place' })}: ${requestedCount}`);
      spacer(4);

      writeLine(t({ it: 'Opzioni alternative', en: 'Alternative options' }), { size: 12, bold: true, gap: 16 });
      writeLine(`${t({ it: 'Cerca alternativa', en: 'Search alternatives' })}: ${yesNoLabel(searchAlternatives, t)}`);
      writeLine(`${t({ it: 'Includi uffici vuoti', en: 'Include empty offices' })}: ${yesNoLabel(includeEmptyOffices, t)}`);
      writeLine(`${t({ it: 'Includi altri reparti', en: 'Include other departments' })}: ${yesNoLabel(includeOtherDepartments, t)}`);
      writeLine(`${t({ it: 'Includi meeting rooms', en: 'Include meeting rooms' })}: ${yesNoLabel(includeMeetingRooms, t)}`);
      spacer(4);

      writeLine(t({ it: 'Riepilogo consigliato', en: 'Suggested allocation summary' }), { size: 12, bold: true, gap: 16 });
      writeLine(
        allocationSummary.remaining > 0
          ? t({
              it: `Collocabili ${allocationSummary.placed}/${allocationSummary.requested}. Mancano ${allocationSummary.remaining}.`,
              en: `Plixmap can place ${allocationSummary.placed}/${allocationSummary.requested}. Missing ${allocationSummary.remaining}.`
            })
          : t({
              it: `Plixmap colloca tutte le ${allocationSummary.requested} persone.`,
              en: `Plixmap places all ${allocationSummary.requested} people.`
            })
      );
      for (const entry of allocationSummary.allocations) {
        writeLine(`• ${entry.room}: ${entry.seats}`, { size: 10 });
      }
      spacer(4);

      writeLine(t({ it: 'Opzioni candidate mostrate', en: 'Displayed candidate options' }), { size: 12, bold: true, gap: 16 });
      if (!displayedCandidates.length) {
        writeLine(t({ it: 'Nessuna opzione disponibile.', en: 'No options available.' }));
      } else {
        for (const room of displayedCandidates) {
          const source = String((room as any).source || 'direct');
          const sourceLabel =
            source === 'meeting'
              ? t({ it: 'meeting', en: 'meeting' })
              : source === 'empty'
                ? t({ it: 'vuoto', en: 'empty' })
                : source === 'other'
                  ? t({ it: 'altro reparto', en: 'other department' })
                  : t({ it: 'diretta', en: 'direct' });
          const distance = distanceFromAnchor.get(`${room.planId}:${room.roomId}`) || {
            meters: (room as any).distanceMeters ?? null,
            px: (room as any).distancePx ?? null
          };
          writeLine(
            `• ${room.roomName} (${room.planName}) | ${t({ it: 'allocazione', en: 'allocation' })}: ${sourceLabel} | ${t({
              it: 'liberi',
              en: 'free'
            })}: ${room.freeSeats} | ${t({ it: 'distanza', en: 'distance' })}: ${formatDistanceLabel(distance.meters, distance.px)}`
          );
        }
      }

      const fileDate = new Date().toISOString().slice(0, 10);
      pdf.save(`plixmap_placement_summary_${fileDate}.pdf`);
    } catch {
      // ignore export failures in UI, keep modal responsive
    } finally {
      setAllocationPdfBusy(false);
    }
  };

  return (
    <>
      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleMainDialogClose} initialFocus={closeButtonRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl modal-panel">
                  <div className="modal-header items-center">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Trova sistemazione', en: 'Find placement' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Definisci cliente/sede e uno o più dipartimenti. Le opzioni in alto aggiornano i risultati in tempo reale.',
                          en: 'Set client/site and one or more departments. Top options update results in real time.'
                        })}
                      </div>
                    </div>
                    <button ref={closeButtonRef} onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Cliente', en: 'Client' })}
                      <select
                        value={selectedClient?.clientId || ''}
                        onChange={(e) => {
                          setSelectedClientId(e.target.value);
                          setSelectedSiteId('');
                          setSelectedDepartments([]);
                          setDepartmentSearch('');
                          distanceCacheRef.current.clear();
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      >
                        {(summary.clients || []).map((entry) => (
                          <option key={entry.clientId} value={entry.clientId}>
                            {entry.clientName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Sede', en: 'Site' })}
                      <select
                        value={selectedSite?.siteId || ''}
                        onChange={(e) => {
                          setSelectedSiteId(e.target.value);
                          setSelectedDepartments([]);
                          setDepartmentSearch('');
                          distanceCacheRef.current.clear();
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      >
                        {(selectedClient?.sites || []).map((entry) => (
                          <option key={entry.siteId} value={entry.siteId}>
                            {entry.siteName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Quante persone hai bisogno di collocare?', en: 'How many people do you need to place?' })}
                      <input
                        value={requested}
                        onChange={(e) => setRequested(e.target.value)}
                        inputMode="numeric"
                        type="number"
                        min={1}
                        step={1}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. 6', en: 'e.g. 6' })}
                      />
                    </label>

                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-700">{t({ it: 'Dipartimenti', en: 'Departments' })}</div>
                        <button
                          type="button"
                          onClick={() => setSelectedDepartments([])}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          {t({ it: 'Azzera selezione', en: 'Clear selection' })}
                        </button>
                      </div>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <input
                          value={departmentSearch}
                          onChange={(e) => setDepartmentSearch(e.target.value)}
                          className="w-full text-sm outline-none"
                          placeholder={t({ it: 'Filtra dipartimenti', en: 'Filter departments' })}
                        />
                      </div>
                      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                        {filteredDepartments.length ? (
                          filteredDepartments.map((entry) => {
                            const checked = selectedDepartmentSet.has(entry.toLocaleLowerCase());
                            return (
                              <label key={entry} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const folded = entry.toLocaleLowerCase();
                                    setSelectedDepartments((prev) => {
                                      if (prev.some((tag) => tag.toLocaleLowerCase() === folded)) {
                                        return prev.filter((tag) => tag.toLocaleLowerCase() !== folded);
                                      }
                                      return [...prev, entry];
                                    });
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-primary"
                                />
                                <span className="truncate text-slate-700">{entry}</span>
                              </label>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-2 text-xs text-slate-500">
                            {t({ it: 'Nessun dipartimento trovato.', en: 'No department found.' })}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        {selectedDepartments.length ? (
                          selectedDepartments.map((entry) => (
                            <span key={entry} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                              {entry}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">{t({ it: 'Qualsiasi dipartimento', en: 'Any department' })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                    <div className="grid gap-2 md:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="font-semibold text-slate-700">{t({ it: 'Capienza sede', en: 'Site capacity' })}</div>
                        <div className="mt-1 text-sm font-bold text-ink">{selectedSite?.totalCapacity || 0}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="font-semibold text-slate-700">{t({ it: 'Persone attuali', en: 'Current people' })}</div>
                        <div className="mt-1 text-sm font-bold text-ink">{selectedSite?.totalUsers || 0}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="font-semibold text-slate-700">{t({ it: 'Piani coperti', en: 'Floors covered' })}</div>
                        <div className="mt-1 text-sm font-bold text-ink">{selectedSite?.floorsCount || 0}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="font-semibold text-slate-700">{t({ it: 'Stanze analizzate', en: 'Rooms analyzed' })}</div>
                        <div className="mt-1 text-sm font-bold text-ink">{eligibleRoomCandidates.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t({ it: 'Opzioni ricerca alternativa', en: 'Alternative search options' })}
                    </div>
                    <div className="mt-2 grid gap-2 lg:grid-cols-2 xl:grid-cols-4">
                      <YesNoToggle
                        label={t({ it: 'Vuoi cercare un’alternativa?', en: 'Search for alternatives?' })}
                        value={searchAlternatives}
                        onChange={setSearchAlternatives}
                        yesLabel={t({ it: 'Sì', en: 'Yes' })}
                        noLabel={t({ it: 'No', en: 'No' })}
                      />
                      <div className={searchAlternatives ? '' : 'opacity-50'}>
                        <YesNoToggle
                          label={t({ it: 'Includere uffici vuoti?', en: 'Include empty offices?' })}
                          value={searchAlternatives && includeEmptyOffices}
                          onChange={(next) => {
                            if (!searchAlternatives) return;
                            setIncludeEmptyOffices(next);
                          }}
                          yesLabel={t({ it: 'Sì', en: 'Yes' })}
                          noLabel={t({ it: 'No', en: 'No' })}
                        />
                      </div>
                      <div className={searchAlternatives ? '' : 'opacity-50'}>
                        <YesNoToggle
                          label={t({
                            it: 'Includere uffici di altri reparti?',
                            en: 'Include offices of other departments?'
                          })}
                          value={searchAlternatives && includeOtherDepartments}
                          onChange={(next) => {
                            if (!searchAlternatives) return;
                            setIncludeOtherDepartments(next);
                          }}
                          yesLabel={t({ it: 'Sì', en: 'Yes' })}
                          noLabel={t({ it: 'No', en: 'No' })}
                        />
                      </div>
                      <div className={searchAlternatives ? '' : 'opacity-50'}>
                        <YesNoToggle
                          label={t({ it: 'Includere meeting rooms?', en: 'Include meeting rooms?' })}
                          value={searchAlternatives && includeMeetingRooms}
                          onChange={(next) => {
                            if (!searchAlternatives) return;
                            setIncludeMeetingRooms(next);
                          }}
                          yesLabel={t({ it: 'Sì', en: 'Yes' })}
                          noLabel={t({ it: 'No', en: 'No' })}
                        />
                      </div>
                    </div>
                  </div>

                  {insufficiencyInfo ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {t({
                        it: `La stanza "${insufficiencyInfo.roomName}" ha ${insufficiencyInfo.availableSeats} posti, inferiori alla capacità richiesta (${insufficiencyInfo.requested}).`,
                        en: `Room "${insufficiencyInfo.roomName}" has ${insufficiencyInfo.availableSeats} seats, below requested capacity (${insufficiencyInfo.requested}).`
                      })}
                    </div>
                  ) : null}

                  {showCrossFloorEmptyHint ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {t({
                        it: 'Nessun ufficio vuoto sul piano corrente: estendo la ricerca agli altri piani della sede.',
                        en: 'No empty office on the current floor: extending search to other floors in this site.'
                      })}
                    </div>
                  ) : null}

                  {searchAlternatives && !includeEmptyOffices && !includeOtherDepartments && !includeMeetingRooms ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      {t({
                        it: 'Attiva almeno una fonte alternativa: uffici vuoti, uffici di altri reparti o meeting rooms.',
                        en: 'Enable at least one alternative source: empty offices, other-department offices, or meeting rooms.'
                      })}
                    </div>
                  ) : null}

                  {requestedCount > 0 &&
                  searchAlternatives &&
                  (includeEmptyOffices || includeOtherDepartments || includeMeetingRooms) &&
                  !displayedCandidates.length ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      {t({
                        it: 'Non è stato possibile trovare alternative valide con le opzioni selezionate.',
                        en: 'No valid alternatives were found with the selected options.'
                      })}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    {!requestedCount ? (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {t({ it: 'Inserisci il numero di persone per ottenere le opzioni di collocazione.', en: 'Enter people count to get placement options.' })}
                      </div>
                    ) : displayedCandidates.length ? (
                      <div className="max-h-[25rem] space-y-2 overflow-auto">
                        {displayedCandidates.map((room) => {
                          const saturationLabel = `${room.userCount}/${room.capacity}`;
                          const availableLabel = t({
                            it: `${room.freeSeats} posti liberi`,
                            en: `${room.freeSeats} seats free`
                          });
                          const distance = distanceFromAnchor.get(`${room.planId}:${room.roomId}`) || {
                            meters: (room as any).distanceMeters ?? null,
                            px: (room as any).distancePx ?? null
                          };
                          return (
                            <div key={`${room.planId}:${room.roomId}`} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-ink">{room.roomName}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                      <Building2 size={12} /> {room.clientName}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <MapPinned size={12} /> {room.siteName} · {room.planName}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{saturationLabel}</span>
                                  <span className="text-slate-500">{availableLabel}</span>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                {room.matchesDepartment && hasDepartmentFilter ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                    {t({ it: 'Dipartimento coerente', en: 'Department match' })}
                                  </span>
                                ) : null}
                                {(room as any).source === 'other' ? (
                                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                                    {t({ it: 'Altro reparto', en: 'Other department' })}
                                  </span>
                                ) : null}
                                {(room as any).source === 'meeting' ? (
                                  <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 font-semibold text-fuchsia-700">
                                    {t({ it: 'Alternativa meeting', en: 'Meeting alternative' })}
                                  </span>
                                ) : null}
                                {room.isEmptyRoom ? (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                                    {t({ it: 'Ufficio vuoto', en: 'Empty office' })}
                                  </span>
                                ) : null}
                                {room.isMeetingRoom ? (
                                  <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 font-semibold text-fuchsia-700">
                                    {t({ it: 'Meeting room', en: 'Meeting room' })}
                                  </span>
                                ) : null}
                                {room.departmentTags.length ? (
                                  room.departmentTags.slice(0, 3).map((tag) => (
                                    <span key={tag} className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                    {t({ it: 'Senza dipartimento', en: 'No department' })}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                {room.occupants.length ? (
                                  <span className="inline-flex items-start gap-1">
                                    <Users size={12} className="mt-0.5" />
                                    <span>
                                      {t({ it: 'Persone in stanza', en: 'People in room' })}: {room.occupants.slice(0, 6).join(', ')}
                                      {room.occupants.length > 6 ? ` +${room.occupants.length - 6}` : ''}
                                    </span>
                                  </span>
                                ) : (
                                  <span>{t({ it: 'Nessuna persona presente', en: 'No people currently in room' })}</span>
                                )}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                <span>
                                  {t({ it: 'Distanza stimata', en: 'Estimated distance' })}: {formatDistanceLabel(distance.meters, distance.px)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewSelection({
                                      clientName: room.clientName,
                                      siteName: room.siteName,
                                      targetPlanName: room.planName,
                                      targetPlanId: room.planId,
                                      targetRoomId: room.roomId,
                                      sourcePlanName: bestDepartmentRoom?.planName,
                                      sourcePlanId: bestDepartmentRoom?.planId,
                                      sourceRoomId: bestDepartmentRoom?.roomId
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 font-semibold text-primary hover:bg-primary/10"
                                  title={t({ it: 'Mostra stanza', en: 'Show room' })}
                                >
                                  <LocateFixed size={12} /> SHOW ROOM
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        <div className="font-semibold">
                          {t({ it: 'Nessuna opzione trovata con i filtri attuali.', en: 'No options found with current filters.' })}
                        </div>
                        <div className="mt-1 text-xs text-amber-800">
                          {t({
                            it: 'Prova con altri dipartimenti, abilita opzioni alternative o riduci il numero di persone da collocare.',
                            en: 'Try other departments, enable alternative options, or reduce the number of people to place.'
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {allocationSummary ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-ink">{t({ it: 'Riepilogo consigliato', en: 'Suggested allocation summary' })}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAllocationReportOpen(true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <FileText size={12} />
                            {t({ it: 'Apri riepilogo', en: 'Open summary' })}
                          </button>
                          <button
                            type="button"
                            onClick={() => void exportAllocationReportPdf()}
                            disabled={allocationPdfBusy}
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download size={12} />
                            {allocationPdfBusy ? t({ it: 'Export...', en: 'Export...' }) : t({ it: 'Esporta PDF', en: 'Export PDF' })}
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {allocationSummary.remaining > 0
                          ? t({
                              it: `Plixmap riesce a collocare ${allocationSummary.placed} persone su ${allocationSummary.requested}. Mancano ${allocationSummary.remaining} posti.`,
                              en: `Plixmap can place ${allocationSummary.placed} out of ${allocationSummary.requested} people. ${allocationSummary.remaining} seats are still missing.`
                            })
                          : t({
                              it: `Plixmap colloca tutte le ${allocationSummary.requested} persone.`,
                              en: `Plixmap places all ${allocationSummary.requested} people.`
                            })}
                      </div>
                      {allocationSummary.allocations.length ? (
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {allocationSummary.allocations.map((entry) => (
                            <div key={entry.room} className="flex items-center justify-between gap-2">
                              <span className="truncate">{entry.room}</span>
                              <span className="font-semibold text-ink">{entry.seats}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={onClose}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={allocationReportOpen && open} as={Fragment}>
        <Dialog as="div" className="relative z-[70]" onClose={() => setAllocationReportOpen(false)} initialFocus={reportCloseRef}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/45" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Riepilogo allocazione', en: 'Allocation summary' })}</Dialog.Title>
                      <div className="mt-1 text-xs text-slate-500">
                        {(selectedClient?.clientName || '-') + ' > ' + (selectedSite?.siteName || '-')}
                      </div>
                    </div>
                    <button type="button" onClick={() => setAllocationReportOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 max-h-[68vh] space-y-4 overflow-y-auto pr-1 text-sm text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Contesto', en: 'Context' })}</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div>{t({ it: 'Cliente', en: 'Client' })}: <span className="font-semibold text-ink">{selectedClient?.clientName || '-'}</span></div>
                        <div>{t({ it: 'Sede', en: 'Site' })}: <span className="font-semibold text-ink">{selectedSite?.siteName || '-'}</span></div>
                        <div>
                          {t({ it: 'Dipartimenti', en: 'Departments' })}:{' '}
                          <span className="font-semibold text-ink">
                            {selectedDepartments.length ? selectedDepartments.join(', ') : t({ it: 'Qualsiasi dipartimento', en: 'Any department' })}
                          </span>
                        </div>
                        <div>{t({ it: 'Persone da collocare', en: 'People to place' })}: <span className="font-semibold text-ink">{requestedCount}</span></div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Opzioni', en: 'Options' })}</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div>{t({ it: 'Cerca alternativa', en: 'Search alternatives' })}: <span className="font-semibold text-ink">{yesNoLabel(searchAlternatives, t)}</span></div>
                        <div>{t({ it: 'Includi uffici vuoti', en: 'Include empty offices' })}: <span className="font-semibold text-ink">{yesNoLabel(includeEmptyOffices, t)}</span></div>
                        <div>{t({ it: 'Includi altri reparti', en: 'Include other departments' })}: <span className="font-semibold text-ink">{yesNoLabel(includeOtherDepartments, t)}</span></div>
                        <div>{t({ it: 'Includi meeting rooms', en: 'Include meeting rooms' })}: <span className="font-semibold text-ink">{yesNoLabel(includeMeetingRooms, t)}</span></div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div className="text-base font-semibold text-ink">{t({ it: 'Come Plixmap sistemerebbe le persone', en: 'How Plixmap would place people' })}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {allocationSummary?.remaining
                          ? t({
                              it: `Collocabili ${allocationSummary.placed}/${allocationSummary.requested}. Mancano ${allocationSummary.remaining}.`,
                              en: `Plixmap can place ${allocationSummary.placed}/${allocationSummary.requested}. Missing ${allocationSummary.remaining}.`
                            })
                          : t({
                              it: `Plixmap colloca tutte le ${allocationSummary?.requested || 0} persone.`,
                              en: `Plixmap places all ${allocationSummary?.requested || 0} people.`
                            })}
                      </div>
                      <div className="mt-3 space-y-1">
                        {(allocationSummary?.allocations || []).map((entry) => (
                          <div key={entry.room} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
                            <span className="truncate text-slate-700">{entry.room}</span>
                            <span className="font-semibold text-ink">{entry.seats}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Opzioni considerate', en: 'Displayed candidates' })}</div>
                      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                        {displayedCandidates.length ? (
                          displayedCandidates.map((room) => {
                            const distance = distanceFromAnchor.get(`${room.planId}:${room.roomId}`) || {
                              meters: (room as any).distanceMeters ?? null,
                              px: (room as any).distancePx ?? null
                            };
                            const source = String((room as any).source || 'direct');
                            const sourceLabel =
                              source === 'meeting'
                                ? t({ it: 'meeting', en: 'meeting' })
                                : source === 'empty'
                                  ? t({ it: 'vuoto', en: 'empty' })
                                  : source === 'other'
                                    ? t({ it: 'altro reparto', en: 'other department' })
                                    : t({ it: 'diretta', en: 'direct' });
                            return (
                              <div key={`${room.planId}:${room.roomId}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate font-semibold text-ink">{room.roomName}</span>
                                  <span className="rounded-full bg-white px-2 py-0.5 font-semibold">{sourceLabel}</span>
                                </div>
                                <div className="mt-1">
                                  {room.planName} · {t({ it: 'liberi', en: 'free' })}: {room.freeSeats} · {t({ it: 'distanza', en: 'distance' })}:{' '}
                                  {formatDistanceLabel(distance.meters, distance.px)}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                            {t({ it: 'Nessuna opzione disponibile.', en: 'No options available.' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      ref={reportCloseRef}
                      type="button"
                      onClick={() => setAllocationReportOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportAllocationReportPdf()}
                      disabled={allocationPdfBusy}
                      className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Download size={14} />
                        {allocationPdfBusy ? t({ it: 'Export PDF...', en: 'Export PDF...' }) : t({ it: 'Esporta PDF', en: 'Export PDF' })}
                      </span>
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!previewSelection && open} as={Fragment}>
        <Dialog as="div" className="relative z-[70]" onClose={() => setPreviewSelection(null)} initialFocus={previewGoRef}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/45" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-6xl rounded-2xl bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Dialog.Title className="text-lg font-semibold text-ink">SHOW ROOM</Dialog.Title>
                      <div className="mt-1 truncate text-xs font-medium text-slate-600">
                        {previewSelection ? `${previewSelection.clientName} > ${previewSelection.siteName} > ${previewSelection.targetPlanName}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewSelection(null)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-3">
                    {previewPlans?.length ? (
                      <div className={`grid gap-3 ${previewPlans.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                        {previewPlans.map((panel) => {
                          const svgHeightClass = previewPlans.length > 1 ? 'h-[42vh]' : 'h-[56vh]';
                          const panelRole =
                            panel.kind === 'source'
                              ? t({ it: 'Piano di origine', en: 'Source floor' })
                              : t({ it: 'Piano proposto', en: 'Proposed floor' });
                          return (
                            <div key={`${panel.kind}:${panel.planId}`} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-ink">{panel.planName}</div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">{panelRole}</div>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    panel.kind === 'target' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {panel.kind === 'target'
                                    ? t({ it: 'Destinazione', en: 'Destination' })
                                    : t({ it: 'Partenza', en: 'Start' })}
                                </span>
                              </div>

                              <svg
                                viewBox={`${panel.minX} ${panel.minY} ${panel.viewWidth} ${panel.viewHeight}`}
                                className={`${svgHeightClass} w-full rounded-lg border border-slate-200 bg-slate-100`}
                                role="img"
                                aria-label={t({ it: 'Anteprima planimetria stanza', en: 'Room floor plan preview' })}
                              >
                                {panel.planImageUrl ? (
                                  <image
                                    href={panel.planImageUrl}
                                    x={panel.minX}
                                    y={panel.minY}
                                    width={panel.viewWidth}
                                    height={panel.viewHeight}
                                    preserveAspectRatio="none"
                                  />
                                ) : null}
                                <rect
                                  x={panel.minX}
                                  y={panel.minY}
                                  width={panel.viewWidth}
                                  height={panel.viewHeight}
                                  fill="rgba(15, 23, 42, 0.06)"
                                />

                                {panel.roomEntries.map((entry) => {
                                  const roomId = String(entry.room.id || '');
                                  const isFocused = roomId === panel.focusRoomId;
                                  const roomName = normalizeLabel((entry.room as any)?.nameEn) || normalizeLabel(entry.room.name) || roomId;
                                  return (
                                    <g key={`${panel.planId}:${roomId}`}>
                                      <polygon
                                        points={entry.polygon.map((point) => `${point.x},${point.y}`).join(' ')}
                                        fill={isFocused ? 'rgba(37, 99, 235, 0.3)' : 'rgba(255, 255, 255, 0.18)'}
                                        stroke={isFocused ? 'rgb(37, 99, 235)' : 'rgba(15, 23, 42, 0.45)'}
                                        strokeWidth={isFocused ? 3.6 : 1.4}
                                        className={isFocused ? 'animate-pulse' : ''}
                                      />
                                      {entry.centroid ? (
                                        <text
                                          x={entry.centroid.x}
                                          y={entry.centroid.y}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          className={`pointer-events-none select-none text-[12px] font-semibold ${
                                            isFocused ? 'fill-blue-950' : 'fill-slate-900'
                                          }`}
                                        >
                                          {roomName}
                                        </text>
                                      ) : null}
                                    </g>
                                  );
                                })}
                                {panel.userObjects.map((obj) => {
                                  const x = Number(obj.x);
                                  const y = Number(obj.y);
                                  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                                  const displayName =
                                    String(`${String((obj as any)?.firstName || '').trim()} ${String((obj as any)?.lastName || '').trim()}`).trim() ||
                                    String(obj.name || '').trim() ||
                                    String(obj.id || '').trim();
                                  return (
                                    <g key={`${panel.planId}:${obj.id}`} transform={`translate(${x} ${y})`}>
                                      <circle r={5.4} fill="#0f172a" stroke="#e2e8f0" strokeWidth={1.2} />
                                      <text x={9} y={-10} className="pointer-events-none select-none fill-slate-900 text-[11px] font-semibold">
                                        {displayName}
                                      </text>
                                    </g>
                                  );
                                })}
                              </svg>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-white px-3 py-4 text-sm text-slate-600">
                        {t({ it: 'Anteprima non disponibile per questa selezione.', en: 'Preview is not available for this selection.' })}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPinned size={12} />
                      {t({
                        it: 'Planimetria completa con evidenza delle stanze e persone presenti.',
                        en: 'Full floor plan with highlighted rooms and current occupants.'
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewSelection(null)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Chiudi', en: 'Close' })}
                      </button>
                      <button
                        ref={previewGoRef}
                        type="button"
                        onClick={handleGoToRoomFromPreview}
                        className="btn-primary"
                      >
                        {t({ it: 'Go to room', en: 'Go to room' })}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

    </>
  );
};

export default RoomAllocationModal;
