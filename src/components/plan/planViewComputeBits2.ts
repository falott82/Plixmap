import { toast } from 'sonner';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import { isSecurityTypeId, SECURITY_LAYER_ID } from '../../store/security';
import type { useT } from '../../i18n/useT';
import type { FloorPlan, MapObject, PlanLink } from '../../store/types';
import type { CanvasStageHandle } from './CanvasStage';
import { getCachedUnsavedAgainstLatest } from './planUnsavedChanges';
import type { MyMeetingsModalState } from './useRoomMeetingsTimeline';

// Body-extraction of more non-JSX usePlanView callbacks/memos. Bodies moved verbatim; closed-over
// values passed via `deps`, mirroring each hook's dependency array. Wrappers + dep arrays in
// usePlanView are unchanged.

type T = ReturnType<typeof useT>;

export type MyMeetingsFilteredDeps = {
  myMeetingsModal: { meetings?: any[] } | null;
  myMeetingsSearch: string;
  meetingLocationLabels: {
    clientNameById: Map<string, string>;
    siteNameById: Map<string, string>;
    floorPlanNameById: Map<string, string>;
  };
};

export const computeMyMeetingsFiltered = (deps: MyMeetingsFilteredDeps) => {
  const { myMeetingsModal, myMeetingsSearch, meetingLocationLabels } = deps;
    const rows = [...(myMeetingsModal?.meetings || [])].sort((a, b) => {
      const startDiff = Number(b.startAt || 0) - Number(a.startAt || 0);
      if (startDiff !== 0) return startDiff;
      return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    });
    const q = String(myMeetingsSearch || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((booking) => {
      const clientLabel = meetingLocationLabels.clientNameById.get(String(booking.clientId || '')) || '';
      const siteLabel = meetingLocationLabels.siteNameById.get(String(booking.siteId || '')) || '';
      const floorLabel = meetingLocationLabels.floorPlanNameById.get(String(booking.floorPlanId || '')) || '';
      const startAt = Number(booking.startAt || 0);
      const endAt = Number(booking.endAt || 0);
      const timeLabel = `${new Date(startAt).toLocaleString()} ${new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`.toLowerCase();
      return (
        String(booking.subject || '').toLowerCase().includes(q) ||
        String(booking.roomName || '').toLowerCase().includes(q) ||
        clientLabel.toLowerCase().includes(q) ||
        siteLabel.toLowerCase().includes(q) ||
        floorLabel.toLowerCase().includes(q) ||
        timeLabel.includes(q)
      );
    });
};

export type SafetyEmergencyContactsDeps = {
  client: any;
  planId: string;
  site: { id?: string } | null | undefined;
};

export const computeSafetyEmergencyContacts = (deps: SafetyEmergencyContactsDeps) => {
  const { client, planId, site } = deps;
    const list = Array.isArray((client as any)?.emergencyContacts) ? ((client as any).emergencyContacts as any[]) : [];
    const scopeRank = (scope: string) => {
      if (scope === 'global') return 0;
      if (scope === 'client') return 1;
      if (scope === 'site') return 2;
      if (scope === 'plan') return 3;
      return 9;
    };
    const out = list.filter((entry) => {
      const scope = String(entry?.scope || '');
      const showOnPlanCard = entry?.showOnPlanCard !== false;
      if (!showOnPlanCard) return false;
      if (scope === 'global' || scope === 'client') return true;
      if (scope === 'site') return String(entry?.siteId || '') === String(site?.id || '');
      if (scope === 'plan') return String(entry?.floorPlanId || '') === String(planId || '');
      return false;
    });
    return out.sort((a, b) => {
      const aScope = String(a?.scope || '');
      const bScope = String(b?.scope || '');
      const byScope = scopeRank(aScope) - scopeRank(bScope);
      if (byScope !== 0) return byScope;
      return `${a?.name || ''}`.localeCompare(`${b?.name || ''}`);
    });
};

export type ToggleRevisionImmutableDeps = {
  isSuperAdmin: boolean;
  user: { id?: string; username?: string } | null | undefined;
  updateRevision: (...args: any[]) => void;
  planId: string;
  postAuditEvent: (...args: any[]) => void;
  push: (...args: any[]) => void;
  t: T;
};

export const runToggleRevisionImmutable = (revisionId: string, nextValue: boolean, deps: ToggleRevisionImmutableDeps): void => {
  const { isSuperAdmin, user, updateRevision, planId, postAuditEvent, push, t } = deps;
      if (!isSuperAdmin) return;
      const actorId = String(user?.id || '');
      const actorName = String(user?.username || '');
      updateRevision(planId, revisionId, {
        immutable: !!nextValue,
        immutableBy: nextValue && actorId ? { id: actorId, username: actorName } : undefined
      });
      postAuditEvent({
        event: nextValue ? 'revision_immutable_set' : 'revision_immutable_clear',
        scopeType: 'plan',
        scopeId: planId,
        details: { id: revisionId, by: actorName || undefined }
      });
      push(
        t({
          it: nextValue ? 'Revisione resa immutabile' : 'Revisione sbloccata',
          en: nextValue ? 'Revision set to immutable' : 'Revision unlocked'
        }),
        'info'
      );
};

export type OpenMeetingManagerDeps = {
  client: { id?: string } | null | undefined;
  site: { id?: string } | null | undefined;
  planId: string;
  hasNavigationEdits: boolean;
  isReadOnly: boolean;
  setPendingMeetingManagerPreset: (v: any) => void;
  setSaveRevisionModalPreset: (v: any) => void;
  setSaveRevisionOpen: (v: boolean) => void;
  push: (...args: any[]) => void;
  t: T;
  setMeetingManagerPreset: (v: any) => void;
  setMeetingManagerOpen: (v: boolean) => void;
};

export const runOpenMeetingManager = (
  preset: { roomId?: string; floorPlanId?: string; siteId?: string; clientId?: string; day?: string } | undefined,
  deps: OpenMeetingManagerDeps
): void => {
  const {
    client,
    site,
    planId,
    hasNavigationEdits,
    isReadOnly,
    setPendingMeetingManagerPreset,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen,
    push,
    t,
    setMeetingManagerPreset,
    setMeetingManagerOpen
  } = deps;
      const normalizedPreset = {
        clientId: preset?.clientId || client?.id,
        siteId: preset?.siteId || site?.id,
        floorPlanId: preset?.floorPlanId || planId,
        roomId: preset?.roomId,
        day: preset?.day
      };
      if (hasNavigationEdits && !isReadOnly) {
        setPendingMeetingManagerPreset(normalizedPreset);
        setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
        setSaveRevisionOpen(true);
        push(
          t({
            it: 'La pianificazione meeting usa i dati correnti della planimetria (es. nomi stanze). Salva o scarta prima di continuare.',
            en: 'Meeting scheduling uses the current floor plan data (e.g. room names). Save or discard changes before continuing.'
          }),
          'info'
        );
        return;
      }
      setMeetingManagerPreset(normalizedPreset);
      setMeetingManagerOpen(true);
};

export type StartScaleModeDeps = {
  isReadOnly: boolean;
  dismissScaleToast: () => void;
  resetToolClickHistory: () => void;
  setScaleMode: (v: boolean) => void;
  setScaleDraft: (v: any) => void;
  setScaleDraftPointer: (v: any) => void;
  setScaleModal: (v: any) => void;
  setScaleMetersInput: (v: string) => void;
  setRoomDrawMode: (v: any) => void;
  setMeasureMode: (v: boolean) => void;
  setWallDrawMode: (v: boolean) => void;
  setQuoteMode: (v: boolean) => void;
  setQuotePoints: (v: any) => void;
  setQuotePointer: (v: any) => void;
  setPendingType: (v: any) => void;
  scaleToastIdRef: { current: string | number | null };
  t: T;
};

export const runStartScaleMode = (deps: StartScaleModeDeps): void => {
  const {
    isReadOnly,
    dismissScaleToast,
    resetToolClickHistory,
    setScaleMode,
    setScaleDraft,
    setScaleDraftPointer,
    setScaleModal,
    setScaleMetersInput,
    setRoomDrawMode,
    setMeasureMode,
    setWallDrawMode,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setPendingType,
    scaleToastIdRef,
    t
  } = deps;
    if (isReadOnly) return;
    dismissScaleToast();
    resetToolClickHistory();
    setScaleMode(true);
    setScaleDraft({});
    setScaleDraftPointer(null);
    setScaleModal(null);
    setScaleMetersInput('');
    setRoomDrawMode(null);
    setMeasureMode(false);
    setWallDrawMode(false);
    setQuoteMode(false);
    setQuotePoints([]);
    setQuotePointer(null);
    setPendingType(null);
    scaleToastIdRef.current = toast.info(
      t({
        it: 'Scala: clicca due punti. La linea resta orizzontale/verticale di default, tieni Shift per renderla libera.',
        en: 'Scale: click two points. The line snaps horizontal/vertical by default; hold Shift to make it free.'
      }),
      { duration: Infinity }
    );
};

export type StartMeasureDeps = {
  metersPerPixel: number | null | undefined;
  push: (...args: any[]) => void;
  t: T;
  setMeasureMode: (v: boolean) => void;
  measurePointsRef: { current: any };
  setMeasurePoints: (v: any) => void;
  setMeasurePointer: (v: any) => void;
  setMeasureClosed: (v: boolean) => void;
  setMeasureFinished: (v: boolean) => void;
  measureClosedRef: { current: boolean };
  measureFinishedRef: { current: boolean };
  setQuoteMode: (v: boolean) => void;
  setQuotePoints: (v: any) => void;
  setQuotePointer: (v: any) => void;
  setRoomDrawMode: (v: any) => void;
  setScaleMode: (v: boolean) => void;
  setWallDrawMode: (v: boolean) => void;
  setPendingType: (v: any) => void;
  showMeasureToast: (points: any[], options: { closed: boolean; finished: boolean }) => void;
};

export const runStartMeasure = (point: { x: number; y: number } | undefined, deps: StartMeasureDeps): void => {
  const {
    metersPerPixel,
    push,
    t,
    setMeasureMode,
    measurePointsRef,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished,
    measureClosedRef,
    measureFinishedRef,
    setQuoteMode,
    setQuotePoints,
    setQuotePointer,
    setRoomDrawMode,
    setScaleMode,
    setWallDrawMode,
    setPendingType,
    showMeasureToast
  } = deps;
      if (!metersPerPixel) {
        push(t({ it: 'Imposta la scala prima di misurare.', en: 'Set the scale before measuring.' }), 'info');
        return;
      }
      setMeasureMode(true);
      const nextPoints = point ? [point] : [];
      measurePointsRef.current = nextPoints;
      setMeasurePoints(nextPoints);
      setMeasurePointer(null);
      setMeasureClosed(false);
      setMeasureFinished(false);
      measureClosedRef.current = false;
      measureFinishedRef.current = false;
      setQuoteMode(false);
      setQuotePoints([]);
      setQuotePointer(null);
      setRoomDrawMode(null);
      setScaleMode(false);
      setWallDrawMode(false);
      setPendingType(null);
      showMeasureToast(nextPoints, { closed: false, finished: false });
};

export type HandleWallSegmentDblClickDeps = {
  metersPerPixel: number | null | undefined;
  lang: string;
  push: (...args: any[]) => void;
  t: T;
  formatNumber: (n: number) => string;
};

export const runHandleWallSegmentDblClick = (payload: { id: string; lengthPx: number }, deps: HandleWallSegmentDblClickDeps): void => {
  const { metersPerPixel, lang, push, t, formatNumber } = deps;
      const lengthPx = Number(payload?.lengthPx);
      if (!Number.isFinite(lengthPx) || lengthPx <= 0) return;
      if (metersPerPixel) {
        const meters = lengthPx * metersPerPixel;
        const unit = lang === 'it' ? 'ml' : 'm';
        push(
          t({
            it: `Lunghezza lato: ${formatNumber(meters)} ${unit}`,
            en: `Wall side length: ${formatNumber(meters)} ${unit}`
          }),
          'info'
        );
        return;
      }
      push(
        t({
          it: `Lunghezza lato: ${formatNumber(lengthPx)} px`,
          en: `Wall side length: ${formatNumber(lengthPx)} px`
        }),
        'info'
      );
};

export type AddTypeToPaletteDeps = {
  isDoorType: (type: string) => boolean;
  push: (...args: any[]) => void;
  t: T;
};

export const runAddTypeToPalette = async (typeId: string, deps: AddTypeToPaletteDeps): Promise<void> => {
  const { isDoorType, push, t } = deps;
      if (isDoorType(typeId)) {
        push(t({ it: 'Le porte sono gestite dal catalogo dedicato e non dalla palette.', en: 'Doors are managed in the dedicated catalog, not in the palette.' }), 'info');
        return;
      }
      if (isSecurityTypeId(typeId)) {
        push(t({ it: 'I dispositivi sicurezza sono nel pannello Sicurezza dedicato.', en: 'Safety devices are managed in the dedicated Safety panel.' }), 'info');
        return;
      }
      const user = useAuthStore.getState().user as any;
      const enabled = Array.isArray(user?.paletteFavorites) ? (user.paletteFavorites as string[]) : [];
      if (enabled.includes(typeId)) return;
      const next = [...enabled, typeId];
      try {
        await updateMyProfile({ paletteFavorites: next });
        useAuthStore.setState((s) =>
          s.user ? ({ user: { ...s.user, paletteFavorites: next } as any, permissions: s.permissions, hydrated: s.hydrated } as any) : s
        );
        push(t({ it: 'Oggetto aggiunto alla palette', en: 'Object added to palette' }), 'success');
      } catch {
        push(t({ it: 'Salvataggio non riuscito', en: 'Save failed' }), 'danger');
      }
};


export type GetObjectBoundsForAlignDeps = {
  canvasStageRef: { current: CanvasStageHandle | null };
};

export const computeGetObjectBoundsForAlign = (obj: MapObject, deps: GetObjectBoundsForAlignDeps) => {
  const { canvasStageRef } = deps;
    const boundsFromStage = canvasStageRef.current?.getObjectBounds?.(obj.id);
    if (boundsFromStage) return boundsFromStage;
    if (Array.isArray((obj as any).points) && (obj as any).points.length) {
      const pts = (obj as any).points as { x: number; y: number }[];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      if ([minX, minY, maxX, maxY].every(Number.isFinite)) return { minX, minY, maxX, maxY };
    }
    const x = Number(obj.x);
    const y = Number(obj.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { minX: x, minY: y, maxX: x, maxY: y };
    return null;
};

export type RoomStatsByIdDeps = {
  renderPlan: { objects?: MapObject[] } | undefined;
  isUserObject: (type: string) => boolean;
  roomStatsCacheRef: { current: { key: string; value: Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }> } };
};

export const computeRoomStatsById = (deps: RoomStatsByIdDeps) => {
  const { renderPlan, isUserObject, roomStatsCacheRef } = deps;
    const objs = renderPlan?.objects || [];
    let key = `${objs.length}`;
    for (const obj of objs) {
      key += `|${obj.id}:${obj.roomId || ''}:${obj.type}`;
    }
    if (roomStatsCacheRef.current.key === key) return roomStatsCacheRef.current.value;
    const map = new Map<string, { items: MapObject[]; userCount: number; otherCount: number; totalCount: number }>();
    for (const obj of objs) {
      if (!obj.roomId) continue;
      const entry =
        map.get(obj.roomId) || { items: [] as MapObject[], userCount: 0, otherCount: 0, totalCount: 0 };
      entry.items.push(obj);
      if (isUserObject(String(obj.type))) entry.userCount += 1;
      else entry.otherCount += 1;
      entry.totalCount += 1;
      map.set(obj.roomId, entry);
    }
    roomStatsCacheRef.current = { key, value: map };
    return map;
};

export type LinksInSelectionDeps = {
  basePlan: { links?: PlanLink[] } | null | undefined;
  selectedObjectIds: string[];
  selectionAllRealUsers: boolean;
  selectedLinkId: string | null;
};

export const computeLinksInSelection = (deps: LinksInSelectionDeps): PlanLink[] => {
  const { basePlan, selectedObjectIds, selectionAllRealUsers, selectedLinkId } = deps;
    const planLinks = ((basePlan as any)?.links || []) as PlanLink[];
    const ids = selectedObjectIds;
    if (!planLinks.length) return [] as PlanLink[];
    const seen = new Set<string>();
    const out: PlanLink[] = [];
    const inSel = new Set(ids);
    const allowBetween = !selectionAllRealUsers;
    for (const l of planLinks) {
      if (seen.has(l.id)) continue;
      const includeSelected = !!selectedLinkId && l.id === selectedLinkId;
      const includeBetween = allowBetween && ids.length > 1 && inSel.has(l.fromId) && inSel.has(l.toId);
      if (!includeSelected && !includeBetween) continue;
      seen.add(l.id);
      out.push(l);
    }
    // Put explicitly selected link first (if present).
    if (selectedLinkId) out.sort((a, b) => (a.id === selectedLinkId ? -1 : b.id === selectedLinkId ? 1 : 0));
    return out;
};


export type GetPlanUnsavedChangesDeps = {
  getPlanSnapshot: (plan: any) => any;
  baselineSnapshotRef: { current: any };
  getLatestRevisionCached: (revisions: any[]) => any;
  getRevisionSnapshotCached: (revision: any) => any;
  unsavedAgainstLatestCacheRef: { current: any };
  samePlanSnapshot: (...args: any[]) => boolean;
};

export const computeGetPlanUnsavedChanges = (targetPlan: FloorPlan | null | undefined, deps: GetPlanUnsavedChangesDeps): boolean => {
  const {
    getPlanSnapshot,
    baselineSnapshotRef,
    getLatestRevisionCached,
    getRevisionSnapshotCached,
    unsavedAgainstLatestCacheRef,
    samePlanSnapshot
  } = deps;
      if (!targetPlan) return false;
      const revisions = targetPlan.revisions || [];
      const current = getPlanSnapshot(targetPlan);
      if (!revisions.length) {
        const base = baselineSnapshotRef.current;
        if (!base) return false;
        return !samePlanSnapshot(current, base);
      }
      const latest = getLatestRevisionCached(revisions as any[]);
      if (!latest) return false;
      const latestSnapshot = getRevisionSnapshotCached(latest);
      return getCachedUnsavedAgainstLatest(
        unsavedAgainstLatestCacheRef.current,
        current,
        latestSnapshot,
        samePlanSnapshot
      );
};

export type ScaleLineDeps = {
  showScaleLine: boolean;
  planScale: any;
  scaleLabel: string | null | undefined;
};

export const computeScaleLine = (deps: ScaleLineDeps) => {
  const { showScaleLine, planScale, scaleLabel } = deps;
    if (!showScaleLine || !planScale?.start || !planScale?.end) return null;
    const labelScale = Number(planScale?.labelScale);
    const opacity = Number(planScale?.opacity);
    const strokeWidth = Number(planScale?.strokeWidth);
    return {
      start: planScale.start,
      end: planScale.end,
      label: scaleLabel || undefined,
      labelScale: Number.isFinite(labelScale) ? labelScale : 1,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : 1.2
    };
};


export type ToggleSecurityCardVisibilityDeps = {
  hideAllLayers: boolean;
  allItemsSelected: boolean;
  nonAllLayerIds: string[];
  visibleLayerIds: string[];
  setHideAllLayers: (planId: string, value: boolean) => void;
  setVisibleLayerIds: (planId: string, ids: string[]) => void;
  planId: string;
  normalizeLayerSelection: (ids: string[]) => string[];
};

export const runToggleSecurityCardVisibility = (deps: ToggleSecurityCardVisibilityDeps): void => {
  const {
    hideAllLayers,
    allItemsSelected,
    nonAllLayerIds,
    visibleLayerIds,
    setHideAllLayers,
    setVisibleLayerIds,
    planId,
    normalizeLayerSelection
  } = deps;
    const baseVisible = hideAllLayers
      ? []
      : allItemsSelected
        ? nonAllLayerIds
        : visibleLayerIds;
    const hasSecurity = baseVisible.includes(SECURITY_LAYER_ID);
    const nextRaw = hasSecurity
      ? baseVisible.filter((id) => id !== SECURITY_LAYER_ID)
      : [...baseVisible, SECURITY_LAYER_ID];
    if (hideAllLayers) setHideAllLayers(planId, false);
    setVisibleLayerIds(planId, normalizeLayerSelection(nextRaw));
};

export type PerformPendingPostSaveActionDeps = {
  logout: () => Promise<void> | void;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
};

export const runPerformPendingPostSaveAction = async (
  action: { type: 'language'; value: 'it' | 'en' } | { type: 'logout' },
  deps: PerformPendingPostSaveActionDeps
): Promise<void> => {
  const { logout, navigate } = deps;
      if (action.type === 'language') {
        try {
          await updateMyProfile({ language: action.value });
          useAuthStore.setState((s) =>
            s.user
              ? { user: { ...s.user, language: action.value } as any, permissions: s.permissions, hydrated: s.hydrated }
              : s
          );
        } catch {
          // ignore
        }
        window.location.reload();
        return;
      }
      await logout();
      navigate('/login', { replace: true });
};


export type BuildRoomPreviewDeps = {
  metersPerPixel: number | null | undefined;
  lang: string;
  formatNumber: (n: number) => string;
  formatCornerLabel: (index: number) => string;
};

export const computeBuildRoomPreview = (points: { x: number; y: number }[], deps: BuildRoomPreviewDeps) => {
  const { metersPerPixel, lang, formatNumber, formatCornerLabel } = deps;
      if (!points.length) return null;
      const cleaned =
        points.length >= 3 && points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y
          ? points.slice(0, -1)
          : points;
      if (cleaned.length < 2) return null;
      const unit = metersPerPixel ? (lang === 'it' ? 'ml' : 'm') : 'px';
      const segments = cleaned.map((start, index) => {
        const end = cleaned[(index + 1) % cleaned.length];
        const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
        const lengthLabel = metersPerPixel
          ? `${formatNumber(lengthPx * metersPerPixel)} ${unit}`
          : `${formatNumber(lengthPx)} ${unit}`;
        const label = `${formatCornerLabel(index)}-${formatCornerLabel((index + 1) % cleaned.length)}`;
        return { label, lengthLabel };
      });
      return { points: cleaned, segments };
};

export type OpenMyMeetingsModalDeps = {
  setMyMeetingsSearch: (v: string) => void;
  setMyMeetingsModal: (v: any) => void;
  reloadMyMeetings: () => void;
};

export const runOpenMyMeetingsModal = (
  opts: { returnToHub?: boolean; restore?: MyMeetingsModalState | null } | undefined,
  deps: OpenMyMeetingsModalDeps
): void => {
  const { setMyMeetingsSearch, setMyMeetingsModal, reloadMyMeetings } = deps;
    setMyMeetingsSearch('');
    const restore = opts?.restore;
    setMyMeetingsModal(
      restore
        ? {
            ...restore,
            loading: true,
            error: null,
            returnToHub: !!opts?.returnToHub
          }
        : {
            loading: true,
            error: null,
            now: Date.now(),
            meetings: [],
            counts: { total: 0, inProgress: 0, upcoming: 0, past: 0 },
            returnToHub: !!opts?.returnToHub
          }
    );
    void reloadMyMeetings();
};
