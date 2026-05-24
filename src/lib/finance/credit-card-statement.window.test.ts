import { describe, expect, it } from 'vitest';
import {
  computeNextDuePayment,
  resolveCreditCardStatementWindow,
} from '@/lib/finance/credit-card-statement.service';

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

describe('due before cutoff: open-cycle projection (doc)', () => {
  it('corte 15 / pago 8: while asOf is inside currentCycle, due date precedes the next cutoff in the month', () => {
    const asOf = new Date(Date.UTC(2026, 4, 4));
    const w = resolveCreditCardStatementWindow(asOf, 15, 8);
    expect(toYmd(w.statementEnd)).toBe('2026-04-15');
    expect(toYmd(w.statementDueDate)).toBe('2026-05-08');
    expect(toYmd(w.currentCycleStart)).toBe('2026-04-16');
    expect(toYmd(w.currentCycleEnd)).toBe('2026-05-15');
    expect(toDateOnlyString(asOf) <= toYmd(w.currentCycleEnd)).toBe(true);
  });
});

function toDateOnlyString(d: Date) {
  return d.toISOString().split('T')[0];
}

describe('planner primera quincena: evitar asOf en el día de corte 15', () => {
  it('asOf 15 may (corte 15) ya cierra el estado de abr; asOf 14 mantiene el ciclo con venc. 8 may', () => {
    const asOnCutoff = new Date(Date.UTC(2026, 4, 15, 12, 0, 0, 0));
    const asBeforeCutoff = new Date(Date.UTC(2026, 4, 14, 12, 0, 0, 0));
    const wCutoff = resolveCreditCardStatementWindow(asOnCutoff, 15, 8);
    const wBefore = resolveCreditCardStatementWindow(asBeforeCutoff, 15, 8);
    expect(toYmd(wCutoff.statementEnd)).toBe('2026-05-15');
    expect(toYmd(wCutoff.statementDueDate)).toBe('2026-06-08');
    expect(toYmd(wBefore.statementEnd)).toBe('2026-04-15');
    expect(toYmd(wBefore.statementDueDate)).toBe('2026-05-08');
  });
});

describe('computeNextDuePayment', () => {
  it('returns zero when payments cover statement balance', () => {
    expect(
      computeNextDuePayment({
        lastStatementBalance: 500,
        paymentsAppliedToStatement: 500,
        importedTotalDue: null,
        outstandingBalance: 500,
        dueDay: 20,
        cutoffDay: 15,
      }),
    ).toBe(0);
    expect(
      computeNextDuePayment({
        lastStatementBalance: 100,
        paymentsAppliedToStatement: 120,
        importedTotalDue: null,
        outstandingBalance: 0,
        dueDay: 20,
        cutoffDay: 15,
      }),
    ).toBe(0);
  });

  it('returns remaining when partially paid from ledger', () => {
    expect(
      computeNextDuePayment({
        lastStatementBalance: 800,
        paymentsAppliedToStatement: 300,
        importedTotalDue: null,
        outstandingBalance: 800,
        dueDay: 20,
        cutoffDay: 15,
      }),
    ).toBe(500);
  });

  it('uses outstanding balance when ledger is empty but card has debt', () => {
    expect(
      computeNextDuePayment({
        lastStatementBalance: 0,
        paymentsAppliedToStatement: 0,
        importedTotalDue: null,
        outstandingBalance: 4579.54,
        dueDay: 5,
        cutoffDay: 6,
      }),
    ).toBe(4579.54);
  });

  it('prefers imported total_due over ledger and outstanding', () => {
    expect(
      computeNextDuePayment({
        lastStatementBalance: 100,
        paymentsAppliedToStatement: 0,
        importedTotalDue: 4494.74,
        outstandingBalance: 5000,
        dueDay: 17,
        cutoffDay: 7,
      }),
    ).toBe(4494.74);
  });

  it('projects open-cycle purchases when due day precedes cutoff', () => {
    expect(
      computeNextDuePayment({
        lastStatementBalance: 0,
        paymentsAppliedToStatement: 0,
        importedTotalDue: null,
        outstandingBalance: 0,
        dueDay: 8,
        cutoffDay: 15,
        currentCyclePurchasesTotal: 600,
        currentCyclePaymentsTotal: 100,
        asOfYmd: '2026-05-04',
        currentCycleEndYmd: '2026-05-15',
      }),
    ).toBe(500);
  });
});

describe('nextDuePayment formula (legacy inline)', () => {
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
