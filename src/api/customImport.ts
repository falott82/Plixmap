export interface ImportConfigSafe {
  clientId: string;
  url: string;
  username: string;
  bodyJson: string;
  hasPassword: boolean;
  updatedAt: number;
}

export interface ExternalUserRow {
  clientId: string;
  externalId: string;
  firstName: string;
  lastName: string;
  role: string;
  dept1: string;
  dept2: string;
  dept3: string;
  email: string;
  ext1: string;
  ext2: string;
  ext3: string;
  isExternal: boolean;
  hidden: boolean;
  present: boolean;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export const getImportConfig = async (clientId: string): Promise<{ config: ImportConfigSafe | null }> => {
  const qs = new URLSearchParams({ clientId });
  const res = await fetch(`/api/import/config?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load import config (${res.status})`);
  return res.json();
};

export const saveImportConfig = async (payload: {
  clientId: string;
  url: string;
  username: string;
  password?: string;
  bodyJson?: string;
}): Promise<{ ok: boolean; config: ImportConfigSafe }> => {
  const res = await fetch(`/api/import/config`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to save import config (${res.status})`);
  return res.json();
};

export const testImport = async (
  clientId: string
): Promise<{ ok: boolean; status: number; count?: number; preview?: any[]; error?: string; contentType?: string; rawSnippet?: string }> => {
  const res = await fetch(`/api/import/test`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    return {
      ok: false,
      status: body?.status || res.status,
      error: body?.error || `HTTP ${res.status}`,
      contentType: body?.contentType,
      rawSnippet: body?.rawSnippet
    };
  return body;
};

export const syncImport = async (
  clientId: string
): Promise<{
  ok: boolean;
  summary: any;
  created: any[];
  updated: any[];
  missing: { externalId: string; firstName: string; lastName: string }[];
  error?: string;
  contentType?: string;
  rawSnippet?: string;
}> => {
  const res = await fetch(`/api/import/sync`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    return {
      ok: false,
      summary: null,
      created: [],
      updated: [],
      missing: [],
      error: body?.error || `HTTP ${res.status}`,
      contentType: body?.contentType,
      rawSnippet: body?.rawSnippet
    } as any;
  return body;
};

export const listExternalUsers = async (params: {
  clientId: string;
  q?: string;
  includeHidden?: boolean;
  includeMissing?: boolean;
}): Promise<{ ok: true; rows: ExternalUserRow[] }> => {
  const qs = new URLSearchParams({ clientId: params.clientId });
  if (params.q) qs.set('q', params.q);
  if (params.includeHidden) qs.set('includeHidden', '1');
  if (params.includeMissing) qs.set('includeMissing', '1');
  const res = await fetch(`/api/external-users?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load external users (${res.status})`);
  return res.json();
};

export const setExternalUserHidden = async (payload: { clientId: string; externalId: string; hidden: boolean }): Promise<void> => {
  const res = await fetch(`/api/external-users/hide`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update external user (${res.status})`);
};

export const diffImport = async (clientId: string): Promise<{
  ok: boolean;
  remoteCount: number;
  localCount: number;
  newCount: number;
  updatedCount: number;
  missingCount: number;
  newSample: { externalId: string; firstName: string; lastName: string }[];
  missingSample: { externalId: string; firstName: string; lastName: string }[];
  error?: string;
  contentType?: string;
  rawSnippet?: string;
}> => {
  const res = await fetch(`/api/import/diff`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, remoteCount: 0, localCount: 0, newCount: 0, updatedCount: 0, missingCount: 0, newSample: [], missingSample: [], error: body?.error || `HTTP ${res.status}`, contentType: body?.contentType, rawSnippet: body?.rawSnippet } as any;
  }
  return body;
};

export const clearImport = async (clientId: string): Promise<{ ok: boolean; removedUsers: number; removedObjects: number }> => {
  const res = await fetch(`/api/import/clear`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  if (!res.ok) throw new Error(`Failed to clear import (${res.status})`);
  return res.json();
};
