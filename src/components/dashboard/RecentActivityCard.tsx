import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Receipt, TrendingUp } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';

type RecentActivityCardProps = {
  data: DashboardData;
};

const typeLabel = (type: string): string => {
  if (type === 'expense_added') return 'Gasto agregado';
  if (type === 'income_added') return 'Ingreso agregado';
  return type;
};

export default function RecentActivityCard({
  data,
}: RecentActivityCardProps) {
  const activities = data.recentActivity;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Actividad reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay actividad reciente.
          </p>
        ) : (
          <ScrollArea className="h-[240px] pr-4">
            <ul className="space-y-3">
              {activities.map((act) => (
                <li
                  key={act.id}
                  className="flex gap-3 rounded-lg border border-border px-3 py-2 min-w-0"
                >
                  <span className="shrink-0 mt-0.5 text-muted-foreground">
                    {act.type === 'expense_added' ? (
                      <Receipt className="h-4 w-4" aria-hidden />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-chart-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-sm font-medium wrap-break-word line-clamp-2">
                      {typeLabel(act.type)}: {act.description}
                    </p>
                    <p className="text-xs text-muted-foreground wrap-break-word mt-0.5">
                      {formatDate(act.timestamp)}
                      {act.user && ` · ${act.user}`}
                      {act.meta && ` · ${act.meta}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-medium tabular-nums ${
                      act.type === 'income_added'
                        ? 'text-chart-4'
                        : 'text-destructive'
                    }`}
                  >
                    {act.type === 'income_added' ? '+' : '-'}
                    {formatCurrency(act.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
