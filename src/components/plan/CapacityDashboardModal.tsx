import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { RefreshCw, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { Client } from '../../store/types';
import { useAuthStore } from '../../store/useAuthStore';
import { createCapacitySnapshot, fetchCapacityHistory, type CapacityHistorySnapshot } from '../../api/capacity';
import { buildCapacityMetrics, findCapacityClientMetric, findCapacitySiteMetric } from '../../utils/capacityMetrics';

interface Props {
  open: boolean;
  clients: Client[];
  currentClientId?: string | null;
  currentSiteId?: string | null;
  onClose: () => void;
}

const COLORS = ['#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0f766e', '#ea580c'];

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

const CapacityTrendChart = ({ series }: { series: ReturnType<typeof normalizeSeries> }) => {
  if (!series.length) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No data</div>;
  }
  const allPoints = series.flatMap((entry) => entry.points);
  const minAt = Math.min(...allPoints.map((point) => point.at));
  const maxAt = Math.max(...allPoints.map((point) => point.at));
  const maxCapacity = Math.max(1, ...allPoints.map((point) => point.capacity));
  const left = 48;
  const right = 16;
  const top = 12;
  const bottom = 28;
  const width = 920;
  const height = 260;
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const xForAt = (at: number) => {
    if (maxAt === minAt) return left + chartW / 2;
    return left + ((at - minAt) / (maxAt - minAt)) * chartW;
  };
  const yForCapacity = (capacity: number) => top + chartH - (capacity / maxCapacity) * chartH;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="capacity trend">
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
      <div className="mt-2 flex flex-wrap gap-2">
        {series.map((entry, index) => {
          const color = COLORS[index % COLORS.length];
          const first = entry.points[0]?.capacity || 0;
          const last = entry.points[entry.points.length - 1]?.capacity || 0;
          const delta = last - first;
          return (
            <span
              key={entry.siteId}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
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
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [historySnapshots, setHistorySnapshots] = useState<CapacityHistorySnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const summary = useMemo(() => buildCapacityMetrics(clients || []), [clients]);
  const selectedClient = useMemo(
    () => findCapacityClientMetric(summary, selectedClientId) || null,
    [selectedClientId, summary]
  );
  const selectedSite = useMemo(() => findCapacitySiteMetric(selectedClient, selectedSiteId), [selectedClient, selectedSiteId]);

  useEffect(() => {
    if (!open) return;
    const preferredClient = String(currentClientId || '').trim();
    const firstClient = summary.clients[0]?.clientId || '';
    const nextClientId = summary.clients.some((entry) => entry.clientId === preferredClient) ? preferredClient : firstClient;
    setSelectedClientId(nextClientId);
    const preferredSite = String(currentSiteId || '').trim();
    const client = summary.clients.find((entry) => entry.clientId === nextClientId);
    const firstSite = client?.sites[0]?.siteId || '';
    const nextSiteId = client?.sites.some((entry) => entry.siteId === preferredSite) ? preferredSite : firstSite;
    setSelectedSiteId(nextSiteId);
  }, [currentClientId, currentSiteId, open, summary.clients]);

  useEffect(() => {
    if (!selectedClient) return;
    if (selectedClient.clientId !== selectedClientId) setSelectedClientId(selectedClient.clientId);
    if (selectedClient.sites.some((entry) => entry.siteId === selectedSiteId)) return;
    setSelectedSiteId(selectedClient.sites[0]?.siteId || '');
  }, [selectedClient, selectedClientId, selectedSiteId]);

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
    return normalizeSeries(historySnapshots, selectedClient.clientId);
  }, [historySnapshots, selectedClient]);

  const targetSite = selectedSite || selectedClient?.sites?.[0] || null;

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
              <Dialog.Panel className="w-full max-w-6xl modal-panel">
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

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Cliente', en: 'Client' })}
                    <select
                      value={selectedClient?.clientId || ''}
                      onChange={(e) => {
                        setSelectedClientId(e.target.value);
                        setSelectedSiteId('');
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    >
                      {summary.clients.map((entry) => (
                        <option key={entry.clientId} value={entry.clientId}>
                          {entry.clientName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Sede', en: 'Site' })}
                    <select
                      value={targetSite?.siteId || ''}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    >
                      {(selectedClient?.sites || []).map((entry) => (
                        <option key={entry.siteId} value={entry.siteId}>
                          {entry.siteName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold text-slate-500">{t({ it: 'Capienza totale cliente', en: 'Client total capacity' })}</div>
                    <div className="mt-1 text-2xl font-black text-ink">{selectedClient?.totalCapacity || 0}</div>
                    <div className="mt-1 text-xs text-slate-500">{t({ it: 'Postazioni configurate', en: 'Configured seats' })}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold text-slate-500">{t({ it: 'Utenti allocati', en: 'Allocated users' })}</div>
                    <div className="mt-1 text-2xl font-black text-ink">{selectedClient?.totalUsers || 0}</div>
                    <div className="mt-1 text-xs text-slate-500">{t({ it: 'Utenti in stanza', en: 'Users in rooms' })}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold text-slate-500">{t({ it: 'Saturazione', en: 'Occupancy' })}</div>
                    <div className="mt-1 text-2xl font-black text-ink">{formatPct(selectedClient?.occupancyPct ?? null)}</div>
                    <div className="mt-1 text-xs text-slate-500">{t({ it: 'Rapporto utenti/capienza', en: 'Users/capacity ratio' })}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold text-slate-500">{t({ it: 'Densità mq/utente', en: 'Sqm per user' })}</div>
                    <div className="mt-1 text-2xl font-black text-ink">{formatValue(selectedClient?.sqmPerUser ?? null, 2)}</div>
                    <div className="mt-1 text-xs text-slate-500">{t({ it: 'mq disponibili per utente', en: 'sqm available per user' })}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr,1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Capienza per sede', en: 'Capacity per site' })}</div>
                      <div className="text-xs text-slate-500">{selectedClient?.sitesCount || 0} {t({ it: 'sedi', en: 'sites' })}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(selectedClient?.sites || []).map((site) => {
                        const ratio = site.totalCapacity > 0 ? Math.max(0, Math.min(100, (site.totalUsers / site.totalCapacity) * 100)) : 0;
                        return (
                          <div key={site.siteId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0 truncate font-semibold text-ink">{site.siteName}</div>
                              <div className="text-xs font-semibold text-slate-600">
                                {site.totalUsers}/{site.totalCapacity || '--'}
                              </div>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${ratio >= 100 ? 'bg-rose-500' : ratio >= 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span>
                                {site.floorsCount} {t({ it: 'piani', en: 'floors' })} · {site.roomsCount} {t({ it: 'stanze', en: 'rooms' })}
                              </span>
                              <span>{formatPct(site.occupancyPct)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Dettaglio sede selezionata', en: 'Selected site details' })}</div>
                      <div className="text-xs text-slate-500">{targetSite?.siteName || '--'}</div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        <div className="text-slate-500">{t({ it: 'Capienza', en: 'Capacity' })}</div>
                        <div className="mt-1 text-lg font-bold text-ink">{targetSite?.totalCapacity || 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        <div className="text-slate-500">{t({ it: 'Utenti', en: 'Users' })}</div>
                        <div className="mt-1 text-lg font-bold text-ink">{targetSite?.totalUsers || 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        <div className="text-slate-500">{t({ it: 'Utenti / mq', en: 'Users / sqm' })}</div>
                        <div className="mt-1 text-lg font-bold text-ink">{formatValue(targetSite?.usersPerSqm || null, 3)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        <div className="text-slate-500">{t({ it: 'mq / utente', en: 'Sqm / user' })}</div>
                        <div className="mt-1 text-lg font-bold text-ink">{formatValue(targetSite?.sqmPerUser || null, 2)}</div>
                      </div>
                    </div>
                    <div className="mt-3 max-h-48 space-y-2 overflow-auto">
                      {(targetSite?.floors || []).map((floor) => (
                        <div key={floor.planId} className="rounded-lg border border-slate-200 px-3 py-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-ink">{floor.planName}</span>
                            <span className="text-xs text-slate-500">{floor.totalUsers}/{floor.totalCapacity || '--'}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {floor.roomsCount} {t({ it: 'stanze', en: 'rooms' })} · {t({ it: 'Saturazione', en: 'Occupancy' })}: {formatPct(floor.occupancyPct)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
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
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      {t({
                        it: 'Storico non ancora disponibile. Premi "Aggiorna" per salvare uno snapshot di capienza e avviare il trend.',
                        en: 'History not available yet. Press "Refresh" to store a capacity snapshot and start the trend.'
                      })}
                    </div>
                  ) : null}

                  {trendSeries.length ? <div className="mt-3"><CapacityTrendChart series={trendSeries} /></div> : null}
                </div>

                <div className="mt-6 flex justify-end">
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
