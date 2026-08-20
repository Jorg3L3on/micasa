'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  CreditCard,
  Landmark,
  TrendingUp,
  BarChart3,
  Wallet,
} from 'lucide-react';
import {
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
import { LiquidityGuideHero } from '@/components/wallets/liquidity/LiquidityGuideHero';
import { LiquidityVisualMetric } from '@/components/wallets/liquidity/LiquidityVisualMetric';
import {
  formatLiquidityDateLabel,
  getCardRiskLabel,
} from '@/components/wallets/liquidity/liquidity-personalization';

const defaultUntilYmdUtc = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}-12-31`;
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
      <div className="h-28 rounded-2xl bg-muted/40 border border-border/30" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-xl bg-muted/40 border border-border/30" />
        <div className="h-32 rounded-xl bg-muted/40 border border-border/30" />
      </div>
      <div className="h-56 rounded-xl bg-muted/40 border border-border/30" />
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
      setError(e instanceof Error ? e.message : 'No se pudo cargar tu panorama');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [context, untilInput]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const balanceTrendRows = useMemo(() => {
    if (!data) return [];
    let runningBalance = data.summary.funding_total;
    return chartRows.map((row) => {
      runningBalance += row.remaining;
      return { ...row, projectedBalance: runningBalance };
    });
  }, [chartRows, data]);

  const shouldShowDebtComposition = useMemo(() => {
    if (!data) return false;
    return data.monthly_series.some(
      (month) =>
        month.msi_debt_total > 0 ||
        month.loan_payment_total > 0 ||
        month.expense_template_total > 0 ||
        month.other_debt_components_total > 0,
    );
  }, [data]);

  const projectedNet = data?.summary.net_liquidity_versus_obligations_including_income ?? 0;
  const expectedIncome = data?.summary.expected_income_total_on_or_before_until ?? 0;
  const obligations = data?.summary.total_obligations_due_on_or_before_until ?? 0;
  const fundingTotal = data?.summary.funding_total ?? 0;
  const untilLabel = data ? formatLiquidityDateLabel(data.until) : '';

  const coveragePercent = useMemo(() => {
    if (!data || obligations <= 0) return 100;
    const totalResources = Math.max(fundingTotal + Math.max(expectedIncome, 0), 0);
    return Math.min(100, (totalResources / obligations) * 100);
  }, [data, obligations, fundingTotal, expectedIncome]);

  const modelNotes = useMemo(() => {
    if (!data) return [];
    const notes = [
      'Contamos el dinero en efectivo y débito que tú eliges incluir.',
      'Sumamos los pagos que ya debes hasta fin de año: tarjetas, préstamos, gastos fijos y pendientes.',
      'Tus ingresos esperados (como nómina) ayudan a cubrir esos pagos.',
      'La gráfica muestra mes a mes si te sobra o te falta dinero.',
    ];
    if (data.options.include_unpaid_expenses) {
      notes.push('Incluimos gastos que aún no marcas como pagados.');
    }
    if (data.options.include_expense_templates) {
      notes.push('Incluimos gastos que se repiten cada quincena como estimación.');
    }
    return notes;
  }, [data]);

  return (
    <div className="space-y-6">
      <LiquidityGuideHero data={data} onAccountsChanged={() => void load()} />

      {error ? (
        <div
          className="rounded-xl border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && !data ? <LoadingSkeleton /> : null}

      {data ? (
        <>
          <section aria-label="Lo que tienes hoy" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold leading-tight">Lo que tienes hoy</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tu dinero disponible ahora y lo que debes pagar hasta {untilLabel}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <LiquidityVisualMetric
                label="Dinero disponible hoy"
                hint="Efectivo y débito que cuentas"
                amount={fundingTotal}
                borderClass="border-l-emerald-500/50"
                amountClassName="text-emerald-700 dark:text-emerald-300"
                barPercent={100}
                barTone="emerald"
                icon={
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/25">
                    <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  </span>
                }
              />
              <LiquidityVisualMetric
                label="Pagos que debes"
                hint={`Hasta ${untilLabel}`}
                amount={obligations}
                borderClass="border-l-violet-500/50"
                barPercent={obligations > 0 ? Math.min(100, (obligations / Math.max(fundingTotal + obligations, 1)) * 100) : 0}
                barTone="violet"
                icon={
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/25">
                    <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                  </span>
                }
              />
            </div>
          </section>

          <section aria-label="¿Te alcanza?" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold leading-tight">¿Te alcanza?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                La respuesta principal: contando lo que tienes hoy y lo que esperamos que entre.
              </p>
            </div>

            <LiquidityVisualMetric
              label="Te alcanza contando lo que entrará"
              hint={
                projectedNet >= 0
                  ? 'Tus ingresos ayudan a cubrir tus pagos'
                  : 'Aun con ingresos, no alcanza para todo lo que debes'
              }
              amount={projectedNet}
              borderClass={
                projectedNet >= 0 ? 'border-l-emerald-500/50' : 'border-l-destructive/50'
              }
              amountClassName={
                projectedNet >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-destructive'
              }
              statusLabel={projectedNet >= 0 ? 'Te alcanza' : 'Te falta'}
              statusTone={projectedNet >= 0 ? 'emerald' : 'destructive'}
              barPercent={coveragePercent}
              barTone={projectedNet >= 0 ? 'emerald' : 'destructive'}
              icon={
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
                    projectedNet >= 0
                      ? 'bg-emerald-500/10 ring-emerald-500/25'
                      : 'bg-destructive/10 ring-destructive/25',
                  )}
                >
                  <Wallet className="h-4 w-4" aria-hidden />
                </span>
              }
            />

            {expectedIncome > 0 ? (
              <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Tus ingresos esperados suman{' '}
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatCurrency(expectedIncome)}
                </span>{' '}
                hasta {untilLabel}.
              </p>
            ) : null}

            {data.summary.first_projected_shortfall_date ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                El primer mes complicado podría ser{' '}
                {formatLiquidityDateLabel(data.summary.first_projected_shortfall_date)}.
              </p>
            ) : null}
          </section>

          <section aria-label="Tu dinero mes a mes" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold leading-tight">Mes a mes, ¿sube o baja?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                La línea muestra cómo va quedando tu dinero conforme pasan los meses.
              </p>
            </div>
            <Card className="overflow-hidden border-border/60">
              <CardContent className="px-3 py-3">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={balanceTrendRows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.2)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line
                        type="monotone"
                        dataKey="projectedBalance"
                        name="Tu dinero"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          {shouldShowDebtComposition ? (
            <Collapsible defaultOpen className="group/debt rounded-xl border border-border/60">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/20">
                <div>
                  <h2 className="text-base font-semibold leading-tight">De dónde salen tus pagos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tarjetas, préstamos y gastos fijos, mes por mes.
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/debt:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/60 px-3 pb-3 pt-2">
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRows}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(127,127,127,0.2)" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="msi" stackId="debt" name="Pagos a meses" fill="#7c3aed" />
                        <Bar dataKey="loans" stackId="debt" name="Préstamos" fill="#0ea5e9" />
                        <Bar dataKey="templates" stackId="debt" name="Gastos fijos" fill="#f59e0b" />
                        <Bar dataKey="other" stackId="debt" name="Otros pagos" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          <Collapsible className="group/cards rounded-xl border border-border/60">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/20">
              <div>
                <h2 className="text-base font-semibold leading-tight">Cómo van tus tarjetas</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.card_utilization_summary.dangerous_count > 0
                    ? `${data.card_utilization_summary.dangerous_count} tarjeta(s) muy llena(s).`
                    : 'Revisa si alguna tarjeta está casi al límite.'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/cards:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60">
                {data.card_utilization_summary.cards.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    No tienes tarjetas activas registradas.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {data.card_utilization_summary.cards.map((card: LiquidityCardUtilizationItem) => {
                      const isUnrated = card.risk_level === 'unrated_no_limit';
                      const utilization = card.utilization_percent ?? 0;
                      const risk = getCardRiskLabel(
                        isUnrated ? null : utilization,
                        isUnrated,
                      );
                      return (
                        <li key={card.card_id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{card.card_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {PAYMENT_METHOD_LABELS[
                                  card.card_type as keyof typeof PAYMENT_METHOD_LABELS
                                ] ?? card.card_type}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                                risk.tone === 'destructive' && 'bg-destructive/10 text-destructive ring-destructive/20',
                                risk.tone === 'amber' && 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
                                risk.tone === 'emerald' && 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
                                risk.tone === 'muted' && 'bg-muted text-muted-foreground ring-border/40',
                              )}
                            >
                              {risk.label}
                            </span>
                          </div>
                          {!isUnrated ? (
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/40">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  risk.tone === 'destructive' && 'bg-destructive',
                                  risk.tone === 'amber' && 'bg-amber-500',
                                  risk.tone === 'emerald' && 'bg-emerald-500',
                                )}
                                style={{ width: `${Math.min(100, utilization)}%` }}
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible className="group/msi rounded-xl border border-border/60">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/20">
              <div>
                <h2 className="text-base font-semibold leading-tight">Compras a meses</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pagos fijos que siguen cada mes hasta terminar.
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/msi:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/60 p-3">
              <CreditCardInstallmentProjectionBlock />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible className="group/months rounded-xl border border-border/60">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/20">
              <div>
                <h2 className="text-base font-semibold leading-tight">Ver mes por mes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Detalle con números, solo si lo necesitas.
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/months:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="overflow-hidden border-t border-border/60">
                <div className="hidden border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-7">
                  <span>Mes</span>
                  <span className="text-right">Entra</span>
                  <span className="text-right">A meses</span>
                  <span className="text-right">Préstamos</span>
                  <span className="text-right">Fijos</span>
                  <span className="text-right">Otros</span>
                  <span className="text-right">Resultado</span>
                </div>
                {data.monthly_series.map((month) => {
                  const ok = month.monthly_remaining >= 0;
                  return (
                    <div
                      key={month.month_key}
                      className={cn(
                        'border-b border-border/30 px-3 py-3 text-sm last:border-b-0',
                        !ok && 'border-l-[3px] border-l-destructive/50',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
                        <span className="font-semibold">{formatMonthLabel(month.month_key)}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            ok
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-destructive/10 text-destructive',
                          )}
                        >
                          {ok ? 'Te alcanza' : 'Te falta'}
                        </span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-7 md:items-center">
                        <span className="hidden font-semibold md:block">
                          {formatMonthLabel(month.month_key)}
                        </span>
                        <span className="font-mono tabular-nums md:text-right">
                          {formatCurrency(month.expected_income_total)}
                        </span>
                        <span className="font-mono tabular-nums md:text-right">
                          {formatCurrency(month.msi_debt_total)}
                        </span>
                        <span className="font-mono tabular-nums md:text-right">
                          {formatCurrency(month.loan_payment_total)}
                        </span>
                        <span className="font-mono tabular-nums md:text-right">
                          {formatCurrency(month.expense_template_total)}
                        </span>
                        <span className="font-mono tabular-nums md:text-right">
                          {formatCurrency(month.other_debt_components_total)}
                        </span>
                        <span
                          className={cn(
                            'font-mono tabular-nums font-bold md:text-right',
                            ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                          )}
                        >
                          {formatCurrency(month.monthly_remaining)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible className="group/help rounded-xl border border-dashed border-border/50 bg-muted/10">
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted/30">
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/help:rotate-180" />
              ¿Cómo se calcula esto?
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
                {modelNotes.map((note) => (
                  <li key={note} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    {note}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : null}
    </div>
  );
}
