'use client';

import {
  getFortnightRemainderCopy,
  type DueToPayCompositionRow,
} from '@/components/monthly/fortnight-summary-header';
import { getFortnightCommitmentBar } from '@/components/monthly/fortnight-income-commitment';
import { kpiMetricCardShellClass, type KpiMetricTone } from '@/components/finance/kpi-metric-card-styles';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { AuraSurface } from '@/components/aura/aura-surface';
import { AURA_TONE_HEX, type AuraTone } from '@/lib/ui/aura-palette';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Money } from '@/components/money';
import { CurrencyTicker } from '@/components/motion/number-ticker';
import { STATUS_FILL_CLASS } from '@/lib/status-tone';
import { cn, formatCurrency } from '@/lib/utils';
import { Banknote, Info, Wallet } from 'lucide-react';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Ingresos menos pagado, pendiente, nómina y resto de presupuesto. */
  incomeRemainder: number;
  /** Pagado + pendiente + nómina + presupuesto restante. */
  dueToPay: number;
  /**
   * Entra / toca pagar / te falta. En la quincena en curso se oculta:
   * Liquidez actual ya responde “¿alcanza el efectivo?”.
   */
  showIncomeRemainderBreakdown?: boolean;
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
  /** Cards with debt and a due date but no statement payment. Blocks green Alcanza. */
  obligationGapCount?: number;
};

const remainderToneClass: Record<
  ReturnType<typeof getFortnightRemainderCopy>['tone'],
  string
> = {
  surplus: 'text-status-income',
  shortfall: 'text-foreground',
  even: 'text-foreground',
  gap: 'text-status-pending',
};

const commitmentCaptionClass: Record<
  ReturnType<typeof getFortnightCommitmentBar>['tone'],
  string
