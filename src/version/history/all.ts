import type { ReleaseNote } from './types';
import { partRecent } from './partRecent';
import { partMid } from './partMid';
import { partEarly } from './partEarly';

export type { ReleaseNote } from './types';

// Release notes, newest first. Split into era chunks to keep each file < 2k lines;
// the public surface (releaseHistory + ReleaseNote) is unchanged.
export const releaseHistory: ReleaseNote[] = [...partRecent, ...partMid, ...partEarly];
