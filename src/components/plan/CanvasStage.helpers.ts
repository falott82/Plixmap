/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Corridor, MapObject } from '../../store/types';
import { TEXT_FONT_OPTIONS } from '../../store/data';

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
