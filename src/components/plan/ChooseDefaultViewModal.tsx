import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { FloorPlanView } from '../../store/types';
import { useT } from '../../i18n/useT';
import ModalShell from '../ui/ModalShell';

interface Props {
  open: boolean;
  views: FloorPlanView[];
  onClose: () => void;
  onConfirm: (newDefaultViewId: string) => void;
}

const ChooseDefaultViewModal = ({ open, views, onClose, onConfirm }: Props) => {
  const firstId = useMemo(() => views[0]?.id, [views]);
  const [selectedId, setSelectedId] = useState<string>(firstId || '');
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setSelectedId(firstId || '');
  }, [firstId, open]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      sizeClassName="max-w-md"
      title={t({ it: 'Scegli la nuova vista predefinita', en: 'Choose the new default view' })}
      description={t({
        it: 'Stai eliminando la vista predefinita: seleziona quale vista impostare come nuova predefinita.',
        en: 'You are deleting the default view: choose which view should become the new default.'
      })}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" title={t({ it: 'Annulla', en: 'Cancel' })}>
            {t({ it: 'Annulla', en: 'Cancel' })}
          </button>
          <button
            disabled={!selectedId}
            onClick={() => {
              if (!selectedId) return;
              onConfirm(selectedId);
            }}
            className="inline-flex items-center gap-2 btn-primary disabled:opacity-50"
            title={t({ it: 'Imposta predefinita', en: 'Set default' })}
          >
            <Star size={16} className="text-amber-300" />
            {t({ it: 'Imposta predefinita', en: 'Set default' })}
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {views.length ? (
          views.map((v) => (
            <label
              key={v.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition ${
                selectedId === v.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="default-view"
                value={v.id}
                checked={selectedId === v.id}
                onChange={() => setSelectedId(v.id)}
                className="mt-1 h-4 w-4 text-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{v.name}</div>
                {v.description ? <div className="truncate text-xs text-slate-500">{v.description}</div> : null}
              </div>
            </label>
          ))
        ) : (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{t({ it: 'Nessuna vista disponibile.', en: 'No views available.' })}</div>
        )}
      </div>
    </ModalShell>
  );
};

export default ChooseDefaultViewModal;
