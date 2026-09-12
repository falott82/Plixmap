/* eslint-disable @typescript-eslint/no-explicit-any */
import { Eye } from 'lucide-react';
import { resolveRoomServices } from './MeetingManagerModal.helpers';

type Translate = (msg: { it: string; en: string }) => string;

export type MeetingRoomBrowseListProps = {
  roomsWithAvailability: Array<{ room: any; selectable: boolean; slotBlocked: boolean; missingNeeds: any[] }>;
  selectableRoomsCount: number;
  overviewRows: any[];
  loadingOverview: boolean;
  selectedSite: any;
  setRoomPreview: (v: { roomId: string; floorPlanId: string }) => void;
  openDetailsForRoom: (roomId: string) => void;
  t: Translate;
};

/**
 * Browse-step list of available meeting rooms (availability badge, capacity,
 * service icons, preview + select actions). Extracted from MeetingManagerModal.
 */
export const MeetingRoomBrowseList = ({
  roomsWithAvailability,
  selectableRoomsCount,
  overviewRows,
  loadingOverview,
  selectedSite,
  setRoomPreview,
  openDetailsForRoom,
  t
}: MeetingRoomBrowseListProps) => (
                  <div className="mt-3 rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Meeting rooms disponibili', en: 'Available meeting rooms' })}</div>
                      <span className="text-xs text-slate-500">
                        {loadingOverview
                          ? t({ it: 'Aggiornamento...', en: 'Updating...' })
                          : t({ it: `${selectableRoomsCount}/${overviewRows.length} disponibili`, en: `${selectableRoomsCount}/${overviewRows.length} available` })}
                      </span>
                    </div>
                    <div className="grid max-h-[56vh] grid-cols-1 gap-2 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                      {roomsWithAvailability.map(({ room, selectable, slotBlocked, missingNeeds }) => {
                        const serviceIcons = resolveRoomServices(room.equipment || []);
                        return (
                          <div
                            key={room.roomId}
                            className={`rounded-xl border px-3 py-3 transition ${
                              selectable
                                ? 'border-emerald-400 bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100'
                                : 'border-rose-300 bg-rose-50/80 opacity-90'
                            }`}
                          >
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div className="truncate text-sm font-semibold text-ink">{room.roomName}</div>
                                  <button
                                    type="button"
                                    onClick={() => setRoomPreview({ roomId: room.roomId, floorPlanId: room.floorPlanId })}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Mostra planimetria', en: 'Show floor plan' })}
                                  >
                                    <Eye size={12} />
                                  </button>
                                </div>
                                <div className="truncate text-[10px] leading-4 text-slate-700">{room.siteName || selectedSite?.name || ''}</div>
                                <div className="truncate text-[10px] leading-4 text-slate-600">{room.floorPlanName}</div>
                              </div>
                              <div className="text-xs font-semibold text-slate-700">{room.currentPeople}/{room.capacity}</div>
                            </div>
                          </div>
                          <div className="mt-1 text-[10px] leading-4 text-slate-700">
                            {Number.isFinite(Number(room.surfaceSqm)) && Number(room.surfaceSqm) > 0
                              ? `${t({ it: 'Superficie', en: 'Surface' })}: ${Number(room.surfaceSqm).toFixed(1)} mq`
                              : t({ it: 'Superficie non disponibile', en: 'Surface not available' })}
                          </div>
                          <div className={`mt-1.5 text-xs font-semibold ${slotBlocked || missingNeeds.length ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {slotBlocked
                              ? t({ it: 'Occupata nello slot selezionato', en: 'Busy in selected slot' })
                              : missingNeeds.length
                                ? t({ it: 'Mancano dotazioni richieste', en: 'Missing required equipment' })
                                : t({ it: 'Disponibile', en: 'Available' })}
                          </div>
                          <div className="mt-1.5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetailsForRoom(room.roomId)}
                              disabled={!selectable}
                              className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t({ it: 'Seleziona', en: 'Select' })}
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {serviceIcons.map((service) => {
                              const ServiceIcon = service.icon;
                              return (
                                <span
                                  key={`${room.roomId}-${service.key}`}
                                  className="group relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700"
                                >
                                  <ServiceIcon size={12} />
                                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                                    {t(service.labels)}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                      {!roomsWithAvailability.length ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          {t({ it: 'Nessuna meeting room disponibile in questa selezione.', en: 'No meeting rooms available in this scope.' })}
                        </div>
                      ) : null}
                    </div>
                  </div>
);
