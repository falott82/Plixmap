import { beforeEach, describe, expect, it } from 'vitest';
import type { ObjectTypeDefinition } from './types';
import { useDataStore } from './useDataStore';

const type = (id: string, builtin?: boolean): ObjectTypeDefinition =>
  ({ id, name: { it: id, en: id }, icon: 'user', ...(builtin ? { builtin: true } : {}) } as ObjectTypeDefinition);

const clientUsing = (typeId: string) =>
  ({
    id: 'c1',
    name: 'Client',
    layers: [],
    sites: [{ id: 's1', name: 'Site', floorPlans: [{ id: 'p1', name: 'Plan', objects: [{ id: 'o1', type: typeId }] }] }]
  }) as any;

// deleteObjectType must report the real outcome (boolean) so the UI can never show a
// success toast for a deletion that was silently refused.
describe('deleteObjectType', () => {
  beforeEach(() => {
    useDataStore.setState({
      objectTypes: [type('builtin_t', true), type('custom_free'), type('custom_used')],
      clients: [clientUsing('custom_used')],
      version: 1
    } as any);
  });

  it('refuses built-in types and keeps them', () => {
    expect(useDataStore.getState().deleteObjectType('builtin_t')).toBe(false);
    expect(useDataStore.getState().objectTypes.some((entry) => entry.id === 'builtin_t')).toBe(true);
  });

  it('refuses a custom type that is still placed on a floor plan', () => {
    expect(useDataStore.getState().deleteObjectType('custom_used')).toBe(false);
    expect(useDataStore.getState().objectTypes.some((entry) => entry.id === 'custom_used')).toBe(true);
  });

  it('deletes a free custom type, bumps the version and returns true', () => {
    const before = useDataStore.getState().version;
    expect(useDataStore.getState().deleteObjectType('custom_free')).toBe(true);
    const state = useDataStore.getState();
    expect(state.objectTypes.some((entry) => entry.id === 'custom_free')).toBe(false);
    expect(state.version).toBe(before + 1);
  });

  it('returns false for an unknown id without touching state', () => {
    const before = useDataStore.getState().objectTypes.length;
    expect(useDataStore.getState().deleteObjectType('does-not-exist')).toBe(false);
    expect(useDataStore.getState().objectTypes.length).toBe(before);
  });
});
