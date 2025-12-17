import { Link } from 'react-router-dom';
import { Cog, LayoutGrid } from 'lucide-react';
import { useT } from '../../i18n/useT';
import UserMenu from './UserMenu';

const EmptyWorkspace = () => {
  const t = useT();
  return (
    <div className="flex h-screen w-full flex-col bg-mist text-ink">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <LayoutGrid size={18} className="text-primary" />
          {t({ it: 'Area di lavoro', en: 'Workspace' })}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-card hover:bg-slate-50"
            title={t({ it: 'Impostazioni', en: 'Settings' })}
          >
            <Cog size={18} />
          </Link>
          <UserMenu />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="text-lg font-semibold text-ink">{t({ it: 'Nessuna planimetria disponibile', en: 'No floor plans available' })}</div>
          <div className="mt-2 text-sm text-slate-600">
            {t({
              it: 'Per iniziare, crea Cliente/Sede/Planimetria dalle Impostazioni e carica un’immagine.',
              en: 'To get started, create Client/Site/Floor plan in Settings and upload an image.'
            })}
          </div>
          <div className="mt-5">
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Cog size={16} />
              {t({ it: 'Vai alle impostazioni', en: 'Go to settings' })}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyWorkspace;

