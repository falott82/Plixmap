/* eslint-disable @typescript-eslint/no-explicit-any */
import { escapeHtml, formatEta, polygonCentroid, corridorPolygon, roomPolygon, getCorridorDoorAnchor, getCorridorConnectionAnchor, pointOnPolygonBoundary, normalizeTransitionType, transitionPenaltySeconds, polylineLength, SPEED_MPS, type Point, type RouteResult, type RoutePlanSegment } from './internalMapRouting';
import { pointInPolygon } from './planViewUtils';
import type { Corridor, FloorPlan } from '../../store/types';

// DOM/image export utilities (clone, inline images, rasterize SVG) extracted from InternalMapModal.
export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file-read-error'));
    reader.readAsDataURL(blob);
  });

export const loadImageAsDataUrl = async (src: string) => {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (/^data:/i.test(raw)) return raw;
  try {
    const response = await fetch(raw, { credentials: 'include', mode: 'cors' });
    if (!response.ok) throw new Error(`http-${response.status}`);
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return raw;
  }
};

export const waitForNodeImagesReady = async (node: HTMLElement) => {
  const htmlImgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
  const svgImgs = Array.from(node.querySelectorAll('image')) as SVGImageElement[];
  const waitHtml = htmlImgs.map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
  );
  const waitSvg = svgImgs.map((svgImg) => {
    const href = String(svgImg.getAttribute('href') || svgImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '').trim();
    if (!href) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      if (/^https?:\/\//i.test(href)) img.crossOrigin = 'anonymous';
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = href;
    });
  });
  await Promise.all([...waitHtml, ...waitSvg]);
};

export const inlineImagesForExport = async (node: HTMLElement) => {
  const cache = new Map<string, Promise<string>>();
  const resolveDataUrl = (rawSrc: string) => {
    const src = String(rawSrc || '').trim();
    if (!src) return Promise.resolve('');
    if (/^data:/i.test(src)) return Promise.resolve(src);
    const cached = cache.get(src);
    if (cached) return cached;
    const task = loadImageAsDataUrl(src);
    cache.set(src, task);
    return task;
  };

  const svgImages = Array.from(node.querySelectorAll('svg image'));
  for (const entry of svgImages) {
    const href = String(entry.getAttribute('href') || entry.getAttribute('xlink:href') || '').trim();
    if (!href) continue;
    const dataUrl = await resolveDataUrl(href);
    if (!dataUrl || !/^data:/i.test(dataUrl)) continue;
    entry.setAttribute('href', dataUrl);
    entry.setAttribute('xlink:href', dataUrl);
  }

  const htmlImages = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
  for (const entry of htmlImages) {
    const src = String(entry.currentSrc || entry.src || '').trim();
    if (!src) continue;
    const dataUrl = await resolveDataUrl(src);
    if (!dataUrl || !/^data:/i.test(dataUrl)) continue;
    entry.src = dataUrl;
    try {
      if (typeof entry.decode === 'function') await entry.decode();
    } catch {
      // ignore decode issues
    }
  }
};

export const rasterizeSvgsForExport = async (node: HTMLElement) => {
  const svgNodes = Array.from(node.querySelectorAll('svg')) as SVGSVGElement[];
  for (const svg of svgNodes) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const snapshot = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        snapshot.onload = null;
        snapshot.onerror = null;
        URL.revokeObjectURL(objectUrl);
        resolve(ok);
      };
      const timeout = window.setTimeout(() => done(false), 3500);
      snapshot.onload = () => {
        window.clearTimeout(timeout);
        done(true);
      };
      snapshot.onerror = () => {
        window.clearTimeout(timeout);
        done(false);
      };
      snapshot.src = objectUrl;
    });
    if (!loaded) continue;

    const computed = window.getComputedStyle(svg);
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || parseFloat(computed.width) || 1));
    const height = Math.max(1, Math.round(rect.height || parseFloat(computed.height) || 1));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(snapshot, 0, 0, width, height);
    const replacement = document.createElement('img');
    replacement.alt = '';
    replacement.src = canvas.toDataURL('image/png');
    replacement.width = width;
    replacement.height = height;
    replacement.style.display = computed.display === 'inline' ? 'block' : computed.display || 'block';
    replacement.style.width = computed.width && computed.width !== 'auto' ? computed.width : '100%';
    replacement.style.height = computed.height && computed.height !== 'auto' ? computed.height : `${height}px`;
    replacement.style.maxWidth = '100%';
    replacement.style.verticalAlign = computed.verticalAlign || 'baseline';
    try {
      if (typeof replacement.decode === 'function') await replacement.decode();
    } catch {
      // ignore decode failures
    }
    svg.replaceWith(replacement);
  }
};

