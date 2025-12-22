import { useMemo } from 'react';
import { MapObjectType, ObjectTypeDefinition } from '../../store/types';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';

interface Props {
  defs: ObjectTypeDefinition[];
  order?: string[] | null;
  onSelectType: (type: MapObjectType) => void;
  activeType?: MapObjectType | null;
}

const Toolbar = ({ defs, order, onSelectType, activeType }: Props) => {
  const lang = useLang();
  const t = useT();

  const list = useMemo(() => {
    const base = defs || [];
    const byId = new Map(base.map((d) => [d.id, d]));
    if (order !== undefined && order !== null) {
      // When an explicit order is provided, the palette is considered user-configured.
      // An empty list means "show nothing".
      const ord = (order || []).filter((id): id is string => typeof id === 'string' && !!id);
      const out: ObjectTypeDefinition[] = [];
      const used = new Set<string>();
      for (const id of ord) {
        const def = byId.get(id);
        if (!def || used.has(id)) continue;
        used.add(id);
        out.push(def);
      }
      return out;
    }
    // Back-compat: if no order is provided, show all available types.
    return base.slice().sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
  }, [defs, lang, order]);

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
