'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  AlertsWarningsCard,
  PeriodComparisonCard,
} from './index';
import { DASHBOARD_GRID_CLASS } from './constants';

type DashboardTabsProps = {
  data: DashboardData;
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

export default function DashboardTabs({ data }: DashboardTabsProps) {
  const [tab, setTab] = useState<string>('resumen');
  const hasAlerts = data.alerts.length > 0;

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-6 w-full sm:w-auto flex flex-wrap h-auto gap-1 p-1">
        {TAB_CONFIG.map(({ value, label, ariaLabel, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="gap-1.5 px-3 py-2"
            aria-label={ariaLabel}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="resumen" className="mt-0 space-y-6">
        <div className={DASHBOARD_GRID_CLASS}>
          <CurrentPeriodSummaryCard data={data} />
          <AvailableVsCommittedCard data={data} />
        </div>
        {hasAlerts && (
          <Card
            className={cn(
              'card-glass card-depth rounded-lg border border-amber-500/40 dark:border-amber-500/40',
            )}
          >
            <CardContent className="flex flex-row items-center justify-between gap-4 py-3 px-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                <span className="text-sm font-medium">
                  {data.alerts.length}{' '}
                  {data.alerts.length === 1 ? 'alerta' : 'alertas'} en este
                  periodo
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab('actividad')}
                aria-label="Ver alertas en pestaña Actividad"
              >
                Ver en Actividad
              </Button>
            </CardContent>
          </Card>
        )}
        <div className="max-w-2xl">
          <QuickActionsCard compact />
        </div>
      </TabsContent>

      <TabsContent value="actividad" className="mt-0 space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentActivityCard data={data} />
          </div>
          <div className="space-y-4">
            <UpcomingObligationsCard data={data} />
            <AlertsWarningsCard data={data} />
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
