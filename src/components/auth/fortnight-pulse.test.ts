import { describe, expect, it } from 'vitest';

import {
  dayToPulseX,
  daysInCalendarMonth,
} from '@/components/auth/fortnight-pulse-geometry';

describe('fortnight pulse geometry', () => {
  it('computes days in month from 1-indexed month', () => {
    expect(daysInCalendarMonth(2026, 7)).toBe(31);
    expect(daysInCalendarMonth(2026, 2)).toBe(28);
    expect(daysInCalendarMonth(2024, 2)).toBe(29);
  });

  it('maps day 1 and last day to pulse track edges', () => {
    expect(dayToPulseX(1, 31)).toBe(4);
    expect(dayToPulseX(31, 31)).toBe(296);
  });
});
