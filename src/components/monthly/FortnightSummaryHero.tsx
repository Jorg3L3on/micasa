'use client';

import type { ReactNode } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Wallet } from 'lucide-react';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Efectivo/débito comprometido: pagado + pendiente + deducciones. */
  committedAmount: number;
  /** Ingresos menos pagado y pendiente (vista planificación). */
  incomeRemainder: number;
  /** Saldos efectivo/débito menos pendiente de la quincena. */
  fundingNetInAccounts: number;
  /** Si false, el neto en cuentas no aplica a esta quincena (muestra 0). */
  fundingNetApplies?: boolean;
  /** Deducciones de nómina pendientes incluidas en incomeRemainder. */
  payrollDeductionAmount?: number;
};

const stepBaseClass =
  'group relative min-h-32 overflow-hidden rounded-xl border border-border/60 bg-card/60 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md';

const stepNumberClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold';

export const FortnightSummaryHero = ({
  periodIncome,
  committedAmount,
  incomeRemainder,
  fundingNetInAccounts,
  fundingNetApplies = true,
  payrollDeductionAmount = 0,
}: FortnightSummaryHeroProps) => {
  const displayFundingNet = fundingNetApplies ? fundingNetInAccounts : 0;
  const incomeColumnPct = 44;
  const splitColumnPct = 100 - incomeColumnPct;
  const positiveRemainder = Math.max(incomeRemainder, 0);
  const splitTotal = Math.max(committedAmount + positiveRemainder, 1);
  const hasCommittedExpenses = committedAmount > 0;
  const rawExpensePct =
    hasCommittedExpenses
      ? splitColumnPct * (committedAmount / splitTotal)
      : 10;
  const rawAvailablePct =
    positiveRemainder > 0
      ? splitColumnPct * (positiveRemainder / splitTotal)
      : 8;
  const splitScale = splitColumnPct / (rawExpensePct + rawAvailablePct);
  const expenseColumnPct = rawExpensePct * splitScale;
  const availableColumnPct = rawAvailablePct * splitScale;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
        <SummaryStep
          number="1"
          title="Entró"
          subtitle="Ingresos totales"
          amount={periodIncome}
          tone="income"
          icon={<ArrowDownLeft className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        />
        <SummaryStep
          number="2"
          title="Se fue en gastos"
          subtitle={
            payrollDeductionAmount > 0
              ? 'Gastos + deducciones'
              : 'Total gastado'
          }
          amount={committedAmount}
          tone="expense"
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        />
        <SummaryStep
          number="3"
          title="Queda disponible"
          subtitle="Disponible para usar"
          amount={incomeRemainder}
          tone="available"
          icon={<Wallet className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        />
        <SummaryStep
          number="4"
          title="Saldo real"
          subtitle={
            fundingNetApplies
              ? 'Después de pendientes'
              : 'No aplica a esta quincena'
          }
          amount={displayFundingNet}
          tone="real"
          icon={<CreditCard className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        />
      </div>

      <div
        className="overflow-hidden rounded-xl border border-border/60 bg-background/45 p-2.5 shadow-inner"
        aria-label="Ingresos menos gastos igual a disponible"
      >
        <div
          className="grid h-[4.75rem] overflow-hidden rounded-lg border border-border/40 bg-muted/20 sm:h-20"
          style={{
            gridTemplateColumns: `${incomeColumnPct}% ${expenseColumnPct}% ${availableColumnPct}%`,
          }}
        >
          <FlowSegment
            className="border-emerald-400/40 bg-gradient-to-r from-emerald-500/80 to-emerald-500/35 text-emerald-50"
            label="Ingresos"
            amount={periodIncome}
          />
          <FlowSegment
            className="z-10 -ml-3 border-destructive/60 bg-gradient-to-r from-destructive/75 to-destructive/40 pl-5 text-destructive-foreground [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)]"
            label={hasCommittedExpenses ? 'Gastos' : 'Sin gastos'}
            amount={committedAmount}
            compact={!hasCommittedExpenses}
          />
          <FlowSegment
            className="z-20 -ml-3 border-violet-400/50 bg-gradient-to-r from-violet-600/80 to-primary/55 pl-5 text-primary-foreground [clip-path:polygon(8%_0,100%_0,100%_100%,0_100%)]"
            label="Disponible"
            amount={incomeRemainder}
          />
        </div>
        <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
          Después de gastos te quedan{' '}
          <span
            className={cn(
              'font-mono font-semibold tabular-nums',
              incomeRemainder >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-destructive',
            )}
          >
            {formatCurrency(incomeRemainder)}
          </span>
          ; tus cuentas hoy muestran{' '}
          <span
            className={cn(
              'font-mono font-semibold tabular-nums',
              displayFundingNet >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-destructive',
            )}
          >
            {formatCurrency(displayFundingNet)}
          </span>
          .
        </p>
      </div>
    </div>
  );
};

type SummaryStepTone = 'income' | 'expense' | 'available' | 'real';

type SummaryStepProps = {
  number: string;
  title: string;
  subtitle: string;
  amount: number;
  tone: SummaryStepTone;
  icon: ReactNode;
};

const toneClasses: Record<SummaryStepTone, string> = {
  income:
    'border-l-[3px] border-l-emerald-500/70',
  expense:
    'border-l-[3px] border-l-destructive/70',
  available:
    'border-l-[3px] border-l-violet-500/70',
  real:
    'border-l-[3px] border-l-rose-500/70',
};

const numberToneClasses: Record<SummaryStepTone, string> = {
  income: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  expense: 'border-destructive/40 bg-destructive/10 text-destructive',
  available: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  real: 'border-destructive/40 bg-destructive/10 text-destructive',
};

function SummaryStep({
  number,
  title,
  subtitle,
  amount,
  tone,
  icon,
}: SummaryStepProps) {
  return (
    <div className={cn(stepBaseClass, toneClasses[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn(stepNumberClass, numberToneClasses[tone])}>
              {number}
            </span>
            <h3 className="text-xs font-semibold leading-tight sm:text-sm">{title}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground sm:text-xs">{subtitle}</p>
        </div>
        <span className={cn('rounded-lg border p-1.5', numberToneClasses[tone])}>
          {icon}
        </span>
      </div>
      <p
        className={cn(
          'mt-5 font-mono text-xl font-bold leading-none tracking-tight tabular-nums sm:text-2xl',
          tone === 'income' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'expense' && 'text-destructive',
          tone === 'available' && 'text-violet-700 dark:text-violet-300',
          tone === 'real' && (amount < 0 ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-300'),
        )}
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

type FlowSegmentProps = {
  label: string;
  amount: number;
  className: string;
  compact?: boolean;
};

function FlowSegment({
  label,
  amount,
  className,
  compact = false,
}: FlowSegmentProps) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col items-center justify-center border px-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
        className,
      )}
    >
      {compact ? null : (
        <span className="hidden font-mono text-sm font-bold tabular-nums sm:block sm:text-lg">
          {formatCurrency(amount)}
        </span>
      )}
      <span
        className={cn(
          'font-semibold opacity-85',
          compact
            ? 'hidden text-[9px] leading-tight sm:inline'
            : 'text-[10px] sm:mt-1 sm:text-xs',
        )}
      >
        {label}
      </span>
    </div>
  );
}
