export interface Permission {
  scopeType: 'client' | 'site' | 'plan';
  scopeId: string;
  access: 'ro' | 'rw';
}

export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  disabled?: boolean;
  language: 'it' | 'en';
  defaultPlanId?: string | null;
  mustChangePassword?: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export const fetchMe = async (): Promise<{ user: AuthUser; permissions: Permission[] }> => {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch me (${res.status})`);
  return res.json();
};

export const login = async (username: string, password: string): Promise<void> => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
};

export const logout = async (): Promise<void> => {
  const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`Logout failed (${res.status})`);
};

export const fetchBootstrapStatus = async (): Promise<{ showFirstRunCredentials: boolean }> => {
  const res = await fetch('/api/auth/bootstrap-status', { credentials: 'include' });
  if (!res.ok) return { showFirstRunCredentials: false };
  return res.json();
};

export const firstRunSetup = async (payload: { newPassword: string; language: 'it' | 'en' }): Promise<void> => {
  const res = await fetch('/api/auth/first-run', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`First-run setup failed (${res.status})`);
};

export const updateMyProfile = async (payload: { language?: 'it' | 'en'; defaultPlanId?: string | null }): Promise<void> => {
  const res = await fetch('/api/auth/me', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update profile (${res.status})`);
};

export interface AdminUserRow {
  id: string;
  username: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  disabled: boolean;
  language: 'it' | 'en';
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  createdAt: number;
  updatedAt: number;
  permissions: Permission[];
}

export const adminFetchUsers = async (): Promise<{ users: AdminUserRow[] }> => {
  const res = await fetch('/api/users', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
  return res.json();
};

export const adminCreateUser = async (payload: {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  language: 'it' | 'en';
  isAdmin: boolean;
  permissions: Permission[];
}): Promise<{ ok: boolean; id: string }> => {
  const res = await fetch('/api/users', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to create user (${res.status})`);
  return res.json();
};

export const adminUpdateUser = async (
  id: string,
  payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    language: 'it' | 'en';
    isAdmin: boolean;
    disabled: boolean;
    permissions: Permission[];
  }
): Promise<void> => {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to update user (${res.status})`);
};

export const changePassword = async (id: string, payload: { oldPassword?: string; newPassword: string }) => {
  const res = await fetch(`/api/users/${id}/password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to change password (${res.status})`);
};

export const adminDeleteUser = async (id: string) => {
  const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to delete user (${res.status})`);
};

export interface AuditLogRow {
  id: number;
  ts: number;
  event: string;
  success: boolean;
  userId?: string | null;
  username?: string | null;
  ip?: string | null;
  method?: string | null;
  path?: string | null;
  userAgent?: string | null;
  details?: string | null;
}

export const fetchAuditLogs = async (params?: { q?: string; limit?: number; offset?: number }): Promise<{ rows: AuditLogRow[] }> => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const res = await fetch(`/api/admin/logs?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch logs (${res.status})`);
  return res.json();
};
