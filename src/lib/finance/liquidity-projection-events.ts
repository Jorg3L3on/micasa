import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import { resolveCreditCardStatementWindow } from '@/lib/finance/credit-card-statement.service';
import {
  compareUtcDateOnly,
  toUtcDateOnlyString,
} from '@/lib/finance/liquidity-projection';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

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

const toMonthKey = (ymd: string) => ymd.slice(0, 7);

const monthKeyFromOffset = (baseMonthKey: string, offsetMonths: number): string => {
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

export const collectLoanPayoffEvents = async (
  ownerFilter: OwnerFilter,
  asOfStr: string,
  untilStr: string,
): Promise<LiquidityProjectionEvent[]> => {
  const asOf = parseCalendarDate(asOfStr);
  const until = parseCalendarDate(untilStr);
  const loans = await prisma.loan.findMany({
    where: {
      ...ownerFilter,
      status: 'ACTIVE',
      payment_source: 'WALLET',
    },
    select: {
      id: true,
      name: true,
      lender: true,
      payments: {
        where: { status: 'SCHEDULED' },
        orderBy: { due_date: 'desc' },
        take: 1,
        select: { due_date: true, amount: true },
      },
    },
  });

  const events: LiquidityProjectionEvent[] = [];
  for (const loan of loans) {
    const lastPayment = loan.payments[0];
    if (!lastPayment) continue;
    const dueStr = toUtcDateOnlyString(lastPayment.due_date);
    if (compareUtcDateOnly(dueStr, asOfStr) < 0) continue;
    if (compareUtcDateOnly(dueStr, untilStr) > 0) continue;
    if (lastPayment.due_date < asOf || lastPayment.due_date > until) continue;

    events.push({
      event_type: 'loan_payoff',
      event_date: dueStr,
      month_key: toMonthKey(dueStr),
      title: `Terminas de pagar ${loan.name}`,
      subtitle: `Última mensualidad con ${loan.lender}`,
      loan_id: loan.id,
      amount: Number(lastPayment.amount),
    });
  }

  return events;
};

export const collectMsiProjectionData = async (
  ownerFilter: OwnerFilter,
  asOf: Date,
  monthKeys: string[],
): Promise<{
  paymentsByMonth: Map<string, number>;
  completionEvents: LiquidityProjectionEvent[];
}> => {
  const monthKeySet = new Set(monthKeys);
  const paymentsByMonth = new Map<string, number>();
  for (const key of monthKeys) {
    paymentsByMonth.set(key, 0);
  }

  const completionEvents: LiquidityProjectionEvent[] = [];
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
      const current = purchase.credit_installment_current!;
      const total = purchase.credit_installment_total!;
      if (current >= total) continue;

      const remaining = total - current;
      for (let i = 0; i <= remaining; i += 1) {
        const monthKey = monthKeyFromOffset(baseMonthKey, i);
        if (!monthKeySet.has(monthKey)) continue;
        paymentsByMonth.set(
          monthKey,
          (paymentsByMonth.get(monthKey) ?? 0) + Number(purchase.amount),
        );
      }

      const lastMonthKey = monthKeyFromOffset(baseMonthKey, remaining);
      if (!monthKeySet.has(lastMonthKey)) continue;
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

  return { paymentsByMonth, completionEvents };
};

export const collectLiquidityProjectionEvents = async (
  ownerFilter: OwnerFilter,
  asOf: Date,
  untilStr: string,
  monthKeys: string[],
): Promise<LiquidityProjectionEvent[]> => {
  const asOfStr = toUtcDateOnlyString(asOf);
  const [loanEvents, msiData] = await Promise.all([
    collectLoanPayoffEvents(ownerFilter, asOfStr, untilStr),
    collectMsiProjectionData(ownerFilter, asOf, monthKeys),
  ]);

  return [...loanEvents, ...msiData.completionEvents].sort((a, b) =>
    compareUtcDateOnly(a.event_date, b.event_date),
  );
};
