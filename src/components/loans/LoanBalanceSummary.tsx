import type { ReactNode } from 'react';
import { Landmark } from 'lucide-react';
import { Money } from '@/components/money';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { cn, formatDate } from '@/lib/utils';
import type { LoanListItem } from '@/types/loans';

type LoanBalanceSummaryProps = {
  loan: LoanListItem;
  progress: number;
  paymentSource: string;
};

const Metric = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="min-w-0">
    <p className="eyebrow text-muted-foreground">{label}</p>
    <div className="mt-1">{children}</div>
  </div>
);

/** Saldo, progreso y datos seguros de un préstamo. */
export const LoanBalanceSummary = ({
  loan,
  progress,
  paymentSource,
}: LoanBalanceSummaryProps) => {
  return (
    <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'p-4')}>
      <SectionHeader
        level={3}
        title="Saldo pendiente"
        icon={Landmark}
        actions={<Money value={loan.remainingAmount} size="hero" tone="neutral" />}
      />

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-2 text-caption">
          <span className="text-muted-foreground">Progreso</span>
          <span className="font-sans font-semibold tabular-nums text-foreground">
            {progress}%
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del préstamo"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-caption text-muted-foreground">
          {loan.paidPayments}/{loan.paymentCount} pagos cubiertos
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
        <Metric label="Pagado">
          <Money value={loan.paidAmount} size="row" tone="positive" />
        </Metric>
        <Metric label="Total">
          <Money value={loan.totalPayable} size="row" tone="neutral" />
        </Metric>
        <Metric label="Pago">
          <Money value={loan.paymentAmount} size="row" tone="neutral" />
        </Metric>
        <Metric label="Inicio">
          <span className="text-caption font-semibold text-foreground">
            {formatDate(loan.startDate)}
          </span>
        </Metric>
      </div>

      <dl className="mt-4 space-y-3 border-t border-border/60 pt-3 text-caption">
        <div>
          <dt className="eyebrow text-muted-foreground">Origen de pago</dt>
          <dd className="mt-1 font-medium text-foreground">{paymentSource}</dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Billetera relacionada</dt>
          <dd className="mt-1 font-medium text-foreground">
            {loan.linkedWalletName ?? 'Sin cuenta vinculada'}
          </dd>
        </div>
        {loan.notes ? (
          <div>
            <dt className="eyebrow text-muted-foreground">Notas</dt>
            <dd className="mt-1 text-foreground/85">{loan.notes}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
};
