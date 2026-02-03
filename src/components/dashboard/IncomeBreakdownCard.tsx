'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

type IncomeBreakdownCardProps = {
  data: DashboardData;
};

export default function IncomeBreakdownCard({
  data,
}: IncomeBreakdownCardProps) {
  const [open, setOpen] = useState(false);
  const { byPerson, totalIncome } = data.incomeBreakdown;

  return (
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Desglose de ingresos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-1 pt-2 pb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="size-3.5 shrink-0" aria-hidden />
            <span className="text-xs font-medium">Total ingresos</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-chart-4">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="border-t border-border/60 pt-4">
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger
              className="flex w-full items-center justify-between rounded-md py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
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
                    className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{p.userName}</span>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-chart-4">
                        {formatCurrency(p.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground">
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
