'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  BarChart3,
} from 'lucide-react';

export type IncomeItemBySource = {
  id: number;
  amount: number;
  source: string | null;
  userName: string | null;
  templateName: string | null;
};

type SummaryBlockProps = {
  tenemos: number;
  libre: number;
  pagado: number;
  pendiente: number;
  monthLabel?: string;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  incomeItems?: IncomeItemBySource[];
  year?: number;
  month?: number;
  period?: 'FIRST' | 'SECOND';
  expenseCount?: number;
  paidExpenseCount?: number;
  unpaidExpenseCount?: number;
  onEditIncome?: () => void;
  onEditIncomeSource?: (id: number, amount: number) => void;
};

export default function SummaryBlock({
  tenemos,
  libre,
  pagado,
  pendiente,
  monthLabel,
  userIncome,
  incomeItems = [],
  year,
  month,
  period,
  expenseCount = 0,
  paidExpenseCount = 0,
  unpaidExpenseCount = 0,
  onEditIncome,
  onEditIncomeSource,
}: SummaryBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!year || !month || !period) {
      setDaysRemaining(null);
      return;
    }
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    if (year !== currentYear || month !== currentMonth) {
      setDaysRemaining(null);
      return;
    }

    const endDay = period === 'FIRST' ? 15 : new Date(year, month, 0).getDate();
    const remaining = endDay - currentDay;
    setDaysRemaining(remaining >= 0 ? remaining : null);
  }, [year, month, period]);

  const periodDayRange =
    year && month && period
      ? period === 'FIRST'
        ? '1–15'
        : `16–${new Date(year, month, 0).getDate()}`
      : null;

  const hasUserIncome =
    userIncome &&
    userIncome.length > 0 &&
    userIncome.some((fi) => fi.userIncome && fi.userIncome.length > 0);

  const paidPercent = tenemos > 0 ? (pagado / tenemos) * 100 : 0;
  const pendingPercent = tenemos > 0 ? (pendiente / tenemos) * 100 : 0;
  const totalSpentPercent = paidPercent + pendingPercent;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-0 pt-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/15">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
            </span>
            <div>
              {monthLabel && (
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
                  {monthLabel}
                </p>
              )}
              <CardTitle className="text-sm font-semibold leading-none">
                Estado de la quincena
                {periodDayRange && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({periodDayRange})
                  </span>
                )}
              </CardTitle>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 shrink-0 rounded-full"
            aria-label={isExpanded ? 'Contraer desglose' : 'Expandir desglose'}
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-3 space-y-3">
        {/* Hero: Available balance */}
        <div className="relative rounded-xl border border-border/60 p-3">
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 shrink-0">
                <TrendingUp className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                  Disponible
                </p>
                {daysRemaining !== null && (
                  <p className="text-[10px] text-muted-foreground mt-1 leading-none">
                    {daysRemaining} día{daysRemaining !== 1 ? 's' : ''} restante{daysRemaining !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            <span
              className={cn(
                'text-2xl font-bold font-mono tabular-nums shrink-0',
                libre >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-destructive',
              )}
            >
              {formatCurrency(libre)}
            </span>
          </div>

          {tenemos > 0 && (
            <div className="relative mt-3">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-emerald-500/10 dark:bg-emerald-500/15">
                <div
                  className="h-full rounded-l-full bg-green-500 dark:bg-green-400 transition-all duration-500"
                  style={{ width: `${Math.min(paidPercent, 100)}%` }}
                />
                <div
                  className={cn(
                    'h-full bg-amber-400 dark:bg-amber-500 transition-all duration-500',
                    paidPercent === 0 && 'rounded-l-full',
                    paidPercent + pendingPercent >= 100 && 'rounded-r-full',
                  )}
                  style={{ width: `${Math.min(pendingPercent, 100 - Math.min(paidPercent, 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400" />
                    <span className="text-[9px] text-muted-foreground">
                      Pagado {Math.round(paidPercent)}%
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-500" />
                    <span className="text-[9px] text-muted-foreground">
                      Pendiente {Math.round(pendingPercent)}%
                    </span>
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">
                  {Math.round(totalSpentPercent)}% comprometido
                </span>
              </div>
            </div>
          )}
        </div>

        {isExpanded && (
          <>
            {/* Three metric cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* Ingresos */}
              <div className="relative rounded-lg border border-border/60 px-2.5 py-2">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 dark:bg-blue-500/15 shrink-0">
                      <Wallet className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Ingresos
                    </span>
                  </div>
                  {onEditIncome && incomeItems.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100"
                      onClick={onEditIncome}
                      aria-label="Modificar ingresos de la quincena"
                      tabIndex={0}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm font-bold font-mono tabular-nums leading-tight">
                  {formatCurrency(tenemos)}
                </p>
                {(hasUserIncome || incomeItems.length > 0) && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {incomeItems.length > 0
                      ? `${incomeItems.length} fuente${incomeItems.length !== 1 ? 's' : ''}`
                      : `${userIncome?.[0]?.userIncome.length ?? 0} fuente${(userIncome?.[0]?.userIncome.length ?? 0) !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>

              {/* Pagado */}
              <div className="relative rounded-lg border border-border/60 px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-green-500/10 dark:bg-green-500/15 shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Pagado
                  </span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums leading-tight">
                  {formatCurrency(pagado)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {expenseCount > 0
                    ? `${paidExpenseCount} de ${expenseCount} gastos`
                    : '—'}
                </p>
              </div>

              {/* Pendiente */}
              <div className="relative rounded-lg border border-border/60 px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 dark:bg-amber-500/15 shrink-0">
                    <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Pendiente
                  </span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums leading-tight">
                  {formatCurrency(pendiente)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {expenseCount > 0
                    ? `${unpaidExpenseCount} gasto${unpaidExpenseCount !== 1 ? 's' : ''}`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Income breakdown */}
            {(incomeItems.length > 0 || hasUserIncome) && (
              <>
                <Separator className="my-1" />
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Desglose de ingresos
                  </h4>
                  {incomeItems.length > 0 ? (
                    <div className="space-y-1">
                      {incomeItems.map((item) => {
                        const label =
                          item.source === '__OVERRIDE__'
                            ? 'Ingreso manual'
                            : item.templateName || item.source || 'Ingreso';
                        const displayLabel = item.userName
                          ? `${item.userName}: ${label}`
                          : label;
                        return (
                          <div
                            key={item.id}
                            className="flex justify-between items-center gap-2 group rounded-md px-2 py-1 -mx-1 transition-colors hover:bg-muted/40"
                          >
                            <span className="text-xs text-muted-foreground truncate min-w-0">
                              {displayLabel}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs font-semibold font-mono tabular-nums">
                                {formatCurrency(item.amount)}
                              </span>
                              {onEditIncomeSource && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() =>
                                    onEditIncomeSource(item.id, item.amount)
                                  }
                                  aria-label={`Modificar ${displayLabel}`}
                                  tabIndex={0}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {userIncome?.map((periodIncome) => (
                        <div key={periodIncome.fortnightId} className="space-y-1">
                          {periodIncome.userIncome.map((userInc) => (
                            <div
                              key={userInc.userId}
                              className="flex justify-between items-center gap-2 rounded-md px-2 py-1 -mx-1 transition-colors hover:bg-muted/40"
                            >
                              <span className="text-xs text-muted-foreground truncate">
                                {userInc.userName}
                              </span>
                              <span className="text-xs font-semibold font-mono tabular-nums shrink-0">
                                {formatCurrency(userInc.income)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
