import { parseCalendarDate, todayCalendarDate } from '@/lib/calendar-dates';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { wherePlanningCashFlowExpenses } from '@/lib/finance/expense-planning-scope';
import {
  aggregateOrphanCreditCardPaymentsForPlanning,
  unionPaidAtRangeFromFortnights,
} from '@/lib/finance/planning-credit-card-payments';
import { sumPlannerCardDueForDashboardScope } from '@/lib/finance/credit-card-statement.service';
import { mergePlanningCardTotalsIntoExpenseSummary } from '@/lib/finance/planning-period-card-totals';
import { partitionLoanPaymentsForPlanningTotals } from '@/lib/finance/planning-period-loan-totals';
import { aggregateLoanPaymentsForFortnights } from '@/lib/finance/loan.service';
import * as alertsQueries from './alerts.queries';
import type {
  AlertsResponse,
  FinanceAlert,
  GetAlertsParams,
  PeriodView,
  ResolvedAlertsPeriod,
} from './alerts.types';

const MIN_ALERTABLE_AMOUNT = 0.005;

const getCurrentPeriod = (): ResolvedAlertsPeriod => {
  const [year, month, day] = todayCalendarDate().split('-').map(Number);
  const period: 'FIRST' | 'SECOND' = day <= 15 ? 'FIRST' : 'SECOND';
  return { year, month, period };
};

const resolvePeriod = (params: GetAlertsParams) => {
  const view: PeriodView = params.view ?? 'biweekly';
  const current =
    params.month && params.year
      ? {
          year: parseInt(params.year, 10),
          month: parseInt(params.month, 10),
          period:
            params.period ?? (view === 'biweekly' ? 'FIRST' : 'FIRST'),
        }
      : getCurrentPeriod();
  return { view, current };
};

const buildFortnightWhereCurrent = (
  ownerFilter: OwnerFilter,
  view: PeriodView,
  current: ResolvedAlertsPeriod,
) =>
  view === 'month'
    ? { ...ownerFilter, month: current.month, year: current.year }
    : {
        ...ownerFilter,
        month: current.month,
        year: current.year,
        period: current.period,
      };

const buildAlerts = (input: {
  view: PeriodView;
  current: ResolvedAlertsPeriod;
  currentFortnightIds: number[];
  totalIncomeCurrent: number;
  percentCommitted: number;
  expenses: Awaited<ReturnType<typeof alertsQueries.fetchAlertExpenses>>;
  loanUpcoming: Array<{
    amount: number;
    dueDate: string;
    paymentSource: 'WALLET' | 'PAYROLL_DEDUCTION';
  }>;
}): FinanceAlert[] => {
  const {
    view,
    current,
    currentFortnightIds,
    totalIncomeCurrent,
    percentCommitted,
    expenses,
    loanUpcoming,
  } = input;
  const today = parseCalendarDate(todayCalendarDate());

  const upcomingWithDue = expenses
    .map((e) => {
      const fort = e.fortnight;
      const dueDay = e.due_day ?? null;
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
  const overdueLoanPayments = loanUpcoming.filter((payment) => {
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

  const alertScope = `${current.year}-${current.month}-${view === 'biweekly' ? current.period : 'MONTH'}`;
  const result: FinanceAlert[] = [];

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
        path: `/monthly/${current.year}/${String(current.month).padStart(2, '0')}`,
        query: view === 'biweekly' ? { period: current.period } : undefined,
      },
      fingerprint: alertId,
    });
  }

  if (percentCommitted >= 80 && totalIncomeCurrent > 0) {
    const alertId = `high_commitment:${alertScope}`;
    result.push({
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
          year: current.year,
          month: current.month,
          period: current.period,
        },
      },
      fingerprint: alertId,
    });
  }

  return result;
};

/**
 * Lean finance alerts for the header bell (current period only).
 * Replaces the former full `/api/dashboard` payload consumer path.
 */
export const getAlerts = async (
  params: GetAlertsParams,
): Promise<AlertsResponse> => {
  const { ownerFilter } = params;
  const { view, current } = resolvePeriod(params);
  const fortnightWhereCurrent = buildFortnightWhereCurrent(
    ownerFilter,
    view,
    current,
  );

  const fortnightsCurrent =
    await alertsQueries.fetchFortnightsCurrent(fortnightWhereCurrent);
  const currentFortnightIds = fortnightsCurrent.map((f) => f.id);

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

  const paidAtRangeCurrent = unionPaidAtRangeFromFortnights(fortnightsCurrent);

  const [expenses, incomeCurrent, orphanPayCurrent, cardDueCurrent, loanPayCurrent] =
    await Promise.all([
      alertsQueries.fetchAlertExpenses(expenseWhereCurrent),
      alertsQueries.fetchIncomeCurrent(ownerFilter, currentFortnightIds),
      aggregateOrphanCreditCardPaymentsForPlanning(
        ownerFilter,
        paidAtRangeCurrent,
      ),
      sumPlannerCardDueForDashboardScope(
        ownerFilter,
        view,
        current.year,
        current.month,
        current.period,
      ),
      aggregateLoanPaymentsForFortnights(ownerFilter, fortnightsCurrent),
    ]);

  const overrideIncome = incomeCurrent.find((i) => i.source === '__OVERRIDE__');
  const regularIncome = incomeCurrent.filter((i) => i.source !== '__OVERRIDE__');
  const totalIncomeCurrent = overrideIncome
    ? Number(overrideIncome.amount)
    : regularIncome.reduce((s, i) => s + Number(i.amount), 0);

  const baseExpenseCurrent = expenses.reduce(
    (s, e) => s + Number(e.amount),
    0,
  );
  const basePaidCurrent = expenses
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
  if (loanPlanningTotals.walletDue.total > 0) {
    totalExpenseCurrent += loanPlanningTotals.walletDue.total;
  }
  const payrollLoanDeductionCurrent =
    loanPlanningTotals.payrollDeduction.total;

  const percentCommitted =
    totalIncomeCurrent > 0
      ? ((totalExpenseCurrent + payrollLoanDeductionCurrent) /
          totalIncomeCurrent) *
        100
      : 0;

  const alerts = buildAlerts({
    view,
    current,
    currentFortnightIds,
    totalIncomeCurrent,
    percentCommitted,
    expenses,
    loanUpcoming: loanPayCurrent.upcoming.map((payment) => ({
      amount: payment.amount,
      dueDate: payment.dueDate,
      paymentSource: payment.paymentSource,
    })),
  });

  return {
    period: {
      year: current.year,
      month: current.month,
      period: current.period,
    },
    alerts,
  };
};
