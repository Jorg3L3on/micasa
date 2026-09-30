import {
  endOfCalendarDay,
  formatCalendarDate,
  startOfCalendarDay,
} from '@/lib/calendar-dates';
import { resolveTemplateDueDay } from '@/lib/finance/expense-template-due';
import {
  whereExcludeCreditInstallments,
  wherePlanningCashFlowExpenses,
} from '@/lib/finance/expense-planning-scope';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';
import {
  dueYmdInFortnight,
  getDaysInCalendarMonth,
  getFortnightYmdBounds,
} from '@/lib/fortnight-calendar';
import { listUpcomingCommitmentsForMonth } from '@/lib/mcp/upcoming-commitments.service';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { FortnightPeriod, PaymentMethodType } from '@/generated/prisma/client';
import type {
  PaymentsCalendarItem,
  PaymentsCalendarItemType,
  PaymentsCalendarResult,
} from '@/types/payments-calendar';

const TYPE_LABEL: Record<PaymentsCalendarItemType, string> = {
  revolving: 'Tarjeta',
  msi: 'Cuota',
  loan: 'Préstamo',
  expense: 'Gasto',
  template: 'Plantilla',
};

const FUNDING_WALLET_TYPES: PaymentMethodType[] = [
  PaymentMethodType.CASH,
  PaymentMethodType.DEBIT_CARD,
];

const monthRangeYmd = (
  year: number,
  month: number,
): { startYmd: string; endYmd: string; monthPrefix: string } => {
  const mm = String(month).padStart(2, '0');
  const lastDay = getDaysInCalendarMonth(year, month);
  return {
    startYmd: `${year}-${mm}-01`,
    endYmd: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    monthPrefix: `${year}-${mm}`,
  };
};

const dateInViewedMonth = (ymd: string, monthPrefix: string): boolean =>
  ymd.startsWith(monthPrefix);

