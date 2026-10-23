import { describe, expect, it } from 'vitest';
import type { Client, LayerDefinition } from './types';
import { DEFAULT_LAYER_IDS, defaultLayers, normalizeClientLayers } from './dataStoreClientNormalization';

const clientWith = (layers: LayerDefinition[]): Client =>
  ({ id: 'c1', name: 'Client', layers, sites: [] } as unknown as Client);

// Regression coverage for "preconfigured layers cannot be deleted despite a success
// message": normalizeClientLayers re-seeds any missing preconfigured layer, so the UI
// must never offer those for deletion. DEFAULT_LAYER_IDS is the set the UI locks on.
describe('preconfigured layers protection', () => {
  it('DEFAULT_LAYER_IDS is derived from defaultLayers() (single source of truth)', () => {
    const ids = defaultLayers().map((layer) => String(layer.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids)).toEqual(new Set(DEFAULT_LAYER_IDS));
  });

  it('normalizeClientLayers re-seeds a deleted preconfigured layer (the root cause)', () => {
    const withoutWifi = defaultLayers().filter((layer) => layer.id !== 'wifi');
    expect(withoutWifi.some((layer) => layer.id === 'wifi')).toBe(false);
    const result = normalizeClientLayers(clientWith(withoutWifi));
    expect(result.some((layer) => layer.id === 'wifi')).toBe(true);
  });

  it('every layer that normalization re-adds is covered by DEFAULT_LAYER_IDS (no unprotected gap)', () => {
    for (const layer of defaultLayers()) {
      const without = defaultLayers().filter((entry) => entry.id !== layer.id);
      const result = normalizeClientLayers(clientWith(without));
      const reAdded = result
        .filter((entry) => !without.some((kept) => kept.id === entry.id))
        .map((entry) => String(entry.id));
      expect(reAdded).toContain(String(layer.id));
      for (const id of reAdded) expect(DEFAULT_LAYER_IDS.has(id)).toBe(true);
    }
  });

  it('a custom (non-preconfigured) layer is NOT re-seeded, so it stays deletable', () => {
    const custom: LayerDefinition = {
      id: 'my-custom-layer',
      name: { it: 'Mio layer', en: 'My layer' },
      color: '#123456',
      order: 99,
      typeIds: []
    };
    const withCustom = normalizeClientLayers(clientWith([...defaultLayers(), custom]));
    expect(withCustom.some((layer) => layer.id === 'my-custom-layer')).toBe(true);

    const afterDelete = normalizeClientLayers(clientWith(withCustom.filter((layer) => layer.id !== 'my-custom-layer')));
    expect(afterDelete.some((layer) => layer.id === 'my-custom-layer')).toBe(false);
    expect(DEFAULT_LAYER_IDS.has('my-custom-layer')).toBe(false);
  });
});
