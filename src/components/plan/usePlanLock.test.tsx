// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlanLock, type UsePlanLockDeps } from './usePlanLock';

// t() just returns the English variant — enough to exercise the templating.
const t = ((m: { it: string; en: string }) => m.en) as UsePlanLockDeps['t'];
const baseLock: UsePlanLockDeps['lockState'] = { lockedBy: null, mine: false, grant: null, meta: null };
const render = (lockState: UsePlanLockDeps['lockState']) => renderHook(() => usePlanLock({ t, lockState }));

describe('usePlanLock.formatMinutes', () => {
  it('handles null/undefined/NaN, the 0.5 special case, integers, and rounds to one decimal', () => {
    const f = render(baseLock).result.current.formatMinutes;
    expect(f(null)).toBe('—');
    expect(f(undefined)).toBe('—');
    expect(f(Number.NaN)).toBe('—');
    expect(f(0.5)).toBe('0,5');
    expect(f(5)).toBe('5');
    expect(f(1.23)).toBe('1.2');
  });
});

describe('usePlanLock.grantRemainingMinutes', () => {
  it('is null without a grant', () => {
    expect(render(baseLock).result.current.grantRemainingMinutes).toBeNull();
  });
  it('is 0 once the grant has expired', () => {
    const expired = { ...baseLock, grant: { userId: 'u', username: 'x', expiresAt: Date.now() - 1000 } };
    expect(render(expired).result.current.grantRemainingMinutes).toBe(0);
  });
  it('reports the minutes left for a future grant (rounded to 0.5)', () => {
    const future = { ...baseLock, grant: { userId: 'u', username: 'x', expiresAt: Date.now() + 5 * 60_000 } };
    const m = render(future).result.current.grantRemainingMinutes;
    expect(m).toBeGreaterThan(4);
    expect(m).toBeLessThanOrEqual(5);
  });
});

describe('usePlanLock.lockedByTitle', () => {
  it('names the lock holder', () => {
    const held = { ...baseLock, lockedBy: { userId: 'u', username: 'Mario' } };
    expect(render(held).result.current.lockedByTitle).toContain('Mario');
  });
});

describe('usePlanLock outside-click', () => {
  it('a mousedown outside the popover closes it, inside keeps it open', () => {
    const { result } = render(baseLock);

    const inside = document.createElement('div');
    document.body.appendChild(inside);
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    act(() => {
      result.current.lockInfoRef.current = inside as HTMLDivElement;
      result.current.setLockInfoOpen(true);
    });
    expect(result.current.lockInfoOpen).toBe(true);

    act(() => {
      inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.lockInfoOpen, 'click inside keeps it open').toBe(true);

    act(() => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.lockInfoOpen, 'click outside closes it').toBe(false);

    inside.remove();
    outside.remove();
  });
});
