'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS, getPeriodLabel } from './constants';

type CurrentPeriodSummaryCardProps = {
  data: DashboardData;
};

export default function CurrentPeriodSummaryCard({
  data,
}: CurrentPeriodSummaryCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { summary } = data;

  const handleViewChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', value);
    if (value === 'biweekly') {
      const now = new Date();
      const day = now.getDate();
      params.set('period', day <= 15 ? 'FIRST' : 'SECOND');
    } else {
      params.delete('period');
    }
    params.delete('month');
    params.delete('year');
    router.push(`/dashboard?${params.toString()}`);
  };

  const view = searchParams.get('view') ?? data.period.view;

  const isMonthView = view === 'month';

  const BalanceIcon = summary.balance >= 0 ? Wallet : Scale;

  return (
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Resumen del periodo
        </CardTitle>
        <Select value={view} onValueChange={handleViewChange}>
          <SelectTrigger
            className={cn(
              'w-[130px] transition-all',
              isMonthView && 'glow-orange',
            )}
            aria-label="Seleccionar vista de periodo"
          >
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mes</SelectItem>
            <SelectItem value="biweekly">Quincena</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        <p
          className="text-xs text-muted-foreground"
          aria-label="Fecha del periodo"
        >
          {getPeriodLabel(data.period)}
        </p>

        <div className="flex flex-col items-center gap-1 pt-2 pb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BalanceIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="text-xs font-medium">Balance</span>
          </div>
          <p
            className={cn(
              'text-2xl font-semibold tracking-tight',
              summary.balance >= 0 ? 'text-chart-4' : 'text-destructive',
            )}
          >
            {formatCurrency(summary.balance)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="size-3.5 shrink-0" aria-hidden />
              <span className="text-xs font-medium">Ingresos</span>
            </div>
            <p className="text-base font-medium text-chart-4">
              {formatCurrency(summary.totalIncome)}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingDown className="size-3.5 shrink-0" aria-hidden />
              <span className="text-xs font-medium">Gastos</span>
            </div>
            <p className="text-base font-medium text-destructive">
              {formatCurrency(summary.totalExpense)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
