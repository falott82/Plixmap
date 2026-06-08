import type { MutableRefObject } from 'react';
import type { FloorPlan, RackItem, RackPortKind } from '../../store/types';
import type { useT } from '../../i18n/useT';
import { isSecurityTypeId, SECURITY_LAYER_ID } from '../../store/security';

type PresenceLockEntry = { planId: string; clientName?: string; siteName?: string; planName?: string };

// Resolve a layer id to its localized display label (falls back to the id).
export const computeGetLayerLabel = (layerId: string, deps: { planLayers: any[]; lang: string }): string => {
  const { planLayers, lang } = deps;
  const layer = planLayers.find((l: any) => String(l.id) === layerId);
  if (!layer) return layerId;
  const name = (layer as any)?.name;
  if (typeof name === 'string') return name;
  return String(name?.[lang] || name?.it || name?.en || layerId);
};

// Build a toast-friendly object label (trimmed/collapsed, type-label fallback,
// truncated past 60 chars).
export const computeGetObjectToastLabel = (
  name: string | undefined,
  typeId: string,
  getTypeLabel: (typeId: string) => string
): string => {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  const fallback = getTypeLabel(typeId);
  const value = trimmed || fallback || typeId;
  if (value.length > 60) return `${value.slice(0, 57)}...`;
  return value;
};

export type LinkCreateHintDeps = {
  linkFromId: string | null | undefined;
  isReadOnly: boolean;
  renderPlan: FloorPlan | undefined;
  linkCreateMode: string;
  t: ReturnType<typeof useT>;
};

// Hint banner shown while creating an object-to-object link: title + origin
// subtitle, or null when not in link-create mode / read-only.
export const computeLinkCreateHint = (deps: LinkCreateHintDeps) => {
  const { linkFromId, isReadOnly, renderPlan, linkCreateMode, t } = deps;
  if (!linkFromId || isReadOnly) return null;
  const from = (renderPlan as any)?.objects?.find((o: any) => o.id === linkFromId);
  const fromName = String(from?.name || '').trim();
  const modeLabel =
    linkCreateMode === 'cable' ? t({ it: 'collegamento 90°', en: '90° link' }) : t({ it: 'collegamento', en: 'link' });
  return {
    title: t({
      it: `Seleziona un secondo oggetto per creare un ${modeLabel}.`,
      en: `Select a second object to create a ${modeLabel}.`
    }),
    subtitle: t({
      it: `${fromName ? `Origine: ${fromName}. ` : ''}Premi Esc per annullare.`,
      en: `${fromName ? `From: ${fromName}. ` : ''}Press Esc to cancel.`
    })
  };
};

// Pure presence-tooltip date formatter (locale string, em-dash fallback).
export const computeFormatPresenceDate = (value?: number | null): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

// Presence-tooltip lock summary: a single lock's client/site/plan path, a count
// when there are several, or a "no lock" label.
export const computeFormatPresenceLock = (
  lock: PresenceLockEntry | null | undefined,
  locks: PresenceLockEntry[] | undefined,
  t: ReturnType<typeof useT>
): string => {
  const list = Array.isArray(locks) && locks.length ? locks : lock ? [lock] : [];
  if (!list.length) return t({ it: 'Nessun lock', en: 'No lock' });
  if (list.length > 1) return t({ it: `Lock attivi: ${list.length}`, en: `Active locks: ${list.length}` });
  const entry = list[0];
  const parts = [entry.clientName, entry.siteName, entry.planName].filter((v) => v && String(v).trim().length);
  if (parts.length) return parts.join(' / ');
  return entry.planId || t({ it: 'Lock attivo', en: 'Lock active' });
};

// Body-extraction of several non-JSX usePlanView callbacks/memos/effects. Each body is moved
// verbatim; closed-over values are passed in via `deps`, mirroring each hook's existing dependency
// array (plus refs). The wrappers and their dependency arrays in usePlanView are unchanged.

export type InferDefaultLayerIdsDeps = {
  isDeskType: (type: string) => boolean;
  isCameraType: (type: string) => boolean;
  isWallType: (type: string) => boolean;
};

export const computeInferDefaultLayerIds = (
  typeId: string,
  layerIdSet: Set<string> | undefined,
  deps: InferDefaultLayerIdsDeps
): string[] => {
  const { isDeskType, isCameraType, isWallType } = deps;
      const ids =
        typeId === 'user' || typeId === 'real_user' || typeId === 'generic_user'
          ? ['users']
          : typeId === 'rack'
            ? ['racks']
            : isDeskType(typeId)
              ? ['desks']
              : isCameraType(typeId)
                ? ['cctv']
                : typeId === 'wifi'
                  ? ['wifi']
                  : typeId === 'quote'
                    ? ['quotes']
                    : typeId === 'text'
                      ? ['text']
                    : typeId === 'image'
                      ? ['images']
                      : typeId === 'photo'
                        ? ['photos']
                : typeId === 'postit'
                  ? ['text']
                  : isSecurityTypeId(typeId)
                    ? [SECURITY_LAYER_ID]
                    : isWallType(typeId)
                      ? ['walls']
                      : ['devices'];
      return layerIdSet ? ids.filter((id) => layerIdSet.has(id)) : ids;
};

