import { parseCalendarDate } from '@/lib/calendar-dates';
import { describe, expect, it } from 'vitest';
import {
  buildCardStatementObligation,
  computeNextDuePayment,
  deriveCardStatementObligationStatus,
  deriveObligationAmountSource,
  getRemainingPlannedAmount,
  resolveCreditCardStatementWindow,
} from '@/lib/finance/card-statement-obligation';

const cardBase = {
  walletId: 1,
  walletName: 'Visa',
  walletType: 'CREDIT_CARD',
  cutoffDay: 15,
  dueDay: 20,
  outstandingBalance: 800,
  currentCyclePurchasesTotal: 0,
  currentCyclePaymentsTotal: 0,
};

describe('buildCardStatementObligation', () => {
  it('builds unpaid obligation from ledger with source metadata', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-03-18'),
      15,
      20,
    );
    const dto = buildCardStatementObligation({
      ...cardBase,
      window,
      lastStatementBalance: 800,
      paymentsAppliedToStatement: 0,
      importedTotalDue: null,
      todayYmd: '2026-03-18',
    });

    expect(dto.remainingStatementDue).toBe(800);
    expect(dto.obligationAmountSource).toBe('ledger');
    expect(dto.status).toBe('unpaid');
    expect(dto.isEstimate).toBe(false);
    expect(dto.cycle.statementDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('marks partial and paid states from payments applied', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-03-18'),
      15,
      20,
    );

    const partial = buildCardStatementObligation({
      ...cardBase,
      window,
      lastStatementBalance: 800,
      paymentsAppliedToStatement: 300,
      importedTotalDue: null,
      todayYmd: '2026-03-18',
    });
    expect(partial.remainingStatementDue).toBe(500);
    expect(partial.status).toBe('partial');

    const paid = buildCardStatementObligation({
      ...cardBase,
      window,
      lastStatementBalance: 800,
      paymentsAppliedToStatement: 800,
      importedTotalDue: null,
      todayYmd: '2026-03-18',
    });
    expect(paid.remainingStatementDue).toBe(0);
    expect(paid.status).toBe('paid');
  });

  it('prefers imported total and sets import source', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-03-10'),
      15,
      17,
    );
    const dto = buildCardStatementObligation({
      ...cardBase,
      dueDay: 17,
      window,
      lastStatementBalance: 100,
      paymentsAppliedToStatement: 0,
      importedTotalDue: 4494.74,
      outstandingBalance: 5000,
    });

    expect(dto.remainingStatementDue).toBe(4494.74);
    expect(dto.obligationAmountSource).toBe('import');
    expect(dto.importedAmount).toBe(4494.74);
  });

  it('uses wallet debt fallback when ledger is empty', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-03-10'),
      6,
      5,
    );
    const dto = buildCardStatementObligation({
      ...cardBase,
      cutoffDay: 6,
      dueDay: 5,
      window,
      lastStatementBalance: 0,
      paymentsAppliedToStatement: 0,
      importedTotalDue: null,
      outstandingBalance: 4579.54,
    });

    expect(dto.remainingStatementDue).toBe(4579.54);
    expect(dto.obligationAmountSource).toBe('wallet_debt');
    expect(dto.isEstimate).toBe(true);
  });

  it('projects open-cycle purchases for due-before-cutoff cards', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-05-04'),
      15,
      8,
    );
    const dto = buildCardStatementObligation({
      ...cardBase,
      cutoffDay: 15,
      dueDay: 8,
      window,
      lastStatementBalance: 0,
      paymentsAppliedToStatement: 0,
      importedTotalDue: null,
      outstandingBalance: 0,
      currentCyclePurchasesTotal: 600,
      currentCyclePaymentsTotal: 100,
      asOfYmd: '2026-05-04',
    });

    expect(dto.remainingStatementDue).toBe(500);
    expect(dto.obligationAmountSource).toBe('projection');
    expect(dto.isEstimate).toBe(true);
  });

  it('computes remaining planned amount as gross minus payments', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-03-10'),
      15,
      20,
    );
    const dto = buildCardStatementObligation({
      ...cardBase,
      window,
      lastStatementBalance: 800,
      paymentsAppliedToStatement: 300,
      importedTotalDue: null,
      plannedGrossAmount: 600,
      todayYmd: '2026-03-10',
    });

    expect(dto.remainingPlannedAmount).toBe(300);
    expect(dto.plannedGrossAmount).toBe(600);
  });

  it('marks overdue when due date passed and balance remains', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-02-10'),
      15,
      20,
    );
    const dto = buildCardStatementObligation({
      ...cardBase,
      window,
      lastStatementBalance: 500,
      paymentsAppliedToStatement: 0,
      importedTotalDue: null,
      todayYmd: '2026-03-25',
    });

    expect(dto.status).toBe('overdue');
  });

  it('returns no_obligation when nothing is due and no payments', () => {
    const window = resolveCreditCardStatementWindow(
      parseCalendarDate('2026-03-10'),
      15,
      20,
    );
    const dto = buildCardStatementObligation({
      ...cardBase,
      outstandingBalance: 0,
      window,
      lastStatementBalance: 0,
      paymentsAppliedToStatement: 0,
      importedTotalDue: null,
      todayYmd: '2026-03-10',
    });

    expect(dto.status).toBe('no_obligation');
    expect(dto.obligationAmountSource).toBe('none');
  });
});

describe('deriveObligationAmountSource', () => {
  it('returns none when remaining is zero', () => {
    expect(
      deriveObligationAmountSource({
        importedTotalDue: 100,
        lastStatementBalance: 100,
        outstandingBalance: 100,
        dueDay: 20,
        cutoffDay: 15,
        remainingStatementDue: 0,
      }),
    ).toBe('none');
  });
});

describe('getRemainingPlannedAmount', () => {
  it('returns null when no plan exists', () => {
    expect(
      getRemainingPlannedAmount({
        plannedGrossAmount: null,
        paymentsAppliedToStatement: 100,
        remainingStatementDue: 400,
      }),
    ).toBeNull();
  });

  it('never returns negative remaining plan', () => {
    expect(
      getRemainingPlannedAmount({
        plannedGrossAmount: 200,
        paymentsAppliedToStatement: 500,
        remainingStatementDue: 0,
      }),
    ).toBe(0);
  });
});

describe('deriveCardStatementObligationStatus', () => {
  it('uses remaining planned amount when present', () => {
    expect(
      deriveCardStatementObligationStatus({
        remainingStatementDue: 800,
        remainingPlannedAmount: 0,
        paymentsAppliedToStatement: 600,
        statementDueDateYmd: '2026-03-20',
        todayYmd: '2026-03-10',
      }),
    ).toBe('paid');
  });
});

describe('computeNextDuePayment (re-export parity)', () => {
  it('matches legacy formula for partial payment', () => {
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
});
