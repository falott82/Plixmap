import type { PlanSnapshotComparable } from './planSnapshotCompare';

export type RevisionLike = {
  id?: string;
  createdAt?: number | string;
  revMajor?: number;
  revMinor?: number;
  version?: number;
  imageUrl?: string;
  width?: number;
  height?: number;
  scale?: any;
  safetyCardLayout?: any;
  objects?: any[];
  views?: any[];
  rooms?: any[];
  corridors?: any[];
  roomDoors?: any[];
  racks?: any[];
  rackItems?: any[];
  rackLinks?: any[];
};

export const getLatestRevision = (revisions: RevisionLike[] | null | undefined): RevisionLike | null => {
  const list = Array.isArray(revisions) ? revisions : [];
  let latest: RevisionLike | null = null;
  let latestTs = Number.NEGATIVE_INFINITY;
  for (const revision of list) {
    if (!revision) continue;
    const ts = Number(revision.createdAt || 0);
    if (!Number.isFinite(ts)) continue;
    if (!latest || ts > latestTs) {
      latest = revision;
      latestTs = ts;
    }
  }
  if (latest) return latest;
  for (const revision of list) {
    if (revision) return revision;
  }
  return null;
};

export const getRevisionVersion = (revision: RevisionLike | null | undefined): { major: number; minor: number } => {
  if (revision && typeof revision.revMajor === 'number' && typeof revision.revMinor === 'number') {
    return { major: revision.revMajor, minor: revision.revMinor };
  }
  if (revision && typeof revision.version === 'number') {
    return { major: 1, minor: Math.max(0, Number(revision.version) - 1) };
  }
  return { major: 1, minor: 0 };
};

export const toRevisionSnapshot = (revision: RevisionLike | null | undefined): PlanSnapshotComparable => ({
  imageUrl: String(revision?.imageUrl || ''),
  width: revision?.width,
  height: revision?.height,
  scale: revision?.scale,
  safetyCardLayout: revision?.safetyCardLayout,
  objects: Array.isArray(revision?.objects) ? revision.objects : [],
  views: Array.isArray(revision?.views) ? revision.views : [],
  rooms: Array.isArray(revision?.rooms) ? revision.rooms : [],
  corridors: Array.isArray(revision?.corridors) ? revision.corridors : [],
  roomDoors: Array.isArray(revision?.roomDoors) ? revision.roomDoors : [],
  racks: Array.isArray(revision?.racks) ? revision.racks : [],
  rackItems: Array.isArray(revision?.rackItems) ? revision.rackItems : [],
  rackLinks: Array.isArray(revision?.rackLinks) ? revision.rackLinks : []
});
