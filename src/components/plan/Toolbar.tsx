import { useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { MapObjectType } from '../../store/types';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';

interface Props {
  onSelectType: (type: MapObjectType) => void;
  activeType?: MapObjectType | null;
}

const Toolbar = ({ onSelectType, activeType }: Props) => {
  const defs = useDataStore((s) => s.objectTypes);
  const lang = useLang();
  const t = useT();

  const list = useMemo(() => (defs || []).slice().sort((a, b) => a.name[lang].localeCompare(b.name[lang])), [defs, lang]);

  return (
    <div className="flex flex-col items-center gap-2">
      {list.map((def) => {
        const active = activeType === def.id;
        const label = def.name[lang] || def.id;
        return (
          <div key={def.id} className="flex flex-col items-center">
            <button
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/deskly-type', def.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onSelectType(def.id)}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border text-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${
                active ? 'border-primary bg-primary/10' : 'border-slate-200 bg-white'
              }`}
              title={t({ it: label, en: label })}
            >
              <Icon name={def.icon} />
            </button>
            <span className="mt-0.5 text-[11px] text-slate-600 text-center leading-tight">{label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default Toolbar;
