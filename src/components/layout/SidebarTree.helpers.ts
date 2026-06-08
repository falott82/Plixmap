// Pure date/time/geometry/coordinate helpers extracted from SidebarTree.tsx.

export const parseCoords = (value: string | undefined): { lat: number; lng: number } | null => {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
};

export const formatTs = (value?: number | null): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

export const formatMinutes = (value?: number | null): string => {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  // Keep 0.5 steps readable.
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

export const toEpochMs = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const roomPolygonPoints = (room: any): Array<{ x: number; y: number }> => {
  const shape = (room as any)?.shape || null;
  if (shape?.kind === 'poly' && Array.isArray(shape.points)) {
    return shape.points
      .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  if (Array.isArray((room as any)?.points)) {
    return (room as any).points
      .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  const rect =
    shape?.kind === 'rect'
      ? { x: Number(shape?.x), y: Number(shape?.y), width: Number(shape?.width), height: Number(shape?.height) }
      : {
          x: Number((room as any)?.x),
          y: Number((room as any)?.y),
          width: Number((room as any)?.width),
          height: Number((room as any)?.height)
        };
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return [];
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
};

export const polygonCenter = (points: Array<{ x: number; y: number }>): { x: number; y: number } | null => {
  if (!Array.isArray(points) || points.length < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += Number(p.x) || 0;
    sumY += Number(p.y) || 0;
  }
  return { x: sumX / points.length, y: sumY / points.length };
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const shiftIsoDay = (isoDay: string, deltaDays: number) => {
  const base = String(isoDay || '').trim() || todayIso();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), Number.isFinite(m) ? m - 1 : 0, Number.isFinite(d) ? d : 1);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const monthAnchorFromIso = (iso: string) => {
  const d = new Date(`${String(iso || '').trim() || todayIso()}T00:00:00`);
  if (!Number.isFinite(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const shiftMonthAnchor = (anchorIso: string, deltaMonths: number) => {
  const d = new Date(`${String(anchorIso || '').trim() || monthAnchorFromIso(todayIso())}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return monthAnchorFromIso(todayIso());
  d.setMonth(d.getMonth() + deltaMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const timeHmFromTs = (value: number) => {
  const d = new Date(Number(value || 0));
  if (!Number.isFinite(d.getTime())) return '00:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const hmToMinutes = (hm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!m) return 0;
  const h = Math.max(0, Math.min(23, Number(m[1]) || 0));
  const mm = Math.max(0, Math.min(59, Number(m[2]) || 0));
  return h * 60 + mm;
};

export const minutesToHm = (totalMinutes: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(Number(totalMinutes) || 0)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const localTsFromIsoHm = (isoDay: string, hm: string): number | null => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!dm || !tm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]) - 1;
  const da = Number(dm[3]);
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (![y, mo, da, hh, mm].every(Number.isFinite)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const dt = new Date(y, mo, da, hh, mm, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt.getTime() : null;
};

