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

export interface ExternalUsersResponse {
  ok: true;
  clientId: string;
  clientName?: string | null;
  total: number;
  presentCount: number;
  missingCount: number;
  hiddenCount: number;
  rows: ExternalUserRow[];
}

export interface ImportSummaryRow {
  clientId: string;
  clientName: string;
  lastImportAt: number | null;
  total: number;
  presentCount: number;
  missingCount: number;
  hiddenCount: number;
  configUpdatedAt: number | null;
  hasConfig: boolean;
}

export const getImportConfig = async (clientId: string): Promise<{ config: ImportConfigSafe | null }> => {
  const qs = new URLSearchParams({ clientId });
  const res = await apiFetch(`/api/import/config?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
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
  const res = await apiFetch(`/api/import/config`, {
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
  const res = await apiFetch(`/api/import/test`, {
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
  const res = await apiFetch(`/api/import/sync`, {
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
  limit?: number;
  offset?: number;
}): Promise<ExternalUsersResponse> => {
  const qs = new URLSearchParams({ clientId: params.clientId });
  if (params.q) qs.set('q', params.q);
  if (params.includeHidden) qs.set('includeHidden', '1');
  if (params.includeMissing) qs.set('includeMissing', '1');
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const res = await apiFetch(`/api/external-users?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load external users (${res.status})`);
  return res.json();
};

export const fetchImportSummary = async (): Promise<{ ok: true; rows: ImportSummaryRow[] }> => {
  const res = await apiFetch(`/api/import/summary`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load import summary (${res.status})`);
  return res.json();
};

export const setExternalUserHidden = async (payload: { clientId: string; externalId: string; hidden: boolean }): Promise<void> => {
  const res = await apiFetch(`/api/external-users/hide`, {
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
  const res = await apiFetch(`/api/import/diff`, {
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
  const res = await apiFetch(`/api/import/clear`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  if (!res.ok) throw new Error(`Failed to clear import (${res.status})`);
  return res.json();
};

export const importCsv = async (payload: { clientId: string; csvText: string; mode: 'append' | 'replace' }) => {
  const res = await apiFetch(`/api/import/csv`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to import CSV (${res.status})`);
  return body;
};

export const hasExternalUsers = async (clientId: string): Promise<boolean> => {
  const res = await listExternalUsers({ clientId, includeHidden: true, includeMissing: true, limit: 1 });
  return (res.rows || []).length > 0;
};
import { apiFetch } from './client';
