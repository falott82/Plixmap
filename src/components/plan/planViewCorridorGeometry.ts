import type { Dispatch, SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import { postAuditEvent } from '../../api/audit';
import {
  getRoomPolygon,
  getSharedRoomSides,
  inferCorridorDoorLinkedRoomIds,
  normalizeDoorVerificationHistory,
  normalizeRoomConnectionDoorInput,
  projectPointToSegment
} from './planViewUtils';
import type { SharedRoomSide } from './planViewUtils';
import type { Corridor, FloorPlan, ObjectTypeDefinition, Room, RoomConnectionDoor, DoorVerificationEntry } from '../../store/types';
import type { useDataStore } from '../../store/useDataStore';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';

type Pt = { x: number; y: number };
type DataStoreState = ReturnType<typeof useDataStore.getState>;

type CorridorEdge = { edgeIndex: number; t: number; x: number; y: number; distSq: number } | null;

type CorridorDoorDraftState = {
  corridorId: string;
  start?: { edgeIndex: number; t: number; x: number; y: number };
} | null;

type RoomDoorDraftState = {
  roomAId: string;
  roomBId: string;
  sharedSides: SharedRoomSide[];
} | null;

type CorridorDoorModalState = {
  corridorId: string;
  doorId: string;
  description: string;
  isEmergency: boolean;
  isMainEntrance: boolean;
  isExternal: boolean;
  isFireDoor: boolean;
  lastVerificationAt: string;
  verifierCompany: string;
  verificationHistory: DoorVerificationEntry[];
  mode: 'static' | 'auto_sensor' | 'automated';
  automationUrl: string;
} | null;

type CorridorDoorLinkModalState = {
  corridorId: string;
  doorId: string;
  selectedRoomIds: string[];
  nearestRoomId?: string;
  magneticRoomIds?: string[];
} | null;

// Pure computations extracted from usePlanView. Bodies are verbatim; closed-over values (including
// stable refs) are passed in via `deps`, mirroring each hook's original dependency array. Module
// imports (nanoid, planViewUtils helpers) are imported directly here. The hook wrappers and their
// dep arrays stay unchanged.

export type HandleCorridorDoorDraftPointDeps = {
  corridorDoorDraft: CorridorDoorDraftState;
  defaultDoorCatalogId: string;
  markTouched: () => void;
  objectTypeById: Map<string, ObjectTypeDefinition>;
  push: (message: string, tone?: ToastTone) => void;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
  isReadOnlyRef: { current: boolean };
  planRef: { current: FloorPlan | undefined };
  setSelectedCorridorDoor: Dispatch<SetStateAction<{ corridorId: string; doorId: string } | null>>;
  setCorridorDoorDraft: Dispatch<SetStateAction<CorridorDoorDraftState>>;
  setCorridorQuickMenu: (value: null) => void;
};

export const computeHandleCorridorDoorDraftPoint = (
  {
    corridorId,
    point
  }: {
    corridorId: string;
    clientX: number;
    clientY: number;
    point: { edgeIndex: number; t: number; x: number; y: number };
  },
  deps: HandleCorridorDoorDraftPointDeps
) => {
  const {
    corridorDoorDraft,
    defaultDoorCatalogId,
    markTouched,
    objectTypeById,
    push,
    t,
    updateFloorPlan,
    isReadOnlyRef,
    planRef,
    setSelectedCorridorDoor,
    setCorridorDoorDraft,
    setCorridorQuickMenu
  } = deps;
  if (isReadOnlyRef.current) return;
  const currentPlan = planRef.current as FloorPlan | undefined;
  if (!currentPlan) return;
  const draft = corridorDoorDraft;
  if (!draft || draft.corridorId !== corridorId) return;
  const current = (currentPlan.corridors || []) as Corridor[];
  let created = false;
  const next = current.map((c) => {
    if (c.id !== corridorId) return c;
    const doors = Array.isArray(c.doors) ? [...c.doors] : [];
    const duplicate = doors.some((d: any) => {
      const sameEdge = Number(d.edgeIndex) === Number(point.edgeIndex);
      if (!sameEdge) return false;
      return Math.abs(Number(d.t) - Number(point.t)) < 0.02;
    });
    if (duplicate) return c;
    created = true;
    const doorId = nanoid();
    const defaultDoorType = defaultDoorCatalogId
      ? (objectTypeById.get(defaultDoorCatalogId) as ObjectTypeDefinition | undefined)
      : undefined;
    const defaultEmergency = !!defaultDoorType?.doorConfig?.isEmergency;
    setSelectedCorridorDoor({ corridorId, doorId });
    return {
      ...c,
      doors: [
        ...doors,
        {
          id: doorId,
          edgeIndex: Number(point.edgeIndex),
          t: Number(point.t.toFixed(4)),
          edgeIndexTo: undefined,
          tTo: undefined,
          catalogTypeId: defaultDoorCatalogId || undefined,
          mode: 'static',
          description: undefined,
          isEmergency: defaultEmergency,
          isMainEntrance: false,
          isExternal: false,
          isFireDoor: false,
          verificationHistory: [],
          linkedRoomIds: []
        }
      ]
    };
  });
  if (!created) {
    push(t({ it: 'Porta già presente in questo punto', en: 'A door already exists at this point' }), 'info');
    return;
  }
  markTouched();
  updateFloorPlan(currentPlan.id, { corridors: next } as any);
  push(t({ it: 'Porta creata sul corridoio', en: 'Door created on corridor' }), 'success');
  setCorridorDoorDraft(null);
  setCorridorQuickMenu(null);
};

export type CreateRoomDoorFromDraftDeps = {
  defaultDoorCatalogId: string;
  markTouched: () => void;
  objectTypeById: Map<string, ObjectTypeDefinition>;
  push: (message: string, tone?: ToastTone) => void;
  roomDoorDraft: RoomDoorDraftState;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
  isReadOnlyRef: { current: boolean };
  planRef: { current: FloorPlan | undefined };
  setRoomDoorDraft: Dispatch<SetStateAction<RoomDoorDraftState>>;
  setSelectedRoomDoorId: Dispatch<SetStateAction<string | null>>;
  setContextMenu: (value: null) => void;
};

export const computeCreateRoomDoorFromDraft = (
  roomId: string,
  point: { x: number; y: number },
  deps: CreateRoomDoorFromDraftDeps
) => {
  const {
    defaultDoorCatalogId,
    markTouched,
    objectTypeById,
    push,
    roomDoorDraft,
    t,
    updateFloorPlan,
    isReadOnlyRef,
    planRef,
    setRoomDoorDraft,
    setSelectedRoomDoorId,
    setContextMenu
  } = deps;
  if (isReadOnlyRef.current) return false;
  const currentPlan = planRef.current as FloorPlan | undefined;
  const draft = roomDoorDraft;
  if (!currentPlan || !draft) return false;
  const normalizedRoomId = String(roomId || '').trim();
  if (!normalizedRoomId) return false;
  const candidateSides = draft.sharedSides.filter((side) => side.anchorRoomId === normalizedRoomId);
  if (!candidateSides.length) return false;
  let best:
    | {
        side: SharedRoomSide;
        x: number;
        y: number;
        distSq: number;
        along: number;
      }
    | null = null;
  for (const side of candidateSides) {
    const proj = projectPointToSegment(side.a, side.b, point);
    const segLenSq = (side.b.x - side.a.x) * (side.b.x - side.a.x) + (side.b.y - side.a.y) * (side.b.y - side.a.y);
    const along =
      segLenSq > 0.000001
        ? Math.max(
            0,
            Math.min(1, ((proj.x - side.a.x) * (side.b.x - side.a.x) + (proj.y - side.a.y) * (side.b.y - side.a.y)) / segLenSq)
          )
        : 0;
    if (!best || proj.distSq < best.distSq) {
      best = { side, x: proj.x, y: proj.y, distSq: proj.distSq, along };
    }
  }
  if (!best) return false;
  const maxSnapDist = 18;
  if (best.distSq > maxSnapDist * maxSnapDist) {
    push(
      t({
        it: 'Posiziona la porta sul lato condiviso tra le due stanze selezionate.',
        en: 'Place the door on the shared side between the two selected rooms.'
      }),
      'info'
    );
    return true;
  }
  const side = best.side;
  const tValue = side.tMin + (side.tMax - side.tMin) * best.along;
  const roomAId = String(draft.roomAId);
  const roomBId = String(draft.roomBId);
  const existingDoors = Array.isArray(currentPlan?.roomDoors) ? (currentPlan?.roomDoors as any[]) : [];
  const duplicate = existingDoors.some((door) => {
    const normalized = normalizeRoomConnectionDoorInput(door);
    if (!normalized) return false;
    const samePair =
      (normalized.roomAId === roomAId && normalized.roomBId === roomBId) ||
      (normalized.roomAId === roomBId && normalized.roomBId === roomAId);
    if (!samePair) return false;
    if (normalized.anchorRoomId !== side.anchorRoomId) return false;
    if (Number(normalized.edgeIndex) !== Number(side.edgeIndex)) return false;
    return Math.abs(Number(normalized.t) - Number(tValue)) < 0.02;
  });
  if (duplicate) {
    push(t({ it: 'Porta di collegamento già presente in questo punto.', en: 'A linking door already exists at this point.' }), 'info');
    return true;
  }
  const doorId = nanoid();
  const defaultDoorType = defaultDoorCatalogId
    ? (objectTypeById.get(defaultDoorCatalogId) as ObjectTypeDefinition | undefined)
    : undefined;
  const defaultEmergency = !!defaultDoorType?.doorConfig?.isEmergency;
  const nextDoor: RoomConnectionDoor = {
    id: doorId,
    roomAId,
    roomBId,
    anchorRoomId: side.anchorRoomId,
    edgeIndex: Number(side.edgeIndex),
    t: Number(Math.max(0, Math.min(1, tValue)).toFixed(4)),
    catalogTypeId: defaultDoorCatalogId || undefined,
    mode: 'static',
    description: undefined,
    isEmergency: defaultEmergency,
    isMainEntrance: false,
    isExternal: false,
    isFireDoor: false,
    verificationHistory: []
  };
  markTouched();
  updateFloorPlan(currentPlan.id, { roomDoors: [...existingDoors, nextDoor] as any } as any);
  setRoomDoorDraft(null);
  setSelectedRoomDoorId(doorId);
  setContextMenu(null);
  push(t({ it: 'Porta di collegamento creata', en: 'Connecting door created' }), 'success');
  return true;
};

export type OpenCorridorDoorLinkModalDeps = {
  corridorById: Map<string, Corridor>;
  getCorridorEdgePoint: (corridor: Corridor, edgeIndex: number, t: number) => Pt | null;
  normalizeLayerSelection: (ids: string[]) => string[];
  planId: string;
  renderPlan: FloorPlan | undefined;
  setHideAllLayers: (planId: string, value: boolean) => void;
  setVisibleLayerIds: (planId: string, ids: string[]) => void;
  visibleLayerIds: string[];
  setCorridorDoorLinkModal: Dispatch<SetStateAction<CorridorDoorLinkModalState>>;
  setCorridorDoorLinkQuery: Dispatch<SetStateAction<string>>;
};

export const computeOpenCorridorDoorLinkModal = (
  corridorId: string,
  doorId: string,
  deps: OpenCorridorDoorLinkModalDeps
) => {
  const {
    corridorById,
    getCorridorEdgePoint,
    normalizeLayerSelection,
    planId,
    renderPlan,
    setHideAllLayers,
    setVisibleLayerIds,
    visibleLayerIds,
    setCorridorDoorLinkModal,
    setCorridorDoorLinkQuery
  } = deps;
  const corridor = corridorById.get(corridorId);
  const door = (corridor?.doors || []).find((d) => d.id === doorId);
  if (!corridor || !door) return;
  // Force rooms layer visible for better context while linking door->rooms.
  setHideAllLayers(planId, false);
  setVisibleLayerIds(planId, normalizeLayerSelection([...visibleLayerIds, 'rooms']));
  const availableRooms = (renderPlan?.rooms || []) as Room[];
  const availableRoomIdSet = new Set(availableRooms.map((room) => room.id));
  let selectedRoomIds: string[] = Array.isArray((door as any).linkedRoomIds)
    ? Array.from(
        new Set<string>(
          (door as any).linkedRoomIds
            .map((id: any) => String(id))
            .filter((id: string) => availableRoomIdSet.has(id))
        )
      )
    : [];
  if (!selectedRoomIds.length) {
    selectedRoomIds = inferCorridorDoorLinkedRoomIds(corridor, door, availableRooms)
      .map((id: any) => String(id))
      .filter((id: string) => availableRoomIdSet.has(id));
  }
  let nearestRoomId: string | undefined;
  let magneticRoomIds: string[] = [];
  if (availableRooms.length) {
    const anchor = getCorridorEdgePoint(corridor, Number((door as any).edgeIndex), Number((door as any).t));
    if (anchor) {
      const getRoomCenter = (room: Room): { x: number; y: number } | null => {
        const points = getRoomPolygon(room as any);
        if (points.length >= 3) {
          const total = points.reduce((acc: { x: number; y: number }, p: { x: number; y: number }) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
            x: 0,
            y: 0
          });
          return { x: total.x / points.length, y: total.y / points.length };
        }
        const x = Number((room as any)?.x || 0);
        const y = Number((room as any)?.y || 0);
        const width = Number((room as any)?.width || 0);
        const height = Number((room as any)?.height || 0);
        if (width > 0 && height > 0) return { x: x + width / 2, y: y + height / 2 };
        return null;
      };
      const roomByDistance: Array<{ id: string; distSq: number }> = [];
      for (const room of availableRooms) {
        const points = getRoomPolygon(room as any);
        let distSq = Number.POSITIVE_INFINITY;
        if (points.length >= 2) {
          for (let i = 0; i < points.length; i += 1) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            const proj = projectPointToSegment(a, b, anchor);
            if (proj.distSq < distSq) distSq = proj.distSq;
          }
        } else {
          const center = getRoomCenter(room);
          if (center) {
            const dx = center.x - anchor.x;
            const dy = center.y - anchor.y;
            distSq = dx * dx + dy * dy;
          }
        }
        if (Number.isFinite(distSq)) roomByDistance.push({ id: room.id, distSq });
      }
      roomByDistance.sort((a, b) => a.distSq - b.distSq);
      nearestRoomId = roomByDistance[0]?.id;
      const magneticThresholdSq = 18 * 18;
      magneticRoomIds = roomByDistance.filter((entry) => entry.distSq <= magneticThresholdSq).map((entry) => entry.id);
      if (!selectedRoomIds.length && nearestRoomId) selectedRoomIds = [nearestRoomId];
    }
  }
  setCorridorDoorLinkModal({ corridorId, doorId, selectedRoomIds, nearestRoomId, magneticRoomIds });
  setCorridorDoorLinkQuery('');
};

