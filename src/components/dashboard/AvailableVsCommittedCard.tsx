'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
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
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Disponible vs comprometido">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
            <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Disponible vs comprometido
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/8 px-2.5 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Libre
          </span>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(libre)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-5">
          <div className="rounded-lg border border-l-[3px] border-l-green-500/50 bg-green-500/5 dark:bg-green-500/8 px-2.5 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pagado
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-green-600 dark:text-green-400 mt-0.5">
              {formatCurrency(pagado)}
            </p>
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-amber-500/50 bg-amber-500/5 dark:bg-amber-500/8 px-2.5 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pendiente
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
              {formatCurrency(pendiente)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
