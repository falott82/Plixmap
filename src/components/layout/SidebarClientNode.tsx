import { type MutableRefObject } from 'react';
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { SidebarSiteNode } from './SidebarSiteNode';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarClientNodeProps = {
  client: any;
  searchActive: boolean;
  expandedClients: Record<string, boolean | undefined>;
  expandedSites: Record<string, boolean | undefined>;
  orderedClients: any[];
  canChatClientIds: Set<string>;
  chatUnreadByClientId: any;
  setMissingPlansNotice: (...args: any[]) => any;
  toggleClientExpanded: (id: string) => void;
  toggleSiteExpanded: (key: string) => void;
  setClientMenu: (...args: any[]) => any;
  setSiteMenu: (...args: any[]) => any;
  clientDragRef: MutableRefObject<any>;
  updateMyProfile: (...args: any[]) => any;
  openClientChat: (...args: any[]) => any;
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
 * A client node in the sidebar tree: collapsible client header (logo, chat
 * badge, drag-reorder, context menu) and its list of site nodes. Extracted
 * from SidebarTree.tsx.
 */
export const SidebarClientNode = ({
  client,
  searchActive,
  expandedClients,
  expandedSites,
  orderedClients,
  canChatClientIds,
  chatUnreadByClientId,
  setMissingPlansNotice,
  toggleClientExpanded,
  toggleSiteExpanded,
  setClientMenu,
  setSiteMenu,
  clientDragRef,
  updateMyProfile,
  openClientChat,
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
}: SidebarClientNodeProps) => {
  const clientExpanded = searchActive || expandedClients[client.id] !== false;
  return (
          <div key={client.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div
              className="flex items-center gap-2 text-sm font-semibold text-ink"
              onClick={() => {
                const hasPlans = client.sites.some((site: any) => site.floorPlans.length > 0);
                if (!hasPlans) {
                  setMissingPlansNotice({ clientName: client.shortName || client.name });
                }
                if (!searchActive) {
                  toggleClientExpanded(client.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setClientMenu({ clientId: client.id, x: e.clientX, y: e.clientY });
              }}
              draggable
              onDragStart={() => {
                clientDragRef.current = client.id;
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={async () => {
                const movingId = clientDragRef.current;
                clientDragRef.current = null;
                if (!movingId || movingId === client.id) return;
                const current = orderedClients.map((c) => c.id);
                const from = current.indexOf(movingId);
                const to = current.indexOf(client.id);
                if (from === -1 || to === -1) return;
                const next = current.slice();
                next.splice(from, 1);
                next.splice(to, 0, movingId);
                try {
                  await updateMyProfile({ clientOrder: next });
                  useAuthStore.setState((s) =>
                    s.user
                      ? { user: { ...(s.user as any), clientOrder: next } as any, permissions: s.permissions, hydrated: s.hydrated }
                      : s
                  );
                } catch {
                  // ignore
                }
              }}
              title={t({ it: 'Tasto destro: info cliente', en: 'Right-click: client info' })}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleClientExpanded(client.id);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                title={clientExpanded ? t({ it: 'Compatta cliente', en: 'Collapse client' }) : t({ it: 'Espandi cliente', en: 'Expand client' })}
                aria-label={clientExpanded ? t({ it: 'Compatta cliente', en: 'Collapse client' }) : t({ it: 'Espandi cliente', en: 'Expand client' })}
              >
                {clientExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {client.logoUrl ? (
                <img
                  src={client.logoUrl}
                  alt=""
                  className="h-6 w-6 rounded-md border border-slate-200 bg-white object-cover"
                />
              ) : (
                <div className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-500">
                  {client.name.trim().slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{client.shortName || client.name}</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {canChatClientIds.has(client.id) ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openClientChat(client.id);
                    }}
                    className="relative flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title={t({ it: 'Chat cliente', en: 'Client chat' })}
                    aria-label={t({ it: 'Chat cliente', en: 'Client chat' })}
                  >
                    <MessageCircle size={14} />
                    {Number((chatUnreadByClientId as any)?.[client.id] || 0) > 0 ? (
                      <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">
                        {Number((chatUnreadByClientId as any)?.[client.id] || 0) > 99
                          ? '99+'
                          : String(Number((chatUnreadByClientId as any)?.[client.id] || 0))}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                {/*
                  Demo client indicator removed (requested): keep the UI clean and consistent.
                */}
              </div>
            </div>
            {clientExpanded
              ? client.sites.map((site: any) => (
                  <SidebarSiteNode
                    key={site.id}
                    {...{ site, client, searchActive, expandedSites, toggleSiteExpanded, setSiteMenu, selectedPlanId, locationPathname, defaultPlanId, lockedPlans, user, dragRef, shouldPromptUnsavedPlanSwitch, requestSaveAndNavigate, setSelectedPlan, navigate, setPlanMenu, setLockMenu, reorderFloorPlans, t }}
                  />
                ))
              : null}
          </div>
  );
};
