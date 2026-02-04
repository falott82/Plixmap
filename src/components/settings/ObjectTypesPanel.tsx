import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Eye,
  EyeOff,
  GripVertical,
  Inbox,
  Info,
  Pencil,
  Plus,
  RefreshCw,
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
import { isDeskType } from '../plan/deskTypes';
import { WALL_TYPE_IDS, WIFI_DEFAULT_STANDARD, WIFI_STANDARD_OPTIONS } from '../../store/data';
import { getWallTypeColor } from '../../utils/wallColors';
import ConfirmDialog from '../ui/ConfirmDialog';

const ObjectTypesPanel = ({ client }: { client?: Client }) => {
  const t = useT();
  const lang = useLang();
  const { objectTypes, addObjectType, updateObjectType, updateClient } = useDataStore();
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
    if (section === 'wifi') return 'wifi';
    return 'objects';
  };
  const [section, setSection] = useState<'objects' | 'desks' | 'walls' | 'wifi'>(() => resolveSection(location.search));
  const isDesksSection = section === 'desks';
  const isWallsSection = section === 'walls';
  const isWifiSection = section === 'wifi';

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

  const setSectionAndUrl = (nextSection: 'objects' | 'desks' | 'walls' | 'wifi') => {
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
  const sortedWifiModels = useMemo(() => {
    const list = filteredWifiModels.slice();
    const getValue = (model: WifiAntennaModel): string | number => {
      switch (wifiSort.key) {
        case 'brand':
          return model.brand || '';
        case 'model':
          return model.model || '';
        case 'modelCode':
          return model.modelCode || '';
        case 'standard':
          return wifiStandardLabels.get(model.standard) || model.standard || '';
        case 'band24':
          return model.band24 ? 1 : 0;
        case 'band5':
          return model.band5 ? 1 : 0;
        case 'band6':
          return model.band6 ? 1 : 0;
        case 'coverageSqm':
          return Number(model.coverageSqm) || 0;
        default:
          return '';
      }
    };
    const compareValues = (a: string | number, b: string | number) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return `${a}`.localeCompare(`${b}`);
    };
    list.sort((a, b) => {
      const base = compareValues(getValue(a), getValue(b));
      if (base !== 0) return wifiSort.dir === 'asc' ? base : -base;
      const brand = (a.brand || '').localeCompare(b.brand || '');
      if (brand !== 0) return brand;
      const model = (a.model || '').localeCompare(b.model || '');
      if (model !== 0) return model;
      return (a.modelCode || '').localeCompare(b.modelCode || '');
    });
    return list;
  }, [filteredWifiModels, wifiSort.dir, wifiSort.key, wifiStandardLabels]);
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
      return wifiSort.dir === 'asc' ? (
        <ArrowUp size={14} className="text-primary" />
      ) : (
        <ArrowDown size={14} className="text-primary" />
      );
    },
    [wifiSort.dir, wifiSort.key]
  );

  const enabledDefs = useMemo(() => {
    if (isWallsSection) return [];
    const term = q.trim().toLowerCase();
    const out: any[] = [];
    for (const id of enabled) {
      const d = defById.get(id);
      if (!d) continue;
      if (isWallType(d.id)) continue;
      if (isDesksSection ? !isDeskType(d.id) : isDeskType(d.id)) continue;
      if (
        term &&
        !`${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term)
      )
        continue;
      out.push(d);
    }
    return out;
  }, [defById, enabled, isDesksSection, isWallType, isWallsSection, q]);

  const availableDefs = useMemo(() => {
    if (isWallsSection) return [];
    const used = new Set(enabled);
    const list = (objectTypes || []).filter((d) => {
      if (used.has(d.id)) return false;
      if (isWallType(d.id)) return false;
      return isDesksSection ? isDeskType(d.id) : !isDeskType(d.id);
    });
    const term = q.trim().toLowerCase();
    const sorted = list.slice().sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
    if (!term) return sorted;
    return sorted.filter((d) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term));
  }, [enabled, isDesksSection, isWallType, isWallsSection, lang, objectTypes, q]);

  const paletteDefs = useMemo(() => {
    const enabledIds = new Set(enabled);
    return [...enabledDefs, ...availableDefs.filter((d) => !enabledIds.has(d.id))];
  }, [availableDefs, enabled, enabledDefs]);

  const wallDefs = useMemo(() => {
    const list = (objectTypes || []).filter((d) => isWallType(d.id));
    return list.sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
  }, [isWallType, lang, objectTypes]);
  const filteredWallDefs = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return wallDefs;
    return wallDefs.filter((d) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term));
  }, [q, wallDefs]);

  const iconOptionsAll: IconName[] = [
    'user',
    'userCheck',
    'printer',
    'server',
    'wifi',
    'radio',
    'tv',
    'desktop',
    'laptop',
    'camera',
    'intercom',
    'videoIntercom',
    'scanner',
    'mic',
    'router',
    'switch',
    'phone',
    'tablet',
    'shield',
    'key',
    'database',
    'cctv',
    'lightbulb',
    'plug',
    'plugZap',
    'wrench',
    'cpu',
    'hardDrive',
    'bell',
    'lock',
    'unlock',
    'thermometer',
    'fan',
    'airVent',
    'wind',
    'snowflake',
    'thermometerSnowflake',
    'thermometerSun',
    'droplets',
    'flame',
    'gauge',
    'power',
    'zap',
    'battery',
    'batteryCharging',
    'batteryFull',
    'batteryLow',
    'network',
    'wifiOff',
    'cable',
    'lockKeyhole',
    'badgeCheck',
    'shieldCheck',
    'shieldAlert',
    'bellRing',
    'videoOff',
    'micOff',
    'volume2',
    'headphones',
    'users',
    'usersRound',
    'userSearch',
    'car',
    'truck',
    'bike',
    'bus',
    'train',
    'deskRound',
    'deskSquare',
    'deskRect',
    'deskDouble',
    'deskLong',
    'deskTrapezoid',
    'deskL',
    'deskLReverse'
  ];
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
      const ok = window.confirm(
        t({
          it: `Questo oggetto ha ${fieldsForType.length} campo/i personalizzato/i. Rimuoverlo dalla palette?`,
          en: `This object has ${fieldsForType.length} custom field(s). Remove it from your palette?`
        })
      );
      if (!ok) return;
    }
    const next = enabled.filter((x) => x !== typeId);
    const ok = await saveEnabled(next);
    if (ok) push(t({ it: 'Oggetto rimosso', en: 'Object removed' }), 'info');
  };

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
      <Transition show={pendingPromptOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPendingPromptOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Richieste in attesa', en: 'Pending requests' })}</Dialog.Title>
                    <button onClick={() => setPendingPromptOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="modal-description">
                    {t({
                      it: 'Sono presenti richieste oggetto in pending. Vuoi aprire la gestione?',
                      en: 'There are pending object requests. Do you want to open the management view?'
                    })}
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setPendingPromptOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Chiudi la finestra di avviso', en: 'Close the notice dialog' })}
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                    <button
                      onClick={() => {
                        setPendingPromptOpen(false);
                        setRequestsOpen(true);
                        setRequestsTab(canManageRequests ? 'manage' : 'mine');
                        if (!requestsLoading) reloadRequests();
                      }}
                      className="btn-primary"
                      title={t({ it: 'Apri la gestione delle richieste', en: 'Open requests management' })}
                    >
                      {t({ it: 'Apri gestione', en: 'Open management' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
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
                    : isWifiSection
                      ? 'Catalogo antenne WiFi usato per la selezione rapida quando aggiungi un’antenna.'
                      : 'Qui puoi mostrare o nascondere gli oggetti nella palette con l’icona occhio. Le scrivanie hanno una sezione dedicata in planimetria. Tasto destro o ingranaggio per i campi personalizzati.',
                en: isWallsSection
                  ? 'List of wall materials with attenuation and color.'
                  : isDesksSection
                    ? 'Desks are built-in and cannot be created or requested. You can choose which ones appear in the palette with the eye icon.'
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

      <Transition show={requestsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setRequestsOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-5xl modal-panel">
                  <div className="modal-header items-center">
                    <div className="flex items-center gap-2">
                      <Dialog.Title className="modal-title">
                        {t(canManageRequests ? { it: 'Richieste utenti', en: 'User requests' } : { it: 'Richieste oggetti', en: 'Object requests' })}
                      </Dialog.Title>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                        title={t({
                          it: 'Invia una richiesta di nuovo oggetto. Il superadmin può approvare, rifiutare con motivazione o modificare i campi. Finché non è approvata, puoi modificare o eliminare la richiesta.',
                          en: 'Submit a new object request. The superadmin can approve, reject with a reason, or edit fields. Until it is approved, you can edit or delete the request.'
                        })}
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <button onClick={() => setRequestsOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canRequestObjects ? (
                      <>
                        <button
                          onClick={() => {
                            setRequestsTab('new');
                            resetRequestDraft();
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                            requestsTab === 'new' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink'
                          }`}
                          title={t({ it: 'Apri la nuova richiesta oggetto', en: 'Open new object request' })}
                        >
                          {t({ it: 'Nuova richiesta', en: 'New request' })}
                        </button>
                        <button
                          onClick={() => setRequestsTab('mine')}
                          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                            requestsTab === 'mine' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink'
                          }`}
                          title={t({ it: 'Mostra le tue richieste', en: 'Show your requests' })}
                        >
                          {t({ it: 'Le mie richieste', en: 'My requests' })}
                        </button>
                      </>
                    ) : null}
                    {canManageRequests ? (
                      <button
                        onClick={() => setRequestsTab('manage')}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                          requestsTab === 'manage' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink'
                        }`}
                        title={t({ it: 'Gestisci le richieste utenti', en: 'Manage user requests' })}
                      >
                        {t({ it: 'Richieste utenti', en: 'User requests' })}
                      </button>
                    ) : null}
                    {!isSuperAdmin ? (
                      <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          {t({ it: 'Accettate', en: 'Accepted' })}: {countAccepted}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                          {t({ it: 'Pending', en: 'Pending' })}: {countPending}
                        </span>
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                          {t({ it: 'Rifiutate', en: 'Rejected' })}: {countRejected}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {requestsTab === 'new' && canRequestObjects ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'ID oggetto', en: 'Object ID' })} <span className="text-rose-600">*</span>
                        <input
                          value={draftTypeId}
                          onChange={(e) => setDraftTypeId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="es. sensor_temperature"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome (IT)', en: 'Name (IT)' })} <span className="text-rose-600">*</span>
                        <input
                          value={draftNameIt}
                          onChange={(e) => setDraftNameIt(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="Es. Sensore temperatura"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome (EN)', en: 'Name (EN)' })} <span className="text-rose-600">*</span>
                        <input
                          value={draftNameEn}
                          onChange={(e) => setDraftNameEn(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="e.g. Temperature sensor"
                        />
                      </label>
                      <div className="text-sm font-medium text-slate-700">
                        {t({ it: 'Icona', en: 'Icon' })} <span className="text-rose-600">*</span>
                        <div className="mt-2 grid grid-cols-6 gap-2">
                          {iconOptions.map((name) => (
                            <button
                              key={name}
                              onClick={() => setDraftIcon(name)}
                              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                                draftIcon === name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600'
                              }`}
                              title={name}
                            >
                              <Icon name={name} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Campi custom', en: 'Custom fields' })}</div>
                          <button
                            onClick={addDraftField}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Aggiungi un nuovo campo custom', en: 'Add a new custom field' })}
                          >
                            <Plus size={14} /> {t({ it: 'Aggiungi campo', en: 'Add field' })}
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {draftFields.length ? (
                            draftFields.map((f, idx) => (
                              <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-[2fr_1fr_auto]">
                                <input
                                  ref={(node) => {
                                    draftFieldRefs.current[f.id] = node;
                                  }}
                                  value={f.label}
                                  onChange={(e) => updateDraftField(idx, { label: e.target.value })}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                  placeholder={t({ it: 'Etichetta campo', en: 'Field label' })}
                                />
                                <select
                                  value={f.valueType}
                                  onChange={(e) => updateDraftField(idx, { valueType: e.target.value as CustomFieldDraft['valueType'] })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                >
                                  <option value="string">{t({ it: 'Testo', en: 'Text' })}</option>
                                  <option value="number">{t({ it: 'Numero', en: 'Number' })}</option>
                                  <option value="boolean">{t({ it: 'Booleano', en: 'Boolean' })}</option>
                                </select>
                                <button
                                  onClick={() => removeDraftField(idx)}
                                  className="btn-inline-danger"
                                  title={t({ it: 'Rimuovi campo', en: 'Remove field' })}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">{t({ it: 'Nessun campo custom aggiunto.', en: 'No custom fields added.' })}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {requestsTab === 'new' && canRequestObjects ? (
                    <div className="modal-footer">
                      <button
                        onClick={() => setRequestsOpen(false)}
                        className="btn-secondary"
                        title={t({ it: 'Chiudi senza inviare la richiesta', en: 'Close without sending the request' })}
                      >
                        {t({ it: 'Annulla', en: 'Cancel' })}
                      </button>
                      <button
                        onClick={submitRequest}
                        className="btn-primary"
                        title={t({ it: 'Invia o aggiorna la richiesta', en: 'Send or update the request' })}
                      >
                        {editRequestId ? t({ it: 'Aggiorna richiesta', en: 'Update request' }) : t({ it: 'Invia richiesta', en: 'Send request' })}
                      </button>
                    </div>
                  ) : null}

                  {requestsTab === 'mine' && canRequestObjects ? (
                    <div className="mt-4 space-y-2">
                      {countPending === 0 ? (
                        <div className="text-sm text-slate-500">{t({ it: 'Nessuna richiesta in pending.', en: 'No pending requests.' })}</div>
                      ) : null}
                      {myRequests.length ? (
                        myRequests.map((r) => {
                          const badgeClass =
                            r.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-800';
                          const canEdit = r.status !== 'approved';
                          return (
                            <div key={r.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-ink">
                                  {(r.payload?.nameIt || '').trim() || r.payload?.typeId}
                                  <span className="ml-2 text-xs text-slate-500">({r.payload?.typeId})</span>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                                  {r.status === 'approved'
                                    ? t({ it: 'Approvata', en: 'Approved' })
                                    : r.status === 'rejected'
                                      ? t({ it: 'Rifiutata', en: 'Rejected' })
                                      : t({ it: 'In attesa', en: 'Pending' })}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {t({ it: 'Richiesta', en: 'Requested' })}: {formatStamp(r.requestedAt)} ·{' '}
                                {t({ it: 'Esito', en: 'Decision' })}: {formatStamp(r.reviewedAt || undefined)}
                              </div>
                              {r.reason ? <div className="mt-1 text-xs text-rose-700">{r.reason}</div> : null}
                              <div className="mt-2 flex justify-end gap-2">
                                {canEdit ? (
                                  <button
                                    onClick={() => {
                                      setRequestsTab('new');
                                      setEditRequestId(r.id);
                                      setDraftTypeId(r.payload?.typeId || '');
                                      setDraftNameIt(r.payload?.nameIt || '');
                                      setDraftNameEn(r.payload?.nameEn || '');
                                      setDraftIcon((r.payload?.icon || 'user') as IconName);
                                      setDraftFields(toDraftFields(r.payload?.customFields || []));
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Modifica la richiesta', en: 'Edit the request' })}
                                  >
                                    <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                                  </button>
                                ) : null}
                                {canEdit ? (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await deleteObjectTypeRequest(r.id);
                                        push(t({ it: 'Richiesta eliminata', en: 'Request deleted' }), 'info');
                                        await reloadRequests();
                                      } catch {
                                        push(t({ it: 'Eliminazione non riuscita', en: 'Failed to delete request' }), 'danger');
                                      }
                                    }}
                                    className="btn-inline-danger gap-2 px-3 py-1.5"
                                    title={t({ it: 'Elimina la richiesta', en: 'Delete the request' })}
                                  >
                                    <Trash2 size={14} /> {t({ it: 'Elimina', en: 'Delete' })}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      ) : null}
                    </div>
                  ) : null}

                  {canManageRequests && requestsTab === 'manage' ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1.4fr]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Richieste', en: 'Requests' })}</div>
                          <button
                            onClick={reloadRequests}
                            className="btn-inline gap-2 px-2 py-1"
                            title={t({ it: 'Aggiorna la lista richieste', en: 'Refresh the requests list' })}
                          >
                            <RefreshCw size={12} /> {t({ it: 'Aggiorna', en: 'Refresh' })}
                          </button>
                        </div>
                        {pendingCount === 0 ? (
                          <div className="text-sm text-slate-500">{t({ it: 'Nessuna richiesta in pending.', en: 'No pending requests.' })}</div>
                        ) : null}
                        {requestsLoading ? (
                          <div className="text-sm text-slate-500">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                        ) : requests.length ? (
                          requests.map((r) => {
                            const badge =
                              r.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700'
                                : r.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-800';
                            return (
                              <button
                                key={r.id}
                                onClick={() => setSelectedRequestId(r.id)}
                                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                                  selectedRequestId === r.id ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
                                }`}
                                title={t({ it: 'Apri dettagli richiesta', en: 'Open request details' })}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-semibold text-ink">{r.payload?.nameIt || r.payload?.typeId}</div>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
                                    {r.status === 'approved'
                                      ? t({ it: 'Approvata', en: 'Approved' })
                                      : r.status === 'rejected'
                                        ? t({ it: 'Rifiutata', en: 'Rejected' })
                                        : t({ it: 'In attesa', en: 'Pending' })}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {r.requestedBy?.username} · {formatStamp(r.requestedAt)}
                                </div>
                              </button>
                            );
                          })
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        {selectedRequest ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-ink">{selectedRequest.payload?.typeId}</div>
                              <div className="text-xs text-slate-500">{formatStamp(selectedRequest.requestedAt)}</div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'ID oggetto', en: 'Object ID' })}
                                <input
                                  value={draftTypeId}
                                  onChange={(e) => setDraftTypeId(e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Nome (IT)', en: 'Name (IT)' })}
                                <input
                                  value={draftNameIt}
                                  onChange={(e) => setDraftNameIt(e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Nome (EN)', en: 'Name (EN)' })}
                                <input
                                  value={draftNameEn}
                                  onChange={(e) => setDraftNameEn(e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <div className="text-sm font-medium text-slate-700">
                                {t({ it: 'Icona', en: 'Icon' })}
                                <div className="mt-2 grid grid-cols-6 gap-2">
                                  {iconOptions.map((name) => (
                                    <button
                                      key={name}
                                      onClick={() => setDraftIcon(name)}
                                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                                        draftIcon === name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600'
                                      }`}
                                      title={name}
                                    >
                                      <Icon name={name} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold text-ink">{t({ it: 'Campi custom', en: 'Custom fields' })}</div>
                                  <button
                                    onClick={addDraftField}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Aggiungi un nuovo campo custom', en: 'Add a new custom field' })}
                                  >
                                    <Plus size={14} /> {t({ it: 'Aggiungi campo', en: 'Add field' })}
                                  </button>
                                </div>
                                <div className="mt-2 space-y-2">
                                  {draftFields.length ? (
                                    draftFields.map((f, idx) => (
                                      <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-[2fr_1fr_auto]">
                                        <input
                                          ref={(node) => {
                                            draftFieldRefs.current[f.id] = node;
                                          }}
                                          value={f.label}
                                          onChange={(e) => updateDraftField(idx, { label: e.target.value })}
                                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                          placeholder={t({ it: 'Etichetta campo', en: 'Field label' })}
                                        />
                                        <select
                                          value={f.valueType}
                                          onChange={(e) => updateDraftField(idx, { valueType: e.target.value as CustomFieldDraft['valueType'] })}
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                        >
                                          <option value="string">{t({ it: 'Testo', en: 'Text' })}</option>
                                          <option value="number">{t({ it: 'Numero', en: 'Number' })}</option>
                                          <option value="boolean">{t({ it: 'Booleano', en: 'Boolean' })}</option>
                                        </select>
                                        <button
                                          onClick={() => removeDraftField(idx)}
                                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
                                          title={t({ it: 'Rimuovi campo', en: 'Remove field' })}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-500">{t({ it: 'Nessun campo custom aggiunto.', en: 'No custom fields added.' })}</div>
                                  )}
                                </div>
                              </div>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Motivazione (solo rifiuto)', en: 'Reason (for rejection)' })}
                                <textarea
                                  value={reviewReason}
                                  onChange={(e) => setReviewReason(e.target.value)}
                                  className="mt-1 h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                            </div>
                            {selectedRequest.status === 'pending' ? (
                              <div className="mt-4 flex justify-end gap-2">
                                <button
                                  onClick={() => resolveRequest('rejected')}
                                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                                  title={t({ it: 'Rifiuta la richiesta selezionata', en: 'Reject the selected request' })}
                                >
                                  <XCircle size={16} /> {t({ it: 'Rifiuta', en: 'Reject' })}
                                </button>
                                <button
                                  onClick={() => resolveRequest('approved')}
                                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                  title={t({ it: 'Approva la richiesta selezionata', en: 'Approve the selected request' })}
                                >
                                  <CheckCircle2 size={16} /> {t({ it: 'Approva', en: 'Approve' })}
                                </button>
                              </div>
                            ) : (
                              <div className="mt-4 text-xs font-semibold uppercase text-slate-500">
                                {selectedRequest.status === 'approved'
                                  ? t({ it: 'Richiesta approvata', en: 'Request approved' })
                                  : t({ it: 'Richiesta rifiutata', en: 'Request rejected' })}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">{t({ it: 'Seleziona una richiesta.', en: 'Select a request.' })}</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={customOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCustomOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Nuovo oggetto', en: 'New object' })}</Dialog.Title>
                    <button onClick={() => setCustomOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'ID oggetto', en: 'Object ID' })} <span className="text-rose-600">*</span>
                      <input
                        value={draftTypeId}
                        onChange={(e) => setDraftTypeId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="es. sensor_temperature"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Nome (IT)', en: 'Name (IT)' })} <span className="text-rose-600">*</span>
                      <input
                        value={draftNameIt}
                        onChange={(e) => setDraftNameIt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="Es. Sensore temperatura"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Nome (EN)', en: 'Name (EN)' })} <span className="text-rose-600">*</span>
                      <input
                        value={draftNameEn}
                        onChange={(e) => setDraftNameEn(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="e.g. Temperature sensor"
                      />
                    </label>
                    <div className="text-sm font-medium text-slate-700">
                      {t({ it: 'Icona', en: 'Icon' })} <span className="text-rose-600">*</span>
                      <div className="mt-2 grid grid-cols-6 gap-2">
                        {iconOptions.map((name) => (
                          <button
                            key={name}
                            onClick={() => setDraftIcon(name)}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                              draftIcon === name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600'
                            }`}
                            title={name}
                          >
                            <Icon name={name} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Campi custom', en: 'Custom fields' })}</div>
                      <button
                        onClick={addDraftField}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Aggiungi un nuovo campo custom', en: 'Add a new custom field' })}
                      >
                        <Plus size={14} /> {t({ it: 'Aggiungi campo', en: 'Add field' })}
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {draftFields.length ? (
                        draftFields.map((f, idx) => (
                          <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-[2fr_1fr_auto]">
                            <input
                              ref={(node) => {
                                draftFieldRefs.current[f.id] = node;
                              }}
                              value={f.label}
                              onChange={(e) => updateDraftField(idx, { label: e.target.value })}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Etichetta campo', en: 'Field label' })}
                            />
                            <select
                              value={f.valueType}
                              onChange={(e) => updateDraftField(idx, { valueType: e.target.value as CustomFieldDraft['valueType'] })}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            >
                              <option value="string">{t({ it: 'Testo', en: 'Text' })}</option>
                              <option value="number">{t({ it: 'Numero', en: 'Number' })}</option>
                              <option value="boolean">{t({ it: 'Booleano', en: 'Boolean' })}</option>
                            </select>
                            <button
                              onClick={() => removeDraftField(idx)}
                              className="btn-inline-danger"
                              title={t({ it: 'Rimuovi campo', en: 'Remove field' })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500">{t({ it: 'Nessun campo custom aggiunto.', en: 'No custom fields added.' })}</div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setCustomOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Chiudi senza creare l’oggetto', en: 'Close without creating the object' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={submitCustomObject}
                      className="btn-primary"
                      title={t({ it: 'Crea il nuovo oggetto', en: 'Create the new object' })}
                    >
                      {t({ it: 'Crea', en: 'Create' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!wifiModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setWifiModal(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">
                      {t({
                        it: wifiModal?.mode === 'edit' ? 'Modifica modello WiFi' : 'Nuovo modello WiFi',
                        en: wifiModal?.mode === 'edit' ? 'Edit WiFi model' : 'New WiFi model'
                      })}
                    </Dialog.Title>
                    <button onClick={() => setWifiModal(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Marca', en: 'Brand' })}
                      <input
                        value={wifiDraft.brand}
                        onChange={(e) => setWifiDraft((prev) => ({ ...prev, brand: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. Ubiquiti', en: 'e.g. Ubiquiti' })}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Modello', en: 'Model' })}
                      <input
                        value={wifiDraft.model}
                        onChange={(e) => setWifiDraft((prev) => ({ ...prev, model: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. U7 Pro', en: 'e.g. U7 Pro' })}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Codice modello', en: 'Model code' })}
                      <input
                        value={wifiDraft.modelCode}
                        onChange={(e) => setWifiDraft((prev) => ({ ...prev, modelCode: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. U7-Pro', en: 'e.g. U7-Pro' })}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Standard WiFi', en: 'WiFi standard' })}
                      <select
                        value={wifiDraft.standard}
                        onChange={(e) => setWifiDraft((prev) => ({ ...prev, standard: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      >
                        {WIFI_STANDARD_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {lang === 'it' ? opt.it : opt.en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{t({ it: 'Bande', en: 'Bands' })}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={wifiDraft.band24}
                            onChange={(e) => setWifiDraft((prev) => ({ ...prev, band24: e.target.checked }))}
                          />
                          2.4 GHz
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={wifiDraft.band5}
                            onChange={(e) => setWifiDraft((prev) => ({ ...prev, band5: e.target.checked }))}
                          />
                          5 GHz
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={wifiDraft.band6}
                            onChange={(e) => setWifiDraft((prev) => ({ ...prev, band6: e.target.checked }))}
                          />
                          6 GHz
                        </label>
                      </div>
                    </div>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Copertura (m2)', en: 'Coverage (m2)' })}
                      <input
                        value={wifiDraft.coverageSqm}
                        onChange={(e) => setWifiDraft((prev) => ({ ...prev, coverageSqm: e.target.value }))}
                        inputMode="decimal"
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. 185', en: 'e.g. 185' })}
                      />
                    </label>
                    {!wifiDraftValid ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        {t({
                          it: 'Compila tutti i campi e seleziona almeno una banda.',
                          en: 'Fill all fields and select at least one band.'
                        })}
                      </div>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setWifiModal(null)}
                      className="btn-secondary"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={saveWifiModel}
                      disabled={!wifiDraftValid}
                      className={`btn-primary ${wifiDraftValid ? '' : 'cursor-not-allowed opacity-60'}`}
                    >
                      {t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

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

      <CustomFieldsModal open={!!customFieldsForType} initialTypeId={customFieldsForType || undefined} lockType onClose={() => setCustomFieldsForType(null)} />
      </div>
    </>
  );
};

export default ObjectTypesPanel;
