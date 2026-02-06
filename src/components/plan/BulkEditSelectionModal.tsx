import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Eye, X } from 'lucide-react';
import { IconName, MapObject } from '../../store/types';
import { useT } from '../../i18n/useT';
import Icon from '../ui/Icon';
import { useUIStore } from '../../store/useUIStore';
import { isDeskType } from './deskTypes';
import { TEXT_FONT_OPTIONS } from '../../store/data';

type Row = {
  id: string;
  type: string;
  name: string;
  description?: string;
  scale?: number;
  textFont?: string;
  textSize?: number;
  textColor?: string;
  imageUrl?: string;
  isRealUser?: boolean;
  isDesk?: boolean;
  isText?: boolean;
};

interface Props {
  open: boolean;
  objects: MapObject[];
  getTypeLabel: (typeId: string) => string;
  getTypeIcon: (typeId: string) => IconName | undefined;
  onClose: () => void;
  onApply: (
    changesById: Record<string, Partial<Pick<MapObject, 'name' | 'description' | 'scale' | 'textFont' | 'textSize' | 'textColor'>>>
  ) => void;
  onPreviewObject?: (objectId: string) => void;
}

const BulkEditSelectionModal = ({ open, objects, getTypeLabel, getTypeIcon, onClose, onApply, onPreviewObject }: Props) => {
  const t = useT();
  const [rows, setRows] = useState<Row[]>([]);
  const [scaleAll, setScaleAll] = useState<number>(1);
  const [textFontAll, setTextFontAll] = useState<string>(TEXT_FONT_OPTIONS[0]?.value || 'Arial, sans-serif');
  const [textSizeAll, setTextSizeAll] = useState<number>(18);
  const [textColorAll, setTextColorAll] = useState<string>('#000000');
  const initialRef = useRef<Record<string, { name: string; description?: string; scale?: number; textFont?: string; textSize?: number; textColor?: string }>>({});
  const allText = useMemo(() => objects.length > 0 && objects.every((o) => o.type === 'text'), [objects]);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, any> = {};
    const fontFallback = TEXT_FONT_OPTIONS[0]?.value || 'Arial, sans-serif';
    const next = (objects || []).map((o) => {
      init[o.id] = {
        name: o.name,
        description: o.description,
        scale: o.scale ?? 1,
        textFont: (o as any).textFont || fontFallback,
        textSize: Number((o as any).textSize ?? 18) || 18,
        textColor: (o as any).textColor || '#000000'
      };
      return {
        id: o.id,
        type: o.type,
        name: o.name,
        description: o.description,
        scale: o.scale ?? 1,
        textFont: (o as any).textFont || fontFallback,
        textSize: Number((o as any).textSize ?? 18) || 18,
        textColor: (o as any).textColor || '#000000',
        imageUrl: (o as any).imageUrl,
        isRealUser: !!o.externalUserId,
        isDesk: isDeskType(o.type),
        isText: o.type === 'text'
      };
    });
    initialRef.current = init;
    setRows(next);
    setScaleAll(Number((objects?.[0]?.scale ?? 1) as any) || 1);
    if (allText && objects?.length) {
      const first = objects[0] as any;
      setTextFontAll(String(first?.textFont || fontFallback));
      setTextSizeAll(Number(first?.textSize ?? 18) || 18);
      setTextColorAll(String(first?.textColor || '#000000'));
    }
  }, [allText, objects, open]);

  const canApply = useMemo(
    () => rows.every((r) => r.isDesk || r.isRealUser || r.name.trim().length > 0),
    [rows]
  );

  const apply = () => {
    if (!canApply) return;
    const changesById: Record<string, any> = {};
    for (const r of rows) {
      const prev = initialRef.current[r.id];
      if (!prev) continue;
      const nextName = r.name.trim();
      const nextDesc = (r.description || '').trim() || undefined;
      const nextScale = Number.isFinite(r.scale as any) ? Number(r.scale) : 1;
      const patch: any = {};
      // Real users: name/description are managed by directory import, so do not allow edits here.
      if (!r.isRealUser && !r.isDesk) {
        if (nextName && nextName !== prev.name) patch.name = nextName;
        if (nextDesc !== (prev.description || undefined)) patch.description = nextDesc;
      }
      if ((prev.scale ?? 1) !== nextScale) patch.scale = nextScale;
      if (r.isText) {
        const nextFont = r.textFont || prev.textFont;
        const nextSize = Number.isFinite(r.textSize as any) ? Number(r.textSize) : prev.textSize;
        const nextColor = r.textColor || prev.textColor;
        if (nextFont && nextFont !== prev.textFont) patch.textFont = nextFont;
        if (Number.isFinite(nextSize) && nextSize !== prev.textSize) patch.textSize = nextSize;
        if (nextColor && nextColor !== prev.textColor) patch.textColor = nextColor;
      }
      if (Object.keys(patch).length) changesById[r.id] = patch;
    }
    onApply(changesById);
    onClose();
  };

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
              <Dialog.Panel className="w-full max-w-4xl modal-panel">
                <div className="modal-header">
                  <div className="min-w-0">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Modifica selezione', en: 'Edit selection' })}
                    </Dialog.Title>
                    <div className="modal-description">
                      {t({
                        it: `Stai modificando ${rows.length} oggetti selezionati.`,
                        en: `You are editing ${rows.length} selected objects.`
                      })}
                    </div>
                  </div>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200">
                  {allText ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Stile testo per tutti', en: 'Text style for all' })}</div>
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={textFontAll}
                          onChange={(e) => {
                            const next = e.target.value;
                            setTextFontAll(next);
                            setRows((prev) => prev.map((r) => (r.isText ? { ...r, textFont: next } : r)));
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                          title={t({ it: 'Font', en: 'Font' })}
                        >
                          {TEXT_FONT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input
                            type="range"
                            min={8}
                            max={96}
                            step={1}
                            value={textSizeAll}
                            onChange={(e) => {
                              const next = Math.max(8, Math.min(96, Number(e.target.value) || 18));
                              setTextSizeAll(next);
                              setRows((prev) => prev.map((r) => (r.isText ? { ...r, textSize: next } : r)));
                            }}
                            className="w-36"
                            title={t({ it: 'Dimensione', en: 'Size' })}
                          />
                          <span className="w-9 text-right text-[11px] font-mono text-slate-500 tabular-nums">
                            {Math.round(textSizeAll)}
                          </span>
                        </div>
                        <input
                          type="color"
                          value={textColorAll}
                          onChange={(e) => {
                            const next = e.target.value;
                            setTextColorAll(next);
                            setRows((prev) => prev.map((r) => (r.isText ? { ...r, textColor: next } : r)));
                          }}
                          className="h-7 w-9 rounded border border-slate-200 bg-white"
                          title={t({ it: 'Colore testo', en: 'Text color' })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Scala a tutti', en: 'Scale for all' })}</div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0.2}
                          max={2.4}
                          step={0.05}
                          value={scaleAll}
                          onChange={(e) => {
                            const next = Math.max(0.2, Math.min(2.4, Number(e.target.value) || 1));
                            setScaleAll(next);
                            setRows((prev) => prev.map((r) => ({ ...r, scale: next })));
                            useUIStore.getState().setLastObjectScale(next);
                          }}
                          className="w-48"
                          title={t({ it: 'Imposta la scala per tutti gli oggetti selezionati', en: 'Set scale for all selected objects' })}
                        />
                        <div className="w-12 text-right text-xs font-semibold text-slate-600 tabular-nums">{scaleAll.toFixed(2)}</div>
                        <button
                          onClick={() => {
                            const next = Math.max(0.2, Math.min(2.4, Number(scaleAll) || 1));
                            // Persist as default for newly created objects (requested behavior).
                            useUIStore.getState().setLastObjectScale(next);
                          }}
                          className="btn-primary"
                          title={t({
                            it: 'Usa questa scala come default per i nuovi oggetti trascinati/inseriti.',
                            en: 'Use this scale as the default for newly created objects.'
                          })}
                        >
                          {t({ it: 'Imposta default', en: 'Set default' })}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
                    <div className="col-span-3">{t({ it: 'Oggetto', en: 'Object' })}</div>
                    <div className={allText ? 'col-span-5' : 'col-span-4'}>{t({ it: 'Nome', en: 'Name' })}</div>
                    <div className={allText ? 'col-span-2' : 'col-span-3'}>{t({ it: 'Descrizione', en: 'Description' })}</div>
                    <div className="col-span-2 text-right">{allText ? t({ it: 'Stile', en: 'Style' }) : t({ it: 'Scala', en: 'Scale' })}</div>
                  </div>
                  {rows.map((r) => {
                    const icon = getTypeIcon(r.type);
                    const canPreview = (r.type === 'image' || r.type === 'photo') && !!r.imageUrl;
                    const previewLabel =
                      r.type === 'photo'
                        ? t({ it: 'Vedi foto', en: 'View photo' })
                        : t({ it: 'Vedi immagine', en: 'View image' });
                    return (
                      <div key={r.id} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          {icon ? <Icon name={icon} size={16} className="text-primary" /> : null}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-ink">{getTypeLabel(r.type)}</div>
                            <div className="truncate text-xs text-slate-500">{r.id.slice(0, 8)}</div>
                          </div>
                          {canPreview && onPreviewObject ? (
                            <button
                              type="button"
                              onClick={() => onPreviewObject(r.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              title={previewLabel}
                            >
                              <Eye size={14} />
                            </button>
                          ) : null}
                        </div>
                        <div className={allText ? 'col-span-5' : 'col-span-4'}>
                      <input
                        value={r.name}
                        disabled={!!r.isRealUser || !!r.isDesk}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder={t({ it: 'Nome (obbligatorio)', en: 'Name (required)' })}
                      />
                      {r.isRealUser ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {t({
                            it: 'Utente reale: il nome è gestito dalla rubrica importata.',
                            en: 'Real user: the name is managed by the imported directory.'
                          })}
                        </div>
                      ) : r.isDesk ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {t({
                            it: 'Scrivania: nome non modificabile.',
                            en: 'Desk: name cannot be edited.'
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div className={allText ? 'col-span-2' : 'col-span-3'}>
                      <input
                        value={r.description || ''}
                        disabled={!!r.isRealUser || !!r.isDesk}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x))
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder={t({ it: 'Descrizione (opzionale)', en: 'Description (optional)' })}
                      />
                    </div>
                        <div className="col-span-2 flex flex-col items-end gap-2">
                          {allText ? (
                            <>
                              <select
                                value={r.textFont}
                                onChange={(e) =>
                                  setRows((prev) =>
                                    prev.map((x) => (x.id === r.id ? { ...x, textFont: e.target.value } : x))
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                                title={t({ it: 'Font', en: 'Font' })}
                              >
                                {TEXT_FONT_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  min={8}
                                  max={96}
                                  step={1}
                                  value={Number(r.textSize ?? 18)}
                                  onChange={(e) => {
                                    const next = Math.max(8, Math.min(96, Number(e.target.value) || 18));
                                    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, textSize: next } : x)));
                                  }}
                                  className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                                  title={t({ it: 'Dimensione', en: 'Size' })}
                                />
                                <input
                                  type="color"
                                  value={r.textColor || '#000000'}
                                  onChange={(e) =>
                                    setRows((prev) =>
                                      prev.map((x) => (x.id === r.id ? { ...x, textColor: e.target.value } : x))
                                    )
                                  }
                                  className="h-7 w-9 rounded border border-slate-200 bg-white"
                                  title={t({ it: 'Colore testo', en: 'Text color' })}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <input
                                type="range"
                                min={0.2}
                                max={2.4}
                                step={0.05}
                                value={r.scale ?? 1}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, scale: next } : x)));
                                }}
                                className="w-24"
                                title={t({ it: 'Scala', en: 'Scale' })}
                              />
                              <div className="w-10 text-right text-xs font-semibold text-slate-600 tabular-nums">
                                {(r.scale ?? 1).toFixed(2)}
                              </div>
                            </>
                          )}
                        </div>
	                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={apply}
                    disabled={!canApply}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
                    title={t({ it: 'Applica modifiche', en: 'Apply changes' })}
                  >
                    {t({ it: 'Applica modifiche', en: 'Apply changes' })}
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

export default BulkEditSelectionModal;
