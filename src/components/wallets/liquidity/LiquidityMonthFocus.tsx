'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
} from '@/types/catalog';
import {
  displayIncomingCash,
  formatMonthYearLabel,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { LiquidityMonthStepper } from '@/components/wallets/liquidity/LiquidityMonthStepper';
import { LiquidityMonthDebtItemsList } from '@/components/wallets/liquidity/LiquidityMonthDebtItemsList';
import { monthDebtItemsTotal } from '@/lib/finance/liquidity-month-debt-items';

type LiquidityMonthFocusProps = {
  month: LiquidityMonthlySeriesItem | null;
  events: LiquidityProjectionEvent[];
  isTight: boolean;
  isCurrentMonth: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export const LiquidityMonthFocus = ({
  month,
  events,
  isTight,
  isCurrentMonth,
  canPrev,
  canNext,
  onPrevMonth,
  onNextMonth,
}: LiquidityMonthFocusProps) => {
  if (!month) return null;

  const debtItems = month.debt_items ?? [];
  const debtTotal = monthDebtItemsTotal(debtItems);
  const incomingCash = displayIncomingCash(month.expected_income_total);
  const covers = month.total_payments_due <= 0 || month.monthly_remaining >= 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={month.month_key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className={cn(
          MONTHLY_PANEL_SHELL_CLASS,
          'px-4 py-4 sm:px-5',
          isTight && 'border-l-[3px] border-l-destructive/50',
        )}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isCurrentMonth ? 'Este mes' : 'Mes en la gráfica'}
            </p>
            <h3 className="text-base font-semibold">
              {formatMonthYearLabel(month.month_key)}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                covers
                  ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                  : 'bg-destructive/10 text-destructive ring-destructive/20',
              )}
            >
              {covers ? 'Te alcanza' : 'Mes apretado'}
            </span>
            <LiquidityMonthStepper
              onPrev={onPrevMonth}
              onNext={onNextMonth}
              canPrev={canPrev}
              canNext={canNext}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] border-l-emerald-500/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Entra a tu cuenta
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-lg font-bold tabular-nums',
                incomingCash > 0 ? 'text-emerald-300' : 'text-muted-foreground',
              )}
            >
              {formatCurrency(incomingCash)}
            </p>
          </div>
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] border-l-violet-500/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deudas de este mes
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums">
              {formatCurrency(debtTotal)}
            </p>
          </div>
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] border-l-sky-500/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Aún debes desde aquí
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-violet-300">
              {formatCurrency(month.remaining_payments_from_month)}
            </p>
          </div>
        </div>

        <LiquidityMonthDebtItemsList
          items={debtItems}
          emptyMessage="Ese mes no hay pagos de préstamos ni tarjetas."
        />

        {events.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {events.map((event) => (
              <li
                key={`${event.event_type}-${event.loan_id ?? event.expense_id}`}
                className="flex items-start gap-2 text-sm"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400">
                  <Check className="h-3 w-3 text-[#060914]" aria-hidden />
                </span>
                <span>
                  <span className="font-semibold text-foreground">{event.title}</span>
                  <span className="block text-xs text-muted-foreground">{event.subtitle}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};
