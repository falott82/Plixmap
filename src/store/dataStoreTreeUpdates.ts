import type { Client, Site, FloorPlan, MapObject } from './types';

// Pure immutable client-tree update helpers + revision math, extracted verbatim from
// useDataStore to keep that file under 2k lines. They take clients/plan and return new
// references (structural sharing) with no dependency on the store itself.

export const updateFloorPlanById = (
  clients: Client[],
  floorPlanId: string,
  update: (plan: FloorPlan) => FloorPlan
): Client[] => {
  for (let ci = 0; ci < clients.length; ci++) {
    const client = clients[ci];
    for (let si = 0; si < client.sites.length; si++) {
      const site = client.sites[si];
      const pi = site.floorPlans.findIndex((p) => p.id === floorPlanId);
      if (pi === -1) continue;
      const prevPlan = site.floorPlans[pi];
      const nextPlan = update(prevPlan);
      if (nextPlan === prevPlan) return clients;

      const nextPlans = site.floorPlans.slice();
      nextPlans[pi] = nextPlan;
      const nextSite: Site = { ...site, floorPlans: nextPlans };
      const nextSites = client.sites.slice();
      nextSites[si] = nextSite;
      const nextClient: Client = { ...client, sites: nextSites };
      const nextClients = clients.slice();
      nextClients[ci] = nextClient;
      return nextClients;
    }
  }
  return clients;
};

export const updateSiteById = (clients: Client[], siteId: string, update: (site: Site) => Site): Client[] => {
  for (let ci = 0; ci < clients.length; ci++) {
    const client = clients[ci];
    const si = client.sites.findIndex((s) => s.id === siteId);
    if (si === -1) continue;
    const prevSite = client.sites[si];
    const nextSite = update(prevSite);
    if (nextSite === prevSite) return clients;
    const nextSites = client.sites.slice();
    nextSites[si] = nextSite;
    const nextClient: Client = { ...client, sites: nextSites };
    const nextClients = clients.slice();
    nextClients[ci] = nextClient;
    return nextClients;
  }
  return clients;
};

export const updateObjectById = (
  clients: Client[],
  objectId: string,
  update: (obj: MapObject) => MapObject | null
): Client[] => {
  for (let ci = 0; ci < clients.length; ci++) {
    const client = clients[ci];
    for (let si = 0; si < client.sites.length; si++) {
      const site = client.sites[si];
      for (let pi = 0; pi < site.floorPlans.length; pi++) {
        const plan = site.floorPlans[pi];
        const oi = plan.objects.findIndex((o) => o.id === objectId);
        if (oi === -1) continue;
        const prevObj = plan.objects[oi];
        const nextObj = update(prevObj);

        const nextObjects = plan.objects.slice();
        if (nextObj === null) nextObjects.splice(oi, 1);
        else nextObjects[oi] = nextObj;
        const nextPlan: FloorPlan = { ...plan, objects: nextObjects };

        const nextPlans = site.floorPlans.slice();
        nextPlans[pi] = nextPlan;
        const nextSite: Site = { ...site, floorPlans: nextPlans };
        const nextSites = client.sites.slice();
        nextSites[si] = nextSite;
        const nextClient: Client = { ...client, sites: nextSites };
        const nextClients = clients.slice();
        nextClients[ci] = nextClient;
        return nextClients;
      }
    }
  }
  return clients;
};

export const getLatestRev = (plan: FloorPlan): { major: number; minor: number } => {
  const revisions: any[] = plan.revisions || [];
  const first = revisions[0];
  if (first && typeof first.revMajor === 'number' && typeof first.revMinor === 'number') {
    return { major: first.revMajor, minor: first.revMinor };
  }
  // Back-compat: previously stored numeric `version` as 1..N
  if (first && typeof first.version === 'number') {
    return { major: 1, minor: Math.max(0, Number(first.version) - 1) };
  }
  return { major: 1, minor: 0 };
};

export const nextRev = (plan: FloorPlan, bump: 'major' | 'minor') => {
  const latest = getLatestRev(plan);
  if (bump === 'major') return { major: latest.major + 1, minor: 0 };
  return { major: latest.major, minor: latest.minor + 1 };
};
