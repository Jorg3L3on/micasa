'use client';

import { useState } from 'react';
import { LayoutDashboard, ShoppingBasket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PantryHomeInsights } from '@/components/pantry/PantryHomeInsights';
import type { DashboardData } from '@/types/dashboard';
import StatCard from '@/components/dashboard/StatCard';
import MonthlyOverviewChart from '@/components/dashboard/MonthlyOverviewChart';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import CurrentPeriodSummaryCard from '@/components/dashboard/CurrentPeriodSummaryCard';
import RecentTransactionsTable from '@/components/dashboard/RecentTransactionsTable';

type DashboardPanelTabsProps = {
  data: DashboardData;
  initialTab?: 'panel' | 'despensa';
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

export default function DashboardPanelTabs({
  data,
  initialTab = 'panel',
}: DashboardPanelTabsProps) {
  const [tab, setTab] = useState<'panel' | 'despensa'>(initialTab);
  const { summary, availableVsCommitted } = data;

  const statValues = {
    balance: summary.balance,
    income: summary.totalIncome,
    expense: summary.totalExpense,
    available: availableVsCommitted.libre,
  };

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as 'panel' | 'despensa')} className="w-full">
      <TabsList
        variant="line"
        className="mb-6 h-11 w-full justify-start rounded-none border-b border-border/60 bg-transparent px-0"
      >
        {TAB_CONFIG.map(({ value, label, ariaLabel, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="gap-2 px-5 text-sm font-medium"
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
    </Tabs>
  );
}
