import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Copy, Crop, FileText, History, Hourglass, Image as ImageIcon, Info, Map as MapIcon, MapPinned, MessageCircle, Network, Paperclip, Search, Star, Trash, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import UserAvatar from '../ui/UserAvatar';
import FooterInfo from './FooterInfo';
import { shallow } from 'zustand/shallow';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import ClientInfoModal from './ClientInfoModal';
import ClientAttachmentsModal from './ClientAttachmentsModal';
import ClientNotesModal from './ClientNotesModal';
import ClientIpMapModal from './ClientIpMapModal';
import ClientDirectoryModal from './ClientDirectoryModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import CloneFloorPlanModal from './CloneFloorPlanModal';
import { fetchImportSummary, ImportSummaryRow } from '../../api/customImport';

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

const formatTs = (value?: number | null): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const formatMinutes = (value?: number | null): string => {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  // Keep 0.5 steps readable.
  return n % 1 === 0 ? String(n) : n.toFixed(1);
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
  const {
    selectedPlanId,
    setSelectedPlan,
    sidebarCollapsed,
    toggleSidebar,
    expandedClients,
    expandedSites,
    setExpandedClients,
    setExpandedSites,
    toggleClientExpanded,
    toggleSiteExpanded,
    lockedPlans,
    openClientChat,
    chatUnreadByClientId
  } = useUIStore(
    (s) => ({
      selectedPlanId: s.selectedPlanId,
      setSelectedPlan: s.setSelectedPlan,
      sidebarCollapsed: s.sidebarCollapsed,
      toggleSidebar: s.toggleSidebar,
      expandedClients: s.expandedClients,
      expandedSites: s.expandedSites,
      setExpandedClients: s.setExpandedClients,
      setExpandedSites: s.setExpandedSites,
      toggleClientExpanded: s.toggleClientExpanded,
      toggleSiteExpanded: s.toggleSiteExpanded,
      lockedPlans: (s as any).lockedPlans || {},
      openClientChat: (s as any).openClientChat,
      chatUnreadByClientId: (s as any).chatUnreadByClientId || {}
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
  const { user, permissions } = useAuthStore();
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
  const clientOrder = (((user as any)?.clientOrder || []) as string[]).filter((x) => typeof x === 'string');
  const [treeQuery, setTreeQuery] = useState('');
  const [planMenu, setPlanMenu] = useState<{ planId: string; coords?: string; x: number; y: number } | null>(null);
  const [clientMenu, setClientMenu] = useState<{ clientId: string; x: number; y: number } | null>(null);
  const [siteMenu, setSiteMenu] = useState<{ siteName: string; coords?: string; x: number; y: number } | null>(null);
  const [clientInfoId, setClientInfoId] = useState<string | null>(null);
  const [clientNotesId, setClientNotesId] = useState<string | null>(null);
  const [clientAttachmentsId, setClientAttachmentsId] = useState<string | null>(null);
  const [clientIpMapId, setClientIpMapId] = useState<string | null>(null);
  const [clientDirectoryId, setClientDirectoryId] = useState<string | null>(null);
  const [importSummaryByClient, setImportSummaryByClient] = useState<Record<string, ImportSummaryRow>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'client' | 'plan'; id: string; label: string } | null>(null);
  const [missingPlansNotice, setMissingPlansNotice] = useState<{ clientName: string } | null>(null);
  const [clonePlan, setClonePlan] = useState<{ planId: string; name: string } | null>(null);
		  const [lockMenu, setLockMenu] = useState<{
		    kind?: 'lock' | 'grant';
		    planId: string;
		    planName: string;
		    clientName: string;
		    siteName: string;
		    userId: string;
		    username: string;
		    avatarUrl?: string;
		    grantedAt?: number | null;
		    expiresAt?: number | null;
		    minutes?: number | null;
		    lastActionAt?: number | null;
		    lastSavedAt?: number | null;
		    lastSavedRev?: string | null;
		    x: number;
		    y: number;
		  } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lockMenuRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ siteId: string; planId: string } | null>(null);
  const clientDragRef = useRef<string | null>(null);

  const canChatClientIds = useMemo(() => {
    const out = new Set<string>();
    if (user?.isAdmin || user?.isSuperAdmin) {
      for (const c of clients || []) out.add(c.id);
      return out;
    }
    const siteToClient = new Map<string, string>();
    const planToClient = new Map<string, string>();
    for (const c of clients || []) {
      for (const s of c.sites || []) {
        siteToClient.set(s.id, c.id);
        for (const p of s.floorPlans || []) planToClient.set(p.id, c.id);
      }
    }
    for (const p of permissions || []) {
      if (!p?.chat) continue;
      if (p.scopeType === 'client') out.add(p.scopeId);
      if (p.scopeType === 'site') {
        const clientId = siteToClient.get(p.scopeId);
        if (clientId) out.add(clientId);
      }
      if (p.scopeType === 'plan') {
        const clientId = planToClient.get(p.scopeId);
        if (clientId) out.add(clientId);
      }
    }
    return out;
  }, [clients, permissions, user?.isAdmin]);

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
  const ipMapClient = useDataStore(
    useMemo(
      () => (s: any) => (clientIpMapId ? s.clients.find((c: any) => c.id === clientIpMapId) : null),
      [clientIpMapId]
    )
  );
  const directoryClient = useDataStore(
    useMemo(
      () => (s: any) => (clientDirectoryId ? s.clients.find((c: any) => c.id === clientDirectoryId) : null),
      [clientDirectoryId]
    )
  );
  const updateClient = useDataStore((s: any) => s.updateClient);
  const planPhotoCountById = useDataStore(
    useMemo(
      () => (s: any) => {
        const out: Record<string, number> = {};
        for (const client of s.clients || []) {
          for (const site of client.sites || []) {
            for (const plan of site.floorPlans || []) {
              const count = (plan.objects || []).filter((o: any) => o?.type === 'photo').length;
              if (count) out[plan.id] = count;
            }
          }
        }
        return out;
      },
      []
    )
  );
  const planMenuPhotoCount = planMenu ? planPhotoCountById[planMenu.planId] || 0 : 0;

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

  useEffect(() => {
    if (!lockMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!lockMenuRef.current) return;
      if (!lockMenuRef.current.contains(e.target as any)) setLockMenu(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [lockMenu]);

  useEffect(() => {
    let active = true;
    fetchImportSummary()
      .then((res) => {
        if (!active) return;
        const next: Record<string, ImportSummaryRow> = {};
        for (const row of res.rows || []) {
          next[row.clientId] = row;
        }
        setImportSummaryByClient(next);
      })
      .catch(() => {
        if (!active) return;
        setImportSummaryByClient({});
      });
    return () => {
      active = false;
    };
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

  const searchActive = !!treeQuery.trim();

  const handleCollapseAll = () => {
    const nextClients: Record<string, boolean> = {};
    const nextSites: Record<string, boolean> = {};
    for (const client of orderedClients) {
      nextClients[client.id] = false;
      for (const site of client.sites) {
        nextSites[`${client.id}:${site.id}`] = false;
      }
    }
    setExpandedClients(nextClients);
    setExpandedSites(nextSites);
  };

  const handleExpandAll = () => {
    setExpandedClients({});
    setExpandedSites({});
  };

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
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={handleCollapseAll}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          title={t({ it: 'Compatta tutti i clienti e le sedi', en: 'Collapse all clients and sites' })}
        >
          <ChevronsUp size={14} />
        </button>
        <button
          onClick={handleExpandAll}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          title={t({ it: 'Espandi tutti i clienti e le sedi', en: 'Expand all clients and sites' })}
        >
          <ChevronsDown size={14} />
        </button>
        <div className="min-w-0 truncate text-xs font-semibold uppercase text-slate-500">
          {t({ it: 'Cliente → Sede → Planimetria', en: 'Client → Site → Floor plan' })}
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {filteredClients.map((client) => {
          const clientExpanded = searchActive || expandedClients[client.id] !== false;
          return (
          <div key={client.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div
              className="flex items-center gap-2 text-sm font-semibold text-ink"
              onClick={() => {
                const hasPlans = client.sites.some((site) => site.floorPlans.length > 0);
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
              ? client.sites.map((site) => {
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
                          setSiteMenu({ siteName: site.name, coords: site.coords, x: e.clientX, y: e.clientY });
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
                            .map((plan) => {
                              const active = selectedPlanId === plan.id || location.pathname.includes(plan.id);
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
                                  <ChevronRight size={14} className={active ? 'text-primary/70' : 'text-slate-400'} />
                                </button>
                              );
                            })}
                          {!site.floorPlans.length && (
                            <div className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                              {t({ it: 'Nessuna planimetria', en: 'No floor plans' })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
          );
        })}
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
              {planMenuPhotoCount ? (
                <button
                  onClick={() => {
                    const to = `/plan/${planMenu.planId}?pg=1`;
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
                  <ImageIcon size={14} className="text-slate-600" />
                  {t({ it: 'Vedi galleria foto', en: 'View photo gallery' })}
                </button>
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
              {canChatClientIds.has(clientMenu.clientId) ? (
                <button
                  onClick={() => {
                    openClientChat(clientMenu.clientId);
                    setClientMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <MessageCircle size={14} className="text-slate-500" />
                  {t({ it: 'Chat', en: 'Chat' })}
                  {Number((chatUnreadByClientId as any)?.[clientMenu.clientId] || 0) > 0 ? (
                    <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                      {Number((chatUnreadByClientId as any)?.[clientMenu.clientId] || 0) > 99
                        ? '99+'
                        : String(Number((chatUnreadByClientId as any)?.[clientMenu.clientId] || 0))}
                    </span>
                  ) : null}
                </button>
              ) : null}
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
                  setClientIpMapId(clientMenu.clientId);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri la mappa IP del cliente', en: 'Open the client IP map' })}
              >
                <Network size={14} className="text-slate-500" />
                {t({ it: 'IP Map', en: 'IP Map' })}
              </button>
              {importSummaryByClient[clientMenu.clientId]?.lastImportAt ? (
                <button
                  onClick={() => {
                    setClientDirectoryId(clientMenu.clientId);
                    setClientMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                  title={t({ it: 'Apri la rubrica utenti importati', en: 'Open the imported users directory' })}
                >
                  <Users size={14} className="text-slate-500" />
                  {t({ it: 'Rubrica utenti', en: 'User directory' })}
                </button>
              ) : null}
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

	      {lockMenu ? (
	        <div
	          ref={lockMenuRef}
	          className="fixed z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
	          style={{ top: lockMenu.y, left: lockMenu.x }}
	        >
	          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
	            <span className="font-semibold text-ink">{t({ it: 'Lock planimetria', en: 'Floor plan lock' })}</span>
            <button
              onClick={() => setLockMenu(null)}
              className="text-slate-400 hover:text-ink"
              title={t({ it: 'Chiudi', en: 'Close' })}
            >
              <X size={14} />
            </button>
	          </div>
	          <div className="px-2 pt-2 text-sm font-semibold text-ink">{lockMenu.planName}</div>
	          <div className="px-2 text-xs text-slate-500">{lockMenu.clientName} / {lockMenu.siteName}</div>
	          <div className="mt-2 flex items-center gap-2 px-2 text-xs text-slate-600">
	            {lockMenu.kind === 'grant' ? (
	              <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700">
	                <Hourglass size={14} />
	              </span>
	            ) : (
	              <UserAvatar src={lockMenu.avatarUrl} username={lockMenu.username} size={18} />
	            )}
	            <span>
	              {lockMenu.kind === 'grant'
	                ? t({ it: 'Lock concesso a', en: 'Lock granted to' })
	                : t({ it: 'Bloccato da', en: 'Locked by' })}
	              : {lockMenu.username || 'user'}
	            </span>
	          </div>

	          <div className="mt-3 space-y-1 px-2 text-[11px] text-slate-600">
	            <div>
	              <span className="font-semibold text-slate-700">{t({ it: 'Ultima azione', en: 'Last action' })}</span>: {formatTs(lockMenu.lastActionAt)}
	            </div>
	            <div>
	              <span className="font-semibold text-slate-700">{t({ it: 'Ultimo salvataggio', en: 'Last save' })}</span>: {formatTs(lockMenu.lastSavedAt)}
	            </div>
	            <div>
	              <span className="font-semibold text-slate-700">{t({ it: 'Revisione', en: 'Revision' })}</span>: {String(lockMenu.lastSavedRev || '').trim() || '—'}
	            </div>
	            {lockMenu.kind === 'grant' ? (
	              <div>
	                <span className="font-semibold text-slate-700">{t({ it: 'Valida per', en: 'Valid for' })}</span>: {formatMinutes(lockMenu.minutes)} {t({ it: 'minuti', en: 'minutes' })}
	              </div>
	            ) : null}
	          </div>

	          {lockMenu.kind !== 'grant' && lockMenu.userId && lockMenu.userId !== String(user?.id || '') ? (
	            <button
	              onClick={() => {
	                window.dispatchEvent(
	                  new CustomEvent('deskly_unlock_request', {
	                    detail: {
	                      planId: lockMenu.planId,
	                      planName: lockMenu.planName,
	                      clientName: lockMenu.clientName,
	                      siteName: lockMenu.siteName,
	                      userId: lockMenu.userId,
	                      username: lockMenu.username,
	                      avatarUrl: lockMenu.avatarUrl || ''
	                    }
	                  })
	                );
	                setLockMenu(null);
	              }}
	              className="mt-3 flex w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
	              title={t({ it: 'Chiedi unlock', en: 'Request unlock' })}
	            >
	              {t({ it: 'Chiedi unlock', en: 'Request unlock' })}
	            </button>
	          ) : null}
		          {isSuperAdmin && lockMenu.kind !== 'grant' && lockMenu.userId && lockMenu.userId !== String(user?.id || '') ? (
		            <button
		              onClick={() => {
		                window.dispatchEvent(
		                  new CustomEvent('deskly_force_unlock', {
		                    detail: {
	                      planId: lockMenu.planId,
	                      planName: lockMenu.planName,
	                      clientName: lockMenu.clientName,
	                      siteName: lockMenu.siteName,
	                      userId: lockMenu.userId,
	                      username: lockMenu.username,
	                      avatarUrl: lockMenu.avatarUrl || ''
	                    }
	                  })
	                );
	                setLockMenu(null);
	              }}
	              className="mt-2 flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
	              title={t({ it: 'Force unlock (Superadmin)', en: 'Force unlock (Superadmin)' })}
	            >
	              {t({ it: 'Force unlock', en: 'Force unlock' })}
	            </button>
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
      <ClientIpMapModal open={!!clientIpMapId} client={ipMapClient || undefined} onClose={() => setClientIpMapId(null)} />
      <ClientDirectoryModal open={!!clientDirectoryId} client={directoryClient || undefined} onClose={() => setClientDirectoryId(null)} />

      <CloneFloorPlanModal
        open={!!clonePlan}
        sourceName={clonePlan?.name || ''}
        existingNames={(() => {
          if (!clonePlan) return [];
          for (const c of clients || []) {
            for (const s of c.sites || []) {
              if ((s.floorPlans || []).some((p) => p.id === clonePlan.planId)) {
                return (s.floorPlans || []).map((p) => String((p as any)?.name || '')).filter(Boolean);
              }
            }
          }
          return [];
        })()}
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
