'use client';

import type { ReactNode } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Wallet,
} from 'lucide-react';

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

type StepTone = 'income' | 'expense' | 'available' | 'real';

const toneClasses: Record<
  StepTone,
  {
    card: string;
    title: string;
    subtitle: string;
    amount: string;
    icon: string;
  }
> = {
  income: {
    card: 'border-emerald-500/45 bg-emerald-500/[0.04] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08),0_0_24px_-12px_rgba(16,185,129,0.45)]',
    title: 'text-emerald-600 dark:text-emerald-300',
    subtitle: 'text-emerald-700/55 dark:text-emerald-300/55',
    amount: 'text-emerald-600 dark:text-emerald-400',
    icon: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/35 dark:text-emerald-300',
  },
  expense: {
    card: 'border-destructive/45 bg-destructive/[0.04] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.08),0_0_24px_-12px_rgba(239,68,68,0.4)]',
    title: 'text-destructive/90',
    subtitle: 'text-destructive/55',
    amount: 'text-destructive',
    icon: 'bg-destructive/15 text-destructive ring-1 ring-destructive/35',
  },
  available: {
    card: 'border-violet-500/45 bg-violet-500/[0.04] shadow-[inset_0_0_0_1px_rgba(139,92,246,0.08),0_0_24px_-12px_rgba(139,92,246,0.45)]',
    title: 'text-violet-600 dark:text-violet-300',
    subtitle: 'text-violet-700/55 dark:text-violet-300/55',
    amount: 'text-violet-600 dark:text-violet-400',
    icon: 'bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/35 dark:text-violet-300',
  },
  real: {
    card: 'border-rose-500/45 bg-rose-500/[0.04] shadow-[inset_0_0_0_1px_rgba(244,63,94,0.08),0_0_24px_-12px_rgba(244,63,94,0.4)]',
    title: 'text-rose-600 dark:text-rose-300',
    subtitle: 'text-rose-700/55 dark:text-rose-300/55',
    amount: 'text-rose-600 dark:text-rose-400',
    icon: 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/35 dark:text-rose-300',
  },
};

export const FortnightSummaryHero = ({
  periodIncome,
  committedAmount,
  incomeRemainder,
  fundingNetInAccounts,
  fundingNetApplies = true,
  payrollDeductionAmount = 0,
}: FortnightSummaryHeroProps) => {
  const displayFundingNet = fundingNetApplies ? fundingNetInAccounts : 0;
  const realTone: StepTone = displayFundingNet < 0 ? 'real' : 'income';

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <SummaryStep
        number="1"
        title="Entró"
        subtitle="Ingresos totales"
        amount={periodIncome}
        tone="income"
        icon={<ArrowUpRight className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        connector
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
        icon={<ArrowDownRight className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        connector
      />
      <SummaryStep
        number="3"
        title="Queda disponible"
        subtitle="Disponible para usar"
        amount={incomeRemainder}
        tone="available"
        icon={<Wallet className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        connector
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
        tone={realTone}
        icon={<CreditCard className="h-4 w-4" aria-hidden data-icon="inline-start" />}
      />
    </div>
  );
};

type SummaryStepProps = {
  number: string;
  title: string;
  subtitle: string;
  amount: number;
  tone: StepTone;
  icon: ReactNode;
  connector?: boolean;
};

function SummaryStep({
  number,
  title,
  subtitle,
  amount,
  tone,
  icon,
  connector = false,
}: SummaryStepProps) {
  const styles = toneClasses[tone];

  return (
    <div
      className={cn(
        'group relative flex min-h-32 flex-col overflow-hidden rounded-xl border bg-card/70 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        styles.card,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h3
          className={cn(
            'text-xs font-semibold leading-tight sm:text-sm',
            styles.title,
          )}
        >
          <span className="font-bold">({number})</span> {title}
        </h3>
        <p className={cn('text-[10px] sm:text-xs', styles.subtitle)}>{subtitle}</p>
      </div>

      <p
        className={cn(
          'mt-4 font-mono text-xl font-bold leading-none tracking-tight tabular-nums sm:text-2xl',
          styles.amount,
        )}
      >
        {formatCurrency(amount)}
      </p>

      <span
        className={cn(
          'mt-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          styles.icon,
        )}
        aria-hidden
      >
        {icon}
      </span>

      {connector ? (
        <span
          className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm lg:flex"
          aria-hidden
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </div>
  );
}
