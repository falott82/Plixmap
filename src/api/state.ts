import { Client, ObjectTypeDefinition } from '../store/types';

export interface ServerState {
  clients: Client[];
  objectTypes?: ObjectTypeDefinition[];
  updatedAt: number | null;
}

export const fetchState = async (): Promise<ServerState> => {
  const res = await fetch('/api/state', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch state (${res.status})`);
  return res.json();
};

export const saveState = async (
  clients: Client[],
  objectTypes?: ObjectTypeDefinition[],
  options?: { signal?: AbortSignal }
): Promise<{ ok: boolean; updatedAt: number; clients?: Client[]; objectTypes?: ObjectTypeDefinition[] }> => {
  const res = await fetch('/api/state', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options?.signal,
    body: JSON.stringify({ clients, objectTypes })
  });
  if (!res.ok) throw new Error(`Failed to save state (${res.status})`);
  return res.json();
};
