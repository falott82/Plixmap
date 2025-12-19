import { create } from 'zustand';
import { AuthUser, Permission, fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth';
import { useCustomFieldsStore } from './useCustomFieldsStore';

interface AuthState {
  user: AuthUser | null;
  permissions: Permission[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string, otp?: string) => Promise<void>;
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
      // Load per-user custom fields in background.
      useCustomFieldsStore.getState().hydrate().catch(() => {});
    } catch {
      set({ user: null, permissions: [], hydrated: true });
    }
  },
  login: async (username, password, otp) => {
    // may throw MFARequiredError
    await apiLogin(username, password, otp);
    const me = await fetchMe();
    set({ user: me.user, permissions: me.permissions, hydrated: true });
    useCustomFieldsStore.getState().hydrate().catch(() => {});
  },
  logout: async () => {
    try {
      await apiLogout();
    } finally {
      get().setAuth(null);
    }
  }
}));
