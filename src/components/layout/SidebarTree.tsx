import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Crop, FileText, History, Info, Map as MapIcon, MapPinned, Paperclip, Search, Star, Trash } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import FooterInfo from './FooterInfo';
import { shallow } from 'zustand/shallow';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import ClientInfoModal from './ClientInfoModal';
import ClientAttachmentsModal from './ClientAttachmentsModal';
import ClientNotesModal from './ClientNotesModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import CloneFloorPlanModal from './CloneFloorPlanModal';
import { useToastStore } from '../../store/useToast';
import { SEED_CLIENT_ID } from '../../store/data';

type TreeClient = {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  sites: { id: string; name: string; coords?: string; floorPlans: { id: string; name: string; order?: number; printArea?: any }[] }[];
};

const parseCoords = (value: string | undefined): { lat: number; lng: number } | null => {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
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
      if ((as.coords || '') !== (bs.coords || '')) return false;
      if (as.floorPlans.length !== bs.floorPlans.length) return false;
      for (let k = 0; k < as.floorPlans.length; k++) {
        const ap = as.floorPlans[k];
        const bp = bs.floorPlans[k];
        if (ap.id !== bp.id) return false;
        if (ap.name !== bp.name) return false;
        if ((ap.order ?? null) !== (bp.order ?? null)) return false;
        const apPA = ap.printArea ? JSON.stringify(ap.printArea) : '';
        const bpPA = bp.printArea ? JSON.stringify(bp.printArea) : '';
        if (apPA !== bpPA) return false;
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
          coords: (site as any).coords,
          floorPlans: site.floorPlans.map((p) => ({ id: p.id, name: p.name, order: (p as any).order, printArea: (p as any).printArea }))
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
  const updateFloorPlan = useDataStore((s) => s.updateFloorPlan);
  const cloneFloorPlan = useDataStore((s) => (s as any).cloneFloorPlan);
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
  const { push } = useToastStore();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, permissions } = useAuthStore();
  const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
  const clientOrder = (((user as any)?.clientOrder || []) as string[]).filter((x) => typeof x === 'string');
  const [treeQuery, setTreeQuery] = useState('');
  const [planMenu, setPlanMenu] = useState<{ planId: string; coords?: string; x: number; y: number } | null>(null);
  const [clientMenu, setClientMenu] = useState<{ clientId: string; x: number; y: number } | null>(null);
  const [siteMenu, setSiteMenu] = useState<{ siteName: string; coords?: string; x: number; y: number } | null>(null);
  const [clientInfoId, setClientInfoId] = useState<string | null>(null);
  const [clientNotesId, setClientNotesId] = useState<string | null>(null);
  const [clientAttachmentsId, setClientAttachmentsId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'client' | 'plan'; id: string; label: string } | null>(null);
  const [missingPlansNotice, setMissingPlansNotice] = useState<{ clientName: string } | null>(null);
  const [clonePlan, setClonePlan] = useState<{ planId: string; name: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ siteId: string; planId: string } | null>(null);
  const clientDragRef = useRef<string | null>(null);

  const fullClient = useDataStore(
    useMemo(
      () => (s: any) => (clientInfoId ? s.clients.find((c: any) => c.id === clientInfoId) : null),
      [clientInfoId]
    )
  );
  const notesClient = useDataStore(
    useMemo(
      () => (s: any) => (clientNotesId ? s.clients.find((c: any) => c.id === clientNotesId) : null),
      [clientNotesId]
    )
  );
  const attachmentsClient = useDataStore(
    useMemo(
      () => (s: any) => (clientAttachmentsId ? s.clients.find((c: any) => c.id === clientAttachmentsId) : null),
      [clientAttachmentsId]
    )
  );
  const updateClient = useDataStore((s: any) => s.updateClient);

  const canEditClientNotes = useMemo(() => {
    if (!clientNotesId) return false;
    if (user?.isAdmin) return true;
    const p = (permissions || []).find((x: any) => x.scopeType === 'client' && x.scopeId === clientNotesId);
    return p?.access === 'rw';
  }, [clientNotesId, permissions, user?.isAdmin]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) {
        setPlanMenu(null);
        setClientMenu(null);
        setSiteMenu(null);
        return;
      }
      if (!menuRef.current.contains(e.target as any)) {
        setPlanMenu(null);
        setClientMenu(null);
        setSiteMenu(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const orderedClients = useMemo(() => {
    if (!clientOrder.length) return clients;
    const byId = new Map<string, TreeClient>(clients.map((c) => [c.id, c]));
    const out: TreeClient[] = [];
    for (const id of clientOrder) {
      const c = byId.get(id);
      if (c) out.push(c);
    }
    for (const c of clients) {
      if (!clientOrder.includes(c.id)) out.push(c);
    }
    return out;
  }, [clientOrder, clients]);

  const filteredClients = useMemo(() => {
    const q = treeQuery.trim().toLowerCase();
    if (!q) return orderedClients;
    const matchesText = (s: string | undefined) => String(s || '').toLowerCase().includes(q);
    return orderedClients
      .map((client) => {
        const clientMatch = matchesText(client.name) || matchesText(client.shortName);
        if (clientMatch) return client;
        const nextSites = client.sites
          .map((site): TreeClient['sites'][number] | null => {
            const siteMatch = matchesText(site.name);
            if (siteMatch) return site;
            const nextPlans = site.floorPlans.filter((p) => matchesText(p.name));
            if (!nextPlans.length) return null;
            return { ...site, floorPlans: nextPlans };
          })
          .filter((s): s is TreeClient['sites'][number] => !!s);
        if (!nextSites.length) return null;
        return { ...client, sites: nextSites };
      })
      .filter((c): c is TreeClient => !!c);
  }, [orderedClients, treeQuery]);

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
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={treeQuery}
            onChange={(e) => setTreeQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setTreeQuery('');
            }}
            placeholder={t({ it: 'Cerca cliente/sede/planimetria…', en: 'Search client/site/floor plan…' })}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
          />
        </div>
      </div>
      <div className="px-4 pb-3 text-xs font-semibold uppercase text-slate-500">
        {t({ it: 'Cliente → Sede → Planimetria', en: 'Client → Site → Floor plan' })}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {filteredClients.map((client) => (
          <div key={client.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div
              className="flex items-center gap-2 text-sm font-semibold text-ink"
              onClick={() => {
                const hasPlans = client.sites.some((site) => site.floorPlans.length > 0);
                if (!hasPlans) {
                  setMissingPlansNotice({ clientName: client.shortName || client.name });
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
              <div className="flex items-center gap-2">
                <span className="truncate">{client.shortName || client.name}</span>
                {client.id === SEED_CLIENT_ID ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      push(
                        t({
                          it: 'Questo è un cliente dimostrativo. Puoi eliminarlo oppure usarlo come prova.',
                          en: 'This is a demo client. You can delete it or use it for testing.'
                        }),
                        'info'
                      );
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
                    title={t({ it: 'Cliente di prova', en: 'Demo client' })}
                  >
                    ?
                  </button>
                ) : null}
              </div>
            </div>
            {client.sites.map((site) => (
              <div key={site.id} className="mt-3 space-y-2 rounded-lg bg-white p-2 shadow-inner">
                <div
                  className="text-xs font-semibold text-slate-500"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSiteMenu({ siteName: site.name, coords: site.coords, x: e.clientX, y: e.clientY });
                  }}
                >
                  {site.name}
                </div>
                <div className="space-y-1">
                  {[...site.floorPlans]
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((plan) => {
                    const active = selectedPlanId === plan.id || location.pathname.includes(plan.id);
                    const isDefault = !!defaultPlanId && defaultPlanId === plan.id;
                    const hasPrintArea = !!plan.printArea;
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
                          setPlanMenu({ planId: plan.id, coords: site.coords, x: e.clientX, y: e.clientY });
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
                        <MapIcon size={16} className="text-primary" />
                        <span className="truncate">{plan.name}</span>
                        {isDefault ? (
                          <span
                            title={t({
                              it: 'Planimetria predefinita: all’avvio Deskly caricherà automaticamente questa planimetria.',
                              en: 'Default floor plan: on startup, Deskly will automatically load this floor plan.'
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
                        <ChevronRight size={14} className="text-slate-400" />
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

      {(planMenu || clientMenu || siteMenu) ? (
        <div ref={menuRef} className="fixed z-50">
          {planMenu ? (
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
                {t({ it: 'Time machine', en: 'Time machine' })}
              </button>
              <button
                onClick={() => {
                  const to = `/plan/${planMenu.planId}?pa=1`;
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
                <Crop size={14} className="text-sky-700" />
                {t({ it: 'Imposta area di stampa', en: 'Set print area' })}
              </button>
              {(() => {
                const has = clients
                  .flatMap((c) => c.sites.flatMap((s) => s.floorPlans))
                  .find((p) => p.id === planMenu.planId)?.printArea;
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
                        .flatMap((c) => c.sites.flatMap((s) => s.floorPlans))
                        .find((p) => p.id === planMenu.planId)?.name || planMenu.planId;
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
                      .flatMap((c) => c.sites.flatMap((s) => s.floorPlans))
                      .find((p) => p.id === planMenu.planId)?.name;
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
              <button
                onClick={() => {
                  setClientAttachmentsId(clientMenu.clientId);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri l’elenco allegati PDF del cliente', en: 'Open the client PDF attachments list' })}
              >
                <Paperclip size={14} className="text-slate-500" />
                {t({ it: 'Allegati', en: 'Attachments' })}
              </button>
              <button
                onClick={() => {
                  setClientNotesId(clientMenu.clientId);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Aggiungi note formattate per questo cliente', en: 'Add formatted notes for this client' })}
              >
                <FileText size={14} className="text-slate-500" />
                {t({ it: 'Note cliente', en: 'Client notes' })}
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
                  {t({ it: 'Elimina cliente', en: 'Delete client' })}
                </button>
              ) : null}
            </div>
          ) : null}

          {siteMenu ? (
            <div
              className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
              style={{ top: siteMenu.y, left: siteMenu.x }}
            >
              <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
                {t({ it: 'Sede', en: 'Site' })}
              </div>
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
          ) : null}
        </div>
      ) : null}

      <ClientInfoModal open={!!clientInfoId} client={fullClient || undefined} onClose={() => setClientInfoId(null)} />
      <ClientAttachmentsModal open={!!clientAttachmentsId} client={attachmentsClient || undefined} onClose={() => setClientAttachmentsId(null)} />
      <ClientNotesModal
        open={!!clientNotesId}
        client={notesClient || undefined}
        readOnly={!canEditClientNotes}
        onClose={() => setClientNotesId(null)}
        onSave={(payload) => {
          if (!clientNotesId) return;
          updateClient(clientNotesId, payload);
        }}
      />

      <CloneFloorPlanModal
        open={!!clonePlan}
        sourceName={clonePlan?.name || ''}
        onClose={() => setClonePlan(null)}
        onConfirm={({ name, includeLayers, includeViews, includeRooms, includeObjects }) => {
          if (!clonePlan) return;
          const newId = cloneFloorPlan?.(clonePlan.planId, { name, includeLayers, includeViews, includeRooms, includeObjects });
          setClonePlan(null);
          if (newId) navigate(`/plan/${newId}`);
        }}
      />

      <ConfirmDialog
        open={!!missingPlansNotice}
        title={t({ it: 'Planimetrie mancanti', en: 'Missing floor plans' })}
        description={t({
          it: 'Occorre andare su impostazioni e definire sites e planimetrie prima di poter modificare il cliente.',
          en: 'You need to go to settings and define sites and floor plans before you can edit this client.'
        })}
        onCancel={() => setMissingPlansNotice(null)}
        onConfirm={() => {
          setMissingPlansNotice(null);
          navigate('/settings?tab=data');
        }}
        confirmLabel={t({ it: 'Vai alle impostazioni', en: 'Go to settings' })}
        cancelLabel={t({ it: 'Chiudi', en: 'Close' })}
      />

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
