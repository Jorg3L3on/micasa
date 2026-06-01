import prisma from '@/lib/prisma';
import { PaymentMethodType } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { clearCreditCardPaymentPlan } from '@/lib/finance/credit-card-payment-plan.service';
import {
  computeLedgerExpectedDebt,
  detectCardReconciliationIssues,
  type CardReconciliationIssue,
  type CardReconciliationIssueKind,
  type CardReconciliationRepairAction,
} from '@/lib/finance/credit-card-reconciliation';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import { formatCalendarDate } from '@/lib/calendar-dates';

const creditCardWalletTypes: PaymentMethodType[] = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

export type CardReconciliationReport = {
  issues: CardReconciliationIssue[];
  summary: {
    total: number;
    repairable: number;
    byKind: Record<CardReconciliationIssueKind, number>;
  };
};

const emptyKindCounts = (): Record<CardReconciliationIssueKind, number> => ({
  wallet_debt_drift: 0,
  orphan_payment: 0,
  stale_covered_plan: 0,
  tampered_generated_expense: 0,
  import_sync_drift: 0,
});

const summarizeIssues = (issues: CardReconciliationIssue[]) => {
  const byKind = emptyKindCounts();
  for (const issue of issues) {
    byKind[issue.kind] += 1;
  }
  return {
    total: issues.length,
    repairable: issues.filter((i) => i.repairable).length,
    byKind,
  };
};

export async function getCreditCardReconciliationReport(
  ownerFilter: OwnerFilter,
  walletId?: number,
): Promise<CardReconciliationReport> {
  const wallets = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      active: true,
      type: { in: creditCardWalletTypes },
      ...(walletId != null ? { id: walletId } : {}),
    },
    select: {
      id: true,
      name: true,
      amount: true,
    },
    orderBy: { name: 'asc' },
  });

  if (wallets.length === 0) {
    return { issues: [], summary: summarizeIssues([]) };
  }

  const walletIds = wallets.map((w) => w.id);

  const [expenseAgg, paymentAgg, payments, plans, latestImports] =
    await Promise.all([
      prisma.expense.groupBy({
        by: ['wallet_id'],
        where: {
          ...ownerFilter,
          wallet_id: { in: walletIds },
          is_paid: true,
        },
        _sum: { amount: true },
      }),
      prisma.creditCardPayment.groupBy({
        by: ['credit_card_wallet_id'],
        where: {
          ...ownerFilter,
          credit_card_wallet_id: { in: walletIds },
        },
        _sum: { amount: true },
      }),
      prisma.creditCardPayment.findMany({
        where: {
          ...ownerFilter,
          credit_card_wallet_id: { in: walletIds },
        },
        select: {
          id: true,
          amount: true,
          paid_at: true,
          expense_id: true,
          source_wallet_id: true,
          credit_card_wallet_id: true,
          credit_card_wallet: { select: { name: true } },
          expense: {
            select: {
              id: true,
              amount: true,
              is_paid: true,
              wallet_id: true,
            },
          },
        },
        orderBy: { paid_at: 'desc' },
      }),
      prisma.creditCardPaymentPlan.findMany({
        where: {
          ...ownerFilter,
          credit_card_wallet_id: { in: walletIds },
        },
        select: {
          id: true,
          credit_card_wallet_id: true,
          fortnight_id: true,
          planned_amount: true,
          credit_card_wallet: {
            select: {
              name: true,
              type: true,
              due_day: true,
              cutoff_day: true,
            },
          },
          fortnight: { select: { label: true, year: true, month: true, period: true } },
        },
      }),
      prisma.creditCardStatementImport.findMany({
        where: {
          ...ownerFilter,
          wallet_id: { in: walletIds },
        },
        orderBy: { created_at: 'desc' },
        distinct: ['wallet_id'],
        select: {
          id: true,
          wallet_id: true,
          total_due: true,
        },
      }),
    ]);

  const expenseByWallet = new Map(
    expenseAgg.map((row) => [row.wallet_id!, Number(row._sum.amount ?? 0)]),
  );
  const paymentByWallet = new Map(
    paymentAgg.map((row) => [
      row.credit_card_wallet_id,
      Number(row._sum.amount ?? 0),
    ]),
  );
  const latestImportByWallet = new Map(
    latestImports.map((row) => [
      row.wallet_id,
      {
        id: row.id,
        totalDue:
          row.total_due != null ? Number(row.total_due) : null,
      },
    ]),
  );

  const statementByWallet = new Map<
    number,
    Awaited<ReturnType<typeof getCreditCardStatementByOwner>>
  >();
  await Promise.all(
    wallets.map(async (wallet) => {
      try {
        const statement = await getCreditCardStatementByOwner(
          wallet.id,
          ownerFilter,
        );
        statementByWallet.set(wallet.id, statement);
      } catch {
        // Skip wallets missing cutoff/due configuration.
      }
    }),
  );

  const walletInputs = wallets.map((wallet) => {
    const latest = latestImportByWallet.get(wallet.id);
    return {
      walletId: wallet.id,
      walletName: wallet.name,
      registeredDebt: Number(wallet.amount),
      paidExpenseTotal: expenseByWallet.get(wallet.id) ?? 0,
      paymentTotal: paymentByWallet.get(wallet.id) ?? 0,
      latestImportTotalDue: latest?.totalDue ?? null,
      latestImportId: latest?.id ?? null,
    };
  });

  const paymentInputs = payments.map((payment) => ({
    id: payment.id,
    walletId: payment.credit_card_wallet_id,
    walletName: payment.credit_card_wallet.name,
    amount: Number(payment.amount),
    paidAt: formatCalendarDate(payment.paid_at),
    expenseId: payment.expense_id,
    expenseAmount:
      payment.expense != null ? Number(payment.expense.amount) : null,
    expenseIsPaid: payment.expense?.is_paid ?? null,
    expenseWalletId: payment.expense?.wallet_id ?? null,
    sourceWalletId: payment.source_wallet_id,
  }));

  const planInputs = plans
    .filter((plan) => {
      const card = plan.credit_card_wallet;
      return (
        isCreditWalletType(card.type as PaymentMethodType) &&
        card.due_day != null &&
        card.cutoff_day != null
      );
    })
    .map((plan) => {
      const statement = statementByWallet.get(plan.credit_card_wallet_id);
      return {
        id: plan.id,
        walletId: plan.credit_card_wallet_id,
        walletName: plan.credit_card_wallet.name,
        fortnightId: plan.fortnight_id,
        fortnightLabel: plan.fortnight.label,
        plannedAmount: Number(plan.planned_amount),
        paymentsAppliedToStatement:
          statement?.payments_applied_to_statement ?? 0,
        remainingStatementDue: statement?.next_due_payment ?? 0,
      };
    });

  const issues = detectCardReconciliationIssues({
    wallets: walletInputs,
    payments: paymentInputs,
    plans: planInputs,
  });

  return {
    issues,
    summary: summarizeIssues(issues),
  };
}