const listUnpaidExpensesWithPaymentDate = async (
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<PaymentsCalendarItem[]> => {
  const { startYmd, endYmd } = monthRangeYmd(year, month);
  const rows = await prisma.expense.findMany({
    where: {
      ...ownerFilter,
      is_paid: false,
      payment_date: {
        gte: startOfCalendarDay(startYmd),
        lte: endOfCalendarDay(endYmd),
      },
      loan_payment_id: null,
      AND: [whereExcludeCreditInstallments()],
    },
    select: {
      id: true,
      description: true,
      amount: true,
      payment_date: true,
    },
    orderBy: [{ payment_date: 'asc' }, { id: 'asc' }],
  });

  const items: PaymentsCalendarItem[] = [];
  for (const row of rows) {
    if (!row.payment_date) continue;
    items.push({
      date: formatCalendarDate(row.payment_date),
      type: 'expense',
      name: row.description,
      amount: Number(row.amount),
      sourceId: row.id,
      typeLabel: TYPE_LABEL.expense,
    });
  }
  return items;
};

/**
 * Unpaid cash-flow expenses without payment_date but with due_day, placed on
 * the civil day of their fortnight (same rule as card/loan due days).
 */
const listScheduledExpensesByDueDay = async (
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<PaymentsCalendarItem[]> => {
  const { monthPrefix } = monthRangeYmd(year, month);

  const fortnights = await prisma.fortnight.findMany({
    where: { ...ownerFilter, year, month },
    select: { id: true, period: true },
  });
  if (fortnights.length === 0) return [];

  const fortnightById = new Map(
    fortnights.map((fn) => [fn.id, fn.period as 'FIRST' | 'SECOND']),
  );

  const rows = await prisma.expense.findMany({
    where: {
      ...ownerFilter,
      is_paid: false,
      payment_date: null,
      due_day: { not: null },
      loan_payment_id: null,
      fortnight_id: { in: fortnights.map((fn) => fn.id) },
      AND: [wherePlanningCashFlowExpenses()],
    },
    select: {
      id: true,
      description: true,
      amount: true,
      due_day: true,
      fortnight_id: true,
    },
    orderBy: [{ id: 'asc' }],
  });

  const items: PaymentsCalendarItem[] = [];
  for (const row of rows) {
    if (row.due_day == null) continue;
    const period = fortnightById.get(row.fortnight_id);
    if (!period) continue;
    const ymd = dueYmdInFortnight(row.due_day, year, month, period);
    if (!ymd || !dateInViewedMonth(ymd, monthPrefix)) continue;
    items.push({
      date: ymd,
      type: 'expense',
      name: row.description,
      amount: Number(row.amount),
      sourceId: row.id,
      typeLabel: TYPE_LABEL.expense,
    });
  }
  return items;
};

/**
 * Active expense templates not yet instantiated in a fortnight that overlaps
 * the viewed civil month — liquidity-style, dated by due_day when set.
 */
const listScheduledTemplateObligationsForMonth = async (
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<PaymentsCalendarItem[]> => {
  const { startYmd, endYmd, monthPrefix } = monthRangeYmd(year, month);

  const fortnights = await prisma.fortnight.findMany({
    where: {
      ...ownerFilter,
      end_date: { gte: startOfCalendarDay(startYmd) },
      start_date: { lte: endOfCalendarDay(endYmd) },
    },
    select: {
      id: true,
      year: true,
      month: true,
      period: true,
      end_date: true,
    },
  });
  if (fortnights.length === 0) return [];

  const fortnightIds = fortnights.map((fn) => fn.id);
  const existingTemplateExpenses = await prisma.expense.findMany({
    where: {
      fortnight_id: { in: fortnightIds },
      expense_template_id: { not: null },
    },
    select: { fortnight_id: true, expense_template_id: true },
  });
  const existingKey = new Set(
    existingTemplateExpenses.map(
      (e) => `${e.fortnight_id}-${e.expense_template_id}`,
    ),
  );

  const fundingWallets = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      active: true,
      type: { in: FUNDING_WALLET_TYPES },
    },
    select: { id: true, type: true },
  });
  const fundingWalletIds = fundingWallets
    .filter((w) => isFundingWalletType(w.type))
    .map((w) => w.id);
  if (fundingWalletIds.length === 0) return [];

  const items: PaymentsCalendarItem[] = [];

  for (const fn of fortnights) {
    const period = fn.period as 'FIRST' | 'SECOND';
    const appliesField =
      period === FortnightPeriod.FIRST
        ? ('applies_first_fortnight' as const)
        : ('applies_second_fortnight' as const);

    const templates = await prisma.expenseTemplate.findMany({
      where: {
        ...ownerFilter,
        active: true,
        [appliesField]: true,
        category_id: { not: null },
        OR: [
          { wallet_id: { in: fundingWalletIds } },
          { wallet_id: null },
        ],
      },
      select: {
        id: true,
        name: true,
        suggested_amount: true,
        wallet_id: true,
        due_day: true,
        due_day_first_fortnight: true,
        due_day_second_fortnight: true,
      },
    });

    const fallbackEnd = getFortnightYmdBounds(fn.year, fn.month, period).endYmd;

    for (const template of templates) {
      if (existingKey.has(`${fn.id}-${template.id}`)) continue;
      if (
        template.wallet_id != null &&
        !fundingWalletIds.includes(template.wallet_id)
      ) {
        continue;
      }

      const dueDay = resolveTemplateDueDay(period, template);
      const ymd =
        dueDay != null
          ? dueYmdInFortnight(dueDay, fn.year, fn.month, period)
          : fallbackEnd;
      if (!ymd || !dateInViewedMonth(ymd, monthPrefix)) continue;

      const amount =
        template.suggested_amount != null && Number(template.suggested_amount) > 0
          ? Number(template.suggested_amount)
          : null;

      items.push({
        date: ymd,
        type: 'template',
        name: template.name,
        amount,
        sourceId: template.id,
        typeLabel: TYPE_LABEL.template,
      });
    }
  }

  return items;
};

/**
 * Pending payments for the Panel financiero calendar: card revolving, MSI,
 * scheduled loans, unpaid expenses with a date, and not-yet-instantiated
 * expense templates (liquidity-style scheduled commitments).
 */
export async function listPaymentsCalendarForMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<PaymentsCalendarResult> {
  const [commitments, datedExpenses, dueDayExpenses, templates] =
    await Promise.all([
      listUpcomingCommitmentsForMonth(ownerFilter, year, month),
      listUnpaidExpensesWithPaymentDate(ownerFilter, year, month),
      listScheduledExpensesByDueDay(ownerFilter, year, month),
      listScheduledTemplateObligationsForMonth(ownerFilter, year, month),
    ]);

  const items: PaymentsCalendarItem[] = [
    ...commitments.items.map((item) => ({
      date: item.date,
      type: item.type as PaymentsCalendarItemType,
      name: item.name,
      amount: item.amount,
      sourceId: item.source_id,
      typeLabel: TYPE_LABEL[item.type],
    })),
    ...datedExpenses,
    ...dueDayExpenses,
    ...templates,
  ];

  items.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.name.localeCompare(b.name, 'es');
  });

  return { year, month, items };
}
