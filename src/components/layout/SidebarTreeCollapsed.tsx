import { ChevronRight } from 'lucide-react';
import { PLIXMAP_WEBSITE_URL } from '../../constants/links';
import FooterInfo from './FooterInfo';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarTreeCollapsedProps = {
  toggleSidebar: () => void;
  t: Translate;
};

/**
 * Collapsed (narrow) sidebar rail: logo, open-menu button and footer info.
 * Extracted from SidebarTree.tsx.
 */
export const SidebarTreeCollapsed = ({ toggleSidebar, t }: SidebarTreeCollapsedProps) => (
      <aside className="flex h-screen w-14 flex-col items-center gap-4 border-r border-slate-200 bg-white py-4">
        <a
          href={PLIXMAP_WEBSITE_URL}
          target="_blank"
          rel="noreferrer"
          className="h-[3.75rem] w-[3.75rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
          title={t({ it: 'Apri sito ufficiale Plixmap', en: 'Open official Plixmap website' })}
        >
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
        </a>
        <button
          onClick={toggleSidebar}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          title={t({ it: 'Apri menu', en: 'Open menu' })}
        >
          <ChevronRight size={16} />
        </button>
        <FooterInfo variant="collapsed" />
      </aside>
);
