import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Building2, LocateFixed, MapPinned, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { Client } from '../../store/types';
import { buildCapacityMetrics, findCapacityClientMetric, findCapacitySiteMetric } from '../../utils/capacityMetrics';

interface Props {
  open: boolean;
  clients: Client[];
  currentClientId?: string | null;
  currentSiteId?: string | null;
  onHighlight: (payload: { planId: string; roomId: string }) => void;
  onClose: () => void;
}

const RoomAllocationModal = ({ open, clients, currentClientId, currentSiteId, onHighlight, onClose }: Props) => {
  const t = useT();
  const [requested, setRequested] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [includeEmptyRooms, setIncludeEmptyRooms] = useState(false);
  const [includeOtherDepartments, setIncludeOtherDepartments] = useState(false);

  const summary = useMemo(() => buildCapacityMetrics(clients || []), [clients]);

  useEffect(() => {
    if (!open) return;
    setRequested('');
    setSelectedDepartment('');
    setIncludeEmptyRooms(false);
    setIncludeOtherDepartments(false);
    const preferredClient = String(currentClientId || '').trim();
    const firstClient = summary.clients[0]?.clientId || '';
    const nextClientId = summary.clients.some((entry) => entry.clientId === preferredClient) ? preferredClient : firstClient;
    setSelectedClientId(nextClientId);
    const preferredSite = String(currentSiteId || '').trim();
    const candidateClient = summary.clients.find((entry) => entry.clientId === nextClientId);
    const firstSite = candidateClient?.sites?.[0]?.siteId || '';
    const nextSiteId = candidateClient?.sites?.some((entry) => entry.siteId === preferredSite) ? preferredSite : firstSite;
    setSelectedSiteId(nextSiteId);
  }, [currentClientId, currentSiteId, open, summary.clients]);

  const selectedClient = useMemo(
    () => findCapacityClientMetric(summary, selectedClientId) || null,
    [selectedClientId, summary]
  );

  useEffect(() => {
    if (!selectedClient) return;
    if (selectedClientId !== selectedClient.clientId) setSelectedClientId(selectedClient.clientId);
    if (selectedClient.sites.some((entry) => entry.siteId === selectedSiteId)) return;
    setSelectedSiteId(selectedClient.sites[0]?.siteId || '');
  }, [selectedClient, selectedClientId, selectedSiteId]);

  const selectedSite = useMemo(() => findCapacitySiteMetric(selectedClient, selectedSiteId) || null, [selectedClient, selectedSiteId]);

  const requestedCount = Math.max(0, Math.floor(Number(requested) || 0));
  const departmentNorm = String(selectedDepartment || '').trim().toLocaleLowerCase();

  const candidates = useMemo(() => {
    if (!selectedSite || !requestedCount) return [];

    return selectedSite.floors
      .flatMap((floor) =>
        floor.rooms.map((room) => {
          const capacity = Number.isFinite(Number(room.capacity)) ? Math.max(0, Math.floor(Number(room.capacity))) : 0;
          const seatsAfterRequest = capacity - room.userCount - requestedCount;
          if (seatsAfterRequest < 0) return null;

          const roomDeptSet = new Set(room.departmentTags.map((entry) => entry.toLocaleLowerCase()));
          const matchesDepartment = !departmentNorm || roomDeptSet.has(departmentNorm);
          const isEmptyRoom = room.userCount === 0;

          if (departmentNorm) {
            if (!matchesDepartment && !(includeEmptyRooms && isEmptyRoom) && !includeOtherDepartments) return null;
          }

          const fitScore = Math.max(0, seatsAfterRequest || 0);
          const deptRank = !departmentNorm ? 0 : matchesDepartment ? 0 : isEmptyRoom ? 1 : 2;

          return {
            ...room,
            deptRank,
            fitScore,
            availableSeats: Math.max(0, capacity - room.userCount),
            capacity,
            floorOccupancyPct: floor.occupancyPct,
            matchesDepartment,
            isEmptyRoom
          };
        })
      )
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (a.deptRank !== b.deptRank) return a.deptRank - b.deptRank;
        if (a.fitScore !== b.fitScore) return a.fitScore - b.fitScore;
        if (a.planName !== b.planName) return a.planName.localeCompare(b.planName);
        return a.roomName.localeCompare(b.roomName);
      });
  }, [departmentNorm, includeEmptyRooms, includeOtherDepartments, requestedCount, selectedSite]);

  const canBroadenToEmpty = !!departmentNorm && !includeEmptyRooms;
  const canBroadenToCrossDept = !!departmentNorm && includeEmptyRooms && !includeOtherDepartments;

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
              <Dialog.Panel className="w-full max-w-4xl modal-panel">
                <div className="modal-header items-center">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Trova sistemazione', en: 'Find placement' })}</Dialog.Title>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Parti da cliente/sede e reparto: Plixmap propone le stanze migliori in base a capienza disponibile.',
                        en: 'Start from client/site and department: Plixmap suggests the best rooms based on available capacity.'
                      })}
                    </div>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
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
                      {(summary.clients || []).map((entry) => (
                        <option key={entry.clientId} value={entry.clientId}>
                          {entry.clientName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Sede', en: 'Site' })}
                    <select
                      value={selectedSite?.siteId || ''}
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

                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Reparto del nuovo tecnico', en: 'New technician department' })}
                    <select
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setIncludeEmptyRooms(false);
                        setIncludeOtherDepartments(false);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    >
                      <option value="">{t({ it: 'Qualsiasi reparto', en: 'Any department' })}</option>
                      {(selectedSite?.departmentPool || []).map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Quanti tecnici devi allocare?', en: 'How many technicians do you need to place?' })}
                    <input
                      value={requested}
                      onChange={(e) => setRequested(e.target.value)}
                      inputMode="numeric"
                      type="number"
                      min={1}
                      step={1}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. 3', en: 'e.g. 3' })}
                    />
                  </label>
                </div>

                {departmentNorm ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includeEmptyRooms}
                          onChange={(e) => {
                            setIncludeEmptyRooms(e.target.checked);
                            if (!e.target.checked) setIncludeOtherDepartments(false);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-primary"
                        />
                        <span>{t({ it: 'Considera anche uffici vuoti', en: 'Also include empty offices' })}</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={includeOtherDepartments}
                          onChange={(e) => {
                            setIncludeOtherDepartments(e.target.checked);
                            if (e.target.checked) setIncludeEmptyRooms(true);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-primary"
                        />
                        <span>{t({ it: 'Considera anche uffici di altri reparti', en: 'Also include other department offices' })}</span>
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <div className="font-semibold text-slate-700">{t({ it: 'Capienza sede', en: 'Site capacity' })}</div>
                      <div className="mt-1 text-sm font-bold text-ink">{selectedSite?.totalCapacity || 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <div className="font-semibold text-slate-700">{t({ it: 'Utenti attuali', en: 'Current users' })}</div>
                      <div className="mt-1 text-sm font-bold text-ink">{selectedSite?.totalUsers || 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <div className="font-semibold text-slate-700">{t({ it: 'Piani coperti', en: 'Floors covered' })}</div>
                      <div className="mt-1 text-sm font-bold text-ink">{selectedSite?.floorsCount || 0}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <div className="font-semibold text-slate-700">{t({ it: 'Stanze analizzate', en: 'Rooms analyzed' })}</div>
                      <div className="mt-1 text-sm font-bold text-ink">{selectedSite?.roomsCount || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {!requestedCount ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {t({ it: 'Inserisci il numero di tecnici per ottenere le opzioni di sistemazione.', en: 'Enter technicians count to get placement options.' })}
                    </div>
                  ) : candidates.length ? (
                    <div className="max-h-[24rem] space-y-2 overflow-auto">
                      {candidates.map((room: any) => {
                        const saturationLabel = `${room.userCount}/${room.capacity}`;
                        const availableLabel = t({
                          it: `${room.availableSeats} posti liberi`,
                          en: `${room.availableSeats} seats free`
                        });
                        return (
                          <button
                            key={`${room.planId}:${room.roomId}`}
                            onClick={() => {
                              onHighlight({ planId: room.planId, roomId: room.roomId });
                              onClose();
                            }}
                            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
                            title={t({ it: 'Evidenzia stanza', en: 'Highlight room' })}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-ink">{room.roomName}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1">
                                    <Building2 size={12} /> {room.clientName}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <MapPinned size={12} /> {room.siteName} · {room.planName}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{saturationLabel}</span>
                                <span className="text-slate-500">{availableLabel}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              {room.matchesDepartment && departmentNorm ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                  {t({ it: 'Reparto coerente', en: 'Department match' })}
                                </span>
                              ) : null}
                              {room.isEmptyRoom ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                                  {t({ it: 'Ufficio vuoto', en: 'Empty office' })}
                                </span>
                              ) : null}
                              {room.departmentTags.length ? (
                                room.departmentTags.slice(0, 3).map((tag: string) => (
                                  <span key={tag} className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                  {t({ it: 'Senza reparto', en: 'No department' })}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {t({ it: 'Saturazione piano', en: 'Floor occupancy' })}:{' '}
                                {room.floorOccupancyPct !== null && Number.isFinite(room.floorOccupancyPct)
                                  ? `${Math.round(room.floorOccupancyPct)}%`
                                  : '--'}
                              </span>
                              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                                <LocateFixed size={12} /> {t({ it: 'Vai alla stanza', en: 'Go to room' })}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      <div className="font-semibold">
                        {t({ it: 'Nessuna opzione trovata con i filtri attuali.', en: 'No options found with current filters.' })}
                      </div>
                      <div className="mt-1 text-xs text-amber-800">
                        {departmentNorm
                          ? t({
                              it: 'Puoi ampliare la ricerca includendo uffici vuoti o reparti diversi.',
                              en: 'You can broaden the search by including empty offices or other departments.'
                            })
                          : t({
                              it: 'Aumenta la disponibilità delle stanze o riduci il numero di tecnici da allocare.',
                              en: 'Increase room availability or reduce the number of technicians to place.'
                            })}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canBroadenToEmpty ? (
                          <button
                            type="button"
                            onClick={() => setIncludeEmptyRooms(true)}
                            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                          >
                            {t({ it: 'Considera uffici vuoti', en: 'Include empty offices' })}
                          </button>
                        ) : null}
                        {canBroadenToCrossDept ? (
                          <button
                            type="button"
                            onClick={() => setIncludeOtherDepartments(true)}
                            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                          >
                            {t({ it: 'Considera altri reparti', en: 'Include other departments' })}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
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

export default RoomAllocationModal;
