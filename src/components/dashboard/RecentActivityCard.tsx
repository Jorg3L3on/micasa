import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Receipt, TrendingUp } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

type RecentActivityCardProps = {
  data: DashboardData;
};

const typeLabel = (type: string): string => {
  if (type === 'expense_added') return 'Gasto agregado';
  if (type === 'income_added') return 'Ingreso agregado';
  return type;
};

export default function RecentActivityCard({ data }: RecentActivityCardProps) {
  const activities = data.recentActivity;

  return (
    <Card className={cn(DASHBOARD_CARD_CLASS, 'min-w-0')}>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Actividad reciente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-1 pt-2 pb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="size-3.5 shrink-0" aria-hidden />
            <span className="text-xs font-medium">
              {activities.length === 0
                ? 'Sin actividad'
                : `${activities.length} ${
                    activities.length === 1 ? 'movimiento' : 'movimientos'
                  }`}
            </span>
          </div>
        </div>

        {activities.length === 0 ? (
          <p
            className="text-sm text-muted-foreground py-4 text-center border-t border-border/60 pt-4"
            aria-label="Sin actividad reciente"
          >
            No hay actividad reciente.
          </p>
        ) : (
          <ScrollArea className="h-[200px] pr-4 -mx-1 border-t border-border/60 pt-4">
            <ul className="space-y-2" role="list">
              {activities.map((act) => (
                <li
                  key={act.id}
                  className="flex gap-3 rounded-md border border-border/60 px-3 py-2 min-w-0"
                >
                  <span className="shrink-0 mt-0.5 text-muted-foreground">
                    {act.type === 'expense_added' ? (
                      <Receipt className="size-3.5" aria-hidden />
                    ) : (
                      <TrendingUp
                        className="size-3.5 text-chart-4"
                        aria-hidden
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-sm font-medium line-clamp-2">
                      {typeLabel(act.type)}: {act.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
