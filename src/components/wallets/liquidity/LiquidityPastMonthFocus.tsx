'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import type { MonthlySummaryItem } from '@/app/api/wallets/liquidity/monthly-summary/route';
import {
  formatMonthYearLabel,
  monthKeyFromParts,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { LiquidityMonthStepper } from '@/components/wallets/liquidity/LiquidityMonthStepper';

type LiquidityPastMonthFocusProps = {
  month: MonthlySummaryItem | null;
  averageExpense: number;
  canPrev: boolean;
  canNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export const LiquidityPastMonthFocus = ({
  month,
  averageExpense,
  canPrev,
  canNext,
  onPrevMonth,
  onNextMonth,
}: LiquidityPastMonthFocusProps) => {
  if (!month) return null;

  const monthKey = monthKeyFromParts(month.year, month.month);
  const net = month.income - month.expense;
  const covers = net >= 0;
  const spendRatio = month.income > 0 ? month.expense / month.income : null;
  const vsAverage =
    averageExpense > 0 ? month.expense - averageExpense : 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={monthKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className={cn(
          MONTHLY_PANEL_SHELL_CLASS,
          'px-4 py-4 sm:px-5',
          !covers && 'border-l-[3px] border-l-destructive/50',
        )}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mes en la gráfica
            </p>
            <h3 className="text-base font-semibold capitalize">
              {formatMonthYearLabel(monthKey)}
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
              {covers ? 'Te alcanzó' : 'No te alcanzó'}
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
              Entró
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-300">
              {formatCurrency(month.income)}
            </p>
          </div>
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] border-l-violet-500/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Salió
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-violet-300">
              {formatCurrency(month.expense)}
            </p>
          </div>
          <div
            className={cn(
              METRIC_STRIP_CLASS,
              'border-l-[3px]',
              covers ? 'border-l-emerald-500/50' : 'border-l-destructive/50',
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {covers ? 'Te sobró' : 'Te faltó'}
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-lg font-bold tabular-nums',
                covers ? 'text-emerald-300' : 'text-destructive',
              )}
            >
              {formatCurrency(Math.abs(net))}
            </p>
          </div>
        </div>

        {spendRatio != null ? (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cuánto usaste de lo que entró
            </p>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted/40">
              <div
                className={cn('h-full rounded-full', covers ? 'bg-violet-500' : 'bg-destructive')}
                style={{ width: `${Math.min(100, spendRatio * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {covers
                ? `Usaste ${Math.round(spendRatio * 100)}% de lo que entró.`
                : 'Salió más de lo que entró ese mes.'}
              {averageExpense > 0
                ? vsAverage > 0
                  ? ` Gastaste ${formatCurrency(vsAverage)} más que tu promedio mensual.`
                  : ` Gastaste ${formatCurrency(Math.abs(vsAverage))} menos que tu promedio mensual.`
                : ''}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Ese mes no hubo ingresos registrados. Toca otro mes en la gráfica.
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
