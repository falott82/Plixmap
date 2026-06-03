import type { Dispatch, SetStateAction } from 'react';
import type { FloorPlan } from '../../store/types';
import type { useDataStore } from '../../store/useDataStore';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';

type Pt = { x: number; y: number };
type QuoteOrientation = 'horizontal' | 'vertical';
type DataStoreState = ReturnType<typeof useDataStore.getState>;
type ScaleModalState = { start: Pt; end: Pt; distance: number } | null;

// Pure computations extracted from usePlanView. Bodies are verbatim; closed-over values are passed
// in via `deps`, mirroring each hook's original dependency array (refs are stable). The hook
// wrappers and their dep arrays stay unchanged. Where the original dep array contained values not
// referenced in the body (e.g. layerIdSet, t, inferDefaultLayerIds in handleQuotePoint), they are
// not passed here — the wrapper retains them.

export type ApplyScaleDeps = {
  computeRoomSurfaceSqm: (
    room: { kind?: string; points?: Pt[]; x?: number; y?: number; width?: number; height?: number },
    metersPerPixelValue?: number | null
  ) => number | undefined;
  dismissScaleToast: () => void;
  isReadOnly: boolean;
  markTouched: () => void;
  plan: FloorPlan | undefined;
  planScale: FloorPlan['scale'] | undefined;
  push: (message: string, tone?: ToastTone) => void;
  scaleMetersInput: string;
  scaleModal: ScaleModalState;
  t: ReturnType<typeof useT>;
  updateFloorPlan: DataStoreState['updateFloorPlan'];
  updateRoom: DataStoreState['updateRoom'];
  setScaleDraft: Dispatch<SetStateAction<{ start?: Pt; end?: Pt } | null>>;
  setScaleDraftPointer: Dispatch<SetStateAction<Pt | null>>;
  setShowScaleLine: Dispatch<SetStateAction<boolean>>;
  setScaleModal: Dispatch<SetStateAction<ScaleModalState>>;
};

export const computeApplyScale = (deps: ApplyScaleDeps) => {
  const {
    computeRoomSurfaceSqm,
    dismissScaleToast,
    isReadOnly,
    markTouched,
    plan,
    planScale,
    push,
    scaleMetersInput,
    scaleModal,
    t,
    updateFloorPlan,
    updateRoom,
    setScaleDraft,
    setScaleDraftPointer,
    setShowScaleLine,
    setScaleModal
  } = deps;
  if (!scaleModal || !plan || isReadOnly) return;
  const raw = scaleMetersInput.trim().replace(',', '.');
  const meters = Number(raw);
  if (!Number.isFinite(meters) || meters <= 0) {
    push(t({ it: 'Inserisci un valore valido in metri.', en: 'Enter a valid value in meters.' }), 'danger');
    return;
  }
  const metersPerPixel = meters / scaleModal.distance;
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    push(t({ it: 'Scala non valida.', en: 'Invalid scale.' }), 'danger');
    return;
  }
  const labelScaleValue = Number(planScale?.labelScale);
  const opacityValue = Number(planScale?.opacity);
  const strokeWidthValue = Number(planScale?.strokeWidth);
  const prevMeters = Number(planScale?.meters);
  const ratio = Number.isFinite(prevMeters) && prevMeters > 0 ? meters / prevMeters : 1;
  const boost = ratio > 1 ? ratio : 1;
  const clampScale = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const nextLabelScale = clampScale((Number.isFinite(labelScaleValue) ? labelScaleValue : 1) * boost, 0.6, 1.8);
  const nextStrokeWidth = clampScale((Number.isFinite(strokeWidthValue) ? strokeWidthValue : 1.2) * boost, 0.6, 6);
  markTouched();
  updateFloorPlan(plan.id, {
    scale: {
      start: scaleModal.start,
      end: scaleModal.end,
      meters,
      metersPerPixel,
      labelScale: nextLabelScale,
      opacity: Number.isFinite(opacityValue) ? opacityValue : 1,
      strokeWidth: nextStrokeWidth
    }
  });
  if (Array.isArray(plan.rooms) && plan.rooms.length) {
    plan.rooms.forEach((room) => {
      const surfaceSqm = computeRoomSurfaceSqm(room, metersPerPixel);
      updateRoom(plan.id, room.id, { surfaceSqm });
    });
  }
  dismissScaleToast();
  push(
    t({
      it: 'Scala impostata: superfici delle stanze aggiornate automaticamente e non modificabili manualmente.',
      en: 'Scale set: room surfaces have been updated automatically and are no longer editable.'
    }),
    'info'
  );
  setScaleDraft(null);
  setScaleDraftPointer(null);
  setShowScaleLine(true);
  setScaleModal(null);
  push(t({ it: 'Scala impostata correttamente', en: 'Scale saved successfully' }), 'success');
};

