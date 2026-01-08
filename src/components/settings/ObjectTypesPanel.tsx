import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Eye, EyeOff, GripVertical, Info, Plus, Search, Settings2, Trash2, X, Inbox, CheckCircle2, XCircle, Pencil, RefreshCw } from 'lucide-react';
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
import { IconName } from '../../store/types';

const ObjectTypesPanel = () => {
  const t = useT();
  const lang = useLang();
  const { objectTypes, addObjectType, updateObjectType } = useDataStore();
  const { push } = useToastStore();
  const user = useAuthStore((s) => s.user);
  const customFields = useCustomFieldsStore((s) => s.fields);
  const refreshCustomFields = useCustomFieldsStore((s) => s.refresh);
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canManageRequests = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const canRequestObjects = !canManageRequests;

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

  const enabled = useMemo(() => {
    const arr = (user as any)?.paletteFavorites;
    return Array.isArray(arr) ? (arr as string[]) : [];
  }, [user]);

  const defById = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of objectTypes || []) map.set(d.id, d);
    return map;
  }, [objectTypes]);

  const enabledDefs = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out: any[] = [];
    for (const id of enabled) {
      const d = defById.get(id);
      if (!d) continue;
      if (
        term &&
        !`${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term)
      )
        continue;
      out.push(d);
    }
    return out;
  }, [defById, enabled, q]);

  const availableDefs = useMemo(() => {
    const used = new Set(enabled);
    const list = (objectTypes || []).filter((d) => !used.has(d.id));
    const term = q.trim().toLowerCase();
    const sorted = list.slice().sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
    if (!term) return sorted;
    return sorted.filter((d) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term));
  }, [enabled, lang, objectTypes, q]);

  const paletteDefs = useMemo(() => {
    const enabledIds = new Set(enabled);
    return [...enabledDefs, ...availableDefs.filter((d) => !enabledIds.has(d.id))];
  }, [availableDefs, enabled, enabledDefs]);

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
    'train'
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

  const normalizeTypeId = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

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
                <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
                  <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Richieste in attesa', en: 'Pending requests' })}</Dialog.Title>
                  <div className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Sono presenti richieste oggetto in pending. Vuoi aprire la gestione?',
                      en: 'There are pending object requests. Do you want to open the management view?'
                    })}
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      onClick={() => setPendingPromptOpen(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-ink">{t({ it: 'Oggetti (palette)', en: 'Objects (palette)' })}</div>
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
              title={t({
                it: 'Qui puoi mostrare o nascondere gli oggetti nella palette con l’icona occhio. Tasto destro o ingranaggio per i campi personalizzati.',
                en: 'Show or hide objects in the palette with the eye icon. Right-click or the cog for custom fields.'
              })}
            >
              <Info size={16} />
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {t({
              it: 'La palette è per-utente: ogni utente può avere la propria lista e il proprio ordine.',
              en: 'The palette is per-user: each user can have their own list and ordering.'
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            placeholder={t({ it: 'Cerca oggetti…', en: 'Search objects…' })}
          />
        </div>
        <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <div className="col-span-1" />
          <div className="col-span-1">{t({ it: 'Icona', en: 'Icon' })}</div>
          <div className="col-span-5">{t({ it: 'Nome', en: 'Name' })}</div>
          <div className="col-span-3">ID</div>
          <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
        </div>
        <div className="divide-y divide-slate-100">
          {paletteDefs.length ? (
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
                    <div className="truncate font-semibold text-ink">{label}</div>
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
                <Dialog.Panel className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Dialog.Title className="text-lg font-semibold text-ink">
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
                    <button onClick={() => setRequestsOpen(false)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
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
                    </div>
                  ) : null}

                  {requestsTab === 'new' && canRequestObjects ? (
                    <div className="mt-6 flex justify-end gap-2">
                      <button
                        onClick={() => setRequestsOpen(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Chiudi senza inviare la richiesta', en: 'Close without sending the request' })}
                      >
                        {t({ it: 'Annulla', en: 'Cancel' })}
                      </button>
                      <button
                        onClick={submitRequest}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
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
                                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
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
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Nuovo oggetto', en: 'New object' })}</Dialog.Title>
                    <button onClick={() => setCustomOpen(false)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
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
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      onClick={() => setCustomOpen(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Chiudi senza creare l’oggetto', en: 'Close without creating the object' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={submitCustomObject}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
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

      <CustomFieldsModal open={!!customFieldsForType} initialTypeId={customFieldsForType || undefined} lockType onClose={() => setCustomFieldsForType(null)} />
      </div>
    </>
  );
};

export default ObjectTypesPanel;
