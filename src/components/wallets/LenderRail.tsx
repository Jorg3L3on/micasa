'use client';

import Link from 'next/link';
import { LenderIdentity } from '@/components/loans/LenderIdentity';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { lenderNextCommitment } from '@/lib/finance/lender-next-commitment';
import {
  PAYROLL_DEDUCTION_COPY,
  payrollCommitmentHint,
} from '@/lib/finance/lender-payroll';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { LenderListItem } from '@/types/lenders';

type LenderRailProps = {
  lenders: LenderListItem[];
  className?: string;
};

const hintFor = (lender: LenderListItem): string => {
  const next = lenderNextCommitment(lender.payWindow, lender.loans);
  if (lender.payrollOnly || next.kind === 'payroll') {
    return payrollCommitmentHint(next.date ? formatDate(next.date) : null);
  }
  if (next.kind === 'none') return 'Sin próximo pago';
  const when = next.date ? formatDate(next.date) : '';
  return when
    ? `Próx. ${formatCurrency(next.amount)} · ${when}`
    : `Próx. ${formatCurrency(next.amount)}`;
};

export const LenderRail = ({ lenders, className }: LenderRailProps) => {
  return (
    <section aria-label="Prestamistas" className={cn('min-w-0', className)}>
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Prestamistas
      </h2>
      {lenders.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card px-3 py-6 text-center text-xs text-muted-foreground">
          Sin prestamistas
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-2 p-0" role="list">
          {lenders.map((lender) => {
            const payrollOnly = lender.payrollOnly;
            return (
              <li key={lender.id}>
                <Link
                  href="/loans"
                  className={cn(
                    MONTHLY_PANEL_SHELL_CLASS,
                    'flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/30',
                  )}
                  aria-label={`Ver préstamos de ${lender.name}`}
                >
                  <LenderIdentity
                    name={lender.name}
                    providerIconKey={lender.providerIconKey}
                    subtitle={
                      payrollOnly
                        ? `${lender.activeContractCount} contrato${lender.activeContractCount === 1 ? '' : 's'} · ${PAYROLL_DEDUCTION_COPY}`
                        : hintFor(lender)
                    }
                    className="min-w-0 flex-1"
                    nameClassName="text-sm"
                    iconClassName="h-9 w-9 rounded-xl"
                    iconInnerClassName="h-4 w-4"
                  />
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm font-bold tabular-nums">
                      {formatCurrency(lender.remainingPrincipal)}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      Pendiente
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
