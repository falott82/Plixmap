import type { MutableRefObject } from 'react';
import type { FloorPlan, MapObjectType, Room } from '../../store/types';
import type { useT } from '../../i18n/useT';
import { WIFI_DEFAULT_STANDARD } from '../../store/data';

// Body-extraction of usePlanView's handleCreate (object create/duplicate from the modal). The
// function body is moved verbatim; closed-over values are passed in via `deps`. handleCreate is
// a plain (non-memoized) function in usePlanView, so there is no dependency array to preserve.

export type HandleCreatePayload = {
  name: string;
  description?: string;
  notes?: string;
  lastVerificationAt?: string;
  verifierCompany?: string;
  gpsCoords?: string;
  securityDocuments?: any[];
  securityCheckHistory?: any[];
  layerIds?: string[];
  customValues?: Record<string, any>;
  scale?: number;
  quoteLabelScale?: number;
  quoteLabelBg?: boolean;
  quoteLabelColor?: string;
  quoteLabelOffset?: number;
  quoteLabelPos?: 'center' | 'above' | 'below' | 'left' | 'right';
  quoteDashed?: boolean;
  quoteEndpoint?: 'arrows' | 'dots' | 'none';
  strokeColor?: string;
  textFont?: string;
  textSize?: number;
  textColor?: string;
  textBg?: boolean;
  textBgColor?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  wifiDb?: number;
  wifiStandard?: string;
  wifiBand24?: boolean;
  wifiBand5?: boolean;
  wifiBand6?: boolean;
  wifiBrand?: string;
  wifiModel?: string;
  wifiModelCode?: string;
  wifiCoverageSqm?: number;
  wifiCatalogId?: string;
  wifiShowRange?: boolean;
  wifiRangeScale?: number;
  ip?: string;
  url?: string;
};

type ModalState =
  | { mode: 'create'; type: MapObjectType; coords: { x: number; y: number }; textBoxWidth?: number; textBoxHeight?: number }
  | { mode: 'edit'; objectId: string }
  | { mode: 'duplicate'; objectId: string; coords: { x: number; y: number } }
  | null;

export type HandleCreateDeps = {
  plan: FloorPlan | null | undefined;
  modalState: ModalState;
  isReadOnly: boolean;
  markTouched: () => void;
  defaultObjectScale: number;
  lastQuoteLabelPosH: unknown;
  lastQuoteLabelBg: unknown;
  isCameraType: (type: string) => boolean;
  getCameraDefaults: () => Record<string, any>;
  lastQuoteColor: string;
  lastQuoteLabelScale: unknown;
  lastQuoteLabelColor: string;
  lastQuoteDashed: unknown;
  lastQuoteEndpoint: unknown;
  getTypeLayerIds: (type: string) => string[] | null | undefined;
  inferDefaultLayerIds: (type: string, layerIdSet: Set<string>) => string[];
  layerIdSet: Set<string>;
  addObject: (...args: any[]) => string;
  ensureObjectLayerVisible: (...args: any[]) => void;
  setLastQuoteScale: (v: number) => void;
  setLastQuoteColor: (v: string) => void;
  setLastQuoteLabelScale: (v: any) => void;
  setLastQuoteLabelBg: (v: any) => void;
  setLastQuoteLabelColor: (v: string) => void;
  setLastQuoteLabelPosH: (v: any) => void;
  setLastQuoteLabelPosV: (v: any) => void;
  setLastQuoteDashed: (v: any) => void;
  setLastQuoteEndpoint: (v: any) => void;
  setLastObjectScale: (v: number) => void;
  lastInsertedRef: MutableRefObject<{ id: string; name: string } | null>;
  getRoomIdAt: (...args: any[]) => any;
  resolveRoomAssignmentForObject: (...args: any[]) => any;
  isUserType: (type: unknown) => boolean;
  notifyNonPeopleRoomBlocked: () => void;
  updateObject: (...args: any[]) => void;
  saveCustomValues: (...args: any[]) => Promise<unknown>;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  postAuditEvent: (...args: any[]) => void;
  getQuoteOrientation: (points?: { x: number; y: number }[]) => string;
};

