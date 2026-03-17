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
    <Card className={cn(DASHBOARD_CARD_CLASS, 'min-w-0')} role="region" aria-label="Actividad reciente">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <Activity className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Actividad reciente
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-[10px] text-muted-foreground">
          {activities.length === 0
            ? 'Sin actividad'
            : `${activities.length} ${activities.length === 1 ? 'movimiento' : 'movimientos'}`}
        </p>

        {activities.length === 0 ? (
          <p
            className="text-[9px] text-muted-foreground py-4 text-center border-t border-border/60 pt-4"
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
                  className="flex gap-3 rounded-md px-2 py-1 -mx-1 transition-colors hover:bg-muted/40 min-w-0"
                >
                  <span className="shrink-0 mt-0.5">
                    {act.type === 'expense_added' ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
                        <Receipt className="h-3 w-3 text-violet-600 dark:text-violet-400" aria-hidden />
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 dark:bg-blue-500/15">
                        <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" aria-hidden />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-sm font-medium line-clamp-2">
                      {typeLabel(act.type)}: {act.description}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {formatDate(act.timestamp)}
                      {act.user && ` · ${act.user}`}
                      {act.meta && ` · ${act.meta}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-bold font-mono tabular-nums',
                      act.type === 'income_added'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-destructive',
                    )}
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
