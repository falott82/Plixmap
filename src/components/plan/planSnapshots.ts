import type { PlanSnapshotComparable } from './planSnapshotCompare';

export type PlanSnapshot = PlanSnapshotComparable;

export type PlanHistorySnapshot = PlanSnapshot & {
  printArea?: { x: number; y: number; width: number; height: number } | null;
  links?: any[];
};

export const toPlanSnapshot = (plan: any): PlanSnapshot => ({
  imageUrl: plan?.imageUrl || '',
  width: plan?.width,
  height: plan?.height,
  scale: plan?.scale,
  safetyCardLayout: plan?.safetyCardLayout
    ? {
        x: Number(plan.safetyCardLayout.x || 0),
        y: Number(plan.safetyCardLayout.y || 0),
        w: Number(plan.safetyCardLayout.w || 420),
        h: Number(plan.safetyCardLayout.h || 84),
        fontSize: Number(plan.safetyCardLayout.fontSize || 10),
        fontIndex: Number(plan.safetyCardLayout.fontIndex || 0),
        colorIndex: Number(plan.safetyCardLayout.colorIndex || 0),
        textBgIndex: Number(plan.safetyCardLayout.textBgIndex || 0)
      }
    : undefined,
  objects: Array.isArray(plan?.objects) ? plan.objects : [],
  views: Array.isArray(plan?.views) ? plan.views : [],
  rooms: Array.isArray(plan?.rooms) ? plan.rooms : [],
  corridors: Array.isArray(plan?.corridors) ? plan.corridors : [],
  roomDoors: Array.isArray(plan?.roomDoors) ? plan.roomDoors : [],
  racks: Array.isArray(plan?.racks) ? plan.racks : [],
  rackItems: Array.isArray(plan?.rackItems) ? plan.rackItems : [],
  rackLinks: Array.isArray(plan?.rackLinks) ? plan.rackLinks : []
});

export const toPlanHistorySnapshot = (plan: any, base?: PlanSnapshot): PlanHistorySnapshot => ({
  ...(base || toPlanSnapshot(plan)),
  printArea: plan?.printArea ?? null,
  links: Array.isArray(plan?.links) ? plan.links : []
});
