'use client';

import { useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardData } from '@/types/dashboard';
import DashboardFundingNetCard from '@/components/dashboard/DashboardFundingNetCard';
import DashboardCreditSummaryStrip from '@/components/dashboard/DashboardCreditSummaryStrip';
import DashboardCommittedCashBar from '@/components/dashboard/DashboardCommittedCashBar';
import DashboardCashflowCard from '@/components/dashboard/DashboardCashflowCard';
import DashboardBudgetSummaryCard from '@/components/dashboard/DashboardBudgetSummaryCard';
import DashboardLoanSummaryCard from '@/components/dashboard/DashboardLoanSummaryCard';
import AlertsWarningsCard from '@/components/dashboard/AlertsWarningsCard';
import UpcomingObligationsCard from '@/components/dashboard/UpcomingObligationsCard';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import IncomeBreakdownCard from '@/components/dashboard/IncomeBreakdownCard';
import ExpenseHealthCheckCard from '@/components/dashboard/ExpenseHealthCheckCard';
import PeriodComparisonCard from '@/components/dashboard/PeriodComparisonCard';
import LiquidityTeaserCard from '@/components/dashboard/LiquidityTeaserCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import {
  DASHBOARD_PAIR_GRID_CLASS,
  getPeriodLabel,
} from '@/components/dashboard/constants';

type DashboardPanelProps = {
  data: DashboardData;
};

export default function DashboardPanel({ data }: DashboardPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
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

  const showIncomeBreakdown =
    context.type === 'house' && data.incomeBreakdown.byPerson.length >= 2;

  const replaceSearchParams = (mutator: (next: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    const qs = nextParams.toString();
    startTransition(() => {
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
    <div className="w-full space-y-6">
      {/* 1. Period chrome */}
      <section
        className="flex flex-col gap-4 rounded-xl bg-transparent px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
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
            className="mt-1 text-sm text-muted-foreground"
          >
            {periodLabel}
          </p>
        </div>
        <div
          className="grid w-full grid-cols-2 rounded-lg bg-muted/60 p-1 sm:w-auto"
          role="group"
          aria-label="Cambiar vista del panel: mes o quincena"
          aria-busy={isPending}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => handleViewChange('month')}
            aria-pressed={selectedView === 'month'}
            aria-label="Mostrar resumen mensual"
            disabled={isPending}
            aria-busy={isPending && selectedView !== 'month'}
            className={cn(
              'h-11 rounded-md px-4 text-sm transition-colors duration-200 motion-reduce:transition-none sm:h-8 sm:text-xs',
              selectedView === 'month'
                ? 'bg-muted text-foreground hover:bg-muted dark:bg-input/40 dark:hover:bg-input/40'
                : 'text-muted-foreground hover:text-foreground',
              isPending && 'opacity-70',
            )}
          >
            {isPending && selectedView !== 'month' ? 'Cambiando…' : 'Mes'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => handleViewChange('biweekly')}
            aria-pressed={selectedView === 'biweekly'}
            aria-label="Mostrar plan de quincena"
            disabled={isPending}
            aria-busy={isPending && selectedView !== 'biweekly'}
            className={cn(
              'h-11 rounded-md px-4 text-sm transition-colors duration-200 motion-reduce:transition-none sm:h-8 sm:text-xs',
              selectedView === 'biweekly'
                ? 'bg-muted text-foreground hover:bg-muted dark:bg-input/40 dark:hover:bg-input/40'
                : 'text-muted-foreground hover:text-foreground',
              isPending && 'opacity-70',
            )}
          >
            {isPending && selectedView !== 'biweekly'
              ? 'Cambiando…'
              : 'Quincena'}
          </Button>
        </div>
      </section>

      {/* 2. Total (no depende del periodo seleccionado) */}
      <section className="space-y-4" aria-labelledby="dashboard-total-group-title">
        <div className="space-y-1">
          <h3
            id="dashboard-total-group-title"
            className="text-sm font-medium text-foreground"
          >
            Total
          </h3>
          <p className="text-xs text-muted-foreground">
            Indicadores globales, independientes de mes o quincena.
          </p>
        </div>

        {/* 2.1 Liquidez base y cobertura */}
        <div className={DASHBOARD_PAIR_GRID_CLASS}>
          <DashboardFundingNetCard
            amount={data.fundingNetVsPendingExpense}
            fundingWalletBalanceTotal={data.fundingWalletBalanceTotal}
            pendingAmount={summary.totalUnpaid}
            payrollDeductionAmount={data.planningPayrollLoanDeduction?.total ?? 0}
            wallets={data.fundingWalletBreakdown}
          />
          <LiquidityTeaserCard />
        </div>

        {/* 2.2 Crédito total */}
        <div className={DASHBOARD_PAIR_GRID_CLASS}>
          <DashboardCreditSummaryStrip
            creditWalletDebtTotal={data.creditWalletDebtTotal}
            creditWalletAvailableTotal={data.creditWalletAvailableTotal}
          />
          <MyCardsPanel />
        </div>
      </section>

      {/* 3. Periodo (sí depende de mes/quincena) */}
      <section className="space-y-4" aria-labelledby="dashboard-period-group-title">
        <div className="space-y-1">
          <h3
            id="dashboard-period-group-title"
            className="text-sm font-medium text-foreground"
          >
            Periodo
          </h3>
          <p className="text-xs text-muted-foreground">
            Indicadores que cambian con la vista de mes o quincena.
          </p>
        </div>

        {/* 3.1 Flujo del periodo + efectivo comprometido */}
        <div className={DASHBOARD_PAIR_GRID_CLASS}>
          <DashboardCashflowCard
            totalIncome={summary.totalIncome}
            totalPaid={summary.totalPaid}
          />
          <DashboardCommittedCashBar
            availableVsCommitted={data.availableVsCommitted}
          />
        </div>

        {/* 3.2 Presupuesto + próximos gastos */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
          <DashboardBudgetSummaryCard
            budgetSummary={data.budgetSummary}
            ownerQueryString={ownerQueryString}
          />
          <UpcomingObligationsCard data={data} />
        </div>

        {/* 3.3 Salud + comparación */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
          <ExpenseHealthCheckCard data={data} />
          <PeriodComparisonCard data={data} />
        </div>

        {/* 3.4 Préstamos + desglose de ingresos */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
          <DashboardLoanSummaryCard
            data={data}
            ownerQueryString={ownerQueryString}
          />
          {showIncomeBreakdown ? <IncomeBreakdownCard data={data} /> : null}
        </div>
      </section>

      {/* 4. Alertas (condicional) */}
      {data.alerts.length > 0 ? <AlertsWarningsCard data={data} /> : null}
    </div>
  );
}
