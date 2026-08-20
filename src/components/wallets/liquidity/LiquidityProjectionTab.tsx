'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import { cn, formatCurrency } from '@/lib/utils';
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
import { LiquidityGuideHero } from '@/components/wallets/liquidity/LiquidityGuideHero';
import { liquidityUntilFromMonthHorizon } from '@/lib/finance/liquidity-projection';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { LiquidityFutureTimeline } from '@/components/wallets/liquidity/LiquidityFutureTimeline';
import { LiquidityMonthFocus } from '@/components/wallets/liquidity/LiquidityMonthFocus';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import {
  getCardRiskLabel,
  getTightestMonth,
  shiftSelectedMonthKey,
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-2xl bg-muted/40 border border-border/30" />
      <div className="h-72 rounded-2xl bg-muted/40 border border-border/30" />
      <div className="h-40 rounded-2xl bg-muted/40 border border-border/30" />
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
  const [selectedMonthKey, setSelectedMonthKey] = useState('');

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

  const tightestMonth = useMemo(
    () => (data ? getTightestMonth(data) : null),
    [data],
  );

  const projectionEvents = data?.projection_events ?? [];
  const monthKeys = data?.monthly_series.map((month) => month.month_key) ?? [];
  const resolvedMonthKey =
    selectedMonthKey && monthKeys.includes(selectedMonthKey)
      ? selectedMonthKey
      : (monthKeys[0] ?? '');
  const selectedMonth =
    data?.monthly_series.find((month) => month.month_key === resolvedMonthKey) ??
    null;
  const selectedIndex = monthKeys.indexOf(resolvedMonthKey);
  const selectedEvents = projectionEvents.filter(
    (event) => event.month_key === resolvedMonthKey,
  );
  const fundingTotal = data?.summary.funding_total ?? 0;

  const handleShiftMonth = (delta: number) => {
    setSelectedMonthKey(shiftSelectedMonthKey(monthKeys, resolvedMonthKey, delta));
  };

  const modelNotes = useMemo(() => {
    if (!data) return [];
    const notes = [
      'Toca un mes en la gráfica: el detalle de abajo cambia con ese mes.',
      'La línea es lo que aún debes de aquí en adelante. Baja cuando terminas un préstamo o una compra a meses.',
      'Los puntos verdes son el mes en que terminas de pagar algo.',
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
          <p className="text-sm text-muted-foreground">
            Hoy tienes{' '}
            <span className="font-mono font-semibold tabular-nums text-emerald-300">
              {formatCurrency(fundingTotal)}
            </span>{' '}
            en efectivo y débito. Toca la gráfica para ver cada mes.
          </p>

          <LiquidityFutureTimeline
            months={data.monthly_series}
            events={projectionEvents}
            horizonMonths={horizonMonths}
            onHorizonChange={handleHorizonChange}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={setSelectedMonthKey}
          />

          <LiquidityMonthFocus
            month={selectedMonth}
            events={selectedEvents}
            isTight={
              Boolean(
                selectedMonth &&
                  tightestMonth?.monthKey === selectedMonth.month_key &&
                  selectedMonth.monthly_remaining < 0,
              )
            }
            isCurrentMonth={selectedMonth?.month_key === data.monthly_series[0]?.month_key}
            canPrev={selectedIndex > 0}
            canNext={selectedIndex >= 0 && selectedIndex < monthKeys.length - 1}
            onPrevMonth={() => handleShiftMonth(-1)}
            onNextMonth={() => handleShiftMonth(1)}
          />

          {data.card_utilization_summary.cards.length > 0 ? (
            <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'px-4 py-4 sm:px-5')}>
              <h2 className="text-base font-semibold leading-tight">Tus tarjetas hoy</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.card_utilization_summary.dangerous_count > 0
                  ? `${data.card_utilization_summary.dangerous_count} muy llena(s). Eso también empuja los pagos de la gráfica.`
                  : 'Ninguna está al límite ahora.'}
              </p>
              <ul className="mt-3 space-y-3">
                {data.card_utilization_summary.cards.map((card: LiquidityCardUtilizationItem) => {
                  const isUnrated = card.risk_level === 'unrated_no_limit';
                  const utilization = card.utilization_percent ?? 0;
                  const risk = getCardRiskLabel(isUnrated ? null : utilization, isUnrated);
                  return (
                    <li key={card.card_id}>
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
                            risk.tone === 'destructive' &&
                              'bg-destructive/10 text-destructive ring-destructive/20',
                            risk.tone === 'amber' &&
                              'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
                            risk.tone === 'emerald' &&
                              'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
                            risk.tone === 'muted' &&
                              'bg-muted text-muted-foreground ring-border/40',
                          )}
                        >
                          {risk.label}
                        </span>
                      </div>
                      {!isUnrated ? (
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
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
            </section>
          ) : null}

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
