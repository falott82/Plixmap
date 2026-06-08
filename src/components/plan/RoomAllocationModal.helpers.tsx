import { useT } from '../../i18n/useT';
import { FloorPlan, MapObject, Room } from '../../store/types';
import { polygonCentroid } from './planViewUtils';

export type Point = { x: number; y: number };

const USER_TYPE_SET = new Set(['user', 'real_user', 'generic_user']);
export const isUserObject = (obj: MapObject | null | undefined) => USER_TYPE_SET.has(String(obj?.type || ''));

export const normalizeLabel = (value: unknown) => String(value || '').trim();

export const normalizeTagList = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const value = normalizeLabel(raw);
    if (!value) continue;
    const folded = value.toLocaleLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(value);
  }
  return out;
};

export const collectObjectDepartments = (obj: MapObject): string[] =>
  normalizeTagList([(obj as any).externalDept1, (obj as any).externalDept2, (obj as any).externalDept3]);

export const roomPolygon = (room: Room): Point[] => {
  const kind = (room?.kind || (Array.isArray(room?.points) && room.points.length ? 'poly' : 'rect')) as 'rect' | 'poly';
  if (kind === 'poly') {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (points.length >= 3) return points;
  }
  const x = Number(room?.x || 0);
  const y = Number(room?.y || 0);
  const width = Number(room?.width || 0);
  const height = Number(room?.height || 0);
  if (!(width > 0 && height > 0)) return [];
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
};

export const formatDistanceLabel = (meters: number | null, px: number | null) => {
  if (meters !== null && Number.isFinite(meters)) {
    if (meters >= 100) return `${Math.round(meters)} m`;
    return `${meters.toFixed(1)} m`;
  }
  if (px !== null && Number.isFinite(px)) return `${px.toFixed(1)} px`;
  return '--';
};

export const yesNoLabel = (value: boolean, t: ReturnType<typeof useT>) =>
  value ? t({ it: 'Sì', en: 'Yes' }) : t({ it: 'No', en: 'No' });

export const YesNoToggle = ({
  label,
  value,
  onChange,
  disabled = false,
  yesLabel,
  noLabel
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  yesLabel: string;
  noLabel: string;
}) => (
  <div className={`rounded-xl border border-slate-200 bg-white px-3 py-2 ${disabled ? 'opacity-60' : ''}`}>
    <div className="text-xs font-semibold text-slate-600">{label}</div>
    <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          value ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          !value ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        {noLabel}
      </button>
    </div>
  </div>
);

export type RichRoomCandidate = {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  roomId: string;
  roomName: string;
  capacity: number;
  userCount: number;
  freeSeats: number;
  overCapacity: boolean;
  departmentTags: string[];
  occupants: string[];
  point: Point | null;
  isEmptyRoom: boolean;
  matchesDepartment: boolean;
  isMeetingRoom: boolean;
  isNonPeopleRoom: boolean;
};

export type RoomPreviewSelection = {
  clientName: string;
  siteName: string;
  targetPlanName: string;
  targetPlanId: string;
  targetRoomId: string;
  sourcePlanName?: string;
  sourcePlanId?: string;
  sourceRoomId?: string;
};

export type PlanPreviewData = {
  kind: 'source' | 'target';
  planId: string;
  planName: string;
  focusRoomId: string;
  planImageUrl: string;
  roomEntries: Array<{ room: Room; polygon: Point[]; centroid: Point | null }>;
  userObjects: MapObject[];
  minX: number;
  minY: number;
  viewWidth: number;
  viewHeight: number;
};

export const buildPlanPreviewData = (plan: FloorPlan, focusRoomId: string, kind: 'source' | 'target'): PlanPreviewData => {
  const roomEntries = ((plan.rooms || []) as Room[])
    .map((room) => {
      const polygon = roomPolygon(room);
      if (!polygon.length) return null;
      return {
        room,
        polygon,
        centroid: polygonCentroid(polygon)
      };
    })
    .filter(Boolean) as Array<{ room: Room; polygon: Point[]; centroid: Point | null }>;
  const userObjects = ((plan.objects || []) as MapObject[]).filter((obj) => isUserObject(obj));

  const planWidth = Number(plan.width || 0);
  const planHeight = Number(plan.height || 0);
  if (planWidth > 0 && planHeight > 0) {
    return {
      kind,
      planId: String(plan.id),
      planName: normalizeLabel(plan.name) || String(plan.id),
      focusRoomId: String(focusRoomId || '').trim(),
      planImageUrl: String(plan.imageUrl || ''),
      roomEntries,
      userObjects,
      minX: 0,
      minY: 0,
      viewWidth: planWidth,
      viewHeight: planHeight
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entry of roomEntries) {
    for (const point of entry.polygon) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  for (const obj of userObjects) {
    const x = Number(obj.x);
    const y = Number(obj.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = 1200;
    maxY = 700;
  }
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const padding = Math.max(26, Math.round(Math.max(contentWidth, contentHeight) * 0.05));
  return {
    kind,
    planId: String(plan.id),
    planName: normalizeLabel(plan.name) || String(plan.id),
    focusRoomId: String(focusRoomId || '').trim(),
    planImageUrl: String(plan.imageUrl || ''),
    roomEntries,
    userObjects,
    minX: minX - padding,
    minY: minY - padding,
    viewWidth: contentWidth + padding * 2,
    viewHeight: contentHeight + padding * 2
  };
};
