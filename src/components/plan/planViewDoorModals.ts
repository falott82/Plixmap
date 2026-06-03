import type { Corridor, ObjectTypeDefinition, RoomConnectionDoor } from '../../store/types';
import { normalizeDoorVerificationHistory } from './planViewUtils';

// Body-extraction of usePlanView door/connection modal openers. Bodies moved verbatim; closed-over
// values passed via `deps` (mirroring each useCallback dependency array). Wrappers + dep arrays in
// usePlanView are unchanged.

export type OpenCorridorDoorModalDeps = {
  corridorById: Map<string, Corridor>;
  defaultDoorCatalogId: string;
  doorTypeIdSet: Set<string>;
  objectTypeById: Map<string, ObjectTypeDefinition>;
  setCorridorDoorModal: (v: any) => void;
};

export const runOpenCorridorDoorModal = (corridorId: string, doorId: string, deps: OpenCorridorDoorModalDeps): void => {
  const { corridorById, defaultDoorCatalogId, doorTypeIdSet, objectTypeById, setCorridorDoorModal } = deps;
      const corridor = corridorById.get(corridorId);
      const door = (corridor?.doors || []).find((d) => d.id === doorId);
      if (!corridor || !door) return;
      const rawCatalogTypeId = typeof (door as any)?.catalogTypeId === 'string' ? String((door as any).catalogTypeId) : '';
      const catalogTypeId = defaultDoorCatalogId || (doorTypeIdSet.has(rawCatalogTypeId) ? rawCatalogTypeId : '');
      const doorType = catalogTypeId ? (objectTypeById.get(catalogTypeId) as ObjectTypeDefinition | undefined) : undefined;
      const defaultEmergency = !!(doorType as any)?.doorConfig?.isEmergency;
      setCorridorDoorModal({
        corridorId,
        doorId,
        description: typeof (door as any)?.description === 'string' ? String((door as any).description) : '',
        isEmergency: typeof (door as any)?.isEmergency === 'boolean' ? !!(door as any).isEmergency : defaultEmergency,
        isMainEntrance: !!(door as any)?.isMainEntrance,
        isExternal: !!(door as any)?.isExternal,
        isFireDoor: !!(door as any)?.isFireDoor,
        lastVerificationAt: typeof (door as any)?.lastVerificationAt === 'string' ? String((door as any).lastVerificationAt) : '',
        verifierCompany: typeof (door as any)?.verifierCompany === 'string' ? String((door as any).verifierCompany) : '',
        verificationHistory: normalizeDoorVerificationHistory((door as any)?.verificationHistory),
        mode: door.mode === 'auto_sensor' || door.mode === 'automated' ? door.mode : 'static',
        automationUrl: String((door as any).automationUrl || '')
      });
};

export type OpenRoomDoorModalDeps = {
  roomDoors: RoomConnectionDoor[];
  defaultDoorCatalogId: string;
  doorTypeIdSet: Set<string>;
  objectTypeById: Map<string, ObjectTypeDefinition>;
  setCorridorDoorModal: (v: any) => void;
};

export const runOpenRoomDoorModal = (doorId: string, deps: OpenRoomDoorModalDeps): void => {
  const { roomDoors, defaultDoorCatalogId, doorTypeIdSet, objectTypeById, setCorridorDoorModal } = deps;
      const door = roomDoors.find((entry) => entry.id === doorId);
      if (!door) return;
      const rawCatalogTypeId = typeof (door as any)?.catalogTypeId === 'string' ? String((door as any).catalogTypeId) : '';
      const catalogTypeId = defaultDoorCatalogId || (doorTypeIdSet.has(rawCatalogTypeId) ? rawCatalogTypeId : '');
      const doorType = catalogTypeId ? (objectTypeById.get(catalogTypeId) as ObjectTypeDefinition | undefined) : undefined;
      const defaultEmergency = !!(doorType as any)?.doorConfig?.isEmergency;
      setCorridorDoorModal({
        corridorId: '__room__',
        doorId,
        description: typeof (door as any)?.description === 'string' ? String((door as any).description) : '',
        isEmergency: typeof (door as any)?.isEmergency === 'boolean' ? !!(door as any).isEmergency : defaultEmergency,
        isMainEntrance: !!(door as any)?.isMainEntrance,
        isExternal: !!(door as any)?.isExternal,
        isFireDoor: !!(door as any)?.isFireDoor,
        lastVerificationAt: typeof (door as any)?.lastVerificationAt === 'string' ? String((door as any).lastVerificationAt) : '',
        verifierCompany: typeof (door as any)?.verifierCompany === 'string' ? String((door as any).verifierCompany) : '',
        verificationHistory: normalizeDoorVerificationHistory((door as any)?.verificationHistory),
        mode: door.mode === 'auto_sensor' || door.mode === 'automated' ? door.mode : 'static',
        automationUrl: String((door as any).automationUrl || '')
      });
};

export type OpenEditCorridorConnectionModalDeps = {
  corridorById: Map<string, Corridor>;
  getClosestCorridorEdge: (corridor: Corridor, point: { x: number; y: number }) => any;
  getCorridorEdgePoint: (corridor: Corridor, edgeIndex: number, t: number) => { x: number; y: number } | null;
  setCorridorConnectionModal: (v: any) => void;
};

export const runOpenEditCorridorConnectionModal = (
  corridorId: string,
  connectionId: string,
  point: { x: number; y: number } | undefined,
  deps: OpenEditCorridorConnectionModalDeps
): void => {
  const { corridorById, getClosestCorridorEdge, getCorridorEdgePoint, setCorridorConnectionModal } = deps;
      const corridor = corridorById.get(corridorId);
      if (!corridor) return;
      const connection = (corridor.connections || []).find((cp) => cp.id === connectionId);
      if (!connection) return;
      const fallbackPoint =
        point ||
        (Number.isFinite(Number((connection as any).x)) && Number.isFinite(Number((connection as any).y))
          ? { x: Number((connection as any).x), y: Number((connection as any).y) }
          : getCorridorEdgePoint(corridor, Number(connection.edgeIndex), Number(connection.t)));
      if (!fallbackPoint) return;
      const anchor = getClosestCorridorEdge(corridor, fallbackPoint);
      if (!anchor) return;
      setCorridorConnectionModal({
        connectionId,
        corridorId,
        edgeIndex: Number(anchor.edgeIndex),
        t: Number(anchor.t.toFixed(4)),
        x: Number(fallbackPoint.x.toFixed(3)),
        y: Number(fallbackPoint.y.toFixed(3)),
        selectedPlanIds: Array.from(new Set((connection.planIds || []).filter(Boolean))),
        transitionType: (connection as any)?.transitionType === 'elevator' ? 'elevator' : 'stairs'
      });
};
