

import { ChevronDown, Trash, Square, X, Pencil, BarChart3, LocateFixed, Users } from 'lucide-react';

import Icon from '../ui/Icon';

import { usePlanView } from './usePlanView';

type RoomsMenuPanelProps = Pick<ReturnType<typeof usePlanView>, 'beginRoomDraw' | 'beginRoomPolyDraw' | 'clearSelection' | 'expandedRoomId' | 'getTypeIcon' | 'isReadOnly' | 'newRoomMenuOpen' | 'openEditRoom' | 'roomDrawMode' | 'roomStatsById' | 'rooms' | 'selectedRoomId' | 'setCapacityDashboardOpen' | 'setCapacityDashboardPreset' | 'setConfirmDeleteRoomId' | 'setExpandedRoomId' | 'setHighlightRoom' | 'setNewRoomMenuOpen' | 'setRoomAllocationOpen' | 'setRoomAllocationPreset' | 'setRoomDrawMode' | 'setRoomsOpen' | 'setSelectedObject' | 'setSelectedRoomId' | 'setSelectedRoomIds' | 't' | 'triggerHighlight'>;

const RoomsMenuPanel = (props: RoomsMenuPanelProps) => {
  const {
    beginRoomDraw,
    beginRoomPolyDraw,
    clearSelection,
    expandedRoomId,
    getTypeIcon,
    isReadOnly,
    newRoomMenuOpen,
    openEditRoom,
    roomDrawMode,
    roomStatsById,
    rooms,
    selectedRoomId,
    setCapacityDashboardOpen,
    setCapacityDashboardPreset,
    setConfirmDeleteRoomId,
    setExpandedRoomId,
    setHighlightRoom,
    setNewRoomMenuOpen,
    setRoomAllocationOpen,
    setRoomAllocationPreset,
    setRoomDrawMode,
    setRoomsOpen,
    setSelectedObject,
    setSelectedRoomId,
    setSelectedRoomIds,
    t,
    triggerHighlight
  } = props;
  return (
                <div className="absolute left-0 z-50 mt-2 w-[420px] rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="text-sm font-semibold text-ink">{t({ it: 'Stanze', en: 'Rooms' })}</div>
	                    <button onClick={() => setRoomsOpen(false)} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
	                      <X size={14} />
	                    </button>
                  </div>
                  <div className="px-2 pb-2">
                    {!isReadOnly ? (
                      <div className="relative">
	                        <button
	                          onClick={() => setNewRoomMenuOpen((v) => !v)}
	                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
	                          title={t({ it: 'Nuova stanza', en: 'New room' })}
	                        >
                          <Square size={16} /> {t({ it: 'Nuova stanza', en: 'New room' })}
                          <ChevronDown size={16} className="text-white/90" />
                        </button>
                        {newRoomMenuOpen ? (
                          <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
	                            <button
	                              onClick={() => {
	                                setNewRoomMenuOpen(false);
	                                beginRoomDraw();
	                              }}
	                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
	                              title={t({ it: 'Rettangolo', en: 'Rectangle' })}
	                            >
                              <Square size={16} className="text-slate-500" /> {t({ it: 'Rettangolo', en: 'Rectangle' })}
                            </button>
	                            <button
	                              onClick={() => {
	                                setNewRoomMenuOpen(false);
	                                beginRoomPolyDraw();
	                              }}
	                              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
	                              title={t({ it: 'Poligono', en: 'Polygon' })}
	                            >
                              <Square size={16} className="text-slate-500" /> {t({ it: 'Poligono', en: 'Polygon' })}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {t({ it: 'Sola lettura.', en: 'Read-only.' })}
                      </div>
                    )}
                    {roomDrawMode && !isReadOnly ? (
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        <span>{t({ it: 'Modalità disegno attiva', en: 'Drawing mode active' })}</span>
	                        <button
	                          onClick={() => setRoomDrawMode(null)}
	                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
	                          title={t({ it: 'Annulla disegno', en: 'Cancel drawing' })}
	                        >
	                          Esc
	                        </button>
                      </div>
                    ) : null}
	                    <button
	                      onClick={() => {
	                        setRoomAllocationPreset(null);
	                        setRoomAllocationOpen(true);
	                      }}
	                      disabled={!rooms.length}
	                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
	                      title={t({ it: 'Trova capienza', en: 'Find capacity' })}
	                    >
                      <Users size={16} /> {t({ it: 'Trova capienza', en: 'Find capacity' })}
                    </button>
                    <button
                      onClick={() => {
                        setCapacityDashboardPreset(null);
                        setCapacityDashboardOpen(true);
                      }}
                      disabled={!rooms.length}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
                      title={t({ it: 'Stato capienza', en: 'Capacity dashboard' })}
                    >
                      <BarChart3 size={16} /> {t({ it: 'Stato capienza', en: 'Capacity dashboard' })}
                    </button>
                  </div>
                  <div className="max-h-[28rem] space-y-3 overflow-auto px-3 pb-3">
                    {rooms.length ? (
                      rooms.map((room) => {
                        const isExpanded = expandedRoomId === room.id;
                        const stats =
                          roomStatsById.get(room.id) || ({ items: [], userCount: 0, otherCount: 0, totalCount: 0 } as const);
                        const assigned = stats.items;
                        const rawCapacity = Number(room.capacity);
                        const capacity = Number.isFinite(rawCapacity) ? Math.max(0, Math.floor(rawCapacity)) : 0;
                        const capacityLabel = `${stats.userCount}/${capacity}`;
                        const overCapacity = stats.userCount > capacity;
                        return (
                          <div key={room.id} className="rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 px-4 py-3">
	                              <button
	                                onClick={() => {
	                                  setExpandedRoomId(isExpanded ? null : room.id);
	                                  clearSelection();
	                                  setSelectedRoomId(room.id);
	                                  setSelectedRoomIds([room.id]);
	                                  setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
	                                }}
	                                className={`min-w-0 flex-1 text-left text-sm ${
	                                  selectedRoomId === room.id ? 'font-semibold text-ink' : 'text-slate-700'
	                                }`}
	                                title={room.name}
	                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate">{room.name}</div>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      overCapacity ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {capacityLabel}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {t({
                                    it: `${stats.otherCount} oggetti · ${stats.userCount} utenti (tot ${stats.totalCount})`,
                                    en: `${stats.otherCount} objects · ${stats.userCount} users (tot ${stats.totalCount})`
                                  })}
                                </div>
                              </button>
                              <div className="flex items-center gap-2">
                                <button
                                  title={t({ it: 'Evidenzia', en: 'Highlight' })}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRoomId(room.id);
                                    setSelectedRoomIds([room.id]);
                                    setHighlightRoom({ roomId: room.id, until: Date.now() + 3200 });
                                  }}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                >
                                  <LocateFixed size={16} />
                                </button>
                                {!isReadOnly ? (
                                  <>
                                    <button
                                      title={t({ it: 'Rinomina', en: 'Rename' })}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditRoom(room.id);
                                        setRoomsOpen(false);
                                      }}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      title={t({ it: 'Elimina', en: 'Delete' })}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteRoomId(room.id);
                                        setRoomsOpen(false);
                                      }}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    >
                                      <Trash size={16} />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {isExpanded ? (
                              <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                                {assigned.length ? (
                                  <div className="space-y-1">
                                    {assigned.map((o) => (
	                                      <button
	                                        key={o.id}
	                                        onClick={() => {
	                                          setSelectedObject(o.id);
	                                          triggerHighlight(o.id);
	                                          setRoomsOpen(false);
	                                        }}
	                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-50"
	                                        title={o.name}
	                                      >
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
                                          <Icon name={getTypeIcon(o.type)} />
                                        </span>
                                        <span className="truncate">{o.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    {t({ it: 'Nessun oggetto in questa stanza.', en: 'No objects in this room.' })}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {t({
                          it: 'Nessuna stanza. Crea una stanza per organizzare gli oggetti.',
                          en: 'No rooms. Create a room to organize objects.'
                        })}
                        {!isReadOnly ? (
                          <div className="mt-2">
	                            <button
	                              onClick={() => {
	                                setNewRoomMenuOpen(true);
	                              }}
	                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
	                              title={t({ it: 'Crea stanza', en: 'Create room' })}
	                            >
                              {t({ it: 'Crea stanza', en: 'Create room' })}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
  );
};

export default RoomsMenuPanel;
