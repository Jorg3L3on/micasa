'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type IncomeBreakdownCardProps = {
  data: DashboardData;
};

export default function IncomeBreakdownCard({
  data,
}: IncomeBreakdownCardProps) {
  const [open, setOpen] = useState(false);
  const { byPerson, totalIncome } = data.incomeBreakdown;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Desglose de ingresos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm font-medium text-muted-foreground">
            Total ingresos
          </span>
          <span className="font-bold text-chart-4">
            {formatCurrency(totalIncome)}
          </span>
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            aria-label={open ? 'Ocultar detalles' : 'Ver detalles por persona'}
          >
            <span>
              {byPerson.length === 0
                ? 'Sin desglose por persona'
                : `Ingresos por persona (${byPerson.length})`}
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 space-y-2">
              {byPerson.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{p.userName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-chart-4">
                      {formatCurrency(p.amount)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {p.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
