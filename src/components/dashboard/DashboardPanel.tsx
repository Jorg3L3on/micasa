'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardData } from '@/types/dashboard';
import StatCard from '@/components/dashboard/StatCard';
import DashboardFundingNetCard from '@/components/dashboard/DashboardFundingNetCard';
import DashboardPeriodCategoryPie from '@/components/dashboard/DashboardPeriodCategoryPie';
import DashboardBudgetSummaryCard from '@/components/dashboard/DashboardBudgetSummaryCard';
import DashboardLoanSummaryCard from '@/components/dashboard/DashboardLoanSummaryCard';
import AlertsWarningsCard from '@/components/dashboard/AlertsWarningsCard';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import { getPeriodLabel } from '@/components/dashboard/constants';

type DashboardPanelProps = {
  data: DashboardData;
};

export default function DashboardPanel({ data }: DashboardPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const loanPendingTotal = data.planningLoanPayments?.pendingTotal ?? 0;

  const replaceSearchParams = (mutator: (next: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleViewChange = (nextView: 'month' | 'biweekly') => {
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm sm:px-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Plan de quincena</h2>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>
        <div
          className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-1"
          role="group"
          aria-label="Cambiar vista del panel: mes o quincena"
        >
          <Button
            type="button"
            size="sm"
            variant={selectedView === 'month' ? 'default' : 'ghost'}
            onClick={() => handleViewChange('month')}
            aria-pressed={selectedView === 'month'}
            className={cn(
              'h-8 rounded-md px-3 text-xs',
              selectedView !== 'month' && 'text-muted-foreground',
            )}
          >
            Mes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedView === 'biweekly' ? 'default' : 'ghost'}
            onClick={() => handleViewChange('biweekly')}
            aria-pressed={selectedView === 'biweekly'}
            className={cn(
              'h-8 rounded-md px-3 text-xs',
              selectedView !== 'biweekly' && 'text-muted-foreground',
            )}
          >
            Quincena
          </Button>
        </div>

        {selectedView === 'biweekly' ? (
          <span className="basis-full text-xs text-muted-foreground sm:basis-auto">
            Mostrando quincena actual ({currentFortnightPeriod === 'FIRST' ? '1ª' : '2ª'})
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <DashboardFundingNetCard
          amount={data.fundingNetVsPendingExpense}
          fundingWalletBalanceTotal={data.fundingWalletBalanceTotal}
          pendingAmount={summary.totalUnpaid}
          payrollDeductionAmount={data.planningPayrollLoanDeduction?.total ?? 0}
          wallets={data.fundingWalletBreakdown}
          className="col-span-2"
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
          amount={loanPendingTotal}
          iconKey="hand-coins"
          iconGradient="linear-gradient(135deg, #eab308 0%, #facc15 100%)"
          subtitle={`${data.planningLoanPayments?.pendingCount ?? 0} pendiente(s)`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-stretch">
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

      {data.alerts.length > 0 ? <AlertsWarningsCard data={data} /> : null}

      <div className="w-full">
        <MyCardsPanel />
      </div>
    </div>
  );
}
