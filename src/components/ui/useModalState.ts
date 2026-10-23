import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

const initialValue = <T,>(value: T | (() => T)): T =>
  typeof value === 'function' ? (value as () => T)() : value;

// Reset local form state before painting a new modal session. Closing preserves
// the draft for exit animations; ordinary renders preserve edits and setter identity.
export function useModalState<T>(open: boolean, initialState: T | (() => T), inputs: readonly unknown[] = []): [T, Dispatch<SetStateAction<T>>] {
  const keys = [open, ...inputs];
  const [snapshot, setSnapshot] = useState(() => ({ keys, value: initialValue(initialState) }));
  let current = snapshot;
  if (keys.length !== snapshot.keys.length || keys.some((key, index) => !Object.is(key, snapshot.keys[index]))) {
    current = { keys, value: open ? initialValue(initialState) : snapshot.value };
    setSnapshot(current);
  }
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setSnapshot((previous) => ({
      ...previous,
      value: typeof action === 'function' ? (action as (value: T) => T)(previous.value) : action
    }));
  }, []);
  return [current.value, setValue];
}
