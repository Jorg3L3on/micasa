'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, ShoppingBasket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PantryHomeInsights } from '@/components/pantry/PantryHomeInsights';
import type { DashboardData } from '@/types/dashboard';
import StatCard from '@/components/dashboard/StatCard';
import DashboardPeriodCategoryPie from '@/components/dashboard/DashboardPeriodCategoryPie';
import DashboardAvailableCommittedRadial from '@/components/dashboard/DashboardAvailableCommittedRadial';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import { cn } from '@/lib/utils';

export type DashboardHomeTab = 'panel' | 'despensa';

type DashboardPanelTabsProps = {
  data: DashboardData;
  initialTab?: DashboardHomeTab;
};

const TAB_CONFIG = [
  {
    value: 'panel',
    label: 'Panel',
    ariaLabel: 'Panel financiero',
    icon: LayoutDashboard,
  },
  {
    value: 'despensa',
    label: 'Despensa',
    ariaLabel: 'Módulo de despensa',
    icon: ShoppingBasket,
  },
] as const;

const STAT_CARDS = [
  {
    key: 'fundingBalance' as const,
    title: 'Efectivo y débito',
    iconKey: 'banknote' as const,
    iconGradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
    subtitle: 'Suma de saldos en billeteras',
  },
  {
    key: 'fundingNet' as const,
    title: 'Efectivo tras pendientes',
    iconKey: 'scale' as const,
    iconGradient: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
    subtitle: 'Billeteras menos gastos no pagados del periodo',
  },
  {
    key: 'income' as const,
    title: 'Ingresos del periodo',
    iconKey: 'trending-up' as const,
    iconGradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    subtitle: 'Total ingresado',
  },
  {
    key: 'expense' as const,
    title: 'Gastos del periodo',
    iconKey: 'trending-down' as const,
    iconGradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
    subtitle: 'Comprometido (pagado y pendiente)',
  },
  {
    key: 'creditDebt' as const,
    title: 'Deuda en tarjetas',
    iconKey: 'credit-card' as const,
    iconGradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
    subtitle: 'Saldo utilizado en TC y tiendas',
  },
  {
    key: 'creditAvailable' as const,
    title: 'Crédito disponible',
    iconKey: 'circle-dollar' as const,
    iconGradient: 'linear-gradient(135deg, #eab308 0%, #facc15 100%)',
    subtitle: 'Límite menos saldo (con límite definido)',
  },
] as const;

function tabFromQueryParam(raw: string | null): DashboardHomeTab {
  if (raw === 'despensa') return 'despensa';
  return 'panel';
}

export default function DashboardPanelTabs({
  data,
  initialTab = 'panel',
}: DashboardPanelTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DashboardHomeTab>(initialTab);
  const { summary } = data;

  useEffect(() => {
    setTab(tabFromQueryParam(searchParams.get('tab')));
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const next = value as DashboardHomeTab;
    setTab(next);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (next === 'panel') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', next);
    }
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const statValues = {
    income: summary.totalIncome,
    expense: summary.totalExpense,
    fundingBalance: data.fundingWalletBalanceTotal,
    fundingNet: data.fundingNetVsPendingExpense,
    creditDebt: data.creditWalletDebtTotal,
    creditAvailable: data.creditWalletAvailableTotal,
  };

  const viewFromUrl = searchParams.get('view');
  const selectedView: 'month' | 'biweekly' =
    viewFromUrl === 'month' ? 'month' : 'biweekly';
  const currentFortnightPeriod: 'FIRST' | 'SECOND' =
    new Date().getDate() <= 15 ? 'FIRST' : 'SECOND';

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
        // Biweekly mode is always live: lock to current fortnight.
        nextParams.set('period', currentFortnightPeriod);
      }
    });
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
      <TabsList
        variant="line"
        className="sticky top-16 z-20 mb-6 h-11 w-full min-w-0 justify-start overflow-x-auto scrollbar-hide rounded-none border-b border-border/60 bg-background px-0 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
      >
        {TAB_CONFIG.map(({ value, label, ariaLabel, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="shrink-0 gap-2 px-5 text-sm font-medium"
            aria-label={ariaLabel}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="panel" className="mt-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
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
            <span className="text-xs text-muted-foreground">
              Mostrando quincena actual ({currentFortnightPeriod === 'FIRST' ? '1ª' : '2ª'})
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {STAT_CARDS.map((card) => (
            <StatCard
              key={card.key}
              title={card.title}
              amount={statValues[card.key]}
              iconKey={card.iconKey}
              iconGradient={card.iconGradient}
              subtitle={card.subtitle}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <DashboardPeriodCategoryPie
            period={data.period}
            rows={data.periodCategoryBreakdown}
          />
          <DashboardAvailableCommittedRadial availableVsCommitted={data.availableVsCommitted} />
        </div>

        <div className="w-full">
          <MyCardsPanel />
        </div>
      </TabsContent>

      <TabsContent value="despensa" className="mt-0">
        <PantryHomeInsights />
      </TabsContent>
    </Tabs>
  );
}
