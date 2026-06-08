import { DoorOpen, Pencil, Trash } from 'lucide-react';
import type { ToastTone } from '../../store/useToast';

type Translate = (msg: { it: string; en: string }) => string;

export type PlanCorridorQuickMenuState = { id: string; x: number; y: number };

export type PlanCorridorQuickMenuProps = {
  corridorQuickMenu: PlanCorridorQuickMenuState;
  corridorDoorDraft: { corridorId: string } | null;
  openEditCorridor: (id: string) => void;
  setCorridorQuickMenu: (value: null) => void;
  setCorridorDoorDraft: (value: null) => void;
  startCorridorDoorDraw: (id: string) => void;
  setConfirmDeleteCorridorId: (id: string) => void;
  push: (message: string, tone?: ToastTone) => void;
  t: Translate;
};

/**
 * Floating quick-action bar for a corridor (rename / insert door / delete),
 * extracted from PlanViewView.tsx.
 */
export const PlanCorridorQuickMenu = ({
  corridorQuickMenu,
  corridorDoorDraft,
  openEditCorridor,
  setCorridorQuickMenu,
  setCorridorDoorDraft,
  startCorridorDoorDraw,
  setConfirmDeleteCorridorId,
  push,
  t
}: PlanCorridorQuickMenuProps) => (
  <div
    className="context-menu-panel fixed z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900/90 px-2 py-1.5 text-white shadow-card"
    style={{ top: corridorQuickMenu.y - 52, left: corridorQuickMenu.x }}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={() => {
        openEditCorridor(corridorQuickMenu.id);
        setCorridorQuickMenu(null);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
      title={t({ it: 'Rinomina corridoio', en: 'Rename corridor' })}
    >
      <Pencil size={14} />
    </button>
    <button
      onClick={() => {
        if (corridorDoorDraft?.corridorId === corridorQuickMenu.id) {
          setCorridorDoorDraft(null);
          push(t({ it: 'Disegno porta corridoio annullato', en: 'Corridor door drawing cancelled' }), 'info');
          return;
        }
        startCorridorDoorDraw(corridorQuickMenu.id);
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg ${corridorDoorDraft?.corridorId === corridorQuickMenu.id ? 'bg-amber-500/80 text-white' : 'bg-white/10 hover:bg-white/20'}`}
      title={
        corridorDoorDraft?.corridorId === corridorQuickMenu.id
          ? t({ it: 'Annulla inserimento porta', en: 'Cancel door insertion' })
          : t({ it: 'Inserisci porta sul perimetro del corridoio', en: 'Insert door on corridor perimeter' })
      }
    >
      <DoorOpen size={14} />
    </button>
    <button
      onClick={() => {
        setConfirmDeleteCorridorId(corridorQuickMenu.id);
        setCorridorQuickMenu(null);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
      title={t({ it: 'Elimina corridoio', en: 'Delete corridor' })}
    >
      <Trash size={14} />
    </button>
  </div>
);
