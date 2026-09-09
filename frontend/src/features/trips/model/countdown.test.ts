import { describe, expect, it } from 'vitest';
import { calculateCountdown, formatTripStartDate } from './countdown';

describe('calculateCountdown', () => {
  it('calculates remaining units and progress between start and target', () => {
    const result = calculateCountdown(
      '2026-01-01T00:00:00.000Z',
      '2026-01-11T00:00:00.000Z',
      Date.parse('2026-01-06T00:00:00.000Z'),
    );

    expect(result.days).toBe(5);
    expect(result.hours).toBe(0);
    expect(result.percent).toBe(50);
    expect(result.started).toBe(false);
  });

  it('clamps progress before the countdown starts and after the trip begins', () => {
    const before = calculateCountdown(
      '2026-01-10T00:00:00.000Z',
      '2026-01-20T00:00:00.000Z',
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
    const after = calculateCountdown(
      '2026-01-10T00:00:00.000Z',
      '2026-01-20T00:00:00.000Z',
      Date.parse('2026-01-21T00:00:00.000Z'),
    );

    expect(before.percent).toBe(0);
    expect(after.percent).toBe(100);
    expect(after.days).toBe(0);
    expect(after.started).toBe(true);
  });
});

describe('formatTripStartDate', () => {
  it('formats the destination date without depending on the browser timezone', () => {
    expect(formatTripStartDate('2027-01-10T05:00:00.000Z', 'America/New_York')).toContain('10');
    expect(formatTripStartDate('2027-01-10T05:00:00.000Z', 'America/New_York')).toContain('2027');
  });
});
