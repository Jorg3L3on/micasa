'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type SummaryBlockProps = {
  tenemos: number;
  libre: number;
  pagado: number;
  pendiente: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  year?: number;
  month?: number;
  period?: 'FIRST' | 'SECOND';
  expenseCount?: number;
  paidExpenseCount?: number;
  unpaidExpenseCount?: number;
};

export default function SummaryBlock({
  tenemos,
  libre,
  pagado,
  pendiente,
  userIncome,
  year,
  month,
  period,
  expenseCount = 0,
  paidExpenseCount = 0,
  unpaidExpenseCount = 0,
}: SummaryBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Calculate days remaining in fortnight (client-only to avoid hydration mismatch)
  useEffect(() => {
    if (!year || !month || !period) {
      setDaysRemaining(null);
      return;
    }
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Only calculate if we're in the current month/year
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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2 px-4 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">
            Estado de la quincena
            {periodDayRange && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({periodDayRange})
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 shrink-0"
            aria-label={isExpanded ? 'Contraer' : 'Expandir'}
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-2.5">
        {/* Primary Metric - Libre (compact) */}
        <div className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Libre
              </span>
            </div>
            {daysRemaining !== null && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {daysRemaining}d rest.
              </span>
            )}
            <span className="text-xl font-bold font-mono tabular-nums truncate text-right">
              {formatCurrency(libre)}
            </span>
          </div>
        </div>

        {/* Secondary Metrics - single row, compact */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 rounded border border-border/50 bg-muted/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <Wallet className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Ingresos
              </span>
            </div>
            <span className="text-sm font-bold font-mono tabular-nums leading-tight">
              {formatCurrency(tenemos)}
            </span>
            {hasUserIncome && (
              <span className="text-[9px] text-muted-foreground">
                {userIncome[0]?.userIncome.length || 0} fuente
                {(userIncome[0]?.userIncome.length || 0) !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5 rounded border border-border/50 bg-muted/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Pagado
              </span>
            </div>
            <span className="text-sm font-bold font-mono tabular-nums leading-tight">
              {formatCurrency(pagado)}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {expenseCount > 0
                ? `${Math.round((paidExpenseCount / expenseCount) * 100)}%`
                : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 rounded border border-border/50 bg-muted/30 px-2 py-1.5">
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-600 dark:text-yellow-400" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Pendiente
              </span>
            </div>
            <span className="text-sm font-bold font-mono tabular-nums leading-tight">
              {formatCurrency(pendiente)}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {expenseCount > 0
                ? `${Math.round((unpaidExpenseCount / expenseCount) * 100)}%`
                : '—'}
            </span>
          </div>
        </div>

        {/* Expandable Breakdown */}
        {isExpanded && hasUserIncome && (
          <>
            <Separator className="my-1.5" />
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold">Desglose de ingresos</h4>
              <div className="space-y-1 text-xs">
                {userIncome.map((periodIncome) => (
                  <div key={periodIncome.fortnightId} className="space-y-0.5">
                    {periodIncome.userIncome.map((userInc) => (
                      <div
                        key={userInc.userId}
                        className="flex justify-between items-center gap-2"
                      >
                        <span className="text-muted-foreground truncate">
                          {userInc.userName}:
                        </span>
                        <span className="font-semibold font-mono tabular-nums shrink-0">
                          {formatCurrency(userInc.income)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
