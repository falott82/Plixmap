import { getWallTypeColor } from '../../utils/wallColors';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanWallTypeMenuProps = {
  wallTypeMenu: { ids: string[]; x: number; y: number };
  wallTypeDefs: Array<{ id: string }>;
  getTypeLabel: (id: string) => string;
  applyWallTypeToIds: (ids: string[], typeId: string) => void;
  setWallTypeMenu: (value: null) => void;
  setWallQuickMenu: (value: null) => void;
  t: Translate;
};

/**
 * Floating picker that assigns a wall type to the selected wall segment(s),
 * extracted from PlanViewView.tsx.
 */
export const PlanWallTypeMenu = ({
  wallTypeMenu,
  wallTypeDefs,
  getTypeLabel,
  applyWallTypeToIds,
  setWallTypeMenu,
  setWallQuickMenu,
  t
}: PlanWallTypeMenuProps) => (
  <div
    className="context-menu-panel fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
    style={{ top: wallTypeMenu.y, left: wallTypeMenu.x }}
    onClick={(e) => e.stopPropagation()}
  >
    <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
      {t({ it: 'Tipi muro', en: 'Wall types' })}
    </div>
    <div className="max-h-64 space-y-1 overflow-y-auto">
      {wallTypeDefs.map((def) => {
        const label = getTypeLabel(def.id);
        const attenuation = Number((def as any).attenuationDb);
        const suffix = Number.isFinite(attenuation) ? ` (${attenuation} dB)` : '';
        return (
          <button
            key={def.id}
            onClick={() => {
              applyWallTypeToIds(wallTypeMenu.ids, def.id);
              setWallTypeMenu(null);
              setWallQuickMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
          >
            <span
              className="inline-flex h-2.5 w-2.5 rounded-full border border-slate-200"
              style={{ background: getWallTypeColor(def.id) }}
            />
            <span className="truncate text-sm text-slate-700">
              {label}
              {suffix}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