export type HandleQuotePointDeps = {
  addObject: DataStoreState['addObject'];
  ensureObjectLayerVisible: (layerIds: string[] | undefined, name: string | undefined, typeId: string) => void;
  getQuoteOrientation: (points?: Pt[]) => QuoteOrientation;
  getTypeLabel: (typeId: string) => string;
  isReadOnly: boolean;
  lastQuoteColor: string;
  lastQuoteDashed: boolean;
  lastQuoteEndpoint: 'arrows' | 'dots' | 'none';
  lastQuoteLabelColor: string;
  lastQuoteLabelPosH: 'center' | 'above' | 'below';
  lastQuoteLabelPosV: 'center' | 'left' | 'right';
  lastQuoteLabelScale: number;
  lastQuoteLabelBg: boolean;
  lastQuoteScale: number;
  markTouched: () => void;
  quoteMode: boolean;
  quotePoints: Pt[];
  renderPlan: FloorPlan | undefined;
  resolveAxisLockedPoint: (point: Pt, anchor: Pt | null, options?: { shiftKey?: boolean }) => Pt;
  zoom: number;
  setQuotePoints: Dispatch<SetStateAction<Pt[]>>;
  setQuotePointer: Dispatch<SetStateAction<Pt | null>>;
};

export const computeHandleQuotePoint = (
  point: { x: number; y: number },
  options: { shiftKey?: boolean } | undefined,
  deps: HandleQuotePointDeps
) => {
  const {
    addObject,
    ensureObjectLayerVisible,
    getQuoteOrientation,
    getTypeLabel,
    isReadOnly,
    lastQuoteColor,
    lastQuoteDashed,
    lastQuoteEndpoint,
    lastQuoteLabelColor,
    lastQuoteLabelPosH,
    lastQuoteLabelPosV,
    lastQuoteLabelScale,
    lastQuoteLabelBg,
    lastQuoteScale,
    markTouched,
    quoteMode,
    quotePoints,
    renderPlan,
    resolveAxisLockedPoint,
    zoom,
    setQuotePoints,
    setQuotePointer
  } = deps;
  if (!quoteMode || isReadOnly || !renderPlan) return;
  if (!quotePoints.length) {
    setQuotePoints([point]);
    return;
  }
  const start = quotePoints[0];
  const resolved = resolveAxisLockedPoint(point, start, options);
  const dist = Math.hypot(resolved.x - start.x, resolved.y - start.y);
  const minSegment = 6 / Math.max(0.2, zoom || 1);
  if (dist < minSegment) return;
  const quoteScale = Math.max(0.5, Math.min(1.6, Number(lastQuoteScale) || 1));
  const orientation = getQuoteOrientation([start, resolved]);
  const quoteLabelPos = orientation === 'vertical' ? lastQuoteLabelPosV : lastQuoteLabelPosH;
  const quoteColor = lastQuoteColor || '#f97316';
  const quoteLabelScale = Math.max(0.6, Math.min(2, Number(lastQuoteLabelScale) || 1));
  const quoteLabelBg = quoteLabelPos === 'center' || lastQuoteLabelBg === true;
  const quoteLabelColor = lastQuoteLabelColor || '#0f172a';
  const quoteLabelOffset = 1;
  const quoteDashed = !!lastQuoteDashed;
  const quoteEndpoint = lastQuoteEndpoint || 'arrows';
  markTouched();
  addObject(
    renderPlan.id,
    'quote',
    '',
    undefined,
    start.x,
    start.y,
    quoteScale,
    ['quotes'],
    {
      points: [start, resolved],
      strokeColor: quoteColor,
      strokeWidth: 2,
      opacity: 1,
      quoteLabelPos,
      quoteLabelScale,
      quoteLabelBg,
      quoteLabelColor,
      quoteLabelOffset,
      quoteDashed,
      quoteEndpoint
    }
  );
  ensureObjectLayerVisible(['quotes'], getTypeLabel('quote'), 'quote');
  setQuotePoints([]);
  setQuotePointer(null);
};

