import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { Client } from '../../store/types';
import { useAuthStore } from '../../store/useAuthStore';
import { createCapacitySnapshot, fetchCapacityHistory, type CapacityHistorySnapshot } from '../../api/capacity';
import { buildCapacityMetrics, findCapacityClientMetric } from '../../utils/capacityMetrics';
import CapacityGauge from '../ui/CapacityGauge';

interface Props {
  open: boolean;
  clients: Client[];
  currentClientId?: string | null;
  currentSiteId?: string | null;
  onClose: () => void;
}

const COLORS = ['#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0f766e', '#ea580c'];
const ALL_SITES = '__all_sites__';
const ALL_PLANS = '__all_plans__';

const formatPct = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '--';
  return `${Math.round(value)}%`;
};

const formatValue = (value: number | null | undefined, digits = 1) => {
  if (!Number.isFinite(Number(value))) return '--';
  return Number(value).toFixed(digits);
};

const normalizeSeries = (snapshots: CapacityHistorySnapshot[], clientId: string) => {
  const bySite = new Map<string, { siteId: string; siteName: string; points: { at: number; capacity: number }[] }>();
  for (const snapshot of snapshots || []) {
    const client = (snapshot.clients || []).find((entry) => entry.clientId === clientId);
    if (!client) continue;
    for (const site of client.sites || []) {
      const key = String(site.siteId || '');
      if (!key) continue;
      const bucket = bySite.get(key) || { siteId: key, siteName: String(site.siteName || key), points: [] };
      bucket.points.push({ at: Number(snapshot.at || 0), capacity: Number(site.totalCapacity || 0) });
      bySite.set(key, bucket);
    }
  }
  return Array.from(bySite.values())
    .map((entry) => ({
      ...entry,
      points: entry.points.filter((point) => point.at > 0).sort((a, b) => a.at - b.at)
    }))
    .filter((entry) => entry.points.length)
    .sort((a, b) => a.siteName.localeCompare(b.siteName));
};