export type SaveCorridorDoorModalDeps = {
  corridorDoorModal: CorridorDoorModalState;
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | undefined;
  push: (message: string, tone?: ToastTone) => void;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
  setCorridorDoorModal: Dispatch<SetStateAction<CorridorDoorModalState>>;
};

export const computeSaveCorridorDoorModal = (deps: SaveCorridorDoorModalDeps) => {
  const { corridorDoorModal, isReadOnly, markTouched, plan, push, t, updateFloorPlan, setCorridorDoorModal } = deps;
  if (!corridorDoorModal || !plan || isReadOnly) return;
  const mode = corridorDoorModal.mode;
  const automationUrl = corridorDoorModal.automationUrl.trim();
  if (mode === 'automated' && automationUrl && !/^https?:\/\//i.test(automationUrl)) {
    push(t({ it: 'Inserisci un URL valido (http/https).', en: 'Enter a valid URL (http/https).' }), 'danger');
    return;
  }
  const isEmergency = !!corridorDoorModal.isEmergency;
  const isMainEntrance = !!corridorDoorModal.isMainEntrance;
  const isExternal = !!corridorDoorModal.isExternal;
  const isFireDoor = !!corridorDoorModal.isFireDoor;
  const description = corridorDoorModal.description.trim();
  const lastVerificationAt = corridorDoorModal.lastVerificationAt.trim();
  const verifierCompany = corridorDoorModal.verifierCompany.trim();
  let verificationHistory = normalizeDoorVerificationHistory(corridorDoorModal.verificationHistory);
  if (isEmergency && (lastVerificationAt || verifierCompany)) {
    const latest = verificationHistory[0];
    if (!latest || (latest.date || '') !== lastVerificationAt || latest.company !== verifierCompany) {
      verificationHistory = normalizeDoorVerificationHistory([
        {
          id: nanoid(),
          date: lastVerificationAt || undefined,
          company: verifierCompany,
          createdAt: Date.now()
        },
        ...verificationHistory
      ]);
    }
  }
  if (corridorDoorModal.corridorId === '__room__') {
    const currentRoomDoors = Array.isArray(plan?.roomDoors) ? (plan?.roomDoors as any[]) : [];
    const nextRoomDoors = currentRoomDoors.map((door) =>
      String((door as any)?.id || '') === corridorDoorModal.doorId
        ? {
            ...door,
            description: description || undefined,
            isEmergency,
            isMainEntrance,
            isExternal,
            isFireDoor,
            lastVerificationAt: isEmergency ? lastVerificationAt || undefined : undefined,
            verifierCompany: isEmergency ? verifierCompany || undefined : undefined,
            verificationHistory,
            mode,
            automationUrl: mode === 'automated' ? automationUrl || undefined : undefined
          }
        : door
    );
    markTouched();
    updateFloorPlan(plan.id, { roomDoors: nextRoomDoors as any } as any);
    push(t({ it: 'Proprietà porta aggiornate', en: 'Door properties updated' }), 'success');
    setCorridorDoorModal(null);
    return;
  }
  const current = (plan.corridors || []) as Corridor[];
  const next = current.map((corridor) => {
    if (corridor.id !== corridorDoorModal.corridorId) return corridor;
    return {
      ...corridor,
      doors: (corridor.doors || []).map((door) =>
        door.id === corridorDoorModal.doorId
          ? {
              ...door,
              description: description || undefined,
              isEmergency,
              isMainEntrance,
              isExternal,
              isFireDoor,
              lastVerificationAt: isEmergency ? lastVerificationAt || undefined : undefined,
              verifierCompany: isEmergency ? verifierCompany || undefined : undefined,
              verificationHistory,
              mode,
              automationUrl: mode === 'automated' ? automationUrl || undefined : undefined
            }
          : door
      )
    };
  });
  markTouched();
  updateFloorPlan(plan.id, { corridors: next } as any);
  push(t({ it: 'Proprietà porta aggiornate', en: 'Door properties updated' }), 'success');
  setCorridorDoorModal(null);
};

