import { parseCalendarDate, todayCalendarDate } from '@/lib/calendar-dates';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { PaymentMethodType } from '@/generated/prisma/client';
import { wherePlanningCashFlowExpenses } from '@/lib/finance/expense-planning-scope';
import {
  aggregateOrphanCreditCardPaymentsForPlanning,
  unionPaidAtRangeFromFortnights,
} from '@/lib/finance/planning-credit-card-payments';
import { sumPlannerCardDueForDashboardScope } from '@/lib/finance/credit-card-statement.service';
import { mergePlanningCardTotalsIntoExpenseSummary } from '@/lib/finance/planning-period-card-totals';
import { formatLoanPaymentLabel } from '@/lib/finance/planning-loan-payments';
import { partitionLoanPaymentsForPlanningTotals } from '@/lib/finance/planning-period-loan-totals';
import { getEffectiveCreditLimit } from '@/lib/finance/wallet-accounting';
import { aggregateLoanPaymentsForFortnights } from '@/lib/finance/loan.service';
import { getMonthlyBudgetPanel } from '@/lib/finance/monthly-budget-panel.service';
import { measure } from './dashboard.performance';
import { buildDashboardBudgetSummary } from './dashboard-budget-summary';
import * as dashboardQueries from './dashboard.queries';
import type {
  DashboardAlert,
  DashboardResponseDto,
  DashboardUpcomingObligation,
  GetDashboardDataParams,
  PeriodView,
  ResolvedDashboardPeriod,
} from './dashboard.types';

const MIN_ALERTABLE_AMOUNT = 0.005;

const getCurrentPeriod = (): ResolvedDashboardPeriod => {
  const [year, month, day] = todayCalendarDate().split('-').map(Number);
  const period: 'FIRST' | 'SECOND' = day <= 15 ? 'FIRST' : 'SECOND';
  return { year, month, period };
};

const getPreviousPeriod = (
  view: PeriodView,
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): ResolvedDashboardPeriod => {
  if (view === 'month') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return { year: prevYear, month: prevMonth, period };
  }
  if (period === 'FIRST') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return { year: prevYear, month: prevMonth, period: 'SECOND' };
  }
  return { year, month, period: 'FIRST' };
};

const resolvePeriods = (params: GetDashboardDataParams) => {
  const view = params.view ?? 'biweekly';
  const current =
    params.month && params.year
      ? {
          year: parseInt(params.year, 10),
          month: parseInt(params.month, 10),
          period:
            params.period ?? (view === 'biweekly' ? 'FIRST' : 'FIRST'),
        }
      : getCurrentPeriod();
  const prev = getPreviousPeriod(
    view,
    current.year,
    current.month,
    current.period,
  );
  return { view, current, prev };
};

const buildFortnightWheres = (
  ownerFilter: OwnerFilter,
  view: PeriodView,
  current: ResolvedDashboardPeriod,
  prev: ResolvedDashboardPeriod,
) => {
  const fortnightWhereCurrent =
    view === 'month'
      ? { ...ownerFilter, month: current.month, year: current.year }
      : {
          ...ownerFilter,
          month: current.month,
          year: current.year,
          period: current.period,
        };
  const fortnightWherePrev =
    view === 'month'
      ? { ...ownerFilter, month: prev.month, year: prev.year }
      : {
          ...ownerFilter,
          month: prev.month,
          year: prev.year,
          period: prev.period,
        };
  return { fortnightWhereCurrent, fortnightWherePrev };
};

