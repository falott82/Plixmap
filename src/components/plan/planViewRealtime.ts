import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { FloorPlan } from '../../store/types';
import type { useT } from '../../i18n/useT';
import { perfMetrics } from '../../utils/perfMetrics';
import { closeSocketSafely, getWsUrl } from '../../utils/ws';

type PresenceUser = {
  userId: string;
  username: string;
  avatarUrl?: string;
  connectedAt?: number | null;
  ip?: string;
  lock?: { planId: string; clientName?: string; siteName?: string; planName?: string } | null;
  locks?: { planId: string; clientName?: string; siteName?: string; planName?: string }[];
};

type LockState = {
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

type UnlockPrompt = {
  requestId: string;
  planId: string;
  planName: string;
  clientName?: string;
  siteName?: string;
  requestedBy: { userId: string; username: string };
  message?: string;
} | null;

type UnlockGrantedPrompt = {
  planId: string;
  clientName?: string;
  siteName?: string;
  planName?: string;
  grantedBy?: { userId: string; username: string; avatarUrl?: string } | null;
  grantedAt?: number | null;
  expiresAt?: number | null;
  minutes?: number | null;
} | null;

type ForceUnlockConfig = {
  planId: string;
  planName: string;
  clientName: string;
  siteName: string;
  userId: string;
  username: string;
  avatarUrl?: string;
} | null;

type ForceUnlockActive = {
  requestId: string;
  planId: string;
  targetUserId: string;
  targetUsername: string;
  graceEndsAt: number;
  decisionEndsAt: number;
  graceMinutes: number;
  hasUnsavedChanges?: boolean | null;
} | null;

type ForceUnlockIncoming = {
  requestId: string;
  planId: string;
  clientName?: string;
  siteName?: string;
  planName?: string;
  requestedBy?: { userId: string; username: string } | null;
  graceEndsAt: number;
  decisionEndsAt: number;
  graceMinutes: number;
  hasUnsavedChanges?: boolean | null;
} | null;

type ForceUnlockExecuteCommand = { requestId: string; action: 'save' | 'discard' } | null;

export type RealtimeWsDeps = {
  user: { id: string } | null | undefined;
  realtimeDisabled: boolean;
  realtimeDisabledRef: MutableRefObject<boolean>;
  activeRevision: unknown;
  planAccess: 'ro' | 'rw';
  planId: string;
  perfEnabled: boolean;
  LOCK_TOAST_MS: number;
  wsRef: MutableRefObject<WebSocket | null>;
  isReadOnlyRef: MutableRefObject<boolean>;
  lockMineRef: MutableRefObject<boolean>;
  planRef: MutableRefObject<FloorPlan | undefined>;
  forceUnlockConfigRef: MutableRefObject<ForceUnlockConfig>;
  forceUnlockActiveRef: MutableRefObject<ForceUnlockActive>;
  forceUnlockIncomingRef: MutableRefObject<ForceUnlockIncoming>;
  setLockState: Dispatch<SetStateAction<NonNullable<LockState>>>;
  updateLockedPlans: (
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
  ) => void;
  setPresenceUsers: Dispatch<SetStateAction<PresenceUser[]>>;
  setGlobalPresenceUsers: Dispatch<SetStateAction<PresenceUser[]>>;
  setLockedPlans: (next: any) => void;
  setUnlockPrompt: Dispatch<SetStateAction<UnlockPrompt>>;
  setUnlockGrantedPrompt: Dispatch<SetStateAction<UnlockGrantedPrompt>>;
  setForceUnlockStarting: Dispatch<SetStateAction<boolean>>;
  setForceUnlockActive: Dispatch<SetStateAction<ForceUnlockActive>>;
  setForceUnlockConfig: Dispatch<SetStateAction<ForceUnlockConfig>>;
  setForceUnlockIncoming: Dispatch<SetStateAction<ForceUnlockIncoming>>;
  setForceUnlockExecuteCommand: Dispatch<SetStateAction<ForceUnlockExecuteCommand>>;
  setRealtimeDisabled: Dispatch<SetStateAction<boolean>>;
  pushStack: any;
  t: ReturnType<typeof useT>;
};

export const runRealtimeWsEffect = (deps: RealtimeWsDeps): void | (() => void) => {
  const {
    user,
    realtimeDisabled,
    realtimeDisabledRef,
    activeRevision,
    planAccess,
    planId,
    perfEnabled,
    LOCK_TOAST_MS,
    wsRef,
    isReadOnlyRef,
    lockMineRef,
    planRef,
    forceUnlockConfigRef,
    forceUnlockActiveRef,
    forceUnlockIncomingRef,
    setLockState,
    updateLockedPlans,
    setPresenceUsers,
    setGlobalPresenceUsers,
    setLockedPlans,
    setUnlockPrompt,
    setUnlockGrantedPrompt,
    setForceUnlockStarting,
    setForceUnlockActive,
    setForceUnlockConfig,
    setForceUnlockIncoming,
    setForceUnlockExecuteCommand,
    setRealtimeDisabled,
    pushStack,
    t
  } = deps;

  if (!user?.id || realtimeDisabledRef.current || realtimeDisabled) return;
  const canRequestLock = !activeRevision && planAccess === 'rw';
  const ws = new WebSocket(getWsUrl());
  wsRef.current = ws;
  let closed = false;
  let opened = false;

  const send = (obj: any) => {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      // ignore
    }
  };

  ws.onopen = () => {
    opened = true;
    send({ type: 'join', planId, wantLock: canRequestLock });
  };
  ws.onmessage = (ev) => {
    if (perfEnabled) perfMetrics.wsMessages += 1;
    let msg: any;
    try {
      msg = JSON.parse(String(ev.data || ''));
    } catch {
      return;
    }
    if (msg?.type === 'lock_state' && msg.planId === planId) {
      const lockedBy = msg.lockedBy || null;
      setLockState({
        lockedBy,
        mine: !!lockedBy && lockedBy.userId === user.id,
        grant: msg.grant || null,
        meta: msg.meta || null
      });
      updateLockedPlans(lockedBy, msg.grant || null, msg.meta || null, planId);
    }
    if (msg?.type === 'lock_denied' && msg.planId === planId) {
      const lockedBy = msg.lockedBy || null;
      setLockState({
        lockedBy,
        mine: false,
        grant: msg.grant || null,
        meta: msg.meta || null
      });
      updateLockedPlans(lockedBy, msg.grant || null, msg.meta || null, planId);
    }
    if (msg?.type === 'presence' && msg.planId === planId) {
      if (perfEnabled) perfMetrics.presenceUpdates += 1;
      setPresenceUsers(Array.isArray(msg.users) ? msg.users : []);
    }
    if (msg?.type === 'global_presence') {
      setGlobalPresenceUsers(Array.isArray(msg.users) ? msg.users : []);
      if (msg.lockedPlans && typeof msg.lockedPlans === 'object') {
        setLockedPlans(msg.lockedPlans);
      }
    }
    if (msg?.type === 'unlock_request' && msg.planId === planId) {
      if (isReadOnlyRef.current || !lockMineRef.current) return;
      setUnlockPrompt({
        requestId: String(msg.requestId || ''),
        planId: String(msg.planId || planId),
        planName: String(msg.planName || planRef.current?.name || ''),
        clientName: String(msg.clientName || ''),
        siteName: String(msg.siteName || ''),
        requestedBy: {
          userId: String(msg.requestedBy?.userId || ''),
          username: String(msg.requestedBy?.username || 'user')
        },
        message: String(msg.message || '')
      });
    }
    if (msg?.type === 'unlock_sent') {
      pushStack(
        t({
          it: 'Richiesta di unlock inviata.',
          en: 'Unlock request sent.'
        }),
        'info',
        { duration: LOCK_TOAST_MS }
      );
    }
    if (msg?.type === 'unlock_denied') {
      pushStack(
        t({
          it: 'Impossibile inviare la richiesta di unlock.',
          en: 'Unable to send unlock request.'
        }),
        'danger',
        { duration: LOCK_TOAST_MS }
      );
    }
    if (msg?.type === 'unlock_result') {
      const granted = msg.action === 'grant' || msg.action === 'grant_save' || msg.action === 'grant_discard';
      if (granted) {
        const takeover = String(msg?.takeover || '').trim(); // reserved|immediate|'' (legacy)
        const minutes = typeof msg?.grant?.minutes === 'number' ? msg.grant.minutes : null;
        pushStack(
          t({
            it:
              takeover === 'immediate'
                ? 'Unlock concesso: lock acquisito immediatamente.'
                : `Unlock concesso${minutes ? `: valido per ${minutes} minuti` : ''}.`,
            en:
              takeover === 'immediate'
                ? 'Unlock granted: lock acquired immediately.'
                : `Unlock granted${minutes ? `: valid for ${minutes} minutes` : ''}.`
          }),
          'success',
          { duration: LOCK_TOAST_MS }
        );
        if (takeover === 'immediate') {
          // If we're already inside the plan, the server assigns the lock immediately; no takeover prompt needed.
          return;
        }
        setUnlockGrantedPrompt({
          planId: String(msg.planId || ''),
          clientName: String(msg?.plan?.clientName || ''),
          siteName: String(msg?.plan?.siteName || ''),
          planName: String(msg?.plan?.planName || ''),
          grantedBy: msg?.grantedBy
            ? {
                userId: String(msg.grantedBy.userId || ''),
                username: String(msg.grantedBy.username || ''),
                avatarUrl: String(msg.grantedBy.avatarUrl || '')
              }
            : null,
          grantedAt: typeof msg?.grant?.grantedAt === 'number' ? msg.grant.grantedAt : null,
          expiresAt: typeof msg?.grant?.expiresAt === 'number' ? msg.grant.expiresAt : null,
          minutes
        });
      } else {
        pushStack(
          t({
            it: 'Unlock non concesso dall’utente.',
            en: 'Unlock request denied by the user.'
          }),
          'danger',
          { duration: LOCK_TOAST_MS }
        );
      }
    }

    if (msg?.type === 'force_unlock_started') {
      setForceUnlockStarting(false);
      const requestId = String(msg.requestId || '').trim();
      const activePlanId = String(msg.planId || '').trim();
      const targetUserId = String(msg.targetUserId || '').trim();
      const graceEndsAt = Number(msg.graceEndsAt || msg.deadlineAt || 0) || Date.now();
      const decisionEndsAt = Number(msg.decisionEndsAt || 0) || graceEndsAt + 5 * 60_000;
      const graceMinutes = Number(msg.graceMinutes || 0) || 0;
      const hasUnsavedChanges = typeof msg.hasUnsavedChanges === 'boolean' ? msg.hasUnsavedChanges : null;
      const targetUsername = forceUnlockConfigRef.current?.username || 'user';
      setForceUnlockActive({ requestId, planId: activePlanId, targetUserId, targetUsername, graceEndsAt, decisionEndsAt, graceMinutes, hasUnsavedChanges });
      setForceUnlockConfig(null);
      pushStack(t({ it: 'Force unlock avviato.', en: 'Force unlock started.' }), 'info', { duration: LOCK_TOAST_MS });
    }
    if (msg?.type === 'force_unlock_denied') {
      setForceUnlockStarting(false);
      pushStack(t({ it: 'Force unlock non disponibile.', en: 'Force unlock denied.' }), 'danger', { duration: LOCK_TOAST_MS });
    }
    if (msg?.type === 'force_unlock_done') {
      const requestId = String(msg.requestId || '').trim();
      if (forceUnlockActiveRef.current?.requestId === requestId) {
        pushStack(t({ it: 'Force unlock completato.', en: 'Force unlock completed.' }), 'success', { duration: LOCK_TOAST_MS });
        setForceUnlockActive(null);
      }
    }
    if (msg?.type === 'force_unlock_cancelled' || msg?.type === 'force_unlock_expired') {
      const requestId = String(msg.requestId || '').trim();
      const isExpired = msg?.type === 'force_unlock_expired';
      const userMsg = t({
        it: isExpired
          ? 'Unlock forzato scaduto o annullato: puoi continuare il tuo lavoro e lasciare il lock all’utente.'
          : 'Unlock forzato scaduto o annullato: puoi continuare il tuo lavoro e lasciare il lock all’utente.',
        en: isExpired
          ? 'Force unlock expired or cancelled: you can keep working and keep the lock.'
          : 'Force unlock expired or cancelled: you can keep working and keep the lock.'
      });
      if (forceUnlockIncomingRef.current?.requestId === requestId) {
        pushStack(userMsg, 'info', { duration: LOCK_TOAST_MS });
        setForceUnlockIncoming(null);
      }
      if (forceUnlockActiveRef.current?.requestId === requestId) {
        pushStack(
          t({
            it: isExpired ? 'Force unlock scaduto.' : 'Force unlock annullato.',
            en: isExpired ? 'Force unlock expired.' : 'Force unlock cancelled.'
          }),
          'info',
          { duration: LOCK_TOAST_MS }
        );
        setForceUnlockActive(null);
      }
    }

    if (msg?.type === 'force_unlock' && msg.planId === planId) {
      const graceEndsAt = Number(msg.graceEndsAt || msg.deadlineAt || 0) || Date.now();
      const decisionEndsAt = Number(msg.decisionEndsAt || 0) || graceEndsAt + 5 * 60_000;
      setForceUnlockIncoming({
        requestId: String(msg.requestId || ''),
        planId: String(msg.planId || planId),
        clientName: String(msg.clientName || ''),
        siteName: String(msg.siteName || ''),
        planName: String(msg.planName || planRef.current?.name || ''),
        requestedBy: msg.requestedBy
          ? { userId: String(msg.requestedBy.userId || ''), username: String(msg.requestedBy.username || '') }
          : null,
        graceEndsAt,
        decisionEndsAt,
        graceMinutes: Number(msg.graceMinutes || 0) || 0,
        hasUnsavedChanges: typeof msg.hasUnsavedChanges === 'boolean' ? msg.hasUnsavedChanges : null
      });
    }
    if (msg?.type === 'force_unlock_execute' && msg.planId === planId) {
      const requestId = String(msg.requestId || '').trim();
      const action = String(msg.action || '').trim();
      if (!requestId || (action !== 'save' && action !== 'discard')) return;
      setForceUnlockExecuteCommand({ requestId, action });
    }
  };
  ws.onclose = () => {
    if (closed) return;
    closed = true;
    if (!opened) {
      realtimeDisabledRef.current = true;
      setRealtimeDisabled(true);
    }
    setPresenceUsers([]);
    setGlobalPresenceUsers([]);
    setLockedPlans({});
    setLockState({ lockedBy: null, mine: false, grant: null, meta: null });
    wsRef.current = null;
  };
  ws.onerror = () => {
    if (!opened) {
      realtimeDisabledRef.current = true;
      setRealtimeDisabled(true);
    }
    wsRef.current = null;
  };

  return () => {
    closed = true;
    try {
      if (ws.readyState === WebSocket.OPEN) {
        if (lockMineRef.current) send({ type: 'release_lock', planId });
        send({ type: 'leave', planId });
      }
      closeSocketSafely(ws);
    } catch {
      // ignore
    } finally {
      wsRef.current = null;
    }
  };
};
