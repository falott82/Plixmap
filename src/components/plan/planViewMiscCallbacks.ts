import type { FloorPlan, MapObject } from '../../store/types';
import type { useT } from '../../i18n/useT';
import { useUIStore } from '../../store/useUIStore';

// Body-extraction of assorted non-JSX usePlanView callbacks. Each body is moved verbatim; the
// closed-over values are passed in via `deps` (mirroring each useCallback dependency array plus
// the refs/setters it reads). The useCallback wrappers and dependency arrays in usePlanView are
// unchanged.

type LangText = { it: string; en: string };

export type OpenMediaViewerPayload = {
  id: string;
  selectionIds?: string[];
  types: string[];
  title: LangText;
  countLabel: LangText;
  itemLabel: LangText;
  emptyToast: LangText;
  emptyLabel?: LangText;
};

export type OpenMediaViewerDeps = {
  renderPlan: FloorPlan | undefined;
  renderPlanObjectById: Map<string, MapObject>;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  setPhotoViewer: (v: any) => void;
};

export const runOpenMediaViewer = (payload: OpenMediaViewerPayload, deps: OpenMediaViewerDeps): void => {
  const { renderPlan, renderPlanObjectById, push, t, setPhotoViewer } = deps;
      if (!renderPlan) return;
      const selection =
        Array.isArray(payload.selectionIds) && payload.selectionIds.length > 0 ? payload.selectionIds : [payload.id];
      const roomNameById = new Map<string, string>();
      for (const room of renderPlan.rooms || []) {
        if (!room?.id) continue;
        roomNameById.set(String(room.id), String(room.name || '').trim());
      }
      const items = selection
        .map((id) => renderPlanObjectById.get(id))
        .filter((obj): obj is MapObject => !!obj && payload.types.includes(obj.type) && !!(obj as any).imageUrl)
        .map((obj) => ({
          id: obj.id,
          name: String(obj.name || '').trim(),
          description: String(obj.description || '').trim(),
          url: String((obj as any).imageUrl || ''),
          roomName: obj.roomId ? roomNameById.get(String(obj.roomId)) || '' : ''
        }))
        .filter((p) => !!p.url);
      if (!items.length) {
        push(t(payload.emptyToast), 'info');
        return;
      }
      setPhotoViewer({
        photos: items,
        initialId: payload.id,
        title: payload.title,
        countLabel: payload.countLabel,
        itemLabel: payload.itemLabel,
        emptyLabel: payload.emptyLabel
      });
};

export type UpdateLockedPlansDeps = {
  setLockedPlans: (v: any) => void;
};

type LockMeta = { lastActionAt?: number | null; lastSavedAt?: number | null; lastSavedRev?: string | null } | null;

export const runUpdateLockedPlans = (
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
  meta: LockMeta,
  targetPlanId: string,
  deps: UpdateLockedPlansDeps
): void => {
  const { setLockedPlans } = deps;
	      const prev = (useUIStore.getState() as any)?.lockedPlans || {};
	      const next = { ...prev };
	      if (lockedBy) {
	        next[targetPlanId] = {
	          kind: 'lock',
	          ...lockedBy,
	          lastActionAt: meta?.lastActionAt ?? null,
	          lastSavedAt: meta?.lastSavedAt ?? null,
	          lastSavedRev: meta?.lastSavedRev ?? null
	        };
	      } else if (grant?.userId) {
	        next[targetPlanId] = {
	          kind: 'grant',
	          userId: grant.userId,
	          username: grant.username,
	          avatarUrl: grant.avatarUrl || '',
	          grantedAt: grant.grantedAt ?? null,
	          expiresAt: grant.expiresAt ?? null,
	          minutes: grant.minutes ?? null,
	          grantedBy: grant.grantedBy ?? null,
	          lastActionAt: meta?.lastActionAt ?? null,
	          lastSavedAt: meta?.lastSavedAt ?? null,
	          lastSavedRev: meta?.lastSavedRev ?? null
	        };
	      } else {
	        delete next[targetPlanId];
	      }
	      setLockedPlans(next);
};

export type ApplyRoomLayoutExportDeps = {
  roomLayoutExportModal: { selectedKeys?: unknown[] } | null;
  roomLayoutExportSource: { color: unknown; fillOpacity: unknown; labelScale: unknown } | null;
  roomLayoutExportRows: Array<{ key: string; isSource: boolean; planId: string; roomId: string }>;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  updateRoom: (...args: any[]) => void;
  planId: string;
  markTouched: () => void;
  setPlanDirty: (planId: string, dirty: boolean) => void;
  setRoomLayoutExportModal: (v: any) => void;
};

export const runApplyRoomLayoutExportToSelection = (deps: ApplyRoomLayoutExportDeps): void => {
  const {
    roomLayoutExportModal,
    roomLayoutExportSource,
    roomLayoutExportRows,
    push,
    t,
    updateRoom,
    planId,
    markTouched,
    setPlanDirty,
    setRoomLayoutExportModal
  } = deps;
    if (!roomLayoutExportModal || !roomLayoutExportSource) return;
    const selected = new Set((roomLayoutExportModal.selectedKeys || []).map((v) => String(v)));
    const targets = roomLayoutExportRows.filter((row) => selected.has(row.key) && !row.isSource);
    if (!targets.length) {
      push(t({ it: 'Seleziona almeno una stanza di destinazione.', en: 'Select at least one target room.' }), 'info');
      return;
    }
    const patch = {
      color: roomLayoutExportSource.color,
      fillOpacity: roomLayoutExportSource.fillOpacity,
      labelScale: roomLayoutExportSource.labelScale
    };
    const touchedPlanIds = new Set<string>();
    for (const target of targets) {
      updateRoom(target.planId, target.roomId, patch as any);
      touchedPlanIds.add(target.planId);
    }
    for (const pid of touchedPlanIds) {
      if (String(pid) === String(planId || '')) markTouched();
      setPlanDirty(pid, true);
    }
    push(
      t({
        it: `Layout esportato su ${targets.length} stanze (colore, scala, opacità).`,
        en: `Layout applied to ${targets.length} rooms (color, scale, opacity).`
      }),
      'success'
    );
    setRoomLayoutExportModal(null);
};
