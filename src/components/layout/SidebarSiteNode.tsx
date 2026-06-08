import { type MutableRefObject } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SidebarPlanItem } from './SidebarPlanItem';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarSiteNodeProps = {
  site: any;
  client: any;
  searchActive: boolean;
  expandedSites: Record<string, boolean | undefined>;
  toggleSiteExpanded: (key: string) => void;
  setSiteMenu: (...args: any[]) => any;
  selectedPlanId: any;
  locationPathname: string;
  defaultPlanId: any;
  lockedPlans: any;
  user: any;
  dragRef: MutableRefObject<any>;
  shouldPromptUnsavedPlanSwitch: (...args: any[]) => any;
  requestSaveAndNavigate?: (...args: any[]) => any;
  setSelectedPlan: (...args: any[]) => any;
  navigate: (...args: any[]) => any;
  setPlanMenu: (...args: any[]) => any;
  setLockMenu: (...args: any[]) => any;
  reorderFloorPlans: (...args: any[]) => any;
  t: Translate;
};

/**
 * A site node in the sidebar tree: collapsible site header (with context menu)
 * and its ordered list of floor plans. Extracted from SidebarTree.tsx.
 */
export const SidebarSiteNode = ({
  site,
  client,
  searchActive,
  expandedSites,
  toggleSiteExpanded,
  setSiteMenu,
  selectedPlanId,
  locationPathname,
  defaultPlanId,
  lockedPlans,
  user,
  dragRef,
  shouldPromptUnsavedPlanSwitch,
  requestSaveAndNavigate,
  setSelectedPlan,
  navigate,
  setPlanMenu,
  setLockMenu,
  reorderFloorPlans,
  t
}: SidebarSiteNodeProps) => {
  const siteKey = `${client.id}:${site.id}`;
  const siteExpanded = searchActive || expandedSites[siteKey] !== false;
  return (
                    <div key={site.id} className="mt-3 space-y-2 rounded-lg bg-white p-2 shadow-inner">
                      <div
                        className="flex items-center gap-2 text-xs font-semibold text-slate-500"
                        onClick={() => {
                          if (!searchActive) {
                            toggleSiteExpanded(siteKey);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSiteMenu({
                            clientId: client.id,
                            siteId: site.id,
                            siteName: site.name,
                            coords: site.coords,
                            supportContacts: (site as any).supportContacts,
                            siteSchedule: (site as any).siteSchedule,
                            x: e.clientX,
                            y: e.clientY
                          });
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSiteExpanded(siteKey);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          title={siteExpanded ? t({ it: 'Compatta sede', en: 'Collapse site' }) : t({ it: 'Espandi sede', en: 'Expand site' })}
                          aria-label={siteExpanded ? t({ it: 'Compatta sede', en: 'Collapse site' }) : t({ it: 'Espandi sede', en: 'Expand site' })}
                        >
                          {siteExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        <span className="truncate">{site.name}</span>
                      </div>
                      {siteExpanded ? (
                        <div className="space-y-1">
                          {[...site.floorPlans]
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                            .map((plan) => (
                              <SidebarPlanItem
                                key={plan.id}
                                {...{ plan, client, site, selectedPlanId, locationPathname, defaultPlanId, lockedPlans, user, dragRef, shouldPromptUnsavedPlanSwitch, requestSaveAndNavigate, setSelectedPlan, navigate, setPlanMenu, setLockMenu, reorderFloorPlans, t }}
                              />
                            ))}
                          {!site.floorPlans.length && (
                            <div className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                              {t({ it: 'Nessuna planimetria', en: 'No floor plans' })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
  );
};
