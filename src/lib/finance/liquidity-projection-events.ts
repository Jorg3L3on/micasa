import { parseCalendarDate } from '@/lib/calendar-dates';
import { resolveCreditCardStatementWindow } from '@/lib/finance/credit-card-statement.service';
import {
  compareUtcDateOnly,
  toUtcDateOnlyString,
} from '@/lib/finance/liquidity-projection';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { PayrollDebtLineItem } from '@/lib/finance/liquidity-month-debt-items';

export type LiquidityProjectionEventType = 'loan_payoff' | 'msi_complete';

export type LiquidityProjectionEvent = {
  event_type: LiquidityProjectionEventType;
  event_date: string;
  month_key: string;
  title: string;
  subtitle: string;
  loan_id?: number;
  expense_id?: number;
  wallet_id?: number;
  wallet_name?: string;
  amount?: number;
};

export type LiquidityProjectionTrackKind = 'loan' | 'msi';

export type LiquidityProjectionTrack = {
  id: string;
  kind: LiquidityProjectionTrackKind;
  title: string;
  subtitle: string;
  start_month_key: string;
  end_month_key: string;
  finishes_in_horizon: boolean;
  monthly_amount: number;
  loan_id?: number;
  expense_id?: number;
  wallet_id?: number;
  wallet_name?: string;
};

export type LiquidityProjectionTimeline = {
  events: LiquidityProjectionEvent[];
  tracks: LiquidityProjectionTrack[];
  installmentPaymentsByMonth: Map<string, number>;
  payrollPaymentsByMonth: Map<string, number>;
  payrollLineItems: PayrollDebtLineItem[];
};

const toMonthKey = (ymd: string) => ymd.slice(0, 7);

export const compareMonthKeys = (a: string, b: string): number => a.localeCompare(b);

export const monthKeyFromOffset = (baseMonthKey: string, offsetMonths: number): string => {
  let [year, month] = baseMonthKey.split('-').map(Number);
  month += offsetMonths;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
};

const endOfMonthYmd = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const collectLoanTimeline = async (
  ownerFilter: OwnerFilter,
  asOfStr: string,
  untilStr: string,
  monthKeys: string[],
): Promise<{
  events: LiquidityProjectionEvent[];
  tracks: LiquidityProjectionTrack[];
  payrollPaymentsByMonth: Map<string, number>;
  payrollLineItems: PayrollDebtLineItem[];
}> => {
  const horizonStart = monthKeys[0] ?? toMonthKey(asOfStr);
  const horizonEnd = monthKeys[monthKeys.length - 1] ?? toMonthKey(untilStr);
  const asOf = parseCalendarDate(asOfStr);
  const monthKeySet = new Set(monthKeys);
  const payrollPaymentsByMonth = new Map<string, number>();
  for (const key of monthKeys) {
    payrollPaymentsByMonth.set(key, 0);
  }

  const loans = await prisma.loan.findMany({
    where: {
      ...ownerFilter,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      lender: true,
      payment_amount: true,
      payment_source: true,
      payments: {
        where: { status: 'SCHEDULED' },
        orderBy: { due_date: 'asc' },
        select: { due_date: true, amount: true },
      },
    },
  });

  const events: LiquidityProjectionEvent[] = [];
  const tracks: LiquidityProjectionTrack[] = [];
  const payrollLineItems: PayrollDebtLineItem[] = [];

  for (const loan of loans) {
    if (loan.payments.length === 0) continue;
    const firstDue = toUtcDateOnlyString(loan.payments[0]!.due_date);
    const lastPayment = loan.payments[loan.payments.length - 1]!;
    const lastDue = toUtcDateOnlyString(lastPayment.due_date);
    const lastMonth = toMonthKey(lastDue);
    const startMonth =
      compareMonthKeys(toMonthKey(firstDue), horizonStart) < 0
        ? horizonStart
        : toMonthKey(firstDue);
    const finishesInHorizon = monthKeySet.has(lastMonth);
    const visibleEnd = finishesInHorizon
      ? lastMonth
      : compareMonthKeys(lastMonth, horizonEnd) < 0
        ? lastMonth
        : horizonEnd;

    if (compareMonthKeys(startMonth, horizonEnd) > 0) continue;
    if (compareMonthKeys(visibleEnd, horizonStart) < 0) continue;

    const remainingPayments = loan.payments.filter(
      (payment) => payment.due_date >= asOf,
    );
    const remainingCount = remainingPayments.length;
    const isPayroll = loan.payment_source === 'PAYROLL_DEDUCTION';

    if (isPayroll) {
      for (const payment of remainingPayments) {
        const monthKey = toMonthKey(toUtcDateOnlyString(payment.due_date));
        if (!monthKeySet.has(monthKey)) continue;
        const amount = Number(payment.amount);
        payrollPaymentsByMonth.set(
          monthKey,
          (payrollPaymentsByMonth.get(monthKey) ?? 0) + amount,
        );
        payrollLineItems.push({
          month_key: monthKey,
          loan_id: loan.id,
          title: loan.name,
          subtitle: `Nómina · ${loan.lender}`,
          amount,
        });
      }
    }

    tracks.push({
      id: `loan-${loan.id}`,
      kind: 'loan',
      title: loan.name,
      subtitle: `${loan.lender} · ${remainingCount} pago${remainingCount === 1 ? '' : 's'}`,
      start_month_key: startMonth,
      end_month_key: visibleEnd,
      finishes_in_horizon: finishesInHorizon,
      monthly_amount: Number(loan.payment_amount),
      loan_id: loan.id,
    });

    if (finishesInHorizon && lastPayment.due_date >= asOf) {
      events.push({
        event_type: 'loan_payoff',
        event_date: lastDue,
        month_key: lastMonth,
        title: `Terminas de pagar ${loan.name}`,
        subtitle: isPayroll
          ? `Último descuento de nómina · ${loan.lender}`
          : `Última mensualidad con ${loan.lender}`,
        loan_id: loan.id,
        amount: Number(lastPayment.amount),
      });
    }
  }

  return { events, tracks, payrollPaymentsByMonth, payrollLineItems };
};

