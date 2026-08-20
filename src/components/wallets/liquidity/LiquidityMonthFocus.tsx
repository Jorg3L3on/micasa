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
import { formatMonthYearLabel } from '@/components/wallets/liquidity/liquidity-personalization';
import { LiquidityMonthStepper } from '@/components/wallets/liquidity/LiquidityMonthStepper';

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

const COMPOSITION = [
  { key: 'msi_debt_total', label: 'Estado de tarjeta', barClass: 'bg-violet-500', dotClass: 'bg-violet-500' },
  { key: 'installment_payment_total', label: 'Compras a meses', barClass: 'bg-fuchsia-500', dotClass: 'bg-fuchsia-500' },
  { key: 'loan_payment_total', label: 'Préstamos', barClass: 'bg-sky-500', dotClass: 'bg-sky-500' },
  { key: 'expense_template_total', label: 'Gastos fijos', barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
  { key: 'other_debt_components_total', label: 'Otros', barClass: 'bg-rose-500', dotClass: 'bg-rose-500' },
] as const;

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

  const slices = COMPOSITION.map((item) => ({
    ...item,
    amount: Number(month[item.key] ?? 0),
  })).filter((item) => item.amount > 0);
  const sliceTotal = slices.reduce((sum, item) => sum + item.amount, 0);
  const covers = month.monthly_remaining >= 0;

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
            <h3 className="text-base font-semibold capitalize">
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
              Entra
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-300">
              {formatCurrency(month.expected_income_total)}
            </p>
          </div>
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] border-l-violet-500/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sales a pagar
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums">
              {formatCurrency(month.total_payments_due)}
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

        {sliceTotal > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              De dónde salen esos pagos
            </p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/40">
              {slices.map((slice) => (
                <div
                  key={slice.key}
                  className={cn('h-full', slice.barClass)}
                  style={{ width: `${(slice.amount / sliceTotal) * 100}%` }}
                  title={`${slice.label}: ${formatCurrency(slice.amount)}`}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {slices.map((slice) => (
                <li key={slice.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', slice.dotClass)} />
                  <span>{slice.label}</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(slice.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Ese mes no hay pagos proyectados.
          </p>
        )}

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
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Ese mes no terminas ningún préstamo ni compra a meses. Toca un punto verde para ver cuándo sí.
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
