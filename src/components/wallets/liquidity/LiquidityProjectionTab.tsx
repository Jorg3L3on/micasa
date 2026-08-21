'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import { formatCurrency } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { LiquidityGuideHero } from '@/components/wallets/liquidity/LiquidityGuideHero';
import { liquidityUntilFromMonthHorizon } from '@/lib/finance/liquidity-projection';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { LiquidityFutureTimeline } from '@/components/wallets/liquidity/LiquidityFutureTimeline';
import { LiquidityMonthFocus } from '@/components/wallets/liquidity/LiquidityMonthFocus';
import { LiquidityAccountsToday } from '@/components/wallets/liquidity/LiquidityAccountsToday';
import {
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
      'La línea es lo que aún debes de préstamos y tarjetas. Baja cuando terminas un préstamo o una compra a meses.',
      'Los puntos verdes son el mes en que terminas de pagar algo.',
    ];
    if (data.options.include_unpaid_expenses) {
      notes.push('Los gastos impagos de efectivo o débito salen en el detalle del mes, no en la línea de deuda.');
    }
    if (data.options.include_expense_templates) {
      notes.push('Los gastos fijos que se repiten (renta, suscripciones) salen en el detalle del mes, no en la línea de deuda.');
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

          <LiquidityAccountsToday onChanged={() => void load()} />

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
