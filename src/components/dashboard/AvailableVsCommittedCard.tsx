'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS, DASHBOARD_METRIC_STRIP_CLASS } from './constants';

type AvailableVsCommittedCardProps = {
  data: DashboardData;
};

export default function AvailableVsCommittedCard({
  data,
}: AvailableVsCommittedCardProps) {
  const { pagado, pendiente, libre } = data.availableVsCommitted;
  const orphan = data.planningCardPayments;
  const statementDue = data.planningCardStatementDue;
  const payrollDeduction = data.planningPayrollLoanDeduction;

  return (
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Disponible vs comprometido">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
            <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Disponible vs comprometido
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div
          className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-emerald-500/50')}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Libre
          </span>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(libre)}
          </p>
          {payrollDeduction != null && payrollDeduction.total > 0 ? (
            <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
              Incluye {formatCurrency(payrollDeduction.total)} en deducciones de
              nómina ({payrollDeduction.count} préstamo
              {payrollDeduction.count !== 1 ? 's' : ''}).
            </p>
          ) : null}
          {statementDue != null && statementDue.total > 0 ? (
            <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
              Incluye {formatCurrency(statementDue.total)} pendiente de pago al
              estado de cuenta ({statementDue.cardCount} tarjeta
              {statementDue.cardCount !== 1 ? 's' : ''}).
            </p>
          ) : null}
          {orphan != null && orphan.count > 0 ? (
            <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
              Incluye {formatCurrency(orphan.total)} en {orphan.count} pago
              {orphan.count !== 1 ? 's' : ''} a tarjeta (ya salieron del
              efectivo).
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-5">
          <div
            className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-green-500/50')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pagado
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-green-600 dark:text-green-400 mt-0.5">
              {formatCurrency(pagado)}
            </p>
          </div>
          <div
            className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-amber-500/50')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pendiente
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
              {formatCurrency(pendiente)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
