import { useEffect, useState } from 'react';
import { loadReleaseHistory, type ReleaseNote } from './history';

let cached: ReleaseNote[] | null = null;

/** Lazily loads the release notes; returns [] until loaded (or while `enabled` is false). */
export const useReleaseHistory = (enabled = true): ReleaseNote[] => {
  const [history, setHistory] = useState<ReleaseNote[]>(() => cached || []);
  useEffect(() => {
    if (!enabled || cached) return;
    let cancelled = false;
    loadReleaseHistory().then((rows) => {
      cached = rows;
      if (!cancelled) setHistory(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return history;
};
