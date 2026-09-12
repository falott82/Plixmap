import type { MutableRefObject, RefObject } from 'react';
import type { FloorPlan } from '../../store/types';
import type { CanvasStageHandle } from './CanvasStage';

// Body-extraction of usePlanView's viewport useEffects (default-view/last-view init, auto-center
// fit, presentation-mode fit/restore). Each body is moved verbatim; closed-over values are passed
// in via `deps` (mirroring each effect's existing dependency array plus the refs it reads). The
// effect wrappers and dependency arrays in usePlanView remain unchanged. Effects that registered
// a cleanup still return it.

type Pan = { x: number; y: number };

// Convert the last pointer-click (viewport coords) to plan coords for paste.
export const computeGetPastePoint = (deps: {
  lastPointerClickRef: { current: { x: number; y: number } | null };
  mapRef: { current: HTMLElement | null };
  zoomRef: { current: number };
  panRef: { current: Pan };
}): Pan | null => {
  const { lastPointerClickRef, mapRef, zoomRef, panRef } = deps;
  const last = lastPointerClickRef.current;
  const el = mapRef.current;
  if (!last || !el) return null;
  const rect = el.getBoundingClientRect();
  const localX = last.x - rect.left;
  const localY = last.y - rect.top;
  const z = zoomRef.current || 1;
  const p = panRef.current || { x: 0, y: 0 };
  return { x: (localX - p.x) / z, y: (localY - p.y) / z };
};

export type ViewportInitDeps = {
  renderPlan: FloorPlan | undefined;
  planId: string;
  selectedRevisionId: string | null | undefined;
  location: { key?: string };
  viewportInitRef: MutableRefObject<string | null>;
  forceDefaultView: boolean;
  selectedViewId: string | null | undefined;
  setAutoFitEnabled: (v: boolean) => void;
  setZoom: (v: number) => void;
  setPan: (v: Pan) => void;
  saveViewport: (planId: string, zoom: number, pan: Pan) => void;
  setSelectedViewId: (v: string) => void;
  loadViewport: (planId: string) => { zoom: number; pan: Pan } | null | undefined;
};

export const runViewportInitEffect = (deps: ViewportInitDeps): void => {
  const {
    renderPlan,
    planId,
    selectedRevisionId,
    location,
    viewportInitRef,
    forceDefaultView,
    selectedViewId,
    setAutoFitEnabled,
    setZoom,
    setPan,
    saveViewport,
    setSelectedViewId,
    loadViewport
  } = deps;
    if (!renderPlan) return;
    const viewportKey = `${planId}:${selectedRevisionId || 'present'}:${location.key || ''}`;
    const def = renderPlan?.views?.find((v) => v.isDefault);
    if (def && viewportInitRef.current !== viewportKey && (forceDefaultView || selectedViewId === '__last__')) {
      viewportInitRef.current = viewportKey;
      setAutoFitEnabled(false);
      setZoom(def.zoom);
      setPan(def.pan);
      saveViewport(planId, def.zoom, def.pan);
      setSelectedViewId(def.id);
      return;
    }
    if (forceDefaultView) {
      // Explicit request from Settings → Workspace: fall back to auto-fit only if no default exists.
      setAutoFitEnabled(true);
      setSelectedViewId('__last__');
      return;
    }
    if (!def && (!renderPlan.views || !renderPlan.views.length)) {
      // Views not ready yet; wait so default can be applied when available.
      return;
    }
    if (viewportInitRef.current === viewportKey) return;
    viewportInitRef.current = viewportKey;
    const saved = loadViewport(planId);
    if (saved) {
      setAutoFitEnabled(false);
      setZoom(saved.zoom);
      setPan(saved.pan);
      setSelectedViewId('__last__');
      return;
    }
    setAutoFitEnabled(true);
};

export type ViewportAutoCenterDeps = {
  renderPlan: FloorPlan | undefined;
  planId: string;
  selectedRevisionId: string | null | undefined;
  autoCenterRef: MutableRefObject<string | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  canvasStageRef: MutableRefObject<CanvasStageHandle | null>;
  zoom: number;
  pan: Pan;
};

export const runViewportAutoCenterEffect = (deps: ViewportAutoCenterDeps): void | (() => void) => {
  const {
    renderPlan,
    planId,
    selectedRevisionId,
    autoCenterRef,
    mapRef,
    canvasStageRef,
    zoom,
    pan
  } = deps;
    if (!renderPlan) return;
    const key = `${planId}:${selectedRevisionId || 'present'}`;
    if (autoCenterRef.current === key) return;
    const timer = window.setTimeout(() => {
      const el = mapRef.current;
      const stage = canvasStageRef.current;
      if (!el || !stage?.fitView) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const width = Number(renderPlan.width || 0);
      const height = Number(renderPlan.height || 0);
      const z = Number(zoom);
      const px = Number(pan?.x);
      const py = Number(pan?.y);
      let shouldFit = false;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        shouldFit = true;
      } else if (!Number.isFinite(z) || z <= 0 || !Number.isFinite(px) || !Number.isFinite(py) || cw <= 0 || ch <= 0) {
        shouldFit = true;
      } else {
        const viewMinX = (-px) / z;
        const viewMinY = (-py) / z;
        const viewMaxX = (cw - px) / z;
        const viewMaxY = (ch - py) / z;
        const interW = Math.max(0, Math.min(width, viewMaxX) - Math.max(0, viewMinX));
        const interH = Math.max(0, Math.min(height, viewMaxY) - Math.max(0, viewMinY));
        const visibleRatio = (interW * interH) / (width * height);
        shouldFit = !Number.isFinite(visibleRatio) || visibleRatio < 0.2;
      }
      if (shouldFit) {
        stage.fitView();
      }
      autoCenterRef.current = key;
    }, 80);
    return () => window.clearTimeout(timer);
};

export type ViewportPresentationDeps = {
  canvasStageRef: MutableRefObject<CanvasStageHandle | null>;
  presentationMode: boolean;
  presentationViewportRef: MutableRefObject<{ zoom: number; pan: Pan; autoFitEnabled: boolean } | null>;
  zoom: number;
  pan: Pan;
  autoFitEnabled: boolean;
  setAutoFitEnabled: (v: boolean) => void;
  setZoom: (v: number) => void;
  setPan: (v: Pan) => void;
  saveViewport: (planId: string, zoom: number, pan: Pan) => void;
  planId: string;
};

export const runViewportPresentationEffect = (deps: ViewportPresentationDeps): void | (() => void) => {
  const {
    canvasStageRef,
    presentationMode,
    presentationViewportRef,
    zoom,
    pan,
    autoFitEnabled,
    setAutoFitEnabled,
    setZoom,
    setPan,
    saveViewport,
    planId
  } = deps;
    const stage = canvasStageRef.current;
    if (!stage?.fitView) return;

    if (presentationMode) {
      // Entering fullscreen changes the map container size. Explicitly re-fit to use all available space.
      if (!presentationViewportRef.current) {
        presentationViewportRef.current = { zoom, pan, autoFitEnabled };
      }

      const t1 = window.setTimeout(() => stage.fitView?.(), 200);
      const t2 = window.setTimeout(() => stage.fitView?.(), 700);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    const prev = presentationViewportRef.current;
    if (!prev) return;
    presentationViewportRef.current = null;

    // Restore the previous viewport when leaving presentation.
    setAutoFitEnabled(prev.autoFitEnabled);
    setZoom(prev.zoom);
    setPan(prev.pan);
    saveViewport(planId, prev.zoom, prev.pan);
};