export const runHandleCreate = (payload: HandleCreatePayload, deps: HandleCreateDeps): void => {
  const {
    plan,
    modalState,
    isReadOnly,
    markTouched,
    defaultObjectScale,
    lastQuoteLabelPosH,
    lastQuoteLabelBg,
    isCameraType,
    getCameraDefaults,
    lastQuoteColor,
    lastQuoteLabelScale,
    lastQuoteLabelColor,
    lastQuoteDashed,
    lastQuoteEndpoint,
    getTypeLayerIds,
    inferDefaultLayerIds,
    layerIdSet,
    addObject,
    ensureObjectLayerVisible,
    setLastQuoteScale,
    setLastQuoteColor,
    setLastQuoteLabelScale,
    setLastQuoteLabelBg,
    setLastQuoteLabelColor,
    setLastQuoteLabelPosH,
    setLastQuoteLabelPosV,
    setLastQuoteDashed,
    setLastQuoteEndpoint,
    setLastObjectScale,
    lastInsertedRef,
    getRoomIdAt,
    resolveRoomAssignmentForObject,
    isUserType,
    notifyNonPeopleRoomBlocked,
    updateObject,
    saveCustomValues,
    push,
    t,
    postAuditEvent,
    getQuoteOrientation
  } = deps;
    if (!plan || !modalState || isReadOnly) return;
    if (modalState.mode === 'create') {
      markTouched();
      const nextScale = Number.isFinite(payload.scale as number) ? Number(payload.scale) : defaultObjectScale;
      const rawTextBoxWidth = modalState.type === 'text' ? Number((modalState as any).textBoxWidth) : undefined;
      const rawTextBoxHeight = modalState.type === 'text' ? Number((modalState as any).textBoxHeight) : undefined;
      const resolvedTextBoxWidth =
        Number.isFinite(rawTextBoxWidth as number) && (rawTextBoxWidth as number) > 0
          ? Math.max(80, Number(rawTextBoxWidth))
          : undefined;
      const resolvedTextBoxHeight =
        Number.isFinite(rawTextBoxHeight as number) && (rawTextBoxHeight as number) > 0
          ? Math.max(32, Number(rawTextBoxHeight))
          : undefined;
      const resolvedQuoteLabelPos = payload.quoteLabelPos || (lastQuoteLabelPosH as any);
      const resolvedQuoteLabelBg = payload.quoteLabelBg ?? lastQuoteLabelBg;
      const extra = {
        ...(isCameraType(modalState.type) ? getCameraDefaults() : {}),
        ...(modalState.type === 'quote'
          ? {
              strokeColor: payload.strokeColor || lastQuoteColor || '#f97316',
              quoteLabelScale: Number.isFinite(payload.quoteLabelScale as number)
                ? Number(payload.quoteLabelScale)
                : Number(lastQuoteLabelScale) || 1,
              quoteLabelBg: resolvedQuoteLabelBg,
              quoteLabelPos: resolvedQuoteLabelPos,
              quoteLabelColor: payload.quoteLabelColor || lastQuoteLabelColor || '#0f172a',
              quoteLabelOffset: Number.isFinite(payload.quoteLabelOffset as number)
                ? Number(payload.quoteLabelOffset)
                : undefined,
              quoteDashed: payload.quoteDashed ?? lastQuoteDashed,
              quoteEndpoint: payload.quoteEndpoint || lastQuoteEndpoint
            }
          : {}),
        ...(modalState.type === 'wifi'
          ? {
              wifiDb: payload.wifiDb,
              wifiStandard: payload.wifiStandard || WIFI_DEFAULT_STANDARD,
              wifiBand24: payload.wifiBand24,
              wifiBand5: payload.wifiBand5,
              wifiBand6: payload.wifiBand6,
              wifiBrand: payload.wifiBrand,
              wifiModel: payload.wifiModel,
              wifiModelCode: payload.wifiModelCode,
              wifiCoverageSqm: payload.wifiCoverageSqm,
              wifiCatalogId: payload.wifiCatalogId,
              wifiShowRange: payload.wifiShowRange ?? true,
              wifiRangeScale: payload.wifiRangeScale
            }
          : {}),
        ...(modalState.type === 'text'
          ? {
              textFont: payload.textFont,
              textSize: payload.textSize,
              textColor: payload.textColor,
              textBg: payload.textBg ?? false,
              textBgColor: payload.textBgColor || '#ffffff',
              ...(resolvedTextBoxWidth ? { textBoxWidth: resolvedTextBoxWidth } : {}),
              ...(resolvedTextBoxHeight ? { textBoxHeight: resolvedTextBoxHeight } : {})
            }
          : {}),
        ...(modalState.type === 'image' || modalState.type === 'photo'
          ? {
              imageUrl: payload.imageUrl,
              imageWidth: payload.imageWidth,
              imageHeight: payload.imageHeight
            }
          : {}),
        ...(payload.ip !== undefined ? { ip: payload.ip } : {}),
        ...(payload.url !== undefined ? { url: payload.url } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.lastVerificationAt !== undefined ? { lastVerificationAt: payload.lastVerificationAt } : {}),
        ...(payload.verifierCompany !== undefined ? { verifierCompany: payload.verifierCompany } : {}),
        ...(payload.gpsCoords !== undefined ? { gpsCoords: payload.gpsCoords } : {}),
        ...(payload.securityDocuments !== undefined ? { securityDocuments: payload.securityDocuments } : {}),
        ...(payload.securityCheckHistory !== undefined ? { securityCheckHistory: payload.securityCheckHistory } : {})
      };
      const fallbackLayerIds =
        modalState.type === 'quote' ? ['quotes'] : (getTypeLayerIds(modalState.type) || inferDefaultLayerIds(modalState.type, layerIdSet));
      const layerIds =
        modalState.type === 'quote' ? ['quotes'] : (payload.layerIds?.length ? payload.layerIds : fallbackLayerIds);
      const id = addObject(
        plan.id,
        modalState.type,
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        Math.max(0.2, Math.min(2.4, nextScale || 1)),
        layerIds,
        Object.keys(extra).length ? extra : undefined
      );
      ensureObjectLayerVisible(layerIds, payload.name, modalState.type);
      if (modalState.type === 'quote') {
        setLastQuoteScale(Math.max(0.5, Math.min(1.6, nextScale || 1)));
        if (payload.strokeColor) setLastQuoteColor(payload.strokeColor);
        if (payload.quoteLabelScale !== undefined) setLastQuoteLabelScale(payload.quoteLabelScale);
        if (resolvedQuoteLabelBg !== undefined) setLastQuoteLabelBg(resolvedQuoteLabelBg);
        if (payload.quoteLabelColor) setLastQuoteLabelColor(payload.quoteLabelColor);
        if (payload.quoteLabelPos) {
          setLastQuoteLabelPosH(payload.quoteLabelPos as any);
          setLastQuoteLabelPosV(payload.quoteLabelPos as any);
        }
        if (payload.quoteDashed !== undefined) setLastQuoteDashed(payload.quoteDashed);
        if (payload.quoteEndpoint) setLastQuoteEndpoint(payload.quoteEndpoint);
      } else {
        setLastObjectScale(Math.max(0.2, Math.min(2.4, nextScale || 1)));
      }
      lastInsertedRef.current = { id, name: payload.name };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      const resolvedRoomId = resolveRoomAssignmentForObject(roomId, modalState.type, ((plan as FloorPlan).rooms || []) as Room[]);
      if (roomId && !resolvedRoomId && isUserType(modalState.type)) notifyNonPeopleRoomBlocked();
      if (resolvedRoomId) updateObject(id, { roomId: resolvedRoomId });
      if (payload.customValues && Object.keys(payload.customValues).length) {
        saveCustomValues(id, modalState.type, payload.customValues).catch(() => {});
      }
      push(
        t({ it: `Oggetto creato: ${payload.name}`, en: `Object created: ${payload.name}` }),
        'success'
      );
      postAuditEvent({
        event: 'object_create',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { id, type: modalState.type, name: payload.name, roomId: resolvedRoomId || null }
      });
    }
    if (modalState.mode === 'duplicate') {
      markTouched();
      const base = plan.objects.find((o) => o.id === modalState.objectId);
      const scale = Number.isFinite(payload.scale as number) ? Number(payload.scale) : (base?.scale ?? 1);
      const resolvedDupLabelPos =
        payload.quoteLabelPos || (base as any)?.quoteLabelPos || (lastQuoteLabelPosH as any);
      const resolvedDupLabelBg = payload.quoteLabelBg ?? (base as any)?.quoteLabelBg ?? lastQuoteLabelBg;
      const extra = {
        ...(base && isCameraType(base.type)
          ? {
              rotation: base.rotation ?? 0,
              cctvRange: (base as any).cctvRange ?? 160,
              cctvAngle: (base as any).cctvAngle ?? 70,
              cctvOpacity: (base as any).cctvOpacity ?? 0.6
            }
          : {}),
        ...(base?.type === 'quote'
          ? {
              strokeColor: payload.strokeColor || base?.strokeColor || lastQuoteColor || '#f97316',
              quoteLabelScale: Number.isFinite(payload.quoteLabelScale as number)
                ? Number(payload.quoteLabelScale)
                : Number((base as any)?.quoteLabelScale) || Number(lastQuoteLabelScale) || 1,
              quoteLabelBg: resolvedDupLabelBg,
              quoteLabelPos: resolvedDupLabelPos,
              quoteLabelColor: payload.quoteLabelColor || (base as any)?.quoteLabelColor || lastQuoteLabelColor || '#0f172a',
              quoteLabelOffset: Number.isFinite(payload.quoteLabelOffset as number)
                ? Number(payload.quoteLabelOffset)
                : Number((base as any)?.quoteLabelOffset) || undefined,
              quoteDashed: payload.quoteDashed ?? (base as any)?.quoteDashed ?? lastQuoteDashed,
              quoteEndpoint: payload.quoteEndpoint || (base as any)?.quoteEndpoint || lastQuoteEndpoint
            }
          : {}),
        ...(base?.type === 'wifi'
          ? {
              wifiDb: payload.wifiDb ?? (base as any).wifiDb,
              wifiStandard: payload.wifiStandard || (base as any).wifiStandard || WIFI_DEFAULT_STANDARD,
              wifiBand24: payload.wifiBand24 ?? (base as any).wifiBand24,
              wifiBand5: payload.wifiBand5 ?? (base as any).wifiBand5,
              wifiBand6: payload.wifiBand6 ?? (base as any).wifiBand6,
              wifiBrand: payload.wifiBrand ?? (base as any).wifiBrand,
              wifiModel: payload.wifiModel ?? (base as any).wifiModel,
              wifiModelCode: payload.wifiModelCode ?? (base as any).wifiModelCode,
              wifiCoverageSqm: payload.wifiCoverageSqm ?? (base as any).wifiCoverageSqm,
              wifiCatalogId: payload.wifiCatalogId ?? (base as any).wifiCatalogId,
              wifiShowRange: payload.wifiShowRange ?? (base as any).wifiShowRange,
              wifiRangeScale: payload.wifiRangeScale ?? (base as any).wifiRangeScale
            }
          : {}),
        ...(base?.type === 'text'
          ? {
              textFont: payload.textFont || (base as any).textFont,
              textSize: payload.textSize ?? (base as any).textSize,
              textColor: payload.textColor || (base as any).textColor,
              textBg: payload.textBg ?? (base as any).textBg,
              textBgColor: payload.textBgColor || (base as any).textBgColor,
              textBoxWidth: (base as any).textBoxWidth,
              textBoxHeight: (base as any).textBoxHeight
            }
          : {}),
        ...(base?.type === 'image' || base?.type === 'photo'
          ? {
              imageUrl: payload.imageUrl || (base as any).imageUrl,
              imageWidth: payload.imageWidth ?? (base as any).imageWidth,
              imageHeight: payload.imageHeight ?? (base as any).imageHeight
            }
          : {}),
        ip: payload.ip ?? (base as any)?.ip,
        url: payload.url ?? (base as any)?.url,
        notes: payload.notes ?? (base as any)?.notes,
        lastVerificationAt: payload.lastVerificationAt ?? (base as any)?.lastVerificationAt,
        verifierCompany: payload.verifierCompany ?? (base as any)?.verifierCompany,
        gpsCoords: payload.gpsCoords ?? (base as any)?.gpsCoords,
        securityDocuments: payload.securityDocuments ?? (base as any)?.securityDocuments,
        securityCheckHistory: payload.securityCheckHistory ?? (base as any)?.securityCheckHistory
      };
      const layerIds =
        base?.type === 'quote'
          ? ['quotes']
          : (payload.layerIds?.length ? payload.layerIds : inferDefaultLayerIds(base?.type || 'user', layerIdSet));
      const id = addObject(
        plan.id,
        base?.type || 'user',
        payload.name,
        payload.description,
        modalState.coords.x,
        modalState.coords.y,
        Math.max(0.2, Math.min(2.4, scale || 1)),
        layerIds,
        Object.keys(extra).length ? extra : undefined
      );
      ensureObjectLayerVisible(layerIds, payload.name, base?.type || 'user');
      if (base?.type === 'quote') {
        setLastQuoteScale(Math.max(0.5, Math.min(1.6, scale || 1)));
        if (payload.strokeColor) setLastQuoteColor(payload.strokeColor);
        if (payload.quoteLabelScale !== undefined) setLastQuoteLabelScale(payload.quoteLabelScale);
        if (resolvedDupLabelBg !== undefined) setLastQuoteLabelBg(resolvedDupLabelBg);
        if (payload.quoteLabelColor) setLastQuoteLabelColor(payload.quoteLabelColor);
        if (payload.quoteLabelPos) {
          const orientation = getQuoteOrientation((base as any)?.points);
          if (orientation === 'vertical') setLastQuoteLabelPosV(payload.quoteLabelPos as any);
          else setLastQuoteLabelPosH(payload.quoteLabelPos as any);
        }
        if (payload.quoteDashed !== undefined) setLastQuoteDashed(payload.quoteDashed);
        if (payload.quoteEndpoint) setLastQuoteEndpoint(payload.quoteEndpoint);
      } else {
        setLastObjectScale(Math.max(0.2, Math.min(2.4, scale || 1)));
      }
      lastInsertedRef.current = { id, name: payload.name };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, modalState.coords.x, modalState.coords.y);
      const resolvedRoomId = resolveRoomAssignmentForObject(roomId, base?.type || 'user', ((plan as FloorPlan).rooms || []) as Room[]);
      if (roomId && !resolvedRoomId && isUserType(base?.type || 'user')) notifyNonPeopleRoomBlocked();
      if (resolvedRoomId) updateObject(id, { roomId: resolvedRoomId });
      if (payload.customValues && Object.keys(payload.customValues).length) {
        saveCustomValues(id, base?.type || 'user', payload.customValues).catch(() => {});
      }
      push(
        t({ it: `Oggetto duplicato: ${payload.name}`, en: `Object duplicated: ${payload.name}` }),
        'success'
      );
      postAuditEvent({
        event: 'object_duplicate',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { fromId: modalState.objectId, id, type: base?.type, name: payload.name, roomId: resolvedRoomId || null }
      });
    }
};

