'use client';

import { useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardData } from '@/types/dashboard';
import StatCard from '@/components/dashboard/StatCard';
import DashboardFundingNetCard from '@/components/dashboard/DashboardFundingNetCard';
import DashboardCreditSummaryStrip from '@/components/dashboard/DashboardCreditSummaryStrip';
import DashboardCommittedCashBar from '@/components/dashboard/DashboardCommittedCashBar';
import DashboardPeriodCategoryPie from '@/components/dashboard/DashboardPeriodCategoryPie';
import DashboardBudgetSummaryCard from '@/components/dashboard/DashboardBudgetSummaryCard';
import DashboardLoanSummaryCard from '@/components/dashboard/DashboardLoanSummaryCard';
import AlertsWarningsCard from '@/components/dashboard/AlertsWarningsCard';
import UpcomingObligationsCard from '@/components/dashboard/UpcomingObligationsCard';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import IncomeBreakdownCard from '@/components/dashboard/IncomeBreakdownCard';
import ExpenseHealthCheckCard from '@/components/dashboard/ExpenseHealthCheckCard';
import FixedVsVariableCard from '@/components/dashboard/FixedVsVariableCard';
import PeriodComparisonCard from '@/components/dashboard/PeriodComparisonCard';
import RecentActivityCard from '@/components/dashboard/RecentActivityCard';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import {
  DASHBOARD_HERO_GRID_CLASS,
  DASHBOARD_KPI_GRID_CLASS,
  getPeriodLabel,
} from '@/components/dashboard/constants';

type DashboardPanelProps = {
  data: DashboardData;
};

