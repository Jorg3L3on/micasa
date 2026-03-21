import { describe, expect, it } from 'vitest';
import { resolveCreditCardStatementWindow } from '@/lib/finance/credit-card-statement.service';

const toYmd = (d: Date) => d.toISOString().split('T')[0];

describe('resolveCreditCardStatementWindow', () => {
  it('places statement end on previous cutoff when asOf is before current month cutoff', () => {
    const asOf = new Date(Date.UTC(2026, 2, 10));
    const w = resolveCreditCardStatementWindow(asOf, 15, 20);
    expect(toYmd(w.statementEnd)).toBe('2026-02-15');
    expect(toYmd(w.statementStart)).toBe('2026-01-16');
    expect(toYmd(w.currentCycleStart)).toBe('2026-02-16');
    expect(toYmd(w.currentCycleEnd)).toBe('2026-03-15');
  });

  it('uses current month cutoff as statement end when asOf is on or after cutoff', () => {
    const asOf = new Date(Date.UTC(2026, 2, 18));
    const w = resolveCreditCardStatementWindow(asOf, 15, 20);
    expect(toYmd(w.statementEnd)).toBe('2026-03-15');
    expect(toYmd(w.currentCycleStart)).toBe('2026-03-16');
  });
});

describe('nextDuePayment formula', () => {
  const nextDue = (lastStatement: number, appliedToStatement: number) =>
    Math.max(lastStatement - appliedToStatement, 0);

  it('returns zero when payments cover statement balance', () => {
    expect(nextDue(500, 500)).toBe(0);
    expect(nextDue(100, 120)).toBe(0);
  });

  it('returns remaining when partially paid', () => {
    expect(nextDue(800, 300)).toBe(500);
  });
});
