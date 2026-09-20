'use client';

import {
  getFortnightRemainderCopy,
  type DueToPayCompositionRow,
} from '@/components/monthly/fortnight-summary-header';
import { getFortnightIncomeGaugeSegments } from '@/components/monthly/fortnight-income-commitment';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { Info } from 'lucide-react';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Ingresos menos pagado, pendiente, nómina y resto de presupuesto. */
  incomeRemainder: number;
  /** Pagado + pendiente + nómina + presupuesto restante. */
  dueToPay: number;
  /** Saldos activos Efectivo + Débito (bruto, “en cuentas hoy”). */
  fundingInAccounts: number;
  paidAmount: number;
  pendingAmount: number;
  /** Pagado + pendiente + nómina (segmento de efectivo del compromiso). */
  cashCommittedAmount: number;
  expenseCount?: number;
  paidExpenseCount?: number;
  unpaidExpenseCount?: number;
  compositionRows?: DueToPayCompositionRow[];
  /** Resto del presupuesto de la quincena (“Del presupuesto”). */
  leftoverAmount?: number;
};

const remainderToneClass: Record<
  ReturnType<typeof getFortnightRemainderCopy>['tone'],
  string
> = {
  surplus: 'text-emerald-600 dark:text-emerald-400',
  shortfall: 'text-destructive',
  even: 'text-foreground',
};

const ratioToPercent = (ratio: number) =>
  `${Math.max(0, Math.min(100, ratio * 100)).toFixed(4)}%`;

type CommitmentBarProps = {
  periodIncome: number;
  paidAmount: number;
  cashCommittedAmount: number;
  leftoverAmount: number;
};

