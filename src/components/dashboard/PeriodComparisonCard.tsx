import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';

type PeriodComparisonCardProps = {
  data: DashboardData;
};

export default function PeriodComparisonCard({
  data,
}: PeriodComparisonCardProps) {
  const {
    currentIncome,
    currentExpense,
    previousIncome,
    previousExpense,
    incomeDiff,
    expenseDiff,
  } = data.periodComparison;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Comparación de periodos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Ingresos</p>
            <p className="font-semibold text-chart-4">
              {formatCurrency(currentIncome)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {incomeDiff >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-chart-4" aria-hidden />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive" aria-hidden />
              )}
              <Badge
                variant={incomeDiff >= 0 ? 'default' : 'destructive'}
                className="text-xs"
              >
                {incomeDiff >= 0 ? '+' : ''}
                {formatCurrency(incomeDiff)} vs anterior
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Gastos</p>
            <p className="font-semibold text-destructive">
              {formatCurrency(currentExpense)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {expenseDiff <= 0 ? (
                <ArrowDownRight className="h-4 w-4 text-chart-4" aria-hidden />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-destructive" aria-hidden />
              )}
              <Badge
                variant={expenseDiff <= 0 ? 'default' : 'destructive'}
                className="text-xs"
              >
                {expenseDiff >= 0 ? '+' : ''}
                {formatCurrency(expenseDiff)} vs anterior
              </Badge>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground border-t pt-3">
          Periodo anterior: Ingresos {formatCurrency(previousIncome)}, Gastos{' '}
          {formatCurrency(previousExpense)}
        </p>
      </CardContent>
    </Card>
  );
}
