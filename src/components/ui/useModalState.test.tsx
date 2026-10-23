// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModalState } from './useModalState';

describe('modal draft lifecycle', () => {
  it('preserves edits on rerender and during close, then resets before reopening', () => {
    const { result, rerender } = renderHook(({ open, name }) => useModalState(open, name, [name]), {
      initialProps: { open: true, name: 'Initial' }
    });
    const setter = result.current[1];
    act(() => setter('Edited'));
    rerender({ open: true, name: 'Initial' });
    expect(result.current[0]).toBe('Edited');
    rerender({ open: false, name: 'Initial' });
    expect(result.current[0]).toBe('Edited');
    rerender({ open: true, name: 'Initial' });
    expect(result.current[0]).toBe('Initial');
    expect(result.current[1]).toBe(setter);
  });

  it('resets for changed source data only when the modal is open', () => {
    const { result, rerender } = renderHook(({ open, id }) => useModalState(open, () => ({ id, text: '' }), [id]), {
      initialProps: { open: true, id: 'a' }
    });
    act(() => result.current[1]((previous) => ({ ...previous, text: 'Draft' })));
    rerender({ open: false, id: 'b' });
    expect(result.current[0]).toEqual({ id: 'a', text: 'Draft' });
    rerender({ open: true, id: 'b' });
    expect(result.current[0]).toEqual({ id: 'b', text: '' });
    rerender({ open: true, id: 'c' });
    expect(result.current[0]).toEqual({ id: 'c', text: '' });
  });
});