const CommitmentBar = ({
  periodIncome,
  paidAmount,
  cashCommittedAmount,
  leftoverAmount,
}: CommitmentBarProps) => {
  const { cashRatio, budgetRatio, freeRatio, totalCommittedPercent } =
    getFortnightIncomeGaugeSegments(
      periodIncome,
      cashCommittedAmount,
      leftoverAmount,
    );

  const cashTotal = Math.max(0, cashCommittedAmount);
  const paidShare = cashTotal > 0 ? Math.max(0, paidAmount) / cashTotal : 0;
  const pendingShare = cashTotal > 0 ? 1 - paidShare : 0;
  const paidRatio = cashRatio * paidShare;
  const pendingRatio = cashRatio * pendingShare + budgetRatio;

  if (periodIncome <= 0 && totalCommittedPercent === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted/50"
        role="progressbar"
        aria-valuenow={totalCommittedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${totalCommittedPercent}% del ingreso comprometido`}
      >
        {paidRatio > 0.0001 ? (
          <div
            className="h-full bg-emerald-500 transition-[width] duration-500 dark:bg-emerald-400"
            style={{ width: ratioToPercent(paidRatio) }}
          />
        ) : null}
        {pendingRatio > 0.0001 ? (
          <div
            className="h-full bg-amber-400 transition-[width] duration-500 dark:bg-amber-500"
            style={{ width: ratioToPercent(pendingRatio) }}
          />
        ) : null}
        {freeRatio > 0.0001 ? (
          <div
            className="h-full bg-teal-500/80 transition-[width] duration-500 dark:bg-[#2dd4bf]/80"
            style={{ width: ratioToPercent(freeRatio) }}
          />
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {totalCommittedPercent}%
        </span>{' '}
        comprometido
      </p>
    </div>
  );
};

type DueToPayLabelProps = {
  compositionRows: DueToPayCompositionRow[];
};

const DueToPayLabel = ({ compositionRows }: DueToPayLabelProps) => {
  if (compositionRows.length === 0) {
    return <span>Toca pagar</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>Toca pagar</span>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground"
            aria-label="Qué incluye toca pagar"
          >
            <Info className="h-3 w-3" aria-hidden data-icon="inline-start" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-[16rem] space-y-1.5 px-3 py-2 text-left"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-background/70">
            Qué incluye
          </p>
          <ul className="space-y-1">
            {compositionRows.map((row) => (
              <li
                key={row.label}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-background/85">{row.label}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </span>
  );
};

type MetricTileProps = {
  label: string;
  amount: number;
  subtitle: string;
  borderClassName: string;
  dotClassName: string;
};

const MetricTile = ({
  label,
  amount,
  subtitle,
  borderClassName,
  dotClassName,
}: MetricTileProps) => (
  <div
    className={cn(METRIC_STRIP_CLASS, 'border-l-[3px] px-2.5 py-2', borderClassName)}
  >
    <div className="mb-1 flex items-center gap-1.5">
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClassName)}
        aria-hidden
      />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
    <p className="font-mono text-sm font-bold tabular-nums text-foreground">
      {formatCurrency(amount)}
    </p>
    <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>
  </div>
);

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
  dueToPay,
  fundingInAccounts,
  paidAmount,
  pendingAmount,
  cashCommittedAmount,
  expenseCount = 0,
  paidExpenseCount = 0,
  unpaidExpenseCount = 0,
  compositionRows = [],
  leftoverAmount = 0,
}: FortnightSummaryHeroProps) => {
  const copy = getFortnightRemainderCopy(incomeRemainder);
  const remainderAbs = Math.abs(incomeRemainder);
  const showLeftover = leftoverAmount > 0;
  const remainderClass = remainderToneClass[copy.tone];

  const paidSubtitle =
    expenseCount > 0 ? `${paidExpenseCount}/${expenseCount}` : '—';
  const pendingSubtitle =
    expenseCount > 0
      ? `${unpaidExpenseCount} gasto${unpaidExpenseCount !== 1 ? 's' : ''}`
      : '—';

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Balance actual</p>
          <p
            className={cn(
              'mt-1 font-[family-name:var(--font-display)] font-mono text-[1.85rem] font-bold leading-none tracking-tight tabular-nums sm:text-[2.15rem]',
              fundingInAccounts < 0 ? 'text-destructive' : 'text-foreground',
            )}
          >
            {formatCurrency(fundingInAccounts)}
          </p>
        </div>

        <CommitmentBar
          periodIncome={periodIncome}
          paidAmount={paidAmount}
          cashCommittedAmount={cashCommittedAmount}
          leftoverAmount={leftoverAmount}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <dl className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Entra</dt>
            <dd className="font-mono text-sm font-medium tabular-nums text-foreground sm:text-[15px]">
              {formatCurrency(periodIncome)}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <dt className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <span className="font-medium text-muted-foreground/80" aria-hidden>
                −
              </span>
              <DueToPayLabel compositionRows={compositionRows} />
            </dt>
            <dd className="font-mono text-sm font-medium tabular-nums text-foreground sm:text-[15px]">
              {formatCurrency(dueToPay)}
            </dd>
          </div>

          <div className="border-t border-border/50 pt-2">
            <div className="flex items-baseline justify-between gap-4">
              <dt
                className={cn(
                  'flex items-center gap-1 text-sm font-semibold',
                  remainderClass,
                )}
              >
                <span aria-hidden>=</span>
                <span>{copy.rowLabel}</span>
              </dt>
              <dd
                className={cn(
                  'font-mono text-sm font-bold tabular-nums sm:text-[15px]',
                  remainderClass,
                )}
              >
                {formatCurrency(remainderAbs)}
              </dd>
            </div>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-2">
          <MetricTile
            label="Pagado"
            amount={paidAmount}
            subtitle={paidSubtitle}
            borderClassName="border-l-emerald-500/50"
            dotClassName="bg-emerald-500 dark:bg-emerald-400"
          />
          <MetricTile
            label="Pendiente"
            amount={pendingAmount}
            subtitle={pendingSubtitle}
            borderClassName="border-l-amber-500/50"
            dotClassName="bg-amber-400 dark:bg-amber-500"
          />
        </div>

        {showLeftover ? (
          <div className="flex items-baseline justify-between gap-4 border-t border-border/50 pt-3">
            <span className="text-sm text-muted-foreground">Del presupuesto</span>
            <span className="font-mono text-sm font-medium tabular-nums text-foreground sm:text-[15px]">
              {formatCurrency(leftoverAmount)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
