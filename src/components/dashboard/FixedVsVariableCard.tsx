import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type FixedVsVariableCardProps = {
  data: DashboardData;
};

export default function FixedVsVariableCard({
  data,
}: FixedVsVariableCardProps) {
  const { totalFixed, totalVariable, ratio } = data.fixedVsVariable;
  const total = totalFixed + totalVariable;

  return (
    <Card className="card-glass rounded-lg border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Fijos vs variables
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm font-medium text-muted-foreground">
            Gastos fijos
          </span>
          <Badge variant="secondary">{formatCurrency(totalFixed)}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm font-medium text-muted-foreground">
            Gastos variables
          </span>
          <Badge variant="outline">{formatCurrency(totalVariable)}</Badge>
        </div>
        {total > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            Relación fijo/variable: <strong>{ratio}</strong>
            {ratio !== '0' && ratio !== '∞' && (
              <span className="ml-1">
                ({((totalFixed / total) * 100).toFixed(0)}% fijos)
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
