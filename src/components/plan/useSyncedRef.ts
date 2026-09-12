import { useEffect, type MutableRefObject } from 'react';

/**
 * Keep a ref in sync with the latest value of a reactive prop/state, so callbacks
 * and effects can read the current value without listing it as a dependency.
 * Replaces the repeated `useEffect(() => { ref.current = value; }, [value])`
 * boilerplate (extracted from usePlanView).
 */
export function useSyncedRef<T>(ref: MutableRefObject<T>, value: T): void {
  useEffect(() => {
    ref.current = value;
  }, [value]);
}
