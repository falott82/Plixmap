import { apiFetch } from './client';

export interface ImportConfigSafe {
  clientId: string;
  url: string;
  username: string;
  method: 'GET' | 'POST' | string;
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
  mobile: string;
  ext1: string;
  ext2: string;
  ext3: string;
  isExternal: boolean;
  hidden: boolean;
  present: boolean;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
  manual?: boolean;
  sourceKind?: 'manual' | 'imported';
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

export interface ProvisionPortalUserFromImportedPayload {
  clientId: string;
  externalId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  language?: 'it' | 'en';
  access?: 'ro' | 'rw';
  chat?: boolean;
  canCreateMeetings?: boolean;
  sendEmail?: boolean;
}

export interface ProvisionPortalUserFromImportedResponse {
  ok: true;
  id: string;
  username: string;
  temporaryPassword: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedExternalClientId: string;
    linkedExternalId: string;
    mustChangePassword: boolean;
  };
  emailDelivery: {
    attempted: boolean;
    sent: boolean;
    reason?: string | null;
    messageId?: string | null;
    smtpScope?: 'client' | 'global' | null;
  };
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
  ldapConfigUpdatedAt?: number | null;
  hasWebApiConfig?: boolean;
  hasLdapConfig?: boolean;
  hasConfig: boolean;
}

export interface LdapImportConfigSafe {
  clientId: string;
  server: string;
  port: number;
  security: 'ldaps' | 'starttls' | 'ldap' | string;
  scope: 'sub' | 'one' | string;
  authType: 'anonymous' | 'simple' | 'domain_user' | 'user_principal_name' | string;
  domain: string;
  username: string;
  hasPassword: boolean;
  baseDn: string;
  userFilter: string;
  emailAttribute: string;
  firstNameAttribute: string;
  lastNameAttribute: string;
  externalIdAttribute: string;
  roleAttribute: string;
  mobileAttribute: string;
  dept1Attribute: string;
  sizeLimit: number;
  updatedAt: number;
}

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
  method?: string;
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

export const getLdapImportConfig = async (clientId: string): Promise<{ config: LdapImportConfigSafe | null }> => {
  const qs = new URLSearchParams({ clientId });
  const res = await apiFetch(`/api/import/ldap/config?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load LDAP import config (${res.status})`);
  return res.json();
};

export const saveLdapImportConfig = async (payload: {
  clientId: string;
  server: string;
  port: number;
  security: string;
  scope: string;
  authType: string;
  domain?: string;
  username?: string;
  password?: string;
  baseDn: string;
  userFilter?: string;
  emailAttribute?: string;
  firstNameAttribute?: string;
  lastNameAttribute?: string;
  externalIdAttribute?: string;
  roleAttribute?: string;
  mobileAttribute?: string;
  dept1Attribute?: string;
  sizeLimit?: number;
}): Promise<{ ok: boolean; config: LdapImportConfigSafe }> => {
  const res = await apiFetch('/api/import/ldap/config', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to save LDAP import config (${res.status})`);
  return body;
};

export const testLdapImport = async (
  clientId: string,
  config?: {
    server: string;
    port: number;
    security: string;
    scope: string;
    authType: string;
    domain?: string;
    username?: string;
    password?: string;
    baseDn: string;
    userFilter?: string;
    emailAttribute?: string;
    firstNameAttribute?: string;
    lastNameAttribute?: string;
    externalIdAttribute?: string;
    roleAttribute?: string;
    mobileAttribute?: string;
    dept1Attribute?: string;
    sizeLimit?: number;
  }
): Promise<{ ok: boolean; status: number; count?: number; preview?: ImportPreviewRow[]; error?: string }> => {
  const res = await apiFetch('/api/import/ldap/test', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, config })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: body?.status || res.status, error: body?.error || `HTTP ${res.status}` };
  return body;
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

export const createManualExternalUser = async (payload: {
  clientId: string;
  user: Partial<ExternalUserRow>;
}): Promise<{ ok: boolean; row: ExternalUserRow }> => {
  const res = await apiFetch(`/api/external-users/manual`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to create manual user (${res.status})`);
  return body;
};

