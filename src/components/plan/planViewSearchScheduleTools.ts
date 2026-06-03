import type { Dispatch, SetStateAction } from 'react';
import { isDeskType } from './deskTypes';
import { inferCorridorDoorLinkedRoomIds } from './planViewUtils';
import { currentLocalIsoDay } from '../../utils/localDate';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';
import type { Client, FloorPlan, Room } from '../../store/types';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';
import type { CrossPlanSearchResult } from './CrossPlanSearchModal';

// Pure computations extracted from usePlanView. Bodies are verbatim; closed-over values (including
// stable refs) are passed in via `deps`, mirroring each hook's original dependency array. Module
// imports (isDeskType, inferCorridorDoorLinkedRoomIds, currentLocalIsoDay) are imported directly
// here. The hook wrappers and their dep arrays stay unchanged.

type ClientSearchIndexEntry = { planId: string; search: string; result: CrossPlanSearchResult };

export type GetClientSearchIndexDeps = {
  client: Client | undefined;
  dataVersion: number;
  clientSearchIndexRef: { current: { key: string; value: ClientSearchIndexEntry[] } };
};

export const computeGetClientSearchIndex = (deps: GetClientSearchIndexDeps) => {
  const { client, dataVersion, clientSearchIndexRef } = deps;
  if (!client) return [] as ClientSearchIndexEntry[];
  const key = `${client.id}:${dataVersion}`;
  if (clientSearchIndexRef.current.key === key) return clientSearchIndexRef.current.value;
  const out: ClientSearchIndexEntry[] = [];
  for (const s of client.sites || []) {
    for (const p of s.floorPlans || []) {
      for (const o of p.objects || []) {
        if (isDeskType(o.type)) continue;
        const label =
          o.type === 'real_user' &&
          (((o as any).firstName && String((o as any).firstName).trim()) || ((o as any).lastName && String((o as any).lastName).trim()))
            ? `${String((o as any).firstName || '').trim()} ${String((o as any).lastName || '').trim()}`.trim()
            : o.name;
        const extra = o.type === 'real_user' ? `${String((o as any).firstName || '')} ${String((o as any).lastName || '')}`.trim() : '';
        const search = `${label} ${o.name} ${o.description || ''} ${extra}`.toLowerCase();
        out.push({
          planId: p.id,
          search,
          result: {
            kind: 'object',
            clientId: client.id,
            clientName: client.shortName || client.name,
            siteId: s.id,
            siteName: s.name,
            planId: p.id,
            planName: p.name,
            objectId: o.id,
            objectType: o.type,
            objectLabel: label,
            objectDescription: o.description || ''
          }
        });
      }
      for (const r of p.rooms || []) {
        const search = `${r.name || ''}`.toLowerCase();
        out.push({
          planId: p.id,
          search,
          result: {
            kind: 'room',
            clientId: client.id,
            clientName: client.shortName || client.name,
            siteId: s.id,
            siteName: s.name,
            planId: p.id,
            planName: p.name,
            roomId: r.id,
            roomName: r.name
          }
        });
      }
    }
  }
  clientSearchIndexRef.current = { key, value: out };
  return out;
};

type SchedulingPreset = {
  clientId?: string;
  siteId?: string;
  siteLocked?: boolean;
  day?: string;
  returnTo?: 'hub' | 'myMeetings';
};

type NormalizedSchedulingPreset = {
  clientId?: string;
  siteId?: string;
  siteLocked?: boolean;
  day?: string;
  returnTo?: 'hub' | 'myMeetings';
};

export type OpenSchedulingFromHubDeps = {
  canManageMeetingScheduling: boolean;
  client: Client | undefined;
  dispatchOpenClientMeetingsTimeline: (preset: NormalizedSchedulingPreset) => void;
  hasNavigationEdits: boolean;
  isReadOnly: boolean;
  push: (message: string, tone?: ToastTone) => void;
  site: { id: string } | undefined;
  t: ReturnType<typeof useT>;
  setPendingClientMeetingsPreset: Dispatch<SetStateAction<NormalizedSchedulingPreset | null>>;
  setSaveRevisionModalPreset: Dispatch<
    SetStateAction<{ initialBump: 'minor' | 'major'; requireNoteForMajor: boolean }>
  >;
  setSaveRevisionOpen: Dispatch<SetStateAction<boolean>>;
};

