import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  History,
  Inbox,
  Info,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { updateMyProfile } from '../../api/auth';
import {
  createObjectTypeRequest,
  fetchObjectTypeRequests,
  resolveObjectTypeRequest,
  updateObjectTypeRequest,
  deleteObjectTypeRequest,
  ObjectTypeRequest,
  CustomFieldDraft
} from '../../api/objectTypeRequests';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import Icon from '../ui/Icon';
import CustomFieldsModal from './CustomFieldsModal';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { createCustomFieldsBulk } from '../../api/customFields';
import { useLang, useT } from '../../i18n/useT';
import { Client, IconName, WifiAntennaModel } from '../../store/types';
import { useLocation, useNavigate } from 'react-router-dom';
import { WALL_TYPE_IDS, WIFI_DEFAULT_STANDARD, WIFI_STANDARD_OPTIONS } from '../../store/data';
import { getWallTypeColor } from '../../utils/wallColors';
import ConfirmDialog from '../ui/ConfirmDialog';

import { DoorRegistrySortKey, DoorRegistryRow, computeDoorMapPreviewData, OBJECT_TYPE_ICON_OPTIONS, buildDoorRegistryRowsRaw, buildDoorRowsCsv, sortWifiModels, computeObjectTypePaletteDefs } from './ObjectTypesPanel.helpers';
import { RequestsModal, CustomTypeModal, DoorMapPreviewModal, WifiModelModal, DoorHistoryModal, PendingRequestsPromptModal } from './ObjectTypesPanelModals';
const ObjectTypesPanel = ({ client }: { client?: Client }) => {
  const t = useT();
  const lang = useLang();
  const { objectTypes, addObjectType, updateObjectType, updateClient } = useDataStore();
  const allClients = useDataStore((s) => s.clients);
  const { push } = useToastStore();
  const user = useAuthStore((s) => s.user);
  const customFields = useCustomFieldsStore((s) => s.fields);
  const refreshCustomFields = useCustomFieldsStore((s) => s.refresh);
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canManageRequests = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const canRequestObjects = !canManageRequests;
  const location = useLocation();
  const navigate = useNavigate();
  const resolveSection = (search: string) => {
    const section = new URLSearchParams(search).get('section')?.toLowerCase();
    if (section === 'desks') return 'desks';
    if (section === 'walls') return 'walls';
    if (section === 'doors') return 'security';
    if (section === 'security') return 'security';
    if (section === 'wifi') return 'wifi';
    return 'objects';
  };
  const [section, setSection] = useState<'objects' | 'desks' | 'walls' | 'doors' | 'wifi' | 'security'>(() => resolveSection(location.search));
  const isDesksSection = section === 'desks';
  const isWallsSection = section === 'walls';
  const isDoorsSection = section === 'doors';
  const isWifiSection = section === 'wifi';
  const isSecuritySection = section === 'security';

  const [customOpen, setCustomOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [pendingPromptOpen, setPendingPromptOpen] = useState(false);
  const [pendingPromptShown, setPendingPromptShown] = useState(false);
  const [requestsTab, setRequestsTab] = useState<'new' | 'mine' | 'manage'>(isSuperAdmin ? 'manage' : 'new');
  const [requests, setRequests] = useState<ObjectTypeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [q, setQ] = useState('');
  const [context, setContext] = useState<{ x: number; y: number; typeId: string } | null>(null);
  const [customFieldsForType, setCustomFieldsForType] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);
  const [draftTypeId, setDraftTypeId] = useState('');
  const [draftNameIt, setDraftNameIt] = useState('');
  const [draftNameEn, setDraftNameEn] = useState('');
  const [draftIcon, setDraftIcon] = useState<IconName>('user');
  const [draftFields, setDraftFields] = useState<Array<CustomFieldDraft & { id: string }>>([]);
  const [lastAddedFieldId, setLastAddedFieldId] = useState<string | null>(null);
  const draftFieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [wifiModal, setWifiModal] = useState<{ mode: 'create' | 'edit'; model?: WifiAntennaModel } | null>(null);
  type WifiSortKey = 'brand' | 'model' | 'modelCode' | 'standard' | 'band24' | 'band5' | 'band6' | 'coverageSqm';
  const [wifiSort, setWifiSort] = useState<{ key: WifiSortKey; dir: 'asc' | 'desc' }>({ key: 'brand', dir: 'asc' });
  const [wifiDraft, setWifiDraft] = useState({
    brand: '',
    model: '',
    modelCode: '',
    standard: WIFI_DEFAULT_STANDARD,
    band24: false,
    band5: false,
    band6: false,
    coverageSqm: ''
  });
  const [confirmDeleteWifiId, setConfirmDeleteWifiId] = useState<string | null>(null);
  const [confirmRemoveType, setConfirmRemoveType] = useState<null | { typeId: string; fieldsCount: number }>(null);
  const [doorSort, setDoorSort] = useState<{ key: DoorRegistrySortKey; dir: 'asc' | 'desc' }>({
    key: 'clientName',
    dir: 'asc'
  });
  const [doorMapPreviewRow, setDoorMapPreviewRow] = useState<DoorRegistryRow | null>(null);
  const [doorHistoryRow, setDoorHistoryRow] = useState<DoorRegistryRow | null>(null);

  useEffect(() => {
    const next = resolveSection(location.search);
    if (next !== section) setSection(next);
  }, [location.search, section]);

  useEffect(() => {
    if (!wifiModal) return;
    const model = wifiModal.model;
    setWifiDraft({
      brand: model?.brand || '',
      model: model?.model || '',
      modelCode: model?.modelCode || '',
      standard: model?.standard || WIFI_DEFAULT_STANDARD,
      band24: !!model?.band24,
      band5: !!model?.band5,
      band6: !!model?.band6,
      coverageSqm: model?.coverageSqm ? String(model.coverageSqm) : ''
    });
  }, [wifiModal]);

  const setSectionAndUrl = (nextSection: 'objects' | 'desks' | 'walls' | 'doors' | 'wifi' | 'security') => {
    setSection(nextSection);
    const params = new URLSearchParams(location.search);
    params.set('section', nextSection);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const enabled = useMemo(() => {
    const arr = (user as any)?.paletteFavorites;
    return Array.isArray(arr) ? (arr as string[]) : [];
  }, [user]);

  const defById = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of objectTypes || []) map.set(d.id, d);
    return map;
  }, [objectTypes]);
  const wallTypeIdSet = useMemo(() => {
    const ids = new Set<string>(WALL_TYPE_IDS as string[]);
    for (const def of objectTypes || []) {
      if ((def as any)?.category === 'wall') ids.add(def.id);
    }
    return ids;
  }, [objectTypes]);
  const isWallType = useCallback((typeId: string) => wallTypeIdSet.has(typeId), [wallTypeIdSet]);
  const wifiStandardLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of WIFI_STANDARD_OPTIONS) {
      map.set(opt.id, lang === 'it' ? opt.it : opt.en);
    }
    return map;
  }, [lang]);
  const wifiModels = useMemo(() => {
    const list = (client?.wifiAntennaModels || []).slice();
    return list.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  }, [client?.wifiAntennaModels]);
  const filteredWifiModels = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return wifiModels;
    return wifiModels.filter((m) =>
      `${m.brand} ${m.model} ${m.modelCode} ${m.standard}`.toLowerCase().includes(term)
    );
  }, [q, wifiModels]);
  const sortedWifiModels = useMemo(
    () => sortWifiModels(filteredWifiModels, wifiSort.key, wifiSort.dir, wifiStandardLabels),
    [filteredWifiModels, wifiSort.dir, wifiSort.key, wifiStandardLabels]
  );
  const toggleWifiSort = useCallback((key: WifiSortKey) => {
    setWifiSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  }, []);
  const renderWifiSortIcon = useCallback(
    (key: WifiSortKey) => {
      if (wifiSort.key !== key) return <ArrowUpDown size={14} className="text-slate-400" />;
      return wifiSort.dir === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />;
    },
    [wifiSort.dir, wifiSort.key]
  );

  const { paletteDefs } = useMemo(
    () =>
      computeObjectTypePaletteDefs({
        defById,
        enabled,
        objectTypes,
        isWallsSection,
        isDoorsSection,
        isSecuritySection,
        isDesksSection,
        isWallType,
        lang,
        q
      }),
    [defById, enabled, isDesksSection, isDoorsSection, isSecuritySection, isWallType, isWallsSection, lang, objectTypes, q]
  );

  const wallDefs = useMemo(() => {
    const list = (objectTypes || []).filter((d) => isWallType(d.id));
    return list.sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
  }, [isWallType, lang, objectTypes]);
  const filteredWallDefs = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return wallDefs;
    return wallDefs.filter((d) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term));
  }, [q, wallDefs]);
  const doorTypeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const def of objectTypes || []) {
      if ((def as any)?.category === 'door') map.set(def.id, def);
    }
    return map;
  }, [objectTypes]);
  const doorRowsRaw = useMemo<DoorRegistryRow[]>(
    () => buildDoorRegistryRowsRaw(allClients, doorTypeById, lang, t),
    [allClients, doorTypeById, lang, t]
  );
  const toggleDoorSort = useCallback((key: DoorRegistrySortKey) => {
    setDoorSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: 'asc' };
    });
  }, []);
  const renderDoorSortIcon = useCallback(
    (key: DoorRegistrySortKey) => {
      if (doorSort.key !== key) return <ArrowUpDown size={13} className="text-slate-400" />;
      return doorSort.dir === 'asc' ? <ArrowUp size={13} className="text-primary" /> : <ArrowDown size={13} className="text-primary" />;
    },
    [doorSort.dir, doorSort.key]
  );
  const filteredDoorRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? doorRowsRaw.filter((row) =>
          `${row.clientName} ${row.siteName} ${row.planName} ${row.doorId} ${row.description} ${row.doorType} ${row.isEmergency ? 'emergency emergenza yes si' : 'no'} ${row.lastVerificationAt} ${row.verifierCompany} ${row.corridorName} ${row.nearestRoomName}`
            .toLowerCase()
            .includes(term)
        )
      : doorRowsRaw.slice();
    const compareText = (a: string, b: string) => a.localeCompare(b, lang, { sensitivity: 'base' });
    list.sort((a, b) => {
      const dir = doorSort.dir === 'asc' ? 1 : -1;
      let base = 0;
      switch (doorSort.key) {
        case 'isEmergency':
          base = Number(a.isEmergency) - Number(b.isEmergency);
          break;
        case 'clientName':
          base = compareText(a.clientName, b.clientName);
          break;
        case 'siteName':
          base = compareText(a.siteName, b.siteName);
          break;
        case 'planName':
          base = compareText(a.planName, b.planName);
          break;
        case 'doorId':
          base = compareText(a.doorId, b.doorId);
          break;
        case 'description':
          base = compareText(a.description, b.description);
          break;
        case 'doorType':
          base = compareText(a.doorType, b.doorType);
          break;
        case 'lastVerificationAt':
          base = compareText(a.lastVerificationAt, b.lastVerificationAt);
          break;
        case 'verifierCompany':
          base = compareText(a.verifierCompany, b.verifierCompany);
          break;
        case 'corridorName':
          base = compareText(a.corridorName, b.corridorName);
          break;
        case 'nearestRoomName':
          base = compareText(a.nearestRoomName, b.nearestRoomName);
          break;
      }
      if (base !== 0) return base * dir;
      return compareText(a.rowId, b.rowId) * dir;
    });
    return list;
  }, [doorRowsRaw, doorSort.dir, doorSort.key, lang, q]);
  const doorMapPreviewData = useMemo(() => computeDoorMapPreviewData(doorMapPreviewRow), [doorMapPreviewRow]);

  const iconOptionsAll: IconName[] = OBJECT_TYPE_ICON_OPTIONS;
  const iconOptions = useMemo(() => {
    const builtinIcons = new Set(
      (objectTypes || [])
        .filter((t) => t.builtin)
        .map((t) => t.icon)
        .filter(Boolean)
    );
    const filtered = iconOptionsAll.filter((name) => !builtinIcons.has(name));
    return filtered.length ? filtered : iconOptionsAll;
  }, [iconOptionsAll, objectTypes]);

  const reloadRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await fetchObjectTypeRequests();
      setRequests(res.requests || []);
    } catch {
      push(t({ it: 'Errore caricamento richieste', en: 'Failed to load requests' }), 'danger');
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    reloadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  useEffect(() => {
    if (!requestsOpen) return;
    if (requestsTab !== 'manage') return;
    if (selectedRequestId) return;
    if (!requests.length) return;
    setSelectedRequestId(requests[0].id);
  }, [requests, requestsOpen, requestsTab, selectedRequestId]);

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);
  const countAccepted = useMemo(() => requests.filter((r) => r.status === 'approved' && r.requestedBy?.id === user?.id).length, [requests, user?.id]);
  const countRejected = useMemo(() => requests.filter((r) => r.status === 'rejected' && r.requestedBy?.id === user?.id).length, [requests, user?.id]);
  const countPending = useMemo(() => requests.filter((r) => r.status === 'pending' && r.requestedBy?.id === user?.id).length, [requests, user?.id]);
  const myRequests = useMemo(
    () => requests.filter((r) => r.requestedBy?.id === user?.id),
    [requests, user?.id]
  );
  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  useEffect(() => {
    if (requestsTab !== 'manage') return;
    if (!selectedRequest) return;
    setDraftTypeId(selectedRequest.finalPayload?.typeId || selectedRequest.payload?.typeId || '');
    setDraftNameIt(selectedRequest.finalPayload?.nameIt || selectedRequest.payload?.nameIt || '');
    setDraftNameEn(selectedRequest.finalPayload?.nameEn || selectedRequest.payload?.nameEn || '');
    setDraftIcon((selectedRequest.finalPayload?.icon || selectedRequest.payload?.icon || 'user') as IconName);
    setDraftFields(toDraftFields(selectedRequest.finalPayload?.customFields || selectedRequest.payload?.customFields || []));
    setReviewReason(selectedRequest.reason || '');
  }, [requestsTab, selectedRequest]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!context) return;
      if (contextRef.current && contextRef.current.contains(e.target as any)) return;
      setContext(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [context]);

  useEffect(() => {
    if (!requestsOpen) return;
    resetRequestDraft();
  }, [requestsOpen]);

  useEffect(() => {
    if (!customOpen) return;
    resetRequestDraft();
  }, [customOpen]);

  useEffect(() => {
    if (!canManageRequests) return;
    if (pendingPromptShown) return;
    if (pendingCount > 0) {
      setPendingPromptOpen(true);
      setPendingPromptShown(true);
    }
  }, [canManageRequests, pendingCount, pendingPromptShown]);

  useEffect(() => {
    if (!canManageRequests && pendingPromptOpen) setPendingPromptOpen(false);
  }, [canManageRequests, pendingPromptOpen]);

  useEffect(() => {
    if (!canManageRequests && requestsTab === 'manage') setRequestsTab('new');
    if (canManageRequests && requestsTab !== 'manage') setRequestsTab('manage');
  }, [canManageRequests, requestsTab]);

  useEffect(() => {
    if (requestsTab !== 'new') return;
    if (editRequestId) return;
    resetRequestDraft();
  }, [editRequestId, requestsTab]);

  useEffect(() => {
    if (!requestsOpen) return;
    if (isSuperAdmin) return;
    if (requestsTab !== 'new') return;
    if (editRequestId) return;
    resetRequestDraft();
  }, [editRequestId, isSuperAdmin, requestsOpen, requestsTab]);

  useEffect(() => {
    if (!lastAddedFieldId) return;
    const target = draftFieldRefs.current[lastAddedFieldId];
    if (!target) return;
    window.setTimeout(() => target.focus(), 0);
    setLastAddedFieldId(null);
  }, [lastAddedFieldId]);

  const saveEnabled = async (next: string[]) => {
    try {
      await updateMyProfile({ paletteFavorites: next });
      useAuthStore.setState((s) =>
        s.user ? { user: { ...s.user, paletteFavorites: next } as any, permissions: s.permissions, hydrated: s.hydrated } : s
      );
      return true;
    } catch {
      push(t({ it: 'Salvataggio non riuscito', en: 'Save failed' }), 'danger');
      return false;
    }
  };

  const addType = async (typeId: string) => {
    const next = [...enabled, typeId];
    const ok = await saveEnabled(next);
    if (ok) push(t({ it: 'Oggetto aggiunto', en: 'Object added' }), 'success');
  };

  const removeType = async (typeId: string) => {
    const fieldsForType = (customFields || []).filter((f) => f.typeId === typeId);
    if (fieldsForType.length) {
      setConfirmRemoveType({ typeId, fieldsCount: fieldsForType.length });
      return;
    }
    const next = enabled.filter((x) => x !== typeId);
    const ok = await saveEnabled(next);
    if (ok) push(t({ it: 'Oggetto rimosso', en: 'Object removed' }), 'info');
  };

  const confirmRemoveTypeWithFields = useCallback(async () => {
    if (!confirmRemoveType?.typeId) return;
    const next = enabled.filter((x) => x !== confirmRemoveType.typeId);
    const ok = await saveEnabled(next);
    if (ok) push(t({ it: 'Oggetto rimosso', en: 'Object removed' }), 'info');
    setConfirmRemoveType(null);
  }, [confirmRemoveType?.typeId, enabled, push, saveEnabled, t]);

  const moveType = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = enabled.slice();
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    saveEnabled(next).catch(() => {});
  };

  const wifiDraftValid = useMemo(() => {
    if (!wifiModal) return false;
    const coverage = Number(wifiDraft.coverageSqm);
    if (!wifiDraft.brand.trim()) return false;
    if (!wifiDraft.model.trim()) return false;
    if (!wifiDraft.modelCode.trim()) return false;
    if (!wifiDraft.standard) return false;
    if (!(wifiDraft.band24 || wifiDraft.band5 || wifiDraft.band6)) return false;
    return Number.isFinite(coverage) && coverage > 0;
  }, [wifiDraft, wifiModal]);

  const saveWifiModel = useCallback(() => {
    if (!wifiModal || !client) return;
    if (!wifiDraftValid) return;
    const coverage = Number(wifiDraft.coverageSqm);
    const payload: WifiAntennaModel = {
      id: wifiModal.mode === 'edit' && wifiModal.model ? wifiModal.model.id : nanoid(),
      brand: wifiDraft.brand.trim(),
      model: wifiDraft.model.trim(),
      modelCode: wifiDraft.modelCode.trim(),
      standard: wifiDraft.standard,
      band24: !!wifiDraft.band24,
      band5: !!wifiDraft.band5,
      band6: !!wifiDraft.band6,
      coverageSqm: Number.isFinite(coverage) ? coverage : 0
    };
    const nextModels =
      wifiModal.mode === 'edit'
        ? wifiModels.map((m) => (m.id === payload.id ? payload : m))
        : [...wifiModels, payload];
    updateClient(client.id, { wifiAntennaModels: nextModels });
    push(
      t({
        it: wifiModal.mode === 'edit' ? 'Modello WiFi aggiornato' : 'Modello WiFi aggiunto',
        en: wifiModal.mode === 'edit' ? 'WiFi model updated' : 'WiFi model added'
      }),
      'success'
    );
    setWifiModal(null);
  }, [client, push, t, updateClient, wifiDraft, wifiDraftValid, wifiModal, wifiModels]);

  const deleteWifiModel = useCallback(() => {
    if (!client || !confirmDeleteWifiId) return;
    const nextModels = wifiModels.filter((m) => m.id !== confirmDeleteWifiId);
    updateClient(client.id, { wifiAntennaModels: nextModels });
    push(t({ it: 'Modello WiFi eliminato', en: 'WiFi model deleted' }), 'info');
    setConfirmDeleteWifiId(null);
  }, [client, confirmDeleteWifiId, push, t, updateClient, wifiModels]);

  const exportDoorRowsCsv = useCallback(() => {
    if (!filteredDoorRows.length) {
      push(t({ it: 'Nessuna porta da esportare.', en: 'No doors to export.' }), 'info');
      return;
    }
    const blob = new Blob([`\ufeff${buildDoorRowsCsv(filteredDoorRows)}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `plixmap-porte-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push(
      t({
        it: `Export completato (${filteredDoorRows.length} righe).`,
        en: `Export completed (${filteredDoorRows.length} rows).`
      }),
      'success'
    );
  }, [filteredDoorRows, push, t]);

  const openDoorRemote = useCallback(
    (row: DoorRegistryRow) => {
      const url = String(row.openUrl || '').trim();
      if (!url) {
        push(t({ it: 'URL di apertura non configurato.', en: 'Open URL not configured.' }), 'info');
        return;
      }
      try {
        const requestUrl = `${url}${url.includes('?') ? '&' : '?'}_plixmap_open_ts=${Date.now()}`;
        fetch(requestUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(() => {});
        push(t({ it: 'Comando apertura inviato.', en: 'Open command sent.' }), 'success');
      } catch {
        push(t({ it: 'Impossibile inviare il comando di apertura.', en: 'Unable to send open command.' }), 'danger');
      }
    },
    [push, t]
  );

  const normalizeTypeId = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

  const isDeskId = (id: string) => id.startsWith('desk');

  const hasTypeId = (id: string) => objectTypes.some((t) => t.id === id);

  const makeFieldId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `field_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  };

  const toDraftFields = (fields?: CustomFieldDraft[]) =>
    (fields || []).map((f) => ({ id: makeFieldId(), label: f.label, valueType: f.valueType }));

  const serializeDraftFields = (fields: Array<CustomFieldDraft & { id: string }>) =>
    fields.map(({ label, valueType }) => ({ label, valueType }));

  const resetRequestDraft = () => {
    setDraftTypeId('');
    setDraftNameIt('');
    setDraftNameEn('');
    setDraftIcon('user');
    setDraftFields([]);
    setEditRequestId(null);
  };

  const submitCustomObject = () => {
    const nextId = normalizeTypeId(draftTypeId);
    if (!nextId || !draftNameIt.trim() || !draftNameEn.trim()) {
      push(t({ it: 'Compila tutti i campi obbligatori.', en: 'Fill all required fields.' }), 'info');
      return;
    }
    if (isDeskId(nextId)) {
      push(
        t({
          it: 'Le scrivanie sono predefinite e non possono essere create.',
          en: 'Desks are built-in and cannot be created.'
        }),
        'info'
      );
      return;
    }
    if (hasTypeId(nextId)) {
      push(t({ it: 'Esiste già un oggetto con questo ID.', en: 'An object with this ID already exists.' }), 'danger');
      return;
    }
    addObjectType({ id: nextId, nameIt: draftNameIt.trim(), nameEn: draftNameEn.trim(), icon: draftIcon });
    const nextFields = serializeDraftFields(draftFields);
    if (nextFields.length) {
      createCustomFieldsBulk({ typeId: nextId, fields: nextFields })
        .then(() => refreshCustomFields())
        .catch(() => {});
    }
    push(t({ it: 'Oggetto creato', en: 'Object created' }), 'success');
    setCustomOpen(false);
    resetRequestDraft();
  };

  const submitRequest = async () => {
    const nextId = normalizeTypeId(draftTypeId);
    if (!nextId || !draftNameIt.trim() || !draftNameEn.trim()) {
      push(t({ it: 'Compila tutti i campi obbligatori.', en: 'Fill all required fields.' }), 'info');
      return;
    }
    if (isDeskId(nextId)) {
      push(
        t({
          it: 'Le scrivanie sono predefinite e non possono essere richieste.',
          en: 'Desks are built-in and cannot be requested.'
        }),
        'info'
      );
      return;
    }
    if (hasTypeId(nextId)) {
      push(t({ it: 'Esiste già un oggetto con questo ID.', en: 'An object with this ID already exists.' }), 'danger');
      return;
    }
    try {
      if (editRequestId) {
        await updateObjectTypeRequest(editRequestId, {
          typeId: nextId,
          nameIt: draftNameIt.trim(),
          nameEn: draftNameEn.trim(),
          icon: draftIcon,
          customFields: serializeDraftFields(draftFields)
        });
        push(t({ it: 'Richiesta aggiornata', en: 'Request updated' }), 'success');
      } else {
        await createObjectTypeRequest({
          typeId: nextId,
          nameIt: draftNameIt.trim(),
          nameEn: draftNameEn.trim(),
          icon: draftIcon,
          customFields: serializeDraftFields(draftFields)
        });
        push(
          t({
            it: "La richiesta di creazione oggetto è stata inoltrata all'utente Superadmin.",
            en: 'The object creation request has been sent to the Superadmin.'
          }),
          'success'
        );
      }
      setEditRequestId(null);
      setDraftTypeId('');
      setDraftNameIt('');
      setDraftNameEn('');
      setDraftIcon('user');
      setDraftFields([]);
      await reloadRequests();
      if (!isSuperAdmin) setRequestsTab('mine');
    } catch {
      push(t({ it: 'Invio richiesta non riuscito', en: 'Failed to send request' }), 'danger');
    }
  };

  const resolveRequest = async (status: 'approved' | 'rejected') => {
    if (!canManageRequests) {
      push(t({ it: 'Solo il superadmin può approvare o rifiutare.', en: 'Only the superadmin can approve or reject.' }), 'info');
      return;
    }
    if (!selectedRequest) return;
    if (status === 'rejected' && !reviewReason.trim()) {
      push(t({ it: 'Inserisci una motivazione.', en: 'Please add a reason.' }), 'info');
      return;
    }
    const finalPayload = {
      typeId: normalizeTypeId(draftTypeId),
      nameIt: draftNameIt.trim(),
      nameEn: draftNameEn.trim(),
      icon: draftIcon
    };
    if (status === 'approved' && (!finalPayload.typeId || !finalPayload.nameIt || !finalPayload.nameEn)) {
      push(t({ it: 'Completa i campi prima di approvare.', en: 'Complete the fields before approving.' }), 'info');
      return;
    }
    try {
      await resolveObjectTypeRequest(selectedRequest.id, {
        status,
        reason: reviewReason.trim() || undefined,
        finalPayload: { ...finalPayload, customFields: serializeDraftFields(draftFields) }
      });
      if (status === 'approved') {
        if (hasTypeId(finalPayload.typeId)) {
          updateObjectType(finalPayload.typeId, { nameIt: finalPayload.nameIt, nameEn: finalPayload.nameEn, icon: finalPayload.icon });
        } else {
          addObjectType({ id: finalPayload.typeId, nameIt: finalPayload.nameIt, nameEn: finalPayload.nameEn, icon: finalPayload.icon });
        }
      }
      push(
        status === 'approved'
          ? t({ it: 'Richiesta approvata', en: 'Request approved' })
          : t({ it: 'Richiesta rifiutata', en: 'Request rejected' }),
        status === 'approved' ? 'success' : 'info'
      );
      await reloadRequests();
      if (status === 'approved') {
        await refreshCustomFields();
      }
      if (status === 'rejected') setRequestsOpen(false);
    } catch {
      push(t({ it: 'Aggiornamento richiesta non riuscito', en: 'Failed to update request' }), 'danger');
    }
  };

  const addDraftField = () => {
    const id = makeFieldId();
    setLastAddedFieldId(id);
    setDraftFields((prev) => [...prev, { id, label: '', valueType: 'string' }]);
  };

  const updateDraftField = (index: number, next: Partial<CustomFieldDraft>) => {
    setDraftFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...next } : f)));
  };

  const removeDraftField = (index: number) => {
    setDraftFields((prev) => prev.filter((_, i) => i !== index));
  };

  const formatStamp = (value?: number | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(user?.language === 'en' ? 'en-GB' : 'it-IT');
    } catch {
      return '—';
    }
  };

  return (
    <>
      <PendingRequestsPromptModal {...{ pendingPromptOpen, setPendingPromptOpen, setRequestsOpen, setRequestsTab, canManageRequests, requestsLoading, reloadRequests, t }} />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setSectionAndUrl('objects')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            section === 'objects'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Oggetti', en: 'Objects' })}
        </button>
        <button
          onClick={() => setSectionAndUrl('desks')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            section === 'desks'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Scrivanie', en: 'Desks' })}
        </button>
        <button
          onClick={() => setSectionAndUrl('walls')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            section === 'walls'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Mura', en: 'Walls' })}
        </button>
        <button
          onClick={() => setSectionAndUrl('security')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            section === 'security'
              ? 'border-rose-300 bg-rose-100 text-rose-700'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'Sicurezza', en: 'Safety' })}
        </button>
        <button
          onClick={() => setSectionAndUrl('wifi')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            section === 'wifi'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
          }`}
        >
          {t({ it: 'WiFi Antenna', en: 'WiFi Antenna' })}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-ink">
              {isWallsSection
                ? t({ it: 'Mura (tipologie)', en: 'Walls (types)' })
                : isDesksSection
                  ? t({ it: 'Scrivanie (palette)', en: 'Desks (palette)' })
                  : isSecuritySection
                    ? t({ it: 'Sicurezza (palette)', en: 'Safety (palette)' })
                  : isDoorsSection
                    ? t({ it: 'Porte (registro mappa)', en: 'Doors (map registry)' })
                  : isWifiSection
                    ? t({ it: 'WiFi Antenna (catalogo)', en: 'WiFi Antenna (catalog)' })
                    : t({ it: 'Oggetti (palette)', en: 'Objects (palette)' })}
            </div>
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
              title={t({
                it: isWallsSection
                  ? 'Elenco dei materiali muro con attenuazione e colore.'
                  : isDesksSection
                    ? 'Le scrivanie sono predefinite e non possono essere create o richieste. Puoi decidere quali mostrare nella palette con l’icona occhio.'
                    : isSecuritySection
                      ? 'Oggetti sicurezza predefiniti. Puoi decidere quali mostrare nella palette Sicurezza della mappa.'
                    : isDoorsSection
                      ? 'Registro porte inserite in planimetria: filtra, ordina, esporta, apri la porta e visualizza storico/modale mirino.'
                    : isWifiSection
                      ? 'Catalogo antenne WiFi usato per la selezione rapida quando aggiungi un’antenna.'
                      : 'Qui puoi mostrare o nascondere gli oggetti nella palette con l’icona occhio. Le scrivanie hanno una sezione dedicata in planimetria. Tasto destro o ingranaggio per i campi personalizzati.',
                en: isWallsSection
                  ? 'List of wall materials with attenuation and color.'
                  : isDesksSection
                    ? 'Desks are built-in and cannot be created or requested. You can choose which ones appear in the palette with the eye icon.'
                    : isSecuritySection
                      ? 'Built-in safety objects. You can choose which ones appear in the Safety palette on the map.'
                    : isDoorsSection
                      ? 'Registry of doors placed on floor plans: filter, sort, export, trigger open command, and inspect history/target map.'
                    : isWifiSection
                      ? 'WiFi antenna catalog used for quick selection when adding an antenna.'
                      : 'Show or hide objects in the palette with the eye icon. Desks have a dedicated section in the floor plan. Right-click or the cog for custom fields.'
              })}
            >
              <Info size={16} />
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
              {isWallsSection
                ? t({
                    it: 'Qui trovi tutte le tipologie di muro disponibili.',
                    en: 'Here you can see all available wall types.'
                  })
                : isDesksSection
                  ? t({
                      it: 'La palette è per-utente: puoi nascondere o mostrare le scrivanie nella sezione dedicata.',
                      en: 'The palette is per-user: you can hide or show desks in the dedicated section.'
                    })
                : isSecuritySection
                  ? t({
                      it: 'Mostra solo i tipi sicurezza predefiniti. Le porte si gestiscono dal tab “Sicurezza”.',
                      en: 'Shows only built-in safety types. Doors are managed from the “Safety” tab.'
                    })
                : isDoorsSection
                  ? t({
                        it: 'Mostra solo le porte realmente inserite nelle planimetrie. Se non esistono porte, la lista rimane vuota.',
                        en: 'Shows only doors actually placed on floor plans. If no doors exist, the list remains empty.'
                      })
                  : isWifiSection
                    ? t({
                        it: 'Aggiungi o modifica modelli: tutti i campi sono obbligatori.',
                      en: 'Add or edit models: all fields are required.'
                    })
                  : t({
                      it: 'La palette è per-utente: ogni utente può avere la propria lista e il proprio ordine. Le scrivanie compaiono nella sezione dedicata a destra.',
                      en: 'The palette is per-user: each user can have their own list and ordering. Desks appear in the dedicated section on the right.'
                    })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isWallsSection ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {t({ it: 'Tipologie muro predefinite.', en: 'Built-in wall types.' })}
            </div>
          ) : isSecuritySection ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {t({ it: 'Oggetti sicurezza predefiniti: nessuna creazione o richiesta.', en: 'Built-in safety objects: no creation or requests.' })}
            </div>
          ) : isDoorsSection ? (
            <button
              onClick={exportDoorRowsCsv}
              disabled={!filteredDoorRows.length}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={t({ it: 'Esporta CSV (righe filtrate)', en: 'Export CSV (filtered rows)' })}
            >
              <Download size={16} />
              {t({ it: 'Export CSV', en: 'Export CSV' })}
            </button>
          ) : isWifiSection ? (
            <button
              onClick={() => setWifiModal({ mode: 'create' })}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} />
              {t({ it: 'Nuovo modello', en: 'New model' })}
            </button>
          ) : isDesksSection ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {t({ it: 'Scrivanie predefinite: nessuna creazione o richiesta.', en: 'Built-in desks: no creation or requests.' })}
            </div>
          ) : (
            <>
              {canRequestObjects ? (
                <button
                  onClick={() => {
                    setRequestsOpen(true);
                    setRequestsTab('new');
                    if (!requestsLoading) reloadRequests();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Richiedi oggetto', en: 'Request object' })}
                >
                  <Plus size={16} />
                  {t({ it: 'Richiedi oggetto', en: 'Request object' })}
                </button>
              ) : (
                <button
                  onClick={() => setCustomOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Crea oggetto', en: 'Create object' })}
                >
                  <Plus size={16} />
                  {t({ it: 'Crea oggetto', en: 'Create object' })}
                </button>
              )}
              <button
                onClick={() => {
                  setRequestsOpen(true);
                  setRequestsTab(canManageRequests ? 'manage' : 'mine');
                  if (!requestsLoading) reloadRequests();
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  pendingCount ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'
                }`}
                title={t(
                  canManageRequests
                    ? { it: 'Gestione richieste utenti', en: 'Manage user requests' }
                    : { it: 'Richieste', en: 'Requests' }
                )}
              >
                <Inbox size={16} />
                {t(canManageRequests ? { it: 'Richieste utenti', en: 'User requests' } : { it: 'Richieste', en: 'Requests' })}
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{pendingCount}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isWifiSection ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder={t({ it: 'Cerca antenne WiFi…', en: 'Search WiFi antennas…' })}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('brand')}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per marca', en: 'Sort by brand' })}
                    >
                      {t({ it: 'Marca', en: 'Brand' })}
                      {renderWifiSortIcon('brand')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('model')}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per modello', en: 'Sort by model' })}
                    >
                      {t({ it: 'Modello', en: 'Model' })}
                      {renderWifiSortIcon('model')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('modelCode')}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per codice modello', en: 'Sort by model code' })}
                    >
                      {t({ it: 'Codice modello', en: 'Model code' })}
                      {renderWifiSortIcon('modelCode')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('standard')}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per standard WiFi', en: 'Sort by WiFi standard' })}
                    >
                      {t({ it: 'Standard WiFi', en: 'WiFi standard' })}
                      {renderWifiSortIcon('standard')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('band24')}
                      className="inline-flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per 2.4 GHz', en: 'Sort by 2.4 GHz' })}
                    >
                      2.4 GHz
                      {renderWifiSortIcon('band24')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('band5')}
                      className="inline-flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per 5 GHz', en: 'Sort by 5 GHz' })}
                    >
                      5 GHz
                      {renderWifiSortIcon('band5')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('band6')}
                      className="inline-flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per 6 GHz', en: 'Sort by 6 GHz' })}
                    >
                      6 GHz
                      {renderWifiSortIcon('band6')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleWifiSort('coverageSqm')}
                      className="inline-flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                      title={t({ it: 'Ordina per copertura', en: 'Sort by coverage' })}
                    >
                      {t({ it: 'Copertura (m2)', en: 'Coverage (m2)' })}
                      {renderWifiSortIcon('coverageSqm')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedWifiModels.length ? (
                  sortedWifiModels.map((model) => (
                    <tr key={model.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-ink">{model.brand}</td>
                      <td className="px-3 py-2 text-slate-700">{model.model}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{model.modelCode}</td>
                      <td className="px-3 py-2 text-slate-700">{wifiStandardLabels.get(model.standard) || model.standard}</td>
                      <td className="px-3 py-2 text-center">
                        {model.band24 ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-rose-500" />}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {model.band5 ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-rose-500" />}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {model.band6 ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-rose-500" />}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{model.coverageSqm}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setWifiModal({ mode: 'edit', model })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            title={t({ it: 'Modifica', en: 'Edit' })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteWifiId(model.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            title={t({ it: 'Elimina', en: 'Delete' })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-sm text-slate-600">
                      {t({ it: 'Nessun modello WiFi disponibile.', en: 'No WiFi models available.' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : isDoorsSection ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder={t({ it: 'Cerca cliente, sede, planimetria, porta, corridoio, ufficio…', en: 'Search client, site, floor plan, door, corridor, office…' })}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1850px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('clientName')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Cliente', en: 'Client' })} {renderDoorSortIcon('clientName')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('siteName')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Sede', en: 'Site' })} {renderDoorSortIcon('siteName')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('planName')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Planimetria', en: 'Floor plan' })} {renderDoorSortIcon('planName')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('doorId')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'ID porta', en: 'Door ID' })} {renderDoorSortIcon('doorId')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('description')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Descrizione porta', en: 'Door description' })} {renderDoorSortIcon('description')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('doorType')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Tipo porta', en: 'Door type' })} {renderDoorSortIcon('doorType')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center">
                    <button type="button" onClick={() => toggleDoorSort('isEmergency')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Porta emergenza', en: 'Emergency door' })} {renderDoorSortIcon('isEmergency')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('lastVerificationAt')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Ultima revisione', en: 'Last revision' })} {renderDoorSortIcon('lastVerificationAt')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('verifierCompany')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Ultima azienda revisionatrice', en: 'Last verifier company' })} {renderDoorSortIcon('verifierCompany')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('corridorName')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Nome corridoio', en: 'Corridor name' })} {renderDoorSortIcon('corridorName')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" onClick={() => toggleDoorSort('nearestRoomName')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      {t({ it: 'Ufficio più vicino', en: 'Nearest office' })} {renderDoorSortIcon('nearestRoomName')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDoorRows.length ? (
                  filteredDoorRows.map((row) => (
                    <tr key={row.rowId} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-ink">{row.clientName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.siteName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.planName || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.doorId || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.description || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.doorType || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {row.isEmergency ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            {t({ it: 'Sì', en: 'Yes' })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{row.isEmergency ? row.lastVerificationAt || '—' : '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.isEmergency ? row.verifierCompany || '—' : '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.corridorName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.nearestRoomName || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDoorMapPreviewRow(row)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Mirino: mostra su planimetria', en: 'Crosshair: show on floor plan' })}
                          >
                            <Crosshair size={14} />
                          </button>
                          {row.openUrl ? (
                            <button
                              onClick={() => openDoorRemote(row)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title={t({ it: 'Apri porta', en: 'Open door' })}
                            >
                              <ExternalLink size={14} />
                            </button>
                          ) : null}
                          {row.isEmergency ? (
                            <button
                              onClick={() => setDoorHistoryRow(row)}
                              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              title={t({ it: 'Storico verifiche', en: 'Verification history' })}
                            >
                              <History size={14} />
                              {row.verificationHistory.length ? (
                                <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[9px] font-bold text-rose-700">
                                  {row.verificationHistory.length}
                                </span>
                              ) : null}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-sm text-slate-500">
                      {t({
                        it: 'Nessuna porta trovata con i filtri correnti.',
                        en: 'No doors found with current filters.'
                      })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder={
                isWallsSection
                  ? t({ it: 'Cerca muri…', en: 'Search walls…' })
                  : isDoorsSection
                    ? t({ it: 'Cerca porte…', en: 'Search doors…' })
                  : isSecuritySection
                    ? t({ it: 'Cerca dispositivi sicurezza…', en: 'Search safety devices…' })
                  : isDesksSection
                    ? t({ it: 'Cerca scrivanie…', en: 'Search desks…' })
                    : t({ it: 'Cerca oggetti…', en: 'Search objects…' })
              }
            />
          </div>
          <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            {isWallsSection ? (
              <>
                <div className="col-span-1">{t({ it: 'Colore', en: 'Color' })}</div>
                <div className="col-span-6">{t({ it: 'Nome', en: 'Name' })}</div>
                <div className="col-span-2">{t({ it: 'Attenuazione', en: 'Attenuation' })}</div>
                <div className="col-span-3">ID</div>
              </>
            ) : (
              <>
                <div className="col-span-1" />
                <div className="col-span-1">{t({ it: 'Icona', en: 'Icon' })}</div>
                <div className="col-span-5">{t({ it: 'Nome', en: 'Name' })}</div>
                <div className="col-span-3">ID</div>
                <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
              </>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {isWallsSection ? (
              filteredWallDefs.length ? (
                filteredWallDefs.map((def) => {
                  const label = (def?.name?.[lang] as string) || (def?.name?.it as string) || def.id;
                  const attenuation = Number((def as any).attenuationDb);
                  return (
                    <div key={def.id} className="grid grid-cols-12 items-center px-3 py-2 text-sm hover:bg-slate-50">
                      <div className="col-span-1">
                        <span
                          className="inline-flex h-3 w-3 rounded-full border border-slate-200"
                          style={{ background: getWallTypeColor(def.id) }}
                          title={t({ it: 'Colore assegnato', en: 'Assigned color' })}
                        />
                      </div>
                      <div className="col-span-6 min-w-0">
                        <div className="truncate font-semibold text-ink">{label}</div>
                      </div>
                      <div className="col-span-2 text-xs text-slate-600">
                        {Number.isFinite(attenuation) ? `${attenuation} dB` : '—'}
                      </div>
                      <div className="col-span-3 font-mono text-xs text-slate-700">{def.id}</div>
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-6 text-sm text-slate-600">
                  {t({
                    it: 'Nessuna tipologia muro disponibile.',
                    en: 'No wall types available.'
                  })}
                </div>
              )
            ) : paletteDefs.length ? (
              paletteDefs.map((def) => {
                const label = (def?.name?.[lang] as string) || (def?.name?.it as string) || def.id;
                const isEnabled = enabled.includes(def.id);
                return (
                  <div
                    key={def.id}
                    draggable={isEnabled}
                    onDragStart={() => {
                      if (!isEnabled) return;
                      dragIdRef.current = def.id;
                    }}
                    onDragEnd={() => (dragIdRef.current = null)}
                    onDragOver={(e) => {
                      if (!isEnabled) return;
                      e.preventDefault();
                      const from = dragIdRef.current;
                      if (!from || from === def.id) return;
                      moveType(from, def.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContext({ x: e.clientX, y: e.clientY, typeId: def.id });
                    }}
                    className="grid grid-cols-12 items-center px-3 py-2 text-sm hover:bg-slate-50"
                    title={t({
                      it: isEnabled ? 'Trascina per riordinare. Occhio per nascondere.' : 'Occhio per mostrare in palette.',
                      en: isEnabled ? 'Drag to reorder. Eye to hide.' : 'Eye to show in palette.'
                    })}
                  >
                    <div className="col-span-1 text-slate-400">{isEnabled ? <GripVertical size={16} /> : null}</div>
                    <div className="col-span-1">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                        <Icon name={def.icon} />
                      </span>
                    </div>
                    <div className="col-span-5 min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate font-semibold text-ink">{label}</div>
                        {Number.isFinite((def as any).attenuationDb) ? (
                          <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {(def as any).attenuationDb} dB
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">{t({ it: 'Tasto destro: campi custom', en: 'Right-click: custom fields' })}</div>
                    </div>
                    <div className="col-span-3 font-mono text-xs text-slate-700">{def.id}</div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        onClick={() => setCustomFieldsForType(def.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Campi personalizzati', en: 'Custom fields' })}
                      >
                        <Settings2 size={16} />
                      </button>
                      <button
                        onClick={() => (isEnabled ? removeType(def.id) : addType(def.id))}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                          isEnabled ? 'border-slate-200 bg-white text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        } hover:bg-slate-50`}
                        title={t(
                          isEnabled
                            ? { it: 'Nascondi dalla palette', en: 'Hide from palette' }
                            : { it: 'Mostra in palette', en: 'Show in palette' }
                        )}
                      >
                        {isEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-6 text-sm text-slate-600">
                {t({
                  it: 'Nessun oggetto disponibile.',
                  en: 'No available objects.'
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {context ? (
        <div
          ref={contextRef}
          className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
          style={{ top: context.y, left: context.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-semibold text-ink">{t({ it: 'Menu', en: 'Menu' })}</span>
            <button onClick={() => setContext(null)} className="text-slate-400 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
              <X size={14} />
            </button>
          </div>
          <button
            onClick={() => {
              setCustomFieldsForType(context.typeId);
              setContext(null);
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
            title={t({ it: 'Configura campi personalizzati', en: 'Configure custom fields' })}
          >
            <Settings2 size={14} className="text-slate-500" /> {t({ it: 'Aggiungi campi custom…', en: 'Add custom fields…' })}
          </button>
          <button
            onClick={() => {
              if (enabled.includes(context.typeId)) {
                removeType(context.typeId);
              } else {
                addType(context.typeId);
              }
              setContext(null);
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50"
            title={t(
              enabled.includes(context.typeId)
                ? { it: 'Nascondi questo oggetto dalla palette', en: 'Hide this object from the palette' }
                : { it: 'Mostra questo oggetto nella palette', en: 'Show this object in the palette' }
            )}
          >
            {enabled.includes(context.typeId) ? (
              <>
                <EyeOff size={14} /> {t({ it: 'Nascondi dalla palette', en: 'Hide from palette' })}
              </>
            ) : (
              <>
                <Eye size={14} /> {t({ it: 'Mostra in palette', en: 'Show in palette' })}
              </>
            )}
          </button>
        </div>
      ) : null}

      <RequestsModal
        {...{ addDraftField, canManageRequests, canRequestObjects, countAccepted, countPending, countRejected, deleteObjectTypeRequest, draftFieldRefs, draftFields, draftIcon, draftNameEn, draftNameIt, draftTypeId, editRequestId, formatStamp, iconOptions, isSuperAdmin, myRequests, pendingCount, push, reloadRequests, removeDraftField, requests, requestsLoading, requestsOpen, requestsTab, resetRequestDraft, resolveRequest, reviewReason, selectedRequest, selectedRequestId, setDraftFields, setDraftIcon, setDraftNameEn, setDraftNameIt, setDraftTypeId, setEditRequestId, setRequestsOpen, setRequestsTab, setReviewReason, setSelectedRequestId, submitRequest, t, toDraftFields, updateDraftField }}
      />
      <CustomTypeModal
        {...{ addDraftField, customOpen, draftFieldRefs, draftFields, draftIcon, draftNameEn, draftNameIt, draftTypeId, iconOptions, removeDraftField, setCustomOpen, setDraftIcon, setDraftNameEn, setDraftNameIt, setDraftTypeId, submitCustomObject, t, updateDraftField }}
      />
      <DoorMapPreviewModal {...{ doorMapPreviewData, doorMapPreviewRow, setDoorMapPreviewRow, t }} />

      <DoorHistoryModal {...{ doorHistoryRow, setDoorHistoryRow, t }} />

      <WifiModelModal {...{ lang, saveWifiModel, setWifiDraft, setWifiModal, t, wifiDraft, wifiDraftValid, wifiModal }} />

      <ConfirmDialog
        open={!!confirmDeleteWifiId}
        title={t({ it: 'Eliminare il modello WiFi?', en: 'Delete WiFi model?' })}
        description={t({
          it: 'Questa operazione rimuove il modello dal catalogo. Le antenne gia inserite non verranno modificate.',
          en: 'This removes the model from the catalog. Existing antennas will not be modified.'
        })}
        onCancel={() => setConfirmDeleteWifiId(null)}
        onConfirm={deleteWifiModel}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <ConfirmDialog
        open={!!confirmRemoveType}
        title={t({ it: 'Rimuovere oggetto dalla palette?', en: 'Remove object from palette?' })}
        description={t({
          it: `Questo oggetto ha ${Number(confirmRemoveType?.fieldsCount || 0)} campo/i personalizzato/i associati. Vuoi rimuoverlo comunque dalla tua palette?`,
          en: `This object has ${Number(confirmRemoveType?.fieldsCount || 0)} associated custom field(s). Do you still want to remove it from your palette?`
        })}
        onCancel={() => setConfirmRemoveType(null)}
        onConfirm={confirmRemoveTypeWithFields}
        confirmLabel={t({ it: 'Rimuovi', en: 'Remove' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />

      <CustomFieldsModal open={!!customFieldsForType} initialTypeId={customFieldsForType || undefined} lockType onClose={() => setCustomFieldsForType(null)} />
      </div>
    </>
  );
};

export default ObjectTypesPanel;
