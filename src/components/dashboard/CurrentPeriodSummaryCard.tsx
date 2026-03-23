'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Scale, Wallet } from 'lucide-react';
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
import {
  DASHBOARD_CARD_CLASS,
  DASHBOARD_METRIC_STRIP_CLASS,
  getPeriodLabel,
} from './constants';

type CurrentPeriodSummaryCardProps = {
  data: DashboardData;
};

export default function CurrentPeriodSummaryCard({
  data,
}: CurrentPeriodSummaryCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { summary } = data;
  const balanceCoherente =
    summary.totalIncome - summary.totalPaid - summary.totalUnpaid;
  const orphan = data.planningCardPayments;
  const statementDue = data.planningCardStatementDue;

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

  const BalanceIcon = balanceCoherente >= 0 ? Wallet : Scale;

  return (
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Resumen del periodo">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
            <BalanceIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </span>
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold leading-none">
              Resumen del periodo
            </CardTitle>
            <p className="text-[10px] text-muted-foreground" aria-hidden>
              {getPeriodLabel(data.period)}
            </p>
          </div>
        </div>
        <Select value={view} onValueChange={handleViewChange}>
          <SelectTrigger
            className={cn(
              'h-8 w-[120px] text-xs transition-all',
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
      <CardContent className="space-y-5 pt-0">
        <div className="flex flex-col items-center gap-1.5 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Balance
          </span>
          <p
            className={cn(
              'text-2xl font-bold font-mono tabular-nums',
              balanceCoherente >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
            )}
          >
            {formatCurrency(balanceCoherente)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-5">
          <div
            className={cn(
              DASHBOARD_METRIC_STRIP_CLASS,
              'border-l-blue-500/50',
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ingresos
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
              {formatCurrency(summary.totalIncome)}
            </p>
          </div>
          <div
            className={cn(
              DASHBOARD_METRIC_STRIP_CLASS,
              'border-l-violet-500/50',
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gastos
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400 mt-0.5">
              {formatCurrency(summary.totalExpense)}
            </p>
            {statementDue != null && statementDue.total > 0 ? (
              <p className="mt-1 text-[9px] leading-snug text-muted-foreground">
                + {formatCurrency(statementDue.total)} pendiente de pago al
                estado de cuenta ({statementDue.cardCount}{' '}
                {statementDue.cardCount !== 1 ? 'tarjetas' : 'tarjeta'}).
              </p>
            ) : null}
            {orphan != null && orphan.count > 0 ? (
              <p className="mt-1 text-[9px] leading-snug text-muted-foreground">
                Incluye pagos a tarjeta: {formatCurrency(orphan.total)} (
                {orphan.count} mov.
                {orphan.count !== 1 ? 's' : ''}).
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