export const collectMsiProjectionData = async (
  ownerFilter: OwnerFilter,
  asOf: Date,
  monthKeys: string[],
): Promise<{
  paymentsByMonth: Map<string, number>;
  completionEvents: LiquidityProjectionEvent[];
  tracks: LiquidityProjectionTrack[];
}> => {
  const monthKeySet = new Set(monthKeys);
  const horizonStart = monthKeys[0] ?? toUtcDateOnlyString(asOf).slice(0, 7);
  const horizonEnd = monthKeys[monthKeys.length - 1] ?? horizonStart;
  const paymentsByMonth = new Map<string, number>();
  for (const key of monthKeys) {
    paymentsByMonth.set(key, 0);
  }

  const completionEvents: LiquidityProjectionEvent[] = [];
  const tracks: LiquidityProjectionTrack[] = [];
  const asOfStr = toUtcDateOnlyString(asOf);

  const cards = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      type: { in: ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] },
      active: true,
      cutoff_day: { not: null },
      due_day: { not: null },
    },
    select: { id: true, name: true, cutoff_day: true, due_day: true },
  });

  for (const card of cards) {
    const window = resolveCreditCardStatementWindow(
      asOf,
      card.cutoff_day!,
      card.due_day!,
    );
    const seYear = window.statementEnd.getUTCFullYear();
    const seMonth = window.statementEnd.getUTCMonth() + 1;
    const baseMonthKey = `${seYear}-${String(seMonth).padStart(2, '0')}`;

    const purchasesRaw = await prisma.expense.findMany({
      where: {
        ...ownerFilter,
        wallet_id: card.id,
        is_paid: true,
        credit_installment_current: { not: null },
        credit_installment_total: { not: null },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        credit_installment_current: true,
        credit_installment_total: true,
      },
    });
    const purchases = Array.isArray(purchasesRaw) ? purchasesRaw : [];

    for (const purchase of purchases) {
      const current = purchase.credit_installment_current;
      const total = purchase.credit_installment_total;
      if (current == null || total == null || current >= total) continue;

      const remaining = total - current;
      const lastMonthKey = monthKeyFromOffset(baseMonthKey, remaining);
      const finishesInHorizon = monthKeySet.has(lastMonthKey);
      const visibleEnd = finishesInHorizon ? lastMonthKey : horizonEnd;
      const startMonth =
        compareMonthKeys(baseMonthKey, horizonStart) < 0 ? horizonStart : baseMonthKey;

      for (let i = 0; i <= remaining; i += 1) {
        const monthKey = monthKeyFromOffset(baseMonthKey, i);
        if (!monthKeySet.has(monthKey)) continue;
        paymentsByMonth.set(
          monthKey,
          (paymentsByMonth.get(monthKey) ?? 0) + Number(purchase.amount),
        );
      }

      if (compareMonthKeys(startMonth, horizonEnd) <= 0) {
        const description = purchase.description.trim() || 'Compra a meses';
        tracks.push({
          id: `msi-${purchase.id}`,
          kind: 'msi',
          title: description,
          subtitle: `${card.name} · ${remaining + 1} mensualidad${remaining === 0 ? '' : 'es'}`,
          start_month_key: startMonth,
          end_month_key: visibleEnd,
          finishes_in_horizon: finishesInHorizon,
          monthly_amount: Number(purchase.amount),
          expense_id: purchase.id,
          wallet_id: card.id,
          wallet_name: card.name,
        });
      }

      if (!finishesInHorizon) continue;
      const eventDate = endOfMonthYmd(lastMonthKey);
      if (compareUtcDateOnly(eventDate, asOfStr) < 0) continue;

      completionEvents.push({
        event_type: 'msi_complete',
        event_date: eventDate,
        month_key: lastMonthKey,
        title: `Terminas de pagar ${purchase.description.trim() || 'compra a meses'}`,
        subtitle: `En ${card.name} · ${remaining + 1} mensualidad${remaining === 0 ? '' : 'es'} restantes`,
        expense_id: purchase.id,
        wallet_id: card.id,
        wallet_name: card.name,
        amount: Number(purchase.amount),
      });
    }
  }

  return { paymentsByMonth, completionEvents, tracks };
};

