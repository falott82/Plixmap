import { useMemo } from 'react';
import type { FloorPlan, MapObject, MapObjectType } from '../../store/types';
import { WIFI_RANGE_SCALE_MAX } from '../../store/data';
import { googleMapsUrlFromCoords } from './planViewUtils';
import type { computeWallPolygonData } from './planViewWallGeometry';

// The context-menu union as declared by usePlanView's `useState`. Shared with the other
// extracted plan effect hooks that consume the same value.
export type PlanContextMenuState =
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

// The room-modal union as declared by usePlanModalState's `useState`.
export type PlanRoomModalState =
  | { mode: 'create'; kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
  | { mode: 'create'; kind: 'poly'; points: { x: number; y: number }[] }
  | {
      mode: 'edit';
      roomId: string;
      openDepartments?: boolean;
      initialName: string;
      initialNameEn?: string;
      initialCapacity?: number;
      initialShowName?: boolean;
      initialSurfaceSqm?: number;
      initialNotes?: string;
      initialLogical?: boolean;
      initialMeetingRoom?: boolean;
      initialMeetingProjector?: boolean;
      initialMeetingTv?: boolean;
      initialMeetingVideoConf?: boolean;
      initialMeetingCoffeeService?: boolean;
      initialMeetingWhiteboard?: boolean;
      initialNoWindows?: boolean;
      initialWifiAvailable?: boolean;
      initialFridgeAvailable?: boolean;
      initialStorageRoom?: boolean;
      initialBathroom?: boolean;
      initialTechnicalRoom?: boolean;
    }
  | null;

export type UsePlanContextDerivedDeps = {
  renderPlan: FloorPlan | undefined;
  contextMenu: PlanContextMenuState;
  renderPlanObjectById: Map<string, MapObject>;
  objectTypeLabels: Record<string, string>;
  realUserDetailsId: string | null;
  selectedObjectIds: string[];
  selectedObjects: MapObject[];
  isDeskType: (type: MapObjectType) => boolean;
  isWallType: (type: MapObjectType) => boolean;
  getWallPolygonData: (id: string) => ReturnType<typeof computeWallPolygonData>;
  getQuoteOrientation: (points?: { x: number; y: number }[]) => 'horizontal' | 'vertical';
  lastQuoteLabelPosV: 'center' | 'left' | 'right';
  lastQuoteLabelPosH: 'center' | 'above' | 'below';
  roomModal: PlanRoomModalState;
  computeRoomSurfaceSqm: (
    input: { kind?: string; points?: { x: number; y: number }[]; x?: number; y?: number; width?: number; height?: number },
    metersPerPixel?: number | null
  ) => number | undefined;
  metersPerPixel: number | null;
  roomWallTypeSelections: string[];
  defaultWallTypeId: string;
};

export function usePlanContextDerived(deps: UsePlanContextDerivedDeps) {
  const {
    renderPlan,
    contextMenu,
    renderPlanObjectById,
    objectTypeLabels,
    realUserDetailsId,
    selectedObjectIds,
    selectedObjects,
    isDeskType,
    isWallType,
    getWallPolygonData,
    getQuoteOrientation,
    lastQuoteLabelPosV,
    lastQuoteLabelPosH,
    roomModal,
    computeRoomSurfaceSqm,
    metersPerPixel,
    roomWallTypeSelections,
    defaultWallTypeId
  } = deps;

  const contextObject = useMemo(() => {
    if (!renderPlan || !contextMenu || contextMenu.kind !== 'object') return undefined;
    return renderPlanObjectById.get(contextMenu.id);
  }, [contextMenu, renderPlan, renderPlanObjectById]);
  const contextObjectTypeLabel = useMemo(() => {
    if (!contextObject) return '';
    return objectTypeLabels[contextObject.type] || contextObject.type;
  }, [contextObject, objectTypeLabels]);

  const realUserDetails = useMemo(() => {
    if (!realUserDetailsId || !renderPlan) return null;
    const obj = renderPlanObjectById.get(realUserDetailsId);
    if (!obj || obj.type !== 'real_user') return null;
    return {
      externalUserId: (obj as any).externalUserId,
      firstName: (obj as any).firstName,
      lastName: (obj as any).lastName,
      externalEmail: (obj as any).externalEmail,
      externalRole: (obj as any).externalRole,
      externalDept1: (obj as any).externalDept1,
      externalDept2: (obj as any).externalDept2,
      externalDept3: (obj as any).externalDept3,
      externalExt1: (obj as any).externalExt1,
      externalExt2: (obj as any).externalExt2,
      externalExt3: (obj as any).externalExt3,
      externalIsExternal: (obj as any).externalIsExternal
    };
  }, [realUserDetailsId, renderPlan, renderPlanObjectById]);

  const realUserDetailsName = useMemo(() => {
    if (!realUserDetailsId || !renderPlan) return '';
    const obj = renderPlanObjectById.get(realUserDetailsId);
    return String(obj?.name || realUserDetailsId);
  }, [realUserDetailsId, renderPlan, renderPlanObjectById]);

    const contextLink = useMemo(() => {
      if (!renderPlan || !contextMenu || contextMenu.kind !== 'link') return undefined;
      return (renderPlan.links || []).find((l: any) => l.id === contextMenu.id);
    }, [renderPlan, contextMenu]);

  const contextObjectLinkCount = useMemo(() => {
    if (!renderPlan || !contextMenu || contextMenu.kind !== 'object') return 0;
    const links = (renderPlan.links || []) as any[];
    const id = contextMenu.id;
    return links.filter((l) => String(l?.fromId || '') === id || String(l?.toId || '') === id).length;
  }, [contextMenu, renderPlan]);

  const hasDefaultView = useMemo(
    () => !!(renderPlan?.views || []).find((v) => v.isDefault),
    [renderPlan?.views]
  );

  const contextIsMulti = useMemo(() => {
    if (!contextMenu || contextMenu.kind !== 'object') return false;
    if (!selectedObjectIds?.length || selectedObjectIds.length < 2) return false;
    return selectedObjectIds.includes(contextMenu.id);
  }, [contextMenu, selectedObjectIds]);

  const contextIsRack = contextObject?.type === 'rack';
  const contextIsDesk = contextObject ? isDeskType(contextObject.type) : false;
  const contextIsCamera = contextObject?.type === 'camera';
  const contextIsWall = contextObject ? isWallType(contextObject.type) : false;
  const contextIsQuote = contextObject?.type === 'quote';
  const contextIsWifi = contextObject?.type === 'wifi';
  const contextIsPhoto = contextObject?.type === 'photo';
  const contextIsText = contextObject?.type === 'text';
  const contextIsAssemblyPoint = contextObject?.type === 'safety_assembly_point';
  const contextAssemblyGps = contextIsAssemblyPoint ? String((contextObject as any)?.gpsCoords || '') : '';
  const contextAssemblyMapsUrl = useMemo(() => googleMapsUrlFromCoords(contextAssemblyGps), [contextAssemblyGps]);
  const contextPhotoSelectionIds = useMemo(() => {
    if (!contextIsPhoto || !renderPlan) return [];
    const ids =
      contextIsMulti && selectedObjectIds.length
        ? selectedObjects.filter((obj) => obj.type === 'photo').map((obj) => obj.id)
        : contextMenu && contextMenu.kind === 'object'
          ? [contextMenu.id]
          : [];
    return ids;
  }, [contextIsMulti, contextIsPhoto, contextMenu, renderPlan, selectedObjectIds, selectedObjects]);
  const contextPhotoMulti = contextPhotoSelectionIds.length > 1;
  const planPhotoIds = useMemo(() => {
    if (!renderPlan) return [];
    return renderPlan.objects.filter((o) => o.type === 'photo').map((o) => o.id);
  }, [renderPlan]);
  const contextWifiRangeOn = contextIsWifi ? (contextObject as any)?.wifiShowRange !== false : false;
  const contextWifiRangeScale = contextIsWifi
    ? Math.max(0, Math.min(WIFI_RANGE_SCALE_MAX, Number((contextObject as any)?.wifiRangeScale ?? 1) || 1))
    : 1;
  const contextWifiCoverageSqm = contextIsWifi ? Number((contextObject as any)?.wifiCoverageSqm || 0) : 0;
  const contextWifiBaseRadiusM =
    contextIsWifi && Number.isFinite(contextWifiCoverageSqm) && contextWifiCoverageSqm > 0
      ? Math.sqrt(contextWifiCoverageSqm / Math.PI)
      : 0;
  const contextWifiBaseDiameterM = contextWifiBaseRadiusM > 0 ? contextWifiBaseRadiusM * 2 : 0;
  const contextWifiBaseAreaSqm = Number.isFinite(contextWifiCoverageSqm) && contextWifiCoverageSqm > 0 ? contextWifiCoverageSqm : 0;
  const contextWifiEffectiveRadiusM = contextWifiBaseRadiusM > 0 ? contextWifiBaseRadiusM * contextWifiRangeScale : 0;
  const contextWifiEffectiveDiameterM = contextWifiBaseDiameterM > 0 ? contextWifiBaseDiameterM * contextWifiRangeScale : 0;
  const contextWifiEffectiveAreaSqm =
    contextWifiBaseAreaSqm > 0 ? contextWifiBaseAreaSqm * Math.pow(contextWifiRangeScale, 2) : 0;
  const contextWallPolygon = useMemo(() => {
    if (!contextIsWall || !contextMenu || contextMenu.kind !== 'object') return null;
    return getWallPolygonData(contextMenu.id);
  }, [contextIsWall, contextMenu, getWallPolygonData]);
  const contextQuoteOrientation = useMemo(() => {
    if (!contextIsQuote) return 'horizontal' as const;
    const pts = (contextObject as any)?.points as { x: number; y: number }[] | undefined;
    return getQuoteOrientation(pts);
  }, [contextIsQuote, contextObject, getQuoteOrientation]);
  const contextQuoteLabelPos = useMemo(() => {
    if (!contextIsQuote) return 'center' as const;
    const current = String((contextObject as any)?.quoteLabelPos || 'center');
    if (contextQuoteOrientation === 'vertical') {
      return current === 'left' || current === 'right' || current === 'center' ? (current as any) : lastQuoteLabelPosV;
    }
    return current === 'above' || current === 'below' || current === 'center' ? (current as any) : lastQuoteLabelPosH;
  }, [contextIsQuote, contextObject, contextQuoteOrientation, lastQuoteLabelPosH, lastQuoteLabelPosV]);
  const roomModalInitialSurfaceSqm = useMemo(() => {
    if (!roomModal || roomModal.mode !== 'create') return undefined;
    if (roomModal.kind === 'rect' && roomModal.rect) {
      return computeRoomSurfaceSqm(roomModal.rect, metersPerPixel);
    }
    if (roomModal.kind === 'poly') {
      return computeRoomSurfaceSqm({ kind: 'poly', points: roomModal.points }, metersPerPixel);
    }
    return undefined;
  }, [computeRoomSurfaceSqm, metersPerPixel, roomModal]);
  const roomWallTypeAllValue = useMemo(() => {
    if (!roomWallTypeSelections.length) return defaultWallTypeId;
    const first = roomWallTypeSelections[0];
    if (!first) return defaultWallTypeId;
    return roomWallTypeSelections.every((value) => value === first) ? first : '';
  }, [defaultWallTypeId, roomWallTypeSelections]);
  const selectionAllWalls = useMemo(() => {
    if (!renderPlan) return false;
    if (!selectedObjects.length) return false;
    return selectedObjects.every((obj) => isWallType(obj.type));
  }, [isWallType, renderPlan, selectedObjects]);
  const canEditWallType = contextIsMulti ? selectionAllWalls : contextIsWall;

  const selectionHasRack = useMemo(() => {
    if (!renderPlan) return false;
    return selectedObjects.some((obj) => obj.type === 'rack');
  }, [renderPlan, selectedObjects]);
  const selectionHasDesk = useMemo(() => {
    if (!renderPlan) return false;
    return selectedObjects.some((obj) => isDeskType(obj.type));
  }, [renderPlan, selectedObjects]);
  const selectionHasPhoto = useMemo(() => {
    if (!renderPlan) return false;
    return selectedObjects.some((obj) => obj.type === 'photo');
  }, [renderPlan, selectedObjects]);
  const selectionPhotoIds = useMemo(() => {
    if (!renderPlan) return [];
    return selectedObjects.filter((obj) => obj.type === 'photo').map((obj) => obj.id);
  }, [renderPlan, selectedObjects]);
  const selectedWifiIds = useMemo(() => {
    if (!renderPlan) return [];
    return selectedObjects.filter((obj) => obj.type === 'wifi').map((obj) => obj.id);
  }, [renderPlan, selectedObjects]);
  const selectionAllRealUsers = useMemo(() => {
    if (!renderPlan) return false;
    if (!selectedObjects.length) return false;
    return selectedObjects.every((obj) => obj.type === 'real_user');
  }, [renderPlan, selectedObjects]);

  return {
    contextObject,
    contextObjectTypeLabel,
    realUserDetails,
    realUserDetailsName,
    contextLink,
    contextObjectLinkCount,
    hasDefaultView,
    contextIsMulti,
    contextIsRack,
    contextIsDesk,
    contextIsCamera,
    contextIsWall,
    contextIsQuote,
    contextIsWifi,
    contextIsPhoto,
    contextIsText,
    contextIsAssemblyPoint,
    contextAssemblyGps,
    contextAssemblyMapsUrl,
    contextPhotoSelectionIds,
    contextPhotoMulti,
    planPhotoIds,
    contextWifiRangeOn,
    contextWifiRangeScale,
    contextWifiCoverageSqm,
    contextWifiBaseRadiusM,
    contextWifiBaseDiameterM,
    contextWifiBaseAreaSqm,
    contextWifiEffectiveRadiusM,
    contextWifiEffectiveDiameterM,
    contextWifiEffectiveAreaSqm,
    contextWallPolygon,
    contextQuoteOrientation,
    contextQuoteLabelPos,
    roomModalInitialSurfaceSqm,
    roomWallTypeAllValue,
    selectionAllWalls,
    canEditWallType,
    selectionHasRack,
    selectionHasDesk,
    selectionHasPhoto,
    selectionPhotoIds,
    selectedWifiIds,
    selectionAllRealUsers
  };
}
