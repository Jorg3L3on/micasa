'use client';

import {
  getFortnightRemainderCopy,
  type DueToPayCompositionRow,
} from '@/components/monthly/fortnight-summary-header';
import { getFortnightCommitmentBar } from '@/components/monthly/fortnight-income-commitment';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { Banknote, Info, Wallet } from 'lucide-react';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Ingresos menos pagado, pendiente, nómina y resto de presupuesto. */
  incomeRemainder: number;
  /** Pagado + pendiente + nómina + presupuesto restante. */
  dueToPay: number;
  /** Saldos activos Efectivo + Débito (bruto, “en cuentas hoy”). */
  fundingInAccounts: number;
  /**
   * Efectivo/débito menos pendiente, nómina y resto de presupuesto
   * (“Liquidez actual” / billeteras vs pendiente).
   */
  fundingLiquidity?: number;
  /**
   * Si false, se ocultan las tarjetas Balance actual y Liquidez actual
   * (solo quincena calendario en curso o la siguiente).
   */
  fundingLiquidityApplies?: boolean;
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
  /** Deducciones de nómina incluidas en toca pagar / pendiente de la barra. */
  payrollDeductionAmount?: number;
};

const remainderToneClass: Record<
  ReturnType<typeof getFortnightRemainderCopy>['tone'],
  string
> = {
  surplus: 'text-emerald-600 dark:text-emerald-400',
  shortfall: 'text-destructive',
  even: 'text-foreground',
};

const commitmentCaptionClass: Record<
  ReturnType<typeof getFortnightCommitmentBar>['tone'],
  string
> = {
  ok: 'text-muted-foreground',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
};

const ratioToPercent = (ratio: number) => `${Math.max(0, ratio).toFixed(4)}%`;

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
  const {
    paidPercent,
    pendingPercent,
    budgetPercent,
    freePercent,
    incomeMarkerPercent,
    totalCommittedPercent,
    tone,
  } = getFortnightCommitmentBar(
    periodIncome,
    paidAmount,
    cashCommittedAmount,
    leftoverAmount,
  );

  if (periodIncome <= 0 && totalCommittedPercent === 0) {
    return null;
  }

  const overIncomePercent = Math.max(0, totalCommittedPercent - 100);

  return (
    <div className="space-y-1.5">
      <div className="relative pt-1.5">
        {incomeMarkerPercent != null ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="absolute top-0 z-10 flex h-full w-4 -translate-x-1/2 flex-col items-center"
                style={{ left: ratioToPercent(incomeMarkerPercent) }}
                aria-label="Aquí termina tu ingreso"
              >
                <span
                  className="mb-px h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent border-t-foreground"
                  aria-hidden
                />
                <span
                  className="w-0.5 flex-1 rounded-full bg-foreground ring-1 ring-background"
                  aria-hidden
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              Aquí termina tu ingreso
            </TooltipContent>
          </Tooltip>
        ) : null}
        <div
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/50"
          role="progressbar"
          aria-valuenow={totalCommittedPercent}
          aria-valuemin={0}
          aria-valuemax={Math.max(100, totalCommittedPercent)}
          aria-label={`${totalCommittedPercent}% del ingreso comprometido`}
        >
          {paidPercent > 0.0001 ? (
            <div
              className="h-full bg-emerald-500 transition-[width] duration-500 dark:bg-emerald-400"
              style={{ width: ratioToPercent(paidPercent) }}
            />
          ) : null}
          {pendingPercent > 0.0001 ? (
            <div
              className="h-full bg-amber-400 transition-[width] duration-500 dark:bg-amber-500"
              style={{ width: ratioToPercent(pendingPercent) }}
            />
          ) : null}
          {budgetPercent > 0.0001 ? (
            <div
              className="h-full bg-violet-500 transition-[width] duration-500 dark:bg-violet-400"
              style={{ width: ratioToPercent(budgetPercent) }}
            />
          ) : null}
          {freePercent > 0.0001 ? (
            <div
              className="h-full bg-muted-foreground/25 transition-[width] duration-500"
              style={{ width: ratioToPercent(freePercent) }}
            />
          ) : null}
        </div>
      </div>
      <p className={cn('text-[11px]', commitmentCaptionClass[tone])}>
        <span className="font-mono font-semibold tabular-nums">
          {totalCommittedPercent}%
        </span>{' '}
        comprometido
        {overIncomePercent > 0 ? (
          <>
            {' '}
            · {overIncomePercent}% arriba de tu ingreso
          </>
        ) : null}
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

type AccountMetricProps = {
  label: string;
  amount: number;
  subtitle: string;
  borderClassName: string;
  pillClassName: string;
  icon: typeof Banknote;
  amountClassName: string;
};

const AccountMetric = ({
  label,
  amount,
  subtitle,
  borderClassName,
  pillClassName,
  icon: Icon,
  amountClassName,
}: AccountMetricProps) => (
  <div
    className={cn(
      METRIC_STRIP_CLASS,
      'border-l-[3px] px-2.5 py-2',
      borderClassName,
    )}
  >
    <div className="mb-1.5 flex items-center gap-1.5">
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
          pillClassName,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden data-icon="inline-start" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
    <p
      className={cn(
        'font-mono text-lg font-bold tabular-nums whitespace-nowrap sm:text-xl',
        amountClassName,
      )}
    >
      {formatCurrency(amount)}
    </p>
    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
      {subtitle}
    </p>
  </div>
);

