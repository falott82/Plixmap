/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../../../utils/geometry';
import { perfMetrics } from '../../../utils/perfMetrics';
import { clampPanToBounds } from '../CanvasStage.helpers';

// Viewport/pan/zoom/fit/focus cluster extracted from CanvasStage. Owns viewportRef + pan/focus
// state/refs and the focus/fit/autofit effects; the host destructures viewportRef back so existing
// viewportRef.current usages keep working. All bodies moved verbatim.
export const useCanvasViewport = (deps: any) => {
  const {
    zoom, pan, stageRef, dimensions, baseWidth, baseHeight, onZoomChange, onPanChange, containerRef,
    presentationMode, plan, autoFit, bgImage, focusTarget, panToolActive, pendingType, roomDrawMode,
    readOnly, corridorDrawMode, printAreaMode, toolMode, perfEnabled
  } = deps;
  const viewportRef = useRef({ zoom, pan });
  const fitViewRef = useRef<() => void>(() => undefined);
  const wheelCommitTimer = useRef<number | null>(null);
  const pendingFocusRef = useRef<{ x: number; y: number; zoom?: number; nonce: number } | null>(null);
  const appliedFocusNonceRef = useRef<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef<{ x: number; y: number } | null>(null);
  const fitApplied = useRef<string | null>(null);
  const panRaf = useRef<number | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);

  const applyStageTransform = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const stage = stageRef.current;
    if (!stage) return;
    const z = Number(nextZoom);
    const x = Number(nextPan?.x);
    const y = Number(nextPan?.y);
    if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      return;
    }
    stage.scale({ x: z, y: z });
    stage.position({ x, y });
    stage.batchDraw();
  }, [stageRef]);

  const commitViewport = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      if (perfEnabled) perfMetrics.viewportCommits += 1;
      onZoomChange(nextZoom);
      onPanChange(nextPan);
    },
    [onPanChange, onZoomChange, perfEnabled]
  );

  const scheduleWheelCommit = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      if (wheelCommitTimer.current) window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = window.setTimeout(() => commitViewport(nextZoom, nextPan), 140);
    },
    [commitViewport]
  );

  const clampPan = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => clampPanToBounds(nextZoom, nextPan, baseWidth, baseHeight, dimensions),
    [baseHeight, baseWidth, dimensions]
  );

  const fitView = useCallback(() => {
    if (!containerRef.current || !baseWidth || !baseHeight) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = baseWidth;
    const ih = baseHeight;
    // Default: do not upscale small images (keeps markers proportional and avoids giant UI).
    // Presentation mode: allow upscaling to make the map fill the screen.
    const fitScale = presentationMode ? Math.min(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih, 1);
    const scale = clamp(fitScale, 0.2, 3);
    const panX = (cw - iw * scale) / 2;
    const panY = (ch - ih * scale) / 2;
    const clampedPan = clampPan(scale, { x: panX, y: panY });
    viewportRef.current = { zoom: scale, pan: clampedPan };
    applyStageTransform(scale, clampedPan);
    commitViewport(scale, clampedPan);
    fitApplied.current = plan.id;
  }, [applyStageTransform, baseHeight, baseWidth, clampPan, commitViewport, containerRef, plan.id, presentationMode]);

  useEffect(() => {
    fitViewRef.current = fitView;
  }, [fitView]);

  useEffect(() => {
    if (!autoFit) return;
    if (fitApplied.current === plan.id) return;
    fitView();
  }, [autoFit, bgImage, fitView, plan.id]);

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    const evt = event.evt as WheelEvent;
    const wantsZoom = !!evt.ctrlKey || !!evt.metaKey || evt.deltaMode !== 0;
    if (!wantsZoom) {
      const nextPan = clampPan(viewportRef.current.zoom, {
        x: viewportRef.current.pan.x - evt.deltaX,
        y: viewportRef.current.pan.y - evt.deltaY
      });
      viewportRef.current = { zoom: viewportRef.current.zoom, pan: nextPan };
      applyStageTransform(viewportRef.current.zoom, nextPan);
      scheduleWheelCommit(viewportRef.current.zoom, nextPan);
      return;
    }
    // Smooth, multiplicative zoom (pinch/ctrl+wheel)
    const scaleBy = Math.exp(-evt.deltaY * 0.001);
    const newZoom = clamp(viewportRef.current.zoom * scaleBy, 0.2, 3);
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer || !containerRef.current) {
      viewportRef.current = { zoom: newZoom, pan: viewportRef.current.pan };
      applyStageTransform(newZoom, viewportRef.current.pan);
      scheduleWheelCommit(newZoom, viewportRef.current.pan);
      return;
    }
    const mousePointTo = {
      x: (pointer.x - viewportRef.current.pan.x) / viewportRef.current.zoom,
      y: (pointer.y - viewportRef.current.pan.y) / viewportRef.current.zoom
    };
    const newPos = {
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom
    };
    const clampedPan = clampPan(newZoom, newPos);
    viewportRef.current = { zoom: newZoom, pan: clampedPan };
    applyStageTransform(newZoom, clampedPan);
    scheduleWheelCommit(newZoom, clampedPan);
  };

  const startPan = (event: any) => {
    if (pendingType) return;
    const stage = event.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    setIsPanning(true);
    panOrigin.current = { x: pos.x - viewportRef.current.pan.x, y: pos.y - viewportRef.current.pan.y };
  };

  const movePan = (event: any) => {
    if (!isPanning) return;
    const stage = event.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos || !panOrigin.current) return;
    const rawPan = { x: pos.x - panOrigin.current.x, y: pos.y - panOrigin.current.y };
    const nextPan = clampPan(viewportRef.current.zoom, rawPan);
    pendingPanRef.current = nextPan;
    if (panRaf.current) return;
    panRaf.current = requestAnimationFrame(() => {
      panRaf.current = null;
      const p = pendingPanRef.current;
      pendingPanRef.current = null;
      if (!p) return;
      viewportRef.current = { zoom: viewportRef.current.zoom, pan: p };
      applyStageTransform(viewportRef.current.zoom, p);
    });
  };

  const endPan = () => {
    setIsPanning(false);
    panOrigin.current = null;
    if (panRaf.current) cancelAnimationFrame(panRaf.current);
    panRaf.current = null;
    if (pendingPanRef.current) {
      const p = pendingPanRef.current;
      pendingPanRef.current = null;
      viewportRef.current = { zoom: viewportRef.current.zoom, pan: p };
      applyStageTransform(viewportRef.current.zoom, p);
    }
    commitViewport(viewportRef.current.zoom, viewportRef.current.pan);
  };

  // Pan: middle mouse OR Cmd+right (macOS) / Alt+right (Windows/Linux).
  const isPanGesture = (evt: any) =>
    evt?.button === 1 ||
    (evt?.button === 2 && (!!evt?.metaKey || !!evt?.altKey)) ||
    (panToolActive &&
      evt?.button === 0 &&
      !pendingType &&
      (!roomDrawMode || readOnly) &&
      (!corridorDrawMode || readOnly) &&
      (!printAreaMode || readOnly) &&
      !toolMode);
  // Box select: left-drag on empty area (desktop-like).
  const isBoxSelectGesture = (evt: any) => evt?.button === 0;

  const applyFocus = (target: { x: number; y: number; zoom?: number; nonce: number }) => {
    if (dimensions.width <= 0 || dimensions.height <= 0) return false;
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
    if (wheelCommitTimer.current) {
      window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = null;
    }
    const baseZoom = target.zoom ?? viewportRef.current.zoom;
    const nextZoom = clamp(Math.max(baseZoom, 1.0), 0.2, 3);
    const unclampedPan = {
      x: dimensions.width / 2 - target.x * nextZoom,
      y: dimensions.height / 2 - target.y * nextZoom
    };
    const nextPan = clampPan(nextZoom, unclampedPan);
    setIsPanning(false);
    panOrigin.current = null;
    viewportRef.current = { zoom: nextZoom, pan: nextPan };
    applyStageTransform(nextZoom, nextPan);
    commitViewport(nextZoom, nextPan);
    appliedFocusNonceRef.current = target.nonce;
    pendingFocusRef.current = null;
    return true;
  };

  useEffect(() => {
    if (!focusTarget) return;
    if (appliedFocusNonceRef.current === focusTarget.nonce) return;
    pendingFocusRef.current = focusTarget;
    applyFocus(focusTarget);
  }, [focusTarget?.nonce]);

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    applyFocus(pendingFocusRef.current);
  }, [dimensions.width, dimensions.height]);

  return { viewportRef, isPanning, applyStageTransform, commitViewport, scheduleWheelCommit, clampPan, fitView, fitViewRef, wheelCommitTimer, panRaf, fitApplied, handleWheel, startPan, movePan, endPan, isPanGesture, isBoxSelectGesture };
};
