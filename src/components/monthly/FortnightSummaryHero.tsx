'use client';

import type { ReactNode } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  ArrowDownLeft,
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

const stepBaseClass =
  'group relative min-h-32 overflow-hidden rounded-xl border border-border/60 bg-card/60 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md';

const stepNumberClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-[10px] font-bold text-muted-foreground';

const stepIconClass =
  'rounded-lg border border-border/60 bg-muted/30 p-1.5 text-muted-foreground';

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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <SummaryStep
        number="1"
        title="Entró"
        subtitle="Ingresos totales"
        amount={periodIncome}
        icon={<ArrowDownLeft className="h-4 w-4" aria-hidden data-icon="inline-start" />}
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
        icon={<ArrowUpRight className="h-4 w-4" aria-hidden data-icon="inline-start" />}
        connector
      />
      <SummaryStep
        number="3"
        title="Queda disponible"
        subtitle="Disponible para usar"
        amount={incomeRemainder}
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
  icon: ReactNode;
  connector?: boolean;
};

function SummaryStep({
  number,
  title,
  subtitle,
  amount,
  icon,
  connector = false,
}: SummaryStepProps) {
  return (
    <div className={stepBaseClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={stepNumberClass}>{number}</span>
            <h3 className="text-xs font-semibold leading-tight text-foreground sm:text-sm">
              {title}
            </h3>
          </div>
          <p className="text-[10px] text-muted-foreground sm:text-xs">{subtitle}</p>
        </div>
        <span className={stepIconClass}>{icon}</span>
      </div>
      <p
        className={cn(
          'mt-5 font-mono text-xl font-bold leading-none tracking-tight tabular-nums text-foreground sm:text-2xl',
          amount < 0 && 'text-destructive',
        )}
      >
        {formatCurrency(amount)}
      </p>
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
