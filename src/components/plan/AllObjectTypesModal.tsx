import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Search, X } from 'lucide-react';
import { ObjectTypeDefinition } from '../../store/types';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';
import { isDeskType } from './deskTypes';

interface Props {
  open: boolean;
  defs: ObjectTypeDefinition[];
  onClose: () => void;
  onPick: (typeId: string) => void;
  paletteTypeIds?: string[];
  onAddToPalette?: (typeId: string) => void;
  defaultTab?: 'all' | 'objects' | 'desks' | 'walls' | 'text' | 'notes';
}

const AllObjectTypesModal = ({ open, defs, onClose, onPick, paletteTypeIds, onAddToPalette, defaultTab = 'all' }: Props) => {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'objects' | 'desks' | 'walls' | 'text' | 'notes'>(defaultTab);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [context, setContext] = useState<{ x: number; y: number; typeId: string } | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);

  const categoryStyles = useMemo(
    () => ({
      desks: { border: '#a78bfa', bg: 'rgba(167, 139, 250, 0.14)', text: '#6d28d9' },
      walls: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)', text: '#b45309' },
      text: { border: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)', text: '#0284c7' },
      notes: { border: '#facc15', bg: 'rgba(250, 204, 21, 0.18)', text: '#a16207' },
      objects: { border: '#e2e8f0', bg: '#ffffff', text: '#475569' }
    }),
    []
  );

  const paletteSet = useMemo(() => new Set(Array.isArray(paletteTypeIds) ? paletteTypeIds : []), [paletteTypeIds]);

  useEffect(() => {
    if (!context) return;
    const onDown = (e: MouseEvent) => {
      if (!contextRef.current) return setContext(null);
      if (contextRef.current.contains(e.target as any)) return;
      setContext(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [context]);

  const sortedDefs = useMemo(() => {
    const list = (defs || []).slice();
    list.sort((a, b) => ((a?.name?.[lang] || a.id) as string).localeCompare((b?.name?.[lang] || b.id) as string));
    return list;
  }, [defs, lang]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return sortedDefs;
    return sortedDefs.filter((d) => {
      const label = ((d?.name?.[lang] as string) || (d?.name?.it as string) || d.id).toLowerCase();
      return label.includes(query) || d.id.toLowerCase().includes(query);
    });
  }, [lang, q, sortedDefs]);

  const allDeskDefs = useMemo(() => sortedDefs.filter((d) => isDeskType(d.id)), [sortedDefs]);
  const allWallDefs = useMemo(
    () => sortedDefs.filter((d) => d.category === 'wall' || String(d.id).startsWith('wall_')),
    [sortedDefs]
  );
  const allTextDefs = useMemo(() => sortedDefs.filter((d) => d.id === 'text'), [sortedDefs]);
  const allNoteDefs = useMemo(() => sortedDefs.filter((d) => d.id === 'postit'), [sortedDefs]);
  const allOtherDefs = useMemo(
    () =>
      sortedDefs.filter(
        (d) =>
          !isDeskType(d.id) &&
          !(d.category === 'wall' || String(d.id).startsWith('wall_')) &&
          d.id !== 'text' &&
          d.id !== 'postit'
      ),
    [sortedDefs]
  );

  const deskDefs = useMemo(() => filtered.filter((d) => isDeskType(d.id)), [filtered]);
  const wallDefs = useMemo(
    () => filtered.filter((d) => d.category === 'wall' || String(d.id).startsWith('wall_')),
    [filtered]
  );
  const textDefs = useMemo(() => filtered.filter((d) => d.id === 'text'), [filtered]);
  const noteDefs = useMemo(() => filtered.filter((d) => d.id === 'postit'), [filtered]);
  const allDefs = useMemo(() => filtered, [filtered]);
  const otherDefs = useMemo(
    () =>
      filtered.filter(
        (d) =>
          !isDeskType(d.id) &&
          !(d.category === 'wall' || String(d.id).startsWith('wall_')) &&
          d.id !== 'text' &&
          d.id !== 'postit'
      ),
    [filtered]
  );
  const activeDefs =
    tab === 'all'
      ? allDefs
      : tab === 'desks'
      ? deskDefs
      : tab === 'walls'
        ? wallDefs
        : tab === 'text'
          ? textDefs
          : tab === 'notes'
            ? noteDefs
            : otherDefs;

  useEffect(() => {
    if (!open) return;
    setQ('');
    setContext(null);
    const fallbackTab =
      defaultTab === 'all'
        ? 'all'
        : (defaultTab === 'desks' && allDeskDefs.length) ||
            (defaultTab === 'walls' && allWallDefs.length) ||
            (defaultTab === 'text' && allTextDefs.length) ||
            (defaultTab === 'notes' && allNoteDefs.length) ||
            (defaultTab === 'objects' && allOtherDefs.length)
          ? defaultTab
          : allDeskDefs.length
            ? 'desks'
            : allWallDefs.length
              ? 'walls'
              : allTextDefs.length
                ? 'text'
                : allNoteDefs.length
                  ? 'notes'
                  : 'all';
    setTab(fallbackTab);
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [allDeskDefs.length, allNoteDefs.length, allOtherDefs.length, allTextDefs.length, allWallDefs.length, defaultTab, open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(activeDefs.length ? 0 : -1);
  }, [activeDefs.length, open, q, tab]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeDefs.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev < 0 ? 0 : (prev + 1) % activeDefs.length;
        return next;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev < 0 ? activeDefs.length - 1 : (prev - 1 + activeDefs.length) % activeDefs.length;
        return next;
      });
      return;
    }
    if (e.key === 'Enter') {
      const def = activeDefs[Math.max(0, activeIndex)];
      if (!def) return;
      e.preventDefault();
      onPick(def.id);
      onClose();
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-5xl modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">{t({ it: 'Tutti gli oggetti', en: 'All objects' })}</Dialog.Title>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Search size={16} className="text-slate-400" />
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder={t({ it: 'Cerca oggetto…', en: 'Search object…' })}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setTab('all')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      tab === 'all'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    title={t({ it: 'Tutti', en: 'All' })}
                  >
                    {t({ it: 'Tutti', en: 'All' })}
                  </button>
                  <button
                    onClick={() => setTab('desks')}
                    disabled={!allDeskDefs.length}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      tab === 'desks'
                        ? 'bg-primary/10'
                        : 'hover:bg-slate-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    title={t({ it: 'Scrivanie', en: 'Desks' })}
                    style={
                      tab === 'desks'
                        ? {
                            borderColor: categoryStyles.desks.border,
                            color: categoryStyles.desks.text,
                            backgroundColor: categoryStyles.desks.bg
                          }
                        : { borderColor: categoryStyles.desks.border, color: categoryStyles.desks.text }
                    }
                  >
                    {t({ it: 'Scrivanie', en: 'Desks' })}
                  </button>
                  <button
                    onClick={() => setTab('walls')}
                    disabled={!allWallDefs.length}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      tab === 'walls'
                        ? 'bg-primary/10'
                        : 'hover:bg-slate-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    title={t({ it: 'Mura', en: 'Walls' })}
                    style={
                      tab === 'walls'
                        ? {
                            borderColor: categoryStyles.walls.border,
                            color: categoryStyles.walls.text,
                            backgroundColor: categoryStyles.walls.bg
                          }
                        : { borderColor: categoryStyles.walls.border, color: categoryStyles.walls.text }
                    }
                  >
                    {t({ it: 'Mura', en: 'Walls' })}
                  </button>
                  <button
                    onClick={() => setTab('text')}
                    disabled={!allTextDefs.length}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      tab === 'text'
                        ? 'bg-primary/10'
                        : 'hover:bg-slate-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    title={t({ it: 'Testo', en: 'Text' })}
                    style={
                      tab === 'text'
                        ? {
                            borderColor: categoryStyles.text.border,
                            color: categoryStyles.text.text,
                            backgroundColor: categoryStyles.text.bg
                          }
                        : { borderColor: categoryStyles.text.border, color: categoryStyles.text.text }
                    }
                  >
                    {t({ it: 'Testo', en: 'Text' })}
                  </button>
                  <button
                    onClick={() => setTab('notes')}
                    disabled={!allNoteDefs.length}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      tab === 'notes'
                        ? 'bg-primary/10'
                        : 'hover:bg-slate-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    title={t({ it: 'Scritte', en: 'Notes' })}
                    style={
                      tab === 'notes'
                        ? {
                            borderColor: categoryStyles.notes.border,
                            color: categoryStyles.notes.text,
                            backgroundColor: categoryStyles.notes.bg
                          }
                        : { borderColor: categoryStyles.notes.border, color: categoryStyles.notes.text }
                    }
                  >
                    {t({ it: 'Scritte', en: 'Notes' })}
                  </button>
                  <button
                    onClick={() => setTab('objects')}
                    disabled={!allOtherDefs.length}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      tab === 'objects'
                        ? 'bg-primary/10'
                        : 'hover:bg-slate-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    title={t({ it: 'Oggetti', en: 'Objects' })}
                    style={
                      tab === 'objects'
                        ? {
                            borderColor: categoryStyles.objects.border,
                            color: categoryStyles.objects.text,
                            backgroundColor: categoryStyles.objects.bg
                          }
                        : { borderColor: categoryStyles.objects.border, color: categoryStyles.objects.text }
                    }
                  >
                    {t({ it: 'Oggetti', en: 'Objects' })}
                  </button>
                </div>

                <div className="mt-4 grid max-h-[580px] grid-cols-2 gap-3 overflow-auto sm:grid-cols-4">
                  {activeDefs.length ? (
                    activeDefs.map((d, index) => {
                      const label = (d?.name?.[lang] as string) || (d?.name?.it as string) || d.id;
                      const inPalette = paletteSet.has(d.id);
                      const isActive = index === activeIndex;
                      const category = isDeskType(d.id)
                        ? 'desks'
                        : d.category === 'wall' || String(d.id).startsWith('wall_')
                          ? 'walls'
                          : d.id === 'text'
                            ? 'text'
                            : d.id === 'postit'
                              ? 'notes'
                              : 'objects';
                      const categoryStyle = categoryStyles[category];
                      const showCategoryTint = tab === 'all' && category !== 'objects';
                      return (
                        <button
                          key={d.id}
                          onClick={() => {
                            onPick(d.id);
                            onClose();
                          }}
                          onMouseEnter={() => setActiveIndex(index)}
                          onContextMenu={(e) => {
                            if (!onAddToPalette) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setContext({ x: e.clientX, y: e.clientY, typeId: d.id });
                          }}
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left hover:bg-slate-50 ${
                            isActive ? 'ring-2 ring-primary/20' : ''
                          }`}
                          style={{
                            backgroundColor: showCategoryTint ? categoryStyle.bg : '#ffffff',
                            borderColor: isActive ? '#38bdf8' : showCategoryTint ? categoryStyle.border : '#e2e8f0'
                          }}
                          title={label}
                        >
                          <div
                            className="grid h-11 w-11 place-items-center rounded-2xl border bg-white text-primary"
                            style={{
                              borderColor: showCategoryTint ? categoryStyle.border : '#e2e8f0',
                              backgroundColor: showCategoryTint ? 'rgba(255,255,255,0.85)' : '#ffffff'
                            }}
                          >
                            <Icon name={d.icon} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ink">{label}</div>
                            <div className="truncate text-xs text-slate-500">{d.id}</div>
                          </div>
                          {onAddToPalette ? (
                            <div className="ml-auto text-[10px] font-semibold uppercase text-slate-400">
                              {inPalette ? t({ it: 'In palette', en: 'In palette' }) : t({ it: 'Extra', en: 'Extra' })}
                            </div>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                      {t({ it: 'Nessun elemento trovato.', en: 'No items found.' })}
                    </div>
                  )}
                </div>

                {context ? (
                  <div
                    ref={contextRef}
                    className="fixed z-[60] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
                    style={{ left: context.x, top: context.y }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <button
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-slate-50"
                      onClick={() => {
                        onPick(context.typeId);
                        setContext(null);
                        onClose();
                      }}
                      title={t({ it: 'Posiziona sulla mappa', en: 'Place on map' })}
                    >
                      <span>{t({ it: 'Posiziona sulla mappa', en: 'Place on map' })}</span>
                      <span className="text-xs text-slate-400">↵</span>
                    </button>
                    {onAddToPalette ? (
                      <button
                        disabled={paletteSet.has(context.typeId)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          onAddToPalette(context.typeId);
                          setContext(null);
                        }}
                        title={t({ it: 'Aggiungi a barra laterale', en: 'Add to sidebar' })}
                      >
                        <span>{t({ it: 'Aggiungi a barra laterale', en: 'Add to sidebar' })}</span>
                        <span className="text-xs text-slate-400">+</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AllObjectTypesModal;
