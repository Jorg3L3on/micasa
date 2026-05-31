import { parseCalendarDate } from '@/lib/calendar-dates';
import { describe, expect, it } from 'vitest';
import { resolveCreditCardStatementWindow } from '@/lib/finance/credit-card-statement.service';
import {
  addDaysUtc,
  advanceStatementCursor,
  compareUtcDateOnly,
  toUtcDateOnlyString,
} from '@/lib/finance/liquidity-projection';

describe('compareUtcDateOnly', () => {
  it('orders ISO date-only strings', () => {
    expect(compareUtcDateOnly('2026-01-01', '2026-02-01')).toBe(-1);
    expect(compareUtcDateOnly('2026-02-01', '2026-01-01')).toBe(1);
    expect(compareUtcDateOnly('2026-03-15', '2026-03-15')).toBe(0);
  });
});

describe('advanceStatementCursor', () => {
  it('moves past currentCycleEnd so the siguiente periodo resolves', () => {
    const asOf = parseCalendarDate('2026-03-10');
    const w = resolveCreditCardStatementWindow(asOf, 15, 20);
    const next = advanceStatementCursor(w);
    expect(toUtcDateOnlyString(next)).toBe('2026-03-16');
    const w2 = resolveCreditCardStatementWindow(next, 15, 20);
    expect(toUtcDateOnlyString(w2.statementEnd)).toBe('2026-03-15');
  });
});

describe('addDaysUtc', () => {
  it('rolls across month boundaries in UTC', () => {
    const d = parseCalendarDate('2026-01-31');
    expect(toUtcDateOnlyString(addDaysUtc(d, 1))).toBe('2026-02-01');
  });
});
