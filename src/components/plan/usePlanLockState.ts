/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSyncedRef } from './useSyncedRef';
import { usePlanLock } from './usePlanLock';
import { computeFormatPresenceDate, computeFormatPresenceLock } from './planViewComputeBits';
import { runRealtimeWsEffect } from './planViewRealtime';
import { runUpdateLockedPlans } from './planViewMiscCallbacks';
import type { UnlockRequestLock } from './UnlockRequestComposeModal';
import type {
  PlanLockState, UnlockPromptState, UnlockGrantedPromptState, ForceUnlockConfigState,
  ForceUnlockActiveState, ForceUnlockIncomingState
} from './planViewStateTypes';

export type PresenceUser = {
  userId: string;
  username: string;
  avatarUrl?: string;
  connectedAt?: number | null;
  ip?: string;
  lock?: { planId: string; clientName?: string; siteName?: string; planName?: string } | null;
  locks?: { planId: string; clientName?: string; siteName?: string; planName?: string }[];
};

const LOCK_REQUEST_THROTTLE_MS = 5_000;

// Plan lock + presence + force-unlock STATE and the realtime WS effect, extracted from usePlanView.
// Owns the lock/presence/unlock/force-unlock state + refs + WS effect + sendWs + requestPlanLock +
// updateLockedPlans + the derived lock flags. The late unlock/force-unlock ACTION handlers stay in
// the host (they also need save-hook outputs) and consume these returns. Bodies moved verbatim.
export const usePlanLockState = (deps: any) => {
  const { t, user, planAccess, activeRevision, planId, perfEnabled, pushStack, setLockedPlans, planRef, LOCK_TOAST_MS } = deps;

  const [lockState, setLockState] = useState<PlanLockState>({ lockedBy: null, mine: false, grant: null, meta: null });
  const {
    lockInfoOpen, setLockInfoOpen, lockInfoRef, lockActiveTitle, lockedByTitle, formatMinutes,
    grantRemainingMinutes
  } = usePlanLock({ t, lockState });
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [globalPresenceUsers, setGlobalPresenceUsers] = useState<PresenceUser[]>([]);
  const [realtimeDisabled, setRealtimeDisabled] = useState(false);
  const realtimeDisabledRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lockRequestAtRef = useRef(0);
  const [unlockPrompt, setUnlockPrompt] = useState<UnlockPromptState>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockCompose, setUnlockCompose] = useState<{ target: PresenceUser; locks: UnlockRequestLock[] } | null>(null);
  const [unlockGrantedPrompt, setUnlockGrantedPrompt] = useState<UnlockGrantedPromptState>(null);
  const [forceUnlockConfig, setForceUnlockConfig] = useState<ForceUnlockConfigState>(null);
  const [forceUnlockGraceMinutes, setForceUnlockGraceMinutes] = useState(5);
  const [forceUnlockStarting, setForceUnlockStarting] = useState(false);
  const [forceUnlockActive, setForceUnlockActive] = useState<ForceUnlockActiveState>(null);
  const [forceUnlockIncoming, setForceUnlockIncoming] = useState<ForceUnlockIncomingState>(null);
  const [forceUnlockExecuteCommand, setForceUnlockExecuteCommand] = useState<{ requestId: string; action: 'save' | 'discard' } | null>(null);
  const [forceUnlockTick, setForceUnlockTick] = useState(0);
  const forceUnlockActiveFocusRef = useRef<HTMLButtonElement | null>(null);
  const forceUnlockIncomingFocusRef = useRef<HTMLButtonElement | null>(null);
  const forceUnlockConfigRef = useRef(forceUnlockConfig);
  const forceUnlockActiveRef = useRef(forceUnlockActive);
  const forceUnlockIncomingRef = useRef(forceUnlockIncoming);
  useSyncedRef(forceUnlockConfigRef, forceUnlockConfig);
  useSyncedRef(forceUnlockActiveRef, forceUnlockActive);
  useSyncedRef(forceUnlockIncomingRef, forceUnlockIncoming);
  const formatPresenceDate = useCallback((value?: number | null) => computeFormatPresenceDate(value), []);

  const formatPresenceLock = useCallback(
    (
      lock?: { planId: string; clientName?: string; siteName?: string; planName?: string } | null,
      locks?: { planId: string; clientName?: string; siteName?: string; planName?: string }[]
    ) => computeFormatPresenceLock(lock, locks, t),
    [t]
  );

  // Prefer the global presence list (includes "locks" array). Fallback to plan presence if global is not available yet.
  const globalPresenceFallback = globalPresenceUsers.length ? globalPresenceUsers : presenceUsers;
  const presenceEntries = globalPresenceFallback;
  const presenceCount = presenceEntries.length;

  const sendWs = useCallback((payload: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!forceUnlockActive && !forceUnlockIncoming) return;
    const id = window.setInterval(() => setForceUnlockTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [forceUnlockActive, forceUnlockIncoming]);

  const lockRequired = !realtimeDisabled && planAccess === 'rw' && !activeRevision;
  const grantBlocks = lockRequired && !!lockState.grant && !!lockState.grant.userId && lockState.grant.userId !== user?.id;
  const lockedByOther = lockRequired && ((!!lockState.lockedBy && !lockState.mine) || grantBlocks);
  const lockAvailable =
    lockRequired && !lockState.lockedBy && (!lockState.grant || !lockState.grant.userId || lockState.grant.userId === user?.id);
  const isReadOnly = !!activeRevision || planAccess !== 'rw' || (lockRequired && !lockState.mine);
  const isReadOnlyRef = useRef(isReadOnly);
  const lockMineRef = useRef(lockState.mine);
  const planIdRefForWs = useRef(planId);
  const lastPlanActionSentAtRef = useRef(0);
  const lastPlanDirtySentAtRef = useRef(0);
  const lastPlanDirtyValueRef = useRef<boolean | null>(null);
  useSyncedRef(isReadOnlyRef, isReadOnly);
  useSyncedRef(lockMineRef, lockState.mine);
  useSyncedRef(planIdRefForWs, planId);

  const requestPlanLock = useCallback(() => {
    if (!lockRequired) return;
    if (lockState.mine) return;
    if (lockState.lockedBy) return;
    if (lockState.grant?.userId && lockState.grant.userId !== user?.id) return;
    const now = Date.now();
    if (now - lockRequestAtRef.current < LOCK_REQUEST_THROTTLE_MS) return;
    lockRequestAtRef.current = now;
    sendWs({ type: 'request_lock', planId });
  }, [lockRequired, lockState.grant?.userId, lockState.lockedBy, lockState.mine, planId, sendWs, user?.id]);

  const updateLockedPlans = useCallback(
    (
      lockedBy: { userId: string; username: string; avatarUrl?: string } | null,
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
        | null,
      meta:
        | {
            lastActionAt?: number | null;
            lastSavedAt?: number | null;
            lastSavedRev?: string | null;
          }
        | null,
      targetPlanId: string
    ) => {
      runUpdateLockedPlans(lockedBy, grant, meta, targetPlanId, { setLockedPlans });
    },
    [setLockedPlans]
  );

  // The realtime WS connection must only re-init on these reactive inputs; all other deps are
  // stable refs/setters/consts — listing them would reconnect the socket on every render.
  useEffect(() => runRealtimeWsEffect({
    user, realtimeDisabled, realtimeDisabledRef, activeRevision, planAccess, planId,
    perfEnabled, LOCK_TOAST_MS, wsRef, isReadOnlyRef, lockMineRef, planRef,
    forceUnlockConfigRef, forceUnlockActiveRef, forceUnlockIncomingRef, setLockState, updateLockedPlans, setPresenceUsers,
    setGlobalPresenceUsers, setLockedPlans, setUnlockPrompt, setUnlockGrantedPrompt, setForceUnlockStarting, setForceUnlockActive,
    setForceUnlockConfig, setForceUnlockIncoming, setForceUnlockExecuteCommand, setRealtimeDisabled, pushStack,
    t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeRevision, planAccess, planId, realtimeDisabled, user?.id]);

  useEffect(() => {
    if (!lockAvailable) return;
    if (lockState.mine) return;
    requestPlanLock();
  }, [lockAvailable, lockState.mine, requestPlanLock]);

  const prevMineRef = useRef(false);
  useEffect(() => {
    if (prevMineRef.current && !lockState.mine && lockRequired) {
      pushStack(
        t({
          it: 'Lock perso: la planimetria è ora in sola lettura.',
          en: 'Lock lost: the floor plan is now read-only.'
        }),
        'info',
        { duration: LOCK_TOAST_MS }
      );
    }
    prevMineRef.current = lockState.mine;
  }, [LOCK_TOAST_MS, lockRequired, lockState.mine, pushStack, t]);

  return {
    lockState, setLockState, presenceUsers, globalPresenceUsers, realtimeDisabled,
    unlockPrompt, setUnlockPrompt, unlockBusy, setUnlockBusy, unlockCompose, setUnlockCompose,
    unlockGrantedPrompt, setUnlockGrantedPrompt,
    forceUnlockConfig, setForceUnlockConfig, forceUnlockGraceMinutes, setForceUnlockGraceMinutes,
    forceUnlockStarting, setForceUnlockStarting, forceUnlockActive, setForceUnlockActive,
    forceUnlockIncoming, setForceUnlockIncoming, forceUnlockExecuteCommand, setForceUnlockExecuteCommand,
    forceUnlockTick, forceUnlockActiveFocusRef, forceUnlockIncomingFocusRef,
    formatPresenceDate, formatPresenceLock, presenceEntries, presenceCount,
    sendWs, requestPlanLock, updateLockedPlans,
    lockRequired, grantBlocks, lockedByOther, lockAvailable, isReadOnly,
    isReadOnlyRef, lockMineRef, planIdRefForWs, lastPlanActionSentAtRef, lastPlanDirtySentAtRef, lastPlanDirtyValueRef,
    lockInfoOpen, setLockInfoOpen, lockInfoRef, lockActiveTitle, lockedByTitle, formatMinutes, grantRemainingMinutes
  };
};
