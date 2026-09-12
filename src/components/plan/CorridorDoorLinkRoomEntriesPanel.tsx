

import { usePlanView } from './usePlanView';

type CorridorDoorLinkRoomEntriesPanelProps = Pick<ReturnType<typeof usePlanView>, 'corridorDoorLinkModal' | 'corridorDoorLinkRoomEntries' | 'setCorridorDoorLinkModal' | 't'>;

const CorridorDoorLinkRoomEntriesPanel = (props: CorridorDoorLinkRoomEntriesPanelProps) => {
  const {
    corridorDoorLinkModal,
    corridorDoorLinkRoomEntries,
    setCorridorDoorLinkModal,
    t
  } = props;
  return (
                      corridorDoorLinkRoomEntries.map((entry) => {
                        const checked = !!corridorDoorLinkModal?.selectedRoomIds.includes(entry.id);
                        return (
                          <label
                            key={entry.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 ${
                              checked ? 'border-primary/40 bg-primary/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nextChecked = e.target.checked;
                                setCorridorDoorLinkModal((prev) => {
                                  if (!prev) return prev;
                                  const ids = nextChecked
                                    ? Array.from(new Set([...prev.selectedRoomIds, entry.id]))
                                    : prev.selectedRoomIds.filter((id) => id !== entry.id);
                                  return { ...prev, selectedRoomIds: ids };
                                });
                              }}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-800">
                                {entry.name}{' '}
                                {entry.isNearest ? (
                                  <span
                                    className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900"
                                    title={t({
                                      it: 'Stanza più vicina alla porta rilevata automaticamente.',
                                      en: 'Nearest room to this door, detected automatically.'
                                    })}
                                  >
                                    {t({ it: 'rilevata prossimità', en: 'proximity detected' })}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-600">
                                {t({
                                  it: `Utenti: ${entry.userCount} · Utenti reali: ${entry.realUserCount}`,
                                  en: `Users: ${entry.userCount} · Real users: ${entry.realUserCount}`
                                })}
                              </div>
                              {entry.isMagnetic ? (
                                <div
                                  className="mt-0.5 inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800"
                                  title={t({
                                    it: 'La stanza è adiacente al perimetro del corridoio vicino alla porta.',
                                    en: 'The room is adjacent to the corridor perimeter near this door.'
                                  })}
                                >
                                  {t({ it: 'Aggancio magnetico corridoio rilevato', en: 'Corridor magnetic match detected' })}
                                </div>
                              ) : null}
                              <div className="mt-1 text-[11px] text-slate-500">
                                {entry.userNames.length
                                  ? entry.userNames.join(', ')
                                  : t({ it: 'Nessun utente assegnato alla stanza', en: 'No users assigned to this room' })}
                              </div>
                            </div>
                          </label>
                        );
                      })
  );
};

export default CorridorDoorLinkRoomEntriesPanel;