export type RepairCreditCardReconciliationInput = {
  kinds?: CardReconciliationIssueKind[];
  walletId?: number;
  dryRun?: boolean;
};

export type RepairCreditCardReconciliationResult = {
  dryRun: boolean;
  repaired: string[];
  skipped: string[];
};

const repairStalePlan = async (
  ownerFilter: OwnerFilter,
  issue: CardReconciliationIssue,
  dryRun: boolean,
): Promise<string | null> => {
  if (
    issue.repairAction !== 'clear_stale_plan' ||
    issue.fortnightId == null ||
    issue.planId == null
  ) {
    return null;
  }
  if (dryRun) {
    return `Eliminar plan obsoleto #${issue.planId} (${issue.walletName})`;
  }
  await clearCreditCardPaymentPlan(
    ownerFilter,
    issue.fortnightId,
    issue.walletId,
  );
  return `Plan obsoleto eliminado: ${issue.walletName} (${issue.details.fortnightId})`;
};

const repairWalletDebt = async (
  ownerFilter: OwnerFilter,
  issue: CardReconciliationIssue,
  dryRun: boolean,
): Promise<string | null> => {
  if (issue.repairAction !== 'sync_wallet_debt') {
    return null;
  }

  const wallet = await prisma.wallet.findFirst({
    where: { id: issue.walletId, ...ownerFilter },
    select: { id: true, amount: true },
  });
  if (!wallet) {
    return null;
  }

  const [expenseAgg, paymentAgg] = await Promise.all([
    prisma.expense.aggregate({
      where: {
        ...ownerFilter,
        wallet_id: wallet.id,
        is_paid: true,
      },
      _sum: { amount: true },
    }),
    prisma.creditCardPayment.aggregate({
      where: {
        ...ownerFilter,
        credit_card_wallet_id: wallet.id,
      },
      _sum: { amount: true },
    }),
  ]);

  const target = computeLedgerExpectedDebt(
    Number(expenseAgg._sum.amount ?? 0),
    Number(paymentAgg._sum.amount ?? 0),
  );

  if (dryRun) {
    return `Sincronizar deuda de ${issue.walletName}: ${Number(wallet.amount).toFixed(2)} → ${target.toFixed(2)}`;
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { amount: target },
  });
  return `Deuda sincronizada: ${issue.walletName} → ${target.toFixed(2)}`;
};

