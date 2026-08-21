import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { LoanPaymentStatus, LoanPaymentSource } from '@/generated/prisma/client';
import { effectiveFortnightIncome } from '@/lib/finance/monthly-chart-income';
import {
  calendarMonthKeyFromDate,
  pastDebtDateForLoanPayment,
} from '@/lib/finance/monthly-chart-debt';
import {
  groupDebtItemsByMonth,
  pastLoanDebtSubtitle,
  type MonthDebtItem,
  type MonthDebtItemInput,
} from '@/lib/finance/liquidity-month-debt-items';

export type MonthlySummaryItem = {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
  debt_items: MonthDebtItem[];
};

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const months: { year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      months.push({ year: y, month: m });
    }

    const yearMonthConditions = months.map(({ year, month }) => ({ year, month }));

    const fortnights = await prisma.fortnight.findMany({
      where: {
        ...ownerFilter,
        OR: yearMonthConditions,
      },
      select: { id: true, month: true, year: true },
    });

    const fortnightIds = fortnights.map((f) => f.id);
    const fortnightMap = new Map(fortnights.map((f) => [f.id, { month: f.month, year: f.year }]));

    const byMonth = new Map<string, { income: number; expense: number }>();
    for (const { year, month } of months) {
      byMonth.set(`${year}-${month}`, { income: 0, expense: 0 });
    }

    const firstCal = months[0];
    const lastCal = months[months.length - 1];
    const rangeFrom = new Date(Date.UTC(firstCal.year, firstCal.month - 1, 1));
    const rangeTo = new Date(Date.UTC(lastCal.year, lastCal.month, 0, 23, 59, 59, 999));

    const [incomes, cardPayments, loanPayments] = await Promise.all([
      fortnightIds.length === 0
        ? Promise.resolve([])
        : prisma.income.findMany({
            where: { AND: [{ fortnight_id: { in: fortnightIds } }, ownerFilter] },
            select: { amount: true, fortnight_id: true, source: true },
          }),
      prisma.creditCardPayment.findMany({
        where: {
          ...ownerFilter,
          paid_at: { gte: rangeFrom, lte: rangeTo },
        },
        select: {
          amount: true,
          paid_at: true,
          credit_card_wallet: { select: { id: true, name: true } },
        },
      }),
      prisma.loanPayment.findMany({
        where: {
          loan: ownerFilter,
          OR: [
            {
              status: LoanPaymentStatus.PAID,
              paid_at: { gte: rangeFrom, lte: rangeTo },
            },
            {
              status: { notIn: [LoanPaymentStatus.SKIPPED, LoanPaymentStatus.CANCELLED] },
              due_date: { gte: rangeFrom, lte: rangeTo },
              loan: { ...ownerFilter, payment_source: LoanPaymentSource.PAYROLL_DEDUCTION },
            },
          ],
        },
        select: {
          amount: true,
          paid_at: true,
          due_date: true,
          status: true,
          loan: {
            select: {
              id: true,
              name: true,
              lender: true,
              payment_source: true,
            },
          },
        },
      }),
    ]);

    const incomesByFortnight = new Map<
      number,
      Array<{ amount: number; source: string | null }>
    >();
    for (const row of incomes) {
      const id = row.fortnight_id;
      const list = incomesByFortnight.get(id) ?? [];
      list.push({ amount: Number(row.amount), source: row.source });
      incomesByFortnight.set(id, list);
    }

    for (const fnId of fortnightIds) {
      const rows = incomesByFortnight.get(fnId);
      if (!rows?.length) continue;
      const fn = fortnightMap.get(fnId);
      if (!fn) continue;
      const key = `${fn.year}-${fn.month}`;
      const entry = byMonth.get(key);
      if (entry) entry.income += effectiveFortnightIncome(rows);
    }

    const addDebt = (date: Date, amount: number) => {
      const [year, month] = calendarMonthKeyFromDate(date).split('-').map(Number);
      const entry = byMonth.get(`${year}-${month}`);
      if (entry) entry.expense += amount;
    };

    const debtItemInputs: MonthDebtItemInput[] = [];

    for (const payment of cardPayments) {
      const amount = Number(payment.amount);
      addDebt(payment.paid_at, amount);
      debtItemInputs.push({
        month_key: calendarMonthKeyFromDate(payment.paid_at),
        kind: 'card',
        group_id: String(payment.credit_card_wallet.id),
        title: payment.credit_card_wallet.name,
        subtitle: 'Pago de tarjeta',
        amount,
      });
    }

    for (const payment of loanPayments) {
      const when = pastDebtDateForLoanPayment({
        status: payment.status,
        paid_at: payment.paid_at,
        due_date: payment.due_date,
        payment_source: payment.loan.payment_source,
      });
      if (!when) continue;
      const amount = Number(payment.amount);
      addDebt(when, amount);
      debtItemInputs.push({
        month_key: calendarMonthKeyFromDate(when),
        kind: 'loan',
        group_id: String(payment.loan.id),
        title: payment.loan.name,
        subtitle: pastLoanDebtSubtitle(payment.loan.payment_source, payment.loan.lender),
        amount,
      });
    }

    const debtItemsByMonth = groupDebtItemsByMonth(debtItemInputs);

    const result: MonthlySummaryItem[] = months.map(({ year, month }) => {
      const entry = byMonth.get(`${year}-${month}`) ?? { income: 0, expense: 0 };
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      return {
        year,
        month,
        label: MONTH_LABELS[month - 1],
        income: Math.round(entry.income * 100) / 100,
        expense: Math.round(entry.expense * 100) / 100,
        debt_items: debtItemsByMonth.get(monthKey) ?? [],
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly summary' },
      { status: 500 },
    );
  }
}