export type InsertCorridorJunctionPointDeps = {
  getClosestCorridorEdge: (corridor: Corridor, point: Pt) => CorridorEdge;
  getCorridorPolygon: (corridor: any) => Pt[];
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | undefined;
  push: (message: string, tone?: ToastTone) => void;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
};

export const computeInsertCorridorJunctionPoint = (
  corridorId: string,
  worldPoint: { x: number; y: number },
  deps: InsertCorridorJunctionPointDeps
) => {
  const { getClosestCorridorEdge, getCorridorPolygon, isReadOnly, markTouched, plan, push, t, updateFloorPlan } = deps;
  if (isReadOnly || !plan) return;
  const current = (plan.corridors || []) as Corridor[];
  const target = current.find((c) => c.id === corridorId);
  if (!target) return;
  const basePoints = getCorridorPolygon(target);
  if (basePoints.length < 3) return;
  const anchor = getClosestCorridorEdge(target, worldPoint);
  if (!anchor) return;
  const splitT = Number(anchor.t);
  // Avoid creating duplicate vertices too close to edge endpoints.
  if (!Number.isFinite(splitT) || splitT <= 0.02 || splitT >= 0.98) {
    push(
      t({
        it: 'Punto troppo vicino a un vertice esistente.',
        en: 'Point is too close to an existing vertex.'
      }),
      'info'
    );
    return;
  }
  const insertIndex = Number(anchor.edgeIndex) + 1;
  const newPoint = { x: Number(anchor.x.toFixed(3)), y: Number(anchor.y.toFixed(3)) };
  const nextPoints = [...basePoints.slice(0, insertIndex), newPoint, ...basePoints.slice(insertIndex)];
  const edgeCount = basePoints.length;
  const remapEdgeRef = (edgeIndexRaw: any, tRaw: any) => {
    const edgeIndex = ((Math.floor(Number(edgeIndexRaw) || 0) % edgeCount) + edgeCount) % edgeCount;
    const rawT = Number(tRaw);
    const tVal = Number.isFinite(rawT) ? Math.max(0, Math.min(1, rawT)) : 0;
    if (edgeIndex < Number(anchor.edgeIndex)) return { edgeIndex, t: tVal };
    if (edgeIndex > Number(anchor.edgeIndex)) return { edgeIndex: edgeIndex + 1, t: tVal };
    if (tVal <= splitT) {
      const den = splitT;
      return { edgeIndex, t: den > 0.000001 ? tVal / den : 0 };
    }
    const den = 1 - splitT;
    return { edgeIndex: edgeIndex + 1, t: den > 0.000001 ? (tVal - splitT) / den : 1 };
  };
  const getEdgePointOnPoints = (points: { x: number; y: number }[], edgeIndex: number, tVal: number) => {
    if (!points.length) return null;
    const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
    const a = points[idx];
    const b = points[(idx + 1) % points.length];
    if (!a || !b) return null;
    const ratio = Math.max(0, Math.min(1, tVal));
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  };
  const next = current.map((corridor) => {
    if (corridor.id !== corridorId) return corridor;
    const doors = (corridor.doors || []).map((door) => {
      const start = remapEdgeRef(door.edgeIndex, door.t);
      const hasEnd = Number.isFinite(Number((door as any).edgeIndexTo)) && Number.isFinite(Number((door as any).tTo));
      const end = hasEnd ? remapEdgeRef((door as any).edgeIndexTo, (door as any).tTo) : null;
      return {
        ...door,
        edgeIndex: start.edgeIndex,
        t: Number(start.t.toFixed(4)),
        edgeIndexTo: end ? end.edgeIndex : undefined,
        tTo: end ? Number(end.t.toFixed(4)) : undefined
      };
    });
    const connections = (corridor.connections || []).map((cp) => {
      const mapped = remapEdgeRef(cp.edgeIndex, cp.t);
      const pt = getEdgePointOnPoints(nextPoints, mapped.edgeIndex, mapped.t);
      return {
        ...cp,
        edgeIndex: mapped.edgeIndex,
        t: Number(mapped.t.toFixed(4)),
        x: pt ? Number(pt.x.toFixed(3)) : (cp as any).x,
        y: pt ? Number(pt.y.toFixed(3)) : (cp as any).y
      };
    });
    return {
      ...corridor,
      kind: 'poly' as const,
      points: nextPoints,
      doors,
      connections
    };
  });
  markTouched();
  updateFloorPlan(plan.id, { corridors: next } as any);
  push(
    t({
      it: 'Punto di snodo inserito nel perimetro del corridoio.',
      en: 'Junction point inserted on corridor perimeter.'
    }),
    'success'
  );
};

