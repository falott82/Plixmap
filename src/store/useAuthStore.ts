import { create } from 'zustand';
import { AuthUser, Permission, fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth';
import { useCustomFieldsStore } from './useCustomFieldsStore';
import { useUIStore } from './useUIStore';

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
      // Avoid noisy 401s on cold start when there's no session cookie:
      // we keep a simple local hint that a login has previously succeeded.
      const sessionHint = (() => {
        try {
          return window.localStorage.getItem('deskly_session_hint') === '1';
        } catch {
          return true;
        }
      })();
      if (!sessionHint) {
        set({ user: null, permissions: [], hydrated: true });
        return;
      }
      const me = await fetchMe();
      set({ user: me.user, permissions: me.permissions, hydrated: true });
      const visibleLayers = me.user?.visibleLayerIdsByPlan;
      useUIStore.getState().setVisibleLayerIdsByPlan(
        visibleLayers && typeof visibleLayers === 'object' && !Array.isArray(visibleLayers) ? visibleLayers : {}
      );
      try {
        window.localStorage.setItem('deskly_session_hint', '1');
      } catch {}
      // Load per-user custom fields in background.
      useCustomFieldsStore.getState().hydrate().catch(() => {});
    } catch {
      try {
        window.localStorage.setItem('deskly_session_hint', '0');
      } catch {}
      set({ user: null, permissions: [], hydrated: true });
    }
  },
  login: async (username, password, otp) => {
    // may throw MFARequiredError
    await apiLogin(username, password, otp);
    const me = await fetchMe();
    set({ user: me.user, permissions: me.permissions, hydrated: true });
    const visibleLayers = me.user?.visibleLayerIdsByPlan;
    useUIStore.getState().setVisibleLayerIdsByPlan(
      visibleLayers && typeof visibleLayers === 'object' && !Array.isArray(visibleLayers) ? visibleLayers : {}
    );
    try {
      window.localStorage.setItem('deskly_session_hint', '1');
    } catch {}
    useCustomFieldsStore.getState().hydrate().catch(() => {});
  },
  logout: async () => {
    try {
      await apiLogout();
    } finally {
      try {
        window.localStorage.setItem('deskly_session_hint', '0');
      } catch {}
      get().setAuth(null);
    }
  }
}));
