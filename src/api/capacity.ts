import { apiFetch } from './client';

export interface CapacityHistorySiteSnapshot {
  siteId: string;
  siteName: string;
  totalCapacity: number;
  totalUsers: number;
  totalSurfaceSqm: number;
  roomsCount: number;
  floorsCount: number;
}

export interface CapacityHistoryClientSnapshot {
  clientId: string;
  clientName: string;
  totalCapacity: number;
  totalUsers: number;
  totalSurfaceSqm: number;
  roomsCount: number;
  floorsCount: number;
  sitesCount: number;
  sites: CapacityHistorySiteSnapshot[];
}

export interface CapacityHistorySnapshot {
  at: number;
  clients: CapacityHistoryClientSnapshot[];
}

export interface CapacityHistoryResponse {
  ok: true;
  snapshots: CapacityHistorySnapshot[];
  lastSnapshotAt: number | null;
}

export const fetchCapacityHistory = async (clientId?: string): Promise<CapacityHistoryResponse> => {
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/capacity/history${suffix}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load capacity history (${res.status})`);
  return res.json();
};

export const createCapacitySnapshot = async (force = false): Promise<{ ok: boolean; appended: boolean; snapshotAt: number; totalSnapshots: number }> => {
  const res = await apiFetch('/api/capacity/snapshot', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: !!force })
  });
  if (!res.ok) throw new Error(`Failed to create capacity snapshot (${res.status})`);
  return res.json();
};
