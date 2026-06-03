import { describe, it, expect } from 'vitest';
import { computeModalInitials, type ModalInitialsDeps } from './planViewModalInitials';

const baseDeps = (): ModalInitialsDeps => ({
  modalState: null,
  renderPlan: { id: 'p1', objects: [] } as any,
  renderPlanObjectById: new Map(),
  layerIdSet: new Set<string>(),
  defaultObjectScale: 1,
  getTypeLayerIds: () => null,
  inferDefaultLayerIds: () => ['desks'],
  formatQuoteLabel: () => null,
  lastQuoteLabelScale: 1,
  lastQuoteLabelBg: false,
  lastQuoteLabelPosH: 'center',
  lastQuoteDashed: false,
  lastQuoteEndpoint: 'none',
  lastQuoteColor: '#f97316',
  lastQuoteLabelColor: '#0f172a'
});

describe('computeModalInitials', () => {
  it('returns null without modalState or renderPlan', () => {
    expect(computeModalInitials(baseDeps())).toBeNull();
    expect(computeModalInitials({ ...baseDeps(), modalState: { mode: 'create', type: 'desk', coords: { x: 0, y: 0 } }, renderPlan: undefined })).toBeNull();
  });

  it('create mode: empty name/description, inferred layer ids, default scale', () => {
    const res = computeModalInitials({
      ...baseDeps(),
      modalState: { mode: 'create', type: 'desk' as any, coords: { x: 0, y: 0 } }
    });
    expect(res).toMatchObject({ type: 'desk', name: '', description: '', layerIds: ['desks'], scale: 1 });
  });

  it('create mode quote: forces quotes layer and quote defaults', () => {
    const res: any = computeModalInitials({
      ...baseDeps(),
      modalState: { mode: 'create', type: 'quote' as any, coords: { x: 0, y: 0 } }
    });
    expect(res.layerIds).toEqual(['quotes']);
    expect(res.quoteColor).toBe('#f97316');
    expect(res.quoteLabelPos).toBe('center');
  });

  it('edit mode: pulls name/description from the existing object', () => {
    const obj = { id: 'o1', type: 'desk', name: 'Desk 1', description: 'note', layerIds: ['desks'], scale: 2, points: [] };
    const res = computeModalInitials({
      ...baseDeps(),
      modalState: { mode: 'edit', objectId: 'o1' },
      renderPlanObjectById: new Map([['o1', obj as any]])
    });
    expect(res).toMatchObject({ type: 'desk', name: 'Desk 1', description: 'note', scale: 2 });
  });

  it('duplicate mode: clears name/description but keeps type', () => {
    const obj = { id: 'o1', type: 'desk', name: 'Desk 1', description: 'note', layerIds: ['desks'], points: [] };
    const res = computeModalInitials({
      ...baseDeps(),
      modalState: { mode: 'duplicate', objectId: 'o1', coords: { x: 5, y: 5 } },
      renderPlanObjectById: new Map([['o1', obj as any]])
    });
    expect(res).toMatchObject({ type: 'desk', name: '', description: '' });
  });
});