export const collectLiquidityProjectionTimeline = async (
  ownerFilter: OwnerFilter,
  asOf: Date,
  untilStr: string,
  monthKeys: string[],
): Promise<LiquidityProjectionTimeline> => {
  const asOfStr = toUtcDateOnlyString(asOf);
  const [loanTimeline, msiData] = await Promise.all([
    collectLoanTimeline(ownerFilter, asOfStr, untilStr, monthKeys),
    collectMsiProjectionData(ownerFilter, asOf, monthKeys),
  ]);

  const events = [...loanTimeline.events, ...msiData.completionEvents].sort((a, b) =>
    compareUtcDateOnly(a.event_date, b.event_date),
  );
  const tracks = [...loanTimeline.tracks, ...msiData.tracks].sort((a, b) => {
    const finishDiff = Number(b.finishes_in_horizon) - Number(a.finishes_in_horizon);
    if (finishDiff !== 0) return finishDiff;
    return compareMonthKeys(a.end_month_key, b.end_month_key);
  });

  return {
    events,
    tracks,
    installmentPaymentsByMonth: msiData.paymentsByMonth,
    payrollPaymentsByMonth: loanTimeline.payrollPaymentsByMonth,
    payrollLineItems: loanTimeline.payrollLineItems,
  };
};

/** @deprecated Prefer collectLiquidityProjectionTimeline */
export const collectLiquidityProjectionEvents = async (
  ownerFilter: OwnerFilter,
  asOf: Date,
  untilStr: string,
  monthKeys: string[],
): Promise<LiquidityProjectionEvent[]> => {
  const timeline = await collectLiquidityProjectionTimeline(
    ownerFilter,
    asOf,
    untilStr,
    monthKeys,
  );
  return timeline.events;
};

export const collectLoanPayoffEvents = async (
  ownerFilter: OwnerFilter,
  asOfStr: string,
  untilStr: string,
): Promise<LiquidityProjectionEvent[]> => {
  const monthKeys = [toMonthKey(asOfStr), toMonthKey(untilStr)];
  const timeline = await collectLoanTimeline(ownerFilter, asOfStr, untilStr, monthKeys);
  return timeline.events;
};
