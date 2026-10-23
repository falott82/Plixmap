// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePlanScaleModeHandlers } from './usePlanScaleModeHandlers';

describe('usePlanScaleModeHandlers', () => {
  it('renders without a scale draft and accepts the first calibration point', () => {
    const setScaleDraft = vi.fn();
    const setScaleDraftPointer = vi.fn();
    const { result } = renderHook(() => usePlanScaleModeHandlers({
      scaleMode: true,
      scaleDraft: null,
      setScaleDraft,
      setScaleDraftPointer
    }));
    act(() => result.current.handleScalePoint({ x: 10, y: 20 }));
    expect(setScaleDraft).toHaveBeenCalledWith({ start: { x: 10, y: 20 } });
    expect(setScaleDraftPointer).toHaveBeenCalledWith(null);
  });
});
