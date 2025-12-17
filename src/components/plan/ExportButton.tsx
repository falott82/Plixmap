import { FileDown } from 'lucide-react';
import { MapObject } from '../../store/types';
import { exportPlanToPdf, PdfExportOptions } from '../../utils/pdf';
import { useToastStore } from '../../store/useToast';
import { useState } from 'react';
import PdfExportModal from './PdfExportModal';

interface Props {
  elementRef: React.RefObject<HTMLDivElement>;
  objects: MapObject[];
  planName: string;
}

const ExportButton = ({ elementRef, objects, planName }: Props) => {
  const push = useToastStore((s) => s.push);
  const [open, setOpen] = useState(false);

  const handleExport = async (options: PdfExportOptions) => {
    const el = elementRef.current;
    if (!el) return;
    try {
      await exportPlanToPdf(el, objects, planName, options);
      push('PDF esportato', 'success');
    } catch (error) {
      push('Errore durante export', 'danger');
      console.error(error);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Esporta PDF"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
      >
        <FileDown size={18} />
      </button>
      <PdfExportModal open={open} onClose={() => setOpen(false)} onConfirm={handleExport} />
    </>
  );
};

export default ExportButton;
