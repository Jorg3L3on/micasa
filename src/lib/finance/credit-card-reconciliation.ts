import { getRemainingPlannedAmount } from '@/lib/finance/card-statement-obligation';

/** Minimum peso delta before flagging wallet debt drift. */
export const RECONCILIATION_DRIFT_THRESHOLD = 1;

export type CardReconciliationIssueKind =
  | 'wallet_debt_drift'
  | 'orphan_payment'
  | 'stale_covered_plan'
  | 'tampered_generated_expense'
  | 'import_sync_drift';

export type CardReconciliationRepairAction =
  | 'clear_stale_plan'
  | 'sync_wallet_debt'
  | 'sync_import_total'
  | 'fix_generated_expense';

export type CardReconciliationIssue = {
  kind: CardReconciliationIssueKind;
  walletId: number;
  walletName: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  details: Record<string, string | number | boolean | null>;
  repairable: boolean;
  repairAction?: CardReconciliationRepairAction;
  paymentId?: number;
  planId?: number;
  expenseId?: number;
  importId?: number;
  fortnightId?: number;
};

export type CardReconciliationWalletInput = {
  walletId: number;
  walletName: string;
  registeredDebt: number;
  paidExpenseTotal: number;
  paymentTotal: number;
  latestImportTotalDue: number | null;
  latestImportId: number | null;
};

export type CardReconciliationPaymentInput = {
  id: number;
  walletId: number;
  walletName: string;
  amount: number;
  paidAt: string;
  expenseId: number | null;
  expenseAmount: number | null;
  expenseIsPaid: boolean | null;
  expenseWalletId: number | null;
  sourceWalletId: number;
};

export type CardReconciliationPlanInput = {
  id: number;
  walletId: number;
  walletName: string;
  fortnightId: number;
  fortnightLabel: string;
  plannedAmount: number;
  paymentsAppliedToStatement: number;
  remainingStatementDue: number;
};

export const computeLedgerExpectedDebt = (
  paidExpenseTotal: number,
  paymentTotal: number,
): number => Math.max(0, paidExpenseTotal - paymentTotal);

export const isStaleFullyCoveredPlan = (input: {
  plannedAmount: number | null;
  paymentsAppliedToStatement: number;
  remainingStatementDue: number;
}): boolean => {
  if (input.plannedAmount == null || input.plannedAmount <= 0) {
    return false;
  }
  const remaining = getRemainingPlannedAmount({
    plannedGrossAmount: input.plannedAmount,
    paymentsAppliedToStatement: input.paymentsAppliedToStatement,
    remainingStatementDue: input.remainingStatementDue,
  });
  return remaining != null && remaining <= 0 && input.paymentsAppliedToStatement > 0;
};

export const detectWalletDebtDrift = (
  wallet: CardReconciliationWalletInput,
): CardReconciliationIssue | null => {
  const ledgerExpected = computeLedgerExpectedDebt(
    wallet.paidExpenseTotal,
    wallet.paymentTotal,
  );
  const delta = wallet.registeredDebt - ledgerExpected;
  if (Math.abs(delta) < RECONCILIATION_DRIFT_THRESHOLD) {
    return null;
  }

  return {
    kind: 'wallet_debt_drift',
    walletId: wallet.walletId,
    walletName: wallet.walletName,
    severity: Math.abs(delta) > 50 ? 'error' : 'warning',
    message: `Deuda registrada (${wallet.registeredDebt.toFixed(2)}) difiere del ledger (${ledgerExpected.toFixed(2)}).`,
    details: {
      registeredDebt: wallet.registeredDebt,
      ledgerExpectedDebt: ledgerExpected,
      delta,
      paidExpenseTotal: wallet.paidExpenseTotal,
      paymentTotal: wallet.paymentTotal,
    },
    repairable: true,
    repairAction: 'sync_wallet_debt',
  };
};

export const detectImportSyncDrift = (
  wallet: CardReconciliationWalletInput,
): CardReconciliationIssue | null => {
  if (wallet.latestImportTotalDue == null || wallet.latestImportId == null) {
    return null;
  }
  const delta = wallet.registeredDebt - wallet.latestImportTotalDue;
  if (Math.abs(delta) < RECONCILIATION_DRIFT_THRESHOLD) {
    return null;
  }

  return {
    kind: 'import_sync_drift',
    walletId: wallet.walletId,
    walletName: wallet.walletName,
    severity: 'warning',
    message: `Deuda registrada no coincide con el último import (${wallet.latestImportTotalDue.toFixed(2)}).`,
    details: {
      registeredDebt: wallet.registeredDebt,
      importTotalDue: wallet.latestImportTotalDue,
      delta,
      importId: wallet.latestImportId,
    },
    repairable: true,
    repairAction: 'sync_import_total',
    importId: wallet.latestImportId,
  };
};

