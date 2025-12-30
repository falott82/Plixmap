import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import { MapObject, Room } from '../../store/types';
import { useDataStore } from '../../store/useDataStore';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  term: string;
  objectResults: MapObject[];
  roomResults: Room[];
  onClose: () => void;
  onSelectObject: (objectId: string) => void;
  onSelectRoom: (roomId: string) => void;
  anchorRef: RefObject<HTMLElement>;
}

const SearchResultsPopover = ({
  open,
  term,
  objectResults,
  roomResults,
  onClose,
  onSelectObject,
  onSelectRoom,
  anchorRef
}: Props) => {
  const defs = useDataStore((s) => s.objectTypes);
  const lang = useLang();
  const t = useT();
  const byId = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const labelOf = (id: string) => byId.get(id)?.name?.[lang] || byId.get(id)?.name?.it || id;
  const iconOf = (id: string) => byId.get(id)?.icon;
  const listRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(
    () => [
      ...roomResults.map((r) => ({ kind: 'room' as const, id: r.id })),
      ...objectResults.map((o) => ({ kind: 'object' as const, id: o.id }))
    ],
    [objectResults, roomResults]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(items.length ? 0 : -1);
  }, [items.length, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!items.length) return;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof (e as any).stopImmediatePropagation === 'function') {
          (e as any).stopImmediatePropagation();
        }
      };
      if (e.key === 'ArrowDown') {
        stop();
        setSelectedIndex((idx) => Math.min(items.length - 1, Math.max(0, idx + 1)));
      }
      if (e.key === 'ArrowUp') {
        stop();
        setSelectedIndex((idx) => Math.max(0, idx - 1));
      }
      if (e.key === 'Enter') {
        stop();
        const item = items[selectedIndex];
        if (!item) return;
        if (item.kind === 'room') onSelectRoom(item.id);
        else onSelectObject(item.id);
        onClose();
      }
      if (e.key === 'Escape') {
        stop();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [items, onClose, onSelectObject, onSelectRoom, open, selectedIndex]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(360, Math.min(520, rect.width * 1.6));
      const left = Math.max(8, rect.right - width);
      const top = rect.bottom + 8;
      setStyle({ position: 'fixed', top, left, width, zIndex: 80 });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [anchorRef, onClose, open]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-result-index="${selectedIndex}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div ref={containerRef} style={style} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <div className="text-sm font-semibold text-ink">{t({ it: 'Risultati ricerca', en: 'Search results' })}</div>
          <div className="text-xs text-slate-500">
            {t({
              it: `Trovati ${roomResults.length + objectResults.length} risultati (${roomResults.length} stanze · ${objectResults.length} oggetti).`,
              en: `Found ${roomResults.length + objectResults.length} results (${roomResults.length} rooms · ${objectResults.length} objects).`
            })}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {t({ it: `Seleziona un risultato per evidenziare “${term}”.`, en: `Select a result to highlight “${term}”.` })}
      </div>
      <div ref={listRef} className="mt-3 max-h-[42vh] space-y-2 overflow-y-auto">
        {roomResults.length ? (
          <div className="pb-1">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase text-slate-500">
              {t({ it: 'Stanze', en: 'Rooms' })}
            </div>
            <div className="space-y-2">
              {roomResults.map((room, idx) => {
                const index = idx;
                const selected = index === selectedIndex;
                return (
                  <button
                    key={room.id}
                    data-result-index={index}
                    onClick={() => {
                      onSelectRoom(room.id);
                      onClose();
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left hover:bg-slate-50 ${
                      selected ? 'border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm' : 'border-slate-200'
                    }`}
                    aria-selected={selected}
                  >
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary">
                      <span className="text-xs font-bold">R</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{room.name}</div>
                      <div className="truncate text-xs text-slate-500">{t({ it: 'Stanza', en: 'Room' })}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {objectResults.length ? (
          <div>
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase text-slate-500">
              {t({ it: 'Oggetti', en: 'Objects' })}
            </div>
            <div className="space-y-2">
              {objectResults.map((obj, idx) => {
                const index = roomResults.length + idx;
                const selected = index === selectedIndex;
                return (
                  <button
                    key={obj.id}
                    data-result-index={index}
                    onClick={() => {
                      onSelectObject(obj.id);
                      onClose();
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left hover:bg-slate-50 ${
                      selected ? 'border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm' : 'border-slate-200'
                    }`}
                    aria-selected={selected}
                  >
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary">
                      <Icon name={iconOf(obj.type)} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{obj.name}</div>
                      <div className="truncate text-xs text-slate-500">{labelOf(obj.type)}</div>
                      {obj.description ? (
                        <div className="mt-1 line-clamp-2 text-xs text-slate-600">{obj.description}</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SearchResultsPopover;
