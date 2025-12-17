import { create } from 'zustand';
import { AuthUser, Permission, fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  permissions: Permission[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (payload: { user: AuthUser; permissions: Permission[] } | null) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  permissions: [],
  hydrated: false,
  setAuth: (payload) =>
    set(
      payload
        ? { user: payload.user, permissions: payload.permissions, hydrated: true }
        : { user: null, permissions: [], hydrated: true }
    ),
  hydrate: async () => {
    try {
      const me = await fetchMe();
      set({ user: me.user, permissions: me.permissions, hydrated: true });
    } catch {
      set({ user: null, permissions: [], hydrated: true });
    }
  },
  login: async (username, password) => {
    await apiLogin(username, password);
    const me = await fetchMe();
    set({ user: me.user, permissions: me.permissions, hydrated: true });
  },
  logout: async () => {
    try {
      await apiLogout();
    } finally {
      get().setAuth(null);
    }
  }
}));
