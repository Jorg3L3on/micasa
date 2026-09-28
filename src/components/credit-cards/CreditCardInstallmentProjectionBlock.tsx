'use client';

import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import { getCreditCardInstallmentProjection } from '@/lib/api/credit-cards';
import { CHART_AXIS_TICK, CHART_COLOR, chartSliceColor } from '@/components/charts/chart-theme';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { formatAxisMoney } from '@/lib/money';
import { formatCurrency } from '@/lib/utils';
import type { InstallmentProjectionMonthItem } from '@/types/catalog';

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; payload: InstallmentProjectionMonthItem }>;
  label?: string;
};

const InstallmentTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <ChartTooltip active label={label}>
      {item.cards.map((c) => (
        <p key={c.cardId} className="font-sans tabular-nums text-muted-foreground">
          {c.cardName}:{' '}
          <span className="font-semibold text-foreground">{formatCurrency(c.amount)}</span>
        </p>
      ))}
      {item.cards.length > 1 && (
        <p className="mt-1 border-t border-border/40 pt-1 font-sans tabular-nums font-semibold text-status-pending">
          Total: {formatCurrency(item.total)}
        </p>
      )}
    </ChartTooltip>
  );
};


export function CreditCardInstallmentProjectionBlock() {
  const { context } = useFinanceContext();
  const [expanded, setExpanded] = useState(true);
  const [data, setData] = useState<InstallmentProjectionMonthItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (context.id === 0) return;
    getCreditCardInstallmentProjection(context)
      .then((response) => {
        setError(null);
        setData(response);
      })
      .catch(() => {
        setData([]);
        setError('No se pudo cargar la proyección de cuotas.');
      })
      .finally(() => setLoading(false));
  }, [context]);

  const gridColor = CHART_COLOR.grid;
  const barColor = CHART_COLOR.pending;

  const cardColors = useMemo(() => {
    if (!data) return new Map<number, string>();
    const map = new Map<number, string>();
    const allCardIds = Array.from(
      new Set(data.flatMap((m) => m.cards.map((c) => c.cardId))),
    );
    allCardIds.forEach((id, i) => map.set(id, chartSliceColor(i)));
    return map;
  }, [data]);

  const isMultiCard = useMemo(() => {
    if (!data) return false;
    return new Set(data.flatMap((m) => m.cards.map((c) => c.cardId))).size > 1;
  }, [data]);

  if (loading || !data) {
    return <Skeleton className="h-12 w-full rounded-xl" />;
  }

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-status-pending-soft">
          <CalendarClock className="h-3.5 w-3.5 text-status-pending" data-icon="inline-start" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold leading-none">
            Proyección de cuotas
          </CardTitle>
          {!expanded && (
            <p className="mt-0.5 text-caption text-muted-foreground">
              {data.length} mes{data.length !== 1 ? 'es' : ''} con cuotas pendientes ·{' '}
              próximo {formatCurrency(data[0].total)}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Ocultar proyección de cuotas' : 'Ver proyección de cuotas'}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden data-icon="inline-end" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden data-icon="inline-end" />
          )}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {error ? (
            <ErrorBanner>{error}</ErrorBanner>
          ) : data.length === 0 ? (
            <EmptyState message="No hay items en MSI activos en este momento." className="py-4" />
          ) : (
          <div className="h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                />
                <YAxis
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={formatAxisMoney}
                />
                <Tooltip content={<InstallmentTooltip />} cursor={{ fill: gridColor }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => {
                    const primaryCardId = entry.cards[0]?.cardId;
                    const color =
                      isMultiCard && primaryCardId != null
                        ? cardColors.get(primaryCardId) ?? barColor
                        : barColor;
                    return <Cell key={entry.monthKey} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
          {!error && data.length > 0 && isMultiCard && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {Array.from(cardColors.entries()).map(([cardId, color]) => {
                const name = data
                  .flatMap((m) => m.cards)
                  .find((c) => c.cardId === cardId)?.cardName;
                if (!name) return null;
                return (
                  <span
                    key={cardId}
                    className="flex items-center gap-1.5 text-caption text-muted-foreground"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: color }}
                    />
                    {name}
                  </span>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
