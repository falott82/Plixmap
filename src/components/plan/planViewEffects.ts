import type { MutableRefObject, RefObject } from 'react';
import type { FloorPlan } from '../../store/types';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';

// Body-extraction of assorted non-JSX usePlanView useEffects. Each body is moved verbatim; the
// closed-over values are passed via `deps` (mirroring each effect's existing dependency array plus
// the refs it reads). Effect wrappers + dependency arrays in usePlanView are unchanged. Effects
// that registered a cleanup still return it.

const FORCE_UNLOCK_EVENT = 'plixmap_force_unlock';

export type CorridorShortcutEffectDeps = {
  selectedCorridorId: string | undefined;
  isReadOnly: boolean;
  openEditCorridor: (corridorId: string) => void;
  updateCorridorLabelScale: (corridorId: string, delta: number) => void;
};

export const runCorridorShortcutEffect = (deps: CorridorShortcutEffectDeps): void | (() => void) => {
  const { selectedCorridorId, isReadOnly, openEditCorridor, updateCorridorLabelScale } = deps;
    if (!selectedCorridorId || isReadOnly) return;
    const handler = (e: KeyboardEvent) => {
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'e') {
        e.preventDefault();
        openEditCorridor(selectedCorridorId);
        return;
      }
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        updateCorridorLabelScale(selectedCorridorId, 0.1);
        return;
      }
      if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        updateCorridorLabelScale(selectedCorridorId, -0.1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
};

export type HistoryTrackEffectDeps = {
  plan: FloorPlan | null | undefined;
  toHistorySnapshot: (plan: FloorPlan) => any;
  historyKeyRef: MutableRefObject<string>;
  historySnapshotRef: MutableRefObject<any>;
  historyLockRef: MutableRefObject<boolean>;
  undoStackRef: MutableRefObject<{ snap: any; key: string }[]>;
  redoStackRef: MutableRefObject<{ snap: any; key: string }[]>;
  setHistoryTick: (updater: (x: number) => number) => void;
};

export const runHistoryTrackEffect = (deps: HistoryTrackEffectDeps): void => {
  const {
    plan,
    toHistorySnapshot,
    historyKeyRef,
    historySnapshotRef,
    historyLockRef,
    undoStackRef,
    redoStackRef,
    setHistoryTick
  } = deps;
    if (!plan) return;
    const snap = toHistorySnapshot(plan);
    const nextKey = JSON.stringify(snap);
    const prevKey = historyKeyRef.current;
    const prev = historySnapshotRef.current;
    if (!prev || !prevKey) {
      historySnapshotRef.current = snap;
      historyKeyRef.current = nextKey;
      return;
    }
    if (historyLockRef.current) {
      historySnapshotRef.current = snap;
      historyKeyRef.current = nextKey;
      historyLockRef.current = false;
      return;
    }
    if (prevKey === nextKey) return;
    undoStackRef.current.push({ snap: prev, key: prevKey });
    if (undoStackRef.current.length > 80) undoStackRef.current.shift();
    redoStackRef.current = [];
    historySnapshotRef.current = snap;
    historyKeyRef.current = nextKey;
    setHistoryTick((x) => x + 1);
};

export type ForceUnlockEventEffectDeps = {
  isSuperAdmin: boolean;
  setForceUnlockGraceMinutes: (v: number) => void;
  setForceUnlockStarting: (v: boolean) => void;
  setForceUnlockConfig: (v: any) => void;
};

export const runForceUnlockEventEffect = (deps: ForceUnlockEventEffectDeps): (() => void) => {
  const { isSuperAdmin, setForceUnlockGraceMinutes, setForceUnlockStarting, setForceUnlockConfig } = deps;
	    const handler = (event: Event) => {
	      if (!isSuperAdmin) return;
	      const detail = (event as CustomEvent).detail || {};
	      const planId = String(detail.planId || '').trim();
	      const userId = String(detail.userId || '').trim();
	      if (!planId || !userId) return;
	      setForceUnlockGraceMinutes(5);
	      setForceUnlockStarting(false);
	      setForceUnlockConfig({
	        planId,
	        planName: String(detail.planName || ''),
	        clientName: String(detail.clientName || ''),
	        siteName: String(detail.siteName || ''),
	        userId,
	        username: String(detail.username || 'user'),
	        avatarUrl: String(detail.avatarUrl || '')
	      });
	    };
	    window.addEventListener(FORCE_UNLOCK_EVENT, handler as EventListener);
	    return () => {
	      window.removeEventListener(FORCE_UNLOCK_EVENT, handler as EventListener);
	    };
};

export type SearchExportShortcutEffectDeps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  setExportModalOpen: (v: boolean) => void;
};

