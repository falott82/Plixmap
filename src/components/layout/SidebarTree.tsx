import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import FooterInfo from './FooterInfo';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../store/useAuthStore';
import { updateMyProfile } from '../../api/auth';
import ClientInfoModal from './ClientInfoModal';
import ClientAttachmentsModal from './ClientAttachmentsModal';
import ClientNotesModal from './ClientNotesModal';
import ClientIpMapModal from './ClientIpMapModal';
import ClientDirectoryModal from './ClientDirectoryModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import CloneFloorPlanModal from './CloneFloorPlanModal';
import SiteHoursModal from './SiteHoursModal';
import { fetchImportSummary, ImportSummaryRow } from '../../api/customImport';
import EmergencyContactsModal from './EmergencyContactsModal';
import ClientBusinessPartnersModal from './ClientBusinessPartnersModal';
import ClientEmailSettingsModal from './ClientEmailSettingsModal';
import { useToastStore } from '../../store/useToast';
import {
  createMeeting,
  fetchMeetings,
  fetchMeetingOverview,
  type MeetingBooking,
  type MeetingCheckInMapByMeetingId,
  type MeetingCheckInTimestampsByMeetingId,
  type MeetingRoomOverviewRow
} from '../../api/meetings';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';
import { SECURITY_LAYER_ID } from '../../store/security';
import {
  toEpochMs,
  todayIso,
  monthAnchorFromIso,
  hmToMinutes,
  minutesToHm,
  localTsFromIsoHm,
  getClientMeetingCheckInStats,
  computeClientMeetingCheckInEntries,
  computeClientMeetingsPreviewData,
  resolveClientDuplicateSlot
} from './SidebarTree.helpers';
import { SidebarLockMenu } from './SidebarLockMenu';
import { SidebarPlanMenu } from './SidebarPlanMenu';
import { SidebarClientMenu } from './SidebarClientMenu';
import { SidebarSiteMenu } from './SidebarSiteMenu';
import { SidebarTreeHeader } from './SidebarTreeHeader';
import { SidebarTreeCollapsed } from './SidebarTreeCollapsed';
import { SidebarSiteNode } from './SidebarSiteNode';
import { SidebarSiteSupportContactsModal } from './SidebarSiteSupportContactsModal';
import { SidebarClientMeetingsModal } from './SidebarClientMeetingsModal';
import { SidebarClientMeetingsRoomPreviewModal } from './SidebarClientMeetingsRoomPreviewModal';
import { SidebarClientMeetingsBookingDetailModal } from './SidebarClientMeetingsBookingDetailModal';
import { SidebarClientMeetingsDuplicateModal } from './SidebarClientMeetingsDuplicateModal';
import {
  getDefaultVisiblePlanLayerIds as getDefaultVisiblePlanLayerIdsUtil,
  normalizePlanLayerSelection as normalizePlanLayerSelectionUtil
} from '../../utils/layerVisibility';

const MeetingNotesModal = lazy(() => import('../meetings/MeetingNotesModal'));

type TreeClient = {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  sites: {
    id: string;
    name: string;
    coords?: string;
    supportContacts?: {
      cleaning?: { email?: string; phone?: string };
      it?: { email?: string; phone?: string };
      coffee?: { email?: string; phone?: string };
    };
    siteSchedule?: any;
    floorPlans: { id: string; name: string; order?: number; printArea?: any }[];
  }[];
};

