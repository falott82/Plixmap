import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { LocateFixed, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { MapObject, Room } from '../../store/types';

type RoomStats = { items: MapObject[]; userCount: number; otherCount: number; totalCount: number };

interface Props {
  open: boolean;
  rooms: Room[];
  roomStatsById: Map<string, RoomStats>;
  onHighlight: (roomId: string) => void;
  onClose: () => void;
}

const RoomAllocationModal = ({ open, rooms, roomStatsById, onHighlight, onClose }: Props) => {
  const t = useT();
  const [requested, setRequested] = useState('');

  useEffect(() => {
    if (!open) return;
    setRequested('');
  }, [open]);

  const requestedCount = Math.max(0, Number(requested) || 0);

  const candidates = useMemo(() => {
    if (!requestedCount) return [];
    return rooms
      .map((room) => {
        const stats = roomStatsById.get(room.id) || { items: [], userCount: 0, otherCount: 0, totalCount: 0 };
        const rawCapacity = Number(room.capacity);
        const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.floor(rawCapacity) : undefined;
        const available = capacity ? capacity - stats.userCount : Infinity;
        return {
          id: room.id,
          name: room.name,
          userCount: stats.userCount,
          capacity,
          available
        };
      })
      .filter((room) => room.available >= requestedCount)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [requestedCount, roomStatsById, rooms]);

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
              <Dialog.Panel className="w-full max-w-md modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">
                    {t({ it: 'Allocazione utenti', en: 'User allocation' })}
                  </Dialog.Title>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Quanti utenti devi allocare?', en: 'How many users do you need to allocate?' })}
                    <input
                      value={requested}
                      onChange={(e) => setRequested(e.target.value)}
                      inputMode="numeric"
                      type="number"
                      min={1}
                      step={1}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. 4', en: 'e.g. 4' })}
                    />
                  </label>

                  {!requestedCount ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {t({ it: 'Inserisci un numero per vedere le stanze disponibili.', en: 'Enter a number to see available rooms.' })}
                    </div>
                  ) : candidates.length ? (
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {candidates.map((room) => {
                        const capacityLabel = room.capacity ? `${room.userCount}/${room.capacity}` : `${room.userCount}/inf`;
                        const availableLabel =
                          room.available === Infinity
                            ? t({ it: 'Illimitata', en: 'Unlimited' })
                            : t({ it: `${Math.max(0, room.available)} posti liberi`, en: `${Math.max(0, room.available)} seats left` });
                        return (
                          <button
                            key={room.id}
                            onClick={() => onHighlight(room.id)}
                            className="flex w-full flex-col gap-1 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            title={t({ it: 'Evidenzia stanza', en: 'Highlight room' })}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate font-semibold text-ink">{room.name}</div>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {capacityLabel}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{availableLabel}</span>
                              <LocateFixed size={12} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {t({ it: 'Nessuna stanza ha capienza sufficiente.', en: 'No rooms have enough capacity.' })}
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
