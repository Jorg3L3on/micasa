'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS, DASHBOARD_METRIC_STRIP_CLASS } from './constants';

type IncomeBreakdownCardProps = {
  data: DashboardData;
};

export default function IncomeBreakdownCard({
  data,
}: IncomeBreakdownCardProps) {
  const [open, setOpen] = useState(false);
  const { byPerson, totalIncome } = data.incomeBreakdown;

  return (
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Desglose de ingresos">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
            <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Desglose de ingresos
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={DASHBOARD_METRIC_STRIP_CLASS}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total ingresos
          </span>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="border-t border-border/60 pt-4">
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger
              className="flex w-full items-center justify-between rounded-md px-2 py-1 -mx-1 transition-colors hover:bg-muted/40 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-label={
                open ? 'Ocultar detalles' : 'Ver detalles por persona'
              }
            >
              <span>
                {byPerson.length === 0
                  ? 'Sin desglose por persona'
                  : `Por persona (${byPerson.length})`}
              </span>
              {open ? (
                <ChevronUp className="size-4 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="size-4 shrink-0" aria-hidden />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-2" role="list">
                {byPerson.map((p) => (
                  <li
                    key={p.userId}
                    className="flex items-center justify-between rounded-md px-2 py-1 -mx-1 transition-colors hover:bg-muted/40 text-sm"
                  >
                    <span className="font-medium">{p.userName}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(p.amount)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {p.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}
