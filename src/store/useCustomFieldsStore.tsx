import { create } from 'zustand';
import type { CustomField } from '../api/customFields';
import { fetchCustomFields, fetchObjectCustomValues, saveObjectCustomValues } from '../api/customFields';

interface State {
  fields: CustomField[];
  hydrated: boolean;
  valuesByObjectId: Record<string, Record<string, any>>;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  getFieldsForType: (typeId: string) => CustomField[];
  loadObjectValues: (objectId: string) => Promise<Record<string, any>>;
  saveObjectValues: (objectId: string, typeId: string, values: Record<string, any>) => Promise<void>;
  clearObjectCache: (objectId: string) => void;
}

export const useCustomFieldsStore = create<State>()((set, get) => ({
  fields: [],
  hydrated: false,
  valuesByObjectId: {},
  hydrate: async () => {
    try {
      const res = await fetchCustomFields();
      set({ fields: res.fields || [], hydrated: true });
    } catch {
      set({ fields: [], hydrated: true });
    }
  },
  refresh: async () => {
    const res = await fetchCustomFields();
    set({ fields: res.fields || [], hydrated: true });
  },
  getFieldsForType: (typeId) => get().fields.filter((f) => f.typeId === typeId),
  loadObjectValues: async (objectId) => {
    const cached = get().valuesByObjectId[objectId];
    if (cached) return cached;
    const res = await fetchObjectCustomValues(objectId);
    const values = (res && typeof res.values === 'object' ? res.values : {}) as Record<string, any>;
    set((s) => ({ valuesByObjectId: { ...s.valuesByObjectId, [objectId]: values } }));
    return values;
  },
  saveObjectValues: async (objectId, typeId, values) => {
    await saveObjectCustomValues(objectId, { typeId, values });
    set((s) => ({ valuesByObjectId: { ...s.valuesByObjectId, [objectId]: values } }));
  },
  clearObjectCache: (objectId) =>
    set((s) => {
      const next = { ...s.valuesByObjectId };
      delete next[objectId];
      return { valuesByObjectId: next };
    })
}));

