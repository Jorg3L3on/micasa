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
  'relative min-h-[8.75rem] rounded-2xl border bg-card/55 p-4 shadow-sm transition-all duration-200';

const stepNumberClass =
  'inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold';

export const FortnightSummaryHero = ({
  periodIncome,
  committedAmount,
  incomeRemainder,
  fundingNetInAccounts,
  fundingNetApplies = true,
  payrollDeductionAmount = 0,
}: FortnightSummaryHeroProps) => {
  const displayFundingNet = fundingNetApplies ? fundingNetInAccounts : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
        className="overflow-hidden rounded-2xl border border-border/50 bg-background/55 p-3 shadow-inner"
        aria-label="Ingresos menos gastos igual a disponible"
      >
        <div className="grid h-20 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,.78fr)] overflow-hidden rounded-xl border border-border/40 bg-muted/30 sm:h-24">
          <FlowSegment
            className="border-emerald-400/60 bg-gradient-to-r from-emerald-500/85 to-emerald-500/35 text-emerald-50"
            label="Ingresos"
            amount={periodIncome}
          />
          <FlowSegment
            className="-ml-4 border-destructive/70 bg-gradient-to-r from-destructive/80 to-destructive/45 pl-7 text-destructive-foreground [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)]"
            label="Gastos"
            amount={committedAmount}
          />
          <FlowSegment
            className="-ml-4 border-violet-400/70 bg-gradient-to-r from-violet-600/80 to-primary/55 pl-7 text-primary-foreground [clip-path:polygon(8%_0,100%_0,100%_100%,0_100%)]"
            label="Disponible"
            amount={incomeRemainder}
          />
        </div>
        <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
          Después de gastos, quedan{' '}
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
    'border-emerald-500/25 border-l-[3px] border-l-emerald-500/70 text-emerald-700 dark:text-emerald-300',
  expense:
    'border-destructive/25 border-l-[3px] border-l-destructive/70 text-destructive',
  available:
    'border-violet-500/25 border-l-[3px] border-l-violet-500/70 text-violet-700 dark:text-violet-300',
  real:
    'border-destructive/25 border-l-[3px] border-l-destructive/70 text-destructive',
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn(stepNumberClass, numberToneClasses[tone])}>
              {number}
            </span>
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className={cn('rounded-xl border p-2', numberToneClasses[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-5 font-mono text-2xl font-black leading-none tracking-tight tabular-nums">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

type FlowSegmentProps = {
  label: string;
  amount: number;
  className: string;
};

function FlowSegment({ label, amount, className }: FlowSegmentProps) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col items-center justify-center border px-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
        className,
      )}
    >
      <span className="font-mono text-lg font-black tabular-nums sm:text-xl">
        {formatCurrency(amount)}
      </span>
      <span className="mt-1 text-xs font-semibold opacity-85">{label}</span>
    </div>
  );
}
