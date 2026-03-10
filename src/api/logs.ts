import { apiFetch } from './client';

export type LogsClearMeta = {
  clearedAt?: number | null;
  userId?: string | null;
  username?: string | null;
};

export type LogsMeta = {
  auth?: LogsClearMeta;
  mail?: LogsClearMeta;
  audit?: LogsClearMeta;
};

export type LogRetentionKind = 'auth' | 'mail' | 'audit';

export type LogRetentionRule = {
  days: number;
  autoCleanup: boolean;
};

export type LogRetentionSettings = Record<LogRetentionKind, LogRetentionRule>;

export type LogRetentionPreviewRow = {
  kind: LogRetentionKind;
  days: number;
  autoCleanup: boolean;
  cutoffTs: number;
  count: number;
  oldestTs?: number | null;
  newestTs?: number | null;
};

export type LogRetentionPreview = {
  now: number;
  settings: LogRetentionSettings;
  totalCount: number;
  byKind: Record<LogRetentionKind, LogRetentionPreviewRow>;
};

export const fetchLogsMeta = async (): Promise<LogsMeta> => {
  const res = await apiFetch('/api/settings/logs-meta', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch logs meta (${res.status})`);
  const body = await res.json();
  return body?.meta || {};
};

export const fetchLogRetentionSettings = async (): Promise<LogRetentionSettings> => {
  const res = await apiFetch('/api/settings/logs-retention', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch log retention settings (${res.status})`);
  const body = await res.json();
  return body?.settings;
};

export const previewLogRetention = async (settings: LogRetentionSettings): Promise<LogRetentionPreview> => {
  const res = await apiFetch('/api/settings/logs-retention/preview', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings })
  });
  if (!res.ok) throw new Error(`Failed to preview log retention (${res.status})`);
  const body = await res.json();
  return body?.preview;
};

export const exportExpiredLogsCsv = async (kind: LogRetentionKind, settings: LogRetentionSettings): Promise<Blob> => {
  const res = await apiFetch('/api/settings/logs-retention/export', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, settings })
  });
  if (!res.ok) throw new Error(`Failed to export expired logs (${res.status})`);
  return res.blob();
};

export const saveLogRetentionSettings = async (
  settings: LogRetentionSettings,
  options?: { purgeNow?: boolean }
): Promise<{ ok: boolean; settings: LogRetentionSettings; preview: LogRetentionPreview; purgeSummary?: any }> => {
  const res = await apiFetch('/api/settings/logs-retention', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, purgeNow: options?.purgeNow !== false })
  });
  if (!res.ok) throw new Error(`Failed to save log retention settings (${res.status})`);
  return res.json();
};