type CorridorModalState =
  | {
      mode: 'create';
      kind: 'poly';
      points: { x: number; y: number }[];
      initialName?: string;
      initialNameEn?: string;
      initialShowName?: boolean;
    }
  | { mode: 'edit'; corridorId: string; initialName: string; initialNameEn?: string; initialShowName?: boolean }
  | null;

export type SaveCorridorModalDeps = {
  corridorModal: CorridorModalState;
  corridorNameEnInput: string;
  corridorNameInput: string;
  corridorShowNameInput: boolean;
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | undefined;
  push: (message: string, tone?: ToastTone) => void;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
  setSelectedCorridorId: Dispatch<SetStateAction<string | undefined>>;
  setCorridorModal: Dispatch<SetStateAction<CorridorModalState>>;
  setCorridorNameInput: Dispatch<SetStateAction<string>>;
  setCorridorNameEnInput: Dispatch<SetStateAction<string>>;
};

export const computeSaveCorridorModal = (deps: SaveCorridorModalDeps) => {
  const {
    corridorModal,
    corridorNameEnInput,
    corridorNameInput,
    corridorShowNameInput,
    isReadOnly,
    markTouched,
    plan,
    push,
    t,
    updateFloorPlan,
    setSelectedCorridorId,
    setCorridorModal,
    setCorridorNameInput,
    setCorridorNameEnInput
  } = deps;
  if (!plan || !corridorModal || isReadOnly) return;
  const nextName = corridorNameInput.trim() || t({ it: 'Corridoio', en: 'Corridor' });
  const nextNameEn = corridorNameEnInput.trim() || undefined;
  const current = (plan.corridors || []) as Corridor[];
  if (corridorModal.mode === 'create') {
    const next: Corridor = {
      id: nanoid(),
      name: nextName,
      nameEn: nextNameEn,
      showName: corridorShowNameInput,
      color: '#94a3b8',
      kind: corridorModal.kind,
      points: corridorModal.points.map((p) => ({ x: p.x, y: p.y })),
      doors: [],
      connections: []
    };
    markTouched();
    updateFloorPlan(plan.id, { corridors: [...current, next] } as any);
    postAuditEvent({ event: 'corridor_create', scopeType: 'plan', scopeId: plan.id, details: { id: next.id, name: nextName, nameEn: nextNameEn || null } });
    setSelectedCorridorId(next.id);
    push(t({ it: 'Corridoio creato', en: 'Corridor created' }), 'success');
  } else {
    const next = current.map((c) =>
      c.id === corridorModal.corridorId ? { ...c, name: nextName, nameEn: nextNameEn, showName: corridorShowNameInput } : c
    );
    markTouched();
    updateFloorPlan(plan.id, { corridors: next } as any);
    postAuditEvent({
      event: 'corridor_update',
      scopeType: 'plan',
      scopeId: plan.id,
      details: { id: corridorModal.corridorId, name: nextName, nameEn: nextNameEn || null }
    });
    push(t({ it: 'Corridoio aggiornato', en: 'Corridor updated' }), 'success');
  }
  setCorridorModal(null);
  setCorridorNameInput('');
  setCorridorNameEnInput('');
};

