import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { useT } from '../../i18n/useT';

type LockStateShape = {
  lockedBy: { userId: string; username: string; avatarUrl?: string } | null;
  mine: boolean;
  grant:
    | {
        userId: string;
        username: string;
        avatarUrl?: string;
        grantedAt?: number | null;
        expiresAt?: number | null;
        minutes?: number | null;
        grantedBy?: { userId: string; username: string } | null;
      }
    | null;
  meta:
    | {
        lastActionAt?: number | null;
        lastSavedAt?: number | null;
        lastSavedRev?: string | null;
      }
    | null;
};

export type UsePlanLockDeps = {
  t: ReturnType<typeof useT>;
  lockState: LockStateShape;
};

export function usePlanLock(deps: UsePlanLockDeps) {
  const { t, lockState } = deps;

		  const [lockInfoOpen, setLockInfoOpen] = useState(false);
		  const lockInfoRef = useRef<HTMLDivElement | null>(null);

	  const lockActiveTitle = t({
		    it: 'Lock esclusivo: finché è attivo, solo tu puoi modificare questa planimetria. Il lock non scade per inattività: resta attivo finché non salvi o non concedi uno sblocco.',
		    en: 'Exclusive lock: while active, only you can edit this floor plan. The lock does not expire due to inactivity: it stays active until you save or grant an unlock.'
		  });
  const lockedByTitle = t({
    it: `Lock esclusivo detenuto da ${lockState.lockedBy?.username || 'utente'}. Finché è attivo, la planimetria è in sola lettura. Puoi acquisire il lock quando torna libero.`,
    en: `Exclusive lock held by ${lockState.lockedBy?.username || 'user'}. While active, this floor plan is read-only. You can acquire the lock when it becomes available.`
  });

  const formatMinutes = useCallback((value?: number | null): string => {
    if (value === null || value === undefined) return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (n === 0.5) return '0,5';
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 10) / 10);
  }, []);

  const grantRemainingMinutes = useMemo(() => {
    const exp = Number(lockState?.grant?.expiresAt || 0);
    if (!Number.isFinite(exp) || exp <= 0) return null;
    const ms = exp - Date.now();
    if (ms <= 0) return 0;
    // Round to nearest 0.5 minute (matches SidebarTree).
    return Math.round((ms / 60_000) * 2) / 2;
  }, [lockState?.grant?.expiresAt, lockInfoOpen]);

	  useEffect(() => {
	    if (!lockInfoOpen) return;
	    const onDown = (e: MouseEvent) => {
	      if (!lockInfoRef.current) return;
	      if (!lockInfoRef.current.contains(e.target as any)) setLockInfoOpen(false);
	    };
	    window.addEventListener('mousedown', onDown);
	    return () => window.removeEventListener('mousedown', onDown);
	  }, [lockInfoOpen]);

  return {
    lockInfoOpen,
    setLockInfoOpen,
    lockInfoRef,
    lockActiveTitle,
    lockedByTitle,
    formatMinutes,
    grantRemainingMinutes
  };
}
