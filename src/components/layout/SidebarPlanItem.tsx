import { type MutableRefObject } from 'react';
import { ChevronRight, Crop, Hourglass, Map as MapIcon, Star } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { formatMinutes } from './SidebarTree.helpers';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarPlanItemProps = {
  plan: any;
  client: any;
  site: any;
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
 * A single floor-plan row in the sidebar tree (selection, context menu,
 * drag-reorder, lock badge, default/print-area indicators). Extracted from
 * SidebarTree.tsx.
 */
export const SidebarPlanItem = ({
  plan,
  client,
  site,
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
}: SidebarPlanItemProps) => {
  const active = selectedPlanId === plan.id || locationPathname.includes(plan.id);
  const isDefault = !!defaultPlanId && defaultPlanId === plan.id;
  const hasPrintArea = !!plan.printArea;
  const lockInfo = (lockedPlans as any)?.[plan.id];
  const lockKind = String((lockInfo as any)?.kind || 'lock');
  const isGrant = lockKind === 'grant';
  const remainingMinutes = (() => {
    if (!isGrant) return null;
    const exp = Number((lockInfo as any)?.expiresAt || 0);
    if (!Number.isFinite(exp) || exp <= 0) return null;
    const ms = exp - Date.now();
    if (ms <= 0) return 0;
    // Round to nearest 0.5 minute.
    return Math.round((ms / 60_000) * 2) / 2;
  })();
  return (
                                <button
                                  key={plan.id}
                                  onClick={() => {
                                    if (shouldPromptUnsavedPlanSwitch(plan.id)) {
                                      requestSaveAndNavigate?.(`/plan/${plan.id}`);
                                      return;
                                    }
                                    setSelectedPlan(plan.id);
                                    navigate(`/plan/${plan.id}`);
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPlanMenu({
                                      planId: plan.id,
                                      clientId: client.id,
                                      siteId: site.id,
                                      coords: site.coords,
                                      x: e.clientX,
                                      y: e.clientY
                                    });
                                  }}
                                  draggable={!!user?.isAdmin}
                                  onDragStart={() => {
                                    dragRef.current = { siteId: site.id, planId: plan.id };
                                  }}
                                  onDragOver={(e) => {
                                    if (!user?.isAdmin) return;
                                    e.preventDefault();
                                  }}
                                  onDrop={(e) => {
                                    if (!user?.isAdmin) return;
                                    e.preventDefault();
                                    const drag = dragRef.current;
                                    dragRef.current = null;
                                    if (!drag || drag.siteId !== site.id) return;
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const before = e.clientY < rect.top + rect.height / 2;
                                    reorderFloorPlans(site.id, drag.planId, plan.id, before);
                                  }}
                                  className={`group relative flex w-full items-center gap-2 rounded-lg pr-2 py-2 text-left text-sm transition ${
                                    active
                                      ? "bg-white font-semibold text-ink shadow-sm ring-1 ring-primary/15 before:content-[''] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r-full before:bg-primary pl-3"
                                      : 'text-slate-700 hover:bg-white/70 pl-2'
                                  }`}
                                >
                                  <MapIcon size={16} className={active ? 'text-primary' : 'text-slate-500 group-hover:text-primary'} />
                                  <span className="truncate">{plan.name}</span>
                                  {lockInfo ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      setLockMenu({
                                          kind: isGrant ? 'grant' : 'lock',
                                          planId: plan.id,
                                          planName: plan.name,
                                          clientName: client.shortName || client.name,
                                          siteName: site.name,
                                          userId: lockInfo.userId,
                                          username: lockInfo.username,
                                          avatarUrl: (lockInfo as any).avatarUrl,
                                          grantedAt: (lockInfo as any)?.grantedAt ?? null,
                                          expiresAt: (lockInfo as any)?.expiresAt ?? null,
                                          minutes: (lockInfo as any)?.minutes ?? null,
                                          lastActionAt: (lockInfo as any)?.lastActionAt ?? null,
                                          lastSavedAt: (lockInfo as any)?.lastSavedAt ?? null,
                                          lastSavedRev: (lockInfo as any)?.lastSavedRev ?? null,
                                          x: e.clientX,
                                          y: e.clientY
                                        });
                                      }}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                      title={t({
                                        it: isGrant
                                          ? `Richiesta di lock concessa a ${lockInfo.username || 'utente'} e valida per i prossimi ${formatMinutes(remainingMinutes ?? (lockInfo as any)?.minutes ?? null)} minuti`
                                          : `Lock attivo: ${lockInfo.username || 'utente'}`,
                                        en: isGrant
                                          ? `Lock granted to ${lockInfo.username || 'user'} for the next ${formatMinutes(remainingMinutes ?? (lockInfo as any)?.minutes ?? null)} minutes`
                                          : `Lock active: ${lockInfo.username || 'user'}`
                                      })}
                                    >
                                      {isGrant ? (
                                        <Hourglass size={16} />
                                      ) : (
                                        <UserAvatar src={(lockInfo as any).avatarUrl} username={lockInfo.username} size={18} className="border-amber-200" />
                                      )}
                                    </button>
                                  ) : null}
                                  {isDefault ? (
                                    <span
                                      title={t({
                                        it: 'Planimetria predefinita: all’avvio Plixmap caricherà automaticamente questa planimetria.',
                                        en: 'Default floor plan: on startup, Plixmap will automatically load this floor plan.'
                                      })}
                                    >
                                      <Star size={14} className="text-amber-500" />
                                    </span>
                                  ) : null}
                                  <span
                                    className={`ml-auto flex h-7 w-7 items-center justify-center rounded-lg border ${
                                      hasPrintArea ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-400'
                                    }`}
                                    title={hasPrintArea ? t({ it: 'Area di stampa impostata', en: 'Print area set' }) : t({ it: 'Area di stampa automatica', en: 'Auto print area' })}
                                  >
                                    <Crop size={14} />
                                  </span>
                                  <ChevronRight size={14} className={active ? 'text-primary/70' : 'text-slate-400'} />
                                </button>
  );
};
