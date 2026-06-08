import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, Crosshair, FileDown, Info, MapPin, Maximize2, Minimize2, Navigation, Route, Search, Server, Trash2, User, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { waitForNodeImagesReady, inlineImagesForExport, rasterizeSvgsForExport, buildCaptureNode, buildRoutePdfPreviewHtml as buildRoutePdfPreviewHtmlImpl } from './internalMapPdfExport';
import { Client, Corridor, FloorPlan, Room } from '../../store/types';
import { useLang, useT } from '../../i18n/useT';

import {
  MultiFloorRouteResult,
  Point,
  RouteResult,
  SearchEntry,
  computeMultiFloorRoute,
  corridorPolygon,
  formatEta,
  getCorridorConnectionAnchor,
  getCorridorDoorAnchor,
  normalizeTransitionType,
  polygonCentroid,
  roomPolygon
} from './internalMapRouting';

interface Props {
  open: boolean;
  clients: Client[];
  objectTypeLabels: Record<string, string>;
  initialLocation?: { clientId?: string; siteId?: string; planId?: string };
  onClose: () => void;
}

const InternalMapModal = ({ open, clients, objectTypeLabels, initialLocation, onClose }: Props) => {
  const t = useT();
  const lang = useLang();
  const getRoomLabel = (room: Room, fallback = '') => {
    const itName = String(room?.name || '').trim();
    const enName = String((room as any)?.nameEn || '').trim();
    if (lang === 'en') return enName || itName || fallback;
    return itName || enName || fallback;
  };
  const getCorridorLabel = (corridor: Corridor, fallback = '') => {
    const itName = String(corridor?.name || '').trim();
    const enName = String((corridor as any)?.nameEn || '').trim();
    if (lang === 'en') return enName || itName || fallback;
    return itName || enName || fallback;
  };
  const patternId = useId().replace(/:/g, '-');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const pdfPreviewRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [startPlanId, setStartPlanId] = useState('');
  const [destinationPlanId, setDestinationPlanId] = useState('');
  const [startMode, setStartMode] = useState<'map' | 'search'>('map');
  const [startQuery, setStartQuery] = useState('');
  const [selectedStartEntryId, setSelectedStartEntryId] = useState<string>('');
  const [startPointSource, setStartPointSource] = useState<'map' | 'search' | null>(null);
  const [destinationMode, setDestinationMode] = useState<'map' | 'search'>('map');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedDestinationEntryId, setSelectedDestinationEntryId] = useState<string>('');
  const [destinationPointSource, setDestinationPointSource] = useState<'map' | 'search' | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<Point | null>(null);
  const [routeResult, setRouteResult] = useState<MultiFloorRouteResult | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [routeError, setRouteError] = useState<string>('');
  const [computing, setComputing] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState('');
  const [pdfPreparing, setPdfPreparing] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const clientsWithPlans = useMemo(
    () => (clients || []).filter((client) => (client.sites || []).some((site) => (site.floorPlans || []).length > 0)),
    [clients]
  );

  const selectedClient = useMemo(
    () => clientsWithPlans.find((client) => client.id === selectedClientId),
    [clientsWithPlans, selectedClientId]
  );
  const availableSites = useMemo(() => (selectedClient?.sites || []).filter((site) => (site.floorPlans || []).length > 0), [selectedClient?.sites]);
  const selectedSite = useMemo(() => availableSites.find((site) => site.id === selectedSiteId), [availableSites, selectedSiteId]);
  const availablePlans = useMemo(() => selectedSite?.floorPlans || [], [selectedSite?.floorPlans]);
  const startPlan = useMemo(() => availablePlans.find((plan) => plan.id === startPlanId), [availablePlans, startPlanId]);
  const destinationPlan = useMemo(
    () => availablePlans.find((plan) => plan.id === destinationPlanId),
    [availablePlans, destinationPlanId]
  );
  const activeRouteSegment = useMemo(() => {
    if (!routeResult) return null;
    if (!routeResult.segments.length) return null;
    const safeIndex = Math.max(0, Math.min(routeResult.segments.length - 1, activeSegmentIndex));
    return routeResult.segments[safeIndex] || null;
  }, [activeSegmentIndex, routeResult]);
  const activeRoutePlan = useMemo(
    () => availablePlans.find((plan) => plan.id === activeRouteSegment?.planId) || null,
    [activeRouteSegment?.planId, availablePlans]
  );
  const mapPlan = step === 1 ? startPlan : step === 2 ? destinationPlan : (activeRoutePlan || destinationPlan || startPlan || null);
  const mapWidth = Number(mapPlan?.width || 0) > 0 ? Number(mapPlan?.width) : 1600;
  const mapHeight = Number(mapPlan?.height || 0) > 0 ? Number(mapPlan?.height) : 900;
  const activeRoute = activeRouteSegment?.route || null;
  const routeSegmentCount = routeResult?.segments.length || 0;
  const routeIsMultiFloor = routeSegmentCount > 1;

  useEffect(() => {
    if (!open) return;
    const initialClient = initialLocation?.clientId && clientsWithPlans.some((client) => client.id === initialLocation.clientId)
      ? initialLocation.clientId
      : clientsWithPlans[0]?.id || '';
    const clientEntity = clientsWithPlans.find((client) => client.id === initialClient);
    const initialSite = initialLocation?.siteId && clientEntity?.sites.some((site) => site.id === initialLocation.siteId)
      ? initialLocation.siteId
      : (clientEntity?.sites || []).find((site) => (site.floorPlans || []).length > 0)?.id || '';
    const siteEntity = clientEntity?.sites.find((site) => site.id === initialSite);
    const initialPlan = initialLocation?.planId && siteEntity?.floorPlans.some((plan) => plan.id === initialLocation.planId)
      ? initialLocation.planId
      : siteEntity?.floorPlans?.[0]?.id || '';
    setSelectedClientId(initialClient);
    setSelectedSiteId(initialSite);
    setStartPlanId(initialPlan);
    setDestinationPlanId(initialPlan);
    setStep(1);
    setStartMode('map');
    setStartQuery('');
    setSelectedStartEntryId('');
    setStartPointSource(null);
    setDestinationMode('map');
    setDestinationQuery('');
    setSelectedDestinationEntryId('');
    setDestinationPointSource(null);
    setStartPoint(null);
    setDestinationPoint(null);
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
    setComputing(false);
    setPdfPreviewOpen(false);
    setPdfPreviewHtml('');
    setPdfPreparing(false);
    setPdfExporting(false);
  }, [clientsWithPlans, initialLocation?.clientId, initialLocation?.planId, initialLocation?.siteId, open]);

  useEffect(() => {
    if (!selectedClient) {
      setSelectedSiteId('');
      setStartPlanId('');
      setDestinationPlanId('');
      return;
    }
    if (!availableSites.find((site) => site.id === selectedSiteId)) {
      const nextSiteId = availableSites[0]?.id || '';
      setSelectedSiteId(nextSiteId);
      const nextPlanId = (availableSites[0]?.floorPlans || [])[0]?.id || '';
      setStartPlanId(nextPlanId);
      setDestinationPlanId(nextPlanId);
    }
  }, [availableSites, selectedClient, selectedSiteId]);

  useEffect(() => {
    if (!selectedSite) {
      setStartPlanId('');
      setDestinationPlanId('');
      return;
    }
    if (!availablePlans.find((plan) => plan.id === startPlanId)) {
      const fallbackPlanId = availablePlans[0]?.id || '';
      setStartPlanId(fallbackPlanId);
      if (!availablePlans.find((plan) => plan.id === destinationPlanId)) {
        setDestinationPlanId(fallbackPlanId);
      }
      return;
    }
    if (!availablePlans.find((plan) => plan.id === destinationPlanId)) {
      setDestinationPlanId(startPlanId || availablePlans[0]?.id || '');
    }
  }, [availablePlans, destinationPlanId, selectedSite, startPlanId]);

  const buildSearchEntries = (plan: FloorPlan | null | undefined) => {
    if (!plan) return [] as SearchEntry[];
    const entries: SearchEntry[] = [];
    const roomNameById = new Map<string, string>();
    const roomAltNameById = new Map<string, string>();
    const roomUserNamesById = new Map<string, string[]>();
    for (const room of plan.rooms || []) {
      const roomName = getRoomLabel(room);
      roomNameById.set(room.id, roomName);
      const altRoomName = lang === 'en' ? String(room?.name || '').trim() : String((room as any)?.nameEn || '').trim();
      roomAltNameById.set(room.id, altRoomName);
    }
    for (const obj of plan.objects || []) {
      const roomId = String(obj.roomId || '').trim();
      if (!roomId) continue;
      const typeId = String(obj.type || '');
      if (typeId !== 'user' && typeId !== 'generic_user' && typeId !== 'real_user') continue;
      const fullName =
        typeId === 'real_user'
          ? `${String((obj as any).firstName || '').trim()} ${String((obj as any).lastName || '').trim()}`.trim()
          : String(obj.name || '').trim();
      if (!fullName) continue;
      const list = roomUserNamesById.get(roomId) || [];
      list.push(fullName);
      roomUserNamesById.set(roomId, list);
    }
    for (const obj of plan.objects || []) {
      const first = String((obj as any).firstName || '').trim();
      const last = String((obj as any).lastName || '').trim();
      const realUserName = `${first} ${last}`.trim();
      const label = obj.type === 'real_user' && realUserName ? realUserName : String(obj.name || '').trim() || objectTypeLabels[obj.type] || obj.type;
      const roomName = obj.roomId ? roomNameById.get(String(obj.roomId)) || '' : '';
      const roomAltName = obj.roomId ? roomAltNameById.get(String(obj.roomId)) || '' : '';
      const typeLabel = objectTypeLabels[obj.type] || obj.type;
      const subtitle = roomName
        ? `${typeLabel} - ${t({ it: 'Stanza', en: 'Room' })}: ${roomName}`
        : `${typeLabel} - ${t({ it: 'Oggetto mappa', en: 'Map object' })}`;
      const search = `${label} ${obj.name || ''} ${obj.description || ''} ${typeLabel} ${roomName} ${roomAltName} ${realUserName}`.toLowerCase();
      entries.push({
        id: `obj:${obj.id}`,
        kind: 'object',
        label,
        subtitle,
        search,
        point: { x: Number(obj.x || 0), y: Number(obj.y || 0) },
        roomId: obj.roomId ? String(obj.roomId) : undefined
      });
    }

    const rackObjectById = new Map((plan.objects || []).filter((obj) => obj.type === 'rack').map((obj) => [obj.id, obj]));
    for (const rackItem of plan.rackItems || []) {
      const rackObject = rackObjectById.get(rackItem.rackId);
      if (!rackObject) continue;
      const label = String(rackItem.name || '').trim() || `${t({ it: 'Apparato rack', en: 'Rack item' })} ${rackItem.type}`;
      const rackName = String(rackObject.name || '').trim() || t({ it: 'Rack', en: 'Rack' });
      const roomName = rackObject.roomId ? roomNameById.get(String(rackObject.roomId)) || '' : '';
      const roomAltName = rackObject.roomId ? roomAltNameById.get(String(rackObject.roomId)) || '' : '';
      const subtitle = roomName
        ? `${rackName} - ${t({ it: 'Stanza', en: 'Room' })}: ${roomName}`
        : rackName;
      const search = `${label} ${rackItem.type || ''} ${rackItem.model || ''} ${rackItem.brand || ''} ${rackName} ${roomName} ${roomAltName}`.toLowerCase();
      entries.push({
        id: `rack_item:${rackItem.id}`,
        kind: 'rack_item',
        label,
        subtitle,
        search,
        point: { x: Number(rackObject.x || 0), y: Number(rackObject.y || 0) },
        roomId: rackObject.roomId ? String(rackObject.roomId) : undefined
      });
    }

    for (const room of plan.rooms || []) {
      const polygon = roomPolygon(room);
      const center = polygon.length ? polygonCentroid(polygon) : { x: Number(room.x || 0), y: Number(room.y || 0) };
      const users = roomUserNamesById.get(room.id) || [];
      const subtitle = t({
        it: `Stanza - utenti: ${users.length}`,
        en: `Room - users: ${users.length}`
      });
      const label = getRoomLabel(room, t({ it: 'Stanza senza nome', en: 'Unnamed room' }));
      const altLabel = lang === 'en' ? String(room?.name || '').trim() : String((room as any)?.nameEn || '').trim();
      const search = `${label} ${altLabel} ${users.join(' ')}`.toLowerCase();
      entries.push({
        id: `room:${room.id}`,
        kind: 'room',
        label,
        subtitle,
        search,
        point: center,
        roomId: room.id
      });
    }

    for (const corridor of (plan.corridors || []) as Corridor[]) {
      const polygon = corridorPolygon(corridor);
      if (!polygon.length) continue;
      const center = polygonCentroid(polygon);
      const label = getCorridorLabel(corridor, t({ it: 'Corridoio', en: 'Corridor' }));
      const altLabel = lang === 'en' ? String(corridor?.name || '').trim() : String((corridor as any)?.nameEn || '').trim();
      entries.push({
        id: `corridor:${corridor.id}`,
        kind: 'corridor',
        label,
        subtitle: t({ it: 'Corridoio', en: 'Corridor' }),
        search: `${label} ${altLabel} corridor corridoio`.toLowerCase(),
        point: center
      });
    }

    return entries;
  };

  const startSearchEntries = useMemo(() => buildSearchEntries(startPlan), [lang, objectTypeLabels, startPlan, t]);
  const destinationSearchEntries = useMemo(() => buildSearchEntries(destinationPlan), [destinationPlan, lang, objectTypeLabels, t]);

  const normalizedStartQuery = startQuery.trim().toLowerCase();
  const filteredStartEntries = useMemo(() => {
    const base = !normalizedStartQuery
      ? startSearchEntries
      : startSearchEntries.filter((entry) => entry.search.includes(normalizedStartQuery));
    return base.slice().sort((a, b) => a.label.localeCompare(b.label, lang === 'it' ? 'it' : 'en', { sensitivity: 'base' }));
  }, [lang, normalizedStartQuery, startSearchEntries]);
  const normalizedDestinationQuery = destinationQuery.trim().toLowerCase();
  const filteredDestinationEntries = useMemo(() => {
    const base = !normalizedDestinationQuery
      ? destinationSearchEntries
      : destinationSearchEntries.filter((entry) => entry.search.includes(normalizedDestinationQuery));
    return base.slice().sort((a, b) => a.label.localeCompare(b.label, lang === 'it' ? 'it' : 'en', { sensitivity: 'base' }));
  }, [destinationSearchEntries, lang, normalizedDestinationQuery]);
  const selectedStartEntry = useMemo(
    () => startSearchEntries.find((entry) => entry.id === selectedStartEntryId) || null,
    [selectedStartEntryId, startSearchEntries]
  );
  const selectedDestinationEntry = useMemo(
    () => destinationSearchEntries.find((entry) => entry.id === selectedDestinationEntryId) || null,
    [destinationSearchEntries, selectedDestinationEntryId]
  );

  const routeMetrics = useMemo(() => {
    if (!routeResult) return null;
    const hasScale = typeof routeResult.distanceMeters === 'number' && Number.isFinite(routeResult.distanceMeters || NaN);
    return {
      distanceLabel: hasScale
        ? `${routeResult.distanceMeters?.toFixed(2)} m`
        : `${routeResult.distancePx.toFixed(1)} px`,
      etaLabel: hasScale ? formatEta(routeResult.etaSeconds) : '--',
      transitionLabel: routeResult.transitionSeconds > 0 ? formatEta(routeResult.transitionSeconds) : null
    };
  }, [routeResult]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsMapFullscreen(Boolean(mapPanelRef.current && document.fullscreenElement === mapPanelRef.current));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const onMapClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!mapPlan) return;
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const world = point.matrixTransform(ctm.inverse());
    if (step === 1 && startMode === 'map') {
      setStartPoint({ x: world.x, y: world.y });
      setSelectedStartEntryId('');
      setStartPointSource('map');
    } else if (step === 2 && destinationMode === 'map') {
      setDestinationPoint({ x: world.x, y: world.y });
      setSelectedDestinationEntryId('');
      setDestinationPointSource('map');
    } else {
      return;
    }
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };

  const handleSelectStartEntry = (entry: SearchEntry) => {
    setSelectedStartEntryId(entry.id);
    setStartPoint({ x: Number(entry.point.x), y: Number(entry.point.y) });
    setStartPointSource('search');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };
  const handleSelectDestinationEntry = (entry: SearchEntry) => {
    setSelectedDestinationEntryId(entry.id);
    setDestinationPoint({ x: Number(entry.point.x), y: Number(entry.point.y) });
    setDestinationPointSource('search');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };

  const runRoute = () => {
    if (!startPlan || !destinationPlan || !startPoint || !destinationPoint) return;
    setComputing(true);
    setRouteError('');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    window.setTimeout(() => {
      const computed = computeMultiFloorRoute(availablePlans, startPlan.id, destinationPlan.id, startPoint, destinationPoint);
      if (computed.result) {
        setRouteResult(computed.result);
        setActiveSegmentIndex(0);
        setStep(3);
      } else {
        const key = computed.error || 'path-not-found';
        if (key === 'no-corridors') {
          setRouteError(t({ it: 'Nessun corridoio configurato nella planimetria selezionata.', en: 'No corridors configured in the selected floor plan.' }));
        } else if (key === 'no-doors') {
          setRouteError(t({ it: 'Nessuna porta corridoio disponibile in planimetria.', en: 'No corridor doors available in this floor plan.' }));
        } else if (key === 'invalid-start') {
          setRouteError(t({ it: 'Porta di partenza non raggiungibile dai corridoi.', en: 'Start door is unreachable from corridors.' }));
        } else if (key === 'invalid-target') {
          setRouteError(t({ it: 'Porta di destinazione non raggiungibile dai corridoi.', en: 'Destination door is unreachable from corridors.' }));
        } else if (key === 'no-walkable-corridors') {
          setRouteError(t({ it: 'I corridoi non risultano percorribili. Controlla il disegno dei corridoi.', en: 'Corridors are not walkable. Check corridor geometry.' }));
        } else {
          setRouteError(t({ it: 'Percorso non trovato. Verifica porte collegate e corridoi.', en: 'Path not found. Check linked doors and corridors.' }));
        }
      }
      setComputing(false);
    }, 0);
  };

  const toggleMapFullscreen = async () => {
    const element = mapPanelRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      setRouteError(t({ it: 'Impossibile aprire la mappa a schermo intero.', en: 'Unable to open fullscreen map.' }));
    }
  };


  const buildRoutePdfPreviewHtml = async () =>
    buildRoutePdfPreviewHtmlImpl({ routeResult, setRouteError, t, availablePlans, selectedClient, selectedSite, selectedStartEntry, selectedDestinationEntry, startPlan, destinationPlan, getRoomLabel, getCorridorLabel, startPoint, destinationPoint, collectRouteTravelPoints });

  const openRoutePdfExport = async () => {
    setRouteError('');
    setPdfPreparing(true);
    try {
      const html = await buildRoutePdfPreviewHtml();
      if (!html) return;
      setPdfPreviewHtml(html);
      setPdfPreviewOpen(true);
    } catch {
      setRouteError(t({ it: 'Impossibile preparare l’anteprima PDF.', en: 'Unable to prepare PDF preview.' }));
    } finally {
      setPdfPreparing(false);
    }
  };

  const confirmRoutePdfExport = async () => {
    if (!pdfPreviewRef.current) return;
    setPdfExporting(true);
    try {
      const pages = Array.from(pdfPreviewRef.current.querySelectorAll('.pdf-page')) as HTMLElement[];
      if (!pages.length) {
        setRouteError(t({ it: 'Nessuna pagina disponibile per l’export PDF.', en: 'No pages available for PDF export.' }));
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
        setRouteError(t({ it: 'Nessuna pagina disponibile per l’export PDF.', en: 'No pages available for PDF export.' }));
        return;
      }
      const fileDate = new Date().toISOString().slice(0, 10);
      const fileName = `percorso-interno-${fileDate}.pdf`;
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
      setRouteError(t({ it: 'Impossibile generare il PDF del percorso.', en: 'Unable to generate the route PDF.' }));
    } finally {
      setPdfExporting(false);
    }
  };

  const close = () => {
    setComputing(false);
    setPdfPreviewOpen(false);
    setPdfPreviewHtml('');
    setPdfPreparing(false);
    setPdfExporting(false);
    onClose();
  };

  const handleMainDialogClose = () => {
    if (pdfPreviewOpen || pdfExporting) return;
    close();
  };

  const canGoStep2 = !!startPlan && !!startPoint;
  const canCalculate = !!startPlan && !!destinationPlan && !!startPoint && !!destinationPoint && !computing;
  const canSelectMapPoint = (step === 1 && startMode === 'map') || (step === 2 && destinationMode === 'map');
  const canOpenStep2 = !!startPoint;
  const canOpenStep3 = !!routeResult;
  const clearStartMapPoint = () => {
    setStartPoint(null);
    setStartPointSource(null);
    setSelectedStartEntryId('');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };
  const clearDestinationMapPoint = () => {
    setDestinationPoint(null);
    setDestinationPointSource(null);
    setSelectedDestinationEntryId('');
    setRouteResult(null);
    setActiveSegmentIndex(0);
    setRouteError('');
  };
  const getRoomLabelLayout = (room: Room, polygon: Point[]) => {
    const minX = Math.min(...polygon.map((point) => point.x));
    const maxX = Math.max(...polygon.map((point) => point.x));
    const minY = Math.min(...polygon.map((point) => point.y));
    const maxY = Math.max(...polygon.map((point) => point.y));
    const center = polygonCentroid(polygon);
    const labelPosition = String((room as any)?.labelPosition || '').trim();
    const scaleRaw = Number((room as any)?.labelScale);
    const scale = Number.isFinite(scaleRaw) ? Math.max(0.6, Math.min(3, scaleRaw)) : 1;
    const fontSize = Math.max(8, Math.round(11 * scale));
    const padding = Math.max(4, Math.round(fontSize * 0.45));
    if (labelPosition === 'left') {
      return { x: minX + padding, y: center.y, fontSize, rotate: -90 };
    }
    if (labelPosition === 'right') {
      return { x: maxX - padding, y: center.y, fontSize, rotate: 90 };
    }
    if (labelPosition === 'top') {
      return { x: center.x, y: minY + padding + fontSize * 0.5, fontSize, rotate: 0 };
    }
    if (labelPosition === 'bottom') {
      return { x: center.x, y: maxY - padding - fontSize * 0.5, fontSize, rotate: 0 };
    }
    return { x: center.x, y: center.y, fontSize, rotate: 0 };
  };
  const renderRooms = () =>
    (mapPlan?.rooms || []).map((room) => {
      const polygon = roomPolygon(room);
      if (polygon.length < 3) return null;
      const points = polygon.map((point) => `${point.x},${point.y}`).join(' ');
      const layout = getRoomLabelLayout(room, polygon);
      const label = getRoomLabel(room, t({ it: 'Ufficio', en: 'Office' }));
      return (
        <g key={`room:${room.id}`}>
          <polygon points={points} fill="rgba(59,130,246,0.12)" stroke="rgba(37,99,235,0.65)" strokeWidth={1.2} />
          <text
            x={layout.x}
            y={layout.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={layout.fontSize}
            fontWeight={700}
            fill="#1e3a8a"
            stroke="#ffffff"
            strokeWidth={3}
            paintOrder="stroke"
            transform={layout.rotate ? `rotate(${layout.rotate} ${layout.x} ${layout.y})` : undefined}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        </g>
      );
    });
  const renderCorridors = () =>
    ((mapPlan?.corridors || []) as Corridor[]).map((corridor) => {
      const polygon = corridorPolygon(corridor);
      if (polygon.length < 3) return null;
      const points = polygon.map((point) => `${point.x},${point.y}`).join(' ');
      return <polygon key={`corridor:${corridor.id}`} points={points} fill={`url(#${patternId})`} stroke="rgba(15,118,110,0.9)" strokeDasharray="5 4" strokeWidth={1.4} />;
    });
  const renderDoors = () =>
    ((mapPlan?.corridors || []) as Corridor[]).flatMap((corridor) =>
      (corridor.doors || []).map((door) => {
        const anchor = getCorridorDoorAnchor(corridor, door);
        if (!anchor) return null;
        return (
          <g key={`door:${corridor.id}:${door.id}`} transform={`translate(${anchor.x},${anchor.y})`}>
            <rect x={-2.4} y={-4.2} width={4.8} height={8.4} rx={0.9} fill="#fff7ed" stroke="#9a3412" strokeWidth={0.9} />
            <line x1={0} y1={-4.2} x2={0} y2={4.2} stroke="#9a3412" strokeWidth={0.8} />
            <circle cx={0.9} cy={0} r={0.55} fill="#9a3412" />
            {(door as any)?.isEmergency ? <circle cx={3.2} cy={-3.8} r={1.3} fill="#dc2626" stroke="#ffffff" strokeWidth={0.6} /> : null}
          </g>
        );
      })
    );
  const renderConnections = () =>
    ((mapPlan?.corridors || []) as Corridor[]).flatMap((corridor) =>
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
  const renderTransitionDirectionArrow = () => {
    if (!activeRouteSegment?.endConnectionId || !activeRoute) return null;
    const points = collectRouteTravelPoints(activeRoute);
    if (points.length < 2) return null;
    const end = points[points.length - 1];
    const prev = points[points.length - 2];
    const dx = end.x - prev.x;
    const dy = end.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 0.0001) return null;
    const ux = dx / len;
    const uy = dy / len;
    const tip = { x: end.x, y: end.y };
    const base = { x: tip.x - ux * 14, y: tip.y - uy * 14 };
    const left = { x: base.x - uy * 5, y: base.y + ux * 5 };
    const right = { x: base.x + uy * 5, y: base.y - ux * 5 };
    return (
      <polygon
        points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
        fill="#f97316"
        stroke="#7c2d12"
        strokeWidth={1}
      />
    );
  };

  return (
    <>
      <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleMainDialogClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-180"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-120"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-7xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Mappa interna', en: 'Internal map' })}</Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {t({
                        it: 'Trova il percorso interno tra il tuo punto di partenza e la destinazione selezionata.',
                        en: 'Find the internal route between your starting point and the selected destination.'
                      })}
                    </Dialog.Description>
                  </div>
                  <button onClick={close} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                    <Info size={13} /> {t({ it: 'Guida rapida', en: 'Quick guide' })}
                  </span>
                  <span className="ml-2">
                    {t({
                      it: '1) Imposta A con ricerca o selezione su mappa. 2) Imposta B sul piano di destinazione. 3) Calcola: percorso in corridoio, passaggi tra piani (Scale/Ascensore) e frecce per piano successivo.',
                      en: '1) Set A via search or map. 2) Set B on the destination floor. 3) Calculate: corridor path, floor transitions (Stairs/Elevator), and arrows for next floor.'
                    })}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${step === 1 ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    1. {t({ it: 'Partenza', en: 'Start' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canOpenStep2) return;
                      setStep(2);
                    }}
                    disabled={!canOpenStep2}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      step === 2 ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    2. {t({ it: 'Destinazione', en: 'Destination' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canOpenStep3) return;
                      setStep(3);
                    }}
                    disabled={!canOpenStep3}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      step === 3 ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    3. {t({ it: 'Percorso', en: 'Route' })}
                  </button>
                </div>

                {step === 1 ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[360px,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Partenza', en: 'Start' })}</div>
                      <label className="mt-2 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Cliente', en: 'Client' })}
                        <select
                          value={selectedClientId}
                          onChange={(event) => {
                            setSelectedClientId(event.target.value);
                            setSelectedSiteId('');
                            setStartPlanId('');
                            setDestinationPlanId('');
                            setSelectedStartEntryId('');
                            setSelectedDestinationEntryId('');
                            setStartPoint(null);
                            setDestinationPoint(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {clientsWithPlans.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.shortName || client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Sede', en: 'Site' })}
                        <select
                          value={selectedSiteId}
                          onChange={(event) => {
                            setSelectedSiteId(event.target.value);
                            setStartPlanId('');
                            setDestinationPlanId('');
                            setSelectedStartEntryId('');
                            setSelectedDestinationEntryId('');
                            setStartPoint(null);
                            setDestinationPoint(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {availableSites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Planimetria', en: 'Floor plan' })}
                        <select
                          value={startPlanId}
                          onChange={(event) => {
                            setStartPlanId(event.target.value);
                            setSelectedStartEntryId('');
                            setStartPoint(null);
                            setStartPointSource(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {availablePlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-3 grid grid-cols-[1fr,1fr,auto] gap-2">
                        <button
                          type="button"
                          onClick={() => setStartMode('search')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            startMode === 'search' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t({ it: 'Ricerca', en: 'Search' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStartMode('map')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            startMode === 'map' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Crosshair size={13} />
                            {t({ it: 'Seleziona su mappa', en: 'Select on map' })}
                          </span>
                        </button>
                        {startPoint && startPointSource === 'map' ? (
                          <button
                            type="button"
                            onClick={clearStartMapPoint}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-2 text-rose-600 hover:bg-rose-50"
                            title={t({ it: 'Rimuovi puntino di partenza', en: 'Remove start map pin' })}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                      {startMode === 'search' ? (
                        <>
                          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <Search size={15} className="text-slate-500" />
                            <input
                              value={startQuery}
                              onChange={(event) => setStartQuery(event.target.value)}
                              placeholder={t({ it: 'Cerca utente, oggetto, stanza...', en: 'Search user, object, room...' })}
                              className="w-full text-sm outline-none"
                            />
                          </div>
                          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                            {filteredStartEntries.length ? (
                              <div className="space-y-1.5">
                                {filteredStartEntries.map((entry) => {
                                  const selected = selectedStartEntryId === entry.id;
                                  return (
                                    <button
                                      key={`start:${entry.id}`}
                                      type="button"
                                      onClick={() => handleSelectStartEntry(entry)}
                                      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left ${
                                        selected ? 'border-primary/50 bg-primary/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                                        {entry.kind === 'room' ? <MapPin size={13} /> : entry.kind === 'rack_item' ? <Server size={13} /> : entry.kind === 'corridor' ? <Route size={13} /> : <User size={13} />}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-slate-800">{entry.label}</span>
                                        <span className="block truncate text-[11px] text-slate-600">{entry.subtitle}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                                {t({ it: 'Nessun risultato con questi filtri.', en: 'No matches for these filters.' })}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          {t({ it: 'Clicca liberamente sulla mappa per impostare il punto A.', en: 'Click freely on the map to set point A.' })}
                        </div>
                      )}
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto A', en: 'Point A' })}</span>
                          <span>{startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-'}</span>
                        </div>
                        {selectedStartEntry ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            {t({ it: 'Partenza selezionata', en: 'Selected start' })}: {selectedStartEntry.label}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Mappa', en: 'Map' })}</div>
                      <div className="relative mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <svg
                          ref={svgRef}
                          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                          className={`h-[62vh] w-full bg-slate-100 ${canSelectMapPoint ? 'cursor-crosshair' : 'cursor-default'}`}
                          onClick={onMapClick}
                        >
                          <defs>
                            <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                              <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
                              <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
                              <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
                            </pattern>
                          </defs>
                          {mapPlan?.imageUrl ? (
                            <image href={mapPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                          ) : null}
                          {renderRooms()}
                          {renderCorridors()}
                          {renderConnections()}
                          {renderDoors()}
                          {startPoint ? (
                            <g>
                              <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                              <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                                A
                              </text>
                            </g>
                          ) : null}
                          {destinationPoint && destinationPlanId === startPlanId ? (
                            <g>
                              <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                              <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                                B
                              </text>
                            </g>
                          ) : null}
                        </svg>
                        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                          {t({ it: 'Piano', en: 'Floor' })}: {mapPlan?.name || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : step === 2 ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[360px,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Destinazione', en: 'Destination' })}</div>
                      <label className="mt-2 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Cliente', en: 'Client' })}
                        <select
                          value={selectedClientId}
                          disabled
                          className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                        >
                          {clientsWithPlans.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.shortName || client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Sede', en: 'Site' })}
                        <select
                          value={selectedSiteId}
                          disabled
                          className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                        >
                          {availableSites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-semibold text-slate-600">
                        {t({ it: 'Planimetria', en: 'Floor plan' })}
                        <select
                          value={destinationPlanId}
                          onChange={(event) => {
                            setDestinationPlanId(event.target.value);
                            setSelectedDestinationEntryId('');
                            setDestinationPoint(null);
                            setDestinationPointSource(null);
                            setRouteResult(null);
                            setActiveSegmentIndex(0);
                            setRouteError('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {availablePlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        {t({
                          it: 'Cliente e sede sono bloccati sulla scelta di partenza. Puoi cambiare solo il piano di destinazione.',
                          en: 'Client and site are locked to the selected start. You can only change the destination floor.'
                        })}
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr,1fr,auto] gap-2">
                        <button
                          type="button"
                          onClick={() => setDestinationMode('search')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            destinationMode === 'search' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t({ it: 'Ricerca', en: 'Search' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDestinationMode('map')}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                            destinationMode === 'map' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Crosshair size={13} />
                            {t({ it: 'Seleziona su mappa', en: 'Select on map' })}
                          </span>
                        </button>
                        {destinationPoint && destinationPointSource === 'map' ? (
                          <button
                            type="button"
                            onClick={clearDestinationMapPoint}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-2 text-rose-600 hover:bg-rose-50"
                            title={t({ it: 'Rimuovi puntino di destinazione', en: 'Remove destination map pin' })}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                      {destinationMode === 'search' ? (
                        <>
                          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <Search size={15} className="text-slate-500" />
                            <input
                              value={destinationQuery}
                              onChange={(event) => setDestinationQuery(event.target.value)}
                              placeholder={t({ it: 'Cerca utente, oggetto, stanza...', en: 'Search user, object, room...' })}
                              className="w-full text-sm outline-none"
                            />
                          </div>
                          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                            {filteredDestinationEntries.length ? (
                              <div className="space-y-1.5">
                                {filteredDestinationEntries.map((entry) => {
                                  const selected = selectedDestinationEntryId === entry.id;
                                  return (
                                    <button
                                      key={`destination:${entry.id}`}
                                      type="button"
                                      onClick={() => handleSelectDestinationEntry(entry)}
                                      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left ${
                                        selected ? 'border-primary/50 bg-primary/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                                        {entry.kind === 'room' ? <MapPin size={13} /> : entry.kind === 'rack_item' ? <Server size={13} /> : entry.kind === 'corridor' ? <Route size={13} /> : <User size={13} />}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-slate-800">{entry.label}</span>
                                        <span className="block truncate text-[11px] text-slate-600">{entry.subtitle}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                                {t({ it: 'Nessun risultato con questi filtri.', en: 'No matches for these filters.' })}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          {t({ it: 'Clicca liberamente sulla mappa per impostare il punto B.', en: 'Click freely on the map to set point B.' })}
                        </div>
                      )}
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto B', en: 'Point B' })}</span>
                          <span>{destinationPoint ? `${Math.round(destinationPoint.x)}, ${Math.round(destinationPoint.y)}` : '-'}</span>
                        </div>
                        {selectedDestinationEntry ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            {t({ it: 'Destinazione selezionata', en: 'Selected destination' })}: {selectedDestinationEntry.label}
                          </div>
                        ) : null}
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">{t({ it: 'Punto A', en: 'Point A' })}</span>
                            <span>{startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-'}</span>
                          </div>
                        </div>
                      </div>
                      {routeError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</div> : null}
                    </div>

                    <div ref={mapPanelRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <svg
                        ref={svgRef}
                        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                        className={`h-[62vh] w-full bg-slate-100 ${canSelectMapPoint ? 'cursor-crosshair' : 'cursor-default'}`}
                        onClick={onMapClick}
                      >
                        <defs>
                          <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                            <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
                            <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
                            <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
                          </pattern>
                        </defs>
                        {mapPlan?.imageUrl ? (
                          <image href={mapPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                        ) : null}
                        {renderRooms()}
                        {renderCorridors()}
                        {renderConnections()}
                        {renderDoors()}
                        {destinationPoint ? (
                          <g>
                            <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                            <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                              B
                            </text>
                          </g>
                        ) : null}
                        {startPoint && startPlanId === destinationPlanId ? (
                          <g>
                            <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                            <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                              A
                            </text>
                          </g>
                        ) : null}
                      </svg>
                      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                        {t({ it: 'Piano', en: 'Floor' })}: {mapPlan?.name || '-'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[360px,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Percorso', en: 'Route' })}</div>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto A', en: 'Point A' })}</span>
                          <span>{startPoint ? `${Math.round(startPoint.x)}, ${Math.round(startPoint.y)}` : '-'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{t({ it: 'Punto B', en: 'Point B' })}</span>
                          <span>{destinationPoint ? `${Math.round(destinationPoint.x)}, ${Math.round(destinationPoint.y)}` : '-'}</span>
                        </div>
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
                        <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                          {t({ it: 'Tratteggio: accesso alle porte. Rosso: percorso interno a 90° nei corridoi.', en: 'Dashed: door approach/exit. Red: 90° internal corridor route.' })}
                        </div>
                      </div>
                      {routeError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</div> : null}
                    </div>
                    <div ref={mapPanelRef} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <svg ref={svgRef} viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="h-[62vh] w-full bg-slate-100">
                        <defs>
                          <pattern id={patternId} width="22" height="22" patternUnits="userSpaceOnUse">
                            <rect width="22" height="22" fill="rgba(148,163,184,0.18)" />
                            <path d="M0 0H22V22H0z" fill="none" stroke="rgba(71,85,105,0.34)" strokeWidth="1" />
                            <path d="M0 11H22M11 0V22" stroke="rgba(71,85,105,0.22)" strokeWidth="0.8" />
                          </pattern>
                        </defs>
                        {mapPlan?.imageUrl ? (
                          <image href={mapPlan.imageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="none" opacity={0.72} />
                        ) : null}
                        {renderRooms()}
                        {renderCorridors()}
                        {renderConnections()}
                        {renderDoors()}
                        {activeRoute?.approachPoints?.length ? (
                          <polyline points={activeRoute.approachPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {activeRoute?.corridorPoints?.length ? (
                          <polyline points={activeRoute.corridorPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#dc2626" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {activeRoute?.exitPoints?.length ? (
                          <polyline points={activeRoute.exitPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                        ) : null}
                        {renderTransitionDirectionArrow()}
                        {startPoint && activeSegmentIndex === 0 ? (
                          <g>
                            <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                            <text x={startPoint.x + 10} y={startPoint.y - 10} fontSize={12} fontWeight={700} fill="#7f1d1d">
                              A
                            </text>
                          </g>
                        ) : null}
                        {destinationPoint && activeSegmentIndex === Math.max(0, routeSegmentCount - 1) ? (
                          <g>
                            <circle cx={destinationPoint.x} cy={destinationPoint.y} r={7} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                            <text x={destinationPoint.x + 10} y={destinationPoint.y - 10} fontSize={12} fontWeight={700} fill="#14532d">
                              B
                            </text>
                          </g>
                        ) : null}
                        {activeRoute && !activeRoute.directDashedOnly ? (
                          <>
                            <circle cx={activeRoute.startDoor.x} cy={activeRoute.startDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                            <circle cx={activeRoute.endDoor.x} cy={activeRoute.endDoor.y} r={5.5} fill="#fb923c" stroke="#7c2d12" strokeWidth={1.3} />
                          </>
                        ) : null}
                      </svg>
                      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                        {t({ it: 'Piano', en: 'Floor' })}: {mapPlan?.name || '-'} {routeIsMultiFloor ? `(${Math.max(1, activeSegmentIndex + 1)}/${routeSegmentCount})` : ''}
                      </div>
                      {routeIsMultiFloor ? (
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveSegmentIndex((prev) => Math.max(0, prev - 1))}
                            disabled={activeSegmentIndex <= 0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={t({ it: 'Piano precedente', en: 'Previous floor' })}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSegmentIndex((prev) => Math.min(routeSegmentCount - 1, prev + 1))}
                            disabled={activeSegmentIndex >= routeSegmentCount - 1}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={t({ it: 'Piano successivo', en: 'Next floor' })}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin size={14} />
                    {step === 1
                      ? t({ it: 'Imposta il punto A tramite ricerca o selezione su mappa.', en: 'Set point A via search or map selection.' })
                      : step === 2
                        ? t({ it: 'Imposta il punto B tramite ricerca o selezione su mappa.', en: 'Set point B via search or map selection.' })
                        : t({ it: 'Percorso calcolato: tratteggio -> porta -> corridoio rosso -> porta -> tratteggio.', en: 'Route computed: dashed -> door -> red corridor path -> door -> dashed.' })}
                  </div>
                  <div className="flex items-center gap-2">
                    {step === 1 ? null : (
                      <button
                        type="button"
                        onClick={() => setStep(step === 2 ? 1 : 2)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {step === 3 ? t({ it: 'Modifica destinazione', en: 'Edit destination' }) : t({ it: 'Modifica partenza', en: 'Edit start' })}
                      </button>
                    )}
                    {step === 1 ? null : (
                      <button
                        type="button"
                        onClick={toggleMapFullscreen}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Mostra mappa a schermo intero', en: 'Show map in fullscreen' })}
                      >
                        {isMapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        {isMapFullscreen ? t({ it: 'Esci da full screen', en: 'Exit fullscreen' }) : t({ it: 'Full screen', en: 'Fullscreen' })}
                      </button>
                    )}
                    {step === 1 ? null : (
                      <button
                        type="button"
                        onClick={openRoutePdfExport}
                        disabled={!routeResult || pdfPreparing}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title={t({ it: 'Apri anteprima PDF', en: 'Open PDF preview' })}
                      >
                        <FileDown size={14} />
                        {pdfPreparing ? t({ it: 'Preparazione...', en: 'Preparing...' }) : t({ it: 'Anteprima PDF', en: 'PDF preview' })}
                      </button>
                    )}
                    {step === 1 ? (
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={!canGoStep2}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {t({ it: 'Seleziona destinazione', en: 'Select destination' })} <Navigation size={14} />
                      </button>
                    ) : step === 2 ? (
                      <button
                        type="button"
                        onClick={runRoute}
                        disabled={!canCalculate}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {computing ? t({ it: 'Calcolo...', en: 'Calculating...' }) : t({ it: 'Calcola percorso', en: 'Calculate route' })}
                        <Route size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          setRouteResult(null);
                          setActiveSegmentIndex(0);
                          setRouteError('');
                        }}
                        disabled={computing}
                        className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {t({ it: 'Ricalcola percorso', en: 'Recalculate route' })}
                        <Route size={14} />
                      </button>
                    )}
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
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-180"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-120"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[1200px] rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-slate-900">
                        {t({ it: 'Anteprima PDF percorso interno', en: 'Internal route PDF preview' })}
                      </Dialog.Title>
                      <p className="mt-1 text-xs text-slate-600">
                        {t({ it: 'Verifica il risultato e poi esporta in PDF.', en: 'Review the result, then export to PDF.' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={confirmRoutePdfExport}
                        disabled={pdfExporting || !pdfPreviewHtml}
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
                    <div ref={pdfPreviewRef} className="mx-auto w-[1080px] max-w-full" dangerouslySetInnerHTML={{ __html: pdfPreviewHtml }} />
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

export default InternalMapModal;
