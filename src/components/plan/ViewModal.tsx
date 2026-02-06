import { useEffect, useState } from 'react';
import { useT } from '../../i18n/useT';
import ModalShell from '../ui/ModalShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; description?: string; isDefault: boolean }) => void;
  initialName?: string;
  initialDescription?: string;
  initialDefault?: boolean;
}

const DEFAULT_VIEW_NAME = 'DEFAULT';

const ViewModal = ({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialDescription = '',
  initialDefault = false
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isDefault, setIsDefault] = useState(initialDefault);
  const [lastCustomName, setLastCustomName] = useState(initialName);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription);
    setIsDefault(initialDefault);
    setLastCustomName(initialName);
  }, [open, initialDefault, initialDescription, initialName]);

  useEffect(() => {
    if (!open) return;
    if (isDefault) {
      if (name !== DEFAULT_VIEW_NAME) setName(DEFAULT_VIEW_NAME);
    }
  }, [isDefault, open]);

  const trimmedName = name.trim();
  const isNameValid = isDefault || trimmedName.length > 0;

  const handleSave = () => {
    if (!isNameValid) return;
    const finalName = isDefault ? DEFAULT_VIEW_NAME : trimmedName;
    onSubmit({ name: finalName, description: description.trim() || undefined, isDefault });
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t({ it: 'Salva vista', en: 'Save view' })}
      sizeClassName="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" title={t({ it: 'Annulla', en: 'Cancel' })}>
            {t({ it: 'Annulla', en: 'Cancel' })}
          </button>
          <button
            onClick={handleSave}
            disabled={!isNameValid}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            title={t({ it: 'Salva', en: 'Save' })}
          >
            {t({ it: 'Salva', en: 'Save' })}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          {t({ it: 'Nome vista', en: 'View name' })} {isDefault ? null : <span className="text-rose-600">*</span>}
          <input
            value={name}
            onChange={(e) => {
              if (isDefault) return;
              setName(e.target.value);
              setLastCustomName(e.target.value);
            }}
            disabled={isDefault}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
            placeholder={t({ it: 'Es. Sala riunioni', en: 'e.g. Meeting room' })}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {t({ it: 'Descrizione (opzionale)', en: 'Description (optional)' })}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
            placeholder={t({ it: 'Es. Zoom su stanza A, lato nord', en: 'e.g. Zoom on room A, north side' })}
            rows={3}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => {
              const next = e.target.checked;
              setIsDefault(next);
              if (next) {
                if (name && name !== DEFAULT_VIEW_NAME) setLastCustomName(name);
                setName(DEFAULT_VIEW_NAME);
              } else {
                setName(lastCustomName || '');
              }
            }}
            className="h-4 w-4 rounded border-slate-300 text-primary"
          />
          Default
        </label>
        <div className="text-xs text-slate-500">
          {t({
            it: 'Se impostata come default, questa vista verrà caricata automaticamente per questa planimetria.',
            en: 'If set as default, this view will be loaded automatically for this floor plan.'
          })}
        </div>
      </div>
    </ModalShell>
  );
};

export default ViewModal;
