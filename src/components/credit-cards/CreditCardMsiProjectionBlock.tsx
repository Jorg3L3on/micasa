'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
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
import { getCreditCardMsiProjection } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { MsiProjectionMonthItem } from '@/types/catalog';

const STORAGE_KEY = 'micasa.msi-projection.expanded';

const readStored = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeStored = (value: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* ignore */
  }
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; payload: MsiProjectionMonthItem }>;
  label?: string;
};

const MsiTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      {item.cards.map((c) => (
        <p key={c.cardId} className="font-mono tabular-nums text-muted-foreground">
          {c.cardName}:{' '}
          <span className="font-semibold text-foreground">{formatCurrency(c.amount)}</span>
        </p>
      ))}
      {item.cards.length > 1 && (
        <p className="mt-1 border-t border-border/40 pt-1 font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
          Total: {formatCurrency(item.total)}
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

export function CreditCardMsiProjectionBlock() {
  const { context } = useFinanceContext();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<MsiProjectionMonthItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    setExpanded(readStored());
  }, []);

  useEffect(() => {
    if (context.id === 0) return;
    setLoading(true);
    getCreditCardMsiProjection(context)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [context]);

  const isDark = mounted && resolvedTheme === 'dark';
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const barColor = isDark ? '#fbbf24' : '#d97706';

  const cardColors = useMemo(() => {
    if (!data) return new Map<number, string>();
    const palette = isDark
      ? ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#fb923c']
      : ['#d97706', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f97316'];
    const map = new Map<number, string>();
    const allCardIds = Array.from(
      new Set(data.flatMap((m) => m.cards.map((c) => c.cardId))),
    );
    allCardIds.forEach((id, i) => map.set(id, palette[i % palette.length]));
    return map;
  }, [data, isDark]);

  const isMultiCard = useMemo(() => {
    if (!data) return false;
    return new Set(data.flatMap((m) => m.cards.map((c) => c.cardId))).size > 1;
  }, [data]);

  if (loading || !data) {
    return <Skeleton className="h-12 w-full rounded-xl" />;
  }

  if (data.length === 0) return null;

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    writeStored(next);
  };

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
          <CalendarClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold leading-none">
            Proyección de cuotas MSI
          </CardTitle>
          {!expanded && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
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
          aria-label={expanded ? 'Ocultar proyección MSI' : 'Ver proyección MSI'}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="h-48 w-full min-w-0">
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
                <Tooltip content={<MsiTooltip />} cursor={{ fill: gridColor }} />
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
          {isMultiCard && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {Array.from(cardColors.entries()).map(([cardId, color]) => {
                const name = data
                  .flatMap((m) => m.cards)
                  .find((c) => c.cardId === cardId)?.cardName;
                if (!name) return null;
                return (
                  <span
                    key={cardId}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
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
