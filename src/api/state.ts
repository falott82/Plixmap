import { apiFetch } from './client';
import { Client, FloorPlan, FloorPlanRevision, ObjectTypeDefinition } from '../store/types';

export interface ServerState {
  clients: Client[];
  objectTypes?: ObjectTypeDefinition[];
  updatedAt: number | null;
}

export class StateConflictError extends Error {
  status: number;
  expectedUpdatedAt: number | null;
  currentUpdatedAt: number | null;

  constructor(message: string, payload?: { status?: number; expectedUpdatedAt?: number | null; currentUpdatedAt?: number | null }) {
    super(message);
    this.name = 'StateConflictError';
    this.status = Number(payload?.status || 409) || 409;
    this.expectedUpdatedAt = payload?.expectedUpdatedAt ?? null;
    this.currentUpdatedAt = payload?.currentUpdatedAt ?? null;
  }
}

let lastKnownStateUpdatedAt: number | null = null;

export const fetchState = async (): Promise<ServerState> => {
  const res = await apiFetch('/api/state', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch state (${res.status})`);
  const payload = await res.json();
  lastKnownStateUpdatedAt = Number(payload?.updatedAt || 0) || null;
  return payload;
};

export const saveState = async (
  clients: Client[],
  objectTypes?: ObjectTypeDefinition[],
  options?: { signal?: AbortSignal; replacePlanRevisions?: boolean }
): Promise<{ ok: boolean; updatedAt: number; clients?: Client[]; objectTypes?: ObjectTypeDefinition[] }> => {
  const res = await apiFetch('/api/state', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options?.signal,
    body: JSON.stringify({
      clients,
      objectTypes,
      updatedAt: lastKnownStateUpdatedAt,
      replacePlanRevisions: !!options?.replacePlanRevisions
    })
  });
  if (!res.ok) {
    if (res.status === 409) {
      const payload = await res.json().catch(() => null);
      throw new StateConflictError(`Failed to save state (${res.status})`, {
        status: res.status,
        expectedUpdatedAt: Number(payload?.expectedUpdatedAt || 0) || null,
        currentUpdatedAt: Number(payload?.currentUpdatedAt || 0) || null
      });
    }
    throw new Error(`Failed to save state (${res.status})`);
  }
  const payload = await res.json();
  lastKnownStateUpdatedAt = Number(payload?.updatedAt || 0) || lastKnownStateUpdatedAt;
  return payload;
};

export const fetchPlanRevisions = async (planId: string): Promise<{ planId: string; revisions: FloorPlanRevision[] }> => {
  const res = await apiFetch(`/api/plans/${encodeURIComponent(planId)}/revisions`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch plan revisions (${res.status})`);
  return res.json();
};

export const savePlanState = async (
  planId: string,
  plan: FloorPlan,
  revisions: FloorPlanRevision[],
  options?: { signal?: AbortSignal }
): Promise<{ ok: boolean; updatedAt: number; plan: FloorPlan; revisions: FloorPlanRevision[] }> => {
  const { revisions: _ignored, ...planWithoutRevisions } = (plan || {}) as FloorPlan;
  const revisionsLoaded = !!(plan as any)?.revisionsLoaded;
  const res = await apiFetch(`/api/plans/${encodeURIComponent(planId)}/state`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options?.signal,
    body: JSON.stringify({
      updatedAt: lastKnownStateUpdatedAt,
      plan: planWithoutRevisions,
      ...(revisionsLoaded ? { revisions } : {})
    })
  });
  if (!res.ok) {
    if (res.status === 409) {
      const payload = await res.json().catch(() => null);
      throw new StateConflictError(`Failed to save plan state (${res.status})`, {
        status: res.status,
        expectedUpdatedAt: Number(payload?.expectedUpdatedAt || 0) || null,
        currentUpdatedAt: Number(payload?.currentUpdatedAt || 0) || null
      });
    }
    throw new Error(`Failed to save plan state (${res.status})`);
  }
  const payload = await res.json();
  lastKnownStateUpdatedAt = Number(payload?.updatedAt || 0) || lastKnownStateUpdatedAt;
  return payload;
};
