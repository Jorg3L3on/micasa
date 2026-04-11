'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ListOrdered,
  Package,
  Receipt,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, getPantryInsights } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { PantryInsightsDto } from '@/types/pantry-insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PantryInsightsCharts } from '@/components/pantry/PantryInsightsCharts';
import { PantryMetricTile } from '@/components/pantry/PantryMetricTile';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const TOP_LIST_N = 8;

const formatPercent = (n: number | null): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};

const formatQty = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const PANTRY_CARD_LIST_SCROLL_CLASS =
  'max-h-[min(18rem,42vh)] overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]';

const PANTRY_CARD_SHELL =
  'overflow-hidden border-border/60 transition-shadow duration-200 hover:shadow-md';

const PANTRY_LIST_ROW =
  'rounded-lg px-2 py-2 -mx-1 transition-colors hover:bg-muted/40';

const PantrySectionLabel = ({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) => (
  <h2
    id={id}
    className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
  >
    <span
      className="h-0.5 w-8 shrink-0 rounded-full bg-linear-to-r from-fuchsia-500/90 via-violet-500/75 to-transparent dark:from-fuchsia-400/85 dark:via-violet-400/65"
      aria-hidden
    />
    {children}
  </h2>
);

export const PantryHomeInsights = () => {
  const { context } = useFinanceContext();
  const [data, setData] = useState<PantryInsightsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { receiptsHref, productsHref } = useMemo(() => {
    const q = buildOwnerQuery(context).toString();
    return {
      receiptsHref: q ? `/pantry/receipts?${q}` : '/pantry/receipts',
      productsHref: q ? `/pantry/products?${q}` : '/pantry/products',
    };
  }, [context]);

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
      <div className="space-y-6" aria-busy="true" aria-label="Cargando métricas">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Skeleton className="h-12 max-w-xl rounded-lg" />
          <Skeleton className="h-11 w-full max-w-md rounded-2xl sm:w-64" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 md:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-12">
          <Skeleton className="h-[24rem] rounded-xl xl:col-span-8" />
          <Skeleton className="h-[24rem] rounded-xl xl:col-span-4" />
        </div>
        <Skeleton className="h-[22rem] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/35 bg-card px-4 py-3 text-sm text-destructive shadow-sm"
      >
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { metrics, highlights } = data;
  const hasReceipts = metrics.receipt_count > 0;

  const topProducts = data.top_products.slice(0, TOP_LIST_N);
  const priceUps = data.price_increases.slice(0, TOP_LIST_N);
  const priceDowns = data.price_decreases.slice(0, TOP_LIST_N);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground/90">
          Resumen de gasto, productos y señales útiles según tus recibos en este
          contexto.
        </p>
        <nav
          className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-1.5 shadow-sm"
          aria-label="Accesos rápidos de despensa"
        >
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg border-border/70 bg-background/80 px-3 text-foreground shadow-none hover:bg-accent/60"
            asChild
          >
            <Link href={receiptsHref}>
              <Receipt className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
              Recibos
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg border-border/70 bg-background/80 px-3 text-foreground shadow-none hover:bg-accent/60"
            asChild
          >
            <Link href={productsHref}>
              <Package className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              Productos
            </Link>
          </Button>
        </nav>
      </div>

      <section
        className="space-y-2"
        aria-labelledby="pantry-resumen-heading"
      >
        <PantrySectionLabel id="pantry-resumen-heading">Resumen</PantrySectionLabel>
        <div
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 md:gap-4"
          role="region"
          aria-label="Resumen de gasto en despensa"
        >
          <PantryMetricTile
            icon={TrendingDown}
            label="Gasto total"
            value={formatCurrency(metrics.total_spend)}
            accent="violet"
          />
          <PantryMetricTile
            icon={Receipt}
            label="Recibos"
            value={metrics.receipt_count.toLocaleString('es-MX')}
            accent="blue"
          />
          <PantryMetricTile
            icon={Package}
            label="Productos distintos"
            value={metrics.distinct_products.toLocaleString('es-MX')}
            accent="emerald"
          />
          <PantryMetricTile
            icon={CircleDollarSign}
            label="Ticket promedio"
            value={
              metrics.average_receipt_spend != null
                ? formatCurrency(metrics.average_receipt_spend)
                : '—'
            }
            accent="amber"
          />
          <PantryMetricTile
            icon={ListOrdered}
            label="Líneas de compra"
            value={metrics.total_line_items.toLocaleString('es-MX')}
            accent="slate"
          />
          <PantryMetricTile
            icon={BarChart3}
            label="Precio unitario promedio"
            value={
              metrics.average_unit_price != null
                ? formatCurrency(metrics.average_unit_price)
                : '—'
            }
            accent="sky"
          />
        </div>
      </section>

      {!hasReceipts ? (
        <Card
          className={cn(
            PANTRY_CARD_SHELL,
            'relative isolate border-emerald-500/20 dark:border-emerald-500/25',
          )}
        >
          <div
            className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full bg-emerald-500/[0.07] blur-3xl dark:bg-emerald-500/[0.1]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-12 left-0 h-32 w-32 rounded-full bg-violet-500/[0.06] blur-3xl dark:bg-violet-500/[0.08]"
            aria-hidden
          />
          <CardContent className="relative flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/15 dark:bg-emerald-500/15 dark:ring-emerald-500/20">
                <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  Empieza con un recibo
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Sube un PDF, CSV o TXT para ver ranking, comparativas de precio
                  y gráficas en este contexto.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
              <Button type="button" className="rounded-xl" asChild>
                <Link href={receiptsHref}>Ir a recibos</Link>
              </Button>
              <Button type="button" variant="ghost" className="h-9" asChild>
                <Link href={productsHref}>Catálogo de productos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasReceipts ? (
        <section className="space-y-2" aria-labelledby="pantry-panorama-heading">
          <PantrySectionLabel id="pantry-panorama-heading">
            Panorama rápido
          </PantrySectionLabel>
          <div className="grid gap-5 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <PantryInsightsCharts charts={data.charts} hasReceipts={hasReceipts} />
            </div>

            <Card
              className={cn(PANTRY_CARD_SHELL, 'xl:col-span-4')}
              role="region"
              aria-labelledby="pantry-lecturas-heading"
            >
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </span>
                <div className="min-w-0">
                  <CardTitle
                    id="pantry-lecturas-heading"
                    className="text-sm font-semibold leading-none"
                  >
                    Lecturas rápidas
                  </CardTitle>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Indicadores clave en formato compacto
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Última compra
                    </p>
                    {highlights.last_purchase ? (
                      <>
                        <p className="mt-1 font-mono text-base font-bold tabular-nums">
                          {formatCurrency(highlights.last_purchase.total)}
                        </p>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          <CalendarDays
                            className="mr-1 inline h-3 w-3 align-text-bottom text-muted-foreground"
                            aria-hidden
                          />
                          {formatDate(highlights.last_purchase.at)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ticket más bajo
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {highlights.cheapest_receipt
                        ? formatCurrency(highlights.cheapest_receipt.total)
                        : '—'}
                    </p>
                    {highlights.cheapest_receipt ? (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        {formatDate(highlights.cheapest_receipt.at)}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ticket más alto
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {highlights.most_expensive_receipt
                        ? formatCurrency(highlights.most_expensive_receipt.total)
                        : '—'}
                    </p>
                    {highlights.most_expensive_receipt ? (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        {formatDate(highlights.most_expensive_receipt.at)}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Gasto por línea
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums">
                      {highlights.average_line_spend != null
                        ? formatCurrency(highlights.average_line_spend)
                        : '—'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Líneas por recibo
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums">
                      {highlights.average_lines_per_receipt != null
                        ? highlights.average_lines_per_receipt.toLocaleString('es-MX', {
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Línea más cara
                    </p>
                    {highlights.largest_line_item ? (
                      <>
                        <p className="mt-1 font-mono text-base font-bold tabular-nums">
                          {formatCurrency(highlights.largest_line_item.line_total)}
                        </p>
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {highlights.largest_line_item.label}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {hasReceipts ? (
        <Tabs defaultValue="ranking" className="w-full">
          <Card
            className={cn(PANTRY_CARD_SHELL)}
            role="region"
            aria-label="Productos y precios"
          >
            <CardHeader className="space-y-3 pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold leading-none">
                      Productos y precios
                    </CardTitle>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Ranking de compras y cambios de precio (hasta {TOP_LIST_N}{' '}
                      ítems)
                    </p>
                  </div>
                </div>
                <TabsList
                  className="h-9 w-full shrink-0 sm:w-auto"
                  aria-label="Vista de lista"
                >
                  <TabsTrigger value="ranking" className="gap-1 px-2.5 text-xs sm:text-sm">
                    Ranking
                  </TabsTrigger>
                  <TabsTrigger value="up" className="gap-1 px-2.5 text-xs sm:text-sm">
                    Al alza
                    {data.price_increases.length > 0 ? (
                      <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
                        ({data.price_increases.length})
                      </span>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="down" className="gap-1 px-2.5 text-xs sm:text-sm">
                    A la baja
                    {data.price_decreases.length > 0 ? (
                      <span className="text-[10px] font-normal text-muted-foreground tabular-nums">
                        ({data.price_decreases.length})
                      </span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <TabsContent value="ranking" className="mt-0">
                {topProducts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/55 bg-muted/10 px-4 py-6 text-center dark:bg-muted/15">
                    <p className="text-sm text-muted-foreground">
                      Aún no hay datos. Importa un recibo para ver el ranking.
                    </p>
                  </div>
                ) : (
                  <div className={PANTRY_CARD_LIST_SCROLL_CLASS}>
                    <ul className="space-y-0.5" aria-label="Productos más comprados">
                      {topProducts.map((p, idx) => (
                        <li
                          key={`${p.label}-${idx}`}
                          className={cn(PANTRY_LIST_ROW, 'flex flex-col gap-0.5')}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 text-sm font-medium leading-snug">
                              {p.label}
                            </span>
                            <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
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
              </TabsContent>

              <TabsContent value="up" className="mt-0">
                {priceUps.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/55 bg-muted/10 px-4 py-6 text-center dark:bg-muted/15">
                    <p className="text-sm text-muted-foreground">
                      No hay suficientes compras repetidas con precio comparable.
                    </p>
                  </div>
                ) : (
                  <div className={PANTRY_CARD_LIST_SCROLL_CLASS}>
                    <ul className="space-y-0.5" aria-label="Productos con precio al alza">
                      {priceUps.map((row, idx) => (
                        <li
                          key={`${row.label}-up-${idx}`}
                          className={PANTRY_LIST_ROW}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 text-sm font-medium leading-snug">
                              {row.label}
                            </span>
                            <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
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
              </TabsContent>

              <TabsContent value="down" className="mt-0">
                {priceDowns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/55 bg-muted/10 px-4 py-6 text-center dark:bg-muted/15">
                    <p className="text-sm text-muted-foreground">
                      No hay bajas recientes comparando con la compra previa.
                    </p>
                  </div>
                ) : (
                  <div className={PANTRY_CARD_LIST_SCROLL_CLASS}>
                    <ul className="space-y-0.5" aria-label="Productos con precio a la baja">
                      {priceDowns.map((row, idx) => (
                        <li
                          key={`${row.label}-down-${idx}`}
                          className={PANTRY_LIST_ROW}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 text-sm font-medium leading-snug">
                              {row.label}
                            </span>
                            <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-green-600 dark:text-green-400">
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
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      ) : null}
    </div>
  );
};
