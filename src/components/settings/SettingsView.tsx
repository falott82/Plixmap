import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FolderPlus, Home, Map, MapPinned, Trash, ArrowLeftCircle, Pencil, Upload, Users, UserCircle2, Plus, LayoutGrid, Layers, ChevronUp, ChevronDown, DownloadCloud, Eye, X, HelpCircle, Mail, Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToastStore } from '../../store/useToast';
import AddFloorPlanModal from './AddFloorPlanModal';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';
import ReplacePlanImageModal from './ReplacePlanImageModal';
import { useAuthStore } from '../../store/useAuthStore';
import UsersPanel from './UsersPanel';
import AccountPanel from './AccountPanel';
import UserMenu from '../layout/UserMenu';
import LogsTabsPanel from './LogsTabsPanel';
import ClientModal from './ClientModal';
import NerdAreaPanel from './NerdAreaPanel';
import { useT } from '../../i18n/useT';
import SiteModal from './SiteModal';
import ObjectTypesPanel from './ObjectTypesPanel';
import BackupPanel from './BackupPanel';
import CustomImportPanel from './CustomImportPanel';
import VersionBadge from '../ui/VersionBadge';
import EmailSettingsPanel from './EmailSettingsPanel';
import DonationsPanel from './DonationsPanel';
import LayersPanel from './LayersPanel';

