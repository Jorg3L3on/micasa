'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type Props = {
  data: DashboardData;
};

function formatDate(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RecentTransactionsTable({ data }: Props) {
  const activities = data.recentActivity.slice(0, 10);

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground mb-4">Transacciones recientes</h3>
        <p className="text-sm text-muted-foreground text-center py-8">Sin actividad reciente</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <h3 className="text-base font-semibold text-foreground">Transacciones recientes</h3>
        <span className="text-xs text-muted-foreground">{activities.length} registros</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Periodo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Fecha</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Monto</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-muted-foreground">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => {
              const isIncome = activity.type === 'income_added';
              return (
                <tr
                  key={activity.id}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span className="font-medium text-foreground truncate max-w-[180px]">
                        {activity.description}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className="text-muted-foreground text-xs">{activity.meta || '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-muted-foreground text-xs">{formatDate(activity.timestamp)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        isIncome ? 'text-emerald-500' : 'text-foreground',
                      )}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(activity.amount)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        isIncome
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-primary/10 text-primary',
                      )}
                    >
                      {isIncome ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