export const provisionPortalUserFromImported = async (
  payload: ProvisionPortalUserFromImportedPayload
): Promise<ProvisionPortalUserFromImportedResponse> => {
  const res = await apiFetch('/api/users/provision-from-imported', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `Failed to provision portal user (${res.status})`);
    if (body?.suggestedUsername) err.suggestedUsername = body.suggestedUsername;
    if (body?.existingUserId) err.existingUserId = body.existingUserId;
    if (body?.existingUsername) err.existingUsername = body.existingUsername;
    throw err;
  }
  return body as ProvisionPortalUserFromImportedResponse;
};

export const updateManualExternalUser = async (payload: {
  clientId: string;
  externalId: string;
  user: Partial<ExternalUserRow>;
}): Promise<{ ok: boolean; row: ExternalUserRow }> => {
  const res = await apiFetch(`/api/external-users/manual`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to update manual user (${res.status})`);
  return body;
};

export const updateExternalUser = async (payload: {
  clientId: string;
  externalId: string;
  user: Partial<ExternalUserRow>;
}): Promise<{ ok: boolean; row: ExternalUserRow }> => {
  const res = await apiFetch(`/api/external-users`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to update user (${res.status})`);
  return body;
};

export const deleteManualExternalUser = async (payload: { clientId: string; externalId: string }): Promise<{ ok: boolean; removed: number }> => {
  const res = await apiFetch(`/api/external-users/manual`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to delete manual user (${res.status})`);
  return body;
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

export interface ImportPreviewRow {
  externalId: string;
  firstName: string;
  lastName: string;
  role: string;
  dept1: string;
  dept2: string;
  dept3: string;
  email: string;
  mobile: string;
  ext1: string;
  ext2: string;
  ext3: string;
  isExternal: boolean;
  importStatus: 'new' | 'update' | 'existing';
}

export interface ImportPreviewExistingRow {
  externalId: string;
  firstName: string;
  lastName: string;
  role: string;
  dept1: string;
  dept2: string;
  dept3: string;
  email: string;
  mobile: string;
  ext1: string;
  ext2: string;
  ext3: string;
  isExternal: boolean;
  hidden: boolean;
  present: boolean;
  updatedAt: number | null;
}

export interface LdapImportSkippedRow extends ImportPreviewRow {
  skipReason:
    | 'missing_email'
    | 'duplicate_email_in_ldap'
    | 'duplicate_external_id_in_ldap'
    | 'already_present_email'
    | 'already_present_external_id';
  existingExternalId?: string;
}

export interface LdapImportPreviewResponse {
  ok: boolean;
  clientId: string;
  remoteCount: number;
  importableCount: number;
  existingCount: number;
  skippedCount: number;
  importableRows: ImportPreviewRow[];
  existingRows: (ImportPreviewExistingRow & { clientId?: string })[];
  skippedRows: LdapImportSkippedRow[];
  error?: string;
}

export const previewImport = async (clientId: string): Promise<{
  ok: boolean;
  clientId: string;
  remoteCount: number;
  existingCount: number;
  remoteRows: ImportPreviewRow[];
  existingRows: ImportPreviewExistingRow[];
  error?: string;
  contentType?: string;
  rawSnippet?: string;
}> => {
  const res = await apiFetch(`/api/import/preview`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, clientId, remoteCount: 0, existingCount: 0, remoteRows: [], existingRows: [], error: body?.error || `HTTP ${res.status}`, contentType: body?.contentType, rawSnippet: body?.rawSnippet } as any;
  return body;
};

export const previewLdapImport = async (
  clientId: string,
  config?: {
    server: string;
    port: number;
    security: string;
    scope: string;
    authType: string;
    domain?: string;
    username?: string;
    password?: string;
    baseDn: string;
    userFilter?: string;
    emailAttribute?: string;
    firstNameAttribute?: string;
    lastNameAttribute?: string;
    externalIdAttribute?: string;
    roleAttribute?: string;
    mobileAttribute?: string;
    dept1Attribute?: string;
    sizeLimit?: number;
  }
): Promise<LdapImportPreviewResponse> => {
  const res = await apiFetch('/api/import/ldap/preview', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, config })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      clientId,
      remoteCount: 0,
      importableCount: 0,
      existingCount: 0,
      skippedCount: 0,
      importableRows: [],
      existingRows: [],
      skippedRows: [],
      error: body?.error || `HTTP ${res.status}`
    };
  }
  return body;
};

export const syncLdapImport = async (
  clientId: string,
  config?: {
    server: string;
    port: number;
    security: string;
    scope: string;
    authType: string;
    domain?: string;
    username?: string;
    password?: string;
    baseDn: string;
    userFilter?: string;
    emailAttribute?: string;
    firstNameAttribute?: string;
    lastNameAttribute?: string;
    externalIdAttribute?: string;
    roleAttribute?: string;
    mobileAttribute?: string;
    dept1Attribute?: string;
    sizeLimit?: number;
  },
  selectedExternalIds?: string[],
  overridesByExternalId?: Record<string, Partial<ImportPreviewRow>>
): Promise<{
  ok: boolean;
  clientId: string;
  preview: LdapImportPreviewResponse;
  summary: {
    fetched: number;
    importable: number;
    selected?: number;
    existing: number;
    skipped: number;
    created: number;
    updated: number;
  };
  created: ImportPreviewRow[];
  updated: ImportPreviewRow[];
  skippedRows: LdapImportSkippedRow[];
  error?: string;
}> => {
  const res = await apiFetch('/api/import/ldap/sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, config, selectedExternalIds, overridesByExternalId })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      clientId,
      preview: {
        ok: false,
        clientId,
        remoteCount: 0,
        importableCount: 0,
        existingCount: 0,
        skippedCount: 0,
        importableRows: [],
        existingRows: [],
        skippedRows: []
      },
      summary: { fetched: 0, importable: 0, selected: 0, existing: 0, skipped: 0, created: 0, updated: 0 },
      created: [],
      updated: [],
      skippedRows: [],
      error: body?.error || `HTTP ${res.status}`
    };
  }
  return body;
};

export const importOneWebApiUser = async (payload: { clientId: string; externalId: string; user?: Partial<ImportPreviewRow> }): Promise<{ ok: boolean; externalId: string; summary: any; created: any[]; updated: any[] }> => {
  const res = await apiFetch(`/api/import/import-one`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to import user (${res.status})`);
  return body;
};

export const deleteOneImportedUser = async (payload: { clientId: string; externalId: string }): Promise<{ ok: boolean; externalId: string; removedUsers: number; removedObjects: number }> => {
  const res = await apiFetch(`/api/import/delete-one`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to delete user (${res.status})`);
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
  clientId: string
): Promise<{ ok: boolean; status: number; count?: number; preview?: any[]; error?: string; contentType?: string; rawSnippet?: string }> => {
  const res = await apiFetch('/api/device-import/test', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
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

export const previewDeviceImport = async (clientId: string): Promise<{
  ok: boolean;
  clientId: string;
  remoteCount: number;
  existingCount: number;
  remoteRows: Array<
    ExternalDeviceRow & {
      importStatus: 'new' | 'update' | 'existing';
    }
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
    body: JSON.stringify({ clientId })
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

export const deleteOneImportedDevice = async (payload: { clientId: string; devId: string }) => {
  const res = await apiFetch('/api/device-import/delete-one', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Failed to delete device (${res.status})`);
  return body as { ok: boolean; devId: string; removedDevices: number };
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
