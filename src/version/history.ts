import type { ReleaseNote } from './history/types';

export type { ReleaseNote } from './history/types';
export { APP_VERSION } from './current';

// The full release history is large and only needed when the changelog UI is
// opened, so it is loaded on demand and cached.
let pending: Promise<ReleaseNote[]> | null = null;
export const loadReleaseHistory = (): Promise<ReleaseNote[]> => {
  if (!pending) pending = import('./history/all').then((m) => m.releaseHistory);
  return pending;
};