// Closest polygon edge of a corridor to a point (edge index + projection).
export const computeGetClosestCorridorEdge = (
  corridor: Corridor,
  point: Pt,
  getCorridorPolygon: (corridor: any) => Pt[]
): { edgeIndex: number; t: number; x: number; y: number; distSq: number } | null => {
  const pts = getCorridorPolygon(corridor);
  if (pts.length < 2) return null;
  let best: { edgeIndex: number; t: number; x: number; y: number; distSq: number } | null = null;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const proj = projectPointToSegment(a, b, point);
    if (!best || proj.distSq < best.distSq) {
      best = { edgeIndex: i, t: proj.t, x: proj.x, y: proj.y, distSq: proj.distSq };
    }
  }
  return best;
};

// Point on a corridor edge at parametric position t along edgeIndex.
export const computeGetCorridorEdgePoint = (
  corridor: Corridor,
  edgeIndex: number,
  t: number,
  getCorridorPolygon: (corridor: any) => Pt[]
): Pt | null => {
  const pts = getCorridorPolygon(corridor);
  if (pts.length < 2) return null;
  const idx = ((Math.floor(edgeIndex) % pts.length) + pts.length) % pts.length;
  const a = pts[idx];
  const b = pts[(idx + 1) % pts.length];
  if (!a || !b) return null;
  const ratio = Math.max(0, Math.min(1, Number(t) || 0));
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
};

