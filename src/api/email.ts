export interface EmailSettings {
  host: string;
  port: number;
  secure: boolean;
  securityMode?: 'ssl' | 'starttls';
  username: string;
  fromName: string;
  fromEmail: string;
  hasPassword: boolean;
  updatedAt?: number | null;
}

export interface EmailLogRow {
  id: number;
  ts: number;
  userId?: string | null;
  username?: string | null;
  recipient?: string | null;
  subject?: string | null;
  success: boolean;
  error?: string | null;
  details?: string | null;
}

export const fetchEmailSettings = async (): Promise<EmailSettings | null> => {
  const res = await fetch('/api/settings/email', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch email settings (${res.status})`);
  const body = await res.json();
  return body?.config || null;
};

export const updateEmailSettings = async (payload: {
  host?: string;
  port?: number | string;
  secure?: boolean;
  securityMode?: 'ssl' | 'starttls';
  username?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
}): Promise<EmailSettings | null> => {
  const res = await fetch('/api/settings/email', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update email settings (${res.status})`);
  const body = await res.json();
  return body?.config || null;
};

export const sendTestEmail = async (
  recipient: string,
  subject?: string
): Promise<{ ok: boolean; messageId?: string | null }> => {
  const res = await fetch('/api/settings/email/test', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, subject })
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.error || '';
    } catch {
      // ignore
    }
    throw new Error(detail || `Failed to send test email (${res.status})`);
  }
  return res.json();
};

export const fetchEmailLogs = async (params?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: EmailLogRow[]; limit: number; offset: number; total: number }> => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const res = await fetch(`/api/settings/email/logs?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch email logs (${res.status})`);
  return res.json();
};

export const clearEmailLogs = async (): Promise<{ ok: boolean; deleted?: number }> => {
  const res = await fetch('/api/settings/email/logs/clear', { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to clear email logs (${res.status})`);
  return res.json();
};
