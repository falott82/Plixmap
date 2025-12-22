import { FileDown } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  onClick: () => void;
}

const ExportButton = ({ onClick }: Props) => {
  const t = useT();
  return (
    <button
      onClick={onClick}
      title={t({ it: 'Esporta PDF', en: 'Export PDF' })}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
    >
      <FileDown size={18} />
    </button>
  );
};

export default ExportButton;

