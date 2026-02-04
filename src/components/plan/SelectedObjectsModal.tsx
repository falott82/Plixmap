import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronRight, Link2, LocateFixed, MinusCircle, Search, Trash2, X } from 'lucide-react';
import { IconName, MapObject, PlanLink } from '../../store/types';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  objects: MapObject[];
  links: PlanLink[];
  getTypeLabel: (typeId: string) => string;
  getTypeIcon: (typeId: string) => IconName | undefined;
  getObjectName: (objectId: string) => string;
  onPickObject: (objectId: string) => void;
  onPickLink: (linkId: string) => void;
  onSetScaleAll?: (scale: number) => void;
  onRemoveFromSelection?: (objectId: string) => void;
  onFocusObject?: (objectId: string) => void;
  onRequestDeleteObject?: (objectId: string) => void;
  readOnly?: boolean;
  onClose: () => void;
}

const SelectedObjectsModal = ({
  open,
  objects,
  links,
  getTypeLabel,
  getTypeIcon,
  getObjectName,
  onPickObject,
  onPickLink,
  onSetScaleAll,
  onRemoveFromSelection,
  onFocusObject,
  onRequestDeleteObject,
  readOnly = false,
  onClose
}: Props) => {
  const t = useT();
  const [q, setQ] = useState('');
  const [scaleAll, setScaleAll] = useState<number>(1);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const first = objects[0];
    setScaleAll(Number(first?.scale ?? 1) || 1);
  }, [open]);

  type Row =
    | { kind: 'object'; obj: MapObject; hay: string }
    | { kind: 'link'; link: PlanLink; hay: string; title: string; subtitle: string };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const o of objects) {
      out.push({ kind: 'object', obj: o, hay: `${o.name} ${o.description || ''} ${getTypeLabel(o.type)}`.toLowerCase() });
    }
    for (const l of links) {
      const a = getObjectName(l.fromId);
      const b = getObjectName(l.toId);
      const label = String(l.name || l.label || '').trim();
      const title = label || t({ it: 'Collegamento', en: 'Link' });
      const subtitle = `${a} → ${b}`;
      out.push({
        kind: 'link',
        link: l,
        title,
        subtitle,
        hay: `${title} ${subtitle} ${l.description || ''}`.toLowerCase()
      });
    }
    return out;
  }, [getObjectName, getTypeLabel, links, objects, t]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.hay.includes(term));
  }, [q, rows]);

  const hasAny = objects.length + links.length;
  const showMultiActions = objects.length > 1;

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
              <Dialog.Panel className="w-full max-w-2xl modal-panel">
                <div className="modal-header">
                  <div className="min-w-0">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Modifica selezione', en: 'Edit selection' })}
                    </Dialog.Title>
                    <div className="modal-description">
                      {t({
                        it: `Selezione: ${objects.length} oggetti · ${links.length} collegamenti.`,
                        en: `Selection: ${objects.length} objects · ${links.length} links.`
                      })}
                    </div>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                {!readOnly && objects.length && onSetScaleAll ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Scala uguale per tutti', en: 'Set same scale for all' })}</div>
                      <div className="text-xs font-mono text-slate-500">{scaleAll.toFixed(2)}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min={0.2}
                        max={3}
                        step={0.05}
                        value={scaleAll}
                        onChange={(e) => setScaleAll(Number(e.target.value))}
                        className="w-full"
                      />
                      <button
                        onClick={() => onSetScaleAll(scaleAll)}
                        className="shrink-0 btn-primary"
                        title={t({ it: 'Applica a tutti gli oggetti selezionati', en: 'Apply to all selected objects' })}
                      >
                        {t({ it: 'Applica', en: 'Apply' })}
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {t({
                        it: 'Questa azione aggiorna solo gli oggetti (non i collegamenti).',
                        en: 'This updates objects only (not links).'
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Search size={16} className="text-slate-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t({ it: 'Cerca nella selezione...', en: 'Search within selection...' })}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                </div>

                <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
                  {!hasAny ? (
                    <div className="p-4 text-sm text-slate-600">{t({ it: 'Nessuna selezione.', en: 'No selection.' })}</div>
                  ) : !filtered.length ? (
                    <div className="p-4 text-sm text-slate-600">{t({ it: 'Nessun risultato.', en: 'No results.' })}</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filtered.map((row) => {
                        if (row.kind === 'link') {
                          return (
                            <button
                              key={row.link.id}
                              onClick={() => onPickLink(row.link.id)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                              title={t({ it: 'Apri modifica', en: 'Open editor' })}
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
                                <Link2 size={18} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-ink">{row.title}</div>
                                <div className="truncate text-xs text-slate-500">{row.subtitle}</div>
                              </div>
                              <ChevronRight size={18} className="text-slate-400" />
                            </button>
                          );
                        }
                        const o = row.obj;
                        const label = getTypeLabel(o.type);
                        const icon = getTypeIcon(o.type);
                        return (
                          <div key={o.id} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50">
                            <button
                              onClick={() => onPickObject(o.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1 text-left"
                              title={t({ it: 'Apri modifica', en: 'Open editor' })}
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary">
                                {icon ? <Icon name={icon} /> : <Icon type={o.type} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-ink">{o.name}</div>
                                <div className="truncate text-xs text-slate-500">{label}</div>
                              </div>
                              <ChevronRight size={18} className="text-slate-400" />
                            </button>
                            {showMultiActions && onFocusObject ? (
                              <button
                                onClick={() => onFocusObject(o.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                title={t({ it: 'Trova sulla mappa', en: 'Find on map' })}
                              >
                                <LocateFixed size={16} />
                              </button>
                            ) : null}
                            {showMultiActions && onRemoveFromSelection ? (
                              <button
                                onClick={() => onRemoveFromSelection(o.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                title={t({ it: 'Rimuovi dalla selezione', en: 'Remove from selection' })}
                              >
                                <MinusCircle size={16} />
                              </button>
                            ) : null}
                            {!readOnly && onRequestDeleteObject ? (
                              <button
                                onClick={() => onRequestDeleteObject(o.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                title={t({ it: 'Elimina oggetto', en: 'Delete object' })}
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex justify-end">
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

export default SelectedObjectsModal;
