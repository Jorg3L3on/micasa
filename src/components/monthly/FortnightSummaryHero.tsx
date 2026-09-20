'use client';

import { getFortnightRemainderCopy } from '@/components/monthly/fortnight-summary-header';
import { cn, formatCurrency } from '@/lib/utils';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Ingresos menos pagado, pendiente, nómina y resto de presupuesto. */
  incomeRemainder: number;
  /** Pagado + pendiente + nómina + presupuesto restante. */
  dueToPay: number;
  /** Saldos activos Efectivo + Débito (bruto, “en cuentas hoy”). */
  fundingInAccounts: number;
  /** Resto del presupuesto de la quincena (“lo que te queda”). */
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

type LedgerRowProps = {
  label: string;
  amount: number;
  amountClassName?: string;
};

const LedgerRow = ({ label, amount, amountClassName }: LedgerRowProps) => (
  <div className="flex items-baseline justify-between gap-4">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span
      className={cn(
        'font-mono text-sm font-medium tabular-nums text-foreground sm:text-[15px]',
        amountClassName,
      )}
    >
      {formatCurrency(amount)}
    </span>
  </div>
);

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
  dueToPay,
  fundingInAccounts,
  leftoverAmount = 0,
}: FortnightSummaryHeroProps) => {
  const copy = getFortnightRemainderCopy(incomeRemainder);
  const remainderAbs = Math.abs(incomeRemainder);
  const showLeftover = leftoverAmount > 0;
  const remainderClass = remainderToneClass[copy.tone];

  return (
    <div className="flex min-w-0 flex-col gap-4">
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

      <div className="flex flex-col gap-2">
        <LedgerRow label="Entra" amount={periodIncome} />
        <LedgerRow label="Toca pagar" amount={dueToPay} />
        <LedgerRow
          label={copy.rowLabel}
          amount={remainderAbs}
          amountClassName={remainderClass}
        />
      </div>

      {showLeftover ? (
        <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
          <LedgerRow label="Lo que te queda" amount={leftoverAmount} />
        </div>
      ) : null}
    </div>
  );
};
