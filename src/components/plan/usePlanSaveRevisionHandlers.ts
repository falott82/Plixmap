/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { savePlanState } from '../../api/state';
import { useDataStore } from '../../store/useDataStore';
import { runRevertUnsavedChanges, runForceSaveNow, runSaveRevisionForUnlock } from './planViewComputeBits';

// Save / revert / save-revision-for-unlock handlers extracted from usePlanView. Delegate to the
// matching run* helpers; bodies + dep arrays moved verbatim. forceSaveNow is shared internally by
// saveRevisionForUnlock and also returned for the host.
export const usePlanSaveRevisionHandlers = (deps: any) => {
  const {
    plan, getLatestRevisionCached, restoreRevision, baselineSnapshotRef, setFloorPlanContent, planId,
    hasNavigationEdits, hasAnyRevision, latestRev, addRevision, push, t, postAuditEvent, resetTouched,
    entrySnapshotRef, getPlanSnapshot, planRef
  } = deps;

  const revertUnsavedChanges = useCallback(() => {
    runRevertUnsavedChanges({ plan, getLatestRevisionCached, restoreRevision, baselineSnapshotRef, setFloorPlanContent });
  }, [baselineSnapshotRef, getLatestRevisionCached, plan, restoreRevision, setFloorPlanContent]);

  const forceSaveNow = useCallback(async () => {
    return runForceSaveNow({ plan, planId, useDataStoreGetState: useDataStore.getState, savePlanState });
  }, [plan, planId]);

  const saveRevisionForUnlock = useCallback(async () => {
    return runSaveRevisionForUnlock({
      plan,
      hasNavigationEdits,
      hasAnyRevision,
      latestRev,
      addRevision,
      push,
      t,
      postAuditEvent,
      resetTouched,
      entrySnapshotRef,
      getPlanSnapshot,
      planRef,
      forceSaveNow
    });
  }, [addRevision, forceSaveNow, hasAnyRevision, hasNavigationEdits, latestRev, plan, postAuditEvent, push, resetTouched, t, getPlanSnapshot, entrySnapshotRef, planRef]);

  return { revertUnsavedChanges, forceSaveNow, saveRevisionForUnlock };
};
