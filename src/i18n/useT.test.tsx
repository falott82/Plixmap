// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useT } from './useT';

const state = vi.hoisted(() => ({ language: 'it' }));
vi.mock('../store/useAuthStore', () => ({
  useAuthStore: (selector: (value: { user: { language: string } }) => unknown) => selector({ user: state })
}));

describe('translation callback identity', () => {
  it('stays stable while the language is unchanged and switches with the language', () => {
    const { result, rerender } = renderHook(() => useT());
    const italian = result.current;
    expect(italian({ it: 'Ciao', en: 'Hello' })).toBe('Ciao');
    rerender();
    expect(result.current).toBe(italian);
    state.language = 'en';
    rerender();
    expect(result.current).not.toBe(italian);
    expect(result.current({ it: 'Ciao', en: 'Hello' })).toBe('Hello');
    state.language = 'it';
  });
});
