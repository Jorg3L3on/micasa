'use client';

import {
  getFortnightRemainderCopy,
  type DueToPayCompositionRow,
} from '@/components/monthly/fortnight-summary-header';
import { CommitmentMeter } from '@/components/monthly/CommitmentMeter';
import { kpiMetricCardShellClass, type KpiMetricTone } from '@/components/finance/kpi-metric-card-styles';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { AuraSurface } from '@/components/aura/aura-surface';
import { AURA_TONE_HEX, getAuraBloomImage, type AuraTone } from '@/lib/ui/aura-palette';
import { Badge } from '@/components/ui/badge';
import { STATUS_SOFT_CLASS, type StatusTone } from '@/lib/status-tone';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CurrencyTicker } from '@/components/motion/number-ticker';
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

type CompositionInfoProps = {
  compositionRows: DueToPayCompositionRow[];
};

/** Info tooltip listing what the pending commitment includes. */
const CompositionInfo = ({ compositionRows }: CompositionInfoProps) => {
  if (compositionRows.length === 0) return null;
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label="Qué incluye pendiente"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground"
        >
          <Info className="h-3 w-3" aria-hidden data-icon="inline-start" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
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
  /** Health chip at the end of the eyebrow row (glass tiles). */
  badge?: { label: string; tone: StatusTone };
};

const AccountMetricBody = ({
  label,
  amount,
  subtitle,
  pillClassName,
  icon: Icon,
  amountClassName,
  badge,
}: AccountMetricProps) => (
  <>
    <div className="mb-1.5 flex items-center justify-between gap-1.5">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
            pillClassName,
          )}
        >
          <Icon className="h-3 w-3" aria-hidden data-icon="inline-start" />
        </span>
        <span className="eyebrow truncate text-muted-foreground">
          {label}
        </span>
      </span>
      {badge ? (
        <Badge
          variant="outline"
          className={cn(
            'h-5 shrink-0 rounded-full border-transparent px-2 text-caption font-semibold',
            STATUS_SOFT_CLASS[badge.tone],
          )}
        >
          {badge.label}
        </Badge>
      ) : null}
    </div>
    <p className="whitespace-nowrap">
      <CurrencyTicker
        value={amount}
        className={cn(
          badge ? 'text-2xl font-semibold tabular-nums' : 'text-lg font-bold sm:text-xl',
          amountClassName,
        )}
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

  if (props.glassSurface) {
    return (
      <div
        className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4')}
        style={{
          backgroundImage: getAuraBloomImage(
            AURA_TONE_HEX[props.auraTone ?? 'primary'],
          ),
        }}
        role="region"
        aria-label={props.label}
      >
        <AccountMetricBody {...props} />
      </div>
    );
  }

  return (
    <AuraSurface
      color={AURA_TONE_HEX[props.auraTone ?? 'primary']}
      animated
      className={cn(METRIC_STRIP_CLASS, 'rounded-xl px-3 py-2.5')}
    >
      <AccountMetricBody {...props} />
    </AuraSurface>
  );
};

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
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
        badge={
          fundingInAccounts < 0
            ? { label: 'Negativo', tone: 'expense' }
            : { label: 'Saludable', tone: 'success' }
        }
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
        badge={
          liquidityNegative
            ? { label: 'Déficit', tone: 'expense' }
            : { label: 'Saludable', tone: 'success' }
        }
      />
    </div>
  );
};

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
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
  const remainderClass = remainderToneClass[copy.tone];
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
      <CommitmentMeter
        periodIncome={periodIncome}
        paidAmount={paidAmount}
        pendingAmount={pendingAmount}
        cashCommittedAmount={cashCommittedAmount}
        leftoverAmount={leftoverAmount}
        paidSubtitle={paidSubtitle}
        pendingSubtitle={pendingSubtitle}
        showFree={!showIncomeRemainderBreakdown}
        showHeader={false}
        remainderEntry={
          showIncomeRemainderBreakdown
            ? {
                label: copy.rowLabel,
                amount: remainderAbs,
                amountClassName: cn(
                  copy.tone === 'shortfall' && 'text-destructive',
                  copy.tone === 'surplus' && remainderClass,
                ),
                subtitle: copy.gapNote ?? 'Del ingreso',
              }
            : undefined
        }
        pendingAdornment={<CompositionInfo compositionRows={compositionRows} />}
      />
    </div>
  );
};
