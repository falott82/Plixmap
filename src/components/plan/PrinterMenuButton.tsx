import { useEffect, useMemo, useRef, useState } from 'react';
import { Crop, FileDown, Printer, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

type Props = {
  isReadOnly: boolean;
  hasPrintArea: boolean;
  onSetPrintArea: () => void;
  onClearPrintArea: () => void;
  onExportPdf: () => void;
};

const PrinterMenuButton = ({ isReadOnly, hasPrintArea, onSetPrintArea, onClearPrintArea, onExportPdf }: Props) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const printLabel = useMemo(() => t({ it: 'Stampa', en: 'Print' }), [t]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
        title={printLabel}
      >
        <Printer size={18} />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <button
            onClick={() => {
              if (isReadOnly) return;
              setOpen(false);
              onSetPrintArea();
            }}
            disabled={isReadOnly}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={t({ it: 'Imposta area di stampa', en: 'Set print area' })}
          >
            <Crop size={16} className="text-slate-500" />
            {t({ it: 'Imposta area di stampa', en: 'Set print area' })}
          </button>

          <button
            onClick={() => {
              if (isReadOnly || !hasPrintArea) return;
              setOpen(false);
              onClearPrintArea();
            }}
            disabled={isReadOnly || !hasPrintArea}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={t({ it: 'Rimuovi area di stampa', en: 'Clear print area' })}
          >
            <X size={16} className="text-slate-500" />
            {t({ it: 'Rimuovi area di stampa', en: 'Clear print area' })}
          </button>

          <button
            onClick={() => {
              setOpen(false);
              onExportPdf();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
            title={t({ it: 'Esporta PDF', en: 'Export PDF' })}
          >
            <FileDown size={16} className="text-slate-500" />
            {t({ it: 'Esporta PDF', en: 'Export PDF' })}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default PrinterMenuButton;
