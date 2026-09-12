import { Eye, EyeOff, PhoneCall } from 'lucide-react';
import { usePlanView } from './usePlanView';

type ContextMenuSafetyCardSectionProps = Pick<
  ReturnType<typeof usePlanView>,
  'securityLayerVisible' | 'toggleSecurityCardVisibility' | 'setEmergencyContactsOpen' | 'setContextMenu' | 't'
>;

/**
 * Safety-card context-menu section (toggle safety-card visibility, open the
 * emergency directory). Extracted from ContextMenuPanel.
 */
export const ContextMenuSafetyCardSection = ({
  securityLayerVisible,
  toggleSecurityCardVisibility,
  setEmergencyContactsOpen,
  setContextMenu,
  t
}: ContextMenuSafetyCardSectionProps) => (
            <>
              <button
                onClick={() => {
                  toggleSecurityCardVisibility();
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({
                  it: securityLayerVisible ? 'Nascondi scheda sicurezza' : 'Mostra scheda sicurezza',
                  en: securityLayerVisible ? 'Hide safety card' : 'Show safety card'
                })}
              >
                {securityLayerVisible ? <EyeOff size={14} className="text-slate-500" /> : <Eye size={14} className="text-slate-500" />}
                {t({
                  it: securityLayerVisible ? 'Nascondi' : 'Mostra',
                  en: securityLayerVisible ? 'Hide' : 'Show'
                })}
              </button>
              <button
                onClick={() => {
                  setEmergencyContactsOpen(true);
                  setContextMenu(null);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Apri rubrica emergenze', en: 'Open emergency directory' })}
              >
                <PhoneCall size={14} className="text-slate-500" /> {t({ it: 'Rubrica emergenze', en: 'Emergency directory' })}
              </button>
            </>
);
