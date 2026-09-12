// Capacity-trend computations + history store, extracted verbatim from server/index.cjs to
// keep that file under 2k lines. Pure helpers are exported directly; the DB-backed history
// read/write pair is a factory over the app-settings accessors (which close over the DB).

const CAPACITY_HISTORY_SETTING_KEY = 'capacityHistoryV1';
const CAPACITY_HISTORY_LIMIT = 540;
const CAPACITY_SNAPSHOT_MIN_INTERVAL_MS = 60 * 60 * 1000;
const CAPACITY_USER_TYPES = new Set(['user', 'real_user', 'generic_user']);

const capacityNormalizeText = (value) => String(value || '').trim();
const capacityToPositiveInt = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
};
const capacityToPositive = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

const resolveVisibleClientsForRequest = (req, allClients) => {
  if (req.isAdmin || req.isSuperAdmin) return allClients;
  const ctx = getUserWithPermissions(db, req.userId);
  if (!ctx) return [];
  const access = computePlanAccess(allClients, ctx.permissions || []);
  return filterStateForUser(allClients, access, false, { meetingOperatorOnly: !!ctx?.user?.isMeetingOperator }) || [];
};

const buildCapacityTrendSnapshot = (clients, at = Date.now()) => {
  const clientEntries = [];
  for (const client of clients || []) {
    const clientId = String(client?.id || '').trim();
    if (!clientId) continue;
    const clientName = capacityNormalizeText(client.shortName) || capacityNormalizeText(client.name) || clientId;
    const siteEntries = [];
    let clientCapacity = 0;
    let clientUsers = 0;
    let clientSurfaceSqm = 0;
    let clientRooms = 0;
    let clientFloors = 0;

    for (const site of client?.sites || []) {
      const siteId = String(site?.id || '').trim();
      if (!siteId) continue;
      const siteName = capacityNormalizeText(site?.name) || siteId;
      let siteCapacity = 0;
      let siteUsers = 0;
      let siteSurfaceSqm = 0;
      let siteRooms = 0;
      let siteFloors = 0;

      for (const plan of site?.floorPlans || []) {
        const roomUsersById = new Map();
        for (const obj of plan?.objects || []) {
          if (!CAPACITY_USER_TYPES.has(String(obj?.type || ''))) continue;
          const roomId = String(obj?.roomId || '').trim();
          if (!roomId) continue;
          roomUsersById.set(roomId, Number(roomUsersById.get(roomId) || 0) + 1);
        }
        const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
        for (const room of rooms) {
          const roomId = String(room?.id || '').trim();
          if (!roomId) continue;
          const roomCapacity = capacityToPositiveInt(room?.capacity);
          const roomUsers = Number(roomUsersById.get(roomId) || 0);
          const surfaceSqm = capacityToPositive(room?.surfaceSqm);
          if (roomCapacity !== null) siteCapacity += roomCapacity;
          siteUsers += roomUsers;
          siteSurfaceSqm += surfaceSqm || 0;
          siteRooms += 1;
        }
        siteFloors += 1;
      }

      siteEntries.push({
        siteId,
        siteName,
        totalCapacity: siteCapacity,
        totalUsers: siteUsers,
        totalSurfaceSqm: siteSurfaceSqm,
        roomsCount: siteRooms,
        floorsCount: siteFloors
      });

      clientCapacity += siteCapacity;
      clientUsers += siteUsers;
      clientSurfaceSqm += siteSurfaceSqm;
      clientRooms += siteRooms;
      clientFloors += siteFloors;
    }

    siteEntries.sort((a, b) => a.siteName.localeCompare(b.siteName));
    clientEntries.push({
      clientId,
      clientName,
      totalCapacity: clientCapacity,
      totalUsers: clientUsers,
      totalSurfaceSqm: clientSurfaceSqm,
      roomsCount: clientRooms,
      floorsCount: clientFloors,
      sitesCount: siteEntries.length,
      sites: siteEntries
    });
  }
  clientEntries.sort((a, b) => a.clientName.localeCompare(b.clientName));
  return { at: Number(at) || Date.now(), clients: clientEntries };
};