export type OpenEditCorridorDeps = {
  corridorById: Map<string, Corridor>;
  isReadOnly: boolean;
  setCorridorModal: Dispatch<SetStateAction<CorridorModalState>>;
  setCorridorNameInput: Dispatch<SetStateAction<string>>;
  setCorridorNameEnInput: Dispatch<SetStateAction<string>>;
  setCorridorShowNameInput: Dispatch<SetStateAction<boolean>>;
};

export const computeOpenEditCorridor = (corridorId: string, deps: OpenEditCorridorDeps) => {
  const { corridorById, isReadOnly, setCorridorModal, setCorridorNameInput, setCorridorNameEnInput, setCorridorShowNameInput } = deps;
  const corridor = corridorById.get(corridorId);
  if (!corridor || isReadOnly) return;
  setCorridorModal({
    mode: 'edit',
    corridorId,
    initialName: corridor.name || '',
    initialNameEn: (corridor as any).nameEn || '',
    initialShowName: corridor.showName !== false
  });
  setCorridorNameInput(corridor.name || '');
  setCorridorNameEnInput((corridor as any).nameEn || '');
  setCorridorShowNameInput(corridor.showName !== false);
};

export type CreateCorridorFromPolyDeps = {
  isReadOnly: boolean;
  plan: FloorPlan | undefined;
  t: ReturnType<typeof useT>;
  setCorridorDrawMode: (value: null) => void;
  setCorridorModal: Dispatch<SetStateAction<CorridorModalState>>;
  setCorridorNameInput: Dispatch<SetStateAction<string>>;
  setCorridorNameEnInput: Dispatch<SetStateAction<string>>;
  setCorridorShowNameInput: Dispatch<SetStateAction<boolean>>;
};

