import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n/useT';

export type LinkEditPayload = {
  name?: string;
  description?: string;
  color?: string;
  width?: number;
  dashed?: boolean;
  arrow?: 'none' | 'start' | 'end' | 'both';
};

interface Props {
  open: boolean;
  initial?: LinkEditPayload;
  onClose: () => void;
  onSubmit: (payload: LinkEditPayload) => void;
  onDelete?: () => void;
}

const LinkEditModal = ({ open, initial, onClose, onSubmit, onDelete }: Props) => {
  const t = useT();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#94a3b8');
  const [width, setWidth] = useState(1);
  const [dashed, setDashed] = useState(false);
  const [arrowStart, setArrowStart] = useState(false);
  const [arrowEnd, setArrowEnd] = useState(true);

  const widthLabel = useMemo(() => {
    const w = Number(width) || 1;
    return w.toFixed(0);
  }, [width]);

  useEffect(() => {
    if (!open) return;
    setName(String(initial?.name || ''));
    setDescription(String(initial?.description || ''));
    setColor(String(initial?.color || '#94a3b8'));
    setWidth(Math.max(1, Math.min(12, Number(initial?.width ?? 1) || 1)));
    setDashed(!!initial?.dashed);
    const arrow = initial?.arrow;
    if (arrow === 'both') {
      setArrowStart(true);
      setArrowEnd(true);
    } else if (arrow === 'start') {
      setArrowStart(true);
      setArrowEnd(false);
    } else if (arrow === 'none') {
      setArrowStart(false);
      setArrowEnd(false);
    } else {
      setArrowStart(false);
      setArrowEnd(false);
    }
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [open, initial?.name, initial?.description, initial?.color, initial?.width, initial?.dashed, initial?.arrow]);

  const submit = () => {
    const arrow = arrowStart && arrowEnd ? 'both' : arrowStart ? 'start' : arrowEnd ? 'end' : 'none';
    onSubmit({
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      color: color || undefined,
      width: Number(width) || undefined,
      dashed: !!dashed,
      arrow
    });
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-xl modal-panel">
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">{t({ it: 'Modifica collegamento', en: 'Edit link' })}</Dialog.Title>
                  <button onClick={onClose} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <Dialog.Description className="modal-description">
                  {t({
                    it: 'Aggiorna nome, descrizione e stile (colore/spessore/tratteggio) del collegamento.',
                    en: 'Update the link name, description and style (color/width/dashed).'
                  })}
                </Dialog.Description>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <label className="text-sm font-semibold text-slate-700">
                    {t({ it: 'Nome', en: 'Name' })}
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Opzionale', en: 'Optional' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          submit();
                        }
                      }}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {t({ it: 'Descrizione', en: 'Description' })}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 h-28 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Opzionale', en: 'Optional' })}
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Colore', en: 'Color' })}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-1"
                          aria-label={t({ it: 'Colore collegamento', en: 'Link color' })}
                        />
                        <input
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-mono outline-none ring-primary/30 focus:ring-2"
                          placeholder="#94a3b8"
                        />
                      </div>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Spessore', en: 'Width' })}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="range"
                          min={1}
                          max={12}
                          step={1}
                          value={width}
                          onChange={(e) => setWidth(Number(e.target.value))}
                          className="w-full"
                        />
                        <div className="w-8 text-right text-xs font-mono text-slate-600">{widthLabel}</div>
                      </div>
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <span>{t({ it: 'Tratteggio', en: 'Dashed' })}</span>
                      <input type="checkbox" checked={dashed} onChange={(e) => setDashed(e.target.checked)} />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <span>{t({ it: 'Freccia SX', en: 'Arrow left' })}</span>
                      <input type="checkbox" checked={arrowStart} onChange={(e) => setArrowStart(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <span>{t({ it: 'Freccia DX', en: 'Arrow right' })}</span>
                      <input type="checkbox" checked={arrowEnd} onChange={(e) => setArrowEnd(e.target.checked)} />
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  {onDelete ? (
                    <button
                      onClick={onDelete}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100"
                      title={t({ it: 'Elimina', en: 'Delete' })}
                    >
                      {t({ it: 'Elimina', en: 'Delete' })}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
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

export default LinkEditModal;
