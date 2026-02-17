import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, CornerDownRight, DoorOpen, FileDown, Flag, Footprints, Info, Navigation, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Corridor, FloorPlan, Room } from '../../store/types';
import { useT } from '../../i18n/useT';
import { computeMultiFloorRoute, MultiFloorRouteResult, Point, RoutePlanSegment, RouteResult } from './InternalMapModal';

type ConnectionTransitionType = 'stairs' | 'elevator';

type EscapeSourceKind = 'map' | 'room' | 'corridor';

interface Props {
  open: boolean;
  plans: FloorPlan[];
  startPlanId: string;
  startPoint: Point | null;
  sourceKind: EscapeSourceKind;
  clientName?: string;
  siteName?: string;
  onClose: () => void;
}

interface EscapeDoorCandidate {
  planId: string;
  planName: string;
  corridorId: string;
  doorId: string;
  point: Point;
  label: string;
}

interface EscapeRouteSelection {
  candidate: EscapeDoorCandidate;
  result: MultiFloorRouteResult;
  score: number;
}

const SPEED_MPS = 1.4;

const polygonCentroid = (polygon: Point[]) => {
  if (!polygon.length) return { x: 0, y: 0 };
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) < 0.000001) {
    const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
};

const corridorPolygon = (corridor: Corridor): Point[] => {
  const kind = (corridor?.kind || (Array.isArray(corridor?.points) && corridor.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const points = Array.isArray(corridor?.points) ? corridor.points : [];
    if (points.length >= 3) return points;
  }
  const x = Number(corridor?.x || 0);
  const y = Number(corridor?.y || 0);
  const width = Number(corridor?.width || 0);
  const height = Number(corridor?.height || 0);
  if (!(width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

const roomPolygon = (room: Room): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (points.length >= 3) return points;
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const width = Number(room?.width || 0);
  const height = Number(room?.height || 0);
  if (!(width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

const getCorridorDoorAnchor = (corridor: Corridor, door: any): Point | null => {
  const points = corridorPolygon(corridor);
  if (points.length < 2) return null;
  const edgeIndex = Number(door?.edgeIndex);
  const t = Math.max(0, Math.min(1, Number(door?.t) || 0));
  if (!Number.isFinite(edgeIndex)) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

const getCorridorConnectionAnchor = (corridor: Corridor, connection: any): Point | null => {
  if (Number.isFinite(Number(connection?.x)) && Number.isFinite(Number(connection?.y))) {
    return { x: Number(connection.x), y: Number(connection.y) };
  }
  const points = corridorPolygon(corridor);
  if (points.length < 2) return null;
  const edgeIndex = Number(connection?.edgeIndex);
  const t = Math.max(0, Math.min(1, Number(connection?.t) || 0));
  if (!Number.isFinite(edgeIndex)) return null;
  const idx = ((Math.floor(edgeIndex) % points.length) + points.length) % points.length;
  const a = points[idx];
  const b = points[(idx + 1) % points.length];
  if (!a || !b) return null;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

const normalizeTransitionType = (value: any): ConnectionTransitionType => (String(value || '') === 'elevator' ? 'elevator' : 'stairs');

const polylineLength = (points: Point[]) => {
  let length = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
};

const formatEta = (seconds?: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '--';
  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  if (!minutes) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
};

const formatDistance = (meters?: number, px?: number) => {
  if (typeof meters === 'number' && Number.isFinite(meters)) {
    if (meters >= 100) return `${Math.round(meters)} m`;
    return `${meters.toFixed(1)} m`;
  }
  const safePx = Number(px || 0);
  return `${safePx.toFixed(1)} px`;
};

const collectRouteTravelPoints = (route: RouteResult): Point[] => {
  const output: Point[] = [];
  const append = (point: Point) => {
    const prev = output[output.length - 1];
    if (prev && Math.abs(prev.x - point.x) < 0.0001 && Math.abs(prev.y - point.y) < 0.0001) return;
    output.push(point);
  };
  for (const point of route.approachPoints || []) append(point);
  for (const point of route.corridorPoints || []) append(point);
  for (const point of route.exitPoints || []) append(point);
  return output;
};

const getArrowPolygonPoints = (from: Point, to: Point, tail = 14, wing = 5) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 0.0001) return '';
  const ux = dx / len;
  const uy = dy / len;
  const tip = { x: to.x, y: to.y };
  const base = { x: tip.x - ux * tail, y: tip.y - uy * tail };
  const left = { x: base.x - uy * wing, y: base.y + ux * wing };
  const right = { x: base.x + uy * wing, y: base.y - ux * wing };
  return `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file-read-error'));
    reader.readAsDataURL(blob);
  });

const loadImageAsDataUrl = async (src: string) => {
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

const waitForNodeImagesReady = async (node: HTMLElement) => {
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

const inlineImagesForExport = async (node: HTMLElement) => {
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

const rasterizeSvgsForExport = async (node: HTMLElement) => {
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
      // ignore decode issues
    }
    svg.replaceWith(replacement);
  }
};

const buildCaptureNode = (source: HTMLElement) => {
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

const EscapeRouteModal = ({ open, plans, startPlanId, startPoint, sourceKind, clientName, siteName, onClose }: Props) => {
  const t = useT();
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const pdfPreviewRef = useRef<HTMLDivElement | null>(null);
  const [computing, setComputing] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [routeResult, setRouteResult] = useState<MultiFloorRouteResult | null>(null);
  const [targetDoor, setTargetDoor] = useState<EscapeDoorCandidate | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const computeRunRef = useRef(0);
  const lastComputeSignatureRef = useRef('');

  const planById = useMemo(() => new Map((plans || []).map((plan) => [plan.id, plan])), [plans]);
  const sortedPlans = useMemo(
    () =>
      (plans || [])
        .slice()
        .sort((a, b) => {
          const ao = Number((a as any)?.order);
          const bo = Number((b as any)?.order);
          if (Number.isFinite(ao) && Number.isFinite(bo)) return ao - bo;
          return String(a.name || '').localeCompare(String(b.name || ''));
        }),
    [plans]
  );
  const planOrder = useMemo(() => new Map(sortedPlans.map((plan, index) => [plan.id, index])), [sortedPlans]);

  const emergencyDoorCandidates = useMemo(() => {
    const list: EscapeDoorCandidate[] = [];
    for (const plan of plans || []) {
      for (const corridor of (plan.corridors || []) as Corridor[]) {
        for (const door of corridor.doors || []) {
          const isEmergency = !!(door as any)?.isEmergency;
          const isExternal = !!(door as any)?.isExternal;
          if (!isEmergency || !isExternal) continue;
          const anchor = getCorridorDoorAnchor(corridor, door);
          if (!anchor) continue;
          const description = String((door as any)?.description || '').trim();
          list.push({
            planId: plan.id,
            planName: String(plan.name || plan.id),
            corridorId: corridor.id,
            doorId: door.id,
            point: anchor,
            label: description
          });
        }
      }
    }
    return list;
  }, [plans]);

  const activeRouteSegment = useMemo(() => {
    if (!routeResult || !routeResult.segments.length) return null;
    const safeIndex = Math.max(0, Math.min(routeResult.segments.length - 1, activeSegmentIndex));
    return routeResult.segments[safeIndex] || null;
  }, [activeSegmentIndex, routeResult]);
  const activeRoutePlan = useMemo(
    () => (activeRouteSegment ? planById.get(activeRouteSegment.planId) || null : null),
    [activeRouteSegment, planById]
  );
  const mapPlan = activeRoutePlan || (startPlanId ? planById.get(startPlanId) || null : null);
  const mapWidth = Number(mapPlan?.width || 0) > 0 ? Number(mapPlan?.width) : 1600;
  const mapHeight = Number(mapPlan?.height || 0) > 0 ? Number(mapPlan?.height) : 900;
  const routeSegmentCount = routeResult?.segments.length || 0;
  const routeIsMultiFloor = routeSegmentCount > 1;

  const routeMetrics = useMemo(() => {
    if (!routeResult) return null;
    return {
      distanceLabel: formatDistance(routeResult.distanceMeters, routeResult.distancePx),
      etaLabel: routeResult.etaSeconds ? formatEta(routeResult.etaSeconds) : '--',
      transitionLabel: routeResult.transitionSeconds > 0 ? formatEta(routeResult.transitionSeconds) : null
    };
  }, [routeResult]);

  const sourceLabel = useMemo(() => {
    if (sourceKind === 'room') return t({ it: 'Punto selezionato in stanza', en: 'Selected point in room' });
    if (sourceKind === 'corridor') return t({ it: 'Punto selezionato in corridoio', en: 'Selected point in corridor' });
    return t({ it: 'Punto selezionato su mappa', en: 'Selected point on map' });
  }, [sourceKind, t]);
  const targetDoorLabel = useMemo(
    () => targetDoor?.label || t({ it: 'Uscita emergenza esterna', en: 'External emergency exit' }),
    [targetDoor?.label, t]
  );

  const escapeInstructions = useMemo(() => {
    if (!routeResult || !targetDoor) return [] as Array<{ icon: 'start' | 'route' | 'stairs' | 'arrival'; text: string }>;
    const items: Array<{ icon: 'start' | 'route' | 'stairs' | 'arrival'; text: string }> = [
      {
        icon: 'start',
        text: t({ it: 'Parti dal punto selezionato e segui la freccia di direzione sulla mappa.', en: 'Start from the selected point and follow the direction arrow on the map.' })
      }
    ];
    for (let i = 0; i < routeResult.segments.length; i += 1) {
      const segment = routeResult.segments[i];
      const plan = planById.get(segment.planId);
      const corridorPx = polylineLength(segment.route.corridorPoints || []);
      if (corridorPx > 0.4) {
        const metersPerPixel = Number(plan?.scale?.metersPerPixel);
        const meters = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? corridorPx * metersPerPixel : undefined;
        const eta = meters ? meters / SPEED_MPS : undefined;
        items.push({
          icon: 'route',
          text: t({
            it: `Percorri il corridoio su ${segment.planName} per ${formatDistance(meters, corridorPx)}${eta ? ` (${formatEta(eta)})` : ''}.`,
            en: `Follow the corridor on ${segment.planName} for ${formatDistance(meters, corridorPx)}${eta ? ` (${formatEta(eta)})` : ''}.`
          })
        });
      }
      if (segment.endConnectionId && i < routeResult.segments.length - 1) {
        const next = routeResult.segments[i + 1];
        const fromIdx = planOrder.get(segment.planId);
        const toIdx = planOrder.get(next.planId);
        const action = Number.isFinite(fromIdx) && Number.isFinite(toIdx) && Number(toIdx) < Number(fromIdx)
          ? t({ it: 'Scendi', en: 'Go down' })
          : t({ it: 'Sali', en: 'Go up' });
        items.push({
          icon: 'stairs',
          text: t({ it: `${action} tramite scale verso ${next.planName} (+15s).`, en: `${action} using stairs to ${next.planName} (+15s).` })
        });
      }
    }
    items.push({
      icon: 'arrival',
      text: t({
        it: `Raggiungi ${targetDoor.label || t({ it: 'uscita emergenza esterna', en: 'external emergency exit' })} su ${targetDoor.planName}.`,
        en: `Reach ${targetDoor.label || t({ it: 'uscita emergenza esterna', en: 'external emergency exit' })} on ${targetDoor.planName}.`
      })
    });
    return items;
  }, [planById, planOrder, routeResult, t, targetDoor]);

  useEffect(() => {
    if (!open) {
      computeRunRef.current += 1;
      lastComputeSignatureRef.current = '';
      setComputing(false);
      setRouteError('');
      setRouteResult(null);
      setTargetDoor(null);
      setActiveSegmentIndex(0);
      setPdfPreviewOpen(false);
      setPdfExporting(false);
      return;
    }
    if (!startPoint || !startPlanId) {
      setRouteError(t({ it: 'Punto di partenza non valido.', en: 'Invalid start point.' }));
      setRouteResult(null);
      setTargetDoor(null);
      setActiveSegmentIndex(0);
      return;
    }
    const signature = `${startPlanId}|${Number(startPoint.x.toFixed(2))},${Number(startPoint.y.toFixed(2))}|${plans
      .map((plan) => String(plan.id))
      .join(',')}|${emergencyDoorCandidates.length}`;
    if (lastComputeSignatureRef.current === signature) return;
    lastComputeSignatureRef.current = signature;
    const runId = computeRunRef.current + 1;
    computeRunRef.current = runId;
    setRouteError('');
    setComputing(true);
    setRouteResult(null);
    setTargetDoor(null);
    setActiveSegmentIndex(0);
    const timer = window.setTimeout(() => {
      try {
        if (runId !== computeRunRef.current) return;
        if (!emergencyDoorCandidates.length) {
          setRouteError(
            t({
              it: 'Nessuna porta con opzioni Emergenza + Esterno configurata. Imposta almeno una porta di uscita.',
              en: 'No door configured with Emergency + External options. Configure at least one exit door.'
            })
          );
          setRouteResult(null);
          setTargetDoor(null);
          return;
        }
        const startPlan = planById.get(startPlanId);
        const sameFloorCandidates = emergencyDoorCandidates.filter((candidate) => candidate.planId === startPlanId);
        const bestByScore = (
          current: EscapeRouteSelection | null,
          candidate: EscapeDoorCandidate,
          result: MultiFloorRouteResult
        ) => {
          const eta = Number(result.etaSeconds);
          const score = Number.isFinite(eta) && eta > 0 ? eta : Number(result.distancePx || Number.POSITIVE_INFINITY);
          if (!current || score < current.score) return { candidate, result, score };
          return current;
        };

        let best: EscapeRouteSelection | null = null;

        // Fast path: if at least one valid external emergency exit is on the start floor,
        // compute only same-floor routes first and return immediately if one is found.
        if (startPlan && sameFloorCandidates.length) {
          const localPlanSet = [startPlan];
          for (const candidate of sameFloorCandidates) {
            if (runId !== computeRunRef.current) return;
            const computed = computeMultiFloorRoute(
              localPlanSet,
              startPlanId,
              candidate.planId,
              startPoint,
              candidate.point,
              { allowedTransitionTypes: ['stairs'] }
            );
            if (!computed.result) continue;
            best = bestByScore(best, candidate, computed.result);
          }
          if (best) {
            setRouteResult(best.result);
            setTargetDoor(best.candidate);
            setActiveSegmentIndex(0);
            setRouteError('');
            return;
          }
        }

        const startPlanOrder = Number(planOrder.get(startPlanId) ?? 0);
        const prioritizedOtherFloors = emergencyDoorCandidates
          .filter((candidate) => candidate.planId !== startPlanId)
          .map((candidate) => {
            const floorOrder = Number(planOrder.get(candidate.planId) ?? startPlanOrder);
            const floorDelta = Math.abs(floorOrder - startPlanOrder);
            const linearDist = Math.hypot(candidate.point.x - startPoint.x, candidate.point.y - startPoint.y);
            return {
              candidate,
              rank: floorDelta * 5000 + linearDist
            };
          })
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 24)
          .map((entry) => entry.candidate);

        const deadline = Date.now() + 15000;
        for (let i = 0; i < prioritizedOtherFloors.length; i += 1) {
          if (runId !== computeRunRef.current) return;
          if (Date.now() > deadline) break;
          const candidate = prioritizedOtherFloors[i];
          const computed = computeMultiFloorRoute(
            plans,
            startPlanId,
            candidate.planId,
            startPoint,
            candidate.point,
            { allowedTransitionTypes: ['stairs'] }
          );
          if (!computed.result) continue;
          best = bestByScore(best, candidate, computed.result);
        }
        if (!best) {
          setRouteError(
            t({
              it: 'Via di fuga non trovata. Verifica corridoi, collegamenti tra piani e presenza di scale collegate.',
              en: 'Escape route not found. Check corridors, floor links, and connected stairs.'
            })
          );
          setRouteResult(null);
          setTargetDoor(null);
        } else {
          setRouteResult(best.result);
          setTargetDoor(best.candidate);
          setActiveSegmentIndex(0);
        }
      } catch {
        setRouteError(t({ it: 'Errore nel calcolo della via di fuga.', en: 'Error while computing the escape route.' }));
        setRouteResult(null);
        setTargetDoor(null);
      } finally {
        if (runId === computeRunRef.current) setComputing(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [emergencyDoorCandidates, open, plans, startPlanId, startPoint, t]);

  const close = () => {
    if (pdfExporting) return;
    setPdfPreviewOpen(false);
    onClose();
  };

  const handleMainDialogClose = () => {
    if (pdfPreviewOpen || pdfExporting) return;
    close();
  };

  const renderRooms = (plan: FloorPlan | null | undefined) =>
    (plan?.rooms || []).map((room) => {
      const polygon = roomPolygon(room);
      if (polygon.length < 3) return null;
      const points = polygon.map((point) => `${point.x},${point.y}`).join(' ');
      const center = polygonCentroid(polygon);
      const label = String(room.name || '').trim() || t({ it: 'Ufficio', en: 'Office' });
      return (
        <g key={`room:${room.id}`}>
          <polygon points={points} fill="rgba(59,130,246,0.12)" stroke="rgba(37,99,235,0.65)" strokeWidth={1.2} />
          <text x={center.x} y={center.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#1e3a8a" stroke="#ffffff" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
            {label}
          </text>
        </g>
      );
    });

  const renderCorridors = (plan: FloorPlan | null | undefined, patternId: string) =>
    ((plan?.corridors || []) as Corridor[]).map((corridor) => {
      const polygon = corridorPolygon(corridor);
      if (polygon.length < 3) return null;
      const points = polygon.map((point) => `${point.x},${point.y}`).join(' ');
      return <polygon key={`corridor:${corridor.id}`} points={points} fill={`url(#${patternId})`} stroke="rgba(15,118,110,0.9)" strokeDasharray="5 4" strokeWidth={1.4} />;
    });

  const renderDoors = (plan: FloorPlan | null | undefined) =>
    ((plan?.corridors || []) as Corridor[]).flatMap((corridor) =>
      (corridor.doors || []).map((door) => {
        const anchor = getCorridorDoorAnchor(corridor, door);
        if (!anchor) return null;
        const isEscapeDoor = targetDoor && targetDoor.planId === plan?.id && targetDoor.doorId === String((door as any)?.id);
        return (
          <g key={`door:${corridor.id}:${(door as any).id}`} transform={`translate(${anchor.x},${anchor.y})`}>
            <rect x={-2.4} y={-4.2} width={4.8} height={8.4} rx={0.9} fill={isEscapeDoor ? '#dcfce7' : '#fff7ed'} stroke={isEscapeDoor ? '#166534' : '#9a3412'} strokeWidth={0.9} />
            <line x1={0} y1={-4.2} x2={0} y2={4.2} stroke={isEscapeDoor ? '#166534' : '#9a3412'} strokeWidth={0.8} />
            <circle cx={0.9} cy={0} r={0.55} fill={isEscapeDoor ? '#166534' : '#9a3412'} />
            {!!(door as any)?.isEmergency ? <circle cx={3.2} cy={-3.8} r={1.3} fill="#dc2626" stroke="#ffffff" strokeWidth={0.6} /> : null}
            {!!(door as any)?.isExternal ? <circle cx={-3.2} cy={-3.8} r={1.3} fill="#16a34a" stroke="#ffffff" strokeWidth={0.6} /> : null}
          </g>
        );
      })
    );

  const renderConnections = (plan: FloorPlan | null | undefined) =>
    ((plan?.corridors || []) as Corridor[]).flatMap((corridor) =>
      (corridor.connections || []).map((connection) => {
        const anchor = getCorridorConnectionAnchor(corridor, connection);
        if (!anchor) return null;
        const type = normalizeTransitionType((connection as any)?.transitionType);
        return (
          <g key={`conn:${corridor.id}:${connection.id}`} transform={`translate(${anchor.x},${anchor.y})`}>
            <circle cx={0} cy={0} r={6.5} fill={type === 'elevator' ? '#a855f7' : '#0ea5e9'} stroke="#ffffff" strokeWidth={1.6} />
            <text x={0} y={0.5} textAnchor="middle" dominantBaseline="middle" fontSize={8.5} fontWeight={800} fill="#ffffff">
              {type === 'elevator' ? 'E' : 'S'}
            </text>
          </g>
        );
      })
    );

  const renderTransitionDirectionArrow = (segment: RoutePlanSegment | null) => {
    if (!segment?.endConnectionId) return null;
    const points = collectRouteTravelPoints(segment.route);
    if (points.length < 2) return null;
    const arrow = getArrowPolygonPoints(points[points.length - 2], points[points.length - 1], 14, 5);
    if (!arrow) return null;
    return <polygon points={arrow} fill="#f97316" stroke="#7c2d12" strokeWidth={1} />;
  };

  const renderStartDirectionArrow = (segment: RoutePlanSegment | null) => {
    if (!segment) return null;
    const points = collectRouteTravelPoints(segment.route);
    if (points.length < 2) return null;
    const arrow = getArrowPolygonPoints(points[0], points[1], 16, 6);
    if (!arrow) return null;
    return <polygon points={arrow} fill="#2563eb" stroke="#1e3a8a" strokeWidth={1} />;
  };

  const renderRouteSvg = (segment: RoutePlanSegment, opts?: { includeDirectionArrow?: boolean }) => {
    const plan = planById.get(segment.planId) || null;
    const width = Number(plan?.width || 0) > 0 ? Number(plan?.width) : 1600;
    const height = Number(plan?.height || 0) > 0 ? Number(plan?.height) : 900;
    const patternId = `escape-grid-${segment.planId}`;
    const route = segment.route;
    const segmentIdx = routeResult?.segments.findIndex((x) => x.planId === segment.planId && x.startPoint === segment.startPoint) ?? -1;
    const isFirst = segmentIdx === 0;
    const isLast = segmentIdx === Math.max(0, (routeResult?.segments.length || 1) - 1);
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block bg-slate-100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
            <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
            <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
          </pattern>
        </defs>
        {plan?.imageUrl ? <image href={plan.imageUrl} x={0} y={0} width={width} height={height} preserveAspectRatio="none" opacity={0.72} /> : null}
        {renderRooms(plan)}
        {renderCorridors(plan, patternId)}
        {renderConnections(plan)}
        {renderDoors(plan)}
        {route.approachPoints?.length ? <polyline points={route.approachPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {route.corridorPoints?.length ? <polyline points={route.corridorPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#dc2626" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {route.exitPoints?.length ? <polyline points={route.exitPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {renderTransitionDirectionArrow(segment)}
        {opts?.includeDirectionArrow && isFirst ? renderStartDirectionArrow(segment) : null}
        {startPoint && isFirst ? (
          <g>
            <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
            <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">A</text>
          </g>
        ) : null}
        {targetDoor && isLast ? (
          <g>
            <circle cx={targetDoor.point.x} cy={targetDoor.point.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
            <text x={targetDoor.point.x + 10} y={targetDoor.point.y - 10} fontSize={12} fontWeight={700} fill="#14532d">B</text>
          </g>
        ) : null}
        {!route.directDashedOnly ? (
          <>
            <circle cx={route.startDoor.x} cy={route.startDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
            <circle cx={route.endDoor.x} cy={route.endDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
          </>
        ) : null}
      </svg>
    );
  };

  const openPdfPreview = () => {
    if (!routeResult || !targetDoor) {
      setRouteError(t({ it: 'Calcola prima la via di fuga.', en: 'Compute the escape route first.' }));
      return;
    }
    setRouteError('');
    setPdfPreviewOpen(true);
  };

  const confirmRoutePdfExport = async () => {
    if (!pdfPreviewRef.current) return;
    setPdfExporting(true);
    try {
      const pages = Array.from(pdfPreviewRef.current.querySelectorAll('[data-escape-pdf-page="true"]')) as HTMLElement[];
      if (!pages.length) {
        setRouteError(t({ it: 'Nessuna pagina disponibile per l\'export PDF.', en: 'No pages available for PDF export.' }));
        return;
      }
      const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const targetW = pageW - margin * 2;
      const targetH = pageH - margin * 2;
      let printedPages = 0;
      for (let i = 0; i < pages.length; i += 1) {
        const pageNode = pages[i];
        const capture = buildCaptureNode(pageNode);
        let canvas: HTMLCanvasElement | null = null;
        try {
          await inlineImagesForExport(capture.node);
          await rasterizeSvgsForExport(capture.node);
          await waitForNodeImagesReady(capture.node);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            })
          );
          canvas = await html2canvas(capture.node, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
        } finally {
          capture.host.remove();
        }
        if (!canvas) continue;
        if (printedPages > 0) pdf.addPage();
        const ratio = Math.min(targetW / canvas.width, targetH / canvas.height);
        const drawW = canvas.width * ratio;
        const drawH = canvas.height * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
        printedPages += 1;
      }
      if (!printedPages) {
        setRouteError(t({ it: 'Nessuna pagina disponibile per l\'export PDF.', en: 'No pages available for PDF export.' }));
        return;
      }
      const fileDate = new Date().toISOString().slice(0, 10);
      const fileName = `via-di-fuga-${fileDate}.pdf`;
      let exported = false;
      try {
        const blob = pdf.output('blob');
        if (blob && blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          anchor.rel = 'noopener';
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 2000);
          exported = true;
        }
      } catch {
        exported = false;
      }
      if (!exported) {
        pdf.save(fileName);
      }
    } catch {
      setRouteError(t({ it: 'Impossibile generare il PDF della via di fuga.', en: 'Unable to generate the escape-route PDF.' }));
    } finally {
      setPdfExporting(false);
    }
  };

  const hasRoute = !!routeResult && !!targetDoor;
  const canMovePrev = activeSegmentIndex > 0;
  const canMoveNext = routeSegmentCount > 0 && activeSegmentIndex < routeSegmentCount - 1;

  const getSegmentRoleLabel = (index: number, total: number) => {
    if (total <= 1) return t({ it: 'partenza + arrivo', en: 'start + arrival' });
    if (index === 0) return t({ it: 'partenza', en: 'start' });
    if (index === total - 1) return t({ it: 'arrivo', en: 'arrival' });
    return t({ it: 'attraversamento', en: 'transit' });
  };

  return (
    <>
      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleMainDialogClose}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-180" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-120" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-7xl rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Via di fuga', en: 'Escape route' })}</Dialog.Title>
                      <Dialog.Description className="modal-description">
                        {t({
                          it: 'Percorso più rapido verso la porta più vicina con Emergenza + Esterno. Nei cambi piano usa solo scale.',
                          en: 'Fastest route to the nearest door with Emergency + External options. Floor transitions use stairs only.'
                        })}
                      </Dialog.Description>
                    </div>
                    <button onClick={close} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <Info size={13} /> {t({ it: 'Dettagli', en: 'Details' })}
                    </span>
                    <span className="ml-2">
                      {t({
                        it: 'Partenza dal punto selezionato con click destro. L\'algoritmo valuta tutte le uscite Emergenza+Esterno e sceglie il tempo minore.',
                        en: 'Start from the right-click selected point. The algorithm evaluates all Emergency+External exits and picks the minimum-time route.'
                      })}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[360px,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Via di fuga', en: 'Escape route' })}</div>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Partenza', en: 'Start' })}</span>
                          <span>{startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-'}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{sourceLabel}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Destinazione', en: 'Destination' })}</span>
                          <span>{targetDoor ? targetDoor.planName : '-'}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{targetDoor ? targetDoorLabel : '-'}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Distanza', en: 'Distance' })}</span>
                          <span>{routeMetrics?.distanceLabel || '--'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Tempo stimato', en: 'Estimated time' })}</span>
                          <span>{routeMetrics?.etaLabel || '--'}</span>
                        </div>
                        {routeMetrics?.transitionLabel ? (
                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-semibold text-slate-700">{t({ it: 'Tempo cambi piano', en: 'Floor-change time' })}</span>
                            <span>{routeMetrics.transitionLabel}</span>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Piano attuale', en: 'Current floor' })}</span>
                          <span>
                            {mapPlan?.name || '-'} {routeIsMultiFloor ? `(${Math.max(1, activeSegmentIndex + 1)}/${routeSegmentCount})` : ''}
                          </span>
                        </div>
                      </div>

                      {computing ? (
                        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                          {t({ it: 'Calcolo via di fuga in corso...', en: 'Computing escape route...' })}
                        </div>
                      ) : null}
                      {routeError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</div> : null}

                      {escapeInstructions.length ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                          <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">{t({ it: 'Indicazioni', en: 'Directions' })}</div>
                          <ol className="space-y-2">
                            {escapeInstructions.map((item, index) => (
                              <li key={`escape-step-${index}`} className="flex items-start gap-2">
                                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                                  {item.icon === 'start' ? (
                                    <Footprints size={12} />
                                  ) : item.icon === 'route' ? (
                                    <Navigation size={12} />
                                  ) : item.icon === 'stairs' ? (
                                    <CornerDownRight size={12} />
                                  ) : (
                                    <Flag size={12} />
                                  )}
                                </span>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                    </div>

                    <div ref={mapPanelRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      {activeRouteSegment ? (
                        renderRouteSvg(activeRouteSegment, { includeDirectionArrow: true })
                      ) : (
                        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="h-[62vh] w-full bg-slate-100">
                          {mapPlan?.imageUrl ? <image href={mapPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} /> : null}
                          {renderRooms(mapPlan)}
                          {renderCorridors(mapPlan, 'escape-grid-empty')}
                          {renderConnections(mapPlan)}
                          {renderDoors(mapPlan)}
                          {startPoint ? (
                            <g>
                              <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                              <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">A</text>
                            </g>
                          ) : null}
                        </svg>
                      )}
                      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                        {t({ it: 'Piano', en: 'Floor' })}: {mapPlan?.name || '-'} {routeIsMultiFloor ? `(${Math.max(1, activeSegmentIndex + 1)}/${routeSegmentCount})` : ''}
                      </div>
                      {routeIsMultiFloor ? (
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveSegmentIndex((prev) => Math.max(0, prev - 1))}
                            disabled={!canMovePrev}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={t({ it: 'Piano precedente', en: 'Previous floor' })}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSegmentIndex((prev) => Math.min(routeSegmentCount - 1, prev + 1))}
                            disabled={!canMoveNext}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={t({ it: 'Piano successivo', en: 'Next floor' })}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <DoorOpen size={14} />
                      {t({
                        it: 'Le porte valide per la via di fuga devono avere Emergenza e Esterno attivi; i passaggi inter-piano usano esclusivamente Scale.',
                        en: 'Valid escape doors must have Emergency and External enabled; inter-floor transitions use Stairs only.'
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openPdfPreview}
                        disabled={!hasRoute}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title={t({ it: 'Apri anteprima PDF', en: 'Open PDF preview' })}
                      >
                        <FileDown size={14} />
                        {t({ it: 'Anteprima PDF', en: 'PDF preview' })}
                      </button>
                      <button type="button" onClick={close} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        {t({ it: 'Chiudi', en: 'Close' })}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={pdfPreviewOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[70]" onClose={() => (pdfExporting ? undefined : setPdfPreviewOpen(false))}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-180" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-120" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-[1200px] rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-slate-900">{t({ it: 'Anteprima PDF via di fuga', en: 'Escape route PDF preview' })}</Dialog.Title>
                      <p className="mt-1 text-xs text-slate-600">{t({ it: 'Verifica il risultato e poi esporta in PDF.', en: 'Review the result, then export to PDF.' })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={confirmRoutePdfExport}
                        disabled={pdfExporting || !hasRoute}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FileDown size={14} />
                        {pdfExporting ? t({ it: 'Esportazione...', en: 'Exporting...' }) : t({ it: 'Stampa / Salva PDF', en: 'Print / Save PDF' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfPreviewOpen(false)}
                        disabled={pdfExporting}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t({ it: 'Chiudi', en: 'Close' })}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-[78vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3">
                    <div ref={pdfPreviewRef} className="mx-auto w-[1080px] max-w-full space-y-4">
                      {hasRoute ? (
                        <>
                          {(routeResult?.segments || []).map((segment, index, all) => {
                            const isFirst = index === 0;
                            const isLast = index === all.length - 1;
                            const title = isFirst && isLast
                              ? t({ it: `Partenza e arrivo su ${segment.planName}`, en: `Start and arrival on ${segment.planName}` })
                              : isFirst
                                ? t({ it: `Partenza da ${segment.planName}`, en: `Start from ${segment.planName}` })
                                : isLast
                                  ? t({ it: `Arrivo su ${segment.planName}`, en: `Arrival on ${segment.planName}` })
                                  : t({ it: `Piano da attraversare: ${segment.planName}`, en: `Transit floor: ${segment.planName}` });
                            const role = getSegmentRoleLabel(index, all.length);
                            return (
                              <section key={`escape-pdf-segment-${segment.planId}-${index}`} data-escape-pdf-page="true" className="w-[1080px] rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                                {index === 0 ? (
                                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                                    <div className="text-lg font-semibold text-slate-900">{t({ it: 'Via di fuga', en: 'Escape route' })}</div>
                                    <div className="mt-2">
                                      <strong>{t({ it: 'Partenza', en: 'Start' })}:</strong>{' '}
                                      {`${clientName || '-'} > ${siteName || '-'} > ${planById.get(startPlanId)?.name || startPlanId} > ${sourceLabel}`}
                                    </div>
                                    <div className="mt-1">
                                      <strong>{t({ it: 'Destinazione', en: 'Destination' })}:</strong>{' '}
                                      {`${clientName || '-'} > ${siteName || '-'} > ${targetDoor?.planName || '-'} > ${targetDoor ? targetDoorLabel : '-'}`}
                                    </div>
                                    <div className="mt-1">
                                      <strong>{t({ it: 'Distanza totale', en: 'Total distance' })}:</strong> {routeMetrics?.distanceLabel || '--'} | <strong>{t({ it: 'Tempo calcolato', en: 'Calculated time' })}:</strong> {routeMetrics?.etaLabel || '--'}
                                    </div>
                                  </div>
                                ) : null}
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                                    <div className="text-xs text-slate-600">{siteName || '-'} • {role} • {index + 1}/{all.length}</div>
                                  </div>
                                  <div className="text-right text-xs text-slate-700">
                                    <div>{t({ it: 'Distanza', en: 'Distance' })}: <strong>{formatDistance(segment.route.distanceMeters, segment.route.distancePx)}</strong></div>
                                    <div>{t({ it: 'Tempo', en: 'Time' })}: <strong>{segment.route.etaSeconds ? formatEta(segment.route.etaSeconds) : '--'}</strong></div>
                                  </div>
                                </div>
                                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                  {renderRouteSvg(segment, { includeDirectionArrow: true })}
                                </div>
                                <div className="mt-2 text-xs font-semibold text-slate-700">{t({ it: 'Piano', en: 'Floor' })}: {segment.planName} ({index + 1}/{all.length})</div>
                              </section>
                            );
                          })}

                          <section data-escape-pdf-page="true" className="w-[1080px] rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                            <h3 className="text-xl font-semibold text-slate-900">{t({ it: 'Indicazioni passo-passo', en: 'Step-by-step directions' })}</h3>
                            <ol className="mt-3 space-y-2 text-sm text-slate-800">
                              {escapeInstructions.map((item, index) => (
                                <li key={`escape-pdf-step-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">
                                    {item.icon === 'start' ? (
                                      <Footprints size={16} />
                                    ) : item.icon === 'route' ? (
                                      <Navigation size={16} />
                                    ) : item.icon === 'stairs' ? (
                                      <CornerDownRight size={16} />
                                    ) : (
                                      <Flag size={16} />
                                    )}
                                  </span>
                                  <span>{item.text}</span>
                                </li>
                              ))}
                            </ol>
                          </section>
                        </>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{t({ it: 'Nessun contenuto da esportare.', en: 'No content to export.' })}</div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default EscapeRouteModal;
