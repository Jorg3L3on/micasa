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

/** Pagos del mes + Adeudo al cierre as shared KPI tiles. */
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
        kpiTone="neutral"
        pillClassName="bg-status-expense-soft text-status-expense"
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
        kpiTone="neutral"
        pillClassName={
          outstandingTotal > 0
            ? 'bg-status-expense-soft text-status-expense'
            : 'bg-status-success-soft text-status-success'
        }
        icon={Landmark}
        amountClassName={
          outstandingTotal > 0 ? 'text-foreground' : 'text-status-success'
        }
      />
    </div>
  );
};

/** Payoff milestones for the selected month (“Terminas de pagar …”). */
/** Loan payoffs carry loan_id, MSI purchases expense_id, installment plans installment_plan_id. */
const projectionEventKey = (event: LiquidityProjectionEvent, index: number): string => {
  const id = event.loan_id ?? event.expense_id ?? event.installment_plan_id ?? `i${index}`;
  return `${event.event_type}-${id}-${event.event_date}`;
};

export const LiquidityMonthEvents = ({ events }: { events: LiquidityProjectionEvent[] }) => {
  if (events.length === 0) return null;

  return (
    <section className="space-y-2" aria-label="Buenas noticias del mes">
      <p className="flex items-center gap-1.5 px-1 eyebrow text-status-success">
        <Sparkles className="size-3" aria-hidden />
        Buenas noticias
      </p>
      <ul className="space-y-2" role="list">
        {events.map((event, index) => (
          <li key={projectionEventKey(event, index)}>
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
