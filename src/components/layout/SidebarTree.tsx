import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, History, Info, Map, Star, Trash } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import FooterInfo from './FooterInfo';
import { shallow } from 'zustand/shallow';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import ClientInfoModal from './ClientInfoModal';
import ConfirmDialog from '../ui/ConfirmDialog';

type TreeClient = {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  sites: { id: string; name: string; floorPlans: { id: string; name: string; order?: number }[] }[];
};

const sameTree = (a: TreeClient[], b: TreeClient[]) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ac = a[i];
    const bc = b[i];
    if (ac.id !== bc.id) return false;
    if (ac.name !== bc.name) return false;
    if ((ac.shortName || '') !== (bc.shortName || '')) return false;
    if ((ac.logoUrl || '') !== (bc.logoUrl || '')) return false;
    if (ac.sites.length !== bc.sites.length) return false;
    for (let j = 0; j < ac.sites.length; j++) {
      const as = ac.sites[j];
      const bs = bc.sites[j];
      if (as.id !== bs.id) return false;
      if (as.name !== bs.name) return false;
      if (as.floorPlans.length !== bs.floorPlans.length) return false;
      for (let k = 0; k < as.floorPlans.length; k++) {
        const ap = as.floorPlans[k];
        const bp = bs.floorPlans[k];
        if (ap.id !== bp.id) return false;
        if (ap.name !== bp.name) return false;
        if ((ap.order ?? null) !== (bp.order ?? null)) return false;
      }
    }
  }
  return true;
};