export const computeOpenSchedulingFromHub = (preset: SchedulingPreset | undefined, deps: OpenSchedulingFromHubDeps) => {
  const {
    canManageMeetingScheduling,
    client,
    dispatchOpenClientMeetingsTimeline,
    hasNavigationEdits,
    isReadOnly,
    push,
    site,
    t,
    setPendingClientMeetingsPreset,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen
  } = deps;
  if (!canManageMeetingScheduling) {
    push(
      t({
        it: 'Non hai i permessi per la pianificazione meeting.',
        en: 'You do not have permissions for meeting scheduling.'
      }),
      'danger'
    );
    return;
  }
  const normalizedPreset = {
    clientId: preset?.clientId || client?.id,
    siteId: preset?.siteId || site?.id,
    siteLocked: !!preset?.siteLocked,
    day: preset?.day || currentLocalIsoDay(),
    returnTo: preset?.returnTo
  };
  if (hasNavigationEdits && !isReadOnly) {
    setPendingClientMeetingsPreset(normalizedPreset);
    setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
    setSaveRevisionOpen(true);
    push(
      t({
        it: 'La timeline meeting usa i dati correnti della planimetria (es. nomi stanze). Salva o scarta prima di continuare.',
        en: 'Meeting timeline uses current floor plan data (e.g. room names). Save or discard changes before continuing.'
      }),
      'info'
    );
    return;
  }
  dispatchOpenClientMeetingsTimeline(normalizedPreset);
};

type ContextMenuState =
  | { kind: 'object'; id: string; x: number; y: number; wallSegmentLengthPx?: number }
  | { kind: 'link'; id: string; x: number; y: number }
  | { kind: 'room'; id: string; x: number; y: number; worldX: number; worldY: number }
  | { kind: 'corridor'; id: string; x: number; y: number; worldX: number; worldY: number }
  | { kind: 'corridor_door'; corridorId: string; doorId: string; x: number; y: number }
  | { kind: 'room_door'; doorId: string; x: number; y: number }
  | { kind: 'corridor_connection'; corridorId: string; connectionId: string; x: number; y: number; worldX: number; worldY: number }
  | { kind: 'safety_card'; x: number; y: number; worldX: number; worldY: number }
  | { kind: 'scale'; x: number; y: number }
  | { kind: 'map'; x: number; y: number; worldX: number; worldY: number }
  | null;

type EscapeRouteModalState = {
  startPoint: { x: number; y: number };
  startPlanId: string;
  sourceKind: 'map' | 'room' | 'corridor';
} | null;

export type OpenEscapeRouteAtDeps = {
  contextMenu: ContextMenuState;
  plan: FloorPlan | undefined;
  planId: string;
  push: (message: string, tone?: ToastTone) => void;
  renderPlan: FloorPlan | undefined;
  siteFloorPlansLength: number;
  t: ReturnType<typeof useT>;
  setEscapeRouteModal: Dispatch<SetStateAction<EscapeRouteModalState>>;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState>>;
};

