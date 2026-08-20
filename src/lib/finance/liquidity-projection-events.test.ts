import { describe, expect, it } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { liquidityUntilFromMonthHorizon } from '@/lib/finance/liquidity-projection';

describe('liquidity-projection-events', () => {
  it('computes until date from month horizon', () => {
    const asOf = parseCalendarDate('2026-03-10');
    expect(liquidityUntilFromMonthHorizon(asOf, 3)).toEqual(parseCalendarDate('2026-06-10'));
    expect(liquidityUntilFromMonthHorizon(asOf, 12)).toEqual(parseCalendarDate('2027-03-10'));
  });
});
