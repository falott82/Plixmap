import { BarChart3, Copy, Crop, Eye, EyeOff, History, Image as ImageIcon, MapPinned, Star, Trash } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { parseCoords } from './SidebarTree.helpers';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarPlanMenuProps = {
  planMenu: any;
  setPlanMenu: (value: null) => void;
  planMenuPhotoCount: number;
  planMenuSecurityVisible: boolean;
  defaultPlanId: any;
  clients: any[];
  user: any;
  openCapacityDashboard: (...args: any[]) => any;
  shouldPromptUnsavedPlanSwitch: (...args: any[]) => any;
  requestSaveAndNavigate?: (...args: any[]) => any;
  setSelectedPlan: (...args: any[]) => any;
  navigate: (...args: any[]) => any;
  toggleSecurityCardVisibilityForPlan: (...args: any[]) => any;
  updateMyProfile: (...args: any[]) => any;
  updateFloorPlan: (...args: any[]) => any;
  setClonePlan: (...args: any[]) => any;
  setConfirmDelete: (...args: any[]) => any;
  t: Translate;
};

/**
 * Floor-plan context menu (capacity dashboard, photo gallery, safety-card
 * visibility, favorite, time machine, print area, duplicate, delete).
 * Extracted from SidebarTree.tsx.
 */
export const SidebarPlanMenu = ({
  planMenu,
  setPlanMenu,
  planMenuPhotoCount,
  planMenuSecurityVisible,
  defaultPlanId,
  clients,
  user,
  openCapacityDashboard,
  shouldPromptUnsavedPlanSwitch,
  requestSaveAndNavigate,
  setSelectedPlan,
  navigate,
  toggleSecurityCardVisibilityForPlan,
  updateMyProfile,
  updateFloorPlan,
  setClonePlan,
  setConfirmDelete,
  t
}: SidebarPlanMenuProps) => {
  if (!planMenu) return null;
  return (
            <div
              className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
              style={{ top: planMenu.y, left: planMenu.x }}
            >
              <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
                {t({ it: 'Planimetria', en: 'Floor plan' })}
              </div>
              {parseCoords(planMenu.coords) ? (
                <a
                  href={`https://www.google.com/maps?q=${parseCoords(planMenu.coords)!.lat},${parseCoords(planMenu.coords)!.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <MapPinned size={14} className="text-emerald-700" />
                  {t({ it: 'Apri su Google Maps', en: 'View in Google Maps' })}
                </a>
              ) : null}
              <button
                onClick={() => {
                  openCapacityDashboard(planMenu.planId, { clientId: planMenu.clientId, siteId: planMenu.siteId });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri dashboard capienza', en: 'Open capacity dashboard' })}
              >
                <BarChart3 size={14} className="text-slate-600" />
                {t({ it: 'Dashboard capienza', en: 'Capacity dashboard' })}
              </button>
              {planMenuPhotoCount ? (
                <button
                  onClick={() => {
                    const to = `/plan/${planMenu.planId}?pg=1`;
                    setPlanMenu(null);
                    if (shouldPromptUnsavedPlanSwitch(planMenu.planId)) {
                      requestSaveAndNavigate?.(to);
                      return;
                    }
                    setSelectedPlan(planMenu.planId);
                    navigate(to);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <ImageIcon size={14} className="text-slate-600" />
                  {t({ it: 'Vedi galleria foto', en: 'View photo gallery' })}
                </button>
              ) : null}
              <button
                onClick={() => {
                  toggleSecurityCardVisibilityForPlan(planMenu.planId);
                  setPlanMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({
                  it: planMenuSecurityVisible ? 'Nascondi scheda sicurezza' : 'Mostra scheda sicurezza',
                  en: planMenuSecurityVisible ? 'Hide safety card' : 'Show safety card'
                })}
              >
                {planMenuSecurityVisible ? <EyeOff size={14} className="text-slate-600" /> : <Eye size={14} className="text-slate-600" />}
                {t({
                  it: planMenuSecurityVisible ? 'Nascondi scheda sicurezza' : 'Mostra scheda sicurezza',
                  en: planMenuSecurityVisible ? 'Hide safety card' : 'Show safety card'
                })}
              </button>
              <button
                onClick={async () => {
                  const next = defaultPlanId === planMenu.planId ? null : planMenu.planId;
                  try {
                    await updateMyProfile({ defaultPlanId: next });
                    useAuthStore.setState((s) =>
                      s.user
                        ? { user: { ...(s.user as any), defaultPlanId: next }, permissions: s.permissions, hydrated: s.hydrated }
                        : s
                    );
                  } finally {
                    setPlanMenu(null);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <Star size={14} className={defaultPlanId === planMenu.planId ? 'text-slate-400' : 'text-amber-500'} />
                {defaultPlanId === planMenu.planId
                  ? t({ it: 'Rimuovi preferita', en: 'Remove favorite' })
                  : t({ it: 'Preferita', en: 'Favorite' })}
              </button>
              <button
                onClick={() => {
                  const to = `/plan/${planMenu.planId}?tm=1`;
                  setPlanMenu(null);
                  if (shouldPromptUnsavedPlanSwitch(planMenu.planId)) {
                    requestSaveAndNavigate?.(to);
                    return;
                  }
                  setSelectedPlan(planMenu.planId);
                  navigate(to);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <History size={14} className="text-slate-600" />
                {t({ it: 'Time machine', en: 'Time machine' })}
              </button>
              <button
                onClick={() => {
                  const to = `/plan/${planMenu.planId}?pa=1`;
                  setPlanMenu(null);
                  if (shouldPromptUnsavedPlanSwitch(planMenu.planId)) {
                    requestSaveAndNavigate?.(to);
                    return;
                  }
                  setSelectedPlan(planMenu.planId);
                  navigate(to);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <Crop size={14} className="text-sky-700" />
                {t({ it: 'Imposta area di stampa', en: 'Set print area' })}
              </button>
              {(() => {
                const has = clients
                  .flatMap((c: any) => c.sites.flatMap((s: any) => s.floorPlans))
                  .find((p: any) => p.id === planMenu.planId)?.printArea;
                if (!has) return null;
                return (
                  <button
                    onClick={() => {
                      updateFloorPlan(planMenu.planId, { printArea: undefined });
                      setPlanMenu(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                  >
                    <Crop size={14} className="text-slate-500" />
                    {t({ it: 'Rimuovi area di stampa', en: 'Clear print area' })}
                  </button>
                );
              })()}
              {user?.isAdmin ? (
                <button
                  onClick={() => {
                    const label =
                      clients
                        .flatMap((c: any) => c.sites.flatMap((s: any) => s.floorPlans))
                        .find((p: any) => p.id === planMenu.planId)?.name || planMenu.planId;
                    setClonePlan({ planId: planMenu.planId, name: label });
                    setPlanMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <Copy size={14} className="text-slate-600" />
                  {t({ it: 'Duplica', en: 'Duplicate' })}
                </button>
              ) : null}
              {user?.isAdmin ? (
                <button
                  onClick={() => {
                    const label = clients
                      .flatMap((c: any) => c.sites.flatMap((s: any) => s.floorPlans))
                      .find((p: any) => p.id === planMenu.planId)?.name;
                    setConfirmDelete({ kind: 'plan', id: planMenu.planId, label: label || planMenu.planId });
                    setPlanMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-rose-700 hover:bg-rose-50"
                >
                  <Trash size={14} />
                  {t({ it: 'Elimina planimetria', en: 'Delete floor plan' })}
                </button>
              ) : null}
            </div>
  );
};
