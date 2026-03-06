import { useMemo, useState } from 'react';
import { HardDrive, Users } from 'lucide-react';
import { useT } from '../../i18n/useT';
import CustomImportPanel from './CustomImportPanel';
import ClientDevicesImportPanel from './ClientDevicesImportPanel';

type Props = {
  initialClientId?: string | null;
  lockClientSelection?: boolean;
};

const ClientImportUnifiedPanel = ({ initialClientId, lockClientSelection = false }: Props) => {
  const t = useT();
  const [tab, setTab] = useState<'users' | 'devices'>('users');

  const tabs = useMemo(
    () => [
      {
        key: 'users' as const,
        icon: Users,
        label: t({ it: 'Client Users', en: 'Client Users' }),
        desc: t({ it: 'Import e sync anagrafica utenti', en: 'User directory import and sync' })
      },
      {
        key: 'devices' as const,
        icon: HardDrive,
        label: t({ it: 'Client Devices', en: 'Client Devices' }),
        desc: t({ it: 'Import e sync inventario dispositivi', en: 'Device inventory import and sync' })
      }
    ],
    [t]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {tabs.map((entry) => {
            const Icon = entry.icon;
            const active = tab === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setTab(entry.key)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={entry.desc}
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md ${
                    active ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{entry.label}</span>
                  <span className="block text-xs text-slate-500">{entry.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'users' ? (
        <CustomImportPanel initialClientId={initialClientId || undefined} lockClientSelection={lockClientSelection} />
      ) : (
        <ClientDevicesImportPanel initialClientId={initialClientId || undefined} lockClientSelection={lockClientSelection} />
      )}
    </div>
  );
};

export default ClientImportUnifiedPanel;
