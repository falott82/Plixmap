import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { PdfExportOptions, PdfOrientation } from '../../utils/pdf';
import { useT } from '../../i18n/useT';
import ModalShell from '../ui/ModalShell';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: PdfExportOptions) => void;
}

const PdfExportModal = ({ open, onClose, onConfirm }: Props) => {
  const [orientation, setOrientation] = useState<PdfOrientation>('auto');
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setOrientation('auto');
  }, [open]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t({ it: 'Esporta PDF', en: 'Export PDF' })}
      sizeClassName="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" title={t({ it: 'Annulla', en: 'Cancel' })}>
            {t({ it: 'Annulla', en: 'Cancel' })}
          </button>
          <button
            onClick={() => {
              onConfirm({ orientation, includeList: false });
              onClose();
            }}
            className="inline-flex items-center gap-2 btn-primary"
            title={t({ it: 'Esporta', en: 'Export' })}
          >
            <Check size={16} />
            {t({ it: 'Esporta', en: 'Export' })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-700">{t({ it: 'Orientamento', en: 'Orientation' })}</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              { value: 'auto', label: t({ it: 'Auto', en: 'Auto' }) },
              { value: 'landscape', label: t({ it: 'Orizz.', en: 'Land.' }) },
              { value: 'portrait', label: t({ it: 'Vert.', en: 'Port.' }) }
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOrientation(opt.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  orientation === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={opt.label}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {t({
              it: 'Auto sceglie in base alle proporzioni della planimetria.',
              en: 'Auto chooses based on the floor plan aspect ratio.'
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default PdfExportModal;
