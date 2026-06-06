'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  CreditCard,
  Landmark,
  LineChart,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinanceContext } from '@/context/finance-context';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  LiquidityCardUtilizationItem,
  LiquidityProjectionResponse,
} from '@/types/catalog';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import { CreditCardInstallmentProjectionBlock } from '@/components/credit-cards/CreditCardInstallmentProjectionBlock';

const defaultUntilYmdUtc = (): string => {
  const d = new Date();
  const currentYear = d.getUTCFullYear();
  return `${currentYear}-12-31`;
};

const formatDueLabelShort = (ymd: string) => {
  const [y, m, day] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('es-MX', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[90px] rounded-xl bg-muted/40 border border-border/30" />
        ))}
      </div>
      <div className="h-28 rounded-xl bg-muted/40 border border-border/30" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('rounded-xl bg-muted/35 border border-border/25', i === 0 ? 'h-16' : 'h-14')} />
        ))}
      </div>
    </div>
  );
}

export function LiquidityProjectionTab() {
  const { context } = useFinanceContext();

  const [untilInput] = useState(defaultUntilYmdUtc);
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
          omitZero: true,
          includeUnpaid: true,
          includeTemplates: true,
        },
        context,
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la proyección');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [context, untilInput]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasStaticShortfall = data?.summary.first_cumulative_shortfall_date != null;
  const hasProjectedShortfall = data?.summary.first_projected_shortfall_date != null;
  const hasShortfall = hasProjectedShortfall || hasStaticShortfall;
  const chartRows = useMemo(
    () =>
      (data?.monthly_series ?? []).map((month) => ({
        label: formatMonthLabel(month.month_key),
        income: month.expected_income_total,
        msi: month.msi_debt_total,
        loans: month.loan_payment_total,
        templates: month.expense_template_total,
        other: month.other_debt_components_total,
        remaining: month.monthly_remaining,
        totalDebt:
          month.msi_debt_total +
          month.loan_payment_total +
          month.expense_template_total +
          month.other_debt_components_total,
      })),
    [data?.monthly_series],
  );
  const modelNotes = useMemo(() => {
    if (!data) return [];
    const notes = [
      'La fila "Restante" se calcula por mes como: ingreso esperado - (MSI + préstamos + plantillas + otros cargos).',
      'Los préstamos pagados desde billetera aparecen como obligaciones; los de nómina reducen el ingreso esperado y no duplican una salida de billetera.',
      'Las tarjetas se proyectan con cortes y vencimientos reales; no se inventan compras futuras fuera de lo ya registrado.',
      'Neto estático usa solo liquidez actual; neto proyectado suma ingresos esperados hasta el horizonte.',
      'La liquidez actual (efectivo + débito) es una foto de hoy y se mantiene como base para ambos netos.',
    ];
    if (data.options.include_unpaid_expenses) {
      notes.push('Se incluyen gastos impagos con fecha de pago registrada o fin de quincena cuando no hay fecha.');
    }
    if (data.options.include_expense_templates) {
      notes.push('Se incluyen plantillas pendientes en quincenas ya creadas como montos estimados.');
    }
    if (data.options.stress_cycle_percent > 0) {
      notes.push(
        `Escenario de estrés activo: se agrega ${data.options.stress_cycle_percent}% del ciclo en curso cuando aplica.`,
      );
    }
    return notes;
  }, [data]);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'flex items-center gap-4 rounded-2xl border px-4 py-3 shadow-sm',
          hasShortfall
            ? 'border-destructive/25 bg-gradient-to-r from-destructive/5 via-transparent to-transparent dark:from-destructive/8'
            : 'border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent dark:from-primary/8',
        )}
      >
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors',
            hasShortfall
              ? 'bg-destructive/10 ring-destructive/20 dark:bg-destructive/15'
              : 'bg-emerald-500/10 ring-emerald-500/20 dark:bg-emerald-500/15 dark:ring-emerald-500/25',
          )}
        >
          <LineChart
            className={cn(
              'h-5 w-5',
              hasShortfall
                ? 'text-destructive'
                : 'text-emerald-600 dark:text-emerald-400',
            )}
          />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black tracking-tight">
              Proyección de liquidez
            </h2>
            {data && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider leading-none',
                  hasShortfall
                    ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                    : 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-400',
                )}
              >
                {hasShortfall ? '⚠ Déficit' : '✓ Saludable'}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">
            Vista mensual de ingresos esperados, deudas y efectivo restante para tomar decisiones.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && !data && <LoadingSkeleton />}

      {data && (
        <>
          <div
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
            role="region"
            aria-label="Resumen de liquidez"
          >
            <div className="relative rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 px-3 py-3 dark:from-emerald-500/12 dark:to-emerald-500/5">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25 dark:bg-emerald-500/20">
                  <Landmark className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                  Liquidez hoy
                </span>
              </div>
              <p className="font-mono text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300 leading-tight">
                {formatCurrency(data.summary.funding_total)}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Efectivo + débito
              </p>
            </div>

            <div className="relative rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-violet-500/3 px-3 py-3 dark:from-violet-500/12 dark:to-violet-500/5">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25 dark:bg-violet-500/20">
                  <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80">
                  Obligaciones
                </span>
              </div>
              <p className="font-mono text-2xl font-black tabular-nums leading-tight">
                {formatCurrency(data.summary.total_obligations_due_on_or_before_until)}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Al {data.until}
              </p>
            </div>

            <div
              className={cn(
                'relative rounded-xl border px-3 py-3',
                data.summary.net_liquidity_versus_obligations >= 0
                  ? 'border-blue-500/20 bg-gradient-to-br from-blue-500/8 to-blue-500/3 dark:from-blue-500/12 dark:to-blue-500/5'
                  : 'border-destructive/20 bg-gradient-to-br from-destructive/8 to-destructive/3 dark:from-destructive/12 dark:to-destructive/5',
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1',
                  data.summary.net_liquidity_versus_obligations >= 0
                    ? 'bg-blue-500/15 ring-blue-500/25 dark:bg-blue-500/20'
                    : 'bg-destructive/15 ring-destructive/25 dark:bg-destructive/20',
                )}>
                  <LineChart
                    className={cn(
                      'h-3.5 w-3.5',
                      data.summary.net_liquidity_versus_obligations >= 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-destructive',
                    )}
                  />
                </span>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-wider',
                  data.summary.net_liquidity_versus_obligations >= 0
                    ? 'text-blue-600/80 dark:text-blue-400/80'
                    : 'text-destructive/80',
                )}>
                  Neto estático
                </span>
              </div>
              <p
                className={cn(
                  'font-mono text-2xl font-black tabular-nums leading-tight',
                  data.summary.net_liquidity_versus_obligations < 0
                    ? 'text-destructive'
                    : 'text-foreground',
                )}
              >
                {formatCurrency(data.summary.net_liquidity_versus_obligations)}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Sin ingresos futuros
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {hasStaticShortfall
                  ? `Caída: ${formatDueLabelShort(data.summary.first_cumulative_shortfall_date!)}`
                  : 'Sin caída en el horizonte'}
              </p>
            </div>

            <div
              className={cn(
                'relative rounded-xl border px-3 py-3',
                data.summary.net_liquidity_versus_obligations_including_income >= 0
                  ? 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 dark:from-emerald-500/12 dark:to-emerald-500/5'
                  : 'border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-amber-500/3 dark:from-amber-500/12 dark:to-amber-500/5',
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1',
                  data.summary.net_liquidity_versus_obligations_including_income >= 0
                    ? 'bg-emerald-500/15 ring-emerald-500/25 dark:bg-emerald-500/20'
                    : 'bg-amber-500/15 ring-amber-500/25 dark:bg-amber-500/20',
                )}>
                  <CalendarClock
                    className={cn(
                      'h-3.5 w-3.5',
                      data.summary.net_liquidity_versus_obligations_including_income >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400',
                    )}
                  />
                </span>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-wider',
                  data.summary.net_liquidity_versus_obligations_including_income >= 0
                    ? 'text-emerald-600/80 dark:text-emerald-400/80'
                    : 'text-amber-600/80 dark:text-amber-400/80',
                )}>
                  Neto proyectado
                </span>
              </div>
              <p
                className={cn(
                  'font-mono text-2xl font-black tabular-nums leading-tight',
                  data.summary.net_liquidity_versus_obligations_including_income < 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300',
                )}
              >
                {formatCurrency(data.summary.net_liquidity_versus_obligations_including_income)}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Incluye ingresos esperados
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {hasProjectedShortfall
                  ? `Caída: ${formatDueLabelShort(data.summary.first_projected_shortfall_date!)}`
                  : 'Sin caída en el horizonte'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3" role="region" aria-label="Gráficas de liquidez mensual">
            <Card className="overflow-hidden border-border/60">
              <CardContent className="px-3 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </span>
                  <p className="text-sm font-semibold leading-none">Ingreso vs deudas</p>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartRows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.2)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Area type="monotone" dataKey="income" name="Ingreso" stroke="#2563eb" fill="#3b82f633" />
                      <Area type="monotone" dataKey="totalDebt" name="Deudas" stroke="#7c3aed" fill="#8b5cf633" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/60">
              <CardContent className="px-3 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                    <BarChart3 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  </span>
                  <p className="text-sm font-semibold leading-none">Composición de deuda</p>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.2)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="msi" stackId="debt" name="MSI" fill="#7c3aed" />
                      <Bar dataKey="loans" stackId="debt" name="Préstamos" fill="#0ea5e9" />
                      <Bar dataKey="templates" stackId="debt" name="Plantillas" fill="#f59e0b" />
                      <Bar dataKey="other" stackId="debt" name="Otros" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/60">
              <CardContent className="px-3 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
                    <LineChart className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <p className="text-sm font-semibold leading-none">Restante mensual</p>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={chartRows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.2)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="remaining" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div
              className="overflow-hidden rounded-xl border border-border/40 shadow-sm"
              role="region"
              aria-label="Resumen de uso de tarjetas"
            >
              <div className="flex items-center gap-2.5 border-b border-border/40 bg-gradient-to-r from-violet-500/8 to-violet-500/3 px-3 py-2.5 dark:from-violet-500/12">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25 dark:bg-violet-500/20">
                  <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </span>
                <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80">
                  Riesgo de uso de tarjetas
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {data.card_utilization_summary.dangerous_count} en riesgo
                </span>
              </div>
              {data.card_utilization_summary.cards.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No hay tarjetas de crédito o departamentales activas.
                </p>
              ) : (
                <ul className="divide-y divide-border/30">
                  {data.card_utilization_summary.cards.map((card: LiquidityCardUtilizationItem) => {
                    const isDanger = card.is_danger;
                    const isUnrated = card.risk_level === 'unrated_no_limit';
                    const utilization = card.utilization_percent ?? 0;
                    const isWarning = !isUnrated && !isDanger && utilization > 50;
                    return (
                      <li key={card.card_id} className={cn(isDanger && 'border-l-[3px] border-l-destructive/60')}>
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <span className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
                            isDanger
                              ? 'bg-destructive/10 ring-destructive/30'
                              : isWarning
                                ? 'bg-amber-500/10 ring-amber-500/25'
                                : isUnrated
                                  ? 'bg-muted/60 ring-border/40'
                                  : 'bg-emerald-500/10 ring-emerald-500/25',
                          )}>
                            <CreditCard className={cn(
                              'h-3.5 w-3.5',
                              isDanger
                                ? 'text-destructive'
                                : isWarning
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : isUnrated
                                    ? 'text-muted-foreground'
                                    : 'text-emerald-600 dark:text-emerald-400',
                            )} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{card.card_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {PAYMENT_METHOD_LABELS[
                                card.card_type as keyof typeof PAYMENT_METHOD_LABELS
                              ] ?? card.card_type}
                            </p>
                          </div>
                          <span className={cn(
                            'rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1',
                            isDanger
                              ? 'bg-destructive/10 text-destructive ring-destructive/20'
                              : isWarning
                                ? 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300'
                                : isUnrated
                                  ? 'bg-muted text-muted-foreground ring-border/40'
                                  : 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
                          )}>
                            {isUnrated ? 'Sin límite' : `${utilization.toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="px-3 pb-2.5">
                          {isUnrated ? (
                            <p className="text-[10px] text-muted-foreground">
                              Tarjeta sin límite de crédito válido. Riesgo no evaluado.
                            </p>
                          ) : (
                            <>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all duration-500',
                                    isDanger
                                      ? 'bg-destructive'
                                      : isWarning
                                        ? 'bg-amber-500'
                                        : 'bg-gradient-to-r from-emerald-500 to-emerald-400',
                                  )}
                                  style={{ width: `${Math.min(100, utilization)}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[10px] font-mono tabular-nums text-muted-foreground">
                                {formatCurrency(card.used_amount)} de {formatCurrency(card.credit_limit ?? 0)}
                              </p>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div role="region" aria-label="Items MSI">
              <CreditCardInstallmentProjectionBlock />
            </div>
          </div>

          <div role="region" aria-label="Serie mensual de liquidez">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 dark:bg-blue-500/15 dark:ring-blue-500/25">
                <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold leading-none">Flujo mensual proyectado</h3>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold tabular-nums text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300">
                    {data.monthly_series.length}
                  </span>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/40 shadow-sm">
              <div className="hidden border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-7">
                <span>Mes</span>
                <span className="text-right">Ingreso</span>
                <span className="text-right">MSI</span>
                <span className="text-right">Préstamos</span>
                <span className="text-right">Plantillas</span>
                <span className="text-right">Otros</span>
                <span className="text-right">Restante</span>
              </div>
              {data.monthly_series.map((month) => {
                const noDebt =
                  month.msi_debt_total === 0 &&
                  month.loan_payment_total === 0 &&
                  month.expense_template_total === 0 &&
                  month.other_debt_components_total === 0;
                const noIncome = month.expected_income_total === 0;
                return (
                  <div
                    key={month.month_key}
                    className={cn(
                      'border-b border-border/30 px-3 py-3 text-sm last:border-b-0',
                      month.monthly_remaining < 0 && 'border-l-[3px] border-l-destructive/50',
                    )}
                  >
                    <div className="grid gap-2 md:grid-cols-7 md:items-center">
                      <span className="font-semibold">{formatMonthLabel(month.month_key)}</span>
                      <div className="flex items-center justify-between gap-3 md:block md:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">Ingreso</span>
                        <span className="font-mono tabular-nums">{formatCurrency(month.expected_income_total)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:block md:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">MSI</span>
                        <span className="font-mono tabular-nums">{formatCurrency(month.msi_debt_total)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:block md:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">Préstamos</span>
                        <span className="font-mono tabular-nums">{formatCurrency(month.loan_payment_total)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:block md:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">Plantillas</span>
                        <span className="font-mono tabular-nums">{formatCurrency(month.expense_template_total)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:block md:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">Otros</span>
                        <span className="font-mono tabular-nums">{formatCurrency(month.other_debt_components_total)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:block md:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">Restante</span>
                        <span
                          className={cn(
                            'font-mono tabular-nums font-bold',
                            month.monthly_remaining < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
                          )}
                        >
                          {formatCurrency(month.monthly_remaining)}
                        </span>
                      </div>
                    </div>
                    {(noIncome || noDebt) && (
                      <span className="text-[10px] text-muted-foreground md:col-span-6">
                        {noIncome && noDebt
                          ? 'Sin ingresos ni obligaciones proyectadas para este mes.'
                          : noIncome
                            ? 'Sin ingresos proyectados para este mes.'
                            : 'Sin obligaciones proyectadas para este mes.'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Collapsible className="group/assume rounded-xl border border-dashed border-border/50 bg-muted/10">
            <CollapsibleTrigger
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ver cómo leer esta proyección"
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/assume:rotate-180" />
              Cómo leer esta proyección
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="px-4 pb-4 space-y-2 text-[11px] text-muted-foreground">
                {modelNotes.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                    {a}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