type LegendItemProps = {
  label: string;
  amount: number;
  subtitle: string;
  dotClassName: string;
};

const LegendItem = ({
  label,
  amount,
  subtitle,
  dotClassName,
}: LegendItemProps) => (
  <div className="min-w-0">
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClassName)}
          aria-hidden
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </span>
      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
        {formatCurrency(amount)}
      </span>
    </div>
    <p className="mt-0.5 pl-3 text-[10px] text-muted-foreground">{subtitle}</p>
  </div>
);

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
  dueToPay,
  fundingInAccounts,
  fundingLiquidity = 0,
  fundingLiquidityApplies = true,
  paidAmount,
  pendingAmount,
  cashCommittedAmount,
  expenseCount = 0,
  paidExpenseCount = 0,
  unpaidExpenseCount = 0,
  compositionRows = [],
  leftoverAmount = 0,
  payrollDeductionAmount = 0,
}: FortnightSummaryHeroProps) => {
  const copy = getFortnightRemainderCopy(incomeRemainder);
  const remainderAbs = Math.abs(incomeRemainder);
  const showLeftover = leftoverAmount > 0;
  const remainderClass = remainderToneClass[copy.tone];
  const dueToPayCash = dueToPay - leftoverAmount;
  const freeAmount = Math.max(
    0,
    periodIncome - cashCommittedAmount - leftoverAmount,
  );
  const liquidityNegative = fundingLiquidity < 0;

  const paidSubtitle =
    expenseCount > 0
      ? `${paidExpenseCount} de ${expenseCount} gastos`
      : '—';
  const pendingCountLabel =
    expenseCount > 0
      ? `${unpaidExpenseCount} gasto${unpaidExpenseCount !== 1 ? 's' : ''}`
      : null;
  const pendingSubtitle = [
    pendingCountLabel,
    payrollDeductionAmount > 0 ? 'incluye nómina' : null,
  ]
    .filter(Boolean)
    .join(' · ') || '—';

  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-col gap-4 @3xl:flex-row @3xl:items-start @3xl:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {fundingLiquidityApplies ? (
          <div className="grid grid-cols-2 gap-2">
            <AccountMetric
              label="Balance actual"
              amount={fundingInAccounts}
              subtitle="Efectivo + débito hoy"
              borderClassName="border-l-emerald-500/50"
              pillClassName="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              icon={Banknote}
              amountClassName={
                fundingInAccounts < 0 ? 'text-destructive' : 'text-foreground'
              }
            />
            <AccountMetric
              label="Liquidez actual"
              amount={fundingLiquidity}
              subtitle="Tras pendientes y presupuesto"
              borderClassName={
                liquidityNegative
                  ? 'border-l-destructive/60'
                  : 'border-l-emerald-500/50'
              }
              pillClassName={
                liquidityNegative
                  ? 'bg-destructive/10 text-destructive dark:bg-destructive/15'
                  : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
              }
              icon={Wallet}
              amountClassName={
                liquidityNegative
                  ? 'text-destructive'
                  : 'text-emerald-700 dark:text-emerald-300'
              }
            />
          </div>
        ) : null}

        <CommitmentBar
          periodIncome={periodIncome}
          paidAmount={paidAmount}
          cashCommittedAmount={cashCommittedAmount}
          leftoverAmount={leftoverAmount}
        />

        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <LegendItem
            label="Pagado"
            amount={paidAmount}
            subtitle={paidSubtitle}
            dotClassName="bg-emerald-500 dark:bg-emerald-400"
          />
          <LegendItem
            label="Pendiente"
            amount={pendingAmount}
            subtitle={pendingSubtitle}
            dotClassName="bg-amber-400 dark:bg-amber-500"
          />
          {showLeftover ? (
            <LegendItem
              label="Presupuesto"
              amount={leftoverAmount}
              subtitle="Aún no gastado"
              dotClassName="bg-violet-500 dark:bg-violet-400"
            />
          ) : null}
          {freeAmount > 0 ? (
            <LegendItem
              label="Libre"
              amount={freeAmount}
              subtitle="Del ingreso"
              dotClassName="bg-muted-foreground/40"
            />
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <dl className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[13px] text-muted-foreground">Entra</dt>
            <dd className="font-mono text-[13px] font-medium tabular-nums text-foreground">
              {formatCurrency(periodIncome)}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <dt className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
              <span className="font-medium text-muted-foreground/80" aria-hidden>
                −
              </span>
              <DueToPayLabel compositionRows={compositionRows} />
            </dt>
            <dd className="font-mono text-[13px] font-medium tabular-nums text-foreground">
              {formatCurrency(dueToPayCash)}
            </dd>
          </div>

          {showLeftover ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
                <span className="font-medium text-muted-foreground/80" aria-hidden>
                  −
                </span>
                <span>Presupuesto</span>
              </dt>
              <dd className="font-mono text-[13px] font-medium tabular-nums text-foreground">
                {formatCurrency(leftoverAmount)}
              </dd>
            </div>
          ) : null}
        </dl>

        <div
          className={cn(
            METRIC_STRIP_CLASS,
            'border-l-[3px] px-2.5 py-2',
            copy.tone === 'shortfall'
              ? 'border-l-destructive/60'
              : 'border-l-emerald-500/50',
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                remainderClass,
              )}
            >
              {copy.rowLabel}
            </span>
            <span
              className={cn(
                'font-mono text-lg font-bold tabular-nums',
                remainderClass,
              )}
            >
              {formatCurrency(remainderAbs)}
            </span>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
