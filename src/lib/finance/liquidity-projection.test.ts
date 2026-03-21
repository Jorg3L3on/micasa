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
    const asOf = new Date(Date.UTC(2026, 2, 10));
    const w = resolveCreditCardStatementWindow(asOf, 15, 20);
    const next = advanceStatementCursor(w);
    expect(toUtcDateOnlyString(next)).toBe('2026-03-16');
    const w2 = resolveCreditCardStatementWindow(next, 15, 20);
    expect(toUtcDateOnlyString(w2.statementEnd)).toBe('2026-03-15');
  });
});

describe('addDaysUtc', () => {
  it('rolls across month boundaries in UTC', () => {
    const d = new Date(Date.UTC(2026, 0, 31));
    expect(toUtcDateOnlyString(addDaysUtc(d, 1))).toBe('2026-02-01');
  });
});
