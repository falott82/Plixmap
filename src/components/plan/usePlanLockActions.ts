/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { computeHandleUnlockResponse } from './planViewLockMeetingTools';
import type { UnlockRequestLock } from './UnlockRequestComposeModal';
import type { PresenceUser } from './usePlanLockState';

// Late lock action handlers (respond to an unlock prompt, open the unlock-compose modal, execute a
// force-unlock) extracted from usePlanView. They consume usePlanLockState returns + the save-revision
// handlers, so they're placed after both. Bodies + dep arrays moved verbatim.
export const usePlanLockActions = (deps: any) => {
  const {
    LOCK_TOAST_MS, hasNavigationEdits, plan, planId, push, pushStack, resetTouched, revertUnsavedChanges,
    saveRevisionForUnlock, sendWs, t, getPlanSnapshot, unlockBusy, unlockPrompt, entrySnapshotRef, planRef,
    setUnlockBusy, setUnlockPrompt, user, setUnlockCompose, setForceUnlockIncoming
  } = deps;

  const handleUnlockResponse = useCallback(
    async (action: 'grant' | 'grant_save' | 'grant_discard' | 'deny') =>
      computeHandleUnlockResponse(action, {
        LOCK_TOAST_MS, hasNavigationEdits, plan, push, pushStack, resetTouched,
        revertUnsavedChanges, saveRevisionForUnlock, sendWs, t, getPlanSnapshot, unlockBusy,
        unlockPrompt, entrySnapshotRef, planRef, setUnlockBusy,
        setUnlockPrompt
      }),
    [
      LOCK_TOAST_MS, hasNavigationEdits, plan, push, pushStack, resetTouched,
      revertUnsavedChanges, saveRevisionForUnlock, sendWs, t, getPlanSnapshot, unlockBusy,
      unlockPrompt, setUnlockBusy, setUnlockPrompt, entrySnapshotRef, planRef
    ]
  );

  const openUnlockCompose = useCallback(
    (userEntry: PresenceUser) => {
      if (!userEntry?.userId) return;
      if (userEntry.userId === user?.id) return;
      const lockList: UnlockRequestLock[] =
        Array.isArray((userEntry as any).locks) && (userEntry as any).locks.length
          ? (userEntry as any).locks
          : (userEntry as any).lock
            ? [(userEntry as any).lock]
            : [];
      if (!lockList.length) return;
      setUnlockCompose({ target: userEntry, locks: lockList });
    },
    [user?.id, setUnlockCompose]
  );

  const executeForceUnlock = useCallback(
    async (requestId: string, action: 'save' | 'discard') => {
      let ok = true;
      if (action === 'save') {
        ok = await saveRevisionForUnlock();
      } else if (action === 'discard') {
        if (hasNavigationEdits) {
          revertUnsavedChanges();
          resetTouched();
          entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
        }
      }
      // Release lock (best-effort); the server will also enforce the deadline.
      sendWs({ type: 'release_lock', planId });
      sendWs({ type: 'force_unlock_done', requestId, action, ok });
      setForceUnlockIncoming(null);
      return ok;
    },
    [hasNavigationEdits, plan, planId, resetTouched, revertUnsavedChanges, saveRevisionForUnlock, sendWs, getPlanSnapshot, setForceUnlockIncoming, entrySnapshotRef, planRef]
  );

  return { handleUnlockResponse, openUnlockCompose, executeForceUnlock };
};