export const getDashboardData = async (
  params: GetDashboardDataParams,
): Promise<DashboardResponseDto> =>
  measure('dashboard.total', async () => {
    const { ownerFilter } = params;
    const { view, current, prev } = resolvePeriods(params);
    const { fortnightWhereCurrent, fortnightWherePrev } = buildFortnightWheres(
      ownerFilter,
      view,
      current,
      prev,
    );

    const totalsPayload = await measure('dashboard.totals', async () => {
      const [fortnightsCurrent, fortnightsPrev] = await Promise.all([
        dashboardQueries.fetchFortnightsCurrent(fortnightWhereCurrent),
        dashboardQueries.fetchFortnightsPrev(fortnightWherePrev),
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

      const paidAtRangeCurrent =
        unionPaidAtRangeFromFortnights(fortnightsCurrent);
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
        budgetPanel,
      ] = await Promise.all([
        dashboardQueries.fetchExpensesCurrent(expenseWhereCurrent),
        dashboardQueries.fetchIncomeCurrent(ownerFilter, currentFortnightIds),
        dashboardQueries.fetchExpensesPrev(expenseWherePrev),
        dashboardQueries.fetchIncomePrev(ownerFilter, prevFortnightIds),
        dashboardQueries.fetchUpcomingExpenses(expenseWhereCurrent),
        dashboardQueries.fetchIncomeWithUser(ownerFilter, currentFortnightIds),
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
        dashboardQueries.fetchDashboardWalletSnapshot(ownerFilter),
        aggregateLoanPaymentsForFortnights(ownerFilter, fortnightsCurrent),
        aggregateLoanPaymentsForFortnights(ownerFilter, fortnightsPrev),
        getMonthlyBudgetPanel(ownerFilter, current.year, current.month),
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
      const loanPlanningTotals = partitionLoanPaymentsForPlanningTotals(
        loanPayCurrent.payments,
      );
      let totalExpenseCurrent = planningCurrent.totalExpense;
      let totalPaidCurrent = planningCurrent.totalPaid;
      if (loanPlanningTotals.walletDue.total > 0) {
        totalExpenseCurrent += loanPlanningTotals.walletDue.total;
      }
      if (loanPlanningTotals.walletPaidWithoutExpense > 0) {
        totalPaidCurrent += loanPlanningTotals.walletPaidWithoutExpense;
      }
      const walletLoanDueCurrent = loanPlanningTotals.walletDue;
      const payrollLoanDeductionCurrent =
        loanPlanningTotals.payrollDeduction.total;
      const totalUnpaidCurrent = totalExpenseCurrent - totalPaidCurrent;
      const balanceCurrent =
        totalIncomeCurrent -
        payrollLoanDeductionCurrent -
        totalExpenseCurrent;

      let fundingWalletBalanceTotal = 0;
      let creditWalletDebtTotal = 0;
      let creditWalletAvailableTotal = 0;
      const fundingWalletBreakdown: Array<{
        id: number;
        name: string;
        type: 'CASH' | 'DEBIT_CARD';
        amount: number;
      }> = [];
      for (const w of dashboardWalletSnapshot) {
        const amt = Number(w.amount);
        if (
          w.type === PaymentMethodType.CASH ||
          w.type === PaymentMethodType.DEBIT_CARD
        ) {
          fundingWalletBalanceTotal += amt;
          fundingWalletBreakdown.push({
            id: w.id,
            name: w.name,
            type: w.type,
            amount: amt,
          });
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
        fundingWalletBalanceTotal -
        totalUnpaidCurrent -
        payrollLoanDeductionCurrent;

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
      const loanPlanningTotalsPrev = partitionLoanPaymentsForPlanningTotals(
        loanPayPrev.payments,
      );
      let totalExpensePrev = planningPrev.totalExpense;
      if (loanPlanningTotalsPrev.walletDue.total > 0) {
        totalExpensePrev += loanPlanningTotalsPrev.walletDue.total;
      }

      const userIncomeMap: Record<number, { name: string; amount: number }> =
        {};
      incomeWithUser.forEach((inc) => {
        const uid = inc.user?.id;
        if (uid) {
          if (!userIncomeMap[uid]) {
            userIncomeMap[uid] = {
              name: inc.user?.name ?? 'Usuario',
              amount: 0,
            };
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
            totalIncomeCurrent > 0
              ? (data.amount / totalIncomeCurrent) * 100
              : 0,
        }),
      );

      const fixedExpenses = expensesCurrent.filter(
        (e) => e.expense_template?.is_recurring === true,
      );
      const variableExpenses = expensesCurrent.filter(
        (e) => !e.expense_template || e.expense_template.is_recurring === false,
      );
      const totalFixed = fixedExpenses.reduce(
        (s, e) => s + Number(e.amount),
        0,
      );
      const totalVariable = variableExpenses.reduce(
        (s, e) => s + Number(e.amount),
        0,
      );

      const percentCommitted =
        totalIncomeCurrent > 0
          ? ((totalExpenseCurrent + payrollLoanDeductionCurrent) /
              totalIncomeCurrent) *
            100
          : 0;
      const largestExpense =
        expensesCurrent.length > 0
          ? expensesCurrent.reduce((max, e) =>
              Number(e.amount) > Number(max.amount) ? e : max,
            )
          : null;
      const categoryTotals = expensesCurrent.reduce(
        (
          acc: Record<string, { total: number; icon: string | null }>,
          expense,
        ) => {
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

      return {
        view,
        current,
        currentFortnightIds,
        allExpensesUpcoming,
        loanPayCurrent,
        payrollLoanDeductionCurrent,
        walletLoanDueCurrent,
        expensesCurrent,
        totalIncomeCurrent,
        totalExpenseCurrent,
        totalPaidCurrent,
        totalUnpaidCurrent,
        balanceCurrent,
        fundingWalletBalanceTotal,
        fundingWalletBreakdown: fundingWalletBreakdown.sort((a, b) => {
          const rank = (type: 'CASH' | 'DEBIT_CARD') =>
            type === 'CASH' ? 0 : 1;
          const rankDiff = rank(a.type) - rank(b.type);
          return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
        }),
        fundingNetVsPendingExpense,
        creditWalletDebtTotal,
        creditWalletAvailableTotal,
        orphanPayCurrent,
        cardDueCurrent,
        totalIncomePrev,
        totalExpensePrev,
        incomeBreakdown,
        totalFixed,
        totalVariable,
        percentCommitted,
        largestExpense,
        periodCategoryBreakdown,
        budgetSummary: buildDashboardBudgetSummary({
          view,
          period: current.period,
          panel: budgetPanel,
        }),
      };
    });

    const upcomingObligations = await measure(
      'dashboard.obligations',
      async () => {
        const upcomingWithDue = totalsPayload.allExpensesUpcoming
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
        const expenseObligations: DashboardUpcomingObligation[] =
          upcomingWithDue
            .filter((o) => !o.is_paid)
            .map((o) => ({ ...o, source: 'expense' as const }));
        const loanObligations: DashboardUpcomingObligation[] =
          totalsPayload.loanPayCurrent.upcoming.map((payment) => ({
            id: payment.id,
            source: 'loan_payment' as const,
            description: formatLoanPaymentLabel({
              loanName: payment.loanName,
              lender: payment.lender,
              paymentSource: payment.paymentSource,
            }),
            amount: payment.amount,
            is_paid: false,
            dueDate: payment.dueDate,
            dueDay: Number(payment.dueDate.slice(8, 10)),
            category: payment.lender,
            categoryIcon: 'LANDMARK',
            loanId: payment.loanId,
            loanName: payment.loanName,
            lender: payment.lender,
            paymentSource: payment.paymentSource,
            sourceWalletId: payment.sourceWalletId,
          }));

        return [...expenseObligations, ...loanObligations]
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .slice(0, 5);
      },
    );

    const recentActivity = await measure('dashboard.activity', async () => {
      const [recentExpenses, recentIncomes, recentLoanPayments] =
        await Promise.all([
          dashboardQueries.fetchRecentExpenses(ownerFilter),
          dashboardQueries.fetchRecentIncomes(ownerFilter),
          dashboardQueries.fetchRecentLoanPayments(ownerFilter),
        ]);

      return [
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
    });

    const alerts = await measure('dashboard.alerts', async () => {
      const today = parseCalendarDate(todayCalendarDate());

      const upcomingWithDue = totalsPayload.allExpensesUpcoming
        .map((e) => {
          const fort = e.fortnight;
          const dueDay = (e as { due_day?: number | null }).due_day ?? null;
          if (!dueDay || !fort) return null;
          const dueYmd = `${fort.year}-${String(fort.month).padStart(2, '0')}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`;
          return {
            amount: Number(e.amount),
            is_paid: e.is_paid,
            dueDate: dueYmd,
          };
        })
        .filter(Boolean) as Array<{
        amount: number;
        is_paid: boolean;
        dueDate: string;
      }>;

      const overdueInCurrent = upcomingWithDue.filter((o) => {
        if (o.is_paid) return false;
        if (o.amount <= MIN_ALERTABLE_AMOUNT) return false;
        const d = parseCalendarDate(o.dueDate);
        return d < today;
      });
      const overdueLoanPayments =
        totalsPayload.loanPayCurrent.upcoming.filter((payment) => {
          if (payment.amount <= MIN_ALERTABLE_AMOUNT) return false;
          const d = parseCalendarDate(payment.dueDate);
          return d < today;
        });
      const overdueWalletLoanPayments = overdueLoanPayments.filter(
        (payment) => payment.paymentSource === 'WALLET',
      );
      const overduePayrollLoanPayments = overdueLoanPayments.filter(
        (payment) => payment.paymentSource === 'PAYROLL_DEDUCTION',
      );
      const totalOverdueAmount =
        overdueInCurrent.reduce((s, o) => s + o.amount, 0) +
        overdueLoanPayments.reduce((s, payment) => s + payment.amount, 0);

      const alertScope = `${totalsPayload.current.year}-${totalsPayload.current.month}-${totalsPayload.view === 'biweekly' ? totalsPayload.current.period : 'MONTH'}`;
      const result: DashboardAlert[] = [];
      if (
        (overdueInCurrent.length > 0 || overdueLoanPayments.length > 0) &&
        totalOverdueAmount > MIN_ALERTABLE_AMOUNT
      ) {
        const alertId = `overdue:${alertScope}`;
        const overdueParts: string[] = [];
        if (overdueInCurrent.length > 0) {
          overdueParts.push(
            `${overdueInCurrent.length} gasto${overdueInCurrent.length === 1 ? '' : 's'}`,
          );
        }
        if (overdueWalletLoanPayments.length > 0) {
          overdueParts.push(
            `${overdueWalletLoanPayments.length} pago${overdueWalletLoanPayments.length === 1 ? '' : 's'} préstamo billetera`,
          );
        }
        if (overduePayrollLoanPayments.length > 0) {
          overdueParts.push(
            `${overduePayrollLoanPayments.length} deducción${overduePayrollLoanPayments.length === 1 ? '' : 'es'} nómina`,
          );
        }
        const overdueBreakdown =
          overdueParts.length > 0 ? ` (${overdueParts.join(', ')})` : '';
        result.push({
          id: alertId,
          type: 'overdue',
          title: 'Obligaciones vencidas',
          description: `${
            overdueInCurrent.length + overdueLoanPayments.length
          } obligacion(es) vencida(s) por ${new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(totalOverdueAmount)}${overdueBreakdown}`,
          severity: 'error',
          target: {
            path: `/monthly/${totalsPayload.current.year}/${totalsPayload.current.month}`,
            query:
              totalsPayload.view === 'biweekly'
                ? { period: totalsPayload.current.period }
                : undefined,
          },
          fingerprint: alertId,
        });
      }
      if (
        totalsPayload.percentCommitted >= 80 &&
        totalsPayload.totalIncomeCurrent > 0
      ) {
        const alertId = `high_commitment:${alertScope}`;
        result.push({
          id: alertId,
          type: 'high_commitment',
          title: 'Compromiso alto',
          description: `El ${Math.round(
            totalsPayload.percentCommitted,
          )}% de tus ingresos está comprometido en gastos.`,
          severity: 'warning',
          target: { path: '/wallets/liquidity' },
          fingerprint: alertId,
        });
      }
      if (
        totalsPayload.totalIncomeCurrent === 0 &&
        totalsPayload.currentFortnightIds.length > 0
      ) {
        const alertId = `missing_income:${alertScope}`;
        result.push({
          id: alertId,
          type: 'missing_income',
          title: 'Ingresos no registrados',
          description: 'No hay ingresos registrados para este periodo.',
          severity: 'info',
          target: {
            path: '/transactions',
            query: {
              type: 'income',
              year: totalsPayload.current.year,
              month: totalsPayload.current.month,
              period: totalsPayload.current.period,
            },
          },
          fingerprint: alertId,
        });
      }

      return { alerts: result, totalOverdueAmount };
    });

    return {
      period: {
        view: totalsPayload.view,
        year: totalsPayload.current.year,
        month: totalsPayload.current.month,
        period: totalsPayload.current.period,
      },
      summary: {
        totalIncome: totalsPayload.totalIncomeCurrent,
        totalExpense: totalsPayload.totalExpenseCurrent,
        balance: totalsPayload.balanceCurrent,
        totalPaid: totalsPayload.totalPaidCurrent,
        totalUnpaid: totalsPayload.totalUnpaidCurrent,
      },
      availableVsCommitted: {
        libre: totalsPayload.balanceCurrent,
        pagado: totalsPayload.totalPaidCurrent,
        pendiente: totalsPayload.totalUnpaidCurrent,
      },
      periodCategoryBreakdown: totalsPayload.periodCategoryBreakdown,
      fundingWalletBalanceTotal: totalsPayload.fundingWalletBalanceTotal,
      fundingWalletBreakdown: totalsPayload.fundingWalletBreakdown,
      fundingNetVsPendingExpense: totalsPayload.fundingNetVsPendingExpense,
      creditWalletDebtTotal: totalsPayload.creditWalletDebtTotal,
      creditWalletAvailableTotal: totalsPayload.creditWalletAvailableTotal,
      planningCardPayments:
        totalsPayload.orphanPayCurrent.count > 0
          ? {
              total: totalsPayload.orphanPayCurrent.total,
              count: totalsPayload.orphanPayCurrent.count,
            }
          : null,
      planningCardStatementDue:
        totalsPayload.cardDueCurrent.total > 0
          ? {
              total: totalsPayload.cardDueCurrent.total,
              cardCount: totalsPayload.cardDueCurrent.cardCount,
            }
          : null,
      planningLoanPayments:
        totalsPayload.loanPayCurrent.total > 0 ||
        totalsPayload.loanPayCurrent.pendingCount > 0
          ? {
              total: totalsPayload.loanPayCurrent.total,
              paidTotal: totalsPayload.loanPayCurrent.paidTotal,
              pendingTotal: totalsPayload.loanPayCurrent.pendingTotal,
              count: totalsPayload.loanPayCurrent.count,
              pendingCount: totalsPayload.loanPayCurrent.pendingCount,
            }
          : null,
      planningWalletLoanDue:
        totalsPayload.walletLoanDueCurrent.total > 0
          ? {
              total: totalsPayload.walletLoanDueCurrent.total,
              count: totalsPayload.walletLoanDueCurrent.count,
            }
          : null,
      planningPayrollLoanDeduction:
        totalsPayload.payrollLoanDeductionCurrent > 0
          ? {
              total: totalsPayload.payrollLoanDeductionCurrent,
              count: totalsPayload.loanPayCurrent.payments.filter(
                (payment) =>
                  payment.paymentSource === 'PAYROLL_DEDUCTION' &&
                  payment.status === 'SCHEDULED',
              ).length,
            }
          : null,
      budgetSummary: totalsPayload.budgetSummary,
      upcomingObligations,
      recentActivity,
      incomeBreakdown: {
        byPerson: totalsPayload.incomeBreakdown,
        totalIncome: totalsPayload.totalIncomeCurrent,
      },
      expenseHealth: {
        totalOverdueAmount: alerts.totalOverdueAmount,
        percentCommitted: totalsPayload.percentCommitted,
        largestExpense: totalsPayload.largestExpense
          ? {
              description: totalsPayload.largestExpense.description,
              amount: Number(totalsPayload.largestExpense.amount),
              category: totalsPayload.largestExpense.category?.name ?? '',
              categoryIcon:
                totalsPayload.largestExpense.category?.icon ?? null,
            }
          : null,
      },
      fixedVsVariable: {
        totalFixed: totalsPayload.totalFixed,
        totalVariable: totalsPayload.totalVariable,
        ratio:
          totalsPayload.totalVariable > 0
            ? (totalsPayload.totalFixed / totalsPayload.totalVariable).toFixed(1)
            : totalsPayload.totalFixed > 0
              ? '∞'
              : '0',
      },
      periodComparison: {
        currentIncome: totalsPayload.totalIncomeCurrent,
        currentExpense: totalsPayload.totalExpenseCurrent,
        previousIncome: totalsPayload.totalIncomePrev,
        previousExpense: totalsPayload.totalExpensePrev,
        incomeDiff:
          totalsPayload.totalIncomeCurrent - totalsPayload.totalIncomePrev,
        expenseDiff:
          totalsPayload.totalExpenseCurrent - totalsPayload.totalExpensePrev,
      },
      alerts: alerts.alerts,
    };
  });