export const buildCaptureNode = (source: HTMLElement) => {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '-100000px';
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';
  host.style.zIndex = '-1';
  const clone = source.cloneNode(true) as HTMLElement;
  host.appendChild(clone);
  document.body.appendChild(host);
  return { host, node: clone };
};

// Build the printable multi-floor route HTML (extracted from InternalMapModal).
export const buildRoutePdfPreviewHtml = async (deps: any) => {
  const { routeResult, setRouteError, t, availablePlans, selectedClient, selectedSite, selectedStartEntry, selectedDestinationEntry, startPlan, destinationPlan, getRoomLabel, getCorridorLabel, startPoint, destinationPoint, collectRouteTravelPoints } = deps;
    if (!routeResult || !routeResult.segments.length) {
      setRouteError(t({ it: 'Calcola prima il percorso per esportare il PDF.', en: 'Calculate the route first to export the PDF.' }));
      return '';
    }
    const planById = new Map<string, any>(availablePlans.map((plan: any) => [plan.id, plan]));
    const planOrder = new Map<string, number>(availablePlans.map((plan: any, index: number) => [plan.id, index]));
    const segmentPlanIds = Array.from(new Set(routeResult.segments.map((segment: any) => segment.planId)));
    const planImageById = new Map<string, string>();
    await Promise.all(
      segmentPlanIds.map(async (planId: any) => {
        const plan = planById.get(planId);
        const imageUrl = String(plan?.imageUrl || '').trim();
        if (!imageUrl) return;
        planImageById.set(planId, await loadImageAsDataUrl(imageUrl));
      })
    );
    const mapTitle = t({ it: 'Percorso interno multi-piano', en: 'Multi-floor internal route' });
    const titleSafe = escapeHtml(mapTitle);
    const clientName = String(selectedClient?.shortName || selectedClient?.name || '-').trim() || '-';
    const siteName = String(selectedSite?.name || '-').trim() || '-';
    const siteNameSafe = escapeHtml(siteName);
    const startLabel = String(selectedStartEntry?.label || t({ it: 'punto A', en: 'point A' })).trim();
    const destinationLabel = String(selectedDestinationEntry?.label || t({ it: 'punto B', en: 'point B' })).trim();
    const startPlanLabel = String(startPlan?.name || routeResult.segments[0]?.planName || '-').trim() || '-';
    const destinationPlanLabel = String(destinationPlan?.name || routeResult.segments[routeResult.segments.length - 1]?.planName || '-').trim() || '-';
    const startPathLabel = escapeHtml(`${clientName} > ${siteName} > ${startPlanLabel} > ${startLabel}`);
    const destinationPathLabel = escapeHtml(`${clientName} > ${siteName} > ${destinationPlanLabel} > ${destinationLabel}`);
    const formatDistance = (meters?: number, px?: number) => {
      if (typeof meters === 'number' && Number.isFinite(meters)) {
        if (meters >= 100) return `${Math.round(meters)} m`;
        return `${meters.toFixed(1)} m`;
      }
      const safePx = Number(px || 0);
      return `${safePx.toFixed(1)} px`;
    };
    const totalDistanceLabel = escapeHtml(formatDistance(routeResult.distanceMeters, routeResult.distancePx));
    const totalEtaLabel = escapeHtml(routeResult.etaSeconds ? formatEta(routeResult.etaSeconds) : '--');
    const getRoomNameAtPoint = (plan: FloorPlan | undefined, point: Point | null) => {
      if (!plan || !point) return '';
      for (const room of plan.rooms || []) {
        const poly = roomPolygon(room);
        if (poly.length < 3) continue;
        if (pointInPolygon(point, poly) || pointOnPolygonBoundary(point, poly)) {
          const name = getRoomLabel(room);
          if (name) return name;
        }
      }
      return '';
    };
    const pickCorridorNameForSegment = (plan: FloorPlan | undefined, segment: RoutePlanSegment) => {
      if (!plan) return t({ it: 'corridoio', en: 'corridor' });
      const routePoints = segment.route.corridorPoints || [];
      if (!routePoints.length) return t({ it: 'corridoio', en: 'corridor' });
      const total = polylineLength(routePoints);
      let midPoint = routePoints[Math.floor(routePoints.length / 2)] || routePoints[0];
      if (total > 0.01) {
        const target = total / 2;
        let walked = 0;
        for (let i = 0; i < routePoints.length - 1; i += 1) {
          const a = routePoints[i];
          const b = routePoints[i + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (walked + len >= target) {
            const ratio = len > 0 ? (target - walked) / len : 0;
            midPoint = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
            break;
          }
          walked += len;
        }
      }
      let bestName = '';
      let bestDist = Number.POSITIVE_INFINITY;
      for (const corridor of (plan.corridors || []) as Corridor[]) {
        const polygon = corridorPolygon(corridor);
        if (polygon.length < 3) continue;
        const name = getCorridorLabel(corridor, t({ it: 'corridoio', en: 'corridor' }));
        if (pointInPolygon(midPoint, polygon) || pointOnPolygonBoundary(midPoint, polygon)) return name;
        const center = polygonCentroid(polygon);
        const dist = Math.hypot(center.x - midPoint.x, center.y - midPoint.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestName = name;
        }
      }
      return bestName || t({ it: 'corridoio', en: 'corridor' });
    };
    const getTurnWord = (route: RouteResult): { it: string; en: string } | null => {
      const points = collectRouteTravelPoints(route);
      for (let i = 0; i < points.length - 2; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        const c = points[i + 2];
        const ax = b.x - a.x;
        const ay = b.y - a.y;
        const bx = c.x - b.x;
        const by = c.y - b.y;
        if (Math.hypot(ax, ay) < 0.001 || Math.hypot(bx, by) < 0.001) continue;
        const cross = ax * by - ay * bx;
        if (Math.abs(cross) < 0.001) continue;
        return cross > 0 ? { it: 'destra', en: 'right' } : { it: 'sinistra', en: 'left' };
      }
      return null;
    };
    const getDestinationSideWord = (route: RouteResult, point: Point | null): { it: string; en: string } | null => {
      if (!point) return null;
      const points = route.corridorPoints || [];
      if (points.length < 2) return null;
      const prev = points[points.length - 2];
      const end = points[points.length - 1];
      const dx = end.x - prev.x;
      const dy = end.y - prev.y;
      if (Math.hypot(dx, dy) < 0.001) return null;
      const relX = point.x - end.x;
      const relY = point.y - end.y;
      const cross = dx * relY - dy * relX;
      if (Math.abs(cross) < 0.001) return null;
      return cross > 0 ? { it: 'destra', en: 'right' } : { it: 'sinistra', en: 'left' };
    };
    const getTransitionAction = (fromPlanId: string, toPlanId: string) => {
      const fromIdx = planOrder.get(fromPlanId);
      const toIdx = planOrder.get(toPlanId);
      if (Number.isFinite(fromIdx) && Number.isFinite(toIdx)) {
        if (Number(toIdx) > Number(fromIdx)) return { it: 'Sali', en: 'Go up' };
        if (Number(toIdx) < Number(fromIdx)) return { it: 'Scendi', en: 'Go down' };
      }
      return { it: 'Prosegui', en: 'Continue' };
    };
    const renderRouteSvg = (segment: RoutePlanSegment, segmentIndex: number) => {
      const plan = planById.get(segment.planId);
      if (!plan) return '';
      const width = Number(plan.width || 0) > 0 ? Number(plan.width) : 1600;
      const height = Number(plan.height || 0) > 0 ? Number(plan.height) : 900;
      const pattern = `pdf-grid-${segmentIndex}`;
      const fmtPoint = (point: Point) => `${Number(point.x.toFixed(2))},${Number(point.y.toFixed(2))}`;
      const fmtPoints = (points: Point[]) => points.map(fmtPoint).join(' ');
      const rooms = (plan.rooms || [])
        .map((room: any) => {
          const polygon = roomPolygon(room);
          if (polygon.length < 3) return '';
          const points = fmtPoints(polygon);
          const center = polygonCentroid(polygon);
          const label = escapeHtml(getRoomLabel(room, t({ it: 'Ufficio', en: 'Office' })));
          return `
            <g>
              <polygon points="${points}" fill="rgba(59,130,246,0.12)" stroke="rgba(37,99,235,0.65)" stroke-width="1.2" />
              <text x="${center.x}" y="${center.y}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="#1e3a8a">${label}</text>
            </g>
          `;
        })
        .join('');
      const corridors = ((plan.corridors || []) as Corridor[])
        .map((corridor) => {
          const polygon = corridorPolygon(corridor);
          if (polygon.length < 3) return '';
          return `<polygon points="${fmtPoints(polygon)}" fill="url(#${pattern})" stroke="rgba(15,118,110,0.9)" stroke-dasharray="5 4" stroke-width="1.4" />`;
        })
        .join('');
      const connections = ((plan.corridors || []) as Corridor[])
        .flatMap((corridor) =>
          (corridor.connections || []).map((connection) => {
            const anchor = getCorridorConnectionAnchor(corridor, connection);
            if (!anchor) return '';
            const type = normalizeTransitionType((connection as any)?.transitionType);
            return `
              <g transform="translate(${anchor.x},${anchor.y})">
                <circle cx="0" cy="0" r="6.5" fill="${type === 'elevator' ? '#a855f7' : '#0ea5e9'}" stroke="#ffffff" stroke-width="1.6" />
                <text x="0" y="0.5" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="800" fill="#ffffff">${type === 'elevator' ? 'E' : 'S'}</text>
              </g>
            `;
          })
        )
        .join('');
      const doors = ((plan.corridors || []) as Corridor[])
        .flatMap((corridor) =>
          (corridor.doors || []).map((door) => {
            const anchor = getCorridorDoorAnchor(corridor, door);
            if (!anchor) return '';
            return `
              <g transform="translate(${anchor.x},${anchor.y})">
                <rect x="-2.4" y="-4.2" width="4.8" height="8.4" rx="0.9" fill="#fff7ed" stroke="#9a3412" stroke-width="0.9" />
                <line x1="0" y1="-4.2" x2="0" y2="4.2" stroke="#9a3412" stroke-width="0.8" />
                <circle cx="0.9" cy="0" r="0.55" fill="#9a3412" />
              </g>
            `;
          })
        )
        .join('');
      const route = segment.route;
      const approach = route.approachPoints?.length
        ? `<polyline points="${fmtPoints(route.approachPoints)}" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" />`
        : '';
      const corridorLine = route.corridorPoints?.length
        ? `<polyline points="${fmtPoints(route.corridorPoints)}" fill="none" stroke="#dc2626" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`
        : '';
      const exit = route.exitPoints?.length
        ? `<polyline points="${fmtPoints(route.exitPoints)}" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" />`
        : '';
      let transitionArrow = '';
      if (segment.endConnectionId) {
        const points = collectRouteTravelPoints(route);
        if (points.length >= 2) {
          const end = points[points.length - 1];
          const prev = points[points.length - 2];
          const dx = end.x - prev.x;
          const dy = end.y - prev.y;
          const len = Math.hypot(dx, dy);
          if (Number.isFinite(len) && len >= 0.0001) {
            const ux = dx / len;
            const uy = dy / len;
            const tip = { x: end.x, y: end.y };
            const base = { x: tip.x - ux * 14, y: tip.y - uy * 14 };
            const left = { x: base.x - uy * 5, y: base.y + ux * 5 };
            const right = { x: base.x + uy * 5, y: base.y - ux * 5 };
            transitionArrow = `<polygon points="${fmtPoint(tip)} ${fmtPoint(left)} ${fmtPoint(right)}" fill="#f97316" stroke="#7c2d12" stroke-width="1" />`;
          }
        }
      }
      const isFirst = segmentIndex === 0;
      const isLast = segmentIndex === routeResult.segments.length - 1;
      const doorMarkers = route.directDashedOnly
        ? ''
        : `
        <circle cx="${route.startDoor.x}" cy="${route.startDoor.y}" r="5.5" fill="#fb923c" stroke="#7c2d12" stroke-width="1.3" />
        <circle cx="${route.endDoor.x}" cy="${route.endDoor.y}" r="5.5" fill="#fb923c" stroke="#7c2d12" stroke-width="1.3" />
        `;
      const markers = `
        ${doorMarkers}
        ${
          isFirst && startPoint
            ? `<g><circle cx="${startPoint.x}" cy="${startPoint.y}" r="7" fill="#dc2626" stroke="#ffffff" stroke-width="2" /><text x="${startPoint.x + 10}" y="${startPoint.y - 10}" font-size="12" font-weight="700" fill="#7f1d1d">A</text></g>`
            : ''
        }
        ${
          isLast && destinationPoint
            ? `<g><circle cx="${destinationPoint.x}" cy="${destinationPoint.y}" r="7" fill="#16a34a" stroke="#ffffff" stroke-width="2" /><text x="${destinationPoint.x + 10}" y="${destinationPoint.y - 10}" font-size="12" font-weight="700" fill="#14532d">B</text></g>`
            : ''
        }
      `;
      const imageHref = String(planImageById.get(plan.id) || plan.imageUrl || '').trim();
      const imageTag = imageHref
        ? `<image href="${escapeHtml(imageHref)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" opacity="0.72" />`
        : '';
      return `
        <svg viewBox="0 0 ${width} ${height}" class="map-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="${pattern}" width="22" height="22" patternUnits="userSpaceOnUse">
              <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
              <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" stroke-width="1" />
              <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" stroke-width="0.8" />
            </pattern>
          </defs>
          ${imageTag}
          ${rooms}
          ${corridors}
          ${connections}
          ${doors}
          ${approach}
          ${corridorLine}
          ${exit}
          ${transitionArrow}
          ${markers}
        </svg>
      `;
    };
    type PdfInstructionKind = 'start' | 'turn-right' | 'turn-left' | 'corridor' | 'stairs' | 'elevator' | 'arrival';
    type PdfInstruction = { text: string; kind: PdfInstructionKind };
    const renderInstructionIcon = (kind: PdfInstructionKind) => {
      if (kind === 'start') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="6.5" y="2.5" width="11" height="19" rx="4" fill="#0f172a" />
            <circle cx="12" cy="7" r="2" fill="#ef4444" />
            <circle cx="12" cy="12" r="2" fill="#f59e0b" />
            <circle cx="12" cy="17" r="2.2" fill="#22c55e" />
          </svg>
        `;
      }
      if (kind === 'turn-right') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 18V9h9" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 6l4 3-4 3" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'turn-left') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M19 18V9h-9" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 6l-4 3 4 3" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'stairs') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 18h4v-4h4v-4h4V6h4" fill="none" stroke="#0ea5e9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 3l3 3 3-3" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'elevator') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="5" y="4" width="14" height="16" rx="2.5" fill="none" stroke="#a855f7" stroke-width="2"/>
            <path d="M12 6v12" stroke="#a855f7" stroke-width="2"/>
            <path d="M9 8l1.5-1.8L12 8M15 16l-1.5 1.8L12 16" fill="none" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
      if (kind === 'arrival') {
        return `
          <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 20V4" stroke="#111827" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M6 5h12v7H6z" fill="#ffffff" stroke="#111827" stroke-width="1.8"/>
            <rect x="6" y="5" width="6" height="3.5" fill="#111827"/>
            <rect x="12" y="8.5" width="6" height="3.5" fill="#111827"/>
          </svg>
        `;
      }
      return `
        <svg viewBox="0 0 24 24" class="step-icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 12h14" stroke="#334155" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M14 8l5 4-5 4" fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    };
    const instructions: PdfInstruction[] = [];
    const firstSegment = routeResult.segments[0];
    const isDirectSameRoomRoute = routeResult.segments.length === 1 && !!firstSegment?.route?.directDashedOnly;
    if (isDirectSameRoomRoute) {
      instructions.push({
        kind: 'arrival',
        text: t({
          it: "Partenza e destinazione sono all'interno della stessa stanza.",
          en: 'Start and destination are inside the same room.'
        })
      });
    } else {
      const firstSegmentPlan = planById.get(firstSegment.planId);
      const startRoom = getRoomNameAtPoint(firstSegmentPlan, startPoint);
      const firstTurn = getTurnWord(firstSegment.route);
      if (startRoom) {
        instructions.push({ kind: 'start', text: t({ it: `Esci da ${startRoom}.`, en: `Leave ${startRoom}.` }) });
      } else {
        instructions.push({ kind: 'start', text: t({ it: `Parti da ${startLabel}.`, en: `Start from ${startLabel}.` }) });
      }
      if (firstTurn) {
        instructions.push({
          kind: firstTurn.it === 'destra' ? 'turn-right' : 'turn-left',
          text: t({ it: `Gira a ${firstTurn.it}.`, en: `Turn ${firstTurn.en}.` })
        });
      }
      for (let i = 0; i < routeResult.segments.length; i += 1) {
        const segment = routeResult.segments[i];
        const plan = planById.get(segment.planId);
        const corridorName = pickCorridorNameForSegment(plan, segment);
        const corridorPx = polylineLength(segment.route.corridorPoints || []);
        const metersPerPixel = Number(plan?.scale?.metersPerPixel);
        const corridorMeters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? corridorPx * metersPerPixel : undefined;
        const corridorSeconds = corridorMeters ? corridorMeters / SPEED_MPS : undefined;
        if (corridorPx > 0.5) {
          instructions.push({
            kind: 'corridor',
            text: t({
              it: `Percorri ${corridorName} (${segment.planName}) per ${formatDistance(corridorMeters, corridorPx)}${
                corridorSeconds ? ` (${formatEta(corridorSeconds)})` : ''
              }.`,
              en: `Follow ${corridorName} (${segment.planName}) for ${formatDistance(corridorMeters, corridorPx)}${
                corridorSeconds ? ` (${formatEta(corridorSeconds)})` : ''
              }.`
            })
          });
        }
        if (segment.endConnectionId && i < routeResult.segments.length - 1) {
          const next = routeResult.segments[i + 1];
          const action = getTransitionAction(segment.planId, next.planId);
          const typeText = segment.endTransitionType === 'elevator' ? t({ it: "l'ascensore", en: 'the elevator' }) : t({ it: 'le scale', en: 'the stairs' });
          const penalty = transitionPenaltySeconds(segment.endTransitionType);
          instructions.push({
            kind: segment.endTransitionType === 'elevator' ? 'elevator' : 'stairs',
            text: `${t(action)} ${t({ it: 'tramite', en: 'via' })} ${typeText} ${t({ it: 'verso', en: 'to' })} ${next.planName} (+${penalty}s).`
          });
        }
      }
      const lastSegment = routeResult.segments[routeResult.segments.length - 1];
      const lastSegmentPlan = planById.get(lastSegment.planId);
      const destinationRoom = getRoomNameAtPoint(lastSegmentPlan, destinationPoint);
      const destinationSide = getDestinationSideWord(lastSegment.route, destinationPoint);
      const destinationSubject = destinationRoom || destinationLabel;
      if (destinationSide) {
        instructions.push({
          kind: 'arrival',
          text: t({
            it: `${destinationSubject} si troverà sulla ${destinationSide.it}.`,
            en: `${destinationSubject} will be on the ${destinationSide.en}.`
          })
        });
      } else {
        instructions.push({ kind: 'arrival', text: t({ it: `Raggiungi ${destinationSubject}.`, en: `Reach ${destinationSubject}.` }) });
      }
    }
    const introBlock = `
      <div class="intro">
        <h1>${titleSafe}</h1>
        <div class="line"><strong>${escapeHtml(t({ it: 'Partenza', en: 'Start' }))}:</strong> ${startPathLabel}</div>
        <div class="line"><strong>${escapeHtml(t({ it: 'Destinazione', en: 'Destination' }))}:</strong> ${destinationPathLabel}</div>
        <div class="line"><strong>${escapeHtml(t({ it: 'Distanza totale', en: 'Total distance' }))}:</strong> ${totalDistanceLabel} | <strong>${escapeHtml(
      t({ it: 'Tempo calcolato', en: 'Calculated time' })
    )}:</strong> ${totalEtaLabel}</div>
      </div>
    `;
    const segmentPages = routeResult.segments
      .map((segment: any, index: number) => {
        const isFirst = index === 0;
        const isLast = index === routeResult.segments.length - 1;
        const title = isFirst && isLast
          ? t({ it: `Partenza e arrivo su ${segment.planName}`, en: `Start and arrival on ${segment.planName}` })
          : isFirst
            ? t({ it: `Partenza da ${segment.planName}`, en: `Start from ${segment.planName}` })
            : isLast
              ? t({ it: `Arrivo su ${segment.planName}`, en: `Arrival on ${segment.planName}` })
              : t({ it: `Piano da attraversare: ${segment.planName}`, en: `Transit floor: ${segment.planName}` });
        const role = isFirst && isLast
          ? t({ it: 'partenza + arrivo', en: 'start + arrival' })
          : isFirst
            ? t({ it: 'partenza', en: 'start' })
            : isLast
              ? t({ it: 'arrivo', en: 'arrival' })
              : t({ it: 'attraversamento', en: 'transit' });
        const distanceLabel = formatDistance(segment.route.distanceMeters, segment.route.distancePx);
        const etaLabel = segment.route.etaSeconds ? formatEta(segment.route.etaSeconds) : '--';
        return `
          <section class="pdf-page">
            ${index === 0 ? introBlock : ''}
            <div class="panel">
              <div class="head">
                <div>
                  <h2 class="seg-title">${escapeHtml(title)}</h2>
                  <div class="meta">${siteNameSafe} • ${escapeHtml(role)} • ${index + 1}/${routeResult.segments.length}</div>
                </div>
                <div class="stats">
                  <span>${escapeHtml(t({ it: 'Distanza', en: 'Distance' }))}: <strong>${escapeHtml(distanceLabel)}</strong></span>
                  <span>${escapeHtml(t({ it: 'Tempo', en: 'Time' }))}: <strong>${escapeHtml(etaLabel)}</strong></span>
                </div>
              </div>
              <div class="map-box">
                ${renderRouteSvg(segment, index)}
              </div>
              <div class="floor-badge">${escapeHtml(t({ it: 'Piano', en: 'Floor' }))}: ${escapeHtml(segment.planName)} (${index + 1}/${routeResult.segments.length})</div>
            </div>
          </section>
        `;
      })
      .join('');
    const instructionsItems = instructions
      .map(
        (instruction) => `
          <li class="step-item">
            <div class="step-icon">${renderInstructionIcon(instruction.kind)}</div>
            <div class="step-content">
              <div class="step-text">${escapeHtml(instruction.text)}</div>
            </div>
          </li>
        `
      )
      .join('');
    return `
      <style>
        .pdf-export-root { width: 1080px; margin: 0 auto; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .pdf-page { width: 1080px; box-sizing: border-box; padding: 18px; background: #ffffff; }
        .intro { border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; padding: 14px; margin-bottom: 12px; }
        .intro h1 { margin: 0 0 4px 0; font-size: 20px; }
        .intro .line { margin-top: 8px; font-size: 13px; color: #334155; line-height: 1.35; }
        .panel { border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; padding: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }
        .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .seg-title { margin: 0; font-size: 19px; }
        .meta { margin-top: 2px; color: #475569; font-size: 12px; }
        .stats { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #334155; text-align: right; }
        .map-box { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #e2e8f0; }
        .map-svg { width: 100%; height: auto; display: block; background: #f1f5f9; }
        .floor-badge { margin-top: 8px; font-size: 12px; color: #334155; font-weight: 600; }
        .instructions { border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; padding: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }
        .instructions h2 { margin: 0 0 10px 0; font-size: 18px; }
        .instructions ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 13px; color: #1e293b; }
        .step-item { display: grid; grid-template-columns: 46px 1fr; align-items: center; gap: 12px; border: 1px solid #dbe3ee; border-radius: 10px; background: #f8fafc; padding: 9px 11px; }
        .step-icon { width: 40px; height: 40px; border-radius: 999px; background: #ffffff; border: 1.5px solid #94a3b8; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px #ffffff; }
        .step-icon-svg { width: 28px; height: 28px; display: block; shape-rendering: geometricPrecision; }
        .step-content { display: block; }
        .step-text { line-height: 1.4; color: #0f172a; }
      </style>
      <div class="pdf-export-root">
        ${segmentPages}
        <section class="pdf-page">
          <div class="instructions">
            <h2>${escapeHtml(t({ it: 'Indicazioni passo-passo', en: 'Step-by-step directions' }))}</h2>
            <ol>${instructionsItems}</ol>
          </div>
        </section>
      </div>
    `;
};