const SettingsView = () => {
  const {
    clients,
    addClient,
    updateClient,
    deleteClient,
    addSite,
    updateSite,
    deleteSite,
    addFloorPlan,
    updateFloorPlan,
    deleteFloorPlan,
    reorderFloorPlans,
    addRevision,
    clearObjects,
    findFloorPlan
  } = useDataStore();
  const { push } = useToastStore();
  const t = useT();
  // legacy inline fields removed (sites now via modal)
  const [selectedClient, setSelectedClient] = useState<string | undefined>(clients[0]?.id);
  const [selectedSite, setSelectedSite] = useState<string | undefined>(clients[0]?.sites[0]?.id);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'client' | 'site' | 'plan' } | null>(null);
  const [siteModal, setSiteModal] = useState<{ siteId?: string; initialName?: string; initialCoords?: string } | null>(null);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [replaceModal, setReplaceModal] = useState<
    | {
        planId: string;
        dataUrl: string;
        size?: { width: number; height: number };
      }
    | null
  >(null);
  const planInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [planPreview, setPlanPreview] = useState<{ name: string; imageUrl: string } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedPlanId, setSelectedPlan, openHelp } = useUIStore();
  const { user } = useAuthStore();
  const isAdmin = !!user?.isAdmin;
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const resolveTab = (search: string) => {
    const next = new URLSearchParams(search).get('tab')?.toLowerCase() || '';
    if (next === 'account') return 'account';
    if (next === 'objects') return 'objects';
    if (next === 'layers' && isAdmin) return 'layers';
    if (next === 'users' && isAdmin) return 'users';
    if (next === 'logs' && isSuperAdmin) return 'logs';
    if (next === 'email' && isSuperAdmin) return 'email';
    if (next === 'backup' && isSuperAdmin) return 'backup';
    if (next === 'import' && isSuperAdmin) return 'import';
    if (next === 'nerd' && isSuperAdmin) return 'nerd';
    if (next === 'donations') return 'donations';
    if (next === 'data' && isAdmin) return 'data';
    return isAdmin ? 'data' : 'account';
  };
  const [tab, setTab] = useState<'data' | 'objects' | 'layers' | 'users' | 'account' | 'logs' | 'email' | 'backup' | 'import' | 'nerd' | 'donations'>(
    () => resolveTab(location.search)
  );
  const setTabAndUrl = (nextTab: typeof tab) => {
    setTab(nextTab);
    const search = new URLSearchParams(location.search);
    search.set('tab', nextTab);
    navigate({ pathname: location.pathname, search: search.toString() }, { replace: true });
  };
  const [clientModal, setClientModal] = useState<{ client?: any } | null>(null);
  const modalActive = !!(clientModal || siteModal || addPlanOpen || replaceModal || confirmDelete || planPreview);

  useEffect(() => {
    const next = resolveTab(location.search);
    if (next !== tab) setTab(next);
  }, [isAdmin, isSuperAdmin, location.search, tab]);

  useEffect(() => {
    if (selectedClient && !clients.some((c) => c.id === selectedClient)) {
      setSelectedClient(clients[0]?.id);
    }
    if (selectedSite && !clients.some((c) => c.sites.some((s) => s.id === selectedSite))) {
      setSelectedSite(clients[0]?.sites[0]?.id);
    }
  }, [clients, selectedClient, selectedSite]);

  const currentClient = useMemo(
    () => clients.find((c) => c.id === selectedClient) || clients[0],
    [clients, selectedClient]
  );
  const currentSite = useMemo(
    () => currentClient?.sites.find((s) => s.id === selectedSite) || currentClient?.sites[0],
    [currentClient, selectedSite]
  );

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
  const sortedFloorPlans = useMemo(() => {
    const list = currentSite?.floorPlans || [];
    return [...list].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
  }, [currentSite?.floorPlans]);
  const firstPlanId = useMemo(() => clients[0]?.sites[0]?.floorPlans[0]?.id, [clients]);
  const defaultPlanId = useMemo(() => {
    const candidate = (user as any)?.defaultPlanId as string | null | undefined;
    if (!candidate) return null;
    for (const c of clients) {
      for (const s of c.sites) {
        if (s.floorPlans.some((p) => p.id === candidate)) return candidate;
      }
    }
    return null;
  }, [clients, user]);

  const handleReplacePlanImage = async (planId: string, fileList: FileList | null) => {
    if (!fileList || !fileList[0]) return;
    const file = fileList[0];
    const validation = validateFile(file, {
      allowedTypes: uploadMimes.images,
      maxBytes: uploadLimits.planImageBytes
    });
    if (!validation.ok) {
      push(
        validation.reason === 'size'
          ? t({
              it: `File troppo grande (max ${formatBytes(uploadLimits.planImageBytes)}).`,
              en: `File too large (max ${formatBytes(uploadLimits.planImageBytes)}).`
            })
          : t({
              it: 'Formato non supportato. Usa JPG, PNG o WEBP.',
              en: 'Unsupported format. Use JPG, PNG, or WEBP.'
            }),
        'danger'
      );
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    let size: { width: number; height: number } | undefined;
    try {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      size = { width: img.naturalWidth, height: img.naturalHeight };
    } catch {
      // ignore
    }
    setReplaceModal({ planId, dataUrl, size });
  };

  useEffect(() => {
    if (!editingPlan) return;
    window.setTimeout(() => planInputRefs.current[editingPlan]?.focus(), 0);
  }, [editingPlan]);

  return (
    <div className="h-screen overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Impostazioni', en: 'Settings' })}</p>
          <h1 className="text-2xl font-semibold text-ink">&nbsp;</h1>
        </div>
        <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const target = defaultPlanId || selectedPlanId || firstPlanId;
                if (target) {
                  setSelectedPlan(target);
                  navigate(`/plan/${target}?dv=1`);
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-card transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <ArrowLeftCircle size={16} />
            {t({ it: 'Area di lavoro', en: 'Workspace' })}
          </button>
          <VersionBadge />
          <button
            onClick={openHelp}
            title={t({ it: 'Aiuto', en: 'Help' })}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-card hover:bg-slate-50"
          >
            <HelpCircle size={18} />
          </button>
          <UserMenu />
        </div>
      </div>

      <div className={`mb-4 flex flex-wrap items-center gap-2 ${modalActive ? 'pointer-events-none opacity-30' : ''}`} aria-hidden={modalActive}>
        {isAdmin ? (
          <>
            <button
              onClick={() => setTabAndUrl('data')}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'data'
                  ? 'border-primary bg-primary text-white shadow-card'
                  : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
            >
              {t({ it: 'Clienti', en: 'Clients' })}
            </button>
            <button
              onClick={() => setTabAndUrl('objects')}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'objects' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
              title={t({ it: 'Apri tab Oggetti', en: 'Open Objects tab' })}
            >
              <LayoutGrid size={16} /> {t({ it: 'Oggetti', en: 'Objects' })}
            </button>
            <button
              onClick={() => setTabAndUrl('layers')}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'layers' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
              title={t({ it: 'Apri tab Layers', en: 'Open Layers tab' })}
            >
              <Layers size={16} /> {t({ it: 'Layers', en: 'Layers' })}
            </button>
            <button
              onClick={() => setTabAndUrl('users')}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'users' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
              title={t({ it: 'Apri tab Utenti', en: 'Open Users tab' })}
            >
              <Users size={16} /> {t({ it: 'Utenti', en: 'Users' })}
            </button>
            {isSuperAdmin ? (
              <>
                <button
                  onClick={() => setTabAndUrl('email')}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    tab === 'email' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
                  title={t({ it: 'Apri tab Email', en: 'Open Email tab' })}
                >
                  <Mail size={16} /> {t({ it: 'Email', en: 'Email' })}
                </button>
                <button
                  onClick={() => setTabAndUrl('backup')}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    tab === 'backup' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
                  title={t({ it: 'Apri tab Backup', en: 'Open Backup tab' })}
                >
                  <Upload size={16} /> {t({ it: 'Backup', en: 'Backup' })}
                </button>
                <button
                  onClick={() => setTabAndUrl('import')}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    tab === 'import' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
                  title={t({ it: 'Apri tab Custom Import', en: 'Open Custom Import tab' })}
                >
                  <DownloadCloud size={16} /> {t({ it: 'Custom Import', en: 'Custom Import' })}
                </button>
                <button
                  onClick={() => setTabAndUrl('nerd')}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    tab === 'nerd' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
                  title={t({ it: 'Apri tab Nerd Area', en: 'Open Nerd Area tab' })}
                >
                  {t({ it: 'Nerd Area', en: 'Nerd Area' })}
                </button>
              </>
            ) : null}
          </>
        ) : null}
        {!isAdmin ? (
          <>
            <button
              onClick={() => setTabAndUrl('objects')}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'objects' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
              title={t({ it: 'Apri tab Oggetti', en: 'Open Objects tab' })}
            >
              <LayoutGrid size={16} /> {t({ it: 'Oggetti', en: 'Objects' })}
            </button>
          </>
        ) : null}
        <button
          onClick={() => setTabAndUrl('account')}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'account' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
          title={t({ it: 'Apri tab Account', en: 'Open Account tab' })}
        >
          <UserCircle2 size={16} /> {t({ it: 'Account', en: 'Account' })}
        </button>
        {isSuperAdmin ? (
          <button
            onClick={() => setTabAndUrl('logs')}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
              tab === 'logs' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
            }`}
            title={t({ it: 'Apri tab Logs', en: 'Open Logs tab' })}
          >
            {t({ it: 'Logs', en: 'Logs' })}
          </button>
        ) : null}
        <button
          onClick={() => setTabAndUrl('donations')}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'donations' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
          title={t({ it: 'Apri tab Donazioni', en: 'Open Donations tab' })}
        >
          <Heart size={16} /> {t({ it: 'Donazioni', en: 'Donations' })}
        </button>
      </div>

      <div className={modalActive ? 'pointer-events-none opacity-30' : ''} aria-hidden={modalActive}>
        {tab === 'account' ? <AccountPanel /> : null}

        {tab === 'objects' ? <ObjectTypesPanel /> : null}

        {tab === 'layers' ? (
          isAdmin ? (
            <LayersPanel />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
              {t({ it: 'Non hai i permessi per gestire i layers.', en: 'You do not have permission to manage layers.' })}
            </div>
          )
        ) : null}

        {tab === 'donations' ? <DonationsPanel /> : null}

        {tab === 'users' ? (
          isAdmin ? (
            <UsersPanel />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
              {t({ it: 'Non hai i permessi per gestire gli utenti.', en: 'You do not have permission to manage users.' })}
            </div>
          )
        ) : null}

        {tab === 'logs' ? (
          isSuperAdmin ? (
            <LogsTabsPanel />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
              {t({ it: 'Non hai i permessi per vedere i logs.', en: 'You do not have permission to view logs.' })}
            </div>
          )
        ) : null}

        {tab === 'backup' ? (isSuperAdmin ? <BackupPanel /> : null) : null}

        {tab === 'import' ? (isSuperAdmin ? <CustomImportPanel /> : null) : null}

        {tab === 'nerd' ? (
          isSuperAdmin ? (
            <NerdAreaPanel />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
              {t({ it: 'Non hai i permessi per vedere la Nerd Area.', en: 'You do not have permission to view Nerd Area.' })}
            </div>
          )
        ) : null}

        {tab === 'email' ? (
          isSuperAdmin ? (
            <EmailSettingsPanel />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
              {t({ it: 'Non hai i permessi per vedere le impostazioni email.', en: 'You do not have permission to view email settings.' })}
            </div>
          )
        ) : null}

        {tab === 'data' ? (
          isAdmin ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <FolderPlus size={16} /> {t({ it: 'Clienti', en: 'Clients' })}
                </h2>
                <button
                  onClick={() => setClientModal({})}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90"
                  title={t({ it: 'Aggiungi cliente', en: 'Add client' })}
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(client.id)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm cursor-pointer ${
                      currentClient?.id === client.id ? 'border-primary bg-primary/5' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {client.logoUrl ? (
                        <img
                          src={client.logoUrl}
                          alt=""
                          className="h-7 w-7 rounded-lg border border-slate-200 bg-white object-cover"
                        />
                      ) : (
                        <Home size={14} className="text-primary" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{client.shortName || client.name}</div>
                        {client.vatId || client.pecEmail ? (
                          <div className="truncate text-xs text-slate-500">
                            {client.vatId ? `P.IVA ${client.vatId}` : ''}{client.vatId && client.pecEmail ? ' • ' : ''}{client.pecEmail || ''}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClientModal({ client });
                        }}
                        title={t({ it: 'Modifica', en: 'Edit' })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ id: client.id, type: 'client' })}
                        className="text-xs text-rose-500 hover:text-rose-700"
                        title={t({ it: 'Elimina', en: 'Delete' })}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Home size={16} /> {t({ it: 'Sedi per', en: 'Sites for' })} {currentClient?.name}
                </h2>
                <button
                  onClick={() => {
                    if (!currentClient) return;
                    setSiteModal({ });
                  }}
                  disabled={!currentClient}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                  title={t({ it: 'Aggiungi sede', en: 'Add site' })}
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {currentClient?.sites.map((site) => (
                  <div
                    key={site.id}
                    onClick={() => {
                      setSelectedSite(site.id);
                      setSelectedClient(site.clientId);
                    }}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm cursor-pointer ${
                      currentSite?.id === site.id ? 'border-primary bg-primary/5' : 'border-slate-200'
                    }`}
                  >
                    <div className="truncate text-sm font-semibold text-ink">{site.name}</div>
                    <div className="flex items-center gap-2">
                      {parseCoords((site as any).coords) ? (
                        <a
                          href={`https://www.google.com/maps?q=${parseCoords((site as any).coords)!.lat},${parseCoords((site as any).coords)!.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Apri su Google Maps', en: 'Open in Google Maps' })}
                        >
                          <MapPinned size={14} className="text-emerald-700" />
                        </a>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSiteModal({ siteId: site.id, initialName: site.name, initialCoords: (site as any).coords || '' });
                        }}
                        title={t({ it: 'Modifica', en: 'Edit' })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={14} />
                      </button>
                    <button
                      onClick={() => setConfirmDelete({ id: site.id, type: 'site' })}
                      className="text-xs text-rose-500 hover:text-rose-700"
                      title={t({ it: 'Elimina', en: 'Delete' })}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
                {!currentClient?.sites.length && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {t({ it: 'Nessuna sede per questo cliente.', en: 'No sites for this client.' })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Map size={16} /> {t({ it: 'Planimetrie per', en: 'Floor plans for' })} {currentSite?.name}
                </h2>
                <button
                  onClick={() => setAddPlanOpen(true)}
                  disabled={!currentSite}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white enabled:hover:bg-primary/90 disabled:opacity-50"
                  title={t({ it: 'Aggiungi planimetria', en: 'Add floor plan' })}
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {sortedFloorPlans.map((plan, idx) => (
                  <div
                    key={plan.id}
                    onClick={() => {
                      setSelectedSite(plan.siteId);
                      setSelectedClient(currentClient?.id);
                    }}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm cursor-pointer"
                  >
                    <input
                      value={plan.name}
                      onChange={(e) => updateFloorPlan(plan.id, { name: e.target.value })}
                      readOnly={editingPlan !== plan.id}
                      ref={(node) => {
                        planInputRefs.current[plan.id] = node;
                      }}
                      className="w-2/3 rounded-md border border-transparent px-1 py-0.5 text-sm font-semibold text-ink hover:border-slate-200 focus:border-primary focus:outline-none disabled:opacity-60"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const prev = sortedFloorPlans[idx - 1];
                          if (!prev) return;
                          reorderFloorPlans(plan.siteId, plan.id, prev.id, true);
                        }}
                        disabled={idx === 0}
                        title={t({ it: 'Sposta su', en: 'Move up' })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = sortedFloorPlans[idx + 1];
                          if (!next) return;
                          reorderFloorPlans(plan.siteId, plan.id, next.id, false);
                        }}
                        disabled={idx === sortedFloorPlans.length - 1}
                        title={t({ it: 'Sposta giù', en: 'Move down' })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPlan(editingPlan === plan.id ? null : plan.id);
                        }}
                        title={t({ it: 'Modifica', en: 'Edit' })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!plan.imageUrl) return;
                          setPlanPreview({ name: plan.name, imageUrl: plan.imageUrl });
                        }}
                        disabled={!plan.imageUrl}
                        title={
                          plan.imageUrl
                            ? t({ it: 'Visualizza planimetria', en: 'View floor plan' })
                            : t({ it: 'Nessuna immagine', en: 'No image available' })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Eye size={14} />
                      </button>
                      <label
                        title={t({
                          it: `Aggiorna immagine (JPG/PNG/WEBP, max ${formatBytes(uploadLimits.planImageBytes)})`,
                          en: `Update image (JPG/PNG/WEBP, max ${formatBytes(uploadLimits.planImageBytes)})`
                        })}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Upload size={14} />
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => handleReplacePlanImage(plan.id, e.target.files)}
                        />
                      </label>
                      <button
                        onClick={() => setConfirmDelete({ id: plan.id, type: 'plan' })}
                        className="text-xs text-rose-500 hover:text-rose-700"
                        title={t({ it: 'Elimina', en: 'Delete' })}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {!currentSite?.floorPlans.length && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {t({ it: 'Nessuna planimetria caricata.', en: 'No floor plan uploaded.' })}
                  </div>
                )}
              </div>
            </div>
          </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
              {t({
                it: 'Non hai i permessi per modificare i dati (clienti/sedi/planimetrie).',
                en: 'You do not have permission to edit data (clients/sites/floor plans).'
              })}
            </div>
          )
        ) : null}
      </div>

      <Transition show={!!planPreview} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPlanPreview(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Planimetria', en: 'Floor plan' })} · {planPreview?.name}
                    </Dialog.Title>
                    <button
                      onClick={() => setPlanPreview(null)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {planPreview?.imageUrl ? (
                      <img src={planPreview.imageUrl} alt="" className="max-h-[66vh] w-full object-contain" />
                    ) : (
                      <div className="text-sm text-slate-500">{t({ it: 'Nessuna immagine disponibile.', en: 'No image available.' })}</div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <AddFloorPlanModal
        open={addPlanOpen}
        existingNames={(currentSite?.floorPlans || []).map((p) => p.name)}
        onClose={() => setAddPlanOpen(false)}
        onSubmit={(payload) => {
          if (!currentSite) return;
          const normalized = payload.name.trim().toLowerCase();
          const exists = (currentSite.floorPlans || []).some((p) => p.name.trim().toLowerCase() === normalized);
          if (exists) {
            push(t({ it: 'Esiste già una planimetria con questo nome', en: 'A floor plan with this name already exists' }), 'danger');
            return;
          }
          addFloorPlan(currentSite.id, payload.name, payload.imageUrl, payload.width, payload.height);
          push(t({ it: 'Planimetria creata', en: 'Floor plan created' }), 'success');
        }}
      />

      <ReplacePlanImageModal
        open={!!replaceModal}
        planName={replaceModal ? findFloorPlan(replaceModal.planId)?.name || 'Planimetria' : 'Planimetria'}
        hasObjects={replaceModal ? (findFloorPlan(replaceModal.planId)?.objects?.length || 0) > 0 : false}
        onClose={() => setReplaceModal(null)}
        onConfirm={({ carryObjects }) => {
          if (!replaceModal) return;
          const plan = findFloorPlan(replaceModal.planId);
          if (!plan) return;
          addRevision(replaceModal.planId, {
            name: 'Archivio (cambio planimetria)',
            description: carryObjects
              ? 'Cambio immagine planimetria (oggetti riportati)'
              : 'Cambio immagine planimetria (oggetti rimossi)'
          });
          updateFloorPlan(replaceModal.planId, {
            imageUrl: replaceModal.dataUrl,
            width: replaceModal.size?.width,
            height: replaceModal.size?.height
          });
          if (!carryObjects) {
            clearObjects(replaceModal.planId);
          }
          push(
            carryObjects
              ? 'Planimetria aggiornata (oggetti riportati, da risistemare)'
              : 'Planimetria aggiornata (oggetti rimossi)',
            'success'
          );
          setReplaceModal(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title={t({ it: 'Conferma eliminazione', en: 'Confirm delete' })}
        description={t({ it: 'L’elemento verrà rimosso insieme alle entità figlie.', en: 'The item will be removed along with its children.' })}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === 'client') deleteClient(confirmDelete.id);
          if (confirmDelete.type === 'site') deleteSite(confirmDelete.id);
          if (confirmDelete.type === 'plan') deleteFloorPlan(confirmDelete.id);
          setConfirmDelete(null);
          push(t({ it: 'Elemento eliminato', en: 'Item deleted' }), 'info');
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
      />

      <ClientModal
        open={!!clientModal}
        initial={clientModal?.client || null}
        onClose={() => setClientModal(null)}
        onSubmit={(payload) => {
          if (clientModal?.client) {
            updateClient(clientModal.client.id, payload);
            push(t({ it: 'Cliente aggiornato', en: 'Client updated' }), 'success');
            setClientModal(null);
            return;
          }
          const id = addClient(payload.name);
          updateClient(id, payload);
          setSelectedClient(id);
          push(t({ it: 'Cliente creato', en: 'Client created' }), 'success');
          setClientModal(null);
        }}
      />

      <SiteModal
        open={!!siteModal}
        initialName={siteModal?.initialName || ''}
        initialCoords={siteModal?.initialCoords || ''}
        title={siteModal?.siteId ? t({ it: 'Modifica sede', en: 'Edit site' }) : t({ it: 'Nuova sede', en: 'New site' })}
        onClose={() => setSiteModal(null)}
        onSubmit={({ name, coords }) => {
          if (!currentClient) return;
          if (siteModal?.siteId) {
            updateSite(siteModal.siteId, { name, coords });
            push(t({ it: 'Sede aggiornata', en: 'Site updated' }), 'success');
            setSiteModal(null);
            return;
          }
          const id = addSite(currentClient.id, { name, coords });
          setSelectedSite(id);
          push(t({ it: 'Sede creata', en: 'Site created' }), 'success');
          setSiteModal(null);
        }}
      />
    </div>
  );
};

export default SettingsView;
