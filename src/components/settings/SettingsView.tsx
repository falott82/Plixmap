import { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Home, Map, Trash, ArrowLeftCircle, Pencil, Upload, Users, UserCircle2, Plus, LayoutGrid, ChevronUp, ChevronDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToastStore } from '../../store/useToast';
import AddFloorPlanModal from './AddFloorPlanModal';
import { readFileAsDataUrl } from '../../utils/files';
import ReplacePlanImageModal from './ReplacePlanImageModal';
import { useAuthStore } from '../../store/useAuthStore';
import UsersPanel from './UsersPanel';
import AccountPanel from './AccountPanel';
import UserMenu from '../layout/UserMenu';
import LogsPanel from './LogsPanel';
import ClientModal from './ClientModal';
import NerdAreaPanel from './NerdAreaPanel';
import { useT } from '../../i18n/useT';
import SiteModal from './SiteModal';
import ObjectTypesPanel from './ObjectTypesPanel';

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
  const [siteModal, setSiteModal] = useState<{ siteId?: string; initialName?: string } | null>(null);
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
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedPlanId } = useUIStore();
  const { user } = useAuthStore();
  const isAdmin = !!user?.isAdmin;
  const isSuperAdmin = !!user?.isSuperAdmin;
  const [tab, setTab] = useState<'data' | 'objects' | 'users' | 'account' | 'logs' | 'nerd'>(isAdmin ? 'data' : 'account');
  const [clientModal, setClientModal] = useState<{ client?: any } | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const t = (search.get('tab') || '').toLowerCase();
    if (t === 'account') setTab('account');
    else if (t === 'objects' && isAdmin) setTab('objects');
    else if (t === 'users' && isAdmin) setTab('users');
    else if (t === 'logs' && isSuperAdmin) setTab('logs');
    else if (t === 'nerd' && isSuperAdmin) setTab('nerd');
    else if (t === 'data' && isAdmin) setTab('data');
  }, [isAdmin, isSuperAdmin, location.search]);

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
  const sortedFloorPlans = useMemo(() => {
    const list = currentSite?.floorPlans || [];
    return [...list].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
  }, [currentSite?.floorPlans]);
  const firstPlanId = useMemo(() => clients[0]?.sites[0]?.floorPlans[0]?.id, [clients]);

  const handleReplacePlanImage = async (planId: string, fileList: FileList | null) => {
    if (!fileList || !fileList[0]) return;
    const dataUrl = await readFileAsDataUrl(fileList[0]);
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
              const target = selectedPlanId || firstPlanId;
              if (target) navigate(`/plan/${target}`);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-card transition hover:-translate-y-0.5 hover:bg-slate-50"
          >
            <ArrowLeftCircle size={16} />
            {t({ it: 'Area di lavoro', en: 'Workspace' })}
          </button>
          <UserMenu />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isAdmin ? (
          <>
            <button
              onClick={() => setTab('data')}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'data'
                  ? 'border-primary bg-primary text-white shadow-card'
                  : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
            >
              {t({ it: 'Clienti', en: 'Clients' })}
            </button>
            <button
              onClick={() => setTab('objects')}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'objects' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
            >
              <LayoutGrid size={16} /> {t({ it: 'Oggetti', en: 'Objects' })}
            </button>
            <button
              onClick={() => setTab('users')}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                tab === 'users' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
              }`}
            >
              <Users size={16} /> {t({ it: 'Utenti', en: 'Users' })}
            </button>
            {isSuperAdmin ? (
              <>
                <button
                  onClick={() => setTab('logs')}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    tab === 'logs' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
                >
                  {t({ it: 'Logs', en: 'Logs' })}
                </button>
                <button
                  onClick={() => setTab('nerd')}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    tab === 'nerd' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                  }`}
                >
                  {t({ it: 'Nerd Area', en: 'Nerd Area' })}
                </button>
              </>
            ) : null}
          </>
        ) : null}
        <button
          onClick={() => setTab('account')}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'account' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          <UserCircle2 size={16} /> {t({ it: 'Account', en: 'Account' })}
        </button>
      </div>

      {tab === 'account' ? <AccountPanel /> : null}

      {tab === 'objects' ? (isAdmin ? <ObjectTypesPanel /> : null) : null}

      {tab === 'users' ? (
        isAdmin ? (
          <UsersPanel />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
            Non hai i permessi per gestire gli utenti.
          </div>
        )
      ) : null}

      {tab === 'logs' ? (
        isSuperAdmin ? (
          <LogsPanel />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
            {t({ it: 'Non hai i permessi per vedere i logs.', en: 'You do not have permission to view logs.' })}
          </div>
        )
      ) : null}

      {tab === 'nerd' ? (
        isSuperAdmin ? (
          <NerdAreaPanel />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-sm text-slate-600">
            {t({ it: 'Non hai i permessi per vedere la Nerd Area.', en: 'You do not have permission to view Nerd Area.' })}
          </div>
        )
      ) : null}

      {tab === 'data' ? (
        isAdmin ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <FolderPlus size={16} /> Clienti
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSiteModal({ siteId: site.id, initialName: site.name });
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
                      disabled={editingPlan !== plan.id}
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
                      <label
                        title={t({ it: 'Aggiorna immagine (archivia la precedente)', en: 'Update image (archives previous)' })}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Upload size={14} />
                        <input
                          type="file"
                          accept="image/*"
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

      <AddFloorPlanModal
        open={addPlanOpen}
        existingNames={(currentSite?.floorPlans || []).map((p) => p.name)}
        onClose={() => setAddPlanOpen(false)}
        onSubmit={(payload) => {
          if (!currentSite) return;
          const normalized = payload.name.trim().toLowerCase();
          const exists = (currentSite.floorPlans || []).some((p) => p.name.trim().toLowerCase() === normalized);
          if (exists) {
            push('Esiste già una planimetria con questo nome', 'danger');
            return;
          }
          addFloorPlan(currentSite.id, payload.name, payload.imageUrl, payload.width, payload.height);
          push('Planimetria creata', 'success');
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
            push('Cliente aggiornato', 'success');
            setClientModal(null);
            return;
          }
          const id = addClient(payload.name);
          updateClient(id, payload);
          setSelectedClient(id);
          push('Cliente creato', 'success');
          setClientModal(null);
        }}
      />

      <SiteModal
        open={!!siteModal}
        initialName={siteModal?.initialName || ''}
        title={siteModal?.siteId ? t({ it: 'Modifica sede', en: 'Edit site' }) : t({ it: 'Nuova sede', en: 'New site' })}
        onClose={() => setSiteModal(null)}
        onSubmit={({ name }) => {
          if (!currentClient) return;
          if (siteModal?.siteId) {
            updateSite(siteModal.siteId, name);
            push(t({ it: 'Sede aggiornata', en: 'Site updated' }), 'success');
            setSiteModal(null);
            return;
          }
          const id = addSite(currentClient.id, name);
          setSelectedSite(id);
          push(t({ it: 'Sede creata', en: 'Site created' }), 'success');
          setSiteModal(null);
        }}
      />
    </div>
  );
};

export default SettingsView;
