import { apiFetch } from './client';
import type { ImportSummaryRow } from './customImport';

// Device import (Web API / CSV / manual) — split from customImport.ts to keep
// the users and devices surfaces independently readable.

export interface DeviceImportConfigSafe {
  clientId: string;
  url: string;
  username: string;
  method: 'GET' | 'POST' | string;
  bodyJson: string;
  hasPassword: boolean;
  updatedAt: number;
}

export interface ExternalDeviceRow {
  clientId: string;
  devId: string;
  deviceType: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  hidden: boolean;
  present: boolean;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
  manual?: boolean;
  sourceKind?: 'manual' | 'imported';
  importStatus?: 'new' | 'update' | 'existing';
  changes?: Array<{
    field: 'deviceName' | 'deviceType' | 'manufacturer' | 'model' | 'serialNumber' | 'present';
    previous: string;
    next: string;
  }>;
}

export interface ExternalDevicesResponse {
  ok: true;
  clientId: string;
  clientName?: string | null;
  total: number;
  presentCount: number;
  missingCount: number;
  hiddenCount: number;
  rows: ExternalDeviceRow[];
}

export const getDeviceImportConfig = async (clientId: string): Promise<{ config: DeviceImportConfigSafe | null }> => {
  const qs = new URLSearchParams({ clientId });
  const res = await apiFetch(`/api/device-import/config?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load device import config (${res.status})`);
  return res.json();
};

export const saveDeviceImportConfig = async (payload: {
  clientId: string;
  url: string;
  username: string;
  password?: string;
  method?: string;
  bodyJson?: string;
}): Promise<{ ok: boolean; config: DeviceImportConfigSafe }> => {
  const res = await apiFetch('/api/device-import/config', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to save device import config (${res.status})`);
  return res.json();
};

export const testDeviceImport = async (
  clientId: string,
  config?: {
    url: string;
    username: string;
    password?: string;
    method?: string;
    bodyJson?: string;
  }
): Promise<{ ok: boolean; status: number; count?: number; preview?: any[]; error?: string; contentType?: string; rawSnippet?: string }> => {
  const res = await apiFetch('/api/device-import/test', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, config })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: body?.status || res.status,
      error: body?.error || `HTTP ${res.status}`,
      contentType: body?.contentType,
      rawSnippet: body?.rawSnippet
    };
  }
  return body;
};

export const syncDeviceImport = async (clientId: string) => {
  const res = await apiFetch('/api/device-import/sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
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
  }
  return body;
};

export const importDeviceCsv = async (payload: { clientId: string; csvText: string; mode: 'append' | 'replace' }) => {
  const res = await apiFetch('/api/device-import/csv', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to import devices CSV (${res.status})`);
  return body;
};

export const previewDeviceImport = async (
  clientId: string,
  config?: {
    url: string;
    username: string;
    password?: string;
    method?: string;
    bodyJson?: string;
  }
): Promise<{
  ok: boolean;
  clientId: string;
  remoteCount: number;
  existingCount: number;
  remoteRows: Array<
    ExternalDeviceRow
  >;
  existingRows: ExternalDeviceRow[];
  error?: string;
  contentType?: string;
  rawSnippet?: string;
}> => {
  const res = await apiFetch('/api/device-import/preview', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, config })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    return {
      ok: false,
      clientId,
      remoteCount: 0,
      existingCount: 0,
      remoteRows: [],
      existingRows: [],
      error: body?.error || `HTTP ${res.status}`,
      contentType: body?.contentType,
      rawSnippet: body?.rawSnippet
    } as any;
  return body;
};

export const importOneWebApiDevice = async (payload: { clientId: string; devId: string; device?: Partial<ExternalDeviceRow> }) => {
  const res = await apiFetch('/api/device-import/import-one', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to import device (${res.status})`);
  return body as { ok: boolean; devId: string; summary: any; created: any[]; updated: any[] };
};

export const importManyWebApiDevices = async (payload: {
  clientId: string;
  devIds: string[];
  devices?: Array<Partial<ExternalDeviceRow>>;
  config?: {
    url: string;
    username: string;
    password?: string;
    method?: string;
    bodyJson?: string;
  };
}) => {
  const res = await apiFetch('/api/device-import/import-many', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to import selected devices (${res.status})`);
  return body as {
    ok: boolean;
    clientId: string;
    requestedCount: number;
    importedCount: number;
    missingDevIds: string[];
    summary: any;
    created: any[];
    updated: any[];
  };
};

export const deleteOneImportedDevice = async (payload: { clientId: string; devId: string }) => {
  const res = await apiFetch('/api/device-import/delete-one', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to delete device (${res.status})`);
  return body as {
    ok: boolean;
    devId: string;
    removedDevices: number;
    removedIds?: string[];
    missingIds?: string[];
    placementInfo?: { supported: boolean; linkedPlanObjects: number; warning?: string };
  };
};

export const deleteManyImportedDevices = async (payload: { clientId: string; devIds: string[] }) => {
  const res = await apiFetch('/api/device-import/delete-many', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to delete selected devices (${res.status})`);
  return body as {
    ok: boolean;
    clientId: string;
    requestedCount: number;
    removedDevices: number;
    removedIds: string[];
    missingIds: string[];
    placementInfo?: { supported: boolean; linkedPlanObjects: number; warning?: string };
  };
};

export const clearDeviceImport = async (clientId: string): Promise<{ ok: boolean; removedDevices: number }> => {
  const res = await apiFetch('/api/device-import/clear', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  if (!res.ok) throw new Error(`Failed to clear device import (${res.status})`);
  return res.json();
};

export const fetchDeviceImportSummary = async (): Promise<{ ok: true; rows: ImportSummaryRow[] }> => {
  const res = await apiFetch('/api/device-import/summary', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load device import summary (${res.status})`);
  return res.json();
};

export const listExternalDevices = async (params: {
  clientId: string;
  q?: string;
  includeHidden?: boolean;
  includeMissing?: boolean;
}): Promise<ExternalDevicesResponse> => {
  const qs = new URLSearchParams({ clientId: params.clientId });
  if (params.q) qs.set('q', params.q);
  if (params.includeHidden) qs.set('includeHidden', '1');
  if (params.includeMissing) qs.set('includeMissing', '1');
  const res = await apiFetch(`/api/external-devices?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load external devices (${res.status})`);
  return res.json();
};

export const setExternalDeviceHidden = async (payload: { clientId: string; devId: string; hidden: boolean }): Promise<void> => {
  const res = await apiFetch('/api/external-devices/hide', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update external device (${res.status})`);
};

export const createManualExternalDevice = async (payload: {
  clientId: string;
  device: Partial<ExternalDeviceRow>;
}): Promise<{ ok: boolean; row: ExternalDeviceRow }> => {
  const res = await apiFetch('/api/external-devices/manual', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to create manual device (${res.status})`);
  return body;
};

export const updateManualExternalDevice = async (payload: {
  clientId: string;
  devId: string;
  device: Partial<ExternalDeviceRow>;
}): Promise<{ ok: boolean; row: ExternalDeviceRow }> => {
  const res = await apiFetch('/api/external-devices/manual', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to update manual device (${res.status})`);
  return body;
};

export const deleteManualExternalDevice = async (payload: { clientId: string; devId: string }): Promise<{ ok: boolean; removed: number }> => {
  const res = await apiFetch('/api/external-devices/manual', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to delete manual device (${res.status})`);
  return body;
};