export type UpdateRackPortFieldDeps = {
  isReadOnly: boolean;
  planId: string;
  renderPlan: FloorPlan | undefined;
  updateRackItem: (floorPlanId: string, itemId: string, changes: Partial<RackItem>) => void;
};

// Shared body for the rack-port name/note rename handlers: write a single port's
// name or note into the matching eth/fiber array on a rack item.
export const computeUpdateRackPortField = (
  itemId: string,
  kind: RackPortKind,
  index: number,
  value: string,
  field: 'names' | 'notes',
  deps: UpdateRackPortFieldDeps
) => {
  const { isReadOnly, planId, renderPlan, updateRackItem } = deps;
  if (isReadOnly || !renderPlan) return;
  const item = ((renderPlan as any).rackItems || []).find((entry: RackItem) => entry.id === itemId);
  if (!item) return;
  const key =
    field === 'names'
      ? kind === 'ethernet'
        ? 'ethPortNames'
        : 'fiberPortNames'
      : kind === 'ethernet'
        ? 'ethPortNotes'
        : 'fiberPortNotes';
  const current = ((item as any)[key] as string[] | undefined) || [];
  const next = [...current];
  const normalized = value.trim();
  while (next.length < index) next.push('');
  next[index - 1] = normalized;
  updateRackItem(planId, itemId, { [key]: next } as Partial<RackItem>);
};

// Pure derivation of an object's distinct external departments (trimmed, deduped
// case-insensitively, original order preserved).
export const computeCollectUserDepartments = (obj: any): string[] => {
  const source = [(obj as any).externalDept1, (obj as any).externalDept2, (obj as any).externalDept3];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of source) {
    const normalized = String(raw || '').trim();
    if (!normalized) continue;
    const folded = normalized.toLocaleLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(normalized);
  }
  return out;
};

// Pure derivation of a recommended default object scale from the plan's largest
// dimension (1.0 below 3000px, ramping to 2.4 at/above 12000px).
export const computeRecommendedObjectScale = (width: number, height: number): number => {
  const maxDim = Math.max(Number(width || 0), Number(height || 0));
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  const minDim = 3000;
  const maxDimRef = 12000;
  if (maxDim <= minDim) return 1;
  if (maxDim >= maxDimRef) return 2.4;
  const t = (maxDim - minDim) / (maxDimRef - minDim);
  return Number((1 + t * (2.4 - 1)).toFixed(2));
};

