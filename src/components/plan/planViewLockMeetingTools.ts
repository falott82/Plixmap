import type { Dispatch, SetStateAction } from 'react';
import { fetchMyMeetings } from '../../api/meetings';
import type { FloorPlan } from '../../store/types';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';
import type { MyMeetingsModalState } from './useRoomMeetingsTimeline';

// Pure computations extracted from usePlanView. Bodies are verbatim; closed-over values (including
// stable refs) are passed in via `deps`, mirroring each hook's original dependency array. Module
// imports (fetchMyMeetings) are imported directly here. The hook wrappers and their dep arrays stay
// unchanged.

type UnlockPromptState = {
  requestId: string;
  planId: string;
  planName: string;
  clientName?: string;
  siteName?: string;
  requestedBy: { userId: string; username: string };
  message?: string;
} | null;

export type HandleUnlockResponseDeps = {
  LOCK_TOAST_MS: number;
  hasNavigationEdits: boolean;
  plan: FloorPlan | undefined;
  push: (message: string, tone?: ToastTone) => void;
  pushStack: (message: string, tone: ToastTone, opts: { duration: number }) => void;
  resetTouched: () => void;
  revertUnsavedChanges: () => void;
  saveRevisionForUnlock: () => Promise<boolean>;
  sendWs: (payload: any) => void;
  t: ReturnType<typeof useT>;
  getPlanSnapshot: (p: any) => any;
  unlockBusy: boolean;
  unlockPrompt: UnlockPromptState;
  entrySnapshotRef: { current: any };
  planRef: { current: FloorPlan | undefined };
  setUnlockBusy: Dispatch<SetStateAction<boolean>>;
  setUnlockPrompt: Dispatch<SetStateAction<UnlockPromptState>>;
};

export const computeHandleUnlockResponse = async (
  action: 'grant' | 'grant_save' | 'grant_discard' | 'deny',
  deps: HandleUnlockResponseDeps
) => {
  const {
    LOCK_TOAST_MS,
    hasNavigationEdits,
    plan,
    push,
    pushStack,
    resetTouched,
    revertUnsavedChanges,
    saveRevisionForUnlock,
    sendWs,
    t,
    getPlanSnapshot,
    unlockBusy,
    unlockPrompt,
    entrySnapshotRef,
    planRef,
    setUnlockBusy,
    setUnlockPrompt
  } = deps;
  if (!unlockPrompt) return;
  if (unlockBusy) return;
  setUnlockBusy(true);
  if (action === 'grant_save') {
    const ok = await saveRevisionForUnlock();
    if (!ok) {
      push(
        t({ it: 'Salvataggio non riuscito. Riprova.', en: 'Save failed. Please try again.' }),
        'danger'
      );
      setUnlockBusy(false);
      return;
    }
  }
  if (action === 'grant_discard') {
    if (hasNavigationEdits) {
      revertUnsavedChanges();
      resetTouched();
      entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
    }
  }
  sendWs({ type: 'unlock_response', requestId: unlockPrompt.requestId, planId: unlockPrompt.planId, action });
  setUnlockPrompt(null);
  setUnlockBusy(false);
  if (action === 'deny') {
    pushStack(t({ it: 'Richiesta rifiutata.', en: 'Request denied.' }), 'info', { duration: LOCK_TOAST_MS });
  } else {
    pushStack(t({ it: 'Lock rilasciato.', en: 'Lock released.' }), 'success', { duration: LOCK_TOAST_MS });
  }
};

export type ReloadMyMeetingsDeps = {
  t: ReturnType<typeof useT>;
  setMyMeetingsModal: Dispatch<SetStateAction<MyMeetingsModalState | null>>;
};

export const computeReloadMyMeetings = async (deps: ReloadMyMeetingsDeps) => {
  const { t, setMyMeetingsModal } = deps;
  setMyMeetingsModal((prev) =>
    prev
      ? { ...prev, loading: true, error: null }
      : {
          loading: true,
          error: null,
          now: Date.now(),
          meetings: [],
          counts: { total: 0, inProgress: 0, upcoming: 0, past: 0 },
          returnToHub: false
        }
  );
  try {
    const payload = await fetchMyMeetings({ limit: 2500 });
    setMyMeetingsModal((prev) => ({
      loading: false,
      error: null,
      now: Number(payload?.now || Date.now()),
      meetings: Array.isArray(payload?.meetings) ? payload.meetings : [],
      counts: payload?.counts || { total: 0, inProgress: 0, upcoming: 0, past: 0 },
      returnToHub: !!prev?.returnToHub
    }));
  } catch (err: any) {
    setMyMeetingsModal((prev) => ({
      loading: false,
      error: String(err?.message || t({ it: 'Errore caricamento meeting utente.', en: 'Failed to load user meetings.' })),
      now: prev?.now || Date.now(),
      meetings: prev?.meetings || [],
      counts: prev?.counts || { total: 0, inProgress: 0, upcoming: 0, past: 0 },
      returnToHub: !!prev?.returnToHub
    }));
  }
};
