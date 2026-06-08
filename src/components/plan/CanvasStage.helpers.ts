/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Corridor, MapObject } from '../../store/types';
import { TEXT_FONT_OPTIONS } from '../../store/data';
import { clamp } from '../../utils/geometry';
import { isDeskType } from './deskTypes';

// Pure drawing/geometry helpers + canvas constants extracted from CanvasStage.
export const hexToRgba = (hex: string, alpha: number) => {
  const h = String(hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(100,116,139,${alpha})`; // slate-500 fallback
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};

export const formatMeasure = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/, '');
};

export const TEXT_BOX_MIN_WIDTH = 80;
export const TEXT_BOX_MIN_HEIGHT = 32;
export const TEXT_BOX_DEFAULT_WIDTH = 160;
export const TEXT_BOX_DEFAULT_HEIGHT = 56;
export const OBJECT_CULL_MARGIN = 420;
export const PHOTO_ICON_BASE_SIZE = 34;
export const SAFETY_CARD_HELP_TOAST_ID = 'safety-card-help';
export const SAFETY_CARD_COLOR_VARIANTS = [
  { body: '#e0f2fe', header: '#bae6fd', border: '#0ea5e9', title: '#075985', text: '#0f172a' },
  { body: '#ecfeff', header: '#cffafe', border: '#06b6d4', title: '#0e7490', text: '#0f172a' },
  { body: '#dbeafe', header: '#bfdbfe', border: '#3b82f6', title: '#1d4ed8', text: '#0f172a' },
  { body: '#f0f9ff', header: '#e0f2fe', border: '#0284c7', title: '#0c4a6e', text: '#111827' }
] as const;
export const SAFETY_CARD_TEXT_BG_VARIANTS = ['transparent', '#ecfeff', '#dbeafe', '#e0f2fe'] as const;
export const SAFETY_CARD_FONT_VALUES = (TEXT_FONT_OPTIONS || []).map((entry) => String(entry.value || '').trim()).filter(Boolean);

export const sameSafetyCardDraftLayout = (
  a: {
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    fontIndex: number;
    colorIndex: number;
    textBgIndex: number;
  } | null,
  b: {
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    fontIndex: number;
    colorIndex: number;
    textBgIndex: number;
  } | null
) => {
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 0.01 &&
    Math.abs(a.y - b.y) < 0.01 &&
    Math.abs(a.w - b.w) < 0.01 &&
    Math.abs(a.h - b.h) < 0.01 &&
    Math.abs(a.fontSize - b.fontSize) < 0.01 &&
    a.fontIndex === b.fontIndex &&
    a.colorIndex === b.colorIndex &&
    a.textBgIndex === b.textBgIndex
  );
};

export const getDeskBounds = (
  type: string,
  dims: {
    deskSize: number;
    deskRectW: number;
    deskRectH: number;
    deskLongW: number;
    deskLongH: number;
    deskDoubleW: number;
    deskDoubleH: number;
    deskDoubleGap: number;
    deskTrapBottom: number;
    deskTrapHeight: number;
  }
) => {
  if (type === 'desk_rect') return { width: dims.deskRectW, height: dims.deskRectH };
  if (type === 'desk_double') return { width: dims.deskDoubleW * 2 + dims.deskDoubleGap, height: dims.deskDoubleH };
  if (type === 'desk_long') return { width: dims.deskLongW, height: dims.deskLongH };
  if (type === 'desk_trap') return { width: dims.deskTrapBottom, height: dims.deskTrapHeight };
  return { width: dims.deskSize, height: dims.deskSize };
};

export const getRotatedRectBounds = (centerX: number, centerY: number, width: number, height: number, rotation: number) => {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  if (!w || !h) return null;
  const angle = Number(rotation) || 0;
  if (!angle) {
    const halfW = w / 2;
    const halfH = h / 2;
    return { minX: centerX - halfW, minY: centerY - halfH, maxX: centerX + halfW, maxY: centerY + halfH };
  }
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = w / 2;
  const halfH = h / 2;
  const points = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH }
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const rx = p.x * cos - p.y * sin + centerX;
    const ry = p.x * sin + p.y * cos + centerY;
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { minX, minY, maxX, maxY };
};

export const getViewportWorldBounds = (
  dimensions: { width: number; height: number },
  pan: { x: number; y: number },
  zoom: number
) => {
  const safeZoom = Math.max(0.001, Number(zoom) || 1);
  const minX = (0 - pan.x) / safeZoom;
  const minY = (0 - pan.y) / safeZoom;
  const maxX = (dimensions.width - pan.x) / safeZoom;
  const maxY = (dimensions.height - pan.y) / safeZoom;
  return { minX, minY, maxX, maxY };
};

export const isObjectPotentiallyVisible = (
  obj: MapObject,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  margin = OBJECT_CULL_MARGIN
) => {
  const x = Number(obj?.x || 0);
  const y = Number(obj?.y || 0);
  return x >= bounds.minX - margin && x <= bounds.maxX + margin && y >= bounds.minY - margin && y <= bounds.maxY + margin;
};

export const intersectRaySegment = (
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
) => {
  const v = { x: b.x - a.x, y: b.y - a.y };
  const denom = dir.x * v.y - dir.y * v.x;
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-6) return null;
  const w = { x: a.x - origin.x, y: a.y - origin.y };
  const t = (w.x * v.y - w.y * v.x) / denom;
  const u = (w.x * dir.y - w.y * dir.x) / denom;
  if (t < 0) return null;
  if (u < 0 || u > 1) return null;
  return t;
};

export const polygonCentroid = (points: { x: number; y: number }[]) => {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    area += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  area *= 0.5;
  if (!Number.isFinite(area) || Math.abs(area) < 0.00001) {
    const avg = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const count = points.length || 1;
    return { x: avg.x / count, y: avg.y / count };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
};

export const getRoomBounds = (room: any) => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as
    | 'rect'
    | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(room?.points) ? room.points : [];
    if (pts.length < 3) return null;
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
    return { minX, minY, maxX, maxY };
  }
  const rx = Number(room?.x || 0);
  const ry = Number(room?.y || 0);
  const rw = Number(room?.width || 0);
  const rh = Number(room?.height || 0);
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rw) || !Number.isFinite(rh)) return null;
  return { minX: rx, minY: ry, maxX: rx + rw, maxY: ry + rh };
};

export const getRoomPolygonPoints = (room: any): { x: number; y: number }[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(room?.points) ? room.points : [];
    if (pts.length >= 3) return pts;
    const x = Number(room?.x || 0);
    const y = Number(room?.y || 0);
    const w = Number(room?.width || 0);
    const h = Number(room?.height || 0);
    if (w > 0 && h > 0) {
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
    }
    return [];
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const w = Number(room?.width || 0);
  const h = Number(room?.height || 0);
  if (!(w > 0 && h > 0)) return [];
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
};

export const getCorridorPolygonPoints = (corridor: Corridor | any): { x: number; y: number }[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as
    | 'rect'
    | 'poly';
  if (kind === 'poly') {
    const pts = Array.isArray(corridor?.points) ? corridor.points : [];
    if (pts.length >= 3) return pts;
    const x = Number(corridor?.x || 0);
    const y = Number(corridor?.y || 0);
    const w = Number(corridor?.width || 0);
    const h = Number(corridor?.height || 0);
    if (w > 0 && h > 0) {
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
    }
    return [];
  }
  const x = Number(corridor?.x || 0);
  const y = Number(corridor?.y || 0);
  const w = Number(corridor?.width || 0);
  const h = Number(corridor?.height || 0);
  if (!(w > 0 && h > 0)) return [];
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
};

export const getCorridorEdgePoint = (points: { x: number; y: number }[], edgeIndex: number, t: number) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const idx = Number.isFinite(edgeIndex) ? Math.floor(edgeIndex) : 0;
  const a = points[((idx % points.length) + points.length) % points.length];
  const b = points[(idx + 1 + points.length) % points.length];
  if (!a || !b) return null;
  const ratio = Math.max(0, Math.min(1, Number(t) || 0));
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio
  };
};

export const getClosestCorridorEdgePoint = (points: { x: number; y: number }[], point: { x: number; y: number }) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  let best: { edgeIndex: number; t: number; x: number; y: number; distSq: number } | null = null;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0.0000001 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq)) : 0;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const distSq = (point.x - x) * (point.x - x) + (point.y - y) * (point.y - y);
    if (!best || distSq < best.distSq) best = { edgeIndex: i, t, x, y, distSq };
  }
  return best;
};

export const getRoomEdgePoint = (points: { x: number; y: number }[], edgeIndex: number, t: number) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  const idx = Number.isFinite(edgeIndex) ? Math.floor(edgeIndex) : 0;
  const a = points[((idx % points.length) + points.length) % points.length];
  const b = points[(idx + 1 + points.length) % points.length];
  if (!a || !b) return null;
  const ratio = Math.max(0, Math.min(1, Number(t) || 0));
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio
  };
};

export const pointInPolygon = (x: number, y: number, points: { x: number; y: number }[]) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};


export const distancePointToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + clamped * dx, y: a.y + clamped * dy };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
};

export const nearestWallSegment = (points: { x: number; y: number }[], target: { x: number; y: number }) => {
  if (points.length < 2) return null;
  let best: { index: number; length: number; distance: number } | null = null;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const distance = distancePointToSegment(target, a, b);
    if (!best || distance < best.distance) {
      best = { index: i, length, distance };
    }
  }
  return best;
};

export const findInteriorPointAtY = (y: number, points: { x: number; y: number }[]) => {
  const xs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const y1 = p1.y;
    const y2 = p2.y;
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      const x = p1.x + ((y - y1) * (p2.x - p1.x)) / (y2 - y1);
      xs.push(x);
    }
  }
  if (xs.length < 2) return null;
  xs.sort((a, b) => a - b);
  let best: { x: number; y: number } | null = null;
  let bestLen = -1;
  for (let i = 0; i < xs.length - 1; i += 2) {
    const x1 = xs[i];
    const x2 = xs[i + 1];
    if (x2 <= x1) continue;
    const len = x2 - x1;
    if (len > bestLen) {
      bestLen = len;
      best = { x: (x1 + x2) / 2, y };
    }
  }
  return best;
};

export const getPolygonBounds = (points: { x: number; y: number }[]) => {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
};

export const getPolygonLabelBounds = (points: { x: number; y: number }[]) => {
  const bounds = getPolygonBounds(points);
  if (!points.length || !bounds.width || !bounds.height) return bounds;
  const minDim = Math.min(bounds.width, bounds.height);
  const step = Math.max(4, minDim / 12);
  for (let shrink = 0; shrink <= minDim / 2; shrink += step) {
    const inner = {
      x: bounds.x + shrink,
      y: bounds.y + shrink,
      width: bounds.width - shrink * 2,
      height: bounds.height - shrink * 2
    };
    if (inner.width < 24 || inner.height < 18) break;
    const corners = [
      { x: inner.x, y: inner.y },
      { x: inner.x + inner.width, y: inner.y },
      { x: inner.x + inner.width, y: inner.y + inner.height },
      { x: inner.x, y: inner.y + inner.height }
    ];
    if (corners.every((p) => pointInPolygon(p.x, p.y, points))) return inner;
  }
  const centroid = polygonCentroid(points);
  const centerY = bounds.y + bounds.height / 2;
  const candidateYs = [
    centerY,
    centroid.y,
    bounds.y + bounds.height * 0.35,
    bounds.y + bounds.height * 0.65
  ].filter((y) => Number.isFinite(y));
  for (const y of candidateYs) {
    const p = findInteriorPointAtY(y, points);
    if (p) {
      const width = Math.min(bounds.width, 160);
      const height = Math.min(bounds.height, 48);
      return {
        x: clamp(p.x - width / 2, bounds.x, bounds.x + bounds.width - width),
        y: clamp(p.y - height / 2, bounds.y, bounds.y + bounds.height - height),
        width,
        height
      };
    }
  }
  return bounds;
};

export const computeObjectBounds = (
  obj: MapObject,
  deps: { wallTypeIdSet: Set<string>; getNodeBounds: (obj: MapObject) => any; estimateTextWidth: (text: string, fontSize: number) => number }
) => {
  const { wallTypeIdSet, getNodeBounds, estimateTextWidth } = deps;
    const type = obj.type;
    if (wallTypeIdSet.has(type) || type === 'quote') {
      const pts = obj.points || [];
      if (pts.length < 2) return null;
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
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
      return { minX, minY, maxX, maxY };
    }
    const x = Number(obj.x);
    const y = Number(obj.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    if (type === 'text') {
      const nodeBounds = getNodeBounds(obj);
      if (nodeBounds) return nodeBounds;
      const textSize = clamp(Number((obj as any).textSize ?? 18) || 18, 6, 160);
      const textValue = String(obj.name || '');
      const textLines = textValue ? textValue.split('\n') : [''];
      const textLineHeight = 1.2;
      const textNaturalWidth = Math.max(40, ...textLines.map((line) => estimateTextWidth(line || ' ', textSize)));
      const textNaturalHeight = Math.max(textSize, textLines.length * textSize * textLineHeight);
      const textPadding = Math.max(4, Math.round(textSize * 0.35));
      const baseTextBoxWidth = Number((obj as any).textBoxWidth || 0);
      const baseTextBoxHeight = Number((obj as any).textBoxHeight || 0);
      const fallbackTextBoxWidth = Math.max(TEXT_BOX_DEFAULT_WIDTH, textNaturalWidth + textPadding * 2);
      const fallbackTextBoxHeight = Math.max(TEXT_BOX_DEFAULT_HEIGHT, textNaturalHeight + textPadding * 2);
      const rawTextBoxWidth =
        Number.isFinite(baseTextBoxWidth) && baseTextBoxWidth > 0 ? baseTextBoxWidth : fallbackTextBoxWidth;
      const rawTextBoxHeight =
        Number.isFinite(baseTextBoxHeight) && baseTextBoxHeight > 0 ? baseTextBoxHeight : fallbackTextBoxHeight;
      const freeScaleX = clamp(Number((obj as any).scaleX ?? 1) || 1, 0.2, 6);
      const freeScaleY = clamp(Number((obj as any).scaleY ?? 1) || 1, 0.2, 6);
      const width = Math.max(TEXT_BOX_MIN_WIDTH, rawTextBoxWidth * freeScaleX);
      const height = Math.max(TEXT_BOX_MIN_HEIGHT, rawTextBoxHeight * freeScaleY);
      const rotation = Number((obj as any).rotation || 0);
      return getRotatedRectBounds(x, y, width, height, rotation);
    }

    if (type === 'image') {
      const baseW = Math.max(40, Number((obj as any).imageWidth ?? 160) || 160);
      const baseH = Math.max(30, Number((obj as any).imageHeight ?? 120) || 120);
      const scaleX = clamp(Number((obj as any).scaleX ?? 1) || 1, 0.2, 6);
      const scaleY = clamp(Number((obj as any).scaleY ?? 1) || 1, 0.2, 6);
      const rotation = Number((obj as any).rotation || 0);
      return getRotatedRectBounds(x, y, baseW * scaleX, baseH * scaleY, rotation);
    }

    const baseScale = clamp(Number(obj.scale ?? 1) || 1, 0.2, 6);

    if (type === 'postit') {
      const postItCompact = !!(obj as any).postitCompact;
      const size = (postItCompact ? 26 : 36) * baseScale;
      return getRotatedRectBounds(x, y, size, size, 0);
    }

    if (isDeskType(type)) {
      const deskScaleX = clamp(Number(obj.scaleX ?? 1) || 1, 0.4, 4);
      const deskScaleY = clamp(Number(obj.scaleY ?? 1) || 1, 0.4, 4);
      const deskSize = 38 * baseScale;
      const deskRectW = deskSize * 1.45;
      const deskRectH = deskSize * 0.75;
      const deskLongW = deskSize * 1.85;
      const deskLongH = deskSize * 0.6;
      const deskDoubleW = deskSize * 0.7;
      const deskDoubleH = deskSize * 0.95;
      const deskDoubleGap = 4 * baseScale;
      const deskTrapBottom = deskSize * 1.15;
      const deskTrapHeight = deskSize * 0.75;
      const bounds = getDeskBounds(type, {
        deskSize,
        deskRectW,
        deskRectH,
        deskLongW,
        deskLongH,
        deskDoubleW,
        deskDoubleH,
        deskDoubleGap,
        deskTrapBottom,
        deskTrapHeight
      });
      const rotation = Number(obj.rotation || 0);
      return getRotatedRectBounds(x, y, bounds.width * deskScaleX, bounds.height * deskScaleY, rotation);
    }

    const size = 36 * baseScale;
    const rotation = type === 'camera' ? Number(obj.rotation || 0) : 0;
    return getRotatedRectBounds(x, y, size, size, rotation);
};

export const buildWifiRangeRings = (
  origin: { x: number; y: number },
  baseRadiusPx: number,
  wallSegments: any[],
  wifiRayAngles: number[]
) => {
      const outer: number[] = [];
      const mid: number[] = [];
      const inner: number[] = [];
      for (const angle of wifiRayAngles) {
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const hits: Array<{ t: number; attenuation: number }> = [];
        if (wallSegments.length) {
          for (const seg of wallSegments) {
            const t = intersectRaySegment(origin, dir, seg.a, seg.b);
            if (t !== null && t <= baseRadiusPx) {
              hits.push({ t, attenuation: seg.attenuation });
            }
          }
        }
        hits.sort((a, b) => a.t - b.t);
        let dist = baseRadiusPx;
        for (const hit of hits) {
          if (hit.t > dist) break;
          const remaining = dist - hit.t;
          if (remaining <= 0) {
            dist = hit.t;
            break;
          }
          const factor = Math.pow(10, hit.attenuation / 20);
          dist = hit.t + remaining / factor;
        }
        dist = Math.max(0, dist);
        outer.push(dir.x * dist, dir.y * dist);
        mid.push(dir.x * dist * 0.7, dir.y * dist * 0.7);
        inner.push(dir.x * dist * 0.4, dir.y * dist * 0.4);
      }
      return { outer, mid, inner };
};

export const buildCameraFovPolygon = (
  origin: { x: number; y: number },
  rangePx: number,
  angleDeg: number,
  rotationDeg: number,
  cameraWallSegments: any[]
) => {
      if (!Number.isFinite(rangePx) || rangePx <= 0) return null;
      if (!Number.isFinite(angleDeg) || angleDeg <= 0) return null;
      const clampedAngle = Math.min(360, Math.max(5, angleDeg));
      const steps = Math.max(12, Math.ceil(clampedAngle / 5));
      const startRad = ((rotationDeg - clampedAngle / 2) * Math.PI) / 180;
      const endRad = ((rotationDeg + clampedAngle / 2) * Math.PI) / 180;
      const points: number[] = [0, 0];
      for (let i = 0; i <= steps; i += 1) {
        const angle = startRad + ((endRad - startRad) * i) / steps;
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        let dist = rangePx;
        if (cameraWallSegments.length) {
          for (const seg of cameraWallSegments) {
            const t = intersectRaySegment(origin, dir, seg.a, seg.b);
            if (t !== null && t < dist) dist = t;
          }
        }
        dist = Math.max(0, dist);
        points.push(dir.x * dist, dir.y * dist);
      }
      return points;
};

// Axis-aligned rect from two drag corners (shared by draft/selection/text/print handlers). Pure.
export const dragRectFromCorners = (x1: number, y1: number, x2: number, y2: number) => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  width: Math.abs(x2 - x1),
  height: Math.abs(y2 - y1)
});

// Nearest room-polygon vertex within a zoom-scaled snap threshold (room-rect drawing). Pure.
export const findNearestRoomCorner = (
  rooms: any[],
  point: { x: number; y: number },
  zoom: number
): { x: number; y: number } | null => {
  const list = (rooms || []).filter(Boolean);
  if (!list.length) return null;
  const zoomValue = Math.max(0.2, zoom || 1);
  const snapThreshold = 14 / zoomValue;
  const snapThresholdSq = snapThreshold * snapThreshold;
  let best: { x: number; y: number; distSq: number } | null = null;
  for (const room of list) {
    const points = getRoomPolygonPoints(room);
    if (!points.length) continue;
    for (const vertex of points) {
      const dx = vertex.x - point.x;
      const dy = vertex.y - point.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > snapThresholdSq) continue;
      if (!best || distSq < best.distSq) best = { x: vertex.x, y: vertex.y, distSq };
    }
  }
  if (!best) return null;
  return { x: best.x, y: best.y };
};

// Wall polyline → attenuating segments for wifi ray-casting. Pure.
export const buildWallSegments = (
  wallObjects: any[],
  wallAttenuationMap: Map<string, number>
): Array<{ a: { x: number; y: number }; b: { x: number; y: number }; attenuation: number }> => {
  const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; attenuation: number }> = [];
  for (const wall of wallObjects || []) {
    const attenuation = Number(wallAttenuationMap.get(wall.type) ?? 0);
    if (!Number.isFinite(attenuation) || attenuation <= 0) continue;
    const pts = wall.points || [];
    if (pts.length < 2) continue;
    for (let i = 0; i < pts.length - 1; i += 1) segments.push({ a: pts[i], b: pts[i + 1], attenuation });
  }
  return segments;
};

// Wall polyline → opaque segments for camera FOV (glass/window walls are see-through). Pure.
export const buildCameraWallSegments = (
  wallObjects: any[]
): Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> => {
  const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
  for (const wall of wallObjects || []) {
    const typeId = String(wall.type || '');
    if (typeId.includes('glass') || typeId.includes('window')) continue;
    const pts = wall.points || [];
    if (pts.length < 2) continue;
    for (let i = 0; i < pts.length - 1; i += 1) segments.push({ a: pts[i], b: pts[i + 1] });
  }
  return segments;
};

// Evenly-spaced ray angles around a full circle (wifi range sampling). Pure.
export const buildWifiRayAngles = (steps = 72): number[] => {
  const list: number[] = [];
  for (let i = 0; i < steps; i += 1) list.push((i / steps) * Math.PI * 2);
  return list;
};
