import { formatCalendarDate } from '@/lib/calendar-dates';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { TransactionRow } from '@/types/catalog';
import { whereExcludeCreditInstallments } from '@/lib/finance/expense-planning-scope';
import {
  buildFortnightWhereForReport,
  linkedCardPaymentExpenseIds,
  listCreditCardPaymentsForPlanning,
  mapCreditCardPaymentToTransactionRow,
  unionPaidAtRangeFromFortnights,
} from '@/lib/finance/planning-credit-card-payments';

const decimalToNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export type ListPlanningTransactionsParams = {
  ownerFilter: OwnerFilter;
  month?: string | null;
  year?: string | null;
  period?: string | null;
  type?: string | null;
  isPaid?: boolean;
  excludeCreditInstallment: boolean;
  /** When set, skips re-resolving fortnights for the scoped month/period. */
  resolvedFortnightIds?: number[];
};

export const listPlanningTransactions = async (
  params: ListPlanningTransactionsParams,
): Promise<TransactionRow[]> => {
  const {
    ownerFilter,
    month,
    year,
    period,
    type,
    isPaid,
    excludeCreditInstallment,
    resolvedFortnightIds,
  } = params;

  let fortnightIds: number[] | undefined;
  if (resolvedFortnightIds !== undefined) {
    fortnightIds = resolvedFortnightIds;
  } else if (month || year || period) {
    const base: {
      month?: number;
      year?: number;
      period?: 'FIRST' | 'SECOND';
    } = {};
    if (month) base.month = parseInt(month, 10);
    if (year) base.year = parseInt(year, 10);
    if (period) base.period = period as 'FIRST' | 'SECOND';

    const fortnights = await prisma.fortnight.findMany({
      where: { ...ownerFilter, ...base },
      select: { id: true },
    });
    fortnightIds = fortnights.map((f) => f.id);
    if (fortnightIds.length === 0) fortnightIds = [];
  }

  let expenseWhere: Prisma.ExpenseWhereInput = { ...ownerFilter };
  if (fortnightIds !== undefined) {
    expenseWhere.fortnight_id = { in: fortnightIds };
  }
  if (isPaid !== undefined) {
    expenseWhere.is_paid = isPaid;
  }
  if (excludeCreditInstallment) {
    expenseWhere = {
      AND: [expenseWhere, whereExcludeCreditInstallments()],
    };
  }

  const expenses = await prisma.expense.findMany({
    where: expenseWhere,
    include: {
      category: { select: { name: true, icon: true } },
      wallet: { select: { name: true, type: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  let cardPaymentsForPlanning: Awaited<
    ReturnType<typeof listCreditCardPaymentsForPlanning>
  > = [];
  let linkedCardPaymentExpenses = new Set<number>();
  if (excludeCreditInstallment && type !== 'income') {
    const fnWhere = buildFortnightWhereForReport(
      ownerFilter,
      month,
      year,
      period,
    );
    if (fnWhere != null) {
      const planningFortnights = await prisma.fortnight.findMany({
        where: fnWhere as Prisma.FortnightWhereInput,
        select: { start_date: true, end_date: true },
      });
      const paidAtRange = unionPaidAtRangeFromFortnights(planningFortnights);
      cardPaymentsForPlanning = await listCreditCardPaymentsForPlanning(
        ownerFilter,
        paidAtRange,
      );
      linkedCardPaymentExpenses = linkedCardPaymentExpenseIds(
        cardPaymentsForPlanning,
      );
    }
  }

  const expenseTransactions = expenses
    .filter(
      (expense) =>
        !excludeCreditInstallment ||
        !linkedCardPaymentExpenses.has(expense.id),
    )
    .map((expense) => {
      const dateValue = expense.payment_date || expense.created_at;
      const dateStr =
        dateValue instanceof Date
          ? formatCalendarDate(dateValue)
          : formatCalendarDate(new Date(dateValue));
      return {
        id: expense.id,
        date: dateStr,
        description: expense.description,
        amount: decimalToNumber(expense.amount),
        category: expense.category?.name ?? '',
        categoryIcon: expense.category?.icon ?? null,
        paymentMethod: expense.wallet?.name || 'Efectivo',
        wallet_id: expense.wallet_id ?? null,
        wallet_type: expense.wallet?.type ?? null,
        planning_row_kind: 'expense' as const,
        type: 'expense' as const,
        is_paid: expense.is_paid,
        payment_date: expense.payment_date,
        due_day: (expense as { due_day?: number | null }).due_day ?? null,
      };
    });

  const cardPaymentTransactions =
    isPaid === false
      ? []
      : cardPaymentsForPlanning.map(mapCreditCardPaymentToTransactionRow);

  const incomeWhere: Record<string, unknown> = {
    ...ownerFilter,
    source: { not: '__OVERRIDE__' },
  };
  if (fortnightIds !== undefined) {
    incomeWhere.fortnight_id = { in: fortnightIds };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  incomeWhere.received_at = { lte: today };

  const incomes = await prisma.income.findMany({
    where: incomeWhere,
    orderBy: { received_at: 'desc' },
  });

  const incomeTransactions: TransactionRow[] = incomes.map((income) => {
    const dateValue = income.received_at || income.created_at;
    const dateStr =
      dateValue instanceof Date
        ? formatCalendarDate(dateValue)
        : formatCalendarDate(new Date(dateValue));
    return {
      id: income.id,
      date: dateStr,
      description: income.source ?? 'Ingreso',
      amount: decimalToNumber(income.amount),
      category: '',
      categoryIcon: null,
      paymentMethod: 'Ingreso',
      type: 'income' as const,
      is_paid: true,
      due_day: null,
    };
  });

  let combined: TransactionRow[] = [
    ...expenseTransactions,
    ...cardPaymentTransactions,
    ...incomeTransactions,
  ];

  if (type === 'income' || type === 'expense') {
    combined = combined.filter((t) => t.type === type);
  }

  combined.sort((a, b) => b.date.localeCompare(a.date));

  return combined;
};
