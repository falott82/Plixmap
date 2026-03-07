export type MeetingTimePhase = 'past' | 'current' | 'upcoming';
export type MeetingSchedulePhase = 'past' | 'current' | 'scheduled';

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
