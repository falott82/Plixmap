import type { MutableRefObject } from 'react';
import { LayoutGrid, Trash, User, X } from 'lucide-react';
import Icon from '../ui/Icon';
import type { IconName } from '../../store/types';

export type PlanTypeMenuState = { typeId: string; label: string; icon?: IconName; x: number; y: number };

type Translate = (msg: { it: string; en: string }) => string;

export type PlanTypeMenuProps = {
  typeMenu: PlanTypeMenuState;
  typeMenuRef: MutableRefObject<HTMLDivElement | null>;
  setTypeMenu: (value: PlanTypeMenuState | null) => void;
  canManageLayers: boolean;
  isReadOnly: boolean;
  handleSelectType: (typeId: string) => void;
  handleOpenTypeLayer: (typeId: string, label: string) => void;
  handleDeleteType: (typeId: string) => void;
  t: Translate;
};

/**
 * Floating context menu shown for an object-type chip in the plan view: select
 * all of a type, create a layer for it, or remove all of that type. Extracted
 * from PlanViewView.tsx.
 */
export const PlanTypeMenu = ({
  typeMenu,
  typeMenuRef,
  setTypeMenu,
  canManageLayers,
  isReadOnly,
  handleSelectType,
  handleOpenTypeLayer,
  handleDeleteType,
  t
}: PlanTypeMenuProps) => (
  <div
    ref={typeMenuRef}
    className="context-menu-panel fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
    style={{ top: typeMenu.y, left: typeMenu.x }}
    onClick={(e) => e.stopPropagation()}
  >
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary">
          <Icon name={typeMenu.icon} />
        </span>
        <span className="truncate">{typeMenu.label}</span>
      </div>
      <button
        onClick={() => setTypeMenu(null)}
        className="text-slate-400 hover:text-ink"
        title={t({ it: 'Chiudi', en: 'Close' })}
      >
        <X size={14} />
      </button>
    </div>
    <button
      onClick={() => handleSelectType(typeMenu.typeId)}
      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
      title={t({ it: 'Seleziona tutti gli oggetti di questo tipo', en: 'Select all objects of this type' })}
    >
      <User size={14} className="text-slate-500" /> {t({ it: 'Seleziona tutti', en: 'Select all' })}
    </button>
    {canManageLayers ? (
      <button
        onClick={() => handleOpenTypeLayer(typeMenu.typeId, typeMenu.label)}
        disabled={isReadOnly}
        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        title={t({ it: 'Crea un layer per questo tipo', en: 'Create a layer for this type' })}
      >
        <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Crea layer', en: 'Create layer' })}
      </button>
    ) : null}
    <button
      onClick={() => handleDeleteType(typeMenu.typeId)}
      disabled={isReadOnly}
      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      title={t({ it: 'Rimuovi tutti gli oggetti di questo tipo', en: 'Remove all objects of this type' })}
    >
      <Trash size={14} /> {t({ it: 'Rimuovi tutti', en: 'Remove all' })}
    </button>
  </div>
);
