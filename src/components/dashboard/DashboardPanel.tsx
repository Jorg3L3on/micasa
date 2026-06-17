'use client';

import { useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardData } from '@/types/dashboard';
import StatCard from '@/components/dashboard/StatCard';
import DashboardFundingNetCard from '@/components/dashboard/DashboardFundingNetCard';
import DashboardPeriodCategoryPie from '@/components/dashboard/DashboardPeriodCategoryPie';
import DashboardBudgetSummaryCard from '@/components/dashboard/DashboardBudgetSummaryCard';
import DashboardLoanSummaryCard from '@/components/dashboard/DashboardLoanSummaryCard';
import AlertsWarningsCard from '@/components/dashboard/AlertsWarningsCard';
import UpcomingObligationsCard from '@/components/dashboard/UpcomingObligationsCard';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import { getPeriodLabel } from '@/components/dashboard/constants';
import { getDashboardLoanStatDisplay } from '@/components/dashboard/dashboard-loan-stat-display';

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
  const { summary } = data;

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
  const loanStat = getDashboardLoanStatDisplay(data);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6 [&>*]:min-w-0">
        <DashboardFundingNetCard
          amount={data.fundingNetVsPendingExpense}
          fundingWalletBalanceTotal={data.fundingWalletBalanceTotal}
          pendingAmount={summary.totalUnpaid}
          payrollDeductionAmount={data.planningPayrollLoanDeduction?.total ?? 0}
          wallets={data.fundingWalletBreakdown}
          className="sm:col-span-2"
        />
        <StatCard
          title="Ingresos"
          amount={summary.totalIncome}
          iconKey="trending-up"
          iconGradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          subtitle="Del periodo"
        />
        <StatCard
          title="Pendiente"
          amount={summary.totalUnpaid}
          iconKey="trending-down"
          iconGradient="linear-gradient(135deg, #f97316 0%, #fb923c 100%)"
          subtitle="Por pagar"
        />
        <StatCard
          title="Presupuesto libre"
          amount={data.budgetSummary.available}
          iconKey="wallet"
          iconGradient="linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)"
          subtitle={`${data.budgetSummary.usedPercent}% usado`}
        />
        <StatCard
          title="Préstamos"
          amount={loanStat.amount}
          iconKey="hand-coins"
          iconGradient="linear-gradient(135deg, #eab308 0%, #facc15 100%)"
          subtitle={loanStat.subtitle}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 [&>*]:min-w-0">
        <DashboardBudgetSummaryCard
          budgetSummary={data.budgetSummary}
          ownerQueryString={ownerQueryString}
        />
        <DashboardLoanSummaryCard
          data={data}
          ownerQueryString={ownerQueryString}
        />
        <DashboardPeriodCategoryPie
          period={data.period}
          rows={data.periodCategoryBreakdown}
        />
      </div>

      <UpcomingObligationsCard data={data} />

      {data.alerts.length > 0 ? <AlertsWarningsCard data={data} /> : null}

      <MyCardsPanel />
    </div>
  );
}
