import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { MapPinned, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  open: boolean;
  initialName?: string;
  initialCoords?: string;
  title: string;
  onClose: () => void;
  onSubmit: (payload: { name: string; coords?: string }) => void;
}

const parseCoords = (value: string): { lat: number; lng: number } | null => {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const SiteModal = ({ open, initialName = '', initialCoords = '', title, onClose, onSubmit }: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [coords, setCoords] = useState(initialCoords);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCoords(initialCoords);
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initialCoords, initialName, open]);

  const canSubmit = useMemo(() => !!name.trim(), [name]);
  const parsed = useMemo(() => parseCoords(coords), [coords]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), coords: coords.trim() || undefined });
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
              <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Nome sede', en: 'Site name' })} <span className="text-rose-600">*</span>
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. HQ Via Nave 11', en: 'e.g. HQ Wall Street 01' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submit();
                        }
                      }}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Coordinate (Google)', en: 'Coordinates (Google)' })}
                    <div className="text-xs font-normal text-slate-500">
                      {t({
                        it: 'Facoltativo. Formato: “lat, lng” (es. 43.697000, 11.809931).',
                        en: 'Optional. Format: “lat, lng” (e.g. 43.697000, 11.809931).'
                      })}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        value={coords}
                        onChange={(e) => setCoords(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="43.697000, 11.809931"
                      />
                      {parsed ? (
                        <a
                          href={`https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Apri su Google Maps', en: 'Open in Google Maps' })}
                        >
                          <MapPinned size={18} className="text-emerald-700" />
                        </a>
                      ) : null}
                    </div>
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Chiudi senza salvare le modifiche', en: 'Close without saving changes' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    disabled={!canSubmit}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-primary/90 disabled:opacity-60"
                    title={t({ it: 'Salva la sede', en: 'Save the site' })}
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

export default SiteModal;
