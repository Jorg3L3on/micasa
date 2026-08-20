'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CreditCard, Landmark } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
  LiquidityProjectionTrack,
} from '@/types/catalog';
import {
  compareMonthKeys,
  formatMonthYearLabel,
  formatShortMonthLabel,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { LiquidityHorizonMenu } from '@/components/wallets/liquidity/LiquidityHorizonMenu';
import type { LiquidityHorizonMonths } from '@/components/wallets/liquidity/liquidity-personalization';

type LiquidityFutureTimelineProps = {
  months: LiquidityMonthlySeriesItem[];
  tracks: LiquidityProjectionTrack[];
  events: LiquidityProjectionEvent[];
  horizonMonths: LiquidityHorizonMonths;
  onHorizonChange: (value: LiquidityHorizonMonths) => void;
  tightestMonthKey?: string | null;
};

const trackTone = {
  loan: {
    bar: 'bg-sky-500/80',
    end: 'bg-sky-500 text-white',
    chip: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
    icon: Landmark,
  },
  msi: {
    bar: 'bg-violet-500/80',
    end: 'bg-violet-500 text-white',
    chip: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
    icon: CreditCard,
  },
} as const;

export const LiquidityFutureTimeline = ({
  months,
  tracks,
  events,
  horizonMonths,
  onHorizonChange,
  tightestMonthKey,
}: LiquidityFutureTimelineProps) => {
  const monthKeys = useMemo(() => months.map((month) => month.month_key), [months]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    monthKeys[0] ?? '',
  );

  useEffect(() => {
    if (!monthKeys.includes(selectedMonthKey)) {
      setSelectedMonthKey(monthKeys[0] ?? '');
    }
  }, [monthKeys, selectedMonthKey]);

  const selectedMonth =
    months.find((month) => month.month_key === selectedMonthKey) ?? months[0] ?? null;
  const selectedEvents = events.filter((event) => event.month_key === selectedMonthKey);
  const selectedTracks = tracks.filter((track) => {
    if (!selectedMonthKey) return false;
    return (
      compareMonthKeys(track.start_month_key, selectedMonthKey) <= 0 &&
      compareMonthKeys(track.end_month_key, selectedMonthKey) >= 0
    );
  });
  const maxRemaining = Math.max(
    ...months.map((month) => month.remaining_payments_from_month),
    1,
  );
  const maxDue = Math.max(...months.map((month) => month.total_payments_due), 1);

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonthKey(monthKey);
  };

  if (months.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aún no hay meses por proyectar.</p>
    );
  }

  return (
    <section className="space-y-3" aria-label="Línea de tiempo de tus pagos">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-tight">
            Tu línea de tiempo: próximos {horizonMonths} meses
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada barra es un préstamo o una compra a meses. El círculo al final es cuando terminas de pagarlo. Toca un mes para ver qué pasa.
          </p>
        </div>
        <LiquidityHorizonMenu value={horizonMonths} onChange={onHorizonChange} />
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2 py-1 ring-1 ring-sky-500/20">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          Préstamo
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2 py-1 ring-1 ring-violet-500/20">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Compra a meses
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 ring-1 ring-emerald-500/20">
          <Check className="h-3 w-3 text-emerald-600" aria-hidden />
          Aquí terminas
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
        <div
          className="min-w-[640px]"
          style={{
            display: 'grid',
            gridTemplateColumns: `9.5rem repeat(${monthKeys.length}, minmax(4.25rem, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 border-b border-border/40 bg-card px-3 py-3 text-xs font-semibold text-muted-foreground">
            Mes
          </div>
          {months.map((month) => {
            const isSelected = month.month_key === selectedMonthKey;
            const isTight = month.month_key === tightestMonthKey && month.monthly_remaining < 0;
            const eventsHere = events.filter((event) => event.month_key === month.month_key);
            return (
              <button
                key={`head-${month.month_key}`}
                type="button"
                onClick={() => handleSelectMonth(month.month_key)}
                aria-pressed={isSelected}
                aria-label={`${formatMonthYearLabel(month.month_key)}. Pagos ${formatCurrency(month.total_payments_due)}`}
                className={cn(
                  'border-b border-l border-border/40 px-1.5 py-2 text-center transition-colors',
                  isSelected && 'bg-primary/10',
                  isTight && !isSelected && 'bg-destructive/5',
                )}
              >
                <span className="block text-[11px] font-semibold capitalize">
                  {formatShortMonthLabel(month.month_key)}
                </span>
                <span className="mt-1 flex h-10 items-end justify-center">
                  <span
                    className={cn(
                      'w-3 rounded-t-sm',
                      isTight ? 'bg-destructive/80' : 'bg-primary/60',
                    )}
                    style={{
                      height: `${Math.max(8, (month.total_payments_due / maxDue) * 100)}%`,
                    }}
                  />
                </span>
                {eventsHere.length > 0 ? (
                  <span className="mt-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                    {eventsHere.length}
                  </span>
                ) : (
                  <span className="mt-1 block h-4" />
                )}
              </button>
            );
          })}

          {tracks.length === 0 ? (
            <div
              className="col-span-full px-4 py-8 text-sm text-muted-foreground"
              style={{ gridColumn: `1 / -1` }}
            >
              No hay préstamos ni compras a meses en este periodo. Cuando los registres, aquí verás hasta qué mes duran.
            </div>
          ) : (
            tracks.map((track) => {
              const startIndex = monthKeys.indexOf(track.start_month_key);
              const endIndex = monthKeys.indexOf(track.end_month_key);
              const safeStart = startIndex < 0 ? 0 : startIndex;
              const safeEnd = endIndex < 0 ? monthKeys.length - 1 : endIndex;
              const span = Math.max(1, safeEnd - safeStart + 1);
              const tone = trackTone[track.kind];
              const Icon = tone.icon;
              return (
                <div key={track.id} className="contents">
                  <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-border/30 bg-card px-3 py-2">
                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1', tone.chip)}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{track.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{track.subtitle}</p>
                    </div>
                  </div>
                  <div
                    className="relative border-b border-l border-border/30"
                    style={{ gridColumn: `2 / -1` }}
                  >
                    <div
                      className="absolute inset-y-0"
                      style={{
                        left: `${(safeStart / monthKeys.length) * 100}%`,
                        width: `${(span / monthKeys.length) * 100}%`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectMonth(track.end_month_key)}
                        className="absolute inset-y-2 left-1 right-1 flex items-center"
                        aria-label={`${track.title}. ${
                          track.finishes_in_horizon
                            ? `Terminas en ${formatMonthYearLabel(track.end_month_key)}`
                            : `Sigue después de ${formatMonthYearLabel(track.end_month_key)}`
                        }`}
                      >
                        <span className={cn('relative h-3 w-full rounded-full', tone.bar)}>
                          <span
                            className={cn(
                              'absolute -right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full shadow-sm ring-2 ring-background',
                              track.finishes_in_horizon ? 'bg-emerald-500 text-white' : tone.end,
                            )}
                          >
                            {track.finishes_in_horizon ? (
                              <Check className="h-3 w-3" aria-hidden />
                            ) : (
                              <span className="text-[9px] font-bold">→</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="sticky left-0 z-10 border-t border-border/40 bg-card px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lo que aún debes
          </div>
          {months.map((month) => (
            <div
              key={`remain-${month.month_key}`}
              className="flex items-end justify-center border-l border-t border-border/40 px-1 py-2"
            >
              <div
                className="w-full max-w-[2.25rem] rounded-sm bg-primary/15"
                title={formatCurrency(month.remaining_payments_from_month)}
              >
                <div
                  className="w-full rounded-sm bg-primary/70"
                  style={{
                    height: `${Math.max(4, (month.remaining_payments_from_month / maxRemaining) * 36)}px`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedMonth ? (
          <motion.div
            key={selectedMonth.month_key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ese mes
                </p>
                <h3 className="text-base font-semibold capitalize">
                  {formatMonthYearLabel(selectedMonth.month_key)}
                </h3>
              </div>
              <p
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                  selectedMonth.monthly_remaining >= 0
                    ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
                    : 'bg-destructive/10 text-destructive ring-destructive/20',
                )}
              >
                {selectedMonth.monthly_remaining >= 0 ? 'Te alcanza' : 'Mes apretado'}
              </p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Vas a pagar</p>
                <p className="font-mono text-lg font-bold tabular-nums">
                  {formatCurrency(selectedMonth.total_payments_due)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Esperamos que entre</p>
                <p className="font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(selectedMonth.expected_income_total)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Aún te falta por pagar desde aquí</p>
                <p className="font-mono text-lg font-bold tabular-nums text-violet-700 dark:text-violet-300">
                  {formatCurrency(selectedMonth.remaining_payments_from_month)}
                </p>
              </div>
            </div>

            {selectedEvents.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {selectedEvents.map((event) => (
                  <li
                    key={`${event.event_type}-${event.loan_id ?? event.expense_id}`}
                    className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 ring-1 ring-emerald-500/20"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.subtitle}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : selectedTracks.length > 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Ese mes sigues pagando: {selectedTracks.map((track) => track.title).join(', ')}.
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Ese mes no hay préstamos ni compras a meses que terminen.
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
