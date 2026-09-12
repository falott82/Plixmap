import { currentLocalIsoDay, toLocalIsoDay, toLocalMonthAnchor } from '../../utils/localDate';

// Pure date/time helpers extracted from PlanView. They depend only on their arguments and
// the localDate utilities — no component state — so they live as plain module functions
// (testable in isolation, shared by the usePlanView hook and the PlanViewView render).

export const meetingIsoDayFromTs = (ts: number) => toLocalIsoDay(Number(ts || 0));

export const meetingClockFromTs = (ts: number) => {
  const d = new Date(Number(ts || 0));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const shiftIsoDay = (iso: string, deltaDays: number) => {
  const d = new Date(`${String(iso || '').trim()}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return currentLocalIsoDay();
  d.setDate(d.getDate() + deltaDays);
  return toLocalIsoDay(d);
};

export const monthAnchorFromIso = (iso: string) => {
  const d = new Date(`${String(iso || '').trim()}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return toLocalMonthAnchor();
  return toLocalMonthAnchor(d);
};

export const shiftMonthAnchor = (anchorIso: string, deltaMonths: number) => {
  const d = new Date(`${String(anchorIso || '').trim()}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return toLocalMonthAnchor();
  d.setMonth(d.getMonth() + deltaMonths, 1);
  return toLocalMonthAnchor(d);
};

export const toLocalHmFromTs = (ts: number) => {
  const d = new Date(Number(ts || 0));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const hmToMinutes = (hm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!m) return null;
  const h = Math.max(0, Math.min(23, Number(m[1]) || 0));
  const mm = Math.max(0, Math.min(59, Number(m[2]) || 0));
  return h * 60 + mm;
};

export const minutesToHm = (totalMinutes: number) => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(Number(totalMinutes) || 0)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const localTsFromIsoHm = (isoDay: string, hm: string): number | null => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!dm || !tm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]) - 1;
  const da = Number(dm[3]);
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (![y, mo, da, hh, mm].every(Number.isFinite)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const dt = new Date(y, mo, da, hh, mm, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt.getTime() : null;
};
