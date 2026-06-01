import { parseCalendarDate } from '@/lib/calendar-dates';
import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { PaymentMethodType } from '@/generated/prisma/client';
import { wherePlanningCashFlowExpenses } from '@/lib/finance/expense-planning-scope';
import {
  aggregateOrphanCreditCardPaymentsForPlanning,
  unionPaidAtRangeFromFortnights,
} from '@/lib/finance/planning-credit-card-payments';
import { sumPlannerCardDueForDashboardScope } from '@/lib/finance/credit-card-statement.service';
import { mergePlanningCardTotalsIntoExpenseSummary } from '@/lib/finance/planning-period-card-totals';
import { getEffectiveCreditLimit } from '@/lib/finance/wallet-accounting';
import { aggregateLoanPaymentsForFortnights } from '@/lib/finance/loan.service';

type PeriodView = 'month' | 'biweekly';
type DashboardAlertTarget = {
  path: string;
  query?: Record<string, string | number>;
};

type DashboardAlert = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  target: DashboardAlertTarget;
  fingerprint: string;
};

type DashboardUpcomingObligation = {
  id: number;
  source: 'expense' | 'loan_payment';
  description: string;
  amount: number;
  is_paid: boolean;
  dueDate: string;
  dueDay: number;
  category: string;
  categoryIcon: string | null;
  loanName?: string;
  lender?: string;
  paymentSource?: 'WALLET' | 'PAYROLL_DEDUCTION';
  sourceWalletId?: number | null;
};

const MIN_ALERTABLE_AMOUNT = 0.005;

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const period: 'FIRST' | 'SECOND' = day <= 15 ? 'FIRST' : 'SECOND';
  return { year, month, period };
}

