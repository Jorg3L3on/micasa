'use client';

import { useMemo } from 'react';
import {
  Cell,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Gauge } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type RadialRow = {
  name: string;
  share: number;
  amountMx: number;
  fill: string;
};

type TooltipPayload = {
  name: string;
  share: number;
  amountMx: number;
  fill: string;
};

type RadialTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
};

function RadialTooltip({ active, payload }: RadialTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground">{p.name}</p>
      <p className="font-mono tabular-nums text-foreground">{formatCurrency(p.amountMx)}</p>
      <p className="text-[10px] text-muted-foreground">
        {p.share.toFixed(1)}% del total mostrado (pagado + pendiente + saldo positivo)
      </p>
    </div>
  );
}

type DashboardAvailableCommittedRadialProps = {
  availableVsCommitted: DashboardData['availableVsCommitted'];
};

export default function DashboardAvailableCommittedRadial({
  availableVsCommitted,
}: DashboardAvailableCommittedRadialProps) {
  const { libre, pagado, pendiente } = availableVsCommitted;

  const { chartData, sumShown, hasNegativeLibre } = useMemo(() => {
    const libreVis = Math.max(0, libre);
    const sum = libreVis + pagado + pendiente;
    const neg = libre < 0;
    if (sum <= 0) {
      return {
        chartData: [] as RadialRow[],
        sumShown: 0,
        hasNegativeLibre: neg,
      };
    }
    const rows: RadialRow[] = [
      {
        name: 'Libre (balance)',
        share: (libreVis / sum) * 100,
        amountMx: libre,
        fill: '#06b6d4',
      },
      {
        name: 'Pagado',
        share: (pagado / sum) * 100,
        amountMx: pagado,
        fill: '#22c55e',
      },
      {
        name: 'Pendiente',
        share: (pendiente / sum) * 100,
        amountMx: pendiente,
        fill: '#f97316',
      },
    ];
    return { chartData: rows, sumShown: sum, hasNegativeLibre: neg };
  }, [libre, pagado, pendiente]);

  return (
    <div
      className="flex min-h-[280px] flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm"
      role="region"
      aria-label="Compromiso del periodo: libre, pagado y pendiente"
    >
      <div className="mb-3 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
          <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-none text-foreground">
            Compromiso del periodo
          </h3>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Proporción entre balance disponible (si es positivo), ya pagado y pendiente.
          </p>
          {hasNegativeLibre ? (
            <p className="mt-1 text-[10px] text-destructive">
              Balance negativo: {formatCurrency(libre)} — la franja &quot;Libre&quot; no amplía el arco.
            </p>
          ) : null}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
          Sin movimiento registrado para graficar (totales en cero).
        </p>
      ) : (
        <>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="75%"
                innerRadius="18%"
                outerRadius="100%"
                barSize={18}
                data={chartData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="share" cornerRadius={8} background={{ fill: 'rgba(127,127,127,0.14)' }}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                  ))}
                </RadialBar>
                <Tooltip content={<RadialTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-2 grid gap-2 border-t border-border/60 pt-3 text-[11px] sm:grid-cols-3">
            {chartData.map((row) => (
              <li key={row.name} className="rounded-lg border border-border/60 bg-transparent px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: row.fill }}
                  />
                  <span className="font-medium text-foreground">{row.name}</span>
                </div>
                <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
                  {formatCurrency(row.amountMx)}
                </p>
                <p className="text-[10px] text-muted-foreground">{row.share.toFixed(1)}%</p>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[9px] leading-snug text-muted-foreground">
            Total referencia: {formatCurrency(sumShown)} — mismo periodo que los KPI del panel.
          </p>
        </>
      )}
    </div>
  );
}
