/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import { DEFAULT_WALL_TYPES, WALL_TYPE_IDS } from '../../store/data';
import { isDeskType } from './deskTypes';
import { computeInferDefaultLayerIds } from './planViewComputeBits';

// Object-type catalog derivations (type maps, wall/door/desk classification, label/icon
// resolvers, layer inference) extracted from usePlanView. Pure functions of the store's
// objectTypes list + the active language; bodies moved verbatim.
export const usePlanTypeCatalog = (objectTypeDefs: any[] | undefined, lang: string) => {
  const objectTypeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const def of objectTypeDefs || []) map.set(def.id, def);
    return map;
  }, [objectTypeDefs]);
  const wallTypeIdSet = useMemo(() => {
    const ids = new Set<string>(WALL_TYPE_IDS as string[]);
    for (const def of objectTypeDefs || []) {
      if ((def as any)?.category === 'wall') ids.add(def.id);
    }
    return ids;
  }, [objectTypeDefs]);
  const wallTypeDefs = useMemo(
    () => (objectTypeDefs || []).filter((def) => wallTypeIdSet.has(def.id)),
    [objectTypeDefs, wallTypeIdSet]
  );
  const doorTypeIdSet = useMemo(() => {
    const ids = new Set<string>();
    for (const def of objectTypeDefs || []) {
      if ((def as any)?.category === 'door') ids.add(def.id);
    }
    return ids;
  }, [objectTypeDefs]);
  const doorTypeDefs = useMemo(
    () =>
      (objectTypeDefs || [])
        .filter((def) => doorTypeIdSet.has(def.id))
        .slice()
        .sort((a, b) => ((a?.name?.[lang] as string) || a.id).localeCompare((b?.name?.[lang] as string) || b.id)),
    [doorTypeIdSet, lang, objectTypeDefs]
  );
  const defaultDoorCatalogId = useMemo(() => {
    if (doorTypeIdSet.has('door_standard')) return 'door_standard';
    return doorTypeDefs[0]?.id || '';
  }, [doorTypeDefs, doorTypeIdSet]);
  const deskCatalogDefs = useMemo(
    () => (objectTypeDefs || []).filter((def) => isDeskType(def.id)),
    [objectTypeDefs]
  );
  const wallAttenuationByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const def of wallTypeDefs || []) {
      const value = Number((def as any).attenuationDb);
      if (Number.isFinite(value) && value > 0) {
        map.set(def.id, value);
      }
    }
    return map;
  }, [wallTypeDefs]);
  const defaultWallTypeId = useMemo(() => {
    if (wallTypeIdSet.has('wall_brick')) return 'wall_brick';
    return wallTypeDefs[0]?.id || DEFAULT_WALL_TYPES[0];
  }, [wallTypeDefs, wallTypeIdSet]);

  const getTypeLabel = useCallback(
    (typeId: string) => {
      const def = objectTypeById.get(typeId);
      return (def?.name?.[lang] as string) || (def?.name?.it as string) || typeId;
    },
    [lang, objectTypeById]
  );

  const getTypeIcon = useCallback((typeId: string) => objectTypeById.get(typeId)?.icon, [objectTypeById]);
  const isWallType = useCallback((typeId: string) => wallTypeIdSet.has(typeId), [wallTypeIdSet]);
  const isDoorType = useCallback((typeId: string) => doorTypeIdSet.has(typeId), [doorTypeIdSet]);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [lang]
  );
  const formatNumber = useCallback(
    (value: number) => (Number.isFinite(value) ? numberFormatter.format(value) : '--'),
    [numberFormatter]
  );
  const getLayerNote = useCallback(
    (layer: any) => {
      const note = layer?.note;
      if (!note) return '';
      if (typeof note === 'string') return note;
      return String(note?.[lang] || note?.it || note?.en || '').trim();
    },
    [lang]
  );

  const objectTypeIcons = useMemo(() => {
    const out: Record<string, any> = {};
    for (const def of objectTypeDefs || []) out[def.id] = def.icon;
    return out;
  }, [objectTypeDefs]);

  const objectTypeLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const def of objectTypeDefs || []) out[def.id] = getTypeLabel(def.id);
    return out;
  }, [getTypeLabel, objectTypeDefs]);

  const isCameraType = useCallback((typeId: string) => typeId === 'camera', []);

  const inferDefaultLayerIds = useCallback(
    (typeId: string, layerIdSet?: Set<string>) =>
      computeInferDefaultLayerIds(typeId, layerIdSet, { isDeskType, isCameraType, isWallType }),
    [isCameraType, isWallType]
  );
  const normalizeVisibleLayerIdsByPlan = useCallback((input?: Record<string, string[]>) => {
    const out: Record<string, string[]> = {};
    for (const [planId, ids] of Object.entries(input || {})) {
      if (!Array.isArray(ids)) continue;
      const uniq = Array.from(new Set(ids.map((id) => String(id))));
      uniq.sort();
      out[planId] = uniq;
    }
    return out;
  }, []);

  return {
    objectTypeById,
    wallTypeIdSet,
    wallTypeDefs,
    doorTypeIdSet,
    doorTypeDefs,
    defaultDoorCatalogId,
    deskCatalogDefs,
    wallAttenuationByType,
    defaultWallTypeId,
    getTypeLabel,
    getTypeIcon,
    isWallType,
    isDoorType,
    numberFormatter,
    formatNumber,
    getLayerNote,
    objectTypeIcons,
    objectTypeLabels,
    isCameraType,
    inferDefaultLayerIds,
    normalizeVisibleLayerIdsByPlan,
  };
};
