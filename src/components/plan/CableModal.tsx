import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

export type CablePayload = {
  name: string;
  description?: string;
  color: string;
  width: number;
  dashed: boolean;
  route: 'vh' | 'hv';
};

interface Props {
  open: boolean;
  initial?: Partial<CablePayload>;
  onClose: () => void;
  onSubmit: (payload: CablePayload) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const CableModal = ({ open, initial, onClose, onSubmit }: Props) => {
  const t = useT();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [width, setWidth] = useState(3);
  const [dashed, setDashed] = useState(false);
  const [route, setRoute] = useState<'vh' | 'hv'>('vh');

  useEffect(() => {
    if (!open) return;
    setName(String(initial?.name || ''));
    setDescription(String(initial?.description || ''));
    setColor(String(initial?.color || '#2563eb'));
    setWidth(clamp(Number(initial?.width || 3), 1, 10));
    setDashed(!!initial?.dashed);
    setRoute((initial?.route as any) === 'hv' ? 'hv' : 'vh');
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initial, open]);

  const presets = useMemo(
    () => ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#94a3b8', '#0f172a'],
    []
  );

  const canSubmit = !!name.trim();

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Collegamento', en: 'Link' })}</Dialog.Title>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <Dialog.Description className="mt-2 text-sm text-slate-600">
                  {t({
                    it: 'Imposta stile e metadati del collegamento. Il percorso è sempre a 90° e resta “magnetico” agli oggetti collegati.',
                    en: 'Set link style and metadata. The path is always 90° and stays “magnetically” attached to the connected objects.'
                  })}
                </Dialog.Description>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <label className="text-sm font-semibold text-slate-700">
                    {t({ it: 'Nome', en: 'Name' })} <span className="text-rose-600">*</span>
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'es. Collegamento Stampante', en: 'e.g. Printer link' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (!canSubmit) return;
                          onSubmit({ name: name.trim(), description: description.trim() || undefined, color, width, dashed, route });
                        }
                      }}
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    {t({ it: 'Descrizione', en: 'Description' })}
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Opzionale', en: 'Optional' })}
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{t({ it: 'Colore', en: 'Color' })}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                          title={t({ it: 'Scegli colore', en: 'Pick color' })}
                        />
                        <div className="flex flex-wrap gap-2">
                          {presets.map((p) => (
                            <button
                              key={p}
                              onClick={() => setColor(p)}
                              className={`relative h-8 w-8 rounded-lg border ${color === p ? 'border-primary' : 'border-slate-200'} `}
                              style={{ backgroundColor: p }}
                              title={p}
                            >
                              {color === p ? <Check size={14} className="absolute inset-0 m-auto text-white" /> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-700">{t({ it: 'Spessore', en: 'Width' })}</div>
                        <div className="text-xs font-semibold text-slate-600 tabular-nums">{width}px</div>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className="mt-2 w-full"
                      />
                      <label className="mt-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{t({ it: 'Tratteggiata', en: 'Dashed' })}</span>
                        <input type="checkbox" checked={dashed} onChange={(e) => setDashed(e.target.checked)} />
                      </label>
                    </div>
                  </div>

                  <label className="text-sm font-semibold text-slate-700">
                    {t({ it: 'Percorso', en: 'Route' })}
                    <select
                      value={route}
                      onChange={(e) => setRoute(e.target.value === 'hv' ? 'hv' : 'vh')}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    >
                      <option value="vh">{t({ it: 'Verticale poi Orizzontale', en: 'Vertical then Horizontal' })}</option>
                      <option value="hv">{t({ it: 'Orizzontale poi Verticale', en: 'Horizontal then Vertical' })}</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    disabled={!canSubmit}
                    onClick={() => onSubmit({ name: name.trim(), description: description.trim() || undefined, color, width, dashed, route })}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                    title={t({ it: 'Salva', en: 'Save' })}
                  >
                    {t({ it: 'Salva', en: 'Save' })}
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

export default CableModal;