const buildCapacitySnapshotSignature = (snapshot) => {
  return (snapshot?.clients || [])
    .map((client) => {
      const sites = (client?.sites || [])
        .map((site) => `${site.siteId}:${site.totalCapacity}:${site.totalUsers}:${site.roomsCount}:${site.floorsCount}`)
        .join(',');
      return `${client.clientId}[${sites}]`;
    })
    .join('|');
};

const sanitizeCapacitySnapshot = (entry) => {
  const at = Number(entry?.at || 0);
  if (!Number.isFinite(at) || at <= 0) return null;
  const clients = Array.isArray(entry?.clients) ? entry.clients : [];
  const sanitizedClients = [];
  for (const client of clients) {
    const clientId = String(client?.clientId || '').trim();
    if (!clientId) continue;
    const siteRows = Array.isArray(client?.sites) ? client.sites : [];
    const sites = [];
    for (const site of siteRows) {
      const siteId = String(site?.siteId || '').trim();
      if (!siteId) continue;
      sites.push({
        siteId,
        siteName: capacityNormalizeText(site?.siteName) || siteId,
        totalCapacity: Number(site?.totalCapacity || 0),
        totalUsers: Number(site?.totalUsers || 0),
        totalSurfaceSqm: Number(site?.totalSurfaceSqm || 0),
        roomsCount: Number(site?.roomsCount || 0),
        floorsCount: Number(site?.floorsCount || 0)
      });
    }
    sites.sort((a, b) => a.siteName.localeCompare(b.siteName));
    sanitizedClients.push({
      clientId,
      clientName: capacityNormalizeText(client?.clientName) || clientId,
      totalCapacity: Number(client?.totalCapacity || 0),
      totalUsers: Number(client?.totalUsers || 0),
      totalSurfaceSqm: Number(client?.totalSurfaceSqm || 0),
      roomsCount: Number(client?.roomsCount || 0),
      floorsCount: Number(client?.floorsCount || 0),
      sitesCount: Number(client?.sitesCount || sites.length || 0),
      sites
    });
  }
  sanitizedClients.sort((a, b) => a.clientName.localeCompare(b.clientName));
  return { at, clients: sanitizedClients };
};


const createCapacityHistoryStore = ({ getAppSetting, setAppSetting }) => {
const readCapacityHistory = () => {
  try {
    const raw = getAppSetting(CAPACITY_HISTORY_SETTING_KEY);
    if (!raw) return { snapshots: [], lastSignature: '', lastSnapshotAt: 0 };
    const parsed = JSON.parse(raw) || {};
    const snapshots = Array.isArray(parsed?.snapshots)
      ? parsed.snapshots.map((entry) => sanitizeCapacitySnapshot(entry)).filter(Boolean)
      : [];
    const lastSnapshotAt = Number(parsed?.lastSnapshotAt || snapshots[snapshots.length - 1]?.at || 0) || 0;
    const lastSignature = String(parsed?.lastSignature || '');
    return { snapshots, lastSignature, lastSnapshotAt };
  } catch {
    return { snapshots: [], lastSignature: '', lastSnapshotAt: 0 };
  }
};

const writeCapacityHistory = (payload) => {
  const snapshots = Array.isArray(payload?.snapshots)
    ? payload.snapshots.map((entry) => sanitizeCapacitySnapshot(entry)).filter(Boolean)
    : [];
  const trimmed = snapshots.slice(-CAPACITY_HISTORY_LIMIT);
  const lastSnapshot = trimmed[trimmed.length - 1];
  setAppSetting(
    CAPACITY_HISTORY_SETTING_KEY,
    JSON.stringify({
      snapshots: trimmed,
      lastSignature: String(payload?.lastSignature || ''),
      lastSnapshotAt: Number(payload?.lastSnapshotAt || lastSnapshot?.at || 0) || 0
    })
  );
  return trimmed;
};
  return { readCapacityHistory, writeCapacityHistory };
};

module.exports = {
  CAPACITY_SNAPSHOT_MIN_INTERVAL_MS,
  resolveVisibleClientsForRequest,
  buildCapacityTrendSnapshot,
  buildCapacitySnapshotSignature,
  createCapacityHistoryStore
};
