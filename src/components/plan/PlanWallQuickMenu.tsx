import { Pencil, Plus, Square, Trash } from 'lucide-react';

type Point = { x: number; y: number };
type Translate = (msg: { it: string; en: string }) => string;

export type PlanWallQuickMenuState = { id: string; x: number; y: number; world: Point };

export type PlanWallQuickMenuProps = {
  wallQuickMenu: PlanWallQuickMenuState;
  setWallQuickMenu: (value: null) => void;
  setWallTypeMenu: (value: { ids: string[]; x: number; y: number } | null) => void;
  handleEdit: (id: string) => void;
  setConfirmDelete: (ids: string[]) => void;
  splitWallAtPoint: (payload: { id: string; point: Point }) => void;
  t: Translate;
};

/**
 * Floating quick-action bar for a wall segment (set type / edit / delete / split),
 * extracted from PlanViewView.tsx.
 */
export const PlanWallQuickMenu = ({
  wallQuickMenu,
  setWallQuickMenu,
  setWallTypeMenu,
  handleEdit,
  setConfirmDelete,
  splitWallAtPoint,
  t
}: PlanWallQuickMenuProps) => (
  <div
    className="context-menu-panel fixed z-50 flex items-center gap-2 rounded-xl bg-slate-900/90 px-2 py-1.5 text-white shadow-card"
    style={{ top: wallQuickMenu.y - 52, left: wallQuickMenu.x - 42 }}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={() => {
        setWallTypeMenu({ ids: [wallQuickMenu.id], x: wallQuickMenu.x + 8, y: wallQuickMenu.y - 12 });
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
      title={t({ it: 'Tipo muro', en: 'Wall type' })}
    >
      <Square size={14} />
    </button>
    <button
      onClick={() => {
        handleEdit(wallQuickMenu.id);
        setWallQuickMenu(null);
        setWallTypeMenu(null);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
      title={t({ it: 'Modifica muro', en: 'Edit wall' })}
    >
      <Pencil size={14} />
    </button>
    <button
      onClick={() => {
        setConfirmDelete([wallQuickMenu.id]);
        setWallQuickMenu(null);
        setWallTypeMenu(null);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
      title={t({ it: 'Elimina muro', en: 'Delete wall' })}
    >
      <Trash size={14} />
    </button>
    <button
      onClick={() => {
        splitWallAtPoint({ id: wallQuickMenu.id, point: wallQuickMenu.world });
        setWallQuickMenu(null);
        setWallTypeMenu(null);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
      title={t({ it: 'Dividi muro', en: 'Split wall' })}
    >
      <Plus size={14} />
    </button>
  </div>
);
