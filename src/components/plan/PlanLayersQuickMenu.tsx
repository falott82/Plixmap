import type { MutableRefObject } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanLayersQuickMenuProps = {
  layersQuickMenu: { x: number; y: number };
  layersQuickMenuRef: MutableRefObject<HTMLDivElement | null>;
  planId: string;
  layerIds: string[];
  setHideAllLayers: (planId: string, hidden: boolean) => void;
  setVisibleLayerIds: (planId: string, ids: string[]) => void;
  setLayersQuickMenu: (value: null) => void;
  t: Translate;
};

/**
 * Floating menu to show/hide all layers at once, extracted from PlanViewView.tsx.
 */
export const PlanLayersQuickMenu = ({
  layersQuickMenu,
  layersQuickMenuRef,
  planId,
  layerIds,
  setHideAllLayers,
  setVisibleLayerIds,
  setLayersQuickMenu,
  t
}: PlanLayersQuickMenuProps) => (
  <div
    ref={layersQuickMenuRef}
    className="context-menu-panel fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-card"
    style={{ top: layersQuickMenu.y, left: layersQuickMenu.x }}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={() => {
        setHideAllLayers(planId, false);
        setVisibleLayerIds(planId, layerIds);
        setLayersQuickMenu(null);
      }}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
      title={t({ it: 'Mostra tutti i livelli', en: 'Show all layers' })}
    >
      <Eye size={14} className="text-slate-500" /> {t({ it: 'Mostra tutti i livelli', en: 'Show all layers' })}
    </button>
    <button
      onClick={() => {
        setHideAllLayers(planId, true);
        setLayersQuickMenu(null);
      }}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
      title={t({ it: 'Nascondi tutti i livelli', en: 'Hide all layers' })}
    >
      <EyeOff size={14} className="text-slate-500" /> {t({ it: 'Nascondi tutti i livelli', en: 'Hide all layers' })}
    </button>
  </div>
);
