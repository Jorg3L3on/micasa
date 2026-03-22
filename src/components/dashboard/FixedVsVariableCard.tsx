import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS, DASHBOARD_METRIC_STRIP_CLASS } from './constants';

type FixedVsVariableCardProps = {
  data: DashboardData;
};

export default function FixedVsVariableCard({
  data,
}: FixedVsVariableCardProps) {
  const { totalFixed, totalVariable, ratio } = data.fixedVsVariable;
  const total = totalFixed + totalVariable;
  const percentFixed =
    total > 0 ? ((totalFixed / total) * 100).toFixed(0) : '0';

  return (
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Fijos vs variables">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <PieChart className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Fijos vs variables
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-1 pt-2 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Relación fijo/variable
          </span>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
            {ratio}
            {ratio !== '0' && ratio !== '∞' && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                ({percentFixed}% fijos)
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
          <div
            className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-violet-500/50')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gastos fijos
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400 mt-0.5">
              {formatCurrency(totalFixed)}
            </p>
          </div>
          <div
            className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-violet-500/50')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gastos variables
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400 mt-0.5">
              {formatCurrency(totalVariable)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
