'use client';

import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import { ChevronRight, Check } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { clientFetchFromApi } from '@/lib/api';
import type { DashboardData } from '@/types/dashboard';

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
  const obligations = data.upcomingObligations;

  const handleMarkPaid = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await clientFetchFromApi(`/api/expenses/${id}/paid`, {
        method: 'PATCH',
        body: JSON.stringify({ paid: true }),
      });
      router.refresh();
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Próximas obligaciones
        </CardTitle>
        <Button variant="ghost" size="icon-xs" asChild aria-label="Ver detalles">
          <Link href="/transactions">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {obligations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay obligaciones pendientes en este periodo.
          </p>
        ) : (
          <ul className="space-y-2">
            {obligations.map((ob) => {
              const overdue = isOverdue(ob.dueDate);
              return (
                <li
                  key={ob.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    overdue
                      ? 'border-destructive/50 bg-destructive/5'
                      : 'border-border'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {ob.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence: {formatDate(ob.dueDate)}
                      {overdue && (
                        <Badge
                          variant="destructive"
                          className="ml-2 text-xs"
                        >
                          Vencido
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-sm">
                      {formatCurrency(ob.amount)}
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => handleMarkPaid(e, ob.id)}
                            aria-label={`Marcar ${ob.description} como pagado`}
                          >
                            <Check className="h-4 w-4 text-chart-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Marcar como pagado
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