// Pure derivation of the client's business-partner names (trimmed, deduped of
// blanks, sorted case-insensitively).
export const computeClientBusinessPartnerNames = (client: any): string[] =>
  Array.isArray((client as any)?.businessPartners)
    ? ((client as any).businessPartners as Array<{ name?: string }>)
        .map((bp) => String(bp?.name || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    : [];

// Pure derivation of id→label lookup maps for clients/sites/floor plans across
// all clients (used to render meeting-location labels).
export const computeMeetingLocationLabels = (allClients: any[] | undefined) => {
  const clientNameById = new Map<string, string>();
  const siteNameById = new Map<string, string>();
  const floorPlanNameById = new Map<string, string>();
  for (const clientEntry of allClients || []) {
    const clientLabel = String(clientEntry.shortName || clientEntry.name || '').trim();
    if (clientLabel) clientNameById.set(String(clientEntry.id), clientLabel);
    for (const siteEntry of clientEntry.sites || []) {
      const siteLabel = String(siteEntry.name || '').trim();
      if (siteLabel) siteNameById.set(String(siteEntry.id), siteLabel);
      for (const floorEntry of siteEntry.floorPlans || []) {
        const floorLabel = String(floorEntry.name || '').trim();
        if (floorLabel) floorPlanNameById.set(String(floorEntry.id), floorLabel);
      }
    }
  }
  return { clientNameById, siteNameById, floorPlanNameById };
};

// Pure derivation of the distinct real_user participant candidates across a
// site's floor plans (deduped by externalId, sorted by full name).
export const computeSiteMeetingParticipantCandidates = (siteFloorPlans: FloorPlan[]) => {
  const byExternalId = new Map<
    string,
    { externalId: string; fullName: string; email: string | null; department?: string | null; phone?: string | null }
  >();
  for (const fp of siteFloorPlans) {
    for (const obj of (((fp as any)?.objects || []) as any[])) {
      if (String((obj as any)?.type || '') !== 'real_user') continue;
      const externalId = String((obj as any)?.externalUserId || '').trim();
      if (!externalId) continue;
      if (byExternalId.has(externalId)) continue;
      const first = String((obj as any)?.firstName || '').trim();
      const last = String((obj as any)?.lastName || '').trim();
      const fullName = `${first} ${last}`.trim() || String((obj as any).name || '').trim() || externalId;
      const email = String((obj as any)?.externalEmail || '').trim() || null;
      byExternalId.set(externalId, { externalId, fullName, email });
    }
  }
  return [...byExternalId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
};

export type LinksModalRowsDeps = {
  linksModalObjectId: string | null | undefined;
  renderPlan: FloorPlan | undefined;
  objectTypeDefs: any[] | undefined;
  lang: string;
};

export const computeLinksModalRows = (deps: LinksModalRowsDeps) => {
  const { linksModalObjectId, renderPlan, objectTypeDefs, lang } = deps;
    if (!linksModalObjectId || !renderPlan) return [];
    const links = ((renderPlan.links || []) as any[]).filter(
      (l) => String(l?.fromId || '') === linksModalObjectId || String(l?.toId || '') === linksModalObjectId
    );
    const byId = new Map<string, any>((renderPlan.objects || []).map((o: any) => [o.id, o]));
    const typeLabelById = new Map<string, string>();
    for (const d of objectTypeDefs || []) {
      typeLabelById.set(String(d.id), String((d as any)?.name?.[lang] || (d as any)?.name?.it || d.id));
    }
    return links.map((l) => {
      const kind = String((l as any).kind || 'arrow') === 'cable' ? 'cable' : 'arrow';
      const otherId = String(l.fromId) === linksModalObjectId ? String(l.toId) : String(l.fromId);
      const other = byId.get(otherId);
      return {
        id: String(l.id),
        kind,
        name: String((l as any).name || (l as any).label || '').trim(),
        description: String((l as any).description || '').trim() || undefined,
        otherId,
        otherName: String(other?.name || otherId),
        otherTypeLabel: other ? typeLabelById.get(String(other.type || '')) || String(other.type || '') : undefined,
        color: (l as any).color,
        width: typeof (l as any).width === 'number' ? (l as any).width : undefined,
        dashed: !!(l as any).dashed,
        route: (l as any).route === 'hv' ? 'hv' : (l as any).route === 'vh' ? 'vh' : undefined
      };
    });
};

export type ApplyHistorySnapshotDeps = {
  planId: string;
  historyLockRef: MutableRefObject<boolean>;
  historySnapshotRef: MutableRefObject<any>;
  historyKeyRef: MutableRefObject<string>;
  setFloorPlanContent: (...args: any[]) => void;
  markTouched: () => void;
  setHistoryTick: (updater: (x: number) => number) => void;
};

export const runApplyHistorySnapshot = (entry: { snap: any; key: string }, deps: ApplyHistorySnapshotDeps): void => {
  const {
    planId,
    historyLockRef,
    historySnapshotRef,
    historyKeyRef,
    setFloorPlanContent,
    markTouched,
    setHistoryTick
  } = deps;
      if (!planId) return;
      const snap = entry.snap;
      historyLockRef.current = true;
      historySnapshotRef.current = snap;
      historyKeyRef.current = entry.key;
      setFloorPlanContent(planId, {
        ...snap,
        printArea: snap.printArea ?? undefined,
        scale: snap.scale,
        safetyCardLayout: (snap as any).safetyCardLayout,
        objects: snap.objects,
        views: snap.views,
        rooms: snap.rooms,
        corridors: snap.corridors,
        roomDoors: (snap as any).roomDoors,
        links: snap.links,
        racks: snap.racks,
        rackItems: snap.rackItems,
        rackLinks: snap.rackLinks
      });
      markTouched();
      setHistoryTick((x) => x + 1);
};

const UNLOCK_REQUEST_EVENT = 'plixmap_unlock_request';

type PresenceUser = {
  userId: string;
  username: string;
  avatarUrl?: string;
  lock?: { planId: string; clientName?: string; siteName?: string; planName?: string } | null;
};

export type UnlockRequestEffectDeps = {
  user: { id?: string } | null | undefined;
  setUnlockCompose: (v: any) => void;
};

export const runUnlockRequestEffect = (deps: UnlockRequestEffectDeps): (() => void) => {
  const { user, setUnlockCompose } = deps;
	    const handler = (event: Event) => {
	      const detail = (event as CustomEvent).detail || {};
	      const planId = String(detail.planId || '').trim();
	      const userId = String(detail.userId || '').trim();
	      if (!planId || !userId) return;
	      if (userId === user?.id) return;
	      const target: PresenceUser = {
	        userId,
	        username: String(detail.username || 'user'),
	        avatarUrl: String(detail.avatarUrl || ''),
        lock: {
          planId,
          clientName: String(detail.clientName || ''),
          siteName: String(detail.siteName || ''),
          planName: String(detail.planName || '')
        }
      };
	      setUnlockCompose({
	        target,
	        locks: [
          {
            planId,
            clientName: String(detail.clientName || ''),
            siteName: String(detail.siteName || ''),
            planName: String(detail.planName || '')
          }
        ]
	      });
	    };
	    window.addEventListener(UNLOCK_REQUEST_EVENT, handler as EventListener);
	    return () => {
	      window.removeEventListener(UNLOCK_REQUEST_EVENT, handler as EventListener);
	    };
};

export type RevertUnsavedChangesDeps = {
  plan: FloorPlan | null | undefined;
  getLatestRevisionCached: (revisions: any[]) => any;
  restoreRevision: (planId: string, revisionId: string) => void;
  baselineSnapshotRef: MutableRefObject<any>;
  setFloorPlanContent: (...args: any[]) => void;
};

export const runRevertUnsavedChanges = (deps: RevertUnsavedChangesDeps): void => {
  const { plan, getLatestRevisionCached, restoreRevision, baselineSnapshotRef, setFloorPlanContent } = deps;
    if (!plan) return;
    const revisions = plan.revisions || [];
    if (revisions.length) {
      const latest = getLatestRevisionCached(revisions as any[]);
      if (latest?.id) restoreRevision(plan.id, latest.id);
      return;
    }
    const base = baselineSnapshotRef.current;
    if (!base) return;
    setFloorPlanContent(plan.id, {
      imageUrl: base.imageUrl,
      width: base.width,
      height: base.height,
      scale: base.scale,
      safetyCardLayout: (base as any).safetyCardLayout,
      objects: base.objects,
      rooms: base.rooms,
      corridors: base.corridors,
      views: base.views,
      racks: base.racks,
      rackItems: base.rackItems,
      rackLinks: base.rackLinks
    });
};

export type ForceSaveNowDeps = {
  plan: FloorPlan | null | undefined;
  planId: string;
  useDataStoreGetState: () => any;
  savePlanState: (planId: string, plan: any, revisions: any[]) => Promise<any>;
};

export const runForceSaveNow = async (deps: ForceSaveNowDeps): Promise<boolean> => {
  const { plan, planId, useDataStoreGetState, savePlanState } = deps;
  try {
    const store = useDataStoreGetState() as any;
    const currentPlan = store.findFloorPlan(plan?.id || planId);
    const targetPlanId = String(currentPlan?.id || plan?.id || planId || '').trim();
    if (currentPlan && targetPlanId) {
      const res = await savePlanState(targetPlanId, currentPlan, currentPlan.revisions || []);
      if (res?.plan) {
        store.commitSavedFloorPlan(targetPlanId, res.plan, res.revisions);
      } else if (typeof store.markSaved === 'function') {
        store.markSaved();
      }
    } else if (typeof store.markSaved === 'function') {
      store.markSaved();
    }
    return true;
  } catch {
    return false;
  }
};

export type SaveRevisionForUnlockDeps = {
  plan: FloorPlan | null | undefined;
  hasNavigationEdits: boolean;
  hasAnyRevision: boolean;
  latestRev: { major: number; minor: number };
  addRevision: (...args: any[]) => void;
  push: (...args: any[]) => void;
  t: (text: { it: string; en: string }) => string;
  postAuditEvent: (...args: any[]) => void;
  resetTouched: () => void;
  entrySnapshotRef: MutableRefObject<any>;
  getPlanSnapshot: (plan: any) => any;
  planRef: MutableRefObject<FloorPlan | undefined>;
  forceSaveNow: () => Promise<boolean>;
};

export const runSaveRevisionForUnlock = async (deps: SaveRevisionForUnlockDeps): Promise<boolean> => {
  const {
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
  } = deps;
    if (!plan || !hasNavigationEdits) return true;
    const bump = hasAnyRevision ? 'minor' : 'minor';
    const next = !hasAnyRevision
      ? { major: 1, minor: 0 }
      : { major: latestRev.major, minor: latestRev.minor + 1 };
    addRevision(plan.id, {
      bump,
      name: 'Salvataggio',
      description: 'Unlock request'
    });
    push(
      t({
        it: `Revisione salvata: Rev ${next.major}.${next.minor}`,
        en: `Revision saved: Rev ${next.major}.${next.minor}`
      }),
      'success'
    );
    postAuditEvent({
      event: 'revision_save',
      scopeType: 'plan',
      scopeId: plan.id,
      details: { bump, rev: `${next.major}.${next.minor}`, note: 'Unlock request' }
    });
    resetTouched();
    entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
    return forceSaveNow();
};
