import type { PlanSnapshotComparable } from './planSnapshotCompare';

type SnapshotCompareFn = (current: PlanSnapshotComparable, latest: PlanSnapshotComparable) => boolean;

type UnsavedPairCache = WeakMap<object, WeakMap<object, boolean>>;

const toComparableCurrentAgainstLatest = (
  current: PlanSnapshotComparable,
  latest: PlanSnapshotComparable
): PlanSnapshotComparable => ({
  ...current,
  corridors: latest.corridors === undefined ? undefined : current.corridors,
  roomDoors: latest.roomDoors === undefined ? undefined : current.roomDoors,
  racks: latest.racks === undefined ? undefined : current.racks,
  rackItems: latest.rackItems === undefined ? undefined : current.rackItems,
  rackLinks: latest.rackLinks === undefined ? undefined : current.rackLinks,
  safetyCardLayout: latest.safetyCardLayout === undefined ? undefined : current.safetyCardLayout
});

export const getUnsavedAgainstLatest = (
  current: PlanSnapshotComparable,
  latest: PlanSnapshotComparable,
  samePlanSnapshot: SnapshotCompareFn
): boolean => {
  if (current === latest) return false;
  return !samePlanSnapshot(toComparableCurrentAgainstLatest(current, latest), latest);
};

export const getCachedUnsavedAgainstLatest = (
  cache: UnsavedPairCache,
  current: PlanSnapshotComparable,
  latest: PlanSnapshotComparable,
  samePlanSnapshot: SnapshotCompareFn
): boolean => {
  if (!current || !latest || typeof current !== 'object' || typeof latest !== 'object') {
    return getUnsavedAgainstLatest(current, latest, samePlanSnapshot);
  }

  const currentKey = current as unknown as object;
  const latestKey = latest as unknown as object;
  const byLatest = cache.get(currentKey);
  if (byLatest && byLatest.has(latestKey)) {
    return !!byLatest.get(latestKey);
  }

  const unsaved = getUnsavedAgainstLatest(current, latest, samePlanSnapshot);
  if (byLatest) {
    byLatest.set(latestKey, unsaved);
  } else {
    const next = new WeakMap<object, boolean>();
    next.set(latestKey, unsaved);
    cache.set(currentKey, next);
  }
  return unsaved;
};
