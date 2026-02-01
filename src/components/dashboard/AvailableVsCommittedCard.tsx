import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type AvailableVsCommittedCardProps = {
  data: DashboardData;
};

export default function AvailableVsCommittedCard({
  data,
}: AvailableVsCommittedCardProps) {
  const { libre, pagado, pendiente } = data.availableVsCommitted;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Disponible vs comprometido
        </CardTitle>
        <Button variant="ghost" size="icon-xs" asChild aria-label="Ver detalles">
          <Link href="/transactions">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-chart-4/30 bg-chart-4/5 px-3 py-2">
          <span className="text-sm font-medium text-chart-4">Libre</span>
          <span className="font-semibold text-chart-4">
            {formatCurrency(libre)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            Pagado
          </span>
          <span className="font-semibold text-green-700 dark:text-green-400">
            {formatCurrency(pagado)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Pendiente
          </span>
          <Badge variant="secondary" className="font-semibold">
            {formatCurrency(pendiente)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
