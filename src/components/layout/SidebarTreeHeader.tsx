import { type Dispatch, type SetStateAction } from 'react';
import { ChevronLeft, ChevronsDown, ChevronsUp, Search } from 'lucide-react';
import { PLIXMAP_WEBSITE_URL } from '../../constants/links';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarTreeHeaderProps = {
  treeQuery: string;
  setTreeQuery: Dispatch<SetStateAction<string>>;
  allTreeExpanded: boolean;
  toggleSidebar: () => void;
  handleCollapseAll: () => void;
  handleExpandAll: () => void;
  t: Translate;
};

/**
 * Sidebar header: Plixmap logo, collapse button, tree search box and the
 * expand/collapse-all toggle. Extracted from SidebarTree.tsx.
 */
export const SidebarTreeHeader = ({
  treeQuery,
  setTreeQuery,
  allTreeExpanded,
  toggleSidebar,
  handleCollapseAll,
  handleExpandAll,
  t
}: SidebarTreeHeaderProps) => (
  <>
      <div className="flex items-center justify-between px-4 py-4">
        <a
          href={PLIXMAP_WEBSITE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-lg font-semibold text-ink"
          title={t({ it: 'Apri sito ufficiale Plixmap', en: 'Open official Plixmap website' })}
        >
          <span className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <img
              src="/plixmap-logo.png"
              alt="Plixmap"
              className="h-full w-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('/favicon.svg')) return;
                target.src = '/favicon.svg';
              }}
            />
          </span>
          Plixmap
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            title={t({ it: 'Collassa', en: 'Collapse' })}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={treeQuery}
            onChange={(e) => setTreeQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setTreeQuery('');
            }}
            placeholder={t({ it: 'Cerca cliente/sede/planimetria…', en: 'Search client/site/floor plan…' })}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={allTreeExpanded ? handleCollapseAll : handleExpandAll}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          title={
            allTreeExpanded
              ? t({ it: 'Compatta tutti i clienti e le sedi', en: 'Collapse all clients and sites' })
              : t({ it: 'Espandi tutti i clienti e le sedi', en: 'Expand all clients and sites' })
          }
        >
          {allTreeExpanded ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
        </button>
        <div className="min-w-0 truncate text-xs font-semibold uppercase text-slate-500">
          {t({ it: 'Cliente → Sede → Planimetria', en: 'Client → Site → Floor plan' })}
        </div>
      </div>
  </>
);
