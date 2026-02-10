import { apiFetch } from './client';

export type UserDirectoryRow = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
};

export const fetchUserDirectory = async (): Promise<{ users: UserDirectoryRow[] }> => {
  const res = await apiFetch('/api/users/directory', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch user directory (${res.status})`);
  return res.json();
};