export type HandleUpdateDeps = {
  modalState: ModalState;
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | null | undefined;
  updateObject: (...args: any[]) => void;
  setLastQuoteScale: (v: number) => void;
  setLastQuoteLabelScale: (v: any) => void;
  setLastQuoteLabelBg: (v: any) => void;
  setLastQuoteLabelColor: (v: string) => void;
  getQuoteOrientation: (points?: { x: number; y: number }[]) => string;
  setLastQuoteLabelPosV: (v: any) => void;
  setLastQuoteLabelPosH: (v: any) => void;
  setLastQuoteColor: (v: string) => void;
  setLastQuoteDashed: (v: any) => void;
  setLastQuoteEndpoint: (v: any) => void;
  setLastObjectScale: (v: number) => void;
  saveCustomValues: (...args: any[]) => Promise<unknown>;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  postAuditEvent: (...args: any[]) => void;
  planId: string;
};

export const runHandleUpdate = (payload: HandleCreatePayload, deps: HandleUpdateDeps): void => {
  const {
    modalState,
    isReadOnly,
    markTouched,
    plan,
    updateObject,
    setLastQuoteScale,
    setLastQuoteLabelScale,
    setLastQuoteLabelBg,
    setLastQuoteLabelColor,
    getQuoteOrientation,
    setLastQuoteLabelPosV,
    setLastQuoteLabelPosH,
    setLastQuoteColor,
    setLastQuoteDashed,
    setLastQuoteEndpoint,
    setLastObjectScale,
    saveCustomValues,
    push,
    t,
    postAuditEvent,
    planId
  } = deps;
    if (!modalState || modalState.mode !== 'edit' || isReadOnly) return;
    markTouched();
    const obj = plan?.objects?.find((o) => o.id === modalState.objectId);
    const isQuote = obj?.type === 'quote';
    const resolvedQuoteLabelBg = payload.quoteLabelBg;
	    const wifiUpdates =
	      obj?.type === 'wifi'
	        ? {
	            wifiDb: payload.wifiDb,
	            wifiStandard: payload.wifiStandard || WIFI_DEFAULT_STANDARD,
	            wifiBand24: payload.wifiBand24,
	            wifiBand5: payload.wifiBand5,
	            wifiBand6: payload.wifiBand6,
	            wifiBrand: payload.wifiBrand,
	            wifiModel: payload.wifiModel,
	            wifiModelCode: payload.wifiModelCode,
	            wifiCoverageSqm: payload.wifiCoverageSqm,
	            wifiCatalogId: payload.wifiCatalogId,
	            wifiShowRange: payload.wifiShowRange,
	            wifiRangeScale: payload.wifiRangeScale
	          }
	        : {};
    const textUpdates =
      obj?.type === 'text'
        ? {
            ...(payload.textFont ? { textFont: payload.textFont } : {}),
            ...(payload.textSize !== undefined ? { textSize: payload.textSize } : {}),
            ...(payload.textColor ? { textColor: payload.textColor } : {}),
            ...(payload.textBg !== undefined ? { textBg: payload.textBg } : {}),
            ...(payload.textBgColor ? { textBgColor: payload.textBgColor } : {})
          }
        : {};
    const imageUpdates =
      obj?.type === 'image' || obj?.type === 'photo'
        ? {
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
            ...(payload.imageWidth !== undefined ? { imageWidth: payload.imageWidth } : {}),
            ...(payload.imageHeight !== undefined ? { imageHeight: payload.imageHeight } : {})
          }
        : {};
    updateObject(modalState.objectId, {
      name: payload.name,
      description: payload.description,
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.lastVerificationAt !== undefined ? { lastVerificationAt: payload.lastVerificationAt } : {}),
      ...(payload.verifierCompany !== undefined ? { verifierCompany: payload.verifierCompany } : {}),
      ...(payload.gpsCoords !== undefined ? { gpsCoords: payload.gpsCoords } : {}),
      ...(payload.securityDocuments !== undefined ? { securityDocuments: payload.securityDocuments } : {}),
      ...(payload.securityCheckHistory !== undefined ? { securityCheckHistory: payload.securityCheckHistory } : {}),
      ...(payload.ip !== undefined ? { ip: payload.ip } : {}),
      ...(payload.url !== undefined ? { url: payload.url } : {}),
      layerIds: isQuote ? ['quotes'] : (payload.layerIds ?? obj?.layerIds),
      ...(payload.scale !== undefined ? { scale: Math.max(0.2, Math.min(2.4, Number(payload.scale) || 1)) } : {}),
      ...(isQuote && payload.quoteLabelScale !== undefined
        ? { quoteLabelScale: Math.max(0.6, Math.min(2, Number(payload.quoteLabelScale) || 1)) }
        : {}),
      ...(isQuote && resolvedQuoteLabelBg !== undefined ? { quoteLabelBg: resolvedQuoteLabelBg } : {}),
      ...(isQuote && payload.quoteLabelColor ? { quoteLabelColor: payload.quoteLabelColor } : {}),
      ...(isQuote && payload.quoteLabelOffset !== undefined
        ? { quoteLabelOffset: Math.max(0.5, Math.min(2, Number(payload.quoteLabelOffset) || 1)) }
        : {}),
      ...(isQuote && payload.quoteLabelPos ? { quoteLabelPos: payload.quoteLabelPos } : {}),
      ...(isQuote && payload.quoteDashed !== undefined ? { quoteDashed: payload.quoteDashed } : {}),
      ...(isQuote && payload.quoteEndpoint ? { quoteEndpoint: payload.quoteEndpoint } : {}),
      ...(isQuote && payload.strokeColor ? { strokeColor: payload.strokeColor } : {}),
      ...(wifiUpdates as any),
      ...(textUpdates as any),
      ...(imageUpdates as any)
    });
      if (isQuote) {
        if (payload.scale !== undefined) setLastQuoteScale(Math.max(0.5, Math.min(1.6, Number(payload.scale) || 1)));
        if (payload.quoteLabelScale !== undefined) setLastQuoteLabelScale(payload.quoteLabelScale);
        if (resolvedQuoteLabelBg !== undefined) setLastQuoteLabelBg(resolvedQuoteLabelBg);
        if (payload.quoteLabelColor) setLastQuoteLabelColor(payload.quoteLabelColor);
        if (payload.quoteLabelPos) {
          const orientation = getQuoteOrientation(obj?.points);
          if (orientation === 'vertical') setLastQuoteLabelPosV(payload.quoteLabelPos as any);
          else setLastQuoteLabelPosH(payload.quoteLabelPos as any);
        }
        if (payload.strokeColor) setLastQuoteColor(payload.strokeColor);
        if (payload.quoteDashed !== undefined) setLastQuoteDashed(payload.quoteDashed);
        if (payload.quoteEndpoint) setLastQuoteEndpoint(payload.quoteEndpoint);
    } else if (payload.scale !== undefined) {
      setLastObjectScale(Math.max(0.2, Math.min(2.4, Number(payload.scale) || 1)));
    }
    if (obj && payload.customValues) {
      saveCustomValues(modalState.objectId, obj.type, payload.customValues).catch(() => {});
    }
    push(
      t({ it: `Oggetto aggiornato: ${payload.name}`, en: `Object updated: ${payload.name}` }),
      'success'
    );
    postAuditEvent({
      event: 'object_update',
      scopeType: 'plan',
      scopeId: planId,
      details: { id: modalState.objectId, name: payload.name, description: payload.description || '', layerIds: payload.layerIds || [] }
    });
};

