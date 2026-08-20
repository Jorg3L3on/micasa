'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  CreditCard,
  Landmark,
  TrendingUp,
} from 'lucide-react';
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
import { useFinanceContext } from '@/context/finance-context';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import { formatCurrency, cn } from '@/lib/utils';
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
import { liquidityUntilFromMonthHorizon } from '@/lib/finance/liquidity-projection';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { LiquidityFutureTimeline } from '@/components/wallets/liquidity/LiquidityFutureTimeline';
import {
  getCardRiskLabel,
  getTightestMonth,
  type LiquidityHorizonMonths,
} from '@/components/wallets/liquidity/liquidity-personalization';

const HORIZON_STORAGE_KEY = 'micasa.liquidity.horizonMonths';

const readStoredHorizon = (): LiquidityHorizonMonths => {
  if (typeof window === 'undefined') return 6;
  const raw = window.localStorage.getItem(HORIZON_STORAGE_KEY);
  if (raw === '3' || raw === '6' || raw === '12') return Number(raw) as LiquidityHorizonMonths;
  return 6;
};

const horizonUntilYmd = (horizonMonths: LiquidityHorizonMonths): string =>
  formatCalendarDate(liquidityUntilFromMonthHorizon(new Date(), horizonMonths));

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
  const [horizonMonths, setHorizonMonths] = useState<LiquidityHorizonMonths>(() =>
    readStoredHorizon(),
  );
  const untilInput = useMemo(() => horizonUntilYmd(horizonMonths), [horizonMonths]);
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

  const handleHorizonChange = (next: LiquidityHorizonMonths) => {
    setHorizonMonths(next);
    window.localStorage.setItem(HORIZON_STORAGE_KEY, String(next));
  };

  useEffect(() => {
    void load();
  }, [load]);

  const chartRows = useMemo(
    () =>
      (data?.monthly_series ?? []).map((month) => ({
        label: formatMonthLabel(month.month_key),
        monthKey: month.month_key,
        income: month.expected_income_total,
        msi: month.msi_debt_total,
        installments: month.installment_payment_total,
        loans: month.loan_payment_total,
        templates: month.expense_template_total,
        other: month.other_debt_components_total,
        paymentsDue: month.total_payments_due,
        remainingDebt: month.remaining_payments_from_month,
        monthlyRemaining: month.monthly_remaining,
      })),
    [data?.monthly_series],
  );

  const tightestMonth = useMemo(
    () => (data ? getTightestMonth(data) : null),
    [data],
  );

  const nextMonthPayments = data?.monthly_series[0]?.total_payments_due ?? 0;
  const nextMonthIncome = data?.monthly_series[0]?.expected_income_total ?? 0;
  const fundingTotal = data?.summary.funding_total ?? 0;
  const projectionEvents = data?.projection_events ?? [];

  const shouldShowDebtComposition = useMemo(() => {
    if (!data) return false;
    return data.monthly_series.some((month) => month.total_payments_due > 0);
  }, [data]);

  const modelNotes = useMemo(() => {
    if (!data) return [];
    const notes = [
      'Ves los próximos meses, no un saldo contable de fin de año.',
      'La línea muestra cuánto te falta por pagar de aquí en adelante; baja cuando terminas un préstamo o una compra a meses.',
      'Los puntos verdes sobre la línea son el mes en que terminas de pagar algo. Toca un mes para ver el detalle.',
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
      <LiquidityGuideHero
        data={data}
        horizonMonths={horizonMonths}
        onAccountsChanged={() => void load()}
      />

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
          <section aria-label="Tu mes más cercano" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold leading-tight">Tu próximo mes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Lo más inmediato: cuánto entra, cuánto sale y cuánto tienes hoy en efectivo y débito.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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
                label="Pagos del próximo mes"
                hint="Todo lo que debes pagar ese mes"
                amount={nextMonthPayments}
                borderClass="border-l-violet-500/50"
                barPercent={
                  nextMonthPayments + nextMonthIncome > 0
                    ? Math.min(100, (nextMonthPayments / (nextMonthPayments + nextMonthIncome)) * 100)
                    : 0
                }
                barTone="violet"
                icon={
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/25">
                    <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                  </span>
                }
              />
              <LiquidityVisualMetric
                label="Ingresos esperados ese mes"
                hint="Lo que registramos que entrará"
                amount={nextMonthIncome}
                borderClass="border-l-sky-500/50"
                amountClassName="text-sky-700 dark:text-sky-300"
                barPercent={
                  nextMonthPayments + nextMonthIncome > 0
                    ? Math.min(100, (nextMonthIncome / (nextMonthPayments + nextMonthIncome)) * 100)
                    : 50
                }
                barTone="sky"
                icon={
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-500/25">
                    <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
                  </span>
                }
              />
            </div>
          </section>

          <section aria-label="Tus pagos mes a mes" className="space-y-3">
            <LiquidityFutureTimeline
              months={data.monthly_series}
              events={projectionEvents}
              horizonMonths={horizonMonths}
              onHorizonChange={handleHorizonChange}
              tightestMonthKey={tightestMonth?.monthKey}
            />
          </section>

          {shouldShowDebtComposition ? (
            <Collapsible className="group/debt rounded-xl border border-border/60">
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
                        <Bar dataKey="msi" stackId="debt" name="Estados de tarjeta" fill="#7c3aed" />
                        <Bar dataKey="installments" stackId="debt" name="Compras a meses" fill="#a855f7" />
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
                <div className="hidden border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-8">
                  <span>Mes</span>
                  <span className="text-right">Entra</span>
                  <span className="text-right">Tarjetas</span>
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
                          {ok ? 'Te alcanza' : 'Apretado'}
                        </span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-8 md:items-center">
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
                          {formatCurrency(month.installment_payment_total)}
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
