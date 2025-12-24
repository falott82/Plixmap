import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { renderToStaticMarkup } from 'react-dom/server';
import useImage from 'use-image';
import { FloorPlan, IconName, MapObjectType } from '../../store/types';
import { clamp } from '../../utils/geometry';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';

interface Props {
  plan: FloorPlan;
  selectedId?: string;
  selectedIds?: string[];
  selectedRoomId?: string;
  selectedLinkId?: string | null;
  snapEnabled?: boolean;
  gridSize?: number;
  showGrid?: boolean;
  highlightId?: string;
  highlightUntil?: number;
  highlightRoomId?: string;
  highlightRoomUntil?: number;
  focusTarget?: { x: number; y: number; zoom?: number; nonce: number };
  pendingType?: MapObjectType | null;
  readOnly?: boolean;
  roomDrawMode?: 'rect' | 'poly' | null;
  printArea?: { x: number; y: number; width: number; height: number } | null;
  printAreaMode?: boolean;
  showPrintArea?: boolean;
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
  onLinkContextMenu?: (payload: { id: string; clientX: number; clientY: number }) => void;
  onLinkDblClick?: (id: string) => void;
  onMapContextMenu: (payload: { clientX: number; clientY: number; worldX: number; worldY: number }) => void;
  onSelectRoom?: (roomId?: string) => void;
  onSelectLink?: (id?: string) => void;
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
  onSetPrintArea?: (rect: { x: number; y: number; width: number; height: number }) => void;
}

export interface CanvasStageHandle {
  getSize: () => { width: number; height: number };
  exportDataUrl: (options?: { pixelRatio?: number; mimeType?: string; quality?: number }) => { dataUrl: string; width: number; height: number };
}

