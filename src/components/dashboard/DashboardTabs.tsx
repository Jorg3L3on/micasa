'use client';

import { useState } from 'react';
import { Activity, BarChart3, LayoutDashboard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DashboardData } from '@/types/dashboard';
import {
  CurrentPeriodSummaryCard,
  AvailableVsCommittedCard,
  UpcomingObligationsCard,
  RecentActivityCard,
  IncomeBreakdownCard,
  ExpenseHealthCheckCard,
  FixedVsVariableCard,
  QuickActionsCard,
  PeriodComparisonCard,
} from './index';
import { DASHBOARD_GRID_CLASS } from './constants';

type DashboardTabsProps = {
  data: DashboardData;
  initialTab?: 'resumen' | 'actividad' | 'analisis';
};

const TAB_CONFIG = [
  {
    value: 'resumen',
    label: 'Resumen',
    ariaLabel: 'Resumen del periodo',
    icon: LayoutDashboard,
  },
  {
    value: 'actividad',
    label: 'Actividad',
    ariaLabel: 'Actividad y obligaciones',
    icon: Activity,
  },
  {
    value: 'analisis',
    label: 'Análisis',
    ariaLabel: 'Análisis y tendencias',
    icon: BarChart3,
  },
] as const;

const TAB_VALUES = ['resumen', 'actividad', 'analisis'] as const;

export default function DashboardTabs({
  data,
  initialTab,
}: DashboardTabsProps) {
  const [tab, setTab] = useState<string>(
    initialTab && TAB_VALUES.includes(initialTab) ? initialTab : 'resumen',
  );

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-6 w-full sm:w-auto flex flex-wrap h-auto gap-1 p-1.5 rounded-lg bg-muted/40">
        {TAB_CONFIG.map(({ value, label, ariaLabel, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors"
            aria-label={ariaLabel}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="resumen" className="mt-0 space-y-6">
        <div className={DASHBOARD_GRID_CLASS}>
          <QuickActionsCard compact period={data.period} />
          <CurrentPeriodSummaryCard data={data} />
          <AvailableVsCommittedCard data={data} />
        </div>
      </TabsContent>

      <TabsContent value="actividad" className="mt-0 space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentActivityCard data={data} />
          </div>
          <div className="space-y-4">
            <UpcomingObligationsCard data={data} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="analisis" className="mt-0 space-y-6">
        <div className={DASHBOARD_GRID_CLASS}>
          <PeriodComparisonCard data={data} />
          <FixedVsVariableCard data={data} />
          <ExpenseHealthCheckCard data={data} />
        </div>
        <div className="max-w-md">
          <IncomeBreakdownCard data={data} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
