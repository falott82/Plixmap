import { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CornerDownRight, Edit3, Link as LinkIcon, MousePointer2, Trash2, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

type LinkRow = {
  id: string;
  kind: 'arrow' | 'cable';
  name: string;
  otherName: string;
  otherId: string;
  otherTypeLabel?: string;
  color?: string;
  width?: number;
  dashed?: boolean;
  route?: 'vh' | 'hv';
  description?: string;
};

interface Props {
  open: boolean;
  readOnly?: boolean;
  objectName: string;
  rows: LinkRow[];
  onClose: () => void;
  onSelect: (linkId: string) => void;
  onEdit?: (linkId: string) => void;
  onDelete?: (linkId: string) => void;
}

const LinksModal = ({ open, readOnly = false, objectName, rows, onClose, onSelect, onEdit, onDelete }: Props) => {
  const t = useT();

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => a.otherName.localeCompare(b.otherName));
    return arr;
  }, [rows]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-4xl modal-panel">
                <div className="modal-header">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Collegamenti', en: 'Links' })}</Dialog.Title>
                    <Dialog.Description className="modal-description">
                      {t({
                        it: `Collegamenti associati all’oggetto “${objectName}”.`,
                        en: `Links attached to “${objectName}”.`
                      })}
                    </Dialog.Description>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
                    <div className="col-span-1">{t({ it: 'Tipo', en: 'Type' })}</div>
                    <div className="col-span-3">{t({ it: 'Nome', en: 'Name' })}</div>
                    <div className="col-span-4">{t({ it: 'Collegato a', en: 'Connected to' })}</div>
                    <div className="col-span-2">{t({ it: 'Stile', en: 'Style' })}</div>
                    <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
                  </div>
                  {sorted.length ? (
                    sorted.map((r) => (
                      <div key={r.id} className="grid grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-sm hover:bg-slate-50">
                        <div className="col-span-1 flex items-center">
                          {r.kind === 'cable' ? (
                            <span title={t({ it: 'Collegamento 90°', en: '90° link' })}>
                              <CornerDownRight size={16} className="text-slate-600" />
                            </span>
                          ) : (
                            <span title={t({ it: 'Collegamento lineare', en: 'Straight link' })}>
                              <LinkIcon size={16} className="text-slate-600" />
                            </span>
                          )}
                        </div>
                        <div className="col-span-3 min-w-0">
                          <div className="truncate font-semibold text-ink">{r.name || '—'}</div>
                          {r.description ? <div className="truncate text-xs text-slate-500">{r.description}</div> : null}
                        </div>
                        <div className="col-span-4 min-w-0">
                          <div className="truncate font-semibold text-ink">{r.otherName || r.otherId}</div>
                          <div className="mt-0.5 flex items-center gap-2">
                            {r.otherTypeLabel ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {r.otherTypeLabel}
                              </span>
                            ) : null}
                            <span className="truncate text-xs text-slate-500 font-mono">{r.otherId}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-slate-700">
                            {t({
                              it: r.kind === 'cable' ? '90°' : 'Lineare',
                              en: r.kind === 'cable' ? '90°' : 'Straight'
                            })}
                            {r.dashed ? ` · ${t({ it: 'tratteggio', en: 'dashed' })}` : ''}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-200" style={{ background: r.color || '#94a3b8' }} />
                            <span className="tabular-nums">{(r.width ?? (r.kind === 'cable' ? 3 : 2))}px</span>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelect(r.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
                            title={t({ it: 'Seleziona in mappa', en: 'Select on map' })}
                          >
                            <MousePointer2 size={14} />
                          </button>
                          {!readOnly && onEdit ? (
                            <button
                              onClick={() => onEdit(r.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
                              title={t({ it: 'Modifica', en: 'Edit' })}
                            >
                              <Edit3 size={14} />
                            </button>
                          ) : null}
                          {!readOnly && onDelete ? (
                            <button
                              onClick={() => onDelete(r.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              title={t({ it: 'Elimina', en: 'Delete' })}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun collegamento.', en: 'No links.' })}</div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default LinksModal;
