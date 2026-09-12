/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { runUnlockRequestEffect } from './planViewComputeBits';
import { runForceUnlockEventEffect } from './planViewEffects';

// Lock-related effects extracted from usePlanView: run a queued force-unlock command, the unlock-
// request + force-unlock-event window listeners, the plan-dirty store flag, and the throttled
// plan_dirty WS heartbeat. Bodies + dep arrays moved verbatim.
export const usePlanLockEffects = (deps: any) => {
  const {
    forceUnlockExecuteCommand, setForceUnlockExecuteCommand, executeForceUnlock, user, setUnlockCompose,
    isSuperAdmin, setForceUnlockGraceMinutes, setForceUnlockStarting, setForceUnlockConfig, setPlanDirty,
    planId, hasNavigationEdits, lockRequired, lockState, lastPlanDirtyValueRef, lastPlanDirtySentAtRef, sendWs
  } = deps;

  useEffect(() => {
    if (!forceUnlockExecuteCommand) return;
    const cmd = forceUnlockExecuteCommand;
    setForceUnlockExecuteCommand(null);
    void executeForceUnlock(cmd.requestId, cmd.action);
  }, [executeForceUnlock, forceUnlockExecuteCommand, setForceUnlockExecuteCommand]);

  useEffect(() => runUnlockRequestEffect({ user, setUnlockCompose }), [user?.id, user, setUnlockCompose]);

  useEffect(() => runForceUnlockEventEffect({ isSuperAdmin, setForceUnlockGraceMinutes, setForceUnlockStarting, setForceUnlockConfig }),
    [isSuperAdmin, setForceUnlockGraceMinutes, setForceUnlockStarting, setForceUnlockConfig]);

  useEffect(() => {
    setPlanDirty?.(planId, !!hasNavigationEdits);
    return () => {
      setPlanDirty?.(planId, false);
    };
  }, [hasNavigationEdits, planId, setPlanDirty]);

  useEffect(() => {
    if (!lockRequired) return;
    if (!lockState.mine) return;
    const dirty = !!hasNavigationEdits;
    const now = Date.now();
    if (lastPlanDirtyValueRef.current === dirty && now - lastPlanDirtySentAtRef.current < 1500) return;
    if (now - lastPlanDirtySentAtRef.current < 900) return;
    lastPlanDirtyValueRef.current = dirty;
    lastPlanDirtySentAtRef.current = now;
    sendWs({ type: 'plan_dirty', planId, dirty });
  }, [hasNavigationEdits, lockRequired, lockState.mine, planId, sendWs, lastPlanDirtySentAtRef, lastPlanDirtyValueRef]);
};
