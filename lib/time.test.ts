import { describe, expect, it } from 'vitest';

import { elapsedMs, formatDuration, hoursFromMs, localDateIso, roundHours } from './time';

describe('elapsedMs', () => {
  it('measures from the start timestamp', () => {
    const now = Date.parse('2026-09-01T12:00:00Z');
    expect(elapsedMs('2026-09-01T11:00:00Z', now)).toBe(3_600_000);
  });

  it('never goes negative when clocks disagree', () => {
    const now = Date.parse('2026-09-01T10:00:00Z');
    expect(elapsedMs('2026-09-01T11:00:00Z', now)).toBe(0);
  });

  it('returns zero for an unparseable start', () => {
    expect(elapsedMs('nonsense')).toBe(0);
  });
});

describe('roundHours', () => {
  it('rounds to the increment', () => {
    expect(roundHours(1.3, 0.25)).toBe(1.25);
    expect(roundHours(1.4, 0.25)).toBe(1.5);
    expect(roundHours(0.9, 0.5)).toBe(1);
  });

  it('never rounds a real session down to nothing', () => {
    // 30 seconds would round to 0 at a 15-minute increment; log one unit instead.
    expect(roundHours(hoursFromMs(30_000), 0.25)).toBe(0.25);
    expect(roundHours(0.01, 1)).toBe(1);
  });

  it('passes values through when rounding is off', () => {
    expect(roundHours(1.234, 0)).toBe(1.23);
  });

  it('returns zero for nothing tracked', () => {
    expect(roundHours(0, 0.25)).toBe(0);
    expect(roundHours(-1, 0.25)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3_600_000 + 23 * 60_000)).toBe('1h 23m');
    expect(formatDuration(45 * 60_000 + 7000)).toBe('45m 07s');
    expect(formatDuration(12_000)).toBe('12s');
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('localDateIso', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(localDateIso(new Date(2026, 8, 1))).toBe('2026-09-01');
    expect(localDateIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses local time, not UTC', () => {
    // 23:30 local on the 1st is already the 2nd in UTC for eastern offsets;
    // the time entry must still be logged against the local day.
    const late = new Date(2026, 8, 1, 23, 30);
    expect(localDateIso(late)).toBe('2026-09-01');
    expect(localDateIso(late)).toBe(
      `${late.getFullYear()}-${String(late.getMonth() + 1).padStart(2, '0')}-${String(late.getDate()).padStart(2, '0')}`,
    );
  });
});
