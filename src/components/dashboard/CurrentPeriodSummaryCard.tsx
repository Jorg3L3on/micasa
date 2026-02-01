'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type CurrentPeriodSummaryCardProps = {
  data: DashboardData;
};

const periodLabel = (data: DashboardData): string => {
  const { view, year, month, period } = data.period;
  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  const m = monthNames[month - 1] ?? '';
  if (view === 'month') return `${m} ${year}`;
  return period === 'FIRST' ? `1-15 ${m} ${year}` : `16-${new Date(year, month, 0).getDate()} ${m} ${year}`;
};

export default function CurrentPeriodSummaryCard({
  data,
}: CurrentPeriodSummaryCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { summary } = data;

  const handleViewChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', value);
    if (value === 'biweekly') {
      const now = new Date();
      const day = now.getDate();
      params.set('period', day <= 15 ? 'FIRST' : 'SECOND');
    } else {
      params.delete('period');
    }
    params.delete('month');
    params.delete('year');
    router.push(`/dashboard?${params.toString()}`);
  };

  const view = searchParams.get('view') ?? data.period.view;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Resumen del periodo actual
        </CardTitle>
        <Select value={view} onValueChange={handleViewChange}>
          <SelectTrigger
            className="w-[130px]"
            aria-label="Seleccionar vista de periodo"
          >
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mes</SelectItem>
            <SelectItem value="biweekly">Quincena</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Badge variant="secondary">{periodLabel(data)}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Ingresos
            </p>
            <p className="text-lg font-bold text-chart-4">
              {formatCurrency(summary.totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Gastos
            </p>
            <p className="text-lg font-bold text-destructive">
              {formatCurrency(summary.totalExpense)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Balance
            </p>
            <p
              className={`text-lg font-bold ${
                summary.balance >= 0 ? 'text-chart-4' : 'text-destructive'
              }`}
            >
              {formatCurrency(summary.balance)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
