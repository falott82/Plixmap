import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { Client, FloorPlan, FloorPlanRevision, FloorPlanView, MapObject, MapObjectType, ObjectTypeDefinition, Room, Site } from './types';
import { defaultData, defaultObjectTypes } from './data';

interface DataState {
  clients: Client[];
  objectTypes: ObjectTypeDefinition[];
  version: number;
  savedVersion: number;
  setServerState: (payload: { clients: Client[]; objectTypes?: ObjectTypeDefinition[] }) => void;
  setClients: (clients: Client[]) => void;
  markSaved: () => void;
  addObjectType: (payload: { id: string; nameIt: string; nameEn: string; icon: ObjectTypeDefinition['icon'] }) => void;
  updateObjectType: (id: string, payload: Partial<{ nameIt: string; nameEn: string; icon: ObjectTypeDefinition['icon'] }>) => void;
  deleteObjectType: (id: string) => void;
  addClient: (name: string) => string;
  updateClient: (
    id: string,
    payload: Partial<
      Pick<
        Client,
        'name' | 'logoUrl' | 'shortName' | 'address' | 'phone' | 'email' | 'vatId' | 'pecEmail' | 'description' | 'attachments'
      >
    >
  ) => void;
  deleteClient: (id: string) => void;
  addSite: (clientId: string, name: string) => string;
  updateSite: (id: string, name: string) => void;
  deleteSite: (id: string) => void;
  addFloorPlan: (siteId: string, name: string, imageUrl: string, width?: number, height?: number) => string;
  updateFloorPlan: (id: string, payload: Partial<Pick<FloorPlan, 'name' | 'imageUrl' | 'width' | 'height'>>) => void;
  deleteFloorPlan: (id: string) => void;
  reorderFloorPlans: (siteId: string, movingPlanId: string, targetPlanId: string, before?: boolean) => void;
  setFloorPlanContent: (
    floorPlanId: string,
    payload: Pick<FloorPlan, 'imageUrl' | 'width' | 'height' | 'objects' | 'rooms' | 'views'>
  ) => void;
  addObject: (floorPlanId: string, type: MapObjectType, name: string, description: string | undefined, x: number, y: number, scale?: number) => string;
  updateObject: (id: string, changes: Partial<Pick<MapObject, 'name' | 'description' | 'scale' | 'roomId'>>) => void;
  moveObject: (id: string, x: number, y: number) => void;
  deleteObject: (id: string) => void;
  clearObjects: (floorPlanId: string) => void;
  setObjectRoomIds: (floorPlanId: string, roomIdByObjectId: Record<string, string | undefined>) => void;
  addRoom: (floorPlanId: string, room: Omit<Room, 'id'>) => string;
  updateRoom: (floorPlanId: string, roomId: string, changes: Partial<Omit<Room, 'id'>>) => void;
  deleteRoom: (floorPlanId: string, roomId: string) => void;
  addRevision: (floorPlanId: string, payload?: { name?: string; description?: string; bump?: 'major' | 'minor' }) => string;
  restoreRevision: (floorPlanId: string, revisionId: string) => void;
  deleteRevision: (floorPlanId: string, revisionId: string) => void;
  clearRevisions: (floorPlanId: string) => void;
  findFloorPlan: (id: string) => FloorPlan | undefined;
  findClientByPlan: (planId: string) => Client | undefined;
  findSiteByPlan: (planId: string) => Site | undefined;
  addView: (floorPlanId: string, view: Omit<FloorPlanView, 'id'>) => string;
  updateView: (floorPlanId: string, viewId: string, changes: Partial<Omit<FloorPlanView, 'id'>>) => void;
  deleteView: (floorPlanId: string, viewId: string) => void;
  setDefaultView: (floorPlanId: string, viewId: string) => void;
}

