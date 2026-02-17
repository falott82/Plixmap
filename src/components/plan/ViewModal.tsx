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
  hasExistingDefault?: boolean;
  existingDefaultName?: string;
}

const ViewModal = ({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialDescription = '',
  initialDefault = false,
  hasExistingDefault = false,
  existingDefaultName = ''
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isDefault, setIsDefault] = useState(initialDefault);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription);
    setIsDefault(initialDefault);
  }, [open, initialDefault, initialDescription, initialName]);

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length > 0;

  const handleSave = () => {
    if (!isNameValid) return;
    onSubmit({ name: trimmedName, description: description.trim() || undefined, isDefault });
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
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary"
          />
          {t({ it: 'Default', en: 'Default' })}
        </label>
        {isDefault ? (
          <div className="text-xs text-slate-500">
            {t({
              it: 'Se impostata come default, questa vista verrà caricata automaticamente per questa planimetria.',
              en: 'If set as default, this view will be loaded automatically for this floor plan.'
            })}
          </div>
        ) : null}
        {isDefault && hasExistingDefault ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {t({
              it:
                existingDefaultName.trim().length > 0
                  ? `La planimetria ha già una vista di default ("${existingDefaultName}"), salvando verrà impostata questa come vista di default. La vista precedente non sarà più predefinita e, se necessario, verrà rinominata con suffisso (_1, _2, ...).`
                  : 'La planimetria ha già una vista di default, salvando verrà impostata questa come vista di default. La vista precedente non sarà più predefinita e, se necessario, verrà rinominata con suffisso (_1, _2, ...).',
              en:
                existingDefaultName.trim().length > 0
                  ? `This floor plan already has a default view ("${existingDefaultName}"); saving will set this one as default. The previous view will no longer be default and, if needed, will be renamed with suffixes (_1, _2, ...).`
                  : 'This floor plan already has a default view; saving will set this one as default. The previous view will no longer be default and, if needed, will be renamed with suffixes (_1, _2, ...).'
            })}
          </div>
        ) : null}
        <label className="block text-sm font-medium text-slate-700">
          {t({ it: 'Nome vista', en: 'View name' })} <span className="text-rose-600">*</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
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
      </div>
    </ModalShell>
  );
};

export default ViewModal;
