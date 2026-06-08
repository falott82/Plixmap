import { useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import { runAddTypeToPalette } from './planViewComputeBits2';

// Palette favorite add/remove handlers extracted from usePlanView. Bodies are
// verbatim (store + profile API used directly); shared deps injected once.
export const usePlanPaletteFavoriteHandlers = (deps: any) => {
  const { isDoorType, push, t } = deps;

  const addTypeToPalette = useCallback(
    async (typeId: string) => {
      await runAddTypeToPalette(typeId, { isDoorType, push, t });
    },
    [isDoorType, push, t]
  );

  const removeTypeFromPalette = useCallback(
    async (typeId: string) => {
      const user = useAuthStore.getState().user as any;
      const enabled = Array.isArray(user?.paletteFavorites) ? (user.paletteFavorites as string[]) : [];
      if (!enabled.includes(typeId)) return;
      const next = enabled.filter((x) => x !== typeId);
      try {
        await updateMyProfile({ paletteFavorites: next });
        useAuthStore.setState((s) =>
          s.user ? ({ user: { ...s.user, paletteFavorites: next } as any, permissions: s.permissions, hydrated: s.hydrated } as any) : s
        );
        push(t({ it: 'Oggetto rimosso dalla palette', en: 'Object removed from palette' }), 'info');
      } catch {
        push(t({ it: 'Salvataggio non riuscito', en: 'Save failed' }), 'danger');
      }
    },
    [push, t]
  );

  return { addTypeToPalette, removeTypeFromPalette };
};