const hexToRgba = (hex: string, alpha: number) => {
  const h = String(hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(100,116,139,${alpha})`; // slate-500 fallback
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};

const CanvasStageImpl = (
  {
  plan,
  selectedId,
  selectedIds,
  selectedRoomId,
  selectedLinkId = null,
  snapEnabled = false,
  gridSize = 20,
  showGrid = false,
  highlightId,
  highlightUntil,
  highlightRoomId,
  highlightRoomUntil,
  focusTarget,
  pendingType,
  readOnly = false,
  roomDrawMode = null,
  printArea = null,
  printAreaMode = false,
  showPrintArea = false,
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
  onLinkContextMenu,
  onLinkDblClick,
  onMapContextMenu,
  onSelectRoom,
  onSelectLink,
  onCreateRoom,
  onUpdateRoom,
  onSetPrintArea
}: Props,
  ref: React.ForwardedRef<CanvasStageHandle>
) => {
  const t = useT();
  const stageRef = useRef<any>(null);
  const [hoverCard, setHoverCard] = useState<
    | null
    | {
        clientX: number;
        clientY: number;
        obj: any;
      }
  >(null);
  const hoverRaf = useRef<number | null>(null);
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
  const lastBoxSelectAtRef = useRef(0);
  const [roomHighlightNow, setRoomHighlightNow] = useState(Date.now());
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const draftOrigin = useRef<{ x: number; y: number } | null>(null);
  const [draftPrintRect, setDraftPrintRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const printOrigin = useRef<{ x: number; y: number } | null>(null);
  const [draftPolyPoints, setDraftPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [draftPolyPointer, setDraftPolyPointer] = useState<{ x: number; y: number } | null>(null);
  const draftPolyRaf = useRef<number | null>(null);
  const panRaf = useRef<number | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoxRaf = useRef<number | null>(null);
  const pendingSelectionBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const lastSelectionBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const draftRectRaf = useRef<number | null>(null);
  const pendingDraftRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const draftPrintRectRaf = useRef<number | null>(null);
  const pendingDraftPrintRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      getSize: () => ({ width: dimensions.width, height: dimensions.height }),
      exportDataUrl: (options) => {
        const stage = stageRef.current;
        const pixelRatio = Math.max(1, Number(options?.pixelRatio || 1));
        const mimeType = options?.mimeType || 'image/jpeg';
        const quality = typeof options?.quality === 'number' ? options.quality : 0.82;
        const width = Math.round(dimensions.width * pixelRatio);
        const height = Math.round(dimensions.height * pixelRatio);
        if (!stage) return { dataUrl: '', width, height };
        try {
          // Konva JPEG export fills transparency with black. Render to canvas, then composite on white.
          const rawCanvas: HTMLCanvasElement | null = stage.toCanvas ? stage.toCanvas({ pixelRatio }) : null;
          if (!rawCanvas) {
            if (!stage.toDataURL) return { dataUrl: '', width, height };
            const dataUrl = stage.toDataURL({ pixelRatio, mimeType, quality });
            return { dataUrl, width, height };
          }
          const out = document.createElement('canvas');
          out.width = rawCanvas.width;
          out.height = rawCanvas.height;
          const ctx = out.getContext('2d');
          if (!ctx) return { dataUrl: '', width, height };
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, out.width, out.height);
          ctx.drawImage(rawCanvas, 0, 0);
          const dataUrl = out.toDataURL(mimeType, quality);
          return { dataUrl, width: out.width, height: out.height };
        } catch {
          return { dataUrl: '', width, height };
        }
      }
    }),
    [dimensions.height, dimensions.width]
  );
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
  const objectById = useMemo(() => new Map(plan.objects.map((o) => [o.id, o])), [plan.objects]);
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
  }, []);

  const snap = useCallback(
    (value: number) => {
      const step = Math.max(1, Number(gridSize) || 1);
      return Math.round(value / step) * step;
    },
    [gridSize]
  );

  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const step = Math.max(5, Number(gridSize) || 20);
    const maxV = Math.floor(baseWidth / step);
    const maxH = Math.floor(baseHeight / step);
    if (maxV + maxH > 400) return null;
    const stroke = 'rgba(15,23,42,0.07)';
    const lines: any[] = [];
    for (let i = 0; i <= maxV; i++) {
      const x = i * step;
      lines.push(<Line key={`gv-${i}`} points={[x, 0, x, baseHeight]} stroke={stroke} strokeWidth={1} listening={false} />);
    }
    for (let j = 0; j <= maxH; j++) {
      const y = j * step;
      lines.push(<Line key={`gh-${j}`} points={[0, y, baseWidth, y]} stroke={stroke} strokeWidth={1} listening={false} />);
    }
    return lines;
  }, [baseHeight, baseWidth, gridSize, showGrid]);

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
      // Avoid committing zero sizes during transient layout states (e.g. modal/panel animations),
      // which can cause the Stage to "disappear" and become unresponsive until the next resize.
      if (width <= 0 || height <= 0) return;
      if (width === last.width && height === last.height) return;
      last.width = width;
      last.height = height;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => commit(width, height));
    };
    handleResize();
    const obs = new ResizeObserver(handleResize);
    if (containerRef.current) obs.observe(containerRef.current);
    const onVis = () => {
      if (document.visibilityState === 'visible') handleResize();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
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
    if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
    draftRectRaf.current = null;
    pendingDraftRectRef.current = null;
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
      if (panRaf.current) cancelAnimationFrame(panRaf.current);
      if (selectionBoxRaf.current) cancelAnimationFrame(selectionBoxRaf.current);
      if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
      if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
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

  // Canvas watchdog: fixes rare cases where the Stage becomes 0-sized or the transform becomes invalid,
  // which can make the map "disappear" until a manual refresh.
  useEffect(() => {
    const tick = () => {
      const el = containerRef.current;
      const stage = stageRef.current;
      if (!el || !stage) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;

      // Recover from transient 0-sized stage.
      const sw = Number(stage.width?.() ?? 0);
      const sh = Number(stage.height?.() ?? 0);
      if (sw <= 0 || sh <= 0) {
        setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }

      // Recover from invalid transforms.
      const z = Number(viewportRef.current.zoom);
      const p = viewportRef.current.pan;
      const px = Number(p?.x);
      const py = Number(p?.y);
      if (!Number.isFinite(z) || !Number.isFinite(px) || !Number.isFinite(py) || z <= 0) {
        const nextZoom = clamp(1, 0.2, 3);
        const nextPan = clampPan(nextZoom, { x: 0, y: 0 });
        viewportRef.current = { zoom: nextZoom, pan: nextPan };
        applyStageTransform(nextZoom, nextPan);
        commitViewport(nextZoom, nextPan);
      }
    };
    const id = window.setInterval(tick, 1500);
    return () => window.clearInterval(id);
  }, [applyStageTransform, clampPan, commitViewport]);

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

  const isContextClick = (evt: any) => evt?.button === 2 || (evt?.button === 0 && !!evt?.ctrlKey);
  // Pan: middle mouse OR Cmd+right (macOS) / Alt+right (Windows/Linux).
  const isPanGesture = (evt: any) => evt?.button === 1 || (evt?.button === 2 && (!!evt?.metaKey || !!evt?.altKey));
  // Box select: left-drag on empty area (desktop-like).
  const isBoxSelectGesture = (evt: any) => evt?.button === 0;

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
    pendingSelectionBoxRef.current = { x, y, width, height };
    lastSelectionBoxRef.current = pendingSelectionBoxRef.current;
    if (selectionBoxRaf.current) return true;
    selectionBoxRaf.current = requestAnimationFrame(() => {
      selectionBoxRaf.current = null;
      const next = pendingSelectionBoxRef.current;
      pendingSelectionBoxRef.current = null;
      if (!next) return;
      setSelectionBox(next);
    });
    return true;
  };

  const finalizeSelectionBox = () => {
    if (!selectionOrigin.current) return false;
    const rect = lastSelectionBoxRef.current || pendingSelectionBoxRef.current || selectionBox;
    selectionOrigin.current = null;
    if (selectionBoxRaf.current) cancelAnimationFrame(selectionBoxRaf.current);
    selectionBoxRaf.current = null;
    pendingSelectionBoxRef.current = null;
    lastSelectionBoxRef.current = null;
    setSelectionBox(null);
    if (!rect) return true;
    const wPx = rect.width * Math.max(0.001, viewportRef.current.zoom || 1);
    const hPx = rect.height * Math.max(0.001, viewportRef.current.zoom || 1);
    if (wPx < 8 || hPx < 8) {
      // Desktop behavior: click on empty area clears selection.
      onSelect(undefined);
      return true;
    }
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
    lastBoxSelectAtRef.current = Date.now();
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
    if (Date.now() - lastBoxSelectAtRef.current < 420) return;
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
    pendingDraftRectRef.current = { x, y, width, height };
    if (draftRectRaf.current) return true;
    draftRectRaf.current = requestAnimationFrame(() => {
      draftRectRaf.current = null;
      const next = pendingDraftRectRef.current;
      pendingDraftRectRef.current = null;
      if (!next) return;
      setDraftRect(next);
    });
    return true;
  };

  const updateDraftPrintRect = (event: any) => {
    if (!printAreaMode || readOnly) return false;
    const origin = printOrigin.current;
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
    pendingDraftPrintRectRef.current = { x, y, width, height };
    if (draftPrintRectRaf.current) return true;
    draftPrintRectRaf.current = requestAnimationFrame(() => {
      draftPrintRectRaf.current = null;
      const next = pendingDraftPrintRectRef.current;
      pendingDraftPrintRectRef.current = null;
      if (!next) return;
      setDraftPrintRect(next);
    });
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
    if (draftRectRaf.current) cancelAnimationFrame(draftRectRaf.current);
    draftRectRaf.current = null;
    pendingDraftRectRef.current = null;
    setDraftRect(null);
    if (rect.width < 20 || rect.height < 20) return true;
    onCreateRoom?.({ kind: 'rect', rect });
    return true;
  };

  const finalizeDraftPrintRect = () => {
    if (!printAreaMode || readOnly) return false;
    if (!printOrigin.current || !draftPrintRect) return false;
    const rect = {
      x: draftPrintRect.x,
      y: draftPrintRect.y,
      width: Math.max(0, draftPrintRect.width),
      height: Math.max(0, draftPrintRect.height)
    };
    printOrigin.current = null;
    if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
    draftPrintRectRaf.current = null;
    pendingDraftPrintRectRef.current = null;
    setDraftPrintRect(null);
    if (rect.width < 20 || rect.height < 20) return true;
    onSetPrintArea?.(rect);
    return true;
  };

  const backPlate = useMemo(() => {
    return (
      <Group>
        <Rect name="bg-rect" x={0} y={0} width={baseWidth} height={baseHeight} fill="#f8fafc" />
        {bgImage ? <KonvaImage image={bgImage} width={baseWidth} height={baseHeight} opacity={0.96} listening={false} /> : null}
      </Group>
    );
  }, [bgImage, baseWidth, baseHeight]);

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

  useEffect(() => {
    if (printAreaMode) return;
    printOrigin.current = null;
    setDraftPrintRect(null);
    if (draftPrintRectRaf.current) cancelAnimationFrame(draftPrintRectRaf.current);
    draftPrintRectRaf.current = null;
    pendingDraftPrintRectRef.current = null;
  }, [printAreaMode]);

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
        (roomDrawMode || printAreaMode) && !readOnly ? 'cursor-crosshair' : ''
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        // If another Konva context menu was just opened (object/link/bg), don't open map menu too.
        if (Date.now() - lastContextMenuAtRef.current < 60) return;
        if (pendingType || readOnly) return;
        if ((e as any).metaKey || (e as any).altKey) return;
        if (isBoxSelecting()) return;
        const stage = stageRef.current;
        if (!stage) return;
        try {
          stage.setPointersPositions(e);
        } catch {
          // ignore
        }
        const pos = stage.getPointerPosition?.();
        if (!pos) return;
        const world = pointerToWorld(pos.x, pos.y);
        onMapContextMenu({ clientX: e.clientX, clientY: e.clientY, worldX: world.x, worldY: world.y });
      }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {hoverCard ? (
        <div
          className="pointer-events-none fixed z-50 w-[280px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-card backdrop-blur"
          style={{ left: hoverCard.clientX, top: hoverCard.clientY + 14 }}
        >
          <div className="text-sm font-semibold text-ink">
            {(hoverCard.obj.firstName || hoverCard.obj.name || '').toString()} {(hoverCard.obj.lastName || '').toString()}
          </div>
          <div className="mt-1 space-y-1">
            {hoverCard.obj.externalRole ? (
              <div>
                <span className="font-semibold text-slate-600">{t({ it: 'Ruolo', en: 'Role' })}:</span> {hoverCard.obj.externalRole}
              </div>
            ) : null}
            {[hoverCard.obj.externalDept1, hoverCard.obj.externalDept2, hoverCard.obj.externalDept3].filter(Boolean).length ? (
              <div>
                <span className="font-semibold text-slate-600">{t({ it: 'Reparto', en: 'Department' })}:</span>{' '}
                {[hoverCard.obj.externalDept1, hoverCard.obj.externalDept2, hoverCard.obj.externalDept3].filter(Boolean).join(' / ')}
              </div>
            ) : null}
            {hoverCard.obj.externalEmail ? (
              <div>
                <span className="font-semibold text-slate-600">{t({ it: 'Email', en: 'Email' })}:</span> {hoverCard.obj.externalEmail}
              </div>
            ) : null}
            {[hoverCard.obj.externalExt1, hoverCard.obj.externalExt2, hoverCard.obj.externalExt3].filter(Boolean).length ? (
              <div>
                <span className="font-semibold text-slate-600">{t({ it: 'Interni', en: 'Extensions' })}:</span>{' '}
                {[hoverCard.obj.externalExt1, hoverCard.obj.externalExt2, hoverCard.obj.externalExt3].filter(Boolean).join(', ')}
              </div>
            ) : null}
            {hoverCard.obj.externalUserId ? (
              <div className="text-[11px] text-slate-500">
                ID: <span className="font-mono">{hoverCard.obj.externalUserId}</span>
                {hoverCard.obj.externalIsExternal ? ` · ${t({ it: 'Esterno', en: 'External' })}` : ''}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        pixelRatio={stagePixelRatio}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          const isEmptyTarget = e.target === e.target.getStage() || e.target?.attrs?.name === 'bg-rect';
          if (isPanGesture(e.evt)) {
            e.evt.preventDefault();
            startPan(e);
            return;
          }
          if (isEmptyTarget && isBoxSelectGesture(e.evt) && !pendingType && (!roomDrawMode || readOnly) && (!printAreaMode || readOnly)) {
            e.evt.preventDefault();
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            selectionOrigin.current = { x: world.x, y: world.y };
            pendingSelectionBoxRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
            lastSelectionBoxRef.current = pendingSelectionBoxRef.current;
            setSelectionBox(pendingSelectionBoxRef.current);
            lastBoxSelectAtRef.current = Date.now();
            return;
          }
          if (isContextClick(e.evt)) return;
          if (printAreaMode && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            printOrigin.current = { x: world.x, y: world.y };
            pendingDraftPrintRectRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
            setDraftPrintRect(pendingDraftPrintRectRef.current);
            return;
          }
          if (roomDrawMode === 'rect' && !readOnly && e.evt.button === 0) {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            draftOrigin.current = { x: world.x, y: world.y };
            pendingDraftRectRef.current = { x: world.x, y: world.y, width: 0, height: 0 };
            setDraftRect(pendingDraftRectRef.current);
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
          // Clear selection on left-click empty area (no pending placement)
          if (!pendingType && isEmptyTarget && e.evt.button === 0) onSelect(undefined);
        }}
        onMouseMove={(e) => {
          if (updateSelectionBox(e)) return;
          if (updateDraftPrintRect(e)) return;
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
          if (finalizeDraftPrintRect()) return;
          if (finalizeDraftRect()) return;
          endPan();
        }}
        onMouseLeave={() => {
          if (finalizeSelectionBox()) return;
          if (finalizeDraftPrintRect()) return;
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
            if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
            if (isBoxSelecting()) return;
            lastContextMenuAtRef.current = Date.now();
            if (pendingType || readOnly) return;
            const stage = stageRef.current;
            const pos = stage?.getPointerPosition();
            if (!pos) return;
            const world = pointerToWorld(pos.x, pos.y);
            onMapContextMenu({ clientX: e.evt.clientX, clientY: e.evt.clientY, worldX: world.x, worldY: world.y });
          }}
          onMouseDown={(e) => {
            // Never pan / clear selection while box-selecting.
            if (isBoxSelecting()) return;
            if (isContextClick(e.evt)) return;
            if ((roomDrawMode || printAreaMode) && !readOnly) return;
            if (e.target?.attrs?.name === 'bg-rect' && !pendingType) {
              if (isPanGesture(e.evt)) startPan(e);
              return;
            }
            if (!pendingType && e.target?.attrs?.name === 'bg-rect') {
              onSelect(undefined);
            }
          }}
        >
          {backPlate}
          {gridLines}
        </Layer>

        {/* Rooms layer */}
        <Layer perfectDrawEnabled={false}>
          {(plan.rooms || []).map((room) => {
            const isSelectedRoom = selectedRoomId === room.id;
            const kind = (room.kind || (room.points?.length ? 'poly' : 'rect')) as 'rect' | 'poly';
            const baseColor = (room as any).color || '#64748b';
            const highlightActive = !!(
              highlightRoomId &&
              highlightRoomUntil &&
              highlightRoomId === room.id &&
              highlightRoomUntil > roomHighlightNow
            );
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(roomHighlightNow / 80) : 0;
            const stroke = highlightActive ? '#22d3ee' : isSelectedRoom ? '#2563eb' : baseColor;
            const strokeWidth = highlightActive ? 2 + 0.8 * pulse : isSelectedRoom ? 2 : 1.1;
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
                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                    if (isBoxSelecting()) return;
                    onSelectRoom?.(room.id);
                  }}
                  onDragEnd={(e) => {
                    if (readOnly) return;
                    const node = e.target;
                    const dx = node.x();
                    const dy = node.y();
                    node.position({ x: 0, y: 0 });
                    node.getLayer()?.batchDraw?.();
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
                    fill={hexToRgba(baseColor, 0.08)}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    dash={[5, 4]}
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
                          radius={3.5}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={1.2}
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
                fill={hexToRgba(baseColor, 0.08)}
                stroke={stroke}
                strokeWidth={strokeWidth}
                dash={[5, 4]}
                cornerRadius={6}
                draggable={!readOnly}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelectRoom?.(room.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                  if (isBoxSelecting()) return;
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

          {/* Print area overlay (optional) */}
          {printArea && (printAreaMode || showPrintArea) ? (
            <Rect
              x={printArea.x}
              y={printArea.y}
              width={printArea.width}
              height={printArea.height}
              stroke="#0ea5e9"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
          {draftPrintRect ? (
            <Rect
              x={draftPrintRect.x}
              y={draftPrintRect.y}
              width={draftPrintRect.width}
              height={draftPrintRect.height}
              fill="rgba(14,165,233,0.06)"
              stroke="#0ea5e9"
              strokeWidth={1.5}
              dash={[6, 6]}
              listening={false}
              cornerRadius={8}
            />
          ) : null}
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

        {/* Links layer */}
        <Layer perfectDrawEnabled={false}>
          {(plan.links || []).map((link) => {
            const from = objectById.get(link.fromId);
            const to = objectById.get(link.toId);
            if (!from || !to) return null;
            const isSelected = !!selectedLinkId && selectedLinkId === link.id;
            const kind = (link as any).kind || 'arrow';
            const stroke = isSelected ? '#2563eb' : link.color || '#94a3b8';
            const width = Number((link as any).width || (kind === 'cable' ? 3 : 2));
            const dash = (link as any).dashed ? [8, 6] : undefined;
            const route = ((link as any).route || 'vh') as 'vh' | 'hv';

            if (kind === 'cable') {
              const points =
                route === 'hv'
                  ? [from.x, from.y, to.x, from.y, to.x, to.y]
                  : [from.x, from.y, from.x, to.y, to.x, to.y];

              const label = String((link as any).name || (link as any).label || '').trim();
              const mid = (() => {
                const pts = points;
                let total = 0;
                for (let i = 0; i < pts.length - 2; i += 2) total += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
                const half = total / 2;
                let acc = 0;
                for (let i = 0; i < pts.length - 2; i += 2) {
                  const x1 = pts[i];
                  const y1 = pts[i + 1];
                  const x2 = pts[i + 2];
                  const y2 = pts[i + 3];
                  const seg = Math.hypot(x2 - x1, y2 - y1);
                  if (acc + seg >= half) {
                    const t = seg ? (half - acc) / seg : 0;
                    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
                  }
                  acc += seg;
                }
                return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
              })();

              return (
                <Group key={link.id}>
                  <Line
                    points={points}
                    stroke={stroke}
                    strokeWidth={isSelected ? width + 1 : width}
                    hitStrokeWidth={Math.max(14, (isSelected ? width + 1 : width) + 10)}
                    dash={dash as any}
                    lineCap="round"
                    lineJoin="round"
                    opacity={0.9}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      onSelectLink?.(link.id);
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      if (!onLinkDblClick) return;
                      if (readOnly) return;
                      onSelectLink?.(link.id);
                      onLinkDblClick(link.id);
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                      if (!onLinkContextMenu) return;
                      onSelectLink?.(link.id);
                      onLinkContextMenu({ id: link.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                  />
                  {label ? (
                    <Text
                      text={label}
                      x={mid.x - 120}
                      y={mid.y - 14}
                      width={240}
                      align="center"
                      fontSize={11}
                      fontStyle="bold"
                      fill="#0f172a"
                      listening={false}
                    />
                  ) : null}
                </Group>
              );
            }

	            return (
	              <Group key={link.id}>
	                <Arrow
	                  points={[from.x, from.y, to.x, to.y]}
	                  stroke={stroke}
	                  fill={stroke}
	                  pointerLength={8}
	                  pointerWidth={8}
	                  strokeWidth={isSelected ? width + 1 : width}
	                  hitStrokeWidth={Math.max(14, (isSelected ? width + 1 : width) + 10)}
	                  opacity={0.85}
	                  onClick={(e) => {
	                    e.cancelBubble = true;
	                    onSelectLink?.(link.id);
	                  }}
	                  onDblClick={(e) => {
	                    e.cancelBubble = true;
	                    if (!onLinkDblClick) return;
	                    if (readOnly) return;
	                    onSelectLink?.(link.id);
	                    onLinkDblClick(link.id);
	                  }}
	                  onContextMenu={(e) => {
	                    e.evt.preventDefault();
	                    e.cancelBubble = true;
	                    if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
	                    if (!onLinkContextMenu) return;
	                    onSelectLink?.(link.id);
	                    onLinkContextMenu({ id: link.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
	                  }}
	                />
	                {String(link.name || link.label || '').trim() ? (
	                  <Text
	                    text={String(link.name || link.label || '').trim()}
	                    x={(from.x + to.x) / 2 - 120}
	                    y={(from.y + to.y) / 2 - 18}
	                    width={240}
	                    align="center"
	                    fontSize={11}
	                    fontStyle="bold"
	                    fill="#0f172a"
	                    listening={false}
	                  />
	                ) : null}
	              </Group>
	            );
	          })}
	        </Layer>

        {/* Objects layer */}
        <Layer perfectDrawEnabled={false} ref={objectsLayerRef}>
          {plan.objects.map((obj) => {
            const isSelected = selectedIds ? selectedIds.includes(obj.id) : selectedId === obj.id;
            const highlightActive = !!(highlightId && highlightUntil && highlightId === obj.id && highlightUntil > highlightNow);
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(highlightNow / 80) : 0;
            const scale = obj.scale ?? 1;
            const iconImg = iconImages[obj.type];
            const labelText =
              obj.type === 'real_user' && (((obj as any).firstName && String((obj as any).firstName).trim()) || ((obj as any).lastName && String((obj as any).lastName).trim()))
                ? `${String((obj as any).firstName || '').trim()}\n${String((obj as any).lastName || '').trim()}`.trim()
                : obj.name;
            const labelLines = labelText.includes('\n') ? 2 : 1;
            const labelLineHeight = 1.2;
            const labelFontSize = Math.max(4, 10 * scale);
            const labelHeight = labelLines * labelFontSize * labelLineHeight;
            const labelGap = 6;
            const labelY = -(18 * scale) - labelGap - labelHeight;
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
                onMouseEnter={(e) => {
                  if (obj.type !== 'real_user') return;
                  setHoverCard({ clientX: e.evt.clientX, clientY: e.evt.clientY, obj });
                }}
                onMouseMove={(e) => {
                  if (obj.type !== 'real_user') return;
                  if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
                  const cx = e.evt.clientX;
                  const cy = e.evt.clientY;
                  hoverRaf.current = requestAnimationFrame(() => {
                    setHoverCard((prev) => (prev ? { ...prev, clientX: cx, clientY: cy } : { clientX: cx, clientY: cy, obj }));
                  });
                }}
                onMouseLeave={() => {
                  if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
                  hoverRaf.current = null;
                  setHoverCard(null);
                }}
                onDragEnd={(e) => {
                  if (readOnly) return;
                  const stage = stageRef.current;
                  if (!stage) {
                    const nextX = snapEnabled ? snap(e.target.x()) : e.target.x();
                    const nextY = snapEnabled ? snap(e.target.y()) : e.target.y();
                    onMove(obj.id, nextX, nextY);
                    return;
                  }
                  const transform = stage.getAbsoluteTransform().copy();
                  transform.invert();
                  const abs = e.target.getAbsolutePosition();
                  const world = transform.point(abs);
                  const nextX = snapEnabled ? snap(world.x) : world.x;
                  const nextY = snapEnabled ? snap(world.y) : world.y;
                  onMove(obj.id, nextX, nextY);
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
                  if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                  if (isBoxSelecting()) return;
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
                  text={labelText}
                  x={-80}
                  y={labelY}
                  width={160}
                  align="center"
                  fontStyle="bold"
                  fill="#0f172a"
                  fontSize={labelFontSize}
                  lineHeight={labelLineHeight}
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
                if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                if (isBoxSelecting()) return;
                const firstId = (selectedIds || [])[0];
                if (!firstId) return;
                lastContextMenuAtRef.current = Date.now();
                onContextMenu({ id: firstId, clientX: e.evt.clientX, clientY: e.evt.clientY });
              }}
              onDragStart={(e) => {
                const startById: Record<string, { x: number; y: number }> = {};
                const ids = selectedIds || [];
                for (const id of ids) {
                  const obj = objectById.get(id);
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
                  const nx = start.x + dx;
                  const ny = start.y + dy;
                  onMove(id, snapEnabled ? snap(nx) : nx, snapEnabled ? snap(ny) : ny);
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
	          title={t({ it: 'Aumenta zoom', en: 'Zoom in' })}
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
	          title={t({ it: 'Riduci zoom', en: 'Zoom out' })}
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
          title={t({ it: 'Vai alla vista predefinita', en: 'Go to default view' })}
          onClick={() => onGoDefaultView?.()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-ink hover:bg-slate-50"
        >
          VD
        </button>
      </div>
    </div>
  );
};

const CanvasStage = memo(forwardRef(CanvasStageImpl));
CanvasStage.displayName = 'CanvasStage';
export default CanvasStage;
