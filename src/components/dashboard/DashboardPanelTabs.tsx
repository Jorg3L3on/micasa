'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, ListChecks, ShoppingBasket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardTasksTab from '@/components/dashboard/DashboardTasksTab';
import { PantryHomeInsights } from '@/components/pantry/PantryHomeInsights';
import type { DashboardData } from '@/types/dashboard';
import StatCard from '@/components/dashboard/StatCard';
import MonthlyOverviewChart from '@/components/dashboard/MonthlyOverviewChart';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import CurrentPeriodSummaryCard from '@/components/dashboard/CurrentPeriodSummaryCard';
import RecentTransactionsTable from '@/components/dashboard/RecentTransactionsTable';

export type DashboardHomeTab = 'panel' | 'despensa' | 'tareas';

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
  {
    value: 'tareas',
    label: 'Tareas',
    ariaLabel: 'Resumen de tareas del día',
    icon: ListChecks,
  },
] as const;

const STAT_CARDS = [
  {
    key: 'balance' as const,
    title: 'Balance total',
    iconKey: 'wallet' as const,
    iconGradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
    subtitle: 'Saldo en billeteras',
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
    subtitle: 'Total gastado',
  },
  {
    key: 'available' as const,
    title: 'Disponible',
    iconKey: 'circle-dollar' as const,
    iconGradient: 'linear-gradient(135deg, #eab308 0%, #facc15 100%)',
    subtitle: 'Libre de compromisos',
  },
] as const;

function tabFromQueryParam(raw: string | null): DashboardHomeTab {
  if (raw === 'despensa') return 'despensa';
  if (raw === 'tareas') return 'tareas';
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
  const { summary, availableVsCommitted } = data;

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
    balance: summary.balance,
    income: summary.totalIncome,
    expense: summary.totalExpense,
    available: availableVsCommitted.libre,
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
      <TabsList
        variant="line"
        className="mb-6 h-11 w-full min-w-0 justify-start overflow-x-auto scrollbar-hide rounded-none border-b border-border/60 bg-transparent px-0"
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="order-1 lg:col-span-6">
            <MonthlyOverviewChart />
          </div>
          <div className="order-2 lg:col-span-3">
            <CurrentPeriodSummaryCard data={data} />
          </div>
          <div className="order-3 lg:col-span-3">
            <MyCardsPanel />
          </div>
        </div>

        <RecentTransactionsTable data={data} />
      </TabsContent>

      <TabsContent value="despensa" className="mt-0">
        <PantryHomeInsights />
      </TabsContent>

      <TabsContent value="tareas" className="mt-0">
        {tab === 'tareas' ? <DashboardTasksTab /> : null}
      </TabsContent>
    </Tabs>
  );
}