> = {
  ok: 'text-muted-foreground',
  warning: 'text-status-pending',
  danger: 'text-status-expense',
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
              className="h-full bg-status-success transition-[width] duration-500"
              style={{ width: ratioToPercent(paidPercent) }}
            />
          ) : null}
          {pendingPercent > 0.0001 ? (
            <div
              className="h-full bg-status-pending transition-[width] duration-500"
              style={{ width: ratioToPercent(pendingPercent) }}
            />
          ) : null}
          {budgetPercent > 0.0001 ? (
            <div
              className="h-full bg-status-info transition-[width] duration-500"
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
      <p className={cn('text-caption', commitmentCaptionClass[tone])}>
        <span className="font-sans font-semibold tabular-nums">
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
          <p className="eyebrow text-background/70">
            Qué incluye
          </p>
          <ul className="space-y-1">
            {compositionRows.map((row) => (
              <li
                key={row.label}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-background/85">{row.label}</span>
                <span className="font-sans tabular-nums">
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
  auraTone?: AuraTone;
  /** When set, the tile uses the shared KPI shell instead of an aura surface. */
  kpiTone?: KpiMetricTone;
  /** Panel glass face (no bloom or grid) so the tile matches the planner panels; keeps the tinted border and shine. */
  glassSurface?: boolean;
  pillClassName: string;
  icon: typeof Banknote;
  amountClassName: string;
};

const AccountMetricBody = ({
  label,
  amount,
  subtitle,
  pillClassName,
  icon: Icon,
  amountClassName,
}: AccountMetricProps) => (
  <>
    <div className="mb-1.5 flex items-center gap-1.5">
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
          pillClassName,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden data-icon="inline-start" />
      </span>
      <span className="eyebrow text-muted-foreground">
        {label}
      </span>
    </div>
    <p className="whitespace-nowrap">
      <CurrencyTicker
        value={amount}
        className={cn('text-lg font-bold sm:text-xl', amountClassName)}
      />
    </p>
    <p className="mt-0.5 text-caption leading-snug text-muted-foreground">
      {subtitle}
    </p>
  </>
);

/** Aura hero tile (Balance actual / Liquidez actual); reused by Liquidez month metrics. */
export const AccountMetric = (props: AccountMetricProps) => {
  if (props.kpiTone) {
    return (
      <div className={kpiMetricCardShellClass(props.kpiTone)} role="region" aria-label={props.label}>
        <AccountMetricBody {...props} />
      </div>
    );
  }

  return (
    <AuraSurface
      color={AURA_TONE_HEX[props.auraTone ?? 'primary']}
      animated
      grid={!props.glassSurface}
      style={props.glassSurface ? { backgroundImage: 'none' } : undefined}
      className={cn(
        props.glassSurface ? MONTHLY_LIQUID_PANEL_CLASS : METRIC_STRIP_CLASS,
        'rounded-xl px-3 py-2.5',
      )}
    >
      <AccountMetricBody {...props} />
    </AuraSurface>
  );
};

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
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClassName)}
        aria-hidden
      />
      <span className="eyebrow min-w-0 truncate text-muted-foreground">
        {label}
      </span>
    </div>
    <Money
      value={amount}
      size="caption"
      tone="neutral"
      className="mt-1 block pl-3"
    />
    <p className="mt-0.5 pl-3 text-caption text-muted-foreground">{subtitle}</p>
  </div>
);

type FortnightAccountMetricsProps = {
  /** Saldos activos Efectivo + Débito (bruto, “en cuentas hoy”). */
  fundingInAccounts: number;
  /** Efectivo/débito menos pendiente, nómina y resto de presupuesto. */
  fundingLiquidity: number;
};

/** Balance actual + Liquidez actual tiles; only for the current or next calendar quincena. */
export const FortnightAccountMetrics = ({
  fundingInAccounts,
  fundingLiquidity,
}: FortnightAccountMetricsProps) => {
  const liquidityNegative = fundingLiquidity < 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <AccountMetric
        label="Balance actual"
        amount={fundingInAccounts}
        subtitle="Efectivo + débito hoy"
        glassSurface
        auraTone={fundingInAccounts < 0 ? 'destructive' : 'emerald'}
        pillClassName={
          fundingInAccounts < 0
            ? 'bg-status-expense-soft text-status-expense'
            : 'bg-status-income-soft text-status-income'
        }
        icon={Banknote}
        amountClassName="text-foreground"
      />
      <AccountMetric
        label="Liquidez actual"
        amount={fundingLiquidity}
        subtitle="Tras pendientes y presupuesto"
        glassSurface
        auraTone={liquidityNegative ? 'destructive' : 'emerald'}
        pillClassName={
          liquidityNegative
            ? 'bg-status-expense-soft text-status-expense'
            : 'bg-status-income-soft text-status-income'
        }
        icon={Wallet}
        amountClassName={
          liquidityNegative ? 'text-foreground' : 'text-status-income'
        }
      />
    </div>
  );
};

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
  dueToPay,
  showIncomeRemainderBreakdown = true,
  paidAmount,
  pendingAmount,
  cashCommittedAmount,
  expenseCount = 0,
  paidExpenseCount = 0,
  unpaidExpenseCount = 0,
  compositionRows = [],
  leftoverAmount = 0,
  payrollDeductionAmount = 0,
  obligationGapCount = 0,
}: FortnightSummaryHeroProps) => {
  const copy = getFortnightRemainderCopy(incomeRemainder, { obligationGapCount });
  const remainderAbs = Math.abs(incomeRemainder);
  const showLeftover = leftoverAmount > 0;
  const remainderClass = remainderToneClass[copy.tone];
  const dueToPayCash = dueToPay - leftoverAmount;
  const freeAmount = Math.max(
    0,
    periodIncome - cashCommittedAmount - leftoverAmount,
  );
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
        <CommitmentBar
          periodIncome={periodIncome}
          paidAmount={paidAmount}
          cashCommittedAmount={cashCommittedAmount}
          leftoverAmount={leftoverAmount}
        />

        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {paidAmount > 0 ? (
            <LegendItem
              label="Pagado"
              amount={paidAmount}
              subtitle={paidSubtitle}
              dotClassName={STATUS_FILL_CLASS.success}
            />
          ) : null}
          <LegendItem
            label="Pendiente"
            amount={pendingAmount}
            subtitle={pendingSubtitle}
            dotClassName={STATUS_FILL_CLASS.pending}
          />
          {showLeftover ? (
            <LegendItem
              label="Presupuesto"
              amount={leftoverAmount}
              subtitle="Aún no gastado"
              dotClassName={STATUS_FILL_CLASS.info}
            />
          ) : null}
          {freeAmount > 0 && !showIncomeRemainderBreakdown ? (
            <LegendItem
              label="Libre"
              amount={freeAmount}
              subtitle="Del ingreso"
              dotClassName="bg-muted-foreground/40"
            />
          ) : null}
        </div>
      </div>

      {showIncomeRemainderBreakdown ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <dl className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body text-muted-foreground">Entra</dt>
              <dd>
                <CurrencyTicker
                  value={periodIncome}
                  className="text-body font-medium text-foreground"
                />
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <dt className="flex min-w-0 items-center gap-1 text-body text-muted-foreground">
                <span
                  className="font-medium text-muted-foreground/80"
                  aria-hidden
                >
                  −
                </span>
                <DueToPayLabel compositionRows={compositionRows} />
              </dt>
              <dd>
                <CurrencyTicker
                  value={dueToPayCash}
                  className="text-body font-medium text-foreground"
                />
              </dd>
            </div>

            {showLeftover ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="flex min-w-0 items-center gap-1 text-body text-muted-foreground">
                  <span
                    className="shrink-0 font-medium text-muted-foreground/80"
                    aria-hidden
                  >
                    −
                  </span>
                  <span className="min-w-0 truncate">Presupuesto</span>
                </dt>
                <dd className="shrink-0">
                  <Money value={leftoverAmount} size="row" tone="neutral" />
                </dd>
              </div>
            ) : null}
          </dl>

          <AuraSurface
            color={
              AURA_TONE_HEX[
                copy.tone === 'shortfall'
                  ? 'destructive'
                  : copy.gapNote
                    ? 'amber'
                    : 'emerald'
              ]
            }
            grid={false}
            style={{ backgroundImage: 'none' }}
            className="rounded-xl border bg-transparent px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  'eyebrow',
                  remainderClass,
                )}
              >
                {copy.rowLabel}
              </span>
              <CurrencyTicker
                value={remainderAbs}
                className={cn('text-lg font-bold', remainderClass)}
              />
            </div>
            {copy.gapNote ? (
              <p className="mt-1 text-caption font-medium text-status-pending">
                {copy.gapNote}
              </p>
            ) : null}
          </AuraSurface>
        </div>
      ) : null}
    </div>
    </div>
  );
};
