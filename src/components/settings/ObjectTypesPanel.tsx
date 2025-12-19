import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { GripVertical, Info, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { updateMyProfile } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import Icon from '../ui/Icon';
import CustomFieldsModal from './CustomFieldsModal';
import { useLang, useT } from '../../i18n/useT';

const ObjectTypesPanel = () => {
  const t = useT();
  const lang = useLang();
  const { objectTypes } = useDataStore();
  const { push } = useToastStore();
  const user = useAuthStore((s) => s.user);

  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const [context, setContext] = useState<{ x: number; y: number; typeId: string } | null>(null);
  const [customFieldsForType, setCustomFieldsForType] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);

  const enabled = useMemo(() => {
    const arr = (user as any)?.paletteFavorites;
    return Array.isArray(arr) ? (arr as string[]) : [];
  }, [user]);

  const defById = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of objectTypes || []) map.set(d.id, d);
    return map;
  }, [objectTypes]);

  const enabledDefs = useMemo(() => {
    const out: any[] = [];
    for (const id of enabled) {
      const d = defById.get(id);
      if (d) out.push(d);
    }
    return out;
  }, [defById, enabled]);

  const availableDefs = useMemo(() => {
    const used = new Set(enabled);
    const list = (objectTypes || []).filter((d) => !used.has(d.id));
    const term = q.trim().toLowerCase();
    const sorted = list.slice().sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
    if (!term) return sorted;
    return sorted.filter((d) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term));
  }, [enabled, lang, objectTypes, q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!context) return;
      if (contextRef.current && contextRef.current.contains(e.target as any)) return;
      setContext(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [context]);

  const saveEnabled = async (next: string[]) => {
    try {
      await updateMyProfile({ paletteFavorites: next });
      useAuthStore.setState((s) =>
        s.user ? { user: { ...s.user, paletteFavorites: next } as any, permissions: s.permissions, hydrated: s.hydrated } : s
      );
      return true;
    } catch {
      push(t({ it: 'Salvataggio non riuscito', en: 'Save failed' }), 'danger');
      return false;
    }
  };

  const addType = async (typeId: string) => {
    const next = [...enabled, typeId];
    const ok = await saveEnabled(next);
    if (ok) push(t({ it: 'Oggetto aggiunto', en: 'Object added' }), 'success');
  };

  const removeType = async (typeId: string) => {
    const next = enabled.filter((x) => x !== typeId);
    const ok = await saveEnabled(next);
    if (ok) push(t({ it: 'Oggetto rimosso', en: 'Object removed' }), 'info');
  };

  const moveType = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = enabled.slice();
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    saveEnabled(next).catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-ink">{t({ it: 'Oggetti (palette)', en: 'Objects (palette)' })}</div>
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
              title={t({
                it: 'Qui scegli quali oggetti mostrare nella palette della mappa. La lista parte vuota: aggiungi quelli che ti servono. Tasto destro su un oggetto per gestire i campi personalizzati.',
                en: 'Choose which objects are shown in the map palette. The list starts empty: add what you need. Right-click an object to manage custom fields.'
              })}
            >
              <Info size={16} />
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {t({
              it: 'La palette è per-utente: ogni utente può avere la propria lista e il proprio ordine.',
              en: 'The palette is per-user: each user can have their own list and ordering.'
            })}
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          title={t({ it: 'Aggiungi oggetto', en: 'Add object' })}
        >
          <Plus size={16} />
          {t({ it: 'Aggiungi oggetto', en: 'Add object' })}
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <div className="col-span-1" />
          <div className="col-span-1">{t({ it: 'Icona', en: 'Icon' })}</div>
          <div className="col-span-5">{t({ it: 'Nome', en: 'Name' })}</div>
          <div className="col-span-3">ID</div>
          <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
        </div>
        <div className="divide-y divide-slate-100">
          {enabledDefs.length ? (
            enabledDefs.map((def) => {
              const label = (def?.name?.[lang] as string) || (def?.name?.it as string) || def.id;
              return (
                <div
                  key={def.id}
                  draggable
                  onDragStart={() => (dragIdRef.current = def.id)}
                  onDragEnd={() => (dragIdRef.current = null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const from = dragIdRef.current;
                    if (!from || from === def.id) return;
                    moveType(from, def.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContext({ x: e.clientX, y: e.clientY, typeId: def.id });
                  }}
                  className="grid grid-cols-12 items-center px-3 py-2 text-sm hover:bg-slate-50"
                  title={t({ it: 'Trascina per riordinare. Tasto destro per opzioni.', en: 'Drag to reorder. Right-click for options.' })}
                >
                  <div className="col-span-1 text-slate-400">
                    <GripVertical size={16} />
                  </div>
                  <div className="col-span-1">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                      <Icon name={def.icon} />
                    </span>
                  </div>
                  <div className="col-span-5 min-w-0">
                    <div className="truncate font-semibold text-ink">{label}</div>
                    <div className="text-xs text-slate-500">{t({ it: 'Tasto destro: campi custom', en: 'Right-click: custom fields' })}</div>
                  </div>
                  <div className="col-span-3 font-mono text-xs text-slate-700">{def.id}</div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => setCustomFieldsForType(def.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Campi personalizzati', en: 'Custom fields' })}
                    >
                      <Settings2 size={16} />
                    </button>
                    <button
                      onClick={() => removeType(def.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      title={t({ it: 'Rimuovi', en: 'Remove' })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-6 text-sm text-slate-600">
              {t({
                it: 'Nessun oggetto in palette: clicca “Aggiungi oggetto” per iniziare.',
                en: 'No objects in the palette: click “Add object” to get started.'
              })}
            </div>
          )}
        </div>
      </div>

      {context ? (
        <div
          ref={contextRef}
          className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
          style={{ top: context.y, left: context.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-semibold text-ink">{t({ it: 'Menu', en: 'Menu' })}</span>
            <button onClick={() => setContext(null)} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
              <X size={14} />
            </button>
          </div>
          <button
            onClick={() => {
              setCustomFieldsForType(context.typeId);
              setContext(null);
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
          >
            <Settings2 size={14} className="text-slate-500" /> {t({ it: 'Aggiungi campi custom…', en: 'Add custom fields…' })}
          </button>
          <button
            onClick={() => {
              removeType(context.typeId);
              setContext(null);
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={14} /> {t({ it: 'Rimuovi dalla palette', en: 'Remove from palette' })}
          </button>
        </div>
      ) : null}

      <Transition show={addOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setAddOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Aggiungi oggetto', en: 'Add object' })}</Dialog.Title>
                    <button onClick={() => setAddOpen(false)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Search size={16} className="text-slate-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="w-full bg-transparent text-sm outline-none"
                      placeholder={t({ it: 'Cerca…', en: 'Search…' })}
                    />
                  </div>
                  <div className="mt-4 grid max-h-[420px] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
                    {availableDefs.map((def) => {
                      const label = (def?.name?.[lang] as string) || (def?.name?.it as string) || def.id;
                      return (
                        <button
                          key={def.id}
                          onClick={() => {
                            addType(def.id);
                            setAddOpen(false);
                          }}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
                          title={label}
                        >
                          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-primary">
                            <Icon name={def.icon} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ink">{label}</div>
                            <div className="truncate text-xs text-slate-500">{def.id}</div>
                          </div>
                        </button>
                      );
                    })}
                    {!availableDefs.length ? (
                      <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600 sm:col-span-3">
                        {t({ it: 'Nessun oggetto disponibile.', en: 'No available objects.' })}
                      </div>
                    ) : null}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <CustomFieldsModal open={!!customFieldsForType} initialTypeId={customFieldsForType || undefined} lockType onClose={() => setCustomFieldsForType(null)} />
    </div>
  );
};

export default ObjectTypesPanel;