export type HandlePlaceNewDeps = {
  isReadOnly: boolean;
  panToolActive: boolean;
  setPanToolActive: (v: boolean) => void;
  shouldConfirmCapacity: (type: MapObjectType, x: number, y: number) => boolean;
  proceedPlaceUser: (type: MapObjectType, x: number, y: number) => void;
  isDeskType: (type: string) => boolean;
  plan: FloorPlan | null | undefined;
  markTouched: () => void;
  getTypeLabel: (type: string) => string;
  addObject: (...args: any[]) => string;
  defaultObjectScale: number;
  ensureObjectLayerVisible: (...args: any[]) => void;
  lastInsertedRef: MutableRefObject<{ id: string; name: string } | null>;
  getRoomIdAt: (...args: any[]) => any;
  updateObject: (...args: any[]) => void;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  postAuditEvent: (...args: any[]) => void;
  setModalState: (v: any) => void;
  setPendingType: (v: any) => void;
};

export const runHandlePlaceNew = (
  type: MapObjectType,
  x: number,
  y: number,
  options: { textBoxWidth?: number; textBoxHeight?: number } | undefined,
  deps: HandlePlaceNewDeps
): void => {
  const {
    isReadOnly,
    panToolActive,
    setPanToolActive,
    shouldConfirmCapacity,
    proceedPlaceUser,
    isDeskType,
    plan,
    markTouched,
    getTypeLabel,
    addObject,
    defaultObjectScale,
    ensureObjectLayerVisible,
    lastInsertedRef,
    getRoomIdAt,
    updateObject,
    push,
    t,
    postAuditEvent,
    setModalState,
    setPendingType
  } = deps;
    if (isReadOnly) return;
    if (panToolActive) setPanToolActive(false);
    if (shouldConfirmCapacity(type, x, y)) return;
    if (type === 'real_user' || type === 'user' || type === 'generic_user') {
      proceedPlaceUser(type, x, y);
      return;
    }
    if (isDeskType(type)) {
      if (!plan) return;
      markTouched();
      const label = getTypeLabel(type);
      const name = '';
      const id = addObject(
        plan.id,
        type,
        name,
        undefined,
        x,
        y,
        defaultObjectScale,
        ['desks'],
        { opacity: 1, rotation: 0, strokeWidth: 2, strokeColor: '#cbd5e1', scaleX: 1, scaleY: 1 }
      );
      ensureObjectLayerVisible(['desks'], label, type);
      lastInsertedRef.current = { id, name: label };
      const roomId = getRoomIdAt((plan as FloorPlan).rooms, x, y);
      if (roomId) updateObject(id, { roomId });
      push(t({ it: `Oggetto creato: ${label}`, en: `Object created: ${label}` }), 'success');
      postAuditEvent({
        event: 'object_create',
        scopeType: 'plan',
        scopeId: plan.id,
        details: { id, type, name: label, roomId: roomId || null }
      });
      setPendingType(null);
      return;
    }
    const textBoxWidth =
      type === 'text' && Number.isFinite(options?.textBoxWidth as number) ? Number(options?.textBoxWidth) : undefined;
    const textBoxHeight =
      type === 'text' && Number.isFinite(options?.textBoxHeight as number) ? Number(options?.textBoxHeight) : undefined;
    setModalState({
      mode: 'create',
      type,
      coords: { x, y },
      ...(type === 'text' ? { textBoxWidth, textBoxHeight } : {})
    });
    setPendingType(null);
};

