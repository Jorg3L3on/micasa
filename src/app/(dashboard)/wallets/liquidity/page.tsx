'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  CreditCard,
  FileDown,
  Landmark,
  LineChart,
  Receipt,
  Store,
} from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  downloadLiquidityProjectionCsv,
  fetchLiquidityProjection,
} from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type {
  LiquidityProjectionObligationItem,
  LiquidityProjectionResponse,
} from '@/types/catalog';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';

const defaultUntilYmdUtc = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 180);
  return d.toISOString().split('T')[0];
};

const formatDueLabel = (ymd: string) => {
  const [y, m, day] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const WALLET_TYPE_ICON: Record<string, typeof CreditCard> = {
  CREDIT_CARD: CreditCard,
  DEPARTMENT_STORE_CARD: Store,
};

const SOURCE_LABEL: Record<
  LiquidityProjectionObligationItem['source'],
  string
> = {
  credit_card_statement: 'Estado TC',
  unpaid_expense: 'Gasto impago',
  expense_template: 'Plantilla (estimado)',
};

export default function LiquidityProjectionPage() {
  const { context } = useFinanceContext();
  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);
  const [untilInput, setUntilInput] = useState(defaultUntilYmdUtc);
  const [showZeroLines, setShowZeroLines] = useState(false);
  const [stressPercent, setStressPercent] = useState(0);
  const [includeUnpaid, setIncludeUnpaid] = useState(true);
  const [includeTemplates, setIncludeTemplates] = useState(false);
  const [data, setData] = useState<LiquidityProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLiquidityProjection(
        {
          until: untilInput,
          omitZero: !showZeroLines,
          stressCyclePercent: stressPercent > 0 ? stressPercent : undefined,
          includeUnpaid,
          includeTemplates,
        },
        context,
      );
      setData(res);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo cargar la proyección',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    context,
    untilInput,
    showZeroLines,
    stressPercent,
    includeUnpaid,
    includeTemplates,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefreshClick = () => {
    void load();
  };

  const handleDownloadCsv = async () => {
    if (!context || (context.type === 'user' && context.id === 0)) return;
    try {
      await downloadLiquidityProjectionCsv(
        {
          until: untilInput,
          omitZero: !showZeroLines,
          stressCyclePercent: stressPercent > 0 ? stressPercent : undefined,
          includeUnpaid,
          includeTemplates,
        },
        context,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo descargar el CSV',
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
            <LineChart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-none">
              Proyección de liquidez
            </h1>
            <p className="mt-1 text-[10px] text-muted-foreground max-w-md">
              Compara tu efectivo y débito con pagos a estado, gastos impagos en
              efectivo/débito y, si activas la opción, huecos de plantillas por
              quincena. Las fechas de corte coinciden con el motor UTC de la
              app (pueden diferir un día del calendario local).
            </p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-border/60">
        <CardContent className="pt-6 space-y-4">
          <div
            className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
            role="search"
            aria-label="Parámetros de proyección"
          >
            <div className="space-y-2 max-w-xs">
              <Label
                htmlFor="liquidity-until"
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Hasta (vencimiento inclusive)
              </Label>
              <Input
                id="liquidity-until"
                type="date"
                value={untilInput}
                onChange={(e) => setUntilInput(e.target.value)}
                className="font-mono tabular-nums"
                aria-label="Fecha límite de la proyección"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="liquidity-show-zero"
                  checked={showZeroLines}
                  onCheckedChange={(v) => setShowZeroLines(v === true)}
                  aria-label="Mostrar partidas con pago a estado en cero"
                />
                <Label
                  htmlFor="liquidity-show-zero"
                  className="text-sm font-normal cursor-pointer"
                >
                  Mostrar partidas en $0
                </Label>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRefreshClick}
                disabled={loading}
                aria-label="Recalcular proyección"
              >
                Actualizar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDownloadCsv()}
                disabled={loading}
                aria-label="Descargar proyección en CSV"
              >
                <FileDown className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-4 pt-2 border-t border-border/60 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-2 max-w-[140px]">
              <Label
                htmlFor="liquidity-stress"
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Estrés ciclo (%)
              </Label>
              <Input
                id="liquidity-stress"
                type="number"
                min={0}
                max={100}
                step={1}
                value={stressPercent}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setStressPercent(
                    e.target.value === '' || Number.isNaN(n)
                      ? 0
                      : Math.min(100, Math.max(0, Math.round(n))),
                  );
                }}
                className="font-mono tabular-nums"
                aria-label="Porcentaje de estrés sobre gasto del ciclo cuando el estado cerrado está en cero"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="liquidity-unpaid"
                  checked={includeUnpaid}
                  onCheckedChange={(v) => setIncludeUnpaid(v === true)}
                  aria-label="Incluir gastos impagos en efectivo o débito"
                />
                <Label
                  htmlFor="liquidity-unpaid"
                  className="text-sm font-normal cursor-pointer"
                >
                  Gastos impagos (efectivo/débito)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="liquidity-templates"
                  checked={includeTemplates}
                  onCheckedChange={(v) => setIncludeTemplates(v === true)}
                  aria-label="Incluir estimación por plantillas sin gasto generado"
                />
                <Label
                  htmlFor="liquidity-templates"
                  className="text-sm font-normal cursor-pointer"
                >
                  Plantillas sin gasto en la quincena
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          className="rounded-lg border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Cargando proyección…
        </p>
      )}

      {data && (
        <>
          {data.summary.first_cumulative_shortfall_date != null && (
            <div
              className="rounded-lg border border-l-[3px] border-l-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10 px-3 py-2.5 flex gap-2 items-start"
              role="status"
              aria-live="polite"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Colchón insuficiente con saldos actuales
                </p>
                <p className="text-sm mt-1">
                  El acumulado de pagos supera tu liquidez (efectivo + débito)
                  a partir del{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {formatDueLabel(
                      data.summary.first_cumulative_shortfall_date,
                    )}
                  </span>
                  . Revisa los hitos siguientes o aporta liquidez antes de esa
                  fecha.
                </p>
              </div>
            </div>
          )}

          <div
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            role="region"
            aria-label="Resumen de liquidez"
          >
            <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/8 px-2.5 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 dark:bg-emerald-500/15 shrink-0">
                  <Landmark className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Liquidez (foto actual)
                </span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums">
                {formatCurrency(data.summary.funding_total)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Efectivo + tarjetas de débito
              </p>
            </div>

            <div className="rounded-lg border border-l-[3px] border-l-violet-500/50 bg-violet-500/5 dark:bg-violet-500/8 px-2.5 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15 shrink-0">
                  <CreditCard className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Obligaciones al {data.until}
                </span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums">
                {formatCurrency(
                  data.summary.total_obligations_due_on_or_before_until,
                )}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Suma de partidas en el horizonte (según opciones)
              </p>
            </div>

            <div
              className={cn(
                'rounded-lg border border-l-[3px] px-2.5 py-2',
                data.summary.net_liquidity_versus_obligations >= 0
                  ? 'border-l-blue-500/50 bg-blue-500/5 dark:bg-blue-500/8'
                  : 'border-l-destructive/50 bg-destructive/5',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-md shrink-0',
                    data.summary.net_liquidity_versus_obligations >= 0
                      ? 'bg-blue-500/10 dark:bg-blue-500/15'
                      : 'bg-destructive/10',
                  )}
                >
                  <LineChart
                    className={cn(
                      'h-3 w-3',
                      data.summary.net_liquidity_versus_obligations >= 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-destructive',
                    )}
                  />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Neto vs obligaciones
                </span>
              </div>
              <p
                className={cn(
                  'text-lg font-bold font-mono tabular-nums',
                  data.summary.net_liquidity_versus_obligations < 0 &&
                    'text-destructive',
                )}
              >
                {formatCurrency(data.summary.net_liquidity_versus_obligations)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Liquidez menos total debido
              </p>
            </div>

            <div className="rounded-lg border border-l-[3px] border-l-amber-500/50 bg-amber-500/5 dark:bg-amber-500/8 px-2.5 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 dark:bg-amber-500/15 shrink-0">
                  <CalendarClock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Falta cubrir
                </span>
              </div>
              <p
                className={cn(
                  'text-lg font-bold font-mono tabular-nums',
                  data.summary.shortfall_versus_funding > 0 && 'text-destructive',
                )}
              >
                {formatCurrency(data.summary.shortfall_versus_funding)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Respecto a saldos actuales
              </p>
            </div>
          </div>

          <div
            className="rounded-lg border border-border/60 overflow-hidden"
            role="region"
            aria-label="Billeteras de liquidez"
          >
            <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Efectivo y débito incluidos
              </p>
            </div>
            {data.funding_wallets.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No hay billeteras de efectivo o débito activas en este contexto.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {data.funding_wallets.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="text-sm truncate">{w.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {PAYMENT_METHOD_LABELS[
                        w.type as keyof typeof PAYMENT_METHOD_LABELS
                      ] ?? w.type}
                    </span>
                    <span className="text-sm font-mono tabular-nums font-semibold shrink-0">
                      {formatCurrency(w.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div role="region" aria-label="Hitos por fecha de vencimiento">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                <CalendarClock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </span>
              <div>
                <h2 className="text-sm font-semibold leading-none">
                  Hitos de pago
                </h2>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Referencia al {data.as_of} · Hasta {data.until}
                </p>
              </div>
            </div>

            {data.milestones.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No hay vencimientos con monto en este horizonte
                  {showZeroLines ? '' : ' (activa “Mostrar partidas en $0” para ver más)'}
                  .
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {data.milestones.map((m) => (
                  <li key={m.due_date}>
                    <Collapsible className="group/milestone rounded-lg border border-border/60 overflow-hidden bg-card">
                      <CollapsibleTrigger
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Vencimiento ${m.due_date}, total ${formatCurrency(m.total_due)}`}
                      >
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/milestone:rotate-180" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-sm font-semibold">
                              {formatDueLabel(m.due_date)}
                            </span>
                            {m.is_past_due && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-destructive">
                                Vencido
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-muted-foreground font-mono tabular-nums">
                            Acumulado:{' '}
                            {formatCurrency(m.cumulative_due_through_date)} ·
                            Colchón: {formatCurrency(m.liquidity_headroom)}
                          </p>
                        </div>
                        <span className="text-sm font-bold font-mono tabular-nums shrink-0">
                          {formatCurrency(m.total_due)}
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ul className="border-t border-border/60 divide-y divide-border/60 bg-muted/10">
                          {m.obligations.map((o) => {
                            const Icon =
                              o.source === 'unpaid_expense'
                                ? Receipt
                                : (WALLET_TYPE_ICON[o.wallet_type] ??
                                  CreditCard);
                            const rowKey = `${o.source}-${o.wallet_id}-${o.statement_end}-${o.expense_id ?? ''}-${o.expense_template_id ?? ''}`;
                            const secondary =
                              o.source === 'credit_card_statement'
                                ? `Estado ${o.statement_start} → ${o.statement_end}`
                                : o.source === 'unpaid_expense'
                                  ? (o.expense_description ?? 'Gasto impago')
                                  : (o.template_name ?? 'Plantilla');

                            const rowClass =
                              'flex w-full items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors';

                            const rowBody = (
                              <>
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
                                  <Icon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="text-sm font-medium truncate">
                                      {o.wallet_name}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-normal px-1.5 py-0"
                                    >
                                      {SOURCE_LABEL[o.source]}
                                    </Badge>
                                    {o.is_estimate && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[9px] font-normal px-1.5 py-0"
                                      >
                                        Estimado
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-muted-foreground font-mono tabular-nums truncate">
                                    {secondary}
                                    {o.stress_adjustment != null &&
                                      o.stress_adjustment > 0 && (
                                        <span className="ml-1 text-amber-700 dark:text-amber-300">
                                          +estrés{' '}
                                          {formatCurrency(o.stress_adjustment)}
                                        </span>
                                      )}
                                  </p>
                                </div>
                                <span className="text-sm font-mono tabular-nums font-semibold shrink-0">
                                  {formatCurrency(o.next_due_payment)}
                                </span>
                              </>
                            );

                            if (o.source === 'credit_card_statement') {
                              return (
                                <li key={rowKey}>
                                  <Link
                                    href={`/credit-cards/${o.wallet_id}${ownerQueryString}`}
                                    className={rowClass}
                                    aria-label={`${o.wallet_name}, ${SOURCE_LABEL[o.source]} ${formatCurrency(o.next_due_payment)}`}
                                  >
                                    {rowBody}
                                  </Link>
                                </li>
                              );
                            }

                            if (o.source === 'unpaid_expense') {
                              return (
                                <li key={rowKey}>
                                  <Link
                                    href="/transactions"
                                    className={rowClass}
                                    aria-label={`Gasto impago ${formatCurrency(o.next_due_payment)}`}
                                  >
                                    {rowBody}
                                  </Link>
                                </li>
                              );
                            }

                            return (
                              <li key={rowKey} className={rowClass}>
                                {rowBody}
                              </li>
                            );
                          })}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Collapsible className="group/assume rounded-lg border border-border/60 border-dashed">
            <CollapsibleTrigger
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              aria-label="Ver supuestos del modelo"
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/assume:rotate-180" />
              Supuestos del modelo
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="px-3 pb-3 space-y-1.5 text-[11px] text-muted-foreground list-disc pl-6">
                {data.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
