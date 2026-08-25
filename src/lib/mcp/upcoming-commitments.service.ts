import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import { listInstallmentPlanPaymentsForPlannerMonth } from '@/lib/finance/credit-card-installment-plan.service';
import type { PlannerInstallmentPlanPaymentItem } from '@/lib/finance/credit-card-installment-plan.service';
import { getDuePaymentsForPlannerMonth } from '@/lib/finance/credit-card-statement.service';
import {
  DEFAULT_PROJECTION_HORIZON_DAYS,
  compareUtcDateOnly,
} from '@/lib/finance/liquidity-projection';
import {
  defaultLiquidityUntilFromAsOf,
  getLiquidityProjection,
} from '@/lib/finance/liquidity-projection.service';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { DuePaymentItem } from '@/types/catalog';

export type UpcomingCommitmentItem = {
  date: string;
  type: 'revolving' | 'msi' | 'loan';
  name: string;
  amount: number;
  is_paid: boolean;
  source_id: number;
  wallet_or_loan: string;
};

export type UpcomingCommitmentsResult = {
  year: number;
  month: number;
  from?: string;
  to?: string;
  period?: 'FIRST' | 'SECOND';
  items: UpcomingCommitmentItem[];
  period_total: number;
};

export type ListUpcomingCommitmentsInput = {
  ownerFilter: OwnerFilter;
  year?: number;
  month?: number;
  period?: 'FIRST' | 'SECOND';
  from?: string;
  to?: string;
};

const cardDueKey = (walletId: number, dueDateYmd: string): string =>
  `${walletId}:${dueDateYmd}`;

const itemDedupeKey = (item: UpcomingCommitmentItem): string =>
  `${item.type}:${item.source_id}:${item.date}`;

const isUnpaidCardPlannerRow = (item: DuePaymentItem): boolean => {
  if (item.plannerStatus === 'pagado' || item.plannerStatus === 'sin_cargo') {
    return false;
  }
  return getEffectiveCardPaymentAmount(item) > 0;
};

const sumMsiByWalletDate = (
  planPayments: PlannerInstallmentPlanPaymentItem[],
): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const payment of planPayments) {
    const key = cardDueKey(payment.walletId, payment.dueDate);
    totals.set(key, (totals.get(key) ?? 0) + payment.amount);
  }
  return totals;
};

const leftoverRevolvingFromCardDue = (
  payment: DuePaymentItem,
  msiOnDate: number,
): number => {
  const cardAmount = getEffectiveCardPaymentAmount(payment);
  if (cardAmount <= 0) return 0;

  if (payment.obligationAmountSource === 'scheduled_calendar') {
    return cardAmount;
  }

  return Math.max(0, cardAmount - msiOnDate);
};

const monthsInRange = (
  fromYmd: string,
  toYmd: string,
): Array<{ year: number; month: number }> => {
  const result: Array<{ year: number; month: number }> = [];
  let year = Number(fromYmd.slice(0, 4));
  let month = Number(fromYmd.slice(5, 7));
  const endKey = toYmd.slice(0, 7);

  while (true) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    result.push({ year, month });
    if (key >= endKey) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return result;
};

const resolveQueryRange = (input: ListUpcomingCommitmentsInput): {
  from: string;
  to: string;
  year: number;
  month: number;
} => {
  if (input.from && input.to) {
    return {
      from: input.from,
      to: input.to,
      year: Number(input.from.slice(0, 4)),
      month: Number(input.from.slice(5, 7)),
    };
  }

  const { year, month } =
    input.year != null && input.month != null
      ? { year: input.year, month: input.month }
      : {
          year: Number(todayCalendarDate().slice(0, 4)),
          month: Number(todayCalendarDate().slice(5, 7)),
        };

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    year,
    month,
  };
};

const matchesPeriodFilter = (
  dateYmd: string,
  period: 'FIRST' | 'SECOND',
): boolean => getFortnightPeriodForDay(Number(dateYmd.slice(8, 10))) === period;

const collectProjectedRevolvingFromLiquidity = async (
  ownerFilter: OwnerFilter,
  fromYmd: string,
  toYmd: string,
  msiByWalletDate: Map<string, number>,
  existingRevolvingKeys: Set<string>,
): Promise<UpcomingCommitmentItem[]> => {
  const today = todayCalendarDate();
  const horizonEnd = formatCalendarDate(defaultLiquidityUntilFromAsOf(new Date()));
  const projectionTo =
    compareUtcDateOnly(toYmd, horizonEnd) <= 0 ? toYmd : horizonEnd;
  if (compareUtcDateOnly(projectionTo, fromYmd) < 0) {
    return [];
  }

  const asOf =
    compareUtcDateOnly(fromYmd, today) >= 0
      ? parseCalendarDate(fromYmd)
      : parseCalendarDate(today);

  const projection = await getLiquidityProjection({
    ownerFilter,
    asOf,
    until: parseCalendarDate(projectionTo),
    includeUnpaidExpenses: false,
    includeExpenseTemplates: false,
  });

  const items: UpcomingCommitmentItem[] = [];

  for (const milestone of projection.milestones) {
    if (
      compareUtcDateOnly(milestone.due_date, fromYmd) < 0 ||
      compareUtcDateOnly(milestone.due_date, toYmd) > 0
    ) {
      continue;
    }

    for (const obligation of milestone.obligations) {
      if (obligation.source !== 'credit_card_statement') continue;
      if (obligation.next_due_payment <= 0) continue;

      const key = cardDueKey(obligation.wallet_id, milestone.due_date);
      if (existingRevolvingKeys.has(key)) continue;

      const msiOnDate = msiByWalletDate.get(key) ?? 0;
      const leftover = Math.max(0, obligation.next_due_payment - msiOnDate);
      if (leftover <= 0) continue;

      items.push({
        date: milestone.due_date,
        type: 'revolving',
        name: `Pago tarjeta ${obligation.wallet_name}`,
        amount: leftover,
        is_paid: false,
        source_id: obligation.wallet_id,
        wallet_or_loan: obligation.wallet_name,
      });
      existingRevolvingKeys.add(key);
    }
  }

  return items;
};