export const computeOpenEscapeRouteAt = (
  point: { x: number; y: number },
  sourceKind: 'map' | 'room' | 'corridor',
  deps: OpenEscapeRouteAtDeps
) => {
  const {
    contextMenu,
    plan,
    planId,
    push,
    renderPlan,
    siteFloorPlansLength,
    t,
    setEscapeRouteModal,
    setContextMenu
  } = deps;
  if (!siteFloorPlansLength) {
    push(t({ it: 'Nessuna planimetria disponibile per la sede selezionata.', en: 'No floor plans available for the selected site.' }), 'info');
    return;
  }
  if (sourceKind === 'room' && contextMenu?.kind === 'room') {
    const roomId = String(contextMenu.id || '');
    const activePlanForDoors = (renderPlan || plan) as any;
    const roomDoorsNow = Array.isArray(activePlanForDoors?.roomDoors) ? (activePlanForDoors.roomDoors as any[]) : [];
    const corridorsNow = Array.isArray(activePlanForDoors?.corridors) ? (activePlanForDoors.corridors as any[]) : [];
    const hasLinkedRoomDoor = roomDoorsNow.some(
      (door) => String((door as any)?.roomAId || '') === roomId || String((door as any)?.roomBId || '') === roomId
    );
    const hasCorridorDoorLink = corridorsNow.some((corridor) =>
      (corridor.doors || []).some((door: any) =>
        Array.isArray(door?.linkedRoomIds) && (door.linkedRoomIds as any[]).some((id) => String(id || '') === roomId)
      )
    );
    const inferredCorridorDoorLink = corridorsNow.some((corridor) =>
      (corridor.doors || []).some((door: any) =>
        inferCorridorDoorLinkedRoomIds(corridor, door, ((renderPlan?.rooms || plan?.rooms || []) as Room[])).includes(roomId)
      )
    );
    if (!hasLinkedRoomDoor && !hasCorridorDoorLink && !inferredCorridorDoorLink) {
      push(
        t({
          it: 'Per pianificare una via di fuga da questa stanza è necessario configurare almeno una porta collegata alla stanza.',
          en: 'To compute an escape route from this room you must configure at least one door linked to the room.'
        }),
        'danger'
      );
      setContextMenu(null);
      return;
    }
  }
  setEscapeRouteModal({
    startPoint: { x: Number(point.x), y: Number(point.y) },
    startPlanId: planId,
    sourceKind
  });
  setContextMenu(null);
};

export type EnsureObjectLayerVisibleDeps = {
  getLayerLabel: (id: string) => string;
  getObjectToastLabel: (name: string | undefined, typeId: string) => string;
  hideAllLayers: boolean;
  layerIdSet: Set<string>;
  normalizeLayerSelection: (ids: string[]) => string[];
  planId: string;
  push: (message: string, tone?: ToastTone) => void;
  setHideAllLayers: (planId: string, value: boolean) => void;
  setVisibleLayerIds: (planId: string, ids: string[]) => void;
  t: ReturnType<typeof useT>;
  visibleLayerIds: string[];
  layerActivationRef: { current: Set<string> };
};

export const computeEnsureObjectLayerVisible = (
  layerIds: string[] | undefined,
  name: string | undefined,
  typeId: string,
  deps: EnsureObjectLayerVisibleDeps
) => {
  const {
    getLayerLabel,
    getObjectToastLabel,
    hideAllLayers,
    layerIdSet,
    normalizeLayerSelection,
    planId,
    push,
    setHideAllLayers,
    setVisibleLayerIds,
    t,
    visibleLayerIds,
    layerActivationRef
  } = deps;
  if (!planId || !layerIds?.length) return;
  const valid = layerIds.filter((id) => layerIdSet.has(id) && id !== ALL_ITEMS_LAYER_ID);
  if (!valid.length) return;
  const visibleSet = new Set(layerActivationRef.current);
  const missing = valid.filter((id) => !visibleSet.has(id));
  if (!missing.length && !hideAllLayers) return;
  if (hideAllLayers) setHideAllLayers(planId, false);
  if (!missing.length) return;
  missing.forEach((id) => visibleSet.add(id));
  layerActivationRef.current = visibleSet;
  const next = normalizeLayerSelection([...visibleLayerIds, ...missing]);
  setVisibleLayerIds(planId, next);
  const layerLabel = getLayerLabel(missing[0]);
  const objectLabel = getObjectToastLabel(name, typeId);
  push(
    t({
      it: `Attivato Layer ${layerLabel} per visualizzazione oggetto ${objectLabel}.`,
      en: `Enabled layer ${layerLabel} to show object ${objectLabel}.`
    }),
    'info'
  );
};
