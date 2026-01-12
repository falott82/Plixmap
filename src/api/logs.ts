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

export const fetchLogsMeta = async (): Promise<LogsMeta> => {
  const res = await fetch('/api/settings/logs-meta', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch logs meta (${res.status})`);
  const body = await res.json();
  return body?.meta || {};
};