function getPreviousPeriod(
  view: PeriodView,
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
) {
  if (view === 'month') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return { year: prevYear, month: prevMonth, period };
  }
  if (period === 'FIRST') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return { year: prevYear, month: prevMonth, period: 'SECOND' as const };
  }
  return { year, month, period: 'FIRST' as const };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') as PeriodView) || 'biweekly';
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const periodParam = searchParams.get('period') as 'FIRST' | 'SECOND' | null;

    const current =
      monthParam && yearParam
        ? {
            year: parseInt(yearParam, 10),
            month: parseInt(monthParam, 10),
            period: periodParam || (view === 'biweekly' ? 'FIRST' : 'FIRST'),
          }
        : getCurrentPeriod();

    const prev = getPreviousPeriod(
      view,
      current.year,
      current.month,
      current.period,
    );

    const fortnightWhereCurrent =
      view === 'month'
        ? { ...ownerFilter, month: current.month, year: current.year }
        : { ...ownerFilter, month: current.month, year: current.year, period: current.period };
    const fortnightWherePrev =
      view === 'month'
        ? { ...ownerFilter, month: prev.month, year: prev.year }
        : { ...ownerFilter, month: prev.month, year: prev.year, period: prev.period };

    const [fortnightsCurrent, fortnightsPrev] = await Promise.all([
      prisma.fortnight.findMany({
        where: fortnightWhereCurrent,
        select: {
          id: true,
          start_date: true,
          end_date: true,
          month: true,
          year: true,
          period: true,
        },
      }),
      prisma.fortnight.findMany({
        where: fortnightWherePrev,
        select: { id: true, start_date: true, end_date: true },
      }),
    ]);

    const currentFortnightIds = fortnightsCurrent.map((f) => f.id);
    const prevFortnightIds = fortnightsPrev.map((f) => f.id);

    const expenseWhereCurrent =
      currentFortnightIds.length > 0
        ? {
            AND: [
              { fortnight_id: { in: currentFortnightIds } },
              ownerFilter,
              wherePlanningCashFlowExpenses(),
            ],
          }
        : { fortnight_id: { in: [] as number[] } };
    const expenseWherePrev =
      prevFortnightIds.length > 0
        ? {
            AND: [
              { fortnight_id: { in: prevFortnightIds } },
              ownerFilter,
              wherePlanningCashFlowExpenses(),
            ],
          }
        : { fortnight_id: { in: [] as number[] } };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paidAtRangeCurrent = unionPaidAtRangeFromFortnights(fortnightsCurrent);
    const paidAtRangePrev = unionPaidAtRangeFromFortnights(fortnightsPrev);

    const [
      expensesCurrent,
      incomeCurrent,
      expensesPrev,
      incomePrev,
      allExpensesUpcoming,
      incomeWithUser,
      orphanPayCurrent,
      orphanPayPrev,
      cardDueCurrent,
      cardDuePrev,
      dashboardWalletSnapshot,
      loanPayCurrent,
      loanPayPrev,
    ] = await Promise.all([
      prisma.expense.findMany({
        where: expenseWhereCurrent,
        include: {
          category: { select: { name: true, icon: true } },
          expense_template: { select: { is_recurring: true } },
        },
      }),
      prisma.income.findMany({
        where: {
          ...ownerFilter,
          fortnight_id: { in: currentFortnightIds },
        },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.expense.findMany({
        where: expenseWherePrev,
        select: { amount: true, is_paid: true },
      }),
      prisma.income.findMany({
        where: {
          ...ownerFilter,
          fortnight_id: { in: prevFortnightIds },
        },
        select: { amount: true },
      }),
      prisma.expense.findMany({
        where: expenseWhereCurrent,
        include: {
          fortnight: {
            select: {
              start_date: true,
              end_date: true,
              month: true,
              year: true,
            },
          },
          category: { select: { name: true, icon: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.income.findMany({
        where: {
          ...ownerFilter,
          fortnight_id: { in: currentFortnightIds },
        },
        include: { user: { select: { id: true, name: true } } },
      }),
      aggregateOrphanCreditCardPaymentsForPlanning(
        ownerFilter,
        paidAtRangeCurrent,
      ),
      aggregateOrphanCreditCardPaymentsForPlanning(
        ownerFilter,
        paidAtRangePrev,
      ),
      sumPlannerCardDueForDashboardScope(
        ownerFilter,
        view,
        current.year,
        current.month,
        current.period,
      ),
      sumPlannerCardDueForDashboardScope(
        ownerFilter,
        view,
        prev.year,
        prev.month,
        prev.period,
      ),
      prisma.wallet.findMany({
        where: {
          ...ownerFilter,
          active: true,
          type: {
            in: [
              PaymentMethodType.CASH,
              PaymentMethodType.DEBIT_CARD,
              PaymentMethodType.CREDIT_CARD,
              PaymentMethodType.DEPARTMENT_STORE_CARD,
            ],
          },
        },
        select: {
          amount: true,
          credit_limit: true,
          temporary_credit_limit: true,
          type: true,
        },
      }),
      aggregateLoanPaymentsForFortnights(ownerFilter, fortnightsCurrent),
      aggregateLoanPaymentsForFortnights(ownerFilter, fortnightsPrev),
    ]);

    const overrideIncome = incomeCurrent.find(
      (i) => i.source === '__OVERRIDE__',
    );
    const regularIncome = incomeCurrent.filter(
      (i) => i.source !== '__OVERRIDE__',
    );
    const totalIncomeCurrent = overrideIncome
      ? Number(overrideIncome.amount)
      : regularIncome.reduce((s, i) => s + Number(i.amount), 0);
    const baseExpenseCurrent = expensesCurrent.reduce(
      (s, e) => s + Number(e.amount),
      0,
    );
    const basePaidCurrent = expensesCurrent
      .filter((e) => e.is_paid)
      .reduce((s, e) => s + Number(e.amount), 0);
    const planningCurrent = mergePlanningCardTotalsIntoExpenseSummary(
      {
        totalExpense: baseExpenseCurrent,
        totalPaid: basePaidCurrent,
        totalUnpaid: baseExpenseCurrent - basePaidCurrent,
      },
      orphanPayCurrent.count > 0 ? orphanPayCurrent : null,
      cardDueCurrent.total > 0 ? cardDueCurrent : null,
    );
    let totalExpenseCurrent = planningCurrent.totalExpense;
    let totalPaidCurrent = planningCurrent.totalPaid;
    if (loanPayCurrent.total > 0) {
      totalExpenseCurrent += loanPayCurrent.total;
    }
    if (loanPayCurrent.paidTotal > 0) {
      totalPaidCurrent += loanPayCurrent.paidTotal;
    }
    const totalUnpaidCurrent = totalExpenseCurrent - totalPaidCurrent;
    const balanceCurrent = totalIncomeCurrent - totalExpenseCurrent;

    let fundingWalletBalanceTotal = 0;
    let creditWalletDebtTotal = 0;
    let creditWalletAvailableTotal = 0;
    for (const w of dashboardWalletSnapshot) {
      const amt = Number(w.amount);
      if (
        w.type === PaymentMethodType.CASH ||
        w.type === PaymentMethodType.DEBIT_CARD
      ) {
        fundingWalletBalanceTotal += amt;
      }
      if (
        w.type === PaymentMethodType.CREDIT_CARD ||
        w.type === PaymentMethodType.DEPARTMENT_STORE_CARD
      ) {
        creditWalletDebtTotal += amt;
        const cap = getEffectiveCreditLimit({
          credit_limit: w.credit_limit,
          temporary_credit_limit: w.temporary_credit_limit,
        });
        if (cap != null) {
          creditWalletAvailableTotal += cap - amt;
        }
      }
    }
    const fundingNetVsPendingExpense =
      fundingWalletBalanceTotal - totalUnpaidCurrent;

    const totalIncomePrev = incomePrev.reduce(
      (s, i) => s + Number(i.amount),
      0,
    );
    const baseExpensePrev = expensesPrev.reduce(
      (s, e) => s + Number(e.amount),
      0,
    );
    const planningPrev = mergePlanningCardTotalsIntoExpenseSummary(
      {
        totalExpense: baseExpensePrev,
        totalPaid: 0,
        totalUnpaid: baseExpensePrev,
      },
      orphanPayPrev.count > 0 ? orphanPayPrev : null,
      cardDuePrev.total > 0 ? cardDuePrev : null,
    );
    let totalExpensePrev = planningPrev.totalExpense;
    if (loanPayPrev.total > 0) {
      totalExpensePrev += loanPayPrev.total;
    }

    const userIncomeMap: Record<number, { name: string; amount: number }> = {};
    incomeWithUser.forEach((inc) => {
      const uid = inc.user?.id;
      if (uid) {
        if (!userIncomeMap[uid]) {
          userIncomeMap[uid] = { name: inc.user?.name ?? 'Usuario', amount: 0 };
        }
        userIncomeMap[uid].amount += Number(inc.amount);
      }
    });
    const incomeBreakdown = Object.entries(userIncomeMap).map(
      ([userId, data]) => ({
        userId: parseInt(userId, 10),
        userName: data.name,
        amount: data.amount,
        percentage:
          totalIncomeCurrent > 0 ? (data.amount / totalIncomeCurrent) * 100 : 0,
      }),
    );

    const upcomingWithDue = allExpensesUpcoming
      .map((e) => {
        const fort = e.fortnight;
        const dueDay = (e as { due_day?: number | null }).due_day ?? null;
        if (!dueDay || !fort) return null;
        const dueYmd = `${fort.year}-${String(fort.month).padStart(2, '0')}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`;
        return {
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          is_paid: e.is_paid,
          dueDate: dueYmd,
          dueDay,
          category: e.category?.name ?? '',
          categoryIcon: e.category?.icon ?? null,
        };
      })
      .filter(Boolean) as Array<{
      id: number;
      description: string;
      amount: number;
      is_paid: boolean;
      dueDate: string;
      dueDay: number;
      category: string;
      categoryIcon: string | null;
    }>;

    upcomingWithDue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const expenseObligations: DashboardUpcomingObligation[] = upcomingWithDue
      .filter((o) => !o.is_paid)
      .map((o) => ({ ...o, source: 'expense' as const }));
    const loanObligations: DashboardUpcomingObligation[] =
      loanPayCurrent.upcoming.map((payment) => ({
        id: payment.id,
        source: 'loan_payment' as const,
        description: `Pago préstamo: ${payment.loanName}`,
        amount: payment.amount,
        is_paid: false,
        dueDate: payment.dueDate,
        dueDay: Number(payment.dueDate.slice(8, 10)),
        category: payment.lender,
        categoryIcon: 'LANDMARK',
        loanName: payment.loanName,
        lender: payment.lender,
        paymentSource: payment.paymentSource,
        sourceWalletId: payment.sourceWalletId,
      }));
    const upcomingObligations = [...expenseObligations, ...loanObligations]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);

    const recentExpenses = await prisma.expense.findMany({
      where: ownerFilter,
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        category: { select: { name: true, icon: true } },
        fortnight: { select: { label: true, month: true, year: true } },
      },
    });
    const recentIncomes = await prisma.income.findMany({
      where: { ...ownerFilter, source: { not: '__OVERRIDE__' } },
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { name: true } },
        fortnight: { select: { label: true } },
      },
    });
    const recentLoanPayments = await prisma.loanPayment.findMany({
      where: {
        status: 'PAID',
        paid_at: { not: null },
        loan: ownerFilter,
      },
      take: 10,
      orderBy: { updated_at: 'desc' },
      include: {
        loan: { select: { name: true, lender: true } },
      },
    });
    const recentActivity = [
      ...recentExpenses.map((e) => ({
        id: `exp-${e.id}`,
        type: 'expense_added' as const,
        description: e.description,
        amount: Number(e.amount),
        timestamp: e.created_at.toISOString(),
        user: null as string | null,
        meta: e.fortnight?.label ?? '',
      })),
      ...recentIncomes.map((i) => ({
        id: `inc-${i.id}`,
        type: 'income_added' as const,
        description: i.source ?? 'Ingreso',
        amount: Number(i.amount),
        timestamp: i.created_at.toISOString(),
        user: i.user?.name ?? null,
        meta: i.fortnight?.label ?? '',
      })),
      ...recentLoanPayments.map((payment) => ({
        id: `loan-${payment.id}`,
        type: 'loan_payment_paid' as const,
        description: payment.loan.name,
        amount: Number(payment.amount),
        timestamp: (payment.paid_at ?? payment.updated_at).toISOString(),
        user: null as string | null,
        meta: payment.loan.lender,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 15);

    const fixedExpenses = expensesCurrent.filter(
      (e) => e.expense_template?.is_recurring === true,
    );
    const variableExpenses = expensesCurrent.filter(
      (e) => !e.expense_template || e.expense_template.is_recurring === false,
    );
    const totalFixed = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalVariable = variableExpenses.reduce(
      (s, e) => s + Number(e.amount),
      0,
    );

    const overdueInCurrent = upcomingWithDue.filter((o) => {
      if (o.is_paid) return false;
      if (o.amount <= MIN_ALERTABLE_AMOUNT) return false;
      const d = new Date(o.dueDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    });
    const overdueLoanPayments = loanPayCurrent.upcoming.filter((payment) => {
      if (payment.amount <= MIN_ALERTABLE_AMOUNT) return false;
      const d = parseCalendarDate(payment.dueDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    });
    const totalOverdueAmount = overdueInCurrent.reduce(
      (s, o) => s + o.amount,
      0,
    ) + overdueLoanPayments.reduce((s, payment) => s + payment.amount, 0);
    const percentCommitted =
      totalIncomeCurrent > 0
        ? (totalExpenseCurrent / totalIncomeCurrent) * 100
        : 0;
    const largestExpense =
      expensesCurrent.length > 0
        ? expensesCurrent.reduce((max, e) =>
            Number(e.amount) > Number(max.amount) ? e : max,
          )
        : null;
    const categoryTotals = expensesCurrent.reduce(
      (acc: Record<string, { total: number; icon: string | null }>, expense) => {
        const categoryName = expense.category?.name ?? 'Sin categoría';
        if (!acc[categoryName]) {
          acc[categoryName] = {
            total: 0,
            icon: expense.category?.icon ?? null,
          };
        }
        acc[categoryName].total += Number(expense.amount);
        return acc;
      },
      {},
    );
    const periodCategoryBreakdown = Object.entries(categoryTotals).map(
      ([category, data]) => ({
        category,
        categoryIcon: data.icon,
        total: data.total,
      }),
    );

    const alertScope = `${current.year}-${current.month}-${view === 'biweekly' ? current.period : 'MONTH'}`;
    const alerts: DashboardAlert[] = [];
    if (
      (overdueInCurrent.length > 0 || overdueLoanPayments.length > 0) &&
      totalOverdueAmount > MIN_ALERTABLE_AMOUNT
    ) {
      const alertId = `overdue:${alertScope}`;
      alerts.push({
        id: alertId,
        type: 'overdue',
        title: 'Obligaciones vencidas',
        description: `${
          overdueInCurrent.length + overdueLoanPayments.length
        } obligacion(es) vencida(s) por ${new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }).format(totalOverdueAmount)}`,
        severity: 'error',
        target: {
          path: `/monthly/${current.year}/${current.month}`,
          query: view === 'biweekly' ? { period: current.period } : undefined,
        },
        fingerprint: alertId,
      });
    }
    if (percentCommitted >= 80 && totalIncomeCurrent > 0) {
      const alertId = `high_commitment:${alertScope}`;
      alerts.push({
        id: alertId,
        type: 'high_commitment',
        title: 'Compromiso alto',
        description: `El ${Math.round(
          percentCommitted,
        )}% de tus ingresos está comprometido en gastos.`,
        severity: 'warning',
        target: { path: '/wallets/liquidity' },
        fingerprint: alertId,
      });
    }
    if (totalIncomeCurrent === 0 && currentFortnightIds.length > 0) {
      const alertId = `missing_income:${alertScope}`;
      alerts.push({
        id: alertId,
        type: 'missing_income',
        title: 'Ingresos no registrados',
        description: 'No hay ingresos registrados para este periodo.',
        severity: 'info',
        target: {
          path: '/transactions',
          query: {
            type: 'income',
            year: current.year,
            month: current.month,
            period: current.period,
          },
        },
        fingerprint: alertId,
      });
    }

    return NextResponse.json(
      {
        period: {
          view,
          year: current.year,
          month: current.month,
          period: current.period,
        },
        summary: {
          totalIncome: totalIncomeCurrent,
          totalExpense: totalExpenseCurrent,
          balance: balanceCurrent,
          totalPaid: totalPaidCurrent,
          totalUnpaid: totalUnpaidCurrent,
        },
        availableVsCommitted: {
          libre: balanceCurrent,
          pagado: totalPaidCurrent,
          pendiente: totalUnpaidCurrent,
        },
        periodCategoryBreakdown,
        fundingWalletBalanceTotal,
        fundingNetVsPendingExpense,
        creditWalletDebtTotal,
        creditWalletAvailableTotal,
        planningCardPayments:
          orphanPayCurrent.count > 0
            ? {
                total: orphanPayCurrent.total,
                count: orphanPayCurrent.count,
              }
            : null,
        planningCardStatementDue:
          cardDueCurrent.total > 0
            ? {
                total: cardDueCurrent.total,
                cardCount: cardDueCurrent.cardCount,
              }
            : null,
        planningLoanPayments:
          loanPayCurrent.total > 0 || loanPayCurrent.pendingCount > 0
            ? {
                total: loanPayCurrent.total,
                paidTotal: loanPayCurrent.paidTotal,
                pendingTotal: loanPayCurrent.pendingTotal,
                count: loanPayCurrent.count,
                pendingCount: loanPayCurrent.pendingCount,
              }
            : null,
        upcomingObligations,
        recentActivity,
        incomeBreakdown: {
          byPerson: incomeBreakdown,
          totalIncome: totalIncomeCurrent,
        },
        expenseHealth: {
          totalOverdueAmount,
          percentCommitted,
          largestExpense: largestExpense
            ? {
                description: largestExpense.description,
                amount: Number(largestExpense.amount),
                category: largestExpense.category?.name ?? '',
                categoryIcon: largestExpense.category?.icon ?? null,
              }
            : null,
        },
        fixedVsVariable: {
          totalFixed,
          totalVariable,
          ratio:
            totalVariable > 0
              ? (totalFixed / totalVariable).toFixed(1)
              : totalFixed > 0
              ? '∞'
              : '0',
        },
        periodComparison: {
          currentIncome: totalIncomeCurrent,
          currentExpense: totalExpenseCurrent,
          previousIncome: totalIncomePrev,
          previousExpense: totalExpensePrev,
          incomeDiff: totalIncomeCurrent - totalIncomePrev,
          expenseDiff: totalExpenseCurrent - totalExpensePrev,
        },
        alerts,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 },
    );
  }
}
