import { useEffect, useMemo, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

export default function CloneFloorPlanModal({
  open,
  sourceName,
  existingNames,
  onClose,
  onConfirm
}: {
  open: boolean;
  sourceName: string;
  existingNames?: string[];
  onClose: () => void;
  onConfirm: (payload: { name: string; includeRooms: boolean; includeObjects: boolean; includeViews: boolean; includeLayers: boolean }) => void;
}) {
  const t = useT();
  const defaultName = useMemo(() => `${sourceName} (Copy)`, [sourceName]);
  const [name, setName] = useState(defaultName);
  const [includeRooms, setIncludeRooms] = useState(true);
  const [includeObjects, setIncludeObjects] = useState(false);
  const [includeViews, setIncludeViews] = useState(true);
  const [includeLayers, setIncludeLayers] = useState(true);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [defaultName, open]);

  if (!open) return null;

  const normalizeName = (v: string) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const duplicateName = useMemo(() => {
    const wanted = normalizeName(name);
    if (!wanted) return false;
    return (existingNames || []).some((n) => normalizeName(String(n || '')) === wanted);
  }, [existingNames, name]);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    if (duplicateName) return;
    onConfirm({ name: n, includeRooms, includeObjects, includeViews, includeLayers });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Copy size={18} /> {t({ it: 'Duplica planimetria', en: 'Duplicate floor plan' })}
            </div>
            <div className="modal-description">
              {t({
                it: 'Crea una nuova planimetria nello stesso edificio, usando questa come template.',
                en: 'Create a new floor plan in the same site using this one as a template.'
              })}
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Nome', en: 'Name' })}</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary/30 focus:ring-2"
              placeholder={t({ it: 'Nome nuova planimetria', en: 'New floor plan name' })}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') onClose();
              }}
            />
            {duplicateName ? (
              <div className="mt-2 text-xs font-semibold text-rose-700">
                {t({
                  it: 'Esiste gia una planimetria con questo nome nella stessa sede. Scegli un nome diverso.',
                  en: 'A floor plan with this name already exists in the same site. Please choose a different name.'
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Contenuto da copiare', en: 'What to copy' })}</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={includeLayers} onChange={(e) => setIncludeLayers(e.target.checked)} />
                {t({ it: 'Livelli', en: 'Layers' })}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={includeViews} onChange={(e) => setIncludeViews(e.target.checked)} />
                {t({ it: 'Viste', en: 'Views' })}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={includeRooms} onChange={(e) => setIncludeRooms(e.target.checked)} />
                {t({ it: 'Stanze', en: 'Rooms' })}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={includeObjects} onChange={(e) => setIncludeObjects(e.target.checked)} />
                {t({ it: 'Oggetti', en: 'Objects' })}
              </label>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {t({
                it: 'Le revisioni non vengono copiate: la nuova planimetria parte da uno stato “pulito”.',
                en: 'Revisions are not copied: the new floor plan starts in a “clean” state.'
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
              {t({ it: 'Annulla', en: 'Cancel' })}
            </button>
            <button
              onClick={submit}
              disabled={!name.trim() || duplicateName}
              className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:opacity-50"
            >
              {t({ it: 'Crea copia', en: 'Create copy' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
