/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FloorPlan } from '../../store/types';
import { samePlanSnapshot as samePlanSnapshotUtil, type PlanSnapshotComparable } from './planSnapshotCompare';
import { toPlanHistorySnapshot, toPlanSnapshot, type PlanHistorySnapshot, type PlanSnapshot } from './planSnapshots';
import { getLatestRevision, toRevisionSnapshot } from './planRevisions';
import { runApplyHistorySnapshot } from './planViewComputeBits';
import { runHistoryTrackEffect } from './planViewEffects';
import { computeGetPlanUnsavedChanges } from './planViewComputeBits2';

// Plan snapshot caching + undo/redo history + unsaved-change detection, extracted from usePlanView.
// Owns the snapshot/revision caches + undo/redo stacks + the planId-reset / baseline-track /
// history-track / entry-track effects. The baseline/entry/touched refs are HOST-owned (shared with
// save + markTouched) and passed in. Bodies + dep arrays moved verbatim.
export const usePlanHistory = (deps: any) => {
  const { plan, planId, markTouched, setFloorPlanContent, baselineSnapshotRef, entrySnapshotRef, touchedRef, setTouchedTick } = deps;

  const snapshotCacheRef = useRef<WeakMap<object, PlanSnapshot>>(new WeakMap());
  const latestRevisionCacheRef = useRef<WeakMap<object, any>>(new WeakMap());
  const revisionSnapshotCacheRef = useRef<WeakMap<object, PlanSnapshotComparable>>(new WeakMap());
  const unsavedAgainstLatestCacheRef = useRef<WeakMap<object, WeakMap<object, boolean>>>(new WeakMap());
  const getPlanSnapshot = useCallback((p: any): PlanSnapshot => {
    if (p && typeof p === 'object') {
      const cached = snapshotCacheRef.current.get(p as object);
      if (cached) return cached;
      const snap = toPlanSnapshot(p);
      snapshotCacheRef.current.set(p as object, snap);
      return snap;
    }
    return toPlanSnapshot(p);
  }, []);
  const getLatestRevisionCached = useCallback((revisions: any[] | undefined | null) => {
    if (!Array.isArray(revisions)) return null;
    const key = revisions as unknown as object;
    const cached = latestRevisionCacheRef.current.get(key);
    if (cached !== undefined) return cached;
    const latest = getLatestRevision(revisions as any[]);
    latestRevisionCacheRef.current.set(key, latest || null);
    return latest;
  }, []);
  const getRevisionSnapshotCached = useCallback((revision: any): PlanSnapshotComparable => {
    if (revision && typeof revision === 'object') {
      const key = revision as object;
      const cached = revisionSnapshotCacheRef.current.get(key);
      if (cached) return cached;
      const snap = toRevisionSnapshot(revision);
      revisionSnapshotCacheRef.current.set(key, snap);
      return snap;
    }
    return toRevisionSnapshot(revision);
  }, []);

  type HistorySnapshot = PlanHistorySnapshot;
  type HistoryEntry = { snap: HistorySnapshot; key: string };

  const [historyTick, setHistoryTick] = useState(0);
  const historySnapshotRef = useRef<HistorySnapshot | null>(null);
  const historyKeyRef = useRef('');
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const historyLockRef = useRef(false);

  const toHistorySnapshot = useCallback(
    (p: any): HistorySnapshot => toPlanHistorySnapshot(p, getPlanSnapshot(p)),
    [getPlanSnapshot]
  );

  const resetHistory = useCallback(() => {
    historySnapshotRef.current = null;
    historyKeyRef.current = '';
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryTick((x) => x + 1);
  }, []);

  useEffect(() => {
    snapshotCacheRef.current = new WeakMap();
    latestRevisionCacheRef.current = new WeakMap();
    revisionSnapshotCacheRef.current = new WeakMap();
    unsavedAgainstLatestCacheRef.current = new WeakMap();
    baselineSnapshotRef.current = null;
    entrySnapshotRef.current = null;
    touchedRef.current = false;
    setTouchedTick((x: number) => x + 1);
    resetHistory();
  }, [planId, baselineSnapshotRef, entrySnapshotRef, touchedRef, setTouchedTick, resetHistory]);

  useEffect(() => {
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) {
      baselineSnapshotRef.current = null;
      return;
    }
    const snap = getPlanSnapshot(plan);
    // Keep baseline aligned with background normalizations until the user edits.
    if (!baselineSnapshotRef.current || !touchedRef.current) baselineSnapshotRef.current = snap;
  }, [plan, getPlanSnapshot, baselineSnapshotRef, touchedRef]);

  const samePlanSnapshot = useCallback(
    (current: PlanSnapshotComparable, latest: PlanSnapshotComparable, options?: { ignoreDims?: boolean }) =>
      samePlanSnapshotUtil(current, latest, options),
    []
  );

  const samePlanSnapshotIgnoringDims = useCallback(
    (a: PlanSnapshotComparable, b: PlanSnapshotComparable) => samePlanSnapshot(a, b, { ignoreDims: true }),
    [samePlanSnapshot]
  );

  useEffect(() => {
    // If the only change is an automatic width/height fill (e.g. measured from image), do not treat it as
    // a "revision-worthy" unsaved change when the plan has no revision history yet.
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) return;
    const base = baselineSnapshotRef.current;
    if (!base) return;
    const current = getPlanSnapshot(plan);
    if (samePlanSnapshot(current, base)) return;

    const baseDimsMissing = (base.width ?? null) === null && (base.height ?? null) === null;
    const currentHasDims = typeof current.width === 'number' || typeof current.height === 'number';
    if (!baseDimsMissing || !currentHasDims) return;
    if (!samePlanSnapshotIgnoringDims(base, current)) return;

    baselineSnapshotRef.current = current;
  }, [plan, samePlanSnapshotIgnoringDims, getPlanSnapshot, baselineSnapshotRef, samePlanSnapshot]);

  const applyHistorySnapshot = useCallback(
    (entry: HistoryEntry) => {
      runApplyHistorySnapshot(entry, {
        planId, historyLockRef, historySnapshotRef, historyKeyRef, setFloorPlanContent, markTouched,
        setHistoryTick
      });
    },
    [markTouched, planId, setFloorPlanContent]
  );

  const performUndo = useCallback(() => {
    const current = historySnapshotRef.current;
    const prev = undoStackRef.current.pop();
    if (!prev || !current) return false;
    redoStackRef.current.push({ snap: current, key: historyKeyRef.current });
    applyHistorySnapshot(prev);
    return true;
  }, [applyHistorySnapshot]);

  const performRedo = useCallback(() => {
    const current = historySnapshotRef.current;
    const next = redoStackRef.current.pop();
    if (!next || !current) return false;
    undoStackRef.current.push({ snap: current, key: historyKeyRef.current });
    applyHistorySnapshot(next);
    return true;
  }, [applyHistorySnapshot]);

  useEffect(() => runHistoryTrackEffect({
    plan, toHistorySnapshot, historyKeyRef, historySnapshotRef, historyLockRef, undoStackRef, redoStackRef, setHistoryTick
  }), [plan, toHistorySnapshot]);

  // Track plan state when the user enters it. Used for the navigation prompt.
  useEffect(() => {
    if (!plan) return;
    const snap = getPlanSnapshot(plan);
    if (!entrySnapshotRef.current || !touchedRef.current) entrySnapshotRef.current = snap;
  }, [plan, getPlanSnapshot, entrySnapshotRef, touchedRef]);

  const getPlanUnsavedChanges = useCallback(
    (targetPlan?: FloorPlan | null) =>
      computeGetPlanUnsavedChanges(targetPlan, {
        getPlanSnapshot, baselineSnapshotRef, getLatestRevisionCached, getRevisionSnapshotCached, unsavedAgainstLatestCacheRef,
        samePlanSnapshot
      }),
    [getLatestRevisionCached, getPlanSnapshot, getRevisionSnapshotCached, samePlanSnapshot, baselineSnapshotRef]
  );

  const { canUndo, canRedo } = useMemo(
    () => ({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0
    }),
    [historyTick]
  );

  return {
    getPlanSnapshot, getLatestRevisionCached, getRevisionSnapshotCached, toHistorySnapshot, resetHistory,
    samePlanSnapshot, samePlanSnapshotIgnoringDims, applyHistorySnapshot, performUndo, performRedo,
    getPlanUnsavedChanges, canUndo, canRedo
  };
};
