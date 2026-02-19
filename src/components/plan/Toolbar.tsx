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
  allowRemove?: boolean;
}

const Toolbar = ({ defs, order, onSelectType, onRemoveFromPalette, activeType, allowRemove }: Props) => {
  const lang = useLang();
  const t = useT();
  const [context, setContext] = useState<{ x: number; y: number; type: MapObjectType } | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);
  const isUserConfigured = order !== undefined && order !== null;
  const canOpenContext = !!onRemoveFromPalette && (allowRemove || isUserConfigured);
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

  type GroupId = 'desks' | 'notes' | 'people' | 'network' | 'walls' | 'other';
  const grouped = useMemo(() => {
    const resolveGroup = (def: ObjectTypeDefinition): GroupId => {
      const id = String(def.id || '');
      if (id.startsWith('desk_')) return 'desks';
      if (id === 'user') return 'people';
      if (id === 'text' || id === 'image' || id === 'photo' || id === 'postit') return 'notes';
      if (def.category === 'wall' || id.startsWith('wall_')) return 'walls';
      if (id === 'wifi' || id === 'camera' || id === 'router' || id === 'switch' || id === 'server') return 'network';
      return 'other';
    };
    const buckets = new Map<GroupId, ObjectTypeDefinition[]>();
    for (const def of list) {
      const key = resolveGroup(def);
      const prev = buckets.get(key) || [];
      prev.push(def);
      buckets.set(key, prev);
    }
    const order: GroupId[] = ['desks', 'people', 'notes', 'network', 'walls', 'other'];
    return order
      .map((id) => ({ id, items: buckets.get(id) || [] }))
      .filter((g) => g.items.length);
  }, [list]);

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
    <div className="flex flex-col items-center gap-3">
      {grouped.map((group) => {
        const groupLabel =
          group.id === 'desks'
            ? t({ it: 'Scrivanie', en: 'Desks' })
            : group.id === 'people'
              ? t({ it: 'Persone', en: 'People' })
              : group.id === 'notes'
                ? t({ it: 'Note', en: 'Notes' })
                : group.id === 'network'
                  ? t({ it: 'Rete', en: 'Network' })
                  : group.id === 'walls'
                    ? t({ it: 'Muri', en: 'Walls' })
                    : t({ it: 'Altro', en: 'Other' });
        return (
          <div key={group.id} className="flex w-full flex-col items-center gap-2">
            <div className="w-full px-1">
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-slate-200/70" />
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{groupLabel}</div>
                <div className="h-px flex-1 bg-slate-200/70" />
              </div>
            </div>
            {group.items.map((def) => {
              const active = activeType === def.id;
              const label = def.name[lang] || def.id;
              return (
                <div key={def.id} className="flex flex-col items-center">
                  <button
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/plixmap-type', def.id);
                                            e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onSelectType(def.id)}
                    onContextMenu={(e) => {
                      if (!canOpenContext) return;
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
            title={t({ it: 'Rimuovi da palette', en: 'Remove from palette' })}
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
