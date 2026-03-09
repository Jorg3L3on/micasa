'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import { Check, ChevronRight, ListTodo } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { updateExpensePaidStatus } from '@/lib/api';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

type UpcomingObligationsCardProps = {
  data: DashboardData;
};

const isOverdue = (dueDate: string): boolean => {
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

export default function UpcomingObligationsCard({
  data,
}: UpcomingObligationsCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { context } = useFinanceContext();
  const queryString = searchParams.toString();
  const obligations = data.upcomingObligations;

  const totalPendiente = obligations.reduce((sum, ob) => sum + ob.amount, 0);

  const handleMarkPaid = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateExpensePaidStatus(id, true, context);
      router.refresh();
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    }
  };

  return (
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Próximas obligaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {obligations.length === 0 ? (
          <p
            className="text-sm text-muted-foreground py-6 text-center"
            aria-label="Sin obligaciones pendientes"
          >
            No hay obligaciones pendientes en este periodo.
          </p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 pt-2 pb-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ListTodo className="size-3.5 shrink-0" aria-hidden />
                <span className="text-xs font-medium">
                  {obligations.length}{' '}
                  {obligations.length === 1 ? 'obligación' : 'obligaciones'}
                </span>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatCurrency(totalPendiente)}
              </p>
            </div>

            <div className="border-t border-border/60 pt-4">
              <TooltipProvider>
                <ul className="space-y-2" role="list">
                  {obligations.map((ob) => {
                    const overdue = isOverdue(ob.dueDate);
                    return (
                      <li
                        key={ob.id}
                        className={cn(
                          'flex items-center justify-between rounded-md border px-3 py-2',
                          overdue
                            ? 'border-destructive/50 bg-destructive/5'
                            : 'border-border/60',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {ob.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vence: {formatDate(ob.dueDate)}
                            {overdue && (
                              <span className="ml-2 text-destructive">
                                Vencido
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-medium tabular-nums">
                            {formatCurrency(ob.amount)}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={(e) => handleMarkPaid(e, ob.id)}
                                aria-label={`Marcar ${ob.description} como pagado`}
                              >
                                <Check
                                  className="h-4 w-4 text-chart-4"
                                  aria-hidden
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Marcar como pagado</TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </TooltipProvider>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
