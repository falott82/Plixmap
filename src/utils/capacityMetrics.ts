import { Client, MapObject, Room } from '../store/types';

const USER_TYPE_SET = new Set(['user', 'real_user', 'generic_user']);

const toFinitePositiveInt = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
};

const toFinitePositive = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

const normalizeLabel = (value: unknown): string => String(value || '').trim();

const normalizeTagList = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const key = normalizeLabel(raw);
    if (!key) continue;
    const folded = key.toLocaleLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(key);
  }
  return out;
};

const collectObjectDepartments = (obj: MapObject): string[] => {
  return normalizeTagList([(obj as any).externalDept1, (obj as any).externalDept2, (obj as any).externalDept3]);
};

const sumNullable = (values: Array<number | null | undefined>): number => {
  return values.reduce((acc: number, value) => acc + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
};

export interface CapacityRoomMetric {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  roomId: string;
  roomName: string;
  logical: boolean;
  capacity: number | null;
  userCount: number;
  freeSeats: number | null;
  overCapacity: boolean;
  saturationPct: number | null;
  surfaceSqm: number | null;
  usersPerSqm: number | null;
  sqmPerUser: number | null;
  departmentTags: string[];
}

export interface CapacityFloorMetric {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  roomsCount: number;
  overCapacityRooms: number;
  unlimitedRooms: number;
  totalCapacity: number;
  totalUsers: number;
  totalSurfaceSqm: number;
  occupancyPct: number | null;
  usersPerSqm: number | null;
  sqmPerUser: number | null;
  rooms: CapacityRoomMetric[];
}

export interface CapacitySiteMetric {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  floorsCount: number;
  roomsCount: number;
  totalCapacity: number;
  totalUsers: number;
  totalSurfaceSqm: number;
  overCapacityRooms: number;
  occupancyPct: number | null;
  usersPerSqm: number | null;
  sqmPerUser: number | null;
  departmentPool: string[];
  floors: CapacityFloorMetric[];
}

export interface CapacityClientMetric {
  clientId: string;
  clientName: string;
  sitesCount: number;
  floorsCount: number;
  roomsCount: number;
  totalCapacity: number;
  totalUsers: number;
  totalSurfaceSqm: number;
  overCapacityRooms: number;
  occupancyPct: number | null;
  usersPerSqm: number | null;
  sqmPerUser: number | null;
  departmentPool: string[];
  sites: CapacitySiteMetric[];
}

export interface CapacityMetricsSummary {
  generatedAt: number;
  clientsCount: number;
  sitesCount: number;
  floorsCount: number;
  roomsCount: number;
  totalCapacity: number;
  totalUsers: number;
  totalSurfaceSqm: number;
  overCapacityRooms: number;
  occupancyPct: number | null;
  usersPerSqm: number | null;
  sqmPerUser: number | null;
  clients: CapacityClientMetric[];
}

export const buildCapacityMetrics = (clients: Client[]): CapacityMetricsSummary => {
  const clientMetrics: CapacityClientMetric[] = [];
  let sitesCount = 0;
  let floorsCount = 0;
  let roomsCount = 0;
  let totalCapacity = 0;
  let totalUsers = 0;
  let totalSurfaceSqm = 0;
  let overCapacityRooms = 0;

  for (const client of clients || []) {
    const clientId = String(client?.id || '');
    if (!clientId) continue;
    const clientName = normalizeLabel(client.shortName) || normalizeLabel(client.name) || clientId;

    const siteMetrics: CapacitySiteMetric[] = [];
    const clientDeptSet = new Set<string>();
    let clientFloors = 0;
    let clientRooms = 0;
    let clientCapacity = 0;
    let clientUsers = 0;
    let clientSurface = 0;
    let clientOverCapacity = 0;

    for (const site of client.sites || []) {
      const siteId = String(site?.id || '');
      if (!siteId) continue;
      const siteName = normalizeLabel(site.name) || siteId;
      const floorMetrics: CapacityFloorMetric[] = [];
      const siteDeptSet = new Set<string>();
      let siteRooms = 0;
      let siteCapacity = 0;
      let siteUsers = 0;
      let siteSurface = 0;
      let siteOverCapacity = 0;

      for (const plan of site.floorPlans || []) {
        const planId = String(plan?.id || '');
        if (!planId) continue;
        const planName = normalizeLabel(plan.name) || planId;
        const rooms = ((plan as any)?.rooms || []) as Room[];
        const objects = ((plan as any)?.objects || []) as MapObject[];
        const roomStats = new Map<string, { users: number; departments: string[] }>();

        for (const obj of objects) {
          const roomId = String((obj as any)?.roomId || '').trim();
          if (!roomId || !USER_TYPE_SET.has(String(obj?.type || ''))) continue;
          const prev = roomStats.get(roomId) || { users: 0, departments: [] };
          prev.users += 1;
          for (const dept of collectObjectDepartments(obj)) {
            if (!prev.departments.includes(dept)) prev.departments.push(dept);
          }
          roomStats.set(roomId, prev);
        }

        const roomMetrics: CapacityRoomMetric[] = [];
        let floorCapacity = 0;
        let floorUsers = 0;
        let floorSurface = 0;
        let floorOverCapacity = 0;
        let floorUnlimitedRooms = 0;

        for (const room of rooms) {
          const roomId = String(room?.id || '');
          if (!roomId) continue;
          const roomName = normalizeLabel((room as any)?.nameEn) || normalizeLabel(room.name) || roomId;
          const capacity = toFinitePositiveInt((room as any)?.capacity);
          const surfaceSqm = toFinitePositive((room as any)?.surfaceSqm);
          const stats = roomStats.get(roomId);
          const userCount = Number(stats?.users || 0);
          const freeSeats = capacity === null ? null : Math.max(capacity - userCount, 0);
          const overCapacity = capacity !== null && userCount > capacity;
          const saturationPct = capacity !== null && capacity > 0 ? (userCount / capacity) * 100 : null;
          const usersPerSqm = surfaceSqm && surfaceSqm > 0 ? userCount / surfaceSqm : null;
          const sqmPerUser = userCount > 0 && surfaceSqm && surfaceSqm > 0 ? surfaceSqm / userCount : null;
          const departmentTags = normalizeTagList([...(room as any)?.departmentTags || [], ...(stats?.departments || [])]);

          for (const dept of departmentTags) {
            siteDeptSet.add(dept);
            clientDeptSet.add(dept);
          }

          roomMetrics.push({
            clientId,
            clientName,
            siteId,
            siteName,
            planId,
            planName,
            roomId,
            roomName,
            logical: !!(room as any)?.logical,
            capacity,
            userCount,
            freeSeats,
            overCapacity,
            saturationPct,
            surfaceSqm,
            usersPerSqm,
            sqmPerUser,
            departmentTags
          });

          if (capacity !== null) floorCapacity += capacity;
          else floorUnlimitedRooms += 1;
          floorUsers += userCount;
          floorSurface += surfaceSqm || 0;
          if (overCapacity) floorOverCapacity += 1;
        }

        const floorOccupancy = floorCapacity > 0 ? (floorUsers / floorCapacity) * 100 : null;
        const floorUsersPerSqm = floorSurface > 0 ? floorUsers / floorSurface : null;
        const floorSqmPerUser = floorUsers > 0 && floorSurface > 0 ? floorSurface / floorUsers : null;

        const floorMetric: CapacityFloorMetric = {
          clientId,
          clientName,
          siteId,
          siteName,
          planId,
          planName,
          roomsCount: roomMetrics.length,
          overCapacityRooms: floorOverCapacity,
          unlimitedRooms: floorUnlimitedRooms,
          totalCapacity: floorCapacity,
          totalUsers: floorUsers,
          totalSurfaceSqm: floorSurface,
          occupancyPct: floorOccupancy,
          usersPerSqm: floorUsersPerSqm,
          sqmPerUser: floorSqmPerUser,
          rooms: roomMetrics
        };

        floorMetrics.push(floorMetric);
        floorMetrics.sort((a, b) => a.planName.localeCompare(b.planName));

        siteRooms += floorMetric.roomsCount;
        siteCapacity += floorMetric.totalCapacity;
        siteUsers += floorMetric.totalUsers;
        siteSurface += floorMetric.totalSurfaceSqm;
        siteOverCapacity += floorMetric.overCapacityRooms;
      }

      const siteOccupancy = siteCapacity > 0 ? (siteUsers / siteCapacity) * 100 : null;
      const siteUsersPerSqm = siteSurface > 0 ? siteUsers / siteSurface : null;
      const siteSqmPerUser = siteUsers > 0 && siteSurface > 0 ? siteSurface / siteUsers : null;

      const siteMetric: CapacitySiteMetric = {
        clientId,
        clientName,
        siteId,
        siteName,
        floorsCount: floorMetrics.length,
        roomsCount: siteRooms,
        totalCapacity: siteCapacity,
        totalUsers: siteUsers,
        totalSurfaceSqm: siteSurface,
        overCapacityRooms: siteOverCapacity,
        occupancyPct: siteOccupancy,
        usersPerSqm: siteUsersPerSqm,
        sqmPerUser: siteSqmPerUser,
        departmentPool: Array.from(siteDeptSet).sort((a, b) => a.localeCompare(b)),
        floors: floorMetrics.sort((a, b) => a.planName.localeCompare(b.planName))
      };

      siteMetrics.push(siteMetric);
      sitesCount += 1;
      floorsCount += siteMetric.floorsCount;
      roomsCount += siteMetric.roomsCount;
      totalCapacity += siteMetric.totalCapacity;
      totalUsers += siteMetric.totalUsers;
      totalSurfaceSqm += siteMetric.totalSurfaceSqm;
      overCapacityRooms += siteMetric.overCapacityRooms;

      clientFloors += siteMetric.floorsCount;
      clientRooms += siteMetric.roomsCount;
      clientCapacity += siteMetric.totalCapacity;
      clientUsers += siteMetric.totalUsers;
      clientSurface += siteMetric.totalSurfaceSqm;
      clientOverCapacity += siteMetric.overCapacityRooms;
    }

    if (!siteMetrics.length) continue;

    const clientOccupancy = clientCapacity > 0 ? (clientUsers / clientCapacity) * 100 : null;
    const clientUsersPerSqm = clientSurface > 0 ? clientUsers / clientSurface : null;
    const clientSqmPerUser = clientUsers > 0 && clientSurface > 0 ? clientSurface / clientUsers : null;

    clientMetrics.push({
      clientId,
      clientName,
      sitesCount: siteMetrics.length,
      floorsCount: clientFloors,
      roomsCount: clientRooms,
      totalCapacity: clientCapacity,
      totalUsers: clientUsers,
      totalSurfaceSqm: clientSurface,
      overCapacityRooms: clientOverCapacity,
      occupancyPct: clientOccupancy,
      usersPerSqm: clientUsersPerSqm,
      sqmPerUser: clientSqmPerUser,
      departmentPool: Array.from(clientDeptSet).sort((a, b) => a.localeCompare(b)),
      sites: siteMetrics.sort((a, b) => a.siteName.localeCompare(b.siteName))
    });
  }

  clientMetrics.sort((a, b) => a.clientName.localeCompare(b.clientName));
  const occupancyPct = totalCapacity > 0 ? (totalUsers / totalCapacity) * 100 : null;
  const usersPerSqm = totalSurfaceSqm > 0 ? totalUsers / totalSurfaceSqm : null;
  const sqmPerUser = totalUsers > 0 && totalSurfaceSqm > 0 ? totalSurfaceSqm / totalUsers : null;

  return {
    generatedAt: Date.now(),
    clientsCount: clientMetrics.length,
    sitesCount,
    floorsCount,
    roomsCount,
    totalCapacity,
    totalUsers,
    totalSurfaceSqm,
    overCapacityRooms,
    occupancyPct,
    usersPerSqm,
    sqmPerUser,
    clients: clientMetrics
  };
};

export const findCapacityClientMetric = (summary: CapacityMetricsSummary, clientId?: string | null) => {
  if (!summary.clients.length) return null;
  const key = String(clientId || '').trim();
  if (!key) return summary.clients[0];
  return summary.clients.find((entry) => entry.clientId === key) || summary.clients[0];
};

export const findCapacitySiteMetric = (
  clientMetric: CapacityClientMetric | null | undefined,
  siteId?: string | null
) => {
  if (!clientMetric?.sites?.length) return null;
  const key = String(siteId || '').trim();
  if (!key) return clientMetric.sites[0];
  return clientMetric.sites.find((entry) => entry.siteId === key) || clientMetric.sites[0];
};

export const formatRatioSafe = (value: number | null, decimals = 2): string => {
  if (value === null || !Number.isFinite(value)) return '--';
  return value.toFixed(decimals);
};

export const sumRoomCapacities = (rooms: CapacityRoomMetric[]): number => {
  return sumNullable(rooms.map((room) => room.capacity));
};
