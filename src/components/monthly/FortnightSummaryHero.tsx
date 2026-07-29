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

/**
 * Spec: match the user reference cards — vivid full-border outline, visible outer
 * glow, bright amount/title, filled circular icon bottom-left.
 * Do not dilute these opacities for “calm UI”.
 */
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
    card: cn(
      'border-2 border-emerald-400/90 bg-[#0b1612]',
      'shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_28px_rgba(16,185,129,0.55)]',
    ),
    title: 'text-emerald-300',
    subtitle: 'text-emerald-300/70',
    amount: 'text-emerald-400',
    icon: 'bg-emerald-500/25 text-emerald-300 ring-2 ring-emerald-400/70',
  },
  expense: {
    card: cn(
      'border-2 border-rose-400/90 bg-[#1a0f12]',
      'shadow-[0_0_0_1px_rgba(251,113,133,0.35),0_0_28px_rgba(244,63,94,0.55)]',
    ),
    title: 'text-rose-300',
    subtitle: 'text-rose-300/70',
    amount: 'text-rose-400',
    icon: 'bg-rose-500/25 text-rose-300 ring-2 ring-rose-400/70',
  },
  available: {
    card: cn(
      'border-2 border-violet-400/90 bg-[#120f1c]',
      'shadow-[0_0_0_1px_rgba(167,139,250,0.35),0_0_28px_rgba(139,92,246,0.55)]',
    ),
    title: 'text-violet-300',
    subtitle: 'text-violet-300/70',
    amount: 'text-violet-400',
    icon: 'bg-violet-500/25 text-violet-300 ring-2 ring-violet-400/70',
  },
  real: {
    card: cn(
      'border-2 border-rose-400/90 bg-[#1a0f12]',
      'shadow-[0_0_0_1px_rgba(251,113,133,0.35),0_0_28px_rgba(244,63,94,0.55)]',
    ),
    title: 'text-rose-300',
    subtitle: 'text-rose-300/70',
    amount: 'text-rose-400',
    icon: 'bg-rose-500/25 text-rose-300 ring-2 ring-rose-400/70',
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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
        // No overflow-hidden — it clips the outer neon glow from the reference.
        'group relative flex min-h-36 flex-col rounded-2xl px-3.5 py-3.5 transition-transform duration-200 hover:-translate-y-0.5',
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
          'mt-5 font-mono text-xl font-bold leading-none tracking-tight tabular-nums sm:text-2xl',
          styles.amount,
        )}
      >
        {formatCurrency(amount)}
      </p>

      <span
        className={cn(
          'mt-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          styles.icon,
        )}
        aria-hidden
      >
        {icon}
      </span>

      {connector ? (
        <span
          className="absolute -right-3.5 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#0c0c10] text-white/80 shadow-md lg:flex"
          aria-hidden
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </div>
  );
}
