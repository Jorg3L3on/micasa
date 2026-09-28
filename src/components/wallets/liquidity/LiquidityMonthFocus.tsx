'use client';

import { CalendarClock, Check, Landmark, Sparkles } from 'lucide-react';
import { AccountMetric } from '@/components/monthly/FortnightSummaryHero';
import { AuraSurface } from '@/components/aura/aura-surface';
import { AURA_TONE_HEX } from '@/lib/ui/aura-palette';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
} from '@/types/catalog';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';

const countLabel = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

/** Pagos del mes + Adeudo al cierre as Panel financiero aura tiles. */
export const LiquidityMonthMetrics = ({ month }: { month: LiquidityMonthlySeriesItem }) => {
  const debtItems = month.debt_items ?? [];
  const paymentsDue = monthDebtPaymentsTotal(debtItems);
  const outstandingTotal = month.outstanding_debt_total ?? 0;
  const paymentCount = debtItems.filter((item) => (item.payment_amount ?? 0) > 0).length;
  const outstandingCount = debtItems.filter((item) => item.amount > 0).length;

  return (
    <div className="grid grid-cols-2 gap-2" role="region" aria-label="Deudas del mes">
      <AccountMetric
        label="Pagos del mes"
        amount={paymentsDue}
        subtitle={
          paymentCount > 0
            ? countLabel(paymentCount, 'pago programado', 'pagos programados')
            : 'Sin pagos de deudas'
        }
        auraTone="violet"
        pillClassName="bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
        icon={CalendarClock}
        amountClassName="text-foreground"
      />
      <AccountMetric
        label="Adeudo al cierre"
        amount={outstandingTotal}
        subtitle={
          outstandingCount > 0
            ? countLabel(outstandingCount, 'cuenta con saldo', 'cuentas con saldo')
            : 'Sin deudas al cierre'
        }
        auraTone={outstandingTotal > 0 ? 'amber' : 'emerald'}
        pillClassName={
          outstandingTotal > 0
            ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
        }
        icon={Landmark}
        amountClassName={
          outstandingTotal > 0
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-emerald-700 dark:text-emerald-300'
        }
      />
    </div>
  );
};

/** Payoff milestones for the selected month (“Terminas de pagar …”). */
export const LiquidityMonthEvents = ({ events }: { events: LiquidityProjectionEvent[] }) => {
  if (events.length === 0) return null;

  return (
    <section className="space-y-2" aria-label="Buenas noticias del mes">
      <p className="flex items-center gap-1.5 px-1 text-caption font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        <Sparkles className="size-3" aria-hidden />
        Buenas noticias
      </p>
      <ul className="space-y-2" role="list">
        {events.map((event) => (
          <li key={`${event.event_type}-${event.loan_id ?? event.expense_id}`}>
            <AuraSurface
              color={AURA_TONE_HEX.emerald}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 px-3 py-2.5"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-success">
                <Check className="h-3 w-3 text-primary-foreground" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{event.title}</span>
                <span className="block text-xs text-muted-foreground">{event.subtitle}</span>
              </span>
            </AuraSurface>
          </li>
        ))}
      </ul>
    </section>
  );
};