export const detectOrphanPayment = (
  payment: CardReconciliationPaymentInput,
): CardReconciliationIssue | null => {
  if (payment.expenseId != null) {
    return null;
  }

  return {
    kind: 'orphan_payment',
    walletId: payment.walletId,
    walletName: payment.walletName,
    severity: 'info',
    message: `Pago del ${payment.paidAt} sin gasto en quincena (huérfano).`,
    details: {
      paymentId: payment.id,
      amount: payment.amount,
      paidAt: payment.paidAt,
    },
    repairable: false,
    paymentId: payment.id,
  };
};

export const detectTamperedGeneratedExpense = (
  payment: CardReconciliationPaymentInput,
): CardReconciliationIssue | null => {
  if (payment.expenseId == null) {
    return null;
  }

  const problems: string[] = [];
  if (payment.expenseAmount == null) {
    problems.push('gasto eliminado');
  } else {
    if (Math.abs(payment.expenseAmount - payment.amount) >= RECONCILIATION_DRIFT_THRESHOLD) {
      problems.push('monto distinto al pago');
    }
    if (payment.expenseIsPaid === false) {
      problems.push('marcado como no pagado');
    }
    if (
      payment.expenseWalletId != null &&
      payment.expenseWalletId !== payment.sourceWalletId
    ) {
      problems.push('billetera distinta al origen del pago');
    }
  }

  if (problems.length === 0) {
    return null;
  }

  return {
    kind: 'tampered_generated_expense',
    walletId: payment.walletId,
    walletName: payment.walletName,
    severity: 'error',
    message: `Gasto generado por pago #${payment.id}: ${problems.join(', ')}.`,
    details: {
      paymentId: payment.id,
      expenseId: payment.expenseId,
      paymentAmount: payment.amount,
      expenseAmount: payment.expenseAmount,
      expenseIsPaid: payment.expenseIsPaid,
      expenseWalletId: payment.expenseWalletId,
      sourceWalletId: payment.sourceWalletId,
    },
    repairable: payment.expenseAmount != null,
    repairAction: payment.expenseAmount != null ? 'fix_generated_expense' : undefined,
    paymentId: payment.id,
    expenseId: payment.expenseId,
  };
};

export const detectStaleCoveredPlan = (
  plan: CardReconciliationPlanInput,
): CardReconciliationIssue | null => {
  if (
    !isStaleFullyCoveredPlan({
      plannedAmount: plan.plannedAmount,
      paymentsAppliedToStatement: plan.paymentsAppliedToStatement,
      remainingStatementDue: plan.remainingStatementDue,
    })
  ) {
    return null;
  }

  return {
    kind: 'stale_covered_plan',
    walletId: plan.walletId,
    walletName: plan.walletName,
    severity: 'warning',
    message: `Plan de ${plan.fortnightLabel} ya cubierto por pagos; no debería inflar pendientes.`,
    details: {
      planId: plan.id,
      fortnightId: plan.fortnightId,
      plannedAmount: plan.plannedAmount,
      paymentsAppliedToStatement: plan.paymentsAppliedToStatement,
      remainingStatementDue: plan.remainingStatementDue,
    },
    repairable: true,
    repairAction: 'clear_stale_plan',
    planId: plan.id,
    fortnightId: plan.fortnightId,
  };
};

export const detectCardReconciliationIssues = (input: {
  wallets: CardReconciliationWalletInput[];
  payments: CardReconciliationPaymentInput[];
  plans: CardReconciliationPlanInput[];
}): CardReconciliationIssue[] => {
  const issues: CardReconciliationIssue[] = [];

  for (const wallet of input.wallets) {
    const drift = detectWalletDebtDrift(wallet);
    if (drift) issues.push(drift);
    const importDrift = detectImportSyncDrift(wallet);
    if (importDrift) issues.push(importDrift);
  }

  for (const payment of input.payments) {
    const orphan = detectOrphanPayment(payment);
    if (orphan) issues.push(orphan);
    const tampered = detectTamperedGeneratedExpense(payment);
    if (tampered) issues.push(tampered);
  }

  for (const plan of input.plans) {
    const stale = detectStaleCoveredPlan(plan);
    if (stale) issues.push(stale);
  }

  return issues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    const kindOrder = (k: CardReconciliationIssueKind) =>
      ({
        wallet_debt_drift: 0,
        tampered_generated_expense: 1,
        stale_covered_plan: 2,
        import_sync_drift: 3,
        orphan_payment: 4,
      })[k];
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    if (a.walletName !== b.walletName) {
      return a.walletName.localeCompare(b.walletName);
    }
    return kindOrder(a.kind) - kindOrder(b.kind);
  });
};