const repairImportTotal = async (
  ownerFilter: OwnerFilter,
  issue: CardReconciliationIssue,
  dryRun: boolean,
): Promise<string | null> => {
  if (issue.repairAction !== 'sync_import_total') {
    return null;
  }

  const importTotalDue =
    typeof issue.details.importTotalDue === 'number'
      ? issue.details.importTotalDue
      : null;
  if (importTotalDue == null) {
    return null;
  }

  const wallet = await prisma.wallet.findFirst({
    where: { id: issue.walletId, ...ownerFilter },
    select: { id: true, amount: true },
  });
  if (!wallet) {
    return null;
  }

  if (dryRun) {
    return `Alinear ${issue.walletName} con import: ${Number(wallet.amount).toFixed(2)} → ${importTotalDue.toFixed(2)}`;
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { amount: importTotalDue },
  });
  return `Deuda alineada con import: ${issue.walletName} → ${importTotalDue.toFixed(2)}`;
};

const repairGeneratedExpense = async (
  ownerFilter: OwnerFilter,
  issue: CardReconciliationIssue,
  dryRun: boolean,
): Promise<string | null> => {
  if (
    issue.repairAction !== 'fix_generated_expense' ||
    issue.paymentId == null ||
    issue.expenseId == null
  ) {
    return null;
  }

  const payment = await prisma.creditCardPayment.findFirst({
    where: {
      id: issue.paymentId,
      ...ownerFilter,
    },
    select: {
      amount: true,
      source_wallet_id: true,
      expense: {
        select: {
          id: true,
          amount: true,
          is_paid: true,
          wallet_id: true,
        },
      },
    },
  });

  if (!payment?.expense) {
    return null;
  }

  const paymentAmount = Number(payment.amount);
  if (dryRun) {
    return `Corregir gasto #${payment.expense.id} del pago #${issue.paymentId}`;
  }

  await prisma.expense.update({
    where: { id: payment.expense.id },
    data: {
      amount: paymentAmount,
      is_paid: true,
      wallet_id: payment.source_wallet_id,
    },
  });
  return `Gasto #${payment.expense.id} alineado con pago #${issue.paymentId}`;
};

const repairIssue = async (
  ownerFilter: OwnerFilter,
  issue: CardReconciliationIssue,
  dryRun: boolean,
): Promise<string | null> => {
  switch (issue.repairAction as CardReconciliationRepairAction | undefined) {
    case 'clear_stale_plan':
      return repairStalePlan(ownerFilter, issue, dryRun);
    case 'sync_wallet_debt':
      return repairWalletDebt(ownerFilter, issue, dryRun);
    case 'sync_import_total':
      return repairImportTotal(ownerFilter, issue, dryRun);
    case 'fix_generated_expense':
      return repairGeneratedExpense(ownerFilter, issue, dryRun);
    default:
      return null;
  }
};

export async function repairCreditCardReconciliationIssues(
  ownerFilter: OwnerFilter,
  input: RepairCreditCardReconciliationInput = {},
): Promise<RepairCreditCardReconciliationResult> {
  const dryRun = input.dryRun === true;
  const report = await getCreditCardReconciliationReport(
    ownerFilter,
    input.walletId,
  );

  const kindFilter = input.kinds ? new Set(input.kinds) : null;
  const repairable = report.issues.filter((issue) => {
    if (!issue.repairable) return false;
    if (kindFilter && !kindFilter.has(issue.kind)) return false;
    return true;
  });

  const repaired: string[] = [];
  const skipped: string[] = [];

  for (const issue of repairable) {
    const message = await repairIssue(ownerFilter, issue, dryRun);
    if (message) {
      repaired.push(message);
    } else {
      skipped.push(`${issue.kind}:${issue.walletId}`);
    }
  }

  for (const issue of report.issues) {
    if (!issue.repairable) {
      skipped.push(`${issue.kind}:${issue.walletId}`);
    }
  }

  return { dryRun, repaired, skipped: [...new Set(skipped)] };
}
