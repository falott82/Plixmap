import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronDown, ChevronUp, Copy, Info, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { useUIStore } from '../../store/useUIStore';
import { LayerDefinition } from '../../store/types';
import { useLang, useT } from '../../i18n/useT';
import Icon from '../ui/Icon';
import { isDeskType } from '../plan/deskTypes';
import { ALL_ITEMS_LAYER_ID } from '../../store/data';

const SPECIAL_LAYER_IDS = new Set([ALL_ITEMS_LAYER_ID, 'rooms', 'cabling']);

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const LayersPanel = () => {
  const { clients, objectTypes, updateClientLayers } = useDataStore();
  const selectedPlanId = useUIStore((s) => s.selectedPlanId);
  const setPlanDirty = useUIStore((s) => s.setPlanDirty);
  const { push } = useToastStore();
  const t = useT();
  const lang = useLang();
  const [planId, setPlanId] = useState<string | undefined>(selectedPlanId);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [layerModal, setLayerModal] = useState<{ mode: 'create' } | { mode: 'edit'; layerId: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LayerDefinition | null>(null);
  const [typeEditor, setTypeEditor] = useState<{ layerId: string; typeIds: string[]; query: string } | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateLayerIds, setDuplicateLayerIds] = useState<string[]>([]);
  const [duplicateTargetIds, setDuplicateTargetIds] = useState<string[]>([]);
  const [draftNameIt, setDraftNameIt] = useState('');
  const [draftNameEn, setDraftNameEn] = useState('');
  const [draftColor, setDraftColor] = useState('#0ea5e9');
  const [draftNoteIt, setDraftNoteIt] = useState('');
  const [draftNoteEn, setDraftNoteEn] = useState('');
  const [layerQuery, setLayerQuery] = useState('');
  const nameRef = useRef<HTMLInputElement | null>(null);

  const selectedPlanClientId = useMemo(() => {
    if (!selectedPlanId) return undefined;
    for (const client of clients) {
      for (const site of client.sites || []) {
        for (const plan of site.floorPlans || []) {
          if (plan.id === selectedPlanId) return client.id;
        }
      }
    }
    return undefined;
  }, [clients, selectedPlanId]);

  const clientOptions = useMemo(() => {
    const list: Array<{ id: string; label: string }> = [];
    for (const client of clients) {
      const label = client.shortName || client.name;
      list.push({ id: client.id, label });
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [clients]);

  useEffect(() => {
    if (selectedPlanClientId && clients.some((c) => c.id === selectedPlanClientId)) {
      setClientId(selectedPlanClientId);
      return;
    }
    if (clientId && clients.some((c) => c.id === clientId)) return;
    setClientId(clientOptions[0]?.id);
  }, [clientId, clientOptions, clients, selectedPlanClientId]);

  const currentClient = useMemo(
    () => clients.find((c) => c.id === clientId) || clients[0],
    [clientId, clients]
  );
  const planLayers = useMemo(() => {
    const layers = (currentClient?.layers || []) as LayerDefinition[];
    return [...layers].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }, [currentClient?.layers]);
  const planOptions = useMemo(() => {
    const list: Array<{ id: string; label: string }> = [];
    if (!currentClient) return list;
    for (const site of currentClient.sites || []) {
      const plans = [...(site.floorPlans || [])].sort((a, b) => Number((a as any).order || 0) - Number((b as any).order || 0));
      for (const plan of plans) {
        const label = site.name ? `${site.name} · ${plan.name}` : plan.name;
        list.push({ id: plan.id, label });
      }
    }
    return list;
  }, [currentClient]);

  useEffect(() => {
    if (!planOptions.length) {
      if (planId !== undefined) setPlanId(undefined);
      return;
    }
    if (planId && planOptions.some((opt) => opt.id === planId)) return;
    const fallback =
      (selectedPlanId && planOptions.some((opt) => opt.id === selectedPlanId) ? selectedPlanId : undefined) || planOptions[0]?.id;
    if (fallback && fallback !== planId) setPlanId(fallback);
  }, [planId, planOptions, selectedPlanId]);

  const currentPlan = useMemo(() => {
    if (!currentClient || !planId) return undefined;
    for (const site of currentClient.sites || []) {
      const plan = (site.floorPlans || []).find((p) => p.id === planId);
      if (plan) return plan;
    }
    return undefined;
  }, [currentClient, planId]);
  const editableLayers = useMemo(
    () => planLayers.filter((layer) => !SPECIAL_LAYER_IDS.has(String(layer.id))),
    [planLayers]
  );
  const systemLayers = useMemo(
    () => planLayers.filter((layer) => SPECIAL_LAYER_IDS.has(String(layer.id))),
    [planLayers]
  );
  const resolveLayerLabel = (layer: LayerDefinition) =>
    (layer?.name?.[lang] as string) || (layer?.name?.it as string) || layer.id;
  const normalizedLayerQuery = layerQuery.trim().toLowerCase();
  const matchesLayer = useCallback(
    (layer: LayerDefinition) => {
      if (!normalizedLayerQuery) return true;
      const label = resolveLayerLabel(layer).toLowerCase();
      const note = typeof (layer as any).note === 'string'
        ? String((layer as any).note || '')
        : `${(layer as any).note?.it || ''} ${(layer as any).note?.en || ''}`;
      return `${label} ${layer.id} ${note}`.toLowerCase().includes(normalizedLayerQuery);
    },
    [normalizedLayerQuery, resolveLayerLabel]
  );
  const filteredEditableLayers = useMemo(
    () => editableLayers.filter(matchesLayer),
    [editableLayers, matchesLayer]
  );
  const filteredSystemLayers = useMemo(
    () => systemLayers.filter(matchesLayer),
    [matchesLayer, systemLayers]
  );

  const objectTypeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const def of objectTypes || []) map.set(def.id, def);
    return map;
  }, [objectTypes]);

  const typeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const def of objectTypes || []) ids.add(def.id);
    for (const obj of currentPlan?.objects || []) ids.add(obj.type);
    const list = Array.from(ids).map((id) => {
      const def = objectTypeById.get(id);
      const label = (def?.name?.[lang] as string) || (def?.name?.it as string) || id;
      return { id, label, icon: def?.icon };
    });
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [currentPlan?.objects, lang, objectTypeById, objectTypes]);

  const resolveTypeLabel = (typeId: string) => {
    const def = objectTypeById.get(typeId);
    return (def?.name?.[lang] as string) || (def?.name?.it as string) || typeId;
  };

  const inferDefaultLayerIds = (typeId: string, layerIdSet: Set<string>) => {
    const ids: string[] =
      typeId === 'user' || typeId === 'real_user' || typeId === 'generic_user'
        ? ['users']
        : typeId === 'rack'
          ? ['racks']
          : isDeskType(typeId)
            ? ['desks']
            : typeId === 'camera'
              ? ['cctv']
              : ['devices'];
    return ids.filter((id) => layerIdSet.has(id));
  };

  const typeMapping = useMemo(() => {
    const layerIdSet = new Set(planLayers.map((l) => String(l.id)));
    const explicitLayerIdsByType = new Map<string, string[]>();
    for (const layer of planLayers) {
      if (SPECIAL_LAYER_IDS.has(String(layer.id))) continue;
      const typeIds = Array.isArray(layer.typeIds) ? layer.typeIds : [];
      for (const typeId of typeIds) {
        const list = explicitLayerIdsByType.get(typeId) || [];
        if (!list.includes(String(layer.id))) {
          list.push(String(layer.id));
          explicitLayerIdsByType.set(typeId, list);
        }
      }
    }
    const allTypeIds = new Set<string>();
    for (const def of objectTypes || []) allTypeIds.add(def.id);
    for (const obj of currentPlan?.objects || []) allTypeIds.add(obj.type);
    const effectiveLayerIdsByType = new Map<string, string[]>();
    for (const typeId of allTypeIds) {
      const explicit = explicitLayerIdsByType.get(typeId);
      if (explicit && explicit.length) {
        effectiveLayerIdsByType.set(typeId, explicit);
      } else {
        effectiveLayerIdsByType.set(typeId, inferDefaultLayerIds(typeId, layerIdSet));
      }
    }
    const typesByLayerId = new Map<string, string[]>();
    for (const layer of planLayers) typesByLayerId.set(String(layer.id), []);
    for (const [typeId, layerIds] of effectiveLayerIdsByType.entries()) {
      for (const layerId of layerIds) {
        const list = typesByLayerId.get(layerId) || [];
        if (!list.includes(typeId)) list.push(typeId);
        typesByLayerId.set(layerId, list);
      }
    }
    return { explicitLayerIdsByType, effectiveLayerIdsByType, typesByLayerId };
  }, [currentPlan?.objects, objectTypes, planLayers]);

  const objectCountsByLayer = useMemo(() => {
    const counts = new Map<string, Map<string, number>>();
    for (const layer of planLayers) counts.set(String(layer.id), new Map());
    for (const obj of currentPlan?.objects || []) {
      const explicitLayers = Array.isArray(obj.layerIds) && obj.layerIds.length ? obj.layerIds.map(String) : null;
      const layerIds = explicitLayers || typeMapping.effectiveLayerIdsByType.get(obj.type) || [];
      for (const layerId of layerIds) {
        const map = counts.get(layerId) || new Map();
        map.set(obj.type, (map.get(obj.type) || 0) + 1);
        counts.set(layerId, map);
      }
    }
    return counts;
  }, [currentPlan?.objects, planLayers, typeMapping.effectiveLayerIdsByType]);

  useEffect(() => {
    if (!layerModal) return;
    if (layerModal.mode === 'edit') {
      const layer = planLayers.find((l) => String(l.id) === String(layerModal.layerId));
      if (layer) {
        setDraftNameIt(layer.name?.it || '');
        setDraftNameEn(layer.name?.en || '');
        setDraftColor(layer.color || '#0ea5e9');
        const note = (layer as any).note;
        if (typeof note === 'string') {
          setDraftNoteIt(note);
          setDraftNoteEn('');
        } else {
          setDraftNoteIt(note?.it || '');
          setDraftNoteEn(note?.en || '');
        }
      }
    } else {
      setDraftNameIt('');
      setDraftNameEn('');
      setDraftColor('#0ea5e9');
      setDraftNoteIt('');
      setDraftNoteEn('');
    }
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [layerModal, planLayers]);

  const markClientPlansDirty = useCallback(() => {
    if (!currentClient) return;
    for (const site of currentClient.sites || []) {
      for (const plan of site.floorPlans || []) {
        setPlanDirty(plan.id, true);
      }
    }
  }, [currentClient, setPlanDirty]);

  const updateLayers = (nextLayers: LayerDefinition[], updateObjects?: (obj: any) => any) => {
    if (!currentClient) return;
    updateClientLayers(currentClient.id, nextLayers, updateObjects ? { updateObjects } : undefined);
    markClientPlansDirty();
  };

  const normalizeOrders = (layers: LayerDefinition[]) =>
    layers.map((layer, index) => ({ ...layer, order: index + 1 }));

  const handleCreateLayer = () => {
    if (!currentClient) return;
    const nameIt = draftNameIt.trim();
    const nameEn = draftNameEn.trim();
    const noteIt = draftNoteIt.trim();
    const noteEn = draftNoteEn.trim();
    if (!nameIt && !nameEn) return;
    const label = nameIt || nameEn;
    const base = slugify(label || 'layer');
    const existingIds = new Set(planLayers.map((l) => String(l.id)));
    let id = base ? `layer-${base}` : 'layer';
    let suffix = 1;
    while (existingIds.has(id)) {
      id = `${base ? `layer-${base}` : 'layer'}-${suffix}`;
      suffix += 1;
    }
    const maxOrder = planLayers.reduce((acc, l) => Math.max(acc, Number(l.order || 0)), 0);
    const nextLayer: LayerDefinition = {
      id,
      name: { it: nameIt || nameEn, en: nameEn || nameIt },
      color: draftColor || '#0ea5e9',
      order: maxOrder + 1,
      typeIds: [],
      ...(noteIt || noteEn ? { note: { it: noteIt || noteEn, en: noteEn || noteIt } } : {})
    };
    updateLayers([...planLayers, nextLayer]);
    push(t({ it: 'Layer creato', en: 'Layer created' }), 'success');
    setLayerModal(null);
  };

  const handleUpdateLayer = () => {
    if (!currentClient || !layerModal || layerModal.mode !== 'edit') return;
    const nameIt = draftNameIt.trim();
    const nameEn = draftNameEn.trim();
    const noteIt = draftNoteIt.trim();
    const noteEn = draftNoteEn.trim();
    if (!nameIt && !nameEn) return;
    const nextLayers = planLayers.map((layer) =>
      String(layer.id) === String(layerModal.layerId)
        ? {
            ...layer,
            name: { it: nameIt || nameEn, en: nameEn || nameIt },
            color: draftColor || '#0ea5e9',
            note: noteIt || noteEn ? { it: noteIt || noteEn, en: noteEn || noteIt } : undefined
          }
        : layer
    );
    updateLayers(nextLayers);
    push(t({ it: 'Layer aggiornato', en: 'Layer updated' }), 'success');
    setLayerModal(null);
  };

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    const idx = planLayers.findIndex((l) => String(l.id) === layerId);
    if (idx === -1) return;
    const editableIndices = planLayers
      .map((layer, index) => (!SPECIAL_LAYER_IDS.has(String(layer.id)) ? index : -1))
      .filter((index) => index >= 0);
    const editablePos = editableIndices.indexOf(idx);
    if (editablePos === -1) return;
    const targetPos = direction === 'up' ? editablePos - 1 : editablePos + 1;
    if (targetPos < 0 || targetPos >= editableIndices.length) return;
    const targetIndex = editableIndices[targetPos];
    const next = planLayers.slice();
    const temp = next[idx];
    next[idx] = next[targetIndex];
    next[targetIndex] = temp;
    updateLayers(normalizeOrders(next));
  };

  const handleDeleteLayer = () => {
    if (!currentClient || !confirmDelete) return;
    const layerId = String(confirmDelete.id);
    const nextLayers = planLayers.filter((l) => String(l.id) !== layerId);
    const updateObjects = (obj: any) => {
      if (!Array.isArray(obj.layerIds) || !obj.layerIds.length) return obj;
      const nextLayerIds = obj.layerIds.filter((id: string) => String(id) !== layerId);
      if (nextLayerIds.length === obj.layerIds.length) return obj;
      return nextLayerIds.length ? { ...obj, layerIds: nextLayerIds } : { ...obj, layerIds: undefined };
    };
    updateLayers(normalizeOrders(nextLayers), updateObjects);
    push(t({ it: 'Layer rimosso', en: 'Layer removed' }), 'info');
    setConfirmDelete(null);
  };

  const openTypeEditor = (layer: LayerDefinition) => {
    const explicit = Array.isArray(layer.typeIds) ? layer.typeIds : [];
    const effective = typeMapping.typesByLayerId.get(String(layer.id)) || [];
    const initial = explicit.length ? explicit : effective;
    setTypeEditor({ layerId: String(layer.id), typeIds: [...initial], query: '' });
  };

  const saveTypeEditor = () => {
    if (!currentClient || !typeEditor) return;
    const layer = planLayers.find((l) => String(l.id) === typeEditor.layerId);
    if (!layer) return;
    const prevTypeIds = Array.isArray(layer.typeIds) ? layer.typeIds : [];
    const nextTypeIds = [...new Set(typeEditor.typeIds)];
    const prevSet = new Set(prevTypeIds);
    const nextSet = new Set(nextTypeIds);
    const changedTypes = new Set<string>();
    for (const id of prevTypeIds) if (!nextSet.has(id)) changedTypes.add(id);
    for (const id of nextTypeIds) if (!prevSet.has(id)) changedTypes.add(id);
    const nextLayers = planLayers.map((l) => (String(l.id) === typeEditor.layerId ? { ...l, typeIds: nextTypeIds } : l));
    const updateObjects = (obj: any) => {
      if (!changedTypes.has(obj.type)) return obj;
      if (!Array.isArray(obj.layerIds) || !obj.layerIds.length) return obj;
      const currentLayerIds = obj.layerIds.map(String);
      const hasLayer = currentLayerIds.includes(typeEditor.layerId);
      let nextLayerIds = currentLayerIds;
      if (nextSet.has(obj.type)) {
        if (hasLayer) return obj;
        nextLayerIds = [...currentLayerIds, typeEditor.layerId];
      } else {
        if (!hasLayer) return obj;
        nextLayerIds = currentLayerIds.filter((id) => id !== typeEditor.layerId);
      }
      return nextLayerIds.length ? { ...obj, layerIds: nextLayerIds } : { ...obj, layerIds: undefined };
    };
    updateLayers(nextLayers, updateObjects);
    push(t({ it: 'Tipi layer aggiornati', en: 'Layer types updated' }), 'success');
    setTypeEditor(null);
  };

  const toggleTypeInEditor = (typeId: string) => {
    setTypeEditor((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.typeIds);
      if (set.has(typeId)) set.delete(typeId);
      else set.add(typeId);
      return { ...prev, typeIds: Array.from(set) };
    });
  };

  if (!planOptions.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-card">
        {t({ it: 'Nessuna planimetria disponibile.', en: 'No floor plans available.' })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Gestione layers', en: 'Layers management' })}</div>
          <div className="mt-1 text-xs text-slate-500">
            {t({
              it: 'I layers definiscono cosa è visibile in mappa e come assegnare gli oggetti per tipologia.',
              en: 'Layers define what is visible on the map and how objects are assigned by type.'
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <Search size={14} />
            <input
              value={layerQuery}
              onChange={(e) => setLayerQuery(e.target.value)}
              placeholder={t({ it: 'Cerca layer…', en: 'Search layers…' })}
              className="w-40 bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink"
            title={t({ it: 'Seleziona planimetria', en: 'Select floor plan' })}
          >
            {planOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setLayerModal({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            title={t({ it: 'Aggiungi layer', en: 'Add layer' })}
          >
            <Plus size={16} />
            {t({ it: 'Nuovo layer', en: 'New layer' })}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600">
            <Info size={16} />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-ink">{t({ it: 'Come funzionano i layers', en: 'How layers work' })}</div>
            <div className="mt-1 text-xs text-slate-500">
              {t({
                it: 'Un layer può includere più tipologie di oggetti. Le tipologie con bordo tratteggiato sono assegnate automaticamente (default). Puoi personalizzarle e applicare le modifiche agli oggetti esistenti. Rooms e Cabling sono layers di sistema e non si modificano qui.',
                en: 'A layer can include multiple object types. Types with a dashed border are assigned automatically (default). You can customize them and apply changes to existing objects. Rooms and Cabling are system layers and are not edited here.'
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredEditableLayers.map((layer, index) => {
          const layerId = String(layer.id);
          const explicitSet = new Set(Array.isArray(layer.typeIds) ? layer.typeIds : []);
          const typeIds = (typeMapping.typesByLayerId.get(layerId) || []).slice().sort((a, b) => resolveTypeLabel(a).localeCompare(resolveTypeLabel(b)));
          const counts = objectCountsByLayer.get(layerId) || new Map();
          const totalObjects = Array.from(counts.values()).reduce((acc, v) => acc + v, 0);
          const isSpecial = SPECIAL_LAYER_IDS.has(layerId);
          const isLockedDelete = isSpecial;
          return (
            <div key={layerId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: layer.color || '#94a3b8' }} />
                  <div>
                    <div className="text-sm font-semibold text-ink">{resolveLayerLabel(layer)}</div>
                    <div className="text-xs text-slate-500">
                      {t({ it: 'ID', en: 'ID' })}: {layerId} • {t({ it: 'Oggetti', en: 'Objects' })}: {totalObjects}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMoveLayer(layerId, 'up')}
                    disabled={index === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    title={t({ it: 'Sposta su', en: 'Move up' })}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMoveLayer(layerId, 'down')}
                    disabled={index === filteredEditableLayers.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    title={t({ it: 'Sposta giù', en: 'Move down' })}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => setLayerModal({ mode: 'edit', layerId })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Modifica layer', en: 'Edit layer' })}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(layer)}
                    disabled={isLockedDelete}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                    title={
                      isLockedDelete
                        ? t({ it: 'Layer di sistema non eliminabile', en: 'System layer cannot be deleted' })
                        : t({ it: 'Elimina layer', en: 'Delete layer' })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Tipi oggetti', en: 'Object types' })}</div>
                  {!isSpecial ? (
                    <button
                      onClick={() => openTypeEditor(layer)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Gestisci tipi', en: 'Manage types' })}
                    >
                      <Pencil size={12} /> {t({ it: 'Gestisci', en: 'Manage' })}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {layerId === 'rooms'
                        ? t({ it: 'Layer dedicato alle stanze.', en: 'Dedicated to rooms.' })
                        : t({ it: 'Layer dedicato ai collegamenti.', en: 'Dedicated to links.' })}
                    </span>
                  )}
                </div>
                {typeIds.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {typeIds.map((typeId) => {
                      const label = resolveTypeLabel(typeId);
                      const count = counts.get(typeId) || 0;
                      const isExplicit = explicitSet.has(typeId);
                      return (
                        <span
                          key={`${layerId}-${typeId}`}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                            isExplicit ? 'border-slate-200 bg-white text-slate-700' : 'border-dashed border-slate-300 bg-slate-50 text-slate-600'
                          }`}
                          title={isExplicit ? t({ it: 'Assegnazione esplicita', en: 'Explicit assignment' }) : t({ it: 'Assegnazione automatica', en: 'Automatic assignment' })}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-primary">
                            <Icon name={objectTypeById.get(typeId)?.icon} />
                          </span>
                          <span className="max-w-[150px] truncate">{label}</span>
                          <span className="text-slate-400">({count})</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {t({ it: 'Nessun tipo assegnato.', en: 'No types assigned.' })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!filteredEditableLayers.length && !filteredSystemLayers.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          {t({ it: 'Nessun layer trovato.', en: 'No layers found.' })}
        </div>
      ) : null}

      {filteredSystemLayers.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t({ it: 'Layers di sistema', en: 'System layers' })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {filteredSystemLayers.map((layer) => (
              <span
                key={layer.id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: layer.color || '#94a3b8' }} />
                {resolveLayerLabel(layer)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <Transition show={!!layerModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setLayerModal(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between gap-3">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {layerModal?.mode === 'edit' ? t({ it: 'Modifica layer', en: 'Edit layer' }) : t({ it: 'Nuovo layer', en: 'New layer' })}
                    </Dialog.Title>
                    <button onClick={() => setLayerModal(null)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Nome (IT)', en: 'Name (IT)' })}
                      <input
                        ref={nameRef}
                        value={draftNameIt}
                        onChange={(e) => setDraftNameIt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. Dispositivi critici', en: 'e.g. Critical devices' })}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Nome (EN)', en: 'Name (EN)' })}
                      <input
                        value={draftNameEn}
                        onChange={(e) => setDraftNameEn(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. Critical devices', en: 'e.g. Critical devices' })}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Colore', en: 'Color' })}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={draftColor}
                          onChange={(e) => setDraftColor(e.target.value)}
                          className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-1"
                          aria-label={t({ it: 'Colore layer', en: 'Layer color' })}
                        />
                        <input
                          value={draftColor}
                          onChange={(e) => setDraftColor(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-mono outline-none ring-primary/30 focus:ring-2"
                          placeholder="#0ea5e9"
                        />
                      </div>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Nota (IT)', en: 'Note (IT)' })}
                      <textarea
                        value={draftNoteIt}
                        onChange={(e) => setDraftNoteIt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Nota opzionale per il layer', en: 'Optional note for the layer' })}
                        rows={2}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {t({ it: 'Nota (EN)', en: 'Note (EN)' })}
                      <textarea
                        value={draftNoteEn}
                        onChange={(e) => setDraftNoteEn(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Optional note for the layer', en: 'Optional note for the layer' })}
                        rows={2}
                      />
                    </label>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      onClick={() => setLayerModal(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={layerModal?.mode === 'edit' ? handleUpdateLayer : handleCreateLayer}
                      disabled={!draftNameIt.trim() && !draftNameEn.trim()}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {layerModal?.mode === 'edit' ? t({ it: 'Salva', en: 'Save' }) : t({ it: 'Crea layer', en: 'Create layer' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!typeEditor} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setTypeEditor(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between gap-3">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Tipi per layer', en: 'Layer types' })}
                    </Dialog.Title>
                    <button onClick={() => setTypeEditor(null)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: 'Seleziona le tipologie di oggetti che fanno parte del layer. Gli oggetti esistenti con layer espliciti verranno aggiornati.',
                      en: 'Select which object types belong to this layer. Existing objects with explicit layers will be updated.'
                    })}
                  </Dialog.Description>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      <Search size={14} />
                      <input
                        value={typeEditor?.query || ''}
                        onChange={(e) => setTypeEditor((prev) => (prev ? { ...prev, query: e.target.value } : prev))}
                        placeholder={t({ it: 'Cerca tipologia...', en: 'Search type...' })}
                        className="w-48 bg-transparent text-sm outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTypeEditor((prev) => (prev ? { ...prev, typeIds: typeOptions.map((o) => o.id) } : prev))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Seleziona tutti', en: 'Select all' })}
                      </button>
                      <button
                        onClick={() => setTypeEditor((prev) => (prev ? { ...prev, typeIds: [] } : prev))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Svuota', en: 'Clear' })}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {typeOptions
                      .filter((opt) => opt.label.toLowerCase().includes((typeEditor?.query || '').trim().toLowerCase()))
                      .map((opt) => {
                        const selected = !!typeEditor?.typeIds.includes(opt.id);
                        const count = objectCountsByLayer.get(typeEditor?.layerId || '')?.get(opt.id) || 0;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleTypeInEditor(opt.id)}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                              selected ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${selected ? 'border-primary/20 bg-white' : 'border-slate-200 bg-white'} text-primary`}>
                                <Icon name={opt.icon} />
                              </span>
                              <span className="truncate font-semibold">{opt.label}</span>
                            </span>
                            <span className="text-xs text-slate-400">{count}</span>
                          </button>
                        );
                      })}
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      onClick={() => setTypeEditor(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={saveTypeEditor}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                    >
                      {t({ it: 'Salva tipi', en: 'Save types' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!confirmDelete} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setConfirmDelete(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Eliminare layer?', en: 'Delete layer?' })}</Dialog.Title>
                    <button onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <Dialog.Description className="mt-2 text-sm text-slate-600">
                    {t({
                      it: `Stai per eliminare il layer "${confirmDelete ? resolveLayerLabel(confirmDelete) : ''}". Gli oggetti assegnati verranno aggiornati.`,
                      en: `You are about to delete the layer "${confirmDelete ? resolveLayerLabel(confirmDelete) : ''}". Assigned objects will be updated.`
                    })}
                  </Dialog.Description>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={handleDeleteLayer}
                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
                    >
                      {t({ it: 'Elimina', en: 'Delete' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default LayersPanel;
