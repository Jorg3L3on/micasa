import { describe, expect, it } from 'vitest';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import {
  computeEffectiveAllocated,
  daysInclusiveWallClock,
  getOverlapRatio,
  getPeriodOverlap,
} from './budget-period-spend';

describe('budget-period-spend helpers', () => {
  const period = {
    start_date: startOfCalendarDay('2026-06-01'),
    end_date: endOfCalendarDay('2026-06-07'),
  };

  it('counts inclusive wall-clock days', () => {
    expect(daysInclusiveWallClock(period.start_date, period.end_date)).toBe(7);
  });

  it('computes overlap with a fortnight scope', () => {
    const scope = {
      start_date: startOfCalendarDay('2026-06-01'),
      end_date: endOfCalendarDay('2026-06-15'),
    };
    const overlap = getPeriodOverlap(period, scope);
    expect(overlap).toEqual(period);
    expect(getOverlapRatio(period, overlap!)).toBe(1);
    expect(computeEffectiveAllocated(700, period, overlap!)).toBe(700);
  });

  it('pro-rates when only part of the period overlaps', () => {
    const scope = {
      start_date: startOfCalendarDay('2026-06-05'),
      end_date: endOfCalendarDay('2026-06-15'),
    };
    const overlap = getPeriodOverlap(period, scope)!;
    expect(daysInclusiveWallClock(overlap.start_date, overlap.end_date)).toBe(3);
    expect(computeEffectiveAllocated(700, period, overlap)).toBe(300);
  });
});