export default function DashboardPanel({ data }: DashboardPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isViewPending, startViewTransition] = useTransition();
  const todayYmd = useHydrationSafeTodayYmd();
  const { context } = useFinanceContext();
  const { summary, availableVsCommitted } = data;

  const viewFromUrl = searchParams.get('view');
  const selectedView: 'month' | 'biweekly' =
    viewFromUrl === 'month' ? 'month' : 'biweekly';
  const currentFortnightPeriod: 'FIRST' | 'SECOND' =
    Number(todayYmd.slice(8, 10)) <= 15 ? 'FIRST' : 'SECOND';
  const ownerQueryString = useMemo(() => {
    const query = buildOwnerQuery(context).toString();
    return query ? `?${query}` : '';
  }, [context]);
  const periodLabel = getPeriodLabel(data.period);
  const panelTitle =
    selectedView === 'month' ? 'Resumen mensual' : 'Plan de quincena';
  const disponibleSubtitle = `Pagado ${formatCurrency(availableVsCommitted.pagado)} · Pendiente ${formatCurrency(availableVsCommitted.pendiente)}`;

  const replaceSearchParams = (mutator: (next: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    const qs = nextParams.toString();
    startViewTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const handleViewChange = (nextView: 'month' | 'biweekly') => {
    if (nextView === selectedView) return;

    replaceSearchParams((nextParams) => {
      nextParams.set('view', nextView);
      if (nextView === 'month') {
        nextParams.delete('period');
      } else {
        nextParams.set('period', currentFortnightPeriod);
      }
    });
  };

  return (
    <div className="w-full space-y-5">
      {/* 1. Period chrome */}
      <section
        className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="dashboard-period-title"
        aria-describedby="dashboard-period-label"
      >
        <div className="min-w-0 flex-1">
          <h2
            id="dashboard-period-title"
            className="text-balance text-lg font-semibold leading-tight"
          >
            {panelTitle}
          </h2>
          <p
            id="dashboard-period-label"
            className="mt-1 text-sm text-muted-foreground sm:text-xs"
          >
            {periodLabel}
          </p>
        </div>
        <div
          className="grid w-full grid-cols-2 rounded-lg bg-muted/60 p-1 sm:w-auto"
          role="group"
          aria-label="Cambiar vista del panel: mes o quincena"
          aria-busy={isViewPending}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => handleViewChange('month')}
            aria-pressed={selectedView === 'month'}
            aria-label="Mostrar resumen mensual"
            disabled={isViewPending}
            className={cn(
              'h-11 rounded-md px-4 text-sm transition-colors duration-200 motion-reduce:transition-none sm:h-8 sm:text-xs',
              selectedView === 'month'
                ? 'bg-background text-foreground shadow-xs hover:bg-background dark:bg-input/60 dark:hover:bg-input/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Mes
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => handleViewChange('biweekly')}
            aria-pressed={selectedView === 'biweekly'}
            aria-label="Mostrar plan de quincena"
            disabled={isViewPending}
            className={cn(
              'h-11 rounded-md px-4 text-sm transition-colors duration-200 motion-reduce:transition-none sm:h-8 sm:text-xs',
              selectedView === 'biweekly'
                ? 'bg-background text-foreground shadow-xs hover:bg-background dark:bg-input/60 dark:hover:bg-input/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Quincena
          </Button>
        </div>
      </section>

      {/* 2. Wallets hero */}
      <div className={DASHBOARD_HERO_GRID_CLASS}>
        <DashboardFundingNetCard
          amount={data.fundingNetVsPendingExpense}
          fundingWalletBalanceTotal={data.fundingWalletBalanceTotal}
          pendingAmount={summary.totalUnpaid}
          payrollDeductionAmount={data.planningPayrollLoanDeduction?.total ?? 0}
          wallets={data.fundingWalletBreakdown}
          className="lg:col-span-2"
        />
        <DashboardCreditSummaryStrip
          creditWalletDebtTotal={data.creditWalletDebtTotal}
          creditWalletAvailableTotal={data.creditWalletAvailableTotal}
          className="lg:col-span-3"
        />
      </div>

      <MyCardsPanel />

      {/* 3. Period KPIs */}
      <div className={DASHBOARD_KPI_GRID_CLASS}>
        <StatCard
          title="Ingresos"
          amount={summary.totalIncome}
          iconKey="trending-up"
          iconGradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          subtitle="Del periodo"
        />
        <StatCard
          title="Gastos"
          amount={summary.totalExpense}
          iconKey="trending-down"
          iconGradient="linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)"
          subtitle="Del periodo"
        />
        <StatCard
          title="Presupuesto libre"
          amount={data.budgetSummary.available}
          iconKey="wallet"
          iconGradient="linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)"
          subtitle={`${data.budgetSummary.usedPercent}% usado`}
        />
        <StatCard
          title="Disponible"
          amount={availableVsCommitted.libre}
          iconKey="circle-dollar"
          iconGradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          subtitle={disponibleSubtitle}
        />
      </div>

      {/* 4. Committed cash + budget */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <DashboardCommittedCashBar
          availableVsCommitted={availableVsCommitted}
        />
        <DashboardBudgetSummaryCard
          budgetSummary={data.budgetSummary}
          ownerQueryString={ownerQueryString}
        />
      </div>

      {/* 5. Income & expense insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <IncomeBreakdownCard data={data} />
        <div className="flex flex-col gap-4 [&>*]:min-w-0">
          <ExpenseHealthCheckCard data={data} />
          <FixedVsVariableCard data={data} />
        </div>
      </div>

      {/* 6. Analysis */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <DashboardPeriodCategoryPie
          period={data.period}
          rows={data.periodCategoryBreakdown}
        />
        <PeriodComparisonCard data={data} />
      </div>

      {/* 7. Obligations, loans, alerts, activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <UpcomingObligationsCard data={data} />
        <DashboardLoanSummaryCard
          data={data}
          ownerQueryString={ownerQueryString}
        />
      </div>

      {data.alerts.length > 0 ? <AlertsWarningsCard data={data} /> : null}

      <RecentActivityCard data={data} />
    </div>
  );
}
