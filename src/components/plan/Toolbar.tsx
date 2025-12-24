import { useEffect, useMemo, useRef, useState } from 'react';
import { MapObjectType, ObjectTypeDefinition } from '../../store/types';
import Icon from '../ui/Icon';
import { useLang, useT } from '../../i18n/useT';
import { Trash2 } from 'lucide-react';

interface Props {
  defs: ObjectTypeDefinition[];
  order?: string[] | null;
  onSelectType: (type: MapObjectType) => void;
  onRemoveFromPalette?: (type: MapObjectType) => void;
  activeType?: MapObjectType | null;
}

const Toolbar = ({ defs, order, onSelectType, onRemoveFromPalette, activeType }: Props) => {
  const lang = useLang();
  const t = useT();
  const [context, setContext] = useState<{ x: number; y: number; type: MapObjectType } | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);
  const isUserConfigured = order !== undefined && order !== null;
  const contextStyle = useMemo(() => {
    if (!context) return undefined;
    const menuW = 220;
    const menuH = 44;
    const pad = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    const left = vw ? Math.max(pad, Math.min(context.x, vw - menuW - pad)) : context.x;
    const top = vh ? Math.max(pad, Math.min(context.y, vh - menuH - pad)) : context.y;
    return { left, top } as const;
  }, [context]);

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

  useEffect(() => {
    if (!context) return;
    const onDown = (e: MouseEvent) => {
      if (contextRef.current && contextRef.current.contains(e.target as any)) return;
      setContext(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [context]);

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
              onContextMenu={(e) => {
                if (!isUserConfigured) return;
                if (!onRemoveFromPalette) return;
                e.preventDefault();
                e.stopPropagation();
                setContext({ x: e.clientX, y: e.clientY, type: def.id });
              }}
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

      {context ? (
        <div
          ref={contextRef}
          className="fixed z-[60] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
          style={contextStyle ? { left: contextStyle.left, top: contextStyle.top } : { left: context.x, top: context.y }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-slate-50"
            onClick={() => {
              const type = context.type;
              setContext(null);
              onRemoveFromPalette?.(type);
            }}
          >
            <Trash2 size={16} className="text-slate-500" />
            {t({ it: 'Rimuovi da palette', en: 'Remove from palette' })}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default Toolbar;
