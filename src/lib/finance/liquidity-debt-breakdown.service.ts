import { formatCalendarDate } from '@/lib/calendar-dates';
import { resolveCreditCardStatementWindow } from '@/lib/finance/credit-card-statement.service';
import { isCreditInstallmentExpense } from '@/lib/finance/expense-planning-scope';
import {
  composeCardDebtAccount,
  composeLoanDebtAccount,
  summarizeDebtBreakdown,
  type CardCycleInput,
  type CardMsiInput,
  type CardPlanInput,
  type LiquidityDebtBreakdown,
} from '@/lib/finance/liquidity-debt-breakdown';
import { listLoansByOwner } from '@/lib/finance/loan.service';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

const CREDIT_WALLET_TYPES = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] as const;

const toMoney = (value: unknown): number => {
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isWithinRange = (value: Date, start: Date, end: Date): boolean =>
  value.getTime() >= start.getTime() && value.getTime() <= end.getTime();

/**
 * One batched read of card plazos/resto and loan cuotas. Does not fetch
 * per-card statements.
 */
export const getLiquidityDebtBreakdown = async (
  ownerFilter: OwnerFilter,
  asOf: Date = new Date(),
): Promise<LiquidityDebtBreakdown> => {
  const todayYmd = formatCalendarDate(asOf);

  const [wallets, expenses, plans, loans] = await Promise.all([
    prisma.wallet.findMany({
      where: {
        ...ownerFilter,
        active: true,
        type: { in: [...CREDIT_WALLET_TYPES] },
      },
      select: {
        id: true,
        name: true,
        amount: true,
        cutoff_day: true,
        due_day: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.expense.findMany({
      where: {
        ...ownerFilter,
        is_paid: true,
        wallet: {
          active: true,
          type: { in: [...CREDIT_WALLET_TYPES] },
        },
      },
      select: {
        id: true,
        wallet_id: true,
        description: true,
        amount: true,
        payment_date: true,
        created_at: true,
        credit_installment_current: true,
        credit_installment_total: true,
      },
    }),
    prisma.creditCardInstallmentPlan.findMany({
      where: {
        ...ownerFilter,
        status: 'ACTIVE',
        credit_card_wallet: {
          active: true,
          type: { in: [...CREDIT_WALLET_TYPES] },
        },
      },
      select: {
        id: true,
        name: true,
        credit_card_wallet_id: true,
        installment_amount: true,
        total_installments: true,
        paid_installments: true,
        already_in_card_balance: true,
        payments: {
          where: { status: 'SCHEDULED' },
          select: { amount: true },
        },
      },
    }),
    listLoansByOwner(ownerFilter),
  ]);

  const expensesByWallet = new Map<number, typeof expenses>();
  for (const expense of expenses) {
    if (expense.wallet_id == null) continue;
    const list = expensesByWallet.get(expense.wallet_id) ?? [];
    list.push(expense);
    expensesByWallet.set(expense.wallet_id, list);
  }

  const plansByWallet = new Map<number, typeof plans>();
  for (const plan of plans) {
    const list = plansByWallet.get(plan.credit_card_wallet_id) ?? [];
    list.push(plan);
    plansByWallet.set(plan.credit_card_wallet_id, list);
  }

  const cardAccounts = wallets.map((wallet) => {
    const walletExpenses = expensesByWallet.get(wallet.id) ?? [];
    const msi: CardMsiInput[] = walletExpenses.flatMap((expense) => {
      const current = expense.credit_installment_current;
      const total = expense.credit_installment_total;
      if (current == null || total == null || current >= total) return [];
      return [
        {
          id: expense.id,
          title: expense.description,
          current,
          total,
          monthlyAmount: toMoney(expense.amount),
        },
      ];
    });

    const walletPlans: CardPlanInput[] = (plansByWallet.get(wallet.id) ?? []).map(
      (plan) => ({
        id: plan.id,
        title: plan.name,
        current: plan.paid_installments + 1,
        total: plan.total_installments,
        remainingAmount: plan.payments.reduce(
          (sum, payment) => sum + toMoney(payment.amount),
          0,
        ),
        monthlyAmount: toMoney(plan.installment_amount),
        alreadyInCardBalance: plan.already_in_card_balance,
      }),
    );

    let cycle: CardCycleInput[] = [];
    if (wallet.cutoff_day != null && wallet.due_day != null) {
      const window = resolveCreditCardStatementWindow(
        asOf,
        wallet.cutoff_day,
        wallet.due_day,
      );
      cycle = walletExpenses.flatMap((expense) => {
        if (isCreditInstallmentExpense(expense)) return [];
        const effectiveDate = expense.payment_date ?? expense.created_at;
        if (!isWithinRange(effectiveDate, window.currentCycleStart, window.currentCycleEnd)) {
          return [];
        }
        return [
          {
            id: expense.id,
            title: expense.description,
            amount: toMoney(expense.amount),
            date: formatCalendarDate(effectiveDate),
          },
        ];
      });
    }

    return composeCardDebtAccount({
      walletId: wallet.id,
      name: wallet.name,
      outstanding: toMoney(wallet.amount),
      msi,
      plans: walletPlans,
      cycle,
    });
  });

  const loanAccounts = loans
    .filter(
      (loan) =>
        (loan.status === 'ACTIVE' || loan.status === 'PAUSED') &&
        loan.remainingAmount > 0,
    )
    .map((loan) =>
      composeLoanDebtAccount({
        loanId: loan.id,
        name: loan.name,
        remainingAmount: loan.remainingAmount,
        remainingPayments: loan.remainingPayments,
        nextDueDate: loan.nextPayment?.dueDate ?? null,
        nextAmount: loan.nextPayment?.amount ?? null,
        payments: (loan.payments ?? []).map((payment) => ({
          id: payment.id,
          dueDate: payment.dueDate,
          amount: payment.amount,
          status: payment.status,
        })),
        todayYmd,
      }),
    );

  return summarizeDebtBreakdown([...cardAccounts, ...loanAccounts]);
};
