import { apiFetch } from './client';

export type UserProfile = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  clientsCommon: { id: string; name: string }[];
};

export const fetchUserProfile = async (id: string): Promise<UserProfile> => {
  const res = await apiFetch(`/api/users/${encodeURIComponent(id)}/profile`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((j) => (j && typeof j === 'object' ? (j as any).error : ''))
      .catch(() => '');
    throw new Error(detail || `Failed to fetch user profile (${res.status})`);
  }
  return res.json();
};