export type ConvertMeasurementToQuotesDeps = {
  addObject: DataStoreState['addObject'];
  dismissMeasureToast: () => void;
  ensureObjectLayerVisible: (layerIds: string[] | undefined, name: string | undefined, typeId: string) => void;
  getQuoteOrientation: (points?: Pt[]) => QuoteOrientation;
  getTypeLabel: (typeId: string) => string;
  inferDefaultLayerIds: (typeId: string, layerIdSet?: Set<string>) => string[];
  isReadOnly: boolean;
  lastQuoteColor: string;
  lastQuoteDashed: boolean;
  lastQuoteEndpoint: 'arrows' | 'dots' | 'none';
  lastQuoteLabelBg: boolean;
  lastQuoteLabelColor: string;
  lastQuoteLabelPosH: 'center' | 'above' | 'below';
  lastQuoteLabelPosV: 'center' | 'left' | 'right';
  lastQuoteLabelScale: number;
  lastQuoteScale: number;
  layerIdSet: Set<string>;
  markTouched: () => void;
  measureMode: boolean;
  push: (message: string, tone?: ToastTone) => void;
  renderPlan: FloorPlan | undefined;
  t: ReturnType<typeof useT>;
  zoom: number;
  measurePointsRef: { current: Pt[] };
  measureClosedRef: { current: boolean };
  measureFinishedRef: { current: boolean };
  setMeasureMode: Dispatch<SetStateAction<boolean>>;
  setMeasurePoints: Dispatch<SetStateAction<Pt[]>>;
  setMeasurePointer: Dispatch<SetStateAction<Pt | null>>;
  setMeasureClosed: Dispatch<SetStateAction<boolean>>;
  setMeasureFinished: Dispatch<SetStateAction<boolean>>;
};

export const computeConvertMeasurementToQuotes = (deps: ConvertMeasurementToQuotesDeps) => {
  const {
    addObject,
    dismissMeasureToast,
    ensureObjectLayerVisible,
    getQuoteOrientation,
    getTypeLabel,
    inferDefaultLayerIds,
    isReadOnly,
    lastQuoteColor,
    lastQuoteDashed,
    lastQuoteEndpoint,
    lastQuoteLabelBg,
    lastQuoteLabelColor,
    lastQuoteLabelPosH,
    lastQuoteLabelPosV,
    lastQuoteLabelScale,
    lastQuoteScale,
    layerIdSet,
    markTouched,
    measureMode,
    push,
    renderPlan,
    t,
    zoom,
    measurePointsRef,
    measureClosedRef,
    measureFinishedRef,
    setMeasureMode,
    setMeasurePoints,
    setMeasurePointer,
    setMeasureClosed,
    setMeasureFinished
  } = deps;
  if (!measureMode) return;
  if (isReadOnly || !renderPlan) {
    push(t({ it: 'Non puoi creare quote in sola lettura.', en: 'You cannot create quotes in read-only mode.' }), 'info');
    return;
  }
  const points = [...measurePointsRef.current];
  const closed = !!measureClosedRef.current;
  const segments: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({ start: points[i], end: points[i + 1] });
  }
  if (closed && points.length > 2) {
    segments.push({ start: points[points.length - 1], end: points[0] });
  }
  if (!segments.length) {
    push(t({ it: 'Aggiungi almeno due punti per convertire in quote.', en: 'Add at least two points to convert into quotes.' }), 'info');
    return;
  }
  const minSegment = 6 / Math.max(0.2, zoom || 1);
  const quoteScale = Math.max(0.5, Math.min(1.6, Number(lastQuoteScale) || 1));
  const quoteColor = lastQuoteColor || '#f97316';
  const quoteLabelScale = Math.max(0.6, Math.min(2, Number(lastQuoteLabelScale) || 1));
  const quoteLabelColor = lastQuoteLabelColor || '#0f172a';
  const quoteLabelOffset = 1;
  const quoteDashed = !!lastQuoteDashed;
  const quoteEndpoint = lastQuoteEndpoint || 'arrows';
  let created = 0;
  markTouched();
  for (const segment of segments) {
    const distance = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
    if (distance < minSegment) continue;
    const orientation = getQuoteOrientation([segment.start, segment.end]);
    const quoteLabelPos = orientation === 'vertical' ? lastQuoteLabelPosV : lastQuoteLabelPosH;
    const quoteLabelBg = quoteLabelPos === 'center' || lastQuoteLabelBg === true;
    addObject(
      renderPlan.id,
      'quote',
      '',
      undefined,
      segment.start.x,
      segment.start.y,
      quoteScale,
      inferDefaultLayerIds('quote', layerIdSet),
      {
        points: [segment.start, segment.end],
        strokeColor: quoteColor,
        strokeWidth: 2,
        opacity: 1,
        quoteLabelPos,
        quoteLabelScale,
        quoteLabelBg,
        quoteLabelColor,
        quoteLabelOffset,
        quoteDashed,
        quoteEndpoint
      }
    );
    created += 1;
  }
  if (!created) {
    push(t({ it: 'Nessun lato valido da convertire in quota.', en: 'No valid side to convert into quote.' }), 'info');
    return;
  }
  ensureObjectLayerVisible(['quotes'], getTypeLabel('quote'), 'quote');
  setMeasureMode(false);
  setMeasurePoints([]);
  setMeasurePointer(null);
  setMeasureClosed(false);
  setMeasureFinished(false);
  measurePointsRef.current = [];
  measureClosedRef.current = false;
  measureFinishedRef.current = false;
  dismissMeasureToast();
  push(
    t({
      it: `Quote create dalla misurazione: ${created}.`,
      en: `Quotes created from measurement: ${created}.`
    }),
    'success'
  );
};
