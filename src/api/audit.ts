export type AuditLevel = 'important' | 'verbose';

export interface AuditRow {
  id: number;
  ts: number;
  level: AuditLevel;
  event: string;
  userId?: string | null;
  username?: string | null;
  ip?: string | null;
  method?: string | null;
  path?: string | null;
  userAgent?: string | null;
  scopeType?: string | null;
  scopeId?: string | null;
  details?: any;
}

export const postAuditEvent = async (payload: {
  event: string;
  level?: AuditLevel;
  scopeType?: string;
  scopeId?: string;
  details?: any;
}): Promise<void> => {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // best-effort
  }
};

export const getAuditSettings = async (): Promise<{ auditVerbose: boolean }> => {
  const res = await fetch('/api/settings/audit', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch audit settings (${res.status})`);
  return res.json();
};

export const setAuditSettings = async (payload: { auditVerbose: boolean }): Promise<{ ok: boolean; auditVerbose: boolean }> => {
  const res = await fetch('/api/settings/audit', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update audit settings (${res.status})`);
  return res.json();
};

export const fetchAuditTrail = async (params?: {
  q?: string;
  level?: 'all' | AuditLevel;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AuditRow[]; limit: number; offset: number }> => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.level) qs.set('level', params.level);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const res = await fetch(`/api/audit?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch audit trail (${res.status})`);
  return res.json();
};

