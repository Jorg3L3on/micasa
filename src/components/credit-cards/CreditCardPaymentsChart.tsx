'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { CreditCardPaymentListItem, CreditCardStatementPurchaseItem } from '@/types/catalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

type ChartDataPoint = {
  monthKey: string;
  label: string;
  paid: number;
  projected: number;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
};

const PaymentsTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const paid = payload.find((p) => p.name === 'paid')?.value ?? 0;
  const projected = payload.find((p) => p.name === 'projected')?.value ?? 0;
  return (
    <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {paid > 0 && (
        <p className="font-mono tabular-nums text-blue-500">
          Pagos realizados: {formatCurrency(paid)}
        </p>
      )}
      {projected > 0 && (
        <p className="font-mono tabular-nums text-amber-500">
          Cuotas proyectadas: {formatCurrency(projected)}
        </p>
      )}
      {paid > 0 && projected > 0 && (
        <p className="mt-1 font-mono tabular-nums text-muted-foreground">
          Total: {formatCurrency(paid + projected)}
        </p>
      )}
    </div>
  );
};

const shortAxisMoney = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
};

type Props = {
  paymentHistory: CreditCardPaymentListItem[];
  installmentActivePurchases: CreditCardStatementPurchaseItem[];
  /** ISO date string "YYYY-MM-DD" — end of the current statement period. */
  statementEnd: string;
};

const labelFromKey = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 15));
  return date
    .toLocaleDateString('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace('.', '');
};

const buildChartData = (
  paymentHistory: CreditCardPaymentListItem[],
  installmentActivePurchases: CreditCardStatementPurchaseItem[],
  statementEnd: string,
): ChartDataPoint[] => {
  const dataMap = new Map<string, { paid: number; projected: number }>();

  const ensureMonth = (key: string) => {
    if (!dataMap.has(key)) dataMap.set(key, { paid: 0, projected: 0 });
  };

  // Aggregate actual payments by month (from paid_at ISO strings)
  for (const p of paymentHistory) {
    const key = p.paid_at.slice(0, 7);
    ensureMonth(key);
    dataMap.get(key)!.paid += Number(p.amount);
  }

  // Project remaining installment charges from the month after statement_end
  const [seYear, seMonth] = statementEnd.split('-').map(Number);
  for (const purchase of installmentActivePurchases) {
    if (
      purchase.credit_installment_current == null ||
      purchase.credit_installment_total == null
    ) {
      continue;
    }
    const remaining =
      purchase.credit_installment_total - purchase.credit_installment_current;
    for (let i = 1; i <= remaining; i++) {
      const futureDate = new Date(Date.UTC(seYear, seMonth - 1 + i, 1));
      const key = `${futureDate.getUTCFullYear()}-${String(futureDate.getUTCMonth() + 1).padStart(2, '0')}`;
      ensureMonth(key);
      dataMap.get(key)!.projected += Number(purchase.amount);
    }
  }

  return Array.from(dataMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { paid, projected }]) => ({
      monthKey: key,
      label: labelFromKey(key),
      paid,
      projected,
    }));
};

export const CreditCardPaymentsChart = ({
  paymentHistory,
  installmentActivePurchases,
  statementEnd,
}: Props) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const blue = isDark ? '#60a5fa' : '#3b82f6';
  const amber = isDark ? '#fbbf24' : '#d97706';

  const data = useMemo(
    () => buildChartData(paymentHistory, installmentActivePurchases, statementEnd),
    [paymentHistory, installmentActivePurchases, statementEnd],
  );

  const hasData = data.some((d) => d.paid > 0 || d.projected > 0);

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
          <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold leading-none">
            Pagos y cuotas futuras
          </CardTitle>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Pagos realizados a la tarjeta · Cuotas pendientes por mes
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            Sin pagos registrados ni cuotas pendientes proyectadas.
          </p>
        ) : (
          <div className="h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: axisColor }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: axisColor }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={shortAxisMoney}
                />
                <Tooltip content={<PaymentsTooltip />} cursor={{ fill: gridColor }} />
                <Legend
                  formatter={(value) =>
                    value === 'paid' ? 'Pagos realizados' : 'Cuotas proyectadas'
                  }
                  wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                />
                <Bar dataKey="paid" name="paid" fill={blue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="projected" name="projected" fill={amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
