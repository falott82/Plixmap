import { useEffect, useRef, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { perfMetrics } from '../../utils/perfMetrics';

const formatBytes = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let v = value;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(1)} ${units[idx]}`;
};

const PerfOverlay = ({ enabled }: { enabled: boolean }) => {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fps, setFps] = useState(0);
  const [jankMs, setJankMs] = useState(0);
  const [longTasks, setLongTasks] = useState(0);
  const [mem, setMem] = useState<{ used: number; total: number } | null>(null);
  const [tick, setTick] = useState(0);
  const startRef = useRef(performance.now());
  const selectedPlanId = useUIStore((s) => s.selectedPlanId);
  const plan = useDataStore((s) => (selectedPlanId ? s.findFloorPlan(selectedPlanId) : undefined));
  const totals = useDataStore((s) => {
    let plans = 0;
    let objects = 0;
    let rooms = 0;
    let revisions = 0;
    for (const c of s.clients || []) {
      for (const site of c.sites || []) {
        for (const p of site.floorPlans || []) {
          plans += 1;
          objects += (p.objects || []).length;
          rooms += (p.rooms || []).length;
          revisions += (p.revisions || []).length;
        }
      }
    }
    return { plans, objects, rooms, revisions };
  });

  const elapsed = performance.now() - startRef.current;
  const elapsedMinutes = Math.max(0.001, elapsed / 60000);
  const planRendersPerMin = Math.round(perfMetrics.planViewRenders / elapsedMinutes);
  const canvasRendersPerMin = Math.round(perfMetrics.canvasRenders / elapsedMinutes);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const lastTickRef = useRef(performance.now());
  const lastJankRef = useRef(0);
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onFrame = (now: number) => {
      frameCountRef.current += 1;
      const delta = now - lastFrameRef.current;
      if (delta > 80) lastJankRef.current = delta;
      const elapsed = now - lastTickRef.current;
      if (elapsed >= 1000) {
        const nextFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(nextFps);
        setJankMs(Math.round(lastJankRef.current));
        frameCountRef.current = 0;
        lastTickRef.current = now;
        lastJankRef.current = 0;
      }
      lastFrameRef.current = now;
      rafRef.current = requestAnimationFrame(onFrame);
    };
    rafRef.current = requestAnimationFrame(onFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) setLongTasks((prev) => prev + entries.length);
      });
      obs.observe({ entryTypes: ['longtask'] });
      longTaskObserverRef.current = obs;
      return () => obs.disconnect();
    } catch {
      return undefined;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const memInfo = (performance as any)?.memory;
      if (memInfo?.usedJSHeapSize) {
        setMem({ used: memInfo.usedJSHeapSize, total: memInfo.totalJSHeapSize || 0 });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!enabled || hidden) return null;

  const planObjects = plan?.objects?.length || 0;
  const planRooms = plan?.rooms?.length || 0;
  const planLinks = ((plan as any)?.links || []).length || 0;
  const copySnapshot = async () => {
    const snapshot = {
      at: new Date().toISOString(),
      location: { path: window.location.pathname, search: window.location.search },
      fps,
      jankMs,
      longTasks,
      autosaveCount: perfMetrics.autosaveCount,
      autosaveLastDurationMs: perfMetrics.autosaveLastDurationMs,
      render: {
        planRenders: perfMetrics.planViewRenders,
        planLastMs: perfMetrics.planViewLastRenderMs,
        canvasRenders: perfMetrics.canvasRenders,
        canvasLastMs: perfMetrics.canvasLastRenderMs,
        rendersPerMin: { plan: planRendersPerMin, canvas: canvasRendersPerMin }
      },
      heap: mem ? { used: mem.used, total: mem.total } : null,
      konva: { nodes: perfMetrics.konvaNodeCount, layers: perfMetrics.konvaLayerCount },
        signals: {
          zoomUpdates: perfMetrics.zoomUpdates,
          panUpdates: perfMetrics.panUpdates,
          viewportCommits: perfMetrics.viewportCommits,
          resizeObserverTicks: perfMetrics.resizeObserverTicks,
          resizeObserverCommits: perfMetrics.resizeObserverCommits,
          watchdogTicks: perfMetrics.watchdogTicks,
          resizeLastWidth: perfMetrics.resizeLastWidth,
          resizeLastHeight: perfMetrics.resizeLastHeight,
          resizeDeltaMax: perfMetrics.resizeDeltaMax,
          resizeSmallJitter: perfMetrics.resizeSmallJitter,
          resizeLargeJitter: perfMetrics.resizeLargeJitter,
          resizeMinWidth: perfMetrics.resizeMinWidth,
          resizeMaxWidth: perfMetrics.resizeMaxWidth,
          resizeMinHeight: perfMetrics.resizeMinHeight,
          resizeMaxHeight: perfMetrics.resizeMaxHeight,
          hoverUpdates: perfMetrics.hoverUpdates,
          selectionBoxUpdates: perfMetrics.selectionBoxUpdates,
          draftRectUpdates: perfMetrics.draftRectUpdates,
          draftPrintRectUpdates: perfMetrics.draftPrintRectUpdates,
        draftPolyUpdates: perfMetrics.draftPolyUpdates,
        highlightTicks: perfMetrics.highlightTicks,
        roomHighlightTicks: perfMetrics.roomHighlightTicks,
        wsMessages: perfMetrics.wsMessages,
        presenceUpdates: perfMetrics.presenceUpdates
      },
      planItems: { objects: planObjects, rooms: planRooms, links: planLinks },
      totals
    };
    const payload = JSON.stringify(snapshot, null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error('Clipboard unavailable');
      }
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = payload;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      } catch {
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[90] w-[280px] rounded-xl border border-slate-200 bg-white/90 p-3 text-xs text-slate-700 shadow-card backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Perf</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copySnapshot}
            className="rounded px-1 text-[11px] text-slate-400 hover:text-slate-700"
          >
            {copied ? '✓' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="rounded px-1 text-[11px] text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-slate-400">FPS</div>
          <div className="font-semibold">{fps || '-'}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Jank</div>
          <div className="font-semibold">{jankMs ? `${jankMs} ms` : '-'}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Long tasks</div>
          <div className="font-semibold">{longTasks}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Autosave</div>
          <div className="font-semibold">{perfMetrics.autosaveCount}</div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] text-slate-400">Autosave last</div>
          <div className="font-semibold">
            {perfMetrics.autosaveLastDurationMs ? `${perfMetrics.autosaveLastDurationMs} ms` : '-'}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] text-slate-400">Render/min</div>
          <div className="font-semibold">
            Plan {planRendersPerMin} · Canvas {canvasRendersPerMin}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] text-slate-400">Render last</div>
          <div className="font-semibold">
            Plan {perfMetrics.planViewLastRenderMs} ms · Canvas {perfMetrics.canvasLastRenderMs} ms
          </div>
        </div>
        {mem ? (
          <div className="col-span-2">
            <div className="text-[11px] text-slate-400">Heap</div>
            <div className="font-semibold">
              {formatBytes(mem.used)} / {formatBytes(mem.total)}
            </div>
          </div>
        ) : null}
        <div className="col-span-2">
          <div className="text-[11px] text-slate-400">Konva nodes</div>
          <div className="font-semibold">
            {perfMetrics.konvaNodeCount} nodes · {perfMetrics.konvaLayerCount} layers
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] text-slate-400">Signals</div>
          <div className="font-semibold">
            Pan {perfMetrics.panUpdates} · Zoom {perfMetrics.zoomUpdates} · View {perfMetrics.viewportCommits}
          </div>
          <div className="font-semibold text-slate-500">
            Resize {perfMetrics.resizeObserverCommits}/{perfMetrics.resizeObserverTicks} · Watch {perfMetrics.watchdogTicks}
          </div>
          <div className="font-semibold text-slate-500">
            Size {perfMetrics.resizeLastWidth}×{perfMetrics.resizeLastHeight} · Δmax {perfMetrics.resizeDeltaMax}
          </div>
          <div className="font-semibold text-slate-500">
            Jitter {perfMetrics.resizeSmallJitter}/{perfMetrics.resizeLargeJitter} · Range {perfMetrics.resizeMinWidth}-{perfMetrics.resizeMaxWidth}
          </div>
          <div className="font-semibold text-slate-500">
            Range H {perfMetrics.resizeMinHeight}-{perfMetrics.resizeMaxHeight}
          </div>
          <div className="font-semibold text-slate-500">
            Hover {perfMetrics.hoverUpdates} · Select {perfMetrics.selectionBoxUpdates} · Draft {perfMetrics.draftRectUpdates}
          </div>
          <div className="font-semibold text-slate-500">
            Poly {perfMetrics.draftPolyUpdates} · HL {perfMetrics.highlightTicks}/{perfMetrics.roomHighlightTicks}
          </div>
          <div className="font-semibold text-slate-500">
            WS {perfMetrics.wsMessages} · Presence {perfMetrics.presenceUpdates}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] text-slate-400">Plan items</div>
          <div className="font-semibold">
            {planObjects} obj · {planRooms} rooms · {planLinks} links
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] text-slate-400">Totals</div>
          <div className="font-semibold">
            {totals.plans} plans · {totals.objects} obj · {totals.rooms} rooms · {totals.revisions} rev
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-slate-400">tick {tick}</div>
    </div>
  );
};

export default PerfOverlay;
