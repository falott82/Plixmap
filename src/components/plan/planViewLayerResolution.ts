import { ALL_ITEMS_LAYER_ID, SYSTEM_LAYER_IDS } from '../../store/data';
import type { MapObject } from '../../store/types';

// Layer-resolution helpers extracted from usePlanView: map an object/type to the
// layer ids that should govern its visibility. Bodies are verbatim; the hook
// keeps thin useCallback wrappers that inject planLayers + the default-layer
// inference closure.

export const computeGetTypeLayerIds = (typeId: string, planLayers: any[]): string[] | null => {
  const matched = planLayers
    .filter((l: any) => !SYSTEM_LAYER_IDS.has(String(l.id)) && Array.isArray(l.typeIds) && l.typeIds.includes(typeId))
    .map((l: any) => String(l.id));
  return matched.length ? matched : null;
};

export type LayerIdsForTypeDeps = {
  planLayers: any[];
  inferDefaultLayerIds: (typeId: string, layerIdSet?: Set<string>) => string[];
  layerIdSet: Set<string>;
};

export const computeGetLayerIdsForType = (typeId: string, deps: LayerIdsForTypeDeps): string[] => {
  const { planLayers, inferDefaultLayerIds, layerIdSet } = deps;
  const mapped = computeGetTypeLayerIds(typeId, planLayers);
  const fallback = inferDefaultLayerIds(typeId, layerIdSet);
  const raw = (mapped?.length ? mapped : fallback).map((id) => String(id)).filter((id) => id !== ALL_ITEMS_LAYER_ID);
  if (typeId === 'real_user') {
    const preferred = raw.filter((id) => id !== 'users');
    if (preferred.length) return Array.from(new Set(preferred));
  }
  return Array.from(new Set(raw));
};

export const computeGetObjectLayerIdsForVisibility = (obj: MapObject, deps: LayerIdsForTypeDeps): string[] => {
  const explicit = (Array.isArray(obj.layerIds) ? obj.layerIds : [])
    .map((id) => String(id))
    .filter((id) => id !== ALL_ITEMS_LAYER_ID);
  const typeLayers = computeGetLayerIdsForType(obj.type, deps);
  if (obj.type === 'real_user') {
    const explicitPreferred = explicit.filter((id) => id !== 'users');
    if (explicitPreferred.length) return Array.from(new Set(explicitPreferred));
    if (typeLayers.length) return typeLayers;
    return explicit;
  }
  return explicit.length ? Array.from(new Set(explicit)) : typeLayers;
};