export const runSearchExportShortcutEffect = (deps: SearchExportShortcutEffectDeps): (() => void) => {
  const { searchInputRef, setExportModalOpen } = deps;
    const handler = (e: KeyboardEvent) => {
      if ((useUIStore.getState() as any)?.clientChatOpen) return;
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
        if (isTyping) return;

	      const isCmdF = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f';
	      if (isCmdF) {
	        e.preventDefault();
	        searchInputRef.current?.focus();
	      }

        const isCmdP = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p';
        if (isCmdP) {
          e.preventDefault();
          setExportModalOpen(true);
        }
	    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
};

export type LayerVisibilityInitEffectDeps = {
  layerIds: string[];
  visibleLayerIdsByPlan: Record<string, string[] | undefined>;
  planId: string;
  prevLayerIdsByPlanRef: MutableRefObject<Record<string, string[]>>;
  normalizeLayerSelection: (ids: string[]) => string[];
  defaultVisibleLayerIds: string[];
  setVisibleLayerIds: (planId: string, ids: string[]) => void;
};

export const runLayerVisibilityInitEffect = (deps: LayerVisibilityInitEffectDeps): void => {
  const {
    layerIds,
    visibleLayerIdsByPlan,
    planId,
    prevLayerIdsByPlanRef,
    normalizeLayerSelection,
    defaultVisibleLayerIds,
    setVisibleLayerIds
  } = deps;
    if (!layerIds.length) return;
    const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
    const prev = prevLayerIdsByPlanRef.current[planId];
    if (typeof current === 'undefined') {
      const nextDefault = normalizeLayerSelection(defaultVisibleLayerIds);
      setVisibleLayerIds(planId, nextDefault);
      prevLayerIdsByPlanRef.current[planId] = layerIds;
      return;
    }
    const filteredCurrent = normalizeLayerSelection(current);
    let next = filteredCurrent;
    if (prev) {
      const newIds = layerIds.filter((id) => !prev.includes(id));
      if (newIds.length && filteredCurrent.includes(ALL_ITEMS_LAYER_ID)) {
        next = normalizeLayerSelection([...filteredCurrent, ...newIds]);
      }
    }
    if (next.length !== current.length || next.some((id, idx) => id !== current[idx])) {
      setVisibleLayerIds(planId, next);
    }
    prevLayerIdsByPlanRef.current[planId] = layerIds;
};

export type ResetToolsOnPlanChangeEffectDeps = {
  setWallDrawMode: (v: boolean) => void;
  setWallDrawType: (v: any) => void;
  setWallDraftPoints: (v: any) => void;
  wallDraftPointsRef: MutableRefObject<any>;
  wallDraftSegmentIdsRef: MutableRefObject<any>;
  setWallDraftPointer: (v: any) => void;
  setScaleMode: (v: boolean) => void;
  setScaleDraft: (v: any) => void;
  setScaleDraftPointer: (v: any) => void;
  setScaleModal: (v: any) => void;
  setScaleMetersInput: (v: string) => void;
  setShowScaleLine: (v: boolean) => void;
  planScale: unknown;
  setMeasureMode: (v: boolean) => void;
  setMeasurePoints: (v: any) => void;
  setMeasurePointer: (v: any) => void;
  setMeasureClosed: (v: boolean) => void;
  setMeasureFinished: (v: boolean) => void;
  setQuoteMode: (v: boolean) => void;
  setQuotePoints: (v: any) => void;
  setQuotePointer: (v: any) => void;
  setScalePromptDismissed: (v: boolean) => void;
};

export const runResetToolsOnPlanChangeEffect = (deps: ResetToolsOnPlanChangeEffectDeps): void => {
  const {
    setWallDrawMode,
    setWallDrawType,
    setWallDraftPoints,
    wallDraftPointsRef,
    wallDraftSegmentIdsRef,
    setWallDraftPointer,
    setScaleMode,
    setScaleDraft,
    setScaleDraftPointer,
    setScaleModal,
    setScaleMetersInput,
    setShowScaleLine,
    planScale,
    setMeasureMode,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setScalePromptDismissed
  } = deps;
    setWallDrawMode(false);
    setWallDrawType(null);
    setWallDraftPoints([]);
    wallDraftPointsRef.current = [];
    wallDraftSegmentIdsRef.current = [];
    setWallDraftPointer(null);
    setScaleMode(false);
    setScaleDraft(null);
    setScaleDraftPointer(null);
    setScaleModal(null);
    setScaleMetersInput('');
    setShowScaleLine(!!planScale);
    setMeasureMode(false);
    setMeasurePoints([]);
    setMeasurePointer(null);
    setMeasureClosed(false);
    setMeasureFinished(false);
    setQuoteMode(false);
    setQuotePoints([]);
    setQuotePointer(null);
    setScalePromptDismissed(false);
};

export type LayerVisibilitySyncEffectDeps = {
  user: any;
  normalizeVisibleLayerIdsByPlan: (input?: Record<string, string[]>) => Record<string, string[]>;
  visibleLayerIdsByPlan: Record<string, string[]>;
  layerVisibilitySyncRef: MutableRefObject<string>;
};

export const runLayerVisibilitySyncEffect = (deps: LayerVisibilitySyncEffectDeps): void | (() => void) => {
  const { user, normalizeVisibleLayerIdsByPlan, visibleLayerIdsByPlan, layerVisibilitySyncRef } = deps;
    if (!user) return;
    const base = normalizeVisibleLayerIdsByPlan((user as any)?.visibleLayerIdsByPlan || {});
    const current = normalizeVisibleLayerIdsByPlan(visibleLayerIdsByPlan || {});
    const merged = { ...base, ...current };
    const next = JSON.stringify(merged);
    if (next === layerVisibilitySyncRef.current) return;
    const handle = window.setTimeout(async () => {
      try {
        await updateMyProfile({ visibleLayerIdsByPlan: merged });
        useAuthStore.setState((s) =>
          s.user
            ? ({ user: { ...s.user, visibleLayerIdsByPlan: merged } as any, permissions: s.permissions, hydrated: s.hydrated } as any)
            : s
        );
        layerVisibilitySyncRef.current = next;
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(handle);
};