export const computeCreateCorridorFromPoly = (points: { x: number; y: number }[], deps: CreateCorridorFromPolyDeps) => {
  const { isReadOnly, plan, t, setCorridorDrawMode, setCorridorModal, setCorridorNameInput, setCorridorNameEnInput, setCorridorShowNameInput } = deps;
  if (isReadOnly || !plan) return;
  setCorridorDrawMode(null);
  const nextIndex = Math.max(1, (plan.corridors || []).length + 1);
  setCorridorModal({
    mode: 'create',
    kind: 'poly',
    points,
    initialName: t({ it: `Corridoio ${nextIndex}`, en: `Corridor ${nextIndex}` }),
    initialNameEn: `Corridor ${nextIndex}`,
    initialShowName: true
  });
  setCorridorNameInput(t({ it: `Corridoio ${nextIndex}`, en: `Corridor ${nextIndex}` }));
  setCorridorNameEnInput(`Corridor ${nextIndex}`);
  setCorridorShowNameInput(true);
};

export type UpdateCorridorLabelScaleDeps = {
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | undefined;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
};

export const computeUpdateCorridorLabelScale = (corridorId: string, delta: number, deps: UpdateCorridorLabelScaleDeps) => {
  const { isReadOnly, markTouched, plan, updateFloorPlan } = deps;
  if (isReadOnly || !plan || !corridorId || !Number.isFinite(delta)) return;
  const current = (plan.corridors || []) as Corridor[];
  const next = current.map((corridor) => {
    if (corridor.id !== corridorId) return corridor;
    const currentScale = Number.isFinite(Number((corridor as any).labelScale)) ? Number((corridor as any).labelScale) : 1;
    const nextScale = Math.max(0.6, Math.min(3, Number((currentScale + delta).toFixed(2))));
    return { ...corridor, labelScale: nextScale };
  });
  markTouched();
  updateFloorPlan(plan.id, { corridors: next } as any);
};

type CorridorConnectionModalState = {
  connectionId?: string | null;
  corridorId: string;
  edgeIndex: number;
  t: number;
  x: number;
  y: number;
  selectedPlanIds: string[];
  transitionType: 'stairs' | 'elevator';
} | null;

export type SaveCorridorConnectionModalDeps = {
  corridorConnectionModal: CorridorConnectionModalState;
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | undefined;
  push: (message: string, tone?: ToastTone) => void;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
  setCorridorConnectionModal: Dispatch<SetStateAction<CorridorConnectionModalState>>;
};

export const computeSaveCorridorConnectionModal = (deps: SaveCorridorConnectionModalDeps) => {
  const {
    corridorConnectionModal,
    isReadOnly,
    markTouched,
    plan,
    push,
    t,
    updateFloorPlan,
    setCorridorConnectionModal
  } = deps;
  if (!plan || !corridorConnectionModal || isReadOnly) return;
  const selectedPlanIds = Array.from(new Set(corridorConnectionModal.selectedPlanIds.filter(Boolean)));
  const current = (plan.corridors || []) as Corridor[];
  const isEdit = !!corridorConnectionModal.connectionId;
  const next = current.map((c) => {
    if (c.id !== corridorConnectionModal.corridorId) return c;
    const prevConnections = Array.isArray(c.connections) ? c.connections : [];
    const payload = {
      edgeIndex: corridorConnectionModal.edgeIndex,
      t: corridorConnectionModal.t,
      planIds: selectedPlanIds,
      x: corridorConnectionModal.x,
      y: corridorConnectionModal.y,
      transitionType: corridorConnectionModal.transitionType === 'elevator' ? 'elevator' : 'stairs'
    };
    if (isEdit) {
      const connectionId = String(corridorConnectionModal.connectionId);
      let found = false;
      const updated = prevConnections.map((cp) => {
        if (cp.id !== connectionId) return cp;
        found = true;
        return { ...cp, ...payload };
      });
      return {
        ...c,
        connections: found ? updated : [...updated, { id: connectionId, ...payload }]
      };
    }
    return {
      ...c,
      connections: [
        ...prevConnections,
        {
          id: nanoid(),
          ...payload
        }
      ]
    };
  });
  markTouched();
  updateFloorPlan(plan.id, { corridors: next } as any);
  push(
    isEdit
      ? t({ it: 'Punto di collegamento aggiornato', en: 'Connection point updated' })
      : t({ it: 'Punto di collegamento creato', en: 'Connection point created' }),
    'success'
  );
  setCorridorConnectionModal(null);
};

