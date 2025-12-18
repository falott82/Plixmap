import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { renderToStaticMarkup } from 'react-dom/server';
import useImage from 'use-image';
import { FloorPlan, IconName, MapObjectType } from '../../store/types';
import { clamp } from '../../utils/geometry';
import Icon from '../ui/Icon';

interface Props {
  plan: FloorPlan;
  selectedId?: string;
  selectedIds?: string[];
  selectedRoomId?: string;
  highlightId?: string;
  highlightUntil?: number;
  highlightRoomId?: string;
  highlightRoomUntil?: number;
  focusTarget?: { x: number; y: number; zoom?: number; nonce: number };
  pendingType?: MapObjectType | null;
  readOnly?: boolean;
  roomDrawMode?: 'rect' | 'poly' | null;
  objectTypeIcons: Record<string, IconName | undefined>;
  zoom: number;
  pan: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement>;
  autoFit?: boolean;
  onGoDefaultView?: () => void;
  onZoomChange: (zoom: number) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onSelect: (id?: string, options?: { keepContext?: boolean; multi?: boolean }) => void;
  onSelectMany?: (ids: string[]) => void;
  onMove: (id: string, x: number, y: number) => void;
  onPlaceNew: (type: MapObjectType, x: number, y: number) => void;
  onEdit: (id: string) => void;
  onContextMenu: (payload: { id: string; clientX: number; clientY: number }) => void;
  onMapContextMenu: (payload: { clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onSelectRoom?: (roomId?: string) => void;
  onCreateRoom?: (
    shape:
      | { kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
      | { kind: 'poly'; points: { x: number; y: number }[] }
  ) => void;
  onUpdateRoom?: (
    roomId: string,
    payload: {
      kind?: 'rect' | 'poly';
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      points?: { x: number; y: number }[];
    }
  ) => void;
}

const CanvasStage = ({
  plan,
  selectedId,
  selectedIds,
  selectedRoomId,
  highlightId,
  highlightUntil,
  highlightRoomId,
  highlightRoomUntil,
  focusTarget,
  pendingType,
  readOnly = false,
  roomDrawMode = null,
  objectTypeIcons,
  zoom,
  pan,
  containerRef,
  autoFit = true,
  onGoDefaultView,
  onZoomChange,
  onPanChange,
  onSelect,
  onSelectMany,
  onMove,
  onPlaceNew,
  onEdit,
  onContextMenu,
  onMapContextMenu,
  onSelectRoom,
  onCreateRoom,
  onUpdateRoom
}: Props) => {
  const stageRef = useRef<any>(null);
  const [highlightNow, setHighlightNow] = useState(Date.now());
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [bgImage] = useImage(plan.imageUrl, plan.imageUrl.startsWith('http') ? 'anonymous' : undefined);
  const baseWidth = plan.width || bgImage?.width || dimensions.width;
  const baseHeight = plan.height || bgImage?.height || dimensions.height;
  const viewportRef = useRef({ zoom, pan });
  const wheelCommitTimer = useRef<number | null>(null);
  const pendingFocusRef = useRef<{ x: number; y: number; zoom?: number; nonce: number } | null>(null);
  const appliedFocusNonceRef = useRef<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef<{ x: number; y: number } | null>(null);
  const fitApplied = useRef<string | null>(null);
  const lastContextMenuAtRef = useRef(0);
  const [roomHighlightNow, setRoomHighlightNow] = useState(Date.now());
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const draftOrigin = useRef<{ x: number; y: number } | null>(null);
  const [draftPolyPoints, setDraftPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [draftPolyPointer, setDraftPolyPointer] = useState<{ x: number; y: number } | null>(null);
  const draftPolyRaf = useRef<number | null>(null);
  const transformerRef = useRef<any>(null);
  const selectedRoomNodeRef = useRef<any>(null);
  const polyLineRefs = useRef<Record<string, any>>({});
  const polyVertexRefs = useRef<Record<string, Record<number, any>>>({});
  const objectsLayerRef = useRef<any>(null);
  const objectNodeRefs = useRef<Record<string, any>>({});
  const [iconImages, setIconImages] = useState<Record<string, HTMLImageElement | null>>({});
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  const selectionOrigin = useRef<{ x: number; y: number } | null>(null);
  const selectionDragRef = useRef<{
    startX: number;
    startY: number;
    startById: Record<string, { x: number; y: number }>;
  } | null>(null);
  const stagePixelRatio = useMemo(() => {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(1.5, Math.max(1, dpr));
  }, []);

  const applyStageTransform = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: nextZoom, y: nextZoom });
    stage.position(nextPan);
    stage.batchDraw();
  }, []);