const CapacityTrendChart = ({ series, compact = false }: { series: ReturnType<typeof normalizeSeries>; compact?: boolean }) => {
  if (!series.length) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No data</div>;
  }
  const allPoints = series.flatMap((entry) => entry.points);
  const minAt = Math.min(...allPoints.map((point) => point.at));
  const maxAt = Math.max(...allPoints.map((point) => point.at));
  const maxCapacity = Math.max(1, ...allPoints.map((point) => point.capacity));
  const left = 48;
  const right = 16;
  const top = compact ? 10 : 12;
  const bottom = compact ? 22 : 28;
  const width = 920;
  const height = compact ? 188 : 260;
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const xForAt = (at: number) => {
    if (maxAt === minAt) return left + chartW / 2;
    return left + ((at - minAt) / (maxAt - minAt)) * chartW;
  };
  const yForCapacity = (capacity: number) => top + chartH - (capacity / maxCapacity) * chartH;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <svg viewBox={`0 0 ${width} ${height}`} className={compact ? 'h-40 w-full' : 'h-56 w-full'} role="img" aria-label="capacity trend">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = top + chartH * step;
          const label = Math.round(maxCapacity * (1 - step));
          return (
            <g key={step}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={left - 8} y={y + 4} fontSize="11" textAnchor="end" fill="#64748b">
                {label}
              </text>
            </g>
          );
        })}
        {series.map((entry, index) => {
          const color = COLORS[index % COLORS.length];
          const path = entry.points
            .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${xForAt(point.at)} ${yForCapacity(point.capacity)}`)
            .join(' ');
          const last = entry.points[entry.points.length - 1];
          return (
            <g key={entry.siteId}>
              <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={xForAt(last.at)} cy={yForCapacity(last.capacity)} r="3.5" fill={color} />
            </g>
          );
        })}
        <text x={left} y={height - 6} fontSize="11" fill="#64748b">
          {new Date(minAt).toLocaleDateString()}
        </text>
        <text x={width - right} y={height - 6} fontSize="11" fill="#64748b" textAnchor="end">
          {new Date(maxAt).toLocaleDateString()}
        </text>
      </svg>
      <div className={compact ? 'mt-1 flex flex-wrap gap-1.5' : 'mt-2 flex flex-wrap gap-2'}>
        {series.map((entry, index) => {
          const color = COLORS[index % COLORS.length];
          const first = entry.points[0]?.capacity || 0;
          const last = entry.points[entry.points.length - 1]?.capacity || 0;
          const delta = last - first;
          return (
            <span
              key={entry.siteId}
              className={compact
                ? 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700'
                : 'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700'}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{entry.siteName}</span>
              <span className={delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{delta >= 0 ? `+${delta}` : `${delta}`}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

const CapacityDashboardModal = ({ open, clients, currentClientId, currentSiteId, onClose }: Props) => {
  const t = useT();
  const { user } = useAuthStore();
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(ALL_SITES);
  const [selectedPlanId, setSelectedPlanId] = useState(ALL_PLANS);
  const [historySnapshots, setHistorySnapshots] = useState<CapacityHistorySnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [showOvercrowded, setShowOvercrowded] = useState(false);

  const summary = useMemo(() => buildCapacityMetrics(clients || []), [clients]);
  const selectedClient = useMemo(
    () => findCapacityClientMetric(summary, selectedClientId) || null,
    [selectedClientId, summary]
  );

  useEffect(() => {
    if (!open) return;
    setShowOvercrowded(false);
    const preferredClient = String(currentClientId || '').trim();
    const firstClient = summary.clients[0]?.clientId || '';
    const nextClientId = summary.clients.some((entry) => entry.clientId === preferredClient) ? preferredClient : firstClient;
    setSelectedClientId(nextClientId);
    const preferredSite = String(currentSiteId || '').trim();
    const client = summary.clients.find((entry) => entry.clientId === nextClientId);
    const firstSite = client?.sites[0]?.siteId || '';
    const nextSiteId = client?.sites.some((entry) => entry.siteId === preferredSite) ? preferredSite : firstSite || ALL_SITES;
    setSelectedSiteId(nextSiteId);
    setSelectedPlanId(ALL_PLANS);
  }, [currentClientId, currentSiteId, open, summary.clients]);

  useEffect(() => {
    if (!selectedClient) return;
    if (selectedClient.clientId !== selectedClientId) {
      setSelectedClientId(selectedClient.clientId);
    }
    if (selectedSiteId === ALL_SITES) return;
    if (selectedClient.sites.some((entry) => entry.siteId === selectedSiteId)) return;
    setSelectedSiteId(selectedClient.sites[0]?.siteId || ALL_SITES);
  }, [selectedClient, selectedClientId, selectedSiteId]);

  const selectedSites = useMemo(() => {
    if (!selectedClient) return [];
    if (selectedSiteId === ALL_SITES) return selectedClient.sites || [];
    const match = (selectedClient.sites || []).find((entry) => entry.siteId === selectedSiteId);
    return match ? [match] : [];
  }, [selectedClient, selectedSiteId]);

  const availablePlans = useMemo(() => {
    return selectedSites
      .flatMap((site) =>
        (site.floors || []).map((floor) => ({
          key: `${site.siteId}::${floor.planId}`,
          siteId: site.siteId,
          siteName: site.siteName,
          planId: floor.planId,
          planName: floor.planName,
          roomsCount: floor.roomsCount,
          totalCapacity: floor.totalCapacity,
          totalUsers: floor.totalUsers,
          totalSurfaceSqm: floor.totalSurfaceSqm,
          overCapacityRooms: floor.overCapacityRooms,
          occupancyPct: floor.occupancyPct,
          usersPerSqm: floor.usersPerSqm,
          sqmPerUser: floor.sqmPerUser,
          rooms: floor.rooms || []
        }))
      )
      .sort((a, b) => {
        if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' });
        return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
      });
  }, [selectedSites]);

  useEffect(() => {
    if (selectedPlanId === ALL_PLANS) return;
    if (availablePlans.some((entry) => entry.key === selectedPlanId)) return;
    setSelectedPlanId(ALL_PLANS);
  }, [availablePlans, selectedPlanId]);

  const selectedPlans = useMemo(() => {
    if (selectedPlanId === ALL_PLANS) return availablePlans;
    return availablePlans.filter((entry) => entry.key === selectedPlanId);
  }, [availablePlans, selectedPlanId]);

  const selectedSiteSummaries = useMemo(() => {
    const bySite = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        roomsCount: number;
        floorsCount: number;
        overCapacityRooms: number;
        totalCapacity: number;
        totalUsers: number;
        totalSurfaceSqm: number;
        occupancyPct: number | null;
        usersPerSqm: number | null;
        sqmPerUser: number | null;
        floors: typeof selectedPlans;
      }
    >();
    for (const floor of selectedPlans) {
      const current = bySite.get(floor.siteId) || {
        siteId: floor.siteId,
        siteName: floor.siteName,
        roomsCount: 0,
        floorsCount: 0,
        overCapacityRooms: 0,
        totalCapacity: 0,
        totalUsers: 0,
        totalSurfaceSqm: 0,
        occupancyPct: null,
        usersPerSqm: null,
        sqmPerUser: null,
        floors: [] as typeof selectedPlans
      };
      current.roomsCount += Number(floor.roomsCount || 0);
      current.floorsCount += 1;
      current.overCapacityRooms += Number(floor.overCapacityRooms || 0);
      current.totalCapacity += Number(floor.totalCapacity || 0);
      current.totalUsers += Number(floor.totalUsers || 0);
      current.totalSurfaceSqm += Number(floor.totalSurfaceSqm || 0);
      current.floors.push(floor);
      bySite.set(floor.siteId, current);
    }
    return Array.from(bySite.values())
      .map((entry) => ({
        ...entry,
        occupancyPct: entry.totalCapacity > 0 ? (entry.totalUsers / entry.totalCapacity) * 100 : null,
        usersPerSqm: entry.totalSurfaceSqm > 0 ? entry.totalUsers / entry.totalSurfaceSqm : null,
        sqmPerUser: entry.totalUsers > 0 && entry.totalSurfaceSqm > 0 ? entry.totalSurfaceSqm / entry.totalUsers : null,
        floors: entry.floors.sort((a, b) => a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' }))
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' }));
  }, [selectedPlans]);

  const selectionTotals = useMemo(() => {
    const totalCapacity = selectedSiteSummaries.reduce((sum, entry) => sum + entry.totalCapacity, 0);
    const totalUsers = selectedSiteSummaries.reduce((sum, entry) => sum + entry.totalUsers, 0);
    const totalSurfaceSqm = selectedSiteSummaries.reduce((sum, entry) => sum + entry.totalSurfaceSqm, 0);
    const floorsCount = selectedSiteSummaries.reduce((sum, entry) => sum + entry.floorsCount, 0);
    const roomsCount = selectedSiteSummaries.reduce((sum, entry) => sum + entry.roomsCount, 0);
    const overCapacityRooms = selectedSiteSummaries.reduce((sum, entry) => sum + entry.overCapacityRooms, 0);
    return {
      sitesCount: selectedSiteSummaries.length,
      floorsCount,
      roomsCount,
      overCapacityRooms,
      totalCapacity,
      totalUsers,
      totalSurfaceSqm,
      occupancyPct: totalCapacity > 0 ? (totalUsers / totalCapacity) * 100 : null,
      usersPerSqm: totalSurfaceSqm > 0 ? totalUsers / totalSurfaceSqm : null,
      sqmPerUser: totalUsers > 0 && totalSurfaceSqm > 0 ? totalSurfaceSqm / totalUsers : null
    };
  }, [selectedSiteSummaries]);

  const overcrowdedRooms = useMemo(() => {
    return selectedPlans
      .flatMap((floor) =>
        (floor.rooms || [])
          .filter((room) => !!room.overCapacity)
          .map((room) => ({
            siteId: floor.siteId,
            siteName: floor.siteName,
            planId: floor.planId,
            planName: floor.planName,
            roomId: room.roomId,
            roomName: room.roomName,
            users: room.userCount || 0,
            capacity: room.capacity || 0
          }))
      )
      .sort((a, b) => {
        if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' });
        if (a.planName !== b.planName) return a.planName.localeCompare(b.planName, undefined, { sensitivity: 'base' });
        return a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' });
      });
  }, [selectedPlans]);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      if (isSuperAdmin) {
        await createCapacitySnapshot();
      }
      const result = await fetchCapacityHistory();
      setHistorySnapshots(result.snapshots || []);
    } catch (error: any) {
      setHistorySnapshots([]);
      setHistoryError(String(error?.message || 'Unable to load history'));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isSuperAdmin]);

  const trendSeries = useMemo(() => {
    if (!selectedClient) return [];
    const allSeries = normalizeSeries(historySnapshots, selectedClient.clientId);
    const enabledSites = new Set(selectedSiteSummaries.map((entry) => entry.siteId));
    return allSeries.filter((entry) => enabledSites.has(entry.siteId));
  }, [historySnapshots, selectedClient, selectedSiteSummaries]);

  const selectedSiteSummary = selectedSiteId === ALL_SITES ? null : selectedSiteSummaries[0] || null;
  const selectedPlanSummary = selectedPlanId !== ALL_PLANS ? selectedPlans[0] || null : null;
  const focusGaugeTitle = selectedPlanSummary
    ? t({ it: 'Gauge planimetria', en: 'Floor plan gauge' })
    : selectedSiteSummary
      ? t({ it: 'Gauge sede', en: 'Site gauge' })
      : t({ it: 'Gauge selezione', en: 'Selection gauge' });
  const focusGaugeUsers = selectedPlanSummary ? selectedPlanSummary.totalUsers : selectedSiteSummary ? selectedSiteSummary.totalUsers : selectionTotals.totalUsers;
  const focusGaugeCapacity = selectedPlanSummary
    ? selectedPlanSummary.totalCapacity
    : selectedSiteSummary
      ? selectedSiteSummary.totalCapacity
      : selectionTotals.totalCapacity;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-7xl modal-panel flex h-[92vh] flex-col overflow-hidden">
                <div className="modal-header items-center">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Dashboard capienza', en: 'Capacity dashboard' })}</Dialog.Title>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Capienza totale per cliente/sede/piano, densità utenti e trend storico della capienza per sede.',
                        en: 'Total capacity per client/site/floor, user density, and historical capacity trend per site.'
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshHistory()}
                      disabled={historyLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title={t({ it: 'Aggiorna storico', en: 'Refresh history' })}
                    >
                      <RefreshCw size={15} className={historyLoading ? 'animate-spin' : ''} />
                      {t({ it: 'Aggiorna', en: 'Refresh' })}
                    </button>
                    <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="block text-sm font-medium text-slate-700">
                      <span>{t({ it: 'Cliente', en: 'Client' })}</span>
                      <select
                        value={selectedClient?.clientId || ''}
                        onChange={(e) => {
                          setSelectedClientId(e.target.value);
                          setSelectedSiteId(ALL_SITES);
                          setSelectedPlanId(ALL_PLANS);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                      >
                        {summary.clients.map((entry) => (
                          <option key={entry.clientId} value={entry.clientId}>
                            {entry.clientName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      <span>{t({ it: 'Sede', en: 'Site' })}</span>
                      <select
                        value={selectedSiteId}
                        onChange={(e) => {
                          setSelectedSiteId(e.target.value);
                          setSelectedPlanId(ALL_PLANS);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                      >
                        <option value={ALL_SITES}>{t({ it: 'Tutte le sedi', en: 'All sites' })}</option>
                        {(selectedClient?.sites || []).map((entry) => (
                          <option key={entry.siteId} value={entry.siteId}>
                            {entry.siteName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      <span>{t({ it: 'Planimetria', en: 'Floor plan' })}</span>
                      <select
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none ring-primary/30 focus:ring-2"
                      >
                        <option value={ALL_PLANS}>{t({ it: 'Tutte le planimetrie', en: 'All floor plans' })}</option>
                        {availablePlans.map((entry) => (
                          <option key={entry.key} value={entry.key}>
                            {selectedSiteId === ALL_SITES ? `${entry.siteName} > ${entry.planName}` : entry.planName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 flex h-[calc(100%-64px)] min-h-0 flex-col gap-3">
                    <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[1fr,1.1fr]">
                      <div className="min-h-0 space-y-2.5">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-2.5 py-2">
                            <div className="text-[11px] font-semibold text-slate-500">{t({ it: 'Capienza cliente', en: 'Client capacity' })}</div>
                            <div className="mt-0.5 text-xl font-black text-ink">{selectionTotals.totalCapacity || 0}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-2.5 py-2">
                            <div className="text-[11px] font-semibold text-slate-500">{t({ it: 'Utenti allocati', en: 'Allocated users' })}</div>
                            <div className="mt-0.5 text-xl font-black text-ink">{selectionTotals.totalUsers || 0}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-2.5 py-2">
                            <div className="text-[11px] font-semibold text-slate-500">{t({ it: 'Saturazione', en: 'Occupancy' })}</div>
                            <div className="mt-0.5 text-xl font-black text-ink">{formatPct(selectionTotals.occupancyPct ?? null)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-2.5 py-2">
                            <div className="text-[11px] font-semibold text-slate-500">{t({ it: 'mq / utente', en: 'Sqm / user' })}</div>
                            <div className="mt-0.5 text-xl font-black text-ink">{formatValue(selectionTotals.sqmPerUser ?? null, 2)}</div>
                          </div>
                        </div>

                        <div className="grid gap-2 lg:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                            <div className="text-sm font-semibold text-ink">{t({ it: 'Gauge cliente', en: 'Client gauge' })}</div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <CapacityGauge value={selectionTotals.totalUsers || 0} total={selectionTotals.totalCapacity || 0} size={118} />
                              <div className="w-40 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{t({ it: 'Utenti', en: 'Users' })}</span>
                                  <span className="font-semibold text-ink">{selectionTotals.totalUsers || 0}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <span>{t({ it: 'Capienza', en: 'Capacity' })}</span>
                                  <span className="font-semibold text-ink">{selectionTotals.totalCapacity || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                            <div className="text-sm font-semibold text-ink">{focusGaugeTitle}</div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <CapacityGauge value={focusGaugeUsers || 0} total={focusGaugeCapacity || 0} size={118} />
                              <div className="w-40 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{t({ it: 'Utenti', en: 'Users' })}</span>
                                  <span className="font-semibold text-ink">{focusGaugeUsers || 0}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <span>{t({ it: 'Capienza', en: 'Capacity' })}</span>
                                  <span className="font-semibold text-ink">{focusGaugeCapacity || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-ink">{t({ it: 'Dettaglio selezione', en: 'Selection details' })}</div>
                            <div className="text-xs text-slate-500">
                              {selectionTotals.sitesCount} {t({ it: 'sedi', en: 'sites' })} · {selectionTotals.floorsCount} {t({ it: 'planimetrie', en: 'floor plans' })}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                              <div className="text-slate-500">{t({ it: 'Capienza', en: 'Capacity' })}</div>
                              <div className="text-base font-bold text-ink">{selectionTotals.totalCapacity || 0}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                              <div className="text-slate-500">{t({ it: 'Utenti', en: 'Users' })}</div>
                              <div className="text-base font-bold text-ink">{selectionTotals.totalUsers || 0}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                              <div className="text-slate-500">{t({ it: 'Utenti / mq', en: 'Users / sqm' })}</div>
                              <div className="text-base font-bold text-ink">{formatValue(selectionTotals.usersPerSqm || null, 3)}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                              <div className="text-slate-500">{t({ it: 'mq / utente', en: 'Sqm / user' })}</div>
                              <div className="text-base font-bold text-ink">{formatValue(selectionTotals.sqmPerUser || null, 2)}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedSiteSummaries.map((site) => (
                              <span
                                key={site.siteId}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                              >
                                <span className="max-w-44 truncate">{site.siteName}</span>
                                <span className="text-slate-500">{site.totalUsers}/{site.totalCapacity || '--'}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 flex flex-col gap-2.5">
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-ink">{t({ it: 'Capienza per sede', en: 'Capacity per site' })}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-slate-500">{selectedSiteSummaries.length} {t({ it: 'sedi', en: 'sites' })}</div>
                              {overcrowdedRooms.length ? (
                                <button
                                  type="button"
                                  onClick={() => setShowOvercrowded((prev) => !prev)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  title={showOvercrowded
                                    ? t({ it: 'Nascondi sovraffollamenti', en: 'Hide overcrowded rooms' })
                                    : t({ it: 'Mostra sovraffollamenti', en: 'Show overcrowded rooms' })}
                                  aria-label={showOvercrowded
                                    ? t({ it: 'Nascondi sovraffollamenti', en: 'Hide overcrowded rooms' })
                                    : t({ it: 'Mostra sovraffollamenti', en: 'Show overcrowded rooms' })}
                                >
                                  <AlertTriangle size={13} />
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-2 max-h-40 space-y-1.5 overflow-auto pr-1">
                            {selectedSiteSummaries.map((site) => {
                              const ratio = site.totalCapacity > 0 ? Math.max(0, Math.min(100, (site.totalUsers / site.totalCapacity) * 100)) : 0;
                              return (
                                <div key={site.siteId} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5">
                                  <div className="flex items-center justify-between gap-3 text-sm leading-5">
                                    <div className="min-w-0 truncate font-semibold text-ink">{site.siteName}</div>
                                    <div className="text-[11px] font-semibold text-slate-600">
                                      {site.totalUsers}/{site.totalCapacity || '--'}
                                    </div>
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className={`h-full rounded-full ${ratio >= 100 ? 'bg-rose-500' : ratio >= 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${ratio}%` }}
                                    />
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] leading-5 text-slate-500">
                                    <span>
                                      {site.floorsCount} {t({ it: 'planimetrie', en: 'floor plans' })} · {site.roomsCount} {t({ it: 'stanze', en: 'rooms' })}
                                    </span>
                                    <span>{formatPct(site.occupancyPct)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {showOvercrowded ? (
                            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50/50 px-2.5 py-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                                {t({ it: 'Stanze sovraffollate', en: 'Overcrowded rooms' })}
                              </div>
                              {overcrowdedRooms.length ? (
                                <div className="mt-2 max-h-20 space-y-1 overflow-auto pr-1">
                                  {overcrowdedRooms.map((entry) => (
                                    <div key={`${entry.siteId}:${entry.planId}:${entry.roomId}`} className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs">
                                      <div className="font-semibold text-ink">
                                        {entry.siteName} &gt; {entry.planName}
                                      </div>
                                      <div className="mt-0.5 text-rose-700">
                                        {entry.roomName}: {entry.users}/{entry.capacity}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-2 rounded-lg border border-dashed border-rose-200 bg-white px-2 py-2 text-xs text-rose-700">
                                  {t({
                                    it: 'Nessuna stanza in sovraffollamento con i filtri correnti.',
                                    en: 'No overcrowded rooms for current filters.'
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-ink">
                              {t({ it: 'Trend capienza nel tempo (per sede)', en: 'Capacity trend over time (per site)' })}
                            </div>
                            <div className="text-xs text-slate-500">
                              {historySnapshots.length
                                ? `${historySnapshots.length} ${t({ it: 'snapshot', en: 'snapshots' })}`
                                : t({ it: 'Nessuno storico disponibile', en: 'No history available' })}
                            </div>
                          </div>

                          {historyError ? <div className="mt-2 text-xs text-rose-700">{historyError}</div> : null}

                          {!historyError && !historyLoading && !trendSeries.length ? (
                            <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              {t({
                                it: 'Storico non ancora disponibile con i filtri selezionati. Premi "Aggiorna" per salvare uno snapshot di capienza.',
                                en: 'History is not available for current filters. Press "Refresh" to store a capacity snapshot.'
                              })}
                            </div>
                          ) : null}

                          {trendSeries.length ? (
                            <div className="mt-2">
                              <CapacityTrendChart series={trendSeries} compact />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">{t({ it: 'Planimetrie selezionate', en: 'Selected floor plans' })}</div>
                        <div className="text-xs text-slate-500">
                          {selectedPlans.length} {t({ it: 'planimetrie', en: 'floor plans' })}
                        </div>
                      </div>
                      <div className="mt-2 overflow-x-auto overflow-y-hidden pb-1">
                        <div className="flex min-w-max gap-2">
                          {selectedPlans.map((floor) => (
                            <div key={floor.key} className="w-[300px] shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{floor.siteName}</div>
                                  <div className="mt-0.5 whitespace-normal break-words text-sm font-semibold text-ink">{floor.planName}</div>
                                </div>
                                <div className="shrink-0 text-sm font-bold text-slate-700">
                                  {floor.totalUsers}/{floor.totalCapacity || '--'}
                                </div>
                              </div>
                              <div className="mt-2 rounded-lg border border-slate-200 bg-white py-1">
                                <CapacityGauge value={floor.totalUsers || 0} total={floor.totalCapacity || 0} size={84} />
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 leading-tight">
                                  <div className="text-[10px] text-slate-500">{t({ it: 'Capienza', en: 'Capacity' })}</div>
                                  <div className="font-semibold text-ink">{floor.totalCapacity || 0}</div>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 leading-tight">
                                  <div className="text-[10px] text-slate-500">{t({ it: 'Utenti', en: 'Users' })}</div>
                                  <div className="font-semibold text-ink">{floor.totalUsers || 0}</div>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 leading-tight">
                                  <div className="text-[10px] text-slate-500">{t({ it: 'Utenti / mq', en: 'Users / sqm' })}</div>
                                  <div className="font-semibold text-ink">{formatValue(floor.usersPerSqm ?? null, 3)}</div>
                                </div>
                                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 leading-tight">
                                  <div className="text-[10px] text-slate-500">{t({ it: 'mq / utente', en: 'Sqm / user' })}</div>
                                  <div className="font-semibold text-ink">{formatValue(floor.sqmPerUser ?? null, 2)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    {t({ it: 'Chiudi', en: 'Close' })}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CapacityDashboardModal;
