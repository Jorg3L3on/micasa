'use client';

import {
  CalendarClock,
  Check,
  Landmark,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { CurrencyTicker } from '@/components/motion/number-ticker';
import { formatShortMonthLabel } from '@/components/wallets/liquidity/liquidity-personalization';
import { formatDisplayDate } from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';
import { AuraSurface } from '@/components/aura/aura-surface';
import { AURA_TONE_HEX } from '@/lib/ui/aura-palette';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
} from '@/types/catalog';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';

const countLabel = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

/** Whole pesos for the legend and change chip; the tile amount keeps cents. */
const WHOLE_PESOS = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});
const formatWholePesos = (value: number): string => WHOLE_PESOS.format(Math.round(value));

type DebtItem = NonNullable<LiquidityMonthlySeriesItem['debt_items']>[number];

/** Cards and compras a meses share the info tone; loans use pending, as in the debt list pills. */
const SPLIT_TONES = [
  { key: 'cards', label: 'Tarjetas', bar: 'bg-status-info', dot: 'bg-status-info' },
  { key: 'loans', label: 'Préstamos', bar: 'bg-status-pending', dot: 'bg-status-pending' },
] as const;

type SplitKey = (typeof SPLIT_TONES)[number]['key'];

const splitBy = (
  items: readonly DebtItem[],
  value: (item: DebtItem) => number,
): Record<SplitKey, number> =>
  items.reduce<Record<SplitKey, number>>(
    (acc, item) => {
      const key: SplitKey = item.kind === 'loan' ? 'loans' : 'cards';
      acc[key] += Math.max(0, value(item));
      return acc;
    },
    { cards: 0, loans: 0 },
  );

/** Stacked bar plus a two-row legend; rows with $0 are hidden. */
const SplitBreakdown = ({ split }: { split: Record<SplitKey, number> }) => {
  const total = split.cards + split.loans;
  const rows = SPLIT_TONES.filter((tone) => split[tone.key] > 0.004);

  return (
    <div className="mt-2.5 space-y-2">
      <div
        className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted/60 dark:bg-white/[0.07]"
        aria-hidden
      >
        {total > 0
          ? rows.map((tone) => (
              <span
                key={tone.key}
                className={cn('h-full rounded-full', tone.bar)}
                style={{ width: `${(split[tone.key] / total) * 100}%` }}
              />
            ))
          : null}
      </div>
      {rows.length > 0 ? (
        <dl className="space-y-1">
          {rows.map((tone) => (
            <div key={tone.key} className="flex items-center justify-between gap-2 text-caption">
              <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden />
                <span className="truncate">{tone.label}</span>
              </dt>
              <dd className="shrink-0 font-sans font-medium tabular-nums text-foreground">
                {formatWholePesos(split[tone.key])}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
};

type MonthTileProps = {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  amount: number;
  amountClassName?: string;
  /** One short line or chip under the amount. */
  meta: React.ReactNode;
  split: Record<SplitKey, number>;
};

const MonthTile = ({
  label,
  icon: Icon,
  iconClassName,
  amount,
  amountClassName,
  meta,
  split,
}: MonthTileProps) => (
  <div
    className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/70 p-2.5 shadow-card sm:p-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
    role="region"
    aria-label={label}
  >
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'hidden size-6 shrink-0 items-center justify-center rounded-lg sm:flex',
          iconClassName,
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <span className="eyebrow min-w-0 leading-tight text-muted-foreground">{label}</span>
    </div>
    <p className="mt-2 whitespace-nowrap">
      <CurrencyTicker
        value={amount}
        className={cn('text-xl font-bold tracking-tight sm:text-2xl', amountClassName ?? 'text-foreground')}
      />
    </p>
    <div className="mt-1 min-h-5">{meta}</div>
    <SplitBreakdown split={split} />
  </div>
);

type LiquidityMonthMetricsProps = {
  month: LiquidityMonthlySeriesItem;
  /** Month before, for the "vs" change on Adeudo al cierre. */
  previousMonth?: LiquidityMonthlySeriesItem | null;
};

/** Pagos del mes + Adeudo al cierre: amount, cards vs loans split, and one line of context. */
export const LiquidityMonthMetrics = ({ month, previousMonth }: LiquidityMonthMetricsProps) => {
  const debtItems = month.debt_items ?? [];
  const paymentsDue = monthDebtPaymentsTotal(debtItems);
  const outstandingTotal = month.outstanding_debt_total ?? 0;
  const paying = debtItems.filter((item) => (item.payment_amount ?? 0) > 0);
  const outstandingCount = debtItems.filter((item) => item.amount > 0).length;
  const nextDue = paying
    .map((item) => item.due_date)
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  const previousOutstanding = previousMonth?.outstanding_debt_total ?? null;
  const delta = previousOutstanding == null ? null : outstandingTotal - previousOutstanding;
  const previousLabel = previousMonth ? formatShortMonthLabel(previousMonth.month_key) : '';
  const isDebtFree = outstandingTotal <= 0.004;

  const paymentsMeta =
    paying.length > 0 ? (
      <p className="text-caption text-muted-foreground">
        {countLabel(paying.length, 'pago', 'pagos')}
        {nextDue ? ` · el primero ${formatDisplayDate(nextDue)}` : ''}
      </p>
    ) : (
      <p className="text-caption text-muted-foreground">Sin pagos de deudas</p>
    );

  const outstandingMeta =
    delta != null && Math.abs(delta) >= 0.005 ? (
      <span
        className={cn(
          'inline-flex h-5 max-w-full items-center gap-1 rounded-full border px-1.5 text-caption font-medium tabular-nums',
          delta < 0
            ? 'border-status-success/30 bg-status-success-soft text-status-success'
            : 'border-status-expense/30 bg-status-expense-soft text-status-expense',
        )}
      >
        {delta < 0 ? (
          <TrendingDown className="size-3 shrink-0" aria-hidden />
        ) : (
          <TrendingUp className="size-3 shrink-0" aria-hidden />
        )}
        <span className="truncate">
          {formatWholePesos(Math.abs(delta))} vs {previousLabel}
        </span>
      </span>
    ) : (
      <p className="text-caption text-muted-foreground">
        {isDebtFree
          ? 'Sin deudas al cierre'
          : countLabel(outstandingCount, 'cuenta con saldo', 'cuentas con saldo')}
      </p>
    );

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3" role="region" aria-label="Deudas del mes">
      <MonthTile
        label="Pagos del mes"
        icon={CalendarClock}
        iconClassName="bg-status-expense-soft text-status-expense"
        amount={paymentsDue}
        meta={paymentsMeta}
        split={splitBy(debtItems, (item) => item.payment_amount ?? 0)}
      />
      <MonthTile
        label="Adeudo al cierre"
        icon={isDebtFree ? Check : Landmark}
        iconClassName={
          isDebtFree
            ? 'bg-status-success-soft text-status-success'
            : 'bg-status-pending-soft text-status-pending'
        }
        amount={outstandingTotal}
        amountClassName={isDebtFree ? 'text-status-success' : undefined}
        meta={outstandingMeta}
        split={splitBy(debtItems, (item) => item.amount)}
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
