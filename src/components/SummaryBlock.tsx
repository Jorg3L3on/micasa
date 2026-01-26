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
  const hasUserIncome =
    userIncome &&
    userIncome.length > 0 &&
    userIncome.some((fi) => fi.userIncome && fi.userIncome.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Estado de la quincena
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Metric - Libre */}
        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Libre
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums">
              {formatCurrency(libre)}
            </span>
            {daysRemaining !== null && (
              <span className="text-xs text-muted-foreground">
                {daysRemaining} días restantes
              </span>
            )}
          </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Ingresos */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Ingresos
              </span>
            </div>
            <span className="text-lg font-bold font-mono tabular-nums">
              {formatCurrency(tenemos)}
            </span>
            {hasUserIncome && (
              <span className="text-[10px] text-muted-foreground">
                {userIncome[0]?.userIncome.length || 0} fuente
                {(userIncome[0]?.userIncome.length || 0) !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Pagado */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pagado
              </span>
            </div>
            <span className="text-lg font-bold font-mono tabular-nums">
              {formatCurrency(pagado)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {expenseCount > 0
                ? `${Math.round((pagado / tenemos) * 100)}% del total`
                : '—'}
            </span>
          </div>

          {/* Pendiente */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pendiente
              </span>
            </div>
            <span className="text-lg font-bold font-mono tabular-nums">
              {formatCurrency(pendiente)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {expenseCount} gasto{expenseCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Expandable Breakdown */}
        {isExpanded && hasUserIncome && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Desglose de ingresos</h4>
              <div className="space-y-2 text-sm">
                {userIncome.map((fortnightIncome) => (
                  <div key={fortnightIncome.fortnightId} className="space-y-1">
                    {fortnightIncome.userIncome.map((userInc) => (
                      <div
                        key={userInc.userId}
                        className="flex justify-between items-center"
                      >
                        <span className="text-muted-foreground">
                          {userInc.userName}:
                        </span>
                        <span className="font-semibold font-mono tabular-nums">
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
