import { BarChart3, CalendarDays, Clock3, MapPinned, PhoneCall, Users } from 'lucide-react';
import { parseCoords } from './SidebarTree.helpers';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarSiteMenuProps = {
  siteMenu: any;
  setSiteMenu: (value: null) => void;
  clients: any[];
  user: any;
  isSuperAdmin: boolean;
  findFirstPlanForSite: (...args: any[]) => any;
  setMissingPlansNotice: (...args: any[]) => any;
  openCapacityDashboard: (...args: any[]) => any;
  openFindCapacity: (...args: any[]) => any;
  openClientMeetingsTimeline: (...args: any[]) => any;
  setSiteSupportContactsModal: (...args: any[]) => any;
  setSiteHoursModal: (...args: any[]) => any;
  t: Translate;
};

/**
 * Site context menu (capacity dashboard, find capacity, meetings, useful
 * contacts, site hours, Google Maps). Extracted from SidebarTree.tsx.
 */
export const SidebarSiteMenu = ({
  siteMenu,
  setSiteMenu,
  clients,
  user,
  isSuperAdmin,
  findFirstPlanForSite,
  setMissingPlansNotice,
  openCapacityDashboard,
  openFindCapacity,
  openClientMeetingsTimeline,
  setSiteSupportContactsModal,
  setSiteHoursModal,
  t
}: SidebarSiteMenuProps) => {
  if (!siteMenu) return null;
  return (
            <div
              className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
              style={{ top: siteMenu.y, left: siteMenu.x }}
            >
              <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
                {t({ it: 'Sede', en: 'Site' })}
              </div>
              <button
                onClick={() => {
                  const targetPlanId = findFirstPlanForSite(siteMenu.clientId, siteMenu.siteId);
                  if (!targetPlanId) {
                    const clientLabel = clients.find((c) => c.id === siteMenu.clientId)?.shortName || clients.find((c) => c.id === siteMenu.clientId)?.name || siteMenu.siteName;
                    setMissingPlansNotice({ clientName: clientLabel });
                    setSiteMenu(null);
                    return;
                  }
                  openCapacityDashboard(targetPlanId, { clientId: siteMenu.clientId, siteId: siteMenu.siteId });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri dashboard capienza', en: 'Open capacity dashboard' })}
              >
                <BarChart3 size={14} className="text-slate-600" />
                {t({ it: 'Dashboard capienza', en: 'Capacity dashboard' })}
              </button>
              <button
                onClick={() => {
                  const targetPlanId = findFirstPlanForSite(siteMenu.clientId, siteMenu.siteId);
                  if (!targetPlanId) {
                    const clientLabel = clients.find((c) => c.id === siteMenu.clientId)?.shortName || clients.find((c) => c.id === siteMenu.clientId)?.name || siteMenu.siteName;
                    setMissingPlansNotice({ clientName: clientLabel });
                    setSiteMenu(null);
                    return;
                  }
                  openFindCapacity(targetPlanId, { clientId: siteMenu.clientId, siteId: siteMenu.siteId });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Trova capienza', en: 'Find capacity' })}
              >
                <Users size={14} className="text-slate-600" />
                {t({ it: 'Trova capienza', en: 'Find capacity' })}
              </button>
              <button
                onClick={() => openClientMeetingsTimeline(siteMenu.clientId, siteMenu.siteId, true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Mostra meetings della sede', en: 'Show meetings for this site' })}
              >
                <CalendarDays size={14} className="text-slate-600" />
                {t({ it: 'Mostra meetings', en: 'Show meetings' })}
              </button>
              <button
                onClick={() => {
                  const clientLabel =
                    clients.find((c) => c.id === siteMenu.clientId)?.shortName ||
                    clients.find((c) => c.id === siteMenu.clientId)?.name ||
                    '-';
                  setSiteSupportContactsModal({
                    clientId: siteMenu.clientId,
                    siteId: siteMenu.siteId,
                    clientName: clientLabel,
                    siteName: siteMenu.siteName,
                    supportContacts: siteMenu.supportContacts
                  });
                  setSiteMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Mostra contatti utili della sede', en: 'Show site useful contacts' })}
              >
                <PhoneCall size={14} className="text-slate-600" />
                {t({ it: 'Contatti utili', en: 'Useful contacts' })}
              </button>
              {(user?.isAdmin || isSuperAdmin) ? (
                <button
                  onClick={() => {
                    const clientEntry = clients.find((entry) => entry.id === siteMenu.clientId);
                    setSiteHoursModal({
                      clientId: siteMenu.clientId,
                      clientName: clientEntry?.shortName || clientEntry?.name || '-',
                      siteId: siteMenu.siteId,
                      siteName: siteMenu.siteName,
                      siteSchedule: siteMenu.siteSchedule
                    });
                    setSiteMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                  title={t({ it: 'Configura orari e festivi della sede', en: 'Configure site hours and holidays' })}
                >
                  <Clock3 size={14} className="text-cyan-700" />
                  {t({ it: 'Orari sede', en: 'Site hours' })}
                </button>
              ) : null}
              {parseCoords(siteMenu.coords) ? (
                <a
                  href={`https://www.google.com/maps?q=${parseCoords(siteMenu.coords)!.lat},${parseCoords(siteMenu.coords)!.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <MapPinned size={14} className="text-emerald-700" />
                  {t({ it: 'Apri su Google Maps', en: 'View in Google Maps' })}
                </a>
              ) : (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {t({ it: 'Nessuna coordinata salvata.', en: 'No coordinates saved.' })}
                </div>
              )}
            </div>
  );
};