type ClientMeetingsTimelineRow = {
  siteId: string;
  siteName: string;
  roomId: string;
  roomName: string;
  capacity: number;
  floorPlanName?: string;
  bookings: NonNullable<MeetingRoomOverviewRow['bookings']>;
};
type ClientMeetingsSearchResult = {
  booking: MeetingBooking;
  siteId: string;
  roomName: string;
  siteName: string;
  floorPlanName: string;
  participantsCount: number;
  participantsLabel: string;
};
type ClientDuplicateRoomOption = {
  roomId: string;
  roomName: string;
  floorPlanId: string;
  floorPlanName: string;
};
type ClientDuplicateDayCandidate = {
  roomId: string;
  roomName: string;
  floorPlanId: string;
  floorPlanName: string;
  startHm: string;
  endHm: string;
};
const OPEN_CLIENT_MEETINGS_EVENT = 'plixmap_open_client_meetings';
const OPEN_MEETING_CENTER_EVENT = 'plixmap_open_meeting_center';
const OPEN_MY_MEETINGS_EVENT = 'plixmap_open_my_meetings';

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
      const asContacts = JSON.stringify((as as any).supportContacts || null);
      const bsContacts = JSON.stringify((bs as any).supportContacts || null);
      if (asContacts !== bsContacts) return false;
      const asSchedule = JSON.stringify((as as any).siteSchedule || null);
      const bsSchedule = JSON.stringify((bs as any).siteSchedule || null);
      if (asSchedule !== bsSchedule) return false;
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
          supportContacts: (site as any).supportContacts,
          siteSchedule: (site as any).siteSchedule,
          floorPlans: site.floorPlans.map((p) => ({ id: p.id, name: p.name, order: (p as any).order, printArea: (p as any).printArea }))
        }))
      })),
    sameTree
  );
  const { deleteClient, deleteFloorPlan, reorderFloorPlans } = useDataStore(
    useShallow((s) => ({
      deleteClient: s.deleteClient,
      deleteFloorPlan: s.deleteFloorPlan,
      reorderFloorPlans: s.reorderFloorPlans
    }))
  );
  const updateFloorPlan = useDataStore((s) => s.updateFloorPlan);
  const updateSite = useDataStore((s) => s.updateSite);
  const cloneFloorPlan = useDataStore((s) => (s as any).cloneFloorPlan);
  const pushToast = useToastStore((s) => s.push);
  const { dataVersion, savedDataVersion } = useDataStore(
    useShallow((s) => ({ dataVersion: s.version, savedDataVersion: s.savedVersion }))
  );
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
    chatUnreadByClientId,
    visibleLayerIdsByPlan,
    hiddenLayersByPlan,
    setVisibleLayerIds,
    setHideAllLayers
  } = useUIStore(
    useShallow((s) => ({
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
      chatUnreadByClientId: (s as any).chatUnreadByClientId || {},
      visibleLayerIdsByPlan: (s as any).visibleLayerIdsByPlan || {},
      hiddenLayersByPlan: (s as any).hiddenLayersByPlan || {},
      setVisibleLayerIds: (s as any).setVisibleLayerIds,
      setHideAllLayers: (s as any).setHideAllLayers
    }))
  );
  const { requestSaveAndNavigate, dirtyByPlan } = useUIStore(
    useShallow((s) => ({ requestSaveAndNavigate: s.requestSaveAndNavigate, dirtyByPlan: s.dirtyByPlan }))
  );
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, permissions } = useAuthStore();
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
  const clientOrder = (((user as any)?.clientOrder || []) as string[]).filter((x) => typeof x === 'string');
  const [treeQuery, setTreeQuery] = useState('');
  const [planMenu, setPlanMenu] = useState<{ planId: string; clientId?: string; siteId?: string; coords?: string; x: number; y: number } | null>(null);
  const [clientMenu, setClientMenu] = useState<{ clientId: string; x: number; y: number } | null>(null);
  const [clientMenuRubricaOpen, setClientMenuRubricaOpen] = useState(false);
  const [siteMenu, setSiteMenu] = useState<{
    clientId: string;
    siteId: string;
    siteName: string;
    coords?: string;
    supportContacts?: {
      cleaning?: { email?: string; phone?: string };
      it?: { email?: string; phone?: string };
      coffee?: { email?: string; phone?: string };
    };
    siteSchedule?: any;
    x: number;
    y: number;
  } | null>(null);
  const [siteHoursModal, setSiteHoursModal] = useState<null | {
    clientId: string;
    clientName: string;
    siteId: string;
    siteName: string;
    siteSchedule?: any;
  }>(null);
  const [siteSupportContactsModal, setSiteSupportContactsModal] = useState<null | {
    clientId: string;
    siteId: string;
    clientName: string;
    siteName: string;
    supportContacts?: {
      cleaning?: { email?: string; phone?: string };
      it?: { email?: string; phone?: string };
      coffee?: { email?: string; phone?: string };
    };
  }>(null);
  const [clientInfoId, setClientInfoId] = useState<string | null>(null);
  const [clientNotesId, setClientNotesId] = useState<string | null>(null);
  const [clientAttachmentsId, setClientAttachmentsId] = useState<string | null>(null);
  const [clientIpMapId, setClientIpMapId] = useState<string | null>(null);
  const [clientDirectoryId, setClientDirectoryId] = useState<string | null>(null);
  const [clientEmergencyId, setClientEmergencyId] = useState<string | null>(null);
  const [clientBusinessPartnersId, setClientBusinessPartnersId] = useState<string | null>(null);
  const [clientEmailSettingsId, setClientEmailSettingsId] = useState<string | null>(null);
  const [clientMeetingsModal, setClientMeetingsModal] = useState<{
    clientId: string;
    day: string;
    siteId: string | 'all';
    siteLocked?: boolean;
    returnTo?: 'hub' | 'myMeetings' | null;
  } | null>(null);
  const [clientMeetingsLoading, setClientMeetingsLoading] = useState(false);
  const [clientMeetingsError, setClientMeetingsError] = useState<string | null>(null);
  const [clientMeetingsRows, setClientMeetingsRows] = useState<ClientMeetingsTimelineRow[]>([]);
  const [clientMeetingsSearchTerm, setClientMeetingsSearchTerm] = useState('');
  const [clientMeetingsSearchLoading, setClientMeetingsSearchLoading] = useState(false);
  const [clientMeetingsSearchError, setClientMeetingsSearchError] = useState<string | null>(null);
  const [clientMeetingsSearchResults, setClientMeetingsSearchResults] = useState<ClientMeetingsSearchResult[]>([]);
  const [clientMeetingsSearchActiveIndex, setClientMeetingsSearchActiveIndex] = useState(-1);
  const [clientMeetingsHighlightBookingId, setClientMeetingsHighlightBookingId] = useState<string | null>(null);
  const [clientMeetingsBookingDetail, setClientMeetingsBookingDetail] = useState<{
    booking: MeetingBooking;
    roomName: string;
    siteName: string;
  } | null>(null);
  const [clientMeetingsTimelineContextMenu, setClientMeetingsTimelineContextMenu] = useState<null | {
    booking: MeetingBooking;
    x: number;
    y: number;
  }>(null);
  const [clientMeetingsDuplicateModal, setClientMeetingsDuplicateModal] = useState<null | {
    booking: MeetingBooking;
    step: 'setup' | 'calendar';
    roomMode: 'selected' | 'any';
    selectedRoomId: string;
    timeMode: 'same' | 'any_08_18' | 'custom';
    customFromHm: string;
    customToHm: string;
    roomOptions: ClientDuplicateRoomOption[];
    baseDay: string;
    preferredDay: string;
    monthAnchor: string; // YYYY-MM-01
    selectedDays: string[];
    availabilityByDay: Record<string, { state: 'available' | 'occupied' | 'blocked' | 'loading' | 'error'; reason?: string }>;
    candidateByDay: Record<string, ClientDuplicateDayCandidate>;
    loadingMonth: boolean;
    saving: boolean;
    error: string | null;
  }>(null);
  const [clientMeetingsDuplicateRoomPickerOpen, setClientMeetingsDuplicateRoomPickerOpen] = useState(false);
  const clientMeetingsDuplicateRoomPickerRef = useRef<HTMLDivElement | null>(null);
  const [clientMeetingsShowCheckInDetails, setClientMeetingsShowCheckInDetails] = useState(false);
  const [clientMeetingsNotesBooking, setClientMeetingsNotesBooking] = useState<MeetingBooking | null>(null);
  const [clientMeetingsRoomPreview, setClientMeetingsRoomPreview] = useState<{
    roomId: string;
    floorPlanId: string;
    siteId: string;
  } | null>(null);
  const [clientMeetingsCheckInStatusByMeetingId, setClientMeetingsCheckInStatusByMeetingId] = useState<MeetingCheckInMapByMeetingId>({});
  const [clientMeetingsCheckInTimestampsByMeetingId, setClientMeetingsCheckInTimestampsByMeetingId] =
    useState<MeetingCheckInTimestampsByMeetingId>({});

  const [clientMeetingsNowTs, setClientMeetingsNowTs] = useState(Date.now());
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
  const siteSupportContactsFocusRef = useRef<HTMLButtonElement | null>(null);
  const clientMeetingsFocusRef = useRef<HTMLButtonElement | null>(null);
  const clientMeetingsSearchInputRef = useRef<HTMLInputElement | null>(null);
  const clientMeetingsRoomPreviewFocusRef = useRef<HTMLButtonElement | null>(null);
  const clientMeetingsBookingDetailFocusRef = useRef<HTMLButtonElement | null>(null);
  const clientMeetingsDuplicateFocusRef = useRef<HTMLButtonElement | null>(null);
  const clientMeetingsTimelineContextMenuRef = useRef<HTMLDivElement | null>(null);
  const clientMeetingsDetailCloseGuardUntilRef = useRef(0);

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
  const businessPartnersClient = useDataStore(
    useMemo(
      () => (s: any) => (clientBusinessPartnersId ? s.clients.find((c: any) => c.id === clientBusinessPartnersId) : null),
      [clientBusinessPartnersId]
    )
  );
  const emailClient = useDataStore(
    useMemo(
      () => (s: any) => (clientEmailSettingsId ? s.clients.find((c: any) => c.id === clientEmailSettingsId) : null),
      [clientEmailSettingsId]
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
  const planLayerIdsByPlan = useDataStore(
    useMemo(
      () => (s: any) => {
        const out: Record<string, string[]> = {};
        for (const client of s.clients || []) {
          const layerIds = ((client?.layers || []) as any[]).map((layer) => String(layer?.id || '')).filter(Boolean);
          for (const site of client.sites || []) {
            for (const plan of site.floorPlans || []) {
              out[String(plan.id)] = layerIds;
            }
          }
        }
        return out;
      },
      []
    )
  );
  const normalizePlanLayerSelectionForPlan = useMemo(
    () => (planLayerIds: string[], ids: string[]) => normalizePlanLayerSelectionUtil(planLayerIds, ids, ALL_ITEMS_LAYER_ID),
    []
  );
  const getPlanLayerIds = useMemo(
    () => (planId: string) => {
      const known = planLayerIdsByPlan[planId] || [];
      if (known.length) return known;
      return Array.from(new Set([ALL_ITEMS_LAYER_ID, SECURITY_LAYER_ID, ...((visibleLayerIdsByPlan[planId] || []) as string[])]));
    },
    [planLayerIdsByPlan, visibleLayerIdsByPlan]
  );
  const getDefaultVisiblePlanLayerIds = useMemo(
    () => (planLayerIds: string[]) =>
      getDefaultVisiblePlanLayerIdsUtil(planLayerIds, ALL_ITEMS_LAYER_ID, [SECURITY_LAYER_ID]),
    []
  );
  const isSecurityCardVisibleForPlan = useMemo(
    () => (planId: string) => {
      if (!planId) return false;
      if (hiddenLayersByPlan[planId]) return false;
      const layerIds = getPlanLayerIds(planId);
      const nonAllLayerIds = layerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
      const visible =
        typeof current === 'undefined'
          ? getDefaultVisiblePlanLayerIds(layerIds)
          : normalizePlanLayerSelectionForPlan(layerIds, current);
      const allItemsSelected = visible.includes(ALL_ITEMS_LAYER_ID);
      const effective = allItemsSelected ? nonAllLayerIds : visible.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      return effective.includes(SECURITY_LAYER_ID);
    },
    [getDefaultVisiblePlanLayerIds, getPlanLayerIds, hiddenLayersByPlan, normalizePlanLayerSelectionForPlan, visibleLayerIdsByPlan]
  );
  const toggleSecurityCardVisibilityForPlan = useMemo(
    () => (planId: string) => {
      if (!planId) return;
      const layerIds = getPlanLayerIds(planId);
      const nonAllLayerIds = layerIds.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      const current = visibleLayerIdsByPlan[planId] as string[] | undefined;
      const hideAll = !!hiddenLayersByPlan[planId];
      const visible =
        typeof current === 'undefined'
          ? getDefaultVisiblePlanLayerIds(layerIds)
          : normalizePlanLayerSelectionForPlan(layerIds, current);
      const allItemsSelected = visible.includes(ALL_ITEMS_LAYER_ID);
      const baseVisible = hideAll ? [] : allItemsSelected ? nonAllLayerIds : visible.filter((id) => id !== ALL_ITEMS_LAYER_ID);
      const hasSecurity = baseVisible.includes(SECURITY_LAYER_ID);
      const nextRaw = hasSecurity
        ? baseVisible.filter((id) => id !== SECURITY_LAYER_ID)
        : [...baseVisible, SECURITY_LAYER_ID];
      if (hideAll) setHideAllLayers(planId, false);
      setVisibleLayerIds(planId, normalizePlanLayerSelectionForPlan(layerIds, nextRaw));
    },
    [
      getDefaultVisiblePlanLayerIds,
      getPlanLayerIds,
      hiddenLayersByPlan,
      normalizePlanLayerSelectionForPlan,
      setHideAllLayers,
      setVisibleLayerIds,
      visibleLayerIdsByPlan
    ]
  );
  const planMenuSecurityVisible = planMenu ? isSecurityCardVisibleForPlan(planMenu.planId) : false;
  const emergencyModalPlanId = useMemo(() => {
    if (!clientEmergencyId || !selectedPlanId) return null;
    const entry = clients.find((client) => client.id === clientEmergencyId);
    if (!entry) return null;
    for (const site of entry.sites || []) {
      if ((site.floorPlans || []).some((plan) => plan.id === selectedPlanId)) return selectedPlanId;
    }
    return null;
  }, [clientEmergencyId, clients, selectedPlanId]);
  const emergencyModalSafetyVisible = emergencyModalPlanId ? isSecurityCardVisibleForPlan(emergencyModalPlanId) : false;

  const canEditClientNotes = useMemo(() => {
    if (!clientNotesId) return false;
    if (user?.isAdmin) return true;
    const p = (permissions || []).find((x: any) => x.scopeType === 'client' && x.scopeId === clientNotesId);
    return p?.access === 'rw';
  }, [clientNotesId, permissions, user?.isAdmin]);
  const canManageEmergencyDirectory = useMemo(() => {
    if (!clientEmergencyId) return false;
    if (isSuperAdmin) return true;
    if (!user?.isAdmin) return false;
    if ((permissions || []).some((perm: any) => perm.scopeType === 'client' && perm.scopeId === clientEmergencyId && perm.access === 'rw')) {
      return true;
    }
    const clientEntry = clients.find((entry) => entry.id === clientEmergencyId);
    if (!clientEntry) return false;
    const siteIds = new Set((clientEntry.sites || []).map((site) => site.id));
    const planIds = new Set((clientEntry.sites || []).flatMap((site) => site.floorPlans.map((plan) => plan.id)));
    return (permissions || []).some((perm: any) => {
      if (perm.access !== 'rw') return false;
      if (perm.scopeType === 'site') return siteIds.has(perm.scopeId);
      if (perm.scopeType === 'plan') return planIds.has(perm.scopeId);
      return false;
    });
  }, [clientEmergencyId, clients, isSuperAdmin, permissions, user?.isAdmin]);
  const canOpenBusinessPartnersDirectory = useMemo(
    () => !!isSuperAdmin || !!user?.isAdmin || (user as any)?.canManageBusinessPartners === true,
    [isSuperAdmin, user]
  );

  useEffect(() => {
    if (!clientMenu) setClientMenuRubricaOpen(false);
  }, [clientMenu]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) {
        setPlanMenu(null);
        setClientMenu(null);
        setClientMenuRubricaOpen(false);
        setSiteMenu(null);
        return;
      }
      if (!menuRef.current.contains(e.target as any)) {
        setPlanMenu(null);
        setClientMenu(null);
        setClientMenuRubricaOpen(false);
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
    if (!isSuperAdmin) {
      setImportSummaryByClient({});
      return;
    }
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
  }, [isSuperAdmin]);

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
  const allTreeExpanded = useMemo(() => {
    if (!orderedClients.length) return false;
    return orderedClients.every((client) => {
      const clientExpanded = expandedClients[client.id] !== false;
      if (!clientExpanded) return false;
      return (client.sites || []).every((site) => expandedSites[`${client.id}:${site.id}`] !== false);
    });
  }, [expandedClients, expandedSites, orderedClients]);

  const findFirstPlanForClient = (clientId: string): { planId: string; siteId: string } | null => {
    const entry = clients.find((client) => client.id === clientId);
    if (!entry) return null;
    for (const site of entry.sites || []) {
      const first = [...(site.floorPlans || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      if (first?.id) return { planId: first.id, siteId: site.id };
    }
    return null;
  };

  const findFirstPlanForSite = (clientId: string, siteId: string): string | null => {
    const entry = clients.find((client) => client.id === clientId);
    const site = entry?.sites.find((s) => s.id === siteId);
    const first = [...(site?.floorPlans || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    return first?.id || null;
  };

  const shouldPromptUnsavedPlanSwitch = (nextPlanId?: string | null) => {
    if (!String(location.pathname || '').startsWith('/plan/')) return false;
    const currentPlanId = String(selectedPlanId || '').trim();
    const targetPlanId = String(nextPlanId || '').trim();
    if (!currentPlanId || !targetPlanId || currentPlanId === targetPlanId) return false;
    if (!dirtyByPlan[currentPlanId]) return false;
    if (Number(dataVersion) === Number(savedDataVersion)) return false;
    return true;
  };

  const openCapacityDashboard = (
    targetPlanId: string,
    filters?: { clientId?: string; siteId?: string },
    options?: { keepCurrentPlan?: boolean }
  ) => {
    const effectivePlanId = options?.keepCurrentPlan && selectedPlanId ? selectedPlanId : targetPlanId;
    const params = new URLSearchParams();
    params.set('cd', '1');
    if (filters?.clientId) params.set('cdClient', filters.clientId);
    if (filters?.siteId) params.set('cdSite', filters.siteId);
    const to = `/plan/${effectivePlanId}?${params.toString()}`;
    setPlanMenu(null);
    setClientMenu(null);
    setSiteMenu(null);
    if (shouldPromptUnsavedPlanSwitch(effectivePlanId)) {
      requestSaveAndNavigate?.(to);
      return;
    }
    setSelectedPlan(effectivePlanId);
    navigate(to);
  };

  const openFindCapacity = (targetPlanId: string, filters?: { clientId?: string; siteId?: string }) => {
    const effectivePlanId = selectedPlanId || targetPlanId;
    const params = new URLSearchParams();
    params.set('fa', '1');
    if (filters?.clientId) params.set('faClient', filters.clientId);
    if (filters?.siteId) params.set('faSite', filters.siteId);
    const to = `/plan/${effectivePlanId}?${params.toString()}`;
    setPlanMenu(null);
    setClientMenu(null);
    setSiteMenu(null);
    if (shouldPromptUnsavedPlanSwitch(effectivePlanId)) {
      requestSaveAndNavigate?.(to);
      return;
    }
    setSelectedPlan(effectivePlanId);
    navigate(to);
  };

  const openClientMeetingsTimeline = useCallback(
    (
      clientId: string,
      siteId: string | 'all' = 'all',
      siteLocked = false,
      day: string = todayIso(),
      returnTo: 'hub' | 'myMeetings' | null = null
    ) => {
      setPlanMenu(null);
      setClientMenu(null);
      setSiteMenu(null);
      setClientMeetingsModal({ clientId, day, siteId, siteLocked, returnTo });
      setClientMeetingsRows([]);
      setClientMeetingsCheckInStatusByMeetingId({});
      setClientMeetingsCheckInTimestampsByMeetingId({});
      setClientMeetingsError(null);
      setClientMeetingsSearchTerm('');
      setClientMeetingsSearchLoading(false);
      setClientMeetingsSearchError(null);
      setClientMeetingsSearchResults([]);
      setClientMeetingsSearchActiveIndex(-1);
      setClientMeetingsHighlightBookingId(null);
    },
    []
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      const clientId = String(detail?.clientId || '').trim();
      if (!clientId) return;
      const siteIdRaw = String(detail?.siteId || '').trim();
      const siteId: string | 'all' = siteIdRaw || 'all';
      const dayRaw = String(detail?.day || '').trim();
      const day = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) ? dayRaw : todayIso();
      const returnToRaw = String(detail?.returnTo || '').trim();
      const returnTo = returnToRaw === 'hub' || returnToRaw === 'myMeetings' ? (returnToRaw as 'hub' | 'myMeetings') : null;
      openClientMeetingsTimeline(clientId, siteId, !!detail?.siteLocked, day, returnTo);
    };
    window.addEventListener(OPEN_CLIENT_MEETINGS_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_CLIENT_MEETINGS_EVENT, handler as EventListener);
  }, [openClientMeetingsTimeline]);

  const closeClientMeetingsModal = useCallback(() => {
    const returnTo = clientMeetingsModal?.returnTo || null;
    setClientMeetingsTimelineContextMenu(null);
    setClientMeetingsModal(null);
    setClientMeetingsSearchTerm('');
    setClientMeetingsSearchLoading(false);
    setClientMeetingsSearchError(null);
    setClientMeetingsSearchResults([]);
    setClientMeetingsSearchActiveIndex(-1);
    setClientMeetingsHighlightBookingId(null);
    if (returnTo === 'hub') {
      window.dispatchEvent(new CustomEvent(OPEN_MEETING_CENTER_EVENT));
      return;
    }
    if (returnTo === 'myMeetings') {
      window.dispatchEvent(new CustomEvent(OPEN_MY_MEETINGS_EVENT));
    }
  }, [clientMeetingsModal?.returnTo]);

  const selectedClientForMeetings = useMemo(
    () => (clientMeetingsModal ? clients.find((c) => c.id === clientMeetingsModal.clientId) || null : null),
    [clientMeetingsModal, clients]
  );
  const selectedClientForMeetingsFull = useDataStore(
    useMemo(
      () => (s: any) => (clientMeetingsModal ? s.clients.find((c: any) => c.id === clientMeetingsModal.clientId) || null : null),
      [clientMeetingsModal?.clientId]
    )
  );

  const clientMeetingsPreviewData = useMemo(
    () => computeClientMeetingsPreviewData(clientMeetingsRoomPreview, selectedClientForMeetingsFull),
    [clientMeetingsRoomPreview, selectedClientForMeetingsFull]
  );

  const getClientMeetingCheckInEntries = (
    booking: MeetingBooking,
    checkMap?: Record<string, true> | null,
    tsMap?: Record<string, number> | null
  ) => computeClientMeetingCheckInEntries(booking, checkMap, tsMap, selectedClientForMeetingsFull);

  const reloadClientMeetingsTimeline = async () => {
    if (!clientMeetingsModal) {
      setClientMeetingsRows([]);
      return;
    }
    const treeClient = clients.find((c) => c.id === clientMeetingsModal.clientId);
    if (!treeClient) {
      setClientMeetingsRows([]);
      setClientMeetingsError(t({ it: 'Cliente non trovato.', en: 'Client not found.' }));
      return;
    }
    const sitesToLoad = (treeClient.sites || []).filter((s) =>
      clientMeetingsModal.siteId === 'all' ? true : String(s.id) === String(clientMeetingsModal.siteId)
    );
    if (!sitesToLoad.length) {
      setClientMeetingsRows([]);
      return;
    }
    setClientMeetingsLoading(true);
    setClientMeetingsError(null);
    try {
      const responses = await Promise.all(
        sitesToLoad.map(async (site) => {
          const payload = await fetchMeetingOverview({
            clientId: treeClient.id,
            siteId: site.id,
            day: clientMeetingsModal.day
          });
          return {
            site,
            rooms: payload.rooms || [],
            checkInStatusByMeetingId: payload.checkInStatusByMeetingId || {},
            checkInTimestampsByMeetingId: payload.checkInTimestampsByMeetingId || {}
          };
        })
      );
      const rows: ClientMeetingsTimelineRow[] = responses
        .flatMap(({ site, rooms }) =>
          rooms
            .filter((room) => room.isMeetingRoom)
            .map((room) => ({
              siteId: String(site.id),
              siteName: String(site.name || ''),
              roomId: String(room.roomId || ''),
              roomName: String(room.roomName || ''),
              capacity: Number(room.capacity || 0),
              floorPlanName: String((room as any).floorPlanName || ''),
              bookings: Array.isArray(room.bookings) ? room.bookings : []
            }))
        )
        .sort((a, b) =>
          a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' }) ||
          a.roomName.localeCompare(b.roomName, undefined, { sensitivity: 'base' })
        );
      setClientMeetingsRows(rows);
      const mergedCheckins: MeetingCheckInMapByMeetingId = {};
      const mergedCheckInTimestamps: MeetingCheckInTimestampsByMeetingId = {};
      for (const res of responses) {
        for (const [meetingId, statusMap] of Object.entries(res.checkInStatusByMeetingId || {})) {
          mergedCheckins[String(meetingId)] = { ...(mergedCheckins[String(meetingId)] || {}), ...(statusMap || {}) };
        }
        for (const [meetingId, tsMap] of Object.entries((res as any).checkInTimestampsByMeetingId || {})) {
          mergedCheckInTimestamps[String(meetingId)] = {
            ...(mergedCheckInTimestamps[String(meetingId)] || {}),
            ...(tsMap || {})
          };
        }
      }
      setClientMeetingsCheckInStatusByMeetingId(mergedCheckins);
      setClientMeetingsCheckInTimestampsByMeetingId(mergedCheckInTimestamps);
    } catch {
      setClientMeetingsError(t({ it: 'Errore caricamento meetings.', en: 'Failed to load meetings.' }));
      setClientMeetingsRows([]);
      setClientMeetingsCheckInStatusByMeetingId({});
      setClientMeetingsCheckInTimestampsByMeetingId({});
    } finally {
      setClientMeetingsLoading(false);
    }
  };

  useEffect(() => {
    if (!clientMeetingsModal) return;
    reloadClientMeetingsTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientMeetingsModal?.clientId, clientMeetingsModal?.day, clientMeetingsModal?.siteId]);

  useEffect(() => {
    if (!clientMeetingsModal) return;
    const id = window.setInterval(() => setClientMeetingsNowTs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [clientMeetingsModal]);

  useEffect(() => {
    if (!clientMeetingsTimelineContextMenu) return;
    const close = () => setClientMeetingsTimelineContextMenu(null);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && clientMeetingsTimelineContextMenuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('contextmenu', onPointerDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('contextmenu', onPointerDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [clientMeetingsTimelineContextMenu]);

  const clientMeetingsTimelineMeta = useMemo(() => {
    const rows = clientMeetingsRows || [];
    let minMinutes = 8 * 60;
    let maxMinutes = 19 * 60;
    for (const row of rows) {
      for (const booking of row.bookings || []) {
        const start = new Date(Number(booking.startAt || 0));
        const end = new Date(Number(booking.endAt || 0));
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
        const s = start.getHours() * 60 + start.getMinutes();
        const e = end.getHours() * 60 + end.getMinutes();
        minMinutes = Math.min(minMinutes, s);
        maxMinutes = Math.max(maxMinutes, e);
      }
    }
    minMinutes = Math.max(0, Math.floor((minMinutes - 30) / 60) * 60);
    maxMinutes = Math.min(24 * 60, Math.ceil((maxMinutes + 30) / 60) * 60);
    if (maxMinutes - minMinutes < 6 * 60) maxMinutes = Math.min(24 * 60, minMinutes + 6 * 60);
    const hours: number[] = [];
    for (let m = minMinutes; m <= maxMinutes; m += 60) hours.push(m);
    const selectedDay = String(clientMeetingsModal?.day || '');
    const now = new Date(clientMeetingsNowTs);
    const nowDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const showNowLine = selectedDay === nowDay && nowMinutes >= minMinutes && nowMinutes <= maxMinutes;
    return { minMinutes, maxMinutes, hours, nowMinutes, showNowLine };
  }, [clientMeetingsRows, clientMeetingsModal?.day, clientMeetingsNowTs]);

  const jumpToClientTimelineMeeting = useCallback(
    (result: ClientMeetingsSearchResult) => {
      const booking = result?.booking;
      if (!booking) return;
      const targetDay = String((booking as any).occurrenceDate || new Date(Number(booking.startAt || 0)).toISOString().slice(0, 10) || '').trim();
      if (!targetDay) return;
      setClientMeetingsSearchTerm('');
      setClientMeetingsSearchResults([]);
      setClientMeetingsSearchActiveIndex(-1);
      setClientMeetingsSearchError(null);
      setClientMeetingsHighlightBookingId(String(booking.id || ''));
      setClientMeetingsModal((prev) =>
        prev
          ? {
              ...prev,
              day: targetDay,
              siteId: prev.siteLocked ? prev.siteId : (String(result.siteId || '').trim() || prev.siteId)
            }
          : prev
      );
      window.setTimeout(() => {
        setClientMeetingsHighlightBookingId((prev) => (prev === String(booking.id || '') ? null : prev));
      }, 4200);
    },
    []
  );

  useEffect(() => {
    if (!clientMeetingsModal) return;
    const term = String(clientMeetingsSearchTerm || '').trim();
    if (!term) {
      setClientMeetingsSearchLoading(false);
      setClientMeetingsSearchError(null);
      setClientMeetingsSearchResults([]);
      setClientMeetingsSearchActiveIndex(-1);
      return;
    }
    if (term.length < 2) {
      setClientMeetingsSearchLoading(false);
      setClientMeetingsSearchError(null);
      setClientMeetingsSearchResults([]);
      setClientMeetingsSearchActiveIndex(-1);
      return;
    }
    const selectedClientId = String(clientMeetingsModal.clientId || '').trim();
    if (!selectedClientId) return;
    const selectedClient = clients.find((entry) => String(entry.id) === selectedClientId);
    if (!selectedClient) {
      setClientMeetingsSearchError(t({ it: 'Cliente non trovato.', en: 'Client not found.' }));
      setClientMeetingsSearchResults([]);
      setClientMeetingsSearchActiveIndex(-1);
      return;
    }
    const candidateSites = (selectedClient.sites || []).filter((siteEntry) =>
      clientMeetingsModal.siteId === 'all' ? true : String(siteEntry.id) === String(clientMeetingsModal.siteId)
    );
    if (!candidateSites.length) {
      setClientMeetingsSearchError(t({ it: 'Nessuna sede disponibile.', en: 'No site available.' }));
      setClientMeetingsSearchResults([]);
      setClientMeetingsSearchActiveIndex(-1);
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setClientMeetingsSearchLoading(true);
      setClientMeetingsSearchError(null);
      try {
        const responses = await Promise.all(
          candidateSites.map(async (siteEntry) => {
            const payload = await fetchMeetings({ siteId: String(siteEntry.id) });
            return { siteEntry, meetings: Array.isArray(payload?.meetings) ? payload.meetings : [] };
          })
        );
        if (cancelled) return;
        const normalizedTerm = term.toLowerCase().replace(/^#/, '');
        const matchRows: ClientMeetingsSearchResult[] = [];
        for (const { siteEntry, meetings } of responses) {
          for (const booking of meetings) {
            if (String(booking.clientId || '') !== selectedClientId) continue;
            const meetingNumber = Number((booking as any)?.meetingNumber || 0);
            const subject = String(booking.subject || '').trim();
            const roomName = String(booking.roomName || '').trim();
            const floorPlanName = String(
              (siteEntry.floorPlans || []).find((plan) => String(plan.id) === String(booking.floorPlanId || ''))?.name || ''
            ).trim();
            const searchBlob = [subject, roomName, floorPlanName, String(meetingNumber > 0 ? meetingNumber : ''), meetingNumber > 0 ? `#${meetingNumber}` : '']
              .join(' ')
              .toLowerCase();
            if (!searchBlob.includes(normalizedTerm)) continue;
            const participants = Array.isArray(booking.participants) ? booking.participants : [];
            const participantsCount = participants.length;
            const participantsLabel = participants
              .slice(0, 3)
              .map((participant: any) => String(participant?.fullName || participant?.externalId || '').trim())
              .filter(Boolean)
              .join(', ');
            matchRows.push({
              booking,
              siteId: String(siteEntry.id || ''),
              roomName: roomName || '-',
              siteName: String(siteEntry.name || ''),
              floorPlanName,
              participantsCount,
              participantsLabel: participantsLabel || '-'
            });
          }
        }
        matchRows.sort((a, b) => Number(b.booking.startAt || 0) - Number(a.booking.startAt || 0));
        setClientMeetingsSearchResults(matchRows.slice(0, 80));
        setClientMeetingsSearchActiveIndex(matchRows.length ? 0 : -1);
      } catch {
        if (cancelled) return;
        setClientMeetingsSearchError(t({ it: 'Errore durante la ricerca meeting.', en: 'Error searching meetings.' }));
        setClientMeetingsSearchResults([]);
        setClientMeetingsSearchActiveIndex(-1);
      } finally {
        if (!cancelled) setClientMeetingsSearchLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [clientMeetingsModal, clientMeetingsSearchTerm, clients, t]);

  const openClientMeetingDuplicateModal = (booking: MeetingBooking, options?: { preferredDay?: string }) => {
    const baseDay = String((booking as any).occurrenceDate || new Date(Number(booking.startAt || 0)).toISOString().slice(0, 10) || '').trim();
    if (!baseDay) return;
    const preferredDayRaw = String(options?.preferredDay || '').trim();
    const preferredDay = /^\d{4}-\d{2}-\d{2}$/.test(preferredDayRaw) ? preferredDayRaw : '';
    const siteEntry = (selectedClientForMeetingsFull?.sites || []).find((entry: any) => String(entry?.id || '') === String(booking.siteId || ''));
    const optionsById = new Map<string, ClientDuplicateRoomOption>();
    for (const floorPlan of siteEntry?.floorPlans || []) {
      const floorPlanId = String((floorPlan as any)?.id || '').trim();
      const floorPlanName = String((floorPlan as any)?.name || '').trim();
      for (const room of (floorPlan as any)?.rooms || []) {
        const roomId = String((room as any)?.id || '').trim();
        if (!roomId || !(room as any)?.meetingRoom) continue;
        if (optionsById.has(roomId)) continue;
        optionsById.set(roomId, {
          roomId,
          roomName: String((room as any)?.name || (booking as any)?.roomName || roomId).trim(),
          floorPlanId,
          floorPlanName
        });
      }
    }
    const sourceRoomId = String((booking as any)?.roomId || '').trim();
    const sourceRoomName = String((booking as any)?.roomName || '').trim() || t({ it: 'Sala meeting', en: 'Meeting room' });
    if (sourceRoomId && !optionsById.has(sourceRoomId)) {
      optionsById.set(sourceRoomId, {
        roomId: sourceRoomId,
        roomName: sourceRoomName,
        floorPlanId: String((booking as any)?.floorPlanId || '').trim(),
        floorPlanName: ''
      });
    }
    const roomOptions = Array.from(optionsById.values()).sort((a, b) => a.roomName.localeCompare(b.roomName));
    const selectedRoomId = roomOptions.some((entry) => entry.roomId === sourceRoomId)
      ? sourceRoomId
      : String(roomOptions[0]?.roomId || sourceRoomId || '').trim();
    setClientMeetingsDuplicateModal({
      booking,
      step: 'setup',
      roomMode: 'selected',
      selectedRoomId,
      timeMode: 'same',
      customFromHm: '08:00',
      customToHm: '18:00',
      roomOptions,
      baseDay,
      preferredDay,
      monthAnchor: monthAnchorFromIso(preferredDay || baseDay),
      selectedDays: [],
      availabilityByDay: {},
      candidateByDay: {},
      loadingMonth: false,
      saving: false,
      error: null
    });
  };


  useEffect(() => {
    if (!clientMeetingsDuplicateRoomPickerOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!clientMeetingsDuplicateRoomPickerRef.current) return;
      if (clientMeetingsDuplicateRoomPickerRef.current.contains(event.target as Node)) return;
      setClientMeetingsDuplicateRoomPickerOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [clientMeetingsDuplicateRoomPickerOpen]);

  useEffect(() => {
    if (!clientMeetingsDuplicateModal || clientMeetingsDuplicateModal.step !== 'setup') {
      setClientMeetingsDuplicateRoomPickerOpen(false);
    }
  }, [clientMeetingsDuplicateModal?.step, clientMeetingsDuplicateModal?.booking?.id]);

  useEffect(() => {
    let cancelled = false;
    const dup = clientMeetingsDuplicateModal;
    const bookingId = String(dup?.booking?.id || '').trim();
    if (!dup || !bookingId) return;
    if (dup.step !== 'calendar') return;
    const booking = dup.booking;
    const clientId = String(booking.clientId || '').trim();
    const siteId = String(booking.siteId || '').trim();
    const baseDay = String(dup.baseDay || '').trim();
    const monthAnchor = String(dup.monthAnchor || '').trim();
    if (!baseDay || !monthAnchor || !clientId || !siteId) return;
    const monthDate = new Date(`${monthAnchor}T00:00:00`);
    if (!Number.isFinite(monthDate.getTime())) return;
    const today = todayIso();
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthDays = Array.from({ length: daysInMonth }, (_, idx) => {
      const d = new Date(y, m, idx + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const unknownDays = monthDays.filter((iso) => !dup.availabilityByDay?.[iso]);
    if (!unknownDays.length) return;
    const sourceSlot = resolveClientDuplicateSlot(booking, baseDay, 'same');
    if (!sourceSlot) return;
    const durationMin = Math.max(1, sourceSlot.endMin - sourceSlot.startMin);
    const sourceStartMin = sourceSlot.startMin;
    const candidateRooms =
      dup.roomMode === 'any'
        ? dup.roomOptions
        : dup.roomOptions.filter((entry) => String(entry.roomId) === String(dup.selectedRoomId || ''));
    if (!candidateRooms.length) {
      setClientMeetingsDuplicateModal((prev) =>
        prev && String(prev.booking.id) === bookingId ? { ...prev, error: t({ it: 'Seleziona una saletta valida.', en: 'Select a valid room.' }) } : prev
      );
      return;
    }

    const prefilled: Record<string, any> = {};
    const queue: string[] = [];
    for (const day of unknownDays) {
      if (day <= baseDay) {
        prefilled[day] = {
          state: 'blocked',
          reason: day < today ? t({ it: 'Giorno passato', en: 'Past day' }) : t({ it: 'Giorno di origine', en: 'Source day' })
        };
        continue;
      }
      if (day < today) {
        prefilled[day] = { state: 'blocked', reason: t({ it: 'Giorno passato', en: 'Past day' }) };
        continue;
      }
      queue.push(day);
    }
    if (!Object.keys(prefilled).length && !queue.length) return;

    setClientMeetingsDuplicateModal((prev) => {
      if (!prev || String(prev.booking.id) !== bookingId || String(prev.monthAnchor) !== monthAnchor) return prev;
      return {
        ...prev,
        loadingMonth: queue.length > 0,
        availabilityByDay: {
          ...prev.availabilityByDay,
          ...prefilled,
          ...Object.fromEntries(queue.map((day) => [day, { state: 'loading' as const }]))
        },
        candidateByDay: Object.fromEntries(
          Object.entries(prev.candidateByDay || {}).filter(([day]) => monthDays.includes(day))
        )
      };
    });

    (async () => {
      if (!queue.length) {
        setClientMeetingsDuplicateModal((prev) => {
          if (!prev || String(prev.booking.id) !== bookingId || String(prev.monthAnchor) !== monthAnchor) return prev;
          return { ...prev, loadingMonth: false };
        });
        return;
      }
      const outcomes: Record<string, any> = {};
      const candidates: Record<string, ClientDuplicateDayCandidate> = {};
      try {
        const monthStartTs = new Date(y, m, 1, 0, 0, 0, 0).getTime();
        const monthEndTs = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
        const payload = await Promise.race([
          fetchMeetings({
            siteId,
            fromAt: monthStartTs - 24 * 60 * 60 * 1000,
            toAt: monthEndTs + 24 * 60 * 60 * 1000
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500))
        ]);
        const allMeetings = Array.isArray(payload?.meetings) ? payload.meetings : [];
        const scopedMeetings = allMeetings.filter((entry: any) => {
          if (String(entry?.clientId || '') !== clientId) return false;
          if (String(entry?.siteId || '') !== siteId) return false;
          return true;
        });
        const toIntervals = (day: string, roomId: string): Array<{ start: number; end: number }> => {
          const dayStartTs = localTsFromIsoHm(day, '00:00');
          if (dayStartTs === null) return [];
          const dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;
          const raw = scopedMeetings
            .filter((entry: any) => String(entry?.roomId || '') === roomId && String(entry?.id || '') !== String(booking.id || ''))
            .map((entry: any) => {
              const startRaw = toEpochMs(entry?.startAt);
              const endRaw = toEpochMs(entry?.endAt);
              const preMin = Math.max(0, Number(entry?.setupBufferBeforeMin) || 0);
              const postMin = Math.max(0, Number(entry?.setupBufferAfterMin) || 0);
              const startAdj = startRaw - preMin * 60_000;
              const endAdj = endRaw + postMin * 60_000;
              return { startAdj, endAdj };
            })
            .filter((entry) => Number.isFinite(entry.startAdj) && Number.isFinite(entry.endAdj) && entry.startAdj < dayEndTs && entry.endAdj > dayStartTs)
            .map((entry) => ({
              start: Math.max(0, Math.floor((Math.max(entry.startAdj, dayStartTs) - dayStartTs) / 60_000)),
              end: Math.min(24 * 60, Math.ceil((Math.min(entry.endAdj, dayEndTs) - dayStartTs) / 60_000))
            }))
            .filter((entry) => entry.end > entry.start)
            .sort((a, b) => a.start - b.start);
          const merged: Array<{ start: number; end: number }> = [];
          for (const interval of raw) {
            const last = merged[merged.length - 1];
            if (!last || interval.start > last.end) {
              merged.push({ ...interval });
            } else {
              last.end = Math.max(last.end, interval.end);
            }
          }
          return merged;
        };
        const findSlot = (
          day: string,
          intervals: Array<{ start: number; end: number }>
        ): { startMin: number; endMin: number } | null => {
          const nowMin = (() => {
            if (day !== today) return 0;
            const now = new Date();
            return now.getHours() * 60 + now.getMinutes();
          })();
          if (dup.timeMode === 'same') {
            const startMin = Math.max(sourceStartMin, nowMin);
            const endMin = startMin + durationMin;
            if (endMin > 23 * 60 + 59) return null;
            const overlap = intervals.some((entry) => entry.start < endMin && entry.end > startMin);
            return overlap ? null : { startMin, endMin };
          }
          const windowStartRaw =
            dup.timeMode === 'custom' ? hmToMinutes(String(dup.customFromHm || '')) : 8 * 60;
          const windowEndRaw =
            dup.timeMode === 'custom' ? hmToMinutes(String(dup.customToHm || '')) : 18 * 60;
          if (!Number.isFinite(windowStartRaw) || !Number.isFinite(windowEndRaw)) return null;
          const windowStart = Math.max(0, Math.min(23 * 60 + 59, Math.max(windowStartRaw, nowMin)));
          const windowEnd = Math.max(0, Math.min(23 * 60 + 59, windowEndRaw));
          if (windowEnd <= windowStart) return null;
          let cursor = windowStart;
          for (const interval of intervals) {
            if (interval.end <= windowStart) continue;
            if (interval.start >= windowEnd) break;
            const blockedStart = Math.max(windowStart, interval.start);
            if (cursor + durationMin <= blockedStart) return { startMin: cursor, endMin: cursor + durationMin };
            cursor = Math.max(cursor, Math.min(windowEnd, interval.end));
            if (cursor >= windowEnd) break;
          }
          if (cursor + durationMin <= windowEnd) return { startMin: cursor, endMin: cursor + durationMin };
          return null;
        };
        for (const day of queue) {
          let chosen: ClientDuplicateDayCandidate | null = null;
          for (const room of candidateRooms) {
            const intervals = toIntervals(day, room.roomId);
            const slot = findSlot(day, intervals);
            if (!slot) continue;
            chosen = {
              roomId: room.roomId,
              roomName: room.roomName,
              floorPlanId: room.floorPlanId,
              floorPlanName: room.floorPlanName,
              startHm: minutesToHm(slot.startMin),
              endHm: minutesToHm(slot.endMin)
            };
            break;
          }
          if (chosen) {
            outcomes[day] = {
              state: 'available',
              reason: `${chosen.roomName} • ${chosen.startHm} - ${chosen.endHm}`
            };
            candidates[day] = chosen;
          } else {
            outcomes[day] = {
              state: 'occupied',
              reason:
                dup.roomMode === 'any'
                  ? t({ it: 'Nessuna saletta disponibile in questa sede.', en: 'No meeting room available in this site.' })
                  : t({ it: 'Saletta occupata nello slot richiesto.', en: 'Selected room is busy in requested slot.' })
            };
          }
        }
      } catch {
        for (const day of queue) {
          outcomes[day] = { state: 'error', reason: t({ it: 'Errore verifica disponibilità', en: 'Availability check failed' }) };
        }
      }
      if (cancelled) return;
      setClientMeetingsDuplicateModal((prev) => {
        if (!prev || String(prev.booking.id) !== bookingId || String(prev.monthAnchor) !== monthAnchor) return prev;
        const mergedCandidates = { ...(prev.candidateByDay || {}), ...candidates };
        const validSelectedDays = prev.selectedDays.filter((day) => mergedCandidates[day] && outcomes[day]?.state === 'available');
        const preferredDay = String(prev.preferredDay || '').trim();
        if (
          preferredDay &&
          monthDays.includes(preferredDay) &&
          !validSelectedDays.includes(preferredDay) &&
          mergedCandidates[preferredDay] &&
          String((outcomes[preferredDay] || prev.availabilityByDay?.[preferredDay] || {}).state || '') === 'available'
        ) {
          validSelectedDays.push(preferredDay);
        }
        return {
          ...prev,
          loadingMonth: false,
          selectedDays: validSelectedDays,
          availabilityByDay: {
            ...prev.availabilityByDay,
            ...outcomes
          },
          candidateByDay: mergedCandidates
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clientMeetingsDuplicateModal?.step,
    clientMeetingsDuplicateModal?.booking?.id,
    clientMeetingsDuplicateModal?.baseDay,
    clientMeetingsDuplicateModal?.preferredDay,
    clientMeetingsDuplicateModal?.monthAnchor,
    clientMeetingsDuplicateModal?.roomMode,
    clientMeetingsDuplicateModal?.selectedRoomId,
    clientMeetingsDuplicateModal?.timeMode,
    clientMeetingsDuplicateModal?.customFromHm,
    clientMeetingsDuplicateModal?.customToHm,
    resolveClientDuplicateSlot
  ]);

  const saveClientMeetingDuplicates = async () => {
    const dup = clientMeetingsDuplicateModal;
    if (!dup) return;
    const booking = dup.booking;
    const selectedDays = [...dup.selectedDays].sort();
    if (!selectedDays.length) {
      setClientMeetingsDuplicateModal((prev) =>
        prev ? { ...prev, error: t({ it: 'Seleziona almeno un giorno.', en: 'Select at least one day.' }) } : prev
      );
      return;
    }
    setClientMeetingsDuplicateModal((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    const failures: string[] = [];
    for (const day of selectedDays) {
      try {
        const candidate = dup.candidateByDay?.[day];
        if (!candidate) {
          failures.push(`${day}: ${t({ it: 'Nessuna disponibilità valida', en: 'No valid availability' })}`);
          continue;
        }
        await createMeeting({
          clientId: String(booking.clientId),
          siteId: String(booking.siteId),
          ...(String(candidate.floorPlanId || booking.floorPlanId || '').trim()
            ? { floorPlanId: String(candidate.floorPlanId || booking.floorPlanId) }
            : {}),
          roomId: String(candidate.roomId || booking.roomId),
          subject: String(booking.subject || '').trim() || t({ it: 'Meeting', en: 'Meeting' }),
          requestedSeats: Math.max(0, Number(booking.requestedSeats) || 0),
          startDate: day,
          startTime: candidate.startHm,
          endTime: candidate.endHm,
          setupBufferBeforeMin: Math.max(0, Number(booking.setupBufferBeforeMin) || 0),
          setupBufferAfterMin: Math.max(0, Number(booking.setupBufferAfterMin) || 0),
          participants: Array.isArray(booking.participants) ? booking.participants : [],
          externalGuests: !!(booking as any).externalGuests,
          externalGuestsList: Array.isArray((booking as any).externalGuestsList) ? (booking as any).externalGuestsList : [],
          externalGuestsDetails: Array.isArray((booking as any).externalGuestsDetails) ? (booking as any).externalGuestsDetails : [],
          sendEmail: !!booking.sendEmail,
          technicalSetup: !!booking.technicalSetup,
          technicalEmail: String(booking.technicalEmail || ''),
          notes: String(booking.notes || ''),
          videoConferenceLink: String(booking.videoConferenceLink || ''),
          kioskLanguage: ((booking as any).kioskLanguage || null) as any
        });
      } catch (err: any) {
        failures.push(`${day}: ${String(err?.message || t({ it: 'Errore creazione', en: 'Creation failed' }))}`);
      }
    }
    if (failures.length) {
      setClientMeetingsDuplicateModal((prev) =>
        prev ? { ...prev, saving: false, error: failures.slice(0, 3).join(' • ') } : prev
      );
    } else {
      setClientMeetingsDuplicateModal(null);
    }
    await reloadClientMeetingsTimeline();
  };

  if (sidebarCollapsed) {
    return <SidebarTreeCollapsed {...{ toggleSidebar, t }} />;
  }

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      <SidebarTreeHeader {...{ treeQuery, setTreeQuery, allTreeExpanded, toggleSidebar, handleCollapseAll, handleExpandAll, t }} />
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
              ? client.sites.map((site) => (
                  <SidebarSiteNode
                    key={site.id}
                    {...{ site, client, searchActive, expandedSites, toggleSiteExpanded, setSiteMenu, selectedPlanId, locationPathname: location.pathname, defaultPlanId, lockedPlans, user, dragRef, shouldPromptUnsavedPlanSwitch, requestSaveAndNavigate, setSelectedPlan, navigate, setPlanMenu, setLockMenu, reorderFloorPlans, t }}
                  />
                ))
              : null}
          </div>
          );
        })}
      </div>
      <FooterInfo />

      {(planMenu || clientMenu || siteMenu) ? (
        <div ref={menuRef} className="fixed z-50">
          <SidebarPlanMenu {...{ planMenu, setPlanMenu, planMenuPhotoCount, planMenuSecurityVisible, defaultPlanId, clients, user, openCapacityDashboard, shouldPromptUnsavedPlanSwitch, requestSaveAndNavigate, setSelectedPlan, navigate, toggleSecurityCardVisibilityForPlan, updateMyProfile, updateFloorPlan, setClonePlan, setConfirmDelete, t }} />

          <SidebarClientMenu {...{ clientMenu, setClientMenu, clients, user, clientMenuRubricaOpen, setClientMenuRubricaOpen, canChatClientIds, chatUnreadByClientId, canOpenBusinessPartnersDirectory, importSummaryByClient, findFirstPlanForClient, setMissingPlansNotice, openCapacityDashboard, openClientMeetingsTimeline, openClientChat, setClientInfoId, setClientAttachmentsId, setClientIpMapId, setClientNotesId, setClientEmailSettingsId, setClientEmergencyId, setClientBusinessPartnersId, setClientDirectoryId, setConfirmDelete, t }} />

          <SidebarSiteMenu {...{ siteMenu, setSiteMenu, clients, user, isSuperAdmin, findFirstPlanForSite, setMissingPlansNotice, openCapacityDashboard, openFindCapacity, openClientMeetingsTimeline, setSiteSupportContactsModal, setSiteHoursModal, t }} />
        </div>
      ) : null}

      <SidebarLockMenu {...{ lockMenu, setLockMenu, lockMenuRef, user, isSuperAdmin, t }} />




      <SidebarSiteSupportContactsModal
        {...{ siteSupportContactsModal, setSiteSupportContactsModal, siteSupportContactsFocusRef, updateSite, t }}
      />

      <SidebarClientMeetingsModal
        {...{ clientMeetingsBookingDetail, clientMeetingsDetailCloseGuardUntilRef, clientMeetingsDuplicateModal, clientMeetingsError, clientMeetingsFocusRef, clientMeetingsHighlightBookingId, clientMeetingsLoading, clientMeetingsModal, clientMeetingsNowTs, clientMeetingsRows, clientMeetingsSearchActiveIndex, clientMeetingsSearchError, clientMeetingsSearchInputRef, clientMeetingsSearchLoading, clientMeetingsSearchResults, clientMeetingsSearchTerm, clientMeetingsTimelineContextMenu, clientMeetingsTimelineContextMenuRef, clientMeetingsTimelineMeta, closeClientMeetingsModal, jumpToClientTimelineMeeting, openClientMeetingDuplicateModal, reloadClientMeetingsTimeline, selectedClientForMeetings, setClientMeetingsBookingDetail, setClientMeetingsModal, setClientMeetingsRoomPreview, setClientMeetingsSearchActiveIndex, setClientMeetingsSearchError, setClientMeetingsSearchResults, setClientMeetingsSearchTerm, setClientMeetingsShowCheckInDetails, setClientMeetingsTimelineContextMenu, t }}
      />

      <SidebarClientMeetingsRoomPreviewModal
        {...{ clientMeetingsRoomPreview, clientMeetingsRoomPreviewFocusRef, setClientMeetingsRoomPreview, clientMeetingsPreviewData, t }}
      />

      <SidebarClientMeetingsBookingDetailModal
        {...{ clientMeetingsBookingDetail, clientMeetingsBookingDetailFocusRef, clientMeetingsCheckInStatusByMeetingId, clientMeetingsCheckInTimestampsByMeetingId, clientMeetingsDetailCloseGuardUntilRef, clientMeetingsDuplicateModal, clientMeetingsShowCheckInDetails, getClientMeetingCheckInEntries, getClientMeetingCheckInStats, openClientMeetingDuplicateModal, setClientMeetingsBookingDetail, setClientMeetingsNotesBooking, setClientMeetingsShowCheckInDetails, t }}
      />


      <SidebarClientMeetingsDuplicateModal
        {...{ clientMeetingsDuplicateModal, clientMeetingsDuplicateFocusRef, clientMeetingsDuplicateRoomPickerOpen, clientMeetingsDuplicateRoomPickerRef, saveClientMeetingDuplicates, setClientMeetingsDuplicateModal, setClientMeetingsDuplicateRoomPickerOpen, t }}
      />

      <ClientInfoModal
        open={!!clientInfoId}
        client={fullClient || undefined}
        canManageSiteHours={!!user?.isAdmin || !!isSuperAdmin}
        onOpenSiteHours={(siteId) => {
          const targetClient = fullClient;
          const targetSite = targetClient?.sites?.find((site: any) => String(site.id) === String(siteId));
          if (!targetClient || !targetSite) return;
          setSiteHoursModal({
            clientId: targetClient.id,
            clientName: targetClient.shortName || targetClient.name,
            siteId: targetSite.id,
            siteName: targetSite.name,
            siteSchedule: (targetSite as any).siteSchedule
          });
        }}
        onClose={() => setClientInfoId(null)}
      />
      <ClientBusinessPartnersModal
        open={!!clientBusinessPartnersId}
        client={businessPartnersClient || undefined}
        onClose={() => setClientBusinessPartnersId(null)}
        onSave={(businessPartners) => {
          if (!clientBusinessPartnersId) return;
          updateClient(clientBusinessPartnersId, { businessPartners } as any);
          setClientBusinessPartnersId(null);
        }}
      />
      <ClientEmailSettingsModal
        open={!!clientEmailSettingsId}
        clientId={clientEmailSettingsId}
        clientName={(emailClient as any)?.shortName || (emailClient as any)?.name || null}
        onClose={() => setClientEmailSettingsId(null)}
      />
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
      {clientMeetingsNotesBooking ? (
        <Suspense fallback={null}>
          <MeetingNotesModal
            open={!!clientMeetingsNotesBooking}
            meeting={clientMeetingsNotesBooking}
            suspendClose={!!clientMeetingsDuplicateModal}
            onClose={() => setClientMeetingsNotesBooking(null)}
            onOpenFollowUpScheduler={(booking, options) => {
              openClientMeetingDuplicateModal(booking, options);
            }}
          />
        </Suspense>
      ) : null}
      <EmergencyContactsModal
        open={!!clientEmergencyId}
        clientId={clientEmergencyId}
        readOnly={!canManageEmergencyDirectory}
        safetyCardVisible={emergencyModalSafetyVisible}
        onToggleSafetyCard={
          emergencyModalPlanId ? () => toggleSecurityCardVisibilityForPlan(emergencyModalPlanId) : undefined
        }
        safetyCardToggleDisabled={!emergencyModalPlanId}
        onClose={() => setClientEmergencyId(null)}
      />
      <SiteHoursModal
        open={!!siteHoursModal}
        clientName={siteHoursModal?.clientName || ''}
        siteName={siteHoursModal?.siteName || ''}
        currentSiteId={siteHoursModal?.siteId || ''}
        siblingSites={
          siteHoursModal
            ? (clients.find((client) => client.id === siteHoursModal.clientId)?.sites || []).map((site) => ({ id: site.id, name: site.name }))
            : []
        }
        initialSchedule={siteHoursModal?.siteSchedule}
        canApplyToOtherSites={!!user?.isAdmin || !!isSuperAdmin}
        onClose={() => setSiteHoursModal(null)}
        onSave={({ siteSchedule, applyToSiteIds }) => {
          if (!siteHoursModal) return;
          updateSite(siteHoursModal.siteId, { siteSchedule } as any);
          if ((user?.isAdmin || isSuperAdmin) && Array.isArray(applyToSiteIds)) {
            for (const siteId of applyToSiteIds) {
              if (!siteId || siteId === siteHoursModal.siteId) continue;
              updateSite(siteId, { siteSchedule } as any);
            }
          }
          pushToast(
            (user?.isAdmin || isSuperAdmin) && applyToSiteIds.length
              ? t({ it: 'Orari sede salvati e copiati sulle sedi selezionate', en: 'Site hours saved and copied to selected sites' })
              : t({ it: 'Orari sede salvati', en: 'Site hours saved' }),
            'success'
          );
          setSiteHoursModal(null);
        }}
      />

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