export type OpenDuplicateDeps = {
  renderPlan: FloorPlan | undefined;
  isReadOnly: boolean;
  isDeskType: (type: string) => boolean;
  markTouched: () => void;
  getTypeLabel: (type: string) => string;
  inferDefaultLayerIds: (type: string, layerIdSet: Set<string>) => string[];
  layerIdSet: Set<string>;
  addObject: (...args: any[]) => string;
  ensureObjectLayerVisible: (...args: any[]) => void;
  lastInsertedRef: MutableRefObject<{ id: string; name: string } | null>;
  getRoomIdAt: (...args: any[]) => any;
  updateObject: (...args: any[]) => void;
  push: (...args: any[]) => void;
  t: ReturnType<typeof useT>;
  postAuditEvent: (...args: any[]) => void;
  setModalState: (v: any) => void;
};

export const runOpenDuplicate = (objectId: string, deps: OpenDuplicateDeps): void => {
  const {
    renderPlan,
    isReadOnly,
    isDeskType,
    markTouched,
    getTypeLabel,
    inferDefaultLayerIds,
    layerIdSet,
    addObject,
    ensureObjectLayerVisible,
    lastInsertedRef,
    getRoomIdAt,
    updateObject,
    push,
    t,
    postAuditEvent,
    setModalState
  } = deps;
    const obj = renderPlan?.objects.find((o) => o.id === objectId);
    if (!renderPlan || !obj || isReadOnly) return;
    const offset = 44 * (obj.scale ?? 1);
    if (isDeskType(obj.type)) {
      markTouched();
      const label = String(obj.name || getTypeLabel(obj.type)).trim() || getTypeLabel(obj.type);
      const layerIds = obj.layerIds || inferDefaultLayerIds(obj.type, layerIdSet);
      const id = addObject(
        renderPlan.id,
        obj.type,
        '',
        obj.description,
        obj.x + offset,
        obj.y + offset * 0.4,
        obj.scale ?? 1,
        layerIds,
        {
          opacity: obj.opacity,
          rotation: obj.rotation,
          strokeWidth: obj.strokeWidth,
          strokeColor: obj.strokeColor,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY
        }
      );
      ensureObjectLayerVisible(layerIds, label, obj.type);
      lastInsertedRef.current = { id, name: label };
      const roomId = getRoomIdAt((renderPlan as FloorPlan).rooms, obj.x + offset, obj.y + offset * 0.4);
      if (roomId) updateObject(id, { roomId });
      push(t({ it: `Oggetto duplicato: ${label}`, en: `Object duplicated: ${label}` }), 'success');
      postAuditEvent({
        event: 'object_duplicate',
        scopeType: 'plan',
        scopeId: renderPlan.id,
        details: { fromId: obj.id, id, type: obj.type, name: label, roomId: roomId || null }
      });
      return;
    }
    setModalState({ mode: 'duplicate', objectId, coords: { x: obj.x + offset, y: obj.y + offset * 0.4 } });
};