  useEffect(() => {
    const last = { width: -1, height: -1 };
    let raf = 0;
    const commit = (width: number, height: number) => {
      setDimensions((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    const handleResize = () => {
      const el = containerRef.current;
      if (!el) return;
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === last.width && height === last.height) return;
      last.width = width;
      last.height = height;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => commit(width, height));
    };
    handleResize();
    const obs = new ResizeObserver(handleResize);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef]);

  useEffect(() => {
    fitApplied.current = null;
  }, [plan.id, plan.imageUrl]);

  useEffect(() => {
    viewportRef.current = { zoom, pan };
    applyStageTransform(zoom, pan);
    if (wheelCommitTimer.current) {
      window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = null;
    }
  }, [applyStageTransform, zoom, pan]);

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

  useEffect(() => {
    if (!highlightId || !highlightUntil) return;
    if (highlightUntil <= Date.now()) return;
    const interval = window.setInterval(() => setHighlightNow(Date.now()), 120);
    const timeout = window.setTimeout(() => window.clearInterval(interval), highlightUntil - Date.now() + 80);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [highlightId, highlightUntil]);

  useEffect(() => {
    if (!highlightRoomId || !highlightRoomUntil) return;
    if (highlightRoomUntil <= Date.now()) return;
    const interval = window.setInterval(() => setRoomHighlightNow(Date.now()), 120);
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      highlightRoomUntil - Date.now() + 80
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [highlightRoomId, highlightRoomUntil]);

  useEffect(() => {
    if (roomDrawMode) return;
    draftOrigin.current = null;
    setDraftRect(null);
    setDraftPolyPoints([]);
    setDraftPolyPointer(null);
    if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
    draftPolyRaf.current = null;
  }, [roomDrawMode]);

  useEffect(() => {
    if (!transformerRef.current) return;
    const selectedRoom = (plan.rooms || []).find((r) => r.id === selectedRoomId);
    const selectedKind = (selectedRoom?.kind || (selectedRoom?.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
    if (!selectedRoomId || !selectedRoomNodeRef.current || selectedKind !== 'rect') {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw?.();
      return;
    }
    transformerRef.current.nodes([selectedRoomNodeRef.current]);
    transformerRef.current.getLayer()?.batchDraw?.();
  }, [selectedRoomId, plan.rooms]);

  useEffect(() => {
    return () => {
      if (wheelCommitTimer.current) window.clearTimeout(wheelCommitTimer.current);
    };
  }, []);

  useEffect(() => {
    // build icon images from SVGs so markers match palette (and update if icon mapping changes)
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    setIconImages({});

    Object.entries(objectTypeIcons || {}).forEach(([typeId, iconName]) => {
      if (!iconName) return;
      const svg = renderToStaticMarkup(<Icon name={iconName} size={18} color="#2563eb" strokeWidth={1.8} />);
      const img = new window.Image();
      imgs.push(img);
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      img.onload = () => {
        if (cancelled) return;
        setIconImages((prev) => ({
          ...prev,
          [typeId]: img
        }));
      };
    });

    return () => {
      cancelled = true;
      for (const img of imgs) img.onload = null;
    };
  }, [objectTypeIcons]);

  const commitViewport = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      onZoomChange(nextZoom);
      onPanChange(nextPan);
    },
    [onPanChange, onZoomChange]
  );

  const scheduleWheelCommit = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      if (wheelCommitTimer.current) window.clearTimeout(wheelCommitTimer.current);
      wheelCommitTimer.current = window.setTimeout(() => commitViewport(nextZoom, nextPan), 140);
    },
    [commitViewport]
  );

  const clampPan = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      const margin = 220;
      if (!Number.isFinite(nextZoom) || !Number.isFinite(nextPan.x) || !Number.isFinite(nextPan.y)) return { x: 0, y: 0 };
      if (!Number.isFinite(baseWidth) || !Number.isFinite(baseHeight) || baseWidth <= 0 || baseHeight <= 0) return nextPan;
      const contentW = baseWidth * nextZoom;
      const contentH = baseHeight * nextZoom;

      // If content is smaller than viewport, allow free movement inside viewport (+ margin),
      // otherwise clamp so it can't drift into infinity (still elastic with margin).
      const minX = contentW < dimensions.width ? -margin : dimensions.width - contentW - margin;
      const maxX = contentW < dimensions.width ? dimensions.width - contentW + margin : margin;
      const minY = contentH < dimensions.height ? -margin : dimensions.height - contentH - margin;
      const maxY = contentH < dimensions.height ? dimensions.height - contentH + margin : margin;

      return {
        x: clamp(nextPan.x, Math.min(minX, maxX), Math.max(minX, maxX)),
        y: clamp(nextPan.y, Math.min(minY, maxY), Math.max(minY, maxY))
      };
    },
    [baseHeight, baseWidth, dimensions.height, dimensions.width]
  );

  const fitView = useCallback(() => {
    if (!containerRef.current || !baseWidth || !baseHeight) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = baseWidth;
    const ih = baseHeight;
    // Don't upscale small images by default (keeps markers proportional and avoids giant UI).
    const scale = clamp(Math.min(cw / iw, ch / ih, 1), 0.2, 3);
    const panX = (cw - iw * scale) / 2;
    const panY = (ch - ih * scale) / 2;
    const clampedPan = clampPan(scale, { x: panX, y: panY });
    viewportRef.current = { zoom: scale, pan: clampedPan };
    applyStageTransform(scale, clampedPan);
    commitViewport(scale, clampedPan);
    fitApplied.current = plan.id;
  }, [applyStageTransform, baseHeight, baseWidth, clampPan, commitViewport, containerRef, plan.id]);

  useEffect(() => {
    if (!autoFit) return;
    if (fitApplied.current === plan.id) return;
    fitView();
  }, [autoFit, bgImage, fitView, plan.id]);

  const toStageCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const x = (localX - viewportRef.current.pan.x) / viewportRef.current.zoom;
    const y = (localY - viewportRef.current.pan.y) / viewportRef.current.zoom;
    return { x, y };
  };

  const pointerToWorld = (localX: number, localY: number) => ({
    x: (localX - viewportRef.current.pan.x) / viewportRef.current.zoom,
    y: (localY - viewportRef.current.pan.y) / viewportRef.current.zoom
  });

  const isBoxSelecting = () => !!selectionOrigin.current;

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    // Smooth, multiplicative zoom
    const scaleBy = Math.exp(-event.evt.deltaY * 0.001);
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
    viewportRef.current = { zoom: viewportRef.current.zoom, pan: nextPan };
    applyStageTransform(viewportRef.current.zoom, nextPan);
  };

  const endPan = () => {
    setIsPanning(false);
    panOrigin.current = null;
    commitViewport(viewportRef.current.zoom, viewportRef.current.pan);
  };

  const isContextClick = (evt: any) => evt?.button === 2 || (evt?.button === 0 && !!evt?.ctrlKey);
  const isBoxSelectGesture = (evt: any) => evt?.button === 2 && !!evt?.shiftKey;

  const updateSelectionBox = (event: any) => {
    if (!selectionOrigin.current) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const x1 = selectionOrigin.current.x;
    const y1 = selectionOrigin.current.y;
    const x2 = world.x;
    const y2 = world.y;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    setSelectionBox({ x, y, width, height });
    return true;
  };

  const finalizeSelectionBox = () => {
    if (!selectionOrigin.current) return false;
    const rect = selectionBox;
    selectionOrigin.current = null;
    setSelectionBox(null);
    if (!rect || rect.width < 5 || rect.height < 5) return true;
    const minX = rect.x;
    const maxX = rect.x + rect.width;
    const minY = rect.y;
    const maxY = rect.y + rect.height;
    const ids = (plan.objects || [])
      .filter((o) => o.x >= minX && o.x <= maxX && o.y >= minY && o.y <= maxY)
      .map((o) => o.id);
    if (onSelectMany) onSelectMany(ids);
    else {
      onSelect(undefined);
      for (const id of ids) onSelect(id, { multi: true });
    }
    return true;
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (readOnly) return;
    const type = event.dataTransfer.getData('application/deskly-type') as MapObjectType;
    if (!type) return;
    const { x, y } = toStageCoords(event.clientX, event.clientY);
    onPlaceNew(type, x, y);
  };

  const handleClickToAdd = (event: any) => {
    if (isContextClick(event?.evt)) return;
    if (Date.now() - lastContextMenuAtRef.current < 420) return;
    if (readOnly) {
      onSelect(undefined);
      return;
    }
    if (!pendingType) {
      onSelect(undefined);
      return;
    }
    const pos = event.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const { x, y } = pointerToWorld(pos.x, pos.y);
    onPlaceNew(pendingType, x, y);
  };

  const updateDraftRect = (event: any) => {
    if (roomDrawMode !== 'rect' || readOnly) return false;
    const origin = draftOrigin.current;
    if (!origin) return false;
    const stage = event.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return true;
    const world = pointerToWorld(pos.x, pos.y);
    const x1 = origin.x;
    const y1 = origin.y;
    const x2 = world.x;
    const y2 = world.y;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    setDraftRect({ x, y, width, height });
    return true;
  };

  const finalizeDraftRect = () => {
    if (roomDrawMode !== 'rect' || readOnly) return false;
    if (!draftOrigin.current || !draftRect) return false;
    const rect = {
      x: draftRect.x,
      y: draftRect.y,
      width: Math.max(0, draftRect.width),
      height: Math.max(0, draftRect.height)
    };
    draftOrigin.current = null;
    setDraftRect(null);
    if (rect.width < 20 || rect.height < 20) return true;
    onCreateRoom?.({ kind: 'rect', rect });
    return true;
  };

  const backPlate = useMemo(
    () => (
      <Group>
        <Rect name="bg-rect" x={0} y={0} width={baseWidth} height={baseHeight} fill="#f8fafc" />
        {bgImage ? (
          <KonvaImage image={bgImage} width={baseWidth} height={baseHeight} opacity={0.96} listening={false} />
        ) : null}
      </Group>
    ),
    [bgImage, baseWidth, baseHeight]
  );

  const previewDraftPolyLine = useMemo(() => {
    if (roomDrawMode !== 'poly') return null;
    if (!draftPolyPoints.length) return null;
    const pts = [...draftPolyPoints];
    if (draftPolyPointer) pts.push(draftPolyPointer);
    return pts.flatMap((p) => [p.x, p.y]);
  }, [draftPolyPointer, draftPolyPoints, roomDrawMode]);

  const finalizeDraftPoly = useCallback(() => {
    if (roomDrawMode !== 'poly' || readOnly) return false;
    if (draftPolyPoints.length < 3) return true;
    const points = draftPolyPoints.slice();
    setDraftPolyPoints([]);
    setDraftPolyPointer(null);
    onCreateRoom?.({ kind: 'poly', points });
    return true;
  }, [draftPolyPoints, onCreateRoom, readOnly, roomDrawMode]);

  useEffect(() => {
    if (roomDrawMode !== 'poly') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finalizeDraftPoly();
      }
      if (e.key === 'Backspace') {
        if (!draftPolyPoints.length) return;
        e.preventDefault();
        setDraftPolyPoints((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [draftPolyPoints.length, finalizeDraftPoly, roomDrawMode]);

  const selectedBounds = useMemo(() => {
    const idsArr = selectedIds || (selectedId ? [selectedId] : []);
    if (!idsArr.length) return null;
    const ids = new Set(idsArr);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const obj of plan.objects) {
      if (!ids.has(obj.id)) continue;
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x);
      maxY = Math.max(maxY, obj.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY };
  }, [plan.objects, selectedId, selectedIds]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full rounded-2xl border border-slate-200 border-b-4 border-b-slate-200 bg-white shadow-card ${
        roomDrawMode && !readOnly ? 'cursor-crosshair' : ''
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        pixelRatio={stagePixelRatio}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          // Keep right-click free for context menu
          if (isBoxSelectGesture(e.evt)) {
            e.evt.preventDefault();
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            selectionOrigin.current = { x: world.x, y: world.y };
            setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
            return;
          }
          if (isContextClick(e.evt)) return;
          if (roomDrawMode === 'rect' && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            draftOrigin.current = { x: world.x, y: world.y };
            setDraftRect({ x: world.x, y: world.y, width: 0, height: 0 });
            return;
          }
          if (roomDrawMode === 'poly' && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            const closeThreshold = 12 / Math.max(0.2, viewportRef.current.zoom || 1);
            if (draftPolyPoints.length >= 3) {
              const first = draftPolyPoints[0];
              const dx = world.x - first.x;
              const dy = world.y - first.y;
              if (Math.hypot(dx, dy) <= closeThreshold) {
                finalizeDraftPoly();
                return;
              }
            }
            setDraftPolyPoints((prev) => [...prev, { x: world.x, y: world.y }]);
            return;
          }
          // Pan: middle click or drag empty stage
          if (e.evt.button === 1 || e.target === e.target.getStage()) {
            startPan(e);
            return;
          }
          // Clear selection on left-click empty area (no pending placement)
          if (!pendingType && e.target === e.target.getStage()) {
            onSelect(undefined);
          }
        }}
        onMouseMove={(e) => {
          if (updateSelectionBox(e)) return;
          if (updateDraftRect(e)) return;
          if (roomDrawMode === 'poly' && !readOnly) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (pos) {
              const world = pointerToWorld(pos.x, pos.y);
              if (draftPolyRaf.current) cancelAnimationFrame(draftPolyRaf.current);
              draftPolyRaf.current = requestAnimationFrame(() => {
                setDraftPolyPointer({ x: world.x, y: world.y });
              });
            }
            return;
          }
          movePan(e);
        }}
        onMouseUp={(e) => {
          if (finalizeSelectionBox()) return;
          if (isContextClick(e.evt)) return;
          if (finalizeDraftRect()) return;
          endPan();
        }}
        onMouseLeave={() => {
          if (finalizeSelectionBox()) return;
          if (finalizeDraftRect()) return;
          endPan();
        }}
      >
        {/* Background layer (kept separate so dragging objects doesn't re-draw the full image every frame) */}
        <Layer
          perfectDrawEnabled={false}
          onClick={handleClickToAdd}
          onContextMenu={(e) => {
            e.evt.preventDefault();
            e.cancelBubble = true;
            if (isBoxSelectGesture(e.evt) || isBoxSelecting()) return;
            lastContextMenuAtRef.current = Date.now();
            if (pendingType || readOnly) return;
            const stage = stageRef.current;
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            onMapContextMenu({ clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
          }}
          onMouseDown={(e) => {
            if (isContextClick(e.evt)) return;
            if (roomDrawMode && !readOnly) return;
            if (e.target?.attrs?.name === 'bg-rect' && !pendingType) {
              startPan(e);
              return;
            }
            if (!pendingType && e.target?.attrs?.name === 'bg-rect') {
              onSelect(undefined);
            }
          }}
        >
          {backPlate}
        </Layer>

        {/* Rooms layer */}
        <Layer perfectDrawEnabled={false}>
          {(plan.rooms || []).map((room) => {
            const isSelectedRoom = selectedRoomId === room.id;
            const kind = (room.kind || (room.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            const highlightActive = !!(
              highlightRoomId &&
              highlightRoomUntil &&
              highlightRoomId === room.id &&
              highlightRoomUntil > roomHighlightNow
            );
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(roomHighlightNow / 80) : 0;
            const stroke = highlightActive ? '#22d3ee' : isSelectedRoom ? '#2563eb' : '#94a3b8';
            const strokeWidth = highlightActive ? 2 + 1.2 * pulse : isSelectedRoom ? 2 : 1.4;
            if (kind === 'poly') {
              const pts = room.points || [];
              const flat = pts.flatMap((p) => [p.x, p.y]);
              return (
                <Group
                  key={room.id}
                  draggable={!readOnly}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectRoom?.(room.id);
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    e.cancelBubble = true;
                    if (isBoxSelectGesture(e.evt) || isBoxSelecting()) return;
                    onSelectRoom?.(room.id);
                  }}
                  onDragEnd={(e) => {
                    if (readOnly) return;
                    const node = e.target;
                    const dx = node.x();
                    const dy = node.y();
                    node.position({ x: 0, y: 0 });
                    if (!dx && !dy) return;
                    onUpdateRoom?.(room.id, { kind: 'poly', points: pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
                  }}
                >
                  <Line
                    ref={(node) => {
                      if (node) polyLineRefs.current[room.id] = node;
                      else delete polyLineRefs.current[room.id];
                    }}
                    points={flat}
                    closed
                    fill="rgba(37,99,235,0.05)"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    dash={[6, 5]}
                    lineJoin="round"
                  />
                  {isSelectedRoom && !readOnly
                    ? pts.map((p, idx) => (
                        <Circle
                          key={`${room.id}:${idx}`}
                          ref={(node) => {
                            if (!polyVertexRefs.current[room.id]) polyVertexRefs.current[room.id] = {};
                            if (node) polyVertexRefs.current[room.id][idx] = node;
                            else if (polyVertexRefs.current[room.id]) delete polyVertexRefs.current[room.id][idx];
                          }}
                          x={p.x}
                          y={p.y}
                          radius={5}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={1.5}
                          draggable
                          onDragMove={() => {
                            const line = polyLineRefs.current[room.id];
                            const verts = polyVertexRefs.current[room.id];
                            if (!line || !verts) return;
                            const next = Object.keys(verts)
                              .map((k) => Number(k))
                              .sort((a, b) => a - b)
                              .flatMap((i) => [verts[i].x(), verts[i].y()]);
                            line.points(next);
                            line.getLayer()?.batchDraw?.();
                          }}
                          onDragEnd={() => {
                            const verts = polyVertexRefs.current[room.id];
                            if (!verts) return;
                            const nextPoints = Object.keys(verts)
                              .map((k) => Number(k))
                              .sort((a, b) => a - b)
                              .map((i) => ({ x: verts[i].x(), y: verts[i].y() }));
                            onUpdateRoom?.(room.id, { kind: 'poly', points: nextPoints });
                          }}
                        />
                      ))
                    : null}
                </Group>
              );
            }
            return (
              <Rect
                key={room.id}
                ref={(node) => {
                  if (isSelectedRoom) selectedRoomNodeRef.current = node;
                }}
                x={room.x || 0}
                y={room.y || 0}
                width={room.width || 0}
                height={room.height || 0}
                fill="rgba(37,99,235,0.05)"
                stroke={stroke}
                strokeWidth={strokeWidth}
                dash={[6, 5]}
                cornerRadius={8}
                draggable={!readOnly}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelectRoom?.(room.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if (isBoxSelectGesture(e.evt) || isBoxSelecting()) return;
                  onSelectRoom?.(room.id);
                }}
                onDragEnd={(e) => {
                  if (readOnly) return;
                  const node = e.target;
                  onUpdateRoom?.(room.id, {
                    kind: 'rect',
                    x: node.x(),
                    y: node.y(),
                    width: room.width || 0,
                    height: room.height || 0
                  });
                }}
                onTransformEnd={(e) => {
                  if (readOnly) return;
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  onUpdateRoom?.(room.id, {
                    kind: 'rect',
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(10, node.width() * scaleX),
                    height: Math.max(10, node.height() * scaleY)
                  });
                }}
              />
            );
          })}

          {selectedRoomId &&
          !readOnly &&
          (() => {
            const r = (plan.rooms || []).find((x) => x.id === selectedRoomId);
            const k = (r?.kind || (r?.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            return k === 'rect';
          })() ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              keepRatio={false}
              boundBoxFunc={(_oldBox: any, newBox: any) => {
                if (newBox.width < 10 || newBox.height < 10) return _oldBox;
                return newBox;
              }}
            />
          ) : null}

          {/* Draft rect */}
          {draftRect ? (
            <Rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.width}
              height={draftRect.height}
              fill="rgba(37,99,235,0.08)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}

          {/* Draft poly */}
          {previewDraftPolyLine ? (
            <Line
              points={previewDraftPolyLine}
              closed={draftPolyPoints.length >= 3}
              fill="rgba(37,99,235,0.06)"
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 6]}
              lineJoin="round"
              listening={false}
            />
          ) : null}
          {roomDrawMode === 'poly' && draftPolyPoints.length ? (
            <Circle
              x={draftPolyPoints[0].x}
              y={draftPolyPoints[0].y}
              radius={6}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={1.5}
              listening={false}
            />
          ) : null}
        </Layer>

        {/* Objects layer */}
        <Layer perfectDrawEnabled={false} ref={objectsLayerRef}>
          {plan.objects.map((obj) => {
            const isSelected = selectedIds ? selectedIds.includes(obj.id) : selectedId === obj.id;
            const highlightActive = !!(highlightId && highlightUntil && highlightId === obj.id && highlightUntil > highlightNow);
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(highlightNow / 80) : 0;
            const scale = obj.scale ?? 1;
            const iconImg = iconImages[obj.type];
            return (
              <Group
                key={obj.id}
                ref={(node) => {
                  if (node) objectNodeRefs.current[obj.id] = node;
                  else delete objectNodeRefs.current[obj.id];
                }}
                x={obj.x}
                y={obj.y}
                draggable={!readOnly}
                onDragStart={(e) => {
                  onSelect(obj.id, { multi: !!(e?.evt?.ctrlKey || e?.evt?.metaKey) });
                }}
                onDragEnd={(e) => {
                  if (readOnly) return;
                  const stage = stageRef.current;
                  if (!stage) {
                    onMove(obj.id, e.target.x(), e.target.y());
                    return;
                  }
                  const transform = stage.getAbsoluteTransform().copy();
                  transform.invert();
                  const abs = e.target.getAbsolutePosition();
                  const world = transform.point(abs);
                  onMove(obj.id, world.x, world.y);
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  if (e.evt?.button !== 0) return;
                  if (readOnly) return;
                  onEdit(obj.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if (isBoxSelectGesture(e.evt) || isBoxSelecting()) return;
                  lastContextMenuAtRef.current = Date.now();
                  // If the object is already within a multi-selection, keep the selection as-is.
                  // Otherwise select it (single) before opening the context menu.
                  const multiSelected = (selectedIds || []).length > 1;
                  if (!isSelected || !multiSelected) {
                    onSelect(obj.id, { keepContext: true });
                  }
                  if (pendingType || readOnly) return;
                  onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                }}
              >
                <Text
                  text={obj.name}
                  x={-80}
                  y={-(18 * scale) - 12}
                  width={160}
                  align="center"
                  fontStyle="bold"
                  fill="#0f172a"
                  fontSize={10}
                  shadowBlur={0}
                  shadowColor="transparent"
                  listening={false}
                />
                <Rect
                  x={-(18 * scale)}
                  y={-(18 * scale)}
                  width={36 * scale}
                  height={36 * scale}
                  cornerRadius={12 * scale}
                  fill="#ffffff"
                  stroke={highlightActive ? '#22d3ee' : isSelected ? '#2563eb' : '#cbd5e1'}
                  strokeWidth={highlightActive ? 3 + 2 * pulse : isSelected ? 3 : 2}
                  shadowBlur={0}
                  shadowColor="transparent"
                />
                {iconImg ? (
                  <KonvaImage
                    image={iconImg}
                    x={-9 * scale}
                    y={-9 * scale}
                    width={18 * scale}
                    height={18 * scale}
                    listening={false}
                  />
                ) : (
                  <Text
                    text={'?'}
                    x={-(18 * scale)}
                    y={-(18 * scale) / 1.2}
                    width={36 * scale}
                    align="center"
                    fontSize={15 * scale}
                    fontStyle="bold"
                    fill={'#2563eb'}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Selection box + multi-drag overlay */}
        <Layer perfectDrawEnabled={false}>
          {selectionBox ? (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(37,99,235,0.08)"
              stroke="#2563eb"
              strokeWidth={2}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}

          {!readOnly && selectedBounds && (selectedIds || []).length > 1 ? (
            <Group
              x={selectedBounds.minX}
              y={selectedBounds.minY}
              draggable
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if (isBoxSelectGesture(e.evt) || isBoxSelecting()) return;
                const firstId = (selectedIds || [])[0];
                if (!firstId) return;
                lastContextMenuAtRef.current = Date.now();
                onContextMenu({ id: firstId, clientX: e.evt.clientX, clientY: e.evt.clientY });
              }}
              onDragStart={(e) => {
                const startById: Record<string, { x: number; y: number }> = {};
                const ids = selectedIds || [];
                for (const id of ids) {
                  const obj = plan.objects.find((o) => o.id === id);
                  if (!obj) continue;
                  startById[id] = { x: obj.x, y: obj.y };
                }
                selectionDragRef.current = { startX: e.target.x(), startY: e.target.y(), startById };
              }}
              onDragMove={(e) => {
                const ref = selectionDragRef.current;
                if (!ref) return;
                const dx = e.target.x() - ref.startX;
                const dy = e.target.y() - ref.startY;
                for (const [id, start] of Object.entries(ref.startById)) {
                  const node = objectNodeRefs.current[id];
                  if (!node) continue;
                  node.position({ x: start.x + dx, y: start.y + dy });
                }
                objectsLayerRef.current?.batchDraw?.();
              }}
              onDragEnd={(e) => {
                const ref = selectionDragRef.current;
                selectionDragRef.current = null;
                if (!ref) return;
                const dx = e.target.x() - ref.startX;
                const dy = e.target.y() - ref.startY;
                for (const [id, start] of Object.entries(ref.startById)) {
                  onMove(id, start.x + dx, start.y + dy);
                }
              }}
            >
              <Rect
                x={-12}
                y={-12}
                width={selectedBounds.maxX - selectedBounds.minX + 24}
                height={selectedBounds.maxY - selectedBounds.minY + 24}
                fill="rgba(0,0,0,0.001)"
                stroke="rgba(37,99,235,0.55)"
                strokeWidth={2}
                dash={[6, 6]}
                cornerRadius={12}
                listening={true}
              />
            </Group>
          ) : null}
        </Layer>
      </Stage>
      <div className="absolute right-4 top-4 flex flex-col gap-2 rounded-xl bg-white/90 p-2 shadow-card backdrop-blur">
	        <button
	          title="Zoom in"
	          onClick={() => {
	            const nextZoom = clamp(viewportRef.current.zoom * 1.1, 0.2, 3);
	            viewportRef.current = { zoom: nextZoom, pan: viewportRef.current.pan };
	            applyStageTransform(nextZoom, viewportRef.current.pan);
	            scheduleWheelCommit(nextZoom, viewportRef.current.pan);
	          }}
	          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-ink hover:bg-slate-50"
	        >
	          +
	        </button>
	        <button
	          title="Zoom out"
	          onClick={() => {
	            const nextZoom = clamp(viewportRef.current.zoom / 1.1, 0.2, 3);
	            viewportRef.current = { zoom: nextZoom, pan: viewportRef.current.pan };
	            applyStageTransform(nextZoom, viewportRef.current.pan);
	            scheduleWheelCommit(nextZoom, viewportRef.current.pan);
	          }}
	          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-ink hover:bg-slate-50"
	        >
	          -
	        </button>
        <button
          title="Vai a vista di default"
          onClick={() => onGoDefaultView?.()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-ink hover:bg-slate-50"
        >
          VD
        </button>
      </div>
    </div>
  );
};

export default memo(CanvasStage);
