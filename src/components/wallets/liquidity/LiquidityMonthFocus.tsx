'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Check, Sparkles } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
} from '@/types/catalog';
import {
  formatMonthYearLabel,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { LiquidityMonthStepper } from '@/components/wallets/liquidity/LiquidityMonthStepper';
import { LiquidityMonthDebtTabs } from '@/components/wallets/liquidity/LiquidityMonthDebtTabs';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';

type LiquidityMonthFocusProps = {
  month: LiquidityMonthlySeriesItem | null;
  events: LiquidityProjectionEvent[];
  isCurrentMonth: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isRefreshing?: boolean;
  embedded?: boolean;
};

export const LiquidityMonthFocus = ({
  month,
  events,
  isCurrentMonth,
  canPrev,
  canNext,
  onPrevMonth,
  onNextMonth,
  isRefreshing = false,
  embedded = false,
}: LiquidityMonthFocusProps) => {
  if (!month) return null;

  const debtItems = month.debt_items ?? [];
  const paymentsDue = monthDebtPaymentsTotal(debtItems);
  const outstandingTotal = month.outstanding_debt_total ?? 0;

  const shellClass = embedded
    ? 'px-4 py-4 sm:px-5 sm:py-5'
    : cn(MONTHLY_PANEL_SHELL_CLASS, 'px-4 py-4 sm:px-5');

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={month.month_key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className={cn(
          shellClass,
          'relative overflow-hidden',
          isRefreshing && 'pointer-events-none opacity-50 transition-opacity',
        )}
        aria-live="polite"
        aria-busy={isRefreshing}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3a37fc]/40 to-transparent"
          aria-hidden
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1',
                isCurrentMonth
                  ? 'bg-primary/15 text-primary ring-primary/25'
                  : 'bg-muted/40 text-muted-foreground ring-border/40',
              )}
              aria-hidden
            >
              <CalendarDays className="size-4" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isCurrentMonth ? 'Este mes' : 'Mes seleccionado'}
              </p>
              <h3 className="text-base font-semibold tracking-tight">
                {formatMonthYearLabel(month.month_key)}
              </h3>
            </div>
          </div>
          <LiquidityMonthStepper
            onPrev={onPrevMonth}
            onNext={onNextMonth}
            canPrev={canPrev}
            canNext={canNext}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] border-l-violet-500/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deudas de este mes
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-violet-300">
              {formatCurrency(paymentsDue)}
            </p>
          </div>
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] border-l-amber-500/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Adeudo al cierre
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-300">
              {formatCurrency(outstandingTotal)}
            </p>
          </div>
        </div>

        <LiquidityMonthDebtTabs items={debtItems} outstandingTotal={outstandingTotal} />

        {events.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
              <Sparkles className="size-3" aria-hidden />
              Buenas noticias
            </p>
            <ul className="space-y-2">
              {events.map((event) => (
                <li
                  key={`${event.event_type}-${event.loan_id ?? event.expense_id}`}
                  className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400">
                    <Check className="h-3 w-3 text-[#060914]" aria-hidden />
                  </span>
                  <span>
                    <span className="text-sm font-semibold text-foreground">{event.title}</span>
                    <span className="block text-xs text-muted-foreground">{event.subtitle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};
