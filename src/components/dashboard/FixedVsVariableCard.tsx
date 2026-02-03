import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

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
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Fijos vs variables
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-1 pt-2 pb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <PieChart className="size-3.5 shrink-0" aria-hidden />
            <span className="text-xs font-medium">Relación fijo/variable</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {ratio}
            {ratio !== '0' && ratio !== '∞' && (
              <span className="ml-1.5 text-base font-normal text-muted-foreground">
                ({percentFixed}% fijos)
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              Gastos fijos
            </span>
            <p className="text-base font-medium tabular-nums">
              {formatCurrency(totalFixed)}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              Gastos variables
            </span>
            <p className="text-base font-medium tabular-nums">
              {formatCurrency(totalVariable)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