export type SaveCorridorDoorLinkModalDeps = {
  corridorDoorLinkModal: CorridorDoorLinkModalState;
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | undefined;
  push: (message: string, tone?: ToastTone) => void;
  renderPlan: FloorPlan | undefined;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
  setCorridorDoorLinkModal: Dispatch<SetStateAction<CorridorDoorLinkModalState>>;
};

export const computeSaveCorridorDoorLinkModal = (deps: SaveCorridorDoorLinkModalDeps) => {
  const {
    corridorDoorLinkModal,
    isReadOnly,
    markTouched,
    plan,
    push,
    renderPlan,
    t,
    updateFloorPlan,
    setCorridorDoorLinkModal
  } = deps;
  if (!corridorDoorLinkModal || !plan || isReadOnly) return;
  const availableRooms = ((renderPlan?.rooms || []) as Room[]).filter(Boolean);
  const validRoomIds = new Set(availableRooms.map((room) => room.id));
  const roomNameById = new Map(availableRooms.map((room) => [room.id, String(room.name || '').trim() || t({ it: 'Stanza', en: 'Room' })]));
  const selectedRoomIds = Array.from(
    new Set(corridorDoorLinkModal.selectedRoomIds.map((id) => String(id)).filter((id) => validRoomIds.has(id)))
  );
  const current = (plan.corridors || []) as Corridor[];
  const next = current.map((corridor) => {
    if (corridor.id !== corridorDoorLinkModal.corridorId) return corridor;
    return {
      ...corridor,
      doors: (corridor.doors || []).map((door) =>
        door.id === corridorDoorLinkModal.doorId
          ? {
              ...door,
              linkedRoomIds: selectedRoomIds
            }
          : door
      )
    };
  });
  markTouched();
  updateFloorPlan(plan.id, { corridors: next } as any);
  if (selectedRoomIds.length === 1) {
    const name = roomNameById.get(selectedRoomIds[0]) || t({ it: 'Stanza', en: 'Room' });
    push(t({ it: `Porta correttamente collegata con la stanza: "${name}".`, en: `Door successfully linked to room: "${name}".` }), 'success');
  } else if (selectedRoomIds.length > 1) {
    push(t({ it: 'Porta correttamente collegata alle stanze selezionate.', en: 'Door successfully linked to selected rooms.' }), 'success');
  } else {
    push(t({ it: 'Collegamenti stanza rimossi dalla porta.', en: 'Room links removed from the door.' }), 'info');
  }
  setCorridorDoorLinkModal(null);
};

export type StartRoomDoorDraftDeps = {
  getSharedRoomSides: typeof getSharedRoomSides;
  push: (message: string, tone?: ToastTone) => void;
  renderPlan: FloorPlan | undefined;
  t: ReturnType<typeof useT>;
  isReadOnlyRef: { current: boolean };
  setRoomDoorDraft: Dispatch<SetStateAction<RoomDoorDraftState>>;
  setSelectedRoomDoorId: Dispatch<SetStateAction<string | null>>;
  setContextMenu: (value: null) => void;
};

export const computeStartRoomDoorDraft = (roomAId: string, roomBId: string, deps: StartRoomDoorDraftDeps) => {
  const {
    push,
    renderPlan,
    t,
    isReadOnlyRef,
    setRoomDoorDraft,
    setSelectedRoomDoorId,
    setContextMenu
  } = deps;
  if (isReadOnlyRef.current) return;
  const currentPlan = renderPlan as FloorPlan | undefined;
  if (!currentPlan) return;
  const roomA = ((currentPlan.rooms || []) as Room[]).find((room) => room.id === roomAId);
  const roomB = ((currentPlan.rooms || []) as Room[]).find((room) => room.id === roomBId);
  if (!roomA || !roomB) return;
  const sharedSides = getSharedRoomSides(roomA, roomB);
  if (!sharedSides.length) {
    push(
      t({
        it: 'Le due stanze devono condividere un lato sovrapposto per creare una porta di collegamento.',
        en: 'The two rooms must share an overlapping side to create a connecting door.'
      }),
      'danger'
    );
    return;
  }
  setRoomDoorDraft({ roomAId, roomBId, sharedSides });
  setSelectedRoomDoorId(null);
  setContextMenu(null);
  push(
    t({
      it: 'Seleziona sul perimetro condiviso di una delle due stanze il punto in cui inserire la porta.',
      en: 'Select on the shared perimeter of one of the two rooms where to place the door.'
    }),
    'info'
  );
};