const updateFloorPlanById = (
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

const updateSiteById = (clients: Client[], siteId: string, update: (site: Site) => Site): Client[] => {
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

const updateObjectById = (
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

const getLatestRev = (plan: FloorPlan): { major: number; minor: number } => {
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

const nextRev = (plan: FloorPlan, bump: 'major' | 'minor') => {
  const latest = getLatestRev(plan);
  if (bump === 'major') return { major: latest.major + 1, minor: 0 };
  return { major: latest.major, minor: latest.minor + 1 };
};

const snapshotRevision = (
  plan: FloorPlan,
  rev: { major: number; minor: number },
  payload?: { name?: string; description?: string }
): FloorPlanRevision => {
  const now = Date.now();
  const baseName = payload?.name?.trim() || 'Snapshot';
  return {
    id: nanoid(),
    createdAt: now,
    revMajor: rev.major,
    revMinor: rev.minor,
    name: baseName,
    description: payload?.description?.trim() || undefined,
    imageUrl: plan.imageUrl,
    width: plan.width,
    height: plan.height,
    views: plan.views ? plan.views.map((v) => ({ ...v, pan: { ...v.pan } })) : undefined,
    rooms: plan.rooms ? plan.rooms.map((r) => ({ ...r })) : undefined,
    objects: plan.objects.map((o) => ({ ...o }))
  };
};

export const useDataStore = create<DataState>()(
  (set, get) => ({
    clients: defaultData(),
    objectTypes: defaultObjectTypes,
    version: 0,
    savedVersion: 0,
    setServerState: ({ clients, objectTypes }) =>
      set((state) => {
        const nextVersion = state.version + 1;
        return {
          clients,
          objectTypes: Array.isArray(objectTypes) && objectTypes.length ? objectTypes : state.objectTypes,
          version: nextVersion,
          savedVersion: nextVersion
        };
      }),
    setClients: (clients) =>
      set((state) => {
        const nextVersion = state.version + 1;
        return { clients, version: nextVersion, savedVersion: nextVersion };
      }),
    markSaved: () => set((state) => ({ savedVersion: state.version })),
    addObjectType: ({ id, nameIt, nameEn, icon }) => {
      const key = String(id).trim();
      if (!key) return;
      set((state) => {
        if (state.objectTypes.some((t) => t.id === key)) return state;
        return {
          objectTypes: [
            ...state.objectTypes,
            { id: key, name: { it: String(nameIt).trim() || key, en: String(nameEn).trim() || key }, icon, builtin: false }
          ],
          version: state.version + 1
        } as any;
      });
    },
    updateObjectType: (id, payload) => {
      set((state) => ({
        objectTypes: state.objectTypes.map((t) =>
          t.id !== id
            ? t
            : {
                ...t,
                icon: payload.icon ?? t.icon,
                name: {
                  it: payload.nameIt !== undefined ? String(payload.nameIt).trim() || t.name.it : t.name.it,
                  en: payload.nameEn !== undefined ? String(payload.nameEn).trim() || t.name.en : t.name.en
                }
              }
        ),
        version: state.version + 1
      }));
    },
    deleteObjectType: (id) => {
      set((state) => {
        const target = state.objectTypes.find((t) => t.id === id);
        if (!target || target.builtin) return state;
        // prevent deletion if used by any object
        const used = state.clients.some((c) =>
          c.sites.some((s) => s.floorPlans.some((p) => p.objects.some((o) => o.type === id)))
        );
        if (used) return state;
        return { objectTypes: state.objectTypes.filter((t) => t.id !== id), version: state.version + 1 } as any;
      });
    },
      addClient: (name) => {
        const id = nanoid();
        set((state) => ({ clients: [...state.clients, { id, name, sites: [] }], version: state.version + 1 }));
        return id;
      },
      updateClient: (id, payload) => {
        set((state) => ({
          clients: state.clients.map((c) => (c.id === id ? { ...c, ...payload } : c)),
          version: state.version + 1
        }));
      },
      deleteClient: (id) => {
        set((state) => ({ clients: state.clients.filter((c) => c.id !== id), version: state.version + 1 }));
      },
      addSite: (clientId, name) => {
        const id = nanoid();
        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === clientId
              ? { ...client, sites: [...client.sites, { id, clientId, name, floorPlans: [] }] }
              : client
          ),
          version: state.version + 1
        }));
        return id;
      },
      updateSite: (id, name) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.map((site) => (site.id === id ? { ...site, name } : site))
          })),
          version: state.version + 1
        }));
      },
      deleteSite: (id) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.filter((site) => site.id !== id)
          })),
          version: state.version + 1
        }));
      },
      addFloorPlan: (siteId, name, imageUrl, width, height) => {
        const id = nanoid();
        set((state) => {
          const nextClients = updateSiteById(state.clients, siteId, (site) => {
            const existing = site.floorPlans || [];
            const maxOrder = Math.max(
              -1,
              ...existing.map((p) => (typeof (p as any).order === 'number' ? (p as any).order : -1))
            );
            const newPlan: FloorPlan = {
              id,
              siteId,
              name,
              imageUrl,
              order: maxOrder + 1,
              width,
              height,
              objects: []
            };
            return { ...site, floorPlans: [...existing, newPlan] };
          });
          return { clients: nextClients, version: state.version + 1 };
        });
        return id;
      },
      updateFloorPlan: (id, payload) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.map((site) => ({
              ...site,
              floorPlans: site.floorPlans.map((plan) =>
                plan.id === id ? { ...plan, ...payload } : plan
              )
            }))
          })),
          version: state.version + 1
        }));
      },
      deleteFloorPlan: (id) => {
        set((state) => ({
          clients: state.clients.map((client) => ({
            ...client,
            sites: client.sites.map((site) => ({
              ...site,
              floorPlans: site.floorPlans.filter((plan) => plan.id !== id)
            }))
          })),
          version: state.version + 1
        }));
      },
      reorderFloorPlans: (siteId, movingPlanId, targetPlanId, before = true) => {
        set((state) => {
          const nextClients = updateSiteById(state.clients, siteId, (site) => {
            const list = (site.floorPlans || []).slice();
            const from = list.findIndex((p) => p.id === movingPlanId);
            const to = list.findIndex((p) => p.id === targetPlanId);
            if (from === -1 || to === -1 || movingPlanId === targetPlanId) return site;
            const [moving] = list.splice(from, 1);
            const insertAt = before ? (from < to ? to - 1 : to) : from < to ? to : to + 1;
            list.splice(Math.max(0, Math.min(list.length, insertAt)), 0, moving);
            const normalized = list.map((p, idx) => ({ ...p, order: idx }));
            return { ...site, floorPlans: normalized };
          });
          return { clients: nextClients, version: state.version + 1 };
        });
      },
      setFloorPlanContent: (floorPlanId, payload) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            imageUrl: payload.imageUrl,
            width: payload.width,
            height: payload.height,
            objects: Array.isArray(payload.objects) ? payload.objects : [],
            rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
            views: Array.isArray(payload.views) ? payload.views : []
          })),
          version: state.version + 1
        }));
      },
      addObject: (floorPlanId, type, name, description, x, y, scale = 1) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            objects: [...plan.objects, { id, floorPlanId, type, name, description, x, y, scale }]
          })),
          version: state.version + 1
        }));
        return id;
      },
      updateObject: (id, changes) => {
        set((state) => ({
          clients: updateObjectById(state.clients, id, (obj) => ({ ...obj, ...changes })),
          version: state.version + 1
        }));
      },
      moveObject: (id, x, y) => {
        set((state) => ({
          clients: updateObjectById(state.clients, id, (obj) => ({ ...obj, x, y })),
          version: state.version + 1
        }));
      },
      deleteObject: (id) => {
        set((state) => ({
          clients: updateObjectById(state.clients, id, () => null),
          version: state.version + 1
        }));
      },
      clearObjects: (floorPlanId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({ ...plan, objects: [] })),
          version: state.version + 1
        }));
      },
      setObjectRoomIds: (floorPlanId, roomIdByObjectId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            objects: plan.objects.map((obj) => {
              if (!Object.prototype.hasOwnProperty.call(roomIdByObjectId, obj.id)) return obj;
              const nextRoomId = roomIdByObjectId[obj.id];
              if ((obj.roomId ?? undefined) === (nextRoomId ?? undefined)) return obj;
              return { ...obj, roomId: nextRoomId };
            })
          })),
          version: state.version + 1
        }));
      },
      addRoom: (floorPlanId, room) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rooms: [...(plan.rooms || []), { id, ...room }]
          })),
          version: state.version + 1
        }));
        return id;
      },
      updateRoom: (floorPlanId, roomId, changes) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rooms: (plan.rooms || []).map((r) => (r.id === roomId ? { ...r, ...changes } : r))
          })),
          version: state.version + 1
        }));
      },
      deleteRoom: (floorPlanId, roomId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            rooms: (plan.rooms || []).filter((r) => r.id !== roomId),
            objects: plan.objects.map((o) => (o.roomId === roomId ? { ...o, roomId: undefined } : o))
          })),
          version: state.version + 1
        }));
      },
      addRevision: (floorPlanId, payload) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => {
            const bump = payload?.bump || 'minor';
            const rev = (plan.revisions || []).length ? nextRev(plan, bump) : { major: 1, minor: 0 };
            const revision = snapshotRevision(plan, rev, payload);
            revision.id = id;
            const existing = plan.revisions || [];
            return { ...plan, revisions: [revision, ...existing] };
          }),
          version: state.version + 1
        }));
        return id;
      },
      restoreRevision: (floorPlanId, revisionId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => {
            const rev = (plan.revisions || []).find((r) => r.id === revisionId);
            if (!rev) return plan;
            return {
              ...plan,
              imageUrl: rev.imageUrl,
              width: rev.width,
              height: rev.height,
              objects: Array.isArray(rev.objects) ? rev.objects : [],
              rooms: Array.isArray(rev.rooms) ? rev.rooms : [],
              views: Array.isArray(rev.views) ? rev.views : []
            };
          }),
          version: state.version + 1
        }));
      },
      deleteRevision: (floorPlanId, revisionId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            revisions: (plan.revisions || []).filter((r) => r.id !== revisionId)
          })),
          version: state.version + 1
        }));
      },
      clearRevisions: (floorPlanId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({ ...plan, revisions: [] })),
          version: state.version + 1
        }));
      },
      findFloorPlan: (id) => {
        const clients = get().clients;
        for (const client of clients) {
          for (const site of client.sites) {
            const found = site.floorPlans.find((p) => p.id === id);
            if (found) return found;
          }
        }
        return undefined;
      },
      findClientByPlan: (planId) => {
        return get().clients.find((client) =>
          client.sites.some((site) => site.floorPlans.some((plan) => plan.id === planId))
        );
      },
      findSiteByPlan: (planId) => {
        for (const client of get().clients) {
          for (const site of client.sites) {
            if (site.floorPlans.some((plan) => plan.id === planId)) return site;
          }
        }
        return undefined;
      },
      addView: (floorPlanId, view) => {
        const id = nanoid();
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => {
            const existing = plan.views || [];
            const nextViews = view.isDefault ? existing.map((v) => ({ ...v, isDefault: false })) : existing;
            return { ...plan, views: [...nextViews, { id, ...view }] };
          }),
          version: state.version + 1
        }));
        return id;
      },
      updateView: (floorPlanId, viewId, changes) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            views: (plan.views || []).map((v) => (v.id === viewId ? { ...v, ...changes } : v))
          })),
          version: state.version + 1
        }));
      },
      deleteView: (floorPlanId, viewId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            views: (plan.views || []).filter((v) => v.id !== viewId)
          })),
          version: state.version + 1
        }));
      },
      setDefaultView: (floorPlanId, viewId) => {
        set((state) => ({
          clients: updateFloorPlanById(state.clients, floorPlanId, (plan) => ({
            ...plan,
            views: (plan.views || []).map((v) => ({ ...v, isDefault: v.id === viewId }))
          })),
          version: state.version + 1
        }));
      }
  })
);
