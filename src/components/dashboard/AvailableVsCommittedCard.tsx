'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Check, ChevronRight, Clock, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

type AvailableVsCommittedCardProps = {
  data: DashboardData;
};

export default function AvailableVsCommittedCard({
  data,
}: AvailableVsCommittedCardProps) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { libre, pagado, pendiente } = data.availableVsCommitted;

  return (
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Disponible vs comprometido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-1 pt-2 pb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Wallet className="size-3.5 shrink-0" aria-hidden />
            <span className="text-xs font-medium">Libre</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-chart-4">
            {formatCurrency(libre)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Check className="size-3.5 shrink-0" aria-hidden />
              <span className="text-xs font-medium">Pagado</span>
            </div>
            <p className="text-base font-medium text-green-600 dark:text-green-400">
              {formatCurrency(pagado)}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <span className="text-xs font-medium">Pendiente</span>
            </div>
            <p className="text-base font-medium text-amber-600 dark:text-amber-400">
              {formatCurrency(pendiente)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