/**
 * Unified upcoming commitments for a planner month.
 *
 * Per card/date: sum(MSI plan cuotas in month) + leftover revolving (resto al
 * corte). Never drop MSI because a leftover revolving row exists; never stack
 * full statement due that already embeds those MSI with the same cuotas again.
 */
export async function listUpcomingCommitmentsForMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<UpcomingCommitmentsResult> {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const [cardDue, planPayments, loanPayments] = await Promise.all([
    getDuePaymentsForPlannerMonth(ownerFilter, year, month),
    listInstallmentPlanPaymentsForPlannerMonth(ownerFilter, year, month),
    listLoanPaymentsForPlannerMonth(ownerFilter, year, month),
  ]);

  const msiByWalletDate = sumMsiByWalletDate(planPayments);
  const items: UpcomingCommitmentItem[] = [];

  for (const payment of planPayments) {
    items.push({
      date: payment.dueDate,
      type: 'msi',
      name: payment.planName,
      amount: payment.amount,
      is_paid: false,
      source_id: payment.planId,
      wallet_or_loan: payment.walletName,
    });
  }

  for (const payment of [...cardDue.first, ...cardDue.second]) {
    if (!isUnpaidCardPlannerRow(payment)) continue;

    const date = payment.visibleDueDate ?? payment.statementDueDate;
    if (!date.startsWith(monthPrefix)) continue;

    const msiOnDate = msiByWalletDate.get(cardDueKey(payment.walletId, date)) ?? 0;
    const leftover = leftoverRevolvingFromCardDue(payment, msiOnDate);
    if (leftover <= 0) continue;

    items.push({
      date,
      type: 'revolving',
      name: `Pago tarjeta ${payment.walletName}`,
      amount: leftover,
      is_paid: false,
      source_id: payment.walletId,
      wallet_or_loan: payment.walletName,
    });
  }

  for (const payment of [...loanPayments.first, ...loanPayments.second]) {
    if (payment.status !== 'SCHEDULED') continue;
    items.push({
      date: payment.dueDate,
      type: 'loan',
      name: payment.loanName,
      amount: payment.amount,
      is_paid: false,
      source_id: payment.id,
      wallet_or_loan: payment.lender,
    });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  const periodTotal = items
    .filter((item) => !item.is_paid)
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    year,
    month,
    items,
    period_total: periodTotal,
  };
}

/**
 * Upcoming commitments for a calendar range, optional fortnight period filter,
 * and projected revolving from liquidity (same ~180-day horizon as Liquidez).
 */
export async function listUpcomingCommitments(
  input: ListUpcomingCommitmentsInput,
): Promise<UpcomingCommitmentsResult> {
  const range = resolveQueryRange(input);
  const months = monthsInRange(range.from, range.to);

  const itemMap = new Map<string, UpcomingCommitmentItem>();
  const msiByWalletDate = new Map<string, number>();
  const existingRevolvingKeys = new Set<string>();

  for (const { year, month } of months) {
    const [planPayments] = await Promise.all([
      listInstallmentPlanPaymentsForPlannerMonth(input.ownerFilter, year, month),
    ]);
    for (const [key, amount] of sumMsiByWalletDate(planPayments)) {
      msiByWalletDate.set(key, (msiByWalletDate.get(key) ?? 0) + amount);
    }

    const monthResult = await listUpcomingCommitmentsForMonth(
      input.ownerFilter,
      year,
      month,
    );

    for (const item of monthResult.items) {
      if (
        compareUtcDateOnly(item.date, range.from) < 0 ||
        compareUtcDateOnly(item.date, range.to) > 0
      ) {
        continue;
      }
      if (item.type === 'revolving') {
        existingRevolvingKeys.add(cardDueKey(item.source_id, item.date));
      }
      itemMap.set(itemDedupeKey(item), item);
    }
  }

  const projectedRevolving = await collectProjectedRevolvingFromLiquidity(
    input.ownerFilter,
    range.from,
    range.to,
    msiByWalletDate,
    existingRevolvingKeys,
  );
  for (const item of projectedRevolving) {
    itemMap.set(itemDedupeKey(item), item);
  }

  let items = [...itemMap.values()];
  if (input.period) {
    items = items.filter((item) => matchesPeriodFilter(item.date, input.period!));
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  const periodTotal = items
    .filter((item) => !item.is_paid)
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    year: range.year,
    month: range.month,
    from: input.from ?? range.from,
    to: input.to ?? range.to,
    ...(input.period ? { period: input.period } : {}),
    items,
    period_total: periodTotal,
  };
}

export { DEFAULT_PROJECTION_HORIZON_DAYS, addCalendarDays };
