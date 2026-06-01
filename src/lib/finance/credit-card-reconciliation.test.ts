import { describe, expect, it } from 'vitest';
import {
  computeLedgerExpectedDebt,
  detectCardReconciliationIssues,
  detectStaleCoveredPlan,
  detectTamperedGeneratedExpense,
  detectWalletDebtDrift,
  isStaleFullyCoveredPlan,
} from '@/lib/finance/credit-card-reconciliation';

describe('computeLedgerExpectedDebt', () => {
  it('subtracts payments from paid purchases', () => {
    expect(computeLedgerExpectedDebt(5000, 1200)).toBe(3800);
  });

  it('never returns negative debt', () => {
    expect(computeLedgerExpectedDebt(500, 800)).toBe(0);
  });
});

describe('isStaleFullyCoveredPlan', () => {
  it('flags Liverpool-style plan fully paid down', () => {
    expect(
      isStaleFullyCoveredPlan({
        plannedAmount: 694.76,
        paymentsAppliedToStatement: 694.76,
        remainingStatementDue: 3884.78,
      }),
    ).toBe(true);
  });

  it('ignores plans without payments applied', () => {
    expect(
      isStaleFullyCoveredPlan({
        plannedAmount: 500,
        paymentsAppliedToStatement: 0,
        remainingStatementDue: 1000,
      }),
    ).toBe(false);
  });

  it('ignores null plans', () => {
    expect(
      isStaleFullyCoveredPlan({
        plannedAmount: null,
        paymentsAppliedToStatement: 100,
        remainingStatementDue: 0,
      }),
    ).toBe(false);
  });
});

describe('detectWalletDebtDrift', () => {
  it('detects registered debt above ledger', () => {
    const issue = detectWalletDebtDrift({
      walletId: 7,
      walletName: 'Liverpool',
      registeredDebt: 4200,
      paidExpenseTotal: 5000,
      paymentTotal: 1200,
      latestImportTotalDue: null,
      latestImportId: null,
    });
    expect(issue?.kind).toBe('wallet_debt_drift');
    expect(issue?.details.delta).toBe(400);
    expect(issue?.repairable).toBe(true);
  });

  it('ignores sub-peso drift', () => {
    expect(
      detectWalletDebtDrift({
        walletId: 1,
        walletName: 'MP',
        registeredDebt: 100.5,
        paidExpenseTotal: 200,
        paymentTotal: 99.6,
        latestImportTotalDue: null,
        latestImportId: null,
      }),
    ).toBeNull();
  });
});

describe('detectTamperedGeneratedExpense', () => {
  it('flags edited amount on generated expense', () => {
    const issue = detectTamperedGeneratedExpense({
      id: 12,
      walletId: 3,
      walletName: 'Liverpool',
      amount: 694.76,
      paidAt: '2026-04-10',
      expenseId: 88,
      expenseAmount: 500,
      expenseIsPaid: true,
      expenseWalletId: 2,
      sourceWalletId: 2,
    });
    expect(issue?.kind).toBe('tampered_generated_expense');
    expect(issue?.repairAction).toBe('fix_generated_expense');
  });

  it('flags expense moved to wrong wallet', () => {
    const issue = detectTamperedGeneratedExpense({
      id: 12,
      walletId: 3,
      walletName: 'Liverpool',
      amount: 694.76,
      paidAt: '2026-04-10',
      expenseId: 88,
      expenseAmount: 694.76,
      expenseIsPaid: true,
      expenseWalletId: 99,
      sourceWalletId: 2,
    });
    expect(issue?.kind).toBe('tampered_generated_expense');
  });
});

describe('detectStaleCoveredPlan', () => {
  it('returns stale covered plan issue', () => {
    const issue = detectStaleCoveredPlan({
      id: 5,
      walletId: 3,
      walletName: 'Liverpool',
      fortnightId: 20,
      fortnightLabel: 'Abr 2026 · 1ª',
      plannedAmount: 694.76,
      paymentsAppliedToStatement: 694.76,
      remainingStatementDue: 3884.78,
    });
    expect(issue?.kind).toBe('stale_covered_plan');
    expect(issue?.repairAction).toBe('clear_stale_plan');
  });
});

describe('detectCardReconciliationIssues', () => {
  it('aggregates inconsistent fixture data', () => {
    const issues = detectCardReconciliationIssues({
      wallets: [
        {
          walletId: 3,
          walletName: 'Liverpool',
          registeredDebt: 4200,
          paidExpenseTotal: 5000,
          paymentTotal: 1200,
          latestImportTotalDue: 4100,
          latestImportId: 9,
        },
      ],
      payments: [
        {
          id: 10,
          walletId: 3,
          walletName: 'Liverpool',
          amount: 694.76,
          paidAt: '2026-04-10',
          expenseId: null,
          expenseAmount: null,
          expenseIsPaid: null,
          expenseWalletId: null,
          sourceWalletId: 2,
        },
        {
          id: 11,
          walletId: 3,
          walletName: 'Liverpool',
          amount: 505.24,
          paidAt: '2026-04-12',
          expenseId: 90,
          expenseAmount: 400,
          expenseIsPaid: false,
          expenseWalletId: 2,
          sourceWalletId: 2,
        },
      ],
      plans: [
        {
          id: 5,
          walletId: 3,
          walletName: 'Liverpool',
          fortnightId: 20,
          fortnightLabel: 'Abr 2026 · 1ª',
          plannedAmount: 694.76,
          paymentsAppliedToStatement: 694.76,
          remainingStatementDue: 3884.78,
        },
      ],
    });

    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain('wallet_debt_drift');
    expect(kinds).toContain('import_sync_drift');
    expect(kinds).toContain('orphan_payment');
    expect(kinds).toContain('tampered_generated_expense');
    expect(kinds).toContain('stale_covered_plan');
    expect(issues.filter((i) => i.repairable).length).toBeGreaterThanOrEqual(3);
  });
});
