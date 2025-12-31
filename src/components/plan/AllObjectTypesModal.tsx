import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Search, X } from 'lucide-react';
import { ObjectTypeDefinition } from '../../store/types';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  defs: ObjectTypeDefinition[];
  onClose: () => void;
  onPick: (typeId: string) => void;
  paletteTypeIds?: string[];
  onAddToPalette?: (typeId: string) => void;
}

const AllObjectTypesModal = ({ open, defs, onClose, onPick, paletteTypeIds, onAddToPalette }: Props) => {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [context, setContext] = useState<{ x: number; y: number; typeId: string } | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);

  const paletteSet = useMemo(() => new Set(Array.isArray(paletteTypeIds) ? paletteTypeIds : []), [paletteTypeIds]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setContext(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = (defs || []).slice();
    list.sort((a, b) => ((a?.name?.[lang] || a.id) as string).localeCompare((b?.name?.[lang] || b.id) as string));
    if (!query) return list;
    return list.filter((d) => {
      const label = ((d?.name?.[lang] as string) || (d?.name?.it as string) || d.id).toLowerCase();
      return label.includes(query) || d.id.toLowerCase().includes(query);
    });
  }, [defs, lang, q]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Tutti gli oggetti', en: 'All objects' })}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Search size={16} className="text-slate-400" />
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder={t({ it: 'Cerca oggetto…', en: 'Search object…' })}
                  />
                </div>

                <div className="mt-4 grid max-h-[580px] grid-cols-2 gap-3 overflow-auto sm:grid-cols-4">
                  {filtered.map((d) => {
                    const label = (d?.name?.[lang] as string) || (d?.name?.it as string) || d.id;
                    const inPalette = paletteSet.has(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => {
                          onPick(d.id);
                          onClose();
                        }}
                        onContextMenu={(e) => {
                          if (!onAddToPalette) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setContext({ x: e.clientX, y: e.clientY, typeId: d.id });
                        }}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
                        title={label}
                      >
                        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-primary">
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
                  })}
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
