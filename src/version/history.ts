import type { ReleaseNote } from './history/types';
import { partRecent } from './history/partRecent';
import { partMid } from './history/partMid';
import { partEarly } from './history/partEarly';

export type { ReleaseNote } from './history/types';

// Release notes, newest first. Split into era chunks to keep each file < 2k lines;
// the public surface (releaseHistory + ReleaseNote) is unchanged.
export const releaseHistory: ReleaseNote[] = [...partRecent, ...partMid, ...partEarly];