const SidebarTree = () => {
  const clients = useDataStore(
    (s) =>
      s.clients.map((c) => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        logoUrl: c.logoUrl,
        sites: c.sites.map((site) => ({
          id: site.id,
          name: site.name,
          floorPlans: site.floorPlans.map((p) => ({ id: p.id, name: p.name, order: (p as any).order }))
        }))
      })),
    sameTree
  );
  const { deleteClient, deleteFloorPlan, reorderFloorPlans } = useDataStore(
    (s) => ({
      deleteClient: s.deleteClient,
      deleteFloorPlan: s.deleteFloorPlan,
      reorderFloorPlans: s.reorderFloorPlans
    }),
    shallow
  );
  const { selectedPlanId, setSelectedPlan, sidebarCollapsed, toggleSidebar } = useUIStore(
    (s) => ({
      selectedPlanId: s.selectedPlanId,
      setSelectedPlan: s.setSelectedPlan,
      sidebarCollapsed: s.sidebarCollapsed,
      toggleSidebar: s.toggleSidebar
    }),
    shallow
  );
  const { requestSaveAndNavigate, dirtyByPlan } = useUIStore(
    (s) => ({ requestSaveAndNavigate: s.requestSaveAndNavigate, dirtyByPlan: s.dirtyByPlan }),
    shallow
  );
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
  const [planMenu, setPlanMenu] = useState<{ planId: string; x: number; y: number } | null>(null);
  const [clientMenu, setClientMenu] = useState<{ clientId: string; x: number; y: number } | null>(null);
  const [clientInfoId, setClientInfoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'client' | 'plan'; id: string; label: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ siteId: string; planId: string } | null>(null);

  const fullClient = useDataStore(
    useMemo(
      () => (s: any) => (clientInfoId ? s.clients.find((c: any) => c.id === clientInfoId) : null),
      [clientInfoId]
    )
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) {
        setPlanMenu(null);
        setClientMenu(null);
        return;
      }
      if (!menuRef.current.contains(e.target as any)) {
        setPlanMenu(null);
        setClientMenu(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  if (sidebarCollapsed) {
    return (
      <aside className="flex h-screen w-14 flex-col items-center gap-4 border-r border-slate-200 bg-white py-4">
        <Link to="/" className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent text-white grid place-items-center text-sm shadow-card">
          D
        </Link>
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
  }

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-ink">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-accent text-white grid place-items-center text-sm shadow-card">
            D
          </span>
          Deskly
        </Link>
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
      <div className="px-4 pb-3 text-xs font-semibold uppercase text-slate-500">
        {t({ it: 'Cliente → Sede → Planimetria', en: 'Client → Site → Floor plan' })}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {clients.map((client) => (
          <div key={client.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div
              className="flex items-center gap-2 text-sm font-semibold text-ink"
              onContextMenu={(e) => {
                e.preventDefault();
                setClientMenu({ clientId: client.id, x: e.clientX, y: e.clientY });
              }}
              title={t({ it: 'Tasto destro: info cliente', en: 'Right-click: client info' })}
            >
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
              {client.shortName || client.name}
            </div>
            {client.sites.map((site) => (
              <div key={site.id} className="mt-3 space-y-2 rounded-lg bg-white p-2 shadow-inner">
                <div className="text-xs font-semibold text-slate-500">{site.name}</div>
                <div className="space-y-1">
                  {[...site.floorPlans]
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((plan) => {
                    const active = selectedPlanId === plan.id || location.pathname.includes(plan.id);
                    const isDefault = !!defaultPlanId && defaultPlanId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        onClick={() => {
                          if (selectedPlanId && selectedPlanId !== plan.id && dirtyByPlan[selectedPlanId]) {
                            requestSaveAndNavigate?.(`/plan/${plan.id}`);
                            return;
                          }
                          setSelectedPlan(plan.id);
                          navigate(`/plan/${plan.id}`);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPlanMenu({ planId: plan.id, x: e.clientX, y: e.clientY });
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
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-100 ${active ? 'bg-slate-200 font-semibold' : ''}`}
                      >
                        <Map size={16} className="text-primary" />
                        <span className="truncate">{plan.name}</span>
                        {isDefault ? <Star size={14} className="text-amber-500" /> : null}
                        <ChevronRight size={14} className="ml-auto text-slate-400" />
                      </button>
                    );
                  })}
                  {!site.floorPlans.length && (
                    <div className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                      {t({ it: 'Nessuna planimetria', en: 'No floor plans' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <FooterInfo />

      {(planMenu || clientMenu) ? (
        <div ref={menuRef} className="fixed z-50">
          {planMenu ? (
            <div
              className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
              style={{ top: planMenu.y, left: planMenu.x }}
            >
              <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
                {t({ it: 'Planimetria', en: 'Floor plan' })}
              </div>
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
                  ? t({ it: 'Rimuovi planimetria predefinita', en: 'Clear default floor plan' })
                  : t({ it: 'Rendi planimetria predefinita', en: 'Set as default floor plan' })}
              </button>
              <button
                onClick={() => {
                  const to = `/plan/${planMenu.planId}?tm=1`;
                  setPlanMenu(null);
                  if (selectedPlanId && selectedPlanId !== planMenu.planId && dirtyByPlan[selectedPlanId]) {
                    requestSaveAndNavigate?.(to);
                    return;
                  }
                  setSelectedPlan(planMenu.planId);
                  navigate(to);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <History size={14} className="text-slate-600" />
                {t({ it: 'Time machine…', en: 'Time machine…' })}
              </button>
              {user?.isAdmin ? (
                <button
                  onClick={() => {
                    const label = clients
                      .flatMap((c) => c.sites.flatMap((s) => s.floorPlans))
                      .find((p) => p.id === planMenu.planId)?.name;
                    setConfirmDelete({ kind: 'plan', id: planMenu.planId, label: label || planMenu.planId });
                    setPlanMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-rose-700 hover:bg-rose-50"
                >
                  <Trash size={14} />
                  {t({ it: 'Elimina planimetria…', en: 'Delete floor plan…' })}
                </button>
              ) : null}
            </div>
          ) : null}

          {clientMenu ? (
            <div
              className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
              style={{ top: clientMenu.y, left: clientMenu.x }}
            >
              <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
                {t({ it: 'Cliente', en: 'Client' })}
              </div>
              <button
                onClick={() => {
                  setClientInfoId(clientMenu.clientId);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <Info size={14} className="text-slate-500" />
                {t({ it: 'Info cliente', en: 'Client info' })}
              </button>
              {user?.isAdmin ? (
                <button
                  onClick={() => {
                    const label = clients.find((c) => c.id === clientMenu.clientId)?.name || clientMenu.clientId;
                    setConfirmDelete({ kind: 'client', id: clientMenu.clientId, label });
                    setClientMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-rose-700 hover:bg-rose-50"
                >
                  <Trash size={14} />
                  {t({ it: 'Elimina cliente…', en: 'Delete client…' })}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ClientInfoModal open={!!clientInfoId} client={fullClient || undefined} onClose={() => setClientInfoId(null)} />

      <ConfirmDialog
        open={!!confirmDelete}
        title={t({ it: 'Conferma eliminazione', en: 'Confirm deletion' })}
        description={
          confirmDelete
            ? t({
                it: `Vuoi eliminare "${confirmDelete.label}"? Questa azione è irreversibile.`,
                en: `Delete "${confirmDelete.label}"? This action cannot be undone.`
              })
            : undefined
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          if (confirmDelete.kind === 'client') deleteClient(confirmDelete.id);
          if (confirmDelete.kind === 'plan') deleteFloorPlan(confirmDelete.id);
          setConfirmDelete(null);
          navigate('/', { replace: true });
          // if current default plan was deleted, clear it
          if (confirmDelete.kind === 'plan' && defaultPlanId === confirmDelete.id) {
            try {
              await updateMyProfile({ defaultPlanId: null });
              useAuthStore.setState((s) =>
                s.user ? { user: { ...(s.user as any), defaultPlanId: null }, permissions: s.permissions, hydrated: s.hydrated } : s
              );
            } catch {}
          }
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />
    </aside>
  );
};

export default SidebarTree;
