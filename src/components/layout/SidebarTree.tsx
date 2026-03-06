import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { BarChart3, Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Clock3, Copy, Crop, Eye, EyeOff, FileText, FolderOpen, History, Hourglass, Image as ImageIcon, Info, Loader2, Mail, Map as MapIcon, MapPinned, MessageCircle, Network, Paperclip, PhoneCall, Plus, Search, ShieldAlert, Star, Trash, Users, X } from 'lucide-react';
import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { PLIXMAP_WEBSITE_URL } from '../../constants/links';
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
const UNLOCK_REQUEST_EVENT = 'plixmap_unlock_request';
const FORCE_UNLOCK_EVENT = 'plixmap_force_unlock';
const OPEN_CLIENT_MEETINGS_EVENT = 'plixmap_open_client_meetings';
const OPEN_MEETING_CENTER_EVENT = 'plixmap_open_meeting_center';
const OPEN_MY_MEETINGS_EVENT = 'plixmap_open_my_meetings';
const OPEN_MEETING_MANAGER_EVENT = 'plixmap_open_meeting_manager';

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

const toEpochMs = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const roomPolygonPoints = (room: any): Array<{ x: number; y: number }> => {
  const shape = (room as any)?.shape || null;
  if (shape?.kind === 'poly' && Array.isArray(shape.points)) {
    return shape.points
      .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  if (Array.isArray((room as any)?.points)) {
    return (room as any).points
      .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  const rect =
    shape?.kind === 'rect'
      ? { x: Number(shape?.x), y: Number(shape?.y), width: Number(shape?.width), height: Number(shape?.height) }
      : {
          x: Number((room as any)?.x),
          y: Number((room as any)?.y),
          width: Number((room as any)?.width),
          height: Number((room as any)?.height)
        };
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return [];
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
};

const polygonCenter = (points: Array<{ x: number; y: number }>): { x: number; y: number } | null => {
  if (!Array.isArray(points) || points.length < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += Number(p.x) || 0;
    sumY += Number(p.y) || 0;
  }
  return { x: sumX / points.length, y: sumY / points.length };
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shiftIsoDay = (isoDay: string, deltaDays: number) => {
  const base = String(isoDay || '').trim() || todayIso();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), Number.isFinite(m) ? m - 1 : 0, Number.isFinite(d) ? d : 1);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const monthAnchorFromIso = (iso: string) => {
  const d = new Date(`${String(iso || '').trim() || todayIso()}T00:00:00`);
  if (!Number.isFinite(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const shiftMonthAnchor = (anchorIso: string, deltaMonths: number) => {
  const d = new Date(`${String(anchorIso || '').trim() || monthAnchorFromIso(todayIso())}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return monthAnchorFromIso(todayIso());
  d.setMonth(d.getMonth() + deltaMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const timeHmFromTs = (value: number) => {
  const d = new Date(Number(value || 0));
  if (!Number.isFinite(d.getTime())) return '00:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const hmToMinutes = (hm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!m) return 0;
  const h = Math.max(0, Math.min(23, Number(m[1]) || 0));
  const mm = Math.max(0, Math.min(59, Number(m[2]) || 0));
  return h * 60 + mm;
};

const minutesToHm = (totalMinutes: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(Number(totalMinutes) || 0)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const localTsFromIsoHm = (isoDay: string, hm: string): number | null => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!dm || !tm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]) - 1;
  const da = Number(dm[3]);
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (![y, mo, da, hh, mm].every(Number.isFinite)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const dt = new Date(y, mo, da, hh, mm, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt.getTime() : null;
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
    (s) => ({
      deleteClient: s.deleteClient,
      deleteFloorPlan: s.deleteFloorPlan,
      reorderFloorPlans: s.reorderFloorPlans
    }),
    shallow
  );
  const updateFloorPlan = useDataStore((s) => s.updateFloorPlan);
  const updateSite = useDataStore((s) => s.updateSite);
  const cloneFloorPlan = useDataStore((s) => (s as any).cloneFloorPlan);
  const pushToast = useToastStore((s) => s.push);
  const { dataVersion, savedDataVersion } = useDataStore(
    (s) => ({ dataVersion: s.version, savedDataVersion: s.savedVersion }),
    shallow
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
      chatUnreadByClientId: (s as any).chatUnreadByClientId || {},
      visibleLayerIdsByPlan: (s as any).visibleLayerIdsByPlan || {},
      hiddenLayersByPlan: (s as any).hiddenLayersByPlan || {},
      setVisibleLayerIds: (s as any).setVisibleLayerIds,
      setHideAllLayers: (s as any).setHideAllLayers
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

  const boolBadge = (value: boolean) => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        value ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {value ? t({ it: 'Sì', en: 'Yes' }) : t({ it: 'No', en: 'No' })}
    </span>
  );
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

  const clientMeetingsPreviewData = useMemo(() => {
    if (!clientMeetingsRoomPreview || !selectedClientForMeetingsFull) return null;
    const site = (selectedClientForMeetingsFull.sites || []).find((s: any) => String(s.id) === String(clientMeetingsRoomPreview.siteId));
    if (!site) return null;
    const plan = (site.floorPlans || []).find((p: any) => String(p.id) === String(clientMeetingsRoomPreview.floorPlanId));
    if (!plan) return null;
    const rooms = (plan.rooms || [])
      .map((room: any) => {
        const points = roomPolygonPoints(room);
        return {
          id: String(room?.id || ''),
          name: String(room?.name || ''),
          meetingRoom: !!(room as any)?.meetingRoom,
          points,
          center: polygonCenter(points)
        };
      })
      .filter((room: any) => room.id && room.points.length >= 3);
    if (!rooms.length) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const room of rooms) {
      for (const point of room.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const pad = Math.max(20, Math.min(width, height) * 0.05);
    const imgW = Number((plan as any)?.width || 0);
    const imgH = Number((plan as any)?.height || 0);
    return {
      clientName: selectedClientForMeetingsFull.shortName || selectedClientForMeetingsFull.name || '',
      siteName: String(site.name || ''),
      planName: String(plan.name || ''),
      roomId: String(clientMeetingsRoomPreview.roomId),
      rooms,
      planImageUrl: String((plan as any)?.imageUrl || ''),
      planWidth: imgW > 0 ? imgW : width + pad * 2,
      planHeight: imgH > 0 ? imgH : height + pad * 2,
      planImageX: imgW > 0 ? 0 : minX - pad,
      planImageY: imgH > 0 ? 0 : minY - pad,
      viewBox: imgW > 0 && imgH > 0 ? `0 0 ${imgW} ${imgH}` : `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`
    };
  }, [clientMeetingsRoomPreview, selectedClientForMeetingsFull]);

  const meetingCheckInEntryKey = (entry: { tag?: string | null; label?: string | null; email?: string | null }) => {
    const tag = String(entry.tag || 'INT');
    const label = String(entry.label || '-').trim().toLowerCase();
    const email = String(entry.email || '').trim().toLowerCase();
    return `${tag}::${label}::${email}`;
  };

  const getClientMeetingCheckInStats = (booking: MeetingBooking, checkMap?: Record<string, true> | null) => {
    const participants = Array.isArray(booking?.participants) ? booking.participants : [];
    const internalOnSite = participants
      .filter((p: any) => (p?.kind || 'real_user') !== 'manual' && !p?.remote)
      .map((p: any) => ({
        tag: p?.optional ? 'OPT' : 'INT',
        label: String(p?.fullName || p?.externalId || '-'),
        email: p?.email ? String(p.email) : null
      }));
    const manualOnSiteFromParticipants = participants
      .filter((p: any) => p?.kind === 'manual' && !p?.remote)
      .map((p: any) => ({
        tag: 'EXT',
        label: String(p?.fullName || p?.externalId || '-'),
        email: p?.email ? String(p.email) : null
      }));
    const manualSeen = new Set(
      manualOnSiteFromParticipants.map((g) => `${String(g.label || '').trim().toLowerCase()}::${String(g.email || '').trim().toLowerCase()}`)
    );
    const externalOnSiteLegacy = (Array.isArray((booking as any)?.externalGuestsDetails) ? (booking as any).externalGuestsDetails : [])
      .filter((g: any) => !g?.remote)
      .filter(
        (g: any) =>
          !manualSeen.has(`${String(g?.name || '').trim().toLowerCase()}::${String(g?.email || '').trim().toLowerCase()}`)
      )
      .map((g: any) => ({
        tag: 'EXT',
        label: String(g?.name || '-'),
        email: g?.email ? String(g.email) : null
      }));
    const entries = [...internalOnSite, ...manualOnSiteFromParticipants, ...externalOnSiteLegacy];
    const map = checkMap || {};
    const checked = entries.filter((e) => !!map[meetingCheckInEntryKey(e)]).length;
    const total = entries.length;
    const remoteInternal = participants.filter((p: any) => (p?.kind || 'real_user') !== 'manual' && !!p?.remote).length;
    const manualRemoteKeys = new Set(
      participants
        .filter((p: any) => p?.kind === 'manual' && !!p?.remote)
        .map(
          (p: any) =>
            `${String(p?.fullName || p?.externalId || '-').trim().toLowerCase()}::${String(p?.email || '').trim().toLowerCase()}`
        )
    );
    const remoteExternalLegacy = (Array.isArray((booking as any)?.externalGuestsDetails) ? (booking as any).externalGuestsDetails : [])
      .filter((g: any) => !!g?.remote)
      .filter(
        (g: any) =>
          !manualRemoteKeys.has(`${String(g?.name || '').trim().toLowerCase()}::${String(g?.email || '').trim().toLowerCase()}`)
      ).length;
    return {
      checked,
      total,
      percent: total > 0 ? Math.round((checked / total) * 100) : 0,
      remoteParticipants: remoteInternal + remoteExternalLegacy,
      internalOnSite: internalOnSite.length,
      externalOnSite: manualOnSiteFromParticipants.length + externalOnSiteLegacy.length
    };
  };

  const getClientMeetingCheckInEntries = (
    booking: MeetingBooking,
    checkMap?: Record<string, true> | null,
    tsMap?: Record<string, number> | null
  ) => {
    const checked = checkMap || {};
    const timestamps = tsMap || {};
    const clientLogo = String((selectedClientForMeetingsFull as any)?.logoUrl || '').trim() || null;
    const businessPartners = Array.isArray((selectedClientForMeetingsFull as any)?.businessPartners)
      ? (((selectedClientForMeetingsFull as any).businessPartners as any[]) || [])
      : [];
    const businessPartnerByName = new Map<string, any>();
    for (const bp of businessPartners) {
      const key = String(bp?.name || '').trim().toLowerCase();
      if (!key) continue;
      businessPartnerByName.set(key, bp);
    }
    const participants = Array.isArray(booking?.participants) ? booking.participants : [];
    const internal = participants
      .filter((p: any) => (p?.kind || 'real_user') !== 'manual' && !p?.remote)
      .map((p: any) => {
        const label = String(p?.fullName || p?.externalId || '-').trim() || '-';
        const email = p?.email ? String(p.email).trim() : '';
        const entryKey = meetingCheckInEntryKey({ tag: p?.optional ? 'OPT' : 'INT', label, email });
        return {
          key: entryKey,
          checked: !!checked[entryKey],
          checkedAt: Number(timestamps[entryKey] || 0) || null,
          label,
          company: (selectedClientForMeetingsFull as any)?.shortName || (selectedClientForMeetingsFull as any)?.name || null,
          email: email || null,
          logoUrl: clientLogo,
          kind: 'internal' as const
        };
      });
    const manualSeen = new Set<string>();
    const externalsFromParticipants = participants
      .filter((p: any) => p?.kind === 'manual' && !p?.remote)
      .map((p: any) => {
        const label = String(p?.fullName || p?.externalId || '-').trim() || '-';
        const email = p?.email ? String(p.email).trim() : '';
        const company = String((p as any)?.company || '').trim();
        const identity = `${label.toLowerCase()}::${email.toLowerCase()}`;
        manualSeen.add(identity);
        const entryKey = meetingCheckInEntryKey({ tag: 'EXT', label, email });
        const bp = businessPartnerByName.get(company.toLowerCase());
        return {
          key: entryKey,
          checked: !!checked[entryKey],
          checkedAt: Number(timestamps[entryKey] || 0) || null,
          label,
          company: company || null,
          email: email || null,
          logoUrl: String(bp?.logoUrl || '').trim() || null,
          kind: 'external' as const
        };
      });
    const externalsLegacy = (Array.isArray((booking as any)?.externalGuestsDetails) ? (booking as any).externalGuestsDetails : [])
      .filter((g: any) => !g?.remote)
      .map((g: any) => {
        const label = String(g?.name || '-').trim() || '-';
        const email = g?.email ? String(g.email).trim() : '';
        const company = String((g as any)?.company || '').trim();
        const identity = `${label.toLowerCase()}::${email.toLowerCase()}`;
        if (manualSeen.has(identity)) return null;
        const entryKey = meetingCheckInEntryKey({ tag: 'EXT', label, email });
        const bp = businessPartnerByName.get(company.toLowerCase());
        return {
          key: entryKey,
          checked: !!checked[entryKey],
          checkedAt: Number(timestamps[entryKey] || 0) || null,
          label,
          company: company || null,
          email: email || null,
          logoUrl: String(bp?.logoUrl || '').trim() || null,
          kind: 'external' as const
        };
      })
      .filter(Boolean) as Array<any>;
    return [...internal, ...externalsFromParticipants, ...externalsLegacy]
      .filter((row) => row.checked)
      .sort((a, b) => Number(b.checkedAt || 0) - Number(a.checkedAt || 0));
  };

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

  const resolveClientDuplicateSlot = useCallback((
    booking: MeetingBooking,
    dayIso: string,
    timeMode: 'same' | 'any_08_18' | 'custom' = 'same'
  ): { startHm: string; endHm: string; startMin: number; endMin: number } | null => {
    const startTs = Number(booking.startAt || 0);
    const endTs = Number(booking.endAt || 0);
    const sourceStartHm = timeHmFromTs(startTs);
    const sourceStartMin = hmToMinutes(sourceStartHm);
    const durationMinRaw = Math.round((endTs - startTs) / 60_000);
    const durationMin = Math.max(1, Number.isFinite(durationMinRaw) ? durationMinRaw : 60);
    let startMin = timeMode === 'same' ? sourceStartMin : 0;
    if (dayIso === todayIso()) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      startMin = Math.max(startMin, nowMin);
    }
    const endMin = startMin + durationMin;
    if (endMin > 23 * 60 + 59) return null;
    return { startHm: minutesToHm(startMin), endHm: minutesToHm(endMin), startMin, endMin };
  }, []);

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
    return (
      <aside className="flex h-screen w-14 flex-col items-center gap-4 border-r border-slate-200 bg-white py-4">
        <a
          href={PLIXMAP_WEBSITE_URL}
          target="_blank"
          rel="noreferrer"
          className="h-[3.75rem] w-[3.75rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
          title={t({ it: 'Apri sito ufficiale Plixmap', en: 'Open official Plixmap website' })}
        >
          <img
            src="/plixmap-logo.png"
            alt="Plixmap"
            className="h-full w-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.endsWith('/favicon.svg')) return;
              target.src = '/favicon.svg';
            }}
          />
        </a>
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
        <a
          href={PLIXMAP_WEBSITE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-lg font-semibold text-ink"
          title={t({ it: 'Apri sito ufficiale Plixmap', en: 'Open official Plixmap website' })}
        >
          <span className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <img
              src="/plixmap-logo.png"
              alt="Plixmap"
              className="h-full w-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('/favicon.svg')) return;
                target.src = '/favicon.svg';
              }}
            />
          </span>
          Plixmap
        </a>
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
          onClick={allTreeExpanded ? handleCollapseAll : handleExpandAll}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          title={
            allTreeExpanded
              ? t({ it: 'Compatta tutti i clienti e le sedi', en: 'Collapse all clients and sites' })
              : t({ it: 'Espandi tutti i clienti e le sedi', en: 'Expand all clients and sites' })
          }
        >
          {allTreeExpanded ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
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
                  const target = findFirstPlanForClient(clientMenu.clientId);
                  if (!target) {
                    const label = clients.find((c) => c.id === clientMenu.clientId)?.shortName || clients.find((c) => c.id === clientMenu.clientId)?.name || clientMenu.clientId;
                    setMissingPlansNotice({ clientName: label });
                    setClientMenu(null);
                    return;
                  }
                  openCapacityDashboard(target.planId, { clientId: clientMenu.clientId, siteId: target.siteId }, { keepCurrentPlan: true });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri dashboard capienza', en: 'Open capacity dashboard' })}
              >
                <BarChart3 size={14} className="text-slate-600" />
                {t({ it: 'Dashboard capienza', en: 'Capacity dashboard' })}
              </button>
              <button
                onClick={() => {
                  openClientMeetingsTimeline(clientMenu.clientId);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Mostra timeline meetings del cliente', en: 'Show client meetings timeline' })}
              >
                <CalendarDays size={14} className="text-slate-600" />
                {t({ it: 'Mostra meetings', en: 'Show meetings' })}
              </button>
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
                  setClientMenuRubricaOpen(false);
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
                  setClientMenuRubricaOpen(false);
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
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri la mappa IP del cliente', en: 'Open the client IP map' })}
              >
                <Network size={14} className="text-slate-500" />
                {t({ it: 'IP Map', en: 'IP Map' })}
              </button>
              <button
                onClick={() => {
                  setClientNotesId(clientMenu.clientId);
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Aggiungi note formattate per questo cliente', en: 'Add formatted notes for this client' })}
              >
                <FileText size={14} className="text-slate-500" />
                {t({ it: 'Note cliente', en: 'Client notes' })}
              </button>
              <button
                onClick={() => {
                  setClientEmailSettingsId(clientMenu.clientId);
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Configura SMTP per questo cliente', en: 'Configure SMTP for this client' })}
              >
                <Mail size={14} className="text-slate-500" />
                {t({ it: 'SMTP cliente', en: 'Client SMTP' })}
              </button>
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50">
                <button
                  onClick={() => setClientMenuRubricaOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100"
                  title={t({ it: 'Apri le rubriche del cliente', en: 'Open client directories' })}
                >
                  <FolderOpen size={14} className="text-slate-500" />
                  <span>{t({ it: 'Rubrica', en: 'Directory' })}</span>
                  <ChevronRight size={14} className={`ml-auto text-slate-500 transition-transform ${clientMenuRubricaOpen ? 'rotate-90' : ''}`} />
                </button>
                {clientMenuRubricaOpen ? (
                  <div className="border-t border-slate-200 px-1 py-1">
                    <button
                      onClick={() => {
                        setClientEmergencyId(clientMenu.clientId);
                        setClientMenuRubricaOpen(false);
                        setClientMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white"
                      title={t({ it: 'Rubrica emergenze', en: 'Emergency directory' })}
                    >
                      <ShieldAlert size={14} className="text-rose-600" />
                      {t({ it: 'Emergenze', en: 'Emergencies' })}
                    </button>
                    {canOpenBusinessPartnersDirectory ? (
                      <button
                        onClick={() => {
                          setClientBusinessPartnersId(clientMenu.clientId);
                          setClientMenuRubricaOpen(false);
                          setClientMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white"
                        title={t({ it: 'Rubrica Business Partner', en: 'Business partner directory' })}
                      >
                        <Building2 size={14} className="text-slate-600" />
                        {t({ it: 'Business partner', en: 'Business partners' })}
                      </button>
                    ) : null}
                    {importSummaryByClient[clientMenu.clientId]?.lastImportAt ? (
                      <button
                        onClick={() => {
                          setClientDirectoryId(clientMenu.clientId);
                          setClientMenuRubricaOpen(false);
                          setClientMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white"
                        title={t({ it: 'Apri la rubrica utenti importati', en: 'Open the imported users directory' })}
                      >
                        <Users size={14} className="text-slate-500" />
                        {t({ it: 'Utenti', en: 'Users' })}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {user?.isAdmin ? (
                <button
                  onClick={() => {
                    const label = clients.find((c) => c.id === clientMenu.clientId)?.name || clientMenu.clientId;
                    setConfirmDelete({ kind: 'client', id: clientMenu.clientId, label });
                    setClientMenuRubricaOpen(false);
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
              <button
                onClick={() => {
                  const targetPlanId = findFirstPlanForSite(siteMenu.clientId, siteMenu.siteId);
                  if (!targetPlanId) {
                    const clientLabel = clients.find((c) => c.id === siteMenu.clientId)?.shortName || clients.find((c) => c.id === siteMenu.clientId)?.name || siteMenu.siteName;
                    setMissingPlansNotice({ clientName: clientLabel });
                    setSiteMenu(null);
                    return;
                  }
                  openCapacityDashboard(targetPlanId, { clientId: siteMenu.clientId, siteId: siteMenu.siteId });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri dashboard capienza', en: 'Open capacity dashboard' })}
              >
                <BarChart3 size={14} className="text-slate-600" />
                {t({ it: 'Dashboard capienza', en: 'Capacity dashboard' })}
              </button>
              <button
                onClick={() => {
                  const targetPlanId = findFirstPlanForSite(siteMenu.clientId, siteMenu.siteId);
                  if (!targetPlanId) {
                    const clientLabel = clients.find((c) => c.id === siteMenu.clientId)?.shortName || clients.find((c) => c.id === siteMenu.clientId)?.name || siteMenu.siteName;
                    setMissingPlansNotice({ clientName: clientLabel });
                    setSiteMenu(null);
                    return;
                  }
                  openFindCapacity(targetPlanId, { clientId: siteMenu.clientId, siteId: siteMenu.siteId });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Trova capienza', en: 'Find capacity' })}
              >
                <Users size={14} className="text-slate-600" />
                {t({ it: 'Trova capienza', en: 'Find capacity' })}
              </button>
              <button
                onClick={() => openClientMeetingsTimeline(siteMenu.clientId, siteMenu.siteId, true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Mostra meetings della sede', en: 'Show meetings for this site' })}
              >
                <CalendarDays size={14} className="text-slate-600" />
                {t({ it: 'Mostra meetings', en: 'Show meetings' })}
              </button>
              <button
                onClick={() => {
                  const clientLabel =
                    clients.find((c) => c.id === siteMenu.clientId)?.shortName ||
                    clients.find((c) => c.id === siteMenu.clientId)?.name ||
                    '-';
                  setSiteSupportContactsModal({
                    clientId: siteMenu.clientId,
                    siteId: siteMenu.siteId,
                    clientName: clientLabel,
                    siteName: siteMenu.siteName,
                    supportContacts: siteMenu.supportContacts
                  });
                  setSiteMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Mostra contatti utili della sede', en: 'Show site useful contacts' })}
              >
                <PhoneCall size={14} className="text-slate-600" />
                {t({ it: 'Contatti utili', en: 'Useful contacts' })}
              </button>
              {(user?.isAdmin || isSuperAdmin) ? (
                <button
                  onClick={() => {
                    const clientEntry = clients.find((entry) => entry.id === siteMenu.clientId);
                    setSiteHoursModal({
                      clientId: siteMenu.clientId,
                      clientName: clientEntry?.shortName || clientEntry?.name || '-',
                      siteId: siteMenu.siteId,
                      siteName: siteMenu.siteName,
                      siteSchedule: siteMenu.siteSchedule
                    });
                    setSiteMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                  title={t({ it: 'Configura orari e festivi della sede', en: 'Configure site hours and holidays' })}
                >
                  <Clock3 size={14} className="text-cyan-700" />
                  {t({ it: 'Orari sede', en: 'Site hours' })}
                </button>
              ) : null}
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
                  const detail = {
                    planId: lockMenu.planId,
                    planName: lockMenu.planName,
                    clientName: lockMenu.clientName,
                    siteName: lockMenu.siteName,
                    userId: lockMenu.userId,
                    username: lockMenu.username,
                    avatarUrl: lockMenu.avatarUrl || ''
                  };
                  window.dispatchEvent(new CustomEvent(UNLOCK_REQUEST_EVENT, { detail }));
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
                    const detail = {
                      planId: lockMenu.planId,
                      planName: lockMenu.planName,
                      clientName: lockMenu.clientName,
                      siteName: lockMenu.siteName,
                      userId: lockMenu.userId,
                      username: lockMenu.username,
                      avatarUrl: lockMenu.avatarUrl || ''
                    };
                    window.dispatchEvent(new CustomEvent(FORCE_UNLOCK_EVENT, { detail }));
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

          <Transition show={!!siteSupportContactsModal} as={Fragment}>
            <Dialog
              as="div"
              className="relative z-[90]"
              onClose={() => setSiteSupportContactsModal(null)}
              initialFocus={siteSupportContactsFocusRef}
            >
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
              </Transition.Child>
              <div className="fixed inset-0 overflow-y-auto p-4">
                <div className="flex min-h-full items-center justify-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-150"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-100"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-[68rem] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                        <div>
                          <Dialog.Title className="text-lg font-semibold text-ink">
                            {t({ it: 'Contatti utili sede', en: 'Site useful contacts' })}
                          </Dialog.Title>
                          <div className="text-xs text-slate-500">
                            {`${siteSupportContactsModal?.clientName || '-'} • ${siteSupportContactsModal?.siteName || '-'}`}
                          </div>
                        </div>
                        <button
                          ref={siteSupportContactsFocusRef}
                          type="button"
                          onClick={() => setSiteSupportContactsModal(null)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                          title={t({ it: 'Chiudi', en: 'Close' })}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                          { key: 'cleaning', label: t({ it: 'Cleaning service', en: 'Cleaning service' }), contact: siteSupportContactsModal?.supportContacts?.cleaning },
                          { key: 'it', label: t({ it: 'IT Service', en: 'IT Service' }), contact: siteSupportContactsModal?.supportContacts?.it },
                          { key: 'coffee', label: t({ it: 'Coffee service', en: 'Coffee service' }), contact: siteSupportContactsModal?.supportContacts?.coffee }
                        ].map((row) => (
                          <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-sm font-semibold text-slate-700">{row.label}</div>
                            <div className="mt-2 space-y-2">
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                                <div className="font-semibold text-slate-500">Email</div>
                                <input
                                  type="email"
                                  value={String(row.contact?.email || '')}
                                  onChange={(e) =>
                                    setSiteSupportContactsModal((prev) =>
                                      !prev
                                        ? prev
                                        : {
                                            ...prev,
                                            supportContacts: {
                                              ...(prev.supportContacts || {}),
                                              [row.key]: {
                                                ...((prev.supportContacts as any)?.[row.key] || {}),
                                                email: e.target.value
                                              }
                                            }
                                          }
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-primary"
                                  placeholder="email@example.com"
                                />
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                                <div className="font-semibold text-slate-500">{t({ it: 'Telefono', en: 'Phone' })}</div>
                                <input
                                  type="text"
                                  value={String(row.contact?.phone || '')}
                                  onChange={(e) =>
                                    setSiteSupportContactsModal((prev) =>
                                      !prev
                                        ? prev
                                        : {
                                            ...prev,
                                            supportContacts: {
                                              ...(prev.supportContacts || {}),
                                              [row.key]: {
                                                ...((prev.supportContacts as any)?.[row.key] || {}),
                                                phone: e.target.value
                                              }
                                            }
                                          }
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-primary"
                                  placeholder="+39..."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!siteSupportContactsModal) return;
                            updateSite(siteSupportContactsModal.siteId, {
                              supportContacts: siteSupportContactsModal.supportContacts || {}
                            } as any);
                            setSiteSupportContactsModal(null);
                          }}
                          className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                          title={t({ it: 'Salva contatti utili', en: 'Save support contacts' })}
                        >
                          {t({ it: 'Salva', en: 'Save' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSiteSupportContactsModal(null)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t({ it: 'Chiudi', en: 'Close' })}
                        </button>
                      </div>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>

      <Transition show={!!clientMeetingsModal && !clientMeetingsDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[90]"
          initialFocus={clientMeetingsFocusRef}
          onClose={() => {
            if (clientMeetingsBookingDetail) return;
            if (Date.now() < clientMeetingsDetailCloseGuardUntilRef.current) return;
            closeClientMeetingsModal();
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[1480px] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Mostra meetings', en: 'Show meetings' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {selectedClientForMeetings ? (selectedClientForMeetings.shortName || selectedClientForMeetings.name) : '-'}
                      </div>
                    </div>
                    <button
                      ref={clientMeetingsFocusRef}
                      type="button"
                      onClick={closeClientMeetingsModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[340px,260px,minmax(0,1fr),auto]">
                    <label className="text-xs font-semibold text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={13} /> {t({ it: 'Data', en: 'Date' })}
                      </span>
                      <div className="mt-1 grid grid-cols-[24px,1fr,24px] items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setClientMeetingsModal((prev) =>
                              prev ? { ...prev, day: shiftIsoDay(prev.day || todayIso(), -1) } : prev
                            )
                          }
                          className="inline-flex h-[24px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Giorno precedente', en: 'Previous day' })}
                        >
                            <ChevronLeft size={11} />
                        </button>
                        <input
                          type="date"
                          value={clientMeetingsModal?.day || todayIso()}
                          onChange={(e) =>
                            setClientMeetingsModal((prev) => (prev ? { ...prev, day: e.target.value || todayIso() } : prev))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setClientMeetingsModal((prev) =>
                              prev ? { ...prev, day: shiftIsoDay(prev.day || todayIso(), 1) } : prev
                            )
                          }
                          className="inline-flex h-[24px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Giorno successivo', en: 'Next day' })}
                        >
                            <ChevronRight size={11} />
                        </button>
                      </div>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      {t({ it: 'Sede', en: 'Site' })}
                      <select
                        value={clientMeetingsModal?.siteId || 'all'}
                        disabled={!!clientMeetingsModal?.siteLocked}
                        onChange={(e) =>
                          setClientMeetingsModal((prev) =>
                            prev ? { ...prev, siteId: (e.target.value as string) || 'all' } : prev
                          )
                        }
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                          clientMeetingsModal?.siteLocked
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <option value="all">{t({ it: 'Tutte le sedi', en: 'All sites' })}</option>
                        {(selectedClientForMeetings?.sites || []).map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="relative">
                      <label className="text-xs font-semibold text-slate-600">
                        {t({ it: 'Ricerca meeting (ID o titolo)', en: 'Search meeting (ID or title)' })}
                      </label>
                      <div className="relative mt-1">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={clientMeetingsSearchInputRef}
                          value={clientMeetingsSearchTerm}
                          onChange={(e) => {
                            setClientMeetingsSearchTerm(e.target.value);
                            setClientMeetingsSearchActiveIndex(-1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setClientMeetingsSearchActiveIndex((prev) =>
                                Math.min((clientMeetingsSearchResults.length || 1) - 1, Math.max(0, prev + 1))
                              );
                              return;
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setClientMeetingsSearchActiveIndex((prev) => Math.max(0, prev <= 0 ? 0 : prev - 1));
                              return;
                            }
                            if (e.key === 'Enter') {
                              const candidate = clientMeetingsSearchResults[clientMeetingsSearchActiveIndex];
                              if (candidate) {
                                e.preventDefault();
                                jumpToClientTimelineMeeting(candidate);
                              }
                              return;
                            }
                            if (e.key === 'Escape') {
                              setClientMeetingsSearchTerm('');
                              setClientMeetingsSearchResults([]);
                              setClientMeetingsSearchActiveIndex(-1);
                              setClientMeetingsSearchError(null);
                            }
                          }}
                          placeholder={t({ it: 'Es. #104 o Budget review', en: 'e.g. #104 or Budget review' })}
                          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                        />
                        {clientMeetingsSearchLoading ? (
                          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                        ) : null}
                      </div>
                      {String(clientMeetingsSearchTerm || '').trim() ? (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {clientMeetingsSearchError ? (
                            <div className="px-3 py-2 text-xs font-semibold text-rose-600">{clientMeetingsSearchError}</div>
                          ) : null}
                          {!clientMeetingsSearchLoading && !clientMeetingsSearchError && !clientMeetingsSearchResults.length ? (
                            <div className="px-3 py-2 text-xs text-slate-500">{t({ it: 'Nessun risultato.', en: 'No results.' })}</div>
                          ) : null}
                          {clientMeetingsSearchResults.map((row, index) => {
                            const isActive = index === clientMeetingsSearchActiveIndex;
                            const meetingNumber = Number((row.booking as any)?.meetingNumber || 0);
                            const startAt = Number(row.booking.startAt || 0);
                            const endAt = Number(row.booking.endAt || 0);
                            return (
                              <button
                                key={`client-meetings-search-${row.booking.id}`}
                                type="button"
                                onMouseEnter={() => setClientMeetingsSearchActiveIndex(index)}
                                onClick={() => jumpToClientTimelineMeeting(row)}
                                className={`block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
                                  isActive ? 'bg-sky-50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                                  <span className="truncate">
                                    {meetingNumber > 0 ? `#${meetingNumber} • ` : ''}
                                    {row.booking.subject || t({ it: 'Meeting', en: 'Meeting' })}
                                  </span>
                                  <span className="shrink-0 text-slate-500">
                                    {new Date(startAt).toLocaleDateString()} •{' '}
                                    {new Date(startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-
                                    {new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  {row.siteName}
                                  {row.floorPlanName ? ` • ${row.floorPlanName}` : ''} • {row.roomName} • {t({ it: 'Partecipanti', en: 'Participants' })}:{' '}
                                  {row.participantsCount}
                                  {row.participantsLabel && row.participantsLabel !== '-' ? ` • ${row.participantsLabel}` : ''}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const selectedSiteId =
                            clientMeetingsModal?.siteId && clientMeetingsModal.siteId !== 'all'
                              ? String(clientMeetingsModal.siteId)
                              : String(selectedClientForMeetings?.sites?.[0]?.id || '');
                          const selectedSite =
                            (selectedClientForMeetings?.sites || []).find((entry) => String(entry.id) === selectedSiteId) ||
                            selectedClientForMeetings?.sites?.[0];
                          const selectedPlanId = String(selectedSite?.floorPlans?.[0]?.id || '');
                          setClientMeetingsModal(null);
                          window.dispatchEvent(
                            new CustomEvent(OPEN_MEETING_MANAGER_EVENT, {
                              detail: {
                                clientId: clientMeetingsModal?.clientId,
                                siteId: selectedSiteId,
                                floorPlanId: selectedPlanId,
                                day: clientMeetingsModal?.day || todayIso()
                              }
                            })
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        title={t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      >
                        <Plus size={14} />
                        {t({ it: 'Nuovo meeting', en: 'New meeting' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => reloadClientMeetingsTimeline()}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {clientMeetingsLoading ? t({ it: 'Aggiornamento...', en: 'Refreshing...' }) : t({ it: 'Aggiorna', en: 'Refresh' })}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {clientMeetingsError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {clientMeetingsError}
                      </div>
                    ) : null}
                    {!clientMeetingsError && !clientMeetingsRows.length && !clientMeetingsLoading ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                        {t({ it: 'Nessuna meeting room trovata per il filtro selezionato.', en: 'No meeting rooms found for the selected filter.' })}
                      </div>
                    ) : null}
                    {!clientMeetingsError && clientMeetingsRows.length ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="grid grid-cols-[240px,1fr] border-b border-slate-200 bg-slate-50">
                          <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t({ it: 'Meeting room', en: 'Meeting room' })}
                          </div>
                          <div className="relative overflow-hidden px-0 py-2">
                            <div className="relative h-10">
                              {clientMeetingsTimelineMeta.hours.map((minute) => {
                                const total = Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes);
                                const leftPct = ((minute - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                return (
                                  <div key={`h-${minute}`} className="absolute inset-y-0" style={{ left: `${leftPct}%` }}>
                                    <div className="h-full border-l border-slate-200" />
                                  </div>
                                );
                              })}
                              {clientMeetingsTimelineMeta.hours.slice(0, -1).map((minute) => {
                                const total = Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes);
                                const centerMinute = Math.min(clientMeetingsTimelineMeta.maxMinutes, minute + 30);
                                const leftPct = ((centerMinute - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                return (
                                  <div
                                    key={`hl-${minute}`}
                                    className="absolute top-1 -translate-x-1/2 text-center text-[11px] font-semibold text-slate-500"
                                    style={{ left: `${leftPct}%`, width: '70px' }}
                                  >
                                    {`${String(Math.floor(minute / 60)).padStart(2, '0')}:00`}
                                  </div>
                                );
                              })}
                              {clientMeetingsTimelineMeta.showNowLine ? (
                                  <div
                                    className="absolute inset-y-0 z-10"
                                    style={{
                                    left: `${((clientMeetingsTimelineMeta.nowMinutes - clientMeetingsTimelineMeta.minMinutes) /
                                      Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes)) * 100}%`
                                  }}
                                >
                                  <div className="absolute top-7 left-0 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                    {t({ it: 'ORA', en: 'NOW' })}
                                  </div>
                                  <div className="h-full border-l-2 border-blue-500/70" />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="max-h-[56vh] overflow-auto">
                          {clientMeetingsRows.map((row) => {
                            const total = Math.max(1, clientMeetingsTimelineMeta.maxMinutes - clientMeetingsTimelineMeta.minMinutes);
                            const nowTs = clientMeetingsNowTs;
                            const roomHasInProgress = (row.bookings || []).some((booking) => {
                              const startTs = toEpochMs((booking as any).startAt);
                              const endTs = toEpochMs((booking as any).endAt);
                              return startTs > 0 && startTs <= nowTs && nowTs < endTs && booking.status === 'approved';
                            });
                            const roomTone = roomHasInProgress
                              ? 'bg-gradient-to-br from-amber-100 to-amber-50 border-r border-amber-300'
                              : 'bg-gradient-to-br from-emerald-100 to-emerald-50 border-r border-emerald-300';
                            return (
                              <div key={`${row.siteId}:${row.roomId}`} className="grid grid-cols-[240px,1fr] border-b border-slate-100 last:border-b-0">
                                <div className={`sticky left-0 z-10 px-3 py-2 ${roomTone}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="truncate text-sm font-semibold text-ink">{row.roomName || '-'}</div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setClientMeetingsRoomPreview({
                                          roomId: String(row.roomId),
                                          floorPlanId: String((row as any).floorPlanId || ''),
                                          siteId: String(row.siteId)
                                        });
                                      }}
                                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                      title={t({ it: 'Mostra planimetria sala', en: 'Show room floor plan' })}
                                    >
                                      <Eye size={14} />
                                    </button>
                                  </div>
                                  <div className="truncate text-xs text-slate-500">{row.siteName}</div>
                                  <div className="truncate text-xs text-slate-500">{String((row as any).floorPlanName || '')}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {t({ it: 'Capienza', en: 'Capacity' })}: {row.capacity}
                                  </div>
                                </div>
                                <div className="relative h-[66px] bg-white">
                                  {clientMeetingsTimelineMeta.hours.map((minute) => {
                                    const leftPct = ((minute - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                    return <div key={`${row.roomId}-grid-${minute}`} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${leftPct}%` }} />;
                                  })}
                                  {clientMeetingsTimelineMeta.showNowLine ? (
                                    <div
                                      className="absolute inset-y-0 z-10 border-l-2 border-blue-500/70"
                                      style={{
                                        left: `${((clientMeetingsTimelineMeta.nowMinutes - clientMeetingsTimelineMeta.minMinutes) / total) * 100}%`
                                      }}
                                    />
                                  ) : null}
                                  {(row.bookings || []).map((booking) => {
                                    const bookingStartTs = toEpochMs((booking as any).startAt);
                                    const bookingEndTs = toEpochMs((booking as any).endAt);
                                    const start = new Date(bookingStartTs || 0);
                                    const end = new Date(bookingEndTs || 0);
                                    const startMin = start.getHours() * 60 + start.getMinutes();
                                    const endMin = end.getHours() * 60 + end.getMinutes();
                                    const clampedStart = Math.max(clientMeetingsTimelineMeta.minMinutes, Math.min(clientMeetingsTimelineMeta.maxMinutes, startMin));
                                    const clampedEnd = Math.max(clampedStart + 1, Math.max(clientMeetingsTimelineMeta.minMinutes, Math.min(clientMeetingsTimelineMeta.maxMinutes, endMin)));
                                    const leftPct = ((clampedStart - clientMeetingsTimelineMeta.minMinutes) / total) * 100;
                                    const widthPct = Math.max(1, ((clampedEnd - clampedStart) / total) * 100);
                                    const isInProgress = bookingStartTs > 0 && bookingStartTs <= nowTs && nowTs < bookingEndTs;
                                    const isPast = bookingEndTs > 0 && bookingEndTs <= nowTs;
                                    const tone =
                                      booking.status === 'pending'
                                        ? 'border-amber-300 bg-amber-100 text-amber-900'
                                        : booking.status === 'rejected'
                                          ? 'border-rose-300 bg-rose-100 text-rose-900'
                                          : booking.status === 'cancelled'
                                            ? 'border-slate-300 bg-slate-100 text-slate-600'
                                            : isInProgress
                                              ? 'border-emerald-400 bg-emerald-200 text-emerald-950'
                                              : isPast
                                                ? 'border-slate-200 bg-slate-100 text-slate-500'
                                                : 'border-violet-300 bg-violet-200 text-violet-950';
                                    return (
                                      <div
                                        key={booking.id}
                                        className={`absolute top-2 h-[50px] overflow-hidden rounded-lg border px-2 py-1 shadow-sm ${tone} ${
                                          String(clientMeetingsHighlightBookingId || '') === String(booking.id || '')
                                            ? 'ring-2 ring-primary ring-offset-1'
                                            : ''
                                        }`}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                        onContextMenu={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          setClientMeetingsTimelineContextMenu({
                                            booking,
                                            x: event.clientX,
                                            y: event.clientY
                                          });
                                        }}
                                        onDoubleClick={() => {
                                          setClientMeetingsShowCheckInDetails(false);
                                          setClientMeetingsBookingDetail({ booking, roomName: row.roomName, siteName: row.siteName });
                                        }}
                                        title={`${booking.subject} • ${new Date(bookingStartTs || 0).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })} - ${new Date(bookingEndTs || 0).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}`}
                                      >
                                        <div className="truncate text-xs font-semibold">{booking.subject || t({ it: 'Meeting', en: 'Meeting' })}</div>
                                        <div className="truncate text-[11px] opacity-90">
                                          {new Date(bookingStartTs || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                                          {new Date(bookingEndTs || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="truncate text-[10px] opacity-80">{booking.requestedByUsername || '-'}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <Clock3 size={12} />
                      {t({
                        it: 'La linea verticale mostra l’orario attuale (solo se la data selezionata è oggi).',
                        en: 'The vertical line shows current time (only when selected date is today).'
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={closeClientMeetingsModal}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                  {clientMeetingsTimelineContextMenu ? (
                    <div
                      ref={clientMeetingsTimelineContextMenuRef}
                      className="fixed z-[97] min-w-[210px] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                      style={{
                        left: Math.max(12, Math.min(clientMeetingsTimelineContextMenu.x, window.innerWidth - 240)),
                        top: Math.max(12, Math.min(clientMeetingsTimelineContextMenu.y, window.innerHeight - 120))
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          openClientMeetingDuplicateModal(clientMeetingsTimelineContextMenu.booking);
                          setClientMeetingsTimelineContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy size={14} />
                        <span>{t({ it: 'Follow-up…', en: 'Follow-up…' })}</span>
                      </button>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!clientMeetingsRoomPreview} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[96]"
          initialFocus={clientMeetingsRoomPreviewFocusRef}
          onClose={() => setClientMeetingsRoomPreview(null)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Planimetria meeting room', en: 'Meeting room floor plan' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {clientMeetingsPreviewData
                          ? `${clientMeetingsPreviewData.clientName} > ${clientMeetingsPreviewData.siteName} > ${clientMeetingsPreviewData.planName}`
                          : t({ it: 'Dati non disponibili', en: 'Data not available' })}
                      </div>
                    </div>
                    <button
                      ref={clientMeetingsRoomPreviewFocusRef}
                      type="button"
                      onClick={() => setClientMeetingsRoomPreview(null)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3">
                    {clientMeetingsPreviewData ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <svg viewBox={clientMeetingsPreviewData.viewBox} className="h-[58vh] w-full rounded-lg bg-white">
                          {clientMeetingsPreviewData.planImageUrl &&
                          clientMeetingsPreviewData.planWidth > 0 &&
                          clientMeetingsPreviewData.planHeight > 0 ? (
                            <image
                              href={clientMeetingsPreviewData.planImageUrl}
                              xlinkHref={clientMeetingsPreviewData.planImageUrl}
                              x={clientMeetingsPreviewData.planImageX || 0}
                              y={clientMeetingsPreviewData.planImageY || 0}
                              width={clientMeetingsPreviewData.planWidth}
                              height={clientMeetingsPreviewData.planHeight}
                              preserveAspectRatio="none"
                              opacity={0.9}
                            />
                          ) : null}
                          {clientMeetingsPreviewData.rooms.map((room: any) => {
                            const points = room.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                            const selected = room.id === clientMeetingsPreviewData.roomId;
                            const roomFill = selected
                              ? 'rgba(34,197,94,0.35)'
                              : room.meetingRoom
                                ? 'rgba(14,165,233,0.14)'
                                : 'rgba(255,255,255,0)';
                            const roomStroke = selected ? '#16a34a' : room.meetingRoom ? '#0284c7' : '#94a3b8';
                            return (
                              <g key={room.id}>
                                <polygon points={points} fill={roomFill} stroke={roomStroke} strokeWidth={selected ? 2 : 1.1} />
                                {room.meetingRoom && room.center ? (
                                  <text
                                    x={room.center.x}
                                    y={room.center.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={16}
                                    fontWeight={selected ? 700 : 600}
                                    fill={selected ? '#166534' : '#0f172a'}
                                  >
                                    {room.name || t({ it: 'Meeting room', en: 'Meeting room' })}
                                  </text>
                                ) : null}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        {t({ it: 'Impossibile mostrare la planimetria per questa sala.', en: 'Unable to render floor plan for this room.' })}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!clientMeetingsBookingDetail && !clientMeetingsDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[95]"
          initialFocus={clientMeetingsBookingDetailFocusRef}
          onClose={() => {
            clientMeetingsDetailCloseGuardUntilRef.current = Date.now() + 350;
            setClientMeetingsBookingDetail(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {clientMeetingsBookingDetail?.booking.subject || t({ it: 'Dettaglio meeting', en: 'Meeting details' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {clientMeetingsBookingDetail
                          ? `${clientMeetingsBookingDetail.siteName} · ${clientMeetingsBookingDetail.roomName}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clientMeetingsDetailCloseGuardUntilRef.current = Date.now() + 350;
                        setClientMeetingsBookingDetail(null);
                      }}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {clientMeetingsBookingDetail ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        [t({ it: 'Stato', en: 'Status' }), clientMeetingsBookingDetail.booking.status],
                        [t({ it: 'Data', en: 'Date' }), new Date(Number(clientMeetingsBookingDetail.booking.startAt)).toLocaleDateString()],
                        [
                          t({ it: 'Ora', en: 'Time' }),
                          `${new Date(Number(clientMeetingsBookingDetail.booking.startAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(
                            Number(clientMeetingsBookingDetail.booking.endAt)
                          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ],
                        [
                          t({ it: 'Posti', en: 'Seats' }),
                          `${clientMeetingsBookingDetail.booking.requestedSeats}/${clientMeetingsBookingDetail.booking.roomCapacity}`
                        ],
                        [t({ it: 'Richiedente', en: 'Requester' }), clientMeetingsBookingDetail.booking.requestedByUsername || '-']
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                          <div className="mt-1 text-sm font-semibold text-ink break-words">{String(value || '-')}</div>
                        </div>
                      ))}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t({ it: 'Approvazione richiesta', en: 'Approval required' })}
                        </div>
                        <div className="mt-1">{boolBadge(!!clientMeetingsBookingDetail.booking.approvalRequired)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Dotazioni', en: 'Equipment' })}</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {(clientMeetingsBookingDetail.booking.equipment || []).length
                            ? (clientMeetingsBookingDetail.booking.equipment || []).join(', ')
                            : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t({ it: 'Video conference LINK', en: 'Video conference LINK' })}
                        </div>
                        <div className="mt-1 break-all text-sm text-slate-700">
                          {clientMeetingsBookingDetail.booking.videoConferenceLink || '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Note', en: 'Notes' })}</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {clientMeetingsBookingDetail.booking.notes || '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Partecipanti', en: 'Participants' })}</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {(clientMeetingsBookingDetail.booking.participants || []).length
                            ? (clientMeetingsBookingDetail.booking.participants || [])
                                .map((p) => `${p.fullName || p.externalId || '-'}${p.optional ? ' (OPT)' : ''}`)
                                .join(', ')
                            : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Ospiti esterni', en: 'External guests' })}</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {(clientMeetingsBookingDetail.booking.externalGuestsDetails || []).length
                            ? (clientMeetingsBookingDetail.booking.externalGuestsDetails || [])
                                .map((g: any) => {
                                  const parts = [String(g?.name || '-').trim() || '-'];
                                  if (g?.remote) parts.push(t({ it: 'remoto', en: 'remote' }));
                                  else parts.push(t({ it: 'in sede', en: 'on-site' }));
                                  if (g?.email) parts.push(String(g.email));
                                  if (g?.sendEmail) parts.push(t({ it: 'mail', en: 'mail' }));
                                  return parts.join(' · ');
                                })
                                .join(', ')
                            : (clientMeetingsBookingDetail.booking.externalGuestsList || []).length
                              ? (clientMeetingsBookingDetail.booking.externalGuestsList || []).join(', ')
                              : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Note sistema', en: 'System notes' })}</div>
                        <div className="mt-1 space-y-1 text-sm text-slate-700">
                          <div>
                            {t({ it: 'Setup pre/post', en: 'Pre/post setup' })}: {clientMeetingsBookingDetail.booking.setupBufferBeforeMin}/
                            {clientMeetingsBookingDetail.booking.setupBufferAfterMin} min
                          </div>
                          <div>
                            {t({ it: 'Mail partecipanti', en: 'Send email' })}: {boolBadge(!!clientMeetingsBookingDetail.booking.sendEmail)}
                          </div>
                          <div>
                            {t({ it: 'Setup tecnico', en: 'Technical setup' })}: {boolBadge(!!clientMeetingsBookingDetail.booking.technicalSetup)}
                            {clientMeetingsBookingDetail.booking.technicalEmail ? ` (${clientMeetingsBookingDetail.booking.technicalEmail})` : ''}
                          </div>
                          {clientMeetingsBookingDetail.booking.rejectReason ? (
                            <div>
                              {t({ it: 'Motivazione rifiuto', en: 'Reject reason' })}: {clientMeetingsBookingDetail.booking.rejectReason}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {clientMeetingsShowCheckInDetails ? (
                        (() => {
                          const booking = clientMeetingsBookingDetail.booking;
                          const checkMap = clientMeetingsCheckInStatusByMeetingId[String(booking.id || '')] || {};
                          const checkTsMap = clientMeetingsCheckInTimestampsByMeetingId[String(booking.id || '')] || {};
                          const stats = getClientMeetingCheckInStats(booking, checkMap);
                          const checkedEntries = getClientMeetingCheckInEntries(booking, checkMap, checkTsMap);
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-ink">{t({ it: 'Stato check-in', en: 'Check-in status' })}</div>
                                <div className="text-xs text-slate-600">{stats.checked}/{stats.total} • {stats.percent}%</div>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.percent}%` }} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span>{t({ it: 'Interni in sede', en: 'Internal on-site' })}: {stats.internalOnSite}</span>
                                <span>{t({ it: 'Esterni in sede', en: 'External on-site' })}: {stats.externalOnSite}</span>
                                <span>{t({ it: 'Partecipanti remoti', en: 'Remote participants' })}: {stats.remoteParticipants}</span>
                              </div>
                              <div className="mt-3 text-xs text-slate-500">
                                {t({
                                  it: 'Visualizza chi ha effettuato il check-in con data/ora registrata dal server.',
                                  en: 'See who checked in with server-recorded date/time.'
                                })}
                              </div>
                              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                {checkedEntries.length ? (
                                  <div className="space-y-2">
                                    {checkedEntries.map((entry) => (
                                      <div
                                        key={entry.key}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                                      >
                                        <div className="flex min-w-0 items-center gap-3">
                                          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                                            {entry.logoUrl ? (
                                              <img src={entry.logoUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                              <span className="text-[10px] font-bold text-slate-400">
                                                {entry.kind === 'external' ? 'EXT' : 'INT'}
                                              </span>
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <div
                                              className={`truncate text-sm font-semibold ${
                                                entry.kind === 'external' ? 'text-violet-700' : 'text-ink'
                                              }`}
                                            >
                                              {entry.label}
                                            </div>
                                            <div className="truncate text-xs text-slate-500">
                                              {[entry.company || null, entry.email || null].filter(Boolean).join(' • ') || '—'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs font-semibold text-emerald-600">
                                            {t({ it: 'Check-in', en: 'Check-in' })}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {entry.checkedAt ? new Date(Number(entry.checkedAt)).toLocaleString() : '—'}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                                    {t({ it: 'Nessun check-in registrato.', en: 'No check-ins recorded.' })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    {clientMeetingsBookingDetail ? (
                      <button
                        type="button"
                        onClick={() => setClientMeetingsNotesBooking(clientMeetingsBookingDetail.booking)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-1">
                          <FileText size={14} />
                          {t({ it: 'Appunti', en: 'Notes' })}
                        </span>
                      </button>
                    ) : null}
                    {clientMeetingsBookingDetail ? (
                      <button
                        type="button"
                        onClick={() => openClientMeetingDuplicateModal(clientMeetingsBookingDetail.booking)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Copy size={14} />
                          {t({ it: 'Duplica', en: 'Duplicate' })}
                        </span>
                      </button>
                    ) : null}
                    {clientMeetingsBookingDetail ? (
                      <button
                        type="button"
                        onClick={() => setClientMeetingsShowCheckInDetails((prev) => !prev)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {clientMeetingsShowCheckInDetails
                          ? t({ it: 'Nascondi check-in', en: 'Hide check-in' })
                          : t({ it: 'Mostra check-in', en: 'Show check-in' })}
                      </button>
                    ) : null}
                    <button
                      ref={clientMeetingsBookingDetailFocusRef}
                      type="button"
                      onClick={() => {
                        clientMeetingsDetailCloseGuardUntilRef.current = Date.now() + 350;
                        setClientMeetingsShowCheckInDetails(false);
                        setClientMeetingsBookingDetail(null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!clientMeetingsDuplicateModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[145]"
          initialFocus={clientMeetingsDuplicateFocusRef}
          onClose={() => {
            if (clientMeetingsDuplicateModal?.saving) return;
            setClientMeetingsDuplicateModal(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[760px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                  {(() => {
                    const dup = clientMeetingsDuplicateModal;
                    if (!dup) return null;
                    const monthDate = new Date(`${dup.monthAnchor}T00:00:00`);
                    const validMonth = Number.isFinite(monthDate.getTime());
                    const y = validMonth ? monthDate.getFullYear() : new Date().getFullYear();
                    const m = validMonth ? monthDate.getMonth() : new Date().getMonth();
                    const daysInMonth = new Date(y, m + 1, 0).getDate();
                    const firstWeekday = ((new Date(y, m, 1).getDay() + 6) % 7);
                    const monthLabel = new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                    const baseDay = dup.baseDay;
                    const booking = dup.booking;
                    const startHm = timeHmFromTs(Number(booking.startAt || 0));
                    const endHm = timeHmFromTs(Number(booking.endAt || 0));
                    const sourceRoomId = String((booking as any)?.roomId || '').trim();
                    const sourceRoomName = String((booking as any)?.roomName || '').trim();
                    const selectedRoomOption = dup.roomOptions.find((entry) => String(entry.roomId) === String(dup.selectedRoomId));
                    const customFromMin = hmToMinutes(String(dup.customFromHm || ''));
                    const customToMin = hmToMinutes(String(dup.customToHm || ''));
                    const customWindowValid = Number.isFinite(customFromMin) && Number.isFinite(customToMin) && customFromMin < customToMin;
                    const canGoPrev = dup.monthAnchor > monthAnchorFromIso(baseDay);
                    const today = todayIso();
                    const cells: Array<{ iso: string | null; dayNum: number | null }> = [];
                    for (let i = 0; i < firstWeekday; i += 1) cells.push({ iso: null, dayNum: null });
                    for (let d = 1; d <= daysInMonth; d += 1) {
                      const dt = new Date(y, m, d);
                      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                      cells.push({ iso, dayNum: d });
                    }
                    while (cells.length % 7) cells.push({ iso: null, dayNum: null });
                    const weekdayLabels = [
                      t({ it: 'Lun', en: 'Mon' }),
                      t({ it: 'Mar', en: 'Tue' }),
                      t({ it: 'Mer', en: 'Wed' }),
                      t({ it: 'Gio', en: 'Thu' }),
                      t({ it: 'Ven', en: 'Fri' }),
                      t({ it: 'Sab', en: 'Sat' }),
                      t({ it: 'Dom', en: 'Sun' })
                    ];
                    return (
                      <>
                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                          <div>
                            <Dialog.Title className="text-lg font-semibold text-ink">
                              {t({ it: 'Duplica riunione', en: 'Duplicate meeting' })}
                            </Dialog.Title>
                            <div className="text-xs text-slate-500">
                              {booking.subject || t({ it: 'Meeting', en: 'Meeting' })} • {startHm} - {endHm}
                            </div>
                            <div className="text-xs text-slate-500">
                              {t({
                                it: 'Seleziona i giorni successivi. Le date in rosso sono occupate nello stesso orario.',
                                en: 'Select future days. Red dates are occupied at the same time.'
                              })}
                            </div>
                          </div>
                          <button
                            ref={clientMeetingsDuplicateFocusRef}
                            type="button"
                            onClick={() => {
                              if (dup.saving) return;
                              setClientMeetingsDuplicateModal(null);
                            }}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {dup.step === 'setup' ? (
                          <>
                            <div className="mt-3 space-y-3">
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t({ it: 'Scelta saletta', en: 'Room selection' })}
                                </div>
                                <div ref={clientMeetingsDuplicateRoomPickerRef} className="relative mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setClientMeetingsDuplicateRoomPickerOpen((prev) => !prev)}
                                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:border-primary/40"
                                  >
                                    <span className="truncate pr-2">
                                      {dup.roomMode === 'any'
                                        ? t({
                                            it: 'Qualsiasi meeting room disponibile in questa sede',
                                            en: 'Any available meeting room in this site'
                                          })
                                        : `${selectedRoomOption?.roomName || '-'}${
                                            selectedRoomOption?.floorPlanName ? ` • ${selectedRoomOption.floorPlanName}` : ''
                                          }`}
                                    </span>
                                    <ChevronDown
                                      size={16}
                                      className={`shrink-0 text-slate-500 transition-transform ${clientMeetingsDuplicateRoomPickerOpen ? 'rotate-180' : ''}`}
                                    />
                                  </button>
                                  {clientMeetingsDuplicateRoomPickerOpen ? (
                                    <div className="absolute z-[220] mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setClientMeetingsDuplicateModal((prev) => (prev ? { ...prev, roomMode: 'any', error: null } : prev));
                                          setClientMeetingsDuplicateRoomPickerOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                                          dup.roomMode === 'any' ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                        <span>{t({ it: 'Qualsiasi meeting room disponibile in questa sede', en: 'Any available meeting room in this site' })}</span>
                                        {dup.roomMode === 'any' ? <span className="text-xs font-semibold">✓</span> : null}
                                      </button>
                                      {dup.roomOptions.map((option) => {
                                        const isSelected = dup.roomMode === 'selected' && String(option.roomId) === String(dup.selectedRoomId);
                                        const isSource = String(option.roomId) === sourceRoomId;
                                        return (
                                          <button
                                            key={option.roomId}
                                            type="button"
                                            onClick={() => {
                                              setClientMeetingsDuplicateModal((prev) =>
                                                prev ? { ...prev, roomMode: 'selected', selectedRoomId: option.roomId, error: null } : prev
                                              );
                                              setClientMeetingsDuplicateRoomPickerOpen(false);
                                            }}
                                            className={`mt-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                                              isSelected ? 'bg-primary/10 text-primary' : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                          >
                                            <span className="flex min-w-0 items-center gap-2">
                                              <span className="truncate">
                                                {option.roomName}
                                                {option.floorPlanName ? ` • ${option.floorPlanName}` : ''}
                                              </span>
                                              {isSource ? (
                                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                                                  {t({ it: 'Origine', en: 'Source' })}
                                                </span>
                                              ) : null}
                                            </span>
                                            {isSelected ? <span className="text-xs font-semibold">✓</span> : null}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="mt-2 text-xs text-slate-500">
                                  {t({ it: 'Saletta di origine', en: 'Source room' })}:{' '}
                                  <span className="font-semibold text-slate-700">{sourceRoomName || '-'}</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {t({ it: 'Selezione attuale', en: 'Current selection' })}:{' '}
                                  {dup.roomMode === 'any'
                                    ? t({
                                        it: 'Qualsiasi meeting room disponibile in questa sede',
                                        en: 'Any available meeting room in this site'
                                      })
                                    : `${selectedRoomOption?.roomName || '-'}${
                                        selectedRoomOption?.floorPlanName ? ` • ${selectedRoomOption.floorPlanName}` : ''
                                      }`}
                                </div>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t({ it: 'Scelta orario', en: 'Time selection' })}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setClientMeetingsDuplicateModal((prev) =>
                                        prev ? { ...prev, timeMode: 'same', error: null } : prev
                                      )
                                    }
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                      dup.timeMode === 'same'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    {t({ it: 'Stesso di quello originale', en: 'Same as original' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setClientMeetingsDuplicateModal((prev) =>
                                        prev ? { ...prev, timeMode: 'any_08_18', error: null } : prev
                                      )
                                    }
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                      dup.timeMode === 'any_08_18'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    {t({
                                      it: 'Qualsiasi disponibile tra 08:00 e 18:00',
                                      en: 'Any available between 08:00 and 18:00'
                                    })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setClientMeetingsDuplicateModal((prev) =>
                                        prev ? { ...prev, timeMode: 'custom', error: null } : prev
                                      )
                                    }
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                      dup.timeMode === 'custom'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    {t({ it: 'Seleziona da - a', en: 'Select from - to' })}
                                  </button>
                                </div>
                                {dup.timeMode === 'custom' ? (
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <label className="text-xs text-slate-500">
                                      {t({ it: 'Da', en: 'From' })}
                                      <input
                                        type="time"
                                        value={dup.customFromHm}
                                        onChange={(event) =>
                                          setClientMeetingsDuplicateModal((prev) =>
                                            prev ? { ...prev, customFromHm: event.target.value, error: null } : prev
                                          )
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                                      />
                                    </label>
                                    <label className="text-xs text-slate-500">
                                      {t({ it: 'A', en: 'To' })}
                                      <input
                                        type="time"
                                        value={dup.customToHm}
                                        onChange={(event) =>
                                          setClientMeetingsDuplicateModal((prev) =>
                                            prev ? { ...prev, customToHm: event.target.value, error: null } : prev
                                          )
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                                      />
                                    </label>
                                  </div>
                                ) : null}
                                <div className="mt-2 text-xs text-slate-500">
                                  {dup.timeMode === 'same'
                                    ? `${t({ it: 'Slot origine', en: 'Source slot' })}: ${startHm} - ${endHm}`
                                    : dup.timeMode === 'any_08_18'
                                      ? t({
                                          it: 'Il sistema trova il primo slot utile tra 08:00 e 18:00.',
                                          en: 'System picks the first available slot between 08:00 and 18:00.'
                                        })
                                      : `${t({ it: 'Finestra scelta', en: 'Selected window' })}: ${dup.customFromHm} - ${dup.customToHm}`}
                                </div>
                                {dup.timeMode === 'custom' && !customWindowValid ? (
                                  <div className="mt-1 text-xs font-semibold text-rose-600">
                                    {t({
                                      it: "L'orario 'da' deve essere precedente all'orario 'a'.",
                                      en: "The 'from' time must be earlier than the 'to' time."
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={dup.saving}
                                onClick={() => setClientMeetingsDuplicateModal(null)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {t({ it: 'Annulla', en: 'Cancel' })}
                              </button>
                              <button
                                type="button"
                                disabled={(dup.roomMode === 'selected' && !dup.selectedRoomId) || (dup.timeMode === 'custom' && !customWindowValid)}
                                onClick={() =>
                                  setClientMeetingsDuplicateModal((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          step: 'calendar',
                                          selectedDays: [],
                                          availabilityByDay: {},
                                          candidateByDay: {},
                                          loadingMonth: false,
                                          error: null
                                        }
                                      : prev
                                  )
                                }
                                className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                              >
                                {t({ it: 'Vai al calendario', en: 'Go to calendar' })}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setClientMeetingsDuplicateModal((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            step: 'setup',
                                            selectedDays: [],
                                            availabilityByDay: {},
                                            candidateByDay: {},
                                            loadingMonth: false,
                                            error: null
                                          }
                                        : prev
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <ChevronLeft size={15} />
                                </button>
                                <button
                                  type="button"
                                  disabled={!canGoPrev}
                                  onClick={() =>
                                    setClientMeetingsDuplicateModal((prev) =>
                                      prev ? { ...prev, monthAnchor: shiftMonthAnchor(prev.monthAnchor, -1), error: null } : prev
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                >
                                  <ChevronLeft size={15} />
                                </button>
                                <div className="min-w-[220px] text-center text-sm font-semibold text-slate-700 capitalize">{monthLabel}</div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setClientMeetingsDuplicateModal((prev) =>
                                      prev ? { ...prev, monthAnchor: shiftMonthAnchor(prev.monthAnchor, 1), error: null } : prev
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <ChevronRight size={15} />
                                </button>
                              </div>
                              <div className="text-xs text-slate-500">
                                {dup.loadingMonth ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Loader2 size={12} className="animate-spin" />
                                    {t({ it: 'Verifica disponibilità…', en: 'Checking availability…' })}
                                  </span>
                                ) : dup.selectedDays.length ? (
                                  t({
                                    it: `${dup.selectedDays.length} giorn${dup.selectedDays.length === 1 ? 'o selezionato' : 'i selezionati'}`,
                                    en: `${dup.selectedDays.length} day(s) selected`
                                  })
                                ) : (
                                  t({ it: 'Nessun giorno selezionato', en: 'No days selected' })
                                )}
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="grid grid-cols-7 gap-1">
                                {weekdayLabels.map((label) => (
                                  <div key={`dup-weekday-${label}`} className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    {label}
                                  </div>
                                ))}
                                {cells.map((cell, idx) => {
                                  if (!cell.iso) return <div key={`dup-empty-${idx}`} className="h-20 rounded-lg border border-transparent" />;
                                  const status =
                                    dup.availabilityByDay[cell.iso] ||
                                    (cell.iso <= baseDay || cell.iso < today
                                      ? ({
                                          state: 'blocked',
                                          reason:
                                            cell.iso < today
                                              ? t({ it: 'Giorno passato', en: 'Past day' })
                                              : t({ it: 'Giorno di origine', en: 'Source day' })
                                        } as const)
                                      : ({ state: 'loading' } as const));
                                  const candidate = dup.candidateByDay[cell.iso];
                                  const tooltipText = (() => {
                                    const dayLabel = new Date(`${cell.iso}T00:00:00`).toLocaleDateString();
                                    if (status.state === 'occupied') {
                                      return `${dayLabel}\n${t({ it: 'Occupata', en: 'Busy' })}\n${
                                        status.reason || t({ it: 'Slot già occupato', en: 'Slot already occupied' })
                                      }`;
                                    }
                                    if (status.state === 'blocked') {
                                      return `${dayLabel}\n${status.reason || t({ it: 'Non selezionabile', en: 'Not selectable' })}`;
                                    }
                                    if (status.state === 'error') {
                                      return `${dayLabel}\n${status.reason || t({ it: 'Errore verifica', en: 'Check error' })}`;
                                    }
                                    if (status.state === 'loading') {
                                      return `${dayLabel}\n${t({ it: 'Verifica disponibilità in corso', en: 'Checking availability' })}`;
                                    }
                                    if (candidate) {
                                      return `${dayLabel}\n${candidate.roomName}\n${candidate.startHm} - ${candidate.endHm}`;
                                    }
                                    return `${dayLabel}\n${t({ it: 'Disponibile', en: 'Available' })}\n${startHm} - ${endHm}`;
                                  })();
                                  const selected = dup.selectedDays.includes(cell.iso);
                                  const blocked = status.state !== 'available';
                                  const classes =
                                    status.state === 'occupied'
                                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                                      : status.state === 'available' && selected
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : status.state === 'available'
                                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                          : status.state === 'blocked'
                                            ? 'border-slate-200 bg-slate-100 text-slate-400'
                                            : status.state === 'loading'
                                              ? 'border-slate-200 bg-white text-slate-500'
                                              : 'border-amber-300 bg-amber-50 text-amber-800';
                                  return (
                                    <button
                                      key={cell.iso}
                                      type="button"
                                      disabled={blocked}
                                      title={tooltipText}
                                      aria-label={tooltipText}
                                      onClick={() =>
                                        setClientMeetingsDuplicateModal((prev) => {
                                          if (!prev) return prev;
                                          const has = prev.selectedDays.includes(cell.iso!);
                                          return {
                                            ...prev,
                                            error: null,
                                            selectedDays: has
                                              ? prev.selectedDays.filter((entry) => entry !== cell.iso)
                                              : [...prev.selectedDays, cell.iso!]
                                          };
                                        })
                                      }
                                      className={`group relative h-20 rounded-lg border p-2 text-left transition ${classes} disabled:cursor-not-allowed`}
                                    >
                                      <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden max-w-[240px] whitespace-pre-line rounded-lg border border-slate-200 bg-slate-900 px-2 py-1 text-[10px] font-medium leading-snug text-white shadow-lg group-hover:block group-focus-visible:block">
                                        {tooltipText}
                                      </span>
                                      <div className="flex items-start justify-between gap-1">
                                        <span className="text-sm font-semibold">{cell.dayNum}</span>
                                        {status.state === 'occupied' ? (
                                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                            {t({ it: 'Occupata', en: 'Busy' })}
                                          </span>
                                        ) : status.state === 'available' ? (
                                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${selected ? 'bg-primary/15 text-primary' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {selected ? t({ it: 'Selez.', en: 'Selected' }) : t({ it: 'Libera', en: 'Free' })}
                                          </span>
                                        ) : status.state === 'loading' ? (
                                          <Loader2 size={12} className="animate-spin text-slate-400" />
                                        ) : null}
                                      </div>
                                      <div className="mt-1 line-clamp-2 text-[11px] leading-tight opacity-90">
                                        {status.state === 'occupied'
                                          ? status.reason || t({ it: 'Già occupata', en: 'Already occupied' })
                                          : status.state === 'blocked'
                                            ? status.reason || t({ it: 'Giorno non selezionabile', en: 'Day not selectable' })
                                            : status.state === 'error'
                                              ? status.reason || t({ it: 'Errore verifica', en: 'Check error' })
                                              : candidate
                                                ? `${candidate.roomName} • ${candidate.startHm} - ${candidate.endHm}`
                                                : `${startHm} - ${endHm}`}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {dup.error ? (
                              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                                {dup.error}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={dup.saving}
                                onClick={() => setClientMeetingsDuplicateModal(null)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {t({ it: 'Annulla', en: 'Cancel' })}
                              </button>
                              <button
                                type="button"
                                disabled={dup.saving || !dup.selectedDays.length}
                                onClick={() => void saveClientMeetingDuplicates()}
                                className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                              >
                                {dup.saving ? (
                                  <>
                                    <Loader2 size={14} className="mr-1 inline-block animate-spin" />
                                    {t({ it: 'Duplicazione...', en: 'Duplicating...' })}
                                  </>
                                ) : (
                                  t({ it: 'Duplica sui giorni selezionati', en: 'Duplicate on selected days' })
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ClientInfoModal
        open={!!clientInfoId}
        client={fullClient || undefined}
        canManageSiteHours={!!user?.isAdmin || !!isSuperAdmin}
        onOpenSiteHours={(siteId) => {
          const targetClient = fullClient;
          const targetSite = targetClient?.sites?.find((site) => String(site.id) === String(siteId));
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
