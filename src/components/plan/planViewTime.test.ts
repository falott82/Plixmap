import { describe, it, expect } from 'vitest';
import {
  hmToMinutes,
  minutesToHm,
  shiftIsoDay,
  shiftMonthAnchor,
  monthAnchorFromIso,
  toLocalHmFromTs,
  meetingClockFromTs,
  meetingIsoDayFromTs,
  localTsFromIsoHm
} from './planViewTime';

describe('hmToMinutes', () => {
  it('parses valid HH:MM into minutes', () => {
    expect(hmToMinutes('00:00')).toBe(0);
    expect(hmToMinutes('09:30')).toBe(570);
    expect(hmToMinutes('23:59')).toBe(1439);
  });
  it('returns null for invalid input', () => {
    expect(hmToMinutes('')).toBeNull();
    expect(hmToMinutes('9:5')).toBeNull();
    expect(hmToMinutes('abc')).toBeNull();
    expect(hmToMinutes('24:00 extra')).toBeNull();
  });
  it('clamps out-of-range hours/minutes', () => {
    expect(hmToMinutes('30:99')).toBe(23 * 60 + 59);
  });
});

describe('minutesToHm', () => {
  it('formats minutes into zero-padded HH:MM', () => {
    expect(minutesToHm(0)).toBe('00:00');
    expect(minutesToHm(570)).toBe('09:30');
    expect(minutesToHm(1439)).toBe('23:59');
  });
  it('clamps to the valid day range', () => {
    expect(minutesToHm(-50)).toBe('00:00');
    expect(minutesToHm(99999)).toBe('23:59');
  });
  it('round-trips with hmToMinutes', () => {
    for (const hm of ['00:00', '07:05', '12:34', '23:59']) {
      expect(minutesToHm(hmToMinutes(hm) as number)).toBe(hm);
    }
  });
});

describe('shiftIsoDay', () => {
  it('shifts a local ISO day by N days', () => {
    expect(shiftIsoDay('2026-06-01', 1)).toBe('2026-06-02');
    expect(shiftIsoDay('2026-06-01', -1)).toBe('2026-05-31');
    expect(shiftIsoDay('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('returns a valid current day for invalid input (does not throw)', () => {
    expect(typeof shiftIsoDay('not-a-date', 1)).toBe('string');
    expect(shiftIsoDay('not-a-date', 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('monthAnchorFromIso / shiftMonthAnchor', () => {
  it('derives the month anchor (first of month) from an ISO day', () => {
    expect(monthAnchorFromIso('2026-06-17')).toBe('2026-06-01');
  });
  it('shifts the month anchor by N months', () => {
    expect(shiftMonthAnchor('2026-06-01', 1)).toBe('2026-07-01');
    expect(shiftMonthAnchor('2026-01-01', -1)).toBe('2025-12-01');
  });
});

describe('time-of-day formatting from timestamps', () => {
  it('meetingClockFromTs / toLocalHmFromTs format local HH:MM', () => {
    const ts = new Date(2026, 5, 1, 14, 5, 0, 0).getTime();
    expect(meetingClockFromTs(ts)).toBe('14:05');
    expect(toLocalHmFromTs(ts)).toBe('14:05');
  });
  it('meetingIsoDayFromTs returns the local ISO day', () => {
    const ts = new Date(2026, 5, 1, 23, 30, 0, 0).getTime();
    expect(meetingIsoDayFromTs(ts)).toBe('2026-06-01');
  });
});

describe('localTsFromIsoHm', () => {
  it('builds a local timestamp from an ISO day + HH:MM', () => {
    const ts = localTsFromIsoHm('2026-06-01', '14:05');
    expect(ts).toBe(new Date(2026, 5, 1, 14, 5, 0, 0).getTime());
  });
  it('returns null for malformed inputs', () => {
    expect(localTsFromIsoHm('2026-6-1', '14:05')).toBeNull();
    expect(localTsFromIsoHm('2026-06-01', '99:99')).toBeNull();
    expect(localTsFromIsoHm('', '')).toBeNull();
  });
});
