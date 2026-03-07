export type MeetingTimePhase = 'past' | 'current' | 'upcoming';
export type MeetingSchedulePhase = 'past' | 'current' | 'scheduled';
type MeetingLike = { startAt?: unknown; endAt?: unknown; status?: unknown };

type Translate = (copy: { it: string; en: string }) => string;
type Copy = { it: string; en: string };

const toFiniteTs = (value: unknown) => {
  const ts = Number(value || 0);
  return Number.isFinite(ts) ? ts : 0;
};

export const getMeetingTimePhase = (startAt: unknown, endAt: unknown, now = Date.now()): MeetingTimePhase => {
  const startTs = toFiniteTs(startAt);
  const endTs = toFiniteTs(endAt);
  if (startTs <= now && now < endTs) return 'current';
  if (endTs <= now) return 'past';
  return 'upcoming';
};

export const getMeetingSchedulePhase = (startAt: unknown, endAt: unknown, now = Date.now()): MeetingSchedulePhase => {
  const phase = getMeetingTimePhase(startAt, endAt, now);
  return phase === 'upcoming' ? 'scheduled' : phase;
};

export const getMeetingTemporalState = (startAt: unknown, endAt: unknown, now = Date.now()) => {
  const phase = getMeetingTimePhase(startAt, endAt, now);
  return {
    phase,
    inProgress: phase === 'current',
    isPast: phase === 'past',
    isFuture: phase === 'upcoming'
  };
};

export const getMeetingTimePhaseBadgeLabel = (
  phase: MeetingTimePhase,
  t: Translate,
  labels?: Partial<Record<MeetingTimePhase, Copy>>
) => {
  const resolved = {
    current: { it: 'IN CORSO', en: 'LIVE' },
    past: { it: 'PASSATO', en: 'PAST' },
    upcoming: { it: 'IN ARRIVO', en: 'UPCOMING' },
    ...labels
  };
  return t(resolved[phase]);
};

export const getMeetingTimePhaseLabel = (
  phase: MeetingTimePhase,
  t: Translate,
  labels?: Partial<Record<MeetingTimePhase, Copy>>
) => {
  const resolved = {
    current: { it: 'Corrente', en: 'Current' },
    past: { it: 'Passato', en: 'Past' },
    upcoming: { it: 'Futuro', en: 'Upcoming' },
    ...labels
  };
  return t(resolved[phase]);
};

export const getMeetingSchedulePhaseLabel = (
  phase: MeetingSchedulePhase,
  t: Translate,
  labels?: Partial<Record<MeetingSchedulePhase, Copy>>
) => {
  const resolved = {
    current: { it: 'Corrente', en: 'Current' },
    past: { it: 'Passata', en: 'Past' },
    scheduled: { it: 'Programmato', en: 'Scheduled' },
    ...labels
  };
  return t(resolved[phase]);
};

export const isApprovedMeetingInProgress = (meeting: MeetingLike, now = Date.now()) =>
  String(meeting?.status || '').trim().toLowerCase() === 'approved' &&
  getMeetingTimePhase(meeting?.startAt, meeting?.endAt, now) === 'current';

export const getMeetingTimelineDayClasses = (startAt: unknown, endAt: unknown, now = Date.now()) => {
  const phase = getMeetingTimePhase(startAt, endAt, now);
  if (phase === 'current') {
    return {
      phase,
      tone: 'border-emerald-400 bg-emerald-200 text-emerald-950',
      blockedTone: 'border-emerald-400/70 bg-emerald-200/35'
    };
  }
  if (phase === 'past') {
    return {
      phase,
      tone: 'border-slate-300 bg-slate-200 text-slate-900',
      blockedTone: 'border-slate-300/70 bg-slate-200/35'
    };
  }
  return {
    phase,
    tone: 'border-violet-300 bg-violet-200 text-violet-950',
    blockedTone: 'border-violet-300/70 bg-violet-200/35'
  };
};

export const getMeetingRoomActiveToneClass = (hasApprovedInProgress: boolean) =>
  hasApprovedInProgress
    ? 'bg-gradient-to-br from-amber-100 to-amber-50 border-r border-amber-300'
    : 'bg-gradient-to-br from-emerald-100 to-emerald-50 border-r border-emerald-300';

export const getMeetingBookingDayToneClass = (meeting: MeetingLike, now = Date.now()) => {
  const status = String(meeting?.status || '').trim().toLowerCase();
  if (status === 'pending') return 'border-amber-300 bg-amber-100 text-amber-900';
  if (status === 'rejected') return 'border-rose-300 bg-rose-100 text-rose-900';
  if (status === 'cancelled') return 'border-slate-300 bg-slate-100 text-slate-600';
  const phase = getMeetingTimePhase(meeting?.startAt, meeting?.endAt, now);
  if (phase === 'current') return 'border-emerald-400 bg-emerald-200 text-emerald-950';
  if (phase === 'past') return 'border-slate-200 bg-slate-100 text-slate-500';
  return 'border-violet-300 bg-violet-200 text-violet-950';
};
