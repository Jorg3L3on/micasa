'use client';

import { useEffect, useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  BarChart3,
  CalendarDays,
  History,
  Package,
  Receipt,
  Scale,
} from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { getPantryInsights } from '@/lib/api';
import type { PantryInsightsDto } from '@/types/pantry-insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DASHBOARD_METRIC_STRIP_CLASS } from '@/components/dashboard/constants';
import { PantryInsightsCharts } from '@/components/pantry/PantryInsightsCharts';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const formatPercent = (n: number | null): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};

const formatQty = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

/** Bounded height so card lists scroll instead of growing without limit */
const PANTRY_CARD_LIST_SCROLL_CLASS =
  'max-h-[min(18rem,42vh)] overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]';

export const PantryHomeInsights = () => {
  const { context } = useFinanceContext();
  const [data, setData] = useState<PantryInsightsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPantryInsights(context);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'No se pudieron cargar las métricas',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [context]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando métricas">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const { metrics, highlights } = data;
  const hasReceipts = metrics.receipt_count > 0;

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        role="region"
        aria-label="Resumen de gasto en despensa"
      >
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-violet-500/50',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gasto total
          </p>
          <p className="text-sm font-bold font-mono tabular-nums">
            {formatCurrency(metrics.total_spend)}
          </p>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-blue-500/50',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recibos
          </p>
          <p className="text-sm font-bold font-mono tabular-nums">
            {metrics.receipt_count}
          </p>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-emerald-500/50',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Productos distintos
          </p>
          <p className="text-sm font-bold font-mono tabular-nums">
            {metrics.distinct_products}
          </p>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-amber-500/50',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ticket promedio
          </p>
          <p className="text-sm font-bold font-mono tabular-nums">
            {metrics.average_receipt_spend != null
              ? formatCurrency(metrics.average_receipt_spend)
              : '—'}
          </p>
        </div>
      </div>

      {metrics.average_unit_price != null && hasReceipts ? (
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-sky-500/50',
          )}
          role="region"
          aria-label="Precio unitario promedio"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500/10 dark:bg-sky-500/15">
              <BarChart3 className="h-3 w-3 text-sky-600 dark:text-sky-400" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Precio unitario promedio (líneas con dato)
              </p>
              <p className="text-sm font-bold font-mono tabular-nums">
                {formatCurrency(metrics.average_unit_price)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold leading-none">
                Lo más comprado
              </CardTitle>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Por veces que aparece en recibos y gasto acumulado
              </p>
            </div>
          </CardHeader>
          <CardContent
            className="pt-0"
            role="region"
            aria-label="Productos más comprados"
          >
            {!hasReceipts || data.top_products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay datos. Importa un recibo para ver el ranking.
              </p>
            ) : (
              <div className={PANTRY_CARD_LIST_SCROLL_CLASS}>
                <ul className="divide-y divide-border/50">
                {data.top_products.map((p, idx) => (
                  <li
                    key={`${p.label}-${idx}`}
                    className="flex flex-col gap-0.5 py-2.5 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-medium leading-snug">
                        {p.label}
                      </span>
                      <span className="shrink-0 text-sm font-bold font-mono tabular-nums">
                        {formatCurrency(p.total_spend)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                      <span>{p.purchase_count} en recibos</span>
                      {p.total_quantity > 0 ? (
                        <span>{formatQty(p.total_quantity)} uds. acumuladas</span>
                      ) : null}
                    </div>
                  </li>
                ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
              <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold leading-none">
                Subieron de precio
              </CardTitle>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Última compra vs. compra anterior (mismo producto, mayor impacto
                primero)
              </p>
            </div>
          </CardHeader>
          <CardContent
            className="pt-0"
            role="region"
            aria-label="Productos con precio al alza"
          >
            {data.price_increases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasReceipts
                  ? 'No hay suficientes compras repetidas con precio comparable.'
                  : 'Importa recibos para comparar precios en el tiempo.'}
              </p>
            ) : (
              <div className={PANTRY_CARD_LIST_SCROLL_CLASS}>
                <ul className="divide-y divide-border/50">
                {data.price_increases.map((row, idx) => (
                  <li
                    key={`${row.label}-up-${idx}`}
                    className="py-2.5 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-medium leading-snug">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        {formatPercent(row.change_percent)}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatCurrency(row.previous_unit_price)} →{' '}
                      {formatCurrency(row.latest_unit_price)} · última compra{' '}
                      {formatDate(row.latest_at)}
                    </p>
                  </li>
                ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-500/15">
              <TrendingDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold leading-none">
                Bajaron de precio
              </CardTitle>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Mayor descuento porcentual primero; fecha de la última compra
              </p>
            </div>
          </CardHeader>
          <CardContent
            className="pt-0"
            role="region"
            aria-label="Productos con precio a la baja"
          >
            {data.price_decreases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasReceipts
                  ? 'No hay bajas recientes comparando con la compra previa.'
                  : 'Importa recibos para comparar precios en el tiempo.'}
              </p>
            ) : (
              <div className={PANTRY_CARD_LIST_SCROLL_CLASS}>
                <ul className="divide-y divide-border/50">
                {data.price_decreases.map((row, idx) => (
                  <li
                    key={`${row.label}-down-${idx}`}
                    className="py-2.5 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-medium leading-snug">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-sm font-bold font-mono tabular-nums text-green-600 dark:text-green-400">
                        {formatPercent(row.change_percent)}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatCurrency(row.previous_unit_price)} →{' '}
                      {formatCurrency(row.latest_unit_price)} · última compra{' '}
                      {formatDate(row.latest_at)}
                    </p>
                  </li>
                ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hasReceipts ? (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          role="region"
          aria-label="Destacados de tus recibos"
        >
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
                <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-none">
                  Última compra
                </CardTitle>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Fecha y total del recibo más reciente
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {highlights.last_purchase ? (
                <>
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {formatCurrency(highlights.last_purchase.total)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                    {formatDate(highlights.last_purchase.at)}
                    {highlights.last_purchase.title
                      ? ` · ${highlights.last_purchase.title}`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 dark:bg-slate-500/15">
                <History className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-none">
                  Primer recibo
                </CardTitle>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Inicio de tu historial en despensa
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {highlights.first_purchase ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {formatDate(highlights.first_purchase.at)}
                  {highlights.first_purchase.title
                    ? ` · ${highlights.first_purchase.title}`
                    : ''}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                <Receipt className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-none">
                  Recibo más caro
                </CardTitle>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Mayor total entre tus recibos
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {highlights.most_expensive_receipt ? (
                <>
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {formatCurrency(highlights.most_expensive_receipt.total)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                    {formatDate(highlights.most_expensive_receipt.at)}
                    {highlights.most_expensive_receipt.title
                      ? ` · ${highlights.most_expensive_receipt.title}`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
                <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-none">
                  Recibo más barato
                </CardTitle>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Menor total con monto &gt; 0
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {highlights.cheapest_receipt ? (
                <>
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {formatCurrency(highlights.cheapest_receipt.total)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                    {formatDate(highlights.cheapest_receipt.at)}
                    {highlights.cheapest_receipt.title
                      ? ` · ${highlights.cheapest_receipt.title}`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
                <Package className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-none">
                  Línea más cara
                </CardTitle>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  El artículo con mayor importe en una sola línea
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {highlights.largest_line_item ? (
                <>
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {formatCurrency(highlights.largest_line_item.line_total)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                    {highlights.largest_line_item.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDate(highlights.largest_line_item.at)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 dark:bg-cyan-500/15">
                <Scale className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-none">
                  Promedios por recibo
                </CardTitle>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Gasto medio por línea y líneas por ticket
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Por línea
                </p>
                <p className="text-sm font-bold font-mono tabular-nums">
                  {highlights.average_line_spend != null
                    ? formatCurrency(highlights.average_line_spend)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Líneas por recibo
                </p>
                <p className="text-sm font-bold font-mono tabular-nums">
                  {highlights.average_lines_per_receipt != null
                    ? highlights.average_lines_per_receipt.toLocaleString('es-MX', {
                        maximumFractionDigits: 2,
                      })
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <PantryInsightsCharts charts={data.charts} hasReceipts={hasReceipts} />
    </div>
  );
};
